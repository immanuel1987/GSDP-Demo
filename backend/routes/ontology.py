from typing import Annotated, Optional


from fastapi import APIRouter, HTTPException, Query

from database.databricks import query_ontology_summary, query_ontology_table, query_resource_excel_table


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

