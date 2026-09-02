# Chat-Design-Paket „Simulation Chat v2" — Übergabe

**Angelegt 2026-09-02.** Damit ein `/clear` jederzeit billig ist: alles, was
nur im Sitzungsverlauf stand, steht ab hier hier.

Quelle: `/Users/mleihs/Dev/Buchhaltung/Metaverse.center (10).zip` →
`design_handoff_chat/` (`simulation-chat.md` = Spezifikation,
`Simulation Chat v2.dc.html` + `Chat Panel.dc.html` = Prototyp,
`_ds/` = Token-Bündel, `assets/p-*.png` = Prototyp-Portraits).

Stand des Repos beim Beginn: `de973a5e` (live, HTTP 200).

---

## ⚠ Wo die Spezifikation vom Code abweicht

Die Spezifikation ist eine Momentaufnahme. Vor dem Umsetzen abgeglichen,
Ergebnis:

**Ticket 1 („`border-left: 3px` → Vollrahmen") beschreibt einen Zustand, den es
nicht mehr gibt.** In `ChatBubble.ts` gibt es keinen Akzentstreifen — der
Akzentbalken-Sweep vom 2026-08-29 hat ihn entfernt (`lint-no-accent-edge-bar.sh`
erzwingt das). Die zwei verbliebenen `border-left` sind **1 px NEUTRAL** an
`em` (Z. 141) und `blockquote` (Z. 154), beide mit Kommentar, warum sie erlaubt
sind: „a quote rule is typography, and predates the web" steht wörtlich in der
Ausnahmeliste des Tores. **Diese beiden bleiben.**

Umzusetzen ist die ABSICHT von §2.4: die Assistenten-Blase trägt den
Agenten-Akzent heute gar nicht (`border: 1px solid var(--color-border-light)`,
`background: var(--color-surface-raised)`). Sie soll ihn im ganzen Rahmen und
als 6-%-Tint tragen.

**Ticket 6 (Portraits) ist weitgehend erledigt.** `ChatWindow.ts` benutzt
bereits `portrait_image_url` mit `velg-avatar` als Rückfall (Z. 1064 ff.). Die
`assets/p-*.png` im Paket sind Prototyp-Platzhalter und gehören NICHT ins Repo.

**§2.1 nennt `list__header` als vorhanden.** Den gab es an dem Tag nur
vorübergehend — ich hatte ihn gebaut und auf Zuruf („es kommt ein Design-Paket")
wieder zurückgenommen. Heute existiert nur `ChatView.sidebar__header`.

---

## Die sieben Punkte

| # | Was | Kern |
|---|---|---|
| T1 | Blasen-Akzent | Vollrahmen + 6 % Tint statt neutralem Rahmen. Zitatlinien anfassen = Regelbruch. |
| T2 | Ein Kopfmaß | `--chat-header-h` = 58 px einmal in `ChatView`, an beide Schattenwurzeln vererbt. Suche + „+ Neu" in EINE Zeile. |
| T3 | **Sperre** | Migration + Reauth-Endpunkt + Liste + Guard. Das größte Stück. |
| T4 | Mobiler Kopf | 1 Portrait + „+n", Unterzeile ohne Nachrichtenzahl. |
| T5 | Reagieren-Knopf | Heute nur über den Balken erreichbar, den es erst nach der ersten Reaktion gibt. |
| T6 | Lesemaß + Markierungen | Verfasser-Rinne auf `--space-6`, Blasen `min(80%, 560px)`, Auswahl als `inset`-Rahmen. |
| T7 | Übergabe + Gate | Dieses Dokument, dann `lint:full`, `ruff`, i18n. |

**Stand 2026-09-02, alle sieben umgesetzt.** `lint:full` 24× PASS,
71 Dateien / 1202 Tests; `ruff` sauber, App lädt; 13 neue i18n-Einheiten
übersetzt und im ERZEUGTEN Bündel gegengeprüft.

### Wie die Sperre gebaut ist — und wo sie von §4 abweicht

Die Spezifikation sah `POST /auth/reauth` → `unlock_until` im
`sessionStorage` → `PATCH /conversations/:id {locked}` mit `reauth_at < 2 min`
vor. Der Merker hätte einen Zustand gebraucht, den der Server sonst nirgends
führt, und ein Fenster zwischen Nachweis und Wirkung geöffnet.

Gebaut ist deshalb: **das Passwort steht im SELBEN Aufruf wie die Änderung**
(`PATCH …/conversations/:id/lock {locked, password}`). Kein Fenster, kein
Zustand, eine Rundreise weniger — und serverseitig strenger als der Entwurf.
`POST /auth/reauth` bleibt für das ANSEHEN (Sichtschutz, `sessionStorage`,
30 min), denn das ist naturgemäß eine Sache der Oberfläche.

Beide Endpunkte tragen `RATE_LIMIT_EXTERNAL_API` (5/min), nicht den
Standardwert: die Stelle ist ein **Passwort-Orakel**. Wer ein gültiges Token
hat, könnte hier sonst das Kontopasswort erraten — und das öffnet nicht diesen
Chat, sondern das Konto. Aus demselben Grund loggt `verify_account_password`
die Ausnahme OHNE Kontext: gotrue trägt die Anmeldedaten im Klartext in seiner
Anfrage-Wiedergabe, ein `logger.exception` schriebe das Passwort ins Protokoll.

⚠ **Was die Sperre NICHT ist**, steht im Migrationskopf, im Dienst und im
Modaltext: sie verbirgt vor Blicken auf den Bildschirm. Sie verschlüsselt
nicht, und sie ändert die RLS nicht — wer ein Token hat, holt die Nachrichten
weiter über die API. Wer mehr braucht, braucht eine andere Bauart (Passphrase,
die den Inhalt selbst verschlüsselt; dann liest auch `service_role` nicht mit).

### Was beim Abgleich anders war als in der Spezifikation

* **T1** — kein 3-px-Streifen vorhanden (s. o.); die Absicht ist umgesetzt.
* **T5** — statt eines zweiten Pickers in `MessageActions`: die
  Reaktionsleiste HAT längst einen „+"-Knopf samt Popover-Verdrahtung, sie
  wurde nur nie gerendert. Jetzt steht sie immer; ohne Reaktionen ist sie
  dieser eine Knopf, sichtbar ab Berührung der Zeile
  (`--reaction-add-opacity`, weil `:hover` des Elternteils nicht durch die
  Schattengrenze reicht).
* **T6** — Blasen (`min(80%, 560px)`), Ereigniskarten (560) und die
  Auswahl-Markierung (`markerSelectionStyles`, 6 % + 1-px-Innenkontur) waren
  bereits richtig. Nur die Verfasser-Rinne stand falsch.
* **T4** — offen geblieben: §5 nennt zusätzlich Buttons 28 px / Padding 5 px
  im mobilen Kopf. Nicht angefasst, weil nichts sichtbar gebrochen war.

### Vor dem Deploy

**Migration 349 muss auf Prod angewandt werden** (`locked`-Spalte), sonst
scheitert das Umlegen des Verschlusses. Lesen funktioniert auch ohne, weil
`ConversationResponse.locked` einen Vorgabewert hat.

### Fallen, die beim Bauen zuschlagen

* **`--chat-header-h` = 58 px** ist zusammengesetzt, nicht geraten:
  `calc(var(--space-3) * 2 + 32px + var(--border-width-default))` — Innenabstand
  oben/unten, Portrait, trennende Kante. Gemessen: Listenkopf 56 px + 2 px Kante.
* **`ConversationList.render()` kehrt bei `conversations.length === 0` FRÜH
  zurück** (Leer-Ansicht). Wandert „+ Neu" in diesen Kopf, verschwindet er
  genau dann, wenn man ihn braucht.
* **Kein Backtick in einem `css`-Kommentar.** Er beendet das Template; `tsc`
  meldet dann 600 Fehler zwei Zeilen weiter. Heute zweimal passiert.
  `bash frontend/scripts/lint-no-backtick-in-css.sh` läuft als ERSTES in
  `lint:full` — direkt nach jeder CSS-Änderung laufen lassen.
* **Formatierer ist `frontend/node_modules/.bin/biome`**, nicht `npx biome`.
* **Farbe misst man nur in einem SICHTBAREN Browser-Reiter.** Im Hintergrund
  friert Chrome Übergänge bei `currentTime: 0` ein, `getComputedStyle` liefert
  den Anfangswert — das sieht aus, als griffe die Regel nicht. Und ein
  `requestAnimationFrame` in einer Schleife friert dort den Renderer ganz ein.

---

## Prod-Messwerte von heute (sonst nirgends notiert)

* `chat_conversations.message_count` stimmt: **58 zu 58**, 17 zu 17, 2 zu 2.
  Ein Gespräch vom April steht auf 6 zu 5 (einmal gelöscht ohne
  Herunterzählen) — offen, klein.
* **Jede** Antwort-Nachricht trägt eine `agent_id` (49/49, 12/12, 3/3, 1/1,
  3/3). Die rückwirkende Sprecher-Beschriftung trägt also.
* Privatchats sind von aussen dicht: `anon` und ein angemeldeter Fremder sehen
  0 Zeilen; der öffentliche Endpunkt liefert auch mit bekannter Gesprächs-UUID
  `{"data":[]}`. **Aber** `list_conversations_public` filtert nur nach
  `simulation_id` — es hält allein `Depends(get_anon_supabase)`. Ein Tausch
  gegen `get_effective_supabase` (was die Hausregel überall sonst verlangt)
  veröffentlicht in derselben Sekunde alle Nachrichten. Offen: entweder
  Besitzerfilter dort ergänzen oder einen Test, der anonym auf leer prüft.
* KI-Kosten zwei Stunden: **$0,0374** / 101 Aufrufe. Verhältnis Prompt zu
  Antwort **29 : 1** (378 954 zu 12 956 Token) — der Verlauf geht bei jeder
  Nachricht neu hoch, ⌀ 7 288 Token für 249 Token Ausgabe. Wächst quadratisch.
* `_MAX_MESSAGES_HARD = 200` deckelt den KI-Verlauf, nicht die 30 der ersten
  Seite. Die kleinere erste Seite ändert an den Kosten nichts.

## Offen, ausserhalb dieses Pakets

* Layout-Befunde, bewusst zurückgenommen und nicht ausgeliefert:
  Versatzschatten auf `.window__header` (ohne Aufgabe, erzeugt eine zweite
  Linie), 8-px-Versatz zwischen Verlaufs- und Verfasser-Rinne (bei 900 px
  gemessen), ungleiche Kopfhöhen. T2/T6 nehmen sie auf.
* Die schwarze Linie oben an Mikrofon und Sendeknopf fehlt, weil der
  Versatzschatten einseitig ist (`3px 3px 0 #000`) und oben nur `#333` steht.
  Das ist die brutalistische Idiomatik, keine Reparatur — Geschmacksfrage.
* `finish_reason` wird nur im Streaming-Pfad gelesen; eine abgeschnittene
  Antwort ist im normalen Pfad unsichtbar.
* `ScannerService.set_adapter_enabled()` macht `json.loads` auf einen Wert, den
  postgrest als **Liste** liefert → `TypeError` → gefangen → `current = []`.
  Ein Klick in der Verwaltung schaltet damit ALLE Quellen ab.
* `bluesky_app_password` liegt im Klartext in `platform_settings`.
