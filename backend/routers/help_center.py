"""
Help Center router — users submit tickets with screenshots and reply in threads.
Tickets are logged in DB and screenshots stored in backend/storage/feedback.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, delete
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
    category: str = Form("General"),
    urgency: str = Form("low"),
    sys_ram: str = Form(None),
    sys_res: str = Form(None),
    sys_app: str = Form(None),
    screenshots: List[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    """Submit a new help request ticket."""
    paths_str = await _save_screenshots(screenshots)
    now = datetime.now()
    client_ip = request.client.host if request and request.client else None

    new_ticket = Ticket(
        workstation=workstation,
        reporter_name=reporter_name,
        subject=subject,
        category=category,
        urgency=urgency,
        sys_ram=sys_ram,
        sys_res=sys_res,
        sys_app=sys_app,
        has_unread_admin=True, # Notify IT immediately
        has_unread_user=False,
        status="open",
        ip_address=client_ip,
        created_at=now,
        updated_at=now
    )
    db.add(new_ticket)
    await db.flush()
    
    first_msg = TicketMessage(
        ticket_id=new_ticket.id,
        sender_type=UserRole.user,  # Context is always 'user' for new tickets
        sender_name=reporter_name or "Workstation User",
        message=message,
        screenshot_paths=paths_str,
        is_internal=False,
        created_at=now
    )
    db.add(first_msg)
    await db.commit()
    
    return {"status": "success", "ticket_id": new_ticket.id}


@router.get("/tickets")
async def get_tickets(
    workstation: str = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    """Retrieve tickets. IT/Admin get all by default. Users get theirs by IP isolation."""
    stmt = select(Ticket).order_by(Ticket.updated_at.desc())
    client_ip = request.client.host if request and request.client else None
    
    # Restrict users so they only see tickets created from their specific IP
    if current_user.role == UserRole.user:
        # Priority 1: IP isolation for the shared account
        if client_ip:
            stmt = stmt.where(Ticket.ip_address == client_ip)
        else:
            # Fallback to workstation if IP is unavailable (unlikely in production)
            if not workstation:
                raise HTTPException(status_code=400, detail="Workstation name or IP required for users.")
            stmt = stmt.where(Ticket.workstation == workstation)
    else:
        # IT/Admin filtering - allow global view but optional IP drilldown
        if workstation:
            stmt = stmt.where(Ticket.workstation == workstation)
        if client_ip and current_user.role not in [UserRole.it, UserRole.admin]:
            # This branch handles any other non-user roles if they exist
            stmt = stmt.where(Ticket.ip_address == client_ip)

    result = await db.execute(stmt)
    tickets = result.scalars().all()
    return tickets


@router.get("/tickets/unread_count")
async def get_unread_count(
    workstation: str = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    """Get the number of tickets with unread messages for a given context."""
    client_ip = request.client.host if request and request.client else None

    if current_user.role == UserRole.user:
        if client_ip:
            stmt = select(func.count(Ticket.id)).where(Ticket.ip_address == client_ip, Ticket.has_unread_user == True, Ticket.status != 'resolved')
        else:
            if not workstation:
                raise HTTPException(status_code=400, detail="Workstation name or IP required for users.")
            stmt = select(func.count(Ticket.id)).where(Ticket.workstation == workstation, Ticket.has_unread_user == True, Ticket.status != 'resolved')
    else:
        # Admins want the total unread messages explicitly waiting for IT
        stmt = select(func.count(Ticket.id)).where(Ticket.has_unread_admin == True, Ticket.status != 'resolved')

    result = await db.execute(stmt)
    count = result.scalar() or 0
    return {"unread_count": count}


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
        
    # Mark as read
    if current_user.role == UserRole.user:
        if ticket.has_unread_user:
            ticket.has_unread_user = False
            await db.commit()
    else:
        if ticket.has_unread_admin:
            ticket.has_unread_admin = False
            await db.commit()
            
    # Filter internal notes if user
    if current_user.role == UserRole.user:
        ticket.messages = [m for m in ticket.messages if not m.is_internal]

    return ticket


@router.post("/tickets/{ticket_id}/reply")
async def reply_to_ticket(
    ticket_id: int,
    message: str = Form(...),
    sender_name: str = Form(None),
    is_internal: str = Form("false"),
    is_support: str = Form("false"),  # New flag to distinguish context
    screenshots: List[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Add a new message to a ticket thread."""
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    paths_str = await _save_screenshots(screenshots)
    
    final_sender_name = sender_name
    if not final_sender_name:
        final_sender_name = "IT Support" if current_user.role in [UserRole.it, UserRole.admin] else "Workstation User"

    now = datetime.now()
    b_is_internal = is_internal.lower() == "true"
    b_is_support = is_support.lower() == "true"
    
    # Context-aware sender type: 
    # If sent from Admin Center (is_support=true), use user's actual role.
    # Otherwise treat as a reporter message (user).
    final_sender_type = current_user.role if b_is_support else UserRole.user

    new_msg = TicketMessage(
        ticket_id=ticket.id,
        sender_type=final_sender_type,
        sender_name=final_sender_name,
        message=message,
        screenshot_paths=paths_str,
        is_internal=b_is_internal,
        created_at=now
    )
    db.add(new_msg)
    
    # Update ticket timestamps and read states
    ticket.updated_at = now
    
    if current_user.role == UserRole.user:
        ticket.has_unread_admin = True
        if ticket.status != "open":
            ticket.status = "open"
    else:
        # IT replies - notify user (unless it's an internal whisper)
        if not b_is_internal:
            ticket.has_unread_user = True

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
    ticket.updated_at = datetime.now()
    await db.commit()
    return {"status": "success", "ticket_id": ticket_id}

@router.delete("/tickets/{ticket_id}")
async def delete_ticket(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.it, UserRole.admin])),
):
    """Delete a ticket and its messages."""
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    await db.execute(delete(TicketMessage).where(TicketMessage.ticket_id == ticket_id))
    await db.delete(ticket)
    await db.commit()
    return {"status": "success", "ticket_id": ticket_id}
