r"""
Quotations Router v2 (Database-First)
─────────────────────────────────────────────────────────────────
Handles centralized quotation management using MySQL:
  - Persistent storage in 'quotations' table.
  - Version history in 'quotation_history' table.
  - Real-time collaborative editing via Socket.IO.
  - Automatic session recovery on server restart.

File Persistence Policy:
  - The database is the primary source of truth.
  - Backups to NAS can be triggered periodically (configurable).
"""

import os
import json
import asyncio
from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, desc, or_
from sqlalchemy.orm import selectinload

import socketio
from db.database import get_db
from models.quotation import Quotation, QuotationHistory

# ─── Socket.IO Server ─────────────────────────────────────────────────────────
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
socket_app = socketio.ASGIApp(sio)

# Tracks connected users per document room: { quotation_id -> { sid -> { name, color } } }
# Room metadata is now persisted in the DB (is_active, password, display_name)
_active_users: dict[int, dict[str, dict]] = {}

def _random_color() -> str:
    import random
    colors = [
        "#4A90D9", "#E05C6B", "#27AE60", "#F39C12",
        "#8E44AD", "#16A085", "#E67E22", "#2980B9",
        "#C0392B", "#2ECC71",
    ]
    return random.choice(colors)

def _get_audit_label(path: str, full_state: dict = None) -> str:
    """Map a technical JSON path to a human-readable field name."""
    if not path: return "Document"
    p = path.lower()
    field = path.split('.')[-1].replace('_', ' ').title()
    
    if "companyinfo" in p: return f"Company {field}"
    if "clientinfo" in p: return f"Client {field}"
    if "quotationdetails" in p: return f"Quotation {field.replace('No', '#')}"
    if "billingdetails" in p: return f"Billing {field}"
    
    if "task" in p:
        parts = path.split('.')
        if len(parts) >= 2:
            task_id_str = parts[1]
            assembly_name = f"Task #{task_id_str}"
            if full_state and "tasks" in full_state:
                try:
                    target_id = int(task_id_str)
                    for t in full_state["tasks"]:
                        if t.get("id") == target_id:
                            assembly_name = f"'{t.get('description', 'Unnamed Task')}'"
                            break
                except: pass
            return f"{assembly_name}'s {field}"
        return "Tasks"
    if "signatures" in p: return "Signatures"
    if "footer" in p: return f"Footer {field}"
    return path

# ─── Socket.IO Event Handlers ──────────────────────────────────────────────────

@sio.event
async def connect(sid: str, environ: dict):
    print(f"[Socket] Client connected: {sid}")


@sio.event
async def join_doc(sid: str, data: dict):
    """Join a shared quotation room. data = { quot_id, user_name, password? }"""
    q_id = data.get("quot_id")
    user_name = data.get("user_name", "Unknown")
    password = data.get("password")
    
    if not q_id: return

    # Verify ID and password in DB
    from db.database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        stmt = select(Quotation).where(Quotation.id == q_id)
        result = await session.execute(stmt)
        quot = result.scalar_one_or_none()
        
        if not quot:
            await sio.emit("join_error", {"message": "Quotation not found."}, to=sid)
            return
        
        if quot.password and quot.password != password:
            await sio.emit("join_error", {"message": "Invalid password."}, to=sid)
            return

        # Explicitly mark as active in DB if first user joins
        if not quot.is_active:
            quot.is_active = True
            await session.commit()

    color = _random_color()
    room_name = f"quot_{q_id}"
    await sio.enter_room(sid, room_name)

    if q_id not in _active_users:
        _active_users[q_id] = {}

    # Evict any stale entry for the same user name (case-insensitive) before adding the new one.
    stale_sids = [
        s for s, u in _active_users[q_id].items()
        if u.get("name", "").lower() == user_name.lower() and s != sid
    ]
    for stale_sid in stale_sids:
        del _active_users[q_id][stale_sid]
        # Important: Send the updated users dict so others purge the old sid correctly
        await sio.emit("user_left", {"sid": stale_sid, "users": _active_users[q_id]}, room=room_name)

    _active_users[q_id][sid] = {"name": user_name, "color": color}
    
    # Broadcast join
    await sio.emit("joined", {"sid": sid, "color": color, "users": _active_users[q_id]}, to=sid)
    await sio.emit("user_joined", {"sid": sid, "name": user_name, "color": color, "users": _active_users[q_id]}, room=room_name, skip_sid=sid)

@sio.event
async def update_field(sid: str, data: dict):
    """Partial state update. Persists to DB after debounced broadcast."""
    q_id = data.get("quot_id")
    patch = data.get("patch")
    full_state = data.get("full_state") # Optional optimized save
    
    if not q_id or not patch: return
    room_name = f"quot_{q_id}"

    # 1. Immediate Broadcast to other editors
    await sio.emit("remote_patch", {"sid": sid, "patch": patch}, room=room_name, skip_sid=sid)
    
    # 2. Persist to DB (Debounced logic could be added here, but for now direct)
    if full_state:
        from db.database import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            await session.execute(
                update(Quotation)
                .where(Quotation.id == q_id)
                .values(data=json.dumps(full_state, ensure_ascii=False), updated_at=datetime.utcnow())
            )
            await session.commit()

@sio.event
async def trigger_snapshot(sid: str, data: dict):
    """Explicitly create a history version in DB."""
    q_id = data.get("quot_id")
    full_state = data.get("full_state")
    label = data.get("label")
    
    if not q_id or not full_state: return
    
    user_info = _active_users.get(q_id, {}).get(sid, {})
    author = user_info.get("name", "System")

    from db.database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        history = QuotationHistory(
            quotation_id=q_id,
            label=label or "Manual Save",
            author=author,
            data=json.dumps(full_state, ensure_ascii=False)
        )
        session.add(history)
        await session.commit()
    
    await sio.emit("history_updated", {"quot_id": q_id}, room=f"quot_{q_id}")

@sio.event
async def focus_field(sid: str, data: dict):
    q_id = data.get("quot_id")
    if not q_id: return
    user_info = _active_users.get(q_id, {}).get(sid, {})
    await sio.emit("remote_focus", {
        **data, 
        "name": user_info.get("name", "Unknown"),
        "color": user_info.get("color", "#ccc")
    }, room=f"quot_{q_id}", skip_sid=sid)

@sio.event
async def blur_field(sid: str, data: dict):
    q_id = data.get("quot_id")
    await sio.emit("remote_blur", data, room=f"quot_{q_id}", skip_sid=sid)

@sio.event
async def disconnect(sid: str):
    """Cleanup presence on socket disconnect."""
    for q_id, users in list(_active_users.items()):
        if sid in users:
            user_info = users.pop(sid)
            room_name = f"quot_{q_id}"
            
            # Broadcast to others in the room
            await sio.emit(
                "user_left",
                {"sid": sid, "name": user_info.get("name", "Unknown"), "users": users},
                room=room_name,
            )
            
            # If last user left, cleanup in-memory presence
            if not users:
                if q_id in _active_users:
                    del _active_users[q_id]
            break
    print(f"[Socket] Client disconnected: {sid}")

@sio.event
async def leave_doc(sid: str, data: dict):
    """Explicitly leave a room."""
    q_id = data.get("quot_id")
    if not q_id: return
    
    if q_id in _active_users and sid in _active_users[q_id]:
        user_info = _active_users[q_id].pop(sid)
        room_name = f"quot_{q_id}"
        await sio.leave_room(sid, room_name)
        
        # Broadcast to others in the room
        await sio.emit(
            "user_left",
            {"sid": sid, "name": user_info.get("name", "Unknown"), "users": _active_users.get(q_id, {})},
            room=room_name,
        )
        
        if not _active_users.get(q_id):
            if q_id in _active_users:
                del _active_users[q_id]
            from db.database import AsyncSessionLocal
            async with AsyncSessionLocal() as session:
                await session.execute(
                    update(Quotation).where(Quotation.id == q_id).values(is_active=False)
                )
                await session.commit()

@sio.event
async def focus_selection(sid: str, data: dict):
    q_id = data.get("quot_id")
    await sio.emit("remote_selection", data, room=f"quot_{q_id}", skip_sid=sid)

# ─── REST API ───────────────────────────────────────────────────────────────

router = APIRouter()

@router.get("/")
async def list_quotations(
    q: Optional[str] = None, 
    designer: Optional[str] = None,
    limit: int = 100, 
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """List quotations from DB with filtering."""
    stmt = select(Quotation).order_by(desc(Quotation.updated_at))
    
    if q:
        stmt = stmt.where(or_(
            Quotation.quotation_no.ilike(f"%{q}%"),
            Quotation.client_name.ilike(f"%{q}%")
        ))
    if designer:
        stmt = stmt.where(Quotation.designer_name.ilike(f"%{designer}%"))
    
    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    items = result.scalars().all()
    
    return {
        "quotations": [
            {
                "id": i.id,
                "quotationNo": i.quotation_no,
                "clientName": i.client_name,
                "designerName": i.designer_name,
                "date": i.date.strftime("%Y-%m-%d"),
                "modifiedAt": i.updated_at.isoformat(),
                "isActive": i.is_active,
                "hasPassword": bool(i.password),
                "displayName": i.display_name or i.quotation_no
            } for i in items
        ]
    }

@router.get("/sessions")
async def list_active_sessions(db: AsyncSession = Depends(get_db)):
    """Returns list of quotations that have at least one connected user.
    
    The DB 'is_active' flag can get stale after server restarts (in-memory
    _active_users is cleared but DB isn't updated). We cross-reference both:
    only return sessions that appear in _active_users with >= 1 connected user.
    As a side-effect, stale DB flags are cleaned up.
    """
    # Get all IDs that have real connected users right now
    live_ids = [q_id for q_id, users in _active_users.items() if len(users) > 0]

    if not live_ids:
        # Clean up any stale is_active flags in DB
        await db.execute(update(Quotation).values(is_active=False))
        await db.commit()
        return {"sessions": []}

    stmt = select(Quotation).where(Quotation.id.in_(live_ids)).order_by(desc(Quotation.updated_at))
    result = await db.execute(stmt)
    items = result.scalars().all()

    # Also clean up any stale is_active records not in live_ids
    await db.execute(
        update(Quotation)
        .where(Quotation.is_active == True)
        .where(~Quotation.id.in_(live_ids))
        .values(is_active=False)
    )
    await db.commit()

    sessions = []
    for i in items:
        users = _active_users.get(i.id, {})
        sessions.append({
            "id": i.id,
            "quotNo": i.quotation_no,
            "displayName": i.display_name or i.quotation_no,
            "userCount": len(users),
            "users": list(users.values()),
            "hasPassword": bool(i.password)
        })
    return {"sessions": sessions}

@router.post("/")
async def create_quotation(data: dict, db: AsyncSession = Depends(get_db)):
    """Create a new quotation record in the database.
    
    Supports two modes:
      Lightweight:  { quot_no, display_name?, password? }  — workspace-first creation
      Full:         { quotationDetails, clientInfo, ... }  — save from within editor
    """
    # ── Lightweight workspace-first creation ──────────────────────
    if "quot_no" in data:
        q_no = data["quot_no"]
        display = data.get("display_name") or q_no
        password = data.get("password")
        
        # Check for duplicate
        stmt = select(Quotation).where(Quotation.quotation_no == q_no)
        res = await db.execute(stmt)
        if res.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Quotation number already exists")
        
        # Create a blank record — document data will be populated on first save
        new_q = Quotation(
            quotation_no=q_no,
            display_name=display,
            password=password,
            is_active=True,  # Set to true immediately so it shows in lobby
            data=json.dumps({}, ensure_ascii=False),  # empty, will be filled on first save
        )
        db.add(new_q)
        await db.commit()
        await db.refresh(new_q)
        return {"success": True, "id": new_q.id, "quotNo": q_no, "displayName": display}

    # ── Full document save (from within editor) ───────────────────
    qd = data.get("quotationDetails", {})
    ci = data.get("clientInfo", {})
    sig = data.get("signatures", {}).get("quotation", {}).get("preparedBy", {})
    
    q_no = qd.get("quotationNo")
    if not q_no:
        raise HTTPException(status_code=400, detail="Quotation number is required")
        
    # Check if exists
    stmt = select(Quotation).where(Quotation.quotation_no == q_no)
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Quotation number already exists")
    
    new_q = Quotation(
        quotation_no=q_no,
        client_name=ci.get("company", ""),
        designer_name=sig.get("name", ""),
        data=json.dumps(data, ensure_ascii=False),
        display_name=q_no
    )
    db.add(new_q)
    await db.commit()
    await db.refresh(new_q)
    return {"success": True, "id": new_q.id}

@router.get("/{q_id}")
async def get_quotation(q_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(Quotation).where(Quotation.id == q_id)
    result = await db.execute(stmt)
    quot = result.scalar_one_or_none()
    if not quot:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return json.loads(quot.data)

@router.patch("/{q_id}")
async def update_quotation(q_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    """Full update of quotation data."""
    stmt = update(Quotation).where(Quotation.id == q_id).values(
        data=json.dumps(data, ensure_ascii=False), 
        updated_at=datetime.utcnow(),
        # Also sync metadata if it changed in the JSON
        client_name=data.get("clientInfo", {}).get("company", ""),
        designer_name=data.get("signatures", {}).get("quotation", {}).get("preparedBy", {}).get("name", "")
    )
    await db.execute(stmt)
    await db.commit()
    return {"success": True}

@router.get("/{q_id}/history")
async def get_history(q_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(QuotationHistory).where(QuotationHistory.quotation_id == q_id).order_by(desc(QuotationHistory.created_at))
    result = await db.execute(stmt)
    items = result.scalars().all()
    
    return {
        "history": [
            {
                "id": h.id,
                "label": h.created_at.strftime("%b %d, %Y — %H:%M:%S"),
                "description": h.label,
                "author": h.author,
                "timestamp": h.created_at.isoformat()
            } for h in items
        ]
    }

@router.get("/{q_id}/history/{h_id}")
async def restore_history(q_id: int, h_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(QuotationHistory).where(QuotationHistory.id == h_id, QuotationHistory.quotation_id == q_id)
    result = await db.execute(stmt)
    history = result.scalar_one_or_none()
    if not history:
        raise HTTPException(status_code=404, detail="History entry not found")
    return json.loads(history.data)

@router.delete("/{q_id}")
async def delete_quotation(q_id: int, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(Quotation).where(Quotation.id == q_id))
    await db.commit()
    return {"success": True}
