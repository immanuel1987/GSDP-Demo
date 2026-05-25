from typing import Annotated, Optional


from fastapi import APIRouter, HTTPException, Query

from database.databricks import (
    query_ontology_mapped_value_deduplicated_table,
    query_ontology_summary,
    query_ontology_table,
    query_resource_excel_table,
    query_salesianonline_final_table,
    query_vector_db_input_facets,
    query_vector_db_input_summary,
    query_vector_db_input_table,
)


router = APIRouter(prefix="/data", tags=["databricks"])


@router.get("/ontology")
def get_ontology_data(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    q: Optional[str] = Query(None, max_length=200, description="Search title, name, description, tags, keywords"),
):
    """
    Paginated ontology bronze rows for the dashboard Resource Library.
    Backed by `ontology.bronze.final_table_ontology` in Databricks.
    """
    try:
        result = query_ontology_table(limit=limit, offset=offset, search=q)
        return {
            "status": "success",
            "count": len(result["data"]),
            "total": result["total"],
            "limit": limit,
            "offset": offset,
            "data": result["data"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/ontology/summary")
def get_ontology_summary():
    """Row counts and freshness timestamps for the OWL / ontology admin view."""
    try:
        summary = query_ontology_summary()
        return {"status": "success", **summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/resources")
def get_resource_excel_data(
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    q: Annotated[Optional[str], Query(max_length=200, description="Search hasTitle, hasKeyword, address")] = None,
):
    """
    Paginated resources from ontology.silver.resource_final_excel_driven.
    """
    try:
        result = query_resource_excel_table(limit=limit, offset=offset, search=q)
        return {
            "status": "success",
            "count": len(result["data"]),
            "total": result["total"],
            "limit": limit,
            "offset": offset,
            "data": result["data"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/salesianonline/final")
def get_salesianonline_final_data(
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    q: Annotated[
        Optional[str],
        Query(max_length=200, description="Search title, caption, description, extracted fields, etc."),
    ] = None,
):
    """
    Paginated rows from `salesianonline.silver.final` (media / post metadata and extracted ontology fields).
    Override table with env `DATABRICKS_SALESIANONLINE_FINAL_TABLE` if needed.
    """
    try:
        result = query_salesianonline_final_table(limit=limit, offset=offset, search=q)
        return {
            "status": "success",
            "count": len(result["data"]),
            "total": result["total"],
            "limit": limit,
            "offset": offset,
            "data": result["data"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/vector-db-input/summary")
def get_vector_db_input_summary():
    """Totals and distinct dimension counts from gsdp.gold.vector_db_input."""
    try:
        summary = query_vector_db_input_summary()
        return {"status": "success", **summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/vector-db-input/facets")
def get_vector_db_input_facets():
    """Distinct values for Resource Library filter dropdowns."""
    try:
        facets = query_vector_db_input_facets()
        return {"status": "success", **facets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/vector-db-input")
def get_vector_db_input_data(
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    q: Annotated[
        Optional[str],
        Query(
            max_length=200,
            description="Search subject, title, abstract, contributor, document_id, language, etc.",
        ),
    ] = None,
    knowledge_area: Annotated[Optional[str], Query(max_length=200)] = None,
    work_type: Annotated[Optional[str], Query(max_length=200)] = None,
    language: Annotated[Optional[str], Query(max_length=200)] = None,
    country: Annotated[Optional[str], Query(max_length=200)] = None,
    region: Annotated[Optional[str], Query(max_length=200)] = None,
    publication_year: Annotated[
        Optional[int],
        Query(ge=0, le=9999, description="Exact match on publication_year."),
    ] = None,
    reference_year: Annotated[
        Optional[int],
        Query(
            ge=0,
            le=9999,
            description="Filter rows whose reference_start_year–reference_end_year range includes this year.",
        ),
    ] = None,
    salesian_family_group: Annotated[Optional[str], Query(max_length=200)] = None,
    contributor: Annotated[Optional[str], Query(max_length=200)] = None,
    doc_media: Annotated[Optional[str], Query(max_length=20, pattern="^(pdf|image)$")] = None,
):
    """
    Paginated rows from `gsdp.gold.vector_db_input` (vector / RAG corpus metadata).
    Override table with env `DATABRICKS_VECTOR_DB_INPUT_TABLE` if needed.
    """
    filters = {
        k: v
        for k, v in {
            "knowledge_area": knowledge_area,
            "work_type": work_type,
            "language": language,
            "country": country,
            "region": region,
            "reference_year": reference_year,
            "publication_year": publication_year,
            "salesian_family_group": salesian_family_group,
            "contributor": contributor,
            "doc_media": doc_media,
        }.items()
        if v is not None and (v != "" if isinstance(v, str) else True)
    }
    try:
        result = query_vector_db_input_table(
            limit=limit, offset=offset, search=q, filters=filters or None
        )
        return {
            "status": "success",
            "count": len(result["data"]),
            "total": result["total"],
            "limit": limit,
            "offset": offset,
            "data": result["data"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/ontology/mapped-value-deduplicated")
def get_ontology_mapped_value_deduplicated(
    limit: Optional[int] = Query(..., description="Limit the number of rows to return"),
    offset: int = Query(0, description="Offset the number of rows to return"),
    q: Optional[str] = Query(None, description="Search across string-like columns (resolved from table schema)"),
):
    """
    Paginated rows from `ontology.silver.ontology_mapped_value_deduplicated`.
    Ordering prefers ingestion/update-style columns when present; otherwise first column.
    """
    try:
        result = query_ontology_mapped_value_deduplicated_table(limit=limit, offset=offset, search=q)
        return {
            "status": "success",
            "count": len(result["data"]),
            "total": result["total"],
            "limit": limit,
            "offset": offset,
            "data": result["data"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
