"""Cached platform research domain configuration from platform_settings table.

In-process cache with 5-minute TTL, following the same pattern as
platform_model_config.py. Avoids per-request DB queries for domain config.

Zwei Arten von Liste liegen hier, und sie tun Verschiedenes:

* ``research_domains_<achse>`` **steuert** die Suche. Sie geht als Tavilys
  ``include_domains`` mit und sagt: hier bitte zuerst nachsehen.
* ``research_source_allowlist`` / ``research_source_denylist`` **entscheidet**.
  Sie wird nach der Lieferung angewandt, auf jede Quellzeile jedes Anbieters,
  von ``research_source_policy.is_admissible``.

Bis 2026-09-04 gab es nur die erste Art, und sie wurde fuer die zweite gehalten.
Sie war es nie: ohne ``include_domains_mode="filter"`` gewichtet Tavily die
Liste bloss. Die Messung steht in ``research_source_policy``; die Betriebsart
setzt jetzt ``TavilySearchService``, und die Entscheidung faellt zusaetzlich
hier im Haus.
"""

from __future__ import annotations

import json
import logging
import time

import httpx
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

_cache: dict[str, list[str]] = {}
_cache_loaded_at: float = 0.0
_CACHE_TTL = 300  # 5 minutes

# ── Die Gattungen, aus denen die Freiliste besteht ───────────────────────────
#
# Getrennt notiert, weil die Grenze zwischen ihnen die Stelle ist, an der eine
# Aenderung diskutiert wird: "bleibt das Nachschlagewerk?" ist eine andere
# Frage als "bleibt der Fachverlag?". Zusammengesetzt wird erst unten.

# Begutachtete Fachliteratur: Verlage und Aggregatoren.
_PEER_REVIEWED: tuple[str, ...] = (
    "jstor.org",
    "muse.jhu.edu",
    "cambridge.org",
    "academic.oup.com",
    "degruyter.com",
    "tandfonline.com",
    "journals.sagepub.com",
    "link.springer.com",
    "springer.com",
    "sciencedirect.com",
    "onlinelibrary.wiley.com",
    "brill.com",
    "annualreviews.org",
    "nature.com",
    "science.org",
    "pnas.org",
    "journals.uchicago.edu",
    "read.dukeupress.edu",
    "openedition.org",
    "journals.openedition.org",
    "persee.fr",
    "erudit.org",
    "scielo.org",
    "doi.org",
    "doaj.org",
    "core.ac.uk",
    "zenodo.org",
    "hal.science",
    "arxiv.org",
    "oapen.org",
    "luminosoa.org",
)

# Wissenschaftliche Buchverlage.
_UNIVERSITY_PRESSES: tuple[str, ...] = (
    "press.uchicago.edu",
    "mitpress.mit.edu",
    "press.princeton.edu",
    "hup.harvard.edu",
    "yalebooks.yale.edu",
    "ucpress.edu",
    "dukeupress.edu",
    "cornellpress.cornell.edu",
    "sup.org",
    "nyupress.org",
    "manchesteruniversitypress.co.uk",
    "uminnpressblog.com",
    "upress.umn.edu",
)

# Philosophie: die Fachenzyklopaedien und die Bibliographie.
_PHILOSOPHY: tuple[str, ...] = (
    "plato.stanford.edu",
    "iep.utm.edu",
    "philpapers.org",
    "philarchive.org",
    "philsci-archive.pitt.edu",
    "ndpr.nd.edu",
)

# Werke im Volltext oder im Katalog — der literarische Primaerbestand.
_LIBRARIES: tuple[str, ...] = (
    "openlibrary.org",
    "archive.org",
    "gutenberg.org",
    "projekt-gutenberg.org",
    "hathitrust.org",
    "babel.hathitrust.org",
    "wikisource.org",
    "en.wikisource.org",
    "de.wikisource.org",
    "deutschestextarchiv.de",
    "zeno.org",
    "perseus.tufts.edu",
)

# Nachschlagewerk. Nicht begutachtet, aber redaktionell gefuehrt und belegt —
# der Einstiegskontext, aus dem eine Achse ihre Fachbegriffe zieht. Wer die
# Grenze haerter ziehen will, entfernt diese Gruppe im Admin unter
# Forschung → Zugelassene Quellen; die uebrigen Gruppen tragen dann allein.
_REFERENCE: tuple[str, ...] = (
    "en.wikipedia.org",
    "de.wikipedia.org",
    "britannica.com",
)

# Architekturgeschichte als Wissenschaft. Ersetzt die Designmagazine, die die
# Architekturachse bis 2026-09-04 ansteuerte (``dezeen.com``,
# ``designboom.com``): beide sind redaktionelle Bildstrecken ohne Apparat.
# Diese Gruppe beschreibt Bauten praezise und datiert, zeigt sie aber nicht —
# das ist der bewusst in Kauf genommene Verlust.
_ARCHITECTURAL_HISTORY: tuple[str, ...] = (
    "sah.org",
    "getty.edu",
    "metmuseum.org",
    "arthistoricum.net",
    "architecturalhistoriansjournal.org",
)

_SCHOLARLY_ALLOWLIST: tuple[str, ...] = tuple(
    dict.fromkeys(_PEER_REVIEWED + _UNIVERSITY_PRESSES + _PHILOSOPHY + _LIBRARIES + _REFERENCE + _ARCHITECTURAL_HISTORY)
)

# ── Die Sperrliste ───────────────────────────────────────────────────────────
#
# Sie gilt auch fuer Fachanbieter (siehe ``is_admissible(trusted_provider=)``)
# und schlaegt die Freiliste. Die drei Eintraege, die den Anlass gaben, stehen
# in der ersten Gruppe: Videoplattform, soziales Netz, Fanwiki.
_EXCLUDED: tuple[str, ...] = (
    # Video und soziale Netze
    "youtube.com",
    "youtu.be",
    "vimeo.com",
    "dailymotion.com",
    "twitch.tv",
    "tiktok.com",
    "facebook.com",
    "fb.com",
    "instagram.com",
    "threads.net",
    "x.com",
    "twitter.com",
    "linkedin.com",
    "reddit.com",
    "pinterest.com",
    "tumblr.com",
    "discord.com",
    "t.me",
    # Fanwikis und Werkdatenbanken ohne Apparat
    "fandom.com",
    "wikia.com",
    "wikia.org",
    "gamepedia.com",
    "tvtropes.org",
    "imdb.com",
    "goodreads.com",
    # Spiele
    "boardgamegeek.com",
    "store.steampowered.com",
    "steampowered.com",
    "gog.com",
    "ign.com",
    "gamespot.com",
    "polygon.com",
    "kotaku.com",
    "pcgamer.com",
    "rockpapershotgun.com",
    "eurogamer.net",
    "gamesradar.com",
    "gamerant.com",
    "screenrant.com",
    # Frage-Antwort und Ratgeber
    "quora.com",
    "stackexchange.com",
    "stackoverflow.com",
    "answers.com",
    "wikihow.com",
    "ehow.com",
    "chegg.com",
    "coursehero.com",
    "studocu.com",
    "sparknotes.com",
    "cliffsnotes.com",
    "bartleby.com",
    "gradesaver.com",
    "shmoop.com",
    "enotes.com",
    "studysmarter.co.uk",
    "litcharts.com",
    # Selbstverlag und Baukastenseiten
    "medium.com",
    "substack.com",
    "blogspot.com",
    "wordpress.com",
    "wix.com",
    "wixsite.com",
    "squarespace.com",
    "weebly.com",
    "blogger.com",
    # Handel
    "amazon.com",
    "amazon.de",
    "ebay.com",
    "etsy.com",
    "alibaba.com",
    "abebooks.com",
    "scribd.com",
    "slideshare.net",
    "prezi.com",
    "coursera.org",
    "udemy.com",
    # Raubkopien-Aggregatoren: rechtlich heikel und bibliographisch wertlos
    "sci-hub.se",
    "libgen.is",
    "z-lib.org",
)

HARDCODED_DEFAULTS: dict[str, list[str]] = {
    # ── Steuerung: wo Tavily je Achse zuerst nachsieht ───────────────────────
    "research_domains_encyclopedic": [
        *_REFERENCE,
        *_PHILOSOPHY[:2],
        "jstor.org",
        "cambridge.org",
        "academic.oup.com",
        "degruyter.com",
        "tandfonline.com",
        "link.springer.com",
        "journals.sagepub.com",
        "annualreviews.org",
        "oapen.org",
        "archive.org",
    ],
    "research_domains_literary": [
        "jstor.org",
        "muse.jhu.edu",
        "cambridge.org",
        "academic.oup.com",
        "degruyter.com",
        "tandfonline.com",
        "journals.sagepub.com",
        "brill.com",
        "openlibrary.org",
        "gutenberg.org",
        "archive.org",
        "hathitrust.org",
        "doaj.org",
        "oapen.org",
        *_REFERENCE,
    ],
    "research_domains_philosophy": [
        *_PHILOSOPHY,
        "jstor.org",
        "cambridge.org",
        "academic.oup.com",
        "link.springer.com",
        "degruyter.com",
        "brill.com",
        "tandfonline.com",
        "journals.sagepub.com",
        "press.princeton.edu",
        "mitpress.mit.edu",
    ],
    "research_domains_architecture": [
        *_ARCHITECTURAL_HISTORY,
        "jstor.org",
        "cambridge.org",
        "academic.oup.com",
        "degruyter.com",
        "tandfonline.com",
        "journals.sagepub.com",
        "link.springer.com",
        "oapen.org",
        "archive.org",
        *_REFERENCE,
    ],
    # ── Entscheidung: was ueberhaupt als Quelle zaehlt ───────────────────────
    "research_source_allowlist": list(_SCHOLARLY_ALLOWLIST),
    "research_source_denylist": list(_EXCLUDED),
}

_AXIS_TO_KEY: dict[str, str] = {
    "encyclopedic": "research_domains_encyclopedic",
    "literary": "research_domains_literary",
    "philosophy": "research_domains_philosophy",
    "architecture": "research_domains_architecture",
}

#: Jede Einstellung, die dieses Modul verwaltet. ``routers/admin.py`` entwertet
#: den Zwischenspeicher genau dann, wenn eine davon geschrieben wird — frueher
#: stand dort ein ``startswith("research_domains_")``, das die beiden neuen
#: Schluessel nicht getroffen haette und eine Aenderung bis zu fuenf Minuten
#: wirkungslos gelassen haette, ohne Fehlermeldung.
RESEARCH_SETTING_KEYS: frozenset[str] = frozenset(HARDCODED_DEFAULTS)


async def _load_all(admin_supabase: Client) -> None:
    """Load research domain settings from platform_settings."""
    global _cache, _cache_loaded_at  # noqa: PLW0603

    try:
        response = await (
            admin_supabase.table("platform_settings")
            .select("setting_key, setting_value")
            .in_("setting_key", sorted(RESEARCH_SETTING_KEYS))
            .execute()
        )
        new_cache: dict[str, list[str]] = {}
        for row in extract_list(response):
            key = row["setting_key"]
            if key not in HARDCODED_DEFAULTS:
                continue
            raw = row.get("setting_value", "")
            # Handle both pre-parsed list and JSON string return types
            if isinstance(raw, list):
                new_cache[key] = raw
            elif isinstance(raw, str):
                raw = raw.strip('"')
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, list):
                        new_cache[key] = parsed
                except (json.JSONDecodeError, TypeError):
                    pass
        _cache = new_cache
        _cache_loaded_at = time.monotonic()
        logger.info(
            "Research domain cache loaded",
            extra={"cached_keys": len(new_cache), "expected_keys": len(RESEARCH_SETTING_KEYS)},
        )
    except (PostgrestAPIError, httpx.HTTPError, json.JSONDecodeError, KeyError, TypeError):
        logger.warning("Failed to load research domain config from DB")
        _cache_loaded_at = time.monotonic()


def get_research_domains(axis: str) -> list[str]:
    """Return cached domain list for the given axis. Sync — reads from memory.

    Maps axis names to setting keys:
    - "encyclopedic" → research_domains_encyclopedic
    - "literary" → research_domains_literary
    - "philosophy" → research_domains_philosophy
    - "architecture" → research_domains_architecture
    """
    key = _AXIS_TO_KEY.get(axis, f"research_domains_{axis}")
    return _cache.get(key) or HARDCODED_DEFAULTS.get(key, [])


def get_source_allowlist() -> list[str]:
    """Die Domains, die als Quelle zaehlen. Vorgabe: die gelehrte Liste oben."""
    return _cache.get("research_source_allowlist") or HARDCODED_DEFAULTS["research_source_allowlist"]


def get_source_denylist() -> list[str]:
    """Die Domains, die nie als Quelle zaehlen — auch nicht ueber einen DOI."""
    return _cache.get("research_source_denylist") or HARDCODED_DEFAULTS["research_source_denylist"]


async def ensure_loaded(admin_supabase: Client) -> None:
    """Load cache if stale. Called at startup + after admin saves domain settings."""
    now = time.monotonic()
    if now - _cache_loaded_at > _CACHE_TTL or not _cache_loaded_at:
        await _load_all(admin_supabase)


def invalidate() -> None:
    """Clear cache — called when admin updates a research setting."""
    global _cache, _cache_loaded_at  # noqa: PLW0603
    _cache = {}
    _cache_loaded_at = 0.0
