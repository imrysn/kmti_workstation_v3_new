import asyncio
from sqlalchemy import text
from db.database import AsyncSessionLocal

columns_to_add = [
    ("grand_total", "DECIMAL(10,2) DEFAULT 0.0"),
    ("customer_incharge", "VARCHAR(255) NULL"),
    ("quotation_status", "VARCHAR(50) DEFAULT 'For Approval'"),
    ("project_status", "VARCHAR(50) DEFAULT 'On Going'"),
    ("submitted_to_admin_at", "DATETIME NULL"),
    ("bill_to", "VARCHAR(255) NULL"),
    ("date_paid", "DATETIME NULL"),
    ("updated_by", "VARCHAR(255) NULL"),
    ("last_updated_at", "DATETIME NULL"),
    ("update_detail", "TEXT NULL")
]

async def migrate():
    async with AsyncSessionLocal() as session:
        for col_name, col_type in columns_to_add:
            try:
                print(f"Checking for '{col_name}' column in 'quotations' table...")
                result = await session.execute(text(f"SHOW COLUMNS FROM quotations LIKE '{col_name}'"))
                column = result.fetchone()
                
                if not column:
                    print(f"Column '{col_name}' missing. Adding it now...")
                    await session.execute(text(f"ALTER TABLE quotations ADD COLUMN {col_name} {col_type}"))
                    await session.commit()
                    print(f"SUCCESS: Column '{col_name}' added to 'quotations' table.")
                else:
                    print(f"INFO: Column '{col_name}' already exists.")
                    
            except Exception as e:
                print(f"ERROR during migration of '{col_name}': {e}")
                await session.rollback()

if __name__ == "__main__":
    asyncio.run(migrate())
