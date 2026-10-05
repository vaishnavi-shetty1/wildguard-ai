// src/utils/roboflowStream.js

/**
 * Roboflow hosted inference over WebRTC.
 *
 * Streams the browser camera to a Roboflow Workflow and receives the
 * annotated video back on a peer connection, with predictions arriving
 * over a data channel once per processed frame. This is the second
 * inference provider for WildGuard; the bundled YOLO checkpoint that
 * `detectionModel.js` talks to stays available as the default.
 *
 * Configuration comes from Vite env vars (see frontend/README.md):
 *   VITE_ROBOFLOW_API_KEY        required
 *   VITE_ROBOFLOW_WORKSPACE      required, e.g. "vaishnavi-shetty"
 *   VITE_ROBOFLOW_WORKFLOW       required, e.g. "ai-wgdeu"
 *   VITE_ROBOFLOW_IMAGE_INPUT    default "image"
 *   VITE_ROBOFLOW_STREAM_OUTPUT  default "output"; set empty to auto-detect
 *   VITE_ROBOFLOW_DATA_OUTPUT    default "predictions"
 *   VITE_ROBOFLOW_PLAN           default "webrtc-gpu-medium"
 *   VITE_ROBOFLOW_REGION         default "us"
 *   VITE_ROBOFLOW_TIMEOUT        default 3600 (seconds)
 *   VITE_ROBOFLOW_SERVER_URL     default Roboflow serverless
 *
 * The key ships in the client bundle because `connectors.withApiKey`
 * negotiates the peer connection from the browser. Use a restricted key
 * for this Workspace. To keep the key server-side instead, point a
 * backend at `initializeWebrtcWorker` and swap `createConnector` over to
 * `connectors.withProxyUrl(<your endpoint>)` — nothing else changes.
 */

import { resolveClassMeta } from "./detectionModel";

/*
 * The SDK is only needed once someone picks the cloud provider, so it is
 * pulled in on demand instead of sitting in the initial bundle.
 */

let sdkPromise = null;

const loadSdk = () => {
  sdkPromise ??= import("@roboflow/inference-sdk");

  return sdkPromise;
};

const API_KEY =
  import.meta.env.VITE_ROBOFLOW_API_KEY || "";

const WORKSPACE =
  import.meta.env.VITE_ROBOFLOW_WORKSPACE || "";

const WORKFLOW =
  import.meta.env.VITE_ROBOFLOW_WORKFLOW || "";

const IMAGE_INPUT =
  import.meta.env.VITE_ROBOFLOW_IMAGE_INPUT || "image";

const DATA_OUTPUT =
  import.meta.env.VITE_ROBOFLOW_DATA_OUTPUT || "predictions";

const REQUESTED_PLAN =
  import.meta.env.VITE_ROBOFLOW_PLAN || "webrtc-gpu-medium";

const REQUESTED_REGION =
  import.meta.env.VITE_ROBOFLOW_REGION || "us";

const SERVER_URL =
  import.meta.env.VITE_ROBOFLOW_SERVER_URL || "";

const PROCESSING_TIMEOUT = Number(
  import.meta.env.VITE_ROBOFLOW_TIMEOUT || 3600,
);

/*
 * An empty value means "let the server pick", which is what the SDK
 * does with an empty output list. Left unset it defaults to the
 * canonical "output" name so a workflow that does not use it still
 * gets a chance to resolve instead of silently sending no video.
 */
const STREAM_OUTPUT =
  import.meta.env.VITE_ROBOFLOW_STREAM_OUTPUT ?? "output";

export const ROBOFLOW_MODEL_NAME = `Roboflow ${
  WORKFLOW || "workflow"
}`;

/**
 * Roboflow inference is only offered when it is actually configured,
 * so the UI can hide the provider instead of failing on click.
 */
export const isRoboflowConfigured = () =>
  Boolean(API_KEY && WORKSPACE && WORKFLOW);

const createConnector = (connectors) =>
  connectors.withApiKey(
    API_KEY,
    SERVER_URL ? { serverUrl: SERVER_URL } : undefined,
  );

const buildWrtcParams = () => ({
  workspaceName: WORKSPACE,
  workflowId: WORKFLOW,
  imageInputName: IMAGE_INPUT,
  streamOutputNames: STREAM_OUTPUT ? [STREAM_OUTPUT] : [],
  dataOutputNames: [DATA_OUTPUT],
  processingTimeout: PROCESSING_TIMEOUT,
  requestedPlan: REQUESTED_PLAN,
  requestedRegion: REQUESTED_REGION,
});

/**
 * Pull the prediction array out of a data-channel message.
 *
 * A Workflow can wrap its model output in a couple of extra envelopes
 * depending on which output name was requested, so this accepts the
 * raw array, `{ predictions: [...] }`, and either of those nested one
 * level deeper. Returns null when nothing prediction-shaped is found.
 */
const extractPredictions = (serialized) => {
  if (!serialized || typeof serialized !== "object") {
    return null;
  }

  const candidates = [serialized.predictions, serialized];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return { list: candidate, image: serialized.image };
    }

    if (candidate && Array.isArray(candidate.predictions)) {
      return {
        list: candidate.predictions,
        image: candidate.image || serialized.image,
      };
    }
  }

  return null;
};

/**
 * Roboflow reports boxes as centre-x/centre-y/width/height; WildGuard
 * uses top-left/bottom-right. Accept an already-converted bbox too, so
 * a workflow that emits xyxy needs no special handling.
 */
const toXyxy = (prediction) => {
  if (Array.isArray(prediction?.bbox)) {
    return prediction.bbox.map((value) =>
      Math.round(Number(value) * 10) / 10,
    );
  }

  const x = Number(prediction?.x);
  const y = Number(prediction?.y);
  const width = Number(prediction?.width);
  const height = Number(prediction?.height);

  if (![x, y, width, height].every(Number.isFinite)) {
    return null;
  }

  return [x, y, x + width, y + height].map(
    (value) => Math.round(value * 10) / 10,
  );
};

const toConfidence = (value) => {
  const confidence = Number(value);

  if (!Number.isFinite(confidence)) {
    return 0;
  }

  // Some outputs arrive as percentages.
  return confidence > 1 ? confidence / 100 : confidence;
};

/**
 * Convert a Roboflow data-channel message into the WildGuard prediction
 * contract produced by `mapPredictResponse`, so every downstream
 * consumer (notifications, detection log, box overlay) is unchanged.
 *
 * Returns null when the frame held no wildlife, so consumers can treat
 * a null result as "scanned, nothing there" rather than a gap in
 * coverage.
 */
export const mapRoboflowOutput = (message) => {
  const extracted = extractPredictions(
    message?.serialized_output_data,
  );

  if (!extracted) {
    return null;
  }

  const detections = extracted.list
    .map((raw) => {
      const species = String(
        raw?.class ?? raw?.species ?? "",
      )
        .trim()
        .toLowerCase();

      const meta = resolveClassMeta(species);

      if (!meta?.isWildlife) {
        return null;
      }

      return {
        classId: Number.isInteger(raw?.class_id)
          ? raw.class_id
          : null,
        species,
        label: meta.label,
        meta,
        confidence: toConfidence(raw?.confidence),
        bbox: toXyxy(raw),
      };
    })
    .filter((detection) => detection !== null)
    .sort((a, b) => b.confidence - a.confidence);

  const top = detections[0];

  if (!top) {
    return null;
  }

  return {
    species: top.label,
    speciesKey: top.species,
    confidence: top.confidence,
    threatLevel: top.meta.threatLevel,
    description: top.meta.description,
    timestamp: new Date().toISOString(),
    bbox: top.bbox,
    allDetections: detections.map((detection) => ({
      classId: detection.classId,
      species: detection.species,
      label: detection.label,
      confidence: detection.confidence,
      bbox: detection.bbox,
    })),
    imageWidth: Number(extracted.image?.width || 0),
    imageHeight: Number(extracted.image?.height || 0),
    inferenceMs: 0,
    modelName: ROBOFLOW_MODEL_NAME,
  };
};

/**
 * Open a WebRTC session against the configured Workflow.
 *
 * `source` is the camera MediaStream the caller already owns, so the
 * camera is not opened twice. The annotated stream Roboflow returns is
 * handed to `onRemoteStream` for rendering.
 */
export const startRoboflowStream = async ({
  source,
  onPrediction,
  onRemoteStream,
}) => {
  if (!isRoboflowConfigured()) {
    throw new Error(
      "Roboflow inference is not configured. Set VITE_ROBOFLOW_API_KEY, VITE_ROBOFLOW_WORKSPACE and VITE_ROBOFLOW_WORKFLOW.",
    );
  }

  if (!source) {
    throw new Error("A camera stream is required before streaming.");
  }

  const { connectors, webrtc } = await loadSdk();

  const connection = await webrtc.useStream({
    source,
    connector: createConnector(connectors),
    wrtcParams: buildWrtcParams(),
    onData: (message) => {
      if (message?.errors?.length) {
        console.warn(
          "[WildGuard] Roboflow workflow errors:",
          message.errors,
        );
      }

      /*
       * Every processed frame reports in, including frames with no
       * wildlife, so a consumer can tell "clear" apart from "stalled".
       */

      onPrediction?.(mapRoboflowOutput(message));
    },
  });

  try {
    const remoteStream = await connection.remoteStream();

    if (onRemoteStream) {
      onRemoteStream(remoteStream);
    }
  } catch (error) {
    await connection.cleanup().catch(() => {});
    throw error;
  }

  return connection;
};

export const stopRoboflowStream = async (connection) => {
  if (!connection) {
    return;
  }

  try {
    await connection.cleanup();
  } catch (error) {
    console.warn(
      "[WildGuard] Roboflow stream cleanup failed:",
      error?.message,
    );
  }
};