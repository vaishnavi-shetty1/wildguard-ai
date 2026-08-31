import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import Float, String, DateTime, Integer
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./wildguard.db")

engine = create_async_engine(DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Detection(Base):
    __tablename__ = "detections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # What was detected
    species: Mapped[str] = mapped_column(String(64))          # e.g. "elephant"
    confidence: Mapped[float] = mapped_column(Float)           # 0.0 – 1.0

    # Where and when
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    gps_fix: Mapped[bool] = mapped_column(default=False)       # did GPS have a valid fix?
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    # Device that sent the event (useful when you scale to multiple units)
    device_id: Mapped[str] = mapped_column(String(64), default="unit-01")

    # Alert status
    sms_sent: Mapped[bool] = mapped_column(default=False)
    sms_error: Mapped[str | None] = mapped_column(String(256), nullable=True)

    # Raw image thumbnail (optional — base64 JPEG from Pi camera)
    image_b64: Mapped[str | None] = mapped_column(String, nullable=True)


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:  # type: ignore[override]
    async with SessionLocal() as session:
        yield session
