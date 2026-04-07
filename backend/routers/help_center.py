"""
Help Center router — users submit feedback with screenshots.
Feedback is logged in DB and screenshots stored in backend/storage/feedback.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
import os
import uuid
import shutil
from datetime import datetime

from db.database import get_db
from models.user import User, UserRole, Feedback
from core.auth import get_current_user, require_role

router = APIRouter()

# NAS Storage Path for network accessibility
STORAGE_DIR = r"\\KMTI-NAS\Shared\data\storage\feedback"
os.makedirs(STORAGE_DIR, exist_ok=True)

@router.post("/submit")
async def submit_feedback(
    message: str = Form(...),
    workstation: str = Form(...),
    screenshots: List[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit a help request with up to 3 optional screenshots."""
    saved_paths = []
    
    if screenshots:
        for screenshot in screenshots:
            if not screenshot.filename:
                continue
                
            ext = os.path.splitext(screenshot.filename)[1]
            filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex}{ext}"
            save_path = os.path.join(STORAGE_DIR, filename)
            
            with open(save_path, "wb") as buffer:
                shutil.copyfileobj(screenshot.file, buffer)
            
            # Collect path for DB
            saved_paths.append(f"/storage/feedback/{filename}")

    screenshot_paths_str = ",".join(saved_paths) if saved_paths else None

    new_feedback = Feedback(
        user_id=current_user.id,
        workstation=workstation,
        message=message,
        screenshot_path=screenshot_paths_str,
        status="open"
    )
    
    db.add(new_feedback)
    await db.commit()
    await db.refresh(new_feedback)
    
    return {"status": "success", "id": new_feedback.id}

@router.get("/logs")
async def get_feedback_logs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.it, UserRole.admin])),
):
    """Retrieve all feedback logs. IT/Admin only."""
    result = await db.execute(select(Feedback).order_by(Feedback.created_at.desc()))
    logs = result.scalars().all()
    return logs

@router.patch("/{feedback_id}/resolve")
async def resolve_feedback(
    feedback_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.it, UserRole.admin])),
):
    """Mark feedback as resolved."""
    result = await db.execute(select(Feedback).where(Feedback.id == feedback_id))
    feedback = result.scalar_one_or_none()
    
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
        
    feedback.status = "resolved"
    await db.commit()
    return {"status": "success", "id": feedback_id}
