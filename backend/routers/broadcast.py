from fastapi import APIRouter, Depends, HTTPException, Request, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from db.database import get_db
from models.broadcast import WorkstationBroadcast
from models.user import User, UserRole
from core.auth import get_current_user, require_role
from datetime import datetime

router = APIRouter()

@router.get("/")
async def list_broadcasts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.it, UserRole.admin]))
):
    """List all recent broadcasts. Admin/IT only."""
    result = await db.execute(
        select(WorkstationBroadcast)
        .order_by(WorkstationBroadcast.created_at.desc())
        .limit(50)
    )
    broadcasts = result.scalars().all()
    return {"data": broadcasts}

@router.get("/active")
async def get_active_broadcast(db: AsyncSession = Depends(get_db)):
    """Retrieve the most recent active broadcast."""
    now = datetime.now()
    result = await db.execute(
        select(WorkstationBroadcast)
        .where((WorkstationBroadcast.expires_at == None) | (WorkstationBroadcast.expires_at > now))
        .order_by(WorkstationBroadcast.created_at.desc())
        .limit(1)
    )
    broadcast = result.scalar_one_or_none()
    return {"data": broadcast}

@router.post("/")
async def create_broadcast(
    message: str = Form(...),
    severity: str = Form("info"),
    duration_minutes: int = Form(60),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.it, UserRole.admin]))
):
    """Create a new global broadcast message. Admin/IT only."""
    expires_at = None
    if duration_minutes > 0:
        from datetime import timedelta
        expires_at = datetime.now() + timedelta(minutes=duration_minutes)

    new_broadcast = WorkstationBroadcast(
        message=message,
        severity=severity,
        created_by=current_user.username,
        expires_at=expires_at
    )
    
    db.add(new_broadcast)
    await db.commit()
    await db.refresh(new_broadcast)
    
    return {"data": new_broadcast}

@router.delete("/{broadcast_id}")
async def delete_broadcast(
    broadcast_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.it, UserRole.admin]))
):
    """Retire/Delete a broadcast immediately. Admin/IT only."""
    result = await db.execute(select(WorkstationBroadcast).where(WorkstationBroadcast.id == broadcast_id))
    broadcast = result.scalar_one_or_none()
    
    if not broadcast:
        raise HTTPException(status_code=404, detail="Broadcast not found")
        
    await db.delete(broadcast)
    await db.commit()
    
    return {"success": True}

@router.post("/{broadcast_id}/acknowledge")
async def acknowledge_broadcast(
    broadcast_id: int,
    workstation: str = Form("Unknown"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Record that a specific user/workstation has acknowledged a broadcast."""
    from models.broadcast import BroadcastAcknowledgment
    from routers.quotations import sio
    
    ack = BroadcastAcknowledgment(
        broadcast_id=broadcast_id,
        username=current_user.username,
        workstation=workstation
    )
    db.add(ack)
    await db.commit()

    # Emit socket event for real-time admin alert
    try:
        await sio.emit("broadcast_acknowledged", {
            "id": broadcast_id,
            "username": current_user.username,
            "workstation": workstation,
            "time": datetime.now().strftime("%H:%M:%S")
        })
    except: pass
    
    return {"success": True}

@router.get("/{broadcast_id}/acks")
async def get_broadcast_acks(
    broadcast_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.it, UserRole.admin]))
):
    """List all acknowledgments for a specific broadcast. Admin/IT only."""
    from models.broadcast import BroadcastAcknowledgment
    result = await db.execute(
        select(BroadcastAcknowledgment)
        .where(BroadcastAcknowledgment.broadcast_id == broadcast_id)
        .order_by(BroadcastAcknowledgment.acknowledged_at.desc())
    )
    acks = result.scalars().all()
    return {"data": acks}
