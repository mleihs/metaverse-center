---
title: "Zitatprüfung: 46 Epigraphe schreiben sich einer echten Person zu"
date: "2026-09-01"
type: analysis
lang: de
---

# Zitatprüfung — Epigraphe und philosophische Anker

**Anlass:** Der Nutzer fragte, ob die Zitate im Spiel — besonders die der
philosophischen Anker — echt sind, und ob sichergestellt ist, dass die Forge
keine erfundenen produziert.

**Kurzantwort:** Nein, sie waren es nicht. Drei Fälschungen sind an Quellen
nachgewiesen, ein weiterer Kreis ist ohne auffindbaren Beleg. Die Ursache stand
im Prompt und ist behoben; der Bestand auf Produktion ist es noch nicht.

---

## 1 · Der Bestand, gemessen

Auf Produktion, 01.09.2026, nur lebende Welten:

    Epigraphe gesamt                              99
      Zuschreibung an eine ECHTE Person/Werk      46   ← Prüffläche
      Zuschreibung in die Weltfiktion              4   ← unbedenklich
      ohne erkennbare Zuschreibung                49   ← unbedenklich
    Welten mit philosophischem Anker               8

⚠ **Die philosophischen Anker selbst enthalten keine Zitate.** Ihr Feld
`literary_influence` verlangt „the real author, work or school of thought this
anchor grounds itself in" — das ist ein VERWEIS, kein Zitat, und ein Verweis auf
einen realen Denker ist legitim. Die Zitate stehen in den **Lore-Epigraphen**.
Die Frage war richtig gestellt, die Fundstelle liegt eine Ebene daneben.

---

## 2 · Nachweislich falsch (an Quellen geprüft)

### „I am a cage, in search of a bird." — Franz Kafka, *The Zürau Aphorisms*
**Fehlzitat.** Kafkas Aphorismus 16 lautet „Ein Käfig ging einen Vogel suchen"
(engl. „A cage went in search of a bird"). Die Fassung im Spiel dreht den Sinn
um: bei Kafka HANDELT der Käfig, hier gesteht ein Ich. Die falsche Fassung
kursiert auf Zitateseiten.

### „The bureaucracy is expanding to meet the needs of the expanding bureaucracy." — Oscar Wilde
**Unbelegt.** Keine Werkstelle. Die Zuschreibung existiert nur auf
Zitate-Aggregatoren; Bartlett's führt sie nicht, und wer sie sucht, findet nur
weitere Aggregatoren, die einander zitieren.

### „Every language is a world." — Ludwig Wittgenstein, *Philosophical Investigations* §19
**Nicht von Wittgenstein.** §19 existiert und sagt etwas anderes: „And to
imagine a language means to imagine a form of life." Die naheliegende echte
Zeile wäre „Die Grenzen meiner Sprache bedeuten die Grenzen meiner Welt"
(Tractatus).

🔑 **Das ist die gefährlichste Form.** Eine Erfindung mit korrekt aussehender
Fundstelle ist glaubwürdiger als das Echte — die Paragraphennummer stimmt, nur
der Satz nicht. Wer sie prüft, prüft meist die Nummer.

---

## 3 · Ohne auffindbaren Beleg (gesucht, nichts gefunden)

Schwächer als Abschnitt 2: „nicht gefunden" ist nicht „widerlegt". Diese
Zuschreibungen tragen aber präzise Fundstellen und sollten geprüft werden,
bevor sie stehen bleiben.

| Zitat | Zuschreibung |
|---|---|
| „Every institution is a kind of metaphysics." | Michel Foucault, *Discipline and Punish* (1975) |
| „A skeleton in the cupboard is a friend for life." | Alfred Jarry, *Ubu Roi*, Appendix (1896) |
| „In the upper zones of the tower, books are reduced to words…" | Jorge Luis Borges, *The Library of Babel* |
| „In the commercial society, excess creates new needs." | Georges Bataille, *The Accursed Share* |
| „The skin has eyes. The skin has a language." | Juhani Pallasmaa, *The Eyes of the Skin* |
| „The observation of A requires B; the observation of B requires C…" | Niklas Luhmann, *Social Systems* |
| „In the beginning was violence, and the violence was aimed inward." | Michel Serres, *Genesis* |
| „What you call preservation is precisely the danger." | Martin Heidegger, *The Question Concerning Technology* |
| „The state is not a machine but a body…" | James C. Scott, *Seeing Like a State* |

## 4 · Bekannt apokryph (die Zuschreibung selbst ist strittig)

* „History is a set of lies agreed upon." — **Napoleon**. Die überlieferte Form
  ist „L'histoire est une fable convenue", und auch sie ist Napoleon nur
  zugeschrieben.
* „The only way to deal with an unfree world is to become so absolutely free…" —
  **Camus**. Weit verbreitet, ohne Werkstelle.
* „Language is a virus from outer space." — **Burroughs**. Burroughs schrieb
  „the word is a virus"; die Formel mit „outer space" stammt aus Laurie
  Andersons Rezeption.

## 5 · Vermutlich echt (wiedererkannt, NICHT an Quellen geprüft)

Diese Zeilen kenne ich als kanonisch. Das ist eine schwächere Aussage als
Abschnitt 2 — ich habe sie **nicht** nachgeschlagen, und sie sollten nicht als
geprüft gelten:

Beauvoir *Das andere Geschlecht* · Whitman *Song of Myself* · Wilde *Bunbury* ·
Korzybski *Science and Sanity* · Ginsberg *Howl* und *Song* · Eliot *The Hollow
Men* · Pound *Cantos* LXXXI · Blake (Brief an Trusler) · Benjamin *Berliner
Kindheit* · Baudrillard *Simulacres* · Fisher *Capitalist Realism* · Dick ·
Jung *Erinnerungen* · Haldane *Possible Worlds* · Atwood *Katzenauge* ·
Augé *Nicht-Orte* · Borges *Bibliothek von Babel* (Eröffnungssatz und
„unlimited but periodic") · Le Corbusier · Louis Kahn · Venturi · Lao Tzu
*Tao Te King* 81 · Mauss *Die Gabe* · Foucault *In Verteidigung der
Gesellschaft*.

**Ein vorbildlicher Fall:** „God is in the details." — *attributed to Ludwig
Mies van der Rohe, provenance disputed*. Das Epigraph nennt die Unsicherheit
selbst. So soll es aussehen, wenn ein reales Zitat stehen bleibt.

**Ein Sonderfall ohne Zuschreibung:** „We hold these truths to be self-evident:
that all men and women are created equal." Das ist die *Declaration of
Sentiments* (Seneca Falls, 1848) — echt, aber im Spiel ohne Quelle, sodass es
wie eine Erfindung der Welt liest. Umgekehrter Fehler: hier fehlt die
Zuschreibung, die anderswo zu viel behauptet.

---

## 6 · Die Ursache — sie stand wörtlich im Prompt

`backend/services/forge_lore_service.py`:

    Zeile  47   „Each section may optionally have an epigraph — a brief literary quote or motto."
    Zeile 527   „a unique arcanum, title, optional epigraph (real literary quotes), and body text."
    Zeile 121   „Literary quotes in epigraphs: use the established German translation
                 if it's a real quote, otherwise translate idiomatically."

Das Modell wurde ausdrücklich um **echte** literarische Zitate gebeten. Ein
Sprachmodell kann echt von erfunden nicht unterscheiden — es erzeugt
zitatFÖRMIGEN Text und hängt einen berühmten Namen darunter, weil das die
häufigste Form in seinem Training ist. Die Übersetzungszeile verschlimmerte es:
sie schickte den Übersetzer los, die „etablierte deutsche Fassung" eines Zitats
zu finden, das es womöglich nicht gibt — und ein Modell findet dann eine.

Dazu: **das Feld `epigraph` trug überhaupt keine Beschreibung.** Ohne Beschreibung
wählt das Modell die häufigste Form aus seinem Training.

## 7 · Was behoben ist

**Die Regel:** Die Welt darf sich selbst zitieren. Sie darf keinem echten
Menschen Worte in den Mund legen. Ein realer Denker bleibt als EINFLUSS nennbar
(`PhilosophicalAnchor.literary_influence`) — das ist ein Verweis, keine
Zuschreibung.

1. **Drei Prompt-Stellen umgeschrieben.** Das Epigraph ist jetzt ausdrücklich
   ein weltinterner Beleg (Bureau-Dokument, geborgenes Logbuch, Inschrift,
   Feldbericht, oder eine Figur DIESER Welt mit dem Dokument, in dem sie es
   sagte), und die Zuschreibung an eine reale Person ist verboten — mit
   Begründung im Prompt, nicht nur als Verbot.
2. **Das Feld hat eine Beschreibung.** Sie sagt, was STATTDESSEN zu schreiben ist.
3. **Ein Prüfer weist die gefährlichste Form ab** (`ForgeLoreSection`): eine
   Zuschreibung mit Jahreszahl in Klammern oder Paragraphenzeichen. Bewusst ENG
   — ein breiter Prüfer lässt die ganze Lore-Erzeugung scheitern, statt eine
   Zeile zu verbessern (dieselbe Abwägung wie bei `counted_list`).
   ⚠ Er weist damit auch ECHTE Zitate in dieser Form ab. Das ist Absicht: zur
   Erzeugungszeit kann niemand echt von erfunden unterscheiden, also wird die
   BEHAUPTUNG einer realen Fundstelle abgewiesen, nicht ihre Falschheit.
4. **`backend/tests/unit/test_epigraph_no_fabricated_citation.py`**, 11 Prüfungen.

## 8 · Was OFFEN ist — und eine Entscheidung braucht

**Die 46 Zuschreibungen auf Produktion stehen unverändert.** Der neue Prompt
wirkt erst auf neu erzeugte Lore.

Drei Wege, alle inhaltlich:

* **(a) Die drei nachgewiesenen korrigieren, den Rest stehen lassen.** Billig,
  aber die neun aus Abschnitt 3 bleiben ungeprüft im Werk.
* **(b) Alle 46 auf weltinterne Belege umschreiben.** Konsequent, und es passt
  besser zur Stimme: ein Shard, der das Bureau zitiert, ist mehr im Ton als
  einer, der Foucault zitiert. Kostet eine Migration und eine Runde Schreibarbeit.
* **(c) Die 46 einzeln von Hand prüfen und die belegten stehen lassen, mit
  Herkunftsangabe wie beim Mies-van-der-Rohe-Beispiel.** Am aufwendigsten, und
  das einzige Verfahren, das reale Zitate BEHÄLT, ohne etwas zu behaupten.

⚠ **Kein Weg darf automatisiert werden.** Ein Modell, das entscheidet, welche
Zitate echt sind, ist genau das Werkzeug, das den Fehler erzeugt hat.

---

## 9 · Maschinelle Prüfung gegen Volltexte (`scripts/verify_public_domain_quotes.py`)

Auf Wunsch gebaut, nachdem die Frage aufkam, ob ein billigeres Modell das
Faktenprüfen übernehmen kann. **Kann es nicht** — die Begründung steht im
Kopf des Skripts: ein Sprachmodell kann ein Zitat nicht prüfen, nur plausiblen
Text darüber erzeugen, und ein falsches „geprüft ✓" ist schlimmer als gar keine
Prüfung.

Was stattdessen geht: den **Volltext des angeblichen Werks laden und die
Zeichenkette suchen**. Das Ergebnis ist eine Fundstelle oder ihr belegtes
Fehlen — beides nachschlagbar. 🔑 **Belege, keine Verdikte.**

    GEFUNDEN                2      wortgleich im Volltext, mit Fundstelle
    NICHT GEFUNDEN          3
    SPRACHE                 2      Zitat englisch, Quelle im Original
    QUELLE PASST NICHT      1      Zuschreibung nennt kein Werk
    QUELLE NICHT ERREICHBAR 1
    KEINE QUELLE            9
    NICHT PRUEFBAR         36      nicht gemeinfrei — KEIN Urteil
    KEINE ZUSCHREIBUNG     45

### Belegt echt (Fundstelle im Volltext)

* „I am large, I contain multitudes." — Whitman, *Leaves of Grass*
  (Gutenberg 1322): *…very well then i contradict myself i am large i contain
  multitudes…*
* „The truth is rarely pure and never simple." — Wilde, *The Importance of Being
  Earnest* (Gutenberg 844): *…algernon the truth is rarely pure and never
  simple…*

### VIERTER FEHLER — vom Werkzeug gefunden, nicht von Hand

„In the beginning was the Word … He was in the beginning with God."
— *Gospel of John 1:1-2 (King James Version)*

Die King-James-Fassung lautet an dieser Stelle:

    1:1 In the beginning was the Word, and the Word was with God, and the Word was God.
    1:2 The same was in the beginning with God.

„**He** was in the beginning with God" ist NKJV/ESV, nicht KJV. Das Epigraph
nennt die Ausgabe ausdrücklich und zitiert eine andere. Dieselbe Klasse wie das
Wittgenstein-§19: eine präzise Angabe, die nicht stimmt.

### Unentschieden, und das ist die richtige Antwort

* **Blake** („The tree which moves some to tears of joy…") — alle Ankerwörter
  stehen im Gutenberg-Band, der Satz nicht wortgleich. Der Band enthält die
  **Briefe nicht**; das Zitat stammt aus einem Brief an Trusler. Nicht
  entscheidbar aus dieser Quelle.
* **Lao Tzu** — alle Ankerwörter da, nicht wortgleich: andere Übersetzung
  (Legge). Tao Te King 81 sagt sinngemäß dasselbe.
* **Kafka, Jarry** — Zitat englisch, Quelle deutsch bzw. französisch. Eine
  Zeichenkettensuche kann das nicht entscheiden; das Urteil bleibt beim
  Menschen. (Für Kafka steht es in Abschnitt 2 unabhängig fest.)
* **Wilde/Bürokratie** — die Zuschreibung nennt kein Werk, geprüft wurde
  *Earnest*. Ein Fehlen beweist dort nichts; der Beleg steht in Abschnitt 2.

### Drei Schwächen, die das Werkzeug an sich selbst offenlegte

Der erste Lauf meldete Zahlen, die drei Fehler enthielten — alle drei von der
Familie, die dieses Projekt den ganzen Tag verfolgt hat:

1. **Verszahlen.** „1:1 In the beginning…" liess den exakten Vergleich
   scheitern, obwohl der Satz dasteht. Ein Messgerät, das an der Zählung des
   Setzers scheitert, misst den Setzer.
2. **Ankerwörter über Sprachgrenzen.** Es suchte die englischen Wörter
   „skeleton" und „cupboard" im französischen *Ubu Roi* und meldete „nein". Das
   sah nach einem Befund aus und war eine Tautologie.
3. **Falsches Werk als Beleg.** Bei „Oscar Wilde" ohne Werksangabe fiel es auf
   *Earnest* zurück und meldete „nicht gefunden" — das beantwortet eine andere
   Frage als die gestellte. Jetzt heisst dieser Fall QUELLE PASST NICHT.
