# GreenLedger: Verified, Uncertainty-Aware Carbon Reduction for Personal Computing

**Draft — Phase 4.** All quantitative claims below are cited from
`ml/reports/results_summary.json` (aggregated by
`ml/scripts/summarize_results.py`); no number in this draft is hand-computed.
Companion documents: `docs/patent-landscape.md` (prior art),
`docs/invention-disclosure.md` (novelty claims),
`docs/field-protocol.md` (the real-hardware validation this draft does not
yet have).

## Abstract

Personal computers draw a growing share of electricity, yet consumer-facing
"eco" tools report savings they never measure: a before/after comparison
with no uncertainty, no verification, and no binding between the claimed
saving and any metered quantity. GreenLedger closes that gap with a
closed-loop system: (1) a software power meter estimating device watts from
OS telemetry (XGBoost, held-out MAE 0.98 W, 5-seed R² 0.9606 ± 0.0013);
(2) a quantile LSTM over trailing telemetry that attaches calibrated 80%
prediction intervals to every estimate (coverage 0.799, width 3.16 W);
(3) a verification protocol that measures each optimization action
before/after with median windows, interval overlap significance, and
battery-drain ground truth; (4) a self-calibrating recommender that predicts
net savings per action and logs predicted-vs-verified error for every cycle;
and (5) green credits minted only from verified, hash-bound, anti-gamed
measurements. On synthetic-but-physics-grounded trials the stacked Eco Mode
bundle measures 43.2% ± 1.3% power reduction. We report honestly what is
synthetic, what is heuristic, and what real-hardware validation remains —
specified in the field protocol — because a carbon claim without a stated
uncertainty is marketing, not measurement.

## 1. Introduction

Two facts collide in personal computing. First, the grid impact of billions
of PCs is large and growing, and operating-system power management leaves
substantial savings on the table (aggressive boost behavior, background
indexers, full-brightness displays). Second, every consumer tool that claims
to save energy reports a number it never earned: typically a point estimate
difference with no confidence interval, no verification that the action
caused the change, and no defense against trivial gaming.

The research literature attacks pieces of this problem — software power
modeling, workload forecasting for power states, carbon-aware datacenter
scheduling — but always with a gap between prediction and verified outcome.
The patent literature (surveyed in `docs/patent-landscape.md`) shows the
same pattern: Microsoft's US8190939B2 forecasts workload to set P-states
without ever verifying the saving; Vigyanlabs' US10761584B2 predicts idleness
to force sleep states, enterprise-scoped, with no per-action verification;
Ant's US20230038676A1 quantizes lifestyle behavior into carbon savings with
no meter binding at all.

GreenLedger's thesis: **the unit of progress is the verified action** — a
(state, action, measured outcome ± uncertainty) tuple — and everything else
(credits, calibration, policy learning) must derive from tuples, never from
unverified estimates. Our contributions:

1. A software power meter for Windows devices from OS telemetry, with a
   battery-drain-derived ground-truth channel (discharge %/hr × design
   capacity) for real-hardware calibration.
2. A temporal quantile LSTM producing calibrated 80% intervals that beat
   tree baselines on noisy episodes (median MAE 0.99 W vs 1.33 W tick-XGB).
3. A verification protocol: median snapshot windows, OOD flagging,
   interval-overlap significance, and a 5% minimum reduction rule.
4. A self-calibrating recommender: predicted net watts per action
   (breakeven-gated), attention-weighted process ranking, and a
   predicted-vs-verified calibration log no surveyed system keeps.
5. An incentive layer (green credits, streaks, badges) with server-side
   anti-gaming: live-only verification, telemetry hashing, replay windows,
   velocity caps.

## 2. Related Work

**Software power modeling.** RAPL interfaces expose package power on Intel
platforms, but no whole-device signal; the psys domain approximates platform
power where available. Prior ML power predictors (e.g., Chromebook
mean+std models at ~0.39 W RMSE) target specific hardware with metered
training data. We instead train on physics-grounded synthetic telemetry and
design the ground-truth channel (battery drain rate) for per-device
calibration in the field.

**Predictive power management.** US8190939B2 (Microsoft/Horvitz, 2009)
remains the landmark: workload forecasting → P-state/C-state transitions
with breakeven analysis. Follow-ons cover sleep-state gating (Intel),
cluster capacity switching, and prediction-based endpoint management
(Vigyanlabs US10761584B2). All predict-then-act; none verify-then-learn.

**Carbon-aware computing.** Google's Carbon-Intelligent Compute shifts
flexible datacenter load against day-ahead carbon-intensity forecasts;
Microsoft's 2026 sustainability-scheduler filing extends the idea to
device-scheduled actions. These optimize *when* flexible load runs. We
optimize *what the user does* about their device, with verified payouts —
complementary, not competing.

**Behavioral carbon incentives.** Ant Forest (US20230038676A1 family)
quantizes app behavior into per-user carbon savings at massive scale, but
from lookup tables over declared behavior. Our incentive layer differs
structurally: every credited gram traces to a verified watt difference.

| System | Predicts power | Verifies actions | Uncertainty | Learns from outcomes | Incentives |
|---|---|---|---|---|---|
| MS US8190939B2 | workload, not watts | no | no | no | no |
| Vigyanlabs '584/'677 | no (idleness/app) | no | no | no | no |
| GA capping '274 | carbon scores | no | no | no | no |
| Ant Forest | no (tables) | no | no | no | yes, unverified |
| Google CICS | CPU-proxy | fleet-level | risk-aware | yes (demand) | no |
| **GreenLedger** | **yes (watts)** | **yes, per action** | **yes, calibrated** | **yes (calibration log)** | **yes, verified-bound** |

## 3. System Architecture

```
Windows agent (psutil/CIM/ctypes) ──telemetry──▶ Next.js frontend ──▶ FastAPI backend
        │                                                              │      │
  30+ signals + attention                                       XGB meter   LSTM intervals
  + drain-rate probe                                                   │      │
                                                                       ▼      ▼
                                                              Optimization engine ──▶ verify ──▶ credits
                                                              (rules + cost models)   (5% rule,   (hash-bound,
                                                               + breakeven gate)       intervals)   anti-gamed)
                                                                                          │
                                                                          transition log ◀┘
                                                                     (state, action, verified outcome,
                                                                      predicted-vs-actual, intervals)
```

The agent collects CPU/memory/disk/network/GPU/display/battery/process
telemetry plus user-attention signals (foreground process, input idle) and a
10-minute rolling battery drain rate. The backend serves the point meter
(`POST /api/ml/predict`), sequence intervals
(`POST /api/ml/predict-sequence`), recommendations with predicted net watts,
and verified delta evaluation. Every accepted cycle appends one JSONL record
to the transition log — the dataset for calibration today and offline policy
learning tomorrow.

## 4. Methods

### 4.1 Point power meter

XGBoost regressor on 13 features: 6 core OS signals, engineered interactions
(`freq_util_product` capturing DVFS physics P~f·u, `resource_pressure`,
ratios), and v1.1 display/power-plan signals (`screen_brightness`,
`cpu_frequency`, `power_saver_active`). Training: 4-candidate grid,
70/15/15 split, seed 42, early stopping on validation RMSE. Serving carries
the training feature schema, OOD bounds (physical extremes ± 3σ margin),
and per-prediction latency. Full pipeline: `ml/scripts/train.py`.

### 4.2 Temporal quantile model

A 2-layer LSTM (128 hidden, 205,699 params) ingests trailing telemetry
windows and emits q10/q50/q90 per tick under pinball loss. Training episodes
(1,500 × 30 ticks, seed 42) combine AR(1) utilization/thermal regimes with
action-like events (power cap, brightness change, app close) under the same
v1.1 physics as the point model. Splits are by episode — no tick leakage.
Serving is optional infrastructure: without torch or the artifact, the
endpoint answers 503 and the application degrades to point estimates.

### 4.3 Verification protocol

Each optimization cycle collects median snapshot windows before/after (≥3
stabilized samples, CPU σ ≤ 8 pp, memory σ ≤ 6 pp or the window is
rejected). Reduction % = (P_before − P_after)/P_before from the meter.
Verification requires: live telemetry (`is_live`), safe-action whitelist,
≥5% reduction, telemetry hash distinct from recent cycles (replay guard),
and per-user velocity caps. When sample windows are supplied, the LSTM
attaches 80% intervals to each snapshot; non-overlap marks the reduction
significant. Credits = f(verified watts, CO₂ @ 0.385 kg/kWh) only.

### 4.4 Self-calibrating recommender

Each action carries a cost model: predicted gross watts minus transition
cost (e.g., process-kill gross = CPU share × power × 0.7 marginal factor,
cost = 0.5 W amortized restart risk). Cards below 0.25 W predicted net are
withheld (breakeven gate); the foreground process is never a kill candidate
(safety gate via attention signals). The card's prediction is echoed into
evaluation and logged against the verified outcome; `calibration.py`
reports per-action bias/MAE/RMSE. Current constants are documented
heuristics v1 — the log exists to fit them.

### 4.5 Incentive layer with anti-gaming

Credits, streaks, badges, and a reward marketplace, all server-side.
Threat model: demo-telemetry farming (live-only rule), replay (hash +
window), velocity abuse (caps), window cherry-picking (quality metadata
rejection). Participation cycles (verified non-effects) earn nothing but are
logged — verified non-effects are training data.

## 5. Evaluation

All tables from `results_summary.json`. Data honesty: point-model and
temporal results are on synthetic physics-grounded data (smooth enough that
linear regression nearly ties XGBoost — reported, not buried); action
trials are model-estimated deltas; the calibration log awaits real cycles.

### 5.1 Point meter

| Metric | Seed-42 test | 5-seed mean ± 95% CI |
|---|---|---|
| R² | 0.9592 | 0.9606 ± 0.0013 |
| MAE | 0.98 W | 0.99 W |
| RMSE | 1.22 W | 1.25 W |
| MAPE | 4.46% | 4.44% |

Seed-stable (±0.0013 R²): the headline is not a lucky split.

### 5.2 Benchmark and ablations

| Config | R² | MAE (W) |
|---|---|---|
| XGB full (13 feat) | 0.9606 ± 0.0013 | 0.99 |
| XGB w/o `freq_util_product` | 0.9601 ± 0.0014 | 0.99 |
| XGB v1.0 features (9) | 0.8048 ± 0.0126 | 2.01 |
| XGB top-3 only | 0.9121 ± 0.0035 | 1.49 |
| Linear (13 feat) | 0.9592 ± 0.0011 | 1.01 |
| Mean predictor | ≈ 0 | 4.50 |

v1.1 signals are load-bearing (−0.16 R² without them). The DVFS product term
adds ~nothing over the raw pair (kept for interpretability). Linear tying
XGB indicts the data's smoothness, not the model — motivating drain-rate
ground truth and real-hardware evaluation.

### 5.3 Temporal intervals

| Model | Median MAE (W) | 80% coverage | Width (W) |
|---|---|---|---|
| LSTM (history window) | **0.99** | **0.799** | 3.16 |
| XGB current tick | 1.33 | — | — |
| XGB flattened window | 1.13 | — | — |

Quantile calibration: P(y ≤ q10) = 0.096, P(y ≤ q50) = 0.501,
P(y ≤ q90) = 0.895. The flattened-window control isolates recurrence (not
information) as the source of the win: the LSTM smooths per-tick
observation noise. Deterministic retrain verified (identical metrics).

### 5.4 Action trials (frozen baseline, n=20, 95% CI)

| Action | Mean reduction | 95% CI half-width | Range |
|---|---|---|---|
| Eco Mode bundle | **43.2%** | 1.3% | 37.3–47.8% |
| Cap CPU 55% | 24.5% | 0.9% | 19.8–28.5% |
| Close heavy app | 21.8% | 2.1% | 10.0–28.7% |
| Enable power saver | 11.1% | 0.8% | 8.2–14.1% |
| Brightness → 35% | 9.7% | 0.2% | 8.8–10.9% |

Model-estimated deltas on the `student_typical` persona; carbon % equals
power % under the fixed grid factor. The bundle's sub-additivity (43.2% <
sum of parts) is expected: levers overlap on the same baseline watts.

### 5.5 Calibration status

No verified cycles with predictions exist yet outside smoke tests
(calibration report: null). The loop is implemented and tested; the field
protocol (§7 of that doc) specifies how the first fitted constants get
published. We claim the mechanism, not the fit.

## 6. Limitations and Threats to Validity

1. **Synthetic training data.** Both models train on generated telemetry.
   The physics grounding (DVFS P~f·u, thermal regimes, display share) is
   principled but unvalidated against meters — the field protocol's job 1.
2. **Fixed carbon factor.** 0.385 kg/kWh ignores regional and temporal grid
   variation; carbon claims inherit this error directly. Live intensity
   integration is specified future work.
3. **Windows-only agent.** Attention signals, CIM capacity, and power-plan
   actuation are Windows paths; other platforms get degraded honesty (nulls),
   not support.
4. **Model-estimated action trials.** §5.4 measures the meter's *beliefs*
   about actions, not metered outcomes — a consistency check, not an
   efficacy claim. Efficacy requires the field protocol.
5. **Heuristic v1 cost models.** Predicted-net constants are documented
   guesses awaiting calibration data; the breakeven gate inherits their
   error until fitted.

## 7. Future Work

Field validation per `docs/field-protocol.md` (drain-rate calibration,
metered action trials, fitted cost constants); offline-RL policy pre-trained
on the transition log with the verified-outcome reward; live grid-intensity
provider for time-aware carbon math and flexible-load guidance; cross-device
federated calibration without raw telemetry leaving the device.

## 8. Conclusion

GreenLedger reframes personal-computing carbon reduction around the verified
action: predict watts, act safely, measure with uncertainty, pay only for
verified grams, and learn from every prediction error. The system is built,
the loop is closed in software, and every number in this draft regenerates
from committed scripts. What remains is the field — and the protocol for it
is written.

## Reproducibility

- `ml/scripts/train.py` → `ml/models/{power_model,metrics}.json`
- `ml/scripts/benchmark.py` → `ml/reports/model_benchmark.json`
- `ml/scripts/temporal_dataset.py` + `train_temporal.py` → `temporal_lstm.pt`, `temporal_benchmark.json`
- `ml/scripts/evaluate_actions.py` → `eco_evaluation.json`
- `ml/scripts/summarize_results.py` → `results_summary.json` (this draft's source)
- Backend: 69 tests (`pytest backend/tests/`); frontend: `tsc --noEmit`.

## References

Papers: Radovanovic et al., "Carbon-Aware Computing for Datacenters" (2021);
Chromebook ML power prediction, MLforSystems @ NeurIPS 2022; offline-RL
power-capping controller, arXiv:2601.11352; Q-learning DVFS (2024);
Jolpe survey on RL for power management (Southampton eprints).
Patents: US8190939B2, US10761584B2, US11269677B2, US11966274B2,
US12189449B2, US20230038676A1, US20140114867A1, US10396581B2 —
full analysis in `docs/patent-landscape.md`.
