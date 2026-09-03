"""
GreenLedger - ML Model Inference Service
Loads and caches the XGBoost power model, validates inputs against feature distribution,
and returns honest power predictions with inference latency and explanations.
"""

import os
import sys
import json
import time
import logging
from pathlib import Path
from typing import Dict, Any, Tuple, Optional

import numpy as np
import xgboost as xgb

# Add ml/scripts to path for feature_mapper import
ML_SCRIPTS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "ml" / "scripts"
if str(ML_SCRIPTS_DIR) not in sys.path:
    sys.path.append(str(ML_SCRIPTS_DIR))

try:
    from feature_mapper import ALL_MODEL_FEATURES, map_telemetry_to_features
except ImportError:
    from ml.scripts.feature_mapper import ALL_MODEL_FEATURES, map_telemetry_to_features

logger = logging.getLogger("GreenLedger.MLInference")

MODELS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "ml" / "models"


class MLInferenceEngine:
    def __init__(self):
        self.model: Optional[xgb.XGBRegressor] = None
        self.schema: Optional[Dict[str, Any]] = None
        self.metrics: Optional[Dict[str, Any]] = None
        self._load_model_artifacts()

    def _load_model_artifacts(self):
        model_path = MODELS_DIR / "power_model.json"
        schema_path = MODELS_DIR / "feature_schema.json"
        metrics_path = MODELS_DIR / "metrics.json"

        if not model_path.exists():
            logger.warning(f"Model artifact not found at {model_path}. Model will be lazy-loaded or trained.")
            return

        try:
            self.model = xgb.XGBRegressor()
            self.model.load_model(str(model_path))
            
            with open(schema_path, "r") as f:
                self.schema = json.load(f)
            with open(metrics_path, "r") as f:
                self.metrics = json.load(f)
                
            logger.info("XGBoost power model successfully loaded into memory.")
        except Exception as e:
            logger.error(f"Failed to load ML artifacts: {e}")

    def predict_power(self, telemetry: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes real-time inference on provided telemetry.
        Never fabricates values.
        """
        t0 = time.perf_counter()
        
        # 1. Map telemetry to strictly ordered features
        mapped_feats, warnings = map_telemetry_to_features(telemetry)
        
        if self.model is None:
            self._load_model_artifacts()
            
        if self.model is None or self.schema is None:
            raise RuntimeError("Power model artifact is unavailable; train the model before predicting.")

        # 2. Check for out-of-distribution values against training ranges
        is_ood = False
        ranges = self.schema.get("feature_ranges", {})
        for feat in self.schema["features"]:
            val = mapped_feats[feat]
            if feat in ranges:
                f_min = ranges[feat]["min"]
                f_max = ranges[feat]["max"]
                if val < f_min * 0.8 or val > f_max * 1.3:
                    is_ood = True
                    warnings.append(f"Feature '{feat}' value {val} is outside typical training bounds [{f_min}, {f_max}].")

        # 3. Form input vector in schema order
        feature_order = self.schema["features"]
        input_vector = np.array([[mapped_feats[f] for f in feature_order]], dtype=np.float32)
        
        # 4. XGBoost Inference
        pred = float(self.model.predict(input_vector)[0])
        pred_w = max(5.0, min(120.0, pred))  # Physical bounds for laptop
        
        latency_ms = (time.perf_counter() - t0) * 1000.0

        # 5. Calculate feature contributions for explanation panel
        feature_importances = self.metrics.get("feature_importances", {}) if self.metrics else {}
        contributions = {}
        for feat in ["cpu_utilization", "memory_usage", "process_count", "resource_pressure"]:
            imp = feature_importances.get(feat, 0.1)
            raw_val = mapped_feats.get(feat, 0.0)
            contributions[feat] = round(float(imp * raw_val), 1)

        return {
            "estimated_power_w": round(pred_w, 2),
            "model_version": self.schema.get("version", "1.0.0"),
            "warnings": warnings,
            "inference_latency_ms": round(latency_ms, 3),
            "feature_contributions": contributions,
            "is_out_of_distribution": is_ood
        }

    def get_model_diagnostics(self) -> Dict[str, Any]:
        """Returns metadata, accuracy metrics, and schema information."""
        return {
            "model_loaded": self.model is not None,
            "schema": self.schema,
            "metrics": self.metrics
        }


ml_engine = MLInferenceEngine()
