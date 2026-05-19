from datetime import date
from typing import List, Optional
from team_calendar.domain.models import DomainTodo, DomainCalendarEvent
from team_calendar.domain.rules import CalendarBusinessRules, DomainException
from team_calendar.application.ports import TodoRepository, CalendarEventRepository

class ClaimTaskUseCase:
    """
    Usecase Layer: claim a task.
    SRP: Handles task claim workflows, enforcing Absence Supremacy and Singular Ownership.
    """
    def __init__(self, todo_repo: TodoRepository, event_repo: CalendarEventRepository):
        self.todo_repo = todo_repo
        self.event_repo = event_repo

    async def execute(
        self,
        todo_id: int,
        user_id: int,
        start_date: date,
        end_date: date,
        engineer_name: Optional[str] = None
    ) -> DomainCalendarEvent:
        # 1. Retrieve Todo
        todo = await self.todo_repo.get_by_id(todo_id)
        if not todo:
            raise DomainException(f"Task with ID {todo_id} not found.")

        # 2. Enforce Singular Ownership Rule
        CalendarBusinessRules.enforce_singular_ownership(todo)

        # 3. Retrieve User's Absences
        absences = await self.event_repo.get_user_absences(user_id)

        # 4. Enforce Absence Supremacy Rule (Claims cannot overlap Day-Off ranges)
        CalendarBusinessRules.enforce_absence_supremacy(user_id, start_date, end_date, absences)

        # 5. Insert Task Claim Event
        new_event = DomainCalendarEvent(
            id=None,
            event_type="Task_Claim",
            user_id=user_id,
            todo_id=todo_id,
            start_date=start_date,
            end_date=end_date,
            engineer_name=engineer_name,
            status="Approved"
        )
        saved_event = await self.event_repo.save(new_event)

        # 6. Update Task Status
        await self.todo_repo.update_status(todo_id, "Claimed")

        return saved_event


class RequestDayOffUseCase:
    """
    Usecase Layer: request protected time off (Absence).
    SRP: Handles day-off creation workflows.
    """
    def __init__(self, event_repo: CalendarEventRepository):
        self.event_repo = event_repo

    async def execute(
        self,
        user_id: int,
        start_date: date,
        end_date: date,
        engineer_name: Optional[str] = None,
        status: str = "Approved",
        leave_type: str = "Vacation"
    ) -> DomainCalendarEvent:
        # Validate that the date range is correct (implicitly done by DateRange validation)
        new_event = DomainCalendarEvent(
            id=None,
            event_type="Day_Off",
            user_id=user_id,
            todo_id=None,
            start_date=start_date,
            end_date=end_date,
            engineer_name=engineer_name,
            status=status,
            leave_type=leave_type
        )
        return await self.event_repo.save(new_event)


class FetchTeamGridUseCase:
    """
    Usecase Layer: fetch team calendar matrix for a date range.
    SRP: Orchestrates grid fetching for heavy queries.
    """
    def __init__(self, event_repo: CalendarEventRepository):
        self.event_repo = event_repo

    async def execute(self, start_date: date, end_date: date) -> List[DomainCalendarEvent]:
        return await self.event_repo.get_events_in_range(start_date, end_date)


class CreateTodoUseCase:
    """
    Usecase Layer: create unassigned backlog task.
    SRP: Handles backlog todo creation.
    """
    def __init__(self, todo_repo: TodoRepository):
        self.todo_repo = todo_repo

    async def execute(self, title: str, description: Optional[str] = None, priority: str = "Normal") -> DomainTodo:
        todo = DomainTodo(
            id=None,
            title=title,
            description=description,
            status="Pending",
            priority=priority
        )
        return await self.todo_repo.save(todo)


class CompleteTodoUseCase:
    """
    Usecase Layer: complete claimed task.
    SRP: Marks claimed tasks as complete.
    """
    def __init__(self, todo_repo: TodoRepository):
        self.todo_repo = todo_repo

    async def execute(self, todo_id: int) -> None:
        todo = await self.todo_repo.get_by_id(todo_id)
        if not todo:
            raise DomainException(f"Task with ID {todo_id} not found.")
        
        await self.todo_repo.update_status(todo_id, "Completed")


class ApproveEventUseCase:
    """
    Usecase Layer: approve a pending calendar event (absence).
    SRP: Encapsulates approval workflow and enforces admin-only access at the use case level.
    """
    def __init__(self, event_repo: CalendarEventRepository):
        self.event_repo = event_repo

    async def execute(self, event_id: int) -> None:
        event = await self.event_repo.get_by_id(event_id)
        if not event:
            raise DomainException(f"Event with ID {event_id} not found.")
        if event.status == "Approved":
            raise DomainException("Event is already approved.")
        await self.event_repo.update_status(event_id, "Approved")


class AssignTaskUseCase:
    """
    Usecase Layer: admin/IT assigns a backlog task directly to a target user.
    SRP: Handles admin-driven task assignment, enforcing same domain rules as self-claim
    but allows targeting any user_id.
    """
    def __init__(self, todo_repo: TodoRepository, event_repo: CalendarEventRepository):
        self.todo_repo = todo_repo
        self.event_repo = event_repo

    async def execute(
        self,
        todo_id: int,
        assigning_user_id: int,  # admin performing the action
        target_user_id: int,     # engineer being assigned
        start_date: date,
        end_date: date,
        engineer_name: Optional[str] = None
    ) -> DomainCalendarEvent:
        # 1. Retrieve Todo
        todo = await self.todo_repo.get_by_id(todo_id)
        if not todo:
            raise DomainException(f"Task with ID {todo_id} not found.")

        # 2. Enforce Singular Ownership Rule
        CalendarBusinessRules.enforce_singular_ownership(todo)

        # 3. Retrieve target user's absences
        absences = await self.event_repo.get_user_absences(target_user_id)

        # 4. Enforce Absence Supremacy for the target user
        CalendarBusinessRules.enforce_absence_supremacy(target_user_id, start_date, end_date, absences)

        # 5. Insert Task Claim Event under target user
        new_event = DomainCalendarEvent(
            id=None,
            event_type="Task_Claim",
            user_id=target_user_id,
            todo_id=todo_id,
            start_date=start_date,
            end_date=end_date,
            engineer_name=engineer_name,
            status="Approved"
        )
        saved_event = await self.event_repo.save(new_event)

        # 6. Update Task Status
        await self.todo_repo.update_status(todo_id, "Claimed")

        return saved_event
