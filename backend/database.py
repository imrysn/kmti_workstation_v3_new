"""
Database configuration and session management.
Connects to the existing MySQL instance from kmtiworkstationvb.
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
import os

# Connection string loaded from environment or config file
DB_HOST = os.getenv("DB_HOST", "192.168.200.105")
DB_NAME = os.getenv("DB_NAME", "kmtiworkstation")
DB_USER = os.getenv("DB_USER", "data_manage")
DB_PASS = os.getenv("DB_PASS", "Ph15IcadRs")

DATABASE_URL = f"mysql+aiomysql://{DB_USER}:{DB_PASS}@{DB_HOST}/{DB_NAME}?charset=utf8"

engine = create_async_engine(DATABASE_URL, pool_size=5, max_overflow=10)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
