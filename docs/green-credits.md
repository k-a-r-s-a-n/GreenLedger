# Green Credit System & Anti-Abuse Rules

## Overview
Green Credits incentivize sustainable computing habits by awarding verifiable tokens for real, measurable power reductions.

---

## Reward Calculation Formula
When an optimization cycle completes, credits are calculated transparently:

$$\text{Credits} = \text{Base Reward (10)} + \lfloor\text{Power Drop \%}\rfloor + \lfloor\text{CO}_2\text{ Saved (g)} \times 0.5\rfloor + \text{Streak Bonus (5)}$$

---

## Anti-Abuse Protections
To prevent automated script exploitation:
1. **Minimum Threshold**: Reductions below **3%** do not trigger reduction multipliers.
2. **Cooldown Enforcement**: An anti-spam cooldown enforces at least **20 seconds** between recorded optimization cycles.
3. **Telemetry Fingerprinting**: SHA-256 telemetry hash verifies that system state actually changed between before and after snapshots.
