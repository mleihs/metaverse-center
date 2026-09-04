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

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

PY="backend/.venv/bin/python"
[ -x "$PY" ] || PY="python3"

"$PY" - "$@" <<'PYEOF'
import re, subprocess, sys

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
    ("zugeschriebenes Zitat",
     re.compile(r'(Nutzer|Nutzers|User|Mensch)[^\n]{0,45}[:—-][ \t]*„[^"]{10,}"')),
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
    for i, zeile in enumerate(text.split("\n"), 1):
        for name, p in MUSTER:
            if p.search(zeile):
                funde.append((herkunft, i, name, zeile.strip()[:90]))

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
