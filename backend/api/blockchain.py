"""
GreenLedger - Blockchain & Sepolia Testnet API Router
"""

from fastapi import APIRouter, HTTPException
from schemas.models import BlockchainVerifyRequest, MintVerificationResponse
from services.blockchain.verifier import (
    get_blockchain_metadata,
    verify_ethereum_address,
    verify_tx_hash,
    verify_on_chain_mint,
    SEPOLIA_EXPLORER_BASE
)
from services.credits.rewards import credit_service

router = APIRouter(prefix="/api/blockchain", tags=["Blockchain & Web3"])


@router.get("/metadata")
def get_metadata():
    """Returns network settings, contract ABI, and testnet instructions."""
    return get_blockchain_metadata()


@router.post("/verify-mint", response_model=MintVerificationResponse)
def verify_mint_transaction(req: BlockchainVerifyRequest):
    """
    Validates formatting, ownership, and Sepolia receipt evidence before recording a mint.
    The badge must be unlocked for the user and not already minted to the wallet.

    Errors:
    - 400: invalid address/tx format, unknown/locked badge, token ID mismatch, already minted
    - 503: on-chain receipt could not be verified (fail closed)
    """
    if not verify_ethereum_address(req.user_wallet):
        raise HTTPException(status_code=400, detail="Invalid Ethereum wallet address format.")

    if not verify_tx_hash(req.tx_hash):
        raise HTTPException(status_code=400, detail="Invalid transaction hash format. Must be 64 hex characters preceded by 0x.")

    badge = credit_service.get_badge(req.badge_id)
    if badge is None:
        raise HTTPException(status_code=400, detail=f"Badge '{req.badge_id}' is unknown.")
    if badge.token_id != req.token_id:
        raise HTTPException(status_code=400, detail="Badge does not match the provided token ID.")
    if not credit_service.is_badge_unlocked(req.badge_id, req.user_id):
        raise HTTPException(status_code=400, detail="Badge is not unlocked for this user.")
    if credit_service.is_badge_minted_for_wallet(req.user_wallet, req.badge_id):
        raise HTTPException(status_code=400, detail="Badge has already been minted to this wallet.")

    if not verify_on_chain_mint(req.tx_hash, req.token_id, req.user_wallet):
        raise HTTPException(status_code=503, detail="Sepolia receipt could not be verified; mint remains unrecorded.")

    credit_service.record_on_chain_mint(req.badge_id, req.tx_hash, req.user_id, req.user_wallet)

    return MintVerificationResponse(
        verified=True,
        tx_hash=req.tx_hash,
        token_id=req.token_id,
        badge_id=req.badge_id,
        user_wallet=req.user_wallet,
        explorer_url=f"{SEPOLIA_EXPLORER_BASE}/tx/{req.tx_hash}",
        message="Badge ownership verified and permanently associated with wallet."
    )