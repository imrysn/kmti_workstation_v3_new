"""
Character Search & Heat Treatment router.
Based on exact VB source queries from mod_login.getDbChar():
  char_search  table: eng_char, jp_char  (no id column)
  heat_trmnt   table: eng_char, jp_char, category  (no id column)
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from database import get_db

router = APIRouter()


@router.get("/")
async def search_characters(q: str = "", db: AsyncSession = Depends(get_db)):
    """
    Search char_search table by English or Japanese character.
    Equivalent to: SELECT eng_char, jp_char FROM char_search
    with optional filter on both columns.
    """
    if q:
        sql = text(
            "SELECT eng_char, jp_char FROM char_search "
            "WHERE eng_char LIKE :q OR jp_char LIKE :q"
        )
        result = await db.execute(sql, {"q": f"%{q}%"})
    else:
        sql = text("SELECT eng_char, jp_char FROM char_search")
        result = await db.execute(sql)

    rows = result.fetchall()
    return [{"englishChar": r[0], "japaneseChar": r[1]} for r in rows]


@router.get("/heat-treatment/categories")
async def get_heat_treatment_categories(db: AsyncSession = Depends(get_db)):
    """Returns distinct categories from heat_trmnt table."""
    sql = text("SELECT DISTINCT category FROM heat_trmnt ORDER BY category")
    result = await db.execute(sql)
    return [r[0] for r in result.fetchall() if r[0]]


@router.get("/heat-treatment")
async def get_heat_treatment(category: str = None, q: str = "", db: AsyncSession = Depends(get_db)):
    """
    Fetches heat treatment data, optionally filtered by category and search term.
    Equivalent to: SELECT eng_char, jp_char FROM heat_trmnt WHERE category = 'X'
    """
    conditions = []
    params = {}

    if category:
        conditions.append("category = :category")
        params["category"] = category
    if q:
        conditions.append("(eng_char LIKE :q OR jp_char LIKE :q)")
        params["q"] = f"%{q}%"

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    sql = text(f"SELECT eng_char, jp_char, category FROM heat_trmnt {where_clause}")

    result = await db.execute(sql, params)
    rows = result.fetchall()
    return [{"englishChar": r[0], "japaneseChar": r[1], "category": r[2]} for r in rows]
