
import asyncio
from sqlalchemy import text
from db.database import AsyncSessionLocal

async def check():
    async with AsyncSessionLocal() as session:
        result = await session.execute(text("DESCRIBE quotations"))
        columns = result.fetchall()
        print("Columns in 'quotations' table:")
        for col in columns:
            print(f" - {col[0]} ({col[1]})")

if __name__ == "__main__":
    asyncio.run(check())
