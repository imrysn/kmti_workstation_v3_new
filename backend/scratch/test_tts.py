import asyncio
import os
import sys

# Add backend to sys.path to allow imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.tts_engine import tts_engine

async def test_tts():
    print("Testing Japanese TTS generation...")
    text = "（内側寸法）をご確認ください。エキスパンドメタルは黒色塗装のこと。"
    try:
        audio_data = await tts_engine.generate_audio(text, voice="jf_alpha", speed=1.0)
        output_file = os.path.join(os.path.dirname(__file__), "test_speech.wav")
        with open(output_file, "wb") as f:
            f.write(audio_data)
        print(f"SUCCESS: Generated WAV file at {output_file}")
        print(f"File size: {len(audio_data)} bytes")
    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(test_tts())
