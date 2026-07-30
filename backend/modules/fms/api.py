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
from modules.fms.schemas import FmsUserOut, FmsAssignmentMemberOut, FmsAssignmentOut

router = APIRouter()

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


@router.get("/users/avatar/{username}")
async def get_fms_user_avatar(
    username: str,
    fms_db: AsyncSession = Depends(get_fms_db)
):
    """
    Fetch the uploaded profile picture for a given username from fms_db / NAS storage.
    """
    import os, httpx
    from fastapi.responses import FileResponse, RedirectResponse, Response
    try:
        stmt = select(FmsUser).where(or_(FmsUser.username == username, FmsUser.fullName == username))
        res = await fms_db.execute(stmt)
        fms_user = res.scalar_one_or_none()

        if not fms_user:
            raise HTTPException(status_code=404, detail="User not found")

        # 1. Check direct file by FMS User ID on NAS share
        nas_dir = r"\\KMTI-NAS\Shared\data\profile_pictures"
        alt_nas_dir = r"\\192.168.200.105\Shared\data\profile_pictures"

        for base_dir in [nas_dir, alt_nas_dir]:
            for ext in [".jpg", ".png", ".jpeg", ".webp"]:
                candidate = os.path.join(base_dir, f"{fms_user.id}{ext}")
                if os.path.exists(candidate):
                    return FileResponse(candidate)

        # 2. Check by filename from profile_picture column if stored
        if fms_user.profile_picture:
            pic_path = fms_user.profile_picture.strip()
            clean_name = os.path.basename(pic_path.split("?")[0])
            for base_dir in [nas_dir, alt_nas_dir]:
                candidate = os.path.join(base_dir, clean_name)
                if os.path.exists(candidate):
                    return FileResponse(candidate)

            if os.path.exists(pic_path):
                return FileResponse(pic_path)

            if pic_path.startswith("http://") or pic_path.startswith("https://"):
                return RedirectResponse(url=pic_path)

        raise HTTPException(status_code=404, detail="Avatar image file not accessible")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
