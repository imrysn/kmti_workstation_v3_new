from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from core.base_repository import BaseRepository
from models.quotation import Quotation

class QuotationRepository(BaseRepository[Quotation]):
    async def get_by_quotation_no(self, session: AsyncSession, quotation_no: str, exclude_id: int = None) -> Optional[Quotation]:
        stmt = select(self.model).where(self.model.quotation_no == quotation_no)
        if exclude_id:
            stmt = stmt.where(self.model.id != exclude_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def deactivate(self, session: AsyncSession, id: int):
        stmt = update(self.model).where(self.model.id == id).values(is_active=False)
        await session.execute(stmt)
        await session.commit()

quotation_repo = QuotationRepository(Quotation)
