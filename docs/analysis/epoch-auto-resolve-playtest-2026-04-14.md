# Epoch Auto-Resolve Playtest Report — 2026-04-13/14

## Session Summary

WebMCP E2E playtest of the epoch auto-resolve system. 9 bugs found and fixed across 4 commits. Full game played from Cycle 1 to COMPLETED status.

## Bugs Fixed

| # | Severity | File | Root Cause | Fix |
|---|----------|------|------------|-----|
| 1 | P0 | `backend/models/epoch.py` | `EpochResponse` missing `cycle_deadline_at`/`cycle_started_at` from migration 204 | Added fields |
| 2 | P0 | `frontend/.../EpochCommandCenter.ts` | `player-acted` event dispatched but never caught | Added `@player-acted` handler + `_refreshParticipants()` |
| 3 | P0 | `backend/models/epoch.py` | `ParticipantResponse` missing `has_acted_this_cycle` + AFK fields | Added 4 fields |
| 4 | P1 | Migration 208 | `player_passed` not in `battle_log` CHECK constraint | Extended constraint with 6 new event types |
| 5 | P2 | `backend/services/operative_mission_service.py:384` | `mood_resp` NoneType from `maybe_single()` | None guard |
| 6 | P1 | `frontend/.../EpochCommandCenter.ts` | `_onCounterIntel()` missing `_refreshParticipants()` | Added refresh call |
| 7 | P0 | `backend/services/epoch_cycle_scheduler.py` | AFK takeover set `is_bot=true` without `bot_player_id` | Create `bot_players` row at takeover |
| 8 | P0 | `backend/services/bot_chat_service.py:303` | `resp` NoneType from `maybe_single()` crashed bot pipeline, killing scoring | None guard + `except Exception` |
| 9 | P1 | `backend/services/bot_service.py:68` | Per-bot catch list missing `HTTPException`/`AttributeError` | `except Exception` |

## Gotchas for Next Session

### 1. Scoring Verification Pending
The scoring fix (c47f987) is committed but NOT verified via WebMCP. The RPC `fn_compute_cycle_scores` works when called directly via SQL (Conv. Memory scored 89.74). But the Python path through `resolve_cycle_full()` needs a live game to confirm scores appear in the Leaderboard UI. Backend was restarted with the fix.

### 2. `maybe_single()` is a Landmine
Three separate NoneType bugs (#5, #8, and the mood_resp one) all stem from `supabase-py`'s `maybe_single()` returning `None` when 0 rows match. The response object itself is None, not just `.data`. Every `resp.data.get(...)` after `maybe_single()` is a potential crash. The codebase has ~40+ `maybe_single()` calls. A global refactoring is warranted.

### 3. Instance Simulations Are Incomplete
When `start_epoch()` clones simulations, instance sims get zones and buildings but NOT:
- `simulation_settings` rows (causes BotChatService crash)
- Fully initialized zone health/stability data (affects scoring accuracy)
- Agent mood data (causes operative success probability crash)

These missing rows are the ROOT cause of bugs #5, #8. The None guards are band-aids.

### 4. `except` Lists in resolve_cycle_full Are Fragile
Before the fix, each try/except in the cycle resolution pipeline had a specific exception type list (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError). Any new exception type (AttributeError, HTTPException) would bypass the catch and kill the entire pipeline. Changed bot + scoring to `except Exception` — other steps still use specific lists.

### 5. Battle Log CHECK Constraint Drift
Every new `BattleLogService.log_event()` event type requires updating the `battle_log_event_type_check` constraint. No test enforces this sync. Current types in constraint (migration 208): operative_deployed, mission_success, mission_failed, detected, captured, sabotage, propaganda, assassination, infiltration, alliance_formed, alliance_dissolved, betrayal, phase_change, epoch_start, epoch_end, rp_allocated, building_damaged, agent_wounded, counter_intel, intel_report, zone_fortified, alliance_proposal, alliance_proposal_accepted, alliance_proposal_rejected, alliance_tension_increase, alliance_dissolved_tension, alliance_upkeep, player_passed, cycle_resolved, cycle_auto_resolved, player_afk, player_afk_penalty, player_afk_ai_takeover.

### 6. Results Tab Shows "No results available"
Even after epoch completion with status=completed, the Results tab shows nothing. This tab likely depends on `epoch_participants.final_scores` being populated during epoch finalization. The `end_epoch()` lifecycle method may need to copy the latest `epoch_scores` into `final_scores`. This is a separate feature gap, not an auto-resolve bug.

### 7. Sentry Error Unchecked
User mentioned a new Sentry error during the session. Never investigated. Check production Sentry dashboard.

### 8. Leaderboard Scores Stale After Cycle Resolution
The leaderboard calls `ScoringService.get_leaderboard()` which reads from `epoch_scores`. If scoring failed in prior cycles but succeeds in a later cycle, the leaderboard only shows the latest cycle's scores. Historical score progression (per-cycle) is stored but not surfaced in the UI.

## Commits (not pushed)

```
355ccd4  fix(epochs): 5 auto-resolve bugs — response models, event wiring, constraint, NoneType
12c3fc0  fix(epochs): 3 more bugs — spend_rp acted flag, AFK bot constraint, counter-intel refresh  
e7eafe7  feat(epochs): real AFK AI takeover + spend_rp revert + dead code cleanup
c47f987  fix(epochs): scoring pipeline never reached — bot NoneType + exception catch
```

## Test Coverage Achieved

| Test | Method | Result |
|------|--------|--------|
| Activity Gate | WebMCP | PASS |
| Pass Cycle + ACTED badge | WebMCP | PASS |
| Deploy + Ready (no pass needed) | WebMCP | PASS |
| Signal Ready + Revoke Ready | WebMCP | PASS |
| Counter-Intel Sweep as action | WebMCP | PASS |
| All-Ready Acceleration (2 player) | WebMCP + curl | PASS |
| Deadline Auto-Resolve (live timer) | WebMCP | PASS |
| Danger Glow (<5min) | WebMCP | PASS |
| RESOLVING... state at 0s | WebMCP | PASS |
| Insufficient RP deploy | WebMCP | PASS |
| AFK AI Takeover (bot_players row) | DB + logs | PASS |
| AFK Bot executes actions | DB battle_log | PASS |
| Full Game Cycle 1-6 | WebMCP | PASS |
| Phase transitions (F→C→R→completed) | WebMCP | PASS |
| Battle Log history | WebMCP | PASS |
| Endscreen (completed badge) | WebMCP | PASS |
| Leaderboard with scores | WebMCP | NEEDS VERIFICATION |
