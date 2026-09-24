"""
GreenLedger - Green Credits & Achievement Reward Service
Calculates verified optimization rewards, tracks user balances, streaks, and manages achievement badges.

Storage choice (explicit): this service keeps ALL state in-process (module-level singleton,
plain dicts keyed by user_id). The repository has no database wired up, so there is no
durable persistence — state resets when the backend process restarts. If a database is
added later, this module is the single seam to swap (the API layer only talks to
credit_service / get_user_state / get_all_badges).

Multi-user state model: badges are immutable catalog templates; unlock/mint state lives
per-user ("unlocked_badges" set, "minted_badges" dict) plus a wallet-keyed mint ledger so
an on-chain badge is permanently associated with the wallet that minted it.
"""

import time
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from schemas.models import GreenCreditState, Badge
from services.carbon.calculator import DEFAULT_CARBON_INTENSITY

INITIAL_BADGES = [
    Badge(
        id="badge_first_opt",
        name="🌱 First Optimization",
        description="Awarded for taking your first step towards reducing compute energy consumption.",
        icon="Leaf",
        rarity="Common",
        credit_price=0,
        unlock_criteria="Complete 1 verified optimization",
        is_unlocked=False,
        token_id=1,
        minted_on_chain=False
    ),
    Badge(
        id="badge_power_saver",
        name="⚡ Power Saver",
        description="Awarded for consistently curbing system wattage across multiple sessions.",
        icon="Zap",
        rarity="Rare",
        credit_price=250,
        unlock_criteria="Achieve >15% estimated power reduction",
        is_unlocked=False,
        token_id=2,
        minted_on_chain=False
    ),
    Badge(
        id="badge_carbon_cutter",
        name="🌎 Carbon Cutter",
        description="Awarded for cumulative prevented carbon emissions of over 50 grams CO2e.",
        icon="Globe",
        rarity="Rare",
        credit_price=500,
        unlock_criteria="Prevent 50g+ CO2e emissions",
        is_unlocked=False,
        token_id=3,
        minted_on_chain=False
    ),
    Badge(
        id="badge_efficiency_master",
        name="🔥 Efficiency Master",
        description="Demonstrates top-tier system management and sustained daily efficiency streaks.",
        icon="Flame",
        rarity="Epic",
        credit_price=1000,
        unlock_criteria="Maintain a 3-day optimization streak",
        is_unlocked=False,
        token_id=4,
        minted_on_chain=False
    ),
    Badge(
        id="badge_green_guardian",
        name="🏆 Green Guardian",
        description="The ultimate eco-computing credential on Ethereum Sepolia.",
        icon="Trophy",
        rarity="Legendary",
        credit_price=2500,
        unlock_criteria="Reach 1,500 Green Credits or 10+ optimizations",
        is_unlocked=False,
        token_id=5,
        minted_on_chain=False
    )
]

# New users start with a small welcome balance so the marketplace demo is usable.
WELCOME_CREDIT_BALANCE = 100


def _user_defaults() -> Dict[str, Any]:
    return {
        "credit_balance": WELCOME_CREDIT_BALANCE,
        "lifetime_reduction_g_co2": 0.0,
        "lifetime_energy_saved_kwh": 0.0,
        "total_optimizations": 0,
        "current_streak_days": 0,
        "last_optimization_date": None,
        "rank_title": "Eco Explorer",
        "unlocked_badges": set(),
        "minted_badges": {},  # badge_id -> tx_hash (server-side mint record)
        "transactions": []
    }


class GreenCreditService:
    def __init__(self):
        # In-memory mock store for session state (see module docstring for storage note)
        default_user = _user_defaults()
        # Preserve legacy behavior: the seeded demo user starts with a zero balance
        # and the First Optimization badge already unlocked.
        default_user["credit_balance"] = 0
        default_user["unlocked_badges"].add("badge_first_opt")
        self._user_states: Dict[str, Dict[str, Any]] = {"default_user": default_user}

        # Immutable catalog templates — per-user unlock state is NEVER written here.
        self._badges: Dict[str, Badge] = {b.id: b for b in INITIAL_BADGES}

        # Wallet-keyed mint ledger: wallet_address_lower -> {badge_id: tx_hash}
        self._wallet_mints: Dict[str, Dict[str, str]] = {}

    def _ensure_user(self, user_id: str) -> Dict[str, Any]:
        """Returns (and lazily creates) the user state dict with all keys populated."""
        if user_id not in self._user_states:
            self._user_states[user_id] = _user_defaults()
        u = self._user_states[user_id]
        for key, default in _user_defaults().items():
            if key == "credit_balance":
                u.setdefault(key, WELCOME_CREDIT_BALANCE)
            else:
                u.setdefault(key, default)
        u.setdefault("unlocked_badges", set())
        u.setdefault("minted_badges", {})
        u.setdefault("transactions", [])
        return u

    def get_user_state(self, user_id: str = "default_user") -> GreenCreditState:
        u = self._ensure_user(user_id)
        return GreenCreditState(
            user_id=user_id,
            credit_balance=u["credit_balance"],
            lifetime_reduction_g_co2=round(u["lifetime_reduction_g_co2"], 2),
            lifetime_energy_saved_kwh=round(u["lifetime_energy_saved_kwh"], 4),
            total_optimizations=u["total_optimizations"],
            current_streak_days=u["current_streak_days"],
            rank_title=u["rank_title"],
            recent_transactions=u["transactions"][-10:]
        )

    def _update_streak(self, user_id: str) -> None:
        """
        Streak = number of consecutive UTC days with at least one completed optimization
        cycle. Same-day cycles do not extend the streak; a gap of a full day resets it.
        """
        u = self._ensure_user(user_id)
        today = datetime.now(timezone.utc).date()
        last = u.get("last_optimization_date")
        if last is None:
            u["current_streak_days"] = 1
        elif last == today.isoformat():
            pass
        else:
            try:
                last_date = datetime.strptime(last, "%Y-%m-%d").date()
                if (today - last_date).days == 1:
                    u["current_streak_days"] += 1
                else:
                    u["current_streak_days"] = 1
            except ValueError:
                u["current_streak_days"] = 1
        u["last_optimization_date"] = today.isoformat()

    def calculate_optimization_reward(
        self,
        action_id: str,
        reduction_pct: float,
        co2_saved_g: float,
        user_id: str = "default_user"
    ) -> int:
        """
        Transparent reward formula:
        - Base action reward: +10 credits
        - Proportional reward: +1 credit per 1% estimated power reduction
        - Carbon impact multiplier: +1 credit per 2 grams of CO2 saved
        - Streak multiplier: +5 bonus credits
        """
        base = 10
        prop = int(reduction_pct)
        co2_bonus = int(co2_saved_g / 2.0)
        streak_bonus = 5

        total_reward = base + prop + co2_bonus + streak_bonus

        u = self._ensure_user(user_id)
        self._update_streak(user_id)

        u["credit_balance"] += total_reward
        u["lifetime_reduction_g_co2"] += co2_saved_g
        # Verified savings are computed with the default grid factor, so the
        # inverse conversion uses the same named constant (g/kWh).
        u["lifetime_energy_saved_kwh"] += co2_saved_g / (DEFAULT_CARBON_INTENSITY * 1000.0)
        u["total_optimizations"] += 1

        # Rank progression
        if u["credit_balance"] > 1500:
            u["rank_title"] = "Green Guardian"
        elif u["credit_balance"] > 600:
            u["rank_title"] = "Carbon Cutter"
        else:
            u["rank_title"] = "Eco Explorer"

        unlocked_badge = self._check_and_unlock_badges(user_id, reduction_pct)

        u["transactions"].append({
            "tx_id": f"tx_{int(time.time())}_{u['total_optimizations']}",
            "type": "optimization_reward",
            "credits": total_reward,
            "description": f"Verified Optimization ({action_id}): -{reduction_pct:.1f}% Power",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "unlocked_badge": unlocked_badge
        })

        return total_reward

    def award_participation(self, user_id: str = "default_user") -> int:
        """
        Awards nominal participation points for completing an action even with modest delta.
        Anti-farming: participation does NOT extend the streak or count as an
        optimization — only verified (>=3%) reductions do. Otherwise sub-threshold
        cycles could be spammed every cooldown window to farm streaks/badges.
        """
        award = 5
        u = self._ensure_user(user_id)

        u["credit_balance"] += award

        u["transactions"].append({
            "tx_id": f"tx_p_{int(time.time() * 1000)}",
            "type": "participation",
            "credits": award,
            "description": "Optimization cycle completed (below verified reduction threshold)",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "unlocked_badge": None
        })
        return award

    def _check_and_unlock_badges(self, user_id: str, last_reduction_pct: float) -> Optional[str]:
        u = self._ensure_user(user_id)
        unlocked_badges = u.setdefault("unlocked_badges", set())

        # First Optimization
        if u["total_optimizations"] >= 1 and "badge_first_opt" not in unlocked_badges:
            unlocked_badges.add("badge_first_opt")
            return "🌱 First Optimization"

        # Power Saver
        if last_reduction_pct >= 15.0 and "badge_power_saver" not in unlocked_badges:
            unlocked_badges.add("badge_power_saver")
            return "⚡ Power Saver"

        # Carbon Cutter
        if u["lifetime_reduction_g_co2"] >= 50.0 and "badge_carbon_cutter" not in unlocked_badges:
            unlocked_badges.add("badge_carbon_cutter")
            return "🌎 Carbon Cutter"

        # Efficiency Master (3-day optimization streak)
        if u["current_streak_days"] >= 3 and "badge_efficiency_master" not in unlocked_badges:
            unlocked_badges.add("badge_efficiency_master")
            return "🔥 Efficiency Master"

        # Green Guardian
        if u["credit_balance"] >= 1500 and "badge_green_guardian" not in unlocked_badges:
            unlocked_badges.add("badge_green_guardian")
            return "🏆 Green Guardian"

        return None

    def get_all_badges(self, user_id: str = "default_user") -> List[Badge]:
        """Per-user view of the badge catalog; unlock/mint state comes from user state only."""
        u = self._user_states.get(user_id)
        user_unlocked = u.get("unlocked_badges", set()) if u else set()
        minted = u.get("minted_badges", {}) if u else {}

        badge_list = []
        for b_id, template in self._badges.items():
            copy_b = template.model_copy()
            copy_b.is_unlocked = b_id in user_unlocked
            if b_id in minted:
                copy_b.minted_on_chain = True
                copy_b.tx_hash = minted[b_id]
            badge_list.append(copy_b)
        return badge_list

    def get_badge(self, badge_id: str) -> Optional[Badge]:
        """Returns the immutable catalog template for a badge id, if it exists."""
        return self._badges.get(badge_id)

    def is_badge_unlocked(self, badge_id: str, user_id: str = "default_user") -> bool:
        u = self._user_states.get(user_id)
        return bool(u and badge_id in u.get("unlocked_badges", set()))

    def is_badge_minted_for_wallet(self, wallet: str, badge_id: str) -> bool:
        return badge_id in self._wallet_mints.get(wallet.lower(), {})

    def purchase_badge(self, badge_id: str, user_id: str = "default_user") -> Dict[str, Any]:
        """Validates credit balance and purchases badge from marketplace."""
        badge = self._badges.get(badge_id)
        if badge is None:
            return {"success": False, "error": f"Badge '{badge_id}' not found."}

        u = self._ensure_user(user_id)
        user_unlocked = u.setdefault("unlocked_badges", set())

        if badge_id in user_unlocked:
            return {"success": False, "error": "You already own this badge."}

        if u["credit_balance"] < badge.credit_price:
            return {
                "success": False,
                "error": f"Insufficient Green Credits. Needed: {badge.credit_price}, Current Balance: {u['credit_balance']}"
            }

        # Deduct credits & unlock (user state only — catalog stays immutable)
        u["credit_balance"] -= badge.credit_price
        user_unlocked.add(badge_id)

        u["transactions"].append({
            "tx_id": f"tx_buy_{int(time.time())}",
            "type": "marketplace_purchase",
            "credits": -badge.credit_price,
            "description": f"Unlocked Badge: {badge.name}",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        })

        # Return a per-user view of the badge so the response reflects the new state.
        purchased = badge.model_copy()
        purchased.is_unlocked = True

        return {
            "success": True,
            "message": f"Successfully unlocked {badge.name}!",
            "badge": purchased,
            "new_balance": u["credit_balance"]
        }

    def record_on_chain_mint(self, badge_id: str, tx_hash: str, user_id: str = "default_user", wallet: Optional[str] = None):
        """
        Records a verified Sepolia mint. State is keyed per user AND per wallet so a
        badge mint is permanently associated with the wallet that owns it.
        """
        u = self._ensure_user(user_id)
        u.setdefault("minted_badges", {})[badge_id] = tx_hash
        if wallet:
            self._wallet_mints.setdefault(wallet.lower(), {})[badge_id] = tx_hash


credit_service = GreenCreditService()