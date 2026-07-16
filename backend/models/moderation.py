from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from db.database import Base

class BannedWord(Base):
    __tablename__ = "kmti_banned_words"

    id = Column(Integer, primary_key=True, autoincrement=True)
    word = Column(String(255), unique=True, nullable=False, index=True)
    added_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
