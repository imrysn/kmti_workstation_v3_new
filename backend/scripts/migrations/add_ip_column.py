import asyncio
from sqlalchemy import text
from db.database import AsyncSessionLocal

async def migrate():
    print("Checking for 'ip_address' column in 'kmti_tickets'...")
    
    async with AsyncSessionLocal() as session:
        try:
            # Check if column exists
            res = await session.execute(text("SHOW COLUMNS FROM kmti_tickets LIKE 'ip_address'"))
            column = res.fetchone()
            
            if not column:
                print("Adding 'ip_address' column...")
                await session.execute(text("ALTER TABLE kmti_tickets ADD COLUMN ip_address VARCHAR(45) AFTER status"))
                print("Adding index for 'ip_address'...")
                await session.execute(text("CREATE INDEX idx_ticket_ip ON kmti_tickets(ip_address)"))
                await session.commit()
                print("Migration successful: Column 'ip_address' added.")
            else:
                print("Column 'ip_address' already exists. Skipping.")
                
        except Exception as e:
            print(f"Migration error: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(migrate())
