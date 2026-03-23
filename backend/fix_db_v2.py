import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from database import engine
from models import Base

async def fix():
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            print("Dropped all tables successfully.")
    except Exception as e:
        print(f"Error dropping table: {e}")

if __name__ == "__main__":
    asyncio.run(fix())
