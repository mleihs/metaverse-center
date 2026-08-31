"""Was die Frontseite behauptet, muss sie belegen können.

Der Entwurf trug `47 worlds`, `3 epochs in play` und `128 resonances absorbed`.
Gemessen: 16, 0, 1. Dieser Test bewacht nicht die Zahlen — die ändern sich —
sondern die **Filter**, aus denen sie entstehen. Genau dort lagen die beiden
Fallen:

* Der Bestandsfilter. ``get_platform_stats`` filterte `status` nicht mit; sein
  Ergebnis war richtig, weil alle Vorlagen zufällig `active` sind, und mit der
  ersten archivierten Welt wäre es falsch geworden, ohne dass es jemand merkt.
  Dort ist es am 31.08.2026 nachgezogen worden — hier stand der Filter immer, und
  dieser Test hält ihn fest, damit er nicht wieder verschwindet.
* ``game_epochs`` kennt gar kein `status='active'`. Der Statusfilter allein
  zählt auf Prod **7 laufende Epochen**, die seit 164 bis 185 Tagen stillstehen.

Beides sind Fehler, die man einer Zahl nicht ansieht. Deshalb prüft der Test die
Bedingungen selbst: der falsche Client protokolliert jede Einschränkung, und die
Zusicherungen lesen sie zurück.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from backend.services.landing_service import LandingService


class _FakeQuery:
    """Ein Postgrest-Bauplan, der mitschreibt, statt zu fragen."""

    def __init__(self, store: _FakeClient, table: str) -> None:
        self._store = store
        self._table = table
        self._filters: list[tuple] = []
        self._count_mode: str | None = None
        self._limit: int | None = None
        self._negate = False

    # ── Bauplan ────────────────────────────────────────────────────────
    def select(self, *args, **kwargs) -> _FakeQuery:
        self._count_mode = kwargs.get("count")
        return self

    def eq(self, column: str, value: object) -> _FakeQuery:
        self._filters.append(("eq", column, value))
        return self

    def in_(self, column: str, values: list) -> _FakeQuery:
        self._filters.append(("in", column, list(values)))
        return self

    def gte(self, column: str, value: object) -> _FakeQuery:
        self._filters.append(("gte", column, value))
        return self

    def is_(self, column: str, value: object) -> _FakeQuery:
        kind = "not.is" if self._negate else "is"
        self._negate = False
        self._filters.append((kind, column, value))
        return self

    def limit(self, n: int) -> _FakeQuery:
        self._limit = n
        return self

    @property
    def not_(self) -> _FakeQuery:
        self._negate = True
        return self

    # ── Ausführung ─────────────────────────────────────────────────────
    async def execute(self) -> _FakeQuery:
        self._store.calls.append((self._table, list(self._filters)))
        rows = self._store.rows.get(self._table, [])
        self._rows = rows if self._limit is None else rows[: self._limit]
        return self

    @property
    def data(self) -> list[dict]:
        return self._rows

    @property
    def count(self) -> int:
        return len(self._rows)


class _FakeClient:
    def __init__(self, rows: dict[str, list[dict]]) -> None:
        self.rows = rows
        self.calls: list[tuple[str, list[tuple]]] = []

    def table(self, name: str) -> _FakeQuery:
        return _FakeQuery(self, name)

    def filters_for(self, table: str) -> list[tuple]:
        """Alle Einschränkungen, die je gegen eine Tabelle gestellt wurden."""
        return [f for name, filters in self.calls if name == table for f in filters]


def _now() -> datetime:
    return datetime.now(UTC)


def _world(idx: int, *, beat_age_days: float = 0.1, agents: int = 0) -> dict:
    return {
        "id": f"w{idx}",
        "slug": f"welt-{idx}",
        "name": f"Welt {idx}",
        "name_de": None,
        "description": "x",
        "description_de": None,
        "banner_url": "https://example.invalid/b.avif",
        "theme": "custom",
        "last_heartbeat_at": (_now() - timedelta(days=beat_age_days)).isoformat(),
        "_agents": agents,
    }


def _client(worlds: list[dict], **extra) -> _FakeClient:
    rows = {
        "simulations": worlds,
        "simulation_dashboard": [{"simulation_id": w["id"], "agent_count": w.get("_agents", 0)} for w in worlds],
        "game_epochs": extra.get("game_epochs", []),
        "substrate_resonances": extra.get("substrate_resonances", []),
        "agents": extra.get("agents", []),
        "agent_memories": extra.get("agent_memories", []),
        "buildings": extra.get("buildings", []),
        "events": extra.get("events", []),
    }
    return _FakeClient(rows)


@pytest.mark.asyncio
async def test_world_query_filters_status_not_only_type():
    """Der Fehler von ``get_platform_stats``, ausdrücklich nicht wiederholt.

    Ohne ``status='active'`` wirbt die Frontseite weiter mit einer archivierten
    Welt. Dass es heute nicht auffiele, ist der Grund für den Test: alle 16
    Vorlagen auf Prod sind gerade `active`, der Fehler wäre also unsichtbar,
    bis er es plötzlich nicht mehr ist.
    """
    client = _client([_world(1)])
    await LandingService.get_snapshot(client)

    filters = client.filters_for("simulations")
    assert ("eq", "simulation_type", "template") in filters
    assert ("eq", "status", "active") in filters, (
        "Die Welt-Abfrage filtert `status` nicht mit — genau der Schnitt, an dem "
        "eine archivierte Welt in die Zahlen der Frontseite geriete."
    )
    assert ("is", "deleted_at", "null") in filters


@pytest.mark.asyncio
async def test_epoch_query_demands_movement_not_just_status():
    """Ein Status ist kein Betrieb.

    Auf Prod stehen sieben Epochen in einem spielenden Status und keine hat
    sich seit 164 Tagen bewegt. Der Statusfilter allein hätte „7 Epochen im
    Spiel" auf die Frontseite geschrieben.
    """
    client = _client([_world(1)])
    await LandingService.get_snapshot(client)

    filters = client.filters_for("game_epochs")
    statuses = next(values for kind, column, values in filters if kind == "in" and column == "status")
    assert set(statuses) == {"foundation", "competition", "reckoning"}
    assert "lobby" not in statuses, "Eine Epoche, die auf Mitspieler wartet, ist nicht im Spiel."
    assert any(kind == "gte" and column == "updated_at" for kind, column, _ in filters), (
        "Ohne Frist zählt der Filter jede stillstehende Epoche mit."
    )


@pytest.mark.asyncio
async def test_stock_and_operation_are_counted_separately():
    """``worlds_live`` ist Bestand, ``worlds_transmitting`` ist Betrieb.

    Heute sind beide 16. Dass sie gleich sind, ist die Aussage — nicht die
    Selbstverständlichkeit. Velgarien stand ab dem 25.03. monatelang still,
    ohne dass es irgendwo sichtbar war.
    """
    worlds = [
        _world(1, beat_age_days=0.1),
        _world(2, beat_age_days=1.5),
        _world(3, beat_age_days=9),  # eingefroren
    ]
    snapshot = await LandingService.get_snapshot(_client(worlds))

    assert snapshot["counts"]["worlds_live"] == 3
    assert snapshot["counts"]["worlds_transmitting"] == 2


@pytest.mark.asyncio
async def test_world_without_heartbeat_is_not_transmitting():
    """Kein Zeitstempel heißt nicht „gerade eben"."""
    world = _world(1)
    world["last_heartbeat_at"] = None
    snapshot = await LandingService.get_snapshot(_client([world]))

    assert snapshot["counts"]["worlds_live"] == 1
    assert snapshot["counts"]["worlds_transmitting"] == 0
    assert snapshot["worlds"][0]["transmitting"] is False


@pytest.mark.asyncio
async def test_unreadable_heartbeat_does_not_crash_the_page():
    """Public-First: Browsen darf nie einen Fehler erzeugen."""
    world = _world(1)
    world["last_heartbeat_at"] = "keine Zeit"
    snapshot = await LandingService.get_snapshot(_client([world]))

    assert snapshot["counts"]["worlds_transmitting"] == 0


@pytest.mark.asyncio
async def test_grid_shows_the_best_populated_worlds_and_never_more_than_four():
    """Die vier Welten sind ausgewählt, nicht verdrahtet.

    Der Entwurf nannte Saltmeridian und The Gilded Hollow — beide existieren
    nicht, und beide standen als kriechbarer Link in der SEO-Fußzeile. Eine
    Auswahl aus dem Bestand kann nicht auf 404 zeigen.
    """
    worlds = [_world(i, agents=i) for i in range(1, 8)]
    snapshot = await LandingService.get_snapshot(_client(worlds))

    grid = snapshot["worlds"]
    assert len(grid) == 4
    assert [w["agent_count"] for w in grid] == [7, 6, 5, 4]


@pytest.mark.asyncio
async def test_world_without_slug_never_reaches_the_grid():
    """Eine Karte ohne Kennung wäre ein Link ins Leere."""
    good, bad = _world(1, agents=1), _world(2, agents=99)
    bad["slug"] = None
    snapshot = await LandingService.get_snapshot(_client([good, bad]))

    assert [w["slug"] for w in snapshot["worlds"]] == ["welt-1"]


@pytest.mark.asyncio
async def test_citizen_query_demands_portrait_profession_and_slug():
    """Jede Bedingung entspricht einem Feld auf der Dossierkarte.

    66 von 108 Agenten haben einen Beruf. Ohne die Bedingung zog die Abfrage
    drei ohne einen, und die Kartenzeile „Beruf · Zone" wäre leer geblieben.
    """
    client = _client([_world(1)])
    await LandingService.get_snapshot(client)

    filters = client.filters_for("agents")
    assert ("not.is", "portrait_image_url", "null") in filters
    assert ("not.is", "primary_profession", "null") in filters
    assert ("not.is", "slug", "null") in filters


@pytest.mark.asyncio
async def test_empty_platform_yields_zeroes_not_an_error():
    """Eine leere Plattform ist ein gültiger Zustand, kein Fehler."""
    snapshot = await LandingService.get_snapshot(_client([]))

    assert snapshot["counts"]["worlds_live"] == 0
    assert snapshot["worlds"] == []
    assert snapshot["citizens"] == []
    assert snapshot["measured_at"] is not None


# ── Die echten Ausgangssätze ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_the_real_sentences_replace_the_invented_ones():
    """Bis zum 31.08.2026 tippte der Schmiede-Abschnitt zwanzig erfundene
    Beispiele. Jetzt kommen die echten Sätze aus ``public_forge_prompts`` —
    der Sicht, die GENAU EINE Spalte herausgibt."""
    client = _client([_world(1)])
    client.rows["public_forge_prompts"] = [
        {
            "seed_prompt": "Ein Satz, der lang genug ist, um getippt zu werden, und kurz genug, um gelesen zu werden. "
            * 2
        },
    ]
    snapshot = await LandingService.get_snapshot(client)
    assert len(snapshot["forge_prompts"]) == 1
    assert snapshot["forge_prompts"][0]["text"].startswith("Ein Satz, der lang genug ist")
    # Ein Ausgangssatz wurde in EINER Sprache geschrieben; er wird nicht
    # maschinell verdoppelt.
    assert "text_de" not in snapshot["forge_prompts"][0]


@pytest.mark.asyncio
async def test_a_sentence_too_long_to_type_is_left_out():
    """Gemessen reicht der Bestand bis 1 122 Zeichen. Ein Satz dieser Länge
    tippt sich über eine Minute und hat die Seite längst verloren — das ist
    eine Darstellungsfrage und wird hier entschieden, nicht in der Sicht."""
    client = _client([_world(1)])
    client.rows["public_forge_prompts"] = [
        {"seed_prompt": "x" * 1122},
        {"seed_prompt": "zu kurz"},
    ]
    snapshot = await LandingService.get_snapshot(client)
    assert snapshot["forge_prompts"] == []


@pytest.mark.asyncio
async def test_without_sentences_the_section_falls_back():
    """Keine Sätze ist kein Fehler: der Abschnitt tippt dann seine Beispiele.
    Public-First — die Frontseite zeigt nie eine Fehlermeldung."""
    snapshot = await LandingService.get_snapshot(_client([_world(1)]))
    assert snapshot["forge_prompts"] == []


@pytest.mark.asyncio
async def test_whitespace_in_a_sentence_is_normalised():
    """Ein von Hand geschriebener Satz trägt Zeilenumbrüche. Der
    Schreibmaschinen-Effekt tippt Zeichen für Zeichen — ein Umbruch mitten
    darin risse die Zeile auf."""
    client = _client([_world(1)])
    client.rows["public_forge_prompts"] = [
        {
            "seed_prompt": "Erste Zeile\n\nZweite Zeile mit genug Text, damit der Satz die Untergrenze von achtzig Zeichen sicher ueberschreitet."
        },
    ]
    snapshot = await LandingService.get_snapshot(client)
    assert "\n" not in snapshot["forge_prompts"][0]["text"]
