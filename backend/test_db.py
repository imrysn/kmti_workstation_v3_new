import asyncio
from database import AsyncSessionLocal
from sqlalchemy import text

async def alter():
    async with AsyncSessionLocal() as session:
        try:
            await session.execute(text("ALTER TABLE projects ADD COLUMN is_scanning BOOLEAN DEFAULT FALSE;"))
            await session.commit()
            print("Altered projects table successfully!")
        except Exception as e:
            print("Already altered or error:", e)

if __name__ == "__main__":
    asyncio.run(alter())
