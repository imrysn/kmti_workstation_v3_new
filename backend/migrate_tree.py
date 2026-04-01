import asyncio
from sqlalchemy import text
from db.database import engine

async def migrate():
    async with engine.begin() as conn:
        print(">>> Modifying file_path column and adding index...")
        # 1. Modify the column to be a String with fixed length
        await conn.execute(text("ALTER TABLE cad_file_index MODIFY file_path VARCHAR(1024);"))
        
        # 2. Add a B-Tree index specifically for path-prefix queries
        print(">>> Adding B-Tree index to file_path...")
        try:
            await conn.execute(text("CREATE INDEX idx_filepath ON cad_file_index(file_path);"))
        except Exception as e:
            print(f">>> Index might already exist: {e}")
            
    print(">>> Migration complete.")

if __name__ == "__main__":
    asyncio.run(migrate())
