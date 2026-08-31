---
title: "Bilanz gegen TODO-OPUS.md"
date: "2026-08-31"
type: abnahme
lang: de
---

# Was aus den dreissig Punkten geworden ist

Die Arbeitsliste des Pakets hat **30 Kästchen** über fünf Phasen. Diese Datei
sagt für jede Phase, was steht, was nicht, und — der wichtigere Teil — **welche
Punkte sich beim Bauen als unbaubar herausgestellt haben und warum.** Ohne den
dritten Teil liest die nächste Sitzung die Liste und baut die Sackgassen nach.

Stand: Prod `d85dee7d` (Lauf 3), vier Sitzungen, ein Tag.

---

## Was steht

**Phase 0 — Querschnitt.** Vollständig. Nav-Register mit neun Kern-Reitern und
„Mehr (n)" samt Aktiv-Pin, keine Icons auf dem Desktop, Rollen statt Clipping,
neuer Reiter „Übersicht" als Vorgabeziel, Aktiv-Muster projektweit über
`markerSelectionStyles`.

**Phase 1 — Simulation View v4.** Vollständig. Masthead, Übersicht, Lore-Dossier,
Agenten-Reiter (bei mir), Gebäude-Reiter (bei `-af`). Container-Regel bewiesen.

**Phase 2 — Chat.** Bis auf den Fensterkopf, der auf drei Feldern von
`AgentBrief` wartet (bei `-88` angefragt).

**Phase 3 — Broadsheet.** Vollständig.

**Phase 4 — Dungeon.** Vollständig, einschliesslich der Zielkette aus §4.6.

---

## ⚠ Vier Punkte, die der Entwurf verlangt und die Daten nicht hergeben

Alle vier sind **auf Prod gemessen**, nicht vermutet. Wer sie nachbaut, baut eine
Tür, die sich nur für die öffnet, die schon drin sind.

**1. Die Belegungsskala hat keinen Zähler.** (Phase 1, Gebäude/Footprint)

    building_agent_relations WHERE relation_type='lives_at'      0 Zeilen
    Bauten mit population_capacity > 0                         219
    Bauten mit einem building_condition                        324 von 324

`agents?.length ?? 0` ist keine gezählte Null, sondern das Fehlen einer Zählung,
das eine Null trägt — durchgereicht malt es 219 Bauten „fast leer" auf. Statt
dessen trägt der Streifen `building_condition`. **Das Merkmal ist nicht kaputt,
es hat nur noch keine Welt, in der es etwas zu messen gäbe.**

**2. Zwei der vier Agenten-Filterchips filtern nichts.** (Phase 1, Agenten)
Der Entwurf verlangt *Alle · Keystone · Botschafter · KI-geboren*.

    „Keystone"      kommt im ganzen Repo NICHT vor, weder Frontend noch Backend
    „KI-geboren"    254 von 258 Agenten haben data_source = NULL
    „Botschafter"   echt (14), aber `is_ambassador` ist KEINE Spalte

Nicht gebaut. Der Botschafter-Filter wäre möglich, verlangte aber die
Identitätsauflösung an einer dritten Stelle — deshalb erst Migration 326, die sie
auf EINE reduziert. Danach ist er billig.

**3. „Zählt" im Chat-Fensterkopf.** (Phase 2)
Der Prototyp leitet die vier Zustände nicht ab; sie sind je Figur von Hand
geschrieben. „Zählt" war der Witz einer Zensus-Drohne und hat kein strukturelles
Gegenstück. Die anderen drei sind aus `current_building_id` (206), nur
`current_zone_id` (52) und `is_ambassador` (14) ableitbar.

**4. Die Schwärzung im Lore-Dossier ist unerreichbar.** (Phase 1, Lore)
Bewusst gebaut und dokumentiert: die API ist public-first, ein klassifizierter
Abschnitt kommt an und ist lesbar, oder er wurde nie erzeugt. Die Balken bleiben,
weil das Versprechen lautet, dass Blättern nie 403 erzeugt — an dem Tag, an dem
ein Abschnitt zurückgehalten wird, muss er GESCHWÄRZT ankommen statt zu fehlen.

---

## Wo der Entwurf und das Projektregelwerk sich widersprachen

Fünf Berührungspunkte, zwei echte Konflikte — ausgeführt in
`DESIGN-AUTORITAET.md`. Der Kurzschluss:

    Schrift          HANDOFF gewinnt   Chrome brutalistisch, Inhalt Spectral
    Ornamente        einig             Schmuck bleibt, Bezeichnendes wird Icon
    Ken-Burns        einig             Effekt auf die Blatt-Ebene, nie den Container
    Dim-Farben       SKILL gewinnt     der Handoff ordnet sich per eigener DoD unter
    Breitbild/4K     SKILL war falsch  vier Regeln nach View-Typ, nicht eine

---

## Was der Entwurf nicht sagen konnte

**Die Prototypen sind gegen ein dunkles Theme gezeichnet.** Vier der zehn
Simulations-Themes sind hell, und dort fällt die Farbgebung des Entwurfs durch:
reines Amber auf heller Welt-Fläche steht bei **1,85 : 1**, `--color-primary` in
**8 von 15** echten Theme-Tripeln unter 4,5.

Gelöst mit einer Regel und einem Anteil: **eine Farbe, die gelesen werden soll,
wird zu `--color-text-primary` gemischt** — dem kontraststarken Ende JEDES Themes
— und 45 % trägt alle drei Paarungen (Tönung 5,26 · Fläche 5,12 · Akzent 5,67).
Dazu zwei feste Tinten für Flächen, die nicht themebar sind.

**Die Tagline ist keine.** Der Entwurf begrenzt sie auf 620 px, was die BREITE
begrenzt; gefüllt wird sie aus `simulations.description`, gemessen 922 Zeichen
über 13 Zeilen — Masthead 684 px, 75 % des Fensters, auf jedem Reiter. Auf drei
Zeilen geklammert.

---

## Die Abnahme, gemessen statt angenommen

    Ring (zyklisches Blättern)   6 Fälle am Bildschirm, inkl. Knopf und Suchfeld
    Container-Regel              Beweis durch Substitution, breiteninvariant
    DE und EN ohne Clipping      6 Breiten von 1440 bis 660, null geschnitten
    Kontrast in meinem Gebiet    0 Paare unter AA nach hartem Neuladen
    Prod                         acht Abfragen, ein Stand

⚠ **Was die Sichtprüfung fand und kein Tor gefunden hatte:** ein Reiter, der
„coming soon" anzeigte (Route, Import und Registereintrag da, der `case` fehlte);
ein Lesemass von 498 statt 740, weil zwei Kästen darüber es nie zuliessen; eine
Anker-Karte, die ein Feld las, das es nie gab; die `href`-Hälfte eines Fixes,
dessen Klick-Hälfte schon stimmte.

**Keiner dieser Fehler war ein Absturz.** Alle sahen aus wie ein Ergebnis. Die
Sammlung dazu steht in `docs/analysis/plausible-output-2026-08-31.md`.
