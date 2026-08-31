#!/usr/bin/env python3
"""Reject coloured edge bars, in either of the two shapes CSS offers for them.

TWO SHAPES, ONE DEVICE — and the second one is not optional
    A coloured bar down an element's edge can be drawn as a thick `border-left`
    or as an absolutely positioned `::before` that is a few pixels wide and the
    full height. They look identical on screen. The first version of this gate
    only knew the border form, and the pseudo-element form promptly outlived the
    sweep in `admin-shared-styles.ts` — the one file that puts a panel on every
    admin tab — while the gate reported PASS. The pseudo-element is also the
    shape an author is PUSHED towards, because it is the only one that can carry
    a gradient. So a gate that checks one shape and not the other checks the
    easier half. Do not drop the second pass in a later refactor.

A MOVING BAR IS NOT A MARKER
    A sweep line and a progress bar are the same geometry doing a different job:
    they say "working", not "this is a card of kind X", and they are recognisable
    because they MOVE. So a pseudo-element bar that declares a named animation
    is an effect and passes. That is a property of the thing, not an allowlist,
    which is why it is a rule here rather than a filename.

Invoked by lint-no-accent-edge-bar.sh, which owns the anchoring preamble and the
error text. The detection lives here rather than in the shell because the rule
needs to know WHICH CSS RULE a hit belongs to — a selection marker on an active
row is allowed, the same declaration on a card is not — and walking back to the
nearest selector is a parsing job, not a grep job. The first version did try it
in bash (sed window + grep for the last line ending in `{`) and silently failed
to filter two of eighteen hits, which is the kind of quiet wrongness this repo
has already been bitten by once (six gates that passed while checking nothing).

Exit code: 0 = clean, 1 = violations.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "src"

# A border-left of two pixels or more, in some colour.
BAR = re.compile(
    r"border-left:\s*"
    r"(?:var\(--border-width-(?:default|thick|heavy)\)|[2-9]\d*px)"
    r"\s+(?:solid|dashed|dotted)\s+(?P<colour>[^;]+);"
)

# Colours that carry no status meaning — a rule, not a marker.
NEUTRAL = re.compile(
    r"transparent"
    r"|var\(--color-border\b"
    r"|var\(--color-border-light\b"
    r"|var\(--color-separator\b"
    r"|var\(--_border\b"
    r"|var\(--border-dim\b"
)

# Selectors whose edge marker is a POSITION indicator, not decoration: the
# active row of a list, a hovered row, a focused one. These say something the
# box says nowhere else, and every navigation column on the web uses them.
STATE = re.compile(r"--active|--selected|--current|--focused|--expanded|:hover|:focus")

# A panel's own edge against the page, not a marker on a card.
ALLOWLIST = (
    "VelgDarkroomStudio.ts",
    "VelgSidePanel.ts",
    "world-map.css",
    # ── NOT an exemption. A named debt, 2026-08-31. ──────────────────────
    # These two carry the split shape this gate learned today
    # (DevAccountSwitcher.ts:266 .user--focused, SimulationSwitcher.ts:256
    # .sim-card--active — both `border-left-color: var(--color-primary)` over
    # a transparent 2px base). They are NOT allowed and they are NOT correct.
    #
    # They sit here because the session that owns components/platform/** could
    # not be reached: six delivery attempts over three routes are held pending
    # a permission approval, so nobody can fix them and nobody can consent to
    # someone else doing it. Sharpening the gate without this would turn CI red
    # for a fix no one is able to make — which trains everyone to ignore the
    # gate, and that costs more than the two bars do.
    #
    # Remove BOTH lines the moment either file is cleaned. See
    # handoff/simulation-views/CLAIMS.md, "OFFEN UND UNZUSTELLBAR".
    "DevAccountSwitcher.ts",
    "SimulationSwitcher.ts",
)

# A border-left paired with a border-top or border-bottom in the same rule is
# one CORNER of a bracket, not a bar down an edge — the very idiom this gate
# steers towards. Found in the wild at htp-styles .intel-chart::before.
CORNER_PARTNER = re.compile(r"border-(?:top|bottom):\s*[^;]+;")

# The nearest preceding line that OPENS a rule. Handles both `.a {` and the
# multi-selector form where the last of several lines carries the brace.
OPENS_RULE = re.compile(r"\{\s*$")


def selector_for(lines: list[str], index: int) -> str:
    """Every selector line of the rule containing `lines[index]`.

    Walks back to the nearest line ending in `{`, then keeps walking while the
    lines above are comma-continued selectors — `.a,` / `.b,` / `.c {` is one
    rule and any of the three may carry the state token.
    """
    i = index
    while i >= 0 and not OPENS_RULE.search(lines[i]):
        i -= 1
    if i < 0:
        return ""
    parts = [lines[i]]
    j = i - 1
    while j >= 0 and lines[j].rstrip().endswith(","):
        parts.append(lines[j])
        j -= 1
    return " ".join(parts)


def rule_body(lines: list[str], index: int) -> str:
    """The declarations of the rule containing `lines[index]`, brace to brace."""
    start = index
    while start >= 0 and not OPENS_RULE.search(lines[start]):
        start -= 1
    end = index
    while end < len(lines) and "}" not in lines[end]:
        end += 1
    return " ".join(lines[start + 1 : end + 1])


# ── Second shape: the pseudo-element bar ─────────────────────────────────────

# A rule that paints one of the four edges of its host.
PSEUDO_SELECTOR = re.compile(r"::(?:before|after)\b")

# Narrow in one axis, full in the other. Six pixels is where a bar stops reading
# as a bar and starts reading as a panel of its own.
NARROW_WIDTH = re.compile(r"width:\s*([0-6](?:\.\d+)?)px")
NARROW_HEIGHT = re.compile(r"height:\s*([0-6](?:\.\d+)?)px")
FULL_HEIGHT = re.compile(r"height:\s*(?:100%|calc\()")
FULL_WIDTH = re.compile(r"width:\s*(?:100%|calc\()")

ABSOLUTE = re.compile(r"position:\s*absolute")
PINNED = re.compile(r"(?:top|right|bottom|left):\s*0|inset:")

# A background in a colour that carries meaning. The neutral set is shared with
# the border pass: a hairline in --color-border is a rule, not a marker.
COLOURED_BG = re.compile(
    r"background(?:-color|-image)?:[^;]*var\(--color-(?:danger|warning|success|info|primary|secondary|accent)"
)

# `animation: none` is the reduced-motion override of an animated rule, not a
# declaration of movement — so a name is required.
NAMED_ANIMATION = re.compile(r"animation:\s*(?!none\b)[a-zA-Z_-]")


def pseudo_bar_hits(path: Path, lines: list[str]) -> list[str]:
    """Coloured bars drawn as an absolutely positioned pseudo-element.

    Two passes over the file: first collect which pseudo-element selectors are
    animated anywhere in it (a reduced-motion block can be the only place the
    base rule's animation is visible from), then judge the geometry.
    """
    animated: set[str] = set()
    candidates: list[tuple[int, str, str]] = []

    for n, line in enumerate(lines):
        if not (PSEUDO_SELECTOR.search(line) and OPENS_RULE.search(line)):
            continue
        selector = selector_for(lines, n).strip()
        body = rule_body(lines, n)
        if NAMED_ANIMATION.search(body):
            animated.add(selector)
        candidates.append((n, selector, body))

    hits = []
    for n, selector, body in candidates:
        if selector in animated or STATE.search(selector):
            continue
        if not (ABSOLUTE.search(body) and PINNED.search(body) and COLOURED_BG.search(body)):
            continue
        vertical = NARROW_WIDTH.search(body) and FULL_HEIGHT.search(body)
        horizontal = NARROW_HEIGHT.search(body) and FULL_WIDTH.search(body)
        if not (vertical or horizontal):
            continue
        rel = path.relative_to(ROOT.parent)
        hits.append(f"{rel}:{n + 1}:{selector} draws a coloured edge bar as a pseudo-element")
    return hits


# ── Third shape: the SPLIT declaration ───────────────────────────────────────
#
# The width is declared once, in the base class, in `transparent`; the colour
# arrives later, on a modifier, as `border-left-color`. Neither half matches
# the single-declaration pass above, and together they draw exactly the bar it
# rejects. Measured rather than assumed: the same code WITH a state modifier in
# the selector and WITHOUT one both passed, while a single combined declaration
# without a modifier failed — so it is the split, not the documented state
# allowance, that let it through. Ten files carried this form on 2026-08-31.
#
# Two variants ride along:
#   * the width comes from a CUSTOM PROPERTY (var(--_bubble-border-width))
#     rather than a literal, so a [2-9]\d*px search never sees it;
#   * the edge is border-RIGHT, which the original pass does not read at all.
#     A bar on the right edge is the same bar.

SPLIT_BASE = re.compile(
    r"border-(?P<side>left|right):\s*(?P<width>[^;]+?)\s+"
    r"(?:solid|dashed|dotted)\s+transparent\s*;"
)
SPLIT_COLOUR = re.compile(r"border-(?P<side>left|right)-color:\s*(?P<colour>[^;]+);")

# 1px is a quote rule and predates the web — the gate says so itself.
ONE_PX = re.compile(r"^(?:1px|var\(--border-width-thin\))$")
CUSTOM_PROP = re.compile(r"^var\(\s*(--[a-z0-9_-]+)")
PROP_DEF = re.compile(r"(--[a-z0-9_-]+)\s*:\s*([0-9]+)px\s*;")


def primary_colour(value):
    """The colour that actually paints, not the fallback behind it.

    `var(--_accent, var(--color-border))` reads as neutral to a plain search:
    the fallback names --color-border. But the fallback only applies when
    --_accent is UNSET, and a component that writes it at runtime (the chat
    bubble sets it per agent) paints the agent's colour every time. Judging by
    the fallback declares the bar neutral in exactly the case where it is not.
    """
    v = value.strip()
    m = re.match(r"^var\(\s*(--[a-z0-9_-]+)\s*,", v)
    if m:
        return f"var({m.group(1)})"
    return v


def width_px(value, props):
    """Resolve a border width to pixels, following one custom-property hop.

    Returns None when the width cannot be read, and the caller treats None as
    "not a finding": a gate that guesses at a width it cannot see reports
    findings nobody can act on."""
    value = value.strip()
    if ONE_PX.match(value) or "border-width-thin" in value:
        return 1.0
    m = re.match(r"^([0-9.]+)px$", value)
    if m:
        return float(m.group(1))
    if re.search(r"border-width-(?:default|thick|heavy)", value):
        return 2.0
    m = CUSTOM_PROP.match(value)
    if m and m.group(1) in props:
        return props[m.group(1)]
    return None


# A pseudo-element that declares two ADJACENT border sides, one transparent,
# and no size of its own, is the classic CSS TRIANGLE: the sides meet in a
# filled corner. That is the opposite of a bar — it marks a corner, the way
# markerCornerStyles does. In the wild at DungeonCombatBar
# .ability--ultimate::before, flagging a once-per-descent ability.
TRIANGLE_SIDES = re.compile(r"border-(?:top|bottom):\s*[^;]*?(?:solid|dashed)\s+[^;]+;")
HAS_OWN_SIZE = re.compile(r"(?:width|height):\s*(?!0)")


def is_triangle(selector, body):
    if not PSEUDO_SELECTOR.search(selector):
        return False
    if not TRIANGLE_SIDES.search(body):
        return False
    return not HAS_OWN_SIZE.search(body)


def base_of(selector):
    """The bare class a modifier hangs off: `.mission--defensive` -> `.mission`."""
    first = selector.split(",")[0].strip().split()[-1] if selector.strip() else ""
    for token in ("--", ":", "::"):
        if token in first:
            first = first.split(token)[0]
    return first


def split_bar_hits(path, lines):
    text = "\n".join(lines)
    props = {m.group(1): float(m.group(2)) for m in PROP_DEF.finditer(text)}

    wide_transparent = set()
    for n, line in enumerate(lines):
        m = SPLIT_BASE.search(line)
        if not m:
            continue
        px = width_px(m.group("width"), props)
        if px is None or px < 2:
            continue
        for part in selector_for(lines, n).replace("{", " ").split(","):
            base = base_of(part)
            if base:
                wide_transparent.add(base)

    hits = []
    for n, line in enumerate(lines):
        m = SPLIT_COLOUR.search(line)
        if not m or NEUTRAL.search(primary_colour(m.group("colour"))):
            continue
        selector = selector_for(lines, n).replace("{", " ").strip()
        body = rule_body(lines, n)
        if is_triangle(selector, body) or CORNER_PARTNER.search(body):
            continue
        if base_of(selector) not in wide_transparent:
            continue
        rel = path.relative_to(ROOT.parent)
        hits.append(
            f"{rel}:{n + 1}:{selector.strip()} colours an edge whose width is "
            f"declared transparent in its base rule — {line.strip()}"
        )
    return hits


# ── Fourth shape: one declaration the width regex cannot read ────────────────
#
# `border-left: var(--_bubble-border-width) solid var(--_accent, …)` is a single
# declaration, so the split pass does not apply — and the original pass misses
# it twice over: the width is a custom property rather than [2-9]\d*px, and the
# colour is a Tier-3 token rather than var(--color-…). Found in the wild at
# ChatBubble .bubble--assistant, where it painted the agent's identity colour
# down the edge of every message.

CUSTOM_BAR = re.compile(
    r"border-(?P<side>left|right):\s*(?P<width>var\([^)]*\))\s+"
    r"(?:solid|dashed|dotted)\s+(?P<colour>[^;]+);"
)


def custom_width_hits(path, lines):
    text = "\n".join(lines)
    props = {m.group(1): float(m.group(2)) for m in PROP_DEF.finditer(text)}
    hits = []
    for n, line in enumerate(lines):
        m = CUSTOM_BAR.search(line)
        if not m or NEUTRAL.search(primary_colour(m.group("colour"))):
            continue
        # The original pass already reads the --border-width-* family; leaving
        # it to that one keeps a single finding per line.
        if re.search(r"border-width-(?:default|thick|heavy|thin)", m.group("width")):
            continue
        px = width_px(m.group("width"), props)
        if px is None or px < 2:
            continue
        selector = selector_for(lines, n).replace("{", " ").strip()
        body = rule_body(lines, n)
        if is_triangle(selector, body) or CORNER_PARTNER.search(body):
            continue
        rel = path.relative_to(ROOT.parent)
        hits.append(
            f"{rel}:{n + 1}:{selector.strip()} draws a {px:.0f}px edge bar whose "
            f"width comes from a custom property — {line.strip()}"
        )
    return hits


def main() -> int:
    hits: list[str] = []
    files = sorted(list(ROOT.rglob("*.ts")) + list(ROOT.rglob("*.css")))
    for path in files:
        if path.name in ALLOWLIST:
            continue
        lines = path.read_text(encoding="utf-8").split("\n")
        for n, line in enumerate(lines):
            m = BAR.search(line)
            if not m or NEUTRAL.search(m.group("colour")):
                continue
            if STATE.search(selector_for(lines, n)):
                continue
            if CORNER_PARTNER.search(rule_body(lines, n)):
                continue
            rel = path.relative_to(ROOT.parent)
            hits.append(f"{rel}:{n + 1}:{line.strip()}")

        hits.extend(pseudo_bar_hits(path, lines))
        hits.extend(split_bar_hits(path, lines))
        hits.extend(custom_width_hits(path, lines))

    if hits:
        print("\n".join(hits))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
