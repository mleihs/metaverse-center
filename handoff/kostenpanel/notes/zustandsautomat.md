# Zustandsautomat: Kacheln · Filter · Sortierung · Aufklappen

Vier Zustaende, die sich beruehren. Die Reihenfolge unten ist die Rangfolge: was oben steht, gewinnt.

## 0 · Rangfolge
`Zeitraum` → `Filter` → `Kachelauswahl` → `Sortierung` → `aufgeklappte Zeile`
Ein Wechsel oben rechnet alles darunter neu; ein Wechsel unten laesst alles darueber unberuehrt.

## 1 · Zeitraum (global, einmal fuer das ganze Panel)
- **Granularitaet wird abgeleitet, nie angeboten:** 7 Tage → Stunde · 30 → Tag · 90 → Woche · 1 Jahr → Monat. Jeder Zeitraumwechsel leitet neu ab.
- Semi-relative Zeitraeume („seit Monatsbeginn bis jetzt") bleiben relativ: beim Neuladen wird neu ausgewertet, nicht das damalige Datum eingefroren.
- Wirkung: Kachelauswahl **bleibt**, Sortierung **bleibt**, aufgeklappte Zeile **schliesst** (ihre Einzelaufrufe gehoerten zum alten Zeitraum).

## 2 · Filter
- **UND ueber Achsen, ODER innerhalb einer Achse.** „Anbieter = Replicate" UND „(Zweck = agent_portrait ODER building_plate)".
- Wirkung: Sortierung **bleibt** (Sortierung ist eine Ansichtseigenschaft, keine Datenaussage). Kachelauswahl **bleibt**. Aufgeklappte Zeile bleibt offen, **wenn ihre Gruppe die Filterung ueberlebt** — sonst schliesst sie still, ohne Meldung.
- **Die Kacheln rechnen unter dem Filter neu.** Deshalb steht in ihnen nur, was auch gefiltert eine Aussage hat (Ist/Hochrechnung als Summen) — und nichts, was erst nach Setzen eines Filters bedeutet, was es sagt.
- Leeres Ergebnis: die Tabelle sagt „keine Zeile traegt diese Kombination", **nicht** „0". Das Diagramm nimmt die Leer-Achsen-Behandlung, kein Nullbalken.
- Top-N schneidet **nach** dem Filter: „Sonstige" ist immer der abgeschnittene Rest der *gefilterten* Achse. Und Top-N greift erst ab **mehr als zehn** Werten.

## 3 · Kachelauswahl (Stripe-Muster)
- Die Kachel ist die **Datenquelle des Diagramms**, nicht ein Filter. Sie faerbt die Tabelle nicht und schraenkt sie nicht ein — sonst kaempfen Kachel und Filterleiste um dieselbe Aussage.
- Genau eine Kachel aktiv; erneuter Klick auf die aktive faellt auf „Gesamt" zurueck. Zustand: kompletter 1px-Rahmen in Traegerfarbe + Tint, **kein Kantenstreifen**.
- Nur die drei Betragskacheln sind Selektoren. Zaehler- und Abdeckungskacheln sind keine (sie haetten keine Serie).
- Die nicht gewaehlte Serie im Diagramm wird **gedimmt (0,22), nicht entfernt** — die Stapelhoehe soll vergleichbar bleiben.

## 4 · Sortierung
- Eine Spalte zur Zeit, zwei Zustaende (absteigend → aufsteigend), Vorgabe **Kosten absteigend**. Kein dritter „unsortiert"-Zustand.
- **Sammelzeilen sind gepinnt:** „Sonstige" und „ohne Angabe" stehen immer am Ende, in beiden Richtungen. Sie sind keine Gruppen, sondern Restbestaende.
- **Zellen ohne Wert haben keine Position auf der Achse:** `·`, `—`, `░` sortieren in beiden Richtungen ans Ende, nie zwischen die Zahlen. Geschaetzte Werte (`~`) sortieren an ihrem Zahlenwert.
- Sortierung wirkt nur auf die Gruppenebene. Die aufgeklappten Einzelaufrufe haben ihre **eigene, feste** Ordnung (Zeit absteigend) und erben sie nicht.

## 5 · Aufgeklappte Zeile
- **Genau eine Ebene, genau eine Zeile.** Ein zweites Aufklappen schliesst das erste. Ebene 5 (Einzelaufruf) ist nur ueber Klick erreichbar, nie ausgeklappt vorhanden.
- Sammelzeilen klappen **nicht** auf: „ohne Angabe" hat keine Gruppe, „Sonstige" waere zwei Ebenen.
- Sortierwechsel schliesst **nicht** — die Zeile wandert mit.

## 6 · Was in die URL gehoert
`Zeitraum`, `Filter`, `Sortierspalte + Richtung` — das ist der Zustand, den man verschickt.
**Nicht** in die URL: Kachelauswahl und aufgeklappte Zeile (ansichtslokal, sonst schickt man Blickrichtung statt Frage).

## 7 · Zwei Fallen aus dem Entwurf
1. Die Kachelwerte **und** die Diagrammhoehen haengen am Filter, die Hochrechnung aber am **Zeitraumende**. Bei „seit Monatsbeginn" ist die Prognose eine Monatsprognose, bei „letzte 90 Tage" ist sie keine — dann **keine Prognose zeigen** (AWS-Regel: keine Daten, kein Band), nicht auf Null hochrechnen.
2. Die Zaehlbasis jedes Mittelwerts (`n = 512 von 640`) muss **nach** dem Filter neu gerechnet werden. Wird sie gecacht, behauptet die Zeile eine Basis, die es unter dem Filter nicht mehr gibt — und genau dieser Wert ist das Versprechen des Panels.
