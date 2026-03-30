#!/usr/bin/env python3.13
"""
Unified Epoch Simulation — 60 Games per Player Count (2P/3P/4P/5P)
====================================================================
Generates 240 parametric games with varied configurations for game
balance analysis. Each player count gets a deterministic random seed
for reproducibility.
"""

import sys
sys.path.insert(0, "/Users/mleihs/Dev/velgarien-rebuild/scripts")

from epoch_sim_lib import run_parametric_battery

BASE_DIR = "/Users/mleihs/Dev/velgarien-rebuild"
NUM_GAMES = 50

# Which player counts to run (can be overridden via CLI args)
PLAYER_COUNTS = [2, 3, 4, 5]


def run_2p():
    tags_2p = ["V", "GR", "SN", "SP"]  # NM excluded from 2P (only 4 possible matchups)
    run_parametric_battery(
        f"{NUM_GAMES} Games — 2 Players",
        2, NUM_GAMES, tags_2p,
        f"{BASE_DIR}/epoch-2p-simulation.log",
        f"{BASE_DIR}/epoch-2p-analysis.md",
        seed=2000,
    )


def run_3p():
    tags_3p = ["V", "GR", "SN", "SP", "NM"]
    run_parametric_battery(
        f"{NUM_GAMES} Games — 3 Players",
        3, NUM_GAMES, tags_3p,
        f"{BASE_DIR}/epoch-3p-simulation.log",
        f"{BASE_DIR}/epoch-3p-analysis.md",
        seed=3000,
        batch_size=5,
    )


def run_4p():
    tags_4p = ["V", "GR", "SN", "SP", "NM"]
    run_parametric_battery(
        f"{NUM_GAMES} Games — 4 Players",
        4, NUM_GAMES, tags_4p,
        f"{BASE_DIR}/epoch-4p-simulation.log",
        f"{BASE_DIR}/epoch-4p-analysis.md",
        seed=4000,
        batch_size=4,
    )


def run_5p():
    tags_5p = ["V", "GR", "SN", "SP", "NM"]
    run_parametric_battery(
        f"{NUM_GAMES} Games — 5 Players",
        5, NUM_GAMES, tags_5p,
        f"{BASE_DIR}/epoch-5p-simulation.log",
        f"{BASE_DIR}/epoch-5p-analysis.md",
        seed=5000,
        batch_size=3,
    )


if __name__ == "__main__":
    counts = PLAYER_COUNTS
    if len(sys.argv) > 1:
        counts = [int(x) for x in sys.argv[1:]]
        print(f"Running player counts: {counts}")

    runners = {2: run_2p, 3: run_3p, 4: run_4p, 5: run_5p}
    for pc in counts:
        if pc in runners:
            print(f"\n{'#'*70}")
            print(f"# STARTING {pc}-PLAYER BATTERY ({NUM_GAMES} games)")
            print(f"{'#'*70}\n")
            runners[pc]()
        else:
            print(f"Unknown player count: {pc}")
