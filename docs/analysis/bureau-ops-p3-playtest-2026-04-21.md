# Bureau Ops P3 — WebMCP Playtest (2026-04-21)

**Session:** Post-push verification of Bureau Ops P3 stack (e33cfa4..dc60afa, 6 commits on origin/main).

**Scope:** Forecast Oracle panel, DispatchTicker footer, cockpit renders cleanly, all triplecheck-fix verification (F19, F27, F30, F51, F59).

**Verdict:** ✅ **All triplecheck fixes verified visually and programmatically in a real browser.** No P0/P1 bugs. One pre-existing observation about `/circuit` poll cadence (not P3-related). No code changes required.

---

## Pre-flight findings — local dev env drift (incident, not a code bug)

On first load of `/admin/bureau-ops`, all 7 ops endpoints returned HTTP 500:
```
/admin/ops/ledger, /circuit, /forecast, /heatmap, /sentry/rules, /firehose, /audit
```

Root cause: local Supabase was 9 migrations behind (last applied = `20260417200000`; missing 221, 222, 224, 225, 226, 227, 228, 229, 230, 231). The P3 stack landed a ~400-line service backed by the materialized view `ai_usage_rollup_hour` from migration 229 — missing that table returned `PGRST205` "table not in schema cache", which the router wrapped in a generic 500.

Resolution (local DB only — production already at these migrations per the project tracker):
1. `supabase db push --local` failed on multi-statement DDL with `SQLSTATE 42601 cannot insert multiple commands into a prepared statement` — a known Supabase CLI limitation for migrations mixing CREATE/ALTER/INSERT.
2. Worked around by piping each file through `docker exec -i supabase_db_velgarien-rebuild psql` and manually recording the `schema_migrations` row on success.
3. Three migrations (224/225/226) reported already-applied objects (`content_drafts` table / constraint / trigger already exist) — their objects had been applied in an earlier session but the `schema_migrations` row was never written. Marked as applied retroactively.
4. After 229 applied, `ai_usage_rollup_hour` (materialized view, `relkind=m`) and `sentry_rules` (with 4 seeded rules from migration 230) both present.

This is purely a **local-dev drift issue**. Production state is correct per prior session's SupABASE MCP verification. The fix was state recovery, not a code change.

**Carry-forward for future sessions:** If any session hits PGRST205 on a table referenced by P3 services, verify `supabase migration list --local` shows applied state first before assuming a code defect.

---

## 1. Cockpit render — all 8 panels + footer

Browser: Chromium 1600×1100. After migrations applied, zero console errors. One Lit dev-mode warning (expected in dev).

Panels observed (top to bottom, left to right):
1. ✅ **Ledger** (`LEDGER // LIVE BURN`) — 4 tiles (Today, Month, Circuit Risks, Audit Last 24h), empty-state "No usage recorded today yet."
2. ✅ **Burn Rate** (`BURN RATE // MTD`) — `$0.0000 / hr`, `$0.00 projected EOM`
3. ✅ **Circuit Matrix** (`CIRCUIT MATRIX // 0 PLAYER VIOLATIONS`) — "No circuit activity recorded."
4. ✅ **Quarantine** (`QUARANTINE // KILL SWITCHES`) — `ADMIN = USER` section, add-slug form
5. ✅ **Cost Heatmap** (`COST HEATMAP // DOW × KEY`) — purpose/model/shard/7d/14d/30d controls, empty state
6. ✅ **Forecast // Oracle** — P3.3, full verification below
7. ✅ **Sentry Rules // 4 configured** — 3 category headings (Ignore 1, Fingerprint 2, Downgrade 1), each row shows match/msg/fp/silenced-24h + On/Edit/Del buttons
8. ✅ **Firehose // ai_usage_log** — `live` indicator (green dot), empty state
9. ✅ **DispatchTicker footer** — P3.4, full verification below (attached `role="status"` + `aria-live="off"`)

---

## 2. Forecast Oracle — P3.3 complete verification

### Baseline projection

| Field | Value | Note |
|---|---|---|
| Header label | `FORECAST // ORACLE` | brutalist Courier uppercase, amber `border-top: 3px` |
| Baseline counter | `$0,00` | German `de-DE` locale (comma decimal), `<velg-kinetic-counter>` present |
| Baseline band | `±$0.00 · days left: 9` | `_formatUsd()` output |
| Adjusted label (pristine) | `NO ADJUSTMENTS ACTIVE` | dimmed |
| Adjusted counter | `$0,00` | second `<velg-kinetic-counter>` |
| Driver text | `Projected $0.00 by month-end (9 days remaining); no recent spend recorded.` | Spectral italic, amber 3px left border |

Driver text confirmed **fallback path** active: the Haiku model hit `ModelHTTPError: 403 Key limit exceeded` (OpenRouter prod key exhausted), `_call_haiku` caught via `except Exception` at line 406, returned `None`, service returned `_fallback_driver_text(snapshot)`. End-to-end the panel still renders correctly — the graceful-fallback pattern works as designed (memory note #3).

### Slider catalog (matches `ops_forecast_service.py:62-99` Final list)

| Key | Label | Min / Max / Step | Default | Unit |
|---|---|---|---|---|
| `growth_multiplier` | User growth scenario | 0.5 / 2 / 0.1 | 1 | `x` |
| `forge_runs_pct` | Forge ignites vs current | 0 / 300 / 5 | 100 | `%` |
| `heartbeat_pct` | Heartbeat frequency | 50 / 200 / 5 | 100 | `%` |
| `chat_pct` | Chat volume | 0 / 300 / 5 | 100 | `%` |
| `model_efficiency_pct` | Avg model cost (Haiku ↔ Sonnet) | 20 / 200 / 5 | 100 | `%` |

F56 fix verified: `step` is explicit on every slider (not derived from `unit` heuristic). Growth uses `0.1` for smooth drag, percent sliders use `5`.

### Triplecheck fixes verification

**F27 — KineticCounter duration=120ms for adjusted cell.** Panel shadow DOM reveals two counters: `duration=800` on baseline, `duration=120` on adjusted. Matches the fix exactly.

**F30 — Reset button 30×30, visible only when dirty.** Programmatically read `resetBtn.getBoundingClientRect()` across all 5 sliders after dragging one to `1.5`. Result:
- Dirty slider → `30×30` size, `display !== 'none'`
- All 4 pristine sliders → `resetBtn` not rendered (`display: none`)
- Reset-all disabled → `true` initially, `false` after drag

**F51 — Refresh button stays a `<button>` across all three render branches.** Verified via fetch-interception: injecting a 500ms delay on `/forecast` and re-reading `refreshBtn` during the fetch showed:
- Before click: `<button disabled=false>refresh</button>`
- During fetch (150ms in): `<button disabled=true>refreshing…</button>`
- After fetch: `<button disabled=false>refresh</button>`

Tag stays `button` — never degrades to `span`. The `_renderHeader(state)` extract guarantees the same DOM across loading/error/idle/refreshing.

**F59 — Default-tick aligns with native range thumb inset.** Stress-tested at both extremes using `input.fill()`:
- At slider=0.5 (min): thumb at far-left edge (~0%), tick stays at 33% (where value 1.0 sits) — independent of thumb position.
- At slider=2 (max): thumb at far-right edge (~100%), tick stays at 33%.
- At slider=1 (default): thumb coincides with tick at 33%.

The `left: calc(${pct}% + ${0.5 - pct/100} * var(--_thumb-size))` geometry correctly compensates for the native thumb inset at extremes. Screenshot evidence: `forecast-panel-slider-min.png`, `forecast-panel-slider-max.png`, `forecast-panel-dirty.png`.

### Other interaction verifications

- **Dirty state toggle**: drag slider → `projection__label` text flips `"No adjustments active"` → `"What-if scenario"`. Label is driven by `_isAnyDirty()` (any slider ≠ default), **not** by total-delta sign — an operator sees the scenario label immediately on drag even when baseline is $0 and delta math yields 0. Correct design (prevents "the UI isn't responding" confusion).
- **Reset-all** click with one slider dirty: all 5 values return to defaults, reset-all button disables, adjusted label reverts to "No adjustments active", per-slider reset buttons all hide.
- **Delta text** when dirty and baseline=$0: shows `–` (en dash, no numerical delta). This is correct per `_formatSignedDelta` sign-threshold logic — `abs(0) < 0.005` returns empty text. Acceptable edge case; once real rollup data exists, delta will render as `+$X.YY` / `−$X.YY`.

---

## 3. DispatchTicker footer — P3.4 complete verification

Seeded 9 ops_audit_log entries covering `kill.*`, `budget.*`, `sentry.rule.*`, `restore.*`, `circuit.*` actions. (Test entries cleaned up post-test.)

### Structure

- Tag: `<velg-ops-dispatch-ticker>` → shadow → `<div role="status" aria-live="off">` → `<velg-dispatch-ticker pause-on-hover>`.
- `aria-live="off"` per memory note #9 — ambient crawl must not spam SRs; the Incident Dossier drawer is the accessible entry point.

### Animation

- `.track` computed style: `animation-name: ticker-scroll`, `animation-play-state: running`, `animation-duration: 60s`. Matches spec.
- 9 items loaded + 18 rendered (`.item` elements) = items duplicated for seamless loop.

### F19 — pause-on-hover + prefix-based tint

- Real Playwright `.hover()` on the ticker → `animation-play-state: paused` during hover, `running` on mouseleave. `:host([pause-on-hover]:hover) .track { animation-play-state: paused }` works across shadow DOM.
- Action-color longest-prefix mapping verified in item data:
  - `kill.model` → `var(--color-danger)` ✅ (red)
  - `kill.cut-all-ai` → `var(--color-danger)` ✅ (sub-action inherits from `kill.*`)
  - `budget.set`, `budget.increase` → `var(--color-primary)` ✅ (amber)
  - `restore.model` → `var(--color-primary)` (default/primary)
  - `circuit.trip`, `circuit.restore` → `var(--color-primary)` (default/primary)
- Format per item: `[HH:MM] ACTION.NAME → scope:key · reason` — all fields present.

### prefers-reduced-motion

Source-verified in `VelgDispatchTicker.ts:73-80`:
```css
@media (prefers-reduced-motion: reduce) {
  .track { animation: none; flex-wrap: wrap; justify-content: center; gap: 24px 48px; }
}
```

Also present in `VelgForecastSlider.ts:298` and `ForecastPanel.ts:264`. All P3 components respect the media query.

---

## 4. Network + console cross-checks

### Endpoint 200-check (post-migration)

All 7 panels' endpoints return 200 OK:
```
GET /api/v1/admin/ops/ledger        → 200
GET /api/v1/admin/ops/circuit       → 200
GET /api/v1/admin/ops/heatmap       → 200
GET /api/v1/admin/ops/forecast      → 200
GET /api/v1/admin/ops/sentry/rules  → 200
GET /api/v1/admin/ops/firehose      → 200
GET /api/v1/admin/ops/audit         → 200
```

### Poll cadence observations

Over a ~3 minute session:
- `/forecast` — **1 call** on mount (correct — this is client-polled on refresh only)
- `/audit` — **5 calls** (~30s cadence → matches `DispatchTicker.ts` polling)
- `/ledger` — 5 calls
- `/sentry/rules` — 1 call
- `/heatmap` — 1 call
- `/firehose` — 1 call (then Realtime takes over for live tiles)
- `/circuit` — **13 calls** over 3 min ≈ one per ~14 s

**Observation (not a P3 defect):** `/circuit` is polled aggressively vs the other panels' ~30-60s cadence. Pre-existing from an earlier phase (CircuitMatrixPanel or its parent AdminOpsTab poll). Worth revisiting during P4 polish if it becomes a cost/noise concern, but NOT a P3 issue.

### Console

Zero errors. One expected warning (Lit dev-mode). No Sentry-captured errors from P3 components during playtest.

---

## 5. Screenshots

All in `.playwright-mcp/`:
- `bureau-ops-cockpit-full.png` — full-page cockpit with all 8 panels + footer
- `forecast-panel-default.png` — forecast oracle pristine
- `forecast-panel-dirty.png` — user growth at 1.5x, adjusted label = "WHAT-IF SCENARIO", reset icon + amber value
- `forecast-panel-slider-min.png` — slider at 0.5x (F59 min-extreme proof)
- `forecast-panel-slider-max.png` — slider at 2x (F59 max-extreme proof)
- `dispatch-ticker-el.png` — ticker row showing action tints + `→` scope separator + `·` reason separator
- `dispatch-ticker.png`, `dispatch-ticker-zoom.png` — sentry rules + firehose + ticker viewport

---

## 6. Conclusion + recommendation

**Verdict:** P3 + triplecheck + F59 all behave as specified. The push stack (e33cfa4..dc60afa, already on origin/main) is ✅ verified.

**No bug fixes needed.** The only incident was local-DB migration drift, resolved via state-recovery (docker-exec psql bypass of the multi-statement CLI limitation).

**Ready to proceed with:**
- **Option Y — P4 Polish + ARG** (plan §8.5, 5 tasks P4.1-P4.5)
- **Option Z — Deferral A.2 finish** (8 remaining callers from bureau-ops-p2-complete heritage)

**Deferrable observations (P4 candidates, not blockers):**
- `/circuit` polling cadence is ~2× other panels — worth reviewing if cost/noise matters.
- Edge case: delta-text `–` when baseline=$0 + dirty slider. Acceptable; a P4 polish could render `+$0.00` instead for explicitness, but the current behavior is defensible ("no meaningful delta yet").
