# Ein Denkmodell als Standard — projektweit zu prüfen

**Auftrag des Nutzers, 02.09.2026:** „ein thinking model als default ist
vielleicht generell keine gute Idee. Notier das mal, um das später projektweit
zu überprüfen."

Anlass war ein konkreter Ausfall in der Schleuse. Der Befund ist aber nicht auf
sie beschränkt, und das ist der Grund für dieses Dokument.

---

## Der Auslöser, gemessen

Der erste Scan-Zyklus auf Prod lieferte 117 Signale und **null Kandidaten aus
den Nachrichtenquellen**. Im Log:

    OpenRouter response  status 200  completion_tokens: 1024  ← exakt max_tokens
    LLM batch classification failed
    → OpenRouterError: Empty content in response

Meine erste Diagnose war falsch: ich hielt es für ein abgeschnittenes
JSON-Array und habe das Antwortbudget mit dem Stapel wachsen lassen. Es
scheiterte weiter. Erst der direkte Aufruf gegen OpenRouter zeigte die Ursache:

    Modell: deepseek/deepseek-v4-flash-0731,  EINE Überschrift
      completion_tokens : 747
      reasoning_tokens  : 709      ← 95 % der Ausgabe ist Denken
      content           : 38 Zeichen JSON

**`deepseek-v4-flash-0731` ist ein Denkmodell.** Es verbraucht das
Antwortbudget zuerst fürs Nachdenken. Reicht das Budget nicht bis zum Ende des
Denkens, kommt eine 200er-Antwort mit **leerem `content`** zurück — kein
Fehler, kein abgeschnittenes JSON, einfach nichts.

## Die Alternative, ebenfalls gemessen

Zehn Überschriften, derselbe Systemprompt, dieselbe Aufgabe:

| Modell | Dauer | Ausgabe-Token | davon Denken | Ergebnis |
|---|---|---|---|---|
| `deepseek-v4-flash-0731` | ~25 s | 747 (für EINE) | 709 | leer, scheitert |
| **`deepseek/deepseek-chat`** | **5,8 s** | **329** | **0** | **10/10 eingeordnet** |
| `deepseek/deepseek-chat-v3-0324` | 10,4 s | 337 | 0 | 10/10 eingeordnet |

Von sechzehn DeepSeek-Modellen im Katalog sind genau **zwei** keine Denkmodelle:
`deepseek-chat` und `deepseek-chat-v3-0324`. Alle anderen — einschliesslich
aller `v4-flash`- und `v4-pro`-Varianten — führen `reasoning` in ihren
unterstützten Parametern.

---

## Warum das über die Schleuse hinausgeht

### 1. Der Standard IST ein Denkmodell

    model_default      = deepseek/deepseek-v4-flash-0731   ← denkt
    model_default_dev  = deepseek/deepseek-v4-flash-0731   ← denkt
    model_research     = deepseek/deepseek-v4-flash-0731   ← denkt
    model_forge        = deepseek/deepseek-v4-pro          ← denkt
    model_fallback     = google/gemini-2.5-flash-lite      ← denkt nicht
    model_forecast     = anthropic/claude-haiku-4.5        ← denkt nicht

Vier der sechs Schlüssel zeigen auf Denkmodelle, darunter der Standard.

### 2. Es gibt Aufrufstellen mit Budgets, die das Denken allein aufbraucht

Fest im Code verdrahtete `max_tokens`, ohne Zweck-Deklaration:

| Aufrufstelle | `max_tokens` | Bewertung |
|---|---|---|
| `bot_chat_service.py` | **100** | Denken allein braucht ~700 |
| `bond/whisper_service.py` | **300** | " |
| `autonomous_event_service.py` | **512** | " |
| `personality_extraction_service.py` | **512** | " |
| `morning_briefing_service.py` | **800** | knapp |
| `prompt_service.py` | 1024 | knapp |
| `external/output_repair.py` | 2048 | vermutlich ok |
| `model_resolver.py` | 1500 | resolved `fallback` (denkt nicht) |

**Nicht alle davon sind kaputt** — die meisten laufen über
`ModelResolver.resolve_text_model(purpose)`, und ein unbekannter Zweck fällt
auf `model_fallback` zurück, das nicht denkt. **Welche wirklich auf dem
Standard landen, ist die eigentliche Prüfung** und in diesem Dokument
ausdrücklich NICHT beantwortet.

Ein Beleg, dass es nicht theoretisch ist: die Bureau-Depeschen des Scanners
antworteten im selben Lauf mit `completion_tokens: 512` bei `max_tokens: 512` —
exakt am Limit, also abgeschnitten. Sie landen trotzdem in der Datenbank; es
fällt nur niemandem auf, weil ein halber Satz wie ein Stil aussieht.

### 3. `AIPurpose.reasoning` ist deklariert und nicht angeschlossen

`backend/services/ai_purposes.py` führt je Zweck eine Stufe:

    ReasoningLevel = Literal["off", "minimal", "low", "medium", "high", "xhigh", "auto"]
    # `off` sendet {"enabled": false} und unterdrückt das Denken

Drei Zwecke stehen bereits auf `off` (`entity`, `lore`, `chunk`).

**`backend/services/external/openrouter.py` enthält das Wort `reasoning` kein
einziges Mal.**

⚠ **BERICHTIGT NOCH AM SELBEN TAG (Messung eines Peers): das stimmt, ist aber
enger als es klingt — es gibt ZWEI Modellpfade.**

    ai_utils.py:298   reasoning = get_platform_reasoning(purpose)
                      ms.setdefault("openrouter_reasoning", reasoning)

`run_ai` (pydantic-ai über `OpenRouterModel`) übersetzt die Stufe sehr wohl in
den Aufruf und protokolliert sie sogar. **Nicht angeschlossen ist sie nur im
ROHEN Client `OpenRouterService`** — und der bedient genau die Stellen aus der
Tabelle oben (`bot_chat_service`, `whisper_service`,
`autonomous_event_service`, `generation_service`, `chat_ai_service`, und bis
heute den Scanner-Klassifikator). Die Forge-Zwecke laufen über `run_ai`, dort
greift der Hebel.

Auf Prod gemessen: 13 `reasoning_*`-Einträge, 10 auf `auto`, 3 auf `off` — und
die drei sind `chunk`, `entity`, `lore`, also ausgerechnet die schwersten
Forge-Zwecke. Dort ist das Denken bereits abgestellt und die Abstellung wirkt.

🔑 **Eine Aussage über „die Plattform" muss sagen, WELCHER Pfad.** Meine
Prüfung war „steht das Wort in der Datei" — sie traf einen von zwei Wegen zum
selben Anbieter und las das Schweigen des anderen als Abwesenheit. Dieselbe
Familie wie alles andere heute.

**Ebenfalls vom Peer gemessen, mit dem `completion == max_tokens`-Rezept:**

    building_image_description   127 Aufrufe,  2 genau auf 1500  (Limit)
    portrait_description         123 Aufrufe,  1 genau auf 1500

3 von 250 Beschreibungen sind am Limit abgeschnitten — 1,2 %. Real, aber kein
Flächenbrand. Nichts liegt dort auf 100/300/512.

🔑 Dieselbe Familie wie zwei weitere Funde desselben Tages: eine Angabe, die
DASTEHT, ohne dass jemand sie liest (`sourceKindOf` in der Sensorleiste;
`reasoning` hier). Der Unterschied zwischen „erklärt" und „angeschlossen" ist
in beiden Fällen unsichtbar, solange niemand hinsieht.

### 4. Die Fehlermeldung nennt das Symptom, nicht die Ursache

`_extract_content` (openrouter.py:610):

    if not content:
        raise OpenRouterError("Empty content in response")

„Leerer Inhalt" beschreibt, was fehlt. Es sagt nicht, dass die Antwort
vollständig war und das Modell sein ganzes Budget verdacht hat. Genau diese
Unterscheidung hat mich heute etwa eine Stunde gekostet: ich habe zuerst das
JSON repariert, das gar nicht kaputt war.

**Vorschlag:** wenn `usage.completion_tokens_details.reasoning_tokens` gesetzt
ist und `content` leer, das ausdrücklich sagen — „das Modell hat alle N Token
fürs Denken verbraucht, das Budget war M". Dann findet der nächste Leser die
richtige Schraube.

---

## Was zu prüfen ist (die eigentliche Aufgabe)

1. **Jede Aufrufstelle mit festem `max_tokens` unter ~1500** durch bis zum
   Modell verfolgen. Landet sie auf einem Denkmodell, ist sie entweder still
   leer oder still abgeschnitten.
2. **`reasoning` im ROHEN Client anschliessen.** In `run_ai` ist es bereits
   verdrahtet (`ai_utils.py:298`); `OpenRouterService` fehlt es. `run_ai` zeigt,
   wie es aussieht. Aufteilung mit dem Peer abgesprochen: er nimmt den
   `OpenRouterService`-Pfad, die Schleuse bleibt bei mir.
3. **Entscheiden, ob der STANDARD denken soll.** Für Einordnen, Zusammenfassen
   und Formatieren ist Denken verschwendetes Geld und verschwendete Zeit
   (25 s gegen 5,8 s bei gleichem Ergebnis). Für Weltenbau und Lore mag es sich
   lohnen — dort steht ohnehin `model_forge`.
4. **Die Depeschen des Scanners nachlesen.** Sie sind vermutlich seit dem
   ersten Zyklus mitten im Satz abgeschnitten.
5. **Ein Tor**, das eine Aufrufstelle ohne Zweck-Deklaration meldet. Es gibt
   `AI_PURPOSES` samt Test — aber offenbar auch Aufrufer daneben.

## Was in der Schleuse sofort passiert ist

Der Klassifikator bekommt ein eigenes Modell statt des Standards. Alles Weitere
gehört in diese Prüfung, nicht in eine Nebenbei-Reparatur.
