#!/usr/bin/env bash
# lint-no-chat-content.sh — kein Gespraechs-Wortlaut im Repo.
# Run: bash scripts/lint-no-chat-content.sh
# Exit: 0 = sauber, 1 = Fund.
#
# WARUM ES DIESES TOR GIBT
#
# Am 04.09.2026 stand woertlicher Inhalt aus einem echten Gespraech an drei
# Sorten von Orten: in Commit-Nachrichten, in Kommentaren und Docstrings, und
# — am schwersten zu bemerken — in TESTFIXTURES, also genau dort, wo man
# Beispieldaten fuer erfunden haelt. Darunter Saetze, die der Nutzer selbst
# geschrieben hatte. Dieses Repo ist oeffentlich.
#
# Der Grund, warum es hineingeriet, ist kein Versehen, sondern eine
# Versuchung: ein echter Auszug BELEGT einen Befund besser als ein erfundener.
# Genau deshalb braucht es ein Tor und keinen Vorsatz.
#
# DIE REGEL
#   Kein Wortlaut aus einem echten Gespraech — weder Nachrichten von Agenten
#   noch Zeilen des Nutzers, weder im Code, in Doku, Migrationen, Tests, noch
#   in einer Commit-Nachricht. Messwerte, Zeilennummern, Zaehlungen und die
#   FORM eines Verlaufs sind erlaubt und meist aussagekraeftiger.
#
#   Beispiele gehoeren erfunden und harmlos zu sein.
#
# WAS ES NICHT VERBIETET
#   Agentennamen als solche. Sie stehen in der Saat, in der Spielhilfe und auf
#   der oeffentlichen Seite — das ist die Besetzung der Welt, kein privater
#   Verlauf. Gepruefte Muster sind Sprechermarken MIT Text, Protokollzeilen
#   mit Zeitstempel, Rollenzeilen und zugeschriebene Zitate.
#
# ZWEI BEINE, UND WARUM ES ZWEI BRAUCHT
#
#   (1) MUSTER erkennen die FORM einer Gespraechszeile. Sie fangen auch, was
#       niemand vorher gesehen hat — und genau deshalb sind sie unscharf.
#   (2) Die SPERRLISTE erkennt bekannten Wortlaut, unabhaengig von jeder Form.
#
#   Das zweite Bein gibt es, weil das erste VIERMAL danebengegriffen hat:
#   ein Zitat in Klammern statt nach Doppelpunkt, ein Zitat ohne
#   Anfuehrungsstriche, eines ueber zwei Zeilen umgebrochen, und eine Aussage,
#   die als eigener Befund umformuliert war und den Wortlaut trotzdem trug.
#   Jedes Mal meldete das Tor PASS. Ein Messgeraet, das seine eigene Blindheit
#   nicht kennt, braucht ein zweites, das anders misst.
#
#   Die Sperrliste steht in `scripts/chat-content-denylist.txt` und fuehrt nur
#   HASHES. Eine Sperrliste im Klartext waere das Leck, das sie schliessen soll.

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

PY="backend/.venv/bin/python"
[ -x "$PY" ] || PY="python3"

"$PY" - "$@" <<'PYEOF'
import hashlib, re, subprocess, sys, unicodedata
from pathlib import Path

# ── Bein 2: Sperrliste aus Hashes ──────────────────────────────────────────
FENSTER = 5

def normwoerter(text: str) -> list[str]:
    """Klein, Umlaute ausgeschrieben, alles andere ist Trenner.

    Die Normalisierung ist der Grund, warum das Bein nicht an der Form haengt:
    „fuer" und „für", Zitat und Umschreibung, Kommentar und Zeichenkette
    ergeben dieselbe Wortfolge — und damit denselben Hash.
    """
    text = text.lower()
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
        text = text.replace(a, b)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", text).split()

def lade_sperrliste() -> set[str]:
    p = Path("scripts/chat-content-denylist.txt")
    if not p.exists():
        return set()
    return {z.strip() for z in p.read_text(encoding="utf-8").splitlines()
            if z.strip() and not z.startswith("#")}

SPERRE = lade_sperrliste()

# Beschriftungen der Oberflaeche und Fachbegriffe, die neben dem Wort „Nutzer"
# stehen duerfen. Jeder Eintrag hier ist eine Behauptung, dass diese Zeichen
# aus dem PRODUKT stammen und nicht aus einem Gespraech — nur mit Beleg
# ergaenzen.
ZITAT_FREI = (
    "Is Architect",
    "Simulation Forge Access",
    "Chronik erzeugen",
    "Command Stage",
    "/users/me",
)

def sperrtreffer(text: str) -> bool:
    if not SPERRE:
        return False
    w = normwoerter(text)
    for i in range(len(w) - FENSTER + 1):
        h = hashlib.sha256(" ".join(w[i:i + FENSTER]).encode()).hexdigest()[:24]
        if h in SPERRE:
            return True
    return False

# Ein Kommentarzeichen davor. GENAU DARAN ist die erste Fassung dieses Tores
# gescheitert: sie verlangte den Zeilenanfang, und die echten Fundstellen
# standen samt und sonders in Kommentaren („#:", „--", „ * "). Ein Tor, das
# den Vorfall nicht faengt, der es ausgeloest hat, ist keines.
VOR = r'^[ \t]*(?:[#*]+:?|--+|//+|\*)?[ \t]*'

MUSTER = [
    ("Protokollzeile mit Zeitstempel",
     re.compile(VOR + r'\d{1,2}:\d{2}(:\d{2})?[ \t]+[A-ZÄÖÜ][a-zäöüß]{2,}[ \t]*[:,][ \t]*\S')),
    ("Rollenzeile aus einem Verlauf",
     re.compile(VOR + r'(user|assistant)[ \t]{2,}(?!<)\S{6,}')),
    # DIE ZUSCHREIBUNG IST DAS SIGNAL, NICHT DER WORTLAUT.
    #
    # Die erste Fassung verlangte einen Doppelpunkt oder Gedankenstrich vor dem
    # Zitat. Damit lief sie an jeder Klammer vorbei — und an jedem Zitat, das
    # ueber zwei Zeilen ging. Ein formbasierter Suchlauf ohne diese Verengung
    # fand danach SIEBZEHN weitere Fundstellen in Dateien und Nachrichten, die
    # drei vorherige Suchen uebersehen hatten.
    #
    # Deshalb jetzt: Zuschreibung, dann irgendwas bis zum Anfuehrungszeichen,
    # dann ein Zitat ab 14 Zeichen. Kurze Zitate bleiben frei, weil dort fast
    # immer eine Beschriftung der Oberflaeche steht und kein Gespraech.
    ("zugeschriebenes Zitat",
     re.compile(r'(Nutzers?|User|Mensch(en)?|Anwender)[^\n„"]{0,60}[:,(—-]?[ \t]*„[^"]{14,}"')),
    # Eine Sprechermarke MIT Text ist eine Gespraechszeile. Erlaubt sind genau
    # die erfundenen Testfiguren — an ihnen erkennt man auf einen Blick, dass
    # ein Beispiel ein Beispiel ist. Jeder ANDERE Zweiwortname an dieser Stelle
    # ist vermutlich jemand aus der echten Besetzung.
    ("Sprechermarke mit Text",
     re.compile(r'\[(?!Marie Morgenrot|Benno Blattgold|Suse Sonnenblum|Doktor Freundlich|Agent [A-Z]|Name)'
                r'[A-ZÄÖÜ][a-zäöüß]{2,}[ \t]+[A-ZÄÖÜ][a-zäöüß]{2,}\][ \t]*:[ \t]*(?![<`\s]*$)[^\s<`]')),
    # Auch OHNE Doppelpunkt: eine Marke der echten Besetzung, mitten im Text.
    ("Marke der echten Besetzung",
     re.compile(r'\[(Mira Steinfeld|Lena Kray|Elena Voss|Doktor Fenn)\]')),
]

def pruefe(text, herkunft, funde):
    zeilen = text.split("\n")
    for i, zeile in enumerate(zeilen, 1):
        for name, p in MUSTER:
            if name == "zugeschriebenes Zitat":
                continue  # laeuft unten ueber ein Fenster, nicht zeilenweise
            if p.search(zeile):
                funde.append((herkunft, i, name, zeile.strip()[:90]))

    # Ein Zitat bricht um. Zeilenweise gesucht, findet man dann die Zuschreibung
    # ohne ihr Zitat und das Zitat ohne seine Zuschreibung — und beides ist
    # unauffaellig. Also ueber drei Zeilen am Stueck.
    zitat = dict(MUSTER)["zugeschriebenes Zitat"]
    for i in range(len(zeilen)):
        fenster = " ".join(zeilen[i:i + 3])
        # Das Fenster normalisieren, bevor die Freiliste greift: eine
        # Beschriftung, die ueber zwei Zeilen umbricht („Chronik\n# erzeugen"),
        # traf sonst keinen Eintrag und meldete sich als Fund.
        flach = re.sub(r"[\s#*/-]+", " ", fenster)
        if zitat.search(fenster) and not any(g in flach for g in ZITAT_FREI):
            funde.append((herkunft, i + 1, "zugeschriebenes Zitat",
                          zeilen[i].strip()[:90]))
            break

    # Die Sperrliste laeuft ueber ein FENSTER von drei Zeilen, nicht ueber
    # einzelne. Ein umgebrochenes Zitat war einer der vier Faelle, an denen die
    # zeilenweise Musterpruefung vorbeilief.
    for i in range(len(zeilen)):
        if sperrtreffer(" ".join(zeilen[i:i + 3])):
            funde.append((herkunft, i + 1, "Sperrliste: bekannter Wortlaut",
                          "<nicht wiedergegeben — siehe chat-content-denylist.txt>"))
            break

funde = []
dateien = subprocess.run(["git", "ls-files"], capture_output=True, text=True).stdout.split("\n")
for f in dateien:
    if not f or f.startswith(("frontend/src/locales/", "content/")):
        continue
    try:
        pruefe(open(f, encoding="utf-8").read(), f, funde)
    except Exception:
        continue

# Die letzten 50 Commit-Nachrichten: weiter zurueck ist Historie, die nur ein
# Umschreiben aendert — dieses Tor soll das NAECHSTE Mal verhindern.
shas = subprocess.run(["git", "log", "-50", "--format=%H"], capture_output=True, text=True).stdout.split()
for sha in shas:
    b = subprocess.run(["git", "log", "-1", "--format=%B", sha], capture_output=True, text=True).stdout
    kurz = subprocess.run(["git", "log", "-1", "--format=%h %s", sha], capture_output=True, text=True).stdout.strip()
    pruefe(b, f"commit {kurz[:60]}", funde)

if funde:
    print("ERROR: Gespraechs-Wortlaut gefunden. Er gehoert nirgends ins Repo.")
    print("       Messwerte und die FORM eines Verlaufs statt des Wortlauts;")
    print("       Beispiele erfunden und harmlos.\n")
    for herkunft, i, name, zeile in funde:
        print(f"  {herkunft}:{i}  [{name}]")
        print(f"      {zeile}")
    print(f"\nFAIL: {len(funde)} Fund(e).")
    sys.exit(1)

print(f"PASS: kein Gespraechs-Wortlaut in {len(dateien)} Dateien und 50 Commit-Nachrichten.")
PYEOF
