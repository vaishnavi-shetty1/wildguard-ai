import base64
import os
import threading
import time
from pathlib import Path

import numpy as np
import cv2
from ultralytics import YOLO

from .species_classifier import available as species_model_available
from .species_classifier import classify_crop_bgr

MODEL_DIR = Path(__file__).resolve().parent / "models"
DEFAULT_MODEL_PATH = str(MODEL_DIR / "best.pt")
PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_IMGSZ = 640

TARGET_SPECIES = ("elephant", "tiger", "leopard")

_lock = threading.Lock()
_model = None
_model_path = None


def _resolve_model_path() -> str:
    configured = (os.getenv("WILDLIFE_MODEL_PATH") or "").strip()
    if not configured:
        return DEFAULT_MODEL_PATH
    path = Path(configured).expanduser()
    if path.is_absolute():
        return str(path)
    # A relative WILDLIFE_MODEL_PATH is ambiguous: the server may be started from
    # the repo root (backend.app.main:app) or from backend/ (app.main:app).
    # Resolve against the repo root first, then the current working directory.
    for base in (PROJECT_ROOT, Path.cwd()):
        candidate = base / path
        if candidate.is_file():
            return str(candidate)
    return str(PROJECT_ROOT / path)


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
    height, width = image_bgr.shape[:2]

    if result is not None and result.boxes is not None and len(result.boxes) > 0:
        xyxy = result.boxes.xyxy.cpu().numpy()
        cls = result.boxes.cls.cpu().numpy().astype(int)
        confs = result.boxes.conf.cpu().numpy()

        refine = species_model_available()
        order = confs.argsort()[::-1][:max_detections]
        for idx in order:
            box = [round(float(v), 1) for v in xyxy[idx]]
            species = str(names[int(cls[idx])]).strip().lower()
            confidence = round(float(confs[idx]), 4)
            class_id = int(cls[idx])

            if refine:
                x1, y1, x2, y2 = map(int, box)
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(width, x2), min(height, y2)
                if x2 > x1 and y2 > y1:
                    refined = classify_crop_bgr(image_bgr[y1:y2, x1:x2])
                    species = refined["species"]
                    confidence = refined["confidence"]
                    class_id = ["elephant", "tiger", "leopard"].index(species)

            detections.append(
                {
                    "class_id": class_id,
                    "species": species,
                    "confidence": confidence,
                    "bbox": box,
                }
            )

    counts: dict[str, int] = {}
    for detection in detections:
        counts[detection["species"]] = counts.get(detection["species"], 0) + 1

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

