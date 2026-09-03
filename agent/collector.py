"""
GreenLedger - Background Telemetry Collector Service
Maintains real-time telemetry sampling loop and short-term rolling buffer.
"""

import time
import threading
import logging
from collections import deque
from typing import Dict, Any, List, Optional

from windows_metrics import collect_full_telemetry
from config import AGENT_POLL_INTERVAL

logger = logging.getLogger("GreenLedger.Collector")


class TelemetryCollectorService:
    def __init__(self, buffer_size: int = 120):
        self.buffer_size = buffer_size
        self._history = deque(maxlen=buffer_size)
        self._latest_snapshot: Optional[Dict[str, Any]] = None
        self._lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None

    def start(self):
        """Starts background collection thread."""
        if self._running:
            return
        self._running = True
        # Take initial reading immediately
        initial = collect_full_telemetry()
        with self._lock:
            self._latest_snapshot = initial
            self._history.append(initial)

        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        logger.info(f"Telemetry Collector started (Sampling interval: {AGENT_POLL_INTERVAL}s)")

    def stop(self):
        """Stops background collection thread."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=2.0)
        logger.info("Telemetry Collector stopped.")

    def _run_loop(self):
        while self._running:
            try:
                data = collect_full_telemetry()
                with self._lock:
                    self._latest_snapshot = data
                    self._history.append(data)
            except Exception as e:
                logger.error(f"Error during telemetry sampling: {e}")
            time.sleep(AGENT_POLL_INTERVAL)

    def get_latest(self) -> Dict[str, Any]:
        """Returns the most recent telemetry snapshot."""
        with self._lock:
            if self._latest_snapshot is None:
                return collect_full_telemetry()
            return self._latest_snapshot

    def get_history(self) -> List[Dict[str, Any]]:
        """Returns buffered rolling history."""
        with self._lock:
            return list(self._history)


# Global singleton collector
collector_service = TelemetryCollectorService()
