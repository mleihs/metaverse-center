"""Tests for the WCAG contrast floor on generated themes.

The case that motivated this file is real and shipped: one production world had
`color_text` and `color_surface_header` set to the same `#1a1a2e`. Its header
rendered navy on navy — ratio 1.00 — in every one of the 37 places the token is
used, and looked like a header that was designed empty.
"""

from __future__ import annotations

import pytest

from backend.services.theme_contrast import (
    AA_NORMAL_TEXT,
    ThemeContrastReport,
    contrast_ratio,
    enforce_theme_contrast,
    parse_hex,
    relative_luminance,
)

# The palette as it actually stood in production on 2026-08-30.
ATRAMENT = {
    "color_text": "#1a1a2e",
    "color_background": "#f5f0e8",
    "color_surface": "#ffffff",
    "color_surface_header": "#1a1a2e",
    "color_surface_sunken": "#f0ebe0",
    "color_text_secondary": "#4a4a5e",
    "color_text_muted": "#8a8a9e",
}


class TestColourMaths:
    """The primitives, against values with known answers."""

    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            ("#ffffff", (255, 255, 255)),
            ("#000", (0, 0, 0)),
            ("1a1a2e", (26, 26, 46)),
            ("  #F5F0E8  ", (245, 240, 232)),
        ],
    )
    def test_parse_hex_accepts_the_shapes_themes_use(self, value: str, expected: tuple[int, int, int]):
        assert parse_hex(value) == expected

    @pytest.mark.parametrize("value", ["", "#12", "#1234567", "rgb(0,0,0)", "transparent", None, 42])
    def test_parse_hex_rejects_everything_else(self, value):
        assert parse_hex(value) is None

    def test_luminance_endpoints(self):
        assert relative_luminance((0, 0, 0)) == 0
        assert relative_luminance((255, 255, 255)) == pytest.approx(1.0)

    def test_black_on_white_is_the_maximum_ratio(self):
        assert contrast_ratio("#000000", "#ffffff") == pytest.approx(21.0)

    def test_a_colour_against_itself_is_one(self):
        assert contrast_ratio("#1a1a2e", "#1a1a2e") == pytest.approx(1.0)

    def test_ratio_is_symmetric(self):
        assert contrast_ratio("#1a1a2e", "#f5f0e8") == contrast_ratio("#f5f0e8", "#1a1a2e")

    def test_a_non_hex_value_cannot_be_judged(self):
        """Abstaining beats guessing: a theme may carry a gradient or keyword."""
        assert contrast_ratio("#000000", "linear-gradient(red, blue)") is None


class TestTheFloor:
    def test_the_production_failure_is_repaired(self):
        repaired, report = enforce_theme_contrast(ATRAMENT)
        assert repaired["color_surface_header"] == "#f5f0e8"
        assert [r.key for r in report.repairs] == ["color_surface_header"]
        assert report.repairs[0].ratio_before == pytest.approx(1.0)
        assert contrast_ratio(repaired["color_text"], repaired["color_surface_header"]) > AA_NORMAL_TEXT

    def test_the_input_is_not_mutated(self):
        before = dict(ATRAMENT)
        enforce_theme_contrast(ATRAMENT)
        assert ATRAMENT == before

    def test_a_sound_theme_is_left_alone(self):
        """36 of 37 production themes were already sound. None may be touched."""
        sound = {
            "color_text": "#e8ede9",
            "color_background": "#0d1d30",
            "color_surface": "#0d1d30",
            "color_surface_header": "#0d1d30",
            "color_surface_sunken": "#0a1626",
        }
        repaired, report = enforce_theme_contrast(sound)
        assert repaired == sound
        assert report.is_clean

    def test_the_text_colour_is_never_rewritten(self):
        repaired, _ = enforce_theme_contrast(ATRAMENT)
        assert repaired["color_text"] == ATRAMENT["color_text"]

    def test_muted_text_is_reported_but_not_changed(self):
        """Below-AA muted text is a design decision in several shipped themes."""
        repaired, report = enforce_theme_contrast(ATRAMENT)
        assert repaired["color_text_muted"] == ATRAMENT["color_text_muted"]
        assert any(key == "color_text_muted" for key, _ in report.advisories)

    def test_an_unusable_background_makes_the_failure_unrepairable(self):
        """With nothing safe to fall back to, say so rather than invent a colour."""
        broken = {
            "color_text": "#333333",
            "color_background": "#3a3a3a",
            "color_surface": "#3a3a3a",
            "color_surface_header": "#333333",
            "color_surface_sunken": "#333333",
        }
        repaired, report = enforce_theme_contrast(broken)
        assert not report.repairs
        assert {key for key, _ in report.unrepairable} >= {"color_surface_header", "color_surface_sunken"}
        assert repaired["color_surface_header"] == "#333333"

    def test_a_theme_without_a_text_colour_is_returned_untouched(self):
        theme = {"color_surface_header": "#123456"}
        repaired, report = enforce_theme_contrast(theme)
        assert repaired == theme
        assert report == ThemeContrastReport()

    def test_a_non_hex_surface_is_not_judged(self):
        theme = {"color_text": "#000000", "color_background": "#ffffff", "color_surface_header": "inherit"}
        repaired, report = enforce_theme_contrast(theme)
        assert repaired["color_surface_header"] == "inherit"
        assert report.is_clean

    def test_the_report_serialises_for_logging(self):
        _, report = enforce_theme_contrast(ATRAMENT)
        context = report.as_context()
        assert context["repairs"][0]["key"] == "color_surface_header"
        assert context["repairs"][0]["ratio_before"] == 1.0
