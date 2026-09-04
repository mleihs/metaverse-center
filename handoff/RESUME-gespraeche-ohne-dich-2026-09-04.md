# Gespräche ohne dich — Stand Abend 04.09.2026

**Der Plan:** `handoff/PLAN-gespraeche-ohne-dich-2026-09-04.md` (freigegeben, `a5faedad`).
Diese Datei ist der Stand der Umsetzung. Bei Wiederaufnahme: hier lesen, dann
im Plan weiter.

> ⚠ **Der Plan hat den Fehler EINER Ursache zugeschrieben — es waren fünf.**
> Vier kamen erst beim Messen heraus, und eine davon (ein Sprach-Widerspruch
> zwischen zwei Dateien) war größer als der Befund, mit dem der Plan anfing.
> Lies „Die fünf Ursachen", bevor du dem Plan folgst.
>
> ⚠ **Decknamen.** Agenten heißen hier Marie Morgenrot, Suse Sonnenblum,
> Benno Blattgold. Das sind PLATZHALTER; die echten Namen und der Wortlaut der
> Gespräche gehören nicht in dieses Verzeichnis.

---

## Alles ist live

Migrationen **355–369** auf Prod angewendet, Code ausgerollt und geprüft.
Aus dem Plan sind Schritt 0 bis Schritt 4 fertig.

Die drei neuen Merkmalstore stehen auf **AUS**:

| Tor | wirkt auf |
|---|---|
| `agent_continuation_enabled` | ob Agenten ohne den Menschen weiterreden |
| `continuation_mail_enabled` | ob daraus Post wird |
| `focalization_model_check_enabled` | die teure Eichstufe der Messung (**nicht gebaut**) |

Nichts davon läuft, bevor jemand es in Admin → Plattform → Merkmalstore öffnet.

---

## Das Ergebnis, Ende zu Ende gemessen

Frischer Faden über die Oberfläche auf Prod, **dieselbe Besetzung** wie der alte:

```
                       Züge   allwissend   im Horizont    Quote
ALT (373 Nachrichten)   219           32           180   14,6 %
FRISCH                    6            0             6    0,0 %
```

Null Marken, null CIN-Bruchstücke.

**Sechs Züge sind wenig** — das gehört zur Zahl dazu. Der bessere Beleg ist der
zweite Prompt, weil er die Bedingung HERSTELLT, statt auf sie zu warten:

> „Beschreibt mir die Szene im Raum. Was tun die drei Frauen am Tisch, und was
> denkt jede von ihnen gerade?"

Alle drei blieben in ihrer eigenen Wahrnehmung und beschrieben, was sie SEHEN.
Keine sagte, was eine andere denkt — obwohl genau danach gefragt war.

---

## Die fünf Ursachen

### 1. Rollenvermischung im Protokoll → Migration 356

Jeder fertige Zug der ANDEREN ging mit `role: "assistant"` hinaus. Das ist im
Chat-Protokoll keine Beschriftung, sondern eine Zusicherung: „das hast du
gesagt". Gemessen an den echten 329 Nachrichten des Fadens
`7b2e37c3-46ab-423c-ab18-ed54c6428dc2`:

| | fremde Züge als ICH | eigene Züge mit Namensmarke |
|---|---|---|
| Marie Morgenrot | 37 → **0** | 146 → **0** |
| Suse Sonnenblum | 151 → **0** | 32 → **0** |
| Benno Blattgold | 178 → **0** | 5 → **0** |

Doppelte `user`-Züge: 36/264/319 roh → 0. Zwei Namensmarken übereinander: 32 → 0.

Fremdmessung derselben Sache: MultiLIGHT (arXiv:2304.13835) misst **25,5 %
falsche Figur** ohne Mehrparteien-Erdung, 2,2 % mit.

### 2. Der Mensch hatte keine Marke → Migration 364

Seine Zeile stand ohne Besitzer in einem Block voller beschrifteter — und das
Zusammenfassen aufeinanderfolgender `user`-Züge aus 356 hat es verschärft.
Der Nutzer schrieb es den Agenten selbst (Wortlaut nicht wiedergegeben)). Jetzt
`[User]: `, sobald mehr als ein Agent im Faden ist.

### 3. Zwei Dateien, zwei Antworten auf dieselbe Frage → 366 + `get_content_locale`

```
ChatAIService._get_locale()              →  "de"
PromptResolver._get_simulation_locale()  →  "en"
```

**Keine der 41 Welten** hatte `general.content_locale` gesetzt. Der Chat fragte
nach einer deutschen Vorlage, fand keine, und Stufe 2 des Auflösers gab ihm die
ENGLISCHE welteigene. Der Agent bekam:

- englischen Rahmen um eine deutsche Figur
- „Acknowledge the party's Citizen Identification Number (CIN)" → **daher die
  CIN-Bruchstücke**, die der Plan der Rollenvermischung zuschrieb
- **kein `{agent_memories}`**, kein `{agent_mood}` → ein Agent hatte 195
  Erinnerungen in der Datenbank, keine ist je in einen Prompt gelangt

Drei von vier welteigenen Vorlagen fehlten beide Platzhalter. Der Vertrag kennt
jetzt `required` und die Fehlerart `MISSING`; `sanitize_template` **hängt an**
(die einzige Regel, die einfügt statt zu schneiden). Eine Antwort auf die
Sprachfrage: `get_content_locale` in `backend/utils/settings.py`.

### 4. Die Regel stand VOR dem Verlauf → `_append_closing_instruction`

Position 0 von 9 — bei 373 Nachrichten mit zweihundert Zügen dazwischen. Jetzt
unmittelbar vor der Antwort. Der Praktiker-Konsens trägt den einzigen
quantifizierten Datenpunkt des Feldes: **37 von 40** sauberen Durchläufen an
dieser Stelle.

Angehängt an den letzten `user`-Zug, **nicht** als eigene `system`-Nachricht:
eine `system`-Rolle mitten im Verlauf ist bei OpenAI-kompatiblen Anbietern
nicht verlässlich.

### 5. Geliehenes Wissen → `_bound_to_perspective`

`_load_history` gab jedem Agenten den GANZEN Faden, auch das, was vor seinem
Beitritt geschah:

```
Marie        0 Nachrichten vor Beitritt   10,8 % allwissend
Suse       228 Nachrichten vor Beitritt   18,2 %
Benno      309 Nachrichten vor Beitritt   41,2 %
```

Monoton, Faktor vier. **Drei Punkte sind kein Beweis** — aber die Richtung ist
die, die arXiv:2606.25632 vorhersagt (+34,6 pp Knowledge Boundary Fidelity bei
~79 % Gewinnrate in der Erzählqualität).

Verlauf UND Verdichtung sind jetzt an den Beitritt gebunden. Die JÜNGSTE Szene
überlebt die Grenze — sie ist der Raum, in den jemand eintritt.

---

## Zwei eigene Fehldiagnosen, beide teuer

**Die dritte Person war nicht der Fehler.** Ich hielt „die Figur schreibt über
sich in der dritten Person" für die Krankheit und schrieb „sprich in der
Ich-Form" in die Vorlage. Falsch: das ist im Rollenspiel die Konvention
(Ali:Chat schreibt sie vor). Der Fehler ist der **Geltungsbereich** — „die drei
Frauen verharren" ist ein Satz über alle drei. Migration 367 ersetzt die
Forderung durch den **Wahrnehmungshorizont**, und ihre Selbstprüfung weist eine
Ich-Form-Forderung ausdrücklich ab, damit der Irrtum nicht zurückkommt.

**Betreffe sind das falsche Messgerät für eine Historien-Umschreibung.** Ich
hielt einen Peer-Commit für verloren, weil ich nach Betreff verglichen habe —
und eine Anonymisierung ändert genau den. `git cherry` vergleicht nach Inhalt
und zeigte: nichts fehlte.

---

## Was gebaut und ausgerollt, aber nicht scharf ist

### Schritt 1 — der Griff (Migration 357)

Drei Spalten auf `chat_conversations`: `continues_without_user`,
`continue_notify` (`never|app|digest|immediate`), `continue_interval_hours`.

⚠ **Abweichung vom Plan, vom Nutzer verlangt:** fünf Stufen mit
STUNDENANGABE statt `continue_frequency` 0–3. Gespeichert werden die Stunden
selbst (4|6|12|24|48), nicht ein Stufenindex — „je Takt" hätte an der
Taktlänge gehangen, und ein Admin, der `heartbeat_interval_seconds` ändert,
hätte damit jede Einstellung jedes Gesprächs verschoben.

Die fünf Zahlen stehen an **drei** Orten, zweifach aneinander gebunden:
- CHECK in 357 ↔ `Literal[4,6,12,24,48]` → `test_conversation_continuation.py`
- CHECK in 357 ↔ `CONTINUE_HOURS` → `frontend/tests/continuation-steps.test.ts`

`VelgForecastSlider` trägt jetzt optionales `marks: SliderMark[]`. Fremde
Bausteine geprüft (`range-slider-element`, `range-slider-input`) — beide ohne
benannte Rasten.

### Verdichtete Vorgeschichte (358/359/360)

Anlass: ein Fenster von zehn Nachrichten trägt den eingespielten Charakter
eines Agenten nicht.

- **arXiv:2512.12775** — Persona-Drift tritt INNERHALB des Fensters auf. Mehr
  Verlauf heilt ihn nicht.
- **arXiv:2601.00821** — wörtliche Ausschnitte 43,9 % gegen 28,0 % extrahierte
  Fakten (LoCoMo). Vereinigung, nicht Ersatz.
- **arXiv:2308.15022** — rekursives Zusammenfassen häuft Fehler an.

Daraus: **jeder Abschnitt (40 Nachrichten) wird genau einmal verdichtet, aus
seinen eigenen Nachrichten, und nie wieder angefasst.**

**Loch, das dabei auffiel und behoben ist:** der Gruppenchat spritzte weder
`agent_memories` noch Beziehungskontext ein — beides ging NUR in den
Einzelchat. Wer mit Marie allein sprach, redete mit einer Figur, die sich
erinnerte; wer sie zu zweit ansprach, mit einer, die bei null anfing.

### Schritte 2+4 — Phase, Tor, Zweck (361/362/365)

`backend/services/chat/continuation_service.py`, Heartbeat-Phase 9.8.

- Merkmalstor `agent_continuation_enabled`, **Vorgabe AUS**, fail-closed.
- Eigener Zweck `agent_continuation` (nicht `model_default` —
  `denkmodell-als-standard-2026-09-02`).
- Ein Modellaufruf je Faden für den GANZEN Wortwechsel (2–4 Züge, JSON).
- Enges Fenster: 10 Nachrichten + Verdichtung. **Faktor 65** (1,59 $ statt
  103 $ je Monat, 16 Welten).
- Ein Zug mit unbekanntem Sprecher wird VERWORFEN, nicht geraten.
- `fn_due_continuations` (365): Zeit-Riegel und Besetzungsprüfung in SQL statt
  in Python mit N+1.

### Schritt 3 — der Flüster-Weg (363)

Whisper-Typ `conversation`, Zustellung nach `continue_notify`. Zwei Sweeps in
`lifecycle_mail_scheduler.py` mit `_last_sent_at` als Untergrenze — der
wiederkehrende Geschwister von `already_mailed`. **Ohne ihn grüßt der erste
Lauf nach dem Ausrollen alle rückwirkend.**

Ein einziger Insert für alle Bindungen eines Fadens, alles oder nichts: sie
gehören demselben Menschen, und eine halbe Zustellung sähe aus wie ein halber
Wortwechsel ohne Anhaltspunkt, dass etwas fehlt.

### Fokalisierungs-Detektor (368/369)

Drei Anhaltspunkte, kostenlos, auf JEDEM Zug bei der Ablage:
Kollektivbezeichnung gegen die Teilnehmerzahl gebunden · fremdes Innenleben
(Innenverben) · zwei Beteiligte in einem Satz ohne erste Person.

Die Auswertung ist eine **View mit zwei Quoten**, kein Python. Zwei Quoten,
weil die erste Fassung der Heuristik `internal` nie zurückgab und die View
darum 100 % für 18 von 219 Zügen meldete — eine Quote, deren Nenner nur die
Treffer waren.

Soweit die Recherche reicht, ist das die einzige Umsetzung von *Says Who?*
(arXiv:2409.11390, F1 84,8 %) als Regressionstor auf Agentenausgaben.

---

## Was fehlt, und warum

| | Beleg | warum nicht |
|---|---|---|
| **Zugreihenfolge / Schweigen** | Inner Thoughts (CHI 2025), 82 % vorgezogen | ändert das Produktgefühl — Nutzerentscheidung. ⚠ Und der schweigsame Agent wurde von **7 von 12** als schlechtester bewertet: die Regel (Wortlaut nicht wiedergegeben) ist womöglich selbst ein Fehler |
| **Neuversuch bei erkannter Allwissenheit** | die Lücke, die beide Gutachten als *im Feld ungefüllt* bezeichnen | kostet ~15 % mehr Aufrufe. Nichts hat sich heute selbst scharfgestellt |
| **Modellstufe des Detektors** | ohne sie weiß niemand, wie oft die Heuristik irrt | deklariert (`wired=False`), Tor aus, nicht gebaut |
| **Struktureller Weltzustand** | Versu, Generative Agents | die Szene ist ein KANAL; automatisch schreibt niemand hinein. NCP-Bench: Erzähler-Agenten erzeugen **40–68 % Faktenkonflikte** |
| **`WhisperService._generate_llm` bucht `ai_usage_log` nicht** | — | eigener Befund, nicht Teil des Plans; Bond-Whispers tauchen in keiner Kostenauswertung auf |

**Nicht anwendbar, geprüft:** der stärkste Praktiker-Rat („prüfe
Eröffnungsnachrichten und Beispieldialoge") — dieses Werk hat **keine solchen
Felder**. Die frühen Züge des alten Fadens sind alle `internal`; die
Allwissenheit ist aus dem eigenen wachsenden Verlauf entstanden.

---

## Recherche

Drei Gutachten: Praktiker-Gemeinde, akademische Literatur, ausgelieferte
Produkte.

- **Ein eigener Erzähler als eigene Stimme im Protokoll ist in KEINEM
  untersuchten kommerziellen Produkt ausgeliefert.** Die funktionierenden
  Umsetzungen sind quelloffen — SillyTaverns `/sys`, Agnais `ScenarioBook`,
  AgentVerses `describer`. SillyTavern hat den Erzähler ALS FIGUR zwei Jahre
  versucht und verworfen (Issue #235).
- Ein eigener Kanal gilt für den **ZUSTAND**, nicht für den TEXT. Versu:
  Kernmodell strukturiert und für Figuren unzugänglich, Prosa daraus gerendert
  und auf eine Figur fokalisiert.
- Perspektive gehört ins **Gedächtnis**, nicht in den Prompt. +34,6 pp.
- **Kein Papier führt das Experiment durch, das wir bräuchten** — alle vier
  Optionen wurden gewählt, keine verglichen.

---

## Drei Tore mit blindem Fleck (plus zwei)

Alle drängten zum Rückbau einer richtigen Änderung. Erweitert, nicht umgangen —
die Begründung steht jeweils im Tor selbst.

1. **`test_prompt_contracts`** führte seine Namenszuordnung je Funktion. Ein
   Dienst, der die Vorlage einmal auflöst und weiterreicht, war unsichtbar.
2. **`test_ai_purposes`** sah nur Zweck-LITERALE. Ein Dienst mit
   `PURPOSE = "chat_digest"` sah unbenutzt aus.
3. **`test_heartbeat_entry_types`** las jede Zeichenkette NACH dem
   `ADD CONSTRAINT` — und brach an der ersten Migration, die ihre eigene
   Wirkung PRÜFT. Jetzt liest es nur den `ARRAY[…]`-Block.

Dazu zwei Tore im Lebenszyklus-Mailer und `lint-model-call-handlers.sh`
(brauchte `OpenRouterError`, die Basisklasse, in beiden except-Tupeln).

## Und drei Tests, die grün waren, ohne etwas zu prüfen

- Der Fall zum geschützten Leerzeichen im Regler verglich gegen ein
  GEWÖHNLICHES Leerzeichen.
- `test_die_zustellart_steht_drin` rief auf und behauptete nichts.
- `test_kein_security_definer` traf erst den Kommentar, dann die
  Fehlermeldung — es maß die Beschreibung, nicht die Sache.

---

## Prüfstand

```bash
.venv/bin/ruff check backend/
.venv/bin/python -m pytest backend/tests/unit -q -p no:randomly   # 3777 grün
cd frontend && npm run lint:full
bash scripts/lint-model-call-handlers.sh
```

⚠ **Nie `ruff format backend/` über den ganzen Baum.** Der Durchlauf hat
279 fremde Dateien umformatiert. Nur die eigenen Pfade angeben.

⚠ **Geteilter Baum.** Eine zweite Sitzung (`velgarien-rebuild-af`) arbeitet
mit, unter anderem an den Landing-/Atlas-Dateien. Nur eigene Pfade committen;
bei Historien-Arbeit vorher Bescheid geben.

⚠ **CI meldet weiter „failed", und das ist NICHT der Code.** Fünf von sechs
Jobs sind grün (Lint/Test Frontend, Lint/Test Backend, Backend Lock
Divergence); rot ist allein **`Sentry Release`** — `gh secret list` liefert für
das Repo gar nichts. Der Job war nie konfiguriert und hat nur erstmals seit
Tagen seine Bedingung erreicht. Braucht den Sentry-Token des Nutzers.

---

## Ausrollen (für das nächste Mal)

Kein Auto-Deploy beim Push.

1. Migration: Trockenlauf in `BEGIN … ROLLBACK` mit Proben, dann derselbe Text
   mit `COMMIT` und der `schema_migrations`-Zeile in DERSELBEN Transaktion.
   Management-API
   `POST https://api.supabase.com/v1/projects/bffjoupddfjaljqrwqck/database/query`,
   Bearer aus `SUPABASE_MCP_TOKEN` in `.env`.
2. `git push origin main`
3. `ssh metaspots "curl -s -X POST -H 'Authorization: Bearer <token>'
   'http://127.0.0.1:8000/api/v1/deploy?uuid=a6exg3b5euhidpc2r5009o0m'"`,
   Token in `~/.config/metaspots/coolify-api.token`. ~6 Minuten.
4. `<meta name="velg-release">` prüfen — **MEHRFACH** abfragen: mitten im
   Ausrollen laufen zwei Behälter, und ein einzelner Aufruf misst den alten.

### Wenn jemand die Tore öffnet, zu prüfen

- Schalter im Browser umlegen, einen Takt abwarten (12 h Vorgabe).
- Neue Nachrichten im Faden mit korrektem `agent_id` und
  `metadata.without_user = true`.
- `ai_usage_log` auf `purpose = 'agent_continuation'` UND `'chat_digest'` —
  die Zeilen müssen da sein, sonst ist Fallstrick 1 des Plans wieder passiert.
- `chat_conversation_digests` wächst.
- Verschlossenen Faden gegenprüfen: Schalter verweigert (400), Phase
  überspringt.
- `v_focalization_rates` im Blick behalten: die Quote soll bei null bleiben.

---

## Zwei offene Entscheidungen des Nutzers

1. **Der alte Faden und die 208 Erinnerungen sind unangetastet.** Der Auftrag,
   beides zu löschen, wurde vom Nutzer selbst unterbrochen (Wortlaut nicht wiedergegeben)) und nie wieder aufgenommen.
2. **16 Zeilen im Bestand** tragen eine fremde Namensmarke unter eigener
   `agent_id`. Sie werden beim LESEN weggeschnitten
   (`_strip_speaker_labels`); der Bestand ist unangetastet. Ob sie auch in der
   Datenbank fallen sollen, ist eine Entscheidung über fremde Gesprächsdaten.
