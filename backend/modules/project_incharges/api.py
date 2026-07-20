from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from db.database import get_db
from models import ProjectIncharge
from core.auth import require_role
from typing import Optional
from socket_manager import broadcast_mutation
from modules.project_incharges.schemas import InchargeCreate, InchargeUpdate

router = APIRouter()

@router.get("/")
async def get_incharges(
    category: Optional[str] = None,
    q: str = "",
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """List project incharges with filtering and search."""
    query = select(ProjectIncharge)

    if category:
        query = query.where(ProjectIncharge.category == category)
    if q:
        like_q = f"%{q}%"
        query = query.where(
            or_(
                ProjectIncharge.english_name.like(like_q),
                ProjectIncharge.japanese_name.like(like_q),
                ProjectIncharge.email.like(like_q)
            )
        )

    query = query.order_by(ProjectIncharge.english_name.asc())
    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    incharges = result.scalars().all()
    
    return [
        {
            "id": i.id,
            "category": i.category,
            "englishName": i.english_name,
            "email": i.email,
            "japaneseName": i.japanese_name
        }
        for i in incharges
    ]

@router.post("/", dependencies=[Depends(require_role(["admin", "it"]))])
async def create_incharge(
    data: InchargeCreate, 
    db: AsyncSession = Depends(get_db),
    x_socket_id: str | None = Header(None, alias="X-Socket-ID")
):
    """Add a new project incharge (Admin/IT only)."""
    # Check duplicate
    existing = await db.execute(select(ProjectIncharge).where(ProjectIncharge.english_name == data.englishName))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Project Incharge already exists")

    new_incharge = ProjectIncharge(
        category=data.category,
        english_name=data.englishName,
        email=data.email,
        japanese_name=data.japaneseName
    )
    db.add(new_incharge)
    await db.commit()
    await db.refresh(new_incharge)
    
    res_data = {
        "id": new_incharge.id,
        "category": new_incharge.category,
        "englishName": new_incharge.english_name,
        "email": new_incharge.email,
        "japaneseName": new_incharge.japanese_name
    }
    await broadcast_mutation("project_incharges", "INSERT", res_data, exclude_sid=x_socket_id)
    return res_data

@router.patch("/{id}", dependencies=[Depends(require_role(["admin", "it"]))])
async def update_incharge(
    id: int, 
    data: InchargeUpdate, 
    db: AsyncSession = Depends(get_db),
    x_socket_id: str | None = Header(None, alias="X-Socket-ID")
):
    """Update a project incharge (Admin/IT only)."""
    result = await db.execute(select(ProjectIncharge).where(ProjectIncharge.id == id))
    incharge = result.scalar_one_or_none()
    
    if not incharge:
        raise HTTPException(status_code=404, detail="Project Incharge not found")
    
    if data.category is not None:
        incharge.category = data.category
    if data.englishName is not None:
        incharge.english_name = data.englishName
    if data.email is not None:
        incharge.email = data.email
    if data.japaneseName is not None:
        incharge.japanese_name = data.japaneseName
        
    await db.commit()
    
    res_data = {
        "id": incharge.id,
        "category": incharge.category,
        "englishName": incharge.english_name,
        "email": incharge.email,
        "japaneseName": incharge.japanese_name
    }
    await broadcast_mutation("project_incharges", "UPDATE", res_data, exclude_sid=x_socket_id)
    return res_data

@router.delete("/{id}", dependencies=[Depends(require_role(["admin", "it"]))])
async def delete_incharge(
    id: int, 
    db: AsyncSession = Depends(get_db),
    x_socket_id: str | None = Header(None, alias="X-Socket-ID")
):
    """Delete a project incharge (Admin/IT only)."""
    result = await db.execute(select(ProjectIncharge).where(ProjectIncharge.id == id))
    incharge = result.scalar_one_or_none()
    
    if not incharge:
        raise HTTPException(status_code=404, detail="Project Incharge not found")
        
    await db.delete(incharge)
    await db.commit()
    
    await broadcast_mutation("project_incharges", "DELETE", {"id": id}, exclude_sid=x_socket_id)
    return {"message": "Deleted successfully"}
