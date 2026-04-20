import os
import re
import json
import asyncio
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, desc
from pydantic import BaseModel
from groq import AsyncGroq
from datetime import date, datetime
from db.database import get_db
from models.part import CadFileIndex, Project
from models.librarian_usage import LibrarianUsage
from models.librarian_chat import LibrarianChatMessage, LibrarianSession
from models.librarian_knowledge import LibrarianLearnedFact

import logging
logger = logging.getLogger("kmti_backend.librarian")

router = APIRouter(tags=["Librarian"])

# --- Pydantic Models ---
class FeedbackRequest(BaseModel):
    message_id: int
    is_helpful: bool
    query: str
    response: str

class ChatMessage(BaseModel):
    role: str
    content: str

class QueryRequest(BaseModel):
    session_id: Optional[int] = None
    messages: List[ChatMessage]

class SessionCreate(BaseModel):
    title: Optional[str] = "New Chat"

class SessionResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime

# Initialize Groq client
client = AsyncGroq(api_key=os.environ.get("GROQ_API_KEY"))

SYSTEM_PROMPT = """
You are the KMTI Tech Assistant (formerly Technical Librarian), a high-level engineering assistant dedicated to helping staff navigate the 400,000+ technical records stored on the KMTI NAS.

PERSONALITY:
- Professional, efficient, and precise.
- You are here to serve as a bridge between the engineer and the complex project database.
- If a query is off-topic, politely pivot back to engineering or offer to help find project data.
- Identify yourself as the "KMTI Tech Assistant".

INTERACTIVE NAVIGATION (CRITICAL):
- ALWAYS enclose file paths in this exact tag format: `[PATH:path/to/file.dwg]`.
- ALWAYS enclose project names in this exact tag format: `[PROJECT:ProjectName]`.
- Example: "You can find the bolt drawings in [PATH:PROJECTS/AGCC/BOLTS.dwg] within the [PROJECT:AGCC Project]."
- DO NOT use standard Markdown links (e.g., [Label](url)). Use the bracket tags above so the system can generate navigation chips.

TECHNICAL GUIDELINES:
1. Provide technical, well-structured, and professional answers.
2. Use the "Context" provided to cite specific projects, file paths, and dimensions (mm).
3. For geometric queries, focus on 'bound_x/y/z' which are dimensions in millimeters.
4. COMPARATIVE REASONING: If multiple versions exist, explain your recommendation (e.g., 'X is the most current 2024 revision').
5. GROUNDEDNESS: Only answer based on the provided context. If data is missing, offer to search for broader project keywords instead of guessing.
6. HELPFUL REJECTION: If a query is truly non-technical, respond politely: "I cannot find any project or technical data matching your query in our records. I specialize in KMTI engineering data, CAD files, and project indices. Please provide a project name or part description to begin."
"""

# --- Internal Helpers ---

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
            context_parts.append(f"  • [PATH:{f.file_path.replace('\\', '/')}] ({f.file_name}){dims}")

    return "\n".join(context_parts) if context_parts else f"[NO_RECORDS: {', '.join(keywords)}]"

async def get_learned_knowledge(query: str, session: AsyncSession) -> List[str]:
    clean_query = re.sub(r'[^\w\s]', '', query).strip()
    if not clean_query: return []
    try:
        kb_query = text("SELECT learned_fact FROM kmti_librarian_knowledge WHERE query_pattern LIKE :q OR learned_fact LIKE :q LIMIT 3")
        res = await session.execute(kb_query, {"q": f"%{clean_query}%"})
        return [r[0] for r in res.fetchall()]
    except: return []

def format_fallback_response(context: str, query: str) -> str:
    if context == "[GARBAGE]":
        return "I couldn't find any technical records matching that description. My search index is optimized for engineering terms, part numbers, and project codes. Please try a more specific technical query."
    if context.startswith("[NO_RECORDS:"):
        keywords = context.replace("[NO_RECORDS: ", "").replace("]", "")
        return f"I cannot find any technical records for '{keywords}' in the database. Please verify the Project Name or ID, or try searching for a broader term like 'BOLTS' or 'AGCC'."
    return f"⚠️ **DAILY AI QUOTA EXHAUSTED (3/3)**\n\nNatural language synthesis disabled.\n\n**DATABASE SEARCH RESULTS:**\n{context}"

# --- Endpoints ---

@router.get("/sessions", response_model=List[SessionResponse])
async def list_sessions(request: Request, db: AsyncSession = Depends(get_db)):
    client_ip = request.client.host if request.client else "127.0.0.1"
    res = await db.execute(select(LibrarianSession).where(LibrarianSession.ip_address == client_ip).order_by(desc(LibrarianSession.updated_at)))
    return res.scalars().all()

@router.post("/sessions", response_model=SessionResponse)
async def create_session(request: Request, data: SessionCreate, db: AsyncSession = Depends(get_db)):
    client_ip = request.client.host if request.client else "127.0.0.1"
    new_session = LibrarianSession(ip_address=client_ip, title=data.title)
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    return new_session

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    client_ip = request.client.host if request.client else "127.0.0.1"
    # Ensure IP matches for security
    session = await db.get(LibrarianSession, session_id)
    if not session or session.ip_address != client_ip:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()
    return {"success": True}

@router.post("/query")
async def query_librarian(request: QueryRequest, fast_request: Request, db: AsyncSession = Depends(get_db)):
    user_query = request.messages[-1].content
    client_ip = fast_request.client.host if fast_request.client else "127.0.0.1"
    today = date.today()
    
    # 1. Find or create session
    session_id = request.session_id
    if not session_id:
        # Check for most recent session
        res = await db.execute(select(LibrarianSession).where(LibrarianSession.ip_address == client_ip).order_by(desc(LibrarianSession.updated_at)).limit(1))
        sess = res.scalar_one_or_none()
        if not sess:
            sess = LibrarianSession(ip_address=client_ip, title=user_query[:50])
            db.add(sess)
            await db.commit()
            await db.refresh(sess)
        session_id = sess.id
    else:
        # Check session exists and auto-title if needed
        sess = await db.get(LibrarianSession, session_id)
        if sess and sess.title == "New Chat":
            sess.title = user_query[:50]
            await db.commit()

    # 2. Quota Check
    usage_res = await db.execute(select(LibrarianUsage).where(LibrarianUsage.ip_address == client_ip, LibrarianUsage.usage_date == today))
    usage = usage_res.scalar_one_or_none()
    context = await get_relevant_context(user_query, db)

    LIMIT = 3
    if usage and usage.question_count >= LIMIT:
        async def generate_fallback(): yield format_fallback_response(context, user_query)
        return StreamingResponse(generate_fallback(), media_type="text/plain")

    # 3. AI Stream
    async def generate_ai():
        full_response = []
        try:
            # Save User Message
            db.add(LibrarianChatMessage(session_id=session_id, ip_address=client_ip, role='user', content=user_query))
            if usage: usage.question_count += 1
            else: db.add(LibrarianUsage(ip_address=client_ip, usage_date=today, question_count=1))
            await db.commit()

            kb_shards = await get_learned_knowledge(user_query, db)
            history_res = await db.execute(select(LibrarianChatMessage).where(LibrarianChatMessage.session_id == session_id).order_by(desc(LibrarianChatMessage.created_at)).limit(10))
            history = reversed(history_res.scalars().all())
            
            messages = [{"role": "system", "content": SYSTEM_PROMPT}]
            if kb_shards: messages.append({"role": "system", "content": f"VERIFIED: {' '.join(kb_shards)}"})
            messages.append({"role": "system", "content": f"CONTEXT: {context}"})
            for h in history: messages.append({"role": h.role, "content": h.content})
            messages.append({"role": "user", "content": user_query})

            completion = await client.chat.completions.create(model="llama-3.3-70b-versatile", messages=messages, stream=True, temperature=0.2, max_tokens=1024)
            async for chunk in completion:
                if chunk.choices[0].delta.content:
                    text_chunk = chunk.choices[0].delta.content
                    full_response.append(text_chunk)
                    yield text_chunk
            
            db.add(LibrarianChatMessage(session_id=session_id, ip_address=client_ip, role='assistant', content="".join(full_response)))
            await db.commit()
        except Exception as e:
            logger.error(f"Stream Error: {e}", exc_info=True)
            yield f"Error: {str(e)}"

    return StreamingResponse(generate_ai(), media_type="text/plain")

@router.get("/history")
async def get_history(session_id: Optional[int], request: Request, db: AsyncSession = Depends(get_db)):
    client_ip = request.client.host if request.client else "127.0.0.1"
    if not session_id:
        # Find latest session
        res = await db.execute(select(LibrarianSession).where(LibrarianSession.ip_address == client_ip).order_by(desc(LibrarianSession.updated_at)).limit(1))
        sess = res.scalar_one_or_none()
        if not sess: return []
        session_id = sess.id

    res = await db.execute(select(LibrarianChatMessage).where(LibrarianChatMessage.session_id == session_id).order_by(LibrarianChatMessage.created_at.asc()))
    return res.scalars().all()

@router.post("/feedback")
async def process_feedback(req: FeedbackRequest, db: AsyncSession = Depends(get_db)):
    if not req.is_helpful: return {"status": "noted"}
    try:
        distill_prompt = f"Distill technical fact:\nUser: {req.query}\nAI: {req.response}"
        completion = await client.chat.completions.create(model="llama-3.1-8b-instant", messages=[{"role": "user", "content": distill_prompt}], max_tokens=256)
        fact = completion.choices[0].message.content.strip()
        db.add(LibrarianLearnedFact(query_pattern=req.query, learned_fact=fact, source_query=req.query))
        await db.commit()
    except: pass
    return {"status": "captured"}
