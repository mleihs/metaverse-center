#!/usr/bin/env python3.13
"""
5-Player Epoch Simulation — 10 Games
======================================
Tests 5-player dynamics: larger battles, more complex alliances,
diplomatic web effects. Uses Nova Meridian as 5th simulation.
"""

import sys
sys.path.insert(0, "/Users/mleihs/Dev/velgarien-rebuild/scripts")

from epoch_sim_lib import (
    reset_game_state, setup_game, finish_game, deploy, counter_intel,
    run_foundation, run_competition, run_reckoning, reachable_target,
    log, action_log, run_battery, set_active_tags, _current_phase,
    api_join_team,
)

TAGS_5 = ["V", "CK", "SN", "SP", "NM"]

BASE_CONFIG = {"rp_per_cycle": 15, "rp_cap": 50, "cycle_hours": 2, "duration_days": 14,
               "foundation_pct": 15, "reckoning_pct": 15, "max_team_size": 4, "allow_betrayal": True,
               "score_weights": {"stability": 25, "influence": 20, "sovereignty": 20, "diplomatic": 15, "military": 20}}


def game_01(token):
    """All 5 — Balanced free-for-all"""
    reset_game_state()
    epoch_id, players, admin = setup_game(token, "G1: 5P Free-for-All", BASE_CONFIG, TAGS_5)
    last = run_foundation(epoch_id, players, admin, {t: 2 for t in TAGS_5})

    def strat(eid, pl, cyc):
        for tag in TAGS_5:
            others = [t for t in TAGS_5 if t != tag]
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
    return finish_game(epoch_id, admin, players, "G1: 5P Free-for-All",
                       "All 5 players, 2 guardians each, rotating ops", TAGS_5)


def game_02(token):
    """3v2 alliance war"""
    reset_game_state()
    epoch_id, players, admin = setup_game(token, "G2: 3v2 Alliance", BASE_CONFIG, TAGS_5,
                                          alliances={"Triple Entente": ("V", "CK"),
                                                     "Dual Pact": ("SN", "SP")})
    # NM joins Triple Entente
    resp = api_join_team(epoch_id, players, "NM", "V")
    last = run_foundation(epoch_id, players, admin, {t: 2 for t in TAGS_5})

    def strat(eid, pl, cyc):
        # V+CK+NM attack SN+SP
        for tag in ["V", "CK", "NM"]:
            t = reachable_target(pl[tag], ["SN", "SP"], pl)
            if t and pl[tag].rp >= 5 and pl[t].buildings:
                deploy(eid, pl[tag], "saboteur", t, pl, pl[t].buildings[0]["id"], "building")
            elif t and pl[tag].rp >= 3:
                deploy(eid, pl[tag], "spy", t, pl)
        # SN+SP attack V+CK+NM
        for tag in ["SN", "SP"]:
            t = reachable_target(pl[tag], ["V", "CK", "NM"], pl)
            if t and pl[tag].rp >= 5 and pl[t].buildings:
                deploy(eid, pl[tag], "saboteur", t, pl, pl[t].buildings[0]["id"], "building")
            elif t and pl[tag].rp >= 3:
                deploy(eid, pl[tag], "spy", t, pl)

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G2: 3v2 Alliance",
                       "V+CK+NM (3) vs SN+SP (2), alliance war", TAGS_5)


def game_03(token):
    """Warmonger FFA — military=40%, 1 guardian"""
    reset_game_state()
    config = {**BASE_CONFIG, "rp_per_cycle": 20, "rp_cap": 60,
              "score_weights": {"stability": 15, "influence": 15, "sovereignty": 15, "diplomatic": 15, "military": 40}}
    epoch_id, players, admin = setup_game(token, "G3: 5P Warmonger", config, TAGS_5)
    last = run_foundation(epoch_id, players, admin, {t: 1 for t in TAGS_5}, cycles=2)

    def strat(eid, pl, cyc):
        for tag in TAGS_5:
            others = [t for t in TAGS_5 if t != tag]
            t = reachable_target(pl[tag], others, pl)
            if not t: continue
            if cyc % 2 == 0 and pl[tag].rp >= 8 and pl[t].agents:
                deploy(eid, pl[tag], "assassin", t, pl, pl[t].agents[0]["id"], "agent")
            elif pl[tag].rp >= 5 and pl[t].buildings:
                deploy(eid, pl[tag], "saboteur", t, pl, pl[t].buildings[0]["id"], "building")

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G3: 5P Warmonger",
                       "All 5, military=40%, 1 guardian, assassins+saboteurs", TAGS_5)


def game_04(token):
    """Dogpile NM — 4 players gang up on newcomer"""
    reset_game_state()
    epoch_id, players, admin = setup_game(token, "G4: Dogpile NM", BASE_CONFIG, TAGS_5)
    last = run_foundation(epoch_id, players, admin, {t: 2 for t in TAGS_5})

    def strat(eid, pl, cyc):
        # V, CK, SN, SP all attack NM
        for tag in ["V", "CK", "SN", "SP"]:
            t = reachable_target(pl[tag], ["NM"], pl)
            if t and pl[tag].rp >= 5 and pl["NM"].buildings:
                deploy(eid, pl[tag], "saboteur", "NM", pl, pl["NM"].buildings[0]["id"], "building")
            elif t and pl[tag].rp >= 3:
                deploy(eid, pl[tag], "spy", "NM", pl)
        # NM fights back against random
        for target in ["V", "CK", "SN", "SP"]:
            t = reachable_target(pl["NM"], [target], pl)
            if t and pl["NM"].rp >= 4:
                deploy(eid, pl["NM"], "propagandist", target, pl)
                break

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G4: Dogpile NM",
                       "4 players gang up on NM, NM fights back against random targets", TAGS_5)


def game_05(token):
    """Diplomat preset — diplomatic=30%"""
    reset_game_state()
    config = {**BASE_CONFIG, "score_weights": {"stability": 15, "influence": 20, "sovereignty": 20, "diplomatic": 30, "military": 15}}
    epoch_id, players, admin = setup_game(token, "G5: 5P Diplomat", config, TAGS_5)
    last = run_foundation(epoch_id, players, admin, {t: 2 for t in TAGS_5})

    def strat(eid, pl, cyc):
        for tag in TAGS_5:
            others = [t for t in TAGS_5 if t != tag]
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
    return finish_game(epoch_id, admin, players, "G5: 5P Diplomat",
                       "All 5, diplomatic=30%, infiltrator-heavy", TAGS_5)


def game_06(token):
    """No guardians — pure chaos"""
    reset_game_state()
    epoch_id, players, admin = setup_game(token, "G6: 5P No Guards", BASE_CONFIG, TAGS_5)
    last = run_foundation(epoch_id, players, admin, {t: 0 for t in TAGS_5}, cycles=2)

    def strat(eid, pl, cyc):
        for tag in TAGS_5:
            others = [t for t in TAGS_5 if t != tag]
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
    return finish_game(epoch_id, admin, players, "G6: 5P No Guards",
                       "All 5, zero guardians, pure offensive chaos", TAGS_5)


def game_07(token):
    """High RP multi-ops"""
    reset_game_state()
    config = {**BASE_CONFIG, "rp_per_cycle": 25, "rp_cap": 75}
    epoch_id, players, admin = setup_game(token, "G7: 5P High RP", config, TAGS_5)
    last = run_foundation(epoch_id, players, admin, {t: 2 for t in TAGS_5})

    def strat(eid, pl, cyc):
        for tag in TAGS_5:
            others = [t for t in TAGS_5 if t != tag]
            t = reachable_target(pl[tag], others, pl)
            if not t: continue
            if pl[tag].rp >= 8 and pl[t].agents:
                deploy(eid, pl[tag], "assassin", t, pl, pl[t].agents[0]["id"], "agent")
            t2_list = [x for x in others if x != t]
            t2 = reachable_target(pl[tag], t2_list, pl)
            if t2 and pl[tag].rp >= 5 and pl[t2].buildings:
                deploy(eid, pl[tag], "saboteur", t2, pl, pl[t2].buildings[0]["id"], "building")
            if pl[tag].rp >= 4:
                deploy(eid, pl[tag], "propagandist", t, pl)

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G7: 5P High RP",
                       "All 5, 25 RP/cycle, multi-ops per cycle", TAGS_5)


def game_08(token):
    """CI heavy + mixed"""
    reset_game_state()
    epoch_id, players, admin = setup_game(token, "G8: 5P CI Mixed", BASE_CONFIG, TAGS_5)
    last = run_foundation(epoch_id, players, admin, {t: 2 for t in TAGS_5})

    def strat(eid, pl, cyc):
        # V + NM: CI every 2 cycles
        for tag in ["V", "NM"]:
            if cyc % 2 == 0 and pl[tag].rp >= 3:
                counter_intel(eid, pl[tag])
            others = [t for t in TAGS_5 if t != tag]
            t = reachable_target(pl[tag], others, pl)
            if t and pl[tag].rp >= 3:
                deploy(eid, pl[tag], "spy", t, pl)
        # CK, SN, SP: pure offense
        for tag in ["CK", "SN", "SP"]:
            others = [t for t in TAGS_5 if t != tag]
            t = reachable_target(pl[tag], others, pl)
            if t and pl[tag].rp >= 5 and pl[t].buildings:
                deploy(eid, pl[tag], "saboteur", t, pl, pl[t].buildings[0]["id"], "building")
            elif t and pl[tag].rp >= 4:
                deploy(eid, pl[tag], "propagandist", t, pl)

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G8: 5P CI Mixed",
                       "V+NM=CI every 2 cycles, CK/SN/SP=pure offense", TAGS_5)


def game_09(token):
    """Builder preset — stability=40%"""
    reset_game_state()
    config = {**BASE_CONFIG, "score_weights": {"stability": 40, "influence": 15, "sovereignty": 15, "diplomatic": 10, "military": 20}}
    epoch_id, players, admin = setup_game(token, "G9: 5P Builder", config, TAGS_5)
    last = run_foundation(epoch_id, players, admin, {"V": 3, "CK": 3, "SN": 1, "SP": 1, "NM": 2}, cycles=4)

    def strat(eid, pl, cyc):
        # V+CK: builders, rare attacks
        for tag in ["V", "CK"]:
            if cyc % 4 == 0:
                t = reachable_target(pl[tag], ["SN", "SP", "NM"], pl)
                if t and pl[tag].rp >= 3:
                    deploy(eid, pl[tag], "spy", t, pl)
        # SN+SP: raiders targeting builders
        for tag in ["SN", "SP"]:
            t = reachable_target(pl[tag], ["V", "CK"], pl)
            if t and pl[tag].rp >= 5 and pl[t].buildings:
                idx = cyc % len(pl[t].buildings)
                deploy(eid, pl[tag], "saboteur", t, pl, pl[t].buildings[idx]["id"], "building")
        # NM: balanced
        t = reachable_target(pl["NM"], ["V", "CK", "SN", "SP"], pl)
        if t and pl["NM"].rp >= 4:
            deploy(eid, pl["NM"], "propagandist", t, pl)

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G9: 5P Builder",
                       "V+CK=3g builders, SN+SP=1g raiders, NM=2g balanced, stability=40%", TAGS_5)


def game_10(token):
    """Betrayal + shifting alliances"""
    reset_game_state()
    epoch_id, players, admin = setup_game(token, "G10: 5P Betrayal", BASE_CONFIG, TAGS_5,
                                          alliances={"Shadow Pact": ("SN", "SP")})
    last = run_foundation(epoch_id, players, admin, {t: 2 for t in TAGS_5})

    def strat(eid, pl, cyc):
        # Normal FFA for most players
        for tag in ["V", "CK", "NM"]:
            others = [t for t in TAGS_5 if t != tag]
            t = reachable_target(pl[tag], others, pl)
            if t and pl[tag].rp >= 4:
                deploy(eid, pl[tag], "propagandist", t, pl)

        # SN+SP alliance until cycle 12
        if cyc < 12:
            for tag in ["SN", "SP"]:
                targets = [t for t in ["V", "CK", "NM"]]
                t = reachable_target(pl[tag], targets, pl)
                if t and pl[tag].rp >= 5 and pl[t].buildings:
                    deploy(eid, pl[tag], "saboteur", t, pl, pl[t].buildings[0]["id"], "building")
        elif cyc == 12:
            log("  *** BETRAYAL: SP attacks ally SN! ***")
            action_log(cyc, _current_phase, "SP", "BETRAYAL", "SP attacks allied SN!", "TREACHERY")
            t = reachable_target(pl["SP"], ["SN"], pl)
            if t and pl["SP"].rp >= 8 and pl["SN"].agents:
                deploy(eid, pl["SP"], "assassin", "SN", pl, pl["SN"].agents[0]["id"], "agent")
            if t and pl["SP"].rp >= 5 and pl["SN"].buildings:
                deploy(eid, pl["SP"], "saboteur", "SN", pl, pl["SN"].buildings[0]["id"], "building")
            # SN still attacks enemies
            t = reachable_target(pl["SN"], ["V", "CK", "NM"], pl)
            if t and pl["SN"].rp >= 3:
                deploy(eid, pl["SN"], "spy", t, pl)
        else:
            # Post-betrayal: free-for-all
            for tag in ["SN", "SP"]:
                others = [t for t in TAGS_5 if t != tag]
                t = reachable_target(pl[tag], others, pl)
                if t and pl[tag].rp >= 3:
                    deploy(eid, pl[tag], "spy", t, pl)

    run_competition(epoch_id, players, admin, last+1, 16, strat)
    run_reckoning(epoch_id, players, admin, 17, 20, strat)
    return finish_game(epoch_id, admin, players, "G10: 5P Betrayal",
                       "SN+SP alliance, SP betrays SN on cycle 12, FFA + V/CK/NM independent", TAGS_5)


if __name__ == "__main__":
    set_active_tags(TAGS_5)
    run_battery(
        "10 Games — 5 Players",
        5,
        [game_01, game_02, game_03, game_04, game_05,
         game_06, game_07, game_08, game_09, game_10],
        "/Users/mleihs/Dev/velgarien-rebuild/epoch-5p-simulation.log",
        "/Users/mleihs/Dev/velgarien-rebuild/epoch-5p-analysis.md",
    )
