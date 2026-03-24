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
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_, and_, asc, desc, func, select, distinct, delete
from sqlalchemy.future import select as future_select # Renamed to avoid conflict with sqlalchemy.select

from models.part import CadFileIndex, Project
from db.database import get_db, AsyncSessionLocal
import re
import json
from pathlib import Path
import urllib.parse
from pydantic import BaseModel
from core.icd_parser import SimpleICDParser
from core.thumbnail_helper import get_shell_thumbnail
from core.dwg_forensic import get_dwg_preview
try:
    from core.nas_indexer import indexer, enrich_icd_metadata
except ImportError:
    indexer = None
    enrich_icd_metadata = None

class CreateProjectRequest(BaseModel):
    name: str
    root_path: str
    category: str = "PROJECTS"

class CreateFolderRequest(BaseModel):
    project_name: str
    base_path: str = ""

router = APIRouter()

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
async def add_project(req: CreateProjectRequest, db: AsyncSession = Depends(get_db)):
    if not os.path.exists(req.root_path):
        raise HTTPException(status_code=400, detail="Invalid root path. Directory does not exist.")

    # Normalize the incoming path for a case-insensitive, separator-agnostic comparison.
    norm_new = req.root_path.replace("\\", "/").rstrip("/").lower()
    existing = await db.execute(select(Project))
    for proj in existing.scalars().all():
        if proj.root_path.replace("\\", "/").rstrip("/").lower() == norm_new:
            raise HTTPException(
                status_code=409,
                detail=f"A project already points to this folder: '{proj.name}'. Remove it first or choose a different folder."
            )

    p = Project(name=req.name, root_path=req.root_path, category=req.category)
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
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db)):
    proj = await db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
        
    await db.delete(proj)
    await db.commit()
    return {"success": True}

@router.post("/projects/{project_id}/scan")
async def scan_project_endpoint(project_id: int, db: AsyncSession = Depends(get_db)):
    proj = await db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    proj.is_scanning = True
    await db.commit()
    if indexer:
        asyncio.create_task(indexer.scan_project_async(proj.id, proj.root_path))
    return {"success": True, "message": "Scan started"}


@router.delete("/projects/category/{category}")
async def delete_projects_by_category(category: str, db: AsyncSession = Depends(get_db)):
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
        while True:
            async with AsyncSessionLocal() as session:
                proj = await session.get(Project, project_id)
                if not proj:
                    payload = json.dumps({"isScanning": False, "filesIndexed": 0, "message": "Project not found"})
                    yield f"data: {payload}\n\n"
                    break

                # Count indexed files live from the DB
                from sqlalchemy import func as sqlfunc
                count_result = await session.execute(
                    select(sqlfunc.count(CadFileIndex.id)).where(CadFileIndex.project_id == project_id)
                )
                files_indexed = count_result.scalar_one() or 0

                payload = json.dumps({
                    "isScanning": bool(proj.is_scanning),
                    "filesIndexed": files_indexed,
                    "message": f"Indexed {files_indexed:,} files..."
                })
                yield f"data: {payload}\n\n"

                if not proj.is_scanning:
                    break

            await asyncio.sleep(1)

    return SSEStreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )

@router.get("/tree/{project_id}")
async def get_project_tree(project_id: int, db: AsyncSession = Depends(get_db)):
    proj = await db.get(Project, project_id)
    if not proj:
        return []

    result = await db.execute(
        select(CadFileIndex.file_path, CadFileIndex.file_name, CadFileIndex.is_folder, CadFileIndex.file_type)
        .where(CadFileIndex.project_id == project_id)
        .order_by(CadFileIndex.file_path)
    )
    items = result.all()
    if not items: return []
    
    # Normalize root path — use forward slashes, strip trailing slash
    root_path = proj.root_path.replace("\\", "/").rstrip("/")
    # Count non-empty parts so we can compute relative depth
    root_parts = [p for p in root_path.split("/") if p]
    root_parts_count = len(root_parts)
    
    nodes = []
    # Root node is always depth 0
    nodes.append({
        "name": proj.name,
        "path": root_path,
        "depth": 0,
        "isFolder": True,
        "fileType": ""
    })
    
    for fp, fn, is_folder, ftype in items:
        fp_norm = fp.replace("\\", "/").rstrip("/")
        
        # Skip if this IS the root
        if fp_norm == root_path:
            continue
        
        # Calculate depth by counting path parts relative to root
        fp_parts = [p for p in fp_norm.split("/") if p]
        depth = len(fp_parts) - root_parts_count
        if depth < 1:
            depth = 1
            
        nodes.append({
            "name": fn,
            "path": fp_norm,
            "depth": depth,
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
    db: AsyncSession = Depends(get_db)
):
    query = select(CadFileIndex)
    if project_id is not None:
        query = query.where(CadFileIndex.project_id == project_id)
    if not include_folders:
        query = query.where(CadFileIndex.is_folder == False)
    if folder_path:
        norm_folder = folder_path.replace("\\", "/").rstrip("/")
    # Fetch all parts for the project first
    # We do filtering in Python to handle path normalization (UNC vs drive letters) robustly
    result = await db.execute(query)
    rows = result.scalars().all()
    
    # 1. If folder_path is provided -> show matches INSIDE that folder
    # 2. If NO search term -> show DIRECT CHILDREN only
    # 3. If search term is present -> show RECURSIVE matches inside that folder
    # 4. Always exclude the folder itself from its own results
    if folder_path:
        filtered = []
        # Normalize filter path: handle Windows separators and UNC vs Drive letter discrepancies
        norm_fp_filter = folder_path.replace("\\", "/").lower().rstrip("/")
        prefix = norm_fp_filter + "/"
        
        for r in rows:
            fp_norm = (r.file_path or "").replace("\\", "/").lower().rstrip("/")
            
            # Exclude the exact folder itself
            if fp_norm == norm_fp_filter:
                continue
                
            # Check if it's inside the folder
            if fp_norm.startswith(prefix):
                if search:
                    # Recursive search
                    filtered.append(r)
                else:
                    # Direct children only: no more slashes after the prefix
                    remainder = fp_norm[len(prefix):]
                    if remainder and "/" not in remainder:
                        filtered.append(r)
        rows = filtered
    
    cad_exts = {'.icd', '.dwg', '.dxf', '.sldprt', '.slddrw', '.sldasm', '.step', '.stp', '.iges', '.igs'}
    
    if cad_only:
        rows = [r for r in rows if r.file_type in cad_exts]
        
    if search:
        search_query = search if case_sensitive else search.lower()
        matched_rows = []
        for r in rows:
            text = r.file_name if case_sensitive else r.file_name.lower()
            if search_query in text or _word_match(text, search_query) or _fuzzy_match(text, search_query):
                matched_rows.append(r)
                
        def relevance_score(r):
            text = r.file_name if case_sensitive else r.file_name.lower()
            scores = []
            # 1. Folders always first
            scores.append(0 if r.is_folder else 1)
            # 2. Exact matches
            scores.append(0 if text == search_query else 1)
            # 3. Starts-with matches
            scores.append(0 if text.startswith(search_query) else 1)
            # 4. Position in string
            try:
                scores.append(text.index(search_query))
            except ValueError:
                scores.append(len(text))
            # 5. Fallback to name
            scores.append(text)
            return tuple(scores)
            
        rows = sorted(matched_rows, key=relevance_score)
    else:
        # Default browse view: 1. Folders first, 2. Alphabetical
        rows = sorted(rows, key=lambda x: (0 if x.is_folder else 1, x.file_name.lower()))
        
    total_count = len(rows)
    rows = rows[:500]

    return {
        "total": total_count,
        "showing": len(rows),
        "capped": total_count > 500,
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
    
    # --- CACHE LOGIC ---
    try:
        file_stat = os.stat(file_path)
        cache_key = hashlib.md5(f"{file_path}_{file_stat.st_mtime}".encode('utf-8')).hexdigest()
        cache_dir = os.path.join(os.path.dirname(__file__), '..', '.preview_cache')
        os.makedirs(cache_dir, exist_ok=True)
        cache_path = os.path.join(cache_dir, f"{cache_key}.png")
        
        if os.path.exists(cache_path):
            def _read_cache():
                with open(cache_path, 'rb') as f:
                    return f.read()
            cache_data = await asyncio.to_thread(_read_cache)
            return Response(content=cache_data, media_type="image/png")
    except Exception:
        cache_path = None
        
    def return_and_cache(content, media_type="image/png"):
        if cache_path and content and media_type == "image/png":
            try:
                def _write_cache():
                    with open(cache_path, 'wb') as f:
                        f.write(content)
                _write_cache()
            except Exception: pass
        return Response(content=content, media_type=media_type)

    # 1. Direct Media Serving: PDF (via iframe)
    if ext == '.pdf':
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File missing")
        def _read_file():
            with open(file_path, 'rb') as f:
                return f.read()
        file_data = await asyncio.to_thread(_read_file)
        return Response(content=file_data, media_type="application/pdf")

    # 2. Forensic Binary Extraction (Priority for CAD formats)
    if ext == '.dwg':
        try:
            dwg_data = await asyncio.to_thread(get_dwg_preview, file_path)
            if dwg_data:
                return return_and_cache(dwg_data)
        except Exception as e:
            print(f"DWG Forensic extraction failed for {file_path}: {e}")

    # 3. Universal Choice: Windows Shell Thumbnail (Forced for CAD/complex files)
    if ext in cad_extensions or ext in {'.rvt', '.ifc', '.3dm'}:
        try:
            def _get_thumb():
                img = get_shell_thumbnail(file_path, size=1024)
                if img:
                    buf = io.BytesIO()
                    img.save(buf, format="PNG")
                    return buf.getvalue()
                return None
            thumb_data = await asyncio.to_thread(_get_thumb)
            if thumb_data:
                return return_and_cache(thumb_data)
        except Exception as e:
            print(f"Shell thumbnail failed for {file_path}: {e}")

    # 4. Standard Images (Direct Serving)
    preview_extensions = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml'
    }
    if ext in preview_extensions:
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Image file missing")
        def _read_img():
            with open(file_path, 'rb') as f:
                return f.read()
        img_data = await asyncio.to_thread(_read_img)
        return Response(content=img_data, media_type=preview_extensions[ext])
            
    raise HTTPException(status_code=500, detail="Failed to generate preview")

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

    file_obj = open(filepath, "rb")
    return StreamingResponse(
        file_obj,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{urllib.parse.quote(record.file_name)}"}
    )

import shutil

@router.delete("/{file_id}")
async def delete_item(file_id: int, db: AsyncSession = Depends(get_db)):
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
