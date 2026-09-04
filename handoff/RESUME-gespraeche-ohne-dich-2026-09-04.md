# Gespräche ohne dich — Stand 04.09.2026

**Der Plan:** `handoff/PLAN-gespraeche-ohne-dich-2026-09-04.md` (freigegeben, `a5faedad`).
Diese Datei ist der Stand der Umsetzung. Bei Wiederaufnahme: hier lesen, dann
im Plan weiter.

---

## Was live ist

**Schritt 0** — der Rollen-Fehler im Gruppenchat. Auf Prod seit `25a2ae21`.
Migrationen 355 (Peer, war nicht angewendet) und 356 sind auf Prod drin.

Nachgemessen an den echten 329 Nachrichten des Fadens
`7b2e37c3-46ab-423c-ab18-ed54c6428dc2`:

| | fremde Züge als ICH | eigene Züge mit Namensmarke |
|---|---|---|
| Marie Morgenrot | 37 → **0** | 146 → **0** |
| Suse Sonnenblum | 151 → **0** | 32 → **0** |
| Benno Blattgold | 178 → **0** | 5 → **0** |

Doppelte `user`-Züge: 36/264/319 roh → 0 nach dem Zusammenfassen.
Zwei Namensmarken übereinander: 32 → 0.

Nebenbefund im Bestand: von 57 Agentennachrichten, die mit `[` beginnen, sind
**41 echte Regieanweisungen** und **16 fremde Namensmarken unter eigener
`agent_id`** (`[Suse Sonnenblum] …` gespeichert als Marie). Die 16 werden beim LESEN
weggeschnitten (`_strip_speaker_labels` in `_as_turn`); **der Bestand ist
unangetastet**. Ob sie auch in der Datenbank fallen sollen, ist eine
Entscheidung über fremde Gesprächsdaten und steht noch aus.

---

## Was gebaut, aber NICHT ausgerollt ist

Alles unten hängt zusammen und geht in EINEM Rollout live. Ein Schalter, der
nichts tut, ist schlechter als keiner.

| Commit | Inhalt |
|---|---|
| `8161ea77` | **Schritt 1** — Griff am Gespräch, Migration 357, 5-Stufen-Regler |
| `a00d29d4` | **Verdichtete Vorgeschichte** — Migrationen 358/359/360 |
| *(offen)* | **Schritte 2+4** — Phase, Tor, Zweck, Budget; Migrationen 361/362 |

### Schritt 1 — der Griff (Migration 357)

Drei Spalten auf `chat_conversations`: `continues_without_user`,
`continue_notify` (`never|app|digest|immediate`), `continue_interval_hours`.

⚠ **Abweichung vom Plan, vom Nutzer verlangt:** fünf Stufen mit
STUNDENANGABE statt `continue_frequency` 0–3. Gespeichert werden die Stunden
selbst (4|6|12|24|48), nicht ein Stufenindex — „je Takt" hätte an der
Taktlänge gehangen, und ein Admin, der `heartbeat_interval_seconds` ändert,
hätte damit jede Einstellung jedes Gesprächs verschoben.

Die fünf Zahlen stehen an **drei** Orten und werden zweifach aneinander
gebunden:
- CHECK in 357 ↔ `Literal[4,6,12,24,48]` im Backend-Modell → `test_conversation_continuation.py`
- CHECK in 357 ↔ `CONTINUE_HOURS` im Frontend → `frontend/tests/continuation-steps.test.ts`

`VelgForecastSlider` trägt jetzt optionales `marks: SliderMark[]`. Fremde
Bausteine wurden geprüft (`range-slider-element`, `range-slider-input`) — beide
ohne benannte Rasten.

### Verdichtete Vorgeschichte (358/359/360)

Anlass: der Befund, dass ein Fenster von zehn Nachrichten den eingespielten
Charakter eines Agenten nicht mehr traegt.

Die Bauform folgt drei gemessenen Befunden:
- **arXiv:2512.12775** — Persona-Drift tritt INNERHALB des Fensters auf. Mehr
  Verlauf heilt ihn nicht.
- **arXiv:2601.00821** — wörtliche Ausschnitte 43,9 % gegen 28,0 % extrahierte
  Fakten (LoCoMo). Vereinigung, nicht Ersatz.
- **arXiv:2308.15022** — rekursives Zusammenfassen häuft Fehler an.

Daraus: **jeder Abschnitt (40 Nachrichten) wird genau einmal verdichtet, aus
seinen eigenen Nachrichten, und nie wieder angefasst.** Kein Pfad führt eine
Verdichtung in eine andere.

**Loch, das dabei auffiel und behoben ist:** der Gruppenchat spritzte weder
`agent_memories` noch Beziehungskontext ein — beides ging NUR in den
Einzelchat. Wer mit Marie allein sprach, redete mit einer Figur, die sich
erinnerte; wer sie zu zweit ansprach, mit einer, die bei null anfing.

### Schritte 2+4 — Phase, Tor, Zweck (361/362)

`backend/services/chat/continuation_service.py`, Heartbeat-Phase 9.8.

- Merkmalstor `agent_continuation_enabled`, **Vorgabe AUS**, fail-closed
  (fehlt die Zeile → zu).
- Eigener Zweck `agent_continuation` (nicht `model_default` —
  `denkmodell-als-standard-2026-09-02`).
- Ein Modellaufruf je Faden für den GANZEN Wortwechsel (2–4 Züge, JSON).
- Enges Fenster: letzte 10 Nachrichten + Verdichtung. Faktor 65 gegen den
  vollen Verlauf (1,59 $ statt 103 $ je Monat, 16 Welten).
- Ein Zug mit unbekanntem Sprecher wird VERWORFEN, nicht geraten.
- Unbrauchbares JSON schreibt gar nichts — kein Vorlagen-Ersatz.

---

## Was noch fehlt

**Schritt 3 — der Whisper-Weg.** Neuer Whisper-Typ `conversation`, Zustellung
nach `continue_notify` (`never` → nichts · `app` → Whisper-Karte · `digest` →
Wochenpost · `immediate` → eigene Mail). Über
`backend/services/lifecycle_mail_scheduler.py`; `already_mailed` (Zeile 71) ist
die eine Art zu fragen, ob etwas schon hinausging. **Untere Fenstergrenze nicht
vergessen** — sonst grüßt der erste Lauf nach dem Ausrollen alle rückwirkend.

Der Rückgabewert von `ContinuationService.generate_for_simulation` trägt
`user_id`, `notify`, `locale` und `turns` schon mit; die Phase im Herzschlag
hat sie in `continuation_result`.

**Eigener kleiner Commit, bewusst nicht Teil des Plans:**
`WhisperService._generate_llm` (`backend/services/bond/whisper_service.py`)
bucht `ai_usage_log` GAR NICHT. Nach `openrouter.generate(...)` fehlt der
`AIUsageService.log`-Aufruf — Bond-Whispers tauchen in keiner
Kostenauswertung auf.

---

## Ausrollen

Kein Auto-Deploy beim Push.

1. Migrationen 357–362 auf Prod anwenden. Vorgehen wie bei 355/356:
   Trockenlauf in `BEGIN … ROLLBACK` mit Proben, dann derselbe Text mit
   `COMMIT` und der `schema_migrations`-Zeile in DERSELBEN Transaktion.
   Zugang: Management-API
   `POST https://api.supabase.com/v1/projects/bffjoupddfjaljqrwqck/database/query`,
   Bearer aus `SUPABASE_MCP_TOKEN` in `.env`.
2. `git push origin main`
3. Deploy: `ssh metaspots "curl -s -X POST -H 'Authorization: Bearer <token>'
   'http://127.0.0.1:8000/api/v1/deploy?uuid=a6exg3b5euhidpc2r5009o0m'"`,
   Token in `~/.config/metaspots/coolify-api.token`. Dauert ~6 Minuten.
4. `<meta name="velg-release">` gegen den Commit prüfen — MEHRFACH abfragen,
   ein einzelner Aufruf mitten im Ausrollen misst den alten Behälter.
5. **Das Merkmalstor bleibt AUS**, bis jemand es in Admin → Plattform →
   Merkmalstore öffnet. Vorher läuft die Phase nicht.

### Nach dem Ausrollen zu prüfen

- Schalter im Browser umlegen, einen Takt abwarten (4 h Vorgabe).
- Neue Nachrichten im Faden mit korrektem `agent_id` und
  `metadata.without_user = true`.
- `ai_usage_log` auf `purpose = 'agent_continuation'` UND `'chat_digest'` —
  die Zeilen müssen da sein, sonst ist Fallstrick 1 des Plans wieder passiert.
- `chat_conversation_digests` wächst.
- Verschlossenen Faden gegenprüfen: Schalter verweigert (400), Phase
  überspringt.

---

## Drei Tore, die einen blinden Fleck hatten

Alle drei drängten zum Rückbau einer richtigen Änderung. Erweitert, nicht
umgangen — die Begründung steht jeweils im Tor selbst.

1. **`test_prompt_contracts`** führte seine Namenszuordnung je Funktion. Ein
   Dienst, der die Vorlage einmal auflöst und weiterreicht, war unsichtbar.
   Nachgeben hätte N Netzaufrufe statt einem bedeutet.
2. **`test_ai_purposes`** sah nur Zweck-LITERALE. Ein Dienst mit
   `PURPOSE = "chat_digest"` sah unbenutzt aus.
3. **`test_heartbeat_entry_types`** las jede Zeichenkette NACH dem
   `ADD CONSTRAINT` — und brach an der ersten Migration, die ihre eigene
   Wirkung PRÜFT. Jetzt liest es nur den `ARRAY[…]`-Block.

## Und ein Test, der grün war, ohne etwas zu prüfen

Der erste Fall zum geschützten Leerzeichen im Regler verglich gegen ein
GEWÖHNLICHES Leerzeichen. Ersetzt durch zwei Fälle, die es wirklich messen.

---

## Prüfstand

```bash
.venv/bin/ruff check backend/
.venv/bin/python -m pytest backend/tests/unit -q -p no:randomly   # 3650 grün
cd frontend && npm run lint:full                                   # 1347 Tests, 37 Tore
```

⚠ **Nie `ruff format backend/` über den ganzen Baum.** Der Durchlauf hat
279 fremde Dateien umformatiert. Nur die eigenen Pfade angeben.

⚠ **Geteilter Baum.** Eine zweite Sitzung arbeitet an den Landing-/Atlas-Dateien
(`LandingNav.ts`, `LandingSeoFooter.ts`, `derive_landing_images.py`). Immer nur
die eigenen Pfade committen.

⚠ **`scripts/lint-no-em-dash-in-content.sh` ist auf `main` ROT** —
`backend/services/platform_settings_service.py:331` trägt ein U+2014, gelandet
in `188b8052` (Peer). Nicht angefasst, weil die andere Sitzung in der Datei
arbeitet.
