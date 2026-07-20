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
from models.librarian_usage import LibrarianUsage
from models.librarian_chat import LibrarianChatMessage, LibrarianSession
from models.librarian_knowledge import LibrarianLearnedFact
from modules.librarian.schemas import (
    FeedbackRequest, ChatMessage, QueryRequest, SessionCreate, SessionResponse
)
from modules.librarian.service import LibrarianService

import logging
logger = logging.getLogger("kmti_backend.librarian")

router = APIRouter(tags=["Librarian"])

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
    context = await LibrarianService.get_relevant_context(user_query, db)

    LIMIT = 3
    if usage and usage.question_count >= LIMIT:
        async def generate_fallback(): yield LibrarianService.format_fallback_response(context, user_query)
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

            kb_shards = await LibrarianService.get_learned_knowledge(user_query, db)
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
            logger.error(f"Librarian Stream Error: {e}", exc_info=True)
            # PRO-ACTIVE FALLBACK: If AI fails, return the database results directly
            # so the user isn't stuck with a technical error.
            yield "⚠️ **AI ENGINE CONNECTION ERROR**\n\nI encountered a temporary problem connecting to my neural core. However, I have successfully queried the KMTI project database for you:\n\n"
            yield context

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
