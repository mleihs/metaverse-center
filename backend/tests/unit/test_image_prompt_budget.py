"""Das CLIP-Fenster — und die Kuerzung, die es nie stillschweigend tut.

Der Befund dahinter steht im Kopf von `image_prompt_budget`: beide Modelle der
Erwachsenenspur schneiden bei 77 Token ab, ohne Fehler und ohne Feld in der
Antwort. Von rund 160 Woertern kamen 60 an, und weggefallen ist das ENDE — die
dritte Figur und der Bildausschnitt.

Erfundene, harmlose Figuren, wo Beispiele noetig sind: Marie Morgenrot, Benno
Blattgold, Suse Sonnenblum, Doktor Freundlich.
"""

from __future__ import annotations

import logging

import pytest

from backend.services.image_model_families import family_for
from backend.services.image_prompt_budget import (
    fit_to_token_budget,
    tokenbudget,
    wortbudget,
)


class TestDasBudget:
    def test_das_fenster_von_77_traegt_rund_55_woerter(self):
        # Die Naeherung irrt absichtlich in die kurze Richtung: gemessen sind
        # 1,2 Token je Wort, gerechnet wird mit 1,35.
        assert 50 <= wortbudget(77) <= 60

    def test_hin_und_zurueck_bleibt_im_fenster(self):
        # `tokenbudget` ist die Umkehrung — sie darf das Fenster nie
        # ueberschaetzen, sonst kappt der Aufrufer zu spaet.
        for woerter in (1, 10, 55, 200):
            assert wortbudget(tokenbudget(woerter)) <= woerter

    def test_null_heisst_kein_bekanntes_fenster(self):
        lang = " ".join(["Wort"] * 500)
        assert fit_to_token_budget(lang, 0) == lang
        assert fit_to_token_budget(lang, -1) == lang


class TestDieKuerzung:
    def test_ein_kurzer_text_bleibt_unangetastet(self):
        text = "Marie Morgenrot steht am Fenster."
        assert fit_to_token_budget(text, 77) == text

    def test_gekappt_wird_an_der_satzgrenze(self):
        saetze = [f"Satz Nummer {i} traegt genau sechs Woerter hier." for i in range(40)]
        gekuerzt = fit_to_token_budget(" ".join(saetze), 77)
        # Kein halber Satz: das Ergebnis endet auf einem Satzzeichen.
        assert gekuerzt.endswith(".")
        assert len(gekuerzt.split()) <= wortbudget(77)

    def test_ein_einziger_langer_satz_wird_am_wort_gekappt(self):
        # Ohne Satzgrenze ist ein Bruchstueck unvermeidlich — aber es muss ein
        # ganzes Wort sein, nicht ein halbes.
        eins = " ".join(["Blattgold"] * 300)
        gekuerzt = fit_to_token_budget(eins, 77)
        assert gekuerzt
        assert "Blattgol " not in gekuerzt + " "
        assert len(gekuerzt.split()) == wortbudget(77)

    def test_die_kuerzung_meldet_sich(self, caplog: pytest.LogCaptureFixture):
        # DER PUNKT DIESER DATEI. Eine stille Kuerzung ist genau der Fehler,
        # gegen den sie geschrieben ist — sie darf nicht durch unsere eigene
        # Hand ein zweites Mal passieren.
        lang = " ".join(["Wort"] * 300)
        with caplog.at_level(logging.WARNING):
            fit_to_token_budget(lang, 77, was="scene_description")
        assert any("gekuerzt" in r.message for r in caplog.records)

    def test_ohne_kuerzung_wird_nichts_gemeldet(self, caplog: pytest.LogCaptureFixture):
        # Die Gegenprobe: ein Tor, das immer spricht, sagt nichts.
        with caplog.at_level(logging.WARNING):
            fit_to_token_budget("Suse Sonnenblum wartet.", 77)
        assert not caplog.records


class TestDieFamilieKenntIhrFenster:
    def test_sdxl_traegt_die_gemessenen_77(self):
        assert family_for("datacte/proteus-v0.2").clip_token_limit == 77
        assert family_for("asiryan/juggernaut-xl-v7").clip_token_limit == 77

    def test_flux_traegt_keine_geratene_grenze(self):
        # Flux kodiert mit T5 und hat ein erheblich groesseres Fenster. Eine
        # Zahl, die dort niemand gemessen hat, waere geraten — und eine
        # geratene Grenze kappt echte Bildaussage.
        assert family_for("black-forest-labs/flux-2-pro").clip_token_limit == 0
        assert family_for("black-forest-labs/flux-dev").clip_token_limit == 0
