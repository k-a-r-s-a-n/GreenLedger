"""
GreenLedger - Green Credits & User State API Router
"""

from fastapi import APIRouter
from schemas.models import GreenCreditState
from services.credits.rewards import credit_service

router = APIRouter(prefix="/api/credits", tags=["Green Credits"])


@router.get("/state", response_model=GreenCreditState)
def get_user_credit_state(user_id: str = "default_user"):
    """Returns current user Green Credit balance, streak, lifetime CO2 prevented, and history."""
    return credit_service.get_user_state(user_id)
