#!/usr/bin/env python3
"""Setzt einen vollständigen Piktogramm-Prompt aus dem Plandokument zusammen.

Ein Prompt besteht aus drei Teilen, die in `docs/plans/ui-pictogram-prompts.md`
getrennt gepflegt werden: dem Stilblock (in jedem Prompt gleich), der Motivzeile
(je Symbol eine) und dem technischen Block (in jedem Prompt gleich). Getrennt,
weil die beiden Rahmenblöcke im Lauf der Arbeit mehrfach nachgeschärft wurden —
Quadrat-Rahmung, Strichstärke bei langen dünnen Teilen, Rauschgrenze — und jede
Änderung sonst in dreißig Kopien nachgezogen werden müsste.

Deshalb wird hier zusammengesetzt statt abgeschrieben: was das Skript ausgibt,
ist per Konstruktion auf dem Stand des Dokuments.

    python scripts/pictogram_prompt.py basic_attack     # ein Prompt
    python scripts/pictogram_prompt.py --list           # alle IDs mit Überschrift
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

DOC = Path(__file__).resolve().parent.parent / "docs/plans/ui-pictogram-prompts.md"

#: Überschriften der beiden Rahmenblöcke. Der jeweils erste ```-Block darunter gilt.
STYLE_HEADING = "## Stilblock"
TECH_HEADING = "## Technischer Block"


def fenced_block_after(text: str, heading: str) -> str:
    start = text.index(heading)
    fence = text.index("```", start) + 3
    return text[fence : text.index("```", fence)].strip("\n")


def subjects(text: str) -> dict[str, tuple[str, str]]:
    """id -> (deutsche Überschrift, Motivzeile)."""
    out: dict[str, tuple[str, str]] = {}
    for m in re.finditer(r"^### (.+?) \(`([a-z_]+)`\)$", text, re.M):
        tail = text[m.end() :]
        sub = re.search(r"^Subject: .+$", tail, re.M)
        nxt = re.search(r"^### ", tail, re.M)
        if sub and (nxt is None or sub.start() < nxt.start()):
            out[m.group(2)] = (m.group(1), sub.group(0))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ids", nargs="*", help="Piktogramm-IDs, z. B. guardian_shield")
    ap.add_argument("--list", action="store_true", help="alle IDs auflisten")
    args = ap.parse_args()

    text = DOC.read_text()
    style = fenced_block_after(text, STYLE_HEADING)
    tech = fenced_block_after(text, TECH_HEADING)
    subj = subjects(text)

    if args.list or not args.ids:
        for pid, (label, _) in subj.items():
            print(f"  {pid:32} {label}")
        return 0

    unknown = [i for i in args.ids if i not in subj]
    if unknown:
        print(f"Unbekannt: {', '.join(unknown)}. --list zeigt alle.", file=sys.stderr)
        return 1

    for i, pid in enumerate(args.ids):
        label, line = subj[pid]
        if i:
            print()
        print(f"### {label} ({pid})\n")
        print(f"{style}\n{line}\n{tech}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
