import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

async def migrate():
    load_dotenv()
    DB_HOST = os.environ.get("DB_HOST")
    DB_NAME = os.environ.get("DB_NAME")
    DB_USER = os.environ.get("DB_USER")
    DB_PASS = os.environ.get("DB_PASS")
    
    url = f"mysql+aiomysql://{DB_USER}:{DB_PASS}@{DB_HOST}/{DB_NAME}"
    engine = create_async_engine(url)
    
    async with engine.connect() as conn:
        try:
            print("Adding id column to char_search...")
            await conn.execute(text("ALTER TABLE char_search ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST"))
            await conn.commit()
            print("Migration successful.")
        except Exception as e:
            print(f"Migration failed or already applied: {e}")
        finally:
            await conn.close()
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
