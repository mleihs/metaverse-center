---
title: "Bilanz — was beim Einbau des Kostenpanels entschieden und gemessen wurde"
date: "2026-09-05"
type: bilanz
lang: de
---

# Bilanz „Kontor"

Fortlaufend. `DESIGN-AUTORITAET.md` verlangt, dass eine **vierzehnte** Stelle,
an der Regelwerk und Entwurf sich beruehren, hier landet — und nicht still
entschieden wird. Dazu kommt, was beim Nachmessen anders herauskam als im
Paket steht.

---

## 1 · Die zwei offenen Entscheidungen

| Stelle | Entscheidung | Folge |
|---|---|---|
| `--k-raised` | **`--color-surface-raised` bleibt `#111111`**, die Entwurfswerte werden dagegen nachgemessen | 0 vorhandene Dateien beruehrt. Alle Kontraste auf `raised` steigen (dunklerer Grund): ink 14,23 → 14,99 · ink-2 6,86 → 7,22 · ink-3 5,06 → 5,33. Kein Wert kann durch die Entscheidung durchfallen. |
| Namensraum | **kein `--k-*` im Baum.** Abbildung auf `--color-*`, zehn echte Neue kommen dazu | Eine Wahrheit je Farbe. Die Abbildungstabelle steht in `TODO-OPUS.md` §2. |

---

## 2 · Die vierzehnte Stelle: Polaritaet statt `THEME_TOKEN_MAP`

**Der Entwurf sagt:** die zehn neuen Rollen bekommen Einstellungsschluessel,
damit `ThemeService.THEME_TOKEN_MAP` sie mitnimmt und der Atlas sie umfaerbt.

**Das Regelwerk gewinnt, und zwar so:** `THEME_TOKEN_MAP` haette den Atlas
bedient und die **sechs hellen Welt-Themes** still auf den dunklen Werten
stehen lassen — ein nicht geschriebenes Token ist kein Vorgabewert, sondern
ein geerbter. Gemessen, bevor eine Zeile gebaut war: der Serientext `#94a3b8`
misst auf hellem Papier **1,9 : 1**.

Das Projekt hat fuer genau diese Art Rolle schon ein Muster —
`publishPlatformAccent` (03.09.2026) kippt den Plattform-Akzent an der
**Polaritaet** des Grundes, nicht am Theme. Die zehn Kontor-Rollen sind
derselbe Fall: sie beschreiben, wie eine Zahl auf einem Grund liegt, nicht
welche Farbe eine Welt hat.

**Gebaut als** `ThemeService.publishKontorPalette`, mit `KONTOR_DARK` und
`KONTOR_PAPER`. Keine DB-Schluessel, nichts, was eine Welt setzen kann — und
korrekt auf allen zwoelf Themes statt nur auf zweien.

---

## 3 · Was beim Nachmessen anders herauskam als im Paket

### 3.1 · `--k-carrier-ink` braucht kein eigenes Token

Der Entwurf fuehrt Traegerfarbe und Traegertinte getrennt (Grafanas
`darkText`/`lightText`-Spalt). Im Baum ist der Spalt schon geschlossen:
`--color-accent-amber` loest auf hellem Grund seit dem 03.09.2026 auf
`var(--color-primary)` auf, und der Atlas-Zinnober wurde damals von `#d9482b`
auf `#ab3922` gesenkt — genau, damit er als Text traegt.

    --color-accent-amber   dunkel #f59e0b   page 9,22 · raised 8,79 · sunken 9,43
                           Atlas  #ab3922   page 5,32 · raised 4,92 · sunken 4,50

Alle sechs ueber AA. **Zehn neue Tokens statt der elf aus dem Paket.**

### 3.2 · Zwei Werte mussten gehoben werden

Gegen die drei Gruende **aller zwoelf** Themes, nicht nur der zwei
Plattform-Skins:

    --color-hatch          #666666 → #6b6b6b   sunless-sea raised #0f2236: 2,81 → 3,03
                                               vbdos       raised #0c2424: 2,83 → 3,05
    --color-delta-adverse  #b3261e → #b1261e   illuminated sunken #E0D4BE: 4,46 → 4,53

Beide um den kleinsten Schritt, der traegt. Danach bestehen **216 von 216**
Paarungen.

### 3.3 · Ein Befund, den das Paket nicht hat: die Schraffur ist ein vierter Grund

`--color-hatch-bg` liegt HINTER Text. Gemessen, welche Tinte darauf traegt:

    dunkel  #2e2e2e    text-primary 10,78 ✓   text-secondary 5,19 ✓   text-muted 3,83 ✗
    Atlas   #c2ccc4    text-primary 10,10 ✓   text-secondary 5,98 ✓   text-muted 3,96 ✗

**Auf der Schraffur steht Sekundaertinte oder hoeher.** Der Muted-Ton faellt
durch — und waere die naheliegende Wahl gewesen, weil die Sammelzeile „ohne
Angabe" leiser wirken soll als eine Datenzeile.

### 3.4 · Bekannte Grenze: die Schraffur auf einem Welt-Theme

Die Tintenprobe des Tores laeuft nur gegen die **zwei Plattform-Skins**, weil
das Kostenpanel nach `DESIGN-AUTORITAET.md` #10 nie an einem welt-gethemten
Wirt haengt. Gegen alle zwoelf gemessen faellt sie an zwei Stellen durch:

    solarpunk           Oliv    #4d7c0f auf #c2ccc4 = 3,03
    deep-space-horror   Stahl   #7888a0 auf #2e2e2e = 3,77

Das ist kein Fehler des Tokens, sondern die Grenze seiner Zusage: **eine Welt,
die `--color-hatch-bg` uebernimmt, muss ihre eigene Tinte darauf nachmessen.**
Das Tor gibt die Einschraenkung bei jedem Lauf namentlich aus.

### 3.5 · Vier Betragsformate im Admin, eines davon falsch

Vorgefunden am 05.09.2026, bevor `kontor-format.ts` entstand:

    AdminAIUsageTab      `$${item.cost.toFixed(4)}`          drei Stellen
    AdminForgeTab        `$${(cents / 100).toFixed(2)}`
    ForecastPanel        drei Stufen nach Groessenordnung, privat
    BurnRatePanel        `$${p.value.toFixed(4)}`

`toFixed(4)` zeigt unseren kleinsten gemessenen Betrag (**$0.000012**) als
`$0.0000` — eine Null, die keine ist. Dieselbe Anzeige bekommen die 206
betragslosen Zeilen, sobald sie irgendwo auf 0 fallen.

**Nicht mit umgestellt** (ausserhalb Schritt 2). Wer diese vier Stellen anfasst,
nimmt `formatAmount` aus `utils/kontor-format.ts`.

---

## 4 · Stand des Baus

    Schritt 1  Tokens                       ✅  10 Rollen, beide Polaritaeten, Tor + Test
    Schritt 2  Zahlenformat, sechs Zustaende ✅  utils/kontor-format.ts, 29 Tests
    Schritt 3  Tabellen-Primitive            ⬜
    Schritt 4  Kopfkacheln als Selektor      ⬜
    Schritt 5  Hauptdiagramm                 ⬜
    Schritt 6  Aufschluesselungen            ⬜
    Schritt 7  Achsenbruch/Matrix/Heatmap    ⬜
    Schritt 8  4K-Regeln                     ⬜

### Die Tore, die dazugekommen sind

| Tor | prueft | mit einem falschen Element geprueft |
|---|---|---|
| `scripts/lint-series-palette-grounds.mjs` Teil 2 | 254 Paarungen: Mindest-, Hoechstschwelle, Tinte auf der Schraffur, und dass es seinen Gegenstand ueberhaupt findet | ✅ fuenfmal (min · max · Tinte · Satz umbenannt · Rolle ohne Schwelle) |
| `tests/kontor-palette-polarity.test.ts` | dass beide Saetze geschrieben werden, dass ein dunkler Wirt im hellen zurueckkippt, und dass CSS und TS nicht auseinanderlaufen | ✅ (Doppelung auseinandergezogen) |
| `tests/kontor-format.test.ts` | die sechs Zustaende, die Rundungsleiter, U+2212, Locale-Unabhaengigkeit, die Zaehlbasis | ✅ fuenfmal (null als Null · kein below · null als $0.00 · Bindestrich · Intl) |
