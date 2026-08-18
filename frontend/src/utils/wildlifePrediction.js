export const createWildlifePredictionNotification = (
  prediction
) => {
  const confidence = Number(
    prediction?.confidence || 0
  );

  const species =
    prediction?.species || "Unknown Wildlife";

  const threatLevel =
    prediction?.threatLevel || "LOW";

  return {
    id:
      prediction?.id ||
      `${Date.now()}-${Math.random()}`,

    title: `${species} Detected`,

    message: `AI camera detected ${species} with ${Math.round(
      confidence * 100
    )}% confidence. Threat level: ${threatLevel}.`,

    type:
      threatLevel === "HIGH" ||
      threatLevel === "CRITICAL"
        ? "threat"
        : "ai",

    read: false,

    species,

    confidence,

    threatLevel,

    location:
      prediction?.location ||
      "Unknown Location",

    cameraName:
      prediction?.cameraName ||
      "AI Camera",

    timestamp:
      prediction?.timestamp ||
      new Date().toISOString(),
  };
};