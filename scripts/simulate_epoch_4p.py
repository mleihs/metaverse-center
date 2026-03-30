#!/usr/bin/env python3.13
"""
4-Player Epoch Simulation — 10 Games
======================================
Tests 4-player dynamics: alliances, betrayals, asymmetric guardians,
counter-intel, and varied scoring presets.
"""

import sys
sys.path.insert(0, "/Users/mleihs/Dev/velgarien-rebuild/scripts")

from epoch_sim_lib import (
    reset_game_state, setup_game, finish_game, deploy, counter_intel,
    run_foundation, run_competition, run_reckoning, reachable_target,
    log, action_log, run_battery, set_active_tags, _current_phase,
)

TAGS_4 = ["V", "GR", "SN", "SP"]

BASE_CONFIG = {"rp_per_cycle": 15, "rp_cap": 50, "cycle_hours": 2, "duration_days": 14,
               "foundation_pct": 15, "reckoning_pct": 15, "max_team_size": 4, "allow_betrayal": True,
               "score_weights": {"stability": 25, "influence": 20, "sovereignty": 20, "diplomatic": 15, "military": 20}}


def game_01(token):
    """G1: Max defense (6g) vs zero defense, all offense"""
    reset_game_state()
    epoch_id, players, admin = setup_game(token, "G1: Fortress vs Blitz", BASE_CONFIG, TAGS_4)
    last = run_foundation(epoch_id, players, admin, {"V": 6, "GR": 0, "SN": 2, "SP": 2})

    def strat(eid, pl, cyc):
        # GR (0 guardians) attacks everyone
        for t_tag in ["V", "SN", "SP"]:
            t = reachable_target(pl["GR"], [t_tag], pl)
            if t and pl["GR"].rp >= 5 and pl[t].buildings:
                deploy(eid, pl["GR"], "saboteur", t, pl, pl[t].buildings[0]["id"], "building")
            if t and pl["GR"].rp >= 3:
                deploy(eid, pl["GR"], "spy", t, pl)
        # V, SN, SP: light offense
        for tag in ["V", "SN", "SP"]:
            others = [x for x in TAGS_4 if x != tag]
            t = reachable_target(pl[tag], others, pl)
            if t and cyc % 2 == 0 and pl[tag].rp >= 3:
                deploy(eid, pl[tag], "spy", t, pl)

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G1: Fortress vs Blitz",
                       "V=6 guardians (turtle), GR=0 guardians (glass cannon), SN/SP=2 each", TAGS_4)


def game_02(token):
    """G2: All players equal (2 guardians, mixed ops)"""
    reset_game_state()
    epoch_id, players, admin = setup_game(token, "G2: Balanced", BASE_CONFIG, TAGS_4)
    last = run_foundation(epoch_id, players, admin, {"V": 2, "GR": 2, "SN": 2, "SP": 2})

    def strat(eid, pl, cyc):
        for tag in TAGS_4:
            others = [x for x in TAGS_4 if x != tag]
            t = reachable_target(pl[tag], others, pl)
            if not t:
                continue
            if cyc % 3 == 0 and pl[tag].rp >= 5 and pl[t].buildings:
                deploy(eid, pl[tag], "saboteur", t, pl, pl[t].buildings[0]["id"], "building")
            elif cyc % 3 == 1 and pl[tag].rp >= 4:
                deploy(eid, pl[tag], "propagandist", t, pl)
            elif pl[tag].rp >= 3:
                deploy(eid, pl[tag], "spy", t, pl)

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G2: Balanced",
                       "All players: 2 guardians, rotating saboteur/propagandist/spy", TAGS_4)


def game_03(token):
    """G3: Military 40% weight, heavy assassin usage"""
    reset_game_state()
    config = {**BASE_CONFIG, "rp_per_cycle": 20, "rp_cap": 60,
              "foundation_pct": 10, "reckoning_pct": 20,
              "score_weights": {"stability": 15, "influence": 15, "sovereignty": 15, "diplomatic": 15, "military": 40}}
    epoch_id, players, admin = setup_game(token, "G3: Warmonger", config, TAGS_4)
    last = run_foundation(epoch_id, players, admin, {"V": 1, "GR": 1, "SN": 1, "SP": 1}, cycles=2)

    def strat(eid, pl, cyc):
        for tag in TAGS_4:
            others = [x for x in TAGS_4 if x != tag]
            t = reachable_target(pl[tag], others, pl)
            if not t:
                continue
            if cyc % 2 == 0 and pl[tag].rp >= 8 and pl[t].agents:
                deploy(eid, pl[tag], "assassin", t, pl, pl[t].agents[0]["id"], "agent")
            elif pl[tag].rp >= 5 and pl[t].buildings:
                deploy(eid, pl[tag], "saboteur", t, pl, pl[t].buildings[0]["id"], "building")

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G3: Warmonger",
                       "Military=40% weight, 1 guardian each, alternating assassin/saboteur", TAGS_4)


def game_04(token):
    """G4: 2v2 alliance, each team focuses fire on the other"""
    reset_game_state()
    epoch_id, players, admin = setup_game(token, "G4: Alliance War 2v2", BASE_CONFIG, TAGS_4,
                                          alliances={"Iron Pact": ("V", "GR"), "Shadow Accord": ("SN", "SP")})
    last = run_foundation(epoch_id, players, admin, {"V": 2, "GR": 2, "SN": 2, "SP": 2})

    def strat(eid, pl, cyc):
        pairs = [("V", ["SN", "SP"]), ("GR", ["SN", "SP"]), ("SN", ["V", "GR"]), ("SP", ["V", "GR"])]
        for tag, targets in pairs:
            t = reachable_target(pl[tag], targets, pl)
            if not t:
                continue
            if pl[tag].rp >= 5 and pl[t].buildings:
                deploy(eid, pl[tag], "saboteur", t, pl, pl[t].buildings[0]["id"], "building")
            if pl[tag].rp >= 3:
                deploy(eid, pl[tag], "spy", t, pl)

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G4: Alliance War 2v2",
                       "V+GR vs SN+SP, focused fire on opposing alliance", TAGS_4)


def game_05(token):
    """G5: Alliance + planned betrayal mid-game"""
    reset_game_state()
    epoch_id, players, admin = setup_game(token, "G5: Betrayal", BASE_CONFIG, TAGS_4,
                                          alliances={"Pact of Shadows": ("SN", "SP")})
    last = run_foundation(epoch_id, players, admin, {"V": 2, "GR": 2, "SN": 2, "SP": 2})

    def strat(eid, pl, cyc):
        for tag in ["V", "GR", "SN"]:
            others = [x for x in TAGS_4 if x != tag]
            t = reachable_target(pl[tag], others, pl)
            if t and pl[tag].rp >= 4:
                deploy(eid, pl[tag], "propagandist", t, pl)

        if cyc < 12:
            t = reachable_target(pl["SP"], ["V", "GR"], pl)
            if t and pl["SP"].rp >= 4:
                deploy(eid, pl["SP"], "propagandist", t, pl)
        elif cyc == 12:
            log("  *** BETRAYAL: SP attacks ally SN! ***")
            action_log(cyc, _current_phase, "SP", "BETRAYAL", "SP attacks allied SN!", "TREACHERY")
            t = reachable_target(pl["SP"], ["SN"], pl)
            if t and pl["SP"].rp >= 8 and pl["SN"].agents:
                deploy(eid, pl["SP"], "assassin", "SN", pl, pl["SN"].agents[0]["id"], "agent")
            if t and pl["SP"].rp >= 5 and pl["SN"].buildings:
                deploy(eid, pl["SP"], "saboteur", "SN", pl, pl["SN"].buildings[0]["id"], "building")
        else:
            for t_tag in ["V", "GR", "SN"]:
                t = reachable_target(pl["SP"], [t_tag], pl)
                if t and pl["SP"].rp >= 3:
                    deploy(eid, pl["SP"], "spy", t, pl)
                    break

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G5: Betrayal",
                       "SN+SP alliance, SP betrays SN on cycle 12 (assassin+saboteur)", TAGS_4)


def game_06(token):
    """G6: Frequent counter-intel usage"""
    reset_game_state()
    epoch_id, players, admin = setup_game(token, "G6: Counter-Intel Heavy", BASE_CONFIG, TAGS_4)
    last = run_foundation(epoch_id, players, admin, {"V": 2, "GR": 2, "SN": 2, "SP": 2})

    def strat(eid, pl, cyc):
        # V: CI every 2 cycles + light offense
        if cyc % 2 == 0 and pl["V"].rp >= 3:
            counter_intel(eid, pl["V"])
        t = reachable_target(pl["V"], ["GR", "SN", "SP"], pl)
        if t and pl["V"].rp >= 3:
            deploy(eid, pl["V"], "spy", t, pl)

        # GR: all offense, no CI
        for t_tag in ["V", "SN", "SP"]:
            t = reachable_target(pl["GR"], [t_tag], pl)
            if t and pl["GR"].rp >= 5 and pl[t].buildings:
                deploy(eid, pl["GR"], "saboteur", t, pl, pl[t].buildings[0]["id"], "building")
                break

        # SN: CI every 3 cycles + infiltrators
        if cyc % 3 == 0 and pl["SN"].rp >= 3:
            counter_intel(eid, pl["SN"])
        t = reachable_target(pl["SN"], ["V", "GR"], pl)
        if t and pl["SN"].rp >= 6:
            emb = next(iter(pl[t].embassies.values()), None)
            if emb:
                deploy(eid, pl["SN"], "infiltrator", t, pl, emb, "embassy")

        # SP: all offense
        t = reachable_target(pl["SP"], ["V", "GR", "SN"], pl)
        if t and pl["SP"].rp >= 4:
            deploy(eid, pl["SP"], "propagandist", t, pl)

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G6: Counter-Intel Heavy",
                       "V=CI every 2 cycles, SN=CI every 3 cycles, GR=no CI (all offense)", TAGS_4)


def game_07(token):
    """G7: Diplomat scoring preset (diplomatic=30%)"""
    reset_game_state()
    config = {**BASE_CONFIG,
              "score_weights": {"stability": 15, "influence": 20, "sovereignty": 20, "diplomatic": 30, "military": 15}}
    epoch_id, players, admin = setup_game(token, "G7: Diplomat Preset", config, TAGS_4,
                                          alliances={"Grand Alliance": ("V", "GR")})
    last = run_foundation(epoch_id, players, admin, {"V": 2, "GR": 2, "SN": 2, "SP": 2})

    def strat(eid, pl, cyc):
        for tag in TAGS_4:
            others = [x for x in TAGS_4 if x != tag]
            t = reachable_target(pl[tag], others, pl)
            if t and cyc % 3 == 0 and pl[tag].rp >= 6:
                emb = next(iter(pl[t].embassies.values()), None)
                if emb:
                    deploy(eid, pl[tag], "infiltrator", t, pl, emb, "embassy")
            elif t and pl[tag].rp >= 3:
                deploy(eid, pl[tag], "spy", t, pl)

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G7: Diplomat Preset",
                       "Diplomatic=30% weight, V+GR alliance, infiltrator-heavy", TAGS_4)


def game_08(token):
    """G8: Max RP settings (25/cycle, 75 cap)"""
    reset_game_state()
    config = {**BASE_CONFIG, "rp_per_cycle": 25, "rp_cap": 75}
    epoch_id, players, admin = setup_game(token, "G8: High RP", config, TAGS_4)
    last = run_foundation(epoch_id, players, admin, {"V": 3, "GR": 1, "SN": 2, "SP": 2})

    def strat(eid, pl, cyc):
        for tag in TAGS_4:
            others = [x for x in TAGS_4 if x != tag]
            t = reachable_target(pl[tag], others, pl)
            if not t:
                continue
            if pl[tag].rp >= 8 and pl[t].agents:
                deploy(eid, pl[tag], "assassin", t, pl, pl[t].agents[0]["id"], "agent")
            t2 = reachable_target(pl[tag], [x for x in others if x != t], pl)
            if t2 and pl[tag].rp >= 5 and pl[t2].buildings:
                deploy(eid, pl[tag], "saboteur", t2, pl, pl[t2].buildings[0]["id"], "building")
            if pl[tag].rp >= 4:
                t3 = reachable_target(pl[tag], others, pl)
                if t3:
                    deploy(eid, pl[tag], "propagandist", t3, pl)

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G8: High RP Economy",
                       "25 RP/cycle, 75 cap — tests multi-op per cycle with varied guardians", TAGS_4)


def game_09(token):
    """G9: Zero guardians — pure offense"""
    reset_game_state()
    config = {**BASE_CONFIG, "foundation_pct": 10}
    epoch_id, players, admin = setup_game(token, "G9: No Guardians", config, TAGS_4)
    last = run_foundation(epoch_id, players, admin, {"V": 0, "GR": 0, "SN": 0, "SP": 0}, cycles=2)

    def strat(eid, pl, cyc):
        for tag in TAGS_4:
            others = [x for x in TAGS_4 if x != tag]
            t = reachable_target(pl[tag], others, pl)
            if not t:
                continue
            ops = ["spy", "saboteur", "propagandist"]
            op = ops[cyc % 3]
            if op == "saboteur" and pl[tag].rp >= 5 and pl[t].buildings:
                deploy(eid, pl[tag], "saboteur", t, pl, pl[t].buildings[0]["id"], "building")
            elif op == "propagandist" and pl[tag].rp >= 4:
                deploy(eid, pl[tag], "propagandist", t, pl)
            elif pl[tag].rp >= 3:
                deploy(eid, pl[tag], "spy", t, pl)

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G9: No Guardians",
                       "Zero guardians — pure offense, higher success probabilities", TAGS_4)


def game_10(token):
    """G10: Builder scoring preset (stability=40%)"""
    reset_game_state()
    config = {**BASE_CONFIG, "foundation_pct": 20, "reckoning_pct": 10,
              "score_weights": {"stability": 40, "influence": 15, "sovereignty": 15, "diplomatic": 10, "military": 20}}
    epoch_id, players, admin = setup_game(token, "G10: Builder Preset", config, TAGS_4)
    last = run_foundation(epoch_id, players, admin, {"V": 3, "GR": 3, "SN": 1, "SP": 1}, cycles=4)

    def strat(eid, pl, cyc):
        # V+GR: builders, rare attacks
        for tag in ["V", "GR"]:
            if cyc % 4 == 0:
                t = reachable_target(pl[tag], ["SN", "SP"], pl)
                if t and pl[tag].rp >= 3:
                    deploy(eid, pl[tag], "spy", t, pl)
        # SN+SP: raiders targeting builders
        for tag in ["SN", "SP"]:
            t = reachable_target(pl[tag], ["V", "GR"], pl)
            if t and pl[tag].rp >= 5 and pl[t].buildings:
                idx = cyc % len(pl[t].buildings)
                deploy(eid, pl[tag], "saboteur", t, pl, pl[t].buildings[idx]["id"], "building")

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G10: Builder Preset",
                       "Stability=40%, V+GR=3 guardians (builders), SN+SP=1 guardian (raiders)", TAGS_4)


if __name__ == "__main__":
    set_active_tags(TAGS_4)
    run_battery(
        "10 Games — 4 Players",
        4,
        [game_01, game_02, game_03, game_04, game_05,
         game_06, game_07, game_08, game_09, game_10],
        "/Users/mleihs/Dev/velgarien-rebuild/epoch-4p-simulation.log",
        "/Users/mleihs/Dev/velgarien-rebuild/epoch-4p-analysis.md",
    )
