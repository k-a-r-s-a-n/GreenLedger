# Invention Disclosure: Verified-Outcome Carbon Reduction Loop for Personal Computing

**Status:** Phase 4 working draft for patent counsel — not a filing. Maps
each inventive concept to the implementing code and to the prior-art
distinctions in `docs/patent-landscape.md`. Written so an engineer can
reimplement from this document plus the repository.

## Title

System and method for verified, uncertainty-aware energy and carbon
reduction on personal computing devices with a self-calibrating
recommender and verified-outcome incentive payouts.

## Field

Computer power management (G06F1/32), operational monitoring (G06F11/30),
ML-based estimation (G06N), and incentive/credit systems for energy
behavior (G06Q30).

## Problem (what the prior art leaves open)

1. Power-management systems predict and act but never verify the saving
   (US8190939B2: workload forecast → P-state; US10761584B2: idleness
   prediction → sleep; US11966274B2: carbon scores → power caps).
2. Carbon-incentive systems quantize declared behavior, not metered
   quantities (US20230038676A1), so payouts are unbound from physics.
3. No consumer system attaches calibrated uncertainty to energy estimates
   or tests intervention significance; savings are reported as naked point
   differences.
4. Recommender accuracy is never measured against verified outcomes, so
   prediction quality cannot improve with use.

## Summary of the invention

A closed loop in which the **verified action tuple** — (device state,
action taken, measured power outcome ± calibrated uncertainty,
predicted-vs-actual error) — is the atomic record. All downstream
functions (significance testing, incentive payout, recommender
calibration, future policy learning) consume tuples, never raw estimates.
Five interlocking concepts:

### Concept A — Drain-calibrated software power meter

A software estimator of whole-device watts from OS telemetry (CPU, memory,
frequency, display, power-plan, process signals) combined with a
**battery-drain-derived reference channel**: rolling discharge rate
(%/hr from ≥10-minute deltas) × design capacity (Wh, OS-exposed) yields an
independent watt reference used to calibrate and bound the estimator
without external metering hardware. Unknown sensors yield nulls that
propagate as documented fallbacks, never fabricated values.
Implementation: `agent/windows_metrics.py` (drain collector, capacity
probe), `ml/scripts/train.py` + `feature_mapper.py` (meter).

*Claim sketch: a method of estimating computing-device power consumption
comprising: collecting OS telemetry; estimating watts with a trained model;
independently deriving a reference wattage from measured battery discharge
rate and OS-reported design capacity; and calibrating/bounding the estimate
against the reference.*

### Concept B — Per-action verification with calibrated intervals

Each optimization action is evaluated by comparing median power snapshots
from stabilized before/after sample windows (quality-gated on sample count
and variance), where each snapshot carries a calibrated prediction
interval from a temporal quantile model, and the reduction is flagged
significant on interval non-overlap. Verification additionally requires
live telemetry, a safe-action whitelist, a minimum reduction threshold,
and telemetry-hash freshness. Implementation: `backend/services/
optimization/engine.py` (evaluate-delta), `backend/services/ml/temporal.py`
(LSTM intervals), `ml/scripts/train_temporal.py`.

*Claim sketch: verifying an energy-saving action by measuring stabilized
before/after power windows, attaching calibrated quantile intervals to each
window, and determining significance from interval separation — with payout
gated on the verified reduction.*

### Concept C — Self-calibrating recommender with breakeven and attention gates

Recommendations carry a predicted net saving (predicted gross watts minus
a per-action transition cost) and are withheld below a breakeven
threshold; process-termination candidates are ranked by an
attention-weighted score combining resource burn with user-attention
signals (foreground process, input idle), with the foreground process
excluded. The displayed prediction is echoed at verification time and
logged against the verified outcome; a calibration function reports
per-action prediction bias/MAE/RMSE over verified cycles, providing fitted
replacements for the initial heuristic constants. Implementation:
`backend/services/optimization/cost_models.py`,
`ml/scripts/calibration.py`, agent attention collector.

*Claim sketch: recommending energy actions with predicted net savings
gated by breakeven and user-attention criteria, then logging
predicted-vs-verified error per action and calibrating the prediction
models from the accumulated errors.*

### Concept D — Verified-outcome incentive payouts with anti-gaming

An incentive currency (credits, streaks, badges) minted exclusively from
verified reduction tuples: no verified watts, no payout. Server-side
anti-gaming binds each payout to live telemetry (non-live sources earn
nothing), action-hash uniqueness within a replay window, per-user velocity
caps, and measurement-window quality metadata — while verified
non-effects (participation cycles) are logged as training data without
payout. Implementation: engine + `backend/services/credits/`.

*Claim sketch: issuing energy-behavior incentives only against verified
power-reduction measurements cryptographically bound to live telemetry,
with replay/velocity/window-quality fraud controls, and logging unverified
or null-effect cycles as non-paying training records.*

### Concept E — Transition log as an offline-learning dataset

Every accepted cycle appends a structured record (state features,
action, verified outcome, intervals, significance flag, predicted-vs-actual
error) to an append-only log constituting a pre-registered dataset for
offline policy learning, where the reward signal is the verified measured
outcome rather than a modeled estimate. Implementation: transition log
writer, `ml/data/transitions/`, `docs/field-protocol.md` §5.

*Claim sketch: accumulating verified action-outcome tuples with
uncertainty and prediction-error annotations as an offline reinforcement
dataset in which agent training rewards derive from measured rather than
estimated energy outcomes.*

## Distinctions over closest prior art

- vs. US8190939B2 (Microsoft): '939 matches workload-history patterns to
  set processor states without measuring results. This invention predicts
  *watts net of transition cost* per user-facing action, measures the
  outcome with calibrated intervals, and learns from prediction error —
  different input (watts vs workload probabilities), different output
  (verified tuples vs state transitions), different feedback (calibration
  vs none). '939's breakeven analysis is pre-action cost accounting for
  hardware states; Concept C's breakeven gates user recommendations and is
  closed by post-action verification.
- vs. US10761584B2 (Vigyanlabs): idleness prediction → forced sleep, no
  per-action measurement, no uncertainty, no incentives, no calibration.
  No concept overlap beyond "a non-intrusive agent observes the device."
- vs. US20230038676A1 (Ant): behavior-declared savings from tables; this
  invention's payouts require metered/verified watt differences (Concept D
  excludes table-only quantization by construction).
- vs. US11966274B2: offline fleet coefficient optimization; no per-device
  estimation, no verification loop, no learning from outcomes.
- vs. Google carbon-aware computing (non-patent): defers flexible load in
  time; does not estimate device power, verify user actions, or pay
  incentives.

## Fallback positions (if the loop-as-a-whole is challenged)

1. Concept A alone (drain-rate reference channel for software meters).
2. Concept B alone (interval-overlap significance for energy interventions).
3. Concept C's calibration sub-loop (predicted-vs-verified error log +
   per-action bias reports driving fitted constants).
4. Concept D's verified-non-effect logging (paying nothing but training on
   everything).

## Reduction to practice

Repository state at Phase 4: all five concepts implemented and tested
(69 backend tests, `tsc` clean); evaluation reports committed under
`ml/reports/`; paper draft (`docs/paper.md`) discloses methods and
results. Real-hardware validation outstanding per `docs/field-protocol.md`
— counsel to advise on filing before vs. after field data.

## Inventorship notes (for counsel)

Conceived and reduced to practice by the GreenLedger authors (see git
history on `arena/01a0d272-greenledger`). No third-party code in the
claimed paths beyond open-source libraries (XGBoost, PyTorch, FastAPI).
Prior-art survey of record: `docs/patent-landscape.md` (2026-09-24).
