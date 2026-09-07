import {
  createWildlifePredictionNotification,
} from "./wildlifePrediction";
import { postDetection, getThreatLevel } from "../api";

const THREAT_TO_SPECIES = {
  HIGH: "elephant",
  MEDIUM: "tiger",
  LOW: "unknown",
};

export const handleWildlifePrediction = async ({
  prediction,
  cameraState,
  setDetectionLogs,
  addNotification,
}) => {
  if (!prediction) {
    return;
  }

  const timestamp =
    prediction.timestamp ||
    new Date().toISOString();

  const predicateId = prediction.id || "";
  const predictionId =
    predicateId ||
    `${Date.now()}-${Math.random()}`;

  /*
   * Normalize the prediction for the backend.
   */
  const species =
    mapThreatToSpecies(
      prediction.threatLevel
    );

  /*
   * Try to persist to the backend.
   *
   * On success, use the real server response;
   * otherwise keep the local prediction.
   */
  let resolvedId = predictionId;
  let resolvedSpecies =
    prediction.species || "Unknown Wildlife";
  let confidence =
    Number(prediction.confidence || 0);
  let level =
    prediction.threatLevel || getThreatLevel(species, confidence);

  try {
    const ack = await postDetection({
      species,
      confidence: Math.min(Math.max(confidence, 0), 1),
      device_id:
        prediction.deviceId ||
        cameraState?.cameraName ||
        "web-client",
    });

    resolvedId = ack.id;
  } catch (error) {
    console.warn(
      "Backend unreachable — keeping local prediction:",
      error.message
    );
  }

  /*
   * Create detection log
   */
  const detectionLog = {
    id: resolvedId,
    animal: resolvedSpecies,
    species: resolvedSpecies,
    confidence: `${Math.round(confidence * 100)}%`,
    confidenceValue: confidence,
    level,
    threatLevel: level,
    location: prediction.location || "Web camera feed",
    cameraName:
      prediction.cameraName ||
      cameraState?.cameraName ||
      "AI Camera",
    timestamp,
    date: new Date(timestamp).toLocaleDateString(),
    time: new Date(timestamp).toLocaleTimeString(),
  };

  setDetectionLogs((current) =>
    [
      detectionLog,
      ...current,
    ].slice(0, 500)
  );

  /*
   * Create notification from the SAME prediction.
   */
  const notification =
    createWildlifePredictionNotification({
      ...prediction,
      id: resolvedId,
      timestamp,
    });

  addNotification(notification);
};

const mapThreatToSpecies = (threatLevel) => {
  const key = (threatLevel || "LOW").toUpperCase();
  return THREAT_TO_SPECIES[key] || "unknown";
};
