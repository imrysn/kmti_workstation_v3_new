from abc import ABC, abstractmethod
from datetime import date
from typing import List, Optional
from team_calendar.domain.models import DomainTodo, DomainCalendarEvent

class TodoRepository(ABC):
    """
    Port interface for managing the Backlog (Todos).
    SRP: Handles persistent operations exclusively for the backlog tasks.
    """
    @abstractmethod
    async def get_by_id(self, todo_id: int) -> Optional[DomainTodo]:
        pass

    @abstractmethod
    async def get_by_ids(self, todo_ids: List[int]) -> List[DomainTodo]:
        pass

    @abstractmethod
    async def get_all_backlog(self) -> List[DomainTodo]:
        pass

    @abstractmethod
    async def save(self, todo: DomainTodo) -> DomainTodo:
        pass

    @abstractmethod
    async def update_status(self, todo_id: int, status: str) -> None:
        pass


class CalendarEventRepository(ABC):
    """
    Port interface for managing calendar events (Claims and Absences).
    SRP: Handles range-based range queries, index optimizations, and user-bound absences.
    """
    @abstractmethod
    async def get_by_id(self, event_id: int) -> Optional[DomainCalendarEvent]:
        pass

    @abstractmethod
    async def get_events_in_range(self, start_date: date, end_date: date) -> List[DomainCalendarEvent]:
        pass

    @abstractmethod
    async def get_user_absences(self, user_id: int) -> List[DomainCalendarEvent]:
        pass

    @abstractmethod
    async def save(self, event: DomainCalendarEvent) -> DomainCalendarEvent:
        pass

    @abstractmethod
    async def delete(self, event_id: int) -> None:
        pass

    @abstractmethod
    async def update_status(self, event_id: int, new_status: str) -> None:
        pass
