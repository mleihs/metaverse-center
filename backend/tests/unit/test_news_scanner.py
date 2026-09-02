"""Tests for Substrate Scanner pipeline stages.

Covers:
1. pre_filter — keyword reject/boost for scan results
2. deduplicator — title similarity (Jaccard), keyword extraction
3. classifier — JSON extraction from LLM output, significance→magnitude mapping
4. registry — adapter registration and lookup
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from backend.services.scanning.base_adapter import ScanResult

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_result(
    title: str,
    source_name: str = "test",
    source_id: str | None = None,
    source_category: str | None = None,
    magnitude: float | None = None,
    is_structured: bool = False,
) -> ScanResult:
    return ScanResult(
        source_id=source_id or f"id_{title[:10]}",
        source_name=source_name,
        title=title,
        source_category=source_category,
        magnitude=magnitude,
        is_structured=is_structured,
    )


# ---------------------------------------------------------------------------
# Pre-filter
# ---------------------------------------------------------------------------

class TestPreFilter:
    """Unit tests for keyword-based pre-filter."""

    def test_rejects_celebrity_gossip(self):
        from backend.services.scanning.pre_filter import pre_filter

        results = [_make_result("Kim Kardashian spotted at fashion week")]
        assert pre_filter(results) == []

    def test_rejects_sports(self):
        from backend.services.scanning.pre_filter import pre_filter

        results = [_make_result("Champions League quarter-finals draw")]
        assert pre_filter(results) == []

    def test_keeps_earthquake_headline(self):
        from backend.services.scanning.pre_filter import pre_filter

        results = [_make_result("Massive earthquake strikes central Turkey")]
        filtered = pre_filter(results)
        assert len(filtered) == 1
        assert filtered[0].title == "Massive earthquake strikes central Turkey"

    def test_keeps_generic_news(self):
        from backend.services.scanning.pre_filter import pre_filter

        results = [_make_result("New trade agreement signed between nations")]
        filtered = pre_filter(results)
        assert len(filtered) == 1

    def test_structured_always_pass(self):
        from backend.services.scanning.pre_filter import pre_filter

        # Even a celebrity headline passes if structured
        results = [_make_result(
            "Celebrity gossip roundup",
            is_structured=True,
            source_category="natural_disaster",
        )]
        filtered = pre_filter(results)
        assert len(filtered) == 1

    def test_reject_takes_priority_for_unstructured(self):
        from backend.services.scanning.pre_filter import pre_filter

        results = [_make_result("Movie review: war documentary")]
        filtered = pre_filter(results)
        # "movie review" is in reject patterns
        assert len(filtered) == 0

    def test_empty_list(self):
        from backend.services.scanning.pre_filter import pre_filter

        assert pre_filter([]) == []

    def test_mixed_batch(self):
        from backend.services.scanning.pre_filter import pre_filter

        results = [
            _make_result("Celebrity dating rumors"),  # reject
            _make_result("Tsunami warning issued for Pacific coast"),  # keep
            _make_result("Premier League results"),  # reject
            _make_result("Military conflict escalates in border region"),  # keep
            _make_result(
                "M 6.5 Earthquake",
                is_structured=True,
                source_category="natural_disaster",
            ),  # structured: keep
        ]
        filtered = pre_filter(results)
        assert len(filtered) == 3
        titles = {r.title for r in filtered}
        assert "Tsunami warning issued for Pacific coast" in titles
        assert "Military conflict escalates in border region" in titles
        assert "M 6.5 Earthquake" in titles


# ---------------------------------------------------------------------------
# Deduplicator — title similarity (pure functions, no DB)
# ---------------------------------------------------------------------------

class TestTitleSimilarity:
    """Tests for Jaccard title similarity helpers."""

    def test_identical_titles(self):
        from backend.services.scanning.deduplicator import _title_similarity

        assert _title_similarity(
            "Major earthquake strikes Turkey",
            "Major earthquake strikes Turkey",
        ) == 1.0

    def test_completely_different(self):
        from backend.services.scanning.deduplicator import _title_similarity

        sim = _title_similarity(
            "Earthquake strikes Turkey",
            "New vaccine approved by regulators",
        )
        assert sim < 0.2

    def test_similar_but_rephrased(self):
        from backend.services.scanning.deduplicator import _title_similarity

        sim = _title_similarity(
            "M 7.2 earthquake strikes central Turkey killing hundreds",
            "Turkey earthquake kills hundreds magnitude 7.2 central region",
        )
        assert sim >= 0.4  # Shares core keywords despite different phrasing

    def test_empty_title(self):
        from backend.services.scanning.deduplicator import _title_similarity

        assert _title_similarity("", "Something") == 0.0
        assert _title_similarity("Something", "") == 0.0

    def test_stop_words_ignored(self):
        from backend.services.scanning.deduplicator import _title_keywords

        keywords = _title_keywords("The earthquake was very devastating")
        assert "the" not in keywords
        assert "was" not in keywords
        assert "very" not in keywords
        assert "earthquake" in keywords
        assert "devastating" in keywords

    def test_threshold_boundary(self):
        from backend.services.scanning.deduplicator import _title_similarity

        # Same core keywords, different phrasing
        sim = _title_similarity(
            "Hurricane devastates Florida coastal areas",
            "Florida hurricane devastates coastal communities",
        )
        # Should be near or above threshold (both share hurricane, devastates, florida, coastal)
        assert sim > 0.5


# ---------------------------------------------------------------------------
# Classifier — JSON extraction
# ---------------------------------------------------------------------------

class TestClassifierJsonExtraction:
    """Tests for _parse_json_from_text."""

    def test_plain_json(self):
        from backend.services.scanning.classifier import _parse_json_from_text

        result = _parse_json_from_text(
            '[{"index": 0, "category": "pandemic", "significance": 7, "reason": "test"}]'
        )
        assert isinstance(result, list)
        assert result[0]["category"] == "pandemic"

    def test_markdown_fenced_json(self):
        from backend.services.scanning.classifier import _parse_json_from_text

        result = _parse_json_from_text(
            '```json\n[{"index": 0, "category": "natural_disaster", "significance": 9}]\n```'
        )
        assert isinstance(result, list)
        assert result[0]["category"] == "natural_disaster"

    def test_json_with_surrounding_text(self):
        from backend.services.scanning.classifier import _parse_json_from_text

        result = _parse_json_from_text(
            'Here are the results:\n[{"index": 0, "category": "military_conflict", "significance": 6}]\nDone.'
        )
        assert isinstance(result, list)
        assert result[0]["category"] == "military_conflict"

    def test_invalid_json_returns_none(self):
        from backend.services.scanning.classifier import _parse_json_from_text

        assert _parse_json_from_text("not json at all") is None

    def test_empty_string(self):
        from backend.services.scanning.classifier import _parse_json_from_text

        assert _parse_json_from_text("") is None

    def test_code_fence_without_json_label(self):
        from backend.services.scanning.classifier import _parse_json_from_text

        result = _parse_json_from_text(
            '```\n[{"index": 0, "category": "tech_breakthrough", "significance": 5}]\n```'
        )
        assert isinstance(result, list)
        assert result[0]["significance"] == 5


class TestSignificanceMapping:
    """Tests for significance → magnitude mapping."""

    def test_all_significance_levels(self):
        from backend.services.scanning.classifier import _SIGNIFICANCE_TO_MAGNITUDE

        assert _SIGNIFICANCE_TO_MAGNITUDE[1] == 0.10
        assert _SIGNIFICANCE_TO_MAGNITUDE[5] == 0.50
        assert _SIGNIFICANCE_TO_MAGNITUDE[10] == 1.00

    def test_mapping_completeness(self):
        from backend.services.scanning.classifier import _SIGNIFICANCE_TO_MAGNITUDE

        assert set(_SIGNIFICANCE_TO_MAGNITUDE.keys()) == set(range(1, 11))

    def test_valid_categories(self):
        from backend.services.scanning.classifier import VALID_CATEGORIES

        expected = {
            "economic_crisis", "military_conflict", "pandemic",
            "natural_disaster", "political_upheaval", "tech_breakthrough",
            "cultural_shift", "environmental_disaster",
        }
        assert VALID_CATEGORIES == expected


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

class TestRegistry:
    """Tests for adapter registry."""

    def test_all_adapters_registered(self):
        # Import triggers registration
        import backend.services.scanning.adapters  # noqa: F401
        from backend.services.scanning.registry import get_adapter_names

        names = get_adapter_names()
        expected = {
            "usgs_earthquakes", "noaa_alerts", "nasa_eonet", "gdacs",
            "disease_sh", "who_outbreaks", "guardian", "newsapi",
            "gdelt", "hackernews",
            # Bluesky (02.09.2026): der Gegenweg zur Kreuzveroeffentlichung.
            # Nur verlinkte Artikel werden zu Signalen, siehe
            # `adapters/bluesky_social.py`.
            "bluesky",
        }
        assert set(names) == expected

    def test_get_adapter_returns_instance(self):
        import backend.services.scanning.adapters  # noqa: F401
        from backend.services.scanning.registry import get_adapter

        adapter = get_adapter("usgs_earthquakes")
        assert adapter.name == "usgs_earthquakes"
        assert adapter.is_structured is True
        assert adapter.requires_api_key is False

    def test_get_unknown_adapter_raises(self):
        from backend.services.scanning.registry import get_adapter

        with pytest.raises(KeyError, match="Unknown adapter"):
            get_adapter("nonexistent_source")

    def test_adapter_info_structure(self):
        import backend.services.scanning.adapters  # noqa: F401
        from backend.services.scanning.registry import get_adapter_info

        info = get_adapter_info()
        # Die ZAHL steht schon in `test_all_adapters_registered` und gehoert
        # nicht zweimal ins Repository: eine zweite Stelle bricht bei jedem
        # neuen Adapter, ohne etwas zu pruefen, was die erste nicht schon
        # prueft. Hier zaehlt nur, dass die Metadaten zu den Namen passen.
        from backend.services.scanning.registry import get_adapter_names

        assert len(info) == len(get_adapter_names())

        for entry in info:
            assert "name" in entry
            assert "display_name" in entry
            assert "categories" in entry
            assert "is_structured" in entry
            assert "requires_api_key" in entry
            assert "default_interval" in entry
            assert isinstance(entry["categories"], list)
            assert isinstance(entry["default_interval"], int)

    def test_structured_adapters_identified(self):
        import backend.services.scanning.adapters  # noqa: F401
        from backend.services.scanning.registry import get_adapter_info

        info = get_adapter_info()
        structured = {e["name"] for e in info if e["is_structured"]}
        expected_structured = {"usgs_earthquakes", "noaa_alerts", "nasa_eonet", "gdacs", "disease_sh"}
        assert structured == expected_structured

    def test_api_key_adapters(self):
        import backend.services.scanning.adapters  # noqa: F401
        from backend.services.scanning.registry import get_adapter_info

        info = get_adapter_info()
        needs_key = {e["name"] for e in info if e["requires_api_key"]}
        assert "guardian" in needs_key
        assert "newsapi" in needs_key
        assert "usgs_earthquakes" not in needs_key


# ---------------------------------------------------------------------------
# ScanResult dataclass
# ---------------------------------------------------------------------------

class TestScanResult:
    """Tests for ScanResult dataclass."""

    def test_defaults(self):
        r = ScanResult(source_id="abc", source_name="test", title="Test Event")
        assert r.url is None
        assert r.description is None
        assert r.source_category is None
        assert r.magnitude is None
        assert r.is_structured is False
        assert r.raw_data == {}

    def test_structured_result(self):
        r = ScanResult(
            source_id="eq123",
            source_name="usgs_earthquakes",
            title="M 7.2 - Turkey",
            source_category="natural_disaster",
            magnitude=0.85,
            is_structured=True,
        )
        assert r.is_structured is True
        assert r.source_category == "natural_disaster"
        assert r.magnitude == 0.85


# ---------------------------------------------------------------------------
# External news errors — the upstream status must survive the raise
# ---------------------------------------------------------------------------

class TestExternalNewsError:
    """A provider that refuses our key is not a provider that is unwell.

    Both news clients used to raise a bare ``Exception`` carrying a formatted
    string and nothing else, which is why a 401 and a 503 were indistinguish-
    able to every caller. These tests pin the distinction.
    """

    def test_guardian_error_is_an_external_news_error(self):
        from backend.services.external.guardian import GuardianError
        from backend.services.external.news_errors import ExternalNewsError

        assert issubclass(GuardianError, ExternalNewsError)

    def test_newsapi_error_is_an_external_news_error(self):
        from backend.services.external.news_errors import ExternalNewsError
        from backend.services.external.newsapi import NewsAPIError

        assert issubclass(NewsAPIError, ExternalNewsError)

    def test_401_is_an_auth_failure(self):
        from backend.services.external.guardian import GuardianError

        exc = GuardianError("Guardian API error 401: Unauthorized", status_code=401)
        assert exc.is_auth_failure is True
        assert exc.is_rate_limited is False

    def test_403_is_an_auth_failure(self):
        from backend.services.external.newsapi import NewsAPIError

        assert NewsAPIError("forbidden", status_code=403).is_auth_failure is True

    def test_429_is_rate_limited_not_auth(self):
        from backend.services.external.guardian import GuardianError

        exc = GuardianError("Guardian API rate limit exceeded.", status_code=429)
        assert exc.is_rate_limited is True
        assert exc.is_auth_failure is False

    def test_503_is_neither(self):
        from backend.services.external.guardian import GuardianError

        exc = GuardianError("Guardian API error 503: down", status_code=503)
        assert exc.is_auth_failure is False
        assert exc.is_rate_limited is False

    def test_status_may_be_absent(self):
        """NewsAPI answers 200 with ``{"status": "error"}`` — no HTTP status."""
        from backend.services.external.newsapi import NewsAPIError

        exc = NewsAPIError("NewsAPI returned status: error")
        assert exc.status_code is None
        assert exc.is_auth_failure is False


# ---------------------------------------------------------------------------
# Adapter isolation — one bad source must not end the cycle
# ---------------------------------------------------------------------------

class _AdminStub:
    """Admin client that refuses every query — templates fall back to inline."""

    def table(self, *_args, **_kwargs):
        msg = "no database in this test"
        raise ValueError(msg)


class TestAdapterIsolation:
    """A refused API key used to take the whole scan cycle with it.

    ``run_scan_cycle`` isolated each adapter with a NARROW exception tuple.
    ``GuardianError`` matched none of its members, so it escaped the boundary
    and ended the cycle — every adapter after it in the list included. It
    never showed on prod only because no Guardian key was configured and the
    adapter reported ``unavailable`` before ever calling out. Entering a key
    would have armed it, which is exactly what the resume note asked for next.
    """

    @staticmethod
    def _register(monkeypatch, adapters: dict):
        from backend.services.scanning import scanner_service as mod

        monkeypatch.setattr(mod, "get_adapter", lambda name: adapters[name])

    @pytest.mark.asyncio
    async def test_refused_key_is_reported_and_the_cycle_continues(self, monkeypatch):
        from backend.services.external.guardian import GuardianError
        from backend.services.scanning.scanner_service import ScannerService

        class _Refused:
            name = "guardian"
            requires_api_key = True
            api_key_setting = "guardian_api_key"
            extra_settings = ()
            _api_key = "dead-key"

            async def is_available(self):
                return True

            async def fetch(self):
                raise GuardianError(
                    "Guardian API error 401: Unauthorized", status_code=401
                )

        class _Quiet:
            name = "usgs_earthquakes"
            requires_api_key = False
            api_key_setting = None
            extra_settings = ()

            async def is_available(self):
                return True

            async def fetch(self):
                return []

        self._register(monkeypatch, {"guardian": _Refused(), "usgs_earthquakes": _Quiet()})

        metrics = await ScannerService.run_scan_cycle(
            _AdminStub(),
            config={"adapters": ["guardian", "usgs_earthquakes"], "api_keys": {}},
            adapter_names=["guardian", "usgs_earthquakes"],
        )

        assert metrics["adapters"]["guardian"]["status"] == "unauthorized"
        # The point of the test: the adapter AFTER the failing one still ran.
        assert metrics["adapters"]["usgs_earthquakes"]["status"] == "ok"

    @pytest.mark.asyncio
    async def test_an_unlisted_exception_type_no_longer_escapes(self, monkeypatch):
        """The barrier must hold for a type nobody thought to enumerate."""
        from backend.services.scanning.scanner_service import ScannerService

        class _Exotic:
            name = "gdelt"
            requires_api_key = False
            api_key_setting = None
            extra_settings = ()

            async def is_available(self):
                return True

            async def fetch(self):
                raise RuntimeError("something nobody listed in a tuple")

        class _Quiet:
            name = "usgs_earthquakes"
            requires_api_key = False
            api_key_setting = None
            extra_settings = ()

            async def is_available(self):
                return True

            async def fetch(self):
                return []

        self._register(monkeypatch, {"gdelt": _Exotic(), "usgs_earthquakes": _Quiet()})

        metrics = await ScannerService.run_scan_cycle(
            _AdminStub(),
            config={"adapters": ["gdelt", "usgs_earthquakes"], "api_keys": {}},
            adapter_names=["gdelt", "usgs_earthquakes"],
        )

        assert metrics["adapters"]["gdelt"]["status"] == "error"
        assert metrics["adapters"]["usgs_earthquakes"]["status"] == "ok"

    @pytest.mark.asyncio
    async def test_a_provider_outage_is_not_an_auth_failure(self, monkeypatch):
        from backend.services.external.newsapi import NewsAPIError
        from backend.services.scanning.scanner_service import ScannerService

        class _Down:
            name = "newsapi"
            requires_api_key = True
            api_key_setting = "newsapi_api_key"
            extra_settings = ()
            _api_key = "a-key"

            async def is_available(self):
                return True

            async def fetch(self):
                raise NewsAPIError("NewsAPI error 503: down", status_code=503)

        self._register(monkeypatch, {"newsapi": _Down()})

        metrics = await ScannerService.run_scan_cycle(
            _AdminStub(),
            config={"adapters": ["newsapi"], "api_keys": {}},
            adapter_names=["newsapi"],
        )

        assert metrics["adapters"]["newsapi"]["status"] == "error"


# ---------------------------------------------------------------------------
# The answer a caller gets — it must name the cause
# ---------------------------------------------------------------------------

class TestUpstreamNewsErrorMapping:
    """``502 "External API error. Please try again."`` was the answer to
    everything, including a dead key, where retrying is precisely the wrong
    advice. It cost about a day on 2026-09-02."""

    def test_refused_key_names_the_setting_to_renew(self):
        from backend.routers.social_trends import _upstream_news_error
        from backend.services.external.guardian import GuardianError

        exc = _upstream_news_error(
            "guardian", GuardianError("401: Unauthorized", status_code=401)
        )
        assert exc.status_code == 502
        assert "guardian_api_key" in exc.detail
        assert "retrying will not help" in exc.detail

    def test_rate_limit_answers_429(self):
        from backend.routers.social_trends import _upstream_news_error
        from backend.services.external.newsapi import NewsAPIError

        exc = _upstream_news_error("newsapi", NewsAPIError("slow down", status_code=429))
        assert exc.status_code == 429

    def test_outage_names_the_upstream_status(self):
        from backend.routers.social_trends import _upstream_news_error
        from backend.services.external.guardian import GuardianError

        exc = _upstream_news_error("guardian", GuardianError("down", status_code=503))
        assert exc.status_code == 502
        assert "503" in exc.detail

    def test_unknown_failure_still_answers_502(self):
        from backend.routers.social_trends import _upstream_news_error

        exc = _upstream_news_error("guardian", RuntimeError("connection reset"))
        assert exc.status_code == 502
        assert "guardian" in exc.detail


# ---------------------------------------------------------------------------
# Bureau dispatch — a half dispatch is worse than none
# ---------------------------------------------------------------------------

class TestBureauDispatchBudget:
    """27 of the first 50 dispatches on production stopped mid-word, 7 were
    empty strings. Prose hides its own truncation — that is why it took 197
    days to notice. These tests hold the two guards that now catch it."""

    @staticmethod
    def _patch(monkeypatch, *, answer: str, completion_tokens: int):
        """Stand in for the whole OpenRouter round trip."""
        from backend.services.scanning import scanner_service as mod

        class _FakeOpenRouter:
            def __init__(self, _api_key):
                self.last_usage = None

            async def generate_with_system(self, **kwargs):
                self.last_usage = {"completion_tokens": completion_tokens}
                return answer

        async def _fake_admin():
            return object()

        monkeypatch.setattr(mod, "OpenRouterService", _FakeOpenRouter)
        monkeypatch.setattr(mod, "get_admin_supabase_client", _fake_admin)
        monkeypatch.setattr(mod, "get_platform_model", lambda _purpose: "test/model")

    @staticmethod
    def _result():
        return ScanResult(
            source_id="x",
            source_name="guardian",
            title="Magnitude 6.1 earthquake off northern Honshu",
            description="No tsunami warning was issued.",
            source_category="natural_disaster",
            magnitude=0.6,
        )

    @pytest.mark.asyncio
    async def test_a_whole_dispatch_is_kept(self, monkeypatch):
        from backend.services.scanning.scanner_service import ScannerService

        self._patch(monkeypatch, answer="  The ground remembers.  ", completion_tokens=264)
        got = await ScannerService._generate_dispatch(
            self._result(), {"openrouter_api_key": "k"}
        )
        assert got == "The ground remembers."

    @pytest.mark.asyncio
    async def test_an_answer_that_spent_its_whole_budget_is_discarded(self, monkeypatch):
        """The exact shape of the 27: readable text, ending nowhere."""
        from backend.services.scanning.scanner_service import ScannerService

        self._patch(
            monkeypatch,
            answer="**Monitoring Classification:** SUB-SEISMIC / TREMOR-7741 / WATCH-",
            completion_tokens=ScannerService._DISPATCH_MAX_TOKENS,
        )
        got = await ScannerService._generate_dispatch(
            self._result(), {"openrouter_api_key": "k"}
        )
        assert got is None

    @pytest.mark.asyncio
    async def test_whitespace_only_becomes_none_not_an_empty_string(self, monkeypatch):
        """The shape of the 7: `_extract_content` lets `"\\n\\n"` through
        (it is not falsy), and `.strip()` then leaves nothing. The column
        already has a way to say "no dispatch", and it is NULL."""
        from backend.services.scanning.scanner_service import ScannerService

        self._patch(monkeypatch, answer="\n\n  \n", completion_tokens=12)
        got = await ScannerService._generate_dispatch(
            self._result(), {"openrouter_api_key": "k"}
        )
        assert got is None

    @pytest.mark.asyncio
    async def test_a_db_template_may_raise_the_ceiling(self, monkeypatch):
        """The template row in the database wins over the code constant — which
        is why migration 338 has to change BOTH. Here the row allows more, so an
        answer above the code default is still whole."""
        from backend.services.scanning.scanner_service import ScannerService

        self._patch(monkeypatch, answer="A longer dispatch.", completion_tokens=900)
        got = await ScannerService._generate_dispatch(
            self._result(),
            {
                "openrouter_api_key": "k",
                "_templates": {"scanner_bureau_dispatch": {"max_tokens": 2048}},
            },
        )
        assert got == "A longer dispatch."


# ---------------------------------------------------------------------------
# Die Linse erreicht das Modell (Luecke 4)
# ---------------------------------------------------------------------------

class TestLensDirectives:
    """Der Schmelztiegel stellt seit Schritt 3 Regler, die nichts bewegten.

    Was hier geprueft wird, ist die Uebersetzung von Zustand in Anweisung — und
    vor allem die beiden Grenzfaelle, die eine Vorlage zerbrechen: KEINE Linse
    und eine LEERE Linse muessen denselben Leerstring liefern, denn
    `str.format` verlangt den Platzhalter in jedem Fall.
    """

    @staticmethod
    def _render(**kwargs):
        from backend.models.social_trend import TransformLens
        from backend.services.social_trends_service import SocialTrendsService

        return SocialTrendsService.render_lens_directives(TransformLens(**kwargs))

    def test_no_lens_is_an_empty_string(self):
        from backend.services.social_trends_service import SocialTrendsService

        assert SocialTrendsService.render_lens_directives(None) == ""

    def test_an_empty_lens_is_also_empty(self):
        """Eine Linse, in der nichts gesetzt ist, darf keinen Block erzeugen."""
        assert self._render() == ""

    def test_the_place_is_named(self):
        out = self._render(zone_name="Speranza")
        assert "Speranza" in out
        assert "Additional direction:" in out

    def test_the_tone_becomes_a_sentence(self):
        """Im Zustand steht `rumour`, im Prompt ein Satz — eine Kennung ist
        keine Anweisung."""
        out = self._render(tone="rumour")
        assert "rumour" not in out
        assert "word of mouth" in out

    def test_an_unknown_tone_is_dropped_silently(self):
        assert self._render(tone="erfunden") == ""

    def test_free_instructions_travel_verbatim(self):
        out = self._render(instructions="  Lass den Hafen verlassen wirken.  ")
        assert "Lass den Hafen verlassen wirken." in out

    def test_every_part_becomes_its_own_line(self):
        out = self._render(
            zone_name="Speranza",
            vector="commerce",
            tone="official",
            instructions="Kurz halten.",
        )
        assert out.count("\n- ") == 4

    def test_creativity_is_not_in_the_text(self):
        """Die Freiheit ist die TEMPERATUR des Aufrufs, kein Prompt-Text — sonst
        stuende dieselbe Angabe an zwei Orten."""
        assert self._render(creativity=0.9) == ""


# ---------------------------------------------------------------------------
# Protokoll und Kandidat teilen einen Schluessel (Luecke 7)
# ---------------------------------------------------------------------------

class _CandidateStub:
    """Antwortet auf die eine Abfrage, die `_attach_intake_status` stellt."""

    def __init__(self, rows: list[dict]):
        self._rows = rows
        self.asked_for: list[str] = []

    def table(self, _name: str):
        return self

    def select(self, _cols: str):
        return self

    def in_(self, _col: str, values: list[str]):
        self.asked_for = list(values)
        return self

    async def execute(self):
        return SimpleNamespace(data=self._rows, count=len(self._rows))


class TestIntakeStatusOnTheScanLog:
    """Die Spalte „Ergebnis" darf nur sagen, was der SCHLUESSEL hergibt.

    Vor Migration 343 gab es keinen; ein Abgleich ueber den Titel lieferte
    Zeilen, nur nicht die richtigen. Diese Tests halten fest, dass jetzt das
    PAAR (Quelle, Kennung) zaehlt — nicht eines von beiden.
    """

    @pytest.mark.asyncio
    async def test_the_status_is_attached_by_the_pair(self):
        from backend.services.scanning.scanner_service import ScannerService

        rows = [
            {"source_name": "guardian", "source_id": "g1", "title": "A"},
            {"source_name": "noaa_alerts", "source_id": "n1", "title": "B"},
        ]
        admin = _CandidateStub(
            [
                {"source_adapter": "guardian", "source_id": "g1", "status": "pending"},
                {"source_adapter": "noaa_alerts", "source_id": "n1", "status": "approved"},
            ]
        )
        await ScannerService._attach_intake_status(admin, rows)
        assert rows[0]["intake_status"] == "pending"
        assert rows[1]["intake_status"] == "approved"

    @pytest.mark.asyncio
    async def test_the_same_id_under_another_source_does_not_match(self):
        """Der Schluessel ist das PAAR. Zwei Quellen duerfen dieselbe Kennung
        fuehren — ein Abgleich nur ueber die Kennung waere wieder der alte
        Fehler in neuem Gewand."""
        from backend.services.scanning.scanner_service import ScannerService

        rows = [{"source_name": "guardian", "source_id": "shared", "title": "A"}]
        admin = _CandidateStub(
            [{"source_adapter": "noaa_alerts", "source_id": "shared", "status": "pending"}]
        )
        await ScannerService._attach_intake_status(admin, rows)
        assert rows[0]["intake_status"] is None

    @pytest.mark.asyncio
    async def test_rows_without_a_key_stay_none(self):
        """Die neun mehrdeutigen Zeilen von vor der Migration."""
        from backend.services.scanning.scanner_service import ScannerService

        rows = [{"source_name": "guardian", "source_id": None, "title": "A"}]
        admin = _CandidateStub([])
        await ScannerService._attach_intake_status(admin, rows)
        assert rows[0]["intake_status"] is None
        # Und es wird gar nicht erst gefragt, wenn es nichts zu fragen gibt.
        assert admin.asked_for == []

    @pytest.mark.asyncio
    async def test_one_query_for_the_whole_page(self):
        """Eine Abfrage je Zeile waeren bei 200 Zeilen 200 Aufrufe."""
        from backend.services.scanning.scanner_service import ScannerService

        rows = [{"source_name": "guardian", "source_id": f"g{i}", "title": "x"} for i in range(50)]
        admin = _CandidateStub([])
        await ScannerService._attach_intake_status(admin, rows)
        assert len(admin.asked_for) == 50

    @pytest.mark.asyncio
    async def test_a_broken_lookup_does_not_take_the_log_down(self):
        """Ohne den Stand ist es immer noch das Protokoll."""
        from backend.services.scanning.scanner_service import ScannerService

        class _Broken(_CandidateStub):
            async def execute(self):
                msg = "no database"
                raise ValueError(msg)

        rows = [{"source_name": "guardian", "source_id": "g1", "title": "A"}]
        await ScannerService._attach_intake_status(_Broken([]), rows)
        assert rows[0]["intake_status"] is None


# ---------------------------------------------------------------------------
# Story-Buendelung (Luecke 2)
# ---------------------------------------------------------------------------

class TestStoryBundling:
    """Drei Quellen ueber dasselbe Beben sind EINE Geschichte.

    Die Vorgaengerin `deduplicate_within_batch` tat zweierlei anders: sie
    verglich nur INNERHALB derselben Quelle — ein Guardian-Artikel und ein
    Bluesky-Beitrag wurden deshalb nie zusammengefuehrt — und sie WARF die
    Duplikate weg, samt der Auskunft, wie viele Quellen etwas melden.
    """

    @staticmethod
    def _r(title, source, *, structured=False, supporting=False, magnitude=None, raw=None):
        return ScanResult(
            source_id=f"{source}:{title[:8]}",
            source_name=source,
            title=title,
            magnitude=magnitude,
            is_structured=structured,
            is_supporting=supporting,
            raw_data=raw or {},
        )

    def test_a_lone_story_carries_its_own_source(self):
        from backend.services.scanning.deduplicator import bundle_within_batch

        out = bundle_within_batch([self._r("Beben vor Honshu", "guardian")])
        assert len(out) == 1
        assert out[0].sources == [{"name": "guardian", "count": 1}]

    def test_two_sources_become_one_story(self):
        """Der Kern: ueber Quellgrenzen HINWEG."""
        from backend.services.scanning.deduplicator import bundle_within_batch

        out = bundle_within_batch(
            [
                self._r("Erdbeben erschuettert Nordjapan", "guardian"),
                self._r("Erdbeben erschuettert Nordjapan heute", "bluesky", supporting=True),
            ]
        )
        assert len(out) == 1
        assert {s["name"] for s in out[0].sources} == {"guardian", "bluesky"}

    def test_a_supporting_source_never_carries(self):
        """Die Regel des Bauplans, hier durchgesetzt statt beschrieben."""
        from backend.services.scanning.deduplicator import bundle_within_batch

        # Die belegende Quelle kommt ZUERST — sie darf trotzdem nicht Traeger sein.
        out = bundle_within_batch(
            [
                self._r("Erdbeben erschuettert Nordjapan", "bluesky", supporting=True),
                self._r("Erdbeben erschuettert Nordjapan heute", "guardian"),
            ]
        )
        assert len(out) == 1
        assert out[0].source_name == "guardian"
        assert {s["name"] for s in out[0].sources} == {"guardian", "bluesky"}

    def test_a_measurement_beats_a_mention(self):
        from backend.services.scanning.deduplicator import bundle_within_batch

        out = bundle_within_batch(
            [
                self._r("Erdbeben erschuettert Nordjapan", "guardian"),
                self._r("Erdbeben erschuettert Nordjapan heute", "usgs_earthquakes", structured=True),
            ]
        )
        assert out[0].source_name == "usgs_earthquakes"

    def test_engagement_is_summed_from_the_social_contributors(self):
        from backend.services.scanning.deduplicator import bundle_within_batch

        out = bundle_within_batch(
            [
                self._r("Erdbeben erschuettert Nordjapan", "guardian"),
                self._r(
                    "Erdbeben erschuettert Nordjapan heute",
                    "bluesky",
                    supporting=True,
                    raw={"likes": 120, "reposts": 30},
                ),
            ]
        )
        assert out[0].social_volume == 150

    def test_the_same_source_twice_raises_its_count(self):
        """`count` zaehlt BEITRAEGE, nicht Quellen: dass NOAA dieselbe Warnung
        dreimal absetzt, ist eine andere Auskunft als drei Dienste."""
        from backend.services.scanning.deduplicator import bundle_within_batch

        out = bundle_within_batch(
            [
                self._r("High Wind Warning NWS Billings MT", "noaa_alerts"),
                self._r("High Wind Warning NWS Billings MT heute", "noaa_alerts"),
            ]
        )
        assert out[0].sources == [{"name": "noaa_alerts", "count": 2}]

    def test_different_stories_stay_apart(self):
        from backend.services.scanning.deduplicator import bundle_within_batch

        out = bundle_within_batch(
            [
                self._r("Erdbeben erschuettert Nordjapan", "guardian"),
                self._r("Hafenstreik geht in die dritte Woche", "guardian"),
            ]
        )
        assert len(out) == 2

    def test_nothing_is_lost_when_the_carrier_changes(self):
        """Wenn ein spaeterer Treffer besser traegt, muss er die BISHERIGE
        Buendelung uebernehmen — sonst faellt die erste Quelle unter den Tisch.

        ⚠ DIESER TEST HAT EINEN ECHTEN FEHLER GEFANGEN, und er tat es nur, weil
        er DREI Quellen benutzt. Beim Traegerwechsel stand zuerst
        `_add_source(result, existing)`: der alte Traeger wurde ein zweites Mal
        gezaehlt, der neue gar nicht eingetragen. Mit zwei Quellen sieht das
        Ergebnis plausibel aus — eine Quelle, ein Eintrag —, erst die dritte
        macht die Luecke sichtbar.

        🔑 Ein Test mit dem Mindestfall prueft, ob der Code laeuft. Erst einer
        mit dem Fall darueber prueft, ob er stimmt.
        """
        from backend.services.scanning.deduplicator import bundle_within_batch

        # Die Titel muessen ueber der Jaccard-Schwelle von 0.70 liegen; ein
        # zusaetzliches Wort je Titel taete das schon nicht mehr (3 gemeinsame
        # von 5 im Verbund = 0.6).
        out = bundle_within_batch(
            [
                self._r("Beben vor Honshu", "bluesky", supporting=True, raw={"likes": 10}),
                self._r("Beben vor Honshu", "guardian"),
                self._r("Beben vor Honshu", "usgs_earthquakes", structured=True),
            ]
        )
        assert len(out) == 1
        assert out[0].source_name == "usgs_earthquakes"
        assert {s["name"] for s in out[0].sources} == {"bluesky", "guardian", "usgs_earthquakes"}
        # Die Zustimmung des ersten Beitraegers ueberlebt zwei Traegerwechsel.
        assert out[0].social_volume == 10

    def test_the_threshold_is_a_threshold_and_not_a_promise(self):
        """Zwei Titel, die ein Mensch als dieselbe Geschichte laese, bleiben
        getrennt, wenn die Jaccard-Aehnlichkeit unter 0.70 faellt.

        Das ist keine Schwaeche der Buendelung, sondern ihre Grenze — und sie
        gehoert festgehalten, damit niemand sie fuer einen Fehler haelt und die
        Schwelle senkt, bis Verschiedenes zusammenfaellt.
        """
        from backend.services.scanning.deduplicator import bundle_within_batch

        out = bundle_within_batch(
            [
                self._r("Beben vor Honshu gemeldet", "guardian"),
                self._r("Beben vor Honshu bestaetigt", "usgs_earthquakes", structured=True),
            ]
        )
        assert len(out) == 2


# ---------------------------------------------------------------------------
# Die Passung (Luecke 3)
# ---------------------------------------------------------------------------

class TestSignatureFit:
    """Die Passung ist KEINE erfundene Formel.

    Der Bauplan schlaegt „Kategorie↔Zone-Match, Agenten-Rollen-Match,
    Vektor-Verfuegbarkeit" vor — drei Groessen, die es als Messwerte nicht gibt.
    Genommen wird die Suszeptibilitaet, mit der der Resonanzlauf ohnehin
    rechnet. Diese Tests halten fest, dass es dabei bleibt.
    """

    @pytest.mark.asyncio
    async def test_one_row_per_signature_not_per_candidate(self, monkeypatch):
        from backend.models.resonance import CATEGORY_ARCHETYPE_MAP
        from backend.services import intake_service as mod
        from backend.services.intake_service import IntakeService

        async def _fake(_supabase, _sim, signature):
            return 0.5

        monkeypatch.setattr(mod.ResonanceService, "susceptibility_of", _fake)
        out = await IntakeService.signature_fit(object(), "sim-1")

        signatures = {s for s, _ in CATEGORY_ARCHETYPE_MAP.values()}
        assert len(out) == len(signatures)
        assert {r["signature"] for r in out} == signatures

    @pytest.mark.asyncio
    async def test_the_number_is_the_susceptibility_scaled(self, monkeypatch):
        from backend.services import intake_service as mod
        from backend.services.intake_service import IntakeService

        async def _fake(_supabase, _sim, _signature):
            return 0.73

        monkeypatch.setattr(mod.ResonanceService, "susceptibility_of", _fake)
        out = await IntakeService.signature_fit(object(), "sim-1")
        assert {r["fit"] for r in out} == {73}

    @pytest.mark.asyncio
    async def test_it_is_capped_at_a_hundred(self, monkeypatch):
        """`fn_get_adaptive_susceptibility` darf ueber 1.0 gehen — eine Welt kann
        empfaenglicher als normal sein. Eine Passung von 140 % waere auf dem
        Schirm trotzdem Unsinn."""
        from backend.services import intake_service as mod
        from backend.services.intake_service import IntakeService

        async def _fake(_supabase, _sim, _signature):
            return 1.4

        monkeypatch.setattr(mod.ResonanceService, "susceptibility_of", _fake)
        out = await IntakeService.signature_fit(object(), "sim-1")
        assert {r["fit"] for r in out} == {100}
