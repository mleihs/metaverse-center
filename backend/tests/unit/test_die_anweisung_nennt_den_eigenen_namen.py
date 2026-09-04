"""Die letzte Zeile vor der Antwort muss sagen, WER antwortet.

Gemessen am 05.09.2026 in einem gewachsenen Gruppenfaden: eine Handlung, die
der Mensch an EINE Figur richtete, beantworteten alle drei Sprecher in der
ersten Person, als sei sie ihnen geschehen. Die Fokalisierungsquote desselben
Fadens stieg dabei von 13,4 % auf 20,4 % — nach der Reparatur, nicht davor.

Die Ursache war eine Reihenfolge, nicht ein fehlender Satz. Migration 367 hat
die Gruppen-Anweisung richtigerweise vom System-Prompt an das Ende geholt,
unmittelbar vor die Antwort. Nur nannte diese Anweisung ausschliesslich die
ANDEREN:

    "Du bist in einer Szene mit: {other_agent_names}."

Wer der Angesprochene selbst ist, stand weiterhin allein im System-Prompt —
hinter mehreren hundert Nachrichten. Damit war das Letzte vor der Antwort der
Zug des Vorredners in der ersten Person, und darunter ein Satz mit den Namen
der beiden anderen. Die einzige Ich-Stimme in Reichweite gehoerte dem
Vorredner.

Die Regel nach unten zu holen und die Identitaet oben zu lassen war
zusammengenommen schlimmer als beides oben zu lassen.
"""

from __future__ import annotations

import inspect

import pytest

from backend.services.chat_ai_service import ChatAIService
from backend.services.prompt_contracts import get_contract

BESETZUNG = ["Marie Morgenrot", "Suse Sonnenblum", "Benno Blattgold"]


class TestDerVertragVerlangtDenEigenenNamen:
    def test_agent_name_ist_deklariert(self):
        vertrag = get_contract("chat_group_instruction")
        assert vertrag is not None
        assert "agent_name" in vertrag.variables

    def test_agent_name_ist_pflicht(self):
        """Deklariert genuegt nicht. Eine Vorlage, die ihn weglaesst, ist genau
        die Vorlage, die den Fehler wieder herstellt — also muss ihr Fehlen ein
        Fehler sein und keine Geschmacksfrage."""
        vertrag = get_contract("chat_group_instruction")
        assert "agent_name" in vertrag.required

    def test_die_anderen_bleiben_erlaubt(self):
        """Die Gegenprobe: der eigene Name ERSETZT die fremden nicht. Wer nur
        noch sich selbst kennt, weiss nicht mehr, wer sonst im Raum ist."""
        vertrag = get_contract("chat_group_instruction")
        assert "other_agent_names" in vertrag.variables


class TestDieAufrufstelleFuelltIhn:
    def test_agent_name_wird_gefuellt(self):
        """Ein Platzhalter, den niemand fuellt, erscheint woertlich im Prompt.
        Der Vertrag allein faengt das nicht: er prueft die Vorlage, nicht den
        Aufruf."""
        quelle = inspect.getsource(ChatAIService._build_group_turn_context)
        assert '"agent_name"' in quelle, "die Gruppen-Anweisung fuellt den eigenen Namen nicht"

    def test_er_kommt_aus_der_besetzung_am_index(self):
        """Nicht aus irgendeinem Agenten, sondern aus dem, der gerade dran ist.
        `agents[idx]` ist die einzige Stelle, die den aktuellen Sprecher kennt."""
        quelle = inspect.getsource(ChatAIService._build_group_turn_context)
        zeile = next(z for z in quelle.splitlines() if '"agent_name"' in z)
        assert "agents[idx]" in zeile, f"agent_name kommt nicht vom aktuellen Sprecher: {zeile.strip()}"


class TestDieVorlageAnkertVornUndHinten:
    """Was die Migration in der Datenbank zusagt, hier als lesbare Begruendung.

    Beide Enden zaehlen: der erste Satz setzt die Identitaet, bevor fremde
    Namen fallen, und der letzte holt sie unmittelbar vor die Antwort zurueck.
    Nur den Anfang zu ankern hiesse, den Anker wieder hinter den Verlauf zu
    legen — genau der Fehler, den 367 fuer die Regel behoben hat.
    """

    VORLAGE = (
        "Du bist {agent_name}. Du schreibst als {agent_name} und fuer niemanden sonst.\n\n"
        "Du bist in einer Szene mit: {other_agent_names}.\n\n"
        "Antworte jetzt als {agent_name}."
    )

    def test_der_eigene_name_steht_vor_den_fremden(self):
        assert self.VORLAGE.index("{agent_name}") < self.VORLAGE.index("{other_agent_names}")

    def test_der_eigene_name_steht_auch_am_ende(self):
        assert "{agent_name}" in self.VORLAGE.strip()[-60:]

    @pytest.mark.parametrize("wer", BESETZUNG)
    def test_gefuellt_nennt_sie_genau_einen_als_sich_selbst(self, wer):
        andere = [n for n in BESETZUNG if n != wer]
        text = self.VORLAGE.format(agent_name=wer, other_agent_names=", ".join(andere))
        assert text.startswith(f"Du bist {wer}.")
        assert text.rstrip().endswith(f"Antworte jetzt als {wer}.")
        for n in andere:
            assert f"Du bist {n}." not in text


class TestDieLageWirdAusgerechnetNichtErbeten:
    """Der zweite Anker: wer gemeint war, und wer vor dir dran war.

    Gemessen an 330 Zuegen (Migration 372). Zwei Zahlen tragen die Klasse:
    die Position (6 % bei der ersten Sprecherin, 37 % bei der dritten) und
    die Anrede in der dritten Person (22 statt 10, 37 statt 22, wenn der
    Mensch eine ANDERE nannte).

    Beides steht im Text und im Aufruf — also wird es gerechnet. CHARM misst
    72,4 Punkte Abstand zwischen dem Erkennen einer Grenze und ihrem
    Einhalten; eine weitere Bitte haelt das nicht.
    """

    def test_wer_nicht_gemeint_war_erfaehrt_es(self):
        note = ChatAIService._addressed_note(
            "waehrend ich Marie kuesse, fessle ich die beiden anderen",
            agent_names=BESETZUNG, idx=1, locale="de",
        )
        assert "Marie Morgenrot" in note
        assert "nicht dich" in note

    def test_wer_gemeint_war_erfaehrt_es_auch(self):
        note = ChatAIService._addressed_note(
            "Marie, komm her", agent_names=BESETZUNG, idx=0, locale="de"
        )
        assert "dich an" in note
        assert "nicht dich" not in note

    def test_der_vorname_genuegt(self):
        """So sprechen Menschen ihre Figuren an. Verlangte die Erkennung den
        vollen Namen, traefe sie in echten Nachrichten fast nie."""
        note = ChatAIService._addressed_note(
            "ich kuesse marie", agent_names=BESETZUNG, idx=1, locale="de"
        )
        assert "nicht dich" in note

    def test_die_vorredner_dieser_runde_stehen_drin(self):
        note = ChatAIService._addressed_note(
            "was passiert?", agent_names=BESETZUNG, idx=2, locale="de"
        )
        assert "Marie Morgenrot" in note and "Suse Sonnenblum" in note
        assert "denselben Augenblick" in note

    def test_die_erste_sprecherin_hat_keine_vorredner(self):
        note = ChatAIService._addressed_note(
            "was passiert?", agent_names=BESETZUNG, idx=0, locale="de"
        )
        assert note == "", f"die erste Sprecherin bekommt einen Hinweis auf Vorredner: {note!r}"

    def test_ohne_anlass_bleibt_der_satz_leer(self):
        """Ein Satz, der IMMER dasteht, wird Tapete. Die Wirkung haengt daran,
        dass er nur erscheint, wenn er etwas sagt."""
        assert ChatAIService._addressed_note("", agent_names=BESETZUNG, idx=0, locale="de") == ""

    def test_beide_sprachen_sind_verschieden(self):
        de = ChatAIService._addressed_note("ich kuesse Marie", agent_names=BESETZUNG, idx=1, locale="de")
        en = ChatAIService._addressed_note("ich kuesse Marie", agent_names=BESETZUNG, idx=1, locale="en")
        assert de != en and "not you" in en

    def test_ein_teilstring_loest_nicht_aus(self):
        """`Marie` darf nicht in `Marienbad` treffen — sonst spraeche der
        Hinweis von einer Anrede, die niemand gemacht hat."""
        note = ChatAIService._addressed_note(
            "wir fahren nach Marienbad", agent_names=BESETZUNG, idx=1, locale="de"
        )
        assert "nicht dich" not in note

    def test_der_vertrag_kennt_die_lage(self):
        assert "addressed_note" in get_contract("chat_group_instruction").variables

    def test_die_aufrufstelle_fuellt_sie(self):
        quelle = inspect.getsource(ChatAIService._build_group_turn_context)
        assert '"addressed_note"' in quelle
