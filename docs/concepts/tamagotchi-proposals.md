---
title: "10 Proposals zur Tamagotchisierung der Simulationen"
version: "1.0"
date: "2026-03-25"
type: concept
status: active
lang: de
---

# 10 Proposals zur Tamagotchisierung der Simulationen

> Ziel: Der User soll sehen, wie sich seine Simulation und seine Agenten/Gebaeude entwickeln. Jede Simulation soll sich wie ein lebendiger Organismus anfuehlen, der Aufmerksamkeit braucht und belohnt.

## Status-Quo-Problem

Das Heartbeat-System pumpt (Agenten-Mood, Beduerfnisse, Beziehungen, Zone-Stabilitaet), aber der Spieler fuehlt den Puls nicht. Die Mechanik ist tief, die Sichtbarkeit flach. Alles Wichtige passiert unsichtbar im Backend.

---

## Proposal 1: Verfall durch Vernachlaessigung ("Neglect Decay")

**Problem:** Nichts passiert, wenn der User nicht reinschaut. Kein Druck, kein Verlust.

**Vorschlag:** Gebaeude-Condition zerfaellt langsam pro Heartbeat-Tick wenn kein Member aktiv ist (kein Login in 48h). `good → moderate → poor → ruined` ueber 2-3 Wochen. User sieht im Briefing: "Das Voss-Industriewerk verfaellt — Condition: poor." Ein Login + eine beliebige Interaktion (Chat, Edit, Forge) stoppt den Verfall fuer 48h.

**Warum Tamagotchi:** Das Grundprinzip — dein Haustier stirbt, wenn du es nicht fuetterst.

**Aufwand:** Klein | **Impact:** Hoch | **Prioritaet:** Sofort

---

## Proposal 2: Agent-Timeline ("Lebensgeschichte")

**Problem:** Agenten entwickeln sich emotional (Mood, Stress, Beziehungen), aber der User sieht nur Momentaufnahmen, keine Geschichte.

**Vorschlag:** Eine chronologische Timeline pro Agent, die alle Heartbeat-Aktivitaeten, sozialen Interaktionen, Stimmungswechsel und Beziehungsveraenderungen als scrollbare Eintraege zeigt. Jeder Eintrag hat Datum, Narrativ (bilingual), und Signifikanz-Indikator. Altes wird zusammengefasst ("In den letzten 7 Tagen hat Doktor Fenn 3x in den Archiven gearbeitet, eine tiefe Konversation mit Elena Voss gefuehrt, und einen Stresszusammenbruch erlitten").

**Warum Tamagotchi:** Du beobachtest, wie dein Haustier waechst und sich veraendert. Die Geschichte IST das Engagement.

**Aufwand:** Mittel | **Impact:** Hoch | **Prioritaet:** Naechste Phase

---

## Proposal 3: Zonen-Wetter / Ambient Events ("Lebendige Welt")

**Problem:** Zonen sind statisch. Keine Atmosphaere, keine Veraenderung, kein Grund, verschiedene Zonen zu besuchen.

**Vorschlag:** Pro Heartbeat-Tick holt ein Service echte Wetterdaten (Open-Meteo API, kostenlos) fuer den geographischen Anker der Simulation (Velgarien → Berlin, Station Null → Tromsoe). Ein kompositorisches Template-System (4 Schichten: Atmosphaere, Kernbeschreibung, Konsequenz, Agenten-Reaktion) generiert ~18.750 einzigartige bilinguale Beschreibungen pro Theme ohne LLM-Calls. Beeinflusst Agent-Mood via `zone_ambient` Moodlets.

**Warum Tamagotchi:** Die Welt fuehlt sich lebendig an, auch wenn du nicht interagierst.

**Aufwand:** Mittel | **Impact:** Hoch | **Status:** IN IMPLEMENTATION

---

## Proposal 4: Agent-Wuensche / Petitions ("Forderungen")

**Problem:** Agenten handeln autonom, aber kommunizieren nie direkt mit dem User. Keine Handlungsaufforderung.

**Vorschlag:** Wenn ein Agent ein Beduerfnis unter 20 hat oder Stress ueber 600, generiert er eine "Petition" an den Simulationsbesitzer (Template-basiert): "Doktor Fenn bittet um Versetzung in ein ruhigeres Gebaeude", "Elena Voss fordert Verstaerkung im Industriegebiet". Der User kann genehmigen (sofortige Beduerfniserfuellung + Opinion-Boost) oder ablehnen (Opinion-Malus). Unbehandelte Petitionen eskalieren nach 3 Ticks.

**Warum Tamagotchi:** Dein Haustier weint und du musst reagieren.

**Aufwand:** Klein | **Impact:** Hoch | **Prioritaet:** Sofort

---

## Proposal 5: Wochenreport mit Vergleich ("Simulation Pulse")

**Problem:** Das Daily Briefing zeigt den aktuellen Tag, aber keine Trends. Keine Antwort auf "wird es besser oder schlechter?"

**Vorschlag:** Woechentlicher zusammenfassender Report (automatisch generiert), der diese Woche vs. letzte Woche vergleicht: Gesundheit (+3%), Stress-Durchschnitt (-12%), Beziehungen gebildet (2 neue), Gebaeude-Zustand (1x verschlechtert). Visualisiert als Sparklines oder simple Up/Down-Pfeile. Optional als E-Mail-Digest.

**Warum Tamagotchi:** Du siehst den Trend — "meinem Haustier geht es besser seit ich X gemacht habe."

**Aufwand:** Mittel | **Impact:** Mittel | **Prioritaet:** Naechste Phase

---

## Proposal 6: Gebaeude-Upgrade-Pfade ("Progression")

**Problem:** Kein Progressionssystem. Gebaeude existieren, aber entwickeln sich nie.

**Vorschlag:** Jedes Gebaeude hat einen Upgrade-Level (1-5). Level steigt, wenn das Gebaeude N Heartbeat-Ticks in "good" Condition uebersteht UND von qualifizierten Agenten besetzt ist. Hoehere Level geben bessere Zone-Stabilitaets-Boni und visuelle Veraenderungen (Icon/Rahmen-Upgrade). Downgrade bei "poor" Condition. Erstes Feature mit echtem Fortschritt.

**Warum Tamagotchi:** Evolution sichtbar machen. "Mein Gebaeude ist jetzt Level 3!"

**Aufwand:** Gross | **Impact:** Mittel | **Prioritaet:** Spaeter

---

## Proposal 7: Beziehungsgraph-Visualisierung ("Soziogramm")

**Problem:** Beziehungen existieren als Karten, aber der User sieht kein Gesamtbild des sozialen Netzwerks.

**Vorschlag:** Force-directed Graph (wie der Cartographer's Map, aber fuer Agenten innerhalb einer Simulation). Knoten = Agenten (Portrait + Mood-Farbring). Kanten = Beziehungen (Farbe nach Typ: gruen=positiv, rot=negativ, gestrichelt=neutral). Kantenstaerke = Intensitaet. Animation: neue Beziehungen blinken, zerbrochene Beziehungen loesen sich auf. Zonenbasiertes Clustering.

**Warum Tamagotchi:** Du beobachtest, wie sich Freundschaften und Feindschaften in Echtzeit bilden.

**Aufwand:** Mittel | **Impact:** Mittel | **Prioritaet:** Spaeter

---

## Proposal 8: Agent-Meilensteine / Achievements ("Erste Male")

**Problem:** Kein Achievement-System. Nichts wird gefeiert.

**Vorschlag:** Automatische Meilenstein-Erkennung pro Agent: "Erste tiefe Konversation", "Erster Stresszusammenbruch", "100 Tage ueberstanden", "3 Feindschaften gleichzeitig", "Hoechste Stimmung aller Zeiten". Visuell als Badge-Collection auf der Agent-Detailseite. Plattformweite Meilensteine: "5 Simulationen erstellt", "Erster Epoch-Sieg", "10.000 Wort Lore generiert".

**Warum Tamagotchi:** Sammelaspekt + Stolz. "Mein Agent hat 7 von 12 Badges."

**Aufwand:** Mittel | **Impact:** Mittel | **Prioritaet:** Spaeter

---

## Proposal 9: Stimmungs-Heatmap ("Emotionale Landkarte")

**Problem:** Zone-Stabilitaet ist eine Zahl. Kein Gefuehl fuer die emotionale Temperatur der Simulation.

**Vorschlag:** Visuelle Heatmap der Simulation: Zonen eingefaerbt nach durchschnittlicher Agent-Stimmung (gruen = zufrieden, gelb = angespannt, rot = kritisch). Klick auf Zone zeigt Agenten mit Mood-Balken. Historischer Slider: "Wie war die Stimmung vor 7 Tagen?" Zeigt Trends und macht unsichtbare Emotionsdaten greifbar.

**Warum Tamagotchi:** Du siehst sofort, wo es deiner Welt schlecht geht — wie ein Fieberthermometer.

**Aufwand:** Mittel | **Impact:** Hoch | **Prioritaet:** Naechste Phase

---

## Proposal 10: Zeremonien / Rituale ("Aktive Einflussnahme")

**Problem:** Der User kann Agenten nur passiv beobachten. Keine aktive Einflussnahme auf die Weltstimmung.

**Vorschlag:** Der User kann pro Woche ein Ritual in einer Zone ausloesen (Template-basiert, 1 LLM-Call): "Fest im Regierungsviertel" (+15 Mood fuer alle Agenten in der Zone, +10 Social-Need), "Trauerfeier in der Altstadt" (-5 Mood aber +20 Purpose), "Militaerparade" (+10 Safety). Kostet nichts, aber hat Cooldown (7 Tage). Erzeugt ein Event mit Narrativ und Agent-Reaktionen. Der einzige Moment, wo der User direkt in die Welt eingreift.

**Warum Tamagotchi:** Du streichelst dein Haustier. Die einzige direkte Zuneigung.

**Aufwand:** Klein | **Impact:** Hoch | **Prioritaet:** Sofort

---

## Priorisierung

| Prioritaet | Proposals | Begruendung |
|---|---|---|
| **Sofort** | #4 Petitions, #10 Zeremonien, #1 Neglect Decay | Maximale Emotionsbindung, minimaler Aufwand |
| **In Arbeit** | #3 Ambient Events | Bereits in Implementierung |
| **Naechste Phase** | #2 Timeline, #5 Wochenreport, #9 Heatmap | Daten existieren, hauptsaechlich Frontend |
| **Spaeter** | #7 Soziogramm, #6 Upgrades, #8 Achievements | Brauchen neue Mechaniken/Migrationen |
