from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel

from db.database import get_db
from models.user import User, UserRole
from models.moderation import BannedWord
from core.auth import get_current_user
from utils.moderation import refresh_banned_words_cache

router = APIRouter()

class BannedWordCreate(BaseModel):
    word: str

@router.get("/words")
async def get_banned_words(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only IT, Admin, Team Leader can manage content moderation
    if current_user.role not in [UserRole.it, UserRole.admin, UserRole.team_leader]:
        raise HTTPException(status_code=403, detail="Not authorized to manage content moderation")

    stmt = select(BannedWord).order_by(BannedWord.word)
    result = await db.execute(stmt)
    words = result.scalars().all()
    return [{
        "id": w.id,
        "word": w.word,
        "added_by": w.added_by,
        "created_at": w.created_at.isoformat() if w.created_at else None
    } for w in words]

@router.post("/words")
async def add_banned_word(
    data: BannedWordCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.it, UserRole.admin, UserRole.team_leader]:
        raise HTTPException(status_code=403, detail="Not authorized to manage content moderation")

    clean_word = data.word.strip().lower()
    if not clean_word:
        raise HTTPException(status_code=400, detail="Banned word cannot be empty")

    # Prevent duplicate records
    stmt = select(BannedWord).where(BannedWord.word == clean_word)
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Word is already on the banned list")

    new_word = BannedWord(
        word=clean_word,
        added_by=current_user.username
    )
    db.add(new_word)
    await db.commit()
    await db.refresh(new_word)

    # Immediately sync cache
    await refresh_banned_words_cache()

    return {
        "success": True,
        "id": new_word.id,
        "word": new_word.word,
        "added_by": new_word.added_by
    }

@router.delete("/words/{word_id}")
async def remove_banned_word(
    word_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.it, UserRole.admin, UserRole.team_leader]:
        raise HTTPException(status_code=403, detail="Not authorized to manage content moderation")

    stmt = select(BannedWord).where(BannedWord.id == word_id)
    res = await db.execute(stmt)
    target = res.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Banned word not found")

    await db.delete(target)
    await db.commit()

    # Immediately sync cache
    await refresh_banned_words_cache()

    return {"success": True}
