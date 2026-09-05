# HIER STARTEN — Bildspur im Gespräch (05.09.2026, Abend)

Ein Tag an der Bilderzeugung aus dem Chat. **Der Motor steht und ist gemessen;
die Bedienung fehlt** — deshalb ist die Erwachsenenspur bauartbedingt
unerreichbar, und deshalb hat der Betreiber ein Bild bekommen, das nicht zur
Szene passte.

Kein Gesprächsinhalt in dieser Datei (CLAUDE.md, öffentliches Repo) — Messwerte
und Formen. Erfundene Figuren, wo Beispiele nötig sind: Marie Morgenrot, Benno
Blattgold, Suse Sonnenblum, Doktor Freundlich.

---

## 0. Lage in fünf Zeilen

| | |
|---|---|
| HEAD | `f763a455` |
| Auf Prod läuft | `f44e35f8` — **fünf Commits hinterher**, Migration 382 nicht angewandt |
| CI | rot, nur noch `chat_conversation_digest/de+en` (Migration 373, Nachbarsitzung) |
| `image_models_mature` | auf Prod gesetzt: `scene → datacte/proteus-v0.2`, `agent_portrait → asiryan/juggernaut-xl-v7`, `fallback → proteus` |
| Geteilter Baum | eine Nachbarsitzung arbeitet im selben Verzeichnis, uncommittete Dateien von ihr liegen herum |

---

## 1. DER BEFUND, aus dem alles Offene folgt

Der Betreiber hat ein Szenenbild in einem Faden mit 586 Nachrichten erzeugt.
Ergebnis: **das Bild passte nicht zur Szene, die Erwachsenenstufe griff nicht.**
An der erzeugten Zeile auf Prod nachgemessen:

```
span        round        ← der Schnitt war RICHTIG (Menschenzeile + 3 Züge,
vantage     human           group_turn_index 0/1/2)
rating      general      ← und hier stirbt es
references  3
model       black-forest-labs/flux-2-pro   safety_tolerance 2
```

Auch die Übersetzung ins Bildprompt war richtig — sie hat die Szene wörtlich
genommen. Dann ging dieses Prompt an ein Modell, das beim Anbieter filtert.

**Flux hat nicht abgelehnt. Es hat die Szene durch eine andere ersetzt.**
Gleiche Personenzahl, harmloser Kontext, nichts von dem, was bestellt war. Ein
plausibles Bild, ein anderer Inhalt, kein Fehler, keine Meldung.

(Was in der Szene stand, gehört nicht hierher und steht nirgends im Repo. Für
den Befund genügt die Form: Prompt korrekt, Modell falsch gewählt, Ausgabe
still ersetzt.)

Das ist die Fehlerklasse des ganzen Tages, diesmal beim Anbieter: **eine stille
Ersetzung sieht aus wie ein Erfolg.**

---

## 2. WARUM `rating` nie etwas anderes als `general` wird

Gemessen, nicht vermutet:

```
grep -rn "image_content_preference|scene_image_vantage" frontend/src   →  0 Treffer
```

* `ChatComposer._requestScene` schickt `{ span: 'round' }`, sonst nichts.
* `SceneImageRequest.rating` (`backend/models/auth.py`) steht auf `"general"`.
* Selbst wenn der Client `mature` schickte: `SceneImageService.generate` rechnet
  `resolve_rating(nutzer_wunsch=…, angefragt=…)` = **Minimum**, und der Wunsch
  kommt aus `user_profiles.image_content_preference` — wofür es ebenfalls keine
  Bedienung gibt, also steht er auf `general`.

Der Motor ist vollständig und geprüft (`test_mature_lane.py`,
`test_image_content_policy.py`, `test_image_model_families.py`), die Spur ist auf
Prod konfiguriert und im Container nachgemessen. **Nur der Schalter fehlt.**

### Die Logik, wenn es ihn gibt

```
Weltvorgabe  ──► Vorschlag (NUR Vorgabe, KEINE Decke)
Nutzerwunsch ──► user_profiles.image_content_preference
Anfrage      ──► rating im Aufruf
                        │
              wirksam = min(Wunsch, Anfrage)
                        │
     general ─► flux-2-pro,  safety_tolerance 2      (Anbieter filtert)
     mature  ─► proteus / juggernaut, disable_safety_checker = true
```

Der Blick (`vantage`) ist **kein** Minimum: dort gewinnt, wer zuletzt gewählt
hat. Die Totale ist nicht gefährlicher als der Leserblick, nur anders.

---

## 3. DIE OFFENEN PUNKTE

### P0 — ZUERST: die zwei Vergleichsbilder nachholen

> **Das ist der erste Schritt nach einem Kontextverlust.** Ausdrücklicher
> Auftrag des Betreibers, und alles andere hängt davon ab, ob die Spur wirklich
> trägt.

Auftrag des Betreibers: dieselbe Runde noch einmal, **mit proteus UND
juggernaut zum Vergleich**, und die Ergebnisse direkt in den Chat einspielen.

Der erste Versuch lief auf 404 — das war der Fund aus `f763a455`, siehe unten.
Der Fix ist committet, aber **nicht deployt**. Skript liegt unter
`$CLAUDE_JOB_DIR/tmp/nachholen.py` (Sitzung weg → neu schreiben, es ist kurz):
Wunsch des Nutzers auf `mature` setzen, `image_models_mature.scene` je Lauf
umstellen, `SceneImageService.generate(rating=MATURE)` aufrufen, Spur
zurückstellen. Faden `7b2e37c3-46ab-423c-ab18-ed54c6428dc2`.

**Erst deployen, dann laufen lassen** — sonst wieder 404.

### P1 — Der Schalter (der eigentliche Blocker)

| Was | Wo | Spalte |
|---|---|---|
| Inhaltsstufe des Nutzers | Kontoeinstellungen | `user_profiles.image_content_preference` |
| Blick (Vorgabe) | Kontoeinstellungen | `user_profiles.scene_image_vantage` |
| Stufe/Blick für DIESES Bild | am Auslöser im Verfasser | `rating` / `vantage` im Aufruf |

Auslöser ist `.composer__scene` in `ChatComposer.ts`. Für die Wahl am einzelnen
Bild gibt es `<velg-hold-button>` und `<velg-tooltip>`.

### P2 — Löschen (ausdrücklich gewünscht)

Gemessen:

* Ablage: `simulation.assets/chat/{conversation_id}/{uuid}.avif`
  **plus** `{uuid}.full.avif` (native Auflösung).
* Einzelnes Bild löschen: **gibt es nicht**, keine Route.
* Faden löschen (`ChatService.delete_conversation`): löscht Zeilen per CASCADE,
  **fasst den Speicher nicht an** → verwaiste Dateien für immer.

Zu bauen: ein Löschknopf am Bild im Faden, der Zeile UND **beide** Dateien
entfernt; und `delete_conversation` muss die Dateien des Fadens mitnehmen.

### P3 — Rückmeldung, wenn der Anbieter umgeschrieben hat

Ohne Hinweis sieht ein ersetztes Bild aus wie ein gelungenes (§1). Mögliche
Form: die wirksame Stufe an der Bildunterschrift nennen — sie steht schon in
`metadata.scene_image.rating`.

**⛔ Keine Klassifizierung der AUSGABE bauen.** Ausdrücklich abgelehnt, in
deutlichen Worten und ohne Einschränkung. Es geht um eine Auskunft, nicht um
eine Prüfung.

### P4 — Die Mikroanimation am Auslöser

Als zu unruhig beanstandet. Aktuell: Passermarken
(`marker-corners--tight`) belichten, Arm 8 → 15 px, 1200 ms, Amber-Rahmen,
gedimmtes Sinnbild. **Ruhiger machen.** Die Ruhedarstellung NICHT anfassen —
sie ist gerade erst repariert (`677bab7a`).

### P5 — CI grün machen

```
chat_conversation_digest/de    prompt_content
chat_conversation_digest/en    prompt_content
```

`scripts/lint-seed-carries-migration-effects.sh` spielt jedes
`UPDATE … prompt_templates … simulation_id IS NULL` aus allen Migrationen gegen
die fertige Datenbank nach. Die zwei Zeilen stammen aus Migration 373 einer
Nachbarsitzung. **Fix laut Tor:** Endtext nach
`supabase/seed/006_prompt_templates.sql` zurückportieren.

### P6 — Deployen

Fünf Commits liegen ungedeployt: `a23e5f44`, `5cefb226`, `677bab7a` (Frontend!),
`f763a455` und was die Nachbarsitzung dazwischen gepusht hat.

---

## 4. ⛔ STEHENDE VORGABEN DES BETREIBERS

* **Keine Altersfeststellung.** Österreich. Zweimal ausdrücklich abgelehnt, die
  Spalten wurden entfernt und eine Migration prüft ihre Abwesenheit. Nicht
  wieder vorschlagen.
* **Keine Verifizierungs-/Klassifizierungsmaschinerie** für Modellausgaben.
* **Keine Bevormundung der Nutzer** — nachdrücklich und unmissverständlich
  festgehalten. Die Weltstufe ist eine Vorgabe, keine Decke. Ein erster Entwurf
  machte sie zur harten Grenze — das war der Fehler.
* **Kein Gesprächs-Wortlaut im Repo.** Nicht in Code, Kommentar, Test, Migration
  oder Commit-Nachricht. Tor: `scripts/lint-no-chat-content.sh`.
* Durcharbeiten ohne Rückfragen, Zwischenstände melden.

---

## 5. Was fertig ist (nicht neu bauen)

| Commit | Inhalt |
|---|---|
| `cd9d71d8` | Szenenbild-Pfad: Runde als Einheit, Prompt-Vertrag, Anzeige im Faden |
| `57b16406` | Familientabelle gegen 8 echte Replicate-Schemata; Scheduler fliegt raus |
| `198704e3` | Sicherheitstoleranz kommt aus den Einstellungen statt aus dem Code |
| `7d5919d5` | `resolution` als Zeichenkette; AVIF→PNG für Vorlagen; img2img-Vorgabe |
| `3e58c20d` | Enum-Werte geprüft (`stable-diffusion-3.5` führt kein `3:4`) |
| `3e10c10e` | Als Vorlage geht die große Fassung raus, nicht die Miniatur |
| `677bab7a` | Der Auslöser sieht endlich wie ein Knopf aus |
| `a23e5f44` | Geviertstrich raus aus Backend-Strings; Migration 382 |
| `5cefb226` | 382 fehlte `BEGIN; … COMMIT;` |
| `f763a455` | Gemeinschaftsmodelle brauchen `owner/name:fassung` |

### Die Modellrecherche ist erledigt — nicht wiederholen

Von 61 erwachsenenfähigen Modellen auf Replicate nehmen **nur sieben eine
Referenz an**. Das ist das harte Kriterium: ohne Vorlage erfindet jede Szene ein
neues Gesicht. Vier davon mit identischem Prompt durchgelaufen und angesehen:

| Modell | Läufe | Urteil |
|---|---|---|
| `datacte/proteus-v0.2` | 12,7 M | erzählte Szene, richtiges Register → `scene` |
| `asiryan/juggernaut-xl-v7` | 692 K | sauberer Fotorealismus für Gesichter → `agent_portrait` |
| `delta-lock/ponynai3` | 926 K | Anime — falsches Register für diese Plattform |
| `asiryan/reliberate-v3` | 2,45 M | Schaufensterpuppen statt Figuren bei 768×1024 |

Wird ein anderes Modell geprüft: erst das Schema lesen
(`api.replicate.com/v1/models/<m>`), **dann einen echten Aufruf machen**. Ein
Schemavergleich allein findet keinen falschen Enum-Wert.

---

## 6. DIE LEHREN DES TAGES (die den nächsten Fehler verhindern)

**Replicate verwirft ein UNBEKANNTES Feld still — ein BEKANNTES mit falschem
Typ oder Enum-Wert tötet den ganzen Aufruf mit 422.** Daraus folgt die ganze
Bauart von `image_model_families.py`: wo der Feldname zwischen Modellen
schwankt und nicht zu raten ist, gehen beide Schreibweisen raus (`strength` und
`prompt_strength`); wo ein WERT aus einem Enum kommt, geht lieber gar nichts
raus und das Modell nimmt seine eigene Vorgabe (deshalb kein `scheduler`).

**Ein Schemavergleich reicht nicht.** Vier der heutigen Funde standen im Schema
und waren trotzdem falsch — der Scheduler-Enum, `resolution=1` statt `"1 MP"`,
AVIF als Referenzformat, und der 404 ohne Fassungsangabe. Alle vier fand erst
ein echter Aufruf.

**Eine spätere Migration kann eine frühere aufheben, und niemand merkt es, weil
beide für sich richtig sind.** Migration 351 entfernte den Geviertstrich; 359,
373 und 380 fügten ihn danach wieder ein. Gefunden hat es ein Tor, das für eine
andere Frage gebaut war.

**`.env` zeigt auf `127.0.0.1:54321`, NICHT auf Prod.** Ich habe darüber eine
Einstellung „auf Produktion" geschrieben, zurückgelesen, bestätigt — sie stand
lokal. Prod-Zugangsdaten: `~/.config/metaspots/velgarien-coolify.env`.

**Ein übersprungener Test sieht aus wie ein bestandener, wenn man nur `$?`
liest.** `lint-seed-carries-migration-effects.sh` schreibt ohne `psql` ein
sprechendes `SKIP:` und dann Exit 0 — ich hatte die Ausgabe mit `>/dev/null`
unterdrückt und es für ein defektes Tor gehalten.

**Eine Migration mit `CREATE TEMP TABLE … ON COMMIT DROP` braucht
`BEGIN; … COMMIT;`.** `psql -f` schreibt sonst jede Anweisung einzeln fest und
die Temp-Tabelle ist vor dem DO-Block weg.

**Eine Selbstprüfung in einer Migration gilt der eigenen WIRKUNG, nie dem
Inhalt der Plattform** — und wenn sie nichts zu prüfen fand, sagt sie es per
`RAISE NOTICE`, statt grün zu schweigen. Und: eine Gegenprobe machen (dieselbe
Datei mit ausgehebelter Wirkung muss FEHLSCHLAGEN), sonst ist „grün" nur eine
Behauptung.

**Ein Bedienelement, das die Grammatik seines Designsatzes verletzt, ist
unsichtbar, auch wenn es gerendert ist.** Der Szenen-Auslöser hatte 1px Rahmen,
keinen Grund, keinen Schatten, während seine Nachbarn 3px/2px, opaken Grund und
Hartschatten trugen — in diesem Satz die Schreibweise für „inaktiv".

**Ein Backtick in einem `css`-Kommentar beendet das Template.** Kostet sofort
einen tsc-Fehler an einer Stelle, die nichts damit zu tun hat.

---

## 7. Werkzeug

```bash
# Prod-Zugangsdaten (NICHT .env!)
set -a; . ~/.config/metaspots/velgarien-coolify.env; set +a

# gegen den AUSGEROLLTEN Stand messen (PYTHONPATH ist nötig)
C=$(ssh metaspots "docker ps --filter name=a6exg3b5euhidpc2r5009o0m -q" | head -1)
ssh metaspots "docker exec -i $C sh -c 'cat > /tmp/x.py'" < skript.py
ssh metaspots "docker exec $C sh -c 'cd /app && PYTHONPATH=/app python /tmp/x.py'"

# Deploy — es gibt KEIN Auto-Deploy auf Push
TOKEN=$(cat ~/.config/metaspots/coolify-api.token)
ssh metaspots "curl -s -X POST 'http://127.0.0.1:8000/api/v1/deploy?uuid=a6exg3b5euhidpc2r5009o0m' \
  -H 'Authorization: Bearer $TOKEN'"
# Status: GET /api/v1/deployments/<uuid> → in_progress → finished
# Welcher Commit läuft: docker ps → Image-Tag IST der SHA

# eine Migration proben, BEVOR sie geschickt wird
docker exec supabase_db_oeaw-press-release psql -U postgres -d postgres -c "CREATE DATABASE probe;"
docker exec -i supabase_db_oeaw-press-release psql -U postgres -d probe \
  -v ON_ERROR_STOP=1 -q -f - < supabase/migrations/<datei>.sql
```

**Geteilter Baum:** `git status` vor JEDEM `git add`. Einzelne Zeilen aus einer
fremden Datei committen, ohne den Arbeitsbaum anzufassen:

```bash
git show HEAD:pfad > tmp && <ändern> && h=$(git hash-object -w tmp)
git update-index --cacheinfo "100644,$h,pfad"
```

Die Nachbarsitzung erreicht man über `SendMessage` an
`uds:/tmp/cc-socks/20152.sock` (Name: `fix-group-chat-speaker-mixing`). Sie hat
heute am Gedächtnis gearbeitet (Migrationen 373, 376, 378, 379, 381, 383) und
liegt uncommittet im Baum — der rote Test `test_heartbeat_entry_types` gehört
ihr, nicht uns.
