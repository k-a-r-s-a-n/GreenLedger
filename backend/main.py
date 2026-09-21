"""
GreenLedger - Main FastAPI Application
Coordinates ML inference, carbon tracking, safe optimization, green credits, and Web3 endpoints.
"""

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.ml import router as ml_router
from api.telemetry import router as telemetry_router
from api.carbon import router as carbon_router
from api.optimization import router as optimization_router
from api.credits import router as credits_router
from api.marketplace import router as marketplace_router
from api.badges import router as badges_router
from api.blockchain import router as blockchain_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("GreenLedger.Backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("GreenLedger AI Energy & Carbon Optimization Platform starting up...")
    yield
    logger.info("GreenLedger Platform shutting down.")


app = FastAPI(
    title="GreenLedger Platform API",
    description="AI-driven Windows energy estimation, carbon reduction, green credits, and Web3 badge marketplace.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS — local origins are always available; deployments can provide
# their Vercel URL through VERCEL_FRONTEND_URL or extend CORS_ORIGINS.
configured_origins = os.getenv("CORS_ORIGINS", "")
deployed_frontend_url = os.getenv("VERCEL_FRONTEND_URL", "https://greenledger.vercel.app")
cors_origins = list(dict.fromkeys(
    origin
    for raw_origin in [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        deployed_frontend_url,
        *configured_origins.split(","),
    ]
    for origin in [raw_origin.strip().strip('"')]
    if origin
))
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(ml_router)
app.include_router(telemetry_router)
app.include_router(carbon_router)
app.include_router(optimization_router)
app.include_router(credits_router)
app.include_router(marketplace_router)
app.include_router(badges_router)
app.include_router(blockchain_router)


@app.get("/health")
def root_health():
    return {
        "status": "online",
        "service": "GreenLedger API",
        "version": "1.0.0",
        "environment": os.getenv("ENVIRONMENT", "production")
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
