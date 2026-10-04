// src/utils/teachableMachine.js
// Client-side inference using Teachable Machine Image model
// Model URL: https://teachablemachine.withgoogle.com/models/CjCpX7yev/

let tmModel = null;
let tmMaxPredictions = 0;
let tmLoaded = false;
let tmLoadPromise = null;

const TM_MODEL_URL = "https://teachablemachine.withgoogle.com/models/CjCpX7yev/";

// Classifier probabilities are always non-zero for every class, so a bare
// "top of the list" pick reports the highest-scoring class even when the
// model is unconfident. Anything below this is treated as no detection.
const TM_MIN_CONFIDENCE = 0.6;

// Parallel in-flight tracking per global, so two callers starting up
// together share one tag rather than injecting the script twice.
const scriptPromises = new Map();

const loadScript = (src, globalName) => {
  if (window[globalName]) return Promise.resolve();
  if (scriptPromises.has(src)) return scriptPromises.get(src);

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () =>
      reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  }).catch((error) => {
    // Allow a later retry after a transient network failure.
    scriptPromises.delete(src);
    throw error;
  });

  scriptPromises.set(src, promise);
  return promise;
};

export const loadTeachableMachineModel = async () => {
  if (tmLoaded) return { model: tmModel, maxPredictions: tmMaxPredictions };
  if (tmLoadPromise) return tmLoadPromise;

  tmLoadPromise = (async () => {
    if (typeof window === "undefined") {
      throw new Error("Teachable Machine requires browser environment");
    }

    await loadScript(
      "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js",
      "tf"
    );
    await loadScript(
      "https://cdn.jsdelivr.net/npm/@teachablemachine/image@latest/dist/teachablemachine-image.min.js",
      "tmImage"
    );

    const modelURL = TM_MODEL_URL + "model.json";
    const metadataURL = TM_MODEL_URL + "metadata.json";

    const model = await window.tmImage.load(modelURL, metadataURL);
    tmModel = model;
    tmMaxPredictions = model.getTotalClasses();
    tmLoaded = true;
    return { model, maxPredictions: tmMaxPredictions };
  })();

  try {
    return await tmLoadPromise;
  } catch (err) {
    tmLoadPromise = null;
    throw err;
  }
};

export const predictFromElement = async (element) => {
  if (!element) return null;
  const { model } = await loadTeachableMachineModel();
  const predictions = await model.predict(element);
  return predictions || [];
};

export const predictFromVideo = async (videoElement) => {
  if (!videoElement || !videoElement.videoWidth || !videoElement.videoHeight) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

  const predictions = await predictFromElement(canvas);
  if (!predictions.length) return null;

  const detections = predictions
    .map((p) => ({
      species: String(p.className || "").trim().toLowerCase(),
      confidence: typeof p.probability === "number" ? p.probability : 0,
    }))
    .sort((a, b) => b.confidence - a.confidence);

  const top = detections[0];
  if (!top || top.confidence < TM_MIN_CONFIDENCE) return null;

  return {
    top,
    detections,
    imageWidth: canvas.width,
    imageHeight: canvas.height,
  };
};
