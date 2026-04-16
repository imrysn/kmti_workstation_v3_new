from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.sql import func
from db.database import Base

class WorkstationStatus(Base):
    """
    Real-time telemetry for active workstations.
    Updated via heartbeat from the frontend.
    """
    __tablename__ = "kmti_workstation_status"

    ip_address = Column(String(45), primary_key=True)
    computer_name = Column(String(100), nullable=True)
    active_module = Column(String(50), nullable=True)
    current_user = Column(String(100), nullable=True)
    version = Column(String(20), nullable=True)
    last_ping = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
