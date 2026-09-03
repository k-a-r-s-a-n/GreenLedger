# GreenLedger — Web3 Smart Contracts (Ethereum Sepolia Testnet)

This directory contains the Solidity smart contracts powering the verifiable achievement badges and decentralized credentials for the GreenLedger platform.

## Architecture

- **Token Standard**: ERC-1155 (Multi-Token Standard).
- **Network**: Ethereum Sepolia Testnet (Chain ID: `11155111`).
- **Use Case**:
  - Telemetry and ML energy prediction stay strictly off-chain.
  - Smart contracts provide **verifiable, non-custodial proof of sustainability milestones** that users can showcase in Web3 wallets, ENS profiles, or decentralized identity aggregators.

---

## Token ID Catalog

| Token ID | Name | Rarity | Criteria |
|---|---|---|---|
| `1` | **🌱 First Optimization** | Common | Completed 1 verified system optimization |
| `2` | **⚡ Power Saver** | Rare | Reduced estimated device power by >15% |
| `3` | **🌎 Carbon Cutter** | Rare | Prevented 50g+ CO2e emissions |
| `4` | **🔥 Efficiency Master** | Epic | Maintained 3-day active optimization streak |
| `5` | **🏆 Green Guardian** | Legendary | Reached 1,500 Green Credits |

---

## Compilation & Deployment

### Prerequisites
- Node.js 18+
- Hardhat
- Sepolia RPC URL (e.g. Infura / Alchemy)
- Sepolia Testnet ETH (from Sepolia Faucet)

### Testing
```bash
npx hardhat test
```

### Deployment to Sepolia
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

After deployment, update `NEXT_PUBLIC_CONTRACT_ADDRESS` in `.env`.
