# Dungeon durchspielen — Befunde und offene Fragen (2026-08-31)

Grafisches Interface, Prod (`velg-release 0ec36a0`), Welt „Die Verwandlung der
Erinnerung", Archetyp **Der Schatten**, Schwierigkeit 3, Tiefe 6, Gruppe von vier.
Alle Punkte am Bildschirm gesehen oder im Code nachgemessen — keine Vermutungen.

---

## A. Fragen des Nutzers (offen)

- [ ] **A1 — Glow um die Gegner.** Der Schein um die Gegner beschädigt das
Artwork. Andere Präsentation entwerfen. Betrifft die Gegner-Sprites
      auf der Bühne im Kampf. Vor der Umsetzung `velg-frontend-design` laden.
- [ ] **A2 — Was passiert, wenn ein Agent stirbt?** Teilantwort aus dem Code:
      es gibt keinen Tod, sondern eine Zustandsleiter
      `operational → stressed → wounded → afflicted → captured`
      (`backend/services/combat/condition_tracks.py`). Ein Treffer verschiebt
      höchstens zwei Stufen (kein One-Shot). `captured` = aus dem Kampf entfernt.
      **Noch zu klären:** was nach dem Lauf mit einem `captured` Agenten geschieht
      (dauerhaft verloren? Genesung am Rastplatz? nur Lauf-lokal?), und was der
      Spieler davon zu sehen bekommt.

## B. Am Bildschirm gefunden — Fehler

- [ ] **B1 — Die Handlungsmarken überleben die Runde.** `DungeonStateManager.ts:370`
      leert `selectedActions` nur, wenn die Phase `combat_planning` VERLÄSST. Die
      nächste Runde ist wieder `combat_planning`, also bleibt der Plan der letzten
      Runde stehen: Marken über den Agenten, Zähler „4/4" ohne eine einzige Wahl,
      Befehle gegen Gegner, die schon liegen. Der Kommentar direkt daneben
      formuliert die Absicht bereits („An aim must not outlive the phase it was
      taken in") — die Bedingung deckt nur die Rundengrenze nicht ab.
      Anker für den Fix ist vorhanden: `combat.round` (`types/dungeon.ts:654`).
      ⚠ Folgefehler: „AUSFÜHREN" sah tot aus, weil es den Altbestand abschickte
      und der sofort wieder dastand.
- [ ] **B2 — HTML-Entities im deutschen Text.** Auf der Bühne steht wörtlich
      `Tippe "move &lt;room&gt;" zum Bewegen.` **83 deutsche Zeichenketten**
      tragen `&lt;` / `&gt;` / `&amp;` als Klartext (`src/locales/generated/de.ts`).
      Nur Deutsch betroffen — Englisch liefert das Quellstring direkt.
- [ ] **B3 — Terminal-Anweisungen im grafischen Modus.** Die Chronik sagt
      `Tippe "interact <number>"`, `"attack <agent> <ability>"`, `"map"` — im
      grafischen Interface, wo es keine Eingabezeile gibt.
- [ ] **B4 — Unübersetzte Zeichenketten im Kampfprotokoll.**
      `[AUTO] Timer expired. Actions submitted.` steht als rohes Literal in
      `services/DungeonStateManager.ts:683`, nicht in `msg()`. Ebenso
      `Dungeon run ended. Returning to lobby.` (512) und
      `Dungeon run expired. …` (528) sowie die Eignungs-Legende in
      `utils/dungeon-formatters.ts:1686`.
- [ ] **B5 — `Zustand: wounded`.** Der Zustandswert im Protokoll bleibt englisch,
      während dieselbe Größe in der Gruppenspalte („Verwundet") und in der
      Zielliste („(verwundet)") übersetzt ist.
- [ ] **B6 — Die Pfadbuchstaben sind keine Reihe.** Die Wegmarken sind als
      α/β/γ geschrieben (`DungeonQuickActions.ts:711`), aber `.action-btn` trägt
      `text-transform: uppercase`. Gerendert wird Α/Β/Γ (U+0391/0392/0393) —
      und Alpha und Beta sind von lateinischem A und B nicht zu unterscheiden.
      Der Spieler liest „A, B, Γ".
- [ ] **B7 — Fähigkeitskacheln schneiden deutsche Namen ab.**
      „SCHWACH-STELLE…" und „HINTER-RÜCKSAN…" sind mit Auslassungspunkten
      abgeschnitten; „SPIONAGEAB-WEHR", „DEMORALI-SIEREN", „GRUNDAN-GRIFF"
      brechen mitten im Wort.
- [ ] **B8 — Das Raster ordnet sich zwischen Agenten und Runden um.** Dieselbe
      Bildschirmstelle ist je nach Agent und Abklingzeit eine andere Fähigkeit.

## C. Am Bildschirm gefunden — Zweifelhaft, zu entscheiden

- [ ] **C1 — Leere Lobby lügt den Gast an.** Ohne Anmeldung zeigt der Reiter
      „Keine Dungeon-Archetypen in dieser Simulation erkannt." Der wahre Grund ist
      fehlende Anmeldung: es gibt keinen öffentlichen Endpunkt für die verfügbaren
      Archetypen. `DungeonTerminalView.ts:730` kennt nur drei Zustände
      (lädt / Liste / keine) und keinen vierten für „nicht angemeldet".
      Der Hinweis darunter rät zu einer Handlung, die ein Gast nicht ausführen kann.
- [ ] **C2 — Ergebnis steht nur in der Chronik.** Nach einer Entscheidung zeigt
      die grosse Bühne weiter die Ausgangslage; was daraus wurde, steht nur in der
      schmalen Spalte rechts.
- [ ] **C3 — „Automatisch wählen" füllt 3 von 4.** Die Heuristik nimmt die besten
      drei (`autoPickPartyIds`), der Zähler sagt danach „Gruppe: 3/4".
- [ ] **C4 — Anforderung und Probe sehen gleich aus.** „propagandist 6" (wer würfelt)
      und „ASSASSIN 3" (was verlangt ist) stehen in derselben Zeile; unterschieden
      werden sie nur durch Farbe und ein fehlendes Porträt.

## D. Im Content gefunden (statisch gemessen)

- [ ] **D1 — Sechs Zeilen sind nie übersetzt worden.** `text_en` enthält deutschen
      Text: `overthrow/ob_10, ob_20, ob_23, ob_25, ob_27` und `deluge/db_22`.
      Die Nachbarzeilen sind sauber englisch, es ist also kein Stilmittel.
      (`entropy/eb_09` = „." und `entropy` Anker-Höhepunkt „Name." sind dagegen
      gewollter Zerfall — nicht anfassen.)
- [ ] **D2 — 110 von 302 Banter-Zeilen tragen einen `personality_filter`,
      den nichts liest.** `select_banter` nimmt `agents` entgegen und verwendet den
      Parameter im Rumpf **null Mal** (per AST gemessen); gefiltert wird nur nach
      Auslöser, Tiefe und Stufe. Der eigene Docstring behauptet „personality match".
      Nebenbefund: zwei Vokabulare im Content (`conscientiousness` neben
      `conscientiousness_high`) und vier Zeilen mit `opinion_*_pair`.
- [ ] **D3 — `{agent_a}` / `{agent_b}` werden nur bei ≥ 2 handlungsfähigen Agenten
      ersetzt** (`dungeon_banter.py`). 34 Vorkommen. Bei einem einzigen noch
      handlungsfähigen Agenten steht der Platzhalter wörtlich da — genau der Fehler,
      der für `{agent}` schon einmal repariert wurde.
- [ ] **D4 — Räume ohne eigene Prosa.** Über 400 erzeugte Dungeons je Kombination
      gemessen: **4,9 % aller Räume** treten in einen Kampf ohne eigene
      Beschreibung (Rückfall auf die Raumart-Stimmung), **0,9 %** räumen sich
      still leer. Ursache: das Erzeugungsraster setzt Elite-Räume ab Tiefe 2, die
      einzige Elite-Vorlage jedes Archetyps beginnt aber bei Tiefe 3 oder 4.
      Spitzenwerte: Turm/Schatten Schwierigkeit 5 ≈ 2 Räume je Lauf ohne Prosa,
      Entropie Schwierigkeit 5 ≈ 1,2 Räume je Lauf, die sich leer räumen.
- [ ] **D5 — Was das eigene Prüfwerkzeug schon meldet und niemand geräumt hat:**
      `awakening_the_repressed` und `deluge_the_current` stehen in keiner
      Spawn-Liste (nicht bekämpfbar), `prometheus_guardian_elite_spawn` wird von
      keinem Encounter gerufen, und sechs Auslöser (`incorporation`, `new_regime`,
      `revolution`, `schism`, `total_fracture`, `whispers`) feuern ins Leere.
- [ ] **D6 — Eine schiefe Übersetzung, stellvertretend für die Klasse.**
      „Some contents spill and dissolve" → „Einige Inhalte **verschütten sich**"
      (`shadow/encounters.yaml:562`). Am Bildschirm gesehen.
- [ ] **D7 — 41 Geviertstriche (U+2014) im Content**, fast alle in `overthrow`,
      während das Haus überall sonst den Halbgeviertstrich setzt.

## E. Weltdaten, nicht Code

- [ ] **E1 — Alle sechs Agenten dieser Welt sind mechanisch identisch**
      (SPY/GRD/SAB/PRP/INF/ASN je 6, Abzeichen „GRUNDWERT"). Damit ist die
      Gruppenaufstellung eine Wahl ohne Unterschied, jede Eignungsprobe würfelt
      für jeden gleich, und „wer macht das" nennt immer denselben Namen.
      Die Oberfläche ist hier ehrlich — die Daten fehlen.

---

## Was noch zu spielen ist

- [ ] Schwelle (`threshold`) und Bossraum
- [ ] Beuteverteilung nach dem Kampf
- [ ] Rastplatz
- [ ] Rückzug (Halten-Knopf)
- [ ] Ein zweiter Archetyp zum Vergleich

---

# Zweiter Teil — zwei Läufe vollständig gespielt (grafisches Interface)

**Lauf 1: Der Schatten**, Schwierigkeit 3, Tiefe 6, vier Agenten. Boss „Der Überrest"
gefallen. Register: „ABSTIEG VOLLENDET, Tiefe 7/6, 6/12 Räume, 23 Min."
**Lauf 2: Der Turm**, gleiche Gruppe. Boss „Relikt des Handels" gefallen,
Integrität von 100 auf 43 gefallen, zwei Agenten unterwegs verloren.

## Neue Befunde aus dem Spielen

- [ ] **B9 — Nach dem Bosssieg hängt der Lauf.** Turm-Lauf: Bossknoten grün, Kampf
      aufgelöst — und die Aktionsleiste bietet nur noch STATUS / PROTOKOLL / RÜCKZUG.
      Kein Weiter, keine Beuteverteilung, kein Abschluss. **Überlebt ein Neuladen**
      der Seite. Der einzige Ausweg ist Rückzug — aus einem gewonnenen Dungeon.
      Die Chronik steht dabei auf „KAMPF – Runde 6/10", die Kampfleiste ist aber
      nicht mehr gemountet (`velg-dungeon-combat-bar` fehlt im Schattenbaum).
- [ ] **B10 — Beutenamen englisch.** Beim Verteilen steht „SHADOW ATTUNEMENT" und
      „SHADOW MEMORY", obwohl `content/dungeon/archetypes/shadow/loot.yaml`
      `name_de: Schatteneinstimmung` führt. Die Verteil-Leiste nimmt `name_en`.
- [ ] **B11 — Die Nachbesprechung fällt aus dem grafischen Modus.** Nach
      „Verteilung bestätigen" füllt ein roher Terminal-Abzug („DEBRIEF TERMINAL")
      den ganzen Bildschirm, inklusive `Tippe "assign &lt;#&gt; &lt;agent_name&gt;"`
      und `Tippe "confirm" zum Abschließen` — Anweisungen ohne Eingabezeile.
- [ ] **B12 — Ein gewonnener Lauf wurde „ZURÜCKGEZOGEN" genannt.** Schatten-Lauf:
      Abschlussfenster „ABSTIEG BEENDET / ZURÜCKGEZOGEN / Die Gruppe ging früher
      und behielt, was sie bereits genommen hatte" — während das Expeditionsregister
      auf derselben Seite „ABSTIEG VOLLENDET" meldet. Zwei Quellen, ein Lauf.
- [ ] **B13 — AUSFÜHREN ist ein Halte-Knopf ohne Hinweis darauf.** In der
      kompakten (grafischen) Ansicht ist der Rundenabschluss bewusst ein Halten
      von 600 ms (`DungeonCombatBar.ts:1455` — „a mis-click next to the ability
      grid costs a whole round"). Die Beschriftung sagt aber nur „AUSFÜHREN · 4/4";
      `holdingLabel` erscheint erst, wenn man schon hält. Ich habe als Spieler
      mehrfach geklickt und geglaubt, der Knopf sei tot. Gleiches gilt für Rückzug.
- [ ] **B14 — Ein gefangener Agent verschwindet kommentarlos.** Isolde fiel im
      Schatten-Bosskampf auf `captured` und war schlicht nicht mehr in der Reihe —
      keine Meldung auf der Bühne, kein Übergang. Nur das Protokoll nennt es,
      und dort unübersetzt („Zustand: captured"), während die Gruppenspalte
      korrekt „Gefangen" schreibt. **`captured` gilt nur für den Lauf** — im
      nächsten Lauf war sie wieder wählbar. (Antwort auf Frage A2.)
- [ ] **B15 — Am Rastplatz sind zwei von drei Optionen unerreichbar.** Die Chronik
      bietet [1] Rasten, [2] Wächter aufstellen (Guardian 3), [3] Saboteur-Bewertung
      (Saboteur 3). Die Aktionsleiste zeigt **einen** Knopf: „ALLE RASTEN".
      `DungeonQuickActions.ts:515–519` rendert für `case 'rest'` genau diesen einen
      Knopf; die Wahlmöglichkeiten werden nicht als Knöpfe ausgegeben.
- [ ] **B16 — Die Aktions-Marken überdecken die Gegner-Beschriftung.** Die Reihe
      der geplanten Befehle liegt genau auf der Namenszeile der Gegner.

## Balance-Beobachtungen (gemessen, nicht geschätzt)

- **Ganze Runden ohne einen Treffer.** Turm, Runde 1 und Runde 3: jeweils
  4 von 4 Angriffen daneben. Bei Grundwert-Eignungen (alle 6) fühlt sich das
  wie ein Münzwurf ohne Gegenmittel an.
- **Der Bosskampf ist tatsächlich knifflig** — beide Läufe kosteten je einen
  bis zwei Agenten. Die Zustandsleiter greift: Heilung im Kampf gibt es per
  Design nicht, also entscheidet Vorbeugung (Ausweichen, Schild, Verstärken).
- **Verstärken wirkt sichtbar**: „+10 Stabilität (95 → 100)". Ohne es fiel die
  Integrität im Turm von 100 auf 43.

## Was gut ist und nicht angefasst gehört

- Die Prosa an der Schwelle und in der Bosskammer trägt.
- Die vierschichtige Raumbeschreibung (Anker kursiv, Raumart-Stimmung, Encounter,
  Barometer gedimmt) liest sich als EIN Text, nicht als vier Felder.
- Der sichtbare Wurf (35 +28 = 63, TEILERFOLG 83 %) macht die Probe nachvollziehbar.
- Die Nachkampf-Zeilen feuern: „Geteiltes Risiko, geteilte Vollendung."
- Die Archetypen fühlen sich verschieden an: Sicht beim Schatten, Integrität und
  gesperrter Rückzug beim Turm, eigene Kulisse und eigene Fähigkeit je Welt.
