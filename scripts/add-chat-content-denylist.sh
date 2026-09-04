#!/usr/bin/env bash
# add-chat-content-denylist.sh — einen Satz sperren, ohne ihn aufzuschreiben.
#
# Run: bash scripts/add-chat-content-denylist.sh 'der zu sperrende Satz'
#
# Der Satz wird normalisiert, sein erstes Fenster von fuenf Woertern gehasht
# und der Hash an scripts/chat-content-denylist.txt angehaengt. Der Satz selbst
# verlaesst diese Shell nie — er steht weder in der Liste noch in der
# Commit-Nachricht, mit der du sie eintraegst. Genau das ist der Zweck.
set -euo pipefail
[ $# -eq 1 ] || { echo "Ein Argument: der zu sperrende Satz (in Anfuehrungszeichen)." >&2; exit 2; }
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.."
PY="backend/.venv/bin/python"; [ -x "$PY" ] || PY="python3"
"$PY" - "$1" <<'PYEOF'
import hashlib, re, sys, unicodedata
from pathlib import Path
t = sys.argv[1].lower()
for a, b in (("ä","ae"),("ö","oe"),("ü","ue"),("ß","ss")): t = t.replace(a, b)
t = unicodedata.normalize("NFKD", t)
t = "".join(c for c in t if not unicodedata.combining(c))
w = re.sub(r"[^a-z0-9]+", " ", t).split()
if len(w) < 5:
    sys.exit("Zu kurz: die Sperre braucht mindestens fuenf Woerter, sonst trifft sie Unbeteiligte.")
h = hashlib.sha256(" ".join(w[:5]).encode()).hexdigest()[:24]
p = Path("scripts/chat-content-denylist.txt")
vorhanden = {z.strip() for z in p.read_text(encoding="utf-8").splitlines() if z.strip() and not z.startswith("#")}
if h in vorhanden:
    print(f"schon gesperrt ({h})"); raise SystemExit(0)
kopf, rest = p.read_text(encoding="utf-8").split("\n\n", 1)
p.write_text(kopf + "\n\n" + "\n".join(sorted(vorhanden | {h})) + "\n", encoding="utf-8")
print(f"gesperrt: {h}  (insgesamt {len(vorhanden)+1} Eintraege)")
PYEOF
