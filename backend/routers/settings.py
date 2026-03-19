"""
Settings router — manages the equivalent of My.Settings from the legacy VB app.
Stores/retrieves DB connection info and local file paths.
"""
from fastapi import APIRouter
import json
import os

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
def get_settings():
    """Returns application settings (equivalent to My.Settings)."""
    s = load_settings()
    # Never expose the raw password
    s["dbPass"] = "***" if s.get("dbPass") else ""
    return s


@router.post("/")
def update_settings(payload: dict):
    """Saves application settings."""
    current = load_settings()
    # Only update password if explicitly provided
    if payload.get("dbPass") == "***":
        payload["dbPass"] = current.get("dbPass", "")
    save_settings(payload)
    return {"message": "Settings saved successfully"}
