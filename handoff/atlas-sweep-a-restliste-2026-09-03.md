# Sweep A — Restliste, gesichtet (2026-09-03)

Ursprünglich 72 Stellen, die die Größe/Selektor-Klassifikation nicht allein
entscheiden konnte (siehe `handoff/sweep_a.py`, Rest-Kategorie). Alle 72 sind
jetzt gesichtet. Ergebnis: **39 auf `--heading-transform` promotet, 33 bleiben
`--label-transform`** (ihr Ausgangswert — beide sind heute `uppercase`, die
Entscheidung wird erst unter Atlas sichtbar).

## Promotet auf `--heading-transform` (39)

Regel: `--text-base`/`--text-md` sind laut `_typography.css` die h5-/h6-Größen
im Token-Schema selbst (`h5-size: var(--text-md)`, `h6-size: var(--text-base)`)
— kombiniert mit einem Titel-/Überschrift-Namen im Selektor ist das eine
Überschrift, nur kleiner als eine Seiten-h1.

- 30 eindeutige `title`/`heading`/`subtitle`-Selektoren (Modal-, Panel-,
  Karten-, Sektionstitel) über 20 Dateien — Skript: `handoff/promote.py`
  (im scratchpad, nicht Teil des Repos).
- 2 in `ArchetypeDetailView.ts`: `.title__name` (Monument-Display, `_monument-size`,
  `line-height: 0.95`) und `.not-found__title` (Sektionstitel, `_section-size`).
- 1 echtes `<h3>`-Element mit Inline-Style in `VelgDarkroomStudio.ts:988`, das
  fälschlich auf `--label-transform` stand — Element-Typ schlägt jede
  Selektor-Heuristik, korrigiert auf `--heading-transform`.
- 9 weitere `__name`-Selektoren, die dieselbe Brutalist/`text-md`/`_font-display`-
  Signatur tragen wie bereits promotete Titel (Konsistenz mit Nachbar-Regeln):
  `ArchetypeDetailView.ts .not-found__name`, `ChatWindow.ts .window__agent-name`,
  `EpochResultsView.ts .podium__name` + `.mvp-card__sim`, `htp-styles.ts .op-card__name`,
  `VelgAttunementPanel.ts .card__name`, `VelgConstellationList.ts .row__name`,
  `VelgInsightReveal.ts .attunement__name`, `MapConnectionPanel.ts .panel__sims`.

## Bleibt `--label-transform` (33)

- **Stempel/Wasserzeichen/Anzeigen** (dekorativ, keine semantische Überschrift
  trotz großer Schrift): `EpochResultsView.ts .header__watermark`,
  `deploy-operative-styles.ts .dispatch-stamp`, `VelgDispatchStamp.ts .stamp--watermark`,
  `VelgGameCard.ts .card__stamp`.
  ~~`DashboardStage.ts .clock--idle` (Uhr-Anzeige)~~ — **revidiert 2026-09-03,
  auf `--heading-transform` umgestellt.** Die Einordnung als Anzeige stimmt für
  die laufende Uhr; an der Stelle steht ohne Zyklusfrist aber ein ganzer Satz
  („No cycle clock running") bei 31 px. Auf Papier wäre er der einzige versale
  Satz einer Ansicht gewesen, in der jede Überschrift klein gesetzt ist. Auf
  Phosphor ändert sich nichts.
- **Buttons/Status/Eingaben** (Label per Rolle, nicht per Größe):
  `BureauDispatchView.ts .decoder__input`, `content-styles.ts .status__text`,
  `VelgForgeCeremony.ts .ceremony__enter-btn`, `VelgForgeScanOverlay.ts .scan-status__phase`,
  `health/SimulationHealthView.ts .health-hero__label` (heißt selbst „label"),
  `InvitationAcceptView.ts .loading-state` (Spinner-Text).
- **Kicker/Sub-Zeilen in Mono** (Kicker-Konvention, kein Heading):
  `content-styles.ts .hero__sub`, `htp-styles.ts .hero__sub`.
- **Kompakte Listenzeilen/Feldwerte** (dichte Zeile, kein eigenständiger Titel):
  `locations/StreetList.ts .item__name`, `settings/UnsubscribeView.ts .subject__value`,
  `HowToPlayTopic.ts .topic-dim-block__name` (gedämpfter Block, Name absichtlich sekundär).
- **`--_forge-label` / `--_forge-readout` / `--_label-size` / `--apt-font-size`**
  (7+ Stellen): Tier-3-Variablenname sagt selbst „label"/„readout" — Variable ist
  dynamisch/extern gesetzt, nicht im selben Block auflösbar, aber der Name ist
  eindeutig genug.
- **`map/CartographicMap.ts .stamp-text`** (5px, Stempel-Text auf einer Karte —
  dekorativ, keine Überschrift).
- **`MapTooltip.ts` Inline-Style** (`epochStatus`-Badge, Satz-Inline-Status) —
  bereits korrekt, keine Änderung nötig.

## Kontrolle

`npm run lint:full` grün nach jeder Anwendung (siehe
`handoff/RESUME-atlas-skin-2026-09-03.md`).
