---
title: "HIER STARTEN — Kostenpanel „Kontor", Stand nach dem ersten Ausrollen"
date: "2026-09-05"
type: resume
lang: de
---

# Kontor — was steht, was fehlt

**Das Panel ist LIVE:** Admin → AI & Gen → **Kontor**. Ausgerollt als
`06b31b92`, Migration 389 auf Prod angewandt und verbucht.

## Zuerst lesen

    handoff/kostenpanel/BILANZ.md          ← WAS BEIM BAUEN HERAUSKAM.
                                             Entscheidungen, Messungen, die
                                             fuenf Stellen, an denen der
                                             Frontend-Skill gegen den Entwurf
                                             steht, und der Deploy-Weg.
    handoff/kostenpanel/TODO-OPUS.md       die Bauanweisung, §3 ist die Abfolge
    handoff/kostenpanel/DESIGN-AUTORITAET.md  wer gewinnt bei Widerspruch
    handoff/kostenpanel/notes/zustandsautomat.md  Kacheln · Filter · Sortierung

## Was gebaut ist

    1  Tokens                    ✅  10 Rollen an der POLARITAET (nicht in
                                     THEME_TOKEN_MAP — sonst blieben 6 helle
                                     Welt-Themes auf den dunklen Werten)
    2  Zahlenformat              ✅  utils/kontor-format.ts, sechs Zellzustaende
                                     als Rueckgabetyp, averageWithBasis daneben
    3  Tabellen-Primitive        ✅  shared/kontor-table-styles.ts + kontor-cell.ts
    4  Kopfkacheln               🟡  sechs Kacheln stehen, die Auswahlkopplung
                                     an das Diagramm fehlt
    5  Hauptdiagramm             🟡  Tageskosten, EINE Serie
    6  Aufschluesselungen        ✅  Modell · Zweck · Anbieter · Ausgang,
                                     je mit Zaehlbasis
    7  Achsenbruch/Matrix/Heatmap ⬜
    8  4K-Regeln                 ⬜

## Der naechste Schritt, und warum er am Backend haengt

Schritt 4 verlangt, dass Kachel und Diagramm EIN Bedienelement mit EINEM
Zustand sind. Dafuer braucht das Diagramm eine **nach Anbieter gestapelte
Zeitreihe** — `daily_trend` liefert heute nur eine Summe je Tag. Ebenso fehlen
fuer die Aufschluesselungen des Entwurfs die Achsen **Welt × Modell × Zweck ×
Zeit** in einem Zug.

Das ist eine Erweiterung von `get_ai_usage_stats` oder eine zweite RPC. Vorlage:
Migration 389 — sie zeigt, wie eine Aggregation hier aussieht und wie ihre
Selbstpruefung gebaut wird (Wirkung, nicht Inhalt).

## Vier Dinge, die beim Weiterbauen Zeit sparen

**1 · Die Schraffur ist ein VIERTER Grund.** `--color-hatch-bg` traegt weder
die Zeichentinte (2,55 : 1) noch den Muted-Ton (3,83). Auf ihr steht
Sekundaertinte. Schraffur und Tinte stehen deshalb in DERSELBEN CSS-Regel, und
`lint-series-palette-grounds.mjs` Teil 3 misst die Paarung aus dem Stilmodul
nach.

**2 · Der Zellzustand „echte Null" hat keine Instanz.** Auf Prod gibt es keine
einzige Zeile mit Betrag 0 UND Tokens > 0. `estimated_cost_usd = 0` ist deshalb
heute ein verlaesslicher Marker fuer „nicht erfasst" — aber nur deshalb. Bucht
ein Aufrufweg einmal einen Cache-Treffer, faellt die Gleichsetzung, und die
Spalte (`NOT NULL DEFAULT 0`, Migration 150) kann den Unterschied nicht sagen.

**3 · Keine lokale Nachbildung eines DTO.** `AdminAIUsageTab` hatte den
Zeilentyp der Tagesuebersicht von Hand nachgebaut und dabei `date` statt `day`
geschrieben — die Datumsspalte stand jahrelang leer, ohne Fehler. Der
Typpruefer kann zwei Wahrheiten nicht gegeneinander halten, wenn er beide
glaubt.

**4 · Deploy: kein Auto-Deploy, und der Rollout luegt.**

    # Coolify anstossen (Push allein tut nichts)
    TOKEN=$(cat ~/.config/metaspots/coolify-api.token)
    ssh metaspots "curl -s -X POST 'http://127.0.0.1:8000/api/v1/deploy?uuid=a6exg3b5euhidpc2r5009o0m' \
      -H 'Authorization: Bearer $TOKEN'"

    # Migration auf Prod (NICHT `db push` — T17: 18 unverbuchte Migrationen)
    TOKEN=$(grep -E '^SUPABASE_MCP_TOKEN=' .env | cut -d= -f2- | tr -d '"' | xargs)
    python3 -c "import json,sys;print(json.dumps({'query':sys.stdin.read()}))" < migration.sql \
      | curl -sS -X POST "https://api.supabase.com/v1/projects/bffjoupddfjaljqrwqck/database/query" \
          -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data @-

⚠ **Waehrend des Rollouts laufen ZWEI Container**, alt und neu, und der Proxy
verteilt im Wechsel. Assets des neuen Builds antworten an jedem zweiten Abruf
mit 404 — und Cloudflare faengt eine davon ein und haelt sie fest. Erst
`docker ps` auf EINEN Container pruefen, dann den Zonen-Cache spuelen
(`~/.config/metaspots/cf-metaverse-center-purge.token`), dann messen. **Ein
einzelner Abruf waehrend eines Rollouts misst den Container, nicht die
Anwendung.**

## Die Tore, die dazugekommen sind

Alle mit einem absichtlich falschen Element geprueft, bevor sie gruen genannt
wurden — Zahlen und Proben in `BILANZ.md` §4.

    scripts/lint-series-palette-grounds.mjs   Teil 2 (10 Rollen x 12 Themes x
                                              3 Gruende, Mindest- UND
                                              Hoechstschwellen) und Teil 3
                                              (Schraffur/Tinte aus dem Stilmodul)
    tests/kontor-palette-polarity.test.ts     beide Saetze, Rueckkippen,
                                              CSS gegen TS
    tests/kontor-format.test.ts               sechs Zustaende, Rundungsleiter,
                                              U+2212, Locale, Zaehlbasis
    tests/kontor-cell.test.ts                 Zustand ↔ Klasse ↔ CSS-Regel
