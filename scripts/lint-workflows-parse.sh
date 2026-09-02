#!/usr/bin/env bash
# lint-workflows-parse.sh — do the CI workflow files still parse?
#
# WHY THIS EXISTS
#   On 2026-08-31 a deploy failed because a comment in `_colors.css` had lost
#   its closing marker and the text stood in the file as bare CSS. All 24 gates
#   were green, and every one of them was right: tsc does not look at .css,
#   biome lints TypeScript, the token gate greps for hex, the backtick gate
#   checks css`…` templates INSIDE TypeScript. Nobody was responsible for a
#   .css file as a whole, and the green summary suggested a coverage no gate
#   had promised.
#
#   That is its own kind of defect — not a guard that cannot fire, but no guard
#   at all — and the honest question afterwards was not "is this one closed"
#   but "where else is nobody responsible".
#
#   Measured across the repo by file type: `.github/workflows/*.yml` was the
#   answer, and it is the worst instance of the class. **The files that start
#   every other gate are themselves unparsed**, and their failure mode is
#   SILENCE: a malformed workflow does not turn CI red, it stops CI from
#   running. Nothing would go red. Things would simply stop being checked.
#
# WHAT IT CHECKS
#   That each workflow parses as YAML, and that it declares the two keys
#   without which GitHub ignores it entirely (`on`, `jobs`). Nothing else —
#   not whether the steps are sensible, not whether the actions exist. A gate
#   that promises everything checks nothing in the end.
#
# WHERE THIS LIVES
#   `scripts/`, not `frontend/scripts/`. The first draft sat in the frontend
#   because that is where I happened to be working, and `lint-lint-scripts-
#   anchored.sh` caught it — not as a formatting complaint but as a
#   misplacement: a gate whose subject is the repository root cannot anchor
#   itself to the frontend without walking back out, and walking back out is
#   exactly the shape that makes a gate pass from one directory and fail from
#   another.
#
# Exit code: 0 = pass, 1 = a workflow does not parse.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

WORKFLOWS=".github/workflows"
if [ ! -d "$WORKFLOWS" ]; then
  echo "PASS: no $WORKFLOWS directory, nothing to parse."
  exit 0
fi

PY="python3"
[ -x ".venv/bin/python" ] && PY=".venv/bin/python"

"$PY" - "$WORKFLOWS" <<'PYEOF'
import sys, pathlib
try:
    import yaml
except ImportError:
    print("SKIP: pyyaml not available; workflow parsing not checked.")
    print("      This is a SKIP, not a PASS - nobody looked.")
    sys.exit(0)

root = pathlib.Path(sys.argv[1])
files = sorted(list(root.glob("*.yml")) + list(root.glob("*.yaml")))
if not files:
    print(f"PASS: no workflow files under {root}.")
    sys.exit(0)

bad = 0
for f in files:
    try:
        doc = yaml.safe_load(f.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        mark = getattr(exc, "problem_mark", None)
        where = f":{mark.line + 1}:{mark.column + 1}" if mark else ""
        print(f"ERROR: {f}{where} does not parse — {getattr(exc, 'problem', exc)}")
        bad += 1
        continue
    if not isinstance(doc, dict):
        print(f"ERROR: {f} is not a mapping at the top level.")
        bad += 1
        continue
    # GitHub parses `on:` as the boolean True unless quoted — accept both, and
    # say so, because a reader who greps for "'on'" and finds nothing would
    # otherwise think the key is missing.
    has_on = "on" in doc or True in doc
    missing = [k for k, ok in (("on", has_on), ("jobs", "jobs" in doc)) if not ok]
    if missing:
        print(f"ERROR: {f} parses but declares no {', '.join(missing)} — "
              "GitHub would ignore it in silence.")
        bad += 1

# ── Ein Schritt, der ein Wurzel-Skript aus einem Job mit eigener
#    Arbeitsverzeichnis-Vorgabe aufruft, MUSS sie aufheben ──────────────────
#
# `lint-frontend` laeuft per Vorgabe in `frontend/`. Ein Schritt, der dort
# `bash scripts/…` aufruft, findet die Datei nicht und bricht mit 127 ab. Das
# ist nicht still — aber es sieht aus wie ein Lint-Verstoss und nicht wie eine
# fehlende Datei, und in einem ohnehin roten Lauf liest es niemand.
#
# Am 02.09.2026 genau so passiert, und zwar durch MICH: beim Einfuegen eines
# neuen Schrittes endete mein Suchmuster hinter der `run:`-Zeile, sodass das
# darunterstehende `working-directory: .` an den neuen Schritt fiel und dem
# alten fehlte. Getroffen hat es `lint-migration-order.sh` — das Tor, dessen
# Wert ich denselben Tag lang belegt hatte.
schritt_fehler = 0
for f in files:
    doc = yaml.safe_load(pathlib.Path(f).read_text(encoding="utf-8"))
    if not isinstance(doc, dict):
        continue
    for jid, job in (doc.get("jobs") or {}).items():
        vorgabe = ((job.get("defaults") or {}).get("run") or {}).get("working-directory")
        if not vorgabe or vorgabe == ".":
            continue
        for schritt in job.get("steps") or []:
            run = (schritt.get("run") or "").strip()
            if not run or "scripts/" not in run:
                continue
            # Ein `cd` im Befehl selbst regelt es auch.
            if run.startswith("cd ") or "&& cd " in run:
                continue
            if schritt.get("working-directory") == ".":
                continue
            print(f"ERROR: {f}, Job '{jid}' laeuft in '{vorgabe}', aber der Schritt")
            print(f"       '{schritt.get('name', '(ohne Namen)')}' ruft ein Wurzel-Skript auf,")
            print("       ohne `working-directory: .` — das gibt Exit 127, und das sieht")
            print("       aus wie ein Lint-Verstoss statt wie eine fehlende Datei.")
            schritt_fehler += 1

if bad:
    print()
    print(f"{bad} workflow file(s) would not run. Nothing else would go red:")
    print("a workflow that does not parse is not a failing gate, it is an absent one.")
    sys.exit(1)

if schritt_fehler:
    print()
    print(f"{schritt_fehler} Schritt(e) wuerden ihr Skript nicht finden.")
    sys.exit(1)

print(f"PASS: all {len(files)} CI workflow(s) parse and declare on + jobs.")
PYEOF
