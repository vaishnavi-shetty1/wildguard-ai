"""
pi_client_example.py
────────────────────
Example snippet showing how the Raspberry Pi sends a detection event
to the WildGuard AI backend after YOLO confirms a species.

Drop this into your Pi's inference loop — call `send_detection()`
whenever confidence exceeds your threshold.
"""

import base64
import httpx
import os

BACKEND_URL = os.getenv("BACKEND_URL", "http://<your-server-ip>:8000")
API_KEY = os.getenv("API_SECRET_KEY", "change_me")

HEADERS = {
    "X-Api-Key": API_KEY,
    "Content-Type": "application/json",
}


def send_detection(
    species: str,
    confidence: float,
    latitude: float | None = None,
    longitude: float | None = None,
    gps_fix: bool = False,
    device_id: str = "unit-01",
    image_path: str | None = None,
) -> dict | None:
    """
    Post a single detection event to the backend.

    Returns the server's JSON response, or None on failure.
    """
    payload: dict = {
        "species": species,
        "confidence": round(confidence, 4),
        "gps_fix": gps_fix,
        "device_id": device_id,
    }

    if latitude is not None:
        payload["latitude"] = latitude
    if longitude is not None:
        payload["longitude"] = longitude

    # Optionally attach a thumbnail (resize to < 50 KB before sending)
    if image_path:
        with open(image_path, "rb") as f:
            payload["image_b64"] = base64.b64encode(f.read()).decode()

    try:
        response = httpx.post(
            f"{BACKEND_URL}/api/v1/detections",
            json=payload,
            headers=HEADERS,
            timeout=10.0,
        )
        response.raise_for_status()
        return response.json()
    except httpx.HTTPError as exc:
        print(f"[WildGuard] Failed to send detection: {exc}")
        return None


# ── Quick smoke-test (run on Pi or laptop to verify connectivity) ──────────────
if __name__ == "__main__":
    result = send_detection(
        species="elephant",
        confidence=0.91,
        latitude=12.9716,
        longitude=77.5946,
        gps_fix=True,
    )
    print("Server response:", result)
