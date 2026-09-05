"""Wann ein Text eine Person nennt — und warum ihr erstes Wort nicht ihr Vorname ist.

Zwei Stellen im Chat fragen dasselbe: der Fokalisierungs-Detektor
(``_names_person``) und die Lage-Ansage (``ChatAIService._addressed_note``).
Beide fragen ``nennt dieser Text diese Person?``, und beide haben dieselbe
Antwort verdient — sonst misst das Messgeraet eine andere Welt als die, in der
die Anweisung geschrieben wird.

── Warum ``name.split()[0]`` falsch ist ──────────────────────────────────────

``_addressed_note`` nahm das erste Feld des Namens und nannte es Vorname. Bei
„Doktor Freundlich" ist das erste Feld der TITEL. Nachgemessen am 05.09.2026
(Gegenlesen durch einen zweiten Agenten, von hier aus bestaetigt):

    Figur „Doktor Freundlich", Text „Der Doktor hat abgesagt."
        -> die Figur haelt sich fuer gemeint
    Figur „Doktor Freundlich", Text „Ich frage den Doktor Blattgold."
        -> die Figur haelt sich fuer gemeint, obwohl eine ANDERE gemeint ist

Der zweite Fall ist der schlimmere. Er ist nicht nur ein verpasster Hinweis,
sondern ein FALSCHER: ``ich_genannt`` schlaegt ``andere_genannt``, die Figur
verliert also zusaetzlich die Grenzansage, die ihr zugestanden haette.
Dieselbe Klasse trifft „Frau …", „Hauptmann …", „Alte …", „Pater …".

Die Begruendung im alten Kommentar („der Vorname genuegt") stimmt ueber die
BENUTZUNG — so sprechen Menschen ihre Figuren an. Falsch war nur, wie der
Vorname gewonnen wurde. Deshalb: JEDES Feld ab drei Buchstaben, abzueglich
einer kleinen Sperrliste aus Titeln und Partikeln.

⚠ Die Sperrliste ist bewusst KLEIN. Sie darf niemals einen Namen enthalten,
den eine Figur wirklich tragen koennte — ein Name auf der Sperrliste ist eine
Figur, die nie angesprochen wird. Deshalb steht darauf nur, was allein
niemanden bezeichnet, und deshalb faellt eine Figur, deren Name AUSSCHLIESSLICH
aus Sperrwoertern besteht („Die Alte"), auf ihre Rohteile zurueck: lieber ein
Fehlalarm als eine Figur, die unerreichbar ist.

── Warum der Genitiv mitmuss ─────────────────────────────────────────────────

    „Ich nehme Maries Tasche."     wurde NICHT erkannt
    „Ich nehme Marie die Tasche."  wurde erkannt
    „wir fahren nach Marienbad"    wurde korrekt NICHT erkannt

Der saechsische Genitiv ist im Deutschen die haeufigste flektierte Form eines
Vornamens. ``(?:s|ns)?`` vor der Wortgrenze fasst „Maries" und „Mariens",
ohne „Marienbad" zu treffen: nach „Marie" stehen dort „nb", und weder „s"
noch „ns" passen; die leere Alternative scheitert an der Wortgrenze zwischen
zwei Buchstaben. Ein weiteres ``n`` in der Liste haette dieselbe Pruefung
bestanden und trotzdem nichts gewonnen — die schwache Form („Susen") ist im
Bestand nicht belegt. Eine Endung, die nichts faengt, ist eine Endung, die
irgendwann etwas Falsches faengt.
"""

from __future__ import annotations

import re
from functools import lru_cache

__all__ = ["ANREDE_SPERRLISTE", "anrede_teile", "nennt", "nennt_muster"]

#: Woerter, die ALLEIN niemanden bezeichnen: Titel, Anreden, Partikel.
#:
#: Klein halten. Jeder Eintrag hier ist ein Wort, unter dem eine Figur nicht
#: mehr angesprochen werden kann — und Namensgebung ist die Sache des
#: Nutzers, nicht dieser Datei.
ANREDE_SPERRLISTE = frozenset(
    {
        # Deutsch
        "doktor",
        "dok",
        "professor",
        "herr",
        "frau",
        "fraeulein",
        "fräulein",
        "meister",
        "meisterin",
        "hauptmann",
        "general",
        "oberst",
        "leutnant",
        "kommissar",
        "inspektor",
        "wachtmeister",
        "pater",
        "bruder",
        "schwester",
        "mutter",
        "vater",
        "onkel",
        "tante",
        "oma",
        "opa",
        "koenig",
        "könig",
        "koenigin",
        "königin",
        "fuerst",
        "fürst",
        "graf",
        "graefin",
        "gräfin",
        "baron",
        "baronin",
        "alte",
        "alter",
        "junge",
        "junger",
        "der",
        "die",
        "das",
        "den",
        "dem",
        "des",
        "von",
        "vom",
        "zum",
        "zur",
        # Englisch und internationale Partikel
        "mister",
        "misses",
        "miss",
        "doctor",
        "captain",
        "colonel",
        "sergeant",
        "lieutenant",
        "father",
        "brother",
        "sister",
        "mother",
        "lord",
        "lady",
        "sir",
        "dame",
        "king",
        "queen",
        "count",
        "countess",
        "the",
        "van",
        "del",
        "della",
        "dos",
    }
)

#: Zeichen, die einem Namensteil anhaengen koennen, ohne zu ihm zu gehoeren.
_RANDZEICHEN = ".,;:!?()[]{}\"'„“”«»-–—"


def _kern(teil: str) -> str:
    """Ein Namensteil ohne Satzzeichen an den Raendern. „Dr." wird „Dr"."""
    return teil.strip(_RANDZEICHEN)


@lru_cache(maxsize=512)
def anrede_teile(name: str) -> tuple[str, ...]:
    """Die Wortformen, unter denen diese Person in einem Text erkannt wird.

    Jedes Feld ab drei Buchstaben, ohne Titel und Partikel. Bleibt nichts
    uebrig, gilt der Rohbestand ab drei Buchstaben — eine Figur, die nur
    Sperrwoerter im Namen traegt, muss trotzdem ansprechbar sein.

    Der VOLLE Name steht nicht eigens in der Liste: er enthaelt jeden seiner
    Teile, und wer den vollen Namen schreibt, hat damit auch einen Teil
    geschrieben.
    """
    if not name or not name.strip():
        return ()
    roh = [k for k in (_kern(t) for t in name.split()) if len(k) >= 3]
    ohne_titel = [k for k in roh if k.lower() not in ANREDE_SPERRLISTE]
    return tuple(ohne_titel or roh)


@lru_cache(maxsize=512)
def nennt_muster(name: str) -> re.Pattern[str] | None:
    """Das Suchmuster fuer diese Person, oder ``None``, wenn es keines gibt.

    ``(?:s|ns)?`` faengt den saechsischen Genitiv („Maries", „Mariens"). Die
    Wortgrenzen bleiben, damit „Marie" nicht in „Marienkaefer" trifft.
    """
    teile = anrede_teile(name)
    if not teile:
        return None
    zweig = "|".join(re.escape(t) for t in teile)
    return re.compile(rf"\b(?:{zweig})(?:s|ns)?\b", re.IGNORECASE)


def nennt(text: str, name: str) -> bool:
    """Ob dieser Text diese Person beim Namen nennt."""
    muster = nennt_muster(name)
    return bool(text) and muster is not None and muster.search(text) is not None
