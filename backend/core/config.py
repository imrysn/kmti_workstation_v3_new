import os
import sys

IS_FROZEN = getattr(sys, 'frozen', False)

if IS_FROZEN:
    # In production (Frozen EXE)
    BASE_DIR = os.path.dirname(sys.executable)
else:
    # In development
    # Since this file is in backend/core/, the backend root is 1 level up
    BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

LOG_DIR = os.path.join(BASE_DIR, "logs")
PREVIEW_CACHE_DIR = os.path.join(BASE_DIR, ".preview_cache")
SETTINGS_FILE = os.path.join(BASE_DIR, "settings.json")

# Ensure critical directories exist
os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(PREVIEW_CACHE_DIR, exist_ok=True)
