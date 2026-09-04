"""Die abgeleitete Bildstrecke in den Ablagekorb legen — ein eigener Schritt, mit Absicht.

Getrennt von ``derive_landing_images.py``, weil Ableiten harmlos ist und Ablegen
ein Schreibvorgang. Wer die Größen neu rechnen will, soll das beliebig oft tun
können, ohne dabei versehentlich Prod zu berühren.

DER PFAD IST DATIERT
--------------------
Ziel ist ``simulation.assets/platform/landing/2026-08/``. Unter
``platform/landing/`` liegen bereits neun Dateien der ALTEN Frontseite
(``hero.avif``, ``feature-*.avif``, zusammen rund 1 MB). Die neuen Namen
kollidieren zwar nicht mit ihnen, aber zwei Generationen im selben Ordner sind
in einem halben Jahr nicht mehr auseinanderzuhalten. Der datierte Vorsatz löst
das und macht nebenbei das Zwischenspeicher-Problem gegenstandslos: eine neue
Ableitung bekommt einen neuen Vorsatz, nie eine überschriebene URL.

Die alten Dateien werden NICHT gelöscht. Solange die alte Frontseite im Umlauf
sein kann, ist ihr Löschen ein Ausfall und kein Aufräumen.

BENUTZUNG
---------
    # zeigt nur, was geschähe
    .venv/bin/python scripts/upload_landing_images.py --src build/landing-images

    # legt wirklich ab
    .venv/bin/python scripts/upload_landing_images.py --src build/landing-images --write

Zugang: ``SUPABASE_URL`` und der Dienstschlüssel aus
``~/.config/metaspots/velgarien-coolify.env`` (Prod) oder ``supabase status``
(lokal, über ``--local``).
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

import httpx

BUCKET = "simulation.assets"
PREFIX = "platform/landing/2026-08"

#: Endung → MIME-Typ. Ein falscher Typ kommt als Download an statt als Bild.
_MIME = {
    ".avif": "image/avif",
    ".webp": "image/webp",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
}

#: Ein Jahr, unveränderlich — der datierte Vorsatz macht jede URL endgültig.
#: (Die Regel aus `asset-error-immutable-poisoning`: `immutable` ist nur dann
#: harmlos, wenn die URL sich nie wieder ändert. Genau das leistet das Datum.)
#:
#: ⚠ GEMESSEN 31.08.2026, und die Messung widerspricht der Absicht: der
#: Endpunkt ``/storage/v1/object/public/…`` liefert **immer**
#: ``cache-control: no-cache``, gleichgültig was hier steht. Der Wert kommt
#: zwar korrekt in ``storage.objects.metadata->>'cacheControl'`` an, aber die
#: Auslieferung ignoriert ihn — auch mit Cache-Buster und
#: ``cf-cache-status: MISS``, also direkt vom Ursprung. Das betrifft JEDES
#: Bild der Plattform, nicht nur diese: Weltbanner und Agentenporträts
#: liefern denselben Kopf. (Der Transformationspfad
#: ``/storage/v1/render/image/public/…`` hält sich daran, kodiert aber neu
#: und macht damit die AVIF-Ableitung wieder zunichte.)
#:
#: Halb so schlimm, wie es klingt, und auch das ist gemessen: ``no-cache``
#: heißt „neu prüfen", nicht „nicht speichern". Der Ursprung setzt einen
#: ETag, und eine bedingte Anfrage beantwortet er mit **304 und null Bytes**.
#: Ein wiederholter Besuch kostet also einen Rundlauf je Bild, keine Nutzlast.
#: Der Kopf bleibt trotzdem gesetzt: er ist richtig, er steht in den
#: Metadaten, und sobald die Auslieferung ihn beachtet, wirkt er ohne dass
#: jemand die Bilder neu ablegen muss.
_CACHE_CONTROL = "public, max-age=31536000, immutable"


def _prod_credentials() -> tuple[str, str]:
    env_path = Path.home() / ".config" / "metaspots" / "velgarien-coolify.env"
    if not env_path.is_file():
        raise SystemExit(f"Prod-Zugang nicht gefunden: {env_path}")
    values: dict[str, str] = {}
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            key, value = line.split("=", 1)
            values[key] = value.strip().strip('"').strip("'")
    url = values.get("SUPABASE_URL", "")
    key = values.get("SUPABASE_SERVICE_ROLE_KEY") or values.get("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        raise SystemExit("SUPABASE_URL oder Dienstschlüssel fehlt in der Prod-Umgebung.")
    return url, key


def _local_credentials() -> tuple[str, str]:
    result = subprocess.run(["supabase", "status"], capture_output=True, text=True, check=False)
    for line in result.stdout.splitlines():
        for part in line.split():
            if part.startswith("sb_secret_"):
                return "http://127.0.0.1:54321", part
    raise SystemExit("Lokaler Dienstschlüssel nicht gefunden — läuft `supabase start`?")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--src", required=True, type=Path, help="Verzeichnis aus derive_landing_images.py")
    parser.add_argument("--write", action="store_true", help="wirklich ablegen (ohne: nur zeigen)")
    parser.add_argument("--local", action="store_true", help="gegen die lokale Instanz statt Prod")
    args = parser.parse_args()

    src: Path = args.src

    # WAS ABGELEGT WIRD, IST DIE LISTE DES LAUFS — NICHT DER INHALT DES ORDNERS.
    #
    # Vorher stand hier ein `glob("*")`. Das Ableiten leert `--out` nie, also
    # lag dort regelmaessig eine fruehere, vollstaendige Generation herum: ein
    # Teillauf meldete sechs Dateien, und abgelegt wurden alle vierundsiebzig —
    # mit `x-upsert: true` gegen URLs, die mit `max-age=31536000, immutable`
    # ausgeliefert werden und die beide Skripte fuer endgueltig erklaeren. Ein
    # ueberschriebener Inhalt unter einer unveraenderlichen URL ist genau die
    # Vergiftung, gegen die der datierte Vorsatz ueberhaupt eingefuehrt wurde.
    #
    # `_ableitung.json` schreibt `derive_landing_images.py` am Ende jedes
    # Laufs. Fehlt sie, faellt der Upload auf den Ordnerinhalt zurueck — und
    # sagt es, statt es zu tun.
    manifest = src / "_ableitung.json"
    if manifest.is_file():
        namen = set(json.loads(manifest.read_text())["dateien"])
        files = sorted(p for p in src.glob("*") if p.suffix in _MIME and p.name in namen)
        fremd = sorted(p.name for p in src.glob("*") if p.suffix in _MIME and p.name not in namen)
        if fremd:
            print(f"Uebergangen ({len(fremd)} nicht aus diesem Lauf): {', '.join(fremd[:6])}")
            if len(fremd) > 6:
                print(f"  ... und {len(fremd) - 6} weitere")
    else:
        files = sorted(p for p in src.glob("*") if p.suffix in _MIME)
        print(f"Keine {manifest.name} — es wird der ganze Ordnerinhalt abgelegt.")

    if not files:
        print(f"Keine Bilddateien in {src}", file=sys.stderr)
        return 1

    url, key = _local_credentials() if args.local else _prod_credentials()
    where = "LOKAL" if args.local else "PROD"
    total = sum(p.stat().st_size for p in files)

    print(f"Ziel:   {where}  {url}")
    print(f"Korb:   {BUCKET}/{PREFIX}/")
    print(f"Menge:  {len(files)} Dateien, {total / 1024 / 1024:.2f} MB\n")

    if not args.write:
        for path in files:
            print(f"  wuerde ablegen  {PREFIX}/{path.name}  ({path.stat().st_size / 1024:.0f} KB)")
        print("\nNichts geschrieben. Mit --write ausfuehren.")
        return 0

    if not args.local and os.environ.get("LANDING_UPLOAD_CONFIRMED") != "yes":
        print(
            "Prod-Schreibvorgang: setze LANDING_UPLOAD_CONFIRMED=yes, wenn der Nutzer zugestimmt hat.",
            file=sys.stderr,
        )
        return 2

    written = 0
    with httpx.Client(timeout=60) as client:
        for path in files:
            target = f"{url}/storage/v1/object/{BUCKET}/{PREFIX}/{path.name}"
            response = client.post(
                target,
                content=path.read_bytes(),
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": _MIME[path.suffix],
                    "Cache-Control": _CACHE_CONTROL,
                    "x-upsert": "true",
                },
            )
            if response.status_code >= 400:
                print(f"  FEHLER {response.status_code}  {path.name}: {response.text[:200]}", file=sys.stderr)
                continue
            written += 1
            print(f"  abgelegt  {PREFIX}/{path.name}")

    print(f"\n{written} von {len(files)} Dateien abgelegt.")
    print(f"Oeffentliche Basis: {url}/storage/v1/object/public/{BUCKET}/{PREFIX}/")
    return 0 if written == len(files) else 1


if __name__ == "__main__":
    raise SystemExit(main())
