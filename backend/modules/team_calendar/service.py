from datetime import date, datetime, timedelta, time as dt_time
from typing import List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from models.user import User, UserRole
from models.fms import FmsUser, FmsAssignment

_last_fms_sync_time = 0.0
EXCLUDED_USERNAMES = {"test", "test_user", "team.leader", "test fms assignee"}

class TeamCalendarService:
    @staticmethod
    async def sync_fms_users_to_local(db: AsyncSession, fms_db: AsyncSession):
        global _last_fms_sync_time
        import time
        now = time.time()
        if now - _last_fms_sync_time < 300:
            return
        _last_fms_sync_time = now

        try:
            # Query FMS users
            fms_result = await fms_db.execute(select(FmsUser))
            fms_users = fms_result.scalars().all()
            
            # Query local users
            local_result = await db.execute(select(User))
            local_users = local_result.scalars().all()
            local_user_names = {u.username.lower() for u in local_users}
            
            updated = False
            for fu in fms_users:
                uname_lower = fu.username.lower()
                if uname_lower in EXCLUDED_USERNAMES:
                    continue
                if uname_lower not in local_user_names:
                    mapped_role = UserRole.user
                    if fu.role == 'ADMIN':
                        mapped_role = UserRole.admin
                    
                    dummy_hash = "$2b$12$DummyHashNotAValidPasswordSaltDisableDirectLogin12345"
                    new_user = User(
                        username=fu.username,
                        hashed_password=dummy_hash,
                        role=mapped_role,
                        is_active=True
                    )
                    db.add(new_user)
                    local_user_names.add(uname_lower)
                    updated = True
            
            if updated:
                await db.commit()
        except Exception as e:
            import logging
            logger = logging.getLogger("uvicorn.error")
            logger.warning(f"Failed to synchronize FMS users to local DB: {e}")

    @staticmethod
    async def get_user_maps(db: AsyncSession) -> Tuple[Dict[int, str], Dict[str, int]]:
        user_res = await db.execute(select(User))
        users = user_res.scalars().all()
        user_map = {u.id: u.username for u in users}
        user_name_to_id = {u.username.lower(): u.id for u in users}
        return user_map, user_name_to_id

    @staticmethod
    async def fetch_fms_assignments_for_grid(fms_db: AsyncSession, start_date: date, end_date: date, user_name_to_id: dict, current_user_id: int) -> Tuple[List[dict], Dict[str, str]]:
        search_start = datetime.combine(start_date, dt_time.min) - timedelta(days=90)
        search_end = datetime.combine(end_date, dt_time.max)
        
        fms_assign_query = (
            select(FmsAssignment)
            .where(
                FmsAssignment.due_date >= search_start,
                FmsAssignment.due_date <= search_end
            )
            .options(selectinload(FmsAssignment.members))
        )
        
        fms_assign_res = await fms_db.execute(fms_assign_query)
        fms_assignments = fms_assign_res.scalars().all()
        
        fms_users_res = await fms_db.execute(select(FmsUser))
        fms_users_list = fms_users_res.scalars().all()
        fms_user_id_to_obj = {u.id: u for u in fms_users_list}
        fms_username_to_team = {u.username.lower(): u.team for u in fms_users_list}

        response_events = []
        for fa in fms_assignments:
            if fa.due_date:
                due_date_obj = fa.due_date.date()
            else:
                due_date_obj = (fa.created_at.date() + timedelta(days=7)) if fa.created_at else start_date
            
            if fa.created_at:
                start_date_obj = fa.created_at.date()
            else:
                start_date_obj = due_date_obj
            
            if due_date_obj < start_date or start_date_obj > end_date:
                continue
            
            for member in fa.members:
                fms_u = fms_user_id_to_obj.get(member.user_id)
                if not fms_u or fms_u.username.lower() in EXCLUDED_USERNAMES:
                    continue
                
                l_user_id = user_name_to_id.get(fms_u.username.lower(), current_user_id)
                
                if member.status == "submitted" or fa.status == "completed":
                    t_status = "Completed"
                else:
                    t_status = "Claimed"
                
                response_events.append({
                    "id": f"fms_{fa.id}_{member.id}",
                    "event_type": "Task_Claim",
                    "user_id": l_user_id,
                    "username": fms_u.username,
                    "engineer_name": None,
                    "team": fms_u.team,
                    "todo_id": fa.id,
                    "todo_title": fa.title,
                    "todo_description": fa.description,
                    "todo_priority": getattr(fa, "priority", "Normal"),
                    "todo_status": t_status,
                    "start_date": start_date_obj.isoformat(),
                    "end_date": due_date_obj.isoformat(),
                    "due_date": due_date_obj.isoformat(),
                    "completed_at": (member.submitted_at.isoformat() if member.submitted_at else None) if t_status == "Completed" else None,
                    "status": "Approved",
                    "leave_type": None,
                })
        return response_events, fms_username_to_team
