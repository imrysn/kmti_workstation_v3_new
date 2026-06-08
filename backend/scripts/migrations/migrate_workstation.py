
import asyncio
from sqlalchemy import text
from db.database import AsyncSessionLocal

async def migrate():
    async with AsyncSessionLocal() as session:
        try:
            print("Checking for 'workstation' column in 'quotations' table...")
            # Check if column exists
            result = await session.execute(text("SHOW COLUMNS FROM quotations LIKE 'workstation'"))
            column = result.fetchone()
            
            if not column:
                print("Column 'workstation' missing. Adding it now...")
                await session.execute(text("ALTER TABLE quotations ADD COLUMN workstation VARCHAR(255) AFTER designer_name"))
                await session.commit()
                print("SUCCESS: Column 'workstation' added to 'quotations' table.")
            else:
                print("INFO: Column 'workstation' already exists.")
                
        except Exception as e:
            print(f"ERROR during migration: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(migrate())
