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

---

## Fix pass 2026-09-24 (full-repo review remediation)

### Fixed
- **Critical, frontend/app/optimize/page.tsx**: `rollbackMutation` was created inside the 429 `onError` callback (Rules-of-Hooks violation) yet referenced in render scope — crashing the verified-result panel after every successful optimization. Hoisted to component top level; removed dead `buildLocalRecommendations` duplicate and unused icon imports.
- **Build safety, frontend/next.config.js**: re-enabled `typescript.ignoreBuildErrors: false` (and documented the ESLint flag) so type errors fail the build instead of shipping as runtime crashes. Fixed the two `slideVariants` framer-motion `Variants` type errors this surfaced.
- **Contract, contracts/contracts/GreenBadge.sol**: `mint` was `onlyOwner`, so no user wallet could ever mint from the marketplace. Now supports self-claim (`msg.sender == account`) plus owner relay, with one-mint-per-wallet still enforced. Completed ERC-1155 surface: ERC-165 `supportsInterface`, `balanceOfBatch`, approvals, single/batch safe transfers with receiver checks, `TransferBatch`/`ApprovalForAll` events. `frontend/lib/web3.ts` owner-gate replaced with an ERC-1155 interface check plus an already-minted pre-check. Contract tests rewritten/extended; added missing `contracts/package.json` + `hardhat.config.js` (plus standard `contracts/` sources layout) so `npx hardhat test` and the Sepolia deploy script run.
- **ML integrity, ml/scripts/train.py**: final fit early-stopped on the TEST split (test-set leakage). Now early-stops on validation; test split is touched once for reporting. Model retrained: R² 0.9753, MAPE 4.17% (n=1500) — confirming the metrics were not an artifact of the leak.
- **Agent safety, agent/optimizer.py**: `close_process_<pid>` execution now enforces the optimizable-application allowlist (previously only the denylist), closing the crafted-action-ID hole. `frontend/lib/api.ts` local recommendation mirror is allowlist-based to match.
- **Backend whitelist**: removed dead `trim_working_sets` entry (no implementation anywhere). `docs/api-contract.md` + `docs/optimization.md` updated (brightness action documented in its place).
- **Agent telemetry, agent/windows_metrics.py**: `disk_read_mbs`/`disk_write_mbs` divided cumulative-since-boot counters by the poll interval (ever-growing fiction). Now computed from per-sample deltas like `disk_io`.
- **Agent CORS, agent/api.py**: replaced `allow_origins=["*"]` + credentials (rejected by browsers) with explicit loopback origins.
- **Honesty/copy**: landing + deck + step copy now cite measured `metrics.json` values (R² 0.975, MAPE 4.2%) instead of "99.1% R² / sub-2ms"; `metrics.json` + `dataset_loader.py` no longer record absolute local paths; `.env.example` inner-quote footgun removed; `deployment.md` now states the Vercel build is frontend-only and documents the hosted-backend requirement for remote Demo Mode.
- **Minor**: `rewards.py` lifetime-kWh conversion uses the named `DEFAULT_CARBON_INTENSITY` constant instead of a magic `385.0`.

### Verification (this environment, Linux sandbox)
- Backend suite: `python -m pytest backend/tests/` — all pass (see run output).
- Contract compile: `solcjs` (solc 0.8.20 via npm) compiles `contracts/contracts/GreenBadge.sol` with no errors. `npx hardhat test` could NOT run in this sandbox (binaries.soliditylang.org is unreachable here, so Hardhat cannot download its compiler) — run `cd contracts && npm install && npx hardhat test` on a networked machine; the suite covers self-claim, owner relay, duplicates, ERC-165, batch balances, and approval-gated transfers.
- **Build/runtime crash, frontend/app/api/start-services/route.ts**: the GET handler executed during `next build` static route evaluation and called `spawn("cmd.exe", …)` with no `'error'` listener — an unhandled error event that crashes the Node worker on any non-Windows machine (Linux dev, Vercel build/runtime). Now `force-dynamic`, returns 501 on non-Windows instead of spawning, and attaches error handlers that reset the started flags. `frontend/app/api/brightness/route.ts` also marked `force-dynamic` (hardware probing must not run at build).
- Frontend: `npx tsc --noEmit` clean and full `npm run build` succeeds (18/18 static pages, type checks enforced). In this sandbox Google Fonts is unreachable, so the build was verified with the `next/font` import temporarily stubbed and `app/layout.tsx` then restored byte-identical (no diff).
- Retrain: `python ml/scripts/train.py` regenerates model + schema + honest metrics.
- Not verifiable here: Windows-only paths (`powercfg`, WMI brightness, agent subprocess probes), live Sepolia deployment, and MetaMask self-claim UX — all require Windows hardware + testnet wallet.

---

## Fix pass 2026-09-24 (v1.1.0: beating the 40% project, honestly)

### Double-check findings (prompted by external skepticism — largely valid)
- v1.0 model saw utilization % only: brightness cuts, power-plan switches, and
  frequency caps change watts through backlight/clocks the model never
  received, so they verified at ~0% even when real watts dropped.
- Literature: laptop backlight ~26-29% of system power; idle dimming cut total
  system 13.1W -> 8.2W (-37%, Mahesri & Vardhan); LCD max-min delta ~6W
  (NotebookCheck); Power Saver vs High Performance ~18% at full load but ~0%
  at idle (wall measurements); DVFS P = C*V^2*f with workload-dependent,
  diminishing returns on modern silicon (Weissel & Bellosa).
- Conclusion: 40%+ is real but ONLY via stacked levers + an instrument that
  sees them. Single "simple optimizations" verify at ~10-25% each.

### Built
- **Model v1.1.0**: +`screen_brightness`, +`cpu_frequency`, +`power_saver_active`,
  +`freq_util_product` (DVFS interaction, now top importance at 0.72).
  Synthetic physics extended (display + DVFS terms); retrained honestly
  (test untouched): R² 0.9592, MAE 0.98W, MAPE 4.46%.
- **Agent**: `cap_cpu_55` (powercfg PROCTHROTTLEMAX AC+DC, verified + reversible)
  and `eco_core` bundle (saver plan + cap, all-or-nothing, single undo);
  collector adds cached (30s TTL) brightness + saver-state probes.
- **Backend**: whitelist += `cap_cpu_55`, `eco_mode`; recommendations offer the
  Eco bundle; schemas accept the v1.1 signals; demo scenarios carry them.
- **Frontend**: Eco Mode hero card (brightness 35 + eco_core, one verified
  cycle, full rollback); telemetry types extended.
- **Proof**: `ml/scripts/evaluate_actions.py` — frozen personas, N trials,
  mean ± 95% CI, JSON trial log. Headline: Eco Mode **43.2% ± 1.3%** on
  `student_typical` (n=20); 63% heavy baseline, 12% clean baseline.

### Verification (Linux sandbox)
- Backend suite 51/51; `tsc --noEmit` clean; eval protocol + retrain run green.
- Not verifiable here: Windows-only execution (powercfg/WMI), live trial
  confirmation on hardware, Sepolia redeploy.

## Phase 0 — Integrity fixes (2026-09-24)
Full-repo line-by-line re-read; all findings fixed before any new work.

### Bugs fixed
- **Live `disk_io` permanently 0.0** (`agent/windows_metrics.py`): header declared
  `_last_disk_bytes`, reader used `_last_disk_read/write_bytes` → NameError every
  poll, swallowed by `except`. Header corrected; verified at both sites.
- **Stale explanation panel** (`inference.py`): contributions hardcoded v1.0
  features, hiding `freq_util_product` (importance 0.72). Now v1.1 set.
- **Participation farming** (`rewards.py`): sub-threshold cycles extended streaks
  and optimization counts (~900 farmable credits/hr). Participation now awards
  5 credits only; docs + contract updated.
- **Mint-evidence gap** (`verifier.py`): TransferSingle check ignored event
  signature and `from == 0x0`, so a self-transfer could pose as a mint. Strict
  now, with regression tests.
- **Fabricated latency** (`ScrollDashboardDeck.tsx`): `"1.4 ms"` placeholder while
  loading → `"—"`; stale `v1.0.0` fallback → live version from payload.
- **OOD false-positives** (`train.py` + `inference.py`): raw min/max bounds flagged
  real machines (boost clocks, long uptimes). Schema now stores explicit
  `ood_min/ood_max` (observed extremes ± 3σ margin, physical limits); retrained,
  metrics unchanged (R² 0.9592, MAPE 4.46%).
- **Dropped `Retry-After`** (evaluate-delta proxy): forwarded, so the 429
  countdown uses the server value.
- **CPU-cap rollback 422** (`api.ts` + optimize page): `cap_cpu_55` rollback
  branch added; Rollback button gated consistently.

### Honesty/copy corrections
- Diagnostics: model version from payload (was hardcoded v1.0.0); loss-function
  copy corrected (squared error, not "multi-objective").
- Landing: "6 Primary Features" → 13; "0 Risk" → "Reversible · Guarded";
  "Autonomous Optimization" → "Human-Approved"; spoofing-prevention overclaim
  removed.
- README: "hyperparameter cross-validation, 70/15/15" → fixed params, single
  85/15 split (seed 42). Hackathon script + API contract numbers refreshed.
- `.env.example`: removed never-read vars (`PORT/HOST/DEBUG`, `MODEL_PATH*`,
  `API_RATE_LIMIT`, `NEXT_PUBLIC_DEFAULT_CARBON_INTENSITY`);
  `CARBON_INTENSITY_KG_PER_KWH` is now actually read by the calculator.

### Hygiene
- Deleted ~1,100 lines of dead components (`PowerGauge`, `SlidingDashboardDeck`,
  `SlidingCardCarousel`, `PresentationMode`, `BlurText` — imported nowhere).
- `EnergyCore3D`: scene builds once, telemetry ticks via refs (was full
  rebuild + flicker every 2.5s). `Providers`: start-services fetch moved from
  state initializer to `useEffect`. Before/after window now medians v1.1
  signals (brightness/frequency/saver), not just cpu/mem/disk.

### Verification (Linux sandbox)
- Backend suite **56/56** (5 new: OOD flag ×2, mint-evidence ×2,
  participation anti-farming ×1); `tsc --noEmit` clean; retrain reproduces
  metrics exactly. `next build` fails only on Google Fonts fetch (sandbox has
  no external web access) — no code errors.
