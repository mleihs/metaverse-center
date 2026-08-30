---
title: "The Simulation Forge — Full Production Run, 2026-08-29/30"
id: doc-forge-prod-run-2026-08-30
version: 1.0
lang: en
type: analysis
status: active
date: 2026-08-30
tags: [forge, ai, openrouter, prompt-templates, production-run, findings]
---

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
| 5 | Generated prompt templates invent variables no code supplies (8 across 4 templates) | **Critical** | **Fixed** (`36fe1b8b`, W1) |
| 6 | Generated prompt templates drop the platform template's compositional guardrails | **Critical** | **Fixed** (`36fe1b8b`, W1) |
| 7 | No floor under content quality — a `"..."`-filled entity validates clean | **Critical** | **Fixed** (W2) |
| 8 | No retry on image failure; one empty completion = permanently image-less building | High | **Fixed** (W3) |
| 9 | Partial success reported as success (departments, materialization) | High | **Fixed** (W3) |
| 10 | List length is never enforced — the model may short-deliver silently | High | **Fixed** (W2) |
| 11 | One call named its purpose twice; at 8 of 9 sites the two names differed | High | **Fixed** (W4) |
| 12 | English fields never declare that they are English | High | **Fixed** (W2) |
| 13 | Two purposes have no token budget and no timeout at all (+ one dead entry: `ascii_art`) | Medium | **Fixed** (W4) |
| 14 | Image parameters survived a model-family switch — 14 worlds feed flux an SD-era guidance | Medium | **Re-measured** (W4); repair is a decision |
| 15 | Only model ids are admin-configurable; budgets, timeouts, effort are not | Medium | **Fixed** (W4, migration 283) |
| 16 | The world is *named* in English, permanently — `simulations.name_de` never written | High | Open |
| 17 | Citations are free text, bound to nothing — one misattribution measured | Medium | Open |
| 18 | Four minutes of `0 / 16 · 0 %` before the first image | Medium | Open |
| 19 | The denominator 16 is never broken down; banner and lore images are counted but never shown | Medium | Open |
| 20 | Deep research fails during materialization, silently degrades | Medium | **Fixed** (W3) |
| 21 | The Table never scrolls to what it just produced | Low | Open |
| 22 | Three German errors in one localized string | Low | **Fixed** (`a5cb9b73`) |
| 23 | Sixteen rows in four worlds are written in Mustache syntax and never substitute | **Critical** | **Fixed** (`36fe1b8b`, migration 280) |
| 24 | **Three** `social_media.py` endpoints call `GenerationService` with parameter names that do not exist | High | **Fixed** |
| 25 | The `system_prompt` phase A.6 writes for chat is never used | Medium | Open |
| 26 | Generated themes had no contrast floor — one world shipped text and header at ratio 1.00 | **Critical** | **Fixed** (`4a9b43e8`) |
| 27 | The image style prompt was a picture, not a style — the true root of finding 6 | **Critical** | **Fixed** (`73ce73be`) |
| 28 | 29 of 123 style prompts across 18 of 41 worlds describe a picture rather than a style | High | Open |
| 29 | Stored `agents.portrait_description` rows still carry the defective template's output | High | Open |
| 30 | `building_condition` is generated from a hardcoded five-word list while every world already has its own condition taxonomy | High | **Fixed** (W4, migration 284) |
| 31 | Seeds run **after** migrations, so every platform-template `UPDATE` is discarded on a fresh database — migration 027 inert since February | **Critical** | **Fixed** (seed back-port + CI gate) |
| 32 | The platform agent template names Velgarien, in a template every Forge world uses | Medium | **Fixed** (migration 282, on production 2026-08-30) |
| 33 | Every configured timeout is unhandled — a firing timeout raises `ModelAPIError`, a name that appeared nowhere in the backend | **Critical** | **Fixed** (W3) |
| 34 | The Forge is pre-checked against a cost ledger nothing ever wrote to — 0 of 603 rows | **Critical** | **Fixed** (W4) |
| 35 | 42 of 258 agents have no `agent_mood` / `agent_needs` row — the Forge never bootstraps autonomy | High | Open |

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

## A.1 Production apply record — migration 281 (prose floor)

Applied to production 2026-08-30 12:40 UTC, after a transactional dry run
(`BEGIN … verify … ROLLBACK`) against the real production state. Backup of all ten rows before
the write: `backups/prompt-templates/platform_prose_before_281_20260830T123954Z.json`.

**What the dry run found that the container verification could not.** The migration was verified
against a throwaway Postgres seeded from `supabase/seed/006_prompt_templates.sql`. Production has
diverged from that seed, so the counters differ:

| Statement group | Fires on prod | No-op |
|:--|--:|--:|
| 10 floor appends (`prompt_content`) | **10** | 0 |
| 8 system-prompt replacements | 2 (`event_generation` en/de) | **6** |

The six no-ops are benign and were checked individually: the ornament-ordering text the migration
was written to delete is **not on production**. The four building rows have carried migration
027's stricter *"Descriptions must be brief and functional — never flowery prose"* since April;
the two `agent_generation_full` rows carry a dystopian-Velgarien designer prompt, not the seeded
*"rich, believable characters with depth and nuance"*. Only `event_generation` still had the
seeded text, and those are the two that fired.

**A hypothesis that was half wrong, measured rather than argued.** The floor block is headed
*"overrides anything above"* and contains *"Sentences may be long"* — appended to a template that
migration 027 caps at *"max 30 words, like a database entry, not a narrative"*, and 027 exists
because long building descriptions overwhelmed the image style prompt. Six runs per variant
against `deepseek-v4-flash-0731` (= production `model_default`), T=0.7, `max_tokens` 200:

| Variant | Median | Max | Over 30 words |
|:--|--:|--:|--:|
| Production today | 13 w | 15 w | 0 / 6 |
| Production + 281 | 16 w | 26 w | **0 / 6** |

The cap holds; 027 is not reintroduced. What does change is the register: the median grows by
three words, and one of six runs produced a simile (*"Risse, die wie Straßenkarten wirken"*) where
the pre-281 prompt produced none in six. That is the floor's *"at most one image per paragraph"*
acting as a ceiling where *"keine Erzählung"* had been a prohibition. Recorded as an observation,
not repaired — forking the platform floor into a short building variant would trade one text for
two, and the measurement says it is not needed.

**Post-apply verification.** Style block present exactly once in all ten rows (10/10). A second
run of all 18 statements inside a rolled-back transaction reports `0` affected rows for all 18 —
idempotent. Ledger row `20260830140000 / 281_prose_floor` written in the same transaction.

**Left open, deliberately.** `supabase/seed/006_prompt_templates.sql` still carries the
pre-027 system prompts, so a freshly reset local database ends up with text production has not had
since April. The seed is the parallel session's path; flagged there, not changed here.

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

**Fixed in `36fe1b8b` (W1).** `backend/services/prompt_contracts.py` declares, per template
type, the variables its call site supplies. The A.6 generation prompt is built from that
declaration (it used to carry one global list, nine supplied names short, that invited
`{zone_name}` into the chat template where nothing supplies it — which is exactly what
happened); the model's output is sanitised against it before storage; and `fill_template`
reports an undeclared placeholder to the log and to Sentry instead of leaving it standing.
`variables` is now written as a real JSON array rather than `json.dumps([])` into a jsonb
column.

The declaration is bound to the call sites by AST in `test_prompt_contracts.py`, so it cannot
drift silently — mutation-checked in both directions. That binding is what found
`agent_memories`, a legitimate chat variable missing from the plan's own table.

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

> **Superseded in part by finding 27.** Restoring the guardrails was necessary but not
> sufficient: the dominant cause was `image_style_prompt_portrait`, which is appended after
> everything below and fixed the subject as well as the style. Read this together with 27.

**Fixed in `36fe1b8b` (W1).** The generated template owns the style; the platform keeps a
`frame` per template type — composition and subject count for an image, the JSON shape for
the chronicle, staying in character for chat — appended by `PromptResolver` at render time
whenever the resolved template is simulation-owned. It is not stored, so it cannot be edited
away, and it is appended after substitution, so it can never carry a placeholder (there is a
test for that).

The frames are lifted from the curated platform rows measured here, not invented: the
portrait frame is that row's own COMPOSITION/IMPORTANT block.

Not addressed by the frame, and worth knowing: the ATRAMENT portrait template still does not
use `{agent_background}` at all. The frame cannot add it (frames carry no placeholders); the
new generation prompt offers it explicitly, so a regenerated template should.

### 23. Sixteen rows in four worlds never substitute a single variable — **Critical**

**Found while implementing W1, measured through the real `fill_template` code path.**

`PromptResolver` renders `str.format` style: `{name}`. Migrations 026 and 028 (February
2026) seeded per-simulation templates written Mustache style, `{{name}}` — which
`str.format` renders as the *literal text* `{name}`.

Rendered with a full variable set, the stored Speranza `relationship_generation` row
produces:

```
AGENT:
Name: {agent_name}
Character: {agent_character}
Background: {agent_background}
```

The model has never seen the agent. Affected: `relationship_generation` and
`event_echo_transformation` in Speranza, Station Null, The Gaslit Reach and Velgarien
(8 rows that are rendered), plus `embassy_pair_generation` and `embassy_event_echo` in the
same four worlds (8 rows that no code renders at all). One **platform** row is affected
too — `cycle_sitrep_generation` — so every epoch SITREP has been asking for
"Cycle {cycle_number}".

Nobody noticed because a template that renders its own placeholder names still produces
plausible prose.

**`scanner_service.py:436` already carried a local workaround** — `user_template.replace("{{",
"{")`, with the comment *"DB template uses {{var}} mustache placeholders — convert to Python
format"*. One service compensated for the data instead of the data being fixed.

**Fix.** Migration 280 normalises every `{{identifier}}` to `{identifier}` and adds a CHECK
constraint so the mistake cannot return; the scanner workaround is deleted in the same
change. Verified on all 104 production rows first: every doubled brace is a Mustache
placeholder, none is an escaped literal.

**Consequence for the repair pass:** the two curated types also name a variable no call site
supplies. `event_echo_transformation` wants `impact_level`, which the events row carries —
so the *call site* was fixed rather than the data. `relationship_generation` wants
`relationship_types`, and there is no canonical list to supply (`agent_relationships.relationship_type`
is free text, and production holds world-specific values like `contrada_kin`, `raid_partner`),
so the placeholder is stripped. A follow-up could pass the types already in use in that
simulation.

### 24. Two social-media endpoints cannot run at all — High

`routers/social_media.py:135` calls `gen.generate_social_media_transform(original_text=…,
transformation_type=…)`; the method signature is `(post_content, transform_type, locale)`.
Line 187 calls `gen.generate_social_trends_campaign(trend_name=…, trend_platform=…,
trend_sentiment=…)` against `(trend_data: dict, locale)`. Both raise `TypeError` on the
first call. The sentiment endpoint's own comment says it uses the `social_media_sentiment`
template; it calls the trends-campaign method instead, and `social_media_sentiment` is one
of four platform template types no code renders (with `chat_with_memory`,
`news_agent_reaction`, `user_agent_description`).

Found while sweeping every template consumer for W1. Not fixed there: the return-shape
mismatch (`result.get("transformed_text")` against `_generate`'s `{"content", …}`) means the
endpoints need a decision about intent, not a rename.

**It was three endpoints, not two, and the third is the worst.** A test written to bind the call
sites to the signatures found `generate_reactions` at `social_media.py:257` calling
`generate_agent_reaction(agent_name=…, agent_system=…, event_title=…, event_description=…)` against
`(agent_data: dict, event_data: dict, locale, game_context)`, and then reading `result.get("reaction")`
from a method that returns a **string**. Two errors — and the loop sat inside a bare
`except Exception` with a `logger.warning`, so every agent failed silently and the endpoint returned
**200 with an empty list**. Production has **zero rows** in `social_media_agent_reactions`.

**Two more defects the reading turned up.** `TransformPostRequest` accepts
`dystopian|propaganda|surveillance`; exactly **one** of the three has a template. A missing template
does not raise — `PromptResolver` falls through five levels to
*"Generate content for social_media_transform_propaganda"*, logs a warning, and returns it. Two of
the three accepted values would have sent a generic prompt to a paid model and stored the answer as
world content. And the sentiment endpoint's own comment named `social_media_sentiment`, a template
**no code rendered**.

**Fixed.**

- `generate_social_media_transform` returns a typed `SocialTransformDraft` and **resolves the
  template before calling the model**, refusing an unconfigured transformation by name rather than
  shipping a generic prompt. Which transformations exist is a question for the templates, not for a
  second list in Python.
- `generate_social_media_sentiment` is the façade the comment described: it renders
  `social_media_sentiment`, parses its JSON, and returns a validated `SentimentAnalysis`
  (`sentiment` from a closed set, `confidence` 0.0-1.0, `summary`) — the value goes into a `jsonb`
  column, so it is worth validating before it becomes a row. Its contract is declared in
  `prompt_contracts.py`, so the type stops being unmanaged.
- The reactions loop passes dicts, stores the returned prose, and omits `reaction_intensity`
  (nullable, and nothing generates it — a constant 5 would have been a number nobody measured). The
  bare `except Exception` is now a named tuple including `MODEL_CALL_ERRORS`, with a Sentry capture:
  one agent's failure still must not stop the others, but it must be observed. Too-narrow handlers
  hid finding 33; a too-broad one hid this.

**Recurrence guard.** `backend/tests/unit/test_generation_service_call_sites.py` walks the AST of
every backend file, matches each call to a public `GenerationService` method against that method's
real signature, and parametrises one test per call site. Python reports this class of error only when
the line executes, and nothing in the suite executed these three. It found the third defect on its
first run.

### 25. The chat `system_prompt` phase A.6 writes is never used — Medium

A.6 generates a `system_prompt` per template. `GenerationService._generate` uses it (and now
fills it, see finding 5's fix). `ChatAIService` does not: it builds the system message from
`prompt_content` alone, so the authored persona — *"You roleplay characters from the
Verwaltungsbezirk Atrament, where the state is a living body and legibility its breath"* —
is written, stored, and discarded.

Deliberately not changed in W1: chat is the most user-visible surface, `prompt_content`
already sets a persona, and concatenating both without measuring the result would be a
guess. It belongs with W5.

### 26. Generated themes had no contrast floor — **Critical**

**Found by the project owner, looking at a screenshot.** The agent lightbox had a dark blue bar
across the top with a counter and a close button, and nothing else. The question was whether the
name should not be in there.

It was. Measured in the browser: title colour `rgb(26,26,46)` on header background
`rgb(26,26,46)`. Contrast ratio **1.00**. The world's own name was rendered in navy on navy.

In the data: the generated theme set `color_text` **and** `color_surface_header` to the same
`#1a1a2e`. That token is used in 37 places in the component layer, all of which treat it as a
near-surface tone carrying normal text — three components even override it to
`var(--color-surface)`. So the theme was wrong, not the components.

Recomputed across all 37 themed production simulations: **36 sound** (8.4 to 19.6), **one at
1.00**. Not a systemic token problem — one generation nobody checked. The only thing between the
model and production was a line in the prompt: *"Ensure sufficient contrast between text and
background (WCAG AA)."* Asking is not checking.

Nobody had seen it for a day, because a header that renders nothing looks like a header that was
designed empty.

**Fixed.** `backend/services/theme_contrast.py` enforces 4.5:1 for every surface that carries
primary text, falling back to the theme's own `color_background` so the repair stays inside the
palette the model chose. It never rewrites the text colour, and it reports secondary/muted text
without changing it — several shipped themes are deliberately below 4.5 there, and a floor would
be a redesign. Wired into `apply_theme_settings`, the single point where any theme reaches the
database.

### 27. The style prompt was the picture — **Critical**, and the true root of finding 6

**Reported three times by the project owner:** *"leserlichkeit steht noch immer auf der badge, das
geht GAR NICHT"*. The template had been repaired, the description regenerated, and the portrait
frame given an explicit prohibition on readable text. The badge came back every time.

`image_style_prompt_portrait` is a **simulation setting**, appended verbatim to every image the
world generates, and it is the *last* thing the image model reads — so it outranks the entity
description, the template and the platform frame together. The generated value was not a style:

> *"Kalotyp-Positivverfahren of **a Verwaltungsbeamter** posed for **his** Salzzitat … the shallow
> plane of focus isolating a diagnosis pinned to his lapel: **\*Leserlichkeit: 93%\*** and declining"*

One string, and it accounts for all three symptoms at once: every portrait in that world male
regardless of the agent; every one wearing the same badge with the same invented number; and *"the
images all look the same"* — the observation that opened finding 6 — because the style fixed the
entire subject, not the style.

**Finding 6's diagnosis was half right.** The generated template had indeed dropped the platform's
compositional guardrails, and restoring them was necessary. It was not sufficient, and it was not
the dominant cause. The chain has four stages, and W1 addressed the first:

    prompt_templates  ->  agents.portrait_description  ->  image_style_prompt_*  ->  the image

**Fixed.** The generation prompt now forbids the shape explicitly (a style, not a picture; never a
subject or a gendered word, because the subject comes from the entity being drawn and a subject
here overwrites every one of them; no measurement, no readable text; at most 45 words).
`audit_style_prompts` reports the four ways it goes wrong, wired into the same chokepoint as the
contrast floor. Not auto-repaired: rewriting a world's visual identity is an editorial act. The
four style prompts of the affected world were rewritten by hand.

**Verified at the image.** One person, female as the record says, head and shoulders, centred, no
badge, no numeral — with the world intact: script on skin and coat, iron-gall-blackened
fingertips, the Aktenlampe beam, the silver-nitrate palette, plate damage at the edges.

**A general rule fell out of this, about prompts rather than portraits.** The frame first read
*"…no numerals on clothing or background: any figure a portrait shows is invented, and the platform
computes none."* The output format for that template is *comma-separated descriptors*, and the
model dutifully turned the **rationale** into descriptors: a rendered prompt ended
`…no numerals, figure is invented, computed`. **Where the output is a descriptor list, a frame
states prohibitions and explains nothing.** Where the output is prose, a rationale is harmless.

### 28. Most style prompts describe a picture rather than a style — High

Audited all **123** style prompts across **41** production worlds: **29 in 18 worlds** are flagged
— 26 describe a whole scene, 4 ask for readable text, 3 name a subject. Probably the reason other
worlds also produce uniform imagery. Not repaired: editorial.

**A measurement that corrected the tool itself.** The first version of the check flagged any
numeral, and hit 42. Looking at what the numerals actually are: 13× `1970s`, 12× `35mm`, 12× `1979`,
`16:9`, `f/8`, `f/2.8`, `85mm`, `24mm`, `CP437`, `80x25` — precisely the vocabulary a style is
written in. A gate that fires on nearly every world is switched off within a week, and then it
misses the real case too. The rule now catches only a numeral presented as a *measurement*: a
percentage, or a label with a value after a colon. Four tests hold the legitimate vocabulary as
legal so the rule cannot drift wide again.

### 29. The repair chain stops at the template — High

`scripts/repair_simulation_prompt_templates.py` writes `prompt_templates` only. Measured over the
114 stored portrait descriptions on production: **2 still contain a literal `{placeholder}`** and
**3 name the invented legibility index** — five agents across two worlds whose stored description
was produced by a defective template and still says so. Regenerating them costs image-model money,
which makes it an operational decision rather than a repair; the intended shape is a
`--rescan-descriptions` mode that lists the affected rows and changes nothing.

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

**Fixed in W2, and the threshold was measured before it was set.** The floors are not a quality
bar; they reject a field that is not an answer at all. Each sits at roughly HALF the shortest value
the Forge has ever written on production, read on 2026-08-30 out of the raw `forge_drafts` rows —
115 agent drafts, 117 building drafts, 88 zones, 62 anchors — with the corpus minimum recorded
beside each constant in `backend/models/forge.py`:

| floor | applies to | prod minimum (n) |
|:--|:--|--:|
| 250 | agent `character`/`background`, building `description`, all `_de` twins | 515 · 452 (115), 464 · 470 (117) |
| 60 | anchor `description` | 134 · 155 (62) |
| 40 | zone `description` | 81 · 94 (88) |
| 20 | anchor `core_question`, `bleed_signature_suggestion` | 42 · 46 (62) |
| 10 | anchor `literary_influence` | 21 (62) |
| 8 | anchor `title` | 17 (62) |

**A floor that was written, measured, and withdrawn.** A minimum of 4 on the short identifier
fields was written first. Measured against the corpus it refuses the German enum word `gut` and the
building type `inn` — both three characters, exactly the length of the `"..."` it was meant to
catch. On a short field, length does not separate a placeholder from an answer. There is no floor
there, and `test_three_letter_values_still_pass` says so out loud. The hollow object that prompted
this finding carried `"..."` in *every* field, so the long-form floors refuse it whole.

**The mock had to follow, and that turned out to be the second half of the finding.**
`forge_mock_service.py` validates every fixture through its model on the way out — its docstring
promises that mock data "cannot drift out of sync with model constraints" — so the floors broke it
immediately. They were right to. The fixtures ran 78-211 characters where production writes
452-1981, which means `FORGE_MOCK_MODE` has always laid out the Table, the roster cards and the
review step against text a quarter of real length: any layout fault that only appears at 900
characters was invisible there. Fifty prose blocks were extended in the same voice (8 agents x 4
fields, 9 buildings x 2), and the change is provably additive — every non-prose field byte-identical,
every old prose string still a prefix of its new one. Mock lengths now run 251-380.

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

**Fixed in W2 — and the obvious fix was measured and rejected.** The count does belong in the type:
`conlist` becomes `minItems`/`maxItems` in the JSON schema pydantic-ai hands the model, and it is
what the validation retry fires on. But `Len(3, 3)` — the exact demand — was measured against the
real anchor path before being trusted (deepseek-v4-pro, the production `model_forge`, six runs per
variant, `retries=1` as `create_forge_agent` sets it):

| variant | three anchors | failures | median |
|:--|--:|--:|--:|
| no length constraint (today) | **6 / 6** | 0 | 51 s |
| exactly three | 5 / 6 | **1 total loss after 90.4 s, billed twice** | 45 s |
| at least two, at most three | **6 / 6** | 0 | 57 s |

Demanding the exact count did not raise the delivery rate — it was already 6 of 6 without any
constraint — it only added a way to lose the whole answer. The stored corpus agrees: across 92 list
deliveries in `forge_drafts`, **87 were exact, 4 short, 1 long**. So the ceiling is what earns its
place, and the floor sits where a delivery stops being worth keeping, never at the number ordered.

`counted_list(item, requested, *, minimum)` in `backend/models/forge.py` carries both numbers and
the measurement that chose them. Applied at all four sites: anchors `(3, minimum=2)` — two anchors
are still a choice, one is not; the agent and building chunks `(gen_config.count, minimum=1)`, whose
hand-rolled `if not agents_list: raise` moved into the type where it belongs; recruitment
`(3, minimum=1)`. The gap between ordered and delivered is reported by `report_delivery_count` in
`ai_utils.py` — a warning log plus a Sentry breadcrumb, next to `validate_bilingual_output`, which
is the same shape of check. Geography is reported too, though its counts sit inside
`ForgeGeographyDraft` and cannot ride on a per-call output type.

The count also stopped being written twice. `_ANCHOR_COUNT` and `_RECRUIT_COUNT` are now
interpolated into the prompts *and* handed to the output type, so what is asked for cannot drift
from what is validated. The UI claims were corrected: three strings in
`htp-content-features.ts` said "three anchors" / "3 anchor cards" and now say "up to three"
(two of them had never had a German target at all — supplied). One string in `VelgForgeAstrolabe.ts`
remains, handed to the session that owns that path.

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

**Fixed in W2.** Two statements cover every field of every Forge output type, defined once in
`backend/models/forge.py`: `_IN_ENGLISH` for fields that pair with a `_de` twin, and `_WORLD_TONGUE`
for the proper names that are the same string in every locale and must not be rendered into English
at all — an agent's name, a faction, a city, a district, a street. That distinction is the part the
finding did not name: not every unnamed field is English, and telling the model that a name is
English would be a different bug. `test_every_field_names_its_language` walks
`ForgeAgentDraft.model_fields` and fails on any field whose description names no language, so a
field added later cannot slip back into silence.

Two related observations recorded rather than fixed: `ForgeZoneDraft.characteristics` has no `_de`
twin, so the German UI shows English tags verbatim (surface, W5); and `ForgeStreetDraft.description`
keeps no floor because it is genuinely optional — a floor there would turn an omission into a hard
failure.

### 30. The building condition is hardcoded while every world already has its own — High

**Found while doing W2, by nearly getting it wrong.** `ForgeBuildingDraft.building_condition` was
about to become a `Literal` of the five words its own description lists — the textbook "put the
contract in the type" move. The corpus said not to.

Every simulation carries its own `building_condition` taxonomy in `simulation_taxonomies`, with a
bilingual `label` jsonb, and Forge worlds get thematic ones: `sealed`, `anomalous`, `thriving`,
`preserved`, `compromised`, `illuminated`. The building generator ignores all of it and writes the
platform's five words instead. Measured on production:

| condition written | buildings | of those, absent from their own world's taxonomy |
|:--|--:|--:|
| `fair` | 78 | **68** |
| `good` | 189 | 20 |
| `poor` | 20 | **15** |
| `pristine` | 6 | **6** |
| `ruined` | 4 | **4** |
| `excellent` | 10 | 2 |
| the eleven thematic values | 15 | **0** |

**115 of 314 buildings hold a condition value their own simulation does not define.** Every value
that came from a world's own taxonomy is defined; every gap comes from the hardcoded list. Freezing
those five words into the type would have cemented exactly the wrong vocabulary, against the project
rule *"never hardcode mappings that should be configurable"*. So the field stays `str`, with a
comment carrying this measurement.

A smaller, plainer bug sits inside it: the platform prompt template has said `excellent` since
migration 027 while `ForgeBuildingDraft` said `pristine`. The two disagreeing is why six buildings
in five worlds carry a value no taxonomy anywhere defines. The model description now says
`excellent`.

And the German side is worse than the English one. The frontend prints `t(b, 'building_condition')`,
which reads `building_condition_de` off the row, while `_getConditionVariant` branches on the
English value — so the badge shows whatever German the model invented. It invented **thirteen**
strings for five values; `fair` alone came back as *mittelmässig, mässig, befriedigend, akzeptabel,
mittel, ordentlich, in Ordnung, brauchbar* and *angemessen*, and 22 rows have no German at all.

**The finding was right about the symptom and wrong about the cause, and the cause is worse.**
It is not that the generator ignores each world's taxonomy. Measured on production 2026-08-30:

- **All 26 forge drafts carry `taxonomies = {}`.**
- `fn_materialize_shard` step 8 has always inserted one `simulation_taxonomies` row per value in
  that column. It loops zero times and inserts nothing, faithfully.
- **16 of 41 simulations have no `building_condition` taxonomy at all** — including
  `state-pathography-legibility-as-biopolitical-metabolism`, the world this whole document is
  about.

So the taxonomy a Forge world is supposed to be validated against **does not exist**, and the
column meant to carry it has been dead since it was added. The 25 worlds that do have one got it
from a hand-written seed migration. And it is not only `building_condition`: the RPC loops over
*every* key in `taxonomies`, so `building_type`, `zone_type`, `profession`, `system` and `gender`
are missing for those worlds too.

**Fixed (W4), by deriving rather than dictating.** The obvious repair — generate the vocabulary
first, then constrain the buildings to it — costs a second model call and adds a second thing
that can fail. But the model *already* produces the thematic vocabulary the design wants: a world
about sealed archives says `sealed`, where the hardcoded list said `fair`. So
`backend/services/forge_taxonomies.py` derives each world's six vocabularies from the entities it
actually generated, and `materialize_shard` writes them to the draft immediately before the RPC —
the last moment at which the roster is final, since the Table can still edit, top up or
regenerate it.

That makes the defect **unrepresentable**: a building cannot carry a value its own world does not
define, because the world's values *are* the ones its buildings carry. No extra call, no new
failure mode, no prompt change. Where a collection is empty it yields no key and the RPC writes
nothing — the same as today, rather than a plausible default nobody chose.

The German half is fixed in the same pass. The derivation canonicalises: the English value is
casefolded to become the taxonomy `value`, and the label keeps the most common surface form
(ties by first appearance, so it is deterministic). `normalize_entity_terms` then rewrites the
entities onto that vocabulary — which is what turns nine German words for `fair` into one.
`gender` and `system` have no `_de` sibling on the draft model, so their label carries the
English form in both slots: a missing translation is a visible gap, a fabricated one is not.

Migration 284 supplies the half that was missing in SQL. The RPC built its label as
`jsonb_build_object('en', val)` — English only, while the frontend reads `label->>'de'`. It now
accepts both entry shapes, decided **per entry** so a mixed list cannot fail on its first element:

```
alt : {"building_conditions": ["sealed", "fair"]}
neu : {"building_conditions": [{"value": "sealed", "label": {"en": "Sealed", "de": "Versiegelt"}}]}
```

The string form still behaves exactly as before — necessary, not sentimental: a draft left open
across the deploy was written under the old rule and must still materialize. The function body is
taken from the **live** `pg_proc.prosrc` on production, not reconstructed from the
highest-numbered migration file, because it has been replaced several times since 112 and the
newest file is not necessarily the one that runs.

*Still open, and deliberately:* the 115 existing buildings keep their values. Backfilling them
means deciding what `fair` should become in a world that never had the word — an editorial call,
not a restoration, and it belongs to whoever owns the surface.

### 31. The seed runs after the migrations, so migrations to platform templates are discarded — **Critical**

**Found by asking why a dry run counted no-ops.** The transactional dry run of migration 281
against production reported 6 of 18 statements as no-ops (see A.1), and the first explanation —
production drift — was only half of it. The parallel session traced the other half:

> `supabase/config.toml`: *"seeds the database after migrations during a db reset."*

Every `INSERT` in `supabase/seed/006_prompt_templates.sql` is `ON CONFLICT DO NOTHING`. On a fresh
database the table is therefore **empty while the migrations run**, so every

```sql
UPDATE prompt_templates … WHERE simulation_id IS NULL
```

matches zero rows and is silently discarded. `UPDATE 0` is not an error. Measured in a throwaway
Postgres in the real order: **027 reports `4x UPDATE 0`, 281 reports `18x UPDATE 0`.**

**Migration 027 has been inert on every database created from this repository since February.** It
rewrote the four building templates — a 30-word cap, *"never flowery prose"*, `max_tokens` 400 →
200/150 — for exactly the reason finding 27 later re-discovered from the other end: *"the long
AI-generated descriptions then overwhelm the style prompt during image generation."* Production,
migrated in place, has the fix. Every fresh database got the version 027 diagnosed as harmful.
Six months, no signal anywhere.

**Fixed in two halves.** The seed is back-ported (`eb0941c4`), and the trap is now stated in its own
header rather than in an analysis document. The recurrence guard is
`scripts/lint-seed-carries-migration-effects.sh`, in the CI `test-backend` job right after the
SECDEF guard — the same slot, because it needs the same thing: a database with migrations *and*
seeds applied.

**The gate compares values, not affected-row counts, and that distinction is the gate.** Its first
draft counted rows and reported ten violations of which six were not violations:
`UPDATE t SET x = 'a' WHERE id = 1` reports one affected row even when `x` is already `'a'`, so
every unguarded migration statement looked like a gap — including migration 016, which is in fact
fully back-ported. The second draft snapshots the platform rows, replays all 24 statements in
migration order, and reports which *column* actually changes. Proven in both directions: red on the
defect below, green once the rows carry the right text.

**It caught a defect hours old.** Run against the back-ported seed, the gate failed on all four
building rows: the back-port had pasted the **agent** floor onto them — *"no formula that sums the
person up"*, *"no signature quirk invented to make them memorable"*, *"the last sentence of each
field"* — 193-210 characters about people, on a template that asks for a 30-word database entry
about a building. Seed lengths 1115/1040/1018/963 against production's 905/847/808/770 after
migration 281. Handed to the session that owns the seed.

### 32. The platform agent template names Velgarien — Medium

Uncovered while reconciling the seed with production. Production's `agent_generation_full` rows
carry, in both the system prompt and `prompt_content`, a block naming the platform's own first
world: *"Velgarien is an authoritarian state: total control, propaganda, surveillance, brutalist
architecture."* It is a **platform** template, used by every Forge world that does not override it,
so a world about an ink bureau is told it is an authoritarian state called Velgarien. That block
explains the seed/production gap on those two rows (1107 against 1303 characters).

It is in neither the migrations nor the seed — all 291 migrations and every seed file were searched
— so it was almost certainly set through the admin UI. **Production is not reproducible from the
repository on those two rows.** Whether the seed should adopt production's text or a world-neutral
one is a design decision, not a restoration, and it belongs with the session that owns the seed.

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

**Fixed in W3, in the three halves the requirement actually has.**

**1. The retry, and what it deliberately does not retry.** The four image loops carried four
byte-similar `try`/`except` blocks; they are now one helper, `_generate_one_image`, with three
attempts and 3 s / 8 s backoff. The split is not "transient versus permanent" — a retry re-runs the
whole chain, description (text model) → Replicate (**paid**) → upload → DB write, so the question is
whether a second attempt can cost a second image:

| retried | why |
|:--|:--|
| `OpenRouterError`, `ModelAPIError`, `UnexpectedModelBehavior` | the description step, which runs *before* any Replicate call — and is the failure that was actually measured |
| `ReplicateError` | the generation call itself failed; a failed generation is not billed as a delivered one |
| `httpx.HTTPError` | a network fault, usually the reference-image download, also before the paid call |

| not retried | why |
|:--|:--|
| `KeyError`, `TypeError`, `ValueError` | programmer errors: a second attempt fails identically and costs a second image |
| `OSError` | encoding/upload, i.e. *after* the paid call |
| `ReplicateBillingError` | re-raised, aborts everything; retrying with no credit only burns money |

**2. The failure reaches the ceremony.** `simulations.lore_progress` was cleared to `NULL` at the
end of every run. That was right only when everything succeeded: `get_forge_progress` computes
`done` as `completed >= total`, so after a partial run the bar sits at 15/16 forever, with nothing
said and nothing to press. It now carries `{"phase": "images_incomplete", "failed", "total",
"entities": [...]}` — which entity, of which type, with which error — so the surface can name them.

**3. The repair action.** `POST /api/v1/forge/simulations/{id}/generate-missing-images`, gated by
`require_owner_or_platform_admin` and free: the entity was paid for once already, and the image is
missing because the platform failed. It regenerates **only** entities that still have no image
(`only_missing=True`), because after a partial run the user is typically short one image out of
sixteen and re-running everything would spend fifteen to fix one. The filter uses the same four
columns `get_forge_progress` counts — `banner_url`, `portrait_image_url`, `image_url`,
`image_generated_at` — so what the ceremony calls missing, what the endpoint reports and what the run
regenerates are one definition rather than three. Calling it with nothing missing is a no-op that
says so.

`backend/tests/unit/test_image_retry.py` pins the split rather than the retry count: twelve tests,
including the measured `OpenRouterError: Empty content in response` recovering on the second attempt,
and every non-retryable class asserting exactly one call.

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

**The paragraph above understates it, and the correction is worth recording.** It says the error is
set but not rendered. Read again: `error.value` is set **only** when
`consecutiveFailures >= MAX_CONSECUTIVE_FAILURES` trips — that is, only on a *run* of failures. A
single scattered failure, one entity of sixteen with the rest succeeding, set nothing at all, and
`_generateChunk` only ever asked "is `error` empty?". **The most common case was the invisible
one.** Diagnosing it as "set but unrendered" would have produced a fix that still missed it.

**Fixed** (`f04ce99e`): the loop counts what was actually delivered and reports any shortfall
through its own signal, independent of the hard abort. Toast order is now hard error → shortfall →
success. The same commit renders the `images_incomplete` state from finding 8 and wires the repair
button — reached by holding on to the `simulationId` that `ignite()` already returned and the
ceremony was throwing away, so no slug variant of the endpoint was needed. `entities[].error` is
deliberately **not** shown: it is English model output and belongs in Sentry, not on the surface.

### 20. Deep research fails during materialization — Medium

`22:33:07 AI call started purpose=research` → 14.5 s → `AI call failed` → *"Deep research
failed — using Astrolabe context only"*. The fallback holds and lore is still produced, but the
deep research the user can switch on in the Darkroom delivers nothing. `purpose=research` runs
at `max_tokens 2048`.

**Cause determined, and it is not a model problem.** `research_for_lore` wraps its LLM call in a
`try` that catches `httpx.HTTPError, KeyError, TypeError, ValueError` — a set that cannot contain
any exception a model call raises. The handler was written to degrade gracefully (log the failure,
keep going, and still run the three Tavily searches, which are independent and would have
succeeded). It has never once run. The exception escapes to the orchestrator instead, which
abandons the *whole* `research_for_lore` call — so a failure in the LLM half silently costs the user
the web-augmentation half as well.

14.5 s also rules out the timeout: the budget is 90 s. It was a status error, and the handler
could not see that either.

**Fixed in W3** as one case of finding 33, which is the same defect at thirteen other call sites.

### 33. Every configured timeout is unhandled — **Critical**

**Found by asking what finding 20's handler could actually catch, then measuring it.**

`PYDANTIC_AI_TIMEOUTS` in `ai_utils.py` sets eleven timeout budgets, and the comment above them
states the contract:

> *"pydantic-ai passes `model_settings["timeout"]` to the OpenAI SDK's `create()` call, which sets
> it as an httpx timeout. When it fires, `openai.APITimeoutError` is raised → caught by existing
> except blocks."*

Every clause after the arrow is false. Measured with a real call at `timeout=0.001`:

```text
Klasse: pydantic_ai.exceptions.ModelAPIError
MRO:    ModelAPIError, AgentRunError, RuntimeError, Exception

  caught by (httpx.HTTPError, KeyError, TypeError, ValueError): False
  caught by ModelHTTPError:                                     False
  caught by UnexpectedModelBehavior:                            False
  caught by (ModelHTTPError, UnexpectedModelBehavior):          False
```

`openai.APITimeoutError` is an `openai.APIConnectionError`, not an `httpx.HTTPError`; pydantic-ai
catches it and re-raises `ModelAPIError`; and `ModelAPIError` is the **parent** of
`ModelHTTPError`, so even the best handler in the codebase — `except (ModelHTTPError,
UnexpectedModelBehavior)` — misses it. Before this fix the name `ModelAPIError` appeared **zero
times** in the backend, against twelve handlers naming its subclass.

**Blast radius, swept by AST over all 20 `run_ai` call sites:** 14 of them had a `try` that could
not catch a model error. Every one of those handlers exists precisely to degrade gracefully — patch
a missing translation, keep a lore section, fall back to Astrolabe context — and none of them has
ever run for its own failure mode.

**Fix.** One tuple, `MODEL_CALL_ERRORS` in `ai_utils.py`, holding `ModelAPIError` (which subsumes
`ModelHTTPError`) and `UnexpectedModelBehavior`, applied at all 14 sites; the non-model classes each
site already listed stay, because they cover the non-model failures in the same block.
`ai_error_to_http` now takes `ModelAPIError` and reads `.status_code` defensively — a timeout has
none, and reading one used to raise `AttributeError` inside the handler that was supposed to produce
a clean message. A timeout now maps to **504**, which says "upstream did not answer in time" rather
than "this service is broken".

Six call sites deliberately keep no local `try`: each propagates into a caller that does handle the
error, and every one was checked individually rather than assumed.

**Recurrence guard.** `scripts/lint-model-call-handlers.py` (wrapped by the matching `.sh`, in CI's
`lint-frontend` job beside the other backend gates) walks the AST and fails when the `try` enclosing
a `run_ai` call names none of `MODEL_CALL_ERRORS`, `ModelAPIError`, `AgentRunError`, `RuntimeError`
or `Exception`. Measured in both directions before being trusted: green on 14 of 14, red with the
exact file and line when one handler is reverted. Its docstring states the two things it cannot
see — an indirect call (`_auto_translate_entity` wraps the model call three frames up; it had the
same defect and was fixed by hand) and a site with no `try` at all — so nobody reads a pass as more
than it is.

`backend/tests/unit/test_model_call_errors.py` pins the class relationships themselves rather than
the fix, so a pydantic-ai upgrade that re-parents these exceptions turns the test red instead of
production.

---

## E. Configuration that is not configurable, or not wired

### 11. One call, two purposes, and nothing compared them — High ✅ FIXED (W4)

**The original measurement here was wrong, and the way it was wrong is the point.** It read:

> Measured: `grep -A6 create_forge_agent\( backend/services/*.py | grep -c purpose=` → **0**.
> Consequence: `model_research` is dead configuration.

`grep -A6` is a six-line window, and the `system_prompt` argument at the research call site is
twenty-five lines long. The window, not the code, is why the one real usage went missing.
Re-measured by AST over all of `backend/` on 2026-08-30:

| | count |
|:--|--:|
| `create_forge_agent` call sites | 9 |
| …passing `purpose=` | **1** (`research_service.py:283`, since `2aa58b8d`, 2026-03-14) |
| `run_ai` call sites | 20, across **13** distinct purposes |
| sites where the agent's purpose and the call's purpose **differed** | **8 of 9** |

So `model_research` was never dead — it has resolved the research brief all along. The real
defect is bigger and was hidden underneath the wrong number: **one logical model call named its
purpose twice**, once at `create_forge_agent` (which chose the model, defaulting to `"forge"`)
and once at `run_ai` (which chose the budget, the timeout and the thinking level). At 8 of 9
sites those two names were different, and nothing anywhere compared them.

*A `grep` window is a measuring instrument, and this one had a range of six lines.*

**Fixed.** `backend/services/ai_purposes.py` declares all thirteen purposes once — model key,
budget, timeout, reasoning — and `create_forge_agent`'s `purpose` is now required and
keyword-only, because there is no such thing as a call whose model should be chosen by a
different purpose than its budget. Seven hand-rolled `Agent(...)` constructions that bypassed the
helper entirely (four in `forge_theme_service`, two in `translation_service`, one in
`dossier_evolution_service`) were literal copies of it and now go through it.
`backend/tests/unit/test_ai_purposes.py` binds the declaration to the call sites by AST and was
run against both real defects before being trusted: red on a missing `purpose=`, red on a
disagreeing one, green on the repaired tree. Model resolution is unchanged for every purpose —
the declaration records what each one resolved to already, so what was accidental is now stated.

### 13. Two purposes have no budget and no timeout — Medium ✅ FIXED (W4)

`style_refine` and `templates` appear in neither `PYDANTIC_AI_MAX_TOKENS` nor
`PYDANTIC_AI_TIMEOUTS`. Confirmed in the production log:
`purpose=style_refine timeout=None max_tokens=None`. With `timeout=None` there is no time limit
at all, against a model whose output ceiling is 384 000 tokens. Both completed in this run —
this is an open flank, not the cause of anything observed.

**A third purpose was nearly filed here and does not belong.** `ops_forecast` is also absent from
both tables, but its call site passes `model_settings={"timeout": 10, "max_tokens": 200}` and
`run_ai` uses `setdefault`, so those win: it was never unbounded. Filing it with the other two
would have been the same mistake as finding 11's `grep` window — reading a table's silence as the
system's behaviour. Its numbers moved to the declaration unchanged, so all thirteen are in one
place; only their location changed.

**Fixed**, with budgets derived from production rather than chosen:

| purpose | max_tokens | timeout | where the number comes from |
|:--|--:|--:|:--|
| `style_refine` | 2048 | 90s | One answer is four style prompts. Across the 41 worlds on production, as stored in `simulation_settings`: median **947** characters for all four together, p95 1936, max **2155** ≈ 616 tokens. 2048 is 3.3× the observed maximum and equals `theme` — same service, same kind of answer. Timeout against the one observed duration, 21s. |
| `templates` | 8192 | 180s | One answer is every prompt template for a world, as JSON. Across the 12 worlds that own templates: median **3015** characters, p95 and max both **12369** ≈ 3500 tokens before escaping. 8192 is ~2× that, and equals `lore`. Those 12 were produced with **no cap at all**, so the maximum is a real ceiling of the task, not an artefact of a previous limit. |
| `ops_forecast` | 200 | 10s | Carried over from the call site unchanged. |

**And one dead entry in the other direction.** `ascii_art` carried a 1024-token budget and a 60s
timeout for a code path that makes **no model call**: `ForgeAsciiArtService.generate_boot_art` is
pyfiglet plus a Pillow image-to-ASCII conversion. Removed. `test_ai_purposes.py` now fails on a
declared purpose that no `run_ai` call site uses, so configuration-shaped decoration cannot come
back.

### 14. The image parameters survived a model-family switch — Medium ⚠ RE-MEASURED (W4)

**This finding's stated mechanism is wrong, and the real one is worse.** It read:

> | `resolve_image_model` (:288) | no style reference — the normal case | **7.5 / 50** (SD) | no |
>
> It bites exactly when the user never opened the Darkroom and is relying on the default.

Reading the code the other way round: `PLATFORM_DEFAULT_IMAGE_MODELS` is `flux-2-pro` for all five
keys, so a world with no `image_model_*` row resolves **flux**, takes the flux branch, and gets
`flux_guidance` 3.5 / 28 steps with the clamp. The 7.5 / 50 pair is the Stable Diffusion branch,
and on production it never runs — measured 2026-08-30, **every** `image_model_*` value across all
41 worlds is a flux model (49 rows: 43 flux-dev, 6 flux-2-pro). The fallback the finding names is
unreachable.

What is real is in the data, and the code is only how it got there. `image_guidance_scale` is
**one settings key read by two branches whose scales differ** — SD wants ~7.5, flux wants ~3.5 —
and when the platform switched its default image model to flux, the rows written in the SD era
stayed behind in the SD scale. Measured across all 41 worlds:

| stored guidance | worlds | resolve to flux | own `image_model_*` row | last written |
|--:|--:|--:|--:|:--|
| **7.5** | 14 | **14** | 3 (11 inherit flux-2-pro) | 2026-04-10 |
| 5.0 | 16 | 16 | 16 | 2026-03-20 |
| 3.5 | 11 | 11 | 9 | 2026-08-29 |

**30 of 41 worlds feed a flux model a guidance value above its default**, and the 10.0 clamp —
flux-dev's API maximum, not its usable range — catches none of them.

The two cohorts are not the same kind of thing, and only one of them is a defect:

- **7.5 (14 worlds)** is exactly `PLATFORM_DEFAULT_PARAMS["image_guidance_scale"]`, the SD-era
  platform default. Nobody chose it; it is residue from before the family switch.
- **5.0 (16 worlds)** is no platform default in either family. Somebody or something chose it,
  and rewriting it would be an aesthetic decision, not a repair.

**What shipped is the detector, not a repair.** Picking a "sane flux ceiling" would mean inventing
a threshold no measurement here supports, and it would change how 30 worlds look without anyone
deciding to — the same error as the exact-list-length constraint in W2. `resolve_image_model` now
logs a warning naming the simulation when a flux resolve reads exactly the SD-era default, which
is the one value provably residue rather than choice. **The repair of those 14 rows is a decision
for the project owner, listed here rather than taken.**

### 15. Only model ids are admin-configurable — Medium ✅ FIXED (W4)

In `platform_settings` and therefore in the admin UI: the model id per key. Not configurable,
though it must be: `max_tokens` per purpose (hardcoded, and the number that broke this run),
`timeout` per purpose (hardcoded), and — until finding 1 — reasoning effort. The resolver knows
only four keys, so the thirteen purposes cannot be addressed individually.

**Fixed.** Migration 283 seeds 41 rows: `max_tokens_<purpose>` and `timeout_<purpose>` for all
thirteen, `reasoning_<purpose>` for the eight migration 279 did not cover, and `model_forecast`
(+ `_dev`). `get_platform_max_tokens` / `get_platform_timeout` read them through the same
five-minute cache as the model ids, so an operator's change takes effect on the next invalidate
rather than on a redeploy.

Two details that are load-bearing:

- **A bad value fails closed.** A non-integer, a zero or a negative logs and falls back to the
  declared default. `max_tokens=0` is not a small budget and a negative timeout is not a short
  one; both are ways of switching the guard off, which is what a typo in an admin field would
  otherwise do. Same reasoning as the `parse_setting_bool` hardening in F32.
- **The row and the code cannot drift.** The row wins at runtime, so a default lowered in code
  alone would never take effect on any database that has the row — which is every database.
  Migration 283 is *generated* from `ai_purposes.py`, and
  `backend/tests/unit/test_ai_purposes_migration.py` compares both sides value by value.

`model_forecast` closes a smaller version of the same complaint: `_FORECAST_MODEL` held
`anthropic/claude-haiku-4.5` as a `Final` constant in `ops_forecast_service`, which is the one
place an operator cannot reach — so the one model they might most want to swap for a cheaper one
was the only one they could not. Same id, seeded as a row.

### 34. The Forge is checked against a ledger it never writes to — **Critical** ✅ FIXED (W4)

**Found while wiring finding 15, by asking `ai_usage_log` what a `chunk` call costs.** It had
never heard of one.

Every `run_ai` call site passes `admin_supabase` so `BudgetEnforcementService.pre_check` can weigh
the call against `ai_budget`. `pre_check` reads `get_budget_states`, which aggregates
`ai_usage_log`. Nothing wrote the other half: `AIUsageService.log` is called from exactly four
places — chat, generation, forge **images**, and nothing else.

Measured by AST, then confirmed against production 2026-08-30:

| | |
|:--|--:|
| `run_ai` purposes that pre-check a budget | 12 of 13 |
| intersection of `run_ai` purposes with purposes ever logged | **∅** |
| `ai_usage_log` rows on production | 603 (293 OpenRouter) |
| …for any `run_ai` purpose | **0** |
| total spend recorded | $10.5311 |

So the entire Forge **text** pipeline — the most expensive thing the platform does, up to 16384
tokens a call — was pre-checked on every call against a number that was structurally always zero.
A per-purpose cap on `chunk` could not trip. The global cap under-counted by everything the Forge
spent on text; only its images were ever counted.

Production carries the joke's punchline: `ai_budget` has an enabled `purpose:forge` row. No call
site passes `"forge"` as a `run_ai` purpose, so it could not have matched even with a fed ledger.

**Fixed** at the choke point rather than at twenty call sites: `run_ai` writes one row per
completed call, on both the primary and the 429-fallback path — the fallback logs the model that
actually answered, since logging the caller's model would misattribute the cost. `AIUsageService`
never raises and the admin client is a process-wide singleton, so the added cost is one insert.

*Known limit, stated rather than papered over:* `key_source` records `"platform"` because
`run_ai` receives an already-constructed agent and cannot see whether a BYOK key is behind it.
Threading the real origin down from the key resolver is listed, not guessed at.

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

### 35. Every Forge world's agents are created without an inner life — High, NOT FIXED

**Reported by the parallel session's system review, verified here independently before being
written down.** Not W4, and not fixed in it — recorded because the fix's location is a line in
`materialize_shard`, which W4 touches, so the next person there should know.

`fn_initialize_agent_autonomy` (migration 145) is the idempotent bootstrap that gives an agent its
`agent_mood` and `agent_needs` rows. Measured on production 2026-08-30:

| | |
|:--|--:|
| agents | 258 |
| without an `agent_mood` row | **42** |
| without an `agent_needs` row | **42** |
| simulations affected | 7 |

`grep` finds exactly one caller in the whole backend: `PersonalityExtractionService`. The Forge's
creation path does not call it, and neither does the epoch clone.

The consequence is silent by construction: heartbeat phase 9 (needs and mood),
`fn_apply_dungeon_outcome` (mood and stress after a run) and the epoch mood modifier all issue
`UPDATE`s that match zero rows. `UPDATE 0` is not an error — the same shape as finding 31, one
layer up.

Verification query, so the next reader does not have to trust this table:

```sql
select count(*) from agents a
  left join agent_mood m on m.agent_id = a.id
 where m.agent_id is null;
```

Full write-up with the second half (only 5 of 35 worlds have `agent_aptitudes` rows, so
`DEFAULT_APTITUDE_LEVEL = 6` unlocks every ability and every gate — party composition is not a
decision) in `docs/analysis/system-review-2026-08-30.md`.

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
- **Measure the gate before trusting it.** Two checks written on this day pointed the wrong way
  and were corrected only by looking: a style-prompt rule that flagged any numeral hit 42 times,
  all of them legitimate style vocabulary (`1970s`, `35mm`, `f/8`); a parallel session's simile
  detector found zero similes in a text full of them. A rule that fires everywhere is switched off,
  and then it misses the real case too. Measure the threshold against the real corpus, and record
  the number in the gate so the next author does not read it as arbitrary.
- **Where the output is a descriptor list, a frame states prohibitions and explains nothing.** A
  rationale appended to a comma-separated-descriptor prompt comes back as descriptors: `…no
  numerals, figure is invented, computed` was rendered into a production image prompt. Prose output
  tolerates a rationale; descriptor output does not.
- **Position beats wording in a prompt.** Measured over 6 generations: the same floor placed in the
  system prompt left 0 of 6 closing sentences clean; placed at the end of the user prompt, 4-5 of 6.
  Whatever comes last wins — which is also why finding 27 outranked everything W1 had fixed.
- **Extracting is mechanical; MERGING is editorial.** Both sessions stopped at that line five times
  in one day and it stopped being a coincidence: 19 divergent panel rules that looked like a fork
  waiting to be rejoined, three admin tabs with drifted copies of one card style, ~1988 lines of
  dungeon CSS moved but deliberately not generalised, 29 style prompts that describe a picture, and
  five stored portrait descriptions from a defective template. Moving code to where it belongs can
  be proven byte-identical. Deciding that two texts *should* be one is a judgement, and it belongs
  to the person who owns the surface — list it and hand it over, do not quietly unify it.
- **A measurement's range is part of the measurement.** The position finding — the same floor in the
  system prompt cleared 0 of 6 closing sentences, at the end of the user prompt 4-5 of 6 — was used
  in this session to argue that a blank line before a prompt's last instruction should be kept,
  because "that is where the last thing wins". It is not the same variable: the finding compared two
  POSITIONS, not two amounts of whitespace inside one position, and calling both "distance" stretched
  it past what it measured. The right move was the one taken: measure the actual variable. Six runs
  per version, with and without the blank lines, on the real prompt — JSON complete 6/6 and German
  6/6 either way. With no difference to weigh, price decided, and the seed was changed rather than
  production. A finding quoted outside its range is an opinion wearing a number.
- **A constraint that cannot fail is not the same as one that must not.** Twice now the tighter
  gate was the wrong one, and only a measurement said so: an exact list length raised no delivery
  rate (already 6/6) and added a total-loss failure that fired 1 in 6; a four-character floor on
  short fields refused `gut` and `inn` at exactly the length of the `"..."` it was aimed at. Write
  the strict version first, measure it against the real corpus, then decide what it costs.

---

## Proposed work order

Grouped so that each step is independently shippable and verifiable.

| Step | Findings | Why here |
|:--|:--|:--|
| **W1** ✅ | 5, 6, 23 | Highest leverage. Until the generated templates are validated, **every future world** is born with invented variables and no compositional guardrails. Nothing else prevents that. Done in `36fe1b8b` + migration 280; finding 23 was uncovered by the work and folded in. |
| **W2** ✅ | 7, 10, 12 | One class: the contract belongs in the type. Minimums, list length, language — all three are schema work in `backend/models/forge.py` plus the output types. Done; the exact-count constraint was measured and rejected, and finding 30 was uncovered by the work. |
| **W3** | 8, 9, 20 | Failures that report success. Explicit user requirement on 8. |
| **W4** ✅ | 11, 13, 15, **34**, 30 (+14 re-measured) | Configuration. One declaration for all thirteen purposes (`ai_purposes.py`), budgets and timeouts admin-editable (migration 283), the cost ledger finally fed (34), and each world's vocabularies derived from its own entities (migration 284). Finding 14's stated mechanism did not survive measurement — the SD branch is unreachable on production; the real defect is 14 worlds carrying SD-era guidance, listed for decision rather than rewritten. |
| **W5** | 16, 17, 18, 19, 21, 25 | Surface: language, provenance, progress, scrolling, the unused chat system prompt. |
| **W6** | 28, 29 | The rest of the AI's output that no contract covers: style prompts that are pictures, and stored descriptions produced by defective templates. Both are list-and-decide, not auto-repair. |

W1 before W2 because W1 stops the bleeding on new worlds; W2 hardens the contract that would
have caught it. W3 is independent and can run in parallel.

**Already-created worlds carry the W1 damage in their stored templates** — a repair pass over
existing `prompt_templates` rows belongs in W1. Shipped as
`scripts/repair_simulation_prompt_templates.py`: dry run by default, a full row backup before
`--apply`, `--restore` to undo, and the target database must be named explicitly (the first
dry run silently read local Supabase and reported 36 rows where production has 48).
