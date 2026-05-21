from datetime import date
from typing import List, Optional
from sqlalchemy import select, delete, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from team_calendar.domain.models import DomainTodo, DomainCalendarEvent
from team_calendar.application.ports import TodoRepository, CalendarEventRepository
from team_calendar.infrastructure.models import DbTodo, DbCalendarEvent

class SqlAlchemyTodoRepository(TodoRepository):
    """
    Adapter Layer: database repository for Todos using SQLAlchemy AsyncSession.
    """
    def __init__(self, session: AsyncSession):
        self.session = session

    @staticmethod
    def _map_to_domain(db_todo: DbTodo) -> DomainTodo:
        return DomainTodo(
            id=db_todo.id,
            title=db_todo.title,
            description=db_todo.description,
            status=db_todo.status,
            priority=db_todo.priority,
            created_at=db_todo.created_at.isoformat() if db_todo.created_at else None,
            due_date=db_todo.due_date
        )

    async def get_by_id(self, todo_id: int) -> Optional[DomainTodo]:
        query = select(DbTodo).where(DbTodo.id == todo_id)
        result = await self.session.execute(query)
        db_todo = result.scalar_one_or_none()
        return self._map_to_domain(db_todo) if db_todo else None

    async def get_by_ids(self, todo_ids: List[int]) -> List[DomainTodo]:
        if not todo_ids:
            return []
        query = select(DbTodo).where(DbTodo.id.in_(todo_ids))
        result = await self.session.execute(query)
        db_todos = result.scalars().all()
        return [self._map_to_domain(t) for t in db_todos]

    async def get_all_backlog(self) -> List[DomainTodo]:
        query = select(DbTodo).order_by(DbTodo.created_at.desc())
        result = await self.session.execute(query)
        db_todos = result.scalars().all()
        return [self._map_to_domain(t) for t in db_todos]

    async def save(self, todo: DomainTodo) -> DomainTodo:
        db_todo = DbTodo(
            title=todo.title,
            description=todo.description,
            status=todo.status,
            priority=todo.priority,
            due_date=todo.due_date
        )
        self.session.add(db_todo)
        await self.session.commit()
        await self.session.refresh(db_todo)
        return self._map_to_domain(db_todo)

    async def update_status(self, todo_id: int, status: str) -> None:
        query = select(DbTodo).where(DbTodo.id == todo_id)
        result = await self.session.execute(query)
        db_todo = result.scalar_one_or_none()
        if db_todo:
            db_todo.status = status
            await self.session.commit()

    async def delete(self, todo_id: int) -> None:
        query = delete(DbTodo).where(DbTodo.id == todo_id)
        await self.session.execute(query)
        await self.session.commit()


class SqlAlchemyCalendarEventRepository(CalendarEventRepository):
    """
    Adapter Layer: database repository for CalendarEvents using SQLAlchemy AsyncSession.
    """
    def __init__(self, session: AsyncSession):
        self.session = session

    @staticmethod
    def _map_to_domain(db_event: DbCalendarEvent) -> DomainCalendarEvent:
        return DomainCalendarEvent(
            id=db_event.id,
            event_type=db_event.event_type,
            user_id=db_event.user_id,
            todo_id=db_event.todo_id,
            start_date=db_event.start_date,
            end_date=db_event.end_date,
            engineer_name=db_event.engineer_name,
            status=db_event.status,
            leave_type=db_event.leave_type
        )

    async def get_by_id(self, event_id: int) -> Optional[DomainCalendarEvent]:
        query = select(DbCalendarEvent).where(DbCalendarEvent.id == event_id)
        result = await self.session.execute(query)
        db_event = result.scalar_one_or_none()
        return self._map_to_domain(db_event) if db_event else None

    async def get_events_in_range(self, start_date: date, end_date: date) -> List[DomainCalendarEvent]:
        # Overlap rule: event.start_date <= end_date AND event.end_date >= start_date
        query = select(DbCalendarEvent).where(
            and_(
                DbCalendarEvent.start_date <= end_date,
                DbCalendarEvent.end_date >= start_date
            )
        ).order_by(DbCalendarEvent.start_date)
        result = await self.session.execute(query)
        db_events = result.scalars().all()
        return [self._map_to_domain(e) for e in db_events]

    async def get_user_absences(self, user_id: int) -> List[DomainCalendarEvent]:
        query = select(DbCalendarEvent).where(
            and_(
                DbCalendarEvent.user_id == user_id,
                DbCalendarEvent.event_type == "Day_Off"
            )
        )
        result = await self.session.execute(query)
        db_events = result.scalars().all()
        return [self._map_to_domain(e) for e in db_events]

    async def save(self, event: DomainCalendarEvent) -> DomainCalendarEvent:
        db_event = DbCalendarEvent(
            event_type=event.event_type,
            user_id=event.user_id,
            todo_id=event.todo_id,
            engineer_name=event.engineer_name,
            start_date=event.start_date,
            end_date=event.end_date,
            status=event.status,
            leave_type=event.leave_type
        )
        self.session.add(db_event)
        await self.session.commit()
        await self.session.refresh(db_event)
        return self._map_to_domain(db_event)

    async def delete(self, event_id: int) -> None:
        query = delete(DbCalendarEvent).where(DbCalendarEvent.id == event_id)
        await self.session.execute(query)
        await self.session.commit()

    async def update_status(self, event_id: int, new_status: str) -> None:
        query = select(DbCalendarEvent).where(DbCalendarEvent.id == event_id)
        result = await self.session.execute(query)
        db_event = result.scalar_one_or_none()
        if db_event:
            db_event.status = new_status
            await self.session.commit()
