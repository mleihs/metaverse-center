#!/usr/bin/env python
"""Ist eine Meinung schon einmal unter null gegangen? Und wie weit ist es bis zum Tor?

WOZU DAS SKRIPT
---------------
Befund N5 endete an einer einzigen Zahl. Die Kette lautet:

    Bedarfs-Moodlet  →  Laune sinkt  →  `insult` wird wählbar  →  eine Meinung
    sinkt  →  |Meinung| ≥ 60  →  `relationship_threshold` löst ein Ereignis aus

Die ersten drei Glieder sind seit dem 31.08.2026 geschlossen (Bedarfs-Moodlets
0 → 77 Agenten, schlechteste Laune −1 → −25, sechs Agenten unter dem
Stresstor). Das vierte war nie belegt: **die Meinungsspanne auf Prod lag bei
0 … 45, und eine Meinung kann nur sinken, wenn jemand beleidigt.**

T10/Weg 1 hat das Beleidigungsfenster geöffnet (Meinungsfenster `(-100, 20)`).
Dieses Skript misst, ob es wirkt — und ab wann man das überhaupt fragen darf.

⚠ WANN MAN DAS ERGEBNIS LESEN DARF
----------------------------------
**Die Uhr läuft AB dem 31.08.2026, ~13:19 CEST** — dem Deploy, der Weg 1
ausgeliefert hat (Commit ``7f706ef5``).

„Ab", nicht „nach": bei einem Deploy GENAU AUF dem Commit liest sich „nicht
danach" wie „nicht enthalten", und daran hat sich an diesem Tag schon eine
Sitzung verrechnet.

Die Erwartung ist **eine Beleidigung alle ein bis drei Wochen**, nicht eine je
Tick. Daraus folgt:

    vor dem 07.09.2026    ein leeres Ergebnis sagt GAR NICHTS
    ab etwa dem 21.09.2026 wird ein leeres Ergebnis zur Aussage

Wer am 01.09. misst, sieht null und hält Weg 1 für wirkungslos. Das ist die
teuerste Fehlmessung, die hier möglich ist, und sie sieht wie ein Ergebnis
aus.

DER AUSGANGSSTAND, GEGEN DEN GEMESSEN WIRD
------------------------------------------
Alle Zahlen vom 31.08.2026, unmittelbar vor der Wirkung von Weg 1:

    Meinungsspanne (opinion_score)          0 … 45
    Zeilen in agent_opinions                1 177
    davon mit opinion_score < 0             0
    davon mit |opinion_score| >= 60         0
    negative Zeilen in agent_opinion_modifiers  0
    Ereignisse in den letzten 24 h          0

Eine spätere Messung ist damit sofort als Differenz lesbar. **Diese Zahlen
stehen hier, damit niemand sie aus dem Gedächtnis rekonstruieren muss** — und
weil eine Momentaufnahme ohne ihren Ausgangspunkt keine Messung ist.

WAS DAS SKRIPT NICHT TUT
------------------------
Es schreibt nichts. Es liest Prod nur lesend, und es zieht keinen Schluss:
ob die Zahl etwas bedeutet, hängt am Datum, und das Datum steht oben.

    .venv/bin/python scripts/measure_opinion_span.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import UTC, datetime

PROJECT = "bffjoupddfjaljqrwqck"

# Die Tore, an denen die Kette hängt. Aus dem Quelltext, nicht aus dem Kopf:
# backend/services/agent_opinion_service.py:130-131
RELATIONSHIP_CREATE_THRESHOLD = 60
RELATIONSHIP_HOSTILE_THRESHOLD = -60

# Der Beginn der Uhr. AB, nicht nach.
WEG1_DEPLOY = datetime(2026, 8, 31, 11, 19, tzinfo=UTC)  # 13:19 CEST
AUSSAGEKRAEFTIG_AB = datetime(2026, 9, 21, tzinfo=UTC)
FRUEHESTENS_SINNVOLL = datetime(2026, 9, 7, tzinfo=UTC)

# Ausgangsstand 31.08.2026 (siehe Kopf).
BASIS = {
    "min": 0,
    "max": 45,
    "zeilen": 1177,
    "negativ": 0,
    "am_tor": 0,
    "negative_modifikatoren": 0,
    "ereignisse_24h": 0,
}


def _token() -> str:
    tok = os.environ.get("SUPABASE_MCP_TOKEN")
    if tok:
        return tok
    for line in open(".env", encoding="utf-8"):
        if line.startswith("SUPABASE_MCP_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("kein SUPABASE_MCP_TOKEN in .env")


def _query(sql: str) -> list[dict]:
    proc = subprocess.run(
        [
            "curl",
            "-sS",
            "-X",
            "POST",
            f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
            "-H",
            f"Authorization: Bearer {_token()}",
            "-H",
            "Content-Type: application/json",
            "--data",
            "@-",
        ],
        input=json.dumps({"query": sql}),
        capture_output=True,
        text=True,
        check=True,
    )
    payload = json.loads(proc.stdout)
    if isinstance(payload, dict):
        raise SystemExit(f"SQL-Fehler: {payload.get('message')}")
    return payload


def _zahl(rows: list[dict], key: str, default: int = 0) -> int:
    if not rows:
        return default
    v = rows[0].get(key)
    return default if v is None else int(v)


def messen() -> dict:
    span = _query(
        "select min(opinion_score) as min, max(opinion_score) as max, "
        "count(*) as zeilen, "
        "count(*) filter (where opinion_score < 0) as negativ, "
        f"count(*) filter (where abs(opinion_score) >= {RELATIONSHIP_CREATE_THRESHOLD}) as am_tor "
        "from agent_opinions"
    )
    mods = _query("select count(*) as negative_modifikatoren from agent_opinion_modifiers where opinion_change < 0")
    ereignisse = _query("select count(*) as ereignisse_7d from events where created_at > now() - interval '7 days'")
    return {
        "min": _zahl(span, "min"),
        "max": _zahl(span, "max"),
        "zeilen": _zahl(span, "zeilen"),
        "negativ": _zahl(span, "negativ"),
        "am_tor": _zahl(span, "am_tor"),
        "negative_modifikatoren": _zahl(mods, "negative_modifikatoren"),
        "ereignisse_7d": _zahl(ereignisse, "ereignisse_7d"),
    }


def _diff(jetzt: int, vorher: int) -> str:
    d = jetzt - vorher
    if d == 0:
        return "unverändert"
    return f"{d:+d} gegen den 31.08."


def main() -> int:
    jetzt = datetime.now(UTC)
    tage = (jetzt - WEG1_DEPLOY).days
    m = messen()

    print("── Meinungsspanne auf Prod ──────────────────────────────────")
    print()
    print(f"  Spanne                {m['min']} … {m['max']}   (31.08.: {BASIS['min']} … {BASIS['max']})")
    print(f"  Zeilen                {m['zeilen']:>6}   {_diff(m['zeilen'], BASIS['zeilen'])}")
    print(f"  davon negativ         {m['negativ']:>6}   {_diff(m['negativ'], BASIS['negativ'])}")
    print(
        f"  davon |Meinung| >= {RELATIONSHIP_CREATE_THRESHOLD}"
        f"  {m['am_tor']:>6}   {_diff(m['am_tor'], BASIS['am_tor'])}"
    )
    print(
        f"  negative Modifikatoren {m['negative_modifikatoren']:>5}   "
        f"{_diff(m['negative_modifikatoren'], BASIS['negative_modifikatoren'])}"
    )
    print(f"  Ereignisse (7 Tage)   {m['ereignisse_7d']:>6}")
    print()

    # Der Abstand zum Tor, in der Richtung, um die es geht.
    if m["min"] < 0:
        print(f"  ▶ Die erste Beleidigung hat stattgefunden: min = {m['min']}.")
        rest = RELATIONSHIP_HOSTILE_THRESHOLD - m["min"]
        if m["am_tor"] > 0:
            print(f"  ▶ {m['am_tor']} Paar(e) am Tor — `relationship_threshold` ist erreichbar.")
        else:
            print(f"  ▶ Bis zum Tor fehlen noch {abs(rest)} Punkte.")
    else:
        print("  ▶ Noch keine Meinung unter null. Die Kette ist bis zum vierten")
        print("    Glied geschlossen und wartet auf die erste Beleidigung.")
    print()

    print("── Wie diese Zahl zu lesen ist ──────────────────────────────")
    print(f"  Weg 1 läuft seit {WEG1_DEPLOY:%d.%m.%Y %H:%M} UTC — das sind {tage} Tage.")
    if jetzt < FRUEHESTENS_SINNVOLL:
        print("  ⚠ VOR dem 07.09.2026: ein leeres Ergebnis sagt GAR NICHTS.")
        print("    Erwartet wird eine Beleidigung alle ein bis drei Wochen.")
    elif jetzt < AUSSAGEKRAEFTIG_AB:
        print("  ○ Zwischen dem 07. und dem 21.09.: ein leeres Ergebnis ist ein")
        print("    schwaches Zeichen, kein Beleg.")
    else:
        print("  ● Ab dem 21.09.2026: ein leeres Ergebnis IST eine Aussage —")
        print("    dann hat Weg 1 in drei Wochen nichts bewirkt.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
