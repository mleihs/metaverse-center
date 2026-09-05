# HIER STARTEN — Bildspur im Gespräch (05.09.2026, Nacht)

Der Motor stand seit gestern und war gemessen. Heute kam heraus, **warum die
Bilder trotzdem nicht die Szene trafen** — und es war nicht, was ich zuerst
diagnostiziert hatte. Alles gebaut, nichts ausgerollt.

Kein Gesprächsinhalt in dieser Datei (CLAUDE.md, öffentliches Repo) — Messwerte
und Formen. Erfundene Figuren, wo Beispiele nötig sind: Marie Morgenrot, Benno
Blattgold, Suse Sonnenblum, Doktor Freundlich.

---

## 0. Lage in fünf Zeilen

| | |
|---|---|
| HEAD | `f10a0262` |
| Auf Prod läuft | `0fd5d81a` — **acht Commits hinterher**, Migration 385 nicht angewandt |
| Deploy | ⛔ GESPERRT: eine dritte Sitzung startet den Produktionsserver neu (`apt full-upgrade` + Kernel). Erst nach ihrer Entwarnung |
| CI | war rot, Ursache lag im Tor selbst (siehe §4) — gefixt in `08e20a56` |
| Geteilter Baum | zwei Nachbarsitzungen arbeiten mit; `git status` vor JEDEM `git add` |

---

## 1. DER BEFUND — und meine erste Diagnose war falsch

Bestellt war eine Szene mit drei Figuren, geliefert wurde ein Einzelporträt.
Prompt, Schnitt und Stufe waren richtig.

**Ich habe zuerst den Negativprompt beschuldigt.** Das war plausibel und
falsch: eine Szene fiel in den Gebäude-Zweig (`neg_key = "agent" if
is_portrait else "building"` kennt nur zwei Fälle) und bekam damit
`people, humans, characters, faces` verboten — wir haben drei Figuren bestellt
und im selben Aufruf Menschen verboten.

Eine Gegenprobe am lebenden Modell zeigt: **mit und ohne diese Liste kamen
beide Male vier Personen.** Der Negativprompt war falsch, er war nicht die
Ursache. Er ist trotzdem repariert (`scene` ist jetzt ein eigener Zweck).

### Die wirkliche Ursache: `strength`

Gleicher Seed, gleicher Prompt, eine Porträtreferenz mit EINER Person:

```
0,60   Einzelporträt
0,75   Einzelporträt      ← unsere Vorgabe für JEDEN Zweck
0,90   die bestellte Szene
```

Auf `datacte/proteus-v0.2` und `asiryan/juggernaut-xl-v7` **getrennt** gemessen.
Beide Schemata sagen wörtlich dasselbe: *„1.0 corresponds to full destruction of
information in image"* — der Wert ist die Menge Rauschen, nicht das Gewicht des
Prompts. Bei 0,75 gewinnt die Vorlage.

**⚠ DER PREIS, UND ER IST DEINE ENTSCHEIDUNG:** bei 0,90 erscheint die Szene
und **das Gesicht der Referenz ist weg**. `strength` ist EIN Regler zwischen
Identität und Komposition; img2img kann nicht beides. Figurentreue in einer
Mehrpersonenszene braucht einen anderen Mechanismus (InstantID, oder Gesichter
nachträglich einsetzen) und keine andere Zahl. Steht jetzt auf 0,90, weil die
Szene zu treffen der Auftrag war — über `image_ref_strength_scene`
herunterdrehbar.

---

## 2. Vier weitere Funde, die nicht gesucht waren

**CLIP schneidet bei 77 Token ab.** Im Protokoll beider Modelle gelesen
(`194 > 77`). Von 162 Wörtern überlebten rund 40 Prozent, und weggefallen ist
das ENDE — dort steht die dritte Figur und der Bildausschnitt. Keine
Aufteilung, kein `BREAK`, kein Compel in den Replicate-Hüllen. Budget ~64 Wörter.

**`width`/`height` werden im img2img-Modus komplett ignoriert.** Die Ausgabe
trägt die Maße des Referenzbildes — daher 880×1168, obwohl 768×512 hinausging.
Geometrie steuert man nur, indem man die Referenz vorher skaliert. *(Noch nicht
gebaut, siehe §5.)*

**Proteus wässert unsere Bilder.** `apply_watermark` steht per Vorgabe auf
`True`, wir haben es nie gesetzt.

**Flux hat nicht ersetzt, sondern weggelassen.** `cog-flux` entfernt ein
beanstandetes Bild aus der Ausgabeliste und meldet `succeeded`, solange nicht
alle betroffen sind. Erkennbar nur an `len(output) < num_outputs`.

### Replicate selbst

**Kein Konto-Schalter für Erwachseneninhalte, keine Plattform-Filterung** der
API. Der Prüfer sitzt im Modell: `datacte/proteus-v0.2` bricht ohne
`disable_safety_checker` **hart** ab (`status: failed`, `NSFW content
detected`), `asiryan/juggernaut-xl-v7` hat gar keinen. Es gibt zusätzlich
`asiryan/proteus-v0.2` — dieselben Gewichte ohne Prüfer.

---

## 3. Was gebaut ist (nicht neu bauen)

| Commit | Inhalt |
|---|---|
| `c922ff3e` | zwei zugeschriebene Zitate aus dieser Übergabe entfernt |
| `08e20a56` | das Seed-Tor beschädigte seine eigene Eingabe (§4) |
| `da6fe552` | Referenzstärke, CLIP-Budget, Modell-Empfehlungen, Wasserzeichen, Flux-Zähler, Kostentabelle, Migration 385 |
| `5f3d511e` | Bild löschen + verwaiste Dateien; `backend/utils/storage` als eine Stelle statt drei |
| `b32b1927` | der Schalter: Blatt „Bildstelle" in der Personalakte |
| `f10a0262` | Mikroanimation ruhiger + fehlender `prefers-reduced-motion` |

### Die Empfehlungen je Modell

`MODEL_TUNINGS` in `image_model_families.py`. Je MODELL, nicht je Familie —
beide liegen in `_SDXL` und ihre Autoren nennen fast gegenteilige Zahlen:

```
proteus-v0.2      CFG 7,5   30 Schritte   KarrasDPM   apply_watermark=false
juggernaut-xl-v7  CFG 4     35 Schritte   KarrasDPM   Negativprompt LEER
```

⚠ Die oft zitierte niedrige Führung (4–6) gehört zu Proteus **v0.4**, nicht
v0.2. v0.2 sagt 7–8. Die Zahl vom falschen Modell zu übernehmen war mein
erster Entwurf.

### Die Modellrecherche ist erledigt — nicht wiederholen

Von 61 erwachsenenfähigen Modellen nehmen nur sieben eine Referenz an. Vier
durchgelaufen und angesehen. Wird ein anderes geprüft: erst das Schema lesen,
**dann einen echten Aufruf machen** — ein Schemavergleich allein findet keinen
falschen Enum-Wert.

---

## 4. Das rote CI war das Tor selbst

`lint-seed-carries-migration-effects.sh` entfernte Kommentarzeilen mit

```python
line for line in chunk.splitlines() if not line.lstrip().startswith("--")
```

Die Vorlage `chat_conversation_digest` setzt die Mitschrift zwischen Marken in
eigenen Zeilen (`--- MITSCHRIFT ---`). Die beginnen mit `--`. Der Entferner
kennt keine Zeichenketten, warf sie als SQL-Kommentar weg, schickte einen um
zwei Zeilen verkürzten Text in den Vergleich — und meldete dann die
Abweichung, die er selbst erzeugt hatte. **Im Seed fehlte nichts.** Der
Rückport, den die alte Fassung dieser Datei als P5 vorsah, wäre falsch gewesen.

Im Kopf genau dieser Datei steht der Satz, dass ein Tor, das bei richtiger
Eingabe anschlägt, abgeschaltet wird und dann den echten Fall auch nicht mehr
fängt. Eingetreten im Tor, das den Satz trägt.

---

## 5. OFFEN

### P1 — Deployen (⛔ erst nach Entwarnung der dritten Sitzung)

Acht Commits liegen, darunter Frontend und Migration 385. **385 hat Prod nie
gesehen** — lokal dreifach gegen eine Probe-Datenbank geprüft (leer / mit Daten
/ mit ausgehebelter Wirkung).

Danach: dieselbe Runde noch einmal laufen lassen und ansehen, ob die Szene
jetzt trifft.

### P2 — Die Referenz auf eine SDXL-Kachel bringen

Aus §2: `width`/`height` wirken im img2img nicht, die Ausgabe erbt die Maße der
Referenz. 880×1168 ist **kein** SDXL-Maß (Kacheln: 1024×1024, 896×1152,
832×1216, 1216×832, 1152×896). Ein Hochformat als Vorlage ist außerdem selbst
schon ein Zug Richtung Porträt. Zu bauen: die Referenz vor dem Hochladen auf
die nächstliegende Kachel skalieren — für Szenen quer (1216×832).

### P3 — Die Weltvorgaben haben keine Bedienung

`simulations.content_rating` und `simulations.scene_image_vantage` sind
genauso unerreichbar, wie es die Nutzerwerte bis heute waren. Sie gehören in
die Welteinstellungen, nicht in die Personalakte.

### P4 — Kürzeren Prompt erzeugen statt kürzen

Wir kappen jetzt auf 77 Token. Besser wäre, gar nicht erst 160 Wörter zu
erzeugen: die Vorlage `chat_scene_image` müsste für die SDXL-Spur eine kurze
Fassung verlangen. Das berührt `prompt_contracts.py`, also den Vertrag — kein
Nebenbei-Fix.

---

## 6. ⛔ STEHENDE VORGABEN

* **Keine Altersfeststellung.** Österreich. Zweimal ausdrücklich abgelehnt, die
  Spalten wurden entfernt und eine Migration prüft ihre Abwesenheit.
* **Keine Verifizierungs-/Klassifizierungsmaschinerie** für Modellausgaben. Die
  Stufe an der Bildunterschrift ist eine Auskunft aus der eigenen Zeile, keine
  Prüfung der Ausgabe.
* **Keine Bevormundung der Nutzer** — nachdrücklich festgehalten. Die Weltstufe
  ist eine Vorgabe, keine Decke.
* **Kein Gesprächs-Wortlaut im Repo.** Tor: `scripts/lint-no-chat-content.sh`.
  Es findet nur Zuschreibung + Zitat im Dreizeilenfenster; nach jedem Fund
  einmal von Hand nach allen Anführungszeichen suchen. Genau so kam heute die
  zweite Fundstelle heraus, die das Tor nicht sah.

---

## 7. Werkzeug

```bash
# Prod-Zugangsdaten (NICHT .env — das zeigt auf 127.0.0.1:54321)
set -a; . ~/.config/metaspots/velgarien-coolify.env; set +a

C=$(ssh metaspots "docker ps --filter name=a6exg3b5euhidpc2r5009o0m -q" | head -1)
ssh metaspots "docker exec -i $C sh -c 'cat > /tmp/x.py'" < skript.py
ssh metaspots "docker exec $C sh -c 'cd /app && PYTHONPATH=/app python /tmp/x.py'"

# Deploy — es gibt KEIN Auto-Deploy auf Push
TOKEN=$(cat ~/.config/metaspots/coolify-api.token)
ssh metaspots "curl -s -X POST 'http://127.0.0.1:8000/api/v1/deploy?uuid=a6exg3b5euhidpc2r5009o0m' \
  -H 'Authorization: Bearer $TOKEN'"
# Welcher Commit läuft: docker ps → der Image-Tag IST der SHA

# Migration proben, BEVOR sie geschickt wird — und mit Gegenprobe
docker exec supabase_db_velgarien-rebuild psql -U postgres -d postgres -c "CREATE DATABASE probe;"
docker exec -i supabase_db_velgarien-rebuild psql -U postgres -d probe \
  -v ON_ERROR_STOP=1 -q -f - < supabase/migrations/<datei>.sql

# Tests: die venv, NICHT System-Python 3.9
.venv/bin/python -m pytest backend/tests/unit -q
```

**Geteilter Baum:** `git status` vor JEDEM `git add`, und nur eigene Pfade
stapeln. Zwei fremde Dateien lagen heute Abend im Baum.

---

## 8. LEHREN DES TAGES

**Ein plausibler Befund ersetzt keine Gegenprobe.** Der Negativprompt verbot
wörtlich das Bestellte — ein besseres Motiv gibt es kaum. Er war trotzdem nicht
die Ursache, und nur ein A/B am lebenden Modell hat das gezeigt.

**Ein Tor kann seine eigene Eingabe beschädigen und den Schaden für einen
Befund halten.** Vor dem Rückport erst prüfen, ob das Tor recht hat.

**Ein Test kann bestehen, weil zwei Fehler einander decken.** `flux.2-pro` mit
Punkt stand nie in der Preistabelle; der Test bestand, weil der Rückfallwert
zufällig derselbe Preis war. Sichtbar wurde es erst, als sich der Rückfall
änderte.

**Ein Rückfallwert darf kein echter Modellpreis sein.** Sonst bekommt ein
unbekanntes Modell eine Zahl, die richtig aussieht, statt einer, die zum
Nachschlagen zwingt.

**Eine Näherung soll in die harmlose Richtung irren.** Beim CLIP-Budget wird
mit 1,35 Token je Wort gerechnet, gemessen sind 1,2: ein zu kurzer Prompt
verliert Beiwerk, ein zu langer die Bildaussage — lautlos.

**Eine Gegenprobe, die an einem Syntaxfehler scheitert, beweist nichts.** Die
erste zu Migration 385 tat genau das. Die Wirkung aushebeln, das SQL gültig
lassen.

**Ein `prefers-reduced-motion`-Block ist keine Zusicherung, sondern eine
Liste.** Er nannte zwei Animationen und ließ ausgerechnet die auffälligste aus.

**Ein Backtick in einem `css`-Kommentar beendet das Template.** Stand schon in
der gestrigen Übergabe. Ich bin heute trotzdem hineingelaufen.
