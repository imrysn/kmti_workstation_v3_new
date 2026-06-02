from sqlalchemy import Column, String, Integer, DateTime, Text
from sqlalchemy.sql import func
from db.database import Base

class ActivityLog(Base):
    """
    Persistent audit logs for security, login events, user modifications, 
    and quotations management.
    """
    __tablename__ = "kmti_activity_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
