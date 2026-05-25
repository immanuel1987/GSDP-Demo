import os
import re
import uuid
from collections.abc import Mapping, Sequence
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from databricks import sql
from dotenv import load_dotenv

load_dotenv()

DATABRICKS_SERVER_HOSTNAME = os.getenv("DATABRICKS_SERVER_HOSTNAME")
DATABRICKS_HTTP_PATH = os.getenv("DATABRICKS_HTTP_PATH")
DATABRICKS_ACCESS_TOKEN = os.getenv("DATABRICKS_ACCESS_TOKEN","dapi0ed22e2eebb401815093cb95ae46e48f-3")

ONTOLOGY_TABLE = "ontology.bronze.final_table_ontology"
RESOURCE_EXCEL_TABLE = "ontology.silver.resource_final_excel_driven"
ONTOLOGY_MAPPED_VALUE_DEDUP_TABLE = "ontology.silver.ontology_mapped_value_deduplicated"
SALESIANONLINE_FINAL_TABLE = os.getenv(
    "DATABRICKS_SALESIANONLINE_FINAL_TABLE",
    "salesianonline.silver.final",
)
VECTOR_DB_INPUT_TABLE = os.getenv(
    "DATABRICKS_VECTOR_DB_INPUT_TABLE",
    "gsdp.gold.vector_db_input",
)

# Cached (name, dtype lower) rows from DESCRIBE — refreshed on process restart only.
_mapped_value_dedup_schema_cache: Optional[Tuple[list[str], list[str]]] = None


# Subset used by the dashboard Resource Library (avoids huge SELECT * payloads).
ONTOLOGY_SELECT_COLUMNS = [
    "_source_table",
    "access_level",
    "author",
    "authors",
    "caption",
    "charism_dimension",
    "contacts",
    "contributors",
    "created_at",
    "date_created",
    "date_published",
    "description",
    "document_id",
    "excerpt",
    "file_format",
    "id",
    "keywords",
    "knowledge_area",
    "languages",
    "media_type",
    "ministry",
    "name",
    "publication_type",
    "publish_date",
    "publisher",
    "province_region",
    "salesian_family_group",
    "audience",
    "slug",
    "source_category",
    "source_table_name",
    "subject",
    "summary",
    "tags",
    "title",
    "type",
    "url",
    "uuid",
    "diocese",
    "ingestion_time",
    "date_updated",
    "updated_at",
    "path",
    "attachment",
    "image",
    "feature_image",
]

# salesianonline.silver.final — explicit column list (avoids SELECT * payload size).
SALESIANONLINE_FINAL_COLUMNS = [
    "id",
    "alt_text",
    "author_id",
    "author_name",
    "author_url",
    "caption",
    "comment_status",
    "date_local",
    "date_utc",
    "description",
    "filesize_bytes",
    "guid",
    "image_full_height",
    "image_full_mime_type",
    "image_full_url",
    "image_full_width",
    "image_large_height",
    "image_large_mime_type",
    "image_large_url",
    "image_large_width",
    "image_medium_height",
    "image_medium_large_height",
    "image_medium_large_mime_type",
    "image_medium_large_url",
    "image_medium_large_width",
    "image_medium_mime_type",
    "image_medium_url",
    "image_medium_width",
    "image_thumbnail_height",
    "image_thumbnail_mime_type",
    "image_thumbnail_url",
    "image_thumbnail_width",
    "ingest_timestamp",
    "link",
    "media_type",
    "mime_type",
    "modified_local",
    "modified_utc",
    "parent_post_id",
    "parent_post_link",
    "parent_post_slug",
    "parent_post_status",
    "parent_post_title",
    "ping_status",
    "post_id",
    "slug",
    "source_api_url",
    "source_url",
    "status",
    "tags_count",
    "tags_description",
    "tags_id",
    "tags_link",
    "tags_name",
    "tags_slug",
    "tags_taxonomy",
    "template",
    "title",
    "type",
    "extracted_source_table_name",
    "extracted_source_column",
    "extracted_source_row_id",
    "extracted_ingestion_time",
    "extracted_document_id",
    "extracted_url",
    "extracted_title",
    "extracted_subtitle",
    "extracted_authors",
    "extracted_contributors",
    "extracted_publisher",
    "extracted_province_region",
    "extracted_version",
    "extracted_date_created",
    "extracted_date_published",
    "extracted_date_updated",
    "extracted_file_format",
    "extracted_file_size",
    "extracted_page_count",
    "extracted_duration_seconds",
    "extracted_duration_formatted",
    "extracted_image_width",
    "extracted_image_height",
    "extracted_encoding_quality",
    "extracted_languages",
    "extracted_accessibility",
    "extracted_media_type",
    "extracted_publication_type",
    "extracted_source_category",
    "extracted_keywords",
    "extracted_summary",
    "extracted_access_level",
    "extracted_lifecycle_stage",
    "extracted_approval_status",
    "extracted_compliance_refs",
    "extracted_retention_policy",
    "extracted_expiry_date",
    "extracted_audience",
    "extracted_related_documents",
    "extracted_provenance",
    "extracted_linked_media",
    "extracted_charism_dimension",
    "extracted_doc_status",
    "extracted_distribution_channel",
    "extracted_ownership",
    "extracted_doi_isbn_issn",
    "extracted_religious_context",
    "extracted_annotations",
    "extracted_translation_available",
    "extracted_tags",
    "extracted_linked_educational_works",
    "extracted_linked_work_types",
    "extracted_linked_events",
    "extracted_linked_people",
    "extracted_geo_coordinates",
    "extracted_knowledge_area",
    "extracted_salesian_family_group",
    "extracted_watermark_present",
    "extracted_digital_signature_present",
    "extracted_transcript_text",
    "extracted_av_transcription_status",
]

SALESIANONLINE_FINAL_SEARCH_COLUMNS = [
    "title",
    "caption",
    "description",
    "slug",
    "alt_text",
    "author_name",
    "parent_post_title",
    "mime_type",
    "status",
    "extracted_title",
    "extracted_summary",
    "extracted_url",
    "extracted_keywords",
    "extracted_publisher",
]

# gsdp.gold.vector_db_input — RAG / vector index source rows.
VECTOR_DB_INPUT_COLUMNS = [
    "subject",
    "document_id",
    "title",
    "abstract",
    "bibliographical_citation",
    "contributor",
    "country",
    "inferred_continent",
    "language",
    "knowledge_area",
    "work_type",
    "content_classification",
    "salesian_family_group",
    "file_name",
    "old_link",
    "url",
    "mark_biographic",
    "publication_year",
    "period_of_reference",
    "reference_start_year",
    "reference_end_year",
    "all_predicates_json",
    "vector_search_text",
    "vector_id",
    "created_at",
]

VECTOR_DB_INPUT_SEARCH_COLUMNS = [
    "subject",
    "document_id",
    "title",
    "abstract",
    "bibliographical_citation",
    "contributor",
    "country",
    "language",
    "knowledge_area",
    "work_type",
    "content_classification",
    "salesian_family_group",
    "file_name",
    "vector_search_text",
    "vector_id",
]

RESOURCE_EXCEL_COLUMNS = [
    "LocatedIn",
    "address",
    "belongsToProvince",
    "dateCreated",
    "dateLastUpdated",
    "datePublished",
    "distributedThrough",
    "hasAccessLevel",
    "hasApprovalStatus",
    "hasAudience",
    "hasContentClassification",
    "hasDocumentID",
    "hasDocumentStatus",
    "hasExpiryDate",
    "hasFileFormat",
    "hasKeyword",
    "hasLifecycleStage",
    "hasLinkedMedia",
    "hasPhoto",
    "hasProvenanceSource",
    "hasSDBProvince",
    "hasTechnicalSpecification",
    "hasTitle",
    "hasWorkType",
    "linkedToWorkType",
]



def get_databricks_connection():
    # The databricks-sql-connector generally requires the hostname without 'https://'
    # so we strip it out if it is present.
    hostname = DATABRICKS_SERVER_HOSTNAME.replace("https://", "") if DATABRICKS_SERVER_HOSTNAME else ""

    connection = sql.connect(
        server_hostname=hostname,
        http_path=DATABRICKS_HTTP_PATH,
        access_token=DATABRICKS_ACCESS_TOKEN,
    )
    return connection


def _serialize_value(value):
    """
    Recursively coerce Databricks / Spark connector values to JSON-safe Python types.
    Array and struct columns often arrive as Row-like objects that break FastAPI's jsonable_encoder.
    """
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, str):
        return value
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (bytes, bytearray)):
        return value.decode("utf-8", errors="replace")
    if isinstance(value, Mapping):
        return {str(k): _serialize_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_serialize_value(v) for v in value]
    if isinstance(value, memoryview):
        return value.tobytes().decode("utf-8", errors="replace")
    # PySpark / connector Row
    as_dict = getattr(value, "asDict", None)
    if callable(as_dict):
        try:
            return _serialize_value(as_dict(recursive=True))
        except TypeError:
            try:
                return _serialize_value(as_dict())
            except Exception:
                pass
    _asdict = getattr(value, "_asdict", None)
    if callable(_asdict):
        try:
            return _serialize_value(_asdict())
        except Exception:
            pass
    # numpy scalar and similar
    item_fn = getattr(value, "item", None)
    if callable(item_fn):
        try:
            py = item_fn()
            if py is not value:
                return _serialize_value(py)
        except Exception:
            pass
    # Generic sequence (e.g. some driver types) but not strings / bytes
    if isinstance(value, Sequence):
        try:
            return [_serialize_value(v) for v in value]
        except Exception:
            pass
    return str(value)


def _row_to_dict(columns, row):
    out = {}
    for col, val in zip(columns, row):
        out[col] = _serialize_value(val)
    return out


def _quote_sql_ident(name: str) -> str:
    """Spark / Unity Catalog: backtick-escape identifier."""
    n = (name or "").replace("`", "")
    return f"`{n}`"


def _fq_table_sql(fq_name: str) -> str:
    """Quote catalog.schema.table (needed when the table name is a reserved word, e.g. `final`)."""
    parts = [p for p in (fq_name or "").replace("`", "").split(".") if p]
    if len(parts) == 3:
        return f"{_quote_sql_ident(parts[0])}.{_quote_sql_ident(parts[1])}.{_quote_sql_ident(parts[2])}"
    return fq_name


def _load_mapped_value_dedup_schema(cursor) -> Tuple[list[str], list[str]]:
    """
    Return (all_column_names, string_like_column_names) for ontology_mapped_value_deduplicated.
    Used for ORDER BY and optional text search.
    """
    global _mapped_value_dedup_schema_cache
    if _mapped_value_dedup_schema_cache is not None:
        return _mapped_value_dedup_schema_cache

    cursor.execute(f"DESCRIBE TABLE {ONTOLOGY_MAPPED_VALUE_DEDUP_TABLE}")
    rows = cursor.fetchall()
    all_cols: list[str] = []
    text_cols: list[str] = []
    for row in rows:
        if not row:
            continue
        col_name = row[0]
        if col_name is None:
            continue
        name = str(col_name).strip()
        if not name or name.startswith("#"):
            continue
        dtype = str(row[1] or "").lower()
        all_cols.append(name)
        if any(t in dtype for t in ("string", "varchar", "char", "text")):
            text_cols.append(name)
    text_cols = text_cols[:20]
    _mapped_value_dedup_schema_cache = (all_cols, text_cols)
    return _mapped_value_dedup_schema_cache


def _pick_order_column(all_cols: list[str]) -> Optional[str]:
    for prefer in (
        "ingestion_time",
        "updated_at",
        "last_modified",
        "_commit_timestamp",
        "dateLastUpdated",
        "dateCreated",
        "date_created",
    ):
        for c in all_cols:
            if c.lower() == prefer.lower():
                return c
    return all_cols[0] if all_cols else None


def _sanitize_search(q: str) -> str:
    """Keep LIKE patterns safe: strip control chars and limit length."""
    q = (q or "").strip()
    if not q:
        return ""
    q = re.sub(r"[\x00-\x1f\x7f]", "", q)
    return q[:200]


def _search_where_clause():
    """Spark SQL: lower(x) like lower(?) with one bound pattern per placeholder."""
    return """(
        lower(coalesce(cast(title as string), '')) like lower(?)
        OR lower(coalesce(cast(name as string), '')) like lower(?)
        OR lower(coalesce(cast(subject as string), '')) like lower(?)
        OR lower(coalesce(cast(description as string), '')) like lower(?)
        OR lower(coalesce(cast(summary as string), '')) like lower(?)
        OR lower(coalesce(cast(tags as string), '')) like lower(?)
        OR lower(coalesce(cast(keywords as string), '')) like lower(?)
    )"""


def query_ontology_table(limit: int = 100, offset: int = 0, search: Optional[str] = None):
    """
    Paginated rows from ontology.bronze.final_table_ontology for API consumers.
    """
    limit = max(1, min(int(limit), 500))
    offset = max(0, int(offset))
    cols_sql = ", ".join(ONTOLOGY_SELECT_COLUMNS)
    base_from = f"FROM {ONTOLOGY_TABLE}"

    connection = get_databricks_connection()
    try:
        with connection.cursor() as cursor:
            q_clean = _sanitize_search(search) if search else ""
            if q_clean:
                pat = f"%{q_clean}%"
                params = (pat, pat, pat, pat, pat, pat, pat)
                where = f"WHERE {_search_where_clause()}"
                count_sql = f"SELECT COUNT(*) AS c {base_from} {where}"
                cursor.execute(count_sql, params)
                total = int(cursor.fetchone()[0])

                data_sql = (
                    f"SELECT {cols_sql} {base_from} {where} "
                    f"ORDER BY coalesce(ingestion_time, updated_at, created_at) DESC NULLS LAST "
                    f"LIMIT {limit} OFFSET {offset}"
                )
                cursor.execute(data_sql, params)
            else:
                count_sql = f"SELECT COUNT(*) AS c {base_from}"
                cursor.execute(count_sql)
                total = int(cursor.fetchone()[0])

                data_sql = (
                    f"SELECT {cols_sql} {base_from} "
                    f"ORDER BY coalesce(ingestion_time, updated_at, created_at) DESC NULLS LAST "
                    f"LIMIT {limit} OFFSET {offset}"
                )
                cursor.execute(data_sql)

            rows = cursor.fetchall()
            columns = [column[0] for column in cursor.description]
            data = [_row_to_dict(columns, row) for row in rows]
            return {"data": data, "total": total}
    finally:
        connection.close()


def query_resource_excel_table(limit: int = 100, offset: int = 0, search: Optional[str] = None):
    """
    Paginated rows from ontology.silver.resource_final_excel_driven for API consumers.
    """
    limit = max(1, min(int(limit), 500))
    offset = max(0, int(offset))
    cols_sql = ", ".join(RESOURCE_EXCEL_COLUMNS)
    base_from = f"FROM {RESOURCE_EXCEL_TABLE}"

    connection = get_databricks_connection()
    try:
        with connection.cursor() as cursor:
            q_clean = _sanitize_search(search) if search else ""
            if q_clean:
                pat = f"%{q_clean}%"
                # Search across key text columns. Adjust as needed.
                # For this table, I'll search in hasTitle, hasKeyword, address.
                params = (pat, pat, pat)
                where = "WHERE (lower(coalesce(cast(hasTitle as string), '')) like lower(?) OR lower(coalesce(cast(hasKeyword as string), '')) like lower(?) OR lower(coalesce(cast(address as string), '')) like lower(?))"
                
                count_sql = f"SELECT COUNT(*) AS c {base_from} {where}"
                cursor.execute(count_sql, params)
                total = int(cursor.fetchone()[0])

                data_sql = (
                    f"SELECT {cols_sql} {base_from} {where} "
                    f"ORDER BY coalesce(dateLastUpdated, dateCreated, datePublished) DESC NULLS LAST "
                    f"LIMIT {limit} OFFSET {offset}"
                )
                cursor.execute(data_sql, params)
            else:
                count_sql = f"SELECT COUNT(*) AS c {base_from}"
                cursor.execute(count_sql)
                total = int(cursor.fetchone()[0])

                data_sql = (
                    f"SELECT {cols_sql} {base_from} "
                    f"ORDER BY coalesce(dateLastUpdated, dateCreated, datePublished) DESC NULLS LAST "
                    f"LIMIT {limit} OFFSET {offset}"
                )
                cursor.execute(data_sql)

            rows = cursor.fetchall()
            columns = [column[0] for column in cursor.description]
            data = [_row_to_dict(columns, row) for row in rows]
            return {"data": data, "total": total}
    finally:
        connection.close()


def query_salesianonline_final_table(limit: int = 100, offset: int = 0, search: Optional[str] = None):
    """
    Paginated rows from salesianonline.silver.final (configurable via DATABRICKS_SALESIANONLINE_FINAL_TABLE).
    """
    limit = max(1, min(int(limit), 500))
    offset = max(0, int(offset))
    cols_sql = ", ".join(SALESIANONLINE_FINAL_COLUMNS)
    base_from = f"FROM {_fq_table_sql(SALESIANONLINE_FINAL_TABLE)}"

    connection = get_databricks_connection()
    try:
        with connection.cursor() as cursor:
            q_clean = _sanitize_search(search) if search else ""
            order_by = "ingest_timestamp DESC NULLS LAST, id DESC NULLS LAST"

            if q_clean:
                pat = f"%{q_clean}%"
                or_parts = [
                    f"lower(coalesce(cast({_quote_sql_ident(c)} as string), '')) like lower(?)"
                    for c in SALESIANONLINE_FINAL_SEARCH_COLUMNS
                ]
                where = "WHERE (" + " OR ".join(or_parts) + ")"
                params = (pat,) * len(SALESIANONLINE_FINAL_SEARCH_COLUMNS)

                count_sql = f"SELECT COUNT(*) AS c {base_from} {where}"
                cursor.execute(count_sql, params)
                total = int(cursor.fetchone()[0])

                data_sql = (
                    f"SELECT {cols_sql} {base_from} {where} "
                    f"ORDER BY {order_by} "
                    f"LIMIT {limit} OFFSET {offset}"
                )
                cursor.execute(data_sql, params)
            else:
                count_sql = f"SELECT COUNT(*) AS c {base_from}"
                cursor.execute(count_sql)
                total = int(cursor.fetchone()[0])

                data_sql = (
                    f"SELECT {cols_sql} {base_from} "
                    f"ORDER BY {order_by} "
                    f"LIMIT {limit} OFFSET {offset}"
                )
                cursor.execute(data_sql)

            rows = cursor.fetchall()
            columns = [column[0] for column in cursor.description]
            data = [_row_to_dict(columns, row) for row in rows]
            return {"data": data, "total": total}
    finally:
        connection.close()


def _vector_db_filter_clauses(filters: Optional[Dict[str, Any]]) -> Tuple[List[str], List[Any]]:
    """Build AND clauses for vector_db_input column filters (values are LIKE unless year)."""
    if not filters:
        return [], []

    clauses: List[str] = []
    params: List[Any] = []

    def eq_col(col: str, val: str) -> None:
        clauses.append(
            f"lower(trim(coalesce(cast({_quote_sql_ident(col)} as string), ''))) = lower(trim(?))"
        )
        params.append(val.strip())

    for key, col in (
        ("knowledge_area", "knowledge_area"),
        ("work_type", "work_type"),
        ("language", "language"),
        ("country", "country"),
        ("salesian_family_group", "salesian_family_group"),
        ("contributor", "contributor"),
    ):
        val = (filters.get(key) or "").strip()
        if val:
            eq_col(col, val)

    region = (filters.get("region") or "").strip()
    if region:
        clauses.append(
            f"(lower(trim(coalesce(cast({_quote_sql_ident('inferred_continent')} as string), ''))) = lower(trim(?)) "
            f"OR lower(trim(coalesce(cast({_quote_sql_ident('country')} as string), ''))) = lower(trim(?)))"
        )
        params.extend([region, region])

    ref_year = filters.get("reference_year")
    if ref_year is not None and str(ref_year).strip() != "":
        try:
            y = int(str(ref_year).strip())
            rs = _quote_sql_ident("reference_start_year")
            re = _quote_sql_ident("reference_end_year")
            clauses.append(
                "("
                f"({rs} IS NOT NULL OR {re} IS NOT NULL) AND "
                f"? BETWEEN "
                f"COALESCE(cast({rs} as int), cast({re} as int)) AND "
                f"COALESCE(cast({re} as int), cast({rs} as int))"
                ")"
            )
            params.append(y)
        except ValueError:
            pass

    pub_year = filters.get("publication_year")
    if pub_year is not None and str(pub_year).strip() != "":
        try:
            y = int(str(pub_year).strip())
            clauses.append(f"cast({_quote_sql_ident('publication_year')} as int) = ?")
            params.append(y)
        except ValueError:
            pass

    doc_media = (filters.get("doc_media") or "").strip().lower()
    if doc_media == "pdf":
        clauses.append(
            "("
            f"lower(coalesce(cast({_quote_sql_ident('work_type')} as string), '')) like '%pdf%' "
            f"OR lower(coalesce(cast({_quote_sql_ident('file_name')} as string), '')) like '%.pdf%' "
            f"OR lower(coalesce(cast({_quote_sql_ident('url')} as string), '')) like '%.pdf%'"
            ")"
        )
    elif doc_media == "image":
        clauses.append(
            "("
            f"lower(coalesce(cast({_quote_sql_ident('work_type')} as string), '')) like '%image%' "
            f"OR lower(coalesce(cast({_quote_sql_ident('file_name')} as string), '')) like '%.png%' "
            f"OR lower(coalesce(cast({_quote_sql_ident('file_name')} as string), '')) like '%.jpg%' "
            f"OR lower(coalesce(cast({_quote_sql_ident('file_name')} as string), '')) like '%.jpeg%' "
            f"OR lower(coalesce(cast({_quote_sql_ident('url')} as string), '')) like '%.png%' "
            f"OR lower(coalesce(cast({_quote_sql_ident('url')} as string), '')) like '%.jpg%'"
            ")"
        )

    return clauses, params


def query_vector_db_input_table(
    limit: int = 100,
    offset: int = 0,
    search: Optional[str] = None,
    filters: Optional[Dict[str, Any]] = None,
):
    """
    Paginated rows from gsdp.gold.vector_db_input (override via DATABRICKS_VECTOR_DB_INPUT_TABLE).
    """
    limit = max(1, min(int(limit), 500))
    offset = max(0, int(offset))
    cols_sql = ", ".join(_quote_sql_ident(c) for c in VECTOR_DB_INPUT_COLUMNS)
    base_from = f"FROM {_fq_table_sql(VECTOR_DB_INPUT_TABLE)}"
    order_by = "created_at DESC NULLS LAST, document_id DESC NULLS LAST"

    connection = get_databricks_connection()
    try:
        with connection.cursor() as cursor:
            q_clean = _sanitize_search(search) if search else ""
            filter_clauses, filter_params = _vector_db_filter_clauses(filters)

            where_parts: List[str] = []
            params: List[Any] = []

            if q_clean:
                pat = f"%{q_clean}%"
                or_parts = [
                    f"lower(coalesce(cast({_quote_sql_ident(c)} as string), '')) like lower(?)"
                    for c in VECTOR_DB_INPUT_SEARCH_COLUMNS
                ]
                where_parts.append("(" + " OR ".join(or_parts) + ")")
                params.extend([pat] * len(VECTOR_DB_INPUT_SEARCH_COLUMNS))

            if filter_clauses:
                where_parts.extend(filter_clauses)
                params.extend(filter_params)

            where_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""

            count_sql = f"SELECT COUNT(*) AS c {base_from} {where_sql}"
            cursor.execute(count_sql, tuple(params) if params else None)
            total = int(cursor.fetchone()[0])

            data_sql = (
                f"SELECT {cols_sql} {base_from} {where_sql} "
                f"ORDER BY {order_by} "
                f"LIMIT {limit} OFFSET {offset}"
            )
            cursor.execute(data_sql, tuple(params) if params else None)

            rows = cursor.fetchall()
            columns = [column[0] for column in cursor.description]
            data = [_row_to_dict(columns, row) for row in rows]
            return {"data": data, "total": total}
    finally:
        connection.close()


def query_vector_db_input_facets() -> Dict[str, List[str]]:
    """Distinct facet values for Resource Library filter dropdowns."""
    table = _fq_table_sql(VECTOR_DB_INPUT_TABLE)
    spec = [
        ("knowledge_area", "themes", "string"),
        ("work_type", "types", "string"),
        ("language", "languages", "string"),
        ("country", "countries", "string"),
        ("inferred_continent", "continents", "string"),
        ("salesian_family_group", "groups", "string"),
        ("contributor", "contributors", "string"),
        ("content_classification", "classifications", "string"),
    ]
    out: Dict[str, List[str]] = {key: [] for _, key, _ in spec}
    out["years"] = []
    out["publication_years"] = []

    connection = get_databricks_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                WITH ref_years AS (
                    SELECT cast({_quote_sql_ident('reference_start_year')} AS int) AS y
                    FROM {table}
                    WHERE {_quote_sql_ident('reference_start_year')} IS NOT NULL
                    UNION
                    SELECT cast({_quote_sql_ident('reference_end_year')} AS int) AS y
                    FROM {table}
                    WHERE {_quote_sql_ident('reference_end_year')} IS NOT NULL
                )
                SELECT cast(y AS string) AS v
                FROM ref_years
                WHERE y IS NOT NULL
                GROUP BY y
                ORDER BY y DESC
                LIMIT 60
                """
            )
            out["years"] = [
                str(row[0]).strip()
                for row in cursor.fetchall()
                if row and row[0] is not None and str(row[0]).strip()
            ]

            cursor.execute(
                f"""
                SELECT cast({_quote_sql_ident('publication_year')} AS string) AS v
                FROM {table}
                WHERE {_quote_sql_ident('publication_year')} IS NOT NULL
                GROUP BY {_quote_sql_ident('publication_year')}
                ORDER BY cast({_quote_sql_ident('publication_year')} AS int) DESC
                LIMIT 60
                """
            )
            out["publication_years"] = [
                str(row[0]).strip()
                for row in cursor.fetchall()
                if row and row[0] is not None and str(row[0]).strip()
            ]

            for col, key, kind in spec:
                if kind == "int":
                    sql = f"""
                    SELECT cast({_quote_sql_ident(col)} as string) AS v, COUNT(*) AS c
                    FROM {table}
                    WHERE {_quote_sql_ident(col)} IS NOT NULL
                    GROUP BY cast({_quote_sql_ident(col)} as string)
                    ORDER BY c DESC
                    LIMIT 40
                    """
                else:
                    sql = f"""
                    SELECT cast({_quote_sql_ident(col)} as string) AS v, COUNT(*) AS c
                    FROM {table}
                    WHERE {_quote_sql_ident(col)} IS NOT NULL
                      AND trim(cast({_quote_sql_ident(col)} as string)) != ''
                    GROUP BY cast({_quote_sql_ident(col)} as string)
                    ORDER BY c DESC
                    LIMIT 40
                    """
                cursor.execute(sql)
                values = []
                for row in cursor.fetchall():
                    if not row or row[0] is None:
                        continue
                    v = str(row[0]).strip()
                    if v and v.lower() not in ("null", "none", "n/a", "na"):
                        values.append(v)
                if key == "years":
                    values.sort(reverse=True)
                else:
                    values.sort(key=lambda s: s.lower())
                out[key] = values
    finally:
        connection.close()

    return out


def query_vector_db_input_summary() -> Dict[str, Any]:
    """Aggregate counts for dashboard KPIs (full table, not facet sample)."""
    table = _fq_table_sql(VECTOR_DB_INPUT_TABLE)
    sql = f"""
    SELECT
        COUNT(*) AS total_rows,
        MAX(created_at) AS last_ingestion,
        COUNT(DISTINCT CASE
            WHEN {_quote_sql_ident('country')} IS NOT NULL
             AND trim(cast({_quote_sql_ident('country')} AS string)) != ''
             AND lower(trim(cast({_quote_sql_ident('country')} AS string))) NOT IN ('null', 'none', 'n/a', 'na')
            THEN lower(trim(cast({_quote_sql_ident('country')} AS string)))
        END) AS distinct_countries,
        COUNT(DISTINCT CASE
            WHEN {_quote_sql_ident('knowledge_area')} IS NOT NULL
             AND trim(cast({_quote_sql_ident('knowledge_area')} AS string)) != ''
            THEN lower(trim(cast({_quote_sql_ident('knowledge_area')} AS string)))
        END) AS distinct_knowledge_areas,
        COUNT(DISTINCT CASE
            WHEN {_quote_sql_ident('work_type')} IS NOT NULL
             AND trim(cast({_quote_sql_ident('work_type')} AS string)) != ''
            THEN lower(trim(cast({_quote_sql_ident('work_type')} AS string)))
        END) AS distinct_work_types,
        COUNT(DISTINCT CASE
            WHEN {_quote_sql_ident('language')} IS NOT NULL
             AND trim(cast({_quote_sql_ident('language')} AS string)) != ''
            THEN lower(trim(cast({_quote_sql_ident('language')} AS string)))
        END) AS distinct_languages
    FROM {table}
    """
    connection = get_databricks_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(sql)
            row = cursor.fetchone()
            cols = [c[0] for c in cursor.description]
            raw = dict(zip(cols, row))
            return {k: _serialize_value(v) for k, v in raw.items()}
    finally:
        connection.close()


def query_ontology_mapped_value_deduplicated_table(
    limit: int,
    offset: int = 0,
    search: Optional[str] = None,
):
    """
    Paginated rows from ontology.silver.ontology_mapped_value_deduplicated.
    Uses DESCRIBE (cached) to pick ORDER BY and optional LIKE search across string-like columns.
    """
    limit = int(limit)
    offset = int(offset)
    base_from = f"FROM {ONTOLOGY_MAPPED_VALUE_DEDUP_TABLE}"

    connection = get_databricks_connection()
    try:
        with connection.cursor() as cursor:
            all_cols, text_cols = _load_mapped_value_dedup_schema(cursor)
            order_col = _pick_order_column(all_cols)
            order_sql = f"{_quote_sql_ident(order_col)} DESC NULLS LAST" if order_col else "1"

            q_clean = _sanitize_search(search) if search else ""
            if q_clean and text_cols:
                pat = f"%{q_clean}%"
                or_parts = [f"lower(cast({_quote_sql_ident(c)} as string)) like lower(?)" for c in text_cols]
                where = "WHERE (" + " OR ".join(or_parts) + ")"
                params = (pat,) * len(text_cols)

                count_sql = f"SELECT COUNT(*) AS c {base_from} {where}"
                cursor.execute(count_sql, params)
                total = int(cursor.fetchone()[0])

                data_sql = (
                    f"SELECT * {base_from} {where} ORDER BY {order_sql} LIMIT {limit} OFFSET {offset}"
                )
                cursor.execute(data_sql, params)
            elif q_clean and not text_cols:
                # Search requested but no string-like columns in catalog — return unfiltered page.
                count_sql = f"SELECT COUNT(*) AS c {base_from}"
                cursor.execute(count_sql)
                total = int(cursor.fetchone()[0])
                data_sql = f"SELECT * {base_from} ORDER BY {order_sql} LIMIT {limit} OFFSET {offset}"
                cursor.execute(data_sql)
            else:
                count_sql = f"SELECT COUNT(*) AS c {base_from}"
                cursor.execute(count_sql)
                total = int(cursor.fetchone()[0])

                data_sql = f"SELECT * {base_from} ORDER BY {order_sql} LIMIT {limit} OFFSET {offset}"
                cursor.execute(data_sql)

            rows = cursor.fetchall()
            columns = [column[0] for column in cursor.description]
            data = [_row_to_dict(columns, row) for row in rows]
            return {"data": data, "total": total}
    finally:
        connection.close()


def query_ontology_summary():
    """Lightweight aggregates for the OWL / pipeline dashboard."""
    connection = get_databricks_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT
                    COUNT(*) AS total_rows,
                    MAX(ingestion_time) AS last_ingestion,
                    MAX(updated_at) AS last_updated,
                    COUNT(DISTINCT publication_type) AS distinct_publication_types,
                    COUNT(DISTINCT knowledge_area) AS distinct_knowledge_areas
                FROM {ONTOLOGY_TABLE}
                """
            )
            row = cursor.fetchone()
            cols = [c[0] for c in cursor.description]
            raw = dict(zip(cols, row))
            return {k: _serialize_value(v) for k, v in raw.items()}
    finally:
        connection.close()



