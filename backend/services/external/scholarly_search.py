"""Fachrecherche: Quellen, deren *Bestand* die Schranke ist.

Tavily durchsucht das Netz und muss darum gesagt bekommen, was eine Quelle ist.
Die Dienste hier fuehren von vornherein nur Aufsaetze, Buecher und Buchkapitel;
sie brauchen keine Domainliste, weil ihr Katalog die Liste ist.

Sie loesen ausserdem ein zweites Problem. Phase 4 laesst heute ein Modell
"Autor, Titel, Jahr" aus dem Gedaechtnis nennen — der Kommentar in
``TavilySearchService.collect_sources`` haelt fest, wohin das fuehrt (in einem
Produktionslauf drei richtige Angaben und eine Foucault-Fehlzuschreibung:
richtiges Regal, falsches Buch, und strukturell unauffaellig). OpenAlex und
Crossref liefern Autor, Jahr, Zeitschrift und DOI als Feld. Eine Zuschreibung,
die aus einem Feld kommt, ist nachschlagbar; eine, die aus einem Modell kommt,
ist plausibel.

Anbieter
--------
``openalex``    250 Mio. Arbeiten, beste Rangfolge der drei, Fachfilter ueber
                ``primary_topic.field.id``. Braucht seit Feb. 2026 einen
                kostenlosen Schluessel (1 USD/Tag frei ≈ 1 000 Suchen).
``crossref``    150 Mio. DOI-Datensaetze, schluessellos. Rangfolge messbar
                schwaecher (traf bei "cartography power" eine Zeitschrift
                *namens* "Cartography"), deshalb Rueckfallebene, nicht Grundlage.
``openlibrary`` Buecher statt Aufsaetze — die Achse, auf der Belletristik und
                philosophische Monographien liegen. Schluessellos.

Warum kein DOAJ: gemessen am 2026-09-04 lieferte die Volltextsuche auf
"memory studies" als zweiten Treffer eine Arbeit ueber Drohnenfunk. Der Dienst
hat keine brauchbare Rangfolge; sein Bestand steckt ohnehin in OpenAlex.

Warum kein Semantic Scholar: ohne Schluessel HTTP 429 bereits bei der ersten
Anfrage.

Form
----
Dieselbe wie ``TavilySearchService``: achsenbeschriftete Anfragen, ein
``parallel_search`` mit Zeitlimit, Teilergebnisse bei Teilausfall, strukturierte
Protokollierung, sanfter Ausfall. Wer das eine gelesen hat, kennt das andere.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

from backend.config import settings
from backend.services.research_source_policy import SourceRow

logger = logging.getLogger(__name__)

__all__ = [
    "PROVIDER_NAMES",
    "ScholarlyRequest",
    "ScholarlyResult",
    "ScholarlySearchService",
]

#: Die Anbieternamen, wie sie in ``SourceRow.provider`` landen. Als Menge auch
#: das ``trusted_providers``-Argument von ``filter_sources``: fuer diese drei
#: ist der Katalog die Schranke, die Sperrliste gilt trotzdem.
PROVIDER_NAMES: frozenset[str] = frozenset({"openalex", "crossref", "openlibrary"})

#: Der hoefliche Pool von OpenAlex und Crossref will eine Kontaktadresse. Sie
#: identifiziert die ANWENDUNG, nicht eine Person — deshalb die Rollenadresse
#: der Plattform und nicht die des angemeldeten Nutzers.
_CONTACT = "bureau@metaverse.center"
_USER_AGENT = f"velgarien-forge/1.0 (+https://metaverse.center; mailto:{_CONTACT})"

#: OpenAlex-Fachgebiete, auf die die Suche beschraenkt wird:
#: 12 Arts and Humanities · 33 Social Sciences · 32 Psychology.
#: Gemessen am 2026-09-04: ohne diesen Filter lieferte "memory studies" als
#: zweiten Treffer "Prevalence of Dementia in the United States". Die Quelle war
#: wissenschaftlich, der Bezug nicht — genau der Fehler, den eine Gattungsgrenze
#: allein nicht faengt.
_OPENALEX_FIELDS = "primary_topic.field.id:fields/12|fields/33|fields/32"
_OPENALEX_TYPES = "type:article|book|book-chapter"

#: ``relevance_score`` ist bei OpenAlex NICHT ueber Anfragen hinweg vergleichbar
#: — gemessen 2 910 fuer "memory studies" gegen 324 fuer "island studies
#: imaginary geography", bei gleich brauchbaren Treffern. Eine absolute Schwelle
#: waere darum falsch. Verglichen wird gegen den Spitzenwert DERSELBEN Anfrage.
_RELEVANCE_FLOOR_RATIO = 0.25


@dataclass
class ScholarlyRequest:
    """Eine Fachanfrage auf einer Achse.

    ``providers`` laufen alle, ``fallback`` nur, wenn davon nichts kam. Die
    Trennung ist ausgeschrieben, weil sie sonst geraten werden muesste: eine
    Achse, die Aufsaetze UND Buecher will, nennt beide unter ``providers``;
    eine Achse, die Crossref nur haben will, falls OpenAlex ausfaellt, nennt es
    unter ``fallback``. Ohne die Trennung waere jede Rueckfallebene entweder
    ein zweiter Treffersatz oder gar keiner.
    """

    axis: str
    #: Die Suchbegriffe, EINZELN. Nicht als fertige Zeichenkette: OpenAlex will
    #: eine Wortfolge, Open Library will Schlagworte, und wer die Begriffe schon
    #: zusammengeklebt bekommt, kann das zweite nicht mehr bauen. Der Plan
    #: liefert Begriffe; die Anfrage baut jeder Anbieter selbst.
    terms: tuple[str, ...]
    providers: tuple[str, ...] = ("openalex", "openlibrary")
    fallback: str | None = "crossref"
    max_results: int = 4

    @property
    def query(self) -> str:
        """Die Begriffe als eine Wortfolge — was OpenAlex und Crossref wollen."""
        return " ".join(t.strip() for t in self.terms if t.strip())


@dataclass
class ScholarlyResult:
    """Was eine Achse an bibliographischen Zeilen erbracht hat."""

    axis: str
    rows: list[SourceRow] = field(default_factory=list)
    elapsed_ms: float = 0.0


def _reconstruct_abstract(inverted: dict[str, list[int]] | None, *, limit: int = 480) -> str:
    """Baut OpenAlex' invertierten Index zurueck in Fliesstext.

    OpenAlex speichert Kurzfassungen als ``{wort: [positionen]}`` — aus
    Lizenzgruenden, nicht aus Sparsamkeit. Ohne diese Umkehr traegt die Zeile
    nur einen Titel, und ein Titel allein sagt dem Modell zu wenig, um die
    Arbeit richtig einzuordnen.
    """
    if not inverted:
        return ""
    positions: list[tuple[int, str]] = []
    for word, spots in inverted.items():
        positions.extend((spot, word) for spot in spots)
    if not positions:
        return ""
    positions.sort()
    text = " ".join(word for _, word in positions)
    return text[:limit].rstrip()


class ScholarlySearchService:
    """Fachdatenbanken, parallel und mit Zeitlimit — dieselbe Form wie Tavily."""

    @staticmethod
    def is_available() -> bool:
        """Immer wahr: zwei der drei Anbieter brauchen keinen Schluessel.

        Ohne ``OPENALEX_API_KEY`` faellt nur die beste Rangfolge weg, nicht die
        Recherche. Das ist der Grund, warum diese Methode nichts prueft und
        trotzdem existiert: der Aufrufer soll dieselbe Frage stellen koennen
        wie bei Tavily, und hier lautet die Antwort eben immer ja.
        """
        return True

    # ── Anbieter ─────────────────────────────────────────────────────────────

    @staticmethod
    async def _openalex(client: httpx.AsyncClient, req: ScholarlyRequest) -> list[SourceRow]:
        params: dict[str, Any] = {
            "search": req.query,
            "per-page": req.max_results,
            "filter": f"{_OPENALEX_TYPES},{_OPENALEX_FIELDS}",
            "select": (
                "id,doi,title,publication_year,primary_location,authorships,relevance_score,abstract_inverted_index"
            ),
            "mailto": _CONTACT,
        }
        if settings.openalex_api_key:
            params["api_key"] = settings.openalex_api_key

        response = await client.get("https://api.openalex.org/works", params=params)
        if response.status_code != 200:
            # 401/403 = Schluessel fehlt oder ist abgelaufen, 409 = Tagesbudget
            # aufgebraucht, 429 = zu schnell. Alle vier bedeuten dasselbe fuer
            # den Aufrufer: dieser Anbieter traegt gerade nicht, Crossref schon.
            logger.warning(
                "OpenAlex unavailable",
                extra={
                    "status": response.status_code,
                    "axis": req.axis,
                    "has_key": bool(settings.openalex_api_key),
                },
            )
            raise httpx.HTTPStatusError(
                f"OpenAlex HTTP {response.status_code}", request=response.request, response=response
            )

        works = response.json().get("results") or []
        if not works:
            return []
        top = max((w.get("relevance_score") or 0.0) for w in works) or 1.0

        rows: list[SourceRow] = []
        for work in works:
            if (work.get("relevance_score") or 0.0) < top * _RELEVANCE_FLOOR_RATIO:
                continue
            location = work.get("primary_location") or {}
            source = location.get("source") or {}
            authors = [a["author"]["display_name"] for a in (work.get("authorships") or [])[:3] if a.get("author")]
            url = work.get("doi") or location.get("landing_page_url") or work.get("id") or ""
            if not url:
                continue
            rows.append(
                SourceRow(
                    axis=req.axis,
                    title=str(work.get("title") or "").strip(),
                    url=str(url),
                    provider="openalex",
                    authors=", ".join(authors),
                    year=str(work.get("publication_year") or ""),
                    venue=str(source.get("display_name") or ""),
                    abstract=_reconstruct_abstract(work.get("abstract_inverted_index")),
                )
            )
        return rows

    @staticmethod
    async def _crossref(client: httpx.AsyncClient, req: ScholarlyRequest) -> list[SourceRow]:
        response = await client.get(
            "https://api.crossref.org/works",
            params={
                "query.bibliographic": req.query,
                "rows": req.max_results,
                "filter": "type:journal-article,type:book-chapter,type:monograph",
                "select": "title,author,issued,container-title,DOI,type",
                "mailto": _CONTACT,
            },
        )
        response.raise_for_status()
        rows: list[SourceRow] = []
        for item in response.json()["message"].get("items") or []:
            doi = item.get("DOI")
            if not doi:
                continue
            authors = [
                " ".join(p for p in (a.get("given"), a.get("family")) if p) for a in (item.get("author") or [])[:3]
            ]
            issued = (item.get("issued") or {}).get("date-parts") or [[None]]
            rows.append(
                SourceRow(
                    axis=req.axis,
                    title=(item.get("title") or [""])[0].strip(),
                    url=f"https://doi.org/{doi}",
                    provider="crossref",
                    authors=", ".join(a for a in authors if a),
                    year=str(issued[0][0] or ""),
                    venue=(item.get("container-title") or [""])[0],
                )
            )
        return rows

    @staticmethod
    def _openlibrary_subject_query(terms: tuple[str, ...]) -> str:
        """Aus Suchbegriffen eine Schlagwortanfrage bauen.

        Open Library ist ein KATALOG, kein Aufsatzindex: seine Freitextsuche
        gewichtet Titel und Autor, nicht Thema. Gemessen am 2026-09-04 lieferte
        ``allegorical landscapes`` als Freitext "Landscape and dialogue" (1961)
        und einen Tagungsband; dieselbe Frage als ``subject:"allegory"`` lieferte
        Saramago, Bulgakov, Barker. ``subject:"memory" subject:"philosophy"``
        lieferte Bergson, Ricoeur, Sorabji.

        Schlagworte sind kurz. Ein sechs Wort langer Begriff trifft keines,
        darum werden nur die ersten drei Woerter je Begriff genommen und
        hoechstens zwei Begriffe verundet — mehr schneidet den Bestand auf null.
        """
        parts: list[str] = []
        for term in [t.strip() for t in terms if t.strip()][:2]:
            words = " ".join(term.split()[:3]).strip()
            if words:
                parts.append(f'subject:"{words}"')
        return " ".join(parts)

    @classmethod
    async def _openlibrary(cls, client: httpx.AsyncClient, req: ScholarlyRequest) -> list[SourceRow]:
        async def fetch(q: str) -> list[dict]:
            response = await client.get(
                "https://openlibrary.org/search.json",
                params={"q": q, "limit": req.max_results, "fields": "title,author_name,first_publish_year,key"},
            )
            response.raise_for_status()
            return response.json().get("docs") or []

        docs = await fetch(cls._openlibrary_subject_query(req.terms))
        if not docs:
            # Kein Schlagwort getroffen. Der Freitext ist schlechter, aber ein
            # schlechter Treffer schlaegt eine leere Achse — und die
            # Gattungsgrenze gilt fuer beide gleich.
            logger.info("Open Library subject search empty – falling back to free text", extra={"axis": req.axis})
            docs = await fetch(req.query)

        rows: list[SourceRow] = []
        for doc in docs:
            key = doc.get("key")
            if not key:
                continue
            rows.append(
                SourceRow(
                    axis=req.axis,
                    title=str(doc.get("title") or "").strip(),
                    url=f"https://openlibrary.org{key}",
                    provider="openlibrary",
                    authors=", ".join((doc.get("author_name") or [])[:3]),
                    year=str(doc.get("first_publish_year") or ""),
                    venue="",
                )
            )
        return rows

    # ── Ausfuehrung ──────────────────────────────────────────────────────────

    @classmethod
    async def _run_provider(cls, client: httpx.AsyncClient, req: ScholarlyRequest, provider: str) -> list[SourceRow]:
        handler = {
            "openalex": cls._openalex,
            "crossref": cls._crossref,
            "openlibrary": cls._openlibrary,
        }.get(provider)
        if handler is None:
            logger.warning("Unknown scholarly provider requested", extra={"provider": provider})
            return []
        return await handler(client, req)

    @classmethod
    async def search(
        cls,
        client: httpx.AsyncClient,
        req: ScholarlyRequest,
        *,
        timeout_s: float = 12.0,
    ) -> ScholarlyResult:
        """Eine Achse ueber ihre Anbieter, dann gegebenenfalls die Rueckfallebene.

        Faellt ``openalex`` aus (fehlender Schluessel, aufgebrauchtes
        Tagesbudget, 429), tritt ``crossref`` an seine Stelle — schluessellos
        und mit schwaecherer Rangfolge, aber demselben Bestand an DOIs.

        Die Bedingung ist "nichts gekommen", nicht "ein Anbieter hat geworfen".
        Eine Anfrage, die sauber mit null Treffern antwortet, ist fuer den
        Aufrufer dasselbe Ereignis wie eine, die scheitert: die Achse ist leer.
        Beide Male ist der Ersatz die richtige Antwort.
        """
        t0 = time.monotonic()
        rows: list[SourceRow] = []

        async def attempt(provider: str) -> list[SourceRow]:
            try:
                async with asyncio.timeout(timeout_s):
                    return await cls._run_provider(client, req, provider)
            except TimeoutError:
                logger.warning(
                    "Scholarly provider timed out",
                    extra={"provider": provider, "axis": req.axis, "timeout_s": timeout_s},
                )
            except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
                logger.warning(
                    "Scholarly provider failed",
                    extra={"provider": provider, "axis": req.axis, "error": str(exc)[:200]},
                )
            return []

        for provider in req.providers:
            rows.extend(await attempt(provider))
        if not rows and req.fallback:
            logger.info(
                "Scholarly fallback engaged",
                extra={"axis": req.axis, "failed": list(req.providers), "fallback": req.fallback},
            )
            rows.extend(await attempt(req.fallback))

        elapsed_ms = (time.monotonic() - t0) * 1000
        logger.info(
            "Scholarly search completed",
            extra={
                "axis": req.axis,
                "query_preview": req.query[:60],
                "row_count": len(rows),
                "elapsed_ms": round(elapsed_ms, 1),
            },
        )
        return ScholarlyResult(axis=req.axis, rows=rows, elapsed_ms=elapsed_ms)

    @classmethod
    async def parallel_search(
        cls,
        requests: list[ScholarlyRequest],
        *,
        timeout_s: float = 12.0,
    ) -> list[ScholarlyResult]:
        """Alle Achsen gleichzeitig; Teilergebnisse bei Teilausfall."""
        if not requests:
            return []
        async with httpx.AsyncClient(
            timeout=timeout_s + 2,
            headers={"User-Agent": _USER_AGENT},
            follow_redirects=True,
        ) as client:
            raw = await asyncio.gather(
                *(cls.search(client, req, timeout_s=timeout_s) for req in requests),
                return_exceptions=True,
            )

        results: list[ScholarlyResult] = []
        for i, item in enumerate(raw):
            if isinstance(item, ScholarlyResult):
                results.append(item)
            elif isinstance(item, BaseException):
                logger.warning(
                    "Scholarly axis raised",
                    extra={"axis": requests[i].axis, "error": str(item)[:200]},
                )
        return results

    # ── Darstellung ──────────────────────────────────────────────────────────

    @staticmethod
    def format_rows(axis: str, rows: list[SourceRow]) -> str:
        """Die Zeilen als achsenbeschrifteter Block fuer das Modell.

        Bewusst bibliographisch und knapp: Autor, Jahr, Titel, Ort. Das ist die
        Form, in der eine Zitation spaeter ueberprueft werden kann, und die
        Form, die das Modell nachahmen soll.
        """
        if not rows:
            return ""
        lines = []
        for row in rows:
            head = " · ".join(p for p in (row.authors, row.year) if p)
            tail = " · ".join(p for p in (row.venue, row.url) if p)
            entry = f"- {head + ': ' if head else ''}{row.title}\n  {tail}"
            if row.abstract:
                entry += f"\n  {row.abstract}"
            lines.append(entry)
        return f"[{axis}]\n" + "\n".join(lines)

    @classmethod
    def format_results(cls, results: list[ScholarlyResult]) -> str:
        """Mehrere Achsen als ein Block."""
        sections = [cls.format_rows(r.axis, r.rows) for r in results]
        return "\n\n".join(s for s in sections if s)
