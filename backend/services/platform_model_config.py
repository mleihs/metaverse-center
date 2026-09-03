"""Cached platform model configuration from platform_settings table.

In-process cache with 5-minute TTL, following the same pattern as
platform_api_keys.py. Avoids per-request DB queries for model config.

Supports environment-aware resolution: dev keys are preferred when
``settings.environment != "production"``.
"""

from __future__ import annotations

import logging
import time

from backend.config import settings
from backend.services.ai_purposes import AI_PURPOSES, UNDECLARED_PURPOSE, AIPurpose
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

_cache: dict[str, str] = {}
_cache_loaded_at: float = 0.0
_CACHE_TTL = 300  # 5 minutes

# Used whenever the cache is cold — startup before `ensure_loaded`, a DB read
# that failed, or a key absent from platform_settings. These MIRROR the values
# production actually carries, so a cold cache behaves like a warm one. Any
# other rule makes the first AI call after a restart quietly different from the
# second.
#
# ⚠ Every id here must exist in OpenRouter's catalogue. Checked 2026-08-29:
# `anthropic/claude-sonnet-4-6` (default + forge) and `google/gemini-2.0-flash-001`
# (fallback + research + all four dev keys) were all gone — the Claude id had a
# HYPHEN where the catalogue has a dot (`claude-sonnet-4.6`), so it had never
# resolved at all. A dead fallback is worse than none: it only ever runs when
# the primary already failed.
#
# Verify with:
#   curl -s https://openrouter.ai/api/v1/models -H "Authorization: Bearer $KEY" \
#     | python3 -c "import json,sys; print('<id>' in {m['id'] for m in json.load(sys.stdin)['data']})"
#
# ── 02.09.2026: KEIN DENKMODELL MEHR IN DIESEM VERZEICHNIS ──────────────────
#
# Entscheidung des Nutzers, auf Grundlage seiner OpenRouter-Rechnung: „deepseek
# 4 thinking war zu teuer." Sein Beleg schlägt meinen — die Aktivitätsseite von
# OpenRouter braucht einen Management-Key, und `ai_usage_log` kann die Frage
# nicht beantworten (er deckt 10,53 von 65 verbrauchten Einheiten ab und endet
# am 01.09.).
#
# Was ICH dazu messen konnte, und es stützt die Entscheidung:
#
#     Modell                     $/M ein   $/M aus   denkt
#     deepseek-v4-flash-0731       0,065     0,180    ja
#     deepseek-v4-pro              1,039     2,079    ja
#     deepseek-chat                0,257     1,029    NEIN
#
# Der Stückpreis der Denkmodelle ist NIEDRIGER — der Preis der Aufgabe nicht.
# Denk-Token werden als AUSGABE abgerechnet, also zum teuersten Satz, und am
# selben Depeschen-Prompt gemessen waren 219 bis 620 von 527 bis 914
# Ausgabe-Token reines Denken (47-68 %). Man zahlt das Zwei- bis Dreifache für
# dieselbe Antwort — und bei `model_forge` landete dieser Faktor auf 2,079 $/M,
# dem elffachen Satz des Flash.
#
# Dazu kommt, was schon vorher gemessen war: bei knappem Budget liefert ein
# Denkmodell eine 200er-Antwort mit LEEREM Inhalt. Teurer UND unzuverlässiger.
#
# ⚠ `model_forge` war `deepseek-v4-pro`. Der Wechsel auf `deepseek-chat` ist
# eine Kostenentscheidung mit einem Fähigkeits-Abstrich beim Weltenbau. Er ist
# eine platform_settings-Zeile und in Admin > Modelle ohne Deploy umkehrbar.
HARDCODED_DEFAULTS: dict[str, str] = {
    "model_default": "deepseek/deepseek-chat",
    "model_fallback": "google/gemini-2.5-flash-lite",
    "model_research": "deepseek/deepseek-chat",
    "model_forge": "deepseek/deepseek-chat",
    # `ops_forecast` only. Until 2026-08-30 this id sat in `ops_forecast_service`
    # as a `Final` constant, which is the one place an operator cannot reach it.
    # Same model, now a settings row like every other. Verified in the catalogue
    # 2026-08-30 together with the four above.
    "model_forecast": "anthropic/claude-haiku-4.5",
    # `classify` — Einordnen, nicht Erfinden.
    #
    # GEMESSEN 02.09.2026, weil der Standard hier nicht taugt: der
    # Substrate-Scanner lief mit `model_default`
    # (`deepseek-v4-flash-0731`, ein DENKMODELL) und lieferte null Kandidaten
    # aus allen Nachrichtenquellen. Für EINE Überschrift verbrauchte das
    # Modell 747 Ausgabe-Token, davon 709 fürs Nachdenken — das Budget war vor
    # dem ersten Zeichen Antwort aufgebraucht, und OpenRouter lieferte eine
    # 200er-Antwort mit leerem `content`.
    #
    #     deepseek-v4-flash-0731   ~25 s   747 Token (1 Überschrift)   leer
    #     deepseek-chat            5,8 s   329 Token (10 Überschriften)  10/10
    #
    # Von sechzehn DeepSeek-Modellen im Katalog denken vierzehn. `deepseek-chat`
    # ist eines der zwei, die es nicht tun. Für eine Aufgabe, die eine
    # Überschrift in eine von acht Schubladen legt, ist Nachdenken bezahlte
    # Zeit ohne Gegenwert.
    #
    # Die grössere Frage — ob der STANDARD ein Denkmodell sein sollte — steht
    # in `handoff/denkmodell-als-standard-2026-09-02.md` und ist hier bewusst
    # NICHT beantwortet.
    "model_classify": "deepseek/deepseek-chat",
    # `dispatch` — Schreiben, nicht Denken.
    #
    # Die Bureau-Depesche ist der zweite LLM-Aufruf des Scanners: 100–200
    # Wörter Prosa je Kandidat. Sie lief auf `model_default`, also demselben
    # Denkmodell wie der Klassifikator, mit einem festen Budget von 512.
    #
    # GEMESSEN 02.09.2026 an den 50 Depeschen, die auf Prod entstanden sind:
    #
    #     50 Depeschen · 7 vollständig LEER · 27 mitten im Wort abgeschnitten
    #     heil: 16
    #
    # Eine davon endet auf „… / DELUGE SUBTYPE / MAGN". Ein halber Satz sieht
    # aus wie ein Stil, und genau deshalb ist es niemandem aufgefallen.
    #
    # Direkt gegen OpenRouter mit dem echten Depeschen-Prompt, viermal
    # derselbe Prompt:
    #
    #     deepseek-v4-flash-0731   cap  512   completion 502   davon Denken 219
    #     deepseek-v4-flash-0731   cap 1024   completion 914   davon Denken 620
    #     deepseek-v4-flash-0731   cap 1536   completion 527   davon Denken 328
    #     deepseek-chat            cap  512   completion 250   davon Denken   0
    #
    # ⚠ Das Denken schwankt bei GLEICHEM Prompt zwischen 219 und 620 Token.
    # Eine feste Zahl kann das nicht auffangen — deshalb ist die Antwort ein
    # Modell ohne Denken und nicht ein grösseres Budget. Der Text ist dabei
    # nicht schlechter: 171 Wörter im richtigen Ton, in 250 statt 914 Token.
    "model_dispatch": "deepseek/deepseek-chat",
    # Der Agenten-Chat. Eigener Schluessel seit 02.09.2026: `chat_response` fiel
    # vorher unter Regel 3 in `model_default` — der Chat folgte also jeder
    # Modellentscheidung, die fuer Schmiede oder Einordnung getroffen wurde.
    # v4-flash traegt 1 048 576 Token Kontext (gemessen am OpenRouter-Katalog),
    # das Achtfache dessen, was die alte Fenstertabelle fuer "deepseek" annahm.
    "model_chat": "deepseek/deepseek-v4-flash",
    # Dev defaults — the cheap tier, matching the *_dev rows in platform_settings
    "model_default_dev": "deepseek/deepseek-chat",
    "model_fallback_dev": "google/gemini-2.5-flash-lite",
    "model_research_dev": "deepseek/deepseek-chat",
    "model_forge_dev": "deepseek/deepseek-chat",
    "model_forecast_dev": "anthropic/claude-haiku-4.5",
    "model_classify_dev": "deepseek/deepseek-chat",
    "model_dispatch_dev": "deepseek/deepseek-chat",
    "model_chat_dev": "deepseek/deepseek-v4-flash",
}

_MODEL_KEYS = tuple(HARDCODED_DEFAULTS.keys())

# ── Reasoning effort per purpose ─────────────────────────────────────
# OpenRouter counts reasoning tokens INSIDE max_tokens and bills them as
# output ("max_tokens must be strictly higher than the reasoning budget";
# "Reasoning tokens are considered output tokens"). Effort maps to a share of
# the budget: xhigh ~95%, high ~80%, medium ~50%, low ~20%, minimal ~10%.
#
# `deepseek/deepseek-v4-pro` — the model `model_forge` carries — only offers
# `high` and `xhigh`. Left unset it spent 3016 of 3072 tokens thinking and
# emitted nothing, which is what a `entity` call looks like when it 502s:
# `UnexpectedModelBehavior: Model token limit (3072) exceeded before any
# response was generated`. Measured on prod 2026-08-29: 3 of 4 attempts failed
# that way, 50-115s each, billed in full.
#
# "off" disables thinking outright — a first-class mode on the V4 hybrids, not
# a workaround. Measured against the real ForgeAgentDraft schema, `entity` went
# from ~25% to 3/3 complete objects and from 50-115s to ~31s; `lore` kept 2/2
# while gaining sections at half the cost. Values: off | minimal | low |
# medium | high | xhigh | auto (send nothing, let the model decide).
#
# DERIVED, not written out a second time. The level belongs to the purpose, and
# the purpose is declared once in `ai_purposes.py` together with the budget it
# spends its thinking from — the two numbers are not independent, so keeping
# them in two tables was an invitation to change one of them alone.
REASONING_DEFAULTS: dict[str, str] = {f"reasoning_{p.name}": p.reasoning for p in AI_PURPOSES.values()}

_REASONING_KEYS = tuple(REASONING_DEFAULTS.keys())

# ── Per-purpose budget + timeout overrides ───────────────────────────
# The defaults live in `ai_purposes.py`; these keys let an operator raise or
# lower one purpose from Admin > Models without a redeploy. Finding 15: the
# model id was the ONLY admin-editable part of a call, while `max_tokens` — the
# number that broke the 2026-08-29 production run — could be changed only by
# shipping code.
_BUDGET_KEYS = tuple(f"max_tokens_{name}" for name in AI_PURPOSES)
_TIMEOUT_KEYS = tuple(f"timeout_{name}" for name in AI_PURPOSES)

_KNOWN_KEYS = frozenset((*_MODEL_KEYS, *_REASONING_KEYS, *_BUDGET_KEYS, *_TIMEOUT_KEYS))


async def _load_all(admin_supabase: Client) -> None:
    """Load model settings from platform_settings."""
    global _cache, _cache_loaded_at  # noqa: PLW0603

    try:
        response = await (
            admin_supabase.table("platform_settings")
            .select("setting_key, setting_value")
            .in_("setting_key", [*_MODEL_KEYS, *_REASONING_KEYS, *_BUDGET_KEYS, *_TIMEOUT_KEYS])
            .execute()
        )
        new_cache: dict[str, str] = {}
        for row in extract_list(response):
            key = row["setting_key"]
            if key not in _KNOWN_KEYS:
                continue
            raw = str(row.get("setting_value", "")).strip('"')
            if raw:
                new_cache[key] = raw
        _cache = new_cache
        _cache_loaded_at = time.monotonic()
    except Exception:  # noqa: BLE001 — config loading is best-effort, fall back to in-memory cache
        logger.warning("Failed to load platform model config from DB")
        _cache_loaded_at = time.monotonic()


def get_platform_model(purpose: str) -> str:
    """Return cached model ID for the given purpose. Sync — reads from memory.

    Resolution order:

    1. A purpose **declared** in ``ai_purposes.AI_PURPOSES`` resolves through the
       ``model_key`` it declares. This is what makes the model follow the purpose
       instead of following ``create_forge_agent``'s default argument — before
       2026-08-30, ``chunk``, ``entity``, ``lore``, ``dossier`` and the rest got
       their model from the string ``"forge"`` and everything else about the call
       from their own name (finding 11).
    2. The literal setting-key names ``forge`` / ``research`` / ``fallback`` /
       ``classify`` keep resolving to themselves. Callers that want a *tier*
       rather than a purpose pass these — ``run_ai``'s 429 fallback asks for
       ``"fallback"``, the GenerationService path asks for ``"forge"``, and the
       scanner asks for ``"classify"``.

       ⚠ A tier NOT in this tuple silently becomes ``model_default``. On
       2026-09-02 the scanner asked for ``"classify"`` before it was listed
       here, got the default — a thinking model — and classified nothing, while
       the code, the migration and ``HARDCODED_DEFAULTS`` all said otherwise.
       Three places agreed and the fourth quietly disagreed; rule 3 below is
       exactly that trapdoor, and it does not raise.
    3. Everything else — every ``GenerationService`` purpose, and any string that
       reaches here by accident — resolves to ``model_default``, as it always has.
       ``services/constants.py`` documents what that collapse already cost once.

    In non-production environments, resolves the ``_dev`` variant first,
    falling back to the production key if the dev key is absent.
    """
    declared = AI_PURPOSES.get(purpose)
    if declared is not None:
        base_key = f"model_{declared.model_key}"
    elif f"model_{purpose}" in HARDCODED_DEFAULTS:
        # A TIER, asked for by its own name. This used to be a hand-written
        # tuple `("forge", "research", "fallback", "classify")` beside a dict
        # that already held exactly the same knowledge — and on 2026-09-02 the
        # two disagreed: the scanner asked for `classify` while the tuple still
        # listed three names, so it got `model_default` (a thinking model) and
        # classified nothing. Three places said `deepseek-chat`; the fourth
        # said nothing at all, which rule 3 below turns into a silent default.
        #
        # A constraint written twice is twice incomplete. The tiers ARE the
        # keys of HARDCODED_DEFAULTS, so ask that dict instead of a copy of it:
        # adding a model key now adds its tier in the same edit, and the
        # trapdoor cannot reopen. `test_every_model_key_resolves_to_itself`
        # holds it.
        base_key = f"model_{purpose}"
    else:
        base_key = "model_default"

    is_prod = settings.environment == "production"

    if not is_prod:
        dev_key = f"{base_key}_dev"
        dev_model = _cache.get(dev_key) or HARDCODED_DEFAULTS.get(dev_key)
        if dev_model:
            logger.debug(
                "Resolved model for %s [env=%s]: %s",
                purpose,
                settings.environment,
                dev_model,
            )
            return dev_model

    model = _cache.get(base_key) or HARDCODED_DEFAULTS[base_key]
    logger.debug(
        "Resolved model for %s [env=%s]: %s",
        purpose,
        settings.environment,
        model,
    )
    return model


async def ensure_loaded(admin_supabase: Client) -> None:
    """Load cache if stale. Called at startup + after admin saves model settings."""
    now = time.monotonic()
    if now - _cache_loaded_at > _CACHE_TTL or not _cache_loaded_at:
        await _load_all(admin_supabase)


def invalidate() -> None:
    """Clear cache — called when admin updates a model_* setting."""
    global _cache, _cache_loaded_at  # noqa: PLW0603
    _cache = {}
    _cache_loaded_at = 0.0


def get_platform_reasoning(purpose: str) -> dict[str, object] | None:
    """Return the OpenRouter ``reasoning`` payload for a purpose, or ``None``.

    ``None`` means "send nothing" — the model's own default applies. That is
    what ``auto`` resolves to, and it is deliberately distinct from ``off``,
    which sends ``{"enabled": False}`` and suppresses thinking entirely.

    Sync — reads the same in-process cache as :func:`get_platform_model`, so an
    admin edit takes effect on the next :func:`invalidate` + reload, never on a
    redeploy. See ``REASONING_DEFAULTS`` for why each purpose is set as it is.
    """
    raw = (_cache.get(f"reasoning_{purpose}") or REASONING_DEFAULTS.get(f"reasoning_{purpose}") or "auto").lower()

    if raw == "auto":
        return None
    if raw == "off":
        return {"enabled": False}
    if raw in ("minimal", "low", "medium", "high", "xhigh"):
        return {"effort": raw}

    logger.warning(
        "Unknown reasoning level %r for purpose %r - falling back to the model default",
        raw,
        purpose,
        extra={"purpose": purpose, "raw": raw},
    )
    return None


def _declared(purpose: str) -> AIPurpose:
    """The declaration for ``purpose``, or the conservative floor.

    An undeclared purpose cannot reach here through merged code —
    ``test_ai_purposes.py`` fails the build on one — so arriving here means a
    purpose was assembled at runtime. Warn once per call rather than silently
    handing the model its own ceiling, which is what ``dict.get`` returning
    ``None`` used to do.
    """
    declared = AI_PURPOSES.get(purpose)
    if declared is not None:
        return declared
    logger.warning(
        "AI purpose %r is not declared in ai_purposes.AI_PURPOSES – "
        "falling back to the conservative floor (max_tokens=%d, timeout=%ds)",
        purpose,
        UNDECLARED_PURPOSE.max_tokens,
        UNDECLARED_PURPOSE.timeout,
        extra={"purpose": purpose},
    )
    return UNDECLARED_PURPOSE


def _positive_int_setting(key: str, default: int, purpose: str) -> int:
    """Read a positive integer from the settings cache, else ``default``.

    Anything unreadable — a non-numeric string, zero, a negative — logs and
    yields the declared default. A typo in the admin UI must not be able to
    remove a budget: ``max_tokens=0`` is not a small budget, and a negative
    timeout is not a short one; both are ways of switching the guard off.
    """
    raw = _cache.get(key)
    if raw is None:
        return default
    try:
        value = int(str(raw).strip().strip('"'))
    except (TypeError, ValueError):
        logger.warning(
            "platform_settings.%s is not an integer (%r) – using the declared default %d",
            key,
            raw,
            default,
            extra={"purpose": purpose, "setting_key": key, "raw": raw},
        )
        return default
    if value <= 0:
        logger.warning(
            "platform_settings.%s must be positive (got %d) – using the declared default %d",
            key,
            value,
            default,
            extra={"purpose": purpose, "setting_key": key, "raw": raw},
        )
        return default
    return value


def get_platform_max_tokens(purpose: str) -> int:
    """Return the output-token ceiling for a purpose.

    Sync — same in-process cache as :func:`get_platform_model`, so an admin edit
    takes effect on the next :func:`invalidate` + reload rather than on a
    redeploy. The default comes from ``ai_purposes.AI_PURPOSES``, where the
    measurement that set it is recorded alongside it.
    """
    declared = _declared(purpose)
    return _positive_int_setting(f"max_tokens_{purpose}", declared.max_tokens, purpose)


def get_platform_timeout(purpose: str) -> int:
    """Return the wall-clock timeout in seconds for a purpose.

    ``None`` is deliberately not representable. Before 2026-08-30 three purposes
    were absent from the timeout map and ran with no limit at all against a
    model whose output ceiling is 384 000 tokens; a purpose that is not declared
    now gets the shortest declared timeout instead of an unbounded wait.
    """
    declared = _declared(purpose)
    return _positive_int_setting(f"timeout_{purpose}", declared.timeout, purpose)
