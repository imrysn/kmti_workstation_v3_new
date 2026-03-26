"""
Character Search & Heat Treatment router.
Based on exact VB source queries from mod_login.getDbChar():
  char_search  table: eng_char, jp_char  (no id column)
  heat_trmnt   table: eng_char, jp_char, category  (no id column)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from db.database import get_db
from models.user import User, UserRole
from models.part import CharSearch
from core.auth import get_current_user, require_role
from pydantic import BaseModel

router = APIRouter()


@router.get("/")
async def search_characters(
    q: str = "", 
    limit: int = 50, 
    offset: int = 0, 
    db: AsyncSession = Depends(get_db)
):
    """
    Search char_search table by English or Japanese character.
    Equivalent to: SELECT eng_char, jp_char FROM char_search
    with optional filter on both columns.
    """
    if q:
        sql = text(
            "SELECT id, eng_char, jp_char FROM char_search "
            "WHERE eng_char LIKE :q OR jp_char LIKE :q "
            "LIMIT :limit OFFSET :offset"
        )
        result = await db.execute(sql, {"q": f"%{q}%", "limit": limit, "offset": offset})
    else:
        sql = text("SELECT id, eng_char, jp_char FROM char_search LIMIT :limit OFFSET :offset")
        result = await db.execute(sql, {"limit": limit, "offset": offset})

    rows = result.fetchall()
    return [
        {
            "id": r[0], 
            "englishChar": r[1], 
            "japaneseChar": r[2]
        } for r in rows
    ]


class CharCreate(BaseModel):
    englishChar: str
    japaneseChar: str


class CharUpdate(BaseModel):
    englishChar: str = None
    japaneseChar: str = None


@router.post("/", dependencies=[Depends(require_role(["admin", "it"]))])
async def create_character(data: CharCreate, db: AsyncSession = Depends(get_db)):
    """Create a new character mapping (Admin/IT only)."""
    new_char = CharSearch(
        eng_char=data.englishChar,
        jp_char=data.japaneseChar
    )
    db.add(new_char)
    await db.commit()
    await db.refresh(new_char)
    return {"id": new_char.id, "englishChar": new_char.eng_char, "japaneseChar": new_char.jp_char}


@router.patch("/{char_id}", dependencies=[Depends(require_role(["admin", "it"]))])
async def update_character(char_id: int, data: CharUpdate, db: AsyncSession = Depends(get_db)):
    """Update an existing character mapping (Admin/IT only)."""
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(CharSearch).where(CharSearch.id == char_id))
    char = result.scalar_one_or_none()
    
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    
    if data.englishChar is not None:
        char.eng_char = data.englishChar
    if data.japaneseChar is not None:
        char.jp_char = data.japaneseChar
        
    await db.commit()
    return {"id": char.id, "englishChar": char.eng_char, "japaneseChar": char.jp_char}


@router.delete("/{char_id}", dependencies=[Depends(require_role(["admin", "it"]))])
async def delete_character(char_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a character mapping (Admin/IT only)."""
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(CharSearch).where(CharSearch.id == char_id))
    char = result.scalar_one_or_none()
    
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
        
    await db.delete(char)
    await db.commit()
    return {"message": "Deleted successfully"}


@router.get("/heat-treatment/categories")
async def get_heat_treatment_categories(db: AsyncSession = Depends(get_db)):
    """Returns distinct categories from heat_trmnt table."""
    sql = text("SELECT DISTINCT category FROM heat_trmnt ORDER BY category")
    result = await db.execute(sql)
    return [r[0] for r in result.fetchall() if r[0]]


@router.get("/heat-treatment")
async def get_heat_treatment(
    category: str = None, 
    q: str = "", 
    limit: int = 50, 
    offset: int = 0, 
    db: AsyncSession = Depends(get_db)
):
    """
    Fetches heat treatment data, optionally filtered by category and search term.
    Uses SQLAlchemy ORM conditions instead of f-string SQL to eliminate any
    future risk of SQL injection from the query assembly pattern.
    """
    from sqlalchemy import select as sa_select
    from models import HeatTreatment

    query = sa_select(HeatTreatment)

    if category:
        query = query.where(HeatTreatment.category == category)
    if q:
        like_q = f"%{q}%"
        query = query.where(
            (HeatTreatment.eng_char.like(like_q)) |
            (HeatTreatment.jp_char.like(like_q))
        )

    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    rows = result.scalars().all()
    return [
        {"id": row.id, "englishChar": row.eng_char, "japaneseChar": row.jp_char} 
        for row in rows
    ]
