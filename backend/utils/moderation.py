import re
import time
import logging
from typing import List
from sqlalchemy.future import select
from db.database import AsyncSessionLocal
from models.moderation import BannedWord

logger = logging.getLogger("kmti_backend.moderation")

# Simple in-memory cache for banned words
_cached_banned_words: List[str] = []
_last_cache_update: float = 0.0
CACHE_TTL = 300.0 # 5 minutes

async def get_banned_words_cached() -> List[str]:
    global _cached_banned_words, _last_cache_update
    now = time.time()
    if not _cached_banned_words or (now - _last_cache_update) > CACHE_TTL:
        await refresh_banned_words_cache()
    return _cached_banned_words

async def refresh_banned_words_cache():
    global _cached_banned_words, _last_cache_update
    try:
        async with AsyncSessionLocal() as session:
            stmt = select(BannedWord.word)
            result = await session.execute(stmt)
            words = result.scalars().all()
            _cached_banned_words = [w.lower() for w in words]
            _last_cache_update = time.time()
            logger.info(f"Refreshed banned words cache. Total words: {len(_cached_banned_words)}")
    except Exception as e:
        logger.error(f"Failed to refresh banned words cache: {e}")
        # Ensure we have at least empty list if database table doesn't exist yet
        if not _cached_banned_words:
            _cached_banned_words = []

def censor_text(text: str, banned_words: List[str]) -> str:
    if not text or not banned_words:
        return text

    # Escape each banned word to ensure it's safe for regex
    escaped_words = [re.escape(w) for w in banned_words]
    # Match banned words at boundaries (supporting standard alphanumeric word boundaries)
    # Using \b to prevent matching substring inside longer safe words
    pattern = re.compile(r'\b(' + '|'.join(escaped_words) + r')\b', re.IGNORECASE)

    def replace_match(match):
        word = match.group(0)
        return '*' * len(word)

    return pattern.sub(replace_match, text)
