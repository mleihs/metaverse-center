"""Aufraeumen im Objektspeicher — an EINER Stelle.

WARUM ES DIESE DATEI GIBT

Zwei Dienste hatten je eine eigene, private Fassung derselben zwei Gedanken:

    simulation_service._purge_storage_folder   rekursiv, bestmoeglich
    style_reference_service._try_delete_storage_file   eine Datei, per URL

Beide sind richtig, beide sind unerreichbar fuer den naechsten Aufrufer, und
der schreibt dann die dritte. Genau das stand an: die Bildspur im Gespraech
legt je Bild ZWEI Dateien ab (`{uuid}.avif` und `{uuid}.full.avif`), und
`delete_conversation` fasste den Speicher ueberhaupt nicht an — die Zeilen
verschwanden per CASCADE, die Dateien blieben fuer immer liegen.

BESTMOEGLICH, UND ZWAR ABSICHTLICH

Alle Funktionen hier schlucken ihre Fehler und melden sie ins Log. Das ist
hier die richtige Richtung: eine Datei, die nicht geloescht werden konnte,
kostet Speicherplatz; eine Ausnahme, die aus dem Aufraeumen in den Aufrufer
schlaegt, laesst die Zeile stehen, die geloescht werden sollte — und dann hat
man beides, die Datei UND den Eintrag. Verwaiste Dateien sind das kleinere
Uebel als eine halb geloeschte Konversation.

Der Rueckgabewert ist die Zahl der entfernten Objekte, damit ein Aufrufer die
Wirkung messen und ein Test sie pruefen kann. Ein `None` waere hier dasselbe
Schweigen, gegen das das ganze Repo geschrieben ist.
"""

from __future__ import annotations

import logging

from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

#: Wie der oeffentliche Pfad einer Supabase-Datei aussieht. Die Umkehrung
#: davon ist `object_path_from_url`.
_PUBLIC_MARKER = "object/public/"


def object_path_from_url(url: str, bucket: str) -> str | None:
    """Aus einer oeffentlichen URL den Pfad IM Eimer, oder ``None``.

    Die oeffentliche Form ist

        {supabase}/storage/v1/object/public/{bucket}/{pfad}

    und gebraucht wird ``{pfad}`` — alles, was hinter dem Eimernamen steht.
    Der Eimername kommt als Parameter und wird nicht geraten: er taucht in der
    URL genau einmal auf, aber ein Pfad DARF ihn noch einmal enthalten (ein
    Ordner darf heissen wie ein Eimer), deshalb wird nur am ERSTEN Vorkommen
    getrennt.

    ``None`` statt einer Ausnahme: der Aufrufer raeumt bestmoeglich auf, und
    eine URL, die nicht zu diesem Eimer gehoert, ist dort kein Fehler, sondern
    nichts zu tun.
    """
    marker = f"/{bucket}/"
    stelle = url.find(marker)
    if stelle == -1:
        return None
    pfad = url[stelle + len(marker) :]
    # Manche Aufrufer reichen eine bereits gekuerzte Form herein, in der der
    # Eimer VOR dem Marker steht. Dann bleibt `object/public/` uebrig.
    if pfad.startswith(_PUBLIC_MARKER):
        pfad = pfad[len(_PUBLIC_MARKER) :]
    # Ein Fragezeichen haengt an signierten und an zwischengespeicherten URLs.
    pfad = pfad.split("?", 1)[0]
    return pfad or None


async def remove_objects(supabase: Client, bucket: str, paths: list[str]) -> int:
    """Objekte entfernen, bestmoeglich. Gibt zurueck, wie viele es waren."""
    if not paths:
        return 0
    try:
        await supabase.storage.from_(bucket).remove(paths)
    except Exception:  # noqa: BLE001 — Aufraeumen darf den Aufrufer nicht reissen
        logger.warning(
            "Storage-Objekte nicht entfernt",
            extra={"bucket": bucket, "count": len(paths)},
            exc_info=True,
        )
        return 0
    logger.info("Storage-Objekte entfernt", extra={"bucket": bucket, "count": len(paths)})
    return len(paths)


async def remove_object_by_url(supabase: Client, bucket: str, url: str) -> int:
    """Eine Datei ueber ihre oeffentliche URL entfernen, bestmoeglich."""
    pfad = object_path_from_url(url, bucket)
    if not pfad:
        logger.warning("URL gehoert nicht zu diesem Eimer", extra={"bucket": bucket})
        return 0
    return await remove_objects(supabase, bucket, [pfad])


async def purge_folder(supabase: Client, bucket: str, prefix: str) -> int:
    """Alles unter einem Praefix entfernen, rekursiv und bestmoeglich.

    Supabase liefert Ordner und Dateien in derselben Liste; unterschieden
    werden sie an der ``id``, die nur eine echte Datei fuehrt. Der
    ``.emptyFolderPlaceholder`` ist Supabases eigener Platzhalter und wird
    uebersprungen — ihn zu loeschen loescht den Ordner.
    """
    entfernt = 0
    try:
        eintraege = await supabase.storage.from_(bucket).list(prefix)
    except Exception:  # noqa: BLE001 — bestmoeglich, siehe Modulkopf
        logger.warning("Storage-Auflistung fehlgeschlagen für %s/%s", bucket, prefix, exc_info=True)
        return 0

    if not eintraege:
        return 0

    dateien: list[str] = []
    for eintrag in eintraege:
        name = eintrag.get("name", "") if isinstance(eintrag, dict) else getattr(eintrag, "name", "")
        if not name or name == ".emptyFolderPlaceholder":
            continue
        kennung = eintrag.get("id") if isinstance(eintrag, dict) else getattr(eintrag, "id", None)
        if kennung:
            dateien.append(f"{prefix}/{name}")
        else:
            entfernt += await purge_folder(supabase, bucket, f"{prefix}/{name}")

    entfernt += await remove_objects(supabase, bucket, dateien)
    return entfernt
