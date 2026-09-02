# Handoff: Das Nachbesprechungs-Terminal bekommt eine Bühne

**Für:** Claude (Design)
**Von:** Claude Code, Sitzung `57c3f2b0`, 2026-09-02
**Stand des Baums:** `fef68bf8` auf `main`

---

## Worum es geht

Der Endgegner liegt. Die Gruppe hat überlebt, vielleicht nicht vollzählig. Jetzt
wird verteilt, was der Lauf hergegeben hat — der emotionale Höhepunkt eines
Verlies-Durchgangs.

**Dieser Moment hat derzeit keine Bühne.** Er ist eine Knopfreihe in der
Aktionsleiste.

Deine Aufgabe: eine Komponente `<velg-dungeon-debrief>`, die diesen Moment
inszeniert — in der Sprache, die das Projekt schon spricht, nicht in einer neuen.

---

## Was heute existiert (gemessen, nicht erinnert)

### Die Terminal-Seite ist inszeniert

`frontend/src/utils/dungeon-formatters.ts:1404` `formatLootDistribution()` druckt:

```
══════════════════════════════════════════════════
║                                                ║
║        D E B R I E F   T E R M I N A L         ║
║                                                ║
══════════════════════════════════════════════════

SYSTEM EFFECTS
  [AUTO] Stressheilung – …

ASSIGN SPOILS

  [1] ◆ Die Scherbe des Vorsatzes
      Was sie hielt, hält jetzt jemand anderes.
      [UNASSIGNED] Vorschlag: Ilva Rennard
```

Das ist gut und **bleibt**. Es ist die Chronik-Spur des Ereignisses.

### Die Bedienung ist es nicht

`frontend/src/components/dungeon/DungeonQuickActions.ts:568` `_renderDistributionButtons()`:
Name des nächsten Stücks, ein Knopf je Gruppenmitglied, danach „Confirm
Distribution". Das ist alles.

### Die grafische Ansicht hat gar nichts

`case 'distributing'` kommt im gesamten Frontend **an genau einer Stelle** vor —
in der Aktionsleiste. Unter `components/dungeon/graphical/` liegen vier Dateien
(`DungeonGraphicalView`, `DungeonChronicle`, `DungeonCombatFx`,
`dungeon-graphical-styles`), keine kennt Beute. Wer grafisch spielt, sieht den
ASCII-Rahmen in der Chronik vorbeiziehen.

### ⚠ Und ein Zeitgeber läuft, den niemand sieht

`DISTRIBUTION_TIMEOUT_MS = 300_000` (`backend/services/dungeon_shared.py:33`).
Läuft er ab, weist ein Zeitgeber **alles Unverteilte stumm dem ERSTEN
Gruppenmitglied** zu und schließt den Lauf ab
(`dungeon_distribution_service.py:447` `_auto_finalize`).

Fünf Minuten, ohne Ankündigung, ohne Anzeige, mit einer Zuweisung, die niemand
gewählt hat. **Das ist der wichtigste Teil deiner Aufgabe** — nicht die Karten.
Ein Spieler, der in Ruhe liest, verliert seine Wahl, ohne je erfahren zu haben,
dass er unter Zeitdruck stand.

---

## Verbindliche Repo-Regeln (nicht verletzen)

Es gilt `CLAUDE.md` und `.claude/rules/velg-frontend-design.md` vollständig.
Die hier am ehesten verletzten:

| Regel | Kurz |
|---|---|
| Farben | Keine `#hex`/`rgba()`. Tier 1/2 Marken, Tier 3 `--_*` nur in `:host`. `lint-color-tokens.sh` |
| i18n | Jede Zeichenkette in `msg()`. `@localized()` an der Klasse. Kein Geviertstrich (U+2014), Halbgeviert (U+2013) |
| Symbole | Nur aus `utils/icons.ts`, nie eingebettetes SVG |
| Kantenstreifen | **Kein** farbiger Balken an einer Kante — weder `border-left: ≥2px` noch angeheftetes `::before`. Stattdessen `shared/marker-styles.ts` (`.marker-corners`, `.status-mark`). `lint-no-accent-edge-bar.sh` |
| Layout-Behälter | Kein `filter`/`transform`/`will-change`/`contain: paint` auf Hüllen, Ansichten, Tafeln — bricht `position: fixed`. Nur auf Blattelementen |
| Bewegung | Jede Animation braucht `@media (prefers-reduced-motion: reduce)` |
| Fehler | Kein `catch {}`. Jeder Fehlerpfad über `captureError(err, { source: 'VelgDungeonDebrief.methodName' })` |
| Typen | Kein `as unknown as T` |
| Rahmenstil | Falls `bureauPanelFrameStyles` benutzt wird: **letztes** Element im `static styles`-Feld |
| Formatierer | `frontend/node_modules/.bin/biome`, **nicht** `npx biome` — im Wurzelverzeichnis ist das ein fremdes Paket und tut stillschweigend nichts |

Vor dem Abliefern: `cd frontend && npm run lint:full` muss **24× PASS** melden
und 1 069 Tests grün. Die Kette prüft auch Typen der Tests.

---

## Der Zustand, den du vorfindest

Alles liegt bereit. Du musst nichts nachladen.

```ts
import { dungeonState } from '../../services/DungeonStateManager.js';
const s = dungeonState.clientState.value;   // DungeonClientState

s.phase              // 'distributing'
s.party              // AgentCombatStateClient[]  (agent_id, agent_name, condition, …)
s.pending_loot       // LootItem[]        alle Stücke, auto + verteilbar
s.loot_assignments   // Record<loot_id, agent_id>
s.loot_suggestions   // Record<loot_id, agent_id>   Vorschlag des Servers
s.archetype          // für die Atmosphäre
s.difficulty

dungeonState.timerRemaining.value   // number | null — läuft BEREITS
```

`LootItem` (`types/dungeon.ts:797`):

```ts
{ id, name_en, name_de, tier /* 1|2|3 */, effect_type,
  effect_params: Record<string, unknown>, description_en, description_de }
```

### Zwei Werkzeuge, die du benutzen musst statt sie neu zu bauen

```ts
import { localized as localizedField } from '../../utils/locale-fields.js';
localizedField(item, 'name')          // name_de bei DE, sonst name_en
localizedField(item, 'description')

import { formatParams } from '../shared/loot-param-labels.js';
formatParams(item.effect_params)      // „Trait: conscientiousness · Change: 0.15"
```

⚠ `localized` heißt in Lit-Komponenten schon der Dekorator aus `@lit/localize`.
Importiere das Feld-Werkzeug **unter Alias**, sonst verdeckst du den Dekorator
stumm. (Genau das ist mir in `fef68bf8` fast passiert.)

`formatParams` ist die **einzige** erlaubte Quelle für Parameter-Beschriftungen.
Der Beutekatalog in der Hilfe benutzt dieselbe Datei; zwei Tabellen laufen
auseinander.

### Die Auto-Wirkungen abtrennen

```ts
import { AUTO_APPLY_EFFECTS } from '../../utils/dungeon-formatters.js';  // Zeile 1377
const verteilbar = s.pending_loot.filter(i => !AUTO_APPLY_EFFECTS.has(i.effect_type));
const automatisch = s.pending_loot.filter(i =>  AUTO_APPLY_EFFECTS.has(i.effect_type));
```

Vier Arten wirken ohne Wahl: `stress_heal`, `event_modifier`, `arc_modifier`,
`dungeon_buff`. Sie werden **gezeigt, aber nicht zugewiesen**.

### Wie du handelst — nicht die API rufen

Die Komponente ruft **keinen** Endpunkt. Sie schickt Terminal-Befehle, genau wie
die Aktionsleiste heute. So bleiben Terminal-Spur und Oberfläche derselbe
Vorgang, und die Chronik stimmt.

```ts
this.dispatchEvent(new CustomEvent('dungeon-command', {
  detail: { command: `assign ${index1based} ${agent.agent_name}` },
  bubbles: true, composed: true,
}));
// bei personality_modifier zusätzlich eine Big-Five-Dimension:
//   `assign 3 Ilva Rennard conscientiousness`
// wenn alles zugewiesen ist:
//   `confirm`
```

Die genaue Zerlegung steht in `utils/dungeon-commands.ts:640`.
**Es gibt kein Zurücknehmen** — eine Zuweisung überschreibt, aber löst nicht.

---

## Wo es eingehängt wird

Es gibt eine fertige Vorlage: die Kampfleiste **ersetzt** die Aktionsleiste
während des Kampfes. Genauso ersetzt der Debrief sie während `distributing`.

`DungeonTerminalView.ts:637` und `DungeonGraphicalView.ts:654`, beide gleich:

```ts
${inCombat
  ? html`<velg-dungeon-combat-bar compact></velg-dungeon-combat-bar>`
  : html`<velg-dungeon-quick-actions></velg-dungeon-quick-actions>`}
```

⚠ **Beide Ansichten, in einem Zug.** Eine Bühne nur im Terminal wäre genau der
Gleichstands-Bruch, den die Sitzung vom 29.08. zwischen den zwei Oberflächen
beseitigt hat — und den ich heute in derselben Datei wieder gefunden habe.

---

## Zu übernehmen — nach Priorität

### P0 — Der Zeitgeber wird sichtbar

Ohne das ist alles andere Zierrat.

- `dungeonState.timerRemaining.value` anzeigen, solange `phase === 'distributing'`.
- Vorlage: `DungeonCombatBar._renderTimer(remainingMs, totalMs)` (Zeile 1576) —
  ansehen, Gestaltung übernehmen, Maßstab anpassen (300 s statt 30 s).
- Es muss **beim Eintreten in die Phase** lesbar sein, dass die Zeit läuft und
  was bei Ablauf geschieht: alles Übrige geht an das erste Gruppenmitglied.
- Ab ≤ 60 s eine deutliche Zustandsänderung (`--color-warning`), ab ≤ 15 s
  `--color-danger`. Nicht blinken — das Projekt hat kein Blinken.
- `role="timer"` mit `aria-live="off"`, dazu eine `aria-live="polite"`-Meldung
  bei 60 s und 15 s. Ein Vorleser darf nicht jede Sekunde sprechen.

### P1 — Die Bühne

- Vollflächiger Auftritt in der HUD-Fläche, nicht in der Aktionsleiste.
- Zwei Abteilungen, wie das Terminal sie schon nennt:
  **SYSTEM-WIRKUNGEN** (automatisch, nur Anzeige) und **BEUTE VERTEILEN**.
- Auftritt beim Betreten der Phase: gestaffelte Enthüllung über
  `calc(var(--i) * var(--duration-cascade))`. Stufe 3 (legendär) **zuletzt** und
  am längsten — die Reihenfolge trägt die Dramatik, nicht die Effektdichte.
- Jedes Stück nennt: Stufenmarke (`LOOT_TIER_MARKERS`,
  `utils/dungeon-formatters.ts:79` — ◆ ★ ✦), Name, Erzähltext **und** die Mechanik aus
  `formatParams()`. Beides, nie eines statt des anderen — das war ein
  ausdrücklicher Wunsch des Nutzers und ist gestern schon zweimal schiefgegangen.
- Vorschlag des Servers (`loot_suggestions`) sichtbar markieren, aber nicht
  vorwählen. Ein Vorschlag ist kein Vorgriff.

### P2 — Die Zuweisung

- Ziehen **und** Klicken. Ziehen ist die Kür, Klicken der Vertrag: alles muss
  ohne Zeigegerät und ohne Ziehen erreichbar sein (Tastatur, Vorleser, Mobil).
- Gruppenmitglieder als Ziele mit Zustand (`condition`) — ein gefangenes
  Mitglied ist kein gültiges Ziel (`condition !== 'captured'`, siehe
  `DungeonQuickActions.ts:575`).
- `personality_modifier` braucht zusätzlich eine Dimension. Fünf Werte:
  `openness`, `conscientiousness`, `extraversion`, `agreeableness`,
  `neuroticism`. Ohne Wahl darf nicht abgeschickt werden.
- Fortschritt: „3 von 7 zugewiesen". Der Bestätigen-Knopf bleibt gesperrt,
  solange etwas offen ist — der Server weist es ohnehin zurück
  („Not all items assigned"), aber der Spieler soll es vorher sehen.
- ⚠ Berührungsziele mindestens 44 × 44 px.

### P3 — Feinschliff

- `VelgGameCard` prüfen, bevor du eine eigene Karte baust — sie hat Rang
  (`common|rare|legendary`), Folie und 3D-Neigung. **Aber:**
  `CardType = 'agent' | 'building'`, es gibt keinen Beute-Typ. Entscheide
  begründet: erweitern oder eine eigene, schlankere Karte. Erweitern heißt, die
  bestehenden Aufrufstellen nicht zu brechen.
- Archetyp-Färbung: `getThemeColor()` aus `utils/theme-colors.js`.
- SVG-Filter aus `<velg-svg-filters>` (`#ink-bleed`, `#parchment-noise`) —
  sparsam, nur auf Blattelementen.
- Leerfall: kein verteilbares Stück. Dann tritt die Phase gar nicht ein
  (`dungeon_combat_service.py:407`), aber die Komponente darf daran nicht
  zerbrechen.

---

## Nicht übernehmen

- **Kein neuer Endpunkt, kein neues Feld.** Alles Nötige liegt im Zustand.
- **`formatLootDistribution()` nicht ändern.** Die Terminal-Spur bleibt, wie sie
  ist; sie ist die Chronik des Ereignisses.
- **Keine Änderung an der 5-Minuten-Frist.** Sie sichtbar machen, nicht
  verschieben — das wäre eine Spielbalance-Entscheidung und gehört dem Nutzer.
- **Kein Lager, kein Aufheben für später.** Es gibt keines, und eines zu
  erfinden ist Spielentwurf, keine Gestaltung.
- Keine Änderung an `DungeonQuickActions._renderDistributionButtons()` außer
  ihrem Wegfall, wenn der Debrief sie ersetzt.

---

## Was der Spieler wissen muss (Fakten, die ins Bild dürfen)

Alle am Bestand gemessen, nicht erinnert:

- Zugewiesen wird an **Agenten**, nie an Gebäude oder Zonen.
- `building_repair` weist du ebenfalls einem Agenten zu; **welches Gebäude**
  repariert wird, entscheidet die Datenbank — das schlechteste zuerst
  (`ORDER BY CASE building_condition WHEN 'ruined' THEN 0 …`). Gibt es kein
  beschädigtes, verfällt das Stück. Das darf der Spieler ruhig erfahren.
- Eignungs-Verstärkungen sind bei **+2 je Agent** gedeckelt.
- Vier der zwölf Wirkungsarten tauchen später nirgends wieder auf: `memory`,
  `moodlet`, `stress_heal`, `building_repair` wirken sofort und direkt.
  Die anderen stehen danach am Agenten unter **Dungeon Rewards**
  (`AgentDungeonRewards`, im `AgentDetailsPanel`).
- Eine simulationsweite Beute-Übersicht gibt es **nicht**.

---

## Prüfung vor dem Abliefern

1. `cd frontend && npm run lint:full` → 24 × PASS, 1 069 Tests grün
2. `npm run i18n:extract` → jede neue Einheit übersetzen, dann `npm run i18n:build`
   ⚠ Gegenprobe im **erzeugten** Bündel (`src/locales/generated/de.ts`), nicht in
   der `.xlf`. Und: **erst den englischen Satz endgültig machen, dann
   übersetzen** — die Einheits-ID ist ein Hash der Quelle, jede spätere Änderung
   verwirft die Übersetzung.
3. Beide Ansichten ansehen, Terminal **und** grafisch. Kein Befund gilt, der nur
   in einer geprüft wurde.
4. Mit `prefers-reduced-motion: reduce` ansehen.
5. Nur mit der Tastatur durchspielen: zuweisen, Dimension wählen, bestätigen.
6. Kontrast messen, nicht schätzen — und danach **hinsehen**. Ein grünes
   Kontrast-Tor beweist Kontrast, nicht Lesbarkeit.

---

## Offene Entscheidungen (nicht allein entscheiden)

1. **`VelgGameCard` erweitern oder eigene Karte?** Begründeter Vorschlag mit
   Aufwand, dann fragen.
2. **Ziehen als Hauptweg oder als Zugabe?** Auf Mobil ist Ziehen in einer
   scrollenden Fläche heikel.
3. **Wird der Debrief zur Vollansicht** (verdeckt Karte und Chronik) oder bleibt
   er in der HUD-Fläche? Die Vollansicht ist dramatischer und nimmt dem Spieler
   den Blick auf den Lauf, den er gerade beendet hat.
