# Epoch Mode — Full Audit and Remediation, 2026-08-29

> Complete pass over the competitive epoch subsystem: schema, RLS, RPCs, services, routers,
> scheduler, and the Lit frontend. Every defect below was reproduced before it was fixed —
> the four HTTP 500s were driven through `TestClient` against the real app, not inferred from
> reading the models. All findings in this document are **remediated in the same commit range**
> unless explicitly marked OPEN.
>
> Audited tree: `main`, working tree as of 2026-08-29.

---

## Summary

| # | Finding | Severity | Status |
|:--|:--------|:---------|:-------|
| 1 | Four endpoints returned 500 on every call (response-model drift) | **Critical** | Fixed |
| 2 | `auto_resolve_mode` never sent by any client — whole auto-resolve subsystem dormant | **Critical** | Fixed |
| 3 | Every epoch notification email linked to a 404 | High | Fixed |
| 4 | Four RLS write policies open to any authenticated user | **Critical** | Fixed (migration 275) |
| 5 | `remove_bot` silently deleted nothing, reported success | High | Fixed |
| 6 | `new_cycle` stripped from the ready response — cycle overlay always showed 0 | Medium | Fixed |
| 7 | Dimension titles stripped from `/standings` | Medium | Fixed |
| 8 | ~330 lines of unreachable duplicate scoring logic in Python | Medium | Fixed |
| 9 | Score history shifted one cycle; cycle 1 never got a score row | Medium | Fixed |
| 10 | Phase overlap only rejected at epoch start, after invitations went out | Medium | Fixed |
| 11 | Reckoning phase promised "double points" that cannot exist | Medium | Fixed (docs + UI) |
| 12 | Three config fields accepted and never read | Low | Fixed |
| 13 | Results screen unreachable for signed-out spectators | Low | Fixed |
| 14 | Alliance creation was not atomic | Low | Fixed (migration 275) |
| 15 | Operative costs and durations are global constants, not per-epoch config | Low | **OPEN** (deliberate) |
| 16 | No minimum cycle duration | Low | **OPEN** (needs design) |

---

## 1. Four endpoints returned 500 on every call

`backend/models/epoch.py` carries a block titled *"Typed Responses for Previously Untyped
Endpoints"*. Three of its four models described a shape the service never produced. Because the
project uses return-type annotations as the response model (per `CLAUDE.md`), FastAPI validated
the return value and raised `ResponseValidationError` — a 500 — every single time.

| Endpoint | Service returned | Model required |
|:---------|:-----------------|:---------------|
| `POST /epochs/{id}/pass-cycle` | `{"passed": True}` | `simulation_id` |
| `POST /epochs/{id}/teams/{tid}/join` | participant row | `action` |
| `POST /epochs/{id}/teams/leave` | participant row | `action` |
| `GET /epochs/{id}/results-summary` | `score_history` as `dict[sim_id, list]` | `list[dict]` |

The join/leave/pass failures are the worst kind: **the write had already committed** when
serialisation failed. A player joined the alliance and saw "Failed to join". The frontend's own
`ResultsSummary` type was correct all along — the backend model was the one that had drifted,
which is why this went unnoticed.

This also closes the open item recorded in memory as *"Results tab: still shows 'No results
available' for completed epochs — need `end_epoch()` to copy latest scores into `final_scores`"*.
The cause was never `final_scores`; the endpoint 500'd and `EpochResultsView` renders its empty
state on any failed response.

**Fix.** Services now return the contract shape (`pass_cycle` answers with the participant's
cycle state, `join_team`/`leave_team` carry their `action`); `ResultsSummaryResponse` was
corrected to `dict[str, list[dict]]` and gained the `epoch` block it always returned.
Regression test: `backend/tests/integration/test_epoch_response_contracts.py`.

---

## 2. The auto-resolve subsystem was unreachable

`EpochCreationWizard` sent ten config fields. `auto_resolve_mode` was not among them — neither
did `AcademyService`, and `updateEpoch()` exists in the API service with no caller. **Every epoch
ever created through the UI therefore ran in `manual` mode**, and everything gated on
`!= "manual"` was dead code in production:

- cycle deadline and countdown (`cycle_resolution_service.py:132`)
- the `EpochCycleScheduler` — running a query every 30 s since launch, structurally unable to
  find a row, because no epoch ever had a `cycle_deadline_at`
- the activity gate, the Pass button, AFK penalties, and AI takeover
  (`EpochReadyPanel.ts:409, 485, 651`)

Two ironies compound it: the model comment at `models/epoch.py:59` claimed *"Epoch creation UI
sets `activity_gated` as the recommended value"* — it did not; and the Pass button that `manual`
mode never rendered would have hit finding #1's 500 on click. Each defect hid the other.

Of the five modes in the `Literal`, three carried `# not yet implemented`.

**Fix.** The wizard has a *Cycle Resolution* step — a segmented control (**Ready or Deadline** /
**All Players Ready**), a deadline slider, and toggles for *Require Action Before Ready* and
*Absence Penalties*. All four format presets carry a sensible deadline. New epochs get
`activity_gated`; existing ones stay `manual` (the backend default is unchanged). The three
unimplemented modes were **removed from the `Literal`** — a value the config accepts but no code
path honours reads as a working feature at every `!= "manual"` comparison.

---

## 3. Every notification email linked to a 404

`/epoch/{uuid}` was never a registered route. Only `/epoch` and `/epoch/join` existed. All three
notification CTAs pointed there (`cycle_notification_service.py:659, 723, 801`) — cycle
notification, phase change, epoch completed. Same class of defect in onboarding: the academy
hand-off navigated to `/epochs/${id}` (plural, `app-shell.ts:1273`), also unregistered. Both fell
through to `velg-not-found`.

**Fix.** `/epoch/:epochId` registered after `/epoch/join` so the literal segment still wins;
`EpochCommandCenter` takes an `epochId` property and preselects that epoch, falling back to a
direct fetch for epochs outside the active/past lists. Onboarding navigation corrected. Epochs
are now linkable at all — previously there was no way to share one.

---

## 4. Four RLS write policies open to any authenticated user

Migration 213 ("Epoch Security Hardening") fixed exactly one instance of a pattern migration 032
had seeded five times. It narrowed `epoch_scores` UPDATE to `service_role` and left the siblings:

| Table | Policy | Reachable effect |
|:------|:-------|:-----------------|
| `epoch_participants` | `FOR UPDATE USING (true)`, no `WITH CHECK` | rewrite **any** participant row: `current_rp`, `cycle_ready`, `team_id`, `drafted_agent_ids`, `final_scores`, `betrayal_penalty` |
| `epoch_teams` | INSERT + UPDATE `(true)` | rename or dissolve a stranger's alliance |
| `epoch_scores` | `FOR INSERT WITH CHECK (true)` | UPDATE was closed in 213, INSERT was not — a crafted future-cycle row poisons the leaderboard |
| `battle_log` | `FOR INSERT WITH CHECK (true)` | forge narrative events |

There is no blanket `REVOKE ... ON ALL TABLES` anywhere in the repo, so Supabase's default table
grants apply and RLS was the only gate. Reachable with the public anon key plus any logged-in JWT.
The `epoch_participants` hole is strictly worse than the one 213 closed: scores are derived, RP is
spendable.

**Fix — migration 275**, two independent layers:

- **RLS**: writes representing *server* decisions (scores, battle log, team lifecycle, RP,
  penalties, AFK bookkeeping) are `service_role`-only. Participant UPDATE for `authenticated` is
  narrowed to `user_id = (SELECT auth.uid())` with a matching `WITH CHECK`.
- **Column grants**: `REVOKE UPDATE ... FROM authenticated` then
  `GRANT UPDATE (cycle_ready)`. Column privileges are checked *before* RLS, so a crafted PATCH
  touching `current_rp` is rejected even on the caller's own row. `team_id` is deliberately not
  granted — writing it directly bypasses the `max_team_size` check in `fn_join_team_checked`.

Backend counterparts, all behaviourally neutral: `BattleLogService` resolves the service-role
client internally for its single insert path; betrayal penalty and alliance dissolution
(`operative_mission_service.py`) move to the admin client — both mutate *other* players' rows;
`draft_agents` writes the roster privileged; `create_team`/`leave_team` go through the new
`fn_create_team_atomic` / `fn_leave_team`.

---

## 5. `remove_bot` deleted nothing

Bot participant rows are inserted without a `user_id`. The DELETE policy from migration 049 is
`user_id = auth.uid()`, so it never matched a bot row — and the router ran on the user client.
Removing a bot from a lobby affected zero rows and returned `"Bot removed."`

**Fix.** The endpoint runs on the admin client (creator authorisation is already enforced by
`require_epoch_creator()`), and the service now raises when the DELETE matches nothing. The unit
test that encoded the broken behaviour (`data=[]` asserted as success) was corrected, and a
second test pins the new failure path.

---

## 6–7. Two fields silently stripped by response models

**`new_cycle`** — `toggle_ready` sets it after an auto-resolve, and `EpochReadyPanel` reads it to
drive the cycle-advance overlay and the realtime broadcast. `PassCycleResponse` did not declare
it, so Pydantic dropped it and the overlay always animated "Cycle 0".

**Dimension titles** — `get_final_standings` awards `stability_title`, `influence_title`, … to the
best performer per dimension ("Master Spy", "Iron Guardian", …). `LeaderboardEntry` had no such
fields, so `/standings` dropped every one and `EpochResultsView._getDimensionTitle()` always read
`undefined`. The feature had never been visible.

**Fix.** Both declared on their models, with a comment saying why they must stay.

---

## 8. A shadow scoring implementation

`_compute_raw_scores`, five `_compute_*` dimension helpers, and `_normalize_and_composite`
(~330 lines) were reachable **only from their own unit tests**. Production scoring runs entirely
through `fn_compute_cycle_scores` (migration 127, refreshed in 187). Two sources of truth for the
same rules, one of them unreachable and green: tuning the Python changed nothing in production
while the tests kept passing.

**Fix.** Deleted, along with the ~880 lines of tests that exercised only it. The SQL function is
the rules; `MISSION_SCORE_VALUES`, `DETECTION_PENALTY`, and the guardian bonus constants remain in
`constants.py`, now explicitly labelled as mirrors for documentation and test assertions with a
note to change the migration first.

---

## 9. Score history shifted by one cycle

`resolve_cycle_full` read `current_cycle` *after* `resolve_cycle()` had already incremented it,
then used that single number for everything. Mission outcomes, scores, and alliance tension —
all records of what just happened — were therefore labelled with the cycle players were about to
act in. Consequence: **cycle 1 never received a score row** and every history chart was shifted
one to the right.

**Fix.** The two numbers are now distinct. `resolved_cycle` labels what is being recorded
(mission results, scoring, tension, journal signature); `cycle_number` stays for what looks
forward (bot turns, upkeep against the RP just granted, expiry checks against `expires_at_cycle`
— changing those would alter proposal and fortification lifetimes).

---

## 10. Phase overlap caught too late

`foundation_cycles + reckoning_cycles < total_cycles` was only checked in `start_epoch()` — after
the lobby had filled and invitations had gone out. The wizard's sliders happily produced 1 day /
24 h cycles (1 cycle total) with foundation 1 + reckoning 2, displayed "Competition 0 cycles", and
created the epoch.

**Fix.** `EpochConfig.validate_phase_budget` rejects it at construction; the wizard shows an
inline warning and blocks the step. The `start_epoch()` check stays as the last line of defence
for legacy epochs whose raw JSONB never passed through the model. All four format presets verified
still valid.

---

## 11. Reckoning promised what it cannot deliver

The phase-transition overlay and battle log announced *"Final cycles – double points"*
(`EpochCommandCenter.ts`, `EpochBattleLog.ts`). No scoring multiplier exists anywhere. The spec's
own claim — *"Bleed permeability doubled, thresholds reduced by 2, cascade depth +1"* — has no
coupling between epoch phase and the bleed subsystem either.

More fundamentally: **a per-cycle multiplier could not affect standings as scoring works today.**
`composite_score` is a snapshot of the most recent cycle, not a sum across cycles, so scaling any
one cycle scales every participant equally. This is a design gap, not a missing implementation.

**Fix.** Both UI strings now state what Reckoning actually changes: alliances are sealed
(`AllianceService.create_proposal` refuses proposals). Spec and player guide corrected, with the
snapshot-vs-cumulative decision recorded as the prerequisite for giving the phase real weight.

---

## 12. Three config fields accepted and never read

- **`referee_mode`** — zero usages. Removed.
- **`min_cycle_duration_minutes`** — zero usages; only a validator referenced it. Removed. See #16.
- **`ends_at`** — written at start, never read back. An epoch ends when `current_cycle` reaches
  `total_cycles`, not when this timestamp passes. Kept (it feeds the schema.org `Event` markup)
  and documented as a projection rather than a deadline.

---

## 13. Results unreachable for spectators

`/epochs/{id}/results-summary` was member-only. Opening a completed epoch signed out selects the
results tab and hit 403 — which the public-first rule in `CLAUDE.md` forbids. The service refuses
anything not `completed`, so every row it returns is already declassified.

**Fix.** Public route added; `getResultsSummary` takes the explicit `mode` parameter per the API
routing rule, and `EpochResultsView` passes it.

---

## 14. Alliance creation was not atomic

`create_team` inserted the team, then updated the creator's `team_id` in a separate statement. A
failure between them stranded an alliance with zero members that still appeared in listings.

**Fix.** `fn_create_team_atomic` (migration 275) does both in one transaction and rolls the team
back if the creator is not enrolled (ADR-007).

---

## Addendum, same evening — what the first production run found

Migration 275 shipped and `activity_gated` was play-tested against production
for the first time (see `Verification` below for the method). The subsystem
works: the scheduler swept an expired deadline, advanced cycle 1 to 2, moved the
epoch from foundation to competition, and re-armed the deadline at exactly the
configured 2-hour interval.

Running it also surfaced two defects that this audit could not have found,
because the code had never executed.

### 15. `battle_log` rejects the automatic cycle path

`battle_log_event_type_check` enumerates 29 event types. It carries
`cycle_resolved` and `player_passed` — the *manual* path — and never gained the
four the *automatic* path emits, all from `epoch_cycle_scheduler.py`:
`cycle_auto_resolved`, `player_afk`, `player_afk_penalty`,
`player_afk_ai_takeover`. Migration 204 added the columns and the RPCs and
forgot the constraint.

Two independent layers of concealment:

1. `activity_gated` was never sent by a client, so the scheduler's sweep never
   matched a row and the code never ran (finding 2).
2. `BattleLogService.log_event` catches `PostgrestAPIError`, logs it, and
   returns the unsaved dict. A rejected insert therefore does not raise — the
   cycle resolves anyway, just with a hole in its record. Nothing reaches the
   user or Sentry.

The second is the more general lesson: **a sink that swallows its own failures
makes every contract break behind it invisible.** The audit read this code and
did not flag it, because on the manual path every emitted type happens to be
allowed.

Fixed in migration 276, which rewrites the constraint in full (a CHECK cannot be
extended in place) and documents the rule: a new `log_event` type extends the
list in the same migration. Verified on production with a transactional dry run
— the four types are accepted, and an invented type is still rejected, so the
constraint did not silently become a no-op.

### 16. `GET /epochs/active` returned 500 for every caller

```text
ResponseValidationError: data[6].created_by_id
UUID input should be a string, bytes or UUID object, input: None
```

`game_epochs.created_by_id` is nullable — system-created academy epochs have no
creator, and one such row exists in production. `EpochResponse` declared it a
required `UUID`, and because return annotations are the response model here, a
NULL is a guaranteed 500 rather than a null in the payload.

This is finding 1's class reached through the **data** instead of through a
service's return shape, which is exactly why auditing the services did not
surface it. `GET /epochs` kept answering 200 only because the frontend always
sends a status filter that happened to exclude the offending row.
`AdminApiService.ts` had already declared the field `string | null`.

Checking the *pattern* rather than the reported field — the lesson from finding
4 — turned up a second mismatch: `current_cycle` is nullable in the schema and
typed `int`. The answer there is the opposite one. A cycle counter has no
meaningful NULL, the column already carries `DEFAULT 0`, and production holds
zero NULLs, so integrity belongs in SQL: migration 276 sets it `NOT NULL`
instead of widening the model and making the whole frontend defend against it.

Regression tests in `TestNullableColumnContracts`
(`backend/tests/integration/test_epoch_response_contracts.py`) drive both
endpoints through the real app with a row shaped like the production one. They
were checked against the old model first and fail there — a regression test that
cannot fail is not one.

## Open items

**#15 — Operative costs and durations are global constants.** `OPERATIVE_RP_COSTS`,
`OPERATIVE_DEPLOY_CYCLES`, `OPERATIVE_MISSION_CYCLES`, `FORTIFICATION_RP_COST` and
`FORTIFICATION_DURATION_CYCLES` live in `constants.py` and cannot be tuned per epoch. This is in
tension with *"never hardcode mappings that should be configurable"*, but making them per-epoch
would add twelve more fields that the wizard does not surface — trading one problem for a larger
one. Left as deliberate global game rules; revisit together with a balance-tuning surface.

**#16 — No minimum cycle duration.** With `activity_gated` now actually reachable, four players
clicking ready in quick succession can resolve a cycle in seconds. The removed
`min_cycle_duration_minutes` field described the guard but never implemented it. A real
implementation belongs in the scheduler sweep (earliest-resolve timestamp alongside the deadline),
not in a config field with no effect.

---

## Self-review of this remediation

The fixes above were re-read with fresh eyes after the fact. Six defects in the
remediation itself were found and corrected in the same working tree:

| Found in my own work | Why it mattered |
|:---------------------|:----------------|
| `draft_agents` had **no authorisation gate at all** — and moving it to the admin client removed the (already broken) RLS layer without adding one | Any authenticated user could overwrite any player's roster before the epoch started. Fixed with `require_epoch_participant_path()`. The comment I had written — "validated above and then written by the server" — described validation of the *agents*, not the *caller*, and read as reassurance it had not earned. |
| The contract test mocked the service, so it pinned the **model**, not the service | It would have stayed green if `pass_cycle` reverted to `{"passed": True}` — precisely the regression it was written for. Rewritten to call the real methods; verified by reintroducing the original bug and watching it fail. |
| The `/epoch/:id` deep link only worked on a cold load | Navigating between two epoch URLs reuses the element, so `connectedCallback` never runs again and the property change was ignored. Added an `updated()` hook. |
| I added a **sixth** copy of `(duration_days * 24) // cycle_hours` | Written while auditing the codebase for duplication. Consolidated into `total_cycles_for()`; the four Python copies now share it (SQL and TypeScript still hold their own, unavoidably). |
| `fn_create_team_atomic` raised an exception the caller matched on with `"participant_not_found" in str(exc)` | The neighbouring `fn_join_team_checked` and `fn_advance_epoch_cycle` both use structured returns. Two error conventions side by side in one file, and string-matching on exception text is brittle. Switched to the `error_code` pattern. |
| `resolved_cycle = max(1, cycle_number - 1)` | A floor guarding against a state that cannot occur — defensive code that hides uncertainty instead of resolving it. Removed after confirming the invariant. |

Two weaknesses were judged and **kept**, with reasons:

- **`BattleLogService` write helpers still take a `supabase` parameter they
  ignore.** Writes resolve the service-role client internally; the argument is
  used only by the read helpers. Removing it means touching ~20 call sites for
  a signature that is documented in the class docstring. It is a wart, and it is
  named as one.
- **`activity_gated` is now the default for new epochs, and that code path has
  never run in production.** Migration 204 was deployed; the code behind it was
  not reachable. Deadline resolution, the AFK escalation ladder and AI takeover
  are covered by unit tests only. **This needs a playtest before it reaches
  real players** — see the deploy note below.

## Verification

- `ruff check backend` — clean
- `pytest backend/tests` — 3456 passed, 179 skipped
- `tsc --noEmit` — clean across all touched frontend files
- `biome check` on touched files — clean
- Frontend lint gates: color-tokens, llm-content, no-empty-catch, no-cast-unknown,
  bureau-panel-frame-last, no-appstate-access-reads — all PASS
- The four 500s reproduced before the fix and verified 200 after, via `TestClient`

Migration 275 has **not** been applied to production. It must be applied before or together with
the backend deploy: the Python changes assume the new RPCs exist, and the RLS tightening assumes
the Python no longer writes those tables on the user client. Deploying either half alone breaks
alliance creation.
