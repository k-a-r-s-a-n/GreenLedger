# GreenLedger API Contract

Single source of truth between the FastAPI backend and the frontend. Any change to an
endpoint, request body, response body, or error format MUST be reflected here in the
same change. Backend base URL: `NEXT_PUBLIC_API_URL` (default `http://127.0.0.1:8000`).

OpenAPI schema: available live at `/docs` (Swagger UI) and `/openapi.json` while the
backend runs — this document is the human-readable contract that takes precedence.

---

## Storage Model (explicit)

The backend has **no database wired up**. All state lives **in-memory** in the FastAPI
process (module-level singletons in `services/`):

- `services/credits/rewards.py::credit_service` — user credit balances, streaks, badge
  unlock state, wallet mint ledger.
- `services/optimization/engine.py::optimization_service` — per-user cooldown timers and
  replay-detection hash windows.

Consequences:
- State resets on backend restart. This is a demo/hackathon deployment decision; when a
  database is introduced, only these two singletons need swapping (the API layer never
  touches storage directly).
- Multi-user badge state is **per user** (`unlocked_badges`), and on-chain mints are
  additionally keyed **per wallet** so a badge is permanently associated with the wallet
  that minted it.

---

## Error Format

All errors use FastAPI's standard shape:

```json
{ "detail": "human-readable message" }
```

| Status | Meaning |
| ------ | ------- |
| 400 | Bad request (validation of a value the schema can't express, e.g. wallet format, already-owned badge, already-minted badge) |
| 422 | Request body failed Pydantic validation, or an expected business-rule rejection (unknown action, identical snapshots, duplicate submission, non-live telemetry) |
| 429 | Cooldown active between optimization cycles (includes `Retry-After` header) |
| 503 | A required dependency is unavailable and the request failed closed (ML model missing, Sepolia receipt unverifiable) |

---

## Endpoints

### `GET /health`
- **200** `{ "status": "online", "service": "GreenLedger API", "version": "1.0.0", "environment": "production" }`

---

### `POST /api/telemetry/validate`
Request: any `TelemetryInput` payload. Returns `{ "valid": true, "data": {...} }`.

### `GET /api/telemetry/demo?scenario=normal|high_load|optimized`
Simulated telemetry used when no live agent is present. Always `is_live: false`.
Shape: `TelemetryInput` plus `mode_label`.

---

### `POST /api/ml/predict`
Request body: `TelemetryInput` (raw telemetry; agent or demo format).
Required fields: `cpu_utilization`, `memory_usage`, `process_count`; `disk_io`,
`thread_count`, `uptime` must be present for full feature mapping (422 if core features
missing).

**200** `PredictionResponse`:
```json
{
  "estimated_power_w": 42.1,
  "model_version": "1.0.0",
  "warnings": [],
  "inference_latency_ms": 1.234,
  "feature_contributions": { "cpu_utilization": 12.3 },
  "is_out_of_distribution": false
}
```

Errors: **422** (required telemetry unavailable), **503** (model artifact missing —
`feature_schema.json`/`power_model.json` not found in `ml/models/`).

### `GET /api/ml/diagnostics`
Model metadata and metrics (`model_loaded`, `schema`, `metrics`); `schema`/`metrics` are
`null` when the model was never trained/loaded.

---

### `POST /api/carbon/calculate`
Request `CarbonRequest`:
```json
{ "power_watts": 45.0, "duration_hours": 2.0, "carbon_intensity_kg_per_kwh": 0.385 }
```
**200** `CarbonResponse`: `power_watts`, `duration_hours`, `energy_kwh`,
`carbon_intensity_kg_per_kwh`, `emissions_g_co2`, `emissions_kg_co2`,
`trees_offset_equivalent`, `car_km_equivalent`.

### `GET /api/carbon/factors`
Regional grid emission factors keyed by region slug (`us_average`, `eu_average`, `uk`,
`germany`, `india`, `nordic`, `100_renewable`).

---

### `POST /api/optimization/recommendations`
Request body: raw `TelemetryInput` payload (the frontend forwards the telemetry it
fetched from the agent). **200**: `OptimizationRecommendation[]`:
```json
[{
  "id": "enable_power_saver",
  "title": "Enable Windows Energy Saver Profile",
  "category": "power_plan",
  "priority": "high",
  "estimated_power_reduction_pct": null,
  "reversible": true,
  "description": "...",
  "action_name": "Switch Power Plan",
  "pid": null,
  "process_name": null,
  "cpu_percent": null,
  "memory_percent": null
}]
```
Only safe action ids are ever recommended: `enable_power_saver` or `close_process_<pid>`.

### `POST /api/optimization/evaluate-delta`
Request `DeltaEvaluationRequest`:
```json
{
  "action_id": "enable_power_saver",
  "before_telemetry": { "...": "...", "is_live": true },
  "after_telemetry": { "...": "...", "is_live": true },
  "user_id": "default_user"
}
```
**200** `BeforeAfterComparison`:
```json
{
  "action_id": "enable_power_saver",
  "before_power_w": 46.1,
  "after_power_w": 39.8,
  "reduction_watts": 6.3,
  "reduction_pct": 13.7,
  "hourly_co2_saved_g": 2.42,
  "credits_awarded": 25,
  "new_credit_balance": 125,
  "streak_days": 1,
  "action_hash": "9f2c...",
  "unlocked_badge": null
}
```

**Anti-abuse rules enforced server-side:**
1. **Safe action whitelist** — only `enable_power_saver`, `trim_working_sets`,
   `reduce_brightness`, or `close_process_<numeric pid>` are accepted; anything
   else → **422**.
2. **Live telemetry required** — `before_telemetry`/`after_telemetry` must carry
   `is_live: true` → otherwise **422**.
3. **Cooldown** — at least 20 seconds between accepted cycles per user → otherwise
   **429** with `Retry-After: 20`. Rejected attempts do not reset the timer.
4. **Replay detection** — each submission is fingerprinted (SHA-256 of action + both
   snapshots); replays within the last 3 submissions per user are rejected → **422**.
5. **State must change** — before/after snapshots that are identical (ignoring
   `timestamp`/`is_live`/`mode_label`) are rejected → **422**.

Credits: reductions ≥ 3% earn the reward formula (base 10 + % reduction + CO2 bonus +
streak bonus); sub-threshold cycles earn 5 participation credits. Both paths respect the
cooldown and replay rules.

Errors: **422** (whitelist/identical/duplicate/non-live), **429** (cooldown), **503**
(power model unavailable).

---

### `GET /api/credits/state?user_id=default_user`
**200** `GreenCreditState`:
```json
{
  "user_id": "default_user",
  "credit_balance": 125,
  "lifetime_reduction_g_co2": 12.3,
  "lifetime_energy_saved_kwh": 0.0319,
  "total_optimizations": 3,
  "current_streak_days": 2,
  "rank_title": "Eco Explorer",
  "recent_transactions": []
}
```
`current_streak_days` = consecutive UTC days with at least one completed optimization
cycle (same-day cycles do not extend it; a full-day gap resets it).

---

### `GET /api/badges/list?user_id=default_user`
**200** `Badge[]` (5 badges, catalog order). Per-user fields:
```json
{
  "id": "badge_first_opt",
  "name": "🌱 First Optimization",
  "description": "...",
  "icon": "Leaf",
  "rarity": "Common",
  "credit_price": 0,
  "unlock_criteria": "Complete 1 verified optimization",
  "is_unlocked": true,
  "token_id": 1,
  "minted_on_chain": false,
  "tx_hash": null
}
```
`is_unlocked` reflects the **requested user's** state only. `minted_on_chain`/`tx_hash`
reflect mints recorded for that user.

---

### `GET /api/marketplace/catalog?user_id=default_user`
**200**: `{ "currency": "Green Credits", "user_balance": 125, "items": [Badge...] }`

### `POST /api/marketplace/purchase`
Request `MarketplacePurchaseRequest`: `{ "badge_id": "badge_power_saver", "user_id": "default_user" }`

**200** `MarketplacePurchaseResponse`:
```json
{ "success": true, "message": "Successfully unlocked ⚡ Power Saver!", "badge": {...}, "new_balance": 100 }
```
Errors: **400** with `detail` = "Badge '...' not found." | "You already own this badge."
| "Insufficient Green Credits. Needed: X, Current Balance: Y".

---

### `GET /api/blockchain/metadata`
Network config, contract ABI, chain id (11155111), explorer URL.

### `POST /api/blockchain/verify-mint`
Request `BlockchainVerifyRequest`:
```json
{
  "badge_id": "badge_first_opt",
  "tx_hash": "0x...64 hex chars...",
  "token_id": 1,
  "user_wallet": "0x...40 hex chars...",
  "user_id": "default_user"
}
```
(`user_id` is optional and defaults to `default_user`; the frontend currently omits it —
identity is the wallet.)

**200** `MintVerificationResponse`:
```json
{
  "verified": true,
  "tx_hash": "0x...",
  "token_id": 1,
  "badge_id": "badge_first_opt",
  "user_wallet": "0x...",
  "explorer_url": "https://sepolia.etherscan.io/tx/0x...",
  "message": "Badge ownership verified and permanently associated with wallet."
}
```

Server-side verification is **fail closed** — a mint is recorded only when ALL hold:
1. `user_wallet` is a valid 40-hex address and `tx_hash` is a valid 64-hex hash (else **400**).
2. The badge exists, its `token_id` matches, and it is **unlocked for the user** (else **400**).
3. The badge has **not already been minted to this wallet** (else **400**).
4. On-chain receipt evidence (via configured `SEPOLIA_RPC_URL`, with public fallbacks):
   receipt status `0x1`, transaction `from` = wallet and `to` = contract, a strict
   ERC-1155 `TransferSingle` log with the exact token id/value=1 to the wallet, and
   `balanceOf(wallet, tokenId) >= 1` at the mint block (else **503**, nothing recorded).

Environment: `SEPOLIA_RPC_URL` (or `NEXT_PUBLIC_RPC_URL`) and `CONTRACT_ADDRESS`
(or `NEXT_PUBLIC_CONTRACT_ADDRESS`) must be configured. Without a configured RPC the
endpoint fails closed with **503** rather than guessing.

---

## Environment Variables (`.env.example`)

- `NEXT_PUBLIC_API_URL` — backend base URL used by the frontend.
- `NEXT_PUBLIC_LOCAL_AGENT_URL` / `LOCAL_AGENT_URL` — local Windows agent base URL.
- `SEPOLIA_RPC_URL`, `CONTRACT_ADDRESS` — required for `/api/blockchain/verify-mint`.
- `CORS_ORIGINS` — comma-separated list for the backend CORS policy
  (defaults to localhost:3000 + greenledger.vercel.app; never `*` with credentials).
- `VERCEL_FRONTEND_URL` — deployed frontend origin added to the backend CORS policy.
- `ENVIRONMENT` — reported by `/health`.
- `CARBON_INTENSITY_KG_PER_KWH` — default grid factor (0.385 US eGRID average; also the
  in-code default used by `services/carbon/calculator.py`).

## Out of Scope for This Contract

- Local Windows agent endpoints (`agent/api.py`): `/health`, `/telemetry`,
  `/optimization/recommendations`, `/optimization/execute` — owned by the agent team.
- Client-side wallet/minting flow (`frontend/lib/web3.ts`) and the Solidity contract.