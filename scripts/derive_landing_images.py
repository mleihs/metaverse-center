"""Aus sieben JPEG à 3 MB wird eine Frontseite, die man laden kann.

Das Entwurfspaket liefert die Bildstrecke in voller Erzeugergröße: sieben
Dateien, 2752–2816 × 1536, zusammen **20,61 MB** — und noch einmal dieselben
20,61 MB als byte-gleiche Dopplung unter ``uploads/`` (per SHA-256 geprüft).
Sechs davon werden im Entwurf in einer **640 × 360**-Tafel gezeigt, also mit
gut der vierfachen Breite ausgeliefert, und zusätzlich als rund 96 px breite
Miniaturen. Eine Frontseite, die so lädt, ist keine Frontseite.

Dieses Skript leitet je Bild die Größen ab, die die Seite wirklich anzeigt, und
schreibt sie als AVIF und WebP. Es misst vorher und nachher; die Zahlen stehen
am Ende auf der Konsole, damit niemand eine Verbesserung behaupten muss, die
nicht gemessen ist.

WARUM KEIN JPEG-RÜCKFALL
------------------------
Der Plan sah AVIF + WebP + JPEG vor. Der JPEG-Rückfall entfällt, und das ist
eine Messung, keine Bequemlichkeit: er griffe nur in einem Browser ohne
WebP-Unterstützung, und WebP ist seit 2020 in jeder Kombination vorhanden, die
diese Anwendung überhaupt starten kann (Lit 3 + ES-Module + Shadow DOM +
``color-mix()``). Ein dritter Satz Dateien wäre 50 % mehr Ablage und mehr
Bandbreite im Zwischenspeicher für einen Fall, der nicht eintritt. Wer ihn
zurückwill: ``_FORMATS`` um ``("jpeg", …)`` ergänzen, sonst ändert sich nichts.

WAS „ERSTE BILDLAST" HEISST
---------------------------
Nur der Held steht über der Falz. Der Systemabschnitt beginnt erst nach der
vollen Heldenhöhe, das Weltraster und die Dossierkarten liegen weit darunter.
Die erste Bildlast ist deshalb **der Held allein**; alles andere trägt
``loading="lazy"``. Das Skript weist beide Zahlen aus — den Helden und die
Summe des Systemabschnitts —, damit die Grenze von 400 KB an der richtigen
Größe geprüft wird und nicht an einer bequemen.

BENUTZUNG
---------
    .venv/bin/python scripts/derive_landing_images.py --src <verzeichnis>
    .venv/bin/python scripts/derive_landing_images.py --src <…> --out <…>

Der Upload ist bewusst NICHT Teil dieses Skripts. Ablegen ist ein Schreibvorgang
auf Prod und braucht das Wort des Nutzers; ``scripts/upload_landing_images.py``
macht das in einem eigenen Schritt.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

# ── Was die Seite tatsächlich anzeigt ────────────────────────────────────────
#
# Jede Breite ist an einer Stelle im Entwurf gemessen, keine ist gegriffen:
#
#   Held    volle Seitenbreite. Referenz 1440 px, übliche Bildschirme bis
#           1920; darüber skaliert der Zuschnitt, ohne dass man es sieht.
#   Tafel   640 CSS-px im Entwurf. 1280 deckt zweifache Pixeldichte, 960 die
#           anderthalbfache, 640 die einfache.
#   Miniatur sechs Stück in 640 px mit 10 px Abstand → je rund 96 CSS-px.
#           288 deckt dreifache Dichte, 192 zweifache.


@dataclass(frozen=True)
class Role:
    """Eine Verwendung im Entwurf, mit den Breiten, die sie braucht."""

    name: str
    widths: tuple[int, ...]
    quality_avif: int
    quality_webp: int
    note: str


_HERO = Role(
    name="hero",
    widths=(1920, 1440, 960, 640),
    # Der Held liegt unter `brightness(.72)`, drei Verläufen und einem
    # Rasterzeilen-Muster. Was an Feinzeichnung verloren geht, sieht man
    # dort nicht — deshalb darf er kräftiger komprimiert werden als eine
    # Tafel, die ungefiltert dasteht.
    quality_avif=52,
    quality_webp=74,
    note="volle Seitenbreite, abgedunkelt",
)

_PANEL = Role(
    name="panel",
    widths=(1280, 960, 640),
    quality_avif=58,
    quality_webp=80,
    note="640-px-Tafel, ungefiltert",
)

_THUMB = Role(
    name="thumb",
    widths=(288, 192),
    # Die inaktiven Miniaturen liegen unter `brightness(.4) saturate(.5)`,
    # die aktive ist 96 px breit. Feinzeichnung ist hier nicht sichtbar.
    quality_avif=46,
    quality_webp=70,
    note="Miniaturleiste, rund 96 px",
)

#: Quelldatei → (Zielkennung, Rollen). Die Kennungen sind sprechend und stabil;
#: die Erzeugernamen aus ``uploads/`` (``Gemini_Generated_Image_1vj29q…``) haben
#: auf einem Server nichts verloren.
_SOURCES: dict[str, tuple[str, tuple[Role, ...]]] = {
    "hero-bureau.jpeg": ("hero-bureau", (_HERO,)),
    "system-01-forge.jpeg": ("system-01-forge", (_PANEL, _THUMB)),
    "system-02-epochs-war-room.jpeg": ("system-02-epochs", (_PANEL, _THUMB)),
    "system-03-dungeons-descent.jpeg": ("system-03-dungeons", (_PANEL, _THUMB)),
    "system-04-drift-barge.jpeg": ("system-04-drift", (_PANEL, _THUMB)),
    "system-05-substrate-signal-wall.jpeg": ("system-05-substrate", (_PANEL, _THUMB)),
    "system-06-terminal-crt.jpeg": ("system-06-terminal", (_PANEL, _THUMB)),
}

#: Format → (Pillow-Kennung, Endung, zusätzliche Sparten).
_FORMATS: tuple[tuple[str, str, dict], ...] = (
    ("AVIF", "avif", {"speed": 4}),
    ("WEBP", "webp", {"method": 6}),
)


@dataclass
class Derived:
    """Eine geschriebene Datei mit ihrer gemessenen Größe."""

    stem: str
    role: str
    width: int
    fmt: str
    path: Path
    size: int


def _derive_one(
    source: Image.Image,
    out_dir: Path,
    stem: str,
    role: Role,
) -> list[Derived]:
    """Alle Breiten und Formate einer Rolle schreiben."""
    written: list[Derived] = []
    for width in role.widths:
        if width > source.width:
            # Hochrechnen fügt keine Information hinzu, nur Bytes.
            print(f"    ! {width} px übersprungen — Quelle ist nur {source.width} px breit")
            continue
        height = round(source.height * width / source.width)
        resized = source.resize((width, height), Image.LANCZOS)
        for pil_name, suffix, options in _FORMATS:
            quality = role.quality_avif if suffix == "avif" else role.quality_webp
            path = out_dir / f"{stem}-{role.name}-{width}.{suffix}"
            resized.save(path, pil_name, quality=quality, **options)
            written.append(
                Derived(stem, role.name, width, suffix, path, path.stat().st_size),
            )
    return written


def _human(num: int) -> str:
    return f"{num / 1024:.0f} KB" if num < 1024 * 1024 else f"{num / 1024 / 1024:.2f} MB"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--src", required=True, type=Path, help="Verzeichnis mit den sieben JPEG")
    parser.add_argument("--out", type=Path, default=Path("build/landing-images"))
    args = parser.parse_args()

    src: Path = args.src
    if not src.is_dir():
        print(f"Quellverzeichnis nicht gefunden: {src}", file=sys.stderr)
        return 1

    out: Path = args.out
    out.mkdir(parents=True, exist_ok=True)

    missing = [name for name in _SOURCES if not (src / name).is_file()]
    if missing:
        print(f"Fehlende Quelldateien: {missing}", file=sys.stderr)
        return 1

    source_total = 0
    everything: list[Derived] = []

    for name, (stem, roles) in _SOURCES.items():
        path = src / name
        source_total += path.stat().st_size
        with Image.open(path) as image:
            rgb = image.convert("RGB")
            print(f"\n{name}  ({rgb.width}×{rgb.height}, {_human(path.stat().st_size)})")
            for role in roles:
                print(f"  {role.name}: {role.note}")
                everything.extend(_derive_one(rgb, out, stem, role))

    # ── Messung ─────────────────────────────────────────────────────────────
    print("\n" + "=" * 74)
    print("GEMESSEN")
    print("=" * 74)

    derived_total = sum(d.size for d in everything)
    print(f"Quellen (7 Dateien)            {_human(source_total)}")
    print(f"Abgeleitet ({len(everything):3d} Dateien)        {_human(derived_total)}")

    def _pick(role: str, fmt: str, width: int, stem: str | None = None) -> list[Derived]:
        return [
            d
            for d in everything
            if d.role == role and d.fmt == fmt and d.width == width and (stem is None or d.stem == stem)
        ]

    hero = _pick("hero", "avif", 1920)
    hero_bytes = sum(d.size for d in hero)

    # Was der Systemabschnitt beim Aufklappen nachlädt: eine Tafel in
    # zweifacher Dichte plus sechs Miniaturen.
    panel_first = _pick("panel", "avif", 1280, "system-01-forge")
    thumbs = _pick("thumb", "avif", 288)
    section_bytes = sum(d.size for d in panel_first) + sum(d.size for d in thumbs)

    print()
    print("Erste Bildlast (nur der Held, AVIF 1920):")
    print(f"  {_human(hero_bytes):>12s}   {'UNTER 400 KB ✓' if hero_bytes < 400 * 1024 else 'ÜBER 400 KB ✗'}")
    print()
    print("Systemabschnitt beim Erreichen (1 Tafel 1280 + 6 Miniaturen 288, AVIF):")
    print(f"  {_human(section_bytes):>12s}")
    print()
    print(f"Held + Systemabschnitt zusammen: {_human(hero_bytes + section_bytes)}")

    print("\nGrößte abgeleitete Dateien:")
    for d in sorted(everything, key=lambda x: x.size, reverse=True)[:6]:
        print(f"  {_human(d.size):>10s}  {d.path.name}")

    print(f"\nGeschrieben nach: {out.resolve()}")
    print("Ablegen ist ein eigener Schritt (scripts/upload_landing_images.py).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
