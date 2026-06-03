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


def _run_sql(query: str) -> list:
    """Execute SQL and return list of dicts."""
    from databricks.sdk.service.sql import StatementState
    w = _get_client()
    wh_id = _get_warehouse_id()
    if not wh_id:
        return []
    try:
        result = w.statement_execution.execute_statement(
            warehouse_id=wh_id,
            statement=query,
            wait_timeout="60s"
        )
        if result.status and result.status.state == StatementState.SUCCEEDED:
            if result.manifest and result.result:
                columns = [c.name for c in result.manifest.schema.columns]
                rows = []
                for chunk in (result.result.data_array or []):
                    rows.append(dict(zip(columns, chunk)))
                return rows
        return []
    except Exception:
        return []


# ============================================================
# TASK 4: QUERY EXPANSION (Ontology-powered)
# ============================================================

def expand_query(user_query: str) -> dict:
    """Expand user query using ontology aliases, labels, and related concepts.
    
    Returns:
        dict with 'expanded_query', 'original_query', 'expansions' list
    """
    t0 = time.time()
    expansions = []
    query_terms = [w.strip() for w in user_query.lower().split() if len(w.strip()) > 2]
    
    # Search ontology for matching entities
    if query_terms:
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
        
        # Collect expansions
        seen = set()
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
        expanded = f"{user_query} ({expansion_terms})"
    else:
        expanded = user_query
    
    return {
        "original_query": user_query,
        "expanded_query": expanded,
        "expansions": expansions[:8],
        "latency_ms": round((time.time() - t0) * 1000)
    }


# ============================================================
# TASK 5: HYBRID RETRIEVAL
# ============================================================

def _keyword_search(query: str, top_k: int = 50) -> list:
    """BM25-style keyword search against gold.search_documents.
    
    Uses LIKE/CONTAINS for full-text matching.
    Returns scored results.
    """
    t0 = time.time()
    
    # Extract meaningful search terms
    stop_words = {"the", "a", "an", "is", "are", "was", "were", "in", "on", "at",
                  "to", "for", "of", "and", "or", "not", "with", "from", "by",
                  "all", "give", "show", "find", "me", "his", "her", "their"}
    terms = [w.strip().lower() for w in re.split(r'[\s\(\)]+', query) 
             if len(w.strip()) > 2 and w.strip().lower() not in stop_words]
    
    if not terms:
        return [], 0
    
    # Build WHERE clause with relevance scoring
    like_conditions = " OR ".join(
        [f"LOWER(search_text) LIKE '%{t}%'" for t in terms[:8]]
    )
    
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
        WHERE {like_conditions}
        ORDER BY keyword_score DESC
        LIMIT {top_k}
    """)
    
    latency = round((time.time() - t0) * 1000)
    
    for r in (results or []):
        r["keyword_score"] = float(r.get("keyword_score", 0))
        r["retrieval_method"] = "keyword"
    
    return results or [], latency


def _vector_search(query: str, top_k: int = 50) -> list:
    """Vector similarity search against chunk-level index.
    
    Falls back to old document-level index if chunks not available.
    """
    t0 = time.time()
    w = _get_client()
    
    columns = [
        "chunk_id", "file_name", "page_id", "chunk_text",
        "doc_type", "author", "recipient", "location", "doc_date"
    ]
    
    # Try chunk index first, fall back to old index
    index_name = CHUNK_VS_INDEX
    try:
        response = w.vector_search_indexes.query_index(
            index_name=index_name,
            columns=columns,
            query_text=query,
            num_results=top_k,
        )
    except Exception:
        # Fallback to old document-level index
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
                    top_k: int = 25) -> dict:
    """Hybrid retrieval combining keyword + vector search.
    
    Steps:
    1. Keyword search (top 50)
    2. Vector search (top 50)
    3. Merge & deduplicate by chunk_id
    4. Weighted score: 0.4 * keyword + 0.6 * vector
    5. Return top 25
    """
    t0 = time.time()
    search_query = expanded_query or query
    
    # Parallel retrieval
    keyword_results, kw_latency = _keyword_search(search_query, top_k=50)
    vector_results, vs_latency = _vector_search(search_query, top_k=50)
    
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
    """Generate answer using Foundation Model with context."""
    w = _get_client()
    
    # Build context from top results
    context_parts = []
    for i, ctx in enumerate(contexts[:7]):
        chunk = (ctx.get("chunk_text") or "")[:1000]
        if not chunk:
            continue
        source = ctx.get("file_name", "Unknown")
        context_parts.append(f"[Source {i+1}: {source}]\n{chunk}")
    
    context_text = "\n\n---\n\n".join(context_parts)
    
    system_prompt = """You are a scholarly assistant specializing in Don Bosco and Salesian history.
Answer questions using ONLY the provided context documents.
Be precise and cite source documents when possible.
If the context doesn't contain enough information, say so clearly."""

    user_prompt = f"""Context Documents:
{context_text}

Question: {query}

Provide a clear, well-structured answer based on the context above."""

    try:
        response = w.serving_endpoints.query(
            name=FOUNDATION_MODEL,
            messages=[
                ChatMessage(role=ChatMessageRole.SYSTEM, content=system_prompt),
                ChatMessage(role=ChatMessageRole.USER, content=user_prompt),
            ],
            max_tokens=800,
            temperature=0.1,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"Unable to generate answer: {str(e)[:200]}"


# ============================================================
# MAIN ENTRY POINT
# ============================================================

def query_don_bosco(user_query: str, num_results: int = 20,
                    enable_reranking: bool = True,
                    enable_expansion: bool = True) -> dict:
    """Full hybrid retrieval pipeline.
    
    Pipeline:
        User Query → Ontology Expansion → Keyword Search → Vector Search
        → Hybrid Merge → Reranker → Top N → LLM Answer
    
    Returns:
        dict with 'answer', 'sources', and 'diagnostics'
    """
    t_start = time.time()
    diagnostics = {}
    
    # Step 1: Query Expansion
    if enable_expansion:
        expansion = expand_query(user_query)
        search_query = expansion["expanded_query"]
        diagnostics["expansion"] = expansion
    else:
        search_query = user_query
        diagnostics["expansion"] = {"expanded_query": user_query, "expansions": [], "latency_ms": 0}
    
    # Step 2-4: Hybrid Retrieval
    hybrid_result = hybrid_retrieve(
        query=user_query,
        expanded_query=search_query,
        top_k=25
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
    diagnostics["search_mode"] = "hybrid" + ("+rerank" if enable_reranking else "") + ("+expansion" if enable_expansion else "")
    
    return {
        "answer": answer,
        "sources": sources,
        "diagnostics": diagnostics,
    }
