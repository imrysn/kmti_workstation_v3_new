"""
Settings router — manages the equivalent of My.Settings from the legacy VB app.
Stores/retrieves DB connection info and local file paths.

Access control:
  GET  /api/settings/        — admin, it
  POST /api/settings/        — admin, it
  DELETE /api/settings/cache — admin, it
  PUT  /api/settings/display-name — any authenticated user
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import asyncio
import json
import os
import shutil

from models.user import User, UserRole
from core.auth import get_current_user, require_role
from core.github_sync import sync_service
from core.config import SETTINGS_FILE, PREVIEW_CACHE_DIR
from db.database import get_db

router = APIRouter()

def load_settings():
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, "r") as f:
            return json.load(f)
    return {
        "dbSource": "",
        "dbName": "",
        "dbUsername": "",
        "dbPass": "",
        "localPath": "",
        "actPath": "",
        "autoDel": False
    }

def save_settings(data: dict):
    with open(SETTINGS_FILE, "w") as f:
        json.dump(data, f, indent=2)


@router.get("/")
async def get_settings(current_user: User = Depends(require_role([UserRole.admin, UserRole.it]))):
    """Returns application settings. Admin and IT only."""
    s = await asyncio.to_thread(load_settings)
    s["dbPass"] = "***" if s.get("dbPass") else ""
    return s


@router.post("/")
async def update_settings(
    payload: dict,
    current_user: User = Depends(require_role([UserRole.admin, UserRole.it])),
):
    """Saves application settings. Admin and IT only."""
    current = await asyncio.to_thread(load_settings)
    if payload.get("dbPass") == "***":
        payload["dbPass"] = current.get("dbPass", "")
    await asyncio.to_thread(save_settings, payload)
    return {"message": "Settings saved successfully"}


@router.delete("/cache")
async def clear_preview_cache(
    current_user: User = Depends(require_role([UserRole.admin, UserRole.it])),
):
    """Deletes all cached previews. Admin and IT only."""
    cache_dir = PREVIEW_CACHE_DIR
    if os.path.exists(cache_dir):
        try:
            await asyncio.to_thread(shutil.rmtree, cache_dir)
            os.makedirs(cache_dir, exist_ok=True)
            return {"message": "Cache cleared successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error clearing cache: {str(e)}")
    return {"message": "Cache was already empty"}


@router.post("/update-app")
async def update_app(
    current_user: User = Depends(require_role([UserRole.admin, UserRole.it])),
):
    """Triggers a git pull to update the application code. Admin and IT only."""
    result = await sync_service.trigger_update()
    if result["success"]:
        return {"message": "Update downloaded successfully. The app will reload and apply changes shortly.", "output": result["output"]}
    else:
        return {"message": f"Update failed: {result['error']}"}, 500


class DisplayNameUpdate(BaseModel):
    displayName: str


@router.put("/display-name")
async def update_display_name(
    payload: DisplayNameUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the display name for the current user."""
    # Only local kmti_users can persist display_name
    source = getattr(current_user, "source", "local")
    if source == "fms" or not hasattr(current_user, "display_name"):
        # FMS users or virtual users — display_name persistence not supported
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Display name update is not available for FMS accounts."
        )

    current_user.display_name = payload.displayName.strip() or None
    await db.commit()
    return {"success": True, "displayName": current_user.display_name}
