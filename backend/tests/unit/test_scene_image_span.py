"""Welcher Ausschnitt eines Gespraechs zu einem Bild wird.

Der naheliegende Zuschnitt — „die letzten N Nachrichten" — ist falsch, und der
Grund steht schon in `chat_ai_service._addressed_note`: die Zuege einer Runde
beschreiben DENSELBEN Augenblick aus verschiedener Sicht. Drei Agentenzuege
sind ein Moment, dreimal gesehen, nicht drei Momente.

Diese Tests pinnen die Kante der Runde und die drei Arten, sie zu verfehlen:
mitten hineinschneiden, die Menschenzeile verlieren (sie ist der Anlass des
Moments), und den Faden vom ANFANG statt vom Ende her nehmen.
"""

import pytest

from backend.services.chat.scene_image_service import SceneImageService, SceneSpan


def _m(role: str, content: str, agent: str | None = None) -> dict:
    return {"sender_role": role, "content": content, "agent_id": agent}


#: Zwei volle Runden eines Dreiergespraechs, chronologisch.
#: Erfundene Figuren nach der Hausregel: Marie Morgenrot, Benno Blattgold,
#: Suse Sonnenblum.
VERLAUF = [
    _m("user", "erste Menschenzeile"),
    _m("assistant", "Marie, Zug 1", "a1"),
    _m("assistant", "Benno, Zug 1", "a2"),
    _m("assistant", "Suse, Zug 1", "a3"),
    _m("user", "zweite Menschenzeile"),
    _m("assistant", "Marie, Zug 2", "a1"),
    _m("assistant", "Benno, Zug 2", "a2"),
    _m("assistant", "Suse, Zug 2", "a3"),
]


class TestDieKante:
    def test_message_nimmt_genau_einen_zug(self):
        assert SceneImageService._cut(VERLAUF, SceneSpan.MESSAGE) == [VERLAUF[-1]]

    def test_round_nimmt_die_menschenzeile_mit(self):
        # Sie ist der Anlass des Moments, den die Figuren dann beschreiben.
        # Ohne sie fehlt dem Bild, worauf reagiert wird.
        runde = SceneImageService._cut(VERLAUF, SceneSpan.ROUND)
        assert len(runde) == 4
        assert runde[0]["sender_role"] == "user"
        assert runde[0]["content"] == "zweite Menschenzeile"

    def test_round_schneidet_nicht_mitten_hinein(self):
        # Das ist der Fehler, den ein gleitendes Fenster von 3 machen wuerde:
        # bei drei Figuren ginge es zufaellig auf, hier nicht.
        runde = SceneImageService._cut(VERLAUF, SceneSpan.ROUND)
        assert [m["content"] for m in runde[1:]] == ["Marie, Zug 2", "Benno, Zug 2", "Suse, Zug 2"]

    def test_section_nimmt_zwei_runden(self):
        assert SceneImageService._cut(VERLAUF, SceneSpan.SECTION) == VERLAUF

    @pytest.mark.parametrize("figuren", [1, 2, 4, 5])
    def test_die_runde_stimmt_bei_jeder_besetzungsgroesse(self, figuren: int):
        # Ein festes Fenster von N ginge nur bei genau N Figuren auf. Die
        # Runde geht bei jeder Zahl auf, weil sie an der Menschenzeile haengt.
        verlauf = [_m("user", "x")] + [_m("assistant", f"zug {i}", f"a{i}") for i in range(figuren)]
        runde = SceneImageService._cut(verlauf, SceneSpan.ROUND)
        assert len(runde) == figuren + 1


class TestDieRandfaelle:
    def test_ohne_menschenzeile_faellt_round_auf_alles_zurueck(self):
        # Kann vorkommen, wenn die Fortsetzung ohne den Menschen weitergelaufen
        # ist. Alles ist dann richtiger als nichts.
        nur_agenten = [_m("assistant", "a", "a1"), _m("assistant", "b", "a2")]
        assert SceneImageService._cut(nur_agenten, SceneSpan.ROUND) == nur_agenten

    def test_bei_nur_einer_runde_ist_der_abschnitt_die_runde(self):
        eine = VERLAUF[:4]
        assert SceneImageService._cut(eine, SceneSpan.SECTION) == eine

    def test_eine_einzelne_menschenzeile_ist_eine_runde(self):
        allein = [_m("user", "nur ich")]
        assert SceneImageService._cut(allein, SceneSpan.ROUND) == allein


class TestDerText:
    def test_jede_zeile_traegt_ihren_sprecher(self):
        # Ohne Marke laeuft eine Zeile ohne Besitzer in den Bildprompt, und das
        # Modell ordnet die Handlung der falschen Figur zu — derselbe Fehler,
        # den `_USER_SPEAKER` im Gespraechsverlauf behebt.
        from backend.services.chat.scene_image_service import SceneSelection

        auswahl = SceneSelection(
            messages=[
                {"sender_role": "user", "content": "Ich hebe die Hand.", "agents": None},
                {"sender_role": "assistant", "content": "Sie sieht es.", "agents": {"name": "Marie Morgenrot"}},
            ],
            agent_ids=["a1"],
            portraits=[],
        )
        text = auswahl.text
        assert "[der Mensch]: Ich hebe die Hand." in text
        assert "[Marie Morgenrot]: Sie sieht es." in text
