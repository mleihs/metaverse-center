# Handoff: Simulation Forge — Redesign übernehmen

**Referenz-Prototyp:** `Simulation Forge v2.dc.html` (im Design-Projekt, nicht im Repo).
Das ist ein eigenständiger HTML-Prototyp — **nicht kopieren**, sondern die darin gelösten
Probleme in die bestehenden Lit-Komponenten übertragen.

**Ziel-Repo:** `velgarien-rebuild/frontend/src/components/forge/`

## Verbindliche Repo-Regeln (nicht verletzen)

- Farben **nur** über Tokens aus `src/styles/tokens/` (`var(--color-…)`), niemals rohe Hex/rgba-Werte.
  Der Prototyp enthält Hex-Literale, weil er außerhalb des Token-Systems läuft — beim Übertragen mappen.
- Headings: `--font-brutalist` (Courier), uppercase, `--tracking-brutalist`.
- Icons ausschließlich aus `src/utils/icons.ts`.
- Jeder User-String über `msg('…')`, keine Em-Dashes in msg()-Strings (En-Dash verwenden).
- Operative-Farben aus `src/utils/operative-constants.ts` (SPY #64748b · GRD #10b981 · SAB #ef4444 ·
  PRP #f59e0b · INF #a78bfa · ASN #dc2626) — im Prototyp hartkodiert, im Repo importieren.
- WCAG AA.

## Datei-Zuordnung

| Phase / Bereich | Repo-Datei |
|---|---|
| Shell, Phasenleiste, Topbar | `VelgForgeWizard.ts` |
| I · Astrolabe | `VelgForgeAstrolabe.ts`, `VelgForgeScanOverlay.ts` |
| II · Table | `VelgForgeTable.ts` |
| III · Darkroom | `VelgForgeDarkroom.ts`, `VelgDarkroomStudio.ts` |
| IV · Ignition | `VelgForgeIgnition.ts`, `VelgForgeMint.ts` |
| Zeremonie | `VelgForgeCeremony.ts` |

## Zu übernehmen — nach Priorität

### P0 — Defekte

1. **Datenverlust beim Regenerieren.** `VelgForgeTable.ts`: „Neu rekrutieren" / „Neu entwerfen"
   überschreibt bereits übernommene Agenten bzw. Gebäude ersatzlos. Zweistufig machen:
   erster Klick armiert (Panel-Rahmen `--color-danger`, Label „⚠ Überschreiben — bestätigen",
   Warnzeile „verwirft N bereits übernommene Karten"), zweiter Klick führt aus. Beim Phasen-
   oder Panelwechsel entschärfen.
2. **Stempel-Ästhetik entfernen.** `@keyframes stamp-in` (rotate −8deg → −3deg), der
   `3px double`-Rahmen auf dem Erfolgs-Siegel und die rotierten „✓"-Chips in den Divisionspanels.
   Ersatz: `seal-in` (nur Scale + Letterspacing), Siegel als linienflankierte Zeile, Chips ohne Rotation.
   **Projektregel: keine rotierten Rahmen-„Stempel", keine schief hängenden Elemente.**
   Ausnahme: 45°-Rauten als TCG-Gems sind Kanon und bleiben.
3. **Reduced Motion.** Der Prototyp setzt `@media (prefers-reduced-motion: reduce) { * { animation:none } }`.
   Im Repo prüfen, dass keine Komponente ihren Startzustand auf `opacity:0` legt und erst per
   Animation sichtbar wird — sonst bleibt sie für diese Nutzer unsichtbar.

### P1 — Kartensystem (der eigentliche Redesign-Kern)

4. **Agenten und Gebäude als TCG-Karten** statt Buchstaben-in-Raute-Kacheln. Rezept ist im
   Prototyp die Methode `_tcg(it, i, kind, lang, fanN, slammed)` — 1:1 die TCG-Spec aus
   `docs/explanations/tcg-card-system.md`:
   - linkes Gem (Raute) = Aptitude-Summe (Agent) bzw. Kapazität (Gebäude)
   - rechtes Gem (Kreis) = beste Einzelfähigkeit in Typfarbe (Agent) bzw. Zustand ●◐○ (Gebäude)
   - Nameplate zentriert „✦ Name ✦", bei Legendary mit Gold-Sheen
   - 6 Aptitude-Pips in Operative-Farben, Dimming nach Spec: 3–5 dim, 6–7 normal, 8–9 hell + Glow
   - Radius 6px, Legendary-Glow, Deal-Stagger beim Erscheinen
   - Rarität: legendary = Botschafter oder Aptitude ≥ 9; rare = Beziehungen > 0 oder AI-born
     (der Prototyp leitet Werte deterministisch aus dem Namen ab — **im Repo die echten
     Backend-Werte verwenden**, das ist reiner Prototyp-Ersatz)
   - **Gebäudekarten bekommen keine sechs Pips** — Kapazität und Zustand stehen in den Gems,
     dafür 4 Zeilen Beschreibung statt 2.
5. **Portraits statt Monogramme** überall: Slot-Grid, Staging-Hand, Zeremonie-Minikarten,
   Manifest. Im Prototyp Platzhalter aus `assets/` — im Repo die echten generierten
   Portrait-/Gebäude-Assets.
6. **Staging-Hand bleibt Fächer** (Kanon), aber Winkel und Überlappung müssen mit der Kartenzahl
   skalieren: bei 12 Agenten erzeugt ein fester Winkel + −26px Überlappung ~2400px Breite und
   bricht in ineinandergeschobene Reihen um. Im Prototyp:
   `spread = min(5, 26/n)`, `arc = min(10, 52/n)`, Overlap −74px ab n > 6.
7. **Leere Slots als Kartenrücken** (gestrichelter Rahmen, Diagonalmuster, Raute, Nummer)
   statt leerer Kästen.

### P2 — Workflow / UX

8. **Hero nur in Phase I.** Titel + „Plane zehn bis fünfzehn Minuten ein" belegten in jeder Phase
   ~250px Onboarding-Text. Ab Phase II ersetzen durch eine kompakte Kontextleiste:
   Stadtname, gewählter philosophischer Anker, Parameter (`N Agenten · N Gebäude · N Zonen`),
   Sprung zurück zum Seed.
9. **Seed-Panel klappt zusammen**, sobald die Anker vorliegen — sonst erscheinen die drei
   458px hohen Ankerkarten unterhalb des Sichtfelds und der Nutzer merkt nichts vom Scan-Ergebnis.
   Eingeklappt: Seed als Zitatzeile + „✎ Seed ändern".
   (Bewusst **kein** Auto-Scroll — das Zusammenklappen löst es ohne Scroll-Hijacking.)
10. **Fortschritt inline im geklickten Panel** statt als separater Kasten unter allen drei
    Divisionen. Der Nutzer klickt in Panel 2 und bekam die Rückmeldung woanders.
11. **Sticky-Aktionsleiste** in Phase I–III: `position:sticky;bottom:0`, enthält Zurück-Button,
    Live-Fortschritt („4/6 Operative · 3/7 Strukturen · Vermessung fertig", grün bei vollständig)
    und die Primäraktion. Vorher lag „Weiter" nach bis zu 2000px Inhalt ganz unten.
12. **Kosten- und Zeitvorschau direkt an den Parametern** in Phase I:
    „~17 Bilder · ca. 6 Min Generierung · 1 Forge-Token". Die Slider bestimmen, wie viele Karten
    in Phase II zu prüfen sind und was die Zündung kostet — die Kostenzeile stand bisher erst in Phase IV.
13. **Darkroom-Vorschau ist die echte Spielkarte.** Man stellt dort 26 Chips ein, die bestimmen,
    wie *die Karten* aussehen — die Live-Vorschau zeigte eine generische Karte. Jetzt eine
    vollständige TCG-Karte, komplett aus den Theme-Werten gerendert (Primary/Secondary/Accent,
    Radius, Schatten, Textur).
14. **Bildparameter hinter Presets.** Guidance 1–12 und Steps 10–50 sind Diffusion-Interna.
    Drei Presets (Schnell 2.5/18 · Ausgewogen 3.5/28 · Maximal 6/42), Regler nur hinter „Erweitert".
15. **Manifest mit Kontaktbogen** — Thumbnail-Reihe aller Agenten- und Gebäudekarten vor dem
    irreversiblen Halten, statt nur „6 Charaktere mit Dossier".
16. **Erfolgsschirm ohne Widerspruch.** Das Kostenpanel sagt „3–5 Min im Hintergrund", der
    Erfolgsschirm feierte Fertigstellung. Hinweiszeile ergänzen: Portraits und Banner entwickeln
    im Hintergrund (~N Min), die Welt ist trotzdem schon betretbar.
17. **Erfolgsschirm enthüllt Karten** — die ersten vier Operative-Karten gestaffelt (`reveal-rise`,
    160ms Versatz), statt nur Text.

### P3 — Zugänglichkeit & Zustand

18. **Tastatur.** Ankerkarten, Kartenslots und Phasenleiste sind klickbare `div`s.
    `role`, `tabindex`, Enter/Space-Handler, `aria-checked` / `aria-current` ergänzen,
    plus sichtbarer `:focus-visible`-Ring.
19. **„Gespeichert" ehrlich machen.** Der grüne Puls behauptet Autosave, ohne Entwurf oder
    Wiederaufnahme. Entweder Zeitstempel + echter Draft + „Speichern & verlassen" (so im Prototyp),
    oder die Anzeige entfernen.
20. **Sprachwechsel mitten im Lauf** lässt übernommene Karten in der alten Sprache stehen
    (sie sind Kopien der Content-Arrays). Beim Umschalten über den Index remappen.
    Im Repo ggf. hinfällig, wenn die Daten aus dem Backend kommen und `msg()` nur die UI übersetzt —
    dann prüfen, ob generierte Inhalte überhaupt sprachabhängig sind.

## Nicht übernehmen

- Die Inline-Styles des Prototyps (Design-Component-Zwang, im Repo gilt Lit + Tokens).
- Die deterministische Werteableitung aus Namen — nur Prototyp-Ersatz für echte Backend-Daten.
- Die Platzhalter-Assets aus `assets/`.

---

# Umsetzungsstand (Claude Code, 2026-08-29)

Alle 20 Punkte bearbeitet. Vier davon sahen im Repo anders aus als im Prototyp;
die Abweichungen stehen unten mit Begründung.

## P0

1. **Datenverlust — behoben.** Der Befund war echt und lag tiefer als vermutet:
   `ForgeStateManager._generateEntitiesIncremental` löscht die Entitätenliste
   bedingungslos (`_flushUpdate({ [entityType]: [] })`), bevor die erste
   Anfrage rausgeht — es traf also nicht nur die Staging-Hand, sondern die
   gesamte Liste auf dem Tisch. Jetzt zweistufig: erster Klick armiert (Rahmen
   `--color-danger`, „Überschreiben – bestätigen", Warnzeile mit der echten
   Anzahl), zweiter Klick führt aus. Zusätzlich ein „Entworfenes behalten"-
   Ausstieg; Phasenwechsel entschärft über `disconnectedCallback`. Auch die
   Kartografie ist armiert — dieselbe Verlustklasse.
2. **Stempel — ein echter Verstoß gefunden.** Die Divisionspanels rotieren im
   Repo nicht (nur `scale(1.8)`); daraus wurde `seal-in` (Deckkraft +
   Laufweite) mit Linienflanken. Der tatsächlich rotierte Stempel saß in der
   geteilten `VelgGameCard`: `.card__stamp` mit `rotate(-12deg)` quer über der
   Karte. Jetzt ein gerades, linienflankiertes Band. Wirkt auf alle Karten.
3. **Reduced Motion — geprüft, sauber.** Systematischer Scan über alle
   Forge-Komponenten nach „startet auf `opacity: 0` und wird nur per Animation
   sichtbar". Zwei Treffer, beide dekorative Overlays (Scanlinie, Schockwelle),
   die unter Reduced Motion korrekt unsichtbar bleiben. Kein Eingriff nötig.

## P1

4. **Karten — Befund korrigiert.** Die Forge nutzte `<velg-game-card>` bereits;
   sie fütterte sie nur nicht. **Die sechs Aptitude-Pips lassen sich hier nicht
   ehrlich zeichnen:** `ForgeAgentDraft` (`backend/models/forge.py`) trägt
   Name, Geschlecht, `system`, Beruf und zwei Prosablöcke — keine Zahl. Kein
   Forge-Dienst schreibt Aptitudes, und `frontend/scripts/lint-no-aptitude-baseline.sh`
   existiert genau deshalb: „In a simulation with no assigned aptitudes – every
   simulation the Forge has ever generated – those copies painted SPY 6 · GRD 6
   · SAB 6 onto every card. The fallback was the defect." Gems und Pips bleiben
   daher leer; stattdessen zeigt die Karte die eine echte Klassifikation, die
   der alte Code wegwarf: die Fraktion aus `system`. Gebäudekarten bekommen den
   Zustandsgem aus dem echten `building_condition`. Nebenbei: `type` wurde an
   keiner Stelle gesetzt — **jedes Gebäude wurde mit Agenten-Anatomie
   gezeichnet**. Adapter in `forge-card-data.ts`.
5. **Portraits.** Im Entwurfsstadium existieren noch keine generierten Bilder
   (die entstehen erst nach der Zündung), also bleiben dort die Platzhalter aus
   `forge-placeholders.ts`. Die Zeremonie zeigte schon echte Portraits aus dem
   Fortschritts-Polling.
6. **Fächer — gemessen statt geraten.** Die Prototyp-Formel (Overlap −74px)
   reicht bei 200px-Karten nicht: 12 Karten brauchen damit 1586px in einer
   1150px-Konsole. `fanGeometry(count, availableWidth)` leitet den Overlap aus
   der real gemessenen Breite ab (ResizeObserver), deckelt ihn bei 58 % je
   Karte, stuft `md`→`sm` herunter, bevor Karten verschwinden, und lässt als
   letzte Stufe die Reihe scrollen statt die Seite. Winkel/Arkus nach Vorgabe
   (`min(10, 52/n)` / `min(5, 26/n)`). Die alte Reihe hatte kein `flex-wrap` —
   sie lief einfach über.
7. **Kartenrücken** statt leerer Kästen (Rautenmotiv, Diagonalgewebe, Nummer).

## P2

8. Hero nur in Phase I; ab Phase II Kontextleiste (Stadt, Anker, Parameter,
   Sprung zum Seed). 9. Seed-Feld klappt zusammen, sobald Anker vorliegen —
   und **die drei Auto-Scrolls sind raus** (Astrolabe hatte sie an drei
   Stellen, die Tafel an dreien). 10. Fortschritt läuft im geklickten Panel.
   11. `<velg-forge-action-bar>` (sticky) in Phase I–III mit Live-Bereitschaft;
   ersetzt die doppelte Weiter-Schaltfläche der Tafel. 12. Kostenzeile an den
   Reglern, aus derselben Funktion wie die Zündung (`estimateForgeCost`), Dauer
   aus den real gemessenen Zeiten. 13. Darkroom-Vorschau ist die echte Karte,
   über `--card-*` aus den Theme-Werten gespeist. 14. Presets statt roher
   Diffusionsregler. 15. Kontaktbogen vor dem Halten. 16. Widerspruch aufgelöst.
   17. Erfolgsschirm deckte im Repo bereits alle Karten auf.

**Zwei Fehler dabei gefunden, die über die Vorlage hinausgehen:**

- Die Dunkelkammer initialisierte `_guidanceScale = 7.5` — den *Stable-Diffusion*-
  Standard — und schrieb ihn bei jeder Änderung nach `ai_settings`. Alle vier
  Bildzwecke laufen aber über flux (`model_resolver.py`), dessen Standard 3.5
  ist. Jeder, der im Darkroom irgendetwas anfasste, verdoppelte damit unbemerkt
  die Guidance. Presets und Default liegen jetzt auf den flux-Werten.
- Der Regler reichte bis 20, das Backend kappt flux hart bei 10 — die obere
  Hälfte war wirkungslos. Erweitert-Regler endet jetzt bei 10.
- Die Zeremonie **sperrte den Eintritt**, bis das letzte Bild fertig war: 3–5
  Minuten vor einer deaktivierten Schaltfläche, während die Zündung gerade
  Hintergrundgenerierung versprochen hatte. Tür ist offen, Hinweiszeile erklärt,
  was noch nachläuft.

## P3

18. **Tastatur — die ARIA-Attribute der Phasenleiste erreichten das DOM nie.**
    Sie waren als Element-Ausdrücke geschrieben (`${isActive ? html`aria-current="step"` : nothing}`);
    Lit akzeptiert dort nur Direktiven und verwirft ein TemplateResult
    kommentarlos. `aria-current`, `role="button"` und das `aria-label` je Schritt
    fehlten also vollständig, und jeder erledigte Schritt war ein fokussierbares
    `div` ohne Namen und Rolle. Jetzt echte Attributbindungen und eine echte
    `<button>` mit Fokusring. Ankerkarten hatten ihre Tastaturbedienung bereits.
19. „Gespeichert" kommt jetzt aus einer bestätigten Schreiboperation
    (`lastSavedAt`, gesetzt nach `forgeApi.updateDraft`) mit Zeitstempel, plus
    „Speichern und verlassen" (`flushNow()` leert den Debounce-Timer).
20. **Gegenstandslos, wie vermutet.** `t()` (`utils/locale-fields.ts`) löst das
    `_de`-Feld zur Renderzeit gegen die aktive Sprache auf, und `@localized()`
    rendert bei Sprachwechsel neu. Entwurfsentitäten tragen beide Felder — ein
    Wechsel mitten im Lauf bildet sich von selbst um.

## Nachgereicht: die Rahmenkette (2026-08-29, zweiter Durchgang)

Die vier `card_frame_*`-Chips waren **von Ende zu Ende tot**: alle zehn Presets
in `theme-presets.ts` setzen sie, der Darkroom bot 22 Optionen an — aber
`THEME_TOKEN_MAP` kannte keinen der Schluessel, also uebersprang `applyConfig`
sie stillschweigend, und `VelgGameCard` las nie einen Wert. 22 Schalter ohne
Draht.

Jetzt durchgezogen:

- `services/card-frame.ts` — abhaengigkeitsfreies Modul mit `CardFrame`,
  `DEFAULT_CARD_FRAME`, dem `activeCardFrame`-Signal und **einer** Abbildung
  `cardFrameFromConfig()`. Bewusst nicht in `ThemeService`: das laedt ueber die
  API-Schicht den Supabase-Client beim Import, und `<velg-game-card>` ist die
  meistgenutzte Komponente der Plattform — sie darf nicht transitiv eine
  konfigurierte Supabase-Umgebung brauchen, um zu wissen, ob sie Eckwinkel traegt.
- `ThemeService.applyConfig` veroeffentlicht den Rahmen.
- `VelgGameCard` liest das Signal per `effect` und traegt vier Klassen
  (`card--tex-*`, `card--plate-*`, `card--corner-*`, `card--foil-*`).
- 22 Behandlungen als CSS, alle Farben aus den Karten-Rahmenvariablen abgeleitet
  (kein Hex): Texturen als Hintergrundebene der Karte selbst (keine
  Stapelfragen, keine Lesbarkeitskosten ueber dem Text), Ecken als zwei
  diagonal gegenueberliegende Marken (vier wuerden auf Kartengroesse mit den
  Stat-Gems konkurrieren, die oben bereits zwei Ecken belegen), Folien mit je
  eigener Farbquelle, Mischmethode und Bewegung.
- Forge, Zuendung und Zeremonie uebergeben den Rahmen **direkt** — sie zeigen
  eine Welt, die noch nicht gethemt ist (Darkroom bearbeitet lokal auf einer
  Entprellung, die Zuendung zeigt eine Simulation, die es noch nicht gibt).
  Dieselbe Abbildung wie der Laufzeitpfad, damit eine Vorschau der Welt nicht
  widersprechen kann.

Ein Konflikt musste explizit aufgeloest werden: Legendary-Leuchten und
Scanline-Drift setzen beide die `animation`-Kurzschreibweise auf `.card`; ohne
eine kombinierte Regel haette die spaetere das Leuchten stumm geschluckt.

**Gate dagegen:** `tests/forge-redesign.test.ts` prueft fuer jede der 22
Optionen, dass eine Regel existiert. Eine ohne CSS ergaenzte Chip-Option waere
sonst wieder ein stiller No-op — nicht kaputt, nur wirkungslos.

## Prüfung

`tsc` sauber · biome sauber · alle 15 Lint-Gates grün · 971 Tests grün
(51 Dateien, davon `tests/forge-redesign.test.ts` neu: 23 Fälle für
Fächergeometrie, Zustandsabbildung, Kartenansichten, Kostenschätzung) ·
Produktionsbuild grün · 41 neue Strings deutsch übersetzt.
