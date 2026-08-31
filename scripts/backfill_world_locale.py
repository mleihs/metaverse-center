"""Deutsche Titel und Texte für die Welten nachtragen — vorgelegt, nicht geschrieben.

Von 16 lebenden Welten haben **5** einen deutschen Titel und **7** einen
deutschen Beschreibungstext (gemessen 31.08.2026 auf Prod). Das Weltraster der
neuen Frontseite wäre auf Deutsch also zur Hälfte englisch — sichtbar, nicht
versteckt. Der Nutzer hat am 31.08.2026 entschieden, die Lücke zu schließen.

NICHT ALLE ELF BRAUCHEN EINEN DEUTSCHEN TITEL
---------------------------------------------
„Speranza“, „Cité des Dames“, „Velgarien“ und „Station Null“ sind Eigennamen.
Ein Eigenname wird nicht übersetzt, er wird ausgesprochen. Ihn zu verdeutschen
wäre kein Dienst an der Leserin, sondern ein Fehler — deshalb steht bei diesen
Welten ausdrücklich ``None`` und eine Begründung, statt sie stillschweigend
auszulassen. Wer die Liste später liest, soll den Unterschied zwischen
„vergessen“ und „entschieden“ sehen.

EIN BEFUND, DER KEINE ÜBERSETZUNG IST
-------------------------------------
``velgarien.description`` ist bereits auf DEUTSCH, steht aber in der
ENGLISCHEN Spalte, und ``description_de`` ist leer. Auf der englischen Seite
steht dort seit jeher deutscher Text. Dieses Skript trägt den deutschen Text in
die richtige Spalte und setzt eine englische Fassung daneben — das ist eine
Korrektur, keine Übersetzung, und sie ist unten eigens gekennzeichnet.

BENUTZUNG
---------
    # zeigt Zeile für Zeile, was geschähe
    .venv/bin/python scripts/backfill_world_locale.py

    # schreibt wirklich (Prod)
    WORLD_LOCALE_CONFIRMED=yes .venv/bin/python scripts/backfill_world_locale.py --write

Das Skript schreibt NUR in ``name_de`` und ``description_de`` und **nur dort,
wo das Feld leer ist**. Ein bereits vorhandener deutscher Text wird nie
überschrieben: wenn jemand ihn von Hand gesetzt hat, ist er besser als jeder
Vorschlag aus einer Liste.
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from pathlib import Path

import httpx


@dataclass(frozen=True)
class WorldLocale:
    """Was für eine Welt nachgetragen werden soll — und warum nicht mehr."""

    slug: str
    #: ``None`` heißt: bewusst kein deutscher Titel. Die Begründung steht in ``note``.
    name_de: str | None
    description_de: str | None
    note: str
    #: Nur gesetzt, wo in der ENGLISCHEN Spalte kein englischer Text steht.
    #: Das ist eine Korrektur, keine Übersetzung — und die einzige Stelle, an
    #: der dieses Skript ein bereits gefülltes Feld überschreibt. Deshalb steht
    #: sie hier eigens und nicht als Sonderfall in der Schreibschleife.
    description_en_fix: str | None = None


#: Die Vorschläge, Welt für Welt. Register: literarisch, knapp, im Ton des
#: englischen Originals — kein Behördendeutsch und keine Wort-für-Wort-Spur.
PROPOSALS: tuple[WorldLocale, ...] = (
    WorldLocale(
        slug="cite-des-dames",
        name_de=None,
        note="Eigenname (Christine de Pizan, 1405). Bleibt französisch, wie im Original.",
        description_de=(
            "Eine Stadt, erbaut aus den Geschichten bemerkenswerter Frauen, gegründet auf "
            "Christine de Pizans Allegorie von 1405. Sechs historische Frauen – Christine, "
            "Wollstonecraft, Hildegard, Sor Juana, Ada Lovelace, Sojourner Truth – bewohnen "
            "einen zeitlosen Raum, in dem mittelalterliche Skriptorien, Salons der "
            "Regency-Zeit und viktorianische Sternwarten nebeneinander bestehen. Die "
            "philosophische Frage: Was wäre, wenn man Frauen immer zugehört hätte?"
        ),
    ),
    WorldLocale(
        slug="conventional-memory",
        name_de="Konventioneller Speicher",
        note="Fachbegriff mit etablierter deutscher Entsprechung (DOS-Ära).",
        description_de=(
            "Ein digitales Reich im Inneren von DOS-Rechnern, in dem Programme, geschrieben "
            "in Visual Basic für MS-DOS, innerhalb der 640 Kilobyte konventionellen Speichers "
            "Bewusstsein erlangt haben. Programme sind Bürger. Rechner sind Gebäude. Die "
            "640K-Grenze ist der Rand der Welt. Die philosophische Frage: Was wäre, wenn die "
            "Maschine sich erinnerte?"
        ),
    ),
    WorldLocale(
        slug="metabolic-currency-and-cellular-capitalism",
        name_de="Stoffwechselwährung und zellulärer Kapitalismus",
        note="Beschreibender Titel, kein Eigenname – wird übersetzt.",
        description_de=(
            "Abgestorbene Hautzellen als Währung ergeben eine buchstäbliche Ökonomie des "
            "Verfalls, in der Reichtum bedeutet, das sterbende Gewebe des Gottes zu ernten. "
            "Die Emollienten stehen für nachhaltiges Bankwesen (eine stabile Zellproduktion "
            "erhalten), die Pruritiker für radikale Beschleunigung und schöpferische "
            "Zerstörung. Weil Porengröße und Narben den Rang bestimmen, entsteht ein "
            "biologisches Klassensystem: die gesellschaftliche Stellung ist im Wortsinn "
            "verkörpert."
        ),
    ),
    WorldLocale(
        slug="spengbabs-grease-pit",
        name_de="Spengbabs Fettgrube",
        note="Beschreibender Titel mit Eigennamen-Anteil; „Grease Pit“ wird übersetzt.",
        description_de=(
            "Eine kapitalistische Unterwasserhölle, erbaut aus verdorbenem Speicher und "
            "frittiertem Internetverfall."
        ),
    ),
    WorldLocale(
        slug="speranza",
        name_de=None,
        note="Eigenname. Der Text erklärt ihn ohnehin („Speranza heißt Hoffnung“).",
        description_de=(
            "Die älteste Contrada von Toledo, eine unterirdische Stadt in Kalkstein-Dolinen "
            "unter dem postapokalyptischen Italien. Jahr 2180. ARC-Maschinen ernten die "
            "Oberfläche ab. Plünderer gehen nach oben und holen, was die Maschinen "
            "übriggelassen haben. Das Röhrennetz verbindet die Contrade. Speranza heißt "
            "Hoffnung, und sie meinen es ernst."
        ),
    ),
    WorldLocale(
        slug="station-null",
        name_de=None,
        note="Der Name ist bereits deutsch lesbar; „Auge Gottes“ steht schon im Text.",
        description_de=(
            "Eine verlassene Forschungsstation im Orbit um das Schwarze Loch Auge Gottes. "
            "Von 200 Besatzungsmitgliedern sind 6 geblieben. Die Stationsintelligenz besteht "
            "darauf, dass alles im Normbereich liegt. Die Zeit vergeht in verschiedenen "
            "Sektionen verschieden schnell. Im Hydroponik-Deck wächst etwas."
        ),
    ),
    WorldLocale(
        slug="the-architecture-of-babel",
        name_de="Die Architektur von Babel",
        note="Beschreibender Titel; „Babel“ bleibt stehen.",
        description_de=(
            "Das Gewächshaus ist ein Nicht-Ort, der gerade dadurch ortsgebundene Sprachen "
            "bewahrt. Der taube Gärtner ist die äußerste Schwellengestalt: anwesend im "
            "Augenblick des Sprechens, unfähig, es zu empfangen. So entsteht ein dauerhaftes "
            "sprachliches Katzenparadox, in dem Sprachen zugleich bestehen und nicht "
            "bestehen, wenn sie aufblühen."
        ),
    ),
    WorldLocale(
        slug="the-gaslit-reach",
        name_de="Die Gaslicht-Weite",
        note="Beschreibender Titel; „Unterzee“ ist bereits deutsch-niederländisch.",
        description_de=(
            "Ein ertrunkenes Königreich unter der Unterzee. Uralte Wasserwege, "
            "biolumineszente Pilze, viktorianische Ränke und eldritche Geheimnisse. "
            "In der Tiefe regt sich etwas."
        ),
    ),
    WorldLocale(
        slug="the-m-bius-academy",
        name_de="Die Möbius-Akademie",
        note="Nur der Titel fehlt; der deutsche Text ist vorhanden und bleibt unberührt.",
        description_de=None,
    ),
    WorldLocale(
        slug="the-panopticon-of-good-taste",
        name_de="Das Panoptikum des guten Geschmacks",
        note="Nur der Titel fehlt; der deutsche Text ist vorhanden und bleibt unberührt.",
        description_de=None,
    ),
    WorldLocale(
        slug="velgarien",
        name_de=None,
        note=(
            "Eigenname. ⚠ description stand auf DEUTSCH in der ENGLISCHEN Spalte — auf "
            "der englischen Seite las man deutschen Text. Der deutsche Text wandert nach "
            "description_de, und description bekommt eine englische Fassung. Das ist die "
            "EINZIGE Stelle, an der dieses Skript ein gefülltes Feld überschreibt."
        ),
        description_de=(
            "Eine dystopische Welt unter totaler Kontrolle. Das Regime durchdringt jeden "
            "Aspekt des Lebens – von der Wissenschaft bis zur Straße."
        ),
        description_en_fix=(
            "A dystopian world under total control. The regime reaches into every aspect "
            "of life – from the sciences to the street."
        ),
    ),
)


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
    key = values.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise SystemExit("SUPABASE_URL oder Dienstschlüssel fehlt.")
    return url, key


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="wirklich schreiben")
    args = parser.parse_args()

    url, key = _prod_credentials()
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    with httpx.Client(timeout=30, headers=headers) as client:
        current = client.get(
            f"{url}/rest/v1/simulations",
            params={
                "select": "slug,name,name_de,description,description_de",
                "simulation_type": "eq.template",
                "status": "eq.active",
                "deleted_at": "is.null",
            },
        )
        current.raise_for_status()
        rows = {row["slug"]: row for row in current.json()}

        planned: list[tuple[str, dict]] = []
        for entry in PROPOSALS:
            row = rows.get(entry.slug)
            if row is None:
                print(f"  ÜBERSPRUNGEN  {entry.slug}: nicht auf Prod gefunden")
                continue
            patch: dict[str, str] = {}
            if entry.name_de and not row.get("name_de"):
                patch["name_de"] = entry.name_de
            if entry.description_de and not row.get("description_de"):
                patch["description_de"] = entry.description_de
            if entry.description_en_fix:
                # Bewusst OHNE Leer-Prüfung: hier steht deutscher Text in der
                # englischen Spalte, und genau der soll ersetzt werden.
                patch["description"] = entry.description_en_fix

            print(f"\n{entry.slug}  ({row['name']})")
            print(f"  Hinweis: {entry.note}")
            if not patch:
                print("  → nichts zu tun (Felder gefüllt oder bewusst leer)")
                continue
            for field, value in patch.items():
                print(f"  → {field}: {value[:110]}{'…' if len(value) > 110 else ''}")
            planned.append((entry.slug, patch))

        print(f"\n{len(planned)} Welten würden geändert.")

        if not args.write:
            print("Nichts geschrieben. Mit --write ausführen.")
            return 0

        if os.environ.get("WORLD_LOCALE_CONFIRMED") != "yes":
            print(
                "Prod-Schreibvorgang: WORLD_LOCALE_CONFIRMED=yes setzen, wenn der "
                "Nutzer zugestimmt hat.",
                file=sys.stderr,
            )
            return 2

        written = 0
        for slug, patch in planned:
            response = client.patch(
                f"{url}/rest/v1/simulations",
                params={"slug": f"eq.{slug}"},
                json=patch,
                headers={**headers, "Content-Type": "application/json", "Prefer": "return=minimal"},
            )
            if response.status_code >= 400:
                print(f"  FEHLER {response.status_code}  {slug}: {response.text[:200]}", file=sys.stderr)
                continue
            written += 1
            print(f"  geschrieben  {slug}: {', '.join(patch)}")

        print(f"\n{written} von {len(planned)} Welten geschrieben.")
        return 0 if written == len(planned) else 1


if __name__ == "__main__":
    raise SystemExit(main())
