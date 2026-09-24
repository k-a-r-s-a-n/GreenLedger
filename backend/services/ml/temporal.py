"""
GreenLedger - Temporal LSTM Inference (Phase 2).

Loads the quantile LSTM (ml/models/temporal_lstm.pt) and predicts q10/q50/q90
for the LAST tick of a telemetry window. The window is used as-is (any length
>= 1 tick) — short windows simply carry less context; nothing is padded with
invented ticks.

torch is an OPTIONAL dependency: if it (or the artifact) is unavailable, the
engine reports unavailable and every caller degrades gracefully to the XGBoost
point estimate. The temporal model is a complement, never a hard dependency.
"""

import logging
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional

import numpy as np

try:
    import torch
    import torch.nn as nn
    _TORCH_AVAILABLE = True
except ImportError:
    torch = None  # type: ignore
    nn = None  # type: ignore
    _TORCH_AVAILABLE = False

ML_SCRIPTS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "ml" / "scripts"
if str(ML_SCRIPTS_DIR) not in sys.path:
    sys.path.append(str(ML_SCRIPTS_DIR))

try:
    from feature_mapper import ALL_MODEL_FEATURES, map_telemetry_to_features
except ImportError:
    from ml.scripts.feature_mapper import ALL_MODEL_FEATURES, map_telemetry_to_features

logger = logging.getLogger("GreenLedger.TemporalInference")

MODELS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "ml" / "models"


class TemporalInferenceEngine:
    def __init__(self):
        self.model = None
        self.bundle_version: Optional[str] = None
        self.feat_mean: Optional[np.ndarray] = None
        self.feat_std: Optional[np.ndarray] = None
        self._load()

    def _load(self):
        if not _TORCH_AVAILABLE:
            logger.warning("torch not installed; temporal intervals unavailable.")
            return
        path = MODELS_DIR / "temporal_lstm.pt"
        if not path.exists():
            logger.warning("Temporal artifact %s missing; intervals unavailable.", path)
            return
        try:
            bundle = torch.load(path, map_location="cpu", weights_only=False)
            cfg = bundle["config"]

            class _LSTM(nn.Module):
                def __init__(self):
                    super().__init__()
                    self.lstm = nn.LSTM(cfg["n_features"], cfg["hidden"],
                                        cfg["layers"], batch_first=True)
                    self.heads = nn.Linear(cfg["hidden"], 3)

                def forward(self, x):
                    return self.heads(self.lstm(x)[0])

            model = _LSTM()
            model.load_state_dict(bundle["state_dict"])
            model.eval()
            self.model = model
            self.bundle_version = bundle.get("version", "2.0.0")
            self.feat_mean = np.asarray(bundle["feat_mean"], dtype=np.float32)
            self.feat_std = np.asarray(bundle["feat_std"], dtype=np.float32)
            logger.info("Temporal LSTM v%s loaded (%s).",
                        self.bundle_version, path.name)
        except Exception as exc:
            logger.error("Failed to load temporal artifact: %s", exc)
            self.model = None

    @property
    def available(self) -> bool:
        return self.model is not None

    def predict_window(self, window: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Quantiles for the last tick of a telemetry window (>= 1 tick).
        Raises RuntimeError when unavailable, ValueError on bad telemetry.
        """
        if not self.available:
            raise RuntimeError("Temporal model unavailable (torch or artifact missing).")
        if not window:
            raise ValueError("Telemetry window must contain at least one tick.")

        rows = []
        warnings: List[str] = []
        for tick in window[-120:]:  # agent buffer bound; older ticks add noise, not signal
            mapped, tick_warnings = map_telemetry_to_features(tick)
            rows.append([mapped[f] for f in ALL_MODEL_FEATURES])
            warnings.extend(tick_warnings)
        X = (np.asarray(rows, dtype=np.float32) - self.feat_mean) / self.feat_std

        with torch.no_grad():
            q = self.model(torch.from_numpy(X).unsqueeze(0)).numpy()[0, -1, :]
        q.sort()  # guard against quantile crossing
        q10, q50, q90 = (round(float(v), 2) for v in q)
        return {
            "q10_w": q10,
            "median_w": q50,
            "q90_w": q90,
            "interval_80_w": [q10, q90],
            "window_ticks": len(rows),
            "model_version": self.bundle_version,
            "warnings": sorted(set(warnings)),
        }


temporal_engine = TemporalInferenceEngine()
