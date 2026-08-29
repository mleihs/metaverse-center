# The Simulation Forge — Full Production Run, 2026-08-29/30

> One complete pass through the Forge against **production**, with `FORGE_MOCK_MODE=false`
> and real spend, from an empty seed to a materialized world. Every finding below was
> **measured on the running system** — production logs, the production database, the
> OpenRouter catalogue, or the rendered image itself. Nothing here is inferred from reading
> the source alone; where a hypothesis failed verification it is recorded as a non-finding
> rather than quietly dropped.
>
> Seed (grotesque, user-approved): *a civil-service district where officials are not born but
> drawn — ripening in vats of ink and the soaked handwriting of their predecessors; the health
> of the commonwealth measured in legibility.*
>
> Draft `b5609869-7134-443e-9d3b-a63beaec64f2` → simulation `ff308923-5483-4c9f-84e5-22bea2443536`
> (`state-pathography-legibility-as-biopolitical-metabolism`), created 2026-08-29 22:33:06 UTC.
> Result: 6 agents, 7 buildings, 5 zones, 35 streets, world map, lore, theme, 15 of 16 images.

---

## Summary

| # | Finding | Severity | Status |
|:--|:--------|:---------|:-------|
| 1 | `entity` starved on its token budget — 3016 of 3072 tokens spent thinking, nothing returned | **Critical** | **Fixed** (`a5cb9b73`, migration 279) |
| 2 | Wrong pydantic-ai model class — `openrouter_reasoning` unreachable | **Critical** | **Fixed** (same commit) |
| 3 | `invalidate_model_config()` never fired for `reasoning_*` | High | **Fixed** (same commit) |
| 4 | Admin `DEFAULTS` still wrote the dead `claude-sonnet-4-6` id into production | High | **Fixed** (same commit) |
| 5 | Generated prompt templates invent variables no code supplies (8 across 4 templates) | **Critical** | Open |
| 6 | Generated prompt templates drop the platform template's compositional guardrails | **Critical** | Open |
| 7 | No floor under content quality — a `"..."`-filled entity validates clean | **Critical** | Open |
| 8 | No retry on image failure; one empty completion = permanently image-less building | High | Open |
| 9 | Partial success reported as success (departments, materialization) | High | Open |
| 10 | List length is never enforced — the model may short-deliver silently | High | Open |
| 11 | `purpose=` set at zero call sites — `model_research` is dead configuration | High | Open |
| 12 | English fields never declare that they are English | High | Open |
| 13 | Two purposes have no token budget and no timeout at all | Medium | Open |
| 14 | Image-quality fallback on the main path is Stable Diffusion, not flux | Medium | Open |
| 15 | Only model ids are admin-configurable; budgets, timeouts, effort are not | Medium | Open |
| 16 | The world is *named* in English, permanently — `simulations.name_de` never written | High | Open |
| 17 | Citations are free text, bound to nothing — one misattribution measured | Medium | Open |
| 18 | Four minutes of `0 / 16 · 0 %` before the first image | Medium | Open |
| 19 | The denominator 16 is never broken down; banner and lore images are counted but never shown | Medium | Open |
| 20 | Deep research fails during materialization, silently degrades | Medium | Open |
| 21 | The Table never scrolls to what it just produced | Low | Open |
| 22 | Three German errors in one localized string | Low | **Fixed** (`a5cb9b73`) |

Non-findings (checked, sound): the ETA tilde, the honest `REKALIBRIERUNG…` overrun label,
the department mutual-exclusion locks, the destructive-action guards, the SPA catch-all
returning 200 to credential scanners (verified: SPA shell, no secrets).

---

## A. Fixed in this pass

### 1. `entity` starved on its token budget — **Critical**

**Measured on production.** Personnel Bureau, four consecutive attempts:
115.8 s → **502**, 74.9 s → **502**, 72.4 s → 200, 53.3 s → **502**. Three of four failed,
each billed in full, and the wizard gave up at 3 of 6 operatives.

Full traceback tail:

```
pydantic_ai.exceptions.UnexpectedModelBehavior: Model token limit (3072) exceeded
before any response was generated.
```

Zero output tokens. The model did not answer badly — it ran out *before* the answer.

**Root cause.** `generate_single_entity` calls `create_forge_agent(...)` without `purpose`,
so it defaults to `"forge"` → `model_forge` → `deepseek/deepseek-v4-pro`. That is a reasoning
model, and OpenRouter offers it at **`high` and `xhigh` only** — it cannot think quietly. The
OpenRouter documentation is explicit on both halves: *"max_tokens must be strictly higher than
the reasoning budget"* and *"Reasoning tokens are considered output tokens and charged
accordingly."* Effort maps to a share of the budget (xhigh ~95 %, high ~80 %, medium ~50 %,
low ~20 %, minimal ~10 %). Measured: **3016 of 3072 tokens went to thinking, 56 remained.**
`ForgeAgentDraft` demands `character` and `background` at 200-300 words each, both again in
German — 800 to 1200 words. Never reachable.

Nothing in the backend had ever set a reasoning parameter (checked: zero hits). We inherited
the model's full default thinking budget *and* capped total output at 3072 — two settings that
contradict each other. `ai_usage_service.py:31` already notes that the whole DeepSeek V4 line
spends its tokens on the output side; the token table never got the memo.

**Measured, not guessed.** Twelve models against the real `ForgeAgentDraft` schema, tool-calling
as pydantic-ai does it, bilingual prompt, four runs each:

| Model | Spec 4/4 | Language 4/4 | words c/c_de/b/b_de | s | $/entity |
|:--|:--|:--|:--|--:|--:|
| **deepseek-v4-pro, thinking OFF** | **4/4** | **4/4** | 262/254/318/308 | 31 | 0.0078 |
| grok-4.20 | 4/4 | 2/4 | 224/224/210/207 | 30 | 0.0042 |
| mistral-medium-3.1 | 2/4 | 2/4 | 196/200/178/**104** | 28 | 0.0037 |
| mistral-large / -2512 | all 4 runs failed | — | — | — | — |
| gpt-4.1-mini · gemini-2.5-flash · qwen3-max | 0/2 | 2/2 | ~125-155, short | 8-32 | — |

**The answer was not to change the model but to stop it thinking.** Disabling reasoning is a
first-class mode on the V4 hybrids (`reasoning_tokens: 0` confirms it), and it costs nothing in
quality — the German reads natively (*"Ihre Kindheit roch nach Chlor und Papierbrei"*), invents
world-specific compounds, and keeps the two languages cleanly apart.

**Fix shipped.** `reasoning_<purpose>` in `platform_settings`, resolved by
`get_platform_reasoning()` through the same cache as the model ids. `off` → `{"enabled": false}`,
a named level → `{"effort": ...}`, `auto` → send nothing. An unknown value warns and degrades to
`auto`. `entity`/`lore`/`chunk` ship as `off`; `anchors`/`dossier` stay `auto`.

**Verified on production after deploy:** 13 of 13 entity calls returned 200, agents 18.7-24.7 s
(133 s for six), buildings 8.8-16.9 s (78 s for seven), zero failures, `reasoning:
{'enabled': False}` logged on every call.

### 2. Wrong pydantic-ai model class — **Critical**

`get_openrouter_model` built a generic `OpenAIChatModel` against OpenRouter's base URL. Same
wire protocol, but only the native `OpenRouterModel` carries `OpenRouterModelSettings` — and
with it `openrouter_reasoning`, the lever finding 1 needs. Routing it through `extra_body` is a
dead end: the OpenAI-derived models overwrite colliding keys they build themselves.

Switching to the native class also unlocks `openrouter_usage` (real cost from OpenRouter instead
of the estimate table whose own comment calls it *"fiction"*) and `openrouter_provider`.

### 3. `invalidate_model_config()` never fired for `reasoning_*` — High

`admin.py` invalidated the cache only for `key.startswith("model_")`. `reasoning_*` lives in the
same cache, so an admin would have saved a level and watched nothing happen for up to five
minutes. Exactly the "switch with no wire" pattern this codebase has been burned by before.

### 4. Admin `DEFAULTS` wrote a dead model id into production — High

`AdminModelsTab.ts` still carried `anthropic/claude-sonnet-4-6` — the id with a **hyphen** where
the catalogue has a dot, which the backend corrected on 2026-08-29. "Reset to Defaults" would
have written it straight into `platform_settings`. Presets and defaults now mirror
`HARDCODED_DEFAULTS` and are pinned to ids verified against the live catalogue.

### 22. Three German errors in one string — Low

`de.xlf` line 8132/8144: *"Vermiss die Dimensions-Topologie und kartier Transit-Korridore aus
deiner Saat-Vision."*
- `kartier` → `kartiere`. Measured: the **only** apocopated `-ieren` imperative in the entire
  catalogue. Not house style, a slip.
- `Saat-Vision` is terminology drift — the UI calls the same object **"Der Anfangskeim"** one
  phase earlier (`Anfangskeim` 1×, `Saat-Vision` 2×).
- Missing article before `Transit-Korridore`.

Also repaired: `sd02a9432614df2f5` had *"Einstellungen gespeichert."* twice in its target.

---

## B. The template class — two findings, one root

Phase A.6 (`ForgeThemeService.generate_simulation_templates`) asks a model to write the
per-simulation prompt templates and stores them **unchecked** as replacements for curated
platform templates. Nobody compares the result against either contract.

### 5. Generated templates invent variables no code supplies — **Critical**

Production log, on **every** portrait and **every** building:

```
Missing variable 'agent_title' in template 'portrait_description'
Missing variable 'building_leserlichkeit' in template 'building_image_description'
```

Placeholders of the generated templates minus those of the platform templates:

| Template | Invented |
|:--|:--|
| `portrait_description` | `agent_title`, `leserlichkeit_level` |
| `building_image_description` | `building_leserlichkeit` |
| `chat_system_prompt` | `agent_condition`, `agent_title`, `bureau_name`, `zone_name` |
| `chronicle_generation` | `pathological_condition` |

**Eight invented variables across four templates**, and the model invented them *in this world's
own vocabulary* (`leserlichkeit_level`, `pathological_condition`) — which is precisely why they
look plausible enough that nobody notices.

**The damage is not confined to images.** `chat_system_prompt` and `chronicle_generation` are
runtime templates: every future conversation with an agent of this world carries literal
`{agent_title}`, `{bureau_name}`, `{zone_name}` in its system prompt; every chronicle entry
carries `{pathological_condition}`. The defect is baked into the world, not into one run.

**And it never surfaces as an error.** `prompt_service.py:317` catches the `KeyError` and calls
`_safe_format`, which leaves unknown placeholders standing. That text then goes to a *second*
model, which writes the image description — and that model fills the hole with something
plausible. Measured on the rendered 772×1024 portrait of "Almandine": the lapel badge reads
**"Leserlichkeit: 9%"**, a number nobody computed. A missing variable is not reported; it is
overwritten with fiction.

**Fix.** After generation, diff the template's placeholders against the known variable set for
that template type. Unknown → reject the generated template (keep the platform one) or strip the
placeholder, and be loud either way.

**Reusable check:** pull `re.findall(r'\{(\w+)\}', prompt_content)` for both the simulation and
platform rows of the same `template_type`; the set difference is what was invented.

### 6. Generated templates drop the platform guardrails — **Critical**

User observation: *"the images all look the same, all with that odd lamp"* and *"now there were
two portraits in one image field"* and *"this used to deliver better quality."*

**Model checked: `black-forest-labs/flux-2-pro`** — unchanged. The quality did not fall at the
model. It fell at the prompt.

Generated `portrait_description`, full text:

> *"Describe a portrait of {agent_name}, a {agent_title} of the Tintenbad bureau. The image is a
> Kalotyp-Positiv auf officinal stock, captured under the directional beam of an **Aktenlampe**
> fueled by expired Registraturgut. … nitrate bloom and wet-plate imperfections, its limited
> palette of Silbernitratgrau, Hämatoxylin, and the warm amber … Pinned to the lapel is a
> diagnosis: 'Leserlichkeit: {leserlichkeit_level}%'."*

1. **Why they all look alike.** The entire visual treatment is fixed — lamp, process, palette,
   plate defects. Only `{agent_name}` and `{agent_character}` vary. Six portraits, one image.
2. **Why two people share a frame.** The generated template contains **no** compositional
   constraint. Checked, all six markers absent: `SINGLE`, `single subject`, `head-and-shoulders`,
   `centered`, `one person`, `solo`. The platform template carries every one of them
   (*"a SINGLE person … single subject centered in frame, shallow depth of field"*). Phase A.6
   replaced a template **with** guardrails by one **without**.
3. **What else is lost.** `{agent_background}` does not appear at all — the backstory no longer
   reaches the image.

**Visual evidence** (agent "Almandine", full resolution): two panels side by side, the same woman
twice; the Aktenlampe visible top right; badge reading "Leserlichkeit: 9%". The craft is there
(scriptural scars on the face, handwriting on the hands) — the control is not.

**Fix.** The generated template may replace the **style** portion only. Composition, subject
count and the variable list stay platform-owned. Alternatively a post-generation checklist
(placeholder set + required phrases) that keeps the platform template on violation.

---

## C. Nothing enforces the contract

### 7. No floor under content quality — **Critical**

`ForgeAgentDraft` carries `min_length=1` on **only** the three German fields
(`primary_profession_de`, `character_de`, `background_de`). `character`, `background`,
`primary_profession`, `name` have **no minimum at all**.

Measured: `deepseek-v4-flash-0731` returned an object whose **every field was literally `"..."`**
— and it **validates clean**. Three dots satisfy `min_length=1`. That model is `model_default`.
Equally, had the *English* `character` been empty instead of the German one, the hollow object
would have passed too.

**Fix.** Real minimums on the long-form fields on both sides, derived from the word counts the
field descriptions already state.

### 10. List length is never enforced — High

Measured: first anchor scan `count: 3` (86.8 s), user's re-scan `count: 2` (37.1 s). No code
drops anything — `generate_anchors` returns `result.output` unfiltered and `output_repair` only
engages on malformed JSON. **The three exists only as a request in the prompt text.** The output
type is `list[PhilosophicalAnchor]` with no length constraint, so the JSON schema the model sees
carries no `minItems`, and pydantic-ai's validation retry (`retries=1`) has nothing to fail on.
A short delivery is structurally unnoticeable, and it costs the user one of `_MAX_SCANS = 3`
readings. Two hardcoded UI strings claim "all three anchors" / "another three anchors".

Repo-wide there are four `output_type=list[...]` sites:

| Site | Guard |
|:--|:--|
| `research_service.py:432` | logs `count` afterwards |
| `forge_orchestrator_service.py:521` | `if not agents_list` — catches empty, not short |
| `forge_orchestrator_service.py:541` | same |
| `forge_orchestrator_service.py:1729` | **none**, and the prompt says *"Generate exactly 3 new agents"* |

**Fix.** The count belongs in the type (`Annotated[list[X], Len(3, 3)]`), which is both what
becomes the schema and what the retry validates. After an exhausted retry, do **not** 500 — two
good anchors beat an error — but log at warning and drop the "three" claim from the strings.

### 12. English fields never declare that they are English — High

User observation: *"An Amt whose Akten verwischen is pathologized"* — neither German nor English.

Measured: on `PhilosophicalAnchor` **all five** base fields (`title`, `literary_influence`,
`core_question`, `bleed_signature_suggestion`, `description`) carry no language statement; on
`ForgeAgentDraft`, `name`/`gender`/`primary_profession` carry none and `system`/`character`/
`background` are described without naming a language. Only the `_de` fields say anything
("German equivalent of X"). The English side is **unnamed**, so the model infers the language
from context — and the context is a German seed. The prompt does not help either: *"BILINGUAL
OUTPUT: For every text field, **also** produce a German equivalent"* presupposes a base language
without naming it.

This retroactively explains two earlier measurements: `primary_profession` came back once as
"Tintenbad-Aufseher Erster Klasse", and gpt-4.1-mini wrote "Schriftregulation" into the English
field. Same root, not model weakness.

**Fix.** Name the language on every base field. Like the count in finding 10, the language
belongs in the type.

---

## D. Failures that report success

### 8. No retry on image failure — High

`forge_orchestrator_service.py:1510-1529`:

```python
except ReplicateBillingError: raise
except (httpx.HTTPError, ReplicateError, OpenRouterError, KeyError,
        TypeError, ValueError, OSError):
    images_failed += 1
    logger.exception(...)            # log
    sentry_sdk.capture_exception()   # Sentry
    # ...and on. No retry.
```

Measured: `22:44:49 Batch image gen failed for building`, entity `c338fcaa-…` =
**"Gallertkammer der Gerinnenden Lettern"**. Traceback tail:
`OpenRouterError: Empty content in response`. It was not the *image* model that failed but the
**text** model writing the image description — an empty completion, and the fallback chain
returned empty too. `images_failed` is counted and goes **only to Sentry**; never into progress,
never to the user, never into a second attempt. The building is permanently image-less while
`Background task completed: run_batch_generation (864.8s)` reports success and the bar stops at
15/16 · 94 %.

**User requirement, verbatim: "there must be hardening that asks again. This MUST run through."**

**Fix.** Per-image retry with backoff (the cause was transient), the partial failure carried in
the result rather than only in Sentry, and a user-facing "generate the missing images" action.
`ReplicateBillingError` stays exempt — retrying with no credit burns money.

### 9. Partial success reported as success — High

The recruitment run stopped at **3 of 6** (`MAX_CONSECUTIVE_FAILURES = 2`). On screen:
department card **green tick, "✓ REKRUTIERT"**; action bar **3/6 OPERATIVE**; visible error
message **none** (verified by walking every shadow root, zero matches).
`ForgeStateManager._generateEntitiesIncremental` *does* set
`error.value = "Generation stopped after N of M entities."` — nothing renders it, and the
department flips to "done" independently.

Note the retries themselves are **not** silent and **not** unbounded (`MAX_RETRIES = 3`,
`MAX_CONSECUTIVE_FAILURES = 2`, every attempt through `captureError` with a `source` and an
`attempt` tag). Sentry sees everything. Only the user does not.

### 20. Deep research fails during materialization — Medium

`22:33:07 AI call started purpose=research` → 14.5 s → `AI call failed` → *"Deep research
failed — using Astrolabe context only"*. The fallback holds and lore is still produced, but the
deep research the user can switch on in the Darkroom delivers nothing. `purpose=research` runs
at `max_tokens 2048`. Cause not yet determined — pull the traceback.

---

## E. Configuration that is not configurable, or not wired

### 11. `purpose=` set at zero call sites — High

Measured: `grep -A6 create_forge_agent\( backend/services/*.py | grep -c purpose=` → **0**.
Every `create_forge_agent(...)` falls back to `"forge"`. Consequence: **`model_research` is dead
configuration** — the admin UI offers the switch, `get_platform_model` supports it, and the
research/anchor calls (`research_service.py:269` and `:404`) run on `model_forge` regardless.

### 13. Two purposes have no budget and no timeout — Medium

`style_refine` and `templates` appear in neither `PYDANTIC_AI_MAX_TOKENS` nor
`PYDANTIC_AI_TIMEOUTS`. Confirmed in the production log:
`purpose=style_refine timeout=None max_tokens=None`. With `timeout=None` there is no time limit
at all, against a model whose output ceiling is 384 000 tokens. Both completed in this run —
this is an open flank, not the cause of anything observed.

### 14. Image-quality fallback on the main path is Stable Diffusion — Medium

The presets **are** wired end to end: `_QUALITY_PRESETS` (2.5/18 · 3.5/28 · 6/42) →
`_applyPreset` → `_updateSettings` → `ai_settings.image_guidance_scale` /
`image_num_inference_steps` → `model_resolver` → Replicate. On screen: `GUIDANCE: 3.5 |
SCHRITTE: 28`.

The defect is the **fallback**, on the path that normally runs:

| Method | Used when | Fallback | Clamps flux |
|:--|:--|:--|:--|
| `resolve_image_model` (:288) | **no style reference — the normal case** | **7.5 / 50** (SD) | **no** |
| `resolve_img2img_model` (:398) | style reference present | 3.5 / 28 (flux) | yes, at 10 |

Two methods in one file disagree. It bites exactly when the user never opened the Darkroom and
is relying on the default. This is the same defect the Darkroom's own comment describes — removed
from the slider, left standing in the default table.

### 15. Only model ids are admin-configurable — Medium

In `platform_settings` and therefore in the admin UI: the model id per key. Not configurable,
though it must be: `max_tokens` per purpose (hardcoded, and the number that broke this run),
`timeout` per purpose (hardcoded), and — until finding 1 — reasoning effort. The resolver knows
only four keys, so the thirteen purposes cannot be addressed individually.

*Partially addressed:* finding 1 shipped `reasoning_*` as admin-editable. Budgets and timeouts
remain hardcoded.

---

## F. What the user sees

### 16. The world is *named* in English, permanently — **High** (raised from Medium)

The ceremony shows **"STATE PATHOGRAPHY: LEGIBILITY AS BIOPOLITICAL METABOLISM"** under a German
UI. That is two defects, and the second is the serious one.

**16a — display.** `VelgForgeIgnition.ts:366` passes `anchor?.title`. The ceremony already
imports the house helper (`import { t } from '../../utils/locale-fields.js'`) and uses it for
agents and buildings; the anchor was never routed through it.

**16b — persistence.** Measured on production:

| Column | Value |
|:--|:--|
| `simulations.name` | `State Pathography: Legibility as Biopolitical Metabolism` |
| `simulations.slug` | `state-pathography-legibility-as-biopolitical-metabolism` |
| `simulations.name_de` | **NULL** |
| `simulations.description_de` | populated |

The column **exists**, its sibling `description_de` **is** filled — and repo-wide **no backend
code writes `simulations.name_de`** (grep finds only journal and dungeon usages). The world
therefore carries an English name for its whole life, in every view, in every language, and the
slug is derived from the English name so it cannot be corrected without breaking the URL.

This is not a rendering bug that a `t()` call fixes. The materialization path must derive the
name from the anchor's `title` **and** `title_de` and write both. Existing worlds need a
backfill; the slug stays as it is.

*(Not a finding: the epigraph looked truncated. It types in progressively — I had read a
screenshot mid-animation. Lesson: never judge a typewriter effect from the first frame.)*

### 17. Citations are bound to nothing — Medium

`PhilosophicalAnchor.literary_influence` is free text. No URL field, no reference to the Tavily
hits. The research enters the prompt as prose and the model writes the citation from memory,
while the card prints it with a file number (`ANC-002`) and a "GEHEIM" stamp — with the authority
of a source — under a footer claiming *"research grounded in web sources + AI analysis."*

Measured on anchor 2 of the second scan:
- ✅ James C. Scott, *Seeing Like a State* (1998) — year correct, and *legibility* really is
  Scott's central concept. Hits the seed exactly.
- ❌ Foucault, *The Birth of Biopolitics* — the classic misattribution: the 1978/79 course is
  famously *not* mainly about biopolitics.
- ✅ *Society Must Be Defended* (1975/76) — correct, the 17 March 1976 lecture.
- ⚠ The canonical locus is missing: *The History of Sexuality* vol. 1 (1976), final chapter.

Right shelf, wrong book — structurally unnoticeable, because no field can be reconciled with a
retrieved source.

### 18. Four minutes of `0 / 16 · 0 %` — Medium

```
22:33:06  ignition, simulation created
22:33:07  Phase A (lore) — deep research fails, falls back
22:35:32  Phase A complete
22:35:33  A.5 style_refine     (timeout=None, max_tokens=None)
22:35:54  A.6 templates        (timeout=None, max_tokens=None)
22:37:06  A.7 world map done   (~72 s of pure Python, no log line at all)
22:37:07  Phase B: first image
```

**4:01 of a bar that does not move**, while the ignition screen promised "3 to 5 minutes". The
denominator changes underneath (14 → 16) while the numerator sits at 0.

### 19. The denominator is never broken down — Medium

Counted from the log: `Generating image` → banner 1, agent 6, building 7, lore 2 = **16**.
Uploads: 1 + 6 + 6 + 2 = **15** (one building failed, finding 8).

The user sees "6 AGENTS / 7 BUILDINGS / 5 ZONES" and a denominator containing three further
things the ceremony never mentions. The banner and both lore images are generated, paid for and
waited on — and never shown.

### 21. The Table never scrolls to what it produced — Low

After each of the three departments the result appears well below the fold (zones + streets,
operative cadre, structures). The page does not follow. The department card flips to "✓ done"
and the user has to go looking. Observed across the whole run: manual scrolling was needed after
**every** department.

---

## Standing requirement for every fix in this document

Explicit instruction from the project owner, and it governs all work below:

> **Cleanest architecture, cleanest code. The project's coding conventions must be observed.**

Concretely, for this codebase (`CLAUDE.md` is the contract, not a suggestion):

- **No hacks, no temporary shortcuts, no TODO-later patches.** If a workaround seems necessary,
  the design is wrong — fix the design.
- **Separation of concerns:** routers do HTTP only, services hold business logic, models
  validate. No business logic in a router, no direct DB query in a router.
- **No code duplication.** Before any new service, list the existing patterns the new code must
  follow.
- Typed Pydantic wrappers on every response; the return type annotation is the single source of
  truth. Never `response_model=`, never a raw `{"success": True}` dict.
- `get_effective_supabase` in routers; never `service_role` for normal CRUD; never bypass RLS.
- Audit logging on every mutation. Module-level imports, no late binding.
- **SQL owns integrity and atomicity; Python owns business and game logic.** Concurrent-access
  data goes through atomic RPCs with compare-and-swap, never fetch-compute-update in Python.
- Frontend: `LitElement`, state via `AppStateManager`, API through the existing singletons,
  shared components before new ones, design tokens only, icons from `utils/icons.ts`.
- **Every failure path observed** — `captureError(err, { source: 'Class.method' })`. No
  `catch {}`, no `.catch(() => {})`.
- No `as unknown as T`. No raw hex or `rgba()`. No em dashes and no LLM-isms in `msg()`.
- **Every user-facing string through `msg()`**, with a German target in `de.xlf`.
- **Invoke the `velg-frontend-design` skill before writing any component code.**
- After every change: `ruff` **and** `tsc`, then the full gate suite (`npm run lint:full`,
  currently 16 gates) plus the test suites. Fix before presenting.
- Commit messages explain **why**, the impact, and how it was verified.

Two lessons from this run that belong in the same list, because they cost real time here:

- **Measure before fixing, and measure again after.** Every finding above carries a number from
  the running system. Three of my own hypotheses died on contact with a measurement (the "double
  invocation" was the user's re-scan; the "truncated epigraph" was a typewriter animation; the
  "reasoning-off breaks the dossier" was an upstream provider error hitting both modes). State
  the measurement, not the inference.
- **A green gate is not a measurement.** The 502s ran for months under a full test suite.

---

## Proposed work order

Grouped so that each step is independently shippable and verifiable.

| Step | Findings | Why here |
|:--|:--|:--|
| **W1** | 5, 6 | Highest leverage. Until the generated templates are validated, **every future world** is born with invented variables and no compositional guardrails. Nothing else prevents that. |
| **W2** | 7, 10, 12 | One class: the contract belongs in the type. Minimums, list length, language — all three are schema work in `backend/models/forge.py` plus the output types. |
| **W3** | 8, 9, 20 | Failures that report success. Explicit user requirement on 8. |
| **W4** | 11, 13, 14, 15 | Configuration: wire `purpose=`, give the two orphan purposes budgets, unify the image defaults, lift budgets/timeouts into `platform_settings`. |
| **W5** | 16, 17, 18, 19, 21 | Surface: language, provenance, progress, scrolling. |

W1 before W2 because W1 stops the bleeding on new worlds; W2 hardens the contract that would
have caught it. W3 is independent and can run in parallel.

**Already-created worlds carry the W1 damage in their stored templates** — a repair pass over
existing `prompt_templates` rows belongs in W1.
