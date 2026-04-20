from sqlalchemy import Column, String, Integer, Date, text
from sqlalchemy.sql import func
from datetime import date
from db.database import Base

class LibrarianUsage(Base):
    """
    Tracks AI Librarian usage per IP address to enforce daily limits.
    This handles the shared account environment (20+ users on one account).
    """
    __tablename__ = "kmti_librarian_usage"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ip_address = Column(String(45), nullable=False, index=True)
    usage_date = Column(Date, default=date.today, index=True)
    question_count = Column(Integer, default=1, nullable=False)
