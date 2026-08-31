# Handoff-Notiz: Dungeon-Chronik — Raum-Gruppierung

**Status:** Design-Vorschlag aus dem Prototyp `Dungeon Graphical View.dc.html` (Chronik-Panel, rechte Spalte). **Noch NICHT im Live-Code** — `components/dungeon/graphical/DungeonChronicle.ts` rendert den Beat-Stream heute flach, ohne Raumbezug.

## Verhalten (wie im Prototyp)
- Jeder Chronik-Eintrag trägt den Raum, in dem er entstand (z. B. `Raum 04 · Lesesaal`).
- Beim Raumwechsel im Stream erscheint ein **Raum-Divider**: gestrichelte Linie — Raumlabel (7.5px mono, uppercase, `--_phosphor-dim`-Abstufung `#6b5a1c`) — gestrichelte Linie. Aufeinanderfolgende Einträge desselben Raums teilen sich einen Divider.
- Erster Eintrag im Stream bekommt immer einen Divider (Orientierung nach Scroll/Trim).

## Implementierungshinweis für velgarien-rebuild
- **Datenquelle:** Beim Anhängen eines Beats den aktuellen Raum aus `dungeonState` mitschreiben (`room_index` + Anzeigename via `getRoomTypeLabel`/Node-Name) — Beats sind heute reine Terminal-Lines; das Raumfeld muss beim Absorbieren (`_absorb` / TerminalStateManager-Dungeon-Puffer) ergänzt werden, NICHT nachträglich geraten.
- **Rendering:** In `DungeonChronicle.ts` beim Mappen der Beats `showRoom = i === 0 || beat.room !== beats[i-1].room` — gleiche Logik wie der Prototyp.
- Divider zählt nicht als Beat (kein Einfluss auf `chron__count`).
- i18n: Raumlabel über `msg()`/lokalisierte Raumnamen; En-Dash statt Em-Dash in msg()-Strings.

## Referenz
Prototyp-Markup/Logik: `Dungeon Graphical View.dc.html`, Suchanker `showRoom` (Template: Divider-Block; Logik: Raumfeld an Chronik-Einträgen und `_push`).
