"""Wenn eine neue Beobachtung eine alte aufhebt — und wann nicht.

Migration 379 hat dem Gedaechtnis Gueltigkeit gegeben. Gemessen am
05.09.2026, unmittelbar nach dem Ausrollen:

    Erinnerungen gesamt                   504
    davon mit Gueltigkeitsfenster           0
    davon als ueberholt markiert            0

Der Weg war gebaut und ging ihn niemand. Diese Datei prueft den Erkenner,
der ihn geht — und vor allem die Richtung, in die er im Zweifel faellt.

⚠ DIE RICHTUNG DES ZWEIFELS IST DER KERN. Eine faelschlich aufgehobene
Erinnerung nimmt einer Figur etwas weg, das sie wusste. Eine faelschlich
behaltene kostet Platz. Jeder unklare Fall muss deshalb auf NEIN fallen, und
zwar an DREI Stellen unabhaengig: in der Vorlage, in der Fassade und am Tor.

Alle Namen sind erfunden (`scripts/lint-no-chat-content.sh`).
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from backend.models.generation import MemorySupersessionVerdict
from backend.services.memory_supersede_service import (
    BUDGET,
    FEATURE_GATE,
    KANDIDAT_ABSTAND,
    PURPOSE,
)
from backend.services.memory_supersede_service import (
    MemorySupersedeService as M,
)


def _klient(*, tor: bool, kandidaten: list[dict] | None = None, namen: list[dict] | None = None):
    """Ein Supabase-Doppelgaenger, der JE TABELLE antwortet."""

    def kette(daten):
        k = MagicMock()
        for n in ("select", "eq", "limit", "in_"):
            getattr(k, n).return_value = k
        k.execute = AsyncMock(return_value=MagicMock(data=daten))
        return k

    klient = MagicMock()
    tabellen = {
        "platform_settings": [{"setting_value": True}] if tor else [],
        "agents": namen if namen is not None else [],
    }
    klient.table.side_effect = lambda name: kette(tabellen.get(name, []))
    klient.rpc.return_value = kette(kandidaten or [])
    return klient


def _paar(abstand=0.08, agent=None):
    agent = agent or str(uuid4())
    return {
        "kandidat_agent_id": agent,
        "neuere_id": str(uuid4()),
        "neuere_inhalt": "Marie fuehrt das Archiv nicht mehr.",
        "neuere_erstellt": "2026-09-05T12:00:00",
        "aeltere_id": str(uuid4()),
        "aeltere_inhalt": "Marie fuehrt das Archiv.",
        "aeltere_erstellt": "2026-09-01T12:00:00",
        "abstand": abstand,
    }


class TestDasTorIstFailClosed:
    """Der Dienst SCHREIBT ins Gedaechtnis. Er darf nicht dadurch anlaufen,
    dass jemand vergessen hat, ihn abzuschalten."""

    async def test_ohne_zeile_laeuft_nichts(self):
        klient = _klient(tor=False, kandidaten=[_paar()])
        assert await M.run_for_simulation(klient, uuid4()) == []
        assert not klient.rpc.called, "bei geschlossenem Tor wurde trotzdem gesucht"

    async def test_ein_fehler_beim_tor_haelt_es_zu(self):
        klient = MagicMock()
        klient.table.side_effect = RuntimeError("Datenbank weg")
        assert await M._gate_open(klient) is False

    async def test_ein_tippfehler_ist_zu(self):
        """`parse_setting_bool` ist positiv-pruefend. Frueher haette alles
        ausser {false,0,no,""} das Tor GEOEFFNET."""
        klient = _klient(tor=False)
        klient.table.side_effect = lambda _n: MagicMock(
            select=MagicMock(
                return_value=MagicMock(
                    eq=MagicMock(
                        return_value=MagicMock(
                            limit=MagicMock(
                                return_value=MagicMock(
                                    execute=AsyncMock(return_value=MagicMock(data=[{"setting_value": "ture"}]))
                                )
                            )
                        )
                    )
                )
            )
        )
        assert await M._gate_open(klient) is False


class TestImZweifelNein:
    """Die zentrale Zusage, an jeder der drei Stellen einzeln geprueft."""

    async def test_ein_nein_markiert_nichts(self):
        klient = _klient(tor=True, kandidaten=[_paar()], namen=[{"id": "x", "name": "Marie Morgenrot"}])
        with (
            patch("backend.services.memory_supersede_service.GenerationService") as gen,
            patch("backend.services.memory_supersede_service.AgentMemoryService.supersede", AsyncMock()) as sup,
        ):
            gen.return_value.judge_memory_supersession = AsyncMock(
                return_value=MemorySupersessionVerdict(supersedes=False, reason="nur eine Ergaenzung")
            )
            assert await M.run_for_simulation(klient, uuid4()) == []
        sup.assert_not_awaited()

    async def test_ein_ja_markiert(self):
        """Die Gegenprobe. Ohne sie pruefte der Test oben nur, dass nichts
        passiert."""
        klient = _klient(tor=True, kandidaten=[_paar()], namen=[{"id": "x", "name": "Marie Morgenrot"}])
        with (
            patch("backend.services.memory_supersede_service.GenerationService") as gen,
            patch("backend.services.memory_supersede_service.AgentMemoryService.supersede", AsyncMock()) as sup,
        ):
            gen.return_value.judge_memory_supersession = AsyncMock(
                return_value=MemorySupersessionVerdict(supersedes=True, reason="Rolle abgegeben")
            )
            erledigt = await M.run_for_simulation(klient, uuid4())
        assert len(erledigt) == 1
        assert erledigt[0]["grund"] == "Rolle abgegeben"
        sup.assert_awaited_once()

    async def test_ein_scheiterndes_urteil_reisst_die_uebrigen_nicht_mit(self):
        """Ein Paar, dessen Urteil scheitert, darf den Takt nicht toeten."""
        klient = _klient(tor=True, kandidaten=[_paar(), _paar()], namen=[{"id": "x", "name": "Marie Morgenrot"}])
        with (
            patch("backend.services.memory_supersede_service.GenerationService") as gen,
            patch("backend.services.memory_supersede_service.AgentMemoryService.supersede", AsyncMock()),
        ):
            gen.return_value.judge_memory_supersession = AsyncMock(
                side_effect=[RuntimeError("Modell weg"), MemorySupersessionVerdict(supersedes=True, reason="ok")]
            )
            erledigt = await M.run_for_simulation(klient, uuid4())
        assert len(erledigt) == 1, "das zweite Paar wurde nicht mehr beurteilt"

    def test_die_fassade_wertet_unlesbar_als_nein(self):
        """Die zweite der drei Stellen. Ein nicht lesbares JSON heisst NEIN,
        nicht „vielleicht"."""
        import inspect

        from backend.services.generation_service import GenerationService

        quelle = inspect.getsource(GenerationService.judge_memory_supersession)
        assert "if not parsed:" in quelle
        assert "supersedes=False" in quelle

    def test_die_vorlage_sagt_es_auch(self):
        """Die dritte Stelle: die Migration schreibt „Im Zweifel: nein" in
        beide Sprachfassungen. Ein Tor, das nur den Code prueft, uebersieht,
        dass die Anweisung selbst kippen kann."""
        import pathlib

        sql = pathlib.Path(
            "supabase/migrations/20260905220000_383_ein_widerspruch_der_niemandem_auffaellt.sql"
        ).read_text(encoding="utf-8")
        assert "Im Zweifel: nein" in sql
        assert "When in doubt: no" in sql


class TestDieBilligeStufeFiltertZuerst:
    async def test_die_suche_geht_durch_die_rpc(self):
        """Der Vektorabstand ist ein Operator und gehoert in SQL. Ein
        Python-Durchlauf ueber alle Paare waere O(n²) ueber die
        Anwendungsgrenze (ADR-007)."""
        klient = _klient(tor=True, kandidaten=[])
        await M.run_for_simulation(klient, uuid4())
        name, params = klient.rpc.call_args[0]
        assert name == "fn_supersede_candidates"
        assert params["p_max_distance"] == KANDIDAT_ABSTAND
        assert params["p_limit"] == BUDGET

    async def test_ohne_kandidaten_kein_modellaufruf(self):
        klient = _klient(tor=True, kandidaten=[])
        with patch("backend.services.memory_supersede_service.GenerationService") as gen:
            assert await M.run_for_simulation(klient, uuid4()) == []
        gen.assert_not_called()

    def test_die_schwelle_ist_gemessen_nicht_geraten(self):
        """0,15 — darueber liegen 66 von 496 Beobachtungen (13 %), darunter
        28 (5,6 %), bei 0,10 nur noch 7. Gemessen am 05.09.2026 an 495
        eingebetteten Beobachtungen auf Produktion."""
        assert 0.05 < KANDIDAT_ABSTAND < 0.25

    def test_der_dienst_rechnet_den_abstand_nicht_selbst(self):
        import inspect

        quelle = inspect.getsource(M)
        for verboten in ("cosine", "numpy", "np.", "dot(", "norm("):
            assert verboten not in quelle


class TestEinEigenerZweckUndEinEigenesTor:
    def test_der_zweck_ist_nicht_chat_response(self):
        """Eine Aenderung an der Chat-Vorgabe darf diese Pruefung nicht still
        verteuern — dieselbe Begruendung wie bei `agent_continuation`."""
        from backend.services.ai_purposes import AI_PURPOSES

        assert PURPOSE == "memory_supersede"
        assert PURPOSE in AI_PURPOSES
        assert AI_PURPOSES[PURPOSE].max_tokens <= 400, "ein Ja/Nein braucht kein grosses Budget"

    def test_das_tor_steht_im_vertrag(self):
        from backend.services.platform_gate_contracts import PLATFORM_GATES

        tore = {g.key: g for g in PLATFORM_GATES}
        assert FEATURE_GATE in tore
        assert tore[FEATURE_GATE].default_when_missing is False
        assert tore[FEATURE_GATE].reader == "backend/services/memory_supersede_service.py"

    def test_geloescht_wird_nichts(self):
        """„Ueberholt" heisst: faellt aus dem Abruf, die Zeile bleibt stehen.
        Ein Gedaechtnis, das Vergangenes nicht mehr benennen kann, ist aermer
        als eines, das zu viel behaelt (Migration 379)."""
        import inspect

        quelle = inspect.getsource(M)
        assert ".delete(" not in quelle
        assert "DELETE" not in quelle
