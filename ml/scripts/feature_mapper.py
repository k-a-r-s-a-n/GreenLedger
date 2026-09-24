"""
GreenLedger - Feature Mapping & Preprocessing Layer
Maps raw Windows system telemetry to the ML training & inference feature schema.

Schema v1.1.0 adds the three signals v1.0 was blind to:
  screen_brightness   display backlight level 0-100 (WMI; ~26-29% of laptop
                      system power per Mahesri & Vardhan's breakdown study)
  cpu_frequency       sustained CPU clock in MHz (psutil; DVFS physics P~f)
  power_saver_active  1 when the Windows Power Saver scheme is active

Without these, brightness cuts and power-plan/DVFS effects measured ~0% even
when real watts dropped. v1.1 makes the instrument see the levers.
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
    "uptime",
    "screen_brightness",
    "cpu_frequency",
    "power_saver_active",
]

ENGINEERED_FEATURES = [
    "cpu_memory_ratio",
    "process_thread_ratio",
    "resource_pressure",
    "freq_util_product",
]

ALL_MODEL_FEATURES = BASE_MODEL_FEATURES + ENGINEERED_FEATURES

# Documented fallbacks for sensors that may be absent (external monitors without
# WMI brightness, powercfg query failures). Applied WITH a warning, never silently.
DEFAULT_BRIGHTNESS = 70.0  # typical indoor laptop setting
DEFAULT_POWER_SAVER = 0.0  # assume Balanced plan when unqueryable


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

    # 4. Frequency-utilization product (DVFS interaction: dynamic CMOS power
    # scales with activity x clock; P ~ C * V^2 * f).
    df_engineered["freq_util_product"] = (
        df_engineered["cpu_utilization"] * df_engineered["cpu_frequency"] / 1e6
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
    # Hard-required: the collector always provides these (psutil).
    required = ["cpu_utilization", "memory_usage", "disk_io", "process_count",
                "thread_count", "uptime", "cpu_frequency"]
    # The agent/demo send MHz under "cpu_frequency" (legacy key); accept the
    # explicit alias too. NOTE: dict.get(key, default) does NOT fall back when
    # the key exists with value None — which is exactly what a validated
    # TelemetryInput dumps (cpu_frequency_mhz=None alongside a good
    # cpu_frequency). Hence the explicit None check: without it every
    # schema-validated payload 422s here.
    freq_raw = telemetry.get("cpu_frequency_mhz")
    if freq_raw is None:
        freq_raw = telemetry.get("cpu_frequency")
    probe = dict(telemetry)
    probe["cpu_frequency"] = freq_raw
    missing = [feature for feature in required if probe.get(feature) is None]
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
    mapped["cpu_frequency"] = float(np.clip(freq_raw, 400.0, 6000.0))

    # Soft-required: documented fallback + warning when the sensor is absent.
    brightness_raw = telemetry.get("screen_brightness")
    if brightness_raw is None:
        warnings.append(
            f"Screen brightness unavailable; assuming {DEFAULT_BRIGHTNESS:.0f}% "
            "(external monitors often lack WMI brightness)."
        )
        mapped["screen_brightness"] = DEFAULT_BRIGHTNESS
    else:
        mapped["screen_brightness"] = float(np.clip(brightness_raw, 0.0, 100.0))

    saver_raw = telemetry.get("power_saver_active")
    if saver_raw is None:
        warnings.append("Power plan state unavailable; assuming Balanced (saver off).")
        mapped["power_saver_active"] = DEFAULT_POWER_SAVER
    else:
        mapped["power_saver_active"] = float(1.0 if saver_raw else 0.0)

    # Compute derived interaction features
    mapped["cpu_memory_ratio"] = mapped["cpu_utilization"] / (mapped["memory_usage"] + 1e-5)
    mapped["process_thread_ratio"] = mapped["thread_count"] / (mapped["process_count"] + 1e-5)
    clamped_disk = min(100.0, mapped["disk_io"])
    mapped["resource_pressure"] = (
        (mapped["cpu_utilization"] * 0.50) +
        (mapped["memory_usage"] * 0.35) +
        (clamped_disk * 0.15)
    )
    mapped["freq_util_product"] = mapped["cpu_utilization"] * mapped["cpu_frequency"] / 1e6
    return mapped, warnings
