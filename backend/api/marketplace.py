"""
GreenLedger - Marketplace API Router
"""

from typing import Dict, Any
from fastapi import APIRouter, HTTPException
from schemas.models import MarketplacePurchaseRequest
from services.credits.rewards import credit_service

router = APIRouter(prefix="/api/marketplace", tags=["Marketplace"])


@router.get("/catalog")
def get_marketplace_catalog(user_id: str = "default_user"):
    """Returns available digital achievements and collectibles purchasable with Green Credits."""
    badges = credit_service.get_all_badges(user_id)
    user_state = credit_service.get_user_state(user_id)
    return {
        "currency": "Green Credits",
        "user_balance": user_state.credit_balance,
        "items": badges
    }


@router.post("/purchase")
def purchase_item(req: MarketplacePurchaseRequest):
    """Purchases an achievement badge using earned Green Credits."""
    res = credit_service.purchase_badge(req.badge_id, req.user_id or "default_user")
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Purchase failed"))
    return res
