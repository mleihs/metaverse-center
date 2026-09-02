"""Bluesky scanner adapter — SEMI-STRUCTURED (link anchor + engagement floor).

WARUM DIESER ADAPTER EIN TOR HAT UND DIE ANDEREN NICHT
------------------------------------------------------
`handoff/schleuse-event-intake.md` stellt eine Regel auf, die nicht verhandelbar
ist: eine Sozialquelle liefert nur Tempo und Reichweite zu einer BESTEHENDEN
Geschichte, nie ein eigenes Signal. Ohne Nachrichtenanker ist sie Rauschen.

Die Regel ist richtig, und der Grund ist offensichtlich, sobald man einmal in
die offene Suche sieht: die meisten Beiträge sind Gespräch. Ein Adapter, der
`searchPosts("earthquake")` durchreicht, füllte die Sichtung mit Meinungen über
Erdbeben statt mit Erdbeben.

Umgesetzt ist die Regel deshalb NICHT als Kommentar und nicht als nachgelagerter
Filter, sondern als BEDINGUNG FÜR DIE ENTSTEHUNG eines Signals: ein Beitrag wird
nur dann zu einem `ScanResult`, wenn er einen ARTIKEL VERLINKT. Der Anker ist
die URL, und die Überschrift, die daraus wird, ist die des Artikels — nicht der
Beitragstext. Damit greift die bestehende Entduplizierung
(`deduplicator.py`, Titelähnlichkeit > 0.70) von selbst: derselbe Artikel, den
auch Guardian oder GDELT gemeldet hat, wird EINE Geschichte, und Bluesky ist
dann genau das, was der Plan wollte — ein weiterer Beleg an einer bestehenden
Geschichte, kein eigenes Signal.

Ein Beitrag ohne Link fällt heraus. Er wird nicht gezählt, nicht gespeichert,
nicht angezeigt. Das ist der Preis dafür, die Regel nicht schriftlich, sondern
baulich zu haben: das Tempo, das der Plan sich von Sozialquellen erhofft
(„1.2k in 2 h"), braucht eine Spalte, die es noch nicht gibt (Lücke 2,
Story-Bündelung). Sobald sie existiert, gehören die verworfenen Beiträge dort
hinein — und nicht in die Sichtung.

WAS DAS TOR AUSSERDEM LEISTET
-----------------------------
Die offene Suche fördert einen Fund zutage, den der Plan nicht kannte: auf
Bluesky laufen strukturierte Melde-Konten (`hawaii-quakes.bsky.social`,
`ncseismicobserv.bsky.social`, …), die Erdbeben im Minutentakt posten. Die
tragen selten einen Link und fallen deshalb durch dieses Tor — zu Recht: USGS
und GDACS liefern dieselben Beben als Messwert, mit Magnitude und Koordinaten.
Ein zweiter, schlechterer Weg zu denselben Daten wäre kein Gewinn.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from backend.services.external.bluesky import BlueskyAPIError, BlueskyService
from backend.services.scanning.base_adapter import ScanResult, SourceAdapter
from backend.services.scanning.registry import register_adapter

logger = logging.getLogger(__name__)

#: Wonach gesucht wird, wenn `platform_settings` nichts vorgibt.
#:
#: Bewusst breite Nachrichtenbegriffe statt enger Fachwörter: das Tor unten
#: entscheidet über die Qualität, nicht die Suchzeile. Wer hier eng sucht,
#: verliert Geschichten; wer weit sucht, bezahlt nur mit Beiträgen, die das
#: Tor ohnehin verwirft.
DEFAULT_QUERIES: tuple[str, ...] = (
    "breaking news",
    "earthquake",
    "outbreak",
    "central bank",
    "ceasefire",
    "protests",
    "wildfire",
    "flooding",
)

#: Wie viele Likes+Reposts ein Beitrag mindestens braucht.
#:
#: GEMESSEN, NICHT GEWÄHLT (02.09.2026, 198 Beiträge über acht Suchzeilen,
#: 12-Stunden-Fenster). Die Verteilung der verlinkten Beiträge fällt zwischen
#: 0 und 1 von der Klippe:
#:
#:     >= 0  114     >= 3    8
#:     >= 1   26     >= 5    4
#:     >= 2   13     >= 15   1
#:
#: 88 der 114 verlinkten Beiträge haben NULL Reaktionen — das sind
#: Wiederholungs-Konten, die Schlagzeilen automatisch weiterreichen. Die eine
#: Reaktion trennt also nicht „viel gelesen" von „wenig gelesen", sondern
#: „ein Mensch hat es gesehen" von „eine Maschine hat es weitergereicht", und
#: genau diese Grenze ist die interessante. Bei >= 1 bleiben Reuters, BBC, AP,
#: Washington Post und LA Times übrig; bei >= 5 bleiben vier Meldungen und
#: Reuters fällt heraus.
#:
#: Die höhere Schwelle war ursprünglich ein SPARMASS, abgeleitet vom
#: HackerNews-Adapter (Punktzahl 200). Das Argument trägt hier nicht:
#: `classifier.classify_batch` macht EINEN gebündelten Modellaufruf je Zyklus,
#: nicht einen je Signal. 26 Überschriften statt 4 kosten denselben Aufruf mit
#: einem längeren Prompt.
MIN_ENGAGEMENT = 1

#: Wie weit zurück gesucht wird, wenn der Aufrufer nichts sagt.
DEFAULT_LOOKBACK_HOURS = 12

#: Obergrenze je Suchzeile.
LIMIT_PER_QUERY = 25


def _external_embed(post: dict) -> dict | None:
    """Die verlinkte Karte eines Beitrags, oder `None`.

    Bluesky hängt einen Link auf zwei Arten an: als `app.bsky.embed.external`
    (die Vorschaukarte mit Titel und Beschreibung — das ist, was wir wollen)
    oder nur als Facette im Text. Die Karte trägt die ÜBERSCHRIFT DES ARTIKELS,
    und genau darauf beruht die Entduplizierung gegen die anderen Adapter. Eine
    blosse Facette gäbe uns eine URL ohne Titel; daraus wäre nur der
    Beitragstext als Überschrift zu machen, und der ist der Kommentar des
    Absenders, nicht die Nachricht.
    """
    embed = post.get("embed") or {}
    kind = embed.get("$type", "")
    if kind.startswith("app.bsky.embed.external"):
        return embed.get("external")
    # Ein zitierter Beitrag mit Karte: `recordWithMedia`.
    if kind.startswith("app.bsky.embed.recordWithMedia"):
        media = embed.get("media") or {}
        if str(media.get("$type", "")).startswith("app.bsky.embed.external"):
            return media.get("external")
    return None


def _engagement(post: dict) -> int:
    return int(post.get("likeCount", 0) or 0) + int(post.get("repostCount", 0) or 0)


@register_adapter
class BlueskyScannerAdapter(SourceAdapter):
    """Bluesky als QUELLE. Der Gegenweg zu `BlueskyService.publish_post`."""

    name = "bluesky"
    display_name = "Bluesky"
    categories = [
        "economic_crisis",
        "military_conflict",
        "pandemic",
        "natural_disaster",
        "political_upheaval",
        "tech_breakthrough",
        "cultural_shift",
        "environmental_disaster",
    ]
    # Der Link und die Reichweite helfen; die Kategorie muss das Modell setzen.
    # Dieselbe Einstufung wie HackerNews, aus demselben Grund.
    is_structured = False
    requires_api_key = True
    api_key_setting = "bluesky_app_password"
    extra_settings = ("bluesky_handle", "bluesky_pds_url", "bluesky_scanner_queries")
    default_interval = 3600  # 1 Stunde

    async def is_available(self) -> bool:
        """Handle UND App-Passwort, sonst nichts.

        Ein Handle ohne Passwort ist so unbrauchbar wie ein Passwort ohne
        Handle — beide melden hier `False`, damit die Sensor-Leiste „kein Key"
        zeigt, statt dass `fetch()` im Zyklus eine Ausnahme wirft.
        """
        return bool(self._api_key) and bool(self._settings.get("bluesky_handle"))

    def _queries(self) -> list[str]:
        """Die Suchzeilen — aus den Einstellungen, ersatzweise die Vorgabe."""
        configured = self._settings.get("bluesky_scanner_queries")
        if isinstance(configured, list) and configured:
            return [str(q) for q in configured if str(q).strip()]
        if isinstance(configured, str) and configured.strip():
            return [q.strip() for q in configured.split(",") if q.strip()]
        return list(DEFAULT_QUERIES)

    async def fetch(self, since: datetime | None = None) -> list[ScanResult]:
        handle = str(self._settings.get("bluesky_handle") or "")
        password = str(self._api_key or "")
        if not handle or not password:
            return []

        pds = str(self._settings.get("bluesky_pds_url") or "https://bsky.social")
        cutoff = since or (datetime.now(UTC) - timedelta(hours=DEFAULT_LOOKBACK_HOURS))

        service = BlueskyService(handle=handle, app_password=password, pds_url=pds)
        results: list[ScanResult] = []
        seen_urls: set[str] = set()
        dropped_no_link = 0
        dropped_quiet = 0

        for query in self._queries():
            try:
                posts = await service.search_posts(query, limit=LIMIT_PER_QUERY, since=cutoff)
            except BlueskyAPIError:
                # Eine Suchzeile, die scheitert, darf die anderen nicht mitnehmen.
                logger.warning("Bluesky search failed for query %r", query, exc_info=True)
                continue

            for post in posts:
                external = _external_embed(post)
                if not external:
                    dropped_no_link += 1
                    continue

                url = str(external.get("uri") or "").strip()
                title = str(external.get("title") or "").strip()
                if not url or not title:
                    dropped_no_link += 1
                    continue

                if _engagement(post) < MIN_ENGAGEMENT:
                    dropped_quiet += 1
                    continue

                # Derselbe Artikel kommt über mehrere Suchzeilen herein. Hier
                # faellt die Wiederholung weg; die Entduplizierung gegen die
                # ANDEREN Adapter macht danach `deduplicator.py`.
                if url in seen_urls:
                    continue
                seen_urls.add(url)

                author = (post.get("author") or {}).get("handle", "unknown")
                results.append(
                    ScanResult(
                        source_id=str(post.get("uri") or url),
                        source_name=self.display_name,
                        title=title,
                        url=url,
                        description=str(external.get("description") or "").strip() or None,
                        raw_data={
                            "query": query,
                            "post_uri": post.get("uri"),
                            "author": author,
                            "likes": post.get("likeCount", 0),
                            "reposts": post.get("repostCount", 0),
                            "replies": post.get("replyCount", 0),
                            "indexed_at": post.get("indexedAt"),
                            "post_text": (post.get("record") or {}).get("text"),
                        },
                        is_structured=False,
                    )
                )

        logger.info(
            "Bluesky scan: %d anchored signals from %d queries "
            "(%d dropped without a link, %d below engagement floor)",
            len(results),
            len(self._queries()),
            dropped_no_link,
            dropped_quiet,
        )
        return results
