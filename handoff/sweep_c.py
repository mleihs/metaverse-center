#!/usr/bin/env python3
"""Sweep C — replace hard-coded `rgba(255, 255, 255, X)` panel tints with the
three ink-overlay tokens (`--color-overlay-ink[-strong]`, `--color-scanline`).

99 hits split into three genuinely different things, found by reading each one
in context rather than by alpha value alone:

  SCANLINE (14 declarations, ~28 stops) — a `repeating-linear-gradient` CRT
  texture. Every rgba(255...) stop inside one → var(--color-scanline),
  regardless of its exact alpha (0.008-0.04 all read as the same faint hatch;
  snapping them to one token is design-system consolidation, not a visible
  regression — unlike Sweep B's shadow alpha, this isn't a measured contrast
  value).

  SHIMMER (9 declarations) — a moving highlight sweep: a `linear-gradient`
  or `radial-gradient` from transparent through white back to transparent,
  paired with a NAMED animation (`launch-shimmer`, `phase-sweep`,
  `cooldown-sweep`, `shimmer-sweep`, `btn-shimmer`) or `mix-blend-mode:
  overlay` (a mouse-follow reflection). This is deliberately LIGHT, not ink —
  the same exception the design package itself calls out for
  forge-console-styles and VelgForgeCeremony (2 of the 9 already carry
  `lint-color-ok`). Left as rgba(255...), tagged `lint-color-ok` if not
  already.

  INK (the rest) — a flat panel tint, inset sheen, or hairline. Bucketed by
  alpha: <=0.03 -> --color-overlay-ink (4%), 0.04-0.08 ->
  --color-overlay-ink-strong (8%). A handful of outliers above 0.08 are not
  panel tints at all (a bright edge-accent bar, an SVG minimap stroke, a
  filled-bar highlight) and are excluded — see OUTLIERS below, written to the
  restliste instead of guessed at.

LoreScroll.ts is out of scope: its 11 `--lore-*` values were consolidated by
hand (single declaration block, 67 call sites) before this script ran.

⚠ KNOWN BUG, fixed by hand after the one run this script ever made (do not
re-run against the committed tree without fixing this first): SHIMMER_MARKERS
gates by FILE, not by declaration. `DesperateActionsPanel.ts` carries both a
genuine shimmer sweep (`.action--cooldown::after`) and an unrelated flat
`.panel__dismiss:hover` tint — the file-level gate mis-tagged the unrelated
tint as shimmer too. Fixed by hand: that one line moved to
`var(--color-overlay-ink-strong)`, the correct shimmer siblings kept their
tag. Also: the per-line tagging pass (`line.rstrip().endswith(';')`) misses a
shimmer value split across lines (VelgGameCard.ts's radial-gradient,
VelgStyleReferenceUpload.ts's linear-gradient) — those two got their
`lint-color-ok` comment added by hand afterwards, values unchanged.
"""
import re, sys, pathlib

ROOT = pathlib.Path("src")

# (file, line-ish substring) pairs that are NOT panel tints — read individually
# during the audit, excluded so the generic bucket logic doesn't guess at them.
# Written to handoff/atlas-sweep-c-restliste-2026-09-03.md instead.
OUTLIERS = {
    ("how-to-play/htp-styles.ts", "background: rgba(255 255 255 / 0.4)"),
    ("multiverse/MapMinimap.ts", "stroke: rgba(255, 255, 255, 0.3)"),
    ("shared/VelgAptitudeBars.ts", "rgba(255 255 255 / 0.15)"),
    ("archetypes/ArchetypeDetailView.ts", "rgba(255, 26, 26, 0.5)"),  # not white
    ("shared/VelgGameCard.ts", "rgba(255,100,100,0.1)"),  # not white
}

# Shimmer declarations already reviewed by hand (file substring is enough —
# each occurs once per file at this alpha/gradient combination).
SHIMMER_MARKERS = (
    "forge-console-styles.ts",
    "VelgForgeCeremony.ts",
    "VelgStyleReferenceUpload.ts",
    "VelgGameCard.ts",  # .card__reflection radial mouse-follow, mix-blend-mode: overlay
    "VelgForgeWizard.ts",  # .phase--active::after sweep, named animation
    "DesperateActionsPanel.ts",  # .action--cooldown::after sweep, named animation
    "BleedGazetteSidebar.ts",  # warm parchment tint (255,248,230), not neutral ink
)

RGBA_WHITE = re.compile(
    r"rgba\(\s*255[,\s]+255[,\s]+255[,\s/]+([\d.]+)\s*\)"
)


def is_outlier(path_str: str, line_text: str) -> bool:
    for frag, needle in OUTLIERS:
        if path_str.endswith(frag) and needle in line_text:
            return True
    return False


def bucket(alpha: float) -> str | None:
    if alpha <= 0.03:
        return "--color-overlay-ink"
    if alpha <= 0.08:
        return "--color-overlay-ink-strong"
    return None  # outlier — leave for the restliste


def process_file(p: pathlib.Path, apply: bool) -> tuple[int, int, int]:
    txt = orig = p.read_text()
    is_shimmer_file = any(m in str(p) for m in SHIMMER_MARKERS)

    scan_n = ink_n = tagged_n = 0

    # Pass 1: scanline stops — any rgba(255...) inside a value that also
    # contains `repeating-linear-gradient(`.
    def scanline_repl(decl_m: re.Match) -> str:
        nonlocal scan_n
        prop, value = decl_m.group(1), decl_m.group(2)
        if "repeating-linear-gradient(" not in value:
            return decl_m.group(0)

        def sub(m: re.Match) -> str:
            nonlocal scan_n
            scan_n += 1
            return "var(--color-scanline)"

        new_value = RGBA_WHITE.sub(sub, value)
        return f"{prop}: {new_value};"

    txt = re.sub(r"([\w-]+)\s*:\s*([^;{}]+);", scanline_repl, txt)

    if is_shimmer_file:
        # Pass 2 (shimmer files only): tag any remaining un-tagged rgba(255...)
        # with `lint-color-ok` if the line doesn't already carry the marker.
        lines = txt.split("\n")
        for i, line in enumerate(lines):
            if RGBA_WHITE.search(line) and "lint-color-ok" not in line and line.rstrip().endswith(";"):
                lines[i] = line.rstrip()[:-1] + "; /* lint-color-ok — shimmer, deliberately light */"
                tagged_n += 1
        txt = "\n".join(lines)
    else:
        # Pass 3: generic ink bucket for everything else, skipping outliers.
        line_starts = [0]
        for ch in txt:
            pass
        # recompute per-declaration to know the source line for outlier checks
        def ink_repl(decl_m: re.Match) -> str:
            nonlocal ink_n
            prop, value = decl_m.group(1), decl_m.group(2)
            if "rgba(255" not in value.replace(" ", ""):
                return decl_m.group(0)
            line_no = txt[: decl_m.start()].count("\n") + 1
            line_text = txt.split("\n")[line_no - 1]
            if is_outlier(str(p), line_text):
                return decl_m.group(0)

            def sub(m: re.Match) -> str:
                nonlocal ink_n
                alpha = float(m.group(1))
                token = bucket(alpha)
                if token is None:
                    return m.group(0)  # unbucketed outlier not in the manual list — leave
                ink_n += 1
                return f"var({token})"

            new_value = RGBA_WHITE.sub(sub, value)
            return f"{prop}: {new_value};"

        txt = re.sub(r"([\w-]+)\s*:\s*([^;{}]+);", ink_repl, txt)

    if apply and txt != orig:
        p.write_text(txt)
    return scan_n, ink_n, tagged_n


def main() -> int:
    apply = "--apply" in sys.argv
    total_scan = total_ink = total_tag = 0
    files_touched = 0
    for p in sorted(list(ROOT.rglob("*.ts")) + list(ROOT.rglob("*.css"))):
        if str(p).endswith("LoreScroll.ts"):
            continue
        s, i, t = process_file(p, apply)
        if s or i or t:
            files_touched += 1
            total_scan += s
            total_ink += i
            total_tag += t
    print(f"{'APPLIED' if apply else 'DRY RUN'} — {files_touched} Dateien")
    print(f"  {total_scan:4d}  Scanline-Stops -> var(--color-scanline)")
    print(f"  {total_ink:4d}  Ink-Stellen -> var(--color-overlay-ink[-strong])")
    print(f"  {total_tag:4d}  Shimmer neu mit lint-color-ok markiert")
    return 0

sys.exit(main())
