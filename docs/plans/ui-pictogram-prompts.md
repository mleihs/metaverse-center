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

### Der technische Block widerspricht sich bei kompakten Vollformen

Nachgerechnet beim zweiten Schild-Anlauf (46 % Deckung): die zwei Vorgaben
„Bounding-Box füllt 78 % in BEIDEN Richtungen" und „die Form deckt höchstens ein
Drittel des Bildes" sind für eine **konvexe Einzelmasse** zusammen unerfüllbar.
0,78 × 0,78 sind bereits 61 % des Rahmens; ein Schild oder ein Block füllt davon
gut vier Fünftel, also rund 46 %. Kein Prompt kann das auflösen.

Alle zehn abgenommenen Symbole der Schlag-Gruppe sind deshalb entweder zwei
getrennte Massen oder haben eine große Öffnung — keins ist eine kompakte
Vollform. Das war Zufall der Motivwahl, nicht Absicht, und ist jetzt eine
Auswahlregel: **ein Motiv, das sich nur als geschlossene konvexe Fläche denken
lässt, ist für diesen Satz ungeeignet.** Entweder es zerfällt in zwei Massen,
oder es bekommt eine Öffnung, die größer ist als jede seiner Teilflächen. Der
Block bleibt unverändert; die Motivzeile trägt die Last.

### Und eine Lehre, die keine Zahl zeigt: das Motiv kippt

Drei der acht sind technisch brauchbar und zeigen trotzdem das Falsche. Der
Hinterhaltschlag wurde ein **Vorhängeschloss**, Detonieren eine **Lampe**,
Schwachstelle analysieren ein **Kranz**. Immer dieselbe Mechanik: meine
Motivzeile beschrieb eine KOMPOSITION („X tritt hinter Y hervor", „Ring mit vier
Ticks über einem Riss"), und das Modell löste die Komposition in den nächsten
vertrauten Einzelgegenstand auf.

### Das Substantiv baut die Form; Verbote bauen sie nicht ab

Dreimal in einer Sitzung dieselbe Mechanik, und die Verbote waren jedes Mal
schon da:

- „kite shield … notch in its upper edge … tapering to a point" gegen
  *not a heart* → ein **Herz**.
- „three tongues … the middle only a little taller … on a stub" gegen
  *not a trident* → ein **Dreizack**.
- „standing figure … head … body … foot" gegen *NO arms, NO legs, NO hands,
  NO feet* → ein **Mensch mit Armen und Beinen**, mit der längsten Verbotsliste
  des ganzen Dokuments.

Ein Verbot kann eine Form nur ablehnen, nicht ersetzen. Wenn die positive
Beschreibung die Fehllesart geometrisch **konstruiert**, gewinnt sie — das
Modell baut, was dasteht, und streicht danach nichts mehr weg. Praktische Folge:

1. Vor dem Abschicken die Motivzeile lesen, als hätte sie kein einziges „not a".
   Was entsteht? Wenn das die Fehllesart ist, ist die Zeile falsch, nicht das
   Modell.
2. Ein Substantiv, das ein bekanntes Ding benennt (Figur, Schild, Chevron),
   zieht das ganze Ding mit — samt der Teile, die man nicht bestellt hat. Wo das
   stört: das Ding **nicht benennen**, sondern die Geometrie beschreiben.

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

## Wo die Dateien liegen

| | |
|---|---|
| Magenta-Originale | `assets/ui-pictograms/raw/<id>.jpeg` — **ungetrackt** (.gitignore), 37 MB |
| Freigestellte Master | `assets/ui-pictograms/<id>.avif` — im Repo, ~280 KB, 1024 px lange Kante |
| Prompt zusammensetzen | `.venv/bin/python scripts/pictogram_prompt.py <id>` · `--list` zeigt alle |
| Abnahme messen | `.venv/bin/python scripts/check_pictograms.py <ordner>` |
| UI-Masken (128 px) | `frontend/public/ui-pictograms/<id>.png` — abgeleitet, nie von Hand bearbeitet |
| Masken bauen | `.venv/bin/python scripts/build_pictogram_masks.py` · `--check` meldet Veraltetes |

Freistellen läuft über die **bestehende** Kette, nicht über ein zweites Skript:

```
.venv/bin/python scripts/key_dungeon_enemy_art.py \
    assets/ui-pictograms/raw assets/ui-pictograms --min-blob-share 0.02
```

`--min-blob-share` ist für diesen Satz neu und musste sein: der Vorgabewert 1,00
lässt nur die größte zusammenhängende Masse stehen, was für Kreaturen richtig ist
(jede ist als ein Objekt gebrieft) und hier jedes zweiteilige Piktogramm zerstört
hat — `spy_counter_intel` verlor den Pfeil, `saboteur_disrupt` das zweite
Kettenglied. Bei 0,02 bleiben beide Massen stehen und Sprenkel fallen weiterhin.

## Rahmung wird beim Einlesen normalisiert

Gemini trifft die geforderten 78 % Motivgröße nur ungefähr — gemessen zwischen
47 % und 90 %. Das ist kein Ablehnungsgrund: das Ingest-Skript beschneidet auf
die Bounding-Box und polstert wieder auf einen festen Anteil der Kachel, damit
alle Piktogramme im Set dieselbe optische Größe haben. Der Rand-Befund im
Prüfskript bleibt als Hinweis stehen, blockiert aber nichts.

## Darstellungsgröße (entschieden 2026-08-29)

Ability-Button **40 × 40 px**, Glyph darin **26–28 px**. Begründung: WCAG 2.2
SC 2.5.8 (Stufe AA) setzt 24 × 24 CSS-px als harte Untergrenze für jedes
anklickbare Ziel; WoW zeigt seine Action-Buttons mit 36 × 36 bei 64 × 64
Quellauflösung; die UI-Praxis empfiehlt 44 × 44 als Klickfläche. 40 liegt in
diesem Korridor und gibt den Schnitten Luft.

Die Abnahmeschwelle in `scripts/check_pictograms.py` bleibt trotzdem bei
`TARGET_PX = 24` — die Piktogramme erscheinen auch in Log-Zeilen und Tooltips,
wo sie kleiner rendern. Das ist die Reserve, und sie kostet nichts: kein
durchgefallenes Bild würde bei 28 px bestehen.

⚠ Offen: `DungeonCombatBar.ts` setzt für `.ability` 10 px Schrift und 3 px
Innenabstand (≈ 17 px Zeilenhöhe) und unterschreitet SC 2.5.8 damit schon
heute, unabhängig von Piktogrammen. Beim Umbau auf 40 px mitfixen.

## Technischer Block — an JEDEN Prompt anhängen

```
Square 1:1 framing. The pictogram is centred and its bounding box is ROUGHLY SQUARE — it fills about 78% of the frame in BOTH directions, never a wide flat band across the middle with empty magenta above and below. If the subject is naturally a row, stack or stagger its parts until the group is as tall as it is wide. There is an even empty margin on all four sides.
The pictogram must be AIRY, not a slab: the off-white shape covers at most about a third of the picture, and magenta reads through and around it. A subject drawn as one broad solid mass leaves no room for the cuts that carry its meaning.
Flat pure magenta background, hex #FF00FF, absolutely uniform, no gradient, no vignette, no shadow, no ground plane.
Exactly ONE pictogram. No frame, no circle, no badge, no shield-shape or cartouche around it, no border, no decorative flourish beside it.
It must be FILLED, never an outline drawing: no line art, no stroke-only rendering, no wireframe.
Flat and graphic only: no perspective, no depth, no 3D, no bevel, no emboss, no glow, no reflection, no paper texture, no grain.
Build the subject from FEW LARGE PARTS. Never a fan, spray or comb of many narrow slivers — three or four broad elements, not ten thin ones.
Every part of the shape is at least one tenth of the frame thick — this applies especially to LONG THIN parts such as poles, hafts, shafts and bars, which must be STOUT and chunky, never sticks or straws. AND every magenta gap — every slot, notch, hole or space cut into the shape or left between its parts — is at least one sixteenth of the frame wide. A cut narrower than that closes up when the pictogram is shown small and the shape collapses into a blob. Prefer FEW WIDE cuts over many narrow ones. No hairlines, no thin whiskers, no small detached specks or dots — anything separated from the main mass must be a substantial shape with clear space around it, and there must be at most two such pieces.
No text, no letters, no numerals, no runes, no logo, no watermark.
No faces, no facial features, no eyes on figures — where a human form is needed it is a featureless closed silhouette.
Not painterly, not textured, not sketchy, not cross-hatched, not engraved, not woodcut, not cel-shaded, not glossy. Two tones only: the off-white shape and the magenta ground.
```

---

## Stand (2026-08-29)

Gruppe **Schlag (10/10) abgenommen.** Messwerte bei 24 px, Deckung / Aussparung:
Hammer 17 % / 6,29 · Nadel+Ring 23 % / 2,73 · Brechstange+Block 36 % / 4,45 ·
Pfosten+Klinge 13 % / 6,21 · Hinterrücks 27 % / 3,77 · Kette 27 % / 3,32 ·
Detonation 24 % / 4,49 · Feldzeichen 14 % / 1,64 · Winkel 23 % / 14,60 ·
Hand+Pfeil 24 % / 6,62. Jedes zusätzlich am Kontaktbogen geprüft.

Zwei bekannte Unebenheiten, beide bewusst so belassen: die Brechstange ist mit
36 % das schwerste, Feldzeichen und Nadel sind mit 1,20 / 1,07 px Strichstärke
(bei 28 px Anzeige) die leichtesten Symbole. Und Pfosten+Klinge füllt nur 47 %
statt 78 % des Rahmens — das gleicht die Normalisierung beim Einlesen aus.

Gruppen **Beistand (3/3)** und **Deckung (6/6) abgenommen.** Messwerte bei 24 px,
Deckung / Aussparung: Schild 24 % / 7,17 · Flamme 32 % / 2,81 · Sammeln
25 % / 5,67 · Auge 17 % / 2,26 · Trichter 28 % / 2,31 · Stützdreieck 25 % / 4,41 ·
Kiefer 34 % / 3,41 · zwei Kapseln 34 % / 3,50 · Mauerverband 29 % / 1,46.

Anläufe bis zur Abnahme: Auge, Stützdreieck (nach Motivwechsel), Sammeln und
Trichter je 1–3; Flamme fünf, Ausweichen fünf. Zwei Motive mussten ganz
getauscht werden (`guardian_reinforce` Säule → Mauerverband,
`op_propagandist` Megafon → Anschlag wegen Silhouettenkollision).

Drei Symbole tragen eine notierte Einschränkung: Ausweichen ist semantisch das
schwächste des Satzes, Auge und Schild sind Randbänder statt Vollflächen (im
technischen Block eigentlich verboten, hier bewusst zugelassen), und der
Mauerverband hat mit 1,46 px die knappste Aussparung.

Offen bleiben die 15 Marken fürs Epocheninterface, deren Zeilen noch die
Kurzfassung sind. Für sie gelten die drei in dieser Runde erarbeiteten Regeln:
kompakte Vollformen brauchen eine Öffnung, Substantive bauen die Fehllesart, und
die Zahl der Aussparungen ist der Risikofaktor.

# A · Dungeon-Kampffähigkeiten (19)

Die drei Gruppen entsprechen den Clustern der Kampfkonsole (Schlag / Beistand /
Deckung). Die Silhouetten sind bewusst so gewählt, dass sich innerhalb einer
Gruppe keine zwei Umrisse ähneln.

## Schlag — gegen Feinde (10)

### Grundangriff (`basic_attack`)

Dritter Anlauf mit einer Faust: Gemini zeichnet die Finger jedes Mal als
Haarlinien im Inneren (0,83 / 0,70 / 0,66 px bei 24 px), auch wenn der Prompt
jede Innenzeichnung ausdruecklich verbietet. Anatomie ist in diesem Stil nicht
darstellbar — Motiv deshalb auf einen Kriegshammer gewechselt, der keine
Innenzeichnung kennt.
```
Subject: a heavy war maul seen from the side, lying on a diagonal from the lower left to the upper right. It is made of exactly TWO parts that touch and form one connected mass: a short STOUT haft, and a big blunt rectangular head at its upper end. The haft is THICK — at least a tenth of the frame wide along its whole length, a squat beam, never a stick, cane, pencil or straw — and the head is about three times wider still. Nothing else at all: no claw, no spike, no wedge, no forked end, no binding, no grip wrapping, no lug, tab, nub or spur sticking out of the head anywhere, and NO lines, creases or slots inside either part. Not a carpenter's hammer, not a gavel, not an axe, not a pickaxe, not a torch, not a spoon.
```

> Erste Fassung („no weapon, no ornament" ohne die Notch-Vorgabe) lieferte vier
> Fingerschlitze von median 2,4 % Rahmenbreite — bei 24 px sind das 0,57 px, die
> Faust wird zum Klumpen. Gemessen, nicht geschätzt. Falls auch zwei Kerben nicht
> tragen: Motiv auf **einen massiven Hammerkopf im Profil** wechseln, ganz ohne
> innere Schnitte.

### Präzisionsschlag (`assassin_precision_strike`)
```
Subject: a long slender needle crossing the frame diagonally, with one LARGE round eye pierced near its upper end — the hole is wide and obvious, not a slit. Below it a broad open ring, cut apart where the needle passes through, leaving wide magenta on both sides. Not a sword, not a pin cushion, not a clock hand.
```

### Schwäche ausnutzen (`assassin_exploit`)
```
Subject: TWO separate masses that never touch. On the right, an upright stone block, taller than it is wide, with a broad open V bitten deep into its left side — the notch is wide enough to see through, not a hairline crack. On the left, a short thick straight bar like a crowbar, lying at a slant with its blunt end aimed into the mouth of that notch, stopping well short of it. A clear channel of magenta at least one eighth of the frame wide runs between bar and block along their whole length. The bar is a blunt-ended bar, NEVER a triangle and NEVER pointed: this must not read as an arrow or a play button. Not a mountain, not a piece of cheese.
```

### Hinterhaltschlag (`assassin_ambush_strike`)
```
Subject: TWO separate masses that never touch, with a clear channel of magenta at least one eighth of the frame wide between them. On the left, a narrow upright post standing floor to ceiling like a doorframe edge — no wider than a fifth of the frame, a plain slim column, never a broad panel or sheet. On the right and set well clear of it, a blade pointing down and forward — SMALL and compact, no taller than half the frame and no wider than a quarter of it, never a great sweeping leaf or claw that fills the picture. Neither mass may be wider than a third of the frame, and the two together must cover no more than a third of the picture. Not a padlock, not a bag, not an arch, not a keyhole, not a sheet of paper: nothing curves over the top and the two shapes never join.
```

### Hinterrücksangriff (`infiltrator_backstab`)
```
Subject: TWO separate masses that never touch. Below, a WIDE LOW slab lying flat like a barricade — a thin bar no taller than a SIXTH of the frame, plain, with nothing cut into it and nothing bitten out of its top edge. Above and behind it, a THICK blunt arrow arcs up over the slab in a broad curve and points steeply DOWN at the slab's far side, striking it from behind. The arrow is stout along its whole length, at least a tenth of the frame wide, and its head is a broad blunt wedge — never a thin bent line. The arrow's point stops well ABOVE the slab, hanging in open magenta: it never reaches the slab, never touches it, and never cuts a notch into it. A clear channel of magenta at least one eighth of the frame wide stays open between arrow and slab everywhere, including under the arrowhead. Arrow and slab together cover no more than a third of the picture. Not an upright block, not a bar aimed sideways at a notch, not a U-turn or undo symbol, not a rainbow, not a horseshoe.
```

### Stören (`saboteur_disrupt`)
```
Subject: exactly TWO chain links, set on a diagonal so that together they stand as tall as they are wide — one in the upper left, one in the lower right. Each is a thick ring with a LARGE open hole through it. The upper link is whole and closed. The lower link is SNAPPED WIDE OPEN: it is a broken horseshoe whose two ends are bent far apart, with a magenta gap between the ends at least a quarter of that link's own width, so the break is the loudest thing in the picture. Only two links, never a row of three, never a long chain. Not a bicycle chain, not a bracelet, not a pretzel, not three rings in a line.
```

### Detonieren (`saboteur_detonate`)
```
Subject: an ASYMMETRIC blast. A squat rectangular charge sits low in the lower left, and exactly THREE thick blunt wedges fly up and to the RIGHT out of it, spread across a quarter-turn fan and of three clearly different lengths. Nothing points down, nothing points left, nothing radiates evenly in a circle. The wedges are stubby and blunt-ended, as thick as they are long, never slender rays. Three only. Not a sun, not a lamp, not a star, not a snowflake, not an asterisk, not a sparkle, not a flower: the shape must NOT be radially symmetric and must not have rays going in every direction.
```

### Demoralisieren (`propagandist_demoralize`)
```
Subject: a fallen war standard. A STOUT straight pole lies at a steep tilt, its foot in the lower RIGHT and its head in the upper LEFT, clearly toppling and never upright. The pole is THICK — at least a tenth of the frame wide along its whole length, a squat beam like a roof rafter, never a stick, cane, straw, pen, wand or spear shaft. From the very TOP END of the pole — and only from that single point — a broad triangular pennant hangs straight DOWN into the open space on the LEFT, well clear of the shaft. The magenta between pennant and shaft is wide and open all the way down: never a thin slit, never filled in, and NO triangle is ever formed between pole and pennant. The pennant is BROAD at its top — wider than the pole is thick, several times over — and tapers to a point: a heavy hanging cloth, never a thin ribbon or streamer. Nothing else: no ground, no hand, no rope, no finial, no second flag, and no lines or slots cut inside either part. Not an upright flagpole, not a map pin, not a checkered flag, not a golf flag, not a bookmark, not a paper aeroplane, not an arrowhead, not a solid triangle of any kind.
```

### Schwachstelle analysieren (`spy_analyze_weakness`)
```
Subject: exactly TWO thick corner brackets facing each other across an empty centre, like the corner marks that frame a target. One bracket is an L rotated to hug the upper-left corner of the picture; the other is the same L rotated half a turn, hugging the lower-right corner. Each arm of each bracket is a broad blunt bar. The two brackets never touch and never join, and the whole middle of the picture is empty magenta. One arm of the lower bracket has a broad triangular bite taken out of its end. Not a square, not a frame, not a plus sign, not a cross, not a rectangle with a hole: the upper-right and lower-left corners of the picture stay completely empty.
```

### Spionageabwehr (`spy_counter_intel`)
```
Subject: TWO separate masses. Below, an open hand seen from the side, cupped, drawn as one blunt mass with NO finger slits cut into it. Above it and clearly apart, a thick blunt arrow descending onto the hand and stopping short of it, with a broad channel of magenta between the two. The arrow never passes through, never touches, and has no thin shaft. Not a leaf, not a tree, not a mushroom, not a stop sign, not a download symbol.
```

## Beistand — für Verbündete (3)

### Schild (`guardian_shield`)

Zwei Anläufe, zwei verschiedene Wände. Der erste wurde ein **Herz**, obwohl
„not a heart" dastand: breite Form, mittige Kerbe oben, Spitze unten *sind* ein
Herz, und ein Verbot schlägt keine Geometrie. Gerade Oberkante und stumpfer Fuß
haben das behoben.

Der zweite war kein Herz mehr, aber eine **Platte** mit 46 % Deckung und 0,93 px
Schnitt — und das war kein Prompt-Fehler, sondern der Widerspruch im technischen
Block bei kompakten Vollformen (siehe oben). Ein Schild ist per Anschauung eine
geschlossene konvexe Fläche, also musste die Öffnung hinein: dickes Randband,
Mitte offen. Dieselbe Bauweise, mit der `spy_observe` im ersten Anlauf bestanden
hat.

**Abgenommen im dritten Anlauf: 24 % / 7,17 px** — der beste Messwert der ganzen
Beistand/Deckung-Runde. Damit ist der Strukturbefund belegt und nicht nur
plausibel.
```
Subject: a heater shield drawn as a THICK RIM around a large empty magenta centre — a broad band that follows the shield's outline all the way round, with the whole middle cut clean away. The outline it follows has a STRAIGHT HORIZONTAL top edge running corner to corner, sides that fall almost vertically, and a BLUNT ROUNDED bottom: it never dips or notches in the middle of the top edge and it never tapers to a point at the bottom. The band is EVEN in width the whole way round and at least a TENTH of the frame thick — a heavy strap, never a thin line — and the opening it encloses is the LARGEST single area in the picture. Nothing else at all: no boss, no cross, no bar across the opening, no rivets, no lines, no second rim inside or outside the first. Not a heart, not a spade, not a playing-card suit, not an arrowhead, not a leaf, not a badge, not a crest, not a coat of arms, not a location pin, not a padlock, not a letter U, not a letter D.
```

### Inspirieren (`propagandist_inspire`)

Erster Anlauf: drei Zungen, aber spitz zulaufend, und die Aussparungen dazwischen
verjüngten sich nach unten zu Haarrissen — 1,37 px bei 24 px, durchgefallen. Es
las sich als Grasbüschel. Die Gegenmittel — Zungen oben **stumpf gerundet**, und
die Aussparung als **U mit parallelen Wänden** statt als Keil — haben gewirkt:
3,16 px im zweiten Anlauf, der beste Wert der Gruppe. Ein Keil erfüllt die
Mindestbreite oben und reißt sie unten; diese Formulierung gehört ab jetzt in
jede Zeile mit inneren Schnitten.

Der zweite Anlauf fiel trotzdem durch, und zwar an einem Fehler der Korrektur:
mit dem Keil hatte ich auch „leaning the same way" gestrichen und „die mittlere
nur wenig höher als die beiden daneben" ergänzt. Drei gleich hohe, senkrechte,
parallele Zinken auf einem Stiel **sind** ein Dreizack — das Verbot stand
daneben und konnte nichts ausrichten, weil die Anweisung ihn baute. Dieselbe
Mechanik wie beim Herzen. Neigung und ungleiche Höhen sind das, was eine Flamme
von einer Gabel unterscheidet; beide stehen jetzt wieder drin.

Dritter Anlauf: Dreizack weg, Neigung da — und mit 37 % / 1,78 px zu massiv.
Wieder ein Fehler der Vorgabe: „jede Zunge mindestens ein Viertel des Rahmens
breit" mal drei sind rechnerisch schon drei Viertel Vollmasse. **Eine
Mindestbreite ohne Obergrenze ist bei mehrteiligen Motiven ein Rechenfehler**,
und die Deckung fällt dann zwangsläufig über die Grenze.

Vierter Anlauf mit gedeckelter Zungenbreite: 34 % / 1,35 px, und die Form war
eine Flammen-**Kontur** mit eingeschlossenen Schlaufen im Inneren. Das
Loch-Verbot hatte in der Zeile gefehlt, weil bis dahin nie eins nötig war.

Damit vier Anläufe und vier verschiedene Wände: spitze Zungen, Dreizack, zu
massiv, Innenschlaufen. Der gemeinsame Nenner ist die Anzahl: **drei Zungen
heißen zwei Buchten, und jede Bucht ist eine Gelegenheit zum Verjüngen.** Der
einzige Anlauf mit guten Zahlen war der mit parallelen Buchtwänden. Fünfter
Anlauf deshalb mit zwei Zungen und einer einzigen Bucht, doppelt so breit
vorgeschrieben, weil sie allein trägt — plus dem jetzt fehlenden Loch-Verbot.
Die Asymmetrie (linke Zunge doppelt so hoch, beide nach rechts geneigt) hält
zugleich Herz und Hörner fern; dieselbe Rettung wie beim Schild.

**Abgenommen im fünften Anlauf: 32 % / 2,81 px.** Die Reduktion auf eine Bucht
war der Schlüssel — sie ist die einzige Stelle, an der sich etwas verjüngen kann,
und eine einzelne breite Bucht lässt sich vorschreiben, zwei nicht. Als Regel für
den Rest des Satzes: **die Zahl der Aussparungen ist der Risikofaktor, nicht
ihre Breite.**
```
Subject: a squat wide flame standing on a short stub of a base, all ONE connected mass, as WIDE as it is tall and covering no more than a third of the picture. The flame has exactly TWO tongues, both leaning the same way, over to the RIGHT. They are of clearly different height: the LEFT tongue is the taller and rises about twice as high as the right one. Each ends in a BLUNT ROUNDED TOP — never a point, never a taper, never a spike. Between the two tongues, cut down from the top, is exactly ONE magenta bay: a wide U with PARALLEL SIDES that keeps the SAME WIDTH from its opening all the way down to its rounded floor, at least a TENTH of the frame wide everywhere. That single bay is the ONLY cut in the entire shape. The outline is one closed contour with nothing inside it: NO holes, NO loops, NO enclosed magenta anywhere within the shape, no second bay, no third tongue, no thin licks, no sparks, no smoke. The base is a small stub, no more than a fifth of the height. Not a trident, not a fork, not the Greek letter psi, not a crown, not a heart, not a pair of horns, not rabbit ears, not a tulip, not grass, not a plant, not a tuft, not a hand, not a torch, not a candle, not a leaf, not a feather, not a droplet.
```

### Sammeln (`propagandist_rally`)

Zweimal an den Prüfzahlen vorbeigefallen, und beide Male war ein einziges Wort
schuld: **chevron.**

Erster Anlauf (36 % / 2,36 px, formal bestanden): Gemini las es als
Klammerhälfte, zwei davon auf einer Waagerechten wuchsen optisch zu einem Ring
zusammen, und die Scheibe wurde das Loch einer **Sechskantmutter**. Die
Diagonale hat das behoben — auf ihr kann sich kein Ring schließen.

Zweiter Anlauf (25 % / 3,90 px, die besten Zahlen der Gruppe): jetzt las Gemini
dasselbe Wort als **Häkchen** oben links und als **Kreuz** unten rechts. Bei
24 px steht dort „ja / nein" — und formal Buchstaben, die der technische Block
verbietet.

Die Lehre ist allgemeiner als dieses Symbol: **ein Begriff, den das Modell
dreimal verschieden auflöst, gehört nicht in eine Motivzeile.** Beschrieben wird
die Form, nicht ihr Name — hier eine schaftlose Pfeilspitze mit gleichen Armen,
auf die Scheibe gerichtet.

**Abgenommen im dritten Anlauf: 25 % / 5,67 px.** Die Pfeilspitze hat genau eine
Lesart, und der Rand-Befund (6 %) ist der Normalisierungsfall.

Nachbarschaft geprüft: `spy_analyze_weakness` ist ebenfalls diagonal oben links /
unten rechts komponiert. Die beiden verwechseln sich nicht — dort ist die Mitte
leer und die Massen sind offene L-Winkel, hier ist die Mitte die größte
Vollfläche des Bildes. Bei 24 px ist das der auffälligste Unterschied im ganzen
Satz.
```
Subject: THREE separate masses, never touching, arranged on a DIAGONAL. A big solid disc sits at the centre of the picture, at least a THIRD of the frame across — it is the largest mass and everything else aims at it. In the UPPER LEFT sits one thick blunt ARROWHEAD WITH NO SHAFT: a solid triangle with a broad notch cut into its back edge, aimed down and to the right straight at the disc. In the LOWER RIGHT sits a second arrowhead of the same size and the same shape, turned half a turn so that it aims up and to the left straight at the disc. Both arrowheads have EQUAL arms and are symmetric about the line that joins them to the disc. Each is no larger than a third of the frame. The upper-right and lower-left of the picture stay completely empty magenta, and a clear channel of magenta at least one eighth of the frame wide stays open between each arrowhead and the disc. NEVER a shape with unequal arms and never a crossing of two bars: not a tick, not a check mark, not an X, not a plus sign, not the letter y, not the letter t, not the letter k, not any letter at all. Not a hexagon, not a nut, not a bolt head, not a ring with a dot in it, not a pair of parentheses, not an angle-bracket code symbol, not a star, not an asterisk, not a bowtie, not a play button.
```

## Deckung — auf sich selbst (6)

### Beobachten (`spy_observe`)

**Abgenommen** im ersten Anlauf (17 % / 2,26 px). Eine Abweichung bewusst
belassen: Gemini lieferte einen Umriss statt einer Mandelfläche mit
ausgestanzter Pupille — laut technischem Block verboten. Es trägt hier trotzdem,
weil das Band mit 2,26 px über der Grenze bleibt; die Bedeutung sitzt dadurch
tatsächlich in der Kante. Der Rand-Befund ist der bekannte, nicht blockierende.
```
Subject: a wide open eye drawn as one almond-shaped mass, with the pupil cut clean out of it as a single big round hole — the hole is at least a THIRD of the eye's width, never a dot. Nothing else at all: no lashes, no brow, no lids, no iris ring, no rays, no tear. Not a leaf, not a boat, not a lens flare, not a fish.
```

### Provokation (`guardian_taunt`)

Erster Anlauf: Motiv richtig, Zahlen gut (28 % / 2,39 px) — und trotzdem
durchgefallen. Gemini setzte VIER geschachtelte Bögen statt zwei; bei 24 px wurde
die rechte Bildhälfte ein gestreifter Schmier. „Not a wifi fan of many arcs" hat
nicht getragen, weil daneben „TWO stacked crescents" stand und *stacked* die
Staffelung nahelegt — das Verbot nennt jetzt die Zahl mit.

**Abgenommen im zweiten Anlauf: 28 % / 2,31 px.** Zwei Abweichungen bewusst
belassen, weil beide bei 24 px tragen: der Trichter hat weiterhin ein Loch in
der Mündung, und jeder der zwei Bögen ist einmal quer geteilt, liegt also als
vier Stücke im Bild. Der Rand-Befund (5 %) ist der umgekehrte Normalisierungsfall
und blockiert ebenso wenig.

⚠ Serienfolge: `op_propagandist` musste deshalb vom Megafon weg (siehe dort).
```
Subject: TWO separate masses. On the left, a speaking horn seen from the side: a broad SOLID cone with its narrow end at the left and its wide open mouth facing RIGHT, no taller than half the frame, with NOTHING cut out of it anywhere — no hole, no ellipse, no ring at its mouth, no handle, no lines. On the right, set clearly apart, EXACTLY TWO solid crescents, one above the other, both curving away from the mouth. Two, not three and not four: there are never nested or stacked arcs behind them. Each crescent is at least a tenth of the frame thick, a broad blade of sound and never a thin arc or line, and a magenta gap at least one eighth of the frame wide stays open between the two crescents themselves as well as between the crescents and the horn. Not a bell, not a notification symbol, not a wifi symbol, not a fan of many nested arcs, not a megaphone with a handle, not an ice-cream cone.
```

### Befestigen (`guardian_fortify`)

Erster Anlauf wurde eine **Trittleiter** mit Sprossen, bei 1,11 px Aussparung.
Beide Fehler haben eine Ursache: ZWEI Streben an einem Pfosten sind drei Teile,
zwischen denen zwangsläufig schmale Schlitze entstehen — und ein A-Gestell mit
Querstücken ist per Anschauung eine Leiter. Rückbau auf EINE Strebe: drei Balken,
die ein einziges großes Dreieck umschließen. Das Dreieck ist damit die
Hauptaussparung statt eines Nebenprodukts, und ohne Sprossen bleibt keine Leiter
übrig.

**Abgenommen im zweiten Anlauf: 25 % / 4,41 px.** Bestätigt dieselbe Regel wie
bei `propagandist_inspire`: weniger Teile heißt weniger Schlitze, und eine
grosse gewollte Aussparung schlägt mehrere kleine unbeabsichtigte.
```
Subject: a shoring brace made of exactly THREE stout beams, joined into ONE connected mass and enclosing a single large magenta triangle. An upright beam stands at the LEFT and runs the full height of the motif. One diagonal beam leans from the TOP of that upright down to the lower right. A short horizontal beam lies along the bottom and joins the two feet. Every beam is the same thickness, about a tenth of the frame, and the enclosed magenta triangle is the LARGEST single area in the whole picture — wide open, never a slot. Three beams and nothing else: NO rungs, no crossbars, no steps, no second diagonal, no ground line, no bolts, and nothing cut inside any beam. Not a ladder, not a stepladder, not an easel, not a music stand, not a tent, not a set square, not a filled triangle, not a letter A, not a letter K, not a letter N.
```

### Falle legen (`saboteur_trap`)

Zweiter Fall, in dem die Zahlen bestehen und der Kontaktbogen widerspricht:
33 % / 1,62 px — und bei 24 px eine Zelle. Die Kiefer sind an beiden Enden
zusammengewachsen, also ein Ring mit Loch. Ursache war „seen from the side":
ein Tellereisen im Profil schließt sich, sobald das Modell die Enden verbindet.
Jetzt sind es ausdrücklich zwei getrennte Massen, der Ring ist verboten, und die
sechs Zähne (der Kamm, vor dem der technische Block warnt) sind auf vier
reduziert.

Zweiter Anlauf: zwei getrennte Massen, vier Zähne, Ringverbot — und mit 40 %
Deckung trotzdem wieder ein **Zahnrad**. Die zwei Kiefer waren so tief gebogen,
dass sie den Kreis fast schlossen. Schuld war wieder ein Wort: **crescent** heißt
für das Modell Halbkreis, und zwei gegenüberliegende Halbkreise *sind* ein Ring —
dieselbe Mechanik wie „chevron" bei `propagandist_rally`. Das Verbot des Rings
kann nichts ausrichten, solange die positive Beschreibung ihn baut. Dritter
Anlauf ohne das Wort: ein flacher Bogen, breiter als hoch, der nie um die Seiten
herumgreift.

**Abgenommen im dritten Anlauf: 34 % / 3,41 px.** Die flache Ober- und Unterkante
lässt den Kreis nicht mehr zu, und die Öffnung an den Seiten bleibt auch bei
24 px sichtbar. Bestätigt, dass das Wort das Problem war und nicht die
Komposition: ohne „crescent" kam im ersten Anlauf durch, was mit ihm zweimal ein
Zahnrad wurde.
```
Subject: TWO separate masses, one above the other, never touching and never joining. Each is a WIDE SHALLOW BOW: a bar that spans almost the whole width of the motif but is no taller than a FIFTH of the frame, bent only gently so that its ends turn a little toward the other bar. It is a flattened arch — NEVER a half-circle, never a hook, never a shape that curls round. Neither bar ever reaches around the sides, and the LEFT and RIGHT edges of the picture stay open magenta. Between the two bars lies a wide empty magenta mouth at least a THIRD of the frame tall. The upper bar carries exactly TWO broad blunt teeth hanging DOWN into that mouth; the lower bar carries exactly TWO more standing UP into it — four teeth in all, each as wide at its base as it is long, with a magenta gap at least a sixteenth of the frame wide beside every tooth. Nothing else: no chain, no spring, no plate, no ground, no hinge. The two bars must NEVER together form or even suggest a circle, a ring or a round outline. Not a gear, not a cog, not a wheel, not a ring, not a donut, not a wreath, not a sun, not a cell, not an amoeba, not a bear head, not a saw blade, not a pair of brackets, not a mouth full of small teeth.
```

### Ausweichen (`infiltrator_evade`)

0,75 px Aussparung bei 64 % zu engen Läufen — der schlechteste Wert der ganzen
Serie, und die Ursache waren ausschließlich Arm- und Beinspalten. Damit ist die
Lehre vom Grundangriff bestätigt und zur Regel geworden: **Anatomie ist in
diesem Stil nicht darstellbar.** Zwischen Arm und Rumpf liegt bei jeder
menschlichen Gestalt ein spitz zulaufender Keil, und ein Keil reißt die
Mindestbreite an seiner Spitze immer.

Zweiter Anlauf mit „runder Kopf, glatter Körper, KEINE Arme, KEINE Beine":
38 % / 0,97 px, Arme und Beine wieder da. Die Verbotsliste war die längste im
ganzen Dokument und hat nichts ausgerichtet — siehe die Lehre oben: solange
„standing figure", „head", „body" und „foot" in der Zeile stehen, baut das
Modell einen Menschen, und Menschen haben Gliedmaßen.

Dritter Anlauf ohne jedes menschliche Substantiv: eine Scheibe auf einem hohen
Klotz, zweimal, einmal gerade und einmal geneigt. Reine Geometrie, nichts, was
sich zuschnüren kann — und die Aussparung sprang von 0,97 auf 2,20 px, bei 36 %
Deckung knapp über der Grenze.

Vierter Anlauf mit schmalerem Klotz: 35 % / 1,38 px. Die enge Stelle war jetzt
die **Achsel zwischen Scheibe und Klotz** — ein einspringender Winkel, weil die
Scheibe breiter ist als der Klotz. Damit ist der Keil aus der Anatomie-Lehre in
kleinerem Maßstab wieder da: **jede konkave Ecke einer Silhouette läuft spitz
zu und reißt die Mindestbreite.** Fünfter Anlauf deshalb als Kapsel — eine
Stange mit rundem Kopfende, Umriss durchgehend konvex.

**Abgenommen im fünften Anlauf: 34 % / 3,50 px** — mit einer offen notierten
Einschränkung. Es ist das schwächste Symbol des Satzes: die Bedeutung sitzt
nicht in einem wiedererkennbaren Gegenstand, sondern allein in der Relation
(zweimal dieselbe Form, eine versetzt und geneigt). Farbe und Tooltip tragen
hier mehr als anderswo.

Die bessere Alternative wurde geprüft und verworfen: ein Pfeil, der an einer
wegkippenden Stange vorbeifliegt, läse deutlich klarer — der Satz hätte damit
aber **drei** Pfeilmotive (`infiltrator_backstab`, `spy_counter_intel`, hier).
Nach Regel 3 der Arbeitsweise ist Silhouettengleichheit ein Fehler der Serie,
und ein schwaches Einzelsymbol ist der bessere Handel als ein drittes
Pfeilmotiv. Die Lesart „einer ist aus seinem Platz getreten" trägt der
Versatz und die Neigung, nicht die Anatomie — das ist zugleich Pieńkowskis
eigener Griff: die Gestalt wird ausgefüllt, statt gezeichnet.
```
Subject: exactly TWO identical shapes and nothing else in the picture. Each shape is a plain upright BAR with a fully ROUNDED TOP and a flat bottom — a capsule standing on end. It is only a SEVENTH of the frame wide, the SAME width from top to bottom, and about five times as tall as it is wide. Its outline is CONVEX everywhere: there is no separate head, no shoulder, no waist, no step and NO INWARD CORNER anywhere along it, and nothing is attached to it and nothing is cut into it — no limbs, no stubs, no bumps, no slits, no notches, no lines. The LEFT bar stands straight upright. The RIGHT bar is the same bar tilted about twenty-five degrees to the right, leaning away, and set to one side so a broad channel of magenta at least a QUARTER of the frame wide stays open between the two; they never touch and never overlap. Do NOT draw a human body, a person, a figure, a doll or a character of any kind — these are two plain geometric markers. Not a crowd, not a group or users symbol, not a pause symbol, not two upright bars standing parallel, not a mirror reflection standing level, not a bowling pin, not a bottle, not a thumbtack, not a nail, not any letter or numeral.
```

### Verstärken (`guardian_reinforce`)

Zwei Fassungen, beide an derselben Stelle gescheitert — und beide Male an meiner
eigenen Zeile, nicht an Gemini.

Die ursprüngliche („Säule über die volle Höhe, Kragen etwas breiter") beschreibt
ein hohes schmales Rechteck und kollidiert mit der Quadrat-Vorgabe. Die zweite
machte den Kragen dreimal so breit — und damit war die Beschreibung ein
**Kreuz**: aufrechter Balken, breiteres Band quer über der Mitte. 22 % / 4,71 px,
also technisch einwandfrei, und als christliches Kreuz in einer Kampfleiste
unbrauchbar. Die Probe aus der Lehre oben (die Zeile ohne jedes „not a" lesen)
hätte das vor dem Abschicken gezeigt.

Motiv deshalb getauscht statt ein drittes Mal die Maße verschoben: ein
Mauerverband aus drei versetzten Blöcken. Er heißt Verstärkung ohne Umweg, ist
durch seine Fugen von Natur aus luftig, steht etwa quadratisch — und kann
geometrisch kein Kreuz werden. Zu `guardian_fortify` (Stützdreieck) besteht keine
Silhouettennähe.

Erster Anlauf mit dem neuen Motiv: 37 % / 0,87 px. Motiv richtig, Maße nicht —
die Blöcke wurden Platten und die Fugen Haarrisse. „Mindestens ein Sechzehntel"
hat Gemini bei diesem Symbol schlicht nicht eingehalten. Zweiter Anlauf deshalb
mit **harten Zahlen** statt relativer Angaben (Block ein Drittel breit, ein
Viertel hoch; Fuge ein Zehntel) und der ausdrücklichen Ansage, dass die Fugen
auffällige Bänder sein müssen. Als Regel: **wo eine relative Angabe zweimal
ignoriert wurde, gehört ein Bruchteil des Rahmens hin, kein Vergleich.**

**Abgenommen: 29 % / 1,46 px.** Der knappste Aussparungswert der Gruppe — bei der
Anzeigegröße von 26–28 px sind das 1,6–1,7 px, die 24 px im Prüfskript sind die
Reserve. Der Kontaktbogen zeigt die drei Steine bei 24 px getrennt.
```
Subject: THREE separate small solid blocks laid like masonry, never touching. Each block is a plain rectangle exactly ONE THIRD of the frame wide and ONE QUARTER of the frame tall — small, not slabs — with nothing cut into it: no lines, no notches, no holes, no bevels. TWO of them sit SIDE BY SIDE in the lower half, separated by a VERY WIDE magenta joint a TENTH of the frame across. The THIRD lies in the upper half, centred over that joint so it bridges both, and a second VERY WIDE magenta joint, also a TENTH of the frame deep, runs the full width between the upper block and the two below — the upper block floats clear above them and touches nothing. Both joints must be conspicuous bands of magenta, never thin lines: they are the most visible thing about the picture after the blocks themselves. Exactly three blocks and nothing else: no fourth block, no third course, no ground line, no mortar drawn as texture, no arrow. Not a cross, not a plus sign, not a column with a collar, not a solid wall, not a wall of many small bricks, not a staircase, not a podium, not a bar chart, not a letter H, not a letter I, not a letter T.
```

---

# B · Epoch-Steuerung (15)

**Noch keins davon generiert.** Die Motivzeilen unten sind nach der
Beistand/Deckung-Runde vom 2026-08-29 überarbeitet — alle fünf dort teuer
bezahlten Regeln sind eingearbeitet:

1. **Kompakte Vollformen brauchen eine Öffnung.** Eckstein, Wachssiegel und
   Kiste waren als geschlossene Körper gebrieft und hätten alle drei mit rund
   46 % Deckung durchfallen müssen. Sie sind jetzt Winkel, Ring und offener
   Kasten.
2. **Das Substantiv baut die Form.** Jede Zeile ist einmal ohne ihre „not a"
   gelesen worden; wo dabei die Fehllesart entstand, wurde die Beschreibung
   geändert, nicht das Verbot verstärkt.
3. **Die Zahl der Aussparungen ist der Risikofaktor.** Fallgitter und Zinnenkranz
   sind von „Gitter" und „Zinnen" auf drei bzw. zwei Öffnungen heruntergesetzt.
4. **Keine Anatomie.** `op_infiltrator` (Hand durch eine Mauer) und
   `resonance_surge_riding` (Figur auf der Welle) sind umgeschrieben — jede
   Achsel und jeder Fingerschlitz reißt die Mindestbreite.
5. **Harte Brüche statt Vergleiche**, wo eine Größe kritisch ist.

Dazu die Silhouettenprüfung gegen die 19 fertigen Fähigkeitssymbole. Drei Motive
mussten deshalb weichen: `op_propagandist` (Megafon = `guardian_taunt`),
`op_saboteur` (Ladung = `saboteur_detonate`), `zone_deploy_resources` (Pfeil
nach unten = wäre das dritte Pfeilmotiv des Satzes).

## Was noch zu generieren ist

| Gruppe | IDs | Stand |
|---|---|---|
| Operativtypen | `op_spy` `op_guardian` `op_saboteur` `op_propagandist` `op_infiltrator` `op_assassin` | 0/6 |
| Zonenaktionen | `zone_fortify` `zone_quarantine` `zone_deploy_resources` | 0/3 |
| Resonanz | `resonance_surge_riding` `resonance_substrate_tap` | 0/2 |
| Epochenphasen | `phase_foundation` `phase_competition` `phase_reckoning` `phase_completed` | 0/4 |

Drei Nachbarschaften bleiben eng und sind beim Kontaktbogen ausdrücklich zu
prüfen; wenn eine davon bei 24 px kippt, wird das **Epoch**-Motiv getauscht, nie
das schon abgenommene Fähigkeitssymbol:

- `op_spy` (Schlüssel: Bogen + Schaft + Bart) gegen
  `assassin_precision_strike` (Nadel durch offenen Ring) — beide „Ring plus
  Längsteil". Unterschied: der Schlüssel ist EINE verbundene Masse mit Bart.
- `phase_foundation` (ein dicker Winkel) gegen `spy_analyze_weakness` (ZWEI
  Winkel diagonal, Mitte leer) — Unterschied ist die Anzahl.
- `op_propagandist` (drei waagerechte Balken) gegen das Hamburger-Menü-Zeichen —
  Unterschied ist die klar ungleiche Länge der Balken.

## Operativtypen (6)

Diese sechs erscheinen auch in der Agentenübersicht und im Einsatzdialog. Sie
dürfen sich **nicht** mit den Dungeon-Fähigkeiten derselben Schule verwechseln
lassen — die Motive sind deshalb bewusst anders gewählt als bei `spy_observe`
oder `guardian_shield`.

### Spion (`op_spy`)
```
Subject: a large old key lying on a diagonal from the lower left to the upper right, all ONE connected mass. At its upper end a thick RING with a LARGE open hole through it — the hole is at least a fifth of the frame across and is the biggest single opening in the picture. From that ring a STOUT straight shaft runs down to the lower left, at least a tenth of the frame thick along its whole length, a squat beam and never a stick, wire or straw. At the far end of the shaft, exactly TWO broad blunt teeth stand out from ONE side only, each as wide at its base as it is long, with a magenta gap at least a sixteenth of the frame wide between them. Nothing else: no second ring, no third tooth, no ornament, no keyhole, no lines cut inside any part. Not a needle, not a pin, not a spoon, not a magnifying glass, not a padlock, not a musical note, not a letter.
```

### Wächter (`op_guardian`)
```
Subject: a portcullis reduced to its bare frame: exactly TWO thick upright bars and TWO thick horizontal bars crossing them, joined into ONE connected mass, enclosing exactly THREE square magenta openings. Every bar is at least a tenth of the frame thick, and every opening is at least a fifth of the frame across — wide squares, never a fine mesh. The two uprights end BELOW the lowest horizontal in short blunt points. Four bars and no more: never a grid of many bars, never a net, never a lattice. The openings together take up more of the picture than the bars do. Not a window, not a waffle, not a chessboard, not a hash sign, not a letter, not a barcode.
```

### Saboteur (`op_saboteur`)
```
Subject: a stout bar snapped clean in two, lying on a diagonal from the lower left to the upper right — TWO separate masses that never touch. Each half is a squat beam at least a tenth of the frame thick, and each ends at the break in a broad blunt zig-zag of exactly TWO steps, so the two ends would fit back together. Between them a magenta gap at least an EIGHTH of the frame wide runs the whole depth of the break. Nothing else at all: no charge, no fuse, no spark, no rays, no third piece, and nothing cut inside either half. Not a lightning bolt, not a crack in a wall, not a torn ribbon, not a bone, not a chain, not a letter Z.
```

### Propagandist (`op_propagandist`)

⚠ Ursprüngliches Megafon-Motiv gestrichen: identische Silhouette wie
`guardian_taunt`. Ersatz ist eine Bekanntmachung, auf Balken reduziert — Schrift
ist verboten, also stehen die Zeilen als Balken da.
```
Subject: exactly THREE solid horizontal bars stacked one above the other, all left-aligned on a common invisible left edge, never touching. Their lengths are CLEARLY different: the top bar reaches almost the full width of the motif, the middle one about two thirds of that, the bottom one about a third — never three bars of the same length. Each bar is at least a tenth of the frame thick, and the two magenta gaps between them are at least a tenth of the frame deep as well, so ink and space are about equal. Three bars only, nothing else: no fourth bar, no frame around them, no dots, no sheet behind them. Not a hamburger menu symbol, not three equal lines, not a list, not a bar chart, not an equals sign, not text.
```

### Infiltrator (`op_infiltrator`)

⚠ Hand gestrichen: Anatomie ist in diesem Stil nicht darstellbar (zweimal
gemessen, siehe `basic_attack` und `infiltrator_evade`). Übrig bleibt die
Bresche selbst.
```
Subject: an upright wall slab with a single rectangular gap punched clean through it. The slab is a plain solid rectangle standing on end, about THREE FIFTHS of the frame wide and filling the full height of the motif, with square corners. The gap is a wide rectangular hole in its lower half, at least a THIRD of the slab's width and a third of its height, cut right through so magenta shows behind it, and it is the largest single area in the picture. Its edges are straight and blunt. That gap is the only cut: no cracks, no rubble, no bricks, no lines, no second hole, no hand, no figure, nothing passing through it. Not a doorway, not an arch, not a window frame, not a letter n, not a letter u, not a tunnel with a rounded top.
```

### Assassine (`op_assassin`)
```
Subject: a stiletto pointing straight DOWN, all ONE connected mass, standing upright in the middle of the picture. It has exactly THREE parts: a short blunt pommel at the very top, a broad straight CROSSGUARD below it running left and right, and a blade hanging down from the guard. The crossguard is a plain bar at least a tenth of the frame thick and about half the frame wide — it is what makes the motif as wide as it is tall. The blade is STOUT, at least a tenth of the frame wide for most of its length, tapering only in its lowest quarter to a blunt point; never a needle, wire or hairline. Nothing else: no grip wrapping, no fuller, no blood groove, no ornament, and no lines or slots cut inside any part. Not a needle, not a nail, not a screwdriver, not a syringe, not a cross, not a letter t.
```

## Zonenaktionen (3)

### Befestigen (`zone_fortify`)
```
Subject: TWO separate masses, one above the other. Below, a battlement: a wide solid wall bar with exactly TWO broad square merlons standing up from its top edge, one at each end, and one WIDE magenta gap between them at least a fifth of the frame across. Two merlons only — never a row of three or more, never a comb of small teeth. The wall bar and its merlons are one connected mass, and every part of it is at least a tenth of the frame thick. Above it and clearly apart, a THICK blunt arrow points straight UP, stout along its whole length with a broad blunt wedge for a head, its tail stopping well above the wall so a magenta channel at least an eighth of the frame wide stays open between them. Nothing else: no ground, no flag, no gate, no lines cut inside anything. Not a crown, not a castle, not a graph, not a letter, not a chess rook.
```

### Quarantäne (`zone_quarantine`)
```
Subject: TWO separate masses, one inside the other and never touching. Outside, a thick unbroken RING — a heavy closed band at least a tenth of the frame thick, perfectly continuous with no break, no gap and no notch anywhere along it. Inside it, floating clear at the centre, a plain SOLID DISC about a third of the frame across. Between disc and ring a wide empty magenta moat runs the whole way round, at least an eighth of the frame across at every point — the disc never touches the ring and is never joined to it by a spoke, bar or bridge. Nothing else: no teeth on the ring, no arrows, no cross through it, no second ring, no lines. Not a gear, not a cog, not a wheel with spokes, not a donut, not a target with many rings, not an eye, not a prohibition sign.
```

### Ressourcen verlegen (`zone_deploy_resources`)

⚠ Pfeil-nach-unten gestrichen: der Satz hat mit `infiltrator_backstab` und
`spy_counter_intel` bereits zwei Pfeilmotive.
```
Subject: TWO separate masses that never touch. Below, an open crate seen from the front: a thick U-shaped band — a flat bottom bar with a stout upright bar rising from each end — open across the whole top, with a wide empty magenta interior. Every part of the band is at least a tenth of the frame thick, and the opening between the two uprights is at least a third of the frame across. Above it and clearly apart, a plain SOLID BLOCK hangs in open magenta, a squat rectangle a little narrower than that opening, sitting square and level as though about to be lowered in. A magenta channel at least an eighth of the frame wide stays open between the block and the crate. Nothing else: no lid, no arrow, no rope, no hook, no ground, no lines cut inside either part. Not a letter U, not a cup, not a basket with a handle, not a shopping cart, not an inbox tray.
```

## Resonanz-Operationen (2)

### Wellenritt (`resonance_surge_riding`)

⚠ Figur gestrichen (Anatomie). Der Reiter ist jetzt eine geometrische Marke,
und zwar eine Scheibe — deutlich anders als die zwei Kapseln von
`infiltrator_evade`.
```
Subject: TWO separate masses that never touch. Below, one heavy wave: a broad solid mass whose top edge rises from the lower LEFT and curls over to the RIGHT in a single blunt hook, the hook's tip pointing back down to the left. It is one thick continuous body at least a fifth of the frame thick everywhere, with NO foam, no droplets, no second crest and no lines cut into it. Above the shoulder of that curl and clearly apart, a plain SOLID DISC about a fifth of the frame across, floating in open magenta, with a channel at least an eighth of the frame wide between it and the wave. Nothing else: no figure, no board, no spray, no sun, no horizon. Not a person, not a wave with many crests, not a whirl, not a spiral, not a comma, not a musical note, not a letter.
```

### Substrat-Anzapfung (`resonance_substrate_tap`)
```
Subject: TWO separate masses. Above, a spigot: a stout L-shaped pipe, one arm running horizontally in from the LEFT and turning down at its right end into a short spout that opens downward. The pipe is a squat beam at least a tenth of the frame thick along both arms, with square blunt ends, no valve, no handle, no wheel and no lines cut into it. Below the spout and clearly apart, ONE broad drop: a solid rounded shape about a fifth of the frame across, hanging in open magenta with a channel at least an eighth of the frame wide between it and the spout. One drop only — never a stream, never a splash, never a row of drops, never a puddle. Nothing else: no ground, no layers, no basin, no pipe fittings. Not a letter L, not a hammer, not a shower head, not a watering can, not an exclamation mark.
```

## Epochenphasen (4)

Diese vier stehen in der Kopfleiste und werden ständig gelesen. Sie müssen als
Folge erkennbar sein — vom Setzen über den Streit zur Abrechnung. Die Folge
liest sich als Winkel → Kreuzung → Kippen → Schließen.

### Gründung (`phase_foundation`)

⚠ Massiver Eckstein gestrichen: eine kompakte Vollform kann „78 % Rahmen" und
„höchstens ein Drittel Deckung" nicht gleichzeitig erfüllen (nachgerechnet am
zweiten Schild-Anlauf, 46 %). Aus dem Quader wird der Winkel, den er bildet.
```
Subject: ONE thick right-angled corner piece, like a single squared cornerstone seen as the angle it makes. It is an L rotated so that it hugs the LOWER LEFT of the picture: one stout horizontal arm along the bottom and one stout vertical arm up the left side, meeting in a square corner, joined as one mass. Each arm is a plain blunt bar about a fifth of the frame thick, and each reaches about three quarters of the way across the motif, so the piece is as tall as it is wide. The upper right of the picture is a single large empty magenta square, and it is the biggest area in the image. Exactly ONE such corner piece — never a second one facing it, never a closed frame, never a rectangle. Nothing else: no bricks, no mortar lines, no bevel, no chamfer, no shading, no lines cut inside either arm. Not a square, not a frame, not two brackets, not a letter L, not a letter V, not a step.
```

### Wettstreit (`phase_competition`)
```
Subject: exactly TWO stout straight bars crossing each other in an X, joined where they cross into one mass. Both are plain blunt beams at least a tenth of the frame thick with square-cut ends. They are of CLEARLY different length — one reaches corner to corner, the other is about two thirds as long — and they cross OFF-CENTRE, well above the middle of the longer bar, so the figure is never symmetric and never reads as a letter. The four magenta wedges left between the arms are wide and open. Nothing else: no pennants, no flags, no staffs, no ribbons, no third bar, no ring around them, no lines cut inside either bar. Not a letter X, not a plus sign, not a cross, not a star, not an asterisk, not scissors, not a saltire.
```

### Abrechnung (`phase_reckoning`)
```
Subject: TWO masses forming a balance that has already tipped. Below, a stout triangular fulcrum standing on the ground line of the motif: a broad blunt wedge, wider at its base than it is tall, with a flat top. Resting across that flat top and joined to it, ONE long straight BEAM, a plain bar at least a tenth of the frame thick, TILTED clearly — its left end dropped low and its right end raised high, never level. The beam is bare: no pans, no chains, no dishes, no hooks, no weights hang from it. Under each end of the beam a wide magenta wedge stays open. Nothing else at all, and no lines cut inside either part. Not a level balance, not a seesaw with children, not a pair of scales with dishes, not a letter, not an arrow, not a slash.
```

### Abgeschlossen (`phase_completed`)

⚠ Wachssiegel als volle Scheibe gestrichen (kompakte Vollform, ~48 % Deckung).
Es bleibt der Rand des Siegels und der Strich, der es entwertet.
```
Subject: ONE thick unbroken RING with a single straight BAR laid right across it, the two joined into one mass. The ring is a heavy closed band at least a tenth of the frame thick with a large open magenta hole in its middle, and that hole is the biggest single area in the picture. The bar is a plain blunt beam of the same thickness, running on a diagonal from the lower left to the upper right, crossing the ring's centre and jutting a little way past the ring on BOTH sides. The bar has square-cut ends and no head, no point and no barb. The ring stays whole: it is never snapped, notched or bitten anywhere. Nothing else: no second ring, no teeth on the rim, no wax, no ribbon, no lines cut inside either part. Not a prohibition sign, not a no-entry sign, not a percent sign, not a gear, not a wheel with spokes, not a clock, not a letter Q.
```

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
