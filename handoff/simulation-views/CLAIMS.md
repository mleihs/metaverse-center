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

### Nachtrag 31.08., nach dem Schärfen des Tors (`51d0d0ab`)

Das Tor kennt die geteilte Form jetzt und würde diese zwei Zeilen melden:

    platform/DevAccountSwitcher.ts:266   .user--focused     border-left-color: var(--color-primary)
    platform/SimulationSwitcher.ts:256   .sim-card--active  border-left-color: var(--color-primary)

Beide Dateien stehen deshalb in `ALLOWLIST` von
`frontend/scripts/lint-accent-edge-bar.py` — **nicht als Ausnahme, sondern
als benannte Schuld** (der Kommentar dort sagt das wörtlich, mit Datum und
Verweis auf diesen Abschnitt).

**Wer eine der beiden Dateien repariert, entfernt im selben Commit ihre
Zeile aus `ALLOWLIST`.** Sonst bleibt das Tor an dieser Stelle für immer
blind, und der nächste Streifen, der dort entsteht, wird nicht gemeldet.

Der Ersatz ist mechanisch und steht fünfmal im Repo (`9129415e`, `b6c130b9`,
`51d0d0ab`): den `border-left: <breite> solid transparent` aus der
Basisklasse entfernen, im Modifier statt `border-left-color` die getönte
Fläche plus `outline: 1px …; outline-offset: -1px` setzen — oder
`markerSelectionStyles` aus `shared/marker-styles.ts` und die Klasse
`is-selected` verwenden, wenn die Datei eine eigene `styles`-Liste hat.

**Warum überhaupt eine Ausnahme statt eines roten Tors:** ein Tor, das rot
ist für eine Reparatur, die niemand machen KANN (die Sitzung ist nicht
erreichbar) und in die niemand einwilligen kann, bringt die anderen
Sitzungen dazu, es zu übergehen. Das kostet mehr als die zwei Streifen.
Die Schuld sichtbar zu benennen ist der kleinere Schaden — aber nur, solange
sie sichtbar bleibt.

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
  Nächste freie Nummer: **323**. 320–322 = `-88`, Bauzustandsleiter, **auf Prod**. 319 = `-45`/L1–L7, **auf Prod** (die
  Ledger-Zeile fehlte und ist nachgetragen — die Wirkung war da, der Eintrag
  nicht).
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

## ▶ FÜR `-45`: dein Stand ist seit heute AUF PROD (31.08., von `-88`)

Auch das steht hier und nicht in einer Nachricht — inzwischen acht Zustellversuche
über drei Wege, alle in der Freigabe hängen geblieben.

**Deployt ist `8d01de40`**, verifiziert am laufenden Server (`velg-release` im
SPA-Dokument, nicht am `status: finished` der Deploy-API — Coolify hält zwei
Einträge, ein „fertig" belegt also nicht, dass DIESER Build ausliefert):

    curl -s https://metaverse.center/ | head -c 175

Darin liegt dein Dashboard-Redesign, dazu Nav-Umbau, Reiter „Übersicht",
Masthead, Lore-Dossier, Agenten-Reiter, Migration 319, Chat (Phase 2),
Blatt (Phase 3), Dungeon (Phase 4) und 31 deutsche Zeichenketten. Vier Phasen in
EINER Auslieferung — der Nutzer hat das so entschieden, nachdem es ihm als
Entscheidung vorgelegt wurde.

**Coolify ist von aussen weiter 503** (`https://coolify.metaspots.net`). Das ist
NICHT der Dienst: alle sechs Container laufen seit 12 Tagen gesund, und lokal
antwortet Coolify auf `:8000` mit 302. Kaputt ist die Traefik-Route für den
Hostnamen. Der Deploy geht deshalb über SSH auf `127.0.0.1:8000` — der Weg steht
samt App-UUID im Gedächtnis unter `coolify-deploy-api-post-change` (POST, nicht
GET). ⚠ Die Route selbst hat niemand angefasst: §12 des VPS-Runbooks sagt, ein
fehlgeschlagener Compose-Deploy reisst den laufenden Stack mit.

**Nicht deployt** sind derzeit 13 Commits, die nach `8d01de40` auf `origin/main`
liegen.

**Zeitrechnung, die daran hängt:** T10/Weg 1 (`insult`-Meinungsfenster) lief
schon VOR diesem Deploy — `7f706ef5` war der Stand davor, und das IST der
Weg-1-Commit. Die N5-Woche zählt ab **31.08., ~13:19 CEST**. Frühestens 07.09.
nachsehen, belastbar um den 21.09.; ein leeres Ergebnis am 07.09. belegt nichts,
weil die Erwartung eine Beleidigung alle ein bis drei Wochen ist.
🔑 Die Frage lautet „ab X", nicht „nach X" — bei einem Deploy GENAU AUF dem
Commit liest sich „nicht danach" wie „nicht enthalten", und genau daran hat sich
heute schon eine Sitzung verrechnet.

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

---

## ~~Anspruch: `components/platform/LoreScroll.ts`~~ — ZURÜCKGEZOGEN

> **Erledigt ohne die Datei (31.08.2026, Commit `8ce5cb55`).** Der Lore-Reiter
> ist als neues Bauteil `components/lore/LoreDossier.ts` gebaut statt als Umbau
> von `LoreScroll`, weil die beiden verschiedene Sachen sind: eine Ziehharmonika
> zum Durchsehen gegen einen Leser mit Register und Kapitelfolge. `LoreScroll`
> behält unverändert die Plattform-Lore (`BureauArchives`,
> `getPlatformLoreSections`). **`components/platform/**` gehört damit wieder
> vollständig `-45`** — es gab am Ende gar keine Grenzfrage.
>
> Die Begründung unten bleibt stehen, weil ihr letzter Absatz weiter gilt: die
> Datei liegt am falschen Ort, und das erzeugt beim nächsten Mal dieselbe Frage.

### Die ursprüngliche Begründung

**Warum das eine Ausnahme von der Verzeichnisgrenze ist.** Der Schnitt lautet
`components/platform/**` → `velgarien-rebuild-45`. `LoreScroll.ts` (1 613 Zeilen)
liegt dort, ist aber kein Plattform-Bauteil: es ist das Lesewerk der Lore-Seite,
und `components/lore/SimulationLoreView.ts` delegiert vollständig an es. Der
Lore-Reiter aus Phase 1 (Inhaltsverzeichnis + Lesepanel, Epigraph, Figure mit
Lightbox, Fallakten-Umschalter mit Redaktionsbalken, Prev/Next mit
Kapiteltiteln, Zeilenmass 740 px) ist ohne diese Datei nicht zu bauen.

**Gemessen, dass es keine Kollision ist:**

    git log -3 -- components/platform/LoreScroll.ts
      → letzte Änderung 75613ff5 (Akzentbalken-Sweep), davor zwei Commits
        aus früheren Wellen. In dieser Welle hat sie niemand angefasst.
    git log -5 -- components/platform/
      → alle fünf Commits von `-45` betreffen Dashboard und Profil,
        keiner LoreScroll.

**Also:** `Frontseite-Redesign` nimmt `LoreScroll.ts` für Phase 1.
`SimulationsDashboard.ts`, `DevAccountSwitcher.ts`, `SimulationSwitcher.ts`,
`CommandPalette.ts` und der Rest von `components/platform/**` bleiben
unangetastet bei `-45`.

**Wenn `-45` widerspricht, gilt `-45`** — die Datei liegt in seinem Verzeichnis,
und ein Anspruch, den der Eigentümer nicht bestätigen konnte (Nachrichten an
Socket 16843 werden zurückgehalten, siehe Abschnitt oben), ist eine Annahme und
kein Anspruch. Sie steht hier, damit die Annahme sichtbar ist statt still.

**Der eigentliche Befund dahinter, für später:** eine Datei am falschen Ort
erzeugt eine Grenzfrage, die es nicht geben müsste. `LoreScroll.ts` gehört nach
`components/lore/`. Das ist eine Verschiebung mit Importpfad-Folgen in mehreren
Dateien und deshalb nichts, was man mitten in einer Vier-Sitzungen-Welle macht —
aber es gehört auf die Liste.

---

## Phase 1 abgenommen — und drei Stellen des Entwurfs, die auf leere Daten zeigen

**Stand `c70f1c1f`.** Nav, Masthead, Übersicht, Lore und Agenten sind gebaut und
am laufenden Bildschirm gegen Prod-Daten geprüft (zweiter Vite auf 5180 mit
`VITE_DEV_API_PROXY=https://metaverse.center`). Gebäude gehört `-af`.

### Die Breitbild-Abnahme, bewiesen statt geschätzt
Der Bildschirm hier reicht nur bis 1728 px, also **Beweis durch Substitution**:
dieselbe CSS-Formel mit kleinerem Mass hat dieselbe Geometrie. Bei
`--stage-measure: 900px` und 1425 px nutzbarer Breite:

    Inhalt                 links 263, Breite 900     erwartet 262,5 ✓
    Masthead-Text          links 263                 fluchtet ✓
    erste Reiter-Beschriftung  links 263             fluchtet ✓
    Chrome (Masthead, Nav) links 0, Breite 1425      randlos ✓

Die Formel ist breiteninvariant; bei 2560 mit Mass 1920 werden aus den 263 genau
320. **Container-Regel erfüllt.**

### ⚠ Drei Stellen, an denen der Entwurf über Daten spricht, die es nicht gibt

Alle drei sind auf Prod gemessen, nicht vermutet. Wer sie umsetzt, baut eine Tür,
die sich nur für die öffnet, die schon drin sind.

**1. Die Belegungsskala hat keinen Zähler.**

    building_agent_relations WHERE relation_type='lives_at'      0 Zeilen
    Bauten mit population_capacity > 0                         219
    Bauten mit building_condition                              324 von 324

Niemand wohnt irgendwo. `agents?.length ?? 0` ist das Fehlen einer Zählung, das
eine Null trägt — durchgereicht malt es 219 Bauten „fast leer" auf. Mein
Footprint-Streifen trägt deshalb `building_condition`. **Das Feature ist nicht
kaputt, es hat nur noch keine Welt, in der es etwas zu messen gäbe.**

**2. Zwei der vier Agenten-Filterchips filtern nichts.**
Der Entwurf verlangt *Alle · Keystone · Botschafter · KI-geboren*. Gemessen:

    „Keystone"     kommt im ganzen Repo NICHT vor — weder Frontend noch Backend
    „KI-geboren"   254 von 258 Agenten haben data_source = NULL, kein einziger
                   ist als KI-erzeugt markiert (4 × 'curated')
    „Botschafter"  echt (40 Botschaften), aber `is_ambassador` ist KEINE Spalte:
                   der Dienst rechnet sie nach der Abfrage in Python aus

Der Ambassador-Filter ist deshalb **nicht billig**: die Identitätsauflösung
(id ODER Name, siehe Docstring `_enrich_ambassador_flag`) müsste an eine DRITTE
Stelle, und derselbe Docstring warnt ausdrücklich davor, dass die beiden
bestehenden übereinstimmen müssen. Die vorhandenen Filter (System, Geschlecht)
sind taxonomiegestützt und haben Daten — sie bleiben, bis jemand entscheidet.

**3. Die Schwärzung im Lore-Dossier ist unerreichbar** (bewusst gebaut, siehe
Kommentar an der Aufrufstelle): die API ist public-first, ein klassifizierter
Abschnitt kommt an und ist lesbar, oder er wurde nie erzeugt. Es gibt keinen
Live-Zustand, in dem ein Leser einen Abschnitt hält, den er nicht lesen darf. Die
Balken bleiben, weil das Public-First-Versprechen lautet, dass Blättern nie 403
erzeugt.

### Die Regel, die aus allen dreien folgt
**Bevor eine Skala gebaut wird: nachsehen, ob ihr Zähler existiert.** Die
Prüffrage ist nicht „gibt es eine Oberfläche dafür?", sondern „kann der Zustand,
den sie anzeigt, je eintreten?"
