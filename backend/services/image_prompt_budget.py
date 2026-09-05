"""Das Textfenster eines Bildmodells — 77 Token, und niemand sagt es dir.

DER BEFUND

Die SDXL-Abkoemmlinge kodieren ihren Prompt mit CLIP, und CLIP kann 77 Token.
Was darueber steht, wird ABGESCHNITTEN. Gemessen am 05.09.2026 an beiden
Modellen der Erwachsenenspur, im Ausgabeprotokoll des Modells selbst:

    Token indices sequence length is longer than the specified maximum
    sequence length for this model (194 > 77)
    The following part of your input was truncated because CLIP can only
    handle sequences up to 77 tokens

Von einem Prompt mit 162 Woertern ueberlebten rund 40 Prozent. Weggefallen ist
das Ende — und ans Ende schreibt eine Bildbeschreibung die dritte Figur, den
Bildausschnitt und die Lichtfuehrung. Es gab keinen Fehler, keine Warnung im
Aufrufer und kein Feld in der Antwort, das es verraten haette.

Kein Umbruch, kein `BREAK`, kein Compel: die Replicate-Huellen dieser Modelle
kennen keine Aufteilung langer Prompts. Was nicht ins Fenster passt, ist weg.

WARUM EINE NAEHERUNG UND KEIN ECHTER TOKENISIERER

Ein echter CLIP-Tokenisierer haette `transformers` und die Vokabeldatei im
Backend-Abbild noetig — dreistellige Megabyte fuer eine Zahl, die wir
konservativ schaetzen koennen. Das gemessene Verhaeltnis stammt aus der
Protokollzeile oben: 194 Token auf 162 Woerter, also rund 1,2 Token je Wort.
Mit einem Sicherheitsabstand fuer die beiden Steuertoken (`<BOS>`, `<EOS>`)
und fuer Woerter, die CLIP in mehrere Stuecke zerlegt, rechnen wir mit 1,35.

Die Naeherung irrt damit in die kurze Richtung. Das ist die richtige Richtung:
ein zu kurz geratener Prompt verliert Beiwerk, ein zu langer verliert die
Bildaussage, ohne es zu sagen.

WARUM AN EINER SATZGRENZE

Mitten im Wort zu kappen erzeugt ein Bruchstueck, das CLIP als eigenes Token
liest und das Modell als Anweisung. Ein halber Satz ist schlimmer als ein
fehlender: er sagt etwas anderes als der ganze.
"""

from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

#: Token je Wort, konservativ. Siehe Modulkopf: gemessen 1,2, gerechnet 1,35.
_TOKEN_JE_WORT = 1.35

#: Was `<BOS>` und `<EOS>` vom Fenster wegnehmen.
_STEUERTOKEN = 2

#: Satzenden, an denen gekappt werden darf.
_SATZGRENZE = re.compile(r"(?<=[.!?])\s+")


def wortbudget(max_tokens: int) -> int:
    """Wie viele Woerter in ein Fenster von ``max_tokens`` passen."""
    nutzbar = max(max_tokens - _STEUERTOKEN, 1)
    return max(int(nutzbar / _TOKEN_JE_WORT), 1)


def tokenbudget(woerter: int) -> int:
    """Die Umkehrung von `wortbudget`: wie viele Token ``woerter`` belegen.

    Gebraucht, wenn ein Aufrufer den REST eines Fensters weitergeben will —
    etwa der Szenenpfad, der die Beschreibung zuerst bedient und den
    uebrigen Platz dem Stilprompt gibt.
    """
    return max(int(woerter * _TOKEN_JE_WORT) + _STEUERTOKEN, 1)


def fit_to_token_budget(text: str, max_tokens: int, *, was: str = "prompt") -> str:
    """Auf das Fenster kuerzen — an einer Satzgrenze, und nie stillschweigend.

    ``max_tokens <= 0`` heisst „dieses Modell hat kein bekanntes Fenster";
    dann bleibt der Text, wie er ist. Das ist kein Freibrief, sondern die
    ehrliche Antwort auf eine Frage, die fuer dieses Modell niemand gemessen
    hat — und sie steht als ``0`` in der Familientabelle, nicht als geratene
    Zahl.

    Gekappt wird am letzten Satzende, das noch ins Budget passt. Gibt es
    keines (ein einziger langer Satz), wird an der Wortgrenze gekappt: dann
    ist ein Bruchstueck unvermeidlich, aber es ist wenigstens ein ganzes Wort.
    """
    if max_tokens <= 0:
        return text

    budget = wortbudget(max_tokens)
    woerter = text.split()
    if len(woerter) <= budget:
        return text

    saetze = _SATZGRENZE.split(text)
    gekuerzt = ""
    gezaehlt = 0
    for satz in saetze:
        laenge = len(satz.split())
        if gezaehlt + laenge > budget:
            break
        gekuerzt = f"{gekuerzt} {satz}".strip()
        gezaehlt += laenge

    if not gekuerzt:
        # Ein einziger Satz, laenger als das Budget. An der Wortgrenze kappen.
        gekuerzt = " ".join(woerter[:budget])
        gezaehlt = budget

    logger.warning(
        "Bildprompt auf das CLIP-Fenster gekuerzt",
        extra={
            "was": was,
            "max_tokens": max_tokens,
            "wortbudget": budget,
            "woerter_vorher": len(woerter),
            "woerter_nachher": gezaehlt,
            "anteil_erhalten": round(gezaehlt / len(woerter), 2),
        },
    )
    return gekuerzt
