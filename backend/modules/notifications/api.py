from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from typing import List

from pydantic import BaseModel
from typing import List, Optional
from db.database import get_db
from models.user import User, UserRole
from core.auth import get_current_user
from models.notification import AppNotification
from socket_manager import sio, emit_to_user

router = APIRouter()

class BroadcastRequest(BaseModel):
    category: str  # 'UPDATE', 'DOWNTIME', 'ANNOUNCEMENT'
    title: str
    message: str
    target_role: Optional[str] = 'all'
    link: Optional[str] = None

@router.post("/broadcast")
async def broadcast_notification(
    payload: BroadcastRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Broadcast a system notification (Soft Updates, Server Downtime Notice, Admin Announcement).
    Restricted to Admins or IT roles only.
    """
    if current_user.role not in (UserRole.admin, UserRole.it):
        raise HTTPException(status_code=403, detail="Only Admins or IT personnel can broadcast system notifications.")

    # Query target users
    if payload.target_role in ('me', 'self'):
        usernames = [current_user.username]
    elif payload.target_role and payload.target_role != 'all':
        stmt = select(User.username).where(User.role == payload.target_role)
        res = await db.execute(stmt)
        usernames = list(res.scalars().all())
    else:
        stmt = select(User.username)
        res = await db.execute(stmt)
        usernames = list(res.scalars().all())

    if not usernames:
        usernames = [current_user.username]

    ref_type = (
        'SYSTEM_UPDATE' if payload.category == 'UPDATE'
        else ('SERVER_DOWNTIME' if payload.category == 'DOWNTIME'
        else 'ADMIN_ANNOUNCEMENT')
    )
    default_link = '/whats-new' if payload.category == 'UPDATE' else payload.link

    # Create notification records
    notifications = [
        AppNotification(
            member_name=u,
            reference_type=ref_type,
            reference_id=payload.category,
            title=payload.title,
            message=payload.message,
            link=default_link
        )
        for u in usernames
    ]

    db.add_all(notifications)
    await db.commit()

    # Emit real-time Socket.IO notification to each recipient
    for u in usernames:
        await emit_to_user(u, 'system_notification', {
            'category': payload.category,
            'title': payload.title,
            'message': payload.message,
            'link': default_link
        })

    return {
        "success": True,
        "recipient_count": len(usernames),
        "message": f"Broadcast sent successfully to {len(usernames)} user(s)."
    }

@router.get("/")
async def get_notifications(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Fetch unread/recent notifications for the current user."""
    try:
        stmt = (
            select(AppNotification)
            .where(AppNotification.member_name == current_user.username)
            .order_by(AppNotification.created_at.desc())
            .limit(50)
        )
        res = await db.execute(stmt)
        notifications = res.scalars().all()
        
        return {
            "success": True, 
            "notifications": [
                {
                    "id": n.id,
                    "reference_type": n.reference_type,
                    "reference_id": n.reference_id,
                    "title": n.title,
                    "message": n.message,
                    "link": n.link,
                    "is_read": n.is_read,
                    "created_at": n.created_at.isoformat()
                } for n in notifications
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/read")
async def mark_notifications_read(
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Mark all notifications as read for the current user."""
    try:
        stmt = (
            select(AppNotification)
            .where(AppNotification.member_name == current_user.username)
            .where(AppNotification.is_read == False)
        )
        res = await db.execute(stmt)
        unread = res.scalars().all()
        
        for notif in unread:
            notif.is_read = True
            
        await db.commit()
        return {"success": True}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test")
async def send_test_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate test notifications for the current user."""
    import json
    try:
        # 1. Schedule Update Notification
        notif1 = AppNotification(
            member_name=current_user.username,
            reference_type='WORK_SCHEDULE',
            reference_id='JOB-TEST-1',
            title="Schedule Update",
            message=f"Status for Job JOB-TEST-1 (UNIT-1) was updated to 'In Progress' by Admin.",
            link="/team-calendar?tab=schedule"
        )
        # 2. Ping Notification
        msg_data = {
            "type": "ping",
            "sender": "Admin User",
            "text": "Can you check this job?"
        }
        notif2 = AppNotification(
            member_name=current_user.username,
            reference_type='WORK_SCHEDULE',
            reference_id='JOB-TEST-2',
            title="Ping: Job Update Needed",
            message=json.dumps(msg_data),
            link="/team-calendar?tab=schedule"
        )
        # 3. Generic Link Notification (e.g. Quotation)
        notif3 = AppNotification(
            member_name=current_user.username,
            reference_type='QUOTATION',
            reference_id='QT-2026-001',
            title="Quotation Approved",
            message="Quotation QT-2026-001 has been approved by management.",
            link="/quotations/QT-2026-001"
        )
        
        db.add_all([notif1, notif2, notif3])
        await db.commit()
        
        await emit_to_user(current_user.username, 'system_notification', {'title': 'Test Batch', 'message': 'You received 3 test notifications!'})
        
        return {"success": True, "message": "Test notifications sent"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{notif_id}/read")
async def mark_single_notification_read(
    notif_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a specific notification as read."""
    try:
        stmt = (
            select(AppNotification)
            .where(AppNotification.id == notif_id)
            .where(AppNotification.member_name == current_user.username)
        )
        res = await db.execute(stmt)
        notif = res.scalars().first()
        
        if notif:
            notif.is_read = True
            await db.commit()
            return {"success": True}
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
        
    raise HTTPException(status_code=404, detail="Notification not found")


@router.delete("/{notif_id}")
async def delete_notification(
    notif_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a specific notification."""
    try:
        stmt = (
            select(AppNotification)
            .where(AppNotification.id == notif_id)
            .where(AppNotification.member_name == current_user.username)
        )
        res = await db.execute(stmt)
        notif = res.scalars().first()
        
        if notif:
            await db.delete(notif)
            await db.commit()
            return {"success": True}
            
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
        
    raise HTTPException(status_code=404, detail="Notification not found")


@router.delete("/")
async def delete_all_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete all notifications for the user."""
    try:
        stmt = (
            delete(AppNotification)
            .where(AppNotification.member_name == current_user.username)
        )
        await db.execute(stmt)
        await db.commit()
        return {"success": True}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
