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
