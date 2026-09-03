# GreenLedger — Windows Native Telemetry Agent

A native, lightweight Windows background agent for the GreenLedger AI Energy & Carbon Optimization Platform.

## Features
- **Real-Time Telemetry**: Collects CPU, RAM, GPU, Disk I/O, Network Throughput, Latency, and Process metrics.
- **Hardware Honesty**: Queries native performance counters; surfaces unsupported sensors as `null` instead of inventing values.
- **Safe Optimization**: Executes user-approved, non-destructive system tuning (Windows power scheme switching, graceful application closures).
- **Protected Processes**: Hardcoded guardrails prevent modification or termination of critical Windows services.
- **Localhost API**: Exposes lightweight HTTP and WebSocket endpoints on `http://127.0.0.1:8765` for the web dashboard.

---

## Installation & Setup

### Prerequisites
- Windows 10/11
- Python 3.10+
- PowerShell 5.1+

### Install Dependencies
```powershell
pip install -r requirements.txt
```

### Running the Agent
```powershell
python api.py
```
By default, the server listens at:
`http://127.0.0.1:8765`

---

## Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Agent status, version, and platform metadata |
| `GET` | `/telemetry` | Latest telemetry snapshot |
| `GET` | `/telemetry/history` | Rolling buffer of recent telemetry points |
| `WS`  | `/telemetry/stream` | Real-time WebSocket telemetry stream |
| `GET` | `/optimization/recommendations` | Current actionable optimization opportunities |
| `POST`| `/optimization/execute` | Execute an approved optimization action |
| `POST`| `/optimization/undo` | Reverse an applied optimization |

---

## Security & Safety Guardrails
1. **Never Kills System Processes**: Critical processes (`explorer.exe`, `svchost.exe`, `dwm.exe`, antivirus software, etc.) are strictly blacklisted.
2. **Reversible Actions**: System power plans record previous state for instantaneous rollback.
3. **No Arbitrary Execution**: The API accepts strictly defined action IDs; arbitrary shell commands from the frontend are rejected.
