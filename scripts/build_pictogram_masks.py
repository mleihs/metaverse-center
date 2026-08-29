#!/usr/bin/env python3
"""Leitet aus den freigestellten Piktogramm-Mastern die UI-Masken ab.

Die Kette hat drei Stufen und dieses Skript ist die dritte:

    Gemini-Magenta  ->  key_dungeon_enemy_art.py  ->  AVIF-Master (1024 px)
                    ->  build_pictogram_masks.py  ->  PNG-Maske (128 px)

Warum eine dritte Stufe und nicht die Master direkt einbinden: die Master sind
1024 px lang und zusammen rund 550 KB, die Knoepfe zeigen 28 px. Und die
Kampfleiste bindet die Datei als CSS `mask-image` ein, wo ausschliesslich der
Alphakanal zaehlt — die Farbe kommt aus den Design-Tokens. Ein LA-PNG mit
konstantem Weisskanal ist damit die kleinste Form, die alles traegt: 19 Dateien,
zusammen 60 KB.

Der Dateiname ist der Vertrag zum Code. Er muss der `id` aus
`content/dungeon/abilities/*.yaml` entsprechen und in der Liste in
`frontend/src/utils/ability-pictograms.ts` stehen; ohne Eintrag dort faellt der
Knopf auf seine Textfassung zurueck, statt leer zu rendern.

Ziel ist `frontend/public/` und nicht `src/assets/`, weil Vite den Ordner
unveraendert und unter stabiler URL ausliefert — die Masken werden aus CSS
heraus referenziert, nicht importiert, also darf der Bundler sie nicht
umbenennen. `*.png` ist global gitignored; die Ausnahme dafuer steht in
`.gitignore`.

Benutzung:
    .venv/bin/python scripts/build_pictogram_masks.py
    .venv/bin/python scripts/build_pictogram_masks.py --check   # nur pruefen
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "assets/ui-pictograms"
TARGET_DIR = ROOT / "frontend/public/ui-pictograms"
#: Kantenlaenge der Maske. Der Glyph zeigt 28 px, auf einem 2x-Display 56 px;
#: 128 px laesst Luft nach oben und kostet je Datei nur rund 3 KB.
MASK_PX = 128


def build_mask(src: Path, dst: Path) -> int:
    """Schreibt eine LA-Maske und gibt ihre Groesse in Bytes zurueck."""
    with Image.open(src) as im:
        rgba = im.convert("RGBA")
        rgba.thumbnail((MASK_PX, MASK_PX), Image.LANCZOS)
        # Weiss deckend, Form allein im Alphakanal: mask-image liest nur Alpha.
        mask = Image.new("LA", rgba.size, (255, 0))
        mask.putalpha(rgba.getchannel("A"))
        mask.save(dst, optimize=True)
    return dst.stat().st_size


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument(
        "--check",
        action="store_true",
        help="nichts schreiben, nur melden was fehlt oder veraltet ist",
    )
    args = ap.parse_args()

    masters = sorted(SOURCE_DIR.glob("*.avif"))
    if not masters:
        print(f"Keine Master in {SOURCE_DIR}. Erst freistellen.", file=sys.stderr)
        return 1

    if args.check:
        stale = [
            m.stem
            for m in masters
            if not (TARGET_DIR / f"{m.stem}.png").exists()
            or (TARGET_DIR / f"{m.stem}.png").stat().st_mtime < m.stat().st_mtime
        ]
        if stale:
            print(f"{len(stale)} Maske(n) fehlen oder sind aelter als ihr Master:")
            for name in stale:
                print(f"  {name}")
            return 1
        print(f"{len(masters)} Masken aktuell.")
        return 0

    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    total = 0
    for master in masters:
        total += build_mask(master, TARGET_DIR / f"{master.stem}.png")
    print(f"{len(masters)} Masken à {MASK_PX} px, {total / 1024:.0f} KB gesamt -> {TARGET_DIR}")

    # Verwaiste Masken melden statt still loeschen: eine ueberzaehlige Datei ist
    # meist eine umbenannte Faehigkeit und will gesehen werden.
    known = {m.stem for m in masters}
    orphans = sorted(p.stem for p in TARGET_DIR.glob("*.png") if p.stem not in known)
    if orphans:
        print(f"⚠ {len(orphans)} Maske(n) ohne Master: {', '.join(orphans)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
