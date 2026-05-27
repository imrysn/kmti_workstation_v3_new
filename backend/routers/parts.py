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

from core.cache import cache_get, cache_set, cache_delete
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
    - Global: Scans both file names and folder names (for assembly context).
    - Scoped: Finds distinct terms in the current folder.
    """
    if parent_path:
        norm_parent = parent_path.replace('/', '\\')
        stmt = (
            select(distinct(CadFileIndex.file_name))
            .where(
                and_(
                    CadFileIndex.parent_path == norm_parent,
                    CadFileIndex.file_name.ilike(f"{q}%"),
                    CadFileIndex.is_folder == False
                )
            )
            .limit(10)
        )
        res = await db.execute(stmt)
        return res.scalars().all()
    else:
        # Query distinct file names starting with the prefix utilizing the database index
        stmt = (
            select(distinct(CadFileIndex.file_name))
            .where(
                and_(
                    CadFileIndex.file_name.like(f"{q}%"),
                    CadFileIndex.is_folder == False
                )
            )
            .limit(12)
        )
        res = await db.execute(stmt)
        return res.scalars().all()

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

# Engineering synonym mappings for search query expansion
SYNONYMS = {
    "bolt": ["screw", "fastener", "hexbolt"],
    "screw": ["bolt", "fastener", "setscrew"],
    "fastener": ["bolt", "screw", "rivet", "nut"],
    "washer": ["spacer", "ring", "shim"],
    "spacer": ["washer", "shim", "collar"],
    "bearing": ["bushing", "sleeve", "ballbearing"],
    "bracket": ["mount", "support", "holder", "brace"],
    "plate": ["sheet", "flange", "flatbar"],
    "motor": ["engine", "actuator", "drive"],
    "pin": ["dowel", "cotter", "shaft"],
    "shaft": ["rod", "pin", "spindle"],
    "coupling": ["joint", "connector", "adapter"],
}

# Vocabulary cache for spell check / typo auto-correction
_vocab_cache = set()
_vocab_last_update = 0

async def get_vocab(db: AsyncSession) -> set:
    global _vocab_cache, _vocab_last_update
    import time
    if not _vocab_cache or time.time() - _vocab_last_update > 300:
        try:
            # Select distinct filenames to build word vocabulary
            stmt = select(distinct(CadFileIndex.file_name))
            res = await db.execute(stmt)
            names = res.scalars().all()
            new_vocab = set()
            for name in names:
                if name:
                    words = re.split(r'[^a-zA-Z0-9]', name)
                    for w in words:
                        if len(w) > 2 and not w.isdigit():
                            new_vocab.add(w.lower())
            _vocab_cache = new_vocab
            _vocab_last_update = time.time()
        except Exception as e:
            import logging
            logging.getLogger("kmti_backend").error(f"Error building vocab cache: {e}")
    return _vocab_cache

def suggest_correction(query: str, vocab: set) -> Optional[str]:
    words = re.split(r'([_\-\s\.]+)', query)
    corrected = []
    has_change = False
    
    for part in words:
        if not part or re.match(r'^[^a-zA-Z0-9]+$', part) or len(part) <= 2 or part.isdigit():
            corrected.append(part)
            continue
        
        part_lower = part.lower()
        if part_lower in vocab:
            corrected.append(part)
            continue
            
        best_word = part
        min_dist = 999
        candidates = [v for v in vocab if abs(len(v) - len(part)) <= 2]
        
        for cand in candidates:
            dist = _levenshtein_distance(part_lower, cand)
            if dist < min_dist and dist <= max(1, len(part) // 3):
                min_dist = dist
                best_word = cand
                
        if best_word.lower() != part_lower:
            if part.isupper():
                best_word = best_word.upper()
            elif part[0].isupper():
                best_word = best_word.capitalize()
            corrected.append(best_word)
            has_change = True
        else:
            corrected.append(part)
            
    return "".join(corrected) if has_change else None

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
    cache_key = f"category:{category}"
    cached_val = await cache_get("projects", cache_key)
    if cached_val is not None:
        return cached_val

    query = select(Project)
    if category:
        query = query.where(Project.category == category)
    result = await db.execute(query)
    projs = result.scalars().all()
    res = [{
        "id": p.id,
        "name": p.name,
        "rootPath": p.root_path,
        "totalFiles": p.total_files,
        "cadFiles": p.cad_files,
        "isScanning": p.is_scanning
    } for p in projs]
    await cache_set("projects", cache_key, res)
    return res

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
    await cache_delete("projects")
    await cache_delete("categories")
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
    await cache_delete("projects")
    await cache_delete("categories")
    await cache_delete("tree")
    await cache_delete("parts_list")
    await cache_delete("search")
    return {"success": True}

@router.post("/projects/{project_id}/scan")
async def scan_project_endpoint(project_id: int, db: AsyncSession = Depends(get_db), _user: User = Depends(require_role([UserRole.admin, UserRole.it]))):
    proj = await db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    proj.is_scanning = True
    await db.commit()
    await cache_delete("projects")
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
    await cache_delete("projects")
    await cache_delete("categories")
    await cache_delete("tree")
    await cache_delete("parts_list")
    await cache_delete("search")
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
    cache_key = f"{project_id}:{parent_path or ''}"
    cached_val = await cache_get("tree", cache_key)
    if cached_val is not None:
        return cached_val

    proj = await db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    root_path = proj.root_path.replace("\\", "/").rstrip("/")
    
    # 1. Base Case: No parent_path provided -> Return the Root Node only
    if not parent_path:
        res_nodes = [{
            "name": proj.name,
            "path": root_path,
            "depth": 0,
            "isFolder": True,
            "fileType": "",
            "hasChildren": True # Assume projects have content
        }]
        await cache_set("tree", cache_key, res_nodes)
        return res_nodes

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
        
    await cache_set("tree", cache_key, nodes)
    return nodes

# --- PARTS/FILES API ---

@router.get("/categories")
async def get_categories(db: AsyncSession = Depends(get_db)):
    """
    Dynamically lists the top-level folders in the 'Purchased Parts' root.
    This allows the UI to sync filters with the actual folder structure on the NAS.
    """
    cached_val = await cache_get("categories", "all")
    if cached_val is not None:
        return cached_val

    try:
        from sqlalchemy import select
        # Use findr's primary project for "Purchased Parts" (usually ID 1 or the one with category='PURCHASED')
        result = await db.execute(select(Project).where(or_(Project.id == 1, Project.category == 'PURCHASED_PARTS')))
        project = result.scalar_one_or_none()
        
        if not project:
            return []
            
        base_path = project.root_path
        if not os.path.exists(base_path):
            # Fallback for different environment paths
            from core.path_utils import globalize_path
            base_path = globalize_path(base_path)
            if not os.path.exists(base_path):
                return []
                
        # Discover all subfolders at the root level
        categories = []
        for entry in os.scandir(base_path):
            if entry.is_dir() and not entry.name.startswith('.'):
                categories.append(entry.name.upper())
                
        res = sorted(list(set(categories)))
        await cache_set("categories", "all", res)
        return res
    except Exception as e:
        import logging
        logging.getLogger("kmti_backend").error(f"Category discovery failed: {str(e)}")
        return []


def make_snippet(content: Optional[str], query: str) -> Optional[str]:
    if not content or not query:
        return None
    content_lower = content.lower()
    words = query.lower().split()
    first_word = words[0] if words else query.lower()
    idx = content_lower.find(first_word)
    if idx == -1:
        return None
        
    start = max(0, idx - 40)
    end = min(len(content), idx + 80)
    snippet = content[start:end]
    if start > 0:
        snippet = "..." + snippet
    if end < len(content):
        snippet = snippet + "..."
    return snippet

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
    is_searching = bool(search and search.strip())
    if is_searching:
        search_key = f"{search.strip()}:{project_id}:{cad_only}:{include_folders}:{folder_path or ''}:{recursive}:{limit}:{offset}"
        cached_val = await cache_get("search", search_key)
        if cached_val is not None:
            return cached_val
    else:
        cache_key = f"{project_id}:{cad_only}:{include_folders}:{folder_path or ''}:{recursive}:{limit}:{offset}"
        cached_val = await cache_get("parts_list", cache_key)
        if cached_val is not None:
            return cached_val

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
                # Add * for prefix match on each word, expanding with synonyms
                boolean_parts = []
                for w in words:
                    w_lower = w.lower()
                    if w_lower in SYNONYMS:
                        syns = SYNONYMS[w_lower]
                        terms = [f"{w}*"] + [f"{syn}*" for syn in syns]
                        boolean_parts.append(f"+({' '.join(terms)})")
                    else:
                        boolean_parts.append(f"+{w}*")
                boolean_search = " ".join(boolean_parts)
            else:
                boolean_search = ""

        if boolean_search:
            # OPTIMISTIC STAGE: Search using FULLTEXT index only (sub-10ms)
            query = query.where(text("MATCH(file_name, file_path, content_text) AGAINST(:val IN BOOLEAN MODE)"))
            
            # Ranking Algorithm:
            # 1. Exact Filename Match (DWG-101) -> 1000 pts
            # 2. Filename starts with search -> 500 pts
            # 3. Path contains search (Contextual Match) -> 300 pts
            # 4. Full-Text Relevance Score -> 10 pts
            query = query.order_by(
                text("""
                    (CASE WHEN file_name = :raw THEN 1000 ELSE 0 END) +
                    (CASE WHEN file_name LIKE :pfx THEN 500 ELSE 0 END) +
                    (CASE WHEN file_path LIKE :pfx_path THEN 300 ELSE 0 END) +
                    (MATCH(file_name, file_path, content_text) AGAINST(:val IN BOOLEAN MODE) * 10) DESC
                """),
                CadFileIndex.is_folder.desc(),
                CadFileIndex.file_name.asc()
            )
            query = query.params(
                val=boolean_search, 
                raw=search.strip(), 
                pfx=f"{search.strip()}%",
                pfx_path=f"%{search.strip()}%"
            )
        else:
            query = query.order_by(CadFileIndex.is_folder.desc(), CadFileIndex.file_name.asc())
    else:
        # Default Sorting
        query = query.order_by(CadFileIndex.is_folder.desc(), CadFileIndex.file_name.asc())

    # Count total matching results first
    count_query = query.with_only_columns(func.count(CadFileIndex.id)).order_by(None)
    total_count_res = await db.execute(count_query)
    total_count = total_count_res.scalar_one()

    # FALLBACK STAGE: If FTS query returns 0, try substring LIKE query (handles partial/middle-word substrings)
    if total_count == 0 and is_searching:
        fallback_query = select(CadFileIndex)
        if project_id is not None:
            fallback_query = fallback_query.where(CadFileIndex.project_id == project_id)
        if folder_path:
            norm_fp = normalize_path(folder_path)
            prefix = norm_fp + "/"
            effective_recursive = recursive
            if effective_recursive:
                fallback_query = fallback_query.where(CadFileIndex.file_path.ilike(f"{prefix}%"))
            else:
                fallback_query = fallback_query.where(CadFileIndex.parent_path == norm_fp)
        elif project_id:
            proj = await db.get(Project, project_id)
            if proj:
                root_norm = normalize_path(proj.root_path)
                effective_recursive = recursive
                if not effective_recursive:
                    fallback_query = fallback_query.where(CadFileIndex.parent_path == root_norm)

        if cad_only:
            fallback_query = fallback_query.where(CadFileIndex.file_type.in_(cad_exts))
        if not include_folders:
            fallback_query = fallback_query.where(CadFileIndex.is_folder == False)

        fallback_query = fallback_query.where(
            or_(
                CadFileIndex.file_name.like(f"%{search.strip()}%"),
                CadFileIndex.file_path.like(f"%{search.strip()}%")
            )
        )
        
        fallback_query = fallback_query.order_by(
            text("""
                (CASE WHEN file_name = :raw THEN 1000 ELSE 0 END) +
                (CASE WHEN file_name LIKE :pfx THEN 500 ELSE 0 END) +
                (CASE WHEN file_path LIKE :pfx_path THEN 300 ELSE 0 END) DESC
            """),
            CadFileIndex.is_folder.desc(),
            CadFileIndex.file_name.asc()
        ).params(
            raw=search.strip(), 
            pfx=f"{search.strip()}%",
            pfx_path=f"%{search.strip()}%"
        )

        fb_count_query = fallback_query.with_only_columns(func.count(CadFileIndex.id)).order_by(None)
        fb_count_res = await db.execute(fb_count_query)
        total_count = fb_count_res.scalar_one()

        if total_count > 0:
            query = fallback_query

    # Did You Mean Spell Check Fallback
    did_you_mean = None
    if total_count == 0 and is_searching:
        vocab = await get_vocab(db)
        corrected = suggest_correction(search, vocab)
        if corrected:
            did_you_mean = corrected
            corrected_clean = re.sub(r'[<()~*@]', ' ', corrected.strip())
            if '"' in corrected_clean:
                corrected_boolean = corrected_clean
            else:
                corrected_words = corrected_clean.split()
                corr_bool_parts = []
                for w in corrected_words:
                    w_lower = w.lower()
                    if w_lower in SYNONYMS:
                        syns = SYNONYMS[w_lower]
                        terms = [f"{w}*"] + [f"{syn}*" for syn in syns]
                        corr_bool_parts.append(f"+({' '.join(terms)})")
                    else:
                        corr_bool_parts.append(f"+{w}*")
                corrected_boolean = " ".join(corr_bool_parts)

            if corrected_boolean:
                corrected_query = select(CadFileIndex)
                if project_id is not None:
                    corrected_query = corrected_query.where(CadFileIndex.project_id == project_id)
                
                if folder_path:
                    norm_fp = normalize_path(folder_path)
                    prefix = norm_fp + "/"
                    effective_recursive = recursive
                    if effective_recursive:
                        corrected_query = corrected_query.where(CadFileIndex.file_path.ilike(f"{prefix}%"))
                    else:
                        corrected_query = corrected_query.where(CadFileIndex.parent_path == norm_fp)
                elif project_id:
                    proj = await db.get(Project, project_id)
                    if proj:
                        root_norm = normalize_path(proj.root_path)
                        effective_recursive = recursive
                        if not effective_recursive:
                            corrected_query = corrected_query.where(CadFileIndex.parent_path == root_norm)

                if cad_only:
                    corrected_query = corrected_query.where(CadFileIndex.file_type.in_(cad_exts))
                if not include_folders:
                    corrected_query = corrected_query.where(CadFileIndex.is_folder == False)

                corrected_query = corrected_query.where(
                    or_(
                        text("MATCH(file_name, file_path, content_text) AGAINST(:val IN BOOLEAN MODE)"),
                        CadFileIndex.file_name.like(f"%{corrected.strip()}%"),
                        CadFileIndex.file_path.like(f"%{corrected.strip()}%")
                    )
                )
                corrected_query = corrected_query.order_by(
                    text("""
                        (CASE WHEN file_name = :raw THEN 1000 ELSE 0 END) +
                        (CASE WHEN file_name LIKE :pfx THEN 500 ELSE 0 END) +
                        (CASE WHEN file_path LIKE :pfx_path THEN 300 ELSE 0 END) +
                        (MATCH(file_name, file_path, content_text) AGAINST(:val IN BOOLEAN MODE) * 10) DESC
                    """),
                    CadFileIndex.is_folder.desc(),
                    CadFileIndex.file_name.asc()
                )
                corrected_query = corrected_query.params(
                    val=corrected_boolean, 
                    raw=corrected.strip(), 
                    pfx=f"{corrected.strip()}%",
                    pfx_path=f"%{corrected.strip()}%"
                )

                corr_count_query = corrected_query.with_only_columns(func.count(CadFileIndex.id)).order_by(None)
                corr_count_res = await db.execute(corr_count_query)
                total_count = corr_count_res.scalar_one()

                corrected_query = corrected_query.limit(limit).offset(offset)
                corr_result = await db.execute(corrected_query)
                rows = corr_result.scalars().all()
            else:
                rows = []
        else:
            rows = []
    else:
        # Apply pagination and execute
        query = query.limit(limit).offset(offset)
        result = await db.execute(query)
        rows = result.scalars().all()
    
    # 7. Final Response
    res_dict = {
        "total": total_count,
        "showing": len(rows),
        "capped": total_count > (offset + limit),
        "didYouMean": did_you_mean,
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
                "boundZ": r.bound_z,
                "snippet": make_snippet(r.content_text, search or did_you_mean or "")
            }
            for r in rows
        ]
    }
    if is_searching and res_dict["items"]:
        try:
            from core.semantic_engine import semantic_engine
            res_dict["items"] = semantic_engine.re_rank(search or did_you_mean or "", res_dict["items"])
        except Exception as e:
            import logging
            logging.getLogger("kmti_backend").error(f"Re-ranking failed: {e}")

    if is_searching:
        await cache_set("search", search_key, res_dict)
    else:
        await cache_set("parts_list", cache_key, res_dict)
    return res_dict

@router.get("/preview/{file_id}")
async def get_preview(file_id: int, full: bool = False, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CadFileIndex).where(CadFileIndex.id == file_id))
    record = result.scalar_one_or_none()
    
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
        
    file_path = record.file_path
    ext = record.file_type.lower() if record.file_type else ""
    
    return await get_cached_preview(file_path, ext, full=full)

@router.get("/points/{file_id}")
async def get_points(file_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CadFileIndex).where(CadFileIndex.id == file_id))
    record = result.scalar_one_or_none()
    
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
        
    file_path = record.file_path
    ext = record.file_type.lower() if record.file_type else ""
    
    if ext != '.icd':
        raise HTTPException(status_code=400, detail="Only .icd files support interactive 3D point cloud data")
        
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File missing on disk")
        
    def _parse():
        from core.icd_parser import SimpleICDParser
        parser = SimpleICDParser()
        if not parser.parse_file(file_path) or not parser.points:
            return None
        
        # Filter zero coordinates
        points = [p for p in parser.points if abs(p.x) > 1e-4 or abs(p.y) > 1e-4 or abs(p.z) > 1e-4]
        if not points:
            points = parser.points
            
        # IQR Filtering based on distance from center
        import math
        xs = [p.x for p in points]
        ys = [p.y for p in points]
        zs = [p.z for p in points]
        cx = sum(xs) / len(points)
        cy = sum(ys) / len(points)
        cz = sum(zs) / len(points)

        distances = []
        for p in points:
            d = math.sqrt((p.x - cx)**2 + (p.y - cy)**2 + (p.z - cz)**2)
            distances.append((d, p))

        sorted_d = sorted([item[0] for item in distances])
        n = len(sorted_d)
        q1 = sorted_d[int(n * 0.25)]
        q3 = sorted_d[int(n * 0.75)]
        iqr = q3 - q1
        max_d_limit = q3 + 2.0 * iqr

        filtered = [item[1] for item in distances if item[0] <= max_d_limit]
                
        if not filtered:
            filtered = points
            
        # Recalculate bounds on filtered points
        min_x = min(p.x for p in filtered)
        max_x = max(p.x for p in filtered)
        min_y = min(p.y for p in filtered)
        max_y = max(p.y for p in filtered)
        min_z = min(p.z for p in filtered)
        max_z = max(p.z for p in filtered)
        
        bounds_size = {
            "x": max_x - min_x,
            "y": max_y - min_y,
            "z": max_z - min_z
        }
        
        return {
            "points": [{"x": p.x, "y": p.y, "z": p.z} for p in filtered],
            "bounds": bounds_size,
            "part_name": parser.part_name
        }

    data = await asyncio.to_thread(_parse)
    if not data:
        raise HTTPException(status_code=500, detail="Failed to parse point cloud data")
        
    return data

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
    await cache_delete("tree")
    await cache_delete("parts_list")
    await cache_delete("search")
    
    # Rescan project to fix counts asynchronously.
    # Fetch the project to get the actual root_path — passing "" caused silent scan failures.
    if indexer and getattr(record, 'project_id', None):
        proj = await db.get(Project, record.project_id)
        if proj:
            asyncio.create_task(indexer.scan_project_async(proj.id, proj.root_path))

    return {"success": True}
