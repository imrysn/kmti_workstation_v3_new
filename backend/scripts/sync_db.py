import asyncio
from db.database import engine, Base
from models.user import Feedback

async def init_db():
    async with engine.begin() as conn:
        # This will create any missing tables (like kmti_feedback)
        await conn.run_sync(Base.metadata.create_all)
    print("Database synchronized: kmti_feedback table created successfully.")

if __name__ == "__main__":
    asyncio.run(init_db())
