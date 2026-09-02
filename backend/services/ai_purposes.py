"""The declaration of every AI purpose that runs through ``run_ai``.

A *purpose* is the unit of AI configuration in this codebase. It decides three
things that are billed and three that can fail: which model answers, how many
tokens the answer may cost, how long we wait for it, and how much of the budget
the model is allowed to spend thinking before it starts writing.

Until this module existed, those decisions lived in four places that had no way
of contradicting each other loudly:

* ``PYDANTIC_AI_MAX_TOKENS`` and ``PYDANTIC_AI_TIMEOUTS`` in ``ai_utils`` —
  keyed by the purpose passed to ``run_ai``;
* ``REASONING_DEFAULTS`` in ``platform_model_config`` — keyed the same way;
* ``get_platform_model``'s ``if/elif`` chain — keyed by a *different* string,
  the one passed to ``create_forge_agent``, which defaulted to ``"forge"``.

So one logical model call named its purpose **twice**, and the two names were
free to disagree. Measured by AST over ``backend/`` on 2026-08-30:

* 9 ``create_forge_agent`` call sites; **1** passes ``purpose=``
  (``research_service.py:283``, since ``2aa58b8d``, 2026-03-14).
* 20 ``run_ai`` call sites across **13** distinct purposes.
* At **8 of 9** agent-creation sites the agent said ``forge`` while ``run_ai``
  said ``chunk``, ``entity``, ``lore``, ``anchors``, ``dossier``, … — the model
  came from one name, the budget and the thinking level from another.

(Finding 11 in ``docs/analysis/forge-prod-run-2026-08-30.md`` reported this as
"``purpose=`` set at zero call sites". That number came from
``grep -A6 create_forge_agent\\(`` — a six-line window, against a call whose
``system_prompt`` argument is twenty-five lines long. The window, not the code,
was the reason the one real usage went missing. ``model_research`` was never
dead configuration; it has resolved the research brief all along.)

Two smaller defects fell out of writing the table down:

* ``style_refine`` and ``templates`` appeared in **neither** budget map, and
  neither supplied its own. ``timeout=None`` is not a generous timeout, it is no
  timeout, and ``max_tokens=None`` hands the model its own ceiling — 384 000
  tokens on the model ``model_forge`` currently carries. Confirmed in the
  production log: ``purpose=style_refine timeout=None max_tokens=None``.
  (``ops_forecast`` is also absent from both maps and was *nearly* filed with
  them, but it passes ``model_settings={"timeout": 10, "max_tokens": 200}`` at
  its call site and ``run_ai`` uses ``setdefault``, so it was never unbounded.
  Its numbers are carried here unchanged; only their location changes.)
* ``ascii_art`` had both a budget *and* a timeout and makes **no model call at
  all** — ``ForgeAsciiArtService.generate_boot_art`` is pyfiglet plus a Pillow
  image-to-ASCII conversion. Dead configuration in the other direction, removed.

Where the numbers come from
---------------------------
Every ``max_tokens`` and ``timeout`` below is either carried over unchanged from
the map it replaces, or — for the three purposes that had none — derived from a
measurement recorded in the declaration itself. Nothing here is a round number
chosen because it looked safe.

The invariant this module exists to hold: **a purpose is named once.**
``run_ai`` and the agent that serves it read the same row, so they cannot drift.
``backend/tests/unit/test_ai_purposes.py`` binds the declaration to the call
sites by AST and fails if a purpose is used but not declared, or declared but
never used. The declaration cannot rot without a red test.

This module is pure: no I/O, no database, no logging policy. Admin overrides
from ``platform_settings`` are applied by ``platform_model_config``, which reads
these values as its defaults — the same shape as ``REASONING_DEFAULTS`` before
it. See ``docs/analysis/forge-prod-run-2026-08-30.md`` findings 11, 13, 15, 34.
"""

from __future__ import annotations

from dataclasses import dataclass
from types import MappingProxyType
from typing import Final, Literal

__all__ = [
    "AI_PURPOSES",
    "AIPurpose",
    "ModelKey",
    "ReasoningLevel",
    "UNDECLARED_PURPOSE",
    "get_purpose",
    "purpose_names",
]

# The four platform_settings rows a purpose may resolve its model from, plus
# `forecast`. Each maps to a `model_<key>` setting (and a `model_<key>_dev`
# variant outside production) — see `platform_model_config.HARDCODED_DEFAULTS`.
ModelKey = Literal["default", "fallback", "forge", "research", "forecast", "classify"]

# `auto` means "send nothing, the model decides". Deliberately distinct from
# `off`, which sends {"enabled": false} and suppresses thinking outright.
ReasoningLevel = Literal["off", "minimal", "low", "medium", "high", "xhigh", "auto"]


@dataclass(frozen=True, slots=True)
class AIPurpose:
    """One purpose, and everything a call under it costs.

    ``why`` is not decoration: it carries the measurement that set the numbers,
    so the next author changing one can see what they are arguing against.
    """

    name: str
    model_key: ModelKey
    max_tokens: int
    timeout: int
    reasoning: ReasoningLevel = "auto"
    why: str = ""


def _purpose(
    name: str,
    model_key: ModelKey,
    max_tokens: int,
    timeout: int,
    reasoning: ReasoningLevel = "auto",
    why: str = "",
) -> AIPurpose:
    return AIPurpose(
        name=name,
        model_key=model_key,
        max_tokens=max_tokens,
        timeout=timeout,
        reasoning=reasoning,
        why=why,
    )


# ── The declaration ──────────────────────────────────────────────────────────
#
# `model_key` records what each purpose resolves TODAY, not what it might
# ideally resolve. Eight of these read `forge` because `create_forge_agent`'s
# default argument put them there; writing that down changes no behaviour and
# makes the next change a decision instead of an accident.
_PURPOSES: Final[tuple[AIPurpose, ...]] = (
    _purpose(
        "research",
        "research",
        2048,
        90,
        why=(
            "~3 sections of citations. The one purpose that already named itself "
            "at its agent (research_service.py:283), and therefore the one that "
            "has always resolved model_research rather than model_forge."
        ),
    ),
    _purpose(
        "anchors",
        "forge",
        3072,
        120,
        reasoning="auto",
        why=(
            "3 compact structured objects, bilingual EN+DE. Thinking stays on: "
            "the run that produced correctly dated, checkable citations (Scott, "
            "Seeing Like a State, 1998) was a thinking run. Change only with a "
            "measurement — see migration 279."
        ),
    ),
    _purpose(
        "chunk",
        "forge",
        12288,
        180,
        reasoning="off",
        why=(
            "Geography / agents / buildings as one structured batch, bilingual. "
            "Thinking off: long structured output leaves no room to think — the "
            "same budget arithmetic that broke `entity` at 3072."
        ),
    ),
    _purpose(
        "entity",
        "forge",
        3072,
        120,
        reasoning="off",
        why=(
            "One agent or building (character + background + DE). Measured on "
            "production 2026-08-29: with thinking at the model's default, 3016 "
            "of 3072 tokens went to reasoning and 3 of 4 attempts died before "
            "emitting anything. Off takes it to 3/3 and 50-115s down to ~31s."
        ),
    ),
    _purpose(
        "lore",
        "forge",
        8192,
        180,
        reasoning="off",
        why=(
            "5-7 section lore scroll. Off keeps 2/2 success, yields more "
            "sections, runs 40% faster and costs half (migration 279)."
        ),
    ),
    _purpose(
        "lore_translation",
        "forge",
        8192,
        180,
        why="Mirrors the lore output it translates, so it mirrors its budget.",
    ),
    _purpose(
        "dossier",
        "forge",
        16384,
        300,
        reasoning="auto",
        why=(
            "~9000 words across 6 sections — the largest single answer the "
            "platform asks for. Reasoning left on auto: the measurement was "
            "inconclusive, 3 of 4 runs hit an unrelated upstream provider error."
        ),
    ),
    _purpose(
        "dossier_evolution",
        "forge",
        1024,
        60,
        why="Short 100-250 word addenda appended to an existing dossier section.",
    ),
    _purpose(
        "theme",
        "forge",
        2048,
        90,
        why="One flat structured object, ~30 fields (colors, fonts, style prompts).",
    ),
    _purpose(
        "translation",
        "forge",
        4096,
        120,
        why="A batch of entity fields translated in one call.",
    ),
    _purpose(
        "style_refine",
        "forge",
        2048,
        90,
        why=(
            "NEW BUDGET — this purpose had neither, and ran as "
            "`timeout=None max_tokens=None` in production. One answer is four "
            "style prompts (PORTRAIT / BUILDING / LORE / BANNER). Measured over "
            "the 41 worlds on production 2026-08-30, as stored in "
            "simulation_settings: median 947 characters for all four together, "
            "p95 1936, max 2155 — roughly 616 tokens at the worst. 2048 is "
            "3.3x the observed maximum, and equals `theme`, which is the same "
            "service producing the same kind of answer. Timeout 90s against a "
            "single observed duration of 21s in the 2026-08-29 ignition log."
        ),
    ),
    _purpose(
        "templates",
        "forge",
        8192,
        180,
        why=(
            "NEW BUDGET — as with style_refine, this ran uncapped and untimed. "
            "One answer is every prompt template for a world, as JSON. Measured "
            "across the 12 worlds on production that own templates, 2026-08-30: "
            "median 3015 characters, p95 and max both 12369 — about 3500 tokens "
            "before JSON escaping. 8192 is a little over 2x the observed "
            "maximum, and equals `lore`, the nearest comparable answer. Those "
            "12 outputs were produced with NO cap at all, so the maximum is a "
            "real ceiling of the task and not an artefact of a previous limit."
        ),
    ),
    _purpose(
        "ops_forecast",
        "forecast",
        200,
        10,
        why=(
            "MOVED, not invented. This purpose is absent from the two tables "
            "this module replaces, but unlike style_refine and templates it was "
            "never unbounded: `ops_forecast_service` passed "
            "`model_settings={'timeout': 10, 'max_tokens': 200}` at the call "
            "site, and `run_ai` uses `setdefault`, so those won. The numbers are "
            "carried here unchanged — 200 tokens caps the 1-2 sentence summary "
            "at ~$0.0001/call — so that all thirteen budgets are in one place "
            "and an operator can see this one. The outer `asyncio.wait_for` "
            "(`_DRIVER_TEXT_TIMEOUT_S`) stays what it was: a backstop, not the "
            "primary deadline. The model id moves too — `_FORECAST_MODEL` held "
            "`anthropic/claude-haiku-4.5` as a `Final` constant, which is the "
            "one place an operator cannot reach it; `model_forecast` is seeded "
            "with that exact id. Budget-exempt by design (AD-6): it passes no "
            "`admin_supabase`, so nothing pre-checks it."
        ),
    ),
)

AI_PURPOSES: Final[MappingProxyType[str, AIPurpose]] = MappingProxyType({p.name: p for p in _PURPOSES})


# What an undeclared purpose gets. It cannot be reached through a merged call
# site — `test_ai_purposes.py` fails the build first — but a purpose assembled
# at runtime would otherwise fall through to `max_tokens=None`, which is the
# model's own ceiling and the single most expensive way to be wrong. Fail
# closed: the smallest declared budget and the shortest declared timeout.
UNDECLARED_PURPOSE: Final[AIPurpose] = AIPurpose(
    name="<undeclared>",
    model_key="default",
    max_tokens=min(p.max_tokens for p in _PURPOSES),
    timeout=min(p.timeout for p in _PURPOSES),
    reasoning="auto",
    why="Conservative floor for a purpose that is not declared in AI_PURPOSES.",
)


def get_purpose(name: str) -> AIPurpose | None:
    """Return the declaration for ``name``, or ``None`` if it is undeclared."""
    return AI_PURPOSES.get(name)


def purpose_names() -> tuple[str, ...]:
    """Every declared purpose, in declaration order."""
    return tuple(p.name for p in _PURPOSES)
