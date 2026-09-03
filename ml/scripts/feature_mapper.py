"""
GreenLedger - Feature Mapping & Preprocessing Layer
Maps raw Windows system telemetry to the ML training & inference feature schema.
"""

from typing import Dict, Any, List, Tuple
import numpy as np
import pandas as pd

# Core features selected for the regression model
BASE_MODEL_FEATURES = [
    "cpu_utilization",
    "memory_usage",
    "disk_io",
    "process_count",
    "thread_count",
    "uptime"
]

ENGINEERED_FEATURES = [
    "cpu_memory_ratio",
    "process_thread_ratio",
    "resource_pressure"
]

ALL_MODEL_FEATURES = BASE_MODEL_FEATURES + ENGINEERED_FEATURES


def compute_engineered_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes derived interaction features proven to improve power regression stability.
    """
    df_engineered = df.copy()
    
    # 1. CPU to Memory ratio (identifies compute-heavy vs memory-bound workloads)
    df_engineered["cpu_memory_ratio"] = df_engineered["cpu_utilization"] / (df_engineered["memory_usage"] + 1e-5)
    
    # 2. Average threads per process
    df_engineered["process_thread_ratio"] = df_engineered["thread_count"] / (df_engineered["process_count"] + 1e-5)
    
    # 3. Normalized resource pressure score (0-100 scale)
    clamped_disk = np.clip(df_engineered["disk_io"], 0.0, 100.0)
    df_engineered["resource_pressure"] = (
        (df_engineered["cpu_utilization"] * 0.50) + 
        (df_engineered["memory_usage"] * 0.35) + 
        (clamped_disk * 0.15)
    )
    
    return df_engineered


def map_telemetry_to_features(telemetry: Dict[str, Any]) -> Tuple[Dict[str, float], List[str]]:
    """
    Takes a raw telemetry dictionary from the Windows collector (or demo generator)
    and maps it to the strictly ordered ML feature schema.
    Returns:
        (mapped_features_dict, list_of_warnings)
    """
    warnings = []
    mapped = {}
    missing = [feature for feature in BASE_MODEL_FEATURES if telemetry.get(feature) is None]
    if missing:
        raise ValueError(
            "Cannot estimate power: required telemetry unavailable: " + ", ".join(missing)
        )

    mapped["cpu_utilization"] = float(np.clip(telemetry["cpu_utilization"], 0.0, 100.0))
    mapped["memory_usage"] = float(np.clip(telemetry["memory_usage"], 0.0, 100.0))
    mapped["disk_io"] = float(max(0.0, telemetry["disk_io"]))
    mapped["process_count"] = float(max(1, telemetry["process_count"]))
    mapped["thread_count"] = float(max(1, telemetry["thread_count"]))
    mapped["uptime"] = float(max(0.01, telemetry["uptime"]))
    
    # Compute derived interaction features
    mapped["cpu_memory_ratio"] = mapped["cpu_utilization"] / (mapped["memory_usage"] + 1e-5)
    mapped["process_thread_ratio"] = mapped["thread_count"] / (mapped["process_count"] + 1e-5)
    clamped_disk = min(100.0, mapped["disk_io"])
    mapped["resource_pressure"] = (
        (mapped["cpu_utilization"] * 0.50) + 
        (mapped["memory_usage"] * 0.35) + 
        (clamped_disk * 0.15)
    )
    return mapped, warnings
