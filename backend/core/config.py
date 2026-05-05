import os
import sys

IS_FROZEN = getattr(sys, 'frozen', False)

# 1. Directory Structure Resolution
if IS_FROZEN:
    # Read-only installation directory (Program Files)
    INSTALL_DIR = os.path.dirname(sys.executable)
    RESOURCE_DIR = getattr(sys, '_MEIPASS', INSTALL_DIR)
    
    # Writable user data directory (%LOCALAPPDATA%)
    appdata = os.environ.get('LOCALAPPDATA', os.path.expanduser('~'))
    DATA_DIR = os.path.join(appdata, "KMTI Workstation")
else:
    # Development mode
    INSTALL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    RESOURCE_DIR = INSTALL_DIR
    DATA_DIR = INSTALL_DIR

# Ensure writable directories exist
os.makedirs(DATA_DIR, exist_ok=True)

# For compatibility with legacy code
BASE_DIR = INSTALL_DIR 

def get_resource_path(relative_path):
    """
    Enhanced Hybrid Path Resolution:
    1. Internal (bundled inside .exe via _MEIPASS)
    2. External (installed in Program Files / resources)
    3. Network (Shared NAS - for heavy assets like TTS models)
    """
    # Try Internal Bundle
    if IS_FROZEN and hasattr(sys, '_MEIPASS'):
        internal = os.path.join(sys._MEIPASS, relative_path)
        if os.path.exists(internal): return internal
        
    # Try External Install Dir
    external = os.path.join(INSTALL_DIR, relative_path)
    if os.path.exists(external): return external
    
    # Try NAS Shared Storage (for heavy models)
    if "models" in relative_path:
        nas_path = os.path.join(r"\\KMTI-NAS\Shared\data\models\tts", os.path.basename(relative_path))
        if os.path.exists(nas_path): return nas_path

    return external

# --- Persistent Data Paths (Writable) ---
LOG_DIR = os.path.join(DATA_DIR, "logs")
PREVIEW_CACHE_DIR = os.path.join(DATA_DIR, ".preview_cache")
SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")

os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(PREVIEW_CACHE_DIR, exist_ok=True)

# --- Asset Paths (Models/Resources) ---
TTS_MODEL_DIR = os.path.join(INSTALL_DIR, "models", "tts") # Primary search in install dir
TTS_MODEL_PATH = get_resource_path(os.path.join("models", "tts", "kokoro-v1.0.onnx"))
TTS_VOICES_PATH = get_resource_path(os.path.join("models", "tts", "voices-v1.0.bin"))

# Shared NAS Cache for generated audio
NAS_TTS_CACHE_DIR = r"\\KMTI-NAS\Shared\data\tts"
