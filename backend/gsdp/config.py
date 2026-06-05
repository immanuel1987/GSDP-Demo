CATALOG = "gsdp_poc"
RAW_SCHEMA = "raw"
GOLD_SCHEMA = "gold"

VS_INDEX = "gsdp_poc.raw.silver_documents_vs_index"
CHUNK_VS_INDEX = "gsdp_poc.raw.silver_document_chunks_vs_index"
FOUNDATION_MODEL = "databricks-meta-llama-3-3-70b-instruct"
EMBEDDING_MODEL = "databricks-bge-large-en"
VS_ENDPOINT = "don_bosco_vs_endpoint"
ONTOLOGY_NS = "http://www.semanticweb.org/deepa/ontologies/2026/2/gsdp_ontology-85#"

TABLES = {
    # Bronze layer
    "bronze_doc_elements": "gsdp_poc.raw.bronze_doc_elements",
    "bronze_extracted_entities": "gsdp_poc.raw.bronze_extracted_entities",
    "bronze_doc_metadata": "gsdp_poc.raw.bronze_doc_metadata",
    "bronze_sub_documents": "gsdp_poc.raw.bronze_sub_documents",
    # Silver layer
    "silver_documents": "gsdp_poc.raw.silver_documents",
    "silver_chunks": "gsdp_poc.raw.silver_document_chunks",
    "silver_entity_ontology_links": "gsdp_poc.raw.silver_entity_ontology_links",
    # Ontology
    "ontology_nodes": "gsdp_poc.raw.sdb6_ontology_nodes",
    "ontology_classes": "gsdp_poc.raw.sdb6_ontology_classes",
    "ontology_individuals": "gsdp_poc.raw.sdb6_ontology_individuals",
    "ontology_triples": "gsdp_poc.raw.sdb6_ontology_triples",
    "ontology_hierarchy": "gsdp_poc.raw.ontology_hierarchy",
    "ontology_candidates": "gsdp_poc.raw.ontology_candidates",
    # Entity resolution
    "entity_aliases": "gsdp_poc.raw.entity_aliases",
    "entity_coreferences": "gsdp_poc.raw.entity_coreferences",
    "entity_relationships": "gsdp_poc.raw.entity_relationships",
    "semantic_match_candidates": "gsdp_poc.raw.semantic_match_candidates",
    # Gold layer
    "search_documents": "gsdp_poc.gold.search_documents",
    "dim_documents": "gsdp_poc.gold.dim_documents",
    "dim_topics": "gsdp_poc.gold.dim_topics",
    "dim_entities": "gsdp_poc.gold.dim_entities",
    "dim_dates": "gsdp_poc.gold.dim_dates",
    "fact_document_entities": "gsdp_poc.gold.fact_document_entities",
    "fact_entity_relationships": "gsdp_poc.gold.fact_entity_relationships",
    # Pipeline ops
    "pipeline_watermark": "gsdp_poc.raw.pipeline_watermark",
    "pipeline_run_log": "gsdp_poc.raw.pipeline_run_log",
    "pipeline_lineage": "gsdp_poc.raw.pipeline_lineage",
    "search_quality_log": "gsdp_poc.raw.search_quality_log",
}

APP_TITLE = "Global Salesian Digital Platform"
APP_ICON = "\U0001f4da"
MAX_SEARCH_RESULTS = 20
