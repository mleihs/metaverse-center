#!/usr/bin/env python3
"""Sweep B — replace hard-coded black in box-shadow with `--color-shadow`.

The 19 hits split into two shapes that the design package did not distinguish:

  OFFSET shapes (`Npx Npx 0 rgba(0,0,0,X)`, 3 hits, SimulationCard.ts) match
  the brutalist --shadow-* scale exactly in offset, but NOT in alpha — the
  scale's tokens are opaque (`var(--color-shadow)`, no alpha channel). Forcing
  them onto `var(--shadow-md)` would make the card shadows fully opaque
  instead of 30-50% translucent, a visible regression the package's own
  acceptance criterion ("Dark skin stays pixel-identical") forbids.

  BLUR shapes (`0 Ypx Zpx rgba(0,0,0,X)`, 16 hits) are elevation shadows for
  floating panels (modals, tooltips, lightboxes) and are not offset shadows
  at all — they were never candidates for the --shadow-* scale.

Both shapes get the same fix: swap the hard-coded colour for a token-derived
one that reproduces the EXACT same pixel today. `color-mix(in srgb,
var(--color-shadow) X%, transparent)` where --color-shadow defaults to
#000000 is mathematically identical to `rgba(0, 0, 0, X)` — so this sweep
changes zero pixels on the dark chrome and only becomes visible once a skin
recolours --color-shadow (Atlas: ink #17201d instead of black).
"""
import re, sys, pathlib

ROOT = pathlib.Path("src")

RGBA_BLACK = re.compile(r"rgba\(\s*0,?\s*0,?\s*0,?\s*([\d.]+)\s*\)")
HEX_BLACK = re.compile(r"#000000\b")


def fix_value(value: str) -> tuple[str, int]:
    n = 0

    def repl(m: re.Match) -> str:
        nonlocal n
        n += 1
        alpha = float(m.group(1))
        pct = alpha * 100
        pct_str = f"{pct:g}"
        return f"color-mix(in srgb, var(--color-shadow) {pct_str}%, transparent)"

    value, k = RGBA_BLACK.subn(repl, value)
    n += k
    value, k = HEX_BLACK.subn("var(--color-shadow)", value)
    n += k
    return value, n


def main() -> int:
    apply = "--apply" in sys.argv
    counts, files_touched = 0, 0
    for p in sorted(list(ROOT.rglob("*.ts")) + list(ROOT.rglob("*.css"))):
        txt = orig = p.read_text()
        while True:
            hit = None
            for cand in re.finditer(r"\bbox-shadow\s*:\s*([^;]+);", txt):
                new_value, n = fix_value(cand.group(1))
                if n:
                    hit = (cand, new_value)
                    break
            if not hit:
                break
            cand, new_value = hit
            counts += 1  # per matched box-shadow declaration edited (loop below counts components)
            txt = txt[: cand.start(1)] + new_value + txt[cand.end(1):]
        if txt != orig:
            files_touched += 1
            if apply:
                p.write_text(txt)
    print(f"{'APPLIED' if apply else 'DRY RUN'} — {files_touched} Dateien mit Aenderungen")
    return 0

sys.exit(main())
