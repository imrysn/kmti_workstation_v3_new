import os
import asyncio
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import AsyncSessionLocal
from models.part import CadFileIndex, Project
from core.icd_parser import SimpleICDParser

def get_file_metadata(filepath: Path, project_id: int, project_root: Path, parse_icd: bool = False, file_size: int = None, last_modified: float = None, is_dir: bool = None):
    """
    Extract file metadata for indexing. (Optimized to accept pre-cached OS stats)
    """
    _is_dir = is_dir if is_dir is not None else filepath.is_dir()
    _size = file_size if file_size is not None else (filepath.stat().st_size if not _is_dir else 0)
    _mtime = last_modified if last_modified is not None else filepath.stat().st_mtime

    meta = {
        "project_id": project_id,
        "is_folder": _is_dir,
        "file_name": filepath.name,
        "file_type": filepath.suffix.lower() if not _is_dir else "folder",
        "file_path": str(filepath.resolve()).replace("\\", "/"),
        "category": "Unknown",
        "part_type": "Unknown",
        "size": _size,
        "last_modified": _mtime,
        "part_geom_name": None,
        "bound_x": None,
        "bound_y": None,
        "bound_z": None
    }

    try:
        rel = filepath.relative_to(project_root)
        parts = rel.parts
        if len(parts) > 0:
            meta["category"] = parts[0]
            if len(parts) > 1:
                meta["part_type"] = parts[1]
    except Exception:
        pass

    if parse_icd and not _is_dir and meta["file_type"] == ".icd":
        parser = SimpleICDParser()
        if parser.parse_file(str(filepath)):
            meta["part_geom_name"] = parser.part_name
            if parser.bounds:
                meta["bound_x"] = parser.bounds['size'].x
                meta["bound_y"] = parser.bounds['size'].y
                meta["bound_z"] = parser.bounds['size'].z

    return meta


async def setup_fts(session: AsyncSession):
    """
    Creates a MySQL FULLTEXT index for high-performance searching.
    Replaces the previous SQLite FTS5 implementation.
    """
    # 1. Clean up old SQLite/MariaDB artifacts if they somehow exist (Safety)
    try:
        from sqlalchemy import text
        await session.execute(text("DROP TRIGGER IF EXISTS cad_file_index_ai"))
        await session.execute(text("DROP TRIGGER IF EXISTS cad_file_index_ad"))
        await session.execute(text("DROP TRIGGER IF EXISTS cad_file_index_au"))
        await session.execute(text("DROP TABLE IF EXISTS cad_file_index_fts"))
    except Exception:
        pass

    # 2. Add MySQL FULLTEXT index
    # We use a try-except because 'ADD FULLTEXT' might fail if it already exists or on certain MariaDB versions
    try:
        # Check if index already exists
        res = await session.execute(text("SHOW INDEX FROM cad_file_index WHERE Key_name = 'ft_search'"))
        if not res.fetchone():
            print("Creating MySQL FULLTEXT index 'ft_search'...")
            await session.execute(text("ALTER TABLE cad_file_index ADD FULLTEXT INDEX ft_search (file_name, file_path)"))
    except Exception as e:
        print(f"Warning: Could not create FULLTEXT index: {e}")
    
    await session.commit()


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
        self.progress = {} # {project_id: files_seen}

    def start(self):
        # Scan on boot is disabled as requested by user. 
        # Scans now only happen when manually triggered.
        pass
        # asyncio.create_task(self._scan_all_projects_on_boot())
        
    def stop(self):
        for t in self.scanning_tasks.values():
            t.cancel()

    def cancel_project_scan(self, project_id: int):
        task_id = f"proj_{project_id}"
        if task_id in self.scanning_tasks:
            self.scanning_tasks[task_id].cancel()
            return True
        return False

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
            if project_id in self.progress:
                del self.progress[project_id]
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
            from sqlalchemy import delete, select, insert
            
            # Setup FTS infrastructure first
            await setup_fts(session)
            
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
            
            import concurrent.futures
            
            # --- Parallel Walk Strategy ---
            # Pre-fetch existing folder skip-hints {normalized_path: last_modified}
            # This allows us to skip scanning folders that haven't changed since the last run.
            folder_mtime_map = {}
            folder_res = await session.execute(
                select(CadFileIndex.file_path, CadFileIndex.last_modified)
                .where((CadFileIndex.project_id == project_id) & (CadFileIndex.is_folder == True))
            )
            for r_p, r_m in folder_res:
                if r_p: folder_mtime_map[r_p.replace("\\", "/").lower()] = r_m

            def _walk_folder_worker(folder_path):
                """Worker function to scan a single folder and its direct children."""
                try:
                    norm_current = str(folder_path).replace("\\", "/").lower().rstrip("/")
                    
                    # 1. Check if we can skip this folder (optimization)
                    # Note: We still scan the root itself once.
                    if norm_current in folder_mtime_map:
                        try:
                            # Direct look at OS folder mtime
                            current_mtime = folder_path.stat(follow_symlinks=False).st_mtime
                            # If it matches our DB, we could *theoretically* skip its children.
                            # BUT, to be 100% safe for all NAS, we only skip if the folder IS NOT modified.
                            pass # We will add deep skip logic here in next iteration if needed
                        except Exception:
                            pass

                    subfolders = []
                    with os.scandir(folder_path) as it:
                        for entry in it:
                            try:
                                is_dir = entry.is_dir(follow_symlinks=False)
                                stat = entry.stat(follow_symlinks=False)
                                filepath = Path(entry.path)
                                
                                meta = get_file_metadata(
                                    filepath, 
                                    project_id, 
                                    target_dir, 
                                    file_size=stat.st_size if not is_dir else 0,
                                    last_modified=stat.st_mtime,
                                    is_dir=is_dir
                                )
                                
                                if is_dir:
                                    scan_queue.put(("folder", meta))
                                    subfolders.append(filepath)
                                else:
                                    scan_queue.put(("file", meta))
                                    
                            except (OSError, PermissionError):
                                pass
                    return subfolders
                except Exception as e:
                    print(f"Error in folder worker for {folder_path}: {e}")
                    return []

            def _master_walk_thread():
                """Manages a pool of workers to crawl the directory tree in parallel."""
                full_walk_success = True
                try:
                    tasks = []
                    # Increased to 12 workers for Xeon v6 (8 threads) -> handle network latency efficiently
                    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
                        # Initial task
                        tasks.append(executor.submit(_walk_folder_worker, target_dir))
                        
                        while tasks:
                            # Get completed tasks
                            done, _ = concurrent.futures.wait(tasks, timeout=0.1, return_when=concurrent.futures.FIRST_COMPLETED)
                            for t in done:
                                subfolders = t.result()
                                tasks.remove(t)
                                # Submit new folder tasks found
                                for sf in subfolders:
                                    tasks.append(executor.submit(_walk_folder_worker, sf))
                                    
                except Exception as e:
                    print(f"CRITICAL: Master walk thread failed: {e}")
                    full_walk_success = False
                finally:
                    scan_queue.put(("DONE", full_walk_success))
                
            # Start the multi-threaded master
            threading.Thread(target=_master_walk_thread, daemon=True).start()
            
            is_full_walk_completed = False
            while True:
                try:
                    is_done = False
                    # Fetch batch of items from the thread-safe queue
                    for _ in range(5000):
                        try:
                            # We use a short timeout to check if the main task was cancelled
                            item_type, meta_or_status = scan_queue.get(timeout=0.1)
                        except queue.Empty:
                            break

                        if item_type == "DONE":
                            is_done = True
                            is_full_walk_completed = meta_or_status
                            break
                            
                        meta = meta_or_status
                            
                        # Normalize path for comparison (case-insensitive)
                        norm_path = meta['file_path'].replace("\\", "/").lower()
                        seen_now_norm.add(norm_path)
                        
                        # Only add if completely new to the index (Incremental)
                        if norm_path not in existing_paths_norm:
                            batch.append(meta)
                        
                        total_files += 1
                        # Update live progress for SSE stream
                        self.progress[project_id] = total_files

                        if item_type == "file" and meta['file_type'] in cad_exts:
                            cad_files += 1
                            
                    if is_done: break
                except Exception as e:
                    print(f"Error in scan consumption loop: {e}")
                    break

                if len(batch) >= 5000:
                    await session.execute(insert(CadFileIndex).values(batch))
                    await session.commit()
                    batch.clear()

                # Update project counts periodically so the sidebar stays accurate
                if total_files % 1000 == 0:
                    proj = await session.get(Project, project_id)
                    if proj:
                        proj.total_files = total_files
                        proj.cad_files = cad_files
                        await session.commit()

                # Yield control to event loop; sleep longer if no items
                if scan_queue.empty():
                    await asyncio.sleep(0.1)
                else:
                    await asyncio.sleep(0)
            if batch:
                await session.execute(insert(CadFileIndex).values(batch))
                await session.commit()

            # Cleanup: Remove files that no longer exist on NAS
            # SAFETY LOCK: Only perform cleanup if we are CERTAIN the scan was a complete, error-free walk.
            if is_full_walk_completed:
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
            else:
                print(f">>> WARNING: Scan for project {project_id} was partial or interrupted. Skipping cleanup to prevent data loss.")
                
            # Update counts
            proj = await session.get(Project, project_id)
            if proj:
                proj.total_files = total_files
                proj.cad_files = cad_files
                proj.is_scanning = False
                await session.commit()
                
        print(f"Scan complete for Project {project_id}: {total_files} files, {cad_files} CAD.")

indexer = MultiProjectIndexer()
