import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from database import engine
from sqlalchemy import text

async def drop():
    async with engine.begin() as conn:
        await conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        await conn.execute(text("DROP TABLE IF EXISTS cad_file_index;"))
        await conn.execute(text("DROP TABLE IF EXISTS projects;"))
        await conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        print("Tables forcefully dropped via raw SQL.")

if __name__ == "__main__":
    asyncio.run(drop())
