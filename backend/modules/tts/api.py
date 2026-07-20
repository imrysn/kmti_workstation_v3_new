from fastapi import APIRouter, HTTPException, Response, Query
from fastapi.responses import StreamingResponse
import io
from services.tts_engine import tts_engine

router = APIRouter()

@router.get("/generate")
@router.post("/generate")
async def generate_tts(
    text: str, 
    voice: str = "af_heart", 
    speed: float = 1.0
):
    """
    Generates TTS audio and returns it as a WAV stream.
    Supports both GET (for simple integration) and POST (for long texts).
    """
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    try:
        audio_data = await tts_engine.generate_audio(text, voice, speed)
        
        return Response(
            content=audio_data, 
            media_type="audio/wav",
            headers={
                "Content-Disposition": 'attachment; filename="speech.wav"',
                "Cache-Control": "max-age=3600"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS Generation failed: {str(e)}")
