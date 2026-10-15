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

def serialize_client(c: Client) -> dict:
    company_name = c.company_name or c.english_name
    contact = c.contact_person or ""
    return {
        "id": c.id,
        "code": c.code or c.english_name,
        "name": c.english_name,
        "prefix": c.prefix or "KMTE-",
        "category": c.category or "CLIENT",
        "englishName": c.english_name,
        "companyName": company_name,
        "clientName": company_name,
        "contact": contact,
        "contactPerson": contact,
        "address": c.address or "",
        "phone": c.phone or "",
        "email": c.email or "",
        "japaneseName": c.japanese_name or ""
    }

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
                Client.company_name.like(like_q),
                Client.code.like(like_q),
                Client.contact_person.like(like_q),
                Client.address.like(like_q),
                Client.japanese_name.like(like_q),
                Client.email.like(like_q)
            )
        )

    # Ordering: Alphabetically by English name
    query = query.order_by(Client.english_name.asc())
    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    clients = result.scalars().all()
    
    return [serialize_client(c) for c in clients]

@router.post("/", dependencies=[Depends(require_role(["admin", "it"]))])
async def create_client(
    data: ClientCreate, 
    db: AsyncSession = Depends(get_db),
    x_socket_id: str | None = Header(None, alias="X-Socket-ID")
):
    """Add a new client (Admin/IT only)."""
    existing = await db.execute(select(Client).where(Client.english_name == data.englishName))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Client already exists")

    company_val = data.companyName or data.clientName or data.englishName
    contact_val = data.contactPerson or data.contact or ""

    new_client = Client(
        category=data.category or "CLIENT",
        english_name=data.englishName,
        code=data.code or data.englishName.replace(" ", "_").upper(),
        company_name=company_val,
        contact_person=contact_val,
        address=data.address or "",
        phone=data.phone or "",
        prefix=data.prefix or "KMTE-",
        email=data.email or "",
        japanese_name=data.japaneseName or ""
    )
    db.add(new_client)
    await db.commit()
    await db.refresh(new_client)
    
    res_data = serialize_client(new_client)
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
    if data.code is not None:
        client.code = data.code
    if data.companyName is not None:
        client.company_name = data.companyName
    elif data.clientName is not None:
        client.company_name = data.clientName
    if data.contactPerson is not None:
        client.contact_person = data.contactPerson
    elif data.contact is not None:
        client.contact_person = data.contact
    if data.address is not None:
        client.address = data.address
    if data.phone is not None:
        client.phone = data.phone
    if data.prefix is not None:
        client.prefix = data.prefix
    if data.email is not None:
        client.email = data.email
    if data.japaneseName is not None:
        client.japanese_name = data.japaneseName
        
    await db.commit()
    await db.refresh(client)
    
    res_data = serialize_client(client)
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
