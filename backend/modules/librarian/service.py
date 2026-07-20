import re
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

class LibrarianService:
    @staticmethod
    async def get_relevant_context(query: str, session: AsyncSession) -> str:
        """Retrieves metadata context from the database based on the user's query."""
        clean_query = re.sub(r'[^\w\s-]', '', query).strip()
        if not clean_query: return ""

        STOP_WORDS = {'how', 'many', 'files', 'we', 'have', 'on', 'in', 'show', 'of', 'me', 'list', 'the', 'is', 'folder', 'project', 'find', 'from', 'parts'}
        keywords = [w for w in clean_query.lower().split() if w not in STOP_WORDS and len(w) > 2]
        
        if not keywords: return "[GARBAGE]"

        # 1. Search projects with intelligence
        # Combine keywords to find projects that match the main identifiers
        proj_filters = [f"name LIKE '%{kw}%'" for kw in keywords if len(kw) > 3]
        proj_sql = "SELECT name, category, total_files FROM projects"
        if proj_filters:
            proj_sql += " WHERE " + " AND ".join(proj_filters)
        else:
            proj_sql += f" WHERE name LIKE '%{clean_query}%'"
        
        proj_query = text(proj_sql + " LIMIT 5")
        proj_res = await session.execute(proj_query)
        projects = proj_res.fetchall()

        # 2. Search files with strict keyword intersection
        BLACKLIST = "('.bak', '.tmp', '.exe', '.db', '.ini', '.lnk', '.log', '.old', '.temp', '.thumb')"
        
        # Base query for files
        file_base = "SELECT file_name, file_type, category, part_type, bound_x, bound_y, file_path FROM cad_file_index"
        where_clauses = [f"(file_name LIKE '%{kw}%' OR file_path LIKE '%{kw}%' OR category LIKE '%{kw}%')" for kw in keywords if len(kw) > 3]
        where_clauses.append(f"file_type NOT IN {BLACKLIST}")
        
        file_sql = f"{file_base} WHERE {' AND '.join(where_clauses)} LIMIT 30"
        
        try:
            file_res = await session.execute(text(file_sql))
            raw_files = file_res.fetchall()
        except:
            # Fallback to broader fuzzy if intersection is empty or fails
            file_query = text(f"SELECT file_name, file_type, category, part_type, bound_x, bound_y, file_path FROM cad_file_index WHERE (file_name LIKE :q OR file_path LIKE :q) AND file_type NOT IN {BLACKLIST} LIMIT 20")
            file_res = await session.execute(file_query, {"q": f"%{clean_query}%"})
            raw_files = file_res.fetchall()

        files = []
        scored_files = []
        for f in raw_files:
            score = 0
            f_lower = f.file_name.lower()
            path_lower = f.file_path.lower()
            for kw in keywords:
                if kw in f_lower: score += 10
                if kw in path_lower: score += 5
            if clean_query.lower() in f_lower: score += 20
            scored_files.append((score, f))
        
        scored_files.sort(key=lambda x: x[0], reverse=True)

        seen_names = set()
        for _, f in scored_files:
            dedup_key = f"{f.file_name}_{f.category}"
            if dedup_key in seen_names: continue
            seen_names.add(dedup_key)
            files.append(f)
            if len(files) >= 15: break

        context_parts = []
        if projects:
            context_parts.append("RELEVANT PROJECTS:")
            for p in projects: context_parts.append(f"- [PROJECT:{p.name}] (Category: {p.category}, Files: {p.total_files})")
        
        if files:
            context_parts.append("\nRELEVANT FILES & PARTS:")
            current_cat = None
            for f in files:
                cat_label = f.category if f.category else "Uncategorized"
                if cat_label != current_cat:
                    context_parts.append(f"\n📂 {cat_label}:")
                    current_cat = cat_label
                dims = f" [Dims: {f.bound_x}x{f.bound_y}mm]" if f.bound_x else ""
                context_parts.append(f"  • [PATH:{f.file_path.replace('\\\\', '/')}] ({f.file_name}){dims}")

        return "\n".join(context_parts) if context_parts else f"[NO_RECORDS: {', '.join(keywords)}]"

    @staticmethod
    async def get_learned_knowledge(query: str, session: AsyncSession) -> List[str]:
        clean_query = re.sub(r'[^\w\s]', '', query).strip()
        if not clean_query: return []
        try:
            kb_query = text("SELECT learned_fact FROM kmti_librarian_knowledge WHERE query_pattern LIKE :q OR learned_fact LIKE :q LIMIT 3")
            res = await session.execute(kb_query, {"q": f"%{clean_query}%"})
            return [r[0] for r in res.fetchall()]
        except: return []

    @staticmethod
    def format_fallback_response(context: str, query: str) -> str:
        if context == "[GARBAGE]":
            return "I couldn't find any technical records matching that description. My search index is optimized for engineering terms, part numbers, and project codes. Please try a more specific technical query."
        if context.startswith("[NO_RECORDS:"):
            keywords = context.replace("[NO_RECORDS: ", "").replace("]", "")
            return f"I cannot find any technical records for '{keywords}' in the database. Please verify the Project Name or ID, or try searching for a broader term like 'BOLTS' or 'AGCC'."
        return f"⚠️ **DAILY AI QUOTA EXHAUSTED (3/3)**\n\nNatural language synthesis disabled.\n\n**DATABASE SEARCH RESULTS:**\n{context}"
