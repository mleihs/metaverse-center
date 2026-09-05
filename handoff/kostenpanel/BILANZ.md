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

### 3.6 · Die Zeichentinte traegt auf ihrer EIGENEN Schraffur nicht

Der Entwurf staffelt die Zellzustaende ueber vier Tintenstufen und setzt `░` in
`--k-ink-3` auf die Schraffur. Gemessen:

    --color-text-glyph      auf --color-hatch-bg   2,55 (dunkel) · 2,74 (Papier)
    --color-text-muted      auf --color-hatch-bg   3,83 (dunkel) · 3,96 (Papier)
    --color-text-secondary  auf --color-hatch-bg   5,19 (dunkel) · 5,98 (Papier)

Die Zeichentinte faellt dort sogar unter die **3 : 1 fuer bedeutungstragende
Zeichen** (SC 1.4.11) — sie ist gegen den SEITENgrund getunt, und die Schraffur
ist ein vierter. Der Muted-Ton faellt unter die 4,5 fuer Satz.

Das ist `TODO-OPUS.md` §6.4 in einer **dritten** Gestalt, die dort nicht steht:
nicht „Sammelbalken unsichtbar" und nicht „Satz auf der Schraffur unlesbar",
sondern das ZEICHEN auf seiner eigenen Schraffur. Und beide falschen Wahlen
sind die naheliegenderen, weil die Sammelzeile „ohne Angabe" leiser wirken
SOLL als eine Datenzeile.

**Auf der Schraffur steht Sekundaertinte oder hoeher.** Schraffur und Tinte
stehen deshalb in DERSELBEN CSS-Regel (`.kontor-cell--unrecorded`), damit die
Paarung an der Verwendungsstelle nicht trennbar ist — und Teil 3 des Tores
misst sie aus dem Stilmodul nach.

### 3.7 · `--text-xs` liegt unter der Untergrenze der Datenregion

`--text-xs` steht auf `0.64rem` = **10,24 px**. Die kleinste branchenweit in
Daten eingesetzte Groesse ist **11 px** (alle sechs untersuchten Produkte). Die
Zaehlbasis `n = 512 von 640` ist keine Randnotiz, sondern die Aussage des
Panels — sie steht auf `--_kontor-micro: 11px`, einem Tier-3-Token mit der
Begruendung daneben, nicht auf dem Plattform-Token.

### 3.8 · Der Mittelwert war in der Datenbank falsch, nicht nur im Entwurf

`get_ai_usage_stats.avg_cost_per_call` teilte die Summe durch JEDEN
beantworteten Aufruf. Gegen Prod gemessen (05.09.2026, vor der Reparatur):

    ok gesamt                        1 644
      davon mit Betrag               1 440
      davon ohne Betrag                204   12,4 %

    Ø angezeigt   11.888971 / 1644 = $0.007232
    Ø richtig     11.888971 / 1440 = $0.008256
    Abweichung                          14,2 %

⚠ `MESSUNG-EIGENE-DATEN.md` sagt: *„Geprüft am 05.09.2026: Wir rechnen einen
solchen Mittelwert noch nirgends — weder in SQL noch in Python."* **Das stimmt
nicht.** Wir rechneten genau einen, in SQL, und der Admin zeigte ihn seit
Migration 152 an. Der Satz im Messdokument ist die Prüfung, die ihre eigene
Bedingung nicht hergestellt hat.

**Behoben:** Migration 389, am 05.09.2026 auf Prod angewandt und verbucht.
`avg_cost_per_call` teilt durch die Zeilen mit Betrag; `avg_cost_basis`,
`avg_cost_of`, `unrecorded_calls` und `by_outcome` kommen dazu; alle vier
Aufschlüsselungen tragen `billed`/`unrecorded`.

### 3.9 · Warum die Zeilen keinen Betrag tragen — nicht, was das Paket sagt

`MESSUNG-EIGENE-DATEN.md` nennt als Grund: *„Übersetzungen und Ankerläufe haben
keine Preisliste."* Das ist nicht die Ursache — für Unbekanntes gibt es
`_UNKNOWN_COST_PER_1M`. `_estimate_cost` rechnet aus **null Tokens** null: der
Anbieter hat keine Tokenzahlen gemeldet. Gegenprobe auf Prod:

    Betrag = 0 UND Token = 0      204     nicht erfasst
    Betrag = 0 UND Token > 0        0     es gibt KEINE echte Null
    Betrag > 0 UND Token = 0      316     Bilder, je Aufruf bepreist

Zwei Folgen für den Bau:

1. `estimated_cost_usd = 0` ist heute ein **verlässlicher** Marker für „nicht
   erfasst" — aber nur, weil die mittlere Zeile null ist. Bucht ein Aufrufweg
   einmal einen ECHTEN Nullbetrag mit Tokens (Treffer aus dem Cache), fällt die
   Gleichsetzung, und die Tabelle braucht eine eigene Spalte. Die Spalte ist
   `NOT NULL DEFAULT 0` (Migration 150) und kann den Unterschied nicht sagen.
2. Der Zellzustand **echte Null** hat heute **keine einzige Instanz** — genau
   wie BYOK. Das Panel muss ihn zeigen können, ohne dass er vorkommt.

### 3.10 · Eine Datumsspalte, die immer leer war

`AdminAIUsageTab._renderDailyTable` bildete den Zeilentyp **lokal noch einmal**
nach: `{ date: string; … }`. Die RPC schreibt `day`
(`date_trunc('day', created_at)::DATE AS day`). Die Zelle las `day.date` und
stand leer, seit es die Tabelle gibt — ohne Fehler, ohne Warnung.

**Die Regel dahinter:** eine lokale Nachbildung eines DTO ist der Ort, an dem
eine Fehlbenennung überlebt. Der Typprüfer kann zwei Wahrheiten nicht
gegeneinander halten, wenn er beide glaubt. Behoben, der Parameter nimmt jetzt
`AIUsageStats['daily_trend']`.

---

## 3a · Wo `velg-frontend-design` gegen den Entwurf steht

Der Skill ist Vokabular fuer die Plattform, nicht fuer dieses Panel. Fuenf
Stellen, an denen sein Standardvorschlag hier falsch waere — alle bereits nach
`DESIGN-AUTORITAET.md` entschieden, hier nur damit sie nicht beim naechsten
Bauteil zurueckkommen:

| Skill sagt | Panel macht | Warum |
|---|---|---|
| Hover hebt (`--hover-transform`, lift) | Hover ist NUR Farbe, unter 1,15 : 1 | Eine Zeile, die sich hebt, verschiebt die Zahlenspalten unter dem Zeiger (Autoritaet #11) |
| „Dramatische Animationen", Kaskaden, Scanlines, Eckklammern | nichts davon | Arbeitswerkzeug fuer eine Person. Dichte erwuenscht, Schmuck nicht — das Stilmodul enthaelt kein `transform`, keinen `--shadow-*`, keine Kaskade |
| Amber ist `--color-warning` (semantisch) | Amber ist Traegerfarbe, das Panel benutzt keine Warning-Variante | Steigende Kosten sind nicht „Warnung", sie sind das Normalgeschaeft (Autoritaet #9) |
| kein U+2014 | `—` ist ein Zellzustand | Notation, nicht Interpunktion — als Konstante, nie in `msg()` (Autoritaet #5) |
| `--text-xs` als kleinste Groesse | `--_kontor-micro: 11px` | siehe §3.7 |

**Der Rest des Skills gilt unveraendert** und ist eingehalten: Tokens statt
Hexwerten, `static styles` statt inline, keine farbigen Kantenstreifen, kein
hartes `text-transform`, `prefers-reduced-motion`, i18n fuer alles ausser den
vier Notationszeichen.

---

## 4 · Stand des Baus

    Schritt 1  Tokens                       ✅  10 Rollen, beide Polaritaeten, Tor + Test
    Schritt 2  Zahlenformat, sechs Zustaende ✅  utils/kontor-format.ts, 29 Tests
    Schritt 3  Tabellen-Primitive            ✅  shared/kontor-table-styles.ts
                                                 + kontor-cell.ts, 11 Tests, Tor Teil 3
    Schritt 4  Kopfkacheln                   🟡  sechs Kacheln stehen, die
                                                 Auswahlkopplung fehlt (braucht
                                                 eine nach Anbieter gestapelte
                                                 Zeitreihe, die die RPC nicht hat)
    Schritt 5  Hauptdiagramm                 🟡  Tageskosten, eine Serie
    Schritt 6  Aufschluesselungen            ✅  Modell · Zweck · Anbieter ·
                                                 Ausgang, je mit Zaehlbasis
    Schritt 7  Achsenbruch/Matrix/Heatmap    ⬜
    Schritt 8  4K-Regeln                     ⬜

### Die Tore, die dazugekommen sind

| Tor | prueft | mit einem falschen Element geprueft |
|---|---|---|
| `scripts/lint-series-palette-grounds.mjs` Teil 2 | 254 Paarungen: Mindest-, Hoechstschwelle, Tinte auf der Schraffur, und dass es seinen Gegenstand ueberhaupt findet | ✅ fuenfmal (min · max · Tinte · Satz umbenannt · Rolle ohne Schwelle) |
| `tests/kontor-palette-polarity.test.ts` | dass beide Saetze geschrieben werden, dass ein dunkler Wirt im hellen zurueckkippt, und dass CSS und TS nicht auseinanderlaufen | ✅ (Doppelung auseinandergezogen) |
| `tests/kontor-format.test.ts` | die sechs Zustaende, die Rundungsleiter, U+2212, Locale-Unabhaengigkeit, die Zaehlbasis | ✅ fuenfmal (null als Null · kein below · null als $0.00 · Bindestrich · Intl) |
| `scripts/lint-series-palette-grounds.mjs` Teil 3 | dass jede Regel, die die Schraffur setzt, in DERSELBEN Regel eine Tinte erklaert, die darauf traegt | ✅ viermal (die Wahl des Entwurfs · Zeichentinte · Paarung getrennt · Schraffur ganz weg) |
| `tests/kontor-cell.test.ts` | dass Zustand, Klasse und CSS-Regel nicht auseinanderlaufen, und dass die drei Zeichenzustaende vorlesbar sind | ✅ viermal (Klasse ohne Regel · Regel ohne Zustand · zwei Zustaende auf einer Klasse · keine vorlesbare Fassung) |


---

## 5 · Ausgerollt am 05.09.2026

    581ebc74  Tokens + Zahlenformat
    d1c80328  Tabellen-Primitive
    b0d7e850  Migration 389 + Verbraucher (und zwei fremde CI-Blocker)
    06b31b92  Das Panel als Admin-Reiter

**Migration 389** ist auf Prod angewandt (Management API, nicht `db push` —
T17: `db push` wuerde 18 unverbuchte Migrationen erneut anwenden) und in
`supabase_migrations.schema_migrations` verbucht, nachdem ihre Wirkung
nachgemessen wurde.

**Der Code** laeuft als `06b31b92`. Zwei Dinge dabei, die beim naechsten Deploy
wieder auftreten werden:

1. **Kein Auto-Deploy auf Push.** Coolify muss angestossen werden
   (`POST /api/v1/deploy?uuid=…`, Token in `~/.config/metaspots/coolify-api.token`).
2. **Waehrend des Rollouts laufen ZWEI Container**, alt und neu, und der Proxy
   verteilt im Wechsel. Assets des neuen Builds antworten dabei an jedem
   zweiten Abruf mit 404 — und Cloudflare faengt eine dieser 404 ein und haelt
   sie fest. Erst als der alte Container weg war und der Zonen-Cache gespuelt
   war, lieferte jeder Abruf 200. **Ein einzelner Abruf waehrend eines Rollouts
   misst den Container, nicht die Anwendung.**

Endprobe: dreimal HTTP 200, `velg-kontor-panel` zweimal im Bündel, 6 von 6
Zellzustaenden vorhanden.
