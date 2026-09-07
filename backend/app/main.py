import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .database import init_db, SessionLocal, User
from .routes import router, auth_router, users_router, sms_router, alerts_router, logs_router
from .auth import hash_password

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)

DEMO_USERS = [
    {
        "username": "Administrator",
        "email": "admin@wildguard.ai",
        "password": "admin123",
        "role": "admin",
        "phone": "",
        "location_name": "WildGuard Control Center",
    },
    {
        "username": "Forest Operator",
        "email": "operator@wildguard.ai",
        "password": "operator123",
        "role": "operator",
        "phone": "",
        "location_name": "Forest Operations Zone",
    },
    {
        "username": "Land Owner",
        "email": "landowner@wildguard.ai",
        "password": "landowner123",
        "role": "landowner",
        "phone": "",
        "location_name": "Sector B3 - Green Valley Orchards",
    },
    {
        "username": "Village Head",
        "email": "villagehead@wildguard.ai",
        "password": "villagehead123",
        "role": "village_head",
        "phone": "",
        "location_name": "Sector A4 - Silverwood Hamlet",
    },
]


async def seed_demo_users():
    async with SessionLocal() as db:
        for demo in DEMO_USERS:
            result = await db.execute(select(User).where(User.email == demo["email"]))
            if result.scalar_one_or_none():
                continue
            user = User(
                username=demo["username"],
                email=demo["email"],
                hashed_password=hash_password(demo["password"]),
                role=demo["role"],
                phone=demo["phone"],
                location_name=demo["location_name"],
            )
            db.add(user)
        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    logging.getLogger(__name__).info("Database ready.")
    await seed_demo_users()
    logging.getLogger(__name__).info("Demo users seeded.")
    yield


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(sms_router, prefix="/api/v1")
app.include_router(alerts_router, prefix="/api/v1")
app.include_router(logs_router, prefix="/api/v1")


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "WildGuard AI Backend"}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}
