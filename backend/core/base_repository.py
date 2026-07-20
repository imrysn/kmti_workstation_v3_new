from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.exc import NoResultFound

from db.database import Base

ModelType = TypeVar("ModelType", bound=Base)

class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    async def get(self, session: AsyncSession, id: Any) -> Optional[ModelType]:
        stmt = select(self.model).filter(self.model.id == id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_multi(
        self, session: AsyncSession, *, skip: int = 0, limit: int = 100
    ) -> List[ModelType]:
        stmt = select(self.model).offset(skip).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, session: AsyncSession, *, obj_in: Dict[str, Any]) -> ModelType:
        db_obj = self.model(**obj_in)
        session.add(db_obj)
        await session.commit()
        await session.refresh(db_obj)
        return db_obj

    async def update(
        self, session: AsyncSession, *, id: Any, obj_in: Dict[str, Any]
    ) -> Optional[ModelType]:
        stmt = (
            update(self.model)
            .where(self.model.id == id)
            .values(**obj_in)
            .execution_options(synchronize_session="fetch")
        )
        result = await session.execute(stmt)
        if result.rowcount == 0:
            return None
        await session.commit()
        return await self.get(session, id)

    async def delete(self, session: AsyncSession, *, id: Any) -> bool:
        stmt = delete(self.model).where(self.model.id == id)
        result = await session.execute(stmt)
        await session.commit()
        return result.rowcount > 0
