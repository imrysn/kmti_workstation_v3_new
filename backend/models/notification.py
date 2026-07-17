from sqlalchemy import Column, Integer, String, Boolean, DateTime
import datetime
from db.database import Base

class AppNotification(Base):
    """
    Generic model for all application notifications.
    """
    __tablename__ = "app_notifications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    member_name = Column(String(255), index=True, nullable=False)
    
    # E.g., 'WORK_SCHEDULE', 'QUOTATION', 'BILLING', 'SYSTEM'
    reference_type = Column(String(100), index=True, nullable=False, default="SYSTEM")
    
    # E.g., The Job ID or Quotation ID
    reference_id = Column(String(100), index=True, nullable=True)
    
    title = Column(String(255), nullable=True)
    message = Column(String(1000), nullable=False)
    
    # Generic redirect URL (e.g. '/team-calendar?tab=schedule' or '/quotations/INV-123')
    link = Column(String(500), nullable=True)
    
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.now, nullable=False)
