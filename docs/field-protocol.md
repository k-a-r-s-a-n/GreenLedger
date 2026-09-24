# Field Validation Protocol: From Synthetic to Metered

**Purpose.** The paper draft (§6) is explicit: models train on synthetic
telemetry, action trials are model-estimated, cost constants are heuristic.
This protocol specifies exactly how each claim graduates to metered truth —
so the next phase produces evidence, not adjectives. Each job below lists
its setup, procedure, acceptance bar, and the artifact it commits.

## Job 0 — Test-bench setup (one-time)

- **Devices.** ≥3 Windows laptops spanning iGPU/dGPU and ≥2 vendors (battery
  capacities differ; the drain channel must prove out across chemistries).
- **Ground truth.** One external USB power meter (e.g., pass-through
  wattmeter on the AC adapter) for wall power; RAPL psys readings where
  exposed as a secondary reference. Log wall watts at 1 Hz, time-synced
  (NTP) with agent telemetry.
- **Build.** Agent + backend at the Phase 4 commit; transition log path set
  per device (`GREENLEDGER_TRANSITION_LOG`); LSTM available (torch CPU).
- **Artifact.** `docs/field-bench.md` — device inventory, meter model,
  sync method. No measurements without this file.

## Job 1 — Drain-rate channel validation

- **Procedure.** On battery, step through 4 load levels (idle, video,
  compile, compile+display-100%) holding 20 min each. Record agent
  `battery_drain_w` (10-min rolling) against wall-meter watts (AC
  reconnected at matched load) and RAPL psys.
- **Bar.** Drain-watts within ±15% of wall watts across levels after
  subtracting a fitted charger-efficiency offset; monotonic in load;
  `None` (never a value) while plugged/charging.
- **Artifact.** CSV pairs + a short report committed under
  `ml/data/field/drain_validation/`; fitted offset documented, not
  hardcoded.

## Job 2 — Meter calibration on real telemetry

- **Procedure.** Collect ≥40 hours of agent telemetry with synced wall
  power across normal use (no scripting — real sessions). Retrain the XGB
  meter on real (telemetry → wall watts) pairs; compare against the
  synthetic-trained meter on a held-out real week.
- **Bar.** Publish both MAEs. Success = real-trained MAE ≤ 2.5 W and a
  documented error-vs-load curve (where the meter is weak is a finding).
  If the synthetic meter transfers within 20%, report that too — transfer
  is the interesting result either way.
- **Artifact.** `ml/models/power_model.field.json` + `metrics.field.json`
  (never overwrite synthetic artifacts); training script flag
  `--data field`.

## Job 3 — Metered action trials

- **Procedure.** Per action (saver, brightness, cap, kill, eco): ≥10
  before/after cycles on ≥2 devices, wall meter as arbiter, agent windows
  as the system under test. Compare VERIFIED reduction (our pipeline)
  against METERED reduction (wall).
- **Bar.** Mean absolute disagreement ≤ 3 pp on reduction % for the
  bundle; per-action bias published whatever it is. Interval coverage of
  the metered value inside our 80% window reported (target ≥ 0.7 on first
  pass — calibration, not celebration).
- **Artifact.** `ml/reports/field_action_trials.json` in the same schema
  as `eco_evaluation.json` plus `metered_*` fields.

## Job 4 — Fitted cost constants

- **Procedure.** Run `ml/scripts/calibration.py` on the accumulated field
  transition log (needs ≥30 verified cycles per action for a fit worth
  publishing). Replace heuristic v1 constants with fitted values + CIs;
  keep v1 as the documented fallback for cold devices.
- **Bar.** Overall calibration MAE improves vs v1 on a held-out month of
  cycles; per-action bias within ±1 W. Publish the fit table in the paper's
  §5.5 replacement.
- **Artifact.** `cost_models.py` v2 constants + `ml/reports/calibration.json`
  (field-derived, committed only with its n disclosed).

## Job 5 — Offline policy pre-training (gated on Jobs 1–4)

- **Procedure.** Train a conservative offline-RL policy (CQL or BCQ —
  no online exploration on user devices, ever) on the field transition log:
  state = meter + attention + regime features, action = safe-action set,
  reward = verified watts. Evaluate by off-policy evaluation (FQE) AND by
  shadow mode (policy proposes, human/system disposes, log agreement).
- **Bar.** Shadow-mode agreement with breakeven-gated rules ≥ 80% before
  any proposal to act; OPE-estimated improvement published with CIs.
  No autonomous action without a second protocol. This job is deliberately
  last: a policy is only as honest as its reward, and the reward is only
  now metered.
- **Artifact.** `ml/scripts/train_policy.py` + `ml/reports/policy_ope.json`.

## Job 6 — Live grid intensity (parallel track)

- **Procedure.** Integrate a carbon-intensity provider (ElectricityMaps or
  equivalent, keyed via env) behind the existing static regional table;
  carbon math uses live intensity when fresh (<1 h), else the table, and
  every emission number records its source.
- **Bar.** No emission value without provenance; backfill test showing
  live-vs-table divergence on one region-week (the error bar we currently
  eat silently).
- **Artifact.** Provider module + provenance field in carbon responses.

## Standing rules

1. Field data never overwrites synthetic artifacts — `.field` suffixes,
   separate reports, both published.
2. Every job's bar is a *publication* bar: miss it and the finding is
   "the bar was missed because X", committed the same as a pass.
3. No step in this protocol auto-acts on a user device. Actuation stays
   user-initiated until a dedicated autonomy protocol exists.
