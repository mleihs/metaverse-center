# Epoch "Tactical Showdown" Playtest Report -- 2026-04-14

## Setup

- **Epoch**: "Tactical Showdown" (Sprint format, 3d, 4h cycles, 18 total)
- **Phase config**: 2 Foundation + 13 Competition + 3 Reckoning = 18 cycles
- **Players**: P1 (matthias@leihs.at / Velgarien), P2 (test-player-1@test.dev / Conventional Memory)
- **Bots**: Sentinel Alpha (SNTL, The Gaslit Reach), Warlord Omega (WLRD, Station Null)
- **Config**: activity_gated, 15min deadline, require_action_for_ready, afk_penalty_enabled
- **Tool**: Full WebMCP browser playtest, both accounts, all 18 cycles

## Final Standings

| # | Simulation | Score | STAB | INFL | SOVR | DIPL | MILT |
|---|-----------|-------|------|------|------|------|------|
| 1 | Station Null (BOT WLRD) | 78.8 | 18 | 6 | 100 | 34 | 0 |
| 2 | The Gaslit Reach (BOT SNTL) | 53.0 | 15 | 0 | 100 | 31 | 0 |
| 3 | Velgarien (P1) | 52.1 | 12 | 0 | 100 | 37 | 0 |
| 4 | Conventional Memory (P2) | 48.8 | 17 | 0 | 100 | 11 | 0 |

---

## Bug List

### P0 -- Game-Breaking

#### BUG-001: P2 Counter-Intel Sweep produces NO results

**Severity**: P0
**Affected**: Player 2 (Conventional Memory)
**Symptoms**: P2 performed ~10 Counter-Intel Sweeps across 18 cycles. ZERO results appear in:
- Battle Log tab (no `counter_intel` entries)
- Operations tab Intelligence section ("No threats detected")
- Overview tab Intel Dossier ("NO INTELLIGENCE GATHERED YET")

Meanwhile P1's Counter-Intel Sweeps correctly produce 4 detections per cycle (propagandist, saboteur, assassin, spy) visible in both Battle Log and Operations Intelligence.

**Root cause hypothesis**: The `counter_intel` battle_log event uses `source_simulation_id` = the sweeping player's sim. The Battle Log frontend query likely filters by `simulation_id` (target) OR checks if the event's `source_simulation_id` matches the player's sim. For P2, the query may not be matching because:
1. The sweep RPC logs the event with the epoch's game-instance sim ID, but the frontend passes the template sim ID
2. OR the RLS policy blocks P2 from seeing their own counter_intel events
3. OR the `counter_intel` event type is logged with metadata that only references P1's guardian (P1 deployed a guardian, P2 did not -- maybe CI results require a guardian to detect threats?)

**Files to investigate**:
- `backend/services/cycle_resolution_service.py` -- `_run_counter_intel()` or equivalent
- `backend/services/operative_mission_service.py` -- counter-intel logic
- `backend/routers/epochs.py` -- `spend_rp()` for counter_intel action
- `frontend/src/components/epoch/EpochBattleLog.ts` -- battle_log query filter
- `frontend/src/components/epoch/EpochOperationsTab.ts` -- intelligence query

**Verification**: Check `battle_log` table directly: `SELECT * FROM battle_log WHERE epoch_id = '<epoch_id>' AND event_type = 'counter_intel' ORDER BY cycle_number` -- are there entries for P2's sim?

---

#### BUG-002: P2 Intelligence section always empty

**Severity**: P0 (related to BUG-001)
**Symptoms**: Operations tab shows "No threats detected" for P2 despite multiple CI sweeps. P1 shows "17 detected" with detailed threat list (type, success %, RP cost).

**Root cause**: Same as BUG-001 -- the intelligence data comes from `counter_intel` battle_log entries filtered by simulation_id. If those entries don't exist or aren't queryable for P2, the intelligence section is empty.

---

### P1 -- High Impact

#### BUG-003: Pass events missing from Battle Log

**Severity**: P1
**Affected**: Both players
**Symptoms**: Neither P1 nor P2 see any "Player passed this cycle" entries in the Battle Log, even though both players passed many cycles. The `player_passed` event type exists in the CHECK constraint (migration 208) and was visible in previous playtests.

**Root cause hypothesis**: The `pass_cycle()` method in `CycleResolutionService` may not be logging to `battle_log` for game-instance sims, or the battle_log query excludes `player_passed` events.

**Files to investigate**:
- `backend/services/cycle_resolution_service.py` -- `pass_cycle()` method
- `backend/services/battle_log_service.py` -- `log_event()` for player_passed

---

#### BUG-004: Fortification not shown in Operations tab Active Missions

**Severity**: P1
**Affected**: P2 (and likely P1 for non-guardian operations)
**Symptoms**: P2 fortified "Upper Memory" in Cycle 1. The Overview tab shows it under "YOUR OPERATIONS > DEFENSIVE FORTIFICATIONS" with details (zone name, security level, cycle expiry, ACTIVE badge). But the Operations tab shows "No active missions (0)".

**Root cause**: The Operations tab queries `operative_missions` table which only contains spy/saboteur/guardian/etc missions. Fortifications are stored in `zone_fortifications` table (or similar) and are NOT part of the operative_missions data model. The Overview tab has a separate query for fortifications.

**Fix approach**: Either:
1. Add a "Defensive Fortifications" section to the Operations tab (separate from Active Missions)
2. Or show fortifications alongside active missions with a different badge

**Files**: `frontend/src/components/epoch/EpochOperationsTab.ts`

---

#### BUG-005: War Room detection counter always 0

**Severity**: P1
**Affected**: P2 (confirmed), possibly P1
**Symptoms**: War Room stats show "0 DEPLOYED, 0 SUCCESSES, 0 FAILURES, 0 DETECTIONS" even when the Battle Log in the same War Room view shows detection events.

**Root cause hypothesis**: The War Room stats query counts from `operative_missions` WHERE `source_simulation_id` = player's sim. Detections of INCOMING operatives (from other players attacking you) would have `target_simulation_id` = your sim, not `source_simulation_id`. The counter only counts YOUR outgoing operations, not incoming threats.

**Fix approach**: Add a separate "INCOMING THREATS" counter or include detected incoming ops in the DETECTIONS counter.

**Files**: `frontend/src/components/epoch/EpochWarRoom.ts` -- stats calculation

---

#### BUG-006: ALLIED INTEL fog-of-war leak

**Severity**: P1
**Affected**: P1 (Velgarien)
**Symptoms**: P1 sees bot alliance intel (spy deployments, spy reports with zone details, mission failures, alliance maintenance RP deductions) tagged with "ALLIED INTEL" badge -- but P1 is NOT a member of any alliance.

**Events leaked**:
- "A spy has been deployed" ALLIED INTEL
- "Spy intel: 1 guardians, 9 buildings, 6 agents, zones: Altstadt: High..." (full zone security breakdown)
- "Alliance maintenance: 1 RP deducted from 'War Pact C10'" ALLIED INTEL
- "The mission failed quietly" (silent failure should be invisible to defender)

**Root cause hypothesis**: The battle_log query for a player may include events WHERE the event's team_id matches ANY team in the epoch, rather than only the player's own team. Since P1 has no team_id (unaligned), the query may fall through to showing all team-tagged events.

**Files to investigate**:
- `backend/services/battle_log_service.py` -- query that returns events for a player
- `backend/routers/epochs.py` or `battle_log.py` -- the endpoint that serves battle log data
- Check SQL: how does the query filter by `team_id` or `source_simulation_id`?

---

#### BUG-007: "Mission failed quietly" visible to defender

**Severity**: P1
**Affected**: P2 (War Room shows bot mission failure)
**Symptoms**: P2's War Room shows "MISSION FAILED: The mission failed quietly" for a bot operative. This is a stealth failure -- the defender should NOT know the mission happened at all.

**Root cause**: The `mission_failed` event may be logged with `target_simulation_id` = P2's sim, and the battle_log query includes events where target = player's sim regardless of event type. Should filter: only `detected` and `captured` events are visible to the defender.

**Files**: `backend/services/battle_log_service.py` -- fog-of-war filtering

---

#### BUG-008: War Room and Battle Log tab show DIFFERENT events

**Severity**: P1
**Symptoms**: War Room's inline battle log shows events that the Battle Log tab does NOT show, and vice versa. Example:
- War Room shows "OPERATIVE DEPLOYED: A spy has been deployed" (C17) and "An assassin has been deployed" (C15)
- Battle Log tab does NOT show these deployment events
- Battle Log tab shows "A spy detected" entries that War Room doesn't show at the same cycle

**Root cause**: Different query logic or different fog-of-war filtering between the two components.

**Files**:
- `frontend/src/components/epoch/EpochBattleLog.ts` -- Battle Log tab query
- `frontend/src/components/epoch/EpochWarRoom.ts` -- War Room inline battle log query

---

### P2 -- Medium Impact

#### BUG-009: Composite score calculation unclear / possibly wrong

**Severity**: P2
**Symptoms**: Manual calculation of weighted composite:
```
Velgarien: STAB 12 * 0.25 + INFL 0 * 0.20 + SOVR 100 * 0.20 + DIPL 37 * 0.15 + MILT 0 * 0.20
         = 3.0 + 0 + 20.0 + 5.55 + 0 = 28.55
```
But displayed score is 52.1. Factor ~1.83x off.

**Hypothesis**: The scoring service may normalize dimension scores to 0-100 range before weighting, or use a different formula than simple weighted sum. The `fn_compute_cycle_scores` RPC may apply normalization.

**Files**: `backend/services/scoring_service.py` -- `compute_cycle_scores()`, check the RPC `fn_compute_cycle_scores` in migrations.

---

#### BUG-010: All detected operatives show identical 51% success rate

**Severity**: P2
**Symptoms**: Every single detected operative in P1's Intelligence shows "51% success" regardless of:
- Operative type (spy 3RP vs assassin 7RP)
- Zone security level (High vs Medium vs Low)
- Guardian presence (P1 has active guardian)
- Agent aptitude

**Expected**: Success rate should vary based on operative_mission_service probability calculation (base + aptitude * 0.03 - zone_security * 0.05 - guardian_penalty + embassy_eff * 0.15).

**Root cause hypothesis**: The 51% displayed is the BASE probability, not the actual calculated probability. The frontend may be showing a static value instead of the resolved probability from the mission data.

**Files**: 
- `backend/services/operative_mission_service.py` -- probability calculation
- `frontend/src/components/epoch/EpochOperationsTab.ts` -- how success % is displayed

---

#### BUG-011: Bot alliances with only 1 member

**Severity**: P2
**Symptoms**: Sentinel Pact C2 (only The Gaslit Reach) and War Pact C10 (only Station Null) -- each alliance has only 1 member. They pay 1 RP/cycle upkeep but get 0% alliance bonus (bonus requires allies).

**Root cause**: Bot personality logic creates alliances without checking if there are willing partners. A solo alliance is strategically negative (costs RP, no benefit).

**Fix**: Bot alliance logic should require at least 2 potential members before creating, OR auto-dissolve 1-member alliances.

**Files**: `backend/services/bot_service.py` -- alliance decision logic

---

#### BUG-012: Commendations show no winner name

**Severity**: P2
**Symptoms**: Results tab Commendation cards show award name + score value but NOT which simulation won the award. E.g., "IRON GUARDIAN 100.0" -- which sim has 100.0 sovereignty? User must cross-reference with the standings table.

**Files**: `frontend/src/components/epoch/EpochResultsView.ts` -- commendation rendering, `backend/services/scoring_service.py` -- `get_results_summary()` awards section (the `simulation_name` field exists in the backend response but may not be rendered).

---

#### BUG-013: P2 sees fewer commendations than P1

**Severity**: P2
**Symptoms**: P1 sees 4 commendations (Iron Guardian, The Diplomat, Most Lethal, Cultural Domination). P2 sees only 3 (missing "Most Lethal"). Both should see the same awards -- they're epoch-wide, not per-player.

**Root cause**: The `get_results_summary()` may return different awards based on the requesting player's RLS-scoped data. If "Most Lethal" requires operation stats that P2 can't query, the award is omitted.

**Files**: `backend/services/scoring_service.py` -- awards computation in `get_results_summary()`

---

#### BUG-014: RECKONING phase separator wrongly positioned in P2 Battle Log

**Severity**: P2
**Symptoms**: The RECKONING separator appears between C12 and C15 entries instead of between C15 and C16 (where the actual phase transition occurred). The COMPETITION separator is correctly positioned.

**Root cause**: Phase change events in battle_log may have incorrect cycle_number, or the frontend sorts/groups events incorrectly.

---

#### BUG-015: No UI explanation of Intel Dossier vs Counter-Intel difference

**Severity**: P2
**Symptoms**: Intel Dossier section shows "NO INTELLIGENCE GATHERED YET" even after doing CI sweeps. Users expect CI results there. Intel Dossier is actually for SPY mission intel only. No tooltip or explanation clarifies this.

**Fix**: Add a help tooltip: "Intel Dossier shows intelligence from your deployed spy missions. Use Counter-Intel Sweep to detect incoming threats (shown in Operations > Intelligence)."

---

#### BUG-016: Spy Intel Reports show static zone data

**Severity**: P2
**Symptoms**: Multiple spy intel reports across cycles (C12, C14, C15) show identical zone security data: "Altstadt: High, Industriegebiet Nord: medium, Regierungsviertel: medium, Sector Delta: contested". Zone security never changes across 18 cycles.

**Root cause hypothesis**: Zone security levels are set at game instance creation and never modified because no sabotage operations successfully degraded any zones (no embassies = no offensive ops). This may be "correct" but feels wrong in a 18-cycle game.

---

### P3 -- Low / Design Questions

#### BUG-017: Phase transition timing off by 1 cycle

**Severity**: P3
**Symptoms**: Sprint config is 2F + 13C + 3R = 18. Expected: Foundation C1-2, Competition C3-15, Reckoning C16-18. Observed: Reckoning appeared at C11 (via findStatus), later at C15 (via phase separator). Some cycles were auto-resolved by deadline which may have caused double-counting.

**Investigation needed**: Check if deadline auto-resolve correctly increments cycle count. AFK auto-resolve might resolve a cycle AND advance the phase in a single operation, potentially skipping a cycle.

---

#### BUG-018: Station Null INFL 6, all others 0

**Severity**: P3
**Symptoms**: Only Station Null has Influence > 0. No human players generated events. The bot may have generated events (spy intel reports count as influence?).

**Investigation**: Check `fn_compute_cycle_scores` -- what feeds into influence_score.

---

#### BUG-019: Stability naturally decays

**Severity**: P3
**Symptoms**: P1 Velgarien stability dropped from 17 to 12 over 18 cycles despite no sabotage. Is this intentional baseline decay? Station Null stayed at 18.

**Investigation**: Check stability calculation -- is there natural decay per cycle?

---

#### BUG-020: P2 sees spy detections but NOT other operative type detections

**Severity**: P3 (may be by design)
**Symptoms**: P2 (without guardian) sees "spy detected" events in Battle Log but NOT propagandist/saboteur/assassin detections. P1 (with guardian) sees all 4 types.

**Question**: Is this intentional fog-of-war? Guardians detect all operative types, but without a guardian only spies are auto-detected (spies have a base detection rate)?

**Investigation**: Check `cycle_resolution_service.py` -- operative resolution logic, detection probabilities per type.

---

## Fixes Already Applied This Session

| Fix | Files | Status |
|-----|-------|--------|
| `maybe_single()` NoneType wrapper | `backend/utils/db.py` + 30 service files | Done, 2519 tests pass |
| Sim name resolution (UNKNOWN + Epoch N suffix) | `backend/utils/db.py`, scoring_service, epoch_participation_service, alliance_service, user_dashboard_service, 3 routers | Done, verified in browser |
| Leaderboard font-size harmonization | `frontend/src/components/epoch/EpochLeaderboard.ts` | Done, verified |
| Dashboard game_instance filter | `backend/services/user_dashboard_service.py` | Done |
| CLAUDE.md rules | `maybe_single()` NEVER rule added | Done |

## Gotchas for Next Session

1. **Battle Log query architecture**: The battle_log table has `simulation_id`, `source_simulation_id`, `target_simulation_id`, and `team_id`. The fog-of-war filtering logic determines what each player sees. This is the ROOT CAUSE of bugs 001, 002, 006, 007, 008. A single architectural fix to the battle_log query could resolve 5 bugs at once.

2. **Counter-Intel Sweep flow**: `spend_rp()` in `CycleResolutionService` handles counter_intel. It calls `_run_counter_intel()` which queries active enemy operatives targeting the player's sim and logs `counter_intel` events. The events are logged with `source_simulation_id` = sweeping player. But the Battle Log frontend may filter by `simulation_id` (which is the epoch-level sim reference, not the source). Need to trace the full data flow.

3. **Operative detection probability**: The 51% static rate (BUG-010) needs investigation. The `operative_mission_service.py` `_calculate_success_probability()` method computes it, but the displayed value in the frontend may come from a different source (e.g., a static field on the battle_log metadata rather than the computed probability).

4. **Score normalization**: The composite score formula (BUG-009) likely involves normalization. Check the `fn_compute_cycle_scores` Postgres RPC -- it may normalize each dimension to 0-100 before applying weights, or use min-max normalization across participants.

5. **Bot alliance logic** (BUG-011): The bot personality system (`bot_service.py`, `bot_personality.py`) makes alliance decisions during `resolve_cycle_full()`. The sentinel personality is defensive (creates alliances for protection), warlord is aggressive. Both created solo alliances -- the alliance creation logic doesn't check member count.

6. **Test accounts**: P1 = matthias@leihs.at (password: met123), P2 = test-player-1@test.dev (password: met123). Local Supabase.

7. **Commits not yet made**: All fixes from this session (maybe_single refactor, sim name resolution, font-size, dashboard filter) are uncommitted. Run `git status` to see all changes.

## Resume Command

```
Lies docs/analysis/epoch-tactical-showdown-playtest-2026-04-14.md und fixe alle Bugs darin, beginnend mit P0, dann P1, dann P2. Jeder Fix: Code lesen, Root Cause verifizieren, Fix implementieren, Lint, Test. Für Battle-Log-Bugs (001, 002, 006, 007, 008): analysiere zuerst die battle_log Query-Architektur als Ganzes bevor du einzelne Fixes machst -- das sind 5 Bugs mit einem gemeinsamen Root Cause.
```
