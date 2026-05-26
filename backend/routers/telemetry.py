from fastapi import APIRouter, Depends, Request, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from db.database import get_db, engine
from models.telemetry import WorkstationStatus
from datetime import datetime, timedelta

router = APIRouter()

# In-memory dictionary to queue update nudges for specific workstations
pending_nudges = {}  # key: computer_name or ip_address -> latest_version

# In-memory dictionary to queue real-time waved pings for specific workstations
# key: target computer_name (or IP) -> list of sender names/PC names
pending_waves = {}

@router.post("/heartbeat")
async def heartbeat(
    request: Request,
    module: str = Form("idle"),
    user_name: str = Form(None),
    version: str = Form(None),
    computer_name: str = Form(None),
    status_message: str = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """Update current workstation status and retrieve queued nudges/waves."""
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
    status.status_message = status_message
    status.last_ping = datetime.now()
    
    await db.commit()

    # Check if there is a pending update nudge for this client
    nudge_version = None
    if computer_name and computer_name in pending_nudges:
        nudge_version = pending_nudges.pop(computer_name)
    elif ip in pending_nudges:
        nudge_version = pending_nudges.pop(ip)

    # Check if there are real-time waved pings for this client
    waves = []
    if computer_name and computer_name in pending_waves:
        waves = pending_waves.pop(computer_name)
    elif ip in pending_waves:
        waves = pending_waves.pop(ip)

    response_data = {"success": True}
    if nudge_version:
        response_data["nudge_version"] = nudge_version
    if waves:
        response_data["waves"] = waves

    return response_data

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
                "status_message": s.status_message,
                "last_ping": s.last_ping.isoformat() if s.last_ping else None,
            }
            for s in statuses
        ]
    }

@router.post("/nudge")
async def nudge_workstation(
    computer_name: str = Form(...),
    latest_version: str = Form(...)
):
    """Queue a silent update nudge for a workstation."""
    pending_nudges[computer_name] = latest_version
    return {"success": True, "message": f"Nudge queued for {computer_name}"}

@router.post("/wave")
async def wave_workstation(
    from_computer: str = Form(...),
    to_computer: str = Form(...)
):
    """Queue a real-time wave/ping from one workstation to another."""
    target = to_computer.strip()
    sender = from_computer.strip()
    
    if target not in pending_waves:
        pending_waves[target] = []
    
    # Avoid duplicate waves stacking up
    if sender not in pending_waves[target]:
        pending_waves[target].append(sender)
        
    return {"success": True, "message": f"Wave queued for {target} from {sender}"}
