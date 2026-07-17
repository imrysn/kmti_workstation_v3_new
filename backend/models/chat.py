from sqlalchemy import Column, String, Boolean, Integer, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from db.database import Base

class Group(Base):
    __tablename__ = "kmti_groups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class GroupMember(Base):
    __tablename__ = "kmti_group_members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    group_id = Column(Integer, ForeignKey("kmti_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    username = Column(String(100), nullable=False, index=True)

class ChatMessage(Base):
    __tablename__ = "kmti_chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sender = Column(String(100), nullable=False, index=True)
    recipient = Column(String(100), nullable=False, index=True)  # Either username, "__global__", or group name
    group_id = Column(Integer, ForeignKey("kmti_groups.id", ondelete="CASCADE"), nullable=True, index=True)
    content = Column(Text, nullable=False)
    attachment_path = Column(String(500), nullable=True)
    attachment_name = Column(String(255), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    is_edited = Column(Boolean, default=False, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    reply_to_id = Column(Integer, ForeignKey("kmti_chat_messages.id", ondelete="SET NULL"), nullable=True)
    reactions = Column(Text, nullable=True)  # JSON encoded string of reactions
    created_at = Column(DateTime(timezone=True), server_default=func.now())
