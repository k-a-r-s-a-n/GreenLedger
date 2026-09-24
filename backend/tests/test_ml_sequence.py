"""
Contract tests for POST /api/ml/predict-sequence and windowed delta eval.

The temporal model is optional infrastructure: when torch or the artifact is
missing the endpoint answers 503 and delta intervals come back null. Tests
assert the CONTRACT in both branches, never a specific branch, so they pass
in minimal environments and in full ones.
"""

from fastapi.testclient import TestClient

from main import app


def _window(client: TestClient, scenario: str, n: int):
    return [client.get(f"/api/telemetry/demo?scenario={scenario}").json()
            for _ in range(n)]


def test_predict_sequence_contract():
    client = TestClient(app)
    window = _window(client, "normal", 5)
    r = client.post("/api/ml/predict-sequence",
                    json={"telemetry_window": window})
    if r.status_code == 503:
        assert "Temporal model unavailable" in r.json()["detail"]
        return
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["q10_w"] <= d["median_w"] <= d["q90_w"]
    assert d["interval_80_w"] == [d["q10_w"], d["q90_w"]]
    assert d["window_ticks"] == 5
    assert d["model_version"]
    assert isinstance(d["warnings"], list)


def test_predict_sequence_rejects_empty_window():
    client = TestClient(app)
    r = client.post("/api/ml/predict-sequence", json={"telemetry_window": []})
    assert r.status_code == 422


def test_evaluate_delta_with_windows_contract():
    client = TestClient(app)
    before = _window(client, "normal", 3)
    after = _window(client, "optimized", 3)
    for tick in before + after:
        tick["is_live"] = True
    r = client.post("/api/optimization/evaluate-delta", json={
        "action_id": "eco_mode",
        "before_telemetry": before[-1],
        "after_telemetry": after[-1],
        "before_window": before,
        "after_window": after,
        "user_id": "sequence_contract",
    })
    assert r.status_code == 200, r.text
    d = r.json()
    for key in ("before_power_interval_80", "after_power_interval_80"):
        iv = d[key]
        assert iv is None or (len(iv) == 2 and iv[0] <= iv[1]), key
    # Windows never change the point-estimate contract.
    assert d["before_power_w"] > d["after_power_w"] > 0
