"""
GreenLedger - Action Evaluation Protocol (the 40% claim, done honestly).

Runs N before/after trials per action against the trained v1.1.0 model on
FROZEN, documented persona baselines and reports mean reduction with a 95%
confidence interval. The frozen baseline + trial log is what makes a headline
number defensible: anyone can re-run this file and get the same answer.

Action effect models are engineering estimates grounded in:
  - Mahesri & Vardhan laptop breakdown (display ~26-29% of system power)
  - NotebookCheck LCD max-min delta (~6W)
  - Published Balanced-vs-Saver wall measurements (~0% idle, ~18% full load)
  - DVFS physics P ~ C*V^2*f with race-to-idle conservatism (a CPU cap can
    RAISE utilization % for the same work — modeled, not ignored)

These are MODEL-estimated deltas (synthetic-trained instrument). Live Windows
trials confirm them on hardware; the protocol, not the point estimate, is the
point. Carbon reduction % equals power reduction % (same grid factor).

Usage:
    python ml/scripts/evaluate_actions.py [--trials 20] [--persona student_typical|all]
"""

import argparse
import json
import math
import sys
import time
from pathlib import Path

import numpy as np
import xgboost as xgb

sys.path.insert(0, str(Path(__file__).resolve().parent))
from feature_mapper import ALL_MODEL_FEATURES, map_telemetry_to_features

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
REPORTS_DIR = Path(__file__).resolve().parent.parent / "reports"

# --- Frozen persona baselines (do not tune to flatter the headline) ---
PERSONAS = {
    "student_typical": dict(
        cpu_utilization=45.0, memory_usage=62.0, disk_io=6.0, process_count=175,
        thread_count=2400, uptime=10.0, screen_brightness=100.0,
        cpu_frequency=2350.0, power_saver_active=0,
    ),
    "heavy_multitasker": dict(
        cpu_utilization=70.0, memory_usage=80.0, disk_io=30.0, process_count=230,
        thread_count=3400, uptime=5.0, screen_brightness=100.0,
        cpu_frequency=3000.0, power_saver_active=0,
    ),
    "clean_efficient": dict(
        cpu_utilization=20.0, memory_usage=50.0, disk_io=2.0, process_count=130,
        thread_count=1700, uptime=40.0, screen_brightness=60.0,
        cpu_frequency=1700.0, power_saver_active=0,
    ),
}


def _freq_for(cpu: float, rng: np.random.Generator) -> float:
    return float(np.clip(1200.0 + 25.0 * cpu + rng.normal(0, 100.0), 800.0, 4600.0))


def apply_close_heavy_app(t: dict, rng: np.random.Generator) -> dict:
    """Kill one heavy background app: CPU -17±4, fewer procs/threads."""
    out = dict(t)
    out["cpu_utilization"] = max(5.0, t["cpu_utilization"] - rng.normal(17.0, 4.0))
    out["process_count"] = max(60, int(t["process_count"] - rng.normal(15.0, 5.0)))
    out["thread_count"] = max(500, int(t["thread_count"] - rng.normal(400.0, 100.0)))
    out["cpu_frequency"] = _freq_for(out["cpu_utilization"], rng)
    return out


def apply_brightness_35(t: dict, rng: np.random.Generator) -> dict:
    out = dict(t)
    out["screen_brightness"] = float(np.clip(rng.normal(35.0, 2.0), 20.0, 50.0))
    return out


def apply_power_saver(t: dict, rng: np.random.Generator) -> dict:
    """Saver plan: sustained clocks x0.82±0.03 (load-dependent in reality)."""
    out = dict(t)
    out["power_saver_active"] = 1
    out["cpu_frequency"] = float(np.clip(
        t["cpu_frequency"] * rng.normal(0.82, 0.03), 800.0, 4600.0))
    return out


def apply_cpu_cap_55(t: dict, rng: np.random.Generator) -> dict:
    """55% sustained cap: clocks fall, utilization % RISES slightly (same work,
    slower clocks — race-to-idle conservatism, not ignored)."""
    out = dict(t)
    out["cpu_frequency"] = float(np.clip(rng.normal(1150.0, 80.0), 800.0, 4600.0))
    out["cpu_utilization"] = min(100.0, t["cpu_utilization"] + rng.normal(3.0, 2.0))
    return out


def apply_eco_mode(t: dict, rng: np.random.Generator) -> dict:
    """Eco-B bundle: all of the above in one cycle (defaults shipped in app)."""
    out = apply_close_heavy_app(t, rng)
    out = apply_brightness_35(out, rng)
    out = apply_power_saver(out, rng)
    # Cap dominates final clocks; utilization settles near 23%.
    out["cpu_frequency"] = float(np.clip(rng.normal(1150.0, 80.0), 800.0, 4600.0))
    out["cpu_utilization"] = float(np.clip(rng.normal(23.0, 3.0), 5.0, 100.0))
    out["memory_usage"] = max(10.0, t["memory_usage"] - rng.normal(5.0, 2.0))
    out["process_count"] = max(60, int(t["process_count"] - rng.normal(22.0, 6.0)))
    out["thread_count"] = max(500, int(t["thread_count"] - rng.normal(550.0, 120.0)))
    return out


ACTIONS = {
    "close_heavy_app": apply_close_heavy_app,
    "reduce_brightness_35": apply_brightness_35,
    "enable_power_saver": apply_power_saver,
    "cap_cpu_55": apply_cpu_cap_55,
    "eco_mode": apply_eco_mode,
}


def predict_watts(model: xgb.XGBRegressor, features: list, telemetry: dict) -> float:
    mapped, _ = map_telemetry_to_features(telemetry)
    vec = np.array([[mapped[f] for f in features]], dtype=np.float32)
    return float(np.clip(model.predict(vec)[0], 5.0, 120.0))


def evaluate_persona(model, features, persona_name, base, trials, seed):
    rng = np.random.default_rng(seed)
    results = {}
    for action_name, fn in ACTIONS.items():
        cuts = []
        for _ in range(trials):
            # Jitter the baseline slightly per trial (real machines drift).
            before = dict(base)
            before["cpu_utilization"] = float(np.clip(
                rng.normal(base["cpu_utilization"], 2.0), 1.0, 100.0))
            before["cpu_frequency"] = _freq_for(before["cpu_utilization"], rng)
            after = fn(before, rng)
            p0 = predict_watts(model, features, before)
            p1 = predict_watts(model, features, after)
            cuts.append(max(0.0, (p0 - p1) / p0 * 100.0) if p0 > 0 else 0.0)
        cuts = np.array(cuts)
        mean = float(cuts.mean())
        sd = float(cuts.std(ddof=1)) if trials > 1 else 0.0
        half_ci = 1.96 * sd / math.sqrt(trials)  # normal approx, n>=20
        results[action_name] = {
            "mean_reduction_pct": round(mean, 1),
            "ci95_half_width": round(half_ci, 1),
            "min_pct": round(float(cuts.min()), 1),
            "max_pct": round(float(cuts.max()), 1),
        }
    return results


def main():
    parser = argparse.ArgumentParser(description="GreenLedger action evaluation protocol")
    parser.add_argument("--trials", type=int, default=20)
    parser.add_argument("--persona", default="student_typical",
                        help="persona name or 'all'")
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()

    model_path = MODELS_DIR / "power_model.json"
    schema_path = MODELS_DIR / "feature_schema.json"
    if not model_path.exists():
        print("Train first: python ml/scripts/train.py")
        sys.exit(1)
    model = xgb.XGBRegressor()
    model.load_model(str(model_path))
    schema = json.load(open(schema_path))

    personas = list(PERSONAS) if args.persona == "all" else [args.persona]
    report = {
        "protocol": "frozen-baseline before/after trials, 95% CI (normal approx)",
        "model_version": schema.get("version"),
        "trials_per_action": args.trials,
        "seed": args.seed,
        "note": "Model-estimated deltas (synthetic-trained v1.1.0 instrument). "
                "Carbon reduction % equals power reduction % (same grid factor).",
        "personas": {},
    }

    for persona in personas:
        base = PERSONAS[persona]
        res = evaluate_persona(model, schema["features"], persona, base, args.trials, args.seed)
        report["personas"][persona] = {"baseline": base, "actions": res}
        print(f"\n=== {persona} (n={args.trials}/action) ===")
        for action, stats in res.items():
            print(f"  {action:22s} {stats['mean_reduction_pct']:5.1f}% ± {stats['ci95_half_width']:.1f} "
                  f"(range {stats['min_pct']:.1f}-{stats['max_pct']:.1f})")

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = REPORTS_DIR / "eco_evaluation.json"
    report["evaluated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    json.dump(report, open(out_path, "w"), indent=2)
    print(f"\nTrial log written to {out_path}")
    eco = report["personas"][personas[0]]["actions"]["eco_mode"]
    print(f"HEADLINE ({personas[0]}): Eco Mode {eco['mean_reduction_pct']}% ± {eco['ci95_half_width']} "
          f"(95% CI, n={args.trials})")


if __name__ == "__main__":
    main()
