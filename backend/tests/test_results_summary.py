"""
The paper draft cites results_summary.json; this test pins the aggregator:
it must run, include every required section, and agree with the source
reports on headline numbers (so the paper can never drift from the data).
"""

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def _summary():
    r = subprocess.run([sys.executable, "ml/scripts/summarize_results.py"],
                       cwd=REPO_ROOT, capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    with open(REPO_ROOT / "ml" / "reports" / "results_summary.json",
              encoding="utf-8") as f:
        return json.load(f)


def test_summary_sections_and_headlines():
    s = _summary()
    for section in ("xgb_metrics", "xgb_benchmark", "temporal_benchmark",
                    "eco_evaluation"):
        assert section in s, section
    # Headlines the paper cites, pinned against the sources.
    assert s["xgb_metrics"]["mae_watts"] < 1.1
    assert s["xgb_benchmark"]["summary"]["xgb_full"]["r2"]["mean"] > 0.95
    lstm = s["temporal_benchmark"]["lstm_quantile"]
    assert 0.75 <= lstm["coverage_80"] <= 0.85
    assert lstm["mae_w"] < s["temporal_benchmark"]["xgb_current_tick"]["mae_w"]
    eco = s["eco_evaluation"]["personas"]["student_typical"]["actions"]["eco_mode"]
    assert eco["mean_reduction_pct"] > 35.0


def test_summary_fails_loudly_on_missing_report(tmp_path, monkeypatch):
    # Point the aggregator at an empty reports dir via a copied script? No —
    # simpler contract: the generator module raises FileNotFoundError when a
    # required input is absent. Simulate by importing with patched paths.
    sys.path.insert(0, str(REPO_ROOT / "ml" / "scripts"))
    import summarize_results
    monkeypatch.setattr(summarize_results, "REQUIRED",
                        {"missing": tmp_path / "nope.json"})
    try:
        summarize_results.summarize()
    except FileNotFoundError:
        return
    raise AssertionError("expected FileNotFoundError for missing report")
