import asyncio
from sqlalchemy import text
from db.database import AsyncSessionLocal

async def check():
    async with AsyncSessionLocal() as session:
        result = await session.execute(text("DESCRIBE kmti_workstation_status"))
        columns = result.fetchall()
        print("Columns in 'kmti_workstation_status' table:")
        for col in columns:
            print(f" - {col[0]} ({col[1]})")

if __name__ == "__main__":
    asyncio.run(check())
