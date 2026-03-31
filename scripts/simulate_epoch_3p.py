#!/usr/bin/env python3.13
"""
3-Player Epoch Simulation — 10 Games
======================================
Tests 3-player dynamics: kingmaker scenarios, 2v1, odd-player-out.
"""

import sys
sys.path.insert(0, "/Users/mleihs/Dev/velgarien-rebuild/scripts")

from epoch_sim_lib import (
    reset_game_state, setup_game, finish_game, deploy, counter_intel,
    run_foundation, run_competition, run_reckoning, reachable_target,
    log, action_log, run_battery, set_active_tags,
)

BASE_CONFIG = {"rp_per_cycle": 15, "rp_cap": 50, "cycle_hours": 2, "duration_days": 14,
               "foundation_pct": 15, "reckoning_pct": 15, "max_team_size": 4, "allow_betrayal": True,
               "score_weights": {"stability": 25, "influence": 20, "sovereignty": 20, "diplomatic": 15, "military": 20}}


def game_01(token):
    """V/GR/SN — Balanced free-for-all"""
    ctx = reset_game_state()
    tags = ["V", "GR", "SN"]
    epoch_id, players, admin = setup_game(ctx, token, "G1: Free-for-All", BASE_CONFIG, tags)
    last = run_foundation(ctx, epoch_id, players, admin, {"V": 2, "GR": 2, "SN": 2})

    def strat(eid, pl, cyc):
        for tag in tags:
            others = [t for t in tags if t != tag]
            t = reachable_target(pl[tag], others, pl)
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
    return finish_game(ctx, epoch_id, admin, players, "G1: Free-for-All",
                       "V/GR/SN, 2 guardians each, mixed ops, every player attacks random other", tags)


def game_02(token):
    """V/GR/SP — Alliance V+GR vs SP"""
    ctx = reset_game_state()
    tags = ["V", "GR", "SP"]
    epoch_id, players, admin = setup_game(ctx, token, "G2: 2v1 Alliance", BASE_CONFIG, tags,
                                          alliances={"Iron Pact": ("V", "GR")})
    last = run_foundation(ctx, epoch_id, players, admin, {"V": 2, "GR": 2, "SP": 2})

    def strat(eid, pl, cyc):
        # V+GR focus SP
        for tag in ["V", "GR"]:
            t = reachable_target(pl[tag], ["SP"], pl)
            if t and pl[tag].rp >= 5 and pl["SP"].buildings:
                deploy(ctx, eid, pl[tag], "saboteur", "SP", pl, pl["SP"].buildings[0]["id"], "building")
            elif t and pl[tag].rp >= 3:
                deploy(ctx, eid, pl[tag], "spy", "SP", pl)
        # SP attacks both
        for target in ["V", "GR"]:
            t = reachable_target(pl["SP"], [target], pl)
            if t and pl["SP"].rp >= 4:
                deploy(ctx, eid, pl["SP"], "propagandist", target, pl)
                break

    run_competition(ctx, epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(ctx, epoch_id, players, admin, 17, 20, strat)
    return finish_game(ctx, epoch_id, admin, players, "G2: 2v1 Alliance",
                       "V+GR allied vs SP alone, focused fire on SP", tags)


def game_03(token):
    """GR/SN/SP — Heavy offense, 1 guardian"""
    ctx = reset_game_state()
    tags = ["GR", "SN", "SP"]
    config = {**BASE_CONFIG, "rp_per_cycle": 20, "rp_cap": 60,
              "score_weights": {"stability": 15, "influence": 15, "sovereignty": 15, "diplomatic": 15, "military": 40}}
    epoch_id, players, admin = setup_game(ctx, token, "G3: Warmonger FFA", config, tags)
    last = run_foundation(ctx, epoch_id, players, admin, {"GR": 1, "SN": 1, "SP": 1}, cycles=2)

    def strat(eid, pl, cyc):
        for tag in tags:
            others = [t for t in tags if t != tag]
            t = reachable_target(pl[tag], others, pl)
            if not t:
                continue
            if cyc % 2 == 0 and pl[tag].rp >= 8 and pl[t].agents:
                deploy(ctx, eid, pl[tag], "assassin", t, pl, pl[t].agents[0]["id"], "agent")
            elif pl[tag].rp >= 5 and pl[t].buildings:
                deploy(ctx, eid, pl[tag], "saboteur", t, pl, pl[t].buildings[0]["id"], "building")

    run_competition(ctx, epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(ctx, epoch_id, players, admin, 17, 20, strat)
    return finish_game(ctx, epoch_id, admin, players, "G3: Warmonger FFA",
                       "GR/SN/SP, 1 guardian each, military=40%, assassins+saboteurs", tags)


def game_04(token):
    """V/SN/SP — Diplomatic preset"""
    ctx = reset_game_state()
    tags = ["V", "SN", "SP"]
    config = {
        **BASE_CONFIG,
        "score_weights": {"stability": 15, "influence": 20, "sovereignty": 20, "diplomatic": 30, "military": 15},
    }
    epoch_id, players, admin = setup_game(ctx, token, "G4: Diplomat FFA", config, tags)
    last = run_foundation(ctx, epoch_id, players, admin, {"V": 2, "SN": 2, "SP": 2})

    def strat(eid, pl, cyc):
        for tag in tags:
            others = [t for t in tags if t != tag]
            t = reachable_target(pl[tag], others, pl)
            if not t:
                continue
            if cyc % 3 == 0 and pl[tag].rp >= 6:
                emb = next(iter(pl[t].embassies.values()), None)
                if emb:
                    deploy(ctx, eid, pl[tag], "infiltrator", t, pl, emb, "embassy")
            elif pl[tag].rp >= 3:
                deploy(ctx, eid, pl[tag], "spy", t, pl)

    run_competition(ctx, epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(ctx, epoch_id, players, admin, 17, 20, strat)
    return finish_game(ctx, epoch_id, admin, players, "G4: Diplomat FFA",
                       "V/SN/SP, diplomatic=30%, infiltrator-heavy", tags)


def game_05(token):
    """V/GR/SN — Dogpile V (GR+SN both target V)"""
    ctx = reset_game_state()
    tags = ["V", "GR", "SN"]
    epoch_id, players, admin = setup_game(ctx, token, "G5: Dogpile", BASE_CONFIG, tags)
    last = run_foundation(ctx, epoch_id, players, admin, {"V": 2, "GR": 2, "SN": 2})

    def strat(eid, pl, cyc):
        # GR + SN both attack V
        for tag in ["GR", "SN"]:
            t = reachable_target(pl[tag], ["V"], pl)
            if t and pl[tag].rp >= 5 and pl["V"].buildings:
                deploy(ctx, eid, pl[tag], "saboteur", "V", pl, pl["V"].buildings[0]["id"], "building")
            elif t and pl[tag].rp >= 3:
                deploy(ctx, eid, pl[tag], "spy", "V", pl)
        # V fights back against both
        for target in ["GR", "SN"]:
            t = reachable_target(pl["V"], [target], pl)
            if t and pl["V"].rp >= 4:
                deploy(ctx, eid, pl["V"], "propagandist", target, pl)
                break

    run_competition(ctx, epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(ctx, epoch_id, players, admin, 17, 20, strat)
    return finish_game(ctx, epoch_id, admin, players, "G5: Dogpile",
                       "GR+SN both target V (2v1 without alliance), V fights back", tags)


def game_06(token):
    """V/GR/SP — Betrayal (V betrays ally GR mid-game)"""
    ctx = reset_game_state()
    tags = ["V", "GR", "SP"]
    epoch_id, players, admin = setup_game(ctx, token, "G6: Betrayal", BASE_CONFIG, tags,
                                          alliances={"Grand Alliance": ("V", "GR")})
    last = run_foundation(ctx, epoch_id, players, admin, {"V": 2, "GR": 2, "SP": 2})

    def strat(eid, pl, cyc):
        # SP attacks both
        for target in ["V", "GR"]:
            t = reachable_target(pl["SP"], [target], pl)
            if t and pl["SP"].rp >= 4:
                deploy(ctx, eid, pl["SP"], "propagandist", target, pl)
                break
        # GR attacks SP
        t = reachable_target(pl["GR"], ["SP"], pl)
        if t and pl["GR"].rp >= 3:
            deploy(ctx, eid, pl["GR"], "spy", "SP", pl)
        # V attacks SP pre-betrayal, then betrays GR on cycle 10
        if cyc < 10:
            t = reachable_target(pl["V"], ["SP"], pl)
            if t and pl["V"].rp >= 3:
                deploy(ctx, eid, pl["V"], "spy", "SP", pl)
        elif cyc == 10:
            log("  *** BETRAYAL: V attacks ally GR! ***")
            action_log(ctx, cyc, ctx.current_phase, "V", "BETRAYAL", "V attacks allied GR!", "TREACHERY")
            t = reachable_target(pl["V"], ["GR"], pl)
            if t and pl["V"].rp >= 8 and pl["GR"].agents:
                deploy(ctx, eid, pl["V"], "assassin", "GR", pl, pl["GR"].agents[0]["id"], "agent")
            if t and pl["V"].rp >= 5 and pl["GR"].buildings:
                deploy(ctx, eid, pl["V"], "saboteur", "GR", pl, pl["GR"].buildings[0]["id"], "building")
        else:
            # Post-betrayal: V attacks both
            for target in ["GR", "SP"]:
                t = reachable_target(pl["V"], [target], pl)
                if t and pl["V"].rp >= 3:
                    deploy(ctx, eid, pl["V"], "spy", target, pl)
                    break

    run_competition(ctx, epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(ctx, epoch_id, players, admin, 17, 20, strat)
    return finish_game(ctx, epoch_id, admin, players, "G6: Betrayal",
                       "V+GR alliance, V betrays GR on cycle 10 (assassin+saboteur)", tags)


def game_07(token):
    """GR/SN/SP — No guardians"""
    ctx = reset_game_state()
    tags = ["GR", "SN", "SP"]
    epoch_id, players, admin = setup_game(ctx, token, "G7: No Guardians", BASE_CONFIG, tags)
    last = run_foundation(ctx, epoch_id, players, admin, {"GR": 0, "SN": 0, "SP": 0}, cycles=2)

    def strat(eid, pl, cyc):
        for tag in tags:
            others = [t for t in tags if t != tag]
            t = reachable_target(pl[tag], others, pl)
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
    return finish_game(ctx, epoch_id, admin, players, "G7: No Guardians",
                       "GR/SN/SP, zero guardians, pure offense FFA", tags)


def game_08(token):
    """V/SN/SP — Counter-intel heavy"""
    ctx = reset_game_state()
    tags = ["V", "SN", "SP"]
    epoch_id, players, admin = setup_game(ctx, token, "G8: CI Heavy", BASE_CONFIG, tags)
    last = run_foundation(ctx, epoch_id, players, admin, {"V": 2, "SN": 2, "SP": 2})

    def strat(eid, pl, cyc):
        # V: CI every cycle
        if pl["V"].rp >= 3:
            counter_intel(ctx, eid, pl["V"])
        t = reachable_target(pl["V"], ["SN", "SP"], pl)
        if t and pl["V"].rp >= 3:
            deploy(ctx, eid, pl["V"], "spy", t, pl)
        # SN: CI every 3 cycles
        if cyc % 3 == 0 and pl["SN"].rp >= 3:
            counter_intel(ctx, eid, pl["SN"])
        t = reachable_target(pl["SN"], ["V", "SP"], pl)
        if t and pl["SN"].rp >= 5 and pl[t].buildings:
            deploy(ctx, eid, pl["SN"], "saboteur", t, pl, pl[t].buildings[0]["id"], "building")
        # SP: no CI, all offense
        for target in ["V", "SN"]:
            t = reachable_target(pl["SP"], [target], pl)
            if t and pl["SP"].rp >= 4:
                deploy(ctx, eid, pl["SP"], "propagandist", target, pl)
                break

    run_competition(ctx, epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(ctx, epoch_id, players, admin, 17, 20, strat)
    return finish_game(ctx, epoch_id, admin, players, "G8: CI Heavy",
                       "V=CI every cycle, SN=CI every 3, SP=no CI (all offense)", tags)


def game_09(token):
    """V/GR/SN — High RP, multi-ops"""
    ctx = reset_game_state()
    tags = ["V", "GR", "SN"]
    config = {**BASE_CONFIG, "rp_per_cycle": 25, "rp_cap": 75}
    epoch_id, players, admin = setup_game(ctx, token, "G9: High RP FFA", config, tags)
    last = run_foundation(ctx, epoch_id, players, admin, {"V": 2, "GR": 2, "SN": 2})

    def strat(eid, pl, cyc):
        for tag in tags:
            others = [t for t in tags if t != tag]
            t = reachable_target(pl[tag], others, pl)
            if not t:
                continue
            if pl[tag].rp >= 8 and pl[t].agents:
                deploy(ctx, eid, pl[tag], "assassin", t, pl, pl[t].agents[0]["id"], "agent")
            t2_tag = [x for x in others if x != t]
            t2 = reachable_target(pl[tag], t2_tag, pl) if t2_tag else None
            if t2 and pl[tag].rp >= 5 and pl[t2].buildings:
                deploy(ctx, eid, pl[tag], "saboteur", t2, pl, pl[t2].buildings[0]["id"], "building")
            if pl[tag].rp >= 3:
                deploy(ctx, eid, pl[tag], "spy", t, pl)

    run_competition(ctx, epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(ctx, epoch_id, players, admin, 17, 20, strat)
    return finish_game(ctx, epoch_id, admin, players, "G9: High RP FFA",
                       "V/GR/SN, 25 RP/cycle, multi-ops per cycle", tags)


def game_10(token):
    """V/GR/SP — Builder preset"""
    ctx = reset_game_state()
    tags = ["V", "GR", "SP"]
    config = {
        **BASE_CONFIG,
        "score_weights": {"stability": 40, "influence": 15, "sovereignty": 15, "diplomatic": 10, "military": 20},
    }
    epoch_id, players, admin = setup_game(ctx, token, "G10: Builder FFA", config, tags)
    last = run_foundation(ctx, epoch_id, players, admin, {"V": 3, "GR": 1, "SP": 1}, cycles=4)

    def strat(eid, pl, cyc):
        # V: defensive builder
        if cyc % 4 == 0:
            t = reachable_target(pl["V"], ["GR", "SP"], pl)
            if t and pl["V"].rp >= 3:
                deploy(ctx, eid, pl["V"], "spy", t, pl)
        # GR+SP: raiders
        for tag in ["GR", "SP"]:
            t = reachable_target(pl[tag], ["V"], pl)
            if t and pl[tag].rp >= 5 and pl["V"].buildings:
                idx = cyc % len(pl["V"].buildings)
                deploy(ctx, eid, pl[tag], "saboteur", "V", pl, pl["V"].buildings[idx]["id"], "building")

    run_competition(ctx, epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(ctx, epoch_id, players, admin, 17, 20, strat)
    return finish_game(ctx, epoch_id, admin, players, "G10: Builder FFA",
                       "V=3 guards (builder), GR+SP=1 guard (raiders), stability=40%", tags)


if __name__ == "__main__":
    set_active_tags(["V", "GR", "SN", "SP"])
    run_battery(
        "10 Games — 3 Players",
        3,
        [game_01, game_02, game_03, game_04, game_05,
         game_06, game_07, game_08, game_09, game_10],
        "/Users/mleihs/Dev/velgarien-rebuild/epoch-3p-simulation.log",
        "/Users/mleihs/Dev/velgarien-rebuild/epoch-3p-analysis.md",
    )
