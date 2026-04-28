import os
import asyncio
import json
import shutil
import re
from pathlib import Path
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_, and_, asc, desc, func, select, distinct, delete, text
from fastapi import HTTPException

from models.part import CadFileIndex, Project
from core.path_utils import normalize_path, globalize_path
from core.trie_engine import trie_service

try:
    from core.nas_indexer import indexer
except ImportError:
    indexer = None

class PartService:
    @staticmethod
    async def get_projects(db: AsyncSession, category: Optional[str] = None):
        query = select(Project)
        if category:
            query = query.where(Project.category == category)
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def add_project(db: AsyncSession, name: str, root_path: str, category: str = "PROJECTS"):
        root = globalize_path(root_path)
        if not root.startswith("//") and not os.path.exists(root):
            raise HTTPException(status_code=400, detail="Invalid path. Must be UNC or accessible drive letter.")

        norm_new = normalize_path(root_path).lower()
        existing = await db.execute(select(Project))
        for proj in existing.scalars().all():
            if normalize_path(proj.root_path).lower() == norm_new:
                raise HTTPException(
                    status_code=409,
                    detail=f"A project already points to this folder: '{proj.name}'."
                )

        p = Project(name=name, root_path=root, category=category)
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
        return p

    @staticmethod
    async def delete_project(db: AsyncSession, project_id: int):
        proj = await db.get(Project, project_id)
        if not proj:
            return False
        await db.delete(proj)
        await db.commit()
        return True

    @staticmethod
    async def delete_projects_by_category(db: AsyncSession, category: str):
        result = await db.execute(select(Project).where(Project.category == category))
        projs = result.scalars().all()
        if not projs:
            return 0
        for proj in projs:
            await db.execute(delete(CadFileIndex).where(CadFileIndex.project_id == proj.id))
            await db.delete(proj)
        await db.commit()
        return len(projs)

    @staticmethod
    async def scan_project(db: AsyncSession, project_id: int):
        proj = await db.get(Project, project_id)
        if not proj:
            return False
        proj.is_scanning = True
        await db.commit()
        if indexer:
            asyncio.create_task(indexer.scan_project_async(proj.id, proj.root_path))
        return True

    @staticmethod
    async def stop_scan(db: AsyncSession, project_id: int):
        proj = await db.get(Project, project_id)
        if not proj:
            return False
        if indexer:
            indexer.cancel_project_scan(project_id)
            proj.is_scanning = False
            await db.commit()
            return True
        return False

    @staticmethod
    async def get_categories(db: AsyncSession):
        result = await db.execute(select(Project).where(or_(Project.id == 1, Project.category == 'PURCHASED_PARTS')))
        project = result.scalar_one_or_none()
        if not project:
            return []
        base_path = project.root_path
        if not os.path.exists(base_path):
            base_path = globalize_path(base_path)
            if not os.path.exists(base_path):
                return []
        categories = []
        for entry in os.scandir(base_path):
            if entry.is_dir() and not entry.name.startswith('.'):
                categories.append(entry.name.upper())
        return sorted(list(set(categories)))

    @staticmethod
    async def list_parts(
        db: AsyncSession,
        project_id: Optional[int] = None,
        search: Optional[str] = None,
        cad_only: bool = False,
        include_folders: bool = False,
        folder_path: Optional[str] = None,
        recursive: bool = True,
        limit: int = 1000,
        offset: int = 0
    ):
        query = select(CadFileIndex)
        if project_id is not None:
            query = query.where(CadFileIndex.project_id == project_id)
        
        if folder_path:
            norm_fp = normalize_path(folder_path)
            prefix = norm_fp + "/"
            is_searching = bool(search and search.strip())
            effective_recursive = recursive if is_searching else False
            if effective_recursive:
                query = query.where(CadFileIndex.file_path.ilike(f"{prefix}%"))
            else:
                query = query.where(CadFileIndex.parent_path == norm_fp)
        elif project_id:
            proj = await db.get(Project, project_id)
            if proj:
                root_norm = normalize_path(proj.root_path)
                is_searching = bool(search and search.strip())
                effective_recursive = recursive if is_searching else False
                if not effective_recursive:
                    query = query.where(CadFileIndex.parent_path == root_norm)

        cad_exts = {'.icd', '.dwg', '.dxf', '.sldprt', '.slddrw', '.sldasm', '.step', '.stp', '.iges', '.igs'}
        if cad_only:
            query = query.where(CadFileIndex.file_type.in_(cad_exts))
        if not include_folders:
            query = query.where(CadFileIndex.is_folder == False)

        if search and search.strip():
            clean = re.sub(r'[<()~*@]', ' ', search.strip())
            if '"' in clean:
                boolean_search = clean
            else:
                words = clean.split()
                boolean_search = " ".join([f"+{w}*" for w in words]) if words else ""

            if boolean_search:
                query = query.where(text("MATCH(file_name, file_path) AGAINST(:val IN BOOLEAN MODE)"))
                query = query.order_by(
                    text("""
                        (CASE WHEN file_name = :raw THEN 1000 ELSE 0 END) +
                        (CASE WHEN file_name LIKE :pfx THEN 500 ELSE 0 END) +
                        (CASE WHEN file_path LIKE :pfx_path THEN 300 ELSE 0 END) +
                        (MATCH(file_name, file_path) AGAINST(:val IN BOOLEAN MODE) * 10) DESC
                    """),
                    CadFileIndex.is_folder.desc(),
                    CadFileIndex.file_name.asc()
                ).params(val=boolean_search, raw=search.strip(), pfx=f"{search.strip()}%", pfx_path=f"%{search.strip()}%")
        else:
            query = query.order_by(CadFileIndex.is_folder.desc(), CadFileIndex.file_name.asc())

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_count_res = await db.execute(count_query)
        total_count = total_count_res.scalar_one()

        query = query.limit(limit).offset(offset)
        result = await db.execute(query)
        rows = result.scalars().all()
        return rows, total_count

    @staticmethod
    async def get_tree(db: AsyncSession, project_id: int, parent_path: Optional[str] = None):
        proj = await db.get(Project, project_id)
        if not proj: return None
        root_path = proj.root_path.replace("\\", "/").rstrip("/")
        if not parent_path:
            return [{
                "name": proj.name, "path": root_path, "depth": 0, "isFolder": True, "fileType": "", "hasChildren": True
            }]
        norm_fp = normalize_path(parent_path)
        query = select(CadFileIndex).where(CadFileIndex.project_id == project_id, CadFileIndex.parent_path == norm_fp)
        result = await db.execute(query.order_by(CadFileIndex.is_folder.desc(), CadFileIndex.file_name.asc()))
        items = result.scalars().all()
        return [{
            "name": i.file_name, "path": i.file_path.replace("\\", "/").rstrip("/"), "isFolder": i.is_folder, "fileType": i.file_type or ""
        } for i in items]

    @staticmethod
    def get_suggestions(q: str, parent_path: Optional[str] = None, db_results: Optional[List[str]] = None):
        if parent_path and db_results is not None:
            return db_results
        return trie_service.search(q, limit=12)

    @staticmethod
    async def delete_item(db: AsyncSession, file_id: int):
        record = await db.get(CadFileIndex, file_id)
        if not record: return False
        filepath = Path(record.file_path)
        if filepath.exists():
            if record.is_folder: shutil.rmtree(filepath)
            else: os.remove(filepath)
        
        if record.is_folder:
            folder_prefix = record.file_path.rstrip('/\\') + '/'
            folder_prefix_back = record.file_path.rstrip('/\\') + '\\'
            await db.execute(delete(CadFileIndex).where(
                (CadFileIndex.project_id == record.project_id) &
                ((CadFileIndex.file_path == record.file_path) | (CadFileIndex.file_path.like(f"{folder_prefix}%")) | (CadFileIndex.file_path.like(f"{folder_prefix_back}%")))
            ))
        else:
            await db.delete(record)
        await db.commit()
        if indexer and getattr(record, 'project_id', None):
            proj = await db.get(Project, record.project_id)
            if proj: asyncio.create_task(indexer.scan_project_async(proj.id, proj.root_path))
        return True
