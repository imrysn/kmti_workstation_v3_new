from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class FmsUserOut(BaseModel):
    id: int
    fullName: str
    username: str
    email: str
    role: str
    team: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True

class FmsAssignmentMemberOut(BaseModel):
    id: int
    assignment_id: int
    user_id: int
    username: Optional[str]
    status: Optional[str]
    submitted_at: Optional[datetime]
    file_id: Optional[int]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True

class FmsAssignmentOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    team_leader_id: int
    team_leader_username: Optional[str]
    team: str
    due_date: Optional[datetime]
    file_type_required: Optional[str]
    assigned_to: Optional[str]
    max_file_size: Optional[int]
    status: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
