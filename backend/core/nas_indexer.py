import os
import asyncio
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import AsyncSessionLocal
from models.part import CadFileIndex, Project
from core.icd_parser import SimpleICDParser

def get_file_metadata(filepath: Path, project_id: int, parse_icd: bool = False):
    """
    Extract file metadata for indexing.

    parse_icd=False (default, used during scans): skips heavy ICD geometry
    parsing so scans stay fast. Geometry fields are populated lazily on the
    first preview request via enrich_icd_metadata().

    parse_icd=True: forces ICD parsing immediately (used by preview endpoint
    when a file has never been enriched yet).
    """
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

    if parse_icd and not filepath.is_dir() and meta["file_type"] == ".icd":
        parser = SimpleICDParser()
        if parser.parse_file(str(filepath)):
            meta["part_geom_name"] = parser.part_name
            if parser.bounds:
                meta["bound_x"] = parser.bounds['size'].x
                meta["bound_y"] = parser.bounds['size'].y
                meta["bound_z"] = parser.bounds['size'].z

    return meta


async def enrich_icd_metadata(record_id: int, file_path: str):
    """
    Lazily parses ICD geometry for a single file and writes it back to the DB.
    Called on first preview of an .icd file that was indexed without geometry data.
    Safe to call multiple times — exits early if bounds are already populated.
    """
    from db.database import AsyncSessionLocal
    from models.part import CadFileIndex

    async with AsyncSessionLocal() as session:
        record = await session.get(CadFileIndex, record_id)
        if not record or record.bound_x is not None:
            return  # Already enriched or not found

        def _parse():
            parser = SimpleICDParser()
            if parser.parse_file(file_path):
                return parser
            return None

        parser = await asyncio.to_thread(_parse)
        if parser:
            record.part_geom_name = parser.part_name
            if parser.bounds:
                record.bound_x = parser.bounds['size'].x
                record.bound_y = parser.bounds['size'].y
                record.bound_z = parser.bounds['size'].z
            await session.commit()

class MultiProjectIndexer:
    def __init__(self):
        self.scanning_tasks = {}

    def start(self):
        # Scan on boot is disabled as requested by user. 
        # Scans now only happen when manually triggered.
        pass
        # asyncio.create_task(self._scan_all_projects_on_boot())
        
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

        print(f"Starting incremental CAD scan for Project {project_id} at {root_path}...")
        
        async with AsyncSessionLocal() as session:
            from sqlalchemy import delete, select
            
            # Fetch existing paths to avoid duplicates during incremental scan
            # We map {normalized_path: original_db_path} to handle cleanup correctly
            existing_result = await session.execute(
                select(CadFileIndex.file_path).where(CadFileIndex.project_id == project_id)
            )
            # Normalize for comparison but keep original for deletion
            path_map = {}
            for r in existing_result.scalars():
                if r:
                    path_map[r.replace("\\", "/").lower()] = r
            
            existing_paths_norm = set(path_map.keys())
            seen_now_norm = set()
            
            total_files = 0
            cad_files = 0
            cad_exts = {'.icd', '.dwg', '.dxf', '.sldprt', '.slddrw', '.sldasm', '.step', '.stp', '.iges', '.igs'}
            batch = []
            
            import queue
            import threading
            scan_queue = queue.Queue(maxsize=50000)
            
            def _walk_thread():
                try:
                    def walk_onerror(err):
                        pass # Ignore permission errors
                        
                    norm_root_path = str(Path(root_path)).replace("\\", "/").lower().rstrip("/")
                    
                    for root, dirs, files in os.walk(root_path, onerror=walk_onerror):
                        curr_root = str(Path(root)).replace("\\", "/").lower().rstrip("/")
                        
                        # Skip the root path itself to avoid duplication in the tree
                        if curr_root == norm_root_path:
                            pass
                        else:
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
            
            while True:
                try:
                    is_done = False
                    # Fetch batch of items from the thread-safe queue
                    for _ in range(200):
                        try:
                            item_type, meta = scan_queue.get_nowait()
                        except queue.Empty:
                            break

                        if item_type == "DONE":
                            is_done = True
                            break
                            
                        # Normalize path for comparison (case-insensitive)
                        norm_path = meta['file_path'].replace("\\", "/").lower()
                        seen_now_norm.add(norm_path)
                        
                        # Only add if completely new to the index (Incremental)
                        if norm_path not in existing_paths_norm:
                            batch.append(CadFileIndex(**meta))
                        
                        total_files += 1
                        if item_type == "file" and meta['file_type'] in cad_exts:
                            cad_files += 1
                            
                    if is_done: break
                except Exception as e:
                    print(f"Error in scan consumption loop: {e}")
                    break
                    
                if not batch and scan_queue.empty():
                    await asyncio.sleep(0.1)
                    continue

                if len(batch) >= 100:
                    session.add_all(batch)
                    await session.commit()
                    batch.clear()
                    await asyncio.sleep(0.01)
                    
            if batch:
                session.add_all(batch)
                await session.commit()

            # Cleanup: Remove files that no longer exist on NAS
            orphans_norm = existing_paths_norm - seen_now_norm
            if orphans_norm:
                # Use the map to get original DB paths for deletion
                orphans_orig = [path_map[p] for p in orphans_norm if p in path_map]
                print(f"Cleaning up {len(orphans_orig)} stale entries for project {project_id}...")
                for i in range(0, len(orphans_orig), 500):
                    chunk = orphans_orig[i:i+500]
                    await session.execute(
                        delete(CadFileIndex).where(
                            (CadFileIndex.project_id == project_id) & 
                            (CadFileIndex.file_path.in_(chunk))
                        )
                    )
                await session.commit()
                
            # Update counts
            proj = await session.get(Project, project_id)
            if proj:
                proj.total_files = total_files
                proj.cad_files = cad_files
                await session.commit()
                
        print(f"Scan complete for Project {project_id}: {total_files} files, {cad_files} CAD.")

indexer = MultiProjectIndexer()
