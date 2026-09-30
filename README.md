# Real-Time Wild Animal Detection and Monitoring

An Edge AI project for detecting **elephants, tigers, and leopards** with a three-class YOLO model and deploying it to an **NVIDIA Jetson Nano**. The repository also contains a React/FastAPI dashboard for event monitoring, alerts, users, and administration.

## Objective

The final field system must detect the three species in images, videos, and a USB camera stream; draw species-coloured bounding boxes; display confidence, FPS, latency, and species/total counts; and log confirmed events. The final inference target is TensorRT on a Jetson Nano.

```text
Training machine: dataset verification → YOLO11n training → evaluation → best checkpoint → ONNX
                                                                                     │
                                                                                     ▼
Jetson Nano: USB camera → frames → preprocessing → TensorRT → NMS → boxes/counts/FPS
                                                                 │
                                                    tracking / alert / logging (later)
                                                                 │
                                                                 ▼
                                              FastAPI API → WebSocket dashboard / SMS
```

> Do not train on the Jetson Nano. Keep the dataset (40,000+ annotated images), training, and experiment tracking on the training machine. The Jetson needs only the final model, runtime code, and compatible dependencies.

## Current repository vs. required work

| Area | Status |
|---|---|
| React dashboard | Implemented: authentication, roles, browser-camera UI, notifications, detection history, SMS/admin screens. |
| FastAPI backend | Implemented: event ingestion, SQLite, JWT users, WebSockets, SMS logs, optional Twilio detection alerts, YOLO inference endpoint (`POST /api/v1/ai/predict`). |
| Browser classifier | Real YOLO inference: browser captures a frame and calls the backend, which runs the bundled `yolo11n.pt` checkpoint (see `backend/app/ai/detector.py`). |
| YOLO11n training, dataset validation, ONNX export | Required; not in this repository yet. |
| TensorRT engine and Jetson camera/tracker/GPIO code | Required; not in this repository yet. |
| Accuracy and Jetson benchmarks | Must be measured; no values may be invented. |

## Fixed deployment configuration

| Item | Setting |
|---|---|
| Detector | YOLO11n trained for three classes |
| Class IDs | `0=elephant`, `1=tiger`, `2=leopard` |
| Input | `640 × 640` |
| Initial confidence threshold | `0.75` |
| Target | NVIDIA Jetson Nano Developer Kit |
| Runtime | TensorRT |
| Initial camera | USB webcam |
| Model flow | `wildlife_yolo11n_best.onnx` → `wildlife_yolo11n_best.engine` |

The threshold is an initial deployment value. Any future change must be supported by recorded per-species false-positive/false-negative evaluation.

## Dataset contract

Use the existing YOLO-formatted train/validation/test split. Do not split it again unless inspection proves it is invalid or incomplete.

```text
wildlife-dataset/dataset/
├── train/images/   ├── train/labels/
├── valid/images/   ├── valid/labels/
├── test/images/    ├── test/labels/
└── data.yaml
```

```yaml
train: C:/Users/Gunarakulan/Desktop/wildlife-dataset/dataset/train/images
val: C:/Users/Gunarakulan/Desktop/wildlife-dataset/dataset/valid/images
test: C:/Users/Gunarakulan/Desktop/wildlife-dataset/dataset/test/images
nc: 3
names: ["elephant", "tiger", "leopard"]
```

Each label row is `class_id x_center y_center width height`, with coordinates normalized from 0 to 1. A frame may contain multiple animals/species. If datasets are merged, remap every annotation consistently to IDs 0–2 before verification.

### Dataset gate before training

- Count images and labels for each split independently.
- Find missing pairs, empty/invalid labels, corrupted or duplicate images, and invalid normalized boxes.
- Confirm only IDs 0, 1, and 2 occur and that `data.yaml` name ordering agrees.
- Count instances per class and identify imbalance.
- Visualize **50–100 annotated samples per class** (150–300 total).
- Do not use test results for repeated tuning.

## Required development order

1. Verify the three-class dataset.
2. Set up training and run a short three-class sanity run.
3. Run reproducible YOLO11n baseline experiments.
4. Review loss/validation behavior overall and per class.
5. Select the best validation checkpoint, then perform one final test evaluation.
6. Test unseen images and video.
7. Export ONNX and verify prediction consistency.
8. Inspect the actual Jetson OS/NVIDIA stack before changing packages.
9. Build a compatible TensorRT engine and test images, then video, then USB camera.
10. Benchmark real-time inference.
11. Add counting, tracking, alerts, and extended logging only after core detection is stable.

## Training and evaluation

Start with YOLO11n at 640×640, 50 epochs, and a batch size supported by the training GPU. Track exact software versions, dataset revision, model, image size, epochs, batch, learning rate, augmentation, checkpoint, and metrics for every experiment.

| Experiment | Model | Image size | Epochs | Precision (E/T/L) | Recall (E/T/L) | mAP50 (E/T/L) | mAP50-95 (E/T/L) |
|---|---:|---:|---:|---|---|---|---|
| E1 | YOLO11n | 640 | 50 | Measured | Measured | Measured | Measured |
| E2 | YOLO11n | 640 | 100 | Measured | Measured | Measured | Measured |
| E3 | Lightweight alternative | 640 | 100 | Measured | Measured | Measured | Measured |

Report Precision, Recall, mAP50, and mAP50–95 overall and per species. Check tiger/leopard confusion explicitly. Select `best.pt` based on validation performance; do not assume `last.pt` is best. The test split is for final evaluation only.

Accuracy and Jetson performance are separate objectives: a high-mAP model may be too slow for Nano, while a fast model may miss/confuse animals.

## Jetson Nano setup checklist

### Hardware

- Jetson Nano Developer Kit, adequate power supply, cooling, 64/128 GB microSD, display, keyboard/mouse, network.
- USB webcam first; use CSI only after the USB workflow works.
- Optional later: buzzer/LEDs, resistors, wiring/breadboard, and a suitable GPIO driver circuit.

### First checkpoint — collect before installing/upgrading

```bash
cat /etc/nv_tegra_release
uname -m
python3 --version
lsb_release -a
nvcc --version
dpkg -l | grep -E 'nvidia-jetpack|cuda|cudnn|nvinfer'
python3 -c "import tensorrt as trt; print('TensorRT:', trt.__version__)"
python3 -c "import torch; print('PyTorch:', torch.__version__); print('CUDA:', torch.cuda.is_available())"
sudo tegrastats
ls /dev/video*
hostname -I
```

Run `tegrastats` for about ten seconds and stop with `Ctrl+C`; retain the CPU/GPU/RAM/temperature/power baseline. Do **not** randomly upgrade JetPack or install CUDA, cuDNN, TensorRT, or PyTorch versions. Compatibility depends on the existing JetPack/L4T stack. Do not create the engine until the versions are known.

### Camera verification

```bash
sudo apt update
sudo apt install v4l-utils
v4l2-ctl --list-devices
v4l2-ctl --list-formats-ext -d /dev/video0
```

`/dev/video0` is common but not guaranteed. Confirm live camera output independently (for example, with `cheese`) before adding model inference.

## Jetson deployment layout

```text
~/wildlife-animal-detection/
├── models/       # wildlife_yolo11n_best.onnx and generated .engine
├── videos/       # unseen video tests
├── test_images/  # unseen elephant/tiger/leopard images
├── results/
├── logs/
├── scripts/
├── config/config.yaml
├── src/camera.py
├── src/detector.py
├── src/tracker.py
├── src/logger.py
├── src/main.py
└── requirements.txt
```

```bash
mkdir -p ~/wildlife-animal-detection/{models,videos,test_images,results,logs,scripts,src,config}
# From the training machine; replace the placeholders.
scp models/checkpoints/wildlife_yolo11n_best.onnx USERNAME@JETSON_IP:~/wildlife-animal-detection/models/
```

Choose the ONNX-to-TensorRT conversion command only after confirming JetPack/L4T/TensorRT versions. Build the TensorRT engine on the compatible Jetson.

## Jetson acceptance gates

1. Verify Python, pip, OpenCV, PyTorch/CUDA, and TensorRT imports. Stop and investigate failures rather than reinstalling arbitrary packages.
2. Run unseen elephant, tiger, and leopard image inference. At 0.75, inspect expected class labels and boxes.
3. Run unseen wildlife video and inspect labels, confidence, bounding boxes, output video, misses, and false detections.
4. Identify the USB camera device and run real-time inference.
5. Display species-coloured boxes, class name, confidence, FPS, and measured latency.

```text
USB camera → frame → preprocessing → TensorRT YOLO11n → postprocessing/NMS
           → species-coloured boxes + confidence → FPS/latency → display
```

Add class-wise counts after stable detection. Then add species-aware tracking to avoid counting the same animal in every frame. Alerts come last; require consecutive-frame confirmation (for example, four matching detections in five frames) before GPIO/SMS activity.

## Benchmark evidence

| Metric | Required result |
|---|---|
| Model/input/threshold | YOLO11n / 640×640 / 0.75 |
| Precision, Recall, mAP50, mAP50–95 | Measured overall and for E/T/L |
| FPS, average inference latency | Measured on final Jetson |
| Pre/post-processing latency | Measured |
| CPU/GPU use, RAM, temperature | Measured |
| Counting/tracking | Demonstrated with actual behavior |

Log at minimum timestamp, species, confidence, tracking ID (when enabled), count, and camera/source.

## Existing dashboard and backend

```text
frontend/  React 19 + Vite + Tailwind dashboard
backend/   FastAPI + async SQLAlchemy API
```

The backend can receive confirmed Jetson events through `POST /api/v1/detections` using `X-Api-Key`. It validates species/confidence/GPS, stores the event, broadcasts `new_detection` through `WS /api/v1/ws/live`, and can use Twilio for device-originated alerts. It also exposes detection history/stats, JWT authentication, users, SMS configuration/logs, SOS, and system logs.

The backend already persists species, confidence, camera/device ID, time, location, optional thumbnail, lifecycle state, and SMS result. A future Jetson `logger.py` should submit confirmed detections with a stable device ID.

### On-device browser inference

The dashboard no longer uses randomized predictions. When the Live Monitor or camera feed starts "AI scanning", the browser captures a frame, JPEG-encodes it, and POSTs it to `POST /api/v1/ai/predict` (authenticated with the dashboard JWT or `X-Api-Key`). The endpoint runs the bundled Ultralytics checkpoint (`backend/app/ai/models/yolo11n.pt`) and returns detected species, confidence, bounding boxes, counts, and inference latency; the frontend draws species-coloured boxes over the video and logs confirmed events.

- The bundled `yolo11n.pt` is the pretrained COCO checkpoint — it detects `elephant` (class 20) and other animals but not tiger/leopard. Swap in a trained three-class `best.pt` at the same path or set `WILDLIFE_MODEL_PATH` to it; the code reads `model.names` dynamically.
- Measured on this COCO checkpoint: a tiger photograph is returned as `zebra` at ~88% confidence. A missing class is therefore reported as a *different* animal, not as no detection, so do not treat a low-species count as evidence of an empty frame.
- `GET /api/v1/ai/model` reports the active checkpoint, its class list, and which target species it cannot emit. The Live Monitor uses it to show a warning when `tiger`/`leopard` are absent, which is what makes a checkpoint swap verifiable instead of silent.
- The model is loaded lazily on the first request and cached; the first call is slower (model init + inference, measured ~6-9s cold and ~200-300ms warm on CPU).
- `draw_boxes: true` optionally returns a base64 JPEG with boxes drawn (default off for speed).
- The device events endpoint (`POST /api/v1/detections`) now also accepts a dashboard JWT, so browser detections persist like Jetson events.
- Scan loops skip a tick while the previous inference is still in flight, so the cold-start call cannot queue up stale frames.

### Run the dashboard locally

```powershell
# Terminal 1
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r app\requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2
cd frontend
npm install
npm run dev
```

Open Vite’s displayed address (normally `http://localhost:5173`). FastAPI documentation is `http://localhost:8000/docs`.

### Backend environment

Create `backend/.env`:

```dotenv
DATABASE_URL=sqlite+aiosqlite:///./wildguard.db
API_SECRET_KEY=replace-with-a-long-device-secret
JWT_SECRET_KEY=replace-with-a-long-random-jwt-secret
ACCESS_TOKEN_EXPIRE_MINUTES=1440
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+15551234567
ALERT_RECIPIENTS=+919876543210,+919876543211
```

The Jetson integration must use the same `API_SECRET_KEY` and a `BACKEND_URL`. Keep this device key separate from dashboard JWT credentials.

## Development rules and final demo

- Keep training/deployment environments separate; do not train on Nano or continuously tune with test data.
- Keep thresholds and camera settings in configuration files.
- Test camera, detector, tracker, logger, and alerts separately before integration.
- Change development secrets/demo passwords and harden public endpoints/CORS before production.

The final demonstration should show: three-class annotations; training/validation graphs; per-class and overall metrics; unseen image/video output; ONNX/TensorRT conversion; live Jetson camera inference with boxes/confidence/FPS/latency/counts; logged dashboard events; and tracking/alerts only once core detection works.
