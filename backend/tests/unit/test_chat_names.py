"""Wann ein Text eine Person nennt — die Wortformen und ihre Grenzen.

Diese Datei gehoert zu `backend/services/chat/names.py`, dem gemeinsamen
Helfer zweier Stellen, die dieselbe Frage stellen: der Fokalisierungs-Detektor
(`_names_person`) und die Lage-Ansage im Prompt (`_addressed_note`). Sie
standen bis zum 05.09.2026 getrennt da und haben verschieden geantwortet —
ein Messgeraet, das eine andere Welt misst als die, in der die Anweisung
geschrieben wird.

Zwei Befunde eines gegenlesenden Agenten, hier selbst nachgemessen, und in
BEIDE Richtungen gepruef t: was treffen MUSS und was nicht treffen DARF. Die
zweite Haelfte ist die wichtigere — ein Name auf der Sperrliste ist eine
Figur, die nie angesprochen wird.

Alle Namen sind erfunden (`scripts/lint-no-chat-content.sh`).
"""

from __future__ import annotations

import pytest

from backend.services.chat.names import ANREDE_SPERRLISTE, anrede_teile, nennt


class TestDerTitelIstKeinVorname:
    """`name.split()[0]` ist nicht immer ein Vorname.

    Bei „Doktor Freundlich" ist das erste Feld der TITEL, und der Fehler geht
    in die schlimmere Richtung: die Figur haelt sich fuer gemeint, wenn der
    Mensch eine ANDERE anspricht.
    """

    def test_der_titel_faellt_aus_den_wortformen(self):
        assert anrede_teile("Doktor Freundlich") == ("Freundlich",)

    def test_ein_titel_im_text_trifft_niemanden(self):
        assert not nennt("Der Doktor hat abgesagt.", "Doktor Freundlich")

    def test_der_titel_einer_anderen_figur_trifft_nicht(self):
        """Der schlimmere Fall: hier ist nachweislich eine ANDERE gemeint."""
        assert not nennt("Ich frage den Doktor Blattgold.", "Doktor Freundlich")
        assert nennt("Ich frage den Doktor Blattgold.", "Benno Blattgold")

    @pytest.mark.parametrize(
        "name",
        ["Frau Morgenrot", "Hauptmann Blattgold", "Pater Cornelis", "Schwester Sonnenblum"],
    )
    def test_dieselbe_klasse_bei_anderen_titeln(self, name):
        titel = name.split()[0]
        assert titel not in anrede_teile(name)
        assert anrede_teile(name) == (name.split()[1],)

    def test_ein_punkt_am_titel_schuetzt_ihn_nicht(self):
        """„Dr." und „Dr" sind dasselbe Wort mit demselben Problem."""
        assert anrede_teile("Dr. Freundlich") == ("Freundlich",)

    def test_eine_figur_aus_lauter_sperrwoertern_bleibt_ansprechbar(self):
        """⚠ Die Gegenrichtung, und sie ist die gefaehrlichere: ein Name auf
        der Sperrliste waere eine Figur, die nie angesprochen wird. Bleibt
        nach dem Abzug nichts uebrig, gilt der Rohbestand."""
        assert anrede_teile("Die Alte") == ("Die", "Alte")
        assert nennt("Die Alte hat abgesagt.", "Die Alte")

    def test_die_sperrliste_enthaelt_keinen_denkbaren_vornamen(self):
        """Sie ist absichtlich klein. Namensgebung ist Sache des Nutzers."""
        for verboten in ("marie", "suse", "benno", "elena", "mira", "lena"):
            assert verboten not in ANREDE_SPERRLISTE

    def test_jedes_feld_zaehlt_nicht_nur_das_erste(self):
        """Der Nachname trifft ebenso — Menschen sprechen beide Formen an."""
        assert nennt("Morgenrot soll das erklaeren.", "Marie Morgenrot")
        assert nennt("Marie soll das erklaeren.", "Marie Morgenrot")

    def test_ein_zu_kurzes_feld_zaehlt_nicht(self):
        """Zwei Buchstaben treffen zu viel — „Jo" steckt in „Joch", „Jonas",
        „Kajol". Wortgrenzen allein reichen dafuer nicht."""
        assert anrede_teile("Jo Blattgold") == ("Blattgold",)


class TestDerSaechsischeGenitiv:
    """Im Deutschen die haeufigste flektierte Form eines Vornamens."""

    @pytest.mark.parametrize("text", ["Ich nehme Maries Tasche.", "Mariens Akte liegt da."])
    def test_der_genitiv_trifft(self, text):
        assert nennt(text, "Marie Morgenrot")

    def test_die_ungebeugte_form_trifft_weiterhin(self):
        assert nennt("Ich nehme Marie die Tasche.", "Marie Morgenrot")

    @pytest.mark.parametrize(
        "text",
        ["wir fahren nach Marienbad", "Ein Marienkaefer sitzt darauf.", "Der Marienplatz ist leer."],
    )
    def test_ein_laengeres_wort_ist_kein_treffer(self, text):
        """⚠ Die Gegenprobe zur Endung. Ohne sie waere `(?:s|ns)?` durch
        nichts begrenzt — und ein Vorname, der in jedem Ortsnamen steckt,
        machte die Lage-Ansage wertlos."""
        assert not nennt(text, "Marie Morgenrot")

    def test_der_genitiv_am_nachnamen_trifft_auch(self):
        assert nennt("Blattgolds Akte fehlt.", "Benno Blattgold")


class TestDieWortgrenzenHalten:
    def test_ein_name_als_wortteil_trifft_nicht(self):
        assert not nennt("Das Sonnenblumenfeld liegt brach.", "Suse Sonnenblum")

    def test_gross_und_kleinschreibung_sind_egal(self):
        assert nennt("und marie kam dazu", "Marie Morgenrot")

    def test_ein_leerer_name_trifft_nie(self):
        assert anrede_teile("") == ()
        assert not nennt("irgendein Text", "")
        assert not nennt("irgendein Text", "   ")

    def test_ein_leerer_text_trifft_nie(self):
        assert not nennt("", "Marie Morgenrot")
