# Deployment Guide — Vercel, Local Agent & Smart Contract

## 1. Vercel Deployment (Frontend Web Application)
GreenLedger is optimized for zero-config Vercel deployment:
1. Connect your GitHub repository to Vercel.
2. Ensure Root Directory is set to project root with `vercel.json` or `frontend/`.
3. Set Environment Variables:
   - `NEXT_PUBLIC_LOCAL_AGENT_URL=http://127.0.0.1:8765`
   - `NEXT_PUBLIC_API_URL=https://your-fastapi-backend.com`
   - `NEXT_PUBLIC_CHAIN_ID=11155111`
   - `NEXT_PUBLIC_CONTRACT_ADDRESS=0x71C234Ea533F96507A5F44265E923C47131B64E6`
4. Deploy! If no local agent is running, Vercel visitors experience the complete platform via **Demo Mode**.

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
npx hardhat run contracts/scripts/deploy.js --network sepolia
```
