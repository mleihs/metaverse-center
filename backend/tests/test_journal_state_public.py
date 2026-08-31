"""Der Leerzustand des Journals darf nicht versprechen, was der Server nicht hält.

Befund G6. Gemessen auf Prod am 31.08.2026:

    select (select count(*) from journal_fragments),
           (select count(*) from journal_constellations),
           (select setting_value from platform_settings
             where setting_key='journal_enabled');
    → 0 · 0 · NULL

Null Fragmente, null Konstellationen — und die Zeile für ``journal_enabled``
existiert gar nicht. Seit F32 ist ``parse_setting_bool`` positiv abgleichend,
eine fehlende Zeile heißt also AUS, und der Fragment-Erzeuger hat nie einen
Tick gearbeitet. Der Leerzustand sagte trotzdem „Fragmente sammeln sich,
während du spielst".

Das ist die Umkehrung des Musters aus
``a-door-that-only-opens-for-those-inside``: dort fehlte der Tür der Erzeuger,
hier hat die Zusage keinen. In beiden Fällen sieht die Oberfläche in jedem
Code-Review vollständig aus — sie rendert korrekt, sie hat Übersetzungen, sie
hat Tests. Sie ist nur nicht wahr.

Diese Tests halten das Tor fest, das die Oberfläche befragt.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.dependencies import get_admin_supabase


def _mock_supabase_with_settings(rows: list[dict]) -> MagicMock:
    mock = MagicMock()
    result = MagicMock()
    result.data = rows

    chain = MagicMock()
    chain.select.return_value = chain
    chain.in_.return_value = chain
    chain.execute = AsyncMock(return_value=result)

    mock.table.return_value = chain
    return mock


@pytest.fixture()
def client():
    return TestClient(app)


class TestJournalStatePublic:
    def test_reports_the_gate_when_open(self, client: TestClient):
        supabase = _mock_supabase_with_settings([{"setting_key": "journal_enabled", "setting_value": "true"}])
        app.dependency_overrides[get_admin_supabase] = lambda: supabase
        try:
            r = client.get("/api/v1/public/journal/state")
            assert r.status_code == 200
            assert r.json()["data"]["enabled"] is True
        finally:
            app.dependency_overrides.clear()

    def test_reports_the_gate_when_shut(self, client: TestClient):
        supabase = _mock_supabase_with_settings([{"setting_key": "journal_enabled", "setting_value": "false"}])
        app.dependency_overrides[get_admin_supabase] = lambda: supabase
        try:
            r = client.get("/api/v1/public/journal/state")
            assert r.status_code == 200
            assert r.json()["data"]["enabled"] is False
        finally:
            app.dependency_overrides.clear()

    def test_the_production_shape_is_a_missing_row_and_it_means_shut(self, client: TestClient):
        """Der tatsächliche Prod-Zustand: die Zeile fehlt.

        Nicht ``"false"``, sondern gar nichts. Genau dieser Fall entschied
        unter der ALTEN, liberalen Auswertung noch auf True und hätte damit
        einen Zeitgeber scharfgeschaltet — der Anlass für F32.
        """
        supabase = _mock_supabase_with_settings([])
        app.dependency_overrides[get_admin_supabase] = lambda: supabase
        try:
            r = client.get("/api/v1/public/journal/state")
            assert r.status_code == 200
            assert r.json()["data"]["enabled"] is False
        finally:
            app.dependency_overrides.clear()

    def test_a_shut_gate_is_an_answer_not_a_404(self, client: TestClient):
        """Dieselbe Regel wie bei ``/drift/state``.

        Ein 404 zwänge die Oberfläche, eine fehlgeschlagene Anfrage von einem
        geschlossenen Tor zu unterscheiden — und sie würde es falsch machen,
        weil beides gleich aussieht. Ein geschlossenes Tor ist eine Antwort.
        """
        supabase = _mock_supabase_with_settings([])
        app.dependency_overrides[get_admin_supabase] = lambda: supabase
        try:
            r = client.get("/api/v1/public/journal/state")
            assert r.status_code == 200, "ein geschlossenes Tor darf nie als 404 erscheinen"
            assert r.json()["success"] is True
        finally:
            app.dependency_overrides.clear()

    def test_the_dto_carries_nothing_but_the_gate(self, client: TestClient):
        """Schmale Projektion: ``platform_settings`` bleibt service_role-only."""
        supabase = _mock_supabase_with_settings([{"setting_key": "journal_enabled", "setting_value": "true"}])
        app.dependency_overrides[get_admin_supabase] = lambda: supabase
        try:
            data = client.get("/api/v1/public/journal/state").json()["data"]
            assert set(data.keys()) == {"enabled"}, f"unerwartete Felder in der DTO: {data.keys()}"
        finally:
            app.dependency_overrides.clear()

    def test_the_route_is_registered(self):
        """Gegen ``app.openapi()``, nicht ``app.routes``.

        FastAPI fasst eingebundene Router zu ``_IncludedRouter`` zusammen; eine
        Prüfung über ``app.routes`` findet die Pfade der Unterrouter nicht und
        wäre grün, egal was hier steht.
        """
        assert "/api/v1/public/journal/state" in app.openapi()["paths"]
