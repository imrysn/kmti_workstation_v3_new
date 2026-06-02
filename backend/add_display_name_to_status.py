import asyncio
from sqlalchemy import text
from db.database import AsyncSessionLocal

async def migrate():
    print("Checking for 'display_name' column in 'kmti_workstation_status'...")
    
    async with AsyncSessionLocal() as session:
        try:
            # Check if column exists
            res = await session.execute(text("SHOW COLUMNS FROM kmti_workstation_status LIKE 'display_name'"))
            column = res.fetchone()
            
            if not column:
                print("Adding 'display_name' column...")
                await session.execute(text("ALTER TABLE kmti_workstation_status ADD COLUMN display_name VARCHAR(255) NULL AFTER `current_user`"))
                await session.commit()
                print("Migration successful: Column 'display_name' added to 'kmti_workstation_status'.")
            else:
                print("Column 'display_name' already exists in 'kmti_workstation_status'. Skipping.")
                
        except Exception as e:
            print(f"Migration error: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(migrate())
