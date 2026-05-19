from dataclasses import dataclass
from datetime import date
from typing import Optional

@dataclass(frozen=True)
class DateRange:
    """
    Value object representing an inclusive range of days.
    Provides basic validation to ensure start_date <= end_date.
    """
    start_date: date
    end_date: date

    def __post_init__(self):
        if self.start_date > self.end_date:
            raise ValueError(f"Invalid DateRange: start_date ({self.start_date}) cannot be after end_date ({self.end_date}).")

    def overlaps_with(self, other: "DateRange") -> bool:
        """
        Calculates if this date range overlaps with another date range.
        Inclusive on both ends: start1 <= end2 AND start2 <= end1.
        """
        return self.start_date <= other.end_date and other.start_date <= self.end_date


@dataclass
class DomainUser:
    """Domain model representing a workstation user."""
    id: int
    username: str
    role: str
    is_active: bool = True


@dataclass
class DomainTodo:
    """Domain model representing a task in the backlog."""
    id: Optional[int]
    title: str
    description: Optional[str]
    status: str # "Pending", "Claimed", "Completed"
    priority: str = "Normal" # "Low", "Normal", "High", "Critical"
    created_at: Optional[str] = None

    def is_claimable(self) -> bool:
        return self.status == "Pending"

    def is_completed(self) -> bool:
        return self.status == "Completed"


@dataclass
class DomainCalendarEvent:
    """Domain model representing a claim or absence event."""
    id: Optional[int]
    event_type: str # "Task_Claim", "Day_Off"
    user_id: int
    todo_id: Optional[int]
    start_date: date
    end_date: date
    engineer_name: Optional[str] = None
    status: str = "Approved" # "Pending", "Approved"
    leave_type: Optional[str] = None # "Vacation", "Sick", "Personal", "Holiday", "Other" — only for Day_Off

    @property
    def date_range(self) -> DateRange:
        return DateRange(self.start_date, self.end_date)
