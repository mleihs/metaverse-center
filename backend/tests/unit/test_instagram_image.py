"""Unit tests for Instagram image composition pipeline.

Covers:
1. Pure helper functions (_hex_to_rgb, _wrap_text, _image_to_jpeg)
2. Visual primitives (_create_gradient, _create_vignette, _add_noise_grain)
3. Story template smoke tests (detection, classification, impact, advisory, subsiding)
4. Feed post _compose_with_overlay smoke test
5. Font loading and caching
"""

from __future__ import annotations

import io
from unittest.mock import MagicMock

import pytest
from PIL import Image

from backend.services.instagram_image_service import (
    IG_HEIGHT_PORTRAIT,
    IG_HEIGHT_STORY,
    IG_WIDTH,
    InstagramImageService,
    _load_bold_font,
    _load_italic_font,
    _load_monospace_font,
)

JPEG_MAGIC = b"\xff\xd8\xff"

ALL_ARCHETYPES = (
    "The Tower",
    "The Shadow",
    "The Devouring Mother",
    "The Deluge",
    "The Overthrow",
    "The Prometheus",
    "The Awakening",
    "The Entropy",
)


def _make_service() -> InstagramImageService:
    """Create service with a mock Supabase client (stories don't use it)."""
    return InstagramImageService(MagicMock())


def _make_png_bytes(
    width: int = IG_WIDTH,
    height: int = IG_HEIGHT_PORTRAIT,
    color: tuple[int, int, int] = (40, 40, 60),
    mode: str = "RGB",
) -> bytes:
    """Generate a solid-color PNG in memory for overlay tests."""
    img = Image.new(mode, (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _is_valid_jpeg(data: bytes) -> bool:
    return data[:3] == JPEG_MAGIC


def _jpeg_dimensions(data: bytes) -> tuple[int, int]:
    """Open JPEG bytes and return (width, height)."""
    img = Image.open(io.BytesIO(data))
    return img.size


# ── 1. Helper Function Tests ─────────────────────────────────────────────────


class TestHexToRgb:
    def test_valid_hex_with_hash(self):
        assert InstagramImageService._hex_to_rgb("#e74c3c") == (231, 76, 60)

    def test_valid_hex_without_hash(self):
        assert InstagramImageService._hex_to_rgb("e74c3c") == (231, 76, 60)

    def test_black(self):
        assert InstagramImageService._hex_to_rgb("#000000") == (0, 0, 0)

    def test_white(self):
        assert InstagramImageService._hex_to_rgb("#ffffff") == (255, 255, 255)

    def test_short_hex_returns_default(self):
        # 3-char hex is not 6 chars after stripping hash -- returns default slate
        assert InstagramImageService._hex_to_rgb("#abc") == (226, 232, 240)

    def test_empty_string_returns_default(self):
        assert InstagramImageService._hex_to_rgb("") == (226, 232, 240)

    def test_too_long_returns_default(self):
        assert InstagramImageService._hex_to_rgb("#abcdef12") == (226, 232, 240)


class TestWrapText:
    """Tests for _wrap_text using a real font for accurate measurement."""

    @pytest.fixture()
    def font(self):
        return _load_monospace_font(36)

    def test_short_text_no_wrap(self, font):
        lines = InstagramImageService._wrap_text("Hello", font, 800)
        assert lines == ["Hello"]

    def test_long_text_wraps(self, font):
        long = "The Bureau of Impossible Geography has detected anomalous substrate interference"
        lines = InstagramImageService._wrap_text(long, font, 400)
        assert len(lines) > 1
        # All words from input should appear across output lines
        reconstructed = " ".join(lines)
        for word in long.split():
            assert word in reconstructed

    def test_empty_text(self, font):
        lines = InstagramImageService._wrap_text("", font, 600)
        assert lines == []

    def test_single_long_word(self, font):
        # A single word that can't be broken stays on one line
        word = "Supercalifragilisticexpialidocious"
        lines = InstagramImageService._wrap_text(word, font, 100)
        assert len(lines) == 1
        assert lines[0] == word


class TestImageToJpeg:
    def test_rgb_image(self):
        img = Image.new("RGB", (200, 200), (128, 64, 32))
        result = InstagramImageService._image_to_jpeg(img)
        assert _is_valid_jpeg(result)

    def test_rgba_image(self):
        img = Image.new("RGBA", (200, 200), (128, 64, 32, 200))
        result = InstagramImageService._image_to_jpeg(img)
        assert _is_valid_jpeg(result)

    def test_output_is_progressive(self):
        img = Image.new("RGB", (200, 200), (100, 100, 100))
        result = InstagramImageService._image_to_jpeg(img)
        # Re-open and check progressive flag
        reopened = Image.open(io.BytesIO(result))
        assert reopened.info.get("progressive", False) or reopened.info.get("progression", False)

    def test_palette_mode_converts(self):
        img = Image.new("P", (100, 100))
        result = InstagramImageService._image_to_jpeg(img)
        assert _is_valid_jpeg(result)


class TestGenerateSolidBackground:
    def test_returns_png_bytes(self):
        result = InstagramImageService._generate_solid_background("#1a1a2e")
        img = Image.open(io.BytesIO(result))
        assert img.format == "PNG"
        assert img.size == (IG_WIDTH, IG_HEIGHT_PORTRAIT)

    def test_uses_correct_color(self):
        result = InstagramImageService._generate_solid_background("#ff0000")
        img = Image.open(io.BytesIO(result))
        # Sample center pixel
        r, g, b = img.getpixel((IG_WIDTH // 2, IG_HEIGHT_PORTRAIT // 2))
        assert r == 255
        assert g == 0
        assert b == 0


# ── 2. Visual Helper Tests ───────────────────────────────────────────────────


class TestCreateGradient:
    def test_dimensions(self):
        gradient = InstagramImageService._create_gradient(
            200, 100, (255, 0, 0, 255), (0, 0, 255, 255),
        )
        assert gradient.size == (200, 100)

    def test_rgba_mode(self):
        gradient = InstagramImageService._create_gradient(
            50, 50, (0, 0, 0, 255), (255, 255, 255, 255),
        )
        assert gradient.mode == "RGBA"

    def test_top_bottom_colors(self):
        gradient = InstagramImageService._create_gradient(
            10, 100, (255, 0, 0, 255), (0, 0, 255, 255),
        )
        # Top pixel should be close to red
        r, g, b, a = gradient.getpixel((5, 0))
        assert r > 200
        assert b < 50
        # Bottom pixel should be close to blue
        r, g, b, a = gradient.getpixel((5, 99))
        assert b > 200
        assert r < 50


class TestCreateVignette:
    def test_dimensions(self):
        vignette = InstagramImageService._create_vignette(200, 100)
        assert vignette.size == (200, 100)

    def test_rgba_mode(self):
        vignette = InstagramImageService._create_vignette(200, 100)
        assert vignette.mode == "RGBA"

    def test_center_transparent(self):
        vignette = InstagramImageService._create_vignette(200, 100, intensity=0.7)
        # Center pixel alpha should be low (near-transparent)
        _, _, _, a = vignette.getpixel((100, 50))
        assert a < 30

    def test_edge_opaque(self):
        vignette = InstagramImageService._create_vignette(200, 100, intensity=0.7)
        # Corner pixel should have higher alpha
        _, _, _, a = vignette.getpixel((0, 0))
        assert a > 100


class TestAddNoiseGrain:
    def test_same_dimensions(self):
        img = Image.new("RGBA", (100, 80), (50, 50, 50, 255))
        result = InstagramImageService._add_noise_grain(img, sigma=15, opacity=0.08)
        assert result.size == img.size

    def test_same_mode(self):
        img = Image.new("RGBA", (100, 80), (50, 50, 50, 255))
        result = InstagramImageService._add_noise_grain(img, sigma=15, opacity=0.08)
        assert result.mode == "RGBA"

    def test_rgb_mode(self):
        img = Image.new("RGB", (100, 80), (50, 50, 50))
        result = InstagramImageService._add_noise_grain(img, sigma=10, opacity=0.05)
        assert result.mode == "RGB"

    def test_zero_opacity_no_change(self):
        img = Image.new("RGBA", (50, 50), (128, 128, 128, 255))
        result = InstagramImageService._add_noise_grain(img, sigma=15, opacity=0.0)
        # With 0 opacity, scaled noise is 0 -- output should match input
        import numpy as np

        assert np.array_equal(np.array(img), np.array(result))


class TestAddBokehDots:
    def test_does_not_change_dimensions(self):
        img = Image.new("RGBA", (200, 200), (10, 12, 18, 255))
        InstagramImageService._add_bokeh_dots(img, (255, 100, 50), count=5, seed=42)
        assert img.size == (200, 200)

    def test_deterministic_with_seed(self):
        img1 = Image.new("RGBA", (200, 200), (10, 12, 18, 255))
        img2 = Image.new("RGBA", (200, 200), (10, 12, 18, 255))
        InstagramImageService._add_bokeh_dots(img1, (255, 100, 50), count=5, seed=42)
        InstagramImageService._add_bokeh_dots(img2, (255, 100, 50), count=5, seed=42)
        import numpy as np

        assert np.array_equal(np.array(img1), np.array(img2))


class TestDrawArchetypeSymbol:
    """Each archetype has a distinct symbol path -- verify none crash."""

    @pytest.mark.parametrize("archetype", ALL_ARCHETYPES)
    def test_all_archetypes_render(self, archetype):
        from PIL import ImageDraw

        img = Image.new("RGBA", (400, 400), (0, 0, 0, 255))
        draw = ImageDraw.Draw(img)
        # Should not raise
        InstagramImageService._draw_archetype_symbol(
            draw, 200, 200, 160, archetype, (255, 100, 50, 200),
        )

    def test_unknown_archetype_falls_back(self):
        from PIL import ImageDraw

        img = Image.new("RGBA", (400, 400), (0, 0, 0, 255))
        draw = ImageDraw.Draw(img)
        InstagramImageService._draw_archetype_symbol(
            draw, 200, 200, 160, "Unknown Archetype", (200, 200, 200, 200),
        )


class TestDrawMagnitudeArc:
    @pytest.mark.parametrize("magnitude", [0.0, 0.5, 1.0, 1.5])
    def test_no_crash(self, magnitude):
        from PIL import ImageDraw

        img = Image.new("RGBA", (400, 400), (0, 0, 0, 255))
        draw = ImageDraw.Draw(img)
        InstagramImageService._draw_magnitude_arc(
            draw, 200, 200, 100, 12, magnitude, (255, 100, 50),
        )


class TestDrawCornerBrackets:
    def test_no_crash(self):
        from PIL import ImageDraw

        img = Image.new("RGBA", (400, 400), (0, 0, 0, 255))
        draw = ImageDraw.Draw(img)
        InstagramImageService._draw_corner_brackets(
            draw, 20, 20, 360, 360, (200, 200, 200, 160),
        )


# ── 3. Story Template Smoke Tests ────────────────────────────────────────────


class TestStoryDetection:
    def test_produces_valid_jpeg(self):
        svc = _make_service()
        result = svc.compose_story_detection(
            archetype="The Shadow",
            signature="resonance_spike_alpha",
            magnitude=0.75,
            accent_hex="#e74c3c",
        )
        assert _is_valid_jpeg(result)

    @pytest.mark.parametrize("archetype", ALL_ARCHETYPES)
    def test_all_archetypes(self, archetype):
        svc = _make_service()
        result = svc.compose_story_detection(
            archetype=archetype,
            signature="test_signal",
            magnitude=0.5,
            accent_hex="#ff6b2b",
        )
        assert _is_valid_jpeg(result)
        w, h = _jpeg_dimensions(result)
        assert w == IG_WIDTH
        assert h == IG_HEIGHT_STORY

    @pytest.mark.parametrize("magnitude", [0.0, 0.01, 0.5, 0.99, 1.0])
    def test_magnitude_range(self, magnitude):
        svc = _make_service()
        result = svc.compose_story_detection(
            archetype="The Tower",
            signature="boundary_test",
            magnitude=magnitude,
            accent_hex="#3498db",
        )
        assert _is_valid_jpeg(result)

    def test_long_signature_no_crash(self):
        svc = _make_service()
        result = svc.compose_story_detection(
            archetype="The Entropy",
            signature="extremely_long_resonance_signature_that_exceeds_normal_display_bounds_and_tests_wrapping",
            magnitude=0.42,
            accent_hex="#9b59b6",
        )
        assert _is_valid_jpeg(result)


class TestStoryClassification:
    def test_produces_valid_jpeg(self):
        svc = _make_service()
        result = svc.compose_story_classification(
            archetype="The Tower",
            source_category="seismic_resonance",
            affected_shard_count=3,
            highest_susceptibility_sim="Velgarien",
            highest_susceptibility_val=2.4,
            bureau_dispatch="All operatives maintain position. Substrate anomaly contained.",
            accent_hex="#e74c3c",
        )
        assert _is_valid_jpeg(result)
        w, h = _jpeg_dimensions(result)
        assert w == IG_WIDTH
        assert h == IG_HEIGHT_STORY

    def test_no_dispatch(self):
        svc = _make_service()
        result = svc.compose_story_classification(
            archetype="The Shadow",
            source_category="psychic_bleed",
            affected_shard_count=1,
            highest_susceptibility_sim="Station Null",
            highest_susceptibility_val=1.1,
            bureau_dispatch=None,
            accent_hex="#2ecc71",
        )
        assert _is_valid_jpeg(result)

    def test_long_category_no_crash(self):
        svc = _make_service()
        result = svc.compose_story_classification(
            archetype="The Devouring Mother",
            source_category="extremely_long_source_category_that_tests_text_wrapping_behavior",
            affected_shard_count=99,
            highest_susceptibility_sim="A Very Long Simulation Name That Will Need Wrapping",
            highest_susceptibility_val=9.9,
            bureau_dispatch="Multiline dispatch.\nLine two.\nLine three.",
            accent_hex="#f39c12",
        )
        assert _is_valid_jpeg(result)

    def test_zero_shards(self):
        svc = _make_service()
        result = svc.compose_story_classification(
            archetype="The Entropy",
            source_category="test",
            affected_shard_count=0,
            highest_susceptibility_sim="Test",
            highest_susceptibility_val=0.0,
            bureau_dispatch=None,
            accent_hex="#1abc9c",
        )
        assert _is_valid_jpeg(result)


class TestStoryImpact:
    def test_produces_valid_jpeg(self):
        svc = _make_service()
        result = svc.compose_story_impact(
            simulation_name="Velgarien",
            effective_magnitude=0.65,
            events_spawned=["Market crash in sector 7", "Agent defection detected"],
            narrative_closing="The shard will never forget this day.",
            accent_hex="#e74c3c",
        )
        assert _is_valid_jpeg(result)
        w, h = _jpeg_dimensions(result)
        assert w == IG_WIDTH
        assert h == IG_HEIGHT_STORY

    def test_zero_events(self):
        svc = _make_service()
        result = svc.compose_story_impact(
            simulation_name="Test Shard",
            effective_magnitude=0.1,
            events_spawned=[],
            narrative_closing=None,
            accent_hex="#3498db",
        )
        assert _is_valid_jpeg(result)

    def test_with_reactions(self):
        svc = _make_service()
        result = svc.compose_story_impact(
            simulation_name="Speranza",
            effective_magnitude=0.8,
            events_spawned=["Event Alpha"],
            narrative_closing="Reality whispers.",
            accent_hex="#e74c3c",
            reactions=[
                {"agent_name": "Agent Voss", "text": "This changes everything.", "emotion": "shock"},
                {"agent_name": "Agent Null", "text": "We saw it coming.", "emotion": None},
            ],
        )
        assert _is_valid_jpeg(result)

    def test_with_banner_bytes(self):
        svc = _make_service()
        banner = _make_png_bytes(800, 600, (30, 60, 90))
        result = svc.compose_story_impact(
            simulation_name="Test",
            effective_magnitude=0.5,
            events_spawned=["Test event"],
            narrative_closing="Fading echoes.",
            accent_hex="#9b59b6",
            banner_bytes=banner,
        )
        assert _is_valid_jpeg(result)

    def test_with_sim_color(self):
        svc = _make_service()
        result = svc.compose_story_impact(
            simulation_name="Velgarien",
            effective_magnitude=0.5,
            events_spawned=["Test"],
            narrative_closing=None,
            accent_hex="#e74c3c",
            sim_color_hex="#ff6b2b",
        )
        assert _is_valid_jpeg(result)

    def test_many_events(self):
        svc = _make_service()
        result = svc.compose_story_impact(
            simulation_name="Test",
            effective_magnitude=0.99,
            events_spawned=[f"Event number {i}" for i in range(20)],
            narrative_closing="The substrate groans.",
            accent_hex="#e74c3c",
        )
        assert _is_valid_jpeg(result)

    def test_long_sim_name_truncates(self):
        svc = _make_service()
        result = svc.compose_story_impact(
            simulation_name="An Extraordinarily Long Simulation Name That Should Be Truncated",
            effective_magnitude=0.5,
            events_spawned=["Test"],
            narrative_closing=None,
            accent_hex="#e74c3c",
        )
        assert _is_valid_jpeg(result)


class TestStoryAdvisory:
    def test_produces_valid_jpeg(self):
        svc = _make_service()
        result = svc.compose_story_advisory(
            archetype="The Tower",
            aligned_types=["Saboteur", "Infiltrator"],
            opposed_types=["Spy"],
            zone_name="Sector 7",
            accent_hex="#e74c3c",
        )
        assert _is_valid_jpeg(result)
        w, h = _jpeg_dimensions(result)
        assert w == IG_WIDTH
        assert h == IG_HEIGHT_STORY

    def test_empty_columns(self):
        svc = _make_service()
        result = svc.compose_story_advisory(
            archetype="The Shadow",
            aligned_types=[],
            opposed_types=[],
            zone_name=None,
            accent_hex="#2ecc71",
        )
        assert _is_valid_jpeg(result)

    def test_max_operatives(self):
        svc = _make_service()
        result = svc.compose_story_advisory(
            archetype="The Prometheus",
            aligned_types=["Saboteur", "Infiltrator", "Spy", "Propagandist", "Assassin"],
            opposed_types=["Saboteur", "Infiltrator", "Spy", "Propagandist", "Assassin"],
            zone_name="A Very Long Zone Name That Tests Wrapping Behavior",
            accent_hex="#f39c12",
        )
        assert _is_valid_jpeg(result)

    @pytest.mark.parametrize(
        "op_type",
        ["Saboteur", "Infiltrator", "Spy", "Propagandist", "Assassin"],
    )
    def test_all_operative_types(self, op_type):
        svc = _make_service()
        result = svc.compose_story_advisory(
            archetype="The Tower",
            aligned_types=[op_type],
            opposed_types=[],
            zone_name=None,
            accent_hex="#e74c3c",
        )
        assert _is_valid_jpeg(result)


class TestStorySubsiding:
    def test_produces_valid_jpeg(self):
        svc = _make_service()
        result = svc.compose_story_subsiding(
            archetype="The Tower",
            events_spawned_total=15,
            shards_affected=3,
            accent_hex="#e74c3c",
        )
        assert _is_valid_jpeg(result)
        w, h = _jpeg_dimensions(result)
        assert w == IG_WIDTH
        assert h == IG_HEIGHT_STORY

    def test_zero_values(self):
        svc = _make_service()
        result = svc.compose_story_subsiding(
            archetype="The Entropy",
            events_spawned_total=0,
            shards_affected=0,
            accent_hex="#1abc9c",
        )
        assert _is_valid_jpeg(result)

    def test_large_numbers(self):
        svc = _make_service()
        result = svc.compose_story_subsiding(
            archetype="The Devouring Mother",
            events_spawned_total=9999,
            shards_affected=999,
            accent_hex="#9b59b6",
        )
        assert _is_valid_jpeg(result)

    @pytest.mark.parametrize("archetype", ALL_ARCHETYPES)
    def test_all_archetypes(self, archetype):
        svc = _make_service()
        result = svc.compose_story_subsiding(
            archetype=archetype,
            events_spawned_total=5,
            shards_affected=2,
            accent_hex="#e74c3c",
        )
        assert _is_valid_jpeg(result)


# ── 4. Feed Post Smoke Tests ─────────────────────────────────────────────────


class TestComposeWithOverlay:
    def test_solid_background(self):
        svc = _make_service()
        bg = _make_png_bytes()
        result = svc._compose_with_overlay(
            bg,
            title="PERSONNEL FILE -- Agent Voss",
            subtitle="SHARD: Velgarien",
            color_primary="#e2e8f0",
            color_background="#0f172a",
            classification="PUBLIC",
        )
        assert _is_valid_jpeg(result)

    def test_long_title_no_crash(self):
        svc = _make_service()
        bg = _make_png_bytes()
        result = svc._compose_with_overlay(
            bg,
            title="VERY LONG TITLE THAT DEFINITELY EXCEEDS THE HEADER WIDTH AND NEEDS WRAPPING",
            subtitle="A similarly long subtitle for good measure and robustness testing",
            color_primary="#ff6b2b",
            color_background="#1a1a2e",
            classification="AMBER",
        )
        assert _is_valid_jpeg(result)

    def test_with_cipher_hint(self):
        svc = _make_service()
        bg = _make_png_bytes()
        result = svc._compose_with_overlay(
            bg,
            title="DISPATCH [0042]",
            subtitle="RE: Station Null",
            color_primary="#e74c3c",
            color_background="#0f172a",
            classification="RESTRICTED",
            cipher_hint="V3LG-R13N-4C7V-BUREAU",
        )
        assert _is_valid_jpeg(result)

    def test_rgba_input(self):
        svc = _make_service()
        bg = _make_png_bytes(mode="RGBA")
        result = svc._compose_with_overlay(
            bg,
            title="TEST",
            subtitle="TEST",
            color_primary="#ffffff",
            color_background="#000000",
            classification="PUBLIC",
        )
        assert _is_valid_jpeg(result)

    def test_small_image_resized(self):
        svc = _make_service()
        bg = _make_png_bytes(width=200, height=200)
        result = svc._compose_with_overlay(
            bg,
            title="SMALL IMAGE",
            subtitle="RESIZE TEST",
            color_primary="#e2e8f0",
            color_background="#0f172a",
            classification="PUBLIC",
        )
        assert _is_valid_jpeg(result)


# ── 5. Font Loading Tests ────────────────────────────────────────────────────


class TestFontLoading:
    def test_monospace_font_returns_something(self):
        font = _load_monospace_font(24)
        assert font is not None

    def test_bold_font_returns_something(self):
        font = _load_bold_font(24)
        assert font is not None

    def test_italic_font_returns_something(self):
        font = _load_italic_font(24)
        assert font is not None

    def test_different_sizes(self):
        f1 = _load_monospace_font(12)
        f2 = _load_monospace_font(48)
        assert f1 is not None
        assert f2 is not None

    def test_caching_returns_same_object(self):
        f1 = _load_monospace_font(36)
        f2 = _load_monospace_font(36)
        assert f1 is f2

    def test_bold_caching(self):
        f1 = _load_bold_font(36)
        f2 = _load_bold_font(36)
        assert f1 is f2

    def test_italic_caching(self):
        f1 = _load_italic_font(36)
        f2 = _load_italic_font(36)
        assert f1 is f2
