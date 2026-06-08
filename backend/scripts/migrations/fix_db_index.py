import asyncio
from db.database import AsyncSessionLocal
from sqlalchemy import text

async def fix_index():
    async with AsyncSessionLocal() as session:
        print("Ensuring MySQL FULLTEXT index exists...")
        try:
            # Check if index exists
            res = await session.execute(text("SHOW INDEX FROM cad_file_index WHERE Key_name = 'ft_search'"))
            if not res.fetchone():
                print("Adding FULLTEXT index 'ft_search' (file_name, file_path)...")
                await session.execute(text("ALTER TABLE cad_file_index ADD FULLTEXT INDEX ft_search (file_name, file_path)"))
                print("Done.")
            else:
                print("Index 'ft_search' already exists.")
            await session.commit()
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(fix_index())
