"""Die Empfehlung des Modellautors — und die Zahl, an der die Szenen scheiterten.

Drei Befunde vom 05.09.2026 werden hier festgenagelt, damit keiner von ihnen
unbemerkt zurueckkommt:

1. `img2img_strength` stand fuer JEDEN Zweck auf 0,75. Bei einer Szene
   uebertrifft die Referenz damit den Prompt: gemessen kam bei 0,60 und 0,75
   ein Einzelportraet, bei 0,90 die bestellte Szene mit drei Figuren.
2. Der Negativprompt einer Szene kam aus dem GEBAEUDE-Zweig und verbot
   „people, humans, characters, faces" — das Gegenteil dessen, was bestellt war.
3. `apply_watermark` steht bei `datacte/proteus-v0.2` per Vorgabe auf `True`.
   Wir haben es nie gesetzt, also trug jedes Bild der Erwachsenenspur ein
   Wasserzeichen.
"""

from __future__ import annotations

import pytest

from backend.services.image_model_families import tuning_for
from backend.services.model_resolver import PLATFORM_DEFAULT_PARAMS, ModelResolver, ResolvedImageModel


def _params(model: str, **kw) -> dict:
    aufgeloest = ResolvedImageModel(model=model, **kw)
    return aufgeloest.to_replicate_params()


class TestDieEmpfehlungIstModellgenau:
    def test_proteus_und_juggernaut_sind_nicht_dieselbe_empfehlung(self):
        # DER GRUND, WARUM ES DIESE TABELLE GIBT. Beide liegen in `_SDXL`,
        # nehmen dieselben Felder — und ihre Autoren nennen fast gegenteilige
        # Fuehrungswerte. Eine Zahl fuer beide kann nicht richtig sein.
        proteus = tuning_for("datacte/proteus-v0.2")
        juggernaut = tuning_for("asiryan/juggernaut-xl-v7")
        assert proteus is not None and juggernaut is not None
        assert proteus.guidance_scale != juggernaut.guidance_scale

    def test_proteus_bekommt_nicht_die_zahl_von_v0_4(self):
        # Die oft zitierte niedrige Fuehrung (4 bis 6) gehoert zu ProteusV0.4.
        # Die Karte von v0.2 sagt ausdruecklich 7 bis 8. Die Zahl vom falschen
        # Modell zu uebernehmen war der erste Entwurf dieser Zeile.
        tuning = tuning_for("datacte/proteus-v0.2")
        assert tuning is not None
        assert 7.0 <= (tuning.guidance_scale or 0) <= 8.0

    def test_ein_ungemessenes_modell_hat_keine_empfehlung(self):
        assert tuning_for("stability-ai/sdxl") is None
        assert tuning_for("black-forest-labs/flux-2-pro") is None

    def test_beide_huellen_derselben_gewichte_teilen_die_empfehlung(self):
        # `datacte/proteus-v0.2` und `asiryan/proteus-v0.2` sind dieselben
        # Gewichte in zwei Huellen; die Empfehlung des Gewichtsautors gilt fuer
        # beide.
        assert tuning_for("asiryan/proteus-v0.2") is tuning_for("datacte/proteus-v0.2")


class TestDasWasserzeichen:
    def test_proteus_bekommt_apply_watermark_false(self):
        # Ohne diese Zeile traegt jedes Bild ein Wasserzeichen: die Vorgabe des
        # Modells ist `True`, und ein NICHT gesendetes Feld heisst hier nicht
        # „aus".
        assert _params("datacte/proteus-v0.2")["apply_watermark"] is False

    def test_juggernaut_bekommt_es_nicht_untergeschoben(self):
        # Juggernaut fuehrt das Feld nicht. Replicate verwuerfe es still — aber
        # ein gesendetes Feld ohne Wirkung taeuscht eine Einstellung vor.
        assert "apply_watermark" not in _params("asiryan/juggernaut-xl-v7")


class TestDieReferenzstaerke:
    def test_die_szene_bekommt_mehr_als_der_rest(self):
        # DIE ZAHL, AN DER DIE SZENENBILDER GESCHEITERT SIND. Gemessen an
        # beiden Modellen getrennt: 0,75 gibt ein Einzelportraet, 0,90 die
        # bestellte Szene.
        szene = ModelResolver._reference_strength("scene", {})
        portraet = ModelResolver._reference_strength("agent_portrait", {})
        assert szene == pytest.approx(0.90)
        assert portraet == pytest.approx(0.75)
        assert szene > portraet

    def test_die_welt_darf_sie_herunterdrehen(self):
        # Der Preis von 0,90 ist das Gesicht der Referenz. Eine Welt, der die
        # Wiedererkennbarkeit wichtiger ist als die Szene, muss das waehlen
        # koennen — deshalb ist es eine Einstellung und keine Konstante.
        assert ModelResolver._reference_strength("scene", {"image_ref_strength_scene": "0.6"}) == pytest.approx(0.6)

    def test_die_vorgabe_steht_an_einer_stelle(self):
        # Gegen die Sorte Fehler, die dieses Repo schon zweimal hatte: ein
        # Wert im Code und ein zweiter in der Vorgabetabelle, die auseinander
        # laufen.
        assert PLATFORM_DEFAULT_PARAMS["image_ref_strength_scene"] == pytest.approx(0.90)


class TestDerNegativpromptKenntDieSzene:
    def test_die_szene_faellt_nicht_mehr_in_den_gebaeude_zweig(self):
        # Der Gebaeude-Negativprompt verbietet „people, humans, characters,
        # faces". Eine Szene lief bis zum 05.09.2026 in ihn hinein — wir haben
        # drei Figuren bestellt und im selben Aufruf Menschen verboten.
        szene = ModelResolver._negative_prompt_for("scene", {}, None)
        for verboten in ("people", "humans", "characters", "faces"):
            assert verboten not in szene.lower(), f"'{verboten}' verbietet, was bestellt ist"

    def test_die_drei_zwecke_sind_wirklich_drei(self):
        szene = ModelResolver._negative_prompt_for("scene", {}, None)
        portraet = ModelResolver._negative_prompt_for("agent_portrait", {}, None)
        gebaeude = ModelResolver._negative_prompt_for("building_image", {}, None)
        assert len({szene, portraet, gebaeude}) == 3

    def test_die_welt_geht_dem_autor_vor(self):
        tuning = tuning_for("asiryan/juggernaut-xl-v7")
        eigen = ModelResolver._negative_prompt_for("scene", {"negative_prompt_scene": "eigenes"}, tuning)
        assert eigen == "eigenes"

    def test_ein_leerer_autorenwunsch_ist_eine_aussage(self):
        # Juggernauts Autor sagt woertlich „start with no negative". Der leere
        # Text ist deshalb ein WERT und darf nicht als „nicht gesetzt" gelten —
        # sonst faellt der Aufruf auf die Plattformvorgabe zurueck.
        tuning = tuning_for("asiryan/juggernaut-xl-v7")
        assert tuning is not None
        assert tuning.negative_prompt == ""
        assert ModelResolver._negative_prompt_for("scene", {}, tuning) == ""
