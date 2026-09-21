"""
GreenLedger - Optimization Safety Regression Tests
Exercises the anti-abuse contract on /api/optimization/evaluate-delta:
whitelist enforcement, cooldown (429), duplicate replay rejection, identical snapshots.
"""

import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from main import app
from services.optimization.engine import optimization_service

client = TestClient(app)


def _live_telemetry(scenario: str = "normal") -> dict:
    """Demo telemetry re-flagged as live (the frontend does the same)."""
    demo = client.get(f"/api/telemetry/demo?scenario={scenario}").json()
    demo["is_live"] = True
    return demo


def _evaluate(user_id: str, before, after, action_id: str = "enable_power_saver"):
    return client.post("/api/optimization/evaluate-delta", json={
        "action_id": action_id,
        "before_telemetry": before,
        "after_telemetry": after,
        "user_id": user_id
    })


def test_recommendations_endpoint_accepts_telemetry():
    """POST /api/optimization/recommendations returns whitelisted-safe recommendations."""
    response = client.post("/api/optimization/recommendations", json=_live_telemetry("normal"))
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    ids = [rec["id"] for rec in data]
    assert "enable_power_saver" in ids
    # Only safe action id shapes may ever be recommended
    for rec in data:
        assert rec["id"] == "enable_power_saver" or rec["id"].startswith("close_process_")


def test_evaluate_delta_rejects_unknown_action():
    """Arbitrary action ids must be rejected by the safe action whitelist."""
    before = _live_telemetry("normal")
    after = _live_telemetry("optimized")
    response = _evaluate("whitelist_user", before, after, action_id="run_arbitrary_command")
    assert response.status_code == 422
    assert "whitelist" in response.json()["detail"]


def test_evaluate_delta_rejects_non_digit_process_action():
    response = _evaluate("whitelist_user_2", _live_telemetry("normal"), _live_telemetry("optimized"),
                         action_id="close_process_not_a_pid")
    assert response.status_code == 422
    assert "whitelist" in response.json()["detail"]


def test_evaluate_delta_rejects_identical_snapshots():
    """Before == after must be rejected: no system state change to verify."""
    snap = _live_telemetry("normal")
    response = _evaluate("identical_user", snap, snap)
    assert response.status_code == 422
    assert "identical" in response.json()["detail"]


def test_evaluate_delta_happy_path_awards_credits():
    """A genuine normal -> optimized transition verifies and awards credits."""
    user_id = "happy_path_user"
    response = _evaluate(user_id, _live_telemetry("normal"), _live_telemetry("optimized"))
    assert response.status_code == 200
    data = response.json()
    assert data["credits_awarded"] > 0
    assert data["action_hash"]
    state = client.get(f"/api/credits/state?user_id={user_id}").json()
    assert state["total_optimizations"] >= 1


def test_evaluate_delta_cooldown_returns_429():
    """Second cycle within the cooldown window must be an explicit 429."""
    user_id = "cooldown_user"
    first = _evaluate(user_id, _live_telemetry("normal"), _live_telemetry("optimized"))
    assert first.status_code == 200

    second = _evaluate(user_id, _live_telemetry("optimized"), _live_telemetry("normal"))
    assert second.status_code == 429
    assert "Cooldown" in second.json()["detail"]
    assert second.headers.get("Retry-After") is not None


def test_evaluate_delta_rejects_duplicate_replay():
    """
    Re-submitting the exact same before/after fingerprint must be rejected as a replay,
    even after the cooldown window has been cleared (bypassing cooldown only for this test).
    """
    user_id = "duplicate_user"
    before = _live_telemetry("normal")
    after = _live_telemetry("optimized")

    first = _evaluate(user_id, before, after)
    assert first.status_code == 200

    # Clear only the cooldown timer; the replay window must still catch the duplicate.
    optimization_service._last_optimization_time.pop(user_id, None)

    replay = _evaluate(user_id, before, after)
    assert replay.status_code == 422
    assert "Duplicate" in replay.json()["detail"]


def test_evaluate_delta_rejects_alternating_replay():
    """
    Alternating between two submissions must not evade the rolling replay window.
    """
    user_id = "alternating_user"
    a_before, a_after = _live_telemetry("normal"), _live_telemetry("optimized")
    b_before, b_after = _live_telemetry("optimized"), _live_telemetry("normal")

    assert _evaluate(user_id, a_before, a_after).status_code == 200
    optimization_service._last_optimization_time.pop(user_id, None)
    assert _evaluate(user_id, b_before, b_after).status_code == 200
    optimization_service._last_optimization_time.pop(user_id, None)
    # Replay of the FIRST submission: caught by the rolling window.
    replay = _evaluate(user_id, a_before, a_after)
    assert replay.status_code == 422
    assert "Duplicate" in replay.json()["detail"]


def test_evaluate_delta_rejects_noisy_measurement_window():
    before = _live_telemetry("normal")
    after = _live_telemetry("optimized")
    before.update({"_sample_count": 5, "_cpu_stddev": 20.0, "_memory_stddev": 1.0})
    after.update({"_sample_count": 5, "_cpu_stddev": 1.0, "_memory_stddev": 1.0})

    response = _evaluate("noisy_window_user", before, after)

    assert response.status_code == 422
    assert "not stable" in response.json()["detail"]


def test_meter_contradiction_cannot_claim_model_savings():
    before = _live_telemetry("normal")
    after = _live_telemetry("optimized")
    before["power_meter_raw"] = 20.0
    after["power_meter_raw"] = 25.0

    response = _evaluate("meter_contradiction_user", before, after)

    assert response.status_code == 200
    data = response.json()
    assert data["reduction_watts"] == 0.0
    assert data["hourly_co2_saved_g"] == 0.0
    assert data["credits_awarded"] == 5