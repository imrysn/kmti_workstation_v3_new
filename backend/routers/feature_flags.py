"""
Feature flags router — IT-only toggles for maintenance/closed page states.
All flags are stored in the shared MySQL DB so every workstation sees changes instantly.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel

from db.database import get_db
from models.user import User, UserRole, FeatureFlag
from core.auth import get_current_user, require_role

router = APIRouter()

# ---------------------------------------------------------------------------
# Default flags seeded on first access if missing from DB
# ---------------------------------------------------------------------------
DEFAULT_FLAGS = {
    "heat_treatment_enabled": True,
    "calculator_enabled": True,
    "maintenance_mode": False,
}


async def _ensure_flags(db: AsyncSession):
    """Seeds missing flags with defaults. Idempotent."""
    result = await db.execute(select(FeatureFlag))
    existing_keys = {f.key for f in result.scalars().all()}

    for key, default_val in DEFAULT_FLAGS.items():
        if key not in existing_keys:
            db.add(FeatureFlag(key=key, value=default_val))

    await db.commit()


# ---------------------------------------------------------------------------
# Public read — all authenticated users can read flags (Viewer needs them too)
# ---------------------------------------------------------------------------

@router.get("/")
async def get_all_flags(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns all feature flags. Readable by any authenticated user."""
    await _ensure_flags(db)
    result = await db.execute(select(FeatureFlag))
    flags = result.scalars().all()
    return {f.key: f.value for f in flags}


# ---------------------------------------------------------------------------
# IT-only write
# ---------------------------------------------------------------------------

class FlagUpdate(BaseModel):
    value: bool


@router.patch("/{key}")
async def update_flag(
    key: str,
    payload: FlagUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.it])),
):
    """Toggle a feature flag. IT role only."""
    if key not in DEFAULT_FLAGS:
        raise HTTPException(status_code=404, detail=f"Unknown feature flag: '{key}'")

    await _ensure_flags(db)
    result = await db.execute(select(FeatureFlag).where(FeatureFlag.key == key))
    flag = result.scalar_one_or_none()

    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found after seed — this shouldn't happen.")

    flag.value = payload.value
    flag.updated_by = current_user.username
    await db.commit()

    return {"key": flag.key, "value": flag.value, "updated_by": flag.updated_by}
