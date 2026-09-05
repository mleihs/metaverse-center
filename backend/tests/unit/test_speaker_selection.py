"""Wer diesmal antwortet — und ob Schweigen ueberhaupt erreichbar ist.

Der Anlass ist eine Messung vom 05.09.2026: zwei Figuren wurden ausdruecklich
zum Schweigen aufgefordert, und **2 von 2 haben trotzdem geantwortet**. Das
war kein Ungehorsam, sondern eine Eigenschaft der Bauform — die Gruppenrunde
lief ueber ALLE Agenten in fester Reihenfolge. Eine Bitte kann nichts
bewirken, wo keine Entscheidung stattfindet.

Diese Datei prueft die Entscheidung. Sie prueft in beide Richtungen, und die
zweite ist die wichtigere: ⚠ in der Nutzerstudie zu Mehrfigurengespraechen
wurde der schweigsame Agent von **7 von 12** als schlechtester bewertet. Eine
Auswahl, die zu viel schweigen laesst, ist schlimmer als gar keine.

Alle Namen und Saetze sind erfunden (`scripts/lint-no-chat-content.sh`).
"""

from __future__ import annotations

import pytest

from backend.services.chat.speaker_selection import (
    ANTEILNAHME_SCHWELLE,
    SCHWEIGEN_MAX,
    schweigerunden,
    waehle_sprecher,
)

NAMEN = ["Marie Morgenrot", "Suse Sonnenblum", "Benno Blattgold"]
IDS = ["id-marie", "id-suse", "id-benno"]


def _wahl(nachricht: str, *, still=None, meinungen=None, aktiv=True):
    return waehle_sprecher(
        agent_names=NAMEN,
        agent_ids=IDS,
        user_message=nachricht,
        still_seit=still or [0, 0, 0],
        anteilnahme=meinungen or {},
        aktiv=aktiv,
    )


class TestDasTorAendertOhneOeffnungNichts:
    """„Aus" muss der Zustand von vorher sein — sonst ist es kein Tor,
    sondern eine zweite Bauform."""

    def test_geschlossen_antworten_alle_in_alter_reihenfolge(self):
        w = _wahl("Marie, was siehst du?", aktiv=False)
        assert w.reihenfolge == [0, 1, 2]
        assert w.schweigt == []

    def test_geschlossen_auch_wenn_alles_fuer_schweigen_spraeche(self):
        w = _wahl("Marie, was siehst du?", still=[0, 0, 0], aktiv=False)
        assert w.reihenfolge == [0, 1, 2]

    def test_eine_einzelne_figur_wird_nie_ausgewaehlt(self):
        """Ein Zwiegespraech hat keine Auswahl zu treffen — und eine Figur,
        die im Einzelchat schweigt, ist ein totes Fenster."""
        w = waehle_sprecher(
            agent_names=["Marie Morgenrot"],
            agent_ids=["id-marie"],
            user_message="Sag nichts.",
            still_seit=[9],
            anteilnahme={},
            aktiv=True,
        )
        assert w.reihenfolge == [0]


class TestWerGenanntIstAntwortetImmerUndZuerst:
    def test_die_genannte_steht_vorn(self):
        w = _wahl("Benno, was hast du gesehen?")
        assert w.reihenfolge[0] == 2
        assert w.grund[2] == "genannt"

    def test_zwei_genannte_behalten_ihre_reihenfolge(self):
        """Genannt zu sein aendert, OB jemand spricht, nicht die Ordnung der
        Besetzung untereinander."""
        w = _wahl("Suse und Benno, kommt her.")
        assert w.reihenfolge[:2] == [1, 2]

    def test_der_genitiv_zaehlt_auch(self):
        """Dieselbe Namenserkennung wie in der Lage-Ansage — sonst haetten
        Messgeraet und Auswahl zwei verschiedene Weltbilder."""
        assert _wahl("Ich nehme Maries Akte.").reihenfolge[0] == 0

    def test_ein_titel_macht_niemanden_zum_genannten(self):
        w = waehle_sprecher(
            agent_names=["Doktor Freundlich", "Benno Blattgold"],
            agent_ids=["id-f", "id-b"],
            user_message="Ich frage den Doktor Blattgold.",
            still_seit=[0, 0],
            anteilnahme={},
            aktiv=True,
        )
        assert w.reihenfolge[0] == 1
        assert w.grund[1] == "genannt"


class TestOhneNamenAntwortenAlle:
    """Eine kollektive Anrede gilt allen. Dort zu schweigen waere kein
    Zurueckhalten, sondern Ausfall."""

    def test_kollektive_anrede(self):
        w = _wahl("Erzaehlt mir, was hier geschieht.")
        assert w.reihenfolge == [0, 1, 2]
        assert w.schweigt == []

    def test_auch_bei_leerer_nachricht(self):
        assert _wahl("").reihenfolge == [0, 1, 2]

    def test_auch_wenn_alle_gerade_gesprochen_haben(self):
        """Die Gegenprobe: ohne sie koennte der Test oben bestehen, weil
        zufaellig jemand lange geschwiegen hat."""
        assert _wahl("Was geschieht hier?", still=[0, 0, 0]).reihenfolge == [0, 1, 2]


class TestWerNichtGenanntIstBrauchtEinenGrund:
    def test_ohne_grund_schweigt_er(self):
        """Der Fall, der die ganze Migration ausgeloest hat: der Mensch
        spricht eine an, die anderen bleiben still."""
        w = _wahl("Marie, was siehst du?", still=[0, 0, 0])
        assert w.reihenfolge == [0]
        assert w.schweigt == [1, 2]

    def test_anteilnahme_bringt_ihn_zurueck(self):
        """Wer eine ausgepraegte Meinung ueber die Angesprochene hat, hat
        etwas dazu zu sagen."""
        w = _wahl(
            "Marie, was siehst du?",
            meinungen={"id-benno": {"id-marie": -ANTEILNAHME_SCHWELLE}},
        )
        assert 2 in w.reihenfolge
        assert w.grund[2].startswith("Anteilnahme")

    def test_eine_schwache_meinung_reicht_nicht(self):
        """Die Gegenprobe zur Schwelle. Ohne sie pruefte der Test oben nur,
        dass ein Eintrag im Wörterbuch etwas bewirkt."""
        w = _wahl(
            "Marie, was siehst du?",
            meinungen={"id-benno": {"id-marie": ANTEILNAHME_SCHWELLE - 1}},
        )
        assert 2 in w.schweigt

    def test_eine_meinung_ueber_eine_nicht_genannte_zaehlt_nicht(self):
        """Anteilnahme heisst: an DIESER Sache. Sonst spraeche jede Figur mit
        irgendeiner starken Meinung immer."""
        w = _wahl(
            "Marie, was siehst du?",
            meinungen={"id-benno": {"id-suse": 90}},
        )
        assert 2 in w.schweigt

    @pytest.mark.parametrize("still", [SCHWEIGEN_MAX, SCHWEIGEN_MAX + 3])
    def test_wer_lange_genug_geschwiegen_hat_spricht_wieder(self, still):
        """⚠ Die Schranke gegen die Reparatur, die schlimmer ist als der
        Fehler: der schweigsame Agent wurde von 7 von 12 als schlechtester
        bewertet."""
        w = _wahl("Marie, was siehst du?", still=[0, still, 0])
        assert 1 in w.reihenfolge
        assert "schweigt seit" in w.grund[1]

    def test_eine_runde_schweigen_reicht_noch_nicht(self):
        """Die Gegenprobe zur Schranke. Ohne sie waere jede Runde ein
        Vollbild und die Auswahl wirkungslos."""
        assert 1 in _wahl("Marie, was siehst du?", still=[0, SCHWEIGEN_MAX - 1, 0]).schweigt

    def test_es_schweigen_nie_alle(self):
        """Sobald ein Name faellt, spricht mindestens die Genannte. Ohne
        Namen sprechen alle. Ein stummes Gespraech ist in keinem Zweig
        erreichbar."""
        for nachricht in ("Marie, sag nichts.", "Sagt alle nichts.", "", "Hm."):
            assert _wahl(nachricht, still=[0, 0, 0]).reihenfolge

    def test_jede_figur_bekommt_einen_grund(self):
        """Eine Figur, die nicht antwortet, sieht fuer den Menschen aus wie
        ein Fehler. Wer nachsieht, warum sie schwieg, hat nur diesen Eintrag."""
        w = _wahl("Marie, was siehst du?")
        assert set(w.grund) == {0, 1, 2}
        assert all(w.grund.values())


class TestDieSchweigedauerKommtAusDemVerlauf:
    """Kein Netzzugriff und keine Uhr: der Vorlauf hat den Verlauf ohnehin
    geladen, und ein Filter gegen die Datenbankuhr hat am 05.09.2026 einmal
    alles weggeschnitten, weil die Uhr auf dem Vortag stand."""

    @staticmethod
    def _runde(sprecher: list[str]) -> list[dict]:
        return [{"sender_role": "user", "content": "x"}] + [
            {"sender_role": "assistant", "agent_id": a} for a in sprecher
        ]

    def test_wer_zuletzt_sprach_steht_bei_null(self):
        verlauf = self._runde(["id-marie", "id-suse", "id-benno"])
        assert schweigerunden(verlauf, IDS) == [0, 0, 0]

    def test_gezaehlt_wird_nur_die_strecke_am_ende(self):
        """Wer in der letzten Runde sprach, steht bei null — ganz gleich, wie
        oft er davor geschwiegen hat."""
        verlauf = self._runde(["id-marie"]) + self._runde(["id-marie", "id-suse"])
        assert schweigerunden(verlauf, IDS) == [0, 0, 2]

    def test_zwei_geschwiegene_runden(self):
        verlauf = (
            self._runde(["id-marie", "id-suse", "id-benno"])
            + self._runde(["id-marie"])
            + self._runde(["id-marie"])
        )
        assert schweigerunden(verlauf, IDS) == [0, 2, 2]

    def test_ein_leerer_verlauf_zaehlt_niemanden_als_schweigend(self):
        """Sonst schwiege in einem frischen Faden sofort die halbe Besetzung —
        beim allerersten Zug, an dem noch gar nichts geschehen ist."""
        assert schweigerunden([], IDS) == [0, 0, 0]

    def test_systemzeilen_eroeffnen_keine_runde(self):
        """Ein Fluestern oder ein Beitritt ist kein Zug. Er darf ein
        Schweigen weder beenden noch verlaengern."""
        verlauf = self._runde(["id-marie", "id-suse", "id-benno"]) + [
            {"sender_role": "system", "content": "x"}
        ]
        assert schweigerunden(verlauf, IDS) == [0, 0, 0]

    def test_das_fenster_begrenzt_die_zahl(self):
        """Weiter zurueckzuzaehlen als der gekappte Verlauf reicht, hiesse
        eine Zahl zu bilden, die von der Kappung abhaengt und nicht vom
        Gespraech."""
        verlauf = self._runde(["id-marie"]) * 40
        assert max(schweigerunden(verlauf, IDS)) <= 40
        assert schweigerunden(verlauf, IDS)[1] == schweigerunden(verlauf, IDS)[2]


# ═══════════════════════════════════════════════════════════════════════════
# Die Verdrahtung — kommt die Wahl ueberhaupt an?
# ═══════════════════════════════════════════════════════════════════════════
#
# Eine Auswahl, die richtig rechnet und die niemand liest, ist dasselbe wie
# keine. Genau das war der Messwert aus Migration 368 ein Jahr lang.

from unittest.mock import AsyncMock, MagicMock, patch  # noqa: E402
from uuid import uuid4  # noqa: E402

from backend.services.chat_ai_service import SPEAKER_SELECTION_GATE, ChatAIService  # noqa: E402
from backend.services.prompt_service import PromptSource, ResolvedPrompt  # noqa: E402


class _Klient:
    """Ein Supabase-Doppelgaenger, der je Tabelle eine feste Antwort gibt."""

    def __init__(self, tabellen: dict[str, list]):
        self._t = tabellen

    def table(self, name: str):
        return _Kette(self._t.get(name, []))

    def rpc(self, name: str, *_a, **_k):
        return _Kette([])


class _Kette:
    def __init__(self, daten: list):
        self._daten = daten

    def __getattr__(self, name: str):
        if name == "execute":

            async def ex():
                return MagicMock(data=self._daten, count=0)

            return ex
        return lambda *_a, **_k: self


def _vorlage() -> ResolvedPrompt:
    return ResolvedPrompt(
        template_type="chat_system_prompt",
        locale="de",
        prompt_content="x",
        system_prompt=None,
        variables=[],
        default_model=None,
        temperature=0.7,
        max_tokens=1024,
        negative_prompt=None,
        source=PromptSource.PLATFORM_LOCALE,
    )


async def _vorlauf(*, tor: bool, nachricht: str):
    agenten = [{"id": i, "name": n} for i, n in zip(IDS, NAMEN, strict=True)]
    tabellen = {
        "chat_conversation_agents": [{"agents": a} for a in agenten],
        "chat_messages": [
            {"sender_role": "user", "content": nachricht, "agent_id": None, "created_at": "2026-09-05"}
        ],
    }
    if tor:
        tabellen["platform_settings"] = [{"setting_value": True}]
    svc = ChatAIService(_Klient(tabellen), uuid4(), openrouter_api_key="x")
    with (
        patch.object(svc._prompt_resolver, "resolve", AsyncMock(return_value=_vorlage())),
        patch.object(
            svc._model_resolver,
            "resolve_text_model",
            AsyncMock(return_value=MagicMock(model_id="deepseek/deepseek-v4-flash")),
        ),
    ):
        return svc, await svc._prepare_group_turn(uuid4())


class TestDieWahlErreichtDieRunde:
    async def test_bei_geschlossenem_tor_sprechen_alle(self):
        svc, setup = await _vorlauf(tor=False, nachricht="Marie, was siehst du?")
        assert svc._sprechreihenfolge(setup) == [0, 1, 2]

    async def test_bei_offenem_tor_greift_die_auswahl(self):
        svc, setup = await _vorlauf(tor=True, nachricht="Marie, was siehst du?")
        assert svc._sprechreihenfolge(setup) == [0]

    async def test_die_gegenprobe_ohne_namen(self):
        """Offenes Tor, aber niemand genannt — alle sprechen. Ohne diesen Test
        koennte der obige bestehen, weil das Tor einfach alles abschaltet."""
        svc, setup = await _vorlauf(tor=True, nachricht="Was geschieht hier?")
        assert svc._sprechreihenfolge(setup) == [0, 1, 2]

    async def test_das_tor_wird_wirklich_gelesen(self):
        """Ein Tor ohne Leser ist eine Behauptung. `test_unwired_gates_are_
        really_dead` prueft die andere Richtung; dies hier die Lesestelle."""
        import inspect

        assert SPEAKER_SELECTION_GATE == "chat_speaker_selection_enabled"
        quelle = inspect.getsource(ChatAIService._prepare_group_turn)
        assert "SPEAKER_SELECTION_GATE" in quelle

    async def test_ein_leeres_tor_bleibt_zu(self):
        """Fail-closed: fehlt die Zeile, antworten alle wie bisher. Ein
        Merkmal, das das Produktgefuehl aendert, darf nicht dadurch anlaufen,
        dass jemand vergessen hat, es abzuschalten."""
        svc = ChatAIService(_Klient({}), uuid4(), openrouter_api_key="x")
        assert await svc._gate_open(SPEAKER_SELECTION_GATE) is False

    async def test_ein_fehler_beim_tor_bleibt_zu(self):
        klient = MagicMock()
        klient.table.side_effect = RuntimeError("Datenbank weg")
        svc = ChatAIService(klient, uuid4(), openrouter_api_key="x")
        assert await svc._gate_open(SPEAKER_SELECTION_GATE) is False

    async def test_ohne_vorlauf_spricht_trotzdem_jemand(self):
        """Der Rueckfall. `_GroupTurnSetup` traegt die Wahl als Feld mit
        Vorgabewert; ein Aufrufer, der den Vorlauf umgeht, bekaeme sonst eine
        LEERE Runde — ein stummes Gespraech statt eines langsamen."""
        from backend.services.chat_ai_service import _GroupTurnSetup

        setup = _GroupTurnSetup(
            agents=[{"id": i} for i in IDS],
            agent_names=list(NAMEN),
            simulation={},
            locale="de",
            prompt_template=_vorlage(),
            model=MagicMock(model_id="x"),
            event_context="",
        )
        assert ChatAIService._sprechreihenfolge(setup) == [0, 1, 2]

    async def test_die_meinungen_werden_nur_bei_offenem_tor_geholt(self):
        """Eine Abfrage fuer ein abgeschaltetes Merkmal ist keine Vorsorge,
        sondern Kosten ohne Leser."""
        import collections

        class _Zaehlend(_Klient):
            def __init__(self, tabellen):
                super().__init__(tabellen)
                self.zaehler = collections.Counter()

            def table(self, name):
                self.zaehler[name] += 1
                return super().table(name)

        for tor, erwartet in ((False, 0), (True, 1)):
            agenten = [{"id": i, "name": n} for i, n in zip(IDS, NAMEN, strict=True)]
            tabellen = {"chat_conversation_agents": [{"agents": a} for a in agenten]}
            if tor:
                tabellen["platform_settings"] = [{"setting_value": True}]
            klient = _Zaehlend(tabellen)
            svc = ChatAIService(klient, uuid4(), openrouter_api_key="x")
            with (
                patch.object(svc._prompt_resolver, "resolve", AsyncMock(return_value=_vorlage())),
                patch.object(
                    svc._model_resolver,
                    "resolve_text_model",
                    AsyncMock(return_value=MagicMock(model_id="x")),
                ),
            ):
                await svc._prepare_group_turn(uuid4())
            assert klient.zaehler["agent_opinions"] == erwartet, f"Tor={tor}"
