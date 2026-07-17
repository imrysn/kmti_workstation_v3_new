import asyncio
import sys

# Windows Stability Fix: Force SelectorEventLoop for reliable MySQL networking
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    # Silence annoying WinError 10054 tracebacks from proactor connection loss
    try:
        from asyncio.proactor_events import _ProactorBasePipeTransport
        
        # Save reference to avoid circular reference issues
        original_call_connection_lost = _ProactorBasePipeTransport._call_connection_lost

        def patched_call_connection_lost(self, exc):
            try:
                original_call_connection_lost(self, exc)
            except (ConnectionResetError, ConnectionAbortedError, OSError):
                pass

        _ProactorBasePipeTransport._call_connection_lost = patched_call_connection_lost
    except (ImportError, AttributeError):
        pass

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi import Request, HTTPException
from routers import parts, characters, settings, auth, feature_flags, help_center, telemetry, broadcast, librarian, designers, quotations, stopwatch, tts, fms, materials, activity_logs, custom_dictionaries, clients, project_incharges, machines, chat, moderation
from routers import team_calendar as team_calendar_router
import time
import logging
import os
from core.github_sync import sync_service
from fastapi.staticfiles import StaticFiles

START_TIME = time.time()
from core.config import IS_FROZEN, BASE_DIR, LOG_DIR

from db.database import engine, Base, fms_engine, AsyncSessionLocal
from sqlalchemy import text
from models import telemetry as telemetry_model, broadcast as broadcast_model, stopwatch as stopwatch_model, activity_log as activity_log_model, custom_dictionary as custom_dictionary_model, work_schedule as work_schedule_model, chat as chat_model, moderation as moderation_model, notification as notification_model # Ensure models are registered for metadata
import team_calendar.infrastructure.models # Ensure team calendar models are registered for metadata
try:
    from core.nas_indexer import indexer
except ImportError:
    indexer = None

# --- Production-Proof Logging Setup ---
# Use the stable LOG_DIR from config
LOG_FILE = os.path.join(LOG_DIR, "production.log")

logging_handlers = [logging.StreamHandler(sys.stdout)]
if not IS_FROZEN:
    logging_handlers.append(logging.FileHandler(LOG_FILE, encoding='utf-8'))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=logging_handlers
)
logger = logging.getLogger("kmti_backend")

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        logger.info(">>> KMTI Workstation Backend v3.7.8 Starting Up...")
        # Robust DB Initialization (Handle busy connections during restarts)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("  [SUCCESS] Database connection established.")

        # Safe dynamic column migration for status_message & content_text
        async with engine.connect() as conn:
            try:
                res = await conn.execute(text("SHOW COLUMNS FROM kmti_workstation_status LIKE 'status_message'"))
                if not res.fetchone():
                    logger.info("  [MIGRATION] Adding 'status_message' column to 'kmti_workstation_status'...")
                    await conn.execute(text("ALTER TABLE kmti_workstation_status ADD COLUMN status_message VARCHAR(200) DEFAULT NULL"))
                    await conn.commit()
                    logger.info("  [SUCCESS] 'status_message' column added successfully.")
            except Exception as migrate_err:
                logger.warning(f"  [MIGRATION WARNING] Failed to check/migrate status_message column: {migrate_err}")

            try:
                res = await conn.execute(text("SHOW COLUMNS FROM kmti_workstation_status LIKE 'telemetry_data'"))
                if not res.fetchone():
                    logger.info("  [MIGRATION] Adding 'telemetry_data' column to 'kmti_workstation_status'...")
                    await conn.execute(text("ALTER TABLE kmti_workstation_status ADD COLUMN telemetry_data LONGTEXT DEFAULT NULL"))
                    await conn.commit()
                    logger.info("  [SUCCESS] 'telemetry_data' column added successfully.")
            except Exception as migrate_err:
                logger.warning(f"  [MIGRATION WARNING] Failed to check/migrate telemetry_data column: {migrate_err}")

            try:
                res = await conn.execute(text("SHOW COLUMNS FROM kmti_chat_messages LIKE 'group_id'"))
                if not res.fetchone():
                    logger.info("  [MIGRATION] Adding 'group_id' column to 'kmti_chat_messages'...")
                    if conn.dialect.name == "sqlite":
                        await conn.execute(text("ALTER TABLE kmti_chat_messages ADD COLUMN group_id INTEGER DEFAULT NULL"))
                    else:
                        await conn.execute(text("ALTER TABLE kmti_chat_messages ADD COLUMN group_id INT DEFAULT NULL"))
                    await conn.commit()
                    logger.info("  [SUCCESS] 'group_id' column added successfully.")
            except Exception as migrate_err:
                logger.warning(f"  [MIGRATION WARNING] Failed to check/migrate group_id column: {migrate_err}")

            try:
                res = await conn.execute(text("SHOW COLUMNS FROM quotations LIKE 'is_deleted'"))
                if not res.fetchone():
                    logger.info("  [MIGRATION] Adding 'is_deleted' column to 'quotations'...")
                    await conn.execute(text("ALTER TABLE quotations ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0"))
                    await conn.commit()
                    logger.info("  [SUCCESS] 'is_deleted' column added successfully.")
            except Exception as migrate_err:
                logger.warning(f"  [MIGRATION WARNING] Failed to check/migrate is_deleted column: {migrate_err}")

            try:
                if conn.dialect.name == "sqlite":
                    res = await conn.execute(text("PRAGMA table_info(work_schedule_components)"))
                    cols = [row[1] for row in res.fetchall()]
                    has_col = "is_postponed" in cols
                else:
                    res = await conn.execute(text("SHOW COLUMNS FROM work_schedule_components LIKE 'is_postponed'"))
                    has_col = res.fetchone() is not None
                
                if not has_col:
                    logger.info("  [MIGRATION] Adding 'is_postponed' column to 'work_schedule_components'...")
                    if conn.dialect.name == "sqlite":
                        await conn.execute(text("ALTER TABLE work_schedule_components ADD COLUMN is_postponed INTEGER NOT NULL DEFAULT 0"))
                    else:
                        await conn.execute(text("ALTER TABLE work_schedule_components ADD COLUMN is_postponed TINYINT(1) NOT NULL DEFAULT 0"))
                    await conn.commit()
                    logger.info("  [SUCCESS] 'is_postponed' column added successfully.")
            except Exception as migrate_err:
                logger.warning(f"  [MIGRATION WARNING] Failed to check/migrate is_postponed column: {migrate_err}")

            try:
                # Use advisory locks to prevent concurrent worker processes deadlocking on DDL metadata locks
                lock_res = await conn.execute(text("SELECT GET_LOCK('kmti_migration_lock', 10)"))
                if lock_res.scalar() == 1:
                    try:
                        res = await conn.execute(text("SHOW COLUMNS FROM cad_file_index LIKE 'content_text'"))
                        if not res.fetchone():
                            logger.info("  [MIGRATION] Adding 'content_text' column to 'cad_file_index'...")
                            await conn.execute(text("ALTER TABLE cad_file_index ADD COLUMN content_text LONGTEXT DEFAULT NULL"))
                            await conn.commit()
                            logger.info("  [SUCCESS] 'content_text' column added successfully.")

                        # Modify quotations.data and quotation_history.data columns to LONGTEXT to prevent data truncation
                        if conn.dialect.name == "mysql":
                            logger.info("  [MIGRATION] Modifying quotations.data and quotation_history.data columns to LONGTEXT...")
                            await conn.execute(text("ALTER TABLE quotations MODIFY COLUMN data LONGTEXT NOT NULL"))
                            await conn.execute(text("ALTER TABLE quotation_history MODIFY COLUMN data LONGTEXT NOT NULL"))
                            await conn.commit()
                            logger.info("  [SUCCESS] Modified data columns to LONGTEXT successfully.")
                    finally:
                        await conn.execute(text("SELECT RELEASE_LOCK('kmti_migration_lock')"))
                        await conn.commit()
            except Exception as migrate_err:
                logger.warning(f"  [MIGRATION WARNING] Failed to run content_text or LONGTEXT migrations: {migrate_err}")

        # Setup FTS index on boot to match the columns list
        try:
            from core.nas_indexer import setup_fts
            async with AsyncSessionLocal() as session:
                await setup_fts(session)
            logger.info("  [SUCCESS] MySQL FULLTEXT index verified.")
        except Exception as fts_err:
            logger.warning(f"  [WARNING] Failed to verify FULLTEXT index: {fts_err}")
    except Exception as e:
        logger.error(f"  [ERROR] Database initialization failed: {e}")

    # Restore persisted achievement counters from DB
    from routers.telemetry import load_all_telemetry
    await load_all_telemetry()

    try:
        async with fms_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("  [SUCCESS] Secondary FMS database connection established.")
    except Exception as e:
        logger.warning(f"  [WARNING] Secondary FMS database connection failed: {e}. FMS integrations may be offline.")
        
    # Seed default clients and project incharges if tables are empty
    try:
        from models import Client, Designer, ProjectIncharge
        from sqlalchemy import select
        async with AsyncSessionLocal() as session:
            client_stmt = select(Client)
            client_res = await session.execute(client_stmt)
            if not client_res.scalars().first():
                logger.info("  [SEED] Seeding default clients...")
                default_clients = [
                    "JFE", "NIKKO", "AMANO", "TEX WAKAYAMA", "TEX HANSHIN", 
                    "OKINAKA", "MGK", "AGCC", "KEMCO"
                ]
                for name in default_clients:
                    session.add(Client(english_name=name, category="CLIENT"))
                await session.commit()
                logger.info("  [SUCCESS] Default clients seeded.")
            
            incharge_stmt = select(ProjectIncharge)
            incharge_res = await session.execute(incharge_stmt)
            if not incharge_res.scalars().first():
                logger.info("  [SEED] Seeding default project incharges...")
                default_incharges = [
                    "Erik", "JC", "Jenie", "Jethro", "Jonathan", "Joyce", 
                    "Kerby", "Lorie", "Matthew", "Mennjo", "Michael", "Nyl", 
                    "Shela", "Teody", "Zoren"
                ]
                for name in default_incharges:
                    session.add(ProjectIncharge(english_name=name, category="INCHARGE"))
                await session.commit()
                logger.info("  [SUCCESS] Default project incharges seeded.")

            designer_stmt = select(Designer)
            designer_res = await session.execute(designer_stmt)
            if not designer_res.scalars().first():
                logger.info("  [SEED] Seeding default designers...")
                default_designers = [
                    "Erik", "JC", "Jenie", "Jethro", "Jonathan", "Joyce", 
                    "Kerby", "Lorie", "Matthew", "Mennjo", "Michael", "Nyl", 
                    "Shela", "Teody", "Zoren"
                ]
                for name in default_designers:
                    session.add(Designer(english_name=name, category="DESIGNER"))
                await session.commit()
                logger.info("  [SUCCESS] Default designers seeded.")
    except Exception as seed_err:
        logger.warning(f"  [WARNING] Failed to seed default data: {seed_err}")

    if indexer:
        indexer.start()
    
    
    # Start the background polling task
    asyncio.create_task(sync_service.poll_github())

    # 4. Warm up TTS Engine (heavy ONNX load)
    from services.tts_engine import tts_engine
    asyncio.create_task(asyncio.to_thread(tts_engine.initialize_model))
    
    # 5. Background periodic telemetry cleanup (90 days retention)
    async def periodic_telemetry_cleanup():
        from sqlalchemy import text
        while True:
            try:
                async with AsyncSessionLocal() as session:
                    # 90 days retention for telemetry pings
                    await session.execute(text("DELETE FROM kmti_workstation_status WHERE last_ping < NOW() - INTERVAL 90 DAY"))
                    
                    # 30 days retention for chat messages
                    if session.bind.dialect.name == "sqlite":
                        await session.execute(text("DELETE FROM kmti_chat_messages WHERE datetime(created_at) < datetime('now', '-30 days')"))
                    else:
                        await session.execute(text("DELETE FROM kmti_chat_messages WHERE created_at < NOW() - INTERVAL 30 DAY"))
                        
                    await session.commit()
                logger.info("  [CLEANUP] Periodic telemetry and 30-day chat message sweep completed.")
            except Exception as e:
                logger.error(f"  [CLEANUP ERROR] Periodic sweep failed: {e}")
            await asyncio.sleep(86400) # Run every 24 hours

    asyncio.create_task(periodic_telemetry_cleanup())

    yield  # Application runs here

    # --- Shutdown ---
    logger.info(">>> KMTI Workstation Backend Shutting Down...")
    if indexer:
        try:
            indexer.stop()
        except:
            pass

app = FastAPI(title="KMTI Workstation v3.7.8", version="3.7.8", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Global Production Error Handlers ---
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.error(f"HTTP {exc.status_code} Error: {exc.detail} at {request.url}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": exc.detail},
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.critical(f"FATAL UNCAUGHT ERROR: {str(exc)} at {request.url}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal Server Error. Please contact IT."},
    )


app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(help_center.router, prefix="/api/help", tags=["Help Center"])
app.include_router(feature_flags.router, prefix="/api/flags", tags=["Feature Flags"])
app.include_router(parts.router, prefix="/api/parts", tags=["Purchased Parts"])
app.include_router(characters.router, prefix="/api/chars", tags=["Character Search"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])
app.include_router(telemetry.router, prefix="/api/telemetry", tags=["Telemetry"])
app.include_router(broadcast.router, prefix="/api/broadcast", tags=["Broadcast Messages"])
app.include_router(librarian.router, prefix="/api/librarian", tags=["Technical Librarian"])
app.include_router(designers.router, prefix="/api/designers", tags=["Designers"])
app.include_router(quotations.router, prefix="/api/quotations", tags=["Shared Quotations"])
app.include_router(stopwatch.router, prefix="/api/stopwatch", tags=["Stopwatch Records"])
app.include_router(tts.router, prefix="/api/tts", tags=["TTS"])
app.include_router(team_calendar_router.router, prefix="/api/team-calendar", tags=["Team Calendar"])
app.include_router(fms.router, prefix="/api/fms", tags=["FMS Integration"])
app.include_router(materials.router, prefix="/api/materials", tags=["Materials"])
app.include_router(activity_logs.router, prefix="/api/activity-logs", tags=["Activity Logs"])
app.include_router(custom_dictionaries.router, prefix="/api/custom-pages", tags=["Custom Dictionary Pages"])
app.include_router(clients.router, prefix="/api/clients", tags=["Clients"])
app.include_router(project_incharges.router, prefix="/api/project-incharges", tags=["Project Incharges"])
app.include_router(machines.router, prefix="/api/machines", tags=["Machine Names"])
from routers import work_schedule
app.include_router(work_schedule.router, prefix="/api/schedule", tags=["Work Schedule"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(moderation.router, prefix="/api/moderation", tags=["Content Moderation"])
from routers import notifications
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])


# Wrap with Socket.IO ASGI — this is the documented approach for FastAPI + python-socketio.
# IMPORTANT: socketio.ASGIApp intercepts WebSocket /socket.io/* requests BEFORE
# FastAPI's CORSMiddleware runs. We must therefore pass cors_allowed_origins here
# at the outer wrapper level, otherwise Electron (file:// origin) gets a 403.
import socketio as _sio_module
from socket_manager import sio as global_sio

combined_app = _sio_module.ASGIApp(
    global_sio, 
    app, 
    static_files={},
    socketio_path='socket.io'
)

# Static serving for Help Center screenshots (NAS)
FEEDBACK_DIR = r"\\KMTI-NAS\Shared\data\storage\feedback"
if os.path.exists(FEEDBACK_DIR):
    app.mount("/storage/feedback", StaticFiles(directory=FEEDBACK_DIR), name="feedback")
else:
    logger.warning(f"Feedback storage directory not found: {FEEDBACK_DIR}. Screenshot serving disabled.")

# Static serving for Chat Attachments
CHAT_DIR = r"\\KMTI-NAS\Shared\data\storage\chat"
if not os.path.exists(CHAT_DIR):
    CHAT_DIR = os.path.join(os.path.dirname(__file__), "storage", "chat")
    os.makedirs(CHAT_DIR, exist_ok=True)
app.mount("/storage/chat", StaticFiles(directory=CHAT_DIR), name="chat_attachments")

@app.get("/health")
def health_check():
    return {
        "status": "ok", 
        "version": "3.7.8", 
        "uptime_seconds": time.time() - START_TIME
    }   

if __name__ == "__main__":
    import uvicorn
    # Use the GUI by default if running from source main.py
    try:
        from gui import KMTIServerGUI
        logger.info("Launching KMTI Server Control Panel...")
        gui = KMTIServerGUI(combined_app)  # Pass combined Socket.IO + FastAPI app
        gui.mainloop()
    except Exception as e:
        logger.error(f"Failed to launch GUI: {e}. Falling back to console.")
        uvicorn.run(combined_app, host="0.0.0.0", port=8000)
