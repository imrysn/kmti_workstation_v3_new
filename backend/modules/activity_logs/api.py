from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc, func, or_
from typing import Optional

from db.database import get_db
from models.activity_log import ActivityLog
from models.user import User, UserRole
from core.auth import require_role

router = APIRouter()

@router.get("/")
async def list_activity_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    username: Optional[str] = None,
    action: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin, UserRole.it])),
):
    """
    Retrieve activity logs with filtering and pagination.
    Restricted to Admin and IT roles.
    """
    stmt = select(ActivityLog).order_by(desc(ActivityLog.created_at))
    count_stmt = select(func.count()).select_from(ActivityLog)
    
    filters = []
    if username:
        filters.append(ActivityLog.username == username)
    if action:
        filters.append(ActivityLog.action == action)
    if search:
        search_filter = or_(
            ActivityLog.username.ilike(f"%{search}%"),
            ActivityLog.action.ilike(f"%{search}%"),
            ActivityLog.details.ilike(f"%{search}%"),
            ActivityLog.ip_address.ilike(f"%{search}%")
        )
        filters.append(search_filter)
        
    if filters:
        stmt = stmt.where(*filters)
        count_stmt = count_stmt.where(*filters)
        
    # Execute total count query
    count_res = await db.execute(count_stmt)
    total = count_res.scalar() or 0
    
    # Execute paginated logs query
    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    items = result.scalars().all()
    
    logs_list = [
        {
            "id": item.id,
            "username": item.username,
            "action": item.action,
            "details": item.details,
            "ip_address": item.ip_address,
            "created_at": item.created_at.isoformat() + "Z" if item.created_at else None
        }
        for item in items
    ]
    
    return {
        "logs": logs_list,
        "total": total
    }
