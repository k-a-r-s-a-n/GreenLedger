"""
GreenLedger - Recommender Calibration Report (patent-gap build).

Reads the transition log (state, action, VERIFIED outcome + client-echoed
prediction) and measures each cost model's bias: mean error, MAE, RMSE of
(predicted_net_w vs verified reduction_watts) per action, verified cycles
only. Exits cleanly with an empty report when the log has no predictions
yet — a fresh install is not an error.

The whole point of the predicted-vs-actual fields is this script: the v1
heuristic constants in cost_models.py get replaced by fitted values once
real cycles accumulate. No surveyed patent closes this loop.

Usage: python ml/scripts/calibration.py [--log PATH]
"""

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any, Dict, List

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_LOG = REPO_ROOT / "ml" / "data" / "transitions" / "transitions.jsonl"
REPORT_PATH = REPO_ROOT / "ml" / "reports" / "calibration.json"


def load_predictions(log_path: Path) -> List[Dict[str, Any]]:
    rows = []
    if not log_path.exists():
        return rows
    with open(log_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue
            pred = d.get("predicted_net_w")
            actual = d.get("reduction_watts")
            if (isinstance(pred, (int, float)) and math.isfinite(pred)
                    and isinstance(actual, (int, float)) and math.isfinite(actual)
                    and d.get("verified") is True):
                rows.append({"action_id": d.get("action_id", "?"),
                             "predicted": float(pred), "actual": float(actual)})
    return rows


def summarize(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    by_action: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        by_action.setdefault(r["action_id"], []).append(r)

    actions = {}
    for action_id, rs in sorted(by_action.items()):
        errs = [r["actual"] - r["predicted"] for r in rs]
        n = len(errs)
        actions[action_id] = {
            "n_verified": n,
            # Positive bias => model UNDER-predicts (actual exceeds predicted).
            "bias_w": round(sum(errs) / n, 3),
            "mae_w": round(sum(abs(e) for e in errs) / n, 3),
            "rmse_w": round(math.sqrt(sum(e * e for e in errs) / n), 3),
        }
    all_errs = [r["actual"] - r["predicted"] for r in rows]
    overall = {
        "n_verified": len(all_errs),
        "bias_w": round(sum(all_errs) / len(all_errs), 3) if all_errs else None,
        "mae_w": round(sum(abs(e) for e in all_errs) / len(all_errs), 3) if all_errs else None,
    }
    return {"overall": overall, "actions": actions}


def main() -> int:
    parser = argparse.ArgumentParser(description="GreenLedger calibration report")
    parser.add_argument("--log", type=Path, default=DEFAULT_LOG)
    args = parser.parse_args()

    rows = load_predictions(args.log)
    report = summarize(rows)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"Verified cycles with predictions: {report['overall']['n_verified']}")
    if not rows:
        print("Log has no calibrated cycles yet — heuristics v1 stand.")
        return 0
    print(f"Overall bias {report['overall']['bias_w']}W | "
          f"MAE {report['overall']['mae_w']}W (+ means model under-predicts)")
    for action_id, s in report["actions"].items():
        print(f"  {action_id}: n={s['n_verified']} bias={s['bias_w']}W "
              f"mae={s['mae_w']}W rmse={s['rmse_w']}W")
    print(f"Report: {REPORT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
