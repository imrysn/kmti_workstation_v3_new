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

from core.config import IS_FROZEN, BASE_DIR

try:
    from dotenv import load_dotenv
    # 1. Try external .env (next to the .exe) - Priority for user configuration
    external_env = os.path.join(BASE_DIR, '.env')
    
    # 2. Try bundled .env (inside the .exe) - Fallback for default settings
    bundled_env = os.path.join(getattr(sys, '_MEIPASS', BASE_DIR), '.env')
    
    if os.path.exists(external_env):
        load_dotenv(dotenv_path=external_env, override=True)
    elif os.path.exists(bundled_env):
        load_dotenv(dotenv_path=bundled_env)
    else:
        # Fallback to standard search if neither specific path found
        load_dotenv()
except ImportError:
    pass

# Credentials loaded exclusively from environment — no hardcoded fallbacks.
# Missing vars will raise a clear error at startup rather than silently
# connecting with wrong/stale credentials.
try:
    DB_HOST = os.environ["DB_HOST"]
    DB_NAME = os.environ["DB_NAME"]
    DB_USER = os.environ["DB_USER"]
    DB_PASS = os.environ["DB_PASS"]
except KeyError as e:
    print(f"\n[FATAL ERROR] Database configuration missing: {e}")
    print("Please ensure your .env file exists and contains DB_HOST, DB_NAME, DB_USER, and DB_PASS.")
    if IS_FROZEN:
        import tkinter.messagebox as mb
        mb.showerror("Configuration Error", 
                     f"Database configuration missing: {e}\n\n"
                     "Please ensure your .env file exists and contains all required variables.")
    sys.exit(1)

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
