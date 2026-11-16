"""backend/app/sms_sender.py

TextBee SMS transport.

TextBee (https://textbee.dev) turns an Android phone with a SIM into an SMS
gateway. Your code POSTs to /gateway/send-sms with the `x-api-key` header and
the phone sends the text through its own SIM.

Configuration (backend/.env):

    TEXTBEE_API_KEY=...              # from the TextBee dashboard (required)
    TEXTBEE_DEVICE_ID=...            # optional; omit to use the default device
    TEXTBEE_BASE_URL=...             # optional; defaults to the hosted API
    TEXTBEE_DEFAULT_COUNTRY_CODE=91  # optional; prefix for numbers saved
                                     # without a country code (e.g. 9876543210)

Nothing here raises: every failure is returned as an `SmsResult` so a detection
ingest never breaks because the gateway is down.
"""

import logging
import os
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

import httpx

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://api.textbee.dev/api/v1"
SEND_PATH = "/gateway/send-sms"
DEVICES_PATH = "/gateway/devices"
REQUEST_TIMEOUT = 20.0

# A phone reports a heartbeat every `heartbeatIntervalMinutes` (30 by default).
# Allow it to miss two in a row before calling it offline.
DEFAULT_HEARTBEAT_MINUTES = 30
HEARTBEAT_GRACE_INTERVALS = 2


@dataclass
class SmsResult:
    """Outcome of one TextBee send call."""

    ok: bool
    batch_id: Optional[str] = None
    error: Optional[str] = None


def _base_url() -> str:
    base = os.getenv("TEXTBEE_BASE_URL", "").strip() or DEFAULT_BASE_URL
    return base.rstrip("/")


def api_key() -> str:
    return os.getenv("TEXTBEE_API_KEY", "").strip()


def device_id() -> Optional[str]:
    return os.getenv("TEXTBEE_DEVICE_ID", "").strip() or None


def is_sms_configured() -> bool:
    """True when an API key is present, i.e. real delivery can be attempted."""
    return bool(api_key())


def _headers() -> dict:
    return {
        "x-api-key": api_key(),
        "content-type": "application/json",
        "accept": "application/json",
    }


def normalise_phone(raw: Optional[str], default_country_code: Optional[str] = None) -> Optional[str]:
    """
    Turn a stored phone number into the E.164 form TextBee expects
    (``+<country><number>``). Returns None when nothing usable is left.

    Users are free to type "+91 98765 43210", "0091 9876543210" or
    "9876543210"; the last form only works when a default country code is set.
    """
    cleaned = re.sub(r"[^\d+]", "", (raw or "").strip())
    if not cleaned:
        return None

    if cleaned.startswith("00"):
        cleaned = "+" + cleaned[2:]

    if cleaned.startswith("+"):
        digits = cleaned[1:]
        has_country_code = True
    else:
        digits = cleaned
        has_country_code = False

    if not digits.isdigit():
        return None

    if not has_country_code:
        cc = re.sub(r"[^\d]", "", default_country_code or "")
        # A local number carries no country code; a long digit string may
        # already include one, so only prefix the shorter forms.
        if cc and len(digits) <= 11 and not digits.startswith(cc):
            digits = cc + digits

    if not (7 <= len(digits) <= 15):
        return None
    return "+" + digits


def configure_numbers(numbers: Iterable[Optional[str]]) -> tuple[list[str], list[str]]:
    """Split recipients into (valid E.164 numbers, dropped raw values)."""
    cc = os.getenv("TEXTBEE_DEFAULT_COUNTRY_CODE", "").strip()
    valid: list[str] = []
    dropped: list[str] = []
    for raw in numbers:
        if not (raw or "").strip():
            continue
        normalised = normalise_phone(raw, cc)
        if normalised is None:
            dropped.append(str(raw))
        elif normalised not in valid:
            valid.append(normalised)
    return valid, dropped


def _parse_timestamp(value) -> Optional[datetime]:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _device_online(device: dict) -> bool:
    """
    True when the phone can actually receive a send.

    TextBee reports no `status` field, so recency of `lastHeartbeat` is the
    only signal. A revoked device key means the phone can never check in again
    until it is re-paired; `updatedAt` moves on every send and must NOT be
    mistaken for a heartbeat.
    """
    if not device.get("enabled", True) or device.get("apiKeyRevoked"):
        return False

    last = _parse_timestamp(device.get("lastHeartbeat"))
    if last is None:
        return False

    interval = device.get("heartbeatIntervalMinutes") or DEFAULT_HEARTBEAT_MINUTES
    grace = timedelta(minutes=max(interval, 1) * HEARTBEAT_GRACE_INTERVALS)
    return datetime.now(timezone.utc) - last <= grace


def _find_batch_id(payload) -> Optional[str]:
    """TextBee nests the id differently across versions; dig it out."""
    if isinstance(payload, dict):
        for key in ("smsBatchId", "batchId", "smsId", "id"):
            value = payload.get(key)
            if isinstance(value, (str, int)) and str(value).strip():
                return str(value)
        for value in payload.values():
            found = _find_batch_id(value)
            if found:
                return found
    elif isinstance(payload, list):
        for item in payload:
            found = _find_batch_id(item)
            if found:
                return found
    return None


def _error_detail(response: httpx.Response) -> str:
    # 401 means the key itself was refused, before any device is looked at, so
    # say what to do instead of repeating the bare "Unauthorized" body.
    if response.status_code == 401:
        return (
            "the API key was rejected (invalid or revoked) — generate a new key "
            "in the TextBee dashboard and update TEXTBEE_API_KEY"
        )
    try:
        body = response.json()
    except ValueError:
        body = None
    if isinstance(body, dict):
        for key in ("message", "error", "detail"):
            value = body.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return response.text[:200].strip() or "no detail"


async def send_sms(recipients: list[str], message: str) -> SmsResult:
    """
    Send one message to many recipients. TextBee fans the text out to every
    number in a single batch, so callers make one request per broadcast.
    """
    if not is_sms_configured():
        return SmsResult(
            ok=False,
            error="TextBee is not configured (TEXTBEE_API_KEY is missing)",
        )

    numbers, dropped = configure_numbers(recipients)
    if dropped:
        logger.warning("Skipping %d phone number(s) that are not valid: %s", len(dropped), dropped)
    if not numbers:
        return SmsResult(ok=False, error="No valid phone numbers to send to")

    payload = {"recipients": numbers, "message": message}
    if device_id():
        payload["deviceId"] = device_id()

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.post(
                f"{_base_url()}{SEND_PATH}",
                json=payload,
                headers=_headers(),
            )
    except httpx.HTTPError as exc:
        logger.error("TextBee send failed: %s", exc)
        return SmsResult(ok=False, error=f"TextBee request failed: {exc}")

    if response.status_code >= 300:
        detail = _error_detail(response)
        logger.error("TextBee rejected the send (%s): %s", response.status_code, detail)
        return SmsResult(ok=False, error=f"TextBee {response.status_code}: {detail}")

    try:
        body = response.json()
    except ValueError:
        body = None

    batch_id = _find_batch_id(body)
    logger.info("TextBee queued SMS to %d recipient(s) (batch %s)", len(numbers), batch_id)
    return SmsResult(ok=True, batch_id=batch_id)


async def fetch_devices() -> tuple[list[dict], Optional[str]]:
    """List the phones registered on the account — also used as a key check."""
    if not is_sms_configured():
        return [], "TextBee is not configured (TEXTBEE_API_KEY is missing)"

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.get(f"{_base_url()}{DEVICES_PATH}", headers=_headers())
    except httpx.HTTPError as exc:
        return [], f"TextBee request failed: {exc}"

    if response.status_code >= 300:
        return [], f"TextBee {response.status_code}: {_error_detail(response)}"

    try:
        body = response.json()
    except ValueError:
        return [], "TextBee returned a non-JSON response"

    if isinstance(body, dict):
        devices = body.get("data")
        if isinstance(devices, dict):
            devices = devices.get("devices") or devices.get("data")
        if not isinstance(devices, list):
            devices = body.get("devices") if isinstance(body.get("devices"), list) else []
    elif isinstance(body, list):
        devices = body
    else:
        devices = []

    return [d for d in devices if isinstance(d, dict)], None


async def gateway_status() -> dict:
    """Shape the connection state the dashboard shows on the SMS settings tab."""
    configured = is_sms_configured()
    status = {
        "provider": "textbee",
        "configured": configured,
        "device_id": device_id(),
        "devices": [],
        "error": None,
    }
    if not configured:
        status["error"] = "TEXTBEE_API_KEY is not set in backend/.env"
        return status

    devices, error = await fetch_devices()
    status["devices"] = [
        {
            "id": d.get("id") or d.get("_id"),
            "name": d.get("name") or d.get("brand") or "phone",
            "enabled": bool(d.get("enabled", True)),
            "online": _device_online(d),
            "api_key_revoked": bool(d.get("apiKeyRevoked")),
            "last_heartbeat": d.get("lastHeartbeat"),
        }
        for d in devices
    ]
    status["error"] = error or _device_problem(devices)
    return status


def _device_problem(devices: list[dict]) -> Optional[str]:
    """Explain why a send would sit queued instead of going out."""
    if not devices:
        return (
            "No phone is registered on this TextBee account — open the TextBee "
            "app on the gateway phone and register the device."
        )

    device = next((d for d in devices if _device_online(d)), devices[0])
    name = device.get("name") or device.get("brand") or "the gateway phone"

    if device.get("apiKeyRevoked"):
        return (
            f"{name} can no longer reach TextBee: the API key it registered with "
            "was revoked, so messages stay queued and are never sent. Reconnect "
            "the phone in the TextBee app with a new API key (keep the same "
            "device ID to retain its history)."
        )

    if not _device_online(device):
        last = device.get("lastHeartbeat")
        when = f" (last heartbeat {last})" if last else " (it has never checked in)"
        return (
            f"{name} is offline{when}, so messages wait at TextBee until it "
            "reconnects. Open the TextBee app on the phone and allow it to run "
            "in the background without battery optimization."
        )

    return None
