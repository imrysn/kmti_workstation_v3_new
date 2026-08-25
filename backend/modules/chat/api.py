import os
import uuid
import shutil
import logging
import asyncio
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, and_, update, delete, func
from pydantic import BaseModel

from db.database import get_db, AsyncSessionLocal
from models.chat import ChatMessage, Group, GroupMember
from models.user import User
from models.telemetry import WorkstationStatus
from core.auth import get_current_user
from core.config import CHAT_STORAGE_DIR
from socket_manager import sio, _sid_to_user, register_user, broadcast_mutation
from modules.chat.schemas import GroupCreate
from modules.chat.service import ChatService
from utils.moderation import get_banned_words_cached, censor_text

logger = logging.getLogger("kmti_backend.chat")
router = APIRouter()
STORAGE_DIR = CHAT_STORAGE_DIR

async def join_online_members_to_group(group_id: int, members: List[str]):
    members_lower = {m.lower().strip() for m in members if m}
    for sid, username in list(_sid_to_user.items()):
        if username and username.lower().strip() in members_lower:
            try:
                await sio.enter_room(sid, f"group:{group_id}")
                logger.info(f"Dynamically joined online user {username} (sid={sid}) to room group:{group_id}")
            except Exception as e:
                logger.error(f"Failed to join online user {username} to group:{group_id} room: {e}")


@router.get("/history")
async def get_chat_history(
    peer: Optional[str] = Query(None),
    group_id: Optional[int] = Query(None),
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve chat history for a specific peer, global channel, or group chat."""
    try:
        messages = await ChatService.get_chat_history(db, current_user.username, peer, group_id, limit)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return sorted(
        [
            {
                "id": msg.id,
                "sender": msg.sender,
                "recipient": msg.recipient,
                "group_id": msg.group_id,
                "content": msg.content,
                "attachment_path": msg.attachment_path,
                "attachment_name": msg.attachment_name,
                "is_read": msg.is_read,
                "is_edited": msg.is_edited,
                "is_deleted": msg.is_deleted,
                "is_pinned": getattr(msg, "is_pinned", False),
                "pinned_by": getattr(msg, "pinned_by", None),
                "reply_to_id": msg.reply_to_id,
                "reactions": msg.reactions,
                "created_at": msg.created_at.isoformat() if msg.created_at else None
            }
            for msg in messages
        ],
        key=lambda x: x["id"]
    )


@router.post("/read")
async def mark_messages_read(
    peer: Optional[str] = Query(None),
    group_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark incoming messages from peer or group as read."""
    if group_id is not None:
        return {"success": True}
        
    if peer == "__global__":
        return {"success": True}
        
    c_peer = peer.lower().strip() if peer else ""
    c_user = current_user.username.lower().strip()
    stmt = (
        update(ChatMessage)
        .where(and_(
            func.lower(ChatMessage.sender) == c_peer,
            func.lower(ChatMessage.recipient) == c_user,
            ChatMessage.is_read == False
        ))
        .values(is_read=True)
    )
    await db.execute(stmt)
    await db.commit()

    if peer:
        await sio.emit("chat_messages_read", {"reader": current_user.username, "sender": peer}, room=f"user:{c_peer}")

    return {"success": True}


@router.get("/unread_counts")
async def get_unread_counts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve unread message counts grouped by sender."""
    return await ChatService.get_unread_counts(db, current_user.username)


@router.post("/upload")
async def upload_attachment(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload a file or image for chat sharing."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Empty filename")
        
    try:
        os.makedirs(STORAGE_DIR, exist_ok=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Attachment storage is unreachable: {e}")
        
    ext = os.path.splitext(file.filename)[1]
    filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(STORAGE_DIR, filename)
    
    def _save_file():
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

    await asyncio.to_thread(_save_file)
        
    return {
        "success": True,
        "attachment_path": f"/storage/chat/{filename}",
        "attachment_name": file.filename
    }


@router.post("/groups")
async def create_group(
    data: GroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new group and add initial members."""
    new_group, members_list = await ChatService.create_group(db, current_user.username, data.name, data.members)

    # Put all online member sockets into the new group room
    await join_online_members_to_group(new_group.id, members_list)

    # Emit socket event so everyone online in the group syncs it
    await sio.emit("group_created", {
        "id": new_group.id,
        "name": new_group.name,
        "created_by": new_group.created_by,
        "members": members_list
    }, room=f"group:{new_group.id}")

    return {
        "success": True,
        "id": new_group.id,
        "name": new_group.name,
        "created_by": new_group.created_by,
        "members": members_list
    }


@router.get("/groups")
async def get_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all groups the current user is a member of, along with member lists."""
    return await ChatService.get_groups(db, current_user.username)


@router.get("/users")
async def list_chat_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns a list of all active users for group member selection. Anyone can access this."""
    query = select(User).where(User.is_active == True).order_by(User.username)
    result = await db.execute(query)
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "display_name": u.display_name,
            "fullName": u.display_name or u.username
        }
        for u in users
    ]


@router.get("/threads")
async def get_chat_threads(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve all direct messages and groups for the user with their last message."""
    return await ChatService.get_chat_threads(db, current_user.username)


@router.put("/groups/{group_id}")
async def edit_group(
    group_id: int,
    data: GroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Edit group name and memberships."""
    try:
        group, members_list = await ChatService.edit_group(db, group_id, current_user.username, data.name, data.members)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Put new online members into room
    await join_online_members_to_group(group_id, members_list)

    # Emit socket event so clients sync group updates
    await sio.emit("group_updated", {
        "id": group_id,
        "name": group.name,
        "members": members_list
    }, room=f"group:{group_id}")

    return {"success": True}


@router.delete("/threads/dm/{peer}")
async def delete_dm_thread(
    peer: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Hard-delete all messages in a direct conversation for both sides."""
    await ChatService.delete_dm_thread(db, current_user.username, peer)
    
    clean_current = current_user.username.lower().strip()
    clean_peer = peer.lower().strip()
    # Emit thread sync notification targeted specifically to both parties
    await sio.emit("receive_chat_message", {"type": "thread_deleted", "peer": peer}, room=f"user:{clean_current}")
    await sio.emit("receive_chat_message", {"type": "thread_deleted", "peer": current_user.username}, room=f"user:{clean_peer}")
    return {"success": True}


@router.delete("/threads/group/{group_id}")
async def delete_group_thread(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """If group creator, delete group entirely. Otherwise, remove current user from group (leave group)."""
    try:
        is_creator_deleted, remaining_members, group_name = await ChatService.delete_group_thread(db, current_user.username, group_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    clean_user = current_user.username.lower().strip()
    if is_creator_deleted:
        # Group deleted entirely by creator -> notify everyone in the group room
        await sio.emit("receive_chat_message", {"type": "group_deleted", "group_id": group_id}, room=f"group:{group_id}")
    else:
        # User left group -> notify only the leaving user to close their local chat
        await sio.emit("receive_chat_message", {"type": "group_deleted", "group_id": group_id}, room=f"user:{clean_user}")
        # Notify remaining members in the group room with the updated member list
        await sio.emit("group_updated", {
            "id": group_id,
            "name": group_name,
            "members": remaining_members
        }, room=f"group:{group_id}")
        
        # Remove leaving user's active sockets from the group room
        for sid, uname in list(_sid_to_user.items()):
            if uname and uname.lower().strip() == clean_user:
                try:
                    await sio.leave_room(sid, f"group:{group_id}")
                except Exception:
                    pass

    return {"success": True}


@router.put("/messages/{msg_id}")
async def edit_message(
    msg_id: int,
    content: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        msg = await ChatService.edit_message(db, current_user.username, msg_id, content)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    
    await broadcast_mutation("chat_message", "edit", {"id": msg_id, "content": msg.content, "is_edited": True})
    return {"success": True}


@router.delete("/messages/{msg_id}")
async def delete_message(
    msg_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        await ChatService.delete_message(db, current_user.username, msg_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    
    await broadcast_mutation("chat_message", "delete", {"id": msg_id, "is_deleted": True})
    return {"success": True}


@router.post("/messages/{msg_id}/reactions")
async def add_reaction(
    msg_id: int,
    emoji: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        msg = await ChatService.react_to_message(db, current_user.username, msg_id, emoji)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    await broadcast_mutation("chat_message", "react", {"id": msg_id, "reactions": msg.reactions})
    return {"success": True}


@router.get("/media")
async def get_thread_media(
    peer: Optional[str] = Query(None),
    group_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve all shared media, documents/files, and extracted links for a thread."""
    try:
        return await ChatService.get_thread_media(db, current_user.username, peer, group_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/messages/{msg_id}/pin")
async def pin_message(
    msg_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toggle pin status of a message in a conversation thread."""
    try:
        msg = await ChatService.pin_message(db, current_user.username, msg_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    await broadcast_mutation("chat_message", "pin", {
        "id": msg_id,
        "is_pinned": msg.is_pinned,
        "pinned_by": msg.pinned_by
    })
    return {"success": True, "is_pinned": msg.is_pinned}


# ── Socket.IO Event Handlers ──────────────────────────────────────────────────

@sio.on("authenticate")
async def handle_authenticate(sid: str, data: dict):
    username = data.get("username")
    if username:
        clean_username = username.lower().strip()
        register_user(sid, username)
        await sio.enter_room(sid, f"user:{clean_username}")
        logger.info(f"[Socket] {username} authenticated via event (sid={sid}, room=user:{clean_username})")
        
        # Look up user's display_name and join group rooms
        try:
            async with AsyncSessionLocal() as db:
                u_res = await db.execute(select(User).where(func.lower(User.username) == clean_username))
                u = u_res.scalars().first()
                if u:
                    disp = getattr(u, "display_name", None) or getattr(u, "full_name", None)
                    if disp and disp.lower().strip() != clean_username:
                        disp_clean = disp.lower().strip()
                        await sio.enter_room(sid, f"user:{disp_clean}")
                        logger.info(f"[Socket] {username} also joined room user:{disp_clean}")

                stmt = select(GroupMember.group_id).where(func.lower(GroupMember.username) == clean_username)
                res = await db.execute(stmt)
                group_ids = res.scalars().all()
                for g_id in group_ids:
                    await sio.enter_room(sid, f"group:{g_id}")
                    logger.info(f"[Socket] {username} joined group room group:{g_id} via event")
        except Exception as e:
            logger.error(f"[Socket Error] Failed to join rooms for {username}: {e}")


@sio.on("send_chat_message")
async def handle_send_chat_message(sid: str, data: dict):
    sender = _sid_to_user.get(sid) or data.get("sender")
    if not sender:
        logger.warning(f"Socket send_chat_message failed: sid {sid} not associated with a user and no sender in payload")
        return {"error": "unauthenticated"}

    if sid not in _sid_to_user and sender:
        register_user(sid, sender)
        clean_sender = sender.lower().strip()
        await sio.enter_room(sid, f"user:{clean_sender}")
        
    recipient = data.get("recipient")
    group_id = data.get("group_id")
    content = data.get("content", "").strip()
    attachment_path = data.get("attachment_path")
    attachment_name = data.get("attachment_name")
    reply_to_id = data.get("reply_to_id")
    
    if not group_id and not recipient:
        return
    if not content and not attachment_path:
        return
        
    banned_words = await get_banned_words_cached()
    censored_content = censor_text(content, banned_words)
    
    resolved_recipient = recipient
    async with AsyncSessionLocal() as db:
        # If recipient was sent as display_name / full_name, resolve it to canonical username
        if recipient and recipient != "__global__":
            clean_rec = recipient.lower().strip()
            # 1. Match User display_name or username
            u_res = await db.execute(
                select(User).where(
                    or_(
                        func.lower(User.display_name) == clean_rec,
                        func.lower(User.username) == clean_rec
                    )
                )
            )
            matched_user = u_res.scalars().first()
            if matched_user:
                resolved_recipient = matched_user.username
            else:
                # 2. Match WorkstationStatus display_name or current_user
                ws_res = await db.execute(
                    select(WorkstationStatus).where(
                        or_(
                            func.lower(WorkstationStatus.display_name) == clean_rec,
                            func.lower(WorkstationStatus.current_user) == clean_rec
                        )
                    )
                )
                matched_ws = ws_res.scalars().first()
                if matched_ws and matched_ws.current_user:
                    resolved_recipient = matched_ws.current_user

        new_msg = ChatMessage(
            sender=sender,
            recipient=resolved_recipient or "",
            group_id=group_id,
            content=censored_content,
            attachment_path=attachment_path,
            attachment_name=attachment_name,
            is_read=False,
            reply_to_id=reply_to_id
        )
        db.add(new_msg)
        await db.commit()
        await db.refresh(new_msg)
        
        msg_payload = {
            "id": new_msg.id,
            "sender": new_msg.sender,
            "recipient": new_msg.recipient,
            "group_id": new_msg.group_id,
            "content": new_msg.content,
            "attachment_path": new_msg.attachment_path,
            "attachment_name": new_msg.attachment_name,
            "is_read": new_msg.is_read,
            "is_edited": new_msg.is_edited,
            "is_deleted": new_msg.is_deleted,
            "reply_to_id": new_msg.reply_to_id,
            "reactions": new_msg.reactions,
            "created_at": new_msg.created_at.isoformat() if new_msg.created_at else None
        }
        
    if group_id is not None:
        await sio.emit("receive_chat_message", msg_payload, room=f"group:{group_id}")
    elif recipient == "__global__":
        await sio.emit("receive_chat_message", msg_payload)
    else:
        # Emit to recipient's canonical username room
        if resolved_recipient:
            await sio.emit("receive_chat_message", msg_payload, room=f"user:{resolved_recipient.lower().strip()}")
        # If recipient was different string (e.g. display/full name), also emit to that room
        if recipient and recipient.lower().strip() != resolved_recipient.lower().strip():
            await sio.emit("receive_chat_message", msg_payload, room=f"user:{recipient.lower().strip()}")
        # Also emit to sender so other tabs/devices for sender receive the message
        if sender:
            await sio.emit("receive_chat_message", msg_payload, room=f"user:{sender.lower().strip()}")

    return {"success": True, "id": new_msg.id}


@sio.on("user_typing")
async def handle_user_typing(sid: str, data: dict):
    sender = _sid_to_user.get(sid) or data.get("sender")
    if not sender: return
    recipient = data.get("recipient")
    group_id = data.get("group_id")
    
    payload = {"sender": sender, "recipient": recipient, "group_id": group_id}
    if group_id is not None:
        await sio.emit("user_typing", payload, room=f"group:{group_id}", skip_sid=sid)
    elif recipient:
        await sio.emit("user_typing", payload, room=f"user:{recipient.lower().strip()}", skip_sid=sid)


@sio.on("user_stop_typing")
async def handle_user_stop_typing(sid: str, data: dict):
    sender = _sid_to_user.get(sid) or data.get("sender")
    if not sender: return
    recipient = data.get("recipient")
    group_id = data.get("group_id")
    
    payload = {"sender": sender, "recipient": recipient, "group_id": group_id}
    if group_id is not None:
        await sio.emit("user_stop_typing", payload, room=f"group:{group_id}", skip_sid=sid)
    elif recipient:
        await sio.emit("user_stop_typing", payload, room=f"user:{recipient.lower().strip()}", skip_sid=sid)
