"""Wer im Faden ist, entscheidet die Verknuepfungstabelle — nicht eine Altlast.

GEMESSEN am 05.09.2026 auf Produktion, beim Durchspielen eines frischen
Fadens: Aus einem Gespraech mit drei Figuren wurden zwei entfernt, sodass
genau eine uebrig blieb. Geantwortet hat trotzdem eine der ENTFERNTEN — und
sie merkte in ihrer Antwort selbst an, dass der angesprochene Name nicht der
ihre sei.

Ursache: `chat_conversations.agent_id` ist eine Spalte aus der Zeit vor den
Gruppengespraechen. Sie traegt die Figur, mit der ein Faden ANGELEGT wurde,
und wird beim Entfernen nicht mitgepflegt. `_prepare_single_context` las sie.

Der Verteiler (`ChatService.stream_ai_response`) hat die Besetzung da schon
richtig geladen und schickt bei genau einer Figur in den Einzelpfad. Dass
diese Funktion die Frage ein ZWEITES Mal beantwortet hat, aus einer anderen
Quelle, war der ganze Fehler.

Dieselbe Untersuchung fand die zweite Haelfte: die Perspektivgrenze stand nur
im Gruppenpfad. Eine Zusage, die davon abhaengt, wie viele Figuren gerade
anwesend sind, ist keine.
"""

from __future__ import annotations

import inspect

from backend.services.chat_ai_service import ChatAIService

QUELLE = inspect.getsource(ChatAIService._prepare_single_context)


class TestDieBesetzungKommtAusDerTabelle:
    def test_die_verknuepfungstabelle_wird_gefragt(self):
        assert "_load_conversation_agents" in QUELLE, (
            "der Einzelpfad fragt die Besetzung nicht — eine entfernte Figur "
            "kann weiter antworten"
        )

    def test_die_altlast_ist_nur_noch_rueckfall(self):
        """Sie bleibt fuer Faeden aus der Zeit vor der Tabelle. Aber sie darf
        nicht mehr die ERSTE Antwort auf die Frage sein."""
        i_tabelle = QUELLE.index("_load_conversation_agents")
        i_spalte = QUELLE.index('conversation.get("agent_id")')
        assert i_tabelle < i_spalte, "die Altlast-Spalte wird vor der Tabelle gelesen"

    def test_der_rueckfall_steht_im_else(self):
        """Sonst ueberschriebe er die richtige Antwort."""
        zeilen = [z.strip() for z in QUELLE.splitlines()]
        i = next(n for n, z in enumerate(zeilen) if 'conversation.get("agent_id")' in z)
        davor = " ".join(zeilen[max(0, i - 3) : i])
        assert "else" in davor, f"der Rueckfall haengt an keiner Bedingung: {davor!r}"


class TestDiePerspektivgrenzeGiltAuchAllein:
    def test_sie_wird_im_einzelpfad_angewendet(self):
        assert "_bound_to_perspective" in QUELLE, (
            "der Einzelpfad schneidet den Verlauf nicht auf den Beitritt — "
            "eine Figur, die spaeter dazukam, saehe alles"
        )

    def test_sie_bekommt_den_beitritt_aus_der_tabelle(self):
        """`_joined_at` reist mit dem Agenten aus `_load_conversation_agents`.
        Ohne ihn waere der Schnitt ein Aufruf ohne Wirkung."""
        assert "joined_at" in QUELLE
        zeile = next(z for z in QUELLE.splitlines() if "_bound_to_perspective" in z)
        assert "joined_at" in zeile, f"der Schnitt bekommt keinen Beitritt: {zeile.strip()!r}"

    def test_beide_pfade_benutzen_dieselbe_funktion(self):
        """Nicht zwei Schnitte, die auseinanderlaufen koennen."""
        gruppe = inspect.getsource(ChatAIService._build_group_turn_context)
        assert "_bound_to_perspective" in gruppe
