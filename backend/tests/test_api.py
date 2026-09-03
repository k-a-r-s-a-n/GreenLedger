"""
GreenLedger - Backend Automated Test Suite
Validates health, ML inference, carbon calculations, green credits, optimization safety, and API endpoints.
"""

import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from main import app
from services.carbon.calculator import (
    power_to_kwh,
    kwh_to_co2,
    calculate_hourly_emissions,
    calculate_savings
)
from services.credits.rewards import credit_service
from services.optimization.engine import optimization_service

client = TestClient(app)


def test_health_check():
    """Verify system health endpoint responds with 200 and online status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "version" in data


def test_carbon_power_to_kwh():
    """Test electrical conversion: 1000W for 1h = 1 kWh."""
    assert power_to_kwh(1000.0, 1.0) == 1.0
    assert power_to_kwh(50.0, 2.0) == 0.1
    with pytest.raises(ValueError):
        power_to_kwh(-10.0, 1.0)


def test_carbon_kwh_to_co2():
    """Test emissions conversion against standard US factor (0.385 kg CO2e / kWh)."""
    res = kwh_to_co2(1.0, 0.385)
    assert res["emissions_kg_co2"] == 0.385
    assert res["emissions_g_co2"] == 385.0
    assert res["trees_offset_equivalent"] > 0.0


def test_carbon_calculate_savings():
    """Test calculation of delta wattage and CO2 prevented."""
    res = calculate_savings(before_watts=50.0, after_watts=35.0, duration_hours=1.0)
    assert res["delta_watts"] == 15.0
    assert res["pct_reduction"] == 30.0
    assert res["co2_saved_g"] > 0.0


def test_carbon_api_endpoint():
    """Test POST /api/carbon/calculate endpoint."""
    payload = {
        "power_watts": 45.0,
        "duration_hours": 2.0,
        "carbon_intensity_kg_per_kwh": 0.385
    }
    response = client.post("/api/carbon/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["energy_kwh"] == 0.09
    assert data["emissions_g_co2"] > 0.0


def test_telemetry_demo_mode():
    """Test GET /api/telemetry/demo returns structured realistic demo telemetry."""
    response = client.get("/api/telemetry/demo?scenario=normal")
    assert response.status_code == 200
    data = response.json()
    assert data["is_live"] is False
    assert "cpu_utilization" in data
    assert "memory_usage" in data
    assert "process_count" in data


def test_ml_prediction_endpoint():
    """Test POST /api/ml/predict returns estimated power and latency."""
    payload = {
        "cpu_utilization": 35.0,
        "memory_usage": 55.0,
        "disk_io": 2.5,
        "network_latency": 20.0,
        "process_count": 140,
        "thread_count": 1800,
        "context_switches": 12000,
        "temperature": 50.0,
        "uptime": 10.0
    }
    response = client.post("/api/ml/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "estimated_power_w" in data
    assert data["estimated_power_w"] > 0.0
    assert "inference_latency_ms" in data


def test_ml_prediction_rejects_incomplete_telemetry():
    response = client.post("/api/ml/predict", json={
        "cpu_utilization": 35.0,
        "memory_usage": 55.0,
        "process_count": 140
    })
    assert response.status_code == 422
    assert "required telemetry unavailable" in response.json()["detail"]


def test_optimization_rejects_demo_telemetry():
    demo = client.get("/api/telemetry/demo").json()
    response = client.post("/api/optimization/evaluate-delta", json={
        "action_id": "enable_power_saver",
        "before_telemetry": demo,
        "after_telemetry": demo
    })
    assert response.status_code == 422
    assert "live before and after telemetry" in response.json()["detail"]


def test_green_credits_rules():
    """Test credit calculations and rank progression."""
    state = credit_service.get_user_state("test_user_unique")
    assert state.credit_balance >= 0
    
    # Award reward for a verified 20% reduction
    earned = credit_service.calculate_optimization_reward(
        action_id="test_action",
        reduction_pct=20.0,
        co2_saved_g=15.0,
        user_id="test_user_unique"
    )
    assert earned > 0
    
    new_state = credit_service.get_user_state("test_user_unique")
    assert new_state.credit_balance > state.credit_balance
    assert new_state.total_optimizations >= 1


def test_badges_and_marketplace_purchase():
    """Test badge listing and marketplace purchasing logic."""
    badges_resp = client.get("/api/badges/list?user_id=default_user")
    assert badges_resp.status_code == 200
    badges = badges_resp.json()
    assert len(badges) >= 4
    
    # Attempt purchasing an unowned badge with insufficient balance error handling
    purchase_resp = client.post("/api/marketplace/purchase", json={
        "badge_id": "badge_green_guardian",
        "user_id": "low_balance_user"
    })
    # low_balance_user has 100 credits, badge is 2500 credits -> should return 400
    assert purchase_resp.status_code == 400
