"""
GreenLedger - Temporal LSTM with Quantile Uncertainty (Phase 2).

Task: predict current-tick power from the trailing telemetry window
(causal: ticks 0..t -> power_t), matching deployment where the agent's
history buffer feeds the model. Three quantile heads (0.1/0.5/0.9) give an
80% prediction interval with the point estimate — the honest "I don't know"
the point model lacks.

Splits are by EPISODE (70/15/15, seed 42): ticks of one episode never span
train/test. Baselines on the same test episodes: the production XGBoost on
the current tick only, and an XGBoost trained on flattened windows (so the
comparison isolates recurrence vs trees, not window-vs-tick information).

Artifacts: ml/models/temporal_lstm.pt (weights + norm stats + config),
ml/reports/temporal_benchmark.json.

Usage: python ml/scripts/train_temporal.py [--fast]
"""

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Dict, Any

import numpy as np
import torch
import torch.nn as nn
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, root_mean_squared_error

sys.path.insert(0, str(Path(__file__).resolve().parent))
from feature_mapper import ALL_MODEL_FEATURES

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "processed"
REPORTS_DIR = Path(__file__).resolve().parent.parent / "reports"

QUANTILES = (0.1, 0.5, 0.9)
N_FEATURES = len(ALL_MODEL_FEATURES)


class PowerLSTM(nn.Module):
    """2-layer LSTM + per-tick quantile heads. Small by design (~60k params):
    this runs next to the agent on a laptop, not in a datacenter."""

    def __init__(self, n_features: int = N_FEATURES, hidden: int = 128,
                 layers: int = 2, dropout: float = 0.1):
        super().__init__()
        self.lstm = nn.LSTM(n_features, hidden, layers, batch_first=True,
                            dropout=dropout if layers > 1 else 0.0)
        self.heads = nn.Linear(hidden, len(QUANTILES))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm(x)
        return self.heads(out)  # (B, T, 3): q10, q50, q90 per tick


def pinball_loss(pred: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
    """Mean pinball loss over the three quantile heads."""
    target = target.unsqueeze(-1)
    qs = torch.tensor(QUANTILES, device=pred.device).view(1, 1, -1)
    err = target - pred
    return torch.mean(torch.max(qs * err, (qs - 1.0) * err))


def _episodes(split: str, seed: int = 42):
    d = np.load(DATA_DIR / "temporal_episodes.npz")
    X, y = d["X"].astype(np.float32), d["y"].astype(np.float32)
    rng = np.random.default_rng(seed)
    idx = rng.permutation(len(X))
    n_test = int(0.15 * len(X))
    n_val = int(0.15 * len(X))
    parts = {"test": idx[:n_test], "val": idx[n_test:n_test + n_val],
             "train": idx[n_test + n_val:]}
    return X[parts[split]], y[parts[split]]


def train(fast: bool = False) -> Dict[str, Any]:
    torch.manual_seed(42)
    torch.set_num_threads(2)
    np.random.seed(42)

    X_train, y_train = _episodes("train")
    X_val, y_val = _episodes("val")
    X_test, y_test = _episodes("test")
    if fast:
        X_train, y_train = X_train[:60], y_train[:60]
        X_val, y_val = X_val[:20], y_val[:20]
        X_test, y_test = X_test[:20], y_test[:20]

    # Standardize from TRAIN episodes only.
    mu = X_train.reshape(-1, N_FEATURES).mean(axis=0)
    sd = X_train.reshape(-1, N_FEATURES).std(axis=0) + 1e-8

    def norm(a):
        return (a - mu) / sd

    t_train = torch.utils.data.TensorDataset(
        torch.from_numpy(norm(X_train)), torch.from_numpy(y_train))
    loader = torch.utils.data.DataLoader(t_train, batch_size=64, shuffle=True)
    val_X = torch.from_numpy(norm(X_val))
    val_y = torch.from_numpy(y_val)
    test_X = torch.from_numpy(norm(X_test))

    model = PowerLSTM()
    opt = torch.optim.Adam(model.parameters(), lr=2e-3)
    max_epochs = 10 if fast else 300
    patience = 3 if fast else 30
    best_val, best_state, bad = float("inf"), None, 0
    epochs_run = 0

    for epoch in range(max_epochs):
        epochs_run = epoch + 1
        model.train()
        for xb, yb in loader:
            opt.zero_grad()
            loss = pinball_loss(model(xb), yb)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
        model.eval()
        with torch.no_grad():
            val_loss = float(pinball_loss(model(val_X), val_y))
        if val_loss < best_val - 1e-4:
            best_val, best_state, bad = val_loss, dict(model.state_dict()), 0
        else:
            bad += 1
            if bad >= patience:
                break
    model.load_state_dict(best_state)
    n_params = sum(p.numel() for p in model.parameters())

    # ---- Test evaluation ----
    model.eval()
    with torch.no_grad():
        q = model(test_X).numpy()  # (E, T, 3)
    q.sort(axis=-1)  # guard against quantile crossing
    med = q[:, :, 1]
    lo, hi = q[:, :, 0], q[:, :, 2]
    yf = y_test.flatten()
    coverage_80 = float(np.mean((yf >= lo.flatten()) & (yf <= hi.flatten())))
    width_80 = float(np.mean(hi.flatten() - lo.flatten()))
    quantile_calibration = {
        f"q{int(p * 100)}": round(float(np.mean(yf <= q[:, :, i].flatten())), 3)
        for i, p in enumerate(QUANTILES)
    }
    lstm = {
        "mae_w": round(float(mean_absolute_error(yf, med.flatten())), 4),
        "rmse_w": round(float(root_mean_squared_error(yf, med.flatten())), 4),
        "coverage_80": round(coverage_80, 4),
        "mean_width_80_w": round(width_80, 3),
        "quantile_calibration": quantile_calibration,
    }

    # ---- Baselines on the same test episodes ----
    # (a) Production XGBoost, current tick only (what the app uses today).
    prod = xgb.XGBRegressor()
    prod.load_model(str(MODELS_DIR / "power_model.json"))
    flat_test = X_test.reshape(-1, N_FEATURES)
    pred_tick = prod.predict(flat_test)
    xgb_tick = {
        "mae_w": round(float(mean_absolute_error(yf, pred_tick)), 4),
        "rmse_w": round(float(root_mean_squared_error(yf, pred_tick)), 4),
    }
    # (b) XGBoost on flattened windows (isolates recurrence vs trees).
    with open(MODELS_DIR / "metrics.json", encoding="utf-8") as f:
        xp = json.load(f)["hyperparameters"]
    if fast:
        xp = dict(xp, n_estimators=50)
    Xw_train = X_train.reshape(len(X_train), -1)
    yw_train = y_train[:, -1]  # window -> final-tick power
    Xw_val = X_val.reshape(len(X_val), -1)
    yw_val = y_val[:, -1]
    Xw_test = X_test.reshape(len(X_test), -1)
    yw_test = y_test[:, -1]
    wxgb = xgb.XGBRegressor(objective="reg:squarederror", random_state=42,
                            n_jobs=2, early_stopping_rounds=30,
                            eval_metric="rmse", **xp)
    wxgb.fit(Xw_train, yw_train, eval_set=[(Xw_val, yw_val)], verbose=False)
    pred_win = wxgb.predict(Xw_test)
    xgb_window = {
        "mae_w": round(float(mean_absolute_error(yw_test, pred_win)), 4),
        "rmse_w": round(float(root_mean_squared_error(yw_test, pred_win)), 4),
    }

    # Final-tick LSTM numbers for the like-for-like window comparison.
    med_last = med[:, -1]
    lstm["mae_w_last_tick"] = round(float(mean_absolute_error(yw_test, med_last)), 4)

    # ---- Artifacts ----
    # Fast mode is a smoke path: it must NEVER overwrite production artifacts.
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    bundle_path = MODELS_DIR / ("temporal_lstm_fast.pt" if fast else "temporal_lstm.pt")
    torch.save({
        "version": "2.0.0",
        "state_dict": best_state,
        "config": {"n_features": N_FEATURES, "hidden": 128, "layers": 2},
        "features": list(ALL_MODEL_FEATURES),
        "feat_mean": mu.astype(np.float32),
        "feat_std": sd.astype(np.float32),
        "quantiles": list(QUANTILES),
    }, bundle_path)

    report = {
        "protocol": "episode-level 70/15/15 split (seed 42); LSTM pinball loss "
                    "on q10/q50/q90; XGB baselines on identical test episodes",
        "model": {"params": n_params, "val_pinball": round(best_val, 4),
                  "epochs_run": epochs_run, "train_episodes": len(X_train),
                  "artifact": "ml/models/temporal_lstm.pt"},
        "fast": fast,
        "evaluated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "lstm_quantile": lstm,
        "xgb_current_tick": xgb_tick,
        "xgb_window": xgb_window,
    }
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report_name = "temporal_benchmark_fast.json" if fast else "temporal_benchmark.json"
    with open(REPORTS_DIR / report_name, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="GreenLedger temporal LSTM")
    parser.add_argument("--fast", action="store_true")
    args = parser.parse_args()
    report = train(fast=args.fast)
    print(f"\n=== temporal benchmark ({'fast' if args.fast else 'full'}) ===")
    lstm = report["lstm_quantile"]
    print(f"  LSTM median MAE {lstm['mae_w']}W | 80% coverage {lstm['coverage_80']} "
          f"(width {lstm['mean_width_80_w']}W) | calib {lstm['quantile_calibration']}")
    print(f"  XGB current-tick MAE {report['xgb_current_tick']['mae_w']}W | "
          f"XGB window MAE {report['xgb_window']['mae_w']}W | "
          f"LSTM last-tick MAE {lstm['mae_w_last_tick']}W")


if __name__ == "__main__":
    main()
