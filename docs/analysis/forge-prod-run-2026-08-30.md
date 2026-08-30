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
| 23 | Sixteen rows in four worlds are written in Mustache syntax and never substitute | **Critical** | **Fixed** (`36fe1b8b`, migration 280) |
| 24 | Two `social_media.py` endpoints call `GenerationService` with parameter names that do not exist | High | Open |
| 25 | The `system_prompt` phase A.6 writes for chat is never used | Medium | Open |
| 26 | Generated themes had no contrast floor — one world shipped text and header at ratio 1.00 | **Critical** | **Fixed** (`4a9b43e8`) |
| 27 | The image style prompt was a picture, not a style — the true root of finding 6 | **Critical** | **Fixed** (`73ce73be`) |
| 28 | 29 of 123 style prompts across 18 of 41 worlds describe a picture rather than a style | High | Open |
| 29 | Stored `agents.portrait_description` rows still carry the defective template's output | High | Open |

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

---

## Proposed work order

Grouped so that each step is independently shippable and verifiable.

| Step | Findings | Why here |
|:--|:--|:--|
| **W1** ✅ | 5, 6, 23 | Highest leverage. Until the generated templates are validated, **every future world** is born with invented variables and no compositional guardrails. Nothing else prevents that. Done in `36fe1b8b` + migration 280; finding 23 was uncovered by the work and folded in. |
| **W2** | 7, 10, 12 | One class: the contract belongs in the type. Minimums, list length, language — all three are schema work in `backend/models/forge.py` plus the output types. |
| **W3** | 8, 9, 20 | Failures that report success. Explicit user requirement on 8. |
| **W4** | 11, 13, 14, 15 | Configuration: wire `purpose=`, give the two orphan purposes budgets, unify the image defaults, lift budgets/timeouts into `platform_settings`. |
| **W5** | 16, 17, 18, 19, 21, 25 | Surface: language, provenance, progress, scrolling, the unused chat system prompt. |
| **W6** | 28, 29 | The rest of the AI's output that no contract covers: style prompts that are pictures, and stored descriptions produced by defective templates. Both are list-and-decide, not auto-repair. |

W1 before W2 because W1 stops the bleeding on new worlds; W2 hardens the contract that would
have caught it. W3 is independent and can run in parallel.

**Already-created worlds carry the W1 damage in their stored templates** — a repair pass over
existing `prompt_templates` rows belongs in W1. Shipped as
`scripts/repair_simulation_prompt_templates.py`: dry run by default, a full row backup before
`--apply`, `--restore` to undo, and the target database must be named explicitly (the first
dry run silently read local Supabase and reported 36 rows where production has 48).
