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
from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, desc, or_
from sqlalchemy.orm import selectinload

import socketio
from db.database import get_db
from models.quotation import Quotation, QuotationHistory
from models.user import User, UserRole
from core.auth import get_current_user
from core.config import BASE_DIR
from core.cache import cache_get, cache_set, cache_delete
from core.activity_logger import log_activity

from socket_manager import sio

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
                            desc = t.get('description', '').strip()
                            assembly_name = f"'{desc}'" if desc else f"Task #{target_id}"
                            break
                except: pass
            
            # Map manual override fields
            if "manual" in field.lower():
                field = field.replace("manual", "").strip()
                return f"{assembly_name}'s {field} (Override)"
                
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
    """Join a shared quotation room. data = { quot_id, user_name, password?, auth_token? }"""
    try:
        q_id = int(data.get("quot_id", 0))
    except (ValueError, TypeError):
        return

    user_name = data.get("user_name", "Unknown")
    password = data.get("password")
    auth_token = data.get("auth_token")
    
    if not q_id: return

    # ── Role-based bypass via JWT ──────────────────────────────────
    # If a valid JWT is provided and the user is admin/IT, bypass the
    # password entirely. This is the server-side enforcement of the
    # frontend admin bypass in QuotationEntryModal.
    is_admin_bypass = False
    if auth_token:
        try:
            from core.auth import decode_token
            payload = decode_token(auth_token)
            role = payload.get("role", "")
            if role in ("admin", "it"):
                is_admin_bypass = True
        except Exception:
            pass  # Invalid/expired token — fall through to normal password check

    # Verify ID and password in DB
    from db.database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        stmt = select(Quotation).where(Quotation.id == q_id)
        result = await session.execute(stmt)
        quot = result.scalar_one_or_none()
        
        if not quot:
            await sio.emit("join_error", {"message": "Quotation not found."}, to=sid)
            return
        
        # ── Password / Ownership Bypass ────────────────────────────
        # Entry is allowed IF:
        # 1. No password is set
        # 2. OR the provided password is correct
        # 3. OR the user is the original owner (recognized by workstation name)
        # 4. OR the user is admin/IT (verified via JWT above)
        
        is_owner = (user_name and quot.workstation == user_name)
        
        if quot.password and quot.password != password and not is_owner and not is_admin_bypass:
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

    # Unique user identity: use sid to allow same-name users (common on cloned workstation images)
    _active_users[q_id][sid] = {"name": user_name, "color": color}
    
    # Broadcast join
    await sio.emit("joined", {"sid": sid, "color": color, "users": _active_users[q_id]}, to=sid)
    await sio.emit("user_joined", {"sid": sid, "name": user_name, "color": color, "users": _active_users[q_id]}, room=room_name, skip_sid=sid)

    # NEW: If others are already in the room, request the latest unsaved state from the first one
    # to ensure the new joiner is immediately up to date without waiting for a manual save.
    existing_sids = [s for s in list(_active_users[q_id].keys()) if s != sid]
    if existing_sids:
        leader_sid = existing_sids[0]
        print(f"[COLLAB] Requesting live state from {leader_sid} for new joiner {sid}")
        await sio.emit("sync_state_request", {"target_sid": sid}, to=leader_sid)
    else:
        print(f"[COLLAB] No existing users in room 'quot_{q_id}' to sync from.")

# ─── Internal Helpers ────────────────────────────────────────────────────────
def calculate_grand_total(data: dict) -> float:
    try:
        variant = data.get("layoutVariant", "special")
        tasks = data.get("tasks", [])
        manual_overrides = data.get("manualOverrides", {}) or {}
        task_overrides = manual_overrides.get("tasks", {}) or {}
        
        # Helper to compute task total
        def get_task_subtotal(task: dict) -> float:
            t_id = task.get("id")
            if not t_id:
                return 0.0
            # Check override first
            override = task_overrides.get(str(t_id)) or task_overrides.get(t_id) or {}
            if override.get("total") is not None:
                return float(override["total"])
                
            if variant == "kemco":
                # Find children
                children = [t for t in tasks if t.get("parentId") == t_id]
                if children:
                    return sum(get_task_subtotal(child) for child in children)
                return float(task.get("amount") or task.get("unitPrice") or 0.0)
                
            # Standard "Special" logic
            rates = data.get("baseRates", {}) or {}
            charge_2d = rates.get("timeChargeRate2D", 2700)
            charge_3d = rates.get("timeChargeRate3D", 2700)
            charge_others = rates.get("timeChargeRateOthers", 0)
            ot_rate = rates.get("overtimeRate", 3300)
            sw_rate = rates.get("softwareRate", 500)
            
            def get_rate(t_type):
                if t_type == "2D":
                    return charge_2d
                if t_type == "3D" or not t_type:
                    return charge_3d
                return charge_others
                
            hours = float(task.get("hours") or 0) + float(task.get("minutes") or 0) / 60.0
            ot_hours = float(task.get("overtimeHours") or 0)
            sw_units = float(task.get("softwareUnits") or 0)
            
            # Sub-tasks sum (if this is a main task)
            if task.get("isMainTask", False):
                sub_tasks = [t for t in tasks if t.get("parentId") == t_id]
                for sub in sub_tasks:
                    hours += float(sub.get("hours") or 0) + float(sub.get("minutes") or 0) / 60.0
                    ot_hours += float(sub.get("overtimeHours") or 0)
                    sw_units += float(sub.get("softwareUnits") or 0)
                    
            rate = get_rate(task.get("type"))
            return (hours * rate) + (ot_hours * ot_rate) + (sw_units * sw_rate)

        # Sum of main tasks
        main_tasks = [t for t in tasks if t.get("isMainTask", False) or (variant == "kemco" and t.get("level", 0) == 0)]
        subtotal = sum(get_task_subtotal(m) for m in main_tasks)
        
        if variant == "kemco":
            return round(subtotal, 2)
            
        # Add overhead and adjustment for standard layout
        rates = data.get("baseRates", {}) or {}
        overhead_pct = rates.get("overheadPercentage", 20)
        footer = manual_overrides.get("footer", {}) or {}
        
        overhead = float(footer.get("overhead")) if footer.get("overhead") is not None else (subtotal * overhead_pct / 100.0)
        adjustment = float(footer.get("adjustment") or 0.0)
        
        return round(subtotal + overhead + adjustment, 2)
    except Exception as e:
        print(f"Error calculating grand total: {e}")
        return 0.0

async def _sync_metadata(q_id: int, data: dict, db: AsyncSession, username: Optional[str] = None):
    """Synchronizes DB columns with the inner JSON data blob."""
    stmt = select(Quotation).where(Quotation.id == q_id)
    res = await db.execute(stmt)
    quot = res.scalar_one_or_none()
    if not quot: return
    
    qd = data.get("quotationDetails", {})
    new_q_no = qd.get("quotationNo", quot.quotation_no)
    
    doc_date_str = qd.get("date")
    doc_date = quot.date
    if doc_date_str:
        try:
            doc_date = datetime.strptime(doc_date_str[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except Exception:
            pass

    # Sync Logic: If display_name matches old q_no, or is empty, sync to new q_no
    new_display = quot.display_name
    if not quot.display_name or quot.display_name == quot.quotation_no:
        new_display = new_q_no
        
    client_contact = data.get("clientInfo", {}).get("contact", "")
    g_total = calculate_grand_total(data)

    # Sync Status & Tracking Columns
    billing_details = data.get("billingDetails", {})
    q_status = billing_details.get("quotationStatus") or quot.quotation_status or "For Approval"
    p_status = billing_details.get("projectStatus") or quot.project_status or "On Going"
    submitted_at_str = billing_details.get("submittedToAdminAt")
    upd_detail = billing_details.get("updateDetail") or quot.update_detail or ""

    p_incharge = billing_details.get("projectInCharge") or data.get("signatures", {}).get("quotation", {}).get("preparedBy", {}).get("name", "")
    b_to = data.get("clientInfo", {}).get("company", "")
    c_name = billing_details.get("clientName") or quot.client_name or ""

    if q_status == "CANCELLED":
        p_status = "CANCELLED"
        upd_detail = "CANCELLED"
        billing_details["quotationStatus"] = "CANCELLED"
        billing_details["projectStatus"] = "CANCELLED"
        billing_details["updateDetail"] = "CANCELLED"

    billing_details["projectInCharge"] = p_incharge
    billing_details["billTo"] = b_to
    billing_details["clientName"] = c_name
    
    if username:
        billing_details["updatedBy"] = username
        billing_details["lastUpdatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")

    data["billingDetails"] = billing_details

    submitted_datetime = None
    if submitted_at_str:
        try:
            submitted_datetime = datetime.strptime(submitted_at_str[:10], "%Y-%m-%d")
        except Exception:
            submitted_datetime = None
    elif quot.submitted_to_admin_at:
        submitted_datetime = quot.submitted_to_admin_at
    
    values = {
        "data": json.dumps(data, ensure_ascii=False),
        "quotation_no": new_q_no,
        "display_name": new_display,
        "date": doc_date,
        "updated_at": datetime.now(timezone.utc),
        "client_name": c_name,
        "designer_name": p_incharge,
        "grand_total": g_total,
        "customer_incharge": client_contact,
        "quotation_status": q_status,
        "project_status": p_status,
        "submitted_to_admin_at": submitted_datetime,
        "bill_to": b_to,
        "update_detail": upd_detail
    }
    
    if username:
        values["updated_by"] = username
        values["last_updated_at"] = datetime.now(timezone.utc)

    await db.execute(
        update(Quotation)
        .where(Quotation.id == q_id)
        .values(**values)
    )
    await db.commit()
    await cache_delete("quot_list")
    await cache_delete("quot_sessions")

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
            await _sync_metadata(q_id, full_state, session)

@sio.event
async def update_fields(sid: str, data: dict):
    """Batched state updates. Broadcasts each patch to peers."""
    q_id = data.get("quot_id")
    patches = data.get("patches", [])
    full_state = data.get("full_state")
    
    if not q_id or not patches: return
    room_name = f"quot_{q_id}"

    # 1. Immediate Broadcast each patch to other editors
    # (Peers handle them sequentially in their local state)
    for patch in patches:
        await sio.emit("remote_patch", {"sid": sid, "patch": patch}, room=room_name, skip_sid=sid)
    
    # 2. Persist metadata once for the whole batch if full_state is provided
    if full_state:
        from db.database import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            await _sync_metadata(q_id, full_state, session)

@sio.event
async def sync_state_response(sid: str, data: dict):
    """Relay the full state from an existing editor to a new joiner."""
    target_sid = data.get("target_sid")
    full_state = data.get("full_state")
    if target_sid and full_state:
        print(f"[COLLAB] Relaying live state from {sid} to {target_sid}")
        # Send only to the joiner who requested it
        await sio.emit("remote_patch", {
            "sid": sid, 
            "patch": {"path": "__full_restore__", "value": full_state}
        }, to=target_sid)

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
            
            # If last user left, cleanup in-memory presence and deactivate in DB
            if not users:
                if q_id in _active_users:
                    del _active_users[q_id]
                
                # Sync DB status
                from db.database import AsyncSessionLocal
                try:
                    async with AsyncSessionLocal() as session:
                        await session.execute(
                            update(Quotation).where(Quotation.id == q_id).values(is_active=False)
                        )
                        await session.commit()
                except Exception as e:
                    print(f"[COLLAB] Failed to deactivate session {q_id} on disconnect: {e}")
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
async def chat_message(sid: str, data: dict):
    """Broadcast a chat message to the workspace."""
    q_id = data.get("quot_id")
    message = data.get("message")
    if not q_id or not message: return
    
    user_info = _active_users.get(q_id, {}).get(sid, {})
    await sio.emit("remote_chat", {
        "sid": sid,
        "name": user_info.get("name", "User"),
        "color": user_info.get("color", "#4A90D9"),
        "message": message,
        "time": datetime.now().strftime("%H:%M")
    }, room=f"quot_{q_id}")

@sio.event
async def focus_selection(sid: str, data: dict):
    q_id = data.get("quot_id")
    await sio.emit("remote_selection", data, room=f"quot_{q_id}", skip_sid=sid)

# ─── REST API ───────────────────────────────────────────────────────────────

router = APIRouter()

# ─── Template File Endpoint ──────────────────────────────────────────────────
_TEMPLATE_MAP = {
    "quotation": "Quotation Template.xlsx",
    "billing":   "Billing Template.xlsx",
    "kemco_quotation": "KEMCO Quotation Template.xlsx",
}

@router.get("/templates/{template_name}")
async def get_template(template_name: str):
    """Serve an Excel template file from backend/data/.
    
    Used by the frontend Excel export to load a pixel-perfect base template
    rather than building layout from scratch with ExcelJS.
    template_name: 'quotation' | 'billing'
    """
    filename = _TEMPLATE_MAP.get(template_name)
    if not filename:
        raise HTTPException(status_code=404, detail=f"Unknown template: '{template_name}'")
    
    file_path = os.path.join(BASE_DIR, "data", filename)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail=f"Template file not found on disk: {filename}")
    
    return FileResponse(
        path=file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename,
    )

@router.get("/")
async def list_quotations(
    q: Optional[str] = None, 
    designer: Optional[str] = None,
    limit: int = 100, 
    offset: int = 0,
    trash_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List quotations from DB with filtering."""
    is_admin = current_user.role in [UserRole.admin, UserRole.it]
    cache_key = f"{q or ''}:{designer or ''}:{limit}:{offset}:{is_admin}:{trash_only}"
    cached_val = await cache_get("quot_list", cache_key)
    if cached_val is not None:
        return cached_val

    stmt = select(Quotation).order_by(desc(Quotation.updated_at))
    
    if trash_only:
        if not is_admin:
            raise HTTPException(status_code=403, detail="Access Denied: Only administrators can access the trash bin.")
        stmt = stmt.where(Quotation.is_deleted == True)
    else:
        stmt = stmt.where(Quotation.is_deleted == False)
        
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
    
    res_dict = {
        "quotations": [
            {
                "id": i.id,
                "quotationNo": i.quotation_no,
                "clientName": i.client_name,
                "designerName": i.designer_name,
                "workstation": i.workstation,
                "date": i.date.strftime("%Y-%m-%d") if i.date else None,
                "modifiedAt": i.updated_at.isoformat() + "Z" if i.updated_at else None,
                "isActive": i.is_active,
                "hasPassword": bool(i.password),
                "password": i.password if is_admin else None, # Elevated view for recovery
                "displayName": i.display_name or i.quotation_no,
                
                # New fields for Billing Monitoring
                "grandTotal": float(i.grand_total or 0.0),
                "customerIncharge": i.customer_incharge or "",
                "quotationStatus": i.quotation_status or "For Approval",
                "projectStatus": i.project_status or "On Going",
                "submittedToAdminAt": i.submitted_to_admin_at.strftime("%Y-%m-%d") if i.submitted_to_admin_at else None,
                "billTo": (
                    (json.loads(i.data).get("clientInfo", {}).get("company", "") if i.data else "") or 
                    i.bill_to or 
                    ""
                ),
                "datePaid": i.date_paid.strftime("%Y-%m-%d") if i.date_paid else None,
                "updatedBy": i.updated_by or "",
                "lastUpdatedAt": i.last_updated_at.strftime("%Y-%m-%d %H:%M") if i.last_updated_at else None,
                "updateDetail": i.update_detail or ""
            } for i in items
        ]
    }
    await cache_set("quot_list", cache_key, res_dict)
    return res_dict
 
@router.get("/sessions")
async def list_active_sessions(db: AsyncSession = Depends(get_db)):
    """Returns list of quotations that are currently active.
    
    Cross-references the database 'is_active' flag with the live Socket.IO presence.
    This provides a resilient list that doesn't disappear if the socket hasn't 
    finished handshaking or if the server recently restarted.
    """
    cached_val = await cache_get("quot_sessions", "all")
    if cached_val is not None:
        return cached_val
 
    # 1. Start with all quotations marked active in DB
    stmt = select(Quotation).where(Quotation.is_active == True, Quotation.is_deleted == False).order_by(desc(Quotation.updated_at))
    result = await db.execute(stmt)
    items = result.scalars().all()

    sessions = []
    for i in items:
        # 2. Add live user info from memory
        users = _active_users.get(i.id, {})
        sessions.append({
            "id": i.id,
            "quotNo": i.quotation_no,
            "displayName": i.display_name or i.quotation_no,
            "userCount": len(users),
            "users": list(users.values()),
            "hasPassword": bool(i.password),
            "workstation": i.workstation
        })
    
    res_sessions = {"sessions": sessions}
    await cache_set("quot_sessions", "all", res_sessions)
    return res_sessions

@router.post("/")
async def create_quotation(data: dict, request: Request, db: AsyncSession = Depends(get_db)):
    """Create a new quotation record in the database.
    
    Supports two modes:
      Lightweight:  { quot_no, display_name?, password? }  — workspace-first creation
      Full:         { quotationDetails, clientInfo, ... }  — save from within editor
    """
    workstation = data.get("workstation")
    
    # Try to extract authenticated username if available in Bearer token header
    user_label = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            token = auth_header.split(" ")[1]
            from core.auth import decode_token
            payload = decode_token(token)
            user_label = payload.get("sub")
        except Exception:
            pass
    if not user_label:
        user_label = workstation or "unknown_workstation"
    
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
            workstation=workstation,
            is_active=True,  # Set to true immediately so it shows in lobby
            data=json.dumps({}, ensure_ascii=False),  # empty, will be filled on first save
        )
        db.add(new_q)
        await db.commit()
        await db.refresh(new_q)
        await cache_delete("quot_list")
        await cache_delete("quot_sessions")
        
        await log_activity(
            username=user_label,
            action="CREATE_QUOTATION",
            details=f"Created lightweight quotation '{q_no}' (DisplayName: '{display}')",
            ip_address=request.client.host
        )
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
    
    client_contact = ci.get("contact", "")
    g_total = calculate_grand_total(data)

    doc_date_str = qd.get("date")
    doc_date = datetime.now(timezone.utc)
    if doc_date_str:
        try:
            doc_date = datetime.strptime(doc_date_str[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except Exception:
            pass

    new_q = Quotation(
        quotation_no=q_no,
        client_name=ci.get("company", ""),
        designer_name=sig.get("name", ""),
        workstation=workstation,
        date=doc_date,
        data=json.dumps(data, ensure_ascii=False),
        display_name=q_no,
        grand_total=g_total,
        customer_incharge=client_contact
    )
    db.add(new_q)
    await db.commit()
    await db.refresh(new_q)
    await cache_delete("quot_list")
    await cache_delete("quot_sessions")
    
    await log_activity(
        username=user_label,
        action="CREATE_QUOTATION",
        details=f"Created and saved full quotation '{q_no}' (Grand Total: {g_total})",
        ip_address=request.client.host
    )
    return {"success": True, "id": new_q.id}



@router.get("/{q_id}")
async def get_quotation(q_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(Quotation).where(Quotation.id == q_id)
    result = await db.execute(stmt)
    quot = result.scalar_one_or_none()
    if not quot:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    data = json.loads(quot.data) if quot.data else {}
    if "billingDetails" not in data:
        data["billingDetails"] = {}
        
    data["billingDetails"]["quotationStatus"] = quot.quotation_status or "For Approval"
    data["billingDetails"]["projectStatus"] = quot.project_status or "On Going"
    data["billingDetails"]["submittedToAdminAt"] = (
        quot.submitted_to_admin_at.isoformat()[:10] if quot.submitted_to_admin_at else None
    )
    data["billingDetails"]["updateDetail"] = quot.update_detail or ""
    data["billingDetails"]["projectInCharge"] = quot.designer_name or data.get("signatures", {}).get("quotation", {}).get("preparedBy", {}).get("name", "")
    data["billingDetails"]["billTo"] = data.get("clientInfo", {}).get("company", "") or ""
    
    return data

@router.patch("/{q_id}")
async def update_quotation(
    q_id: int, 
    data: dict, 
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Full update of quotation data."""
    stmt = select(Quotation).where(Quotation.id == q_id)
    res = await db.execute(stmt)
    quot = res.scalar_one_or_none()
    q_no = quot.quotation_no if quot else f"ID {q_id}"
    
    await _sync_metadata(q_id, data, db, current_user.username)
    
    await log_activity(
        username=current_user.username,
        action="UPDATE_QUOTATION",
        details=f"Updated quotation '{q_no}' (ID: {q_id})",
        ip_address=request.client.host
    )
    return {"success": True}

@router.patch("/{q_id}/billing")
async def update_billing_monitoring(
    q_id: int,
    payload: dict,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update billing tracking fields for admin roles."""
    if current_user.role not in [UserRole.admin, UserRole.it]:
        raise HTTPException(status_code=403, detail="Access Denied")
        
    stmt = select(Quotation).where(Quotation.id == q_id)
    res = await db.execute(stmt)
    quot = res.scalar_one_or_none()
    if not quot:
        raise HTTPException(status_code=404, detail="Quotation not found")
        
    # Editable billing tracking fields
    if "quotationStatus" in payload:
        quot.quotation_status = payload["quotationStatus"]
    if "projectStatus" in payload:
        quot.project_status = payload["projectStatus"]
    if "submittedToAdminAt" in payload:
        val = payload["submittedToAdminAt"]
        if val:
            try:
                quot.submitted_to_admin_at = datetime.strptime(val[:10], "%Y-%m-%d")
            except ValueError:
                quot.submitted_to_admin_at = None
        else:
            quot.submitted_to_admin_at = None
    if "billTo" in payload:
        quot.bill_to = payload["billTo"]
    if "clientName" in payload:
        quot.client_name = payload["clientName"]
    if "projectInCharge" in payload:
        quot.designer_name = payload["projectInCharge"]
    if "datePaid" in payload:
        val = payload["datePaid"]
        if val:
            try:
                quot.date_paid = datetime.strptime(val[:10], "%Y-%m-%d")
            except ValueError:
                quot.date_paid = None
        else:
            quot.date_paid = None
    if "date" in payload:
        val = payload["date"]
        if val:
            try:
                # We retain utc timezone so it's consistent
                quot.date = datetime.strptime(val[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                pass
        else:
            quot.date = None
    if "updateDetail" in payload:
        quot.update_detail = payload["updateDetail"]
        
    # Enforce cascade logic
    if quot.quotation_status == "CANCELLED":
        quot.project_status = "CANCELLED"
        quot.update_detail = "CANCELLED"

    if "updatedBy" in payload:
        quot.updated_by = payload["updatedBy"]
    else:
        quot.updated_by = current_user.username
    quot.last_updated_at = datetime.now(timezone.utc)
    quot.updated_at = datetime.now(timezone.utc)
    
    # Sync with inner JSON
    try:
        data = json.loads(quot.data) if quot.data else {}
        if "billingDetails" not in data:
            data["billingDetails"] = {}
        data["billingDetails"]["quotationStatus"] = quot.quotation_status
        data["billingDetails"]["projectStatus"] = quot.project_status
        data["billingDetails"]["submittedToAdminAt"] = (
            quot.submitted_to_admin_at.isoformat()[:10] if quot.submitted_to_admin_at else None
        )
        data["billingDetails"]["updateDetail"] = quot.update_detail
        data["billingDetails"]["projectInCharge"] = quot.designer_name or data.get("signatures", {}).get("quotation", {}).get("preparedBy", {}).get("name", "")
        data["billingDetails"]["billTo"] = quot.bill_to or ""
        data["billingDetails"]["clientName"] = quot.client_name or ""
        data["billingDetails"]["updatedBy"] = quot.updated_by
        data["billingDetails"]["lastUpdatedAt"] = quot.last_updated_at.strftime("%Y-%m-%d %H:%M")
        if "clientInfo" not in data:
            data["clientInfo"] = {}
        data["clientInfo"]["company"] = quot.bill_to or ""
        if "quotationDetails" not in data:
            data["quotationDetails"] = {}
        if "date" in payload:
            data["quotationDetails"]["date"] = quot.date.isoformat()[:10] if quot.date else None
        quot.data = json.dumps(data, ensure_ascii=False)
    except Exception as e:
        print(f"Error syncing JSON in update_billing_monitoring: {e}")

    await db.commit()
    await cache_delete("quot_list")
    await cache_delete("quot_sessions")

    # Emit Socket.IO patches for active editors to update live
    room_name = f"quot_{q_id}"
    patches = [
        {"path": "billingDetails.quotationStatus", "value": quot.quotation_status},
        {"path": "billingDetails.projectStatus", "value": quot.project_status},
        {"path": "billingDetails.submittedToAdminAt", "value": (quot.submitted_to_admin_at.isoformat()[:10] if quot.submitted_to_admin_at else None)},
        {"path": "billingDetails.updateDetail", "value": quot.update_detail},
        {"path": "billingDetails.projectInCharge", "value": quot.designer_name},
        {"path": "billingDetails.billTo", "value": quot.bill_to},
        {"path": "billingDetails.clientName", "value": quot.client_name},
        {"path": "clientInfo.company", "value": quot.bill_to},
        {"path": "quotationDetails.date", "value": quot.date.isoformat()[:10] if quot.date else None}
    ]
    for patch in patches:
        await sio.emit("remote_patch", {"sid": "system", "patch": patch}, room=room_name)

    await log_activity(
        username=current_user.username,
        action="UPDATE_BILLING",
        details=f"Updated billing details for quotation '{quot.quotation_no}' (ID: {q_id})",
        ip_address=request.client.host
    )
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
                "label": h.label or "System Snapshot",
                "author": h.author,
                "timestamp": h.created_at.isoformat() + "Z"
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
async def delete_quotation(
    q_id: int, 
    request: Request,
    workstation: Optional[str] = None,
    permanent: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a quotation (soft delete by default, permanent delete if requested or already soft-deleted).
    
    Authorization:
    - Admin/IT roles can delete any record.
    - Regular users can only delete records owned by their current workstation.
    - Permanent deletion is restricted to Admin/IT roles only.
    """
    # 1. Fetch quotation to check ownership
    stmt = select(Quotation).where(Quotation.id == q_id)
    res = await db.execute(stmt)
    quot = res.scalar_one_or_none()
    
    if not quot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation not found")
        
    # 2. Authorization Check
    is_admin = current_user.role in [UserRole.admin, UserRole.it]
    # Match workstation hostname for ownership (Shared Account scenario)
    is_owner = workstation and quot.workstation == workstation

    if not is_admin and not is_owner:
        owner_label = quot.workstation if quot.workstation else "Legacy/Unknown"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Deletion Denied: This record belongs to workstation '{owner_label}'. Only the owner or an administrator can delete it."
        )

    # 3. Perform Deletion
    q_no = quot.quotation_no
    is_soft = not (quot.is_deleted or permanent)
    if quot.is_deleted or permanent:
        # Permanent delete is restricted to admins only
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access Denied: Only administrators can permanently delete records from the trash bin."
            )
        await db.execute(delete(QuotationHistory).where(QuotationHistory.quotation_id == q_id))
        await db.execute(delete(Quotation).where(Quotation.id == q_id))
    else:
        # Soft delete
        quot.is_deleted = True
        quot.is_active = False

    await db.commit()
    await cache_delete("quot_list")
    await cache_delete("quot_sessions")
    
    await log_activity(
        username=current_user.username,
        action="PERMANENT_DELETE_QUOTATION" if not is_soft else "DELETE_QUOTATION",
        details=f"Permanently deleted quotation '{q_no}' (ID: {q_id}) from Trash" if not is_soft else f"Moved quotation '{q_no}' (ID: {q_id}) to Trash",
        ip_address=request.client.host
    )
    return {"success": True}

@router.post("/{q_id}/restore")
async def restore_quotation(
    q_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Restore a soft-deleted quotation from the trash bin."""
    is_admin = current_user.role in [UserRole.admin, UserRole.it]
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Only administrators can restore records from the trash bin."
        )

    stmt = select(Quotation).where(Quotation.id == q_id)
    res = await db.execute(stmt)
    quot = res.scalar_one_or_none()
    
    if not quot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation not found")

    quot.is_deleted = False
    await db.commit()
    await cache_delete("quot_list")
    await cache_delete("quot_sessions")
    
    await log_activity(
        username=current_user.username,
        action="RESTORE_QUOTATION",
        details=f"Restored quotation '{quot.quotation_no}' (ID: {q_id}) from Trash",
        ip_address=request.client.host
    )
    return {"success": True}
