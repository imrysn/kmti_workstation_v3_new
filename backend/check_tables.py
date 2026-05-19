import asyncio
import os
from sqlalchemy import text
from db.database import AsyncSessionLocal

async def check():
    async with AsyncSessionLocal() as session:
        try:
            print("Checking kmti_todos...")
            res = await session.execute(text("DESCRIBE kmti_todos"))
            columns = res.fetchall()
            for col in columns:
                print(f" - {col[0]} ({col[1]})")
        except Exception as e:
            print(f"Error checking kmti_todos: {e}")

        try:
            print("\nChecking kmti_calendar_events...")
            res = await session.execute(text("DESCRIBE kmti_calendar_events"))
            columns = res.fetchall()
            for col in columns:
                print(f" - {col[0]} ({col[1]})")
        except Exception as e:
            print(f"Error checking kmti_calendar_events: {e}")

if __name__ == "__main__":
    asyncio.run(check())
