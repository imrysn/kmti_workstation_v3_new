"""
Enterprise CAD File Search router (findr clone).
"""
import asyncio
import io
import os
import hashlib
from fastapi import APIRouter, Depends, Query, Response, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from models.user import User, UserRole
from core.auth import get_current_user, require_role
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_, and_, asc, desc, func, select, distinct, delete, text

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

from services.part_service import PartService
from models.part_schemas import ProjectSchema, CadFileSchema

router = APIRouter()

@router.get("/suggest")
async def get_suggestions(
    q: str = Query(..., min_length=2), 
    parent_path: Optional[str] = None, 
    db: AsyncSession = Depends(get_db)
):
    db_results = None
    if parent_path:
        norm_parent = parent_path.replace('/', '\\')
        stmt = select(distinct(CadFileIndex.file_name)).where(and_(CadFileIndex.parent_path == norm_parent, CadFileIndex.file_name.ilike(f"{q}%"))).limit(10)
        res = await db.execute(stmt)
        db_results = res.scalars().all()
    
    return PartService.get_suggestions(q, parent_path, db_results)

# --- PROJECTS API ---

@router.get("/projects/browse")
async def browse_folder():
    # Deprecated: Spawning a GUI from the backend is unreliable on Windows/asyncio.
    # The frontend should use native Electron dialogs.
    raise HTTPException(status_code=400, detail="Backend folder browsing is disabled. Please use the native Electron folder picker.")

@router.get("/projects", response_model=List[ProjectSchema])
async def get_projects(category: str = None, db: AsyncSession = Depends(get_db)):
    projs = await PartService.get_projects(db, category)
    return [ProjectSchema(
        id=p.id, name=p.name, root_path=p.root_path, category=p.category, 
        total_files=p.total_files, cad_files=p.cad_files, is_scanning=p.is_scanning
    ) for p in projs]

@router.post("/projects", response_model=ProjectSchema)
async def add_project(req: CreateProjectRequest, db: AsyncSession = Depends(get_db), _user: User = Depends(require_role([UserRole.admin, UserRole.it]))):
    p = await PartService.add_project(db, req.name, req.root_path, req.category)
    return ProjectSchema(
        id=p.id, name=p.name, root_path=p.root_path, category=p.category,
        total_files=p.total_files, cad_files=p.cad_files, is_scanning=p.is_scanning
    )

@router.delete("/projects/{project_id}")
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db), _user: User = Depends(require_role([UserRole.admin, UserRole.it]))):
    success = await PartService.delete_project(db, project_id)
    if not success: raise HTTPException(status_code=404, detail="Project not found")
    return {"success": True}

@router.post("/projects/{project_id}/scan")
async def scan_project_endpoint(project_id: int, db: AsyncSession = Depends(get_db), _user: User = Depends(require_role([UserRole.admin, UserRole.it]))):
    success = await PartService.scan_project(db, project_id)
    if not success: raise HTTPException(status_code=404, detail="Project not found")
    return {"success": True}

@router.post("/projects/{project_id}/scan/stop")
async def stop_scan_endpoint(project_id: int, db: AsyncSession = Depends(get_db), _user: User = Depends(require_role([UserRole.admin, UserRole.it]))):
    success = await PartService.stop_scan(db, project_id)
    return {"success": success}

@router.delete("/projects/category/{category}")
async def delete_projects_by_category(category: str, db: AsyncSession = Depends(get_db), _user: User = Depends(require_role([UserRole.admin, UserRole.it]))):
    count = await PartService.delete_projects_by_category(db, category)
    return {"success": True, "count": count}

@router.get("/projects/{project_id}/scan-status")
async def scan_status_stream(project_id: int, db: AsyncSession = Depends(get_db)):
    """SSE stream for real-time scan progress."""
    from fastapi.responses import StreamingResponse as SSEStreamingResponse

    async def event_generator():
        try:
            while True:
                async with AsyncSessionLocal() as session:
                    proj = await session.get(Project, project_id)
                    if not proj:
                        yield f"data: {json.dumps({'isScanning': False, 'filesIndexed': 0, 'message': 'Project not found'})}\n\n"
                        break
                    
                    count_res = await session.execute(select(func.count(CadFileIndex.id)).where(CadFileIndex.project_id == project_id))
                    files_indexed = count_res.scalar_one() or 0
                    files_seen = indexer.progress.get(project_id, 0) if indexer else 0
                    is_scanning = bool(proj.is_scanning)
                    
                    payload = {
                        "isScanning": is_scanning,
                        "filesIndexed": files_indexed,
                        "filesSeen": files_seen,
                        "message": f"Checking {files_seen:,} files..." if files_seen <= files_indexed else f"Indexing new: {files_seen:,}..."
                    }
                    yield f"data: {json.dumps(payload)}\n\n"
                    if not is_scanning: break
                await asyncio.sleep(1)
        except asyncio.CancelledError: pass

    return SSEStreamingResponse(event_generator(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@router.get("/tree/{project_id}")
async def get_project_tree(project_id: int, parent_path: str = Query(None), db: AsyncSession = Depends(get_db)):
    nodes = await PartService.get_tree(db, project_id, parent_path)
    if nodes is None: raise HTTPException(status_code=404, detail="Project not found")
    return nodes

# --- PARTS/FILES API ---

@router.get("/categories")
async def get_categories(db: AsyncSession = Depends(get_db)):
    return await PartService.get_categories(db)

@router.get("/")
async def list_parts(
    project_id: int = None,
    search: str = None,
    cad_only: bool = False,
    include_folders: bool = False,
    folder_path: str = None,
    recursive: bool = True,
    limit: int = 1000,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    rows, total_count = await PartService.list_parts(
        db, project_id, search, cad_only, include_folders, folder_path, recursive, limit, offset
    )
    return {
        "total": total_count,
        "showing": len(rows),
        "capped": total_count > (offset + limit),
        "items": [
            {
                "id": r.id, "projectId": r.project_id, "isFolder": r.is_folder,
                "fileName": r.file_name, "fileType": r.file_type, "filePath": r.file_path,
                "size": r.size, "lastModified": r.last_modified, "partGeomName": r.part_geom_name,
                "boundX": r.bound_x, "boundY": r.bound_y, "boundZ": r.bound_z
            } for r in rows
        ]
    }

@router.get("/preview/{file_id}")
async def get_preview(file_id: int, full: bool = False, db: AsyncSession = Depends(get_db)):
    record = await db.get(CadFileIndex, file_id)
    if not record: raise HTTPException(status_code=404, detail="File not found")
    return await get_cached_preview(record.file_path, record.file_type.lower() if record.file_type else "", full=full)

@router.get("/download")
async def download_part(file_id: int, db: AsyncSession = Depends(get_db)):
    record = await db.get(CadFileIndex, file_id)
    if not record: raise HTTPException(status_code=404, detail="File index not found")
    filepath = Path(record.file_path)
    if not filepath.exists() or (not record.is_folder and not filepath.is_file()):
        raise HTTPException(status_code=404, detail="Physical file missing")
    if record.is_folder: raise HTTPException(status_code=400, detail="Cannot download a folder")

    async def file_gen():
        with open(filepath, "rb") as f:
            while True:
                chunk = f.read(65536)
                if not chunk: break
                yield chunk
    return StreamingResponse(file_gen(), media_type="application/octet-stream", headers={"Content-Disposition": f"attachment; filename*=UTF-8''{urllib.parse.quote(record.file_name)}"})

@router.delete("/{file_id}")
async def delete_item(file_id: int, db: AsyncSession = Depends(get_db), _user: User = Depends(require_role([UserRole.admin, UserRole.it]))):
    success = await PartService.delete_item(db, file_id)
    if not success: raise HTTPException(status_code=404, detail="Item not found")
    return {"success": True}

