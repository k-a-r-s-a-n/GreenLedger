"""
GreenLedger - Model Evaluation & Inference Diagnostic Tool
Tests model loading, benchmark inference latency, and validates prediction accuracy.
"""

import json
import time
from pathlib import Path
import numpy as np
import xgboost as xgb
from feature_mapper import ALL_MODEL_FEATURES, map_telemetry_to_features

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"


def run_inference_diagnostics():
    model_path = MODELS_DIR / "power_model.json"
    schema_path = MODELS_DIR / "feature_schema.json"
    metrics_path = MODELS_DIR / "metrics.json"
    
    if not model_path.exists():
        print(f"Error: Model file {model_path} not found. Run train.py first.")
        return
        
    # Load model
    model = xgb.XGBRegressor()
    model.load_model(str(model_path))
    
    # Load schema & metrics
    with open(schema_path, "r") as f:
        schema = json.load(f)
    with open(metrics_path, "r") as f:
        metrics = json.load(f)
        
    print(f"Model successfully loaded. Features: {len(schema['features'])}")
    print(f"Test R²: {metrics['r2']}, MAE: {metrics['mae_watts']} W, RMSE: {metrics['rmse_watts']} W")
    
    # Test sample telemetry inputs (Idle vs Loaded)
    samples = [
        {
            "name": "Idle Windows Laptop",
            "telemetry": {
                "cpu_utilization": 5.2,
                "memory_usage": 42.0,
                "disk_io": 0.5,
                "network_latency": 15.0,
                "process_count": 130,
                "thread_count": 1800,
                "context_switches": 4200,
                "temperature": 41.5,
                "uptime": 12.5
            }
        },
        {
            "name": "Heavy Multitasking / Render",
            "telemetry": {
                "cpu_utilization": 78.4,
                "memory_usage": 82.5,
                "disk_io": 84.0,
                "network_latency": 45.0,
                "process_count": 240,
                "thread_count": 3900,
                "context_switches": 38000,
                "temperature": 78.0,
                "uptime": 2.5
            }
        }
    ]
    
    for sample in samples:
        t0 = time.perf_counter()
        mapped_feats, warnings = map_telemetry_to_features(sample["telemetry"])
        
        # Build vector in exact schema order
        input_vector = np.array([[mapped_feats[feat] for feat in schema["features"]]])
        pred_w = float(model.predict(input_vector)[0])
        latency_ms = (time.perf_counter() - t0) * 1000.0
        
        print(f"\nScenario: {sample['name']}")
        print(f"Estimated Power: {pred_w:.2f} Watts")
        print(f"Inference Latency: {latency_ms:.3f} ms")
        if warnings:
            print(f"Warnings: {warnings}")


if __name__ == "__main__":
    run_inference_diagnostics()
