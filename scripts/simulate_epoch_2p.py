#!/usr/bin/env python3.13
"""
2-Player Epoch Simulation — 10 Games
======================================
Tests 1v1 dynamics across varied matchups and strategies.
"""

import sys
sys.path.insert(0, "/Users/mleihs/Dev/velgarien-rebuild/scripts")

from epoch_sim_lib import (
    reset_game_state, setup_game, finish_game, deploy, counter_intel,
    run_foundation, run_competition, run_reckoning, reachable_target,
    run_battery, set_active_tags,
)

BASE_CONFIG = {"rp_per_cycle": 15, "rp_cap": 50, "cycle_hours": 2, "duration_days": 14,
               "foundation_pct": 15, "reckoning_pct": 15, "max_team_size": 4, "allow_betrayal": True,
               "score_weights": {"stability": 25, "influence": 20, "sovereignty": 20, "diplomatic": 15, "military": 20}}


def game_01(token):
    """V vs GR — Balanced mirror match"""
    ctx = reset_game_state()
    tags = ["V", "GR"]
    epoch_id, players, admin = setup_game(ctx, token, "G1: Mirror Match", BASE_CONFIG, tags)
    last = run_foundation(ctx, epoch_id, players, admin, {"V": 2, "GR": 2})

    def strat(eid, pl, cyc):
        for tag in tags:
            other = [t for t in tags if t != tag]
            t = reachable_target(pl[tag], other, pl)
            if not t:
                continue
            if cyc % 3 == 0 and pl[tag].rp >= 5 and pl[t].buildings:
                deploy(ctx, eid, pl[tag], "saboteur", t, pl, pl[t].buildings[0]["id"], "building")
            elif cyc % 3 == 1 and pl[tag].rp >= 4:
                deploy(ctx, eid, pl[tag], "propagandist", t, pl)
            elif pl[tag].rp >= 3:
                deploy(ctx, eid, pl[tag], "spy", t, pl)

    run_competition(ctx, epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(ctx, epoch_id, players, admin, 17, 20, strat)
    return finish_game(ctx, epoch_id, admin, players, "G1: Mirror Match",
                       "V vs GR, both 2 guardians, rotating spy/sab/prop", tags)


def game_02(token):
    """V vs SN — Heavy offense, 1 guardian each"""
    ctx = reset_game_state()
    tags = ["V", "SN"]
    config = {**BASE_CONFIG, "rp_per_cycle": 20, "rp_cap": 60,
              "score_weights": {"stability": 15, "influence": 15, "sovereignty": 15, "diplomatic": 15, "military": 40}}
    epoch_id, players, admin = setup_game(ctx, token, "G2: Warmonger Duel", config, tags)
    last = run_foundation(ctx, epoch_id, players, admin, {"V": 1, "SN": 1}, cycles=2)

    def strat(eid, pl, cyc):
        for tag in tags:
            other = [t for t in tags if t != tag]
            t = reachable_target(pl[tag], other, pl)
            if not t:
                continue
            if cyc % 2 == 0 and pl[tag].rp >= 8 and pl[t].agents:
                deploy(ctx, eid, pl[tag], "assassin", t, pl, pl[t].agents[0]["id"], "agent")
            elif pl[tag].rp >= 5 and pl[t].buildings:
                deploy(ctx, eid, pl[tag], "saboteur", t, pl, pl[t].buildings[0]["id"], "building")

    run_competition(ctx, epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(ctx, epoch_id, players, admin, 17, 20, strat)
    return finish_game(ctx, epoch_id, admin, players, "G2: Warmonger Duel",
                       "V vs SN, 1 guardian each, military=40%, assassins+saboteurs", tags)


def game_03(token):
    """GR vs SP — Guardian asymmetry (3 vs 1)"""
    ctx = reset_game_state()
    tags = ["GR", "SP"]
    epoch_id, players, admin = setup_game(ctx, token, "G3: Fort vs Raid", BASE_CONFIG, tags)
    last = run_foundation(ctx, epoch_id, players, admin, {"GR": 3, "SP": 1})

    def strat(eid, pl, cyc):
        # GR (3 guardians) plays defensive — rare attacks
        t = reachable_target(pl["GR"], ["SP"], pl)
        if t and cyc % 3 == 0 and pl["GR"].rp >= 3:
            deploy(ctx, eid, pl["GR"], "spy", t, pl)
        # SP (1 guardian) plays aggressive
        t = reachable_target(pl["SP"], ["GR"], pl)
        if not t:
            return
        if pl["SP"].rp >= 5 and pl["GR"].buildings:
            bld = pl["GR"].buildings[cyc % len(pl["GR"].buildings)]
            deploy(ctx, eid, pl["SP"], "saboteur", "GR", pl, bld["id"], "building")
        if pl["SP"].rp >= 3:
            deploy(ctx, eid, pl["SP"], "spy", "GR", pl)

    run_competition(ctx, epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(ctx, epoch_id, players, admin, 17, 20, strat)
    return finish_game(ctx, epoch_id, admin, players, "G3: Fort vs Raid",
                       "GR=3 guardians (defensive), SP=1 guardian (aggressive)", tags)


def game_04(token):
    """V vs SP — Spy-only (intel war)"""
    ctx = reset_game_state()
    tags = ["V", "SP"]
    epoch_id, players, admin = setup_game(ctx, token, "G4: Intel War", BASE_CONFIG, tags)
    last = run_foundation(ctx, epoch_id, players, admin, {"V": 2, "SP": 2})

    def strat(eid, pl, cyc):
        for tag in tags:
            other = [t for t in tags if t != tag]
            t = reachable_target(pl[tag], other, pl)
            if t and pl[tag].rp >= 3:
                deploy(ctx, eid, pl[tag], "spy", t, pl)

    run_competition(ctx, epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(ctx, epoch_id, players, admin, 17, 20, strat)
    return finish_game(ctx, epoch_id, admin, players, "G4: Intel War",
                       "V vs SP, spy-only operations, 2 guardians each", tags)


def game_05(token):
    """SN vs GR — Saboteur-only"""
    ctx = reset_game_state()
    tags = ["SN", "GR"]
    epoch_id, players, admin = setup_game(ctx, token, "G5: Demolition Derby", BASE_CONFIG, tags)
    last = run_foundation(ctx, epoch_id, players, admin, {"SN": 2, "GR": 2})

    def strat(eid, pl, cyc):
        for tag in tags:
            other = [t for t in tags if t != tag]
            t = reachable_target(pl[tag], other, pl)
            if t and pl[tag].rp >= 5 and pl[t].buildings:
                idx = cyc % len(pl[t].buildings)
                deploy(ctx, eid, pl[tag], "saboteur", t, pl, pl[t].buildings[idx]["id"], "building")

    run_competition(ctx, epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(ctx, epoch_id, players, admin, 17, 20, strat)
    return finish_game(ctx, epoch_id, admin, players, "G5: Demolition Derby",
                       "SN vs GR, saboteur-only, 2 guardians each", tags)


def game_06(token):
    """V vs GR — Counter-intel vs raw offense"""
    ctx = reset_game_state()
    tags = ["V", "GR"]
    epoch_id, players, admin = setup_game(ctx, token, "G6: Defense vs Offense", BASE_CONFIG, tags)
    last = run_foundation(ctx, epoch_id, players, admin, {"V": 2, "GR": 2})

    def strat(eid, pl, cyc):
        # V: counter-intel every cycle + light offense
        if pl["V"].rp >= 3:
            counter_intel(ctx, eid, pl["V"])
        t = reachable_target(pl["V"], ["GR"], pl)
        if t and cyc % 3 == 0 and pl["V"].rp >= 3:
            deploy(ctx, eid, pl["V"], "spy", t, pl)
        # GR: all offense, no CI
        t = reachable_target(pl["GR"], ["V"], pl)
        if not t:
            return
        if pl["GR"].rp >= 8 and pl["V"].agents:
            deploy(ctx, eid, pl["GR"], "assassin", "V", pl, pl["V"].agents[0]["id"], "agent")
        elif pl["GR"].rp >= 5 and pl["V"].buildings:
            deploy(ctx, eid, pl["GR"], "saboteur", "V", pl, pl["V"].buildings[0]["id"], "building")
        if pl["GR"].rp >= 3:
            deploy(ctx, eid, pl["GR"], "spy", "V", pl)

    run_competition(ctx, epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(ctx, epoch_id, players, admin, 17, 20, strat)
    return finish_game(ctx, epoch_id, admin, players, "G6: Defense vs Offense",
                       "V=CI every cycle + light offense, GR=max aggression", tags)


def game_07(token):
    """SP vs SN — High RP economy"""
    ctx = reset_game_state()
    tags = ["SP", "SN"]
    config = {**BASE_CONFIG, "rp_per_cycle": 25, "rp_cap": 75}
    epoch_id, players, admin = setup_game(ctx, token, "G7: High RP Duel", config, tags)
    last = run_foundation(ctx, epoch_id, players, admin, {"SP": 2, "SN": 2})

    def strat(eid, pl, cyc):
        for tag in tags:
            other = [t for t in tags if t != tag]
            t = reachable_target(pl[tag], other, pl)
            if not t:
                continue
            if pl[tag].rp >= 8 and pl[t].agents:
                deploy(ctx, eid, pl[tag], "assassin", t, pl, pl[t].agents[0]["id"], "agent")
            if pl[tag].rp >= 5 and pl[t].buildings:
                deploy(ctx, eid, pl[tag], "saboteur", t, pl, pl[t].buildings[0]["id"], "building")
            if pl[tag].rp >= 4:
                deploy(ctx, eid, pl[tag], "propagandist", t, pl)

    run_competition(ctx, epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(ctx, epoch_id, players, admin, 17, 20, strat)
    return finish_game(ctx, epoch_id, admin, players, "G7: High RP Duel",
                       "SP vs SN, 25 RP/cycle, 75 cap, multi-ops per cycle", tags)


def game_08(token):
    """V vs GR — No guardians"""
    ctx = reset_game_state()
    tags = ["V", "GR"]
    epoch_id, players, admin = setup_game(ctx, token, "G8: No Guardians", BASE_CONFIG, tags)
    last = run_foundation(ctx, epoch_id, players, admin, {"V": 0, "GR": 0}, cycles=2)

    def strat(eid, pl, cyc):
        for tag in tags:
            other = [t for t in tags if t != tag]
            t = reachable_target(pl[tag], other, pl)
            if not t:
                continue
            ops = ["spy", "saboteur", "propagandist"]
            op = ops[cyc % 3]
            if op == "saboteur" and pl[tag].rp >= 5 and pl[t].buildings:
                deploy(ctx, eid, pl[tag], "saboteur", t, pl, pl[t].buildings[0]["id"], "building")
            elif op == "propagandist" and pl[tag].rp >= 4:
                deploy(ctx, eid, pl[tag], "propagandist", t, pl)
            elif pl[tag].rp >= 3:
                deploy(ctx, eid, pl[tag], "spy", t, pl)

    run_competition(ctx, epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(ctx, epoch_id, players, admin, 17, 20, strat)
    return finish_game(ctx, epoch_id, admin, players, "G8: No Guardians",
                       "V vs GR, zero guardians, pure offense", tags)


def game_09(token):
    """GR vs SN — Military-weighted"""
    ctx = reset_game_state()
    tags = ["GR", "SN"]
    config = {
        **BASE_CONFIG,
        "score_weights": {"stability": 10, "influence": 10, "sovereignty": 10, "diplomatic": 10, "military": 60},
    }
    epoch_id, players, admin = setup_game(ctx, token, "G9: Military Focus", config, tags)
    last = run_foundation(ctx, epoch_id, players, admin, {"GR": 1, "SN": 1}, cycles=2)

    def strat(eid, pl, cyc):
        for tag in tags:
            other = [t for t in tags if t != tag]
            t = reachable_target(pl[tag], other, pl)
            if not t:
                continue
            if pl[tag].rp >= 8 and pl[t].agents:
                deploy(ctx, eid, pl[tag], "assassin", t, pl, pl[t].agents[0]["id"], "agent")
            if pl[tag].rp >= 5 and pl[t].buildings:
                deploy(ctx, eid, pl[tag], "saboteur", t, pl, pl[t].buildings[0]["id"], "building")
            if pl[tag].rp >= 3:
                deploy(ctx, eid, pl[tag], "spy", t, pl)

    run_competition(ctx, epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(ctx, epoch_id, players, admin, 17, 20, strat)
    return finish_game(ctx, epoch_id, admin, players, "G9: Military Focus",
                       "GR vs SN, military=60% weight, 1 guardian each", tags)


def game_10(token):
    """SP vs V — Builder preset (stability=40%)"""
    ctx = reset_game_state()
    tags = ["SP", "V"]
    config = {
        **BASE_CONFIG,
        "score_weights": {"stability": 40, "influence": 15, "sovereignty": 15, "diplomatic": 10, "military": 20},
    }
    epoch_id, players, admin = setup_game(ctx, token, "G10: Builder Duel", config, tags)
    last = run_foundation(ctx, epoch_id, players, admin, {"SP": 3, "V": 1}, cycles=4)

    def strat(eid, pl, cyc):
        # SP: defensive builder (3 guards)
        t = reachable_target(pl["SP"], ["V"], pl)
        if t and cyc % 4 == 0 and pl["SP"].rp >= 3:
            deploy(ctx, eid, pl["SP"], "spy", t, pl)
        # V: aggressive raider (1 guard)
        t = reachable_target(pl["V"], ["SP"], pl)
        if t and pl["V"].rp >= 5 and pl["SP"].buildings:
            idx = cyc % len(pl["SP"].buildings)
            deploy(ctx, eid, pl["V"], "saboteur", "SP", pl, pl["SP"].buildings[idx]["id"], "building")

    run_competition(ctx, epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(ctx, epoch_id, players, admin, 17, 20, strat)
    return finish_game(ctx, epoch_id, admin, players, "G10: Builder Duel",
                       "SP=3 guards (builder), V=1 guard (raider), stability=40%", tags)


if __name__ == "__main__":
    set_active_tags(["V", "GR", "SN", "SP"])
    run_battery(
        "10 Games — 2 Players",
        2,
        [game_01, game_02, game_03, game_04, game_05,
         game_06, game_07, game_08, game_09, game_10],
        "/Users/mleihs/Dev/velgarien-rebuild/epoch-2p-simulation.log",
        "/Users/mleihs/Dev/velgarien-rebuild/epoch-2p-analysis.md",
    )
