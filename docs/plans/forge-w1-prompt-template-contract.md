---
title: "W1 — Der Vertrag für KI-erzeugte Prompt-Vorlagen"
id: doc-forge-w1-prompt-template-contract
version: 1.0
lang: de
type: plan
status: implementing
date: 2026-08-30
tags: [forge, prompt-templates, ai, contract, data-repair]
---

# W1 — Der Vertrag für KI-erzeugte Prompt-Vorlagen

> **Arbeitspaket W1** aus dem Prod-Volldurchlauf der Forge. Behebt die Befunde 5 und 6.
> Zugehöriges Repo-Dokument: `docs/analysis/forge-prod-run-2026-08-30.md` (Commit `3d7fd747`)
> Gedächtnis-Anker: `session-resume-2026-08-30-forge` (in `MEMORY.md` ganz oben verlinkt)
>
> Dieser Plan entstand als Übergabepunkt nach einem Claude-Neustart und liegt seit
> Commit-Zeitpunkt im Repo; der Abschnitt „Handwerkszeug" und der Anhang sind bewusst
> mitgenommen — sie sind das Sitzungswissen, das sonst verloren geht.
>
> **Empfohlenes Modell: Opus 5, Aufwandsstufe `max`** (nicht `high` — siehe Begründung).
>
> Die Arbeit sieht nach Fleiß aus, aber ihr Kern ist, die Variablenmengen für 12 Vorlagentypen
> aus den Aufrufstellen zusammenzutragen. Fehlt dabei **ein** legitimer Platzhalter, entfernt
> der Reparaturlauf ihn aus 48 Produktionszeilen — still, unwiderruflich, und schlimmer als der
> Fehler, den er beheben soll. Das ist ein Sorgfaltsrisiko, kein Tippfehlerrisiko; kein Test
> fängt es. Die Asymmetrie entscheidet: zu viel Denken kostet Tokens, zu wenig kostet
> Produktionsdaten. Dazu kommt der Projektvertrag in `CLAUDE.md` — „ultrathink, 4 Perspektiven,
> Perfektion über Geschwindigkeit" — der ohnehin nichts Geringeres zulässt.
>
> Zu Fable liegt kein belastbarer Grund vor: der einzige gemessene Datenpunkt ist der Preis
> (`anthropic/claude-fable-5` 50 $/Mio Ausgabe gegen 25 $ bei Opus 5). Worin es besser wäre,
> ist unbekannt — also nicht wählen.
>
> Der Engpass nach einem Neustart ist Kontext, nicht Fähigkeit — deshalb liegt alles Nötige in
> dieser Datei, im Repo-Dokument und im Gedächtnis.

---

## Wo das Projekt steht

Der **Forge-Volldurchlauf gegen Produktion** (ohne Mock, echtes Geld) ist abgeschlossen. Die
Welt lebt: `state-pathography-legibility-as-biopolitical-metabolism`,
Sim `ff308923-5483-4c9f-84e5-22bea2443536` — 6 Agenten, 7 Gebäude, 5 Zonen, 35 Straßen,
Weltkarte, Lore, Thema, 15 von 16 Bildern.

**Bereits behoben, gepusht und deployt** (`a5cb9b73` + Migration 279, Container läuft darauf):
Die Reasoning-Tokens lagen INNERHALB von `max_tokens` — 3016 von 3072 gingen ins Denken, null
Ausgabetokens, drei von vier Aufrufen 502. Jetzt ist die Denkstufe je Zweck in
`platform_settings` einstellbar. Gemessen: von 1-von-4 auf **13 von 13**, von 50–115 s auf
18,7–24,7 s je Agent.

**Offen:** 18 der 22 Befunde, in fünf Paketen W1–W5. Dieser Plan ist **W1** — das Paket mit der
größten Hebelwirkung, weil ohne es **jede künftige Welt** mit erfundenen Variablen und ohne
Kompositionsschranken zur Welt kommt.

---

## Kontext von W1

Phase A.6 (`ForgeThemeService.generate_simulation_templates`) lässt ein Modell Prompt-Vorlagen
schreiben und speichert das Ergebnis **ungeprüft** als Ersatz für kuratierte Plattformvorlagen.
Zwei Dinge gehen verloren, und beide fallen niemandem auf:

**Erfundene Variablen.** Acht Stück in vier Vorlagen der neuen Welt — `agent_title`,
`leserlichkeit_level`, `building_leserlichkeit`, `agent_condition`, `bureau_name`, `zone_name`,
`pathological_condition`. Sie werden nie als Fehler sichtbar: `prompt_service.fill_template`
fängt den `KeyError` und ruft `_safe_format`, das unbekannte Platzhalter stehen lässt; der Text
geht dann an ein **zweites** Modell, das die Bildbeschreibung schreibt — und das füllt die Lücke
mit etwas Plausiblem. Am gerenderten Porträt belegt: das Schild sagt „Leserlichkeit: 9%", eine
Zahl, die niemand berechnet hat. `chat_system_prompt` und `chronicle_generation` sind
Laufzeitvorlagen, der Defekt ist also dauerhaft in der Welt.

**Verlorene Leitplanken.** Die Plattformvorlage verlangt *„a SINGLE person … single subject
centered in frame"* und *„comma-separated descriptors, no sentences"*. In der erzeugten Vorlage
fehlt **jede** dieser Zusicherungen — daher das Doppelporträt von „Almandine" und die
Prosa-statt-Deskriptoren-Ausgabe. Das Bildmodell ist unverändert `flux-2-pro`; die Qualität fiel
am Prompt.

**Ziel:** Die Welt behält ihre eigene Bildsprache, aber der Rahmen kann strukturell nicht mehr
verloren gehen — und eine erfundene Variable wird laut, statt von einer zweiten KI überschrieben
zu werden.

## Zwei Entscheidungen, die der Nutzer bereits getroffen hat

1. **Bei Verstoß: reparieren + Rahmen erzwingen.** Unbekannte Platzhalter aus dem erzeugten Text
   entfernen, den Rest behalten, und die Plattform-Schranken beim Rendern immer darumlegen. Die
   Welt behält ihre Stimme, der Rahmen ist garantiert. (Nicht: verwerfen, nicht: neu erzeugen.)
2. **Bestand: alle bestehenden Welten mitreparieren.**

---

## Der Schlüssel: das Feld gibt es schon

`prompt_templates.variables` existiert und ist bei den **Plattform**-Vorlagen korrekt gefüllt
(`[{"name":"agent_name"},{"name":"agent_character"},{"name":"agent_background"}]`).
`ResolvedPrompt.variables` liest es bereits (`prompt_service.py:293`). Die KI-erzeugten Zeilen
schreiben dort `"[]"` — und zwar als **String**, nicht als Array.

Der Deklarationsmechanismus ist also vorhanden, wird nur nicht befüllt und nirgends geprüft.
Wir bauen nichts Neues, wir schließen den Draht.

## Ansatz

Eine Deklaration je Vorlagentyp, **drei** Verbraucher — statt drei Stellen, die sich
widersprechen dürfen.

### 1. Neu: `backend/services/prompt_contracts.py`

Eine Datenstruktur je `template_type`:

- `variables: frozenset[str]` — was der Aufrufer **tatsächlich** liefert
- `frame: str` — die unveränderliche Zusicherung der Plattform (Komposition, Personenzahl,
  Ausgabeformat)

Die Variablenmengen sind aus den Aufrufstellen belegt, nicht geraten:

| `template_type` | belegte Quelle | Variablen |
|:--|:--|:--|
| `portrait_description` | `generation_service.py:213` | `agent_name`, `agent_character`, `agent_background`, `simulation_name`, `locale_name`, `world_context` |
| `building_image_description` | `generation_service.py:250` | `building_name`, `building_type`, `building_condition`, `building_style`, `building_description`, `special_type`, `construction_year`, `population_capacity`, `zone_name`, `simulation_name`, `locale_name`, `world_context` |
| `chronicle_generation` | `generation_service.py:811` | `edition_number`, `simulation_name`, `period_start`, `period_end`, `event_summary`, `echo_summary`, `battle_summary`, `reaction_summary` |
| `chat_system_prompt` | `chat_ai_service._build_agent_variables` | `agent_name`, `agent_character`, `agent_background`, `agent_system`, `agent_gender`, `agent_profession`, `simulation_name`, `locale_name`, `agent_mood` |

⚠ Die heutige Liste im Erzeugungs-Prompt ist **global und unvollständig**: sie kennt
`locale_name`, `world_context`, `agent_system`, `agent_gender`, `agent_profession`,
`building_style`, `special_type`, `construction_year`, `population_capacity` nicht — und lädt
umgekehrt dazu ein, `zone_name` im Chat zu verwenden, wo es niemand liefert. Genau das ist
passiert.

**Umfang:** Auf Prod existieren simulationseigene Vorlagen für **12 Typen** (48 Zeilen, 9
Welten) — `generate_simulation_templates` erzeugt nur 4 davon, weitere Pfade schreiben
`relationship_generation`, `embassy_event_echo`, `embassy_pair_generation`,
`event_echo_transformation`, `agent_backstory`, `lore_image_description`, `banner_description`,
`building_description`. Der Vertrag wird für **alle** Typen mit Plattform-Gegenstück deklariert;
die Prüfung greift überall dort, wo eine simulationseigene Vorlage geschrieben wird, nicht nur
in A.6. Die Variablenmengen der acht weiteren Typen sind an ihren Aufrufstellen noch zu belegen
— gleiche Technik wie oben, nicht raten.

### 2. Erzeugung: Prompt aus dem Vertrag bauen und Ergebnis prüfen

`forge_theme_service.generate_simulation_templates`:

- Die Variablenliste im Prompt **je Typ** aus dem Vertrag erzeugen, statt der globalen Prosaliste.
- Nach dem Parsen und **vor** dem Speichern: Platzhalter des erzeugten `prompt_content` gegen
  `contract.variables` halten. Unbekannte werden **entfernt** (der umgebende Text bleibt), der
  Vorgang wird auf `warning` protokolliert und mit Sentry-Tag versehen — nicht stillschweigend.
- `variables` als echtes JSON-Array aus den nach der Bereinigung tatsächlich verwendeten
  Platzhaltern schreiben, statt `"[]"`.
- Das vorhandene `template_meta`-Dict ist die natürliche Ankopplung; die Schleife filtert dort
  bereits unbekannte Typen (`if ttype not in template_meta: continue`).

### 3. Rendern: der Rahmen wird immer angelegt

`prompt_service.PromptResolver`:

- Ist die aufgelöste Vorlage **simulationseigen** und hat ihr Typ einen `frame`, wird der Rahmen
  beim Rendern angehängt. Der gespeicherte Text bleibt der Welt-Stil; die Zusicherung gehört der
  Plattform und kann nicht wegeditiert werden.
- `fill_template` unterscheidet künftig zwei Fälle statt einem: ein **deklarierter** Platzhalter
  ohne Wert ist normal (leerer String); ein **undeklarierter** ist ein Defekt und wird über
  `logger.warning` **plus** Sentry gemeldet. `_safe_format` bleibt als Netz, hört aber auf, den
  Fehler unsichtbar zu machen.

### 4. Reparaturlauf über den Bestand

Ein einmaliges Skript unter `scripts/` (kein Migrationsschritt — es ist Datenreparatur, kein
Schemawandel, und es braucht die Vertragsdeklaration aus Python):

- Alle Zeilen mit `simulation_id IS NOT NULL` lesen,
- Platzhalter gegen den Vertrag des Typs halten, unbekannte entfernen,
- `variables` korrekt füllen,
- Vorher/Nachher je Zeile ausgeben und `--dry-run` als **Vorgabe** fahren.

Die Kompositionsschranken kommen für alle Bestandswelten **sofort** über Schritt 3 zurück, ohne
Datenänderung.

## Betroffene Dateien

| Datei | Änderung |
|:--|:--|
| `backend/services/prompt_contracts.py` | **neu** — die Deklaration |
| `backend/services/forge_theme_service.py` | Prompt aus dem Vertrag, Prüfung vor dem Speichern, echtes `variables`-Array |
| `backend/services/prompt_service.py` | Rahmen beim Rendern, `fill_template` meldet undeklarierte Platzhalter |
| `scripts/repair_simulation_prompt_templates.py` | **neu** — Reparaturlauf mit `--dry-run` |
| `backend/tests/unit/test_prompt_contracts.py` | **neu** — siehe Prüfung |

## Konventionen (bindend, aus `CLAUDE.md` und der Nutzeranforderung)

Sauberste Architektur, sauberster Code. Konkret hier: keine Duplikation — die Variablenmengen
stehen **einmal**, und die drei Verbraucher lesen daraus; Ausnahmen werden nie stumm geschluckt
(jeder Pfad protokolliert und meldet); Geschäftslogik bleibt in der Service-Ebene; `ruff` und die
Tests laufen vor der Übergabe. Der Reparaturlauf fasst Produktionsdaten an und fährt deshalb
standardmäßig trocken. Die vollständige Liste steht im Abschnitt „Standing requirement for every
fix" von `docs/analysis/forge-prod-run-2026-08-30.md`.

## Prüfung

**Einheitentests** (`test_prompt_contracts.py`):
- Jeder deklarierte Typ hat ein Plattform-Gegenstück, und dessen Platzhalter sind eine Teilmenge
  des Vertrags — das fängt Drift zwischen Deklaration und kuratierter Vorlage.
- Die Bereinigung entfernt genau die undeklarierten Platzhalter und lässt den Text sonst intakt
  (Fixture: der echte ATRAMENT-Text mit `{agent_title}` und `{leserlichkeit_level}`).
- Der Rahmen wird an eine simulationseigene Vorlage angehängt, an eine Plattformvorlage nicht.
- `fill_template` meldet einen undeklarierten Platzhalter und schweigt bei einem deklarierten
  ohne Wert.

**Gegen Produktion, nach dem Deploy:**
1. Reparaturlauf trocken über die 48 Zeilen fahren, Ausgabe lesen, dann scharf.
2. In der ATRAMENT-Welt ein Porträt neu erzeugen und im Prod-Protokoll prüfen, dass
   `Missing variable …` **nicht** mehr erscheint.
3. Das erzeugte Bild ansehen: eine Person, Kopf-und-Schulter, und der Welt-Stil (Kollodium,
   Aktenlampe) ist erhalten.
4. `select variables from prompt_templates where simulation_id is not null` — kein `"[]"` mehr.

**Nicht vergessen:** Die Wirkung von Schritt 3 lässt sich ohne Deploy nicht messen. Nach dem
Merge deployen und dann erst Punkt 2–4 fahren. Die Erfahrung aus diesem Durchlauf: ein grünes
Gate ist keine Messung — die 502er liefen monatelang unter einer vollständigen Testsuite.

---

## Handwerkszeug (damit die neue Sitzung nicht sucht)

- **Prod-Protokoll:**
  `ssh root@45.137.68.227 "docker logs --since 10m \$(docker ps --format '{{.Names}}' | grep a6exg | head -1)"`
  → JSON-Zeilen, mit Python filtern.
- **Prod-SQL:** Rezept in `~/.config/metaspots/SUPABASE-ACCESS.md`
  (`SUPABASE_MCP_TOKEN` aus `.env`, Management-API).
- **Deploy:** POST auf `127.0.0.1:8000/api/v1/deploy?uuid=a6exg3b5euhidpc2r5009o0m`
  **von der Box aus** — von außen nicht erreichbar.
- **Browser:** Koordinaten verschieben sich, wenn das Fenster umskaliert. Lieber per
  `javascript_tool` durch die Shadow-Roots suchen und `.click()` aufrufen.
- ⚠ Eine Parallelsitzung arbeitete am selben `main` an DRIFT. Vor `git checkout` Bescheid geben,
  nur eigene Pfade stagen.

---

# Anhang: alles aus dem Hinterkopf

Nichts davon steht im Repo-Dokument. Es ist das, was diese Sitzung Zeit gekostet hat — oder
gespart hätte.

## Fallen, in die ich getreten bin

- **`asyncio.run(main())` vergessen.** Das Skript endet mit `exit 0`, ohne Ausgabe, ohne Fehler.
  Ich habe drei Anläufe gebraucht, um zu merken, dass `main()` nie lief. Bei stiller Ausgabe
  zuerst prüfen, ob die Einstiegsfunktion überhaupt aufgerufen wird.
- **Vordergrund-`sleep` ist im Bash-Werkzeug gesperrt.** Auch verkettete kurze Sleeps. Zum Warten
  entweder `computer`-Waits im Browser, `run_in_background: true`, oder Monitor mit
  `until`-Schleife.
- **`browser_batch` läuft in eine Zeitüberschreitung**, sobald die Seite schwer wird (16 Bilder
  in der Zeremonie). Dann einzelne Aufrufe nehmen oder den abschließenden Screenshot weglassen.
- **Das Fenster skaliert zwischen Screenshots um** (1389→1503→1558 px). Koordinaten aus einem
  älteren Bild treffen daneben — mir ist damit ein Klick auf die falsche Abteilung gerutscht und
  hätte fast die fertige Vermessung überschrieben. **Lösung: nie nach Koordinaten klicken**,
  sondern per `javascript_tool` durch die Shadow-Roots laufen und `.click()` aufrufen:

  ```js
  const all=[]; const walk=(r)=>{for(const el of r.querySelectorAll('*')){
    if(el.tagName==='BUTTON')all.push(el); if(el.shadowRoot)walk(el.shadowRoot);}};
  walk(document);
  all.find(b => (b.textContent||'').trim().replace(/\s+/g,' ') === 'Neu entwerfen')?.click();
  ```
- **Das `find`-Werkzeug kommt nicht durch Shadow-Roots** — es meldet „nur ein generisches
  Element". Immer `javascript_tool` nehmen.
- **Schreibmaschinen-Animationen nie aus dem ersten Screenshot beurteilen.** Ich habe ein
  „abgeschnittenes Epigraph" als Befund notiert; es tippte sich nur gerade ein.
- **Der Token aus `credentials.md` ist für die Supabase-Management-API tot** (liefert
  `Unauthorized`). Der richtige ist `SUPABASE_MCP_TOKEN` aus `~/Dev/velgarien-rebuild/.env` —
  Rezept in `~/.config/metaspots/SUPABASE-ACCESS.md`.
- **Spaltennamen, die ich falsch geraten habe:** es heißt `agents.portrait_image_url` (nicht
  `avatar_url`), `simulations` hat **kein** `banner_image_url`, und die Lore-Tabelle heißt
  `simulation_lore` (nicht `lore_entries`). Vor dem Bauen einer Abfrage einmal
  `information_schema.columns` fragen spart drei Fehlversuche.

## Messrezepte, die sich bewährt haben

**Prod-Protokoll auswerten** (JSON-Zeilen, sonst unlesbar):
```bash
C=$(ssh root@45.137.68.227 "docker ps --format '{{.Names}}' | grep a6exg | head -1")
ssh root@45.137.68.227 "docker logs --since 10m $C 2>&1" | python3 -c "
import sys,json
for l in sys.stdin:
    l=l.strip()
    if not l.startswith('{'): continue
    try: d=json.loads(l)
    except: continue
    if d.get('purpose'):  # oder: 'generate-entity' in str(d.get('path',''))
        print(d.get('timestamp','')[11:19], d.get('event'), d.get('purpose'),
              d.get('reasoning'), d.get('status_code'), d.get('elapsed_s'))
"
```
Der Traceback steht im Feld `exception` und ist **lang** — die Ursache steht am ENDE
(`exc[-900:]`), nicht am Anfang. Das hat mich beim 502 fast in die falsche Richtung geschickt.

**Offene/hängende KI-Aufrufe finden:** Starts und Abschlüsse je `purpose` zählen und die
Differenz bilden. So habe ich meine „`style_refine` hängt"-Hypothese widerlegt (1 gestartet,
1 beendet — hing nicht).

**Platzhalter einer Vorlage prüfen** (das Kernrezept für W1):
```python
re.findall(r'\{(\w+)\}', prompt_content)
# Sim-Menge minus Plattform-Menge = erfunden
```

**Sprachtreue eines Feldes messen** — Markerwörter zählen, Verhältnis 1,6 als Schwelle:
```python
DE = r'\b(der|die|das|und|ist|nicht|sich|eine|dem|den|mit|von|als|auf|wie|aber|durch|ihre|seine)\b'
EN = r'\b(the|and|is|not|with|from|that|which|his|her|their|has|been|were|for|but|through)\b'
```
Reicht völlig, um „deutsches Wort im englischen Feld" zuverlässig zu finden.

**Ist ein 200 echt oder die SPA-Auffangroute?** Nicht am Status entscheiden — an
`content_type`, `size_download` und einem grep nach `sk-or-v1|r8_|sbp_|aws_secret|PRIVATE KEY`.
477 Scanner-Treffer sahen nach einem Leck aus und waren 11.016 Byte `index.html`.

**Die WIRKLICH laufenden Schlüssel holen** (lokal ≠ Prod ≠ credentials.md — das war hier schon
mal ein Vorfall):
```bash
ssh root@45.137.68.227 "docker exec <container> printenv OPENROUTER_API_KEY"
```

## Der Messstand für Modellvergleiche

Liegt unter
`/private/tmp/claude-501/-Users-mleihs-Dev-velgarien-rebuild/e76cfb0a-…/scratchpad/forge-run/`
(`bench.py` … `bench6.py`, `schema.json`, `lore_schema.json`, `models.json`, `bench*.json`).
⚠ Scratchpad ist sitzungsgebunden und **wird verschwinden** — bei Bedarf neu bauen. Das Rezept:

- Schema aus dem echten Pydantic-Modell ziehen (`ForgeAgentDraft.model_json_schema()`), **nicht**
  nachbauen.
- Als **Tool-Calling** an OpenRouter schicken (`tools=[{function:{name:'final_result',
  parameters: SCHEMA}}]`, `tool_choice` erzwungen) — genau das tut pydantic-ai im Standardmodus.
- `"usage": {"include": true}` mitschicken, dann liefert die Antwort `completion_tokens`,
  `completion_tokens_details.reasoning_tokens` und **`cost`** je Aufruf.
- Nicht nur „hat geparst" messen — **Wortzahlen je Feld** gegen die Vorgabe halten. `ok=JA` war
  bei einer Ausgabe wahr, deren drei Prosafelder LEER waren.
- Mindestens **4 Läufe** je Kandidat. Bei 2 Läufen lag mistral-medium-3.1 vorn; bei 4 fiel es auf
  2/4 zurück und deepseek-mit-abgeschaltetem-Denken gewann klar. Zwei Messpunkte sind Zufall.

## Was ich über den Code gelernt habe

- **Es gibt ZWEI `purpose`-Begriffe, und sie sind verschieden.**
  `create_forge_agent(purpose=…)` wählt das **Modell**; `run_ai(…, purpose)` wählt **Zeitlimit
  und Token-Budget**. Beide heißen `purpose`. Das war der Kern des 502-Fehlers und ist die
  wahrscheinlichste Quelle künftiger Verwechslungen.
- `create_forge_agent` wird an **null** Stellen mit `purpose` aufgerufen → alles läuft auf
  `model_forge`, und `model_research` ist tote Konfiguration (Befund 11).
- `template_meta` in `forge_theme_service` ist bereits je Typ geschlüsselt und filtert unbekannte
  Typen — die saubere Ankopplung für die Vertragsprüfung.
- `_safe_format` sitzt in `prompt_service.py:317`, direkt hinter dem `except KeyError`.
- `make_chain_mock` (in `backend/tests/conftest.py`) unterstützt `.in_()`, `.eq()`, `.or_()` usw.
  — mein Wechsel von `.like()` auf `.in_()` war also testgedeckt. **Vorsicht:** ein Mock, der die
  Kette bricht, führt hier NICHT zu einem roten Test, weil `_load_all` breit fängt. Bei
  Änderungen an Abfrageketten prüfen, ob der Test die Ladefunktion wirklich durchläuft.
- **lit-localize: die Message-ID ist ein Hash der Quell-STRUKTUR**, nicht des Textes.
  `` msg(str`${successCount} settings saved.`) `` und `` msg(str`${section.title} settings saved.`) ``
  bekommen dieselbe ID und teilen sich eine Übersetzung. Das erklärt, warum `build` nichts als
  fehlend meldete, obwohl ich einen neuen String eingeführt hatte.
- **Deutsche Quelltexte in `msg()`** sind eine echte Fehlerklasse: die Quellsprache ist `en`, ein
  deutscher Quellstring hat also keine Übersetzung und fällt im ENGLISCHEN Build auf Deutsch
  zurück. In DRIFT betrifft das ~115 Stellen (Befund der Parallelsitzung, offen).
- **Das 16. Lint-Gate ist neu und scharf:** farbige Kantenbalken (`border-left ≥ 2px` in einer
  Statusfarbe) sind repo-weit verboten. Ersatz ist `markerQuoteStyles` aus
  `components/shared/marker-styles.ts` (neutrale 1px-Haarlinie). Hat meinen `--color-primary`-
  Balken sofort gefangen.
- Vor jeder Komponentenarbeit **`velg-frontend-design`-Skill aufrufen** — steht so in `CLAUDE.md`
  und ist keine Formalie: die Tokenliste und die Sperrliste stehen nur dort.

## Größenordnungen (für Planung und Kostenschätzung)

- Entität mit abgeschaltetem Denken: **~20 s**, ~0,008 $. Sechs Agenten = 133 s.
- Gebäude: **~11 s** (weniger Prosa). Sieben = 78 s.
- Ein Bild über Replicate/flux-2-pro: **~30 s**. Sechzehn Bilder ≈ 10 Minuten.
- Ganzer Materialisierungslauf: **864,8 s** (Hintergrundaufgabe, von Zündung bis letztes Bild).
- Der komplette Durchlauf **plus** der 12-Modell-Messstand hat grob **1–2 $** gekostet. Der
  OpenRouter-Schlüssel hatte 39,88 $ frei — kein Engpass, aber der Messstand ist nicht gratis.

## Lose Fäden, die NICHT in W1 stecken

- **`banner_description` fällt auf die fest verdrahtete Vorlage zurück**, obwohl Commit
  `42bcb294` genau das beheben sollte. Meldung im Prod-Protokoll:
  `Using hardcoded fallback for 'banner_description' (locale=en, sim=…)`. Ursache ungeklärt.
- **Befund 20 (Tiefenrecherche scheitert)**: ich habe den Traceback nicht gezogen. Der Aufruf
  stirbt nach 14,5 s, `purpose=research`, `max_tokens 2048`.
- **`variables` wird als String `"[]"` geschrieben, nicht als Array** — ein Typfehler neben dem
  inhaltlichen. Beim Fix mitnehmen.
- **`prompt_templates` hat simulationseigene Zeilen für 12 Typen**, nicht 4. Wer sie außer A.6
  schreibt, habe ich nicht vollständig verfolgt.

## Zusammenarbeit mit der Parallelsitzung

`velgarien-rebuild-88` arbeitete gleichzeitig am selben `main` an DRIFT. Was daraus zu wissen ist:

- Ihre fünf DRIFT-Commits sind mit meinem Push **mitgefahren und mitdeployt**. Migrationen 277+278
  lagen bereits auf Prod, damit laufen Code und Schema wieder zusammen.
- **Offen bei ihr:** DRIFT bricht den i18n-Vertrag an ~115 Stellen (auf Englisch gestellt
  bekommt man überwiegend Deutsch); fünf Weltnamen sind auf der Driftkarte zu lang und zwei ragen
  über die Brettkante. Beides ihre Ecke, nicht anfassen ohne Absprache.
- Verständigung lief über `SendMessage` an `uds:/tmp/cc-socks/26511.sock`. Hat gut funktioniert —
  sie hat einen meiner Befunde (die vier `output_type=list[...]`-Stellen) selbst nachgemessen und
  mir eine Stelle geliefert, die ich übersehen hatte.
- ⚠ **Nie `git stash`** in diesem Arbeitsbaum — er wird geteilt, ein Stash nimmt fremde Arbeit mit.

## Arbeitsweise, die der Nutzer erwartet

- **Am laufenden System messen, nicht aus dem Quelltext schließen.** Drei meiner Hypothesen sind
  in dieser Sitzung an einer Messung gestorben. Der Nutzer honoriert das Zurücknehmen — er hat
  mehrfach selbst korrigiert (Wortlaut nicht wiedergegeben)) und erwartet dasselbe
  zurück.
- **Nicht pausieren, nicht (Wortlaut nicht wiedergegeben) fragen.** Autonom weiterarbeiten; Befunde
  sofort notieren statt zu sammeln.
- **Er liest mit und stellt Zwischenfragen** — oft sehr gute („addiert ergibt nicht 16", „ist das
  das gleiche flux pro modell?", „warum will das modell nix zurückliefern?"). Diese Fragen sind
  keine Störung, sie haben in dieser Sitzung drei der schärfsten Befunde ausgelöst.
- Ausgabe knapp halten, aber Zahlen zeigen. Er will die Messung sehen, nicht die Schlussfolgerung
  allein.
