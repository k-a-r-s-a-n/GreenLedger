"""
GreenLedger - Benchmark Harness Smoke Test
Runs the multi-seed/baseline/ablation harness in fast mode (2 seeds,
50 trees) and asserts the report schema plus basic sanity orderings.
The full 5-seed report is generated manually: python ml/scripts/benchmark.py
"""

import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(REPO_ROOT / "ml" / "scripts"))

from benchmark import run_benchmark


def test_benchmark_fast_report_schema_and_orderings(tmp_path):
    out = tmp_path / "bench.json"
    report = run_benchmark(seeds=[42, 7], fast=True, out_path=out)
    assert out.exists()
    saved = json.loads(out.read_text(encoding="utf-8"))
    assert saved["seeds"] == [42, 7]
    assert saved["fast"] is True

    summary = saved["summary"]
    expected = {"xgb_full", "xgb_no_dvfs_term", "xgb_v10_features",
                "xgb_top3_only", "linear_full", "mean_baseline"}
    assert set(summary) == expected
    for name, agg in summary.items():
        for metric in ("r2", "mae_w", "rmse_w", "mape_pct"):
            assert set(agg[metric]) == {"mean", "sd", "ci95_half"}, name

    # Sanity orderings (must hold on any seed set for this data):
    # full features beat v1.0 features; everything beats the mean predictor.
    assert summary["xgb_full"]["r2"]["mean"] > summary["xgb_v10_features"]["r2"]["mean"]
    assert summary["xgb_full"]["r2"]["mean"] > summary["mean_baseline"]["r2"]["mean"]
    assert summary["linear_full"]["r2"]["mean"] > summary["mean_baseline"]["r2"]["mean"]
    assert summary["xgb_full"]["mae_w"]["mean"] < summary["mean_baseline"]["mae_w"]["mean"]
