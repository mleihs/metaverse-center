# DRIFT — Gameplay-Redesign: Der Fun-Kern

**Konzeptdokument v0.1 — 2026-07-12**
Status: KONZEPT (zur Diskussion). Grundlage: Code-Analyse des Live-Stands (Migrationen 239–256, `drift_service.py`, `DriftView.ts`), Browser-Inspektion auf metaverse.center (2026-07-12), Web-Research zu verwandten Systemen (Sunless Sea/Skies, Fallen London, 80 Days, FTL, Curious Expedition, Slay the Spire, Push-your-luck-Theorie, Roguelite-Meta-Progression — Quellen in §3).
Bezug: `docs/concepts/drift-zwischenraum-travel-game-concept.md` (v0.4) und `docs/plans/drift-implementation-plan.md` (v1.1) bleiben gültig als Langfrist-Vision. Dieses Dokument beantwortet eine engere Frage: **Warum macht der ausgelieferte P0 keinen Spaß, und was ist der kürzeste Weg zu einem Spiel, das welchen macht?**

---

## 1. Befund in einem Absatz

Der P0 ist ein technisch vorbildlicher vertikaler Slice (atomare CAS-RPCs, Hospitality-Gate, Audit, Pack-Pipeline) — aber als Spiel ist er ein **2-Minuten-Loop mit einer faktisch erzwungenen Route, Aufträgen ohne Belohnung, unsichtbarer Wirkung und ohne jede Progression**. Die drei Dinge, die ein Reisespiel tragen (eine echte Entscheidung pro Zug, eine Belohnungsschleife, sichtbare Spuren in der Welt), wurden alle in spätere Phasen verschoben. Das Ergebnis ist live, bevor sein Spiel da ist. Die gute Nachricht: Die Engine ist da, die Konzept-Vision ist tragfähig, und der Fun-Kern ist mit gezielten Eingriffen erreichbar — überwiegend Content, Tuning und drei neue Spieler-Verben, kaum neue Infrastruktur.

---

## 2. Diagnose des Ist-Zustands

Was der Code heute tut (verifiziert, Referenzen auf die Migrations-/Service-Dateien):

Der komplette Aktionsraum des Spielers besteht aus sechs Verben: Aufbruch (`fn_travel_run_open`), Zug (`fn_travel_move`), Depesche annehmen (`fn_quest_accept`), Depesche abliefern (`fn_quest_advance`), Entladung (`fn_travel_complete`), Rückzug (`fn_travel_abandon`). Es gibt keinen Frequenzwechsel, keine Sondierung, keine Begegnungen, keine Items, keine Storylets.

### D1 — Das Ein-Routen-Problem (keine Entscheidungen)

Der Seed-Graph hat 6 Knoten. Mit `window_base = 6` Takten (Migration 246:75; prod aktuell auf 8 getunt) existiert praktisch **eine** haul-optimale Route (der Hamilton-Pfad über alle 6 Knoten — der Tuning-Kommentar nennt das selbst „knife-edge"); der reine Korridor-Rundtrip ist mit 8 Zügen > Fenster unmöglich. Ein Spieler, der das Spiel einmal verstanden hat, trifft ab dem zweiten Run **keine Routenentscheidung mehr**. Slay the Spire zeigt, warum das tödlich ist: Die Map-Generierung erzwingt dort per Regel, dass es nie einen „Safe Highway" gibt und dass Pfade Rekonvergenzpunkte zum Umplanen haben — die Pfadwahl ist das Meta-Spiel. Bei uns ist sie eine Fleißaufgabe.

### D2 — Das Belohnungsvakuum (die Ökonomie ist tot)

Der schwerste Einzelbefund: **Depeschen-Ablieferung zahlt nichts.** `fn_quest_advance` (249:420) vergibt weder Siegel noch VP noch Ressourcen — der einzige Ertrag ist ein privates Journal-Fragment plus (meist gefilterte, siehe D4) Welteffekte. Und systemisch: Kein einziger Codepfad schreibt jemals `vp`, `siegel`, `clearance_rank`, `bandwidth_class`, `affinities`, `unlocked_vectors` oder `zerfaserung_count` (Schema 239:80ff, Grep über alle Migrationen und Services). Das komplette in Plan §2.7–2.9 spezifizierte Ökonomie-Gerüst (Ränge, Preisbuch, Klassen-Upgrades) existiert als Schema-Attrappe. Der Spieler ist nach 50 Runs mechanisch exakt so stark wie nach dem ersten; die einzige wachsende Zahl (`vermessung_lodged`) wird nirgends angezeigt.

### D3 — Leere Züge (Bewegen ist Buchhaltung)

Ein Zug ist: BB-Abzug, −1 Takt, +DZ, Kollaps-Check. Die **gesamte Zufallsvarianz des Spiels** ist ein einziger 40 %-Surge an einer einzigen Kante (`deep_surge`, 246:89). Keine Events unterwegs, keine Funde, keine Begegnungen, keine Information. FTLs stärkste Regel ist die Umkehrung: *Jeder Sprung kostet Fuel und garantiert ein Ereignis* — selbst „leer" ist dort eine Information. Bei uns trainieren die Züge den Spieler darauf, Klicks als Verwaltung zu lesen. Das Sunless-Sea-Postmortem benennt exakt dieses Muster als Tedium-Kern: nicht Langsamkeit, sondern **null Dichte zwischen den Zielen**, verschärft auf Wiederholungsrouten.

### D4 — Unsichtbare Wirkung (die Kern-Fantasie wird nicht eingelöst)

Pillar 4 des Konzepts („Every deed leaves a trace") ist der Plattform-USP — und genau er fällt aus: Alle Welten stehen per Seed-Default auf `nur_echos` (239:304). Damit werden bei jeder Ablieferung `inject_agent_memory` und `spawn_event` **still geblockt** (255:152, 255:176); durch kommt ein Echo-Event mit impact 1 plus das private Fragment. Das HUD toastet nur „N Wirkungen ausgelöst" und verschweigt die Filterung (`DriftView.ts:477`). Der Spieler liefert ab, und die Welt zuckt nicht einmal. Dazu: Der Ziel-Agent ist immer der **älteste aktive Agent** der Welt (249:361) — kein Bezug zu Bindungen, Gebäuden oder dem, was in der Welt gerade passiert.

### D5 — Scheitern ohne Inhalt

Kollaps (KH ≤ 0 oder Fenster abgelaufen) heißt: Snap nach Hause, Haul = 0, Fracht zerfasert als Echos (255:462). Kein Wrack, kein Scar, kein Havarie-Moment, nicht einmal ein Zähler-Inkrement. Failbetters meistzitierte Empirie — *„people really loved it when terrible things happened to them"* — und Ingolds „failing-but-not-failed"-Formel laufen beide leer: Unser Scheitern ist ein nackter Zahlenverlust, der genau die Sorte Reset-Frust erzeugt, die Sunless Skies mit dem Legacy-System eigens abgeschafft hat.

### D6 — Tote Systeme als UI-Attrappe

Das 7-Frequenzen-System — die signature original idea des Konzepts — ist **inert**: Es gibt keine Umstimmungs-Aktion, alle Seed-Kanten sind memory-permeabel, der Off-Vector-Multiplikator ist toter Code, Cargo-Vektoren sind Dekoration. Für den Spieler ist unsichtbar, dass es das System überhaupt gibt; für uns ist es getragene Komplexität ohne Gegenwert.

### D7 — Push-your-luck ohne Push und ohne Luck

Der Vermessungs-Loop ist als Push-your-luck gemeint (Haul wächst, Recall verliert alles). Aber: (a) Es gibt **keinen Bank-Punkt** — alles oder nichts entscheidet sich erst bei der Entladung; (b) die Odds sind statisch statt eskalierend (das dokumentierte „Pig-Problem": jede Entscheidung ist dieselbe Entscheidung); (c) auf der Zwangsroute bindet das Fenster härter als KH — die drei Ressourcen sind teils redundant statt gegeneinander gespannt. Das Bank-or-bust-Ideal (beide Optionen fühlen sich richtig an) wird nie erreicht, weil es den Entscheidungsmoment schlicht nicht gibt.

### D8 — Session ohne Bogen

Ein Run ist 6–8 Klicks in 1–3 Minuten, ohne Eskalation, ohne Zahltag-Moment, ohne Anschluss-Entscheidung. Es gibt keinen Grund für „one more run" — und nichts, das zwischen zwei Sessions reift.

**Wurzelursache:** P0 hat bewusst die *Plattform* geliefert (Engine, Schema, Gates) und den *Spielinhalt* auf P1/P2 verschoben. Das war als Architektur-Sequenz richtig — aber live geschaltet wurde damit ein Spiel, dessen Kern-Loops (Entscheidung, Belohnung, Wirkung, Scheitern) sämtlich Platzhalter sind. Dieses Dokument definiert den **Fun-Kern** als eigene Phase (P0.5) vor dem weiteren P1-Ausbau.

---

## 3. Research-Lehren (kondensiert)

Vollständige Briefings mit allen Quellen liegen der Analyse bei; hier die zwölf Prinzipien, auf die sich das Redesign stützt. Primärquellen: Kennedy-Postmortem Sunless Sea, Failbetter „Sea vs. Skies", Gardiner zu Facets, Emily Short zu Storylets, Ingold „The Problem of Failure" + GDC-Postmortem 80 Days, Jayanth-Interviews, FTL-GDC-Postmortem, Giovannetti zu Slay the Spire, GMTK zu Input/Output-Randomness und Balatro, Rogue-Legacy-GDC-Postmortem, Supergiant zu Hades, Red Hook zu Darkest Dungeon, Beachum zu Outer Wilds.

| # | Prinzip | Quelle/Beleg |
|---|---|---|
| R1 | **Kein leerer Zug.** Jede Bewegung garantiert ein Ereignis oder eine Information; „nichts passiert" existiert nicht. | FTL (Event pro Beacon); Skies „discoveries & spectacles" füllten exakt diese Lücke |
| R2 | **Pfadwahl braucht offene Information mit Restunsicherheit** — Knotentypen sichtbar, Inhalte teils verdeckt; nie Blindwahl, nie volle Lösbarkeit. | Slay the Spire (Kartensicht + „?"-Knoten); FTL (Sensoren als kaufbare Information) |
| R3 | **Kein Safe Highway; Risiko zahlt messbar.** Generierungsregeln müssen sichere Pfade verteuern; Gewinner-Runs in StS haben nachweislich höhere Pfad-Entropie (p<0.001). | StS-Map-Regeln + arXiv 2504.03918 |
| R4 | **Eskalierende, lesbare Odds statt statischer.** Gefahr sichtbar stapeln (offen ausliegende Marker), Wahrscheinlichkeit verschiebt sich mit jedem Schritt; nie beziffern, immer abzählbar machen. | Incan Gold, Can't Stop vs. „Pig-Problem" |
| R5 | **Bank-Punkte anbieten; Bust frisst nur Ungesichertes.** Der Korridor, in dem Aussteigen UND Weitermachen sich beide richtig anfühlen, ist das Design-Ziel. | Push-your-luck-Theorie; Quacks (Teilverlust mit Wahl) |
| R6 | **Tempoverlust ist die eleganteste Bust-Form.** Überladung, die die Heimreise verlangsamt, spannt länger als ein plötzlicher Totalverlust. | Deep Sea Adventure |
| R7 | **Fail forward: Scheitern produziert Content, nie nur Verlust.** Havarie statt Game Over; Erbe statt Reset; jeder Fehlschlag liefert garantiert Story/Weltspur. | Ingold „failing-but-not-failed"; Skies Legacy; Hades („failure is death, and death is progress"); Failbetter-Empirie |
| R8 | **Meta-Progression: Optionen > Zahlen; Beute sofort in eine Ausgabe-Entscheidung wandeln.** Der Tod endet in einem Einkauf, nicht in Leere — der stärkste dokumentierte „one more run"-Übergang. | Rogue Legacy (Manor); Hades-Warnung (Meta darf nicht vor dem Ziel versiegen) |
| R9 | **Mechanischer Zustand wird Erzähltext.** Events lesen KH/BB/DZ als Bedingungen und referenzieren sie — derselbe Knoten fühlt sich je nach Ankunftszustand anders an; Content vervielfacht sich ohne neuen Content. | 80 Days („a board-game which narrates itself") |
| R10 | **Alle Ressourcen ineinander konvertierbar, immer mit Verlust.** Keine Ressource darf isoliert optimierbar sein. | 80 Days (Geld↔Zeit↔Gesundheit) |
| R11 | **Druck-Ressourcen brauchen sichtbare Meter, nicht-triviales Management und Break-States mit Persönlichkeit.** Senken muss etwas Bleibendes kosten (Terror→Nightmares-Tausch). | Darkest Dungeon; Skies Terror-Rework |
| R12 | **Wissen ist eine eigene Belohnungsschiene.** Gerüchte/Anomalien stellen Fragen, ein Log hält Gewusstes verlustfrei — macht 10-Minuten-Sessions produktiv, weil der Wiedereinstieg kostenlos ist. | Outer Wilds (Rumor-Map); Subnautica |

Dazu zwei Negativ-Lehren: Curious Expedition zeigt, dass Push-your-luck an **zu kleinem Event-Pool** und **unbeeinflussbarem RNG** stirbt (Metacritic-Konsens); Sunless Skies' Launch zeigt, dass eine zu enge Kosten/Ertrags-Ökonomie jede Reise-Verbesserung wieder auffrisst.

---

## 4. Zielbild

> **Ein Run ist eine Expedition mit Bogen: Rüsten → hinaus an die Frontier, wo jeder Takt ein Ereignis und jede Weggabelung eine Wette ist → der Moment, in dem man zu viel trägt und trotzdem weitergeht → die Heimkehr, bei der die Welt sichtbar anders ist als vorher → eine Ausgabe-Entscheidung, die den nächsten Run verändert.**
> Dauer 10–15 Minuten. Danach will man entweder sofort wieder los — oder man hat etwas „gepflanzt", das bis zur nächsten Session reift.

Fünf Design-Verpflichtungen (die P0.5-Fassung der Konzept-Pillars, geschärft am Befund):

1. **Jeder Takt eine Entscheidung oder ein Ereignis.** (gegen D1/D3, per R1/R2)
2. **Jede Ablieferung zahlt — und zwar sichtbar dreifach:** Ressource (Siegel/VP), Weltspur (Effekt mit Beleg-Link), Beziehung (Agent/Bindung). (gegen D2/D4)
3. **Der Bust ist ein Erlebnis, kein Abzug.** (gegen D5, per R7)
4. **Kein System im UI, das nicht spielt.** Frequenzen werden aktiviert oder aus dem HUD genommen. (gegen D6)
5. **Der Run endet in einer Entscheidung, nicht in einem Toast.** (per R8)

---

## 5. Das Redesign — neun Mechanik-Pakete

Die Pakete sind einzeln shippbar und bauen aufeinander auf; §7 ordnet sie in Wellen. Neue Spieler-Verben: **Sondierung**, **Umstimmung**, **Requisition** (plus Storylet-Optionen). Alles Weitere ist Tuning, Content und Sichtbarmachung.

### M1 — Signale: jeder Zug zieht ein Ereignis *(das Herzstück, gegen D3)*

Bei jedem `fn_travel_move` wird deterministisch (seeded per `run_id × node × takt` — replay-validierbar, kein `random()` im Client) aus einer gewichteten **Signaltabelle** gezogen, geschichtet nach Distanzband und Knotentyp:

| Signalklasse | Gewicht (near/mid/deep) | Inhalt |
|---|---|---|
| **Störung** | 15/25/35 % | Mikro-Storylet mit 2–3 Optionen und einem Check (Skill-Check-Reuse aus `combat/skill_checks.py`): Ausweichen kostet BB, Durchhalten riskiert KH, Hinhören gibt +DZ und Information. Die Deep-Surge-Mechanik geht hierin auf — aus dem stummen 40 %-Würfel wird eine Szene mit Wahl. |
| **Fund** | 20/20/15 % | Treibgut des Zwischenraums: Fracht-Instanz, BB-Zelle, Fragment-Splitter. Funde referenzieren reale Entitäten benachbarter Welten (ein Erinnerungsstück *von* Agent X aus Welt Y — KPI 1 gilt auch hier). |
| **Gerücht** | 25/20/15 % | Information statt Materie (R12): deckt Inhalt/Typ eines nicht-adjazenten Knotens auf, kündigt ein Noticeboard-Angebot an, verrät die Position eines Wracks. Schreibt in ein persistentes **Logbuch** (Rumor-Map light — `traveler_discoveries` bekommt eine `rumors`-Facette). |
| **Begegnung** | 5/10/15 % | Ein anderer Träger (asynchron: aus echten `travel_runs` der letzten 72 h — „hier war vor zwei Tagen jemand auf memory unterwegs"), ein Echo-Schwarm, später Splitterfänger. P0.5: rein narrativ + 1 Option. |
| **Stille** | 35/25/20 % | Kein Modal, aber nie „nichts": eine Zustands-Zeile im Log, die den aktuellen Ressourcenstand narrativiert (R9: „Der Rumpf singt leise auf dieser Frequenz — Kohärenz stabil, aber das Fenster wird schmal."). Stille wird mit steigender DZ seltener. |

Content-Bedarf: ~30–40 Storylet-Skelette (YAML-Pack `content/drift/signals/`, bestehende Pack-Pipeline), kombinatorisch gedresst über die vorhandene GenerationService-Façade mit Template-Fallback (KPI 6 bleibt intakt). Die Skelette lesen Ressourcen-Bänder als Requirements (R9) — dieselbe Störung liest sich bei KH < 40 anders und bietet dann eine Option mehr.

**Abnahme-Kriterium:** Über einen 14-Takt-Run erlebt ein Spieler im Median ≥ 6 Nicht-Stille-Signale und trifft ≥ 4 Entscheidungen außerhalb der Routenwahl.

### M2 — Sondierung: Vermessung wird echtes Push-your-luck *(gegen D7)*

Neues Verb an jedem nicht-heimischen Knoten: **Sondieren** (1 Takt). Ersetzt die passive Erstankunfts-Gutschrift als *Haupt*-Ertragsquelle (die Erstankunft gibt weiter einen Sockel):

- Jede Sondierung am selben Knoten eskaliert: Ertrag **2 → 3 → 5 → 8** Vermessungspunkte, aber pro Zug wird ein **Störungsmarker** offen auf den Knoten gelegt (im HUD sichtbar gestapelt — Incan-Gold-Prinzip R4: abzählbar, nie beziffert).
- Bust-Bedingung: Die dritte gleiche Marker-Klasse löst einen **Resonanzriss** aus — der *ungesicherte* Haul dieses Knotens verfällt, +DZ-Schub, das Signal-Deck des Knotens dreht auf Störung. Gesicherter Haul (siehe Bank) bleibt unberührt (R5).
- **Bank-Punkte:** An **Relais**-Knoten (P0.5 führt 2 davon in den Graphen ein, §M7) kann der Haul per **Funkboje** zwischengesichert werden — zu 70 % des Kurses; volle 100 % gibt es nur bei der Entladung zuhause. Das ist der Bank-or-carry-Moment: sichern und weniger bekommen, oder tragen und riskieren.
- Commit vor Auflösung (Balatro-Lehre R4/P3): Der Spieler entscheidet erst, *dann* rollt die Sondierungs-Sequenz sichtbar ab (Mikro-Zeremonie 480–900 ms, `prefers-reduced-motion`-Fallback).

Damit bekommen die drei Ressourcen ihre Spannung zurück: Sondieren kostet Takte (Fenster!), Marker bedrohen KH/DZ, und die Bank-Frage koppelt alles an die Routenplanung.

### M3 — Fracht mit Gewicht: der Bust wird langsam, nicht plötzlich *(gegen D5/D7, per R6)*

- Frachtslots über der freien Kapazität (Klasse I: 2 frei) erhöhen die BB-Kosten **jedes** Zuges um +1 pro Überlast-Slot. Wer voll beladen ist, *spürt* es auf jeder Kante — die Heimreise wird zur Deep-Sea-Adventure-Kriechpartie, während DZ weiterläuft.
- **Havarie statt Snap:** KH ≤ 0 heißt nicht mehr „Teleport nach Hause". Stattdessen öffnet ein Havarie-Storylet mit echter Wahl (Quacks-Teilverlust R5/R7): *Notabwurf* (wähle, welche Fracht du opferst — der Rest kommt an, aber Fenster −2), *Notruf ans Relais* (alles behalten, aber −50 % des ungesicherten Hauls und ein 10-Siegel-Bergungsvermerk) oder *Zerfaserung annehmen* (P0-Verhalten: Scatter als Echos — jetzt aber mit Wrack-Vermerk im Logbuch und einem Eintrag, den andere Spieler als Gerücht ziehen können). `zerfaserung_count` wird endlich geschrieben.
- Fenster-Ablauf fern von zuhause wird analog zur Wahl statt zum Snap: *Überziehen* (+5 DZ/Takt, wie Plan §2.6) oder *Rückruf annehmen*.

### M4 — Die Ökonomie einschalten *(gegen D2 — größter Hebel pro Aufwandseinheit)*

Kein neues Schema nötig; die Felder existieren seit 239. Es fehlt nur das Schreiben:

- **Depeschen zahlen:** Tier 1 = 8–12 Siegel + 10 VP (Plan §2.9 war fertig — umsetzen). Ablieferung toastet den Betrag und das Lifetime-Konto.
- **Sondierung/Entladung zahlen:** Haul → VP 1:1 + Siegel-Anteil; Erstvermessung +40 Siegel (Plan-Wert).
- **Clearance-Ränge aktivieren** (Aspirant → Feldkartograph bei 100 VP als erster Schritt): Ränge schalten **Optionen** frei, nie Rohkraft (R8) — Tier-2-Depeschen, den zweiten Frequenz-Vektor (§M5), das Routen-Publizieren. Die Rang-Prüfung ist ein Storylet im Bureau (Plan §2.7), kein Menü-Klick.
- **Requisition — der Rogue-Legacy-Moment (R8):** Nach jedem Run (Entladung *und* Havarie) öffnet der **Requisitionsschein**: 3–4 Angebote des Bureaus, Siegel-präzise, sofort wirksam für den nächsten Run. Katalog-Start: *Bandbreitenzelle* (+2 BB max, stapelbar bis Klasse-Grenze, 20 Siegel), *Dämpfglied* (erster DZ-Schub pro Run halbiert, 15), *Sondierbojen-Paket* (erster Resonanzriss pro Run abgewendet, 25), *Frachtnetz* (+1 freier Slot, 30), *Bureau-Karte eines Sektors* (deckt einen Knoten samt Signal-Tendenz auf, 10 — Information als Ware, R2/R12). Klasse-II-Upgrade (50 Siegel + Feldkartograph) wie im Plan.
- **HUD zeigt das Konto:** Siegel, VP mit Fortschrittsbalken zum nächsten Rang, Lifetime-Vermessung. Eine unsichtbare Währung existiert nicht (D2-Lektion).

Wichtig (Skies-Launch-Negativlehre): Eine Standard-Expedition muss ihre Betriebskosten *deutlich* übertreffen. Zielwert: Ein durchschnittlicher 14-Takt-Run wirft 25–40 Siegel ab; das billigste Requisitions-Item kostet 10 — jede Session endet kaufkräftig.

### M5 — Umstimmung: die Frequenzen fangen an zu spielen *(gegen D6)*

Minimal-invasive Aktivierung mit **zwei** Vektoren statt sieben (progressive Disclosure wie im Plan §2.8):

- Neues Verb **Umstimmen** (1 Takt, −5 KH; an Relais gratis — Plan-Werte). Start-Vektor bleibt der Heimat-Dominante; der zweite (architecture) kommt mit Feldkartograph.
- Der Chart-Generator bekommt echte per-Vektor-Permeabilität: ~25 % der Kanten und 2–3 Knoten sind nur auf *einem* der beiden Vektoren passierbar/sichtbar (Frequenzfenster) — Re-Exploration bekannten Raums wird real (Konzept-Pillar 2).
- Fracht-Familien koppeln an Vektoren (bestehende `travel_cargo`-Daten!): Traumfracht +1 DZ/Zug off-vector, Kontrakte nur auf commerce abzuliefern (sobald commerce kommt) — die Peacock-Wind-Regel an der kleinsten Stelle.
- Nicht mehr, bewusst: Kein 7-Vektoren-Vollausbau in P0.5. Zwei Vektoren genügen, damit das System *existiert* und Routen faltet; der Rest skaliert mit P1a.

### M6 — Wirkung sichtbar machen: der Plattform-USP wird eingelöst *(gegen D4 — hier schlägt DRIFT jedes Referenzspiel)*

Kein Referenztitel kann, was die Plattform kann: dass ein NPC sich in einem echten Chat an die Lieferung *erinnert*, dass eine Chronik den Spieler namentlich erwähnt, dass eine andere Welt das Echo wirklich empfängt. Genau deshalb ist die aktuelle Unsichtbarkeit so teuer.

- **Hospitality-Politik:** Für kanonische + eigene Welten Default auf `standard` anheben (Owner-Opt-down bleibt; Seed-Migration analog 239:304). Alternativ minimal: `nur_echos` behalten, aber die Depeschen-Selektion bevorzugt Welten mit `standard`+ und **sagt es dem Spieler** („Diese Welt empfängt Träger offen — volle Wirkung").
- **Ehrliches Effekt-Feedback:** Die Entladungs-/Ablieferungs-Zeremonie zeigt jede Wirkung als Karte mit Beleg-Link — *„Echo empfangen in Cité des Dames → [Ereignis ansehen]"*, *„Inspektor Mueller wird sich erinnern → [Agent]"* — und gefilterte Effekte ehrlich als „von der Welt gefiltert (Gastfreundschaft: nur Echos)". Aus dem stummen Filter wird Fiktion.
- **Ziel-Entitäten mit Bedeutung statt `oldest agent`:** Der Selektor zieht (a) Agenten mit bestehender **Bindung** des Spielers, (b) Agenten, die in aktuellen `events` der Zielwelt vorkommen, (c) Gebäude-passende Empfänger (Depesche *an das Archiv*, *an den Marktvorstand* — `building_type`-Match). Zwei-Entitäten-KPI bleibt, wird aber kuratiert statt zufällig.
- **Der Erinnerungs-Payoff als Zeremonie:** Nach einer Lieferung mit `inject_agent_memory` bekommt der Spieler beim nächsten Chat mit dem Agenten die Erinnerung aktiv gespiegelt (pgvector-Recall existiert). P0.5 macht daraus einen Beat: Das Debriefing (unten) zitiert, *was* der Agent erinnern wird.
- **Bureau-Debriefing (Hades-Prinzip R7/R8):** Jeder Run endet in einem kurzen Debriefing-Storylet im Bureau, das Run-Fakten narrativiert (Haul, Havarie, erste Kontakte) und bei Fehlschlägen eigene Zweige hat — Scheitern erzeugt garantiert Text, der sonst nicht existierte. Speist `journal_fragments` (bestehender Kanal).

### M7 — Die Karte wächst und gabelt sich *(gegen D1)*

Chart-Ausbau von 6 auf **18–24 Knoten** (eine Region, kein Voll-Multiversum), generiert nach StS-Regeln (R3):

- **Typenmix:** 2 Relais (Bank + Gratis-Umstimmung + Rast: −5 DZ), 2 Echo-Untiefen (Sondierbonus, +DZ pro Zug — Peacock-Wind), 1 Geisterinsel light (2 Storylets, instabil), Rest Interstitial in drei Distanzbändern.
- **Generierungs-Invarianten (CI-prüfbar wie die bestehende Konnektivitäts-Assertion):** von jedem Knoten ≥ 2 Weiterwege, wo der Graph es zulässt; kein Pfad ohne Preis (der BB-billigste Weg führt durch DZ-Terrain und umgekehrt); Rekonvergenzpunkte, damit ein verpatzter Check zur Umplanung statt zum Run-Ende führt; risikoreiche Knoten (deep, Untiefen) tragen nachweislich höheren Erwartungsertrag (R3).
- **Mehrere fremde Welten im Fenster:** Prod hat längst > 10 aktive Welten — der P0.5-Graph dockt **3–4** davon an (statt 1), womit Depeschen-Wahl („welche Welt bediene ich diesen Run?") erstmals eine Entscheidung ist. Die 80-Days-Spannung „interessante Route vs. optimale Route" braucht mindestens zwei legitime Ziele.
- Fenster auf **14 Takte** (von 6/8), BB-Klasse I auf 10. Die Zwangsroute stirbt an schierer Kombinatorik; das Fenster bleibt der Citizen-Sleeper-Druck („du schaffst nie alles").

### M8 — Agenten, Gebäude, Ereignisse als Quest-Substrat *(Auftrags-Direktive: bestehende Systeme nutzen)*

- **Bindungen als Quest-Geber:** Agenten mit Bond-Tiefe ≥ 2 legen persönliche Depeschen ins Angebot („Bring das *für mich* zu…") — höhere Siegel, plus `bond_event`-Effekt (bestehende Strain/Milestone-Mechanik). Das zahlt auf das Bonds-System ein und umgekehrt.
- **Gebäude als Orte im Dock:** Beim Docken zeigt das Dossier **3 kuratierte Gebäude** der Welt (Archiv/Markt/Sanctuary-Typen bevorzugt; echte `buildings`-Zeilen). Jedes trägt eine Aktion für 1 Fenster-Takt: Archiv *authentifiziert* Fracht (+Wert, deckt `gefälscht`-Twist auf), Markt *fenced* Fundstücke (Siegel), Sanctuary senkt DZ (−5, der bestehende `sanctuary`-Flag!). Das ist die Begehung in ihrer kleinsten spielbaren Form — drei Türen, eine Uhr.
- **Live-Ereignisse als Auftragsquelle:** Der Depeschen-Selektor liest aktuelle `events` der Zielwelt und erzeugt *investigate*-Aufträge („Kläre, was hinter [echtes Ereignis] steckt" — 1 Dock + 1 Gebäudebesuch + 1 Check). Die Welt-Aktualität wird Quest-Wetter, exakt wie Konzept §8.4 es wollte.
- **Echo-Jagd light:** Ein sichtbares `event_echo` in der Heimat-Chronik ist als „Spur aufnehmen"-Auftrag anklickbar (ein Hop, nicht die volle Kette) — der Zero-Authoring-Quest-Typ aus Konzept §9.4 in Minimalform.

### M9 — Session-Bogen, Eskalation, Wiederkehr *(gegen D8)*

- **Eskalation im Run:** DZ-Zuwachs pro Zug steigt ab Takt 8 um +1 (das Spätfenster wird teurer — Balatro-Prinzip: Safe-Play wird mit der Zeit zur Verlierer-Strategie, der Push wird erzwungen, nicht nur erlaubt).
- **Zahltag-Moment:** Die Entladung wird zur gestaffelten Reveal-Zeremonie (Commit → Aufdeckung Stück für Stück: Haul → Siegel → Wirkungskarten → Requisitionsschein). Der beste Moment des Spiels gehört ans Ende jedes Runs.
- **Appointment ohne Energie-System:** Noticeboard-Rotation (6 h, bestehende Cadence-Planung) + eine **Tagesdepesche** mit Bonus-Siegeln. Ein Bust kostet niemals Tagesbudget (Anti-Candy-Crush-Regel) — es gibt kein Aktionslimit, nur reifende Angebote. Die Heimat-Regeneration (KH/BB über Takte zuhause) läuft als „gepflanzter" Zustand zwischen Sessions.
- **Saisonale Sichtbarkeit:** Erstvermessungs-Siegel + ein schlichtes „Träger des Zyklus"-Board (Vermessung/Lieferungen) — asynchroner Vergleichsdruck ohne PvP (Konzept §15.1 bleibt unangetastet).

---

## 6. Zahlenwerk v2 (Vorschlag, pack-owned wie bisher)

| Parameter | P0 (Code) | P0.5-Vorschlag | Begründung |
|---|---|---|---|
| Fenster (Takte) | 6 (prod: 8) | **14** | Session 10–15 min; Raum für Sondieren/Gebäude/Umwege; „nie alles schaffen" bleibt |
| BB max Klasse I | 6 | **10** | 18–24-Knoten-Graph braucht Reichweite; Knappheit kommt aus Überlast + Off-Vector statt Grundmangel |
| DZ-Cap | 20 | **40** (Band Verstimmt spielbar) | DZ braucht Raum zum Eskalieren + Senken (Sanctuary/Relais als echte Sinks) |
| DZ/Zug | +1/2/3 (Band) | unverändert, **ab Takt 8: +1 extra** | Eskalation §M9 |
| Deep-Surge 40 % | stummer Würfel | → **Störungs-Signal** mit Optionen | M1; Output- wird Input-Randomness |
| Notfrequenz | −20 KH/Kante | −10 KH/Kante, nur bekannte Kanten | 20 ist mit Havarie-Redesign doppelt bestrafend |
| Sondierung | — | 1 Takt; Ertrag 2/3/5/8 VP; 3. gleicher Marker = Riss | M2; Odds eskalierend & ablesbar |
| Funkboje (Relais) | — | Bank zu 70 % | M2; Bank-or-carry |
| Überlast | — | +1 BB/Zug pro Slot über frei | M3; Tempoverlust-Bust |
| Depesche Tier 1 | 0 | **8–12 Siegel + 10 VP** | M4; Plan §2.9 aktivieren |
| Erstvermessung | Ehren-Siegel | +40 Siegel +25 VP | Plan-Wert |
| Run-Ertrag Ziel | ~0 Siegel | **25–40 Siegel/Run** | Requisition (10–50) jede Session erreichbar |
| Feldkartograph | nie erreichbar | 100 VP + 25 Siegel (≈ 3–5 Runs) | erster Rang schnell, dann strecken |

Alle Werte bleiben Daten (`drift_tuning` / `content/drift/tuning.yaml`), nichts hardcoded — wie gehabt.

---

## 7. Phasierung: P0.5 „Fun-Kern" in drei Wellen

Alles hinter dem bestehenden `drift_p0_enabled`-Gate bzw. einem neuen `drift_p05_enabled`-Sub-Gate; jede Welle einzeln mergebar und browser-verifizierbar.

**Welle 1 — „Es zahlt sich aus" (reine Aktivierung, kein neues System):**
M4 Ökonomie (Depeschen-/Survey-Erträge, Rang 1, HUD-Konto) + M6 ehrliches Effekt-Feedback + Wirkungskarten + Debriefing-Storylet + M3-Havarie-Grundform (Wahl statt Snap, `zerfaserung_count`). Aufwand: überwiegend RPC-Erweiterungen bestehender Funktionen + FE-Zeremonien + ~8 Storylet-Skelette.
*Abnahme: Ein Playtester kann nach drei Runs sagen, was er verdient hat, was es ihm gebracht hat und wo seine Lieferung in der Welt sichtbar ist.*

**Welle 2 — „Jeder Zug lebt":**
M1 Signale (Signaltabelle + 30 Skelette + Logbuch) + M2 Sondierung/Funkboje + M9 Eskalation & Entladungs-Reveal.
*Abnahme: Median ≥ 4 Entscheidungen pro Run außerhalb der Routenwahl; mindestens ein dokumentierter „einen Zug zu weit"-Bust im Playtest, der sich gut anfühlt (Protokollfrage).*

**Welle 3 — „Die Karte trägt":**
M7 Chart-Ausbau (18–24 Knoten, 3–4 Welten, Generierungs-Invarianten in CI) + M5 Umstimmung (2 Vektoren) + M8 Gebäude-Docks & Bond-Depeschen + M4-Requisition-Vollkatalog + Tagesdepesche.
*Abnahme: Zwei Playtester wählen im selben Setup unterschiedliche Routen und können beide begründen, warum; KPI 3 (< 20 min bis fremde Welt) hält weiterhin.*

Danach greift wieder die bestehende P1/P2-Roadmap (alle Welten, Presence, Companions, volle Zerfaserung mit Wrack/Rettung) — dieses Dokument ersetzt sie nicht, es zieht den Spaß vor sie.

**Explizit verschoben bleiben:** Helm-Modus (P3, unverändert), volle 7 Vektoren, Konvoi/Mitfahrt, Wetter/Stürme, Spuren-Moderation. Nichts in P0.5 verbaut ihnen den Weg; M1s Event-Stream und M2s Marker sind mode-agnostisch (Konzept §7.5 bleibt Kontrakt).

---

## 8. Design-KPIs für den Fun-Kern (zusätzlich zu Konzept §21)

| # | Kontrakt | Messung |
|---|---|---|
| F1 | Entscheidungsdichte: ≥ 1 nicht-triviale Entscheidung pro 2 Takte (Median) | Telemetrie: Storylet-Optionen + Sondier-Commits + Bank-Aktionen / Takte |
| F2 | Kein dominanter Pfad: über 20 Runs desselben Spielers ≥ 5 distinkte Routen | `travel_telemetry_events`-Pfad-Hashes |
| F3 | Jede Ablieferung erzeugt ≥ 1 für Dritte sichtbare Weltspur ODER kommuniziert ehrlich die Filterung | Effekt-Audit + FE-Assertion |
| F4 | Bust-Zufriedenheit: Havarie endet nie ohne Wahl und nie ohne Text | Storylet-Pflicht im Havarie-Pfad (CI: kein Auto-Resolve-Zweig) |
| F5 | Ökonomie-Puls: Median-Run-Ertrag ≥ billigstes Requisitions-Item | Telemetrie Siegel/Run |
| F6 | „One more run": ≥ 40 % der Entladungen werden < 5 min später von einem neuen Aufbruch gefolgt (Playtest-Kohorte) | `drift_run_open`-Telemetrie-Δ |

---

## 9. Risiken

| Risiko | Antwort |
|---|---|
| Signal-Pool zu klein → nach 5 Runs alles gesehen (Curious-Expedition-Tod) | Kombinatorik vor Masse: Skelette × Ressourcen-Band × Entitäts-Dressing × Knotentyp; Skelett-Zähler im Telemetrie-Dashboard; Pack-Nachschub ist Content-Arbeit, kein Code |
| LLM-Dressing-Kosten steigen mit Signaldichte | Cache per (skeleton, entity-tuple) existiert (`travel_dressing_cache`); Stille-Klasse + Template-Fallback sind kostenlos; Budget-Purpose deckelt |
| Ökonomie-Inflation (Siegel entwerten) | Requisition ist der einzige Sink zu Beginn — Katalogpreise skalieren mit Rang; keine Spieler-zu-Spieler-Kanäle (bestehende Invariante) |
| Hospitality-Default anheben verletzt Owner-Souveränität | Opt-down bleibt; Alternative (ehrliche Filter-Anzeige) ist Welle-1-Fallback ohne Politik-Änderung |
| Drei neue Verben überfordern Erstsession | Progressive Disclosure: Sondieren ab erstem fremden Knoten tutorialisiert, Umstimmen erst ab Rang 2, Requisition erklärt sich als Post-Run-Screen selbst |

---

## 10. Zusammenfassung für die Entscheidung

Der P0 hat bewiesen, dass die Architektur trägt. Er hat auch — unfreiwillig, aber deutlich — bewiesen, welche vier Dinge ein Reisespiel nicht überlebt: leere Züge, tote Ökonomie, unsichtbare Wirkung, folgenloses Scheitern. Die Forschung ist einhellig, die Referenzspiele haben jede dieser Lektionen dokumentiert bezahlt. Das Redesign braucht kein neues Schema-Fundament und keine neue Infrastruktur: **Welle 1 ist fast ausschließlich das Einschalten von Dingen, die als Plan-Spezifikation und Schema bereits existieren.** Der eigentliche Neubau (Signale, Sondierung, Kartenwachstum) ist Content + drei RPC-Verben + Zeremonien — und zahlt direkt auf das ein, was diese Plattform als Einzige kann: eine Reise, nach der sich die Welt wirklich erinnert.
