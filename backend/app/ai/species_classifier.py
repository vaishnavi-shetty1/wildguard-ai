"""Species head for elephant / tiger / leopard.

Runs after YOLO boxes. Loads models/wildguard_etl.onnx from MODEL_DIR.
"""

from __future__ import annotations

import json
import threading
from pathlib import Path

import cv2
import numpy as np

MODEL_DIR = Path(__file__).resolve().parent / "models"
ONNX_PATH = MODEL_DIR / "wildguard_etl.onnx"
META_PATH = MODEL_DIR / "wildguard_etl_cls.json"
INPUT_SIZE = 128
CLASSES = ("elephant", "tiger", "leopard")

_lock = threading.Lock()
_session = None
_classes = list(CLASSES)


def _load():
    global _session, _classes
    if _session is not None:
        return _session
    with _lock:
        if _session is not None:
            return _session
        if not ONNX_PATH.is_file():
            raise FileNotFoundError(f"Missing species model: {ONNX_PATH}")
        if META_PATH.is_file():
            meta = json.loads(META_PATH.read_text())
            _classes = list(meta.get("classes") or CLASSES)
        import onnxruntime as ort

        _session = ort.InferenceSession(
            str(ONNX_PATH), providers=["CPUExecutionProvider"]
        )
        return _session


def classify_crop_bgr(crop_bgr: np.ndarray) -> dict:
    """Classify a BGR crop. Returns species, confidence, probs."""
    sess = _load()
    if crop_bgr is None or crop_bgr.size == 0:
        return {"species": "unknown", "confidence": 0.0, "probs": {}}

    rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)
    rgb = cv2.resize(rgb, (INPUT_SIZE, INPUT_SIZE), interpolation=cv2.INTER_LINEAR)
    x = rgb.astype(np.float32) / 255.0
    x = np.transpose(x, (2, 0, 1))[None]  # [1,3,128,128]

    logits = sess.run(None, {"images": x})[0][0]
    logits = logits - logits.max()
    probs = np.exp(logits)
    probs = probs / probs.sum()
    idx = int(probs.argmax())
    return {
        "species": _classes[idx],
        "confidence": round(float(probs[idx]), 4),
        "probs": {c: round(float(probs[i]), 4) for i, c in enumerate(_classes)},
    }


def available() -> bool:
    return ONNX_PATH.is_file()