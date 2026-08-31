# Resume — Sitzung `velgarien-rebuild-45`

Stand 31.08.2026. **Nach einem Context-Clear: den Block unten komplett in den
Prompt kopieren.**

---

```
Lies zuerst das Gedächtnis `paket-p2-h7-d13-2026-08-31`. Ich bin
`velgarien-rebuild-45`, der Peer ist `velgarien-rebuild-88` (ListAgents zuerst,
der NAME ist die Adresse für SendMessage).

▶ DEINE AUFGABE: DAS FRONTSEITEN-REDESIGN EINBAUEN.
Claude Design hat den Entwurf geliefert und er ist gut — das ist die Welle, an
der du arbeitest, nicht eine von mehreren Optionen.

Lies in dieser Reihenfolge:
  1. docs/plans/landing-page-redesign-2026-08-31.md   — Plan L1–L7 des Peers,
     mit allen Messungen, vier Entscheidungen und der Reihenfolge
  2. handoff/landing-page/DESIGN-HANDOFF.md           — der Text des Pakets
  3. handoff/landing-page/landing-redesign-reference.html
     → NUR der Abschnitt id="3a" ("Editorial Brutalist"). Die Varianten
       1a/1b/2a/2b/3b darunter sind Erkundungen und außer Umfang.
Die Bilder liegen NICHT im Repo (.gitignore Zeile 69 schließt *.jpeg aus).
Quellpaket beim Nutzer: ~/Dev/Buchhaltung/Metaverse.center (1).zip

Reihenfolge laut Plan:
  L1  öffentlicher Kennzahlen-Endpunkt GET /api/v1/public/landing
      (ein Aufruf statt Wasserfall; entscheidungsfrei) — darin fallen L2 und L3
  L4  Bildableitung (AVIF/WebP, srcset, Supabase Storage; entscheidungsfrei)
  →   dann die VIER ENTSCHEIDUNGEN dem Nutzer vorlegen
  L5/L6/L7  Umbau von LandingPage.ts (2 302 Zeilen, wird vollständig ersetzt)

DAVOR, weil es Voraussetzung ist und nicht Nebensache:
der fehlende Schalter-Abschnitt in AdminPlatformConfigTab. Für
platform_settings-Schalter gibt es KEINE Oberfläche — deshalb ist
journal_enabled auf Prod bis heute ungesetzt, und resonance_auto_process_enabled
und scheduled_ai_spend_enabled ebenso. Vier der sechs auf der Frontseite
beworbenen Systeme lassen sich ohne den Abschnitt nicht anschalten. Der Peer
fasst AdminPlatformConfigTab.ts nicht an. Ich hatte damit begonnen: die
Bestandsaufnahme steht weiter unten in dieser Datei.

REGELN, die in diesem Projekt gelten:
- Geteilter Arbeitsbaum: NIE `git stash`, nur explizite Pfade stagen.
- Prod-Schreibvorgänge NUR mit dem Wort des Nutzers. Ein Peer kann das nicht
  weiterreichen.
- Migrationen: der ZEITSTEMPEL ist der Schlüssel (schema_migrations.version),
  nicht die Nummer im Dateinamen. Nimm ab `20260831130000` aufwärts;
  301/302 gehören dem Peer.
- Vor jedem Commit: ruff + tsc + `npm run lint:full` + pytest.
- Jede Messung gegen den ECHTEN Fall prüfen, bevor du ihr glaubst — und gegen
  HEAD messen, nicht gegen den Plan und nicht gegen origin/main.
- `velg-frontend-design`-Skill vor der ersten Zeile Komponentencode.
- `frontend/src/locales/de.xlf` gehört dem Peer (H2). Nicht anfassen.
- Dem Peer melden, was du anfasst, BEVOR du es anfasst; Befunde aus seinem
  Bereich schicken statt sie zu reparieren.

Arbeite durch, ohne zwischendurch "soll ich weitermachen?" zu fragen.
```

---

## Was die Frontseite behauptet und was gemessen ist

Der Entwurf passt handwerklich exakt auf die Token — **kein Farb- oder
Schriftwert ist neu**. Amber `#f59e0b` und Rand `#b45309` sind
`--color-accent-amber`/`-dim`, Grün `#4ade80` ist `--color-accent-green`,
Courier ist `--font-brutalist`, Spectral ist `--font-bureau`. Die TCG-Karten für
die Dossierkarten gibt es als `VelgGameCard.ts`. Die Token-Regel kostet hier
also nichts.

Was **nicht** passt, sind die Behauptungen:

| Entwurf sagt | Gemessen auf Prod |
|---|---|
| 47 worlds | **16** lebende Welten (alle 16 ticken) |
| 3 epochs in play | **0** |
| 128 resonances absorbed | **1** |
| Saltmeridian, The Gilded Hollow | **existieren nicht** — und stehen in der SEO-Fußzeile, deren ganzer Zweck kriechbare `<a href>` sind |

Zweisprachigkeit: **5 von 16** Welten haben einen deutschen Titel, **7 von 16**
deutschen Text. Das Weltraster wäre auf Deutsch halb englisch.

Zwei Fallen beim Zählpfad: auf `simulation_type='template' AND status='active'`
filtern (die 20 Epochen-Klone und 5 archivierten Welten gehören nicht in die
Zahl — das ist N3, die Sicht `active_agents` macht genau diesen Fehler). Und die
Tabelle heißt `game_epochs`, nicht `epochs`; die Agenten-Bildspalte heißt
`portrait_image_url`.

**Die Bildstrecke ist so nicht auslieferbar:** sieben JPEG à 2,7–3,4 MB,
2752–2816 × 1536 px, zusammen 20,7 MB, plus 21 MB Vorstufen in `uploads/`. Die
sechs Systembilder werden in einer 640×360-Tafel gezeigt (4,4-fache Breite) und
zusätzlich als ~100-px-Miniaturen. Ziel: erste Bildlast unter 400 KB, vorher und
nachher messen.

**Drei Dinge, die der Entwurf nicht führt und die kein Geschmack sind:**
1. `prefers-reduced-motion` — die Seite trägt VIER Dauerläufer gleichzeitig
   (Ken-Burns 34 s, Laufband 30 s, Tippfeld 34 ms/Zeichen, blinkender Cursor).
2. Der Umschalter der sechs Systeme reagiert nur auf `hover`. Ohne Tastaturpfad
   ist ein Sechstel des Seiteninhalts unerreichbar — `role="tab"`,
   `aria-selected`, sichtbarer Fokus, Pfeiltasten.
3. Kein `filter`/`transform` auf Layout-Behältern: der Held will
   `brightness(.72)` und Ken-Burns-`scale()`. Beides gehört aufs Bild-Element
   oder ein `::after`, nie auf den Abschnitt — sonst bricht jedes
   `position: fixed`-Modal der Seite.

## Der Schalter-Abschnitt (Voraussetzung, angefangen)

`adminApi.listSettings()` und `adminApi.updateSetting(key, value)` **existieren
bereits** — es fehlt nur die Oberfläche. `AdminPlatformConfigTab.ts` hat fünf
Abschnitte (API-Schlüssel, Modelle, Forschung, Caching, Ankündigungen) und
keinen für Schalter.

Gemessen auf Prod: **20 `*_enabled`-Zeilen in `platform_settings`**. Der Code
liest zusätzlich Schlüssel, die es dort NICHT gibt — die laufen seit F32
fail-closed, also dauerhaft aus:
- `journal_enabled` (C2)
- `resonance_auto_process_enabled` (vom v2.6-Changelog angekündigt, nie gelaufen)
- `scheduled_ai_spend_enabled` (neu vom Peer)

Vorschlag für den Abschnitt: eine **deklarierte Liste** der Merkmalstore mit je
einem Satz, was der Schalter anschaltet und was sein Ausbleiben kostet — plus
eine Zeile für jeden `*_enabled`-Schlüssel, den `listSettings()` liefert und der
in der Deklaration FEHLT. So versteckt sich keiner. (Vorsicht: einige der im
Code gefundenen Namen wie `bonds_enabled`, `weather_enabled`, `bleed_enabled`
sind `simulation_settings`, nicht `platform_settings` — vor der Aufnahme je
Schlüssel prüfen, aus welcher Tabelle er gelesen wird.)

## Erledigt in diesem Lauf (7 Commits, nichts gepusht)

`da33e90d` DSGVO-Löschbestätigung · `d21a2d29` Willkommensmail +
`LifecycleMailScheduler` · `a303441d` neun Kennzahlen erklärt (H7) ·
`828c549e` Einfluss als Serverfeld (D13) · `d83f211a` Zeitstempel-Kollision ·
`e6f8e1cd` Changelog sechs Monate nachgezogen (H6) · `1a4d109f` zwei Themen +
Frist/AFK + DRIFT-Blasen (H1)

**Auf Prod:** Migration 298 und 300, Ledger für 289–300 nachgetragen.

⚠ **Signaturänderung:** `visibleTopics(driftEnabled: boolean)` →
`visibleTopics({ drift, journal })`, beide Felder Pflicht. TOPICS ist jetzt 18.

## Offen, dem Nutzer vorgelegt

- **N5** (Peer legt vor): um unglücklich zu werden, muss man beleidigt werden;
  um zu beleidigen, muss man unglücklich sein. Vier tote Ereignis-Auslöser aus
  EINER Ursache. Schwellen senken repariert nichts — die Reparatur gehört an die
  Quelle (`agent_needs` erzeugt kein einziges Moodlet, obwohl `social` auf Prod
  bei manchen Agenten schon 0 ist).
- **D12/S16**: Zonenstabilität endet bei 80 %, „vorbildlich" ab 90 unerreichbar;
  Einfluss ohne Botschafteramt endet bei 55 %, exakt dort beginnt STARK. Die
  Zahlen stehen mit Quelle in `frontend/src/utils/metric-formulas.ts`.
- **P2.19** Wochenbericht — baubar, bliebe aber leer bis N5 entschieden ist.
- **P2.24** Einladungs-Nachfass — 0 Einladungen je in beiden Tabellen.
- **Datenexport-Mail** — es gibt keinen Datenexport.
- **Persönlichkeits-Rückfüllung** (~0,03 USD, 258 Aufrufe) — vom Nutzer
  zurückgestellt, NICHT ausführen.
