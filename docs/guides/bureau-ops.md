# Bureau Ops — Operator Handbook

> **Audience:** Platform admin on call. Everyone who can see the red CUT ALL AI button.
> **Purpose:** How to read, react, and respond from the Bureau Ops cockpit (`/admin` → `Bureau Ops` tab).
> **Status:** Living doc. Update as incidents expose gaps.

---

## 1. What the cockpit is (and isn't)

The cockpit is the **single place** to:

1. See what AI spend looks like **right now** (ledger, burn rate, forecast).
2. See which circuits are **tripping** (circuit matrix, quarantine).
3. **Kill** a model / provider / purpose when it goes wrong (quarantine).
4. See every AI call as it happens (firehose).
5. Triage Sentry noise without leaving the platform (sentry rules).
6. Audit what you did last week (incident dossier drawer).
7. Read the ambient dispatch crawl (footer ticker).

It is **not** a billing tool, an invoice system, a research dashboard, or a SOC2 compliance artefact. Don't hunt for tax data here. For anything > 30 days back, go to OpenRouter's own dashboard (the Bureau Ops ledger only stores aggregated `ai_usage_rollup_hour` and `ai_usage_log` with its own retention window).

---

## 2. The 8 panels (top → bottom)

### Panel ① — LEDGER // LIVE BURN

**What you're looking at.** Today and month-to-date spend, today's total tokens and call count. The four tiles animate via `<velg-kinetic-counter>` — watch them roll when fresh data lands (~30s refresh).

**When to worry.**
- `TODAY` tile crossing 10× the daily rolling average. Check against forecast (panel ⑥) — if the slope was projected, it's working as intended; if not, check firehose for the dominant purpose.
- `CALLS LAST HOUR` spiking into the hundreds. Usually = forge burst or heartbeat runaway.

### Panel ② — BURN RATE // 24H

**What you're looking at.** Last-hour cost + 24h linear projection + hourly sparkline (via ECharts).

**Reading the sparkline.**
- Flat line at zero → platform idle.
- Spiky bursts → forge runs, scheduled heartbeats.
- Sustained plateau at elevated level → check circuit matrix (panel ③) — something is probably retrying in a loop.

### Panel ③ — CIRCUIT MATRIX // N SCOPES TRACKED

**Observational only.** Dot matrix cells (one `<velg-dot-matrix-cell>` per scope × key combo). Colors: green (CLOSED — healthy), amber (HALF-OPEN — probing), red (OPEN — degraded), dark (KILLED — manually cut).

**Scopes, in order of severity:**
1. `provider` — entire upstream (OpenRouter). If this is red, nothing works.
2. `model` — specific model ID. Failing one model shouldn't affect others.
3. `purpose` — feature area (forge, chat, heartbeat). Kills cut ONE feature.
4. `global` — used only for the `cut-all` action. See Quarantine below.

### Panel ④ — QUARANTINE // KILL SWITCHES

**The control surface.** Lives ABOVE THE FOLD deliberately — when something breaks, operators need the kill button where their eyes already are.

**Three action types:**
| Action | What it does | How to undo |
|---|---|---|
| **CUT ALL AI** | Sets a global KILL on all providers for N minutes (default 60). Every `run_ai` / `OpenRouterService.generate*` call raises `BudgetExceededError`. | Wait for the timer OR manually `revert` via the same panel. |
| **Kill a scope** | Targets one (scope, key) pair (e.g. `model:openai/gpt-5`). All other scopes keep flowing. | Click `REVERT` on that row. |
| **Reset circuit state** | Clears an auto-tripped CLOSED/OPEN cycle. Forces a fresh probe. | No undo needed — state is ephemeral. |

**Confirmation required.** CUT ALL AI prompts for a reason ≥ 3 characters. Type a short explanation ("openrouter 402 cascade", "testing revert sweep", etc.); this is the `reason` field that ends up in the audit log + dispatch ticker.

**Visual feedback.** A successful CUT ALL plays the **CRT-tube-off animation** — the 8-panel grid collapses to a horizontal band, then a point, then restores. This is dramatic on purpose: it tells every operator on every screen that the global kill has engaged.

**Reduced-motion** users see a brief opacity dim (~600ms) instead of the geometric collapse.

### Panel ⑤ — COST HEATMAP // HOUR × KEY

**What you're looking at.** Dense grid: rows = purpose/model/provider (toggle), columns = hours over the last 7/14/30 days. Cell brightness = cost.

**Refresh cadence.** 5 min (MV-backed). If you need fresher data, reload the tab.

**Reading it.** A bright column = that hour was expensive across many purposes. A bright row = that purpose dominated the whole window. A bright cell that sticks out diagonally = singular incident, check firehose.

### Panel ⑥ — FORECAST // ORACLE

**What you're looking at.** End-of-month projection + confidence band + Haiku-generated driver text (max 2 sentences, Spectral italic). Baseline counter (left) is pulled from the 30-day rollup; adjusted counter (right) shows `baseline + what-if deltas`.

**The 5 what-if sliders:**
| Slider | Min/Max | Default | Effect |
|---|---|---|---|
| `growth_multiplier` | 0.5× – 2× | 1× | Multiplies the entire baseline. Use for "what if users 2× overnight?" |
| `forge_runs_pct` | 0% – 300% | 100% | Only affects the forge purpose share. |
| `heartbeat_pct` | 50% – 200% | 100% | Affects heartbeat + chat_memory shares. |
| `chat_pct` | 0% – 300% | 100% | Affects chat + chat_memory shares. |
| `model_efficiency_pct` | 20% – 200% | 100% | Global multiplier on cost (e.g., switching Sonnet → Haiku ≈ 30%). |

**Deltas are ADDITIVE, not multiplicative.** If you set growth=2× AND chat=200%, you don't get 4× chat spend — you get the baseline growth *plus* the extra chat-share growth, summed. This matches operator intuition ("each slider adds $X") and avoids surprise compounding. See `ForecastPanel.ts:198-203`.

**Refresh** button re-fetches baseline + driver text. Sliders preserve across refresh; `RESET ALL` clears them.

**Footnote "default-tick":** every slider shows a small amber tick at its default position. The thumb sits on the tick when the slider is at default; the tick stays put when you drag away, so you always see where "neutral" lives — even at the track extremes.

### Panel ⑦ — SENTRY RULES // N CONFIGURED

**What you're looking at.** Three kind-groups:
- **Ignore (drops events)** — Sentry never even records these.
- **Fingerprint (collapses groups)** — Many events merge into one Sentry issue.
- **Downgrade (lowers severity)** — Event still recorded, just not paging.

Each rule shows: match (regex or string), message template, sibling (`fp` for fingerprint rules), silenced-24h counter, and CRUD buttons.

**Creating a rule.** Hit `+ Create rule`, pick kind, specify match, describe why. The rule is live immediately — there's an in-memory cache refreshed every 60s plus Realtime invalidation on CRUD.

**Triaging a Sentry burst.** When Sentry is screaming at you:
1. Find the event in Sentry.
2. Extract the stable substring from the message (e.g. `Key limit exceeded`).
3. Create an **Ignore** or **Fingerprint** rule here. Silencing via Sentry's UI is slower and doesn't survive a Sentry project reset.

### Panel ⑧ — FIREHOSE // ai_usage_log

**What you're looking at.** Real-time stream of every AI call (via Supabase Realtime). Each row: timestamp, purpose, model, tokens, cost, **redacted** simulation_id + user_id (hover to reveal with an audit-trail label), status.

**Redaction.** D-4 compliance: no prompt bodies EVER land here. The cockpit shows only metadata. If you need to see the prompt, you need to query `ai_usage_log` directly with service-role credentials — and that read is itself audited.

**Hover-reveal.** `<velg-redacted>` shows a black bar in place of IDs; hover/focus reveals the short form + a label ("simulation id" / "user id"). Deliberately friction-added — reading IDs should be a conscious act, not ambient spillover to anyone glancing at the screen.

---

## 3. The footer: DISPATCH crawl

A 60-second horizontal scroll of the last 20 `ops_audit_log` entries. Purely ambient — you're not supposed to read it carefully, just sense-check that the platform is quiet (slow crawl, mostly muted tints) or active (rapid, danger-red dots flashing past).

**Action colours (prefix match):**
- `kill.*` → red
- `budget.*` → amber
- `sentry.rule.*` → primary
- Others → primary (default)

**Pause-on-hover.** Hover the ticker → animation pauses. Keyboard users: tab into the ticker → same pause (via `:focus-within`). Intentional — if an operator spots something scrolling past that they want to read, they can stop the crawl without the row moving on.

`aria-live="off"` — screen readers are NOT notified of every row. The Incident Dossier drawer is the accessible path.

---

## 4. The header: Open Incident Dossier

Slide-in drawer, full `ops_audit_log` query UI. Filter by action-type + time window. Use this when:
- Something changed in the last 24h and you need to know what.
- You're writing an incident report and need a clean audit trail export.
- You're screen-sharing with someone who needs context.

Drawer is focus-trapped, screen-reader-friendly (paginated table, explicit labels, no aria-live spam).

---

## 5. Common incidents + response playbook

### Incident: Sentry flooding with 429/503 errors

**Symptoms:** Sentry events/hour chart spikes; Sentry project quota warning.
**Likely cause:** OpenRouter backend degradation. Model unavailable → pydantic-ai retries → Sentry event per retry.
**Response:**
1. Check **Panel ③** — is `provider:openrouter` half-open or open? If so, the auto-circuit is already working; no manual action needed.
2. Check **Panel ⑦** — is the `RateLimitError` fingerprint rule active? If not, create one.
3. If Sentry is still paging and auto-circuit is working as intended, **tune the Sentry downgrade rule** (add `\b(429|503)\b` regex) instead of killing the provider.
4. If the provider is flapping in and out of HALF-OPEN, **manually kill** with a 30-minute revert and let OpenRouter recover.

### Incident: Unexpected cost spike (dollar alert)

**Symptoms:** Panel ① tile jumps >10× expected.
**Response:**
1. **Panel ⑤** → 1-day window, group by `purpose`. Which purpose is dominant?
2. **Panel ⑥** → slide the matching slider down (e.g. `forge_runs_pct` → 50%) to see the counterfactual.
3. **Panel ⑧** → scroll firehose to confirm the dominant purpose is actually being called this many times.
4. If it's a runaway loop (same simulation_id spamming chat): **kill `purpose:chat`** temporarily and notify the user's simulation owner.

### Incident: "CUT ALL AI" was pressed

**Symptoms:** CRT-off animation played. Every new AI call fails with 402. Toast: "CUT ALL AI engaged."
**Response (the person who pressed it):**
1. Your reason is in the audit log. Good.
2. The cut lasts 60 minutes by default; `ops_audit_log` has the `reverts_at` timestamp.
3. To cancel early: **Panel ④** → the `global:all` row should show in KILLED state → `REVERT`.

**Response (a different operator who joined the channel):**
1. Open the cockpit. Panel ④ will show the cut.
2. Panel ⑤ will show $0 for the duration — confirm this is expected.
3. Check the dispatch ticker at the bottom for the reason the other operator typed.
4. If cut looks wrong, REVERT immediately and message the triggering operator.

### Incident: "My simulation's chat isn't working"

**Possible causes (in diagnostic order):**
1. **Panel ⑦** — is there an active `Downgrade` rule that's accidentally masking a legitimate error? Disable rules one at a time.
2. **Panel ⑥** → `chat_pct` slider at 0? That's client-side only, can't actually break anything. Move on.
3. **Panel ④** → is `purpose:chat` killed? If yes, **this is why**. Revert.
4. **Panel ④** → is `model:whatever-sim-is-using` killed? Check sim's model config.
5. Bureau Ops budget exhausted? Check Sentry for BudgetExceededError traces linked to this simulation_id.

### Incident: Forge not generating content

**Panel ③** → is `purpose:forge` open/killed? Revert or wait for auto-probe.
**Panel ⑦** → any active rule silencing forge errors? Check Sentry directly with a filter.
**Forge-specific knowledge:** forge uses the `chunk` and `entity` and `theme` and `lore` purposes (not one "forge" purpose). So check all of them in the circuit matrix.

---

## 6. What to write in the `reason` field

Every mutation (kill, revert, sentry-rule CRUD, CUT ALL AI) requires a reason. Treat it as a 1-sentence Slack message to your future self:

| Bad | Better |
|---|---|
| "ok" | "OpenRouter 402 cascade, waiting 30 min" |
| "test" | "verifying revert-sweep scheduler runs on time" |
| "cost" | "forge tenant X runaway, capping until they confirm" |

The reason is shown in the dispatch ticker, stored in `ops_audit_log.reason`, and surfaces in the Incident Dossier drawer. It's permanent and public to every admin.

---

## 7. Things NOT to do

- **Don't bypass a kill.** If someone killed a scope, assume they had a reason. If you think the kill is wrong, **revert AND notify them** in the same action — not one or the other.
- **Don't disable an active `Ignore` Sentry rule** without checking the 24h silenced count. If it silenced 200 events yesterday, re-enabling it will suddenly flood Sentry.
- **Don't scroll the firehose for entertainment.** It's a side-channel for incident context, not a game feed. Reading IDs (`<velg-redacted>` hover) is audited in the browser's UX but not server-side; still, discipline.
- **Don't run the Darkroom variant generator during a cost spike.** It's a 3-call burst; use `forge_theme_service.generate_variants` sparingly when the forecast is hot.

---

## 8. Architecture notes for operators who also read code

- **Budget pre-check fires at `run_ai` and `OpenRouterService.*` chokepoints.** See `backend/services/ai_utils.py:102` + `backend/services/external/openrouter.py:142`. Global + purpose + simulation + user axes.
- **`ops_forecast_service.py` is budget-exempt** — the forecast must run even when the budget has exceeded, or you'd lose visibility into the very thing that's blocking you (AD-6).
- **Circuit state is cached 15s** in `BudgetEnforcementService`. A CUT ALL takes effect on the next request after the cache window; typical max delay ≈ 15 seconds.
- **ai_usage_rollup_hour** is a materialized view refreshed every 60 seconds. Panel ⑥'s baseline projection is within a 60s lag of reality.
- **Sentry rules are cached 60s** with a Realtime-driven invalidation on CRUD.
- **The cockpit's own AI calls (Haiku driver text in forecast panel) are budget-exempt** — see memory `bureau-ops-p3-complete.md` note #2.

---

## 9. Escalation

- **Sentry paging you at 3am** → Bureau Ops first, fix the noise (§5.incident-1). Then sleep.
- **You pressed CUT ALL AI** → post in #ops-war-room immediately with the reason text you typed. Other operators need the context.
- **Something in the UI is BROKEN (white screen, 500)** → Sentry + `docs/analysis/bureau-ops-*-playtest-*.md` + this doc's §5 won't help. Escalate to #frontend-engineering.
- **You need to export audit data** → Incident Dossier drawer → filter → copy (no CSV export yet; add a TODO to the plan doc if you need one).

---

## 10. Glossary

- **AD-N** — Architectural Decision #N in `docs/plans/bureau-ops-implementation-plan.md` §7.
- **F27 / F30 / F59 / F19 / F51** — Triplecheck-audit findings. See memory `bureau-ops-p3-complete.md`.
- **Chokepoint** — The single code point where every AI call passes through before hitting the network. `run_ai` and `OpenRouterService.*`.
- **BudgetExceededError** — Raised by `BudgetEnforcementService.pre_check` when any budget axis hard-blocks. Bubbles to FastAPI exception handler → HTTP 402 for user-facing paths, caught at safe_background for system paths.
- **A.1 / A.2** — Deferral phases. A.1 = chokepoint wiring (done pre-P2). A.2 = caller-threading (done 2026-04-21 per commit `b8269f4`).

---

## 11. Version history

| Date | Change | Commit |
|---|---|---|
| 2026-04-21 | Initial handbook (P4.4) | (this commit) |
