---
title: "HIER STARTEN — Kostenpanel „Kontor" verdrahten"
date: "2026-09-05"
type: resume
lang: de
---

# Kostenpanel „Kontor" einbauen

**Alles Nötige liegt im Repo. Nichts muss noch geholt werden.**

## Zuerst lesen, in dieser Reihenfolge

    handoff/kostenpanel/TODO-OPUS.md          ← DIE BAUANWEISUNG. §3 ist die Reihenfolge.
    handoff/kostenpanel/MESSUNG-EIGENE-DATEN.md   unsere Zahlen, aus EINER Momentaufnahme
    handoff/kostenpanel/README.md             was die neun Artboards sind
    handoff/kostenpanel/kontor-tokens.css     die Tokenmenge, beide Skins, mit gemessenen Kontrasten
    handoff/kostenpanel/DESIGN-AUTORITAET.md  wer gewinnt, wenn Projektregelwerk und Entwurf
                                              sich widersprechen — mit ENTSCHEIDUNG je Stelle
    handoff/kostenpanel/notes/zustandsautomat.md
                                              Kacheln · Filter · Sortierung · Aufklappen und
                                              ihre Rangfolge. Ohne das erfindet man sie beim
                                              Bauen neu und anders als im Entwurf.
    handoff/kostenpanel/notes/messprotokoll.md
                                              1 155 Paarungen, 126 Matrixzellen — gegen DIESE
                                              Werte prüfen, nicht gegen eine Nacherzählung

Die beiden `.dc.html` sind **Entwurfsreferenz, kein Produktionscode** — im
Browser öffnen, danebenlegen, nicht kopieren.

Wenn Zeit ist: `handoff/kostenpanel-recherche/00-DESTILLAT.md` (450 Zeilen, was
aus 30 Rechercheberichten gilt) und `roh/` (die Berichte selbst, 30 Stück).

## Die Bauabfolge aus §3, in einem Satz je Schritt

1. **Tokens zuerst.** Inklusive `color-scheme` in `ThemeService` und
   `THEME_TOKEN_MAP`. Wer zuerst Komponenten baut, verdrahtet Hexwerte.
2. **Zahlenformat als EINE Funktion** — mit den sechs Zellzuständen als
   Rückgabetyp (`{kind: 'measured'|'zero'|'estimated'|'below'|'na'|'unrecorded', text}`).
   Sonst entstehen sie in jeder Tabelle neu und in jeder anders.
3. **Tabellen-Primitive** (Zeile `min-height: 28`, Polsterung 6/10, Trenner als
   `box-shadow: inset 0 1px`, kein Zebra, Hover < 1,15).
4. **Kopfkacheln als Selektor** — Kachel und Diagramm sind EIN Bedienelement,
   ein Zustand.
5. **Hauptdiagramm** mit der Tabelle fest darunter.
6. **Aufschlüsselungen** und die leeren Achsen.
7. Achsenbruch, Matrix, Kalender-Heatmap — zuletzt.
8. **4K-Regeln** am Ende.

## ⚠ Die drei Fallen, die am meisten kosten

**1 · Der Skin hat DREI Gründe.** `page` / `raised` / `sunken`. Ein Wert, der
gegen `page` stimmt, fällt auf `sunken` durch. Das ist heute **zweimal
unabhängig** passiert — in `EchartsChart.ts` (behoben, `8fc0e715`) und im
Entwurf selbst (Claude Design hat es gefunden). Es gibt jetzt ein Tor:
`frontend/scripts/lint-series-palette-grounds.mjs`. **Erweitere es auf die
neuen Tokens**, statt ein zweites zu bauen.

**2 · `color-scheme` erreicht, was kein Token erreicht.** Scrollbalken,
`<select>`, Datumskalender, Autofill zeichnet der Browser. Im Panel gibt es
alle vier. Seit `8fc0e715` veröffentlicht `ThemeService.publishPolarity` es
neben `--theme-polarity`. **Niemals über `@media (prefers-color-scheme)`** —
der Skin ist eine Nutzerentscheidung.

**3 · Die 206 betragslosen Zeilen sind 12,5 % der Tabelle.** Verbucht eine
Aggregation sie als Null, sind alle Mittelwerte falsch **und die Summe stimmt
trotzdem** — der Fehler fällt nie auf. Gemessen: 14,3 % Abweichung im
Gesamtmittel, **63 % bei `translation`**. Jeder Mittelwert trägt seine
Zählbasis (`n = 512 von 640`).

## Zwei Entscheidungen, die noch offen sind

**`--k-raised`:** Der Entwurf misst gegen `#171717`, unser
`--color-surface-raised` ist `#111111`. Entweder die Entwurfswerte gegen
`#111111` nachmessen (dann werden ink-3/ink-4 besser, nicht schlechter) oder
das Projekt-Token global auf `#171717` heben. **Eine von beiden — nicht zwei
Wahrheiten im Baum.**

**Namensraum:** Claude Design empfiehlt **kein `--k-*` im Baum**. Was ein
Gegenstück hat, wird auf `--color-*` abgebildet; nur die acht echten Neuen
kommen dazu (`--k-grid`, `--k-ink-4`, `--k-carrier-ink`, `--k-series-img`,
`--k-series-txt`, `--k-forecast`, `--k-hatch`, `--k-hatch-bg`, `--k-hover`),
damit `THEME_TOKEN_MAP` sie mitnimmt. Die Abbildungstabelle steht in
`TODO-OPUS.md` §2.

## Was schon gebaut ist (nicht doppeln)

    2a0235d6  key_source ausgesagt · conversation_id + agent_id in der Chatbuchung
    8fc0e715  SERIES_LIGHT gegen ALLE Gruende · color-scheme an der Polaritaet
              setTheme() statt dispose+init · containLabel ersetzt · neues Tor
    ee0caad7  user_id durch Chat und Herzschlag · Tor prueft beide Spalten
    b83e4eec  Fehlerzaehler des Rollups liest outcome (Migration 388)
    cfba75e3  ruff format, 349 Dateien (rein kosmetisch, in blame-ignore)

## Was das Backend noch NICHT kann

- **Keine Cache-Spalten.** `OpenRouterService.last_usage` nimmt nur
  `prompt_tokens`/`completion_tokens`/`total_tokens`; `cached_tokens` wird
  verworfen. Eine Cache-Spalte im Panel stünde heute auf null. (Textanteil ist
  11 % — der Betrag ist klein, die leere Spalte wäre trotzdem eine Lüge.)
- **Kein `/admin/ops`-Endpunkt für die neuen Achsen.** Was das Panel braucht,
  muss gebaut werden: Welt × Modell × Zweck × Zeit, mit `outcome` als fünf
  Kategorien und `key_source` als Achse.
- **`ai_usage_rollup_hour`** hat ein 30-Tage-Fenster und kennt weder `user_id`
  noch `metadata`. Für die Faden- und Nutzerachse braucht es die Rohtabelle.

## Offene TODOs, die daneben liegen

`handoff/TODO-offen.md` — **T17** (18 Migrationen angewandt, aber nicht
verbucht; jede einzeln gegen ihre Wirkung prüfen, bevor sie eingetragen wird).

## Der rote Faden dieses Tages

Sechs Befunde derselben Familie, alle am 05.09.2026:

    ein toter Parameter · ein Eintragstyp ohne CHECK · zwei Zaehler ohne Spalten
    ein Zweck, den das Tor nicht sah · eine Zeile ohne Zahl
    ein Fehlerzaehler, der ein Feld liest, das niemand schreibt

Jedes Mal war eine Hälfte richtig und die andere fehlte, und von außen sah es
vollständig aus. **Und dreimal meldete eine Prüfung Erfolg, ohne ihre eigene
Bedingung je hergestellt zu haben** — zuletzt mein eigenes Tor, das nur
versionierte Dateien liest und meinen Text erst NACH dem Commit sah.

Beim Bauen gilt deshalb: eine Prüfung, die nichts findet, muss sagen können,
ob sie hingesehen hat. Claude Design hat es vorgemacht — es hat ein absichtlich
falsches Element eingefügt, um zu beweisen, dass sein Tor beißt.
