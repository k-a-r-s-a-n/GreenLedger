"""
GreenLedger - Action Cost Models & Attention Scoring (patent-gap build).

Every recommendation carries a PREDICTED NET saving: predicted gross watts
minus the transition cost of acting. A breakeven gate suppresses actions
whose predicted net is not positive — the same discipline Microsoft's
US8190939B2 applies to P-state transitions, but applied here to user-facing
actions through a different mechanism (predicted watts, not workload
probabilities), and closed by the verification loop: evaluate-delta logs
predicted-vs-actual into the transition log, and ml/scripts/calibration.py
measures the models' bias per action. No surveyed patent closes this loop.

All quantities below are documented heuristics v1 — the calibration log
exists precisely so they can be replaced by fitted values. Predictions are
advisory; the verified before/after measurement is the only gate that mints
credits.

Attention scoring: a process the user is actively using must never be a kill
candidate, no matter how much CPU it burns. Foreground + input-idle signals
come from the agent (None when unsupported — unknown means "no boost", never
assumed unattended).
"""

import math
from typing import Any, Dict, List, Optional, Tuple

# Minimum predicted net (W) for a recommendation to be shown. Below this the
# action is breakeven-or-worse and stays silent.
BREAKEVEN_THRESHOLD_W = 0.25

# Killing a process rarely removes its full CPU share: shared baseline power
# (SoC idle, display, memory refresh) stays. Marginal factor v1.
PROCESS_MARGINAL_FACTOR = 0.7

# Flat amortized restart/spike cost of a kill (respawn risk, relaunch CPU
# burst averaged over the verification window). Calibrated later from the log.
PROCESS_KILL_COST_W = 0.5

# An unattended machine (no input for this long) boosts zombie confidence.
UNATTENDED_IDLE_SECONDS = 300.0


def predict_net_saving(
    action_id: str,
    telemetry: Dict[str, Any],
    estimated_power_w: Optional[float],
) -> Optional[Dict[str, Any]]:
    """
    Predicted net watts for an action, or None when the action should not be
    recommended (breakeven gate, safety gate, or missing inputs).

    Returns {predicted_net_w, predicted_gross_w, transition_cost_w, basis}.
    estimated_power_w None (model unavailable) -> None: without the power
    estimate there is no honest watt prediction; the caller still recommends
    by rule, just without a prediction attached.
    """
    if estimated_power_w is None or not math.isfinite(estimated_power_w):
        return None
    if estimated_power_w <= 0:
        return None

    if action_id == "enable_power_saver":
        gross = 0.08 * estimated_power_w
        return _net(gross, 0.0, "8% of estimated power (plan-throttle heuristic v1)")

    if action_id == "eco_mode":
        gross = 0.30 * estimated_power_w
        return _net(gross, 0.0, "30% of estimated power (stacked-bundle heuristic v1)")

    if action_id == "reduce_brightness":
        brightness = telemetry.get("screen_brightness")
        if not isinstance(brightness, (int, float)) or not math.isfinite(brightness):
            return None
        gross = 4.0 if brightness > 50 else 1.5
        return _net(gross, 0.0, f"display share at {brightness:.0f}% brightness (heuristic v1)")

    if action_id == "cap_cpu_55":
        cpu = telemetry.get("cpu_utilization")
        if not isinstance(cpu, (int, float)) or not math.isfinite(cpu):
            return None
        if cpu <= 55:
            return None  # nothing above the cap to reclaim
        gross = ((cpu - 55.0) / 100.0) * estimated_power_w * 0.6
        return _net(gross, 0.0, f"reclaim above 55% cap from {cpu:.0f}% CPU (heuristic v1)")

    if action_id.startswith("close_process_"):
        return _predict_process_kill(action_id, telemetry, estimated_power_w)

    return None


def _net(gross: float, cost: float, basis: str) -> Optional[Dict[str, Any]]:
    net = gross - cost
    if net <= BREAKEVEN_THRESHOLD_W:
        return None
    return {
        "predicted_net_w": round(net, 2),
        "predicted_gross_w": round(gross, 2),
        "transition_cost_w": round(cost, 2),
        "basis": basis,
    }


def _predict_process_kill(
    action_id: str,
    telemetry: Dict[str, Any],
    estimated_power_w: float,
) -> Optional[Dict[str, Any]]:
    try:
        pid = int(action_id[len("close_process_"):])
    except ValueError:
        return None
    proc = None
    for p in telemetry.get("top_cpu_processes") or []:
        if p.get("pid") == pid:
            proc = p
            break
    if proc is None:
        return None

    score, reasons, foreground = zombie_score(proc, telemetry)
    if foreground:
        return None  # safety gate: never recommend killing the active app

    total_cpu = telemetry.get("cpu_utilization") or 0.0
    share = (proc.get("cpu_percent") or 0.0) / total_cpu if total_cpu > 0 else 0.0
    share = min(max(share, 0.0), 1.0)
    gross = share * estimated_power_w * PROCESS_MARGINAL_FACTOR
    basis = (f"{share * 100:.0f}% of CPU x {estimated_power_w:.1f}W x marginal "
             f"{PROCESS_MARGINAL_FACTOR} (zombie score {score:.2f}; "
             + "; ".join(reasons) + ")")
    return _net(gross, PROCESS_KILL_COST_W, basis)


def zombie_score(
    proc: Dict[str, Any],
    telemetry: Dict[str, Any],
) -> Tuple[float, List[str], bool]:
    """
    (score, reasons, is_foreground). Score ~= wasted-energy weight: CPU burn
    discounted when the user is actively engaged with the process, boosted
    when the machine is unattended. Unknown attention signals -> no boost.
    """
    cpu = float(proc.get("cpu_percent") or 0.0)
    mem = float(proc.get("memory_percent") or 0.0)
    reasons = [f"{cpu:.1f}% CPU"]

    fg_name = telemetry.get("foreground_process_name")
    pname = str(proc.get("name", ""))
    foreground = bool(
        fg_name and pname and str(fg_name).lower() in pname.lower()
        or pname and fg_name and pname.lower() in str(fg_name).lower()
    )
    if foreground:
        reasons.append("in active use (foreground)")
        return round(cpu * 0.15, 2), reasons, True

    if fg_name:
        reasons.append(f"background (foreground: {fg_name})")
    else:
        reasons.append("attention unknown")

    idle = telemetry.get("input_idle_seconds")
    if isinstance(idle, (int, float)) and math.isfinite(idle) and idle >= UNATTENDED_IDLE_SECONDS:
        reasons.append(f"unattended ({idle:.0f}s idle)")
        return round(cpu * (1.0 + mem / 200.0) * 1.3, 2), reasons, False
    return round(cpu * (1.0 + mem / 200.0), 2), reasons, False
