"""
GreenLedger - Telemetry API Router
Provides validation and deterministic simulation fallback for Demo Mode.
"""

import time
import math
from typing import Dict, Any
from fastapi import APIRouter
from schemas.models import TelemetryInput

router = APIRouter(prefix="/api/telemetry", tags=["Telemetry"])


@router.get("/demo")
def get_demo_telemetry(scenario: str = "normal") -> Dict[str, Any]:
    """
    Generates deterministic, smoothly undulating simulated telemetry for hackathon judges
    operating on remote machines or browsers without the local Windows agent installed.
    Strictly marked as is_live: False and simulated.
    """
    t = time.time()
    # Continuous undulating wave
    wave = (math.sin(t / 4.0) + 1.0) / 2.0  # 0.0 to 1.0
    
    if scenario == "high_load":
        cpu = 68.0 + (wave * 22.0)
        mem = 78.0 + (wave * 8.0)
        disk = 24.0 + (wave * 45.0)
        procs = 210
        threads = 2850
        temp = 72.0 + (wave * 12.0)
    elif scenario == "optimized":
        cpu = 18.0 + (wave * 8.0)
        mem = 48.0 + (wave * 4.0)
        disk = 1.2 + (wave * 2.0)
        procs = 135
        threads = 1680
        temp = 43.0 + (wave * 4.0)
    else:  # normal
        cpu = 34.0 + (wave * 14.0)
        mem = 58.0 + (wave * 6.0)
        disk = 4.5 + (wave * 8.0)
        procs = 162
        threads = 2150
        temp = 52.0 + (wave * 6.0)

    return {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "is_live": False,
        "mode_label": "Demo telemetry — simulated",
        "cpu_utilization": round(cpu, 1),
        "memory_usage": round(mem, 1),
        "disk_io": round(disk, 1),
        "network_latency": round(18.0 + (wave * 6.0), 1),
        "process_count": procs,
        "thread_count": threads,
        "context_switches": int(15000 + (cpu * 280)),
        "temperature": round(temp, 1),
        "uptime": 14.2,
        "gpu_name": "Intel Arc Graphics (Simulated Demo)",
        "gpu_utilization": round(12.0 + (wave * 15.0), 1),
        "cpu_frequency": round(2600.0 + (wave * 400.0), 1),
        "cpu_per_core": [round(cpu + ((i % 3 - 1) * 5), 1) for i in range(8)],
        "memory_used_gb": round((mem / 100.0) * 16.0, 1),
        "memory_total_gb": 16.0,
        "disk_read_mbs": round(disk * 0.6, 1),
        "disk_write_mbs": round(disk * 0.4, 1),
        "network_throughput_kbs": round(85.0 + (wave * 120.0), 1),
        "battery_percentage": 78.0,
        "power_plugged": True,
        "power_meter_raw": None,
        "top_cpu_processes": [
            {"pid": 10420, "name": "chrome.exe", "cpu_percent": round(cpu * 0.4, 1), "memory_percent": 14.5, "threads": 42},
            {"pid": 8912, "name": "slack.exe", "cpu_percent": round(cpu * 0.18, 1), "memory_percent": 8.2, "threads": 28},
            {"pid": 14208, "name": "spotify.exe", "cpu_percent": round(cpu * 0.12, 1), "memory_percent": 5.1, "threads": 22},
        ],
        "top_memory_processes": [
            {"pid": 10420, "name": "chrome.exe", "cpu_percent": round(cpu * 0.4, 1), "memory_percent": 14.5, "threads": 42},
            {"pid": 8912, "name": "slack.exe", "cpu_percent": round(cpu * 0.18, 1), "memory_percent": 8.2, "threads": 28},
            {"pid": 7712, "name": "code.exe", "cpu_percent": 4.1, "memory_percent": 11.2, "threads": 36}
        ]
    }


@router.post("/validate")
def validate_telemetry(telemetry: TelemetryInput):
    """Validates telemetry format against system contract."""
    return {"valid": True, "data": telemetry.model_dump()}
