"""
Tests for the patent-gap build: predicted-net cost models, breakeven/safety
gates, zombie attention scoring, the feature-mapper alias regression, and
predicted-vs-actual transition logging.
"""

import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

from main import app
from services.optimization.cost_models import predict_net_saving, zombie_score

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "ml" / "scripts"))
from feature_mapper import map_telemetry_to_features


def _telemetry(**overrides):
    t = {
        "cpu_utilization": 45.0,
        "memory_usage": 60.0,
        "disk_io": 5.0,
        "process_count": 150,
        "thread_count": 2000,
        "uptime": 10.0,
        "cpu_frequency": 2800.0,
        "screen_brightness": 80.0,
        "top_cpu_processes": [
            {"pid": 4242, "name": "UpdaterService", "cpu_percent": 30.0,
             "memory_percent": 4.0},
        ],
    }
    t.update(overrides)
    return t


def test_bundle_predictions_positive_with_basis():
    eco = predict_net_saving("eco_mode", _telemetry(), 32.0)
    saver = predict_net_saving("enable_power_saver", _telemetry(), 32.0)
    assert eco["predicted_net_w"] == round(0.30 * 32.0, 2)
    assert saver["predicted_net_w"] == round(0.08 * 32.0, 2)
    assert "heuristic v1" in eco["basis"]


def test_breakeven_gate_suppresses_worthless_actions():
    # CPU already under the cap: nothing to reclaim.
    assert predict_net_saving("cap_cpu_55", _telemetry(cpu_utilization=30.0), 32.0) is None
    # Tiny process share: gross cannot clear cost + threshold.
    tiny = _telemetry(top_cpu_processes=[
        {"pid": 7, "name": "Tiny", "cpu_percent": 0.5, "memory_percent": 0.1}])
    assert predict_net_saving("close_process_7", tiny, 32.0) is None
    # No power estimate: no honest prediction.
    assert predict_net_saving("eco_mode", _telemetry(), None) is None


def test_foreground_process_never_a_kill_candidate():
    fg = _telemetry(foreground_process_name="UpdaterService")
    assert predict_net_saving("close_process_4242", fg, 32.0) is None
    bg = _telemetry(foreground_process_name="notepad")
    pred = predict_net_saving("close_process_4242", bg, 32.0)
    assert pred["predicted_net_w"] > 0


def test_zombie_score_attention_weighting():
    proc = {"pid": 1, "name": "Hog", "cpu_percent": 20.0, "memory_percent": 10.0}
    fg_score, _, is_fg = zombie_score(proc, {"foreground_process_name": "Hog"})
    assert is_fg and fg_score < 20.0  # active use heavily discounted
    idle_score, idle_reasons, _ = zombie_score(
        proc, {"foreground_process_name": "other", "input_idle_seconds": 900.0})
    unknown_score, unknown_reasons, _ = zombie_score(proc, {})
    assert idle_score > unknown_score  # unattended boosts confidence
    assert any("unattended" in r for r in idle_reasons)
    assert any("unknown" in r for r in unknown_reasons)


def test_mapper_alias_survives_validated_dump():
    # Regression: TelemetryInput.model_dump() always carries
    # cpu_frequency_mhz=None next to a good cpu_frequency; the mapper must
    # still resolve the legacy key (dict.get default does not fire on None).
    validated_dump = _telemetry(cpu_frequency_mhz=None)
    mapped, _ = map_telemetry_to_features(validated_dump)
    assert mapped["cpu_frequency"] == 2800.0
    explicit = _telemetry(cpu_frequency_mhz=3100.0)
    del explicit["cpu_frequency"]
    mapped2, _ = map_telemetry_to_features(explicit)
    assert mapped2["cpu_frequency"] == 3100.0


def test_recommendations_carry_predictions_over_http():
    client = TestClient(app)
    telemetry = client.get("/api/telemetry/demo?scenario=normal").json()
    recs = client.post("/api/optimization/recommendations", json=telemetry).json()
    eco = next(r for r in recs if r["id"] == "eco_mode")
    assert eco["predicted_net_w"] > 0
    assert eco["prediction_basis"]


def test_evaluate_logs_predicted_vs_actual(tmp_path):
    client = TestClient(app)
    before = client.get("/api/telemetry/demo?scenario=normal").json()
    after = client.get("/api/telemetry/demo?scenario=optimized").json()
    before["is_live"] = after["is_live"] = True
    r = client.post("/api/optimization/evaluate-delta", json={
        "action_id": "eco_mode",
        "before_telemetry": before,
        "after_telemetry": after,
        "user_id": "calibration_test",
        "predicted_net_w": 9.5,
    })
    assert r.status_code == 200, r.text
    lines = (tmp_path / "transitions.jsonl").read_text(encoding="utf-8").strip().split("\n")
    record = json.loads(lines[-1])
    assert record["predicted_net_w"] == 9.5
    assert record["prediction_error_w"] == round(record["reduction_watts"] - 9.5, 3)


def test_agent_attention_keys_present():
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "agent"))
    import windows_metrics
    attn = windows_metrics.get_user_attention()
    assert set(attn) == {"foreground_process_name", "input_idle_seconds"}
    # Linux sandbox: honestly unknown, never fabricated.
    assert attn["foreground_process_name"] is None
    assert attn["input_idle_seconds"] is None
