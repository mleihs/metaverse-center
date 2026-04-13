---
title: "Epoch Auto-Resolve & Team PvP"
id: epoch-auto-resolve-team-pvp
version: "1.0"
date: 2026-04-13
lang: de
type: spec
status: draft
tags: [epochs, auto-resolve, timer, pvp, team, 2v2, afk, deadline]
depends_on: [epochs-competitive-layer]
---

# Epoch Auto-Resolve & Team PvP — Design Specification

> **Zweck**: Dieses Dokument definiert die Architektur für automatische Zyklusauflösung (Hard Deadline + All-Ready-Acceleration + AFK-Handling) und Team-basiertes PvP (2v2 Human+Bot). Es dient als Implementierungsgrundlage.

---

## 1. Problemstellung

### 1.1 IST-Zustand

Das Epoch-Kampfsystem resolvet Zyklen durch zwei Mechanismen:

1. **Manuell**: Epoch-Creator ruft `POST /epochs/{id}/resolve-cycle`
2. **All-Ready**: Wenn alle menschlichen Teilnehmer `ready=true` signalisieren, löst `toggle_ready()` automatisch `resolve_cycle_full()` aus

**Es gibt keinen serverseitigen Timer.** Wenn ein Spieler nicht `ready` signalisiert, wartet das Spiel endlos. Der Wert `cycle_hours` in `EpochConfig` wird ausschliesslich für Mission-Timer-Arithmetik verwendet (Zeile 336-352, `cycle_resolution_service.py`), nicht als Wall-Clock-Deadline.

### 1.2 Probleme

| Problem | Schweregrad | Auswirkung |
|---------|-------------|------------|
| Ein AFK-Spieler blockiert das gesamte Spiel | Kritisch | Game stalls, andere Spieler verlieren Interesse |
| Kein Zeitdruck — strategische Spannung fehlt | Hoch | "Gentleman's Agreement"-Kadenz statt echter Echtzeit-Spannung |
| Kein "has acted"-Tracking | Mittel | Spieler können "Ready" klicken ohne zu handeln |
| Kein Team-vs-Team-Preset (2v2) | Mittel | Bots agieren individuell, kein koordiniertes Team-Play |
| Keine AFK-Penalties | Mittel | Kein Anreiz, rechtzeitig zu handeln |

### 1.3 Zielzustand

```
┌───────────────────────────────────────────────────────────┐
│  ZYKLUS-LEBENSZYKLUS                                       │
│                                                             │
│  Zyklusstart                                                │
│  ├── Spieler handeln (deploy, fortify, pass...)            │
│  ├── "Ready" signalisieren (braucht mindestens 1 Aktion)  │
│  │                                                         │
│  ├── TRIGGER A: Alle Humans acted + ready → SOFORT resolve │
│  ├── TRIGGER B: Hard Deadline erreicht → AUTO resolve      │
│  │              (AFK-Spieler haben "gehalten")             │
│  └── TRIGGER C: Creator manuell → resolve (wie bisher)    │
│                                                             │
│  Nächster Zyklus startet mit neuem Deadline-Timer          │
└───────────────────────────────────────────────────────────┘
```

---

## 2. Genre-Research: Wie lösen andere Spiele das Problem?

### 2.1 Diplomacy (webDiplomacy, Backstabbr, vDiplomacy)

**Referenzsystem seit Jahrzehnten für simultane Züge mit Deadline.**

| Aspekt | Detail |
|--------|--------|
| Deadline | Hard, konfigurierbar (5min live, 24h async, 48-72h casual) |
| NMR (No Moves Received) | Alle Einheiten "halten" — kein Angriff, kein Support |
| NMR-Konsequenzen | 2 NMRs → "Civil Disorder" (Land aufgegeben), Reliability-Rating sinkt |
| Rückzugs-NMR | Katastrophal: alle vertriebenen Einheiten werden aufgelöst |
| All-Ready-Mechanik | Ja — wenn alle 7 Spieler "Ready" signalisieren, sofortige Auflösung |
| Ready-Widerruf | Ja — jederzeit vor Auflösung widerrufbar |
| Grace Period | Keine — Community-Konsens: Grace Periods belohnen Verspätung |
| Order-Änderung | Unbegrenzt vor Deadline; nur letzte Submission zählt |
| Fixed Schedule | Bevorzugt: "Dieses Spiel resolvet täglich um 21:00 UTC" |

**Schlüsselerkenntnis**: Die Diplomacy-Community hat jahrzehntelange Iteration hinter sich. Universelle Lehren:
- Harte Deadlines, keine Grace Periods
- Konservative Defaults für abwesende Spieler (Hold, nicht random)
- Schnelle Ersatzspieler-Systeme für aufgegebene Positionen
- "All Ready = Early Resolve" ist beliebt und soll enthalten sein
- Fixed daily resolution times bevorzugt gegenüber rolling timers

### 2.2 Dominions 5/6 (Gold Standard für Async Simultaneous Turns)

**Das am besten getestete System für simultane Züge mit Deadline in 4X-Spielen.**

| Aspekt | Detail |
|--------|--------|
| Turn-Model | Vollständig simultan, Aufträge geheim bis Auflösung |
| Timer-Modus | **Hybrid: Timer + All-Ready + Host-Override** |
| Standard-Timer | 24h für async, 5-15min für Blitz |
| All-Ready | Turn resolvet sofort wenn alle submitted haben |
| Host-Rolle | Kann force-hosten, pausieren, verlängern, AI zuweisen |
| AI-Übernahme | Spieler fehlt → AI spielt seinen Turn (konservativ) |
| Stale-Erkennung | "Stale" nach 1 Miss; 2-3 Stales → AI permanent |
| Partial Orders | Units ohne Aufträge halten Position |
| Resubmission | Unbegrenzt vor Deadline, nur letzte Submission zählt |
| Stale-Sichtbarkeit | Alle Spieler sehen, wer "stale" ist → sozialer Druck |

**Das Dominions-Hybrid-Pattern (Timer + All-Ready + Host) ist der bewährte Standard.** Kein simultanes Strategiespiel hat es in 20 Jahren verbessert. Es schichtet drei Kontrollmechanismen:
- Timer deckt den Normalfall ab
- Demokratie (All-Ready) beschleunigt
- Host (Creator) behandelt Ausnahmen

### 2.3 Neptune's Pride & Subterfuge

| Aspekt | Neptune's Pride (RT) | Neptune's Pride (TB) | Subterfuge |
|--------|---------------------|---------------------|------------|
| Turn-Struktur | Tick-basiert (Wall Clock) | Tick-basiert (All-Submit) | Kontinuierlich Echtzeit |
| Abwesenheit | Schwer (kann nicht reagieren) | Moderat (letzte Orders gelten) | Gering (Order Queue) |
| Dominantes Skill | Aktivität + Strategie | Strategie + Verhandlung | Planung + Täuschung |
| AFK-Handling | AI nach N Misses | AI nach N Misses | Order Queue + Shields |

**Subterfuge-Innovation: Order Queue.** Spieler planen Aktionen in die Zukunft vor. Das transformiert das Spiel von "wer checkt am öftesten" zu "wer plant am cleversten". Ein Spieler, der einmal täglich einloggt aber brillante Züge queued, kann jemanden übertreffen, der jede Stunde checkt.

**Relevanz für unser System**: Das Order-Queue-Konzept ist interessant, aber architektonisch eine zu grosse Abweichung vom bestehenden Zyklusmodell. Stattdessen adaptieren wir die Erkenntnis: **Future-Planning reduziert Echtzeit-Präsenz-Vorteil.** Unser Äquivalent: Spieler können jederzeit innerhalb des Zyklus agieren; die Deadline ist der Synchronisationspunkt.

### 2.4 Mobile Async (Polytopia, Civ VI, Chess.com)

| Spiel | Timer-Typ | Default | AFK-Konsequenz | AI-Übernahme |
|-------|-----------|---------|----------------|-------------|
| Polytopia | Per-Turn-Deadline | 24h | Sofortige Elimination | Nein |
| Civ VI (PbC) | Kein Timer | ∞ | Spiel stallt | Nein |
| Civ VI (Online) | Per-Turn-Fixed | 60-180s | Auto-End Turn | Optional |
| Chess.com Daily | Per-Zug-Bank | 1-14d | Auto-Verlust | Nein |
| Clash Royale CW | Shared Window | 24-48h | Null-Beitrag | N/A |

**Schlüsselerkenntnisse:**
- **Polytopia**: 1 Timeout = Elimination ist zu hart für lange Spiele
- **Civ VI PbC**: Kein Timer = Spiel stirbt (grösster Design-Flaw)
- **Chess.com**: "Vacation Days" als async-freundliches Feature, "Conditional Moves" als Latenz-Reduktion
- **Graduated Consequences** (bester Pattern): Auto-Pass bei 1. Timeout, AI bei 2., Elimination bei 3.

### 2.5 AFK-Penalty Best Practices (Cross-Genre-Analyse)

| Spiel | Detection | 1. Offense | 2. Offense | 3.+ Offense | Comeback |
|-------|-----------|------------|------------|-------------|----------|
| LoL | 5min kein XP | 5min Queue-Delay | 10min Delay | 15min x20 + LP-Loss | Decay nach 2 Wochen clean |
| Dota 2 | 5min Disconnect | Behavior Score -500 | Low Priority x3 | Low Priority x5 + Bans | +200 Score/cleanem Spiel |
| Dominions | 1 verpasster Turn | AI spielt Turn | AI + "Stale"-Flag | Permanente AI/Elimination | Sofortige Rückkehr möglich |
| Chess.com | Clock läuft ab | Voller Verlust | Voller Verlust | Account-Einschränkung | Vacation Days (Pause) |

**Konsens-Pattern für 8h-Zyklus-Async-Strategie:**
- **1. Miss**: Auto-Resolve (defensive AI). Kein Penalty. Benachrichtigung.
- **2. Miss (konsekutiv)**: Auto-Resolve + Minor Penalty (-10% RP-Generation 1 Turn). AFK-Flag.
- **3. Miss (konsekutiv)**: Auto-Resolve + Major Penalty (-25% RP 2 Turns). Warnung an alle.
- **4. Miss**: Permanente AI-Übernahme oder Elimination.
- **Mercy-Reset**: 5 pünktliche Turns resetten 1 Tier. 10 resetten komplett.

**Die Prioritätenreihenfolge** (aus der Forschung konsistent):
1. Spielqualität für aktive Spieler erhalten (höchste Priorität)
2. Gnädige Rückkehr für temporär Abwesende (hoch)
3. Chronisches AFK bestrafen (mittel)
4. Absichtlich vs. unabsichtlich unterscheiden (niedrig — zu schwer, Eskalation regelt es)

### 2.6 Technische Production-Patterns

**Empfohlene Architektur: Hybrid (asyncio Timer + Polling Sweep)**

```
Eager Timer (asyncio.sleep bis Deadline) → resolve_cycle() RPC
     ↓ falls verpasst (Restart, Race Condition)
Safety-Net Sweep (alle 30s) → SELECT * FROM active cycles WHERE deadline < NOW()
     ↓
Beide rufen denselben atomaren RPC auf → CAS (Compare-and-Swap)
```

**Atomare Auflösung via CAS-Pattern:**
```sql
UPDATE game_epochs
SET status = 'resolving'
WHERE id = p_epoch_id
  AND status = 'active'    -- CAS: nur wenn noch aktiv
  AND current_cycle = p_expected_cycle;  -- Optimistic Lock
-- Nur EIN Aufrufer schafft es durch den CAS-Filter
```

**Deadline Race Condition (Spieler submittet bei 14:59:59.950, Server resolvet bei 15:00:00.000):**
- Lösung: `FOR UPDATE` Row Lock in submit_move + resolve_cycle
- Server-Clock ist Autorität
- Kleine Grace Period (2-5s) absorbiert Netzwerklatenz

**Client-Countdown-Sync:**
- Immer **absolute Deadline** senden (`deadline_at: "2026-04-13T15:00:00Z"`), nie "remaining time"
- Client berechnet `remaining = deadline - serverNow()` mit Clock-Offset-Korrektur
- Supabase Realtime broadcastet `cycle_started` Event mit `deadline_at`

---

## 3. Fünf Variationen — Pro/Contra-Analyse

### Bewertungskriterien

| Kriterium | Gewichtung | Beschreibung |
|-----------|------------|--------------|
| **Spielerlebnis** | 30% | Wie fühlt sich das für aktive Spieler an? |
| **AFK-Robustheit** | 25% | Wie gut übersteht das Spiel einen AFK-Spieler? |
| **Implementierungsaufwand** | 20% | Wie viel muss am bestehenden System geändert werden? |
| **Async-Fairness** | 15% | Wie fair ist es für Spieler in verschiedenen Zeitzonen? |
| **Emergent Gameplay** | 10% | Erzeugt es interessante strategische Entscheidungen? |

---

### Variation A: Pure Hard Deadline (Diplomacy-Stil)

**Konzept**: Ein fester Timer läuft. Bei Deadline resolvet der Server den Zyklus automatisch. Kein Early Resolve. Wer nicht gehandelt hat, "hält" (keine Aktionen, bestehende Guardians/Missionen bleiben aktiv).

**Mechanik:**
```
Zyklusstart → Timer startet (z.B. 8h)
├── Spieler handeln frei innerhalb der 8h
├── Ready-Signal hat KEINE Wirkung auf Timing
├── Bei Deadline: Server resolvet automatisch
│   ├── Spieler die gehandelt haben: Actions resolved
│   └── Spieler die NICHT gehandelt haben: "Hold" (NMR)
│       └── Keine neuen Deploys, keine Recalls, kein Fortify
│       └── Bestehende Missionen laufen weiter
└── Nächster Zyklus startet sofort
```

**EpochConfig-Erweiterung:**
```python
auto_resolve_mode: Literal["hard_deadline"] = "hard_deadline"
cycle_deadline_minutes: int = 480  # 8h
```

| Pro | Contra |
|-----|--------|
| Maximale Vorhersagbarkeit — jeder weiss genau wann resolved wird | Spieler die in 10min fertig sind müssen 7h 50min warten |
| Einfachste Implementierung (1 Timer, kein Ready-Check) | Kein Anreiz für schnelles Handeln |
| Perfekt timezone-fair (feste Kadenz) | Kann sich "langsam" anfühlen wenn alle früh fertig sind |
| NMR-Handling ist trivial (einfach nichts tun) | Eliminiert das spannende "alle warten aufeinander"-Moment |

**Bewertung:**

| Kriterium | Score (1-10) | Begründung |
|-----------|-------------|------------|
| Spielerlebnis | 5 | Vorhersagbar aber langweilig; kein "Momentum" |
| AFK-Robustheit | 9 | AFK ist irrelevant — Timer läuft sowieso |
| Implementierungsaufwand | 9 | Minimal: 1 Scheduler + deadline_at Spalte |
| Async-Fairness | 10 | Perfekt — feste Zeiten, keine Abhängigkeit von anderen |
| Emergent Gameplay | 3 | Kein strategisches Timing, kein "wer traut sich Ready" |
| **Gewichtet** | **6.65** | |

---

### Variation B: Hard Deadline + All-Ready-Acceleration (Dominions-Hybrid)

**Konzept**: Timer läuft als Hard Cap. ABER: wenn alle menschlichen Teilnehmer "Ready" signalisieren, resolvet der Zyklus sofort — wie im IST-Zustand, nur jetzt mit Deadline als Safety Net. Creator kann weiterhin manuell resolven.

**Mechanik:**
```
Zyklusstart → Timer startet (z.B. 8h) + Ready-States resetten
├── Spieler handeln frei
├── Spieler signalisieren "Ready" (widerrufbar)
│   ├── Wenn ALLE Humans ready → SOFORT resolve (bestehende Logik)
│   └── Ready-Widerruf jederzeit möglich
├── Bei Deadline (falls nicht alle ready): Server resolvet automatisch
│   ├── Ready-Spieler: Actions resolved normal
│   └── Nicht-Ready-Spieler: "Hold" (NMR) — bestehende Actions bleiben
├── Creator kann jederzeit manuell resolven (wie bisher)
└── Nächster Zyklus startet
```

**EpochConfig-Erweiterung:**
```python
auto_resolve_mode: Literal["deadline_or_ready"] = "deadline_or_ready"
cycle_deadline_minutes: int = 480  # 8h Hard Deadline
```

| Pro | Contra |
|-----|--------|
| Bewährter Standard (Dominions, 20+ Jahre) | Ready kann durch 1 Spieler blockiert werden (bis Deadline) |
| Minimale Abweichung vom IST-Zustand (Ready-Logik existiert) | Kein Schutz gegen "leere Ready" (Ready ohne Aktion) |
| Sofortige Auflösung wenn alle bereit → schnelles Spiel möglich | AFK-Spieler müssen volle Deadline abwarten |
| Deadline als Safety Net eliminiert das "ewiges Warten"-Problem | Keine Unterscheidung "hat gehandelt" vs. "hat nicht gehandelt" |
| Creator-Override für Edge Cases | |

**Bewertung:**

| Kriterium | Score (1-10) | Begründung |
|-----------|-------------|------------|
| Spielerlebnis | 7 | Gut: schnell wenn alle ready, Deadline als Sicherheit |
| AFK-Robustheit | 8 | Deadline fängt AFK auf, aber Wartezeit bis Deadline |
| Implementierungsaufwand | 8 | Gering: Scheduler + deadline_at; Ready-Logik existiert |
| Async-Fairness | 8 | Gut: Deadline fair, Ready beschleunigt nur |
| Emergent Gameplay | 6 | "Ready-Poker" entsteht: wer traut sich zuerst? |
| **Gewichtet** | **7.45** | |

---

### Variation C: Activity-Gated Ready + Hard Deadline (Empfehlung)

**Konzept**: Wie Variation B, aber mit einer zusätzlichen Schicht: Der "Ready"-Button erfordert, dass der Spieler mindestens **eine bewusste Aktion** in diesem Zyklus ausgeführt hat (Deploy, Fortify, Counter-Intel, Allianz-Aktion, oder explizites "Pass"). Dies verhindert "leere Ready"-Clicks und stellt sicher, dass jeder Spieler mindestens eine strategische Entscheidung pro Zyklus trifft.

**Mechanik:**
```
Zyklusstart → Timer startet + Ready-States resetten + has_acted resetten
├── Spieler handeln frei
│   ├── Deploy/Fortify/Counter-Intel/Recall → has_acted = true
│   ├── Allianz-Proposal/Vote → has_acted = true
│   └── Expliziter "Pass" → has_acted = true
│
├── Spieler signalisieren "Ready"
│   ├── Ready-Button DISABLED bis has_acted = true
│   ├── Widerrufbar (Ready revoken, has_acted bleibt true)
│   ├── Wenn ALLE Humans acted + ready → SOFORT resolve
│   └── Ready ohne Action → nur via expliziten "Pass"-Button
│
├── Bei Deadline (falls nicht alle ready): Server resolvet automatisch
│   ├── Acted-Spieler: Actions resolved normal
│   ├── Not-Acted-Spieler: "Hold" (NMR) + AFK-Tracking
│   └── AFK-Penalties ab 2. konsekutivem Miss
│
├── Creator-Override: Manuell resolven (wie bisher)
└── Nächster Zyklus startet
```

**EpochConfig-Erweiterung:**
```python
auto_resolve_mode: Literal["activity_gated"] = "activity_gated"
cycle_deadline_minutes: int = 480  # 8h Hard Deadline
min_cycle_duration_minutes: int = 15  # Mindestdauer (Anti-Spam)
require_action_for_ready: bool = True  # Gate Ready auf Aktion
afk_penalty_enabled: bool = True
afk_rp_penalty: int = 2  # RP-Abzug pro AFK-Zyklus
afk_escalation_threshold: int = 3  # Ab wann härter
```

**Neuer "Pass"-Endpoint:**
```
POST /epochs/{epoch_id}/pass-cycle
  Body: { simulation_id: UUID }
  Effect: has_acted_this_cycle = true (ohne tatsächliche Aktion)
  Response: { passed: true }
```

**AFK-Eskalation:**

| Konsekutive AFK-Zyklen | Konsequenz |
|-------------------------|------------|
| 1 | "Hold" — keine Penalty. Benachrichtigung (Email + Battle Log) |
| 2 | -2 RP für 1 Zyklus. "AFK"-Badge im Ready Panel. Battle Log Event |
| 3 | -5 RP für 2 Zyklen. Stability-Malus (-3 Punkte). Warnung an alle |
| 4+ | Permanente AI-Übernahme (Bot mit Sentinel-Personality, Difficulty "easy") |

**Mercy-Reset:** 5 pünktliche Zyklen (acted + ready vor Deadline) resetten 1 AFK-Tier. 10 resetten komplett.

| Pro | Contra |
|-----|--------|
| Erzwingt bewusste Entscheidung pro Zyklus ("Pass" = "ich halte") | Komplexere Implementierung (has_acted Tracking) |
| Verhindert "leere Ready"-Clicks | Ein zusätzlicher Button ("Pass") in der UI |
| Eskalierendes AFK-System fair für alle | has_acted muss bei JEDER Aktion gesetzt werden |
| Sofortige Auflösung bei All-Acted + All-Ready | Spieler könnten "Pass+Ready" spammen statt nachzudenken |
| Min-Cycle-Duration verhindert Spam | min_cycle_duration kann frustrieren wenn ALLE sofort fertig sind |
| AI-Übernahme bei chronischem AFK | AI-Sentinel ist konservativ aber nicht perfekt |

**Bewertung:**

| Kriterium | Score (1-10) | Begründung |
|-----------|-------------|------------|
| Spielerlebnis | 9 | Bewusste Entscheidungen, schnell wenn alle acted, Deadline als Net |
| AFK-Robustheit | 9 | Deadline + AFK-Tracking + AI-Übernahme |
| Implementierungsaufwand | 6 | Mittel: has_acted, Pass-Endpoint, AFK-Tracking, Scheduler |
| Async-Fairness | 8 | Deadline fair; Ready/Acted-Gate gleichmässig |
| Emergent Gameplay | 8 | "Pass vs. Act"-Entscheidung, AFK-Diplomatie, Ready-Poker |
| **Gewichtet** | **8.25** | |

---

### Variation D: Soft Deadline + Escalating Pressure

**Konzept**: Kein Hard Deadline. Stattdessen eskalierender Druck: nach der "erwarteten Zyklusdauer" beginnen Penalties (RP-Decay, Sichtbarkeit, Vulnerability), die bis zur Auflösung zunehmen. All-Ready resolvet sofort. Kein automatisches Resolve — nur sozialer/mechanischer Druck.

**Mechanik:**
```
Zyklusstart → "Erwartete Zyklusdauer" (z.B. 8h) beginnt
├── 0h - 8h: Normalphase — kein Druck
├── 8h - 10h: "Overtime"
│   ├── Alle Not-Ready-Spieler verlieren 1 RP/h
│   ├── Orange-Glow auf Ready Panel
│   ├── Battle Log: "Overtime: <Name> hält das Spiel auf"
│
├── 10h - 12h: "Critical Overtime"
│   ├── Alle Not-Ready-Spieler verlieren 2 RP/h
│   ├── Ihre Fortifications werden sichtbar für ALLE
│   ├── Red-Pulsing auf Ready Panel
│
├── 12h+: "Emergency Resolve"
│   ├── Server resolvet automatisch (wie Hard Deadline)
│   ├── AFK-Spieler erhalten -5 RP Penalty
│
├── All-Ready jederzeit → SOFORT resolve
└── Creator kann jederzeit resolven
```

| Pro | Contra |
|-----|--------|
| Erzeugt dramatischen Zeitdruck ohne Hard Cutoff | Overcomplicated — zu viele Zustände |
| "Overtime" ist spannendes Gameplay-Element | Belohnt die Strategie "absichtlich warten lassen" als Griefing |
| Graduated Pressure statt binärem Cutoff | Spieler in ungünstigen Zeitzonen zahlen höhere Penalties |
| Einzigartig — kein anderes Spiel macht das so | Schwer zu kommunizieren: "wann passiert was?" |
| | RP-Decay bestraft Spieler mit vollen Agendas |

**Bewertung:**

| Kriterium | Score (1-10) | Begründung |
|-----------|-------------|------------|
| Spielerlebnis | 6 | Interessant aber stressig; Overtime kann toxisch werden |
| AFK-Robustheit | 7 | Emergency Resolve fängt ab, aber 12h+ Wartezeit |
| Implementierungsaufwand | 4 | Hoch: Mehrere Zustände, pro-Stunde-Decay, Visibility-Changes |
| Async-Fairness | 5 | Schlecht: Timezone-Disadvantage in Overtime |
| Emergent Gameplay | 7 | Overtime als taktisches Element, aber exploitbar |
| **Gewichtet** | **5.95** | |

---

### Variation E: Fixed Schedule (webDiplomacy Daily Pattern)

**Konzept**: Zyklen resolven zu festen, vordefinierten realen Uhrzeiten (z.B. 09:00, 17:00, 01:00 UTC — drei 8h-Zyklen pro Tag). Alle Spieler wissen genau, wann der nächste Resolve passiert. All-Ready kann den Resolve beschleunigen (aber nur bis maximal `min_cycle_duration`).

**Mechanik:**
```
Epoch-Creation → Creator wählt "Resolve Schedule"
  Preset-Optionen:
  - "3x Daily": 01:00, 09:00, 17:00 UTC
  - "2x Daily": 09:00, 21:00 UTC
  - "1x Daily": 21:00 UTC
  - "Custom": Freie Zeitpunkte (max 4 pro Tag)

Zyklusbeginn = letzte Resolve-Zeit
Nächster Resolve = nächster Zeitpunkt im Schedule

├── Spieler handeln frei zwischen den festen Zeitpunkten
├── All-Ready → beschleunigt auf frühestens min_cycle_duration nach Start
├── Am Schedule-Zeitpunkt: Server resolvet automatisch
│   ├── Egal ob Ready oder nicht
│   └── NMR für Nicht-Aktive
└── Nächster Zyklus startet (nächster Schedule-Zeitpunkt als Deadline)
```

**EpochConfig-Erweiterung:**
```python
auto_resolve_mode: Literal["fixed_schedule"] = "fixed_schedule"
resolve_schedule_utc: list[str] = ["01:00", "09:00", "17:00"]  # UTC-Zeiten
min_cycle_duration_minutes: int = 60  # Mindestens 1h auch bei All-Ready
```

| Pro | Contra |
|-----|--------|
| Maximale Vorhersagbarkeit — Spieler bauen es in ihren Tagesrhythmus | Unflexibel: "09:00 UTC passt mir nie" für manche Zeitzonen |
| Bewährtes Pattern (webDiplomacy, Forum-Diplomacy) | All-Ready-Beschleunigung limitiert (min_cycle_duration) |
| Keine Abhängigkeit von anderen Spielern für Timing | Erfordert Schedule-Picker in der UI |
| Natürlicher "Briefing"-Rhythmus: morgens checken, abends nochmal | Passt schlecht zu Sprint-Epochs (3-Tage-Academy) |
| Eliminiert "wann kommt der nächste Resolve?" Ungewissheit | Wochenende/Feiertage problematisch (starr) |

**Bewertung:**

| Kriterium | Score (1-10) | Begründung |
|-----------|-------------|------------|
| Spielerlebnis | 7 | Vorhersagbar, routinetauglich, aber starr |
| AFK-Robustheit | 9 | Feste Zeiten = kein AFK-Blocking möglich |
| Implementierungsaufwand | 5 | Scheduler + Schedule-Picker + Timezone-Handling |
| Async-Fairness | 7 | Fixed Times fair WENN gut gewählt; unfair wenn nicht |
| Emergent Gameplay | 5 | Wenig emergent; Timing ist fix, kein Poker |
| **Gewichtet** | **7.00** | |

---

### Vergleichsmatrix

| Kriterium (Gewicht) | A: Pure Deadline | B: Deadline+Ready | **C: Activity-Gated** | D: Soft Deadline | E: Fixed Schedule |
|---------------------|-----------------|-------------------|-----------------------|-----------------|-------------------|
| Spielerlebnis (30%) | 5 | 7 | **9** | 6 | 7 |
| AFK-Robustheit (25%) | 9 | 8 | **9** | 7 | 9 |
| Impl.-Aufwand (20%) | 9 | 8 | 6 | 4 | 5 |
| Async-Fairness (15%) | 10 | 8 | 8 | 5 | 7 |
| Emergent Gameplay (10%) | 3 | 6 | **8** | 7 | 5 |
| **Gewichtet** | **6.65** | **7.45** | **8.25** | **5.95** | **7.00** |

---

## 4. Empfehlung

### Primäre Empfehlung: Variation C (Activity-Gated Ready + Hard Deadline)

**Begründung:**
1. Höchster gewichteter Score (8.25)
2. Erzwingt bewusste Entscheidungen pro Zyklus (kein "leeres Ready")
3. Sofortige Auflösung möglich wenn ALLE gehandelt + ready
4. Hard Deadline als unverrückbares Safety Net
5. Eskalierendes AFK-System mit AI-Übernahme
6. Kompatibel mit bestehendem Ready-Mechanismus (Erweiterung, kein Ersatz)
7. Folgt dem Dominions-Hybrid-Pattern (Timer + Democracy + Host)

### Implementierungsempfehlung: Modularer Ansatz

Alle 5 Variationen teilen gemeinsame Infrastruktur. Implementiere `auto_resolve_mode` als Config-Wert in `EpochConfig`, sodass der Epoch-Creator den Modus wählen kann:

```python
class EpochConfig(BaseModel):
    # ... bestehend ...
    auto_resolve_mode: Literal[
        "manual",           # IST-Zustand: nur Creator/All-Ready
        "hard_deadline",    # Variation A
        "deadline_or_ready", # Variation B
        "activity_gated",   # Variation C (Default)
        "fixed_schedule",   # Variation E
    ] = "activity_gated"
```

**Phase 1** implementiert die gemeinsame Infrastruktur (Scheduler, Deadline-Tracking, has_acted) plus Variation C als Default. Andere Modi können später mit minimaler Mehrarbeit ergänzt werden.

---

## 5. Detaillierte Implementierungsarchitektur

### 5.1 Schema-Änderungen (Migration)

```sql
-- ═══════════════════════════════════════════════════════
-- Migration: epoch_auto_resolve_infrastructure
-- ═══════════════════════════════════════════════════════

-- 1. Neue Spalten auf game_epochs
ALTER TABLE game_epochs
  ADD COLUMN cycle_started_at TIMESTAMPTZ,
  ADD COLUMN cycle_deadline_at TIMESTAMPTZ;

-- 2. Neue Spalten auf epoch_participants
ALTER TABLE epoch_participants
  ADD COLUMN has_acted_this_cycle BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN consecutive_afk_cycles INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN total_afk_cycles INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN afk_replaced_by_ai BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Neuer Battle-Log-Event-Typ
-- (battle_log.event_type ist ein TEXT-Feld, keine Enum — kein ALTER TYPE nötig)
-- Neue Typen: 'cycle_auto_resolved', 'player_afk', 'player_afk_penalty',
--             'player_afk_ai_takeover', 'player_returned', 'player_passed'

-- 4. Index für Scheduler-Query
CREATE INDEX idx_game_epochs_active_deadline
  ON game_epochs (cycle_deadline_at)
  WHERE status IN ('foundation', 'competition', 'reckoning')
    AND cycle_deadline_at IS NOT NULL;

-- 5. Atomare Deadline-Check-Funktion
CREATE OR REPLACE FUNCTION fn_check_and_resolve_deadline(
  p_epoch_id UUID,
  p_expected_cycle INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_epoch RECORD;
BEGIN
  -- CAS: nur wenn noch aktiv UND deadline überschritten
  UPDATE game_epochs
  SET cycle_started_at = NULL  -- Marker: "wird gerade resolved"
  WHERE id = p_epoch_id
    AND current_cycle = p_expected_cycle
    AND status IN ('foundation', 'competition', 'reckoning')
    AND cycle_deadline_at IS NOT NULL
    AND cycle_deadline_at <= NOW()
  RETURNING * INTO v_epoch;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('resolved', FALSE, 'reason', 'not_due_or_concurrent');
  END IF;

  RETURN jsonb_build_object(
    'resolved', TRUE,
    'epoch_id', v_epoch.id,
    'cycle_number', v_epoch.current_cycle,
    'config', v_epoch.config
  );
END;
$$;

-- 6. Atomare "set acted" Funktion
CREATE OR REPLACE FUNCTION fn_set_acted_this_cycle(
  p_epoch_id UUID,
  p_simulation_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE epoch_participants
  SET has_acted_this_cycle = TRUE
  WHERE epoch_id = p_epoch_id
    AND simulation_id = p_simulation_id
    AND has_acted_this_cycle = FALSE;  -- Idempotent

  RETURN FOUND;
END;
$$;
```

### 5.2 Backend-Architektur

#### 5.2.1 EpochCycleScheduler (Neuer Background-Task)

```python
# backend/services/epoch_cycle_scheduler.py
"""
Periodic background task that auto-resolves epoch cycles at deadline.

Architecture: Hybrid (eager + polling sweep)
- Eager: asyncio timers for known deadlines (sub-second precision)
- Sweep: 30s polling für verpasste/unbekannte deadlines (durability)

Follows the ResonanceScheduler pattern (lifespan registration).
"""

class EpochCycleScheduler:
    """Periodic background task that auto-resolves epoch cycles at deadline."""

    _task: asyncio.Task | None = None
    _eager_timers: dict[str, asyncio.Task] = {}

    @classmethod
    async def start(cls) -> asyncio.Task:
        cls._task = asyncio.create_task(cls._run_sweep_loop())
        # Seed eager timers for all active epochs
        await cls._seed_eager_timers()
        return cls._task

    @classmethod
    async def _run_sweep_loop(cls) -> None:
        """Safety-net: alle 30s prüfen ob Deadlines verpasst wurden."""
        while True:
            try:
                admin = await get_admin_supabase()
                await cls._sweep_expired_cycles(admin)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Epoch cycle scheduler sweep error")
                sentry_sdk.capture_exception()
            await asyncio.sleep(30)

    @classmethod
    async def _sweep_expired_cycles(cls, admin: Client) -> None:
        """Query alle aktiven Epochs mit überschrittener Deadline."""
        resp = await (
            admin.table("game_epochs")
            .select("id, current_cycle, config, cycle_deadline_at")
            .in_("status", ["foundation", "competition", "reckoning"])
            .not_.is_("cycle_deadline_at", "null")
            .lte("cycle_deadline_at", datetime.now(UTC).isoformat())
            .execute()
        )
        for epoch in extract_list(resp):
            await cls._auto_resolve_cycle(admin, epoch)

    @classmethod
    async def _auto_resolve_cycle(cls, admin: Client, epoch: dict) -> None:
        """Atomarer Auto-Resolve via CAS-RPC."""
        # CAS-Prüfung: nur wenn noch aktiv und Deadline überschritten
        check = await admin.rpc(
            "fn_check_and_resolve_deadline",
            {"p_epoch_id": epoch["id"], "p_expected_cycle": epoch["current_cycle"]},
        ).execute()
        if not check.data or not check.data.get("resolved"):
            return  # Bereits resolved oder noch nicht fällig

        # AFK-Tracking vor Resolve
        await cls._process_afk_players(admin, epoch["id"])

        # Resolve-Pipeline (identisch mit toggle_ready Auto-Resolve)
        from backend.services.epoch_service import EpochService
        await EpochService.resolve_cycle_full(admin, UUID(epoch["id"]), admin)

        # Neuen Timer setzen
        await cls._schedule_next_deadline(admin, epoch["id"])

    @classmethod
    async def schedule_eager_timer(cls, epoch_id: str, deadline_at: datetime):
        """asyncio Timer für bekannte Deadline (sub-second precision)."""
        if epoch_id in cls._eager_timers:
            cls._eager_timers[epoch_id].cancel()
        delay = (deadline_at - datetime.now(UTC)).total_seconds()
        if delay <= 0:
            return  # Sweep wird es aufräumen
        cls._eager_timers[epoch_id] = asyncio.create_task(
            cls._eager_wait(epoch_id, delay)
        )
```

#### 5.2.2 Anpassungen an bestehende Services

**`cycle_resolution_service.py` — resolve_cycle() erweitern:**

```python
# Nach erfolgreichem Resolve:
# 1. Reset has_acted für alle Teilnehmer
await db.table("epoch_participants") \
    .update({"has_acted_this_cycle": False, "cycle_ready": False}) \
    .eq("epoch_id", str(epoch_id)).execute()

# 2. cycle_started_at + cycle_deadline_at setzen
config = {**DEFAULT_CONFIG, **epoch.get("config", {})}
deadline_minutes = config.get("cycle_deadline_minutes", 480)
now = datetime.now(UTC)
await db.table("game_epochs").update({
    "cycle_started_at": now.isoformat(),
    "cycle_deadline_at": (now + timedelta(minutes=deadline_minutes)).isoformat(),
}).eq("id", str(epoch_id)).execute()

# 3. Eager Timer registrieren
from backend.services.epoch_cycle_scheduler import EpochCycleScheduler
await EpochCycleScheduler.schedule_eager_timer(
    str(epoch_id),
    now + timedelta(minutes=deadline_minutes),
)
```

**`epoch_chat_service.py` — toggle_ready() erweitern:**

```python
# Activity Gate: Ready braucht has_acted ODER Bot
if ready and config.get("require_action_for_ready", True):
    participant = await (
        admin_supabase.table("epoch_participants")
        .select("has_acted_this_cycle, is_bot")
        .eq("epoch_id", str(epoch_id))
        .eq("simulation_id", str(simulation_id))
        .single()
        .execute()
    )
    if not participant.data["is_bot"] and not participant.data["has_acted_this_cycle"]:
        raise bad_request("You must perform at least one action (or pass) before signalling ready.")
```

**`operative_mission_service.py` — deploy() erweitern:**

```python
# Nach erfolgreichem Deploy: has_acted setzen
await admin_supabase.rpc(
    "fn_set_acted_this_cycle",
    {"p_epoch_id": str(epoch_id), "p_simulation_id": str(simulation_id)},
).execute()
```

Analog für `fortify_zone()`, `counter_intel_sweep()`, `recall()`.

#### 5.2.3 Neuer Pass-Endpoint

```python
# backend/routers/epochs.py

@router.post("/{epoch_id}/pass-cycle")
async def pass_cycle(
    epoch_id: UUID,
    body: ReadySignal,  # Reuse: enthält simulation_id
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _participant: Annotated[dict, Depends(require_epoch_participant())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse:
    """Explicitly pass this cycle without taking action. Sets has_acted = true."""
    await admin_supabase.rpc(
        "fn_set_acted_this_cycle",
        {"p_epoch_id": str(epoch_id), "p_simulation_id": str(body.simulation_id)},
    ).execute()

    await BattleLogService.log_event(
        admin_supabase, epoch_id, current_cycle,
        "player_passed", body.simulation_id, None,
        f"Simulation passed this cycle.",
        is_public=False,
    )
    return SuccessResponse(data={"passed": True})
```

#### 5.2.4 AFK-Processing

```python
# backend/services/epoch_cycle_scheduler.py

@classmethod
async def _process_afk_players(cls, admin: Client, epoch_id: str) -> None:
    """Pre-Resolve: AFK-Spieler identifizieren und Penalties anwenden."""
    participants = await (
        admin.table("epoch_participants")
        .select("id, simulation_id, has_acted_this_cycle, is_bot, "
                "consecutive_afk_cycles, current_rp, afk_replaced_by_ai")
        .eq("epoch_id", epoch_id)
        .execute()
    )
    epoch = await admin.table("game_epochs") \
        .select("current_cycle, config").eq("id", epoch_id).single().execute()
    config = {**DEFAULT_CONFIG, **(epoch.data or {}).get("config", {})}
    cycle = epoch.data.get("current_cycle", 0)
    penalty_rp = config.get("afk_rp_penalty", 2)
    escalation = config.get("afk_escalation_threshold", 3)

    for p in extract_list(participants):
        if p["is_bot"] or p["afk_replaced_by_ai"]:
            continue

        if not p["has_acted_this_cycle"] and not p.get("cycle_ready", False):
            # AFK diesen Zyklus
            new_consecutive = p["consecutive_afk_cycles"] + 1
            updates = {
                "consecutive_afk_cycles": new_consecutive,
                "total_afk_cycles": p.get("total_afk_cycles", 0) + 1,
            }

            if new_consecutive >= 2:
                # Penalty: RP-Abzug
                multiplier = min(3, new_consecutive - 1)  # 1x, 2x, 3x
                rp_loss = penalty_rp * multiplier
                updates["current_rp"] = max(0, p["current_rp"] - rp_loss)

            if new_consecutive >= escalation + 1:  # Default: 4+ Zyklen
                # AI-Übernahme
                updates["afk_replaced_by_ai"] = True
                updates["is_bot"] = True  # Bot-Pipeline übernimmt
                # Log
                await BattleLogService.log_event(
                    admin, UUID(epoch_id), cycle,
                    "player_afk_ai_takeover", UUID(p["simulation_id"]),
                    None, "AI has assumed control due to prolonged absence.",
                    is_public=True,
                )

            elif new_consecutive >= 1:
                await BattleLogService.log_event(
                    admin, UUID(epoch_id), cycle,
                    "player_afk", UUID(p["simulation_id"]),
                    None, f"Player absent for cycle {cycle}.",
                    is_public=False,
                )

            await admin.table("epoch_participants") \
                .update(updates).eq("id", p["id"]).execute()

        else:
            # Aktiv: consecutive reset (Mercy)
            if p["consecutive_afk_cycles"] > 0:
                await admin.table("epoch_participants").update({
                    "consecutive_afk_cycles": 0,
                }).eq("id", p["id"]).execute()
```

### 5.3 Frontend-Architektur

#### 5.3.1 EpochReadyPanel Erweiterungen

```
┌──────────────────────────────────────┐
│  CYCLE READINESS          2/3 Ready  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░  │
│                                      │
│  ⏱ 2h 14m remaining                 │
│  ████████████████░░░░░░░░  72%       │
│                                      │
│  ✓ @Simulation-A     READY (ACTED)  │
│  — @Simulation-B     WAITING         │
│  — @Bot-Sentinel     BOT  Auto       │
│                                      │
│  [ PASS THIS CYCLE ]  [ SIGNAL READY ]│
│  └── Ready disabled bis acted/passed │
└──────────────────────────────────────┘
```

**Neue UI-Elemente:**
1. **Countdown-Timer** (Balken + Text): berechnet aus `cycle_deadline_at`
2. **ACTED-Badge**: Neben Ready-Status, zeigt `has_acted_this_cycle`
3. **Pass-Button**: "PASS THIS CYCLE" — setzt `has_acted` ohne Aktion
4. **Ready-Gate**: Button disabled bis `has_acted = true`
5. **AFK-Warning-Toast**: Bei 30min vor Deadline (Realtime-Event)
6. **Danger-Glow**: Pulsierend wenn <10min verbleiben

**Countdown-Berechnung (Client):**
```typescript
// deadline_at kommt via Realtime oder API-Response
private _deadlineAt: number = 0;  // Unix ms

private _updateCountdown() {
  const remaining = this._deadlineAt - Date.now();
  if (remaining <= 0) {
    this._countdownText = msg('Resolving...');
    this._countdownPct = 100;
    return;
  }
  const hours = Math.floor(remaining / 3_600_000);
  const mins = Math.floor((remaining % 3_600_000) / 60_000);
  this._countdownText = msg(str`${hours}h ${mins}m remaining`);

  const total = this._deadlineAt - this._cycleStartedAt;
  this._countdownPct = Math.round(((total - remaining) / total) * 100);

  requestAnimationFrame(() => this._updateCountdown());
}
```

#### 5.3.2 Neue Realtime-Events

```typescript
// Neue Events auf epoch:{epochId}:status Channel

// 1. Cycle gestartet mit Deadline
type CycleStarted = {
  event: 'cycle_started';
  payload: {
    epoch_id: string;
    cycle_number: number;
    cycle_started_at: string;   // ISO
    cycle_deadline_at: string;  // ISO
  };
};

// 2. Spieler hat gehandelt
type PlayerActed = {
  event: 'player_acted';
  payload: {
    simulation_id: string;
    action_type: 'deploy' | 'fortify' | 'counter_intel' | 'recall' | 'alliance' | 'pass';
  };
};

// 3. Deadline-Warnung (30min vorher, vom Scheduler gebroadcastet)
type DeadlineWarning = {
  event: 'deadline_warning';
  payload: {
    epoch_id: string;
    minutes_remaining: number;
  };
};

// 4. Auto-Resolve (Deadline erreicht)
type CycleAutoResolved = {
  event: 'cycle_auto_resolved';
  payload: {
    epoch_id: string;
    cycle_number: number;
    afk_players: string[];  // simulation_ids die nicht acted haben
  };
};
```

### 5.4 Team PvP (2v2) Design

#### 5.4.1 IST-Zustand

Das System unterstützt N Humans + M Bots in einer Epoch. Teams/Allianzen werden **in-game** gebildet (Lobby: sofort beitreten; Competition: Proposal-basiert). Bots agieren komplett unabhängig — jeder Bot hat seine eigene Personality-Engine.

**Was fehlt für echtes 2v2:**
- Bot-Team-Assignment im Lobby (Bots in vorkonfiguriertes Team setzen)
- Bot Alliance Loyalty (Bots mit festem Team verlassen Allianz nicht)
- Bot Plan Visibility (Teamkollege sieht Bot-Intentionen)
- 2v2 Academy Preset (One-Click Setup)

#### 5.4.1b Research-Erkenntnisse: Bot als Teammate

Aus der Cross-Genre-Research (MIT Hanabi Study, Meta CICERO, AoE2 AI Ally Systems):

1. **Lesbarkeit über Optimalität**: Ein Bot, der leicht suboptimale aber nachvollziehbare Züge macht, wird als besserer Teamkollege wahrgenommen als einer, der optimal aber unverständlich spielt. Unser regelbasiertes System (`bot_personality.py`) ist hier im Vorteil gegenüber ML-basierten Ansätzen.

2. **Konsistenz erzeugt Vertrauen**: Regelbasierte Bots werden gegenüber Learned Bots bevorzugt, weil ihr Verhalten vorhersagbar ist. Unsere 5 Personality-Presets (Sentinel, Warlord, Diplomat, Strategist, Chaos) bieten genau das.

3. **Kommunikation ist essenziell**: Bots sollten ihre Intentionen ankündigen:
   - "Ich sende einen Saboteur nach [Simulation X] — sie führen das Leaderboard an"
   - "Ihre Zone-Security ist niedrig und wir haben eine Embassy dort"
   - **Fog-of-War beachten**: Bot darf keine Information teilen, die der Human-Teamkollege nicht hat

4. **Tentative Plan Pattern**: Bot publiziert einen Entwurfsplan Mitte des Zyklus (via Team-Chat), den der menschliche Teamkollege sehen kann. Bot passt Plan an, wenn der Human zuerst handelt. Dies gibt dem Human die Möglichkeit, komplementär zu planen.

5. **Kein Rubber-Banding in kompetitiven Epochs**: Bot-Difficulty bleibt fix pro Epoch. Stattdessen RP-Handicaps oder Draft-Vorteile für gemischte Teams.

6. **Gespiegelte Difficulty für Training**: In Academy-Modus: Bot-Teammates und Bot-Gegner separat konfigurierbar (z.B. "Hard Allies vs Easy Opponents" zum Lernen).

#### 5.4.2 Änderungen

**Schema:**
```sql
-- epoch_participants: Neues Feld
ALTER TABLE epoch_participants
  ADD COLUMN initial_team_id UUID REFERENCES epoch_teams(id);
-- Wenn gesetzt: Bot wurde beim Setup einem Team zugewiesen
-- Personality-Engine überspringt "leave_team"-Entscheidungen
```

**Backend — `add_bot()` erweitern:**
```python
# backend/services/epoch_participation_service.py

async def add_bot(
    self, supabase, epoch_id, simulation_id, bot_player_id,
    team_id: UUID | None = None,  # NEU: optionales Team-Assignment
) -> dict:
    # ... bestehende Logik ...
    insert_data = {
        # ... bestehend ...
        "initial_team_id": str(team_id) if team_id else None,
    }
    if team_id:
        insert_data["team_id"] = str(team_id)  # Sofort dem Team beitreten
    # ...
```

**Backend — Bot-Personality Alliance-Override:**
```python
# backend/services/bot_personality.py

class BaseBotPersonality:
    def should_leave_alliance(self, game_state, decisions):
        # NEU: Wenn initial_team_id gesetzt, NIEMALS freiwillig verlassen
        if game_state.participant.get("initial_team_id"):
            return False
        return self._personality_leave_logic(game_state, decisions)
```

**API-Erweiterung:**
```python
# backend/models/bot.py
class AddBotToEpoch(BaseModel):
    simulation_id: UUID
    bot_player_id: UUID
    team_id: UUID | None = None  # NEU: optionales Team-Assignment
```

#### 5.4.3 Academy 2v2 Preset

```python
# backend/services/academy_service.py

ACADEMY_2V2_CONFIG = {
    "duration_days": 3,
    "cycle_hours": 4,
    "foundation_cycles": 2,
    "reckoning_cycles": 3,
    "rp_per_cycle": 12,
    "rp_cap": 36,
    "max_team_size": 2,
    "max_agents_per_player": 6,
    "allow_betrayal": False,
    "auto_resolve_mode": "activity_gated",
    "cycle_deadline_minutes": 240,  # 4h
}

class AcademyService:
    @classmethod
    async def create_2v2_academy(cls, supabase, admin, user_id, partner_simulation_id=None):
        """2v2 Academy: 2 Humans vs 2 Bots, pre-configured teams."""
        epoch = await EpochService.create(supabase, user_id, ...)

        # Team A (Humans)
        team_a = await EpochService.create_team(admin, epoch_id, human_sim_id, "Team Alpha")
        # Team B (Bots)
        team_b = await EpochService.create_team(admin, epoch_id, bot1_sim_id, "Team Omega")

        # Bots mit team_id deployen
        await cls.add_bot(admin, epoch_id, bot1_sim, bot1_id, team_id=team_b["id"])
        await cls.add_bot(admin, epoch_id, bot2_sim, bot2_id, team_id=team_b["id"])
```

---

## 6. Edge Cases & Mitigationen

### 6.1 Race Conditions

| Edge Case | Mitigation |
|-----------|------------|
| Spieler submittet Move bei genau Deadline | `fn_check_and_resolve_deadline` CAS: nur wenn `cycle_deadline_at <= NOW()`. 2s Grace absorbiert Latenz. Move-Submit prüft Deadline ebenfalls (Double Lock) |
| Sweep + Eager Timer feuern gleichzeitig | CAS im RPC: nur 1 Caller schafft den Update. Der andere bekommt `resolved: false` |
| Server-Neustart: Eager Timer verloren | Sweep alle 30s findet verpasste Deadlines |
| Multiple Workers: doppelter Scheduler | Sweep-Query ist idempotent; CAS-RPC ist atomar. Worst case: 2 Workers prüfen, 1 resolvet |
| Ready-Revoke nach All-Acted-Check aber vor Resolve | Ready-Revoke setzt `cycle_ready = false`. Auto-Resolve prüft im selben Moment. Tiny Race Window, mitigiert durch die atomare `resolve_cycle_full` die nochmals prüft |

### 6.2 Gameplay Edge Cases

| Edge Case | Mitigation |
|-----------|------------|
| Alle Spieler "passen" sofort → Zyklus in 15s | `min_cycle_duration_minutes` (Default 15min). All-Ready kann erst nach dieser Mindestdauer resolven |
| AFK-Spieler kehrt nach AI-Übernahme zurück | `afk_replaced_by_ai` kann von Creator zurückgesetzt werden. Spieler bekommt 1-Zyklus "Diplomatic Immunity" (kein Angriff, Battle Log Announcement) |
| Nur 1 Human in der Epoch (Academy) | 1 Human = all humans ready. Sofortige Auflösung nach Ready. Deadline irrelevant |
| Creator geht AFK | Creator-Privilegien (manueller Resolve) sind optional. Deadline resolvet automatisch |
| Spieler handelt + revoked Ready + wartet auf Deadline | Erlaubt. Spieler hat has_acted = true, aber nicht ready. Bei Deadline: resolved als "aktiv aber nicht bereit". Kein AFK-Penalty (hat ja gehandelt) |

### 6.3 Timing Edge Cases

| Edge Case | Mitigation |
|-----------|------------|
| cycle_deadline_minutes < min_cycle_duration_minutes | Validation in EpochConfig: `cycle_deadline_minutes >= min_cycle_duration_minutes` |
| Phase-Transition während Zyklus (competition → reckoning) | Phase-Transition geschieht im `resolve_cycle()`. Neuer Zyklus startet mit neuem Deadline in neuer Phase |
| Epoch completes → kein nächster Zyklus | `resolve_cycle()` erkennt Completion. Kein neuer Deadline gesetzt. Scheduler ignoriert completed Epochs |

---

## 7. Konfigurationsmatrix

### Default-Presets

| Preset | Mode | Deadline | Min Duration | AFK Penalty | Action Gate |
|--------|------|----------|--------------|-------------|-------------|
| **Standard** | activity_gated | 8h (480min) | 15min | 2 RP | Ja |
| **Sprint** | activity_gated | 4h (240min) | 10min | 2 RP | Ja |
| **Casual** | deadline_or_ready | 24h (1440min) | 30min | Nein | Nein |
| **Blitz** | hard_deadline | 30min | 5min | Nein | Nein |
| **Academy** | activity_gated | 4h (240min) | 5min | Nein | Nein |

### EpochConfig Vollständig (Erweitert)

```python
class EpochConfig(BaseModel):
    # ── Bestehend ──
    duration_days: int = Field(14, ge=1, le=60)
    cycle_hours: int = Field(8, ge=2, le=24)
    rp_per_cycle: int = Field(12, ge=5, le=25)
    rp_cap: int = Field(40, ge=15, le=75)
    foundation_cycles: int = Field(4, ge=1, le=12)
    reckoning_cycles: int = Field(8, ge=2, le=16)
    max_team_size: int = Field(3, ge=2, le=8)
    max_agents_per_player: int = Field(6, ge=4, le=8)
    allow_betrayal: bool = True
    score_weights: EpochScoreWeights = Field(default_factory=EpochScoreWeights)
    referee_mode: bool = False

    # ── Neu: Auto-Resolve ──
    auto_resolve_mode: Literal[
        "manual",
        "hard_deadline",
        "deadline_or_ready",
        "activity_gated",
        "fixed_schedule",
    ] = "activity_gated"
    cycle_deadline_minutes: int = Field(480, ge=15, le=2880)
    min_cycle_duration_minutes: int = Field(15, ge=5, le=120)
    require_action_for_ready: bool = True

    # ── Neu: AFK-Handling ──
    afk_penalty_enabled: bool = True
    afk_rp_penalty: int = Field(2, ge=0, le=10)
    afk_escalation_threshold: int = Field(3, ge=2, le=10)
    afk_ai_personality: Literal[
        "sentinel", "warlord", "diplomat", "strategist", "chaos"
    ] = "sentinel"

    @model_validator(mode="after")
    def validate_deadline_vs_min(self) -> "EpochConfig":
        if self.cycle_deadline_minutes < self.min_cycle_duration_minutes:
            msg = "cycle_deadline_minutes must be >= min_cycle_duration_minutes"
            raise ValueError(msg)
        return self
```

---

## 8. Implementierungsreihenfolge

### Phase 1: Infrastruktur (Backend)
1. Migration: `cycle_started_at`, `cycle_deadline_at` auf `game_epochs`
2. Migration: `has_acted_this_cycle`, `consecutive_afk_cycles`, `afk_replaced_by_ai` auf `epoch_participants`
3. Migration: `fn_check_and_resolve_deadline`, `fn_set_acted_this_cycle` RPCs
4. `EpochConfig` erweitern (neue Felder)
5. `EpochCycleScheduler` implementieren (ResonanceScheduler-Pattern)
6. In `lifespan` registrieren

### Phase 2: Auto-Resolve Logic
7. `resolve_cycle()`: `cycle_started_at` + `cycle_deadline_at` bei jedem Resolve setzen
8. `resolve_cycle()`: `has_acted_this_cycle` resetten
9. Eager Timer nach jedem Resolve registrieren
10. `toggle_ready()`: Activity-Gate einbauen (`has_acted` prüfen)
11. `deploy()`, `fortify_zone()`, `counter_intel_sweep()`, `recall()`: `fn_set_acted_this_cycle` aufrufen

### Phase 3: Pass & AFK
12. `POST /epochs/{id}/pass-cycle` Endpoint
13. AFK-Processing in `_process_afk_players()` vor Resolve
14. AFK-Penalty-Anwendung (RP-Abzug, AI-Übernahme)
15. Battle-Log-Events für AFK-States

### Phase 4: Frontend
16. EpochReadyPanel: Countdown-Timer (Balken + Text)
17. EpochReadyPanel: ACTED-Badge + Pass-Button
18. EpochReadyPanel: Ready-Gate (disabled bis acted)
19. Realtime-Events: `cycle_started`, `player_acted`, `deadline_warning`, `cycle_auto_resolved`
20. Toast-Notifications bei Deadline-Warnung

### Phase 5: Team PvP (2v2)
21. Migration: `initial_team_id` auf `epoch_participants`
22. `add_bot()` erweitern mit optionalem `team_id`
23. Bot-Personality Alliance-Override
24. Academy 2v2 Preset

### Phase 6: Wizard & Polish
25. EpochCreationWizard: Auto-Resolve-Mode Picker
26. EpochCreationWizard: Deadline-Slider
27. Preset-Buttons (Standard/Sprint/Casual/Blitz/Academy)
28. i18n für alle neuen Strings (EN + DE)

---

## 9. Implementation Gotchas (KRITISCH)

> Diese Sektion enthält verifizierte Codebase-Details die bei der Implementierung beachtet werden MÜSSEN.

### 9.1 Bestehende Patterns die exakt befolgt werden müssen

| Pattern | Datei | Detail |
|---------|-------|--------|
| **Scheduler-Registration** | `backend/app.py:116-128` | 6 Tasks in `lifespan`. EpochCycleScheduler wird als 7. registriert. Reihenfolge: `start()` im yield-Block, `cancel()` im Teardown |
| **Scheduler-Architektur** | `backend/services/resonance_scheduler.py` | Exakt dieses Pattern kopieren: `_run_loop()` infinite, `_load_config()` aus platform_settings, `_check_and_process()` Hauptlogik |
| **Atomare Cycle-Advance** | `supabase/migrations/..._167_atomic_cycle_advance.sql` | `fn_advance_epoch_cycle` existiert bereits mit CAS (`SELECT FOR UPDATE` + `current_cycle = p_expected_cycle`). **NICHT duplizieren** — der neue `fn_check_and_resolve_deadline` muss komplementär sein (Deadline-Prüfung), NICHT den Cycle-Advance ersetzen |
| **BattleLogService.log_event()** | `backend/services/battle_log_service.py:21-62` | Signatur: `(supabase, epoch_id, cycle_number, event_type, narrative, *, source_simulation_id=None, ...)`. Beachte: `narrative` ist ein Pflichtparameter, kein kwarg |
| **EpochConfig als JSONB** | `game_epochs.config` | Stored as JSONB. Neue Felder MÜSSEN Defaults in `EpochConfig` haben, da bestehende Epochs keinen der neuen Keys im JSONB haben. `DEFAULT_CONFIG = EpochConfig().model_dump()` in `cycle_resolution_service.py:23` merged automatisch |

### 9.2 Feldkonflikte & Kompatibilität

| Gotcha | Detail |
|--------|--------|
| **`cycle_hours` bleibt für Mission-Timer** | `cycle_hours` wird in `resolve_cycle()` Zeile 336 für Mission-Timer-Arithmetik benutzt (`timedelta(hours=cycle_hours)`). Das neue `cycle_deadline_minutes` ist SEPARAT — es ist die Wall-Clock-Deadline, NICHT die Mission-Timer-Basis. Beide Werte können divergieren (z.B. 8h cycle_hours für Missionen, 480min = 8h Deadline) |
| **`cycle_ready` Reset** | Bereits in `resolve_cycle()` Zeile 331: `update({"cycle_ready": False})`. Erweitern zu `{"cycle_ready": False, "has_acted_this_cycle": False}` — NICHT als separaten Call |
| **`is_bot` für AI-Übernahme** | AFK-Übernahme setzt `is_bot = True` damit die Bot-Pipeline in `resolve_cycle_full()` den Spieler inkludiert. **Aber**: `_getHumans()` im Frontend filtert auf `!is_bot`. Braucht evtl. `afk_replaced_by_ai` als separates Flag für UI-Anzeige ("`@Player (AI-controlled)`") |
| **`toggle_ready()` Auto-Resolve** | Die bestehende Auto-Resolve-Logik in `epoch_chat_service.py:157-188` bleibt intakt. Activity-Gate wird VOR der all_humans_ready-Prüfung eingefügt. Die Deadline-basierte Auflösung ist ein SEPARATER Codepfad (Scheduler), nicht eine Erweiterung von toggle_ready |

### 9.3 Migration-Nummer

Nächste freie Migration: **204** (letzte ist `203_dungeon_playtest_fixes.sql`). Filename-Pattern: `20260413200000_204_epoch_auto_resolve.sql`

### 9.4 Erster Zyklus: start_epoch() Hookpoint

`EpochLifecycleService.start_epoch()` (Zeile 109-125) setzt `starts_at`, `current_cycle: 1` und granted RP. **Hier muss der allererste `cycle_started_at` + `cycle_deadline_at` gesetzt werden**, sonst hat der erste Zyklus keine Deadline. Erweitere das UPDATE in Zeile 109-125:

```python
# In start_epoch() nach "status": "foundation":
"cycle_started_at": now.isoformat(),
"cycle_deadline_at": (now + timedelta(minutes=config.get("cycle_deadline_minutes", 480))).isoformat(),
```

Und danach den Eager Timer registrieren (wenn auto_resolve_mode != "manual").

### 9.5 Alle fn_set_acted_this_cycle Hookpoints (7 Stellen)

| # | Service | Methode | Zeile | epoch_id Quelle |
|---|---------|---------|-------|-----------------|
| 1 | `operative_mission_service.py` | `deploy()` | 38 | Parameter |
| 2 | `operative_mission_service.py` | `recall()` | 964 | Parameter (via mission lookup) |
| 3 | `operative_mission_service.py` | `counter_intel_sweep()` | 1009 | Parameter |
| 4 | `operative_mission_service.py` | `fortify_zone()` | 1061 | Parameter |
| 5 | `alliance_service.py` | `vote_on_proposal()` | 213 | Muss aus proposal geladen werden |
| 6 | `alliance_service.py` | `create_proposal()` | — | Muss aus proposal geladen werden |
| 7 | **Neuer Pass-Endpoint** | `pass_cycle()` | — | Router-Parameter |

**Achtung bei AllianceService**: `vote_on_proposal()` und `create_proposal()` haben keinen direkten `epoch_id` Parameter — der muss aus dem Proposal-Datensatz geladen werden. Alternative: fn_set_acted_this_cycle im Router aufrufen (dort ist epoch_id verfügbar), nicht im Service.

**Architekturentscheidung**: `fn_set_acted_this_cycle` im **Router** aufrufen (nach erfolgreichem Service-Call), nicht im Service selbst. Begründung: (a) Router hat immer `epoch_id` + `simulation_id` als Parameter, (b) Service-Layer bleibt unverändert, (c) Bot-Aktionen (die über Services laufen) sollen NICHT has_acted setzen — Bots werden erst im resolve_cycle_full() ausgeführt.

### 9.6 Reihenfolge-Abhängigkeiten

```
Migration 204 (Schema)
  └─→ EpochConfig erweitern (Python-only, kein DB-Change)
      └─→ EpochCycleScheduler (neuer Service)
          └─→ start_epoch() anpassen (erster cycle_started_at/deadline_at)
              └─→ resolve_cycle() anpassen (nächster cycle_started_at/deadline_at)
                  └─→ toggle_ready() Activity-Gate
                      └─→ fn_set_acted_this_cycle in 6 Routern
                          └─→ Pass-Endpoint
                              └─→ AFK-Processing
                                  └─→ Frontend (Countdown, Pass-Button, etc.)
```

### 9.5 Testing-Gotchas

| Gotcha | Detail |
|--------|--------|
| **391 bestehende Tests** | `backend/tests/` hat 350 Backend + 41 Frontend Tests. Neue has_acted-Felder dürfen bestehende Tests NICHT brechen (DB-Defaults `FALSE` / `0` sorgen dafür) |
| **Bot-Tests** | Bot-Cycle-Tests in `test_bot_service.py` testen `execute_bot_cycle()`. Bots setzen NICHT `has_acted_this_cycle` — sie werden im `resolve_cycle_full()` NACH dem AFK-Check ausgeführt |
| **Ready-Tests** | `test_epoch_chat_service.py` testet `toggle_ready()`. Activity-Gate muss hinter einem Config-Check stehen (`require_action_for_ready`), damit bestehende Tests mit Default-Config weiter bestehen (Default ist `True`, aber Tests setzen has_acted nicht) |

---

## Appendix A: Research Sources

### Game Design References
- Diplomacy (webDiplomacy, Backstabbr, PlayDiplomacy) — NMR-System, 24h-Deadlines, Ready-Mechanik
- Dominions 5/6 — Gold Standard für Timer + All-Ready + Host-Override Hybrid
- Neptune's Pride 1/2 — Tick-basiertes System, RT vs TB Modi
- Subterfuge — Order-Queue-Innovation, kontinuierliche Echtzeit
- Battle of Polytopia — Per-Turn-Deadline, sofortige Elimination
- Civilization VI — Play by Cloud (fehlender Timer als Anti-Pattern)
- Chess.com — Daily Chess, Vacation Days, Conditional Moves
- Frozen Synapse — Simultane Turns, unbegrenzte Planungszeit, async/sync Hybrid
- Dota 2 — Abandon-System, Behavior Score, Low Priority Queue
- League of Legends — AFK-Detection, LP-Mitigation, Escalating Penalties

### Technical Pattern References
- PostgreSQL Advisory Locks — Distributed Locking für Game State
- CAS (Compare-and-Swap) Pattern — Atomare Turn Resolution
- Lichess Clock System — Server-Authoritative, Lag Compensation
- Supabase Realtime — WebSocket Countdown Sync via absolute Deadlines
- asyncio Background Tasks — Eager Timer + Polling Sweep Hybrid

### Design Pattern Taxonomy
- Gamedeveloper.com — "Analysis: Asynchronicity In Game Design" (Simultaneous Execution, World Persistence, Parallel Competition)
- Game Programming Patterns — Command Pattern, Event Queue (Order Queue Basis)
