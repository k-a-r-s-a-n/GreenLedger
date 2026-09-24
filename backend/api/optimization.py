"""
GreenLedger - Optimization API Router
"""

from typing import List
from fastapi import APIRouter, HTTPException
from schemas.models import (
    OptimizationRecommendation,
    BeforeAfterComparison,
    TelemetryInput,
    DeltaEvaluationRequest
)
from services.optimization.engine import (
    optimization_service,
    CooldownActiveError,
    DuplicateSubmissionError,
    UnknownActionError,
    COOLDOWN_SECONDS
)

router = APIRouter(prefix="/api/optimization", tags=["Optimization"])


@router.post("/recommendations", response_model=List[OptimizationRecommendation])
def get_recommendations(telemetry: TelemetryInput):
    """
    Analyzes telemetry and returns actionable, safe optimization opportunities.
    Body is the raw telemetry payload (agent or demo format).
    """
    return optimization_service.analyze_telemetry_for_recommendations(telemetry.model_dump())


@router.post("/evaluate-delta", response_model=BeforeAfterComparison)
def evaluate_optimization_delta(req: DeltaEvaluationRequest):
    """
    Evaluates before vs after telemetry using XGBoost predictions.
    Validates anti-abuse conditions and awards Green Credits for genuine reductions.

    Errors:
    - 422: non-live telemetry, unknown action, identical snapshots, duplicate submission
    - 429: cooldown active between cycles
    - 503: power model unavailable
    """
    try:
        return optimization_service.evaluate_before_after(
            action_id=req.action_id,
            before_telemetry=req.before_telemetry,
            after_telemetry=req.after_telemetry,
            user_id=req.user_id,
            before_window=req.before_window,
            after_window=req.after_window
        )
    except CooldownActiveError as exc:
        raise HTTPException(
            status_code=429,
            detail=str(exc),
            headers={"Retry-After": str(COOLDOWN_SECONDS)}
        ) from exc
    except (UnknownActionError, DuplicateSubmissionError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc