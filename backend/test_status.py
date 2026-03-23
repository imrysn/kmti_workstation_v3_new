import asyncio
from database import AsyncSessionLocal
from sqlalchemy import text

async def check():
    async with AsyncSessionLocal() as session:
        res = await session.execute(text("SELECT id, name, total_files, is_scanning FROM projects;"))
        print(res.fetchall())

if __name__ == "__main__":
    asyncio.run(check())
