"""Was eine Figur miterlebt hat — und was sie sich nur ausleiht.

DER STÄRKSTE GEMESSENE BEFUND DIESER ARBEIT, und er stand bis zum 04.09.2026
offen: `_load_history` gab jedem Agenten den GANZEN Faden, auch alles, was vor
seinem Beitritt geschah. Am echten Gespräch, per SQL ausgezählt:

    Agent A      0 Nachrichten vor Beitritt   10,8 % allwissende Züge
    Agent B    228 Nachrichten vor Beitritt   18,2 %
    Agent C    309 Nachrichten vor Beitritt   41,2 %

Monoton, Faktor vier. Drei Punkte sind kein Beweis — aber die Richtung ist
genau die, die das perspektivgebundene Gedächtnis vorhersagt
(arXiv:2606.25632: +34,6 Prozentpunkte Knowledge Boundary Fidelity bei ~79 %
Gewinnrate in der Erzählqualität; die Grenze senkt allwissende Aussagen, OHNE
die Prosa zu verflachen). Das Papier nennt den Fehler *Factual Overreach*.

Die Ausnahme ist so wichtig wie die Regel: die SZENE überlebt die Grenze. Sie
ist der Raum, in den jemand eintritt, nicht ein Gespräch, das er verpasst hat.
Ohne sie stünde eine neu hinzugekommene Figur in einem leeren Nichts.
"""

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from backend.services.chat.conversation_digest_service import ConversationDigestService
from backend.services.chat_ai_service import ChatAIService

BEITRITT = "2026-09-03T17:36:00+00:00"


def _n(zeit: str, rolle: str = "assistant", inhalt: str = "x") -> dict:
    return {"created_at": zeit, "sender_role": rolle, "content": inhalt, "agent_id": "a"}


VERLAUF = [
    _n("2026-09-02T10:00:00+00:00", inhalt="lange vor dem Beitritt"),
    _n("2026-09-03T10:00:00+00:00", inhalt="am Tag davor"),
    _n("2026-09-03T17:36:00+00:00", inhalt="genau beim Beitritt"),
    _n("2026-09-03T18:00:00+00:00", inhalt="danach"),
]


class TestWasVorDemBeitrittWarBleibtDraussen:
    def test_nur_das_miterlebte(self):
        erlebt, weg = ChatAIService._bound_to_perspective(VERLAUF, BEITRITT)
        assert [m["content"] for m in erlebt] == ["genau beim Beitritt", "danach"]
        assert weg == 2

    def test_der_beitrittszeitpunkt_selbst_zaehlt_dazu(self):
        """Die Nachricht, die den Beitritt ausgeloest hat, hat die Figur
        miterlebt — sie war der Anlass."""
        erlebt, _ = ChatAIService._bound_to_perspective(VERLAUF, BEITRITT)
        assert any(m["content"] == "genau beim Beitritt" for m in erlebt)

    def test_ohne_beitrittszeit_bleibt_alles(self):
        """Der erste Agent eines Fadens, und jeder Einzelchat. Eine fehlende
        Angabe darf nicht heissen „hat nichts gesehen" — das waere die
        gefaehrliche Richtung des Irrtums."""
        erlebt, weg = ChatAIService._bound_to_perspective(VERLAUF, None)
        assert erlebt == VERLAUF
        assert weg == 0

    def test_die_zahl_der_weggelassenen_wird_gemeldet(self):
        """Sie geht ins Protokoll. Eine Grenze, die schweigend wirkt, ist beim
        naechsten unerklaerlichen Zug nicht auffindbar."""
        _, weg = ChatAIService._bound_to_perspective(VERLAUF, "2026-09-04T00:00:00+00:00")
        assert weg == 4

    def test_die_eingabe_wird_nicht_veraendert(self):
        """Der Verlauf wird EINMAL geladen und von allen Sprechern geteilt.
        Wer ihn beim Filtern mutiert, nimmt ihn dem naechsten weg."""
        vorher = [dict(m) for m in VERLAUF]
        ChatAIService._bound_to_perspective(VERLAUF, BEITRITT)
        assert VERLAUF == vorher


class TestDieSzeneUeberlebtDieGrenze:
    """Sie ist der Raum, kein verpasstes Gespräch."""

    def test_die_juengste_szene_kommt_mit(self):
        verlauf = [
            _n("2026-09-02T09:00:00+00:00", "system", "Ein kalter Vorraum."),
            *VERLAUF,
        ]
        erlebt, _ = ChatAIService._bound_to_perspective(verlauf, BEITRITT)
        assert erlebt[0]["content"] == "Ein kalter Vorraum."

    def test_nur_die_juengste(self):
        """Aeltere Szenen beschreiben Raeume, die es nicht mehr gibt."""
        verlauf = [
            _n("2026-09-01T09:00:00+00:00", "system", "Ein Flur."),
            _n("2026-09-02T09:00:00+00:00", "system", "Ein kalter Vorraum."),
            *VERLAUF,
        ]
        erlebt, _ = ChatAIService._bound_to_perspective(verlauf, BEITRITT)
        szenen = [m["content"] for m in erlebt if m["sender_role"] == "system"]
        assert szenen == ["Ein kalter Vorraum."]

    def test_sie_steht_vorn(self):
        """Der Raum kommt vor dem, was darin gesagt wird."""
        verlauf = [_n("2026-09-02T09:00:00+00:00", "system", "Ein Vorraum."), *VERLAUF]
        erlebt, _ = ChatAIService._bound_to_perspective(verlauf, BEITRITT)
        assert erlebt[0]["sender_role"] == "system"

    def test_eine_miterlebte_szene_wird_nicht_verdoppelt(self):
        verlauf = [*VERLAUF, _n("2026-09-03T19:00:00+00:00", "system", "Es wird dunkel.")]
        erlebt, _ = ChatAIService._bound_to_perspective(verlauf, BEITRITT)
        assert [m["content"] for m in erlebt].count("Es wird dunkel.") == 1


class TestDieSzeneGehoertNiemandem:
    @pytest.fixture()
    def service(self):
        return ChatAIService(MagicMock(), uuid4(), openrouter_api_key="x")

    def test_sie_bekommt_ihre_eigene_marke(self, service):
        turn = service._as_turn(
            {"content": "Der Raum ist kalt.", "sender_role": "system", "agent_id": None},
            agents=[{"id": "a", "name": "Marie"}, {"id": "b", "name": "Suse"}],
            current_agent_id="a",
        )
        assert turn == {"role": "user", "content": "[Scene]: Der Raum ist kalt."}

    def test_niemals_als_eigener_zug(self, service):
        """Waere sie `assistant`, waere sie ein vierter Teilnehmer — und genau
        daran ist SillyTaverns Erzaehlerkarte gescheitert (Issue #235):
        „it just acted like an assistant character that continually butted
        in."""
        for wer in ("a", "b"):
            turn = service._as_turn(
                {"content": "Der Raum ist kalt.", "sender_role": "system"},
                agents=[{"id": "a", "name": "Marie"}, {"id": "b", "name": "Suse"}],
                current_agent_id=wer,
            )
            assert turn["role"] == "user"

    def test_sie_traegt_keinen_figurennamen(self, service):
        turn = service._as_turn(
            {"content": "Der Raum ist kalt.", "sender_role": "system"},
            agents=[{"id": "a", "name": "Marie"}],
            current_agent_id="a",
        )
        assert "Marie" not in turn["content"]

    def test_das_tor_kennt_die_szenenmarke(self):
        """Ein Modell, das `[Scene]: …` zurueckschreibt, hat die Marke fuer ein
        Textformat gehalten und macht sich zum Erzaehler."""
        namen = ChatAIService._known_speakers(["Marie"])
        assert ChatAIService._sanitize_response("[Scene]: Der Raum ist kalt.", namen) == ("Der Raum ist kalt.")


class TestDieVerdichtungKenntDieGrenzeAuch:
    ROWS = [
        {"covers_from": "2026-09-02T10:00:00+00:00", "covers_to": "2026-09-03T09:00:00+00:00", "summary": "davor"},
        {"covers_from": "2026-09-03T10:00:00+00:00", "covers_to": "2026-09-03T18:00:00+00:00", "summary": "hinweg"},
        {"covers_from": "2026-09-03T18:00:00+00:00", "covers_to": "2026-09-04T00:00:00+00:00", "summary": "danach"},
    ]

    def test_ein_abschnitt_vor_dem_beitritt_faellt_weg(self):
        text = ConversationDigestService.render(self.ROWS, "de", since=BEITRITT)
        assert "davor" not in text

    def test_ein_abschnitt_ueber_den_beitritt_hinweg_faellt_auch_weg(self):
        """Er ist nur zur Haelfte miterlebt. Ihn ganz zu geben waere zu viel,
        ihn zu teilen ginge nicht — er ist ein Text, kein Datensatz. Der
        Urtext dieser Haelfte steht ohnehin im woertlichen Fenster."""
        text = ConversationDigestService.render(self.ROWS, "de", since=BEITRITT)
        assert "hinweg" not in text

    def test_was_danach_kam_bleibt(self):
        assert "danach" in ConversationDigestService.render(self.ROWS, "de", since=BEITRITT)

    def test_ohne_grenze_bleibt_alles(self):
        text = ConversationDigestService.render(self.ROWS, "de")
        assert all(w in text for w in ("davor", "hinweg", "danach"))

    def test_rendern_ist_reine_rechnung(self):
        """Kein Netz. Sonst kostete die Perspektivgrenze eine Rundreise je
        Agent — und die Ersparnis von 20 auf 12 waere dahin."""
        import inspect

        quelle = inspect.getsource(ConversationDigestService.render)
        assert "await" not in quelle
        assert "execute" not in quelle
