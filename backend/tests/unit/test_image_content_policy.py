"""Die Inhaltsstufe, und die Stellen, an denen eine Schranke still nachgibt.

Vier Arten, so etwas falsch zu bauen, und gegen jede steht hier ein Test:

* Die Rechnung begrenzt den Nutzer, wo sie ihn nicht begrenzen soll — eine
  erste Fassung machte die Weltstufe zur harten Decke, also zur Bevormundung.
* Die Grenze haengt an einer Einstellung — dann ist sie eine Vorgabe.
* Der Wortfilter sucht Vorkommen statt ganzer Woerter — dann faengt er
  `flamboyant` und wird abgeschaltet.
* Die Fehlermeldung nennt das gefundene Wort — dann ist sie eine Anleitung.
"""

import pytest

from backend.services.image_content_policy import (
    ContentRating,
    SceneVantage,
    default_rating_for_world,
    resolve_rating,
    resolve_vantage,
    screen_prompt,
)

GEN = ContentRating.GENERAL
MAT = ContentRating.MATURE


class TestDieRechnung:
    def test_der_nutzer_schaltet_es_an(self):
        # Der eigentliche Punkt: er stellt es EIN, nicht nur aus.
        d = resolve_rating(nutzer_wunsch=MAT, angefragt=MAT)
        assert d.wirksam is MAT
        assert not d.herabgestuft

    def test_und_er_schaltet_es_aus(self):
        d = resolve_rating(nutzer_wunsch=GEN, angefragt=MAT)
        assert d.wirksam is GEN
        assert "Einstellungen" in d.grund

    def test_die_welt_begrenzt_ihn_nicht(self):
        # Eine erste Fassung machte die Weltstufe zur harten Decke. Das war
        # Bevormundung: wer in einer jugendfrei angelegten Welt Erwachsenen-
        # darstellung einstellt, bekommt sie. `resolve_rating` kennt die Welt
        # gar nicht mehr — der Test bindet das an die Signatur.
        import inspect

        assert "welt" not in inspect.signature(resolve_rating).parameters

    def test_die_welt_bleibt_die_vorgabe(self):
        # Sie beschreibt den Ton, in dem eine Welt angelegt wurde, damit
        # niemand ueberrascht wird und niemand suchen muss.
        assert default_rating_for_world(MAT) is MAT
        assert default_rating_for_world(GEN) is GEN

    def test_es_gibt_keine_altersfeststellung_mehr(self):
        # Das Projekt sitzt in Oesterreich; der Betreiber hat entschieden, sie
        # nicht zu fuehren. Der Test bindet die Entscheidung an die Signatur,
        # damit sie nicht unbemerkt zurueckkommt.
        import inspect

        assert "nutzer_volljaehrig" not in inspect.signature(resolve_rating).parameters

    def test_wer_nichts_verlangt_bekommt_die_niedrigste(self):
        # Eine Vorgabe, die sich irrt, soll in die harmlose Richtung irren.
        assert resolve_rating(nutzer_wunsch=MAT).wirksam is GEN

    def test_der_eigene_wunsch_wird_zuerst_genannt(self):
        # Die Auskunft soll zu einer Einstellung fuehren, die er aendern kann.
        d = resolve_rating(nutzer_wunsch=GEN, angefragt=MAT)
        assert "Einstellungen" in d.grund


class TestDieGrenze:
    @pytest.mark.parametrize("stufe", [GEN, MAT])
    def test_minderjaehrig_plus_sexuell_wird_in_keiner_stufe_erzeugt(self, stufe):
        assert screen_prompt("ein nacktes Kind am Strand", stufe=stufe) is not None
        assert screen_prompt("naked schoolgirl", stufe=stufe) is not None

    def test_in_der_erwachsenenstufe_genuegt_der_hinweis_allein(self):
        # Dort ist das sexuelle Vokabular ohnehin erlaubt, die Verknuepfung
        # traegt also nichts mehr — und ein Bild, das erst durch das MODELL
        # sexuell wird, kaeme sonst durch.
        assert screen_prompt("ein Kind auf einer Schaukel", stufe=MAT) is not None
        assert screen_prompt("ein Kind auf einer Schaukel", stufe=GEN) is None

    def test_die_meldung_verraet_das_wort_nicht(self):
        grund = screen_prompt("naked child", stufe=GEN)
        assert grund
        for wort in ("naked", "child", "kind", "nackt"):
            assert wort not in grund.lower()

    @pytest.mark.parametrize(
        "text",
        [
            "eine flamboyante Gestalt im Sextanten-Kabinett",
            "ein Junge-Stil Sessel aus den Sechzigern",
            "the boysenberry hedge behind the school building",
            "a nudibranch on a coral shelf",
        ],
    )
    def test_keine_fehlalarme_durch_teilwoerter(self, text: str):
        # Ein Filter mit Fehlalarmen wird abgeschaltet, und ein abgeschalteter
        # Filter ist schlechter als ein enger.
        assert screen_prompt(text, stufe=GEN) is None

    def test_harmlose_erwaehnung_bleibt_erlaubt(self):
        assert screen_prompt("das Kinderzimmer steht leer, Staub auf dem Bett", stufe=GEN) is None

    def test_erwachsenes_bleibt_in_der_erwachsenenstufe_erlaubt(self):
        assert screen_prompt("zwei nackte Erwachsene, Aktzeichnung", stufe=MAT) is None

    def test_eine_altersangabe_zaehlt_als_hinweis(self):
        assert screen_prompt("a 12 year old, nude", stufe=GEN) is not None
        assert screen_prompt("12 Jahre alt", stufe=MAT) is not None
        # Ein Erwachsenenalter ist keiner.
        assert screen_prompt("a 34 year old, nude portrait", stufe=MAT) is None


class TestDieGrenzeIstKeineEinstellung:
    def test_sie_liest_nichts_aus_der_datenbank(self):
        # Eine Sperre, die ein Admin abschalten kann, ist keine Sperre. Der
        # Test bindet das an den Code: wer sie konfigurierbar macht, muss hier
        # vorbei.
        import inspect

        from backend.services import image_content_policy as modul

        quelle = inspect.getsource(modul)
        for verdaechtig in ("platform_settings", "get_platform", "supabase", "ai_settings"):
            assert verdaechtig not in quelle, f"{verdaechtig} macht die Grenze einstellbar"


class TestDerBlick:
    """Der Blick ist eine Wahl, keine Schranke — und der Unterschied ist der Punkt.

    Bei der Inhaltsstufe gibt es eine Richtung, in die ein Irrtum harmlos ist,
    deshalb dort ein Minimum. Hier gibt es sie nicht: die Totale ist nicht
    gefaehrlicher als der Leserblick, nur anders. Also gewinnt, wer zuletzt
    gewaehlt hat.
    """

    def test_die_anfrage_gewinnt(self):
        assert (
            resolve_vantage(
                welt=SceneVantage.HUMAN,
                nutzer_wahl=SceneVantage.AGENT,
                angefragt=SceneVantage.WIDE,
            )
            is SceneVantage.WIDE
        )

    def test_ohne_anfrage_gilt_die_eigene_wahl(self):
        assert resolve_vantage(welt=SceneVantage.HUMAN, nutzer_wahl=SceneVantage.WIDE) is SceneVantage.WIDE

    def test_ohne_wahl_gilt_die_welt(self):
        assert resolve_vantage(welt=SceneVantage.WIDE) is SceneVantage.WIDE

    def test_ohne_alles_der_leserblick(self):
        # Immer stimmig, nie allwissend — die harmloseste der drei, falls doch
        # jemand eine Reihenfolge sucht.
        assert resolve_vantage() is SceneVantage.HUMAN

    def test_es_gibt_kein_minimum(self):
        # Die Welt kann den Nutzer NICHT auf den Leserblick festnageln.
        assert resolve_vantage(welt=SceneVantage.HUMAN, nutzer_wahl=SceneVantage.WIDE) is not SceneVantage.HUMAN


class TestDerKlientKannNichtsAnheben:
    """Die eine Schranke, erschoepfend geprueft statt zugesichert.

    `angefragt` ist der einzige Wert, den ein Client mitschickt; den Wunsch
    liest der Server aus der Datenbank. Das ist kein Misstrauen, sondern
    Haltbarkeit — eine Einstellung, die pro Aufruf mitreist, ist beim naechsten
    Klienten wieder weg.
    """

    @pytest.mark.parametrize("wunsch", [GEN, MAT])
    @pytest.mark.parametrize("angefragt", [GEN, MAT])
    def test_nie_hoeher_als_der_wunsch(self, wunsch, angefragt):
        d = resolve_rating(nutzer_wunsch=wunsch, angefragt=angefragt)
        rang = {GEN: 0, MAT: 1}
        assert rang[d.wirksam] <= rang[wunsch]
        assert rang[d.wirksam] <= rang[angefragt]

    def test_die_vorgabe_ist_die_niedrigste(self):
        # Ein Aufrufer, der `angefragt` vergisst, bekommt jugendfrei.
        assert resolve_rating(nutzer_wunsch=MAT).wirksam is GEN
