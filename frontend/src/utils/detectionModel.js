// src/utils/detectionModel.js

/**
 * WildGuard Unified Detection Model
 *
 * Recognizes the three target species (elephant, tiger, leopard) plus
 * other wildlife classes returned by the YOLO checkpoint.
 *
 * Inference runs on the backend: each frame is captured from the local
 * video element, JPEG-encoded, and POSTed to `/api/v1/ai/predict`, where
 * the bundled Ultralytics model (`models/yolo11n.pt`) performs detection
 * and returns species + confidence + bounding boxes.
 *
 * The output contract below is unchanged from the old demo model, so all
 * existing callers keep working.
 */

import { predictImage, fetchModelInfo } from "../api";
import { predictFromVideo } from "./teachableMachine";

export const DETECTION_SPECIES = {
  elephant: {
    key: "elephant",
    label: "Elephant",
    threatLevel: "HIGH",
    description: "Large pachyderm approaching populated area.",
  },
  tiger: {
    key: "tiger",
    label: "Tiger",
    threatLevel: "CRITICAL",
    description: "Predator detected near human activity.",
  },
  leopard: {
    key: "leopard",
    label: "Leopard",
    threatLevel: "HIGH",
    description: "Predator spotted in the surveillance zone.",
  },
};

/**
 * Metadata for every class the model is expected to output.
 * `isWildlife: false` entries are ignored by the monitoring UI
 * (people, vehicles, etc.) but still counted by the model.
 */
export const CLASS_META = {
  elephant: { label: "Elephant", threatLevel: "HIGH", isWildlife: true, description: "Large pachyderm spotted." },
  tiger: { label: "Tiger", threatLevel: "CRITICAL", isWildlife: true, description: "Predator near human activity." },
  leopard: { label: "Leopard", threatLevel: "HIGH", isWildlife: true, description: "Predator in surveillance zone." },
  bear: { label: "Bear", threatLevel: "HIGH", isWildlife: true, description: "Bear detected in the zone." },
  zebra: { label: "Zebra", threatLevel: "LOW", isWildlife: true, description: "Zebra detected." },
  giraffe: { label: "Giraffe", threatLevel: "LOW", isWildlife: true, description: "Giraffe detected." },
  horse: { label: "Horse", threatLevel: "LOW", isWildlife: true, description: "Horse detected." },
  sheep: { label: "Sheep", threatLevel: "LOW", isWildlife: true, description: "Sheep detected." },
  cow: { label: "Cow", threatLevel: "LOW", isWildlife: true, description: "Cow detected." },
  bird: { label: "Bird", threatLevel: "LOW", isWildlife: true, description: "Bird detected." },
  cat: { label: "Cat", threatLevel: "LOW", isWildlife: true, description: "Cat detected." },
  dog: { label: "Dog", threatLevel: "LOW", isWildlife: true, description: "Dog detected." },
};

/**
 * Classes that are never wildlife, whatever the checkpoint is.
 *
 * This is an exclusion list rather than an inclusion list on purpose: the
 * active checkpoint decides which classes exist, and an inclusion list
 * silently swallows anything it has not been taught about. That made a
 * checkpoint missing `tiger`/`leopard` indistinguishable from an empty
 * frame. Anything the model emits that is not listed here is treated as
 * wildlife, so a custom-trained checkpoint works without frontend changes.
 */
const NON_WILDLIFE_CLASSES = new Set([
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train",
  "truck", "boat", "traffic light", "fire hydrant", "stop sign",
  "parking meter", "bench", "backpack", "umbrella", "handbag", "tie",
  "suitcase", "frisbee", "skis", "snowboard", "sports ball", "kite",
  "baseball bat", "baseball glove", "skateboard", "surfboard",
  "tennis racket", "bottle", "wine glass", "cup", "fork", "knife",
  "spoon", "bowl", "banana", "apple", "sandwich", "orange", "broccoli",
  "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch",
  "potted plant", "bed", "dining table", "toilet", "tv", "laptop",
  "mouse", "remote", "keyboard", "cell phone", "microwave", "oven",
  "toaster", "sink", "refrigerator", "book", "clock", "vase", "scissors",
  "teddy bear", "hair drier", "toothbrush", "toilet_tissue",
]);

/**
 * Resolve display metadata for any class name the model emits.
 *
 * Known species keep their curated threat level and description. Anything
 * else falls back to a neutral wildlife entry so it still reaches the
 * dashboard instead of being dropped.
 */
export const resolveClassMeta = (species) => {
  const key = String(species || "").trim().toLowerCase();
  const known = CLASS_META[key];

  if (known) {
    return known;
  }

  if (!key || NON_WILDLIFE_CLASSES.has(key)) {
    return null;
  }

  return {
    label: key.charAt(0).toUpperCase() + key.slice(1),
    threatLevel: "MEDIUM",
    isWildlife: true,
    description: `${key.charAt(0).toUpperCase() + key.slice(1)} detected by the model.`,
  };
};

// Species that the backend ingestion endpoint accepts (elephant/tiger/leopard).
export const TARGET_SPECIES = new Set(["elephant", "tiger", "leopard"]);

const DEFAULT_MAX_CAPTURE_WIDTH = 960;

/*
 * Model capability is fetched once per page load and cached. The first
 * call has to load the checkpoint on the backend, so repeat callers reuse
 * the resolved value instead of paying that cost again.
 */
let modelInfoPromise = null;

export const getModelInfo = () => {
  if (!modelInfoPromise) {
    modelInfoPromise = fetchModelInfo().catch((error) => {
      // Allow a later retry if the backend was simply not up yet.
      modelInfoPromise = null;
      console.warn("[WildGuard] Could not read model info:", error?.message);
      return null;
    });
  }
  return modelInfoPromise;
};

/**
 * Grab the current video frame as a compressed JPEG data URL.
 * Returns null when the video has no usable frame (camera off, no pixels).
 */
export const captureFrame = (videoElement, maxWidth = DEFAULT_MAX_CAPTURE_WIDTH) => {
  if (!videoElement || !videoElement.videoWidth || !videoElement.videoHeight) {
    return null;
  }
  const sourceWidth = videoElement.videoWidth;
  const sourceHeight = videoElement.videoHeight;
  const scale = Math.min(1, maxWidth / sourceWidth);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sourceWidth * scale);
  canvas.height = Math.round(sourceHeight * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.75);
};

/**
 * Convert the backend /ai/predict response into the WildGuard
 * prediction contract. Returns null when nothing wildlife-related
 * was detected.
 */
export const mapPredictResponse = (response) => {
  const detections = (response?.detections || [])
    .map((d) => ({
      ...d,
      species: String(d.species || "").toLowerCase(),
      meta: resolveClassMeta(d.species),
    }))
    .filter((d) => d.meta?.isWildlife)
    .sort((a, b) => b.confidence - a.confidence);

  const top = detections[0];
  if (!top) {
    return null;
  }

  return {
    species: top.meta.label,
    speciesKey: top.species,
    confidence: top.confidence,
    threatLevel: top.meta.threatLevel,
    description: top.meta.description,
    timestamp: new Date().toISOString(),
    bbox: top.bbox,
    allDetections: detections.map((d) => ({
      classId: d.class_id,
      species: d.species,
      label: d.meta.label,
      confidence: d.confidence,
      bbox: d.bbox,
    })),
    imageWidth: response?.image_width || 0,
    imageHeight: response?.image_height || 0,
    inferenceMs: response?.inference_ms || 0,
    modelName: response?.model || "",
  };
};

/**
 * Run real inference on the current frame of the supplied video element.
 * Returns the prediction contract, or null when the frame is unusable,
 * the backend is unreachable, or no wildlife was detected.
 */
export const runDetection = async (videoElement) => {
  const image = captureFrame(videoElement);
  if (!image) {
    return null;
  }

  let response;
  try {
    response = await predictImage({ image, confidence_threshold: 0.4 });
  } catch (error) {
    console.warn("[WildGuard] Inference backend unreachable:", error?.message);
    return null;
  }

  return mapPredictResponse(response);
};

export const runTeachableDetection = async (videoElement) => {
  try {
    const tmResult = await predictFromVideo(videoElement);
    if (!tmResult?.top) return null;

    const { top, detections, imageWidth, imageHeight } = tmResult;
    const meta = resolveClassMeta(top.species);
    if (!meta?.isWildlife) return null;

    return {
      species: meta.label,
      speciesKey: String(top.species).toLowerCase(),
      confidence: top.confidence,
      threatLevel: meta.threatLevel,
      description: meta.description,
      timestamp: new Date().toISOString(),
      bbox: null,
      allDetections: detections
        .map((d) => {
          const m = resolveClassMeta(d.species);
          if (!m?.isWildlife) return null;
          return {
            classId: null,
            species: String(d.species).toLowerCase(),
            label: m.label,
            confidence: d.confidence,
            bbox: null,
          };
        })
        .filter(Boolean),
      imageWidth,
      imageHeight,
      inferenceMs: 0,
      modelName: "TeachableMachine (Image)",
    };
  } catch (error) {
    console.warn("[WildGuard] Teachable Machine inference failed:", error?.message);
    return null;
  }
};

/**
 * Live Monitor entry point.
 *
 * Predicts the species visible in the supplied video element using the
 * backend YOLO model. Returns null when nothing is detected.
 */
export const predictWildlife = async (videoElement, useTeachable = true) => {
  if (!videoElement) {
    return null;
  }
  if (useTeachable) {
    const tm = await runTeachableDetection(videoElement);
    if (tm) return tm;
    // fallback to backend if TM fails
  }
  return runDetection(videoElement);
};

/**
 * Resolve display metadata for a species key (threat color, label,
 * description). Falls back to a neutral "no threat" entry.
 */
export const getSpeciesMeta = (speciesKey) => {
  return (
    DETECTION_SPECIES[speciesKey] || {
      key: "none",
      label: "No Threat",
      threatLevel: "LOW",
      description: "No wildlife detected.",
    }
  );
};