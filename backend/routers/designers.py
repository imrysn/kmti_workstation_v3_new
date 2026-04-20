from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, or_, case
from db.database import get_db
from models import Designer
from core.auth import require_role
from pydantic import BaseModel, EmailStr
from typing import List, Optional

router = APIRouter()

class DesignerCreate(BaseModel):
    category: Optional[str] = ""
    englishName: Optional[str] = ""
    email: Optional[str] = ""
    japaneseName: Optional[str] = ""

class DesignerUpdate(BaseModel):
    category: Optional[str] = None
    englishName: Optional[str] = None
    email: Optional[str] = None
    japaneseName: Optional[str] = None

@router.get("/categories")
async def get_categories(db: AsyncSession = Depends(get_db)):
    """Returns distinct categories from designers table."""
    sql = text("SELECT DISTINCT category FROM designers ORDER BY category")
    result = await db.execute(sql)
    return [r[0] for r in result.fetchall() if r[0]]

@router.get("/")
async def get_designers(
    category: Optional[str] = None,
    q: str = "",
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """List designers with filtering and search."""
    query = select(Designer)

    if category:
        query = query.where(Designer.category == category)
    if q:
        like_q = f"%{q}%"
        query = query.where(
            or_(
                Designer.english_name.like(like_q),
                Designer.japanese_name.like(like_q),
                Designer.email.like(like_q)
            )
        )

    # Ordering: Letters first, then symbols/others
    priority = case(
        (Designer.english_name.op('REGEXP')('^[A-Za-z]'), 1),
        else_=0
    )
    query = query.order_by(priority.asc(), Designer.english_name.asc())
    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    designers = result.scalars().all()
    
    return [
        {
            "id": d.id,
            "category": d.category,
            "englishName": d.english_name,
            "email": d.email,
            "japaneseName": d.japanese_name
        }
        for d in designers
    ]

@router.post("/", dependencies=[Depends(require_role(["admin", "it"]))])
async def create_designer(data: DesignerCreate, db: AsyncSession = Depends(get_db)):
    """Add a new designer (Admin/IT only)."""
    new_designer = Designer(
        category=data.category,
        english_name=data.englishName,
        email=data.email,
        japanese_name=data.japaneseName
    )
    db.add(new_designer)
    await db.commit()
    await db.refresh(new_designer)
    return {
        "id": new_designer.id,
        "category": new_designer.category,
        "englishName": new_designer.english_name,
        "email": new_designer.email,
        "japaneseName": new_designer.japanese_name
    }

@router.patch("/{id}", dependencies=[Depends(require_role(["admin", "it"]))])
async def update_designer(id: int, data: DesignerUpdate, db: AsyncSession = Depends(get_db)):
    """Update a designer (Admin/IT only)."""
    result = await db.execute(select(Designer).where(Designer.id == id))
    designer = result.scalar_one_or_none()
    
    if not designer:
        raise HTTPException(status_code=404, detail="Designer not found")
    
    if data.category is not None:
        designer.category = data.category
    if data.englishName is not None:
        designer.english_name = data.englishName
    if data.email is not None:
        designer.email = data.email
    if data.japaneseName is not None:
        designer.japanese_name = data.japaneseName
        
    await db.commit()
    return {
        "id": designer.id,
        "category": designer.category,
        "englishName": designer.english_name,
        "email": designer.email,
        "japaneseName": designer.japanese_name
    }

@router.delete("/{id}", dependencies=[Depends(require_role(["admin", "it"]))])
async def delete_designer(id: int, db: AsyncSession = Depends(get_db)):
    """Delete a designer (Admin/IT only)."""
    result = await db.execute(select(Designer).where(Designer.id == id))
    designer = result.scalar_one_or_none()
    
    if not designer:
        raise HTTPException(status_code=404, detail="Designer not found")
        
    await db.delete(designer)
    await db.commit()
    return {"message": "Deleted successfully"}
