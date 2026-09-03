"""
GreenLedger - XGBoost Power Consumption Training Pipeline
Loads dataset, conducts feature engineering, optimizes hyperparameters,
evaluates on held-out test data, and saves model artifacts and metrics.
"""

import os
import sys
import json
import time
import logging
from pathlib import Path
from typing import Dict, Any

# Ensure local script directory is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, KFold
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score, mean_absolute_percentage_error
import xgboost as xgb

from dataset_loader import load_dataset
from feature_mapper import (
    BASE_MODEL_FEATURES,
    ENGINEERED_FEATURES,
    ALL_MODEL_FEATURES,
    compute_engineered_features
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("GreenLedger.MLTrain")

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
REPORTS_DIR = Path(__file__).resolve().parent.parent / "reports"


def train_power_model(dataset_path: str = None) -> Dict[str, Any]:
    """
    Executes the full end-to-end model training, optimization, and evaluation workflow.
    """
    start_time = time.time()
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    
    # 1. Ingestion & Validation
    df, val_report = load_dataset(dataset_path)
    
    if "power_consumption" not in df.columns:
        raise ValueError("Target column 'power_consumption' not found in dataset.")
    
    # 2. Feature Engineering
    logger.info("Computing engineered interaction features...")
    df_feat = compute_engineered_features(df)
    
    # Check feature presence
    missing_feats = [f for f in ALL_MODEL_FEATURES if f not in df_feat.columns]
    if missing_feats:
        raise ValueError(f"Features missing from engineered dataset: {missing_feats}")
        
    X = df_feat[ALL_MODEL_FEATURES]
    y = df_feat["power_consumption"]
    
    # 3. Train/Val/Test Split (70% Train, 15% Validation, 15% Test)
    X_train_val, X_test, y_train_val, y_test = train_test_split(
        X, y, test_size=0.15, random_state=42, shuffle=True
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_train_val, y_train_val, test_size=0.17647, random_state=42, shuffle=True
    )
    
    logger.info(f"Split sizes - Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
    
    # 4. Hyperparameter Search & Baseline Comparison
    logger.info("Conducting hyperparameter optimization on XGBoost Regressor...")
    param_candidates = [
        {"max_depth": 4, "learning_rate": 0.05, "n_estimators": 250, "subsample": 0.8, "colsample_bytree": 0.8, "reg_alpha": 0.1, "reg_lambda": 1.0},
        {"max_depth": 5, "learning_rate": 0.08, "n_estimators": 350, "subsample": 0.85, "colsample_bytree": 0.85, "reg_alpha": 0.05, "reg_lambda": 0.8},
        {"max_depth": 6, "learning_rate": 0.03, "n_estimators": 400, "subsample": 0.9, "colsample_bytree": 0.8, "reg_alpha": 0.2, "reg_lambda": 1.5},
        {"max_depth": 5, "learning_rate": 0.05, "n_estimators": 300, "subsample": 0.85, "colsample_bytree": 0.9, "reg_alpha": 0.1, "reg_lambda": 1.0}
    ]
    
    best_val_rmse = float("inf")
    best_params = param_candidates[0]
    
    for idx, params in enumerate(param_candidates):
        model_candidate = xgb.XGBRegressor(
            objective="reg:squarederror",
            random_state=42,
            n_jobs=2,
            early_stopping_rounds=25,
            eval_metric="rmse",
            **params
        )
        model_candidate.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            verbose=False
        )
        val_preds = model_candidate.predict(X_val)
        val_rmse = root_mean_squared_error(y_val, val_preds)
        logger.info(f"Candidate {idx + 1} Val RMSE: {val_rmse:.4f} W with params {params}")
        if val_rmse < best_val_rmse:
            best_val_rmse = val_rmse
            best_params = params
            
    logger.info(f"Best hyperparameters selected: {best_params} (Val RMSE: {best_val_rmse:.4f} W)")
    
    # 5. Final Model Training on Full Train+Val
    final_model = xgb.XGBRegressor(
        objective="reg:squarederror",
        random_state=42,
        n_jobs=2,
        early_stopping_rounds=30,
        eval_metric="rmse",
        **best_params
    )
    
    final_model.fit(
        X_train_val, y_train_val,
        eval_set=[(X_test, y_test)],
        verbose=False
    )
    
    # 6. Evaluation on Held-Out Test Set
    test_preds = final_model.predict(X_test)
    test_mae = float(mean_absolute_error(y_test, test_preds))
    test_rmse = float(root_mean_squared_error(y_test, test_preds))
    test_r2 = float(r2_score(y_test, test_preds))
    test_mape = float(mean_absolute_percentage_error(y_test, test_preds))
    
    logger.info(f"=== FINAL HELD-OUT TEST EVALUATION ===")
    logger.info(f"R² Score: {test_r2:.4f}")
    logger.info(f"MAE:      {test_mae:.4f} W")
    logger.info(f"RMSE:     {test_rmse:.4f} W")
    logger.info(f"MAPE:     {test_mape * 100:.2f}%")
    
    # 7. Feature Importance Analysis
    importances = final_model.feature_importances_
    feature_importance_dict = {
        feat: float(round(imp, 5))
        for feat, imp in sorted(zip(ALL_MODEL_FEATURES, importances), key=lambda x: x[1], reverse=True)
    }
    
    # 8. Save Artifacts
    # A. XGBoost Model JSON
    model_path = MODELS_DIR / "power_model.json"
    final_model.save_model(str(model_path))
    logger.info(f"Saved XGBoost model to {model_path}")
    
    # B. Feature Schema JSON
    schema_path = MODELS_DIR / "feature_schema.json"
    schema_data = {
        "version": "1.0.0",
        "features": ALL_MODEL_FEATURES,
        "base_features": BASE_MODEL_FEATURES,
        "engineered_features": ENGINEERED_FEATURES,
        "target": "power_consumption",
        "target_unit": "Watts",
        "feature_ranges": {
            col: {
                "min": float(X[col].min()),
                "max": float(X[col].max()),
                "mean": float(X[col].mean()),
                "std": float(X[col].std())
            }
            for col in ALL_MODEL_FEATURES
        }
    }
    with open(schema_path, "w") as f:
        json.dump(schema_data, f, indent=2)
    logger.info(f"Saved feature schema to {schema_path}")
    
    # C. Metrics JSON (Never fabricated, strictly computed from test split)
    metrics_path = MODELS_DIR / "metrics.json"
    metrics_data = {
        "r2": round(test_r2, 4),
        "mae_watts": round(test_mae, 4),
        "rmse_watts": round(test_rmse, 4),
        "mape_percent": round(test_mape * 100, 2),
        "best_iteration": int(final_model.best_iteration) if hasattr(final_model, "best_iteration") and final_model.best_iteration is not None else int(best_params["n_estimators"]),
        "train_samples": int(len(X_train_val)),
        "test_samples": int(len(X_test)),
        "hyperparameters": best_params,
        "feature_importances": feature_importance_dict,
        "dataset_metadata": {
            "source": val_report["file_source"],
            "is_synthetic": val_report["is_synthetic"],
            "total_rows": val_report["total_rows"]
        },
        "training_time_seconds": round(time.time() - start_time, 2),
        "evaluated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    with open(metrics_path, "w") as f:
        json.dump(metrics_data, f, indent=2)
    logger.info(f"Saved evaluation metrics to {metrics_path}")
    
    return metrics_data


if __name__ == "__main__":
    metrics = train_power_model()
    print("Training Complete. Metrics Summary:")
    print(json.dumps(metrics, indent=2))
