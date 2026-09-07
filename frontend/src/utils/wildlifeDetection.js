// src/utils/wildlifeDetection.js

/**
 * Wildlife prediction.
 *
 * This module is kept as a thin compatibility shim so existing
 * imports keep working. The actual detection logic now lives in
 * `detectionModel.js`, which recognizes elephant, tiger, and leopard.
 *
 * Replace `runDetection()` in detectionModel.js with your real
 * trained AI model later — the output contract stays the same.
 */

export { predictWildlife, runDetection, DETECTION_SPECIES, getSpeciesMeta } from "./detectionModel";
