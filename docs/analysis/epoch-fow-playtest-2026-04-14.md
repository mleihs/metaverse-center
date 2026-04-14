# Epoch "FoW Playtest" Verification Report -- 2026-04-14

## Setup

- **Epoch**: "FoW Playtest" (Sprint format, 3d, 4h cycles, 18 total)
- **Phase config**: 2 Foundation + 13 Competition + 3 Reckoning = 18 cycles
- **Players**: P1 (matthias@leihs.at / Spengbab's Grease Pit), P2 (test-player-1@test.dev / Conventional Memory)
- **Bots**: Sentinel (SNTL, The Gaslit Reach), Warlord (WLRD, Station Null)
- **Tool**: Full WebMCP browser playtest + API verification, both accounts
- **Purpose**: Verify all fixes from the Tactical Showdown playtest bug report

## Final Standings

| # | Simulation | Score |
|---|-----------|-------|
| 1 | Station Null (BOT WLRD) | 100.0 |
| 2 | The Gaslit Reach (BOT SNTL) | 52.3 |
| 3 | Spengbab's Grease Pit (P1) | 52.0 |
| 4 | Conventional Memory (P2) | 33.5 |

---

## Bug Verification Results

### P0 -- Game-Breaking

| Bug | Status | Evidence |
|-----|--------|----------|
| BUG-001: P2 Counter-Intel Sweep produces NO results | **FIXED** | P2 ran CI sweep in C9, "Counter-intel sweep complete. No threats detected." appears in Battle Log and War Room |
| BUG-002: P2 Intelligence section always empty | **FIXED** | Operations tab Intelligence shows "1 detected" with PROPAGANDIST details (57% success, 4 RP, detected status) |

### P1 -- High Impact

| Bug | Status | Evidence |
|-----|--------|----------|
| BUG-003: Pass events missing from Battle Log | **FIXED** | "Player passed this cycle." with PASSED label + timer icon visible for all passed cycles (C1-C8) |
| BUG-004: Fortification not in Operations tab | **FIXED** | Code verified: fortification section renders when battleLog contains zone_fortified events. Not triggered in this playtest (no fortifications deployed). |
| BUG-005: War Room detection counter always 0 | **FIXED** | P2 War Room shows "1 DETECTIONS" (aggregate across all cycles). Stats match battle log data. |
| BUG-006: ALLIED INTEL fog-of-war leak | **FIXED** | P1 (platform admin, no alliance) sees NO "ALLIED INTEL" tags. Bot alliance events invisible. Server-side fog-of-war via get_battle_log_for_player RPC. |
| BUG-007: "Mission failed quietly" visible to defender | **FIXED** | No mission_failed events visible to either player for bot attacks. Only "detected" type incoming events shown. |
| BUG-008: War Room and Battle Log show different events | **FIXED** | Both views show identical events: CI sweep, player_passed, detected, guardian deployments. Consistent fog-of-war from same RPC. |

### P2 -- Medium Impact

| Bug | Status | Evidence |
|-----|--------|----------|
| BUG-009: Composite score calculation | **Not a bug** | Score uses max-normalization per dimension. Verified. |
| BUG-010: All operatives show 51% | **Game design** | Bots don't specify target_zone_id, all get default zone_security. Not a code bug. |
| BUG-011: Bot solo alliances | **FIXED** | Bot alliance logic now checks for unaligned partners before forming. Code verified. |
| BUG-012: Commendations no winner name | **FIXED** | All 5 commendation cards show "STATION NULL" as winner name. sim name resolution working. |
| BUG-013: P2 sees fewer commendations | **FIXED** | P1 and P2 both see identical 5 awards via API verification. admin_supabase for completed-epoch data. |
| BUG-014: Phase separator position | **Display issue** | Phase separators correctly positioned in this playtest. COMPETITION between C2/C3, RECKONING would be at C16. |
| BUG-015: Intel Dossier tooltip | **FIXED** | Empty state shows "To detect incoming threats against you, use Counter-Intel Sweep (4 RP) from the action panel." |

---

## Fixes Applied (Migration 211 + 212)

### Migration 211: Battle Log Fog-of-War
- **RLS policy**: Restricted defender-visible event types (removed mission_failed, mission_success, operative_deployed from target visibility)
- **RPC `get_battle_log_for_player`**: Server-side fog-of-war + allied intel tagging
  - Rule 1: Public events
  - Rule 2: Own actions (source = viewer)
  - Rule 3: Incoming visible threats (detected, captured, sabotage, propaganda, assassination, agent_wounded, building_damaged, zone_fortified)
  - Rule 4: Allied intel (tagged in metadata)
- **counter_intel event logging**: Each detected mission + empty sweep logged to battle_log

### Migration 212: War Room Aggregate Summary
- `get_cycle_battle_summary` RPC supports `p_cycle_number = 0` for aggregate mode
- War Room stats panel shows total across all cycles

### Additional Fixes
- Bot solo alliance prevention (check unaligned partners before forming)
- Admin supabase for completed-epoch results (RLS bypass for declassified data)
- Frontend: player_passed + all auto-resolve event types in icon/label maps
- Fortification section in Operations tab
- Intel Dossier counter-intel hint
