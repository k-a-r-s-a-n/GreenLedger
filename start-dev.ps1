$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Start-Process powershell -WorkingDirectory (Join-Path $root "agent") -ArgumentList @(
    "-NoExit",
    "-Command",
    "python api.py"
)

Start-Process powershell -WorkingDirectory (Join-Path $root "backend") -ArgumentList @(
    "-NoExit",
    "-Command",
    "python main.py"
)

Start-Process powershell -WorkingDirectory (Join-Path $root "frontend") -ArgumentList @(
    "-NoExit",
    "-Command",
    "npm run dev"
)

Write-Host "GreenLedger services are starting in separate PowerShell windows."
Write-Host "Dashboard: http://localhost:3000"