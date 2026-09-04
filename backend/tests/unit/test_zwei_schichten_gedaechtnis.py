"""Ein Bericht ueber euch ist nicht deine Erinnerung.

Bis Migration 373 war die verdichtete Vorgeschichte EIN Text je Abschnitt,
identisch an alle Figuren, und die Vorlage legte ihn ausdruecklich "als ihre
Erinnerung" vor. Gemessen mit dem eigenen Fokalisierungs-Detektor an einem
echten Faden: **11 von 12 Verdichtungen allwissend**, aus der Sicht jeder der
drei Figuren, zusammen rund 7 000 Token je Zug. Fuenf der zwoelf enthielten
sogar eine Ich-Form, die keiner Leserin gehoerte.

Die Bauform folgt der einzigen Ablation, die genau diese Wahl misst
(ReverieMem, arXiv:2606.25632, KBF-QA ueber 4 386 Fragen):

    geteilter Abruf ueber alles          KBF 18,9   Verweigerung 10,0
    Summierung ueber Baeume (RAPTOR)     KBF 16,8   Verweigerung  8,7
    NUR geteilte Schicht                 KBF 60,9   Verweigerung 47,0
    NUR Ich-Schicht je Figur             KBF 17,8   Treffer      10,8
    BEIDE                                KBF 73,3   Verweigerung 81,2

Die beiden Einzelschichten sind deshalb KEINE Sparvariante: die geteilte
allein laesst die Figur weiter ueber ihre Grenze sprechen, die eigene allein
macht sie zur Amnestikerin. Diese Datei haelt fest, dass beide da sind und
dass die eine nicht in die andere laeuft.
"""

from __future__ import annotations

from backend.services.chat.conversation_digest_service import ConversationDigestService as Digest
from backend.services.prompt_contracts import get_contract


def _zeile(seg: int, text: str, agent: str | None) -> dict:
    return {
        "segment_index": seg,
        "covers_from": "2026-09-01T10:00:00",
        "covers_to": "2026-09-01T11:00:00",
        "summary": text,
        "agent_id": agent,
    }


ZEILEN = [
    _zeile(0, "Marie legte die Akte auf den Tisch. Suse zoegerte.", None),
    _zeile(0, "Ich sah die Akte und sagte nichts.", "marie"),
    _zeile(0, "Ich wollte fragen und traute mich nicht.", "suse"),
]


class TestJedeFigurBekommtNurIhreEigene:
    def test_die_eigene_erinnerung_ist_dabei(self):
        assert "Ich sah die Akte" in Digest.render(ZEILEN, "de", agent_id="marie")

    def test_die_fremde_ist_nicht_dabei(self):
        """Der ganze Zweck. Stuende sie drin, waere es wieder ein Bericht ueber
        alle — nur diesmal in der Ich-Form, was schlimmer waere als vorher."""
        text = Digest.render(ZEILEN, "de", agent_id="marie")
        assert "traute mich nicht" not in text

    def test_das_protokoll_bekommen_beide(self):
        for wer in ("marie", "suse"):
            assert "Akte auf den Tisch" in Digest.render(ZEILEN, "de", agent_id=wer)

    def test_ohne_kennung_nur_das_protokoll(self):
        """Der Rueckfall. Eine vergessene Kennung darf kein fremdes Innenleben
        ausliefern — lieber weniger Gedaechtnis als falsches."""
        text = Digest.render(ZEILEN, "de")
        assert "Akte auf den Tisch" in text
        assert "Ich sah" not in text and "traute mich nicht" not in text

    def test_zwei_figuren_bekommen_verschiedenen_text(self):
        assert Digest.render(ZEILEN, "de", agent_id="marie") != Digest.render(ZEILEN, "de", agent_id="suse")


class TestDieUeberschriftenSagenWasEsIst:
    def test_das_protokoll_heisst_nicht_erinnerung(self):
        """Die alte Vorlage sagte woertlich 'als ihre Erinnerung'. Das war die
        Zuschreibung, aus der die Figur schloss, sie habe alles miterlebt."""
        text = Digest.render([ZEILEN[0]], "de")
        kopf = text.splitlines()[0]
        assert "Protokoll" in kopf
        assert "Erinnerung" not in kopf

    def test_die_eigene_schicht_heisst_erinnerung(self):
        text = Digest.render(ZEILEN, "de", agent_id="marie")
        assert "Woran DU dich davon erinnerst" in text

    def test_die_eigene_steht_zuletzt(self):
        """Das Letzte vor der Antwort gewinnt — dieselbe Begruendung wie in
        367/371/372. Die eigene Stimme soll die letzte sein, die die Figur von
        sich liest."""
        text = Digest.render(ZEILEN, "de", agent_id="marie")
        assert text.index("Protokoll") < text.index("Woran DU")

    def test_englisch_ist_wirklich_anders(self):
        de = Digest.render(ZEILEN, "de", agent_id="marie")
        en = Digest.render(ZEILEN, "en", agent_id="marie")
        assert de != en
        assert "Record of this conversation" in en and "What you yourself remember" in en


class TestDiePerspektivgrenzeGiltWeiter:
    def test_was_vor_dem_beitritt_endete_faellt_weg(self):
        """Die Zusage aus dem Perspektivschnitt darf durch die zweite Schicht
        nicht verlorengehen — sonst kaeme die Vorgeschichte durch die
        Hintertuer der eigenen Erinnerung zurueck."""
        alt = _zeile(0, "Lange vor dem Beitritt.", None)
        neu = _zeile(1, "Nach dem Beitritt.", None)
        neu["covers_from"] = "2026-09-02T10:00:00"
        text = Digest.render([alt, neu], "de", since="2026-09-02T00:00:00")
        assert "Nach dem Beitritt" in text
        assert "Lange vor dem Beitritt" not in text


class TestDerVertragKenntDieIchSchicht:
    def test_die_vorlage_ist_deklariert(self):
        v = get_contract("chat_character_episode")
        assert v is not None
        assert {"agent_name", "transcript", "segment_index"} <= v.variables

    def test_der_eigene_name_ist_pflicht(self):
        """Ohne ihn waere die Ich-Vorlage wieder ein Bericht ueber alle."""
        assert "agent_name" in get_contract("chat_character_episode").required


class TestDieErzeugungHaeltBeideAuseinander:
    def test_protokoll_und_episode_werden_getrennt_gezaehlt(self):
        """Wuerde ueber beide zusammen gezaehlt, hielte ein vorhandenes
        Protokoll den Abschnitt fuer erledigt — und keine Figur bekaeme je
        eine eigene Erinnerung. Das Merkmal saehe gebaut aus und liefe nie."""
        import inspect

        quelle = inspect.getsource(Digest.ensure_digests)
        assert "hat_protokoll" in quelle and "hat_episode" in quelle
        assert "not r.get(\"agent_id\")" in quelle

    def test_eine_episode_ohne_protokoll_wird_nicht_geschrieben(self):
        """Die Ich-Schicht ALLEIN misst 17,8 statt 73,3. Sie darf nie die
        einzige sein."""
        import inspect

        quelle = inspect.getsource(Digest.ensure_digests)
        assert "index not in hat_protokoll" in quelle
