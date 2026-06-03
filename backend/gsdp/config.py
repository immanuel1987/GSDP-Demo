CATALOG = "gsdp_poc"
RAW_SCHEMA = "raw"
GOLD_SCHEMA = "gold"

VS_INDEX = "gsdp_poc.raw.silver_documents_vs_index"
CHUNK_VS_INDEX = "gsdp_poc.raw.silver_document_chunks_vs_index"
FOUNDATION_MODEL = "databricks-meta-llama-3-3-70b-instruct"

TABLES = {
    "silver_documents": "gsdp_poc.raw.silver_documents",
    "silver_chunks": "gsdp_poc.raw.silver_document_chunks",
    "search_documents": "gsdp_poc.gold.search_documents",
    "dim_documents": "gsdp_poc.gold.dim_documents",
    "dim_topics": "gsdp_poc.gold.dim_topics",
    "dim_entities": "gsdp_poc.gold.dim_entities",
}

APP_TITLE = "GSDP - Semantic Search"
APP_ICON = "\U0001f4da"
MAX_SEARCH_RESULTS = 20
