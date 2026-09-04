"""Gespräche ohne Zuhörer — die vier Stellen, an denen es schiefgehen kann.

Diese Phase tut mit Absicht das, was Migration 356 im Chat gerade verboten
hat: EIN Modell schreibt alle Stimmen. Der Unterschied ist, dass es hier eine
Szene schreibt und keine Person. Aber damit verschiebt sich die Gefahr nur:
die Zuordnung entsteht nicht mehr im Protokoll, sondern hinterher, aus einem
Namen, den das Modell selbst gemeldet hat.

Deshalb die vier Gegenstände:

1. **Ein Zug mit unbekanntem Sprecher wird VERWORFEN, nicht geraten.** Ein
   falsch zugeordneter Zug stünde für immer unter dem Namen einer Figur, die
   ihn nie gesagt hat – genau der Fehler, den 356 behoben hat, nur eine Ebene
   später.
2. **Unbrauchbares JSON schreibt gar nichts.** Kein Ersatz aus einer Vorlage:
   ein erfundener Wortwechsel wäre schlimmer als keiner, weil der Mensch ihn
   für das hält, was seine Figuren gesagt haben.
3. **Das Tor ist fail-closed.** Fehlt die Zeile, läuft die Phase nicht. Eine
   Phase, die Modellaufrufe erzeugt, darf nicht dadurch anlaufen, dass jemand
   vergessen hat, sie abzuschalten.
4. **Ein verschlossener Faden bleibt still.** Wer verschliesst, hat eine Geste
   gemacht.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from backend.services.chat.continuation_service import (
    MAX_TURNS,
    MIN_TURNS,
    RECENT_WINDOW,
    ContinuationService,
)

NAMEN = ["Mira Steinfeld", "Elena Voss", "Lena Kray"]


def _json(*paare: tuple[str, str]) -> str:
    return json.dumps({"turns": [{"speaker": s, "content": c} for s, c in paare]})


class TestEinUnbekannterSprecherWirdVerworfen:
    """Die Stelle, an der die Zuordnung entsteht – und nicht raten darf."""

    def test_ein_fremder_name_faellt_raus(self):
        roh = _json(
            ("Mira Steinfeld", "Ich habe die Akte."),
            ("Doktor Fenn", "Und ich den Stempel."),
            ("Elena Voss", "Dann sind wir fertig."),
        )
        zuege = ContinuationService._parse_turns(roh, NAMEN)
        assert [z["speaker"] for z in zuege] == ["Mira Steinfeld", "Elena Voss"]

    def test_bleibt_zu_wenig_uebrig_ist_alles_unbrauchbar(self):
        """Ein Rest von einem Zug ist kein Wortwechsel."""
        roh = _json(("Mira Steinfeld", "Ich habe die Akte."), ("Doktor Fenn", "Wer sind Sie?"))
        assert ContinuationService._parse_turns(roh, NAMEN) == []

    def test_gross_und_kleinschreibung_zaehlt_nicht(self):
        """Ein Modell schreibt „mira steinfeld", und das ist dieselbe Person."""
        roh = _json(("mira steinfeld", "a"), ("ELENA VOSS", "b"))
        zuege = ContinuationService._parse_turns(roh, NAMEN)
        # Zurueckgeschrieben wird die KANONISCHE Schreibweise, nicht die des
        # Modells: sonst stuende der Name in der Datenbank in drei Varianten.
        assert [z["speaker"] for z in zuege] == ["Mira Steinfeld", "Elena Voss"]

    def test_ein_leerer_zug_zaehlt_nicht(self):
        roh = _json(("Mira Steinfeld", "a"), ("Elena Voss", "   "), ("Lena Kray", "c"))
        zuege = ContinuationService._parse_turns(roh, NAMEN)
        assert [z["speaker"] for z in zuege] == ["Mira Steinfeld", "Lena Kray"]


class TestUnbrauchbaresJsonSchreibtNichts:
    @pytest.mark.parametrize(
        "roh",
        [
            "",
            "   ",
            "Hier ist der Wortwechsel, aber ohne JSON.",
            '{"turns": "keine Liste"}',
            '{"kein_turns": []}',
            "{kaputt",
        ],
    )
    def test_nichts_kommt_heraus(self, roh):
        assert ContinuationService._parse_turns(roh, NAMEN) == []

    def test_ein_codeblock_wird_ausgepackt(self):
        roh = "Gern:\n```json\n" + _json(("Mira Steinfeld", "a"), ("Elena Voss", "b")) + "\n```"
        assert len(ContinuationService._parse_turns(roh, NAMEN)) == 2

    def test_vorspann_und_nachspann_stoeren_nicht(self):
        roh = "Also: " + _json(("Mira Steinfeld", "a"), ("Elena Voss", "b")) + " – so weit."
        assert len(ContinuationService._parse_turns(roh, NAMEN)) == 2

    def test_mehr_als_max_turns_wird_gekappt(self):
        roh = _json(*[("Mira Steinfeld", f"Zug {i}") for i in range(MAX_TURNS + 3)])
        assert len(ContinuationService._parse_turns(roh, NAMEN)) == MAX_TURNS


class TestDasTorIstFailClosed:
    async def _gate(self, rows):
        admin = MagicMock()
        kette = MagicMock()
        kette.select.return_value = kette
        kette.eq.return_value = kette
        kette.limit.return_value = kette
        kette.execute = AsyncMock(return_value=MagicMock(data=rows))
        admin.table.return_value = kette
        return await ContinuationService._gate_open(admin)

    async def test_ohne_zeile_zu(self):
        assert await self._gate([]) is False

    async def test_false_ist_zu(self):
        assert await self._gate([{"setting_value": "false"}]) is False

    async def test_null_ist_zu(self):
        """Ein jsonb-Null-Umlauf darf die Phase nicht scharfstellen."""
        assert await self._gate([{"setting_value": None}]) is False

    async def test_ein_tippfehler_ist_zu(self):
        """`parse_setting_bool` ist seit F32 positiv-pruefend. Frueher haette
        alles ausser {false,0,no,""} das Tor GEOEFFNET."""
        assert await self._gate([{"setting_value": "ture"}]) is False

    async def test_true_ist_auf(self):
        assert await self._gate([{"setting_value": "true"}]) is True

    async def test_geschlossenes_tor_laesst_nichts_laufen(self):
        with patch.object(ContinuationService, "_gate_open", AsyncMock(return_value=False)):
            with patch.object(ContinuationService, "_due_conversations", AsyncMock()) as auswahl:
                ergebnis = await ContinuationService.generate_for_simulation(MagicMock(), uuid4())
        assert ergebnis == []
        auswahl.assert_not_awaited(), "bei geschlossenem Tor wurde trotzdem ausgewaehlt"


class TestDieAuswahl:
    @staticmethod
    def _admin(rows):
        admin = MagicMock()
        kette = MagicMock()
        for name in ("select", "eq", "order"):
            getattr(kette, name).return_value = kette
        kette.execute = AsyncMock(return_value=MagicMock(data=rows))
        admin.table.return_value = kette
        return admin

    @staticmethod
    def _faden(**kw):
        basis = {
            "id": str(uuid4()),
            "locale": "de",
            "continue_interval_hours": 12,
            "continue_notify": "digest",
            "last_message_at": (datetime.now(UTC) - timedelta(hours=13)).isoformat(),
            "user_id": str(uuid4()),
        }
        basis.update(kw)
        return basis

    async def test_der_abstand_wird_eingehalten(self):
        """Zwoelf Stunden heisst zwoelf Stunden. Elf sind nicht faellig."""
        faden = self._faden(last_message_at=(datetime.now(UTC) - timedelta(hours=11)).isoformat())
        admin = self._admin([faden])
        with patch.object(ContinuationService, "_load_agents", AsyncMock(return_value=[{"id": "a"}, {"id": "b"}])):
            faellig = await ContinuationService._due_conversations(admin, uuid4(), limit=5)
        assert faellig == []

    async def test_abgelaufen_ist_faellig(self):
        admin = self._admin([self._faden()])
        with patch.object(ContinuationService, "_load_agents", AsyncMock(return_value=[{"id": "a"}, {"id": "b"}])):
            faellig = await ContinuationService._due_conversations(admin, uuid4(), limit=5)
        assert len(faellig) == 1

    async def test_ein_einzelner_agent_redet_nicht_mit_sich_selbst(self):
        admin = self._admin([self._faden()])
        with patch.object(ContinuationService, "_load_agents", AsyncMock(return_value=[{"id": "a"}])):
            faellig = await ContinuationService._due_conversations(admin, uuid4(), limit=5)
        assert faellig == []

    async def test_ein_faden_ohne_nachricht_hat_nichts_zum_anknuepfen(self):
        admin = self._admin([self._faden(last_message_at=None)])
        with patch.object(ContinuationService, "_load_agents", AsyncMock(return_value=[{"id": "a"}, {"id": "b"}])):
            assert await ContinuationService._due_conversations(admin, uuid4(), limit=5) == []

    async def test_das_budget_deckelt(self):
        admin = self._admin([self._faden() for _ in range(6)])
        with patch.object(ContinuationService, "_load_agents", AsyncMock(return_value=[{"id": "a"}, {"id": "b"}])):
            faellig = await ContinuationService._due_conversations(admin, uuid4(), limit=2)
        assert len(faellig) == 2

    async def test_verschlossene_faeden_stehen_in_der_bedingung(self):
        """Nicht nur im Teilindex aus 357: eine Abfrage, deren Richtigkeit an
        einem Index haengt, ist beim naechsten Index falsch."""
        admin = self._admin([])
        kette = admin.table.return_value
        await ContinuationService._due_conversations(admin, uuid4(), limit=2)
        bedingungen = [c.args for c in kette.eq.call_args_list]
        assert ("locked", False) in bedingungen
        assert ("continues_without_user", True) in bedingungen


class TestDieMitschriftIstDieJUENGSTE:
    async def test_absteigend_geholt_und_umgedreht(self):
        """Aufsteigend mit `limit` naehme die AELTESTEN – der Wortwechsel
        knuepfte dann fuer immer am ANFANG des Fadens an. Derselbe Fehler,
        den `_load_history` am 31.08. abgelegt hat."""
        admin = MagicMock()
        kette = MagicMock()
        for name in ("select", "eq", "order", "limit"):
            getattr(kette, name).return_value = kette
        kette.execute = AsyncMock(return_value=MagicMock(data=[{"content": "neu"}, {"content": "alt"}]))
        admin.table.return_value = kette
        rows = await ContinuationService._recent_messages(admin, uuid4())
        kette.order.assert_called_with("created_at", desc=True)
        kette.limit.assert_called_with(RECENT_WINDOW)
        assert [r["content"] for r in rows] == ["alt", "neu"]


class TestDieMarkeAmWortwechsel:
    async def test_jede_zeile_traegt_without_user(self):
        """Die Marke, an der die Oberflaeche einen Wortwechsel ohne Zuhoerer
        von einer Antwort auf den Menschen unterscheiden kann."""
        admin = MagicMock()
        einfuegen = MagicMock()
        einfuegen.execute = AsyncMock(return_value=MagicMock(data=[{}]))
        admin.table.return_value.insert.return_value = einfuegen
        agents = [
            {"id": "id-mira", "name": "Mira Steinfeld"},
            {"id": "id-elena", "name": "Elena Voss"},
        ]
        zuege = [
            {"speaker": "Mira Steinfeld", "content": "a"},
            {"speaker": "Elena Voss", "content": "b"},
        ]
        ok = await ContinuationService._persist(admin, uuid4(), uuid4(), zuege, agents, "deepseek/deepseek-v4-flash")
        assert ok
        zeilen = admin.table.return_value.insert.call_args.args[0]
        assert len(zeilen) == 2
        assert all(z["metadata"]["without_user"] is True for z in zeilen)
        assert [z["agent_id"] for z in zeilen] == ["id-mira", "id-elena"]

    async def test_ohne_zuordenbare_zeile_wird_nichts_geschrieben(self):
        admin = MagicMock()
        ok = await ContinuationService._persist(
            admin, uuid4(), uuid4(), [{"speaker": "Fremd", "content": "x"}], [], "m"
        )
        assert ok is False
        admin.table.return_value.insert.assert_not_called()


def test_die_zuglaenge_ist_ein_bereich_und_kein_punkt():
    """Zwei sind ein Wortwechsel, vier eine kurze Szene. Waeren MIN und MAX
    gleich, waere jeder Wortwechsel gleich lang und daran erkennbar."""
    assert MIN_TURNS >= 2
    assert MAX_TURNS > MIN_TURNS
