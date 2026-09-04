<!--
  Dieser Plan wurde am 04.09.2026 in Plan-Modus erstellt und vom Nutzer
  freigegeben. Er ist die Arbeitsanweisung; das Konzeptpapier dahinter steht
  als Artefakt (Verweis im Kontext-Abschnitt).

  WIEDERAUFNAHME nach Kontextverlust:
      Lies handoff/PLAN-gespraeche-ohne-dich-2026-09-04.md und setze ihn um,
      beginnend mit Schritt 0.

  Stand bei Erstellung: nichts davon ist gebaut. Schritt 0 ist die
  Voraussetzung fuer alles andere und wird allein ausgerollt.
-->

# Gespräche ohne dich — Implementierungsplan

## Kontext

Der Nutzer hat in Velgarien mit **Marie Morgenrot** und **Suse Sonnenblum** gechattet
(Faden `7b2e37c3-46ab-423c-ab18-ed54c6428dc2`, 329 Nachrichten, dritter
Teilnehmer Benno Blattgold). Zwei Wünsche:

1. Die Agenten sollen **in seiner Abwesenheit weiterreden** und sich melden,
   damit er sich wieder einklinken kann.
2. Das soll **je Gespräch** einschaltbar sein, wenn die Verwaltung es
   grundsätzlich freigegeben hat.

Beim Nachsehen des Fadens kam ein **blockierender Fehler** heraus: im
Gruppenchat vermischen sich die Sprecher, und die Person kippt zwischen Ich-
und Er-Form. Solange das steht, wird ein Wortwechsel ohne Zuschauer erst recht
Brei. Der Fehler ist deshalb Schritt 0, nicht ein Nebenpunkt.

**Konzeptpapier (Volltext):** https://claude.ai/code/artifact/8063043c-d77b-4e5c-b3f1-bbe5124af46d

**Zuschnitt (vom Nutzer bestätigt):** Reparatur + Konzept 01 (Flurfunk) +
Konzept 03 (Whisper-Weg). Der Wortwechsel landet **im selben Faden**.
Konzept 02 (Nebenzimmer) und 04 (offene Leitung) sind ausdrücklich zurückgestellt.

---

## Gemessener Befund (Beleg für Schritt 0)

79 Agentennachrichten aus dem Faden ausgezählt:

| Position | Agent | Nachrichten | Bruchstücke | mit `[Marke]` |
|---|---|---|---|---|
| 0 | Marie Morgenrot | 32 | **0** | 8 |
| 1 | Suse Sonnenblum | 32 | **9** | 5 |
| 2 | Benno Blattgold | 5 | 0 | 3 |
| — | Marie, *vor* der Gruppe (Einzelchat) | 10 | **0** | **0** |

Alle Bruchstücke auf Position 1, keines auf Position 0, keines im Einzelchat.
Beispiele: `DIESE NACHRICHT WURDE BEREITS GESENDET`, `CIN 7 984 MIRA`.

**Ursache** — `backend/services/chat_ai_service.py`, `_build_group_turn_context`
(um Zeile 1130): jeder fertige Zug der *anderen* Agenten wird mit
`role: "assistant"` an den Verlauf gehängt. Das ist im Protokoll die Zusicherung
„das bist du". Die Textmarke `[Marie Morgenrot]: ` ist nur Inhalt und verliert.
Position 0 ist unbelastet (sieht nur den Verlauf); Position 1 ist die erste,
die einen **frischen fremden Zug als eigenen** bekommt.

**Zweite Hälfte:** auch die *eigenen* früheren Züge tragen die Marke — das
Modell sieht sich beim Namen in der dritten Person und übernimmt den Ton.

**Drittes:** `_sanitize_response` (Zeile ~704) verlangt einen Doppelpunkt
(`^\[…\]:`); das Modell schreibt aber `[Benno Blattgold] *Ich hebe…` **ohne**
Doppelpunkt. Von 16 Nachrichten mit Marke fängt das Tor **null**.

---

## Schritt 0 — Der Rollen-Fehler

**Datei:** `backend/services/chat_ai_service.py`

1. In `_build_group_turn_context`: nur die Züge **des aktuellen Agenten**
   bleiben `role: "assistant"` und tragen **keine** Marke. Züge anderer Agenten
   werden `role: "user"` mit `[Name]: `-Marke.
2. Ebenso für die Schleife über `saved_messages` (die frischen Züge des
   laufenden Durchgangs) — das ist die Stelle, an der Position 1 bricht.
3. **Aufeinanderfolgende `user`-Züge zusammenfassen**, bevor sie hinausgehen.
   Manche Anbieter verlangen abwechselnde Rollen; ohne das Zusammenfassen
   bricht es bei anderen Modellen als DeepSeek.
4. `_sanitize_response`: Marke mit *oder ohne* Doppelpunkt, und nicht nur an
   Position 0. Bevorzugt gegen die **bekannten Teilnehmernamen** des Fadens
   statt gegen ein weites Zeichenmuster — sonst frisst es Regieanweisungen.
5. Prompt `chat_group_instruction` nachschärfen (Migration): „sprich
   ausschließlich als du selbst, in der Ich-Form; schreibe niemals die Zeilen
   eines anderen; stelle deinem Text keinen Namen voran." Vorlage steht in
   `supabase/migrations/20260217100000_014_chat_prompt_templates.sql:24-28`,
   Vertrag in `backend/services/prompt_contracts.py:432` (Variable
   `other_agent_names`).

**Test:** `backend/tests/unit/` — ein Test, der
`_build_group_turn_context` mit drei Agenten aufruft und prüft: kein fremder
Zug trägt `role="assistant"`, kein eigener Zug trägt eine Marke, keine zwei
`user`-Züge stehen nebeneinander. Das ist ein reiner Struktur-Test ohne LLM.

---

## Schritt 1 — Der Griff am Gespräch

**Migration** (nächste freie Nummer, aktuell 355 vergeben):
zwei Spalten auf `chat_conversations`
- `continues_without_user BOOLEAN NOT NULL DEFAULT false`
- `continue_notify TEXT NOT NULL DEFAULT 'digest'` (`never|app|digest|immediate`)
- `continue_frequency SMALLINT NOT NULL DEFAULT 1` — Wortwechsel je Takt, 0–3

Selbstprüfung nur gegen die eigene Wirkung (Spalten existieren, Default
stimmt), nie gegen Plattforminhalt.

**Backend**
- `backend/models/chat.py`: die drei Felder in `ConversationResponse` (Zeile ~75).
- `backend/routers/chat.py`: `PATCH …/conversations/:id/continuation` —
  Vorbild ist der Lock-Endpunkt. Kein Passwort nötig; aber **verweigern, wenn
  `locked` true ist** (siehe Schritt 4).
- `backend/services/chat_service.py`: Setter analog `set_locked` (Zeile 42).

**Frontend**
- `frontend/src/types/index.ts:729-752` — die drei Felder in `ChatConversation`.
- `frontend/src/services/api/ChatApiService.ts` — Methode analog
  `setConversationLock` (Zeile 32-44).
- `frontend/src/components/chat/ChatWindow.ts:1449-1524` — ein weiterer
  Icon-Knopf in `.window__header-actions`, der ein kleines Feld öffnet
  (Vorbild: das Export-Popup, Zeile 1195-1246). Darin:
  - `<velg-toggle>` „Sprecht weiter, wenn ich weg bin"
    (`frontend/src/components/shared/VelgToggle.ts`, Event `toggle-change`)
  - der Frequenzregler (siehe unten)
  - die Auswahl „Melden": vier Stufen. `<velg-tabs>` ist die nächstliegende
    vorhandene Komponente (`VelgTabs.ts`, Event `tab-change`).
- Zustand wie beim Lock: optimistisch in `_conversations` zurückschreiben
  (`ChatView.ts:491-538`).

### Der Frequenzregler

Ich habe wie gewünscht im Netz gesucht. Ergebnis: **das Werk hat schon den
besseren Regler.** `frontend/src/components/shared/VelgForecastSlider.ts` ist
ein natives `<input type="range">` mit hartkantigem Quadrat-Daumen,
Versatzschatten, Kerbe für den Vorgabewert, Zurücksetzen-Knopf,
`aria-valuetext` und tabellarischen Ziffern — passend zum Skin und zu den
Tokens.

Fremde Bausteine (`range-slider-element`, `range-slider-input`) sind
ordentlich, aber sie brächten eine Abhängigkeit, ihr CSS müsste in die
Schattenwurzel gebracht werden, und **benannte Rasten können sie auch nicht**.
Für die Frequenz sind aber genau die richtig: nicht 0–100, sondern
**still · gelegentlich · rege**.

→ `VelgForecastSlider` um ein optionales `marks: string[]` erweitern, das
Kerben und Namen unter die Bahn setzt. Alles andere (Tastatur, Barrierefreiheit,
Aussehen) bleibt geerbt, und die Erweiterung nützt auch anderen Stellen.
Quellen: [range-slider-element](https://github.com/andreruffert/range-slider-element),
[range-slider-input](https://github.com/n3r4zzurr0/range-slider-input),
[Übersicht cssscript](https://www.cssscript.com/best-range-slider-replacement-libraries/)

---

## Schritt 2 — Die Heartbeat-Phase (Konzept 01, Flurfunk)

**Neu:** `backend/services/chat/continuation_service.py`

Vorbild ist **`autonomous_event_service.py`, nicht `whisper_service.py`** —
siehe die Warnung unter „Fallstricke".

Schrittfolge (nach dem Muster von `WhisperService.generate_for_simulation`,
`whisper_service.py:106-193`):

1. Fäden laden: `chat_conversations` mit `continues_without_user = true`,
   `locked = false`, mind. 2 Agenten, letzte Nachricht älter als der
   Mindestabstand.
2. Salienz/Zeitgate wie `_evaluate_salience` (Zeile 197-324) — mindestens der
   Zeit-Riegel.
3. Kontext sammeln — **mit gedeckeltem Fenster**, siehe Kosten unten.
4. Ein LLM-Aufruf erzeugt den ganzen Wortwechsel (2–4 Züge), zweisprachig als
   JSON. Parsen wie `_parse_json_response` (Zeile 654-713); ungültiges JSON →
   kein Wortwechsel (kein Absturz, kein Template-Ersatz — ein erfundener
   Wortwechsel wäre schlimmer als keiner).
5. Züge als normale `chat_messages` in **denselben Faden** schreiben, je mit
   dem richtigen `agent_id` und `metadata.without_user = true`.
6. `agent_memories` je Beteiligtem über `AgentMemoryService.record_observation`.
7. `AIUsageService.log(...)` direkt nach `generate` — **nicht vergessen**,
   Vorbild `autonomous_event_service.py:597-604`.

**Einhängen:** `heartbeat_service.py`, neue Phase nach `bond_whispers`
(Zeile 829-838), über `_run_phase(...)` mit `**_ctx`.

**Überschreibungen:** `HEARTBEAT_OVERRIDE_KEYS` in
`backend/services/simulation_setting_contracts.py:83-105` ergänzen, z. B.
`"continuation_budget": "autonomy"`. Der AST-Test
`backend/tests/unit/test_simulation_setting_contracts.py` bindet beide
Richtungen — ein gelesener, aber nicht deklarierter Schlüssel ist rot, und
umgekehrt.

---

## Schritt 3 — Der Whisper-Weg (Konzept 03)

- Neuer Whisper-Typ `conversation` in `bond_whispers`, erzeugt aus dem
  Wortwechsel, wenn der Spieler darin vorkommt **und** eine Bindung besteht.
- Zustellung nach `continue_notify` des Fadens:
  `never` → nichts · `app` → nur die Whisper-Karte ·
  `digest` → Abschnitt in der Wochenpost · `immediate` → eigene Mail.
- Mail über `backend/services/lifecycle_mail_scheduler.py`; `already_mailed`
  (Zeile 71) ist die eine Art zu fragen, ob etwas schon hinausging.
  **Untere Fenstergrenze nicht vergessen** — sonst grüßt der erste Lauf nach
  dem Ausrollen alle rückwirkend.
- Die Mail trägt die echten Zeilen und einen Verweis auf den Faden.

---

## Schritt 4 — Verwaltung, Modell, Budget

- **Merkmalstor** `agent_continuation_enabled` in `platform_settings`,
  sichtbar im Merkmalstor-Reiter. Vorgabe **aus**.
- **Eigener Modellzweck** `agent_continuation` — `ModelResolver.resolve_text_model`
  (`model_resolver.py:235-284`) löst vierstufig auf. Der eigene Zweck ist die
  Schranke dagegen, dass eine Änderung an `model_default` den Wortwechsel
  unbemerkt teuer macht (Handoff `denkmodell-als-standard-2026-09-02.md`).
- **Budget** über `ai_budget` (Migration 228) auf den Zweck. `BudgetContext`
  ist bei `OpenRouterService.generate` **Pflicht** —
  `backend/tests/unit/test_llm_calls_carry_budget.py` erzwingt es per AST.
- **Verschlossene Fäden sind ausgenommen.** Serverseitig: der
  Fortsetzungs-Endpunkt verweigert bei `locked = true`, und die Phase filtert
  sie ohnehin heraus. Begründung: wer verschließt, hat eine Geste gemacht;
  ein Agent, der daraus in der Wochenpost erzählt, verrät sie.

---

## Kosten — gemessen, nicht geschätzt

Aus `ai_usage_log` auf Produktion, letzte 200 Aufrufe mit `purpose = 'chat'`:

    Modell   deepseek/deepseek-v4-flash (186 von 200)
    Mittel   21.940 Eingabe + 261 Ausgabe = 22.201 Token → 0,18 Cent je Aufruf

**Die 21.940 sind der Hebel.** Der Chat schickt bis zu 60 % des Kontextfensters
als Verlauf mit (`_HISTORY_BUDGET_RATIO`, `chat_ai_service.py:74`) — bei einem
Faden mit 329 Nachrichten ist das die ganze Geschichte.

| | je Wortwechsel | je Welt/Monat | 16 Welten |
|---|---|---|---|
| voller Verlauf (wie heute) | 0,18 Cent | 6,48 $ | **103 $** |
| gedeckeltes Fenster (~3.400 Token) | 0,028 Cent | 0,10 $ | **1,59 $** |

*(2 Wortwechsel je Takt, 6 Takte am Tag, 30 Tage.)*

→ **Die Phase bekommt ein eigenes, enges Fenster** (letzte ~10 Nachrichten +
Profile + Beziehung), nicht den Chat-Verlaufsdeckel. Das ist Faktor 65 und
zugleich besser für die Qualität.

---

## Fallstricke (im Code verifiziert)

1. **`WhisperService._generate_llm` bucht `ai_usage_log` NICHT.** Nach
   `openrouter.generate(...)` fehlt der `AIUsageService.log`-Aufruf — Whispers
   erscheinen in keiner Kostenauswertung. Nicht kopieren; und getrennt
   nachziehen (eigener kleiner Commit).
2. **`role: "assistant"` heißt „das bist du".** Schritt 0.
3. **Aufeinanderfolgende `user`-Züge** müssen zusammengefasst werden.
4. **Neuer Setting-Schlüssel:** in `HEARTBEAT_OVERRIDE_KEYS` **und** im Tick
   gelesen — der AST-Test prüft beide Richtungen.
5. **`budget=`** bei jedem `OpenRouterService`-Aufruf, sonst roter AST-Test.
6. **Migration-Selbstprüfung** nur gegen die eigene Wirkung.
7. **`maybe_single_data`** statt `.maybe_single().execute()`.
8. **`get_effective_supabase`** in Routern, nie `get_supabase`.
9. **Keine rohen Hexwerte** in Komponenten-CSS; `msg()` um jeden sichtbaren
   Text; keine Backticks in `css`/`html`-Kommentaren.

---

## Prüfung

```bash
# Backend
.venv/bin/ruff check backend/
.venv/bin/python -m pytest backend/tests/unit -q

# Frontend (enthält 37 Tore + alle Tests)
cd frontend && npm run lint:full
```

**Ende zu Ende, gegen Produktion:**

1. Schritt 0 nachmessen — dieselbe Auszählung wie oben, gegen den Faden
   `7b2e37c3-46ab-423c-ab18-ed54c6428dc2` **nach** dem Ausrollen und ein paar
   neuen Zügen. Erwartung: null Bruchstücke auf Position 1, null Marken.
   Der Zugang zur Produktionsdatenbank läuft über den Container:
   `ssh metaspots "docker exec a6exg3b5euhidpc2r5009o0m-… python3 -c '…'"`
   mit `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` aus dessen `printenv`.
2. Schalter im Browser umlegen, einen Heartbeat-Takt abwarten (4 h Vorgabe
   oder von Hand auslösen), prüfen: neue Nachrichten im Faden mit korrektem
   `agent_id`, `metadata.without_user = true`, `agent_memories` gewachsen.
3. `ai_usage_log` auf `purpose = 'agent_continuation'` prüfen — die Zeile muss
   da sein, sonst ist Fallstrick 1 wieder passiert.
4. Verschlossenen Faden gegenprüfen: Schalter verweigert, Phase überspringt.

**Ausrollen** (kein Auto-Deploy beim Push):
`POST /api/v1/deploy?uuid=a6exg3b5euhidpc2r5009o0m` gegen `127.0.0.1:8000` auf
`metaspots`, Bearer-Token. Danach `<meta name="velg-release">` gegen den
Commit prüfen — mehrfach abfragen, ein einzelner Aufruf mitten im Ausrollen
misst den alten Behälter.

---

## Reihenfolge

Schritt 0 zuerst und **allein ausrollen** — er ist die Voraussetzung und
zugleich der einzige, dessen Wirkung sich an vorhandenen Daten nachmessen
lässt. Dann 1, 2, 3, 4. Schritt 4 (Merkmalstor + Modellzweck + Budget) muss
**vor** dem ersten Lauf von Schritt 2 stehen, sonst läuft der erste Wortwechsel
auf `model_default`.
