from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete, or_
from pydantic import BaseModel
from typing import Optional

from db.database import get_db
from models.custom_dictionary import CustomPage, CustomMapping
from models.user import User, UserRole
from core.auth import require_role, get_current_user

router = APIRouter()

from modules.custom_dictionaries.schemas import PageCreate, MappingCreate, MappingUpdate


# --- Custom Page (Category) Endpoints ---

@router.get("/")
async def list_custom_pages(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all dynamically created custom dictionary pages.
    Accessible to all authenticated users.
    """
    stmt = select(CustomPage).order_by(CustomPage.title)
    result = await db.execute(stmt)
    pages = result.scalars().all()
    return [{"id": p.id, "title": p.title} for p in pages]


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_custom_page(
    payload: PageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin, UserRole.it]))
):
    """
    Create a new dynamic translation page category.
    Restricted to Admin and IT roles.
    """
    title_clean = payload.title.strip()
    if not title_clean:
        raise HTTPException(status_code=400, detail="Page title cannot be empty.")

    # Check for duplicate category name
    stmt = select(CustomPage).where(CustomPage.title == title_clean)
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A page with this title already exists.")

    new_page = CustomPage(title=title_clean)
    db.add(new_page)
    await db.commit()
    await db.refresh(new_page)
    return {"id": new_page.id, "title": new_page.title}


@router.delete("/{page_id}")
async def delete_custom_page(
    page_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin, UserRole.it]))
):
    """
    Delete a custom page category along with all its translation records.
    Restricted to Admin and IT roles.
    """
    stmt = select(CustomPage).where(CustomPage.id == page_id)
    res = await db.execute(stmt)
    page = res.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Page category not found.")

    await db.delete(page)
    await db.commit()
    return {"status": "ok", "message": f"Page '{page.title}' and all its mapping records have been deleted."}


# --- Custom Mapping (Row) Endpoints ---

@router.get("/{page_id}/mappings/")
async def list_custom_mappings(
    page_id: int,
    q: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all translation mappings for a custom page, with optional search filter.
    """
    # Verify page exists
    stmt_page = select(CustomPage).where(CustomPage.id == page_id)
    res_page = await db.execute(stmt_page)
    if not res_page.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Page category not found.")

    stmt = select(CustomMapping).where(CustomMapping.page_id == page_id).order_by(CustomMapping.id)
    
    if q:
        search_filter = or_(
            CustomMapping.english_name.ilike(f"%{q}%"),
            CustomMapping.japanese_name.ilike(f"%{q}%")
        )
        stmt = stmt.where(search_filter)

    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    items = result.scalars().all()
    
    return [
        {
            "id": item.id,
            "englishName": item.english_name,
            "japaneseName": item.japanese_name
        }
        for item in items
    ]


@router.post("/{page_id}/mappings/", status_code=status.HTTP_201_CREATED)
async def create_custom_mapping(
    page_id: int,
    payload: MappingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin, UserRole.it]))
):
    """
    Add a new English-Japanese translation row to a custom page.
    Restricted to Admin and IT roles.
    """
    # Verify page exists
    stmt_page = select(CustomPage).where(CustomPage.id == page_id)
    res_page = await db.execute(stmt_page)
    if not res_page.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Page category not found.")

    new_mapping = CustomMapping(
        page_id=page_id,
        english_name=payload.englishName.strip(),
        japanese_name=payload.japaneseName.strip()
    )
    db.add(new_mapping)
    await db.commit()
    await db.refresh(new_mapping)
    
    return {
        "id": new_mapping.id,
        "englishName": new_mapping.english_name,
        "japaneseName": new_mapping.japanese_name
    }


@router.patch("/mappings/{mapping_id}")
async def update_custom_mapping(
    mapping_id: int,
    payload: MappingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin, UserRole.it]))
):
    """
    Update an English-Japanese translation row.
    Restricted to Admin and IT roles.
    """
    stmt = select(CustomMapping).where(CustomMapping.id == mapping_id)
    res = await db.execute(stmt)
    mapping = res.scalar_one_or_none()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping record not found.")

    if payload.englishName is not None:
        mapping.english_name = payload.englishName.strip()
    if payload.japaneseName is not None:
        mapping.japanese_name = payload.japaneseName.strip()

    await db.commit()
    await db.refresh(mapping)
    
    return {
        "id": mapping.id,
        "englishName": mapping.english_name,
        "japaneseName": mapping.japanese_name
    }


@router.delete("/mappings/{mapping_id}")
async def delete_custom_mapping(
    mapping_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin, UserRole.it]))
):
    """
    Delete a translation row.
    Restricted to Admin and IT roles.
    """
    stmt = select(CustomMapping).where(CustomMapping.id == mapping_id)
    res = await db.execute(stmt)
    mapping = res.scalar_one_or_none()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping record not found.")

    await db.delete(mapping)
    await db.commit()
    return {"status": "ok", "message": "Mapping record deleted."}
