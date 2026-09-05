"""Was ein Bildmodell wirklich annimmt — gegen abgeschriebene Schemata geprueft.

Replicate verwirft ein unbekanntes Eingabefeld STILL. Der Aufruf gelingt, das
Bild kommt, und der Unterschied steht nirgends: kein Fehler, kein Log, kein
Statuswechsel. Deshalb ist die einzige Stelle, an der ein falscher Feldname
auffaellt, ein Test — und der braucht die echten Schemata.

Die Listen unten sind am 05.09.2026 von `api.replicate.com/v1/models/<m>` unter
`latest_version.openapi_schema` abgeschrieben, nicht geschaetzt. Sie stehen als
Abschrift hier, weil CI kein Netz hat und ein Test, der bei fehlendem Netz
durchwinkt, kein Test ist.

Drei Richtungen, und die dritte ist die, die den Aufruf umbringt:

* Kein Feld, das das Modell nicht kennt — bis auf eine benannte, begruendete
  Liste (`TOLERIERT`), wo das Streuen billiger ist als das Raten.
* Kein Feld VERGESSEN, das es kennt und das wir bewusst setzen wollen — das
  war der echte Fehler: `asiryan/juggernaut-xl-v7` traf keine einzige Marke,
  fiel in die Unbekannt-Familie und bekam drei Felder statt vierzehn. Bild kam
  trotzdem — in falscher Groesse, ohne Fuehrung, ohne Negativprompt.
* Kein Feld mit einem Wert, den das Schema als Enum ablehnt. Das ist die
  Ausnahme von „faellt still weg": ein BEKANNTES Feld mit falschem Wert
  scheitert mit 422, und zwar der ganze Aufruf. Gefunden an einem echten Lauf,
  nicht am Schema — deshalb steht `scheduler` in keiner Familie mehr.
"""

import pytest

from backend.services.image_model_families import family_for
from backend.services.model_resolver import ResolvedImageModel

#: Abschrift der `Input.properties`-Schluessel, gemessen 05.09.2026.
SCHEMATA: dict[str, set[str]] = {
    "black-forest-labs/flux-2-pro": {
        "prompt", "aspect_ratio", "resolution", "input_images", "seed",
        "safety_tolerance", "output_format", "output_quality",
        "prompt_upsampling", "disable_safety_checker", "raw",
    },
    "black-forest-labs/flux-1.1-pro": {
        "prompt", "aspect_ratio", "width", "height", "image_prompt", "seed",
        "safety_tolerance", "output_format", "output_quality",
        "prompt_upsampling",
    },
    "black-forest-labs/flux-dev": {
        "prompt", "aspect_ratio", "image", "prompt_strength", "guidance",
        "megapixels", "num_inference_steps", "num_outputs", "seed",
        "output_format", "output_quality", "disable_safety_checker",
        "go_fast", "lora_scale", "lora_weights",
    },
    "aisha-ai-official/nsfw-flux-dev": {
        "prompt", "guidance_scale", "height", "seed", "steps", "width",
    },
    "charlesmccarthy/pony-sdxl": {
        "prompt", "negative_prompt", "cfg_scale", "steps", "width", "height",
        "batch_size", "guidance_rescale", "model", "prepend_preprompt", "seed",
        "vae", "scheduler",
    },
    # Gleiche Form, aber MIT Referenz — der Grund, warum die A1111-Familie
    # `image`/`strength` immer mitschickt.
    "delta-lock/ponynai3": {
        "prompt", "negative_prompt", "cfg_scale", "steps", "width", "height",
        "image", "strength", "mask", "blur_factor", "batch_size", "clip_skip",
        "guidance_rescale", "loras", "model", "pag_scale", "prepend_preprompt",
        "scheduler", "seed", "vae",
    },
    "aisha-ai-official/wai-nsfw-illustrious-v11": {
        "prompt", "negative_prompt", "cfg_scale", "steps", "width", "height",
        "batch_size", "clip_skip", "guidance_rescale", "model", "pag_scale",
        "prepend_preprompt", "scheduler", "seed", "vae",
    },
    "stability-ai/sdxl": {
        "prompt", "negative_prompt", "guidance_scale", "height", "width",
        "image", "mask", "prompt_strength", "num_inference_steps",
        "num_outputs", "scheduler", "seed", "apply_watermark",
        "disable_safety_checker", "high_noise_frac", "lora_scale", "refine",
        "refine_steps", "replicate_weights",
    },
    "stability-ai/stable-diffusion-3.5-large": {
        "prompt", "negative_prompt", "aspect_ratio", "cfg", "image",
        "output_format", "prompt_strength", "seed",
    },
    "asiryan/reliberate-v3": {
        "prompt", "negative_prompt", "guidance_scale", "height", "image",
        "mask", "num_inference_steps", "num_outputs", "scheduler", "seed",
        "strength", "width",
    },
    "asiryan/juggernaut-xl-v7": {
        "prompt", "negative_prompt", "guidance_scale", "height", "image",
        "lora_scale", "lora_weights", "mask", "num_inference_steps",
        "num_outputs", "scheduler", "seed", "strength", "width",
    },
    "datacte/proteus-v0.2": {
        "prompt", "negative_prompt", "apply_watermark",
        "disable_safety_checker", "guidance_scale", "height", "image", "mask",
        "num_inference_steps", "num_outputs", "prompt_strength", "scheduler",
        "seed", "width",
    },
}


#: Felder, die bewusst auch dorthin gehen, wo das Schema sie nicht fuehrt.
#:
#: Es sind genau die, bei denen das Weglassen teurer ist als das Streuen, und
#: die Rechnung dahinter ist gemessen, nicht geschaetzt: ein UNBEKANNTES Feld
#: nimmt Replicate widerspruchslos an (echter Lauf gegen
#: `charlesmccarthy/pony-sdxl` am 05.09.2026 mit `image` und `strength`, die
#: das Schema nicht kennt: `succeeded`). Ein fehlendes Referenzfeld dagegen
#: erzeugt ein Bild mit einem fremden Gesicht, ohne Fehler und ohne Spur.
#:
#: Die Streuung betrifft nur Faelle, in denen der Modellname die Schreibweise
#: nicht verraet: `strength` gegen `prompt_strength` innerhalb derselben
#: SDXL-Familie, und ob eine A1111-Huelle ueberhaupt eine Referenz nimmt
#: (`delta-lock/ponynai3` ja, `charlesmccarthy/pony-sdxl` nein — gleiche Form,
#: gleiche Marke).
#:
#: `scheduler` steht hier ausdruecklich NICHT: es ist der eine Fall, in dem ein
#: falscher Wert nicht still weggeht, sondern den Aufruf mit 422 beendet.
TOLERIERT = {"image", "strength", "prompt_strength", "disable_safety_checker"}


def _params(model: str) -> dict:
    aufgeloest = ResolvedImageModel(
        model=model,
        negative_prompt="blurry, two faces",
        width=768,
        height=1024,
        aspect_ratio="3:4",
        reference_image_url="https://example.invalid/marie.png",
    )
    p = aufgeloest.to_replicate_params()
    p[aufgeloest.prompt_param_name] = "eine Szene"
    return p


class TestKeinFremdesFeld:
    @pytest.mark.parametrize("model", sorted(SCHEMATA))
    def test_jedes_gesendete_feld_steht_im_schema(self, model: str):
        fremd = sorted(set(_params(model)) - SCHEMATA[model] - TOLERIERT)
        assert not fremd, f"{model} kennt {fremd} nicht — Replicate wirft sie still weg"

    @pytest.mark.parametrize("model", sorted(SCHEMATA))
    def test_kein_scheduler_geht_je_hinaus(self, model: str):
        # Der einzige Feldname, bei dem ein falscher Wert nicht still
        # verschwindet. Vier unvereinbare Vokabulare unter sieben gemessenen
        # Modellen, und `K_EULER` — die Plattformvorgabe — steht in zweien
        # davon nicht. Ein echter Lauf gegen `charlesmccarthy/pony-sdxl` endete
        # damit auf 422, also mit gar keinem Bild.
        assert "scheduler" not in _params(model)


class TestKeinVergessenesFeld:
    """Die Richtung, in der der echte Fehler lag."""

    @pytest.mark.parametrize("model", sorted(SCHEMATA))
    def test_die_groesse_wird_immer_gesetzt(self, model: str):
        # Ohne sie kommt das Bild im Vorgabeformat des Modells — quadratisch,
        # wo ein Hochformat bestellt war.
        p = _params(model)
        schema = SCHEMATA[model]
        moeglich = {"width", "height", "aspect_ratio", "resolution", "megapixels"} & schema
        assert moeglich & set(p), f"{model} kann {sorted(moeglich)}, bekommt aber keins davon"

    @pytest.mark.parametrize("model", sorted(SCHEMATA))
    def test_der_negativprompt_geht_hin_wo_er_hingeht(self, model: str):
        # Die lange Vorgabeliste („multiple people, two faces, extra limbs")
        # wirkt nur bei den SD-Abkoemmlingen. Wo das Schema sie fuehrt, muss
        # sie ankommen; wo nicht, darf sie nicht mitgeschickt werden.
        p = _params(model)
        assert ("negative_prompt" in p) == ("negative_prompt" in SCHEMATA[model])

    @pytest.mark.parametrize("model", sorted(SCHEMATA))
    def test_die_referenz_geht_hin_wo_sie_hingeht(self, model: str):
        # Eine nicht angekommene Referenz ist der teuerste der stillen Fehler:
        # das Bild zeigt eine andere Figur, und niemand sieht warum.
        p = _params(model)
        felder = {"image", "input_images", "image_prompt"} & SCHEMATA[model]
        assert bool(felder & set(p)) == bool(felder), f"{model}: Referenzfelder {sorted(felder)}"

    def test_die_staerke_kommt_unter_beiden_namen_an(self):
        # Innerhalb der SDXL-Familie heisst derselbe Regler bei `asiryan/*`
        # `strength` und bei `proteus`/`stability-ai/sdxl` `prompt_strength`,
        # und der Modellname verraet nicht welcher. Beide gehen raus: der
        # ueberzaehlige verschwindet folgenlos, der fehlende liesse die
        # Referenz mit dem Vorgabewert einfliessen statt mit dem gewaehlten.
        for m in ("datacte/proteus-v0.2", "asiryan/reliberate-v3"):
            p = _params(m)
            assert p.get("strength") == p.get("prompt_strength")
            assert p["strength"] is not None


class TestDieZuordnung:
    @pytest.mark.parametrize(
        ("model", "familie"),
        [
            ("black-forest-labs/flux-2-pro", "flux-2"),
            ("black-forest-labs/flux-1.1-pro", "flux-1-pro"),
            ("black-forest-labs/flux-dev", "flux-1"),
            ("bxclib2/flux_img2img", "flux-img2img"),
            ("aisha-ai-official/nsfw-flux-dev", "flux-wrapper"),
            ("charlesmccarthy/pony-sdxl", "a1111"),
            ("delta-lock/ponynai3", "a1111"),
            ("delta-lock/noobai-xl", "a1111"),
            ("aisha-ai-official/wai-nsfw-illustrious-v11", "a1111"),
            ("devgmstudios/pony-realism-v23", "a1111"),
            ("datacte/proteus-v0.2", "sdxl"),
            ("asiryan/reliberate-v3", "sdxl"),
            ("asiryan/juggernaut-xl-v7", "sdxl"),
            ("stability-ai/sdxl", "sdxl"),
            ("stability-ai/stable-diffusion", "sdxl"),
            ("stability-ai/stable-diffusion-3.5-large", "sd3"),
        ],
    )
    def test_jedes_modell_landet_in_seiner_familie(self, model: str, familie: str):
        assert family_for(model).name == familie

    def test_die_reihenfolge_ist_die_regel(self):
        # Drei Marken sind Teilzeichenketten anderer Namen. Steht die
        # allgemeinere vorn, faengt sie die speziellere ab — und der Fehler
        # ist unsichtbar, weil ein Bild trotzdem kommt.
        from backend.services.image_model_families import FAMILIES

        pos = {f.name: i for i, f in enumerate(FAMILIES)}
        assert pos["flux-2"] < pos["flux-1"], "`flux-2-pro` enthaelt `flux`"
        assert pos["flux-wrapper"] < pos["flux-1"], "`nsfw-flux-dev` enthaelt `flux`"
        assert pos["sd3"] < pos["sdxl"], "`stable-diffusion-3.5` enthaelt `stable-diffusion`"
        assert pos["a1111"] < pos["sdxl"], "`pony-realism` und `animagine-xl` klingen nach SDXL"

    def test_ein_unbekanntes_modell_verliert_nichts_wichtiges(self):
        # Die Unbekannt-Familie ist bewusst grosszuegig: ein zu viel
        # geschicktes Feld verwirft Replicate folgenlos, ein fehlendes
        # Referenzfeld erzeugt ein falsches Bild.
        p = _params("irgendwer/ein-neues-modell")
        assert {"width", "height", "negative_prompt", "image"} <= set(p)
