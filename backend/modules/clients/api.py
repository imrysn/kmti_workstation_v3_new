from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, or_, case
from db.database import get_db
from models import Client
from core.auth import require_role
from typing import List, Optional
from socket_manager import broadcast_mutation
from modules.clients.schemas import ClientCreate, ClientUpdate

router = APIRouter()

@router.get("/")
async def get_clients(
    category: Optional[str] = None,
    q: str = "",
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """List clients with filtering and search."""
    query = select(Client)

    if category:
        query = query.where(Client.category == category)
    if q:
        like_q = f"%{q}%"
        query = query.where(
            or_(
                Client.english_name.like(like_q),
                Client.japanese_name.like(like_q),
                Client.email.like(like_q)
            )
        )

    # Ordering: Alphabetically by English name
    query = query.order_by(Client.english_name.asc())
    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    clients = result.scalars().all()
    
    return [
        {
            "id": c.id,
            "category": c.category,
            "englishName": c.english_name,
            "email": c.email,
            "japaneseName": c.japanese_name
        }
        for c in clients
    ]

@router.post("/", dependencies=[Depends(require_role(["admin", "it"]))])
async def create_client(
    data: ClientCreate, 
    db: AsyncSession = Depends(get_db),
    x_socket_id: str | None = Header(None, alias="X-Socket-ID")
):
    """Add a new client (Admin/IT only)."""
    # Check duplicate
    existing = await db.execute(select(Client).where(Client.english_name == data.englishName))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Client already exists")

    new_client = Client(
        category=data.category,
        english_name=data.englishName,
        email=data.email,
        japanese_name=data.japaneseName
    )
    db.add(new_client)
    await db.commit()
    await db.refresh(new_client)
    
    res_data = {
        "id": new_client.id,
        "category": new_client.category,
        "englishName": new_client.english_name,
        "email": new_client.email,
        "japaneseName": new_client.japanese_name
    }
    await broadcast_mutation("clients", "INSERT", res_data, exclude_sid=x_socket_id)
    return res_data

@router.patch("/{id}", dependencies=[Depends(require_role(["admin", "it"]))])
async def update_client(
    id: int, 
    data: ClientUpdate, 
    db: AsyncSession = Depends(get_db),
    x_socket_id: str | None = Header(None, alias="X-Socket-ID")
):
    """Update a client (Admin/IT only)."""
    result = await db.execute(select(Client).where(Client.id == id))
    client = result.scalar_one_or_none()
    
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    if data.category is not None:
        client.category = data.category
    if data.englishName is not None:
        client.english_name = data.englishName
    if data.email is not None:
        client.email = data.email
    if data.japaneseName is not None:
        client.japanese_name = data.japaneseName
        
    await db.commit()
    
    res_data = {
        "id": client.id,
        "category": client.category,
        "englishName": client.english_name,
        "email": client.email,
        "japaneseName": client.japanese_name
    }
    await broadcast_mutation("clients", "UPDATE", res_data, exclude_sid=x_socket_id)
    return res_data

@router.delete("/{id}", dependencies=[Depends(require_role(["admin", "it"]))])
async def delete_client(
    id: int, 
    db: AsyncSession = Depends(get_db),
    x_socket_id: str | None = Header(None, alias="X-Socket-ID")
):
    """Delete a client (Admin/IT only)."""
    result = await db.execute(select(Client).where(Client.id == id))
    client = result.scalar_one_or_none()
    
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
        
    await db.delete(client)
    await db.commit()
    
    await broadcast_mutation("clients", "DELETE", {"id": id}, exclude_sid=x_socket_id)
    return {"message": "Deleted successfully"}
