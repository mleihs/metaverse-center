"""Aus den Erzeugerbildern wird eine Frontseite, die man laden kann.

Das Entwurfspaket lieferte die Bildstrecke in voller Erzeugergröße: sieben
Dateien, 2752–2816 × 1536, zusammen **20,61 MB** — und noch einmal dieselben
20,61 MB als byte-gleiche Dopplung unter ``uploads/`` (per SHA-256 geprüft).
Sechs davon werden im Entwurf in einer **640 × 360**-Tafel gezeigt, also mit
gut der vierfachen Breite ausgeliefert, und zusätzlich als rund 96 px breite
Miniaturen. Eine Frontseite, die so lädt, ist keine Frontseite.

Seit dem 04.09.2026 kommt eine ACHTE Quelle dazu, der Anmeldesaal der
Atlas-Frontseite: 1792 × 2400, hochkant, als einzige nicht quer. Sie ist der
Grund, warum die Zahlen oben in der Vergangenheitsform stehen — sie
beschreiben das ursprüngliche Paket, nicht den heutigen Bestand. Wie viele
Quellen ein Lauf wirklich verlangt, sagt ``--only``; wie viele er gefunden
hat, sagt die Messung am Ende. Keine dieser Zahlen steht mehr fest im Text.

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
    .venv/bin/python scripts/derive_landing_images.py --src <…> --only hero-intake-hall

WARUM ES ``--only`` GIBT
------------------------
Die erste Fassung verlangte alle Quellen. Das stimmte an dem Tag, an dem das
Entwurfspaket ankam und alles auf der Platte lag. Danach nicht mehr: abgeleitet
wird einmal, die Ergebnisse liegen im Storage, die Erzeugerdateien sind weg.
Ein später nachgereichtes Bild wäre so nur abzuleiten gewesen, indem man sechs
Dateien beschafft, die niemand mehr braucht.

``--only`` wählt nach ZIELKENNUNG, nicht nach Dateiname: die Kennung ist das
Stabile (sie steht in ``landing-images.ts``), der Dateiname der Quelle ist
Zufall des Erzeugers. Dieser Absatz stand bis zum 05.09.2026 in einer nackten
Zeichenkette mitten in ``main()`` — die ist kein Docstring (nur die ERSTE
Anweisung einer Funktion ist einer), kompiliert zu nichts und war für
``--help`` unerreichbar. Hier steht er, weil ``--help`` genau hier hinsieht.

Der Upload ist bewusst NICHT Teil dieses Skripts. Ablegen ist ein Schreibvorgang
auf Prod und braucht das Wort des Nutzers; ``scripts/upload_landing_images.py``
macht das in einem eigenen Schritt.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
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
    """Eine Verwendung im Entwurf, mit den Breiten, die sie braucht.

    ``aspect`` schneidet die Quelle VOR dem Verkleinern auf ein Seitenverhaeltnis
    zu. Ohne das gaebe es nur einen Weg, ein 3:4-Bild in einen 16:9-Rahmen zu
    bekommen: `object-fit: cover` im Browser — und der laedt dann die vollen
    Pixel und wirft 58 % davon weg. Ein Zuschnitt beim Ableiten kostet
    stattdessen nichts und trifft die Wahl dort, wo man sie sehen kann.

    ``anchor`` ist die senkrechte Mitte des Ausschnitts als Bruchteil der
    Hoehe. 0,5 ist die Bildmitte; kleiner heisst weiter oben. Fuer den
    Anmeldesaal steht hier 0,42, damit das Gewoelbe ganz im Bild bleibt und die
    Figur auf der Galerie ins untere Drittel rutscht.
    """

    name: str
    widths: tuple[int, ...]
    quality_avif: int
    quality_webp: int
    note: str
    aspect: float | None = None
    anchor: float = 0.5


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

_HERO_PORTRAIT = Role(
    name="heroPortrait",
    # Die Tafel steht in der 4fr-Spalte eines `8fr 4fr`-Rasters mit
    # `gap: var(--space-12)` (48 px) innerhalb von `--stage-measure`.
    #
    # GERECHNET, nicht geschaetzt:
    #     Tafel = (min(V, 1920) - 2 * Rinne - 48) / 3
    # Bei V = 1728 ist die Rinne 48 (die 1920er Abfrage hat noch nicht
    # gegriffen), also (1728 - 96 - 48) / 3 = 528 CSS-px = 30,6 vw.
    #
    # Hier stand bis zum 05.09.2026 "438 CSS-px, rund 25 vw". 438 px loest die
    # Gleichung nach einem Fenster von rund 1457 px auf — das ist die Zahl, die
    # herauskommt, wenn die Entwicklerwerkzeuge angedockt sind und das
    # Ansichtsfenster schmaler ist als der Bildschirm. Die Folge stand im
    # `sizes`: 26 vw deklarierte 899 statt 1056 Geraetepixel, der Browser nahm
    # die 960er Stufe und rechnete sie um 1,10 hoch — auf genau dem Geraet, an
    # dem gemessen wurde, und fuer eine Federzeichnung, deren eigener Kommentar
    # sagt, dass sie jeden Kompressionsfehler zeigt.
    #
    # 1200 ist neu und ist der Grund, warum die Stufen nicht mehr um den Faktor
    # 1,5 springen: zwischen 960 und 1440 landet JEDER doppelt dichte Schirm
    # und jedes dreifach dichte Telefon. Gemessen kostet 1200 rund 253 KB statt
    # 364 KB — bei einem Bedarf von 1056 Geraetepixeln ist es ausserdem die
    # kleinere PASSENDE Stufe, nicht die naechstgroessere Ausweichstufe.
    widths=(1440, 1200, 960, 640),
    # Anders als der quere Held liegt diese Tafel NICHT unter `brightness(.72)`
    # und drei Verlaeufen, sondern nur unter einem Raster und einem
    # Scan-Streifen. Eine Federzeichnung mit dieser Strichdichte zeigt jeden
    # Kompressionsfehler, deshalb naeher an der Tafel-Qualitaet als am Helden.
    # GEMESSEN am 04.09.2026 an genau diesem Bild (1792 x 2400, Federzeichnung
    # mit dichter Schraffur — teuer zu komprimieren):
    #     1440px  q58 = 449 KB   q52 = 364 KB   q46 = 280 KB
    # Die Grenze des Hauses fuer die erste Bildlast ist 400 KB. q58 reisst sie,
    # q52 nicht — und q52 ist dieselbe Stufe, die der quere Held schon faehrt.
    quality_avif=52,
    # 80 stand hier, weil es die Zahl der Tafel ist — und die Absicht darueber
    # sagt "naeher an der Tafel-Qualitaet als am Helden". Nur: bei DIESER
    # Bildgroesse ist 80 keine Qualitaetsstufe mehr, sondern ein Bruch der
    # Hausgrenze. GEMESSEN auf Prod: `…-heroPortrait-1440.webp` = 614 660 B,
    # also 150 % der 400 KB, die fuer die erste Bildlast gelten. Genau diese
    # Datei bekommt jeder Browser ohne AVIF (Safari/iOS <= 16.3), ueber der
    # Falz und mit `fetchpriority="high"`.
    #
    # Unsichtbar war es, weil die Budget-Probe unten nur AVIF gelesen hat. Sie
    # liest jetzt jedes Format der Leiter.
    quality_webp=72,
    note="3:4-Tafel der Atlas-Frontseite",
)

_HERO_WIDE = Role(
    name="heroWide",
    # Der Anmeldesaal fuer den gestapelten Entwurf unter 1023 px.
    #
    # WARUM ES DIESE ROLLE GIBT. Der Rahmen kippt dort auf `aspect-ratio: 16/9`
    # — richtig, solange der Held quer war, und seit dem 04.09.2026 falsch: die
    # neue Quelle ist 3:4, und `object-fit: cover` schnitt 58 % der Zeichnung
    # weg. Das ist genau der Beschnitt, gegen den die Rolle `heroPortrait`
    # ueberhaupt eingefuehrt wurde, nur spiegelverkehrt und auf dem Haltepunkt
    # mit dem meisten Verkehr.
    #
    # Der Zuschnitt hier kostet nichts und spart viel: ein Telefon laedt 1280
    # statt 1440 Pixel Breite bei 16:9 statt 3:4, also rund ein Drittel der
    # Flaeche. Gemessen ersetzt das 364 KB durch rund 90 KB.
    #
    # 1280 deckt 430 px bei dreifacher Dichte (1290) knapp — die naechste Stufe
    # waere 1440 und damit wieder die Hochkant-Groesse.
    widths=(1280, 960, 640),
    aspect=16 / 9,
    anchor=0.42,
    quality_avif=52,
    quality_webp=72,
    note="16:9-Zuschnitt fuer den gestapelten Entwurf",
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
    "hero-intake-hall.jpeg": ("hero-intake-hall", (_HERO_PORTRAIT, _HERO_WIDE)),
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


def _crop_to_aspect(source: Image.Image, role: Role) -> Image.Image:
    """Den Ausschnitt der Rolle aus der Quelle nehmen, oder sie unveraendert lassen."""
    if role.aspect is None:
        return source
    width, height = source.size
    wanted = round(width / role.aspect)
    if wanted >= height:
        # Die Quelle ist bereits flacher als verlangt. Dann waere ein
        # Zuschnitt in der Hoehe keiner, und in der Breite waere er eine
        # andere Entscheidung als die, die hier getroffen wurde.
        return source
    top = max(0, min(height - wanted, round(height * role.anchor - wanted / 2)))
    return source.crop((0, top, width, top + wanted))


class WidthUnavailableError(RuntimeError):
    """Eine erklaerte Breite laesst sich aus dieser Quelle nicht schreiben."""


def _derive_one(
    source: Image.Image,
    out_dir: Path,
    stem: str,
    role: Role,
) -> list[Derived]:
    """Alle Breiten und Formate einer Rolle schreiben.

    Eine Breite, die nicht geschrieben werden kann, ist ein FEHLER und keine
    Notiz. Vorher stand hier ein `continue` mit einer Zeile Ausgabe, und das
    Skript endete mit 0: das Frontend bewirbt jede erklaerte Stufe
    bedingungslos in `srcset`, ein Browser, der die fehlende waehlt, bekommt
    einen leeren Rahmen ohne Konsolenfehler, und betroffen sind nur dreifach
    dichte Telefone und breite Netzhautschirme — die schwerste denkbare Form,
    das zu bemerken. Wer eine schmalere Quelle einsetzt, soll es beim Ableiten
    erfahren, nicht beim Ausliefern.
    """
    cropped = _crop_to_aspect(source, role)
    written: list[Derived] = []
    for width in role.widths:
        if width > cropped.width:
            raise WidthUnavailableError(
                f"{stem}/{role.name}: {width} px erklaert, Quelle liefert nur "
                f"{cropped.width} px. Hochrechnen fuegt keine Information hinzu — "
                f"entweder eine breitere Quelle, oder die Breite aus `Role.widths` "
                f"und aus `LANDING_IMAGE_WIDTHS` streichen."
            )
        height = round(cropped.height * width / cropped.width)
        resized = cropped.resize((width, height), Image.LANCZOS)
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
    # `RawDescriptionHelpFormatter`, weil der Vorgabewert jeden Umbruch
    # entfernt und die Absaetze des Docstrings zu einem Block verruehrt — die
    # Ueberschriften und die Beispielaufrufe darin werden dabei unlesbar.
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--src",
        required=True,
        type=Path,
        help="Verzeichnis mit den Erzeugerbildern (Dateinamen siehe --only)",
    )
    parser.add_argument("--out", type=Path, default=Path("build/landing-images"))
    parser.add_argument(
        "--only",
        nargs="+",
        # `choices` statt einer eigenen Pruefung: argparse validiert damit
        # JEDES Element von `nargs="+"`, nennt bei einem Tippfehler die
        # gueltigen Werte, listet sie in `--help` und beendet mit 2 statt 1 —
        # dem Code fuer einen Bedienfehler, den ein Aufrufer von einem echten
        # Fehlschlag unterscheiden kann. Dieselbe Loesung steht im Haus schon
        # in `generate_dungeon_detail_images.py`.
        choices=sorted({stem for stem, _ in _SOURCES.values()}),
        metavar="KENNUNG",
        help=("Nur diese Zielkennungen ableiten. Ohne die Angabe werden alle Quellen verlangt. Moeglich: %(choices)s"),
    )
    args = parser.parse_args()

    src: Path = args.src
    if not src.is_dir():
        print(f"Quellverzeichnis nicht gefunden: {src}", file=sys.stderr)
        return 1

    out: Path = args.out
    out.mkdir(parents=True, exist_ok=True)

    # WAS IN `--out` LIEGT, WIRD ABGELEGT — AUCH WAS NICHT AUS DIESEM LAUF IST.
    #
    # `upload_landing_images.py` nimmt jede Bilddatei im Verzeichnis und
    # schreibt sie mit `x-upsert: true` in den festen Vorsatz. Ein Teillauf
    # (`--only`) meldet also sechs Dateien, und abgelegt werden alle, die noch
    # herumliegen — gegen URLs, die mit `max-age=31536000, immutable`
    # ausgeliefert werden und die dieses Modul selbst fuer endgueltig erklaert.
    # Deshalb schreibt der Lauf am Ende eine Liste dessen, was ER erzeugt hat;
    # der Upload liest sie, wenn sie da ist.
    fremd = sorted(p.name for p in out.glob("*") if p.suffix in {".avif", ".webp"})
    if fremd:
        print(f"Hinweis: {len(fremd)} Bilddatei(en) liegen bereits in {out}.")
        print("  Der Upload legt ab, was in der Liste dieses Laufs steht — nicht,")
        print("  was im Verzeichnis liegt (build/landing-images/_ableitung.json).")

    # Die Begruendung fuer `--only` steht im Modul-Docstring, den `--help`
    # druckt. Sie stand bis zum 05.09.2026 hier als nackte Zeichenkette: die
    # ist kein Docstring (nur die ERSTE Anweisung einer Funktion ist einer),
    # kompiliert zu nichts, ist fuer jedes Werkzeug unsichtbar, und ein
    # gewoehnliches Umsortieren haette sie in `_pick.__doc__` verwandelt.
    quellen = _SOURCES
    if args.only:
        gewaehlt = set(args.only)
        quellen = {n: v for n, v in _SOURCES.items() if v[0] in gewaehlt}

    missing = [name for name in quellen if not (src / name).is_file()]
    if missing:
        print(f"Fehlende Quelldateien: {missing}", file=sys.stderr)
        return 1

    source_total = 0
    everything: list[Derived] = []

    for name, (stem, roles) in quellen.items():
        path = src / name
        source_total += path.stat().st_size
        with Image.open(path) as image:
            rgb = image.convert("RGB")
            print(f"\n{name}  ({rgb.width}×{rgb.height}, {_human(path.stat().st_size)})")
            for role in roles:
                print(f"  {role.name}: {role.note}")
                try:
                    everything.extend(_derive_one(rgb, out, stem, role))
                except WidthUnavailableError as fehler:
                    print(f"\n  ! {fehler}", file=sys.stderr)
                    return 1

    # ── Messung ─────────────────────────────────────────────────────────────
    print("\n" + "=" * 74)
    print("GEMESSEN")
    print("=" * 74)

    derived_total = sum(d.size for d in everything)
    print(f"Quellen ({len(quellen)} Dateien)            {_human(source_total)}")
    print(f"Abgeleitet ({len(everything):3d} Dateien)        {_human(derived_total)}")

    def _pick(role: str, fmt: str, width: int, stem: str | None = None) -> list[Derived]:
        return [
            d
            for d in everything
            if d.role == role and d.fmt == fmt and d.width == width and (stem is None or d.stem == stem)
        ]

    # WAS „ERSTE BILDLAST" IST, HAENGT AM SKIN.
    #
    # Die alte Frontseite laedt den queren Helden in 1920. Die Atlas-Frontseite
    # laedt stattdessen die 3:4-Tafel; die groesste Stufe, die ein ueblicher
    # Schirm dort waehlt, ist 1440. Beide gegen dieselbe Grenze zu pruefen ist
    # richtig — sie an derselben DATEI zu pruefen waere falsch.
    #
    # Und: wenn keine der beiden abgeleitet wurde (etwa bei `--only` auf eine
    # Tafel), steht hier kein „0 KB ✓". Ein Haken, weil nichts gefunden wurde,
    # ist kein bestandener Test.
    #
    # ZWEI FEHLER, DIE HIER STANDEN.
    # (1) `_pick("hero", …) or _pick("heroPortrait", …)` — ein `or` schliesst
    #     kurz. Bei jedem vollstaendigen Lauf ist der linke Teil wahr, also
    #     wurde der neue Held NIE gewogen. Genau der Fall, den der Absatz
    #     darueber ausschliessen wollte: er wird abgeleitet, hochgeladen und
    #     nicht gemessen. `+` statt `or` misst beide, jeden fuer sich.
    # (2) Gemessen wurde nur AVIF. Die WebP-Leiter geht an jeden Browser ohne
    #     AVIF, ueber der Falz, mit `fetchpriority="high"` — und riss die
    #     Grenze mit 615 KB, ohne dass irgendetwas es sagte. Jetzt traegt jede
    #     Kandidatenzeile ihr Format.
    kandidaten: list[tuple[str, list[Derived]]] = []
    for fmt in ("avif", "webp"):
        kandidaten.append((fmt, _pick("hero", fmt, 1920)))
        kandidaten.append((fmt, _pick("heroPortrait", fmt, 1440)))
    kandidaten = [(fmt, rows) for fmt, rows in kandidaten if rows]
    hero = [d for _, rows in kandidaten for d in rows]
    hero_bytes = sum(d.size for d in hero)

    # Was der Systemabschnitt beim Aufklappen nachlädt: eine Tafel in
    # zweifacher Dichte plus sechs Miniaturen.
    panel_first = _pick("panel", "avif", 1280, "system-01-forge")
    thumbs = _pick("thumb", "avif", 288)
    section_bytes = sum(d.size for d in panel_first) + sum(d.size for d in thumbs)

    print()
    if kandidaten:
        print("Erste Bildlast — jede Datei EINZELN gegen 400 KB:")
        gerissen = 0
        for fmt, rows in kandidaten:
            for d in rows:
                urteil = "UNTER 400 KB ✓" if d.size < 400 * 1024 else "ÜBER 400 KB ✗"
                if d.size >= 400 * 1024:
                    gerissen += 1
                print(f"  {_human(d.size):>10s}  {d.stem} {d.role} {d.width} {fmt.upper():4s}  {urteil}")
        if gerissen:
            print(f"  -> {gerissen} Datei(en) ueber der Grenze.")
    else:
        print("Erste Bildlast: KEIN Held in dieser Auswahl — die 400-KB-Probe")
        print("  ist AUSGESETZT, nicht bestanden.")
    print()
    # Die Beschriftung nennt, was WIRKLICH gemessen wurde. Vorher stand hier
    # „1 Tafel 1280 + 6 Miniaturen 288" ueber dem, was `--only` gerade
    # abgeleitet hatte — bei einer einzelnen Miniatur also eine Unwahrheit.
    if panel_first or thumbs:
        print(f"Systemabschnitt beim Erreichen ({len(panel_first)} Tafel 1280 + {len(thumbs)} Miniaturen 288, AVIF):")
        print(f"  {_human(section_bytes):>12s}")
        # Und die Summe nur dann, wenn beide Summanden da sind: „Held +
        # Systemabschnitt" mit `hero_bytes = 0` liest sich wie eine
        # Seitenbilanz und laesst ihren groessten Posten weg.
        if hero:
            print()
            print(f"Held + Systemabschnitt zusammen: {_human(hero_bytes + section_bytes)}")

    print("\nGrößte abgeleitete Dateien:")
    for d in sorted(everything, key=lambda x: x.size, reverse=True)[:6]:
        print(f"  {_human(d.size):>10s}  {d.path.name}")

    manifest = out / "_ableitung.json"
    manifest.write_text(
        json.dumps(
            {
                "erzeugt": datetime.now(UTC).isoformat(timespec="seconds"),
                "quellen": sorted(quellen),
                "dateien": sorted(d.path.name for d in everything),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )

    print(f"\nGeschrieben nach: {out.resolve()}")
    print(f"Liste dieses Laufs: {manifest.name} ({len(everything)} Dateien)")
    print("Ablegen ist ein eigener Schritt (scripts/upload_landing_images.py).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
