import logging
import os
from email.utils import parseaddr
from html import escape
import httpx

logger = logging.getLogger(__name__)

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"
DEFAULT_SENDER_NAME = "WildGuard AI"

def _sender() -> dict | None:
    """Parse EMAIL_FROM into the {"name", "email"} object Brevo expects."""
    raw = os.getenv("EMAIL_FROM", "").strip()
    if not raw:
        return None
    name, address = parseaddr(raw)
    address = address.strip()
    if "@" not in address:
        return None
    return {"name": name.strip() or DEFAULT_SENDER_NAME, "email": address}

def is_email_configured() -> bool:
    return bool(os.getenv("BREVO_API_KEY", "").strip() and _sender())

def _reset_email_body(username: str, reset_url: str, expires_minutes: int) -> tuple[str, str]:
    safe_name = escape(username or "there")
    safe_url = escape(reset_url, quote=True)
    text = (
        f"Hi {username or 'there'},\n\n"
        "We received a request to reset the password for your WildGuard AI account.\n"
        f"Open this link to choose a new password (valid for {expires_minutes} minutes):\n\n"
        f"{reset_url}\n\n"
        "If you didn't ask for this, you can ignore this email — your password stays the same.\n\n"
        "— WildGuard AI"
    )
    html = f"""\
<div style="background:#071a1d;padding:32px;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#0c2227;border:1px solid #1d3a3a;border-radius:18px;padding:28px">
    <p style="margin:0 0 18px;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#7fe6b4">WildGuard AI</p>
    <h1 style="margin:0 0 12px;font-size:22px;color:#f3f7f5">Reset your password</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:22px;color:#cce4dc">
      Hi {safe_name}, we received a request to reset the password for your WildGuard AI account.
      This link is valid for {expires_minutes} minutes.
    </p>
    <p style="margin:0 0 24px">
      <a href="{safe_url}" style="display:inline-block;background:#7fe6b4;color:#062b22;text-decoration:none;
         font-weight:600;font-size:14px;padding:12px 22px;border-radius:12px">Choose a new password</a>
    </p>
    <p style="margin:0;font-size:12px;line-height:19px;color:#8ba8a0">
      If the button doesn't work, paste this link into your browser:<br>
      <span style="color:#7fe6b4;word-break:break-all">{safe_url}</span>
    </p>
    <p style="margin:20px 0 0;font-size:12px;line-height:19px;color:#8ba8a0">
      Didn't request this? You can safely ignore this email — your password stays the same.
    </p>
  </div>
</div>"""
    return text, html


async def send_password_reset_email(
    to_email: str,
    username: str,
    reset_url: str,
    expires_minutes: int,
) -> bool:
    """Send the reset link. Returns True only if Brevo accepted it."""
    api_key = os.getenv("BREVO_API_KEY", "").strip()
    sender = _sender()

    if not api_key or not sender:
        logger.warning(
            "BREVO_API_KEY or EMAIL_FROM is not set — password reset email to %s was not sent. Link: %s",
            to_email,
            reset_url,
        )
        return False

    text, html = _reset_email_body(username, reset_url, expires_minutes)
    payload = {
        "sender": sender,
        "to": [{"email": to_email}],
        "subject": "Reset your WildGuard AI password",
        "textContent": text,
        "htmlContent": html,
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                BREVO_API_URL,
                json=payload,
                headers={
                    "api-key": api_key,
                    "accept": "application/json",
                    "content-type": "application/json",
                },
            )
    except httpx.HTTPError as exc:
        logger.error("Password reset email to %s failed: %s", to_email, exc)
        return False

    if response.status_code >= 300:
        logger.error(
            "Brevo rejected the password reset email to %s: %s %s",
            to_email,
            response.status_code,
            response.text[:300],
        )
        return False

    logger.info("Password reset email sent to %s", to_email)
    return True
