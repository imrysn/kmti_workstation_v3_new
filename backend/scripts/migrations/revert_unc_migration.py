import asyncio
from sqlalchemy import select
from db.database import AsyncSessionLocal
from models.part import Project, CadFileIndex

async def revert_migration():
    print(">>> Reverting IP-based paths back to KMTI-NAS...")
    
    async with AsyncSessionLocal() as session:
        # 1. Revert Projects
        res = await session.execute(select(Project))
        projects = res.scalars().all()
        for p in projects:
            if "//192.168.200.105/" in p.root_path:
                old = p.root_path
                p.root_path = p.root_path.replace("//192.168.200.105/", "//KMTI-NAS/")
                print(f"  [REVERT PROJECT] {p.name}: {old} -> {p.root_path}")
        
        await session.commit()

        # 2. Revert Files
        CHUNK_SIZE = 5000
        from sqlalchemy import func
        count_res = await session.execute(select(func.count(CadFileIndex.id)))
        total_records = count_res.scalar_one()
        
        print(f">>> Processing {total_records} file records for revert...")
        
        reverted_count = 0
        for offset in range(0, total_records, CHUNK_SIZE):
            res = await session.execute(
                select(CadFileIndex)
                .order_by(CadFileIndex.id)
                .offset(offset)
                .limit(CHUNK_SIZE)
            )
            items = res.scalars().all()
            
            for item in items:
                if "//192.168.200.105/" in item.file_path:
                    item.file_path = item.file_path.replace("//192.168.200.105/", "//KMTI-NAS/")
                    reverted_count += 1
            
            await session.commit()
            if offset % 25000 == 0:
                print(f"  Processed {offset}/{total_records}...")

        print(f"\n>>> REVERT COMPLETE: {reverted_count} files restored to KMTI-NAS.")

if __name__ == "__main__":
    asyncio.run(revert_migration())
