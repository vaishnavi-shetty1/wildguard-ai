import {
  createWildlifePredictionNotification,
} from "./wildlifePrediction";

export const handleWildlifePrediction = ({
  prediction,
  cameraState,
  setDetectionLogs,
  addNotification,
}) => {
  if (!prediction) {
    return;
  }

  /*
   * Create one ID so the detection log
   * and notification refer to the same event.
   */
  const predictionId =
    prediction.id ||
    `${Date.now()}-${Math.random()}`;

  const timestamp =
    prediction.timestamp ||
    new Date().toISOString();

  /*
   * Create detection log
   */
  const detectionLog = {
    id: predictionId,

    animal:
      prediction.species ||
      "Unknown Wildlife",

    species:
      prediction.species ||
      "Unknown Wildlife",

    confidence:
      `${Math.round(
        Number(prediction.confidence || 0) * 100
      )}%`,

    confidenceValue:
      Number(prediction.confidence || 0),

    level:
      prediction.threatLevel ||
      "LOW",

    threatLevel:
      prediction.threatLevel ||
      "LOW",

    location:
      prediction.location ||
      "Unknown Location",

    cameraName:
      prediction.cameraName ||
      cameraState?.cameraName ||
      "AI Camera",

    timestamp,

    date:
      new Date(timestamp).toLocaleDateString(),

    time:
      new Date(timestamp).toLocaleTimeString(),
  };

  /*
   * Add prediction to detection history.
   */
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
      id: predictionId,
      timestamp,
    });

  /*
   * This triggers:
   *
   * 1. Notification drawer
   * 2. Notification toast
   * 3. Notification sound
   */
  addNotification(notification);
};