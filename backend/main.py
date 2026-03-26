from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import parts, characters, settings, auth, feature_flags
import asyncio
from core.github_sync import sync_service

from db.database import engine, Base
try:
    from core.nas_indexer import indexer
except ImportError:
    indexer = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    if indexer:
        indexer.start()

    yield  # Application runs here

    # --- Shutdown ---
    if indexer:
        indexer.stop()


app = FastAPI(title="KMTI Workstation API", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174", "file://"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    # Start the background polling task
    asyncio.create_task(sync_service.poll_github())

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(feature_flags.router, prefix="/api/flags", tags=["Feature Flags"])
app.include_router(parts.router, prefix="/api/parts", tags=["Purchased Parts"])
app.include_router(characters.router, prefix="/api/chars", tags=["Character Search"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])

@app.get("/health")
def health_check():
    return {"status": "ok", "version": "3.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
