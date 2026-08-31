#!/usr/bin/env python3
"""Vergleicht den Migrations-Ledger auf Prod mit den Dateien im Repo.

WOZU
----
Der Ledger (``supabase_migrations.schema_migrations``) taugt NICHT als Beleg
dafür, was auf Prod steht — das ist eine teuer gelernte Lehre (Vorfall
``prod-schema-gap-migration-235``). Aber die umgekehrte Frage ist genauso
wichtig und wurde bisher nie gestellt: **welche Repo-Migration hat KEINE
Ledger-Zeile, und ist sie deshalb tatsächlich unangewandt — oder nur
unverbucht?**

Gemessen am 31.08.2026: 55 Repo-Dateien ohne Ledger-Zeile, 54 Ledger-Zeilen
ohne Repo-Datei. Beide Zahlen sehen alarmierend aus und sind es nicht:

* **33 Paare sind dieselbe Migration unter zwei Zeitstempeln.** ``supabase db
  push`` hat den Zeitstempel damals selbst vergeben und dabei das
  Nummernpräfix abgeschnitten: ``185_awakening_partial_narratives`` im Repo
  steht als ``awakening_partial_narratives`` im Ledger.
* Von den verbleibenden sieben (ohne die noch nicht angewandten) war **jede
  einzelne am Schema nachweisbar angewandt** — einschliesslich 237 und 238, die
  im Gedächtnis als „fehlend" geführt wurden.

Dieses Skript stellt die Frage also in der einzigen Form, in der sie eine
Antwort hat: es paart nach NAME (Präfix abgeschnitten) und lässt nur übrig, was
danach noch unerklärt ist. Was übrig bleibt, muss von Hand am Schema geprüft
werden — dafür gibt es keine allgemeine Automatik, weil jede Migration etwas
anderes tut.

AUFRUF
------
    .venv/bin/python scripts/compare_ledger_with_repo.py

Braucht ``SUPABASE_MCP_TOKEN`` in ``.env``. Rein LESEND.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MIGRATIONS = REPO / "supabase" / "migrations"
PROJECT = "bffjoupddfjaljqrwqck"

DATEINAME = re.compile(r"^(\d{14})_(.*)\.sql$")
NUMMERNPRAEFIX = re.compile(r"^\d{3}[a-z]?_")


def _token() -> str:
    env = (REPO / ".env").read_text(encoding="utf-8")
    for zeile in env.splitlines():
        if zeile.startswith("SUPABASE_MCP_TOKEN="):
            return zeile.split("=", 1)[1].strip().strip('"').strip()
    raise SystemExit("SUPABASE_MCP_TOKEN steht nicht in .env")


def _ledger() -> list[dict]:
    payload = json.dumps({"query": "select version, name from supabase_migrations.schema_migrations;"})
    ergebnis = subprocess.run(
        [
            "curl", "-sS", "-X", "POST",
            f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
            "-H", f"Authorization: Bearer {_token()}",
            "-H", "Content-Type: application/json",
            "--data", "@-",
        ],
        input=payload,
        capture_output=True,
        text=True,
        check=True,
        env={**os.environ},
    )
    antwort = json.loads(ergebnis.stdout)
    if isinstance(antwort, dict):
        raise SystemExit(f"Prod-Abfrage misslungen: {antwort.get('message', antwort)}")
    return antwort


def _kern(name: str) -> str:
    """Der Name ohne Nummernpräfix — die Form, in der `db push` ihn ablegte."""
    return NUMMERNPRAEFIX.sub("", name)


def main() -> int:
    ledger = _ledger()
    ledger_versionen = {zeile["version"] for zeile in ledger}
    ledger_kerne = {_kern(zeile.get("name") or "") for zeile in ledger}

    repo: dict[str, str] = {}
    for datei in sorted(MIGRATIONS.glob("*.sql")):
        treffer = DATEINAME.match(datei.name)
        if treffer:
            repo[treffer.group(1)] = treffer.group(2)

    ohne_zeile = sorted(set(repo) - ledger_versionen)
    ohne_datei = sorted(ledger_versionen - set(repo))

    # Nach Name gepaart: dieselbe Migration, anderer Zeitstempel.
    gepaart = [v for v in ohne_zeile if _kern(repo[v]) in ledger_kerne]
    unerklaert = [v for v in ohne_zeile if _kern(repo[v]) not in ledger_kerne]

    print(f"Ledger-Zeilen           {len(ledger_versionen)}")
    print(f"Repo-Dateien            {len(repo)}")
    print(f"  ohne Ledger-Zeile     {len(ohne_zeile)}")
    print(f"  ohne Repo-Datei       {len(ohne_datei)}")
    print()
    print(f"Nach NAME gepaart (nur der Zeitstempel weicht ab): {len(gepaart)}")
    print(f"Danach unerklärt:                                  {len(unerklaert)}")
    print()

    if not unerklaert:
        print("Keine unerklärte Migration. Der Ledger weicht ab, das Schema nicht.")
        return 0

    print("Diese Migrationen haben WEDER eine Ledger-Zeile NOCH einen")
    print("gleichnamigen Eintrag. Jede muss von Hand am Schema geprüft werden —")
    print("eine allgemeine Automatik gibt es nicht, weil jede etwas anderes tut:")
    print()
    for version in unerklaert:
        print(f"   {version}  {repo[version]}")
    print()
    print("Ein Eintrag hier ist KEIN Befund. Er ist eine Frage.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
