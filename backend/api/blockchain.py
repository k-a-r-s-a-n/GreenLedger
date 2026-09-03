"""
GreenLedger - Blockchain & Sepolia Testnet API Router
"""

from fastapi import APIRouter, HTTPException
from schemas.models import BlockchainVerifyRequest
from services.blockchain.verifier import (
    get_blockchain_metadata,
    verify_ethereum_address,
    verify_tx_hash,
    verify_on_chain_mint
)
from services.credits.rewards import credit_service

router = APIRouter(prefix="/api/blockchain", tags=["Blockchain & Web3"])


@router.get("/metadata")
def get_metadata():
    """Returns network settings, contract ABI, and testnet instructions."""
    return get_blockchain_metadata()


@router.post("/verify-mint")
def verify_mint_transaction(req: BlockchainVerifyRequest):
    """
    Validates formatting and records on-chain minting on Ethereum Sepolia testnet.
    Ensures that transaction hashes are genuine hex strings and validly attributed.
    """
    if not verify_ethereum_address(req.user_wallet):
        raise HTTPException(status_code=400, detail="Invalid Ethereum wallet address format.")
        
    if not verify_tx_hash(req.tx_hash):
        raise HTTPException(status_code=400, detail="Invalid transaction hash format. Must be 64 hex characters preceded by 0x.")

    badges = {badge.id: badge for badge in credit_service.get_all_badges()}
    badge = badges.get(req.badge_id)
    if badge is None or badge.token_id != req.token_id or not badge.is_unlocked:
        raise HTTPException(status_code=400, detail="Badge is unknown, locked, or does not match the token ID.")

    if not verify_on_chain_mint(req.tx_hash, req.token_id, req.user_wallet):
        raise HTTPException(status_code=503, detail="Sepolia receipt could not be verified; mint remains unrecorded.")
        
    credit_service.record_on_chain_mint(req.badge_id, req.tx_hash)
    
    return {
        "verified": True,
        "tx_hash": req.tx_hash,
        "token_id": req.token_id,
        "explorer_url": f"https://sepolia.etherscan.io/tx/{req.tx_hash}",
        "message": "Badge ownership verified and permanently associated with wallet."
    }
