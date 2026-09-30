"""backend/app/ai/detector.py

YOLO inference service backed by an Ultralytics checkpoint.

The model file (`models/yolo11n.pt`) is loaded lazily on the first
inference request (not at import/startup) and cached so a single
process keeps one model in memory. Override the checkpoint via the
`WILDLIFE_MODEL_PATH` environment variable to swap in a trained
three-class checkpoint (`0=elephant, 1=tiger, 2=leopard`) later;
everything downstream reads `model.names`, so it works automatically.
"""

import base64
import os
import threading
import time
from pathlib import Path

import numpy as np
import cv2
from ultralytics import YOLO

MODEL_DIR = Path(__file__).resolve().parent / "models"
DEFAULT_MODEL_PATH = str(MODEL_DIR / "yolo11n.pt")
DEFAULT_IMGSZ = 640

# The three species this project is deployed to detect. A checkpoint only
# reports the classes it was trained on, so the dashboard needs to know which
# of these the loaded checkpoint can actually produce.
TARGET_SPECIES = ("elephant", "tiger", "leopard")

_lock = threading.Lock()
_model = None
_model_path = None


def _resolve_model_path() -> str:
    path = os.getenv("WILDLIFE_MODEL_PATH") or DEFAULT_MODEL_PATH
    return path


def get_model_name() -> str:
    return Path(_resolve_model_path()).name


def _load_model() -> YOLO:
    global _model, _model_path
    path = _resolve_model_path()
    if _model is None or _model_path != path:
        with _lock:
            if _model is None or _model_path != path:
                _model = YOLO(path)
                _model_path = path
    return _model


def get_model_info() -> dict:
    """Describe the checkpoint currently backing inference.

    Loads the model on first call (same lazy cache as inference) so the
    dashboard can report which classes the checkpoint can actually emit and
    which of `TARGET_SPECIES` it is missing. Without this, swapping in a
    checkpoint that lacks `tiger`/`leopard` looks identical to "no animal
    in frame" on the dashboard.
    """
    model = _load_model()
    names = model.names

    if isinstance(names, dict):
        classes = [str(names[key]) for key in sorted(names)]
    else:
        classes = [str(name) for name in names]

    normalized = {name.strip().lower() for name in classes}
    missing = [s for s in TARGET_SPECIES if s not in normalized]

    return {
        "model": get_model_name(),
        "path": _resolve_model_path(),
        "imgsz": DEFAULT_IMGSZ,
        "num_classes": len(classes),
        "classes": classes,
        "target_species": list(TARGET_SPECIES),
        "missing_target_species": missing,
        "covers_target_species": not missing,
    }


def decode_image_b64(data: str) -> np.ndarray:
    """Decode a base64 image string (optionally a `data:` URI) into a BGR ndarray."""
    if not data:
        raise ValueError("Image data is empty")
    encoded = data.strip()
    if encoded.startswith("data:") and "," in encoded:
        encoded = encoded.split(",", 1)[1]
    encoded = encoded.strip() + "=" * (-len(encoded.strip()) % 4)
    try:
        raw = base64.b64decode(encoded, validate=True)
    except Exception as exc:
        raise ValueError(f"Invalid base64 image data: {exc}") from exc
    img = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image bytes into a valid image")
    return img


def run_detection(
    image_bgr,
    conf: float = 0.25,
    iou: float = 0.45,
    max_detections: int = 20,
    draw: bool = False,
) -> dict:
    """Run YOLO inference on a BGR image and return a serialisable result dict."""
    model = _load_model()
    names = model.names

    start = time.perf_counter()
    results = model.predict(
        image_bgr,
        conf=conf,
        iou=iou,
        imgsz=DEFAULT_IMGSZ,
        verbose=False,
    )
    inference_ms = (time.perf_counter() - start) * 1000.0

    result = results[0] if results else None
    detections: list[dict] = []

    if result is not None and result.boxes is not None and len(result.boxes) > 0:
        xyxy = result.boxes.xyxy.cpu().numpy()
        cls = result.boxes.cls.cpu().numpy().astype(int)
        confs = result.boxes.conf.cpu().numpy()

        order = confs.argsort()[::-1][:max_detections]
        for idx in order:
            detections.append(
                {
                    "class_id": int(cls[idx]),
                    "species": names[int(cls[idx])],
                    "confidence": round(float(confs[idx]), 4),
                    "bbox": [round(float(v), 1) for v in xyxy[idx]],
                }
            )

    counts: dict[str, int] = {}
    for detection in detections:
        counts[detection["species"]] = counts.get(detection["species"], 0) + 1

    height, width = image_bgr.shape[:2]
    image_b64 = None
    if draw and result is not None:
        annotated = result.plot()
        ok, buf = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        if ok:
            image_b64 = base64.b64encode(buf.tobytes()).decode()

    return {
        "model": get_model_name(),
        "imgsz": DEFAULT_IMGSZ,
        "detections": detections,
        "counts": counts,
        "total": len(detections),
        "inference_ms": round(inference_ms, 2),
        "image_width": width,
        "image_height": height,
        "image_b64": image_b64,
    }