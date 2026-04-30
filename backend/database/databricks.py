import os
import re
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Tuple

from databricks import sql
from dotenv import load_dotenv

load_dotenv()

DATABRICKS_SERVER_HOSTNAME = os.getenv("DATABRICKS_SERVER_HOSTNAME")
DATABRICKS_HTTP_PATH = os.getenv("DATABRICKS_HTTP_PATH")
DATABRICKS_ACCESS_TOKEN = os.getenv("DATABRICKS_ACCESS_TOKEN")

ONTOLOGY_TABLE = "ontology.bronze.final_table_ontology"
RESOURCE_EXCEL_TABLE = "ontology.silver.resource_final_excel_driven"
ONTOLOGY_MAPPED_VALUE_DEDUP_TABLE = "ontology.silver.ontology_mapped_value_deduplicated"

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
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (bytes, bytearray)):
        return value.decode("utf-8", errors="replace")
    return value


def _row_to_dict(columns, row):
    out = {}
    for col, val in zip(columns, row):
        out[col] = _serialize_value(val)
    return out


def _quote_sql_ident(name: str) -> str:
    """Spark / Unity Catalog: backtick-escape identifier."""
    n = (name or "").replace("`", "")
    return f"`{n}`"


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



