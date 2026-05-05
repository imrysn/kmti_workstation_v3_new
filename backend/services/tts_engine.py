import os
import io
import wave
import logging
from kokoro_onnx import Kokoro
from core.config import TTS_MODEL_PATH, TTS_VOICES_PATH

logger = logging.getLogger("kmti_backend.tts")

class TTSEngine:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(TTSEngine, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        
        self.kokoro = None
        self._initialized = True
        self.initialize_model()

    def initialize_model(self):
        """Lazy load the Kokoro model to save startup time if not used."""
        if self.kokoro:
            return

        if not os.path.exists(TTS_MODEL_PATH) or not os.path.exists(TTS_VOICES_PATH):
            logger.warning(f"TTS Model files not found at {TTS_MODEL_PATH}. Local synthesis disabled.")
            return

        try:
            logger.info(f"Initializing Kokoro TTS with model: {TTS_MODEL_PATH}")
            self.kokoro = Kokoro(TTS_MODEL_PATH, TTS_VOICES_PATH)
            logger.info("Kokoro TTS initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize Kokoro TTS: {e}")

    async def generate_audio(self, text: str, voice: str = "af_heart", speed: float = 1.0):
        """
        Generates a WAV byte stream from text with disk caching.
        """
        if not self.kokoro:
            self.initialize_model()
            if not self.kokoro:
                raise Exception("TTS Engine not available")

        # Caching logic: NAS (Shared) -> Local -> Generate
        import hashlib
        cache_key = hashlib.md5(f"{text}_{voice}_{speed}".encode()).hexdigest()
        from core.config import NAS_TTS_CACHE_DIR
        
        local_cache_dir = os.path.join(os.path.dirname(TTS_MODEL_PATH), ".cache")
        os.makedirs(local_cache_dir, exist_ok=True)
        local_cache_path = os.path.join(local_cache_dir, f"{cache_key}.wav")
        nas_cache_path = os.path.join(NAS_TTS_CACHE_DIR, f"{cache_key}.wav")

        # 1. Check NAS (Shared Cache)
        try:
            if os.path.exists(nas_cache_path):
                logger.info(f"Serving TTS from NAS cache: {cache_key}")
                with open(nas_cache_path, "rb") as f:
                    return f.read()
        except Exception as e:
            logger.warning(f"NAS cache unreachable: {e}")

        # 2. Check Local (Failover Cache)
        if os.path.exists(local_cache_path):
            logger.info(f"Serving TTS from local cache: {cache_key}")
            with open(local_cache_path, "rb") as f:
                return f.read()

        try:
            # Drafting symbol mapping for Japanese context
            SYMBOL_MAP = {
                "φ": "ファイ",
                "□": "カク",
                "×": "カケル",
                "～": "カラ",
                "…": " ",
                "・": " ",
                "※": "こめ",
                "*": " ",
                "（": " ",
                "）": " ",
                "(": " ",
                ")": " ",
                "【": " ",
                "】": " ",
                "[": " ",
                "]": " ",
            }
            
            # Clean text: remove symbols that might confuse the phonemizer
            cleaned_text = text
            for sym, rep in SYMBOL_MAP.items():
                cleaned_text = cleaned_text.replace(sym, rep)
            
            # Remove any remaining multiple spaces
            import re
            cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()
            
            # Map voices to languages
            lang = "ja" if voice.startswith("j") else "en-us"
            
            logger.info(f"Generating TTS for [{lang}]: {cleaned_text[:50]}...")
            
            if not cleaned_text:
                 raise Exception("Cleaned text is empty")
            samples, sample_rate = self.kokoro.create(
                cleaned_text, 
                voice=voice, 
                speed=speed, 
                lang=lang
            )

            # Convert float32 samples to int16 WAV
            import numpy as np
            samples = (samples * 32767).astype(np.int16)

            buffer = io.BytesIO()
            with wave.open(buffer, "wb") as wav_file:
                wav_file.setnchannels(1)  # Mono
                wav_file.setsampwidth(2)  # 16-bit
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(samples.tobytes())

            audio_data = buffer.getvalue()
            
            # Save to caches
            try:
                if not os.path.exists(NAS_TTS_CACHE_DIR):
                    os.makedirs(NAS_TTS_CACHE_DIR, exist_ok=True)
                with open(nas_cache_path, "wb") as f:
                    f.write(audio_data)
                logger.info(f"Saved TTS to NAS cache: {cache_key}")
            except Exception as e:
                logger.warning(f"Failed to save to NAS cache: {e}")

            try:
                with open(local_cache_path, "wb") as f:
                    f.write(audio_data)
            except Exception as e:
                logger.warning(f"Failed to save to local cache: {e}")
                
            return audio_data
        except Exception as e:
            logger.error(f"Error during TTS generation: {e}")
            raise

tts_engine = TTSEngine()
