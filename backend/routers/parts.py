"""
Enterprise CAD File Search router (findr clone).
"""
import asyncio
import io
import os
import hashlib
from fastapi import APIRouter, Depends, Query, Response, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from models.user import User, UserRole
from core.auth import get_current_user, require_role
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_, and_, asc, desc, func, select, distinct, delete, text
from sqlalchemy.future import select as future_select # Renamed to avoid conflict with sqlalchemy.select

from models.part import CadFileIndex, Project
from db.database import get_db, AsyncSessionLocal
import re
import json
from pathlib import Path
import urllib.parse
from pydantic import BaseModel
from core.path_utils import normalize_path, globalize_path
from core.preview_service import get_cached_preview
try:
    from core.nas_indexer import indexer, enrich_icd_metadata
except ImportError:
    indexer = None
    enrich_icd_metadata = None

class CreateProjectRequest(BaseModel):
    name: str
    root_path: str
    category: str = "PROJECTS"

from core.trie_engine import trie_service
from typing import List, Optional

class CreateFolderRequest(BaseModel):
    project_name: str
    base_path: str = ""

router = APIRouter()

@router.get("/suggest")
async def get_suggestions(
    q: str = Query(..., min_length=2), 
    parent_path: Optional[str] = None, 
    db: AsyncSession = Depends(get_db)
):
    """
    Predictive search suggestions.
    - Global (Trie) if no parent_path is provided.
    - Scoped (SQL) if parent_path is provided (disregards global).
    """
    if parent_path:
        # Scoped suggestions (SQL LIKE for exact folder match)
        # Replace / with \ for SQL matching if needed, though normalize_path should handle it
        norm_parent = parent_path.replace('/', '\\')
        stmt = (
            select(distinct(CadFileIndex.file_name))
            .where(
                and_(
                    CadFileIndex.parent_path == norm_parent,
                    CadFileIndex.file_name.like(f"{q}%")
                )
            )
            .limit(10)
        )
        res = await db.execute(stmt)
        return res.scalars().all()
    else:
        # Global suggestions (Trie Engine)
        return trie_service.search(q, limit=10)

cad_extensions = {'.icd', '.sldprt', '.sldasm', '.slddrw', '.dwg', '.dxf', '.step', '.stp', '.iges', '.igs'}

def _levenshtein_distance(s1: str, s2: str) -> int:
    if len(s1) < len(s2): return _levenshtein_distance(s2, s1)
    if len(s2) == 0: return len(s1)
    previous_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    return previous_row[-1]

def _fuzzy_match(text: str, query: str) -> bool:
    if len(query) <= 2: return False
    max_errors = max(1, len(query) // 3)
    return _levenshtein_distance(text, query) <= max_errors

def _word_match(text: str, query: str) -> bool:
    words = re.split(r'[_\-\s\.]+', text)
    for word in words:
        if word.startswith(query): return True
    return False

# --- PROJECTS API ---

@router.get("/projects/browse")
async def browse_folder():
    # Deprecated: Spawning a GUI from the backend is unreliable on Windows/asyncio.
    # The frontend should use native Electron dialogs.
    raise HTTPException(
        status_code=400, 
        detail="Backend folder browsing is disabled. Please use the native Electron folder picker."
    )

@router.get("/projects")
async def get_projects(category: str = None, db: AsyncSession = Depends(get_db)):
    query = select(Project)
    if category:
        query = query.where(Project.category == category)
    result = await db.execute(query)
    projs = result.scalars().all()
    return [{
        "id": p.id,
        "name": p.name,
        "rootPath": p.root_path,
        "totalFiles": p.total_files,
        "cadFiles": p.cad_files,
        "isScanning": p.is_scanning
    } for p in projs]

@router.post("/projects")
async def add_project(req: CreateProjectRequest, db: AsyncSession = Depends(get_db), _user: User = Depends(require_role([UserRole.admin, UserRole.it]))):
    # Globalize the path (convert Z: to //NAS) before checking/saving
    root = globalize_path(req.root_path)
    
    # In a distributed setup, the server might not have the drive mapped.
    # We rely on the indexer to report failure if the UNC path is also unreachable.
    if not root.startswith("//") and not os.path.exists(root):
        raise HTTPException(status_code=400, detail="Invalid path. Must be UNC or accessible drive letter.")

    # Normalize the incoming path for a case-insensitive, separator-agnostic comparison.
    norm_new = normalize_path(req.root_path).lower()
    existing = await db.execute(select(Project))
    for proj in existing.scalars().all():
        if normalize_path(proj.root_path).lower() == norm_new:
            raise HTTPException(
                status_code=409,
                detail=f"A project already points to this folder: '{proj.name}'. Remove it first or choose a different folder."
            )

    p = Project(name=req.name, root_path=root, category=req.category)
    db.add(p)
    try:
        await db.commit()
        await db.refresh(p)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Project name already exists")

    # Trigger scan
    p.is_scanning = True
    await db.commit()
    if indexer:
        asyncio.create_task(indexer.scan_project_async(p.id, p.root_path))

    return {"id": p.id, "name": p.name, "rootPath": p.root_path, "totalFiles": 0, "cadFiles": 0, "isScanning": True}

@router.delete("/projects/{project_id}")
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db), _user: User = Depends(require_role([UserRole.admin, UserRole.it]))):
    proj = await db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
        
    await db.delete(proj)
    await db.commit()
    return {"success": True}

@router.post("/projects/{project_id}/scan")
async def scan_project_endpoint(project_id: int, db: AsyncSession = Depends(get_db), _user: User = Depends(require_role([UserRole.admin, UserRole.it]))):
    proj = await db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    proj.is_scanning = True
    await db.commit()
    if indexer:
        asyncio.create_task(indexer.scan_project_async(proj.id, proj.root_path))
    return {"success": True, "message": "Scan started"}

@router.post("/projects/{project_id}/scan/stop")
async def stop_scan_endpoint(project_id: int, db: AsyncSession = Depends(get_db), _user: User = Depends(require_role([UserRole.admin, UserRole.it]))):
    proj = await db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if indexer:
        cancelled = indexer.cancel_project_scan(project_id)
        if cancelled or proj.is_scanning:
            proj.is_scanning = False
            await db.commit()
            return {"success": True, "message": "Scan cancelled"}
            
    return {"success": False, "message": "No active scan found"}


@router.delete("/projects/category/{category}")
async def delete_projects_by_category(category: str, db: AsyncSession = Depends(get_db), _user: User = Depends(require_role([UserRole.admin, UserRole.it]))):
    # 1. Find all projects in this category
    result = await db.execute(select(Project).where(Project.category == category))
    projs = result.scalars().all()
    
    if not projs:
        # Check if we should still return success if the category is just empty
        return {"success": True, "count": 0}

    for proj in projs:
        # Delete associated file indexes first (cascading might handle this, but let's be safe)
        await db.execute(delete(CadFileIndex).where(CadFileIndex.project_id == proj.id))
        await db.delete(proj)
        
    await db.commit()
    return {"success": True, "count": len(projs)}

@router.get("/projects/{project_id}/scan-status")
async def scan_status_stream(project_id: int, db: AsyncSession = Depends(get_db)):
    """
    Server-Sent Events stream for real-time scan progress.
    Emits a JSON object every second while scanning is active:
      { isScanning, filesIndexed, message }
    Client closes the connection when isScanning becomes false.
    """
    from fastapi.responses import StreamingResponse as SSEStreamingResponse
    

    async def event_generator():
        try:
            while True:
                is_scanning = False
                payload_data = {}

                async with AsyncSessionLocal() as session:
                    proj = await session.get(Project, project_id)
                    if not proj:
                        payload_data = {"isScanning": False, "filesIndexed": 0, "message": "Project not found"}
                        is_scanning = False
                    else:
                        # Count indexed files live from the DB
                        from sqlalchemy import func as sqlfunc
                        count_result = await session.execute(
                            select(sqlfunc.count(CadFileIndex.id)).where(CadFileIndex.project_id == project_id)
                        )
                        files_indexed = count_result.scalar_one() or 0

                        from core.nas_indexer import indexer as _indexer
                        files_seen = _indexer.progress.get(project_id, 0) if _indexer else 0

                        is_scanning = bool(proj.is_scanning)
                        payload_data = {
                            "isScanning": is_scanning,
                            "filesIndexed": files_indexed,
                            "filesSeen": files_seen,
                            "message": f"Checking {files_seen:,} files..." if files_seen <= files_indexed else f"Indexing new: {files_seen:,}..."
                        }
                
                # --- Session is now closed & returned to pool ---
                yield f"data: {json.dumps(payload_data)}\n\n"

                if not is_scanning:
                    break
                
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            # Handle client disconnect gracefully
            pass

    return SSEStreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )

@router.get("/tree/{project_id}")
async def get_project_tree(project_id: int, parent_path: str = Query(None), db: AsyncSession = Depends(get_db)):
    proj = await db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    root_path = proj.root_path.replace("\\", "/").rstrip("/")
    
    # 1. Base Case: No parent_path provided -> Return the Root Node only
    if not parent_path:
        return [{
            "name": proj.name,
            "path": root_path,
            "depth": 0,
            "isFolder": True,
            "fileType": "",
            "hasChildren": True # Assume projects have content
        }]

    # 2. Fetch direct children of parent_path at the SQL level (NON-RECURSIVE)
    query = select(CadFileIndex.file_path, CadFileIndex.file_name, CadFileIndex.is_folder, CadFileIndex.file_type).where(CadFileIndex.project_id == project_id)
    
    if parent_path:
        norm_fp = normalize_path(parent_path)
        # INSTANT BROWSING: select only children with this parent_path
        query = query.where(CadFileIndex.parent_path == norm_fp)
    else:
        # Root level for project: parent_path is empty or project root
        query = query.where((CadFileIndex.parent_path == "") | (CadFileIndex.parent_path == root_path))
    
    result = await db.execute(query.order_by(CadFileIndex.is_folder.desc(), CadFileIndex.file_name.asc()))
    items = result.all()
    
    # Python code is now just a simple mapping (no more 180k loop!)
    nodes = []
    for fp, fn, is_folder, ftype in items:
        fp_norm = fp.replace("\\", "/").rstrip("/")
        nodes.append({
            "name": fn,
            "path": fp_norm,
            "isFolder": is_folder,
            "fileType": ftype or ""
        })
        
    return nodes

# --- PARTS/FILES API ---

@router.get("/")
async def list_parts(
    project_id: int = None,
    search: str = None,
    case_sensitive: bool = False,
    cad_only: bool = False,
    include_folders: bool = False,
    folder_path: str = None,
    recursive: bool = True,
    limit: int = 1000,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    query = select(CadFileIndex)
    
    # 1. Project Filter
    if project_id is not None:
        query = query.where(CadFileIndex.project_id == project_id)
    
    # 2. Folder Navigation / Scope Logic
    if folder_path:
        norm_fp = normalize_path(folder_path)
        prefix = norm_fp + "/"
        
        # If searching, respect the recursive toggle. 
        # If just browsing (no search), ALWAYS be non-recursive for the file list.
        is_searching = bool(search and search.strip())
        effective_recursive = recursive if is_searching else False
        
        if effective_recursive:
            # Recursive search: find all items starting with this prefix
            query = query.where(CadFileIndex.file_path.ilike(f"{prefix}%"))
        else:
            # INSTANT BROWSING: find only immediate children using index
            # This is O(1) with the new parent_path column
            query = query.where(CadFileIndex.parent_path == norm_fp)
    elif project_id:
        # PROJECT ROOT SCOPE: If no folder is selected but we have a project,
        # default to showing only the top-level items of that project.
        proj = await db.get(Project, project_id)
        if proj:
            root_norm = normalize_path(proj.root_path)
            # Check if we are searching (which usually implies recursive)
            is_searching = bool(search and search.strip())
            effective_recursive = recursive if is_searching else False
            
            if not effective_recursive:
                # Only show items where parent_path is the project root
                query = query.where(CadFileIndex.parent_path == root_norm)
            # (If recursive, we don't add the parent_path filter, showing all items)
            
    # 3. CAD Only Filter
    cad_exts = {'.icd', '.dwg', '.dxf', '.sldprt', '.slddrw', '.sldasm', '.step', '.stp', '.iges', '.igs'}
    if cad_only:
        query = query.where(CadFileIndex.file_type.in_(cad_exts))
    
    # 4. Folder Type Filter
    if not include_folders:
        query = query.where(CadFileIndex.is_folder == False)
        
    # 5. Search Logic (MySQL FULLTEXT)
    if search and search.strip():
        # Sanitize: Keep alphanumeric, quotes, spaces, and basic dash
        import re
        clean = re.sub(r'[<()~*@]', ' ', search.strip())
        
        # If user explicitly used quotes for boolean matching, treat specially
        if '"' in clean:
            boolean_search = clean
        else:
            words = clean.split()
            if words:
                # Add * for prefix match on each word
                boolean_search = " ".join([f"+{w}*" for w in words])
            else:
                boolean_search = ""

        if boolean_search:
            # Smart Relevance Ranking:
            # 1. Boost exact matches on file_name
            # 2. Boost files/folders starting with the search term
            # 3. Use Full-Text match score for everything else
            # 4. Tie-break with folder status and alphabetical order
            query = query.where(text("MATCH(file_name, file_path) AGAINST(:val IN BOOLEAN MODE)"))
            # We use order_by with the score expression
            query = query.order_by(
                text("""
                    (CASE WHEN file_name = :raw THEN 1000 ELSE 0 END) +
                    (CASE WHEN file_name LIKE :pfx THEN 500 ELSE 0 END) +
                    (MATCH(file_name, file_path) AGAINST(:val IN BOOLEAN MODE) * 10) DESC
                """),
                CadFileIndex.is_folder.desc(),
                CadFileIndex.file_name.asc()
            )
            query = query.params(val=boolean_search, raw=search.strip(), pfx=f"{search.strip()}%")
        else:
            query = query.order_by(CadFileIndex.is_folder.desc(), CadFileIndex.file_name.asc())
    else:
        # Default Sorting
        query = query.order_by(CadFileIndex.is_folder.desc(), CadFileIndex.file_name.asc())

    # 6. Apply limit/offset to SQL query for performance
    # Count total matching results first
    count_query = select(func.count()).select_from(query.subquery())
    total_count_res = await db.execute(count_query)
    total_count = total_count_res.scalar_one()

    # Apply pagination and execute
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    rows = result.scalars().all()
    
    # 7. Final Response
    return {
        "total": total_count,
        "showing": len(rows),
        "capped": total_count > (offset + limit),
        "items": [
            {
                "id": r.id,
                "projectId": r.project_id,
                "isFolder": r.is_folder,
                "fileName": r.file_name,
                "fileType": r.file_type,
                "filePath": r.file_path,
                "size": r.size,
                "lastModified": r.last_modified,
                "partGeomName": r.part_geom_name,
                "boundX": r.bound_x,
                "boundY": r.bound_y,
                "boundZ": r.bound_z
            }
            for r in rows
        ]
    }

@router.get("/preview/{file_id}")
async def get_preview(file_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CadFileIndex).where(CadFileIndex.id == file_id))
    record = result.scalar_one_or_none()
    
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
        
    file_path = record.file_path
    ext = record.file_type.lower() if record.file_type else ""
    
    return await get_cached_preview(file_path, ext)

@router.get("/download")
async def download_part(file_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CadFileIndex).where(CadFileIndex.id == file_id))
    record = result.scalar_one_or_none()
    
    if not record:
        raise HTTPException(status_code=404, detail="File index not found")
        
    filepath = Path(record.file_path)
    if not filepath.exists() or (not record.is_folder and not filepath.is_file()):
        raise HTTPException(status_code=404, detail="Physical file missing from storage")

    if record.is_folder:
        raise HTTPException(status_code=400, detail="Cannot download a folder directly")

    async def file_gen():
        with open(filepath, "rb") as f:
            while True:
                chunk = f.read(65536)
                if not chunk:
                    break
                yield chunk

    return StreamingResponse(
        file_gen(),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{urllib.parse.quote(record.file_name)}"}
    )

import shutil

@router.delete("/{file_id}")
async def delete_item(file_id: int, db: AsyncSession = Depends(get_db), _user: User = Depends(require_role([UserRole.admin, UserRole.it]))):
    result = await db.execute(select(CadFileIndex).where(CadFileIndex.id == file_id))
    record = result.scalar_one_or_none()
    
    if not record:
        raise HTTPException(status_code=404, detail="Item not found")
        
    filepath = Path(record.file_path)
    
    # 1. Delete physical files if they exist
    if filepath.exists():
        try:
            if record.is_folder:
                shutil.rmtree(filepath)
            else:
                os.remove(filepath)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete physical file: {str(e)}")
            
    # 2. Delete database records
    if record.is_folder:
        # Delete the folder itself AND all children.
        # Use exact match OR children with trailing slash to prevent matching
        # sibling folders that share a common prefix (e.g. /foo vs /foobar).
        folder_prefix = record.file_path.rstrip('/\\') + '/'
        folder_prefix_back = record.file_path.rstrip('/\\') + '\\'
        await db.execute(
            delete(CadFileIndex).where(
                (CadFileIndex.project_id == record.project_id) &
                (
                    (CadFileIndex.file_path == record.file_path) |
                    (CadFileIndex.file_path.like(f"{folder_prefix}%")) |
                    (CadFileIndex.file_path.like(f"{folder_prefix_back}%"))
                )
            )
        )
    else:
        await db.delete(record)
        
    await db.commit()
    
    # Rescan project to fix counts asynchronously.
    # Fetch the project to get the actual root_path — passing "" caused silent scan failures.
    if indexer and getattr(record, 'project_id', None):
        proj = await db.get(Project, record.project_id)
        if proj:
            asyncio.create_task(indexer.scan_project_async(proj.id, proj.root_path))

    return {"success": True}
