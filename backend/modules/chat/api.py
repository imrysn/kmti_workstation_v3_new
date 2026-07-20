import os
import uuid
import shutil
import logging
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, and_, update, delete, func
from pydantic import BaseModel

from db.database import get_db
from models.chat import ChatMessage, Group, GroupMember
from core.auth import get_current_user
from models.user import User
from socket_manager import sio

logger = logging.getLogger("kmti_backend.chat")
router = APIRouter()

STORAGE_DIR = r"\\KMTI-NAS\Shared\data\storage\chat"
try:
    os.makedirs(STORAGE_DIR, exist_ok=True)
except Exception as e:
    STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "storage", "chat")
    os.makedirs(STORAGE_DIR, exist_ok=True)
    logger.warning(f"Could not use NAS directory, falling back to local chat storage: {STORAGE_DIR}")

from modules.chat.schemas import GroupCreate

async def join_online_members_to_group(group_id: int, members: List[str]):
    from socket_manager import _sid_to_user
    for sid, username in list(_sid_to_user.items()):
        if username in members:
            try:
                await sio.enter_room(sid, f"group:{group_id}")
                logger.info(f"Dynamically joined online user {username} (sid={sid}) to room group:{group_id}")
            except Exception as e:
                logger.error(f"Failed to join online user {username} to group:{group_id} room: {e}")

from modules.chat.service import ChatService

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
        
    stmt = (
        update(ChatMessage)
        .where(and_(ChatMessage.sender == peer, ChatMessage.recipient == current_user.username, ChatMessage.is_read == False))
        .values(is_read=True)
    )
    await db.execute(stmt)
    await db.commit()

    if peer:
        await sio.emit("chat_messages_read", {"reader": current_user.username, "sender": peer}, room=f"user:{peer}")

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
    
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
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
    from models.user import User
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
    # Emit thread sync notification
    await sio.emit("receive_chat_message", {"type": "thread_deleted", "peer": peer})
    return {"success": True}

@router.delete("/threads/group/{group_id}")
async def delete_group_thread(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """If group creator, delete group entirely. Otherwise, remove current user from group (leave group)."""
    try:
        await ChatService.delete_group_thread(db, current_user.username, group_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    # Emit group sync notification
    await sio.emit("receive_chat_message", {"type": "group_deleted", "group_id": group_id})
    return {"success": True}

@sio.on("authenticate")
async def handle_authenticate(sid: str, data: dict):
    username = data.get("username")
    if username:
        from socket_manager import _sid_to_user
        _sid_to_user[sid] = username
        await sio.enter_room(sid, f"user:{username}")
        print(f"[Socket] {username} authenticated via event (sid={sid})")
        
        # Join group rooms
        try:
            from db.database import AsyncSessionLocal
            from models.chat import GroupMember
            async with AsyncSessionLocal() as db:
                stmt = select(GroupMember.group_id).where(GroupMember.username == username)
                res = await db.execute(stmt)
                group_ids = res.scalars().all()
                for g_id in group_ids:
                    await sio.enter_room(sid, f"group:{g_id}")
                    print(f"[Socket] {username} joined group room group:{g_id} via event")
        except Exception as e:
            print(f"[Socket Error] Failed to join group rooms for {username}: {e}")

@sio.on("send_chat_message")
async def handle_send_chat_message(sid: str, data: dict):
    from socket_manager import _sid_to_user
    sender = _sid_to_user.get(sid)
    if not sender:
        logger.warning(f"Socket send_chat_message failed: sid {sid} not associated with a user")
        return
        
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
        
    from utils.moderation import get_banned_words_cached, censor_text
    banned_words = await get_banned_words_cached()
    censored_content = censor_text(content, banned_words)
    
    from db.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        new_msg = ChatMessage(
            sender=sender,
            recipient=recipient or "",
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
        await sio.emit("receive_chat_message", msg_payload, room=f"user:{recipient}")
        await sio.emit("receive_chat_message", msg_payload, room=f"user:{sender}")

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
    
    # Broadcast mutation
    from socket_manager import broadcast_mutation
    await broadcast_mutation("chat_message", "edit", {"id": msg_id, "content": msg.content, "is_edited": True})
    return {"success": True}

@router.delete("/messages/{msg_id}")
async def delete_message(
    msg_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        msg = await ChatService.delete_message(db, current_user.username, msg_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    
    from socket_manager import broadcast_mutation
    await broadcast_mutation("chat_message", "delete", {"id": msg_id})
    return {"success": True}

@router.post("/messages/{msg_id}/react")
async def react_to_message(
    msg_id: int,
    emoji: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        msg = await ChatService.react_to_message(db, current_user.username, msg_id, emoji)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    from socket_manager import broadcast_mutation
    await broadcast_mutation("chat_message", "react", {"id": msg_id, "reactions": msg.reactions})
    return {"success": True}

@sio.on("user_typing")
async def handle_user_typing(sid: str, data: dict):
    from socket_manager import _sid_to_user
    sender = _sid_to_user.get(sid)
    if not sender: return
    recipient = data.get("recipient")
    group_id = data.get("group_id")
    
    payload = {"sender": sender, "recipient": recipient, "group_id": group_id}
    if group_id is not None:
        await sio.emit("user_typing", payload, room=f"group:{group_id}", skip_sid=sid)
    elif recipient:
        await sio.emit("user_typing", payload, room=f"user:{recipient}")

@sio.on("user_stop_typing")
async def handle_user_stop_typing(sid: str, data: dict):
    from socket_manager import _sid_to_user
    sender = _sid_to_user.get(sid)
    if not sender: return
    recipient = data.get("recipient")
    group_id = data.get("group_id")
    
    payload = {"sender": sender, "recipient": recipient, "group_id": group_id}
    if group_id is not None:
        await sio.emit("user_stop_typing", payload, room=f"group:{group_id}", skip_sid=sid)
    elif recipient:
        await sio.emit("user_stop_typing", payload, room=f"user:{recipient}")

