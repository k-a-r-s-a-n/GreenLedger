# Optimization Engine & System Safety Documentation

## Overview
The GreenLedger optimization engine translates hardware telemetry into ranked, non-destructive efficiency interventions.

---

## Safety Guardrails & Blacklist
GreenLedger enforces strict non-negotiable safety guardrails:
1. **Never Kills System Processes**: `explorer.exe`, `svchost.exe`, `dwm.exe`, `csrss.exe`, `lsass.exe`, and antivirus services (`msmpeng.exe`, `securityhealthservice.exe`) are blacklisted from termination.
2. **Reversible Actions**: Windows power scheme adjustments record the prior scheme GUID for instant rollback.
3. **No Arbitrary Shell Execution**: The agent exposes strictly enumerated action IDs; arbitrary terminal command strings sent from the web client are rejected.

---

## Available Optimization Actions

### 1. Windows Energy Saver Profile (`enable_power_saver`)
- **Action**: Activates Windows Power Saver scheme using `powercfg /setactive a1841308-3541-4fab-bc81-f71556f20b4a`.
- **Effect**: Curbs dynamic core voltage spikes, limits background telemetry, and reduces idle wattage by 10-15%.
- **Reversible**: Yes (`undo` restores original power plan).

### 2. Graceful Process Suspension (`close_process_<pid>`)
- **Action**: Sends `SIGTERM` to high-draw user processes (e.g. background Chrome, Spotify, Discord, Slack).
- **Safety**: Only applies to non-system user-space applications.
- **Reversible**: Manual application relaunch.

### 3. Memory Working Set Trim (`trim_working_sets`)
- **Action**: Flushes Python caches and signals the Windows memory manager to release stale working set pages.
