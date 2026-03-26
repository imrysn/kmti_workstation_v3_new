import asyncio
from sqlalchemy import text
from db.database import engine

async def check_raw():
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT id, username, CAST(role AS CHAR) FROM kmti_users"))
        rows = result.fetchall()
        for row in rows:
            print(f"ID: {row[0]}, Username: {row[1]}, Role: '{row[2]}'")

if __name__ == "__main__":
    asyncio.run(check_raw())
