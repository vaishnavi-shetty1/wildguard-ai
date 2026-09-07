// src/utils/detectionModel.js

/**
 * WildGuard Unified Detection Model
 *
 * Recognizes three target species: elephant, tiger, and leopard.
 *
 * This is a demonstration model. It simulates an on-device ML
 * classifier (e.g. YOLO / Teachable Machine / TensorFlow.js)
 * that returns one of the three species with a confidence score
 * and an appropriate threat level.
 *
 * Replace `runDetection()` internals with your real trained model
 * later — the output contract stays the same.
 */

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

const MODEL_WEIGHTS = [
  [
    DETECTION_SPECIES.elephant,
    0.62, // probability weight
    0.94, // typical confidence
  ],
  [
    DETECTION_SPECIES.tiger,
    0.21, // probability weight
    0.91, // typical confidence
  ],
  [
    DETECTION_SPECIES.leopard,
    0.17, // probability weight
    0.88, // typical confidence
  ],
];

/**
 * Simulated inference.
 *
 * Sometimes returns null to represent frames where no target
 * species was present (model saw nothing / background only).
 */
export const runDetection = async () => {
  // Simulate inference latency.
  await new Promise((resolve) =>
    setTimeout(resolve, 150)
  );

  // ~35% of scans find one of the three species.
  const shouldDetect = Math.random() > 0.65;

  if (!shouldDetect) {
    return null;
  }

  const totalWeight = MODEL_WEIGHTS.reduce(
    (sum, item) => sum + item[1],
    0
  );

  let roll = Math.random() * totalWeight;

  for (const [species, weight, baseConfidence] of MODEL_WEIGHTS) {
    roll -= weight;
    if (roll <= 0) {
      // Small jitter so confidence is not identical every scan.
      const jitter = (Math.random() - 0.5) * 0.06;
      const confidence = Math.max(
        0.7,
        Math.min(0.99, baseConfidence + jitter)
      );

      return {
        species: species.label,
        speciesKey: species.key,
        confidence,
        threatLevel: species.threatLevel,
        description: species.description,
        timestamp: new Date().toISOString(),
      };
    }
  }

  return null;
};

/**
 * Live Monitor entry point.
 *
 * Predicts the species visible in the supplied video element using
 * the unified detection model. Returns null when nothing is detected.
 */
export const predictWildlife = async (videoElement) => {
  if (!videoElement) {
    return null;
  }

  return runDetection();
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
