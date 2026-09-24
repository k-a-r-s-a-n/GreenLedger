"""
GreenLedger - Results Summary Aggregator (Phase 4).

Single reproducibility root: reads every committed evaluation report plus the
model metrics and emits ml/reports/results_summary.json — the file the paper
draft cites. Fails loudly on a missing report (a paper must never cite a
number that cannot be regenerated); calibration.json is optional (it only
exists after real verified cycles accumulate).

Usage: python ml/scripts/summarize_results.py
"""

import json
import sys
from pathlib import Path
from typing import Any, Dict

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
REPORTS = REPO_ROOT / "ml" / "reports"
MODELS = REPO_ROOT / "ml" / "models"

REQUIRED = {
    "xgb_metrics": MODELS / "metrics.json",
    "xgb_benchmark": REPORTS / "model_benchmark.json",
    "temporal_benchmark": REPORTS / "temporal_benchmark.json",
    "eco_evaluation": REPORTS / "eco_evaluation.json",
}
OPTIONAL = {
    "calibration": REPORTS / "calibration.json",
}


def _load(path: Path) -> Dict[str, Any]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def summarize() -> Dict[str, Any]:
    missing = [str(p) for p in REQUIRED.values() if not p.exists()]
    if missing:
        raise FileNotFoundError(
            "Cannot summarize: missing reports (regenerate first): "
            + ", ".join(missing)
        )
    summary = {name: _load(path) for name, path in REQUIRED.items()}
    for name, path in OPTIONAL.items():
        summary[name] = _load(path) if path.exists() else None
    summary["_meta"] = {
        "generator": "ml/scripts/summarize_results.py",
        "note": "Cited by docs/paper.md. Regenerate after any re-run of the "
                "evaluation scripts; never hand-edit numbers into the paper.",
    }
    return summary


def main() -> int:
    try:
        summary = summarize()
    except FileNotFoundError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    out = REPORTS / "results_summary.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"Wrote {out} ({out.stat().st_size / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
