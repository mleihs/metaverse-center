# Piktogramm-Prompts — Kampffähigkeiten und Epoch-Steuerung

34 Symbole: **19 Dungeon-Fähigkeiten** und **15 Epoch-Marken** (6 Operativtypen,
3 Zonenaktionen, 2 Resonanz-Operationen, 4 Epochenphasen).

Diese Piktogramme stehen **auf** den Knöpfen. Der erklärende Text existiert
bereits zweisprachig im Content-Pack (`content/dungeon/abilities/*.yaml`,
`description_en` / `description_de`) — er wird nicht generiert und nicht ersetzt.

---

## Warum diese Designlinie

Die naheliegende Referenz wäre Failbetter (Fallen London / Sunless Sea), und der
`sunless-sea`-Theme existiert im Projekt bereits. Als Oberfläche trägt sie hier
trotzdem nicht, aus zwei nachprüfbaren Gründen:

1. **Maßstab.** Failbetters Kunst ist handgemalt, texturiert, vollfarbig und wird
   groß gezeigt. Unsere Symbole sitzen bei 22–28 CSS-px in der Kampfleiste. Die
   Iconografie-Praxis ist dazu eindeutig: ein Symbol mit drei oder mehr Farben
   ist eine Illustration, kein Symbol, und Detail, das bei 64 px trägt, wird bei
   24 px zu Brei.
2. **Zehn Themes.** `sunless-sea` ist EIN Preset von zehn — daneben stehen
   `cyberpunk`, `solarpunk`, `vbdos`, `deep-fried-horror`. Ein gemalter
   viktorianischer Messington wäre in sieben davon ein Fremdkörper.

**Übernommen wird das Tragende, nicht die Oberfläche.** Failbetter benennt seine
eigene Grundlage selbst: der starke Gebrauch der Silhouette, inspiriert von
**Jan Pieńkowski** — polnischer Scherenschnitt (*wycinanki*). Pieńkowskis Stil
entstand daraus, dass er mit gezeichneten Gesichtern unzufrieden war und sie
kurzerhand ganz ausfüllte. Die gesamte Bedeutung wandert damit in die **Kante**.

Das ist zugleich:
- die Technik, die bei 24 px überlebt,
- die Technik, die sich sauber freistellen lässt,
- und die Technik, die **einfarbig** ist — womit das Asset als CSS-`mask-image`
  taugt: Form aus der Datei, **Farbe aus den Design-Tokens**. Ein Satz von 34
  Assets ist damit in allen zehn Themes richtig, und die Einfärbung nach Wirkung
  (Schaden / Stress / Schild / Schwächung / Utility) kostet keine einzige weitere
  Datei. „Wie aus einem Guss" wird so konstruktiv erzwungen statt erhofft.

---

## Arbeitsweise

1. **KEINE Referenzbilder.** Belegt bei der Gegner-Produktion: die beiden Gruppen
   mit Referenz sind zu Motivgleichheit kollabiert, die ohne Referenz ist die
   geschlossenste geworden. Ein präziser Stilblock hält die Serie besser zusammen
   als ein Referenzbild — und erzwingt keine Motivgleichheit.
2. **Export als PNG, benannt exakt nach der `id`** in der Klammer
   (z. B. `spy_counter_intel.png`). Der Name ist der Vertrag zum Code.
3. **Kein lesbarer Text im Bild.** Das Spiel ist zweisprachig; eingebackene
   Schrift wäre auch fehlerfrei gesetzt ein Lokalisierungsfehler.
4. Alles in EINEN Ordner. Freistellen mit `scripts/key_dungeon_enemy_art.py`
   (dieselbe Magenta-Kette wie bei den Gegnern), danach Prüfung — siehe unten.
5. **Die Abnahme erfolgt bei 24 px auf Schwarz, nicht bei 100 %.** Ein Symbol,
   das erst vergrößert lesbar ist, ist durchgefallen. Zweite Probe: das Symbol
   allein als schwarze Form auf Weiß — wenn es dort nicht erkennbar ist, liegt
   die Bedeutung nicht in der Kante und der Prompt muss zurück.

---

## ⚠️ Die Mechanik ist die Bildbeschreibung, nicht die Prosa

Bei den Gegnern war die Falle, dass `description_en` Spielprosa ist. Hier ist es
umgekehrt und schärfer: die Beschreibung ist **Regeltext** („−15 Ausweichen für
2 Runden"). Regeln sind nicht malbar. Die Motivzeilen unten sind daraus
abgeleitete **Bildideen** — Wirkung identisch, aber schneidbar. Die YAML bleibt
unangetastet.

### Gemessen an den ersten acht Generierungen

`scripts/check_pictograms.py <ordner>` misst Deckung, Schnittbreite und Rand und
legt einen Kontaktbogen bei 24/32/48/96 px an. Erster Durchlauf: **2 von 8
bestanden.** Die Zahlen:

| | Deckung | Aussparung @24px | Befund |
|---|---|---|---|
| Grundangriff | 39 % | 0,70 px | zu massiv, Schnitte zu eng |
| Präzisionsschlag | 22 % | 0,97 px | Schnitte zu eng |
| Schwäche ausnutzen | 43 % | 1,37 px | zu massiv |
| Hinterhaltschlag | 34 % | 3,25 px | **bestanden** |
| Hinterrücksangriff | 32 % | 1,65 px | **bestanden** |
| Stören | 45 % | 0,93 px | zu massiv, Schnitte zu eng |
| Detonieren | 43 % | 1,04 px | zu massiv, Schnitte zu eng |
| Demoralisieren | 29 % | 0,70 px | Schnitte zu eng |

Drei Lehren, alle in den technischen Block eingearbeitet:

1. **Die Deckung sagt das Versagen voraus, nicht das Motiv.** Über ~36 % erstickt
   die Form ihre eigenen Schnitte. Deshalb jetzt eine Obergrenze im Prompt.
2. **Die Mindeststärke muss für das NEGATIVE gelten.** Ich hatte sie nur für die
   Form vorgeschrieben. Bei wycinanki trägt der Schnitt die Bedeutung — vier
   Fingerschlitze von 2,4 % Rahmenbreite sind bei 24 px 0,57 px und schließen
   sich.
3. **Viele schmale Teile statt weniger breiter.** „Strahlen", „Ticks",
   „Finger" erzeugen Kämme aus Splittern. Wenige große Teile fordern.

### Und eine Lehre, die keine Zahl zeigt: das Motiv kippt

Drei der acht sind technisch brauchbar und zeigen trotzdem das Falsche. Der
Hinterhaltschlag wurde ein **Vorhängeschloss**, Detonieren eine **Lampe**,
Schwachstelle analysieren ein **Kranz**. Immer dieselbe Mechanik: meine
Motivzeile beschrieb eine KOMPOSITION („X tritt hinter Y hervor", „Ring mit vier
Ticks über einem Riss"), und das Modell löste die Komposition in den nächsten
vertrauten Einzelgegenstand auf.

Gegenmittel, aus der Gegner-Produktion übernommen: **die Fehllesart benennen.**
Dort war es „Bauwerk immer explizit ausschließen". Hier steht in jeder Motivzeile
ein „not a …". Ausserdem: EINE Hauptmasse und höchstens eine zweite, nie ein
Arrangement aus dreien.

Vier wiederkehrende Fallen, gegen die der technische Block ausdrücklich arbeitet:

- **Die Szene.** „Falle legen" erzeugt ohne Verbot einen ganzen Korridor mit
  Falle. Es ist immer genau EIN Gegenstand, nie ein Ort.
- **Das Gesicht.** „Provokation", „Demoralisieren" ziehen Figuren mit Gesichtern
  an. Ein Gesicht bei 24 px ist ein Fleck. Wo eine Gestalt nötig ist, ist sie
  eine geschlossene Form ohne Züge — genau Pieńkowskis Griff.
- **Die Kontur statt der Fläche.** Modelle liefern gern dünne Umrisszeichnungen.
  Die verschwinden beim Verkleinern. Es wird gefüllt, nicht umrandet.
- **Der Rahmen.** Modelle setzen Symbole gern in einen Kreis oder ein Wappen.
  Das frisst die Fläche und kollidiert mit dem Knopf, in dem das Symbol sitzt.

---

## Stilblock — in JEDEN Prompt

```
A single flat pictogram in the tradition of Polish wycinanki paper-cutting: the whole meaning lives in the OUTLINE, the way a shape cut from black paper carries a subject without a single interior line. Bold, blunt, deliberately hand-cut rather than machine-precise, with the slight irregularity of scissors on paper.
The shape is ONE SOLID SILHOUETTE in matte off-white, hex #EFE9DE, completely filled, with no interior lines, no shading, no gradient, no texture, no highlights and no modelling of any kind. Detail exists only where the edge is notched, pierced or cut away — never as a mark drawn inside the shape.
```

## Technischer Block — an JEDEN Prompt anhängen

```
Square 1:1 framing. The pictogram is centred, its bounding box occupies about 78% of the frame, and there is an even empty margin on all four sides.
The pictogram must be AIRY, not a slab: the off-white shape covers at most about a third of the picture, and magenta reads through and around it. A subject drawn as one broad solid mass leaves no room for the cuts that carry its meaning.
Flat pure magenta background, hex #FF00FF, absolutely uniform, no gradient, no vignette, no shadow, no ground plane.
Exactly ONE pictogram. No frame, no circle, no badge, no shield-shape or cartouche around it, no border, no decorative flourish beside it.
It must be FILLED, never an outline drawing: no line art, no stroke-only rendering, no wireframe.
Flat and graphic only: no perspective, no depth, no 3D, no bevel, no emboss, no glow, no reflection, no paper texture, no grain.
Build the subject from FEW LARGE PARTS. Never a fan, spray or comb of many narrow slivers — three or four broad elements, not ten thin ones.
Every part of the shape is at least one tenth of the frame thick, AND every magenta gap — every slot, notch, hole or space cut into the shape or left between its parts — is at least one sixteenth of the frame wide. A cut narrower than that closes up when the pictogram is shown small and the shape collapses into a blob. Prefer FEW WIDE cuts over many narrow ones. No hairlines, no thin whiskers, no small detached specks or dots — anything separated from the main mass must be a substantial shape with clear space around it, and there must be at most two such pieces.
No text, no letters, no numerals, no runes, no logo, no watermark.
No faces, no facial features, no eyes on figures — where a human form is needed it is a featureless closed silhouette.
Not painterly, not textured, not sketchy, not cross-hatched, not engraved, not woodcut, not cel-shaded, not glossy. Two tones only: the off-white shape and the magenta ground.
```

---

# A · Dungeon-Kampffähigkeiten (19)

Die drei Gruppen entsprechen den Clustern der Kampfkonsole (Schlag / Beistand /
Deckung). Die Silhouetten sind bewusst so gewählt, dass sich innerhalb einer
Gruppe keine zwei Umrisse ähneln.

## Schlag — gegen Feinde (10)

### Grundangriff (`basic_attack`)
```
Subject: a clenched fist, seen from the knuckles, blunt and heavy. The plainest possible mark of a strike — no weapon, no ornament. The fingers are suggested by exactly TWO deep wide notches cut into the lower edge, never four narrow slots.
```

> Erste Fassung („no weapon, no ornament" ohne die Notch-Vorgabe) lieferte vier
> Fingerschlitze von median 2,4 % Rahmenbreite — bei 24 px sind das 0,57 px, die
> Faust wird zum Klumpen. Gemessen, nicht geschätzt. Falls auch zwei Kerben nicht
> tragen: Motiv auf **einen massiven Hammerkopf im Profil** wechseln, ganz ohne
> innere Schnitte.

### Präzisionsschlag (`assassin_precision_strike`)
```
Subject: a long needle passing cleanly through a small ring, the ring cut open around the needle. Accuracy, not force.
```

### Schwäche ausnutzen (`assassin_exploit`)
```
Subject: a thick wedge driven into a jagged split, the split widening away from it. The wedge is one solid mass with the crack cut out of it.
```

### Hinterhaltschlag (`assassin_ambush_strike`)
```
Subject: a broad blade emerging point-first from behind a heavy curved edge, as if from an opening. Only the front half of the blade is clear of the edge.
```

### Hinterrücksangriff (`infiltrator_backstab`)
```
Subject: a thick arrow curving around the side of a solid block and striking it from behind. The arrow and the block are separate masses with clear space between them.
```

### Stören (`saboteur_disrupt`)
```
Subject: two heavy chain links, the one between them snapped open, its two broken ends bent apart.
```

### Detonieren (`saboteur_detonate`)
```
Subject: a squat cylindrical charge with a burst of short blunt rays radiating from it in every direction. The rays are thick wedges joined to the body, never thin spikes.
```

### Demoralisieren (`propagandist_demoralize`)
```
Subject: a theatre mask with the mouth turned down, split by a single wide crack from brow to chin. The crack is cut through the shape. No eyes, no features beyond the mouth and the crack.
```

### Schwachstelle analysieren (`spy_analyze_weakness`)
```
Subject: a heavy ring with four thick ticks pointing inward, centred over a jagged fracture. The fracture is cut out of the shape inside the ring.
```

### Spionageabwehr (`spy_counter_intel`)
```
Subject: a flat open palm, fingers up, held against the point of a thick arrow descending onto it. The arrow stops at the palm and does not pass through. This must read as a blow being stopped before it lands.
```

## Beistand — für Verbündete (3)

### Schild (`guardian_shield`)
```
Subject: a heavy kite shield, broad at the top and tapering to a point, with a single thick notch cut into its upper edge.
```

### Inspirieren (`propagandist_inspire`)
```
Subject: a single broad flame rising out of a cupped open hand. Flame and hand are one connected mass.
```

### Sammeln (`propagandist_rally`)
```
Subject: three thick blunt chevrons pointing inward from three sides toward a solid disc at the centre. The chevrons are separate from the disc with clear space between.
```

## Deckung — auf sich selbst (6)

### Beobachten (`spy_observe`)
```
Subject: a wide open eye, the pupil cut out of it as a clean hole. Nothing around it — no lashes, no brow, no rays.
```

### Provokation (`guardian_taunt`)
```
Subject: a heavy hand bell, tilted, with two thick curved arcs on either side to show it ringing. The arcs are solid crescents, not thin lines.
```

### Befestigen (`guardian_fortify`)
```
Subject: a thick upright wall slab with two heavy diagonal braces propped against it from one side. All three parts joined into one mass.
```

### Falle legen (`saboteur_trap`)
```
Subject: a sprung jaw trap seen from the side, its two toothed halves open wide. The teeth are broad triangular cuts in the edge, never fine points.
```

### Ausweichen (`infiltrator_evade`)
```
Subject: one featureless standing figure, and beside it a second copy of the same silhouette shifted sideways, as though the body had stepped out of its own place. Two separate solid shapes, clearly apart, the same outline twice.
```

### Verstärken (`guardian_reinforce`)
```
Subject: a thick column with a heavy band clamped around its middle. Only used in the Tower archetype, so the column reads as load-bearing masonry.
```

---

# B · Epoch-Steuerung (15)

## Operativtypen (6)

Diese sechs erscheinen auch in der Agentenübersicht und im Einsatzdialog. Sie
dürfen sich **nicht** mit den Dungeon-Fähigkeiten derselben Schule verwechseln
lassen — die Motive sind deshalb bewusst anders gewählt als bei `spy_observe`
oder `guardian_shield`.

### Spion (`op_spy`)
```
Subject: a keyhole — a circle above a tapering slot, cut as one hole out of a solid rounded plate.
```

### Wächter (`op_guardian`)
```
Subject: a portcullis: a heavy gate grid of thick vertical and horizontal bars, the openings cut out between them, with pointed lower ends.
```

### Saboteur (`op_saboteur`)
```
Subject: a squat charge with a single thick fuse curling up from its top. The fuse is a broad ribbon, never a thin line.
```

### Propagandist (`op_propagandist`)
```
Subject: a horn-shaped megaphone in profile, wide mouth to the right, held by a short thick handle.
```

### Infiltrator (`op_infiltrator`)
```
Subject: a hand reaching through a rectangular gap cut into a thick wall slab. The wall is the solid mass; the gap and the space around the wrist are cut away.
```

### Assassine (`op_assassin`)
```
Subject: a stiletto pointing straight down, narrow blade and a broad crossguard. Nothing else.
```

## Zonenaktionen (3)

### Befestigen (`zone_fortify`)
```
Subject: a crenellated wall section seen from the front, with a single thick arrow pointing up out of its centre. Wall and arrow joined as one mass.
```

### Quarantäne (`zone_quarantine`)
```
Subject: a heavy closed ring with a solid disc held at its centre, the gap between ring and disc cut clean away. Containment, nothing escaping.
```

### Ressourcen verlegen (`zone_deploy_resources`)
```
Subject: a squat crate seen from the front with a thick arrow pointing down into it. Crate and arrow joined as one mass.
```

## Resonanz-Operationen (2)

### Wellenritt (`resonance_surge_riding`)
```
Subject: a single heavy wave crest curling to the right, with one small featureless standing figure balanced on its shoulder. Two masses, clearly separated.
```

### Substrat-Anzapfung (`resonance_substrate_tap`)
```
Subject: a thick spigot set into the edge of three stacked horizontal ground layers, with one broad drop falling from its mouth. The layers are solid bands with the seams cut between them.
```

## Epochenphasen (4)

Diese vier stehen in der Kopfleiste und werden ständig gelesen. Sie müssen als
Folge erkennbar sein — vom Setzen über den Streit zur Abrechnung.

### Gründung (`phase_foundation`)
```
Subject: a single large cornerstone block, squared and heavy, sitting flat with one chamfered upper edge.
```

### Wettstreit (`phase_competition`)
```
Subject: two pennants on short staffs, crossed in an X, their tails cut into swallow tails.
```

### Abrechnung (`phase_reckoning`)
```
Subject: a balance scale: a heavy vertical post, a broad beam across its top, and two solid pans hanging level from the beam ends.
```

### Abgeschlossen (`phase_completed`)
```
Subject: a wax seal disc pressed flat, with a thick notched rim and one deep straight groove struck across its face. The groove is cut through.
```

---

## Nach dem Generieren

1. Freistellen wie bei den Gegnern (Magenta-Kette), Ergebnis ist eine
   weiße Form auf Transparenz.
2. **Abnahme bei 24 px auf Schwarz.** Und zweitens als schwarze Form auf Weiß —
   wenn die Bedeutung dort verschwindet, sitzt sie nicht in der Kante.
3. Innerhalb jeder Gruppe **die Umrisse nebeneinanderlegen**. Zwei Symbole, die
   sich in der Silhouette ähneln, sind ein Fehler der Serie, nicht des einzelnen
   Bildes — dann wird EIN Motiv getauscht, nicht beide nachgebessert.
4. Einbindung als `mask-image`, Farbe aus den Tokens. Erst dadurch trägt die
   Serie durch alle zehn Themes.

## Bewusst nicht generiert

Die Ereignistypen des Kampfprotokolls (`operative_deployed`, `mission_success`,
`detected`, `captured`, `betrayal`, …) bekommen **keine** eigenen Piktogramme.
Sie werden gelesen, nicht gewählt; dafür genügen die vorhandenen Strichsymbole
aus `utils/icons.ts` plus Farbe. Fünfzehn weitere Sonderanfertigungen für ein
Protokoll wären Überproduktion.
