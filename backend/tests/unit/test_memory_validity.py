"""Wie lange eine Erinnerung gilt — und was mit ihr geschieht, wenn nicht mehr.

── DER BEFUND ────────────────────────────────────────────────────────────────

`agent_memories` hatte zwoelf Spalten und KEINE davon sagte, wie lange etwas
gilt, ob es ueberholt ist oder ob es fallengelassen werden darf.
`last_accessed_at` ist die einzige zeitliche Spalte neben `created_at`, und
sie wird geschrieben, aber vom Abruf nie gelesen: `retrieve_agent_memories`
rangiert nach Aehnlichkeit, Wichtigkeit und FRISCHE. Nichts in diesem Werk
liess je etwas fallen.

Die Folge ist kein Ausfall, sondern ein Widerspruch mit vollem Gewicht: „X
ist Archivarin" und „X ist nicht mehr Archivarin" standen nebeneinander im
selben Prompt, und das Modell waehlte.

Migration 373 hat geklaert, WESSEN Erinnerung es ist. Migration 379 klaert,
WIE LANGE sie gilt.

── ZWEI FAELLE, DIE NICHT DERSELBE SIND ──────────────────────────────────────

    abgelaufen   Das Fenster ist zu, die Erinnerung bleibt WAHR — als
                 Vergangenheit. Sie wird weiter abgerufen, halb gewichtet,
                 und als „no longer current" gerendert.
    ueberholt    Eine andere Erinnerung hat sie abgeloest. Sie faellt aus dem
                 Abruf; ihre Nachfolgerin beantwortet dieselbe Frage.

Eine Spalte fuer beides hiesse, den Unterschied unsichtbar zu machen.

── WAS HIER GEPRUEFT WIRD, UND WAS NICHT ─────────────────────────────────────

Diese Datei prueft die PYTHON-Seite: dass der Dienst die RPC ruft statt in
Python zu rechnen, dass er beide Faelle unterscheidet, und dass die
Vergangenheit im Prompt als Vergangenheit ankommt.

Die DATENBANK-Seite — dass eine ueberholte Erinnerung wirklich aus dem Abruf
faellt und eine abgelaufene sich als `expired` meldet — prueft die
Selbstpruefung der Migration 379, und zwar mit einer Probe, die ihre Bedingung
selbst HERSTELLT: sie legt zwei Erinnerungen an, misst vor der Ueberholung,
ueberholt, misst wieder und raeumt auf. Eine Pruefung, die auf vorhandene
Daten wartet, besteht auf einer leeren Datenbank muehelos.

Alle Namen sind erfunden (`scripts/lint-no-chat-content.sh`).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from backend.services.agent_memory_service import AgentMemoryService as M


def _kette(daten: list):
    k = MagicMock()
    for n in ("select", "eq", "insert", "update", "in_", "order", "range", "limit"):
        getattr(k, n).return_value = k
    k.execute = AsyncMock(return_value=MagicMock(data=daten, count=len(daten)))
    return k


def _klient(antwort: list | None = None):
    """Ein Supabase-Doppelgaenger, der JE TABELLE antwortet.

    Eine Antwort fuer alle Tabellen waere bequemer und falsch: der
    Uebersetzungsanstoss in `record_observation` liest `simulations.name`,
    und ein Doppelgaenger, der ueberall dieselbe Zeile liefert, misst dort
    einen Fehler, den es im Aufrufpfad nicht gibt.
    """
    erinnerungen = _kette(antwort if antwort is not None else [{}])
    welten = _kette([{"name": "Testwelt", "theme": "dystopian"}])
    klient = MagicMock()
    klient.table.side_effect = lambda name: welten if name == "simulations" else erinnerungen
    klient.rpc.return_value = erinnerungen
    return klient, erinnerungen


class TestDieUeberholungGehtDurchDieRPC:
    """Beide Spalten in EINER Anweisung. In Python waere es
    lesen-rechnen-schreiben mit einem Fenster dazwischen (ADR-007)."""

    async def test_der_dienst_ruft_die_funktion(self):
        klient, _ = _klient([{"id": str(uuid4()), "valid_until": None, "superseded_by": None}])
        alt, neu = uuid4(), uuid4()
        await M.supersede(klient, alt, neu)
        name, params = klient.rpc.call_args[0]
        assert name == "fn_supersede_memory"
        assert params["p_old_id"] == str(alt)
        assert params["p_new_id"] == str(neu)

    async def test_ohne_nachfolgerin_wird_keine_gesetzt(self):
        """Nur das Fenster zu machen ist der andere Fall. Wuerde der Dienst
        hier `p_new_id: None` schicken, ueberschriebe er eine bestehende
        Nachfolgerin mit nichts."""
        klient, _ = _klient()
        await M.supersede(klient, uuid4())
        _, params = klient.rpc.call_args[0]
        assert "p_new_id" not in params

    async def test_ein_ausdrueckliches_fensterende_geht_mit(self):
        klient, _ = _klient()
        wann = datetime(2026, 5, 1, tzinfo=UTC)
        await M.supersede(klient, uuid4(), valid_until=wann)
        _, params = klient.rpc.call_args[0]
        assert params["p_valid_until"] == wann.isoformat()

    async def test_der_dienst_rechnet_die_gueltigkeit_nicht_selbst(self):
        """Die Pruefungen (kein Selbstbezug, kein fremdes Gedaechtnis) und das
        Setzen beider Spalten stehen in SQL. Eine zweite Rechnung in Python
        waere eine zweite Wahrheit — und sie haette ein Fenster, in dem die
        Zeile zwischen Lesen und Schreiben jemand anderem gehoert."""
        import inspect

        quelle = inspect.getsource(M.supersede)
        assert "fn_supersede_memory" in quelle
        for verboten in (".update(", ".table(", "now()", "datetime.now"):
            assert verboten not in quelle

    async def test_eine_leere_antwort_ist_kein_absturz(self):
        klient, kette = _klient()
        kette.execute = AsyncMock(return_value=MagicMock(data=[], count=0))
        assert await M.supersede(klient, uuid4()) is None


class TestDasAufzeichnenKennntBeideFaelle:
    async def test_ohne_angabe_gilt_die_erinnerung_weiter(self):
        """Der gewoehnliche Fall, und der einzige, den es bis 379 gab. NULL
        heisst „gilt weiter" — nicht „abgelaufen"."""
        klient, kette = _klient([{"id": str(uuid4())}])
        await M.record_observation(klient, uuid4(), uuid4(), "Die Akte liegt auf dem Tisch.")
        satz = kette.insert.call_args[0][0]
        assert satz["valid_until"] is None

    async def test_ein_fensterende_wird_geschrieben(self):
        klient, kette = _klient([{"id": str(uuid4())}])
        wann = datetime.now(UTC) + timedelta(days=30)
        await M.record_observation(
            klient, uuid4(), uuid4(), "Marie fuehrt das Archiv.", valid_until=wann
        )
        assert kette.insert.call_args[0][0]["valid_until"] == wann.isoformat()

    async def test_die_abloesung_geschieht_nach_dem_einfuegen(self):
        """Eine Vorgaengerin, die auf eine Nachfolgerin zeigt, die es noch
        nicht gibt, waere ein halb geschriebener Zustand — und der
        Fremdschluessel liesse sie ohnehin nicht zu."""
        neue_id = uuid4()
        klient, _ = _klient([{"id": str(neue_id)}])
        alt = uuid4()
        await M.record_observation(
            klient, uuid4(), uuid4(), "Marie fuehrt das Archiv nicht mehr.", supersedes=alt
        )
        name, params = klient.rpc.call_args[0]
        assert name == "fn_supersede_memory"
        assert params["p_old_id"] == str(alt)
        assert params["p_new_id"] == str(neue_id)

    async def test_ohne_supersedes_wird_nichts_ueberholt(self):
        """Die Gegenprobe. Ohne sie pruefte der Test oben nur, dass eine RPC
        existiert — und nicht, dass sie an einer Bedingung haengt."""
        klient, _ = _klient([{"id": str(uuid4())}])
        await M.record_observation(klient, uuid4(), uuid4(), "Es regnet.")
        assert not klient.rpc.called


class TestDieVergangenheitKommtALSVergangenheitAn:
    """Eine abgelaufene Erinnerung wird NICHT verschwiegen. „X war Archivarin"
    ist wahr und brauchbar; „X ist Archivarin" ist es nicht mehr. Ohne Marke
    saehen beide im Prompt gleich aus, und der Unterschied steht nirgends im
    Wortlaut."""

    def test_eine_abgelaufene_wird_markiert(self):
        text = M.format_for_prompt([{"content": "Marie fuehrt das Archiv.", "importance": 7, "expired": True}])
        assert "no longer current" in text
        assert "Marie fuehrt das Archiv." in text

    def test_eine_gueltige_wird_nicht_markiert(self):
        """Die Gegenprobe. Ein Zusatz, der immer dasteht, sagt nichts."""
        text = M.format_for_prompt([{"content": "Marie fuehrt das Archiv.", "importance": 7}])
        assert "no longer current" not in text

    def test_ein_ausdrueckliches_nein_wird_nicht_markiert(self):
        text = M.format_for_prompt([{"content": "x", "importance": 5, "expired": False}])
        assert "no longer current" not in text

    def test_beides_nebeneinander_bleibt_unterscheidbar(self):
        """Der eigentliche Zweck: der Prompt traegt Vergangenheit UND
        Gegenwart, und sie sehen verschieden aus."""
        text = M.format_for_prompt(
            [
                {"content": "Marie fuehrte das Archiv.", "importance": 7, "expired": True},
                {"content": "Benno fuehrt das Archiv.", "importance": 7},
            ]
        )
        zeilen = [z for z in text.split("\n") if z.startswith("-")]
        assert len(zeilen) == 2
        assert "no longer current" in zeilen[0]
        assert "no longer current" not in zeilen[1]

    def test_ohne_erinnerungen_bleibt_es_leer(self):
        assert M.format_for_prompt([]) == ""


class TestDieOberflaecheSiehtDenZustand:
    def test_die_liste_holt_die_neuen_spalten(self):
        """Ohne sie sieht eine Verwaltungsoberflaeche einer ueberholten
        Erinnerung nicht an, dass sie ueberholt ist — und die Spalte waere
        gebaut und unsichtbar. Dieselbe Fehlerklasse wie der Messwert aus 368,
        den ein Jahr lang niemand las."""
        import inspect

        quelle = inspect.getsource(M.list_memories)
        assert "valid_until" in quelle
        assert "superseded_by" in quelle

    def test_das_antwortmodell_traegt_sie(self):
        from backend.models.memory import MemoryResponse

        felder = MemoryResponse.model_fields
        assert {"valid_until", "superseded_by", "expired"} <= set(felder)

    def test_expired_kommt_aus_der_abfrage_und_nicht_aus_python(self):
        """`valid_until <= now()` ist eine Frage an die UHR. Sie in Python zu
        stellen hiesse, sie je nach Zeitzone der Anwendung anders zu
        beantworten als die Datenbank, die die Zeile abruft."""
        import inspect

        quelle = inspect.getsource(M)
        assert "expired" in quelle
        assert 'm.get("expired")' in quelle


@pytest.mark.parametrize(
    ("fall", "neu", "erwartet_neu"),
    [
        ("ueberholt", True, True),
        ("nur_abgelaufen", False, False),
    ],
)
async def test_die_zwei_faelle_bleiben_getrennt(fall, neu, erwartet_neu):
    """Ein abgelaufenes Fenster VERSCHIEBT eine Erinnerung in die
    Vergangenheit; eine Nachfolgerin ERSETZT sie. Eine Spalte fuer beides
    hiesse, den Unterschied unsichtbar zu machen — dieselbe Falle wie „zwei
    Rollen, ein Vorgabewert"."""
    klient, _ = _klient()
    await M.supersede(klient, uuid4(), uuid4() if neu else None)
    _, params = klient.rpc.call_args[0]
    assert ("p_new_id" in params) is erwartet_neu, fall


# ═══════════════════════════════════════════════════════════════════════════
# Der Engpass zwischen Ausloeser und Leser
# ═══════════════════════════════════════════════════════════════════════════


class TestAusloeserUndLeserSindSichEinig:
    """Bis zum 05.09.2026 waren sie es nicht.

    Faellig wurde ein Agent bei FUENFZIG offenen Beobachtungen
    (`REFLECTION_TRIGGER`), gelesen wurden ZWANZIG (eine fest eingebaute
    `.limit(20)` in `reflect`). Und weil die neue Reflexion den Zeitstempel
    setzte, ab dem gezaehlt wird, fielen die uebrigen dreissig danach
    dauerhaft aus dem Offen-Zaehler: **30 von 50 Beobachtungen erreichten nie
    eine Reflexion und galten trotzdem als erledigt.**

    Auf Produktion gemessen: 496 Beobachtungen, 5 Reflexionen, und die Figur
    mit 195 Erinnerungen hatte NULL.
    """

    def test_der_leser_sieht_alles_was_den_ausloeser_gedrueckt_hat(self):
        """Die eigentliche Zusage, und sie bindet zwei Zahlen aneinander.
        Wer eine davon aendert, ohne die andere anzusehen, wird hier rot."""
        assert M.REFLECTION_WINDOW >= M.REFLECTION_TRIGGER, (
            f"Fenster {M.REFLECTION_WINDOW} < Ausloeser {M.REFLECTION_TRIGGER}: "
            "es wuerden weniger Beobachtungen gelesen als noetig waren, um faellig "
            "zu werden — und der Rest gaelte danach als erledigt."
        )

    def test_die_zahl_steht_nicht_mehr_im_abruf(self):
        """Eine Zahl im Rumpf ist eine Zahl ohne Namen. Sie war der ganze
        Fehler: niemand konnte sie neben den Ausloeser halten."""
        import inspect

        quelle = inspect.getsource(M.reflect)
        assert ".limit(20)" not in quelle
        assert "REFLECTION_WINDOW" in quelle

    def test_gelesen_wird_von_vorn(self):
        """AELTESTE zuerst. Laese man die juengsten, bliebe der Rueckstand
        fuer immer unverdichtet, obwohl der Zaehler ihn abhakt."""
        import inspect

        quelle = inspect.getsource(M.reflect)
        assert "desc=False" in quelle


class TestDerWasserstandStattDerUhr:
    """Die Grenze beschreibt, was GELESEN wurde — nicht, wann gearbeitet wurde.

    Eine Zahl allein haette den Rueckstand von 195 Beobachtungen nur an einer
    anderen Stelle abgeschnitten. Jede Reflexion traegt deshalb in `source_id`
    die juengste Beobachtung, die sie wirklich gelesen hat.
    """

    def test_ohne_reflexion_gibt_es_keine_grenze(self):
        assert M._boundary_of(None, {}) is None

    def test_der_wasserstand_schlaegt_den_zeitstempel(self):
        """Der Kern. Die Reflexion LIEF um 12:00, gelesen hat sie bis 10:00 —
        gezaehlt wird ab 10:00, sonst waeren die zwei Stunden dazwischen
        still erledigt."""
        grenze = M._boundary_of(
            {"created_at": "2026-09-01T12:00:00", "source_id": "beob-7"},
            {"beob-7": "2026-09-01T10:00:00"},
        )
        assert grenze == "2026-09-01T10:00:00"

    def test_ohne_wasserstand_gilt_der_zeitstempel(self):
        """Die fuenf Reflexionen von vor dieser Aenderung haben keinen. Fuer
        sie ist der alte Wert das Beste, was es gibt — und er darf nicht dazu
        fuehren, dass eine Figur ihr ganzes Gedaechtnis noch einmal
        verdichtet."""
        grenze = M._boundary_of({"created_at": "2026-09-01T12:00:00", "source_id": None}, {})
        assert grenze == "2026-09-01T12:00:00"

    def test_ein_wasserstand_ins_leere_faellt_zurueck(self):
        """Zeigt `source_id` auf eine geloeschte Beobachtung, ist der
        Zeitstempel der Rueckfall — nicht `None`. `None` hiesse „noch nie
        verdichtet" und loeste eine Vollverdichtung aus."""
        grenze = M._boundary_of({"created_at": "2026-09-01T12:00:00", "source_id": "weg"}, {})
        assert grenze == "2026-09-01T12:00:00"


class TestEinRueckstandWirdAufgeholtStattVerloren:
    """Der gemessene Fall: eine Figur mit 195 offenen Beobachtungen.

    Mit der alten Bauart haette EINE Verdichtung 20 gelesen und alle 195 als
    erledigt markiert. Mit dem Wasserstand bleibt sie faellig, bis der
    Rueckstand abgearbeitet ist.
    """

    @staticmethod
    def _klient(reflexionen, beobachtungen):
        from types import SimpleNamespace

        class _Q:
            def __init__(self):
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
                return SimpleNamespace(data=reflexionen if self._typ == "reflection" else beobachtungen)

        return SimpleNamespace(table=lambda _n: _Q())

    async def test_nach_einer_verdichtung_bleibt_der_rest_offen(self):
        """195 Beobachtungen, eine Verdichtung, die bis Nummer 50 gelesen hat.
        Offen bleiben 145 — nicht null."""
        agent = str(uuid4())
        beob = [
            {"id": f"b{i:03d}", "agent_id": agent, "created_at": f"2026-09-01T00:{i:03d}"}
            for i in range(195)
        ]
        reflexionen = [{"agent_id": agent, "created_at": "2026-09-02T00:00:00", "source_id": "b049"}]
        faellig = await M._agents_due_for_reflection(self._klient(reflexionen, beob), uuid4(), 2)
        assert faellig, "die Figur ist nach EINER Verdichtung nicht mehr faellig — der Rest ist verloren"
        assert faellig[0][1] == 145

    async def test_ohne_wasserstand_waere_alles_erledigt(self):
        """Die Gegenprobe: dieselben Daten, aber die Reflexion nennt keine
        gelesene Beobachtung. Dann zaehlt der Zeitstempel, und die 195 sind
        weg. Genau das war der Zustand bis zum 05.09.2026 — dieser Test haelt
        fest, WORIN der Unterschied besteht, nicht nur DASS es einen gibt."""
        agent = str(uuid4())
        beob = [
            {"id": f"b{i:03d}", "agent_id": agent, "created_at": f"2026-09-01T00:{i:03d}"}
            for i in range(195)
        ]
        reflexionen = [{"agent_id": agent, "created_at": "2026-09-02T00:00:00", "source_id": None}]
        faellig = await M._agents_due_for_reflection(self._klient(reflexionen, beob), uuid4(), 2)
        assert faellig == []
