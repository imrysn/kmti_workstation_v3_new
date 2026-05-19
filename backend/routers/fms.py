from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from db.database import get_fms_db
from models.fms import FmsUser, FmsAssignment, FmsAssignmentMember
from core.auth import get_current_user
from models.user import User  # Auth User model from primary DB
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

# --- Response Schemas ---

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


# --- Endpoints ---

@router.get("/users", response_model=List[FmsUserOut])
async def get_fms_users(
    q: Optional[str] = None,
    role: Optional[str] = None,
    team: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    fms_db: AsyncSession = Depends(get_fms_db),
    current_user: User = Depends(get_current_user)
):
    """
    List and filter users from the remote FMS database.
    """
    query = select(FmsUser)
    
    if q:
        like_q = f"%{q}%"
        query = query.where(
            or_(
                FmsUser.fullName.like(like_q),
                FmsUser.username.like(like_q),
                FmsUser.email.like(like_q)
            )
        )
    if role:
        query = query.where(FmsUser.role == role)
    if team:
        query = query.where(FmsUser.team == team)
        
    query = query.order_by(FmsUser.username).limit(limit).offset(offset)
    
    result = await fms_db.execute(query)
    users = result.scalars().all()
    return users


@router.get("/assignments", response_model=List[FmsAssignmentOut])
async def get_fms_assignments(
    team: Optional[str] = None,
    status: Optional[str] = None,
    team_leader_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
    fms_db: AsyncSession = Depends(get_fms_db),
    current_user: User = Depends(get_current_user)
):
    """
    List and filter assignments from the remote FMS database.
    """
    query = select(FmsAssignment)
    
    if team:
        query = query.where(FmsAssignment.team == team)
    if status:
        query = query.where(FmsAssignment.status == status)
    if team_leader_id is not None:
        query = query.where(FmsAssignment.team_leader_id == team_leader_id)
        
    query = query.order_by(FmsAssignment.created_at.desc()).limit(limit).offset(offset)
    
    result = await fms_db.execute(query)
    assignments = result.scalars().all()
    return assignments


@router.get("/assignments/{assignment_id}/members", response_model=List[FmsAssignmentMemberOut])
async def get_fms_assignment_members(
    assignment_id: int,
    status: Optional[str] = None,
    fms_db: AsyncSession = Depends(get_fms_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the member list and submission statuses for a specific assignment from the remote FMS database.
    """
    query = select(FmsAssignmentMember).where(FmsAssignmentMember.assignment_id == assignment_id)
    if status:
        query = query.where(FmsAssignmentMember.status == status)
        
    query = query.order_by(FmsAssignmentMember.username)
    
    result = await fms_db.execute(query)
    members = result.scalars().all()
    return members
