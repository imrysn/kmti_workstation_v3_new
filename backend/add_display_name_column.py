import asyncio
from sqlalchemy import text
from db.database import AsyncSessionLocal

async def migrate():
    print("Checking for 'display_name' column in 'kmti_users'...")
    
    async with AsyncSessionLocal() as session:
        try:
            # Check if column exists
            res = await session.execute(text("SHOW COLUMNS FROM kmti_users LIKE 'display_name'"))
            column = res.fetchone()
            
            if not column:
                print("Adding 'display_name' column...")
                await session.execute(text("ALTER TABLE kmti_users ADD COLUMN display_name VARCHAR(255) NULL AFTER is_active"))
                await session.commit()
                print("Migration successful: Column 'display_name' added to 'kmti_users'.")
            else:
                print("Column 'display_name' already exists in 'kmti_users'. Skipping.")
                
        except Exception as e:
            print(f"Migration error: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(migrate())
