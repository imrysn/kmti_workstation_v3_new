from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.sql import func
from db.database import Base

class StopwatchRecord(Base):
    """
    MySQL storage for stopwatch records.
    Replaces the legacy Electron-based records.json storage.
    """
    __tablename__ = "kmti_stopwatch_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    recorded_time = Column(String(50), nullable=False)  # e.g. "00:00:10.00"
    workstation = Column(String(100), nullable=True)
    user_name = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
