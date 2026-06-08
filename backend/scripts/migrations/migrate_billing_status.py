import asyncio
from sqlalchemy import text
from db.database import AsyncSessionLocal

async def migrate():
    async with AsyncSessionLocal() as session:
        try:
            print("Checking for 'billing_status' column in 'quotations' table...")
            result = await session.execute(text("SHOW COLUMNS FROM quotations LIKE 'billing_status'"))
            column = result.fetchone()
            
            if not column:
                print("Column 'billing_status' missing. Adding it now...")
                await session.execute(text("ALTER TABLE quotations ADD COLUMN billing_status VARCHAR(50) NULL"))
                await session.commit()
                print("SUCCESS: Column 'billing_status' added to 'quotations' table.")
            else:
                print("INFO: Column 'billing_status' already exists.")
                
        except Exception as e:
            print(f"ERROR during migration: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(migrate())
