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
    #: WIE die Familie die Fuehrung nennt — leer heisst: sie kennt keine.
    #: Drei Schreibweisen sind gemessen: `guidance` (Flux 1), `guidance_scale`
    #: (fast alle SDXL-Ableger), `cfg_scale` (charlesmccarthy/pony-sdxl). Ein
    #: `bool` genuegte nicht — und der erste Entwurf dieser Datei hatte genau
    #: hier eine Regression: er schickte allen SDXL-Modellen `guidance`, wo der
    #: alte Code `guidance_scale` schickte.
    guidance_field: str
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
    #: Wie die Familie den Regler fuer die Staerke der Referenz nennt — als
    #: TUPEL, weil innerhalb der SDXL-Familie beide Schreibweisen vorkommen und
    #: der Modellname sie nicht verraet: `asiryan/*` sagt `strength`,
    #: `stability-ai/sdxl` und `datacte/proteus-v0.2` sagen `prompt_strength`.
    #: Wo beide dastehen, gehen beide raus. Das ist keine Schlamperei, sondern
    #: die gemessene Kostenverteilung: ein unbekanntes Feld verwirft Replicate
    #: still und folgenlos, ein FEHLENDES laesst die Referenz mit dem
    #: Vorgabewert einfliessen statt mit dem gewaehlten — ein Bild, das
    #: plausibel aussieht und den Regler ignoriert.
    strength_fields: tuple[str, ...] = ()
    #: Ob `output_format` und `output_quality` angenommen werden. Die
    #: Gemeinschaftsmodelle kennen sie oft nicht.
    supports_output_fields: bool = True
    #: Ob `aspect_ratio` angenommen wird.
    supports_aspect_ratio: bool = True
    #: Welche Seitenverhaeltnisse die Familie WIRKLICH fuehrt.
    #:
    #: Leer heisst: nicht geprueft, unser Wert geht so raus. Steht etwas da,
    #: wird der eigene Wert nur gesendet, wenn er darin vorkommt — sonst das
    #: naechstliegende Verhaeltnis aus der Liste.
    #:
    #: Der Anlass ist `stability-ai/stable-diffusion-3.5-large`: sein Enum
    #: fuehrt `2:3` und `4:5`, aber KEIN `3:4` — und `3:4` ist unser
    #: Vorgabewert fuer Portraets. Das ist wieder die laute Sorte Fehler
    #: (bekanntes Feld, unzulaessiger Enum-Wert, 422 auf den ganzen Aufruf),
    #: also genau der Fall, den ein Schemavergleich ueber FELDNAMEN nicht
    #: sieht.
    #:
    #: Naechstliegend und nicht weglassen: dieses Modell kennt weder Breite
    #: noch Hoehe, ein fehlendes `aspect_ratio` gaebe also ein Quadrat, wo ein
    #: Hochformat bestellt war. 3:4 ist 0,75; aus seiner Liste liegt 4:5 (0,8)
    #: naeher als 2:3 (0,667).
    aspect_ratio_choices: tuple[str, ...] = ()
    #: KEIN Scheduler-Feld — und das ist die einzige gemessene Antwort.
    #:
    #: Der alte Code schickte `image_scheduler` aus `PLATFORM_DEFAULT_PARAMS`
    #: (`K_EULER`) an jedes SD-Modell. Am 05.09.2026 an sieben Modellen
    #: gemessen: es gibt VIER unvereinbare Vokabulare.
    #:
    #:   * `stability-ai/*`, `juggernaut-xl-v7`, `proteus-v0.2`: die klassischen
    #:     sieben (`K_EULER`, `KarrasDPM`, `DPMSolverMultistep`, …)
    #:   * `asiryan/reliberate-v3`: 26 Namen im Klartext (`Euler A Karras`) —
    #:     `K_EULER` steht NICHT darunter
    #:   * die A1111-Huellen: 21 andere Klartextnamen (`DPM++ 2M SDE Karras`)
    #:   * die Flux-Familie: gar keiner
    #:
    #: Und ein falscher Wert faellt hier NICHT still weg, wie ein unbekanntes
    #: Feld es taete: `scheduler` ist ein bekanntes Feld mit einem Enum, also
    #: scheitert der ganze Aufruf mit 422. Gefunden an einem echten Lauf gegen
    #: `charlesmccarthy/pony-sdxl`, nicht am Schema.
    #:
    #: Eine einzelne Plattformvorgabe kann ueber vier Vokabulare nicht richtig
    #: sein, und fuer ein Modell, das erst morgen eingetragen wird, gibt es
    #: keine Vermutung, die haelt. Jedes Modell bringt einen brauchbaren
    #: eigenen Vorgabewert mit. Also schicken wir keinen — das kostet auf
    #: `stability-ai/*` den Unterschied zwischen `K_EULER` und
    #: `DPMSolverMultistep` und erspart drei Familien einen harten Fehler.


_FLUX2 = ImageModelFamily(
    name="flux-2",
    # `flux-2` deckt `flux-2-pro`, `flux-2-flex`, `flux-2-dev`. Die Marke steht
    # VOR `flux` in der Suchreihenfolge, sonst faengt die allgemeinere sie ab —
    # derselbe Reihenfolgefehler, der in `_CONTEXT_WINDOWS` schon einmal die
    # Fenstergroesse eines Modells auf ein Achtel gesetzt hat.
    markers=("flux-2", "flux.2"),
    aspect_ratio_choices=(
        "match_input_image", "custom", "1:1", "16:9", "3:2", "2:3", "4:5",
        "5:4", "9:16", "3:4", "4:3",
    ),
    guidance_field="",
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
    aspect_ratio_choices=(
        "custom", "1:1", "16:9", "3:2", "2:3", "4:5", "5:4", "9:16", "3:4",
        "4:3",
    ),
    guidance_field="",
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
    aspect_ratio_choices=(
        "1:1", "16:9", "21:9", "3:2", "2:3", "4:5", "5:4", "3:4", "4:3",
        "9:16", "9:21",
    ),
    guidance_field="guidance",
    steps_field="num_inference_steps",
    size_field="megapixels",
    supports_negative_prompt=False,
    reference="strength",
    max_references=1,
    safety="checker",
    reference_field="image",
    strength_fields=("prompt_strength",),
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
    guidance_field="",
    steps_field="steps",
    size_field="none",
    supports_negative_prompt=False,
    reference="strength",
    max_references=1,
    safety="none",
    reference_field="image",
    strength_fields=("denoising",),
    supports_output_fields=False,
    supports_aspect_ratio=False,
)

_FLUX_WRAPPER = ImageModelFamily(
    name="flux-wrapper",
    # Ein Flux-Ableger mit SDXL-Vokabular. `aisha-ai-official/nsfw-flux-dev`,
    # gemessen am 05.09.2026, fuehrt VOLLSTAENDIG:
    #     guidance_scale, height, prompt, seed, steps, width
    # Kein `guidance`, kein `num_inference_steps`, kein `megapixels`, kein
    # `aspect_ratio`, kein `negative_prompt`, kein Referenzbild.
    #
    # Es steht VOR `_FLUX1`, sonst faengt dessen `flux`-Marke es ab — und dann
    # bekaeme es `guidance` und `megapixels`, die es nicht kennt. Genau der
    # Reihenfolgefehler, gegen den der Kommentar bei `_FLUX2` warnt.
    markers=("nsfw-flux", "flux-nsfw"),
    guidance_field="guidance_scale",
    steps_field="steps",
    size_field="width_height",
    supports_negative_prompt=False,
    reference="none",
    max_references=0,
    safety="none",
    supports_output_fields=False,
    supports_aspect_ratio=False,
)

_A1111 = ImageModelFamily(
    name="a1111",
    # Die Huellen um eine A1111-/ComfyUI-Pipeline. Sie sind an einem eigenen
    # Vokabular zu erkennen — `cfg_scale` und `steps` statt `guidance_scale`
    # und `num_inference_steps`, dazu `prepend_preprompt`, `clip_skip`,
    # `guidance_rescale`, `vae`, `model` — und diese Form teilen sie ALLE,
    # gemessen am 05.09.2026 an acht Modellen von vier Anbietern:
    #     charlesmccarthy/pony-sdxl, delta-lock/ponynai3, delta-lock/noobai-xl,
    #     devgmstudios/pony-realism-v23, aisha-ai-official/{wai-nsfw-
    #     illustrious-v11, anillustrious-v4, animagine-xl-v4-opt,
    #     pony-realism-v2.2}
    #
    # Vorher lagen sie in `_SDXL`, weil ihre Namen nach SDXL klingen — und
    # bekamen `guidance_scale` und `num_inference_steps`, die keines von ihnen
    # kennt. Beide fielen still weg: jedes Bild lief mit der Vorgabe-Fuehrung
    # und der Vorgabe-Schrittzahl, ohne Fehler, ohne Spur. Genau der Fehler,
    # gegen den diese Datei geschrieben ist, einmal in ihr selbst.
    markers=(
        "pony", "noobai", "illustrious", "animagine",
        "aisha-ai-official/", "delta-lock/",
    ),
    guidance_field="cfg_scale",
    steps_field="steps",
    size_field="width_height",
    supports_negative_prompt=True,
    # Die Haelfte dieser Modelle fuehrt `image` + `strength`, die andere nicht
    # — und der Name sagt nicht, welche. Also gehen beide Felder immer raus:
    # wo sie fehlen, verwirft Replicate sie folgenlos; wo sie da sind, ist eine
    # nicht gesendete Referenz ein Bild mit fremdem Gesicht.
    reference="strength",
    max_references=1,
    safety="none",
    reference_field="image",
    strength_fields=("strength",),
    supports_output_fields=False,
    supports_aspect_ratio=False,
)


_SD3 = ImageModelFamily(
    name="sd3",
    # `stability-ai/stable-diffusion-3.5-large`, gemessen 05.09.2026.
    # VOLLSTAENDIG: aspect_ratio, cfg, image, negative_prompt, output_format,
    # prompt, prompt_strength, seed.
    # Weder `guidance_scale` noch Schrittzahl, weder Breite noch Hoehe, kein
    # Scheduler — die Marke `stable-diffusion` in `_SDXL` haette ihm sechs
    # Felder geschickt, von denen KEINES ankommt. Steht deshalb davor.
    markers=("stable-diffusion-3", "sd3", "sd-3"),
    # Gemessen 05.09.2026. `3:4` und `4:3` fehlen — als einziges der
    # gemessenen Modelle.
    aspect_ratio_choices=(
        "16:9", "1:1", "21:9", "2:3", "3:2", "4:5", "5:4", "9:16", "9:21",
    ),
    guidance_field="cfg",
    steps_field="",
    size_field="",
    supports_negative_prompt=True,
    reference="strength",
    max_references=1,
    safety="none",
    reference_field="image",
    strength_fields=("prompt_strength",),
    supports_output_fields=False,
    supports_aspect_ratio=True,
)

_SDXL = ImageModelFamily(
    name="sdxl",
    # Die Sammelfamilie fuer alles auf SDXL-Grundlage: Stable Diffusion selbst
    # und die Abkoemmlinge, die fuer Erwachseneninhalte gefahren werden.
    # Die Sammelfamilie. Die Marken sind breit, weil die Namen es sind:
    # `asiryan/juggernaut-xl-v7`, `datacte/proteus-v0.2`,
    # `asiryan/reliberate-v3` — alle mit demselben Feldsatz, keiner mit „sdxl"
    # im Namen. Der erste Entwurf hatte nur `sdxl` und liess sie deshalb in die
    # sparsame Unbekannt-Familie fallen: ohne Breite, Hoehe, Fuehrung,
    # Negativprompt und Scheduler, also ohne fuenf Felder, die der ALTE Code
    # richtig geschickt hatte.
    markers=(
        "stable-diffusion", "sdxl", "-xl-", "xl-v", "juggernaut", "proteus",
        "reliberate", "realistic-vision", "dreamshaper", "realvis", "babes",
        "epicrealism", "turbo-enigma",
    ),
    guidance_field="guidance_scale",
    steps_field="num_inference_steps",
    size_field="width_height",
    # Der eine echte Vorteil dieser Familie gegenueber Flux: sie kennt einen
    # negativen Prompt. Die lange Liste in `PLATFORM_DEFAULT_PARAMS`
    # („multiple people, two faces, extra limbs") wirkt nur hier.
    supports_negative_prompt=True,
    reference="strength",
    max_references=1,
    # `datacte/proteus-v0.2` und `stability-ai/sdxl` fuehren einen
    # abschaltbaren Sicherheitspruefer, `asiryan/reliberate-v3` und
    # `asiryan/juggernaut-xl-v7` haben gar keinen. Der Schalter geht deshalb
    # immer raus: wo es keinen gibt, faellt er folgenlos weg; wo es einen gibt
    # und er fehlt, kaeme aus der Erwachsenenspur ein weichgezeichnetes Bild.
    safety="checker",
    reference_field="image",
    strength_fields=("strength", "prompt_strength"),
    # Keine `output_format`/`output_quality`: keines der drei gemessenen
    # Schemata kennt sie. Das Format entscheidet ohnehin unser Upload.
    supports_output_fields=False,
    supports_aspect_ratio=False,
)


#: Reihenfolge ist Bedeutung: die erste passende Familie gewinnt, und die
#: spezifischere muss vorn stehen. `flux-2-pro` enthaelt `flux`; stuende
#: `_FLUX1` zuerst, bekaeme jedes Flux-2-Modell die Parameter von Flux 1 —
#: also genau der Fehler, den diese Datei behebt.
FAMILIES: tuple[ImageModelFamily, ...] = (
    _FLUX2,
    _FLUX1_PRO,
    _FLUX_IMG2IMG,
    _FLUX_WRAPPER,
    _FLUX1,
    _A1111,
    _SD3,
    _SDXL,
)

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
    # Der VERBREITETE Satz, nicht der sparsame — und das ist eine Korrektur.
    # Der erste Entwurf schickte hier fast nichts, „vorsichtig statt
    # grosszuegig". Gemessen an fuenf echten Fremdmodellen war das falsch: alle
    # fuenf fuehren `width`, `height`, `negative_prompt` und `scheduler`, und
    # der Code VOR dieser Datei schickte sie auch. Ein zu viel gesendetes Feld
    # verwirft Replicate stumm; ein fehlendes kostet Aufloesung, Bildformat und
    # den Negativprompt.
    guidance_field="guidance_scale",
    steps_field="num_inference_steps",
    size_field="width_height",
    supports_negative_prompt=True,
    reference="strength",
    max_references=1,
    safety="none",
    reference_field="image",
    # `prompt_strength`, nicht `strength` — und das ist keine Muenze, die auf
    # der Kante steht. Gemessen ist es 2:2 (`asiryan/*` sagt `strength`,
    # `proteus` und `flux-dev` sagen `prompt_strength`), aber der Code VOR
    # dieser Tabelle schickte hier `prompt_strength`, und ein bestehender Test
    # pinnt es. Fuer ein Modell, ueber das wir nichts wissen, ist die bisherige
    # Schreibweise die bessere Vermutung als eine neue.
    strength_fields=("prompt_strength",),
    # Weder `output_format` noch `aspect_ratio`: von den fuenf gemessenen
    # Fremdmodellen fuehrt KEINES eines davon, alle fuenf aber `width`/`height`.
    # `aspect_ratio` waere ausserdem nicht bloss ueberfluessig, sondern
    # widerspruechlich — es steht neben einer Breite und einer Hoehe.
    supports_output_fields=False,
    supports_aspect_ratio=False,
)


def family_for(model_id: str) -> ImageModelFamily:
    """Die Familie eines Modellnamens. Nie ``None`` — im Zweifel die sparsame."""
    needle = model_id.lower()
    for family in FAMILIES:
        if any(marker in needle for marker in family.markers):
            return family
    return _UNKNOWN
