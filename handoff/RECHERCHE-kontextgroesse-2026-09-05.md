# Wie andere es machen — Recherche zur Kontextgröße, 05.09.2026

**Anlass.** Der Chat schickte pro Agentenzug ~61 500 Eingabe-Token, bei drei
Figuren also ~184 000 pro Nutzernachricht. Die Frage war, ob das dem Stand
der Technik entspricht.

**Antwort: nein, deutlich nicht.** Vier parallele Rechercheure gegen neun
Referenzsysteme, sechs Frameworks, fünf API-Anbieter und rund 45 Arbeiten.
Alle Zahlen unten sind belegt; wo nichts Belastbares zu finden war, steht das
ausdrücklich.

---

## 1. Die Absolutzahlen

Auslieferungswerte für den **gesamten** Prompt:

| System | Kontext | wörtlicher Verlauf |
|---|---|---|
| SillyTavern | 8 192 | FIFO, alles |
| Oobabooga | 8 192 | FIFO |
| KoboldCpp | 12 288 | FIFO + Context Shifting |
| RisuAI | 4 000 | FIFO im Auslieferungszustand |
| Janitor JLLM | 8–9 000 | FIFO |
| AI Dungeon | 4k–32k je Tarif | ~15–50 % des Fensters |
| Chub | nur „Soji 60K" offiziell | „so viel wie passt" |

**Drei unabhängige Quellen nennen 32k als OBERGRENZE für den ganzen Prompt:**
die SillyTavern-Community, Janitors offizielle Hilfe (*„most models work best
with a context of 16 384 … Avoid: 32k+"*, Begründung *„slower and more
forgetful"*) und AI Dungeons höchster Tarif (Mythic, 32k).

Unsere 61 500 waren allein der Verlauf — dreimal pro Nutzernachricht.

**Keines der Systeme benutzt LangChain**, LlamaIndex, mem0, Letta oder Zep.
Selbst nachgesehen in den Abhängigkeitsdateien von SillyTavern, RisuAI,
Oobabooga und KoboldCpp: null Treffer.

---

## 2. Die drei Konstruktionsprinzipien, die uns fehlten

### 2.1 Verdichtung ERSETZT den Wortlaut, sie tritt nicht daneben

Bei Letta, LlamaIndex, AI Dungeon und Anthropic verdrängt die Zusammenfassung
den Originaltext. **Keine untersuchte Referenz hält beides zugleich.**

Chub hat exakt unseren Fehler schon behoben und schreibt es in die Doku:

> *„We only summarize the messages that are out of context (aka messages that
> the AI no longer remembers)."*

Vorher fassten sie den ganzen Verlauf zusammen — als Tokenverschwendung
ausdrücklich korrigiert.

### 2.2 Das wörtliche Fenster ist klein

| Referenz | wörtlich behalten |
|---|---|
| LangChain `SummarizationMiddleware` | `keep=("messages", 20)` |
| Qvink (SillyTavern-Erweiterung) | letzte 10, Rest nur als Zusammenfassung |
| RisuAI | mindestens 3 |
| AI Dungeon historisch | 20 Züge (`self.memory = 20`) |
| LlamaIndex | 70 % von 30 000 = ~21 000 Token |
| Letta | Message Buffer, Rest nur per Werkzeugaufruf |
| Zep | gar keiner — ~1 600 Token Graphfakten |

**MemDelta** misst, dass wörtlicher Abruf mit ~5 000 Token die volle Historie
statistisch einholt (47,2 gegen 49,8, p = 0,34).

### 2.3 Im Gruppenchat antwortet nicht jede Figur

SillyTavern lässt per Vorgabe **eine** Figur pro Nutzernachricht antworten,
und nur deren Karte geht in den Kontext. **Der 3×-Multiplikator hat in keinem
untersuchten System eine Entsprechung.**

---

## 3. Was gegen Kürzen spricht — und was die Literatur wirklich sagt

⚠ **Die Formel lautet „wörtlich, aber weniger davon", NICHT „verdichtet statt
wörtlich".**

* Wörtliche Ausschnitte liegen **22,0 Punkte VOR** extrahierten Artefakten.
* **HaluMem**: ~40 % der extrahierten Gedächtnisinhalte sind fehlerhaft.
* Komprimierte Beispiele schneiden schlechter ab als gar keine.

Meine erste Fassung des Plans lautete „die Verdichtung soll den Wortlaut
ersetzen". Das war falsch, und die Recherche hat es korrigiert.

---

## 4. Warum trotzdem kürzen: die Qualität, nicht Geld oder Zeit

**Nicht die Kosten.** 61 500 Token kosten über OpenRouter **0,42 US-Cent je
Zug**. 10 000 Züge = 42 Dollar.

**Nicht die Latenz — gemessen an unseren eigenen 379 Aufrufen:**

```
Korrelation Eingabe-Token ↔ Dauer:   r = −0,063
Korrelation Ausgabe-Token ↔ Dauer:   r = +0,234

  0–5 000 Eingabe-Token  →  ⌀ 18 722 ms
 55 000+ Eingabe-Token   →  ⌀ 12 125 ms
```

Die größeren Prompts sind im Schnitt **schneller**. `deepseek-v4-flash` ist
ein MoE-Modell mit hohem Prefill-Durchsatz; 300 Ausgabe-Token bei ~30 tok/s
sind zehn Sekunden, der Prefill von 60k ein bis zwei. **Das widerlegt das
stärkste Argument der Literatur für unseren Fall.**

**Sondern die Qualität:**

| Befund | Zahl |
|---|---|
| LongMemEval, ganze Historie (~115k) gegen gezielten Abruf | 87,0 → **60,6** |
| LaRA: Umschlagpunkt, ab dem langer Kontext verliert | zwischen 32k und 128k |
| NoLiMa: effektive Länge GPT-4o bei nicht-wörtlichem Treffer | **8k** |
| Zep: 1 600 statt 115 000 Token | 71,2 % gegen 63,8 % (**besser**) |
| Anthropic Context Editing, intern | −84 % Token, +29 % Qualität |

### ⚠ Und der Grund, der ausgerechnet uns trifft

Bei **Perspektivgrenzen** ist voller Wortlaut aktiv schädlich:

* **LoCoMo adversarial**: 70,2 → **2,1** im Langkontext.
* **ReverieMem-Ablation**, der Zielkonflikt direkt: besseres Erinnern
  zerstört das Verweigern — **79,6 / 47,0** gegen **68,1 / 81,2**.
* **Governance Decay**: Regel überlebt die Zusammenfassung = 0 % Verstöße;
  Regel fällt weg = 38 %.

Genau das ist dieses System. Eine Figur, die nicht wissen *darf*, was vor
ihrem Beitritt geschah, verliert diese Grenze mit jedem Token mehr.

---

## 5. Unsere eigenen Messungen

### Der Prompt eines Zuges, gezählt (vor dem Umbau)

```
SYSTEM-Prompt                    9 512 Token
  Erinnerungsabruf (top_k=8)       692   ← ändert sich JEDEN Zug
  Beziehungen                       33
  Verdichtung (8 Prot + 8 Ich)   8 095
  Persona / Vorlage / Sprache      690
VERLAUF (101 Züge, 200 Nachrichten)  43 147
Schlussanweisung                   422
─────────────────────────────────────────
GESAMT                          52 659 Token   (bis 61 565 gemessen)
```

### Vier Befunde

1. **Das 60-%-Verhältnis entschied nichts.** Bei deepseek-v4 (1-Mio-Fenster)
   erlaubte es 2 380 Nachrichten; gebunden hat `_MAX_MESSAGES_HARD = 200`,
   kommentiert mit *„prevent huge DB queries"*. Eine Abfrageschranke war die
   Kontextpolitik.
2. **175 von 200 Nachrichten standen doppelt** — einmal verdichtet, einmal im
   Original.
3. **Drei Cache-Brecher**, alle gemessen: der Erinnerungsblock an Position
   2 804 von 38 049 (7 % gemeinsamer Präfix zwischen zwei Zügen), das
   rutschende 200er-Fenster, und der je-Figur verschiedene System-Prompt.
4. **Wir messen Cache-Treffer gar nicht.** `OpenRouterService` liest
   `prompt_tokens`, `completion_tokens`, `total_tokens` — nicht
   `prompt_tokens_details.cached_tokens`. `ai_usage_log.metadata` ist leer.

### Nebenbefund zum Caching

**DeepSeek bedient unser Modell auf OpenRouter nicht selbst** — alle 15
Anbieter sind Dritte. DeepSeeks eigener 31-facher Cache-Rabatt greift nie;
die Dritten geben ~4–5×, einer (Mancer 2) gar keinen.

---

## 6. Was gebaut wurde

| Commit | |
|---|---|
| `f44e35f8` | Verdichtung nur noch für das, was aus dem Fenster fiel (`verbatim_from`); Fenster 200 → **40** (`_VERBATIM_WINDOW`) |
| `43e89576` | Der Widerspruchs-Erkenner (Migrationen 383/384), Tor **AUS** |
| — | `chat_speaker_selection_enabled` auf **AN** gestellt |

### Wirkung, gegen Produktion gemessen

```
je Figur            52 659  →  14 452 – 18 445 Token
je Nutzernachricht 132 252  →  ~50 200 Token
Verlauf                200  →  40 Nachrichten (21 Züge nach Verschmelzen)
```

---

## 7. Was offen bleibt

**Die Qualitätsmessung.** Der Umbau ist mit *Qualität* begründet und die ist
noch nicht nachgemessen. Die Recherche sagt auch, wie:

> **Vier Ablationsläufe, mit ZWEI getrennten Metriken (Erinnern UND
> Verweigern)** — eine Gesamtnote kürzt genau diese beiden Effekte
> gegeneinander weg.

Wir haben beide Metriken schon: den Fokalisierungs-Detektor (Verweigern /
im Horizont bleiben) und die Selbstbündelungszählung. Das Handmessprotokoll
in `RESUME-gespraechssystem-2026-09-05-abend.md` ist der Rahmen dafür.

**Die vier Läufe:** (a) wie heute, (b) ohne Verdichtung, (c) ohne Vektorabruf,
(d) ohne beides. Unsere Dreierkombination ist in der Literatur **unbelegt** —
keine Arbeit misst Wortlaut + Verdichtung + Vektorabruf gleichzeitig.

**Und die zweite offene Frage:** ob `MAX_DIGESTS_IN_PROMPT = 8` je Block noch
passt. Mit dem 40er-Fenster ist die Verdichtung jetzt der größte Block
(8 139 von 18 445 Token bei einer Figur) — und die Literatur sagt, dass
Wortlaut besser trägt als Zusammenfassung.

---

## Quellen

**Forschung:** LongMemEval ([arXiv:2410.10813](https://arxiv.org/pdf/2410.10813)) ·
MemGPT ([arXiv:2310.08560](https://ar5iv.labs.arxiv.org/html/2310.08560)) ·
Zep ([arXiv:2501.13956](https://arxiv.org/abs/2501.13956)) ·
mem0 ([arXiv:2504.19413](https://arxiv.org/abs/2504.19413)) ·
[Chroma Context Rot](https://www.trychroma.com/research/context-rot)

**Frameworks:** [Letta Compaction](https://docs.letta.com/guides/core-concepts/messages/compaction/) ·
[LangGraph Memory](https://docs.langchain.com/oss/python/langgraph/add-memory) ·
[LangChain Middleware](https://docs.langchain.com/oss/python/langchain/middleware/built-in) ·
[LlamaIndex Memory](https://developers.llamaindex.ai/python/framework-api-reference/memory/memory/) ·
[OpenAI Agents Sessions](https://openai.github.io/openai-agents-python/sessions/) ·
[Anthropic Context Editing](https://platform.claude.com/docs/en/build-with-claude/context-editing) ·
[Anthropic Compaction](https://platform.claude.com/docs/en/build-with-claude/compaction)

**Systeme:** [Chub Prompting](https://docs.chub.ai/docs/advanced-setups/prompting.md) ·
[AI Dungeon Kontext](https://help.aidungeon.com/how-do-i-manage-context) ·
[RisuAI hypav3.ts](https://github.com/kwaroran/RisuAI/blob/main/src/ts/process/memory/hypav3.ts) ·
[AI Dungeon Archiv](https://github.com/Latitude-Archives/AIDungeon/blob/master/generator/gpt2/src/model.py)

**Caching:** [DeepSeek KV-Cache](https://api-docs.deepseek.com/guides/kv_cache) ·
[OpenAI Prompt Caching](https://developers.openai.com/api/docs/guides/prompt-caching) ·
[Anthropic Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) ·
[OpenRouter](https://openrouter.ai/docs/features/prompt-caching)
