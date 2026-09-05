"""Eine Bildbuchung nennt das Modell, das gelaufen ist -- nie ein Literal.

DER BEFUND, GEGEN PRODUKTION GEMESSEN (05.09.2026)

``ForgeImageService`` bucht an sechs Stellen Bildnutzung. Fuenf uebergaben
``image_model.model``, eine -- das Banner -- ein hartes
``"replicate/image-model"``. Das ist kein Modellname, sondern ein Platzhalter,
und die Variable mit dem echten Modell stand zwei Aufrufe darueber im
Gueltigkeitsbereich.

Wirkung auf Prod, ueber fuenf Monate:

    replicate/image-model   0.031   22 Zeilen   $0.68   09.04. - 29.08.2026

$0.68 von $11.89 -- 5,7 % der Gesamtsumme -- unter einem Namen, den es nicht
gibt. Und zum RUECKFALLPREIS, denn ein Platzhalter steht in keiner Preisliste:
die Zahl war nie eine Messung, sah in der Auswertung aber genauso aus wie eine.
Die Modellachse zeigte den Platzhalter als eigenes "Modell".

WARUM EIN TOR UND KEIN REVIEW

Die falsche Stelle war von den fuenf richtigen nicht zu unterscheiden, solange
man nicht danebenlegt -- und eine sechste Stelle kommt irgendwann dazu. Das Tor
prueft die FORM des Aufrufs per AST, nicht seinen Text: jedes erste Argument an
``_log_image_usage`` muss ein Ausdruck sein, kein Zeichenkettenliteral.

WAS ES NICHT PRUEFT

Ob der uebergebene Ausdruck das RICHTIGE Modell nennt. Das kann eine statische
Pruefung nicht wissen; sie kann nur ausschliessen, dass an dieser Stelle
ueberhaupt eine feste Zeichenkette steht -- und genau das war der Fehler.
"""

import ast
from pathlib import Path

QUELLE = Path(__file__).resolve().parents[3] / "backend" / "services" / "forge_image_service.py"

#: Die Methode, deren erstes Argument nie ein Literal sein darf.
METHODE = "_log_image_usage"


def _aufrufe() -> list[ast.Call]:
    baum = ast.parse(QUELLE.read_text(encoding="utf-8"))
    return [
        knoten
        for knoten in ast.walk(baum)
        if isinstance(knoten, ast.Call) and isinstance(knoten.func, ast.Attribute) and knoten.func.attr == METHODE
    ]


def test_das_tor_findet_seinen_gegenstand() -> None:
    """Erst die Bedingung herstellen, dann pruefen.

    Ohne diesen Test bestuende das Tor auch dann, wenn eine Umbenennung die
    Suche ins Leere laufen liesse -- es haette null Aufrufe geprueft und null
    Fehler gefunden. Das ist kein Bestehen.
    """
    assert QUELLE.exists(), f"{QUELLE} gibt es nicht mehr"
    aufrufe = _aufrufe()
    assert len(aufrufe) >= 5, (
        f"nur {len(aufrufe)} Aufrufe von {METHODE} gefunden -- "
        "wurde die Methode umbenannt? Dann prueft dieses Tor nichts mehr."
    )


def test_keine_bildbuchung_nennt_ein_literal() -> None:
    """Das erste Argument ist ein Ausdruck, nie eine feste Zeichenkette."""
    verstoesse: list[str] = []
    for aufruf in _aufrufe():
        if not aufruf.args:
            continue
        erstes = aufruf.args[0]
        if isinstance(erstes, ast.Constant) and isinstance(erstes.value, str):
            verstoesse.append(f"Zeile {erstes.lineno}: {METHODE}({erstes.value!r}, ...)")

    assert not verstoesse, (
        "Eine Bildbuchung nennt ein Literal statt des gelaufenen Modells.\n"
        "Die Modellachse der Kostenauswertung zeigt diesen Text dann als\n"
        "eigenes Modell, und der Betrag ist der Rueckfallpreis -- eine Zahl,\n"
        "die aussieht wie eine Messung und keine ist.\n\n" + "\n".join(verstoesse)
    )
