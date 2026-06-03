# GSDP Pipeline - Complete Build Prompt

---

You are a Senior Databricks Data Engineer and AI Architect. Build a complete PySpark + SQL pipeline for the **GSDP (Global Salesian Digital Platform)** Semantic Search system with the following requirements:

---

## OBJECTIVE

Build an end-to-end document intelligence pipeline that:
1. Ingests PDFs from a Unity Catalog Volume
2. Parses documents using AI (ai_parse_document)
3. Extracts entities using Foundation Models
4. Links entities to a domain ontology (OWL/JSON-LD)
5. Builds semantic chunks (300-500 tokens)
6. Creates a hybrid search layer (keyword + vector)
7. Implements RAG with ontology-powered query expansion and reranking
8. Deploys as a Databricks Streamlit App

---

## ENVIRONMENT

```
Platform:             Databricks on Azure
Runtime:              15.4+
Catalog:              gsdp_poc
Schemas:              raw, gold
Volume:               /Volumes/gsdp_poc/raw/docs/ (43 Don Bosco PDFs)
Compute:              Serverless
Foundation Model:     databricks-meta-llama-3-3-70b-instruct
Embedding Model:      databricks-bge-large-en
Vector Search Endpoint: don_bosco_vs_endpoint
SQL Warehouse:        Serverless Starter Warehouse
SQL Warehouse ID:     c01af5f8d785be11
```

---

## PIPELINE TASKS (Sequential, Idempotent)

### Task 0 — PDF Ingestion (Bronze)

```
Source: /Volumes/gsdp_poc/raw/docs/*.pdf
Target: gsdp_poc.raw.bronze_doc_elements
Method: ai_parse_document()
```

**Schema:**
| Column | Type | Description |
|--------|------|-------------|
| file_name | STRING | PDF filename |
| file_path | STRING | Full volume path |
| page_id | INT | Page number |
| element_id | INT | Element index within page |
| element_type | STRING | text, title, table, image |
| content | STRING | Extracted text content |
| confidence | FLOAT | Parse confidence score |
| ingested_at | TIMESTAMP | Ingestion timestamp |
| file_hash | STRING | MD5 of file for dedup |

**Requirements:**
- Process ALL PDFs in the volume
- Generate file_hash (MD5) for deduplication
- MERGE by (file_name, page_id, element_id)
- Expected: ~15,000 rows from 43 documents

---

### Task 1 — Entity Extraction (Bronze)

```
Source: gsdp_poc.raw.bronze_doc_elements
Target: gsdp_poc.raw.bronze_extracted_entities
Method: Foundation Model via serving_endpoints.query()
```

**Schema:**
| Column | Type | Description |
|--------|------|-------------|
| file_name | STRING | Source document |
| page_id | INT | Page number |
| entity_type | STRING | person, organization, location, date, event, concept |
| entity_name | STRING | Extracted entity text |
| entity_role | STRING | Role/function of entity |
| confidence | FLOAT | Extraction confidence |
| iso_date | STRING | ISO date if entity_type=date |
| raw_json | STRING | Full LLM response JSON |
| extracted_at | TIMESTAMP | Extraction timestamp |

**Requirements:**
- Process page 1 of each document (title pages contain key metadata)
- Prompt LLM to return structured JSON with entities array
- Parse response, handle malformed JSON gracefully
- MERGE by (file_name, page_id, entity_name, entity_type)
- Expected: ~940 rows

**LLM Prompt Template:**
```
Extract all entities from this document text. Return JSON:
{"entities": [{"type": "person|organization|location|date|event|concept",
               "name": "...", "role": "...", "confidence": 0.0-1.0,
               "iso_date": "YYYY-MM-DD or null"}]}
```

---

### Task 2 — Ontology Linking (Silver)

```
Source: bronze_extracted_entities + sdb6_ontology_* tables
Target: gsdp_poc.raw.silver_entity_ontology_links
Method: Fuzzy string matching (Levenshtein)
```

**Ontology Tables (pre-loaded from OWL/JSON-LD):**
| Table | Rows | Content |
|-------|------|---------|
| sdb6_ontology_nodes | 625 | All ontology entities |
| sdb6_ontology_classes | 180 | Class hierarchy |
| sdb6_ontology_individuals | 291 | Named instances |
| sdb6_ontology_properties | 128 | Relationships |
| sdb6_ontology_triples | 1,519 | Subject-predicate-object |
| sdb6_ontology_restrictions | 33 | OWL restrictions |
| sdb6_ontology_qa_issues | 170 | Quality issues |

**Schema:**
| Column | Type | Description |
|--------|------|-------------|
| entity_name | STRING | Extracted entity text |
| matched_entity_id | STRING | Ontology URI |
| match_type | STRING | exact or fuzzy |
| confidence | FLOAT | Match confidence |
| source_file | STRING | Origin document |
| linked_at | TIMESTAMP | Linking timestamp |

**Requirements:**
- Match entities to ontology individuals by display_label
- Use exact match first, then fuzzy (Levenshtein ratio > 0.6)
- MERGE by (entity_name, matched_entity_id)
- Expected: ~790 rows

---

### Task 3 — Silver Documents (Enriched)

```
Source: bronze_doc_elements + bronze_extracted_entities
Target: gsdp_poc.raw.silver_documents
```

**Schema:**
| Column | Type | Description |
|--------|------|-------------|
| file_name | STRING | Document identifier |
| page_id | INT | Always 1 (one row per doc) |
| content | STRING | Full text (all pages concatenated) |
| doc_type | STRING | letter, regulation, biography, etc. |
| author | STRING | Document author |
| recipient | STRING | Document recipient |
| doc_date | DATE | Document date |
| location | STRING | Place of writing |
| linked_entity_ids | ARRAY\<STRING\> | Ontology URIs |
| topics | ARRAY\<STRING\> | Topic labels |
| confidence_score | FLOAT | Avg extraction confidence |
| ontology_version | INT | Ontology version used |
| enriched_at | TIMESTAMP | Enrichment timestamp |
| enriched_text | STRING | Text + metadata annotations |

**Requirements:**
- ONE row per document (concatenate all page content)
- Populate metadata (author, recipient, etc.) from entity extraction
- Enable Change Data Feed (`delta.enableChangeDataFeed = true`)
- MERGE by file_name
- Expected: 43 rows

---

### Task 4 — Gold Layer (Star Schema)

```
Source: silver_documents + bronze_extracted_entities
Targets: 5 tables in gsdp_poc.gold
```

**dim_documents:**
| Column | Type | Description |
|--------|------|-------------|
| doc_id | STRING | MD5(file_name) |
| file_name | STRING | Document name |
| doc_type | STRING | Document category |
| author | STRING | Author name |
| recipient | STRING | Recipient |
| doc_date | DATE | Document date |
| location | STRING | Location |
| page_count | INT | Total pages |
| entity_count | INT | Entities found |
| topic_count | INT | Topics assigned |
| created_at | TIMESTAMP | Row creation time |

**dim_entities:**
| Column | Type | Description |
|--------|------|-------------|
| entity_id | STRING | MD5(entity_name + entity_type) |
| entity_name | STRING | Entity text |
| entity_type | STRING | Type category |
| first_seen_in | STRING | First document |
| occurrence_count | INT | Total mentions |
| avg_confidence | FLOAT | Mean confidence |
| created_at | TIMESTAMP | Row creation time |

**fact_document_entities:**
| Column | Type | Description |
|--------|------|-------------|
| doc_id | STRING | FK to dim_documents |
| entity_id | STRING | FK to dim_entities |
| relationship_type | STRING | Entity role |
| confidence | FLOAT | Extraction confidence |
| page_id | INT | Source page |

**fact_entity_relationships:**
| Column | Type | Description |
|--------|------|-------------|
| source_entity_id | STRING | FK to dim_entities |
| target_entity_id | STRING | FK to dim_entities |
| relationship_type | STRING | co-occurrence |
| co_occurrence_count | INT | Times seen together |
| source_doc_id | STRING | FK to dim_documents |

**dim_topics:**
| Column | Type | Description |
|--------|------|-------------|
| topic_id | STRING | MD5(topic_name + doc_id) |
| topic_name | STRING | Topic label |
| doc_id | STRING | FK to dim_documents |
| file_name | STRING | Source document |
| created_at | TIMESTAMP | Row creation time |

**Expected Rows:** dim_documents=43, dim_entities=524, fact_document_entities=1,552, fact_entity_relationships=34,956, dim_topics=102

---

### Task 5 — Document Vector Index

```
Source: gsdp_poc.raw.silver_documents
Index:  gsdp_poc.raw.silver_documents_vs_index
Endpoint: don_bosco_vs_endpoint
Embedding Column: content
Model: databricks-bge-large-en
Type: DELTA_SYNC, TRIGGERED
Primary Key: file_name
```

**SDK Pattern:**
```python
from databricks.sdk.service.vectorsearch import (
    DeltaSyncVectorIndexSpecRequest, EmbeddingSourceColumn,
    PipelineType, VectorIndexType
)
w.vector_search_indexes.create_index(
    name=index_name,
    endpoint_name=endpoint,
    primary_key="file_name",
    index_type=VectorIndexType.DELTA_SYNC,
    delta_sync_index_spec=DeltaSyncVectorIndexSpecRequest(
        source_table=source_table,
        pipeline_type=PipelineType.TRIGGERED,
        embedding_source_columns=[
            EmbeddingSourceColumn(name="content",
                                  embedding_model_endpoint_name=model)
        ],
    ),
)
```

---

### Task 6 — Semantic Chunking (V2)

```
Source: gsdp_poc.raw.silver_documents
Target: gsdp_poc.raw.silver_document_chunks
```

**Schema:**
| Column | Type | Description |
|--------|------|-------------|
| file_name | STRING | Source document |
| page_id | INT | Page reference |
| chunk_id | STRING | MD5(file_name \|\| page_id \|\| chunk_seq) |
| chunk_text | STRING | Chunk content |
| chunk_sequence | INT | Order within document |
| chunk_token_count | INT | Token count (~4 chars/token) |
| doc_type | STRING | Inherited metadata |
| author | STRING | Inherited metadata |
| recipient | STRING | Inherited metadata |
| location | STRING | Inherited metadata |
| doc_date | DATE | Inherited metadata |
| topics | ARRAY\<STRING\> | Inherited metadata |
| linked_entity_ids | ARRAY\<STRING\> | Inherited metadata |
| ontology_class_uri | STRING | Primary ontology class |
| confidence_score | DOUBLE | Avg confidence |
| created_at | TIMESTAMP | Creation time |

**Chunking Algorithm:**
```
1. Split content by sentences (regex: r'(?<=[.!?])\s+')
2. Accumulate sentences until token count reaches 300-500
3. On overflow: finalize chunk, start next with last sentence (1-sentence overlap)
4. Token estimation: len(text) // 4
5. Generate chunk_id: MD5(f"{file_name}||{page_id}||{chunk_sequence}")
```

**Requirements:**
- Enable Change Data Feed
- MERGE by chunk_id
- Expected: ~2,157 chunks (avg 380 tokens, min 98, max 504)

---

### Task 7 — Hybrid Search Table (V2)

```
Source: gsdp_poc.raw.silver_document_chunks
Target: gsdp_poc.gold.search_documents
```

**Schema:**
| Column | Type | Description |
|--------|------|-------------|
| chunk_id | STRING | Primary key |
| file_name | STRING | Document name |
| page_id | INT | Page reference |
| chunk_text | STRING | Raw chunk text |
| chunk_sequence | INT | Order in document |
| doc_type | STRING | Document category |
| author | STRING | Author |
| recipient | STRING | Recipient |
| location | STRING | Location |
| doc_date | DATE | Document date |
| ontology_class_uri | STRING | Ontology class |
| topics | ARRAY\<STRING\> | Topic labels |
| linked_entity_ids | ARRAY\<STRING\> | Ontology links |
| search_text | STRING | Enriched searchable text |
| created_at | TIMESTAMP | Creation time |

**search_text construction:**
```sql
CONCAT_WS('\n',
    '[Document Type: ' || COALESCE(doc_type, 'Unknown') || ']',
    '[Author: ' || COALESCE(author, 'Unknown') || ']',
    '[Recipient: ' || COALESCE(recipient, 'Unknown') || ']',
    '[Location: ' || COALESCE(location, 'Unknown') || ']',
    '[Topics: ' || COALESCE(ARRAY_JOIN(topics, ', '), '') || ']',
    chunk_text
)
```

**Requirements:**
- Enable Change Data Feed
- MERGE by chunk_id
- Expected: 2,157 rows

---

### Task 8 — Chunk Vector Index (V2)

```
Source: gsdp_poc.gold.search_documents
Index:  gsdp_poc.raw.silver_document_chunks_vs_index
Endpoint: don_bosco_vs_endpoint
Embedding Column: search_text
Model: databricks-bge-large-en
Type: DELTA_SYNC, TRIGGERED
Primary Key: chunk_id
```

Same SDK pattern as Task 5, but with `primary_key="chunk_id"` and embedding on `search_text`.

---

## RETRIEVAL PIPELINE (search_backend.py)

### Architecture

```
User Query
    |
    v
[1] Ontology Query Expansion (sdb6 tables)
    |
    v
[2] Keyword Search ----+---- [3] Vector Search
    (LIKE on search_documents)  (chunk VS index)
    |                           |
    v                           v
[4] Hybrid Merge (40% KW + 60% VS, dedup by chunk_id)
    |
    v
[5] LLM Reranking (70% rerank + 30% hybrid)
    |
    v
[6] Top 7 chunks -> Foundation Model -> RAG Answer
```

### Function Specifications

#### expand_query(user_query: str) -> dict
```python
# Search ontology_classes + ontology_individuals by display_label LIKE
# Returns: {"expanded_query": "original OR alias1 OR alias2",
#           "expansions": [...], "latency_ms": 45}
```

#### _keyword_search(query: str, top_k=50) -> tuple[list, int]
```python
# SQL: SELECT ... FROM gold.search_documents WHERE search_text LIKE '%term%'
# Score: count_matching_terms / total_query_terms
# Returns: (results_list, latency_ms)
```

#### _vector_search(query: str, top_k=50) -> tuple[list, int]
```python
# Query CHUNK_VS_INDEX, fallback to OLD doc-level index
# Normalize score from SDK response
# Returns: (results_list, latency_ms)
```

#### hybrid_retrieve(query, expanded_query, top_k=25) -> dict
```python
# Merge keyword + vector by chunk_id
# hybrid_score = 0.40 * keyword_score + 0.60 * vector_score
# Returns: {"results": [...], "kw_count": N, "vs_count": N,
#           "merged_count": N, "kw_latency_ms": X, "vs_latency_ms": Y}
```

#### rerank_results(query, candidates, top_k=10) -> list
```python
# LLM prompt per candidate: "Rate relevance 0-100"
# final_score = 0.70 * (rerank/100) + 0.30 * hybrid_score
# Returns: sorted list with rerank_score and final_score added
```

#### _generate_answer(query, contexts) -> str
```python
# System: "You are a Salesian history scholar..."
# User: query + top 7 chunk contexts
# Temperature: 0.1, max_tokens: 800
# Returns: answer string with citations
```

#### query_don_bosco(user_query, num_results=20, enable_reranking=True, enable_expansion=True) -> dict
```python
# Full pipeline entry point
# Returns:
{
    "answer": "Based on the documents...",
    "sources": [
        {
            "file_name": "Bosco-4.2.1-Memoirs-of-the-oratory.pdf",
            "page_id": 1,
            "chunk_id": "82a06310d5f7d98bd46de0c383da7d1d",
            "doc_type": "autobiography",
            "author": "Don Bosco",
            "recipient": "",
            "location": "Turin",
            "doc_date": "1873-01-01",
            "content": "chunk text...",
            "confidence": 0.9,
            "keyword_score": 0.0,
            "vector_score": 0.85,
            "hybrid_score": 0.51,
            "rerank_score": 0.92,
            "final_score": 0.80
        }
    ],
    "diagnostics": {
        "expansion": {"expanded_query": "...", "expansions": [], "latency_ms": 45},
        "hybrid": {"kw_count": 0, "vs_count": 50, "merged_count": 50,
                   "kw_latency_ms": 39, "vs_latency_ms": 641},
        "reranking": {"reranked_count": 10, "latency_ms": 5000},
        "answer_latency_ms": 3400,
        "total_latency_ms": 9500,
        "search_mode": "hybrid+rerank+expansion"
    }
}
```

---

## STREAMLIT APP (app.py)

### UI Specification

**Layout:**
- Title: 📚 GSDP (with custom CSS, no top padding)
- `st.form("search_form")` with text_input + submit button ONLY
- No checkboxes visible — hybrid + expansion + reranking always ON
- `st.spinner("Searching...")` wraps the search call
- Results count + latency: "About 20 results • 9498 ms"

**Result Cards:**
- Alternating colors: even = blue (#f0f7ff, border-left: 4px solid #4285f4), odd = green (#f9faf9, border-left: 4px solid #34a853)
- Each card contains (single st.markdown, unsafe_allow_html=True):
  - Title (bold blue, formatted from filename via regex)
  - Meta line: §Section › doc_type › date • 🎯score% • ✍️author • →recipient • 📍location
  - Score bars: colored spans (KW=yellow #fbbc04, VS=blue #4285f4, RR=green #34a853)
  - Snippet: meaningful text with query terms highlighted (yellow background #fff3cd, bold)
- `st.download_button` per result: styled as 12px blue text link "📄 Open PDF — Title"

**Landing Page (no search):**
- 4 metric columns: Documents, Chunks, Entities, Topics
- Full document list as st.dataframe

**Styling (injected via st.markdown):**
```css
#MainMenu {visibility: hidden;}
header {visibility: hidden;}
footer {visibility: hidden;}
.block-container {padding-top: 1rem !important;}
```

### Caching Strategy
| Decorator | TTL | Used For |
|-----------|-----|----------|
| @st.cache_resource | - | WorkspaceClient singleton |
| @st.cache_data(ttl=600) | 10min | Corpus stats, document list, SQL queries |
| @st.cache_data(ttl=300) | 5min | PDF file bytes |
| @st.cache_data(ttl=120) | 2min | Search results (keyed by query+rerank+expand) |

### Dual-Environment Authentication
```python
# At top of every file (app.py, search_backend.py, data_access.py):
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Client factory:
def get_ws_client():
    import os
    host = os.environ.get("DATABRICKS_HOST")
    token = os.environ.get("DATABRICKS_TOKEN")
    if host and token:
        return WorkspaceClient(host=host, token=token)  # Local dev
    return WorkspaceClient()  # Databricks Apps (auto-auth via SP)
```

### Session State
```python
if submitted and query:
    st.session_state["last_query"] = query
active_query = st.session_state.get("last_query", "")
active_rerank = True   # Always on
active_expand = True   # Always on
```

---

## APP SOURCE FILES

| File | Purpose | Key Content |
|------|---------|-------------|
| app.yaml | App startup | `command: ["streamlit", "run", "app.py"]` + env DATABRICKS_SQL_WAREHOUSE_ID |
| requirements.txt | Dependencies | streamlit>=1.31.0, databricks-sdk>=0.20.0, pandas>=2.0.0, python-dotenv>=1.0.0 |
| config.py | Constants | Catalog, schemas, table FQNs, model names, VS index names, APP_TITLE, MAX_SEARCH_RESULTS=20 |
| data_access.py | SQL execution | run_query() via `w.statement_execution.execute_statement()` |
| search_backend.py | Retrieval | expand_query, keyword_search, vector_search, hybrid_retrieve, rerank, generate_answer, query_don_bosco |
| app.py | Streamlit UI | Form, results, cards, PDF download, landing page |
| .env | Local creds | DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_SQL_WAREHOUSE_ID |
| .env.example | Template | Same keys with placeholder values |

---

## PERMISSIONS (App Service Principal)

```sql
-- Catalog access
GRANT USE CATALOG ON CATALOG gsdp_poc TO `app-avbvnb gsdp`;

-- Raw schema (read + write for vector index source)
GRANT USE SCHEMA ON SCHEMA gsdp_poc.raw TO `app-avbvnb gsdp`;
GRANT SELECT ON SCHEMA gsdp_poc.raw TO `app-avbvnb gsdp`;
GRANT CREATE TABLE ON SCHEMA gsdp_poc.raw TO `app-avbvnb gsdp`;

-- Gold schema (read-only)
GRANT USE SCHEMA ON SCHEMA gsdp_poc.gold TO `app-avbvnb gsdp`;
GRANT SELECT ON SCHEMA gsdp_poc.gold TO `app-avbvnb gsdp`;

-- Volume (PDF downloads)
GRANT READ VOLUME ON VOLUME gsdp_poc.raw.docs TO `app-avbvnb gsdp`;

-- SQL Warehouse: grant CAN_USE to service principal ID 145357243313672
```

---

## DEPLOYMENT

```python
import requests, base64

# Upload a file
content_b64 = base64.b64encode(file_content.encode()).decode()
requests.post(f"https://{host}/api/2.0/workspace/import",
    headers={"Authorization": f"Bearer {token}"},
    json={"path": "/Workspace/Users/<user>/gsdp/<file>",
          "format": "AUTO", "content": content_b64, "overwrite": True})

# Deploy the app
requests.post(f"https://{host}/api/2.0/apps/gsdp/deployments",
    headers={"Authorization": f"Bearer {token}"},
    json={"source_code_path": "/Workspace/Users/<user>/gsdp", "mode": "SNAPSHOT"})
```

---

## KEY TECHNICAL NOTES & GOTCHAS

| # | Issue | Correct Approach |
|---|-------|-----------------|
| 1 | SDK Auth | `WorkspaceClient()` — NOT databricks-sql-connector |
| 2 | LLM calls | `w.serving_endpoints.query()` with `ChatMessage(role=ChatMessageRole.SYSTEM, content=...)` objects — NOT plain dicts |
| 3 | File download | `w.files.download(f"/Volumes/gsdp_poc/raw/docs/{name}").contents.read()` |
| 4 | Vector index creation | Use typed SDK classes: `VectorIndexType.DELTA_SYNC`, `PipelineType.TRIGGERED`, `DeltaSyncVectorIndexSpecRequest`, `EmbeddingSourceColumn` |
| 5 | SQL with quotes | Avoid ai_query() with content containing single quotes — use SDK serving_endpoints.query() instead |
| 6 | Vector source tables | MUST have Change Data Feed enabled (`delta.enableChangeDataFeed = true`) |
| 7 | Streamlit reruns | Use `st.form()` to prevent re-runs on every keystroke/checkbox change |
| 8 | Token estimation | ~4 characters per token for English text |
| 9 | Idempotency | ALL tasks use MERGE (not INSERT/overwrite) for safe re-runs |
| 10 | python-dotenv | Wrap in try/except ImportError — graceful no-op on Databricks Apps |
| 11 | Title formatting | Filenames like "Bosco-3.1.2-Spiritual-counsel..." parsed via regex: `re.match(r"(\d+\.\d+\.\d+)-(.+)", rest)` |
| 12 | Streamlit HTML | Use single `st.markdown(..., unsafe_allow_html=True)` per card — multiple calls cause jarring sequential render |

---

## EXPECTED RESULTS

| Table | Rows | Avg Size |
|-------|------|----------|
| bronze_doc_elements | 15,185 | - |
| bronze_extracted_entities | 938 | - |
| silver_entity_ontology_links | 791 | - |
| silver_documents | 43 | Full doc text |
| silver_document_chunks | 2,157 | 380 tokens avg |
| search_documents | 2,157 | 1,500+ chars |
| dim_documents | 43 | - |
| dim_entities | 524 | - |
| fact_document_entities | 1,552 | - |
| fact_entity_relationships | 34,956 | - |
| dim_topics | 102 | - |

**Search Performance:**
- Total latency: ~9-10 seconds
- Keyword search: ~40ms
- Vector search: ~640ms
- Reranking (10 candidates): ~5,000ms
- Answer generation: ~3,400ms

---

## LOCAL DEVELOPMENT SETUP

```bash
# 1. Clone/download the gsdp folder
# 2. Create virtual environment
python -m venv env
env\Scripts\activate  # Windows
# 3. Install dependencies
pip install -r requirements.txt
# 4. .env file is pre-configured with credentials
# 5. Run
streamlit run app.py
# App available at http://localhost:8501
```

---

## PRODUCTION APP

- **URL:** https://gsdp-7405609771152190.10.azure.databricksapps.com
- **Service Principal:** app-avbvnb gsdp (UUID: 88fc76d8-fa1b-4887-8a1c-4bde6b5063b8)
- **Compute Size:** MEDIUM
- **Auth:** Automatic via Databricks Apps service principal
