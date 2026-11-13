"""backend/app/notifications.py

Outbound alert delivery.

Every SMS path in the app — automatic detection alerts, manual broadcasts from
the SMS center, and emergency SOS — funnels through `deliver_sms()` so the text
rendering, the TextBee call and the SMS history row all stay in one place.

When TEXTBEE_API_KEY is not set, `deliver_sms()` still records what would have
been sent (status `simulated`) so the SMS history keeps working and nothing
leaves the machine.
"""

import logging
from typing import Iterable, Optional

from .database import SmsLog
from .sms_sender import SmsResult, is_sms_configured, send_sms

logger = logging.getLogger(__name__)


def build_alert_message(
    species: str,
    confidence: float,
    latitude: Optional[float],
    longitude: Optional[float],
    gps_fix: bool,
    device_id: str,
) -> str:
    """Render the alert text sent to every recipient."""
    pct = round(confidence * 100, 1)
    location = (
        f"GPS: {latitude:.5f}, {longitude:.5f}"
        if gps_fix and latitude is not None and longitude is not None
        else "GPS: no fix"
    )
    return (
        f"🚨 WildGuard AI ALERT\n"
        f"Species : {species.upper()}\n"
        f"Confidence: {pct}%\n"
        f"{location}\n"
        f"Device  : {device_id}\n"
        f"Act immediately — keep a safe distance."
    )


async def deliver_sms(
    db,
    recipients: Iterable,
    message: str,
    trigger_type: str,
    sector: Optional[str] = None,
    sighting_id: Optional[str] = None,
    sent_by: Optional[str] = None,
    log_skipped: bool = False,
) -> tuple[bool, Optional[str], list[SmsLog]]:
    """
    Send `message` to every recipient that has a phone number, and write one
    `SmsLog` row per recipient.

    Returns `(delivered, error, logs)` where `delivered` is True only when
    TextBee accepted the batch. Recipients with no number on file get no log
    row and are left out of `logs`.

    `sent_by` is the username behind the send (or "system" for automatic
    alerts) and is what the history endpoint filters on for non-admins.
    """
    with_phone = [r for r in recipients if (getattr(r, "phone", "") or "").strip()]
    without_phone = [r for r in recipients if not (getattr(r, "phone", "") or "").strip()]
    if not with_phone and not (log_skipped and without_phone):
        return False, None, []

    if with_phone:
        result = await send_sms([r.phone for r in with_phone], message)

        if result.ok:
            status = "sent"
        elif is_sms_configured():
            status = "failed"
        else:
            status = "simulated"
    else:
        # Nothing to dial — only the skipped rows below will be written.
        result = SmsResult(ok=False, error=None)
        status = "no_phone"

    if status == "failed":
        logger.error("SMS broadcast to %d recipient(s) failed: %s", len(with_phone), result.error)
    elif status == "simulated":
        logger.info(
            "TextBee not configured — recording %d simulated SMS (trigger=%s)",
            len(with_phone),
            trigger_type,
        )

    logs = [
        SmsLog(
            recipient_phone=recipient.phone.strip(),
            recipient_name=recipient.username,
            recipient_role=recipient.role,
            message=message,
            status=status,
            trigger_type=trigger_type,
            sector=sector or recipient.location_name,
            sighting_id=sighting_id,
            sent_by=(sent_by or "system").strip(),
        )
        for recipient in with_phone
    ]

    if log_skipped:
        # Callers that must account for every account (SOS) still get a history
        # row for the ones with no number, so nobody silently disappears.
        logs += [
            SmsLog(
                recipient_phone="",
                recipient_name=recipient.username,
                recipient_role=recipient.role,
                message=message,
                status="no_phone",
                trigger_type=trigger_type,
                sector=sector or recipient.location_name,
                sighting_id=sighting_id,
                sent_by=(sent_by or "system").strip(),
            )
            for recipient in without_phone
        ]

    db.add_all(logs)
    await db.commit()

    return result.ok, result.error, logs
