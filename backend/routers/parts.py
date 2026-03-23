"""
Enterprise CAD File Search router (findr clone).
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, distinct, delete
from models import CadFileIndex, Project
from database import get_db
import os
import re
import io
import asyncio
from pathlib import Path
import urllib.parse
from pydantic import BaseModel
from core.icd_parser import SimpleICDParser, PointCloudRenderer
try:
    from core.nas_indexer import indexer
except ImportError:
    indexer = None

class CreateProjectRequest(BaseModel):
    name: str
    root_path: str

class CreateFolderRequest(BaseModel):
    project_name: str
    base_path: str = ""

router = APIRouter()

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
    py_script = """
import tkinter as tk
from tkinter import filedialog
import sys
root = tk.Tk()
root.withdraw()
root.attributes('-topmost', True)
path = filedialog.askdirectory(parent=root, title="Select Project Folder for findr")
root.destroy()
if path:
    sys.stdout.write(path)
"""
    process = await asyncio.create_subprocess_exec(
        "python", "-c", py_script,
        stdout=asyncio.subprocess.PIPE
    )
    stdout, _ = await process.communicate()
    path = stdout.decode('utf-8').strip()
    return {"path": path}

@router.get("/projects")
async def get_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project))
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
        
    p = Project(name=req.name, root_path=req.root_path)
    db.add(p)
    try:
        await db.commit()
        await db.refresh(p)
    except Exception as e:
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
        
    rows = rows[:500]
    
    return [
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

@router.get("/preview/{file_id}")
async def get_preview(file_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CadFileIndex).where(CadFileIndex.id == file_id))
    record = result.scalar_one_or_none()
    
    if not record or not record.file_path.lower().endswith('.icd'):
        raise HTTPException(status_code=404, detail="Preview unavailable")
        
    parser = SimpleICDParser()
    
    def _generate_preview():
        if parser.parse_file(record.file_path):
            renderer = PointCloudRenderer(width=800, height=600)
            img = renderer.render(parser)
            if img:
                img_byte_arr = io.BytesIO()
                img.save(img_byte_arr, format='PNG')
                return img_byte_arr.getvalue()
        return None
        
    img_data = await asyncio.to_thread(_generate_preview)
    
    if img_data:
        return Response(content=img_data, media_type="image/png")
            
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
        # Delete the folder and all children
        await db.execute(delete(CadFileIndex).where(CadFileIndex.file_path.like(f"{record.file_path}%")))
    else:
        await db.delete(record)
        
    await db.commit()
    
    # Rescan project to fix counts asynchronously
    if indexer and getattr(record, 'project_id', None):
        asyncio.create_task(indexer.scan_project_async(record.project_id, ""))
        
    return {"success": True}
