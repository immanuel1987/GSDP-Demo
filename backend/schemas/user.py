from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    # Only the first 72 UTF-8 bytes are used for hashing (bcrypt).
    password: str = Field(..., min_length=8, max_length=500)
    region: str = Field(..., min_length=1, max_length=200)
    role_id: int = Field(..., ge=1)


class UserUpdate(BaseModel):
    """Partial update — omit fields you do not want to change."""

    username: Optional[str] = Field(None, min_length=1, max_length=200)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8, max_length=500)
    region: Optional[str] = Field(None, min_length=1, max_length=200)
    role_id: Optional[int] = Field(None, ge=1)


class UserLogin(BaseModel):
    """`login` is an email address or username (matched case-insensitively)."""

    login: str = Field(..., min_length=1, max_length=254, description="Email or username")
    password: str = Field(..., min_length=1)


class RoleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


class RoleUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


class RoleResponse(BaseModel):
    id: int
    name: str
    allowed_pages: List[str] = Field(
        default_factory=list,
        description="Effective dashboard module ids (stored override or name-based default).",
    )

    class Config:
        from_attributes = True


class RoleAllowedPagesUpdate(BaseModel):
    """Replace stored allowed modules for a UC role (must include `dashboard`)."""

    allowed_pages: List[str]


class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    region: str
    roles: List[RoleResponse] = []
    allowed_pages: List[str] = Field(
        default_factory=list,
        description="Effective dashboard routes for this user (from role row + defaults).",
    )

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class LoginResponse(BaseModel):
    """Successful login: bearer token plus resolved user (no password hash)."""

    access_token: str
    token_type: str
    user: UserResponse
