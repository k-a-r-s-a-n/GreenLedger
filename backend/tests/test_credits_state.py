"""
GreenLedger - Green Credits State Regression Tests
Covers streak progression, per-user badge isolation, and the wallet mint ledger.
"""

import pytest
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from services.credits.rewards import GreenCreditService


@pytest.fixture()
def service():
    """Fresh in-memory service per test so state never leaks between cases."""
    return GreenCreditService()


def _iso(days_ago: int) -> str:
    return (datetime.now(timezone.utc).date() - timedelta(days=days_ago)).isoformat()


def _set_last_optimization_date(service, user_id: str, iso_date: str):
    service._ensure_user(user_id)["last_optimization_date"] = iso_date


def test_new_user_gets_welcome_balance(service):
    state = service.get_user_state("brand_new_user")
    assert state.credit_balance == 100


def test_participation_does_not_extend_streak_or_count(service):
    """Anti-farming: sub-threshold cycles award points but no streak/count."""
    earned = service.award_participation(user_id="p1")
    assert earned == 5
    state = service.get_user_state("p1")
    assert state.current_streak_days == 0
    assert state.total_optimizations == 0
    assert state.credit_balance == 105  # welcome 100 + 5


def test_streak_starts_at_one_on_first_cycle(service):
    service.calculate_optimization_reward("test_action", reduction_pct=10.0, co2_saved_g=5.0, user_id="s1")
    assert service.get_user_state("s1").current_streak_days == 1


def test_streak_increments_on_consecutive_days(service):
    user_id = "s2"
    u = service._ensure_user(user_id)
    u["current_streak_days"] = 1
    u["last_optimization_date"] = _iso(1)  # yesterday
    service.calculate_optimization_reward("test_action", reduction_pct=10.0, co2_saved_g=5.0, user_id=user_id)
    assert service.get_user_state(user_id).current_streak_days == 2


def test_streak_resets_after_gap(service):
    user_id = "s3"
    u = service._ensure_user(user_id)
    u["current_streak_days"] = 5
    u["last_optimization_date"] = _iso(8)  # a week+ ago
    service.calculate_optimization_reward("test_action", reduction_pct=10.0, co2_saved_g=5.0, user_id=user_id)
    assert service.get_user_state(user_id).current_streak_days == 1


def test_same_day_cycle_does_not_extend_streak(service):
    user_id = "s4"
    service.calculate_optimization_reward("test_action", reduction_pct=10.0, co2_saved_g=5.0, user_id=user_id)
    service.calculate_optimization_reward("test_action", reduction_pct=12.0, co2_saved_g=6.0, user_id=user_id)
    assert service.get_user_state(user_id).current_streak_days == 1


def test_efficiency_master_unlocks_at_three_day_streak(service):
    user_id = "s5"
    service.calculate_optimization_reward("test_action", reduction_pct=10.0, co2_saved_g=5.0, user_id=user_id)  # day 1 -> streak 1
    # Pretend day 2 happened yesterday, then run day 2's cycle today.
    u = service._ensure_user(user_id)
    u["last_optimization_date"] = _iso(1)
    service.calculate_optimization_reward("test_action", reduction_pct=10.0, co2_saved_g=5.0, user_id=user_id)  # streak 2
    # Pretend day 3 happened yesterday, then run day 3's cycle today.
    u["last_optimization_date"] = _iso(1)
    service.calculate_optimization_reward("test_action", reduction_pct=10.0, co2_saved_g=5.0, user_id=user_id)  # streak 3

    badges = {b.id: b for b in service.get_all_badges(user_id)}
    assert badges["badge_efficiency_master"].is_unlocked is True


def test_badge_unlock_state_is_per_user(service):
    service.purchase_badge("badge_green_guardian", "rich_user")  # 100 balance < 2500 -> fails
    # Give the user enough credits, then purchase.
    service._ensure_user("rich_user")["credit_balance"] = 3000
    res = service.purchase_badge("badge_green_guardian", "rich_user")
    assert res["success"] is True

    rich = {b.id: b for b in service.get_all_badges("rich_user")}
    poor = {b.id: b for b in service.get_all_badges("poor_user")}
    assert rich["badge_green_guardian"].is_unlocked is True
    assert poor["badge_green_guardian"].is_unlocked is False


def test_purchase_deducts_credits_and_records_transaction(service):
    service._ensure_user("buyer")["credit_balance"] = 600
    res = service.purchase_badge("badge_carbon_cutter", "buyer")  # 500 credits
    assert res["success"] is True
    state = service.get_user_state("buyer")
    assert state.credit_balance == 100
    assert any(t["type"] == "marketplace_purchase" for t in state.recent_transactions)


def test_double_purchase_rejected(service):
    service._ensure_user("owner")["credit_balance"] = 3000
    assert service.purchase_badge("badge_green_guardian", "owner")["success"] is True
    res = service.purchase_badge("badge_green_guardian", "owner")
    assert res["success"] is False
    assert "already own" in res["error"]


def test_mint_ledger_is_wallet_scoped(service):
    wallet_a = "0x1111111111111111111111111111111111111111"
    wallet_b = "0x2222222222222222222222222222222222222222"
    service._ensure_user("u1")["credit_balance"] = 3000
    service.purchase_badge("badge_green_guardian", "u1")

    service.record_on_chain_mint("badge_green_guardian", "0x" + "ab" * 32, "u1", wallet_a)
    assert service.is_badge_minted_for_wallet(wallet_a, "badge_green_guardian") is True
    assert service.is_badge_minted_for_wallet(wallet_b, "badge_green_guardian") is False

    badges = {b.id: b for b in service.get_all_badges("u1")}
    assert badges["badge_green_guardian"].minted_on_chain is True
    assert badges["badge_green_guardian"].tx_hash == "0x" + "ab" * 32