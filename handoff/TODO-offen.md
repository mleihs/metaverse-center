---
title: "Offene Punkte, die beim Vorbeigehen aufgefallen sind"
date: "2026-08-31"
type: todo
lang: de
---

# Offene Punkte

Kurzliste für Dinge, die während anderer Arbeit auffallen und nicht dort
hingehören, wo sie auffielen. Jeder Punkt nennt, was gemessen wurde, und was
NICHT gemessen wurde — damit der nächste nicht bei null anfängt.

---

## T1 · Die Reiterleiste schneidet ihre eigenen Beschriftungen ab

**Gemeldet:** 31.08.2026, vom Nutzer, mit Bildschirmfoto.
**Wo:** Simulations-Navigation, zweite Zeile (`LORE · AGENTEN · GEBÄUDE · …`).

Elf von vierzehn Reitern zeigen ein abgeschnittenes Wort:

    GEBÄUD‹e›     GESUNDHE‹it›   EREIGNISS‹e›   BINDUNGE‹n›
    SOZIALE‹s›    TERMINA‹l›     DUNGEO‹ns›     EINSTELLUNG‹en›

Kein Auslassungszeichen, keine zweite Zeile, kein Umbruch — der Text endet
einfach. Das ist die deutsche Ausgabe; die englischen Wörter sind kürzer und
passen, weshalb es im Entwurf nicht auffiel.

**Nicht gemessen** (und das ist der erste Schritt, nicht das Ändern von CSS —
siehe `feedback-measure-before-fix`): ob die Reiter eine feste Breite haben,
ob ein `overflow: hidden` ohne `text-overflow` greift, oder ob die Leiste
`flex` mit `min-width: 0` auf den Kindern ist und diese unter ihre Inhaltsbreite
gedrückt werden. Die drei Ursachen brauchen drei verschiedene Reparaturen.

**Zu bedenken:** vierzehn Reiter in einer Zeile sind unabhängig von der
Abschneidung viel. Eine waagrechte Rollleiste, eine zweite Zeile oder ein
Überlaufmenü sind Gestaltungsentscheidungen, keine CSS-Korrekturen — vor dem
Bauen `velg-frontend-design` und den Nutzer fragen.

---

## T2 · Zwei Konten besitzen die Welten

**Gemessen:** 31.08.2026 auf Prod.

Fünfzehn der sechzehn Ursprungswelten gehören `matthias@leihs.at`. **The
Chitinous Mandate** (aktiv, 8 Agenten, 7 Bauten, angelegt 17.03.2026) gehört
`matthias.leihs@gmail.com` und erscheint deshalb nicht in „Meine Welten", wenn
man mit dem anderen Konto angemeldet ist.

Kein Fehler — aber eine Welt, die man nur sieht, wenn man weiss, dass es sie
gibt. Zu entscheiden: das zweite Konto als Mitglied eintragen, die Welt
umhängen, oder es so lassen und nur wissen.

---

## T3 · `pristine` steht neben der Leiter

**Gemessen:** 31.08.2026 auf Prod, beim Nachmessen von Migration 308.

Sechs Bauten in fünf Welten tragen den Zustand `pristine` (deutsch gemessen:
`makellos`, 5 von 6). Der Wert steht in keiner der 25 Bauzustands-Taxonomien
und auf keiner Sprosse der Kernleiter — `fn_degrade_building` meldet für sie
seit Migration 303 `condition_off_ladder`. Diese sechs Bauten verfallen also
nicht: Sabotage und Krisenereignisse laufen an ihnen vorbei.

`pristine` als Sprosse 0 über `excellent` zu hängen wäre naheliegend und ist
eine INHALTLICHE Entscheidung über das Vokabular dieser Welten — keine, die
eine Migration erraten darf. Dasselbe gilt für `restored` und `illuminated` in
Cité des Dames (vier Bauten).

---

## T4 · Die Beschriftung eines Bauzustands steht zweimal da

**Gemessen:** 31.08.2026, Migration 309.

`buildings.building_condition_de` ist eine Zweitschrift der Beschriftung, die in
`simulation_taxonomies` steht. Migration 309 gibt ihr eine Quelle
(`fn_building_condition_de`) und einen Wächter (`trg_building_condition_label`),
aber sie räumt die Zweitschrift nicht ab.

Richtig wäre, dass die Oberfläche die Beschriftung aus der Taxonomie liest und
die Spalte verschwindet. Betroffen sind vier Stellen:

    frontend/src/components/buildings/BuildingCard.ts        t(b, 'building_condition')
    frontend/src/components/buildings/BuildingDetailsPanel.ts
    frontend/src/components/buildings/BuildingsView.ts       Spaltenschlüssel
    frontend/src/utils/terminal-formatters.ts

Dazu bräuchte das Frontend die Taxonomie der laufenden Welt im Zustand — die
gibt es schon (`BuildingEditModal` holt sie über `getTaxonomiesByType`), aber
nicht als geteilte Quelle.

Solange die Spalte bleibt, ist sie ein Zwischenspeicher mit Quelle und Wächter
statt einer Zweitschrift ohne beides. Das ist tragfähig, aber nicht das Ziel.

---

## T5 · `/platform-stats` sollte verschwinden

**Gemessen:** 31.08.2026.

`SimulationService.get_platform_stats` und der Endpunkt `/platform-stats`
messen dieselben drei Grössen wie `LandingService` — schlechter und ohne
Aufrufer:

    frontend/src/services/api/SimulationsApiService.ts  getPlatformStats()  0 Verwender
    LandingService._resonance_count                     Zeile für Zeile identisch
    LandingService._world_count                         filtert `status` mit, dieser tat es nicht
    active_epoch_count                                  zählt 7 Epochen, von denen
                                                        sich keine seit 164–185
                                                        Tagen bewegt hat

Der `status`-Filter ist repariert (Punkt 2 der Systemprüfung), der Epochenzähler
ausdrücklich NICHT — die Unterscheidung „Status ist kein Betrieb" ein zweites
Mal hinzuschreiben wäre genau die Doppelung, die den Zähler löschenswert macht.

**Zu löschen sind vier Stellen**, und drei davon gehören zur Frontseite und
damit zur Sitzung, die sie hält:

    backend/services/simulation_service.py      get_platform_stats
    backend/routers/public.py                   @router.get("/platform-stats")   ← Frontseite
    backend/models/…                            PlatformStatsResponse            ← Frontseite
    frontend/src/services/api/SimulationsApiService.ts  getPlatformStats         ← Frontseite

Deshalb nicht einseitig getan: ein öffentlicher Endpunkt wird nicht aus einer
fremden, gerade laufenden Datei entfernt.

---

## T6 · Dashboard-Redesign (Claude-Design-Paket, „Command Stage" 4a)

**Übergeben:** 31.08.2026 vom Nutzer. **Paket liegt in `handoff/dashboard-redesign/`**
(6,6 MB, 18 Dateien). **Zuständig: `velgarien-rebuild-45`**, nach ihren
laufenden vier Punkten.

    Dashboard Redesign.dc.html   Referenzprototyp, 1 623 Zeilen, Stile inline
    README.md                    Spezifikation, sehr genau (Pixel, Kurven, Zeiten)
    uploads/…Gemini….jpeg        Bühnenbild „war room" — FINAL, kein Platzhalter
    assets/e-*.png, b-*.png      PLATZHALTER-Weltkunst (Zuschnitte, Themen passen
                                 teils nicht — die Insektenwelt zeigt Ozean)
    assets/portrait-0/1/2.png    PLATZHALTER-Porträts
    _ds/, support.js            Laufzeit + Merkmale, damit die Datei im Browser aufgeht

**Im Umfang:** Abschnitt `id="4a"` (Hauptbildschirm) und `id="3a"`
(Weltenregister). `id="5a"` ist die 2560-px-Probe von 4a, kein eigener
Bildschirm. 1a/2a/2b sind frühere Erkundungen und ausdrücklich außerhalb.

**Ersetzt:** `frontend/src/components/platform/SimulationsDashboard.ts`
(2 312 Zeilen), Route `/dashboard` in `app-shell.ts:170`.

### Was ich gegen den Code gemessen habe — und was fehlt

`GET /users/me/dashboard` liefert heute **vier Felder**:

    memberships · active_epoch_participations · academy_epochs_played
    active_resonance_count

Der Entwurf braucht deutlich mehr. Gemessen, was es gibt und was nicht:

| Der Entwurf verlangt | Gibt es? |
|---|---|
| Countdown bis Zyklus-Auflösung | ⚠ nicht im DTO; Epochenzyklen kennen die Frist, die Aufbereitung fehlt |
| „Requires You"-Warteschlange, `Orders placed 1/3` | ⚠ nicht aggregiert; die Einzelteile liegen bei den Epochen |
| Substrat `anomalous | stable` | ⚠ kein solcher Zustand; `resonanceApi.list` liefert Zeilen, keinen Status |
| Auszeichnungen `12/48` + letzte Freischaltung | ✅ `achievement_definitions` existiert (Migr. 190–195) |
| Dossier-Karussell, TCG-Karten | ✅ Spec vorhanden: `docs/explanations/tcg-card-system.md` |
| Resonanz-Zeilen mit Alter + Balken | ✅ `resonanceApi.list` |
| 44 Welten mit Kunst, `NN AG · NN BLDG` | ✅ `simulationsApi.listPublic` + `simulation_dashboard` |
| Lore + Zitat je Welt | ⚠ im Prototyp fest im `MY`-Array; Herkunft im Backend offen |
| Weltkunst je Welt | ⚠ Platzhalter im Paket; echte Bilder liegen im Backend |

🔑 **Das ist der eigentliche Aufwand, nicht das CSS.** Sechs der neun Zeilen
sind Daten, die es so noch nicht gibt. Ein Dashboard, das drei erfundene Zahlen
zeigt, wäre genau der Fehler, den `LandingService` gerade behoben hat
(`47 worlds`/`3 epochs`/`128 resonances` → gemessen 16/0/1). **Zuerst messen,
was die Zahlen wirklich sind, dann entscheiden, ob der Abschnitt gebaut wird.**

### Zwei Punkte, die vor dem ersten Handgriff zu klären sind

1. **`--container-max`** (`_layout.css:10`, heute `1600px`). Das Dashboard-Paket
   verlangt einen **zentrierten Behälter mit `max-width: 1920px`** und
   randlosen Rändern (Befehlsleiste, Bühnenbild, Fußlaufband). Die fünf
   Arbeitsflächen, die heute an `--container-max` hängen (`SimulationShell`,
   `EpochOpsBoard`, `EpochCommandCenter`, `EpochResultsView`), gingen dabei
   stillschweigend mit. Also entweder ein eigenes Maß fürs Dashboard (so wie
   `velgarien-rebuild-45` es der Frontseite gegeben hat) oder eine bewusste
   Anhebung mit Blick auf alle fünf.
2. **Haltepunkte:** Das Paket nennt `≥1920` und `≥2560`, Typo ×1,15 ab 2560,
   Behälter bleibt bei 1920 auch ab 3840. **Das sind dieselben Haltepunkte wie
   im Frontseiten-Paket** — es gibt also keinen Grund für zwei Rasterlogiken.

### Was der Entwurf ausdrücklich NICHT hat

Mobil und Tablet sind **nicht entworfen** (der README nennt es einen offenen
Punkt und schlägt nur eine Stapelreihenfolge vor). Bevor gebaut wird, gehört
entschieden, ob das Dashboard eine Schmalansicht bekommt oder ob `/dashboard`
unter einer Breite auf etwas anderes verweist.

### Was gut passt

Der Entwurf hält sich an die bestehenden Regeln: keine farbigen Kantenbalken
(das Lint-Tor `lint-no-accent-edge-bar.sh` würde sie ohnehin abweisen), Radius 0
außer TCG-Karten, nur versetzte Schatten, Courier-Versalien für Überschriften,
Spectral für Erzähltext, `msg()` für jede Zeichenkette, keine Geviertstriche.
Das ist dieselbe Sprache wie die neue Frontseite.

### T6a · Verträgt sich das Paket mit dem Tokensystem? — gemessen

**Frage des Nutzers am 31.08.2026: wird unser Design-System unterlaufen?**
Gemessen, nicht beurteilt. **Nein — das Paket ist darauf GEBAUT.**

Die Tokendateien, die das Paket mitbringt (`_ds/…/src/styles/tokens/`), sind
eine **Teilmenge unserer eigenen**:

    Tokens bei uns                              203
    Tokens im Paket                             104
      gemeinsam                                 104
      nur im Paket                                0
      gleicher Name, ANDERER Wert                 0

Claude Design hat unsere echten Tokendateien gelesen. Der README sagt es auch
ausdrücklich: „Colors only via tokens from `src/styles/tokens/`; hex values in
this README identify tokens, never hardcode them."

**Von den 23 Farbangaben im README decken 14 unmittelbar ein Tier-1-Token:**

    #060606 --color-surface-sunken     #e5e5e5 --color-text-primary
    #0a0a0a --color-surface            #a0a0a0 --color-text-secondary
    #222    --color-border-light       #888    --color-text-muted
    #333    --color-border             #ef4444 --color-danger
    #f59e0b --color-primary            #4ade80 --color-accent-green
    #b45309 --color-accent-amber-dim   #3b82f6 --color-info
    #fbbf24 --color-accent-amber-hover #a78bfa --color-epoch-influence

Die übrigen neun brauchen kein neues Token, sondern eine bestehende Antwort:

| README | Antwort im System |
|---|---|
| `4px 4px 0 #000` | `--shadow-md` — zeichengleich |
| `6px 6px 0 #000` | `--shadow-lg` — zeichengleich |
| `rgba(239,68,68,.07)` | `--color-danger-bg` (Tier 2, `color-mix` 8 %) |
| `#0d0d0d` (Hover) | Tier 3 per `color-mix`; es gibt `--color-surface-raised: #111111` |
| `#1a1a1a` | Tier 3, zwischen `--color-surface-raised` und `--color-border-light` |
| `#555`, `#666` | Tier 3 unter `--color-text-muted` (#888); Vorbild: `--color-text-tertiary` ist bereits ein `color-mix` |
| `#64748b` `#10b981` `#dc2626` | **existieren bereits** in `frontend/src/utils/operative-constants.ts` und in `docs/explanations/tcg-card-system.md` |

**Der einzige echte Riss, und er ist ÄLTER als das Paket:** die
Operativ-Farben stehen als rohe Hex-Werte in einer TypeScript-Konstantendatei
statt in `_colors.css`. Das Paket benutzt sie korrekt, aber es macht sichtbar,
dass eine Farbfamilie des Werks am Tokensystem vorbei lebt.
→ Eigener Punkt, unabhängig vom Dashboard.

#### Wo es NICHT aufgeht: Größen

Die Abstände des Entwurfs treffen unsere Skala fast durchweg:

    40px --space-10   48px --space-12   56px --space-14
    24px --space-6    28px --space-7    14px --space-3-5

Zwei Ausnahmen: **44 px** (Befehlsleiste) liegt zwischen `--space-10` und
`--space-12`, und die Segmentleiste (`22×8px`) hat gar keine Entsprechung.

Und die Schriftgrößen sind der eigentliche Punkt:

    unsere Skala endet bei --text-3xl = 39 px
    der Entwurf verlangt   60 px (Countdown), 69 px ab 2560

🔑 **Für die kinematische Bühne gibt es keine Stufe.** Das ist keine
Nachlässigkeit des Entwurfs, sondern eine echte Lücke: unsere Skala ist für
Arbeitsflächen gebaut, nicht für eine Bühne. Zu entscheiden ist, ob sie eine
Anzeigestufe bekommt (`--text-4xl` / `--text-display`) oder ob der Countdown
seine Größe als Tier-3-`--_countdown-size` selbst trägt.

⚠ Und dazu die Zahl, die dabei herauskam: **986 fest verdrahtete
`font-size: NNpx` stehen bereits in Komponenten.** `lint-color-tokens.sh` prüft
nur Farben; für Größen gibt es **kein Tor**. Eine Anzeigestufe einzuführen und
kein Tor dafür zu bauen hiesse, die 987. Ausnahme zu schaffen.
