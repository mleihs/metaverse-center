"""Das Dashboard darf nur zeigen, was es belegen kann.

Der Entwurf des Dashboards (Claude Design, 31.08.2026) verlangte neun Dinge und
trug sechs davon als Platzhalter im Prototyp. Nachgemessen auf Prod existieren
vier davon wirklich — Weltkunst, Lore und Sinnspruch, Agentenporträts und der
Substratzustand. Zwei fehlen, und sie fehlen VERSCHIEDEN:

* die **Zyklusfrist** ist vollständig gebaut und hat keinen Gegenstand. Drei
  Schreiber, ein Leser, der Zeitgeber läuft — und null von sieben Epochen haben
  eine Frist, weil jede stillsteht, seit bevor es die Spalte gab (Migration 204
  kam am 13.04., die jüngste Epoche bewegte sich am 20.03.);
* einen **Order-Zähler mit Nenner** gibt es überhaupt nicht; messbar ist nur
  ``has_acted_this_cycle``, ein Ja/Nein.

Diese Tests halten fest, dass der Dienst das so meldet, wie es ist. Der
Präzedenzfall steht auf der Frontseite: dort trug der Entwurf ``47 worlds``,
``3 epochs in play`` und ``128 resonances``, gemessen waren es 16, 0 und 1. Eine
erfundene Zahl ist schlimmer als eine fehlende, weil man ihr nicht ansieht, dass
sie erfunden ist.

DIE ATTRAPPE FILTERT WIRKLICH. Sie gibt nicht einfach alle Zeilen zurück,
sondern wendet ``eq``/``in_``/``is_`` an. Ohne das könnten die beiden
Substrat-Abfragen — „wie viele Beben sind im Spiel" und „wird gerade gestört" —
nicht auseinanderlaufen, und der Test bewiese nur, dass zweimal gefragt wurde.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from backend.services.user_dashboard_service import UserDashboardService

_SIM = "11111111-1111-1111-1111-111111111111"
_SIM2 = "22222222-2222-2222-2222-222222222222"
_EPOCH = "e0000001-0000-0000-0000-000000000001"


class _FakeQuery:
    """Ein Postgrest-Bauplan, der die Einschränkungen wirklich anwendet."""

    def __init__(self, store: _FakeClient, table: str) -> None:
        self._store = store
        self._table = table
        self._filters: list[tuple[str, str, object]] = []
        self._counting = False
        self._order: str | None = None

    def select(self, *_args, **kwargs) -> _FakeQuery:
        self._counting = kwargs.get("count") == "exact"
        return self

    def eq(self, column: str, value: object) -> _FakeQuery:
        self._filters.append(("eq", column, value))
        return self

    def in_(self, column: str, values: list) -> _FakeQuery:
        self._filters.append(("in", column, list(values)))
        return self

    def is_(self, column: str, value: object) -> _FakeQuery:
        self._filters.append(("is", column, value))
        return self

    def order(self, column: str) -> _FakeQuery:
        self._order = column
        return self

    def maybe_single(self) -> _FakeQuery:
        self._filters.append(("single", "", True))
        return self

    @staticmethod
    def _read(row: dict, column: str):
        """Auch verschachtelt: postgrest filtert über \"game_epochs.status\"."""
        cur: object = row
        for part in column.split("."):
            if not isinstance(cur, dict):
                return None
            cur = cur.get(part)
        return cur

    def _matches(self, row: dict) -> bool:
        for kind, column, value in self._filters:
            if kind == "eq" and self._read(row, column) != value:
                return False
            if kind == "in" and self._read(row, column) not in value:
                return False
            if kind == "is" and value == "null" and self._read(row, column) is not None:
                return False
        return True

    async def execute(self) -> _FakeQuery:
        self._store.calls.append((self._table, list(self._filters)))
        rows = [r for r in self._store.rows.get(self._table, []) if self._matches(r)]
        if self._order:
            rows = sorted(rows, key=lambda r: r.get(self._order) or 0)
        self._rows = rows
        return self

    @property
    def data(self):
        if any(k == "single" for k, _, _ in self._filters):
            return self._rows[0] if self._rows else None
        return self._rows

    @property
    def count(self) -> int | None:
        return len(self._rows) if self._counting else None


class _FakeClient:
    def __init__(self, rows: dict[str, list[dict]]) -> None:
        self.rows = rows
        self.calls: list[tuple[str, list[tuple]]] = []

    def table(self, name: str) -> _FakeQuery:
        return _FakeQuery(self, name)


def _rows(**over) -> dict[str, list[dict]]:
    base: dict[str, list[dict]] = {
        "simulation_members": [
            {
                "user_id": "u1",
                "simulation_id": _SIM,
                "member_role": "architect",
                "simulations": {"simulation_type": "template"},
            },
        ],
        "simulation_dashboard": [
            {
                "simulation_id": _SIM,
                "name": "Velgarien",
                "name_de": None,
                "slug": "velgarien",
                "description": "A dystopian world.",
                "description_de": "Eine dystopische Welt.",
                "theme": "dystopian",
                "banner_url": "https://example/banner.avif",
                "agent_count": 42,
                "building_count": 17,
            },
        ],
        "simulation_lore": [],
        "epoch_participants": [],
        "user_profiles": [{"id": "u1", "academy_epochs_played": 3}],
        "substrate_resonances": [],
    }
    base.update(over)
    return base


async def _dashboard(rows: dict[str, list[dict]]):
    client = _FakeClient(rows)
    return await UserDashboardService.get_dashboard(client, client, "u1")


# ── Substrat: Bestandszahl und Zustand sind ZWEI Fragen ────────────────────


@pytest.mark.asyncio
async def test_a_subsiding_tremor_counts_but_does_not_disturb():
    """Der Fall, für den die Trennung da ist — und der auf Prod vorliegt.

    Genau EIN Beben, Status ``subsiding``. Es gehört in die Bestandszahl (es ist
    im Spiel) und NICHT in den Zustand (es stört nicht mehr). Legte man beide
    zusammen, zeigte die Befehlsleiste ihre rote Warnzeile, während nichts mehr
    passiert.
    """
    data = await _dashboard(_rows(substrate_resonances=[{"id": "r1", "status": "subsiding", "deleted_at": None}]))
    assert data.active_resonance_count == 1
    assert data.substrate_status == "stable"


@pytest.mark.parametrize("status", ["detected", "impacting"])
@pytest.mark.asyncio
async def test_a_live_tremor_makes_the_substrate_anomalous(status: str):
    data = await _dashboard(_rows(substrate_resonances=[{"id": "r1", "status": status, "deleted_at": None}]))
    assert data.substrate_status == "anomalous"
    assert data.active_resonance_count == 1


@pytest.mark.asyncio
async def test_no_tremor_at_all_is_stable():
    data = await _dashboard(_rows())
    assert data.substrate_status == "stable"
    assert data.active_resonance_count == 0


@pytest.mark.asyncio
async def test_a_deleted_tremor_counts_for_neither():
    data = await _dashboard(
        _rows(substrate_resonances=[{"id": "r1", "status": "impacting", "deleted_at": "2026-01-01T00:00:00Z"}])
    )
    assert data.substrate_status == "stable"
    assert data.active_resonance_count == 0


@pytest.mark.asyncio
async def test_an_archived_tremor_counts_for_neither():
    data = await _dashboard(_rows(substrate_resonances=[{"id": "r1", "status": "archived", "deleted_at": None}]))
    assert data.substrate_status == "stable"
    assert data.active_resonance_count == 0


# ── Die Zyklusfrist darf fehlen ────────────────────────────────────────────


def _participation(*, deadline=None, acted=False) -> dict:
    return {
        "epoch_id": _EPOCH,
        "current_rp": 12,
        "has_acted_this_cycle": acted,
        "game_epochs": {
            "id": _EPOCH,
            "name": "The Convergence Protocol",
            "status": "competition",
            "epoch_type": "competitive",
            "current_cycle": 7,
            "config": {"rp_cap": 30, "cycle_hours": 8, "duration_days": 14},
            "cycle_deadline_at": deadline,
        },
        "simulations": {"name": "Velgarien", "banner_url": "https://example/epoch.avif"},
        "user_id": "u1",
        "is_bot": False,
    }


@pytest.mark.asyncio
async def test_a_missing_deadline_stays_missing():
    """Auf Prod haben ALLE sieben Epochen keine Frist. Der Dienst darf da nichts
    hinrechnen — kein `ends_at` als Ersatz, keine aus `cycle_hours` geschätzte
    Zeit. Die Oberfläche muss den leeren Countdown zeigen können."""
    data = await _dashboard(_rows(epoch_participants=[_participation(deadline=None)]))
    assert len(data.active_epoch_participations) == 1
    assert data.active_epoch_participations[0].cycle_deadline_at is None


@pytest.mark.asyncio
async def test_the_stage_gets_the_real_world_art():
    """Der Entwurf legte ein eigenes Bühnenbild bei. Gemessen tragen alle 20
    Epochen-Klone auf Prod ein ``banner_url`` — das echte Bild der Welt, in der
    gespielt wird, ist besser als ein mitgeliefertes Standbild."""
    data = await _dashboard(_rows(epoch_participants=[_participation()]))
    assert data.active_epoch_participations[0].simulation_banner_url == "https://example/epoch.avif"


@pytest.mark.asyncio
async def test_a_present_deadline_is_passed_through():
    when = datetime.now(UTC) + timedelta(hours=5)
    data = await _dashboard(_rows(epoch_participants=[_participation(deadline=when.isoformat())]))
    got = data.active_epoch_participations[0].cycle_deadline_at
    assert got is not None
    assert abs((got - when).total_seconds()) < 2


@pytest.mark.parametrize("acted", [True, False])
@pytest.mark.asyncio
async def test_the_binary_action_state_is_reported_as_a_binary(acted: bool):
    """„Orders placed 1/3" gibt es nicht. Was es gibt, ist ein Ja/Nein — und
    genau das steht im DTO, ohne erfundenen Nenner."""
    data = await _dashboard(_rows(epoch_participants=[_participation(acted=acted)]))
    assert data.active_epoch_participations[0].has_acted_this_cycle is acted


# ── Meine Welten ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_world_carries_what_the_switcher_shows():
    data = await _dashboard(
        _rows(
            simulation_lore=[
                {
                    "simulation_id": _SIM,
                    "sort_order": 1,
                    "title": "Zweite Kammer",
                    "title_de": "Zweite Kammer",
                    "body": "second",
                    "body_de": "zweite",
                    "epigraph": "B",
                    "epigraph_de": "b",
                },
                {
                    "simulation_id": _SIM,
                    "sort_order": 0,
                    "title": "First Chamber",
                    "title_de": "Erste Kammer",
                    "body": "first",
                    "body_de": "erste",
                    "epigraph": "A",
                    "epigraph_de": "a",
                },
            ]
        )
    )
    assert len(data.worlds) == 1
    world = data.worlds[0]
    assert world.theme == "dystopian"
    assert world.banner_url == "https://example/banner.avif"
    assert (world.agent_count, world.building_count) == (42, 17)
    assert world.member_role == "architect"
    assert world.description_de == "Eine dystopische Welt."
    # Die ERSTE Kammer, nicht die zuerst gelieferte Zeile.
    assert (world.lore_body_de, world.lore_epigraph_de) == ("erste", "a")
    # Die Quellenangabe unter dem Zitat ist die Kammer, nicht eine erfundene Stimme.
    assert world.lore_title_de == "Erste Kammer"


@pytest.mark.asyncio
async def test_a_world_without_lore_is_still_a_world():
    """Nicht jede Welt hat eine Kammer. Die Kachel darf trotzdem erscheinen —
    fehlende Lore ist kein Grund, eine Welt zu verschweigen."""
    data = await _dashboard(_rows())
    assert len(data.worlds) == 1
    assert data.worlds[0].lore_body_de is None
    assert data.worlds[0].lore_epigraph is None


@pytest.mark.asyncio
async def test_epoch_clones_are_not_my_worlds():
    """Ein Klon gehört einer Epoche, nicht der Person. Er taucht in „Meine
    Welten" nicht auf — sonst stünde dieselbe Welt drei- bis sechsmal da."""
    data = await _dashboard(
        _rows(
            simulation_members=[
                {
                    "user_id": "u1",
                    "simulation_id": _SIM,
                    "member_role": "architect",
                    "simulations": {"simulation_type": "template"},
                },
                {
                    "user_id": "u1",
                    "simulation_id": _SIM2,
                    "member_role": "architect",
                    "simulations": {"simulation_type": "game_instance"},
                },
            ],
            simulation_dashboard=[
                {
                    "simulation_id": _SIM,
                    "name": "Velgarien",
                    "name_de": None,
                    "slug": "velgarien",
                    "theme": "dystopian",
                    "banner_url": None,
                    "agent_count": 1,
                    "building_count": 1,
                },
                {
                    "simulation_id": _SIM2,
                    "name": "Velgarien (Epoch 3)",
                    "name_de": None,
                    "slug": "velgarien-e3",
                    "theme": "dystopian",
                    "banner_url": None,
                    "agent_count": 1,
                    "building_count": 1,
                },
            ],
        )
    )
    assert [w.slug for w in data.worlds] == ["velgarien"]


@pytest.mark.asyncio
async def test_no_worlds_means_no_queries_for_them():
    """Ohne Mitgliedschaft darf der Dienst die beiden Folgeabfragen gar nicht
    erst stellen — ein `in_` mit leerer Liste ist eine Abfrage, die niemand
    braucht."""
    client = _FakeClient(_rows(simulation_members=[]))
    data = await UserDashboardService.get_dashboard(client, client, "u1")
    assert data.worlds == []
    tables = [name for name, _ in client.calls]
    assert "simulation_dashboard" not in tables
    assert "simulation_lore" not in tables
