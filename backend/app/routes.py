import os
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from .database import Detection, get_db
from .schemas import DetectionCreate, DetectionOut, DetectionAck
from .notifications import send_sms_alerts
from .websocket_manager import manager

logger = logging.getLogger(__name__)
router = APIRouter()


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
