"""Die Inhaltsstufe, und die Stellen, an denen eine Schranke still nachgibt.

Vier Arten, so etwas falsch zu bauen, und gegen jede steht hier ein Test:

* Die Rechnung nimmt das MAXIMUM statt des Minimums — dann hebt ein Klick die
  Stufe der Welt an.
* Die Grenze haengt an einer Einstellung — dann ist sie eine Vorgabe.
* Der Wortfilter sucht Vorkommen statt ganzer Woerter — dann faengt er
  `flamboyant` und wird abgeschaltet.
* Die Fehlermeldung nennt das gefundene Wort — dann ist sie eine Anleitung.
"""

import pytest

from backend.services.image_content_policy import (
    ContentRating,
    resolve_rating,
    screen_prompt,
)

GEN = ContentRating.GENERAL
MAT = ContentRating.MATURE


class TestDieRechnung:
    def test_das_minimum_gewinnt_nicht_das_maximum(self):
        d = resolve_rating(welt=GEN, nutzer_volljaehrig=True, nutzer_wunsch=MAT, angefragt=MAT)
        assert d.wirksam is GEN
        assert d.herabgestuft

    def test_der_eigene_wunsch_kann_senken(self):
        # Das ist die Einflussnahme: volljaehrig, Erwachsenenwelt — und trotzdem
        # jugendfrei, weil der Nutzer es so eingestellt hat.
        d = resolve_rating(welt=MAT, nutzer_volljaehrig=True, nutzer_wunsch=GEN, angefragt=MAT)
        assert d.wirksam is GEN
        assert "Einstellungen" in d.grund

    def test_der_eigene_wunsch_kann_nicht_anheben(self):
        # Und das ist die Grenze der Einflussnahme.
        d = resolve_rating(welt=GEN, nutzer_volljaehrig=True, nutzer_wunsch=MAT, angefragt=MAT)
        assert d.wirksam is GEN

    def test_der_eigene_wunsch_wird_zuerst_genannt(self):
        # Wer selbst abgeschaltet hat, soll das erfahren — die Auskunft fuehrt
        # zu einer Einstellung, die er aendern kann. „Diese Welt ist
        # jugendfrei" waere hier eine Sackgasse.
        d = resolve_rating(welt=GEN, nutzer_volljaehrig=False, nutzer_wunsch=GEN, angefragt=MAT)
        assert "Einstellungen" in d.grund

    def test_ohne_festgestellte_volljaehrigkeit_bleibt_es_jugendfrei(self):
        d = resolve_rating(welt=MAT, nutzer_volljaehrig=False, nutzer_wunsch=MAT, angefragt=MAT)
        assert d.wirksam is GEN

    def test_alle_vier_muessen_zustimmen(self):
        d = resolve_rating(welt=MAT, nutzer_volljaehrig=True, nutzer_wunsch=MAT, angefragt=MAT)
        assert d.wirksam is MAT
        assert not d.herabgestuft

    def test_wer_nichts_verlangt_bekommt_die_niedrigste(self):
        # Eine Vorgabe, die sich irrt, soll in die harmlose Richtung irren.
        assert resolve_rating(welt=MAT, nutzer_volljaehrig=True, nutzer_wunsch=MAT).wirksam is GEN

    def test_die_welt_wird_vor_dem_konto_genannt(self):
        # Wer in einer jugendfreien Welt sitzt, soll nicht nebenbei erfahren,
        # dass es ausserdem an seinem Konto laege.
        d = resolve_rating(welt=GEN, nutzer_volljaehrig=False, nutzer_wunsch=MAT, angefragt=MAT)
        assert "Welt" in d.grund
        assert "Volljaehrigkeit" not in d.grund


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


class TestDerKlientKannNichtsAnheben:
    """Die Durchsetzung, erschoepfend geprueft statt zugesichert.

    `angefragt` ist der einzige der vier Werte, den ein Client beeinflusst — die
    anderen drei liest der Server aus der Datenbank. Dieser Test geht jede
    Kombination durch und verlangt, dass keine Anfrage ein Ergebnis erzeugt, das
    hoeher liegt als das Minimum der drei serverseitigen Werte.

    Eine Zusicherung im Kommentar waere hier zu wenig: wer spaeter eine vierte
    Bedingung einbaut und die Reihenfolge vertauscht, faellt genau hier auf.
    """

    @pytest.mark.parametrize("welt", [GEN, MAT])
    @pytest.mark.parametrize("volljaehrig", [False, True])
    @pytest.mark.parametrize("wunsch", [GEN, MAT])
    @pytest.mark.parametrize("angefragt", [GEN, MAT])
    def test_nie_hoeher_als_die_serverseitige_obergrenze(self, welt, volljaehrig, wunsch, angefragt):
        obergrenze = MAT if (welt is MAT and volljaehrig and wunsch is MAT) else GEN
        d = resolve_rating(
            welt=welt,
            nutzer_volljaehrig=volljaehrig,
            nutzer_wunsch=wunsch,
            angefragt=angefragt,
        )
        rang = {GEN: 0, MAT: 1}
        assert rang[d.wirksam] <= rang[obergrenze]
        # Und die Anfrage darf auch nicht ueber sich selbst hinauswachsen.
        assert rang[d.wirksam] <= rang[angefragt]

    def test_die_vorgabe_ist_die_niedrigste(self):
        # Ein Aufrufer, der `angefragt` vergisst, bekommt jugendfrei — nicht das,
        # was Welt und Konto gerade hergeben.
        assert resolve_rating(welt=MAT, nutzer_volljaehrig=True, nutzer_wunsch=MAT).wirksam is GEN
