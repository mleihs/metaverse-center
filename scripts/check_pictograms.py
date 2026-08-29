#!/usr/bin/env python3
"""Prüft generierte Piktogramme gegen die zwei Kennzahlen, die bei 24 px entscheiden.

Ein Piktogramm für die Kampfleiste wird bei 22–28 CSS-px gezeigt. Ob es dort
trägt, entscheidet sich nicht am Motiv, sondern an zwei messbaren Größen — und
beide lassen sich am Magenta-Original ablesen, bevor irgendetwas eingebunden ist:

    DECKUNG   Wieviel Prozent der Fläche ist Form. Gemessen an den ersten fünf
              Generierungen: ab etwa 36 % bleibt für Schnitte kein Platz mehr,
              und die Form fällt beim Verkleinern zum Klumpen zusammen.

    AUSSPARUNG  Die Breite der schmalsten Schnitte — Fingerschlitze, Ritzen,
              Löcher. Unter etwa 1,4 px bei 24 px Darstellung schließen sie sich
              und das Innenleben verschwindet. Bei wycinanki trägt das Negative
              die Bedeutung, also ist das die härtere der beiden Grenzen.

Was das Skript NICHT prüft: ob das Motiv das Richtige zeigt. Eine Sichel, die
technisch perfekt ist und wie ein Vorhängeschloss aussieht, besteht hier —
und ist trotzdem falsch. Dafür ist das Kontaktbogen-PNG da.

Benutzung:
    .venv/bin/python scripts/check_pictograms.py <ordner> [--out kontakt.png]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

#: Ab dieser Deckung erstickt die Form ihre eigenen Schnitte (gemessen, s. o.).
MAX_INK_SHARE = 0.36
#: Schmalste Aussparung, umgerechnet auf die Zielgröße. Darunter schließt sie sich.
MIN_GAP_PX_AT_TARGET = 1.4
#: Größe, bei der abgenommen wird — die Kampfleiste zeigt 22–28 CSS-px.
TARGET_PX = 24
#: Rand, den das Motiv rundum lassen soll.
MARGIN_RANGE = (0.06, 0.18)

CONTACT_SIZES = (24, 32, 48, 96)


def keyed_alpha(path: Path) -> tuple[np.ndarray, int]:
    """Alpha-Maske aus dem Magenta-Original: True = Form, False = Grund."""
    with Image.open(path) as im:
        rgb = np.asarray(im.convert("RGB")).astype(int)
    magenta = (rgb[:, :, 0] > 175) & (rgb[:, :, 1] < 120) & (rgb[:, :, 2] > 175)
    return ~magenta, rgb.shape[1]


def interior_gaps(shape: np.ndarray) -> np.ndarray:
    """Breiten aller Grund-Läufe INNERHALB der Bounding-Box, zeilenweise.

    Nur innerhalb der Box: der Rand außen ist kein Schnitt, sondern Luft.
    """
    ys, xs = np.where(shape)
    if len(xs) == 0:
        return np.array([0])
    inner = ~shape[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    runs: list[int] = []
    for row in inner:
        run = 0
        for filled in row:
            if filled:
                run += 1
            elif run:
                runs.append(run)
                run = 0
    return np.array(runs) if runs else np.array([0])


def measure(path: Path) -> dict:
    shape, width = keyed_alpha(path)
    ys, xs = np.where(shape)
    if len(xs) == 0:
        return {"name": path.stem, "error": "keine Form gefunden — Magenta-Grund prüfen"}

    gaps = interior_gaps(shape)
    gap_px = float(np.median(gaps)) / width * TARGET_PX
    ink = float(shape.mean())
    h, w = shape.shape
    margins = (xs.min() / w, (w - xs.max()) / w, ys.min() / h, (h - ys.max()) / h)

    problems = []
    if ink > MAX_INK_SHARE:
        problems.append(f"zu massiv ({ink * 100:.0f}% Deckung)")
    if gap_px < MIN_GAP_PX_AT_TARGET:
        problems.append(f"Schnitte zu eng ({gap_px:.2f}px bei {TARGET_PX}px)")
    if min(margins) < MARGIN_RANGE[0]:
        problems.append(f"Rand zu knapp ({min(margins) * 100:.0f}%)")
    if max(margins) > MARGIN_RANGE[1]:
        problems.append(f"Motiv zu klein im Rahmen ({max(margins) * 100:.0f}% Rand)")

    return {
        "name": path.stem,
        "ink": ink,
        "gap_px": gap_px,
        "narrow_share": float((gaps < width / 16).mean()),
        "margins": margins,
        "problems": problems,
        "shape": shape,
    }


def contact_sheet(results: list[dict], out: Path) -> None:
    """Alle Piktogramme in echten UI-Größen auf Schwarz, 3x vergrößert dargestellt."""
    usable = [r for r in results if "shape" in r]
    if not usable:
        return
    pad = 10
    row_h = max(CONTACT_SIZES)
    sheet = Image.new(
        "RGBA",
        (sum(s + pad for s in CONTACT_SIZES) + pad, (row_h + pad) * len(usable) + pad),
        (10, 10, 10, 255),
    )
    for i, r in enumerate(usable):
        alpha = (r["shape"] * 255).astype("uint8")
        rgba = np.dstack([np.full_like(alpha, 239), np.full_like(alpha, 233), np.full_like(alpha, 222), alpha])
        cut = Image.fromarray(rgba, "RGBA")
        x, y = pad, pad + i * (row_h + pad)
        for size in CONTACT_SIZES:
            sheet.alpha_composite(cut.resize((size, size), Image.LANCZOS), (x, y + (row_h - size) // 2))
            x += size + pad
    sheet = sheet.resize((sheet.width * 3, sheet.height * 3), Image.NEAREST)
    sheet.save(out)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder", type=Path)
    ap.add_argument("--out", type=Path, default=None, help="Kontaktbogen-PNG (Standard: <ordner>/_kontakt.png)")
    args = ap.parse_args()

    files = sorted(
        p for p in args.folder.iterdir() if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"} and not p.name.startswith("_")
    )
    if not files:
        print(f"Keine Bilder in {args.folder}")
        return 1

    results = [measure(p) for p in files]
    failed = 0
    print(f"{'':2} {'Datei':30} {'Deckung':>8} {'Aussparung':>11} {'zu eng':>7}  Befund")
    for r in results:
        if "error" in r:
            print(f"{'!!':2} {r['name']:30} {r['error']}")
            failed += 1
            continue
        mark = "OK" if not r["problems"] else "!!"
        if r["problems"]:
            failed += 1
        print(
            f"{mark:2} {r['name']:30} {r['ink'] * 100:7.0f}% {r['gap_px']:9.2f}px {r['narrow_share'] * 100:6.0f}%  "
            + "; ".join(r["problems"])
        )

    out = args.out or args.folder / "_kontakt.png"
    contact_sheet(results, out)
    print(f"\n{len(results) - failed}/{len(results)} bestanden. Kontaktbogen: {out}")
    print("Der Kontaktbogen entscheidet den Rest: ein Motiv kann alle Zahlen erfüllen")
    print("und trotzdem das Falsche zeigen.")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
