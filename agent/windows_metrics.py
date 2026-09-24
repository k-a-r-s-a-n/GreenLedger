"""
GreenLedger - Windows Native Telemetry Collector
Reads system performance metrics using psutil, Windows Performance Counters, and CIM.
Explicitly handles unavailable sensors with null rather than fabricating values.
"""

import time
import subprocess
import logging
from typing import Dict, Any, List, Optional
import psutil

from config import LATENCY_PING_HOST

logger = logging.getLogger("GreenLedger.WindowsMetrics")

# Track previous disk/net stats for rate calculation
_last_disk_time = None
_last_disk_read_bytes = None
_last_disk_write_bytes = None
_last_net_time = None
_last_net_bytes = None


def get_cpu_metrics() -> Dict[str, Any]:
    """Collects detailed CPU telemetry."""
    try:
        cpu_util = psutil.cpu_percent(interval=None)
        per_core = psutil.cpu_percent(interval=None, percpu=True)
        freq = psutil.cpu_freq()
        return {
            "cpu_utilization": round(float(cpu_util), 2),
            "cpu_per_core": [round(float(c), 1) for c in per_core],
            "cpu_frequency_mhz": round(float(freq.current), 1) if freq else None,
            "cpu_logical_cores": psutil.cpu_count(logical=True),
            "cpu_physical_cores": psutil.cpu_count(logical=False),
        }
    except Exception as e:
        logger.warning(f"Failed to read CPU metrics: {e}")
        return {
            "cpu_utilization": None,
            "cpu_per_core": [],
            "cpu_frequency_mhz": None,
            "cpu_logical_cores": None,
            "cpu_physical_cores": None
        }


def get_memory_metrics() -> Dict[str, Any]:
    """Collects physical and virtual RAM telemetry."""
    try:
        mem = psutil.virtual_memory()
        return {
            "memory_usage": round(float(mem.percent), 2),
            "memory_total_gb": round(mem.total / (1024 ** 3), 2),
            "memory_used_gb": round(mem.used / (1024 ** 3), 2),
            "memory_available_gb": round(mem.available / (1024 ** 3), 2),
        }
    except Exception as e:
        logger.warning(f"Failed to read Memory metrics: {e}")
        return {
            "memory_usage": None,
            "memory_total_gb": None,
            "memory_used_gb": None,
            "memory_available_gb": None
        }


def get_disk_metrics() -> Dict[str, Any]:
    """Calculates disk read/write throughput rates in MB/s from sample deltas."""
    global _last_disk_time, _last_disk_read_bytes, _last_disk_write_bytes
    try:
        now = time.time()
        io = psutil.disk_io_counters()
        if io is None:
            return {"disk_io": None, "disk_read_mbs": None, "disk_write_mbs": None}

        if _last_disk_time is None or _last_disk_read_bytes is None or _last_disk_write_bytes is None:
            _last_disk_time = now
            _last_disk_read_bytes = io.read_bytes
            _last_disk_write_bytes = io.write_bytes
            return {"disk_io": None, "disk_read_mbs": None, "disk_write_mbs": None}

        elapsed = max(0.001, now - _last_disk_time)
        # Delta of cumulative counters over the elapsed window (clamped at 0 in
        # case a counter resets between samples).
        read_delta = max(0, io.read_bytes - _last_disk_read_bytes)
        write_delta = max(0, io.write_bytes - _last_disk_write_bytes)
        total_delta = read_delta + write_delta

        rate_mbs = total_delta / (1024 * 1024 * elapsed)
        read_mbs = read_delta / (1024 * 1024 * elapsed)
        write_mbs = write_delta / (1024 * 1024 * elapsed)

        _last_disk_time = now
        _last_disk_read_bytes = io.read_bytes
        _last_disk_write_bytes = io.write_bytes

        return {
            "disk_io": round(float(rate_mbs), 2),
            "disk_read_mbs": round(float(read_mbs), 2),
            "disk_write_mbs": round(float(write_mbs), 2),
        }
    except Exception as e:
        logger.warning(f"Failed to read Disk metrics: {e}")
        return {"disk_io": 0.0, "disk_read_mbs": 0.0, "disk_write_mbs": 0.0}


def get_network_metrics() -> Dict[str, Any]:
    """Measures network throughput rate (KB/s) and ping latency (ms)."""
    global _last_net_time, _last_net_bytes
    now = time.time()
    latency_ms = None
    
    # 1. Measure ping latency
    try:
        # Fast Windows ping with 1 echo request, 800ms timeout
        res = subprocess.run(
            ["ping", "-n", "1", "-w", "800", LATENCY_PING_HOST],
            capture_output=True, text=True, timeout=1.2
        )
        if res.returncode == 0:
            for line in res.stdout.splitlines():
                if "time=" in line or "time<" in line:
                    parts = line.split("time")
                    if len(parts) > 1:
                        val = parts[1].replace("=", "").replace("<", "").replace("ms", "").strip()
                        latency_ms = float(val)
                        break
    except Exception:
        latency_ms = None

    # 2. Measure throughput
    try:
        net_io = psutil.net_io_counters()
        total_bytes = net_io.bytes_sent + net_io.bytes_recv
        if _last_net_time is None or _last_net_bytes is None:
            _last_net_time = now
            _last_net_bytes = total_bytes
            throughput_kbs = 0.0
        else:
            elapsed = max(0.001, now - _last_net_time)
            throughput_kbs = max(0.0, (total_bytes - _last_net_bytes) / (1024 * elapsed))
            _last_net_time = now
            _last_net_bytes = total_bytes
            
        return {
            "network_latency": round(latency_ms, 1) if latency_ms is not None else None,
            "network_throughput_kbs": round(float(throughput_kbs), 1)
        }
    except Exception as e:
        logger.warning(f"Failed to read Network metrics: {e}")
        return {"network_latency": None, "network_throughput_kbs": None}


def get_gpu_metrics() -> Dict[str, Any]:
    """
    Attempts to read GPU metrics on Windows via PowerShell CIM or DirectX counter.
    For Intel Arc 140V or integrated graphics, queries Win32_VideoController.
    Returns null for any metrics not reliably exposed.
    """
    try:
        # Quick query for video controller name and status
        cmd = 'Get-CimInstance Win32_VideoController | Select-Object -First 1 Name, AdapterRAM, DriverVersion | ConvertTo-Json'
        res = subprocess.run(["powershell", "-NoProfile", "-Command", cmd], capture_output=True, text=True, timeout=1.5)
        if res.returncode == 0 and res.stdout.strip():
            import json
            data = json.loads(res.stdout)
            gpu_name = data.get("Name", "Integrated GPU")
            
            # Estimate GPU utilization from DirectX 3D performance counter if available
            gpu_util = None
            try:
                typeperf_cmd = 'typeperf "\\GPU Engine(*engtype_3D*)\\Utilization Percentage" -sc 1'
                tp_res = subprocess.run(typeperf_cmd, capture_output=True, text=True, shell=True, timeout=1.0)
                if tp_res.returncode == 0:
                    lines = [line.strip() for line in tp_res.stdout.splitlines() if line.strip() and not line.startswith('"(')]
                    if len(lines) >= 2:
                        values = [float(v.replace('"', '')) for v in lines[-1].split(',')[1:] if v.replace('"', '').replace('.', '').isdigit()]
                        if values:
                            gpu_util = round(max(values), 1)
            except Exception:
                gpu_util = None
                
            return {
                "gpu_name": gpu_name,
                "gpu_utilization": gpu_util,  # null if sensor not exposed
                "gpu_memory_used_mb": None,   # explicitly null if unsupported
                "gpu_temperature": None       # explicitly null if unsupported
            }
    except Exception as e:
        logger.debug(f"GPU probe note: {e}")
        
    return {
        "gpu_name": None,
        "gpu_utilization": None,
        "gpu_memory_used_mb": None,
        "gpu_temperature": None
    }


def get_process_metrics() -> Dict[str, Any]:
    """Collects process count, estimated thread count, and top consuming applications."""
    try:
        pids = psutil.pids()
        process_count = len(pids)
        total_threads = 0
        
        proc_list = []
        for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'num_threads']):
            try:
                info = p.info
                threads = info.get('num_threads') or 0
                total_threads += threads
                cpu_p = info.get('cpu_percent') or 0.0
                mem_p = info.get('memory_percent') or 0.0
                if cpu_p > 0.1 or mem_p > 0.5:
                    proc_list.append({
                        "pid": info['pid'],
                        "name": info['name'],
                        "cpu_percent": round(float(cpu_p), 1),
                        "memory_percent": round(float(mem_p), 1),
                        "threads": threads
                    })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

        # Sort top CPU and RAM processes
        top_cpu = sorted(proc_list, key=lambda x: x["cpu_percent"], reverse=True)[:5]
        top_mem = sorted(proc_list, key=lambda x: x["memory_percent"], reverse=True)[:5]
        
        # Context switches delta or total
        ctx_switches = None
        try:
            stats = psutil.cpu_stats()
            ctx_switches = stats.ctx_switches
        except Exception:
            ctx_switches = None
            
        return {
            "process_count": process_count,
            "thread_count": total_threads,
            "context_switches": ctx_switches,
            "top_cpu_processes": top_cpu,
            "top_memory_processes": top_mem
        }
    except Exception as e:
        logger.warning(f"Failed to read Process metrics: {e}")
        return {
            "process_count": None,
            "thread_count": None,
            "context_switches": None,
            "top_cpu_processes": [],
            "top_memory_processes": []
        }


def get_system_power_metrics() -> Dict[str, Any]:
    """
    Gathers system uptime, battery status, and probes Windows Power Meter counters.
    Distinguishes estimated from measured power.
    """
    # 1. Uptime in hours
    uptime_hours = round(max(0.01, (time.time() - psutil.boot_time()) / 3600.0), 2)
    
    # 2. Battery telemetry
    battery_pct = None
    power_plugged = None
    try:
        battery = psutil.sensors_battery()
        if battery:
            battery_pct = round(battery.percent, 1)
            power_plugged = battery.power_plugged
    except Exception:
        pass
        
    # 3. Temperature Probe
    temperature = None
    try:
        temps = psutil.sensors_temperatures()
        if temps:
            for k, entries in temps.items():
                if entries:
                    temperature = round(entries[0].current, 1)
                    break
    except Exception:
        pass

    # 4. Windows Power Meter Counter Check
    # On supported OEM systems, Windows exposes '\Power Meter(*)\Power'
    power_meter_raw = None
    try:
        pm_cmd = 'typeperf "\\Power Meter(*)\\Power" -sc 1'
        pm_res = subprocess.run(pm_cmd, capture_output=True, text=True, shell=True, timeout=0.8)
        if pm_res.returncode == 0 and "Power Meter" in pm_res.stdout:
            lines = [l.strip() for l in pm_res.stdout.splitlines() if l.strip() and not l.startswith('"(')]
            if len(lines) >= 2:
                parts = lines[-1].split(',')
                if len(parts) > 1 and parts[1].replace('"', '').replace('.', '').isdigit():
                    power_meter_raw = float(parts[1].replace('"', ''))
    except Exception:
        power_meter_raw = None

    return {
        "uptime": uptime_hours,
        "battery_percentage": battery_pct,
        "power_plugged": power_plugged,
        "temperature": temperature,
        "power_meter_raw": power_meter_raw
    }


# TTL cache for slow powercfg/WMI probes (plan and brightness change rarely;
# re-querying every 2s poll would just burn the watts we're trying to save).
_slow_probe_cache: Dict[str, Any] = {"at": 0.0, "power_saver_active": None, "screen_brightness": None}
_SLOW_PROBE_TTL = 30.0


def get_display_power_state() -> Dict[str, Any]:
    """
    Reads screen brightness (WMI, 0-100) and whether the Power Saver scheme is
    active (powercfg). Results are cached for 30s. Returns None per-field when
    the sensor is not exposed (external monitors, query failure).
    """
    global _slow_probe_cache
    now = time.time()
    if now - _slow_probe_cache["at"] < _SLOW_PROBE_TTL:
        return {
            "screen_brightness": _slow_probe_cache["screen_brightness"],
            "power_saver_active": _slow_probe_cache["power_saver_active"],
        }

    brightness = None
    saver = None
    try:
        res = subprocess.run(
            ["powershell", "-NoProfile", "-Command",
             "(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness).CurrentBrightness"],
            capture_output=True, text=True, timeout=3.0,
        )
        if res.returncode == 0 and res.stdout.strip():
            val = int(res.stdout.strip().split()[0])
            brightness = float(max(0, min(100, val)))
    except Exception:
        brightness = None

    try:
        from config import POWER_SCHEMES
        res = subprocess.run(["powercfg", "/getactivescheme"], capture_output=True, text=True, timeout=3.0)
        if res.returncode == 0:
            saver = 1 if POWER_SCHEMES["power_saver"].lower() in res.stdout.lower() else 0
    except Exception:
        saver = None

    _slow_probe_cache = {"at": now, "power_saver_active": saver, "screen_brightness": brightness}
    return {"screen_brightness": brightness, "power_saver_active": saver}


def collect_full_telemetry() -> Dict[str, Any]:
    """Assembles unified telemetry record conforming to GreenLedger schema."""
    cpu = get_cpu_metrics()
    mem = get_memory_metrics()
    disk = get_disk_metrics()
    net = get_network_metrics()
    gpu = get_gpu_metrics()
    proc = get_process_metrics()
    sys_power = get_system_power_metrics()
    display_state = get_display_power_state()
    
    record = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "is_live": True,
        # Schema mapped keys
        "cpu_utilization": cpu["cpu_utilization"],
        "memory_usage": mem["memory_usage"],
        "disk_io": disk["disk_io"],
        "network_latency": net["network_latency"],
        "process_count": proc["process_count"],
        "thread_count": proc["thread_count"],
        "context_switches": proc["context_switches"],
        "temperature": sys_power["temperature"],
        "uptime": sys_power["uptime"],
        # Extended Windows telemetry
        "gpu_name": gpu["gpu_name"],
        "gpu_utilization": gpu["gpu_utilization"],
        "cpu_frequency": cpu["cpu_frequency_mhz"],
        "cpu_per_core": cpu["cpu_per_core"],
        "memory_used_gb": mem["memory_used_gb"],
        "memory_total_gb": mem["memory_total_gb"],
        "disk_read_mbs": disk["disk_read_mbs"],
        "disk_write_mbs": disk["disk_write_mbs"],
        "network_throughput_kbs": net["network_throughput_kbs"],
        "battery_percentage": sys_power["battery_percentage"],
        "power_plugged": sys_power["power_plugged"],
        "power_meter_raw": sys_power["power_meter_raw"],
        "screen_brightness": display_state["screen_brightness"],
        "power_saver_active": display_state["power_saver_active"],
        "top_cpu_processes": proc["top_cpu_processes"],
        "top_memory_processes": proc["top_memory_processes"]
    }
    return record


if __name__ == "__main__":
    import json
    data = collect_full_telemetry()
    print("Full Windows Telemetry Collected:")
    print(json.dumps(data, indent=2))
