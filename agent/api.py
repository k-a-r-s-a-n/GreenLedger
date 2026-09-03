"""
GreenLedger - Local Windows Telemetry Agent Server
FastAPI HTTP & WebSocket service running on http://127.0.0.1:8765.
Provides hardware metrics to the Web Dashboard and executes verified optimizations.
"""

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import AGENT_HOST, AGENT_PORT, AGENT_POLL_INTERVAL
from collector import collector_service
from optimizer import optimizer_instance

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("GreenLedger.AgentAPI")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting GreenLedger Windows Telemetry Agent...")
    collector_service.start()
    yield
    # Shutdown
    logger.info("Shutting down GreenLedger Windows Telemetry Agent...")
    collector_service.stop()


app = FastAPI(
    title="GreenLedger Local Windows Telemetry Agent",
    description="Provides real-time hardware telemetry and safe device optimization for GreenLedger.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Next.js frontend (local dev and production Vercel)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Localhost daemon accepts connection from local browser
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class OptimizationRequest(BaseModel):
    action_id: str
    params: Optional[Dict[str, Any]] = None


class UndoRequest(BaseModel):
    action_id: str


@app.get("/health")
def health_check():
    return {
        "status": "online",
        "agent": "GreenLedger Windows Native Agent",
        "version": "1.0.0",
        "platform": "Windows",
        "poll_interval_sec": AGENT_POLL_INTERVAL
    }


@app.get("/telemetry")
def get_telemetry():
    """Returns the latest real-time telemetry snapshot."""
    return collector_service.get_latest()


@app.get("/telemetry/history")
def get_telemetry_history():
    """Returns rolling buffer history for rendering chart initial state."""
    return collector_service.get_history()


@app.websocket("/telemetry/stream")
async def stream_telemetry(websocket: WebSocket):
    """Real-time WebSocket streaming telemetry data every poll interval."""
    await websocket.accept()
    logger.info(f"WebSocket client connected from {websocket.client.host}")
    try:
        while True:
            data = collector_service.get_latest()
            await websocket.send_text(json.dumps(data))
            await asyncio.sleep(AGENT_POLL_INTERVAL)
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected: {websocket.client.host}")
    except Exception as e:
        logger.error(f"WebSocket streaming error: {e}")


@app.get("/optimization/recommendations")
def get_recommendations():
    """Returns real-time optimization opportunities for the current machine state."""
    return optimizer_instance.get_optimization_recommendations()


@app.post("/optimization/execute")
def execute_optimization(req: OptimizationRequest):
    """Executes a user-approved safe optimization action."""
    result = optimizer_instance.execute_action(req.action_id, req.params)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Execution failed"))
    return result


@app.post("/optimization/undo")
def undo_optimization(req: UndoRequest):
    """Reverses an optimization action where supported."""
    result = optimizer_instance.undo_action(req.action_id)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Undo failed"))
    return result


if __name__ == "__main__":
    logger.info(f"Launching GreenLedger Local Agent on http://{AGENT_HOST}:{AGENT_PORT}")
    uvicorn.run("api:app", host=AGENT_HOST, port=AGENT_PORT, reload=False)
