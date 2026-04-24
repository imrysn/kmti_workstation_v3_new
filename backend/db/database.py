"""
Database configuration and session management.
Connects to the existing MySQL instance from kmtiworkstationvb.

Credentials are loaded exclusively from environment variables or a .env file.
Never hardcode credentials here — see backend/.env.example for required keys.
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
import os
import sys

try:
    from dotenv import load_dotenv
    # Load .env logic:
    # 1. Check relative to the EXE (Production/Frozen mode)
    # 2. Check relative to this file (Development/Script mode)
    if getattr(sys, 'frozen', False):
        _env_path = os.path.join(os.path.dirname(sys.executable), '.env')
    else:
        _env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    
    load_dotenv(dotenv_path=_env_path)
except ImportError:
    pass  # python-dotenv not installed; fall back to environment variables only

# Credentials loaded exclusively from environment — no hardcoded fallbacks.
# Missing vars will raise a clear KeyError at startup rather than silently
# connecting with wrong/stale credentials.
DB_HOST = os.environ["DB_HOST"]
DB_NAME = os.environ["DB_NAME"]
DB_USER = os.environ["DB_USER"]
DB_PASS = os.environ["DB_PASS"]

DATABASE_URL = f"mysql+aiomysql://{DB_USER}:{DB_PASS}@{DB_HOST}/{DB_NAME}?charset=utf8"

# Optimized for Production (20+ Users on Server PET130)
# pool_size: 20 active connections
# max_overflow: 10 extra temporary connections
# pool_recycle: 1800 (Recycles connections every 30m to prevent MySQL 'Gone Away')
# pool_timeout: 30 (User waits max 30s for a connection from the pool)
engine = create_async_engine(
    DATABASE_URL, 
    pool_size=20, 
    max_overflow=10,
    pool_recycle=1800,
    pool_timeout=30,
    pool_pre_ping=True
)

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
