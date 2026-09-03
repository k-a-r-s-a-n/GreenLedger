"""
GreenLedger - Blockchain & Sepolia Testnet Verifier Service
Provides ABI metadata, network constants, and transaction verification logic.
"""

import re
import json
import os
from urllib.request import Request, urlopen
from typing import Dict, Any

SEPOLIA_CHAIN_ID = 11155111
SEPOLIA_EXPLORER_BASE = "https://sepolia.etherscan.io"


def _load_root_env() -> None:
    """Load simple KEY=VALUE settings from the repository root when present."""
    env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"))
    if not os.path.exists(env_path):
        return
    try:
        with open(env_path, encoding="utf-8") as env_file:
            for line in env_file:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"'))
    except OSError:
        return


_load_root_env()

# GreenBadge ERC-1155 Minimal Interface ABI for Client-Side Minting
GREEN_BADGE_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "account", "type": "address"},
            {"internalType": "uint256", "name": "id", "type": "uint256"},
            {"internalType": "uint256", "name": "amount", "type": "uint256"},
            {"internalType": "bytes", "name": "data", "type": "bytes"}
        ],
        "name": "mint",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "account", "type": "address"},
            {"internalType": "uint256", "name": "id", "type": "uint256"}
        ],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "id", "type": "uint256"}],
        "name": "uri",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "address", "name": "operator", "type": "address"},
            {"indexed": True, "internalType": "address", "name": "from", "type": "address"},
            {"indexed": True, "internalType": "address", "name": "to", "type": "address"},
            {"indexed": False, "internalType": "uint256", "name": "id", "type": "uint256"},
            {"indexed": False, "internalType": "uint256", "name": "value", "type": "uint256"}
        ],
        "name": "TransferSingle",
        "type": "event"
    }
]


def verify_ethereum_address(address: str) -> bool:
    """Validates basic standard Ethereum hex address format."""
    return bool(re.match(r"^0x[a-fA-F0-9]{40}$", address))


def verify_tx_hash(tx_hash: str) -> bool:
    """Validates Ethereum transaction hash format."""
    return bool(re.match(r"^0x[a-fA-F0-9]{64}$", tx_hash))


def verify_on_chain_mint(tx_hash: str, token_id: int, user_wallet: str) -> bool:
    """Verify a mined transaction and its ERC-1155 TransferSingle evidence via JSON-RPC."""
    rpc_url = os.getenv("SEPOLIA_RPC_URL") or os.getenv("NEXT_PUBLIC_RPC_URL")
    contract_address = os.getenv("CONTRACT_ADDRESS") or os.getenv("NEXT_PUBLIC_CONTRACT_ADDRESS")
    if not rpc_url or not contract_address or not verify_ethereum_address(contract_address):
        return False

    def rpc(method: str, params: list) -> Dict[str, Any]:
        payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
        request = Request(rpc_url, data=payload, headers={"Content-Type": "application/json"})
        with urlopen(request, timeout=5) as response:
            result = json.load(response)
        if result.get("error") or "result" not in result:
            raise ValueError("Sepolia RPC request failed")
        return result["result"]

    try:
        receipt = rpc("eth_getTransactionReceipt", [tx_hash])
        transaction = rpc("eth_getTransactionByHash", [tx_hash])
        if not receipt or not transaction or receipt.get("status") != "0x1":
            return False
        if transaction.get("from", "").lower() != user_wallet.lower():
            return False
        if (transaction.get("to") or "").lower() != contract_address.lower():
            return False

        wallet_topic = "0x" + ("0" * 24) + user_wallet[2:].lower()
        for log in receipt.get("logs", []):
            topics = [topic.lower() for topic in log.get("topics", [])]
            data = log.get("data", "0x")[2:]
            if (
                log.get("address", "").lower() == contract_address.lower()
                and len(topics) == 4
                and topics[3] == wallet_topic
                and len(data) >= 128
                and int(data[:64], 16) == token_id
                and int(data[64:128], 16) == 1
            ):
                return True
        return False
    except (OSError, ValueError, TypeError, IndexError):
        return False


def get_blockchain_metadata() -> Dict[str, Any]:
    """Returns network config, contract ABI, and explorer links."""
    return {
        "network": "Ethereum Sepolia Testnet",
        "chain_id": SEPOLIA_CHAIN_ID,
        "token_standard": "ERC-1155 (Multi-Token Standard)",
        "explorer_url": SEPOLIA_EXPLORER_BASE,
        "contract_abi": GREEN_BADGE_ABI,
        "testnet_disclaimer": "Sepolia is an Ethereum testnet. Tokens and test ETH have no real-world monetary value."
    }
