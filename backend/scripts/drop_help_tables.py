import asyncio
from sqlalchemy import text
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db.database import engine

async def drop_tables():
    async with engine.begin() as conn:
        print("Dropping kmti_ticket_messages...")
        await conn.execute(text("DROP TABLE IF EXISTS kmti_ticket_messages"))
        print("Dropping kmti_tickets...")
        await conn.execute(text("DROP TABLE IF EXISTS kmti_tickets"))
        print("Done!")

if __name__ == "__main__":
    asyncio.run(drop_tables())
