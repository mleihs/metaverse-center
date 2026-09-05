"""Welche Felder ein Bildmodell wirklich annimmt — und was Replicate verschweigt.

WARUM ES DIESE TABELLE GIBT

`ResolvedImageModel.to_replicate_params` unterschied bis zum 05.09.2026 nur
`is_flux` von „nicht Flux". Das war richtig, solange die Plattform `flux-dev`
fuhr, und ist es seit dem Wechsel auf `flux-2-pro` nicht mehr. Die drei
Familien nehmen verschiedene Felder — am 05.09.2026 direkt aus dem
OpenAPI-Schema von Replicate abgefragt:

    flux-dev        aspect_ratio, disable_safety_checker, go_fast, guidance,
                    image, megapixels, num_inference_steps, num_outputs,
                    output_format, output_quality, prompt, prompt_strength, seed
    flux-1.1-pro    aspect_ratio, height, image_prompt, output_format,
                    output_quality, prompt, prompt_upsampling, safety_tolerance,
                    seed, width
    flux-2-pro      aspect_ratio, height, input_images, output_format,
                    output_quality, prompt, resolution, safety_tolerance, seed,
                    width

REPLICATE LEHNT UNBEKANNTE FELDER NICHT AB. Gemessen am 05.09.2026 mit genau
den Parametern, die der alte Code sendete — `megapixels`, `guidance`,
`num_inference_steps` an `flux-2-pro`:

    status: succeeded, error: None

Sie standen in der Eingabe und haben nichts bewirkt. Das ist die unangenehmste
Form eines Fehlers: kein Fehlschlag, keine Warnung, nur eine Einstellung, die
seit dem Modellwechsel nichts mehr tut. Betroffen waren
`image_guidance_scale` und `image_num_inference_steps` — beide im Admin
einstellbar, beide wirkungslos, sobald ein Flux-2-Modell aufloest.

Und in die andere Richtung: `safety_tolerance` ging an `flux-dev`, das dieses
Feld nicht kennt, waehrend sein `disable_safety_checker` nie gesetzt wurde.

Diese Tabelle ist die einzige Stelle, an der steht, was welche Familie kann.
`backend/tests/unit/test_image_model_families.py` prueft sie gegen die
aufgeschriebenen Schemata; wer eine Familie ergaenzt, ergaenzt dort die Zeile.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

__all__ = [
    "FAMILIES",
    "ImageModelFamily",
    "family_for",
]

#: Wie eine Familie ihr Sicherheitsventil nennt.
#:
#: `tolerance` ist eine Zahl von 1 (streng) bis 6 (offen) und geht als
#: `safety_tolerance` mit; `checker` ist ein Schalter und geht als
#: `disable_safety_checker` mit; `none` heisst, dass das Modell keines hat und
#: die Filterung beim Anbieter liegt.
SafetyStyle = Literal["tolerance", "checker", "none"]

#: Wie eine Familie ein Referenzbild entgegennimmt.
#:
#: `list` ist der Fall, der die Figurenkonstanz erst moeglich macht: mehrere
#: Referenzen in EINEM Aufruf. `single` nimmt genau eine, `strength` zusaetzlich
#: einen Regler dafuer, wie stark sie wirkt. `none` kann keine.
ReferenceStyle = Literal["list", "single", "strength", "none"]


@dataclass(frozen=True, slots=True)
class ImageModelFamily:
    """Was ein Modell dieser Familie annimmt.

    Jedes Feld beantwortet genau eine Frage: „darf ich das senden?" Ein `False`
    heisst nicht „unwichtig", sondern „das Modell kennt es nicht, und Replicate
    wird es stillschweigend verwerfen".
    """

    name: str
    #: Erkennungsmarken im Modellnamen, laengste zuerst geprueft.
    markers: tuple[str, ...]
    supports_guidance: bool
    #: WIE die Familie die Schrittzahl nennt — leer heisst: sie kennt keine.
    #: Ein `bool` genuegte hier nicht: `flux-dev` sagt `num_inference_steps`,
    #: `bxclib2/flux_img2img` sagt `steps`. Gemessen am 05.09.2026 am echten
    #: Schema, nachdem vier bestehende Tests genau diesen Unterschied
    #: eingefordert haben.
    steps_field: str
    #: `megapixels` (Flux 1) gegen `resolution` (Flux 2) — dasselbe Anliegen,
    #: zwei Namen, und die falsche Wahl kostet still Geld oder Aufloesung.
    size_field: Literal["megapixels", "resolution", "width_height", "none"]
    supports_negative_prompt: bool
    reference: ReferenceStyle
    #: Wie viele Referenzbilder in einen Aufruf passen.
    max_references: int
    safety: SafetyStyle
    #: Der Feldname fuer das Referenzbild, falls es eines gibt.
    reference_field: str = ""
    #: Wie die Familie den Regler fuer die Staerke der Referenz nennt.
    strength_field: str = ""
    #: Ob `output_format` und `output_quality` angenommen werden. Die
    #: Gemeinschaftsmodelle kennen sie oft nicht.
    supports_output_fields: bool = True
    #: Ob `aspect_ratio` angenommen wird.
    supports_aspect_ratio: bool = True


_FLUX2 = ImageModelFamily(
    name="flux-2",
    # `flux-2` deckt `flux-2-pro`, `flux-2-flex`, `flux-2-dev`. Die Marke steht
    # VOR `flux` in der Suchreihenfolge, sonst faengt die allgemeinere sie ab —
    # derselbe Reihenfolgefehler, der in `_CONTEXT_WINDOWS` schon einmal die
    # Fenstergroesse eines Modells auf ein Achtel gesetzt hat.
    markers=("flux-2", "flux.2"),
    supports_guidance=False,
    steps_field="",
    size_field="resolution",
    supports_negative_prompt=False,
    reference="list",
    # Das Schema sagt „Maximum 8 images", die Modellkarte nennt zusaetzlich eine
    # Obergrenze von 9 Megapixeln ueber ALLE Eingaben zusammen. Die Zahl hier
    # ist die harte, die Megapixelgrenze prueft der Aufrufer.
    max_references=8,
    safety="tolerance",
    reference_field="input_images",
)

_FLUX1_PRO = ImageModelFamily(
    name="flux-1-pro",
    markers=("flux-1.1-pro", "flux-1.1", "flux-pro"),
    supports_guidance=False,
    steps_field="",
    size_field="width_height",
    supports_negative_prompt=False,
    reference="single",
    max_references=1,
    safety="tolerance",
    reference_field="image_prompt",
)

_FLUX1 = ImageModelFamily(
    name="flux-1",
    markers=("flux-dev", "flux-schnell", "flux"),
    supports_guidance=True,
    steps_field="num_inference_steps",
    size_field="megapixels",
    supports_negative_prompt=False,
    reference="strength",
    max_references=1,
    safety="checker",
    reference_field="image",
    strength_field="prompt_strength",
)

_FLUX_IMG2IMG = ImageModelFamily(
    name="flux-img2img",
    # Ein Gemeinschaftsmodell mit eigenem Vokabular. Sein Schema, am 05.09.2026
    # abgefragt, ist vollstaendig:
    #     denoising, image, positive_prompt, sampler_name, scheduler, seed, steps
    # Kein `guidance`, kein `num_inference_steps`, kein `output_format`, kein
    # `aspect_ratio`, kein `megapixels`. Es in die Flux-1-Familie zu stecken war
    # mein Fehler; vier bestehende Tests haben ihn sofort gemeldet.
    markers=("flux_img2img",),
    supports_guidance=False,
    steps_field="steps",
    size_field="none",
    supports_negative_prompt=False,
    reference="strength",
    max_references=1,
    safety="none",
    reference_field="image",
    strength_field="denoising",
    supports_output_fields=False,
    supports_aspect_ratio=False,
)

_SDXL = ImageModelFamily(
    name="sdxl",
    # Die Sammelfamilie fuer alles auf SDXL-Grundlage: Stable Diffusion selbst
    # und die Abkoemmlinge, die fuer Erwachseneninhalte gefahren werden.
    markers=("stable-diffusion", "sdxl", "pony", "illustrious", "noobai"),
    supports_guidance=True,
    steps_field="num_inference_steps",
    size_field="width_height",
    # Der eine echte Vorteil dieser Familie gegenueber Flux: sie kennt einen
    # negativen Prompt. Die lange Liste in `PLATFORM_DEFAULT_PARAMS`
    # („multiple people, two faces, extra limbs") wirkt nur hier.
    supports_negative_prompt=True,
    reference="strength",
    max_references=1,
    safety="checker",
    reference_field="image",
    strength_field="prompt_strength",
)

#: Reihenfolge ist Bedeutung: die erste passende Familie gewinnt, und die
#: spezifischere muss vorn stehen. `flux-2-pro` enthaelt `flux`; stuende
#: `_FLUX1` zuerst, bekaeme jedes Flux-2-Modell die Parameter von Flux 1 —
#: also genau der Fehler, den diese Datei behebt.
FAMILIES: tuple[ImageModelFamily, ...] = (_FLUX2, _FLUX1_PRO, _FLUX_IMG2IMG, _FLUX1, _SDXL)

#: Was ein unbekanntes Modell bekommt: die verbreiteten Namen, nicht nichts.
#:
#: Der erste Entwurf schickte hier gar keine Referenzfelder — „vorsichtig statt
#: grosszuegig". Zwei bestehende Tests haben gezeigt, dass das die falsche
#: Vorsicht ist. Eine Simulation darf `image_ref_model` auf ein beliebiges
#: Modell stellen; wird die Referenz dann nicht gesendet, kommt trotzdem ein
#: Bild — nur eben ohne die Vorlage, ohne Fehlermeldung und ohne dass jemand es
#: an den Parametern sehen koennte.
#:
#: Die Abwaegung geht deshalb andersherum als beim Rest dieser Tabelle: ein zu
#: viel gesendetes Feld verwirft Replicate stumm und folgenlos, ein fehlendes
#: Referenzfeld erzeugt ein falsches Bild. `image` + `prompt_strength` ist die
#: Schreibweise, die die meisten img2img-Modelle teilen.
_UNKNOWN = ImageModelFamily(
    name="unbekannt",
    markers=(),
    supports_guidance=False,
    steps_field="num_inference_steps",
    size_field="none",
    supports_negative_prompt=False,
    reference="strength",
    max_references=1,
    safety="none",
    reference_field="image",
    strength_field="prompt_strength",
)


def family_for(model_id: str) -> ImageModelFamily:
    """Die Familie eines Modellnamens. Nie ``None`` — im Zweifel die sparsame."""
    needle = model_id.lower()
    for family in FAMILIES:
        if any(marker in needle for marker in family.markers):
            return family
    return _UNKNOWN
