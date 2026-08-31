# WildGuard AI — Backend API

FastAPI backend for the WildGuard AI wildlife detection system.

## Features
- **POST /api/v1/detections** — receives detection events from the Raspberry Pi
- **GET /api/v1/detections** — query/filter the detection log
- **GET /api/v1/stats** — species counts and live dashboard stats
- **WebSocket /api/v1/ws/live** — push new detections to dashboard clients in real time
- **SMS alerts** via Twilio on every confirmed detection
- **SQLite** by default; swap to PostgreSQL by changing `DATABASE_URL`

---

## Setup

```bash
# 1. Clone / copy this folder onto your server
cd wildguard-backend

# 2. Create a virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
nano .env                         # Fill in API key, Twilio creds, recipient numbers
```

### `.env` fields

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLite (default) or PostgreSQL connection string |
| `API_SECRET_KEY` | Shared secret — set the same value on your Raspberry Pi |
| `TWILIO_ACCOUNT_SID` | From your Twilio console |
| `TWILIO_AUTH_TOKEN` | From your Twilio console |
| `TWILIO_FROM_NUMBER` | Your Twilio phone number (E.164 format, e.g. `+1xxxxxxxxxx`) |
| `ALERT_RECIPIENTS` | Comma-separated list of numbers to SMS (e.g. `+91xxxxxxxxxx,+91xxxxxxxxxx`) |

---

## Running

```bash
# Development (auto-reload on code changes)
uvicorn app.main:app --reload

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
```

Interactive API docs available at **http://localhost:8000/docs** once running.

---

## API Reference

### `POST /api/v1/detections`
Sent by the Raspberry Pi after each confirmed YOLO detection.

**Header:** `X-Api-Key: <your API_SECRET_KEY>`

```json
{
  "species": "elephant",
  "confidence": 0.94,
  "latitude": 12.9716,
  "longitude": 77.5946,
  "gps_fix": true,
  "device_id": "unit-01"
}
```

Response `201`:
```json
{ "id": 42, "message": "Detection #42 stored.", "sms_queued": true }
```

### `GET /api/v1/detections`
Query parameters: `species`, `device_id`, `from_dt`, `to_dt`, `limit`, `offset`

### `GET /api/v1/detections/{id}`
Single detection record.

### `GET /api/v1/stats`
Counts by species, total events, last detection, live WS clients.

### `WebSocket /api/v1/ws/live`
Connect from the dashboard. Receives:
```json
{ "event": "new_detection", "data": { "id": 42, "species": "elephant", ... } }
```
Send `"ping"` to keep alive; server replies `{"event":"pong"}`.

---

## Raspberry Pi Integration

See `pi_client_example.py` for a ready-to-use helper. Set these env vars on the Pi:

```bash
export BACKEND_URL="http://<server-ip>:8000"
export API_SECRET_KEY="<same key as server>"
```

Then call `send_detection(species, confidence, lat, lon, gps_fix)` from your YOLO inference loop.

---

## Deploying to the Cloud

The backend is stateless — just set env vars and run. Quick options:

| Platform | Command |
|---|---|
| **Railway** | `railway up` (auto-detects Python) |
| **Render** | Add as a Web Service, set env vars in dashboard |
| **Fly.io** | `fly launch` → `fly deploy` |
| **VPS (DigitalOcean/AWS EC2)** | Run with `uvicorn` behind `nginx` + `systemd` |

For production, switch `DATABASE_URL` to a managed PostgreSQL instance (e.g. Railway Postgres, Supabase, or AWS RDS).
