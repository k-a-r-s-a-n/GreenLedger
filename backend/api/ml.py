"""
GreenLedger - ML API Router
"""

from fastapi import APIRouter, HTTPException
from schemas.models import (
    TelemetryInput,
    PredictionResponse,
    SequencePredictRequest,
    SequencePredictResponse,
)
from services.ml.inference import ml_engine
from services.ml.temporal import temporal_engine

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


@router.post("/predict-sequence", response_model=SequencePredictResponse)
def predict_sequence(req: SequencePredictRequest):
    """Temporal LSTM quantiles (q10/median/q90) for the last window tick."""
    if not temporal_engine.available:
        raise HTTPException(
            status_code=503,
            detail="Temporal model unavailable (torch or artifact missing).",
        )
    try:
        return temporal_engine.predict_window(req.telemetry_window)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/diagnostics")
def get_diagnostics():
    """Returns model performance metrics (R², MAE, RMSE) and training schema."""
    return ml_engine.get_model_diagnostics()
