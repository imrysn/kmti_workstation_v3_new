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

class GroupCreate(BaseModel):
    name: str
    members: List[str]

async def join_online_members_to_group(group_id: int, members: List[str]):
    from socket_manager import _sid_to_user
    for sid, username in list(_sid_to_user.items()):
        if username in members:
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
    if group_id is not None:
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.group_id == group_id)
        )
    elif peer == "__global__":
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.recipient == "__global__")
        )
    elif peer:
        stmt = (
            select(ChatMessage)
            .where(
                or_(
                    and_(ChatMessage.sender == current_user.username, ChatMessage.recipient == peer),
                    and_(ChatMessage.sender == peer, ChatMessage.recipient == current_user.username)
                )
            )
        )
    else:
        raise HTTPException(status_code=400, detail="Either peer or group_id is required")
    
    # Get the last `limit` messages sorted chronologically
    stmt = stmt.order_by(ChatMessage.id.desc()).limit(limit)
    result = await db.execute(stmt)
    messages = result.scalars().all()
    
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
        # For groups, we can support individual read tracking, but for simplicity
        # we consider it read when history is loaded.
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
    from sqlalchemy import func
    stmt = (
        select(ChatMessage.sender, func.count(ChatMessage.id))
        .where(and_(ChatMessage.recipient == current_user.username, ChatMessage.is_read == False))
        .group_by(ChatMessage.sender)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return {row[0]: row[1] for row in rows}

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
    members_set = set(data.members)
    members_set.add(current_user.username)

    new_group = Group(name=data.name, created_by=current_user.username)
    db.add(new_group)
    await db.flush()

    for username in members_set:
        db.add(GroupMember(group_id=new_group.id, username=username))

    await db.commit()
    await db.refresh(new_group)

    # Put all online member sockets into the new group room
    await join_online_members_to_group(new_group.id, list(members_set))

    # Emit socket event so everyone online in the group syncs it
    await sio.emit("group_created", {
        "id": new_group.id,
        "name": new_group.name,
        "created_by": new_group.created_by,
        "members": list(members_set)
    }, room=f"group:{new_group.id}")

    return {
        "success": True,
        "id": new_group.id,
        "name": new_group.name,
        "created_by": new_group.created_by,
        "members": list(members_set)
    }

@router.get("/groups")
async def get_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all groups the current user is a member of, along with member lists."""
    subq = select(GroupMember.group_id).where(GroupMember.username == current_user.username)
    stmt_groups = select(Group).where(Group.id.in_(subq))
    res_groups = await db.execute(stmt_groups)
    groups = res_groups.scalars().all()

    group_list = []
    for g in groups:
        stmt_m = select(GroupMember.username).where(GroupMember.group_id == g.id)
        res_m = await db.execute(stmt_m)
        members = res_m.scalars().all()
        group_list.append({
            "id": g.id,
            "name": g.name,
            "created_by": g.created_by,
            "created_at": g.created_at.isoformat() if g.created_at else None,
            "members": members
        })
    return group_list

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
    # 1. Fetch all groups current_user belongs to
    subq = select(GroupMember.group_id).where(GroupMember.username == current_user.username)
    stmt_groups = select(Group).where(Group.id.in_(subq))
    res_groups = await db.execute(stmt_groups)
    groups = res_groups.scalars().all()

    threads = []
    
    # Process Group Threads
    for g in groups:
        stmt_m = select(GroupMember.username).where(GroupMember.group_id == g.id)
        res_m = await db.execute(stmt_m)
        members = res_m.scalars().all()

        # Get last message
        stmt_msg = (
            select(ChatMessage)
            .where(ChatMessage.group_id == g.id)
            .order_by(ChatMessage.id.desc())
            .limit(1)
        )
        res_msg = await db.execute(stmt_msg)
        last_msg = res_msg.scalar_one_or_none()

        last_msg_data = None
        if last_msg:
            last_msg_data = {
                "sender": last_msg.sender,
                "content": last_msg.content or (f"[Attachment: {last_msg.attachment_name}]" if last_msg.attachment_name else ""),
                "created_at": last_msg.created_at.isoformat() if last_msg.created_at else None
            }

        threads.append({
            "type": "group",
            "group_id": g.id,
            "name": g.name,
            "members": list(members),
            "last_message": last_msg_data,
            "unread_count": 0
        })

    # 2. Fetch all DMs (group_id is null, recipient is not __global__)
    stmt_peers = (
        select(ChatMessage.sender, ChatMessage.recipient)
        .where(
            and_(
                ChatMessage.group_id == None,
                ChatMessage.recipient != "__global__",
                or_(ChatMessage.sender == current_user.username, ChatMessage.recipient == current_user.username)
            )
        )
    )
    res_peers = await db.execute(stmt_peers)
    rows = res_peers.all()
    peers = set()
    for row in rows:
        if row[0] == current_user.username and row[1] == current_user.username:
            peers.add(current_user.username)
        else:
            if row[0] != current_user.username:
                peers.add(row[0])
            if row[1] != current_user.username:
                peers.add(row[1])

    # For each peer, get last message and unread count
    for peer in peers:
        stmt_msg = (
            select(ChatMessage)
            .where(
                and_(
                    ChatMessage.group_id == None,
                    or_(
                        and_(ChatMessage.sender == current_user.username, ChatMessage.recipient == peer),
                        and_(ChatMessage.sender == peer, ChatMessage.recipient == current_user.username)
                    )
                )
            )
            .order_by(ChatMessage.id.desc())
            .limit(1)
        )
        res_msg = await db.execute(stmt_msg)
        last_msg = res_msg.scalar_one_or_none()

        last_msg_data = None
        if last_msg:
            last_msg_data = {
                "sender": last_msg.sender,
                "content": last_msg.content or (f"[Attachment: {last_msg.attachment_name}]" if last_msg.attachment_name else ""),
                "created_at": last_msg.created_at.isoformat() if last_msg.created_at else None
            }

        stmt_unread = (
            select(func.count(ChatMessage.id))
            .where(and_(ChatMessage.sender == peer, ChatMessage.recipient == current_user.username, ChatMessage.is_read == False))
        )
        res_unread = await db.execute(stmt_unread)
        unread_count = res_unread.scalar() or 0

        threads.append({
            "type": "dm",
            "peer": peer,
            "last_message": last_msg_data,
            "unread_count": unread_count
        })

    # Sort threads by last message timestamp desc
    def get_sort_key(t):
        if t["last_message"] and t["last_message"]["created_at"]:
            return t["last_message"]["created_at"]
        return ""
    threads.sort(key=get_sort_key, reverse=True)

    return threads

@router.put("/groups/{group_id}")
async def edit_group(
    group_id: int,
    data: GroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Edit group name and memberships."""
    g_stmt = select(Group).where(Group.id == group_id)
    g_res = await db.execute(g_stmt)
    group = g_res.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    group.name = data.name

    # Clear old members
    await db.execute(delete(GroupMember).where(GroupMember.group_id == group_id))

    # Add new members
    members_set = set(data.members)
    members_set.add(current_user.username)
    for username in members_set:
        db.add(GroupMember(group_id=group_id, username=username))

    await db.commit()

    # Put new online members into room
    await join_online_members_to_group(group_id, list(members_set))

    # Emit socket event so clients sync group updates
    await sio.emit("group_updated", {
        "id": group_id,
        "name": group.name,
        "members": list(members_set)
    }, room=f"group:{group_id}")

    return {"success": True}

@router.delete("/threads/dm/{peer}")
async def delete_dm_thread(
    peer: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Hard-delete all messages in a direct conversation for both sides."""
    stmt = delete(ChatMessage).where(
        or_(
            and_(ChatMessage.sender == current_user.username, ChatMessage.recipient == peer),
            and_(ChatMessage.sender == peer, ChatMessage.recipient == current_user.username)
        )
    )
    await db.execute(stmt)
    await db.commit()
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
    group_stmt = select(Group).where(Group.id == group_id)
    res_group = await db.execute(group_stmt)
    group = res_group.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group.created_by == current_user.username:
        await db.execute(delete(GroupMember).where(GroupMember.group_id == group_id))
        await db.execute(delete(ChatMessage).where(ChatMessage.group_id == group_id))
        await db.execute(delete(Group).where(Group.id == group_id))
    else:
        await db.execute(
            delete(GroupMember).where(
                and_(GroupMember.group_id == group_id, GroupMember.username == current_user.username)
            )
        )
    
    await db.commit()
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
    result = await db.execute(select(ChatMessage).where(ChatMessage.id == msg_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender != current_user.username:
        raise HTTPException(status_code=403, detail="Cannot edit someone else's message")
    
    msg.content = content.strip()
    msg.is_edited = True
    await db.commit()
    
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
    result = await db.execute(select(ChatMessage).where(ChatMessage.id == msg_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender != current_user.username:
        raise HTTPException(status_code=403, detail="Cannot delete someone else's message")
    
    msg.is_deleted = True
    msg.content = "This message was deleted."
    msg.attachment_path = None
    msg.attachment_name = None
    await db.commit()
    
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
    import json
    result = await db.execute(select(ChatMessage).where(ChatMessage.id == msg_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    
    reactions = json.loads(msg.reactions) if msg.reactions else {}
    already_had_emoji = (emoji in reactions) and (current_user.username in reactions[emoji])
    
    # Remove user from all reaction lists
    for k in list(reactions.keys()):
        if current_user.username in reactions[k]:
            reactions[k].remove(current_user.username)
            if not reactions[k]:
                del reactions[k]
                
    # If they did not already have this emoji, add it
    if not already_had_emoji:
        if emoji not in reactions:
            reactions[emoji] = []
        reactions[emoji].append(current_user.username)
        
    msg.reactions = json.dumps(reactions)
    await db.commit()
    
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

