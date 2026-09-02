"""Wem ein Satz im Gruppen-Prompt zugeschrieben wird.

Die Zuschreibung schlug den Namen bisher in der AKTUELLEN Besetzung nach. Ein
Agent, der aus der Unterhaltung entfernt wurde, steht dort nicht mehr — seine
alten Nachrichten liefen deshalb OHNE `[Name]:` als nackte `assistant`-Zeilen in
den Verlauf, und das antwortende Modell las die Worte des Abgegangenen als seine
eigenen frueheren. Kein Fehler, keine Meldung, nur eine Figur, die ploetzlich
Dinge behauptet, die sie nie gesagt hat.

Der Name gehoert deshalb an die NACHRICHT (`_load_history` holt `agents(name)`
mit), nicht an die Anwesenheitsliste. Diese Pruefung haelt die Gestalt fest, in
der er dort ankommt — sie ist die zerbrechliche Stelle: liegt sie falsch, faellt
die Methode still auf "kein Name" zurueck, also genau in den Fehler, den sie
schliessen soll.
"""

from backend.services.chat_ai_service import _DEPARTED_SPEAKER, ChatAIService


class TestMessageSpeaker:
    def test_eingebettet_als_objekt(self):
        """postgrest liefert eine to-one-Einbettung als Objekt."""
        assert ChatAIService._message_speaker({"agents": {"name": "Mira Steinfeld"}}) == "Mira Steinfeld"

    def test_eingebettet_als_liste(self):
        """Dieselbe Einbettung kann als einelementige Liste kommen."""
        assert ChatAIService._message_speaker({"agents": [{"name": "Doktor Fenn"}]}) == "Doktor Fenn"

    def test_leere_liste_ist_kein_name(self):
        assert ChatAIService._message_speaker({"agents": []}) is None

    def test_fehlende_einbettung_ist_kein_name(self):
        assert ChatAIService._message_speaker({"content": "x"}) is None

    def test_leerer_name_zaehlt_nicht_als_name(self):
        """Ein leerer String darf nicht als Sprecher durchgehen — `[]:` waere
        schlimmer als eine ehrliche Unbekannte."""
        assert ChatAIService._message_speaker({"agents": {"name": ""}}) is None


class TestFindAgentName:
    def test_findet_in_der_besetzung(self):
        agents = [{"id": "a1", "name": "Elena Voss"}]
        assert ChatAIService._find_agent_name(agents, "a1") == "Elena Voss"

    def test_entfernter_agent_steht_nicht_mehr_drin(self):
        """Genau der Fall, der den Fehler ausgeloest hat."""
        agents = [{"id": "a1", "name": "Elena Voss"}]
        assert ChatAIService._find_agent_name(agents, "a2") is None


def test_marke_fuer_die_verlorene_stimme_ist_nicht_leer():
    """Der Rueckfall muss etwas SAGEN. Ein leerer Wert brachte die Zeile zurueck
    in die Namenlosigkeit, aus der sie gerettet werden sollte."""
    assert _DEPARTED_SPEAKER
    assert _DEPARTED_SPEAKER.strip() == _DEPARTED_SPEAKER
