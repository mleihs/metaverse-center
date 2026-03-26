"""Unit tests for ForgeAsciiArtService — pure function tests.

Tests the deterministic image-to-ASCII pipeline, figlet generation,
and validation logic. No mocks needed — these are pure functions.
"""

from __future__ import annotations

import pytest
from PIL import Image

from backend.services.forge_ascii_art_service import (
    ASCII_RAMP,
    MAX_ART_LINES,
    MAX_ART_WIDTH,
    MAX_SCENE_HEIGHT,
    MAX_SCENE_WIDTH,
    ForgeAsciiArtService,
)

# ── generate_figlet_title ────────────────────────────────────────────────────


class TestGenerateFigletTitle:
    def test_short_name_renders(self):
        result = ForgeAsciiArtService.generate_figlet_title("Speranza")
        assert len(result) > 0
        assert "\n" in result  # Multi-line figlet art

    def test_respects_max_width(self):
        result = ForgeAsciiArtService.generate_figlet_title("Test", max_width=40)
        for line in result.split("\n"):
            assert len(line) <= 40

    def test_very_long_name_falls_back_to_plain(self):
        # A name so long no figlet font can fit it
        long_name = "A" * 100
        result = ForgeAsciiArtService.generate_figlet_title(long_name, max_width=30)
        # Falls back to plain centered uppercase
        assert long_name.upper() in result or result.strip() == long_name.upper().center(30).strip()

    def test_empty_name(self):
        result = ForgeAsciiArtService.generate_figlet_title("")
        assert isinstance(result, str)


# ── image_to_ascii ───────────────────────────────────────────────────────────


class TestImageToAscii:
    def test_produces_correct_dimensions(self):
        img = Image.new("RGB", (200, 100), color=(128, 128, 128))
        result = ForgeAsciiArtService.image_to_ascii(img, width=40, height=10)
        lines = result.split("\n")
        assert len(lines) == 10
        assert all(len(line) == 40 for line in lines)

    def test_default_dimensions(self):
        img = Image.new("RGB", (400, 200), color=(64, 64, 64))
        result = ForgeAsciiArtService.image_to_ascii(img)
        lines = result.split("\n")
        assert len(lines) == MAX_SCENE_HEIGHT
        assert all(len(line) == MAX_SCENE_WIDTH for line in lines)

    def test_white_image_maps_to_dense_chars_when_inverted(self):
        img = Image.new("RGB", (10, 10), color=(255, 255, 255))
        result = ForgeAsciiArtService.image_to_ascii(img, width=5, height=3, invert=True)
        # White with invert=True → highest brightness → end of ramp (dense chars)
        for char in result.replace("\n", ""):
            assert char in ASCII_RAMP[-3:]  # Should be dense characters

    def test_black_image_maps_to_sparse_chars_when_inverted(self):
        img = Image.new("RGB", (10, 10), color=(0, 0, 0))
        result = ForgeAsciiArtService.image_to_ascii(img, width=5, height=3, invert=True)
        # Black with invert=True → lowest brightness → start of ramp (space)
        for char in result.replace("\n", ""):
            assert char in ASCII_RAMP[:2]  # Should be space or dot

    def test_rgba_image_converts(self):
        """RGBA images (with alpha) should convert without error."""
        img = Image.new("RGBA", (50, 50), color=(128, 128, 128, 200))
        result = ForgeAsciiArtService.image_to_ascii(img, width=10, height=5)
        assert len(result.split("\n")) == 5


# ── validate_ascii_art ───────────────────────────────────────────────────────


class TestValidateAsciiArt:
    def test_valid_art_passes(self):
        art = "####\n----\n====\n++++\n"
        valid, reason = ForgeAsciiArtService.validate_ascii_art(art)
        assert valid is True
        assert reason == "OK"

    def test_empty_art_fails(self):
        valid, reason = ForgeAsciiArtService.validate_ascii_art("")
        assert valid is False
        assert "empty" in reason.lower()

    def test_whitespace_only_fails(self):
        valid, reason = ForgeAsciiArtService.validate_ascii_art("   \n   \n")
        assert valid is False

    def test_too_many_lines_fails(self):
        art = "\n".join(["#" * 10] * (MAX_ART_LINES + 5))
        valid, reason = ForgeAsciiArtService.validate_ascii_art(art)
        assert valid is False
        assert "lines" in reason.lower()

    def test_line_too_wide_fails(self):
        art = "#" * (MAX_ART_WIDTH + 10) + "\n" + "###\n###\n"
        valid, reason = ForgeAsciiArtService.validate_ascii_art(art)
        assert valid is False
        assert "wide" in reason.lower()

    def test_non_ascii_character_fails(self):
        art = "Hello\u00E9World\n###\n###\n"  # é is non-ASCII
        valid, reason = ForgeAsciiArtService.validate_ascii_art(art)
        assert valid is False
        assert "non-ASCII" in reason

    def test_respects_custom_limits(self):
        art = "####\n----\n====\n"
        valid, _ = ForgeAsciiArtService.validate_ascii_art(art, max_width=3)
        assert valid is False


# ── generate_boot_art (integration) ──────────────────────────────────────────


class TestGenerateBootArt:
    @pytest.mark.asyncio
    async def test_generates_title_without_banner(self):
        result = await ForgeAsciiArtService.generate_boot_art("Speranza")
        assert len(result) > 0
        # FIGlet art won't contain the name as plain text, but must be non-empty
        assert len(result.strip()) > 10

    @pytest.mark.asyncio
    async def test_always_returns_valid_string(self):
        result = await ForgeAsciiArtService.generate_boot_art("Test Sim")
        valid, _ = ForgeAsciiArtService.validate_ascii_art(result)
        assert valid is True

    @pytest.mark.asyncio
    async def test_with_invalid_banner_url_falls_back_to_title(self):
        result = await ForgeAsciiArtService.generate_boot_art(
            "Test",
            banner_url="https://nonexistent.example.invalid/image.png",
        )
        # Should still produce valid output (title only)
        assert len(result) > 0
