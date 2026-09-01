#!/usr/bin/env python3
"""Prüft Epigraphe gegen den VOLLTEXT ihres angeblichen Werks — nicht gegen ein Modell.

    python3 scripts/verify_public_domain_quotes.py [--json pfad] [--offline]

WARUM DIESES WERKZEUG SO GEBAUT IST UND NICHT ANDERS
=====================================================
Die naheliegende Lösung wäre, ein (billiges) Sprachmodell zu fragen: „Ist dieses
Kafka-Zitat echt?" Das ist genau das Werkzeug, das den Fehler erzeugt hat.

Ein Sprachmodell kann ein Zitat nicht PRÜFEN. Es kann plausiblen Text darüber
erzeugen, ob eines existiert — und irrt dabei in beide Richtungen: es bestätigt
Erfundenes, weil es richtig klingt, und verwirft Echtes, weil es die Fassung
nicht kennt. Ein falsches „geprüft ✓" ist schlimmer als gar keine Prüfung: es
wäscht die Fälschung zu etwas, das auditiert aussieht.

Deshalb urteilt dieses Werkzeug nicht. Es lädt den Volltext des angeblichen
Werks und sucht die Zeichenkette. Das Ergebnis ist eine FUNDSTELLE oder ihr
belegtes Fehlen — beides kann ein Mensch nachschlagen.

WAS ES NICHT KANN, UND WARUM DAS AUFGESCHRIEBEN GEHÖRT
=======================================================
* **Nur gemeinfreie Werke.** Foucault, Bataille, Fisher, Pallasmaa, Luhmann,
  Serres, Augé, Benjamin, Bakhtin liegen nicht als Volltext vor. Für sie lautet
  das ehrliche Ergebnis „aus offenen Quellen nicht verifizierbar" — und daraus
  folgt nicht „vermutlich echt", sondern: gehört in die Weltstimme.
* **Übersetzungen sind kein Beweis.** Kafka schrieb deutsch, das Zitat im Spiel
  steht englisch. Eine Suche im deutschen Original findet die englische Fassung
  nie. Solche Fälle werden als SPRACHE gemeldet und mit einem
  Inhaltswort-Anker im Original gesucht, damit ein Mensch die Stelle vergleichen
  kann — das Urteil bleibt bei ihm.
* **Ein NICHT GEFUNDEN ist kein Beweis der Fälschung**, wenn die Ausgabe eine
  andere ist. Deshalb nennt der Bericht immer die benutzte Quelle.

🔑 Die Regel: Belege, keine Verdikte.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
import urllib.request
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".quote-source-cache"


@dataclass(frozen=True)
class Source:
    """Ein gemeinfreier Volltext, gegen den geprüft werden kann."""

    author: str  #: wie er in der Zuschreibung steht (Teilstring genügt)
    work: str  #: Titelfragment, oder "" für „jedes Werk dieses Autors"
    url: str
    language: str  #: Sprache DIESES Textes
    note: str = ""


#: Kuratiert, nicht geraten. Jede Zeile nennt eine Ausgabe, die ein Mensch
#: nachschlagen kann. Fehlt ein Werk hier, ist das Ergebnis „keine Quelle" —
#: nicht „echt".
SOURCES: tuple[Source, ...] = (
    Source(
        "Whitman",
        "Song of Myself",
        "https://www.gutenberg.org/files/1322/1322-0.txt",
        "en",
        "Leaves of Grass, Gutenberg 1322",
    ),
    Source(
        "Wilde", "Importance of Being Earnest", "https://www.gutenberg.org/files/844/844-0.txt", "en", "Gutenberg 844"
    ),
    Source(
        "Poe",
        "",
        "https://www.gutenberg.org/files/10031/10031-8.txt",
        "en",
        "The Raven and other poems / Poetical Works, Gutenberg 10031",
    ),
    Source(
        "Kafka",
        "Zürau",
        "https://www.gutenberg.org/cache/epub/69326/pg69326.txt",
        "de",
        "Betrachtungen über Sünde, Leid, Hoffnung und den wahren Weg (Zürauer Aphorismen)",
    ),
    Source(
        "Jarry",
        "Ubu",
        "https://www.gutenberg.org/cache/epub/70017/pg70017.txt",
        "fr",
        "Ubu Roi, französisches Original",
    ),
    Source(
        "Lao Tzu",
        "Tao Te Ching",
        "https://www.gutenberg.org/cache/epub/216/pg216.txt",
        "en",
        "Legge-Übersetzung, Gutenberg 216",
    ),
    Source(
        "Gospel of John", "", "https://www.gutenberg.org/cache/epub/10/pg10.txt", "en", "King James Bible, Gutenberg 10"
    ),
    Source("Haldane", "Possible Worlds", "", "en", "kein offener Volltext gefunden"),
    Source(
        "Blake",
        "",
        "https://www.gutenberg.org/cache/epub/574/pg574.txt",
        "en",
        "Poems of William Blake, Gutenberg 574 — Briefe NICHT enthalten",
    ),
)

#: Autoren, deren Werk mit Sicherheit NICHT gemeinfrei vorliegt. Sie werden als
#: „nicht prüfbar" gemeldet, damit niemand ihr Fehlen für ein Urteil hält.
NOT_PUBLIC_DOMAIN = (
    "Foucault",
    "Bataille",
    "Fisher",
    "Pallasmaa",
    "Luhmann",
    "Serres",
    "Augé",
    "Auge",
    "Benjamin",
    "Bakhtin",
    "Borges",
    "Beauvoir",
    "Beckett",
    "Atwood",
    "Jung",
    "Baudrillard",
    "Camus",
    "Burroughs",
    "Dick",
    "Ginsberg",
    "Pound",
    "Eliot",
    "Mies",
    "Kahn",
    "Venturi",
    "Le Corbusier",
    "Mauss",
    "Bachelard",
    "Scott",
    "Napoleon",
)

_PUNCT = re.compile(r"[^\w\s]", re.UNICODE)
_WS = re.compile(r"\s+")


def normalise(text: str) -> str:
    """Alles weg, was zwischen zwei Ausgaben desselben Satzes schwanken darf."""
    text = unicodedata.normalize("NFKD", text)
    text = text.replace("’", "'").replace("‘", "'")
    text = text.replace("“", '"').replace("”", '"')
    text = text.replace("–", "-").replace("—", "-")
    text = _PUNCT.sub(" ", text.lower())
    # Verszahlen und Zeilennummern raus: die King-James-Ausgabe schreibt
    # "1:1 In the beginning was the Word", und ein exakter Vergleich scheiterte
    # daran, obwohl der Satz woertlich dasteht. Ein Messgeraet, das an der
    # Zaehlung des Setzers scheitert, misst den Setzer.
    text = re.sub(r"\b\d+\b", " ", text)
    return _WS.sub(" ", text).strip()


def split_quote(epigraph: str) -> tuple[str, str]:
    """Zitat und Zuschreibung trennen. Die Zuschreibung ist der Teil nach dem
    letzten Gedankenstrich, das Zitat der Rest."""
    parts = re.split(r"\s[-–—]\s", epigraph)
    if len(parts) < 2:
        return epigraph.strip(), ""
    return " - ".join(parts[:-1]).strip().strip("\"'“”‘’"), parts[-1].strip()


def fetch(url: str, *, offline: bool) -> str | None:
    """Volltext holen, mit Zwischenspeicher — eine Prüfung soll wiederholbar sein
    und nicht bei jedem Lauf fremde Server belasten."""
    if not url:
        return None
    CACHE.mkdir(exist_ok=True)
    key = CACHE / (re.sub(r"\W+", "_", url)[-90:] + ".txt")
    if key.exists():
        return key.read_text(encoding="utf-8", errors="ignore")
    if offline:
        return None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "velgarien-quote-check/1.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310 — kuratierte URL-Liste
            body = resp.read().decode("utf-8", errors="ignore")
    except Exception as exc:  # noqa: BLE001 — jede Netzstörung ist hier dasselbe Ergebnis
        print(f"    (Quelle nicht erreichbar: {exc})", file=sys.stderr)
        return None
    key.write_text(body, encoding="utf-8")
    return body


def pick_source(attribution: str) -> tuple[Source | None, bool]:
    """Quelle und ob sie das GENANNTE Werk ist.

    Der zweite Rueckgabewert ist wichtiger als er aussieht. Nennt eine
    Zuschreibung kein Werk ("Oscar Wilde"), faellt die Suche auf irgendein Werk
    desselben Autors zurueck -- und ein "nicht gefunden" beweist dann nur, dass
    der Satz nicht in DIESEM Buch steht. Das als Befund zu melden hiesse, eine
    andere Frage zu beantworten als die gestellte.
    """
    for s in SOURCES:
        if s.author.lower() in attribution.lower() and s.work and s.work.lower() in attribution.lower():
            return s, True
    for s in SOURCES:
        if s.author.lower() in attribution.lower() and not s.work:
            return s, True
    for s in SOURCES:
        if s.author.lower() in attribution.lower():
            return s, False
    return None, False


def anchor_words(quote: str, n: int = 4) -> list[str]:
    """Die seltensten n Wörter des Zitats — sie überleben eine andere Ausgabe
    eher als der ganze Satz."""
    words = [w for w in normalise(quote).split() if len(w) > 4]
    return sorted(set(words), key=len, reverse=True)[:n]


def check(epigraph: str, *, offline: bool) -> dict:
    quote, attribution = split_quote(epigraph)
    out = {"epigraph": epigraph, "quote": quote, "attribution": attribution}

    if not attribution:
        out["verdict"] = "KEINE ZUSCHREIBUNG"
        return out

    if any(a.lower() in attribution.lower() for a in NOT_PUBLIC_DOMAIN):
        out["verdict"] = "NICHT PRUEFBAR"
        out["reason"] = "kein gemeinfreier Volltext — das ist KEIN Urteil ueber die Echtheit"
        return out

    src, exact_work = pick_source(attribution)
    if src is None or not src.url:
        out["verdict"] = "KEINE QUELLE"
        out["reason"] = "kein Volltext in der kuratierten Liste"
        return out

    text = fetch(src.url, offline=offline)
    out["source"] = f"{src.note} <{src.url}>"
    if text is None:
        out["verdict"] = "QUELLE NICHT ERREICHBAR"
        return out

    hay = normalise(text)
    needle = normalise(quote)
    if needle and needle in hay:
        i = hay.index(needle)
        out["verdict"] = "GEFUNDEN"
        out["context"] = hay[max(0, i - 60) : i + len(needle) + 60]
        return out

    # Nicht wortgleich. Sprache pruefen, bevor daraus ein Befund wird.
    if src.language != "en":
        # KEINE Ankerwoerter hier. Der erste Lauf suchte englische Woerter
        # ("skeleton", "cupboard") im franzoesischen Ubu Roi und meldete
        # "nein" -- das sah nach einem Befund aus und war eine Tautologie.
        out["verdict"] = "SPRACHE"
        out["reason"] = (
            f"Zitat steht englisch, die Quelle ist {src.language}. Eine Zeichenkettensuche "
            "kann das nicht entscheiden; die Stelle gehoert von Hand verglichen."
        )
        return out

    if not exact_work:
        out["verdict"] = "QUELLE PASST NICHT"
        out["reason"] = (
            "Die Zuschreibung nennt kein Werk. Geprueft wurde ein anderes Werk desselben "
            "Autors -- ein Fehlen beweist hier nichts ueber das Zitat."
        )
        return out

    out["verdict"] = "NICHT GEFUNDEN"
    out["reason"] = "wortgleich nicht im Volltext dieser Ausgabe"
    out["anchors"] = {w: (w in hay) for w in anchor_words(quote)}
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--json", type=Path, help="JSON-Liste mit Objekten, die ein Feld 'epigraph' tragen")
    ap.add_argument("--offline", action="store_true", help="nur den Zwischenspeicher benutzen")
    args = ap.parse_args()

    if not args.json or not args.json.exists():
        print("Bitte --json mit einem Dump der Epigraphe angeben.", file=sys.stderr)
        return 2

    rows = json.loads(args.json.read_text(encoding="utf-8"))
    results = [check((r.get("epigraph") or "").strip(), offline=args.offline) for r in rows if r.get("epigraph")]

    order = [
        "NICHT GEFUNDEN",
        "SPRACHE",
        "QUELLE PASST NICHT",
        "GEFUNDEN",
        "QUELLE NICHT ERREICHBAR",
        "KEINE QUELLE",
        "NICHT PRUEFBAR",
        "KEINE ZUSCHREIBUNG",
    ]
    counts = {v: sum(1 for r in results if r["verdict"] == v) for v in order}
    print("\n".join(f"  {v:26s} {counts[v]:3d}" for v in order if counts[v]))
    print()

    for verdict in ("NICHT GEFUNDEN", "SPRACHE", "QUELLE PASST NICHT", "GEFUNDEN"):
        rs = [r for r in results if r["verdict"] == verdict]
        if not rs:
            continue
        print(f"── {verdict} ──")
        for r in rs:
            print(f'  „{r["quote"][:78]}"')
            print(f"     zugeschrieben: {r['attribution'][:70]}")
            print(f"     Quelle:        {r.get('source', '-')}")
            if r.get("anchors"):
                hits = ", ".join(f"{w}={'ja' if ok else 'nein'}" for w, ok in r["anchors"].items())
                print(f"     Ankerwoerter:  {hits}")
            if r.get("context"):
                print(f"     Fundstelle:    …{r['context'][:120]}…")
            print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
