"""
GreenLedger - Dataset Loader & Synthetic Benchmark Generator
Schema v1.1.0 physics (see docs/ml.md for literature grounding):

  P_total = P_idle + P_cpu(u, f) + P_ram + P_disk + P_display(B) + P_cooling + noise

  P_cpu(u, f)   = (0.35u + 0.002u^2) * (f / 3200)^1.5   (DVFS: P ~ C*V^2*f,
                  voltage roughly tracking frequency; exponent 1.5 is a
                  conservative middle between linear DFS and cubic DVS)
  P_display(B)  = 1.0 + 0.05*B  watts for brightness B in 0-100
                  (1W LCD panel floor + backlight; 6W max-min delta matches
                  NotebookCheck LCD measurements; backlight ~26-29% of system
                  power per Mahesri & Vardhan's laptop breakdown study)

Frequency model: f ~ 1200 + 25u (+noise), x0.82 when Power Saver is active
(sustained-clock reduction under load; ~0% effect at idle, matching published
Balanced-vs-Saver wall measurements), x cap factor on CPU-capped rows.
"""

import os
import glob
import logging
from pathlib import Path
from typing import Tuple, Dict, Any, Optional
import numpy as np
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("GreenLedger.DatasetLoader")

# Expected raw columns (v1.1.0 schema)
EXPECTED_COLUMNS = [
    "cpu_utilization",
    "memory_usage",
    "disk_io",
    "network_latency",
    "process_count",
    "thread_count",
    "context_switches",
    "cache_miss_rate",
    "temperature",
    "power_consumption",
    "uptime",
    "status",
    "screen_brightness",
    "cpu_frequency",
    "power_saver_active",
]

DATA_RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
DATA_PROCESSED_DIR = Path(__file__).resolve().parent.parent / "data" / "processed"


def generate_synthetic_dataset(output_path: Path, num_samples: int = 10000, random_seed: int = 42) -> pd.DataFrame:
    """
    Generates a physics-inspired, realistic IT resource and power consumption dataset
    matching the GreenLedger v1.1.0 schema (Kaggle IT metrics + display/DVFS signals).
    """
    logger.info(f"Generating realistic physics-calibrated benchmark dataset ({num_samples} samples)...")
    np.random.seed(random_seed)

    # Core system metrics
    cpu_util = np.random.beta(a=2.0, b=5.0, size=num_samples) * 100.0  # Skewed toward realistic 10-40% normal usage
    mem_usage = np.clip(np.random.normal(loc=55.0, scale=15.0, size=num_samples), 10.0, 98.0)

    # Disk I/O (MB/s or normalized ops)
    disk_io = np.clip(np.random.exponential(scale=15.0, size=num_samples), 0.1, 450.0)

    # Network latency in ms
    network_latency = np.clip(np.random.lognormal(mean=2.5, sigma=0.6, size=num_samples), 1.0, 250.0)

    # Processes & Threads
    process_count = np.random.randint(60, 350, size=num_samples)
    thread_count = process_count * np.random.randint(8, 24, size=num_samples)

    # Context switches per second
    context_switches = (process_count * 15 + thread_count * 4 + cpu_util * 120 + np.random.normal(0, 500, num_samples)).astype(int)
    context_switches = np.clip(context_switches, 500, 150000)

    # Cache miss rate (%)
    cache_miss_rate = np.clip(np.random.beta(a=2, b=8, size=num_samples) * 35.0 + (cpu_util / 100.0) * 10.0, 0.5, 50.0)

    # --- v1.1.0 signals ---
    # Display brightness (typical indoor range, uniform)
    screen_brightness = np.random.uniform(20.0, 100.0, size=num_samples)

    # Power Saver active on ~30% of rows
    power_saver_active = (np.random.uniform(size=num_samples) < 0.30).astype(int)

    # CPU-capped rows (~20%): max-processor-state style cap factor 0.55-0.80
    capped = np.random.uniform(size=num_samples) < 0.20
    cap_factor = np.where(capped, np.random.uniform(0.55, 0.80, size=num_samples), 1.0)

    # Sustained CPU frequency (MHz): rises with utilization, reduced by Saver
    # plan and by caps. Idle rows barely move (matches wall measurements).
    cpu_frequency = 1200.0 + 25.0 * cpu_util + np.random.normal(0, 150, size=num_samples)
    cpu_frequency = cpu_frequency * np.where(power_saver_active == 1, 0.82, 1.0) * cap_factor
    cpu_frequency = np.clip(cpu_frequency, 800.0, 4600.0)

    # Temperature (°C) - strongly driven by CPU utilization and ambient baseline (~38°C)
    temperature = 38.0 + (cpu_util * 0.42) + (mem_usage * 0.08) + np.random.normal(0, 2.5, num_samples)
    temperature = np.clip(temperature, 35.0, 98.0)

    # System uptime in hours
    uptime = np.clip(np.random.exponential(scale=72.0, size=num_samples), 0.1, 720.0)

    # Realistic Laptop/System Power Consumption Model (in Watts)
    # P_total = P_idle + P_cpu(u,f) + P_ram + P_disk + P_display + P_cooling + noise
    p_idle = 10.5
    dvfs_scale = (cpu_frequency / 3200.0) ** 1.5
    p_cpu = (0.35 * cpu_util + 0.002 * (cpu_util ** 2)) * dvfs_scale
    p_ram = 0.05 * mem_usage
    p_disk = 0.015 * disk_io
    p_display = 1.0 + 0.05 * screen_brightness
    p_cooling = np.where(temperature > 65.0, 0.08 * (temperature - 65.0), 0.0)
    noise = np.random.normal(0, 1.2, num_samples)

    power_consumption = np.clip(p_idle + p_cpu + p_ram + p_disk + p_display + p_cooling + noise, 8.0, 110.0)

    # Status: 0 = Normal, 1 = High-load / Warning
    status = np.where((cpu_util > 85.0) | (temperature > 85.0) | (power_consumption > 60.0), 1, 0)

    df = pd.DataFrame({
        "cpu_utilization": np.round(cpu_util, 2),
        "memory_usage": np.round(mem_usage, 2),
        "disk_io": np.round(disk_io, 2),
        "network_latency": np.round(network_latency, 2),
        "process_count": process_count,
        "thread_count": thread_count,
        "context_switches": context_switches,
        "cache_miss_rate": np.round(cache_miss_rate, 2),
        "temperature": np.round(temperature, 2),
        "power_consumption": np.round(power_consumption, 2),
        "uptime": np.round(uptime, 2),
        "status": status,
        "screen_brightness": np.round(screen_brightness, 1),
        "cpu_frequency": np.round(cpu_frequency, 1),
        "power_saver_active": power_saver_active,
    })

    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    logger.info(f"Synthetic benchmark dataset saved to {output_path} (Shape: {df.shape})")
    return df


def load_dataset(raw_data_path: Optional[str] = None) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Loads raw dataset from provided path or searches data/raw/*.csv.
    Performs data validation, type checking, and integrity analysis.
    Returns DataFrame and validation summary report.
    """
    target_file = None
    is_synthetic = False

    if raw_data_path and os.path.exists(raw_data_path):
        target_file = Path(raw_data_path)
    else:
        # Search DATA_RAW_DIR
        DATA_RAW_DIR.mkdir(parents=True, exist_ok=True)
        csv_files = glob.glob(str(DATA_RAW_DIR / "*.csv"))
        if csv_files:
            # Prefer non-sample file if available
            real_csvs = [f for f in csv_files if "sample_" not in os.path.basename(f)]
            target_file = Path(real_csvs[0]) if real_csvs else Path(csv_files[0])
            if "sample_" in target_file.name:
                is_synthetic = True
        else:
            # Generate calibrated synthetic benchmark
            fallback_file = DATA_RAW_DIR / "sample_it_metrics.csv"
            generate_synthetic_dataset(fallback_file)
            target_file = fallback_file
            is_synthetic = True

    logger.info(f"Loading dataset from: {target_file}")
    df = pd.read_csv(target_file)

    # Normalize column names (lowercase, strip whitespace)
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    # Validation analysis
    # Record the dataset path relative to the repository root so committed
    # metrics never leak a developer's local machine path or username.
    try:
        repo_root = Path(__file__).resolve().parent.parent.parent
        file_source = str(Path(target_file).resolve().relative_to(repo_root))
    except ValueError:
        file_source = str(target_file)
    validation_report = {
        "file_source": file_source,
        "is_synthetic": is_synthetic,
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "columns_present": list(df.columns),
        "missing_expected_columns": [col for col in EXPECTED_COLUMNS if col not in df.columns],
        "missing_values_by_column": df.isnull().sum().to_dict(),
        "duplicate_rows": int(df.duplicated().sum()),
        "target_summary": df["power_consumption"].describe().to_dict() if "power_consumption" in df.columns else {}
    }

    logger.info(f"Dataset summary: {validation_report['total_rows']} rows, {validation_report['total_columns']} columns")
    logger.info(f"Is synthetic / benchmark data: {validation_report['is_synthetic']}")

    return df, validation_report


if __name__ == "__main__":
    df, report = load_dataset()
    print("Dataset Inspection Successful:")
    print(f"Rows: {report['total_rows']}, Cols: {report['total_columns']}")
    print(f"Missing columns: {report['missing_expected_columns']}")
    print(f"Target power describe: {report['target_summary']}")
