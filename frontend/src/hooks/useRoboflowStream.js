import { useCallback, useEffect, useRef, useState } from "react";
import {
  isRoboflowConfigured,
  startRoboflowStream,
  stopRoboflowStream,
} from "../utils/roboflowStream";

const DEFAULT_COOLDOWN_MS = 10000;

/**
 * Keeps a steady stream from turning into an alert flood.
 *
 * Roboflow reports on every processed frame, but each report becomes a
 * persisted detection plus a dashboard notification, so passing them
 * straight through would log the same elephant dozens of times a second.
 * A change of species (including a drop to no wildlife) always gets
 * through; a repeat has to wait out the cooldown.
 */
const createPredictionGate = (cooldownMs) => {
  let lastSpecies = null;
  let lastEmittedAt = 0;

return {
      allow(prediction) {
        const now = Date.now();
        const speciesKey = prediction?.speciesKey || "none";

        if (speciesKey !== lastSpecies) {
          lastSpecies = speciesKey;
          lastEmittedAt = now;
          return true;
        }

        if (now - lastEmittedAt >= cooldownMs) {
          lastEmittedAt = now;
          return true;
        }

        return false;
      },
    reset() {
      lastSpecies = null;
      lastEmittedAt = 0;
    },
  };
};

export const useRoboflowStream = ({
  enabled = false,
  source = null,
  cooldownMs = DEFAULT_COOLDOWN_MS,
  onPrediction,
  onRemoteStream,
} = {}) => {
  const connectionRef = useRef(null);
  const gateRef = useRef(null);
  const onPredictionRef = useRef(onPrediction);
  const onRemoteStreamRef = useRef(onRemoteStream);

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    onPredictionRef.current = onPrediction;
    onRemoteStreamRef.current = onRemoteStream;
  }, [onPrediction, onRemoteStream]);

  const stop = useCallback(async () => {
    const connection = connectionRef.current;
    connectionRef.current = null;

    if (!connection) {
      return;
    }

    setStatus("idle");
    gateRef.current?.reset();
    await stopRoboflowStream(connection);
  }, []);

  useEffect(() => {
    if (!enabled || !source) {
      stop();
      return undefined;
    }

    let cancelled = false;

    const connect = async () => {
      setStatus("connecting");
      setError("");

      // Built before connecting: predictions can arrive over the data
      // channel before useStream() has resolved.
      const gate = createPredictionGate(cooldownMs);
      gateRef.current = gate;

      try {
        const connection = await startRoboflowStream({
          source,
          onPrediction: (prediction) => {
            if (gate.allow(prediction)) {
              onPredictionRef.current?.(prediction);
            }
          },
          onRemoteStream: (remoteStream) => {
            if (!cancelled) {
              setStatus("streaming");
              onRemoteStreamRef.current?.(remoteStream);
            }
          },
        });

        if (cancelled) {
          await stopRoboflowStream(connection);
          return;
        }

        connectionRef.current = connection;
      } catch (connectionError) {
        if (cancelled) return;

        connectionRef.current = null;
        setStatus("error");
        setError(
          connectionError?.message ||
            "Unable to start the Roboflow stream.",
        );
      }
    };

    connect();

    return () => {
      cancelled = true;
      stop();
    };
  }, [enabled, source, cooldownMs, stop]);

  return {
    status,
    error,
    stop,
    supported: isRoboflowConfigured(),
    isStreaming: status === "streaming",
  };
};