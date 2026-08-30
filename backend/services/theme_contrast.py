"""A contrast floor for AI-generated simulation themes.

The Forge lets a model choose a world's entire palette. Until this module
existed, the only thing standing between that model and production was a line in
the prompt asking it nicely: *"Ensure sufficient contrast between text and
background (WCAG AA)."* Asking is not checking.

Measured on production, 2026-08-30: of 37 themed simulations, 36 were sound and
one was not. `State Pathography: Legibility as Biopolitical Metabolism` had
``color_text`` and ``color_surface_header`` set to the *same* value, ``#1a1a2e``
— a contrast ratio of 1.00. The world's own name was rendered in its header in
navy on navy, invisible, along with everything else on that surface in all 37
places the token is used. Nobody saw it for a day because a header that renders
nothing looks like a header that was designed empty.

What this enforces: every surface that carries primary text must clear WCAG AA
for normal text (4.5:1) against ``color_text``. A surface that fails falls back
to the theme's own ``color_background`` — the value the default token system
already gives it (``--color-surface-header`` defaults to the same colour as
``--color-surface``), so the repair stays inside the palette the model chose
rather than inventing a colour.

What it does not do: it never rewrites the *text* colour, and it never touches
secondary or muted text. Those are deliberate design choices with legitimate
ratios below 4.5 in several shipped themes; a floor there would be a redesign,
not a repair. They are measured and reported, not changed.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

__all__ = [
    "AA_LARGE_TEXT",
    "AA_NORMAL_TEXT",
    "ContrastRepair",
    "ThemeContrastReport",
    "contrast_ratio",
    "enforce_theme_contrast",
    "parse_hex",
    "relative_luminance",
]

# WCAG 2.1 success criterion 1.4.3.
AA_NORMAL_TEXT = 4.5
AA_LARGE_TEXT = 3.0

# The surfaces that carry `--color-text-primary` in the component layer. Checked
# against `color_text`; a failure is repaired.
TEXT_BEARING_SURFACES = (
    "color_background",
    "color_surface",
    "color_surface_header",
    "color_surface_sunken",
)

# Reported, never rewritten: these ratios are design decisions.
ADVISORY_TEXT_KEYS = ("color_text_secondary", "color_text_muted")

_HEX_RE = re.compile(r"^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


def parse_hex(value: str | None) -> tuple[int, int, int] | None:
    """Return (r, g, b) for a #rgb or #rrggbb string, or None if it is neither."""
    if not isinstance(value, str):
        return None
    match = _HEX_RE.match(value.strip())
    if not match:
        return None
    digits = match.group(1)
    if len(digits) == 3:
        digits = "".join(c * 2 for c in digits)
    return int(digits[0:2], 16), int(digits[2:4], 16), int(digits[4:6], 16)


def relative_luminance(rgb: tuple[int, int, int]) -> float:
    """WCAG relative luminance of an sRGB colour."""

    def channel(raw: int) -> float:
        c = raw / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (channel(v) for v in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(foreground: str | None, background: str | None) -> float | None:
    """WCAG contrast ratio, or None when either colour is not a hex value.

    None means "cannot judge" — a theme may legitimately carry a gradient or a
    keyword here, and a check that guessed would be worse than one that abstains.
    """
    fg, bg = parse_hex(foreground), parse_hex(background)
    if fg is None or bg is None:
        return None
    lighter, darker = sorted((relative_luminance(fg), relative_luminance(bg)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


@dataclass(frozen=True, slots=True)
class ContrastRepair:
    """One surface that could not carry the theme's text, and what replaced it."""

    key: str
    original: str
    replacement: str
    ratio_before: float
    ratio_after: float | None


@dataclass(frozen=True, slots=True)
class ThemeContrastReport:
    """What the floor found. Empty means the theme was already sound."""

    repairs: tuple[ContrastRepair, ...] = ()
    advisories: tuple[tuple[str, float], ...] = ()
    unrepairable: tuple[tuple[str, float], ...] = ()

    @property
    def is_clean(self) -> bool:
        return not self.repairs and not self.unrepairable

    def as_context(self) -> dict[str, object]:
        """Structured detail for a log record or a Sentry context."""
        return {
            "repairs": [
                {
                    "key": r.key,
                    "from": r.original,
                    "to": r.replacement,
                    "ratio_before": round(r.ratio_before, 2),
                    "ratio_after": round(r.ratio_after, 2) if r.ratio_after else None,
                }
                for r in self.repairs
            ],
            "advisories": [{"key": k, "ratio": round(v, 2)} for k, v in self.advisories],
            "unrepairable": [{"key": k, "ratio": round(v, 2)} for k, v in self.unrepairable],
        }


def enforce_theme_contrast(theme: dict[str, object]) -> tuple[dict[str, object], ThemeContrastReport]:
    """Return the theme with unreadable surfaces repaired, plus what was found.

    The input is not mutated. A theme with no ``color_text``, or with a
    ``color_text`` that is not a hex value, is returned untouched: there is
    nothing to measure against.
    """
    text = theme.get("color_text")
    if parse_hex(text if isinstance(text, str) else None) is None:
        return theme, ThemeContrastReport()

    text_colour = str(text)
    fallback = theme.get("color_background")
    fallback_ratio = contrast_ratio(text_colour, fallback if isinstance(fallback, str) else None)
    fallback_usable = fallback_ratio is not None and fallback_ratio >= AA_NORMAL_TEXT

    repaired = dict(theme)
    repairs: list[ContrastRepair] = []
    unrepairable: list[tuple[str, float]] = []

    for key in TEXT_BEARING_SURFACES:
        value = theme.get(key)
        ratio = contrast_ratio(text_colour, value if isinstance(value, str) else None)
        if ratio is None or ratio >= AA_NORMAL_TEXT:
            continue
        if key == "color_background" or not fallback_usable:
            # Nothing safe to fall back to. Overwriting the whole palette to
            # rescue it would be a redesign; say so instead and leave it.
            unrepairable.append((key, ratio))
            continue
        repaired[key] = fallback
        repairs.append(
            ContrastRepair(
                key=key,
                original=str(value),
                replacement=str(fallback),
                ratio_before=ratio,
                ratio_after=fallback_ratio,
            )
        )

    advisories: list[tuple[str, float]] = []
    surface = repaired.get("color_surface")
    for key in ADVISORY_TEXT_KEYS:
        value = repaired.get(key)
        ratio = contrast_ratio(value if isinstance(value, str) else None, surface if isinstance(surface, str) else None)
        if ratio is not None and ratio < AA_NORMAL_TEXT:
            advisories.append((key, ratio))

    return repaired, ThemeContrastReport(
        repairs=tuple(repairs),
        advisories=tuple(advisories),
        unrepairable=tuple(unrepairable),
    )
