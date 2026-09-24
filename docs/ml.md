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

## Benchmark: Multi-Seed, Baselines, Ablations (Phase 1)
`ml/scripts/benchmark.py` (report: `ml/reports/model_benchmark.json`) runs every
config on 5 seeds (70/15/15 each; production hyperparameters, grid not re-run
per seed). Full-run results (mean ± 95% CI):

| Config | R² | MAE (W) | MAPE |
|---|---|---|---|
| XGB full (13 feat) | 0.9606 ± 0.0013 | 0.99 | 4.44% |
| XGB no `freq_util_product` | 0.9601 ± 0.0014 | 0.99 | 4.47% |
| XGB v1.0 features (9 feat) | 0.8048 ± 0.0126 | 2.01 | 8.51% |
| XGB top-3 only | 0.9121 ± 0.0035 | 1.49 | 6.77% |
| Linear regression (13 feat) | 0.9592 ± 0.0011 | 1.01 | 4.52% |
| Mean predictor | ≈ 0 | 4.50 | 18.79% |

Honest reading:
- Metrics are **seed-stable** (±0.0013 R²) — the headline is not a lucky split.
- The v1.1 signals (frequency/brightness/saver) are **load-bearing**: dropping
  them costs 0.16 R². The v1.1 story holds.
- `freq_util_product` adds ~nothing over the raw (frequency, utilization) pair
  — trees re-learn the interaction. It stays for interpretability (the
  explanation panel's dominant term) and convergence, not accuracy.
- **Linear regression nearly ties XGBoost** on this data: the synthetic
  generator is smooth enough that a linear model fits it. This is precisely
  why Phase 1 adds real-hardware ground truth (battery drain rate) and Phase 2
  evaluates on real noisy data — model-class comparisons are only meaningful
  there. We report this rather than bury it.

## Temporal Model: Quantile LSTM (Phase 2)

The point model answers "how much power now" but not "how sure". Phase 2 adds
a sequence model with prediction intervals, trained on synthetic telemetry
episodes and served as an optional complement (never a dependency).

- **Data**: `ml/scripts/temporal_dataset.py` generates 1,500 episodes × 30
  ticks (seed 42) with AR(1) utilization/thermal regimes and action-like
  events (power-cap, brightness, app-close), under the same v1.1 physics.
  Artifact: `ml/data/processed/temporal_episodes.npz` (regenerable).
- **Model**: 2-layer LSTM (128 hidden, ~200k params) with q10/q50/q90 heads,
  pinball loss, episode-level 70/15/15 split. Artifact:
  `ml/models/temporal_lstm.pt` (weights + norm stats + config).
- **Training**: `ml/scripts/train_temporal.py` (report:
  `ml/reports/temporal_benchmark.json`). `--fast` is a smoke path and writes
  `*_fast` artifacts only — it can never overwrite production weights.

Results on identical held-out episodes (median MAE in W):

| Config | MAE | 80% coverage | Width |
|---|---|---|---|
| LSTM median (history window) | **0.99** | 0.799 | 3.16 W |
| XGB current tick (production) | 1.33 | — | — |
| XGB flattened window | 1.13 | — | — |

Quantile calibration: P(y ≤ q10) = 0.096, P(y ≤ q50) = 0.501,
P(y ≤ q90) = 0.895 — the intervals mean what they say. The LSTM beats both
tree baselines because recurrence smooths per-tick observation noise; the
flattened-window XGB control isolates this to the architecture, not the
information.

Honest reading: this gap is measured on synthetic episodes whose noise model
(AR(1) + Gaussian) favors smoothing. Real-hardware validation against the
Phase 1 drain-rate ground truth is the next bar. Serving degrades gracefully:
without torch or the artifact, `/predict-sequence` answers 503 and delta
intervals come back null while point estimates keep working.

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
