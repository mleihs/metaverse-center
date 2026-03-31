# Konzept 4: Objektanker-System — Detaillierte Ausarbeitung

> 2026-03-31. 5 Variationen des Grundkonzepts, jede mit vollständigen Prosabeispielen,
> technischer Integration und Architektur-Analyse.

## Grundidee

Jeder Dungeon-Run platziert benannte physische Objekte, die als **thematische Anker**
durch den gesamten Run tragen. Diese Objekte tauchen in verschiedenen Kontexten auf —
Raumbeschreibungen, Banter, Encounter-Texte, Boss-Raum — und akkumulieren Bedeutung
durch Wiederholung (Thomas Manns Leitmotiv-Prinzip, angewandt auf Requisiten).

## Architektonische Prämisse

Das System ist **template-basiert** (kein LLM). Alle Texte sind bilingual (en/de),
vorverfasst, und werden zur Runtime über State-Felder auf `DungeonInstance` selektiert.
Objektanker sind **rein narrativ** — sie ändern keine Gameplay-Mechaniken.

---

## Variation A: "Stumme Zeugen" (Archäologische Objekte)

### Philosophie

Objekte erzählen die Geschichte **einer früheren Expedition**. Jedes Objekt impliziert
eine Person, die hier war, bevor die Spieler kamen. Der Spieler rekonstruiert deren
Schicksal aus den Fragmenten. Das Objekt ist ein Zeuge — es hat gesehen, was passiert
ist, aber es spricht nicht.

**Literarische Referenz:** Environmental Storytelling nach Jenkins (2004) —
"arranging objects to show outcomes, inviting players to construct narratives about
preceding events." Besonders wirksam in "historically depleted worlds."

### Objekt-Pool

Jedes Objekt hat 4 Phasen: **Entdeckung** (Depth 1–2), **Echo** (Depth 3),
**Mutation** (Depth 4–5), **Klimax** (Boss).

#### Shadow — "Die Notiz"

```
ENTDECKUNG (Depth 1, Raumbeschreibung):
en: "A note, folded once, pressed into a crack in the wall. The handwriting
    is steady: 'Visibility is not sight. It is permission.' Unsigned."
de: "Eine Notiz, einmal gefaltet, in einen Riss in der Wand gepresst.
    Die Handschrift ist ruhig: »Sichtbarkeit ist nicht Sehen.
    Es ist Erlaubnis.« Ohne Unterschrift."

ECHO (Depth 3, Banter):
en: "{agent} finds another note. Same handwriting, less steady:
    'The darkness learns faster than I do.'"
de: "{agent} findet eine weitere Notiz. Dieselbe Handschrift, weniger ruhig:
    »Die Dunkelheit lernt schneller als ich.«"

MUTATION (Depth 4–5, Encounter-Beschreibung):
en: "The walls here are covered in notes. Dozens. The handwriting deteriorates
    from page to page — steady, then hurried, then scratching, then shapes
    that are not letters. The last note is blank."
de: "Die Wände hier sind bedeckt mit Notizen. Dutzende. Die Handschrift
    verschlechtert sich von Seite zu Seite — ruhig, dann hastig, dann
    kratzend, dann Formen, die keine Buchstaben sind.
    Die letzte Notiz ist leer."

KLIMAX (Boss-Raum):
en: "The boss chamber. On the floor: a pen. Still warm. The ink is the same
    as the notes. Whoever wrote them did not leave this room."
de: "Die Bosskammer. Auf dem Boden: ein Stift. Noch warm. Die Tinte ist
    dieselbe wie auf den Notizen. Wer sie geschrieben hat, hat diesen Raum
    nicht verlassen."
```

#### Shadow — "Der Spiegel"

```
ENTDECKUNG:
en: "A mirror, face-down on the floor. Unbroken. Someone placed it
    deliberately — not dropped, not discarded. Placed."
de: "Ein Spiegel, mit der Fläche nach unten auf dem Boden. Unzerbrochen.
    Jemand hat ihn absichtlich so hingelegt — nicht fallen gelassen,
    nicht weggeworfen. Hingelegt."

ECHO:
en: "{agent} passes another mirror. This one faces the wall.
    The glass is fogged, as if something on the other side is breathing."
de: "{agent} passiert einen weiteren Spiegel. Dieser zeigt zur Wand.
    Das Glas ist beschlagen, als würde etwas auf der anderen Seite atmen."

MUTATION:
en: "Mirrors. Everywhere. All facing away. The room is full of reflections
    that have nowhere to go — light bouncing between reversed surfaces,
    dimming with each pass. The air is thick with trapped images."
de: "Spiegel. Überall. Alle abgewandt. Der Raum ist voller Reflexionen,
    die nirgendwo hinkönnen — Licht, das zwischen umgedrehten Flächen
    springt, mit jedem Durchgang schwächer. Die Luft ist schwer
    von gefangenen Bildern."

KLIMAX:
en: "One mirror remains, facing outward. In it: not your reflection.
    Someone else's. They look exhausted. They look like they have been
    watching you since the first room."
de: "Ein Spiegel bleibt, nach außen gerichtet. Darin: nicht eure Reflexion.
    Die eines anderen. Sie sehen erschöpft aus. Sie sehen aus, als hätten
    sie euch seit dem ersten Raum beobachtet."
```

#### Tower — "Der Grundriss"

```
ENTDECKUNG:
en: "A blueprint pinned to the reception desk. Floor plans for a building
    that does not match this one — or rather, matches it as it was designed,
    before the floors began to disagree with each other."
de: "Ein Bauplan, auf den Empfangstresen geheftet. Grundrisse eines Gebäudes,
    das nicht zu diesem passt — oder vielmehr: das zu diesem passt, wie es
    entworfen war, bevor die Stockwerke anfingen, einander zu widersprechen."

ECHO:
en: "{agent} finds the same blueprint, updated. New floors have been added
    in a different hand. The new floors have no exits."
de: "{agent} findet denselben Bauplan, aktualisiert. Neue Stockwerke wurden
    von einer anderen Hand ergänzt. Die neuen Stockwerke haben keine Ausgänge."

MUTATION:
en: "The blueprint is here again. It has been corrected — every room you have
    entered is now marked. Your route is drawn in red. The red line continues
    beyond your current position. It ends in the room above this one."
de: "Der Bauplan ist wieder hier. Er wurde korrigiert — jeder Raum, den ihr
    betreten habt, ist jetzt markiert. Eure Route ist rot eingezeichnet.
    Die rote Linie geht über eure aktuelle Position hinaus. Sie endet
    im Raum über diesem."

KLIMAX:
en: "The Crown Keeper's desk: the original blueprint. Architect's signature
    at the bottom. The name is yours."
de: "Das Pult des Crown Keepers: der Original-Bauplan. Architektenunterschrift
    am unteren Rand. Der Name ist eurer."
```

#### Tower — "Die Quittung"

```
ENTDECKUNG:
en: "A receipt, pressed under a paperweight. The transaction: one structural
    guarantee, purchased at a price that has been redacted. The guarantee
    expired three floors ago."
de: "Eine Quittung, unter einem Briefbeschwerer. Die Transaktion: eine
    Strukturgarantie, erworben zu einem Preis, der geschwärzt wurde.
    Die Garantie ist drei Stockwerke zuvor abgelaufen."

ECHO:
en: "Another receipt. Same format, different transaction. This one purchases
    time. The amount: 'remaining.'"
de: "Eine weitere Quittung. Dasselbe Format, andere Transaktion. Diese kauft
    Zeit. Der Betrag: »verbleibend«."

MUTATION:
en: "Receipts cover the floor like snow. Each one a guarantee — structural,
    temporal, existential. All expired. The dates are sequential.
    The last date is today."
de: "Quittungen bedecken den Boden wie Schnee. Jede eine Garantie —
    strukturell, temporal, existenziell. Alle abgelaufen. Die Daten sind
    fortlaufend. Das letzte Datum ist heute."

KLIMAX:
en: "The Crown Keeper extends a blank receipt. 'The final transaction',
    they say. 'Sign here. The building accepts all forms of collateral.'"
de: "Der Crown Keeper reicht eine leere Quittung. »Die letzte Transaktion«,
    sagt er. »Hier unterschreiben. Das Gebäude akzeptiert alle Formen
    von Sicherheit.«"
```

#### Mother — "Das Nest"

```
ENTDECKUNG:
en: "A nest. Not built — grown. Woven from cables and tissue and something
    that might once have been clothing. It is warm. It is sized for one.
    The shape inside it has not been here for a long time.
    The nest doesn't know that yet."
de: "Ein Nest. Nicht gebaut — gewachsen. Gewoben aus Kabeln und Gewebe
    und etwas, das einmal Kleidung gewesen sein könnte. Es ist warm.
    Es ist für eine Person bemessen. Die Form darin ist seit langem fort.
    Das Nest weiß das noch nicht."

ECHO:
en: "{agent} pauses. Another nest — larger. Room for three.
    The tissue is fresher here. It pulses."
de: "{agent} hält inne. Ein weiteres Nest — größer. Platz für drei.
    Das Gewebe ist frischer hier. Es pulsiert."

MUTATION:
en: "The nests are everywhere now. They line the walls, the ceiling, the floor.
    Some contain shapes — curled, still, breathing. You cannot tell if they
    are sleeping or being digested. The distinction may not matter here."
de: "Die Nester sind jetzt überall. Sie säumen die Wände, die Decke, den Boden.
    Einige enthalten Formen — zusammengerollt, still, atmend. Ob sie schlafen
    oder verdaut werden, lässt sich nicht sagen. Die Unterscheidung
    ist hier vielleicht bedeutungslos."

KLIMAX:
en: "The final chamber: one nest. Vast. It is not in the room — it IS the room.
    The walls are woven. The floor gives like skin. And at the center,
    a hollow, warm and shaped exactly like your party.
    It has been expecting you."
de: "Die letzte Kammer: ein Nest. Riesig. Es ist nicht im Raum — es IST
    der Raum. Die Wände sind gewoben. Der Boden gibt nach wie Haut.
    Und in der Mitte eine Mulde, warm und genau geformt wie eure Gruppe.
    Es hat euch erwartet."
```

#### Entropy — "Die Uhr"

```
ENTDECKUNG:
en: "A clock. No hands. The face is intact — numbers present, glass uncracked.
    But the mechanism has been removed with surgical precision. Not broken.
    Emptied. The clock does not tell time. Time does not apply here."
de: "Eine Uhr. Keine Zeiger. Das Zifferblatt ist intakt — Zahlen vorhanden,
    Glas unversehrt. Aber das Uhrwerk wurde mit chirurgischer Präzision
    entfernt. Nicht zerbrochen. Entleert. Die Uhr zeigt keine Zeit.
    Zeit gilt hier nicht."

ECHO (Decay 40+):
en: "{agent} finds the clock again. Or a clock. They are becoming difficult
    to distinguish."
de: "{agent} findet die Uhr wieder. Oder eine Uhr. Sie werden schwer
    zu unterscheiden."

MUTATION (Decay 70+):
en: "Clocks. Faces. No hands. Same."
de: "Uhren. Zifferblätter. Keine Zeiger. Gleich."

KLIMAX (Decay 85+):
en: "Clock."
de: "Uhr."
```

### Technische Umsetzung

```python
# Neues Datenmodell
class AnchorObject(BaseModel):
    id: str                          # z.B. "shadow_note", "tower_blueprint"
    archetype: str
    phase_texts: dict[str, dict]     # {"discovery": {"en": ..., "de": ...}, ...}

# Neues Feld auf DungeonInstance
class DungeonInstance(BaseModel):
    ...
    anchor_objects: list[str] = Field(default_factory=list)  # 2 IDs pro Run

# Selektion bei Run-Erstellung (in create_run)
anchor_pool = ANCHOR_OBJECTS[archetype]
selected = random.sample(anchor_pool, min(2, len(anchor_pool)))
instance.anchor_objects = [a.id for a in selected]

# Injection in Raumbeschreibung (in move_to_room)
# Discovery-Text wird an Depth 1–2 Raumbeschreibungen angehängt
# Echo-Text wird als Banter-Alternative bei Depth 3 injiziert
# Mutation-Text wird in Encounter-Beschreibung bei Depth 4–5 eingewoben
# Klimax-Text wird der Boss-Raum-Beschreibung vorangestellt
```

### Checkpoint-Erweiterung

```python
def to_checkpoint(self) -> dict:
    return {
        ...
        "anchor_objects": self.anchor_objects,
    }
```

### Vorteile

- **Narrativer Bogen**: Lose Raumfolge wird zu kohärenter Geschichte
- **Replay-Wert**: Verschiedene Runs → verschiedene Objekte → verschiedene Geschichten
- **Kein LLM**: Alles vorverfasst, deterministisch
- **Archetype-kohärent**: Jedes Objekt verstärkt die literarische DNA

### Nachteile

- Authoring-Aufwand: ~6 Objekte × 4 Phasen × 4 Archetypes × 2 Sprachen = ~192 Textblöcke
- Raumbeschreibungen werden länger (Discovery-Phase)

---

## Variation B: "Resonanz-Barometer" (State-reaktive Objekte)

### Philosophie

Ein einziges Objekt pro Run, das auf den **Archetype-State** reagiert.
Das Objekt ist ein narrativer Barometer: sein Zustand spiegelt die Gesundheit
des Dungeons wider. Es ändert sich nicht durch Spieleraktionen, sondern durch
den mechanischen Zustand (Visibility, Structural Integrity, Decay, Attachment).

**Literarische Referenz:** Borges' Aleph — ein Punkt, der alles enthält.
Oscar Wildes Dorian Gray — das Portrait als sichtbares Gewissen.

### Funktionsprinzip

Das Objekt hat **keinen festen Text pro Depth**, sondern **Text pro State-Schwelle**.
Es wird bei jedem Raumbetreten als optionaler Banter-Suffix angezeigt, wenn sich
der State seit dem letzten Check verändert hat.

#### Shadow — "Der Bernstein" (Visibility-Barometer)

```
VISIBILITY 3 (Voll):
en: "The amber terminal glow pulses steadily. Warm. Present. It knows where you are."
de: "Das Bernsteinleuchten des Terminals pulsiert gleichmäßig. Warm. Gegenwärtig.
    Es weiß, wo ihr seid."

VISIBILITY 2:
en: "The amber glow flickers. For the first time, the terminal seems uncertain."
de: "Das Bernsteinleuchten flackert. Zum ersten Mal wirkt das Terminal unsicher."

VISIBILITY 1:
en: "The amber is fading. The terminal light gutters like a candle in a draft
    that should not exist in a digital space."
de: "Das Bernstein verblasst. Das Terminallicht flackert wie eine Kerze
    im Durchzug, den es in einem digitalen Raum nicht geben sollte."

VISIBILITY 0:
en: "The amber is gone. The terminal is dark. You are operating from memory now,
    and memory is exactly what the darkness consumes first."
de: "Das Bernstein ist erloschen. Das Terminal ist dunkel. Ihr operiert
    aus der Erinnerung, und Erinnerung ist genau das, was die Dunkelheit
    zuerst verzehrt."
```

#### Tower — "Der Riss" (Structural-Integrity-Barometer)

```
INTEGRITY 100–80%:
en: "A hairline crack in the east wall. Cosmetic. The building compensates."
de: "Ein Haarriss in der Ostwand. Kosmetisch. Das Gebäude kompensiert."

INTEGRITY 79–50%:
en: "The crack has branched. The building no longer compensates — it negotiates."
de: "Der Riss hat sich verzweigt. Das Gebäude kompensiert nicht mehr — es verhandelt."

INTEGRITY 49–25%:
en: "The crack network spans the room. Through it, you can see the floor below.
    Through that, another floor. The building is becoming transparent in its failure."
de: "Das Rissnetzwerk durchzieht den Raum. Durch ihn seht ihr das Stockwerk
    darunter. Durch jenes ein weiteres. Das Gebäude wird transparent in seinem Versagen."

INTEGRITY <25%:
en: "The crack is the room. The walls are suggestions. The floor is a theory.
    The building has stopped pretending."
de: "Der Riss ist der Raum. Die Wände sind Vorschläge. Der Boden ist eine Theorie.
    Das Gebäude hat aufgehört, so zu tun als ob."
```

#### Mother — "Die Temperatur" (Attachment-Barometer)

```
ATTACHMENT 0–30:
en: "The air is warm. Comfortable. The kind of warmth that asks nothing of you."
de: "Die Luft ist warm. Behaglich. Die Art von Wärme, die nichts von euch verlangt."

ATTACHMENT 31–60:
en: "The warmth has learned your names. It wraps around wounded agents first.
    Attentive. Helpful. You did not ask for this."
de: "Die Wärme hat eure Namen gelernt. Sie legt sich zuerst um verwundete Agenten.
    Aufmerksam. Hilfsbereit. Ihr habt nicht darum gebeten."

ATTACHMENT 61–85:
en: "The warmth is possessive now. It does not let go when you stand.
    Moving through it feels like pulling free of an embrace
    that doesn't understand the word 'enough.'"
de: "Die Wärme ist besitzergreifend jetzt. Sie lässt nicht los, wenn ihr aufsteht.
    Sich durch sie zu bewegen fühlt sich an wie das Lösen aus einer Umarmung,
    die das Wort »genug« nicht versteht."

ATTACHMENT 86–100:
en: "The warmth is indistinguishable from you. Where it ends and you begin
    is a question that no longer has a clear answer.
    It does not hurt. That is the worst part."
de: "Die Wärme ist nicht mehr von euch zu unterscheiden. Wo sie aufhört und
    ihr beginnt, ist eine Frage, die keine klare Antwort mehr hat.
    Es tut nicht weh. Das ist das Schlimmste."
```

#### Entropy — "Die Farbe" (Decay-Barometer)

```
DECAY 0–20:
en: "The walls retain color. Faded, but distinguishable.
    This room was green once. Or blue. The difference still matters."
de: "Die Wände haben noch Farbe. Verblasst, aber unterscheidbar.
    Dieser Raum war einmal grün. Oder blau. Der Unterschied zählt noch."

DECAY 21–50:
en: "The color is retreating. Not fading — redistributing.
    Every surface is approaching the same shade."
de: "Die Farbe weicht zurück. Nicht verblassend — umverteilend.
    Jede Oberfläche nähert sich demselben Ton."

DECAY 51–80:
en: "Grey. Not the grey of concrete or ash — the grey of averaged everything."
de: "Grau. Nicht das Grau von Beton oder Asche — das Grau des Durchschnitts
    von allem."

DECAY 81–100:
en: "Same."
de: "Gleich."
```

### Technische Umsetzung

```python
# Kein neues Feld nötig — liest direkt aus archetype_state
BAROMETER_TEXTS: dict[str, list[dict]] = {
    "The Shadow": [
        {"threshold": ("visibility", 3, 3), "text_en": "...", "text_de": "..."},
        {"threshold": ("visibility", 2, 2), "text_en": "...", "text_de": "..."},
        ...
    ],
    ...
}

# In move_to_room: nach Banter-Selektion
barometer = get_barometer_text(instance.archetype, instance.archetype_state)
if barometer and barometer != instance.archetype_state.get("_last_barometer"):
    # Nur anzeigen, wenn sich der State verändert hat
    result["barometer"] = barometer
    instance.archetype_state["_last_barometer"] = barometer["id"]
```

### Vorteile

- **Minimalster State-Aufwand**: Liest bestehenden `archetype_state`, kein neues Feld
- **Mechanik-Narrativ-Brücke**: Spieler "fühlen" die Mechanik durch Prosa
- **Weniger Authoring**: ~4 Objekte × 4 Schwellen × 4 Archetypes × 2 Sprachen = ~128 Texte
- **Eleganz**: Ein Objekt pro Archetype, nicht austauschbar — wird zum Markenzeichen

### Nachteile

- Weniger Replay-Variation (immer dasselbe Barometer-Objekt pro Archetype)
- Risiko der Redundanz mit bestehenden Archetype-Drain-Anzeigen (Visibility-Leiste etc.)

---

## Variation C: "Wandernde Dinge" (Objektmigration durch Räume)

### Philosophie

Ein Objekt wird in Raum 1 gefunden und **bewegt sich durch den Dungeon** — unabhängig
vom Spieler. Es taucht in späteren Räumen in verändertem Zustand auf. Das Objekt hat
eine eigene Reise, parallel zur Party. Der Spieler beobachtet, wie der Dungeon das
Objekt verändert — und versteht dadurch, was der Dungeon auch mit der Party tut.

**Literarische Referenz:** Cortázars "Hopscotch" — Objekte, die in verschiedenen
Kapitelreihenfolgen verschiedene Bedeutungen tragen. Borges' Bibliothek von Babel —
identische Objekte in verschiedenen Kontexten werden verschieden.

### Objekt-Pool

#### Shadow — "Die Waffe"

```
RAUM 1 (Entdeckung):
en: "A weapon on the floor. Still warm. Not dropped — placed.
    Arranged, as if someone wanted it found.
    The arrangement is precise. Military. Recent."
de: "Eine Waffe auf dem Boden. Noch warm. Nicht fallen gelassen — hingelegt.
    Arrangiert, als wollte jemand, dass sie gefunden wird.
    Die Anordnung ist präzise. Militärisch. Frisch."

RAUM 3 (Wiederfund):
en: "The same weapon — or its twin. This one is cold.
    The arrangement is identical, but the precision has softened.
    As if the darkness copied the placement from memory
    and memory is not its strongest faculty."
de: "Dieselbe Waffe — oder ihr Zwilling. Diese ist kalt.
    Die Anordnung ist identisch, aber die Präzision hat nachgelassen.
    Als hätte die Dunkelheit die Platzierung aus der Erinnerung kopiert,
    und Erinnerung ist nicht ihre stärkste Fähigkeit."

RAUM 4 (Verfremdung):
en: "Three weapons now. The arrangement has become a pattern.
    The pattern has become a message. The message reads:
    'You are not the first. You are not the last.
    You are not even the most interesting.'"
de: "Drei Waffen jetzt. Die Anordnung ist ein Muster geworden.
    Das Muster ist eine Nachricht geworden. Die Nachricht lautet:
    »Ihr seid nicht die Ersten. Ihr seid nicht die Letzten.
    Ihr seid nicht einmal die Interessantesten.«"

BOSS (Auflösung):
en: "Your weapons. On the floor. Arranged. You are still holding them.
    The darkness has learned to copy more than placement."
de: "Eure Waffen. Auf dem Boden. Arrangiert. Ihr haltet sie noch in der Hand.
    Die Dunkelheit hat gelernt, mehr als Platzierung zu kopieren."
```

#### Tower — "Der Fahrstuhlknopf"

```
RAUM 1:
en: "An elevator button. Floor -1. Pressed so many times the brass is worn
    concave. The elevator never came."
de: "Ein Fahrstuhlknopf. Stockwerk -1. So oft gedrückt, dass das Messing
    konkav geschliffen ist. Der Fahrstuhl kam nie."

RAUM 3:
en: "The same button, three floors higher. The brass is pristine now —
    unworn, as if this version has never been pressed.
    It is warm to the touch. Expectant."
de: "Derselbe Knopf, drei Stockwerke höher. Das Messing ist jetzt makellos —
    unbenutzt, als wäre diese Version nie gedrückt worden.
    Er ist warm. Erwartungsvoll."

RAUM 4:
en: "Floor -1 again. The button is pressed in. Permanently.
    It will not release. The floor indicator above it reads
    your current floor. It has been following you."
de: "Stockwerk -1, wieder. Der Knopf ist eingedrückt. Permanent.
    Er lässt sich nicht lösen. Die Stockwerksanzeige darüber
    zeigt euer aktuelles Stockwerk. Er ist euch gefolgt."

BOSS:
en: "The Crown Keeper's room has no elevator.
    The button is here anyway. Floor 0. The brass is worn
    by a hand that is not human. The elevator arrived.
    It is empty."
de: "Der Raum des Crown Keepers hat keinen Fahrstuhl.
    Der Knopf ist trotzdem hier. Stockwerk 0. Das Messing
    ist abgegriffen von einer Hand, die nicht menschlich ist.
    Der Fahrstuhl ist angekommen. Er ist leer."
```

#### Mother — "Das Lied"

```
RAUM 1:
en: "Something is humming. Not the walls — something behind the walls.
    A lullaby. The melody is incomplete. Three notes, repeating.
    Your agents recognize it. They shouldn't.
    None of them have children."
de: "Etwas summt. Nicht die Wände — etwas hinter den Wänden.
    Ein Schlaflied. Die Melodie ist unvollständig. Drei Noten, wiederholend.
    Eure Agenten erkennen es. Das sollten sie nicht.
    Keiner von ihnen hat Kinder."

RAUM 3:
en: "The lullaby again. Five notes now. It has grown.
    {agent} catches themselves humming along.
    They stop. The lullaby doesn't."
de: "Das Schlaflied wieder. Fünf Noten jetzt. Es ist gewachsen.
    {agent} ertappt sich beim Mitsummen.
    Sie hören auf. Das Schlaflied nicht."

RAUM 4:
en: "The lullaby is a full song now. It fills the corridor.
    The tissue walls vibrate in harmony. Your agents are moving
    in rhythm with it — not walking, swaying.
    The song did not ask permission. Neither did they."
de: "Das Schlaflied ist jetzt ein vollständiges Lied. Es füllt den Korridor.
    Die Gewebewände vibrieren in Harmonie. Eure Agenten bewegen sich
    im Rhythmus — nicht gehend, wiegend.
    Das Lied hat nicht um Erlaubnis gefragt. Sie auch nicht."

BOSS:
en: "Silence. The lullaby stops. For the first time in five rooms,
    there is no music. The silence is not relief. It is abandonment.
    {agent} begins humming — filling the gap the song left behind.
    The dungeon listens. Pleased."
de: "Stille. Das Schlaflied verstummt. Zum ersten Mal seit fünf Räumen
    keine Musik. Die Stille ist keine Erleichterung. Sie ist Verlassenwerden.
    {agent} beginnt zu summen — füllt die Lücke, die das Lied hinterlassen hat.
    Der Dungeon hört zu. Zufrieden."
```

#### Entropy — "Das Wort"

```
RAUM 1:
en: "On the wall, etched in something that was once a distinct material:
    'REMEMBER.' The letters are precise. The word is clear.
    The medium is already uncertain."
de: "An der Wand, geritzt in etwas, das einmal ein bestimmtes Material war:
    »ERINNERN.« Die Buchstaben sind präzise. Das Wort ist klar.
    Das Medium ist bereits unsicher."

RAUM 3:
en: "'RMMBER.' Same wall. Same etching. The vowels have equalized
    into the surrounding stone."
de: "»ERNNRN.« Dieselbe Wand. Dieselbe Ritzung.
    Die Vokale haben sich in den umgebenden Stein angeglichen."

RAUM 4:
en: "Scratches. Were they letters? The wall is the same texture
    as the scratches. The message is the medium. The medium is the wall.
    The wall is grey."
de: "Kratzer. Waren es Buchstaben? Die Wand hat dieselbe Textur
    wie die Kratzer. Die Nachricht ist das Medium. Das Medium
    ist die Wand. Die Wand ist grau."

BOSS:
en: "Wall."
de: "Wand."
```

### Technische Umsetzung

Identisch mit Variation A. Der Unterschied liegt im **narrativen Prinzip**:
Variation A → Objekt ist statisch, Spieler bewegt sich daran vorbei.
Variation C → Objekt bewegt sich, Spieler beobachtet seine Veränderung.

### Vorteile

- **Stärkstes narratives Prinzip**: Das Objekt hat eine eigene "Handlung"
- **Spiegelt Archetype-Effekte**: Objekt zeigt, was der Dungeon auch mit Spielern tut
- **Mother-Lied ist S-tier**: Das Lied, das wächst und dann verstummt, ist brillant

### Nachteile

- Erfordert, dass der Spieler das Objekt wiedererkennt (Name muss konsistent sein)
- Authoring-Aufwand wie Variation A (~192 Textblöcke)

---

## Variation D: "Gebrochene Perspektiven" (Aptitude-gefilterte Objektwahrnehmung)

### Philosophie

Es gibt pro Run **ein Objekt**, aber jeder Agent sieht es **anders** — gefiltert durch
seine dominante Aptitude. Das Objekt ist nicht objektiv beschreibbar. Es ist ein
Rorschach-Test. Was der Agent darin sieht, enthüllt mehr über den Agenten als über
das Objekt.

**Literarische Referenz:** Rashomon (Kurosawa) — dasselbe Ereignis, verschiedene
Wahrheiten. Faulkners "The Sound and the Fury" — drei Brüder, drei Wahrnehmungen.
Disco Elysiums Skill-Stimmen — "Shivers perceives what should be unperceivable."

### Funktionsprinzip

Bei jedem Raumbetreten wählt das System einen Agenten aus. Dessen dominante
Aptitude bestimmt, welche Version des Objekttexts angezeigt wird. So sieht der
Spieler dasselbe Objekt durch 3–4 verschiedene Linsen im Laufe eines Runs.

#### Universalobjekt Shadow: "Die Markierung an der Wand"

```
SPY-PERSPEKTIVE:
en: "{agent} studies the marks. Pattern recognition: not random. Intervals
    of 3, 7, 13 — prime numbers. Someone was counting something.
    The intervals decrease. Whatever they counted was accelerating."
de: "{agent} studiert die Markierungen. Mustererkennung: nicht zufällig.
    Intervalle von 3, 7, 13 — Primzahlen. Jemand hat etwas gezählt.
    Die Intervalle werden kürzer. Was auch immer gezählt wurde, beschleunigte."

GUARDIAN-PERSPEKTIVE:
en: "{agent} assesses the marks. Fingernails. Approximately six centimeters deep.
    The angle suggests someone being dragged. Toward the interior.
    The marks stop where the darkness begins."
de: "{agent} beurteilt die Markierungen. Fingernägel. Ungefähr sechs Zentimeter tief.
    Der Winkel deutet darauf hin, dass jemand gezogen wurde. Nach innen.
    Die Markierungen enden dort, wo die Dunkelheit beginnt."

ASSASSIN-PERSPEKTIVE:
en: "{agent} reads the marks. Kill tallies. Standard notation — one group of five,
    then three singles. Eight contacts, eight resolutions.
    The ninth mark is incomplete. Interrupted."
de: "{agent} liest die Markierungen. Strichliste. Standardnotation — eine
    Fünfergruppe, dann drei Einzelne. Acht Kontakte, acht Abschlüsse.
    Die neunte Markierung ist unvollständig. Unterbrochen."

PROPAGANDIST-PERSPEKTIVE:
en: "{agent} interprets the marks. Not tallies. Not scratches. A sentence,
    written in a script that does not exist yet — or no longer exists.
    The meaning is felt before it is read: 'We were wrong to come here.
    We were right to try.'"
de: "{agent} deutet die Markierungen. Keine Strichliste. Keine Kratzer.
    Ein Satz, geschrieben in einer Schrift, die es noch nicht gibt —
    oder nicht mehr gibt. Die Bedeutung wird gefühlt, bevor sie gelesen wird:
    »Wir hatten Unrecht, herzukommen. Wir hatten Recht, es zu versuchen.«"

SABOTEUR-PERSPEKTIVE:
en: "{agent} examines the marks. Stress fractures — not in the wall,
    in whatever the wall is made of at a molecular level.
    Someone applied force here. Not to escape. To test the structure.
    The structure failed. This room has a weakness."
de: "{agent} untersucht die Markierungen. Spannungsrisse — nicht in der Wand,
    in dem, woraus die Wand auf molekularer Ebene besteht. Jemand hat hier
    Kraft angewandt. Nicht um zu fliehen. Um die Struktur zu testen.
    Die Struktur hat versagt. Dieser Raum hat eine Schwachstelle."
```

#### Universalobjekt Tower: "Das Formular auf dem Schreibtisch"

```
SPY-PERSPEKTIVE:
en: "{agent} reads the form. Classified — three levels of redaction.
    The visible portions describe a requisition for materials
    that do not appear in any known supply chain."
de: "{agent} liest das Formular. Verschlusssache — drei Schwärzungsstufen.
    Die sichtbaren Teile beschreiben eine Materialanforderung
    für Güter, die in keiner bekannten Lieferkette vorkommen."

GUARDIAN-PERSPEKTIVE:
en: "{agent} scans the form. Structural inspection report. Every checkbox
    reads 'acceptable.' The signature is dated after the first collapse.
    Someone signed off on a building that was already failing."
de: "{agent} überfliegt das Formular. Baustatik-Prüfbericht. Jedes Feld
    liest: »akzeptabel«. Die Unterschrift ist nach dem ersten Einsturz
    datiert. Jemand hat ein Gebäude abgenommen, das bereits versagte."

PROPAGANDIST-PERSPEKTIVE:
en: "{agent} studies the form. A prayer, formatted as bureaucracy.
    The margins contain annotations in a desperate hand:
    'If the form is complete, the building holds.
    If the building holds, we were never wrong.'"
de: "{agent} studiert das Formular. Ein Gebet, formatiert als Bürokratie.
    Die Ränder enthalten Anmerkungen in verzweifelter Handschrift:
    »Wenn das Formular vollständig ist, hält das Gebäude.
    Wenn das Gebäude hält, hatten wir nie Unrecht.«"
```

### Technische Umsetzung

```python
# Banter-Template-Erweiterung
{
    "id": "anchor_shadow_marks_spy",
    "trigger": "room_entered",
    "aptitude_voice": "spy",       # NEU: selektiert Agent mit höchstem Spy-Wert
    "anchor_object": True,          # NEU: markiert als Objektanker-Banter
    "personality_filter": {},
    "text_en": "...",
    "text_de": "...",
}

# In select_banter: neues Matching
if candidate.get("aptitude_voice"):
    # Wähle Agent mit höchstem Wert in dieser Aptitude
    best = max(agents, key=lambda a: a["aptitudes"].get(voice, 0))
    # Nur auslösen, wenn Agent mindestens Stufe 3 hat
    if best["aptitudes"].get(voice, 0) < 3:
        continue
```

### Vorteile

- **Tiefste Charakterisierung**: Agenten werden durch ihre Wahrnehmung definiert
- **Replay-Wert**: Andere Party-Zusammensetzung → andere Perspektiven → andere Geschichte
- **Synergie mit Konzept 2** (Aptitude-Stimmen): Dieses System IST die Implementierung
- **Ökonomisch**: 1 Objekt × 5 Perspektiven × 4 Archetypes = ~80 Texte (weniger als A/C)

### Nachteile

- Braucht Aptitude-Daten im Banter-Selection (erfordert Erweiterung der Agent-Dicts)
- Kein narrativer Bogen des Objekts selbst (Objekt bleibt statisch, nur Perspektive wechselt)
- Funktioniert am besten mit diverser Party (mono-Aptitude-Parties sehen nur eine Perspektive)

---

## Variation E: "Palimpsest" (Synthese: Schichtung aller Variationen)

### Philosophie

Das ambitionierteste Modell. Kombination der stärksten Elemente aus A–D:

1. **Wanderndes Objekt** (aus C): Das Objekt verändert sich durch den Dungeon
2. **Perspektiv-Filter** (aus D): Verschiedene Agenten sehen es verschieden
3. **State-Reaktivität** (aus B): Der Archetype-State beeinflusst die Beschreibung
4. **Archäologische Implikation** (aus A): Das Objekt trägt die Geschichte Früherer

Ein **Palimpsest** ist ein Pergament, das mehrfach beschrieben wurde — die früheren
Schichten scheinen durch. Das Objekt ist ein Palimpsest: jede Begegnung schreibt
eine neue Schicht, aber die früheren bleiben sichtbar.

**Literarische Referenz:** Genettes Palimpsest-Theorie — jeder Text ist ein
Palimpsest anderer Texte. W.G. Sebalds "Austerlitz" — Orte als geschichtete
Erinnerungsspeicher. Manns "Doktor Faustus" — Leitmotive, die sich durch
Wiederholung transformieren.

### Funktionsprinzip

Pro Run wird **1 Objekt** gewählt. Es hat:
- **4 Depth-Varianten** (wie C: Entdeckung → Echo → Mutation → Klimax)
- **2–3 Aptitude-Varianten** pro Depth (wie D: verschiedene Agenten, verschiedene Lesart)
- **State-Modifier** (wie B: Text variiert leicht basierend auf archetype_state)

#### Beispiel: Shadow — "Die Schwelle"

```
DEPTH 1, SPY (Visibility 3):
en: "{agent} studies the threshold. A line of absolute dark cuts the floor.
    On this side: dim amber light. On that side: blind.
    The line is precise. Measured. Someone drew this border."
de: "{agent} studiert die Schwelle. Eine Linie absoluter Dunkelheit schneidet
    den Boden. Auf dieser Seite: gedämpftes Bernsteinlicht. Auf jener: blind.
    Die Linie ist präzise. Vermessen. Jemand hat diese Grenze gezogen."

DEPTH 1, GUARDIAN (Visibility 3):
en: "{agent} assesses the threshold. Defensible if held from this side.
    The dark beyond is total — no sight lines, no fallback positions.
    Crossing means abandoning every tactical advantage this room offers."
de: "{agent} beurteilt die Schwelle. Verteidigbar, wenn von dieser Seite gehalten.
    Die Dunkelheit dahinter ist total — keine Sichtlinien, keine Rückzugspositionen.
    Überqueren heißt, jeden taktischen Vorteil aufzugeben, den dieser Raum bietet."

DEPTH 3, SPY (Visibility 2):
en: "Another threshold. The dark on both sides now — the border has moved.
    {agent} notes that the measurement system itself has shifted.
    The precision is still there. But whose precision?"
de: "Eine weitere Schwelle. Die Dunkelheit jetzt auf beiden Seiten —
    die Grenze hat sich verschoben. {agent} bemerkt, dass das Messsystem
    selbst sich verändert hat. Die Präzision ist noch da. Aber wessen Präzision?"

DEPTH 3, GUARDIAN (Visibility 1):
en: "The threshold is behind you now. It followed.
    {agent} registers that the defensible position no longer exists —
    not because it collapsed, but because the darkness redefined
    what 'position' means."
de: "Die Schwelle ist jetzt hinter euch. Sie ist gefolgt.
    {agent} registriert, dass die verteidigbare Position nicht mehr existiert —
    nicht weil sie zusammenbrach, sondern weil die Dunkelheit neu definiert hat,
    was »Position« bedeutet."

DEPTH 5 / BOSS (Visibility 0):
en: "There is no threshold. There is no dark side and light side.
    The border was never between rooms. It was between you
    and understanding what you descended into.
    That border dissolved three rooms ago.
    You are inside the dark now. The dark is inside you.
    The difference was always academic."
de: "Es gibt keine Schwelle. Es gibt keine dunkle und keine helle Seite.
    Die Grenze war nie zwischen den Räumen. Sie war zwischen euch
    und dem Verständnis dessen, was ihr betreten habt.
    Diese Grenze löste sich drei Räume zuvor auf.
    Ihr seid jetzt in der Dunkelheit. Die Dunkelheit ist in euch.
    Der Unterschied war immer akademisch."
```

### Technische Umsetzung

```python
class AnchorPhaseText(BaseModel):
    depth_range: tuple[int, int]            # (1, 2), (3, 4), (5, 99)
    aptitude_voice: str | None = None       # None = universal
    state_threshold: dict | None = None     # {"visibility": (0, 1)} = nur bei niedrig
    text_en: str
    text_de: str

class PalimpsestObject(BaseModel):
    id: str
    archetype: str
    phases: list[AnchorPhaseText]

# Selektion in move_to_room:
def get_palimpsest_text(
    instance: DungeonInstance,
    agents: list[AgentCombatState],
) -> dict | None:
    obj_id = instance.anchor_objects[0] if instance.anchor_objects else None
    if not obj_id:
        return None
    obj = PALIMPSEST_OBJECTS[obj_id]
    depth = instance.depth

    # Filtere nach Depth
    candidates = [p for p in obj.phases
                  if p.depth_range[0] <= depth <= p.depth_range[1]]

    # Filtere nach State-Threshold
    candidates = [p for p in candidates
                  if _matches_state(p.state_threshold, instance.archetype_state)]

    # Bevorzuge Aptitude-Voice wenn verfügbar
    alive = [a for a in agents if can_act(a.condition)]
    voiced = [p for p in candidates if p.aptitude_voice]
    if voiced and alive:
        # Wähle Voice des besten verfügbaren Agenten
        best_match = max(
            voiced,
            key=lambda p: max(
                a.aptitudes.get(p.aptitude_voice, 0) for a in alive
            ),
        )
        if max(a.aptitudes.get(best_match.aptitude_voice, 0) for a in alive) >= 3:
            return {"text_en": best_match.text_en, "text_de": best_match.text_de}

    # Fallback: universal
    universal = [p for p in candidates if not p.aptitude_voice]
    return random.choice(universal) if universal else None
```

### Vorteile

- **Reichste Erfahrung**: Jeder Run, jede Party-Komposition, jeder State-Verlauf → einzigartig
- **Maximale literarische Tiefe**: Schichtung wie bei Sebald oder Genette
- **Vereint alle Stärken**: Narrativer Bogen + Perspektive + Mechanik-Spiegel
- **Ein Objekt pro Run reicht**: Die Variation kommt aus der Schichtung, nicht der Menge

### Nachteile

- **Höchster Authoring-Aufwand**: ~4 Archetypes × 3 Depths × 3 Voices + Universal = ~60+ Texte pro Objekt
- **Komplexeste Selektion**: Depth × State × Aptitude-Matching
- **Risiko der Überladung**: Zu viel Text pro Raumbetreten

---

## Vergleichsmatrix

| Kriterium | A: Stumme Zeugen | B: Barometer | C: Wandernde Dinge | D: Perspektiven | E: Palimpsest |
|-----------|-----------------|--------------|--------------------|-----------------|--------------:|
| Narrativer Bogen | Stark | Schwach | Sehr stark | Mittel | Maximal |
| Replay-Wert | Hoch (6 Objekte) | Niedrig (1 fix) | Hoch (6 Objekte) | Mittel (1, aber Party variiert) | Hoch |
| Authoring-Aufwand | ~192 Texte | ~128 Texte | ~192 Texte | ~80 Texte | ~250+ Texte |
| Code-Aufwand | Gering | Minimal | Gering | Mittel | Hoch |
| Mechanik-Brücke | Nein | Ja (State) | Nein | Nein | Ja (State) |
| Charakter-Tiefe | Nein | Nein | Nein | Ja (Aptitudes) | Ja (Aptitudes) |
| Archetype-Kohärenz | Sehr hoch | Sehr hoch | Sehr hoch | Hoch | Sehr hoch |
| Risiko Überladung | Gering | Gering | Gering | Gering | Mittel |

## Empfehlung

**Phase 1: Variation C** (Wandernde Dinge) — stärkstes narratives Prinzip, identischer
Code-Aufwand wie A, aber das Objekt hat eine eigene Handlung. Die Mother-Lied- und
Entropy-Wort-Ketten sind S-Tier-Material.

**Phase 2: Variation B** (Barometer) als Ergänzung — kostet fast keinen Code (liest
bestehenden State), liefert die Mechanik-Narrativ-Brücke, die C nicht hat.

**Phase 3 (optional): Variation D** (Perspektiven) als Banter-Erweiterung — unabhängig
von C/B implementierbar, bringt Agenten-Tiefe. Synergetisch mit Konzept 2 (Aptitude-Stimmen).

**Variation E** (Palimpsest) ist das Fernziel, aber der Aufwand rechtfertigt sich erst,
wenn C + B + D stabil laufen und der Authoring-Workflow eingespielt ist.
