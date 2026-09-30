// src/utils/wildlifeDetection.js

/**
 * Wildlife prediction.
 *
 * This module is kept as a thin compatibility shim so existing
 * imports keep working. The actual detection logic now lives in
 * `detectionModel.js`, which sends frames to the backend YOLO
 * checkpoint (`POST /api/v1/ai/predict`) for real inference.
 */

export {
  predictWildlife,
  runDetection,
  getModelInfo,
  DETECTION_SPECIES,
  getSpeciesMeta,
} from "./detectionModel";
