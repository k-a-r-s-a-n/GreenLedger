# Optimization Audit

Audit started: 2026-09-20

## Progress log

- Step 1 started: created this audit before inspecting implementation.
- Scope constraint: only optimization code and directly related optimization wiring may be edited. Protected areas will be recorded, not changed.

## Findings

### Step 1: flow trace findings

#### Optimization integrity and safety

- **Critical, frontend/app/optimize/page.tsx:~183-220**: demo-mode process actions are treated as successful without executing anything (`!isLive && isProcessAction ? true`), then the UI fetches a canned `"optimized"` demo snapshot. This can present simulated savings as an optimization cycle.
- **High, frontend/app/optimize/page.tsx:~218-271 (fixed)**: the former backend-failure path computed a local fallback wattage and synthetic credit/balance fields. That path has been removed; verification failures now remain explicit errors.
- **High, frontend/lib/api.ts:~150-210**: ML inference failures fall back to hardcoded CMOS watt formulas and hardcoded latency/contributions. This violates the requirement that unavailable model inference be surfaced explicitly.
- **High, frontend/app/optimize/page.tsx:~130-145 and ~515**: brightness is advertised as `~18% expected reduction`, but brightness is absent from `ml/models/feature_schema.json`; `modeledWatts` adds a frontend-only brightness term not used by backend XGBoost. The expected reduction is therefore fabricated/uncalibrated.
- **High, frontend/app/optimize/page.tsx:~184-221**: the before snapshot is the page's stale initial telemetry rather than a fresh pre-action sample; after waits only 1.5 seconds and takes one sample. This conflates workload drift/noise with action impact.
- **High, agent/optimizer.py:~14-31 and ~85-106**: active power scheme detection silently defaults to Balanced when `powercfg` fails or an OEM/custom GUID is active. Rollback can therefore change a user's original plan instead of restoring it.
- **High, agent/optimizer.py:~78-84**: recommendation command failures are swallowed and the method can still return recommendations; the user receives no explicit inability-to-query status.
- **Medium, agent/optimizer.py:~113-156**: process rollback is not available. Termination is irreversible from the application, despite the general optimization UX offering rollback for the subsystem.
- **Medium, agent/optimizer.py:~145-147**: a process that disappears before execution is reported as success, even though no action was performed.
- **Medium, backend/services/optimization/engine.py:~104-118**: backend always recommends Power Saver, even if already active, and does not use live power-plan state. Its recommendation path is telemetry-only and is not consistent with the agent.
- **Medium, backend/services/optimization/engine.py:~177-181**: predicted reductions are clamped at zero; negative/noisy deltas become zero savings but still consume a cycle and receive participation credits. There is no confidence/drift check.
- **Medium, backend/services/optimization/engine.py:~163-169**: only exact dictionary equality is rejected. Volatile telemetry is removed, but there is no tolerance/noise model, sample aggregation, or action-effect validation.
- **Medium, backend/services/credits/rewards.py:~174-187**: all server-accepted cycles invoke reward/streak bookkeeping; participation credits are awarded even when the model delta is below the 3% threshold. This is permitted only as minimal participation, but the frontend's unverified fallback can make the user believe it is a verified cycle.
- **Medium, agent/api.py:~37-45**: CORS allows `*` together with credentials. This is rejected/normalized by browsers and is unsafe for a localhost control service.

#### ML evidence

- `ml/models/feature_schema.json` has only CPU, memory, disk, process/thread, uptime, and engineered ratios/pressure. There is no feature for power-plan state, process priority/termination, screen brightness, GPU, battery discharge, or workload identity.
- `ml/models/metrics.json` records a synthetic dataset (`is_synthetic: true`, 10,000 rows), `mape_percent: 4.1`, `r2: 0.9759`, `mae_watts: 0.968`, and `rmse_watts: 1.2113`. These are benchmark test-split metrics, not measured accuracy on a user's machine.
- `ml/scripts/train.py` computes the metrics honestly from a held-out split, but does not measure inference latency. README's `4.12%` and `1.38 ms` claims are not backed by the checked-in metrics/training computation (metrics say 4.10%; inference measures latency at runtime).
- Feature importance is dominated by synthetic CPU utilization (`0.82285`). Actions whose effects are not represented in those features cannot be causally attributed by this model.

#### Contract/wiring findings

- The agent exposes `/optimization/execute` and `/optimization/undo`; the frontend uses agent execution for live process actions but routes power/brightness through Next.js routes. There is no frontend rollback control in the inspected optimization flow.
- `backend/api/optimization.py` accepts raw before/after dictionaries and requires `is_live`; the frontend now blocks demo execution and does not convert a 422 into a fabricated result.
- `docs/optimization.md` describes `trim_working_sets`, but the agent implementation has no such action and backend whitelists it. This is dead/unsupported contract surface.
- `start-dev.ps1` prints port 3001 while the frontend/default contract uses port 3000; backend runs with reload enabled in `main.py`, while the script starts it as a development service.
- `vercel.json` builds from repository root using `npm --prefix frontend`, consistent with a monorepo deployment, but no runtime backend/agent deployment is provided.

#### Protected/out-of-scope observations (not fixed)

- `agent/windows_metrics.py` is protected telemetry code and was not modified. Its fields feed the model, but the model schema omits several collected hardware signals.
- Contracts and Web3 badge/token logic were not modified. Credit state is in-process memory only (`backend/services/credits/rewards.py`), so balances reset on restart; this is a persistence risk.
- Marketplace/badge behavior and contract token IDs require a separate audit; any mismatches will be recorded after health checks without edits outside optimization scope.

### Step 2: health-check results

- **Backend dependencies/tests**: the workspace `.venv` was selected and the full backend suite was run through that interpreter. Result: **49 passed, 2 deprecation warnings**. The warnings are from the installed Starlette/httpx compatibility layer.
- **Backend endpoint coverage**: the passing suite exercised health, ML prediction, telemetry validation/demo, optimization whitelist/cooldown/duplicate behavior, credits, badges, marketplace, and blockchain verification tests.
- **Frontend static analysis**: VS Code problem diagnostics reported no errors in the changed optimization page, result card, or API client. The requested `npm install`, lint, type-check, and Next build could not be run because the provided terminal has neither `powershell.exe` nor `pwsh.exe`; this is an environment limitation, not a passing build result.
- **Agent runtime**: direct Windows `powercfg` execution was not possible in this environment. A mocked runtime check verified exact power-scheme GUID parsing. Real hardware execution and rollback remain to be verified on Windows 10/11.
- **Ports/wiring**: source inspection confirms agent `8765`, backend `8000`, and frontend dev script `3001`; `start-dev.ps1` prints `3001`, while backend CORS defaults include `3000` and `3001`. This is inconsistent but outside the permitted non-optimization scope.

### Step 3: changes made

- **agent/optimizer.py**: captures the exact active power-plan GUID at execution time (including custom OEM GUIDs), fails explicitly when it cannot query the plan, refuses no-op Power Saver requests, and rollback restores/removes the exact recorded action. A vanished process is no longer reported as a successful optimization.
- **backend/services/optimization/engine.py**: validates client-provided measurement-window quality (minimum three samples and bounded CPU/RAM variation), uses the protected Windows Power Meter value as an independent contradiction check when present, and computes carbon savings from the accepted reduction rather than from a contradicted model delta.
- **backend/tests/test_optimization_safety.py**: added regression tests for noisy windows and contradictory power-meter evidence.
- **frontend/app/optimize/page.tsx**: removed demo execution and all local fabricated before/after estimates; optimization now requires live telemetry, takes three-sample median windows before and after execution with a two-second stabilization delay, and surfaces backend verification failures. Brightness has no promised percentage.
- **frontend/lib/api.ts**: removed hardcoded ML/carbon fallbacks, routed optimization calls through same-origin proxies to avoid browser CORS failures, preserved agent error details, and added explicit reversible-action rollback calls.
- **frontend/app/api/agent/optimization/execute/route.ts**, **frontend/app/api/agent/optimization/undo/route.ts**, **frontend/app/api/backend/optimization/recommendations/route.ts**, **frontend/app/api/backend/optimization/evaluate-delta/route.ts**: added same-origin forwarding routes for optimization requests; browser calls no longer preflight directly against ports 8765/8000.
- **agent/optimizer.py**: process actions now validate the approved executable name as well as PID before termination, reducing PID-reuse risk.
- **frontend/components/BeforeAfterCard.tsx**: added a one-click rollback control for power-plan and brightness actions; process termination is explicitly not offered as reversible.
- **README.md, docs/ml.md, docs/optimization.md**: corrected unsupported MAPE/latency claims and removed fixed optimization savings claims.

### Step 4: verification and real-number evidence

- Full backend suite: **49/49 passed** in **23.73 seconds**; two dependency deprecation warnings.
- Targeted changed-file diagnostics: **no errors** for the changed Python and TypeScript files.
- Syntax checks: no syntax errors for the changed Python optimizer and backend engine.
- Mocked agent check: exact Balanced GUID `381b4222-f694-41f0-9685-ff5bb260df2e` parsed successfully.
- A full live optimization cycle and physical rollback were **not verifiable here** because this environment lacks a Windows PowerShell executable and the local agent/hardware services were not started. No live watt, battery, or rollback numbers are claimed.

### Root causes addressed

1. Demo-mode simulation and frontend fallback estimates could turn non-executions or unavailable verification into apparent savings.
2. Single stale snapshots and a 1.5-second wait made workload drift indistinguishable from action impact.
3. Power-plan rollback relied on a startup-time known-plan default rather than the exact active GUID.
4. The XGBoost feature schema cannot see brightness, power-plan state, or process termination; the flow now measures live changes honestly and uses the optional Windows power meter only as a contradiction guard, without claiming causal attribution the model does not provide.

### Still fake, mocked, or unverifiable

- `/api/telemetry/demo` remains deterministic simulated telemetry for offline presentation. It is now prevented from executing or claiming verified optimization savings.
- The checked-in model is trained on synthetic benchmark data; its metrics do not establish accuracy on a user's hardware.
- Brightness and process actions may produce no model-visible change; they receive only the backend's minimal participation reward when the measured/model delta is below threshold.
- No physical power meter is guaranteed. When `power_meter_raw` is absent, results remain model estimates and are labeled/displayed as estimated power.
- The frontend npm lint/type/build suite and real Windows powercfg/WMI cycle remain unrun due the missing terminal executable/hardware service in this environment.
- The Chrome action is no longer a local/demo success: it sends the selected live PID and executable name to the agent, and an agent rejection is shown to the user. A real Chrome termination could not be verified without the local agent running.

### Follow-up: monitor and landing-page performance

- The backend ML endpoint was directly exercised with demo telemetry and returned a real XGBoost estimate (`27.99 W` in the verification run). The dashboard previously rendered only “waiting for inference” when the browser could not reach the backend and gave no actionable prediction error.
- The dashboard now retries transient prediction failures and explicitly shows `ML backend unavailable — retrying` with a manual retry action instead of implying the model is still working indefinitely.
- The landing-page WebGL path used two dynamic Three.js scenes (particles plus the 3D sphere), high device-pixel-ratio rendering, and relatively dense geometry. The sphere now caps pixel ratio at 1.5, uses lower-cost geometry/node counts, and applies paint containment; the background particle field is reduced from 900 to 350 points and caps at 1.25 pixel ratio.
- Frontend diagnostics for all files changed in this follow-up report no errors. A browser performance trace and npm build remain unavailable because the terminal runner lacks PowerShell in this environment.

### Follow-up reproduction: dashboard values

- Browser reproduction at `http://localhost:3001/dashboard` showed the exact root cause: browser CORS failures for direct browser requests to `http://127.0.0.1:8000/api/ml/predict` and `/api/carbon/calculate`, while telemetry from the local agent continued to work. This left the prediction query pending and the cards blank.
- Added same-origin Next.js proxy routes for ML prediction and carbon calculation. Browser verification then returned `200`, `23.39 W` for ML prediction, and `17.21 g CO2e/h` for carbon calculation. A full dashboard reload rendered XGBoost power, carbon rate, energy score, and CPU values.

### Protected/out-of-scope issues not fixed (ranked)

1. **High — agent/windows_metrics.py**: the protected collector gathers battery/power-meter and extended hardware data, but the current model schema does not use most of it; adding causal features requires a separately reviewed telemetry/model change.
2. **High — backend/services/credits/rewards.py**: all credits and badge state are in-process memory and reset on backend restart; this threatens durable balances and marketplace continuity.
3. **Medium — frontend/app/marketplace/page.tsx, badges pages, contracts/**: marketplace, badge, and token-ID compatibility was not changed or independently deployed; it requires a dedicated protected Web3 audit.
4. **Medium — start-dev.ps1 and frontend package scripts**: documented/printed port behavior differs (`3000` vs dev `3001`); not changed because it is outside the optimization subsystem.
5. **Low — backend test warnings**: installed Starlette/httpx versions emit deprecation warnings; no behavior failure was observed.
