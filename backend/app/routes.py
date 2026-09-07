import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from .database import Detection, User, SmsLog, SmsConfig, SystemLog, get_db
from .schemas import (
    DetectionCreate, DetectionOut, DetectionUpdate, DetectionAck,
    UserCreate, UserLogin, UserUpdate, UserOut, Token,
    SmsSendRequest, SmsLogOut, SmsConfigOut, SmsConfigUpdate,
    SosRequest, SosOut, SystemLogOut,
)
from .notifications import send_sms_alerts
from .websocket_manager import manager
from .auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_role,
)

logger = logging.getLogger(__name__)
router = APIRouter()
auth_router = APIRouter(prefix="/auth", tags=["Auth"])
users_router = APIRouter(prefix="/users", tags=["Users"])
sms_router = APIRouter(prefix="/sms", tags=["SMS"])
alerts_router = APIRouter(prefix="/alerts", tags=["Alerts"])
logs_router = APIRouter(prefix="/logs", tags=["System Logs"])


def _parse_json(value: Optional[str], default: list) -> list:
    if not value:
        return default
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return default


# ── Auth helper ────────────────────────────────────────────────────────────────

def _verify_key(x_api_key: str = Header(...)) -> None:
    """
    Simple shared-secret auth for requests from the Raspberry Pi.
    Set API_SECRET_KEY in .env — the Pi must send it as the X-Api-Key header.
    """
    expected = os.getenv("API_SECRET_KEY", "change_me")
    if x_api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid API key")


# ── Detection ingestion ────────────────────────────────────────────────────────

@router.post(
    "/detections",
    response_model=DetectionAck,
    status_code=201,
    summary="Receive a detection event from the Raspberry Pi",
)
async def create_detection(
    payload: DetectionCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_verify_key),
) -> DetectionAck:
    detected_at = payload.detected_at or datetime.now(timezone.utc)

    detection = Detection(
        species=payload.species,
        confidence=payload.confidence,
        latitude=payload.latitude,
        longitude=payload.longitude,
        gps_fix=payload.gps_fix,
        detected_at=detected_at,
        device_id=payload.device_id,
        image_b64=payload.image_b64,
    )
    db.add(detection)
    await db.commit()
    await db.refresh(detection)

    # Send SMS alerts (runs synchronously here; move to background task if needed)
    sms_ok, sms_err = send_sms_alerts(
        species=detection.species,
        confidence=detection.confidence,
        latitude=detection.latitude,
        longitude=detection.longitude,
        gps_fix=detection.gps_fix,
        device_id=detection.device_id,
        detection_id=detection.id,
    )
    detection.sms_sent = sms_ok
    detection.sms_error = sms_err
    await db.commit()

    # Broadcast to all connected dashboard WebSocket clients
    await manager.broadcast({
        "event": "new_detection",
        "data": {
            "id": detection.id,
            "species": detection.species,
            "confidence": detection.confidence,
            "latitude": detection.latitude,
            "longitude": detection.longitude,
            "gps_fix": detection.gps_fix,
            "detected_at": detected_at.isoformat(),
            "device_id": detection.device_id,
            "sms_sent": detection.sms_sent,
        },
    })

    logger.info(
        "Detection #%d — %s (%.1f%%) from %s | sms=%s",
        detection.id,
        detection.species,
        detection.confidence * 100,
        detection.device_id,
        sms_ok,
    )

    return DetectionAck(
        id=detection.id,
        message=f"Detection #{detection.id} stored.",
        sms_queued=sms_ok,
    )


# ── Query / dashboard API ──────────────────────────────────────────────────────

@router.get(
    "/detections",
    response_model=list[DetectionOut],
    summary="List detection logs with optional filters",
)
async def list_detections(
    db: AsyncSession = Depends(get_db),
    species: Optional[str] = Query(None, description="Filter by species"),
    device_id: Optional[str] = Query(None),
    from_dt: Optional[datetime] = Query(None, description="Start of time range (ISO-8601)"),
    to_dt: Optional[datetime] = Query(None, description="End of time range (ISO-8601)"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> list[DetectionOut]:
    stmt = select(Detection).order_by(Detection.detected_at.desc())

    if species:
        stmt = stmt.where(Detection.species == species.lower())
    if device_id:
        stmt = stmt.where(Detection.device_id == device_id)
    if from_dt:
        stmt = stmt.where(Detection.detected_at >= from_dt)
    if to_dt:
        stmt = stmt.where(Detection.detected_at <= to_dt)

    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get(
    "/detections/{detection_id}",
    response_model=DetectionOut,
    summary="Get a single detection by ID",
)
async def get_detection(
    detection_id: int,
    db: AsyncSession = Depends(get_db),
) -> DetectionOut:
    result = await db.execute(
        select(Detection).where(Detection.id == detection_id)
    )
    detection = result.scalar_one_or_none()
    if not detection:
        raise HTTPException(status_code=404, detail="Detection not found")
    return detection


@router.patch(
    "/detections/{detection_id}",
    response_model=DetectionOut,
    summary="Update a detection's status / alert level",
)
async def update_detection(
    detection_id: int,
    payload: DetectionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DetectionOut:
    result = await db.execute(select(Detection).where(Detection.id == detection_id))
    detection = result.scalar_one_or_none()
    if not detection:
        raise HTTPException(status_code=404, detail="Detection not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(detection, field, value)

    await db.commit()
    await db.refresh(detection)
    return detection


@router.get(
    "/stats",
    summary="Aggregate stats — species counts, total events, last detection",
)
async def get_stats(db: AsyncSession = Depends(get_db)) -> dict:
    total_result = await db.execute(select(func.count()).select_from(Detection))
    total = total_result.scalar_one()

    species_result = await db.execute(
        select(Detection.species, func.count().label("count"))
        .group_by(Detection.species)
        .order_by(func.count().desc())
    )
    species_counts = {row.species: row.count for row in species_result}

    last_result = await db.execute(
        select(Detection).order_by(Detection.detected_at.desc()).limit(1)
    )
    last = last_result.scalar_one_or_none()

    return {
        "total_detections": total,
        "by_species": species_counts,
        "last_detection": {
            "id": last.id,
            "species": last.species,
            "detected_at": last.detected_at.isoformat(),
        } if last else None,
        "live_dashboard_clients": manager.active_connections,
    }


# ── WebSocket live feed ────────────────────────────────────────────────────────

@router.websocket("/ws/live")
async def websocket_live(ws: WebSocket) -> None:
    """
    Connect a dashboard client to receive real-time detection events.

    The server pushes a JSON message for every new detection:
      { "event": "new_detection", "data": { ... } }

    Clients should handle disconnects and reconnect with back-off.
    """
    await manager.connect(ws)
    try:
        # Keep alive — client can optionally send ping messages
        while True:
            msg = await ws.receive_text()
            if msg == "ping":
                await ws.send_text('{"event":"pong"}')
    except WebSocketDisconnect:
        await manager.disconnect(ws)


# ── Auth routes ────────────────────────────────────────────────────────────────

@auth_router.post("/register", response_model=Token, status_code=201, summary="Register a new user")
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)) -> Token:
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        phone=payload.phone,
        location_name=payload.location_name,
        sms_alerts_enabled=payload.sms_alerts_enabled,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return Token(
        access_token=token,
        user=UserOut.model_validate(user),
    )


@auth_router.post("/login", response_model=Token, summary="Login with email and password")
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)) -> Token:
    result = await db.execute(select(User).where(User.email == payload.email.strip().lower()))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        if user:
            await _log_system_event(db, user.username, "Failed Login", "Invalid password", is_suspicious=True)
        else:
            await _log_system_event(db, payload.email, "Failed Login", "Unknown account", is_suspicious=True)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Your account is currently inactive. Please contact the administrator.")

    await _log_system_event(db, user.username, "User Login", f"{user.email} signed into the control panel")
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return Token(
        access_token=token,
        user=UserOut.model_validate(user),
    )


@auth_router.get("/me", response_model=UserOut, summary="Get current authenticated user")
async def get_me(current_user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(current_user)


# ── User management routes (admin) ─────────────────────────────────────────────

@users_router.get("", response_model=list[UserOut], summary="List all users (admin)")
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
) -> list[UserOut]:
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return [UserOut.model_validate(u) for u in result.scalars().all()]


@users_router.post("", response_model=UserOut, status_code=201, summary="Create a user (admin)")
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
) -> UserOut:
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        phone=payload.phone,
        location_name=payload.location_name,
        sms_alerts_enabled=payload.sms_alerts_enabled,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@users_router.get("/all", response_model=list[UserOut], summary="List all users (for SMS recipients)")
async def list_all_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[UserOut]:
    result = await db.execute(select(User).where(User.is_active == True).order_by(User.created_at.desc()))
    return [UserOut.model_validate(u) for u in result.scalars().all()]


@users_router.get("/{user_id}", response_model=UserOut, summary="Get a specific user")
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserOut:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut.model_validate(user)


@users_router.put("/{user_id}", response_model=UserOut, summary="Update a user (admin)")
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
) -> UserOut:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        user.hashed_password = hash_password(update_data.pop("password"))
    elif "password" in update_data:
        update_data.pop("password")

    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@users_router.delete("/{user_id}", status_code=204, summary="Delete a user (admin)")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
) -> None:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="The administrator account cannot be deleted")
    await db.delete(user)
    await db.commit()


# ── SMS routes ─────────────────────────────────────────────────────────────────

async def _get_or_create_sms_config(db: AsyncSession) -> SmsConfig:
    result = await db.execute(select(SmsConfig).where(SmsConfig.key == "default"))
    config = result.scalar_one_or_none()
    if not config:
        config = SmsConfig(key="default")
        db.add(config)
        await db.commit()
        await db.refresh(config)
    return config


@sms_router.get("/config", response_model=SmsConfigOut, summary="Get SMS configuration")
async def get_sms_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SmsConfigOut:
    config = await _get_or_create_sms_config(db)
    return SmsConfigOut(
        auto_alert_enabled=config.auto_alert_enabled,
        alert_levels=_parse_json(config.alert_levels, ["HIGH", "CRITICAL"]),
        selected_species=_parse_json(config.selected_species, ["elephant", "tiger", "leopard", "unknown"]),
        default_sender_name=config.default_sender_name,
        twilio_configured=config.twilio_configured or bool(os.getenv("TWILIO_ACCOUNT_SID")),
    )


@sms_router.put("/config", response_model=SmsConfigOut, summary="Update SMS configuration")
async def update_sms_config(
    payload: SmsConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SmsConfigOut:
    config = await _get_or_create_sms_config(db)
    update_data = payload.model_dump(exclude_unset=True)
    if "alert_levels" in update_data:
        config.alert_levels = json.dumps(update_data["alert_levels"])
    if "selected_species" in update_data:
        config.selected_species = json.dumps(update_data["selected_species"])
    for field in ("auto_alert_enabled", "default_sender_name", "twilio_configured"):
        if field in update_data:
            setattr(config, field, update_data[field])
    await db.commit()
    await db.refresh(config)
    return SmsConfigOut(
        auto_alert_enabled=config.auto_alert_enabled,
        alert_levels=_parse_json(config.alert_levels, ["HIGH", "CRITICAL"]),
        selected_species=_parse_json(config.selected_species, ["elephant", "tiger", "leopard", "unknown"]),
        default_sender_name=config.default_sender_name,
        twilio_configured=config.twilio_configured or bool(os.getenv("TWILIO_ACCOUNT_SID")),
    )


@sms_router.post("/send", response_model=list[SmsLogOut], status_code=201, summary="Send an SMS broadcast to recipients")
async def send_sms(
    payload: SmsSendRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SmsLogOut]:
    if not payload.recipient_ids:
        # Fall back to all active users with SMS enabled
        result = await db.execute(select(User).where(User.is_active == True, User.sms_alerts_enabled == True))
        recipients = result.scalars().all()
    else:
        result = await db.execute(select(User).where(User.id.in_(payload.recipient_ids)))
        recipients = result.scalars().all()

    if not recipients:
        raise HTTPException(status_code=400, detail="No recipients selected")

    config = await _get_or_create_sms_config(db)
    # Prefer env-based Twilio detection for actual sending
    twilio_active = bool(os.getenv("TWILIO_ACCOUNT_SID") and os.getenv("TWILIO_AUTH_TOKEN") and os.getenv("TWILIO_FROM_NUMBER"))

    created_logs = []
    for recipient in recipients:
        log = SmsLog(
            recipient_phone=recipient.phone,
            recipient_name=recipient.username,
            recipient_role=recipient.role,
            message=payload.message,
            status="sent" if twilio_active else "simulated",
            trigger_type=payload.trigger_type,
            sector=payload.sector or recipient.location_name,
            sighting_id=payload.sighting_id,
        )
        db.add(log)
        created_logs.append(log)

    await db.commit()
    for log in created_logs:
        await db.refresh(log)

    # Record system activity
    syslog = SystemLog(
        user=current_user.username,
        action="SMS Broadcast",
        details=f"{payload.trigger_type} SMS sent to {len(created_logs)} recipient(s)",
    )
    db.add(syslog)
    await db.commit()

    return [SmsLogOut.model_validate(log) for log in created_logs]


@sms_router.get("/logs", response_model=list[SmsLogOut], summary="List SMS history")
async def list_sms_logs(
    status_filter: Optional[str] = Query(None, alias="status"),
    trigger: Optional[str] = Query(None, alias="trigger_type"),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SmsLogOut]:
    stmt = select(SmsLog).order_by(SmsLog.timestamp.desc())
    if status_filter:
        stmt = stmt.where(SmsLog.status == status_filter)
    if trigger:
        stmt = stmt.where(SmsLog.trigger_type == trigger)
    stmt = stmt.limit(limit)
    result = await db.execute(stmt)
    return [SmsLogOut.model_validate(log) for log in result.scalars().all()]


# ── Emergency SOS routes ───────────────────────────────────────────────────────

@alerts_router.post("/sos", response_model=SosOut, summary="Trigger an emergency SOS broadcast")
async def send_sos(
    payload: SosRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SosOut:
    message = payload.message or (
        f"WILDGUARD EMERGENCY SOS: Immediate wildlife/security assistance required. "
        f"Alert generated by {current_user.username}."
    )

    # Broadcast to all active users (simulated)
    result = await db.execute(select(User).where(User.is_active == True, User.sms_alerts_enabled == True))
    recipients = result.scalars().all()

    for recipient in recipients:
        log = SmsLog(
            recipient_phone=recipient.phone,
            recipient_name=recipient.username,
            recipient_role=recipient.role,
            message=message,
            status="simulated",
            trigger_type="emergency_sos",
            sector=payload.location or recipient.location_name,
        )
        db.add(log)

    # Record system activity
    syslog = SystemLog(
        user=current_user.username,
        action="Emergency SOS",
        details=f"SOS broadcast to {len(recipients)} recipient(s){': ' + payload.location if payload.location else ''}",
    )
    db.add(syslog)
    await db.commit()

    # Broadcast over WebSocket so live dashboards see it
    await manager.broadcast({
        "event": "emergency_sos",
        "data": {
            "user": current_user.username,
            "location": payload.location,
            "message": message,
            "recipient_count": len(recipients),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    })

    return SosOut(
        acknowledged=True,
        message="Emergency SOS broadcast sent.",
        broadcast_count=len(recipients),
    )


# ── System activity logs ───────────────────────────────────────────────────────

@logs_router.get("", response_model=list[SystemLogOut], summary="List system activity logs (admin)")
async def list_system_logs(
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
) -> list[SystemLogOut]:
    stmt = select(SystemLog).order_by(SystemLog.timestamp.desc()).limit(limit)
    result = await db.execute(stmt)
    return [SystemLogOut.model_validate(log) for log in result.scalars().all()]


async def _log_system_event(db: AsyncSession, user: str, action: str, details: str, is_suspicious: bool = False) -> None:
    db.add(SystemLog(user=user, action=action, details=details, is_suspicious=is_suspicious))
    try:
        await db.commit()
    except Exception:
        await db.rollback()
