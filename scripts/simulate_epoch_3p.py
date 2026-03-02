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
    log, action_log, run_battery, set_active_tags, _current_phase,
)

BASE_CONFIG = {"rp_per_cycle": 15, "rp_cap": 50, "cycle_hours": 2, "duration_days": 14,
               "foundation_pct": 15, "reckoning_pct": 15, "max_team_size": 4, "allow_betrayal": True,
               "score_weights": {"stability": 25, "influence": 20, "sovereignty": 20, "diplomatic": 15, "military": 20}}


def game_01(token):
    """V/CK/SN — Balanced free-for-all"""
    reset_game_state()
    tags = ["V", "CK", "SN"]
    epoch_id, players, admin = setup_game(token, "G1: Free-for-All", BASE_CONFIG, tags)
    last = run_foundation(epoch_id, players, admin, {"V": 2, "CK": 2, "SN": 2})

    def strat(eid, pl, cyc):
        for tag in tags:
            others = [t for t in tags if t != tag]
            t = reachable_target(pl[tag], others, pl)
            if not t: continue
            if cyc % 3 == 0 and pl[tag].rp >= 5 and pl[t].buildings:
                deploy(eid, pl[tag], "saboteur", t, pl, pl[t].buildings[0]["id"], "building")
            elif cyc % 3 == 1 and pl[tag].rp >= 4:
                deploy(eid, pl[tag], "propagandist", t, pl)
            elif pl[tag].rp >= 3:
                deploy(eid, pl[tag], "spy", t, pl)

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G1: Free-for-All",
                       "V/CK/SN, 2 guardians each, mixed ops, every player attacks random other", tags)


def game_02(token):
    """V/CK/SP — Alliance V+CK vs SP"""
    reset_game_state()
    tags = ["V", "CK", "SP"]
    epoch_id, players, admin = setup_game(token, "G2: 2v1 Alliance", BASE_CONFIG, tags,
                                          alliances={"Iron Pact": ("V", "CK")})
    last = run_foundation(epoch_id, players, admin, {"V": 2, "CK": 2, "SP": 2})

    def strat(eid, pl, cyc):
        # V+CK focus SP
        for tag in ["V", "CK"]:
            t = reachable_target(pl[tag], ["SP"], pl)
            if t and pl[tag].rp >= 5 and pl["SP"].buildings:
                deploy(eid, pl[tag], "saboteur", "SP", pl, pl["SP"].buildings[0]["id"], "building")
            elif t and pl[tag].rp >= 3:
                deploy(eid, pl[tag], "spy", "SP", pl)
        # SP attacks both
        for target in ["V", "CK"]:
            t = reachable_target(pl["SP"], [target], pl)
            if t and pl["SP"].rp >= 4:
                deploy(eid, pl["SP"], "propagandist", target, pl)
                break

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G2: 2v1 Alliance",
                       "V+CK allied vs SP alone, focused fire on SP", tags)


def game_03(token):
    """CK/SN/SP — Heavy offense, 1 guardian"""
    reset_game_state()
    tags = ["CK", "SN", "SP"]
    config = {**BASE_CONFIG, "rp_per_cycle": 20, "rp_cap": 60,
              "score_weights": {"stability": 15, "influence": 15, "sovereignty": 15, "diplomatic": 15, "military": 40}}
    epoch_id, players, admin = setup_game(token, "G3: Warmonger FFA", config, tags)
    last = run_foundation(epoch_id, players, admin, {"CK": 1, "SN": 1, "SP": 1}, cycles=2)

    def strat(eid, pl, cyc):
        for tag in tags:
            others = [t for t in tags if t != tag]
            t = reachable_target(pl[tag], others, pl)
            if not t: continue
            if cyc % 2 == 0 and pl[tag].rp >= 8 and pl[t].agents:
                deploy(eid, pl[tag], "assassin", t, pl, pl[t].agents[0]["id"], "agent")
            elif pl[tag].rp >= 5 and pl[t].buildings:
                deploy(eid, pl[tag], "saboteur", t, pl, pl[t].buildings[0]["id"], "building")

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G3: Warmonger FFA",
                       "CK/SN/SP, 1 guardian each, military=40%, assassins+saboteurs", tags)


def game_04(token):
    """V/SN/SP — Diplomatic preset"""
    reset_game_state()
    tags = ["V", "SN", "SP"]
    config = {**BASE_CONFIG, "score_weights": {"stability": 15, "influence": 20, "sovereignty": 20, "diplomatic": 30, "military": 15}}
    epoch_id, players, admin = setup_game(token, "G4: Diplomat FFA", config, tags)
    last = run_foundation(epoch_id, players, admin, {"V": 2, "SN": 2, "SP": 2})

    def strat(eid, pl, cyc):
        for tag in tags:
            others = [t for t in tags if t != tag]
            t = reachable_target(pl[tag], others, pl)
            if not t: continue
            if cyc % 3 == 0 and pl[tag].rp >= 6:
                emb = next(iter(pl[t].embassies.values()), None)
                if emb:
                    deploy(eid, pl[tag], "infiltrator", t, pl, emb, "embassy")
            elif pl[tag].rp >= 3:
                deploy(eid, pl[tag], "spy", t, pl)

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G4: Diplomat FFA",
                       "V/SN/SP, diplomatic=30%, infiltrator-heavy", tags)


def game_05(token):
    """V/CK/SN — Dogpile V (CK+SN both target V)"""
    reset_game_state()
    tags = ["V", "CK", "SN"]
    epoch_id, players, admin = setup_game(token, "G5: Dogpile", BASE_CONFIG, tags)
    last = run_foundation(epoch_id, players, admin, {"V": 2, "CK": 2, "SN": 2})

    def strat(eid, pl, cyc):
        # CK + SN both attack V
        for tag in ["CK", "SN"]:
            t = reachable_target(pl[tag], ["V"], pl)
            if t and pl[tag].rp >= 5 and pl["V"].buildings:
                deploy(eid, pl[tag], "saboteur", "V", pl, pl["V"].buildings[0]["id"], "building")
            elif t and pl[tag].rp >= 3:
                deploy(eid, pl[tag], "spy", "V", pl)
        # V fights back against both
        for target in ["CK", "SN"]:
            t = reachable_target(pl["V"], [target], pl)
            if t and pl["V"].rp >= 4:
                deploy(eid, pl["V"], "propagandist", target, pl)
                break

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G5: Dogpile",
                       "CK+SN both target V (2v1 without alliance), V fights back", tags)


def game_06(token):
    """V/CK/SP — Betrayal (V betrays ally CK mid-game)"""
    reset_game_state()
    tags = ["V", "CK", "SP"]
    epoch_id, players, admin = setup_game(token, "G6: Betrayal", BASE_CONFIG, tags,
                                          alliances={"Grand Alliance": ("V", "CK")})
    last = run_foundation(epoch_id, players, admin, {"V": 2, "CK": 2, "SP": 2})

    def strat(eid, pl, cyc):
        # SP attacks both
        for target in ["V", "CK"]:
            t = reachable_target(pl["SP"], [target], pl)
            if t and pl["SP"].rp >= 4:
                deploy(eid, pl["SP"], "propagandist", target, pl)
                break
        # CK attacks SP
        t = reachable_target(pl["CK"], ["SP"], pl)
        if t and pl["CK"].rp >= 3:
            deploy(eid, pl["CK"], "spy", "SP", pl)
        # V attacks SP pre-betrayal, then betrays CK on cycle 10
        if cyc < 10:
            t = reachable_target(pl["V"], ["SP"], pl)
            if t and pl["V"].rp >= 3:
                deploy(eid, pl["V"], "spy", "SP", pl)
        elif cyc == 10:
            log("  *** BETRAYAL: V attacks ally CK! ***")
            action_log(cyc, _current_phase, "V", "BETRAYAL", "V attacks allied CK!", "TREACHERY")
            t = reachable_target(pl["V"], ["CK"], pl)
            if t and pl["V"].rp >= 8 and pl["CK"].agents:
                deploy(eid, pl["V"], "assassin", "CK", pl, pl["CK"].agents[0]["id"], "agent")
            if t and pl["V"].rp >= 5 and pl["CK"].buildings:
                deploy(eid, pl["V"], "saboteur", "CK", pl, pl["CK"].buildings[0]["id"], "building")
        else:
            # Post-betrayal: V attacks both
            for target in ["CK", "SP"]:
                t = reachable_target(pl["V"], [target], pl)
                if t and pl["V"].rp >= 3:
                    deploy(eid, pl["V"], "spy", target, pl)
                    break

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G6: Betrayal",
                       "V+CK alliance, V betrays CK on cycle 10 (assassin+saboteur)", tags)


def game_07(token):
    """CK/SN/SP — No guardians"""
    reset_game_state()
    tags = ["CK", "SN", "SP"]
    epoch_id, players, admin = setup_game(token, "G7: No Guardians", BASE_CONFIG, tags)
    last = run_foundation(epoch_id, players, admin, {"CK": 0, "SN": 0, "SP": 0}, cycles=2)

    def strat(eid, pl, cyc):
        for tag in tags:
            others = [t for t in tags if t != tag]
            t = reachable_target(pl[tag], others, pl)
            if not t: continue
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
    return finish_game(epoch_id, admin, players, "G7: No Guardians",
                       "CK/SN/SP, zero guardians, pure offense FFA", tags)


def game_08(token):
    """V/SN/SP — Counter-intel heavy"""
    reset_game_state()
    tags = ["V", "SN", "SP"]
    epoch_id, players, admin = setup_game(token, "G8: CI Heavy", BASE_CONFIG, tags)
    last = run_foundation(epoch_id, players, admin, {"V": 2, "SN": 2, "SP": 2})

    def strat(eid, pl, cyc):
        # V: CI every cycle
        if pl["V"].rp >= 3:
            counter_intel(eid, pl["V"])
        t = reachable_target(pl["V"], ["SN", "SP"], pl)
        if t and pl["V"].rp >= 3:
            deploy(eid, pl["V"], "spy", t, pl)
        # SN: CI every 3 cycles
        if cyc % 3 == 0 and pl["SN"].rp >= 3:
            counter_intel(eid, pl["SN"])
        t = reachable_target(pl["SN"], ["V", "SP"], pl)
        if t and pl["SN"].rp >= 5 and pl[t].buildings:
            deploy(eid, pl["SN"], "saboteur", t, pl, pl[t].buildings[0]["id"], "building")
        # SP: no CI, all offense
        for target in ["V", "SN"]:
            t = reachable_target(pl["SP"], [target], pl)
            if t and pl["SP"].rp >= 4:
                deploy(eid, pl["SP"], "propagandist", target, pl)
                break

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G8: CI Heavy",
                       "V=CI every cycle, SN=CI every 3, SP=no CI (all offense)", tags)


def game_09(token):
    """V/CK/SN — High RP, multi-ops"""
    reset_game_state()
    tags = ["V", "CK", "SN"]
    config = {**BASE_CONFIG, "rp_per_cycle": 25, "rp_cap": 75}
    epoch_id, players, admin = setup_game(token, "G9: High RP FFA", config, tags)
    last = run_foundation(epoch_id, players, admin, {"V": 2, "CK": 2, "SN": 2})

    def strat(eid, pl, cyc):
        for tag in tags:
            others = [t for t in tags if t != tag]
            t = reachable_target(pl[tag], others, pl)
            if not t: continue
            if pl[tag].rp >= 8 and pl[t].agents:
                deploy(eid, pl[tag], "assassin", t, pl, pl[t].agents[0]["id"], "agent")
            t2_tag = [x for x in others if x != t]
            t2 = reachable_target(pl[tag], t2_tag, pl) if t2_tag else None
            if t2 and pl[tag].rp >= 5 and pl[t2].buildings:
                deploy(eid, pl[tag], "saboteur", t2, pl, pl[t2].buildings[0]["id"], "building")
            if pl[tag].rp >= 3:
                deploy(eid, pl[tag], "spy", t, pl)

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G9: High RP FFA",
                       "V/CK/SN, 25 RP/cycle, multi-ops per cycle", tags)


def game_10(token):
    """V/CK/SP — Builder preset"""
    reset_game_state()
    tags = ["V", "CK", "SP"]
    config = {**BASE_CONFIG, "score_weights": {"stability": 40, "influence": 15, "sovereignty": 15, "diplomatic": 10, "military": 20}}
    epoch_id, players, admin = setup_game(token, "G10: Builder FFA", config, tags)
    last = run_foundation(epoch_id, players, admin, {"V": 3, "CK": 1, "SP": 1}, cycles=4)

    def strat(eid, pl, cyc):
        # V: defensive builder
        if cyc % 4 == 0:
            t = reachable_target(pl["V"], ["CK", "SP"], pl)
            if t and pl["V"].rp >= 3:
                deploy(eid, pl["V"], "spy", t, pl)
        # CK+SP: raiders
        for tag in ["CK", "SP"]:
            t = reachable_target(pl[tag], ["V"], pl)
            if t and pl[tag].rp >= 5 and pl["V"].buildings:
                idx = cyc % len(pl["V"].buildings)
                deploy(eid, pl[tag], "saboteur", "V", pl, pl["V"].buildings[idx]["id"], "building")

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G10: Builder FFA",
                       "V=3 guards (builder), CK+SP=1 guard (raiders), stability=40%", tags)


if __name__ == "__main__":
    set_active_tags(["V", "CK", "SN", "SP"])
    run_battery(
        "10 Games — 3 Players",
        3,
        [game_01, game_02, game_03, game_04, game_05,
         game_06, game_07, game_08, game_09, game_10],
        "/Users/mleihs/Dev/velgarien-rebuild/epoch-3p-simulation.log",
        "/Users/mleihs/Dev/velgarien-rebuild/epoch-3p-analysis.md",
    )
