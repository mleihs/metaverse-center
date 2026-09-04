"""Die Gattungsgrenze der Schmiede-Recherche: was als Quelle zaehlt.

Die Recherche der Schmiede belegt Weltenbau mit drei Gattungen — belletristische
und literaturkritische Werke, philosophische Schriften, begutachtete
Fachliteratur. Dieses Modul ist die Stelle, an der das entschieden wird, und die
einzige: jede Quellzeile jedes Anbieters laeuft durch ``is_admissible``.

Warum es das Modul ueberhaupt braucht
-------------------------------------
Die vier Domainlisten in ``platform_research_domains`` sahen seit Migration 124
wie eine Schranke aus. Sie waren keine. Tavily kennt zu ``include_domains`` zwei
Betriebsarten — ``filter`` (schliesst aus) und ``boost`` (gewichtet nur) — und
ohne ``include_domains_mode`` gilt in der Praxis die zweite. Gemessen am
2026-09-04 mit identischer Anfrage und identischer Liste
(``en.wikipedia.org``, ``plato.stanford.edu``, ``britannica.com``):

* ohne ``include_domains_mode``: **2 von 5** Treffern aus der Liste, darunter
  ``facebook.com``;
* mit ``include_domains_mode="filter"``: **5 von 5**.

``TavilySearchService`` setzt den Parameter jetzt. Dieses Modul ist das zweite
Bein: eine Schranke, die nur im fremden Dienst steht, meldet ihren Ausfall
nicht. Aendert Tavily seinen Vorgabewert erneut, faellt hier auf, was durchkam —
und zwar bevor es das Modell liest.

Die zwei Beine treffen verschiedene Mengen. Tavily filtert *vor* der Suche und
verliert dadurch Treffer, die es haette liefern koennen; diese Liste filtert
*nach* der Lieferung und sieht daher auch, was ueber die schlusselfreien
Fachanbieter hereinkommt (OpenAlex, Crossref, Open Library), an denen Tavily
nicht beteiligt ist.

Sperrliste vor Freiliste
------------------------
``is_admissible`` prueft erst die Sperrliste, dann die Freiliste. Ein Eintrag,
der in beiden steht, ist gesperrt. Das ist die sichere Richtung: wer eine
Domain sperrt, will sie los, auch wenn sie irgendwo als erlaubt gefuehrt wird.

Hostvergleich mit Punktgrenze
-----------------------------
Verglichen wird ``h == d or h.endswith("." + d)`` — nie ``d in h``. Ohne den
Punkt liesse ``jstor.org`` den Host ``nicht-jstor.org.beispiel.test`` durch, und
eine Freiliste, die man umgehen kann, indem man ihren Eintrag in den eigenen
Namen aufnimmt, ist keine.

Was hier NICHT steht
--------------------
Kein Zwischenspeicher, keine Datenbank, kein Netz. Die Listen kommen aus
``platform_research_domains`` (dieselbe Ablage, derselbe TTL, dieselbe
Entwertung durch den Admin). Dieses Modul ist reine Logik und darum ohne
Vorbereitung testbar.

Siehe ``docs/plans/forge-scholarly-sources.md``.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from urllib.parse import parse_qs, urlparse

logger = logging.getLogger(__name__)

__all__ = [
    "FilterOutcome",
    "SourceRow",
    "admissible_domains",
    "excluded_domains",
    "filter_sources",
    "is_admissible",
    "is_listing",
    "normalize_host",
]

# Nur diese Schemata koennen eine Quelle sein. ``data:`` und ``javascript:``
# haben keinen Host, ``ftp:`` keinen Beleg.
_ALLOWED_SCHEMES = frozenset({"http", "https"})

# Eine Trefferliste ist keine Quelle. Gemessen am 2026-09-04 kam
# ``philarchive.org/s/epistemology%20of%20memory`` als Beleg durch — die
# Suchmaschine hatte die Suchseite einer anderen Suchmaschine gefunden. Der
# Host ist zugelassen und der Inhalt trotzdem kein Werk: er hat keinen Autor,
# kein Jahr und morgen andere Eintraege. Geprueft wird der Pfadanfang, nicht
# das Vorkommen irgendwo — ``/entries/search-engines`` bleibt ein Artikel.
_LISTING_PATH_PREFIXES = ("/search", "/s/", "/browse", "/find", "/results", "/tag/", "/tags/", "/category/")
_LISTING_QUERY_KEYS = frozenset({"q", "query", "search", "searchterm", "s"})


@dataclass(frozen=True, slots=True)
class SourceRow:
    """Eine Quellzeile, wie sie unter der Ankerkarte erscheint.

    ``axis`` ist die Achse, unter der sie gefunden wurde, ``provider`` der
    Dienst, der sie geliefert hat. Die uebrigen Felder sind bibliographisch und
    duerfen leer sein — Tavily kennt weder Autor noch Jahr, OpenAlex beides.
    Kein Modell fasst diese Zeilen an; das ist ihr Zweck.
    """

    axis: str
    title: str
    url: str
    provider: str = ""
    authors: str = ""
    year: str = ""
    venue: str = ""
    #: Die Kurzfassung, wenn der Anbieter eine fuehrt. Sie geht an das Modell
    #: und wird NICHT gespeichert: unter der Ankerkarte steht ein Verweis, den
    #: man aufschlaegt, keine zweite Zusammenfassung. Das haelt
    #: ``research_context`` klein — bei einem Dutzend Quellen waeren es sonst
    #: mehrere Kilobyte je Entwurf, fuer Text, den niemand dort liest.
    abstract: str = ""

    def as_dict(self) -> dict[str, str]:
        """Die Form, die in ``forge_drafts.research_context.sources`` landet."""
        return {
            "axis": self.axis,
            "title": self.title,
            "url": self.url,
            "provider": self.provider,
            "authors": self.authors,
            "year": self.year,
            "venue": self.venue,
        }


@dataclass(frozen=True, slots=True)
class FilterOutcome:
    """Was der Filter durchgelassen hat — und was nicht.

    ``rejected`` wird nicht weggeworfen. Eine Schranke, die nur zaehlt, was sie
    durchlaesst, kann nicht zwischen "sauberer Lauf" und "alles abgewiesen"
    unterscheiden, und beide sehen von aussen gleich aus: eine kurze Liste.
    Der Aufrufer protokolliert die Zahl, damit ein Lauf mit null zugelassenen
    Quellen als Ereignis sichtbar wird und nicht als Stille.
    """

    kept: list[SourceRow]
    rejected: list[SourceRow]

    @property
    def rejected_hosts(self) -> list[str]:
        """Die abgewiesenen Hosts, fuer die Protokollzeile."""
        return sorted({normalize_host(row.url) for row in self.rejected if normalize_host(row.url)})


def normalize_host(url: str) -> str:
    """Der vergleichbare Host einer URL, oder ``""`` wenn es keinen gibt.

    Kleinschreibung, ohne abschliessenden Punkt (``example.com.`` ist derselbe
    Host wie ``example.com``), ohne fuehrendes ``www.``. Ein fremdes Schema,
    eine unparsbare URL oder ein fehlender Host geben ``""`` — und ``""`` ist
    nirgends zugelassen, faellt also raus.
    """
    try:
        parsed = urlparse(url.strip())
    except ValueError:
        return ""
    if parsed.scheme.lower() not in _ALLOWED_SCHEMES:
        return ""
    host = (parsed.hostname or "").strip().lower().rstrip(".")
    return host.removeprefix("www.")


def _matches(host: str, domains: tuple[str, ...]) -> bool:
    """Ob ``host`` die Domain selbst oder eine Unterdomain davon ist."""
    return any(host == d or host.endswith(f".{d}") for d in domains)


def is_listing(url: str) -> bool:
    """Ob ``url`` auf eine Trefferliste zeigt statt auf ein Werk."""
    try:
        parsed = urlparse(url.strip())
    except ValueError:
        return False
    path = (parsed.path or "/").lower()
    if path.startswith(_LISTING_PATH_PREFIXES):
        return True
    return bool(_LISTING_QUERY_KEYS & {k.lower() for k in parse_qs(parsed.query)})


def admissible_domains() -> tuple[str, ...]:
    """Die Freiliste, normalisiert. Import lokal — sonst Ringschluss."""
    from backend.services.platform_research_domains import get_source_allowlist

    return tuple(sorted({normalize_host(f"https://{d}") or d.strip().lower() for d in get_source_allowlist() if d}))


def excluded_domains() -> tuple[str, ...]:
    """Die Sperrliste, normalisiert."""
    from backend.services.platform_research_domains import get_source_denylist

    return tuple(sorted({normalize_host(f"https://{d}") or d.strip().lower() for d in get_source_denylist() if d}))


def is_admissible(url: str, *, trusted_provider: bool = False) -> bool:
    """Ob ``url`` als Quelle zaehlt.

    ``trusted_provider`` gilt fuer Fachanbieter, deren *Bestand* die Schranke
    ist: OpenAlex, Crossref und Open Library fuehren nur Aufsaetze, Buecher und
    Buchkapitel, und ihre Verweise zeigen auf beliebig viele Verlagshosts, die
    keine Freiliste je vollstaendig kennt. Die Sperrliste gilt trotzdem — ein
    DOI, der auf ein Fanwiki zeigt, ist kein Beleg, egal wer ihn gemeldet hat.
    """
    host = normalize_host(url)
    if not host:
        return False
    if _matches(host, excluded_domains()):
        return False
    if is_listing(url):
        return False
    if trusted_provider:
        return True
    return _matches(host, admissible_domains())


def filter_sources(rows: list[SourceRow], *, trusted_providers: frozenset[str] = frozenset()) -> FilterOutcome:
    """Trennt zugelassene von abgewiesenen Zeilen und entdoppelt nach URL.

    Die erste Zeile zu einer URL gewinnt, also die der zuerst uebergebenen
    Achse. Das ist dieselbe Regel wie in ``TavilySearchService.collect_sources``
    und aus demselben Grund: die Achse ist die Frage, unter der die Quelle
    gefunden wurde, und die erste Frage ist die, die sie gestellt hat.
    """
    seen: set[str] = set()
    seen_works: set[str] = set()
    kept: list[SourceRow] = []
    rejected: list[SourceRow] = []
    for row in rows:
        url = row.url.strip()
        if not url or url in seen:
            continue
        seen.add(url)
        trusted = row.provider in trusted_providers
        if not is_admissible(url, trusted_provider=trusted):
            rejected.append(row)
            continue
        # Dieselbe Arbeit unter zwei Verweisen ist eine Quelle, nicht zwei.
        # Gemessen am 2026-09-04 stand Frise, "Forgetting" zweimal in der Liste
        # — einmal von PhilPapers, einmal von PhilArchive, mit verschiedenen
        # URLs. Der Titel allein waere ein zu grober Schluessel (zwei Werke
        # duerfen gleich heissen), Titel UND Jahr ist einer, der traegt. Fehlt
        # das Jahr, wird nicht zusammengelegt: raten ist hier teurer als
        # doppelt anzeigen.
        work = _work_key(row)
        if work:
            if work in seen_works:
                continue
            seen_works.add(work)
        kept.append(row)
    return FilterOutcome(kept=kept, rejected=rejected)


def _work_key(row: SourceRow) -> str:
    """Titel und Jahr, vergleichbar gemacht — oder ``""``, wenn eines fehlt."""
    title = " ".join(row.title.split()).strip().lower()
    year = row.year.strip()
    return f"{title}|{year}" if title and year else ""
