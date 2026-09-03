"""
GreenLedger - ML API Router
"""

from fastapi import APIRouter, HTTPException
from schemas.models import TelemetryInput, PredictionResponse
from services.ml.inference import ml_engine

router = APIRouter(prefix="/api/ml", tags=["Machine Learning"])


@router.post("/predict", response_model=PredictionResponse)
def predict_power(telemetry: TelemetryInput):
    """Executes XGBoost inference to estimate hardware power consumption."""
    try:
        return ml_engine.predict_power(telemetry.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/diagnostics")
def get_diagnostics():
    """Returns model performance metrics (R², MAE, RMSE) and training schema."""
    return ml_engine.get_model_diagnostics()
