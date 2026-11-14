# WildGuard AI — Real-Time Wildlife Detection & Alert System

WildGuard AI is an end-to-end system for detecting dangerous wildlife (**elephant, tiger, leopard**) near villages, farmland and forest boundaries, and for getting that information to the people who need it — instantly, on a dashboard, in-app, and by SMS.

It has two halves:

- a **React 19 + Vite dashboard** (live camera view, AI overlay, detections, SMS center, user administration, role-based portals), and
- a **FastAPI + async SQLAlchemy backend** (event ingestion, JWT auth, YOLO inference, SQLite/PostgreSQL persistence, WebSocket push, notifications, SOS).

The long-term deployment target is an **NVIDIA Jetson Nano** running a TensorRT-accelerated three-class YOLO11n model at the edge, with USB camera input. That edge track is described in [Edge deployment roadmap](#edge-deployment-roadmap-jetson-nano).

---

## Table of contents

1. [What the system does](#what-the-system-does)
2. [Feature overview](#feature-overview)
3. [System architecture](#system-architecture)
4. [Technology stack](#technology-stack)
5. [Repository layout](#repository-layout)
6. [Prerequisites](#prerequisites)
7. [Quick start](#quick-start)
8. [Demo accounts](#demo-accounts)
9. [Configuration reference](#configuration-reference)
10. [Roles and permissions](#roles-and-permissions)
11. [Frontend deep dive](#frontend-deep-dive)
12. [Backend deep dive](#backend-deep-dive)
13. [Data model](#data-model)
14. [API reference](#api-reference)
15. [Real-time protocol (WebSocket)](#real-time-protocol-websocket)
16. [Detection and alerting pipeline](#detection-and-alerting-pipeline)
17. [AI inference](#ai-inference)
18. [Password reset flow](#password-reset-flow)
19. [Device / Raspberry Pi integration](#device--raspberry-pi-integration)
20. [Edge deployment roadmap (Jetson Nano)](#edge-deployment-roadmap-jetson-nano)
21. [Scripts and commands](#scripts-and-commands)
22. [Troubleshooting](#troubleshooting)
23. [Security notes](#security-notes)
24. [Known limitations and housekeeping](#known-limitations-and-housekeeping)

---

## What the system does

A camera watches a boundary. A detector recognises an animal. The event becomes:

1. **A stored detection** — species, confidence, GPS, device ID, timestamp, optional thumbnail.
2. **A dashboard alert** — pushed over WebSocket to every open dashboard, with a species-coloured overlay on the live video and an audible alert.
3. **A saved notification** — one row per active user, so nobody misses an alert because they were logged out.
4. **An SMS record** — logged in the SMS history with the rendered alert text and sent through TextBee to every opted-in account with a number (recorded as `simulated` when no API key is configured; see [Detection and alerting pipeline](#detection-and-alerting-pipeline)).
5. **A system log entry** — for audit and administration.

On top of that, any signed-in user can press **SOS** to broadcast a critical emergency alert to *every* active account, regardless of SMS preferences.

---

## Feature overview

### Authentication
- Email + password registration and login, bcrypt password hashing, JWT access tokens (HS256, 24 h default).
- Protected routes in the frontend, token attached to every API call.
- Forgot-password / reset-password flow with single-use, hashed, expiring reset tokens.
- No email is sent: `/auth/forgot-password` returns the single-use reset link, and the UI shows it as a button.

### Roles
Four roles — `admin`, `operator`, `landowner`, `village_head` — each with its own navigation and data scope.

### Live Monitor
- Browser webcam capture with an AI scanning toggle.
- Two inference providers: **local** (frame → backend YOLO endpoint) and **Roboflow** (hosted WebRTC workflow, optional).
- Species-coloured bounding boxes with class name and confidence labels.
- Real YOLO output only — no randomised demo predictions.

### Detection history
- Filterable detection log with species, confidence, threat level, location, camera and SMS status.
- `/stats` aggregation for the overview cards (total detections, per-species counts, last event, live client count).
- Overview screen with recent alerts and stakeholder-specific framing.

### SMS center
- Recipient list built from **real registered users** only (`GET /users/all`), refreshed on mount, on a 20 s poll, and when the tab regains focus. The signed-in user is never listed as a recipient.
- Users without a phone number are shown as "No phone number" and cannot be selected.
- Message composer with trigger type, sector, and per-recipient logs.
- Full SMS history with status and trigger filters. It is one table for every SMS path — manual broadcasts, automatic detection alerts and emergency SOS — re-read from `GET /sms/logs` on mount, every 20 s, on tab focus and after a send, so messages sent from another view still appear.
- A non-admin sees the rows they **sent** plus the rows **addressed to them** (marked `received`, with the sender when there is one); admins audit every row and see `by <username>` under each message.
- Status badges: `sent`, `failed`, `simulated` (no `TEXTBEE_API_KEY`), and `no_phone` (account had no number, so only the in-app notification reached it).
- SMS configuration endpoint (auto-alert toggle, alert levels, selected species, sender name).

### Emergency SOS
- One button, one POST, everyone notified: every active user gets an in-app notification, and every user with a phone number gets an SMS log entry. Accounts **without** a number still get an `SmsLog` row with status `no_phone`, so the history records that they were notified in-app but not texted.
- The SOS text is the sender's own message (or a default line naming them); the generated event ID rides along only on the in-app notification and WebSocket payload, never in the SMS body.
- Broadcast over WebSocket so all dashboards react immediately.
- Client-side dedupe via `client_id` so a re-delivered event never becomes a duplicate notification.

### Administration (Control Panel)
- User CRUD with role assignment, phone, sector/location, SMS opt-in and active flag.
- Operators may only manage users they created and cannot grant `admin`.

### Stakeholder portal
- Landowner / village-head view of recent detections, local alerts, and a dedicated SOS button.

---

## System architecture

```text
                    ┌──────────────────────────────┐
   USB / IP camera  │  Browser (React 19 + Vite)   │
        │           │                              │
        ▼           │  pages/  components/  hooks/ │
  ┌───────────┐     │  LiveMonitor · SmsCenter ·   │
  │ Detector  │     │  Overview · AdminPanel ·     │
  │ (YOLO /   │     │  StakeholderPortal           │
  │  Roboflow)│     └───────────┬──────────────────┘
  └─────┬─────┘                 │  fetch /api/v1/*  +  ws /api/v1/ws/live
        │ frame (base64 JPEG)   │  (Vite dev proxy → :8000)
        ▼                       ▼
  ┌────────────────────────────────────────────────┐
  │            FastAPI backend (routes.py)         │
  │  auth · users · sms · alerts · logs · ai ·     │
  │  notifications · detections · WebSocket        │
  ├────────────────────────────────────────────────┤
  │ ai/detector.py     ultralytics YOLO (lazy)     │
  │ notifications.py   alert rendering + SMS send  │
  │ auth.py            bcrypt + JWT + role guard   │
  │ websocket_manager  broadcast hub               │
  ├────────────────────────────────────────────────┤
  │   async SQLAlchemy 2  →  SQLite (aiosqlite)    │
  └────────────────────────────────────────────────┘
                 │                    │
                 ▼                    ▼
        detections · users     WebSocket clients
        sms_logs · sms_config  (dashboards)
        notifications · logs
        password_reset_tokens
```

External/edge clients (Jetson, Raspberry Pi, scripts) talk to the same backend using `X-Api-Key` instead of a dashboard JWT.

---

## Technology stack

### Backend
| Layer | Choice |
|---|---|
| Framework | FastAPI 0.111 |
| Server | Uvicorn (standard extras) |
| ORM | SQLAlchemy 2 (async) + `aiosqlite` |
| Validation | Pydantic v2 |
| Auth | `bcrypt` 4.2, `python-jose[cryptography]` |
| HTTP client | `httpx` (TextBee, Pi example) |
| Inference | `ultralytics` (YOLO11), `opencv-python-headless`, `numpy`, `onnxruntime` |
| Config | `python-dotenv` |

### Frontend
| Layer | Choice |
|---|---|
| UI | React 19, React DOM 19 |
| Build | Vite 8 (`@vitejs/plugin-react`) |
| Routing | `react-router-dom` 7 |
| Styling | Tailwind CSS 4 via `@tailwindcss/vite` |
| Icons | `lucide-react` |
| Animation | `motion` |
| Toasts | `react-hot-toast` |
| Optional AI | `@roboflow/inference-sdk` (hosted WebRTC workflows) |
| Lint | `oxlint` |

---

## Repository layout

```text
wild/
├── README.md                     ← this document
├── AGENTS.md                     ← agent/workspace conventions
├── commands.txt                  ← quick shell cheat-sheet
├── package.json                  ← root shim: only @roboflow/inference-sdk
│
├── backend/
│   ├── .gitignore
│   ├── wildguard.db              ← SQLite database (created/used by default)
│   └── app/
│       ├── main.py               ← FastAPI app, CORS, routers, lifespan, demo seeding
│       ├── routes.py             ← every HTTP + WebSocket endpoint (single module)
│       ├── schemas.py            ← Pydantic request/response models
│       ├── database.py           ← engine, session factory, ORM models, init_db()
│       ├── auth.py               ← hashing, JWT, get_current_user, require_role
│       ├── notifications.py      ← alert text rendering + shared SMS delivery
│       ├── sms_sender.py         ← TextBee SMS transport (send, devices, status)
│       ├── websocket_manager.py  ← ConnectionManager broadcast hub
│       ├── pi_client_example.py  ← device-side POST example (not imported)
│       ├── requirements.txt      ← Python dependencies
│       ├── README.md             ← backend-specific API notes (partly outdated)
│       └── ai/
│           ├── detector.py           ← YOLO loading, base64 decode, inference
│           ├── species_classifier.py ← optional three-class crop classifier
│           └── models/
│               ├── yolo11n.pt            ← bundled checkpoint (COCO, 80 classes)
│               ├── best.pt/              ← exported checkpoint directory
│               ├── wildguard_etl_cls.pt  ← three-class classifier weights
│               ├── wildguard_etl_cls.json← classifier labels/metadata
│               └── wildguard_etl.onnx    ← ONNX export
│
└── frontend/
    ├── index.html                ← Vite entry, mounts /src/main.jsx
    ├── vite.config.js            ← React + Tailwind plugins, /api proxy → :8000
    ├── package.json              ← npm scripts and dependencies
    ├── requirements.txt          ← human-readable dependency summary (docs only)
    ├── .oxlintrc.json            ← lint configuration
    ├── .env.example              ← Roboflow configuration template
    └── src/
        ├── main.jsx              ← createRoot + BrowserRouter
        ├── App.jsx               ← route table
        ├── api.js                ← fetch wrapper, mappers, WS URL, AI calls
        ├── index.css             ← Tailwind import + global styles
        ├── pages/
        │   ├── Login.jsx
        │   ├── Register.jsx
        │   ├── ForgotPassword.jsx
        │   ├── ResetPassword.jsx
        │   └── HomePage.jsx      ← authenticated shell: header, tabs, WS, notifications
        ├── components/
        │   ├── AuthLayout.jsx
        │   ├── ProtectedRoute.jsx
        │   ├── Header.jsx
        │   ├── Overview.jsx
        │   ├── LiveMonitor.jsx
        │   ├── DetectionLogs.jsx
        │   ├── DetectionsPage.jsx
        │   ├── SmsCenter.jsx
        │   ├── AdminPanel.jsx
        │   ├── StakeholderPortal.jsx
        │   ├── NotificationDrawer.jsx
        │   ├── NotificationToast.jsx
        │   ├── NotificationPanel.jsx   (unused)
        │   └── CameraFeed.jsx          (unused)
        ├── hooks/
        │   ├── useWebSocket.js
        │   └── useRoboflowStream.js
        ├── utils/
        │   ├── detectionModel.js
        │   ├── teachableMachine.js
        │   ├── roboflowStream.js
        │   ├── wildlifeDetection.js
        │   ├── wildlifePrediction.js
        │   ├── handleWildlifePrediction.js
        │   ├── audio.js
        │   ├── datetime.js
        │   └── types.js                (unused)
        └── pages/ + types.js
```

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | 3.11+ (3.14 used in development) | `pip` available |
| Node.js | 20+ | comes with npm |
| Browser | Chrome / Edge / Firefox | webcam access required for Live Monitor |
| SQLite | bundled with Python | no server to install |

The AI dependencies (`ultralytics`, `opencv-python-headless`, `onnxruntime`, `numpy`) are heavy (~1 GB download). If you only need the dashboard, users, SMS and notifications, you can skip them — the AI endpoints are the only ones that import them, and the import is deferred.

---

## Quick start

### 1. Backend

```bash
cd backend
python -m venv venv
# Windows (bash)
source venv/Scripts/activate
# macOS / Linux
# source venv/bin/activate

pip install -r app/requirements.txt
uvicorn app.main:app --reload --port 8000
```

On first start the app creates all tables (and patches older SQLite schemas), then seeds four demo accounts. API docs: <http://localhost:8000/docs>. Health: <http://localhost:8000/health>.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the printed URL (normally <http://localhost:5173>). Vite proxies `/api` (including WebSocket upgrades) to `http://localhost:8000`, so no CORS or base-URL setup is needed in development.

### 3. Log in

Use one of the demo accounts below, or register a new user on `/register`.

---

## Demo accounts

Seeded by `seed_demo_users()` in `backend/app/main.py` on every startup (existing emails are skipped, so your edits are safe):

| Role | Email | Password | Location |
|---|---|---|---|
| `admin` | `admin@wildguard.ai` | `admin123` | WildGuard Control Center |
| `operator` | `operator@wildguard.ai` | `operator123` | Forest Operations Zone |
| `landowner` | `landowner@wildguard.ai` | `landowner123` | Sector B3 – Green Valley Orchards |
| `village_head` | `villagehead@wildguard.ai` | `villagehead123` | Sector A4 – Silverwood Hamlet |

Demo users are seeded **without phone numbers**, so they appear in the SMS recipient list as "No phone number" until you add one in the Control Panel. See [Security notes](#security-notes) — change or remove these before any real deployment.

---

## Configuration reference

### Backend environment (`backend/.env`)

`database.py` calls `load_dotenv()` at import, so a `backend/.env` file is read automatically. All variables are optional with development defaults.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite+aiosqlite:///./wildguard.db` | Any SQLAlchemy async URL; point at PostgreSQL to scale |
| `API_SECRET_KEY` | `change_me` | Shared secret for device clients (`X-Api-Key`) |
| `JWT_SECRET_KEY` | `wildguard-dev-secret-key-change-in-production` | Signs dashboard JWTs |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | JWT lifetime (24 h) |
| `FRONTEND_URL` | `http://localhost:5173` | Base URL used to build password-reset links |
| `RESET_TOKEN_EXPIRE_MINUTES` | `30` | Reset-link validity |
| `WILDLIFE_MODEL_PATH` | bundled `yolo11n.pt` | Swap in a trained three-class checkpoint |
| `BACKEND_URL` | — | Used by `pi_client_example.py` on the device |
| `TEXTBEE_API_KEY` | — | TextBee API key; without it SMS is recorded as `simulated` and never sent |
| `TEXTBEE_DEVICE_ID` | account default | Which registered Android phone sends the texts |
| `TEXTBEE_DEFAULT_COUNTRY_CODE` | — | Prefix added to numbers saved without one (e.g. `91`) |
| `TEXTBEE_BASE_URL` | `https://api.textbee.dev/api/v1` | Override for a self-hosted TextBee gateway |

SMS goes out through [TextBee](https://textbee.dev): an Android phone with a SIM is registered as a device, and the backend POSTs to `/gateway/send-sms` with the `x-api-key` header. TextBee is the only SMS provider; no Twilio or Brevo credentials are read.

Example `backend/.env`:

```dotenv
DATABASE_URL=sqlite+aiosqlite:///./wildguard.db
API_SECRET_KEY=replace-with-a-long-device-secret
JWT_SECRET_KEY=replace-with-a-long-random-jwt-secret
ACCESS_TOKEN_EXPIRE_MINUTES=1440
FRONTEND_URL=http://localhost:5173
TEXTBEE_API_KEY=
TEXTBEE_DEVICE_ID=
```

### Frontend environment (`frontend/.env.local`)

All `VITE_*` values are inlined into the client bundle at build time — treat them as public.

| Variable | Default | Purpose |
|---|---|---|
| `VITE_ROBOFLOW_API_KEY` | — | Enables the Roboflow provider; leave empty to hide it |
| `VITE_ROBOFLOW_WORKSPACE` | `vaishnavi-shetty` | Workspace slug |
| `VITE_ROBOFLOW_WORKFLOW` | `ai-wgdeu` | Workflow ID |
| `VITE_ROBOFLOW_IMAGE_INPUT` | `image` | Workflow image input name |
| `VITE_ROBOFLOW_STREAM_OUTPUT` | `output` | Annotated stream output name (empty = server picks) |
| `VITE_ROBOFLOW_DATA_OUTPUT` | `predictions` | Predictions output name |
| `VITE_ROBOFLOW_PLAN` | `webrtc-gpu-medium` | Inference plan |
| `VITE_ROBOFLOW_REGION` | `us` | Inference region |
| `VITE_ROBOFLOW_TIMEOUT` | `3600` | Stream timeout (seconds) |
| `VITE_ROBOFLOW_SERVER_URL` | — | Override for self-hosted / proxied Roboflow |

Without the first three, the Live Monitor simply uses the local backend detector and the Roboflow option stays hidden.

---

## Roles and permissions

| Capability | admin | operator | landowner | village_head |
|---|:--:|:--:|:--:|:--:|
| Overview tab | ✅ | ✅ | ✅ | ✅ |
| Live Monitor | ✅ | ✅ | ✅ | ✅ |
| SMS Center | ✅ | ✅ | ✅ | ✅ |
| My land / My village portal | — | — | ✅ | ✅ |
| Control Panel (users + system logs) | ✅ | ✅ | — | — |
| List/create users (`/users`) | ✅ | ✅ | — | — |
| Update users | ✅ (any) | ✅ (only users they created, never admins) | — | — |
| Delete users (`/users/{id}`) | ✅ (admins cannot be deleted) | — | — | — |
| System logs (`/logs`) | ✅ | ✅ | — | — |
| Read user directory (`/users/all`) | ✅ | ✅ | ✅ | ✅ |
| Trigger SOS | ✅ | ✅ | ✅ | ✅ |

Navigation tabs per role are defined in `ROLE_TABS` (`frontend/src/pages/HomePage.jsx`) and mirrored by the nav arrays in `Header.jsx`. `handleTabChange` rejects tabs outside the role's allow-list, and `HomePage` additionally renders `AccessDenied` for the `admin` and `stakeholder` screens as defence in depth.

The backend enforces the same rules independently — the UI gating is convenience, not security.

---

## Frontend deep dive

### Entry and routing

- `index.html` → `src/main.jsx` → `createRoot(...).render(<BrowserRouter><App /></BrowserRouter>)`.
- `App.jsx` routes:

| Path | Element | Access |
|---|---|---|
| `/login` | `Login` | public |
| `/register` | `Register` | public |
| `/forgot-password` | `ForgotPassword` | public |
| `/reset-password` | `ResetPassword` | public (expects `?token=`) |
| `/home` | `ProtectedRoute` → `HomePage` | authenticated |
| `/detections` | `ProtectedRoute` → `DetectionsPage` | authenticated |
| `/` and `*` | redirect to `/login` | — |

- `ProtectedRoute` requires **both** `localStorage.wildguard_token` and a parseable `localStorage.wildguard_user` with `id` and `email`; otherwise it clears the session and redirects with a message.

### `api.js` — the single network layer

`request(path, options)` prefixes `/api/v1`, injects `Authorization: Bearer <token>` from `localStorage.wildguard_token`, parses `detail` out of error responses into an `Error`, and returns `null` for `204`.

Groups:

- **Auth** — `loginUser`, `registerUser`, `getCurrentUser`, `requestPasswordReset`, `resetPassword`
- **Users** — `fetchUsers` (`/users`, admin only), `fetchAllUsers` (`/users/all`, any signed-in role), `createUser`, `updateUser`, `deleteUser`
- **SMS** — `getSmsConfig`, `updateSmsConfig`, `sendSms`, `fetchSmsLogs`
- **Alerts** — `sendSos`
- **Logs / notifications** — `fetchSystemLogs`, `fetchNotifications`, `createNotification`, `markNotificationReadRequest`, `markAllNotificationsReadRequest`, `deleteNotificationRequest`, `clearNotificationsRequest`
- **AI** — `predictImage`, `fetchModelInfo`
- **Detections** — `fetchDetections`, `fetchDetection`, `updateDetection`, `fetchStats`, `postDetection` (uses `X-Api-Key` + Bearer)
- **Helpers** — `getWebSocketUrl()` (builds `ws(s)://<host>/api/v1/ws/live`), `getThreatLevel()`, and mappers `mapBackendDetection`, `mapBackendUser`, `mapSmsLog`, `mapSystemLog`, `mapBackendNotification` that translate snake_case backend payloads into the camelCase shapes the components expect.

### Pages

| File | Purpose |
|---|---|
| `pages/Login.jsx` | Email/password sign-in; stores token + user and redirects to `/home`. |
| `pages/Register.jsx` | Account creation with role, phone, location and SMS opt-in fields. |
| `pages/ForgotPassword.jsx` | Requests a reset link; when the backend returns `reset_url` (email not configured), it surfaces a button that opens the reset screen directly. |
| `pages/ResetPassword.jsx` | Reads `?token=`, validates the new password, submits, and redirects to login. |
| `pages/HomePage.jsx` | The authenticated shell. Owns the WebSocket connection, detection log state, notification state (unread count, add/read/clear), the SOS handler, tab routing (`home`, `dashboard`, `sms`, `stakeholder`, `admin`), and mounts `Header`, `NotificationDrawer`/`NotificationToast`. Maps incoming `new_detection` and `emergency_sos` events into alerts and persisted notifications. |

### Components

| File | Purpose |
|---|---|
| `Header.jsx` | Brand, role-aware navigation (per-role tab list), notification bell with unread badge, profile menu, logout. |
| `Overview.jsx` | Landing dashboard: KPI cards (threats, species seen, last detection, live clients) from `/stats`, recent alerts, embedded `DetectionLogs`. |
| `LiveMonitor.jsx` | Camera acquisition (`getUserMedia`), provider switch (`local` / `roboflow`), scanning loop with an in-flight guard so slow inferences cannot queue up, canvas overlay drawing species-coloured boxes, scanning status, model-capability warning from `/ai/model`, and detection dispatch (`onPrediction`). |
| `DetectionLogs.jsx` | Table/cards of detections with species colour, confidence, level, location, camera and SMS status; used by `Overview` and rendered directly by `HomePage` when the path is `/detections`. |
| `DetectionsPage.jsx` | Self-contained detection detail screen (fetches `/detections` itself, filters, per-detection drill-down). Mounted by the `/detections` route in `App.jsx`. (Default export is named `DetectionsPAge` — a typo, but consistent between its declaration and export.) |
| `SmsCenter.jsx` | Recipient selection from real users (never the signed-in user), composer, send action, unified SMS history with sent/received labelling, configuration view. Largest component in the app. |
| `AdminPanel.jsx` | Control Panel: user table with create/edit/delete, active toggle, phone/sector editing, SMS settings and security cards, plus small stat cards. |
| `StakeholderPortal.jsx` | Landowner / village-head perspective: recent detections affecting their area, the SOS button, and the message form. |
| `NotificationDrawer.jsx` | Slide-over list of notifications with per-type icons (including the red `AlertTriangle` for `emergency_sos`), mark-read, delete and clear-all. |
| `NotificationToast.jsx` | Transient toast for new alerts, with sound and dismiss. |
| `NotificationPanel.jsx` | Earlier panel-style notification UI — **not imported anywhere**. |
| `CameraFeed.jsx` | Earlier camera-feed component — **not imported anywhere**; `LiveMonitor` superseded it. |
| `AuthLayout.jsx` | Shared split-screen layout for the auth pages. |
| `ProtectedRoute.jsx` | Session guard described above. |

### Hooks

| File | Purpose |
|---|---|
| `useWebSocket.js` | Opens `getWebSocketUrl()`, reconnects with back-off, sends periodic `ping`, parses JSON and forwards each message to `onEvent`. Cleans up on unmount. |
| `useRoboflowStream.js` | Manages a Roboflow WebRTC inference session (start/stop, status, errors) through `utils/roboflowStream.js`; reports `supported` based on configuration. |

### Utils

| File | Purpose |
|---|---|
| `detectionModel.js` | The inference facade: `predictWildlife`, `runDetection`, `runTeachableDetection`, `captureFrame` (canvas → JPEG base64, downscaled), `mapPredictResponse`, `getModelInfo`, plus class metadata (`DETECTION_SPECIES`, `CLASS_META`, `resolveClassMeta`, `TARGET_SPECIES`). |
| `teachableMachine.js` | Optional Teachable Machine image model (loaded from its metadata URL); `predictFromVideo` classifies a video element. |
| `roboflowStream.js` | Low-level Roboflow client: `isRoboflowConfigured`, `startRoboflowStream`, `stopRoboflowStream`, `mapRoboflowOutput`, `ROBOFLOW_MODEL_NAME`. |
| `handleWildlifePrediction.js` | Bridges a prediction to app state: adds the detection to the log, raises a notification, plays the alert sound, and posts a persisted notification. |
| `wildlifePrediction.js` | Builds the notification object (title, message, alert level) for a species/confidence pair. |
| `wildlifeDetection.js` | Re-export barrel for the detection module. |
| `audio.js` | WebAudio tones for notification, threat, SMS, camera-connected and camera-disconnected events. |
| `datetime.js` | `formatDate`, `formatDateTime`, `getDayGroup` for log grouping. |
| `types.js` | Type/shape helpers and sample defaults — **not imported anywhere**. |

### Styling

Tailwind 4 with utilities written inline. The visual language is a dark teal palette (`#061418`, `#0c2227`, `#1d3a3a`), mint accents (`#7fe6b4`), and red for critical states. Global rules live in `src/index.css`.

---

## Backend deep dive

### `main.py`
- Configures logging.
- Defines `DEMO_USERS` and `seed_demo_users()`.
- Lifespan: `init_db()` → seed → serve.
- Creates the `FastAPI` app (title/description/version), enables permissive CORS (`*` origins, methods, headers), mounts the eight routers under `/api/v1`, and exposes `GET /` and `GET /health`.

### `routes.py` (all endpoints in one module)
- **Routers:** root (`detections`, `stats`, `ws`), `auth`, `users`, `sms`, `alerts`, `logs`, `ai`, `notifications`.
- **`_verify_key`** — accepts either a matching `X-Api-Key` or a valid Bearer JWT for an active user; used by detection ingestion and the AI endpoints.
- **`_threat_level`** — same HIGH/MEDIUM/LOW scale as the frontend so levels agree.
- **`_parse_json`** — safe decode of the JSON-in-TEXT columns on `sms_config`.
- **`_log_system_event`** — writes a `SystemLog`, swallowing failures so audit logging can never break a request.
- **`_hash_reset_token` / `_as_utc`** — SHA-256 hashing of reset tokens and SQLite naive-datetime handling.

### `schemas.py`
Pydantic v2 models with validators: species normalisation against `VALID_SPECIES = {elephant, tiger, leopard, unknown}`, role validation against `VALID_ROLES`, lowercase email normalisation, status/alert-level regex patterns, and a `field_serializer` that re-attaches UTC to naive SQLite datetimes.

### `database.py`
Async engine + `async_sessionmaker`, declarative `Base`, the seven ORM models, `get_db()` dependency, and `init_db()` which runs `create_all` and then `_add_sqlite_columns()` — an idempotent mini-migration that adds `detections.status`, `detections.alert_level` and `users.created_by` to older SQLite files.

### `auth.py`
`hash_password` / `verify_password` (bcrypt), `create_access_token` / `decode_token` (HS256), `get_current_user` (validates token, loads user, rejects inactive accounts), `get_optional_user` (defined but unused), and `require_role(*roles)` which returns a dependency enforcing role membership.

### `notifications.py`
`build_alert_message()` renders the multi-line alert text (species, confidence, GPS or "no fix", device). `deliver_sms()` is the single delivery path used by detection alerts, manual broadcasts and SOS: it calls `sms_sender.send_sms()` once per broadcast and writes one `SmsLog` row per recipient, with status `sent` (TextBee accepted the batch), `failed` (configured but rejected) or `simulated` (no `TEXTBEE_API_KEY`). SOS also passes `log_skipped=True`, so an account with no number on file still gets a row with status `no_phone` — the in-app notification reaches them, the history shows they were not texted. Every row stores `sent_by` (who triggered the send, `system` for automatic alerts) and `recipient_id` (the addressee's `users.id`), which is what the history endpoint filters on: admins see all rows, everyone else sees their own sends plus messages addressed to them.

### `sms_sender.py`
TextBee HTTP client. `is_sms_configured()` checks the key, `normalise_phone()` converts stored numbers to E.164 (strips spaces, `00` prefixes, adds `TEXTBEE_DEFAULT_COUNTRY_CODE` when needed), `send_sms()` posts `{recipients[], message, deviceId?}` and returns an `SmsResult(ok, batch_id, error)` instead of raising, `fetch_devices()`/`gateway_status()` power `GET /sms/status`.

### `websocket_manager.py`
`ConnectionManager` holds a locked list of sockets, implements `connect` / `disconnect` / `broadcast` (drops dead sockets after a failed send) and exposes `active_connections` for `/stats`. A module-level `manager` singleton is imported by the routes.

### `ai/detector.py`
- Resolves the checkpoint (`WILDLIFE_MODEL_PATH` or bundled `yolo11n.pt`) and loads it lazily under a thread lock, reloading if the path changes.
- `get_model_info()` returns classes, class count, `imgsz`, and which of `elephant`/`tiger`/`leopard` the checkpoint cannot emit.
- `decode_image_b64()` strips `data:` prefixes, pads base64, and decodes with OpenCV.
- `run_detection()` runs `model.predict`, sorts by confidence, caps at `max_detections`, builds boxes/counts/total/latency, and optionally returns an annotated JPEG.
- Inference is called through `asyncio.to_thread` so the event loop stays responsive.

### `ai/species_classifier.py`
Optional three-class classifier using `wildguard_etl_cls.pt` + `.json`; `available()` and `classify_crop_bgr()` are used to refine a detection crop when the weights are present.

### `pi_client_example.py`
Standalone helper (never imported) demonstrating `send_detection(species, confidence, lat, lon, gps_fix, device_id, image_path)` with `httpx`, plus a `__main__` smoke test.

---

## Data model

All tables are created automatically. SQLite by default; swap `DATABASE_URL` for PostgreSQL without code changes.

### `detections`
| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `species` | str(64) | one of elephant / tiger / leopard / unknown |
| `confidence` | float | 0–1 |
| `latitude`, `longitude` | float? | GPS if available |
| `gps_fix` | bool | satellite fix flag |
| `detected_at` | datetime (tz) | server time when omitted |
| `device_id` | str(64) | default `unit-01` |
| `status` | str(32) | `active` / `resolved` / `dismissed` |
| `alert_level` | str(16)? | LOW / MEDIUM / HIGH / CRITICAL |
| `sms_sent` | bool | result of the SMS path |
| `sms_error` | str(256)? | failure detail |
| `image_b64` | text? | optional thumbnail |

### `users`
`id`, `username`, `email` (unique, indexed), `hashed_password`, `role`, `phone`, `location_name`, `sms_alerts_enabled`, `is_active`, `created_by`?, `created_at`.

### `password_reset_tokens`
`id`, `user_id`, `token_hash` (unique, SHA-256 of the raw token), `expires_at`, `used_at`?, `created_at`.

### `sms_logs`
`id`, `timestamp`, `recipient_phone`, `recipient_name`, `recipient_role`, `recipient_id`?, `message`, `status` (`sent` / `failed` / `simulated` / `no_phone`), `trigger_type` (`manual_broadcast`, `emergency_sos`, `auto_detection`, …), `sighting_id`?, `sector`?, `sent_by`.

`sent_by` is the username behind the send (`system` for automatic detection alerts) and `recipient_id` is the `users.id` the message was addressed to. Together they drive history visibility: non-admins get `sent_by = their username OR recipient_id = their id`, admins get every row. Dedicated columns were chosen over matching on `recipient_name` or `recipient_phone`, since neither is unique or stable across edits.

### `sms_config`
Single row keyed `default`: `auto_alert_enabled`, `alert_levels` (JSON text), `selected_species` (JSON text), `default_sender_name`.

### `notifications`
`id`, `user_id`, `client_id`?, `title`, `message`, `type` (`threat`, `emergency_sos`, `system`, `sms`, …), `location`?, `alert_level`?, `is_read`, `created_at`. Unique constraint on `(user_id, client_id)` gives idempotent delivery.

### `system_logs`
`id`, `timestamp`, `user`, `ip`, `action`, `details`, `is_suspicious`.

---

## API reference

Base URL: `http://localhost:8000/api/v1` · interactive docs at `/docs`.

Auth legend: **JWT** = `Authorization: Bearer <token>` · **Key** = `X-Api-Key` **or** JWT · **public** = no auth.

### Health
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` (no prefix) | public | `{"status":"ok"}` |
| GET | `/health` (no prefix) | public | `{"status":"healthy"}` |

### Auth
| Method | Path | Auth | Body / notes |
|---|---|---|---|
| POST | `/auth/register` | public | `{username, email, password, role, phone, location_name, sms_alerts_enabled}` → `{access_token, token_type, user}` |
| POST | `/auth/login` | public | `{email, password}` → token + user; failed attempts are logged as suspicious; inactive accounts get `403` |
| GET | `/auth/me` | JWT | current `UserOut` |
| POST | `/auth/forgot-password` | public | `{email}` → `{status, message, reset_url?}`; `reset_url` carries the single-use link, since no mail provider is configured |
| POST | `/auth/reset-password` | public | `{token, password}`; single-use token, expired/used links rejected, other tokens for the user are deleted |

### Users
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/users` | JWT admin/operator | all users, newest first |
| POST | `/users` | JWT admin/operator | create; operators cannot create admins |
| GET | `/users/all` | JWT any role | **active** users only — the SMS recipient source |
| GET | `/users/{id}` | JWT | single user |
| PUT | `/users/{id}` | JWT admin/operator | partial update; `password` re-hashed; operators limited to their own users |
| DELETE | `/users/{id}` | JWT admin | deletes; admin accounts are protected |

### Detections
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/detections` | Key | ingest an event → `{id, message, sms_queued}` (201) |
| GET | `/detections` | public | filters `species`, `device_id`, `from_dt`, `to_dt`, `limit` (≤1000), `offset` |
| GET | `/detections/{id}` | public | single record or 404 |
| PATCH | `/detections/{id}` | JWT | update `status` and/or `alert_level` |
| GET | `/stats` | public | `total_detections`, `by_species`, `last_detection`, `live_dashboard_clients` |

Ingest example:

```bash
curl -X POST http://localhost:8000/api/v1/detections \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $API_SECRET_KEY" \
  -d '{"species":"elephant","confidence":0.93,"latitude":12.9716,"longitude":77.5946,"gps_fix":true,"device_id":"unit-01"}'
```

### AI
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/ai/model` | Key | active checkpoint, classes, missing target species |
| POST | `/ai/predict` | Key | `{image, confidence_threshold=0.25, iou_threshold=0.45, max_detections=20, draw_boxes=false}` → detections, counts, total, `inference_ms`, image size, optional annotated image |

### SMS
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/sms/config` | JWT | auto-alert flag, alert levels, selected species, sender name, plus `sms_configured` / `sms_provider` (from the env, not editable) |
| PUT | `/sms/config` | JWT | partial update of the stored fields |
| GET | `/sms/status` | JWT | pings TextBee: `{provider, configured, device_id, devices[], error}` |
| POST | `/sms/send` | JWT | `{recipient_ids[], message, trigger_type, sector?, sighting_id?}` → created `SmsLog[]`; empty `recipient_ids` falls back to all active users with SMS enabled; one TextBee batch per call |
| GET | `/sms/logs` | JWT | filters `status`, `trigger_type`, `limit` (≤500); admins see every row, other roles see the rows they sent (`sent_by`) plus the rows addressed to them (`recipient_id`) |

### Alerts
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/alerts/sos` | JWT | `{location?, message?, latitude?, longitude?}` → `{acknowledged, message, broadcast_count}`; notifies **every** active user |

### System logs
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/logs` | JWT admin/operator | `limit` (≤500), newest first |

### Notifications
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/notifications` | JWT | current user's notifications, `limit` (≤500) |
| POST | `/notifications` | JWT | create for current user; same `client_id` returns the existing row |
| POST | `/notifications/read-all` | JWT | mark all read (204) |
| PATCH | `/notifications/{id}/read` | JWT | mark one read |
| DELETE | `/notifications/{id}` | JWT | delete one (204) |
| DELETE | `/notifications` | JWT | clear all for the user (204) |

---

## Real-time protocol (WebSocket)

**Endpoint:** `ws(s)://<host>/api/v1/ws/live` (no auth handshake; connect from the dashboard).

Server → client messages:

```jsonc
// new detection
{ "event": "new_detection",
  "data": { "id": 42, "species": "elephant", "confidence": 0.93,
            "latitude": 12.9716, "longitude": 77.5946, "gps_fix": true,
            "detected_at": "2026-01-01T10:00:00+00:00",
            "device_id": "unit-01", "sms_sent": false } }

// emergency SOS
{ "event": "emergency_sos",
  "data": { "event_id": "3f9c…", "user": "Administrator", "location": "Sector B3",
            "message": "WILDGUARD EMERGENCY SOS: …", "recipient_count": 6,
            "timestamp": "2026-01-01T10:05:00+00:00" } }

// keep-alive reply
{ "event": "pong" }
```

Client → server: send the text `ping` to receive `pong`. The frontend `useWebSocket` hook reconnects with back-off and re-subscribes automatically.

`new_detection` events are ephemeral UI signals; the durable record is the `Notification` row written by the backend (`client_id = ws-<detection_id>`). For `emergency_sos`, the client posts a notification with `client_id = sos-<event_id>`, which the unique `(user_id, client_id)` constraint de-duplicates even if the event is re-delivered.

---

## Detection and alerting pipeline

### Ingestion (`POST /detections`)

1. Authenticate via `X-Api-Key` or an active user's JWT.
2. Validate and normalise the payload (species list, confidence range, GPS bounds).
3. Persist the `Detection`; default `detected_at` to server UTC.
4. Apply the SMS center settings: `auto_alert_enabled`, then `selected_species`, then `alert_levels` (the level comes from `_threat_level`). If all three pass, `deliver_sms()` renders the alert text — species, confidence, GPS or "no fix", device, no event ID — and sends it as one TextBee batch to every active user with `sms_alerts_enabled` and a phone number; the row links back to the detection through `sighting_id = WG-<id>`. `sms_sent`/`sms_error` are stored accordingly, and failures never abort the ingest. Detection alerts do **not** use `log_skipped`, so accounts without a number add no row (they get the in-app notification); otherwise every passing detection would flood their history.
5. Create one `Notification` per **active** user (`type="threat"`, `client_id="ws-<id>"`, alert level from confidence). Failures here roll back only the notification block — the detection is already saved.
6. Broadcast `new_detection` to every connected dashboard.

### Threat levels

| Condition | Level |
|---|---|
| species `unknown` / `no threat` | LOW |
| confidence ≥ 0.85 | HIGH |
| confidence ≥ 0.60 | MEDIUM |
| otherwise | LOW |

The same scale is implemented in `backend/app/routes.py::_threat_level` and `frontend/src/api.js::getThreatLevel`.

### Manual SMS broadcast (`POST /sms/send`)

- Recipients = the selected `recipient_ids`, or all active users with `sms_alerts_enabled` when none are given.
- One TextBee request carries every recipient; one `SmsLog` per recipient records status (`sent` / `failed` / `simulated` / `no_phone`), `trigger_type`, sector (payload or the recipient's location), optional `sighting_id`, the sending account in `sent_by` and the addressee in `recipient_id`.
- Recipients with no number are rejected (400) unless there is at least one number to text; use SOS when an account without a phone must still be accounted for.
- A `SystemLog` entry records the broadcast, with the provider error appended when TextBee refused it.
- In the dashboard, recipients come from `GET /users/all`; users without a phone are visibly disabled and cannot be selected.

### Emergency SOS (`POST /alerts/sos`)

- Recipients = **every active user**; SMS opt-in and role filters are ignored deliberately (safety broadcast).
- Each recipient gets a `Notification` (`type="emergency_sos"`, `alert_level="CRITICAL"`, `client_id="sos-<event_id>"`).
- Each recipient **with a phone number** also gets an `SmsLog` row (`trigger_type="emergency_sos"`) and is included in the TextBee batch; recipients without one get a row with status `no_phone` (`log_skipped=True`), so nothing disappears from the history.
- A `SystemLog` entry records the broadcast and location.
- A single `emergency_sos` WebSocket broadcast informs live dashboards; the client's own notification insert de-duplicates via `client_id`.

### SMS delivery status

Outbound SMS goes through TextBee (`POST /gateway/send-sms`, `x-api-key` header). A `200` means TextBee queued the batch for your phone — not that the recipient received it. Delivery states are followed in the TextBee dashboard.

- `TEXTBEE_API_KEY` set → real sends; `sms_configured` is `true` and `GET /sms/status` lists the registered devices.
- `TEXTBEE_API_KEY` empty or missing → nothing leaves the machine; every row is written as `simulated` so the history, SOS flow and ingestion contract keep working.
- Key present but rejected (401) → rows are written as `failed` and the reason is logged and returned by `GET /sms/status`. Errors never propagate to the detection ingest.

---

## AI inference

### Backend detector (`/ai/predict`)

- Checkpoint: bundled `backend/app/ai/models/yolo11n.pt` (pretrained COCO, 80 classes) unless `WILDLIFE_MODEL_PATH` points elsewhere.
- Loaded lazily on first request under a thread lock, then cached. Cold start is much slower than warm inference (seconds vs. hundreds of milliseconds on CPU).
- Input: base64 JPEG/PNG (with or without a `data:` prefix). Output: species, confidence, boxes in original-image pixels, per-species counts, total, `inference_ms`, image dimensions, optional annotated JPEG.
- `GET /ai/model` reports the class list and `missing_target_species`, so the dashboard can warn when the active checkpoint cannot emit `tiger`/`leopard` instead of silently returning nothing.
- **Important:** the bundled COCO checkpoint does not know tiger/leopard. A tiger photo is reported as some other COCO animal (e.g. `zebra`) with high confidence — a missing class appears as a *wrong* animal, not as "no detection". Point `WILDLIFE_MODEL_PATH` at a trained three-class `best.pt` for real results.
- `draw_boxes: true` also runs the optional crop classifier (`ai/species_classifier.py`) when its weights are present, to refine each box to elephant/tiger/leopard.

### Local scanning loop (frontend)

`LiveMonitor` captures a frame via `captureFrame()` (canvas → downscaled JPEG → base64), posts it to `/ai/predict`, converts the response with `mapPredictResponse`, draws species-coloured boxes on an overlay canvas, and forwards confirmed detections to `handleWildlifePrediction` → detection log + notification + sound + persisted notification. A tick is skipped while the previous inference is still in flight, so a cold start cannot queue stale frames.

### Roboflow provider (optional)

When the three `VITE_ROBOFLOW_*` values are present, `useRoboflowStream` opens a WebRTC inference session against the configured workflow. Predictions arrive pre-annotated on the video, so the local overlay is suppressed; only the detection data populates the log/notifications.

### Teachable Machine (optional)

`utils/teachableMachine.js` can load an image model from its metadata URL and classify a video element. It is used only if invoked; the default path is backend YOLO.

---

## Password reset flow

No email provider is configured, so `POST /auth/forgot-password` issues an `PasswordResetToken` row and returns the single-use `reset_url` in the response. `ForgotPassword.jsx` shows it as a button that navigates straight to `/reset-password?token=…`. The token is stored hashed, expires after `RESET_TOKEN_EXPIRE_MINUTES`, and earlier unused links stay valid until then.

Because the link travels in the API response, anyone who knows an account's email address can request a reset for it — acceptable for demos and local use, not for a public deployment. Adding a real mail provider means putting the send call back in `forgot_password()` and dropping the returned `reset_url`.

---

## Device / Raspberry Pi integration

Any edge device can submit detections with the shared secret:

```bash
export BACKEND_URL="http://<server-ip>:8000"
export API_SECRET_KEY="<same as backend>"
```

```python
from pi_client_example import send_detection

send_detection("elephant", 0.91, latitude=12.9716, longitude=77.5946,
               gps_fix=True, device_id="unit-01", image_path="frame.jpg")
```

The backend responds with `{ "id": 42, "message": "Detection #42 stored.", "sms_queued": false }` and immediately broadcasts the event to every live dashboard.

Use a `device_id` that is stable per camera so history and filters stay meaningful.

---

## Edge deployment roadmap (Jetson Nano)

The repository currently contains the dashboard, the API and a working YOLO inference path. The final field deployment adds the edge track below.

### Fixed configuration

| Item | Setting |
|---|---|
| Detector | YOLO11n trained for three classes |
| Class IDs | `0=elephant`, `1=tiger`, `2=leopard` |
| Input size | `640 × 640` |
| Initial confidence | `0.75` |
| Target board | NVIDIA Jetson Nano Developer Kit |
| Runtime | TensorRT |
| Camera | USB webcam first, CSI later |
| Model flow | `wildlife_yolo11n_best.onnx` → `wildlife_yolo11n_best.engine` |

### Dataset contract

```text
wildlife-dataset/dataset/
├── train/images/   ├── train/labels/
├── valid/images/   ├── valid/labels/
├── test/images/    ├── test/labels/
└── data.yaml
```

```yaml
nc: 3
names: ["elephant", "tiger", "leopard"]
```

Each label row is `class_id x_center y_center width height`, normalised 0–1. Before training: verify image/label pairing, reject invalid or duplicate boxes, confirm only class IDs 0–2 appear, count instances per class, and visually inspect 50–100 annotated samples per class.

### Development order

1. Verify the three-class dataset.
2. Short sanity training run.
3. Reproducible YOLO11n baselines (record model, image size, epochs, batch, LR, augmentation, checkpoint, metrics).
4. Review loss and per-class validation behaviour.
5. Pick the best **validation** checkpoint, then run the test split **once**.
6. Test unseen images and video.
7. Export ONNX and confirm prediction consistency.
8. Inspect the existing JetPack/L4T/CUDA/TensorRT stack before changing anything.
9. Build a compatible TensorRT engine; test images → video → USB camera.
10. Benchmark FPS, latency, CPU/GPU, RAM and temperature.
11. Add counting, tracking, alerts and extended logging only after core detection is stable.

### Jetson checklist

```bash
cat /etc/nv_tegra_release                 # L4T version
uname -m; python3 --version
nvcc --version
dpkg -l | grep -E 'nvidia-jetpack|cuda|cudnn|nvinfer'
python3 -c "import tensorrt as trt; print(trt.__version__)"
python3 -c "import torch; print(torch.__version__, torch.cuda.is_available())"
sudo apt install v4l-utils
v4l2-ctl --list-devices
v4l2-ctl --list-formats-ext -d /dev/video0
sudo tegrastats            # capture ~10 s baseline, then Ctrl+C
```

Do **not** train on the Jetson, do **not** upgrade JetPack/CUDA/TensorRT/PyTorch blindly, and do **not** create the engine before the versions are known. Camera, detector, tracker, logger and alerts should each be verified separately before integration. Report measured metrics only — never invented numbers.

---

## Scripts and commands

```bash
# backend
cd backend
python -m venv venv && source venv/Scripts/activate     # Windows bash
pip install -r app/requirements.txt
uvicorn app.main:app --reload --port 8000

# backend, production-ish
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2

# frontend
cd frontend
npm install
npm run dev        # Vite dev server with /api proxy
npm run build      # production bundle into dist/
npm run preview    # serve the built bundle
npm run lint       # oxlint

# quick backend import check
cd backend && ./venv/Scripts/python.exe -c "import app.main; print('imports OK')"
```

`commands.txt` in the repository root repeats the essentials.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `ModuleNotFoundError: fastapi` | Activated the wrong interpreter — use the project virtualenv (`backend/venv/Scripts/python.exe`). |
| `pip install -r requirements.txt` says the file is missing | The dependency list lives at `backend/app/requirements.txt`; there is no `backend/requirements.txt` even though `commands.txt` suggests one. |
| Frontend calls fail with 404/`ECONNREFUSED` | Backend not running on port 8000, or you opened the Vite app on a different port without the proxy. |
| WebSocket never connects | The proxy must forward upgrades (`ws: true` in `vite.config.js`, already set). Behind a reverse proxy, enable `Upgrade`/`Connection` headers. |
| Live Monitor shows "model cannot detect tiger/leopard" | The bundled COCO checkpoint has no such classes; set `WILDLIFE_MODEL_PATH` to a trained three-class model. |
| First AI request takes several seconds | Expected: the model is loaded lazily on first use and cached. |
| Camera does not start | Only allowed on `localhost` or HTTPS; grant browser camera permission; close other apps holding the camera. |
| Forgot-password shows no link | The email is unknown or inactive — the endpoint returns the generic message without `reset_url`. Also check `FRONTEND_URL`, since the link is built from it. |
| SMS rows say `simulated` | `TEXTBEE_API_KEY` is empty in `backend/.env`; add the key and restart the backend. |
| SMS rows say `failed` / `/sms/status` returns 401 | TextBee rejected the key (revoked, typo, or pasted from a masked source). Issue a new one in the TextBee dashboard. |
| `/sms/status` shows no devices | No Android phone is registered in the TextBee app, or it has never come online. |
| "No phone number" rows in SMS Center | The account has an empty `phone`; add it in the Control Panel. |
| `database is locked` after killing the server on Windows | Kill the whole process tree: `taskkill //PID <pid> //T //F`. |
| Old SQLite schema after an update | Restart once — `init_db()` adds `status`, `alert_level`, `created_by`, `sent_by` and `recipient_id` automatically. Rows written before `recipient_id` existed can never show up as "received". |

---

## Security notes

- **Rotate before deploying:** `JWT_SECRET_KEY`, `API_SECRET_KEY`, all demo passwords.
- CORS is currently wide open (`allow_origins=["*"]`) — restrict it to your dashboard origin.
- The WebSocket endpoint has no authentication handshake; anyone who can reach it receives broadcast payloads. Add token validation before exposing it publicly.
- `/detections`, `/detections/{id}` and `/stats` are intentionally unauthenticated for read; tighten if the data is sensitive.
- `VITE_*` values are embedded in the client bundle — use a workspace-restricted Roboflow key (or the proxy alternative) rather than a personal one.
- Never commit a real `backend/.env`. Templates only.
- Reset links are single-use and SHA-256 hashed at rest; requesting a new link does not invalidate links already emailed.
- `routes.py` logs a `DEBUG-RESET-LINK` warning line; remove it before production.

---

## Known limitations and housekeeping

- **SMS needs TextBee.** Without `TEXTBEE_API_KEY`, broadcasts are recorded as `simulated` and never leave the server; with a key, delivery still depends on the registered Android phone being online (`sent` only means TextBee accepted the batch). Numbers must be in international format — a local number without a country code is normalised as-is and will not deliver.
- **Delivery state is TextBee's.** The dashboard shows the queue status from the send call, not the carrier's delivery report; check the TextBee console for final delivery.
- **`draw_boxes: true` duplicates detections** in `ai/detector.py`: boxes are appended once in the main loop and again inside the drawing branch, so `detections` repeats each box (while `counts` is computed before the second pass). Keep `draw_boxes` off, or fix the second loop to mutate instead of append.
- **Bundled checkpoint limitation** — COCO classes only; tiger/leopard are absent.
- **Unused modules:** `frontend/src/types.js`, `components/CameraFeed.jsx`, `components/NotificationPanel.jsx` are not imported anywhere; `api.js::fetchDetection`, `api.js::updateDetection`, and a handful of `utils/*` exports have no callers; `backend/app/auth.py::get_optional_user` is never used.
- **Unused declarations:** `oxlint` reports 10 warnings (0 errors) — unused icons `Bell`, `ChevronDown`, `Clock3`, `Smartphone` and the `showSettings`/`setShowSettings` state in `SmsCenter.jsx`; an unused `loading` state in `AdminPanel.jsx`; an unused `Feature` in `AuthLayout.jsx`; an unused `currentUser` prop in `LiveMonitor.jsx`; an unused `catch (error)` binding in `HomePage.jsx`.
- **Committed artifacts:** 20 `.pyc` files under `backend/app/**/__pycache__/` are tracked in git; `backend/.gitignore` only ignores `venv` and `venv311`.
- **Duplicate dependency root:** the repository-root `package.json` + `node_modules` exist only for `@roboflow/inference-sdk`, which `frontend/package.json` already declares.
- `backend/app/README.md` predates the switch to TextBee and describes endpoints without the auth/notification layers — prefer this document and `/docs`.
- The default database file `backend/wildguard.db` is committed; delete it to start from a clean seed.

---

## License and credits

Academic / project work — add an explicit license before distributing. Built with FastAPI, SQLAlchemy, Ultralytics YOLO, React, Vite and Tailwind CSS; optional hosted inference via Roboflow.
