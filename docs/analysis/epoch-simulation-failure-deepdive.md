# Epoch Simulation Battery: Corrective Audit & Architecture Review

**Document ID:** VEL-AUDIT-2026-03-30-001
**Status:** DEFINITIVE
**Supersedes:** VEL-RCA-2026-03-29-001 (contained factual errors, false claims, and missing context)
**Subject:** Root cause analysis of epoch simulation battery failure + architecture quality audit
**Method:** Line-by-line code verification against all claims, git history analysis, 4-perspective architecture review

---

## 1. Executive Summary

The epoch simulation battery (2P/3P/4P/5P parametric games) has been inoperable since approximately 2026-03-03. An earlier post-mortem (VEL-RCA-2026-03-29-001) identified one of two independent breaking changes, contained a false claim about BattleLogService blocking, cited wrong line numbers, and failed to explain why the battery worked before but fails now.

**This audit corrects and replaces that document.**

### Key Findings

1. **Two independent fatal bugs**, not one:
   - **Breaking Change #1 (2026-03-03):** `CK` to `GR` tag rename in `ALL_SIMS` dict without updating the 5 `simulate_epoch_*.py` scripts. Results in `KeyError: 'CK'` before any API call is made. *Entirely missed by the original post-mortem.*
   - **Breaking Change #2 (2026-03-04):** Migration 049 added `user_id` column + partial unique index to `epoch_participants`. Since all simulated players share a single admin JWT, the second player's join attempt hits HTTP 409.

2. **The original post-mortem claimed BattleLogService blocks mission creation.** This is false. BattleLogService calls are already wrapped in `try-except` at `operative_mission_service.py:242-248`.

3. **The successful 200-game batteries ran on 2026-02-28 and 2026-03-02** -- before either breaking change existed. The original post-mortem never explains this timeline.

4. **Architecture quality audit** reveals a well-engineered parametric test system with strong checkpoint/recovery mechanisms, but structural issues including a 1465-line monolith, 15 mutable global variables, and an error contract that makes debugging impossible for callers.

5. **Logging & analysis pipeline audit** identifies 10 critical gaps that prevent the battery from being used for serious game balance analysis. Rich per-action data is captured in CYCLE_ACTIONS but encoded as human-readable strings, never aggregated structurally. Game configuration (`game_def`) is discarded after each game — config parameters, strategies, alliances, and phase timing survive only as compressed desc strings that require fragile regex parsing. Score trajectories (per-cycle data) are stored but never analyzed. The pipeline answers "who won?" but cannot answer "why?" or "what should we change?"

---

## 2. Post-Mortem Verification Report

### 2.1 Claims Confirmed Correct

| # | Claim | Evidence | Verdict |
|---|-------|----------|---------|
| 1 | Partial unique index on `(epoch_id, user_id)` in Migration 049 | `supabase/migrations/20260304185712_049_open_epoch_participation.sql:49-51` -- exact SQL match | CONFIRMED |
| 2 | Service-layer duplicate check on user_id | `backend/services/epoch_participation_service.py:96-109` -- SELECT + HTTPException 409 | CONFIRMED |
| 3 | Single admin token shared by all players | `scripts/epoch_sim_lib.py:599` -- `Player(tag, ALL_SIMS[tag], token)` with same token for all | CONFIRMED |
| 4 | `api()` swallows error details, returns `{}` | `scripts/epoch_sim_lib.py:269-276` -- `return {}` on HTTP >= 400 after logging | CONFIRMED |
| 5 | CLOSE_WAIT socket leaks from Supabase client | `scripts/epoch_sim_lib.py:1432-1434` -- documented: "~200 CLOSE_WAIT sockets per game" | CONFIRMED |

### 2.2 Factual Errors

**Error 1: Wrong line number for `spend_rp`**

The post-mortem states: "`operative_mission_service.py` (Line 189): `await EpochService.spend_rp(supabase, epoch_id, simulation_id, cost)`"

**Actual location: Line 162.** Line 189 is `"target_simulation_id": str(body.target_simulation_id) if body.target_simulation_id else None,` -- a dictionary value assignment inside `mission_data`.

```python
# operative_mission_service.py:160-162 (ACTUAL)
cost = OPERATIVE_RP_COSTS.get(body.operative_type, 5)
await EpochService.spend_rp(supabase, epoch_id, simulation_id, cost)
```

**Error 2: Socket leak misattributed**

The post-mortem attributes socket leaks to "httpx client instantiation" in `auth_login()`. The actual cause is the **Supabase Python client's `set_session()` method**, which creates httpx clients internally that are never closed. This is explicitly documented in the code:

```python
# epoch_sim_lib.py:226-228
# Backend doubles our connections (each request -> GoTrue set_session() call),
# and the Supabase client leaks CLOSE_WAIT sockets on every call.
```

The script already has extensive mitigations: persistent client with connection pooling (`epoch_sim_lib.py:26-30`), client recycling after every game (`epoch_sim_lib.py:1428`), proactive backend restart every 5 games (`epoch_sim_lib.py:1435-1437`), and port pressure monitoring (`epoch_sim_lib.py:132-146`).

**Error 3: Guardian RP timing oversimplified**

The post-mortem claims guardians fail because "the simulation script attempts to deploy guardians before the first `resolve-cycle` has granted the initial RP."

This is misleading. Initial RP **is** granted at epoch start, not at resolve-cycle:

```python
# epoch_lifecycle_service.py:132-136
# Grant initial RP to all participants (foundation bonus)
foundation_rp = int(config["rp_per_cycle"] * 1.5)
await CycleResolutionService._grant_rp_batch(supabase, epoch_id, foundation_rp, config["rp_cap"])
```

With default `rp_per_cycle=15`, initial RP is 22. Guardian cost is 4 RP each (`OPERATIVE_RP_COSTS` in `constants.py:47-54` — verified: exact match with `OP_COSTS` in `epoch_sim_lib.py:767`). A player can deploy 5 guardians before running out. Even with the lowest parametric `rp_per_cycle=10` (foundation RP=15), the guardian_range formula (`min(3, 6 - player_count + 1)` at `epoch_sim_lib.py:872`) caps guardians at 3 (cost 12 RP) — always within budget. The script's `run_foundation()` (`epoch_sim_lib.py:712-723`) deploys guardians **after** epoch start, so RP is available. The actual issue is whether the requested guardian count exceeds budget -- a mathematical problem, not a temporal race condition.

### 2.3 False Claims

**"BattleLogService calls block mission creation if the log write fails"**

This is **false**. The BattleLogService call is wrapped in `try-except` at the deployment callsite:

```python
# operative_mission_service.py:241-248
try:
    await BattleLogService.log_operative_deployed(
        supabase, epoch_id, epoch.get("current_cycle", 1),
        mission, context=context,
    )
except (PostgrestAPIError, httpx.HTTPError):
    logger.debug("Battle log write failed for deployment", exc_info=True)
```

Additionally, `BattleLogService` itself has internal error handling:

```python
# battle_log_service.py:51-59
try:
    resp = await supabase.table("battle_log").insert(data).execute()
    return resp.data[0] if resp.data else data
except (PostgrestAPIError, httpx.HTTPError):
    logger.error("Battle log insert failed...", exc_info=True)
    return data  # Returns gracefully without raising
```

The mission is already successfully created (line 201) **before** the BattleLogService call. If the log write fails, the mission persists in the database. The post-mortem's Phase 2.2 remediation recommendation ("move to background task or use non-blocking I/O") is based on a false premise -- the service is already non-blocking.

### 2.4 Critical Missing Context

**1. Timeline gap: Why it worked before**

The original post-mortem never explains why the battery worked previously. The answer lies in the migration timeline:

| Date | Event | Impact on Battery |
|------|-------|------------------|
| 2026-02-28 | 200-game battery runs successfully (50×2P, 50×3P, 50×4P, 50×5P) | `user_id` column does not exist yet |
| 2026-03-02 | Cross-reference analysis published; balance v2.1 tuning complete | Battery still works; `ALL_SIMS` uses `CK` tag |
| 2026-03-03 | Commit `873ecc0`: Gaslit Reach retheme renames `CK` to `GR` in `ALL_SIMS` | **Battery broken**: `KeyError: 'CK'` |
| 2026-03-04 | Migration 049: `user_id` column + unique index added to `epoch_participants` | **Second break**: HTTP 409 for player 2+ |
| 2026-03-15 | Commit `e287a3e`: Admin email updated | No impact on battery structure |
| 2026-03-29 | Post-mortem VEL-RCA-2026-03-29-001 written | Identifies only the second break |

Before 2026-03-04, the `epoch_participants` table had no `user_id` column. The service layer had no user-based duplicate check. Multiple participants with the same auth token could join an epoch because they had different `simulation_id` values (which was the only unique constraint: `UNIQUE (epoch_id, simulation_id)` from Migration 032, line 92).

**2. CK to GR tag rename (entirely missed)**

Commit `873ecc0` (2026-03-03) renamed `"CK"` (Capybara Kingdom) to `"GR"` (The Gaslit Reach) in `ALL_SIMS`:

```python
# epoch_sim_lib.py:32-38 (CURRENT)
ALL_SIMS = {
    "V":  "10000000-0000-0000-0000-000000000001",
    "GR": "20000000-0000-0000-0000-000000000001",  # Was "CK"
    "SN": "30000000-0000-0000-0000-000000000001",
    "SP": "40000000-0000-0000-0000-000000000001",
    "NM": "50000000-0000-0000-0000-000000000001",
}
```

But all 5 `simulate_epoch_*.py` scripts still reference `"CK"`:

- `simulate_epoch_all.py:23` -- `tags_2p = ["V", "CK", "SN", "SP"]`
- `simulate_epoch_all.py:34` -- `tags_3p = ["V", "CK", "SN", "SP", "NM"]`
- `simulate_epoch_all.py:46` -- `tags_4p = ["V", "CK", "SN", "SP", "NM"]`
- `simulate_epoch_all.py:58` -- `tags_5p = ["V", "CK", "SN", "SP", "NM"]`
- `simulate_epoch_2p.py` -- 28 `"CK"` references
- `simulate_epoch_3p.py` -- 35 `"CK"` references
- `simulate_epoch_4p.py` -- 30 `"CK"` references
- `simulate_epoch_5p.py` -- 14 `"CK"` references

When `generate_parametric_game()` at `epoch_sim_lib.py:897` samples `"CK"` from the tag list, `setup_game()` at line 599 calls `Player(tag, ALL_SIMS[tag], token)` which raises `KeyError: 'CK'`. This is a hard Python crash -- no API call is ever made. The `run_parametric_battery()` function at line 1407 does NOT wrap `run_parametric_game()` in try-except, so the entire battery aborts.

**Handcrafted script impact** (verified per-game):

| Script | Games Using `"CK"` | CK-Free Games | Total |
|--------|-------------------|---------------|-------|
| `simulate_epoch_2p.py` | 6 (G1,G3,G5,G6,G8,G9) | 4 (G2,G4,G7,G10) | 10 |
| `simulate_epoch_3p.py` | 8 (G1,G2,G3,G5,G6,G7,G9,G10) | 2 (G4,G8) | 10 |
| `simulate_epoch_4p.py` | **ALL** (TAGS_4 at line 18 includes `"CK"`) | 0 | 10 |
| `simulate_epoch_5p.py` | **ALL** (TAGS_5 at line 19 includes `"CK"`) | 0 | 8+ |

Note: The handcrafted scripts use `run_battery()` which HAS try-except (lines 1310-1319), so CK failures are caught per-game and the battery continues. The parametric battery (`simulate_epoch_all.py`) uses `run_parametric_battery()` which does NOT have try-except, so it crashes entirely.

**3. Silent join failure**

`setup_game()` at line 612 does not capture the join response:

```python
# epoch_sim_lib.py:611-612
for tag, p in players.items():
    api("POST", f"/api/v1/epochs/{epoch_id}/participants", p, json={"simulation_id": p.sim_id})
```

The return value from `api()` is discarded. If the join fails (409 or any other error), the script proceeds as if the player joined. This is in contrast to the epoch creation at line 605-608, which does check the response.

**4. None cascade from failed joins**

After a failed join, `Player.instance_id` remains `None` (initialized at `epoch_sim_lib.py:56`). There are two separate instance-ID checks in `setup_game()`, and neither aborts the game:

**Check 1** (line 635-637) — inside the player-instance matching loop:
```python
# epoch_sim_lib.py:635-637
if not p.instance_id:
    log(f"  WARNING: Could not find instance for {tag}")
    continue  # Skips loading agents/buildings/embassies for this player
```

**Check 2** (line 652-655) — final validation after the loop:
```python
# epoch_sim_lib.py:652-655
for tag, p in players.items():
    if not p.instance_id:
        log(f"  FATAL: Player {tag} has no instance_id after setup")
        # NOTE: Does NOT return None or raise -- execution continues
```

The function returns `(epoch_id, players, admin)` regardless of whether all players have valid instance IDs. All subsequent API calls for unmatched players then use `simulation_id=None` in URLs (e.g., `deploy()` at line 465: `f"/api/v1/epochs/{epoch_id}/operatives?simulation_id={player.instance_id}"`), producing 400/404 errors that are swallowed by `api()` and surfaced as "unknown error".

### 2.5 Rejected Remediation Recommendations

**Phase 2.1 (Relax unique index for non-prod):** REJECTED. Weakening a production-grade database constraint to accommodate a broken test harness is an anti-pattern. The constraint is architecturally correct -- one human player per epoch. The test harness must create proper test users.

**Phase 2.2 (BattleLogService atomicity):** REJECTED. Based on false premise -- BattleLogService is already non-blocking (see Section 2.3).

---

## 3. Corrected Root Cause Analysis

### 3.1 Breaking Change #1: CK to GR Tag Rename (Fatal, Pre-API)

**Introduced:** Commit `873ecc0` (2026-03-03)
**Severity:** FATAL -- battery crashes before any HTTP request
**Impact:** All 5 `simulate_epoch_*.py` scripts and the parametric battery

**Mechanism:**

```
simulate_epoch_all.py
  tags_2p = ["V", "CK", "SN", "SP"]
                      |
                      v
run_parametric_battery(..., all_tags=tags_2p, ...)
  generate_parametric_game(...)
    tags = rng.sample(all_tags, player_count)  # e.g. ["V", "CK"]
                      |
                      v
  run_parametric_game(token, game_def)
    setup_game(token, name, config, tags=["V", "CK"], ...)
      for tag in tags:
        Player(tag, ALL_SIMS[tag], token)
                      |
        ALL_SIMS["CK"] --> KeyError: 'CK'
                      |
        (no try-except in run_parametric_game or run_parametric_battery)
                      |
                      v
        BATTERY CRASHES
```

### 3.2 Breaking Change #2: Migration 049 User Uniqueness (Fatal at Join)

**Introduced:** Migration created 2026-03-04
**Severity:** FATAL -- only first player joins; all others get 409
**Impact:** Multi-player games (2P+) are impossible with shared admin token

**Mechanism:**

```
setup_game(token, name, config, tags=["V", "GR"], ...)    # assuming CK fixed
  players = {
    "V":  Player("V",  ALL_SIMS["V"],  token),   # same JWT
    "GR": Player("GR", ALL_SIMS["GR"], token),   # same JWT
  }
      |
  api("POST", "/epochs/{id}/participants", V,  json={"simulation_id": V.sim_id})
    Router: user.id = admin_uuid (from JWT)
    EpochParticipationService.join_epoch(supabase, epoch_id, V.sim_id, admin_uuid)
    INSERT (epoch_id, simulation_id=V, user_id=admin_uuid)  --> SUCCESS
      |
  api("POST", "/epochs/{id}/participants", GR, json={"simulation_id": GR.sim_id})
    Router: user.id = admin_uuid (same JWT)
    EpochParticipationService.join_epoch(supabase, epoch_id, GR.sim_id, admin_uuid)
    Service check (line 98-104): SELECT WHERE epoch_id=X AND user_id=admin_uuid
    --> FOUND (V's row has same user_id)
    --> HTTPException 409: "You are already in this epoch."
      |
  api() returns {} (error swallowed, line 275-276)
  Return value not captured (line 612)
      |
  GR.instance_id remains None
      |
  All GR API calls use simulation_id=None --> 400/404 --> "unknown error"
```

Even if the service-layer check were bypassed, the database would enforce the partial unique index:

```sql
-- Migration 049, lines 49-51
CREATE UNIQUE INDEX epoch_participants_user_epoch_unique
  ON epoch_participants (epoch_id, user_id)
  WHERE user_id IS NOT NULL;
```

### 3.3 Corrected Root Cause Matrix

| Layer | Symptom | Root Cause | Location | Severity | Post-Mortem |
|-------|---------|-----------|----------|----------|-------------|
| Script | `KeyError: 'CK'` | Tag renamed CK to GR in `ALL_SIMS`, not updated in scripts | `epoch_sim_lib.py:34` vs `simulate_epoch_all.py:23,34,46,58` | FATAL | **MISSED** |
| DB | HTTP 409 | Partial unique index on `(epoch_id, user_id)` | Migration 049:49-51 | FATAL | Identified |
| Service | HTTP 409 | user_id duplicate check before INSERT | `epoch_participation_service.py:96-109` | FATAL | Identified |
| Script | Silent join failure | Join response not captured or checked | `epoch_sim_lib.py:612` | HIGH | **MISSED** |
| Script | None cascade | `instance_id` stays None; validation logs but doesn't abort | `epoch_sim_lib.py:56, 652-655` | HIGH | **MISSED** |
| Script | "Unknown error" | `api()` returns `{}` on error, losing `detail` field | `epoch_sim_lib.py:269-276, 484` | HIGH | Identified |
| Infra | Port exhaustion | Supabase `set_session()` CLOSE_WAIT leaks (~200/game) | `epoch_sim_lib.py:1432-1434` | MEDIUM | Identified (misattributed) |
| Script | `all_out` never deploys saboteurs | Dead code: infiltrator branch catches `rp >= 5` before saboteur | `epoch_sim_lib.py:821-823` | LOW | **MISSED** |
| Script | Wrong date in analysis output | Hardcoded `2026-02-28` instead of current date | `epoch_sim_lib.py:1031` | LOW | **MISSED** |
| Script | No try-except in parametric battery | `run_parametric_battery` (1407) doesn't catch exceptions; `run_battery` (1310) does | `epoch_sim_lib.py:1407 vs 1310` | MEDIUM | **MISSED** |
| Script + Backend | 6% empty leaderboards | MV refresh silently fails → scoring returns empty → leaderboard fallback to current_cycle (past last scored) | `scoring_service.py:38-41, 462-477` | MEDIUM | **MISSED** |
| Script | Redundant API calls per cycle | Script calls `/operatives/resolve` + `/scores/compute` explicitly, then `/resolve-cycle` does both again internally | `epoch_sim_lib.py:509,550,563` vs `cycle_resolution_service.py:221,292` | LOW | **MISSED** |

---

## 4. Remediation Recommendations (Corrected)

### Priority 1: Immediate Fixes (Required to Run Battery)

**P1.1: Fix CK to GR Tag References**

Update all 5 `simulate_epoch_*.py` scripts to use `"GR"` instead of `"CK"`. Files and approximate occurrence counts:

| File | `"CK"` Occurrences |
|------|-------------------|
| `scripts/simulate_epoch_all.py` | 4 (lines 23, 34, 46, 58) |
| `scripts/simulate_epoch_2p.py` | 28 |
| `scripts/simulate_epoch_3p.py` | 35 |
| `scripts/simulate_epoch_4p.py` | 30 |
| `scripts/simulate_epoch_5p.py` | 14 |
| **Total** | **111** |

Alternatively, add a `"CK"` alias in `ALL_SIMS` and `ALL_SIM_NAMES` pointing to the GR simulation ID and name. The alias approach is simpler but leaves stale terminology in the scripts.

**P1.2: Unique User Provisioning**

The script must create unique Supabase auth test users for each simulated player instead of sharing the admin token. Implementation:

1. At battery start, create N test users via Supabase Auth Admin API (or direct `_psql` inserts into `auth.users`)
2. Add each test user as member of their respective simulation (via `simulation_members`)
3. Each `Player` gets its own JWT from `auth_login()` with their unique credentials
4. Clean up test users at battery end (or use idempotent upserts)

This is the only correct fix for the 409 issue. The database constraint is architecturally sound.

**P1.3: Join Response Validation**

`setup_game()` at line 612 must check the join response:

```python
# CURRENT (broken):
api("POST", f"/api/v1/epochs/{epoch_id}/participants", p, json={"simulation_id": p.sim_id})

# REQUIRED:
resp = api("POST", f"/api/v1/epochs/{epoch_id}/participants", p, json={"simulation_id": p.sim_id})
if not resp.get("data"):
    log(f"  FATAL: Player {tag} failed to join epoch: {resp.get('detail', 'no response')}")
    return None, players, admin
```

**P1.4: Instance-ID Gate (Abort, Don't Just Log)**

The validation at lines 652-655 must abort the game:

```python
# CURRENT (broken):
if not p.instance_id:
    log(f"  FATAL: Player {tag} has no instance_id after setup")
    # continues execution...

# REQUIRED:
if not p.instance_id:
    log(f"  FATAL: Player {tag} has no instance_id after setup")
    return None, players, admin
```

**P1.5: Try-Except in `run_parametric_battery()`**

Add `try-except` around `run_parametric_game()` at line 1407, matching the pattern already used in `run_battery()` at lines 1310-1319. This prevents a single game crash from aborting the entire battery.

**P1.6: Fix `all_out` Strategy Dead Code**

Swap the infiltrator and saboteur conditions at lines 821-823 so saboteur is checked first (requires `has_buildings`), and infiltrator serves as fallback:

```python
if rp >= 5 and has_buildings:
    return "saboteur"
if rp >= 5:
    return "infiltrator"
```

**P1.7: Fix Hardcoded Date in Analysis Output**

Replace line 1031's hardcoded `"2026-02-28"` with `time.strftime("%Y-%m-%d")`.

**P1.8: Eliminate Redundant API Calls in `resolve_and_score()`**

Remove the explicit `/operatives/resolve` (line 509) and `/scores/compute` (line 550) calls — `resolve_cycle_full` (triggered by `/resolve-cycle` at line 563) already performs both operations internally. The script should only call `/resolve-cycle` and parse the response. This halves the per-cycle database load and reduces port exhaustion pressure.

The script currently needs the mission results from `/operatives/resolve` (line 510-541) and score data from `/scores/compute` (line 551-561). After removing the explicit calls, retrieve these from `resolve_cycle_full`'s response (if the endpoint returns them) or query `/scores/leaderboard` after cycle resolution.

**P1.9: Harden Leaderboard Query Against Empty Scores**

`scoring_service.py:476-477` falls back to `epoch.current_cycle` when no scored cycles exist — which always produces empty results for completed epochs. Fix: if no `epoch_scores` rows exist at all, return an explicit empty-with-warning response or re-trigger scoring before returning.

### Priority 2: Test Infrastructure Hardening

**P2.1: Structured Error Return from `api()`**

Replace the `return {}` pattern with a structured error return so callers can distinguish "API error" from "API returned empty data":

```python
# Option A: Return error dict
return {"_error": True, "status": resp.status_code, "detail": parsed_detail}

# Option B: Raise a custom exception
raise SimApiError(resp.status_code, parsed_detail)
```

Note: errors ARE currently logged (`resp.text[:200]` at lines 267, 275), so they are visible in log output. The issue is purely programmatic -- callers cannot access the error details.

**P2.2: Socket Leak Documentation**

The CLOSE_WAIT leak is an upstream issue in the Supabase Python client's `set_session()` method. The existing mitigations (persistent client, recycling, proactive backend restart) are effective workarounds. Document this as a known limitation pending an upstream fix.

### Rejected Recommendations

| Recommendation | Reason for Rejection |
|---------------|---------------------|
| Relax unique index in non-prod | Anti-pattern. Production constraints exist for correctness. Fix the test harness. |
| BattleLogService atomicity changes | False premise. Service is already non-blocking (try-except at `operative_mission_service.py:242-248`). |

---

## 5. Architecture Quality Audit (4 Perspectives)

### 5.1 Architect Perspective: Structural Soundness

**Module Structure:**
`epoch_sim_lib.py` is a 1465+ line monolith containing HTTP client management, auth, port monitoring, game setup, phase runners (foundation/competition/reckoning), strategy generation, analysis output, and checkpoint management. While functional, this violates separation of concerns and makes isolated testing impossible.

Logical decomposition would yield:
- `sim_client.py` -- HTTP client, auth, error handling, port monitoring
- `sim_player.py` -- Player class, agent selection, aptitude logic
- `sim_phases.py` -- Foundation/competition/reckoning runners
- `sim_strategy.py` -- Strategy presets, parametric game generation
- `sim_analysis.py` -- Markdown analysis output, score formatting
- `sim_infra.py` -- Backend restart, checkpointing, socket monitoring

**Global State:**
15 mutable global variables control execution state:

```python
LOG, STATS, SCORE_HISTORY, ALL_GAME_RESULTS, CYCLE_ACTIONS,    # data (79-83)
_current_cycle, _current_phase, _active_tags, _current_players, # game state (84-87)
_game_start_time,                                                # timing (88)
_api_call_count, _game_total_failures, _consecutive_failures,   # error tracking (211-213, 129)
_http_client,                                                    # transport (26)
ANON_KEY                                                         # auth (21)
```

Only 4 of these are reset per game via `reset_game_state()` (`epoch_sim_lib.py:96-101`: `STATS`, `SCORE_HISTORY`, `CYCLE_ACTIONS`, `_game_total_failures`). A 5th (`_consecutive_failures`) is reset in the battery loop (`epoch_sim_lib.py:1413, 1429`), but the remaining 10 persist across games. The pattern is fragile, non-reentrant, and precludes parallel game execution.

**Token Architecture:**
The fundamental design flaw: conflating "test automation actor" with "game participant identity." The simulation creates N `Player` objects but authenticates them all as the same Supabase user. Any production constraint based on user identity will block multi-player simulation. This is a design-level incompatibility that cannot be solved by relaxing constraints.

**Error Contract:**
`api()` returns `{}` for all error cases, making it impossible for callers to distinguish:
- API returned 400 with error detail
- API returned 500 (server error)
- Connection failed (port exhaustion)
- Game failure cap exceeded (early bail-out at line 234-235)
- All of these look identical to "API returned an empty successful response"

**Hardcoded Paths:**
Multiple hardcoded absolute paths (`/Users/mleihs/Dev/velgarien-rebuild`) in:
- `epoch_sim_lib.py:158, 161` (backend restart paths)
- All `simulate_epoch_*.py` files (sys.path and BASE_DIR)

Not portable to other development machines or CI environments.

**Error Handling Asymmetry:**
`run_battery()` (line 1310-1319) wraps each game in `try-except`, catching `KeyError` and other crashes gracefully -- the battery continues to the next game. But `run_parametric_battery()` (line 1407) calls `run_parametric_game()` **without** try-except. A `KeyError: 'CK'` in the parametric battery crashes the entire run, while the same error in a handcrafted battery would be logged and skipped. This asymmetry means the parametric battery is more fragile by design.

**Strengths:**
- JWT refresh on 401 with propagation to all players (`epoch_sim_lib.py:252-258, _refresh_all_tokens()`)
- Rate limit handling with exponential backoff (`epoch_sim_lib.py:247-251`)
- Consecutive failure detection with port drainage (`epoch_sim_lib.py:237-241`)
- Checkpoint system with atomic writes and crash recovery (`epoch_sim_lib.py:1328-1358`)

### 5.2 Game Designer Perspective: Simulation Validity

**Strategy Coverage:**
10 strategy presets at `epoch_sim_lib.py:770-781`:

```
balanced, spy_heavy, saboteur_heavy, assassin_rush, propagandist,
ci_defensive, all_out, infiltrator, econ_build, random_mix
```

Good coverage of strategic archetypes. Each preset controls the distribution of operative deployments across available types.

**Parameter Space Exploration:**
`generate_game_config()` at `epoch_sim_lib.py:868` varies:
- `rp_per_cycle`: 6 values (10, 12, 15, 18, 20, 25) at line 870
- `rp_cap`: 4 values (40, 50, 60, 75) at line 871
- `guardian_range`: scaled by player count (0 to `min(3, 6 - player_count + 1)`) at line 872
- `foundation_pct`: 3 values (10%, 15%, 20%) at line 884
- `reckoning_pct`: 3 values (10%, 15%, 20%) at line 885
- `max_team_size`: 3 values (2, 3, 4) at line 886
- `allow_betrayal`: 2 values (true, false) at line 887
- Score dimension weights: randomized per game via `random_score_weights()` (min 5 per dim, sum=100) at line 873

Adequate for initial balance testing. The deterministic seeding (`random.Random(seed)` at line 1397) ensures reproducibility.

**Known Balance Issues (from cross-reference analysis `epoch-cross-reference-analysis.md`):**

| Finding | Severity | Details |
|---------|----------|---------|
| `ci_defensive` meta dominance | HIGH | 64% combined win rate -- fundamentally exploits offense/defense asymmetry |
| `infiltrator` non-viable | HIGH | 2% win rate -- embassy effectiveness penalty generates no measurable value |
| `econ_build` non-viable | MEDIUM | 6% win rate -- RP hoarding forfeits military/influence points |
| 6% empty leaderboard rate | MEDIUM | 12/200 games produce empty leaderboards; root cause uninvestigated |
| Speranza 2P dominance | LOW | 54% at 2P (theoretical fair: 50%) -- within expected variance |
| Gaslit Reach 2P outlier | LOW | 65% at 2P -- strong in duels, weak in multi-player |

These are **game balance issues**, not simulation infrastructure issues. They require game design changes (operative cost rebalancing, infiltrator rework) rather than code fixes.

**Code Bug: `all_out` Strategy Dead Code (line 817-826):**

```python
elif strategy == "all_out":
    if rp >= 7 and has_agents:
        return "assassin"        # rp >= 7: assassin
    if rp >= 5:
        return "infiltrator"     # rp >= 5 AND < 7: infiltrator -- CATCHES ALL rp >= 5
    if rp >= 5 and has_buildings:
        return "saboteur"        # UNREACHABLE: previous condition already returned
    if rp >= 4:
        return "propagandist"
    return "spy"
```

The infiltrator branch (line 821: `if rp >= 5: return "infiltrator"`) catches all cases where `rp >= 5`, making the saboteur branch (line 822-823) unreachable dead code. The `all_out` strategy never deploys saboteurs. This inflates infiltrator usage in the balance data and may explain part of infiltrator's poor win rate -- it's over-deployed by `all_out` in situations where a saboteur would be more effective.

**Code Bug: Hardcoded Date in Analysis Output (line 1031):**

```python
f"> Simulated on 2026-02-28 (local API)",
```

The analysis generator always outputs "2026-02-28" regardless of when the battery actually ran. Any new run would show an incorrect date.

**Undertested Areas:**
- Alliance mechanics: only 30% of 3+ player games include alliances (`epoch_sim_lib.py:917`). Alliance proposals, voting, betrayal, and shared intel are complex systems that receive proportionally less testing.
- Concurrent play: all players act sequentially within a cycle. No simulation of real-time concurrent actions.
- Ready-check flow: missions are force-expired via direct SQL (`force_expire()` at `epoch_sim_lib.py:429-433` sets `resolves_at = NOW() - INTERVAL '1 hour'`), bypassing the actual cycle timing and ready-check/auto-resolve system entirely.
- 2P excludes Nova Meridian entirely (`simulate_epoch_all.py:23`).

### 5.3 Developer Experience Perspective: Error Observability

**Error Visibility:**
Errors are logged but not returned. The `api()` function logs `resp.text[:200]` before returning `{}`:

```python
# epoch_sim_lib.py:275
log(f"    API ERROR {resp.status_code}: {method} {path}: {resp.text[:200]}")
return {}
```

The post-mortem's characterization of "total opacity" is overstated. Errors are visible in the log output. However, they are lost for programmatic use -- callers receive `{}` and can only produce "unknown error" messages.

**Redundant API Calls (Performance Issue):**
The script's `resolve_and_score()` function (line 503-573) calls three separate endpoints per cycle:

1. `POST /operatives/resolve` (line 509) — resolves missions
2. `POST /scores/compute` (line 550) — computes scores
3. `POST /resolve-cycle` (line 563) — which internally calls `resolve_cycle_full`, which does:
   - RP grant + alliance upkeep + expire proposals
   - **Resolve missions again** (`OperativeService.resolve_pending_missions` at `cycle_resolution_service.py:221`)
   - Expire fortifications + bot cycle
   - **Compute scores again** (`ScoringService.compute_cycle_scores` at `cycle_resolution_service.py:292`)
   - Alliance tension + notifications

Steps 1 and 2 are redundant — `resolve_cycle_full` already performs both operations internally. The mission re-resolution is benign (already-resolved missions are no-ops) and the score re-computation is idempotent (UPSERT on unique constraint). But the duplication doubles the database load per cycle: for a 20-cycle game with 5 players, that's ~40 extra DB round-trips. This contributes to port exhaustion and increases the probability of the MV refresh failures that cause empty leaderboards.

**Correlation Gap:**
No mechanism exists to correlate a specific game failure to the underlying HTTP error. The `action_log()` at `epoch_sim_lib.py:485-487` records `FAIL: unknown error` but not the HTTP status code, response body, or request path. Finding the actual error requires manually searching the raw log for the corresponding `API ERROR` line.

**Checkpoint System (Well-Engineered):**
The checkpoint system at `epoch_sim_lib.py:1328-1358` uses atomic writes via temp file + `os.replace()`. Batteries can resume from any game after a crash. The RNG is deterministically skipped to the correct position (`epoch_sim_lib.py:1396-1399`). This is the strongest piece of engineering in the test harness.

**Analysis Output (Comprehensive):**
`generate_analysis()` at `epoch_sim_lib.py:1025` produces markdown with:
- Summary table (all games with winners, scores, margins)
- Win distribution per simulation
- Victory margin statistics
- Score dimension analysis (stability, influence, sovereignty, diplomatic, military)
- Guardian impact analysis
- RP economy statistics
- Strategy effectiveness breakdown
- Optional per-cycle action logs

### 5.4 Research/QA Perspective: Statistical Validity

**Sample Size:**
50 games per player count (200 total). With 10 strategy presets and 5 simulations, each strategy appears in approximately 50 games. The 95% confidence interval for a win rate estimate from 50 games is approximately +/-14 percentage points. This is borderline adequate for detecting large imbalances (like the ci_defensive dominance at 64%) but insufficient for fine-grained balance tuning.

**Deterministic Seeding:**
`random.Random(seed)` at `epoch_sim_lib.py:1397` with different seeds per player count (2000, 3000, 4000, 5000) ensures full reproducibility. Good practice.

**Selection Bias:**
`rng.sample(all_tags, player_count)` at line 897 means simulation appearance frequency depends on player count. For 2P with 4 available tags, each simulation appears in ~50% of games. For 5P with 5 tags, each appears in 100%. The 2P exclusion of Nova Meridian (`simulate_epoch_all.py:23`) is documented but removes NM from the most statistically powerful test format (2P has the highest per-game information content).

**Empty Leaderboard Rate (Root Cause Identified):**
6% of games (12/200 in the successful v2.1 run) produce empty leaderboards. Investigation revealed the complete failure chain:

1. **MV refresh is silently swallowed:** `scoring_service.py:38-41` wraps `refresh_all_game_metrics()` in try-except. Under load (port exhaustion, concurrent locks), the refresh fails silently with only a warning log.
2. **Scoring is best-effort:** Both the script's explicit `/scores/compute` call (line 550) AND `resolve_cycle_full`'s internal scoring (line 292 of `cycle_resolution_service.py`) are wrapped in try-except. If MV data is stale/empty, the RPC `fn_compute_cycle_scores` returns zero rows. No `epoch_scores` rows are created.
3. **Leaderboard fallback produces empty results:** `get_leaderboard()` at `scoring_service.py:462-477` first looks for the max scored cycle. If no `epoch_scores` exist at all, it falls back to `epoch.current_cycle` — which (per the code comment at line 462-464) "points one past the last resolved cycle, so querying it directly returns empty for completed epochs."
4. **Result:** Empty leaderboard returned to script → `finish_game()` records `leaderboard: []`.

The 6% rate correlates with transient infrastructure failures (port exhaustion causing scoring HTTP calls to fail, or MV refresh timeouts under concurrent database load). Games where ALL cycles' scoring attempts fail produce empty leaderboards.

**Missing Controls:**
- No "null strategy" baseline (a player that deploys no operatives) to isolate simulation-template effects from strategic effects
- No strategy-vs-strategy matchup analysis (only aggregate win rates per strategy)
- No variance analysis across parameter configurations (e.g., does high RP favor offense? does betrayal change alliance dynamics?)

---

## 6. Logging & Analysis Pipeline Audit (Game Balance Readiness)

The simulation battery's primary purpose is **game balance analysis**. This section audits whether the logging infrastructure and analysis pipeline produce the data needed to make informed balancing decisions.

### 6.1 Current Data Architecture

**Three data layers exist:**

| Layer | Variable | Content | Granularity | Reset |
|-------|----------|---------|-------------|-------|
| Raw log | `LOG` (line 79) | Print-format text lines | Per-API-call | Per battery |
| Aggregate stats | `STATS` (line 80) | 7 integer counters | Per-player per-game | Per game (line 98) |
| Action log | `CYCLE_ACTIONS` (line 83) | Structured dicts with cycle/phase/player/action/detail/result | Per-action per-cycle | Per game (line 100) |
| Score history | `SCORE_HISTORY` (line 81) | 5 dimension scores + composite | Per-player per-cycle | Per game (line 99) |
| Game results | `ALL_GAME_RESULTS` (line 82) | Leaderboard + stats + scores + actions | Per-game | Per battery |

**What STATS tracks (line 98):**
```
deployed, success, detected, failed, guardians, ci_sweeps, rp_spent
```
Seven aggregate counters per player per game. No breakdown by operative type, phase, or cycle.

**What CYCLE_ACTIONS captures (line 109-117):**
```python
{"cycle": int, "phase": str, "player": str, "action": str, "detail": str, "result": str}
```
Action types observed in the codebase:
- `deploy_guardian` / `deploy_spy` / `deploy_saboteur` / `deploy_assassin` / `deploy_propagandist` / `deploy_infiltrator` (line 477-481)
- `outcome_spy` / `outcome_saboteur` / etc. with `SUCCESS` / `DETECTED` / `FAILED` (lines 524-539)
- `counter_intel` with `caught=N` (line 496-498)
- `score` with all 5 dimension values + composite (lines 558-561)
- `rp_update` with `RP: old→new` and `+delta` (lines 571-572)

**What `finish_game()` stores per result (lines 681-689):**
```python
{"name", "desc", "epoch_id", "leaderboard", "stats", "scores", "actions", "tags"}
```

**What is NOT stored but available in `game_def` (lines 940-952):**
```python
{"config", "strategies", "ci_freq", "alliances", "guardian_counts", "foundation_cycles", "comp_end", "reck_end"}
```
These are discarded after the game runs. The only record is the compressed `desc` string (e.g., `RP:15/50 V=2g/GR=1g s25i20v20d15m20 V=ci_defensive/GR=spy_heavy`).

### 6.2 Analysis Pipeline Inventory

`generate_analysis()` (line 1025-1290) produces 9 sections from the stored data:

| # | Section | Data Source | What It Answers |
|---|---------|------------|-----------------|
| 1 | Summary Table (1038-1072) | Leaderboard | Who won each game? |
| 2 | Win Distribution (1079-1093) | Leaderboard | Which simulation wins most? |
| 3 | Victory Margins (1096-1103) | Leaderboard | How close are games? |
| 4 | Avg Scores by Dimension (1105-1119) | Leaderboard | Which dimensions does each sim excel at? |
| 5 | Aggregate Mission Stats (1121-1134) | STATS | Total ops deployed/success/failed per sim |
| 6 | Score Dimension Analysis (1136-1156) | Leaderboard | Are dimensions differentiated (std dev check)? |
| 7 | Guardian Impact (1158-1187) | STATS | Does guardian count correlate with winning? |
| 8 | RP Economy (1189-1210) | desc string parse | Does RP/cycle affect margins? |
| 9 | Strategy Effectiveness (1212-1237) | desc string parse | Which strategy preset wins most? |

### 6.3 Critical Gaps for Game Balance Analysis

#### Gap 1: No Per-Operative-Type Statistics

**Problem:** STATS tracks aggregate `deployed`/`success`/`detected`/`failed` — no breakdown by operative type. The critical question "Are spies overpowered compared to saboteurs?" cannot be answered from STATS alone.

**Data exists but unused:** CYCLE_ACTIONS records `deploy_spy`, `deploy_saboteur`, `outcome_spy`, `outcome_saboteur`, etc. (lines 477-481, 524-539). The operative type is embedded in the action string. A per-type analysis section could be generated by parsing `action.startswith("deploy_")` and `action.startswith("outcome_")`.

**What's needed:**
```
| Op Type | Deployed | Success | Detected | Failed | Cost/Op | Success Rate | Avg Prob |
|---------|----------|---------|----------|--------|---------|-------------|----------|
| spy     | 342      | 198     | 89       | 55     | 3       | 58%         | 0.61     |
| saboteur| 187      | 52      | 78       | 57     | 5       | 28%         | 0.35     |
```

**Code evidence:**
- Deploy logs cost at line 478: `f"OK cost={cost}"` and probability at line 481: `f"OK cost={cost} prob={prob}"`
- Outcome logs probability at lines 527-536: `f"→{target_tag} prob={prob}"`
- Both cost and probability are in the `result`/`detail` strings but as unstructured text

#### Gap 2: No Strategy-vs-Strategy Matchup Matrix

**Problem:** Strategy effectiveness (line 1212-1237) only shows aggregate win rate per strategy. ci_defensive has 64% — but this is meaningless without knowing:
- ci_defensive vs spy_heavy: ?%
- ci_defensive vs assassin_rush: ?%
- ci_defensive vs ci_defensive: ?%

**Data exists but not stored:** `game_def["strategies"]` (line 905) contains `{tag: strategy_preset}` for every game. But `finish_game()` doesn't include it in the result dict (line 681-689). The analysis resorts to parsing the `desc` string (lines 1222-1228):
```python
strat_match = f"{tag}="
if strat_match in desc:
    parts = desc.split(strat_match)
    strat = parts[-1].split("/")[0].split(" ")[0]
```
This is fragile — if a tag appears multiple times in the description or the format changes, extraction fails.

**What's needed:**
```
| Matchup              | Games | P1 Wins | P2 Wins | Draw |
|----------------------|-------|---------|---------|------|
| ci_defensive vs spy  | 23    | 18 (78%)| 5 (22%)| 0    |
| ci_defensive vs balanced | 15 | 8 (53%) | 7 (47%)| 0   |
```

For N-player games, the matrix becomes more complex (which strategy predicts placement?).

#### Gap 3: Game Configuration Not Stored Structurally

**Problem:** `finish_game()` stores `desc` (a compressed string) but not the `config` dict. Parameter sensitivity questions require parsing:

- `rp_per_cycle`: Parsed at line 1195: `g["desc"].split("RP:")[1].split("/")[0]` — works but fragile
- `rp_cap`: Not parsed anywhere in analysis
- `foundation_pct`, `reckoning_pct`: Not parsed, not analyzed
- `allow_betrayal`: Not parsed, not analyzed
- `score_weights`: Encoded as `s25i20v20d15m20` in desc, not parsed for correlation
- `max_team_size`: Not parsed, not analyzed

**What's needed:** Store `game_def` directly:
```python
result = {
    ...
    "config": game_def["config"],
    "strategies": game_def["strategies"],
    "ci_freq": game_def["ci_freq"],
    "alliances": game_def.get("alliances"),
    "guardian_counts": game_def["guardian_counts"],
    "phase_timing": {
        "foundation_cycles": game_def["foundation_cycles"],
        "comp_end": game_def["comp_end"],
        "reck_end": game_def["reck_end"],
    },
}
```

#### Gap 4: No Score Trajectory Analysis

**Problem:** SCORE_HISTORY captures per-cycle scores (line 557: `SCORE_HISTORY[tag].append((cycle, sd))`), and this data IS stored in results (line 687: `"scores": {t: list(h) for t, h in SCORE_HISTORY.items()}`). But `generate_analysis()` **never uses it** — the analysis only reads from `g["leaderboard"]` (final scores).

**Questions that could be answered:**
- At which cycle does the eventual winner pull ahead? (Tipping Point Analysis)
- Do games converge (close finish) or diverge (blowout) over time?
- Is the game decided in foundation (guardian advantage) or reckoning (final push)?
- How volatile are score rankings across cycles? (Lead Change Frequency)

**Data is fully available** — SCORE_HISTORY contains `[(cycle, {stability, influence, sovereignty, diplomatic, military, composite}), ...]` per player. This is the richest dataset the battery produces, and it's completely unused in analysis.

#### Gap 5: Counter-Intel Effectiveness Not Aggregated

**Problem:** STATS tracks `ci_sweeps` count, but not how many operatives were caught. The action_log records `caught=N` (line 498: `f"caught={len(caught)}"`), but this count is only in the result string, never aggregated.

**Balance relevance:** ci_defensive dominates at 64% win rate. Understanding CI effectiveness (catch rate per sweep, RP efficiency of CI vs offensive ops) is critical for rebalancing.

**What's needed:** Track `ci_caught` in STATS alongside `ci_sweeps`. Or parse from CYCLE_ACTIONS: actions where `action == "counter_intel"` and extract `caught=N` from result string.

#### Gap 6: No Alliance Impact Analysis

**Problem:** Alliance formation, membership, and betrayal are key game mechanics — but the analysis has no alliance section at all.

**Data partially available:**
- `game_def["alliances"]` exists for ~30% of 3+ player games (line 917: `rng.random() < 0.3`)
- Alliance team IDs are set during `setup_game()` (lines 614-622)
- But `alliances` is not stored in results
- No tracking of: alliance vs solo win rates, betrayal frequency, team size impact, shared intel utilization

#### Gap 7: No RP Efficiency or Remaining RP Tracking

**Problem:** `rp_spent` is tracked (line 473, 494), but not:
- **RP remaining at game end** — was RP wasted by hoarding? (relevant for econ_build strategy analysis)
- **RP efficiency** — composite score gained per RP spent
- **RP wasted on failed deployments** — deploy attempts that returned error (line 484: "FAIL") still deducted RP on the backend even though the script can't distinguish

**Partial data available:** `rp_update` actions in CYCLE_ACTIONS contain `RP: old→new` (line 571-572). The final RP value could be captured, but isn't stored in STATS.

#### Gap 8: No Phase-Based Outcome Analysis

**Problem:** CYCLE_ACTIONS records `phase` (line 112) for every action — foundation, competition, reckoning, resolve, score, rp_grant. But the analysis never groups by phase.

**Balance relevance:**
- Are saboteurs more effective in reckoning (when zone stability matters most)?
- Does guardian deployment in foundation predict competition success?
- Is the reckoning phase actually decisive, or are games settled by then?

**Data is fully available** — every action has a phase field. A phase-based breakdown of operative deployment and outcomes would answer these questions.

#### Gap 9: Agent Aptitude Correlation Lost

**Problem:** The script uses aptitude-aware agent selection (`best_agent_for()` at line 68-74) and logs aptitude in the deploy detail string (line 450: `f"{agent_name} (apt:{apt_level}) as guardian"`, line 463: `f"{agent_name} (apt:{apt_level}) → {target_tag}"`). But:
- Aptitude level is embedded in the detail string, not a structured field
- No analysis correlates aptitude with success probability or outcome
- Can't answer: "Does deploying a high-aptitude spy actually improve success rate in practice?"

#### Gap 10: Success Probability vs Actual Outcome Not Analyzed

**Problem:** Every deployment records predicted success probability (line 471: `mission.get("success_probability", "?")`), and every outcome records actual result. But there's no calibration analysis — does the probability model actually predict outcomes correctly?

**What's needed:** For every mission with known probability, compare predicted vs actual:
```
| Probability Bucket | Missions | Actual Success Rate | Calibration Error |
|-------------------|----------|-------------------|-------------------|
| 0.0-0.2           | 45       | 12%               | -2pp (good)       |
| 0.2-0.4           | 89       | 31%               | +1pp (good)       |
| 0.4-0.6           | 123      | 49%               | -1pp (good)       |
| 0.6-0.8           | 78       | 58%               | -12pp (MISCALIBRATED) |
```

This data IS available in CYCLE_ACTIONS (probability in deploy detail/result, outcome in outcome result) but requires parsing unstructured strings.

### 6.4 Root Problem: Structured Data Encoded as Strings

The fundamental architectural issue is that rich structured data is encoded into human-readable strings and then must be re-parsed for analysis:

| Data Point | Where It's Captured | Format | Parseable? |
|-----------|-------------------|--------|-----------|
| Operative type | action_log `action` field | `"deploy_spy"`, `"outcome_spy"` | Yes — split on `_` |
| RP cost | action_log `result` field | `"OK cost=4"` | Fragile — regex needed |
| Success probability | action_log `result` field | `"OK cost=4 prob=0.65"` | Fragile — regex needed |
| Aptitude level | action_log `detail` field | `"AgentName (apt:8) → GR"` | Fragile — regex needed |
| CI caught count | action_log `result` field | `"caught=3"` | Fragile — regex needed |
| Strategy preset | game `desc` field | `"V=ci_defensive/GR=spy_heavy"` | Very fragile — multi-split |
| RP per cycle | game `desc` field | `"RP:15/50"` | Fragile — split on `:` and `/` |
| Score weights | game `desc` field | `"s25i20v20d15m20"` | Very fragile — position-dependent parse |
| RP remaining | `rp_update` action `detail` | `"RP: 12→22"` | Fragile — split on `→` |

**Contrast:** `game_def` (line 940-952) contains ALL of this as structured Python dicts — but `finish_game()` discards it.

### 6.5 Remediation: Logging & Analysis Pipeline (P3)

#### P3.1: Store `game_def` in Results (Critical)

In `run_parametric_game()` (line 955-1020), pass `game_def` through to `finish_game()` and include in result dict:

```python
result = {
    ...existing fields...,
    "config": game_def["config"],
    "strategies": game_def["strategies"],
    "ci_freq": game_def["ci_freq"],
    "alliances": game_def.get("alliances"),
    "guardian_counts": game_def["guardian_counts"],
    "phase_timing": {
        "foundation_cycles": game_def["foundation_cycles"],
        "comp_end": game_def["comp_end"],
        "reck_end": game_def["reck_end"],
    },
}
```

This eliminates ALL desc-string parsing in `generate_analysis()`.

#### P3.2: Extend STATS with Per-Type Counters (Critical)

Replace the flat counters with nested dicts:

```python
STATS = {
    "deployed": {},           # per-player total (existing)
    "deployed_by_type": {},   # per-player: {"spy": 5, "saboteur": 3, ...}
    "success_by_type": {},    # per-player: {"spy": 3, "saboteur": 1, ...}
    "detected_by_type": {},   # per-player: {"spy": 1, ...}
    "failed_by_type": {},     # per-player: {"spy": 1, ...}
    "ci_caught": {},          # per-player total caught (NEW)
    "rp_remaining": {},       # per-player final RP (NEW)
    ...existing counters...
}
```

Update `deploy()` (line 468-488) to increment `deployed_by_type[tag][op_type]`, and `resolve_and_score()` (line 524-536) to increment `success_by_type[tag][op_type]` etc.

#### P3.3: Structured Action Log Fields (High)

Replace string-embedded data with structured fields in `action_log`:

```python
def action_log(cycle, phase, player_tag, action, detail, result="",
               *, op_type=None, cost=None, prob=None, target=None, aptitude=None, caught=None):
    CYCLE_ACTIONS.append({
        "cycle": cycle, "phase": phase, "player": player_tag,
        "action": action, "detail": detail, "result": result,
        # Structured fields (optional):
        "op_type": op_type, "cost": cost, "prob": prob,
        "target": target, "aptitude": aptitude, "caught": caught,
    })
```

This preserves backward compatibility (detail/result still human-readable) while adding machine-parseable fields.

#### P3.4: Add Analysis Sections (High)

New sections for `generate_analysis()`:

1. **Per-Operative-Type Effectiveness** — table from `deployed_by_type`/`success_by_type`
2. **Strategy Matchup Matrix** — from `game_def["strategies"]` (after P3.1)
3. **Score Trajectory** — from SCORE_HISTORY: tipping point cycle, convergence metric, lead changes
4. **Phase-Based Outcomes** — from CYCLE_ACTIONS grouped by `phase`
5. **CI Effectiveness** — from `ci_caught` stat: catch rate per sweep
6. **Alliance Impact** — from `game_def["alliances"]` (after P3.1): alliance vs solo win rates
7. **Parameter Sensitivity** — from `game_def["config"]` (after P3.1): RP, betrayal, foundation_pct correlations
8. **Probability Calibration** — predicted vs actual success rates by bucket

#### P3.5: Export Structured Data (Medium)

In addition to the markdown analysis, export `ALL_GAME_RESULTS` as JSON for external analysis tools:

```python
with open(md_path.replace("-analysis.md", "-data.json"), "w") as f:
    json.dump(ALL_GAME_RESULTS, f, indent=2, default=str)
```

This enables analysis in pandas/jupyter without re-running the battery.

---

## 7. Implementation Contract

This section defines the binding constraints for the overhaul implementation. Every decision must be evaluated against these principles.

### 7.1 Architecture Principles (Non-Negotiable)

1. **SAUBERSTE ARCHITEKTUR** — No hacks, no temporary shortcuts, no TODO-later patches. If a workaround seems necessary, the design is wrong — fix the design.

2. **POSTGRES-LOGIK IN POSTGRES** — If an operation is more efficient or more atomic as a Postgres RPC/function (e.g., batch user provisioning, atomic score computation, idempotent test user upserts), it belongs in a migration, not in Python. The simulation scripts already use `_psql()` for direct SQL — extend this pattern for test infrastructure.

3. **4 PERSPEKTIVEN bei jeder Entscheidung:**
   - **Architekt:** Separation of Concerns, Error Contracts, Testbarkeit, Modularität
   - **Game Designer:** Beeinflussen die Änderungen die Spielbalance-Daten? Bleibt die Vergleichbarkeit mit den v2.1-Ergebnissen erhalten?
   - **Developer Experience:** Sind Fehler debuggbar? Sind Logs korrelierbar? Kann man einen leeren Leaderboard auf seine Root Cause zurückverfolgen?
   - **QA/Research:** Bleibt statistische Validität erhalten? Sind Ergebnisse reproduzierbar? Ist das Konfidenzintervall dokumentiert?

4. **REFACTOR WO SINNVOLL** — Die 1465-Zeilen-Monolith `epoch_sim_lib.py` darf modularisiert werden (z.B. `sim_client.py`, `sim_player.py`, `sim_phases.py`, `sim_strategy.py`, `sim_analysis.py`, `sim_infra.py`), aber NUR wenn es die Implementierung der Remediations vereinfacht. Kein Refactoring um des Refactorings willen. Die handcrafted Scripts (`simulate_epoch_2p.py` etc.) sind stabile Testszenarien — Refactoring dort nur für den CK→GR Fix (P1.1).

5. **KEINE GLOBALEN VARIABLEN** — Wo möglich, State in Klassen/Kontextobjekte verlagern. Die 15 mutable Globals (`LOG`, `STATS`, `SCORE_HISTORY`, `ALL_GAME_RESULTS`, `CYCLE_ACTIONS`, `_current_cycle`, `_current_phase`, `_active_tags`, `_current_players`, `_game_start_time`, `_api_call_count`, `_game_total_failures`, `_consecutive_failures`, `_http_client`, `ANON_KEY`) machen den Code fragil und nicht-reentrant. Ein `GameContext`-Objekt das per-Game-State kapselt und ein `BatteryContext` für battery-weiten State wäre die Zielarchitektur.

6. **ERROR CONTRACT** — `api()` muss einen klaren Contract haben: Erfolg ≠ Fehler ≠ leere Daten. Caller müssen programmatisch unterscheiden können. Die aktuelle `return {}`-Semantik (Zeile 268-296) ist der Hauptgrund für "unknown error"-Kaskaden.

7. **DETERMINISMUS BEWAHREN** — Alle Seed-basierten RNG-Patterns (`random.Random(seed)` bei Zeile 1397, Seeds 2000/3000/4000/5000) müssen nach Refactoring identische Ergebnisse liefern. Wenn die Reihenfolge der `rng.sample()`/`rng.choice()`-Aufrufe sich ändert, ändern sich alle generierten Spiele. Das muss vermieden oder explizit als Breaking Change dokumentiert werden.

8. **BESTEHENDE TESTS BEWAHREN** — Prüfe `backend/tests/integration/test_cycle_resolution.py` und andere relevante Testdateien. Stelle sicher, dass nach Backend-Änderungen (P1.9 Leaderboard Hardening) alle Tests weiterhin bestehen.

### 7.2 Implementation Order

Die Reihenfolge ist kritisch — spätere Items bauen auf früheren auf.

| Step | Item | Abhängigkeit | Begründung |
|------|------|-------------|------------|
| 1 | **P1.1** CK→GR Fix | Keine | Unblocks alle Scripts. Rein mechanischer Find-Replace. |
| 2 | **P1.5 + P1.6 + P1.7** Quick Fixes | P1.1 | try-except, all_out dead code, Datum. Schnelle, isolierte Fixes. |
| 3 | **P1.3 + P1.4** Fehlerbehandlung | P1.1 | Join Validation + Instance Gate. Verhindert stille Kaskaden. |
| 4 | **P1.2** Unique Users | P1.1, P1.3, P1.4 | Größter Brocken. Benötigt ggf. neue Migration für Test-User-Provisioning-RPC. Braucht funktionierende Fehlerbehandlung (P1.3/P1.4) um Probleme sichtbar zu machen. |
| 5 | **P1.8** Redundante Calls | P1.2 | Erst nach Unique Users, damit die optimierte Pipeline mit echten Multi-User-Games getestet werden kann. |
| 6 | **P1.9** Leaderboard Hardening | Keine (Backend) | Unabhängiger Backend-Fix. Kann parallel zu P1.2 entwickelt werden. |
| 7 | **P2.1** Error Contract | P1.3, P1.4 | Refactoring des `api()`-Returns. Alle bisherigen Caller-Fixes (P1.3, P1.4) müssen auf den neuen Contract angepasst werden. |
| 8 | **P3.1 + P3.2 + P3.3** Data Infrastructure | P1.8 | game_def Storage, Per-Typ STATS, strukturierte Action-Log-Felder. Braucht die bereinigte Pipeline (P1.8) als Basis. |
| 9 | **P3.4** Neue Analyse-Sections | P3.1, P3.2, P3.3 | 8 neue Analyse-Sections. Braucht die erweiterten Datenstrukturen aus Step 8. |
| 10 | **P3.5 + P2.2** Export + Dokumentation | P3.4 | JSON-Export und Socket-Leak-Doku als letzter Schritt. |

### 7.3 Verification Protocol

Nach **jeder** Änderung:

1. **Lint:** `cd backend && ruff check . && cd ../frontend && npx tsc --noEmit` (falls Backend-Dateien geändert)
2. **Tests:** `cd backend && python -m pytest tests/ -x -q` (falls Backend-Services geändert, insb. P1.9)
3. **Determinism Check** (nach P1.1, P1.5, P1.6, P3.2, P3.3): Verifiziere, dass `generate_parametric_game(1, 2, ["V","GR","SN","SP"], random.Random(2000))` identische Ergebnisse liefert wie vor der Änderung
4. **Commit:** Ausführlichste Commit-Messages — erkläre WARUM, nicht nur WAS. Referenziere das Audit-Dokument und die P-Nummer.
5. **Status-Update:** Step-by-step Updates nach jedem abgeschlossenen P-Item

### 7.4 Success Criteria

Die Überarbeitung ist abgeschlossen wenn:

- [ ] `python scripts/simulate_epoch_all.py 2` läuft ohne Crash (P1.1-P1.5 verifiziert)
- [ ] Multi-Player-Games haben >1 Participant im Leaderboard (P1.2 verifiziert)
- [ ] Kein "unknown error" mehr in Logs — alle Fehler haben Detail-Messages (P2.1 verifiziert)
- [ ] `generate_analysis()` produziert alle 8 neuen Sections (P3.4 verifiziert)
- [ ] `-data.json` Export enthält `config`, `strategies`, `alliances` pro Game (P3.1 + P3.5 verifiziert)
- [ ] Bestehende Backend-Tests bestehen weiterhin (P1.9 verifiziert)
- [ ] Empty Leaderboard Rate < 1% (P1.9 verifiziert — war vorher 6%)

---

## 8. Technical Appendixes

### 8.1 File Reference Index

| File | Role | Key Locations |
|------|------|---------------|
| `scripts/epoch_sim_lib.py` | Main simulation library (1465+ lines) | `ALL_SIMS` (32-38), `api()` (223-296), `setup_game()` (594-662), `run_foundation()` (712-723), `generate_parametric_game()` (894-913), `run_parametric_battery()` (1361-1464) |
| `scripts/simulate_epoch_all.py` | Unified parametric battery entry point | Tag lists at 23, 34, 46, 58 |
| `scripts/simulate_epoch_2p.py` | 2P handcrafted games (10 scenarios) | CK references throughout |
| `scripts/simulate_epoch_3p.py` | 3P handcrafted games (9 scenarios) | CK references throughout |
| `scripts/simulate_epoch_4p.py` | 4P handcrafted games (10 scenarios) | CK references throughout |
| `scripts/simulate_epoch_5p.py` | 5P handcrafted games (8+ scenarios) | CK references throughout |
| `backend/services/epoch_participation_service.py` | Join logic with user_id check | 82-118 (duplicate checks + insert) |
| `backend/services/operative_mission_service.py` | Deploy logic with spend_rp + battle log | 160-162 (spend_rp), 241-248 (non-blocking BattleLog) |
| `backend/services/cycle_resolution_service.py` | RP grant + spend_rp implementation | 50-97 (spend_rp with optimistic lock), 360-365 (RP grant in resolution) |
| `backend/services/epoch_lifecycle_service.py` | Epoch lifecycle (start, advance) | 132-136 (foundation RP grant) |
| `backend/services/battle_log_service.py` | Non-blocking log service | 51-59 (internal try-except) |
| `backend/routers/epochs.py` | Epoch API endpoints | 361-376 (join_epoch passes user.id) |
| `backend/services/scoring_service.py` | Scoring pipeline + leaderboard | 30-67 (compute_cycle_scores with MV refresh), 447-494 (get_leaderboard with fallback) |
| `backend/services/constants.py` | RP costs + deploy/mission cycles | 47-54 (OPERATIVE_RP_COSTS), 69-85 (deploy/mission cycles) |
| `supabase/migrations/20260304185712_049_open_epoch_participation.sql` | user_id column + unique index + RLS | 43-45 (CHECK), 49-51 (UNIQUE INDEX), 78-89 (RLS policies) |

### 8.2 Failure Cascade Sequence Diagram

```
                    simulate_epoch_all.py
                    tags = ["V", "CK", ...]
                            |
                            v
                    epoch_sim_lib.py: run_parametric_battery()
                    generate_parametric_game() samples "CK"
                            |
                            v
                    setup_game(token, name, config, tags)
                            |
                    +-------+-------+
                    |               |
            [CK in tags?]    [CK not in tags]
                    |               |
                    v               v
            Player("CK",       Player("GR",
            ALL_SIMS["CK"],    ALL_SIMS["GR"],
            token)             token)
                    |               |
                    v               v
            KeyError: 'CK'    Continue to join
            BATTERY CRASHES         |
                                    v
                            api("POST", /participants, p1)
                            user_id = admin_uuid --> SUCCESS
                                    |
                            api("POST", /participants, p2)
                            user_id = admin_uuid --> 409 CONFLICT
                                    |
                            api() returns {} (swallowed)
                            response not captured (line 612)
                                    |
                            p2.instance_id = None
                                    |
                            validation logs "FATAL" but continues (652-655)
                                    |
                            deploy(epoch_id, p2, ...)
                            api("POST", /operatives?simulation_id=None)
                            --> 400 Bad Request --> "unknown error"
```

### 8.3 Migration 049 Impact Assessment

Migration 049 (`20260304185712_049_open_epoch_participation.sql`) introduces:

1. **`user_id` column** on `epoch_participants` (FK to `auth.users`, nullable)
2. **CHECK constraint** `epoch_participants_user_id_required`: `is_bot = true OR user_id IS NOT NULL` -- human players MUST have a user_id
3. **Partial unique index** `epoch_participants_user_epoch_unique`: ensures one human player per epoch
4. **RLS policy rewrites**: INSERT requires `user_id = auth.uid() OR is_bot = true`; DELETE requires `user_id = auth.uid()`

All changes are architecturally correct for production use. The constraint correctly enforces that each human user can participate in an epoch at most once (preventing alt-account abuse). Bot players (`is_bot = true`) are exempt because they have no user association.

The test harness incompatibility stems from using a single admin JWT for all simulated "human" players. The fix belongs in the test harness (unique user provisioning), not in the database schema.

### 8.4 resolve_cycle_full Pipeline Reference

The full 12-step pipeline as documented in the `resolve_cycle_full` docstring (`cycle_resolution_service.py:164-178`):

| Step | Operation | Service | Location | Error Handling |
|------|-----------|---------|----------|----------------|
| 1 | **RP grant** (foundation: 1.5x bonus) | `CycleResolutionService.resolve_cycle()` → `_grant_rp_batch()` | `cycle_resolution_service.py:360-365` | Raises HTTPException |
| 2 | **Reset cycle_ready flags** | Direct DB update | `cycle_resolution_service.py:367-370` | In resolve_cycle() |
| 3 | **Advance mission timers** (subtract cycle_hours) | Direct DB update | `cycle_resolution_service.py:372-393` | In resolve_cycle() |
| 4 | **Increment current_cycle** (optimistic lock) | Direct DB update | `cycle_resolution_service.py:395-402` | In resolve_cycle() |
| 5 | **Alliance upkeep deduction** | `AllianceService.deduct_upkeep()` | `cycle_resolution_service.py:197-207` | try-except + Sentry |
| 6 | **Expire stale alliance proposals** | `AllianceService.expire_proposals()` | `cycle_resolution_service.py:209-216` | try-except + Sentry |
| 7 | **Resolve pending missions** + log results | `OperativeService.resolve_pending_missions()` | `cycle_resolution_service.py:218-232` | try-except + Sentry |
| 8 | **Expire zone fortifications** | RPC `fn_expire_fortifications` or legacy | `cycle_resolution_service.py:234-275` | try-except + Sentry |
| 9 | **Execute bot cycle** (includes proposal voting) | `BotService.execute_bot_cycle()` | `cycle_resolution_service.py:277-288` | try-except + Sentry |
| 10 | **Compute scores** | `ScoringService.compute_cycle_scores()` | `cycle_resolution_service.py:290-297` | try-except + Sentry |
| 11 | **Compute alliance tension** (dissolves teams) | `AllianceService.compute_tension()` | `cycle_resolution_service.py:299-310` | try-except + Sentry |
| 12 | **Send notifications** | `CycleNotificationService` | `cycle_resolution_service.py:312-325` | try-except + Sentry |

**Critical for P1.8:** Steps 1-4 happen inside `resolve_cycle()` (called at line 191). Steps 5-12 happen in `resolve_cycle_full()`. The script currently duplicates steps 7 (mission resolution at `epoch_sim_lib.py:509`) and 10 (scoring at `epoch_sim_lib.py:550`). After P1.8, the script should only call `/resolve-cycle` and retrieve mission results + scores from the response or via follow-up GETs.

**Critical for leaderboard fallback:** Step 4 increments `current_cycle` BEFORE step 10 computes scores. If step 10 fails (MV refresh timeout), `current_cycle` points to a cycle with no scores. `get_leaderboard()` at `scoring_service.py:476-477` falls back to this value → empty leaderboard.

### 8.5 Operative Constants Reference

**RP Costs** (`backend/services/constants.py:47-54`, verified match with `epoch_sim_lib.py:767`):

| Operative | RP Cost | Deploy Cycles | Mission Cycles | Total Cycles |
|-----------|---------|--------------|----------------|-------------|
| spy | 3 | 0 | 3 | 3 |
| guardian | 4 | 0 | 0 (permanent) | permanent |
| propagandist | 4 | 1 | 2 | 3 |
| saboteur | 5 | 1 | 1 | 2 |
| infiltrator | 5 | 2 | 3 | 5 |
| assassin | 7 | 2 | 1 | 3 |

Deploy/mission cycles from `constants.py:69-85`. Spy and guardian deploy instantly (0 deploy cycles). Infiltrator is the slowest to deploy (2 cycles) and longest active (3 cycles = 5 total).

### 8.6 Backend Validation Gates

Critical validation checks in the backend that affect the simulation battery:

| Check | Location | What It Does | Impact on Battery |
|-------|----------|-------------|-------------------|
| **Min 2 participants** | `epoch_lifecycle_service.py:45-53` | `start_epoch()` raises 400 if `len(participants) < 2` | After P1.2 (unique users), ensures multi-player games can't start with 1 player from failed joins |
| **Lobby phase only for join** | `epoch_participation_service.py:59-63` | `join_epoch()` raises 400 if `epoch.status != "lobby"` | Joins must happen before start — timing is correct in script |
| **Template sim only** | `epoch_participation_service.py:75-80` | Rejects non-template sims | ALL_SIMS UUIDs point to templates — correct |
| **user_id uniqueness** | `epoch_participation_service.py:96-109` | 409 if same user_id in epoch | ROOT CAUSE of single-token failure (P1.2) |
| **Optimistic lock on RP** | `cycle_resolution_service.py:83-95` | `spend_rp()` uses `eq("current_rp", current)` on UPDATE | Prevents race conditions in concurrent RP spending |
| **epoch_scores UPDATE RLS** | Migration 042, lines 13-30 | UPDATE requires `created_by_id = auth.uid()` | Scoring RPC uses SECURITY DEFINER → bypasses RLS. But manual score updates require creator auth. |
| **Scoring RPC SECURITY DEFINER** | Migration 127 | `fn_compute_cycle_scores` runs as definer | Bypasses RLS — scoring works regardless of caller auth level |

---

---

## 9. Post-Audit Extension: Fog of War (2026-03-31)

After all P1-P3 remediations were committed (b94fd11), the simulation battery was extended with fog-of-war support to close the gap between the test harness (perfect information) and real gameplay (partial information via RLS).

### 9.1 Problem Statement

All 10 strategy presets in `pick_op_for_strategy()` read opponent state directly (`pl[target].buildings`, `pl[target].agents`). This means:
- Spy deployments had zero tactical value (the strategy already knew everything)
- Saboteur/assassin targeting was always perfect (no intelligence gathering needed)
- Strategy effectiveness data was skewed toward perfect-information equilibria

### 9.2 Implementation

**Backend extension:** `_apply_spy_effect()` in `operative_mission_service.py` now returns `building_ids`, `building_count`, `agent_ids`, `agent_count` alongside existing zone security and guardian data.

**Simulation harness:**
- `IntelSnapshot` dataclass: per-opponent recon state (building_ids, agent_ids, guardian_count, zone_security, scouted flag)
- `Player.intel: dict[str, IntelSnapshot]`: populated from successful spy mission results in `resolve_and_score()`
- `pick_op_for_strategy()`: polymorphic — accepts `Player` (perfect info) or `IntelSnapshot` (fog)
- `strategy_fn` closure: fog branch passes `IntelSnapshot` for operative selection and targeting
- `fog_of_war` parameter: flows from `run_parametric_battery()` through `generate_parametric_game()` to `game_def`

**Key design decisions:**
- Default `IntelSnapshot` assumes `has_buildings=True, has_agents=True` (conservative)
- Assassin without agent IDs falls back to spy (assassin without target has no effect)
- Saboteur without building IDs deploys untargeted (zone downgrade only)
- Handcrafted games unchanged (intentional perfect information)
- `fog_of_war` is per-battery, not per-game (deterministic comparison)

### 9.3 Analysis Additions

Two new sections in `generate_analysis()`:
1. **Fog of War Impact** — strategy win rates under fog, targeted vs untargeted deployment counts
2. **Intel ROI** — spy investment correlation with victory (intel_gathered stat by winners vs losers)

### 9.4 Additional Hardening (same commit)

- `OperativeDeploy` model_validator: enforces `target_entity_type` matches `OPERATIVE_TARGET_TYPE`
- Auto-resolve in `epoch_chat_service.py`: Sentry capture + `auto_resolve_error` flag
- Public router: graceful degradation for `get_platform_stats` and `list_simulations`

*End of Corrective Audit Document*
