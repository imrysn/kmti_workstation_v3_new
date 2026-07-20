"""
Materials router — English/Japanese material name mappings.
No category column — flat list, search + CRUD only.
Admin/IT role required for write operations.
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select as sa_select, case as sa_case
from pydantic import BaseModel

from db.database import get_db
from models import Material
from core.auth import require_role
from socket_manager import broadcast_mutation

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------
from modules.materials.schemas import MaterialCreate, MaterialUpdate


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/")
async def list_materials(
    q: str = "",
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """
    List materials with optional full-text search across English and Japanese fields.
    Results are sorted: symbols/numbers first, then alphabetical A-Z.
    """
    query = sa_select(Material.id, Material.english_name, Material.japanese_name)

    if q:
        like_q = f"%{q}%"
        query = query.where(
            Material.english_name.like(like_q) | Material.japanese_name.like(like_q)
        )

    # Same sort pattern used in HeatTreatment: non-alpha first, then alpha A-Z
    priority = sa_case(
        (Material.english_name.op("REGEXP")("^[A-Za-z]"), 1),
        else_=0,
    )
    query = query.order_by(priority.asc(), Material.english_name.asc())
    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    rows = result.all()

    return [
        {"id": row.id, "englishName": row.english_name, "japaneseName": row.japanese_name}
        for row in rows
    ]


@router.post("/", dependencies=[Depends(require_role(["admin", "it"]))])
async def create_material(
    data: MaterialCreate, 
    db: AsyncSession = Depends(get_db),
    x_socket_id: str | None = Header(None, alias="X-Socket-ID")
):
    """Create a new material mapping. Admin/IT only."""
    item = Material(english_name=data.englishName.strip(), japanese_name=data.japaneseName.strip())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    
    res_data = {"id": item.id, "englishName": item.english_name, "japaneseName": item.japanese_name}
    await broadcast_mutation("materials", "INSERT", res_data, exclude_sid=x_socket_id)
    return res_data


@router.patch("/{item_id}", dependencies=[Depends(require_role(["admin", "it"]))])
async def update_material(
    item_id: int, 
    data: MaterialUpdate, 
    db: AsyncSession = Depends(get_db),
    x_socket_id: str | None = Header(None, alias="X-Socket-ID")
):
    """Update an existing material mapping. Admin/IT only."""
    result = await db.execute(sa_select(Material).where(Material.id == item_id))
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Material not found")

    if data.englishName is not None:
        item.english_name = data.englishName.strip()
    if data.japaneseName is not None:
        item.japanese_name = data.japaneseName.strip()

    await db.commit()
    
    res_data = {"id": item.id, "englishName": item.english_name, "japaneseName": item.japanese_name}
    await broadcast_mutation("materials", "UPDATE", res_data, exclude_sid=x_socket_id)
    return res_data


@router.delete("/{item_id}", dependencies=[Depends(require_role(["admin", "it"]))])
async def delete_material(
    item_id: int, 
    db: AsyncSession = Depends(get_db),
    x_socket_id: str | None = Header(None, alias="X-Socket-ID")
):
    """Delete a material mapping. Admin/IT only."""
    result = await db.execute(sa_select(Material).where(Material.id == item_id))
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Material not found")

    await db.delete(item)
    await db.commit()
    
    await broadcast_mutation("materials", "DELETE", {"id": item_id}, exclude_sid=x_socket_id)
    return {"message": "Deleted successfully"}

