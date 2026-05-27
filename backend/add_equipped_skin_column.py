import asyncio
from sqlalchemy import text
from db.database import AsyncSessionLocal

async def migrate():
    print("Checking for 'equipped_skin' column in 'kmti_workstation_status'...")
    
    async with AsyncSessionLocal() as session:
        try:
            # Check if column exists in the kmti_workstation_status table
            res = await session.execute(text("SHOW COLUMNS FROM kmti_workstation_status LIKE 'equipped_skin'"))
            column = res.fetchone()
            
            if not column:
                print("Adding 'equipped_skin' column...")
                await session.execute(text("ALTER TABLE kmti_workstation_status ADD COLUMN equipped_skin VARCHAR(100) NULL AFTER status_message"))
                await session.commit()
                print("Migration successful: Column 'equipped_skin' added.")
            else:
                print("Column 'equipped_skin' already exists. Skipping.")
                
        except Exception as e:
            print(f"Migration error: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(migrate())
