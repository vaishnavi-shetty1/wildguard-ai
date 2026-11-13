import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import Float, String, DateTime, Integer, Boolean, UniqueConstraint
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

    species: Mapped[str] = mapped_column(String(64))          
    confidence: Mapped[float] = mapped_column(Float)          

    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    gps_fix: Mapped[bool] = mapped_column(default=False)       
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    device_id: Mapped[str] = mapped_column(String(64), default="unit-01")

    status: Mapped[str] = mapped_column(String(32), default="active")   
    alert_level: Mapped[str | None] = mapped_column(String(16), nullable=True)  

    sms_sent: Mapped[bool] = mapped_column(default=False)
    sms_error: Mapped[str | None] = mapped_column(String(256), nullable=True)

    image_b64: Mapped[str | None] = mapped_column(String, nullable=True)

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(64))
    email: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(256))
    role: Mapped[str] = mapped_column(String(32), default="operator")
    phone: Mapped[str] = mapped_column(String(32), default="")
    location_name: Mapped[str] = mapped_column(String(128), default="")
    sms_alerts_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

class SmsLog(Base):
    __tablename__ = "sms_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    recipient_phone: Mapped[str] = mapped_column(String(32), default="")
    recipient_name: Mapped[str] = mapped_column(String(64), default="")
    recipient_role: Mapped[str] = mapped_column(String(32), default="custom")
    message: Mapped[str] = mapped_column(String(512), default="")
    status: Mapped[str] = mapped_column(String(16), default="simulated")  
    trigger_type: Mapped[str] = mapped_column(String(32), default="manual_broadcast") 
    sighting_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    sector: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # Username that triggered the send; "system" for automatic detection alerts.
    # Non-admins only see the rows they sent themselves.
    sent_by: Mapped[str] = mapped_column(String(64), default="")

class SmsConfig(Base):
    __tablename__ = "sms_config"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(32), default="default", unique=True)
    auto_alert_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    alert_levels: Mapped[str] = mapped_column(String(256), default='["HIGH","CRITICAL"]')  
    selected_species: Mapped[str] = mapped_column(String(512), default='["elephant","tiger","leopard"]')  
    default_sender_name: Mapped[str] = mapped_column(String(64), default="WILDGUARD")
    twilio_configured: Mapped[bool] = mapped_column(Boolean, default=False)

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True)
    client_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    title: Mapped[str] = mapped_column(String(160), default="")
    message: Mapped[str] = mapped_column(String(512), default="")
    type: Mapped[str] = mapped_column(String(32), default="system")
    location: Mapped[str | None] = mapped_column(String(128), nullable=True)
    alert_level: Mapped[str | None] = mapped_column(String(16), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("user_id", "client_id", name="uq_notification_user_client"),
    )

class SystemLog(Base):
    __tablename__ = "system_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    user: Mapped[str] = mapped_column(String(64), default="system")
    ip: Mapped[str] = mapped_column(String(64), default="")
    action: Mapped[str] = mapped_column(String(64), default="")
    details: Mapped[str] = mapped_column(String(512), default="")
    is_suspicious: Mapped[bool] = mapped_column(Boolean, default=False)

async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if DATABASE_URL.startswith("sqlite"):
            await conn.run_sync(_add_sqlite_columns)

def _add_sqlite_columns(sync_conn) -> None:
    """Add columns to existing SQLite tables when a fresh create_all misses them."""
    import sqlalchemy as sa

    inspector = sa.inspect(sync_conn)
    det_columns = {col["name"] for col in inspector.get_columns("detections")}
    if "status" not in det_columns:
        sync_conn.execute(sa.text("ALTER TABLE detections ADD COLUMN status VARCHAR(32) DEFAULT 'active'"))
    if "alert_level" not in det_columns:
        sync_conn.execute(sa.text("ALTER TABLE detections ADD COLUMN alert_level VARCHAR(16)"))

    user_columns = {col["name"] for col in inspector.get_columns("users")}
    if "created_by" not in user_columns:
        sync_conn.execute(sa.text("ALTER TABLE users ADD COLUMN created_by INTEGER"))

    sms_columns = {col["name"] for col in inspector.get_columns("sms_logs")}
    if "sent_by" not in sms_columns:
        sync_conn.execute(sa.text("ALTER TABLE sms_logs ADD COLUMN sent_by VARCHAR(64) DEFAULT ''"))

async def get_db() -> AsyncSession: 
    async with SessionLocal() as session:
        yield session
