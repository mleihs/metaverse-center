---
title: "Neue Frontseite — Umsetzungsplan zum Design-Handoff (Variante 3a)"
version: "1.0"
date: "2026-08-31"
type: plan
status: ready-to-implement
lang: de
tags: [landing, frontend, seo, oeffentlich, design-handoff]
---

# Neue Frontseite (Variante 3a, „Editorial Brutalist")

> Grundlage: `handoff/landing-page/DESIGN-HANDOFF.md` und
> `handoff/landing-page/landing-redesign-reference.html` (Abschnitt `id="3a"`;
> die Varianten 1a/1b/2a/2b/3b darunter sind Erkundungen und außer Umfang).
> Quellpaket des Nutzers: `~/Dev/Buchhaltung/Metaverse.center (1).zip`.
> Die Bildstrecke liegt NICHT im Repo — Begründung unter L4.
>
> **Alles Folgende ist gemessen, am 31.08.2026 gegen Prod und gegen den
> Arbeitsbaum. Der Handoff selbst ist an keiner Stelle korrigiert worden; wo er
> von der Wirklichkeit abweicht, steht die Abweichung hier.**

## 0. Der Befund in einem Satz

Der Entwurf ist handwerklich vollständig und passt auffallend genau auf das
bestehende Token-System — aber er wirbt mit **Zahlen und Namen, die es nicht
gibt**, und mit **sechs Systemen, von denen zwei einem Besucher heute nicht
offenstehen**. Die Gestaltung ist nicht das Problem; die Behauptungen sind es.

## 1. Was ohne Weiteres passt (geprüft, nicht angenommen)

| Der Handoff verlangt | Bestand |
|---|---|
| `--color-accent-amber: #f59e0b`, Rand `#b45309` | `frontend/src/styles/tokens/_colors.css:70-72` — **identisch** |
| Grün `#4ade80` | `--color-accent-green`, `:74` — identisch |
| `--font-brutalist` = Courier, 700, versal | `_typography.css:5`, `--heading-font` `:51` — identisch |
| Spectral-Serife für Fließtext | `--font-bureau` `:8`, `--font-prose` `:48` — identisch |
| TCG-Karten „nach Plattform-Spezifikation" | `docs/explanations/tcg-card-system.md` + `components/shared/VelgGameCard.ts` vorhanden |
| Weltkarten mit Bild | **16 von 16** lebenden Welten haben `banner_url` |
| Drei Agentenkarten mit Porträt | **108 von 108** Agenten lebender Welten haben `portrait_image_url` |

Das ist ungewöhnlich gutes Material: es gibt keinen einzigen Farb- oder
Schriftwert im Entwurf, der nicht schon als Token existiert. Die Regel „keine
rohen Hex-Werte in Komponenten" kostet hier also nichts.

## 2. Wo der Entwurf etwas behauptet, das nicht stimmt

Alle Zahlen am 31.08.2026 auf Prod gemessen.

| Der Entwurf zeigt | Gemessen | Folge |
|---|---|---|
| `SIGNAL LOCKED // {n} WORLDS TRANSMITTING`, Attrappe **47** | **16** lebende Welten (`simulation_type='template' AND status='active'`), **alle 16 ticken** (`last_heartbeat_at` < 2 Tage) | Die 16 sind eine gute Zahl und sie ist wahr. Der Zähler muss aus der Plattform kommen, nie aus einer Konstante. |
| Laufband: `3 epochs in play` | **0** aktive Epochen (`game_epochs.status='active'`), 7 insgesamt, alle sieben stehen seit März | Die Zeile wäre gelogen. Siehe **L2**. |
| Laufband: `128 resonances absorbed` | **1** Resonanz (`substrate_resonances`), 14 Wirkungen | Dito. |
| Laufband + SEO-Fußzeile nennen **Saltmeridian** und **The Gilded Hollow** | Beide Welten **existieren nicht**. Von den vier genannten gibt es zwei: Velgarien ✓, The Chitinous Mandate ✓ | Die SEO-Fußzeile soll kriechbare `<a href>` tragen — zwei davon zeigten auf 404. Das ist der schlechteste Ort für einen toten Link. |
| Alle Texte auf Deutsch über `msg()` | Von 16 lebenden Welten haben **5** einen deutschen Titel und **7** einen deutschen Beschreibungstext | Das Weltraster wäre auf der deutschen Seite zur Hälfte englisch — sichtbar, nicht versteckt. Hängt an der offenen Entscheidung „11 von 16 Welten ohne deutschen Titel". |

**Das Muster:** dieselbe Fehlerklasse, die die ganze Systemprüfung durchzieht,
nur auf der Außenseite. Eine Anzeige, deren Erzeuger fehlt, sieht in jedem
Entwurf vollständig aus (siehe `a-door-that-only-opens-for-those-inside`) — hier
zeigt sie zusätzlich nach außen, auf die eine Seite, die ein Fremder als Erstes
sieht.

## 3. Die sechs Systeme — was ein Besucher davon erreicht

Die Frontseite bewirbt sechs Systeme gleichrangig. Gemessen an den
Plattform-Schaltern (`platform_settings`, 31.08.2026):

| # | System des Entwurfs | Zustand |
|---|---|---|
| 01 | Forge a World | **offen** |
| 02 | Compete in Seasons (Epochen) | **0 laufende Epochen.** Mechanik da, Bestand leer |
| 03 | Send Agents Below (Dungeons) | **offen** (Paket E abgeschlossen) |
| 04 | Travel the In-Between (DRIFT) | `drift_p0_enabled = true`, aber `drift_fun_core_enabled = **false**` — die Reise geht, der Spielkern nicht |
| 05 | Reality Bleeds In (Substrat/Resonanzen) | **nicht abgeschaltet, sondern ungefüttert.** Der Zeitgeber LÄUFT (kein Eintrag, aber `_DEFAULT_ENABLED = True`; die eine Resonanz steht auf `subsiding`, ist also verarbeitet worden). Leer ist es, weil `news_scanner_enabled = false` — es kommt nichts Neues herein. Bestand: 1 Resonanz, 14 Wirkungen |
| 06 | Play It as Text (Terminal) | **offen** |

Vier von sechs stehen also ganz oder halb still. Der Entwurf verspricht für 05
wörtlich „Real events echo through every simulation as resonances" — bei einer
einzigen je aufgenommenen Resonanz ist das kein Versprechen, sondern eine
Behauptung über einen Zustand, der noch nicht eingetreten ist.

> **Korrektur vom 31.08. nachmittags** (gemessen von `velgarien-rebuild-45`,
> hier bestätigt): 05 ist **nicht abgeschaltet**. Ich hatte aus dem fehlenden
> Eintrag auf ein geschlossenes Tor geschlossen; tatsächlich steht
> `_DEFAULT_ENABLED = True` und die Schleife überschreibt die Vorgabe nur, wenn
> eine Zeile ankommt. Der Zeitgeber läuft, und die eine Resonanz auf Prod steht
> auf `subsiding` — sie ist verarbeitet worden. Leer ist das System, weil
> `news_scanner_enabled = false`: es wird nichts hineingefüttert.
>
> Für Entscheidung 1 ist das ein Unterschied: 05 braucht keine Freigabe,
> sondern Futter. **Und die Lehre dahinter gilt für den ganzen Plan: ein
> fail-closed PARSER ist keine fail-closed ABWESENHEIT.** Was mit einem
> ankommenden Wert geschieht, sagt nichts darüber, was ohne Zeile geschieht —
> das entscheidet die Vorgabe des Aufrufers, und die muss man lesen.

**Nebenbefund, der das erklärt und die Reihenfolge bestimmt** (gemessen von
`velgarien-rebuild-45`): für `platform_settings`-Schalter gibt es **keine
Admin-Oberfläche**. `AdminPlatformConfigTab` hat fünf Abschnitte (API-Schlüssel,
Modelle, Forschung, Caching, Ankündigungen) und keinen für Schalter. Deshalb ist
`journal_enabled` bis heute ungesetzt, und deshalb ließe sich 04 und 05 auch
nicht kurz vor dem Start „mal eben anschalten". Der fehlende Abschnitt ist
Voraussetzung, nicht Nebensache.

## 4. Aufgaben

### L1 · Öffentlicher Kennzahlen-Endpunkt (Backend, entscheidungsfrei)

Die Frontseite braucht in einem Zug: Zahl lebender Welten, Zahl laufender
Epochen, Zahl aufgenommener Resonanzen, vier Welten fürs Raster (Name, Koordinate,
Agentenzahl, Kurztext, Bild), drei Agenten für die Dossierkarten.

- `GET /api/v1/public/landing` in `backend/routers/public.py`,
  `SuccessResponse[LandingSnapshotResponse]`, Modell in
  `backend/models/public.py`. Ein Aufruf, kein Wasserfall.
- Zählpfade filtern auf `simulation_type='template' AND status='active'` — die
  20 Epochen-Klone und 5 archivierten Welten gehören **nicht** in die Zahl
  (N3: die Sicht `active_agents` filtert genau das nicht, hier nicht denselben
  Fehler machen).
- Die vier Welten des Rasters werden **nicht fest verdrahtet**. Auswahl aus den
  lebenden Welten nach einer nachvollziehbaren Regel (jüngster Herzschlag,
  Agentenzahl), damit die Seite nie eine gelöschte Welt zeigt.
- Locale-abhängig `name_de`/`description_de` mit Rückfall auf Englisch —
  derselbe Helfer, den G2 für den Puls benutzt, **nicht neu bauen**.

### L2 · Zahlen, die stimmen dürfen — oder Zeilen, die verschwinden

Die Laufband-Zeile muss aus L1 kommen. Zusätzlich eine Regel für die Fälle, in
denen die Zahl 0 ist: **eine Kennzahl mit dem Wert 0 wird ausgelassen, nicht
gedruckt.** „0 epochs in play" ist schlechter als gar nichts, und es ist die
heutige Wirklichkeit. Dieselbe Regel wie beim Wochenbericht (P2.19: unter drei
Ereignissen wird nicht versendet).

### L3 · Zwei erfundene Welten

Saltmeridian und The Gilded Hollow aus Laufband und SEO-Fußzeile nehmen und
durch echte ersetzen — die Fußzeilenspalte WORLDS aus L1 speisen, nicht aus
einer Liste im Quelltext. Damit kann sie nicht wieder veralten.

### L4 · Die Bildstrecke (gemessen, und so nicht auslieferbar)

| Datei | Größe | Maße | gezeigt bei |
|---|---|---|---|
| `hero-bureau.jpeg` | 2,8 MB | 2752 × 1536 | volle Breite |
| `system-01…06` | 2,7–3,4 MB | 2752–2816 × 1536 | **640 × 360** |

Zusammen **20,7 MB** in `assets/`, plus weitere **21 MB** derselben Bilder in
`uploads/` (Vorstufen). Die sechs Systembilder werden mit 4,4-facher Breite
ausgeliefert; die Miniaturleiste zeigt sie zusätzlich bei ~100 px Breite.

Eine Frontseite, die 21 MB Bilder lädt, ist keine Frontseite. Nötig ist eine
Ableitungsstufe:
- Hero ≤ 1920 breit, Panele ≤ 1280, Miniaturen ≤ 320, je AVIF + WebP mit
  JPEG-Rückfall, `srcset`/`sizes`.
- Ablage in Supabase Storage wie die übrigen Schaubilder, **nicht im Repo** —
  `.gitignore` schließt `*.jpeg` ohnehin aus (Zeile 69), und 21 MB Binärdaten
  in der Historie sind unumkehrbar.
- Ziel: erste Bildlast unter 400 KB. Vorher/nachher messen, nicht schätzen.

### L5 · Die Seite selbst (Frontend)

`frontend/src/components/landing/LandingPage.ts` besteht und hat **2 302
Zeilen**. Der Entwurf ersetzt sie vollständig. Vor jeder Zeile
Komponentencode: **`velg-frontend-design`-Skill laden** (CLAUDE.md).

Abschnitte in der Reihenfolge des Handoffs: Navigation, Held mit Ken-Burns und
Laufband, die sechs Systeme mit Vorschautafel, Weltraster, Dossierkarten,
Abschluss mit Tippfeld, SEO-Fußzeile. Die Zustände sind klein und gehören in die
Komponente, nicht in `AppStateManager`: `activeSystem 0–5`, `typedText`,
`promptIndex`, `phase`, `activeAnchor 0–5`.

Vier Gebote aus dem Bestand, die der Entwurf nicht kennt:
1. **Keine rohen Hex-Werte.** Jeder Wert des Handoffs hat ein Token (§1); die
   drei Grautöne `#0f0f0f`/`#060606`/`#161616` über `color-mix()` als
   `--_*`-Variablen im `:host` ableiten, nicht neu erfinden.
2. **Kein `filter`/`transform` auf Layout-Behältern.** Der Held will
   `brightness(.72)` und einen Ken-Burns-`scale()` — beides gehört auf das
   Bild-Element bzw. ein `::after`, nie auf den Abschnitt: sonst bricht jedes
   `position: fixed`-Modal der Seite.
3. **`msg()` für jede Zeichenkette**, keine Geviertstriche (U+2014) — der
   Handoff-Text benutzt sie durchgehend, beim Übertragen werden es Halbgevierte
   (U+2013). `lint-llm-content.sh` weist sie sonst ab.
4. **Jeder `catch` beobachtet** über `captureError(err, { source: 'LandingPage.…' })`.

### L6 · Bewegung und Bedienbarkeit

Ken-Burns 34 s, Laufband 30 s, Tippfeld 34 ms je Zeichen, blinkender Cursor —
vier Dauerläufer auf einer Seite. `prefers-reduced-motion: reduce` muss alle
vier anhalten (Laufband statisch, Tippfeld zeigt den vollen Text, kein Zoom,
kein Blinken). Das steht nicht im Handoff und ist WCAG-AA-relevant, nicht
Geschmack.

Der Umschalter der sechs Systeme reagiert im Entwurf **nur auf `hover`**. Ohne
Tastaturpfad ist ein Sechstel des Seiteninhalts mit der Tastatur nicht
erreichbar: die Zeilen brauchen `role="tab"`/`aria-selected`, Fokus sichtbar,
Pfeiltasten.

### L7 · Was der Handoff offenlässt

- **Kein responsives Layout.** Referenz ist 1440 px fest. Held-H1 158 px →
  `clamp()`, das Raster `1fr 640px` stapelt. Muss entworfen werden, nicht
  abgeleitet-und-gehofft.
- **Alle Navigations- und Fußzeilenziele brauchen echte Routen.** `/data-deletion`
  ist seit G4 verlinkt und existiert; Privacy und Terms bestehen; „Field manual"
  und „About the Bureau" sind neu.

## 5. Was entschieden werden muss

1. **Wirbt die Seite mit sechs Systemen, von denen vier stillstehen?** Drei
   Wege: (a) alle sechs zeigen und die zwei stillen ehrlich als „in
   Vorbereitung" kennzeichnen, (b) nur die vier offenen zeigen, (c) erst 04/05
   einschalten (braucht den fehlenden Schalter-Abschnitt im Admin, §3) und dann
   alle sechs. **Empfehlung: (a)** — der Entwurf lebt von der Sechserreihe, und
   eine gekennzeichnete Baustelle ist glaubwürdiger als eine verschwiegene.
2. **Die Laufband-Kennzahlen:** 0 auslassen (L2) oder andere Kennzahlen wählen,
   die heute schon groß sind (108 Agenten, 20 053 Chronikzeilen, 64 Objektanker)?
3. **Deutscher Titel für 11 von 16 Welten** — dieselbe offene Entscheidung wie
   bisher, aber die Frontseite macht sie sichtbar: ohne sie ist das Weltraster
   auf Deutsch halb englisch.
4. ~~**Wer baut?**~~ — **entschieden am 31.08.2026:** die Sitzung
   `velgarien-rebuild-45` übernimmt die Welle, **nachdem** sie H7/H1/H6
   abgeschlossen hat. Der Umfang ist eine eigene Welle (L1 Backend ≈ ½ Tag, L4
   Bildableitung ≈ ½ Tag, L5/L6/L7 Frontend ≈ 2–3 Tage) und darf keine dritte
   gleichzeitige Baustelle im geteilten Arbeitsbaum werden. `velgarien-rebuild-88`
   fasst ab hier nichts davon an.

## 6. Reihenfolge

L1 (Backend, entscheidungsfrei) → L4 (Bilder, entscheidungsfrei) → Entscheidung
1–3 → L5 → L6 → L7. L2 und L3 fallen aus L1 heraus, sobald der Endpunkt steht.
