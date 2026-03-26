"""
Settings router — manages the equivalent of My.Settings from the legacy VB app.
Stores/retrieves DB connection info and local file paths.

Access control:
  GET  /api/settings/       — admin, it
  POST /api/settings/       — admin, it
  DELETE /api/settings/cache — admin, it
"""
from fastapi import APIRouter, Depends
import json
import os
import shutil

from models.user import User, UserRole
from core.auth import require_role
from core.github_sync import sync_service

router = APIRouter()

SETTINGS_FILE = os.path.join(os.path.dirname(__file__), "..", "settings.json")

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
def get_settings(current_user: User = Depends(require_role([UserRole.admin, UserRole.it]))):
    """Returns application settings. Admin and IT only."""
    s = load_settings()
    s["dbPass"] = "***" if s.get("dbPass") else ""
    return s


@router.post("/")
def update_settings(
    payload: dict,
    current_user: User = Depends(require_role([UserRole.admin, UserRole.it])),
):
    """Saves application settings. Admin and IT only."""
    current = load_settings()
    if payload.get("dbPass") == "***":
        payload["dbPass"] = current.get("dbPass", "")
    save_settings(payload)
    return {"message": "Settings saved successfully"}


@router.delete("/cache")
def clear_preview_cache(
    current_user: User = Depends(require_role([UserRole.admin, UserRole.it])),
):
    """Deletes all cached previews. Admin and IT only."""
    cache_dir = os.path.join(os.path.dirname(__file__), "..", ".preview_cache")
    if os.path.exists(cache_dir):
        try:
            shutil.rmtree(cache_dir)
            os.makedirs(cache_dir, exist_ok=True)
            return {"message": "Cache cleared successfully"}
        except Exception as e:
            return {"message": f"Error clearing cache: {str(e)}"}, 500
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
