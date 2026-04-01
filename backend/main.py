import asyncio
import sys

# Windows Stability Fix: Force SelectorEventLoop for reliable MySQL networking
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi import Request, HTTPException
from routers import parts, characters, settings, auth, feature_flags, help_center
import asyncio
import time
import logging
import os
import sys
from core.github_sync import sync_service
from fastapi.staticfiles import StaticFiles

START_TIME = time.time()
IS_FROZEN = getattr(sys, 'frozen', False)

# --- Production Paths Logic ---
# Ensure logs and local files are relative to the EXE in production
if IS_FROZEN:
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

from db.database import engine, Base
try:
    from core.nas_indexer import indexer
except ImportError:
    indexer = None

# --- Production Logging Setup ---
LOG_DIR = os.path.join(BASE_DIR, "logs")
try:
    os.makedirs(LOG_DIR, exist_ok=True)
except Exception:
    # If we can't create /logs (e.g. read-only NAS folder), 
    # fall back to the current directory
    LOG_DIR = BASE_DIR

LOG_FILE = os.path.join(LOG_DIR, "production.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("kmti_backend")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(">>> KMTI Workstation Backend v3.4.0 Starting Up...")
    try:
        # Robust DB Initialization (Handle busy connections during restarts)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("  [SUCCESS] Database connection established.")
    except Exception as e:
        logger.error(f"  [ERROR] Database initialization failed: {e}")
        # We continue anyway so the GUI can at least show the error state
        
    if indexer:
        indexer.start()
    
    # Start the background polling task
    asyncio.create_task(sync_service.poll_github())

    yield  # Application runs here

    # --- Shutdown ---
    logger.info(">>> KMTI Workstation Backend Shutting Down...")
    if indexer:
        try:
            indexer.stop()
        except:
            pass


app = FastAPI(title="KMTI Workstation API", version="3.4.4", lifespan=lifespan)

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

# Static serving for Help Center screenshots (NAS)
FEEDBACK_DIR = r"\\KMTI-NAS\Shared\data\storage\feedback"
if os.path.exists(FEEDBACK_DIR):
    app.mount("/storage/feedback", StaticFiles(directory=FEEDBACK_DIR), name="feedback")
else:
    logger.warning(f"Feedback storage directory not found: {FEEDBACK_DIR}. Screenshot serving disabled.")

@app.get("/health")
def health_check():
    return {
        "status": "ok", 
        "version": "3.1.7", 
        "uptime_seconds": time.time() - START_TIME
    }

if __name__ == "__main__":
    import uvicorn
    # Use the GUI by default if running from source main.py
    try:
        from gui import KMTIServerGUI
        logger.info("Launching KMTI Server Control Panel...")
        gui = KMTIServerGUI(app)
        gui.mainloop()
    except Exception as e:
        logger.error(f"Failed to launch GUI: {e}. Falling back to console.")
        uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
