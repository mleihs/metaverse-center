"""Zwei Löcher im Gedächtnis eines Agenten.

Der Nutzer fragte, wie ein Agent bei 300 Nachrichten noch weiß, was bei
Nachricht 120 stand. Der Weg dafür ist Beobachtung → Einbettung → semantischer
Abruf, und beim Nachmessen an der Produktionsdatenbank hatten beide Enden
davon ein Leck.

① DER NULLVEKTOR STAND IN JEDEM ABRUF AUF PLATZ 1
``EmbeddingService.embed`` gab bei jedem Fehlschlag einen Nullvektor zurück
statt zu melden, dass keiner zu holen war. pgvector liefert dafür ``NaN``, und
PostgreSQL sortiert ``NaN`` in ``ORDER BY … DESC`` vor jede Zahl — an der
Produktionsdatenbank nachgestellt:

    NULLVEKTOR       NaN    Platz 1
    gute Erinnerung  0.9    Platz 2

Eine einzige fehlgeschlagene Einbettung besetzte damit dauerhaft den ersten von
acht Plätzen, mit einer Erinnerung, die zur Frage nichts beiträgt. Unsichtbar:
nichts schlug fehl, es stand nur immer dasselbe zuoberst.

② DIE VERDICHTUNG LIEF NIE VON SELBST
``reflect()`` hing nur an einem Endpunkt, den jemand von Hand aufruft. Auf
Produktion: fünf Verdichtungen gegen 300 Beobachtungen. Für ein langes Gespräch
ist genau das der Engpass — acht flache Beobachtungen tragen weniger als eine
Einsicht, die fünfzig zusammenfasst.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import UUID, uuid4

import pytest

from backend.services.agent_memory_service import AgentMemoryService
from backend.services.embedding_service import EmbeddingService


class TestEinFehlschlagSchreibtKeinenVektor:
    """``embed`` muss ``None`` sagen, nicht Nullen erfinden."""

    @pytest.mark.asyncio
    async def test_ohne_schluessel_kommt_none_statt_nullvektor(self) -> None:
        with (
            patch("backend.services.embedding_service._load_embedding_config", AsyncMock(return_value=("m", 1536))),
            patch("backend.services.embedding_service.settings") as s,
        ):
            s.forge_mock_mode = False
            s.openrouter_api_key = ""
            assert await EmbeddingService.embed("text", api_key=None) is None

    @pytest.mark.asyncio
    async def test_auch_im_mock_betrieb_kein_nullvektor(self) -> None:
        """Der Testlauf muss denselben Weg nehmen wie ein Fehlschlag.

        Sonst prüft er einen Pfad, den es in der Produktion nicht gibt — und
        genau dort entstand der Nullvektor.
        """
        with (
            patch("backend.services.embedding_service._load_embedding_config", AsyncMock(return_value=("m", 1536))),
            patch("backend.services.embedding_service.settings") as s,
        ):
            s.forge_mock_mode = True
            assert await EmbeddingService.embed("text") is None

    def test_der_schreibpfad_setzt_die_spalte_leer(self) -> None:
        """``record_observation`` darf keinen vergifteten Vektor schreiben."""
        import inspect

        code = inspect.getsource(AgentMemoryService.record_observation)
        assert '"embedding": str(embedding) if embedding else None' in code, (
            "Ein leerer Vektor landet wieder als str(None) oder als Nullvektor in der Spalte."
        )


class TestWerIstFaelligFuerEineVerdichtung:
    """Die Auswahlregel — ohne sie läuft die Verdichtung nie oder immer."""

    @staticmethod
    def _client(reflexionen: list[dict], beobachtungen: list[dict]):
        """Ein Doppelgänger, der auf `memory_type` unterschiedlich antwortet."""

        class _Query:
            def __init__(self) -> None:
                self._typ = ""

            def select(self, *_a, **_k):
                return self

            def eq(self, feld, wert):
                if feld == "memory_type":
                    self._typ = wert
                return self

            def order(self, *_a, **_k):
                return self

            async def execute(self):
                daten = reflexionen if self._typ == "reflection" else beobachtungen
                return SimpleNamespace(data=daten)

        return SimpleNamespace(table=lambda _n: _Query())

    @pytest.mark.asyncio
    async def test_unter_der_schwelle_passiert_nichts(self) -> None:
        a = str(uuid4())
        client = self._client([], [{"agent_id": a, "created_at": "2026-09-01"}] * 49)
        assert await AgentMemoryService._agents_due_for_reflection(client, uuid4(), 2) == []

    @pytest.mark.asyncio
    async def test_ab_der_schwelle_wird_verdichtet(self) -> None:
        a = str(uuid4())
        client = self._client([], [{"agent_id": a, "created_at": "2026-09-01"}] * 50)
        faellig = await AgentMemoryService._agents_due_for_reflection(client, uuid4(), 2)
        assert faellig == [(UUID(a), 50)]

    @pytest.mark.asyncio
    async def test_nur_was_nach_der_letzten_verdichtung_kam_zaehlt(self) -> None:
        """Sonst wäre jeder Agent nach der ersten Verdichtung für immer fällig."""
        a = str(uuid4())
        client = self._client(
            [{"agent_id": a, "created_at": "2026-09-01T12:00:00"}],
            [{"agent_id": a, "created_at": "2026-09-01T10:00:00"}] * 80,  # ALT
        )
        assert await AgentMemoryService._agents_due_for_reflection(client, uuid4(), 2) == []

    @pytest.mark.asyncio
    async def test_das_budget_begrenzt_die_modellaufrufe(self) -> None:
        """Ein Tick darf nicht unbegrenzt kosten."""
        a, b, c = str(uuid4()), str(uuid4()), str(uuid4())
        beob = (
            [{"agent_id": a, "created_at": "2026-09-01"}] * 90
            + [{"agent_id": b, "created_at": "2026-09-01"}] * 70
            + [{"agent_id": c, "created_at": "2026-09-01"}] * 60
        )
        faellig = await AgentMemoryService._agents_due_for_reflection(self._client([], beob), uuid4(), 2)
        assert len(faellig) == 2
        # Die Fälligsten zuerst: wer am meisten Ungesehenes hat, zuerst.
        assert [n for _, n in faellig] == [90, 70]

    @pytest.mark.asyncio
    async def test_ein_scheiternder_agent_reisst_die_uebrigen_nicht_mit(self) -> None:
        """Der Tick darf an einer misslungenen Verdichtung nicht sterben."""
        a, b = uuid4(), uuid4()
        with (
            patch.object(
                AgentMemoryService,
                "_agents_due_for_reflection",
                AsyncMock(return_value=[(a, 60), (b, 55)]),
            ),
            patch.object(AgentMemoryService, "_content_locale", AsyncMock(return_value="de")),
            patch.object(
                AgentMemoryService,
                "reflect",
                AsyncMock(side_effect=[RuntimeError("Modell weg"), [{"id": "r2"}]]),
            ),
        ):
            ergebnis = await AgentMemoryService.reflect_due_agents(object(), uuid4(), budget=2)

        assert len(ergebnis) == 1
        assert ergebnis[0]["agent_id"] == str(b)


class TestDieVerdichtungHaengtImHerzschlag:
    """Ein Dienst, den niemand aufruft, ist kein Dienst."""

    def test_phase_97_ruft_sie_auf(self) -> None:
        from pathlib import Path

        code = Path("backend/services/heartbeat_service.py").read_text(encoding="utf-8")
        assert "AgentMemoryService.reflect_due_agents(" in code, "Die Verdichtung hängt wieder an keinem Tick."
        assert "Phase 9.7" in code
        # Nach den Flüstern, damit die Beobachtungen dieses Ticks mitzählen.
        assert code.index("Phase 9.6") < code.index("Phase 9.7") < code.index("Phase 10")
