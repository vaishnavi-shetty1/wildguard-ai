// src/utils/wildlifeDetection.js

/**
 * Wildlife prediction result
 *
 * Replace predictWildlife() with your actual AI model/API.
 */

const SPECIES = [
  {
    name: "Elephant",
    confidence: 0.92,
    threatLevel: "HIGH",
  },
  {
    name: "Leopard",
    confidence: 0.89,
    threatLevel: "HIGH",
  },
  {
    name: "Wild Boar",
    confidence: 0.84,
    threatLevel: "MEDIUM",
  },
  {
    name: "Deer",
    confidence: 0.91,
    threatLevel: "LOW",
  },
  {
    name: "Unknown Wildlife",
    confidence: 0.72,
    threatLevel: "MEDIUM",
  },
];

/**
 * DEMO prediction.
 *
 * IMPORTANT:
 * This is only a placeholder.
 *
 * Connect your trained AI model here later.
 */
export const predictWildlife = async (videoElement) => {
  if (!videoElement) {
    return null;
  }

  /*
   * ---------------------------------------------------------
   * PLACEHOLDER
   * ---------------------------------------------------------
   *
   * Your real model should return something like:
   *
   * {
   *   species: "Elephant",
   *   confidence: 0.94,
   *   threatLevel: "HIGH"
   * }
   *
   * Example backend:
   *
   * const response = await fetch("/api/predict", {
   *   method: "POST",
   *   body: frameBlob
   * });
   *
   * return await response.json();
   *
   * ---------------------------------------------------------
   */

  await new Promise((resolve) =>
    setTimeout(resolve, 150)
  );

  // Don't generate a prediction every frame.
  // Random demo detection.
  const shouldDetect = Math.random() > 0.65;

  if (!shouldDetect) {
    return null;
  }

  const prediction =
    SPECIES[
      Math.floor(Math.random() * SPECIES.length)
    ];

  return {
    species: prediction.name,
    confidence: prediction.confidence,
    threatLevel: prediction.threatLevel,
    timestamp: new Date().toISOString(),
  };
};