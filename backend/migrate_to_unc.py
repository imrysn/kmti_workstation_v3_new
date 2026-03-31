import os
import asyncio
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import AsyncSessionLocal
from models.part import Project, CadFileIndex
from core.path_utils import globalize_path

async def migrate():
    print(">>> Starting Database Path Globalization Migration...")
    
    async with AsyncSessionLocal() as session:
        # 1. Migrate Projects
        res = await session.execute(select(Project))
        projects = res.scalars().all()
        
        proj_count = 0
        for p in projects:
            new_path = globalize_path(p.root_path)
            if new_path != p.root_path:
                print(f"  [PROJECT] {p.name}: {p.root_path} -> {new_path}")
                p.root_path = new_path
                proj_count += 1
        
        await session.commit()
        print(f">>> Updated {proj_count} projects.\n")

        # 2. Migrate File Indexes
        # We do this in chunks to avoid memory issues with millions of records
        CHUNK_SIZE = 5000
        total_migrated = 0
        
        # Get total count
        from sqlalchemy import func
        count_res = await session.execute(select(func.count(CadFileIndex.id)))
        total_records = count_res.scalar_one()
        
        print(f">>> Processing {total_records} file records in batches of {CHUNK_SIZE}...")
        
        for offset in range(0, total_records, CHUNK_SIZE):
            res = await session.execute(
                select(CadFileIndex)
                .order_by(CadFileIndex.id)
                .offset(offset)
                .limit(CHUNK_SIZE)
            )
            items = res.scalars().all()
            
            for item in items:
                new_path = globalize_path(item.file_path)
                if new_path != item.file_path:
                    item.file_path = new_path
                    total_migrated += 1
            
            await session.commit()
            print(f"  Processed {min(offset + CHUNK_SIZE, total_records)}/{total_records}...")

        print(f"\n>>> MIGRATION COMPLETE: {total_migrated} files updated.")

if __name__ == "__main__":
    asyncio.run(migrate())
