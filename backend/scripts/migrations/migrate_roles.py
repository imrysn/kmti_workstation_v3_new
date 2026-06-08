import asyncio
from sqlalchemy import text
from db.database import engine

async def migrate_roles():
    async with engine.begin() as conn:
        print("Migrating roles from 'viewer' to 'user'...")
        # Step 1: Update the enum values in the database table
        await conn.execute(text("UPDATE kmti_users SET role = 'user' WHERE role = 'viewer'"))
        print("Done.")

if __name__ == "__main__":
    asyncio.run(migrate_roles())
