from datetime import date
from typing import List
from team_calendar.domain.models import DateRange, DomainCalendarEvent, DomainTodo

class DomainException(Exception):
    """Base exception for all domain logic failures."""
    pass

class AbsenceSupremacyViolation(DomainException):
    """Raised when a user attempts to claim a task that overlaps with their protected time off."""
    pass

class SingularOwnershipViolation(DomainException):
    """Raised when a user attempts to claim a task that is already claimed or completed."""
    pass


def ranges_overlap(start1: date, end1: date, start2: date, end2: date) -> bool:
    """
    Core algorithm to determine if two date ranges [start1, end1] and [start2, end2] overlap (inclusive).
    Formula: start1 <= end2 AND start2 <= end1
    """
    return start1 <= end2 and start2 <= end1


class CalendarBusinessRules:
    """Enforces absolute business logic boundaries at the core domain level."""

    @staticmethod
    def enforce_absence_supremacy(
        user_id: int,
        start_date: date,
        end_date: date,
        existing_absences: List[DomainCalendarEvent]
    ) -> None:
        """
        Validation Rule: Absence Supremacy
        A user cannot claim a task on a date range that overlaps with any approved/pending Day Off of their own.
        """
        for absence in existing_absences:
            if absence.user_id != user_id:
                continue
            
            if absence.event_type == "Day_Off":
                if ranges_overlap(start_date, end_date, absence.start_date, absence.end_date):
                    raise AbsenceSupremacyViolation(
                        f"Absence Supremacy Violation: User {user_id} cannot claim a task from {start_date} to {end_date} "
                        f"because it overlaps with a registered Absence / Day Off from {absence.start_date} to {absence.end_date}."
                    )

    @staticmethod
    def enforce_singular_ownership(todo: DomainTodo) -> None:
        """
        Validation Rule: Singular Ownership
        A task in the backlog can only have a single owner. It must be in the 'Pending' status to be claimed.
        """
        if todo.status == "Claimed":
            raise SingularOwnershipViolation(
                f"Singular Ownership Violation: Task '{todo.title}' (ID: {todo.id}) is already claimed by another user."
            )
        elif todo.status == "Completed":
            raise SingularOwnershipViolation(
                f"Singular Ownership Violation: Task '{todo.title}' (ID: {todo.id}) is already completed and cannot be claimed."
            )
        elif todo.status != "Pending":
            raise SingularOwnershipViolation(
                f"Singular Ownership Violation: Task '{todo.title}' (ID: {todo.id}) has invalid status '{todo.status}' for claims."
            )
