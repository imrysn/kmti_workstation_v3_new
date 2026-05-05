from fastapi import APIRouter, Depends, Request, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from db.database import get_db, engine
from models.telemetry import WorkstationStatus
from datetime import datetime, timedelta

router = APIRouter()

@router.post("/heartbeat")
async def heartbeat(
    request: Request,
    module: str = Form("idle"),
    user_name: str = Form(None),
    version: str = Form(None),
    computer_name: str = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """Update current workstation status."""
    ip = request.client.host
    
    # Implementation-agnostic upsert (simpler approach for multi-DB support)
    result = await db.execute(select(WorkstationStatus).where(WorkstationStatus.ip_address == ip))
    status = result.scalar_one_or_none()
    
    if not status:
        status = WorkstationStatus(ip_address=ip)
        db.add(status)
    
    status.active_module = module
    status.current_user = user_name
    status.version = version
    status.computer_name = computer_name
    status.last_ping = datetime.now()
    
    await db.commit()
    return {"success": True}

@router.get("/status")
async def get_all_status(db: AsyncSession = Depends(get_db)):
    """Retrieve list of all workstations seen in the last 5 minutes."""
    five_mins_ago = datetime.now() - timedelta(minutes=5)
    result = await db.execute(
        select(WorkstationStatus)
        .where(WorkstationStatus.last_ping >= five_mins_ago)
        .order_by(WorkstationStatus.last_ping.desc())
    )
    statuses = result.scalars().all()
    return {
        "data": [
            {
                "ip_address": s.ip_address,
                "computer_name": s.computer_name or s.ip_address,
                "current_user": s.current_user,
                "active_module": s.active_module,
                "version": s.version,
                "last_ping": s.last_ping.isoformat() if s.last_ping else None,
            }
            for s in statuses
        ]
    }
