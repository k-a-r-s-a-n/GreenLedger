"""
GreenLedger - Optimization Engine Service
Scores telemetry for optimization opportunities and validates before/after telemetry deltas.
"""

import hashlib
import time
from typing import Dict, Any, List, Optional
from schemas.models import OptimizationRecommendation, BeforeAfterComparison
from services.ml.inference import ml_engine
from services.carbon.calculator import calculate_savings

OPTIMIZABLE_PROCESS_NAMES = {
    "chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe",
    "spotify.exe", "discord.exe", "slack.exe", "teams.exe", "zoom.exe",
    "steam.exe", "epicgameslauncher.exe", "dropbox.exe", "onedrive.exe",
    "notion.exe", "figma.exe"
}

# Anti-abuse parameters
MIN_REDUCTION_PERCENT_THRESHOLD = 3.0  # Must achieve at least 3% drop to claim verified reduction
COOLDOWN_SECONDS = 20  # Minimum 20s cooldown between claimed optimization cycles


class OptimizationEngineService:
    def __init__(self):
        self._last_optimization_time: Dict[str, float] = {}
        self._last_telemetry_hash: Dict[str, str] = {}

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

        return recommendations

    def evaluate_before_after(
        self,
        action_id: str,
        before_telemetry: Dict[str, Any],
        after_telemetry: Dict[str, Any],
        user_id: str = "default_user"
    ) -> BeforeAfterComparison:
        """
        Calculates honest before-vs-after ML power estimation delta.
        Validates anti-abuse rules (cooldown, min delta threshold, unique telemetry hash).
        """
        if not before_telemetry.get("is_live") or not after_telemetry.get("is_live"):
            raise ValueError("Verified Green Credits require live before and after telemetry.")

        now = time.time()
        last_time = self._last_optimization_time.get(user_id, 0.0)
        
        # 1. Run inference on Before and After state
        pred_before = ml_engine.predict_power(before_telemetry)
        pred_after = ml_engine.predict_power(after_telemetry)
        
        p_before = pred_before["estimated_power_w"]
        p_after = pred_after["estimated_power_w"]
        
        reduction_watts = max(0.0, p_before - p_after)
        reduction_pct = (reduction_watts / p_before * 100.0) if p_before > 0 else 0.0
        
        # 2. Compute carbon savings
        savings = calculate_savings(p_before, p_after, duration_hours=1.0)
        
        # 3. Telemetry fingerprint to detect identical duplicate submissions
        import json
        raw_signature = json.dumps(
            {"action_id": action_id, "before": before_telemetry, "after": after_telemetry},
            sort_keys=True,
            separators=(",", ":")
        )
        telemetry_hash = hashlib.sha256(raw_signature.encode()).hexdigest()[:16]
        
        # 4. Anti-abuse verification
        is_abuse = False
        if (now - last_time) < COOLDOWN_SECONDS:
            is_abuse = True
        if self._last_telemetry_hash.get(user_id) == telemetry_hash:
            is_abuse = True

        self._last_optimization_time[user_id] = now
        self._last_telemetry_hash[user_id] = telemetry_hash
        
        # 5. Award Green Credits
        from services.credits.rewards import credit_service
        credits_earned = 0
        if not is_abuse and reduction_pct >= MIN_REDUCTION_PERCENT_THRESHOLD:
            credits_earned = credit_service.calculate_optimization_reward(
                action_id=action_id,
                reduction_pct=reduction_pct,
                co2_saved_g=savings["co2_saved_g"],
                user_id=user_id
            )
        elif not is_abuse:
            # Baseline execution participation
            credits_earned = credit_service.award_participation(user_id=user_id)
            
        user_state = credit_service.get_user_state(user_id)
        
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
            unlocked_badge=user_state.recent_transactions[-1].get("unlocked_badge") if user_state.recent_transactions else None
        )


optimization_service = OptimizationEngineService()
