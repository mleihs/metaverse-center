---
title: "Warum keine Events entstehen — die Schwellen und die Zahlen, die sie nie erreichen"
date: "2026-08-31"
type: analysis
status: measured
lang: de
tags: [heartbeat, autonomous-events, balance, thresholds, prod-measurement]
---

# Warum keine Events entstehen

> Nachgemessen auf Prod am 31.08.2026, nach dem Deploy von C1. Alle Zahlen
> stammen aus der laufenden Datenbank, keine aus dem Code und keine aus einem
> Bericht.

## Der Anlass

C1 (Commit `5258e15f`) hat die Herzschlag-Phase 9f — autonome Ereignisse —
vom BYOK-Schlüssel entkoppelt. Die Erwartung im Commit lautete:

```sql
select count(*) from events where created_at > now() - interval '1 day';
-- Erwartung: steigt über 0. Vorher seit März 0.
```

**Die Phase läuft jetzt. Es entstehen trotzdem keine Events.**

Der Deploy war um 03:56 UTC fertig. Bis 05:19 haben mehrere Welten getickt,
und die Zusammenfassungen tragen die neuen Felder aus C1 — der Beweis, dass
der neue Code läuft:

```json
"autonomy": {
  "byok_available": false,
  "autonomous_events": 0,
  "autonomous_events_llm_budget": 0,
  "mood": { "stress_updates": 0, "recalculated_moods": 7, "breakdowns": [] },
  "opinions": { "recalculated": 42, "relationship_events": [] }
}
```

`autonomous_events_llm_budget` ist das Feld, das C1 eingeführt hat. Es steht
da. Die Phase ist an. `autonomous_events` ist trotzdem 0, auf **jeder** Welt.

C1 hat also ein Tor geöffnet, hinter dem fünf weitere stehen.

## Die fünf Auslöser und die gemessenen Zahlen

`AutonomousEventService.check_and_generate` kennt fünf Wege zu einem Ereignis.
Für jeden steht unten die Schwelle und daneben, was die Welt tatsächlich
produziert.

| # | Auslöser | Schwelle | Gemessen auf Prod | erreichbar? |
|---|---|---|---|---|
| 1 | `stress_breakdown` | `stress_level >= 800` | **alle 258 Agenten: 0** (`count(distinct stress_level) = 1`) | nein |
| 2 | `relationship_threshold` | `abs(opinion_score) >= 60` | 1 176 Meinungen, Spanne **0 … 45** | nein |
| 3 | `conflict_escalation` | Sozialkontakt mit `can_trigger_event` | 0–1 Kontakte je Tick, keiner markiert | faktisch nein |
| 4 | `celebration` | 3+ zufriedene Agenten in einer Zone | 0 in jedem beobachteten Tick | selten |
| 5 | `zone_crisis_reaction` | Agent mit `safety < 20` in der Zone | 258 Agenten, **Minimum 22,0**, Mittel 53,4 | nein |

Vier von fünf sind nicht knapp verfehlt. Sie sind **unerreichbar**, solange
sich an den erzeugenden Größen nichts ändert.

## Die Kette hinter dem Stress — der aufschlussreichste Teil

Auslöser 1 ist der wichtigste, weil an ihm auch D6 („Zusammenbruch ohne
Folge") und die Neurotizismus-Verstärkung in `stress_system.py` hängen. Er ist
nicht nur heute unerreicht, sondern **strukturell unerreichbar**:

```
fn_update_stress_levels (Migration 146, Prod-Körper gelesen):

  mood_score > 0      →  Stress SINKT   (Erholung, skaliert mit Resilienz)
  mood_score < -20    →  Stress STEIGT  ← der einzige Weg nach oben
  sonst               →  Stress SINKT   (-5)
```

Stress kann also ausschließlich steigen, wenn die Laune unter −20 fällt.
Gemessen:

```sql
select min(mood_score), max(mood_score), count(*) filter (where mood_score < -20)
from agent_mood;
--  min: -1   max: +18   unter -20: 0
```

**Die schlechteste Laune, die je ein Agent auf dieser Plattform hatte, ist
−1.** Das Tor verlangt −21 oder tiefer.

Und eine Ebene tiefer wird klar, warum: `mood_score` ist die SUMME der
Moodlets (`fn_recalculate_mood_scores`, Migration 145), und

```sql
select count(*), min(strength), max(strength), avg(strength) from agent_moodlets;
--  186 Moodlets   min: -1   max: +5   Mittel: 1,43
```

Um −21 zu erreichen, bräuchte ein Agent **einundzwanzig gleichzeitige
Moodlets der Stärke −1**. Es gibt insgesamt 74 negative Moodlets, verteilt
auf 258 Agenten.

Die Skalen passen nicht zueinander — und zwar um etwa eine Größenordnung:

```
Moodlet-Stärken     -1 …  +5     (der Inhalt, wie er geschrieben ist)
mood_score          -1 … +18     (deren Summe, gemessen)
Stress-Tor         < -20         (verlangt das Zwanzigfache des Minimums)
Stress-Zusammenbruch >= 800
Meinungs-Tor       ±60           (erreicht wird 45)
Sicherheits-Tor    < 20          (erreicht wird 22)
```

## Was das für die Fehlerklasse bedeutet

Das ist nicht „ein Wert steht falsch". Es ist die Bauart, die dieser Prüflauf
laufend findet — hier in ihrer quantitativen Form:

> Eine Mechanik ist vollständig gebaut, hat Tests, hat Übersetzungen, hat eine
> Oberfläche — und ihre **Eintrittsbedingung liegt außerhalb des Wertebereichs,
> den das System selbst erzeugt.** Sie sieht in jedem Review vollständig aus,
> weil nichts fehlschlägt. Sie ist nur nie an.

Der Unterschied zu einer fehlenden Tür (`a-door-that-only-opens-for-those-inside`)
ist, dass hier alles vorhanden ist. Nur die Zahl auf dem Schloss ist eine
andere als die Zahl auf dem Schlüssel.

Der Verdacht liegt nahe, dass die Schwellen aus einer früheren Fassung der
Moodlet-Stärken stammen (oder aus einem Vorbild — die Kommentare nennen
RimWorld und Darkest Dungeon, deren Stimmungswerte in ganz anderen Bereichen
liegen). Beleg dafür habe ich nicht; das ist eine Vermutung und als solche
gekennzeichnet.

## Was NICHT die Ursache ist

Zwei naheliegende Erklärungen sind gemessen und ausgeschlossen:

* **Nicht die Kosten.** Der Vorlagenpfad ist offen und kostet null. Der
  Herzschlag hat seit dem Wiederanlaufen keinen einzigen Modellaufruf
  gemacht (letzter OpenRouter-Aufruf überhaupt: 30.08. 00:29, ein
  Schmiede-Porträt).
* **Nicht der Herzschlag.** Er läuft, tickt 14 Welten, und `phases_completed`
  steht auf 12 von 12.

## Nachtrag vom 31.08.2026 nachmittags — die Ursache liegt eine Ebene tiefer

> Gefunden beim Abarbeiten von D10-5 (ein Moodlet ohne Deckel), also nicht
> gesucht. Es ändert die Empfehlung unten, deshalb steht es davor.

### Die soziale Tabelle hat sechs Einträge, drei davon sind unerreichbar

`SOCIAL_INTERACTIONS` (`agent_activity_service.py:101-177`) führt sechs
Interaktionen. `_select_interaction` (`:612-634`) wählt aus ihnen mit **zwei**
Toren gleichzeitig:

```python
if mood_min <= mood_a <= mood_max and op_min <= opinion_of_b <= op_max:
```

Gemessen auf Prod, 31.08.2026, über alle 258 Agenten und 1 176 Meinungen:
Laune **−1 bis 18** (Mittel 0,98), Meinung **0 bis 45**, Stress **0 bis 0**.

| Interaktion | verlangt Laune | verlangt Meinung | erreichbar |
|---|---|---|---|
| `deep_conversation` | −20 … 100 | −10 … 100 | ✅ |
| `casual_chat` | −50 … 100 | −30 … 100 | ✅ |
| `collaboration` | −10 … 100 | 0 … 100 | ✅ |
| `insult` | **−100 … −20** | **−100 … −20** | ❌ beide Tore zu |
| `seek_comfort_interaction` | **−100 … −30** | 20 … 100 | ❌ |
| `confrontation` | **−100 … −40** | **−100 … −50** | ❌ beide Tore zu |

Die Hälfte der sozialen Tabelle ist toter Inhalt. Bemerkenswert ist der dritte
Fall: `seek_comfort_interaction` ist eine **positive** Interaktion — Trost —,
und sie ist unerreichbar, weil sie Unglück voraussetzt. Die Welt kann nicht
trösten, weil in ihr niemand traurig werden kann.

### Und daraus folgt N5 vollständig

Die vier unerreichbaren Ereignis-Auslöser oben sind keine vier Befunde. Sie
sind **einer**, in vier Verkleidungen:

```
Es gibt genau EINE Quelle negativer Stimmung: resonance_pressure, Stärke −1,
gedeckelt auf 1 Zeile je Agent (74 Zeilen, 74 Agenten, gemessen).
        ↓
Die Laune kann −1 nicht unterschreiten.
        ↓
insult / confrontation / seek_comfort werden NIE gewählt (Tor bei −20/−40/−30).
        ↓
Keine negativen Meinungsmodifikatoren  →  Meinung fällt nie unter 0
        ↓                                        ↓
Keine negativen Moodlets                  relationship_threshold (±60) tot
        ↓
fn_update_stress_levels erhöht nur bei mood < −20  →  Stress bleibt 0
        ↓
stress_breakdown (≥ 800) tot   ·   D6 (Zusammenbruch) konnte nie auslösen
```

**Der Kreis schließt sich, und das ist der Punkt:** um unglücklich zu werden,
muss ein Agent beleidigt werden; um beleidigt zu werden, muss der Beleidiger
unglücklich sein. Das System kann seine eigene negative Hälfte nicht
anwerfen. Es ist kein Gleichgewichtsproblem — es ist ein fehlender Startimpuls.

### Was das für die Empfehlung ändert

**Weg 1 unten (Schwellen senken) repariert die Ursache NICHT.** Man kann das
Stress-Tor auf `mood < −3` setzen und das Meinungs-Tor auf ±35; solange die
einzige negative Quelle ein einzelnes −1-Moodlet je Agent ist, bleibt die Laune
bei −1 und die Meinung bei 0. Die gesenkten Schwellen wären dann selbst wieder
unerreichbar, nur knapper — und der nächste Prüfer fände denselben Befund mit
kleineren Zahlen.

Die Reparatur gehört an die **Quelle**. Mindestens eine der drei muss stimmen:

1. **Eine negative Quelle, die nicht von negativer Laune abhängt.** Unerfüllte
   Bedürfnisse sind der natürliche Kandidat — und **der Pfad existiert nicht.**
   Nachgemessen: `agent_needs_service.py` enthält kein einziges Moodlet;
   `fn_decay_agent_needs` (Migr. 145:546) senkt fünf Zahlen und tut sonst
   nichts; keine Funktion und kein Dienst berührt `agent_needs` und
   `agent_moodlets` zugleich in dieser Richtung. Bedürfnisse fallen, und
   niemand fühlt es.

   Dass sie fallen, ist auf Prod belegt: `social` reicht von **0** bis 100 —
   es gibt also bereits Agenten mit **vollständig unerfülltem Sozialbedürfnis**,
   deren Laune trotzdem bei ≥ −1 steht. `stimulation` steht bei 28…76 und
   erreicht nirgends 100. Die Größe, die die Welt von selbst in Bewegung
   bringen würde, bewegt sich also schon; sie ist nur an nichts angeschlossen.

   **Das ist die Reparatur mit dem besten Verhältnis:** ein Moodlet je Bedürfnis
   unterhalb einer Schwelle, Stärke nach Tiefe. Es erfindet keine Zahl aus dem
   Nichts (die Bedürfnisse und ihre Zerfallsraten sind bereits eingestellt), es
   ist von negativer Laune unabhängig und bricht damit den Kreis, und es macht
   die drei toten Interaktionen ohne jede Toränderung erreichbar.
2. **Die Tore der drei toten Interaktionen an den erreichbaren Bereich legen.**
   Dann kann eine mittelmäßige Laune eine Reibung erzeugen, aus der die
   schlechte entsteht. Billig, aber es verschiebt den Charakter der Welt —
   Beleidigungen bei Laune 0 statt bei Laune −20.
3. **`resonance_pressure` nicht deckeln oder verstärken.** Am wenigsten
   überzeugend: die Resonanzen sind ein seltenes Ereignis (1 auf Prod), sie
   taugen nicht als Motor des Alltags.

**Empfehlung: Weg 1 messen, bevor irgendetwas geändert wird.** Der Bedürfnispfad
ist der einzige, der die Welt von selbst in Bewegung bringt, ohne dass eine Zahl
erfunden werden muss.

### Das Messskript bekommt damit eine zusätzliche Aufgabe

Der unten geforderte Probelauf muss nicht nur zählen, wie viele Ereignisse je
Auslöser entstehen, sondern zuerst: **erreicht irgendein Agent über viele Ticks
jemals eine Laune unter −1?** Wenn nein, ist jede Schwellenänderung wirkungslos,
und das Skript sagt es in einem Satz, bevor jemand Zahlen wählt.

## Empfehlung

Die Zahlen sind eine **Balance-Entscheidung** und gehören dem Nutzer. Zwei
Wege stehen offen, und sie schließen sich nicht aus:

1. **Die Schwellen an die erreichbaren Maxima anpassen.** Billig, sofort
   wirksam, ändert nichts am Inhalt. Aus den Messungen ergäbe sich etwa:
   Stress-Tor `mood_score < -3` statt `< -20`, Meinungs-Tor `±35` statt `±60`,
   Sicherheits-Tor `< 30` statt `< 20`. **Diese Zahlen sind hergeleitet, nicht
   gemessen** — sie brauchen einen Probelauf.
2. **Die erzeugenden Größen vergrößern.** Kräftigere Moodlets, damit die
   bestehenden Schwellen Sinn ergeben. Teurer (Inhaltsarbeit), aber es macht
   die vorhandenen Zahlen ehrlich statt sie kleinzurechnen.

**Nach dem Vorbild von E11 gehört vor die Entscheidung eine Messung**, nicht
eine Schätzung: ein Skript, das die Herzschlag-Phasen über viele Ticks gegen
eine Kopie des Bestands fährt und zählt, wie viele Ereignisse je Auslöser
entstehen. Ohne das wäre jede neue Zahl wieder eine Momentaufnahme, die wie
eine Spezifikation aussieht (Lehre J7).

## Messrezepte zur Wiederholung

```sql
-- Stress: darf nicht wieder auf einen einzigen Wert kollabieren
select count(*), count(distinct stress_level), min(stress_level), max(stress_level)
from agent_mood;

-- Laune gegen ihr eigenes Tor
select min(mood_score), max(mood_score), count(*) filter (where mood_score < -20)
from agent_mood;

-- Meinungen gegen ihr Tor
select min(opinion_score), max(opinion_score),
       count(*) filter (where abs(opinion_score) >= 60)
from agent_opinions;

-- Sicherheitsbedürfnis gegen sein Tor
select min(safety), max(safety), count(*) filter (where safety < 20) from agent_needs;

-- Und die Gegenprobe, die zählt:
select count(*) from events where created_at > now() - interval '1 day';
```
