from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.database import get_db, get_fms_db
from core.auth import get_current_user
from models.user import User, UserRole
from models.fms import FmsUser, FmsAssignment, FmsAssignmentMember

from team_calendar.domain.rules import DomainException
from team_calendar.infrastructure.models import DbCalendarEvent
from team_calendar.infrastructure.repositories import (
    SqlAlchemyTodoRepository,
    SqlAlchemyCalendarEventRepository,
)
from team_calendar.application.use_cases import (
    ClaimTaskUseCase,
    RequestDayOffUseCase,
    FetchTeamGridUseCase,
    CreateTodoUseCase,
    CompleteTodoUseCase,
    ApproveEventUseCase,
    AssignTaskUseCase,
)

router = APIRouter()

# --- Request/Response Pydantic Models ---

class TodoCreatePayload(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    priority: str = Field(default="Normal", pattern="^(Low|Normal|High|Critical)$")

class ClaimTaskPayload(BaseModel):
    todo_id: int
    user_id: Optional[int] = None # Defaults to current user if not provided
    engineer_name: Optional[str] = None
    start_date: date
    end_date: date

class AssignTaskPayload(BaseModel):
    todo_id: int
    target_user_id: int
    engineer_name: Optional[str] = None
    start_date: date
    end_date: date

class DayOffPayload(BaseModel):
    user_id: Optional[int] = None # Defaults to current user if not provided
    engineer_name: Optional[str] = None
    start_date: date
    end_date: date
    leave_type: str = Field(default="Vacation", pattern="^(Vacation|Sick|Personal|Holiday|Other)$")

class CompanyEventPayload(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    category: str = Field(default="Other", pattern="^(Holiday|Birthday|Outing|Meeting|Other)$")
    start_date: date
    end_date: date



async def sync_fms_users_to_local(db: AsyncSession, fms_db: AsyncSession):
    """
    Synchronizes users from the remote FMS database to the local kmti_users database,
    ensuring they have valid local accounts with the user role.
    """
    try:
        # Query FMS users
        fms_result = await fms_db.execute(select(FmsUser))
        fms_users = fms_result.scalars().all()
        
        # Query local users
        local_result = await db.execute(select(User))
        local_users = local_result.scalars().all()
        local_user_names = {u.username.lower() for u in local_users}
        
        EXCLUDED_USERNAMES = {"test", "test_user", "team.leader", "test fms assignee"}
        
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


# --- Routing Endpoints ---

@router.get("/grid")
async def get_team_grid(
    start_date: date,
    end_date: date,
    db: AsyncSession = Depends(get_db),
    fms_db: AsyncSession = Depends(get_fms_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetch the complete team calendar grid data within a date range.
    Queries all task claims and absences.
    """
    # 1. Synchronize users from FMS on-the-fly
    await sync_fms_users_to_local(db, fms_db)

    event_repo = SqlAlchemyCalendarEventRepository(db)
    use_case = FetchTeamGridUseCase(event_repo)
    events = await use_case.execute(start_date, end_date)

    # Resolve usernames: single bulk query
    user_res = await db.execute(select(User))
    users = user_res.scalars().all()
    user_map = {u.id: u.username for u in users}
    user_name_to_id = {u.username.lower(): u.id for u in users}

    # Bulk-fetch all todos in one query instead of N+1 per event
    todo_repo = SqlAlchemyTodoRepository(db)
    todo_ids = list({e.todo_id for e in events if e.todo_id is not None})
    todos_list = await todo_repo.get_by_ids(todo_ids)
    todo_map = {t.id: t for t in todos_list}

    response_events = []
    EXCLUDED_USERNAMES = {"test", "test_user", "team.leader", "test fms assignee"}
    for e in events:
        uname = user_map.get(e.user_id, "Unknown User")
        if uname.lower() in EXCLUDED_USERNAMES:
            continue
        todo = todo_map.get(e.todo_id) if e.todo_id else None
        response_events.append({
            "id": e.id,
            "event_type": e.event_type,
            "user_id": e.user_id,
            "username": uname,
            "engineer_name": e.engineer_name,
            "todo_id": e.todo_id,
            "todo_title": (todo.title[6:] if todo.title.startswith(" ") else todo.title) if todo else None,
            "todo_description": todo.description if todo else None,
            "todo_priority": todo.priority if todo else None,
            "todo_status": todo.status if todo else None,
            "start_date": e.start_date.isoformat(),
            "end_date": e.end_date.isoformat(),
            "status": e.status,
            "leave_type": e.leave_type,
        })

    # 2. Fetch assignments from remote FMS database in the date range
    try:
        from datetime import datetime, time as dt_time
        start_datetime = datetime.combine(start_date, dt_time.min)
        end_datetime = datetime.combine(end_date, dt_time.max)
        
        fms_assign_query = (
            select(FmsAssignment)
            .where(
                FmsAssignment.due_date >= start_datetime,
                FmsAssignment.due_date <= end_datetime
            )
            .options(selectinload(FmsAssignment.members))
        )
        
        fms_assign_res = await fms_db.execute(fms_assign_query)
        fms_assignments = fms_assign_res.scalars().all()
        
        # Load FMS users for mapping names
        fms_users_res = await fms_db.execute(select(FmsUser))
        fms_users_list = fms_users_res.scalars().all()
        fms_user_id_to_obj = {u.id: u for u in fms_users_list}
        
        EXCLUDED_USERNAMES = {"test", "test_user", "team.leader", "test fms assignee"}
        for fa in fms_assignments:
            for member in fa.members:
                fms_u = fms_user_id_to_obj.get(member.user_id)
                if not fms_u or fms_u.username.lower() in EXCLUDED_USERNAMES:
                    continue
                
                l_user_id = user_name_to_id.get(fms_u.username.lower(), current_user.id)
                evt_date = fa.due_date.date() if fa.due_date else (fa.created_at.date() if fa.created_at else start_date)
                t_status = "Completed" if (member.status == "submitted" or fa.status == "completed") else "Claimed"
                
                response_events.append({
                    "id": 3000000 + member.id,
                    "event_type": "Task_Claim",
                    "user_id": l_user_id,
                    "username": fms_u.username,
                    "engineer_name": fms_u.fullName,
                    "todo_id": None,
                    "todo_title": fa.title,
                    "todo_description": fa.description,
                    "todo_priority": "Normal",
                    "todo_status": t_status,
                    "start_date": evt_date.isoformat(),
                    "end_date": evt_date.isoformat(),
                    "status": "Approved",
                    "leave_type": None,
                })
    except Exception as e:
        import logging
        logger = logging.getLogger("uvicorn.error")
        logger.warning(f"Failed to query FMS assignments for grid: {e}")

    return {
        "success": True,
        "events": response_events
    }


@router.get("/todos")
async def get_backlog(
    db: AsyncSession = Depends(get_db),
    fms_db: AsyncSession = Depends(get_fms_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the unassigned task backlog. Includes uncompleted FMS assignments.
    """
    todo_repo = SqlAlchemyTodoRepository(db)
    todos = await todo_repo.get_all_backlog()
    
    backlog_items = [
        {
            "id": t.id,
            "title": t.title[6:] if t.title.startswith("[FMS] ") else t.title,
            "description": t.description,
            "status": t.status,
            "priority": t.priority,
            "created_at": t.created_at,
        }
        for t in todos
    ]
    
    # Query active/uncompleted assignments from FMS
    try:
        fms_query = select(FmsAssignment).where(FmsAssignment.status != "completed").order_by(FmsAssignment.created_at.desc())
        fms_res = await fms_db.execute(fms_query)
        fms_assignments = fms_res.scalars().all()
        
        for fa in fms_assignments:
            backlog_items.append({
                "id": -(4000000 + fa.id),
                "title": fa.title,
                "description": fa.description,
                "status": "Pending",
                "priority": "Normal",
                "created_at": fa.created_at.isoformat() if fa.created_at else None,
            })
    except Exception as e:
        import logging
        logger = logging.getLogger("uvicorn.error")
        logger.warning(f"Failed to query FMS backlog assignments: {e}")
        
    return {
        "success": True,
        "todos": backlog_items
    }


@router.post("/todos")
async def create_todo(
    payload: TodoCreatePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new unassigned Todo. Available to all workstation users.
    """
    todo_repo = SqlAlchemyTodoRepository(db)
    use_case = CreateTodoUseCase(todo_repo)
    todo = await use_case.execute(payload.title, payload.description, payload.priority)
    return {
        "success": True,
        "todo": {
            "id": todo.id,
            "title": todo.title,
            "description": todo.description,
            "status": todo.status,
            "priority": todo.priority,
            "created_at": todo.created_at,
        }
    }


@router.post("/claims")
async def claim_task(
    payload: ClaimTaskPayload,
    db: AsyncSession = Depends(get_db),
    fms_db: AsyncSession = Depends(get_fms_db),
    current_user: User = Depends(get_current_user)
):
    """
    Claim a backlog todo, placing it on the shared grid for a range of dates.
    Enforces Singular Ownership and Absence Supremacy at the domain layer.
    """
    if payload.todo_id < 0:
        fms_id = -payload.todo_id - 4000000
        fms_assign = await fms_db.get(FmsAssignment, fms_id)
        if not fms_assign:
            raise HTTPException(status_code=404, detail="FMS Assignment not found.")
        
        # Check if local shadow todo exists
        title_val = fms_assign.title
        from team_calendar.infrastructure.models import DbTodo
        res = await db.execute(select(DbTodo).where(DbTodo.title == title_val))
        db_todo = res.scalar_one_or_none()
        
        if not db_todo:
            db_todo = DbTodo(
                title=title_val,
                description=fms_assign.description,
                status="Pending",
                priority="Normal"
            )
            db.add(db_todo)
            await db.commit()
            await db.refresh(db_todo)
        
        payload.todo_id = db_todo.id

    target_user_id = payload.user_id if payload.user_id is not None else current_user.id

    todo_repo = SqlAlchemyTodoRepository(db)
    event_repo = SqlAlchemyCalendarEventRepository(db)
    use_case = ClaimTaskUseCase(todo_repo, event_repo)

    try:
        event = await use_case.execute(
            todo_id=payload.todo_id,
            user_id=target_user_id,
            start_date=payload.start_date,
            end_date=payload.end_date,
            engineer_name=payload.engineer_name
        )
        return {
            "success": True,
            "message": "Task successfully claimed on your calendar.",
            "event": {
                "id": event.id,
                "event_type": event.event_type,
                "user_id": event.user_id,
                "todo_id": event.todo_id,
                "start_date": event.start_date.isoformat(),
                "end_date": event.end_date.isoformat(),
                "status": event.status
            }
        }
    except DomainException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/absences")
async def request_day_off(
    payload: DayOffPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Request a Day Off (protected absence lockout).
    If requested by a normal user, status is 'Pending'.
    If registered by IT/Admin, status is 'Approved'.
    """
    role_str = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    status_val = "Approved" if role_str in ("admin", "it") else "Pending"

    target_user_id = payload.user_id if payload.user_id is not None else current_user.id

    event_repo = SqlAlchemyCalendarEventRepository(db)
    use_case = RequestDayOffUseCase(event_repo)

    try:
        event = await use_case.execute(
            user_id=target_user_id,
            start_date=payload.start_date,
            end_date=payload.end_date,
            engineer_name=payload.engineer_name,
            status=status_val,
            leave_type=payload.leave_type
        )
        return {
            "success": True,
            "message": "Day off requested successfully." if status_val == "Pending" else "Day off scheduled successfully.",
            "event": {
                "id": event.id,
                "event_type": event.event_type,
                "user_id": event.user_id,
                "start_date": event.start_date.isoformat(),
                "end_date": event.end_date.isoformat(),
                "status": event.status
            }
        }
    except DomainException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
@router.post("/company-events")
async def create_company_event(
    payload: CompanyEventPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new Company Event (holidays, birthdays, company outings).
    Only available to Admin and IT roles.
    """
    role_str = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if role_str not in ("admin", "it"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admins or IT members can schedule Company Events."
        )

    # Store directly in the DbCalendarEvent table
    new_event = DbCalendarEvent(
        event_type="Company_Event",
        user_id=current_user.id,
        todo_id=None,
        engineer_name=payload.title,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status="Approved",
        leave_type=payload.category
    )
    db.add(new_event)
    await db.commit()
    await db.refresh(new_event)
    
    return {
        "success": True,
        "message": "Company Event scheduled successfully.",
        "event": {
            "id": new_event.id,
            "event_type": new_event.event_type,
            "user_id": new_event.user_id,
            "engineer_name": new_event.engineer_name,
            "start_date": new_event.start_date.isoformat(),
            "end_date": new_event.end_date.isoformat(),
            "leave_type": new_event.leave_type,
            "status": new_event.status
        }
    }



@router.delete("/todos/{todo_id}")
async def delete_todo(
    todo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Permanently delete a completed todo record and any linked calendar events.
    Only Admin and IT roles can perform this action.
    """
    role_str = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if role_str not in ("admin", "it"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only IT and Admin users can delete task history records."
        )

    todo_repo = SqlAlchemyTodoRepository(db)
    event_repo = SqlAlchemyCalendarEventRepository(db)

    todo = await todo_repo.get_by_id(todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail="Task not found.")

    # Clean up any linked calendar events (Task_Claim rows referencing this todo)
    from sqlalchemy import delete as sa_delete
    from team_calendar.infrastructure.models import DbCalendarEvent
    await db.execute(sa_delete(DbCalendarEvent).where(DbCalendarEvent.todo_id == todo_id))
    await db.commit()

    # Delete the todo itself
    await todo_repo.delete(todo_id)

    return {
        "success": True,
        "message": "Task record permanently deleted."
    }


@router.post("/todos/{todo_id}/complete")
async def complete_todo(
    todo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark a claimed todo task as Completed.
    """
    todo_repo = SqlAlchemyTodoRepository(db)
    use_case = CompleteTodoUseCase(todo_repo)

    try:
        await use_case.execute(todo_id)
        return {
            "success": True,
            "message": "Task marked as completed."
        }
    except DomainException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/events/{event_id}")
async def delete_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cancel a task claim or remove a day off request.
    If a task claim is deleted, the corresponding todo task is returned to 'Pending' status.
    """
    event_repo = SqlAlchemyCalendarEventRepository(db)
    todo_repo = SqlAlchemyTodoRepository(db)

    event = await event_repo.get_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")

    # Restrict deletion to own events unless IT or Admin
    role_str = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if event.user_id != current_user.id and role_str not in ("admin", "it"):
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to cancel other users' events."
        )

    # If it was a task claim, reset status to 'Pending'
    if event.event_type == "Task_Claim" and event.todo_id:
        await todo_repo.update_status(event.todo_id, "Pending")

    await event_repo.delete(event_id)
    return {
        "success": True,
        "message": "Calendar event canceled successfully."
    }


@router.post("/events/{event_id}/approve")
async def approve_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Approve a pending calendar event/absence request.
    Only IT and Admin users can perform this.
    """
    role_str = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if role_str not in ("admin", "it"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only IT and Admin users can approve calendar events."
        )

    event_repo = SqlAlchemyCalendarEventRepository(db)
    use_case = ApproveEventUseCase(event_repo)

    try:
        await use_case.execute(event_id)
        return {
            "success": True,
            "message": "Calendar event approved successfully."
        }
    except DomainException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/assignments")
async def assign_task(
    payload: AssignTaskPayload,
    db: AsyncSession = Depends(get_db),
    fms_db: AsyncSession = Depends(get_fms_db),
    current_user: User = Depends(get_current_user)
):
    """
    Admin/IT assigns a backlog task directly to a target engineer.
    Enforces same Singular Ownership and Absence Supremacy rules as self-claim.
    """
    role_str = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if role_str not in ("admin", "it"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only IT and Admin users can assign tasks to other users."
        )

    if payload.todo_id < 0:
        fms_id = -payload.todo_id - 4000000
        fms_assign = await fms_db.get(FmsAssignment, fms_id)
        if not fms_assign:
            raise HTTPException(status_code=404, detail="FMS Assignment not found.")
        
        # Check if local shadow todo exists
        title_val = fms_assign.title
        from team_calendar.infrastructure.models import DbTodo
        res = await db.execute(select(DbTodo).where(DbTodo.title == title_val))
        db_todo = res.scalar_one_or_none()
        
        if not db_todo:
            db_todo = DbTodo(
                title=title_val,
                description=fms_assign.description,
                status="Pending",
                priority="Normal"
            )
            db.add(db_todo)
            await db.commit()
            await db.refresh(db_todo)
        
        payload.todo_id = db_todo.id

    todo_repo = SqlAlchemyTodoRepository(db)
    event_repo = SqlAlchemyCalendarEventRepository(db)
    use_case = AssignTaskUseCase(todo_repo, event_repo)

    try:
        event = await use_case.execute(
            todo_id=payload.todo_id,
            assigning_user_id=current_user.id,
            target_user_id=payload.target_user_id,
            start_date=payload.start_date,
            end_date=payload.end_date,
            engineer_name=payload.engineer_name
        )
        return {
            "success": True,
            "message": "Task assigned successfully.",
            "event": {
                "id": event.id,
                "event_type": event.event_type,
                "user_id": event.user_id,
                "todo_id": event.todo_id,
                "start_date": event.start_date.isoformat(),
                "end_date": event.end_date.isoformat(),
                "status": event.status
            }
        }
    except DomainException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/active-users")
async def get_active_users(
    db: AsyncSession = Depends(get_db),
    fms_db: AsyncSession = Depends(get_fms_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns all active users. Used by admin assignment modal for the engineer dropdown.
    """
    role_str = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if role_str not in ("admin", "it"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only IT and Admin users can view the active users list."
        )
    
    # Synchronize users from FMS on-the-fly
    await sync_fms_users_to_local(db, fms_db)
    
    result = await db.execute(select(User).where(User.is_active == True).order_by(User.username))
    users = result.scalars().all()
    EXCLUDED_USERNAMES = {"test", "test_user", "team.leader", "test fms assignee"}
    return {
        "success": True,
        "users": [
            {"id": u.id, "username": u.username, "role": u.role.value if hasattr(u.role, "value") else u.role}
            for u in users
            if u.username.lower() not in EXCLUDED_USERNAMES
        ]
    }


@router.get("/pending-approvals")
async def get_pending_approvals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns all pending absence requests. Admin/IT only.
    Used to power the notification badge and approvals panel.
    """
    role_str = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if role_str not in ("admin", "it"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only IT and Admin users can view pending approvals."
        )
    result = await db.execute(
        select(DbCalendarEvent)
        .where(DbCalendarEvent.status == "Pending")
        .where(DbCalendarEvent.event_type == "Day_Off")
        .order_by(DbCalendarEvent.created_at.asc())
    )
    db_events = result.scalars().all()

    user_res = await db.execute(select(User))
    user_map = {u.id: u.username for u in user_res.scalars().all()}

    return {
        "success": True,
        "count": len(db_events),
        "pending": [
            {
                "id": e.id,
                "user_id": e.user_id,
                "username": user_map.get(e.user_id, "Unknown User"),
                "engineer_name": e.engineer_name,
                "start_date": e.start_date.isoformat(),
                "end_date": e.end_date.isoformat(),
                "leave_type": e.leave_type,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in db_events
        ]
    }
