import os
import sys

IS_FROZEN = getattr(sys, 'frozen', False)

if IS_FROZEN:
    # Path to the folder where the .exe is (for persistent logs, settings)
    BASE_DIR = os.path.dirname(sys.executable)
    # Path to the temporary folder where PyInstaller unpacks bundled files
    RESOURCE_DIR = getattr(sys, '_MEIPASS', BASE_DIR)
else:
    # In development
    BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    RESOURCE_DIR = BASE_DIR

def get_resource_path(relative_path):
    """
    Hybrid path resolution:
    1. Check if the file exists inside the internal bundle (_MEIPASS).
    2. Fallback to the external directory (next to the .exe).
    This allows keeping large models external while keeping small icons internal.
    """
    if IS_FROZEN and hasattr(sys, '_MEIPASS'):
        internal_path = os.path.join(sys._MEIPASS, relative_path)
        if os.path.exists(internal_path):
            return internal_path
    return os.path.join(BASE_DIR, relative_path)

LOG_DIR = os.path.join(BASE_DIR, "logs")
PREVIEW_CACHE_DIR = os.path.join(BASE_DIR, ".preview_cache")
SETTINGS_FILE = os.path.join(BASE_DIR, "settings.json")

# Assets (Models can be internal or external)
TTS_MODEL_DIR = get_resource_path(os.path.join("models", "tts"))
TTS_MODEL_PATH = os.path.join(TTS_MODEL_DIR, "kokoro-v1.0.onnx")
TTS_VOICES_PATH = os.path.join(TTS_MODEL_DIR, "voices-v1.0.bin")

# Shared NAS Cache
NAS_TTS_CACHE_DIR = r"\\KMTI-NAS\Shared\data\tts"

# Ensure critical directories exist (Only persistent ones)
os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(PREVIEW_CACHE_DIR, exist_ok=True)
# Only create TTS_MODEL_DIR in development
if not IS_FROZEN:
    os.makedirs(TTS_MODEL_DIR, exist_ok=True)
