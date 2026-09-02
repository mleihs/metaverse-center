"""Bluesky als Quelle — das Tor, nicht die Suche.

Der Adapter hat genau eine Eigenschaft, die still falsch sein kann: WELCHE
Beiträge zu einem Signal werden. `handoff/schleuse-event-intake.md` verlangt,
dass eine Sozialquelle nie ein eigenes Signal erzeugt, sondern nur zu einer
bestehenden Geschichte beiträgt. Umgesetzt ist das als Bedingung für die
Entstehung: **ohne verlinkten Artikel kein Signal.**

Eine Regel, die nur im Modulkopf steht, ist keine Regel. Die Tests hier sind
die Stelle, an der sie zubeisst, wenn jemand das Tor lockert.

Kein Netz: die Suche wird durch ein Doppel ersetzt. Was hier geprüft wird, ist
die Auswahl, nicht Bluesky.
"""

from unittest.mock import AsyncMock, patch

import pytest

from backend.services.scanning.adapters.bluesky_social import (
    MIN_ENGAGEMENT,
    BlueskyScannerAdapter,
)


def post(
    *,
    text="egal",
    url=None,
    title=None,
    likes=0,
    reposts=0,
    handle="someone.bsky.social",
    uri=None,
    embed_type="app.bsky.embed.external#view",
):
    """Ein Bluesky-Beitrag in der Gestalt, die `searchPosts` liefert."""
    p = {
        "uri": uri or f"at://did:plc:x/app.bsky.feed.post/{abs(hash(text)) % 10**8}",
        "author": {"handle": handle},
        "record": {"text": text},
        "likeCount": likes,
        "repostCount": reposts,
        "replyCount": 0,
        "indexedAt": "2026-09-02T10:00:00Z",
    }
    if url is not None:
        p["embed"] = {
            "$type": embed_type,
            "external": {"uri": url, "title": title, "description": "…"},
        }
    return p


def _adapter(posts, *, queries=("news",)):
    a = BlueskyScannerAdapter()
    a._api_key = "app-passwort"
    a._settings = {
        "bluesky_handle": "bureau.bsky.social",
        "bluesky_scanner_queries": list(queries),
    }
    return a, AsyncMock(return_value=posts)


async def _fetch(posts, *, queries=("news",)):
    adapter, search = _adapter(posts, queries=queries)
    with patch(
        "backend.services.scanning.adapters.bluesky_social.BlueskyService"
    ) as service_cls:
        service_cls.return_value.search_posts = search
        return await adapter.fetch()


class TestDasTor:
    """Ohne verlinkten Artikel kein Signal."""

    @pytest.mark.asyncio
    async def test_a_post_without_a_link_never_becomes_a_signal(self):
        # Der Fall, den die Regel meint: jemand redet ÜBER ein Erdbeben.
        results = await _fetch([post(text="krass, schon wieder ein Erdbeben", likes=900)])
        assert results == []

    @pytest.mark.asyncio
    async def test_a_link_without_a_headline_is_not_an_anchor_either(self):
        # Eine URL ohne Titel gäbe als Überschrift nur den Beitragstext her —
        # also den Kommentar des Absenders statt der Nachricht.
        results = await _fetch(
            [post(text="seht euch das an", url="https://example.org/a", title=None, likes=50)]
        )
        assert results == []

    @pytest.mark.asyncio
    async def test_an_anchored_post_reports_the_article_not_the_post(self):
        results = await _fetch(
            [
                post(
                    text="unfassbar, lest das",
                    url="https://reuters.com/x",
                    title="Central bank holds rates",
                    likes=1,
                )
            ]
        )
        assert len(results) == 1
        r = results[0]
        # Die Überschrift ist die des ARTIKELS. Daran hängt die Entduplizierung
        # gegen Guardian und GDELT (Titelähnlichkeit > 0.70) — mit dem
        # Beitragstext als Titel liefe sie ins Leere.
        assert r.title == "Central bank holds rates"
        assert r.url == "https://reuters.com/x"
        assert r.raw_data["post_text"] == "unfassbar, lest das"
        assert r.is_structured is False

    @pytest.mark.asyncio
    async def test_reads_the_card_out_of_a_quote_post_too(self):
        # `recordWithMedia` legt die Karte eine Ebene tiefer, unter `media`.
        # Ein zitierter Beitrag mit Artikelkarte ist auf Bluesky die haeufigste
        # Form, in der eine Redaktion weitergereicht wird; wer nur die flache
        # Form kennt, verliert sie lautlos.
        quoted = post(likes=2)
        quoted["embed"] = {
            "$type": "app.bsky.embed.recordWithMedia#view",
            "record": {"$type": "app.bsky.embed.record#view"},
            "media": {
                "$type": "app.bsky.embed.external#view",
                "external": {
                    "uri": "https://bbc.co.uk/y",
                    "title": "Outbreak deaths top 3000",
                    "description": "…",
                },
            },
        }
        results = await _fetch([quoted])
        assert len(results) == 1
        assert results[0].title == "Outbreak deaths top 3000"
        assert results[0].url == "https://bbc.co.uk/y"


class TestDieSchwelle:
    """Die eine Reaktion trennt Mensch von Maschine."""

    @pytest.mark.asyncio
    async def test_a_post_nobody_reacted_to_is_dropped(self):
        results = await _fetch(
            [post(url="https://example.org/a", title="Eine Meldung", likes=0, reposts=0)]
        )
        assert results == []

    @pytest.mark.asyncio
    async def test_likes_and_reposts_count_together(self):
        results = await _fetch(
            [post(url="https://example.org/b", title="Eine Meldung", likes=0, reposts=1)]
        )
        assert len(results) == 1

    def test_the_threshold_is_the_measured_one(self):
        # 02.09.2026 gemessen: von 114 verlinkten Beiträgen hatten 88 NULL
        # Reaktionen (Wiederholungs-Konten). Die Klippe liegt zwischen 0 und 1,
        # nicht bei 5 — bei 5 fiel Reuters heraus.
        assert MIN_ENGAGEMENT == 1


class TestWiederholungen:
    """Derselbe Artikel über mehrere Suchzeilen bleibt eine Zeile."""

    @pytest.mark.asyncio
    async def test_the_same_article_from_two_queries_appears_once(self):
        same = post(url="https://apnews.com/z", title="Ebola deaths top 3000", likes=3)
        results = await _fetch([same, same], queries=("outbreak", "breaking news"))
        assert len(results) == 1


class TestVerfuegbarkeit:
    """Ein halber Zugang ist kein Zugang."""

    def test_needs_both_handle_and_password(self):
        import asyncio

        a = BlueskyScannerAdapter()
        a._api_key = "pw"
        a._settings = {}
        assert asyncio.run(a.is_available()) is False

        a._settings = {"bluesky_handle": "x.bsky.social"}
        a._api_key = None
        assert asyncio.run(a.is_available()) is False

        a._api_key = "pw"
        assert asyncio.run(a.is_available()) is True

    def test_falls_back_to_the_default_queries(self):
        from backend.services.scanning.adapters.bluesky_social import DEFAULT_QUERIES

        a = BlueskyScannerAdapter()
        a._settings = {}
        assert a._queries() == list(DEFAULT_QUERIES)

        a._settings = {"bluesky_scanner_queries": ["erdbeben", "seuche"]}
        assert a._queries() == ["erdbeben", "seuche"]

        # Aus dem Admin-Formular kommt ein Komma-String, kein Array.
        a._settings = {"bluesky_scanner_queries": "erdbeben, seuche"}
        assert a._queries() == ["erdbeben", "seuche"]


class TestDerZyklusHaeltDurch:
    """Eine Suchzeile, die scheitert, nimmt die anderen nicht mit."""

    @pytest.mark.asyncio
    async def test_one_failing_query_does_not_lose_the_others(self):
        from backend.services.external.bluesky import BlueskyAPIError

        good = [post(url="https://reuters.com/q", title="Eine Meldung", likes=4)]
        adapter = BlueskyScannerAdapter()
        adapter._api_key = "pw"
        adapter._settings = {
            "bluesky_handle": "x.bsky.social",
            "bluesky_scanner_queries": ["kaputt", "heil"],
        }

        calls = {"n": 0}

        async def search(query, **_):
            calls["n"] += 1
            if query == "kaputt":
                raise BlueskyAPIError("500")
            return good

        with patch(
            "backend.services.scanning.adapters.bluesky_social.BlueskyService"
        ) as service_cls:
            service_cls.return_value.search_posts = search
            results = await adapter.fetch()

        assert calls["n"] == 2
        assert len(results) == 1
