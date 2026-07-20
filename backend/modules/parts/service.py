import os
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select as future_select
from sqlalchemy import or_, and_, asc, desc, func, select, distinct, delete, text
from fastapi import HTTPException
from models.part import CadFileIndex, Project
from core.path_utils import normalize_path, globalize_path
from core.cache import cache_get, cache_set, cache_delete
import logging

logger = logging.getLogger("kmti_backend.parts.service")

class PartsService:
    @staticmethod
    async def get_projects(db: AsyncSession, category: Optional[str] = None):
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

    @staticmethod
    async def add_project(db: AsyncSession, name: str, root_path: str, category: str):
        root = globalize_path(root_path)
        
        if not root.startswith("//") and not os.path.exists(root):
            raise ValueError("Invalid path. Must be UNC or accessible drive letter.")

        norm_new = normalize_path(root_path).lower()
        existing = await db.execute(select(Project))
        for proj in existing.scalars().all():
            if normalize_path(proj.root_path).lower() == norm_new:
                raise ValueError(f"A project already points to this folder: '{proj.name}'. Remove it first or choose a different folder.")

        p = Project(name=name, root_path=root, category=category)
        db.add(p)
        try:
            await db.commit()
            await db.refresh(p)
        except Exception:
            await db.rollback()
            raise ValueError("Project name already exists")
        
        return p

    @staticmethod
    async def delete_project(db: AsyncSession, project_id: int):
        proj = await db.execute(select(Project).where(Project.id == project_id))
        p = proj.scalar_one_or_none()
        if not p:
            raise ValueError("Project not found")

        await db.execute(delete(CadFileIndex).where(CadFileIndex.project_id == project_id))
        await db.execute(delete(Project).where(Project.id == project_id))
        await db.commit()
        
        await cache_delete("projects", f"category:{p.category}")
        await cache_delete("projects", "category:None")
        return p

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
        await cache_delete("projects", f"category:{category}")
        await cache_delete("projects", "category:None")
        return len(projs)

    @staticmethod
    async def get_project_tree(db: AsyncSession, project_id: int, parent_path: Optional[str] = None):
        cache_key = f"{project_id}:{parent_path or ''}"
        cached_val = await cache_get("tree", cache_key)
        if cached_val is not None:
            return cached_val

        proj = await db.get(Project, project_id)
        if not proj:
            raise ValueError("Project not found")

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

    @staticmethod
    async def get_categories(db: AsyncSession):
        cached_val = await cache_get("categories", "all")
        if cached_val is not None:
            return cached_val

        try:
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
                    
            res = sorted(list(set(categories)))
            await cache_set("categories", "all", res)
            return res
        except Exception as e:
            logger.error(f"Category discovery failed: {str(e)}")
            return []

    @staticmethod
    async def delete_item(db: AsyncSession, file_id: int):
        import shutil
        from pathlib import Path

        result = await db.execute(select(CadFileIndex).where(CadFileIndex.id == file_id))
        record = result.scalar_one_or_none()
        
        if not record:
            raise ValueError("Item not found")
            
        filepath = Path(record.file_path)
        
        # 1. Delete physical files if they exist
        if filepath.exists():
            try:
                if record.is_folder:
                    shutil.rmtree(filepath)
                else:
                    os.remove(filepath)
            except Exception as e:
                raise RuntimeError(f"Failed to delete physical file: {str(e)}")
                
        # 2. Delete database records
        if record.is_folder:
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
        
        return record
