import asyncio
import json
import logging
from typing import Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages active WebSocket connections for the live dashboard.

    All connected clients receive a broadcast whenever a new detection
    arrives, so the dashboard stays in sync without polling.
    """

    def __init__(self) -> None:
        self._connections: list[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._connections.append(ws)
        logger.info("Dashboard client connected (total: %d)", len(self._connections))

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._connections = [c for c in self._connections if c is not ws]
        logger.info("Dashboard client disconnected (total: %d)", len(self._connections))

    async def broadcast(self, data: dict[str, Any]) -> None:
        """Send a JSON payload to every connected dashboard client."""
        payload = json.dumps(data, default=str)
        dead: list[WebSocket] = []

        async with self._lock:
            targets = list(self._connections)

        for ws in targets:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)

        for ws in dead:
            await self.disconnect(ws)

    @property
    def active_connections(self) -> int:
        return len(self._connections)


# Module-level singleton — imported by the router
manager = ConnectionManager()
