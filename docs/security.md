# Security & Telemetry Boundary Policy

## Core Tenets
1. **No Sensitive Telemetry Upload**: We do not capture personal files, keyboard inputs, browser histories, passwords, or document metadata.
2. **Strict Whitelists**: The agent only interacts with whitelisted Windows performance counters and well-defined user applications.
3. **Protected OS Services**: Windows critical binaries (`explorer.exe`, `svchost.exe`, `dwm.exe`, antivirus) cannot be terminated or targeted by optimization routines.
4. **Non-Custodial Web3**: Zero private key storage or seed phrase handling. All transaction signing is performed client-side in MetaMask.
5. **CORS Security**: Cross-Origin Resource Sharing is scoped and parameterized.
