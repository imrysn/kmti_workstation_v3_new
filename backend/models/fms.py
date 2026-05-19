"""
SQLAlchemy models mapping to the secondary, remote MySQL database (kmtifms) on KMTI-NAS.
All tables are mapped read-only for pulling users and assignments.
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, BigInteger, ForeignKey
from sqlalchemy.orm import relationship
from db.database import FmsBase


class FmsUser(FmsBase):
    """
    SQLAlchemy model representing the 'users' table in kmtifms database.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    fullName = Column(String(255), nullable=False)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="USER")
    team = Column(String(100), default="General")
    created_at = Column(DateTime)
    profile_picture = Column(String(500))


class FmsAssignment(FmsBase):
    """
    SQLAlchemy model representing the 'assignments' table in kmtifms database.
    """
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    team_leader_id = Column(Integer, nullable=False, index=True)
    team_leader_username = Column(String(100))
    team = Column(String(50), nullable=False, index=True)
    due_date = Column(DateTime, index=True)
    file_type_required = Column(String(100))
    assigned_to = Column(String(10), default="all")
    max_file_size = Column(BigInteger)
    status = Column(String(50), default="active", index=True)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

    # Relationships
    members = relationship("FmsAssignmentMember", back_populates="assignment", cascade="all, delete-orphan")


class FmsAssignmentMember(FmsBase):
    """
    SQLAlchemy model representing the 'assignment_members' table in kmtifms database.
    """
    __tablename__ = "assignment_members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    username = Column(String(100))
    status = Column(String(50), default="pending", index=True)
    submitted_at = Column(DateTime)
    file_id = Column(Integer)
    created_at = Column(DateTime)

    # Relationships
    assignment = relationship("FmsAssignment", back_populates="members")
