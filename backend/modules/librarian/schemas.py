from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class FeedbackRequest(BaseModel):
    message_id: int
    is_helpful: bool
    query: str
    response: str

class ChatMessage(BaseModel):
    role: str
    content: str

class QueryRequest(BaseModel):
    session_id: Optional[int] = None
    messages: List[ChatMessage]

class SessionCreate(BaseModel):
    title: Optional[str] = "New Chat"

class SessionResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
