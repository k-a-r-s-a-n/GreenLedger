"""
GreenLedger - Badges API Router
"""

from typing import List
from fastapi import APIRouter
from schemas.models import Badge
from services.credits.rewards import credit_service

router = APIRouter(prefix="/api/badges", tags=["Badges"])


@router.get("/list", response_model=List[Badge])
def list_badges(user_id: str = "default_user"):
    """Returns all badges and the unlock/mint status for the user."""
    return credit_service.get_all_badges(user_id)
