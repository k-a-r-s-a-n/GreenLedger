"""
GreenLedger - Blockchain & Sepolia Testnet Verifier Service
Provides ABI metadata, network constants, and transaction verification logic.

Verification posture (fail closed): a mint is only recorded when ALL checks pass —
mined receipt (status 0x1), transaction sender/recipient match, a strict ERC-1155
TransferSingle log with the exact token id/value minted to the wallet, and an
on-chain balanceOf >= 1 at the mint block. Any unverifiable step returns False.
"""

import re
import json
import os
import time
from urllib.request import Request, urlopen
from typing import Dict, Any, List, Optional

SEPOLIA_CHAIN_ID = 11155111
SEPOLIA_EXPLORER_BASE = "https://sepolia.etherscan.io"

# Public Sepolia RPC endpoints used as fallbacks when no SEPOLIA_RPC_URL is configured.
PUBLIC_SEPOLIA_RPCS = [
    "https://ethereum-sepolia-rpc.publicnode.com",
    "https://rpc.sepolia.org",
    "https://sepolia.drpc.org",
    "https://1rpc.io/sepolia",
    "https://rpc2.sepolia.org"
]

# balanceOf(address,uint256) selector
_BALANCE_OF_SELECTOR = "0x00fdd58e"


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


def _rpc_endpoints() -> List[str]:
    """
    Configured RPC first, then public fallbacks (deduplicated).
    Fail closed: without an explicitly configured RPC URL no verification is attempted.
    """
    configured = os.getenv("SEPOLIA_RPC_URL") or os.getenv("NEXT_PUBLIC_RPC_URL")
    if not configured or not configured.startswith("http"):
        return []
    endpoints = [configured]
    for pub in PUBLIC_SEPOLIA_RPCS:
        if pub not in endpoints:
            endpoints.append(pub)
    return endpoints


def _call_rpc(rpc_url: str, method: str, params: list, timeout: int = 6) -> Optional[Dict[str, Any]]:
    """Single JSON-RPC call; returns None on any transport/JSON-RPC error."""
    try:
        payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
        request = Request(rpc_url, data=payload, headers={
            "Content-Type": "application/json",
            "User-Agent": "GreenLedger/1.0"
        })
        with urlopen(request, timeout=timeout) as response:
            result = json.load(response)
        if result.get("error") or "result" not in result:
            return None
        return result["result"]
    except Exception:
        return None


def _query_any_rpc(method: str, params: list, endpoints: List[str]) -> Optional[Dict[str, Any]]:
    for url in endpoints:
        res = _call_rpc(url, method, params)
        if res is not None:
            return res
    return None


def verify_on_chain_mint(tx_hash: str, token_id: int, user_wallet: str) -> bool:
    """
    Verify a mined transaction and its ERC-1155 TransferSingle evidence via JSON-RPC.
    Fail-closed: every required check must pass, otherwise the mint is NOT verified.
    """
    contract_address = os.getenv("CONTRACT_ADDRESS") or os.getenv("NEXT_PUBLIC_CONTRACT_ADDRESS")
    if not contract_address or not verify_ethereum_address(contract_address):
        return False

    endpoints = _rpc_endpoints()
    if not endpoints:
        return False

    # Step 1: Fetch receipt (with retry for Sepolia block propagation lag).
    receipt = None
    transaction = None
    for attempt in range(3):
        receipt = _query_any_rpc("eth_getTransactionReceipt", [tx_hash], endpoints)
        if receipt and receipt.get("status") == "0x1":
            transaction = _query_any_rpc("eth_getTransactionByHash", [tx_hash], endpoints)
            break
        if attempt < 2:
            time.sleep(1.0)

    if not receipt or receipt.get("status") != "0x1" or not transaction:
        return False

    # Step 2: The mint call must originate from the claimed wallet and target the contract.
    if str(transaction.get("from", "")).lower() != user_wallet.lower():
        return False
    if str(transaction.get("to", "")).lower() != contract_address.lower():
        return False

    # Step 3: Strict TransferSingle evidence for the mint.
    # GreenBadge.mint emits TransferSingle(operator, from=0x0, to=account, id, value=1).
    # Topics: [signature, operator, from, to]; data: [id (32B), value (32B)].
    contract_lower = contract_address.lower()
    wallet_topic = "0x" + ("0" * 24) + user_wallet[2:].lower()
    # keccak256("TransferSingle(address,address,address,uint256,uint256)")
    transfer_single_sig = "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62"
    zero_topic = "0x" + "0" * 64

    mint_log_found = False
    for log in receipt.get("logs", []):
        if str(log.get("address", "")).lower() != contract_lower:
            continue
        topics = [str(t).lower() for t in log.get("topics", [])]
        data = log.get("data", "0x")
        if len(topics) != 4 or len(data) < 130:
            continue
        try:
            id_hex = data[2:66]
            value_hex = data[66:130]
            # Strict mint evidence: TransferSingle event, from == 0x0 (a mint, not
            # a transfer), to == wallet, exact token id, value == 1. Without the
            # signature + zero-from checks, a self-transfer could pose as a mint.
            if (topics[0] == transfer_single_sig
                    and topics[2] == zero_topic
                    and topics[3] == wallet_topic
                    and int(id_hex, 16) == token_id
                    and int(value_hex, 16) == 1):
                mint_log_found = True
                break
        except (ValueError, IndexError):
            continue

    if not mint_log_found:
        return False

    # Step 4: Authoritative ownership check — balanceOf(wallet, tokenId) >= 1 at the
    # mint block. Fail closed if no endpoint can answer.
    block_number = receipt.get("blockNumber") or "latest"
    call_data = _BALANCE_OF_SELECTOR + user_wallet[2:].lower().zfill(64) + hex(token_id)[2:].zfill(64)
    call_result = _query_any_rpc("eth_call", [{"to": contract_address, "data": call_data}, block_number], endpoints)
    if call_result is None:
        return False
    try:
        return int(call_result, 16) >= 1
    except (ValueError, TypeError):
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