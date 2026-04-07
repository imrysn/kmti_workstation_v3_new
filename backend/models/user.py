"""
User and FeatureFlag models — RBAC support for KMTI Workstation v3.
These create new tables in the shared NAS MySQL DB alongside existing tables.
"""
from sqlalchemy import Column, String, Boolean, Integer, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from db.database import Base


class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"
    it = "it"


class User(Base):
    __tablename__ = "kmti_users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.user)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class FeatureFlag(Base):
    """
    IT-controlled feature toggles. Stored in shared MySQL DB so all
    workstations pick up changes without restart.

    Seeded keys:
      - heat_treatment_enabled
      - calculator_enabled
      - maintenance_mode  (shows Maintenance page app-wide when True)
    """
    __tablename__ = "kmti_feature_flags"

    key = Column(String(100), primary_key=True)
    value = Column(Boolean, default=True, nullable=False)
    updated_by = Column(String(100), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
class Ticket(Base):
    __tablename__ = "kmti_tickets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    workstation = Column(String(100), nullable=False)
    reporter_name = Column(String(100), nullable=True)
    subject = Column(String(200), nullable=True)
    status = Column(String(20), default="open", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

class TicketMessage(Base):
    __tablename__ = "kmti_ticket_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticket_id = Column(Integer, ForeignKey("kmti_tickets.id"), nullable=False)
    sender_type = Column(String(20), nullable=False)  # 'user', 'it', 'admin'
    sender_name = Column(String(100), nullable=True)
    message = Column(String(2000), nullable=False)
    screenshot_paths = Column(String(1000), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ticket = relationship("Ticket", backref="messages")
