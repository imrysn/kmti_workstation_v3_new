"""
Feature flags router — IT-only toggles for maintenance/closed page states.
All flags are stored in the shared MySQL DB so every workstation sees changes instantly.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
import json
import os

from db.database import get_db
from models.user import User, UserRole, FeatureFlag
from core.auth import get_current_user, require_role
from core.github_sync import sync_service

router = APIRouter()

# ---------------------------------------------------------------------------
# Default flags seeded on first access if missing from DB
# ---------------------------------------------------------------------------
DEFAULT_FLAGS = {
    # Global overrides
    "maintenance_mode": False,
    "feature_closed": False,

    # Module Visibility (Enabled/Disabled)
    "purchased_parts_enabled": True,
    "character_search_enabled": True,
    "heat_treatment_enabled": True,
    "calculator_enabled": True,

    # Per-Module Maintenance (Nominal/Locked)
    "purchased_parts_maintenance": False,
    "character_search_maintenance": False,
    "heat_treatment_maintenance": False,
    "calculator_maintenance": False,
}

OVERRIDE_FILE = "status_override.json"

def _get_file_overrides():
    """Reads flags from the override JSON file if it exists."""
    if not os.path.exists(OVERRIDE_FILE):
        return {}
    try:
        with open(OVERRIDE_FILE, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading override file: {e}")
        return {}


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
    
    # 1. Start with Defaults
    flag_map = DEFAULT_FLAGS.copy()
    
    # 2. Apply Local File overrides (lowest priority sync)
    overrides = _get_file_overrides()
    for key, val in overrides.items():
        flag_map[key] = val
    
    # 3. Apply GitHub Polling overrides (medium priority sync)
    github_overrides = sync_service.overrides
    for key, val in github_overrides.items():
        flag_map[key] = val
        
    # 4. Apply DB values (ONLY IF they were explicitly updated by an IT user)
    result = await db.execute(select(FeatureFlag).where(FeatureFlag.updated_by != None))
    db_overrides = result.scalars().all()
    for f in db_overrides:
        flag_map[f.key] = f.value
        
    return flag_map


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
