"""GSDP Data Access Layer."""

# Load .env for local development only (not on Databricks Apps where OAuth is auto-configured)
import os as _os
if not _os.environ.get("DATABRICKS_CLIENT_ID"):
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

import os
import pandas as pd
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.sql import StatementState
from config import TABLES


def _get_workspace_client():
    """Works both on Databricks Apps and locally."""
    if not os.getenv("DATABRICKS_CLIENT_ID"):
        db_host = os.getenv("DATABRICKS_HOST")
        db_token = os.getenv("DATABRICKS_TOKEN")
        if db_host and db_token:
            return WorkspaceClient(host=db_host, token=db_token)
    return WorkspaceClient()


def _get_warehouse_id():
    wh_id = os.getenv("DATABRICKS_SQL_WAREHOUSE_ID", "")
    if wh_id:
        return wh_id
    try:
        w = _get_workspace_client()
        for wh in w.warehouses.list():
            if wh.state and wh.state.value == "RUNNING":
                return wh.id
        for wh in w.warehouses.list():
            return wh.id
    except Exception:
        pass
    return None


def run_query(query: str) -> pd.DataFrame:
    """Execute SQL via statement execution API."""
    try:
        w = _get_workspace_client()
        warehouse_id = _get_warehouse_id()
        if not warehouse_id:
            return pd.DataFrame({"error": ["No SQL warehouse available."]})

        response = w.statement_execution.execute_statement(
            warehouse_id=warehouse_id,
            statement=query,
            wait_timeout="60s",
        )

        if response.status and response.status.state == StatementState.SUCCEEDED:
            if response.manifest and response.manifest.schema and response.result:
                columns = [col.name for col in response.manifest.schema.columns]
                rows = response.result.data_array or []
                return pd.DataFrame(rows, columns=columns)
            return pd.DataFrame()
        elif response.status and response.status.error:
            return pd.DataFrame({"error": [response.status.error.message]})
        else:
            return pd.DataFrame({"error": ["Query timed out."]})
    except Exception as e:
        return pd.DataFrame({"error": [str(e)]})
