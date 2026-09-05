"""The lore-informed refinement covers all four image style prompts.

The Darkroom writes four style prompts in phase III, from the seed, the anchor
and the entities — everything that exists at that point. Lore does not, so those
prompts are necessarily generic. Phase A.5 rewrites them once the lore is
there, before any image is rendered.

Three of the four were rewritten. The banner was not, and the omission was
invisible in every way that matters: no error, no warning, and a perfectly
plausible banner. It just kept the pre-lore style while the portraits and plates
around it had been rewritten to match the world — on the one image a visitor
sees first.

These tests pin the parser, because that is where a prompt silently falls out.
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from backend.services.forge_theme_service import ForgeThemeService

ALL_FOUR = {
    "image_style_prompt_portrait",
    "image_style_prompt_building",
    "image_style_prompt_lore",
    "image_style_prompt_banner",
}


def _existing_styles() -> list[dict]:
    return [
        {"setting_key": key, "setting_value": "generic photography"} for key in sorted(ALL_FOUR)
    ]


async def _refine(model_output: str) -> dict[str, str]:
    """Run the refinement against a stubbed AI reply; return what it would save."""
    saved: dict[str, str] = {}

    class _Table:
        def __init__(self, name: str) -> None:
            self._name = name
            self._rows: list[dict] | None = None

        def select(self, *_a, **_k):
            return self

        def eq(self, *_a, **_k):
            return self

        def order(self, *_a, **_k):
            return self

        def limit(self, *_a, **_k):
            return self

        def single(self):
            return self

        def upsert(self, rows, **_k):
            self._rows = rows
            return self

        async def execute(self):
            if self._rows is not None:
                for row in self._rows:
                    saved[row["setting_key"]] = row["setting_value"]
                return type("R", (), {"data": self._rows})()
            if self._name == "simulations":
                return type("R", (), {"data": {"name": "Voidhaven", "description": "A city."}})()
            if self._name == "simulation_lore":
                return type(
                    "R",
                    (),
                    {"data": [{"title": "The Registry", "epigraph": "", "body": "Ledgers."}]},
                )()
            return type("R", (), {"data": _existing_styles()})()

    supabase = type("S", (), {"table": lambda _self, name: _Table(name)})()

    with (
        # W4: the service builds its agent through `create_forge_agent` now, so
        # the `style_refine` row in `ai_purposes.AI_PURPOSES` supplies the model
        # AND the budget/timeout this call used to run without.
        patch("backend.services.forge_theme_service.create_forge_agent"),
        patch("backend.services.forge_theme_service.get_admin_supabase", AsyncMock()),
        patch(
            "backend.services.forge_theme_service.run_ai",
            AsyncMock(return_value=type("Out", (), {"output": model_output})()),
        ),
    ):
        await ForgeThemeService.refine_style_prompts(supabase, uuid4(), "key")

    return saved


@pytest.mark.asyncio
async def test_all_four_prompts_are_refined():
    saved = await _refine(
        "PORTRAIT: wet collodion plate, guttering lamplight\n"
        "BUILDING: rain-blacked stone, low winter sun\n"
        "LORE: etching on damp paper, ink bleed\n"
        "BANNER: wide matte painting, the city seen whole at dusk"
    )

    assert set(saved) == ALL_FOUR
    assert saved["image_style_prompt_banner"].startswith("wide matte painting")


@pytest.mark.asyncio
async def test_the_banner_is_not_dropped_when_it_comes_last():
    """It is the final line, which is where a trailing-newline parser loses it."""
    saved = await _refine(
        "PORTRAIT: wet collodion plate, guttering lamplight\n"
        "BUILDING: rain-blacked stone, low winter sun\n"
        "LORE: etching on damp paper, ink bleed\n"
        "BANNER: the estuary under low cloud, seen whole\n"
    )

    assert saved["image_style_prompt_banner"] == "the estuary under low cloud, seen whole"


@pytest.mark.asyncio
async def test_a_partial_reply_saves_what_it_got():
    """A model that answers three of four must not lose the three."""
    saved = await _refine(
        "PORTRAIT: wet collodion plate, guttering lamplight\n"
        "BUILDING: rain-blacked stone, low winter sun\n"
        "LORE: etching on damp paper, ink bleed"
    )

    assert set(saved) == ALL_FOUR - {"image_style_prompt_banner"}


@pytest.mark.asyncio
async def test_a_stub_of_a_prompt_is_refused():
    """A one-word answer is not a style; the generic prompt is the better keep.

    The service rejects anything at or under 20 characters. Worth pinning: it is
    the reason a plausible-looking reply can still save nothing at all.
    """
    saved = await _refine("PORTRAIT: dark\nBUILDING: grey\nLORE: ink\nBANNER: wide")

    assert saved == {}


@pytest.mark.asyncio
async def test_an_unparseable_reply_writes_nothing():
    """Better the generic prompts than a row of empty strings."""
    saved = await _refine("I have rewritten your prompts as requested.")

    assert saved == {}


class TestJedeBildspurHatEinenStil:
    """Die Stilprompts muessen an DREI Stellen gleichzeitig stehen.

    Am 05.09.2026 stand `image_style_prompt_scene` an keiner davon, waehrend
    die Szenenspur laengst Bilder erzeugte. Gemessen auf Produktion:

        scene      0 Zeichen
        portrait   538 Zeichen
        lore       499
        banner     489
        building   629

    Eine Migration hat es fuer die 41 bestehenden Welten nachgetragen — aber
    eine NEUE Welt bekommt ihre Stilprompts von `ForgeThemeService`, und der
    kannte nur vier. Ohne diesen Test faellt die naechste Spur genauso durch:
    das Fehlen eines Stilprompts ist kein Fehler, sondern eine leere
    Zeichenkette, die niemand sieht.
    """

    #: Die Spuren, die einen eigenen Stil fuehren. Waechst diese Menge, muss
    #: sie an allen drei Stellen wachsen — genau das prueft diese Klasse.
    SPUREN = {"portrait", "building", "banner", "lore", "scene"}

    def test_das_modell_fuehrt_jede_spur(self):
        from backend.models.forge import ForgeThemeOutput

        felder = {f[len("image_style_prompt_") :] for f in ForgeThemeOutput.model_fields if f.startswith("image_style_prompt_")}
        assert felder == self.SPUREN

    def test_der_dienst_legt_jede_spur_unter_ai_ab(self):
        # `ai_keys` entscheidet, ob ein Schluessel in `category='ai'` landet.
        # Ein Stilprompt unter `design` wuerde vom Aufloeser nie gefunden.
        import inspect

        from backend.services.forge_theme_service import ForgeThemeService

        quelle = inspect.getsource(ForgeThemeService)
        for spur in self.SPUREN:
            assert f'"image_style_prompt_{spur}"' in quelle, f"{spur} fehlt in forge_theme_service"

    def test_die_verfeinerung_liest_jede_spur_zurueck(self):
        # Der Parser der A.6-Verfeinerung erkennt Zeilen an ihrem Praefix.
        # Fehlt eines, wird diese Spur bei jeder Verfeinerung stillschweigend
        # auf ihren alten Wert zurueckgelassen.
        import inspect

        from backend.services.forge_theme_service import ForgeThemeService

        quelle = inspect.getsource(ForgeThemeService)
        for spur in self.SPUREN:
            assert f'startswith("{spur.upper()}:")' in quelle, f"{spur.upper()}: fehlt im Parser"

    def test_die_szene_ist_ausdruecklich_kuerzer_verlangt(self):
        # Der Szenenstil faehrt als einziger auf einem 77-Token-Fenster (CLIP).
        # Ein Stilprompt in der Laenge der anderen (489-629 Zeichen) fraesse
        # das ganze Fenster, und die Bildbeschreibung — also das Bild — bliebe
        # draussen. Die Anweisung an das Modell muss das sagen.
        import inspect

        from backend.services import forge_theme_service

        quelle = inspect.getsource(forge_theme_service)
        assert "12 WORDS" in quelle or "12 words" in quelle, (
            "die Laengengrenze fuer den Szenenstil steht nicht im Erzeugungsprompt"
        )
