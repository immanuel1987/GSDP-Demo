# Load .env for local development only (not on Databricks Apps where OAuth is auto-configured)
import os as _os
if not _os.environ.get("DATABRICKS_CLIENT_ID"):
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

"""GSDP Hybrid Search Backend - V2

Production-grade retrieval pipeline:
1. Query Expansion (ontology-powered)
2. Keyword Search (BM25-style via SQL)
3. Vector Search (embedding similarity)
4. Hybrid Merge (weighted dedup)
5. Reranking (LLM-based relevance scoring)
6. RAG Answer Generation

Author: GSDP Pipeline V2
"""

import time
import re
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.serving import ChatMessage, ChatMessageRole

# --- Configuration ---
CATALOG = "gsdp_poc"
RAW_SCHEMA = "raw"
GOLD_SCHEMA = "gold"

CHUNK_VS_INDEX = f"{CATALOG}.{RAW_SCHEMA}.silver_document_chunks_vs_index"
SEARCH_DOCUMENTS = f"{CATALOG}.{GOLD_SCHEMA}.search_documents"
SILVER_CHUNKS = f"{CATALOG}.{RAW_SCHEMA}.silver_document_chunks"

# Fallback to old index if chunks not ready yet
OLD_VS_INDEX = f"{CATALOG}.{RAW_SCHEMA}.silver_documents_vs_index"

FOUNDATION_MODEL = "databricks-meta-llama-3-3-70b-instruct"
VS_ENDPOINT = "don_bosco_vs_endpoint"

ONTOLOGY_NODES = f"{CATALOG}.{RAW_SCHEMA}.sdb6_ontology_nodes"
ONTOLOGY_CLASSES = f"{CATALOG}.{RAW_SCHEMA}.sdb6_ontology_classes"
ONTOLOGY_INDIVIDUALS = f"{CATALOG}.{RAW_SCHEMA}.sdb6_ontology_individuals"

SUB_DOCUMENTS = f"{CATALOG}.{RAW_SCHEMA}.bronze_sub_documents"
ENTITY_ALIASES = f"{CATALOG}.{RAW_SCHEMA}.entity_aliases"
ENTITY_RELATIONSHIPS = f"{CATALOG}.{RAW_SCHEMA}.entity_relationships"
ONTOLOGY_HIERARCHY = f"{CATALOG}.{RAW_SCHEMA}.ontology_hierarchy"

# Hybrid scoring weights
KEYWORD_WEIGHT = 0.40
VECTOR_WEIGHT = 0.60
RERANK_WEIGHT = 0.70
HYBRID_WEIGHT = 0.30

# --- Singleton Client ---
_client = None

def _get_client():
    """Get WorkspaceClient - works both on Databricks Apps and locally.
    
    On Databricks Apps: auto-authenticates via service principal.
    Locally: reads DATABRICKS_HOST + DATABRICKS_TOKEN from environment or .databrickscfg.
    """
    global _client
    if _client is None:
        import os
        # On Databricks Apps, OAuth is auto-configured via CLIENT_ID/SECRET
        # Only use explicit PAT when OAuth is NOT present (local dev)
        if not os.environ.get("DATABRICKS_CLIENT_ID"):
            host = os.environ.get("DATABRICKS_HOST")
            token = os.environ.get("DATABRICKS_TOKEN")
            if host and token:
                _client = WorkspaceClient(host=host, token=token)
                return _client
        _client = WorkspaceClient()
    return _client


def _get_warehouse_id():
    import os
    wh_id = os.environ.get("DATABRICKS_SQL_WAREHOUSE_ID")
    if wh_id:
        return wh_id
    w = _get_client()
    warehouses = list(w.warehouses.list())
    for wh in warehouses:
        if wh.state and wh.state.value in ("RUNNING", "STARTING"):
            return wh.id
    if warehouses:
        return warehouses[0].id
    return None


def _run_sql(query: str, retries: int = 2) -> list:
    """Execute SQL and return list of dicts. Retries on transient failures."""
    import sys
    from databricks.sdk.service.sql import StatementState
    w = _get_client()
    wh_id = _get_warehouse_id()
    if not wh_id:
        return []
    for attempt in range(retries + 1):
        try:
            result = w.statement_execution.execute_statement(
                warehouse_id=wh_id,
                statement=query,
                wait_timeout="50s"
            )
            if result.status and result.status.state == StatementState.SUCCEEDED:
                if result.manifest and result.result:
                    columns = [c.name for c in result.manifest.schema.columns]
                    rows = []
                    for chunk in (result.result.data_array or []):
                        rows.append(dict(zip(columns, chunk)))
                    return rows
            elif result.status:
                print(f"[_run_sql] Attempt {attempt}: state={result.status.state}", file=sys.stderr)
            if attempt < retries:
                import time as _time
                _time.sleep(2)
        except Exception as e:
            print(f"[_run_sql] Attempt {attempt} exception: {e}", file=sys.stderr)
            if attempt < retries:
                import time as _time
                _time.sleep(2)
    return []


# ============================================================
# METADATA FILTER DETECTION
# ============================================================

def _detect_doc_type_filter(query: str):
    """Detect if the query implies a specific document type filter.
    
    Returns a dict like {"doc_type": "letter"} or {"doc_types": ["letter", "appeal"]} or None.
    Supports hierarchy expansion: "communications" -> all child types via ontology_hierarchy.
    """
    q = query.lower()
    
    # Direct type keywords -> single filter
    type_keywords = {
        "letter": ["letter", "letters", "correspondence", "epistol"],
        "chapter": ["chapter", "chapters"],
        "appeal": ["appeal", "appeals"],
        "section": ["section", "sections"],
        "monolithic": ["memoir", "memoirs", "treatise", "regulation", "biography"],
    }
    for doc_type, keywords in type_keywords.items():
        for kw in keywords:
            if kw in q:
                return {"doc_type": doc_type}
    
    # Hierarchy parent keywords -> expand to child types
    # "communications" -> letter + appeal (types that are direct communications)
    # "publications" -> chapter + monolithic (types that are published works)
    parent_expansions = {
        "Communication": ["communication", "communications", "writings"],
        "Publication": ["publication", "publications", "books", "written works"],
    }
    for parent, keywords in parent_expansions.items():
        for kw in keywords:
            if kw in q:
                # Look up child types from ontology_hierarchy
                children = _run_sql(f"""
                    SELECT LOWER(child_name) AS child_type 
                    FROM {ONTOLOGY_HIERARCHY}
                    WHERE parent_name = '{parent}' AND relationship = 'subTypeOf'
                """)
                if children:
                    child_types = [c["child_type"] for c in children]
                    return {"doc_types": child_types}
    
    return None


# ============================================================
# TASK 4: QUERY EXPANSION (Ontology-powered)
# ============================================================

def _resolve_coreferences(query: str) -> tuple:
    """Resolve coreference mentions in the query to canonical entity names.
    
    Uses the entity_coreferences table to map phrases like:
    - 'the founder' -> 'Don Bosco'
    - 'his holiness' -> 'Pius IX'
    - 'the rector' -> 'Don Bosco'
    
    Returns:
        tuple: (resolved_query, list of resolutions applied)
    """
    ENTITY_COREFERENCES = f"{CATALOG}.{RAW_SCHEMA}.entity_coreferences"
    
    # Get known coreference patterns (rule-based ones are most reliable)
    coref_rules = _run_sql(f"""
        SELECT DISTINCT
            LOWER(mention_text) AS mention,
            resolved_entity
        FROM {ENTITY_COREFERENCES}
        WHERE method = 'rule_based' AND confidence >= 0.9
    """)
    
    if not coref_rules:
        return query, []
    
    resolved_query = query
    resolutions = []
    q_lower = query.lower()
    
    for rule in coref_rules:
        mention = rule.get("mention", "")
        resolved = rule.get("resolved_entity", "")
        if mention and resolved and mention in q_lower:
            # Add the resolved entity name to boost retrieval
            resolutions.append({"mention": mention, "resolved_to": resolved})
            # Append resolved entity to query (don't replace - keep original intent)
            resolved_query = f"{resolved_query} {resolved}"
    
    return resolved_query, resolutions


def expand_query(user_query: str) -> dict:
    """Expand user query using ontology aliases, coreferences, and related concepts.
    
    Pipeline:
    1. Resolve coreferences (e.g. 'the founder' -> adds 'Don Bosco')
    2. Match against entity_aliases for variant names
    3. Expand via ontology classes and individuals
    
    Returns:
        dict with 'expanded_query', 'original_query', 'expansions', 'coreferences'
    """
    t0 = time.time()
    expansions = []
    
    # Step 1: Coreference resolution
    coref_query, coreferences = _resolve_coreferences(user_query)
    
    # Step 2: Alias resolution - check if any query terms match known aliases
    query_terms = [w.strip() for w in coref_query.lower().split() if len(w.strip()) > 2]
    
    if query_terms:
        # Check entity_aliases for canonical name expansions
        alias_conditions = " OR ".join(
            [f"LOWER(raw_name) LIKE '%{t}%'" for t in query_terms[:5]]
        )
        alias_matches = _run_sql(f"""
            SELECT DISTINCT canonical_name
            FROM {ENTITY_ALIASES}
            WHERE ({alias_conditions})
            LIMIT 5
        """)
        for am in (alias_matches or []):
            canonical = am.get("canonical_name", "")
            if canonical and canonical.lower() not in {t for t in query_terms}:
                expansions.append(canonical)
        
        # Step 3: Ontology expansion
        term_conditions = " OR ".join(
            [f"LOWER(entity_display_label) LIKE '%{t}%'" for t in query_terms[:5]]
        )
        
        # Search classes
        class_matches = _run_sql(f"""
            SELECT DISTINCT entity_display_label, entity_name
            FROM {ONTOLOGY_CLASSES}
            WHERE ({term_conditions})
            AND entity_display_label IS NOT NULL
            LIMIT 15
        """)
        
        # Search individuals (named entities)
        individual_matches = _run_sql(f"""
            SELECT DISTINCT entity_display_label, entity_name
            FROM {ONTOLOGY_INDIVIDUALS}
            WHERE ({term_conditions})
            AND entity_display_label IS NOT NULL
            LIMIT 15
        """)
        
        # Collect ontology expansions
        seen = set(e.lower() for e in expansions)
        for match in (class_matches or []) + (individual_matches or []):
            label = match.get("entity_display_label", "")
            name = match.get("entity_name", "")
            if label and label.lower() not in seen:
                seen.add(label.lower())
                expansions.append(label)
            if name and name.lower() not in seen and name != label:
                seen.add(name.lower())
                expansions.append(name.replace("_", " "))
    
    # Build expanded query
    if expansions:
        expansion_terms = " OR ".join(expansions[:8])
        expanded = f"{coref_query} ({expansion_terms})"
    else:
        expanded = coref_query
    
    return {
        "original_query": user_query,
        "expanded_query": expanded,
        "expansions": expansions[:8],
        "coreferences": coreferences,
        "latency_ms": round((time.time() - t0) * 1000)
    }


# ============================================================
# TASK 5: HYBRID RETRIEVAL
# ============================================================

def _keyword_search(query: str, top_k: int = 50, filters: dict = None) -> list:
    """BM25-style keyword search against gold.search_documents.
    
    Uses LIKE/CONTAINS for full-text matching.
    Supports metadata filters (e.g. {"doc_type": "letter"}).
    Returns scored results.
    """
    t0 = time.time()
    
    # Extract meaningful search terms
    stop_words = {"the", "a", "an", "is", "are", "was", "were", "in", "on", "at",
                  "to", "for", "of", "and", "or", "not", "with", "from", "by",
                  "all", "give", "show", "find", "me", "his", "her", "their",
                  "list", "every", "display", "enumerate"}
    terms = [w.strip().lower() for w in re.split(r'[\s\(\)]+', query) 
             if len(w.strip()) > 2 and w.strip().lower() not in stop_words]
    
    if not terms:
        # If no content terms but we have a filter, return all matching docs
        if filters and (filters.get("doc_type") or filters.get("doc_types")):
            if filters.get("doc_types"):
                types_in = ", ".join([f"'{t}'" for t in filters["doc_types"]])
                type_clause = f"doc_type IN ({types_in})"
            else:
                type_clause = f"doc_type = '{filters['doc_type']}'"
            results = _run_sql(f"""
                SELECT 
                    chunk_id, file_name, page_id, chunk_text, doc_type,
                    author, recipient, location, CAST(doc_date AS STRING) as doc_date,
                    1.0 AS keyword_score
                FROM {SEARCH_DOCUMENTS}
                WHERE {type_clause}
                ORDER BY file_name, page_id
                LIMIT {top_k}
            """)
            latency = round((time.time() - t0) * 1000)
            for r in (results or []):
                r["keyword_score"] = float(r.get("keyword_score", 0))
                r["retrieval_method"] = "keyword"
            return results or [], latency
        return [], 0
    
    # Build WHERE clause with relevance scoring
    like_conditions = " OR ".join(
        [f"LOWER(search_text) LIKE '%{t}%'" for t in terms[:8]]
    )
    
    # Add metadata filter if provided
    filter_clause = ""
    if filters:
        if filters.get("doc_types"):
            types_in = ", ".join([f"'{t}'" for t in filters["doc_types"]])
            filter_clause = f"AND doc_type IN ({types_in})"
        elif filters.get("doc_type"):
            filter_clause = f"AND doc_type = '{filters['doc_type']}'"
    
    # Score based on term frequency (count matches)
    score_expr_parts = []
    for t in terms[:8]:
        score_expr_parts.append(
            f"CASE WHEN LOWER(search_text) LIKE '%{t}%' THEN 1.0 ELSE 0.0 END"
        )
    score_expr = " + ".join(score_expr_parts)
    max_score = len(terms[:8])
    
    results = _run_sql(f"""
        SELECT 
            chunk_id, file_name, page_id, chunk_text, doc_type,
            author, recipient, location, CAST(doc_date AS STRING) as doc_date,
            ({score_expr}) / {max_score} AS keyword_score
        FROM {SEARCH_DOCUMENTS}
        WHERE ({like_conditions}) {filter_clause}
        ORDER BY keyword_score DESC
        LIMIT {top_k}
    """)
    
    latency = round((time.time() - t0) * 1000)
    
    for r in (results or []):
        r["keyword_score"] = float(r.get("keyword_score", 0))
        r["retrieval_method"] = "keyword"
    
    return results or [], latency


def _vector_search(query: str, top_k: int = 50, filters: dict = None) -> list:
    """Vector similarity search against chunk-level index.
    
    Supports metadata filters (e.g. {"doc_type": "letter"}) for type-specific queries.
    Falls back to old document-level index if chunks not available.
    """
    t0 = time.time()
    w = _get_client()
    
    columns = [
        "chunk_id", "file_name", "page_id", "chunk_text",
        "doc_type", "author", "recipient", "location", "doc_date"
    ]
    
    # Build filter dict for vector search API
    vs_filters = None
    if filters:
        if filters.get("doc_types"):
            # Vector search supports IN via doc_type IN ('letter', 'circular', 'appeal')
            vs_filters = {"doc_type": filters["doc_types"]}
        elif filters.get("doc_type"):
            vs_filters = {"doc_type": filters["doc_type"]}
    
    # Try chunk index first, fall back to old index
    index_name = CHUNK_VS_INDEX
    try:
        kwargs = {
            "index_name": index_name,
            "columns": columns,
            "query_text": query,
            "num_results": top_k,
        }
        if vs_filters:
            kwargs["filters"] = vs_filters
        response = w.vector_search_indexes.query_index(**kwargs)
    except Exception:
        # Fallback to old document-level index (no filter support)
        index_name = OLD_VS_INDEX
        columns = [
            "file_name", "page_id", "content",
            "doc_type", "author", "recipient", "location", "doc_date",
            "confidence_score"
        ]
        try:
            response = w.vector_search_indexes.query_index(
                index_name=index_name,
                columns=columns,
                query_text=query,
                num_results=top_k,
            )
        except Exception:
            return [], round((time.time() - t0) * 1000)
    
    results = []
    if response and response.result and response.result.data_array:
        col_names = [c.name for c in response.manifest.columns] if response.manifest else columns
        for row in response.result.data_array:
            record = dict(zip(col_names, row))
            # Normalize score (VS returns distance, lower = better)
            score = float(record.pop("score", 0.5)) if "score" in record else 0.5
            record["vector_score"] = min(max(score, 0), 1)
            record["retrieval_method"] = "vector"
            # Normalize content field
            if "content" in record and "chunk_text" not in record:
                record["chunk_text"] = (record.pop("content") or "")[:2000]
            if "chunk_id" not in record:
                import hashlib
                record["chunk_id"] = hashlib.md5(
                    f"{record.get('file_name','')}||{record.get('page_id',1)}||0".encode()
                ).hexdigest()
            results.append(record)
    
    latency = round((time.time() - t0) * 1000)
    return results, latency


def hybrid_retrieve(query: str, expanded_query: str = None,
                    top_k: int = 25, filters: dict = None) -> dict:
    """Hybrid retrieval combining keyword + vector search.
    
    Steps:
    1. Keyword search (top 50, with optional metadata filter)
    2. Vector search (top 50, with optional metadata filter)
    3. Merge & deduplicate by chunk_id
    4. Weighted score: 0.4 * keyword + 0.6 * vector
    5. Return top 25
    """
    t0 = time.time()
    search_query = expanded_query or query
    
    # Increase retrieval depth when filtering by type (to get more coverage)
    retrieval_k = 200 if filters else 50
    
    # Parallel retrieval with metadata filters
    keyword_results, kw_latency = _keyword_search(search_query, top_k=retrieval_k, filters=filters)
    vector_results, vs_latency = _vector_search(search_query, top_k=retrieval_k, filters=filters)
    
    # Merge by chunk_id (or file_name as fallback key)
    merged = {}
    
    for r in (keyword_results or []):
        key = r.get("chunk_id") or r.get("file_name", "")
        if key not in merged:
            merged[key] = {**r, "vector_score": 0.0}
        else:
            merged[key]["keyword_score"] = r.get("keyword_score", 0)
    
    for r in (vector_results or []):
        key = r.get("chunk_id") or r.get("file_name", "")
        if key not in merged:
            merged[key] = {**r, "keyword_score": 0.0}
        else:
            merged[key]["vector_score"] = r.get("vector_score", 0)
            # Fill in missing fields from vector results
            for field in ["chunk_text", "doc_type", "author", "recipient", "location", "doc_date"]:
                if not merged[key].get(field) and r.get(field):
                    merged[key][field] = r[field]
    
    # Calculate hybrid score
    for key, r in merged.items():
        kw_score = float(r.get("keyword_score", 0))
        vs_score = float(r.get("vector_score", 0))
        r["hybrid_score"] = (KEYWORD_WEIGHT * kw_score) + (VECTOR_WEIGHT * vs_score)
        r["retrieval_method"] = "hybrid"
    
    # Sort and top-k
    ranked = sorted(merged.values(), key=lambda x: x["hybrid_score"], reverse=True)[:top_k]
    
    total_latency = round((time.time() - t0) * 1000)
    
    return {
        "results": ranked,
        "keyword_count": len(keyword_results or []),
        "vector_count": len(vector_results or []),
        "merged_count": len(merged),
        "returned_count": len(ranked),
        "keyword_latency_ms": kw_latency,
        "vector_latency_ms": vs_latency,
        "total_latency_ms": total_latency,
    }


# ============================================================
# TASK 6: RERANKING
# ============================================================

def rerank_results(query: str, candidates: list, top_k: int = 10) -> list:
    """Rerank candidates using LLM-based relevance scoring.
    
    Uses Foundation Model to score relevance 0-100.
    Final score: 0.7 * rerank_score + 0.3 * hybrid_score
    """
    t0 = time.time()
    
    if not candidates:
        return []
    
    w = _get_client()
    reranked = []
    
    # Batch reranking (score each candidate)
    for candidate in candidates[:top_k * 2]:  # Score more than needed
        chunk_text = (candidate.get("chunk_text") or "")[:500]
        if not chunk_text:
            candidate["rerank_score"] = 0.0
            candidate["final_score"] = candidate.get("hybrid_score", 0)
            reranked.append(candidate)
            continue
        
        prompt = f"""Rate the relevance of this document passage to the user question on a scale of 0-100.
Only respond with a single integer number.

QUESTION: {query}

PASSAGE: {chunk_text}

RELEVANCE SCORE (0-100):"""

        try:
            response = w.serving_endpoints.query(
                name=FOUNDATION_MODEL,
                messages=[
                    ChatMessage(role=ChatMessageRole.USER, content=prompt)
                ],
                max_tokens=5,
                temperature=0.0,
            )
            score_text = response.choices[0].message.content.strip()
            # Extract number
            score_match = re.search(r'(\d+)', score_text)
            rerank_score = int(score_match.group(1)) / 100.0 if score_match else 0.5
            rerank_score = min(max(rerank_score, 0), 1.0)
        except Exception:
            rerank_score = 0.5
        
        candidate["rerank_score"] = rerank_score
        candidate["final_score"] = (
            RERANK_WEIGHT * rerank_score + 
            HYBRID_WEIGHT * candidate.get("hybrid_score", 0)
        )
        reranked.append(candidate)
    
    # Sort by final score
    reranked.sort(key=lambda x: x.get("final_score", 0), reverse=True)
    
    latency = round((time.time() - t0) * 1000)
    
    for r in reranked:
        r["rerank_latency_ms"] = latency
    
    return reranked[:top_k]


# ============================================================
# TASK 7: RAG ANSWER GENERATION
# ============================================================

def _generate_answer(query: str, contexts: list) -> str:
    """Generate answer using Foundation Model with context.
    
    Deduplicates by document, presents clean text without numbering,
    and instructs the model to produce natural, well-formatted responses.
    """
    w = _get_client()
    
    # Deduplicate chunks by document - group and merge text
    doc_contexts = {}
    for ctx in contexts[:10]:
        chunk = (ctx.get("chunk_text") or "")[:1200]
        if not chunk:
            continue
        fn = ctx.get("file_name", "Unknown")
        if fn not in doc_contexts:
            # Format clean title from filename
            title = fn.replace(".pdf", "").replace("Bosco-", "")
            import re as _re
            m = _re.match(r"(\d+\.\d+\.\d+)-(.*)", title)
            if m:
                title = m.group(2).replace("-", " ").title()
            doc_contexts[fn] = {"title": title, "chunks": []}
        doc_contexts[fn]["chunks"].append(chunk)
    
    # Build context WITHOUT numbering - just title + text
    context_parts = []
    for fn, doc in list(doc_contexts.items())[:5]:
        merged_text = "\n".join(doc["chunks"][:3])[:2000]
        context_parts.append(f"--- {doc['title']} ---\n{merged_text}")
    
    context_text = "\n\n".join(context_parts)
    
    system_prompt = """You are a knowledgeable research assistant specializing in Don Bosco and Salesian history.

RESPONSE RULES:
- Write a clear, well-structured answer using markdown formatting
- Use **bold** for key names, dates, and important terms
- Use bullet points or numbered lists when listing multiple items
- Keep the response concise (3-5 paragraphs maximum)
- NEVER reference documents by number (no "Document 1", "Source 2", etc.)
- NEVER use parenthetical citations like (Source 1) or [Document 2]
- Instead, naturally weave document titles into your answer when relevant, e.g. "According to the Memoirs of the Oratory..." or "In his letters to..."
- If quoting directly, use quotation marks
- Answer ONLY from the provided context — never invent facts
- If context is insufficient, state that clearly
- Use a professional, informative tone
- End complex answers with a brief one-line summary in bold"""

    user_prompt = f"""Reference Material:
{context_text}

---

Question: {query}

Write a comprehensive, well-formatted answer."""

    try:
        response = w.serving_endpoints.query(
            name=FOUNDATION_MODEL,
            messages=[
                ChatMessage(role=ChatMessageRole.SYSTEM, content=system_prompt),
                ChatMessage(role=ChatMessageRole.USER, content=user_prompt),
            ],
            max_tokens=1000,
            temperature=0.1,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"Unable to generate answer: {str(e)[:200]}"


# ============================================================
# LISTING QUERY HANDLER
# ============================================================

_LIST_PATTERNS = [
    (r"\b(?:list|show|give|display|enumerate)\s+(?:me\s+)?(?:all|every|the)\s+(?:the\s+)?(\w+)", 1),
    (r"\b(?:how many|count)\s+(?:the\s+)?(\w+)", 1),
    (r"\b(?:what are)\s+(?:all\s+)?(?:the\s+)?(\w+)", 1),
]

def _detect_listing_query(user_query: str):
    """Detect if query is asking for an exhaustive listing.
    
    Returns the sub_doc_type to list (e.g. 'letter', 'chapter') or None.
    """
    q = user_query.lower().strip()
    type_aliases = {
        "letter": "letter", "letters": "letter",
        "chapter": "chapter", "chapters": "chapter",
        "appeal": "appeal", "appeals": "appeal",
        "regulation": "regulation", "regulations": "regulation",
        "section": "section", "sections": "section",
        "memoir": "monolithic", "memoirs": "monolithic",
        "document": None, "documents": None,  # too broad
    }
    # Parent categories that expand to multiple types
    parent_aliases = {
        "communication": ["letter", "appeal"],
        "communications": ["letter", "appeal"],
        "publication": ["chapter", "monolithic"],
        "publications": ["chapter", "monolithic"],
    }
    
    for pattern, group_idx in _LIST_PATTERNS:
        m = re.search(pattern, q)
        if m:
            word = m.group(group_idx).strip().lower()
            if word in type_aliases:
                return type_aliases[word]
            if word in parent_aliases:
                return parent_aliases[word]  # Returns list of types
    return None


def _handle_listing_query(user_query: str, doc_type) -> dict:
    """Handle listing queries by directly querying bronze_sub_documents.
    
    Accepts doc_type as str (single type) or list (multiple types from hierarchy).
    Returns a complete catalog of items instead of RAG-style answer.
    """
    import sys
    t_start = time.time()
    print(f"[LISTING] Detected listing query for type='{doc_type}', query='{user_query}'", file=sys.stderr)
    
    # Handle both single type (str) and multiple types (list)
    if isinstance(doc_type, list):
        type_clause = ", ".join([f"'{t}'" for t in doc_type])
        type_where = f"sub_doc_type IN ({type_clause})"
        type_label = " + ".join([t.capitalize() + "s" for t in doc_type])
    else:
        type_where = f"sub_doc_type = '{doc_type}'"
        type_label = doc_type.capitalize() + ("s" if not doc_type.endswith("s") else "")

    # Get all sub-docs of requested type(s)
    rows = _run_sql(f"""
        SELECT title, recipient, location, 
               CAST(doc_date AS STRING) AS doc_date,
               parent_file_name AS file_name,
               sub_doc_type,
               char_count
        FROM {SUB_DOCUMENTS}
        WHERE {type_where}
        ORDER BY parent_file_name, sub_doc_sequence
    """)
    
    print(f"[LISTING] SQL returned {len(rows) if rows else 0} rows", file=sys.stderr)
    
    if not rows:
        return None  # Fall through to normal RAG

    # Build structured answer
    total = len(rows)
    # type_label already set above

    # Group by source PDF
    by_pdf = {}
    for r in rows:
        fn = r.get("file_name", "Unknown")
        if fn not in by_pdf:
            by_pdf[fn] = []
        by_pdf[fn].append(r)

    # Build markdown answer
    lines = [f"## All {type_label} in the GSDP Corpus ({total} total)\n"]
    lines.append(f"Found **{total}** items across **{len(by_pdf)} source documents**.\n")

    for fn, items in sorted(by_pdf.items()):
        # Clean PDF name for display
        display_name = fn.replace(".pdf", "").replace("Bosco-", "")
        display_name = re.sub(r"^\d+\.\d+\.\d+-", "", display_name).replace("-", " ").strip()
        lines.append(f"\n### {display_name} ({len(items)} items)\n")

        for item in items:
            title = item.get("title", "Untitled") or "Untitled"
            parts = [f"- **{title}**"]
            if item.get("recipient"):
                parts.append(f"  \u2192 {item['recipient']}")
            if item.get("location") and item.get("doc_date"):
                parts.append(f"  ({item['location']}, {item['doc_date']})")
            elif item.get("doc_date"):
                parts.append(f"  ({item['doc_date']})")
            elif item.get("location"):
                parts.append(f"  ({item['location']})")
            lines.append("".join(parts))

    answer = "\n".join(lines)

    # Build sources from the items
    sources = []
    for r in rows[:50]:
        sources.append({
            "file_name": r.get("file_name", ""),
            "page_id": 1,
            "chunk_id": "",
            "doc_type": doc_type if isinstance(doc_type, str) else doc_type,
            "author": "Don Bosco",
            "recipient": r.get("recipient", ""),
            "location": r.get("location", ""),
            "doc_date": r.get("doc_date", ""),
            "content": r.get("title", ""),
            "confidence": 1.0,
            "keyword_score": 1.0,
            "vector_score": 0,
            "hybrid_score": 1.0,
            "rerank_score": 1.0,
            "final_score": 1.0,
        })

    return {
        "answer": answer,
        "sources": sources,
        "diagnostics": {
            "search_mode": "listing_query",
            "doc_type": doc_type,
            "total_items": total,
            "source_pdfs": len(by_pdf),
            "total_latency_ms": round((time.time() - t_start) * 1000),
        },
    }


# ============================================================
# STRUCTURED METADATA QUERY ROUTER
# ============================================================

_METADATA_PATTERNS = [
    (r"\b(?:who)\s+(?:received|got|were sent|did .+ write to|did .+ send)\b", "recipient_query"),
    (r"\b(?:who)\s+(?:wrote|authored|sent|penned)\b", "author_query"),
    (r"\b(?:recipients?|addressees?)\b", "recipient_query"),
    (r"\b(?:what did .+ found|what .+ founded|organizations? .+ founded)\b", "relationship_founded"),
    (r"\b(?:who did .+ thank|whom .+ thanked)\b", "relationship_thanked"),
    (r"\b(?:what .+ visit|where .+ visit|places? .+ visited)\b", "relationship_visited"),
    (r"\b(?:relationships?|connections?)\s+(?:of|between|with)\b", "relationship_all"),
    (r"\b(?:when|what date|what year)\s+(?:did|was|were)\b", "date_query"),
    (r"\b(?:letters?|documents?)\s+(?:from|written in|dated)\s+(\d{4})", "date_filter_query"),
    (r"\b(?:before|after|between)\s+\d{4}\b", "date_filter_query"),
    (r"\b(?:where)\s+(?:did|was|were)\s+.+\s+(?:writ|sent|from)\b", "location_query"),
    (r"\b(?:letters?|documents?)\s+(?:from|written in|sent from)\s+([A-Z][a-z]+)", "location_filter_query"),
    (r"\b(?:how many)\s+(?:letters?|documents?|chapters?|appeals?)\b", "count_query"),
    (r"\b(?:total|number of)\s+(?:letters?|documents?|recipients?)\b", "count_query"),
]


def _detect_metadata_query(user_query: str):
    """Detect if query can be answered from metadata (SQL) instead of RAG.
    
    Returns dict with query_type + params, or None.
    """
    q = user_query.lower().strip()
    
    # Known people to exclude from location extraction
    KNOWN_PERSONS = {"don bosco", "john bosco", "fr bosco", "st bosco", "pope", "pius"}
    
    for pattern, query_type in _METADATA_PATTERNS:
        m = re.search(pattern, q)
        if m:
            params = {"query_type": query_type, "raw_query": user_query}
            
            # Extract year
            year_match = re.search(r"\b(1[78]\d{2})\b", q)
            if year_match:
                params["year"] = year_match.group(1)
            
            # Extract location (but not if it's a known person name)
            loc_match = re.search(r"\b(?:from|in|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)", user_query)
            if loc_match:
                loc_candidate = loc_match.group(1)
                if loc_candidate.lower() not in KNOWN_PERSONS and not any(p in loc_candidate.lower() for p in KNOWN_PERSONS):
                    params["location"] = loc_candidate
            
            # Extract person (from "to <Person>" patterns, not "from Don Bosco")
            person_match = re.search(r"\bto\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})", user_query)
            if person_match:
                params["person"] = person_match.group(1)
            
            # Extract doc type
            for dtype in ["letter", "chapter", "appeal", "circular"]:
                if dtype in q:
                    params["doc_type"] = dtype
                    break
            
            return params
    
    # Additional: "letters from <Location>" — check if it's a place, not a person
    loc_filter = re.search(r"\b(?:letters?|documents?)\s+from\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)", user_query)
    if loc_filter:
        candidate = loc_filter.group(1).lower()
        if candidate not in KNOWN_PERSONS and not any(p in candidate for p in KNOWN_PERSONS):
            return {"query_type": "location_filter_query", "raw_query": user_query, "location": loc_filter.group(1)}
    
    return None


def _handle_metadata_query(params: dict):
    """Execute structured SQL for metadata questions. Returns answer dict or None."""
    import sys
    t_start = time.time()
    query_type = params.get("query_type")
    print(f"[METADATA] type={query_type}, params={params}", file=sys.stderr)

    conditions = []
    if params.get("doc_type"):
        conditions.append(f"sub_doc_type = '{params['doc_type']}'")
    if params.get("year"):
        conditions.append(f"YEAR(doc_date) = {params['year']}")
    if params.get("location"):
        conditions.append(f"LOWER(location) LIKE '%{params['location'].lower()}%'")
    if params.get("person") and query_type in ("recipient_query", "location_filter_query", "date_filter_query"):
        conditions.append(f"LOWER(recipient) LIKE '%{params['person'].lower()}%'")
    where_clause = " AND ".join(conditions) if conditions else "1=1"

    if query_type == "recipient_query":
        # Use entity_aliases to normalize recipient names in results
        rows = _run_sql(f"""
            SELECT 
                COALESCE(a.canonical_name, sd.recipient) AS recipient,
                COUNT(*) AS letter_count,
                MIN(CAST(sd.doc_date AS STRING)) AS earliest,
                MAX(CAST(sd.doc_date AS STRING)) AS latest
            FROM {SUB_DOCUMENTS} sd
            LEFT JOIN {ENTITY_ALIASES} a ON LOWER(sd.recipient) = LOWER(a.raw_name)
            WHERE sd.recipient IS NOT NULL AND sd.recipient != ''
              AND {where_clause if conditions else "sd.sub_doc_type = 'letter'"}
            GROUP BY COALESCE(a.canonical_name, sd.recipient) 
            ORDER BY letter_count DESC
        """)
        if not rows:
            return None
        total_r = len(rows)
        total_l = sum(int(r.get("letter_count", 0)) for r in rows)
        lines = [f"## Recipients of Don Bosco's Letters\n",
                 f"Found **{total_r} distinct recipients** across **{total_l} letters**.\n",
                 "| Recipient | Letters | Period |", "| --- | --- | --- |"]
        for r in rows[:50]:
            e = r.get("earliest", ""); l = r.get("latest", "")
            period = f"{e} to {l}" if e and l and e != l else (e or l or "undated")
            lines.append(f"| {r.get('recipient','')} | {r.get('letter_count',0)} | {period} |")
        if total_r > 50:
            lines.append(f"\n*...and {total_r - 50} more*")
        answer = "\n".join(lines)

    elif query_type in ("date_query", "date_filter_query"):
        extra = where_clause if conditions else "sub_doc_type = 'letter'"
        rows = _run_sql(f"""
            SELECT title, recipient, location, CAST(doc_date AS STRING) AS doc_date,
                   parent_file_name AS file_name
            FROM {SUB_DOCUMENTS}
            WHERE doc_date IS NOT NULL AND {extra}
            ORDER BY doc_date
        """)
        if not rows:
            return None
        heading = f"Documents from {params.get('year', 'all dates')}" if params.get("year") else "Chronological Results"
        if params.get("person"):
            heading = f"Letters to {params['person']}"
        lines = [f"## {heading} ({len(rows)} found)\n"]
        for r in rows[:50]:
            title = r.get("title", "Untitled") or "Untitled"
            lines.append(f"- **{title}** → {r.get('recipient','')} ({r.get('doc_date','undated')}, {r.get('location','')})")
        answer = "\n".join(lines)

    elif query_type in ("location_query", "location_filter_query"):
        extra = where_clause if conditions else "sub_doc_type = 'letter'"
        # Expand location filter using ontology hierarchy (e.g., Turin → also Valdocco, Valsalice)
        if params.get("location"):
            loc = params["location"]
            child_locs = _run_sql(f"""
                SELECT child_name FROM {ONTOLOGY_HIERARCHY}
                WHERE parent_name = '{loc}' AND relationship = 'partOf'
            """)
            if child_locs:
                loc_list = [loc] + [c["child_name"] for c in child_locs]
                loc_filter = " OR ".join([f"LOWER(location) LIKE '%{l.lower()}%'" for l in loc_list])
                extra = f"({loc_filter})"
                if params.get("doc_type"):
                    extra += f" AND sub_doc_type = '{params['doc_type']}'"
        rows = _run_sql(f"""
            SELECT location, COUNT(*) AS doc_count
            FROM {SUB_DOCUMENTS}
            WHERE location IS NOT NULL AND location != '' AND {extra}
            GROUP BY location ORDER BY doc_count DESC
        """)
        if not rows:
            return None
        lines = [f"## Writing Locations ({len(rows)} places)\n",
                 "| Location | Documents |", "| --- | --- |"]
        for r in rows[:30]:
            lines.append(f"| {r.get('location','')} | {r.get('doc_count',0)} |")
        answer = "\n".join(lines)

    elif query_type == "count_query":
        rows = _run_sql(f"""
            SELECT sub_doc_type, COUNT(*) AS total,
                   COUNT(DISTINCT recipient) AS recipients,
                   COUNT(doc_date) AS dated
            FROM {SUB_DOCUMENTS}
            WHERE {where_clause}
            GROUP BY sub_doc_type ORDER BY total DESC
        """)
        if not rows:
            return None
        lines = ["## Document Counts\n", "| Type | Total | Recipients | Dated |", "| --- | --- | --- | --- |"]
        grand = 0
        for r in rows:
            t = int(r.get("total", 0)); grand += t
            lines.append(f"| {r.get('sub_doc_type','')} | {t} | {r.get('recipients',0)} | {r.get('dated',0)} |")
        lines.append(f"\n**Grand total: {grand} sub-documents**")
        answer = "\n".join(lines)

    elif query_type == "author_query":
        rows = _run_sql(f"""
            SELECT author, COUNT(*) AS doc_count
            FROM {SUB_DOCUMENTS}
            WHERE author IS NOT NULL AND author != '' AND {where_clause}
            GROUP BY author ORDER BY doc_count DESC
        """)
        if not rows:
            return None
        lines = ["## Authors\n"]
        for r in rows[:20]:
            lines.append(f"- **{r.get('author','')}** — {r.get('doc_count',0)} documents")
        answer = "\n".join(lines)
    elif query_type.startswith("relationship_"):
        # Extract predicate from query_type
        predicate = query_type.replace("relationship_", "")
        if predicate == "all":
            # Show all relationship types for a subject
            rows = _run_sql(f"""
                SELECT predicate, object, COUNT(*) AS cnt
                FROM {ENTITY_RELATIONSHIPS}
                WHERE LOWER(subject) LIKE '%bosco%' OR LOWER(subject) = 'don bosco'
                GROUP BY predicate, object
                ORDER BY predicate, cnt DESC
            """)
        else:
            rows = _run_sql(f"""
                SELECT subject, object, source_file, confidence
                FROM {ENTITY_RELATIONSHIPS}
                WHERE predicate = '{predicate}'
                ORDER BY confidence DESC
            """)
        
        if not rows:
            return None
        
        if predicate == "all":
            lines = ["## Don Bosco's Relationships (Knowledge Graph)\n"]
            current_pred = None
            for r in rows:
                if r.get('predicate') != current_pred:
                    current_pred = r['predicate']
                    lines.append(f"\n### {current_pred.replace('_', ' ').title()}\n")
                lines.append(f"- {r.get('object', '')} ({r.get('cnt', 1)}x)")
        else:
            lines = [f"## {predicate.replace('_', ' ').title()} Relationships\n"]
            for r in rows[:30]:
                subj = r.get('subject', '')
                obj = r.get('object', '')
                lines.append(f"- **{subj}** → {predicate} → **{obj}**")
        
        answer = "\n".join(lines)

    else:
        return None

    # Sources
    sources = []
    detail = _run_sql(f"""
        SELECT title, recipient, location, CAST(doc_date AS STRING) AS doc_date,
               parent_file_name AS file_name, sub_doc_type
        FROM {SUB_DOCUMENTS} WHERE {where_clause if conditions else "1=1"}
        ORDER BY parent_file_name, sub_doc_sequence LIMIT 50
    """)
    for r in (detail or []):
        sources.append({"file_name": r.get("file_name",""), "page_id": 1, "chunk_id": "",
            "doc_type": r.get("sub_doc_type",""), "author": "Don Bosco",
            "recipient": r.get("recipient",""), "location": r.get("location",""),
            "doc_date": r.get("doc_date",""), "content": r.get("title",""),
            "confidence": 1.0, "keyword_score": 1.0, "vector_score": 0,
            "hybrid_score": 1.0, "rerank_score": 1.0, "final_score": 1.0})

    return {"answer": answer, "sources": sources,
        "diagnostics": {"search_mode": "structured_metadata", "query_type": query_type,
            "params": {k:v for k,v in params.items() if k != "raw_query"},
            "total_latency_ms": round((time.time() - t_start) * 1000)}}



# ============================================================
# MAIN ENTRY POINT
# ============================================================

def query_don_bosco(user_query: str, num_results: int = 20,
                    enable_reranking: bool = True,
                    enable_expansion: bool = True) -> dict:
    """Full hybrid retrieval pipeline.
    
    Pipeline:
        User Query \u2192 Listing Detection \u2192 (if listing: SQL catalog)
                  \u2192 Doc Type Filter Detection
                  \u2192 Ontology Expansion \u2192 Keyword Search \u2192 Vector Search
                  \u2192 Hybrid Merge (with metadata filters) \u2192 Reranker \u2192 Top N \u2192 LLM Answer
    
    Returns:
        dict with 'answer', 'sources', and 'diagnostics'
    """
    t_start = time.time()
    
    # Check if this is a listing/catalog query
    listing_type = _detect_listing_query(user_query)
    if listing_type:
        listing_result = _handle_listing_query(user_query, listing_type)
        if listing_result:
            return listing_result
    
    # Check if this is a structured metadata query (who/when/where/how many)
    metadata_params = _detect_metadata_query(user_query)
    if metadata_params:
        metadata_result = _handle_metadata_query(metadata_params)
        if metadata_result:
            return metadata_result
    
    diagnostics = {}
    
    # Detect doc_type metadata filter from query
    doc_type_filter = _detect_doc_type_filter(user_query)
    if doc_type_filter:
        diagnostics["metadata_filter"] = doc_type_filter
        diagnostics["search_mode_suffix"] = "+filter"
    
    # Step 1: Query Expansion
    if enable_expansion:
        expansion = expand_query(user_query)
        search_query = expansion["expanded_query"]
        diagnostics["expansion"] = expansion
    else:
        search_query = user_query
        diagnostics["expansion"] = {"expanded_query": user_query, "expansions": [], "latency_ms": 0}
    
    # Step 2-4: Hybrid Retrieval (with metadata filter if detected)
    hybrid_result = hybrid_retrieve(
        query=user_query,
        expanded_query=search_query,
        top_k=25,
        filters=doc_type_filter,
    )
    diagnostics["hybrid"] = {
        "keyword_count": hybrid_result["keyword_count"],
        "vector_count": hybrid_result["vector_count"],
        "merged_count": hybrid_result["merged_count"],
        "keyword_latency_ms": hybrid_result["keyword_latency_ms"],
        "vector_latency_ms": hybrid_result["vector_latency_ms"],
        "hybrid_latency_ms": hybrid_result["total_latency_ms"],
    }
    
    candidates = hybrid_result["results"]
    
    # Step 5: Reranking
    if enable_reranking and candidates:
        reranked = rerank_results(user_query, candidates, top_k=min(num_results, 10))
        diagnostics["reranking"] = {
            "input_count": len(candidates),
            "output_count": len(reranked),
            "latency_ms": reranked[0].get("rerank_latency_ms", 0) if reranked else 0,
        }
        final_results = reranked
    else:
        final_results = candidates[:num_results]
        diagnostics["reranking"] = {"skipped": True}
    
    # Step 6: Generate Answer
    t_answer = time.time()
    answer = _generate_answer(user_query, final_results)
    diagnostics["answer_latency_ms"] = round((time.time() - t_answer) * 1000)
    
    # Build source citations
    sources = []
    for r in final_results[:num_results]:
        sources.append({
            "file_name": r.get("file_name", ""),
            "page_id": r.get("page_id"),
            "chunk_id": r.get("chunk_id", ""),
            "doc_type": r.get("doc_type", ""),
            "author": r.get("author", ""),
            "recipient": r.get("recipient", ""),
            "location": r.get("location", ""),
            "doc_date": r.get("doc_date", ""),
            "content": (r.get("chunk_text") or "")[:2000],
            "confidence": r.get("final_score") or r.get("hybrid_score") or r.get("vector_score", 0),
            "keyword_score": r.get("keyword_score", 0),
            "vector_score": r.get("vector_score", 0),
            "hybrid_score": r.get("hybrid_score", 0),
            "rerank_score": r.get("rerank_score"),
            "final_score": r.get("final_score") or r.get("hybrid_score", 0),
        })
    
    diagnostics["total_latency_ms"] = round((time.time() - t_start) * 1000)
    diagnostics["search_mode"] = "hybrid" + ("+rerank" if enable_reranking else "") + ("+expansion" if enable_expansion else "") + ("+filter" if doc_type_filter else "")
    
    return {
        "answer": answer,
        "sources": sources,
        "diagnostics": diagnostics,
    }
