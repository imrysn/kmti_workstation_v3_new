r"""
Quotations Router
─────────────────────────────────────────────────────────────────
Handles shared quotation management:
  - NAS-based JSON storage at \\KMTI-NAS\Shared\data\template\
  - Version history snapshots at \\KMTI-NAS\Shared\data\template\history\
  - REST endpoints for listing and fetching shared quotations
  - WebSocket (Socket.IO) rooms for real-time collaborative editing
"""

import os
import json
import random
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
import socketio

# ─── NAS Storage Paths ───────────────────────────────────────────────────────
NAS_QUOTATIONS_DIR = Path(r"\\KMTI-NAS\Shared\data\template")
NAS_HISTORY_DIR    = NAS_QUOTATIONS_DIR / "history"
NAS_LOG_DIR        = NAS_QUOTATIONS_DIR / "logs"

def _ensure_dirs():
    try:
        NAS_QUOTATIONS_DIR.mkdir(parents=True, exist_ok=True)
        NAS_HISTORY_DIR.mkdir(parents=True, exist_ok=True)
        NAS_LOG_DIR.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        # NAS may be unavailable; log but do not crash
        print(f"[quotations] WARNING: Could not create NAS directories: {e}")

_ensure_dirs()

# ─── Socket.IO Server ─────────────────────────────────────────────────────────
# An async-compatible Socket.IO server mounted under /quotation namespace.
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
socket_app = socketio.ASGIApp(sio)

# Tracks connected users per document room: { quot_no -> { sid -> { name, color } } }
_rooms: dict[str, dict[str, dict]] = {}

# Tracks the last time a history snapshot was created for each document: { quot_no -> float }
_last_snapshot_times: dict[str, float] = {}

def _random_color() -> str:
    """Generate a visually distinct hex color for a user session."""
    import random
    colors = [
        "#4A90D9", "#E05C6B", "#27AE60", "#F39C12",
        "#8E44AD", "#16A085", "#E67E22", "#2980B9",
        "#C0392B", "#2ECC71",
    ]
    return random.choice(colors)


def _get_audit_label(path: str) -> str:
    """Map a technical JSON path to a human-readable field name."""
    if not path: return "Document"
    p = path.lower()
    if "companyinfo" in p: return f"Company {p.split('.')[-1].title()}"
    if "clientinfo" in p: return f"Client {p.split('.')[-1].title()}"
    if "quotationdetails" in p: return f"Quotation {p.split('.')[-1].replace('no', '#').title()}"
    if "billingdetails" in p: return f"Billing {p.split('.')[-1].title()}"
    if "task" in p:
        parts = path.split('.')
        if len(parts) >= 2: return f"Task #{parts[1]} {parts[-1].title()}"
        return "Tasks"
    if "signatures" in p: return "Signatures"
    if "footer" in p: return f"Footer {p.split('.')[-1].title()}"
    return path


async def _log_audit(quot_no: str, user_name: str, color: str, path: str):
    """Save an audit entry to the NAS and broadcast it."""
    try:
        label = _get_audit_label(path)
        entry = {
            "id": datetime.now().strftime("%Y%m%d%H%M%S%f"),
            "userName": user_name,
            "userColor": color,
            "action": f"Updated {label}",
            "timestamp": datetime.now().isoformat()
        }
        
        # Broadcast to room
        await sio.emit("audit_entry", entry, room=quot_no)
        
        # Persist to NAS
        safe_name = quot_no.replace("/", "_").replace("\\", "_")
        log_path = NAS_LOG_DIR / f"{safe_name}.json"
        
        logs = []
        if log_path.exists():
            try:
                logs = json.loads(log_path.read_text(encoding="utf-8"))
            except: logs = []
            
        logs.insert(0, entry)
        logs = logs[:100] # Keep last 100
        log_path.write_text(json.dumps(logs, indent=2, ensure_ascii=False), encoding="utf-8")
        
    except Exception as e:
        print(f"[quotations] Audit log failed: {e}")


@sio.event
async def connect(sid: str, environ: dict):
    print(f"[quotations] Client connected: {sid}")


@sio.event
async def disconnect(sid: str):
    # Remove from all rooms on disconnect
    for quot_no, users in list(_rooms.items()):
        if sid in users:
            user_info = users.pop(sid)
            await sio.emit(
                "user_left",
                {"sid": sid, "name": user_info.get("name", "Unknown"), "users": {k:v for k,v in users.items() if k != "__info__"}},
                room=quot_no,
            )
            # Remove room if all REAL users are gone (ignoring metadata)
            if not [k for k in users.keys() if k != "__info__"]:
                del _rooms[quot_no]
    print(f"[quotations] Client disconnected: {sid}")


@sio.event
async def join_doc(sid: str, data: dict):
    """Join a shared quotation room. data = { quot_no, user_name, password? }"""
    quot_no   = data.get("quot_no")
    user_name = data.get("user_name", "Unknown")
    password  = data.get("password")
    if not quot_no:
        return

    # Password check
    if quot_no in _rooms:
        room_info = _rooms[quot_no].get("__info__", {})
        required_pw = room_info.get("password")
        if required_pw and required_pw != password:
            await sio.emit("join_error", {"message": "Invalid room password."}, to=sid)
            return

    color = _random_color()
    await sio.enter_room(sid, quot_no)

    if quot_no not in _rooms:
        _rooms[quot_no] = {"__info__": {"password": password}}
    
    _rooms[quot_no][sid] = {"name": user_name, "color": color}

    # Prepare public user list (excluding sensitive info)
    public_users = {k: v for k, v in _rooms[quot_no].items() if k != "__info__"}

    # Tell the joiner their assigned color
    await sio.emit("joined", {"sid": sid, "color": color, "users": public_users}, to=sid)
    # Tell the room someone new joined
    await sio.emit("user_joined", {"sid": sid, "name": user_name, "color": color, "users": public_users}, room=quot_no, skip_sid=sid)


@sio.event
async def leave_doc(sid: str, data: dict):
    quot_no = data.get("quot_no")
    if quot_no and quot_no in _rooms and sid in _rooms[quot_no]:
        user_info = _rooms[quot_no].pop(sid)
        await sio.leave_room(sid, quot_no)
        # prepares public list
        public_users = {k: v for k, v in _rooms[quot_no].items() if k != "__info__"}
        await sio.emit("user_left", {"sid": sid, "name": user_info["name"], "users": public_users}, room=quot_no)
        
        # Cleanup room if empty
        if not public_users:
            del _rooms[quot_no]


@sio.event
async def focus_field(sid: str, data: dict):
    """Broadcast which field a user is currently focused on.
    data = { quot_no, field_key }
    """
    quot_no   = data.get("quot_no")
    field_key = data.get("field_key")
    if not quot_no or not field_key:
        return
    user_info = _rooms.get(quot_no, {}).get(sid, {})
    await sio.emit(
        "remote_focus",
        {"sid": sid, "field_key": field_key, "name": user_info.get("name", ""), "color": user_info.get("color", "#ccc")},
        room=quot_no,
        skip_sid=sid,
    )


@sio.event
async def blur_field(sid: str, data: dict):
    """Broadcast that a user left a field."""
    quot_no   = data.get("quot_no")
    field_key = data.get("field_key")
    if not quot_no or not field_key:
        return
    await sio.emit("remote_blur", {"sid": sid, "field_key": field_key}, room=quot_no, skip_sid=sid)


@sio.event
async def update_field(sid: str, data: dict):
    """Broadcast a partial state update to all room members.
    data = { quot_no, patch: { path: string, value: any } }
    """
    quot_no = data.get("quot_no")
    patch   = data.get("patch")
    if not quot_no or not patch:
        return
    # Rebroadcast to everyone else in the room
    await sio.emit("remote_patch", {"sid": sid, "patch": patch}, room=quot_no, skip_sid=sid)
    
    # Audit log (Debounced by client-side or we could add logic here; for now, simple log)
    user_info = _rooms.get(quot_no, {}).get(sid, {})
    if user_info:
        asyncio.create_task(_log_audit(quot_no, user_info["name"], user_info["color"], patch.get("path", "")))

    # Async auto-save to NAS
    asyncio.create_task(_autosave(quot_no, data.get("full_state")))


async def _autosave(quot_no: str, full_state: Any):
    """Write the latest full state to the NAS file and snapshot history."""
    if not full_state or not quot_no:
        return
    try:
        import time
        safe_name = quot_no.replace("/", "_").replace("\\", "_")
        doc_path  = NAS_QUOTATIONS_DIR / f"{safe_name}.json"
        content   = json.dumps(full_state, ensure_ascii=False, indent=2)

        # 1. Always update the primary "current" file
        doc_path.write_text(content, encoding="utf-8")

        # 2. Throttled Snapshotting (History)
        # We only create a new history snapshot every 5 minutes (300 seconds)
        now = time.time()
        last_time = _last_snapshot_times.get(quot_no, 0)
        
        if now - last_time > 300:
            snap_dir = NAS_HISTORY_DIR / safe_name
            snap_dir.mkdir(parents=True, exist_ok=True)
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            snap_path = snap_dir / f"{ts}.json"
            snap_path.write_text(content, encoding="utf-8")
            
            _last_snapshot_times[quot_no] = now
            print(f"[quotations] History snapshot created for {quot_no}")
            
    except Exception as e:
        print(f"[quotations] Auto-save failed for {quot_no}: {e}")


# ─── REST API ───────────────────────────────────────────────────────────────

router = APIRouter()


@router.get("/")
async def list_quotations():
    """List all quotation JSON files on the NAS."""
    try:
        files = [
            {
                "name": f.stem,
                "modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
                "size": f.stat().st_size,
            }
            for f in NAS_QUOTATIONS_DIR.glob("*.json")
            if f.is_file()
        ]
        files.sort(key=lambda x: x["modified"], reverse=True)
        return {"quotations": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"NAS read error: {e}")


@ router.get("/sessions")
async def list_active_sessions():
    """Returns a list of active collaboration rooms and their users."""
    sessions = []
    for quot_no, users in list(_rooms.items()):
        # Ghost Room Filtering: Skip rooms that somehow stayed in memory with 0 users
        if not users:
            continue
            
        sessions.append({
            "quotNo": quot_no,
            "userCount": len(users),
            "hasPassword": bool(users.get("__info__", {}).get("password")),
            "users": [
                {"name": u["name"], "color": u["color"]} 
                for sid, u in users.items() if sid != "__info__"
            ]
        })
    return {"sessions": sessions}


@router.get("/{quot_no}")
async def get_quotation(quot_no: str):
    """Load a specific quotation from the NAS or return a default for new sessions."""
    safe_name = quot_no.replace("/", "_").replace("\\", "_")
    doc_path  = NAS_QUOTATIONS_DIR / f"{safe_name}.json"
    
    if not doc_path.exists():
        # Graceful Join: If the file is missing but the room is active, return a blank template
        # instead of 404. This allows users to join a "Draft" session that hasn't been saved yet.
        if quot_no in _rooms:
            return {
                "companyInfo": {},
                "clientInfo": {},
                "quotationDetails": {"quotationNo": quot_no, "date": datetime.now().strftime("%Y-%m-%d")},
                "billingDetails": {},
                "tasks": [],
                "signatures": {}
            }
        raise HTTPException(status_code=404, detail="Quotation not found on NAS.")
    try:
        data = json.loads(doc_path.read_text(encoding="utf-8"))
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File read error: {e}")


@router.get("/{quot_no}/history")
async def get_history(quot_no: str):
    """List version snapshots for a specific quotation."""
    safe_name = quot_no.replace("/", "_").replace("\\", "_")
    snap_dir  = NAS_HISTORY_DIR / safe_name
    if not snap_dir.exists():
        return {"history": []}
    try:
        snapshots = [
            {
                "timestamp": f.stem,
                "label": datetime.strptime(f.stem, "%Y%m%d_%H%M%S").strftime("%b %d, %Y — %H:%M:%S"),
            }
            for f in sorted(snap_dir.glob("*.json"), reverse=True)
            if f.is_file()
        ]
        return {"history": snapshots}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"History read error: {e}")


@router.get("/{quot_no}/history/{timestamp}")
async def restore_snapshot(quot_no: str, timestamp: str):
    """Restore (load) a specific snapshot version."""
    safe_name = quot_no.replace("/", "_").replace("\\", "_")
    snap_path = NAS_HISTORY_DIR / safe_name / f"{timestamp}.json"
    if not snap_path.exists():
        raise HTTPException(status_code=404, detail="Snapshot not found.")
    try:
        return json.loads(snap_path.read_text(encoding="utf-8"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Snapshot read error: {e}")


@router.get("/{quot_no}/logs")
async def get_audit_logs(quot_no: str):
    """Fetch activity logs for a specific quotation."""
    safe_name = quot_no.replace("/", "_").replace("\\", "_")
    log_path = NAS_LOG_DIR / f"{safe_name}.json"
    if not log_path.exists():
        return {"logs": []}
    try:
        data = json.loads(log_path.read_text(encoding="utf-8"))
        return {"logs": data}
    except:
        return {"logs": []}
