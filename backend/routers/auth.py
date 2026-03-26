"""
Auth router — login and current user endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from db.database import get_db
from models.user import User, UserRole
from core.auth import verify_password, create_access_token, get_current_user, require_role, hash_password
from pydantic import BaseModel


router = APIRouter()


@router.post("/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate user and return JWT access token.
    Uses OAuth2PasswordRequestForm so it's compatible with Bearer token flow.
    """
    result = await db.execute(
        select(User).where(User.username == form_data.username)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Contact your administrator.",
        )

    token = create_access_token(user)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role.value,
        },
    }


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Returns the currently authenticated user. Useful for token validation on app load."""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "role": current_user.role.value,
        "is_active": current_user.is_active,
    }


@router.get("/users")
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin, UserRole.it])),
):
    """Returns all users. Restricted to Admin and IT roles."""
    query = select(User).order_by(User.username)
    
    # Hide IT accounts from Admin-level users
    if current_user.role == UserRole.admin:
        query = query.where(User.role != UserRole.it)
        
    result = await db.execute(query)
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "role": u.role.value if hasattr(u.role, "value") else u.role,
            "is_active": u.is_active,
            "created_at": u.created_at,
        }
        for u in users
    ]


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
    return {"id": new_user.id, "username": new_user.username, "role": new_user.role.value}


@router.patch("/users/{user_id}")
async def update_user(
    user_id: int,
    payload: UserUpdate,
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
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "is_active": user.is_active,
    }


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
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
    return {"status": "ok", "message": f"User {user.username} deleted."}
