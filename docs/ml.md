# Machine Learning Pipeline & Evaluation Documentation

## Overview
GreenLedger employs an **XGBoost Regressor** trained to predict whole-system electrical power consumption in Watts based on real-time computational workload metrics.

---

## Dataset & Schema Conformance (v1.1.0)
The training schema extends the Kaggle IT System Performance and Resource Metrics specification with display + DVFS signals:
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
- `screen_brightness` (0 – 100, WMI; v1.1.0+)
- `cpu_frequency` (sustained MHz, psutil; v1.1.0+)
- `power_saver_active` (0/1 from powercfg; v1.1.0+)
- `power_consumption` (**Target Variable in Watts**)

### Why v1.1.0 exists
v1.0 modeled power from utilization alone, so three real levers measured ~0%:
brightness cuts, power-plan switches, and frequency caps all change watts
through clocks and backlight — signals the model never saw. v1.1.0 adds them,
so the instrument can verify the actions the app performs.

---

## Synthetic Physics (v1.1.0)
`P_total = P_idle + P_cpu(u,f) + P_ram + P_disk + P_display + P_cooling + noise`

- `P_cpu(u,f) = (0.35u + 0.002u²) · (f/3200)^1.5` — DVFS form `P ~ C·V²·f` with a
  conservative exponent between linear DFS and cubic DVS; frequency follows
  `f ~ 1200 + 25u` (×0.82 under Power Saver, ×cap on capped rows).
- `P_display(B) = 1.0 + 0.05·B` — 1W LCD panel floor + linear backlight; the 6W
  max–min delta matches NotebookCheck LCD measurements.
- Power Saver barely moves idle rows, matching published Balanced-vs-Saver
  wall measurements (~0% at idle, ~18% at full load vs High Performance).

Literature grounding: Mahesri & Vardhan (laptop component breakdown, backlight
~26–29% of system power); Weissel & Bellosa (DVFS diminishing returns);
standard CMOS DVFS surveys (`P = C·V²·f`).

---

## Engineered Interaction Features
1. `cpu_memory_ratio = cpu_utilization / (memory_usage + 1e-5)`
2. `process_thread_ratio = thread_count / (process_count + 1e-5)`
3. `resource_pressure = (cpu_utilization * 0.50) + (memory_usage * 0.35) + (min(disk_io, 100) * 0.15)`
4. `freq_util_product = cpu_utilization * cpu_frequency / 1e6` (v1.1.0+: DVFS interaction)

---

## Verified Evaluation Results (Held-Out Test Split)

| Metric | Result | Description |
|---|---|---|
| **$R^2$ Score** | See `ml/models/metrics.json` | Computed from the current held-out test split |
| **MAE** | See `ml/models/metrics.json` | Computed from the current held-out test split |
| **RMSE** | See `ml/models/metrics.json` | Computed from the current held-out test split |
| **MAPE** | **4.46%** | Current synthetic held-out test split in `ml/models/metrics.json` |
| **Inference Latency** | Runtime-measured | Captured per inference response, not produced by training |

---

## Action Evaluation Protocol (the headline number, honestly)
`ml/scripts/evaluate_actions.py` runs N before/after trials per action on
**frozen persona baselines** and reports mean reduction ± 95% CI, with the full
trial log written to `ml/reports/eco_evaluation.json`. Frozen baseline + trial
log is what makes a claim defensible — anyone can re-run the file.

Latest headline (`--persona student_typical`, n=20): **Eco Mode 43.2% ± 1.3%**
power reduction (carbon % equals power % — same grid factor). Heavy baselines
measure higher (~63%), already-efficient machines lower (~12%): the % always
depends on starting state, which is why the baseline is frozen and published.

---

## Technical Honesty & Hardware Disclosure
Windows laptops do not expose a direct whole-system Watt sensor. The model predicts **Estimated Power**. The UI explicitly distinguishes between estimated power and measured power counters where exposed.
