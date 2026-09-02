# Berufe ohne Bedeutung — drei Systeme, die einander nicht kennen

**Stand:** 2026-09-02 · **Zustand:** Anzeige vorübergehend abgeschaltet · **Sprache:** de

Alle Zahlen sind auf der Produktionsdatenbank gemessen, nicht aus dem Code abgeleitet.

## Anlass

Auf der Übersichtsseite von Velgarien standen die Agentenkarten mit leerem Körper,
während die Gebäudekarten daneben Zustand und Bauart trugen. Die erste Erklärung war
ein Darstellungsfehler. Sie stimmte nicht: `primary_profession` war schlicht `NULL`.
Beim Nachtragen (Migration 339) stellte sich die weitergehende Frage — welche Berufe
gibt es überhaupt, was bedeuten sie, und wie werden sie über Welten hinweg
harmonisiert.

Antwort: **gar nicht.** Es gibt drei Systeme für denselben Begriff, und keines kennt
ein anderes.

## System 1 — `agents.primary_profession` / `_de`

| | |
|---|---|
| Zeilen | 111 Agenten mit Wert, auf 17 Welten |
| Verschiedene Werte | **104** |
| Länge im Mittel | 36 Zeichen |
| Längster Wert | 380 Zeichen |
| Werte über 34 Zeichen | 15 |

Freier Text, den das Modell beim Weltenbau schreibt. 104 verschiedene Werte auf 111
Agenten heißt: praktisch jeder Agent hat einen eigenen. Es gibt kein Vokabular, aus
dem gewählt würde.

Der Vertrag steht in `backend/models/forge.py`:

```python
primary_profession: str = Field(
    min_length=1, max_length=100,
    description="The person's occupation, as a short noun phrase. …")
```

Die Spalte selbst ist `text` **ohne** Längenzwang — die Grenze existiert nur im
Pydantic-Modell. Fünf der sechs längsten Werte stehen in einer Welt
(`flatulence-as-logos-…`, gebaut am 17.03.2026) und tragen dort einen deutschen
Namen, eine englische Klammer und einen ganzen Satz:

```
"Völlerei-Censor & Pneumatischer Steuerprüfer (Gluttony Assessor — a corrupt
 civic official who audits the caloric intake …"          380 Zeichen
```

Das ist Altbestand: die Längendisziplin kam mit `27787de1`, **nach** dieser Welt.
Seither liegt der längste Wert je Welt zwischen 28 und 57 Zeichen; die am 29.08.2026
gebaute Welt bei 28.

**Wirkung:** rein narrativ. Der Beruf reist als Variable in Prompts —
`chat_ai_service` (`agent_profession` im Chat-Systemprompt),
`personality_extraction_service`, `chat_service` (Gesprächseinstieg „Wie läuft deine
Arbeit als {profession}?") — dazu SEO-Text, Landing und Codex-Export. **Keine
Spielmechanik.**

## System 2 — `simulation_taxonomies` mit `taxonomy_type = 'profession'`

| | |
|---|---|
| Zeilen | 187, auf 27 Welten |
| Deckung mit System 1 | **12 von 111** |

Ein kontrolliertes Vokabular pro Welt mit Beschriftung als `{de, en}` — genau das
Mittel, mit dem die Plattform sonst Bauart, Zustand und Zonentyp benennt
(`frontend/src/utils/taxonomy-label.ts`).

Velgarien führt dort: `administration · artist · craftsman · engineer · leader ·
medic · military · scientist · security · specialist` — und **keiner der neun
Agenten trägt einen davon.**

Die Vokabulare sind auch nicht weltspezifisch. Identische Sätze über mehrere Welten:

```
6 Welten   ai-system, chaplain, commander, engineer, physicist, xenobiologist
6 Welten   mechanic, medic, raider, recruit, slingshot-operator, trader
6 Welten   architect, calculator, orator, philosopher, scholar, visionary
4 Welten   administration, artist, craftsman, engineer, leader, medic, …
```

Das sind Vorlagen aus Themen-Presets, nicht aus den Agenten abgeleitet.

**Gelesen wird das System von niemandem:** `taxonomyLabel('profession', …)` steht an
keiner Stelle im Baum.

Dabei ist der Weg gebaut. `backend/services/forge_taxonomies.py` kennt die
Verbindung:

```python
TaxonomySource("professions", "agents", "primary_profession", "primary_profession_de")
```

Der Modulkopf sagt selbst, warum es das gibt: *„Nothing ever filled that column.
Measured on production 2026-08-30: All 26 forge drafts carry `taxonomies = {}`."*

## System 3 — `agent_professions`

| | |
|---|---|
| `agent_professions` | **180 Zeilen**, 28 Welten, 55 verschiedene Werte |
| davon `is_primary` | 174 |
| Qualifikationsgrad im Mittel | 4,33 |
| `building_profession_requirements` | **0 Zeilen** |
| Deckung mit System 2 | 12 von 180 |

Die strukturierte Fassung: `profession`, `qualification_level`, `specialization`,
`is_primary`. Mit eigenem Router (`backend/routers/agent_professions.py`), eigenem
Dienst (`agent_profession_service.py`) und einer Gegenseite in
`building_service.get_profession_requirements` / `set_profession_requirement`.

**Die Gegenseite ist leer.** Der Dienst kann Anforderungen lesen und schreiben; es
existiert keine einzige. Der Schlüssel ist da (180 qualifizierte Berufe), das Schloss
ist gebaut — es wurde nie eine Tür eingehängt.

## Was daraus folgt

Ein Beruf ist ein Etikett in genau einer Welt und bedeutet außerhalb nichts. Für ein
Weltenbau-Projekt wäre das eine vertretbare Entscheidung — nur ist sie hier nicht
getroffen, sondern zerfallen: ein Vokabular wird gepflegt (Admin → Welt-Einstellungen)
und von niemandem gelesen; eine Qualifikationstabelle ist zu 180 Zeilen gefüllt und
hat keinen Abnehmer.

Die Spielmechanik hängt an einer anderen Achse: `operative_type` (spy · guardian ·
saboteur · propagandist · infiltrator · assassin) und den sechs Eignungswerten. Ein
„General der Streitkräfte" ist nicht militärischer als eine Archivarin — das
entscheidet allein sein Eignungsprofil.

## Maßnahme: Anzeige aus, an einer Stelle

`frontend/src/utils/profession.ts`:

```ts
export const PROFESSION_DISPLAY_ENABLED = false;
export function professionLabel(resolved: string | null | undefined): string {
  if (!PROFESSION_DISPLAY_ENABLED) return '';
  return resolved ?? '';
}
```

Dreizehn Anzeigestellen in zwölf Dateien laufen darüber:

```
agents/AgentCard.ts · agents/AgentsView.ts · dashboard/DashboardRail.ts
drift/DriftDockPanel.ts · epoch/DeployOperativeModal.ts (2×)
epoch/DraftRosterPanel.ts · forge/forge-card-data.ts · forge/VelgForgeCeremony.ts
heartbeat/BureauResponsePanel.ts · landing/LandingCitizens.ts
simulation/SimulationOverview.ts (2×) · world-map/SimulationWorldMap.ts
```

Ausnahme: `settings/WorldSettingsPanel.ts` — dort ist `profession` kein Beruf, sondern
der **Name** einer Taxonomie in einer Auswahlliste. Ihn auszublenden nähme dem
Administrator eine Zeile weg, die er pflegen können muss.

`frontend/tests/profession-parked.test.ts` hält beides fest: dass der Schalter aus
ist, und dass keine Anzeigestelle daran vorbeiliest. Gegengeprobt — eine Stelle auf
den Rohwert zurückgesetzt macht den Test rot.

**Nicht angefasst:** die Prompts. Der Beruf bleibt auf der Akte und bleibt im
Chat-Systemprompt. Dort *hat* er Bedeutung: er färbt, wie eine Figur spricht. Ein
Feld zu verstecken ist keine Erlaubnis, es zu löschen.

## Wie er zurückkommt

Eine Zeile — `PROFESSION_DISPLAY_ENABLED = true` — sobald eines der drei Systeme
trägt. Der kürzeste Weg ist System 3, weil es bereits zu 180 Zeilen gefüllt ist und
nur seine Gegenseite fehlt: `building_profession_requirements` füllen, dann wird
`qualification_level` zu einem Tor und der Beruf zu einer Entscheidung.

Der zweitkürzeste ist System 2: `forge_taxonomies` für den Bestand nachlaufen lassen,
damit die Vokabulare die echten Berufe spiegeln, und die Karte über
`taxonomyLabel('profession', …)` lesen lassen.

## Offene Nachbarbefunde

* **156 von 258 Agenten haben gar keinen Beruf**, auf 25 von 41 Welten. Jeder hat
  `character` und `background` — der Beruf ist also ableitbar und muss nicht erfunden
  werden. Gehört als Nachtragslauf in die Erzeugungsstrecke, nicht in eine Migration
  mit 156 handgeschriebenen Zeilen.
* Der 380-Zeichen-Wert steht weiter auf dem Bestand. Die Spalte hat keinen
  Längenzwang; ein `CHECK` wäre der Ort, an dem die Zahl aus dem Pydantic-Modell
  wirklich gälte.
