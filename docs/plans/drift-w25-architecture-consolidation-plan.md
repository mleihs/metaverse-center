# DRIFT W2.6 — Architektur-Konsolidierung (vor W3)

**Status:** geplant, nicht begonnen. Voraussetzung: Gesamtabnahme W1+W2 (2026-07-14) ist grün und committed.
**Branch:** `feat/drift-fun-core-w2` (gestapelt auf `feat/drift-fun-core-w1`, beide ungemergt, undeployt, Gate `drift_fun_core_enabled=false` auf Prod).

## Warum überhaupt

Die Gesamtabnahme (drei Fresh-Eyes-Agenten auf dem kumulativen Diff, 2026-07-14) fand vier P1.
Alle vier waren echt, alle vier sind gefixt — aber sie sind **keine vier Bugs, sondern Symptome von
drei Architekturentscheidungen**, die weiter Bugs produzieren werden, wenn man sie stehen lässt.
W3 (Requisition: Siegel = Kaufkraft) baut direkt auf dieser Ökonomie auf und würde die Fehlerklassen
erben.

Das Zeitfenster für Schritt C schließt sich beim Merge für immer.

---

## A. Das Gate gehört an EINEN Ort (klein, sofort)

**Befund.** Das Fun-Kern-Gate wird zweimal durchgesetzt, mit *unterschiedlicher Semantik*:

* SQL: jede RPC prüft `drift_gate_enabled('drift_fun_core_enabled')` und trägt einen **Drain** —
  die W1/1.5-Regel lautet „ein Gate darf sich weigern, Zustand zu ERZEUGEN, nie ihn EINZUSPERREN".
* Router: `require_drift_fun_core` antwortet mit **404, bevor die RPC läuft**.

Der grobe Wächter überstimmt den feinen. Ergebnis (P1 dieser Abnahme): der sorgfältig gebaute
Gate-Drain in `fn_travel_havarie_resolve` war **unerreichbar**, und ein Rollback hätte jeden Run in
Havarie für seine volle 48-h-TTL eingesperrt — genau die Falle, die die Regel verbietet.

**Fix (bereits erledigt für 2 Endpunkte):** `require_drift_fun_core` von `/havarie/resolve` und
`/signal/resolve` entfernt.

**Noch zu tun:** die drei verbliebenen Mutations-Endpunkte (`move`?, `sondieren`, `bank` —
`backend/routers/drift.py`, Zeilen ~159/284/302) tragen die Dependency ebenfalls, und *jede* dieser
RPCs wirft ohnehin selbst `GATE_CLOSED` (→ 400). Die Router-Dependency ist dort redundant und wird in
dem Moment gefährlich, in dem eine dieser Funktionen je einen Drain bekommt.

→ **`require_drift_fun_core` aus allen Mutationspfaden entfernen. Das Gate lebt in SQL, wo es die
Drain-Semantik kennt.** Read-/Nav-Gating bleibt Frontend + Settings-Read (unberührt).
Danach: gibt es noch einen Aufrufer? Wenn nein, die Dependency löschen.

## B. Der rohe `checkpoint` gehört aus der API-Response (klein, sofort)

`TravelRunResponse.checkpoint: dict` (`backend/models/drift.py:209`) geht **1:1 raus** — neben den
typisierten Feldern, die per `_lift_checkpoint_blocks` sorgfältig nur das Erlaubte heben. Damit ist
die Typisierung für die Vertraulichkeit wertlos: im rohen Blob stehen `check.difficulty` und die
`deltas` **jedes** Ausgangs (`pending_signal.options` ist `jsonb_agg(o)` über die kompletten
Template-Optionen, Migration 267:466-470).

Das Konzept (R4) sagt: *„die Odds werden nie beziffert."* Per DevTools sind sie es.

→ **`checkpoint` aus der Response entfernen**, nur die gehobenen typisierten Felder ausliefern.
Vorher prüfen, welche Frontend-Stellen `run.checkpoint.*` direkt lesen (es gibt welche — z. B.
`haul`, `haul_safe`, `markers`, `sondierung`) und für die je ein typisiertes Feld heben.
**Hinweis:** greift in Schritt D über — dort werden diese Keys ohnehin zu Spalten. Reihenfolge:
erst D, dann B fällt fast von selbst.

## C. Eine Funktion, eine Definition (Zeitfenster schließt beim Merge)

Auf diesem Branch ist **`fn_travel_move` dreimal** definiert (264, 265, 267); je zweimal:
`fn_travel_complete`, `fn_travel_zerfasern`, `fn_travel_bank_run`, `fn_travel_havarie_resolve`,
`fn_drift_signal_draw`. Wer heute `fn_travel_move` lesen will, muss drei Dateien diffen.

Zwei konkrete Schäden, beide belegt:
* Ein isoliertes Re-Apply einer *früheren* Migration macht spätere Fixes **still rückgängig**
  (im W2-Ledger vermerkt: 267 legte `drift_checkpoint_carry` an, 268 korrigierte den Schlüssel →
  Re-Apply von 267 machte 268 rückgängig, drei Tests rot).
* Die Endform einer Funktion ist nirgends an einem Stück lesbar.

→ **264–268 zu einem Satz konsolidieren, in dem jede Funktion GENAU EINMAL in ihrer Endform steht.**
Da nichts gemergt und nichts deployt ist, ist das jetzt reine Aufräumarbeit. Nach dem Merge auf Prod
ginge es nie wieder ohne Migrationskette.
**Achtung:** betrifft auch W1s Migrationen (264/265) → der W1-PR ändert sich mit. Deshalb W1 und W2
zusammen als ein PR, nicht W1 zuerst mergen.

## D. Der Checkpoint bekommt eine Form (der eigentliche Schnitt)

**Befund.** `checkpoint` ist ein untypisierter Mehrschreiber-jsonb mit **42 direkten Schreibzugriffen**
über 264/265/267/268. Er ist die Quelle fast jedes P0/P1 dieses Projekts:

| Vorfall | Klasse |
|---|---|
| `last_signal.class` vs. `signal_class` | Schlüsselname = stiller API-Vertrag → 500 auf JEDEM GET |
| zwei gespiegelte Snapshot-Bugs | Aufrufer schreibt veralteten Snapshot über Helfer (und umgekehrt) |
| `drift_checkpoint_carry`-Whitelist | ein nicht gelisteter Schlüssel verschwindet lautlos beim nächsten Zug |
| `haul` / `haul_safe` / `haul_banked` | drei fast gleichnamige Zahlen, verschiedene Bedeutung |
| Nebenbuch-Staleness (Funkboje, 2026-07-14) | drei Buchungen desselben Geldes, kein Eigentümer |

Die Carry-Whitelist ist selbst schon ein Workaround: sie existiert **nur**, weil `fn_travel_move` den
Checkpoint bei jedem Zug neu baut.

→ **Die tragenden Schlüssel werden Spalten** auf `travel_runs`:
`haul`, `haul_safe`, `overstay` (mit CHECKs), `markers` + `sondierung` als eigene jsonb-Spalten.
Im `checkpoint` bleibt **nur** das echt Polymorphe: die Szenen-Payloads (`pending_signal`,
`last_signal`, `last_sondierung`, `last_bank`, `havarie`, `earnings`).

Was damit stirbt: der Rebuild, die Whitelist, die Snapshot-Falle, die Carry-Bugklasse.
Was Spalten mitbringen: Typen, CHECK-Constraints, und die Unmöglichkeit, aus einem Rebuild
herauszufallen.

**Mitzudenken:** die Byte-Paritätsregel bei geschlossenem Gate (`fn_travel_bank_run` pinnt den
Abschluss-Checkpoint auf den exakten Schlüsselsatz aus Migration 256). Spalten machen die Parität
eher leichter — der Checkpoint schrumpft auf die Szenen-Payloads.

## E. `haul` hat einen Eigentümer (gleicher Eingriff wie D)

Dasselbe Geld ist heute **dreifach** gebucht:
* `checkpoint.haul` — der lose Ertrag
* `sondierung[node].yield` — was ein Resonanzriss an diesem Knoten konfisziert
* `travel_cargo.haul_value` — was ein Notabwurf dieser Fracht abzieht

Gehalten von *verschiedenen* Funktionen. Genau deshalb konnte die Funkboje eine leeren und die anderen
zwei stehen lassen (der P1 dieser Abnahme, in beide Richtungen: Über-Konfiszierung UND ein gratis
Bust, der die Push-your-luck der ganzen Welle aushebelte).

Der aktuelle Fix schreibt die Abrechnung **in `fn_funkboje_bank` hinein**. Das ist der Fix, nicht die
Architektur.

→ Zwei Optionen, in aufsteigender Sauberkeit:
1. `fn_drift_settle_haul()` als **einziger Schreiber** aller drei Buchungen.
2. **`haul` gar nicht speichern, sondern ableiten** (Summe der unverbuchten Quellen). Dann kann keine
   Teilbuchung veralten, weil es keine Teilbuchung mehr gibt.

Option 2 ist die richtige und passt in denselben Schnitt wie D.

## F. Der Modell-Vertrag wird genau EINMAL getestet (billigste Versicherung)

Nur `test_travel_signals.py:506` schickt ein Mutations-Ergebnis durch `TravelRunResponse` — genau der
Test, den die `class`-Regression erzwungen hat. RPC-Tests lesen die **rohe** Zeile; nur das Modell
sieht den Schlüssel-Vertrag, und das Modell validiert die GANZE Run-Zeile, nicht nur die Mutation.

→ **Ein parametrisierter Test, der das Ergebnis JEDER Mutation** (`move`, `signal_resolve`,
`sondieren`, `bank`, `havarie_resolve`, `quest_advance`, `complete`, `abandon`) **durch
`TravelRunResponse` schickt.** Hätte den 500er gefunden und findet den nächsten.

---

## Reihenfolge

1. **A** + **F** (klein, unabhängig, sofort grün)
2. **D + E + C in EINEM Zug** — Spaltenschnitt, Haul-Ableitung und Migrations-Konsolidierung sind
   derselbe Eingriff aus drei Winkeln. Getrennt gemacht müsste man die Migrationen zweimal anfassen.
3. **B** (fällt nach D fast von selbst)
4. Frontend nachziehen (Typen + die Leser von `run.checkpoint.*`), Baum grün halten
5. Browser-Playtest, dann W1+W2 als **ein** PR

## Nicht vergessen

* Migrationen lokal: `docker exec -i supabase_db_velgarien-rebuild psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < FILE`
  (`supabase migration up` ist unbrauchbar — CLI-Splitter). **Bei mehreren: in Reihenfolge!**
* Backend neu starten: `pkill -f "uvicorn backend.app:app"`.
* Die pytest-Suite räumt den Testnutzer ab (Profil gelöscht, Gate auf `false`) — danach die
  Browser-Welt neu armieren.
* Vor Push: `npm run lint:full` **und** `ruff check backend/ scripts/` (der neue `lint-backend`-CI-Job
  prüft ab jetzt beides).
