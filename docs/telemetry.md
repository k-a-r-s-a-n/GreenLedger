# Windows Telemetry Collection Documentation

## Overview
The GreenLedger local agent collects hardware performance counters on Windows 11 targeting modern processor architectures (including Intel Core Ultra and Intel Arc 140V integrated graphics).

---

## Metrics Collected

| Subsystem | Metric | Source | Fallback |
|---|---|---|---|
| **CPU** | Utilization (%) | `psutil.cpu_percent(percpu=True)` | Baseline |
| **CPU** | Clock Frequency (MHz) | `psutil.cpu_freq()` | None |
| **CPU** | Logical / Physical Cores | `psutil.cpu_count()` | Baseline |
| **RAM** | Percentage & GB | `psutil.virtual_memory()` | None |
| **GPU** | Engine Utilization (%) | DirectX 3D Typeperf Counter / CIM | `null` |
| **GPU** | Controller Name | `Win32_VideoController` | `null` |
| **Disk** | I/O Throughput (MB/s) | `psutil.disk_io_counters()` delta | `0.0` |
| **Network**| Ping Latency (ms) | Fast Windows `ping -n 1 -w 800` | `null` |
| **Network**| Throughput (KB/s) | `psutil.net_io_counters()` delta | `0.0` |
| **Processes**| Count & Top Consuming | `psutil.process_iter()` | Baseline |
| **Power** | Windows Power Meter | `\Power Meter(*)\Power` counter | `null` |

---

## Handling Missing or Unsupported Hardware
In accordance with GreenLedger's Technical Honesty rules:
- Unsupported sensors (such as GPU temperature or proprietary Power Meter counters on unsupported OEMs) return explicit `null`.
- The system never fabricates fictitious wattage readings from absent sensors.
