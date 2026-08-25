import logging
from typing import List, Optional, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, and_, update, delete, func

from models.chat import ChatMessage, Group, GroupMember
from models.user import User

logger = logging.getLogger("kmti_backend.chat.service")

class ChatService:
    @staticmethod
    async def get_chat_history(db: AsyncSession, current_username: str, peer: Optional[str] = None, group_id: Optional[int] = None, limit: int = 50):
        if group_id is not None:
            stmt = select(ChatMessage).where(ChatMessage.group_id == group_id)
        elif peer == "__global__":
            stmt = select(ChatMessage).where(ChatMessage.recipient == "__global__")
        elif peer:
            stmt = select(ChatMessage).where(
                and_(
                    ChatMessage.group_id == None,
                    or_(
                        and_(func.lower(ChatMessage.sender) == current_username.lower(), func.lower(ChatMessage.recipient) == peer.lower()),
                        and_(func.lower(ChatMessage.sender) == peer.lower(), func.lower(ChatMessage.recipient) == current_username.lower())
                    )
                )
            )
        else:
            raise ValueError("Either peer or group_id is required")
        
        stmt = stmt.order_by(ChatMessage.id.desc()).limit(limit)
        result = await db.execute(stmt)
        return result.scalars().all()

    @staticmethod
    async def get_unread_counts(db: AsyncSession, current_username: str):
        stmt = (
            select(ChatMessage.sender, func.count(ChatMessage.id))
            .where(and_(func.lower(ChatMessage.recipient) == current_username.lower(), ChatMessage.is_read == False))
            .group_by(ChatMessage.sender)
        )
        result = await db.execute(stmt)
        return {row[0]: row[1] for row in result.all()}

    @staticmethod
    async def get_groups(db: AsyncSession, current_username: str):
        subq = select(GroupMember.group_id).where(func.lower(GroupMember.username) == current_username.lower())
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

    @staticmethod
    async def get_chat_threads(db: AsyncSession, current_username: str):
        from collections import defaultdict
        clean_user = current_username.lower().strip()

        # 1. Fetch all groups current_user belongs to
        subq = select(GroupMember.group_id).where(func.lower(GroupMember.username) == clean_user)
        stmt_groups = select(Group).where(Group.id.in_(subq))
        res_groups = await db.execute(stmt_groups)
        groups = res_groups.scalars().all()

        threads = []
        group_ids = [g.id for g in groups]

        if group_ids:
            # Batch fetch all group members in 1 query
            stmt_all_members = select(GroupMember.group_id, GroupMember.username).where(GroupMember.group_id.in_(group_ids))
            res_members = await db.execute(stmt_all_members)
            group_members_map = defaultdict(list)
            for g_id, uname in res_members.all():
                group_members_map[g_id].append(uname)

            # Batch fetch last message for all groups in 1 query
            subq_last_group_msg = (
                select(func.max(ChatMessage.id).label("max_id"))
                .where(ChatMessage.group_id.in_(group_ids))
                .group_by(ChatMessage.group_id)
            )
            stmt_last_group_msgs = select(ChatMessage).where(ChatMessage.id.in_(subq_last_group_msg))
            res_last_group_msgs = await db.execute(stmt_last_group_msgs)
            last_group_msg_map = {m.group_id: m for m in res_last_group_msgs.scalars().all()}

            for g in groups:
                last_msg = last_group_msg_map.get(g.id)
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
                    "members": group_members_map.get(g.id, []),
                    "last_message": last_msg_data,
                    "unread_count": 0
                })

        # 2. Fetch all DMs (group_id is null, recipient is not __global__)
        # Batch unread counts per peer in 1 query
        stmt_unread = (
            select(func.lower(ChatMessage.sender), func.count(ChatMessage.id))
            .where(
                and_(
                    ChatMessage.group_id == None,
                    func.lower(ChatMessage.recipient) == clean_user,
                    ChatMessage.is_read == False
                )
            )
            .group_by(func.lower(ChatMessage.sender))
        )
        res_unread = await db.execute(stmt_unread)
        unread_map = {row[0]: row[1] for row in res_unread.all()}

        # Fetch all DM messages involving this user to build peer list and latest message
        stmt_peers = (
            select(ChatMessage)
            .where(
                and_(
                    ChatMessage.group_id == None,
                    ChatMessage.recipient != "__global__",
                    or_(
                        func.lower(ChatMessage.sender) == clean_user,
                        func.lower(ChatMessage.recipient) == clean_user
                    )
                )
            )
            .order_by(ChatMessage.id.desc())
        )
        res_dm_msgs = await db.execute(stmt_peers)
        dm_msgs = res_dm_msgs.scalars().all()

        # Deduplicate by peer
        seen_peers = set()
        for msg in dm_msgs:
            s_lower = (msg.sender or "").lower().strip()
            r_lower = (msg.recipient or "").lower().strip()

            if s_lower == clean_user and r_lower == clean_user:
                peer_lower = clean_user
                display_peer = msg.sender
            elif s_lower == clean_user:
                peer_lower = r_lower
                display_peer = msg.recipient
            else:
                peer_lower = s_lower
                display_peer = msg.sender

            if not peer_lower or peer_lower == "__global__":
                continue

            if peer_lower not in seen_peers:
                seen_peers.add(peer_lower)
                last_msg_data = {
                    "sender": msg.sender,
                    "content": msg.content or (f"[Attachment: {msg.attachment_name}]" if msg.attachment_name else ""),
                    "created_at": msg.created_at.isoformat() if msg.created_at else None
                }
                threads.append({
                    "type": "dm",
                    "peer": display_peer,
                    "last_message": last_msg_data,
                    "unread_count": unread_map.get(peer_lower, 0)
                })

        # Sort threads by last message timestamp desc
        def get_sort_key(t):
            if t["last_message"] and t["last_message"]["created_at"]:
                return t["last_message"]["created_at"]
            return ""
        threads.sort(key=get_sort_key, reverse=True)

        return threads

    @staticmethod
    async def create_group(db: AsyncSession, current_username: str, name: str, members: List[str]):
        members_set = set(members)
        members_set.add(current_username)

        new_group = Group(name=name, created_by=current_username)
        db.add(new_group)
        await db.flush()

        for username in members_set:
            db.add(GroupMember(group_id=new_group.id, username=username))

        await db.commit()
        await db.refresh(new_group)
        return new_group, list(members_set)

    @staticmethod
    async def edit_group(db: AsyncSession, group_id: int, current_username: str, name: str, members: List[str]):
        g_stmt = select(Group).where(Group.id == group_id)
        g_res = await db.execute(g_stmt)
        group = g_res.scalar_one_or_none()
        if not group:
            raise ValueError("Group not found")

        group.name = name

        # Clear old members
        await db.execute(delete(GroupMember).where(GroupMember.group_id == group_id))

        # Add new members
        members_set = set(members)
        members_set.add(current_username)
        for username in members_set:
            db.add(GroupMember(group_id=group_id, username=username))

        await db.commit()
        return group, list(members_set)

    @staticmethod
    async def delete_dm_thread(db: AsyncSession, current_username: str, peer: str):
        c_user = current_username.lower().strip()
        c_peer = peer.lower().strip()
        stmt = delete(ChatMessage).where(
            and_(
                ChatMessage.group_id == None,
                or_(
                    and_(func.lower(ChatMessage.sender) == c_user, func.lower(ChatMessage.recipient) == c_peer),
                    and_(func.lower(ChatMessage.sender) == c_peer, func.lower(ChatMessage.recipient) == c_user)
                )
            )
        )
        await db.execute(stmt)
        await db.commit()

    @staticmethod
    async def delete_group_thread(db: AsyncSession, current_username: str, group_id: int):
        group_stmt = select(Group).where(Group.id == group_id)
        res_group = await db.execute(group_stmt)
        group = res_group.scalar_one_or_none()
        if not group:
            raise ValueError("Group not found")

        is_creator = group.created_by.lower().strip() == current_username.lower().strip()
        if is_creator:
            await db.execute(delete(GroupMember).where(GroupMember.group_id == group_id))
            await db.execute(delete(ChatMessage).where(ChatMessage.group_id == group_id))
            await db.execute(delete(Group).where(Group.id == group_id))
            await db.commit()
            return True, [], group.name
        else:
            await db.execute(
                delete(GroupMember).where(
                    and_(
                        GroupMember.group_id == group_id,
                        func.lower(GroupMember.username) == current_username.lower().strip()
                    )
                )
            )
            await db.commit()
            # Fetch remaining members
            stmt_m = select(GroupMember.username).where(GroupMember.group_id == group_id)
            res_m = await db.execute(stmt_m)
            remaining_members = list(res_m.scalars().all())
            return False, remaining_members, group.name


    @staticmethod
    async def edit_message(db: AsyncSession, current_username: str, msg_id: int, content: str):
        result = await db.execute(select(ChatMessage).where(ChatMessage.id == msg_id))
        msg = result.scalar_one_or_none()
        if not msg:
            raise ValueError("Message not found")
        if msg.sender != current_username:
            raise PermissionError("Cannot edit someone else's message")
        
        msg.content = content.strip()
        msg.is_edited = True
        await db.commit()
        return msg

    @staticmethod
    async def delete_message(db: AsyncSession, current_username: str, msg_id: int):
        result = await db.execute(select(ChatMessage).where(ChatMessage.id == msg_id))
        msg = result.scalar_one_or_none()
        if not msg:
            raise ValueError("Message not found")
        if msg.sender != current_username:
            raise PermissionError("Cannot delete someone else's message")
        
        msg.is_deleted = True
        msg.content = "This message was deleted."
        msg.attachment_path = None
        msg.attachment_name = None
        await db.commit()
        return msg

    @staticmethod
    async def react_to_message(db: AsyncSession, current_username: str, msg_id: int, emoji: str):
        import json
        result = await db.execute(select(ChatMessage).where(ChatMessage.id == msg_id))
        msg = result.scalar_one_or_none()
        if not msg:
            raise ValueError("Message not found")
        
        reactions = json.loads(msg.reactions) if msg.reactions else {}
        already_had_emoji = (emoji in reactions) and (current_username in reactions[emoji])
        
        # Remove user from all reaction lists
        for k in list(reactions.keys()):
            if current_username in reactions[k]:
                reactions[k].remove(current_username)
                if not reactions[k]:
                    del reactions[k]
                    
        # If they did not already have this emoji, add it
        if not already_had_emoji:
            if emoji not in reactions:
                reactions[emoji] = []
            reactions[emoji].append(current_username)
            
        msg.reactions = json.dumps(reactions)
        await db.commit()
        return msg

    @staticmethod
    async def pin_message(db: AsyncSession, current_username: str, msg_id: int):
        result = await db.execute(select(ChatMessage).where(ChatMessage.id == msg_id))
        msg = result.scalar_one_or_none()
        if not msg:
            raise ValueError("Message not found")
        
        msg.is_pinned = not msg.is_pinned
        msg.pinned_by = current_username if msg.is_pinned else None
        await db.commit()
        return msg

    @staticmethod
    async def get_thread_media(db: AsyncSession, current_username: str, peer: Optional[str] = None, group_id: Optional[int] = None):
        if group_id is not None:
            stmt = select(ChatMessage).where(and_(ChatMessage.group_id == group_id, ChatMessage.is_deleted == False))
        elif peer == "__global__":
            stmt = select(ChatMessage).where(and_(ChatMessage.recipient == "__global__", ChatMessage.is_deleted == False))
        elif peer:
            stmt = select(ChatMessage).where(
                and_(
                    or_(
                        and_(ChatMessage.sender == current_username, ChatMessage.recipient == peer),
                        and_(ChatMessage.sender == peer, ChatMessage.recipient == current_username)
                    ),
                    ChatMessage.is_deleted == False
                )
            )
        else:
            raise ValueError("Either peer or group_id is required")

        result = await db.execute(stmt.order_by(ChatMessage.id.desc()))
        messages = result.scalars().all()

        media = []
        files = []
        links = []

        import re
        url_regex = re.compile(r'https?://[^\s]+')

        for m in messages:
            if m.attachment_path and m.attachment_name:
                filename = m.attachment_name.lower()
                is_img_vid = any(filename.endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm'])
                item = {
                    "id": m.id,
                    "sender": m.sender,
                    "name": m.attachment_name,
                    "path": m.attachment_path,
                    "created_at": m.created_at.isoformat() if m.created_at else None
                }
                if is_img_vid:
                    media.append(item)
                else:
                    files.append(item)

            if m.content:
                urls = url_regex.findall(m.content)
                for u in urls:
                    links.append({
                        "id": m.id,
                        "sender": m.sender,
                        "url": u,
                        "created_at": m.created_at.isoformat() if m.created_at else None
                    })

        return {"media": media, "files": files, "links": links}

