import asyncio
from sqlalchemy import select
from db.database import AsyncSessionLocal
from models.part import Project, CadFileIndex

async def check():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(Project).limit(5))
        for p in res.scalars():
            print(f"PROJ: {p.root_path}")
        
        res = await session.execute(select(CadFileIndex).limit(5))
        for item in res.scalars():
            print(f"FILE: {item.file_path}")

if __name__ == "__main__":
    asyncio.run(check())
