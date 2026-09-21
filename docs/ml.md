# Machine Learning Pipeline & Evaluation Documentation

## Overview
GreenLedger employs an **XGBoost Regressor** trained to predict whole-system electrical power consumption in Watts based on real-time computational workload metrics.

---

## Dataset & Schema Conformance
The training schema follows the Kaggle IT System Performance and Resource Metrics specification:
- `cpu_utilization` (0.0 – 100.0%)
- `memory_usage` (0.0 – 100.0%)
- `disk_io` (MB/s throughput)
- `network_latency` (ping in ms)
- `process_count` (active tasks)
- `thread_count` (active threads)
- `context_switches` (CPU context switch rate)
- `cache_miss_rate` (cache miss percentage)
- `temperature` (Celsius)
- `uptime` (hours)
- `power_consumption` (**Target Variable in Watts**)

---

## Engineered Interaction Features
Through exploratory data analysis and physical CMOS power considerations, four derived features are calculated:
1. `cpu_memory_ratio = cpu_utilization / (memory_usage + 1e-5)`
2. `process_thread_ratio = thread_count / (process_count + 1e-5)`
3. `resource_pressure = (cpu_utilization * 0.50) + (memory_usage * 0.35) + (min(disk_io, 100) * 0.15)`
4. `cpu_temp_interaction = (cpu_utilization * temperature) / 100.0`

---

## Verified Evaluation Results (Held-Out Test Split)

| Metric | Result | Description |
|---|---|---|
| **$R^2$ Score** | See `ml/models/metrics.json` | Computed from the current held-out test split |
| **MAE** | See `ml/models/metrics.json` | Computed from the current held-out test split |
| **RMSE** | See `ml/models/metrics.json` | Computed from the current held-out test split |
| **MAPE** | **4.10%** | Current synthetic held-out test split in `ml/models/metrics.json` |
| **Inference Latency** | Runtime-measured | Captured per inference response, not produced by training |

---

## Technical Honesty & Hardware Disclosure
Windows laptops do not expose a direct whole-system Watt sensor. The model predicts **Estimated Power**. The UI explicitly distinguishes between estimated power and measured power counters where exposed.
