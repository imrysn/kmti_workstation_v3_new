"""
Machines router — English/Japanese machine name mappings with Machine Code (MC).
Admin/IT role required for write operations.
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select as sa_select, case as sa_case, or_
from pydantic import BaseModel

from db.database import get_db
from models import MachineName
from core.auth import require_role
from socket_manager import broadcast_mutation
from modules.machines.schemas import MachineCreate, MachineUpdate

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/")
async def list_machines(
    q: str = "",
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """
    List machines with optional search across Machine Code, English Name, and Japanese Name fields.
    """
    query = sa_select(MachineName.id, MachineName.machine_code, MachineName.english_name, MachineName.japanese_name)

    if q:
        like_q = f"%{q}%"
        query = query.where(
            or_(
                MachineName.machine_code.like(like_q),
                MachineName.english_name.like(like_q),
                MachineName.japanese_name.like(like_q)
            )
        )

    # Sort pattern: alphabetical by machine code
    query = query.order_by(MachineName.machine_code.asc())
    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "id": row.id,
            "machineCode": row.machine_code,
            "englishName": row.english_name,
            "japaneseName": row.japanese_name
        }
        for row in rows
    ]


@router.post("/", dependencies=[Depends(require_role(["admin", "it"]))])
async def create_machine(
    data: MachineCreate, 
    db: AsyncSession = Depends(get_db),
    x_socket_id: str | None = Header(None, alias="X-Socket-ID")
):
    """Create a new machine name mapping. Admin/IT only."""
    # Check if machine code already exists
    code_clean = data.machineCode.strip()
    dup_check = await db.execute(sa_select(MachineName).where(MachineName.machine_code == code_clean))
    if dup_check.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Machine code '{code_clean}' already exists.")

    item = MachineName(
        machine_code=code_clean,
        english_name=data.englishName.strip(),
        japanese_name=data.japaneseName.strip()
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    
    res_data = {
        "id": item.id,
        "machineCode": item.machine_code,
        "englishName": item.english_name,
        "japaneseName": item.japanese_name
    }
    await broadcast_mutation("machines", "INSERT", res_data, exclude_sid=x_socket_id)
    return res_data


@router.patch("/{item_id}", dependencies=[Depends(require_role(["admin", "it"]))])
async def update_machine(
    item_id: int, 
    data: MachineUpdate, 
    db: AsyncSession = Depends(get_db),
    x_socket_id: str | None = Header(None, alias="X-Socket-ID")
):
    """Update an existing machine name mapping. Admin/IT only."""
    result = await db.execute(sa_select(MachineName).where(MachineName.id == item_id))
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Machine name record not found")

    if data.machineCode is not None:
        code_clean = data.machineCode.strip()
        # Verify unique code
        if code_clean != item.machine_code:
            dup_check = await db.execute(sa_select(MachineName).where(MachineName.machine_code == code_clean))
            if dup_check.scalar_one_or_none():
                raise HTTPException(status_code=400, detail=f"Machine code '{code_clean}' already exists.")
        item.machine_code = code_clean

    if data.englishName is not None:
        item.english_name = data.englishName.strip()
    if data.japaneseName is not None:
        item.japanese_name = data.japaneseName.strip()

    await db.commit()
    
    res_data = {
        "id": item.id,
        "machineCode": item.machine_code,
        "englishName": item.english_name,
        "japaneseName": item.japanese_name
    }
    await broadcast_mutation("machines", "UPDATE", res_data, exclude_sid=x_socket_id)
    return res_data


@router.delete("/{item_id}", dependencies=[Depends(require_role(["admin", "it"]))])
async def delete_machine(
    item_id: int, 
    db: AsyncSession = Depends(get_db),
    x_socket_id: str | None = Header(None, alias="X-Socket-ID")
):
    """Delete a machine name mapping. Admin/IT only."""
    result = await db.execute(sa_select(MachineName).where(MachineName.id == item_id))
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Machine name record not found")

    await db.delete(item)
    await db.commit()
    
    await broadcast_mutation("machines", "DELETE", {"id": item_id}, exclude_sid=x_socket_id)
    return {"message": "Deleted successfully"}
