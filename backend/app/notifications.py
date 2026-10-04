"""backend/app/notifications.py

Outbound alert delivery — currently stubbed out.

The Twilio SMS transport was removed so the project carries no third-party
messaging dependency. Every alert path still runs and still records what it
*would* have sent, so detection ingestion, SMS history, and the dashboard
keep working unchanged; nothing leaves the machine.

`send_sms_alerts` keeps its original signature and return contract so the
caller in `routes.py` needs no change and re-enabling real delivery later
is a matter of restoring a sender here.

To restore SMS later: reinstall `twilio`, read credentials from
TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER /
ALERT_RECIPIENTS, and replace the body of `send_sms_alerts` with the real
send loop. `build_alert_message` is the payload it should use.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


def build_alert_message(
    species: str,
    confidence: float,
    latitude: Optional[float],
    longitude: Optional[float],
    gps_fix: bool,
    device_id: str,
    detection_id: int,
) -> str:
    """Render the alert text. Used for logs and for any future sender."""
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
    No-op stand-in for the removed SMS sender.

    Returns (sent=False, error=None) so detections are stored with
    `sms_sent = False` and no error state. The message is still rendered and
    logged so an alert path stays auditable.
    """
    message = build_alert_message(
        species, confidence, latitude, longitude, gps_fix, device_id, detection_id
    )
    logger.info(
        "SMS delivery is disabled (Twilio removed); alert not sent.\n%s", message
    )
    return False, None
