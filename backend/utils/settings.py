"""Platform settings utilities — shared parsing for scheduler config.

Centralizes the pattern of loading settings from the platform_settings table,
parsing booleans, decrypting encrypted values, and writing updates safely.
Used across backend schedulers and services that read/write platform_settings
(social schedulers, orphan-sweeper, forge BYOK toggles, news scanner, …);
prefer these helpers over ad-hoc postgrest chains so encoding + safety
invariants live in one place.
"""

from __future__ import annotations

import json
import logging
from uuid import UUID

import httpx
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.utils.encryption import decrypt
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


_TRUE_STRINGS = frozenset({"true", "1", "yes", "on"})


#: Die Sprache, in der eine Welt ihre Inhalte fuehrt, wenn sie es nicht sagt.
#:
#: ⚠ DIESE ZAHL STAND ZWEIMAL IM WERK, MIT ZWEI VERSCHIEDENEN WERTEN.
#:
#:     ChatAIService._get_locale()               -> "de"
#:     PromptResolver._get_simulation_locale()   -> "en"
#:
#: Gemessen am 04.09.2026 auf Produktion: KEINE der 41 Welten hat
#: `general.content_locale` gesetzt. Der Widerspruch galt also fuer jede.
#:
#: Was er anrichtete, ist kein Konfigurationsdetail. Der Chat fragte nach
#: einer DEUTSCHEN Vorlage, fand keine, und Stufe 2 des Aufloesers
#: ("Welt + Vorgabesprache der Welt") gab ihm die ENGLISCHE welteigene. Ein
#: Agent in Velgarien bekam damit:
#:
#:   · einen englischen Rahmen um eine deutsche Figur ("You are Mira, a
#:     <1100 Zeichen deutscher Lebenslauf>")
#:   · die Anweisung "Acknowledge the party's Citizen Identification Number
#:     (CIN)" — daher die CIN-Bruchstuecke in den Antworten
#:   · KEINEN `{agent_memories}`-Platzhalter, also nie sein Gedaechtnis
#:   · KEINEN `{agent_mood}`-Platzhalter, also nie seine Stimmung
#:   · kein Wort zur Ich-Form, also Erzaehlung von aussen ueber sich selbst
#:
#: WARUM "de" UND NICHT "en": gemessen, nicht gewaehlt. Alle 5 Gespraeche der
#: Plattform laufen auf `de`, und die Oberflaeche ist deutsch. Dass die
#: welteigenen Vorlagen 50:6 englisch sind, sagt etwas ueber die SCHMIEDE
#: (sie schreibt englisch), nicht ueber die Sprache, in der gespielt wird.
#:
#: Der Wert wirkt NUR in Stufe 2 des Aufloesers: alle elf `resolve()`-Aufrufe
#: im Werk geben die Sprache ausdruecklich mit. Er entscheidet also allein
#: darueber, ob eine welteigene Vorlage in einer FREMDEN Sprache einer
#: Plattform-Vorlage in der RICHTIGEN vorgezogen wird — und das soll sie nicht.
DEFAULT_CONTENT_LOCALE = "de"


async def get_content_locale(supabase: Client, simulation_id: UUID | str | None) -> str:
    """Die Sprache, in der eine Welt ihre Inhalte fuehrt.

    Die EINE Stelle, an der diese Frage beantwortet wird. Vorher gab es zwei,
    und sie widersprachen sich — siehe :data:`DEFAULT_CONTENT_LOCALE`.

    Kein Puffer hier: die Aufrufer halten ihren eigenen (``_cached_locale``,
    ``_sim_locale``), und beide leben genau eine Anfrage lang. Ein Puffer an
    dieser Stelle muesste eine Lebensdauer waehlen, die keiner der beiden
    braucht.
    """
    if not simulation_id:
        return DEFAULT_CONTENT_LOCALE
    try:
        response = await (
            supabase.table("simulation_settings")
            .select("setting_value")
            .eq("simulation_id", str(simulation_id))
            .eq("setting_key", "general.content_locale")
            .limit(1)
            .execute()
        )
    except (PostgrestAPIError, httpx.HTTPError):
        # Eine Welt ohne erreichbare Einstellung ist nicht englisch, sie ist
        # unbekannt. Der Vorgabewert ist die ehrlichere Antwort als ein Fehler
        # mitten im Prompt-Aufbau.
        logger.warning("Sprache der Welt %s nicht lesbar", simulation_id, exc_info=True)
        return DEFAULT_CONTENT_LOCALE
    rows = extract_list(response)
    if not rows:
        return DEFAULT_CONTENT_LOCALE
    wert = rows[0].get("setting_value")
    # jsonb kann als '"de"' ankommen; die Anfuehrungszeichen gehoeren nicht
    # in einen Sprachschluessel.
    text = str(wert or "").strip().strip('"')
    return text or DEFAULT_CONTENT_LOCALE


def parse_setting_bool(value: object) -> bool:
    """Parse a platform_settings value as a boolean (fail-closed).

    Accepts:
      * Python ``bool`` — returned verbatim. postgrest unwraps jsonb
        bool to Python bool, so a migration-seeded ``'false'::jsonb``
        arrives here as Python ``False``.
      * Python ``int`` / ``float`` — stringified, matched case-
        insensitively against the TRUE set (so ``1`` → True, ``0`` /
        ``2`` / ``1.0`` → False).
      * ``str`` — lower-cased, outer whitespace + double-quotes
        trimmed, matched against ``{"true", "1", "yes", "on"}``.
        Catches both the JSON-quoted shape (``'"true"'``) the admin
        UI writes and the plain form (``"true"``).

    Everything else — ``None`` (jsonb null, missing rows),
    unrecognised strings (``"foo"``, ``"enabled"``, ``"null"``) — is
    ``False``. Flag-style settings like ``orphan_sweeper_enabled`` and
    ``instagram_posting_enabled`` MUST fail closed: an accidental null
    in a manual SQL edit or a typo that lands something non-canonical
    must not activate a dormant scheduler.

    Rationale for the fail-closed positive-match (replacing the prior
    "anything not in {false,0,no,''}" negation): the old behavior
    returned True for ``parse_setting_bool(None)``, which silently
    armed schedulers whenever postgrest handed back a jsonb null.
    Positive-match closes that gap and all its siblings ("None",
    "null", unknown strings) in one stroke.
    """
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    return str(value).strip().strip('"').lower() in _TRUE_STRINGS


def decrypt_setting(raw: str) -> str:
    """Decrypt an encrypted platform_settings value.

    Returns the decrypted string, or empty string on failure.
    Values with the ``gAAAAA`` prefix are Fernet-encrypted.
    """
    if not raw or not raw.startswith("gAAAAA"):
        return str(raw).strip().strip('"') if raw else ""

    try:
        return decrypt(raw)
    except Exception:
        logger.warning("Failed to decrypt platform setting", exc_info=True)
        return ""


async def load_platform_settings(
    admin: Client,
    keys: list[str],
) -> dict[str, str]:
    """Load platform_settings rows into a flat ``{key: value}`` dict.

    Returns raw string values — callers parse with ``parse_setting_bool``,
    ``decrypt_setting``, ``json.loads``, etc. as needed.
    """
    settings_map: dict[str, str] = {}
    try:
        resp = await (
            admin.table("platform_settings").select("setting_key, setting_value").in_("setting_key", keys).execute()
        )
        for row in extract_list(resp):
            settings_map[row["setting_key"]] = row["setting_value"]
    except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
        logger.warning("Failed to load platform settings for keys %s", keys, exc_info=True)

    return settings_map


async def load_settings_with_description(admin: Client, keys: list[str]) -> dict[str, dict]:
    """Load platform_settings rows as ``{key: {"value": str, "description": str}}``.

    Like ``load_platform_settings`` but also carries each row's ``description`` and
    coerces the jsonb ``setting_value`` to the string shape the admin Platform-
    settings UI renders: dict/list -> JSON text, bool -> "true"/"false", other
    non-null -> ``str(...)``, null -> "". Shared by the Instagram + Bluesky
    pipeline-settings readers (their ``get_pipeline_settings`` were byte-identical).
    """
    resp = await (
        admin.table("platform_settings")
        .select("setting_key, setting_value, description")
        .in_("setting_key", keys)
        .execute()
    )
    settings_map: dict[str, dict] = {}
    for row in extract_list(resp):
        raw = row["setting_value"]
        if isinstance(raw, dict | list):
            value = json.dumps(raw)
        elif isinstance(raw, bool):
            value = "true" if raw else "false"
        elif raw is not None:
            value = str(raw)
        else:
            value = ""
        settings_map[row["setting_key"]] = {
            "value": value,
            "description": row.get("description", ""),
        }
    return settings_map


async def upsert_platform_setting(
    admin: Client,
    key: str,
    value: object,
    *,
    updated_by_id: UUID | str | None = None,
) -> None:
    """Upsert a single ``platform_settings`` row by key.

    Replaces the ``.update({"setting_value": ...}).eq("setting_key", key)``
    pattern that silently no-ops when the row is absent (fresh DB,
    migration-lag window, or a key that was never seeded). The
    ``platform_settings`` table declares ``UNIQUE(setting_key)`` so
    ``ON CONFLICT (setting_key) DO UPDATE`` resolves cleanly.

    ``value`` is passed verbatim to postgrest — callers that want a
    JSON-string shape (``json.dumps(False)``) continue to encode
    themselves; this helper does not second-guess the stored jsonb shape.
    """
    row: dict[str, object] = {
        "setting_key": key,
        "setting_value": value,
    }
    if updated_by_id is not None:
        row["updated_by_id"] = str(updated_by_id)
    await admin.table("platform_settings").upsert(row, on_conflict="setting_key").execute()


# ── Der Riegel vor planmäßigen Modellkosten ──────────────────────────────
#
# Ein Modellaufruf, den ein Mensch auslöst (Schmiede, Chat, „Chronik
# erzeugen"), ist eine Entscheidung. Ein Modellaufruf, den ein Zeitgeber
# auslöst, ist eine Dauerlast: er wiederholt sich, solange die Anwendung
# läuft, und niemand sieht ihn im Moment des Entstehens.
#
# Diese Trennung war bisher nirgends ausgesprochen. Dass der Herzschlag heute
# nichts kostet, liegt daran, dass ZUFÄLLIG kein Weltbesitzer einen eigenen
# Schlüssel hinterlegt hat — und der eine Schalter, der die Plattformkasse
# öffnet (`autonomy_admin_override`), hätte niemanden gefragt. Eine Zusage,
# die von einer Abwesenheit lebt, ist keine Zusage.
#
# `scheduled_ai_spend_enabled` ist die ausgesprochene Fassung: standardmäßig
# AUS, fail-closed (fehlende Zeile, jsonb-null, Tippfehler → aus), und jeder
# Pfad, der aus einem Zeitgeber heraus ein Modell erreichen könnte, fragt sie
# zuerst. Vom Menschen ausgelöste Pfade fragen sie NICHT — sie abzuschalten
# wäre keine Kostenbremse, sondern ein kaputtes Produkt.
# ── Heartbeat tick interval ────────────────────────────────────────────
# The platform_settings key that carries the world-tick interval, and the
# fallback used when the row is absent. TWO consumers read it and they must
# agree: HeartbeatService's own scheduler (how often a world ticks) and
# EventService's ward-expiry maths (how long a "duration_ticks" effect lasts
# in wall-clock seconds). They disagreed until 31.08.2026 — EventService read
# a key named "heartbeat_interval" that has never existed in any migration or
# on production, so it silently fell back to 300 s and expired Deluge/Tower
# T3 building protection after 50 minutes instead of the ~40 hours its
# duration_ticks promised. A key name that is wrong reads exactly like a key
# that is merely unset; naming it once is the only fix that stays fixed.
HEARTBEAT_INTERVAL_SETTING = "heartbeat_interval_seconds"
HEARTBEAT_INTERVAL_DEFAULT_SECONDS = 14400  # 4 hours (seed 129 wrote 28800; prod runs 14400)


SCHEDULED_AI_SPEND_SETTING = "scheduled_ai_spend_enabled"


async def scheduled_ai_spend_allowed(admin: Client) -> bool:
    """Darf ein Zeitgeber-Pfad gerade einen bezahlten Modellaufruf machen?

    Fail-closed: fehlt die Zeile oder ist sie unlesbar, lautet die Antwort
    Nein. ``load_platform_settings`` schluckt Fehler und liefert ein leeres
    Mapping — zusammen mit ``parse_setting_bool``'s Positivabgleich ergibt
    das genau den gewünschten Ausfallweg.
    """
    settings = await load_platform_settings(admin, [SCHEDULED_AI_SPEND_SETTING])
    return parse_setting_bool(settings.get(SCHEDULED_AI_SPEND_SETTING))


JSON_REPAIR_SETTING = "json_repair_enabled"


async def json_repair_allowed(admin: Client) -> bool:
    """Darf eine misslungene JSON-Antwort ein zweites Mal ans Modell?

    ``GenerationService._parse_or_repair_json`` schickt eine unbrauchbare
    Antwort samt Zielform noch einmal zum Modell. Das ist ein ZWEITER bezahlter
    Aufruf auf eine Antwort, die schon misslungen ist — ob sich das lohnt,
    hängt daran, wie oft überhaupt etwas misslingt, und diese Zahl gibt es erst
    seit ``_observe_json_failure`` sie erhebt.

    Fail-closed wie ``scheduled_ai_spend_allowed``: fehlt die Zeile oder ist
    sie unlesbar, lautet die Antwort Nein. Ein Riegel, der bei Abwesenheit
    öffnet, ist kein Riegel.
    """
    settings = await load_platform_settings(admin, [JSON_REPAIR_SETTING])
    return parse_setting_bool(settings.get(JSON_REPAIR_SETTING))
