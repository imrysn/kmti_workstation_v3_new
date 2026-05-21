from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db.database import Base

class DbTodo(Base):
    """
    SQLAlchemy model representing the 'kmti_todos' table.
    Contains the backlog ('To-Do' pool) of unscheduled, claimed, or completed tasks.
    """
    __tablename__ = "kmti_todos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="Pending") # "Pending", "Claimed", "Completed"
    priority = Column(String(20), nullable=False, default="Normal") # "Low", "Normal", "High", "Critical"
    due_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationship to track active claim event if claimed
    events = relationship("DbCalendarEvent", back_populates="todo", cascade="all, delete-orphan")


class DbCalendarEvent(Base):
    """
    SQLAlchemy model representing the 'kmti_calendar_events' table.
    Tracks 'Task_Claim' (anchoring tasks to days) and 'Day_Off' (absence lockout).
    """
    __tablename__ = "kmti_calendar_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_type = Column(String(50), nullable=False) # "Task_Claim", "Day_Off"
    user_id = Column(Integer, ForeignKey("kmti_users.id"), nullable=False)
    todo_id = Column(Integer, ForeignKey("kmti_todos.id"), nullable=True)
    engineer_name = Column(String(100), nullable=True)
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False, index=True)
    status = Column(String(50), nullable=False, default="Approved") # "Pending", "Approved"
    leave_type = Column(String(50), nullable=True) # "Vacation", "Sick", "Personal", "Holiday", "Other"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    todo = relationship("DbTodo", back_populates="events")
    user = relationship("User", backref="calendar_events")

    # Strict composite and single indexes for ultra-fast heavy team grid range searches
    __table_args__ = (
        Index("idx_calendar_user_id", "user_id"),
        Index("idx_calendar_dates_range", "start_date", "end_date"),
        Index("idx_calendar_user_dates", "user_id", "start_date", "end_date"),
    )
