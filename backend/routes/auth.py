from datetime import timedelta
from typing import List

from fastapi import APIRouter, HTTPException, status

from auth import databricks_auth as db_auth
from auth.security import ACCESS_TOKEN_EXPIRE_MINUTES, create_access_token, get_password_hash, verify_password
from schemas.user import (
    LoginResponse,
    RoleAllowedPagesUpdate,
    RoleCreate,
    RoleResponse,
    RoleUpdate,
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdate,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _to_user_response(u: dict) -> UserResponse:
    role = u.get("role") or {}
    roles: List[RoleResponse] = []
    role_name = str(role.get("name") or "")
    raw_json = u.get("role_allowed_pages_json")
    allowed = db_auth.resolve_allowed_pages_json(raw_json, role_name)
    if role.get("id") is not None and role.get("name") is not None:
        roles.append(
            RoleResponse(
                id=int(role["id"]),
                name=str(role["name"]),
                allowed_pages=allowed,
            )
        )
    return UserResponse(
        id=int(u["id"]),
        username=str(u["username"]),
        email=u["email"],
        region=str(u["region"]),
        roles=roles,
        allowed_pages=allowed,
    )


@router.get("/roles", response_model=List[RoleResponse])
def list_auth_roles():
    """Roles stored in Databricks (Unity Catalog) for registration UI."""
    try:
        rows = db_auth.list_roles()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Databricks roles unavailable: {e}") from e
    return [
        RoleResponse(
            id=int(r["id"]),
            name=str(r["name"]),
            allowed_pages=list(r.get("allowed_pages") or []),
        )
        for r in rows
    ]


@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_auth_role(body: RoleCreate):
    """Create a role in the Databricks `roles` table (name must be unique, case-insensitive)."""
    try:
        if db_auth.count_roles_with_name(body.name) > 0:
            raise HTTPException(status_code=400, detail="Role name already exists")
        row = db_auth.insert_role(body.name)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Databricks create role failed: {e}") from e
    ap = db_auth.resolve_allowed_pages_json(row.get("allowed_pages_json"), str(row["name"]))
    return RoleResponse(id=int(row["id"]), name=str(row["name"]), allowed_pages=ap)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user: UserCreate):
    try:
        if db_auth.count_users_with_email(str(user.email)) > 0:
            raise HTTPException(status_code=400, detail="Email already registered")
        if db_auth.count_users_with_username(user.username) > 0:
            raise HTTPException(status_code=400, detail="Username already taken")
        role = db_auth.get_role_by_id(user.role_id)
        if not role:
            raise HTTPException(status_code=400, detail="Invalid role_id")
        hashed_password = get_password_hash(user.password)
        created = db_auth.insert_user(
            user.username,
            str(user.email),
            hashed_password,
            user.region,
            user.role_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Databricks register failed: {e}") from e
    return _to_user_response(created)


@router.post("/login", response_model=LoginResponse)
def login_user(user_credentials: UserLogin):
    try:
        user = db_auth.get_user_with_role_by_login(user_credentials.login.strip())
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Databricks login unavailable: {e}") from e
    if not user or not verify_password(user_credentials.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user["id"])},
        expires_delta=access_token_expires,
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": _to_user_response(user),
    }


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_auth_user(user_id: int, body: UserUpdate):
    """Update a user row in Unity Catalog (partial body — omitted fields unchanged)."""
    payload = body.model_dump(exclude_unset=True, exclude_none=True)
    if not payload:
        raise HTTPException(status_code=400, detail="No fields to update")
    try:
        current = db_auth.get_user_by_id(user_id)
        if not current:
            raise HTTPException(status_code=404, detail="User not found")
        new_username = str(payload.get("username", current["username"])).strip()
        new_email = str(payload.get("email", current["email"])).strip()
        new_region = str(payload.get("region", current["region"])).strip()
        new_role_id = int(payload.get("role_id", current["role_id"]))
        if new_email.lower() != str(current["email"]).lower():
            if db_auth.count_users_with_email_excluding(new_email, user_id) > 0:
                raise HTTPException(status_code=400, detail="Email already in use")
        if new_username.lower() != str(current["username"]).lower():
            if db_auth.count_users_with_username_excluding(new_username, user_id) > 0:
                raise HTTPException(status_code=400, detail="Username already taken")
        if new_role_id != int(current["role_id"]):
            if not db_auth.get_role_by_id(new_role_id):
                raise HTTPException(status_code=400, detail="Invalid role_id")
        if "password" in payload:
            new_hash = get_password_hash(str(payload["password"]))
        else:
            new_hash = current["password_hash"]
        db_auth.update_user_fields(user_id, new_username, new_email, new_hash, new_region, new_role_id)
        updated = db_auth.get_user_by_id(user_id)
        if not updated:
            raise HTTPException(status_code=500, detail="User update failed")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Databricks user update failed: {e}") from e
    return _to_user_response(updated)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_auth_user(user_id: int):
    try:
        if not db_auth.get_user_by_id(user_id):
            raise HTTPException(status_code=404, detail="User not found")
        db_auth.delete_user_by_id(user_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Databricks user delete failed: {e}") from e
    return None


@router.patch("/roles/{role_id}", response_model=RoleResponse)
def update_auth_role(role_id: int, body: RoleUpdate):
    try:
        if not db_auth.get_role_by_id(role_id):
            raise HTTPException(status_code=404, detail="Role not found")
        if db_auth.count_roles_with_name_excluding(body.name, role_id) > 0:
            raise HTTPException(status_code=400, detail="Role name already exists")
        db_auth.update_role_name(role_id, body.name)
        row = db_auth.get_role_by_id(role_id)
        if not row:
            raise HTTPException(status_code=500, detail="Role update failed")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Databricks role update failed: {e}") from e
    ap = db_auth.resolve_allowed_pages_json(row.get("allowed_pages_json"), str(row["name"]))
    return RoleResponse(id=int(row["id"]), name=str(row["name"]), allowed_pages=ap)


@router.put("/roles/{role_id}/allowed-pages", response_model=RoleResponse)
def put_role_allowed_pages(role_id: int, body: RoleAllowedPagesUpdate):
    """Persist which dashboard modules users with this UC role may open (enforced at login)."""
    try:
        row = db_auth.get_role_by_id(role_id)
        if not row:
            raise HTTPException(status_code=404, detail="Role not found")
        db_auth.update_role_allowed_pages(role_id, body.allowed_pages)
        row = db_auth.get_role_by_id(role_id)
        if not row:
            raise HTTPException(status_code=500, detail="Role reload failed")
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Databricks save failed: {e}") from e
    ap = db_auth.resolve_allowed_pages_json(row.get("allowed_pages_json"), str(row["name"]))
    return RoleResponse(id=int(row["id"]), name=str(row["name"]), allowed_pages=ap)


@router.delete("/roles/{role_id}/allowed-pages", response_model=RoleResponse)
def delete_role_allowed_pages_override(role_id: int):
    """Clear stored overrides; permissions revert to role-name defaults."""
    try:
        row = db_auth.get_role_by_id(role_id)
        if not row:
            raise HTTPException(status_code=404, detail="Role not found")
        db_auth.clear_role_allowed_pages(role_id)
        row = db_auth.get_role_by_id(role_id)
        if not row:
            raise HTTPException(status_code=500, detail="Role reload failed")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Databricks clear failed: {e}") from e
    ap = db_auth.resolve_allowed_pages_json(row.get("allowed_pages_json"), str(row["name"]))
    return RoleResponse(id=int(row["id"]), name=str(row["name"]), allowed_pages=ap)


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_auth_role(role_id: int):
    try:
        if not db_auth.get_role_by_id(role_id):
            raise HTTPException(status_code=404, detail="Role not found")
        if db_auth.count_users_with_role_id(role_id) > 0:
            raise HTTPException(
                status_code=409,
                detail="Role is assigned to users; reassign or delete those users first.",
            )
        db_auth.delete_role_by_id(role_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Databricks role delete failed: {e}") from e
    return None
