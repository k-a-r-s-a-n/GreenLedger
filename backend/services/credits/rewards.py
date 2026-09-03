"""
GreenLedger - Green Credits & Achievement Reward Service
Calculates verified optimization rewards, tracks user balances, streaks, and manages achievement badges.
"""

import time
from typing import Dict, Any, List, Optional
from schemas.models import GreenCreditState, Badge

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


class GreenCreditService:
    def __init__(self):
        # In-memory mock store for session state
        self._user_states: Dict[str, Dict[str, Any]] = {
            "default_user": {
                "credit_balance": 0,
                "lifetime_reduction_g_co2": 0.0,
                "lifetime_energy_saved_kwh": 0.0,
                "total_optimizations": 0,
                "current_streak_days": 0,
                "rank_title": "Eco Explorer",
                "unlocked_badges": set(),
                "transactions": []
            }
        }
        self._badges: Dict[str, Badge] = {b.id: b.model_copy() for b in INITIAL_BADGES}
        # Mark unlocked for default user
        self._badges["badge_first_opt"].is_unlocked = True

    def get_user_state(self, user_id: str = "default_user") -> GreenCreditState:
        if user_id not in self._user_states:
            self._user_states[user_id] = {
                "credit_balance": 100,
                "lifetime_reduction_g_co2": 0.0,
                "lifetime_energy_saved_kwh": 0.0,
                "total_optimizations": 0,
                "current_streak_days": 0,
                "rank_title": "Eco Explorer",
                "unlocked_badges": set(),
                "transactions": []
            }
        u = self._user_states[user_id]
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
        
        # Update user state
        u = self._user_states.setdefault(user_id, {
            "credit_balance": 0,
            "lifetime_reduction_g_co2": 0.0,
            "lifetime_energy_saved_kwh": 0.0,
            "total_optimizations": 0,
            "current_streak_days": 1,
            "rank_title": "Eco Explorer",
            "unlocked_badges": set(),
            "transactions": []
        })
        
        u["credit_balance"] += total_reward
        u["lifetime_reduction_g_co2"] += co2_saved_g
        u["lifetime_energy_saved_kwh"] += (co2_saved_g / 385.0)  # US grid factor
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
            "tx_id": f"tx_{int(time.time())}",
            "type": "optimization_reward",
            "credits": total_reward,
            "description": f"Verified Optimization ({action_id}): -{reduction_pct:.1f}% Power",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "unlocked_badge": unlocked_badge
        })
        
        return total_reward

    def award_participation(self, user_id: str = "default_user") -> int:
        """Awards nominal participation points for completing an action even with modest delta."""
        award = 5
        u = self._user_states.setdefault(user_id, {
            "credit_balance": 0, "lifetime_reduction_g_co2": 0.0, "lifetime_energy_saved_kwh": 0.0,
            "total_optimizations": 0, "current_streak_days": 1, "rank_title": "Eco Explorer",
            "unlocked_badges": set(), "transactions": []
        })
        u["credit_balance"] += award
        u["total_optimizations"] += 1
        return award

    def _check_and_unlock_badges(self, user_id: str, last_reduction_pct: float) -> Optional[str]:
        u = self._user_states[user_id]
        unlocked_badges = u.setdefault("unlocked_badges", set())
        
        # First Optimization
        if u["total_optimizations"] >= 1 and "badge_first_opt" not in unlocked_badges:
            unlocked_badges.add("badge_first_opt")
            self._badges["badge_first_opt"].is_unlocked = True
            return "🌱 First Optimization"
            
        # Power Saver
        if last_reduction_pct >= 15.0 and "badge_power_saver" not in unlocked_badges:
            unlocked_badges.add("badge_power_saver")
            self._badges["badge_power_saver"].is_unlocked = True
            return "⚡ Power Saver"
            
        # Carbon Cutter
        if u["lifetime_reduction_g_co2"] >= 50.0 and "badge_carbon_cutter" not in unlocked_badges:
            unlocked_badges.add("badge_carbon_cutter")
            self._badges["badge_carbon_cutter"].is_unlocked = True
            return "🌎 Carbon Cutter"
            
        # Green Guardian
        if u["credit_balance"] >= 1500 and "badge_green_guardian" not in unlocked_badges:
            unlocked_badges.add("badge_green_guardian")
            self._badges["badge_green_guardian"].is_unlocked = True
            return "🏆 Green Guardian"
            
        return None

    def get_all_badges(self, user_id: str = "default_user") -> List[Badge]:
        u = self._user_states.get(user_id, {})
        user_unlocked = u.get("unlocked_badges", set())
        
        badge_list = []
        for b_id, b in self._badges.items():
            copy_b = b.model_copy()
            if b_id in user_unlocked:
                copy_b.is_unlocked = True
            badge_list.append(copy_b)
        return badge_list

    def purchase_badge(self, badge_id: str, user_id: str = "default_user") -> Dict[str, Any]:
        """Validates credit balance and purchases badge from marketplace."""
        if badge_id not in self._badges:
            return {"success": False, "error": f"Badge '{badge_id}' not found."}
            
        badge = self._badges[badge_id]
        u = self._user_states.setdefault(user_id, {
            "credit_balance": 0, "lifetime_reduction_g_co2": 0.0, "lifetime_energy_saved_kwh": 0.0,
            "total_optimizations": 0, "current_streak_days": 1, "rank_title": "Eco Explorer",
            "unlocked_badges": set(), "transactions": []
        })
        user_unlocked = u.setdefault("unlocked_badges", set())
        
        if badge_id in user_unlocked:
            return {"success": False, "error": "You already own this badge."}
            
        if u["credit_balance"] < badge.credit_price:
            return {
                "success": False, 
                "error": f"Insufficient Green Credits. Needed: {badge.credit_price}, Current Balance: {u['credit_balance']}"
            }
            
        # Deduct credits & unlock
        u["credit_balance"] -= badge.credit_price
        user_unlocked.add(badge_id)
        badge.is_unlocked = True
        
        u["transactions"].append({
            "tx_id": f"tx_buy_{int(time.time())}",
            "type": "marketplace_purchase",
            "credits": -badge.credit_price,
            "description": f"Unlocked Badge: {badge.name}",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        })
        
        return {
            "success": True,
            "message": f"Successfully unlocked {badge.name}!",
            "badge": badge,
            "new_balance": u["credit_balance"]
        }

    def record_on_chain_mint(self, badge_id: str, tx_hash: str, user_id: str = "default_user"):
        """Updates badge state with Sepolia transaction verification."""
        if badge_id in self._badges:
            self._badges[badge_id].minted_on_chain = True
            self._badges[badge_id].tx_hash = tx_hash


credit_service = GreenCreditService()
