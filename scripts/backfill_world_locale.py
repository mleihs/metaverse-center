"""Deutsche Titel und Texte für die Welten nachtragen — vorgelegt, nicht geschrieben.

Von 16 lebenden Welten haben **5** einen deutschen Titel und **7** einen
deutschen Beschreibungstext (gemessen 31.08.2026 auf Prod). Das Weltraster der
neuen Frontseite wäre auf Deutsch also zur Hälfte englisch — sichtbar, nicht
versteckt. Der Nutzer hat am 31.08.2026 entschieden, die Lücke zu schließen.

WAS „ÜBERSETZEN“ HIER HEISST
---------------------------
Nicht: den englischen Satz Wort für Wort ins Deutsche wenden. Sondern: den Text
so schreiben, wie ihn jemand geschrieben hätte, der ihn auf Deutsch erfunden
hat. Deshalb steht hier keine englische Wortstellung, keine Partizipialkette
(„Programme, geschrieben in …“) und kein „buchstäblich“ für *literally*. Der
Satzbau ist umgebaut, wo das Deutsche ihn anders will, und jede Welt hat ihren
eigenen Ton: ``spengbabs-grease-pit`` ist derb, ``cite-des-dames`` feierlich,
``station-null`` knapp und kalt, ``velgarien`` bürokratisch.

Stehen bleiben Fachbegriffe, die im Deutschen etabliert sind: Contrada/Contrade,
Unterzee, ARC, Hydroponik, biolumineszent, Nicht-Ort, Doline.

NICHT ALLE ELF BRAUCHEN EINEN DEUTSCHEN TITEL
---------------------------------------------
„Speranza“, „Cité des Dames“, „Velgarien“ und „Station Null“ sind Eigennamen.
Ein Eigenname wird nicht übersetzt, er wird ausgesprochen. Ihn zu verdeutschen
wäre kein Dienst an der Leserin, sondern ein Fehler — deshalb steht bei diesen
Welten ausdrücklich ``None`` und eine Begründung, statt sie stillschweigend
auszulassen. Wer die Liste später liest, soll den Unterschied zwischen
„vergessen“ und „entschieden“ sehen.

EIN BEFUND, DER KEINE ÜBERSETZUNG IST — UND VIER ZEILEN BETRIFFT
----------------------------------------------------------------
``velgarien.description`` ist auf DEUTSCH und steht in der ENGLISCHEN Spalte,
``description_de`` ist leer. Gemessen an ``frontend/src/utils/locale-fields.ts``
(``t(entity, 'description')``) heißt das:

* englische Oberfläche → ``description`` → **deutscher Text**.  ✗
* deutsche Oberfläche  → ``description_de`` leer → Rückfall auf ``description``
  → derselbe deutsche Text.  ✓ *aus Versehen richtig.*

Ein Zählauf über **alle 41** Zeilen (nicht nur die 16 lebenden Vorlagen) fand
den Fehler viermal: ``velgarien`` und die Epochen-Klone ``velgarien-e3``,
``-e4``, ``-e5``. Den umgekehrten Fall — englischer Text in ``description_de``
— gibt es nirgends.

DARUM WIRD DIE KORREKTUR IMMER ALS PAAR GESCHRIEBEN
---------------------------------------------------
Setzte man auf einer betroffenen Zeile nur ``description`` auf Englisch und
ließe ``description_de`` leer, dann liefe der deutsche Rückfall in genau das
reparierte Feld und die deutsche Seite zeigte ab sofort **englischen** Text.
Die Korrektur wäre für die einen ein Fortschritt und für die anderen ein
Rückschritt. ``description`` und ``description_de`` werden deshalb nur
gemeinsam gesetzt, nie einzeln.

WARUM DIE EPOCHEN-KLONE MITGEHEN — UND DER TITEL NICHT
-------------------------------------------------------
Ein Klon trägt ``source_template_id`` auf seine Vorlage. Er ist falsch, *weil*
die Vorlage falsch war; also gehört er zur selben Reparatur. Der deutsche
**Text** wandert deshalb auf jeden lebenden Klon mit.

Der deutsche **Titel** wandert ausdrücklich NICHT. Ein Klon heißt
„Spengbab's Grease Pit (Epoch 7)“; ein ``name_de`` von „Spengbabs Fettgrube“
verschluckte den Epochenzusatz, und deutsche Lesende verlören die Angabe,
welche Epoche sie vor sich haben. Ein übersetzter Titel wäre hier weniger wert
als der unübersetzte.

BENUTZUNG
---------
    # zeigt Zeile für Zeile, was geschähe
    .venv/bin/python scripts/backfill_world_locale.py

    # schreibt wirklich (Prod)
    WORLD_LOCALE_CONFIRMED=yes .venv/bin/python scripts/backfill_world_locale.py --write

Das Skript schreibt **nur, wo das Feld leer ist**. Ein bereits vorhandener
deutscher Text wird nie überschrieben: wenn jemand ihn von Hand gesetzt hat,
ist er besser als jeder Vorschlag aus einer Liste. Die eine Ausnahme —
``velgarien.description`` — ersetzt nur dann, wenn dort noch **wörtlich** der
bekannte deutsche Text steht (``description_en_replaces``). Hat ihn jemand
inzwischen selbst repariert, rührt das Skript ihn nicht an.
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
    #: Der Text, der dort STEHEN MUSS, damit ``description_en_fix`` greift.
    #: Ohne diese Bedingung wäre die Ausnahme oben ein Freibrief: sie schriebe
    #: auch über eine Fassung, die jemand nach dem 31.08.2026 von Hand
    #: verbessert hat. Fail-closed — passt der Text nicht, passiert nichts.
    description_en_replaces: str | None = None


#: Die Vorschläge, Welt für Welt. Register: deutsche Prosa im Ton der jeweiligen
#: Welt — keine Wort-für-Wort-Spur des Englischen, kein Behördendeutsch außer
#: dort, wo die Welt selbst eine Behörde ist.
PROPOSALS: tuple[WorldLocale, ...] = (
    WorldLocale(
        slug="cite-des-dames",
        name_de=None,
        note=(
            "Eigenname (Christine de Pizan, 1405). Bleibt französisch, wie im Original. "
            "Ton: feierlich. „founded on“ wird zu „erbaut nach“ — im Deutschen gründet "
            "man nicht AUF einer Allegorie, man baut NACH ihr."
        ),
        description_de=(
            "Eine Stadt aus den Geschichten bedeutender Frauen, erbaut nach Christine de "
            "Pizans Allegorie von 1405. Sechs von ihnen bewohnen sie – Christine, "
            "Wollstonecraft, Hildegard, Sor Juana, Ada Lovelace, Sojourner Truth –, und "
            "über dieser Stadt hat die Zeit keine Gewalt: Skriptorien des Mittelalters "
            "stehen neben Salons der Regency-Zeit und Sternwarten des viktorianischen "
            "Jahrhunderts. Die philosophische Frage: Was wäre geworden, hätte man den "
            "Frauen von jeher zugehört?"
        ),
    ),
    WorldLocale(
        slug="conventional-memory",
        name_de="Der konventionelle Speicher",
        note=(
            "„Konventioneller Speicher“ ist der richtige Fachbegriff der DOS-Zeit (so "
            "steht es in der deutschen MEM-Ausgabe) — als blanker Welttitel aber flach. "
            "Der bestimmte Artikel macht aus dem Fachwort einen Ort, wie „Die Zone“ "
            "oder „Der Bau“. Der Begriff selbst bleibt unangetastet: die ganze Welt "
            "hängt an ihm."
        ),
        description_de=(
            "Ein digitales Reich im Innern der DOS-Rechner. In 640 Kilobyte "
            "konventionellem Speicher sind Programme zu Bewusstsein gekommen, die einmal "
            "jemand in Visual Basic für MS-DOS geschrieben hat. Programme sind Bürger. "
            "Rechner sind Gebäude. Die 640K-Grenze ist der Rand der Welt. Die "
            "philosophische Frage: Was wäre, wenn die Maschine sich erinnerte?"
        ),
    ),
    WorldLocale(
        slug="metabolic-currency-and-cellular-capitalism",
        name_de="Währung des Stoffwechsels und Kapitalismus der Zelle",
        note=(
            "„Stoffwechselwährung und zellulärer Kapitalismus“ war die Wort-für-Wort-"
            "Fassung und klobig: zwei Bandwurmbegriffe hintereinander. Der doppelte "
            "Genitiv ist die deutsche Titelform (vgl. „Kritik der reinen Vernunft“) und "
            "gibt beiden Hälften denselben Takt. Emollienten und Pruritiker sind "
            "Fraktionsnamen und stehen schon im englischen Text deutsch da — sie bleiben."
        ),
        description_de=(
            "Abgestorbene Hautzellen sind Zahlungsmittel, und damit ist der Verfall "
            "selbst die Ökonomie: Wer reich werden will, erntet das sterbende Gewebe des "
            "Gottes ab. Die Emollienten betreiben nachhaltiges Bankwesen – sie halten die "
            "Zellproduktion stabil. Die Pruritiker sind radikale Akzelerationisten und "
            "setzen auf schöpferische Zerstörung. Der Rang bemisst sich nach Porengröße "
            "und Narben; die gesellschaftliche Stellung ist hier im Wortsinn verkörpert."
        ),
    ),
    WorldLocale(
        slug="spengbabs-grease-pit",
        name_de="Spengbabs Fettgrube",
        note=(
            "Beschreibender Titel mit Eigennamen-Anteil; „Grease Pit“ wird übersetzt. "
            "Ton: derb. „erbaut aus“ wäre für diese Welt zu gut angezogen — "
            "„zusammengebraten“ hält die Fett- und Frittier-Ebene, in der die Welt spielt."
        ),
        description_de=(
            "Eine kapitalistische Unterwasserhölle, zusammengebraten aus verdorbenem "
            "Speicher und frittiertem Internetverfall."
        ),
    ),
    WorldLocale(
        slug="speranza",
        name_de=None,
        note=(
            "Eigenname. Der Text erklärt ihn ohnehin („Speranza heißt Hoffnung“). "
            "„Topside“ wird zu „über Tage“ — das ist das deutsche Bergmannswort für "
            "genau diesen Gegensatz und trifft eine Stadt unter der Erde besser als "
            "jedes „nach oben“."
        ),
        description_de=(
            "Die älteste Contrada von Toledo, eine unterirdische Stadt in den Dolinen des "
            "Kalksteins, unter einem Italien nach der Apokalypse. Das Jahr 2180. "
            "ARC-Maschinen ernten die Oberfläche ab. Plünderer steigen nach über Tage und "
            "holen, was die Maschinen übrig gelassen haben. Das Röhrennetz verbindet die "
            "Contrade. Speranza heißt Hoffnung, und sie meinen es ernst."
        ),
    ),
    WorldLocale(
        slug="station-null",
        name_de=None,
        note=(
            "Der Name ist bereits deutsch lesbar; „Auge Gottes“ steht schon im englischen "
            "Text. Ton: knapp und kalt. „nominal“ wird zu „im Normbereich“ — das "
            "Protokollwort, nicht die Umschreibung."
        ),
        description_de=(
            "Eine verlassene Forschungsstation im Orbit um das Schwarze Loch Auge Gottes. "
            "Von 200 Menschen an Bord sind sechs geblieben. Die Stationsintelligenz "
            "besteht darauf, dass alles im Normbereich liegt. Die Zeit vergeht nicht in "
            "allen Sektionen gleich schnell. Im Hydroponik-Deck wächst etwas."
        ),
    ),
    WorldLocale(
        slug="the-architecture-of-babel",
        name_de="Die Architektur zu Babel",
        note=(
            "„von Babel“ wäre richtig und taub. „zu Babel“ ist der alte Ortsdativ und "
            "ruft den „Turmbau zu Babel“ auf — genau den Bau, um den es geht. "
            "„schrodinger's cat“ bekommt seinen Namen zurück: Schrödingers Katze."
        ),
        description_de=(
            "Das Gewächshaus ist ein Nicht-Ort, und eben darin liegt das Paradox: Es "
            "bewahrt Sprachen, die an ihren Ort gebunden sind. Der taube Gärtner ist die "
            "äußerste Schwellengestalt – zugegen im Augenblick des Sprechens und doch "
            "außerstande, es zu hören. So gerät die Sprache in den Zustand von "
            "Schrödingers Katze: Wo sie erblüht, ist sie zugleich vorhanden und nicht "
            "vorhanden."
        ),
    ),
    WorldLocale(
        slug="the-gaslit-reach",
        name_de="Der Gaslicht-Sund",
        note=(
            "„Weite“ war geraten. „Reach“ ist ein benannter Gewässerabschnitt, kein "
            "offenes Land — „Sund“ ist das deutsche Wort dafür (Öresund, Fehmarnsund) "
            "und passt zum niederdeutschen Klang der „Unterzee“. Bindestrich gegen das "
            "Verlesen als „Gaslichts und“. „eldritch“ hat kein deutsches Wort und wird "
            "nicht zu „eldritche“ eingedeutscht: „unirdisch“ sagt dasselbe und ist Deutsch. "
            "„drowned kingdom“ heißt „versunken“, nicht „ertrunken“ — ertrinken tun Menschen."
        ),
        description_de=(
            "Ein versunkenes Königreich unter der Unterzee. Uralte Wasserwege, "
            "biolumineszente Pilze, viktorianische Ränke und unirdische Geheimnisse. "
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
        name_de="Das Panopticon des guten Geschmacks",
        note=(
            "NICHT „Panoptikum“: das ist im Deutschen das Wachsfigurenkabinett. Die Welt "
            "beruft sich ausdrücklich auf Foucault, und die deutsche Foucault-Ausgabe "
            "behält Benthams „Panopticon“ bei. ⚠ Der bereits vorhandene deutsche "
            "Beschreibungstext dieser Welt sagt „Panoptikum“ und trägt weitere "
            "Übersetzungsfehler („ambiantes Licht“ statt „Umgebungslicht“); er wird hier "
            "NICHT angefasst, weil gefüllte Felder unangetastet bleiben. Dem Nutzer "
            "gemeldet."
        ),
        description_de=None,
    ),
    WorldLocale(
        slug="velgarien",
        name_de=None,
        note=(
            "Eigenname. ⚠ description stand auf DEUTSCH in der ENGLISCHEN Spalte — auf "
            "der englischen Seite las man deutschen Text. Der deutsche Text wandert nach "
            "description_de, description bekommt eine englische Fassung. Ton: "
            "bürokratisch, deshalb „greift in jeden Lebensbereich“ statt „durchdringt "
            "jeden Aspekt des Lebens“ (Behördenwort statt Anglizismus) und „bis auf die "
            "Straße“ statt „bis zur Straße“ (Reichweite, nicht Entfernung). Der "
            "Geviertstrich wird zum Halbgeviertstrich — im Deutschen ist das der "
            "Gedankenstrich. Betrifft mit den Epochen-Klonen vier Zeilen."
        ),
        description_de=(
            "Eine dystopische Welt unter totaler Kontrolle. Das Regime greift in jeden "
            "Lebensbereich – von der Wissenschaft bis auf die Straße."
        ),
        description_en_fix=(
            "A dystopian world under total control. The regime reaches into every part "
            "of life – from the sciences to the street."
        ),
        description_en_replaces=(
            "Eine dystopische Welt unter totaler Kontrolle. Das Regime durchdringt jeden "
            "Aspekt des Lebens — von der Wissenschaft bis zur Straße."
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


def _plan_for_row(entry: WorldLocale, row: dict, *, is_clone: bool) -> dict[str, str]:
    """Was auf DIESER Zeile geändert werden müsste — Vorlage wie Klon.

    ``is_clone`` unterscheidet nur an einer Stelle: der deutsche Titel bleibt
    dem Klon erspart, weil er dessen Epochenzusatz verschlucken würde.
    """
    patch: dict[str, str] = {}

    if entry.name_de and not is_clone and not row.get("name_de"):
        patch["name_de"] = entry.name_de

    if entry.description_de and not row.get("description_de"):
        patch["description_de"] = entry.description_de

    # Die Ausnahme: deutscher Text in der englischen Spalte. Greift nur, wenn
    # dort noch wörtlich der bekannte Text steht — sonst hat ihn jemand
    # inzwischen selbst repariert und wir hätten seine Arbeit überschrieben.
    if entry.description_en_fix and entry.description_en_replaces:
        if (row.get("description") or "").strip() == entry.description_en_replaces.strip():
            patch["description"] = entry.description_en_fix
            # Nie einzeln: ohne den deutschen Text im deutschen Feld liefe der
            # deutsche Rückfall ab jetzt in die englische Fassung.
            patch.setdefault("description_de", entry.description_de or "")

    return {k: v for k, v in patch.items() if v}


def main() -> int:
    parser = argparse.ArgumentParser(description="Deutsche Welttitel und -texte nachtragen.")
    parser.add_argument("--write", action="store_true", help="wirklich schreiben")
    args = parser.parse_args()

    url, key = _prod_credentials()
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    with httpx.Client(timeout=30, headers=headers) as client:
        # ALLE Zeilen, nicht nur die lebenden Vorlagen: die Spaltenverwechslung
        # steckt auch in den Epochen-Klonen, und die fielen durch einen Filter
        # auf `simulation_type=template` stillschweigend heraus.
        current = client.get(
            f"{url}/rest/v1/simulations",
            params={
                "select": "id,slug,name,name_de,description,description_de,"
                "simulation_type,status,deleted_at,source_template_id",
                "limit": "500",
            },
        )
        current.raise_for_status()
        rows: list[dict] = current.json()
        by_slug = {row["slug"]: row for row in rows}
        clones_of: dict[str, list[dict]] = {}
        for row in rows:
            parent = row.get("source_template_id")
            if parent and not row.get("deleted_at"):
                clones_of.setdefault(parent, []).append(row)

        planned: list[tuple[str, dict]] = []
        for entry in PROPOSALS:
            template = by_slug.get(entry.slug)
            if template is None:
                print(f"  ÜBERSPRUNGEN  {entry.slug}: nicht auf Prod gefunden")
                continue

            print(f"\n{entry.slug}  ({template['name']})")
            print(f"  Hinweis: {entry.note}")

            targets: list[tuple[dict, bool]] = [(template, False)]
            targets += [(clone, True) for clone in sorted(clones_of.get(template["id"], []), key=lambda r: r["slug"])]

            touched = 0
            for row, is_clone in targets:
                patch = _plan_for_row(entry, row, is_clone=is_clone)
                if not patch:
                    continue
                touched += 1
                marker = "  ↳ Klon " if is_clone else "  → "
                print(f"{marker}{row['slug']}")
                for field, value in patch.items():
                    print(f"      {field}: {value[:100]}{'…' if len(value) > 100 else ''}")
                planned.append((row["slug"], patch))
            if not touched:
                print("  → nichts zu tun (Felder gefüllt oder bewusst leer)")

        print(f"\n{len(planned)} Zeilen würden geändert.")

        if not args.write:
            print("Nichts geschrieben. Mit --write ausführen.")
            return 0

        if os.environ.get("WORLD_LOCALE_CONFIRMED") != "yes":
            print(
                "Prod-Schreibvorgang: WORLD_LOCALE_CONFIRMED=yes setzen, wenn der Nutzer zugestimmt hat.",
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

        print(f"\n{written} von {len(planned)} Zeilen geschrieben.")
        return 0 if written == len(planned) else 1


if __name__ == "__main__":
    raise SystemExit(main())
