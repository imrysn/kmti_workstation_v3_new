from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from db.database import Base

class LibrarianSession(Base):
    """
    Groups chat messages into logical 'sessions' or 'threads'.
    """
    __tablename__ = "kmti_librarian_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ip_address = Column(String(45), nullable=False, index=True)
    title = Column(String(255), nullable=False, default="New Chat")
    created_at = Column(DateTime, server_default=func.now(), index=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    messages = relationship("LibrarianChatMessage", back_populates="session", cascade="all, delete-orphan")

class LibrarianChatMessage(Base):
    """
    Stores persistent chat history linked to a specific session.
    """
    __tablename__ = "kmti_librarian_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("kmti_librarian_sessions.id", ondelete="CASCADE"), nullable=True, index=True)
    ip_address = Column(String(45), nullable=False, index=True)
    role = Column(String(20), nullable=False) # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), index=True)

    session = relationship("LibrarianSession", back_populates="messages")
