import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from models import CadFileIndex
import os

# Database configuration (from database.py)
DB_HOST = "192.168.200.105"
DB_NAME = "kmtiworkstation"
DB_USER = "data_manage"
DB_PASS = "Ph15IcadRs"
DATABASE_URL = f"mysql+aiomysql://{DB_USER}:{DB_PASS}@{DB_HOST}/{DB_NAME}"

async def find_by_name(name):
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        result = await session.execute(select(CadFileIndex).where(CadFileIndex.file_name == name))
        record = result.scalar_one_or_none()
        if record:
            print(f"Found {name}: ID {record.id}, Path: {record.file_path}")
        else:
            print(f"{name} not found")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(find_by_name("Frame-1.dwg"))
