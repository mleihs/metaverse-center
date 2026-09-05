"""Die Erwachsenenspur: was sie aufloest, und der Schalter, der still ausblieb.

Der Fehler, gegen den die zweite Klasse hier steht, ist der leiseste in der
ganzen Bildkette. Es gab einen Kommentar, der sagte, die Sicherheitstoleranz
komme aus `image_safety_tolerance_*` — und darunter eine Zeile, die sie
hartkodierte. Beides stand nur in EINEM Aufrufer. Jeder andere Weg in die
Erwachsenenstufe bekam die vorsichtige 2, also `disable_safety_checker=False`,
also ein weichgezeichnetes Bild: kein Fehler, kein Log, nur ein Ergebnis, das
nicht war, was eingestellt wurde.
"""

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.services.image_content_policy import ContentRating
from backend.services.model_resolver import ModelResolver

GEN = ContentRating.GENERAL
MAT = ContentRating.MATURE


def _resolver(einstellungen: dict[str, object]) -> ModelResolver:
    """Ein Aufloeser, dessen `platform_settings` genau `einstellungen` sind."""
    supabase = MagicMock()

    def table(_name: str):
        t = MagicMock()
        t.select.return_value = t
        t.maybe_single.return_value = t

        def eq(_spalte: str, schluessel: str):
            treffer = MagicMock()
            treffer.execute = AsyncMock(
                return_value=MagicMock(
                    data={"setting_value": einstellungen[schluessel]}
                    if schluessel in einstellungen
                    else None
                )
            )
            treffer.select.return_value = treffer
            treffer.maybe_single.return_value = treffer
            return treffer

        t.eq.side_effect = eq
        return t

    supabase.table.side_effect = table
    return ModelResolver(supabase, simulation_id=None)


class TestWelchesModell:
    @pytest.mark.asyncio
    async def test_der_zweck_gewinnt_vor_dem_rueckfall(self):
        r = _resolver({"image_models_mature": {"scene": "a/eins", "fallback": "b/zwei"}})
        assert await r._mature_model("scene") == "a/eins"

    @pytest.mark.asyncio
    async def test_ohne_eigenen_eintrag_gilt_der_rueckfall(self):
        r = _resolver({"image_models_mature": {"fallback": "b/zwei"}})
        assert await r._mature_model("agent_portrait") == "b/zwei"

    @pytest.mark.asyncio
    async def test_eine_nicht_eingerichtete_spur_gibt_leer_zurueck(self):
        # Leer heisst: der Aufruf faellt auf die jugendfreie Spur zurueck. Das
        # ist die richtige Richtung, in die eine fehlende Einstellung irrt.
        assert await _resolver({}) ._mature_model("scene") == ""
        assert await _resolver({"image_models_mature": {}})._mature_model("scene") == ""

    @pytest.mark.asyncio
    async def test_eine_als_text_gespeicherte_zeile_wird_gelesen(self):
        # jsonb kann als String zurueckkommen, je nachdem wie geschrieben wurde.
        r = _resolver({"image_models_mature": json.dumps({"scene": "a/eins"})})
        assert await r._mature_model("scene") == "a/eins"


class TestDerSchalter:
    """Die Toleranz kommt vom Betreiber — in BEIDE Richtungen."""

    @pytest.mark.asyncio
    async def test_die_erwachsenenstufe_liest_ihren_eigenen_schluessel(self):
        r = _resolver({"image_safety_tolerance_mature": 5})
        assert await r._safety_tolerance(MAT) == 5

    @pytest.mark.asyncio
    async def test_die_jugendfreie_stufe_liest_ihren(self):
        r = _resolver({"image_safety_tolerance_general": 2})
        assert await r._safety_tolerance(GEN) == 2

    @pytest.mark.asyncio
    async def test_der_betreiber_kann_die_erwachsenenstufe_enger_stellen(self):
        # Der Punkt der ganzen Aenderung: der Wert ist eine Einstellung, keine
        # Konstante. Wer 3 eintraegt, bekommt 3 — und nicht die 5, die vorher
        # im Code stand.
        r = _resolver({"image_safety_tolerance_mature": 3})
        assert await r._safety_tolerance(MAT) == 3

    @pytest.mark.asyncio
    async def test_ein_fehlender_erwachsenenschluessel_wird_nicht_zur_vorsicht(self):
        # Eine 2 waere hier keine Vorsicht, sondern eine stille Verweigerung
        # dessen, was der Nutzer eingestellt hat — die Stufe ist ja bereits
        # durch `resolve_rating` gegangen.
        assert await _resolver({})._safety_tolerance(MAT) == 5

    @pytest.mark.asyncio
    async def test_ein_fehlender_jugendfreier_schluessel_irrt_zur_vorsicht(self):
        assert await _resolver({})._safety_tolerance(GEN) == 2

    @pytest.mark.asyncio
    @pytest.mark.parametrize("kaputt", ["", "zwei", None, {}, []])
    async def test_ein_unlesbarer_wert_faellt_auf_die_vorgabe(self, kaputt):
        r = _resolver({"image_safety_tolerance_mature": kaputt})
        assert await r._safety_tolerance(MAT) == 5

    @pytest.mark.asyncio
    async def test_die_zeile_wird_einmal_gelesen(self):
        # Ein Bildlauf fragt sie mehrfach; eine Abfrage pro Aufruf waere eine
        # Runde zur Datenbank je Bild.
        r = _resolver({"image_safety_tolerance_mature": 5})
        for _ in range(4):
            await r._safety_tolerance(MAT)
        assert r._supabase.table.call_count == 1


class TestDerSchalterKommtAuchAn:
    """Zwischen der Zahl und dem Feld liegt die Familie."""

    @pytest.mark.asyncio
    async def test_flux_bekommt_die_zahl_woertlich(self):
        from backend.services.model_resolver import ResolvedImageModel

        m = ResolvedImageModel(model="black-forest-labs/flux-2-pro", safety_tolerance=5)
        assert m.to_replicate_params()["safety_tolerance"] == 5

    @pytest.mark.asyncio
    async def test_die_sd_abkoemmlinge_bekommen_einen_schalter(self):
        from backend.services.model_resolver import ResolvedImageModel

        # Umgekehrt gepolt: `True` schaltet die Pruefung AB.
        offen = ResolvedImageModel(model="datacte/proteus-v0.2", safety_tolerance=5)
        eng = ResolvedImageModel(model="datacte/proteus-v0.2", safety_tolerance=2)
        assert offen.to_replicate_params()["disable_safety_checker"] is True
        assert eng.to_replicate_params()["disable_safety_checker"] is False
