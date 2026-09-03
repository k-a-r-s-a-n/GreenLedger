"""
GreenLedger - Windows Agent Configuration
Configurable settings, network endpoints, and system safety constraints.
"""

import os

# Server Settings
AGENT_HOST = os.getenv("AGENT_HOST", "127.0.0.1")
AGENT_PORT = int(os.getenv("AGENT_PORT", "8765"))
AGENT_POLL_INTERVAL = float(os.getenv("AGENT_POLL_INTERVAL", "2.0"))

# Network latency test host
LATENCY_PING_HOST = os.getenv("LATENCY_PING_HOST", "1.1.1.1")

# Windows Standard Power Scheme GUIDs (from powercfg)
POWER_SCHEMES = {
    "balanced": "381b4222-f694-41f0-9685-ff5bb260df2e",
    "power_saver": "a1841308-3541-4fab-bc81-f71556f20b4a",
    "high_performance": "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c"
}

# Critical system processes that must NEVER be terminated or altered
PROTECTED_PROCESSES = {
    "system", "system idle process", "registry", "smss.exe", "csrss.exe", 
    "wininit.exe", "services.exe", "lsass.exe", "svchost.exe", "fontdrvhost.exe",
    "winlogon.exe", "dwm.exe", "explorer.exe", "sihost.exe", "taskhostw.exe",
    "spoolsv.exe", "securityhealthservice.exe", "msmpeng.exe", "antigravity.exe",
    "code.exe", "python.exe", "cmd.exe", "powershell.exe", "conhost.exe"
}

# Common user processes that can be safely suggested for optimization
OPTIMIZABLE_PROCESS_CANDIDATES = {
    "chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe",
    "spotify.exe", "discord.exe", "slack.exe", "teams.exe", "zoom.exe",
    "steam.exe", "epicgameslauncher.exe", "dropbox.exe", "onedrive.exe",
    "notion.exe", "figma.exe"
}
