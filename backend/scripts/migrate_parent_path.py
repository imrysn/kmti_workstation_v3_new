import os
import asyncio
import sys
from pathlib import Path

# Add the parent directory (backend) to the path so we can import 'db' and 'models'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.database import engine, AsyncSessionLocal
from sqlalchemy import text, select, update
from models.part import CadFileIndex

async def migrate_parent_path():
    print(">>> Starting Parent Path Migration (v3.2.0)...")
    
    async with AsyncSessionLocal() as db:
        # 1. Add column if not exists (MySQL syntax)
        try:
            # Check if column exists first
            res = await db.execute(text("SHOW COLUMNS FROM cad_file_index LIKE 'parent_path'"))
            if not res.fetchone():
                print("  [STEP 1] Adding parent_path column...")
                await db.execute(text("ALTER TABLE cad_file_index ADD COLUMN parent_path VARCHAR(1024)"))
                await db.commit()
            else:
                print("  [STEP 1] parent_path column already exists.")
        except Exception as e:
            print(f"  [ERROR] Column step failed: {e}")

        # 2. Add Index
        try:
            print("  [STEP 2] Adding Composite Index (project_id, parent_path)...")
            # Clear old index if exists
            try: await db.execute(text("DROP INDEX idx_project_parent ON cad_file_index")); await db.commit();
            except: pass
            
            # Using 255 byte prefix for the path to keep the index reasonably sized (MySQL 767/3072 limit)
            await db.execute(text("CREATE INDEX idx_project_parent ON cad_file_index(project_id, parent_path(255))"))
            await db.commit()
            print("  [SUCCESS] Index created.")
        except Exception as e:
            print(f"  [ERROR] Index step failed: {e}")

        # 3. Batch Population
        print("  [STEP 3] Populating data in batches of 5,000...")
        total_updated = 0
        
        while True:
            # Find 5000 records without parent_path
            stmt = select(CadFileIndex.id, CadFileIndex.file_path).where(
                (CadFileIndex.parent_path == None) | (CadFileIndex.parent_path == '')
            ).limit(5000)
            
            result = await db.execute(stmt)
            batch = result.all()
            
            if not batch:
                break
                
            # Perform Batch Update
            # We map the updates in memory first
            for row_id, file_path in batch:
                # Calculate parent
                # e.g. //NAS/Proj/File.icd -> //NAS/Proj
                norm_path = file_path.replace('\\', '/')
                if '/' in norm_path:
                    parent = norm_path.rsplit('/', 1)[0]
                else:
                    parent = ""
                
                await db.execute(
                    update(CadFileIndex).where(CadFileIndex.id == row_id).values(parent_path=parent)
                )
            
            await db.commit()
            total_updated += len(batch)
            print(f"    ... Updated {total_updated} records so far.")

    print(f"\n>>> MIGRATION COMPLETE! Total records updated: {total_updated}")

if __name__ == "__main__":
    asyncio.run(migrate_parent_path())
