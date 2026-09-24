# Optimization Engine & System Safety Documentation

## Overview
The GreenLedger optimization engine translates hardware telemetry into ranked, non-destructive efficiency interventions.

---

## Safety Guardrails & Blacklist
GreenLedger enforces strict non-negotiable safety guardrails:
1. **Never Kills System Processes**: `explorer.exe`, `svchost.exe`, `dwm.exe`, `csrss.exe`, `lsass.exe`, and antivirus services (`msmpeng.exe`, `securityhealthservice.exe`) are blacklisted from termination. Process termination additionally requires an **allowlist** of everyday user applications (`agent/config.py`); anything else is rejected at execution time even if a crafted action ID is submitted.
2. **Reversible Actions**: Windows power scheme adjustments record the prior scheme GUID for instant rollback.
3. **No Arbitrary Shell Execution**: The agent exposes strictly enumerated action IDs; arbitrary terminal command strings sent from the web client are rejected.

---

## Available Optimization Actions

### 1. Windows Energy Saver Profile (`enable_power_saver`)
- **Action**: Activates Windows Power Saver scheme using `powercfg /setactive a1841308-3541-4fab-bc81-f71556f20b4a`.
- **Effect**: Requests the Windows Power Saver scheme. The resulting power change is measured after stabilization; no fixed watt reduction is assumed.
- **Reversible**: Yes (`undo` restores original power plan).

### 2. Graceful Process Suspension (`close_process_<pid>`)
- **Action**: Sends a graceful termination request to high-draw user processes (e.g. background Chrome, Spotify, Discord, Slack). Process termination is not automatically reversible.
- **Safety**: Allowlist-enforced — only everyday user applications in `agent/config.py` (`OPTIMIZABLE_PROCESS_CANDIDATES`) may be terminated; the approved executable name is re-verified against the PID at execution time to defeat PID reuse, and no force-kill is ever issued.
- **Reversible**: Manual application relaunch.

### 3. Display Brightness Reduction (`reduce_brightness`)
- **Action**: Dims the display to an energy-efficient 40% target via Windows WMI (`WmiMonitorBrightnessMethods`), executed through the Next.js `/api/brightness` route.
- **Effect**: No fixed watt reduction is promised — the resulting power change is measured after stabilization and verified server-side like any other action.
- **Reversible**: Yes (the pre-optimization brightness level is captured once per session and restorable).

### 4. Sustained CPU Cap (`cap_cpu_55`)
- **Action**: Caps sustained CPU frequency at 55% via `powercfg` `PROCTHROTTLEMAX` (AC + DC), executed in the agent.
- **Effect**: DVFS-driven reduction under load; idle machines move little (honest physics). Previous AC/DC values are captured and re-verified for rollback.
- **Reversible**: Yes (`undo` restores the exact previous throttle values).

### Transition log (Phase 1)
Every accepted cycle — verified or participation — appends one JSONL record
(state, action, outcome) to `ml/data/transitions/transitions.jsonl`
(overridable via `GREENLEDGER_TRANSITION_LOG`). Verified non-effects are data
too. This is the offline dataset the Phase 3 policy learns from. Logging is
best-effort and can never fail a request.

### Predicted net + calibration loop (patent-gap build)
Every recommendation carries `predicted_net_w` (predicted gross watts minus
the transition cost of acting) with a `prediction_basis` string, computed by
`backend/services/optimization/cost_models.py` (documented heuristics v1).
Two gates fire before a card is shown: the **breakeven gate** (predicted net
≤ 0.25 W stays silent — cf. Microsoft US8190939B2's breakeven discipline,
applied here to user actions via predicted watts) and the **safety gate**
(the foreground process is never a kill candidate, via the agent's
`foreground_process_name` / `input_idle_seconds` attention signals; unknown
attention means no boost, never assumed unattended).
The frontend echoes the card's prediction in `evaluate-delta`
(`predicted_net_w`); the engine logs it next to the verified outcome plus
`prediction_error_w` (actual − predicted). `ml/scripts/calibration.py` reads
the log and reports per-action bias/MAE/RMSE over verified cycles — the
mechanism by which heuristic v1 constants become fitted values. Predictions
are advisory; only verified measurement mints credits.

### 5. Eco Mode Bundle (`eco_mode`)
- **Action**: One verified cycle stacking every safe lever — display to 35% (Next.js route) + agent `eco_core` (Power Saver plan + 55% CPU cap). Snapshotted once before/after; all-or-nothing execution with single undo.
- **Effect**: The 40%+ path. Trial protocol (`ml/scripts/evaluate_actions.py`, frozen `student_typical` baseline, n=20): **43.2% ± 1.3%** mean power reduction (carbon % equals power %).
- **Reversible**: Yes (brightness + throttle + plan all restored).
