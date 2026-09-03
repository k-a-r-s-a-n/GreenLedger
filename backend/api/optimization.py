"""
GreenLedger - Optimization API Router
"""

from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from schemas.models import OptimizationRecommendation, BeforeAfterComparison, TelemetryInput
from services.optimization.engine import optimization_service

router = APIRouter(prefix="/api/optimization", tags=["Optimization"])


class DeltaEvaluationRequest(BaseModel):
    action_id: str
    before_telemetry: Dict[str, Any]
    after_telemetry: Dict[str, Any]
    user_id: str = "default_user"


@router.post("/recommendations", response_model=List[OptimizationRecommendation])
def get_recommendations(telemetry: Dict[str, Any]):
    """Analyzes telemetry and returns actionable, safe optimization opportunities."""
    return optimization_service.analyze_telemetry_for_recommendations(telemetry)


@router.post("/evaluate-delta", response_model=BeforeAfterComparison)
def evaluate_optimization_delta(req: DeltaEvaluationRequest):
    """
    Evaluates before vs after telemetry using XGBoost predictions.
    Validates anti-abuse conditions and awards Green Credits for genuine reductions.
    """
    try:
        return optimization_service.evaluate_before_after(
            action_id=req.action_id,
            before_telemetry=req.before_telemetry,
            after_telemetry=req.after_telemetry,
            user_id=req.user_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
