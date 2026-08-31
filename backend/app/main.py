import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routes import router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if they don't exist yet
    await init_db()
    logging.getLogger(__name__).info("Database ready.")
    yield
    # Shutdown: nothing to clean up for SQLite; add pool disposal here for Postgres


app = FastAPI(
    title="WildGuard AI — Backend API",
    description=(
        "Real-time wildlife detection alert system backend. "
        "Receives detection events from a Raspberry Pi, stores them, "
        "broadcasts to live dashboard clients via WebSocket, "
        "and sends SMS alerts via Twilio."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Allow the dashboard frontend (any origin in dev; restrict in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "WildGuard AI Backend"}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}
