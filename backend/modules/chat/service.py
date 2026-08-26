import logging
import re
from typing import List, Optional, Set, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, and_, update, delete, func
from collections import defaultdict

from models.chat import ChatMessage, Group, GroupMember
from models.user import User
from models.fms import FmsUser
from models.telemetry import WorkstationStatus
from db.database import AsyncSessionLocal, FmsAsyncSessionLocal

logger = logging.getLogger("kmti_backend.chat.service")


async def resolve_user_aliases(identifier: str) -> Dict[str, Any]:
    """
    Resolves any identifier (e.g. 'jethro091', 'Jethro Mendoza', 'Jethro', 'jethro')
    across BOTH databases (kmti_users and kmtifms.users) and telemetry workstation status.
    Returns:
      canonical_username: exact login username (e.g. 'jethro091')
      display_name: presentable name (e.g. 'Jethro')
      full_name: full name (e.g. 'Jethro Mendoza')
      aliases: set of clean lowercase strings for socket rooms and DB lookups
    """
    if not identifier:
        return {"canonical_username": "", "display_name": "", "full_name": "", "aliases": set()}
    
    clean = identifier.lower().strip()
    aliases = {clean}

    canonical_username = identifier
    display_name = identifier
    full_name = identifier

    # 1. Search Secondary FMS DB (kmtifms.users) - Contains 95%+ of employees
    try:
        async with FmsAsyncSessionLocal() as fms_db:
            stmt = select(FmsUser).where(
                or_(
                    func.lower(FmsUser.username) == clean,
                    func.lower(FmsUser.fullName) == clean,
                    func.lower(FmsUser.displayName) == clean
                )
            )
            res = await fms_db.execute(stmt)
            fu = res.scalars().first()

            if fu:
                canonical_username = fu.username or canonical_username
                if fu.username:
                    aliases.add(fu.username.lower().strip())
                if fu.fullName:
                    full_name = fu.fullName
                    aliases.add(fu.fullName.lower().strip())
                if fu.displayName:
                    display_name = fu.displayName
                    aliases.add(fu.displayName.lower().strip())
    except Exception as e:
        logger.warning(f"Error querying FmsUser in resolve_user_aliases: {e}")

    # 2. Search Primary DB (kmti_users) - Admin/IT accounts
    try:
        async with AsyncSessionLocal() as db:
            stmt = select(User).where(
                or_(
                    func.lower(User.username) == clean,
                    func.lower(User.display_name) == clean
                )
            )
            res = await db.execute(stmt)
            u = res.scalars().first()

            if u:
                if not canonical_username or canonical_username == identifier:
                    canonical_username = u.username
                if u.username:
                    aliases.add(u.username.lower().strip())
                if u.display_name:
                    display_name = u.display_name
                    aliases.add(u.display_name.lower().strip())
    except Exception as e:
        logger.warning(f"Error querying User in resolve_user_aliases: {e}")



    # 3. Search WorkstationStatus (kmti_workstation_status)
    try:
        async with AsyncSessionLocal() as db:
            stmt = select(WorkstationStatus).where(
                or_(
                    func.lower(WorkstationStatus.current_user) == clean,
                    func.lower(WorkstationStatus.display_name) == clean
                )
            )
            res = await db.execute(stmt)
            ws = res.scalars().first()
            if ws:
                if ws.current_user:
                    aliases.add(ws.current_user.lower().strip())
                if ws.display_name:
                    aliases.add(ws.display_name.lower().strip())
    except Exception as e:
        pass

    return {
        "canonical_username": canonical_username,
        "display_name": display_name,
        "full_name": full_name,
        "aliases": aliases
    }


class ChatService:
    @staticmethod
    async def get_chat_history(db: AsyncSession, current_username: str, peer: Optional[str] = None, group_id: Optional[int] = None, limit: int = 50):
        if group_id is not None:
            stmt = select(ChatMessage).where(ChatMessage.group_id == group_id)
        elif peer == "__global__":
            stmt = select(ChatMessage).where(ChatMessage.recipient == "__global__")
        elif peer:
            curr_info = await resolve_user_aliases(current_username)
            peer_info = await resolve_user_aliases(peer)
            curr_aliases = list(curr_info["aliases"])
            peer_aliases = list(peer_info["aliases"])

            stmt = select(ChatMessage).where(
                and_(
                    ChatMessage.group_id == None,
                    or_(
                        and_(func.lower(ChatMessage.sender).in_(curr_aliases), func.lower(ChatMessage.recipient).in_(peer_aliases)),
                        and_(func.lower(ChatMessage.sender).in_(peer_aliases), func.lower(ChatMessage.recipient).in_(curr_aliases))
                    )
                )
            )
        else:
            raise ValueError("Either peer or group_id is required")
        
        stmt = stmt.order_by(ChatMessage.id.desc()).limit(limit)
        result = await db.execute(stmt)
        messages = list(result.scalars().all())
        messages.reverse()
        return messages


    @staticmethod
    async def get_unread_counts(db: AsyncSession, current_username: str):
        curr_info = await resolve_user_aliases(current_username)
        curr_aliases = list(curr_info["aliases"])

        stmt = (
            select(func.lower(ChatMessage.sender), func.count(ChatMessage.id))
            .where(and_(func.lower(ChatMessage.recipient).in_(curr_aliases), ChatMessage.is_read == False))
            .group_by(func.lower(ChatMessage.sender))
        )
        result = await db.execute(stmt)
        counts = {}
        for sender_lower, count in result.all():
            counts[sender_lower] = count
        return counts

    @staticmethod
    async def get_groups(db: AsyncSession, current_username: str):
        curr_info = await resolve_user_aliases(current_username)
        curr_aliases = list(curr_info["aliases"])

        subq = select(GroupMember.group_id).where(func.lower(GroupMember.username).in_(curr_aliases))
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
        curr_info = await resolve_user_aliases(current_username)
        curr_aliases = list(curr_info["aliases"])
        clean_user = current_username.lower().strip()

        # 1. Fetch all groups current_user belongs to
        subq = select(GroupMember.group_id).where(func.lower(GroupMember.username).in_(curr_aliases))
        stmt_groups = select(Group).where(Group.id.in_(subq))
        res_groups = await db.execute(stmt_groups)
        groups = res_groups.scalars().all()

        threads = []
        group_ids = [g.id for g in groups]

        if group_ids:
            stmt_all_members = select(GroupMember.group_id, GroupMember.username).where(GroupMember.group_id.in_(group_ids))
            res_members = await db.execute(stmt_all_members)
            group_members_map = defaultdict(list)
            for g_id, uname in res_members.all():
                group_members_map[g_id].append(uname)

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
        stmt_unread = (
            select(func.lower(ChatMessage.sender), func.count(ChatMessage.id))
            .where(
                and_(
                    ChatMessage.group_id == None,
                    func.lower(ChatMessage.recipient).in_(curr_aliases),
                    ChatMessage.is_read == False
                )
            )
            .group_by(func.lower(ChatMessage.sender))
        )
        res_unread = await db.execute(stmt_unread)
        unread_map = {row[0]: row[1] for row in res_unread.all()}

        stmt_peers = (
            select(ChatMessage)
            .where(
                and_(
                    ChatMessage.group_id == None,
                    ChatMessage.recipient != "__global__",
                    or_(
                        func.lower(ChatMessage.sender).in_(curr_aliases),
                        func.lower(ChatMessage.recipient).in_(curr_aliases)
                    )
                )
            )
            .order_by(ChatMessage.id.desc())
        )
        res_dm_msgs = await db.execute(stmt_peers)
        dm_msgs = res_dm_msgs.scalars().all()

        seen_peers = set()
        for msg in dm_msgs:
            s_lower = (msg.sender or "").lower().strip()
            r_lower = (msg.recipient or "").lower().strip()

            if s_lower in curr_aliases and r_lower in curr_aliases:
                peer_lower = clean_user
                display_peer = msg.sender
            elif s_lower in curr_aliases:
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
        await db.execute(delete(GroupMember).where(GroupMember.group_id == group_id))

        members_set = set(members)
        members_set.add(current_username)
        for username in members_set:
            db.add(GroupMember(group_id=group_id, username=username))

        await db.commit()
        return group, list(members_set)

    @staticmethod
    async def delete_dm_thread(db: AsyncSession, current_username: str, peer: str):
        curr_info = await resolve_user_aliases(current_username)
        peer_info = await resolve_user_aliases(peer)
        curr_aliases = list(curr_info["aliases"])
        peer_aliases = list(peer_info["aliases"])

        stmt = delete(ChatMessage).where(
            and_(
                ChatMessage.group_id == None,
                or_(
                    and_(func.lower(ChatMessage.sender).in_(curr_aliases), func.lower(ChatMessage.recipient).in_(peer_aliases)),
                    and_(func.lower(ChatMessage.sender).in_(peer_aliases), func.lower(ChatMessage.recipient).in_(curr_aliases))
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
        
        curr_info = await resolve_user_aliases(current_username)
        if msg.sender.lower().strip() not in curr_info["aliases"]:
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
        
        curr_info = await resolve_user_aliases(current_username)
        if msg.sender.lower().strip() not in curr_info["aliases"]:
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
        
        for k in list(reactions.keys()):
            if current_username in reactions[k]:
                reactions[k].remove(current_username)
                if not reactions[k]:
                    del reactions[k]
                    
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
            curr_info = await resolve_user_aliases(current_username)
            peer_info = await resolve_user_aliases(peer)
            curr_aliases = list(curr_info["aliases"])
            peer_aliases = list(peer_info["aliases"])

            stmt = select(ChatMessage).where(
                and_(
                    or_(
                        and_(func.lower(ChatMessage.sender).in_(curr_aliases), func.lower(ChatMessage.recipient).in_(peer_aliases)),
                        and_(func.lower(ChatMessage.sender).in_(peer_aliases), func.lower(ChatMessage.recipient).in_(curr_aliases))
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
