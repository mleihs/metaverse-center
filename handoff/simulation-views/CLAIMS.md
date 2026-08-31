# Aufteilung des Simulation-Views-Handoffs

Vier Sitzungen teilen sich **einen** Arbeitsbaum
(`/Users/mleihs/Dev/velgarien-rebuild`, alle auf `main`).

| Phase | Sitzung | Dateigebiet |
|---|---|---|
| 0 — Querschnitt (Nav, Reiter „Übersicht", Aktiv-Pattern) | `-45` / L1–L7 | `components/layout\|lore\|agents\|buildings\|shared/**` |
| 1 — Simulation View v4 | `-45` / L1–L7 | dito |
| **2 — Chat** | **velgarien-rebuild-af** | **`components/chat/**`** |
| **3 — Broadsheet** | **velgarien-rebuild-af** | **`components/broadsheet/**`** |
| 4 — Dungeon | velgarien-rebuild-88 | `components/dungeon/**`, `components/combat/**` |
| Dashboard-Redesign, `components/platform/**` | velgarien-rebuild-45 | — |
| Backend · Migrationen · `frontend/src/locales/**` | velgarien-rebuild-88 | — |

> Kurz gab es zwei widersprüchliche Zuteilungen (`af` bekam von der einen Seite
> Phase 2+3, von der anderen Phase 4). `-88` hat zurückgezogen; es gilt die
> Zuteilung aus der Hand, die das Paket vom Nutzer bekommen hat.

## Regeln im geteilten Arbeitsbaum
- **Immer `git commit -F <datei> -- <pfade>`.** Nie `git commit -a`, nie
  `git commit` ohne Pfade: `git add <pfade>` allein schützt NICHT, wenn zwischen
  `add` und `commit` jemand anders etwas einlegt — das hat hier schon einmal
  14 fremde Dateien in einen Commit gezogen.
- **Nie `git stash`** — das nimmt die Arbeit der anderen mit.
- **`frontend/src/locales/**` gehört `-88` allein.** Kein eigener
  `lit-localize extract`; neue `msg()`-Zeichenketten bei `-88` melden, er nimmt
  sie in einem Zug. Zwei Extraktionen erzeugen Konflikte in `de.xlf`, und das
  Wiederherstellen kostet die Übersetzungen.
- **Migrationen: den ZEITSTEMPEL abstimmen, nicht die Nummer.** Zwei
  Migrationen mit sorgfältig abgestimmten Nummern trugen heute denselben
  Zeitstempel, und `version` ist der Primärschlüssel. Prüfung:
  `ls supabase/migrations | sed 's/_.*//' | sort | uniq -d` muss leer sein.
  Nächste freie Nummer: 319.
- ⚠ **`backend/tests/integration/` fährt gegen dieselbe lokale Datenbank.**
  Zwei gleichzeitige Läufe: 6 von 6 rot, mit Signaturen, die wie echte Fehler
  aussehen. Vorher ansagen. Für `backend/tests/unit` egal.
- Vor jedem Push `npm run lint:full` in `frontend/` (~23 Tore).

## Zwei Regeln, eine pro View — nicht eine für beide
- **Chat = Cockpit-Regel** (@2560 KEIN zentrierter Container; Sidebar
  `clamp(280px,22vw,380px)` an der linken Kante, Fenster nimmt die volle
  Restbreite; nur Feed und Composer zentrieren ihr Lesemass über
  `padding-inline: max(26px, calc((100% - 1080px) / 2))`, Bubbles ≤ 560 px).
- **Broadsheet = Papier-Regel** (1220 px Satzmass zentriert — eine Zeitung wird
  nicht breiter, nur der Tisch).
- **Dungeon = Cockpit-Regel** (Rails fix 360/380, die Bühne nimmt alles).

## ⚠ Für Phase 2 vorgemerkt: Chat ist nicht mehr anonym lesbar
Seit **Migration 317** sind vier RLS-Richtlinien weg (`chat_conversations`,
`chat_messages`, `chat_conversation_agents`, `chat_event_references`). Vorher sah
`anon` alle Gespräche und Nachrichten, jetzt keine — vom Nutzer ausdrücklich so
entschieden. Die Sicht `conversation_summaries` ist seit **316** nur noch
`service_role`. Ein Entwurf, der im Chat irgendetwas öffentlich zeigt, braucht
eine neue schmale Sicht (Vorbild `public_forge_prompts`: genau eine Spalte,
`REVOKE ALL` + `GRANT SELECT`).

---

## ⚠ OFFEN UND UNZUSTELLBAR: zwei Dateien in `components/platform/**`

**Warum das hier steht und nicht in einer Nachricht:** Sitzungsnachrichten an
`velgarien-rebuild-45` (Socket 16843) werden zur Freigabe zurückgehalten und
kommen nicht an — bei `velgarien-rebuild-af` (drei Versuche, davon einer als
Relay über `-88`) genauso wie bei mir (drei Versuche). Diese Datei ist damit der
einzige Kanal, der `-45` sicher erreicht. **Wer als Nächstes mit `-45` spricht:
diesen Abschnitt vorlesen.**

**Der Befund** (gemessen von `-af`, dreifach gegengeprüft):

    components/platform/DevAccountSwitcher.ts     border-left 3px, 3 Farbzuweisungen
    components/platform/SimulationSwitcher.ts     border-left 2px, 2 Farbzuweisungen

Beide tragen den verbotenen Akzent-Kantenstreifen in der **geteilten Form**: die
Breite steht in der Basisklasse mit `transparent`, die Farbe erst im
Aktiv-Modifier (`border-left-color: var(--color-primary)`). Jede Hälfte für sich
ist harmlos; `lint-no-accent-edge-bar.sh` sucht nach einer Deklaration der Form
`border-left: >=2px solid <Statusfarbe>` und meldet deshalb PASS.

Dass es wirklich der blinde Fleck ist und nicht die erlaubte Zustands-Ausnahme
(`--active|--selected|--current`), ist belegt: mit Modifier PASS, **ohne**
Modifier ebenfalls PASS (schliesst die Ausnahme als Erklärung aus), beide
Hälften in EINER Deklaration FAIL (belegt, dass das Tor in der Datei feuern
kann).

**Warum es eilt:** `-af` schärft das Tor gerade auf diese Form (und auf drei
weitere: `border-right`; Breite aus einer Custom Property; Farbe aus einem
Tier-3-`--_*` statt aus einem `--color-*`-Token). **Sobald das scharf ist, wird
CI für `-45` rot**, ohne dass `-45` je davon gehört hätte.

**Was zu tun ist** — eine der beiden Zeilen:
* `-45` räumt die zwei Dateien selbst ab (sie gehören ihm, niemand sonst fasst
  `components/platform/**` an), **oder**
* `-45` sagt `-af` zu, dass sie es tun darf.

**Das Ersatzmuster** (eine Wahrheit, drei Sitzungen benutzen es schon):

```ts
import { markerSelectionStyles } from '../shared/marker-styles.js';
static styles = [markerSelectionStyles, css` … `];
```
```html
<div class="row ${active ? 'is-selected' : ''}">
```

Getönte Fläche 6 % + 1px-Umriss mit `outline-offset: -1px`. `outline` statt
`border` ist Absicht: ein Rahmen ändert die Box, also müsste der nicht-aktive
Zustand einen transparenten Rahmen gleicher Breite tragen — genau die Kopplung,
aus der die beiden Befunde oben überhaupt entstanden sind. Die Werte sind aus
den drei Prototypen gemessen, nicht gewählt.

## Zwei Dungeon-Stellen, die KEINE Befunde sind (vor dem Schärfen lesen)

`-88` hat `components/dungeon/**` auf alle vier Formen geprüft: sauber, bis auf
zwei Stellen, die bewusst so sind und bleiben:

* eine **Eck-Dreiecksmarke** für einmalige Fähigkeiten (`border-top: 9px solid` +
  `border-right: 9px transparent`) — das ist die klassische CSS-Ecke, eine
  Dreiecksgeometrie, kein Kantenstreifen;
* die **gestrichelte 1px-Grenze der Boss-Tiefe** im Tiefen-Gauge, die README
  §4.2 ausdrücklich verlangt.

Wer das Tor schärft, nimmt beide vorher in die Ausnahmen — sonst diskutieren
zwei Sitzungen dieselben zwei Zeilen zweimal.
