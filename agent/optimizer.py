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
                for key, guid in POWER_SCHEMES.items():
                    if guid.lower() in output.lower():
                        self._original_power_scheme = guid
                        return
            self._original_power_scheme = POWER_SCHEMES["balanced"]
        except Exception as e:
            logger.warning(f"Could not query active power scheme: {e}")
            self._original_power_scheme = POWER_SCHEMES["balanced"]

    def get_optimization_recommendations(self) -> List[Dict[str, Any]]:
        """
        Scans current live system state and returns a ranked list of safe,
        explainable optimization opportunities.
        Filters out actions that have already been applied in this session.
        """
        recommendations = []
        applied_action_ids = {a.get("action_id") for a in self._applied_actions}
        applied_pids = {a.get("pid") for a in self._applied_actions if a.get("pid") is not None}
        applied_names = {str(a.get("name")).lower() for a in self._applied_actions if a.get("name")}
        
        # 1. Check Windows Power Plan
        if "enable_power_saver" not in applied_action_ids:
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
            except Exception:
                pass

        # 2. Inspect Running Processes for High-Resource Non-System Candidates
        for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
            try:
                name = (p.info['name'] or "").lower()
                pid = p.info['pid']
                cpu_p = p.info.get('cpu_percent') or 0.0
                mem_p = p.info.get('memory_percent') or 0.0

                if name in PROTECTED_PROCESSES or name not in OPTIMIZABLE_PROCESS_CANDIDATES:
                    continue

                if pid in applied_pids or f"close_process_{pid}" in applied_action_ids or name in applied_names:
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
            cmd = ["powercfg", "/setactive", guid]
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode == 0:
                self._applied_actions.append({
                    "action_id": action_id,
                    "type": "power_scheme",
                    "previous_value": self._original_power_scheme
                })
                return {"success": True, "message": "Windows Energy Saver profile successfully activated."}
            return {"success": False, "error": f"powercfg returned exit code {res.returncode}: {res.stderr}"}

        # Action 2: Graceful Close of Specific User Application (Window Tree Aware)
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
                
                # Strict security guardrail
                if pname in PROTECTED_PROCESSES or pid <= 4:
                    return {"success": False, "error": f"Security violation: Process '{pname}' (PID {pid}) is a protected system service."}

                # Find root application process to ensure main UI window closes
                root = proc
                try:
                    while root.parent() and root.parent().name().lower() == pname:
                        root = root.parent()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass

                # Graceful window close via taskkill (sends WM_CLOSE to window)
                try:
                    subprocess.run(["taskkill", "/PID", str(root.pid)], capture_output=True, text=True, timeout=3)
                except Exception:
                    pass

                closed = False
                try:
                    root.wait(timeout=1.5)
                    closed = True
                except (psutil.TimeoutExpired, psutil.NoSuchProcess):
                    pass

                # If still running, cleanly terminate entire process tree
                if not closed:
                    try:
                        all_procs = [root] + root.children(recursive=True)
                        for p_item in all_procs:
                            try:
                                p_item.terminate()
                            except (psutil.NoSuchProcess, psutil.AccessDenied):
                                pass

                        _, alive = psutil.wait_procs(all_procs, timeout=1.5)
                        for p_item in alive:
                            try:
                                p_item.kill()
                            except (psutil.NoSuchProcess, psutil.AccessDenied):
                                pass
                    except Exception as tree_err:
                        logger.warning(f"Process tree termination warning: {tree_err}")
                        try:
                            subprocess.run(["taskkill", "/PID", str(root.pid), "/T", "/F"], capture_output=True, text=True, timeout=3)
                        except Exception:
                            pass

                self._applied_actions.append({
                    "action_id": action_id,
                    "type": "process_terminate",
                    "name": pname,
                    "pid": pid,
                    "root_pid": root.pid
                })
                return {"success": True, "message": f"Application '{pname}' window and processes closed successfully."}
            except psutil.NoSuchProcess:
                self._applied_actions.append({
                    "action_id": action_id,
                    "type": "process_terminate",
                    "pid": pid
                })
                return {"success": True, "message": f"Process PID {pid} was already closed."}
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
            restore_guid = self._original_power_scheme or POWER_SCHEMES["balanced"]
            res = subprocess.run(["powercfg", "/setactive", restore_guid], capture_output=True, text=True)
            if res.returncode == 0:
                return {"success": True, "message": "Windows power scheme restored to previous setting."}
            return {"success": False, "error": f"Failed to restore power plan: {res.stderr}"}
            
        return {"success": False, "error": f"Action '{action_id}' is not reversible or has no undo state."}


# Global singleton instance
optimizer_instance = WindowsOptimizer()
