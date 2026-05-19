import asyncio
import sys
import os
from sqlalchemy import text

# Add backend directory to sys.path so we can import db.database
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from db.database import AsyncSessionLocal

async def migrate():
    print("Starting Team Calendar Database Migration for New Columns...")
    
    async with AsyncSessionLocal() as session:
        try:
            # 1. Add priority column to kmti_todos table
            print("Adding 'priority' column to 'kmti_todos' if not exists...")
            try:
                # Check if it already exists by describing or raw alter
                res = await session.execute(text("SHOW COLUMNS FROM kmti_todos LIKE 'priority'"))
                if not res.fetchone():
                    await session.execute(text("""
                        ALTER TABLE kmti_todos ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'Normal';
                    """))
                    print("--- 'priority' column added successfully.")
                else:
                    print("--- 'priority' column already exists.")
            except Exception as e:
                print(f"--- 'priority' column addition failed: {e}")

            # 2. Add leave_type column to kmti_calendar_events table
            print("Adding 'leave_type' column to 'kmti_calendar_events' if not exists...")
            try:
                res = await session.execute(text("SHOW COLUMNS FROM kmti_calendar_events LIKE 'leave_type'"))
                if not res.fetchone():
                    await session.execute(text("""
                        ALTER TABLE kmti_calendar_events ADD COLUMN leave_type VARCHAR(50) DEFAULT NULL;
                    """))
                    print("--- 'leave_type' column added successfully.")
                else:
                    print("--- 'leave_type' column already exists.")
            except Exception as e:
                print(f"--- 'leave_type' column addition failed: {e}")

            await session.commit()
            print("\nMigration Complete Successfully!")
            
        except Exception as e:
            print(f"\nMigration error: {e}")
            await session.rollback()
            raise e

if __name__ == "__main__":
    asyncio.run(migrate())
