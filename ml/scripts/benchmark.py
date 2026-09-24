"""
GreenLedger - Model Benchmark: multi-seed evaluation, baselines, ablations.

Answers the questions a reviewer will ask about the headline metrics:
  1. How seed-sensitive are they? (5 seeds, mean +/- sd + 95% CI)
  2. Does XGBoost beat trivial baselines? (linear regression, mean predictor)
  3. Which features actually matter? (ablations: no-DVFS-term, v1.0-equivalent,
     top-3-only)

Protocol mirrors train.py per seed (70/15/15 split; XGB early-stops on val)
except the grid search is NOT re-run per seed — every XGB config uses the
production hyperparameters (the grid winner saved in metrics.json). This is
the standard, documented choice: re-tuning per seed would leak the comparison.

Usage:
    python ml/scripts/benchmark.py [--seeds 42,7,11,23,99] [--fast]
    --fast: 2 seeds, 50 trees (smoke test / CI); full run otherwise.
Report: ml/reports/model_benchmark.json
"""

import argparse
import json
import math
import sys
import time
from pathlib import Path
from typing import Dict, Any, List

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.linear_model import LinearRegression
from sklearn.dummy import DummyRegressor
from sklearn.metrics import (
    mean_absolute_error,
    root_mean_squared_error,
    r2_score,
    mean_absolute_percentage_error,
)
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dataset_loader import load_dataset
from feature_mapper import ALL_MODEL_FEATURES, compute_engineered_features

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
REPORTS_DIR = Path(__file__).resolve().parent.parent / "reports"

# v1.0-equivalent feature set (before display/DVFS signals existed).
V10_FEATURES = [
    "cpu_utilization", "memory_usage", "disk_io", "process_count",
    "thread_count", "uptime", "cpu_memory_ratio", "process_thread_ratio",
    "resource_pressure",
]

TOP3_FEATURES = ["freq_util_product", "cpu_frequency", "cpu_utilization"]


def _xgb_params(fast: bool) -> Dict[str, Any]:
    with open(MODELS_DIR / "metrics.json", encoding="utf-8") as f:
        saved = json.load(f)["hyperparameters"]
    params = dict(saved)
    if fast:
        params["n_estimators"] = 50
    return params


def _configs(fast: bool) -> Dict[str, Dict[str, Any]]:
    xp = _xgb_params(fast)
    no_dvfs = [f for f in ALL_MODEL_FEATURES if f != "freq_util_product"]
    return {
        "xgb_full": {"kind": "xgb", "features": list(ALL_MODEL_FEATURES)},
        "xgb_no_dvfs_term": {"kind": "xgb", "features": no_dvfs},
        "xgb_v10_features": {"kind": "xgb", "features": list(V10_FEATURES)},
        "xgb_top3_only": {"kind": "xgb", "features": list(TOP3_FEATURES)},
        "linear_full": {"kind": "linear", "features": list(ALL_MODEL_FEATURES)},
        "mean_baseline": {"kind": "mean", "features": list(ALL_MODEL_FEATURES)},
        "_xgb_params": xp,  # not a config; shared hyperparameters
    }


def _fit_predict(kind: str, X_train: pd.DataFrame, y_train: pd.Series,
                 X_val: pd.DataFrame, y_val: pd.Series,
                 X_test: pd.DataFrame, xp: Dict[str, Any], seed: int) -> np.ndarray:
    if kind == "xgb":
        model = xgb.XGBRegressor(
            objective="reg:squarederror", random_state=seed, n_jobs=2,
            early_stopping_rounds=30, eval_metric="rmse", **xp)
        model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
        return model.predict(X_test)
    if kind == "linear":
        model = LinearRegression()
        model.fit(X_train, y_train)
        return model.predict(X_test)
    model = DummyRegressor(strategy="mean")
    model.fit(X_train, y_train)
    return model.predict(X_test)


def _metrics(y_true: pd.Series, y_pred: np.ndarray) -> Dict[str, float]:
    return {
        "r2": float(r2_score(y_true, y_pred)),
        "mae_w": float(mean_absolute_error(y_true, y_pred)),
        "rmse_w": float(root_mean_squared_error(y_true, y_pred)),
        "mape_pct": float(mean_absolute_percentage_error(y_true, y_pred) * 100.0),
    }


def run_benchmark(seeds: List[int], fast: bool = False,
                  out_path: Path | None = None) -> Dict[str, Any]:
    df, val_report = load_dataset()
    df_feat = compute_engineered_features(df)
    y = df_feat["power_consumption"]

    cfgs = _configs(fast)
    xp = cfgs.pop("_xgb_params")

    per_seed: Dict[str, Dict[str, Dict[str, float]]] = {c: {} for c in cfgs}
    for seed in seeds:
        X_tv, X_test, y_tv, y_test = train_test_split(
            df_feat, y, test_size=0.15, random_state=seed, shuffle=True)
        X_train, X_val, y_train, y_val = train_test_split(
            X_tv, y_tv, test_size=0.17647, random_state=seed, shuffle=True)
        for name, cfg in cfgs.items():
            feats = cfg["features"]
            preds = _fit_predict(cfg["kind"], X_train[feats], y_train,
                                 X_val[feats], y_val, X_test[feats], xp, seed)
            per_seed[name][str(seed)] = _metrics(y_test, preds)

    # Aggregate: mean +/- sd + 95% CI half-width per metric per config.
    summary: Dict[str, Any] = {}
    for name, by_seed in per_seed.items():
        agg: Dict[str, Dict[str, float]] = {}
        for metric in ("r2", "mae_w", "rmse_w", "mape_pct"):
            vals = np.array([by_seed[str(s)][metric] for s in seeds])
            mean = float(vals.mean())
            sd = float(vals.std(ddof=1)) if len(vals) > 1 else 0.0
            half_ci = 1.96 * sd / math.sqrt(len(vals)) if len(vals) > 1 else 0.0
            agg[metric] = {"mean": round(mean, 4), "sd": round(sd, 4),
                           "ci95_half": round(half_ci, 4)}
        summary[name] = agg

    report = {
        "protocol": "70/15/15 split per seed; XGB early-stops on val; "
                    "production hyperparameters (grid winner) for all XGB configs",
        "seeds": seeds,
        "fast": fast,
        "dataset": {"rows": len(df), "is_synthetic": val_report["is_synthetic"]},
        "evaluated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "summary": summary,
        "per_seed": per_seed,
    }
    out = out_path or (REPORTS_DIR / "model_benchmark.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="GreenLedger model benchmark")
    parser.add_argument("--seeds", default="42,7,11,23,99")
    parser.add_argument("--fast", action="store_true")
    args = parser.parse_args()
    seeds = [int(s) for s in args.seeds.split(",") if s.strip()]
    if args.fast:
        seeds = seeds[:2]
    report = run_benchmark(seeds, fast=args.fast)
    print(f"\n=== model benchmark ({'fast' if args.fast else 'full'}, "
          f"seeds={seeds}) ===")
    for name, agg in report["summary"].items():
        print(f"  {name:18s} R2 {agg['r2']['mean']:.4f} +/- {agg['r2']['ci95_half']:.4f} | "
              f"MAE {agg['mae_w']['mean']:.2f}W | MAPE {agg['mape_pct']['mean']:.2f}%")
    print(f"\nReport written to {REPORTS_DIR / 'model_benchmark.json'}")


if __name__ == "__main__":
    main()
