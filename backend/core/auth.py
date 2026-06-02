"""
Auth core — JWT encoding/decoding, password hashing, and FastAPI dependencies.

Dependencies you can use in any router:
  get_current_user  — returns the User ORM object or FmsAuthUser, or raises 401
  require_role([])  — factory that returns a dependency raising 403 if role not allowed

FMS Integration Note:
  FMS users (from kmtifms.users) are authenticated via hybrid login in auth.py.
  Their tokens carry source="fms" so get_current_user can skip the kmti_users DB
  lookup and trust the JWT payload directly — no row exists for them in kmti_users.
"""
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from db.database import get_db
from models.user import User, UserRole

import os

# ---------------------------------------------------------------------------
# Config — pulled from env so nothing is hardcoded
# JWT_SECRET must be set in backend/.env (min 32 chars, random string)
# ---------------------------------------------------------------------------
JWT_SECRET = os.environ.get("JWT_SECRET", "CHANGE_ME_IN_PRODUCTION_USE_RANDOM_32CHARS")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ---------------------------------------------------------------------------
# Password helpers — using bcrypt directly (passlib incompatible with bcrypt>=4)
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_access_token(user: User, full_name: str | None = None) -> str:
    """Create a JWT for a kmti_users account (primary DB user)."""
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)
    payload = {
        "sub": str(user.id),
        "username": user.username,
        # For shared/local accounts, fullName falls back to username
        "fullName": full_name or user.username,
        "displayName": user.display_name or None,
        "role": user.role.value,
        "source": "local",
        "exp": expire,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_access_token_fms(fms_user_id: int, username: str, full_name: str, role: str, display_name: str | None = None) -> str:
    """Create a JWT for a kmtifms.users account (no ORM object needed)."""
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)
    payload = {
        "sub": str(fms_user_id),
        "username": username,
        "fullName": full_name,
        "displayName": display_name or None,
        "role": role,
        "source": "fms",
        "exp": expire,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Raises JWTError on invalid/expired token."""
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


# ---------------------------------------------------------------------------
# Virtual user object for FMS accounts
# ---------------------------------------------------------------------------

class FmsAuthUser:
    """
    Mimics the User ORM interface for FMS-authenticated users.
    FMS users are validated via JWT only — no kmti_users row exists for them.
    This allows all router code that uses current_user.username, .role, etc.
    to work transparently for both local and FMS users.
    """
    def __init__(self, user_id: int, username: str, full_name: str, role_str: str, display_name: str | None = None):
        self.id = user_id
        self.username = username
        self.fullName = full_name
        self.displayName = display_name
        self.role = UserRole(role_str)
        self.is_active = True
        self.hashed_password = None  # not available / not needed


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns a User ORM object (local accounts) or FmsAuthUser (FMS accounts).
    Both expose .id, .username, .role, .is_active for use in all routers.
    """
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired session. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub")
        source: str = payload.get("source", "local")
        if user_id is None:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    # FMS users: trust the JWT payload entirely — no row in kmti_users
    if source == "fms":
        username = payload.get("username", "")
        full_name = payload.get("fullName", username)
        display_name = payload.get("displayName")
        role_str = payload.get("role", "user")
        try:
            return FmsAuthUser(int(user_id), username, full_name, role_str, display_name)
        except (ValueError, KeyError):
            raise credentials_exc

    # Local users: validate against kmti_users DB as before
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise credentials_exc

    return user


def require_role(allowed_roles: List[UserRole]):
    """
    Dependency factory. Usage:
        @router.post("/")
        async def create_thing(user = Depends(require_role(["admin", "it"]))):
    Works for both User ORM objects and FmsAuthUser virtual objects.
    """
    async def _check(current_user=Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {[r.value for r in allowed_roles]}",
            )
        return current_user
    return _check
