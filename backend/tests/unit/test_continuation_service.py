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
import pathlib
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
    """Seit Migration 365 entscheidet POSTGRES ueber die Faelligkeit.

    Der Zeit-Riegel (`last_message_at < now() - make_interval(...)`) und die
    Besetzungspruefung (`HAVING count(*) >= 2`) stehen in
    `fn_due_continuations`. Die erste Fassung tat beides in Python: sie lud
    jede eingeschaltete Unterhaltung und verglich zwei Spalten DERSELBEN ZEILE
    in der Anwendung, und „mindestens zwei Agenten" lief als eigene Abfrage je
    Zeile — ein N+1.

    Was hier zu pruefen bleibt, ist deshalb NICHT mehr die Zeitrechnung (die
    misst die Datenbank), sondern die Verdrahtung: wird die richtige Funktion
    mit den richtigen Werten gerufen, und was geschieht mit dem, was sie
    liefert.
    """

    @staticmethod
    def _admin(rows):
        admin = MagicMock()
        aufruf = MagicMock()
        aufruf.execute = AsyncMock(return_value=MagicMock(data=rows))
        admin.rpc = MagicMock(return_value=aufruf)
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
            "agent_count": 3,
        }
        basis.update(kw)
        return basis

    async def test_die_datenbank_wird_gefragt_nicht_die_tabelle(self):
        admin = self._admin([])
        sim = uuid4()
        await ContinuationService._due_conversations(admin, sim, limit=2)
        admin.rpc.assert_called_once()
        name, argumente = admin.rpc.call_args.args
        assert name == "fn_due_continuations"
        assert argumente == {"p_simulation_id": str(sim), "p_limit": 2}
        admin.table.assert_not_called(), "die Auswahl liest wieder direkt aus der Tabelle"

    async def test_was_die_funktion_liefert_bekommt_seine_besetzung(self):
        admin = self._admin([self._faden()])
        with patch.object(ContinuationService, "_load_agents", AsyncMock(return_value=[{"id": "a"}, {"id": "b"}])):
            faellig = await ContinuationService._due_conversations(admin, uuid4(), limit=5)
        assert len(faellig) == 1
        assert len(faellig[0]["agents"]) == 2

    async def test_ein_inzwischen_entfernter_agent_faellt_noch_raus(self):
        """Zwischen dem Lauf der Funktion und diesem kann jemand einen Agenten
        entfernt haben. Die Pruefung kostet nichts und schliesst das Fenster."""
        admin = self._admin([self._faden(agent_count=2)])
        with patch.object(ContinuationService, "_load_agents", AsyncMock(return_value=[{"id": "a"}])):
            assert await ContinuationService._due_conversations(admin, uuid4(), limit=5) == []

    async def test_das_budget_geht_an_die_datenbank(self):
        """Gedeckelt wird per LIMIT in SQL, nicht durch Abbrechen einer
        Schleife ueber alles, was geladen wurde."""
        admin = self._admin([])
        await ContinuationService._due_conversations(admin, uuid4(), limit=2)
        assert admin.rpc.call_args.args[1]["p_limit"] == 2


class TestDieFunktionTraegtDieRiegel:
    """Was in Python stand, muss jetzt im SQL stehen — sonst ist die Logik
    nicht verschoben, sondern verschwunden."""

    _DATEI = pathlib.Path(
        "supabase/migrations/20260904190000_365_die_faelligkeit_gehoert_in_die_datenbank.sql"
    ).read_text()

    #: Nur die ANWEISUNGEN, ohne die Kommentarzeilen.
    #:
    #: ⚠ Die erste Fassung dieser Klasse las die ganze Datei — und
    #: `test_kein_security_definer` schlug an dem Kommentar an, der ERKLAERT,
    #: warum es keines gibt („WARUM KEIN SECURITY DEFINER"). Ein Test, der die
    #: Beschreibung statt der Sache misst, faellt entweder falsch aus oder
    #: besteht falsch; hier fiel er falsch aus, was der guenstigere von beiden
    #: Faellen ist.
    SQL = "\n".join(zeile for zeile in _DATEI.splitlines() if not zeile.lstrip().startswith("--"))

    def test_der_zeitriegel_steht_im_sql(self):
        assert "make_interval(hours => c.continue_interval_hours)" in self.SQL
        assert "c.last_message_at <" in self.SQL

    def test_die_besetzungspruefung_steht_im_sql(self):
        assert "HAVING count(ca.agent_id) >= 2" in self.SQL

    def test_verschlossene_und_ausgeschaltete_bleiben_draussen(self):
        assert "NOT c.locked" in self.SQL
        assert "c.continues_without_user" in self.SQL

    def test_der_laengst_stille_faden_zuerst(self):
        """Sonst bekaeme derselbe Faden bei knappem Budget jeden Takt den
        Zuschlag und die uebrigen nie."""
        assert "ORDER BY c.last_message_at" in self.SQL

    def test_kein_security_definer(self):
        """PostgREST boete eine SECURITY-DEFINER-Funktion jedem an, dem EXECUTE
        zusteht. Sie braucht es nicht: der Herzschlag ruft sie als
        service_role, und der umgeht RLS ohnehin.

        ⚠ Zweimal am falschen Ort gemessen. Die erste Fassung las die ganze
        Datei und traf den Kommentar, der ERKLAERT, warum es keines gibt. Die
        zweite las die Datei ohne Kommentare und traf den Text der
        Fehlermeldung IN der Selbstpruefung. Gemessen wird jetzt nur die
        Anweisung selbst — vom CREATE bis zu ihrem Ende.

        Der Rest ist ohnehin die staerkere Pruefung: die Selbstpruefung der
        Migration liest `pg_proc.prosecdef` auf der laufenden Datenbank. Diese
        hier haelt nur die Absicht in der Datei fest.
        """
        anfang = self.SQL.index("CREATE OR REPLACE FUNCTION")
        anweisung = self.SQL[anfang : self.SQL.index("$$;", anfang)]
        assert "SECURITY DEFINER" not in anweisung.upper()
        assert "REVOKE ALL ON FUNCTION" in self.SQL
        assert "GRANT EXECUTE ON FUNCTION public.fn_due_continuations(uuid, int) TO service_role" in self.SQL

    def test_die_migration_prueft_es_auch_an_der_datenbank(self):
        """Eine Absicht in einer Datei ist keine Eigenschaft der Datenbank."""
        assert "prosecdef" in self._DATEI
        assert "has_function_privilege" in self._DATEI


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
        ok = await ContinuationService._persist(admin, uuid4(), zuege, agents, "deepseek/deepseek-v4-flash")
        assert ok
        zeilen = admin.table.return_value.insert.call_args.args[0]
        assert len(zeilen) == 2
        assert all(z["metadata"]["without_user"] is True for z in zeilen)
        assert [z["agent_id"] for z in zeilen] == ["id-mira", "id-elena"]

    async def test_ohne_zuordenbare_zeile_wird_nichts_geschrieben(self):
        admin = MagicMock()
        ok = await ContinuationService._persist(admin, uuid4(), [{"speaker": "Fremd", "content": "x"}], [], "m")
        assert ok is False
        admin.table.return_value.insert.assert_not_called()


def test_die_zuglaenge_ist_ein_bereich_und_kein_punkt():
    """Zwei sind ein Wortwechsel, vier eine kurze Szene. Waeren MIN und MAX
    gleich, waere jeder Wortwechsel gleich lang und daran erkennbar."""
    assert MIN_TURNS >= 2
    assert MAX_TURNS > MIN_TURNS
