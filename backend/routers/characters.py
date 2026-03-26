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
from core.auth import get_current_user, require_role

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
            "SELECT eng_char, jp_char FROM char_search "
            "WHERE eng_char LIKE :q OR jp_char LIKE :q "
            "LIMIT :limit OFFSET :offset"
        )
        result = await db.execute(sql, {"q": f"%{q}%", "limit": limit, "offset": offset})
    else:
        sql = text("SELECT eng_char, jp_char FROM char_search LIMIT :limit OFFSET :offset")
        result = await db.execute(sql, {"limit": limit, "offset": offset})

    rows = result.fetchall()
    return [{"englishChar": r[0], "japaneseChar": r[1]} for r in rows]


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
    return [{"englishChar": r.eng_char, "japaneseChar": r.jp_char, "category": r.category} for r in rows]
