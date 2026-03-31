# Dungeon Literary Additions — 5 Konzepte

> Erarbeitet 2026-03-31. Basierend auf Web-Recherche (Disco Elysium, Sunless Sea, Hades, Cultist Simulator, Planescape: Torment, IF-Theorie), Codebase-Analyse, deutsche Literaturtradition (Mann, Kafka, Büchner, Handke, Beckett).

## Status

| # | Konzept | Aufwand | Impact | Status |
|---|---------|---------|--------|--------|
| 1 | Leitmotiv-System | Mittel | Hoch | Konzept |
| 2 | Aptitude-Stimmen | Hoch | Transformativ | Konzept |
| 3 | Narrative Breadcrumbs | Mittel-Hoch | Hoch | Konzept |
| 4 | Objektanker-System | Mittel | Hoch | Konzept |
| 5 | Archetype-Rhetorik | Mittel | Transformativ | Konzept |

**Empfohlene Reihenfolge:** 5 → 1 → 4 → 3 → 2

---

## 1. Leitmotiv-System (Per-Run Motivketten)

**Inspiration:** Thomas Manns musikalische Leitmotiv-Technik im *Zauberberg* + Wagners Ring-Zyklus.

**Konzept:** Jeder Dungeon-Run wählt bei Beginn 2–3 Leitmotive aus einem Archetype-spezifischen Pool. Diese Phrasen tauchen in verschiedenen Kontexten auf — Raumbetreten, Banter, Kampf, Loot — und **mutieren** mit der Tiefe.

### Beispiel Shadow

```
Leitmotiv: "Die Dunkelheit ist nicht leer."

Depth 1 (Raumbeschreibung):
  "Der Korridor verengt sich. Die Dunkelheit ist nicht leer — sie wartet."

Depth 3 (Banter nach Kampf):
  "{agent} wischt Blut ab. Die Dunkelheit ist nicht leer. Sie hat euren Rhythmus gelernt."

Depth 5 (Boss-Raum):
  "Die Dunkelheit ist nicht leer. War sie nie. Sie ist das Negativ
   von allem, was ihr mitgebracht habt."
```

### Beispiel Tower

```
Leitmotiv: "Das Hauptbuch"

Depth 1: "An der Wand: ein Hauptbuch. Jede Seite eine Etage. Die meisten Einträge sind rot."
Depth 3: "Das Hauptbuch wieder. Neue Einträge — eure Namen. Die Tinte ist noch feucht."
Depth 5: "Das Hauptbuch liegt aufgeschlagen auf dem Pult des Bosses.
          Die letzte Seite ist leer. Sie wartet auf den Schlussstrich."
```

### Beispiel Mother

```
Leitmotiv: "Wärme"

Depth 1: "Wärme. Ungebeten, aber willkommen."
Depth 3: "Die Wärme kennt euch jetzt beim Namen. Sie weiß, wo ihr kalt seid."
Depth 5: "Die Wärme lässt nicht los. Hat sie nie. Ihr habt nur aufgehört,
          den Unterschied zwischen Halten und Festhalten zu bemerken."
```

### Technische Umsetzung

- Neues Feld `leitmotifs: list[str]` auf `DungeonInstance`
- Pool von 5–8 Leitmotiven pro Archetype, je 4 Varianten (Depth 1–2, 3–4, 5, Boss)
- Banter-Selection prüft `leitmotifs` und injiziert passende Variante
- Kein LLM nötig — alles vorverfasst, Template-basiert

---

## 2. Aptitude-Stimmen (Polyphonische Perspektiven)

**Inspiration:** Disco Elysiums Skill-als-Stimme-System + Bakhtins polyphoner Roman.

**Konzept:** Wenn ein Agent Banter auslöst, spricht seine **dominante Aptitude** als rhetorischer Modus.

| Aptitude | Rhetorik | Satzform | Beispiel |
|----------|----------|----------|----------|
| **Spy** | Interrogativ | Kurze Fragen | "Drei Ausgänge. Einer riecht nach Blut. Welcher?" |
| **Guardian** | Deklarativ | Lagebeurteilung | "Verteidigbar. Engpass rechts. Ein Rückzugsweg. Reicht." |
| **Assassin** | Klinisch | Schwachstellen | "Tragende Säule, Ostwand. Dreißig Sekunden." |
| **Propagandist** | Interpretativ | Semiotik | "Die Symbole — keine Warnung. Eine Einladung." |
| **Saboteur** | Technisch | Systemanalyse | "Stabil. Stabil heißt: noch nicht getestet." |

### Technische Umsetzung

- Neues Feld `aptitude_voice: str` auf Banter-Templates
- Agent mit höchstem Wert in passender Aptitude wird selektiert
- ~200 neue Banter-Einträge (5 Stimmen × 4 Archetypes × ~10 Trigger)

---

## 3. Narrative Breadcrumbs (Dungeon erinnert sich)

**Inspiration:** Disco Elysiums "bedeutungslose Mikro-Reaktivität" + Hades' Boss-Erinnerung.

**Konzept:** Der Dungeon trackt 3–5 signifikante Spielerentscheidungen pro Run. Spätere Texte referenzieren sie — **ästhetisch, nicht mechanisch**.

### Breadcrumb-Typen

1. **Moralische Entscheidung** — "hat den Gefangenen befreit/zerstört"
2. **Verlorener Agent** — "Agent X besiegt in Raum Y"
3. **Entdeckung** — "hat die Karte gefunden"
4. **Verweigerung** — "hat den Schatz nicht berührt"
5. **Kampfstil** — "3× Fähigkeiten statt Angriff"

### Beispiel-Kette (Shadow)

```
Raum 2: Spieler wählt "Gefangenen befreien" → Breadcrumb

Raum 4 (Banter):
  "{agent} schweigt, seit dem Käfig. Das Schweigen hat eine Form."

Raum 5 (Encounter):
  "Ein zweiter Käfig. Offen. Wer auch immer darin war,
   ging denselben Weg — nur früher."

Boss-Raum:
  "'Ihr habt etwas freigelassen', sagt die Dunkelheit.
   'Wie großzügig. Wie naiv.'"
```

### Technische Umsetzung

- Neues Feld `narrative_breadcrumbs: list[dict]` auf `DungeonInstance`
- Banter-Templates mit optionalem `breadcrumb_condition: str`
- Max 5 Breadcrumbs pro Run

---

## 4. Objektanker-System (Dinge als Bedeutungsträger)

**Inspiration:** Alexis Kennedys "Terse Poetry" (Cultist Simulator) + Environmental Storytelling (Jenkins 2004).

**Konzept:** Jeder Run platziert 2–3 benannte Objekte in frühen Räumen, die als thematische Anker dienen. Sie werden in späteren Räumen referenziert — als Banter, Encounter-Detail, Boss-Element. Rein narrativ, kein Gameplay-Effekt.

### Objekt-Pool

| Shadow | Tower | Mother | Entropy |
|--------|-------|--------|---------|
| Stummer Spiegel | Roter Bleistift | Nest aus Kabeln | Uhr ohne Zeiger |
| Warme Waffe | Halbverbrannter Bauplan | Pulsierende Frucht | Sich auflösendes Wort |
| Kartographische Kratzer | Fahrstuhlknopf −1 | Lied ohne Sänger | Zu schwerer Staub |

### Beispiel-Kette (Tower — "Der rote Bleistift")

```
Raum 1: "Auf dem Empfangstresen: ein roter Bleistift. Die Mine ist abgebrochen,
         aber jemand hat damit weitergeschrieben — die Kratzer im Holz
         sind leserlich. Sie sagen: 'Nicht höher als Stockwerk 3.'"

Raum 3: "{agent} findet einen zweiten roten Bleistift. Dieser hat noch eine Mine.
          Die Versuchung, etwas zu schreiben, ist fast körperlich."

Boss:   "Der Crown Keeper hält einen roten Bleistift. Ungebrochen.
         'Die Bilanz stimmt nicht', sagt er. 'Ihr seid der Posten, der fehlt.'"
```

### Technische Umsetzung

- Neues Feld `anchor_objects: list[str]` auf `DungeonInstance`
- Objektpool pro Archetype: je 6 Objekte mit 4 Textvarianten
- Injection bei Depth 1 (discovery), Depth 3+ (reference/echo), Boss (climax)

---

## 5. Archetype-spezifische Rhetorik (Deutsche Literarische Register)

**Inspiration:** Kafka, Büchner, Handke, Mann, Beckett.

**Konzept:** Jeder Archetype verwendet eine eigene **Satzstruktur und rhetorische Figur** — nicht nur Vokabular, sondern Grammatik.

| Archetype | Register | Primäre Figur | Regel |
|-----------|----------|---------------|-------|
| **Shadow** | Büchner-Kompression | Aposiopese (Abbruch) | Max 12 Wörter/Satz. Verb wie ein Schlag. |
| **Tower** | Kafkas bürokratisches Unheimliches | Hypotaxe | Grammatisch tadellos, Inhalt widerspricht Form. |
| **Mother** | Manns *erlebte Rede* | Gleiten Innen/Außen | Dritte Person → "man" → freie indirekte Rede. |
| **Entropy** | Becketts Selbstübersetzung | Degradation | Volle Sätze → Fragmente → Einzelwörter → Stille. |

### Shadow — Büchner-Kompression

```
"Stille. Dann: nicht Stille. Etwas, das Stille imitiert."
"Der Korridor endet. Nicht in einer Wand — in einer Frage."
"{agent} dreht sich um. Nichts. Aber das Nichts steht näher als vorhin."
```

### Tower — Kafkas bürokratisches Unheimliches

```
"Der Aufzug, dessen Knöpfe Stockwerke anzeigen, die es nicht geben kann
 — negative Zahlen, imaginäre Ebenen, ein Stockwerk namens 'Solvenz'
 ohne Ankunftszeit — öffnet sich mit der Höflichkeit einer Behörde,
 die weiß, dass der Antrag abgelehnt wird."
```

### Mother — Manns *erlebte Rede*

```
"Der Agent lehnt sich an die Wand. Die Wand gibt nach — nicht strukturell,
 organisch. Wie Haut. Man sollte sich davon abstoßen. Man stößt sich nicht ab.
 Die Wärme ist zu gut. War sie schon immer zu gut? Oder lernt sie dazu?"
```

### Entropy — Becketts Degradation

```
Decay 0:  "Der Raum enthält noch Unterscheidungen. Wände, Boden, Decke —
           die Kategorien halten. Noch."
Decay 40: "Raum. Wände. Boden. Die Kategorien — halten sie?"
Decay 70: "Wände. Boden. Gleich."
Decay 85: "Grau."
Decay 95: "..."
```

---

## Quellen

- Disco Elysium: Micro-Reactive Writing (gamedeveloper.com)
- Failbetter Games Writer Guidelines Part III
- Greg Kasavin on Hades Narrative Design
- Alexis Kennedy: Terse Poetry of Cultist Simulator (gamesbeat.com)
- Emily Short: Procedural Text Generation in IF
- Emily Short: Second Person in IF
- Environmental Storytelling (USC / Jenkins 2004)
- Thomas Mann: Philosophy, Allegory, and Structure
- Literary Writing in Disco Elysium and Planescape: Torment (alexanderwinter.se)
- LLM Creative Writing Prompting (LessWrong)
