import os
import logging
from typing import Optional
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

logger = logging.getLogger(__name__)


def _recipients() -> list[str]:
    raw = os.getenv("ALERT_RECIPIENTS", "")
    return [r.strip() for r in raw.split(",") if r.strip()]


def _build_message(
    species: str,
    confidence: float,
    latitude: Optional[float],
    longitude: Optional[float],
    gps_fix: bool,
    device_id: str,
    detection_id: int,
) -> str:
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
        f"Event ID: #{detection_id}\n"
        f"Act immediately — keep a safe distance."
    )


def send_sms_alerts(
    species: str,
    confidence: float,
    latitude: Optional[float],
    longitude: Optional[float],
    gps_fix: bool,
    device_id: str,
    detection_id: int,
) -> tuple[bool, Optional[str]]:
    """
    Send SMS alerts to all configured recipients.

    Returns (success: bool, error_message: str | None).
    """
    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
    from_number = os.getenv("TWILIO_FROM_NUMBER", "")
    recipients = _recipients()

    if not all([account_sid, auth_token, from_number]):
        logger.warning("Twilio credentials not configured — SMS skipped.")
        return False, "Twilio credentials not set"

    if not recipients:
        logger.warning("No ALERT_RECIPIENTS configured — SMS skipped.")
        return False, "No recipients configured"

    body = _build_message(
        species, confidence, latitude, longitude, gps_fix, device_id, detection_id
    )

    client = Client(account_sid, auth_token)
    errors: list[str] = []

    for number in recipients:
        try:
            msg = client.messages.create(body=body, from_=from_number, to=number)
            logger.info("SMS sent to %s — SID: %s", number, msg.sid)
        except TwilioRestException as exc:
            logger.error("SMS failed for %s: %s", number, exc)
            errors.append(f"{number}: {exc.msg}")

    if errors:
        return False, "; ".join(errors)
    return True, None
