import asyncio
from sqlalchemy import text
from db.database import engine

async def fix_enum():
    async with engine.begin() as conn:
        print("Altering table to update enum...")
        # MySQL specific: Alter column to add 'user' to the ENUM
        # Assuming the table name is kmti_users and column is role
        try:
            await conn.execute(text("ALTER TABLE kmti_users MODIFY COLUMN role ENUM('user', 'admin', 'it') NOT NULL DEFAULT 'user'"))
            print("Enum updated. Migrating data...")
            # Fix any empty or 'viewer' roles
            await conn.execute(text("UPDATE kmti_users SET role = 'user' WHERE role = '' OR role IS NULL"))
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(fix_enum())
