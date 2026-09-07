import { useEffect, useRef, useState } from "react";
import { getWebSocketUrl } from "../api";

export const useWebSocket = ({ enabled = true, onEvent } = {}) => {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled) return undefined;

    let disposed = false;
    let retryTimer = null;
    let ws = null;

    const connect = () => {
      if (disposed) return;
      ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        if (!disposed) setConnected(true);
      };

      ws.onmessage = (event) => {
        if (disposed) return;
        try {
          const message = JSON.parse(event.data);
          if (message && message.event && onEventRef.current) {
            onEventRef.current(message);
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        if (disposed) return;
        setConnected(false);
        retryTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        if (ws) ws.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (ws) ws.close();
    };
  }, [enabled]);

  return { connected };
};

export default useWebSocket;
