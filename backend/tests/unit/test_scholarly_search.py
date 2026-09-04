"""Die Fachanbieter, und die drei Stellen, an denen sie leise falsch waeren.

1. Der Relevanzboden. ``relevance_score`` bei OpenAlex ist NICHT ueber Anfragen
   hinweg vergleichbar — gemessen 2 910 fuer "memory studies" gegen 324 fuer
   "island studies imaginary geography", bei gleich brauchbaren Treffern. Eine
   absolute Schwelle waere darum falsch; verglichen wird gegen den Spitzenwert
   derselben Anfrage.
2. Die Rueckfallebene. Sie greift bei "nichts gekommen", nicht bei "einer hat
   geworfen" — eine Suche, die sauber null Treffer meldet, ist fuer den
   Aufrufer dasselbe Ereignis wie eine, die scheitert.
3. Die Kurzfassung. OpenAlex liefert sie als invertierten Index; ohne die
   Umkehr traegt die Zeile nur einen Titel.

Dazu die Betriebsart bei Tavily, die den ganzen Umbau ausgeloest hat.
"""

import httpx
import pytest

from backend.services.external.scholarly_search import (
    ScholarlyRequest,
    ScholarlySearchService,
    _reconstruct_abstract,
)
from backend.services.external.tavily_search import TavilySearchRequest, TavilySearchResult, TavilySearchService
from backend.services.research_source_policy import SourceRow


def _openalex_payload(scores: list[float]) -> dict:
    return {
        "results": [
            {
                "id": f"https://openalex.org/W{i}",
                "doi": f"https://doi.org/10.1000/{i}",
                "title": f"Work {i}",
                "publication_year": 2000 + i,
                "relevance_score": score,
                "primary_location": {"source": {"display_name": "History and Theory"}},
                "authorships": [{"author": {"display_name": f"Author {i}"}}],
                "abstract_inverted_index": {"Ein": [0], "Satz": [1]},
            }
            for i, score in enumerate(scores)
        ]
    }


def _client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="https://test")


class TestAbstractReconstruction:
    def test_positions_decide_the_order(self):
        inverted = {"world": [1], "hello": [0], "again": [2]}
        assert _reconstruct_abstract(inverted) == "hello world again"

    def test_a_word_at_several_positions_appears_at_each(self):
        assert _reconstruct_abstract({"a": [0, 2], "b": [1]}) == "a b a"

    @pytest.mark.parametrize("value", [None, {}])
    def test_nothing_in_nothing_out(self, value):
        assert _reconstruct_abstract(value) == ""

    def test_it_is_cut_not_truncated_mid_padding(self):
        assert _reconstruct_abstract({"x" * 600: [0]}, limit=10) == "x" * 10


class TestOpenAlexRelevanceFloor:
    @pytest.mark.asyncio
    async def test_a_weak_hit_next_to_a_strong_one_is_dropped(self):
        # 2 910 / 120 ist das gemessene Verhaeltnis zwischen dem passenden und
        # dem thematisch abgedrifteten Treffer derselben Anfrage.
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json=_openalex_payload([2910.0, 2400.0, 120.0]))

        async with _client(handler) as client:
            rows = await ScholarlySearchService._openalex(client, ScholarlyRequest(axis="A", terms=("q",)))

        assert [r.title for r in rows] == ["Work 0", "Work 1"]

    @pytest.mark.asyncio
    async def test_a_low_scoring_query_keeps_its_own_hits(self):
        # Dieselben Zahlen absolut viel kleiner — und trotzdem brauchbar. Eine
        # feste Schwelle haette hier alles verworfen.
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json=_openalex_payload([324.0, 308.0, 281.0]))

        async with _client(handler) as client:
            rows = await ScholarlySearchService._openalex(client, ScholarlyRequest(axis="A", terms=("q",)))

        assert len(rows) == 3

    @pytest.mark.asyncio
    async def test_it_carries_the_bibliography_not_just_a_title(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json=_openalex_payload([100.0]))

        async with _client(handler) as client:
            row = (await ScholarlySearchService._openalex(client, ScholarlyRequest(axis="A", terms=("q",))))[0]

        assert (row.authors, row.year, row.venue) == ("Author 0", "2000", "History and Theory")
        assert row.url == "https://doi.org/10.1000/0"
        assert row.abstract == "Ein Satz"
        # Die Kurzfassung geht an das Modell und wird NICHT gespeichert.
        assert "abstract" not in row.as_dict()


class TestFallback:
    @pytest.mark.asyncio
    async def test_crossref_steps_in_when_openalex_returns_nothing(self):
        # Kein Fehler, keine Ausnahme — nur eine leere Antwort. Genau der Fall,
        # den eine Rueckfallebene an "hat geworfen" vorbeirutschen laesst.
        def handler(request: httpx.Request) -> httpx.Response:
            if "openalex" in str(request.url):
                return httpx.Response(200, json={"results": []})
            return httpx.Response(
                200,
                json={
                    "message": {
                        "items": [
                            {
                                "DOI": "10.1000/x",
                                "title": ["Crossref Work"],
                                "author": [{"given": "A", "family": "B"}],
                                "issued": {"date-parts": [[1999]]},
                                "container-title": ["Some Journal"],
                            }
                        ]
                    }
                },
            )

        async with _client(handler) as client:
            result = await ScholarlySearchService.search(
                client, ScholarlyRequest(axis="A", terms=("q",), providers=("openalex",))
            )

        assert [r.provider for r in result.rows] == ["crossref"]
        assert result.rows[0].url == "https://doi.org/10.1000/x"

    @pytest.mark.asyncio
    async def test_the_fallback_stays_unused_when_the_primary_carries(self):
        calls: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            calls.append(str(request.url.host))
            return httpx.Response(200, json=_openalex_payload([100.0]))

        async with _client(handler) as client:
            result = await ScholarlySearchService.search(
                client, ScholarlyRequest(axis="A", terms=("q",), providers=("openalex",))
            )

        assert len(result.rows) == 1
        assert calls == ["api.openalex.org"]

    @pytest.mark.asyncio
    async def test_an_axis_can_refuse_a_fallback_that_would_miss_it(self):
        # Crossref fuehrt keine Belletristik. Auf der literarischen Achse waere
        # es ein Ersatz, der die Frage verfehlt — also gar keiner.
        calls: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            calls.append(str(request.url.host))
            return httpx.Response(200, json={"docs": []})

        async with _client(handler) as client:
            result = await ScholarlySearchService.search(
                client,
                ScholarlyRequest(axis="A", terms=("q",), providers=("openlibrary",), fallback=None),
            )

        assert result.rows == []
        # Zwei Aufrufe, beide an Open Library: Schlagwort, dann Freitext. Kein
        # dritter - die Rueckfallebene ist ausgeschaltet.
        assert calls == ["openlibrary.org", "openlibrary.org"]

    @pytest.mark.asyncio
    async def test_an_http_error_from_openalex_is_not_the_end_of_the_axis(self):
        def handler(request: httpx.Request) -> httpx.Response:
            if "openalex" in str(request.url):
                return httpx.Response(409, json={"error": "daily budget exhausted"})
            return httpx.Response(200, json={"message": {"items": []}})

        async with _client(handler) as client:
            result = await ScholarlySearchService.search(
                client, ScholarlyRequest(axis="A", terms=("q",), providers=("openalex",))
            )

        assert result.rows == []  # beide leer, aber kein Absturz


class TestTavilyGate:
    def test_the_mode_rides_along_whenever_a_list_does(self):
        from backend.services.external.tavily_search import _domains_mode

        with_list = TavilySearchRequest(axis="A", query="q", include_domains=["jstor.org"])
        assert _domains_mode(with_list) == {"include_domains_mode": "filter"}

    def test_no_list_no_mode(self):
        # ``include_domains_mode`` ohne ``include_domains`` ist ein Parameter
        # ohne Gegenstand — und einer, den der Client 0.7.27 nur ueber
        # ``**kwargs`` durchreicht. Ihn nur zu senden, wenn er wirkt, haelt
        # einen kuenftigen Signaturbruch klein.
        from backend.services.external.tavily_search import _domains_mode

        assert _domains_mode(TavilySearchRequest(axis="A", query="q")) == {}

    def test_to_rows_carries_the_snippet_into_abstract_not_into_storage(self):
        result = TavilySearchResult(
            axis="AXIS",
            answer="",
            sources=[{"url": "https://jstor.org/stable/1", "title": "T", "content": "C" * 900}],
            elapsed_ms=1.0,
        )
        rows = TavilySearchService.to_rows([result], snippet_len=100)
        assert isinstance(rows[0], SourceRow)
        assert rows[0].provider == "tavily"
        assert len(rows[0].abstract) == 100
        assert "abstract" not in rows[0].as_dict()

    def test_a_source_without_a_url_is_not_a_source(self):
        result = TavilySearchResult(axis="A", answer="", sources=[{"title": "kein Verweis"}], elapsed_ms=1.0)
        assert TavilySearchService.to_rows([result]) == []


class TestOpenLibrarySubjectQuery:
    """Open Library ist ein KATALOG, kein Aufsatzindex.

    Seine Freitextsuche gewichtet Titel und Autor, nicht Thema. Gemessen am
    2026-09-04 lieferte ``allegorical landscapes`` als Freitext "Landscape and
    dialogue" (1961) und einen Tagungsband; ``subject:"allegory"`` lieferte
    Saramago, Bulgakov, Barker, und ``subject:"memory" subject:"philosophy"``
    lieferte Bergson, Ricoeur, Sorabji.
    """

    def test_terms_become_subjects(self):
        assert (
            ScholarlySearchService._openlibrary_subject_query(("collective memory", "island studies"))
            == 'subject:"collective memory" subject:"island studies"'
        )

    def test_a_long_term_is_cut_to_three_words(self):
        # Ein Schlagwort ist kurz. Sechs Woerter treffen keines.
        assert (
            ScholarlySearchService._openlibrary_subject_query(("collective memory and forgetting studies",))
            == 'subject:"collective memory and"'
        )

    def test_at_most_two_terms_are_anded(self):
        # Drei verundete Schlagworte schneiden den Bestand auf null.
        assert ScholarlySearchService._openlibrary_subject_query(("a", "b", "c")) == 'subject:"a" subject:"b"'

    @pytest.mark.asyncio
    async def test_free_text_takes_over_when_no_subject_matches(self):
        # Ein schlechter Treffer schlaegt eine leere Achse - und die
        # Gattungsgrenze gilt fuer beide Anfragen gleich.
        queries: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            q = request.url.params.get("q", "")
            queries.append(q)
            if q.startswith("subject:"):
                return httpx.Response(200, json={"docs": []})
            return httpx.Response(
                200,
                json={"docs": [{"key": "/works/OL1W", "title": "Fallback", "first_publish_year": 1900}]},
            )

        async with _client(handler) as client:
            rows = await ScholarlySearchService._openlibrary(
                client, ScholarlyRequest(axis="A", terms=("nothing matches this",))
            )

        assert [r.title for r in rows] == ["Fallback"]
        assert queries == ['subject:"nothing matches this"', "nothing matches this"]
