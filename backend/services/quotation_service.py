import json
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, desc, or_, func
from sqlalchemy.orm import selectinload

from models.quotation import Quotation, QuotationHistory
from models.quotation_schemas import QuotationDataSchema

class QuotationService:
    @staticmethod
    async def get_all(db: AsyncSession, skip: int = 0, limit: int = 100, search: Optional[str] = None, designer: Optional[str] = None):
        stmt = select(Quotation)
        if search:
            stmt = stmt.where(
                or_(
                    Quotation.quotation_no.ilike(f"%{search}%"),
                    Quotation.client_name.ilike(f"%{search}%"),
                    Quotation.display_name.ilike(f"%{search}%")
                )
            )
        if designer:
            stmt = stmt.where(Quotation.designer_name.ilike(f"%{designer}%"))
        
        # Get total count
        count_stmt = select(func.count(Quotation.id))
        if search:
            count_stmt = count_stmt.where(
                or_(
                    Quotation.quotation_no.ilike(f"%{search}%"),
                    Quotation.client_name.ilike(f"%{search}%"),
                    Quotation.display_name.ilike(f"%{search}%")
                )
            )
        if designer:
            count_stmt = count_stmt.where(Quotation.designer_name.ilike(f"%{designer}%"))
            
        total_res = await db.execute(count_stmt)
        total = total_res.scalar() or 0
        
        stmt = stmt.order_by(desc(Quotation.updated_at)).offset(skip).limit(limit)
        result = await db.execute(stmt)
        items = result.scalars().all()
        
        return items, total

    @staticmethod
    async def get_by_id(db: AsyncSession, quotation_id: int):
        stmt = select(Quotation).where(Quotation.id == quotation_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create(db: AsyncSession, data: Dict[str, Any], workstation: Optional[str] = None):
        qd = data.get("quotationDetails", {})
        q_no = qd.get("quotationNo", f"TEMP-{datetime.now().timestamp()}")
        
        # Check for duplicate
        stmt = select(Quotation).where(Quotation.quotation_no == q_no)
        res = await db.execute(stmt)
        if res.scalar_one_or_none():
            raise ValueError(f"Quotation number '{q_no}' already exists.")

        new_quot = Quotation(
            quotation_no=q_no,
            display_name=q_no,
            client_name=data.get("clientInfo", {}).get("company", ""),
            designer_name=data.get("signatures", {}).get("quotation", {}).get("preparedBy", {}).get("name", ""),
            workstation=workstation,
            data=json.dumps(data, ensure_ascii=False),
            is_active=False
        )
        db.add(new_quot)
        await db.commit()
        await db.refresh(new_quot)
        return new_quot

    @staticmethod
    async def update(db: AsyncSession, quotation_id: int, data: Dict[str, Any]):
        stmt = select(Quotation).where(Quotation.id == quotation_id)
        result = await db.execute(stmt)
        quot = result.scalar_one_or_none()
        if not quot:
            return None
        
        qd = data.get("quotationDetails", {})
        new_q_no = qd.get("quotationNo", quot.quotation_no)
        
        # Sync display name logic
        new_display = quot.display_name
        if not quot.display_name or quot.display_name == quot.quotation_no:
            new_display = new_q_no

        quot.quotation_no = new_q_no
        quot.display_name = new_display
        quot.client_name = data.get("clientInfo", {}).get("company", "")
        quot.designer_name = data.get("signatures", {}).get("quotation", {}).get("preparedBy", {}).get("name", "")
        quot.data = json.dumps(data, ensure_ascii=False)
        quot.updated_at = datetime.now(timezone.utc)
        
        await db.commit()
        await db.refresh(quot)
        return quot

    @staticmethod
    async def delete(db: AsyncSession, quotation_id: int):
        # Explicitly purge history first to avoid FK constraints if DB cascade isn't set
        await db.execute(delete(QuotationHistory).where(QuotationHistory.quotation_id == quotation_id))
        await db.execute(delete(Quotation).where(Quotation.id == quotation_id))
        await db.commit()
        return True

    @staticmethod
    async def get_history(db: AsyncSession, quotation_id: int):
        stmt = select(QuotationHistory).where(QuotationHistory.quotation_id == quotation_id).order_by(desc(QuotationHistory.created_at))
        result = await db.execute(stmt)
        return result.scalars().all()

    @staticmethod
    async def add_history(db: AsyncSession, quotation_id: int, label: str, author: str, data: Dict[str, Any]):
        new_history = QuotationHistory(
            quotation_id=quotation_id,
            label=label,
            author=author,
            data=json.dumps(data, ensure_ascii=False)
        )
        db.add(new_history)
        await db.commit()
        return new_history
