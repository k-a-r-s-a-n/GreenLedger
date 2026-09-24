# Deployment Guide — Vercel, Local Agent & Smart Contract

## 1. Vercel Deployment (Frontend Web Application)
`vercel.json` deploys **only the Next.js frontend**. The FastAPI backend and the Windows agent run on loopback (`127.0.0.1`) by default, so a bare Vercel deployment with default URLs shows the **offline** state — `127.0.0.1` in a visitor's browser is *their own* machine, not yours. Two supported setups:

**A. Full local judging (recommended for hacks):** run everything on one Windows machine via `start-dev.ps1` and open `http://localhost:3000`. No Vercel needed.

**B. Vercel frontend + hosted backend:** host the FastAPI backend on a public service (Railway / Render / Fly.io, `uvicorn main:app --host 0.0.0.0 --port $PORT` from `backend/`), then:
1. Connect your GitHub repository to Vercel.
2. Ensure Root Directory is set to project root with `vercel.json` or `frontend/`.
3. Set Environment Variables:
   - `NEXT_PUBLIC_API_URL=https://your-fastapi-backend.com` (required — the dashboard, ML, carbon, credits, and demo telemetry all flow through this)
   - `VERCEL_FRONTEND_URL=https://your-deployed-app.vercel.app` (set on the backend so CORS allows it)
   - `NEXT_PUBLIC_CHAIN_ID=11155111`
   - `NEXT_PUBLIC_CONTRACT_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS`
4. Deploy! Visitors without the local agent get labelled **Demo Mode** telemetry from the hosted backend. Optimization execution always requires the live Windows agent on the visitor's own machine, so the Optimize flow is intentionally disabled for remote visitors.

---

## 2. Running FastAPI Backend
```powershell
pip install -r backend/requirements.txt
python backend/main.py
```
Backend runs on `http://127.0.0.1:8000`.

---

## 3. Running Windows Telemetry Agent
```powershell
pip install -r agent/requirements.txt
python agent/api.py
```
Agent listens on `http://127.0.0.1:8765`.

---

## 4. Smart Contract Deployment (Ethereum Sepolia)
```bash
cd contracts
npm install
npx hardhat test              # contract unit tests (no network needed)
npx hardhat run scripts/deploy.js --network sepolia
```
Requires `SEPOLIA_RPC_URL` and `DEPLOYER_PRIVATE_KEY` in the repo-root `.env` (see `.env.example`). After deployment, set `NEXT_PUBLIC_CONTRACT_ADDRESS` (frontend) and `CONTRACT_ADDRESS` (backend verifier) to the new address and redeploy.
