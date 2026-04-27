from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional

from db.database import get_db
from models.stopwatch import StopwatchRecord
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class StopwatchRecordCreate(BaseModel):
    name: str
    time: str
    workstation: Optional[str] = None
    user_name: Optional[str] = None

class StopwatchRecordUpdate(BaseModel):
    name: str

@router.get("/")
async def list_records(
    workstation: str,
    user_name: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    List last 50 stopwatch records for a SPECIFIC workstation.
    Privacy enforcement: Records are partitioned by workstation.
    """
    query = select(StopwatchRecord).where(StopwatchRecord.workstation == workstation)
    if user_name:
        query = query.where(StopwatchRecord.user_name == user_name)
    
    query = query.order_by(StopwatchRecord.created_at.desc()).limit(50)
    result = await db.execute(query)
    records = result.scalars().all()
    
    return [
        {
            "id": str(r.id), # Return as string for frontend compatibility
            "name": r.name,
            "time": r.recorded_time,
            "timestamp": int(r.created_at.timestamp() * 1000)
        } for r in records
    ]

@router.post("/")
async def create_record(
    payload: StopwatchRecordCreate,
    db: AsyncSession = Depends(get_db)
):
    """Save a new stopwatch record to MySQL."""
    new_record = StopwatchRecord(
        name=payload.name,
        recorded_time=payload.time,
        workstation=payload.workstation,
        user_name=payload.user_name
    )
    db.add(new_record)
    await db.commit()
    await db.refresh(new_record)
    return {
        "id": str(new_record.id),
        "name": new_record.name,
        "time": new_record.recorded_time,
        "timestamp": int(new_record.created_at.timestamp() * 1000)
    }

@router.patch("/{record_id}")
async def rename_record(
    record_id: int,
    payload: StopwatchRecordUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a record's name."""
    record = await db.get(StopwatchRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    record.name = payload.name
    await db.commit()
    return {"success": True}

@router.delete("/{record_id}")
async def delete_record(
    record_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Permanently delete a record."""
    record = await db.get(StopwatchRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    await db.delete(record)
    await db.commit()
    return {"success": True}
