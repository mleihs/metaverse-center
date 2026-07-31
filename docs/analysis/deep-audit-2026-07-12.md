# Deep Code Audit — 2026-07-12

> 9-agent deep audit (backend architecture, security, database/migrations, backend performance,
> frontend architecture, frontend quality/perf, testing, maintainability/deps, principal-architect
> assessment). All P0/P1 findings were independently re-verified in the working tree before
> inclusion. Findings already documented in
> `docs/analysis/full-stack-audit-findings-2026-06-15.md` (30 findings; backend remediated,
> 14 frontend open) are **excluded** — this audit covers what that one missed plus everything
> shipped since. Audited tree: branch `hotfix/supabase-fd-leak` @ `157fe1c`.

---

## Executive Summary

**Overall grade: A−.** No rotten subsystem — the codebase has an enforcement culture (11 bespoke
CI lint gates, 9 followed ADRs, a clean router layer, real-DB integration tests in CI) that most
teams never reach. What separates it from "deluxe" is **asymmetry between generations**: the
newest domains (journal, drift, combat, content-packs) exemplify the house style while the oldest
(instagram/social, heartbeat) predate it; god-objects persist at the three orchestration
chokepoints; and the domain boundaries are convention, not enforced structure.

**Critical issues: 0 × P0, 8 × P1** (all verified). The single most urgent: the fresh FD-leak
hotfix `157fe1c` introduced a **use-after-close regression** that silently breaks auto-translation
and chat-memory extraction for every non-platform-admin user.

**Top 3 priorities:**
1. Fix the `157fe1c` use-after-close in background tasks (P1-1) — active breakage on this branch.
2. Fix `collaborative_anchors` write authorization + the join/leave race with one atomic RPC (P1-2).
3. Unify the Python dependency source (requirements.txt vs pyproject) so prod ships what CI tests
   and pip-audit scans (P1-4).

### Metrics
| | |
|---|---|
| Backend | 542 Python files, ~168k lines (incl. tests), 60 routers, ~230 service modules |
| Frontend | 503 TS files, ~238k lines, 387 components, 45 API services |
| Database | 273 migration files (numbering tops at 263), 264 SQL functions, ~353 policies |
| Tests | ~2,939 backend (74% coverage, gate 65%), ~888 frontend (coverage configured, never measured) |
| CI gates | tsc, Biome, lit-analyzer, pytest+cov, vitest, 11 custom lint-*.sh, live-DB migration apply, SECDEF grant guard |
| TODO/FIXME | 2 real (both `agent_opinion_service.py`), 0 commented-out code blocks |

---

## P1 Findings (all re-verified)

### P1-1 · Use-after-close regression from the FD-leak hotfix `157fe1c` — background tasks hold a client that closes at request teardown
**Files:** `backend/dependencies.py:129-140` (yield-dep closes client in `finally`),
`backend/services/translation_service.py:401` (`asyncio.create_task(_run_auto_translate(supabase, …))`),
`backend/routers/agents.py:88,116` + `backend/routers/buildings.py:93,121` (pass the request client in),
`backend/services/chat_ai_service.py:640` (`asyncio.create_task(_safe_extract())` capturing `self._supabase`).

`get_effective_supabase` returns the closeable request-scoped client for every non-platform-admin.
The fire-and-forget tasks (LLM translate: seconds; memory extraction: up to 30 s) then hit a closed
httpx client → `RuntimeError: Cannot send a request, as the client has been closed`. Entity
auto-translation and chat memory extraction are silently broken for non-admin users; failures land
in Sentry disguised as task errors. Admin users are unaffected (singleton client), which masks the
bug in admin-side testing.

**Fix:** background tasks must never hold a request-scoped client — have `_run_auto_translate` and
`_safe_extract` acquire `get_admin_supabase_client()` internally (or accept plain data and manage
their own client). Then check Sentry for "client has been closed" since the hotfix deploy.
**Effort: S–M.**

### P1-2 · `collaborative_anchors` has no authenticated write policy — anchor create/join/leave broken for regular editors
**Files:** `supabase/migrations/20260318000000_129_heartbeat_core.sql:199,265,273`,
`backend/routers/heartbeat.py:342-372`, `backend/services/anchor_service.py:103-190`.

Migration 129 gives the table only public-read + service_role policies (its siblings
`bureau_responses`/`substrate_attunements` in the same migration got editor write policies).
The join/leave/create endpoints are `require_role("editor")` + `get_effective_supabase` → user-JWT
client for non-admins → UPDATE matches 0 rows → 500 "Failed to join anchor." / INSERT → 42501.
Only platform admins (auto-elevated) can use the feature. Same class as the migration-259
`narrative_arcs` discovery.

**Compound finding (P2):** `join_anchor`/`leave_anchor` also read-modify-write the
`anchor_simulation_ids UUID[]` array with no CAS (`anchor_service.py:111-140,161-190`) — concurrent
joins lose participants; leave+join races can wrongly dissolve/resurrect anchors (ADR-007 violation).

**Fix (one stroke for both):** a service_role-only atomic RPC pair using
`array_append … WHERE NOT (p_sim = ANY(...))` / `array_remove` + `status = CASE WHEN … END`
(pattern precedent: migration 259), called via the admin client after the router's role gate.
**Effort: M.**

### P1-3 · JWT verification selects the algorithm from the attacker-controlled header; HS256 path has no empty-secret guard
**Files:** `backend/dependencies.py:54-79`, `backend/config.py:12` (`supabase_jwt_secret: str = ""`).

`_decode_jwt` reads `alg` from the **unverified** JWT header; HS256 is accepted in production
against `settings.supabase_jwt_secret`, whose config default is `""` with no boot-time validator.
With an empty secret an anonymous attacker forges an admin token (empty-key HMAC verifies) and —
via the email-allowlist tier of `is_platform_admin()` — becomes platform admin.
**Verified mitigation:** prod (Coolify env) *does* set `SUPABASE_JWT_SECRET`, so this is not
currently exploitable — hence P1 hardening, not P0.

**Fix:** ES256/JWKS-only in production (don't branch on header `alg`); gate HS256 behind
`environment in ("development","test")`; `model_validator` requiring a non-empty secret wherever
HS256 can run; verify `iss` in addition to `aud`. **Effort: S.**

### P1-4 · Production installs a different, stale, unaudited dependency set than CI
**Files:** `backend/requirements.txt` (58 pins, 0 hashes), `pyproject.toml`, `Dockerfile:35-36`,
`.github/workflows/ci.yml:176`, `.github/workflows/security.yml:50`.

Dockerfile installs `requirements.txt`; CI and pip-audit run against `pip install -e ".[dev]"`
(pyproject). Verified contradiction: `fastapi==0.135.1` shipped vs `fastapi>=0.136.0` declared.
The May WP-6a/6b hash-lock is gone (zero `--hash=sha256` entries). CI green ≠ prod works; the
shipped set is never vulnerability-scanned.

**Fix:** regenerate `requirements.txt` from pyproject (`pip-compile --generate-hashes` / `uv pip
compile`), add a CI divergence check, point pip-audit at requirements.txt. **Effort: M.**

### P1-5 · Three.js (585 kB / 145 kB gzip) on the critical startup path
**File:** `frontend/src/app-shell.ts:27` — `import './components/drift/DriftView.js';` (static),
chain verified: `DriftView.ts:35` → `DriftChartHost.ts:31 import * as THREE from 'three'` →
UnrealBloomPass. Every other route view is lazy; DriftView is the one static side-effect import —
for a feature behind the `drift_p0_enabled` flag. `index.html` modulepreloads the bloom chunk at
first paint (total startup JS ≈ 2.1 MB uncompressed).

**Fix:** route-level `import()` like all other views. **Effort: S** (one-line class of change).

### P1-6 · CPU-bound image/geometry work runs directly on the event loop
**Files:** `backend/services/forge_image_service.py:467-468,660-665` (two sequential AVIF encodes
per generated image, full-res + thumbnail), `dungeon/showcase_image_service.py:430-431`,
`style_reference_service.py:75`, `instagram_image_service.py:318` (full-canvas 1080×1350 grain/
aberration/scanline pipeline, also on the scheduler tick), `instagram_story_composer.py:690`,
`external/bluesky.py:284-310,662-671`, `forge_map_service.py:147-153` (shapely voronoi/street
build, part of a documented ~30 s operation).

One uvicorn loop serves all HTTP and all schedulers; each encode/compose stalls everything for
0.1–5 s, stacked dozens of times per Forge materialization. Precedent exists in-repo
(`email_service.py:163`, `translation_service.py:239,268` use `asyncio.to_thread`).

**Fix:** mechanical `asyncio.to_thread` wraps at the async boundary — the functions are already
pure bytes-in/bytes-out. **Effort: S (sweep).**

### P1-7 · `EpochCommandCenter` is a 2,768-line god component (32 `@state` fields, ~11 data domains)
**File:** `frontend/src/components/epoch/EpochCommandCenter.ts:1392-1423,1468`.

Largest component in the codebase; owns epochs, participants, teams, alliances, leaderboard,
missions, threats, battle log, draft agents, zones, comms, 8 modal booleans, animation state; also
privately re-derives auth mode. Same defect class as the June-logged AdminInstagramTab, one size
bigger, previously unreported.

**Fix:** extract per-tab children owning their own loads, or an `EpochStateManager` mirroring the
DungeonStateManager pattern. **Effort: L.**

### P1-8 · The RLS test suite doesn't test RLS; the sole map-geometry write path has zero tests
**Files:** `backend/tests/integration/test_rls_policies.py:1-10` (mocks the DB entirely; its
"no Supabase in CI" premise is stale — CI runs real Supabase),
`fn_apply_map_geometry` (migrations 236/245/251): `grep -rn apply_map_geometry backend/tests` → 0.

Core-table RLS (`agents`, `simulations`, `platform_settings`, journal, resonance, epoch) has zero
automated verification; a bad policy migration passes CI green. Real anon-RLS checks exist only
for DRIFT tables — proving the pattern is cheap to replicate. The geometry RPC's
rollback/version-bump invariants (its entire reason to exist) are unguarded.

**Fix:** real-DB RLS matrix suite in the DRIFT style; rename the current file to
`test_dependency_gates.py`; add an integration test for `fn_apply_map_geometry`
(valid draft → rows+version+status; poisoned payload → full rollback). **Effort: M each.**

---

## P2 Findings

### Backend
- **Public read surface untyped** — `routers/public.py` (~67 endpoints) + `simulations.py` lore
  CRUD, `dungeon_content_admin.py`, `chronicles.py`, `scores.py`, `agent_memories.py` return bare
  `SuccessResponse`/`PaginatedResponse` while member twins are typed. Wire the existing `*Response`
  models — but verify field-by-field against live rows first (typing filters and can 500 on drift).
  Effort L.
- **Audit-logging gaps** — `buildings.py:152,167,194` (assign/unassign/profession),
  `users.py:79,94`, `bonds.py:148,163` (whisper read/acted), `epoch_invitations.py:100`
  (regenerate_lore mutates `game_epochs.config`). Add `AuditService.safe_log` mirroring siblings.
  Effort S.
- **service_role for normal CRUD** — `user_profile_service.py:96-110`: docstring claims elevated
  access "may" be required; verified false — migration `…150337` has "Users can update own
  profile" policy. Switch to the user client. Effort S.
- **103 function-level `from backend…` imports** — epoch/forge circular-import clusters (need an
  interface split) plus verified-acyclic avoidable ones (`platform_model_config.py:77`,
  `style_reference_service.py:141,392`, `embedding_service.py:33`, …). Effort M.
- **Scheduler-loop duplication, round 2** — `heartbeat_service.py:140-171` and
  `scanning/scanner_service.py:61-87` still hand-roll the `BaseSchedulerMixin` 5-clause loop
  (scanner already drifted: missing the ConnectError clause). Inherit the mixin (June remediation
  covered only resonance + epoch_cycle). Effort M.
- **Business logic in router ×3** — `social_trends.py:156-190,348-374,477-491`: article-content
  assembly + resolver/GenerationService construction copy-pasted three times in the HTTP layer.
  Extract `SocialTrendsService.transform_article_content`. Effort M.
- **SEO TTL caches: dead admin setting + never-invalidated entity cache** —
  `middleware/seo.py:80-83` (TTL fixed at import; `admin.py:690` clears only one of two caches).
  Effort S.
- **Per-request client handshake tax** (accepted tradeoff of `157fe1c`, flagged) — every non-admin
  request pays fresh TCP+TLS to Supabase Cloud. A loop-keyed cache with header-injected JWTs would
  restore keep-alive without re-breaking tests. Effort M.

### Frontend
- **~50 catch blocks bind `err` but never `captureError`** — incl. two base classes
  (`DataLoaderMixin.ts:135`, `BaseSettingsPanel.ts:99,146`) and 8 sites in `ForgeStateManager`;
  `BureauTerminal.ts:617,690` routes command failures to `console.error` only. Evades
  `lint-no-empty-catch.sh` (binding present). Fix the two base classes first, then sweep; extend
  the lint to require `captureError`-or-`throw` in the body. Effort M.
- **No request-sequence guard in `DataLoaderMixin`/`PaginatedLoaderMixin`**
  (`DataLoaderMixin.ts:122-140`, `PaginatedLoaderMixin.ts:87-100`) — rapid page clicks resolve out
  of order; stale response wins in AgentsView/BuildingsView/EventsView/SimulationBroadsheet/
  ChronicleView. One monotonic-counter fix covers all. Effort S.
- **Dead code, ~760 lines** — `ResonanceMonitor.ts` (564 lines, rendered nowhere; its ticker was
  reimplemented inline in `SimulationsDashboard.ts:2228`), `NotificationService.ts`,
  `types/validation/theme.ts`, `utils/events.ts`, `utils/svg.ts` (zero importers each — but see
  the arc-dedup below before deleting svg.ts). Effort S.
- **4 production npm vulns, all in-semver fixable** — echarts XSS, linkify-it quadratic (high),
  markdown-it DoS ×2. `npm audit fix` + vitest. Effort S.

### Testing / process
- **Permanently-skipped placeholder suites** — `test_concurrent_scenarios.py` (6 skip bodies),
  `test_auth_boundaries.py:746` (`skipif(True)` on the ADR-006 SECDEF self-validation tests);
  the "no Supabase in CI" premise is false. Implement or delete. Effort M.
- **47 backend service modules with zero test references** (~9k LOC in the top 20) — prioritize
  `resonance_service` (905), `cipher_service` (security-adjacent redemption path),
  `autonomous_event_service` (1017), `game_mechanics_service`. Effort L spread.
- **Zero frontend component/rendering tests** (387 components; all 40 test files are pure-logic).
  Thin Lit fixture harness for the ~10 highest-risk shared components. Effort M.
- **Frontend coverage configured but never run**; no thresholds. Effort S.
- **`pytest-timeout` absent** despite the June 54-minute CI hang; add
  `timeout = 120, timeout_method = "thread"`. Effort S.
- **Repo hygiene** — ~25 untracked browser-snapshot dumps in the repo root (several from other
  projects), unignored `spikes/` with vendored node_modules, 6-week-old unversioned
  `docs/analysis`/`docs/plans` files one `git clean` from loss. Delete dumps, gitignore
  `spikes/`, commit the durable docs. Effort S.

---

## P3 Findings (abridged — see agent evidence for detail)

- SECDEF functions in migrations 260–263 lack `SET search_path = public` (grants correct;
  one `ALTER FUNCTION` follow-up migration). **S**
- `EpochLifecycleService.advance_phase` (:175-198) and `revoke_invitation` (:152) status flips
  without CAS; `bureau_response_service.py:387-401` scar-reduction RMW without guard. **S each**
- Missing FK indexes on newer tables (`travel_cargo.origin_*`, `route_purchases.route_id`,
  `journal_fragments.simulation_id`, …) — O(N×M) on simulation deletion. One migration. **S**
- `agent_opinion_service.py:274,306` — acknowledged O(N²) TODO(ADR-007), ~4,900 round-trips at
  50 agents; the only real TODOs in the repo. **M**
- ~25 single `as T` casts on API responses (incl. casts from `ApiResponse<unknown>` ≡ the banned
  double-cast); type the unknown-returning service methods, delete redundant casts. **M**
- 9 components keep polling on hidden tabs (CartographerMap, MapBattleFeed, SimulationShell bleed,
  AdminOpsTab ×2, DispatchTicker, HeatmapPanel, BureauTerminal, ResonanceMonitor†dead) — extract
  `SimulationWorldMap.ts:571`'s visibility-gate pattern. **S–M**
- `LandingPage.ts:1543` never disconnects its IntersectionObservers (sole offender). **S**
- Audio/theme services degrade with `console.warn` only (`ChatAudioService.ts:189`,
  `DungeonAudioService.ts:435`, `ThemeService.ts:204`). **S**
- `app-shell.ts:1028` raw `fetch('/api/v1/health')` bypasses the API layer (only stray site). **S**
- Model name collisions: two `MessageResponse`, two `AttunementResponse` with disjoint shapes —
  rename the domain ones. **S**
- `describeArc` implemented 3× (`utils/svg.ts` dead copy + `MapGraph.ts:1151` +
  `AgentMoodPanel.ts:80`); relative-time formatting re-rolled in `terminal-formatters.ts:1061`
  and `ChatExporter.ts:128`. Consolidate on utils. **S**
- Default model id literal duplicated outside the config registry (`ai_utils.py:78`). **S**
- Color-token lint rgba check enforced in only 2 dirs; dungeon/drift/journal/bureau unenforced
  (found: `DungeonTerminalView.ts:363,417`). Grow the enforced list. **S**
- Doc drift: CLAUDE.md "38 routers" (actual 60; drift.py is a legitimate documented exception the
  contract contradicts), "zero response_model=" (`app.py:421` has a benign `response_model=None`);
  root `CLAUDE_AUDIT.md` is 15 months stale — move to docs/analysis as historical. **S**
- OpenRouter creates a fresh httpx client per AI call; fire-and-forget tasks without strong refs
  (`chat_ai_service.py:640`, `forge_access_service.py:67,177`, `forge_orchestrator_service.py:722`);
  heartbeat due-filter in Python; per-building degrade RPC loop (`event_service.py:558-585`);
  narrative-arc depth-count re-queried per loop pair. **S–M each**
- Testing: only ~17/59 routers have dedicated router tests (cheap parametrized envelope smoke
  would cover the rest); 24 assert-free smoke tests should carry `# no-raise is the assertion`
  comments; conftest global-state mutations documented as invariants. **S–M**
- Known-stale memory note: the two "known red" world-map tests **now pass** (39/39 verified). Retire the note.

---

## Verified Clean (highlights)

- **NEVER-list compliance:** zero `response_model=` (modulo the benign `None`), zero raw success
  dicts, zero `.table(` in routers, zero direct `.maybe_single().execute()`, zero
  `_generate` bypasses, zero `platform_settings` `.update().eq()` writes, map-geometry rule held.
- **Migrations 228–263:** RLS enabled on every new table; initPlan wrapping clean post-183;
  active_* views refreshed where required; TRUNCATEs confined to the content-pack pipeline;
  SECDEF grants 257–263 correct (only the search_path pins missing, P3).
- **SECURITY:** no anon-SECDEF regression after 258; SSRF routing through safe_fetch holds;
  no committed secrets; CSP/HSTS/CORS correct; the June-deferred operative ID-trusting reads are
  now properly gated.
- **Frontend lifecycle:** all ~31 setInterval sites cleared; signal effects disposed (13 files);
  realtime channels torn down; localStorage JSON.parse universally guarded; zero `as any` /
  `@ts-ignore`; routing races genuinely fixed; echarts/maplibre correctly code-split.
- **Test infrastructure:** real-DB migrations + SECDEF guard per PR; loop-affinity hygiene encoded
  in fixtures; clock injection instead of sleeps; backend coverage floor with written rationale.
- **Hygiene:** 2 real TODOs repo-wide, zero commented-out code, 0/131 dead doc links,
  1/308 orphaned custom elements.

---

## Prioritized Action Plan

### Quick wins (< 1 day, mostly S)
1. **P1-1** use-after-close: admin client inside `_run_auto_translate` + `_safe_extract`; check Sentry.
2. **P1-5** lazy-load DriftView (`import()` route) — −145 kB gzip on every first paint.
3. **P1-3** JWT hardening: env-gate HS256, non-empty-secret validator, `iss` check.
4. `npm audit fix` (4 prod vulns) + `pytest-timeout` in CI.
5. Sequence-guard in the two loader mixins (fixes 5 views at once).
6. `ALTER FUNCTION … SET search_path` migration for 260–263; missing-FK-index migration.
7. Delete dead frontend modules (~760 lines) after consolidating `describeArc` into `utils/svg.ts`.
8. Repo-root cleanup: delete snapshot dumps, gitignore `spikes/`, commit orphaned docs/analysis+plans.
9. CLAUDE.md corrections (router count + drift.py exception, response_model=None); retire CLAUDE_AUDIT.md.
10. Rename colliding Pydantic models; `user_profile_service` off service_role; audit-log the 8 gap sites.

### Medium-term (1–5 days)
1. **P1-2** `collaborative_anchors`: atomic join/leave RPC (service_role) — closes the RLS gap and
   the array race together; add an integration test.
2. **P1-4** dependency single-source: `pip-compile --generate-hashes` from pyproject + CI
   divergence check + pip-audit on the shipped set.
3. **P1-6** `asyncio.to_thread` sweep over the image/shapely pipelines.
4. **P1-8** real RLS matrix suite (DRIFT-style) + `fn_apply_map_geometry` rollback test; implement
   or delete the skipped concurrency/SECDEF suites.
5. captureError base-class fix + sweep + lint extension (locks the observability contract in CI).
6. `BaseSchedulerMixin` adoption for heartbeat + scanner; `SocialTrendsService.transform_article_content`.
7. Visibility-gated polling helper adopted at the 9 poll sites; SEO-cache invalidation fix.
8. Late-import hoist (acyclic set) + public.py typing sweep (start with highest-traffic endpoints).

### Long-term (> 5 days) — the Deluxe-Architektur track
Per the principal-architect roadmap (grade A−; full text in the assessment section of the agents'
reports, key points preserved here):
1. **Stage 1 – Polish:** land the 14 open June frontend findings; check the Postgres-object catalog
   into `docs/references/`; bare-response router sweep with a `# untypeable: <reason>` convention + lint.
2. **Stage 2 – Consolidation:** rebuild the social/instagram subsystem to house style (typed models,
   BaseService, `StoryPublisher` protocol inverting resonance→instagram); adopt
   `openapi-typescript` generation from `app.openapi()` with a CI drift check (~300 hand-mirrored
   interfaces today — the single highest-leverage deluxe move); unify on `SignalWatcher`; split
   ForgeStateManager (draft-store / generation-orchestrator / wallet); decompose
   **EpochCommandCenter (P1-7)**; merge the flat `dungeon_*.py` files into `services/dungeon/`.
3. **Stage 3 – Structural:** `import-linter` contracts making domain boundaries physical
   (combat↛dungeon, only heartbeat + declared hooks cross domains); decompose `HeartbeatService`
   `_tick_simulation` (464 lines) and `ForgeOrchestratorService.run_batch_generation` (514 lines)
   into typed phase objects; generalize the `journal.hooks` pattern into an explicit cross-domain
   event registry; backfill ADRs for the load-bearing decisions living only in CLAUDE.md prose.
   Explicitly **not** recommended: microservices, forcing BaseService onto non-CRUD subsystems,
   SQL codegen.
