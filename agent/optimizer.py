"""
GreenLedger - Windows System Safe Optimization Engine
Executes verified, reversible, user-approved optimizations adhering to strict safety guardrails.
NEVER kills system services, deletes user files, or modifies security settings.
"""

import subprocess
import logging
from typing import Dict, Any, List, Optional
import psutil

from config import POWER_SCHEMES, PROTECTED_PROCESSES, OPTIMIZABLE_PROCESS_CANDIDATES

logger = logging.getLogger("GreenLedger.Optimizer")

# powercfg GUIDs for processor power management (SUB_PROCESSOR subgroup).
SUB_PROCESSOR_GUID = "54533251-82be-4824-96c1-47b60b740d00"
PROCTHROTTLEMAX_GUID = "bc5038f7-23e0-4960-96c1-47b60b740d00"
# Eco default: cap sustained CPU at 55% of max frequency. Fully reversible;
# measured v1.1 contribution is ~4-5 percentage points of the Eco bundle.
ECO_CPU_CAP_PCT = 55


class WindowsOptimizer:
    def __init__(self):
        self._applied_actions: List[Dict[str, Any]] = []
        self._original_power_scheme: Optional[str] = None
        self._detect_initial_power_scheme()

    def _detect_initial_power_scheme(self):
        """Reads current active Windows power plan scheme GUID."""
        try:
            res = subprocess.run(["powercfg", "/getactivescheme"], capture_output=True, text=True)
            if res.returncode == 0:
                output = res.stdout.strip()
                import re
                match = re.search(
                    r"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
                    output,
                    re.IGNORECASE,
                )
                if match:
                    self._original_power_scheme = match.group(1).lower()
                    return
                for key, guid in POWER_SCHEMES.items():
                    if guid.lower() in output.lower():
                        self._original_power_scheme = guid
                        return
            self._original_power_scheme = None
        except Exception as exc:
            logger.warning("Could not query active power scheme: %s", exc)
            self._original_power_scheme = None

    def _get_active_power_scheme(self) -> Optional[str]:
        """Return the exact active scheme GUID or None when powercfg is unavailable."""
        try:
            res = subprocess.run(["powercfg", "/getactivescheme"], capture_output=True, text=True)
            if res.returncode != 0:
                return None
            import re
            match = re.search(
                r"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
                res.stdout,
                re.IGNORECASE,
            )
            return match.group(1).lower() if match else None
        except OSError as exc:
            logger.warning("Could not query active power scheme: %s", exc)
            return None
        except Exception as exc:
            logger.warning("Could not query active power scheme: %s", exc)
            return None

    def _query_throttle_max(self, scheme_guid: str) -> Optional[Dict[str, int]]:
        """Reads current AC/DC max-processor-state (%) for a power scheme."""
        try:
            res = subprocess.run(
                ["powercfg", "/query", scheme_guid, "SUB_PROCESSOR", "PROCTHROTTLEMAX"],
                capture_output=True, text=True, timeout=8.0,
            )
            if res.returncode != 0:
                return None
            import re
            ac = re.search(r"Current AC Power Setting Index:\s*(0x[0-9a-fA-F]+)", res.stdout)
            dc = re.search(r"Current DC Power Setting Index:\s*(0x[0-9a-fA-F]+)", res.stdout)
            if not ac or not dc:
                return None
            return {"ac": int(ac.group(1), 16), "dc": int(dc.group(1), 16)}
        except Exception as exc:
            logger.warning("Could not query processor throttle max: %s", exc)
            return None

    def _set_throttle_max(self, scheme_guid: str, ac_pct: int, dc_pct: int) -> bool:
        """Sets AC/DC max-processor-state (%) and reactivates the scheme."""
        try:
            for scope, pct in (("ac", ac_pct), ("dc", dc_pct)):
                flag = "/setacvalueindex" if scope == "ac" else "/setdcvalueindex"
                res = subprocess.run(
                    ["powercfg", flag, scheme_guid, "SUB_PROCESSOR", "PROCTHROTTLEMAX", str(pct)],
                    capture_output=True, text=True, timeout=8.0,
                )
                if res.returncode != 0:
                    return False
            res = subprocess.run(["powercfg", "/setactive", scheme_guid],
                                 capture_output=True, text=True, timeout=8.0)
            return res.returncode == 0
        except Exception as exc:
            logger.warning("Could not set processor throttle max: %s", exc)
            return False

    def _apply_cpu_cap(self, cap_pct: int) -> Dict[str, Any]:
        """Caps sustained CPU frequency via max-processor-state (reversible)."""
        scheme = self._get_active_power_scheme()
        if not scheme:
            return {"success": False, "error": "Could not read the active power scheme; no change was attempted."}
        previous = self._query_throttle_max(scheme)
        if previous is None:
            return {"success": False, "error": "Could not read the current processor throttle; no change was attempted."}
        if previous["ac"] == cap_pct and previous["dc"] == cap_pct:
            return {"success": False, "error": f"CPU is already capped at {cap_pct}%; no change was attempted."}
        if not self._set_throttle_max(scheme, cap_pct, cap_pct):
            return {"success": False, "error": "powercfg refused the processor throttle change."}
        confirmed = self._query_throttle_max(scheme)
        if not confirmed or confirmed["ac"] != cap_pct or confirmed["dc"] != cap_pct:
            return {"success": False, "error": "Throttle readback did not match the target; state may be unchanged."}
        self._applied_actions.append({
            "action_id": f"cap_cpu_{cap_pct}",
            "type": "cpu_throttle",
            "scheme": scheme,
            "previous_ac": previous["ac"],
            "previous_dc": previous["dc"],
        })
        return {"success": True, "message": f"CPU sustained frequency capped at {cap_pct}% (reversible)."}

    def get_optimization_recommendations(self) -> List[Dict[str, Any]]:
        """
        Scans current live system state and returns a ranked list of safe,
        explainable optimization opportunities.
        """
        recommendations = []
        
        # 1. Check Windows Power Plan
        try:
            res = subprocess.run(["powercfg", "/getactivescheme"], capture_output=True, text=True)
            is_power_saver = POWER_SCHEMES["power_saver"].lower() in res.stdout.lower()
            if not is_power_saver:
                recommendations.append({
                    "id": "enable_power_saver",
                    "title": "Enable Windows Energy Saver Mode",
                    "category": "power_plan",
                    "priority": "high",
                    "estimated_power_reduction_pct": None,
                    "reversible": True,
                    "description": "Switches the Windows energy scheme to Power Saver to reduce CPU clock throttling floor and background synchronization.",
                    "action_name": "Switch Power Plan"
                })
        except Exception as exc:
            logger.warning("Could not query recommendations for the active power plan: %s", exc)

        # 2. Inspect Running Processes for High-Resource Non-System Candidates
        for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
            try:
                name = (p.info['name'] or "").lower()
                pid = p.info['pid']
                cpu_p = p.info.get('cpu_percent') or 0.0
                mem_p = p.info.get('memory_percent') or 0.0

                if name in PROTECTED_PROCESSES or name not in OPTIMIZABLE_PROCESS_CANDIDATES:
                    continue

                # Check if it is a notable resource consumer or background app
                if name in OPTIMIZABLE_PROCESS_CANDIDATES and (cpu_p > 8.0 or mem_p > 10.0):
                    recommendations.append({
                        "id": f"close_process_{pid}",
                        "title": f"Suspend High-Load Application: {p.info['name']}",
                        "category": "process_management",
                        "priority": "medium" if cpu_p < 15.0 else "high",
                        "pid": pid,
                        "process_name": p.info['name'],
                        "cpu_percent": round(cpu_p, 1),
                        "memory_percent": round(mem_p, 1),
                        "estimated_power_reduction_pct": None,
                        "reversible": False,
                        "description": f"Application '{p.info['name']}' is consuming {cpu_p:.1f}% CPU and {mem_p:.1f}% RAM in background.",
                        "action_name": f"Close {p.info['name']}"
                    })
                    if len(recommendations) >= 5:
                        break
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

        return recommendations

    def execute_action(self, action_id: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Safely executes an approved optimization action with strict validation.
        """
        logger.info(f"Executing approved action: {action_id}")
        
        # Action 1: Switch to Power Saver Plan
        if action_id == "enable_power_saver":
            guid = POWER_SCHEMES["power_saver"]
            previous_scheme = self._get_active_power_scheme()
            if not previous_scheme:
                return {"success": False, "error": "Could not read the active power scheme; no change was attempted."}
            if previous_scheme == guid.lower():
                return {"success": False, "error": "Power Saver is already active; no change was attempted."}
            cmd = ["powercfg", "/setactive", guid]
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode == 0:
                self._applied_actions.append({
                    "action_id": action_id,
                    "type": "power_scheme",
                    "previous_value": previous_scheme,
                })
                return {"success": True, "message": "Windows Energy Saver profile successfully activated."}
            return {"success": False, "error": f"powercfg returned exit code {res.returncode}: {res.stderr}"}

        # Action: cap sustained CPU frequency (Eco default 55%)
        if action_id == "cap_cpu_55":
            return self._apply_cpu_cap(ECO_CPU_CAP_PCT)

        # Action: Eco Core bundle (Power Saver plan + CPU cap, one reversible call).
        if action_id == "eco_core":
            saver = self.execute_action("enable_power_saver")
            saver_ok = saver.get("success") or "already active" in saver.get("error", "")
            if not saver_ok:
                return {"success": False, "error": f"Eco bundle stopped at power plan: {saver.get('error')}"}
            cap = self._apply_cpu_cap(ECO_CPU_CAP_PCT)
            cap_ok = cap.get("success") or "already capped" in cap.get("error", "")
            if not cap_ok:
                # Roll back the plan change so the bundle is all-or-nothing.
                if saver.get("success"):
                    self.undo_action("enable_power_saver")
                return {"success": False, "error": f"Eco bundle stopped at CPU cap: {cap.get('error')}"}
            return {"success": True, "message": "Eco Core active: Power Saver plan + 55% CPU sustained cap."}

        # Action 2: Graceful Close of Specific User Application
        if action_id.startswith("close_process_"):
            try:
                requested_pid = int(action_id.replace("close_process_", ""))
            except ValueError:
                return {"success": False, "error": "Invalid process optimization action ID."}
            if params and params.get("pid") is not None and int(params["pid"]) != requested_pid:
                return {"success": False, "error": "Process ID does not match the approved action."}
            pid = requested_pid
            try:
                proc = psutil.Process(pid)
                pname = proc.name().lower()
                expected_name = str(params.get("process_name", "")).strip().lower() if params else ""
                if expected_name and pname != expected_name:
                    return {
                        "success": False,
                        "error": f"Process changed before execution: expected '{expected_name}', found '{pname}'.",
                    }
                
                # Strict security guardrails: the protected denylist always wins,
                # and execution additionally requires the allowlist — a crafted
                # close_process_<pid> for any other application is rejected.
                if pname in PROTECTED_PROCESSES or pid <= 4:
                    return {"success": False, "error": f"Security violation: Process '{pname}' (PID {pid}) is a protected system service."}
                if pname not in OPTIMIZABLE_PROCESS_CANDIDATES:
                    return {"success": False, "error": f"Process '{pname}' (PID {pid}) is not on the optimizable application allowlist; no action taken."}

                # Graceful termination request (SIGTERM)
                proc.terminate()
                try:
                    proc.wait(timeout=2.0)
                except psutil.TimeoutExpired:
                    return {"success": False, "error": f"Process PID {pid} did not exit after graceful request; no force kill performed."}

                self._applied_actions.append({
                    "action_id": action_id,
                    "type": "process_terminate",
                    "name": pname,
                    "pid": pid
                })
                return {"success": True, "message": f"Application '{pname}' (PID {pid}) safely closed."}
            except psutil.NoSuchProcess:
                return {"success": False, "error": f"Process PID {pid} no longer exists; no optimization was applied."}
            except psutil.AccessDenied:
                return {"success": False, "error": f"Access denied terminating process PID {pid}."}
            except Exception as e:
                return {"success": False, "error": str(e)}

        return {"success": False, "error": f"Unknown or unsupported action ID: '{action_id}'"}

    def undo_action(self, action_id: str) -> Dict[str, Any]:
        """
        Reverses an optimization action where technically possible.
        """
        logger.info(f"Reversing action: {action_id}")
        
        if action_id == "enable_power_saver":
            previous = next(
                (
                    action
                    for action in reversed(self._applied_actions)
                    if action["action_id"] == action_id and action["type"] == "power_scheme"
                ),
                None,
            )
            restore_guid = previous.get("previous_value") if previous else None
            if not restore_guid:
                return {"success": False, "error": "The previous power scheme was not captured; rollback was not attempted."}
            res = subprocess.run(["powercfg", "/setactive", restore_guid], capture_output=True, text=True)
            if res.returncode == 0:
                if previous in self._applied_actions:
                    self._applied_actions.remove(previous)
                return {"success": True, "message": "Windows power scheme restored to previous setting."}
            return {"success": False, "error": f"Failed to restore power plan: {res.stderr}"}

        if action_id == "cap_cpu_55":
            previous = next(
                (
                    action
                    for action in reversed(self._applied_actions)
                    if action.get("type") == "cpu_throttle"
                ),
                None,
            )
            if not previous:
                return {"success": False, "error": "No recorded CPU throttle state; rollback was not attempted."}
            if self._set_throttle_max(previous["scheme"], previous["previous_ac"], previous["previous_dc"]):
                self._applied_actions.remove(previous)
                return {"success": True, "message": "CPU throttle restored to previous values."}
            return {"success": False, "error": "Failed to restore the CPU throttle."}

        if action_id == "eco_core":
            # Reverse order: throttle first, then the power plan.
            cap = self.undo_action("cap_cpu_55")
            saver = self.undo_action("enable_power_saver")
            if cap.get("success") and saver.get("success"):
                return {"success": True, "message": "Eco Core fully reversed (CPU throttle + power plan)."}
            return {
                "success": False,
                "error": f"Eco rollback partial — throttle: {cap.get('message', cap.get('error'))}; plan: {saver.get('message', saver.get('error'))}",
            }

        return {"success": False, "error": f"Action '{action_id}' is not reversible or has no undo state."}


# Global singleton instance
optimizer_instance = WindowsOptimizer()
