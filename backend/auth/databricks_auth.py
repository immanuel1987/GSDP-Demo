"""
Read/write auth users and roles in Unity Catalog via the SQL warehouse (databricks-sql-connector).

Passwords: bcrypt hashes are produced in Python (auth.security.get_password_hash) — Databricks SQL
does not provide bcrypt/Argon2 for application passwords; storing pre-hashed secrets in Delta is standard.

If tables are missing (TABLE_OR_VIEW_NOT_FOUND), call ensure_auth_tables_exist() — used automatically
before reads/writes (idempotent CREATE SCHEMA / CREATE TABLE IF NOT EXISTS).
"""

import json
import os
import threading
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv

from auth import role_pages as rp
from database.databricks import get_databricks_connection

load_dotenv()

# Defaults: ontology.silver.{users|roles} — do not use schema name "users" unless that schema exists in UC.
CATALOG = os.getenv("DATABRICKS_AUTH_CATALOG", "ontology")
SCHEMA = os.getenv("DATABRICKS_AUTH_SCHEMA", "users")

_ensure_lock = threading.Lock()
_tables_ensured = False
_roles_allowed_pages_column_ready = False


def _ident(part: str) -> str:
    return f"`{str(part).replace('`', '')}`"


def _resolve_catalog_schema() -> Tuple[str, str]:
    """Catalog + schema for DDL and default table paths."""
    u = os.getenv("DATABRICKS_AUTH_USERS_TABLE")
    if u:
        parts = [p for p in u.split(".") if p]
        if len(parts) >= 3:
            return parts[0], parts[1]
    r = os.getenv("DATABRICKS_AUTH_ROLES_TABLE")
    if r:
        parts = [p for p in r.split(".") if p]
        if len(parts) >= 3:
            return parts[0], parts[1]
    return CATALOG, SCHEMA


def _users_table_sql() -> str:
    full = os.getenv("DATABRICKS_AUTH_USERS_TABLE")
    if full:
        parts = [p for p in full.split(".") if p]
        if len(parts) == 3:
            return ".".join(_ident(p) for p in parts)
        if len(parts) == 1:
            return _ident(parts[0])
    cat, sch = _resolve_catalog_schema()
    return ".".join((_ident(cat), _ident(sch), _ident("users")))


def _roles_table_sql() -> str:
    full = os.getenv("DATABRICKS_AUTH_ROLES_TABLE")
    if full:
        parts = [p for p in full.split(".") if p]
        if len(parts) == 3:
            return ".".join(_ident(p) for p in parts)
        if len(parts) == 1:
            return _ident(parts[0])
    cat, sch = _resolve_catalog_schema()
    return ".".join((_ident(cat), _ident(sch), _ident("roles")))


def ensure_auth_tables_exist() -> None:
    """
    Create schema (if needed) and Delta tables roles + users when they are missing.
    Safe to call repeatedly (IF NOT EXISTS). Serialized with a lock.
    """
    global _tables_ensured, _roles_allowed_pages_column_ready
    with _ensure_lock:
        cat, sch = _resolve_catalog_schema()
        fq_schema = f"{_ident(cat)}.{_ident(sch)}"
        roles = f"{fq_schema}.{_ident('roles')}"
        users = f"{fq_schema}.{_ident('users')}"
        conn = get_databricks_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f"CREATE SCHEMA IF NOT EXISTS {fq_schema}")
                if not _tables_ensured:
                    cur.execute(
                        f"""
                        CREATE TABLE IF NOT EXISTS {roles} (
                            id BIGINT GENERATED ALWAYS AS IDENTITY,
                            name STRING NOT NULL,
                            CONSTRAINT roles_pk PRIMARY KEY (id)
                        ) USING DELTA
                        """
                    )
                    cur.execute(
                        f"""
                        CREATE TABLE IF NOT EXISTS {users} (
                            id BIGINT GENERATED ALWAYS AS IDENTITY,
                            username STRING NOT NULL,
                            email STRING NOT NULL,
                            password_hash STRING NOT NULL,
                            region STRING NOT NULL,
                            role_id BIGINT NOT NULL
                        ) USING DELTA
                        """
                    )
                    _tables_ensured = True
                if not _roles_allowed_pages_column_ready:
                    try:
                        cur.execute(f"ALTER TABLE {roles} ADD COLUMNS (allowed_pages_json STRING)")
                    except Exception as e:
                        msg = str(e).lower()
                        if (
                            "already exists" in msg
                            or "duplicate" in msg
                            or "field_already_exists" in msg
                            or "already exist" in msg
                        ):
                            pass
                        else:
                            raise
                    _roles_allowed_pages_column_ready = True
        except Exception:
            _tables_ensured = False
            raise
        finally:
            conn.close()


def _is_missing_table_error(exc: BaseException) -> bool:
    msg = str(exc)
    return "TABLE_OR_VIEW_NOT_FOUND" in msg or "42P01" in msg


def _run_with_table_guard(fn):
    """Ensure tables exist, run fn(), retry once after DDL if warehouse still reports missing table."""
    global _tables_ensured, _roles_allowed_pages_column_ready
    ensure_auth_tables_exist()
    try:
        return fn()
    except Exception as e:
        if not _is_missing_table_error(e):
            raise
        with _ensure_lock:
            _tables_ensured = False
            _roles_allowed_pages_column_ready = False
        ensure_auth_tables_exist()
        return fn()


def _row_to_dict(cursor, row) -> Dict[str, Any]:
    cols = [c[0] for c in cursor.description]
    out = {}
    for k, v in zip(cols, row):
        if hasattr(v, "isoformat"):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out


def resolve_allowed_pages_json(raw: Any, role_name: str) -> List[str]:
    """Use stored JSON override when present and valid; otherwise name-based defaults."""
    if raw is not None and str(raw).strip():
        try:
            data = json.loads(str(raw))
            if isinstance(data, list):
                return rp.validate_allowed_pages([str(x) for x in data])
        except (json.JSONDecodeError, ValueError):
            pass
    return rp.default_allowed_pages_for_role_name(role_name)


def list_roles() -> List[Dict[str, Any]]:
    roles = _roles_table_sql()
    sql = f"SELECT id, name, allowed_pages_json FROM {roles} ORDER BY id"

    def _go():
        conn = get_databricks_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql)
                rows = cur.fetchall()
                out = []
                for r in rows:
                    d = _row_to_dict(cur, r)
                    name = str(d["name"])
                    d["allowed_pages"] = resolve_allowed_pages_json(d.get("allowed_pages_json"), name)
                    out.append(d)
                return out
        finally:
            conn.close()

    return _run_with_table_guard(_go)


def get_role_by_id(role_id: int) -> Optional[Dict[str, Any]]:
    roles = _roles_table_sql()
    sql = f"SELECT id, name, allowed_pages_json FROM {roles} WHERE id = ?"

    def _go():
        conn = get_databricks_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, (int(role_id),))
                row = cur.fetchone()
                if not row:
                    return None
                return _row_to_dict(cur, row)
        finally:
            conn.close()

    return _run_with_table_guard(_go)


def count_roles_with_name(name: str) -> int:
    roles = _roles_table_sql()
    sql = f"SELECT COUNT(*) AS c FROM {roles} WHERE lower(trim(name)) = lower(trim(?))"

    def _go():
        conn = get_databricks_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, (name.strip(),))
                row = cur.fetchone()
                return int(row[0]) if row else 0
        finally:
            conn.close()

    return _run_with_table_guard(_go)


def insert_role(name: str) -> Dict[str, Any]:
    """Insert a role row and return {id, name}."""
    roles = _roles_table_sql()
    trimmed = name.strip()
    insert_sql = f"INSERT INTO {roles} (name) VALUES (?)"
    sel_sql = f"SELECT id, name, allowed_pages_json FROM {roles} WHERE lower(trim(name)) = lower(?) ORDER BY id DESC LIMIT 1"

    def _go():
        conn = get_databricks_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(insert_sql, (trimmed,))
                cur.execute(sel_sql, (trimmed,))
                row = cur.fetchone()
                if not row:
                    raise RuntimeError("Role insert succeeded but row not found by name.")
                return _row_to_dict(cur, row)
        finally:
            conn.close()

    return _run_with_table_guard(_go)


def update_role_allowed_pages(role_id: int, pages: List[str]) -> None:
    """Persist validated page id list as JSON on the role row."""
    validated = rp.validate_allowed_pages(pages)
    blob = json.dumps(validated)
    roles = _roles_table_sql()
    sql = f"UPDATE {roles} SET allowed_pages_json = ? WHERE id = ?"

    def _go():
        conn = get_databricks_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, (blob, int(role_id)))
        finally:
            conn.close()

    return _run_with_table_guard(_go)


def clear_role_allowed_pages(role_id: int) -> None:
    """Remove stored override; permissions fall back to role name defaults."""
    roles = _roles_table_sql()
    sql = f"UPDATE {roles} SET allowed_pages_json = NULL WHERE id = ?"

    def _go():
        conn = get_databricks_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, (int(role_id),))
        finally:
            conn.close()

    return _run_with_table_guard(_go)


def count_users_with_email(email: str) -> int:
    users = _users_table_sql()
    sql = f"SELECT COUNT(*) AS c FROM {users} WHERE lower(email) = lower(?)"

    def _go():
        conn = get_databricks_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, (email.strip(),))
                row = cur.fetchone()
                return int(row[0]) if row else 0
        finally:
            conn.close()

    return _run_with_table_guard(_go)


def count_users_with_username(username: str) -> int:
    users = _users_table_sql()
    sql = f"SELECT COUNT(*) AS c FROM {users} WHERE lower(username) = lower(?)"

    def _go():
        conn = get_databricks_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, (username.strip(),))
                row = cur.fetchone()
                return int(row[0]) if row else 0
        finally:
            conn.close()

    return _run_with_table_guard(_go)


def get_user_with_role_by_email(email: str) -> Optional[Dict[str, Any]]:
    users = _users_table_sql()
    roles = _roles_table_sql()
    sql = f"""
    SELECT u.id AS user_id, u.username, u.email, u.password_hash, u.region, u.role_id,
           r.id AS r_id, r.name AS role_name, r.allowed_pages_json AS role_allowed_pages_json
    FROM {users} u
    INNER JOIN {roles} r ON u.role_id = r.id
    WHERE lower(u.email) = lower(?)
    LIMIT 1
    """

    def _go():
        conn = get_databricks_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, (email.strip(),))
                row = cur.fetchone()
                if not row:
                    return None
                d = _row_to_dict(cur, row)
                return {
                    "id": d.get("user_id"),
                    "username": d.get("username"),
                    "email": d.get("email"),
                    "password_hash": d.get("password_hash"),
                    "region": d.get("region"),
                    "role_id": d.get("role_id"),
                    "role_allowed_pages_json": d.get("role_allowed_pages_json"),
                    "role": {"id": d.get("r_id"), "name": d.get("role_name")},
                }
        finally:
            conn.close()

    return _run_with_table_guard(_go)


def get_user_with_role_by_login(identifier: str) -> Optional[Dict[str, Any]]:
    """Resolve user by email or username (case-insensitive)."""
    users = _users_table_sql()
    roles = _roles_table_sql()
    ident = (identifier or "").strip()
    sql = f"""
    SELECT u.id AS user_id, u.username, u.email, u.password_hash, u.region, u.role_id,
           r.id AS r_id, r.name AS role_name, r.allowed_pages_json AS role_allowed_pages_json
    FROM {users} u
    INNER JOIN {roles} r ON u.role_id = r.id
    WHERE lower(u.email) = lower(?) OR lower(u.username) = lower(?)
    LIMIT 1
    """

    def _go():
        conn = get_databricks_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, (ident, ident))
                row = cur.fetchone()
                if not row:
                    return None
                d = _row_to_dict(cur, row)
                return {
                    "id": d.get("user_id"),
                    "username": d.get("username"),
                    "email": d.get("email"),
                    "password_hash": d.get("password_hash"),
                    "region": d.get("region"),
                    "role_id": d.get("role_id"),
                    "role_allowed_pages_json": d.get("role_allowed_pages_json"),
                    "role": {"id": d.get("r_id"), "name": d.get("role_name")},
                }
        finally:
            conn.close()

    return _run_with_table_guard(_go)


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Return user with joined role and password_hash (for internal updates)."""
    users = _users_table_sql()
    roles = _roles_table_sql()
    sql = f"""
    SELECT u.id AS user_id, u.username, u.email, u.password_hash, u.region, u.role_id,
           r.id AS r_id, r.name AS role_name, r.allowed_pages_json AS role_allowed_pages_json
    FROM {users} u
    INNER JOIN {roles} r ON u.role_id = r.id
    WHERE u.id = ?
    LIMIT 1
    """

    def _go():
        conn = get_databricks_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, (int(user_id),))
                row = cur.fetchone()
                if not row:
                    return None
                d = _row_to_dict(cur, row)
                return {
                    "id": d.get("user_id"),
                    "username": d.get("username"),
                    "email": d.get("email"),
                    "password_hash": d.get("password_hash"),
                    "region": d.get("region"),
                    "role_id": d.get("role_id"),
                    "role_allowed_pages_json": d.get("role_allowed_pages_json"),
                    "role": {"id": d.get("r_id"), "name": d.get("role_name")},
                }
        finally:
            conn.close()

    return _run_with_table_guard(_go)


def count_users_with_email_excluding(email: str, exclude_user_id: int) -> int:
    users = _users_table_sql()
    sql = f"SELECT COUNT(*) AS c FROM {users} WHERE lower(email) = lower(?) AND id <> ?"

    def _go():
        conn = get_databricks_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, (email.strip(), int(exclude_user_id)))
                row = cur.fetchone()
                return int(row[0]) if row else 0
        finally:
            conn.close()

    return _run_with_table_guard(_go)


def count_users_with_username_excluding(username: str, exclude_user_id: int) -> int:
    users = _users_table_sql()
    sql = f"SELECT COUNT(*) AS c FROM {users} WHERE lower(username) = lower(?) AND id <> ?"

    def _go():
        conn = get_databricks_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, (username.strip(), int(exclude_user_id)))
                row = cur.fetchone()
                return int(row[0]) if row else 0
        finally:
            conn.close()

    return _run_with_table_guard(_go)


def count_users_with_role_id(role_id: int) -> int:
    users = _users_table_sql()
    sql = f"SELECT COUNT(*) AS c FROM {users} WHERE role_id = ?"

    def _go():
        conn = get_databricks_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, (int(role_id),))
                row = cur.fetchone()
                return int(row[0]) if row else 0
        finally:
            conn.close()

    return _run_with_table_guard(_go)


def update_user_fields(
    user_id: int,
    username: str,
    email: str,
    password_hash: str,
    region: str,
    role_id: int,
) -> None:
    users = _users_table_sql()
    sql = f"""
    UPDATE {users}
    SET username = ?, email = ?, password_hash = ?, region = ?, role_id = ?
    WHERE id = ?
    """

    def _go():
        conn = get_databricks_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    sql,
                    (
                        username.strip(),
                        email.strip(),
                        password_hash,
                        region.strip(),
                        int(role_id),
                        int(user_id),
                    ),
                )
        finally:
            conn.close()

    return _run_with_table_guard(_go)


def delete_user_by_id(user_id: int) -> int:
    """Delete user by primary key; returns deleted row count."""
    users = _users_table_sql()
    sql = f"DELETE FROM {users} WHERE id = ?"

    def _go():
        conn = get_databricks_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, (int(user_id),))
                return int(getattr(cur, "rowcount", 0) or 0)
        finally:
            conn.close()

    return _run_with_table_guard(_go)


def count_roles_with_name_excluding(name: str, exclude_role_id: int) -> int:
    roles = _roles_table_sql()
    sql = f"SELECT COUNT(*) AS c FROM {roles} WHERE lower(trim(name)) = lower(trim(?)) AND id <> ?"

    def _go():
        conn = get_databricks_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, (name.strip(), int(exclude_role_id)))
                row = cur.fetchone()
                return int(row[0]) if row else 0
        finally:
            conn.close()

    return _run_with_table_guard(_go)


def update_role_name(role_id: int, name: str) -> None:
    roles = _roles_table_sql()
    sql = f"UPDATE {roles} SET name = ? WHERE id = ?"

    def _go():
        conn = get_databricks_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, (name.strip(), int(role_id)))
        finally:
            conn.close()

    return _run_with_table_guard(_go)


def delete_role_by_id(role_id: int) -> int:
    roles = _roles_table_sql()
    sql = f"DELETE FROM {roles} WHERE id = ?"

    def _go():
        conn = get_databricks_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, (int(role_id),))
                return int(getattr(cur, "rowcount", 0) or 0)
        finally:
            conn.close()

    return _run_with_table_guard(_go)


def insert_user(username: str, email: str, password_hash: str, region: str, role_id: int) -> Dict[str, Any]:
    users = _users_table_sql()
    roles = _roles_table_sql()
    insert_sql = f"""
    INSERT INTO {users} (username, email, password_hash, region, role_id)
    VALUES (?, ?, ?, ?, ?)
    """
    sel = f"""
    SELECT u.id AS user_id, u.username, u.email, u.region, u.role_id,
           r.id AS r_id, r.name AS role_name, r.allowed_pages_json AS role_allowed_pages_json
    FROM {users} u
    INNER JOIN {roles} r ON u.role_id = r.id
    WHERE lower(u.email) = lower(?)
    LIMIT 1
    """

    def _go():
        conn = get_databricks_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    insert_sql,
                    (
                        username.strip(),
                        email.strip(),
                        password_hash,
                        region.strip(),
                        int(role_id),
                    ),
                )
                cur.execute(sel, (email.strip(),))
                row = cur.fetchone()
                if not row:
                    raise RuntimeError("User insert succeeded but row not found by email.")
                d = _row_to_dict(cur, row)
                return {
                    "id": d.get("user_id"),
                    "username": d.get("username"),
                    "email": d.get("email"),
                    "region": d.get("region"),
                    "role_id": d.get("role_id"),
                    "role_allowed_pages_json": d.get("role_allowed_pages_json"),
                    "role": {"id": d.get("r_id"), "name": d.get("role_name")},
                }
        finally:
            conn.close()

    return _run_with_table_guard(_go)
