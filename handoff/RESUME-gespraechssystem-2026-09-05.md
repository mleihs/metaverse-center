# Gesprächssystem — Stand 05.09.2026, und was als Nächstes zu bauen ist

**HIER STARTEN.** Diese Datei ist vollständig: Stand, Messungen, Fallen, Plan.
Vorgänger: `handoff/RESUME-gespraeche-ohne-dich-2026-09-04.md` (Fortsetzung
ohne Zuhörer) und `handoff/PLAN-gespraeche-ohne-dich-2026-09-04.md`.

> ⚠ **Decknamen.** Figuren heißen hier Marie Morgenrot, Suse Sonnenblum,
> Benno Blattgold. Echte Namen und Gesprächswortlaut gehören nicht in dieses
> Verzeichnis — `scripts/lint-no-chat-content.sh` ist das Tor dazu, und es
> hat mich heute dreimal erwischt. **Vor jedem Commit laufen lassen und den
> Exit-Code prüfen, nicht durch eine Pipe nach `tail` schicken** — genau so
> ist er mir einmal verlorengegangen.

---

## Auftrag für die nächste Sitzung

Alles umsetzen, was Sinn ergibt, in dieser Reihenfolge:

1. **Fallen in die Testsuite** — ohne sie sind alle künftigen Nullquoten weich
2. **Fokalisierung zurückspielen** — kostet nichts, seit 05.09. gefahrlos
3. **Sprecherauswahl statt Hinweis** — schließt eine gemessene Lücke
4. **Gültigkeit und Vergessen im Gedächtnis**

Begründung, Zahlen und Bauanleitung stehen unten unter „Der Plan".

---

## Was live ist

Migrationen **355–375** auf Prod, Code bis `edf1129d`, ausgerollt und
mehrfach gegen `<meta name="velg-release">` geprüft.

| Migration | was sie tut |
|---|---|
| 356 | fremde Züge nicht mehr als `assistant` |
| 357–365 | Fortsetzung ohne Zuhörer (Griff, Phase, Flüstern, Fälligkeit in SQL) |
| 358–360 | verdichtete Vorgeschichte, abschnittweise |
| 364 | der Mensch bekommt eine Marke |
| 366 | eine Antwort auf die Sprachfrage + Pflichtplatzhalter |
| 367 | Wahrnehmungshorizont, Anweisung ans Ende |
| 368/369 | Fokalisierungs-Detektor + View mit zwei Quoten |
| 371 | eigener Name vorn UND hinten in der Anweisung |
| 372 | die Lage wird ausgerechnet (wer war gemeint, wer sprach schon) |
| 373 | zweischichtiges Gedächtnis: geteiltes Protokoll + Ich-Erinnerung |
| 374 | Verbot der Marke — **gemessen wirkungslos**, von 375 zurückgenommen |
| 375 | die Marke IST die Bezeichnung: `[dein Gegenüber]` + Klammerschnitt |

Drei Merkmalstore stehen auf **AUS** und laufen nicht, bis jemand sie in
Admin → Plattform → Merkmalstore öffnet:
`agent_continuation_enabled` · `continuation_mail_enabled` ·
`focalization_model_check_enabled`.

---

## Die Messungen, alle mit demselben korrigierten Messgerät

⚠ **Das Messgerät wurde am 05.09. repariert.** Es las wörtliche Rede mit und
bestrafte eine Figur dafür, ihr Gegenüber beim Namen anzusprechen.
**Alle älteren Zahlen dieses Detektors (14,6 % · 13,4 % · 20,4 %) sind nach
oben verzerrt.** Was hier steht, ist neu gerechnet.

```
                                   Züge   allwissend   sich gebündelt
gewachsener Faden, vor allem        330      14 %          10 %
Testrunden nach den Reparaturen      30       0 %           0 %

Selbstbündelung nach Sprechposition
  vorher   erste 6 %/5 %   zweite 10 %/22 %   dritte 22 %/37 %
           (der Mensch nannte SIE / er nannte eine ANDERE)
  nachher  0 % an jeder Position, n=10 je Figur
```

**82 von 330** Zügen trugen den eigenen Vornamen UND eine Ich-Form — die
Figur war im selben Satz „ich" und eine benannte dritte Person.

**Die verdichtete Vorgeschichte** war die zweitgrößte Quelle: 12 Verdichtungen,
davon **11 allwissend aus der Sicht JEDER Figur**, ~7 000 Token je Zug je
Figur, und **5 von 12** enthielten eine Ich-Form, die keiner Leserin gehörte.

**Die Marke des Menschen:** 11 von 24 Zügen trugen `[User]` wörtlich in der
Prosa → Verbot (374) → **3 von 3 schrieben sie weiter** → Bezeichnung (375)
→ **0 von 9**.

**Schweigen:** zwei Figuren ausdrücklich zum Schweigen aufgefordert,
**2 von 2** haben trotzdem geantwortet.

**Perspektivgrenze**, direkt gegen Produktionsdaten gerechnet: eine spät
beigetretene Figur sah 4 von 10 Nachrichten, 6 weggeschnitten, das Geheimnis
nicht darunter. Ende-zu-Ende sauber nachgewiesen mit einem Aufbau, in dem
die Wissenden entfernt wurden: die richtige Figur antwortete und sagte
schlicht, sie kenne die Zahlenfolge nicht.

---

## Die Fehlerklassen, die heute gefunden wurden

Sieben, und **keine** davon hatte einen Test:

1. **Rollen im Protokoll** — fremde Züge gingen als `assistant` hinaus
2. **Der Mensch hatte keine Marke** — seine Zeile stand ohne Besitzer
3. **Zwei Dateien, zwei Sprachantworten** — 41 Welten ohne Locale; der Chat
   bekam englische Vorlagen samt CIN-Bruchstücken und **ohne
   `{agent_memories}`**; ein Agent hatte 195 Erinnerungen, von denen keine je
   in einen Prompt gelangt ist
4. **Die Regel stand vor dem Verlauf** — Position 0 von 9, hinter 373 Nachrichten
5. **Geliehenes Wissen** — der ganze Faden ging an jede Figur, auch vor ihrem Beitritt
6. **Die Identität blieb oben, als die Regel nach unten ging** — 371/372.
   Jeder Schritt für sich richtig, zusammen der Fehler
7. **Eine entfernte Figur antwortete weiter** — `chat_conversations.agent_id`
   ist eine Altlast, der Einzelpfad las sie statt der Verknüpfungstabelle;
   dazu galt die Perspektivgrenze **nur im Gruppenpfad**

---

## Der Plan

### 1. Die Fallen in die Testsuite

**Woher der Punkt kommt:** vom Peer `velgarien-rebuild-af`, wörtlich sinngemäß:
*stellt der Detektor die Lage her, in der Allwissenheit überhaupt entstehen
kann, oder wartet er darauf?* — Er wartet. Meine Handmessungen am 05.09.
haben die Bedingung HERGESTELLT; diese Fallen stehen aber nicht im
automatisierten Lauf. Eine 0-%-Quote misst dort irgendwann wieder nur, dass
niemand gefragt hat. Derselbe Fehler steckte in seinem eigenen
Nebenläufigkeitstest.

**Was automatisierbar ist — und was nicht.** Ohne Modellaufruf lässt sich die
AUSGABE nicht prüfen. Drei Schichten, ehrlich getrennt:

* **(a) Der Detektor gegen ein Fallenkorpus.** Erfundene Agentenausgaben mit
  bekanntem Urteil: Kollektiv, fremdes Innenleben, zwei Beteiligte ohne
  Ich-Form — und die Gegenprobe, die NICHT anschlagen darf: wörtliche Rede
  mit Namen, Anrede, reine Rede. Das schützt das Messgerät. Vorbild:
  `test_focalization.py`, dort einreihen.
* **(b) Der Prompt unter Falle.** Für die bekannten Auslöser prüfen, dass die
  Abwehr im Prompt WIRKLICH steht: eigener Name vorn und hinten, die richtige
  Figur in `_addressed_note`, die Vorredner benannt. Das ist der eigentliche
  Regressionsschutz und kostet nichts.
  Auslöser, gemessen wirksam: eine Figur in dritter Person ansprechen und zwei
  bündeln · eine Figur aus dem Raum korrigieren · nach den Gedanken der
  anderen fragen · kollektiv als „die drei" adressieren.
* **(c) Der Modelllauf.** Bleibt Handmessung. Das Protokoll unten festhalten,
  nicht in CI. Ein Modellaufruf in der Suite wäre teuer und wackelig.

### 2. Fokalisierung zurückspielen

Der Wert wird auf **jedem** Zug gemessen und liegt ungenutzt in
`chat_message_focalization`. Ihn den letzten n Zügen einer Figur entnehmen und
ihrer nächsten Anweisung beilegen. **Kostet keinen Modellaufruf.**

⚠ **Vor dem 05.09. wäre das schädlich gewesen.** Der Detektor hatte eine
Fehlalarmklasse (wörtliche Rede); zurückgespielt hätte man dem Modell
beigebracht, im Gruppengespräch keine Namen mehr zu benutzen. Seit
`_ohne_rede` ist es gefahrlos.

**Harte Nebenbedingung:** `backend/tests/unit/test_chat_round_trips.py` sagt
zu, dass je Agent GENAU EINE Rundreise anfällt und im Prompt-Bau KEINE. Die
Abfrage gehört deshalb in den Vorlauf (`_prepare_group_turn`), **einmal für
alle Sprecher**, nicht je Agent. Wer das verletzt, macht den Test rot — zu
Recht.

Ich würde nicht sperren und nicht neu erzeugen (das kostet ~15 % mehr
Aufrufe), sondern nur benennen: eine Zeile in der Schlussanweisung, wenn die
jüngsten Züge dieser Figur auffällig waren. Leer, wenn nicht — ein Satz, der
immer dasteht, wird Tapete (dieselbe Regel wie bei `_addressed_note`).

### 3. Sprecherauswahl statt Hinweis

**Der Beleg ist gemessen:** 2 von 2 Figuren haben eine ausdrückliche
Aufforderung zu schweigen ignoriert. Solange die Reihenfolge fest ist, ist
Schweigen nicht erreichbar.

Bauform (aus dem Bericht, siehe unten): genannte Figuren antworten zuerst und
immer; nicht genannte nach einem Redseligkeitswert. Der Wert könnte aus
`agent_opinions` und der Beziehung zum Menschen abgeleitet werden, statt
eingestellt zu werden.

⚠ **Zwei Warnungen, beide aus der Forschung:**
* Der schweigsame Agent wurde in der Studie von **7 von 12** als schlechtester
  bewertet. Schweigen muss sparsam sein, sonst ist die Reparatur schlimmer
  als der Fehler.
* Das ändert das Produktgefühl. **Hinter ein Merkmalstor**, Vorgabe aus, und
  vorher dem Nutzer vorlegen.

`_addressed_note` bleibt und wird die Grundlage — es erkennt die Anrede schon
heute. Eine spätere `@`-Erwähnung sollte eine KENNUNG speichern, nicht den
Text, sonst bricht sie beim Umbenennen einer Figur.

### 4. Gültigkeit und Vergessen im Gedächtnis

Verifiziert: `agent_memories` hat **keine** Spalte für Gültigkeit,
Überholtsein oder Vergessen — nur `last_accessed_at`, und nichts lässt je
etwas fallen. Der Dienst ist „Stanford Generative Agents"-Bauart von 2023;
die Kritik daran trifft genau die übernommenen Punkte.

Zwei Spalten und eine RPC, keine neue Bibliothek (Postgres-first, ADR-007):
* ein **Gültigkeitsfenster** je Erinnerung — „X war Archivarin, bis …"
* ein Pfad, der Überholtes **als überholt markiert**, statt es ewig mitzuschleppen

Ergänzt die Zweischichtigkeit aus 373 sauber: die trennt, WESSEN Erinnerung
es ist, nicht wie lange sie gilt.

Zwei weitere Muster, heute nicht gebaut und erwägenswert: ein
**Identitätskern** getrennt vom Episodischen, und **anheftbare** Erinnerungen,
die der Mensch selbst setzt.

---

## Der Bericht des anderen Agenten

Artefakt **„Vermessung des Gesprächssystems"**,
`https://claude.ai/code/artifact/61162673-a6a0-46f3-b5b3-3281db452358`,
05.09.2026. Punkte 2–4 des Plans oben stammen daraus.

⚠ **Ein Fehler darin:** er schreibt, die Fokalisierung habe „zwei Stufen,
inklusive Modellaufruf zur Eichung". Die zweite Stufe ist DEKLARIERT, aber
nicht gebaut — Tor aus, und **0 von 383** Zeilen in
`chat_message_focalization` tragen `method='model'`. Sein Bestand ist
außerdem von früh am 05.09. und kennt 373/375 sowie `edf1129d` nicht.

**Nicht Chat-Logik, gehört dem Nutzer vorgelegt:** der Rechtsteil.
Kalifornien SB 243 gilt seit **01.01.2026** für Companion-Chatbots
(Offenlegung, bei erkennbar Minderjährigen zusätzlich Verbot sexuell
expliziter Inhalte), dazu New York und Oregon SB 1546. Das ist die einzige
Sache im Bericht mit einer Frist.

**Oberfläche, eigene Vorhaben:** Swipes, Continue, Author's Note, Verzweigungen,
`@`-Vervollständigung, Szenenbilder aus dem Gespräch.

---

## Fallen, in die ich heute getreten bin

* **Ein `head` im eigenen Suchbefehl** ließ mich „`record_observation` fehlt"
  behaupten — die Zeile war nur abgeschnitten.
* **Zeitfilter gegen die Datenbankuhr**: sie stand auf dem Vortag, mein Filter
  schnitt alles weg. Lieber nach Reihenfolge schneiden als nach Zeitstempel.
* **Zweimal den eigenen Test verdorben**: einmal sprach eine wissende Figur
  das Geheimnis in derselben Runde laut aus (legitime Weitergabe, kein
  Fehler), einmal war die verräterische Zeile erst durch den Fehler
  entstanden, den ich prüfen wollte. **Vor jeder Aussage prüfen, ob die
  Information im Horizont der Figur lag.**
* **Nummernkollision bei Migrationen** — dreimal an zwei Tagen. Die Nummer
  gehört unmittelbar vor dem Schreiben vergeben, nicht vorher.
* **`ruff format backend/`** formatiert 279 fremde Dateien um. Nur eigene Pfade.
* **Der Vertragsprüfer** wurde rot, weil EINE Füllstelle ZWEI Vorlagen
  bediente. Er hatte nicht nur formal recht — das Protokoll DARF `agent_name`
  nicht kennen.

---

## Prüfstand

```bash
.venv/bin/ruff check backend/
.venv/bin/python -m pytest backend/tests/unit -q -p no:randomly   # 3903 grün
cd frontend && npm run lint:full
bash scripts/lint-no-chat-content.sh && echo OK   # Exit-Code prüfen!
bash scripts/lint-model-call-handlers.sh
```

**Ausrollen** (kein Auto-Deploy):
1. Migration: Trockenlauf `BEGIN … ROLLBACK` mit Selbstprüfungen, dann
   derselbe Text mit `COMMIT` und der `schema_migrations`-Zeile in DERSELBEN
   Transaktion. Management-API, Bearer aus `SUPABASE_MCP_TOKEN` in `.env`.
   Projekt `bffjoupddfjaljqrwqck`.
2. `git push origin main`
3. `ssh metaspots "curl -s -X POST -H 'Authorization: Bearer <token>'
   'http://127.0.0.1:8000/api/v1/deploy?uuid=a6exg3b5euhidpc2r5009o0m'"`,
   Token in `~/.config/metaspots/coolify-api.token`
4. `<meta name="velg-release">` **mehrfach** abfragen — im Übergang laufen
   zwei Behälter, ein einzelner Aufruf misst den alten. Ich habe auf fünf
   gleiche Antworten in Folge gewartet.

⚠ **CI meldet „failed" und das ist nicht der Code**: rot ist allein
`Sentry Release`, weil `gh secret list` für das Repo nichts liefert.

⚠ **Geteilter Baum.** `velgarien-rebuild-af` arbeitet mit, hat aber bestätigt:
er fasst `backend/services/chat_ai_service.py` und `backend/services/chat/*`
NICHT an. Nur eigene Pfade committen.

---

## Handmessprotokoll (Punkt 1c)

Frischer Faden, drei Figuren. Je Runde alle Antworten messen mit
`FocalizationService.measure` und der Selbstbündelungszählung (eigener
Vorname mit fremdem in einem Satz, verbunden durch „und"/„beiden"/„zwei",
nach `_ohne_rede`).

1. Eine Figur in dritter Person ansprechen, zwei bündeln
2. Eine Figur aus dem Raum korrigieren („X, du bist nicht hier")
3. Nach den Gedanken der anderen fragen
4. Kollektiv adressieren („erzählt mir, was die drei tun")
5. Eine Figur beiseite nehmen, die anderen zurücklassen
6. Zwei zum Schweigen auffordern — misst die Zugreihenfolge

Erwartung nach heutigem Stand: 0 % allwissend, 0 % Selbstbündelung, keine
Marke im Text. Abweichung ist ein Befund.

---

## Offene Entscheidungen des Nutzers

1. **Vier Testfäden** stehen in Velgarien herum (Besetzungen mit Doktor Fenn /
   General Aldric Wolf / Inspektor Mueller / Pater Cornelius / Schwester Irma).
   Löschen? In der Seitenleiste: ARCHIVIEREN ist soft, LÖSCHEN ist echt und
   kaskadiert über Nachrichten, Teilnehmer, Verdichtungen, Ereignisbezüge,
   Fokalisierung und Reaktionen. **Nicht mit gelöscht werden `agent_memories`**
   (204 Zeilen mit `source_type='chat'`, kein Fremdschlüssel).
2. **Der alte Faden und seine Erinnerungen** sind unangetastet; der
   Löschauftrag wurde vom Nutzer selbst gestoppt.
3. **Zwei Commits mit Gesprächswortlaut** stehen auf GitHub (`e995c3e6`,
   `82df5366`). Der Baum ist bereinigt, die Historie nicht.
4. **Die drei Merkmalstore** stehen auf aus.
5. **Zehn `msg()`-Ketten des Frequenzreglers** sind nie in die
   Übersetzungsdatei extrahiert worden — der Regler steht auf Deutsch
   englisch da. `frontend/src/locales/xliff/de.xlf` gehörte zuletzt der
   zweiten Sitzung.
6. **`DELETE /conversations/{id}/agents/{agent_id}`** existiert im Backend,
   hat aber keine Fläche in der Oberfläche.
7. **Die Marke `[dein Gegenüber]` ist relational** — aus dem Mund einer Figur
   bedeutet sie für den Leser etwas anderes als im Prompt. Sie ist
   grammatisch richtig und klammerlos, aber die Bedeutung kippt je nach
   Sprecher. Eine nicht-relationale Bezeichnung wäre besser; ohne Namen für
   den Menschen ist jede eine Erfindung.

---

## Nachtrag: Gegenlesen durch `velgarien-rebuild-af`, selbst nachgemessen

Der Peer hat die zwei Stellen vermessen, bei denen ich unsicher war. **Alle
seine Befunde bestätigt**, dazu einer, den keiner von uns auf dem Zettel
hatte. Das gehört mit in Punkt 1 des Plans — es sind Fehler im MESSGERÄT und
in der ANREDE-Erkennung, also in genau den zwei Dingen, auf denen die
heutigen Zahlen stehen.

### `_addressed_note` — die Gewinnung des Vornamens

**(a) `name.split()[0]` ist nicht immer ein Vorname — Falsch-Positiv, die
schlimmere Richtung.** Bei „Doktor Freundlich" ist das erste Feld der TITEL.
Nachgemessen:

```
Figur „Doktor Freundlich", Text „Der Doktor hat abgesagt."        -> haelt sich fuer gemeint
Figur „Doktor Freundlich", Text „Ich frage den Doktor Blattgold." -> haelt sich fuer gemeint
```

Im zweiten Fall spricht der Mensch nachweislich eine ANDERE an. Das ist nicht
nur ein verpasster Hinweis, sondern ein FALSCHER — und es kippt den Zweig:
`ich_genannt` schlägt `andere_genannt`, die Figur verliert also auch die
Grenzansage, die ihr zugestanden hätte. Dieselbe Klasse trifft „Frau …",
„Hauptmann …", „Alte …".

**Fix:** nicht das erste Feld, sondern JEDES Feld ab 3 Zeichen prüfen, mit
einer kleinen Sperrliste für Titel und Partikel. Die Begründung im Kommentar
(„der Vorname genügt") stimmt über die BENUTZUNG — falsch ist nur, wie der
Vorname gewonnen wird.

**(b) Genitiv wird nicht erkannt — Falsch-Negativ, milder.**

```
„Ich nehme Maries Tasche."   -> nicht erkannt
„Ich nehme Marie die Tasche." -> erkannt
„wir fahren nach Marienbad"   -> korrekt NICHT erkannt   (haelt)
```

Im Deutschen ist das die häufigste flektierte Form. Ein `(?:s|ns)?` vor der
Wortgrenze fängt es, ohne „Marienbad" zu treffen.

### `_ohne_rede` — welche Redeformen der Schnitt kennt

Selbst nachgemessen, alle acht Formen:

```
„…“   deutsch                geschnitten
„…”   deutsch                geschnitten
„…"   GEMISCHT               BLEIBT   <- neu, von keinem von uns erwartet
"…"   gerade                 geschnitten
“…”   typografisch           geschnitten
»…«   Guillemets             BLEIBT
"…\n…" ueber Zeilenumbruch   BLEIBT   ( [^"\n] schliesst den Umbruch aus )
*…*   Sternchen              BLEIBT   <- RICHTIG SO: Handlung, keine Rede
```

⚠ **Meine erste Probe war fehlerhaft** — sie suchte in der Sternchen-Zeile
nach einem Wort, das dort nicht vorkam, und meldete „geschnitten" für jede
Zeile ohne dieses Wort. Ich hätte dem Peer damit fast fälschlich
widersprochen. Beim Prüfen einer Prüfung zuerst fragen, ob sie überhaupt
etwas sehen KANN.

Die Richtung ist bei allen Lücken dieselbe wie beim behobenen Fehler: nicht
geschnittene Rede wird als Erzählung gelesen, also **falsch-positive
Allwissenheit**. Belegt: `»Marie, wo ist Suse?«` — eine reine Anrede — wird
heute als `zero` gewertet.

**Reihenfolge nach Wahrscheinlichkeit:**

1. **Rede über einen Zeilenumbruch.** Gerade Anführungszeichen sind mit
   95 741 Vorkommen der beherrschende Stil im Projekt, und ein Absatz
   innerhalb der Rede ist normal. ⚠ Beim Fix eine OBERGRENZE setzen, sonst
   frisst ein einzelnes unpaariges Anführungszeichen den Rest des Zuges.
2. **Gemischte Paare** — Modelle mischen `„` mit `"` ständig.
3. **Guillemets** — im Projekt 202 Vorkommen gegen 129 deutsche, aber in
   `content/dungeon/**/banter.yaml`, nicht in den Chat-Vorlagen. Für den
   Chatpfad latent, nicht aktiv. Zwei Zeichen im Muster.
4. **Gedankenstrich-Rede** — im Bestand nicht belegt. Liegen lassen, bis sie
   auftaucht; ein enges Muster dafür ist schwer.

**Und in den Docstring schreiben, WELCHE Formen der Schnitt kennt.** Sonst
liest die nächste Sitzung „Rede ausgeschlossen" als vollständig — und die
Zahlen tragen einen Rest des alten Fehlers weiter, kleiner, aber derselbe.
