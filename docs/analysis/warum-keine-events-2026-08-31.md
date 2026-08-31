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
