
import asyncio
from sqlalchemy import text
from db.database import AsyncSessionLocal

async def migrate():
    print("Adding high-performance composite indexes to 'cad_file_index'...")
    
    async with AsyncSessionLocal() as session:
        try:
            # 1. Composite index for filtering by project, folder, and type
            # This makes "CAD only" or "Include Folders" toggles much faster.
            print("Creating idx_project_folder_type...")
            await session.execute(text("CREATE INDEX IF NOT EXISTS idx_project_folder_type ON cad_file_index(project_id, is_folder, file_type)"))
            
            # 2. Optimized path lookup (already partially covered by idx_filepath, but adding folder-specific prefix index)
            # This helps with the recursive/non-recursive toggle.
            print("Creating idx_project_path...")
            await session.execute(text("CREATE INDEX IF NOT EXISTS idx_project_path ON cad_file_index(project_id, file_path(256))"))
            
            await session.commit()
            print("Database migration successful!")
        except Exception as e:
            print(f"Migration error: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(migrate())
