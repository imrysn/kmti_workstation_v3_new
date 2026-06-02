"""
Auth router — login and current user endpoints.

Hybrid login: accepts both kmti_users (local/shared/IT accounts) and
kmtifms.users (individual FMS accounts). kmti_users is always checked first
so that existing admin/IT shared accounts continue to work unchanged.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from db.database import get_db, get_fms_db
from models.user import User, UserRole
from models.fms import FmsUser
from core.auth import (
    verify_password, create_access_token, create_access_token_fms,
    get_current_user, require_role, hash_password
)
from pydantic import BaseModel
from core.cache import cache_get, cache_set, cache_delete
from core.activity_logger import log_activity


router = APIRouter()

# Valid workstation roles — used to exclude kmtifms.users rows that may
# bleed into the primary DB session (both live on the same NAS MySQL server).
VALID_WORKSTATION_ROLES = [r.value for r in UserRole]  # ['user', 'admin', 'it']


# FMS role → workstation role mapping
# ADMIN → admin, everything else (USER, TEAM LEADER, etc.) → user
def _map_fms_role(fms_role: str) -> str:
    role_upper = (fms_role or "").strip().upper()
    if role_upper == "ADMIN":
        return "admin"
    return "user"


@router.post("/login")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
    fms_db: AsyncSession = Depends(get_fms_db),
):
    """
    Authenticate user and return JWT access token.

    Hybrid login strategy:
    1. Try kmti_users (existing shared/IT accounts — unchanged behavior)
    2. If not found or wrong password, try kmtifms.users (individual FMS accounts)
    """
    # ── Step 1: Try local kmti_users account ──────────────────────────────
    local_result = await db.execute(
        select(User).where(User.username == form_data.username)
    )
    local_user = local_result.scalar_one_or_none()

    if local_user and verify_password(form_data.password, local_user.hashed_password):
        if not local_user.is_active:
            await log_activity(
                username=form_data.username, action="LOGIN_FAILED",
                details="Account deactivated.", ip_address=request.client.host
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account has been deactivated. Contact your administrator.",
            )
        token = create_access_token(local_user)
        await log_activity(
            username=local_user.username, action="LOGIN",
            details="Successful login (local account)", ip_address=request.client.host
        )
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": local_user.id,
                "username": local_user.username,
                "fullName": local_user.username,   # shared accounts use username as display
                "role": local_user.role.value,
            },
        }

    # ── Step 2: Try kmtifms.users account ────────────────────────────────
    try:
        fms_result = await fms_db.execute(
            select(FmsUser).where(FmsUser.username == form_data.username)
        )
        fms_user = fms_result.scalar_one_or_none()
    except Exception:
        fms_user = None  # FMS DB unreachable — fall through to auth failure

    if fms_user and verify_password(form_data.password, fms_user.password):
        mapped_role = _map_fms_role(fms_user.role)
        token = create_access_token_fms(
            fms_user_id=fms_user.id,
            username=fms_user.username,
            full_name=fms_user.fullName,
            role=mapped_role,
        )
        await log_activity(
            username=fms_user.username, action="LOGIN",
            details=f"Successful login (FMS account, fullName='{fms_user.fullName}')",
            ip_address=request.client.host
        )
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": fms_user.id,
                "username": fms_user.username,
                "fullName": fms_user.fullName,
                "role": mapped_role,
            },
        }

    # ── Both failed ────────────────────────────────────────────────────────
    await log_activity(
        username=form_data.username, action="LOGIN_FAILED",
        details="Incorrect username or password.", ip_address=request.client.host
    )
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect username or password.",
        headers={"WWW-Authenticate": "Bearer"},
    )


@router.get("/me")
async def get_me(current_user=Depends(get_current_user)):
    """Returns the currently authenticated user. Useful for token validation on app load."""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "fullName": getattr(current_user, "fullName", current_user.username),
        "role": current_user.role.value,
        "is_active": current_user.is_active,
    }


@router.get("/users")
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin, UserRole.it])),
):
    """Returns all workstation users. Restricted to Admin and IT roles.

    Explicitly filters to valid workstation roles (user/admin/it) to prevent
    kmtifms.users rows from appearing — both DBs live on the same NAS MySQL
    server and can share visibility depending on the DB user's grants.
    """
    role_str = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    cache_key = f"role:{role_str}"
    cached_val = await cache_get("users", cache_key)
    if cached_val is not None:
        return cached_val

    query = (
        select(User)
        .where(User.role.in_(VALID_WORKSTATION_ROLES))
        .order_by(User.username)
    )

    # Hide IT accounts from Admin-level users
    if current_user.role == UserRole.admin:
        query = query.where(User.role != UserRole.it)

    result = await db.execute(query)
    users = result.scalars().all()
    res_list = [
        {
            "id": u.id,
            "username": u.username,
            "role": u.role.value if hasattr(u.role, "value") else u.role,
            "is_active": u.is_active,
            "created_at": u.created_at,
        }
        for u in users
    ]
    await cache_set("users", cache_key, res_list)
    return res_list


# --- CRUD Models ---
class UserCreate(BaseModel):
    username: str
    password: str
    role: UserRole

class UserUpdate(BaseModel):
    username: str | None = None
    password: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None


@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin, UserRole.it])),
):
    """Creates a new user. Restricted to Admin and IT roles."""
    # Check if user already exists
    res = await db.execute(select(User).where(User.username == payload.username))
    if res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already registered.")

    new_user = User(
        username=payload.username,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        is_active=True
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    await cache_delete("users")
    await log_activity(
        username=current_user.username,
        action="CREATE_USER",
        details=f"Created user '{payload.username}' with role '{payload.role.value if hasattr(payload.role, 'value') else payload.role}'",
        ip_address=request.client.host
    )
    return {"id": new_user.id, "username": new_user.username, "role": new_user.role.value}


@router.patch("/users/{user_id}")
async def update_user(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin, UserRole.it])),
):
    """Updates a user's role or status. Restricted to Admin and IT roles."""
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Admins cannot modify IT accounts
    if current_user.role == UserRole.admin and user.role == UserRole.it:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins are not permitted to manage IT accounts."
        )

    if payload.username is not None:
        user.username = payload.username
    if payload.password is not None:
        user.hashed_password = hash_password(payload.password)
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active

    await db.commit()
    await cache_delete("users")
    await log_activity(
        username=current_user.username,
        action="UPDATE_USER",
        details=f"Updated user '{user.username}' (role={user.role.value if hasattr(user.role, 'value') else user.role}, active={user.is_active})",
        ip_address=request.client.host
    )
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "is_active": user.is_active,
    }


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin, UserRole.it])),
):
    """Permanently deletes a user. Restricted to Admin and IT roles."""
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Admins cannot delete IT accounts
    if current_user.role == UserRole.admin and user.role == UserRole.it:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins are not permitted to manage IT accounts."
        )

    # Prevent self-deletion
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")

    await db.delete(user)
    await db.commit()
    await cache_delete("users")
    await log_activity(
        username=current_user.username,
        action="DELETE_USER",
        details=f"Deleted user '{user.username}'",
        ip_address=request.client.host
    )
    return {"status": "ok", "message": f"User {user.username} deleted."}
