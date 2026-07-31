# Full-Stack Audit — Remediation Plan

> **Source:** Full-stack deep-dive audit, 2026-05-29 (7 parallel review agents + dependency/secret/structural analysis).
> **Codebase snapshot:** ~160K LOC backend (501 `.py`), ~232K LOC frontend (484 `.ts`), 247 migrations, 2,807 backend tests, 875 frontend tests.
> **Overall health at audit time:** B+ (8/10). Strongest: invariant discipline, security hygiene, FE perf. Weakest: dependency/supply-chain hygiene.

## How to use this document

- Each **Work Package (WP)** is sized to land as **one commit** (sometimes a small series). Tick boxes as you go.
- Every WP ends with a **Verify** step and a **Commit** step. Do not skip Verify — the project rule is "run the full lint pipeline after every change."
- Priorities: **P0** = low-risk quick wins (do first), **P1** = medium (real design work), **P2** = long-term.
- `file:line` references are from the audit and may have drifted by a few lines; re-confirm before editing.

### Verification commands (canonical)

```bash
# Backend
.venv/bin/python -m pytest                       # full suite (3.13 venv, NOT system python)
.venv/bin/python -m ruff check backend           # F/E/W/I/N/UP/S/B/A/C4/DTZ/T20/ICN/FAST
.venv/bin/python -m ruff check backend --select F401,F811,F841   # dead-import/var quick check

# Frontend (run from frontend/)
cd frontend && npm run lint:full                 # tsc --noEmit + biome + all 7 lint-*.sh gates
cd frontend && npm test                          # vitest run
```

> ⚠️ Always run `npm run lint:full` (not just the individual `lint-*.sh`) before pushing — it includes biome. Skipping biome caused 2 red-CI commits on 2026-04-22.

### Branch / commit strategy

- [x] Create a working branch off `main`: `git checkout -b chore/audit-remediation-2026-05-29`
- [ ] One WP = one commit (or a tight series). Use the project's "most detailed commit message" style: what, why, impact, verification.
- [ ] Push only when the user asks.

---

## Progress Overview

| WP | Title | Priority | Risk | Status |
|----|-------|----------|------|--------|
| WP-1 | Dead code removal — frontend (8 files) | P0 | Low | ✅ 36d51f7 |
| WP-2 | Dead code removal — backend (models/funcs/consts) | P0 | Low | ✅ 0109e03+44867c3+e806b05+9b4c5c0+82a4bf6+647dbac (all decisions resolved) |
| WP-3 | `@localized()` fix + regression lint gate | P0 | Low | ✅ fa0028d (+ bonus: 8a5eda7 gate-CWD no-op fix, 290962a orphan test) |
| WP-4 | `safeStorage` + observer leak + `console`→`captureError` | P0 | Low | ✅ 408659b |
| WP-5 | `cache_config` DB-TTL: wire or remove | P0 | Low | ✅ b1d4f65 (removed) |
| WP-6 | Dependency reconciliation (pyproject ↔ requirements + lock) | P1 | Med | 🟡 6a/6b (8881c4f) + 6d (7c206eb) done; 6c version bumps remain (one-PR-each) |
| WP-7 | Supabase client lifecycle (singleton anon + teardown) | P1 | Med | ☐ |
| WP-8 | Heartbeat concurrency — atomic RPCs (INV9 + N+1) | P1 | Med-High | ☐ |
| WP-9 | Backend helper adoption (extract_one / paginate / parse_bool) | P1 | Med | ☐ |
| WP-10 | Frontend shared-state adoption (DataLoaderMixin + state comps) | P1 | Med | ☐ |
| WP-11 | Frontend performance fixes (memoize / chunk / lazy / repeat) | P1 | Low-Med | ☐ |
| WP-12 | Shared abstractions (BaseEditModal, CachedSettingsGroup, …) | P2 | Med | ☐ |
| WP-13 | God-file decomposition + content externalization | P2 | Med-High | ☐ |
| WP-14 | Testing & coverage gate uplift | P2 | Low | ☐ |

---

# P0 — Quick Wins (low risk, do first)

## WP-1 — Dead code removal (frontend, 8 files)

**Goal:** Delete orphaned components/modules/services. All independent; touch no live render path. **Risk:** Low.
**Root cause:** "deleted the consumer component, forgot its now-orphaned dependency."

- [ ] Delete `frontend/src/services/NotificationService.ts` (0 importers; live path is `NotificationPreferencesApiService` + toasts).
- [ ] Delete `frontend/src/utils/events.ts` (unused `fire()` helper; code uses inline `new CustomEvent`).
- [ ] Delete `frontend/src/utils/svg.ts` (unused `describeArc`/`circularProgress`; logic is duplicated inline in `AgentMoodPanel.ts:80` and `MapGraph.ts:1151` — leave those inline copies for now, or fold into WP-12).
- [ ] Delete `frontend/src/types/validation/theme.ts` (unused Zod schema; sole file in `types/validation/`).
- [ ] Delete `frontend/src/services/api/CampaignsApiService.ts` **and** remove its barrel re-export at `frontend/src/services/api/index.ts:12`. (Keep the `Campaign` *type* — still used.)
- [ ] Delete `frontend/src/services/api/SocialMediaApiService.ts` **and** remove its barrel re-export at `frontend/src/services/api/index.ts:39`.
- [ ] Delete `frontend/src/components/resonance/ResonanceMonitor.ts` (`<resonance-monitor>` rendered nowhere).
- [ ] Delete `frontend/src/components/resonance/ResonanceCard.ts` (`<resonance-card>` only rendered inside the dead `ResonanceMonitor`).
- [ ] Remove the now-dead import line at `frontend/src/components/platform/SimulationsDashboard.ts:27` (`import '../resonance/ResonanceMonitor.js';`).
- [x] **Verify:** `cd frontend && npm run lint:full && npm test` (expect green; `tsc` proves no live references remain). — `lint:full` green (tsc + biome 478 + 7 gates). Note: 2 **pre-existing** `world-map-styles.test.ts` failures (computeBounds, zoneCategoryColor) from `4b70b52`, unrelated to WP-1.
- [x] **Commit:** `chore(cleanup): remove 8 orphaned frontend modules/components/services` — **36d51f7** (NB: the audit's "duplicate ResonanceMonitor import" + "`Campaign` type re-export at index.ts:44" did NOT exist; only one import + two service re-exports were removed).

## WP-2 — Dead code removal (backend)

**Goal:** Delete orphaned models/functions/constants. **Risk:** Low (Pydantic models are referenced by name in annotations; all verified to 0 refs). Do the **spot-checks** first.

> **STATUS (2026-05-29):** Clear-cut work DONE + committed — `0109e03` (35 unused models + audit.py) & `44867c3` (dead methods/consts/boost-scaffolding). FULL `ruff check backend` clean; pytest 3221 passed (only the 2 known pre-existing reds). Verification primitive: `git grep -nw "<name>" -- 'backend/**/*.py'` (word-boundary, tracked-only — `.venv` gitignored). Spot-checks resolved → `ErrorResponse` (+orphaned `ErrorDetail`) and `GithubWebhookEvent` both DELETED (handlers build inline dicts; webhook parses raw dict). **Decisions RESOLVED + executed:** 2c `bot_game_state` → KEPT (explanatory flag comment, e806b05); 2d → 7 deleted + their tests (e806b05), the larger dead Python scoring cluster also removed (9b4c5c0), and the 2 real gaps WIRED — bond neglect→strain heartbeat phase (82a4bf6) + epoch invitation-acceptance on join (647dbac); WP-5 `cache_config` → REMOVED, static TTLs documented (b1d4f65). `_SYSTEM_ACTOR` left for WP-9 per plan. **→ WP-2 + WP-5 COMPLETE; full pytest 3192 passed, only the 2 known pre-existing reds.**

**2a. Whole-file + clear orphans**
- [ ] Spot-check first: confirm `models/common.py:65 ErrorResponse` and `models/content_drafts.py:364 GithubWebhookEvent` are not intended public/contract types (grep OpenAPI usage, webhook handler). If contract types → keep + add a `# kept: public contract` note instead of deleting.
- [ ] Delete `backend/models/audit.py` (entire file — orphaned `AuditLogResponse`; live read path uses `OpsAuditEntry`).
- [ ] Remove `backend/services/cache_config.py` dead funcs — **see WP-5 first** (the DB-TTL decision gates whether `load_ttls_from_db`/`set_ttls` are deleted or wired).
- [ ] Delete stale aliases `_AUTO_APPLY_EFFECT_TYPES` (`dungeon_engine_service.py:87`) and `_FALLBACK_SPAWNS` (`:88`) + their stale comment (tests use the non-underscore originals).
- [ ] Delete `services/scanning/registry.py:29 get_all_adapters` (0 refs; siblings used). *(Low stakes — keep for API symmetry if preferred.)*

**2b. 36 unused Pydantic models** (remove per file; re-grep each name before deleting)
- [ ] `models/agent_autonomy.py` — remove 7: `PersonalityProfile`(15), `NeedFulfillment`(51), `MoodSummary`(78), `MoodletCreate`(107), `OpinionModifierCreate`(161), `ActivityCreate`(219), `AutonomyConfig`(270). (8 other classes in the file are live — keep.)
- [ ] `models/heartbeat.py` — remove 8: `HeartbeatTickResponse`(20), `HeartbeatEntryResponse`(58), `HeartbeatOverview`(76), `NarrativeArcResponse`(96), `BureauResponseResponse`(133), `AnchorResponse`(191), `CascadeRuleResponse`(212), `HeartbeatDashboard`(248).
- [ ] `models/news_scanner.py` — remove `ScanCandidateResponse`(9), `AdapterStatusResponse`(54), `DashboardResponse`(78).
- [ ] `models/echo.py` — remove `BleedStatusResponse`(96), `MapDataResponse`(108).
- [ ] `models/embassy.py` — remove `EmbassyEventPropagation`(68), `EmbassyGeneratePair`(77).
- [ ] `models/journal.py` — remove `PalimpsestResponse`(160), `ResonanceProfileResponse`(175).
- [ ] Singletons — remove: `bond.py:79 PublicBondResponse`, `broadsheet.py:26 BroadsheetArticle`, `bureau_ops.py:160 SentryBudget`, `chronicle.py:20 ChronicleResponse`, `epoch_invitation.py:32 EpochInvitationPublicResponse`, `memory.py:11 MemoryResponse`, `resonance_dungeon.py:351 DungeonRunDetailResponse`, `social_trend.py:6 SocialTrendCreate`, `user.py:6 UserProfile`. (`common.py:ErrorResponse`, `content_drafts.py:GithubWebhookEvent` only if spot-check cleared.)

**2c. Dead methods** (each 0 production refs — verify-then-delete)
- [ ] `bot_game_state.py` — 8 methods (482, 513, 591, 606, 610, 614, 618, 624). **Confirm with the bot-AI author** these aren't a planned decision surface before deleting; otherwise add `# planned: bot-AI vN` and skip.
- [ ] `generation_service.py:97 generate_agent_partial`, `:904 _parse_or_repair_json`.
- [ ] `external/bluesky.py:388 delete_post` (or keep-but-document as API-completeness).
- [ ] `email_templates.py:502 _bullet_list`.

**2d. Tested-but-never-wired methods** (each has a passing test but no endpoint/caller — decide per item: wire it up OR delete method + its test)
- [ ] `echo_service.py:417 approve_echo` (router `echoes.approve_echo` inlines its own logic — reconcile: should the router call the service?).
- [ ] `alliance_service.py:518 dissolve_team`, `bond/bond_service.py:610 enter_strain`, `content_drafts_service.py:356 mark_conflict` (only `mark_conflict_bulk` used), `embassy_service.py:66 list_for_building`, `epoch_invitation_service.py:161 mark_accepted`, `scoring_service.py:326 _normalize_and_composite`, `combat/skill_checks.py:227 format_check_for_terminal`, `models/forge.py:313 UserWallet`.

**2e. Dead module-level constants**
- [ ] Remove: `external/bluesky.py:36 GRAPHEME_LIMIT`, `agent_mood_service.py:60 STRESS_GAIN_MULTIPLIER`, `scanning/pre_filter.py:83 _BOOST_RE` (compiled regex never `.search`ed), `morning_briefing_service.py:43 MAX_ROUTINE`, `instagram_image_helpers.py` → `IG_HEIGHT_SQUARE`/`CLASSIFICATION_LEVELS`/`STORY_HEADER_Y`/`STORY_LINE_HEIGHT`.
- [ ] `heartbeat_service.py:122 _SYSTEM_ACTOR` — fold into WP-9 (consolidate the system-actor UUID) rather than just deleting.
- [ ] Fix stale comment on `constants.py:55-56 GUARDIAN_OVERCOME_BONUS/_CAP` ("test assertions" — 0 test refs now).

- [x] **Verify:** FULL `ruff check backend` → All checks passed; `.venv/bin/python -m pytest` → 3221 passed, 94 skipped (only the 2 known pre-existing reds). 2d dead-test deletions pending the wire-vs-delete decision.
- [x] **Commit(s):** `0109e03` chore(cleanup): drop 35 unused response models + `44867c3` chore(cleanup): remove dead service methods/constants/boost-scaffolding. (bot_game_state, 2d, cache_config still open — see STATUS note.)

## WP-3 — `@localized()` fix + regression lint gate

**Goal:** Fix the live runtime i18n bug — components rendering `msg()` without `@localized()` show stale strings after a DE↔EN switch (runtime-mode lit-localize). **Risk:** Low.

- [x] **Discovery (authoritative list):** find every custom element that imports `msg` but not `localized`:
  ```bash
  cd frontend && for f in $(git ls-files 'src/**/*.ts'); do \
    grep -lq '@customElement' "$f" && grep -lq "\bmsg(" "$f" && ! grep -q '@localized' "$f" && echo "$f"; done
  ```
  → returned **exactly 10** (not ~11; no extra surfaced). All 10 carry `@customElement` (real registered elements); no render-helper / abstract-base false positives.
- [x] Added `localized` to the existing `@lit/localize` import (merged, not a duplicate line — biome sorts specifiers alphabetically) + `@localized()` above `@customElement` in all 10: `admin/DungeonTerminalPreview.ts`, `chat/core/ChatBubble.ts`, `epoch/MissionCard.ts`, `lore/VelgEvidenceTag.ts`, `multiverse/MapGraph3D.ts`, `platform/HeaderCluster.ts`, `platform/VelgAchievementToast.ts`, `shared/Lightbox.ts`, `shared/VelgAptitudeBars.ts`, `shared/VelgTabs.ts`.
- [x] Added CI gate `frontend/scripts/lint-localized-decorator.sh` (a file with `@customElement` + `msg(` must carry `@localized`), appended to `lint:full` in `frontend/package.json` **and** added as a CI step in `.github/workflows/ci.yml` (the plan omitted ci.yml; the other 7 gates are all there). It self-locates via `cd "$(dirname "$0")/.."` so it scans from the repo-root CWD the pipeline uses.
- [x] **BONUS — pipeline-CWD bug found + fixed (8a5eda7):** `lint-no-empty-catch.sh` + `lint-no-cast-unknown.sh` grep a bare `src/` with no CWD anchor; CI (`working-directory: .`) and `lint:full` (`cd ..`) run them from the repo root → they matched nothing and exited 0 unconditionally (two MANDATORY gates **false-green since inception**). Proven via inject-probe matrix. Fixed by adding the same self-locating `cd` line; both now scan for real and pass clean. `lint-llm-content.sh` already self-located (unaffected); the 4 `frontend/src/`-path gates were always fine.
- [x] **BONUS — orphaned test removed (290962a):** WP-1 deleted `NotificationService.ts` but left `tests/notification-service.test.ts` (failed-suite red on the branch; tsc misses it, vitest resolves test imports independently). WP-14 follow-through.
- [x] **Verify:** `npm run lint:full` green (tsc + biome 477 + 8 gates). `npm test` → 826 pass; only the 2 documented pre-existing `world-map-styles` reds (computeBounds, zoneCategoryColor from 4b70b52) remain. New gate exits 1 on a planted decorator-less element, 0 clean. **Manual runtime DE↔EN re-render check still pending (browser playtest).**
- [x] **Commit:** `fa0028d` fix(i18n): add @localized() to 10 custom elements + regression lint gate.

## WP-4 — `safeStorage` + observer leak + `console`→`captureError`

**Goal:** Close unobserved crash paths + the one real memory leak. **Risk:** Low.

- [x] Created `frontend/src/utils/safe-storage.ts` — `safeStorage.{get,set,remove}` wrapping `try/catch` + `captureError(err, { source: 'safe-storage.<op>' })`. Modelled on `SimulationSwitcher.getLastTab`. Exported as a namespaced object (not bare `get`/`set`/`remove` — too generic at import sites). Doc note: `globalThis.localStorage?.` optional chaining guards only the absent-API case, not the quota/SecurityError throw — this wrapper guards both.
- [x] Routed the 10 unguarded `localStorage` calls through it (line numbers matched the plan exactly, no drift): `layout/SimulationShell.ts` (5) + `layout/SimulationNav.ts` (2) + `heartbeat/DailyBriefingModal.ts` (3). The other ~70 `localStorage` references in `src/` already use optional chaining or try/catch — out of WP-4 scope.
- [x] Fixed the leak: `landing/LandingPage.ts disconnectedCallback` now `disconnect()`s + nulls both observers; promoted the function-local `sectionObserver` to a `_sectionObserver` field (kept the local `const` for observe/unobserve to avoid `this.`-narrowing churn; the field only holds the teardown handle).
- [x] Replaced `console.*` on real error paths with `captureError`: `BureauTerminal.ts:617/690/837` (`_handleKeyDown`/`_handleQuickAction`/`_pollFeed`; added the `captureError` import) + `ChatAudioService.ts:184/189` (`_loadSprite`) + `DungeonAudioService.ts:435` (`_loadSfxSprite`). 617/690 keep their visible terminal `[ERROR]` sysLine; 837 keeps swallow-and-retry, now Sentry-observed. The 2 informational `console.warn` at `ChatAudioService:119/169` (no `err` binding) intentionally left.
- [x] **Verify:** `npm run lint:full` green (tsc + biome 478 + all 8 gates, incl. the now-live `lint-no-empty-catch`). `npm test` 826 pass (only the 2 pre-existing `world-map-styles` reds).
- [x] **Commit:** `408659b` fix(robustness): guard localStorage, fix LandingPage observer leak, observe terminal errors.

## WP-5 — `cache_config` DB-TTL: wire or remove

**Goal:** Resolve a latent functional gap — `get_ttl()` permanently returns hardcoded defaults because `_cache_ttls` is never populated (`load_ttls_from_db` is dead). **Risk:** Low.

- [x] **Decided** (2026-05-29): user chose **REMOVE** — runtime-configurable TTLs not wanted; full wiring was non-trivial (import-time TTLCaches in seo.py/connection_service.py wouldn't pick up a startup load anyway).
  - [ ] **If yes:** wire `load_ttls_from_db()` into app startup (FastAPI lifespan in `backend/app.py`), and have the admin settings write-path call `invalidate()` (or `set_ttls`) so changes take effect. Add a test that a DB TTL override is reflected by `get_ttl()`.
  - [x] **If no (chosen):** deleted `load_ttls_from_db`, `set_ttls`, `_cache_ttls`, and `PlatformSettingsService.get_cache_ttls`; `get_ttl` returns static `DEFAULT_SETTINGS`; `invalidate()` kept as a documented no-op (still called by `admin.py:683`). Fixed the stale `DEFAULT_SETTINGS` comment.
- [x] **Verify:** `pytest -k "cache or platform_setting"` → 51 passed; full `ruff check backend` clean; full pytest 3192 passed.
- [x] **Commit:** `chore(cache): remove unwired DB-TTL path, document static TTLs` — **b1d4f65**.

---

# P1 — Medium (real design work)

## WP-6 — Dependency reconciliation (single source of truth + lock)

**Goal:** Stop local dev and production running different dependency versions, and make builds reproducible. **Risk:** Medium (version bumps can shift behavior — verify under test).

> **STATUS (2026-05-30):** ✅ **6a + 6b DONE — commit `8881c4f`.** Used `uv pip compile --generate-hashes`. pyproject fix: `pydantic-ai` → `pydantic-ai-slim[openai]` (the full meta-package was the ~110-pkg pollution source). New `backend/requirements.txt` = complete hash-lock (75 dists, 1791 hashes), versions HELD at current via constraints except `fastapi` 0.135.1→0.136.3 (the floor-violation fix; compatible with current starlette 0.52.1 — no forced major). **Audit correction:** numpy is NOT test-only — `shapely` requires it at runtime, so it stays. storage3<2.26 held → no pyiceberg. CI gate `scripts/lint-requirements-lock.sh` (fixpoint recompile + name==version set diff; catches floor violations + drift; uv installed in CI). Clean python3.13 venv rebuilt from lock → `pip check` clean (pollution gone); pytest **3276 passed, 1 failed** (known pre-existing orphan_sweeper AsyncMock red). **6c (version bumps) + 6d (frontend deps) NOT done — deferred (6c is one-PR-each-with-full-suite; high risk).**

**6a. Reconcile the two manifests**
- [x] Adopt `uv` to **compile `backend/requirements.txt` from `pyproject.toml` with hashes**:
  `uv pip compile pyproject.toml -o backend/requirements.txt --generate-hashes` (or `pip-compile --generate-hashes`).
- [ ] Resolve the contradictions surfaced by the audit:
  - [ ] `fastapi` — pyproject floor is `>=0.136.0` but the old `requirements.txt` pinned `==0.135.1` (violates the floor). New compile fixes it.
  - [ ] `numpy` — documented **test-only** in `pyproject.toml [dev]`, but the old `requirements.txt` shipped `==2.2.4` to prod. Ensure the runtime compile **excludes** numpy (only the `dev` extra should pull it).
  - [ ] `storage3` — keep the `<2.26.0` pin (it intentionally keeps `pyiceberg` out); confirm the compiled tree has **no pyiceberg**.
- [ ] Add a CI gate that fails if `requirements.txt` doesn't satisfy `pyproject.toml` (e.g. re-compile in CI and `git diff --exit-code`, or `uv pip compile --check`).

**6b. Clean local environment**
- [ ] Rebuild a clean project-only venv (the current `.venv` is polluted: `pyiceberg`, `temporalio`, `xai-sdk`, `boto3`, `cohere`, `groq`, `mistralai`, `fastmcp`, `logfire`, … none in either manifest; `pip check` reports `pyiceberg 0.11.1` vs `cachetools 7.0.5` conflict). Recreate: `python3.13 -m venv .venv && .venv/bin/pip install -e ".[dev]"`.
- [ ] Confirm `.venv/bin/python -m pip check` is clean.

**6c. Controlled version bumps** (one PR each, run full suite between)
- [ ] **Security-relevant first:** `cryptography` 46.0.5 → 48.0.0 (2 majors; used for ES256 JWT verification — read changelog/CVEs, run auth tests).
- [ ] `starlette` 0.52.1 → 1.2.0 (major) — coordinate with `fastapi`'s supported starlette range; run the full API suite.
- [ ] `supabase` suite 2.25.x → 2.30.x (`supabase`, `postgrest`, `realtime`, `storage3`, `supabase-auth`, `supabase-functions`) — verify RLS/query behavior under test.
- [ ] `websockets` 15 → 16, `uvicorn` 0.41 → 0.48, `sentry-sdk` 2.29 → 2.61, `pydantic-ai-slim` 1.66 → 1.104, `python-multipart` 0.0.22 → 0.0.29, `deepl` 1.21 → 1.30.

**6d. Frontend deps** (low risk — mostly in-range)
> **STATUS (2026-05-30):** ✅ DONE — commit `7c206eb`. `npm update` refreshed ~24 in-range deps (lock only). lint:full + build green; no new test fails (only the 2 world-map reds). DEFERRED: marked 17→18 (major, user-facing render, needs marked-highlight compat) + knip dep-cleanup (mixed real/false-positive: /localize-tools+/* are FPs; three/three-forcegraph are 'unlisted' transitives; zod//dompurify candidate-real). Both → focused follow-up.
- [ ] `cd frontend && npm update` to clear the in-range minors/patches (biome, codemirror, lit 3.3.3, vite, vitest, zod, supabase-js, sentry, dompurify, echarts 6.1, …).
- [ ] Evaluate `marked` 17 → 18 (the only full-major gap) — check changelog vs `utils/markdown.ts` usage; bump if compatible.
- [ ] Run `npx -y knip` (or `depcheck`) in a network-enabled env for the **unused-npm-dependency** pass that couldn't run locally; remove any confirmed-unused deps.
- [ ] **Verify:** `.venv/bin/python -m pytest` + `cd frontend && npm run lint:full && npm test` + a smoke run of the app.
- [ ] **Commit(s):** `build(deps): single-source requirements from pyproject + hashes + CI gate`, then one per bump cluster.

## WP-7 — Supabase client lifecycle

**Goal:** Stop building a fresh `httpx`-pooled Supabase client per request with no teardown, on the public-first hot path. **Risk:** Medium (touches every request's DB access — test thoroughly).

- [ ] `dependencies.py:137 get_anon_supabase` — make it a **cached singleton** (stateless; mirror `supabase_admin_cache.py`). It feeds 73 public endpoints and rebuilds a pool every call today.
- [ ] `dependencies.py:121 get_supabase` (user-scoped, → 331 auth endpoints) — choose one:
  - [ ] (Preferred) share one `AsyncClient`/pool and apply the user JWT per-request (`postgrest.auth(token)` / per-request headers) instead of `create_async_client` + `set_session` each time, **or**
  - [ ] (Minimum) convert to `async def … yield client` with `await client.aclose()` in `finally` so pools stop leaking via GC.
- [ ] `dependencies.py:193-206 get_effective_supabase` — resolve the platform-admin check **before** building the user client, so admins don't construct+discard a user client every request.
- [ ] **Verify:** `.venv/bin/python -m pytest` (auth + public-endpoint integration tests); load-smoke a public endpoint and confirm connections are reused/closed (no FD growth).
- [ ] **Commit:** `perf(supabase): singleton anon client + reuse/teardown user client (public-first hot path)`

## WP-8 — Heartbeat concurrency: atomic RPCs (INV9 + N+1)

**Goal:** Eliminate the 3 read-modify-write loops that race the heartbeat scheduler (lost-update) and the associated N+1 query fan-out. Follows ADR-007 (Postgres-first, atomic RPC + CAS). **Risk:** Medium-High (game-state correctness; migrations).

- [ ] `event_service.py:550-581` (crisis building degradation): batch one `event_zone_links` SELECT with `.in_("event_id", [...])`; replace per-building Python write-back with an atomic `UPDATE buildings SET building_condition = GREATEST(0, building_condition - p_degradation) WHERE zone_id = ANY(...)` RPC.
- [ ] `event_service.py:468-485` (arc attachment): replace the per-match `source_event_ids` JSON read-append-write with a `jsonb` array-append RPC guarded by `NOT (source_event_ids @> ...)`; collapse the nested loop to one call per arc with the full delta.
- [ ] `bureau_response_service.py:274-293` (pressure resolution): atomic relative decrement `heartbeat_pressure = GREATEST(0, heartbeat_pressure - p_reduction)` in one UPDATE (+ optional status transition in the same statement).
- [ ] `narrative_arc_service.py:727-746` (zone scarring): batch-fetch zone descriptions with `.in_()`; conditional-append suffix via RPC (`WHERE position(p_suffix in description) = 0`).
- [ ] `connection_service.py:145-156` (user-facing map overlay): collapse the per-simulation `narrative_arcs` SELECT into one `.in_("simulation_id", ids)` query + Python grouping (or a single aggregating view/RPC).
- [ ] `operative_mission_service.py:523-541` (cycle resolution): set-based RPC to transition all `deploying→active` missions per epoch in one statement.
- [ ] Write the new SQL functions as numbered migrations (next free `supabase/migrations/NNN_*.sql`); add integration tests asserting concurrent appends/decrements compose.
- [ ] **Verify:** `.venv/bin/python -m pytest backend/tests -k "heartbeat or event or bureau or arc or connection or mission"`; apply migrations locally.
- [ ] **Commit(s):** one per service + migration, e.g. `perf(heartbeat): atomic RPC for building degradation (fixes N+1 + lost-update)`

## WP-9 — Backend helper adoption (de-duplication)

**Goal:** Adopt helpers that already exist; the highest item also fixes a documented correctness hazard. **Risk:** Medium (broad mechanical change — do per-file, lean on tests).

- [ ] **(Correctness + dup) Replace inline fail-open boolean parsing with `parse_setting_bool()`** (`utils/settings.py`). Sites: `resonance_scheduler.py:86`, `heartbeat_service.py:188`, `scanning/scanner_service.py:115,122`, `platform_config_service.py:111`, `instagram_content_service.py:297`, `game_mechanics_service.py:306,355`, `bond/bond_service.py:71`, `external_service_resolver.py:136,162,184`. (The inline `not in ("false","0","no","")` form fails OPEN — exactly what CLAUDE.md forbids.)
- [ ] **Adopt `extract_one`/`extract_one_or_404`** (`utils/responses.py`) at the ~120 raw `response.data[0]` single-row reads (start with the get/create/update methods in the `*_service.py` files; removes latent `IndexError`/`NoneType`). High volume — do in batches by domain.
- [ ] **Adopt `paginate_response()`** (`base_service.py`) at the ~25 manual `total = response.count if … else len(...)` sites (`agent_service.py:57`, `building_service.py:57`, `event_service.py:75`, `simulation_service.py:83,325,345,476`, …).
- [ ] **Route scheduler/pipeline config reads through `load_platform_settings()`** instead of hand-rolled `.in_([...]).execute()` loops (`resonance_scheduler.py`, `heartbeat_service.py`, `scanning/scanner_service.py`, plus `get_pipeline_settings` in the social services).
- [ ] **Consolidate the system-actor UUID** into one `SYSTEM_ACTOR_ID` in `constants.py`; replace `heartbeat_service.py:122 _SYSTEM_ACTOR`, `scanning/scanner_service.py:37 _SYSTEM_USER_ID`, `resonance_scheduler.py:121` inline.
- [ ] **De-dup `EVENT_STATUSES`** — delete the `constants.py:163` copy; import from `models/event.py:8` (single source).
- [ ] **Verify after each batch:** `.venv/bin/python -m ruff check backend && .venv/bin/python -m pytest`.
- [ ] **Commit(s):** `refactor(services): adopt parse_setting_bool (fixes fail-open gate) + load_platform_settings`, `refactor(services): adopt extract_one/paginate_response across CRUD`

## WP-10 — Frontend shared-state adoption (de-duplication)

**Goal:** Stop hand-rolling the load lifecycle and loading/error/empty rendering that shared infra already provides. **Risk:** Medium (UI behavior — verify each migrated view). 82 components declare a local `_loading`; only 5 use the mixin.

- [ ] Start with the densest offenders — the 17 admin tabs + 8 `admin/ops/*Panel` components — they uniformly hand-render all three states.
- [ ] Migrate simulation-scoped data views to `DataLoaderMixin` (`_fetchData()` + `_renderDataGuard()`); list/grid+filter+pagination views to `PaginatedLoaderMixin`. Reference the 5 that already do it correctly (`AgentsView`, `BuildingsView`, `ChronicleView`, `EventsView`, `SimulationBroadsheet`).
- [ ] Replace ~30 manual `<div class="loading">…</div>` with `<velg-loading-state>`; ~17 manual error blocks with `<velg-error-state show-retry @retry=…>`; ~44 local empty blocks with `<velg-empty-state>` (inline empty *table rows* are a legitimate exception).
- [ ] Replace the 3 hand-rolled relative-time formatters with `formatRelativeTime` (`utils/date-format.ts`): `AdminScannerTab.ts:1680-1691`, `VelgOrphanSweeperSettingsModal.ts:333-350`, `SimulationPulse.ts:1012-1018`.
- [ ] **Verify per view:** `cd frontend && npm run lint:full && npm test`; click through each migrated view's loading/error/empty/content states.
- [ ] **Commit(s):** group by area, e.g. `refactor(admin): migrate admin tabs to shared loading/error/empty state components`

## WP-11 — Frontend performance fixes

**Goal:** Close the FE perf items (none Critical). **Risk:** Low-Medium.

- [ ] **Memoize `ChatBubble._renderContent()`** (`ChatBubble.ts:408-428`): cache the rendered result in `willUpdate` keyed on `content` (+ `senderRole`); skip `hljs.highlightAuto` for fenced blocks without a language hint. (Hottest CPU path in long chats.)
- [ ] **Add `manualChunks` entries** in `vite.config.ts:40-46` for `echarts`(+`zrender`), `maplibre-gl`, `three`/`3d-force-graph`, `@codemirror`/`codemirror`, `highlight.js` — deterministic, cacheable chunks.
- [ ] **Lazy-load CodeMirror** inside `VelgContentDraftEditor.ts:50` — convert the static `import { mountJsonEditor }` to `const { mountJsonEditor } = await import('./codemirror-json-editor.js')` in `firstUpdated`/`updated` right before use (`:478`). Removes the CodeMirror suite from the general admin chunk.
- [ ] **Keyed lists:** switch the filterable entity grids to Lit `repeat(items, i => i.id, …)`: `AgentsView.ts:356,583`, `EventsView.ts:314` (and the broader `agents/`, `buildings/` grids). Leave static/append-only lists as `.map`.
- [ ] **Hoist `AgentsView._filterConfigs`** (`:230-253`) out of `render()` into a `@state` computed in `willUpdate` (stop allocating a new array every render → stops forcing `velg-filter-bar` re-eval).
- [ ] (Optional) `BaseApiService.request` (`:81-147`): add per-component `AbortController` and/or an in-flight promise map for GET de-dup.
- [ ] **Verify:** `cd frontend && npm run lint:full && npm test`; build and eyeball chunk output (`npm run build`).
- [ ] **Commit(s):** `perf(chat): memoize ChatBubble markdown render`, `perf(bundle): explicit manualChunks + lazy CodeMirror`

---

# P2 — Long-term

## WP-12 — Shared abstractions (deeper de-duplication)

**Goal:** Extract the abstractions the duplication findings point to. **Risk:** Medium.

- [ ] **`BaseEditModal` mixin** (mirror `BaseSettingsPanel`) — collapse ~2,240 LOC of byte-identical `open`/`_saving`/`_errors`/`_isEdit`/`_validate`/`_handleSubmit` across `AgentEditModal`, `BuildingEditModal`, `EventEditModal`, `LocationEditModal`, `RelationshipEditModal`.
- [ ] **`CachedSettingsGroup`** (backend) — parameterized by `(key_prefix, defaults, value_parser)`; collapse `platform_model_config.py`, `platform_research_domains.py`, `platform_api_keys.py` to thin instances.
- [ ] **`BaseSchedulerMixin` adoption** — migrate `ResonanceScheduler` and `EpochCycleScheduler` onto the mixin (6 others already use it).
- [ ] **`external/_http.py`** (backend) — shared `get_json(url, *, params, timeout, error_cls)` for the trusted-3rd-party API clients (`guardian.py`, `facebook.py`, `bluesky.py`, `newsapi.py`, `tavily_search.py`, …); collapse `guardian.browse`/`search` to one `_query`.
- [ ] **`tableStyles` module** (frontend `components/shared/table-styles.ts`) — the `.table` CSS is reimplemented in 11+ components. Also push `buttonStyles`/`formStyles` adoption (~11 components re-declare `.btn`/form CSS).
- [ ] **Consolidate the two purpose→model default maps** (`constants.py:148-159` vs `platform_model_config.py:24-34`) — they already disagree on the fallback model. One canonical map + one resolver.
- [ ] Smaller utils: shared `clamp(value,min,max)` (8 sites), `truncate(text,max)` + `getInitials` adoption, move `ResolvedImpact` interface to `types/index.ts` (dup in `ResonanceCard.ts:14-17` / `ResonanceDetailsPanel.ts:19-22`), generic `RealtimeService.subscribeToTable(...)` for the 3 inline `postgres_changes` setups.
- [ ] **Verify + Commit** per extraction.

## WP-13 — God-file decomposition + content externalization

**Goal:** Reduce the largest files; move content blobs out of code. **Risk:** Medium-High (broad).

- [ ] Decompose god-services: `forge_orchestrator_service.py` (2,075), `heartbeat_service.py` (1,596). Slim the oversized routers back to HTTP-only: `forge.py` (1,168), `public.py` (1,092), `admin.py` (886).
- [ ] Externalize large Python content blobs: `ambient_weather_templates.py` (4,047), `email_templates.py` (2,291) — follow the established content-pack/YAML pattern where applicable.
- [ ] Frontend: code-split or externalize `archetypes/dungeon-detail-data.ts` (5,869 — currently shipped in a bundle); decompose god-components `EpochCommandCenter.ts` (2,752), `AdminInstagramTab.ts` (2,621).
- [ ] Investigate `forge_mock_service.py` (1,273) — confirm it's a legitimate runtime fallback, not dev-only code shipped in `services/`.
- [ ] **Verify + Commit** incrementally.

## WP-14 — Testing & coverage gate uplift

**Goal:** Make the coverage gate reflect the real test investment. **Risk:** Low.

- [ ] Raise `[tool.coverage.report] fail_under` (`pyproject.toml:111`) from `30` toward measured coverage in steps (e.g. measure actual, set floor a few points below, ratchet up).
- [ ] In WP-2d, for each tested-but-unwired method that gets deleted, delete its now-orphaned test; for any that get wired, add the missing endpoint/integration test.
- [ ] Consider a small CI job that runs `knip`/`depcheck` (frontend) and `vulture` w/ a curated whitelist (backend) to catch future dead code.
- [ ] **Verify + Commit.**

---

## Sequencing & risk notes

- **Do P0 first** — all low-risk, independently verifiable, and they shrink the surface before the bigger refactors.
- **WP-6 (deps) before heavy P1 work** — you want local == prod versions before chasing behavior-sensitive changes (WP-7/WP-8).
- **WP-8 is the riskiest** (game-state correctness under concurrency + migrations) — land it on its own, with integration tests, and verify migrations locally before any deploy. Never `supabase db reset` without explicit approval.
- **WP-9 / WP-10 are high-volume but mechanical** — go per-file/per-area with tests green between batches; they're easy to review in small commits.
- Keep docs + memory updated per the project process rule as each WP lands.

## Appendix — what the audit found CLEAN (do not "fix")

Secrets hygiene · non-root Docker + healthcheck · `safe_fetch` SSRF protection · RLS initPlan-optimized · all 60 routers registered · no commented-out/legacy/`.bak` code · 9/12 backend + 8/9 frontend invariants clean · all 8 FE lint gates green · `echarts` already tree-shaken · `highlight.js` core+8 langs · WebGL disposal + timer/observer teardown (except the one LandingPage leak in WP-4) · the 230 root-level screenshots are **untracked** local cruft (not in git — leave git alone).
