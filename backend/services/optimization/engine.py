"""
GreenLedger - Optimization Engine Service
Scores telemetry for optimization opportunities and validates before/after telemetry deltas.

Anti-abuse posture (documented in docs/api-contract.md):
- Only whitelisted safe action IDs can claim verified reductions.
- Cooldown between cycles; duplicates within a rolling window are rejected.
- Before/after snapshots must actually differ; identical submissions are rejected.
"""

import hashlib
import json
import math
import os
import time
from collections import deque
from pathlib import Path
from typing import Dict, Any, List, Optional

from schemas.models import OptimizationRecommendation, BeforeAfterComparison
from services.ml.inference import ml_engine
from services.ml.temporal import temporal_engine
from services.carbon.calculator import calculate_savings
from services.credits.rewards import credit_service

# Phase 1 transition log: every accepted optimization cycle appends one JSONL
# record (state, action, outcome) — the offline dataset Phase 3 learns from.
# Overridable via GREENLEDGER_TRANSITION_LOG (tests point it at tmp dirs).
def _transition_log_path() -> Path:
    override = os.getenv("GREENLEDGER_TRANSITION_LOG")
    if override:
        return Path(override)
    repo_root = Path(__file__).resolve().parent.parent.parent.parent
    return repo_root / "ml" / "data" / "transitions" / "transitions.jsonl"


# Compact state vector stored per transition (v1.1 signals + ground truth).
_TRANSITION_STATE_KEYS = [
    "cpu_utilization", "memory_usage", "disk_io", "process_count",
    "thread_count", "uptime", "screen_brightness", "cpu_frequency",
    "cpu_frequency_mhz", "power_saver_active", "battery_drain_w",
    "power_meter_raw",
]


def _log_transition(record: Dict[str, Any]) -> None:
    """Best-effort append; a logging failure must never fail the request."""
    try:
        path = _transition_log_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")
    except OSError:
        pass

OPTIMIZABLE_PROCESS_NAMES = {
    "chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe",
    "spotify.exe", "discord.exe", "slack.exe", "teams.exe", "zoom.exe",
    "steam.exe", "epicgameslauncher.exe", "dropbox.exe", "onedrive.exe",
    "notion.exe", "figma.exe"
}

# Anti-abuse parameters
MIN_REDUCTION_PERCENT_THRESHOLD = 3.0  # Must achieve at least 3% drop to claim verified reduction
COOLDOWN_SECONDS = 20  # Minimum 20s cooldown between claimed optimization cycles
DUPLICATE_HASH_WINDOW = 3  # Recent submissions remembered per user to catch alternating replays
MIN_MEASUREMENT_SAMPLES = 3
MAX_WINDOW_CPU_STDDEV = 15.0
MAX_WINDOW_MEMORY_STDDEV = 15.0

# Safe action whitelist. Only these action IDs (and close_process_<pid>) may be
# evaluated server-side. Every entry MUST have a real implementation:
# enable_power_saver runs in the agent (or the Next.js /api/power-saver route),
# reduce_brightness runs via the Next.js /api/brightness route (WMI),
# cap_cpu_55 runs in the agent (powercfg PROCTHROTTLEMAX, reversible),
# eco_mode is the one-cycle bundle: brightness 35 (Next route) + agent eco_core
# (Power Saver plan + 55% CPU cap), snapshotted once before/after.
# NOTE: trim_working_sets was removed — it was whitelisted but implemented
# nowhere, so it could have earned credits without executing anything.
SAFE_STATIC_ACTIONS = {"enable_power_saver", "reduce_brightness", "cap_cpu_55", "eco_mode"}


class UnknownActionError(ValueError):
    """Raised when an action_id is not on the safe action whitelist."""


class CooldownActiveError(Exception):
    """Raised when the user submits a cycle before the cooldown elapses."""


class DuplicateSubmissionError(ValueError):
    """Raised when a submission replays a recent before/after fingerprint."""


def _is_allowed_action(action_id: str) -> bool:
    """Whitelist check: static safe actions plus close_process_<pid> format."""
    if action_id in SAFE_STATIC_ACTIONS:
        return True
    if action_id.startswith("close_process_"):
        return action_id[len("close_process_"):].isdigit()
    return False


def _core_telemetry(telemetry: Dict[str, Any]) -> Dict[str, Any]:
    """Drops volatile envelope fields so state comparison reflects real measurements."""
    return {
        k: v for k, v in telemetry.items()
        if k not in ("timestamp", "is_live", "mode_label")
    }


def _measurement_quality(telemetry: Dict[str, Any]) -> Optional[str]:
    """Reject a noisy measurement window when the client supplied quality metadata."""
    sample_count = telemetry.get("_sample_count")
    if sample_count is None:
        return None
    if not isinstance(sample_count, int) or sample_count < MIN_MEASUREMENT_SAMPLES:
        return f"at least {MIN_MEASUREMENT_SAMPLES} stabilized samples are required"
    for key, limit, label in (
        ("_cpu_stddev", MAX_WINDOW_CPU_STDDEV, "CPU"),
        ("_memory_stddev", MAX_WINDOW_MEMORY_STDDEV, "memory"),
    ):
        value = telemetry.get(key)
        if value is not None and (not isinstance(value, (int, float)) or not math.isfinite(value) or value > limit):
            return f"{label} varied too much during the measurement window"
    return None


def _power_meter_value(telemetry: Dict[str, Any]) -> Optional[float]:
    value = telemetry.get("power_meter_raw")
    if isinstance(value, (int, float)) and math.isfinite(value) and value > 0:
        return float(value)
    return None


class OptimizationEngineService:
    def __init__(self):
        self._last_optimization_time: Dict[str, float] = {}
        self._recent_hashes: Dict[str, deque] = {}

    def analyze_telemetry_for_recommendations(self, telemetry: Dict[str, Any]) -> List[OptimizationRecommendation]:
        """
        Generates contextual optimization opportunities from current device telemetry.
        """
        recommendations = []
        cpu = telemetry.get("cpu_utilization", 0.0)
        mem = telemetry.get("memory_usage", 0.0)
        top_procs = telemetry.get("top_cpu_processes") or []

        # 1. High CPU Background Processes
        for p in top_procs:
            proc_cpu = p.get("cpu_percent", 0.0)
            if proc_cpu > 10.0:
                pname = p.get("name", "Application")
                if str(pname).lower() not in OPTIMIZABLE_PROCESS_NAMES:
                    continue
                recommendations.append(OptimizationRecommendation(
                    id=f"close_process_{p.get('pid')}",
                    title=f"Suspend High-CPU App: {pname}",
                    category="process_management",
                    priority="high" if proc_cpu > 20.0 else "medium",
                    estimated_power_reduction_pct=None,
                    reversible=False,
                    description=f"{pname} is drawing substantial processor cycles ({proc_cpu}% CPU).",
                    action_name=f"Close {pname}",
                    pid=p.get("pid"),
                    process_name=pname,
                    cpu_percent=proc_cpu,
                    memory_percent=p.get("memory_percent", 0.0)
                ))

        # 2. Windows Energy Saver Mode
        recommendations.append(OptimizationRecommendation(
            id="enable_power_saver",
            title="Enable Windows Energy Saver Profile",
            category="power_plan",
            priority="high",
            estimated_power_reduction_pct=None,
            reversible=True,
            description="Throttles aggressive core boost thresholds and reduces background indexers.",
            action_name="Switch Power Plan"
        ))

        # 3. Eco Mode bundle — the stacked, one-cycle path to 40%+ measured
        # reduction: display to 35%, Saver plan, 55% sustained CPU cap.
        recommendations.append(OptimizationRecommendation(
            id="eco_mode",
            title="Activate Eco Mode Bundle",
            category="eco_bundle",
            priority="high",
            estimated_power_reduction_pct=None,
            reversible=True,
            description="One verified cycle: dims display to 35%, switches to the Power Saver plan, and caps sustained CPU at 55%. Fully reversible.",
            action_name="Activate Eco Mode"
        ))

        return recommendations

    def evaluate_before_after(
        self,
        action_id: str,
        before_telemetry: Dict[str, Any],
        after_telemetry: Dict[str, Any],
        user_id: str = "default_user",
        before_window: Optional[List[Dict[str, Any]]] = None,
        after_window: Optional[List[Dict[str, Any]]] = None
    ) -> BeforeAfterComparison:
        """
        Calculates honest before-vs-after ML power estimation delta.
        Enforces the safe action whitelist and anti-abuse rules (cooldown,
        duplicate-submission window, non-identical state) before awarding credits.
        """
        # 0. Safe action whitelist enforcement — arbitrary action IDs never reach scoring.
        if not _is_allowed_action(action_id):
            raise UnknownActionError(
                f"Action '{action_id}' is not on the safe action whitelist."
            )

        if not before_telemetry.get("is_live") or not after_telemetry.get("is_live"):
            raise ValueError("Verified Green Credits require live before and after telemetry.")

        for label, telemetry in (("before", before_telemetry), ("after", after_telemetry)):
            quality_error = _measurement_quality(telemetry)
            if quality_error:
                raise ValueError(f"{label.capitalize()} telemetry is not stable: {quality_error}.")

        now = time.time()
        last_time = self._last_optimization_time.get(user_id, 0.0)

        # 1. Cooldown enforcement. Rejected attempts do NOT reset the timer.
        if (now - last_time) < COOLDOWN_SECONDS:
            raise CooldownActiveError(
                f"Cooldown active: wait {COOLDOWN_SECONDS} seconds between optimization cycles."
            )

        # 2. Telemetry fingerprint to detect replayed submissions (rolling window
        #    so alternating replays cannot evade a single "last hash" check).
        raw_signature = json.dumps(
            {"action_id": action_id, "before": before_telemetry, "after": after_telemetry},
            sort_keys=True,
            separators=(",", ":")
        )
        telemetry_hash = hashlib.sha256(raw_signature.encode()).hexdigest()[:16]

        recent = self._recent_hashes.setdefault(user_id, deque(maxlen=DUPLICATE_HASH_WINDOW))
        if telemetry_hash in recent:
            raise DuplicateSubmissionError(
                "Duplicate optimization submission detected: identical before/after state "
                "was already evaluated in a recent cycle."
            )

        # 3. State must actually change between the two snapshots.
        if _core_telemetry(before_telemetry) == _core_telemetry(after_telemetry):
            raise ValueError(
                "Before and after telemetry are identical; no system state change to verify."
            )

        # 4. Run inference on Before and After state
        pred_before = ml_engine.predict_power(before_telemetry)
        pred_after = ml_engine.predict_power(after_telemetry)

        p_before = pred_before["estimated_power_w"]
        p_after = pred_after["estimated_power_w"]

        reduction_watts = max(0.0, p_before - p_after)
        reduction_pct = (reduction_watts / p_before * 100.0) if p_before > 0 else 0.0

        # When the protected collector exposes a Windows Power Meter value, it
        # is an independent signal. Do not award a model-based saving when the
        # physical counter contradicts the model direction.
        measured_before = _power_meter_value(before_telemetry)
        measured_after = _power_meter_value(after_telemetry)
        if measured_before is not None and measured_after is not None:
            measured_reduction = measured_before - measured_after
            if reduction_watts > 0 and measured_reduction < 0:
                reduction_watts = 0.0
                reduction_pct = 0.0

        # 5. Compute carbon savings
        savings = calculate_savings(
            p_before,
            p_before - reduction_watts,
            duration_hours=1.0,
        )

        # 6. Record the accepted cycle
        self._last_optimization_time[user_id] = now
        recent.append(telemetry_hash)

        # 7. Award Green Credits (verified reward or baseline participation)
        credits_earned = 0
        if reduction_pct >= MIN_REDUCTION_PERCENT_THRESHOLD:
            credits_earned = credit_service.calculate_optimization_reward(
                action_id=action_id,
                reduction_pct=reduction_pct,
                co2_saved_g=savings["co2_saved_g"],
                user_id=user_id
            )
        else:
            credits_earned = credit_service.award_participation(user_id=user_id)

        user_state = credit_service.get_user_state(user_id)

        # 8. Temporal intervals (Phase 2): when the caller supplied the raw
        # sample windows behind each median, quantify each snapshot with an 80%
        # interval. Missing windows / model -> nulls, never guesses. Intervals
        # inform the significance flag; payouts still follow the point rule.
        before_interval = self._window_interval(before_window)
        after_interval = self._window_interval(after_window)
        reduction_significant = (
            before_interval is not None
            and after_interval is not None
            and before_interval[0] > after_interval[1]
        )

        # 9. Transition log: (state, action, outcome) for offline learning.
        # Participation cycles are logged too — verified non-effects are data.
        _log_transition({
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "user_id": user_id,
            "action_id": action_id,
            "verified": bool(reduction_pct >= MIN_REDUCTION_PERCENT_THRESHOLD),
            "before": {k: before_telemetry.get(k) for k in _TRANSITION_STATE_KEYS},
            "after": {k: after_telemetry.get(k) for k in _TRANSITION_STATE_KEYS},
            "p_before_w": p_before,
            "p_after_w": p_after,
            "reduction_watts": reduction_watts,
            "reduction_pct": reduction_pct,
            "co2_saved_g": savings["co2_saved_g"],
            "credits_awarded": credits_earned,
            "action_hash": telemetry_hash,
            "before_interval_80": before_interval,
            "after_interval_80": after_interval,
            "reduction_significant": reduction_significant,
        })

        return BeforeAfterComparison(
            action_id=action_id,
            before_power_w=p_before,
            after_power_w=p_after,
            reduction_watts=reduction_watts,
            reduction_pct=reduction_pct,
            hourly_co2_saved_g=savings["co2_saved_g"],
            credits_awarded=credits_earned,
            new_credit_balance=user_state.credit_balance,
            streak_days=user_state.current_streak_days,
            action_hash=telemetry_hash,
            unlocked_badge=user_state.recent_transactions[-1].get("unlocked_badge") if user_state.recent_transactions else None,
            before_power_interval_80=before_interval,
            after_power_interval_80=after_interval
        )

    @staticmethod
    def _window_interval(window: Optional[List[Dict[str, Any]]]) -> Optional[List[float]]:
        """80% power interval for a sample window, or None when unavailable."""
        if not window or not temporal_engine.available:
            return None
        try:
            return temporal_engine.predict_window(window)["interval_80_w"]
        except (ValueError, RuntimeError):
            return None


optimization_service = OptimizationEngineService()