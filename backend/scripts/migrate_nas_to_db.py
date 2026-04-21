import asyncio
import os
import json
import sys
from pathlib import Path
from datetime import datetime
from sqlalchemy import select

# Add the parent directory to sys.path so we can import from 'db' and 'models'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.database import AsyncSessionLocal, engine, Base
from models.quotation import Quotation, QuotationHistory

# Hardcoded NAS paths from quotations router
NAS_QUOTATIONS_DIR = Path(r"\\KMTI-NAS\Shared\data\template")
NAS_HISTORY_DIR    = NAS_QUOTATIONS_DIR / "history"

async def migrate():
    print(f"Connecting to database...")
    async with engine.begin() as conn:
        # Ensure tables exist
        await conn.run_sync(Base.metadata.create_all)
    
    async with AsyncSessionLocal() as session:
        # 1. Collect all potential quotation sources
        search_paths = [NAS_QUOTATIONS_DIR, Path(".")]
        found_nos = set()

        for path in search_paths:
            if not path.exists(): continue
            print(f"Scanning {path.absolute()} for primary records...")
            json_files = list(path.glob("*.json"))
            
            for f in json_files:
                if f.name == "package.json" or f.name.startswith("package-lock"): continue
                try:
                    data = json.loads(f.read_text(encoding="utf-8"))
                    qd = data.get("quotationDetails", {})
                    q_no = qd.get("quotationNo")
                    if not q_no: continue
                    
                    if q_no in found_nos: continue
                    
                    # Check if already in DB
                    stmt = select(Quotation).where(Quotation.quotation_no == q_no)
                    res = await session.execute(stmt)
                    if res.scalar_one_or_none():
                        found_nos.add(q_no)
                        continue

                    ci = data.get("clientInfo", {})
                    sig = data.get("signatures", {}).get("quotation", {}).get("preparedBy", {})
                    date_str = qd.get("date", datetime.now().strftime("%Y-%m-%d"))
                    try:
                        q_date = datetime.strptime(date_str, "%Y-%m-%d")
                    except:
                        q_date = datetime.utcnow()

                    new_q = Quotation(
                        quotation_no=q_no,
                        client_name=ci.get("company", "Unknown Client"),
                        designer_name=sig.get("name", "Unknown Designer"),
                        date=q_date,
                        data=json.dumps(data, ensure_ascii=False),
                        is_active=False
                    )
                    session.add(new_q)
                    found_nos.add(q_no)
                    print(f" Migrated primary: {q_no}")
                except Exception as e:
                    print(f" [ERROR] Failed to migrate {f.name}: {e}")

        # 2. Scan History folders for any orphaned quotations (History exists, but no primary JSON)
        if NAS_HISTORY_DIR.exists():
            print(f"Scanning history for orphaned records in {NAS_HISTORY_DIR}...")
            for h_dir in NAS_HISTORY_DIR.iterdir():
                if not h_dir.is_dir(): continue
                
                # Attempt to reconstruct original quotation number
                # Directory name is usually safe_name (replacing / with _)
                # We'll try to find any existing record or create a new one
                q_no_guess = h_dir.name.replace("_", "/")
                
                stmt = select(Quotation).where(Quotation.quotation_no == q_no_guess)
                res = await session.execute(stmt)
                quot = res.scalar_one_or_none()
                
                snaps = sorted(list(h_dir.glob("*.json")), reverse=True)
                if not snaps: continue

                if not quot:
                    # RECONSTRUCT PRIMARY FROM LATEST SNAPSHOT
                    try:
                        latest_snap = json.loads(snaps[0].read_text(encoding="utf-8"))
                        snap_data = latest_snap.get("data", latest_snap)
                        qd = snap_data.get("quotationDetails", {})
                        ci = snap_data.get("clientInfo", {})
                        sig = snap_data.get("signatures", {}).get("quotation", {}).get("preparedBy", {})
                        
                        real_q_no = qd.get("quotationNo", q_no_guess)
                        
                        # Final check for real_q_no
                        stmt = select(Quotation).where(Quotation.quotation_no == real_q_no)
                        res = await session.execute(stmt)
                        quot = res.scalar_one_or_none()
                        
                        if not quot:
                            quot = Quotation(
                                quotation_no=real_q_no,
                                client_name=ci.get("company", "Unknown Client"),
                                designer_name=sig.get("name", "Unknown Designer"),
                                date=datetime.utcnow(),
                                data=json.dumps(snap_data, ensure_ascii=False),
                                is_active=False
                            )
                            session.add(quot)
                            await session.flush()
                            print(f" Reconstructed primary from history: {real_q_no}")
                    except Exception as e:
                        print(f" [ERROR] Could not reconstruct from {h_dir.name}: {e}")
                        continue

                # 3. Migrate Snapshots
                for s in snaps:
                    try:
                        # Check if snapshot already exists for this quotation
                        # We use label and timestamp stem as a unique check
                        s_stem = s.stem
                        stmt = select(QuotationHistory).where(
                            QuotationHistory.quotation_id == quot.id,
                            QuotationHistory.label.like(f"%{s_stem}%")
                        )
                        res = await session.execute(stmt)
                        if res.scalar_one_or_none(): continue

                        s_data = json.loads(s.read_text(encoding="utf-8"))
                        meta = s_data.get("__metadata__", {})
                        
                        history_entry = QuotationHistory(
                            quotation_id=quot.id,
                            label=meta.get("description", f"Snapshot {s_stem}"),
                            author=meta.get("author", "Unknown"),
                            data=json.dumps(s_data.get("data", s_data), ensure_ascii=False),
                            created_at=datetime.strptime(s_stem, "%Y%m%d_%H%M%S") if len(s_stem) == 15 else datetime.utcnow()
                        )
                        session.add(history_entry)
                        print(f"  Added snapshot: {s.name} for {quot.quotation_no}")
                    except Exception as history_e:
                        print(f"  [WARN] Failed to migrate snapshot {s.name} for {quot.quotation_no}: {history_e}")

        await session.commit()
        print("Migration complete!")

if __name__ == "__main__":
    asyncio.run(migrate())
