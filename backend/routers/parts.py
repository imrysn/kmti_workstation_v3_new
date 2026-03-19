"""
Purchased Parts router.
Implements the core feature of kmtiworkstationvb:
- List all categories and part types (metadata only, no blobs)
- Stream file blobs on-demand for preview and download
- Upload new parts
Note: tblfile has no 'id' column — 'file' (filename) is the natural key.
"""
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, distinct, text
from models import TblFile
from database import get_db
import io

router = APIRouter()


@router.get("/categories")
async def get_categories(db: AsyncSession = Depends(get_db)):
    """Returns distinct categories — equivalent to legacy getloadCategory()."""
    result = await db.execute(select(distinct(TblFile.Category)))
    return [row[0] for row in result.fetchall() if row[0]]


@router.get("/types")
async def get_part_types(category: str = None, db: AsyncSession = Depends(get_db)):
    """Returns distinct part types, optionally filtered by category."""
    query = select(distinct(TblFile.Parts_Type))
    if category:
        query = query.where(TblFile.Category == category)
    result = await db.execute(query)
    return [row[0] for row in result.fetchall() if row[0]]


@router.get("/")
async def list_parts(
    category: str = None,
    parts_type: str = None,
    search: str = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns parts metadata ONLY (no blob data loaded).
    Fixes the v2.0 performance bottleneck.
    Uses raw SQL to avoid ORM loading dataFile blob.
    """
    conditions = []
    params = {}

    if category:
        conditions.append("Category = :category")
        params["category"] = category
    if parts_type:
        conditions.append("Parts_Type = :parts_type")
        params["parts_type"] = parts_type
    if search:
        conditions.append("file LIKE :search")
        params["search"] = f"%{search}%"

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    sql = text(f"SELECT Category, Parts_Type, file FROM tblfile {where_clause}")

    result = await db.execute(sql, params)
    rows = result.fetchall()
    return [{"category": r[0], "partsType": r[1], "fileName": r[2]} for r in rows]


@router.get("/download")
async def download_part(filename: str, db: AsyncSession = Depends(get_db)):
    """
    Streams the binary file blob — loaded on-demand only.
    Uses filename as the key (equivalent to legacy QuickDownload).
    """
    sql = text("SELECT dataFile, file FROM tblfile WHERE file = :filename")
    result = await db.execute(sql, {"filename": filename})
    row = result.fetchone()
    if not row or not row[0]:
        raise HTTPException(status_code=404, detail="File not found")

    return StreamingResponse(
        io.BytesIO(row[0]),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename={row[1]}"}
    )


@router.post("/upload")
async def upload_part(
    category: str = Form(...),
    parts_type: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Uploads a new part with its binary file. Equivalent to legacy getAddPurchased()."""
    data = await file.read()
    sql = text("INSERT INTO tblfile (Category, Parts_Type, file, dataFile) VALUES (:cat, :pt, :fn, :data)")
    await db.execute(sql, {"cat": category, "pt": parts_type, "fn": file.filename, "data": data})
    await db.commit()
    return {"message": "Part uploaded successfully", "fileName": file.filename}


@router.delete("/")
async def delete_part(filename: str, db: AsyncSession = Depends(get_db)):
    """Deletes a part record by filename."""
    sql = text("DELETE FROM tblfile WHERE file = :filename")
    result = await db.execute(sql, {"filename": filename})
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Part not found")
    return {"message": "Part deleted"}
