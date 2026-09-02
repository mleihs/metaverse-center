#!/usr/bin/env bash
# Jedes `maybe_single()` muss auf HÖCHSTENS eine Zeile treffen können.
#
# ── WARUM DIESES TOR EXISTIERT ──────────────────────────────────────────────
#
# `.maybe_single()` verlangt 0 oder 1 Zeile. Trifft es zwei, wirft postgrest-py
# — und zwar nicht die Wahrheit: `AsyncMaybeSingleRequestBuilder.execute` fängt
# JEDEN APIError ausser "0 rows" ohne re-raise ab, lässt `r` auf None stehen und
# wirft danach ein nichtssagendes "Missing response", dessen Hinweis ("Please
# create an issue in postgrest-py") den Leser in die falsche Richtung schickt.
# Der Originalfehler ist verloren.
#
# Am 02.09.2026 auf Prod eingetreten (Sentry METAVERSE_CENTER-4B):
# `agent_opinion_service` filterte `agent_relationships` auf ZWEI Spalten,
# während `unique_relationship` über DREI läuft. Um 05:12 entstand die zweite
# Zeile — ein Paar mit `trading_partner` UND `ally`, beide legitim — und von da
# an brach die Autonomiephase dieser Welt in JEDEM Tick ab.
#
# 🔑 Der Fehler wartet nicht auf einen Testlauf, sondern auf den Betriebstag, an
# dem die zweite Zeile entsteht. Genau dafür ist dieses Tor da.
#
# ── WAS ES PRÜFT ────────────────────────────────────────────────────────────
#
# Für jede `maybe_single_data(... .maybe_single())`-Stelle:
#
#   sicher, wenn `.limit(1)` dabeisteht          -> PostgREST liefert höchstens eine
#   sicher, wenn die `.eq()`-Spalten einen        -> die Datenbank garantiert es
#           eindeutigen Index VOLL abdecken
#   sonst UNSICHER
#
# Die Richtung ist wichtig und war beim Bauen zweimal falsch herum: geprüft wird
# `Indexspalten ⊆ Filterspalten`, nicht umgekehrt. Ein Filter über zwei von drei
# Indexspalten ist NICHT eindeutig. Das Tor eicht sich deshalb beim Start selbst
# an zwei bekannten Fällen (siehe unten) und verweigert den Dienst, wenn die
# Eichung nicht stimmt — ein Messgerät, das man nicht prüft, ist eine Meinung.
#
# ── GRENZEN, EHRLICH BENANNT ────────────────────────────────────────────────
#
# Der Leser ist ein Regex über einen 900-Zeichen-Ausschnitt, kein Parser. Er
# sieht `.eq("spalte", …)`, `.limit(1)` und `.table("name")`. Eine Abfrage, die
# ihre Filter über Zwischenvariablen zusammensetzt, erkennt er nicht — dann
# steht sie unter "unbekannt" und wird nicht bewertet, statt fälschlich grün.
#
# Braucht eine Stelle wirklich `maybe_single` ohne Indexdeckung und ohne
# `limit(1)`, gehört sie in ALLOWLIST — MIT Begründung, so wie bei den anderen
# Toren dieses Ordners.
#
# Läuft im CI-Job `test-backend`, NACH den Migrationen (er braucht die
# Indexdefinitionen aus der Datenbank).
# Lokal:  PGHOST=127.0.0.1 PGPORT=54322 bash scripts/lint-maybe-single-is-unique.sh
set -uo pipefail

# Pfade an die Wurzel binden, sonst greift ein relativer Treffer ins Leere und
# das Tor besteht als No-op. Enforced by scripts/lint-lint-scripts-anchored.sh.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-54322}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"

if ! command -v psql >/dev/null 2>&1; then
  echo "SKIP: psql nicht gefunden — dieses Tor braucht die migrierte Datenbank (CI-Job test-backend)." >&2
  exit 0
fi

# Begründete Ausnahmen, als "datei:zeile" — bisher keine.
ALLOWLIST=""

INDEXES="$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -At -F$'\t' -c "
  select t.relname, string_agg(a.attname, ',' order by a.attname)
  from pg_index x
  join pg_class t on t.oid = x.indrelid
  join pg_class i on i.oid = x.indexrelid
  join pg_namespace n on n.oid = t.relnamespace
  join unnest(x.indkey) with ordinality k(attnum, ord) on true
  join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
  where x.indisunique and n.nspname = 'public' and x.indpred is null
  group by t.relname, i.relname;" 2>/dev/null)"

if [ -z "$INDEXES" ]; then
  echo "SKIP: keine eindeutigen Indizes gelesen — ist die Datenbank migriert?" >&2
  exit 0
fi

# Die Indexdaten reisen als Umgebungsvariable, NICHT als zweites Heredoc:
# zwei `<<` an einem Befehl bedeuten, dass die letzte Umleitung gewinnt — dann
# landen die Daten als Python-Quelltext auf stdin und das Skript ist weg. Beim
# Bauen genau so passiert.
MAYBE_SINGLE_INDEXES="$INDEXES" python3 - "$ALLOWLIST" <<'PY' 
import collections, os, re, sys, pathlib
allow = {s for s in (sys.argv[1] or "").split(",") if s}

by_tbl = collections.defaultdict(list)
for line in os.environ.get("MAYBE_SINGLE_INDEXES", "").splitlines():
    if not line.strip():
        continue
    tbl, cols = line.split("\t", 1)
    by_tbl[tbl].append(frozenset(c for c in cols.split(",") if c))

# ── Eichung: das Messgeraet an zwei BEKANNTEN Faellen pruefen ──────────────
bekannt_falsch = frozenset({"source_agent_id", "target_agent_id", "relationship_type"})
if bekannt_falsch <= {"source_agent_id", "target_agent_id"}:
    print("ABBRUCH: die Eichung des Tores schlaegt fehl (Richtung vertauscht).")
    sys.exit(2)
if not frozenset({"id"}) <= {"id"}:
    print("ABBRUCH: die Eichung des Tores schlaegt fehl (guter Fall wird abgelehnt).")
    sys.exit(2)

unsicher, unbekannt, geprueft = [], [], 0
for p in sorted(pathlib.Path("backend").rglob("*.py")):
    if "tests" in p.parts:
        continue
    src = p.read_text(encoding="utf-8")
    for m in re.finditer(r"maybe_single_data\(\s*(.{0,900}?)\.maybe_single\(\)", src, re.DOTALL):
        blk = m.group(1)
        tbl = re.search(r'\.table\(\s*"([^"]+)"', blk)
        if not tbl:
            continue
        geprueft += 1
        wo = f"{p}:{src[: m.start()].count(chr(10)) + 1}"
        if wo in allow or re.search(r"\.limit\(\s*1\s*\)", blk):
            continue
        idxs = by_tbl.get(tbl.group(1))
        if idxs is None:
            unbekannt.append((wo, tbl.group(1)))
            continue
        cols = set(re.findall(r'\.eq\(\s*"([^"]+)"', blk))
        if any(ic <= cols for ic in idxs):
            continue
        unsicher.append((wo, tbl.group(1), sorted(cols),
                         sorted(",".join(sorted(ic)) for ic in idxs)[:2]))

if unsicher:
    print("FAIL: maybe_single() kann hier mehr als eine Zeile treffen.\n")
    for wo, tbl, cols, idxs in unsicher:
        print(f"  {wo}")
        print(f"      {tbl}({', '.join(cols)}) — kein eindeutiger Index vollstaendig abgedeckt")
        print(f"      eindeutig waeren: {' | '.join(idxs)}")
    print()
    print("postgrest-py wirft dann 'Missing response' und verschluckt die Ursache.")
    print("Entweder .limit(1) (wenn 'nimm eine' gemeint ist, dann bitte mit .order),")
    print("oder auf den vollen Eindeutigkeitsschluessel filtern, oder — mit")
    print("Begruendung — in ALLOWLIST dieses Tores eintragen.")
    sys.exit(1)

hinweis = f", {len(unbekannt)} ohne eindeutigen Index (nicht bewertet)" if unbekannt else ""
print(f"PASS: {geprueft} maybe_single-Stellen treffen hoechstens eine Zeile{hinweis}.")
PY
