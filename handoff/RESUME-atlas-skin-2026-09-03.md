# RESUME — Atlas-Skin: Phase 1 komplett, Umschalter live, vier Design-Fragen entschieden

Stand 2026-09-03, spät. **Nichts committet, alles im Arbeitsbaum.**
`npm run lint:full` → exit 0, **1278 Tests** (1259 bei Übergabe, 1222 davor).

Phase 1 (Token-System) ist fertig und skin-neutral. Der Umschalter läuft und ist
im Browser geprüft: Dark ⇄ Atlas ohne Reload, die Wahl überlebt einen Reload.
Diese Sitzung hat die vier offenen Design-Fragen entschieden — und beim
Nachmessen **elf latente Fehler** gefunden, von denen neun nichts mit dem neuen
Skin zu tun hatten.

---

## Was liegt wo

| Was | Wo |
|---|---|
| Design-Paket | `/Users/mleihs/Dev/Buchhaltung/Metaverse.center (11).zip` → `design_handoff_atlas_skin/` (README, atlas-tokens.md, atlas-config.ts, responsive-spec.md, 2 `.dc.html`-Prototypen + `reference/assets/`) |
| Sweep-Skripte | `handoff/sweep_a.py` … `sweep_d.py`, `promote.py`, `promote2.py` |
| Restlisten | `handoff/atlas-sweep-a-restliste-2026-09-03.md`, `handoff/atlas-sweep-c-restliste-2026-09-03.md` (beide mit den Entscheidungen dieser Sitzung nachgetragen) |
| Tore | `frontend/scripts/lint-no-hard-text-transform.sh`, `lint-backtick-in-css.mjs` |
| Tests | `platform-skin-switch`, `platform-atlas-contrast`, **`theme-token-redeclaration`** (neu), **`card-frame-restore`** (neu), **`edition-switch`** (neu) |

> **Das Paket lag nicht dort, wo diese Datei es vorher vermutete.** Es steckt in
> `~/Dev/Buchhaltung/`, nicht im Projektbaum, und `find ~ -maxdepth 6` fand es
> nicht. `mdfind "Metaverse.center"` fand es sofort. Wer es wieder sucht: nimm
> Spotlight, nicht `find`.

---

## Diese Sitzung — die vier Design-Fragen

### a) Warnfarbe: eigener Ockerton, gemessen statt geraten

`color_accent` (→ `--color-warning`, 119 Dateien) war gleich `color_primary`,
also standen Warnung und Gefahr 9° voneinander entfernt: zwei Rots, die sich nur
im Namen unterscheiden. Jetzt **`#83600f`**, ein Drucker-Ocker bei 42°.

Der Wert kommt aus einer Suche, nicht aus einem Vorschlag. Mein erster war
`#8a6a12` und lag bei 4,28 : 1 gegen den Papiergrund — unter AA. `#83600f` liegt
bei **4,87**, also auf der Gewichtung des Primärtons (4,85): die zwei Farben
stehen gleich stark auf der Seite. 29° vom Zinnober, 38° vom Gefahrenrot.

**Der Test prüft jetzt auch etwas, was kein Kontrastwert sehen kann.** Kontrast
misst immer gegen den GRUND, nie zwischen zwei Vordergründen — kein Wert in
`platform-atlas-contrast.test.ts` hätte sich über zwei identische Rots
beschwert. Dazu kam `hueGap()` und eine Mindestdistanz von 25° zwischen Warnung
und Gefahr.

Die Nachbarpaarung Warnung↔Primär wird **absichtlich nicht** geprüft: im
Dark-Skin sind beide dasselbe Amber, und zwar mit Absicht (`color_accent`
doppelt als Warnton, siehe `THEME_TOKEN_MAP`). Ein Tor dort hätte eine Regel
festgeschrieben, die die Plattform nicht hat. Es kostet auch nichts — Atlas'
Primärton ist ein Rot, ein zurückfallender Akzent scheitert an der
Gefahren-Prüfung.

**Und: die zwei Skins machen nicht dieselbe Zusage.** Auf Ihren Hinweis, der
Dark-Skin sei der barrierefreie und der neue nicht, steht das jetzt als
Deklaration in `theme-presets.ts` (`PLATFORM_SKIN_CONTRAST`) statt als
Kommentar:

| Skin | Text | Farbflächen |
|---|---|---|
| `dark` | AA (4,5) | AA (4,5) |
| `atlas` | AA (4,5) | 3 : 1 (WCAG 1.4.11) |

Der Text bleibt bei AA für BEIDE, und das ist keine Geschmacksfrage:
`enforceTextContrast` hebt zur Laufzeit jede Textrolle unter 4,5 — bei jedem
Skin. Ein Skin unter AA rendert nicht wie entworfen, die Plattform schreibt ihn
still um. Weichgemacht ist also nur, wo es gefahrlos ist. Aufgeweicht werden
musste am Ende gar nichts: Atlas hält aktuell überall AA.

### b) Restliste C: vierte Ink-Stufe

`--color-overlay-ink-bright`, wie die drei Nachbarn aus `--color-text-primary`
gemischt — kippt damit von selbst mit der Polarität.

**Anker bei 40 %, nicht bei den vorgeschlagenen 30 %.**
`color-mix(… X%, transparent)` kann nur verdünnen; ein Token bei 30 % hätte die
40-%-Kappe in `htp-styles.ts` nicht erreichen können, ohne das Token am
Verwendungsort von Hand nachzubauen. Also sitzt es auf dem stärksten seiner
Fälle, die schwächeren treten herunter (40 % Kappe · 30 % Minimap-Kontur · 15 %
Glanzkante).

Zwei Dinge gingen im selben Atemzug mit, beide in Dateien, die
`RGBA_ENFORCED_DIRS` noch nicht erfasst:
- `VelgAptitudeBars.ts`: `color-mix(var(--bar-color) 70%, white)` — kein `rgba`,
  deshalb von keinem Tor gesehen, aber derselbe Fehler. „Weiß" heißt „weg vom
  Grund", und das stimmt nur, solange der Grund schwarz ist.
- `MapMinimap.ts`: `background: rgba(0,0,0,0.7)` — ein Schleier, der nur „Tafel"
  bedeutet, solange die Seite schwarz ist. Es IST eine Tafel.

### c) Idle-Uhr: als Überschrift gesetzt

`.clock--idle` folgt jetzt `--heading-transform` statt `--label-transform`. Ein
Etikett ist ein Wort über einem Wert; dort steht kein Wert, sondern die Auskunft,
dass keiner läuft. Auf Phosphor ändert sich nichts (beide Tokens stehen dort auf
`uppercase`); auf Papier wäre es der einzige versale Satz einer Ansicht gewesen,
in der jede Überschrift klein gesetzt ist. Restliste A ist nachgetragen.

### d) Umschalter auch für Gäste — an ZWEI Orten, weil einer nicht reicht

Neues Bauteil `components/shared/VelgEditionSwitch.ts`; das `UserMenu` hat seine
eigene Kopie abgegeben. Zwei Zugänge:

1. **SYS-Feld der Kopfleiste**, direkt neben dem Sprachumschalter — dieselbe Art
   Entscheidung (eine Ansichtssache des Browsers), und auf jeder Seite da, nicht
   nur auf Landing und Login.
2. **Fußzeile der Frontseite** (`LandingSeoFooter`, `.legal`-Zeile).

Der zweite Ort ist nicht Symmetrie, sondern ein echtes Loch: `app-shell.ts`
verbirgt die Plattform-Kopfleiste für Gäste auf `/`
(`hideHeaderForLanding`, weil die Landing eigene Navigation trägt). Ohne die
Fußzeile könnte ein Erstbesucher die Ausgabe genau auf der Seite nicht wechseln,
auf der er zuerst steht. **Im Browser als Gast geprüft** (Kopfleiste
nachweislich verborgen, Umschalter in der Fußzeile, Klick legt die ganze Seite
um).

Zwei ARIA-Gestalten, weil die zwei Wirte verschiedene Behälter sind: im
`role="menu"` des Benutzermenüs `menuitemradio` + `aria-checked`, im
`role="navigation"` des SYS-Felds zwei Schaltknöpfe mit `aria-pressed`. Die
jeweils unbenutzte Hälfte wird über Lits `nothing` ENTFERNT, nicht leer gesetzt
— `aria-checked=""` ist kein „kein Wert", sondern ein ungültiger.
`tests/edition-switch.test.ts` nagelt beide Gestalten fest (8 Tests).

---

## Diese Sitzung — elf Fehler, die beim Nachmessen auffielen

### Die große Klasse: ein `var()` in einer Custom Property löst beim DEKLARIERENDEN Knoten auf

Neun Tokens waren in `:root` über ein vom Theme gesetztes Token deklariert und
wurden auf dem Theme-Wirt NICHT neu geschrieben. Ihr Wert entsteht damit an
`:root`, mit der Palette der Plattform, und jedes Theme erbt ihn als fertigen
Hexwert. Kein Fehler, kein roter Test — das Token existiert und hat einen
gültigen Wert, nur den falschen.

| Token | stand auf | müsste (Atlas) |
|---|---|---|
| `--color-overlay-ink-bright` | `#e5e5e5` | `#17201d` |
| `--color-text-link` | `#3b82f6` | `#2f3f7a` |
| `--color-text-danger` | `#ef4444` | `#b3261e` |
| `--color-border-danger` | `#ef4444` | `#b3261e` |
| `--color-border-focus` | Amber | `#b63c24` |
| **`--heading-font`** | **Courier** | **Bricolage Grotesque** |
| `--transition-fast/normal/slow` | `100ms ease` | `100ms cubic-bezier(…)` |
| `--h6-size` | 16px | 17px |

**Acht davon waren nicht neu.** `--heading-font: var(--font-brutalist)` ist der
schwerste: `_global.css` setzt damit die Schrift von h1–h6, und
`--font-brutalist` IST vom Theme gesetzt. Also stand in JEDER Welt das Courier
der Plattform in den Überschriften, egal welche Schrift ihr Theme nannte. Im
Browser nebeneinander gemessen: `--font-body` Spectral (richtig),
`--heading-font` Courier (falsch), im selben berechneten Stil.

Die drei `--transition-*` sind aus BEIDEN Hälften abgeleitet und froren
trotzdem ein — eine Welt mit `animation_speed: 1.5` hatte
`--duration-fast: 150ms` UND `--transition-fast: 100ms`, sich selbst
widersprechend, innerhalb eines Themes.

**Das Tor dagegen: `tests/theme-token-redeclaration.test.ts`.** Es liest
`styles/tokens/*.css`, fährt `applyConfig`, und verlangt: jedes `:root`-Token,
dessen Wert auf ein vom Theme GESCHRIEBENES zeigt, muss auf dem Wirt stehen.
Keine zweite Namensliste, die veralten kann — die Wirkung selbst ist der
Maßstab. Ohne die Reparatur wird es rot und nennt Token, Datei und Behebung
(nachgeprüft).

**Und das Tor war zuerst selbst zu eng.** Die erste Fassung las nur
`_colors.css`, weil die zuerst gefundenen fünf Fälle Farben waren — ein Tor, das
genau das fängt, was man ihm gesagt hat. Erst nach der Erweiterung auf alle
Token-Dateien kamen `--heading-font`, die drei `--transition-*` und `--h6-size`
heraus.

### Der Kartenrahmen eines festgesetzten Teilbaums leckte

`activeCardFrame` ist EIN globales Signal, aber eine Seite hat mehrere
Theme-Wirte: die Hülle themt `document.body`, `DriftView`/`DungeonView` setzen
`PLATFORM_DARK_CONFIG` auf SICH SELBST. Beide begründen im Code, ein Abräumen
sei unnötig, weil das Element beim Routenwechsel seine Inline-Tokens mitnimmt.
Das stimmt für die Tokens und ist für dieses Signal falsch.

Im Browser gemessen: Rahmen `paper` vor einem verschachtelten dunklen Wirt,
danach `none` + `terminal` + `holographic` — und so blieb er. Jede Karte auf dem
Papier-Skin verlor ihr Papier, bis irgendwann ein Skin-Wechsel das Signal neu
schrieb.

Sichtbar wurde das erst, als der Atlas-Skin eine Textur nannte. Vorher waren
beide Rahmen die Plattform-Vorgabe, und ein Leck ohne Unterschied zeigt nichts.
**Der Fehler war die ganze Zeit da.**

Behoben über `setPlatformCardFrame` / `restorePlatformCardFrame` in
`card-frame.ts` (ThemeService merkt sich den Rahmen des Wirts `document.body`,
die zwei Ansichten geben ihn im `disconnectedCallback` zurück).
`tests/card-frame-restore.test.ts` nagelt es fest — inklusive einer Prüfung, dass
die zwei Skins im Rahmen überhaupt auseinandergehen, denn genau in diesem
Zustand war das Leck jahrelang unsichtbar.

### Die Schrift kam als statische Instanz

`font-optical-sizing: auto` fehlte in `_global.css` — und wäre allein wirkungslos
gewesen. Am `fvar`-Tisch der ausgelieferten woff2 gemessen:

```
:wght@300              → KEINE fvar-Tabelle, eine statische Instanz
:opsz,wght@12..96,300  → fvar: opsz 12–96, Gewicht festgesetzt
```

Atlas fragte Gewicht 300, bekam einen statischen Schnitt, und optische Größe
hatte nichts, worauf sie wirken konnte. Der Achsen-Vorgabewert ist zudem 96
(Display) — auch mit der variablen Datei wäre ein 16-px-Etikett in
Display-Proportionen gezeichnet worden. **Keine der beiden Hälften wirkt
allein.**

`OPSZ_AXIS` in `ThemeService` nennt die Achse pro Familie, weil `css2` mit
**400 Bad Request** antwortet, wenn eine Familie eine angefragte Achse nicht hat
— gemessen gegen Lora, Oswald, Playfair Display, Spectral, Geist Mono und
Rajdhani, alle sechs. Eine pauschale Anfrage hätte sechs Themen die
Überschriftenschrift genommen.

### Zwei Fehler von mir selbst, beide vom Tor gefangen

- **Backticks im `css`-Kommentar**, zweimal in einer Sitzung
  (`LandingSeoFooter`, `VelgGameCard`). Ein Backtick beendet das Template;
  `lint-backtick-in-css.mjs` hat beide gefangen, und ich habe nachgeprüft, dass
  es das wirklich tut, statt es anzunehmen.
- **Eine Fehlmessung im Kommentar festgeschrieben.** Ich schrieb, der Umschalter
  stünde bei `left: 1512` in einem 1389 px breiten Sichtbereich, also außerhalb.
  1389 war die Skalierung des Bildschirmfotos; `innerWidth` war 1728, der
  Umschalter stand in der Zeile. Der Kommentar ist korrigiert und nennt jetzt
  die echten Zahlen.

---

## Punkt 2 + 3 der alten Offen-Liste: erledigt

- **`--color-grid`** (atlas-tokens.md §1): `color-mix(… var(--color-text-primary)
  12%, transparent)`, in `_colors.css` UND in `granularityPairs` — das Paket
  verlangt beides ausdrücklich, und genau das prüft das neue Tor. Rolle laut
  README: das **Vermessungsraster** als Seitenhintergrund, 96 px (Desktop) /
  64 px (Tablet) / 48 px (Mobile). Noch kein Verbraucher — das ist Phase-2-Arbeit.
- **`card--tex-paper`**: gebaut, drei Lagen (Rippen 3 px quer, Kettlinien 64 px
  längs, zwei weiche Verläufe gegen die Regelmäßigkeit), alles aus `--card-text`
  gemischt, keine Animation. `card_frame_texture` im Atlas-Skin steht damit
  wieder auf `'paper'` — der Name hat jetzt eine Regel.

  Die Abstände kommen aus einem ersten Versuch, der falsch aussah: bei 25 px und
  6 % standen acht Stege über eine 204 px breite Karte, und das las als
  Millimeterpapier. Ein geschöpfter Bogen hat Rippen im Millimeter- und Stege im
  Zentimeterabstand, Verhältnis rund 1:25, nicht 1:8.

---

## Phase 2 angefangen — Fundament + vier neue Blätter

Das Design-Paket liegt in `~/Dev/Buchhaltung/Metaverse.center (11).zip`.
`mdfind "Metaverse.center"` findet es; `find ~ -maxdepth 6` nicht.

### Fundament (trägt Landing UND Dashboard)

- **`--grid-size`** in `_layout.css`: 96 px, ≤1024 → 64, ≤640 → 48, ≥2560 → 128.
  Ein LÄNGENMAß, deshalb dort und nicht bei den Farben.
- **Die fehlenden Bühnenstufen** aus `responsive-spec.md` nachgezogen:
  `--stage-gutter` 24 px ab ≤768 und 16 px ab ≤400, `--stage-measure` 2240 px
  ab 2560. Vorher stand der 48-px-Rand auch auf einem 768er Bildschirm, wo er
  ein Achtel der Breite frisst.
- **`components/shared/atlas-sheet-styles.ts`** — fünf Module: Vermessungsraster,
  Blattkopf, Hover-Vokabular, Lebenszeichen (Pulspunkt + Scan-Streifen),
  Auswahl. In `shared/`, weil das Dashboard dieselben Teile braucht; zweimal
  gebaut wären sie beim ersten Nachschärfen auseinandergelaufen.

  **Kein Selektor darin fragt nach dem Skin.** Das Raster nimmt `--color-grid`,
  der Scan-Streifen hängt an `--theme-polarity`. Ein `[data-skin=atlas]` wäre
  in einer HELLEN Simulationswelt fälschlich aus — Polarität ist die Frage, die
  diese Effekte wirklich stellen.
- **`font-optical-sizing: auto`** + die `opsz`-Achse im Schriftaufruf (siehe
  oben, „Die Schrift kam als statische Instanz").

### Die vier Blätter, die es nur in der Kartenmappe gibt

| Blatt | Datei | Was |
|---|---|---|
| 02 Legende | `VelgLandingLegend.ts` | Ein Absatz, drei Kartensignaturen, 3/6/3 |
| 06 Vermessungsprotokoll | `VelgLandingSurveyLog.ts` | Der eine dunkle Block; fünf echte Terminal-Befehle |
| 08 Marginalien | `VelgLandingMarginalia.ts` | Ehrliche Bedingungen (`dl`), Feldfragen, Büro |
| 09 Fundstücke | `VelgLandingFindings.ts` | Sechs Zettel als klebender Kartenstapel |

- **`appState.landingTemplate`** ist ABGELEITET vom Skin, kein zweites Signal.
  Ein Signal, das einem anderen folgen SOLL, ist die Bauart, bei der beide
  irgendwann auseinanderstehen — und ein Papier-Skin mit dem redaktionellen
  Layout wäre kein Fehler, der auffällt, sondern eine Seite, die nach 70 %
  aussieht. Der Name bleibt trotzdem eigen: an der Lesestelle soll stehen,
  welche VORLAGE gemeint ist.
- **`LandingPage.ts` verzweigt, lädt aber nur einmal.** Schnappschuss,
  strukturierte Daten und Fehlerbehandlung stehen für beide Vorlagen an einer
  Stelle. Fünf der neun Blätter sind die bestehenden Abschnitte.
- **`stackReveal(host, cards)`** in `utils/scroll-reveal.ts`: easeInOutSine,
  rAF-gedrosselt, schreibt nur `--stack-depth`/`--stack-shift`, die Bewegung
  steht in der CSS der Komponente. Unter 900 px und bei
  `prefers-reduced-motion` wird es gar nicht aufgesetzt.

### Vier Fehler am Kartenstapel, alle erst im Browser sichtbar

1. **Ungleich hohe Karten.** Jede Karte war so hoch wie ihr Text — eine höhere
   Karte schaut unter einer niedrigeren hervor, und die Schichtung ändert daran
   nichts. Alle sechs zeigten ihren Text gleichzeitig. Ein Stapel besteht aus
   gleichen Karten; das ist die Bedingung dafür, dass er als Stapel liest.
2. **`opacity: calc(1 - shift)`.** Die oberste Karte war über fast den ganzen
   Weg halb durchsichtig und zeigte den Stapel unter sich. Sie wandert ohnehin
   120vh nach oben aus dem Bild — das Ausblenden war nie nötig und war genau
   der Fehler.
3. **`background: var(--color-background)` — dieses Token gibt es nicht.**
   `color_background` ist ein CONFIG-Schlüssel, den ThemeService auf
   `--color-surface` abbildet. Gemessen: `rgba(0,0,0,0)`, die Karte war
   durchsichtig. In drei Dateien.
4. **`Math.max(0, depth)`.** Eine bereits abgezogene Karte sah aus wie die
   oberste und saß genau auf der neuen. Unsichtbar nur, weil beide dieselbe
   z-Stufe bekamen und die DOM-Reihenfolge die neue zufällig zuletzt zeichnete
   — ein Fehler, der durch Glück nicht auffiel. Verraten hat ihn die
   Fortschritts-Strichreihe, die für immer den ersten Strich zeigte.

Dazu: eine `overflow-y: auto`-Vorsichtsmaßnahme, die um **2 px** auslöste (ein
Rundungsartefakt der Zeilenhöhe) und auf fünf von sechs Karten eine
Bildlaufleiste zeigte. Eine Vorsicht, die gegen nichts schützt und dabei ein
Artefakt erzeugt, ist keine.

### Ein Befund, der über den Skin hinausgeht: 153 `var()` ins Leere

Beim Suchen des dritten Fehlers habe ich den ganzen Baum gemessen: **76
Token-Namen mit 153 Verwendungen sind nirgends deklariert.** Ein Teil ist
legitim (per JS geschrieben: `--i`, `--deal-delay`, `--grid-min-width`; oder in
einem Eltern-`:host` gesetzt: `--hud-*`). Ein Teil ist tot, und drei Stichproben
sind nachgeprüft:

- **`--ease-bounce` · `--ease-slam` · `--ease-settle`** — 12 Verwendungen, in
  `_animation.css` NICHT deklariert, aber in `CLAUDE.md` als verfügbare Tokens
  aufgeführt. Ein ungültiges `var()` macht die ganze Deklaration ungültig: die
  Animationen laufen mit der Vorgabe-Beschleunigung.
- **`--color-accent`** (8), **`--color-secondary`** (5),
  **`--color-accent-gold`** (5), **`--radius-sm`** (3),
  **`--color-surface-elevated`** (3), **`--space-4-5`** (3).

`lint-color-tokens.sh` sieht rohe Hexwerte, nicht ein `var()`, das ins Leere
zeigt. **Ein Tor dafür fehlt** — und ich habe es absichtlich NICHT gebaut: eine
Erlaubnisliste mit 76 ungeprüften Namen würde die Hälfte davon als
beabsichtigt adeln. Das ist eine eigene Sitzung: erst die 76 sichten, dann das
Tor. Ohne Sichtung wäre es wieder eine Schranke, die nur fängt, was man ihr
gesagt hat.

---

## Die Landing-Kartenmappe ist KOMPLETT (Blatt 01–09 + Fußzeile)

**Eigene Bausteine statt Verzweigungen** — auf Ihre Ansage hin. Der Unterschied
ist kein Detail, das man nachschärft: der Hero wird von einem randlosen Bild mit
vier Schleiern zu einer Figur in vier Spalten. Zwei Layouts in denselben
Selektoren hätten jede spätere Änderung gezwungen, beide anzufassen — und eine
Release-Kürzung wäre ein Sweep durch fünf Dateien statt das Löschen eines
Verzeichnisses.

Alles liegt in **`frontend/src/components/landing/atlas/`**:

| Blatt | Datei | Tag |
|---|---|---|
| 01 Front | `AtlasHero.ts` | `velg-atlas-hero` |
| 02 Legende | `VelgLandingLegend.ts` | `velg-landing-legend` |
| 03 Systeme | `AtlasSystems.ts` | `velg-atlas-systems` |
| 04 Gebiete | `AtlasTerritories.ts` | `velg-atlas-territories` |
| 05 Gewährsleute | `AtlasInformants.ts` | `velg-atlas-informants` |
| 06 Protokoll | `VelgLandingSurveyLog.ts` | `velg-landing-survey-log` |
| 07 Schmiede | `AtlasForge.ts` | `velg-atlas-forge` |
| 08 Marginalien | `VelgLandingMarginalia.ts` | `velg-landing-marginalia` |
| 09 Fundstücke | `VelgLandingFindings.ts` | `velg-landing-findings` |

### Drei Dinge wurden geteilt, statt sie zu verdoppeln

- **`LandingNav.ts`** — die Navigationszeile ist der eine Teil, den beide
  Vorlagen gleich tragen. Sie lag in `LandingHero`; ein zweiter Hero hätte 20
  CSS-Regeln und fünf Schaltflächen mitkopiert.
  **Beinahe-Fehler dabei:** mein erster Wurf schrieb `navigate('/login')`. Der
  echte Knopf verschickt ein `login-panel-open`-Ereignis, weil die
  Plattform-Kopfleiste auf der Frontseite für Gäste ausgeblendet ist — eine
  stille Verhaltensänderung, die kein Test gefunden hätte.
- **`landing-systems-data.ts`** — die sechs Systeme mit Tag, Titel, Anreißer,
  Lore, Zitat, Zuschreibung. Das sind die Texte, mit denen die Plattform ihre
  eigenen Systeme beschreibt; zweimal gehalten erreicht eine Korrektur nur die
  eine Hälfte.
- **`landing-forge-engine.ts`** — `ForgeTypewriter` als Reactive Controller plus
  die zwanzig Beispielsätze. Zwei Zählwerke mit denselben drei Konstanten hätten
  irgendwann verschieden schnell getippt, ohne dass es auffiele.

### Fundament nachgezogen

`--grid-size` (96/64/48/128), `--stage-gutter` bei ≤768 und ≤400,
`--stage-measure` 2240 ab 2560, `font-optical-sizing: auto`, und
`shared/atlas-sheet-styles.ts` mit fünf Modulen (Raster, Blattkopf, Hover,
Lebenszeichen, Auswahl). **Kein Selektor darin fragt nach dem Skin** — das
Raster nimmt `--color-grid`, der Scan hängt an `--theme-polarity`.

### Fehler, die erst der Browser zeigte

1. **`<picture>` ist `display: inline` und hat keine Höhe.** Das `img` mit
   `height: 100%` fiel damit auf null. Der Rahmen stand leer da, nur Raster und
   Scan-Streifen — Bild geladen, kein Konsolenfehler, unsichtbar.
2. **Die Blattnummern auf den Platten waren als einzige Etiketten nicht versal** —
   im Bildschirmfoto sofort als Ausreißer zu sehen.
3. **`professionLabel()` umgangen.** Ich las `t(citizen, 'profession')` direkt.
   Die Berufsanzeige steht plattformweit unter einem Schalter;
   `tests/profession-parked.test.ts` hat es gefunden, bevor es jemand zu sehen
   bekam. (Ein bestehendes Tor, nicht meines.)

### Und ein selbstverschuldeter Verlust

`git checkout -- LandingForge.ts` (zur Rettung nach einem zu gierigen Regex) hat
auch die **nicht committeten Sweep-A-Änderungen der Vorsitzung** zurückgenommen:
sechs `text-transform: uppercase`. Das Tor
`lint-no-hard-text-transform.sh` hat sie gemeldet, ich habe sie wiederhergestellt
(fünf Etiketten, `.title` als Überschrift). Geprüft, dass an derselben Datei
nichts anderes betroffen war (keine harten Schatten, keine Overlays, keine
Glows). **Lehre: in einem Baum mit ungesicherter Arbeit ist `git checkout` kein
Rückgängig.**

---

## Das Dashboard als Kartenmappe — Blatt 00 bis 05

`components/dashboard/atlas/`: `AtlasCommandStrip` (00 Schreibtisch),
`AtlasStage` (01 Einsatz), `AtlasQueue` (02 Verlangt Sie), `AtlasWorlds`
(03 Meine Gebiete), `AtlasRegistry` (04 Register), `AtlasRail` (05 Dossier,
Substratmonitor, Auszeichnungen).

**Alle Wahrheiten stehen in `DashboardPage`, nicht in den Bausteinen** — damit
gelten sie zwangsläufig für beide Garnituren: Warteschlange nur bei laufenden
Epochen, Weltenblatt nur bei eigenen Welten, Akademie für Neulinge, Freigabe nur
für Verwaltende, **Schiene entfällt ganz**, wenn sie weder Agenten noch Beben
trägt. Dazu: kein Countdown ohne `cycle_deadline_at`, kein erfundener Nenner,
das Register zählt was ankommt.

Die Zyklusuhr liegt geteilt in `cycle-countdown.ts` (Reactive Controller) — zwei
Uhren gehen irgendwann auseinander.

---

## Der systematische Fehler, den die Breitenprüfung fand

**Eine Container-Abfrage kann nicht auf das Element passen, das den Container
aufspannt.** Ich hatte `container-type` auf `.sheet` gesetzt und `@container`-
Regeln auf `.sheet` gerichtet — sie fragen damit den nächsten VORFAHREN und
trafen nie. **Zehn Bausteine** trugen denselben Bau.

Gemessen bei 390 px Blattbreite: das Blatt stand weiter zweispaltig
(113 px neben 133 px), obwohl die Regel eine Spalte verlangte. Syntaktisch
tadellos, ohne Wirkung, ohne Fehlermeldung. Behoben, indem der Container auf den
Wirt wandert; die Begründung steht in jeder der zehn Dateien.

**Und zweimal war mein Messgerät der Fehler.** Ich kann das Fenster in dieser
Umgebung nicht verkleinern (`outerWidth: 0`), also habe ich das Element
verkleinert. Das prüft **nur Container-Abfragen** — Medienabfragen feuern dabei
nie. Zweimal habe ich daraufhin einen Fehler diagnostiziert, den es nicht gab
(einmal beim Hero, einmal bei `.lower` im Dashboard, das eine völlig korrekte
`@media (max-width: 1024px)` hat).

Daraus folgt die Regel, nach der die Abfragen jetzt gewählt sind:

| Was entscheidet die Breite? | Werkzeug |
|---|---|
| der eigene Platz im Blatt | `@container` (alle Blattflächen) |
| ein Elternteil, der selbst am Fenster hängt | `@media` (`AtlasRegistry`: seine Spalte kommt aus `.lower`, das bei ≤1024 stapelt) |

Nachgemessen über 390 · 768 · 1024 · 1440: Hero 1/1/2/2, Legende 1/1/3/3,
Systeme 1/2/2/2, Gebiete 1/2/4/4, Protokoll · Schmiede · Marginalien ·
Gewährsleute je 1/1/2/2, Dashboard-Bühne · Warteschlange · Welten je 1/1/2/2.
Register bei echter Fensterbreite 1728: Spalte 969 px, drei Kartenspalten.

---

## Die Backtick-Falle ist jetzt verankert, nicht mehr nur notiert

Ich bin in dieser Sitzung **fünfmal** hineingelaufen, obwohl die Erinnerung
`css-backtick-template-trap` existierte. Eine Erinnerung ist ein Rat und greift
nur, wenn man in dem Moment an sie denkt — beim Schreiben eines Kommentars tut
man das nicht.

`.claude/settings.json` trägt jetzt einen **PostToolUse-Hook** (`Write|Edit`):
nach jedem Schreiben in eine `frontend/src/**/*.ts` läuft
`lint-backtick-in-css.mjs`, und ein Verstoß kommt sofort als `decision: block`
mit Datei und Zeile zurück. Beides nachgewiesen — mit einer Markierung, dass er
feuert, und mit einer echten Verletzung, dass er blockt.

Die allgemeine Lehre steht in der Erinnerung: **wenn dieselbe Notiz mehrfach
nicht greift, ist sie das falsche Werkzeug.**

---

## Offen — nächste Schritte

0. **Phase 2 Rest:**
   - **Blätter 04–07 und das ganze Dashboard mit echten Daten ansehen.** Geprüft wurden sie mit von Hand
     eingesetzten Daten, weil das Backend nicht lief. Layout und Rückfallpfade
     stimmen; die echten Bilder (`banner_url`) hat noch niemand gesehen.
   - **Bild-Matrix** `frontend/screenshots/atlas/`: 390 · 768 · 1024 · 1440 ·
     1920 · 2560, je Dark und Atlas.
1. **Phase 2 Templates: Landing + Dashboard.** Das Paket sagt dazu (README §28):
   ein Skin bringt dort „nur 70 % der Wirkung", beide brauchen eigene
   Sheet-Raster-Layouts. Vorlagen liegen als `.dc.html` im Paket
   (`reference/Frontseite E Atlas.dc.html`, `reference/Dashboard Atlas.dc.html`),
   dazu `responsive-spec.md`. Hier wird `--color-grid` zum ersten Mal verbraucht.
2. **Phase 3: die kleinen Seiten**, laut Paket rein über Tokens.
3. **Der Plattform-Akzent auf Papier.** Auf der Atlas-Frontseite gesehen: der
   „FORGE THIS WORLD"-Knopf, die Kicker und die Merkmals-Chips stehen in Amber
   (`--color-accent-amber`), weil das eine dokumentierte Plattform-KONSTANTE ist.
   Auf Papier liest das als eine andere Designsprache. Braucht eine Entscheidung
   in Phase 2 — nicht mechanisch.
4. **Zwei handgerollte Scanline-Verläufe** umgehen `--color-scanline`:
   `world-map.css:140` (5 % über `--color-text-primary`, mit `multiply`) und
   `LandingHero.ts:281` (9 % über `--color-surface` — auf Papier ein heller
   Schleier auf hellem Grund, also fast unsichtbar). Der zweite ist
   Phase-2-Landing-Arbeit.
5. **`RGBA_ENFORCED_DIRS` weiter aufziehen.** `shared`, `multiverse` und
   `how-to-play` sind noch nicht erfasst; die drei Zeilen aus Restliste C kamen
   aus der Liste, nicht aus dem Tor. Die Liste in
   `lint-color-tokens.sh` erklärt, warum verzeichnisweise und nicht in einem
   Sprung.
6. **`--color-surface-overlay`** ist praktisch tot: genau eine Verwendung, und
   die (`DailyBriefingModal.ts:78`, eine dokumentierte Lint-Ausnahme) definiert
   es lokal auf denselben Hexwert neu. Es steht als einziges nicht-konstantes
   Token noch auf einem Dark-Wert. Entweder themen oder abschaffen.
7. **Später:** `user_profiles.platform_skin` + `PATCH /users/me/skin`, damit die
   Wahl am Konto hängt und nicht am Browser. `VelgEditionSwitch` ist dafür die
   eine Nahtstelle — der Schreibvorgang ändert sich dort und in
   `AppStateManager`, nicht an jedem Eingang.

---

## Zwei Dinge über das Messen, die diese Sitzung gekostet hat

- **`import('/src/…')` in der Konsole liefert nach einem HMR-Edit eine ZWEITE
  Modulinstanz** (andere Query-Kennung). Deren Signale stehen auf ihren
  Anfangswerten, während die Anwendung mit der ersten Instanz arbeitet. Eine
  Messung über ein importiertes Signal sagt danach nichts. Ich habe daraufhin
  einmal einen Fehler diagnostiziert, den es nicht gab. Am gerenderten DOM
  messen (Klassennamen, berechneter Stil) — das ist instanzunabhängig.
- **`innerWidth` ist nicht die Breite des Bildschirmfotos.** Das Foto kommt
  skaliert (1389), der Sichtbereich war 1728. Wer Kastenmaße gegen die
  Fotobreite prüft, findet Überläufe, die es nicht gibt.

## Kontrolle nach jedem Schritt

```bash
cd frontend && npm run lint:full
```
