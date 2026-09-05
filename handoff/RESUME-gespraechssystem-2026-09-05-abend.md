# Gesprächssystem — Abend des 05.09.2026: die vier Punkte sind gebaut

**HIER STARTEN.** Vorgänger: `handoff/RESUME-gespraechssystem-2026-09-05.md`
(Stand, Messungen, Plan). Diese Datei sagt, was daraus geworden ist, was
gemessen wurde und was offen bleibt.

> ⚠ **Decknamen.** Marie Morgenrot, Suse Sonnenblum, Benno Blattgold, Doktor
> Freundlich. `scripts/lint-no-chat-content.sh` **vor jedem Commit laufen
> lassen und den Exit-Code prüfen** — es hat heute noch zweimal zugeschlagen,
> beide Male an einem erfundenen Beispielsatz, der als *zugeschriebenes Zitat*
> geschrieben war. Die Lösung ist jedes Mal, den Satz nicht als Zitat zu
> formulieren (doppelte Backticks), nicht das Muster aufzuweichen.

---

## Was gebaut wurde

Vier Commits auf `main`, drei Migrationen auf Prod.

| Commit | was |
|---|---|
| `8d699a04` | Punkt 1 — die Fallen in der Testsuite, +98 Tests |
| `8de7747f` | Punkt 2 — Fokalisierung zurückgespielt, Migration **376** |
| `0a6d5cb1` | Punkt 3 — Sprecherauswahl hinter einem Tor, Migration **378** |
| `7e23e8b6` | Punkt 4 — Gültigkeit und Vergessen, Migration **379** |

Migration **377** gehört einer zweiten Sitzung (Bildpfad im Chat); sie lag
zeitlich dazwischen und ist nicht meine.

```
pytest backend/tests/unit    3903 → 4107 grün
ruff check backend/          sauber
npm run lint:full            Exit 0
lint-no-chat-content.sh      eigene Pfade Exit 0
lint-migration-order.sh      Exit 0, 371 Migrationen
lint-no-secdef-public-grant  Exit 0
```

---

## Punkt 1 — die Fallen stehen jetzt im Lauf

**Drei Reparaturen, alle derselben Klasse: eine Prüfung, die nicht sehen kann,
was sie prüft.**

1. **`_ohne_rede` paarte Anführungszeichen, statt sie zu klassifizieren.**
   5 von 9 Kombinationen der drei üblichen Konventionen fielen durch, dazu
   beide Guillemet-Richtungen, Rede über einen Zeilenumbruch und das Zitat im
   Zitat. Richtung immer dieselbe: **falsch-positive Allwissenheit**.
   Jetzt: Öffner aus `[„“”"«»]`, Schließer aus `[“”"«»]`, dazwischen alles bis
   `_REDE_MAX = 400`. ⚠ Die Obergrenze ist der Preis — ohne sie frisst ein
   unpaariges Zeichen den Rest des Zuges, und der Fehler ginge in die
   GEGENrichtung (unsichtbar).

2. **`name.split()[0]` ist nicht immer ein Vorname.** Bei „Doktor Freundlich"
   ist das erste Feld der Titel. Dazu fehlte der sächsische Genitiv.
   Neu: `backend/services/chat/names.py`, gemeinsam für Detektor und
   Lage-Ansage. Die Sperrliste enthält bewusst **keinen denkbaren Vornamen**;
   eine Figur aus lauter Sperrwörtern fällt auf ihre Rohteile zurück.

3. **GENANNT ist nicht ANGESPROCHEN** — beim Bau der Falle „nach den Gedanken
   der anderen fragen" gefunden, von keinem von uns erwartet. „Marie, was geht
   Benno durch den Kopf?" nennt zwei und spricht eine an; Benno bekam „der
   Mensch spricht dich an". Die Vokativstellung wird **nicht geraten** — eine
   falsche Grenzansage nähme einer Figur ihren Zug. Stattdessen ein dritter
   Zweig: beide Namen stehen da, nur das Zugesprochene geschieht.

**Die drei Schichten, ehrlich getrennt:**

* **(a)** `test_focalization.py` — Fallenkorpus mit bekanntem Urteil, plus ein
  Test AUF den Korpus (kommt jedes Urteil vor, jeder Anhalt, ist die
  Gegenprobe nicht kleiner als die Falle, nennen die Gegenproben überhaupt
  fremde Figuren). Ein Fallenkorpus ohne Fallen besteht sonst mühelos.
* **(b)** `test_prompt_unter_falle.py` — die vier gemessen wirksamen Fallen
  über den echten Aufrufpfad. Der **Wortlaut** der Vorlage steht dort NICHT:
  er gehört der Datenbank und wird von den Selbstprüfungen 371/372/375
  gehalten. Ein Test, der ihn abschriebe, verteidigte irgendwann die Vorlage
  von gestern.
* **(c)** Der Modelllauf bleibt Handmessung — Protokoll unten.

Falle 4 („erzählt mir, was die drei tun") hält eine **Lücke** fest: ohne Namen
im Text hat die Lage-Ansage keinen Anhaltspunkt und bleibt leer. Steht als
Test da, damit sie benannt ist und nicht als Erfolg durchgeht.

---

## Punkt 2 — der Messwert erreicht die Figur (Migration 376)

Seit 368 wird auf jedem Zug gemessen; gelesen hat den Wert niemand. Jetzt:

* View `agent_recent_focalization` — Bilanz der letzten **fünf** Züge je Figur,
  `security_invoker`, anon ohne Recht. Das Fenster steht **in der View und nur
  dort**.
* Platzhalter `{focalization_note}`, **zuletzt** vor der Schlusszeile. 371
  (Namensanker in den letzten 60 Zeichen) und 372 (Lage-Ansage in den letzten
  120) überleben das Einschieben — die Selbstprüfung misst beides.
* Schwelle **zwei von fünf**, nicht eins: die Heuristik hat Fehlalarme, und
  ein Satz, der zu oft dasteht, wird Tapete.
* **Ein Wort, kein Verbot** — 374 hat gemessen, was ein Verbot wert ist.

**Rundreisen:** EINE Abfrage im Vorlauf für alle Sprecher. Vier neue Tests in
`test_chat_round_trips.py` halten das fest, samt Gegenprobe mit einem vierten
Agenten.

**Nebenbefund, behoben:** `rate_for_conversation` las `allwissend_prozent` —
eine Spalte, die Migration 369 entfernt hat. Hätte auf Prod 400 gemeldet.
Gefunden hat es niemand, weil der einzige Aufrufer ein Test mit einem
Doppelgänger ist, der jede Spaltenliste widerspruchslos annimmt.

---

## Punkt 3 — Schweigen wird erreichbar (Migration 378, Tor AUS)

Merkmalstor **`chat_speaker_selection_enabled`**, Vorgabe aus, im Admin unter
Plattform → Merkmalstore sichtbar (`platform_gate_contracts.py`).

Regel: Genannte antworten zuerst und immer · nennt der Mensch niemanden,
antworten alle · Ungenannte brauchen einen Grund (Anteilnahme ≥ 20 über eine
Genannte, oder zwei Runden geschwiegen) · **es schweigen nie alle**.

### ⚠ Was die Daten hergeben — VORHER gemessen, nicht angenommen

```
agents.personality_profile                 0 von 258 haben Inhalt
agent_relationships zwischen Teilnehmern   0 bis 1 Zeilen
agent_opinions      zwischen Teilnehmern   vollständig, 6 je Dreierrunde
  davon opinion_score = 0                  28 von 32
  davon |opinion_score| >= 20               2 von 32
  davon interaction_count > 0               4 von 32
```

`agent_opinions` ist die **einzige** der drei im Plan vorgeschlagenen Quellen
mit Daten — und heute zu 87,5 % flach. Eine Auswahl allein darauf ließe jede
ungenannte Figur schweigen, also genau der Fehler, vor dem die Studie warnt
(der schweigsame Agent: 7 von 12 hielten ihn für den schlechtesten).

**Deshalb trägt heute die Schweigedauer**, nicht die Anteilnahme. Die
Anteilnahme ist richtig gebaut und wächst mit, wenn die Autonomie läuft.
Wer diese Zahlen nachmisst und sie für wirkungslos hält, hat recht — bis dahin.

---

## Punkt 4 — eine Erinnerung darf aufhören zu gelten (Migration 379)

Zwei Spalten, die **nicht dasselbe** sind:

* `valid_until` — das Fenster ist zu, der Satz bleibt WAHR als Vergangenheit.
  Wird weiter abgerufen, **halb** gewichtet, als „no longer current"
  gerendert. (Halb und nicht null: „X war Archivarin" darf gegen eine
  belanglose aktuelle noch gewinnen.)
* `superseded_by` — eine andere Erinnerung hat diese abgelöst. Fällt aus dem
  Abruf; beide zugleich hießen, dem Modell eine Tatsache und ihren Widerruf
  nebeneinander zu geben.

`fn_supersede_memory` (SECURITY **INVOKER**) setzt beides in einer Anweisung,
mit Prüfung auf Selbstbezug und fremdes Gedächtnis.
`retrieve_agent_memories` musste DROP+CREATE (neue Rückgabespalte `expired`,
42P13); der NaN-Zweig aus 342 steht wörtlich weiter drin.

**Gelöscht wird nichts** — 501 Erinnerungen stehen unverändert da.

**Der Weg ist da, die Politik nicht.** Kein Erkenner für Widersprüche (bräuchte
einen Modellaufruf), und die Überholung hängt **nicht** am Löschen eines
Fadens — das ist eine offene Frage des Nutzers, keine Entscheidung dieser
Migration.

---

## Handmessprotokoll — SCHULDIG, noch nicht gelaufen

Punkt 1c bleibt Handmessung. Der Prompt hat sich in drei Punkten geändert
(dritter Zweig der Lage-Ansage, `{focalization_note}`, korrigierte
Namenserkennung). **Die Wirkung ist noch nicht gemessen.** Protokoll:

Frischer Faden, drei Figuren, je Runde alle Antworten mit
`FocalizationService.measure` und der Selbstbündelungszählung.

1. Eine Figur in dritter Person ansprechen, zwei bündeln
2. Eine Figur aus dem Raum korrigieren
3. Nach den Gedanken der anderen fragen
4. Kollektiv adressieren
5. Eine Figur beiseite nehmen
6. Zwei zum Schweigen auffordern — **misst jetzt etwas anderes**: bei
   geschlossenem Tor weiterhin die Zugreihenfolge, bei offenem die Auswahl

Erwartung: 0 % allwissend, 0 % Selbstbündelung, keine Marke im Text.
Abweichung ist ein Befund.

---

## Offene Entscheidungen des Nutzers

1. **Das Tor `chat_speaker_selection_enabled` öffnen?** Es ändert das
   Produktgefühl. Vorher lesen: die Studienzahl oben.
2. **Wer ruft `supersede`?** Ein Erkenner für Widersprüche braucht einen
   Modellaufruf. Und ob das Löschen eines Fadens seine Erinnerungen überholen
   soll, ist Punkt 1 der alten offenen Liste — 204 Zeilen mit
   `source_type='chat'`, kein Fremdschlüssel.
3. **Die vier Testfäden** in Velgarien — unverändert offen.
4. **Kalifornien SB 243** (seit 01.01.2026, Companion-Chatbots), New York,
   Oregon SB 1546. Die einzige Sache mit einer Frist. Unverändert offen.
5. **Zehn `msg()`-Ketten des Frequenzreglers** nie extrahiert.
6. **`DELETE /conversations/{id}/agents/{agent_id}`** ohne Oberfläche.
7. **Die Marke `[dein Gegenüber]` ist relational** — Bedeutung kippt je nach
   Sprecher. Unverändert offen.
8. Die drei alten Merkmalstore (`agent_continuation_enabled`,
   `continuation_mail_enabled`, `focalization_model_check_enabled`) stehen
   weiter auf aus.

---

## Fallen dieses Abends

* **Eine Selbstprüfung, die nicht sehen konnte, was sie prüfte.**
  `information_schema.columns` kennt Tabellen und Views, **nicht** die
  Rückgabespalten einer Funktion. Sie ist LAUT gescheitert und nicht still
  durchgelaufen — das ist der Unterschied zwischen einer Prüfung, die irrt,
  und einer, die nichts sieht. Für `RETURNS TABLE`: `pg_proc.proargnames`.
* **Nummernkollision, wieder.** Ich habe einer zweiten Sitzung 377 zugesagt
  und sie mir dann selbst genommen; `lint-migration-order.sh` hat es gefangen,
  meine wurde 378. Die Nummer gehört unmittelbar vor dem Schreiben vergeben —
  und wenn man sie jemandem zusagt, gehört sie ihm.
* **Ein Doppelgänger, der jede Spaltenliste annimmt**, hat eine seit Migration
  369 kaputte Abfrage ein Jahr lang grün gemeldet.
* **`git status` in `frontend/`** ließ `git add` mit „did not match any files"
  scheitern. Pfade sind relativ zum Arbeitsverzeichnis, nicht zur Wurzel.
* **Geteilter Baum.** Eine zweite Sitzung arbeitet an `model_resolver.py`,
  `image_*`, `ChatComposer.ts`. Vier ihrer Tests waren zwischenzeitlich rot,
  ohne dass es an mir lag — **im geteilten Baum ist ein Gesamtlauf keine
  Aussage über die eigene Arbeit**. Nur eigene Pfade committen.

---

## Prüfstand

```bash
.venv/bin/ruff check backend/
.venv/bin/python -m pytest backend/tests/unit -q -p no:randomly   # 4107 grün
cd frontend && npm run lint:full
bash scripts/lint-no-chat-content.sh && echo OK   # Exit-Code prüfen!
bash scripts/lint-migration-order.sh
bash scripts/lint-no-secdef-public-grant.sh
```

**Ausrollen** (kein Auto-Deploy):
1. Migration: Trockenlauf `BEGIN … ROLLBACK` **mit einer Probe, die ihre
   eigene Bedingung herstellt**, dann derselbe Text mit `COMMIT` und der
   `schema_migrations`-Zeile in DERSELBEN Transaktion. Management-API
   `POST https://api.supabase.com/v1/projects/bffjoupddfjaljqrwqck/database/query`,
   Bearer aus `SUPABASE_MCP_TOKEN` in `.env`.
   ⚠ **Über `curl`, nicht `urllib`** — Cloudflare weist urllib mit 403/1010 ab.
2. `git push origin main`
3. `ssh metaspots "curl -s -X POST -H 'Authorization: Bearer <token>'
   'http://127.0.0.1:8000/api/v1/deploy?uuid=a6exg3b5euhidpc2r5009o0m'"`,
   Token in `~/.config/metaspots/coolify-api.token`
4. `<meta name="velg-release">` **mehrfach** abfragen — im Übergang laufen
   zwei Behälter, ein einzelner Aufruf misst den alten.
