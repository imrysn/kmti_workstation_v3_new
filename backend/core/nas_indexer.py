import os
import asyncio
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from database import AsyncSessionLocal
from models import CadFileIndex, Project
from core.icd_parser import SimpleICDParser

def get_file_metadata(filepath: Path, project_id: int):
    stat = filepath.stat()
    meta = {
        "project_id": project_id,
        "is_folder": filepath.is_dir(),
        "file_name": filepath.name,
        "file_type": filepath.suffix.lower() if not filepath.is_dir() else "folder",
        "file_path": str(filepath.resolve()).replace("\\", "/"),
        "category": filepath.parent.parent.name if len(filepath.parts) > 2 else "Unknown",
        "part_type": filepath.parent.name,
        "size": stat.st_size if not filepath.is_dir() else 0,
        "last_modified": stat.st_mtime,
        "part_geom_name": None,
        "bound_x": None,
        "bound_y": None,
        "bound_z": None
    }
    
    if not filepath.is_dir() and meta["file_type"] == ".icd":
        parser = SimpleICDParser()
        if parser.parse_file(str(filepath)):
            meta["part_geom_name"] = parser.part_name
            if parser.bounds:
                meta["bound_x"] = parser.bounds['size'].x
                meta["bound_y"] = parser.bounds['size'].y
                meta["bound_z"] = parser.bounds['size'].z
                
    return meta

class MultiProjectIndexer:
    def __init__(self):
        self.scanning_tasks = {}

    def start(self):
        # On boot, scan all active projects asynchronously
        asyncio.create_task(self._scan_all_projects_on_boot())
        
    def stop(self):
        for t in self.scanning_tasks.values():
            t.cancel()

    async def _scan_all_projects_on_boot(self):
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select
            result = await session.execute(select(Project))
            projects = result.scalars().all()
            for p in projects:
                asyncio.create_task(self.scan_project_async(p.id, p.root_path))

    async def scan_project_async(self, project_id: int, root_path: str):
        task_id = f"proj_{project_id}"
        if task_id in self.scanning_tasks: return
            
        task = asyncio.create_task(self._do_scan(project_id, root_path))
        self.scanning_tasks[task_id] = task
        try:
            await task
        except Exception as e:
            print(f"Error scanning project {project_id}: {e}")
        finally:
            if task_id in self.scanning_tasks:
                del self.scanning_tasks[task_id]
            try:
                # Ensure is_scanning is ALWAYS disabled even on crash
                async with AsyncSessionLocal() as session:
                    proj = await session.get(Project, project_id)
                    if proj:
                        proj.is_scanning = False
                        await session.commit()
            except Exception:
                pass

    async def _do_scan(self, project_id: int, root_path: str):
        target_dir = Path(root_path)
        if not target_dir.exists() or not target_dir.is_dir():
            print(f"Path not found: {root_path}")
            return

        print(f"Starting CAD scan for Project {project_id} at {root_path}...")
        
        async with AsyncSessionLocal() as session:
            from sqlalchemy import delete
            # Delete old entries
            await session.execute(delete(CadFileIndex).where(CadFileIndex.project_id == project_id))
            await session.commit()
            
            total_files = 0
            cad_files = 0
            cad_exts = {'.icd', '.dwg', '.dxf', '.sldprt', '.slddrw', '.sldasm', '.step', '.stp', '.iges', '.igs'}
            batch = []
            
            import queue
            import threading
            scan_queue = queue.Queue(maxsize=2000)
            
            def _walk_thread():
                try:
                    def walk_onerror(err):
                        pass # Ignore permission errors
                        
                    for root, dirs, files in os.walk(root_path, onerror=walk_onerror):
                        try:
                            meta = get_file_metadata(Path(root), project_id)
                            scan_queue.put(("folder", meta))
                        except Exception: pass
                        
                        for f in files:
                            try:
                                meta = get_file_metadata(Path(root) / f, project_id)
                                scan_queue.put(("file", meta))
                            except Exception: pass
                except Exception as e:
                    print(f"CRITICAL: Walk thread crashed: {e}")
                finally:
                    scan_queue.put(("DONE", None))
                
            # Spawn worker thread
            threading.Thread(target=_walk_thread, daemon=True).start()
            
            # Consume queue asynchronously
            while True:
                try:
                    # fetch up to 100 items at once if available
                    for _ in range(100):
                        item_type, meta = scan_queue.get_nowait()
                        if item_type == "DONE":
                            break
                            
                        batch.append(CadFileIndex(**meta))
                        total_files += 1
                        if item_type == "file" and meta['file_type'] in cad_exts:
                            cad_files += 1
                            
                    if item_type == "DONE":
                        break
                        
                except queue.Empty:
                    # Queue is empty, yield back to FastAPI explicitly
                    await asyncio.sleep(0.05)
                    continue
                    
                if len(batch) >= 100:
                    session.add_all(batch)
                    await session.commit()
                    batch.clear()
                    await asyncio.sleep(0.01) # Yield after commit
                    
            if batch:
                session.add_all(batch)
                await session.commit()
                
            # Update counts
            proj = await session.get(Project, project_id)
            if proj:
                proj.total_files = total_files
                proj.cad_files = cad_files
                await session.commit()
                
        print(f"Scan complete for Project {project_id}: {total_files} files, {cad_files} CAD.")

indexer = MultiProjectIndexer()
