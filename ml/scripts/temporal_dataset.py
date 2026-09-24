"""
GreenLedger - Temporal Episode Generator (Phase 2 training data).

The production model sees one tick at a time, but the agent polls a *time
series* (2.5s cadence, 120-sample buffer). This script generates synthetic
temporal episodes with documented dynamics so a sequence model can learn
what a single tick cannot show: trends, regime shifts, and action effects.

Episode dynamics (all seeded, all documented):
  - Utilization: AR(1) around regime means (idle ~12 / work ~40 / load ~75)
    with 1-3 regime shifts per episode.
  - Frequency: 1200 + 25u + noise, x0.82 under Saver; 20% of episodes get a
    mid-episode CPU-cap event (action-like frequency collapse).
  - Brightness: slow random walk + occasional step down to ~35 (action-like).
  - Memory/disk/processes: correlated random walks; 20% of episodes get a
    mid-episode app-close event (process/thread drop).
  - Power: the SAME v1.1 physics as dataset_loader.py (P_idle + P_cpu(u,f) +
    P_ram + P_disk + P_display + P_cooling + noise), applied per tick.

Output: ml/data/processed/temporal_episodes.npz with X (N, T, F),
y (N, T), feature names. Episode-level splits only (never split ticks of
one episode across train/test) — enforced in train_temporal.py.

Usage: python ml/scripts/temporal_dataset.py [--episodes 600] [--ticks 30]
"""

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from feature_mapper import ALL_MODEL_FEATURES, compute_engineered_features

PROCESSED_DIR = Path(__file__).resolve().parent.parent / "data" / "processed"

REGIMES = [(12.0, 5.0), (40.0, 8.0), (75.0, 8.0)]  # (util_mean, util_std)


def _physics_power(u, f, mem, disk, bright, temp, rng) -> np.ndarray:
    """v1.1 physics mirrored from dataset_loader.py (same constants)."""
    dvfs = (f / 3200.0) ** 1.5
    p_cpu = (0.35 * u + 0.002 * (u ** 2)) * dvfs
    p_ram = 0.05 * mem
    p_disk = 0.015 * disk
    p_display = 1.0 + 0.05 * bright
    p_cooling = np.where(temp > 65.0, 0.08 * (temp - 65.0), 0.0)
    noise = rng.normal(0, 1.2, size=u.shape)
    return np.clip(10.5 + p_cpu + p_ram + p_disk + p_display + p_cooling + noise, 8.0, 110.0)


def generate_episode(rng: np.random.Generator, ticks: int) -> pd.DataFrame:
    # Regime schedule: 1-3 segments.
    n_seg = int(rng.integers(1, 4))
    bounds = sorted(rng.choice(np.arange(1, ticks), size=n_seg - 1, replace=False).tolist())
    seg_of = np.zeros(ticks, dtype=int)
    edges = [0] + bounds + [ticks]
    for s in range(n_seg):
        seg_of[edges[s]:edges[s + 1]] = s
    seg_regime = [REGIMES[int(rng.integers(0, 3))] for _ in range(n_seg)]

    u = np.zeros(ticks)
    u_mean, u_std = seg_regime[0]
    u[0] = np.clip(rng.normal(u_mean, u_std), 1.0, 99.0)
    for t in range(1, ticks):
        m, _ = seg_regime[seg_of[t]]
        u[t] = np.clip(m + 0.85 * (u[t - 1] - m) + rng.normal(0, 4.0), 1.0, 99.0)

    saver = np.zeros(ticks)
    saver[:] = 1 if rng.uniform() < 0.30 else 0
    if rng.uniform() < 0.20:  # mid-episode plan flip
        saver[rng.integers(ticks // 3, ticks):] = 1 - saver[0]

    cap = np.ones(ticks)
    if rng.uniform() < 0.20:  # mid-episode CPU-cap event
        cap[rng.integers(ticks // 3, 2 * ticks // 3):] = rng.uniform(0.55, 0.80)

    f = (1200.0 + 25.0 * u + rng.normal(0, 100.0, ticks))
    f = f * np.where(saver == 1, 0.82, 1.0) * cap
    f = np.clip(f, 800.0, 4600.0)

    bright = np.zeros(ticks)
    bright[0] = rng.uniform(40.0, 100.0)
    step_at = rng.integers(ticks // 3, ticks) if rng.uniform() < 0.30 else -1
    for t in range(1, ticks):
        if t == step_at:
            bright[t] = rng.normal(35.0, 2.0)  # action-like brightness cut
        else:
            bright[t] = bright[t - 1] + rng.normal(0, 2.0)
    bright = np.clip(bright, 20.0, 100.0)

    mem = np.clip(55.0 + 0.1 * (u - 40.0) + rng.normal(0, 2.0, ticks), 10.0, 98.0)
    disk = np.zeros(ticks)
    disk[0] = abs(rng.normal(6.0, 4.0))
    for t in range(1, ticks):
        disk[t] = max(0.1, 0.7 * disk[t - 1] + abs(rng.normal(0, 8.0)) + 0.05 * u[t])
    disk = np.clip(disk, 0.1, 450.0)

    procs = np.zeros(ticks)
    procs[0] = rng.integers(120, 260)
    for t in range(1, ticks):
        procs[t] = procs[t - 1] + rng.normal(0, 3.0)
    if rng.uniform() < 0.20:  # app-close event
        procs[rng.integers(ticks // 3, ticks):] -= rng.normal(15.0, 5.0)
    procs = np.clip(procs, 60, 350).astype(int)
    threads = (procs * rng.integers(12, 20)).astype(int)

    uptime = np.full(ticks, rng.uniform(0.5, 200.0))
    temp = np.clip(38.0 + 0.42 * u + 0.08 * mem + rng.normal(0, 1.5, ticks), 35.0, 98.0)

    power = _physics_power(u, f, mem, disk, bright, temp, rng)

    df = pd.DataFrame({
        "cpu_utilization": u, "memory_usage": mem, "disk_io": disk,
        "process_count": procs, "thread_count": threads, "uptime": uptime,
        "screen_brightness": bright, "cpu_frequency": f,
        "power_saver_active": saver,
    })
    df = compute_engineered_features(df)
    df["power_consumption"] = power
    return df


def generate_dataset(episodes: int, ticks: int, seed: int,
                     out_path: Path | None = None) -> Path:
    rng = np.random.default_rng(seed)
    Xs, ys = [], []
    for _ in range(episodes):
        ep = generate_episode(rng, ticks)
        Xs.append(ep[ALL_MODEL_FEATURES].to_numpy(dtype=np.float32))
        ys.append(ep["power_consumption"].to_numpy(dtype=np.float32))
    X = np.stack(Xs)
    y = np.stack(ys)
    out = out_path or (PROCESSED_DIR / "temporal_episodes.npz")
    out.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(out, X=X, y=y, features=np.array(ALL_MODEL_FEATURES),
                        ticks_per_episode=ticks, seed=seed)
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="GreenLedger temporal episodes")
    parser.add_argument("--episodes", type=int, default=600)
    parser.add_argument("--ticks", type=int, default=30)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    out = generate_dataset(args.episodes, args.ticks, args.seed)
    d = np.load(out)
    print(f"Episodes: {d['X'].shape}  power range: {d['y'].min():.1f}-{d['y'].max():.1f}W")
    print(f"Saved to {out}")


if __name__ == "__main__":
    main()
