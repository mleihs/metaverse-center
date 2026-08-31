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

## T1 · Die Reiterleiste schneidet ihre eigenen Beschriftungen ab — ✅ ERLEDIGT, aber ÜBERHOLT

> **Nachtrag 31.08.2026:** Die Simulationsansicht wird gerade von Claude Design
> neu entworfen; ein Paket ist angekündigt. Die Ursache war zu dem Zeitpunkt
> schon gemessen und mit einer Zeile behoben (`flex-shrink: 0`), also steht die
> Korrektur — aber **an dieser Leiste wird nicht weitergearbeitet**, bis das
> Paket da ist. Der gemessene Befund unten bleibt stehen, weil der neue Entwurf
> denselben Fehler machen kann: vierzehn Reiter in einer Zeile bleiben vierzehn
> Reiter in einer Zeile.
>
> **Die Ursache, für das nächste Mal:** ein Flex-Kind hat `min-width: auto` und
> ist damit vor dem Schrumpfen unter seine Inhaltsbreite geschützt — **aber nur,
> solange `overflow` auf `visible` steht.** `.nav__tab` trug `overflow: hidden`
> (für den `::before`-Verlauf), die Mindestbreite fiel damit auf null, die
> Reiter schrumpften, und das `overflow-x: auto` der Leiste kam nie zum Einsatz.
> Dass Rollen die Absicht war, stand zwei Regeln weiter oben: die Leiste
> versteckt eigens ihren Rollbalken.



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

## T3 · `pristine` steht neben der Leiter — ⚠ ÜBERHOLT, die Prämisse stimmt nicht mehr

> **Nachgemessen auf Prod, 31.08.2026 (Sitzung `-88`), gegen `fn_building_condition_ladder`
> statt gegen eine Kernleiter.** Die Leiter ist **pro Welt**, nicht global — und `pristine`
> steht bei den fünf Welten, die es benutzen, **auf** ihrer Leiter:
>
>     pristine|good|fair|poor|ruined     4 Welten,  29 Bauten
>     pristine|fair|poor|ruined          1 Welt,     7 Bauten
>
> Die sechs `pristine`-Bauten verfallen also. Der Befund unten war vor Migration 308–311
> richtig und ist es seither nicht mehr; er bleibt als Messweg stehen, weil die Frage
> „welche Bauten verfallen nicht?" gültig bleibt — nur ist die Antwort eine andere.
>
> **Der ECHTE Rest sind 17 Bauten in 7 lebenden Welten** (5,9 % von 290), alle in Welten
> mit der Standardleiter `excellent → good → fair → poor → ruined`, mit zwölf Wörtern
> daneben: `anomalous` 4, `illuminated` 2, `restored` 2, `thriving` 2, dazu je einmal
> `compromised`, `functional`, `obsolete`, `operational`, `preserved`, `restricted`,
> `sealed`. Diese verfallen nicht — Sabotage und Krisenereignisse laufen an ihnen vorbei.
> Weitere 34 Bauten hängen an GELÖSCHTEN Welten und haben gar keine Leiter; das ist
> stimmig, kein Fehler (siehe T8).
>
> **Und ein zweiter Befund, der nicht hierher gehörte und trotzdem hier auffiel:** das
> Frontend-Vokabular (`utils/building-condition.ts`) kennt `pristine | good | fair | poor
> | ruined` — es passt damit auf **5 von 36** Welten. **26 Welten haben `excellent` als
> oberste Sprosse**, und die 10 Bauten, die es tragen, zeigen deshalb einen leeren
> Edelstein, obwohl sie auf der höchsten Sprosse ihrer Welt stehen. Das ist keine
> Inhaltsentscheidung, sondern ein fehlendes Wort in einer Liste. Gebiet
> `velgarien-rebuild-af` (gemeldet).

### Der ursprüngliche Befund (Stand vor der Messung)


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

## T11 · `building_condition` trägt zwei Achsen, und der Generator schreibt in beide

**Gemessen:** 31.08.2026 auf Prod, beim Einhängen der Sprossen (Migration 320).

Von den 13 Zustandswörtern, die 18 Welten führen, sagen vier nicht, wie
abgenutzt ein Ort ist, sondern **was er ist oder wer hinein darf**:

    anomalous    4 Bauten   „ein Raum, der auf keinem Grundriss erscheint"
    sealed       1          „ein versiegelter Betonkubus"
    restricted   1          „die tiefste zugängliche Ebene"
    compromised  1          „ein versiegeltes Labor" nach einem Vorfall

`fn_degrade_building` ÜBERSCHREIBT `building_condition`. Diese vier stehen seit
Migration 320 auf der Leiter — auf ausdrückliche Entscheidung des Nutzers, damit
alle Bauten denselben Regeln folgen. **Der Preis ist benannt und angenommen:**
der Statische Raum hört beim ersten Verfallstick auf, versiegelt zu heissen.

**Die Ursache liegt eine Schicht früher.** Der Bau-Generator entscheidet frei,
welches der 13 Wörter er schreibt, und unterscheidet die zwei Achsen nicht. Bis
er das tut, entstehen neue Bauten, deren „Zustand" eine Aussage über ihr Wesen
ist — und die Verfallsmechanik löscht sie.

### Nachtrag 31.08. — die Leitung ist repariert, die Frage darunter nicht

Beim Nachgehen kamen drei Dinge heraus, zwei davon behoben:

**① Der Widerspruch im Prompt — behoben.** Zwei Stellen nannten dem Modell die
erlaubten Zustände, in DERSELBEN Anfrage, und sie waren nicht gleich: das Schema
sagte `excellent`, die Anforderungszeile des Orchestrators sagte `pristine`.
Daher die sechs `pristine`-Bauten. Beide bauen ihren Satz jetzt aus
`BUILDING_CONDITION_CORE`; `backend/tests/unit/test_building_condition_vocabulary.py`
weist eine zweite handgeschriebene Liste ab.

**② Ableitung erzeugt eine MENGE, der Verfall braucht eine FOLGE — Leitung
behoben (Migration 322).** `forge_taxonomies.py` leitet die Taxonomie einer Welt
aus dem ab, was das Modell erfunden hat („konsistent von Konstruktion her"). Das
garantiert `building_condition ∈ Taxonomie`, aber nicht `∈ Leiter` — die Leiter
braucht eine Ordnung, und eine Ableitung kann keine erzeugen. Deshalb hätte JEDE
künftig geschmiedete Welt ihre thematischen Wörter wieder ohne Sprosse bekommen.
Die Sprossenkarte `fn_building_condition_rungs()` löst das an einer Stelle für
alle Welten, statt 193-mal in `metadata`.

**③ ⚠ OFFEN: ein NEUES Wort hat weiter keine Sprosse.** Erfindet das Modell
`waterlogged`, kennt die Sprossenkarte es nicht, und der Bau verfällt wieder
nicht. Die Ableitung kann das prinzipiell nicht lösen. Der nachhaltige Weg wäre,
**dasselbe Modell, das das Wort erfindet, auch nach seinem Platz zu fragen** —
ein Feld mehr im Entwurf (`condition_rung`, 5–50, „wo zwischen makellos und Ruine
sitzt dieses Wort"), das die Materialisierung nach `metadata.rung` schreibt. Kein
zweiter Aufruf, keine neue Fehlerquelle, und es passt zur Grundhaltung von
Befund 30: das Modell weiss, was es gemeint hat. **Zu entscheiden**, weil es
Schema, Prompt, `forge_taxonomies` und `fn_materialize_shard` berührt.

**Zwei Wege, beide inhaltlich:**
* Eine zweite Achse (Spalte oder eigener `taxonomy_type`) für Zugang/Wesen; die
  vier Wörter wandern dorthin, `building_condition` behält nur Verschleiss.
* Oder der Generator wird auf die Verschleiss-Wörter festgelegt und die vier
  bleiben, was sie heute sind: Sprossen, die überschrieben werden dürfen.

**Nicht gemessen:** wo genau der Generator das Wort wählt (Prompt, Schema in
`backend/models/forge.py`, oder Freitext des Modells) — das ist der erste
Schritt, nicht das Ändern einer Taxonomie.

**Nebenbefund, schon behoben:** zwei Wörter (`critical`, `makeshift`) stehen in
18 Welten bereit und werden von KEINEM Bau getragen. Sie haben trotzdem eine
Sprosse bekommen — wer nur die 14 belegten Paare eingehängt hätte, hätte die
Ursache stehen lassen und den nächsten `makeshift`-Bau wieder herausfallen
lassen.

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

---

## T7 · `test_travel_havarie.py` hängt von der Testreihenfolge ab — ✅ ERLEDIGT, aber die Überschrift war falsch

> **Nachtrag 31.08.2026 abends.** Der erste Schritt aus der Notiz unten
> („herausfinden, WELCHER vorangehende Test den Zustand hinterlässt") führte ins
> Leere, weil die Überschrift die Ursache schon behauptete. Der richtige erste
> Schritt war, die RATE zu messen.
>
> **Gemessen über 30 EINZELläufe des einen Falls, ohne jeden Vorgänger: 2 rot,
> rund 7 %.** Damit ist die Reihenfolge als Ursache erledigt. Jeder Fehlschlag
> hat dieselbe Signatur:
>
>     erwartet  ['rueckruf',              'notruf', 'zerfaserung']
>     bekommen  ['rueckruf', 'notabwurf', 'notruf', 'zerfaserung']
>
> **Die Ursache:** der Test macht ZWEI Sprünge (raus, dann heim auf leerem
> Tank). Der Ausgangssprung zieht ein Signal wie jeder andere Sprung. Trägt das
> gezogene Signal ein `cargo_grant` (Migration 267, „Fund freight"), legt
> `fn_travel_signal_apply` eine Zeile in `travel_cargo` — und
> `drift_havarie_payload` hängt `notabwurf` in den Katalog, sobald
> `cargo_aboard > 0` (Migr. 278, Zeile 110 ff.). Die Voraussetzung „keine Ladung
> an Bord" stand nirgends; sie traf nur meistens zu.
>
> Der Test räumte die ANDERE Folge derselben Ziehung längst weg
> (`pending_signal` aus dem Checkpoint) — nur eben die eine, die ihm damals
> aufgefallen war.
>
> 🔑 **Ein Test, der eine Voraussetzung nicht herstellt, sondern vorfindet, ist
> in dem Maß grün, in dem er Glück hat.** Der Kommentar beschrieb die Ziehung
> sogar richtig und zog daraus nur die halbe Folgerung.
>
> **Reparatur:** dieselbe Admin-Schreibung, die den Checkpoint säubert, löscht
> jetzt auch `travel_cargo` für den Run; und die Voraussetzung wird gemessen
> (`assert hav["cargo_aboard"] == 0`), bevor die Liste geprüft wird. Die
> Zusicherung bleibt EXAKT: Gegenstand des Tests ist der Katalog am eigenen Dock
> und dessen REIHENFOLGE (das HUD rendert ihn in Reihenfolge). Eine Zusicherung
> über die Menge statt über die Liste hätte genau das aufgegeben.
>
> ### Und der Grund, warum es wie Reihenfolge AUSSAH
>
> ⚠ **Zwei Sitzungen fahren gegen dasselbe lokale Supabase.** Direkt gemessen:
> zwei GLEICHZEITIGE Läufe derselben Datei → **6 von 6 rot**, 15 bis 17
> Fehlschläge je Lauf, mit ganz anderen Signaturen (`fn_travel_move: run not
> found`, `run is havarie, not active`, `assert 'havarie' == 'abandoned'`).
> Sequenziell: 1 rot in 30. Die Integrationsmappe setzt Reisende über
> `_reset_traveler` auf FESTEN Nutzer-IDs zurück — zwei gleichzeitige Läufe
> räumen sich gegenseitig den Boden weg.
>
> 🔑 **Ein grüner und ein roter Lauf zwei Minuten auseinander sind hier kein
> Beleg für Flackern.** Sie können schlicht heissen, dass die andere Sitzung
> auch gerade lief. Vor `backend/tests/integration/` kurz abstimmen.

### Der ursprüngliche Befund (Stand vor der Messung)

**Gemessen:** 31.08.2026, beim Abschluss von T5.

    allein aufgerufen            22 grün   (zweimal nachgeprüft)
    im vollen Rückenlauf          1 rot    test_a_wreck_on_the_home_dock_is_offered_the_rueckruf

Derselbe Test war im vollen Lauf einige Stunden zuvor grün (4 915 / 0). Er ist
also nicht dauerhaft rot, sondern **abhängig davon, was vor ihm lief** — die
schlechtere Sorte, weil sie in CI zufällig zuschlägt und lokal nicht
nachstellbar wirkt.

Das Gedächtnis führt ihn seit J1 als „die bekannte Signalziehung": er zieht ein
Signal aus einem Zufallsvorrat. Ein Test, der zieht, braucht einen gesetzten
Startwert oder eine Zusicherung über die Menge statt über das gezogene Stück.

**Nicht gemessen:** welcher vorangehende Test den Zustand hinterlässt. Der erste
Schritt ist ein Lauf gegen die Integrationsmappe mit fester Reihenfolge, nicht
das Ändern der Zusicherung.

---

## T8 · Fünf gelöschte Welten halten noch lebende Bauten, Agenten und Zonen — ✅ DAS LESEFENSTER IST ZU (Migration 313)

> **Nachtrag 31.08.2026 abends.** Die drei Kosten aus der ursprünglichen Notiz
> haben sich beim Messen auf **eine** reduziert, und die Richtung war danach
> keine Entscheidung mehr. Der Reihe nach.
>
> **(1) Sollte eine der fünf zurückgeholt werden? Gemessen: nein.**
>
>     Welt                                   angelegt        gelöscht        Abstand
>     the-tamagotchi-temporality-principle    09.04. 19:34    09.04. 20:37     63 min
>     the-tamagotchi-temporality              09.04. 20:04    09.04. 20:37     33 min
>     the-ancestral-dream-syndicate           09.04. 20:29    09.04. 20:37      8 min
>     the-prophecy-of-fractured-time          09.04. 23:59    10.04. 00:06      7 min
>     the-oneironautical-beacon               10.04. 00:14    10.04. 00:22      8 min
>
> Alle fünf: Ursprungswelten, je 6 Agenten, 6–7 Bauten, 5 Zonen, **0 Ereignisse,
> 0 Ableger**, ein Mitglied, Besitzer das eigene Konto. Fünf verworfene
> Schmiede-Versuche eines Abends. Nichts hängt an ihnen.
>
> **(2) Die Zahl war nicht der Befund. Das Lesefenster war es.**
>
> `active_agents`, `active_buildings` und `active_events` sind Sichten **ohne**
> `security_invoker`, im Besitz von `postgres`, mit SELECT für `anon`. Sie laufen
> als ihr Eigentümer — die RLS der Basistabelle greift also gar nicht. Genau so
> sind sie gemeint (Public-First-Lesepfad, `drift_service.py` nennt es zweimal).
>
> Nur trägt `agents_anon_select` eine Bedingung, die die Sicht nicht kennt:
>
>     Richtlinie:  deleted_at IS NULL AND EXISTS (SELECT 1 FROM simulations
>                    WHERE id = agents.simulation_id
>                      AND status = 'active' AND deleted_at IS NULL)
>     Sicht:       deleted_at IS NULL
>
> Die Sicht prüfte das `deleted_at` des KINDES und schwieg über die Elternwelt.
> **30 Agenten und 34 Bauten gelöschter Welten waren dadurch anonym lesbar**,
> obwohl die Richtlinie derselben Tabelle sie verweigert.
>
> 🔑 **Migration 294 hat diese acht öffentlichen Sichten geprüft und mit dem Satz
> stehen lassen: „ihre Basistabellen gewähren `anon` dasselbe per Richtlinie."
> Der Satz trägt für die Zeile und nicht für die Welt.** Eine Begründung, die für
> die halbe Bedingung stimmt, sieht wie eine Begründung aus, die stimmt. Die
> Notiz steht jetzt an der Liste, die den Satz trägt
> (`test_admin_views_not_public.py`).
>
> **(3) Damit ist die Richtung keine Wahl mehr.** Die drei Wege aus der
> ursprünglichen Notiz messen sich so:
>
> * **Kaskade beim Löschen** — unumkehrbar. Und `SimulationService.restore_simulation`
>   existiert und setzt `deleted_at` zurück. Eine Kaskade würde die Rückholung,
>   die es GIBT, im Nachhinein entwerten. Verworfen.
> * **Jede Leseabfrage joint** — gemessen: es gibt gar keine unbegrenzte
>   Leseabfrage. Alle 22 Stellen, die `agents`/`buildings`/`zones` ohne
>   `simulation_id` anfassen, sind `.eq("id", …)`-Nachschläge oder Schreibungen.
>   Das Problem lag nie in den Abfragen. Verworfen.
> * **Eine Sicht je Tabelle** — die Sichten existieren bereits, sind bereits der
>   öffentliche Lesepfad, und sind genau die zwei, die lecken. **Gewählt.**
>
> **Migration 313** gibt den drei Sichten die fehlende Hälfte:
> `EXISTS (SELECT 1 FROM simulations s WHERE s.id = <kind>.simulation_id AND
> s.deleted_at IS NULL)`. Transaktional gegen die echten Prod-Daten geprobt
> (`BEGIN … ROLLBACK`), zweimal in derselben Transaktion angewandt:
>
>     Waisen in active_agents      30 → 0
>     Waisen in active_buildings   34 → 0
>     active_agents gesamt              228   (die 228 lebender Welten)
>     active_buildings gesamt           290
>     anon-Grant nach CREATE OR REPLACE  erhalten
>
> **Bewusst NICHT mitgenommen:** der `status`-Filter, den die anon-Richtlinie
> zusätzlich trägt. `active_agents` ist auch der MITGLIEDER-Lesepfad
> (`AgentService.view_name`); `status` in die Sicht zu nehmen hiesse, einem Admin
> die Agenten seiner eigenen archivierten Welt zu verbergen. Heute fiele das
> nicht auf — es gibt keine archivierte Welt ohne `deleted_at`, die fünf sind
> beides. Genau deshalb ist es der Moment, die beiden Aussagen nicht zu
> verschmelzen. Ein Status ist kein Betrieb.
>
> **Und keine `active_zones`:** `zones` hat keine Sicht und damit kein
> RLS-umgehendes Lesefenster; `zones_anon_select` joint `simulations` korrekt.
> Die 25 Zonen waren ein Zählfehler meiner eigenen Abfrage, kein Lesefenster.
>
> Gebunden von `backend/tests/unit/test_active_views_scope_to_living_worlds.py`
> (20 Fälle), einschließlich einer **Gegenprobe**: ein Filter, der alles
> wegnimmt, bestünde die Waisen-Prüfung ebenfalls.
>
> ⏳ **Offen:** Migration 313 wartet auf das Wort für Prod. Die fünf Welten
> bleiben, wie sie sind.

### Der ursprüngliche Befund (Stand vor der Messung)

**Gemessen:** 31.08.2026, beim Abnehmen von Migration 311 auf Prod.

Meine Prüfabfrage meldete „68 Schritte führen aus dem Vokabular ihrer Welt
heraus", der Abnahmeblock der Migration hatte null gemeldet. Beide hatten recht:
die Abnahme filtert `s.deleted_at IS NULL`, meine Abfrage nicht. **Alle 68
liegen in gelöschten Welten**, und alle sind `fair → fair` — der Schritt gibt
unverändert zurück, weil Migration 309 gelöschte Welten übersprungen hat und
diese Welten deshalb gar kein Bauzustands-Vokabular haben.

Kein Defekt an 311. Aber es legt etwas frei:

    gelöschte Welten                                   5
    Bauten mit deleted_at IS NULL darin               34
    Agenten mit deleted_at IS NULL darin              30
    Zonen darin                                       25
    Ereignisse darin                                   0

🔑 **Das ist N3 in seiner vollen Größe.** Die Systemprüfung führte „30 Agenten
gelöschter Welten" als Befund an der Sicht `active_agents`. Es sind nicht nur
Agenten: das Löschen einer Welt setzt `simulations.deleted_at`, aber die Kinder
behalten ihr `deleted_at IS NULL`. Jede Abfrage, die nur das Kind filtert und
nicht über `simulations` joint, zählt sie mit.

**Zu entscheiden ist die Richtung, und das ist keine Kleinigkeit:**
* **Kaskade beim Löschen** — sauber, aber ein Schreibvorgang über vier Tabellen,
  und er macht das Löschen unumkehrbar in einer Weise, die es heute nicht ist.
* **Jede Leseabfrage joint** — ehrlich, aber es sind viele Abfragen, und die
  nächste vergisst es wieder.
* **Eine Sicht je Tabelle** (`active_buildings` neben `active_agents`) —
  dasselbe Muster, das die Plattform schon benutzt; dann muss aber
  `active_agents` selbst zuerst repariert werden, denn genau die zählt heute
  falsch.

**Nicht gemessen:** ob die fünf Welten absichtlich gelöscht wurden oder ob eines
der Kinder noch irgendwo angezeigt wird. Vor jeder Reparatur gehört das
nachgesehen — eine Kaskade auf eine Welt, die jemand zurückholen will, ist
schlimmer als der Fehler.

---

## T9 · Gesprächstitel und `user_id` sind öffentlich lesbar — ✅ ENTSCHIEDEN: nicht öffentlich (Migration 317)

> **Entscheidung des Nutzers, 31.08.2026 nachts:** „nicht öffentlich machen."
>
> **Migration 317** entfernt die anonymen Leserichtlinien — und zwar **vier**,
> nicht zwei. Die Chat-Familie hat noch zwei weitere, die beim ersten Messen
> nicht auffielen:
>
>     chat_conversations         conversations_anon_select
>     chat_messages              messages_anon_select
>     chat_conversation_agents   chat_conv_agents_anon_select
>     chat_event_references      chat_event_refs_anon_select
>
> 🔑 Zwei davon zu entfernen wäre schlimmer als keine gewesen: die Nachrichten
> blieben offen, und der Punkt sähe erledigt aus.
>
> **Warum es nichts bricht, gemessen statt angenommen:** kein öffentlicher
> Endpunkt liest Chat (`routers/public.py`, `public_service.py`: kein Treffer);
> alle 12 Routen in `routers/chat.py` verlangen `get_current_user` UND
> `require_role`; das Frontend greift nicht direkt zu; und
> `conversation_summaries` ist seit 316 zu. Die vier Richtlinien hatten keinen
> Verbraucher.
>
> **Probe (transaktional gegen die echten Prod-Daten, zweimal angewandt):**
>
>     als anon, nachher     Gespräche 0 · Nachrichten 0 · Agenten der Gespräche 0
>                           · Ereignisbezüge 0
>     zum Vergleich         Agenten 228 · Welten 36   ← Public-First unberührt
>
> Die zweite Zeile ist die eigentliche Aussage: die WELT bleibt öffentlich, die
> Handlung des Menschen nicht.
>
> Der Abnahmeblock misst beide Richtungen — dass keine anonyme Richtlinie mehr
> steht, UND dass die vier eigentümergebundenen stehen bleiben (ein `DROP` zu
> viel bestünde die erste Prüfung ebenfalls und liesse den Chat für seinen
> eigenen Nutzer leer), UND dass überhaupt etwas da war, das man verbergen kann.
> Am Fuss der Migration stehen die vier `CREATE POLICY` der Rücknahme wörtlich.
>
> Gebunden von `backend/tests/unit/test_chat_is_not_anon_readable.py` (17 Fälle).
>
> ⚠ **Ausdrücklich NICHT mitgegangen: `epoch_chat_messages`.** Ihre Richtlinie
> `epoch_chat_select_anon` gibt Kanäle mit `channel_type = 'epoch'` frei — das
> ist Kommunikation zwischen Spielenden IM Spiel und eine eigene Frage. Sie
> steht als offener Punkt, nicht als Versehen.
>
> ⏳ Migration 317 wartet auf das Wort für Prod.

### Der ursprüngliche Befund

**Gemessen:** 31.08.2026 auf Prod, beim Abschluss von T8.

Beim Nachmessen der acht öffentlichen Sichten fiel `conversation_summaries` auf.
Zwei Dinge steckten darin, und nur eines davon ist entschieden.

**Das Unentschiedene ist behoben (Migration 316).** Die Sicht läuft ohne
`security_invoker` als ihr Eigentümer, die RLS greift also nicht:

    Weg                                      anon   authenticated
    chat_conversations  (Basistabelle, RLS)     3         0
    conversation_summaries (Sicht)              3         3

`chat_conversations_select` lautet `user_id = (SELECT auth.uid())` — ein
angemeldeter Nutzer sieht nur seine eigenen Gespräche. Über die Sicht sah er
alle. Die Sicht hat **null Verwender** (weder `backend/`, noch `frontend/src/`,
noch eine RPC), also war das kein Bedarf, sondern ein Rest. Migration 316
entzieht anon und authenticated den Grant und setzt `security_invoker` — genau
das, was Migration 294 für ihre drei getan hat. Nicht gelöscht: Entzug ist
rücknehmbar.

**Das Entschiedene ist eine Frage an den Nutzer, und sie ist älter.** Die Drei
in der `anon`-Spalte kommt nicht von der Sicht, sondern von der Richtlinie
`conversations_anon_select` auf der Basistabelle:

```sql
EXISTS (SELECT 1 FROM simulations
         WHERE id = chat_conversations.simulation_id
           AND status = 'active' AND deleted_at IS NULL)
```

Damit kann **jeder anonyme Leser jedes Gespräch jeder aktiven Welt sehen** —
`user_id`, `title`, `message_count`, `last_message_at`.

Und `chat_messages` trägt dieselbe Richtlinie, gespiegelt
(`messages_anon_select`, join über `chat_conversations` auf `simulations`).
Gemessen mit `SET LOCAL ROLE anon`:

    chat_conversations   anon sieht 3 von 3
    chat_messages        anon sieht 22 von 22

**Es sind also nicht die Titel, es sind die Texte.** Jede Zeile, die ein Mensch
je einem Agenten geschrieben hat, ist öffentlich lesbar — und die
Gegenrichtlinie für angemeldete Nutzer (`chat_messages_select`, gebunden an
`auth.uid()`) lässt genau vermuten, dass das nicht die Absicht war: **ein
angemeldeter Nutzer sieht weniger als ein anonymer.** Zwei Richtlinien auf
derselben Tabelle, die einander widersprechen; die anonyme gewinnt, weil
Richtlinien mit ODER verknüpft werden.

Auf Prod stehen heute **3 Gespräche von 1 Nutzer** — dem Eigentümer. Es liegt
also nichts Fremdes offen. Die Zahl wächst aber mit der Benutzung, und sie
wächst still.

**Zu entscheiden — und das ist eine Produktentscheidung, keine technische:**
Public-First heisst, dass die WELT öffentlich lesbar ist. Ein Gespräch zwischen
einem Menschen und einem Agenten ist eine Handlung des Menschen, keine Tatsache
der Welt. Drei Wege:

* **So lassen** — dann gehört es an die Oberfläche geschrieben, damit niemand
  privat glaubt, was öffentlich ist.
* **Auf die eigenen Gespräche einschränken** — die Richtlinie fällt weg, und
  `chat_conversations_select` trägt allein. Zu prüfen wäre, ob eine öffentliche
  Ansicht davon lebt (gemessen: die Sicht nicht, sie liest niemand).
* **Aufteilen** — die Tatsache „mit diesem Agenten wurde N-mal gesprochen"
  öffentlich, `user_id` und `title` nicht. Braucht eine neue, schmale Sicht;
  Vorbild ist `public_forge_prompts` (genau eine Spalte).

🔑 **Der Widerspruch ist der eigentliche Befund, nicht die Reichweite.** Eine
Tabelle, auf der die anonyme Richtlinie MEHR erlaubt als die angemeldete, ist
entweder absichtlich öffentlich (dann ist die angemeldete überflüssig und
irreführend) oder versehentlich offen (dann ist die anonyme zu weit). Beides
kann stimmen — aber nicht beides gleichzeitig, und heute steht beides da.

**Nicht gemessen:** ob eine öffentliche Oberfläche Gesprächsinhalte anzeigt und
damit von der anon-Richtlinie lebt. Das entscheidet, ob der zweite Weg oben
folgenlos ist. `conversation_summaries` tut es nicht — sie liest niemand.

---

## Anhang · Die Prämisse von Migration 294, für alle acht Sichten zu Ende gemessen

**Gemessen:** 31.08.2026 auf Prod, mit `SET LOCAL ROLE` in `BEGIN … ROLLBACK`.

Migration 294 hat elf Sichten geprüft, drei geschlossen und acht mit einem Satz
stehen lassen: „their base tables grant `anon` the same access by policy."
Der Satz ist zweimal an einem Tag gebrochen (313, 316). Also alle acht
nachgemessen, statt nur die, die auffielen.

    Sicht                    über die Sicht   anon Basistabelle   Befund
    active_agents                       258               228     30 · Migr. 313
    active_buildings                    324               290     34 · Migr. 313
    active_events                       109               109      0 · Migr. 313 vorsorglich
    active_resonances                     1                 1      —
    available_dungeons                    0                 –      —
    conversation_summaries                3                 3      authenticated · Migr. 316
    map_simulations                      36                36      —
    simulation_dashboard                 36                36      —

Nach 313 und 316 stimmt der Satz für alle acht. Vier waren von vornherein
sauber; `available_dungeons` ist leer und damit ohne Aussage — bei der ersten
Dungeon-Zeile erneut messen.

### Die Zahl, die dabei erschreckt und keine ist

    Basistabelle als `authenticated` ohne Token:
    agents 0 · buildings 0 · events 0 · simulations 36 · substrate_resonances 1

Das sieht aus, als sähe ein angemeldeter Nutzer WENIGER als ein anonymer. Zwei
Gründe, warum das hier kein Befund ist, und einer, warum es bei den Gesprächen
doch einer war:

1. ⚠ **`SET LOCAL ROLE authenticated` ohne Token setzt `auth.uid()` auf NULL.**
   Jede Richtlinie, die daran hängt (`user_has_simulation_access`), fällt
   deshalb auf null — das misst nicht „ein angemeldeter Nutzer", sondern
   „niemand mit der Rolle eines angemeldeten Nutzers". Falsch-Grün und
   Falsch-Rot sind beide möglich (steht so im Gedächtnis seit dem 29.08.).
2. Für Agenten, Bauten und Ereignisse ist die Ungleichheit **Absicht**: die
   `active_*`-Sichten SIND der öffentliche Lesepfad (CLAUDE.md,
   Public-First), und sie sind beiden Rollen bewusst gewährt, damit ein
   angemeldeter Nicht-Mitglied browsen kann, ohne 403 zu bekommen.
3. Bei `conversation_summaries` fehlt genau diese Absicht: ein Gespräch ist
   keine Tatsache der Welt, die Sicht hat null Verwender, und daneben steht
   eine Richtlinie, die dem Nutzer nur die eigenen Gespräche erlaubt. Deshalb
   ist es dort ein Befund und hier keiner.

🔑 **Dieselbe Zahl ist einmal die Architektur und einmal der Fehler.** Sie zu
lesen erfordert die Absicht daneben, nicht nur die Messung.

---

## T10 · N5, eine Schicht tiefer: die Meinung kann nicht sinken — ✅ WEG 1 IST GEBAUT

> **Entscheidung des Nutzers, 31.08.2026 nachts:** Weg 1 allein, eine Zeile,
> eine Woche messen. Die Einseitigkeit getrennt, damit man hinterher weiss,
> welche Änderung gewirkt hat.
>
> `SOCIAL_INTERACTIONS["insult"]["opinion_range"]` steht jetzt auf
> **`(-100, 20)`** statt `(-100, -20)`.
>
> **Die Obergrenze 20 ist eine Aussage, kein Rest:** eine schlecht gelaunte
> Figur kann jemanden anfahren, den sie neutral oder lau sieht, aber nicht
> jemanden, den sie mag. Von 72 `good_conversation`-Modifikatoren stapeln sich
> manche Paare über +20 — die sind geschützt.
>
> **`confrontation` bleibt bei `(-100, -50)`** und braucht keine Änderung: ist
> der Einstieg offen, stapelt `insult` bis −75 (Kappe 5) und erreicht dessen
> Fenster von selbst. Ein Schloss öffnen, nicht zwei.
>
> Gebunden von `backend/tests/unit/test_an_opinion_can_reach_below_zero.py`
> (14 Fälle). Der Test prüft **nicht die Zahl 20**, sondern die EIGENSCHAFT:
> von einer neutralen Meinung aus muss ein Weg nach unten existieren, eine warme
> Beziehung muss geschützt bleiben, der Einstieg muss sich selbst tragen (nach
> dem ersten Schlag noch im Fenster liegen), und gestapelt muss das Tor bei −60
> erreichbar sein. Wer die Zahl später ändert, darf das — er darf nur die
> Schleife nicht wieder schliessen.
>
> **Falsifiziert:** mit dem alten Wert `(-100, -20)` werden 7 der 14 Fälle rot.
>
> ### Was in einer Woche zu messen ist
>
> ```sql
> select min(opinion_score), max(opinion_score),
>        count(*) filter (where opinion_score < 0) as negative,
>        count(*) filter (where opinion_score <= -60) as am_tor
>   from agent_opinions;
> select count(*) from agent_opinion_modifiers where opinion_change < 0;
> select count(*) from events where created_at > now() - interval '7 days';
> ```
>
> Erwartung, gemessen hergeleitet: **eine Beleidigung alle ein bis drei Wochen**,
> mit steigender Tendenz (die Zahl der Agenten unter −20 wuchs heute von 0 auf 6).
> ⚠ **Wer nach einem Tick nachmisst, sieht nichts** — und wird die Änderung
> fälschlich für wirkungslos halten.
>
> ⏳ **Die Änderung ist Code und wirkt erst nach einem Deploy.**
>
> ### Getrennt geblieben, wie entschieden
>
> Die Einseitigkeit (39 von 39 Beziehungen unerwidert) ist NICHT mitgegangen.
> Sie halbiert die Rate und sperrt einen festen Teil der Bevölkerung aus — aber
> zwei Änderungen zugleich hätten die Messung unlesbar gemacht.

### Der ursprüngliche Befund

**Gemessen:** 31.08.2026 nachts auf Prod und am Quelltext, nachdem N5 lief.

Nach dem Deploy vom Morgen bewegt sich alles, was sich bewegen sollte:

    Bedarfs-Moodlets              0 →  120
    schlechteste Laune           −1 →  −25
    Agenten unter dem −20-Tor      0 →    6
    max. Stress                    0 →    8   (Tor bei 800)
    **Meinungsspanne          0 … 45 → 0 … 45**   ← unverändert, 1 177 Zeilen, null negative

Die Meinungsspanne war als „nächste Zahl, auf die es ankommt" notiert, weil
`relationship_threshold` |Meinung| ≥ 60 braucht. Sie steht. Hier ist, warum —
und es ist kein Zufall, sondern eine geschlossene Schleife.

### Die Rechnung

`fn_recalculate_opinion_scores` (Migr. 145):

    opinion_score = clamp(base_compatibility * 20 + Σ opinion_change, −100, 100)

Beide Summanden sind gemessen:

    base_compatibility     min 0, max 0, über ALLE 1 177 Meinungen
    Modifikatoren                 109 Zeilen, **null davon negativ**
      good_conversation    72 × +8
      shared_experience    37 × +5

### Schloss 1 · Die Grundlage ist überall 0

`AgentOpinionService._ensure_opinion_record` legt jede Meinung mit
`"base_compatibility": 0.0` an — fest verdrahtet. Berechnet würde sie von
`PersonalityExtractionService.compute_base_compatibility`, und die hat im
Betrieb keinen Aufrufer (derselbe Befund wie A3 zu
`fn_initialize_agent_autonomy`).

Sie könnte auch gar nicht rechnen: **alle 258 Agenten tragen
`personality_profile = '{}'`** — nicht NULL, sondern ein leeres Objekt. Das ist
genau die zurückgestellte „Persönlichkeits-Rückfüllung" (0,03 USD, 258 Aufrufe).
Ohne Persönlichkeit keine Verträglichkeit, ohne Verträglichkeit keine Grundlage
— und damit hängt die Meinung allein an den Modifikatoren.

### Schloss 2 · Nur zwei Handlungen senken eine Meinung, und beide setzen sie voraus

`SOCIAL_INTERACTIONS`, vollständig, nach Gewicht:

    Interaktion               Gew  Laune-Fenster   Meinungs-Fenster   Δ Meinung
    casual_chat                50  (−50, 100)      (−30, 100)             —
    deep_conversation          30  (−20, 100)      (−10, 100)            +8
    collaboration              20  (−10, 100)      (  0, 100)            +5
    seek_comfort_interaction   15  (−100, −30)     ( 20, 100)           +18
    insult                      5  (−100, −20)     (−100, −20)          −15
    confrontation               3  (−100, −40)     (−100, −50)          −12

🔑 **`insult` verlangt, dass die Meinung schon bei −20 oder darunter steht — und
`insult` ist eine der nur zwei Quellen, aus denen eine Meinung überhaupt sinken
kann.** `confrontation` verlangt −50. Die Bedingung der Ursache ist ihre eigene
Wirkung.

Das ist **wörtlich dieselbe Form wie N5 selbst**, eine Schicht tiefer. N5 lautete:
„um unglücklich zu werden, muss man beleidigt werden — und wer beleidigt, muss
unglücklich sein." Der Laune-Teil ist heute Morgen aufgebrochen worden
(Bedarfs-Moodlets, 6 Agenten unter −20). Der Meinungs-Teil steht noch, und er
war nie das Laune-Fenster: **er ist das Meinungs-Fenster.**

### Schloss 3 · Zwei negative Vorlagen haben gar keinen Erzeuger

`profession_rivalry` (−5) und `betrayal` (−25) stehen in `OPINION_PRESETS` und
werden von **keiner Stelle** geschrieben. Der einzige lebende Schreiber von
Modifikatoren ist `AgentActivityService._execute_interaction`;
`add_proximity_modifiers` und `add_event_modifiers` nennen sich in ihren eigenen
Docstrings „currently dormant — no callers exist" (auch das dieselbe Bauart wie
[[a-door-that-only-opens-for-those-inside]]).

### Was NICHT das Problem ist

Die Stapelkappen reichen aus. Wäre die erste Beleidigung möglich, käme man ans
Tor:

    insult      −15 × Kappe 5 (social_negative)  = −75   ≥ 60 ✓
    argument    −12 × Kappe 5                    = −60   ≥ 60 ✓
    betrayal    −25 × Kappe 2                    = −50   < 60
    rivalry      −5 × Kappe 1                    =  −5

**Also ist `relationship_threshold` erreichbar** — es fehlt ausschliesslich der
erste Schritt unter Null. Die Schwelle zu senken wäre die falsche Reparatur; sie
ist nicht zu hoch, der Weg dorthin beginnt nicht.

### Nachgerechnet: zwei der drei Wege können das Schloss gar nicht öffnen

Nach dem ersten Aufschreiben durchgerechnet, was jeder Weg RECHNERISCH erreicht.
`insult` verlangt eine Meinung ≤ −20.

    Weg 2  base_compatibility ∈ [−0,3 ; +0,3] × 20   →  tiefstens  −6
    Weg 3  profession_rivalry −5, Kappe 1            →  tiefstens  −5
    beide zusammen                                   →  tiefstens −11
    gebraucht                                        →           −20

🔑 **Keine Kombination der übrigen Massnahmen erreicht −20.** Die einzigen
Quellen für eine negative Meinung sind `insult` und `confrontation`, und beide
verlangen bereits eine negative Meinung. `base_compatibility` und
`profession_rivalry` verschieben die Verteilung, aber sie kommen nicht bis an
das Fenster heran. **Das Meinungs-Fenster von `insult` zu öffnen ist deshalb
nicht einer von drei Wegen, sondern der einzige, der wirkt.** Die anderen beiden
sind aus eigenem Recht sinnvoll — sie öffnen dieses Schloss nicht.

### Und wie schnell es dann geht — gemessen

    Paare, die sich in 24 h getroffen haben              25
    Begegnungen insgesamt seit dem 25.03.             4 021  (auf 46 Paaren)
    meiste Begegnungen eines einzigen Paares            156
    Agenten mit Laune ≤ −20                               6 von 258
    Anteil `insult` unter den dann gültigen Wahlen    5 / 55 ≈ 9 %
                                                     (bei Laune −25 sind nur
                                                      casual_chat und insult gültig)

Grob gerechnet: rund **eine Beleidigung alle ein bis drei Wochen**, nicht
täglich. Das ist keine Untergrenze für immer — die Zahl der unglücklichen
Agenten ist heute von 0 auf 6 gestiegen und wächst weiter, also beschleunigt es
sich von selbst. Aber wer nach einem Tick nachmisst, wird nichts sehen.

Und einmal geöffnet, trägt es sich: nach der ersten Beleidigung steht die
Meinung bei −15 und liegt weiterhin im Fenster; die Kappe erlaubt fünf,
zusammen −75.

### ⚠ Der vierte Fund: jede Beziehung in Velgarien ist einseitig

    Paare mit Meinungs-Modifikatoren                     39
      davon beidseitig                                    0
      davon EINSEITIG                                    39

`generate_social_interactions` bildet die Paare mit `combinations(zone_agents, 2)`
— das liefert jedes Paar genau einmal und in fester Reihenfolge. `_select_interaction`
prüft ausschliesslich `mood_a` und A's Meinung über B, und `_execute_interaction`
schreibt ausschliesslich A's Meinung über B. **B bildet sich nie eine Meinung
über A.**

`agent_opinions` ist gerichtet und trägt beide Zeilen; `add_proximity_modifiers`
schreibt ausdrücklich in beide Richtungen (`# Bidirectional`) — nur ist die
Funktion tot. Der einzige lebende Pfad kennt nur eine Richtung.

Für N5 heisst das: **in der Hälfte der Paare ist der Unglückliche gar nicht der
Handelnde**, und zwar nicht zufällig, sondern fest — dieselbe Reihenfolge bei
jedem Tick. Diese Paare können nie eine Beleidigung erzeugen, egal wie schlecht
es dem Betroffenen geht. Das halbiert die Rate oben nicht nur, es sperrt einen
festen Teil der Bevölkerung dauerhaft aus.

Reparatur wäre klein (beide Richtungen auswerten, oder die Reihenfolge je
Begegnung würfeln) — aber sie ist eine eigene Entscheidung über das Spiel und
gehört nicht in dieselbe Runde wie das Fenster.

### Zu entscheiden (drei Wege, alle inhaltlich)

1. **Das Meinungs-Fenster von `insult` öffnen** — z. B. `(−100, 20)` statt
   `(−100, −20)`: eine schlecht gelaunte Figur kann jemanden anfahren, den sie
   bisher neutral sah. Kleinster Eingriff, eine Zeile, und er passt zur Fiktion:
   schlechte Laune sucht sich ein Ziel, nicht einen Feind.
2. **Die Grundlage füllen** — die Persönlichkeits-Rückfüllung nachholen
   (0,03 USD) und `compute_base_compatibility` an einen Aufrufer hängen. Dann
   streut `base_compatibility * 20` die Meinungen von vornherein um Null, und
   `insult` findet seine Voraussetzung von selbst. Der teurere, aber
   ursächlichere Weg — und er macht Agenten zugleich unterscheidbar.
3. **Einen Erzeuger für `profession_rivalry` bauen** — zwei Agenten desselben
   Berufs beginnen bei −5. Passt zur Fiktion, ist aber allein zu schwach
   (Kappe 1).

⚠ Wege 1 und 2 zusammen wären wahrscheinlich zu viel auf einmal. Nach N5 gilt
dieselbe Vorsicht wie heute Morgen: **ein Schloss öffnen, eine Runde messen.**

**Nicht gemessen:** wie oft `_execute_interaction` je Tick überhaupt läuft, also
wie schnell sich eine geöffnete Schleife füllen würde. Das entscheidet nicht,
WELCHER Weg richtig ist, aber es sagt, wie lange man auf die Wirkung wartet.
