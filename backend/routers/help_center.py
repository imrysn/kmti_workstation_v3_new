"""
Help Center router — users submit tickets with screenshots and reply in threads.
Tickets are logged in DB and screenshots stored in backend/storage/feedback.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
import os
import uuid
import shutil
from datetime import datetime

from db.database import get_db
from models.user import User, UserRole, Ticket, TicketMessage
from core.auth import get_current_user, require_role

router = APIRouter()

# NAS Storage Path for network accessibility
STORAGE_DIR = r"\\KMTI-NAS\Shared\data\storage\feedback"
os.makedirs(STORAGE_DIR, exist_ok=True)

async def _save_screenshots(screenshots: List[UploadFile]) -> Optional[str]:
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
            saved_paths.append(f"/storage/feedback/{filename}")
    return ",".join(saved_paths) if saved_paths else None


@router.post("/tickets")
async def create_ticket(
    subject: str = Form(...),
    message: str = Form(...),
    workstation: str = Form(...),
    reporter_name: str = Form(None),
    screenshots: List[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit a new help request ticket."""
    paths_str = await _save_screenshots(screenshots)

    new_ticket = Ticket(
        workstation=workstation,
        reporter_name=reporter_name,
        subject=subject,
        status="open"
    )
    db.add(new_ticket)
    await db.flush()  # needed to get new_ticket.id
    
    first_msg = TicketMessage(
        ticket_id=new_ticket.id,
        sender_type=current_user.role,
        sender_name=reporter_name or "Workstation User",
        message=message,
        screenshot_paths=paths_str
    )
    db.add(first_msg)
    await db.commit()
    
    return {"status": "success", "ticket_id": new_ticket.id}


@router.get("/tickets")
async def get_tickets(
    workstation: str = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve tickets. IT/Admin get all by default. Users get theirs by workstation."""
    stmt = select(Ticket).order_by(Ticket.updated_at.desc())
    
    # Restrict users so they only see their workstation's tickets
    if current_user.role == UserRole.user:
        if not workstation:
            raise HTTPException(status_code=400, detail="Workstation name required for users.")
        stmt = stmt.where(Ticket.workstation == workstation)
    else:
        # IT/Admin filtering by workstation optionally
        if workstation:
            stmt = stmt.where(Ticket.workstation == workstation)

    result = await db.execute(stmt)
    tickets = result.scalars().all()
    return tickets


@router.get("/tickets/{ticket_id}")
async def get_ticket_details(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get ticket + thread messages."""
    stmt = select(Ticket).options(selectinload(Ticket.messages)).where(Ticket.id == ticket_id)
    result = await db.execute(stmt)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    return ticket


@router.post("/tickets/{ticket_id}/reply")
async def reply_to_ticket(
    ticket_id: int,
    message: str = Form(...),
    sender_name: str = Form(None),
    screenshots: List[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a new message to a ticket thread."""
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    paths_str = await _save_screenshots(screenshots)
    
    # Auto-resolve sender name
    final_sender_name = sender_name
    if not final_sender_name:
        final_sender_name = "IT Support" if current_user.role in [UserRole.it, UserRole.admin] else "Workstation User"

    new_msg = TicketMessage(
        ticket_id=ticket.id,
        sender_type=current_user.role,
        sender_name=final_sender_name,
        message=message,
        screenshot_paths=paths_str
    )
    db.add(new_msg)
    
    # Reopen ticket if a user replies
    if current_user.role == UserRole.user and ticket.status != "open":
        ticket.status = "open"
        
    await db.commit()
    return {"status": "success"}


class StatusUpdate(BaseModel):
    status: str

@router.patch("/tickets/{ticket_id}/status")
async def update_ticket_status(
    ticket_id: int,
    update_data: StatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.it, UserRole.admin])),
):
    """Mark ticket as resolved, open, etc."""
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    ticket.status = update_data.status
    await db.commit()
    return {"status": "success", "ticket_id": ticket_id}
