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
                or_(
                    and_(ChatMessage.sender == current_username, ChatMessage.recipient == peer),
                    and_(ChatMessage.sender == peer, ChatMessage.recipient == current_username)
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
            .where(and_(ChatMessage.recipient == current_username, ChatMessage.is_read == False))
            .group_by(ChatMessage.sender)
        )
        result = await db.execute(stmt)
        return {row[0]: row[1] for row in result.all()}

    @staticmethod
    async def get_groups(db: AsyncSession, current_username: str):
        subq = select(GroupMember.group_id).where(GroupMember.username == current_username)
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
        # 1. Fetch all groups current_user belongs to
        subq = select(GroupMember.group_id).where(GroupMember.username == current_username)
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
                    or_(ChatMessage.sender == current_username, ChatMessage.recipient == current_username)
                )
            )
        )
        res_peers = await db.execute(stmt_peers)
        rows = res_peers.all()
        peers = set()
        for row in rows:
            if row[0] == current_username and row[1] == current_username:
                peers.add(current_username)
            else:
                if row[0] != current_username:
                    peers.add(row[0])
                if row[1] != current_username:
                    peers.add(row[1])

        # For each peer, get last message and unread count
        for peer in peers:
            stmt_msg = (
                select(ChatMessage)
                .where(
                    and_(
                        ChatMessage.group_id == None,
                        or_(
                            and_(ChatMessage.sender == current_username, ChatMessage.recipient == peer),
                            and_(ChatMessage.sender == peer, ChatMessage.recipient == current_username)
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
                .where(and_(ChatMessage.sender == peer, ChatMessage.recipient == current_username, ChatMessage.is_read == False))
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
        stmt = delete(ChatMessage).where(
            or_(
                and_(ChatMessage.sender == current_username, ChatMessage.recipient == peer),
                and_(ChatMessage.sender == peer, ChatMessage.recipient == current_username)
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

        if group.created_by == current_username:
            await db.execute(delete(GroupMember).where(GroupMember.group_id == group_id))
            await db.execute(delete(ChatMessage).where(ChatMessage.group_id == group_id))
            await db.execute(delete(Group).where(Group.id == group_id))
        else:
            await db.execute(
                delete(GroupMember).where(
                    and_(GroupMember.group_id == group_id, GroupMember.username == current_username)
                )
            )
        
        await db.commit()

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
