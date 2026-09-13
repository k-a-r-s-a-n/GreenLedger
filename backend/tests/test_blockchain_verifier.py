"""
GreenLedger - Blockchain Verifier Regression Tests
Unit: strict TransferSingle receipt parsing, sender/recipient checks, balanceOf cross-check.
Integration: /api/blockchain/verify-mint error mapping (400/503) without network.
"""

import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from main import app
from services.blockchain import verifier
from services.credits.rewards import credit_service

client = TestClient(app)

WALLET = "0x1111111111111111111111111111111111111111"
CONTRACT = "0x2222222222222222222222222222222222222222"
OPERATOR = "0x3333333333333333333333333333333333333333"
# keccak256("TransferSingle(address,address,address,uint256,uint256)")
TRANSFER_SINGLE_SIG = "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62"
ZERO_TOPIC = "0x" + "0" * 64


def _log(to: str = WALLET, token_id: int = 3, value: int = 1, address: str = CONTRACT):
    return {
        "address": address.lower(),
        "topics": [
            TRANSFER_SINGLE_SIG,
            "0x" + ("0" * 24) + OPERATOR[2:],
            ZERO_TOPIC,
            "0x" + ("0" * 24) + to[2:],
        ],
        "data": "0x" + hex(token_id)[2:].zfill(64) + hex(value)[2:].zfill(64),
    }


def _receipt(logs=None, status="0x1", block="0x123456"):
    return {"status": status, "blockNumber": block, "logs": logs or []}


def _transaction(_from: str = WALLET, _to: str = CONTRACT):
    return {"from": _from, "to": _to}


@pytest.fixture()
def rpc_env(monkeypatch):
    monkeypatch.setenv("SEPOLIA_RPC_URL", "https://rpc.invalid.example")
    monkeypatch.setenv("CONTRACT_ADDRESS", CONTRACT)


@pytest.fixture()
def fake_rpc(monkeypatch):
    """Patches the RPC transport so no network is touched; the fake returns canned data."""
    def _install(receipt=None, transaction=None, balance=None):
        def fake(method, params, endpoints):
            if method == "eth_getTransactionReceipt":
                return receipt
            if method == "eth_getTransactionByHash":
                return transaction
            if method == "eth_call":
                return balance
            return None
        monkeypatch.setattr(verifier, "_query_any_rpc", fake)
    return _install


def test_address_and_tx_hash_format_validation():
    assert verifier.verify_ethereum_address("0x" + "ab" * 20) is True
    assert verifier.verify_ethereum_address("0xabc") is False
    assert verifier.verify_ethereum_address("abc") is False
    assert verifier.verify_tx_hash("0x" + "ab" * 32) is True
    assert verifier.verify_tx_hash("0x" + "ab" * 31) is False


def test_verify_accepts_genuine_mint(rpc_env, fake_rpc):
    fake_rpc(receipt=_receipt([_log()]), transaction=_transaction(), balance="0x1")
    assert verifier.verify_on_chain_mint("0x" + "ab" * 32, 3, WALLET) is True


def test_verify_rejects_reverted_receipt(rpc_env, fake_rpc):
    fake_rpc(receipt=_receipt([_log()], status="0x0"), transaction=_transaction(), balance="0x1")
    assert verifier.verify_on_chain_mint("0x" + "ab" * 32, 3, WALLET) is False


def test_verify_rejects_wrong_sender(rpc_env, fake_rpc):
    other = "0x4444444444444444444444444444444444444444"
    fake_rpc(receipt=_receipt([_log()]), transaction=_transaction(_from=other), balance="0x1")
    assert verifier.verify_on_chain_mint("0x" + "ab" * 32, 3, WALLET) is False


def test_verify_rejects_transaction_not_to_contract(rpc_env, fake_rpc):
    fake_rpc(receipt=_receipt([_log()]), transaction=_transaction(_to=WALLET), balance="0x1")
    assert verifier.verify_on_chain_mint("0x" + "ab" * 32, 3, WALLET) is False


def test_verify_rejects_log_minted_to_other_wallet(rpc_env, fake_rpc):
    other = "0x4444444444444444444444444444444444444444"
    fake_rpc(receipt=_receipt([_log(to=other)]), transaction=_transaction(), balance="0x1")
    assert verifier.verify_on_chain_mint("0x" + "ab" * 32, 3, WALLET) is False


def test_verify_rejects_wrong_token_id(rpc_env, fake_rpc):
    fake_rpc(receipt=_receipt([_log(token_id=4)]), transaction=_transaction(), balance="0x1")
    assert verifier.verify_on_chain_mint("0x" + "ab" * 32, 3, WALLET) is False


def test_verify_rejects_multi_amount_transfer(rpc_env, fake_rpc):
    fake_rpc(receipt=_receipt([_log(value=2)]), transaction=_transaction(), balance="0x2")
    assert verifier.verify_on_chain_mint("0x" + "ab" * 32, 3, WALLET) is False


def test_verify_rejects_zero_balance(rpc_env, fake_rpc):
    fake_rpc(receipt=_receipt([_log()]), transaction=_transaction(), balance="0x0")
    assert verifier.verify_on_chain_mint("0x" + "ab" * 32, 3, WALLET) is False


def test_verify_fails_closed_when_balance_unavailable(rpc_env, fake_rpc):
    fake_rpc(receipt=_receipt([_log()]), transaction=_transaction(), balance=None)
    assert verifier.verify_on_chain_mint("0x" + "ab" * 32, 3, WALLET) is False


def test_verify_fails_closed_when_no_rpc_configured(monkeypatch):
    monkeypatch.delenv("SEPOLIA_RPC_URL", raising=False)
    monkeypatch.delenv("NEXT_PUBLIC_RPC_URL", raising=False)
    monkeypatch.setenv("CONTRACT_ADDRESS", CONTRACT)
    assert verifier.verify_on_chain_mint("0x" + "ab" * 32, 3, WALLET) is False


def _verify_mint_payload(badge_id="badge_first_opt", tx_hash=None, token_id=1, user_wallet=None):
    return {
        "badge_id": badge_id,
        "tx_hash": tx_hash or "0x" + "cd" * 32,
        "token_id": token_id,
        "user_wallet": user_wallet or WALLET
    }


def test_verify_mint_rejects_bad_address():
    res = client.post("/api/blockchain/verify-mint", json=_verify_mint_payload(user_wallet="0xnotanaddress"))
    assert res.status_code == 400
    assert "wallet" in res.json()["detail"]


def test_verify_mint_rejects_bad_tx_hash():
    res = client.post("/api/blockchain/verify-mint", json=_verify_mint_payload(tx_hash="0xshort"))
    assert res.status_code == 400
    assert "transaction hash" in res.json()["detail"]


def test_verify_mint_rejects_unknown_badge():
    res = client.post("/api/blockchain/verify-mint", json=_verify_mint_payload(badge_id="badge_does_not_exist"))
    assert res.status_code == 400
    assert "unknown" in res.json()["detail"]


def test_verify_mint_rejects_token_id_mismatch():
    res = client.post("/api/blockchain/verify-mint", json=_verify_mint_payload(badge_id="badge_first_opt", token_id=2))
    assert res.status_code == 400
    assert "token" in res.json()["detail"]


def test_verify_mint_rejects_locked_badge():
    # badge_green_guardian is not unlocked for default_user
    res = client.post("/api/blockchain/verify-mint", json=_verify_mint_payload(badge_id="badge_green_guardian", token_id=5))
    assert res.status_code == 400
    assert "not unlocked" in res.json()["detail"]


def test_verify_mint_rejects_already_minted_to_wallet():
    credit_service.record_on_chain_mint("badge_first_opt", "0x" + "ab" * 32, "default_user", WALLET)
    res = client.post("/api/blockchain/verify-mint", json=_verify_mint_payload())
    assert res.status_code == 400
    assert "already been minted" in res.json()["detail"]


def test_verify_mint_fails_closed_when_onchain_unverifiable(monkeypatch):
    # Distinct wallet so the shared in-memory mint ledger cannot short-circuit this test.
    fresh_wallet = "0x5555555555555555555555555555555555555555"

    def fake(method, params, endpoints):
        return None
    monkeypatch.setattr(verifier, "_query_any_rpc", fake)
    res = client.post("/api/blockchain/verify-mint", json=_verify_mint_payload(user_wallet=fresh_wallet))
    assert res.status_code == 503
    assert "could not be verified" in res.json()["detail"]