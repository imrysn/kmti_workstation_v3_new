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
TTS_MODEL_DIR = os.path.join(BASE_DIR, "models", "tts")
TTS_MODEL_PATH = os.path.join(TTS_MODEL_DIR, "kokoro-v1.0.onnx")
TTS_VOICES_PATH = os.path.join(TTS_MODEL_DIR, "voices-v1.0.bin")

# Ensure critical directories exist
os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(PREVIEW_CACHE_DIR, exist_ok=True)
os.makedirs(TTS_MODEL_DIR, exist_ok=True)
