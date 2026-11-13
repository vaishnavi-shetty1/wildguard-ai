import asyncio
import hashlib
import os
import json
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, delete

from .database import (
    Detection, User, SmsLog, SmsConfig, SystemLog, Notification, PasswordResetToken, get_db,
)
from .schemas import (
    DetectionCreate, DetectionOut, DetectionUpdate, DetectionAck,
    UserCreate, UserLogin, UserUpdate, UserOut, Token,
    SmsSendRequest, SmsLogOut, SmsConfigOut, SmsConfigUpdate,
    SosRequest, SosOut, SystemLogOut,
    NotificationCreate, NotificationOut,
    PasswordResetRequest, PasswordResetConfirm, PasswordResetResponse,
    AIPredictRequest, AIPredictResponse, AIModelInfoOut,
)
from .notifications import build_alert_message, deliver_sms
from .sms_sender import gateway_status, is_sms_configured
from .emailer import send_password_reset_email, is_email_configured
from .websocket_manager import manager
from .auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_role, decode_token,
)

logger = logging.getLogger(__name__)
router = APIRouter()
auth_router = APIRouter(prefix="/auth", tags=["Auth"])
users_router = APIRouter(prefix="/users", tags=["Users"])
sms_router = APIRouter(prefix="/sms", tags=["SMS"])
alerts_router = APIRouter(prefix="/alerts", tags=["Alerts"])
logs_router = APIRouter(prefix="/logs", tags=["System Logs"])
ai_router = APIRouter(prefix="/ai", tags=["AI Inference"])
notifications_router = APIRouter(prefix="/notifications", tags=["Notifications"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
RESET_TOKEN_EXPIRE_MINUTES = int(os.getenv("RESET_TOKEN_EXPIRE_MINUTES", "30"))


def _threat_level(species: str, confidence: float) -> str:
    """Same scale the dashboard uses so alert levels stay consistent."""
    if species in {"unknown", "no threat"}:
        return "LOW"
    if confidence >= 0.85:
        return "HIGH"
    if confidence >= 0.6:
        return "MEDIUM"
    return "LOW"


def _parse_json(value: Optional[str], default: list) -> list:
    if not value:
        return default
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return default


# ── Auth helper ────────────────────────────────────────────────────────────────

async def _verify_key(
    x_api_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Shared-secret auth for requests from devices (X-Api-Key) OR the dashboard
    (Bearer JWT). Set API_SECRET_KEY in .env — device clients send it as the
    X-Api-Key header; the React dashboard sends a normal dashboard JWT.
    """
    expected = os.getenv("API_SECRET_KEY", "change_me")
    if x_api_key and x_api_key == expected:
        return None

    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
        payload = decode_token(token)
        user_id = payload.get("sub") if payload else None
        if user_id is not None:
            try:
                user_id = int(user_id)
            except (TypeError, ValueError):
                user_id = None
        if user_id is not None:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user and user.is_active:
                return None

    raise HTTPException(status_code=401, detail="Invalid API key or authentication token")


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

    # Send SMS alerts to every enabled stakeholder with a number on file,
    # honouring the auto-alert settings saved in the SMS center.
    sms_ok, sms_err = False, None
    try:
        config = await _get_or_create_sms_config(db)
        alert_level = _threat_level(detection.species, detection.confidence)
        wanted_species = _parse_json(
            config.selected_species, ["elephant", "tiger", "leopard"]
        )
        wanted_levels = _parse_json(config.alert_levels, ["HIGH", "CRITICAL"])

        if not config.auto_alert_enabled:
            logger.info("Auto SMS alerts are off - detection #%d not broadcast", detection.id)
        elif detection.species not in wanted_species:
            logger.info("Species %s is not on the SMS alert list - skipped", detection.species)
        elif alert_level not in wanted_levels:
            logger.info("Alert level %s is below the SMS alert levels - skipped", alert_level)
        else:
            result = await db.execute(
                select(User).where(
                    User.is_active == True,  # noqa: E712
                    User.sms_alerts_enabled == True,  # noqa: E712
                )
            )
            sms_ok, sms_err, _logs = await deliver_sms(
                db,
                result.scalars().all(),
                build_alert_message(
                    detection.species,
                    detection.confidence,
                    detection.latitude,
                    detection.longitude,
                    detection.gps_fix,
                    detection.device_id,
                ),
                trigger_type="auto_detection",
                sector=detection.device_id,
                sighting_id=f"WG-{detection.id}",
                sent_by="system",
            )
    except Exception:
        await db.rollback()
        sms_err = "SMS delivery failed unexpectedly"
        logger.exception("SMS alert for detection #%d failed", detection.id)

    detection.sms_sent = sms_ok
    detection.sms_error = (sms_err or "")[:256] or None
    await db.commit()

    # Save a notification for every active user so alerts survive a logout
    try:
        created_at = detected_at
        if created_at.tzinfo is not None:
            created_at = created_at.astimezone(timezone.utc)

        result = await db.execute(select(User).where(User.is_active == True))  # noqa: E712
        recipients = result.scalars().all()
        db.add_all(
            [
                Notification(
                    user_id=recipient.id,
                    client_id=f"ws-{detection.id}",
                    title="Wildlife Detected",
                    message=(
                        f"{detection.species} identified by AI "
                        f"(confidence {round(detection.confidence * 100)}%)."
                    ),
                    type="threat",
                    location=detection.device_id,
                    alert_level=_threat_level(detection.species, detection.confidence),
                    created_at=created_at,
                )
                for recipient in recipients
            ]
        )
        await db.commit()
    except Exception:
        await db.rollback()
        logger.warning("Could not save detection notifications", exc_info=True)

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


# ── AI inference ───────────────────────────────────────────────────────────────

@ai_router.get(
    "/model",
    response_model=AIModelInfoOut,
    summary="Describe the loaded checkpoint",
    description=(
        "Returns the active checkpoint, its class list, and which of the "
        "target species (elephant/tiger/leopard) it cannot emit. Lets the "
        "dashboard warn when a checkpoint is missing a species instead of "
        "silently reporting no detections."
    ),
)
async def ai_model_info(
    _: None = Depends(_verify_key),
) -> AIModelInfoOut:
    from .ai.detector import get_model_info

    try:
        return AIModelInfoOut(**await asyncio.to_thread(get_model_info))
    except Exception as exc:
        logger.exception("Failed to read model info")
        raise HTTPException(status_code=500, detail=f"Failed to read model info: {exc}")


@ai_router.post(
    "/predict",
    response_model=AIPredictResponse,
    summary="Run YOLO inference on a single image",
    description=(
        "Accepts a base64 image and returns detected species, confidence, "
        "bounding boxes, and per-species counts using the bundled YOLO "
        "checkpoint (models/yolo11n.pt). Inference runs off the event loop."
    ),
)
async def ai_predict(
    payload: AIPredictRequest,
    _: None = Depends(_verify_key),
) -> AIPredictResponse:
    # Heavy ML imports are deferred so the API boots fast and only pulls in
    # ultralytics/cv2/numpy when inference is actually used.
    from .ai.detector import decode_image_b64, run_detection

    try:
        image_bgr = decode_image_b64(payload.image)
        result = await asyncio.to_thread(
            run_detection,
            image_bgr,
            conf=payload.confidence_threshold,
            iou=payload.iou_threshold,
            max_detections=payload.max_detections,
            draw=payload.draw_boxes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("AI inference failed")
        raise HTTPException(status_code=500, detail=f"AI inference failed: {exc}")

    return AIPredictResponse(**result)


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


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _as_utc(value: datetime) -> datetime:
    """SQLite hands back naive datetimes even for timezone-aware columns."""
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


@auth_router.post(
    "/forgot-password",
    response_model=PasswordResetResponse,
    summary="Email a password reset link",
)
async def forgot_password(
    payload: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
) -> PasswordResetResponse:
    """Always answers the same way so the endpoint can't be used to probe for accounts."""
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        return PasswordResetResponse(
            status="ok",
            message="If an account exists for that address, a reset link is on its way.",
        )

    # Earlier unused links stay valid until they expire. Deleting them here
    # meant asking for a second link silently killed the email already in the
    # inbox, so users saw "invalid or has expired" for a link that looked new.
    token = secrets.token_urlsafe(32)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=_hash_reset_token(token),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES),
        )
    )
    await db.commit()

    reset_url = f"{FRONTEND_URL}/reset-password?token={token}"
    logger.warning("DEBUG-RESET-LINK %s", reset_url)  # temporary diagnostic
    delivered = await send_password_reset_email(
        user.email, user.username, reset_url, RESET_TOKEN_EXPIRE_MINUTES
    )

    await _log_system_event(
        db,
        user.username,
        "Password Reset Requested",
        f"Reset link emailed to {user.email}" if delivered else f"Reset email not sent to {user.email} (email not configured)",
    )

    if delivered:
        return PasswordResetResponse(
            status="ok",
            message="If an account exists for that address, a reset link is on its way.",
        )

    message = "If an account exists for that address, a reset link is on its way."
    shown_url = None
    if not is_email_configured() and os.getenv("APP_ENV", "development") != "production":
        message = "Email delivery isn't configured yet, so here is your reset link."
        shown_url = reset_url
    return PasswordResetResponse(status="ok", message=message, reset_url=shown_url)


@auth_router.post(
    "/reset-password",
    response_model=PasswordResetResponse,
    summary="Set a new password with a reset link",
)
async def reset_password(
    payload: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db),
) -> PasswordResetResponse:
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == _hash_reset_token(payload.token.strip())
        )
    )
    reset = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if reset is not None and reset.used_at is not None:
        raise HTTPException(
            status_code=400,
            detail="This reset link has already been used. Request a new one.",
        )
    if reset is None or _as_utc(reset.expires_at) <= now:
        raise HTTPException(
            status_code=400,
            detail="This reset link is invalid or has expired. Request a new one.",
        )

    user = (
        await db.execute(select(User).where(User.id == reset.user_id))
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=400,
            detail="This reset link is invalid or has expired. Request a new one.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="This account is inactive. Please contact an administrator.",
        )

    user.hashed_password = hash_password(payload.password)
    reset.used_at = now
    await db.execute(
        delete(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.id != reset.id,
        )
    )
    await db.commit()

    await _log_system_event(db, user.username, "Password Reset", f"{user.email} set a new password")
    return PasswordResetResponse(
        status="ok",
        message="Password updated. You can sign in with your new password.",
    )


# ── User management routes (admin) ─────────────────────────────────────────────

@users_router.get("", response_model=list[UserOut], summary="List all users (admin/operator)")
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operator")),
) -> list[UserOut]:
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return [UserOut.model_validate(u) for u in result.scalars().all()]


@users_router.post("", response_model=UserOut, status_code=201, summary="Create a user (admin/operator)")
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operator")),
) -> UserOut:
    if payload.role == "admin" and current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only an administrator can create another administrator",
        )

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
        created_by=current_user.id,
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


@users_router.put("/{user_id}", response_model=UserOut, summary="Update a user (admin, or operator for users they created)")
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operator")),
) -> UserOut:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user.role != "admin":
        if user.created_by != current_user.id or user.role == "admin":
            raise HTTPException(
                status_code=403,
                detail="You can only manage the users you created",
            )
        if payload.role == "admin":
            raise HTTPException(
                status_code=403,
                detail="Only an administrator can grant administrator access",
            )

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


def _sms_config_out(config: SmsConfig) -> SmsConfigOut:
    """Config row plus the live provider state, which comes from the env."""
    return SmsConfigOut(
        auto_alert_enabled=config.auto_alert_enabled,
        alert_levels=_parse_json(config.alert_levels, ["HIGH", "CRITICAL"]),
        selected_species=_parse_json(config.selected_species, ["elephant", "tiger", "leopard", "unknown"]),
        default_sender_name=config.default_sender_name,
        sms_configured=is_sms_configured(),
        sms_provider="textbee",
    )


@sms_router.get("/status", summary="Check the TextBee gateway connection")
async def get_sms_status(
    current_user: User = Depends(get_current_user),
) -> dict:
    """Pings TextBee so the dashboard can tell a bad key from a missing one."""
    return await gateway_status()


@sms_router.get("/config", response_model=SmsConfigOut, summary="Get SMS configuration")
async def get_sms_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SmsConfigOut:
    config = await _get_or_create_sms_config(db)
    return _sms_config_out(config)


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
    for field in ("auto_alert_enabled", "default_sender_name"):
        if field in update_data:
            setattr(config, field, update_data[field])
    await db.commit()
    await db.refresh(config)
    return _sms_config_out(config)


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

    _sent, sms_error, created_logs = await deliver_sms(
        db,
        recipients,
        payload.message,
        trigger_type=payload.trigger_type,
        sector=payload.sector,
        sighting_id=payload.sighting_id,
        sent_by=current_user.username,
    )

    if not created_logs:
        raise HTTPException(
            status_code=400,
            detail="Selected recipients have no phone number on file",
        )

    # Record system activity
    details = f"{payload.trigger_type} SMS sent to {len(created_logs)} recipient(s)"
    if sms_error:
        details += f" — delivery error: {sms_error}"
    syslog = SystemLog(
        user=current_user.username,
        action="SMS Broadcast",
        details=details,
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
    # Admins audit every message; everyone else only sees what they sent.
    if current_user.role != "admin":
        stmt = stmt.where(SmsLog.sent_by == current_user.username)
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

    # An SOS reaches every active account — no SMS opt-in or role filtering.
    result = await db.execute(select(User).where(User.is_active == True))
    recipients = result.scalars().all()

    event_id = secrets.token_hex(8)

    for recipient in recipients:
        # In-app notification for every user, online or not.
        db.add(Notification(
            user_id=recipient.id,
            client_id=f"sos-{event_id}",
            title="Emergency SOS",
            message=message,
            type="emergency_sos",
            location=payload.location or recipient.location_name,
            alert_level="CRITICAL",
        ))

    # An SOS goes out over TextBee to every account that has a number on file.
    _sent, _sms_error, _logs = await deliver_sms(
        db,
        recipients,
        message,
        trigger_type="emergency_sos",
        sector=payload.location,
        sent_by=current_user.username,
        log_skipped=True,
    )

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
            "event_id": event_id,
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

@logs_router.get("", response_model=list[SystemLogOut], summary="List system activity logs (admin/operator)")
async def list_system_logs(
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operator")),
) -> list[SystemLogOut]:
    stmt = select(SystemLog).order_by(SystemLog.timestamp.desc()).limit(limit)
    result = await db.execute(stmt)
    return [SystemLogOut.model_validate(log) for log in result.scalars().all()]


# ── Saved notifications ────────────────────────────────────────────────────────

async def _get_owned_notification(db: AsyncSession, user_id: int, notification_id: int) -> Notification:
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    return record


@notifications_router.get("", response_model=list[NotificationOut], summary="List saved notifications for the current user")
async def list_notifications(
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[NotificationOut]:
    stmt = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return [NotificationOut.model_validate(item) for item in result.scalars().all()]


@notifications_router.post("", response_model=NotificationOut, status_code=201, summary="Save a notification for the current user")
async def create_notification(
    payload: NotificationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationOut:
    # Re-sending the same event (same client_id) is a no-op
    if payload.client_id:
        result = await db.execute(
            select(Notification).where(
                Notification.user_id == current_user.id,
                Notification.client_id == payload.client_id,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            return NotificationOut.model_validate(existing)

    record = Notification(
        user_id=current_user.id,
        client_id=payload.client_id,
        title=payload.title,
        message=payload.message,
        type=payload.type,
        location=payload.location,
        alert_level=payload.alert_level,
    )
    if payload.created_at is not None:
        created_at = payload.created_at
        if created_at.tzinfo is not None:
            created_at = created_at.astimezone(timezone.utc)
        record.created_at = created_at

    db.add(record)
    await db.commit()
    await db.refresh(record)
    return NotificationOut.model_validate(record)


@notifications_router.post("/read-all", status_code=204, summary="Mark every saved notification as read")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)  # noqa: E712
        .values(is_read=True)
    )
    await db.commit()


@notifications_router.patch("/{notification_id}/read", response_model=NotificationOut, summary="Mark one notification as read")
async def mark_notification_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationOut:
    record = await _get_owned_notification(db, current_user.id, notification_id)
    record.is_read = True
    await db.commit()
    await db.refresh(record)
    return NotificationOut.model_validate(record)


@notifications_router.delete("/{notification_id}", status_code=204, summary="Delete one notification")
async def delete_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    record = await _get_owned_notification(db, current_user.id, notification_id)
    await db.delete(record)
    await db.commit()


@notifications_router.delete("", status_code=204, summary="Clear all saved notifications")
async def clear_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    result = await db.execute(select(Notification).where(Notification.user_id == current_user.id))
    for record in result.scalars().all():
        await db.delete(record)
    await db.commit()


async def _log_system_event(db: AsyncSession, user: str, action: str, details: str, is_suspicious: bool = False) -> None:
    db.add(SystemLog(user=user, action=action, details=details, is_suspicious=is_suspicious))
    try:
        await db.commit()
    except Exception:
        await db.rollback()
