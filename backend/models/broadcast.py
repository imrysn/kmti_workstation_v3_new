from sqlalchemy import Column, String, Integer, DateTime, Enum as SQLEnum
import enum
from db.database import Base
from datetime import datetime

class BroadcastSeverity(enum.Enum):
    INFO = "info"
    WARNING = "warning"
    DANGER = "danger"

class WorkstationBroadcast(Base):
    """
    Global emergency broadcast message.
    Shown to all active workstations when non-expired.
    """
    __tablename__ = "kmti_broadcasts"

    id = Column(Integer, primary_key=True, index=True)
    message = Column(String(500), nullable=False)
    severity = Column(String(20), default="info")
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    expires_at = Column(DateTime, nullable=True) # If null, message stays until manual removal

class BroadcastAcknowledgment(Base):
    """
    Tracks acknowledgment of broadcasts by specific workstations/users.
    """
    __tablename__ = "kmti_broadcast_acks"

    id = Column(Integer, primary_key=True, index=True)
    broadcast_id = Column(Integer, index=True)
    username = Column(String(100))
    workstation = Column(String(100))
    acknowledged_at = Column(DateTime, default=datetime.now)
