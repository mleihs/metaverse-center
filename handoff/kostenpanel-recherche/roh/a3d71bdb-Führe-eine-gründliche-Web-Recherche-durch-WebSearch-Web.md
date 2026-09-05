# AUFTRAG

Führe eine gründliche Web-Recherche durch (WebSearch + WebFetch, mindestens 12 Seiten wirklich abrufen) zum Thema DUNKLE OBERFLÄCHEN / DARK MODE im Interface-Design. Antworte auf Deutsch.

Untersuche:
1. Kontrastanforderungen: WCAG 2.2 SC 1.4.3 (4.5:1 / 3:1) und 1.4.11 Non-text Contrast (3:1). Wie berechnet sich das Kontrastverhältnis (relative Luminanz-Formel) und warum ist die WCAG-2-Formel auf sehr dunklem Grund NACHWEISLICH ungenau? Suche gezielt nach APCA (Accessible Perceptual Contrast Algorithm) / WCAG 3 Silver, Andrew Somers' Arbeit, dem "contrast ratio is broken for dark mode" Argument, und den konkreten Lc-Werten von APCA (Lc 45, 60, 75, 90 und was sie bedeuten). URLs: git.apcacontrast.com, w3.org/WAI/WCAG22, das WCAG-3-Draft.
2. Warum ist reines Weiß (#FFFFFF) auf reinem Schwarz (#000000) schlecht? Suche nach: Halation / Astigmatismus-Argument, Material Design Dark Theme Guidance (die empfiehlt #121212 als Surface und "avoid pure black" — finde die konkrete Begründung und die Zahlen: Material nennt eine Text-Deckkraft von 87%/60%/38% für High/Medium/Disabled Emphasis auf Dunkel), Apple HIG Dark Mode, IBM Carbon Dark themes (g90/g100 mit konkreten Hex-Werten).
3. Flächenabstufung auf dunklem Grund: Material Designs "elevation overlay" System (die konkreten Overlay-Deckkraft-Werte pro dp-Stufe: 0dp=0%, 1dp=5%, 2dp=7%, 3dp=8%, 4dp=9%, 6dp=11%, 8dp=12%, 12dp=14%, 16dp=15%, 24dp=16% — verifiziere diese Tabelle an der Quelle). Wie stuft man ohne Farbverlust ab? Suche nac

---

Recherche abgeschlossen — 20+ Quellen abgerufen, alle Zahlen selbst nachgerechnet (offizielle APCA-W3-Implementierung 0.1.9 + WCAG-2-Formel).

---

# DUNKLE OBERFLÄCHEN — Rechercheberich

## Methodik

WebSearch-Budget war nach 2 Abfragen erschöpft; ab dann ausschließlich direkte Abrufe (WebFetch + curl). Abgerufen: 20 Quellen, davon 9 Primärquellen (W3C, Google-Code, IBM-Code, GitHub-Primer-Code, Vercel-CSS, Radix-Code).

**Wichtig:** Ich habe die Kontrastzahlen nicht abgeschrieben, sondern gerechnet. Dafür habe ich die offizielle APCA-W3-Referenzimplementierung (`apca-w3@0.1.9`, Somers, W3-Lizenz, von jsDelivr) plus `colorparsley@0.1.8` lokal installiert und gegen die WCAG-2-Formel (0.2126R + 0.7152G + 0.0722B) laufen lassen. Alle „Lc"- und „:1"-Werte unten sind Messwerte, keine Zitate.

---

# TEIL 1 — BELEGT

## 1. Kontrastanforderungen und warum die WCAG-2-Formel auf Dunkel bricht

### 1.1 Was WCAG 2.2 verlangt (Primärquelle)

**SC 1.4.3 Contrast (Minimum), Level AA** — https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- Text: **4.5:1**; großer Text: **3:1**
- „Groß" = 18pt oder 14pt fett ≈ **24px bzw. 18,66px**
- Ausnahmen: inaktive Bedienelemente, reine Dekoration, Logos/Markennamen
- Relative Luminanz: **L = 0,2126·R + 0,7152·G + 0,0722·B** (mit sRGB-Gamma-Rückrechnung bei Schwelle 0,04045)
- Begründung der Zahlen: 4.5:1 kompensiert Sehverlust ≈ **20/40**, 7:1 (AAA) ≈ **20/80**

**SC 1.4.11 Non-text Contrast** — https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- **3:1** gegen angrenzende Farben, für Bedienelemente (inkl. Fokusindikator) und für die bedeutungstragenden Teile von Grafiken
- **Nicht runden**: „2.999:1 would not meet the 3:1 threshold"
- Ausnahmen: inaktiv, Logo, „essential", dekorativ, redundant zu Text

**SC 1.4.1 Use of Color** — https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
- „Color is not used as the only visual means of conveying information…"
- Empfohlene Technik u. a.: mindestens **3:1 zwischen den unterschiedenen Farben** plus ein zweiter Träger (Text, Muster, Form)

### 1.2 Der Vorwurf, und der Nachweis

Andrew Somers (Myndex) — https://git.apcacontrast.com/documentation/WhyAPCA.html:

> „WCAG 2.x far overstates contrast for dark colors to the point that 4.5:1 can be functionally unreadable when a color is near black. As a result, WCAG 2.x contrast cannot be used for guidance designing 'dark mode'."

Weiter dort: „WCAG 2 contrast can pass colors that should fail as not readable, and sometimes the WCAG 2 math fails a color pair that *should pass*", und: rund **86 %** aller Websites fallen durch WCAG-2-Kontrast, teils wegen falscher Mathematik, nicht wegen schlechter Zugänglichkeit.

**Das habe ich nachgemessen.** Gleiche WCAG-Zahl, beide Polaritäten:

| WCAG-Ziel | dunkel auf hell | gemessen | APCA | hell auf dunkel | gemessen | APCA |
|---|---|---|---|---|---|---|
| ~4,5:1 | `#777777` auf `#ffffff` | 4,48:1 | **Lc 71,1** | `#747474` auf `#000000` | 4,49:1 | **Lc 29,2** |
| ~7:1 | `#595959` auf `#ffffff` | 7,00:1 | **Lc 84,3** | `#959595` auf `#000000` | 7,01:1 | **Lc 45,1** |
| ~10:1 | `#424242` auf `#ffffff` | 10,05:1 | **Lc 93,4** | `#b3b3b3` auf `#000000` | 10,02:1 | **Lc 61,2** |

Bei **identischer** WCAG-Zahl liegt der wahrgenommene Kontrast auf Dunkel um **Faktor 2,4** (4,5:1) bzw. **1,9** (7:1) niedriger. Der Vorwurf ist quantitativ belegt.

**Die praktische Konsequenz, gerechnet:** Um APCAs Fließtext-Minimum Lc 75 zu erreichen, braucht man auf dunklem Grund:

| Grund | hellster Grauwert mit Lc ≥ 75 | WCAG-Verhältnis dabei |
|---|---|---|
| `#000000` | `#cbcbcb` | **12,94:1** |
| `#121212` | `#cccccc` | **11,67:1** |
| `#161616` (Carbon) | `#cdcdcd` | **11,38:1** |
| `#1a1a1a` (Geist) | `#cecece` | **11,06:1** |
| `#0D1117` (Primer) | `#cccccc` | **11,78:1** |

Also: **auf Dunkel entspricht APCAs Fließtext-Minimum etwa WCAG 11–13:1, nicht 4,5:1.** Die WCAG-2-Schwelle ist dort um Faktor ~2,5 zu lasch.

### 1.3 APCA-Lc-Werte (Primärquelle)

https://git.apcacontrast.com/documentation/APCAeasyIntro.html und https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html

| Lc | Bedeutung | Mindestgröße/-gewicht |
|---|---|---|
| **90** | bevorzugt für Fließtext | 14px/400 bzw. 18px/300 |
| **75** | **Minimum für Fließtext/Spaltentext** | 18px/400, 16px/500, 14px/700, 24px/300 |
| **60** | Minimum für Inhaltstext, der kein Fließtext ist | 24px/400, 21px/500, 18px/600, 16px/700 |
| **45** | Überschriften, große/fette Schrift; Minimum für Piktogramme mit feinen Details | 36px/400 oder 24px/700 |
| **30** | absolutes Minimum; Platzhalter, deaktivierte Elemente | – |
| **15** | absolutes Minimum für unterscheidbare Nicht-Text-Elemente ≥ 5px | – |

Für AAA-Niveau: +Lc 15 auf die jeweilige Stufe. APCA berücksichtigt Schriftgröße, -gewicht **und Polarität** — das tut WCAG 2 nicht.

### 1.4 WCAG 3 — hier muss ich bremsen

https://www.w3.org/TR/wcag-3.0/ — Stand **Working Draft vom 3. März 2026**, Abschnitt „Guidelines" mit Status *Developing*. Der Entwurf sagt selbst: „The final set of requirements in WCAG 3 will be different from what is in this draft" und veranschlagt „several years of work".

**Und: der aktuelle WCAG-3-Entwurf nennt APCA nicht namentlich.** Die Kontrastanforderungen dort sind derzeit qualitativ formuliert („The foreground and background color of text can be adjusted…"). Die verbreitete Aussage „APCA ist WCAG 3" ist **im abgerufenen Dokument nicht belegt**. Belegt ist nur, dass APCA sich selbst als „candidate contrast method" positioniert (git.apcacontrast.com) und dass die Detailkriterien nach readtech.org/ARC ausgelagert sind. Das APCA-Repo (https://github.com/Myndex/SAPC-APCA) nennt eigene Konformitätsstufen **Bronze / Silver / Gold**.

---

## 2. Warum kein Reinweiß auf Reinschwarz

### 2.1 Die Zahlen (gemessen)

| Paar | WCAG | APCA |
|---|---|---|
| `#FFFFFF` auf `#000000` | **21,00:1** | Lc 107,9 |
| `#FFFFFF` auf `#121212` | 18,73:1 | Lc 107,3 |

21:1 ist das Maximum der Skala. Beide liegen weit über jeder Anforderung — das Problem ist also **kein Kontrastmangel, sondern ein Kontrastüberschuss**.

### 2.2 Material Design (belegt, mit Einschränkung)

**Google-Codelab** (developers.google.com, Primärquelle Google) — https://codelabs.developers.google.com/codelabs/design-material-darktheme:
- Grundfläche: **`#121212`**
- Textdeckkraft auf Dunkel: **High 87 % · Medium 60 % · Disabled 38 %**

**Flutter-Quellcode** (`ColorScheme.dark()`, packages/flutter/lib/src/material/color_scheme.dart) — die Material-2-Baseline steht dort als Code:
- `surface = 0xff121212`, `onSurface = white`
- `primary = 0xffbb86fc`, `secondary = 0xff03dac6`, `error = 0xffcf6679`

Gemessen auf `#121212`: primary 7,07:1 / **Lc 50,0** · secondary 10,57:1 / Lc 70,2 · error 5,20:1 / **Lc 37,9**. Das heißt: **Materials eigene Baseline-Fehlerfarbe erreicht Lc 38** — unter APCAs Lc 45 für Überschriften, weit unter Lc 60/75 für Text.

**Die 87/60/38-Deckkräfte, ausgerechnet** (Weiß über `#121212` komponiert):

| Emphasis | resultierender Hex | WCAG | APCA |
|---|---|---|---|
| High 87 % | `#e0e0e0` | 14,19:1 | **Lc 87,3** |
| Medium 60 % | `#a0a0a0` | 7,16:1 | **Lc 50,3** |
| Disabled 38 % | `#6c6c6c` | 3,57:1 | **Lc 25,1** |

Bemerkenswert: „Medium emphasis" besteht WCAG AA und sogar AAA (7,16:1), erreicht aber **nur Lc 50** — unter APCAs Lc 60 für Nicht-Fließtext und weit unter Lc 75. Genau der Fehlertyp, den Somers beschreibt, in einer Google-Spezifikation.

### 2.3 Halation / Astigmatismus — hier ist die Beleglage schwach

**Nicht belegt gefunden.** Ich habe die APCA-Dokumentation (drei Seiten), das SAPC-APCA-Repo und die Nielsen-Norman-Forschungsübersicht durchsucht: **das Wort „halation" kommt in keiner dieser Quellen vor.** Auch NN/g liefert keine Daten zu Astigmatismus oder Halation.

Was ich stattdessen belegen kann:

**Nielsen Norman Group** — https://www.nngroup.com/articles/dark-mode/ — referiert echte Studien:
- **Piepenbrock et al. (2013), *Ergonomics***: Landolt-C-Sehschärfe und Korrekturlesen, junge (18–33) und ältere (60–85) Erwachsene mit normaler Sehkraft. **Positive Polarität (hell) war in beiden Altersgruppen überlegen.** „The smaller the font, the better it is for users to see the text in light mode."
- **Dobres et al. (2017), *Applied Ergonomics***: tagsüber kein signifikanter Polaritätseffekt; **nachts war Light Mode besser**; kleine Schrift war im Dark Mode nachts deutlich schwerer lesbar.
- Mechanismus laut NN/g: mehr Licht → **stärkere Pupillenverengung** → weniger sphärische Aberration, größere Schärfentiefe.
- Gegenbefund: Aleman et al. (2018) — Langzeit-Light-Mode assoziiert mit Aderhautverdünnung (Myopie-Risiko).
- Kein Unterschied in der Ermüdung zwischen den Modi.

**Der Halation-Mechanismus** ist nur sekundär belegt — https://atmos.style/blog/dark-mode-ui-best-practices: dunkle UI → Iris weitet sich → mehr Licht → bei Astigmatismus „bleedet" weißer Text in den dunklen Grund. Das ist ein Design-Blog, **keine ophthalmologische Quelle**. Die physiologische Kette (Pupillenweitung → Aberration) deckt sich zwar mit dem NN/g-Mechanismus, aber die spezifische Astigmatismus-Zuschreibung habe ich nirgends primär belegen können.

### 2.4 Der „15,8:1"-Wert — zweitrangig belegt

Die Materialspezifikation soll fordern: dunkle Flächen müssen mit 100 % weißem Text mindestens **15,8:1** erreichen. Belegt gefunden nur zweiter Hand bei https://www.fourzerothree.in/p/scalable-accessible-dark-mode (explizit Material zugeschrieben). **Die Primärquelle m2.material.io/design/color/dark-theme.html ist nicht abrufbar** — reine Angular-SPA, liefert per curl und WebFetch nur die 68-KB-Hülle ohne Inhalt; auch der Wayback-Snapshot (20210605054954) liefert nur die Hülle.

Gerechnet, falls die Zahl stimmt: der **hellste zulässige Grundton** wäre etwa **`#232323`** (15,72:1 mit Reinweiß). `#121212` liegt mit 18,73:1 komfortabel darüber.

### 2.5 IBM Carbon g90/g100 (Primärquelle: Quellcode)

Aus `packages/colors/src/colors.ts` und `packages/themes/src/v10/{g90,g100}.ts` im Repo carbon-design-system/carbon:

| Token | g100 | g90 |
|---|---|---|
| `uiBackground` | gray100 = **`#161616`** | gray90 = **`#262626`** |
| `ui01` (Layer) | gray90 = `#262626` | gray80 = `#393939` |
| `ui02`/`ui03` | gray80 = `#393939` | gray70 = `#525252` |
| `text01` | gray10 = **`#f4f4f4`** | gray10 = `#f4f4f4` |
| `text02` | gray30 = **`#c6c6c6`** | gray30 = `#c6c6c6` |

Gemessen:

| Paar | WCAG | APCA |
|---|---|---|
| g100 `#f4f4f4` auf `#161616` | 16,45:1 | **Lc 99,7** |
| g100 `#c6c6c6` auf `#161616` | 10,59:1 | **Lc 71,2** |
| g90 `#f4f4f4` auf `#262626` | 13,76:1 | Lc 97,6 |
| g90 `#c6c6c6` auf `#262626` | 8,86:1 | **Lc 69,0** |

**Auch IBM nutzt kein Reinschwarz und kein Reinweiß.** Beide Sekundärtexte liegen unter Lc 75 — knapp, aber real.

### 2.6 Das wichtigste Gegenbeispiel: Vercel Geist nutzt Reinschwarz

Aus dem ausgelieferten CSS von vercel.com (Chunk `0ggp-66pwlt2m.css`, Selektor `.dark,.dark-theme,.invert-theme`):

```
--ds-background-100: #000
--ds-background-200: #000
--ds-gray-1000:      #ededed   /* Text */
```

**Vercel setzt im Dark Mode Reinschwarz als Grundfläche.** Die Halation-Milderung passiert dort **auf der Textseite** (`#ededed` statt `#ffffff`), nicht auf der Grundseite. Gemessen: `#ededed` auf `#000000` = **17,94:1 / Lc 96,1** gegenüber 21,00:1 / Lc 107,9 bei Reinweiß.

Die Regel „niemals Reinschwarz" ist damit **nicht universeller Konsens der Design-Systeme**, sondern eine Material-Position. Wer sie zitiert, sollte das dazusagen.

---

## 3. Flächenabstufung auf dunklem Grund

### 3.1 Materials Elevation-Overlay-Tabelle — VERIFIZIERT, aber nicht an der genannten Quelle

Die Spezifikationsseite ist nicht abrufbar (s. 2.4). **Zwei unabhängige Google-Implementierungen** reproduzieren die Tabelle aber im Quellcode, beide mit Verweis auf genau diese Spezifikation:

**Flutter** — `packages/flutter/lib/src/material/elevation_overlay.dart`:
```
(4.5 * math.log(elevation + 1) + 2) / 100.0
// „This formula matches the values in the spec:
//  https://material.io/design/color/dark-theme.html#properties"
```

**Material Components Android** — `ElevationOverlayProvider.java`:
```java
private static final float FORMULA_MULTIPLIER = 4.5f;
private static final float FORMULA_OFFSET     = 2f;
alphaFraction = (FORMULA_MULTIPLIER * Math.log1p(elevationDp) + FORMULA_OFFSET) / 100;
```

Ich habe die Formel ausgewertet — **die von dir genannte Tabelle stimmt exakt**:

| dp | Formel | gerundet | Fläche über `#121212` | WCAG zur Grundfläche |
|---|---|---|---|---|
| 0 | 0 % | **0 %** | `#121212` | 1,00:1 |
| 1 | 5,12 % | **5 %** | `#1e1e1e` | 1,12:1 |
| 2 | 6,94 % | **7 %** | `#222222` | 1,18:1 |
| 3 | 8,24 % | **8 %** | `#262626` | 1,24:1 |
| 4 | 9,24 % | **9 %** | `#282828` | 1,27:1 |
| 6 | 10,76 % | **11 %** | `#2b2b2b` | 1,32:1 |
| 8 | 11,89 % | **12 %** | `#2e2e2e` | 1,38:1 |
| 12 | 13,54 % | **14 %** | `#323232` | 1,46:1 |
| 16 | 14,75 % | **15 %** | `#353535` | 1,53:1 |
| 24 | 16,48 % | **16 %** | `#393939` | 1,62:1 |

Alle zehn Werte reproduzieren. Auch das Codelab bestätigt Einzelwerte (Bottom App Bar = 12 % ⇒ 8dp).

**Die entscheidende Erkenntnis aus dieser Tabelle:** die gesamte Elevationsleiter von 0dp bis 24dp spannt nur **1,62:1**. Selbst der maximale Sprung liegt **weit unter den 3:1 aus SC 1.4.11**. Flächenabstufung auf Dunkel kann per Konstruktion niemals die Non-Text-Kontrastanforderung erfüllen — **wo eine Kante Bedeutung trägt (Bedienelement, Feldgrenze), muss ein Rahmen oder ein anderes Merkmal hinzukommen.** Das gilt für jedes System: Carbon `#262626` auf `#161616` = 1,20:1; Geist `#1a1a1a` auf `#000000` = 1,21:1.

### 3.2 Radix Colors — die 12-Schritte-Skala (Primärquelle)

https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale:

| Schritt | Zweck |
|---|---|
| 1–2 | App-Hintergrund; subtile Komponentenflächen |
| 3 | Komponentenfläche, Normalzustand |
| 4 | Hover |
| 5 | Pressed / Selected |
| 6 | subtiler Rahmen, nicht-interaktiv |
| 7 | subtiler Rahmen, interaktiv |
| 8 | stärkerer Rahmen, Fokusringe |
| 9 | „the purest step" — Vollton, mit dem geringsten Weiß-/Schwarzanteil |
| 10 | Hover zu 9 |
| 11 | Text, niedriger Kontrast |
| 12 | Text, hoher Kontrast |

Und die harte Zusage: Schritte 11 und 12 „**are guaranteed to Lc 60 and Lc 90 APCA contrast ratio on top of a step 2 background from the same scale**". Bemerkenswert: Radix formuliert seine Garantie **in APCA, nicht in WCAG**.

**Ich habe die Zusage nachgemessen** (aus `raw.githubusercontent.com/radix-ui/colors/main/src/dark.ts`):

| Skala | Schritt 11 auf 2 | Zusage Lc 60 | Schritt 12 auf 2 | Zusage Lc 90 |
|---|---|---|---|---|
| gray | Lc **60,6** (8,48:1) | ✓ | Lc **95,5** (15,15:1) | ✓ |
| slate | Lc **60,3** (8,45:1) | ✓ | Lc **95,5** (15,15:1) | ✓ |
| red | Lc **60,3** (8,56:1) | ✓ | Lc **84,7** (13,20:1) | **✗ (−5,3)** |
| green | Lc **66,2** (9,37:1) | ✓ | Lc **88,4** (13,65:1) | **✗ (−1,6)** |

Die Lc-60-Zusage hält durchgehend. Die **Lc-90-Zusage für Schritt 12 hält bei den chromatischen Skalen nicht** — rot verfehlt sie um 5,3 Lc. Das ist ein Messbefund am aktuellen `main`, keine Meinung.

**Radix grayDark, gemessen (Nachbarabstände):**

`#111111 · #191919 · #222222 · #2a2a2a · #313131 · #3a3a3a · #484848 · #606060 · #6e6e6e · #7b7b7b · #b4b4b4 · #eeeeee`

Abstände: 1,07 · 1,11 · 1,11 · 1,10 · 1,14 · 1,24 · 1,45 · 1,23 · 1,21 · **2,04** · 1,79

Die Skala ist bis Schritt 9 **fein und gleichmäßig** (~1,1:1 pro Stufe), dann kommt zwischen 10 und 11 der große Sprung — genau die Grenze zwischen „Flächen/Rahmen" und „Text". Die Struktur ist im Code sichtbar.

### 3.3 GitHub Primer (Primärquelle: primer/primitives)

`src/tokens/base/color/dark/dark.json5`, neutral-Skala:

`0 = #010409` (base.color.black) · `1 = #0D1117` · `2 = #151B23` · `3 = #212830` · `4 = #262C36` · `5 = #2A313C` · `6 = #2F3742` · `7 = #3D444D` · `8 = #656C76` · `9 = #9198A1` · `10 = #B7BDC8` · `11 = #D1D7E0` · `12 = **#F0F6FC**` · `13 = #ffffff`

Zuordnung aus `functional/color/{bgColor,fgColor}.json5`: `bgColor.default = neutral.0`, `bgColor.muted = neutral.1`, `fgColor.default → dark: neutral.12`, `fgColor.muted = neutral.9`.

Gemessen auf `#010409`:

| Token | Hex | WCAG | APCA |
|---|---|---|---|
| fgColor.default | `#F0F6FC` | 18,87:1 | **Lc 101,4** |
| fgColor.muted | `#9198A1` | 7,05:1 | **Lc 46,3** |
| fgColor.accent (dark) | `#4493F8` | 6,63:1 | **Lc 44,1** |
| fgColor.success | `#3fb950` | 8,08:1 | **Lc 52,6** |
| fgColor.danger | `#f85149` | 6,13:1 | **Lc 41,9** |
| borderColor.default | `#3D444D` | 2,09:1 | **Lc 9,6** |

Auch GitHub: Grund ist **nicht** `#000000` (sondern `#010409`), Text ist **nicht** `#ffffff` (sondern `#F0F6FC`). Und: der Standardrahmen liegt mit **2,09:1 unter den 3:1** von SC 1.4.11 — für dekorative Trennlinien zulässig, für Bedienelementgrenzen nicht.

### 3.4 Vercel Geist (Primärquelle: ausgeliefertes CSS)

Dark-Grauskala: `100 = #1a1a1a · 200 = #1f1f1f · 300 = #292929 · 400 = #2e2e2e · 500 = #454545 · 600 = #878787 · 700 = #8f8f8f · 800 = #7d7d7d · 900 = #a0a0a0 · 1000 = #ededed`

Dokumentierte Semantik der Stufen (https://vercel.com/geist/colors): 100–300 Flächen (default/hover/active), 400–600 Rahmen (default/hover/active), 700–800 kontraststarke Flächen, 900–1000 Text und Icons. Zehn Stufen, dieselbe Dreiteilung wie Radix mit zwölf.

**Kuriosität, gemessen:** die Skala ist nicht monoton — `800 = #7d7d7d` ist *dunkler* als `700 = #8f8f8f`, und `600 = #878787` liegt zwischen beiden. Das ist im ausgelieferten CSS so, nicht mein Lesefehler. Die Stufen 700/800 sind laut Doku „high contrast backgrounds", nicht Textstufen — die Umkehrung ist also vermutlich Absicht (Vollton-Flächen), aber sie bricht die Erwartung „höhere Zahl = heller".

Auf Geist-Dark hex-Werte für die Akzentskalen (`.dark`-Block): `blue-900 #50a8ff` (8,39:1 / **Lc 53,1**) · `red-900 #ff5e63` (7,03:1 / **Lc 46,3**) · `green-900 #00ca52` (9,57:1 / **Lc 59,8**) · `amber-900 #ff9900` (9,81:1 / **Lc 60,7**).

---

## 4. Akzentfarben

### 4.1 Was die Systeme tatsächlich tun (belegt)

**Radix** — https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette — empfiehlt eine **Dreischichtung**: eine Grauskala + eine Akzent-/Markenskala + Semantikskalen (Fehler, Erfolg, Warnung, Info). Zwei Paarungsstrategien: „neutral" (reines `gray` zu jedem Akzent) oder „natural" (die Grauskala wählen, die mit dem Akzentton gesättigt ist).

Und eine **explizite Dark-Mode-Warnung**: „If your project uses a lot of colorful UI components like Badge, be careful when using saturated grays for your app background, especially in dark mode. Colorful UI components may clash with your saturated gray background color."

Außerdem: „Radix Colors are not intended to be customised" — eigene Marken-Töne als **zusätzliche** Skala neben die Radix-Skalen, nicht als Ersatz.

**Vercel Geist** listet neben `backgrounds`, `gray`, `gray-alpha` genau sieben chromatische Skalen (blue, red, amber, green, teal, purple, pink) — aber die Doku enthält **keine „ein Akzent"-Regel**. Hex-Werte werden auf der Seite gar nicht gezeigt (nur `var(--ds-…)`); ich musste sie aus dem CSS holen.

### 4.2 Die „One Accent Color"-Regel und 60-30-10 — NICHT BELEGT

Ich habe dafür **keinen Beleg in einer Primärquelle gefunden**. Weder Radix, noch Geist, noch Primer, noch Carbon, noch W3C formulieren eine Ein-Akzent-Regel oder eine 60-30-10-Aufteilung. Das WebSearch-Budget war erschöpft, bevor ich diesen Punkt gezielt verfolgen konnte, und Mojeek/DuckDuckGo blockten die Ersatzabfragen (403 bzw. ECONNRESET). Carbons Farbnutzungsseiten (`/guidelines/color/usage/`, `/elements/color/usage/`) lieferten 404 bzw. abgeschnittenen Inhalt.

Was ich **stattdessen** belegen kann: die Struktur der Systeme selbst spricht für Sparsamkeit — Radix nennt explizit *eine* Akzentskala neben Grau plus Semantik; Primer setzt `fgColor.accent` als **einen** Token für Links und interaktive Elemente. Das ist ein Indiz, keine Regel.

---

## 5. Zahlen und Tabellen auf dunklem Grund

### 5.1 Prävalenz (belegt)

https://www.colourblindawareness.org/colour-blindness/:
- **1 von 12 Männern (8 %)**, 1 von 200 Frauen
- UK: ca. 3 Mio. (≈ 4,5 % der Bevölkerung); weltweit ca. **300 Mio.**
- Die Seite nennt **keine** Aufschlüsselung nach Deuteranomalie/Protanopie/Tritanopie — die von dir vermutete Verteilung habe ich dort nicht belegt gefunden.

Die 8 %-Zahl stimmt also, aber sie ist **eine Männerquote**, keine Gesamtbevölkerungsquote.

### 5.2 Das Rot-Grün-Problem, gemessen

Datawrapper — https://www.datawrapper.de/blog/colorblindness-part2/ — Kernregel: „**Get it right in black & white.**" Farben bleiben unterscheidbar, wenn sie sich deutlich in der Helligkeit unterscheiden, unabhängig vom Farbton. Blau ist „the safest hue"; die sicherste Mehrfarbenkombination ist **Blau + Orange/Rot**. Maximal 3–4 Farben gleichzeitig. Zusätzliche Träger: Direktbeschriftung, Symbole/Formen, Muster, Strichvariation.

**Ich habe die Signalfarbenpaare der drei Systeme gegeneinander gemessen** — also den Helligkeitsabstand zwischen „Erfolg" und „Fehler", nicht gegen den Grund:

| Paar | Hex | WCAG zwischen den Farben |
|---|---|---|
| Radix red11 / green11 | `#ff9592` / `#3dd68c` | **1,12:1** |
| Primer danger / success (dark) | `#f85149` / `#3fb950` | **1,32:1** |
| Geist red-900 / green-900 | `#ff5e63` / `#00ca52` | **1,36:1** |
| Primer Protan-Variante (orange) / success | `#f0883e` / `#3fb950` | **1,00:1** |
| Blau/Orange (Radix blue11/orange11) | `#70b8ff` / `#ffa057` | **1,04:1** |

**Alle liegen zwischen 1,00 und 1,36:1 — also weit unter den 3:1, die SC 1.4.1 als Technik für unterscheidbare Farben nennt.** In Graustufen sind diese Paare praktisch identisch. Datawrappers „Get it right in black & white" wird von **keinem** der drei Systeme für die Semantikfarben eingehalten. Für Kosten/Werte in Tabellen heißt das konkret: **die Farbe allein trägt nichts** — Vorzeichen, Glyphe oder Position müssen die Information tragen, die Farbe ist Verstärker.

### 5.3 Der beste belegte Fund: Primer hat dafür eigene Themes

Aus `primer/primitives` extrahiert — Primer definiert **18 Theme-Modi**, darunter:

`dark` · `dark-dimmed` · `dark-high-contrast` · `dark-dimmed-high-contrast` · **`dark-protanopia-deuteranopia`** · **`dark-protanopia-deuteranopia-high-contrast`** · **`dark-tritanopia`** · `dark-tritanopia-high-contrast` (und die hellen Gegenstücke)

Und die Überschreibung ist konkret: `fgColor.danger` wird im Modus `dark-protanopia-deuteranopia` von Rot (`base.color.red.4 = #f85149`) auf **Orange** (`base.color.orange.3 = #f0883e`) umgestellt. `fgColor.accent` wird in den High-Contrast-Farbfehlsicht-Themes auf `#74B9FF` gesetzt.

Das ist der **belastbarste Beleg** für „Rot-Grün ersetzen" in diesem Bericht: ein produktiv ausgeliefertes System, das Rot für Protanopie/Deuteranopie durch Orange tauscht — und zwar als Theme-Ebene, nicht als Empfehlung.

Aber: gemessen ist der Helligkeitsabstand dieser Orange-Variante zu Grün **1,00:1** — Primer verlässt sich dort **rein auf Farbtontrennung**, nicht auf Helligkeit. Wer Datawrappers Regel ernst nimmt, müsste zusätzlich die Helligkeit spreizen.

### 5.4 Was für Zahlenkolonnen zusätzlich messbar ist

Amber ist auf Dunkel die hellste Signalfarbe: Radix `amber11 #ffca16` auf `#111111` = 12,33:1 / **Lc 78,3** — als einzige der Semantikfarben über APCAs Fließtext-Minimum Lc 75. Rot (`#ff9592`, Lc 60,8) und Blau (`#70b8ff`, Lc 60,8) liegen exakt auf Lc 60, also nur für **Nicht-Fließtext** freigegeben. Für eine Tabelle mit vielen kleinen Zahlen in Signalfarbe ist das relevant: **eingefärbte Zahlen erfüllen bei 14–16px die APCA-Anforderung nicht**, auch wenn sie WCAG 4.5:1 mühelos bestehen.

---

# TEIL 2 — MEINUNG / NICHT BELEGT

Klar getrennt, weil das oben Gemessene sonst entwertet wird.

1. **„Niemals Reinschwarz" ist keine belegte Universalregel.** Material sagt es (über das Codelab und den Flutter-Code belegt), Vercel Geist tut das Gegenteil im ausgelieferten Produkt. Meine Einschätzung: die Milderung kann auf *einer* der beiden Seiten stattfinden — Grund anheben (Material, Carbon, Primer) oder Text absenken (Geist). Beides senkt Lc 108 auf ~96–100. Beides zu tun ist zulässig, keines zu tun nicht.

2. **Die Astigmatismus-Begründung für Halation** ist plausibel und deckt sich mit dem von NN/g belegten Pupillenmechanismus, ist aber in den von mir erreichten Quellen **nicht primär belegt**. Ich würde sie nicht als Faktum zitieren.

3. **„APCA ist der WCAG-3-Standard"** — nicht belegt. Der WCAG-3-Entwurf vom 03.03.2026 nennt APCA nicht. APCA ist ein Kandidatenverfahren mit eigener Konformitätsleiter (Bronze/Silver/Gold) und eigener Kriteriensammlung (readtech.org/ARC).

4. **Ein-Akzent-Regel / 60-30-10** — nicht belegt (s. 4.2). Die Strukturen der Systeme legen Sparsamkeit nahe, formulieren sie aber nicht als Regel.

5. **Materials 15,8:1** — nur zweitrangig belegt, Primärquelle technisch unerreichbar.

6. **Mein praktischer Schluss** (Meinung, aber auf den Messungen oben aufgebaut): auf Dunkel ist WCAG 4.5:1 als alleiniges Kriterium untauglich — es lässt Text durch, der Lc 29 hat. Wer dunkel gestaltet, sollte **beide** Maße führen: WCAG für die Rechtskonformität, APCA Lc ≥ 75 für Fließtext / Lc ≥ 60 für Zahlen und Sekundärtext als tatsächliches Lesbarkeitsziel. Praktisch bedeutet Lc 75 auf `#121212`-artigem Grund einen Text nicht dunkler als etwa `#cccccc`.

7. **Für Zahlen/Kosten in Tabellen** (Meinung): Farbe nur als dritter Träger. Erster Träger ist das Vorzeichen bzw. eine Glyphe, zweiter die Helligkeitsstufe (Amber Lc 78 gegen Grau Lc 60 lässt sich in Graustufen noch trennen — Rot gegen Grün mit 1,12:1 nicht). Tabellarische Ziffern (`font-variant-numeric: tabular-nums`) und rechtsbündige Ausrichtung tragen mehr zur Lesbarkeit einer Zahlenkolonne bei als jede Einfärbung.

---

## Was nicht erreichbar war

- **m2.material.io/design/color/dark-theme.html** — Angular-SPA, liefert per curl (68 KB), WebFetch und Wayback-Snapshot (20210605054954) nur die Hülle. Elevationstabelle und 15,8:1 daher über Google-Quellcode bzw. Sekundärquelle belegt.
- **developer.apple.com/design/human-interface-guidelines/dark-mode** — SPA (17 KB Hülle); die DocC-JSON-Endpunkte (`/tutorials/data/…dark-mode.json`) liefern ebenfalls HTML. **Apple HIG konnte ich nicht belegen** — keine der Aussagen dieses Berichts stützt sich darauf.
- **carbondesignsystem.com** Farbnutzungsseiten — 404 bzw. abgeschnitten. Carbon daher komplett über den Quellcode belegt (was ohnehin die bessere Quelle ist).
- **Suchmaschinen** — WebSearch-Budget nach 2 Abfragen erschöpft; Mojeek 403, DuckDuckGo lite leer/ECONNRESET. Ab dann nur direkte URL-Zugriffe, was die Quellenauswahl auf Systeme mit öffentlichem Quellcode verschoben hat.

**Quellen:** [APCA – Why APCA](https://git.apcacontrast.com/documentation/WhyAPCA.html) · [APCA Easy Intro](https://git.apcacontrast.com/documentation/APCAeasyIntro.html) · [APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html) · [SAPC-APCA Repo](https://github.com/Myndex/SAPC-APCA) · [WCAG 2.2 SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) · [SC 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) · [SC 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) · [WCAG 3.0 Draft](https://www.w3.org/TR/wcag-3.0/) · [Material Dark Theme Codelab](https://codelabs.developers.google.com/codelabs/design-material-darktheme) · [Flutter elevation_overlay.dart](https://raw.githubusercontent.com/flutter/flutter/master/packages/flutter/lib/src/material/elevation_overlay.dart) · [Flutter color_scheme.dart](https://raw.githubusercontent.com/flutter/flutter/master/packages/flutter/lib/src/material/color_scheme.dart) · [MDC-Android ElevationOverlayProvider](https://raw.githubusercontent.com/material-components/material-components-android/master/lib/java/com/google/android/material/elevation/ElevationOverlayProvider.java) · [Radix – Understanding the scale](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale) · [Radix – Composing a palette](https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette) · [Radix dark.ts](https://raw.githubusercontent.com/radix-ui/colors/main/src/dark.ts) · [Carbon colors.ts](https://raw.githubusercontent.com/carbon-design-system/carbon/main/packages/colors/src/colors.ts) · [Carbon g100/g90](https://github.com/carbon-design-system/carbon/tree/main/packages/themes/src/v10) · [Primer primitives dark.json5](https://raw.githubusercontent.com/primer/primitives/main/src/tokens/base/color/dark/dark.json5) · [Vercel Geist Colors](https://vercel.com/geist/colors) · [NN/g Dark Mode](https://www.nngroup.com/articles/dark-mode/) · [Colour Blind Awareness](https://www.colourblindawareness.org/colour-blindness/) · [Datawrapper Colorblindness Pt.2](https://www.datawrapper.de/blog/colorblindness-part2/) · [Atmos Dark Mode Best Practices](https://atmos.style/blog/dark-mode-ui-best-practices) · [fourzerothree](https://www.fourzerothree.in/p/scalable-accessible-dark-mode)

---

# NACHTRAG — Zwei Skins statt einer dunklen Fläche

Ich habe die Frage neu vermessen: alle Zahlen unten stehen für **beide** Gründe. Grundwerte aus dem Projekt selbst (`frontend/src/services/theme-presets.ts`): dunkel `#0a0a0a` (Seite) / `#171717` (Fläche); Atlas `#e9ede9` (Seite) / `#dfe5e0` (raised) / `#d5dcd6` (sunken), Tinte `#17201d`.

Neue externe Primärquellen: Grafana-Quellcode (`palette.ts`, `createColors.ts`, `createVisualizationColors.ts`), d3-scale-chromatic, Vega, Observable Plot, ECharts-6-Release-Notes — plus das Projekt selbst.

---

## 1. Welche Rollen kippen beim Skinwechsel — BELEGT

### 1.1 Dein Bernstein, gemessen

| Token | Hex | auf `#0a0a0a` | auf `#e9ede9` | auf `#d5dcd6` |
|---|---|---|---|---|
| `--color-accent-amber` | `#f59e0b` | **9,22:1** ✓ | **1,82:1** ✗ | **1,54:1** ✗ |
| `--color-accent-amber-hover` | `#fbbf24` | 11,86:1 ✓ | **1,41:1** ✗ | **1,20:1** ✗ |
| `--color-accent-amber-dim` | `#be5e09` | 4,52:1 ✓ | 3,70:1 (nur Kontur) | 3,14:1 |

Die Erfahrung stimmt exakt: Bernstein auf Schwarz ist mit 9,22:1 komfortabel, auf Papier mit **1,82:1** unter jeder denkbaren Schwelle — und auf der gesenkten Papierauflage bei **1,54:1**, also faktisch unsichtbar. Der Faktor zwischen den beiden Gründen ist **5,1**.

Und die schon gebaute Lösung hält: `--color-accent-amber-readable` = `color-mix(… amber 45 %, text-primary)` ergibt auf dunkel `#ecc583` → **12,14:1 / Lc 75**, auf Papier `#7b5915` → **5,41:1 / Lc 70** (und 4,58:1 gegen den sunken-Grund). Ein Token, zwei Ergebnisse, weil der Mischpartner mit dem Skin kippt. Das ist die saubere Bauweise.

### 1.2 Der externe Beleg: Grafana führt VIER Werte pro Farbton

Aus `packages/grafana-data/src/themes/palette.ts` (Quellcode, nicht Doku):

| Ton | darkMain | darkText | lightMain | lightText |
|---|---|---|---|---|
| blue | `#3d71d9` | `#6e9fff` | `#3871dc` | `#1f62e0` |
| red | `#d10e5c` | `#ff5286` | `#e0226e` | `#cf0e5B` |
| green | `#1a7f4b` | `#6ccf8e` | `#1b855e` | `#0a764e` |
| **orange** | **`#ff9900`** | `#fbad37` | **`#ff9900`** | `#B04E0C` |
| purple | `#C27AFF` | `#D4A0FF` | `#A24BC8` | `#7c2ea3` |

**Das ist die Antwort auf deine Frage 1, im Quellcode eines produktiven Systems:** die Aufspaltung verläuft nicht zwischen den Farbtönen, sondern zwischen **Rolle „Füllung" (`main`) und Rolle „Text" (`text`)**.

Bei Orange sind `darkMain` und `lightMain` **buchstäblich derselbe Wert** — `#ff9900` in beiden Skins. Die Textvariante dagegen ist völlig verschieden: `#fbad37` (hell) gegen `#B04E0C` (dunkelbraun). Genau dein Bernstein-Fall, von Grafana identisch entschieden.

**Die Gegenprobe, die ich gerechnet habe — sie fällt vernichtend aus:**

Der dunkle Textton auf Papier (`#e9ede9`):

| | | |
|---|---|---|
| blue `#6e9fff` | 2,20:1 | ✗ |
| red `#ff5286` | 2,61:1 | ✗ |
| green `#6ccf8e` | 1,62:1 | ✗ |
| orange `#fbad37` | 1,59:1 | ✗ |
| purple `#D4A0FF` | 1,73:1 | ✗ |

Der helle Textton auf Dunkel (`#0a0a0a`):

| | | |
|---|---|---|
| blue `#1f62e0` | 3,66:1 | ✗ |
| red `#cf0e5B` | 3,65:1 | ✗ |
| green `#0a764e` | 3,50:1 | ✗ |
| orange `#B04E0C` | 3,72:1 | ✗ |
| purple `#7c2ea3` | 2,62:1 | ✗ |

**Zehn von zehn Kreuzungen fallen durch.** Es gibt keinen einzigen Textton, der beide Gründe trägt. Eine Ableitung („nimm denselben Ton, misch ein bisschen Weiß rein") kann das nicht heilen — die beiden Zielwerte liegen auf entgegengesetzten Seiten der Helligkeitsachse.

### 1.3 Die Liste der Rollen, die zwei Werte brauchen

**Zwei Werte (belegt, weil die Kreuzprobe durchfällt):**
- jede **Text-/Icon-Variante** einer Akzent- oder Semantikfarbe (Grafana: `*Text`; Projekt: `-readable`)
- **Tinte auf einer nicht-thembaren Fläche** — im Projekt bereits als Regel dokumentiert: `--color-text-inverse` misst in den 6 hellen Themes 1,00–1,19:1, `--color-text-primary` in den 5 dunklen 1,04–2,32:1. *Jedes* Theme fällt bei einem von beiden durch; die Lösung war ein Plattform-Konstantwert `--color-on-surface-inverse: #0a0a0a`.
- **Akzent auf einem Gegenblock**, der die Polarität der Seite umkehrt. Der Atlas-Zinnober `#ab3922` steht auf Papier bei 5,32:1 und auf dem Gegenblock `#24332d` bei **2,11:1**. Das Projekt hat dafür `--color-accent-on-contrast` eingeführt und setzt dort Amber (6,16:1). Belegt und behoben.
- **Overlays und Raster**, wo `rgba(255,255,255,x)` steht — auf Papier muss aufgehellt zu abgedunkelt werden. Im Projekt gelöst über `--color-overlay-ink*` und `--color-grid`, gemischt aus `--color-text-primary`.
- **Schattenfarbe** — `--color-shadow` (schwarz auf dunkel, Tinte auf Papier).

**Ein Wert reicht (belegt):**
- **Füllungen/Volltöne**. Grafanas Orange-`main` ist in beiden Skins `#ff9900`; das Projekt hält es genauso („Die FÜLLUNGEN bleiben reines Amber — ein Knopf ist kein Text"). Eine Fläche wird nicht gelesen, sie wird gesehen; sie braucht 3:1 gegen ihre Umgebung, nicht 4,5:1.
- **Beschriftung AUF einer nicht-thembaren Füllung** — `--color-on-accent-amber: #0a0a0a`, 9,22:1 gegen Amber in jedem Theme. Wenn die Fläche konstant ist, muss ihre Tinte es auch sein.

---

## 2. Diagrammfarben über zwei Gründe — BELEGT

### 2.1 Nein, eine kategoriale Palette trägt nicht beide Gründe

Gemessen, drei Standardpaletten (d3-scale-chromatic, wie sie Vega/Observable/Tableau verwenden), jeweils 10 Farben, Schwelle 3:1 nach SC 1.4.11:

| Palette | auf `#0a0a0a` | auf `#e9ede9` |
|---|---|---|
| **tableau10** | min 4,35 — **0/10** unter 3:1 | min 1,36 — **7/10** unter 3:1 |
| **observable10** | min 3,92 — **0/10** | min 1,62 — **7/10** |
| **category10** | min 3,34 — **0/10** | min 1,70 — **5/10** |

Alle drei sind für **helle** Gründe entworfen worden und schaffen dort trotzdem die 3:1 nicht — weil kategoriale Paletten auf *Unterscheidbarkeit untereinander* optimiert sind, nicht auf Kontrast zum Grund. Auf Dunkel bestehen sie zufällig alle. Die einzelnen Ausreißer sind die üblichen: tableau10s Gelb `#edc949` steht auf Papier bei **1,36:1**, observable10s `#efb118` bei 1,62:1.

**Das heißt: keine der belegten Standardpaletten ist auf beiden Gründen gleichzeitig ausreichend kontrastreich.** Wer eine sucht, muss sie selbst rechnen.

### 2.2 Wie Grafana es macht — und es ist keine der drei von dir genannten Optionen

`createVisualizationColors.ts`:
```ts
const baseHues = colors.mode === 'light' ? getLightHues() : getDarkHues();
```

Zwei getrennte Tabellen. Aber der Vergleich der beiden zeigt etwas Präziseres — nicht gespiegelt, nicht gedreht, nicht getauscht, sondern **dieselbe Leiter um genau eine Sprosse verschoben**:

```
Rot dunkel :  #FFA6B0  #FF7383  #F2495C  #E02F44  #C4162A
Rot hell   :           #FF7383  #F2495C  #E02F44  #C4162A  #AD0317
```

Das gilt für **alle sechs** Farbtöne (rot, orange, gelb, grün, blau, violett): die Namen `super-light` … `dark` bleiben, aber die Leiter rutscht auf Papier um eine Stufe nach unten. Der `primary: true`-Ton eines Tons ist auf hell also genau der, der auf dunkel `semi-dark` heißt.

Der Vorteil dieser Konstruktion: die Serienreihenfolge (`getClassicPalette()`, 64 Einträge) ist **skin-unabhängig** und arbeitet mit Namen (`'green'`, `'semi-dark-yellow'`, …), nicht mit Hexwerten. Ein Diagramm behält seine Serienidentität über den Skinwechsel, obwohl sich jeder konkrete Wert ändert. **Das ist das Muster, das ich empfehlen würde** — es trennt „welche Serie" von „welcher Ton", und nur das zweite hängt am Skin.

### 2.3 Observable Plot geht einen dritten Weg

Aus dem Quellcode (`src/style.js`, `src/plot.js`): Plot setzt Achsen, Ticks und Beschriftungen auf **`fill: "currentColor"`** und definiert genau eine CSS-Variable **`--plot-background: white`**. Das Chrome erbt damit über die normale CSS-Kaskade — kein Theme-Objekt, kein Umschalten. Nur die Serienfarben (d3-Schemata) bleiben literal.

Das ist elegant und für dein Problem **nur die halbe Lösung**: es löst das Chrome (Achsen/Text) restlos, aber genau die Serienfarben bleiben davon unberührt — und die sind laut 2.1 das eigentliche Problem.

### 2.4 Euer eigener Fall — ein noch offener Befund

`frontend/src/components/shared/EchartsChart.ts` hat bereits zwei Paletten. Gemessen:

| | auf `#0a0a0a` | auf `#e9ede9` | **auf `#d5dcd6` (sunken)** |
|---|---|---|---|
| SERIES_DARK `#d4a24e` | 8,56 ✓ | 1,96 ✗ | 1,66 ✗ |
| SERIES_DARK `#67e8f9` | 13,66 ✓ | **1,23** ✗ | **1,04** ✗ |
| SERIES_LIGHT `#b07d27` | 5,48 | 3,06 ✓ | **2,59** ✗ |
| SERIES_LIGHT `#339b41` | 5,57 | 3,01 ✓ | **2,55** ✗ |
| SERIES_LIGHT `#ec5444` | 5,58 | 3,00 ✓ | **2,54** ✗ |
| SERIES_LIGHT `#7042fa` | 3,63 | 4,61 ✓ | 3,91 ✓ |
| SERIES_LIGHT `#0494a7` | 5,47 | 3,06 ✓ | **2,59** ✗ |

Die Aufteilung ist richtig gebaut. Aber `SERIES_LIGHT` ist ausweislich des Kommentars „abgedunkelt bis 3 : 1 gegen Papier" — gegen **ein** Papier, die Seite `#e9ede9`. Der Atlas hat drei Papiergründe, und auf dem gesenkten fallen **4 von 5 Serienfarben unter 3:1** (2,54–2,59). Das ist derselbe Fehler, den `theme-presets.ts` für die vier Tinten bereits gefunden und behoben hat („Vier Inks, gegen einen Grund getunt, auf dreien benutzt" — dort auf `#d5dcd6` nachgezogen). Die Diagrammpalette hat diese Korrektur nicht mitbekommen.

Praktisch: die fünf Töne müssten um dieselben ~0,15 Helligkeitsstufen nach unten wie die Tinten, dann trägt der Boden überall.

---

## 3. Semantische Farben über beide Gründe — BELEGT

### 3.1 Es gibt keine Sättigung/Helligkeit, die auf beiden hält

Das ist die harte Antwort, und sie folgt direkt aus 1.2: zehn von zehn Kreuzungen bei Grafana fallen durch. Die Atlas-Semantik des Projekts, gemessen:

| Rolle | Hex | auf `#0a0a0a` | auf `#e9ede9` | auf `#d5dcd6` |
|---|---|---|---|---|
| primary (Zinnober) | `#ab3922` | **3,15** ✗ | 5,32 ✓ | 4,50 ✓ |
| accent (Ocker) | `#7b5a0e` | **3,12** ✗ | 5,36 ✓ | 4,54 ✓ |
| danger | `#b3261e` | **3,03** ✗ | 5,53 ✓ | 4,68 ✓ |
| success | `#1c6d45` | **3,13** ✗ | 5,34 ✓ | 4,53 ✓ |
| info | `#2f3f7a` | **1,99** ✗ | 8,40 ✓ | 7,12 ✓ |

Alle fünf Atlas-Semantiktöne fallen auf dem dunklen Grund durch — was korrekt ist, sie sind ja Papierfarben. Aber es beweist: **die Semantikrolle braucht pro Skin einen eigenen Wert, kein Ableitungsverfahren.**

### 3.2 Was auf beiden hält: die HUE-Trennung, nicht die Helligkeit

Der belegbare Kern liegt woanders. `theme-presets.ts` dokumentiert eine Entscheidung, die genau die richtige ist: der Design-Handoff hatte `color_accent` (= Warnung) gleich dem Zinnober gesetzt, wodurch Warnung `#b63c24` und Gefahr `#b3261e` **9 Grad Farbton** auseinandergelegen hätten. Ersetzt durch einen Drucker-Ocker `#7b5a0e` bei 42° — **29° vom Zinnober, 38° vom Gefahrenrot** — und bewusst auf *dieselbe Stärke* wie der Zinnober gelegt (5,36 gegen 5,32).

Das ist die übertragbare Regel und sie deckt sich mit dem, was ich im ersten Bericht für Rot/Grün gemessen habe: **die Rollen unterscheiden sich über den Farbton, die Lesbarkeit kommt über die Helligkeit — und das sind zwei unabhängige Achsen, die man getrennt einstellen muss.** Der dunkle Satz trennt Warnung/Gefahr über Amber-gegen-Rot; der helle muss dieselbe Winkeldistanz herstellen, aber mit anderen Absolutwerten.

Zur Erinnerung aus dem Hauptbericht: die Helligkeitsabstände *zwischen* Erfolg und Fehler liegen bei allen untersuchten Systemen bei 1,00–1,36:1. In Graustufen sind sie nicht trennbar. **Für „über Budget" heißt das in beiden Skins gleichermaßen: Vorzeichen und Glyphe tragen, Farbe verstärkt.**

---

## 4. Was NICHT über Tokens erbt — BELEGT, mit einem offenen Fund

Deine Erfahrung ist korrekt und ich kann sie im Projekt belegen. Die Liste, nach Fundlage sortiert:

**a) `color-scheme` — das ist bei euch offen.**
`frontend/src/styles/tokens/_colors.css:6` setzt `color-scheme: dark` auf `:root`. Es gibt **projektweit genau zwei Vorkommen**, beide `dark`, und `ThemeService` schreibt die Eigenschaft nirgends. Auf dem Atlas-Skin bleiben damit die nativen Scrollbars, Formularelemente, das Auswahlmenü eines `<select>` und die Fläche hinter der Seite **dunkel**, während das Papier hell ist. `color-scheme` ist die einzige Eigenschaft, die dieses Browser-Chrome erreicht — der Kommentar in `SimulationBroadsheet.ts:141` sagt das selbst („color-scheme is the only thing that reaches that chrome"). Das ist kein Farbfehler mit Kontrastzahl, sondern ein Bereich, den Tokens per Definition nicht erreichen.

**b) Bewegung.** Aus meinem Projektgedächtnis (`a-second-set-inherits-the-palette-not-the-motion.md`): das Atlas-Dashboard hatte **0 Keyframes gegen 8 im dunklen Satz** und genau eine Bewegung ohne Zeiger. Ein Skin erbt über Tokens die Farbe, nicht die Choreografie — Staffelung braucht dort `--i` UND `--j`.

**c) Schattentiefe.** Bereits gelöst, aber nur weil es aufgefallen ist: `_shadows.css` dokumentiert, dass `var()` **in** einer Custom Property dort auflöst, wo sie *deklariert* wird, nicht wo sie benutzt wird — die `--shadow-*`-Leiter wäre sonst mit Schwarz eingefroren in `:root` stehengeblieben. `ThemeService.computeShadows()` gibt sie deshalb auf jedem gethemten Wirt neu aus, inklusive `--shadow-inset`. Diese Klasse (`var()` friert am deklarierenden Knoten ein) hat im Projekt schon neun Tokens erwischt.

**d) Randstärke.** Der Atlas setzt `border_width: '1px'` mit dem Kommentar „'thick' is 1px: the atlas has no heavy rules" — gegen die Plattform-Leiter 1/2/3/4px in `_borders.css`. Eine Papieroberfläche verträgt die Strichstärke eines Phosphor-Skins nicht, und das ist keine Farbe.

**e) Glut/Leuchten.** `glow_strength: '0'` im Atlas („no CRT glow on paper"). Ein Multiplikator, kein Farbwert — ohne ihn hätte jeder Glow-Radius auf Papier weitergeleuchtet.

**f) Die Richtung der Höhenstaffelung.** Aus meinem Hauptbericht: auf Dunkel wird Erhebung durch *Aufhellen* dargestellt (Materials Overlay-Leiter, 0 %→16 %), auf Papier durch *Schatten*. Das ist keine Token-Umbelegung, sondern ein anderer Mechanismus. Der Kommentar in `atlas-sheet-styles.ts:58` beschreibt genau das („Linien leuchten, statt zu vertiefen") und hängt es an `--theme-polarity`.

**g) Was alpha-basiert gemischt ist.** Ein `color-mix(… X%, transparent)` über hellem Grund wirkt schwächer als über dunklem. Das Projekt hat das gemessen und beziffert: die Zustandstöne des Atlas mussten auf **1,16 bzw. 1,14** Abhebung gehoben werden, wo der dunkle Satz mit **1,05 bzw. 1,04** auskommt — „weil ein Ton auf hellem Grund weniger auffällt als auf dunklem".

**Das Muster hinter allen sieben:** Tokens vererben *Werte*. Was ein zweiter Skin nicht erbt, ist alles, was ein **Mechanismus** ist — Bewegung, Richtung der Tiefe, Strichstärke, Multiplikatoren, und das native Browser-Chrome. Faustregel: was du nicht als Farbe in eine Custom Property schreiben kannst, musst du ausdrücklich nochmal setzen.

---

## 5. ECharts konkret — BELEGT, inklusive einer überholten Annahme im Code

### 5.1 Nein, ECharts liest keine CSS-Custom-Properties

Bestätigt: ECharts rendert auf Canvas und interpretiert `var(--token)` nicht. Der saubere Weg ist der, den ihr **bereits gebaut habt** — und er ist richtig gebaut:

`EchartsChart.ts` liest das Chrome mit `getComputedStyle(el)` **vom Wirt-Element**, nicht von `:root`. Der Kommentar begründet das korrekt: ein Diagramm steht in der Hülle einer Welt, und die Welt setzt ihre Tokens auf ihrem eigenen Wirt. Gelesen werden `--color-text-primary`, `--color-text-muted`, `--color-border`, `--color-border-light`, `--color-surface-raised`, `--font-mono`, plus `--theme-polarity` als Weiche für die Serienpalette. Daraus wird ein Theme-Objekt mit `textStyle`, `title`, `legend`, `categoryAxis`, `valueAxis`, `radar`, `tooltip` — und `backgroundColor: 'transparent'`, damit die Seite durchscheint. Das ist die korrekte Bauweise, und `--theme-polarity` (in `ThemeService` aus der gemessenen Luminanz von Fläche gegen Text abgeleitet, `0` dunkel / `1` hell) ist ein sehr guter Griff, weil er auch für reine CSS-Fälle taugt (`calc(0.62 + var(--theme-polarity,0) * 0.46)` in `SimulationHeader.ts`).

Das Umschalten ist über `themeKey(el)` gelöst: ein Fingerabdruck aus fünf Tokenwerten, der die **Wirkung** vergleicht statt drei mögliche Ursachen (Skinwechsel, Weltwechsel, Dunkelkammer) zu beobachten. Auch das ist die richtige Abstraktion.

### 5.2 Der Fund: `dispose()` ist seit ECharts 6 nicht mehr nötig

Der Code begründet das Neuaufsetzen so: *„ECharts kann das Theme einer laufenden Instanz nicht wechseln; ein Wechsel heisst dispose und neu aufsetzen."*

**Das galt bis ECharts 5. Installiert ist 6.1.0.** Belegt an drei Stellen:

1. Release-Note ECharts 6.0.0: „**[Feature] [theme] Support dynamically registering and switching themes. #20705**"
2. `node_modules/echarts/types/dist/shared.d.ts:9090` — öffentlich auf `EChartsType`:
   ```ts
   /** Update theme with name or theme option and repaint the chart. */
   setTheme(theme: string | ThemeOption, opts?: SetThemeOpts): void;
   ```
3. `node_modules/echarts/lib/core/echarts.js:513` — real implementiert (`ECharts.prototype.setTheme`), mit Wächtern gegen Aufruf im Update-Zyklus und auf disponierten Instanzen.

Der Umbau ist klein: statt bei geändertem `themeKey` zu `dispose()` und `init()`, ruft man `this._chart.setTheme(chartTheme(this))`. Das erspart den Neuaufbau der Canvas, den Verlust des Zoom-/Brush-Zustands und einen Frame Flackern beim Skinwechsel. Die einzige Einschränkung aus dem Quellcode: nicht während des laufenden Hauptprozesses aufrufen — also aus `updated()` heraus, nicht aus einem `setOption`-Callback.

### 5.3 Was ich am bestehenden Bau ergänzen würde (Meinung)

- Die **Serienpalette** wandert derzeit über `light ? SERIES_LIGHT : SERIES_DARK`, also über eine Weiche im TypeScript. Grafanas Modell wäre, sie über **Namen** zu adressieren und die Auflösung ins Theme zu legen — dann bleibt die Serienidentität skin-unabhängig, und ein dritter Skin ist ein Tabelleneintrag statt eines dritten Zweigs.
- Die fünf `SERIES_LIGHT`-Töne gegen `#d5dcd6` nachziehen (siehe 2.4) — vier von fünf stehen dort unter 3:1.
- `--color-surface-raised` als Tooltip-Grund ist richtig; ergänzend wäre `--color-text-primary` statt `muted` für die Tooltip-Zahlen zu prüfen, weil ein Tooltip gelesen und nicht überflogen wird (auf Papier misst `--color-text-muted` `#55605b` 5,53:1, das trägt — auf dunkel steht es bei 3,03 gegen `#0a0a0a` und damit **unter AA für Fließtext**).

---

## Zusammenfassung in fünf Sätzen

1. **Aufgespalten wird nach Rolle, nicht nach Farbton:** Füllungen dürfen einen Wert haben (Grafana benutzt in beiden Skins dasselbe `#ff9900`), Texte brauchen zwei — alle zehn Kreuzproben zwischen Grafanas hellen und dunklen Texttönen fallen durch.
2. **Keine der drei Standard-Kategorialpaletten trägt beide Gründe** (auf Papier fallen 5–7 von 10 unter 3:1); Grafana löst es mit derselben Farbleiter, um genau eine Sprosse verschoben, und adressiert Serien über Namen statt Hexwerte.
3. **Semantikfarben brauchen pro Skin eigene Werte**; übertragbar ist nur die *Winkeldistanz* zwischen den Rollen (Atlas: Ocker 29° vom Zinnober, 38° vom Rot) — und Farbe bleibt in beiden Skins der dritte Träger nach Vorzeichen und Glyphe.
4. **Nicht vererbt wird alles Mechanische:** Bewegung, Richtung der Tiefe (Aufhellen gegen Schatten), Strichstärke, Glow-Multiplikator, die Stärke alpha-gemischter Töne — und `color-scheme`, das bei euch auf `:root` fest `dark` steht und im Atlas-Skin das native Browser-Chrome dunkel lässt.
5. **Für ECharts steht der richtige Bau schon da** (Tokens vom Wirt via `getComputedStyle`, Fingerabdruck statt Ursachenbeobachtung) — nur die Begründung fürs `dispose()` ist mit ECharts 6.1.0 überholt: `setTheme()` ist öffentliche API und im installierten Paket implementiert.

**Neue Quellen dieses Nachtrags:** [Grafana palette.ts](https://raw.githubusercontent.com/grafana/grafana/main/packages/grafana-data/src/themes/palette.ts) · [Grafana createColors.ts](https://raw.githubusercontent.com/grafana/grafana/main/packages/grafana-data/src/themes/createColors.ts) · [Grafana createVisualizationColors.ts](https://raw.githubusercontent.com/grafana/grafana/main/packages/grafana-data/src/themes/createVisualizationColors.ts) · [d3-scale-chromatic Tableau10/observable10/category10](https://github.com/d3/d3-scale-chromatic/tree/main/src/categorical) · [Vega palettes.js](https://raw.githubusercontent.com/vega/vega/main/packages/vega-scale/src/palettes.js) · [Observable Plot style.js / plot.js](https://github.com/observablehq/plot/tree/main/src) · [ECharts 6.0.0 Release Notes](https://github.com/apache/echarts/releases/tag/6.0.0) · [ECharts Style-Handbuch](https://echarts.apache.org/handbook/en/concepts/style/) — dazu die Projektdateien `frontend/src/styles/tokens/_colors.css`, `_shadows.css`, `_borders.css`, `frontend/src/services/theme-presets.ts`, `ThemeService.ts`, `frontend/src/components/shared/EchartsChart.ts`.