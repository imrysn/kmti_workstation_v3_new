import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

async def check_schema():
    load_dotenv()
    DB_HOST = os.environ.get("DB_HOST")
    DB_NAME = os.environ.get("DB_NAME")
    DB_USER = os.environ.get("DB_USER")
    DB_PASS = os.environ.get("DB_PASS")
    
    url = f"mysql+aiomysql://{DB_USER}:{DB_PASS}@{DB_HOST}/{DB_NAME}"
    engine = create_async_engine(url)
    
    async with engine.connect() as conn:
        try:
            print(f"Checking table: char_search")
            res = await conn.execute(text("DESCRIBE char_search"))
            columns = res.fetchall()
            for col in columns:
                print(col)
                
            print(f"\nChecking table: heat_trmnt")
            res = await conn.execute(text("DESCRIBE heat_trmnt"))
            columns = res.fetchall()
            for col in columns:
                print(col)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            await conn.close()
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_schema())
