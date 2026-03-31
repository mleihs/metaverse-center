# Objektanker-System — Implementierungs-Brief

> Vollständige Arbeitsanweisung. Enthält alles, was zur Implementierung nötig ist.
> Prosa-Vorlagen: `docs/concepts/dungeon-objektanker-detailed.md`
> Literarische Regeln: Memory `dungeon-literary-influences.md`
> Elterndokument: `docs/concepts/dungeon-literary-additions.md`

---

## 1. Ziel & Narratives Prinzip

Zwei Systeme, die zusammenwirken:

### Variation C: "Wandernde Dinge"

Ein Objekt wird in Raum 1 entdeckt und **bewegt sich unabhängig durch den Dungeon** —
es verändert seinen Zustand parallel zur Party. Das Objekt hat eine eigene Reise.
Der Spieler beobachtet, wie der Dungeon das Objekt verändert, und versteht dadurch,
was der Dungeon auch mit der Party tut.

**Nicht verwechseln mit statischen Objekten** (Variation A). Das Prinzip ist:
das Objekt ist ein Akteur. Es wird kopiert, es wächst, es degradiert, es wartet.
Die Dunkelheit lernt von der Waffe. Das Lied lernt die Namen. Das Wort verliert
seine Buchstaben. Das Objekt spiegelt den Archetype.

Pro Run werden **2 Objekte** aus einem Pool von **mindestens 5–6 pro Archetype**
gewählt. Mehr Objekte = mehr Replay-Wert. Jedes Objekt hat 4 Phasen.

### Variation B: "Resonanz-Barometer"

Ein **fixes** Objekt pro Archetype (nicht wählbar, immer dasselbe), das den
`archetype_state` in Prosa übersetzt. Es reagiert auf mechanische Schwellenwerte
und wird nur angezeigt, wenn sich die Schwelle **geändert** hat (kein Spam).

Zweck: Brücke zwischen Mechanik und Narrativ. Der Spieler "fühlt" die Visibility,
Integrity, Attachment oder Decay durch Prosa, nicht nur durch Zahlen/Balken.

---

## 2. Bestehende Architektur (Kontext für Implementierung)

### Rendering-Pipeline (Backend → Frontend)

```
Backend: move_to_room()
  → result = {"banter": banter_text}     # dict mit text_en, text_de, id, trigger
  → result.update(encounter/combat data)
  → result["state"] = client_state
  → return result

Frontend: dungeon-commands.ts (move command handler)
  → formatRoomEntry(room, result.banter.text_en, archetype_state)
      → responseLine(banterText)          # Banter ÜBER dem Room-Header
      → systemLine("═══ DEPTH X — ROOM Y ═══")
      → archetype_state bars (Visibility/Integrity/etc.)
  → formatEncounterChoices(description_en, choices, ...)   # Encounter-Beschreibung + Choices
  → formatCombatStart(combat)             # Oder Combat-Start
```

### Banter-Payload-Format (Backend)

```python
banter_text = {
    "id": "sb_03",
    "trigger": "room_entered",
    "text_en": "{agent}: 'The darkness isn't empty...'",
    "text_de": "{agent}: »Die Dunkelheit ist nicht leer...«",
    # ... personality_filter etc. (nicht an Frontend gesendet)
}
```

### Wo Texte ankommen (Frontend)

- `result.banter.text_en` → `formatRoomEntry()` → `responseLine()` (kursiv, vor Room-Header)
- `result.description_en` → `formatEncounterChoices()` (Encounter-Beschreibung, nach Room-Header)
- Banter und Description sind **getrennte Kanäle** mit verschiedener visueller Behandlung

### State-Felder pro Archetype

```python
# Shadow:   archetype_state = {"visibility": 3, "max_visibility": 3, "rooms_since_vp_loss": 0}
# Tower:    archetype_state = {"structural_integrity": 100, "max_integrity": 100}
# Mother:   archetype_state = {"attachment": 0}
# Entropy:  archetype_state = {"decay": 0}
```

### Banter-Selection (bestehende Funktion)

```python
def select_banter(trigger, agents, used_ids, archetype, archetype_state) -> dict | None
```
- Filtert nach trigger, personality_filter, used_ids (no-repeat)
- Entropy: filtert nach decay_tier (0–3)
- Mother: filtert nach attachment_tier (0–2)
- Gibt None zurück, wenn kein passendes Banter vorhanden

---

## 3. Datenmodell-Erweiterungen

### DungeonInstance (backend/models/resonance_dungeon.py)

```python
class DungeonInstance(BaseModel):
    ...
    # Objektanker (Variation C)
    anchor_objects: list[str] = Field(default_factory=list)
    # Tracks welche Phasen pro Objekt bereits gezeigt wurden
    # z.B. {"shadow_note": ["discovery"], "shadow_mirror": ["discovery", "echo"]}
    anchor_phases_shown: dict[str, list[str]] = Field(default_factory=dict)

    # Barometer (Variation B)
    # Letzter angezeigter Barometer-Tier (0-basiert). -1 = noch nie gezeigt.
    last_barometer_tier: int = -1
```

### Checkpoint-Erweiterung (to_checkpoint / from_checkpoint)

```python
def to_checkpoint(self) -> dict:
    return {
        ...
        "anchor_objects": self.anchor_objects,
        "anchor_phases_shown": self.anchor_phases_shown,
        "last_barometer_tier": self.last_barometer_tier,
    }

def from_checkpoint(self, checkpoint: dict) -> None:
    ...
    self.anchor_objects = checkpoint.get("anchor_objects", [])
    self.anchor_phases_shown = checkpoint.get("anchor_phases_shown", {})
    self.last_barometer_tier = checkpoint.get("last_barometer_tier", -1)
```

---

## 4. Content-Pool (Variation C)

### Datenstruktur (in dungeon_encounters.py)

```python
# Jedes Objekt hat 4 Phasen-Texte, bilingual
ANCHOR_OBJECTS: dict[str, list[dict]] = {
    "The Shadow": [
        {
            "id": "shadow_note",
            "phases": {
                "discovery": {
                    "text_en": "A note, folded once, pressed into a crack...",
                    "text_de": "Eine Notiz, einmal gefaltet...",
                },
                "echo": {
                    "text_en": "{agent} finds another note...",
                    "text_de": "{agent} findet eine weitere Notiz...",
                },
                "mutation": {
                    "text_en": "The walls here are covered in notes...",
                    "text_de": "Die Wände hier sind bedeckt mit Notizen...",
                },
                "climax": {
                    "text_en": "On the floor: a pen. Still warm...",
                    "text_de": "Auf dem Boden: ein Stift. Noch warm...",
                },
            },
        },
        # ... 4–5 weitere Objekte
    ],
    "The Tower": [...],
    "The Entropy": [...],
    "The Devouring Mother": [...],
}
```

### Mindestens 5 Objekte pro Archetype

Die `dungeon-objektanker-detailed.md` enthält je 2 ausgearbeitete Objekte pro
Archetype als Vorlage. **Mindestens 3–4 neue pro Archetype dazuschreiben.**

Vorhandene Vorlagen:
- **Shadow**: "Die Notiz", "Der Spiegel" → + z.B. "Die Waffe", "Der Abdruck", "Das Flüstern"
- **Tower**: "Der Grundriss", "Die Quittung" → + z.B. "Der Fahrstuhlknopf", "Die Wasserwaage", "Das Namensschild"
- **Mother**: "Das Nest", "Das Lied" → + z.B. "Die Frucht", "Der Nabelstrang", "Das Geschenk"
- **Entropy**: "Die Uhr", "Das Wort" → + z.B. "Die Waage", "Das Foto", "Der Schlüssel"

### Archetype-spezifische Objekt-Regeln

| Archetype | Objektverhalten | Literarisches Prinzip |
|---|---|---|
| **Shadow** | Objekt wird vom Dungeon kopiert/vervielfacht/verdreht | Lovecrafts Mimikry — die Dunkelheit lernt |
| **Tower** | Objekt taucht auf höheren Stockwerken in bürokratisch veränderter Form auf | Kafkas endlose Aktenführung |
| **Mother** | Objekt wächst, wird organischer, intimer, besitzergreifender | VanderMeers biologische Vereinnahmung |
| **Entropy** | Objekt degradiert, verliert Details, wird ununterscheidbar | Becketts Sprachverfall |

**Entropy-Sonderregel:** Objekttexte in späteren Phasen müssen mit dem
Decay-Tier-System kohärent sein. Echo- und Mutation-Texte bei hohem Decay sollten
kürzer, fragmentierter sein. Die Climax-Phase bei Decay 85+ kann ein Einzelwort sein.

**Mother-Sonderregel:** Objekttexte sollten mit steigendem Attachment wärmer,
intimer, besitzergreifender werden. Die Climax-Phase bei Attachment 86+ sollte
die Grenze zwischen Objekt und Dungeon verwischen.

### {agent}-Placeholder

Echo-Phase-Texte dürfen `{agent}` verwenden — wird zur Runtime durch einen
lebenden Agenten ersetzt (selbe Logik wie Banter, `random.choice(alive)`).
Discovery-, Mutation- und Climax-Texte sollten KEINE Agenten-Placeholder verwenden,
da sie Umgebungsbeschreibungen sind, keine Charakterreaktionen.

---

## 5. Content-Pool (Variation B — Barometer)

### Datenstruktur

```python
BAROMETER_TEXTS: dict[str, list[dict]] = {
    "The Shadow": [
        {"tier": 0, "threshold_key": "visibility", "threshold_value": 3,
         "text_en": "The amber terminal glow pulses steadily...",
         "text_de": "Das Bernsteinleuchten des Terminals pulsiert gleichmäßig..."},
        {"tier": 1, "threshold_key": "visibility", "threshold_value": 2,
         "text_en": "The amber glow flickers...",
         "text_de": "Das Bernsteinleuchten flackert..."},
        {"tier": 2, "threshold_key": "visibility", "threshold_value": 1, ...},
        {"tier": 3, "threshold_key": "visibility", "threshold_value": 0, ...},
    ],
    ...
}
```

### Tier-Berechnung pro Archetype

```python
def _barometer_tier(archetype: str, archetype_state: dict) -> int:
    if archetype == "The Shadow":
        vis = archetype_state.get("visibility", 3)
        return {3: 0, 2: 1, 1: 2}.get(vis, 3)  # 0=vis3, 1=vis2, 2=vis1, 3=vis0
    elif archetype == "The Tower":
        integrity = archetype_state.get("structural_integrity", 100)
        if integrity >= 80: return 0
        if integrity >= 50: return 1
        if integrity >= 25: return 2
        return 3
    elif archetype == "The Devouring Mother":
        attachment = archetype_state.get("attachment", 0)
        if attachment <= 30: return 0
        if attachment <= 60: return 1
        if attachment <= 85: return 2
        return 3
    elif archetype == "The Entropy":
        decay = archetype_state.get("decay", 0)
        if decay <= 20: return 0
        if decay <= 50: return 1
        if decay <= 80: return 2
        return 3
    return 0
```

### Barometer-Objekte (je 1 pro Archetype, je 4 Schwellen)

Vollständige Texte in `dungeon-objektanker-detailed.md` unter "Variation B":
- **Shadow**: "Der Bernstein" (Terminal-Glow als Visibility-Spiegel)
- **Tower**: "Der Riss" (Wandriss als Integrity-Spiegel)
- **Mother**: "Die Temperatur" (Wärme als Attachment-Spiegel)
- **Entropy**: "Die Farbe" (Raumfarbe als Decay-Spiegel)

---

## 6. Selection-Logik

### Anchor-Objekte: Wann welche Phase?

```python
def select_anchor_text(
    instance: DungeonInstance,
    target_room: RoomNode,
) -> dict | None:
    """Select an anchor object text for the current room entry, if applicable.

    Phase selection rules:
    - discovery: Depth 1–2, first encounter/rest/treasure room, object not yet shown
    - echo:      Depth 3+, any room type, object shown discovery but not echo
    - mutation:  Depth 4–5, encounter/rest/treasure rooms, object shown echo but not mutation
    - climax:    Boss room, object shown at least discovery, not yet shown climax

    Returns dict with text_en, text_de, anchor_id, phase — or None.
    """
```

**Kritische Logik-Details:**

1. **Phase-Gating ist per-Objekt, nicht global.** Objekt A kann in "echo" sein während
   Objekt B noch in "discovery" ist. `anchor_phases_shown` trackt pro Objekt-ID.

2. **Maximal 1 Anchor-Text pro Raumbetreten.** Wenn beide Objekte eine Phase zeigen
   könnten, wird das Objekt mit der **niedrigsten Phase** bevorzugt (discovery > echo
   > mutation > climax). So wird das zweite Objekt nicht übersprungen.

3. **Discovery triggert auf den ERSTEN passenden Raum**, nicht streng Depth 1.
   Wenn der Spieler in Depth 1 nur Combat-Räume betritt, triggert Discovery
   beim ersten Encounter/Rest/Treasure-Raum, auch wenn das Depth 2 ist.
   Aber: Discovery triggert NICHT nach Depth 3 (zu spät, narrativ unplausibel).

4. **Echo triggert bei ALLEN Raumtypen** (auch Combat). Es ist Banter-artig.

5. **Mutation triggert nur bei narrativen Räumen** (encounter/rest/treasure) —
   nicht bei Combat, weil die Encounter-Beschreibung dort fehlt.

6. **Climax triggert NUR im Boss-Raum.** Wenn der Spieler den Boss betritt,
   werden BEIDE Objekt-Climaxes nacheinander angezeigt (Ausnahme von der
   1-pro-Raum-Regel). Das ist der narrative Höhepunkt.

7. **Keine Wiederholung.** Jede Phase pro Objekt wird genau einmal gezeigt.
   Tracked in `anchor_phases_shown`.

### Barometer: Wann anzeigen?

```python
def get_barometer_text(
    archetype: str,
    archetype_state: dict,
    last_tier: int,
) -> tuple[dict | None, int]:
    """Get barometer text if tier has changed since last display.

    Returns (text_dict_or_None, new_tier).
    Only returns text when tier != last_tier (prevents spam).
    """
    current_tier = _barometer_tier(archetype, archetype_state)
    if current_tier == last_tier:
        return None, last_tier
    text = BAROMETER_TEXTS[archetype][current_tier]
    return text, current_tier
```

**Barometer zeigt sich NICHT beim ersten Raum** (Tier wechselt von -1 auf 0,
aber das initiale "alles okay" ist nicht narrativ interessant). Stattdessen:
erst anzeigen, wenn Tier von 0 auf 1+ wechselt. Also: `last_barometer_tier`
startet bei 0 (nicht -1), und wird nur getriggert bei tier > last_tier ODER
tier < last_tier (Verschlechterung ODER Verbesserung, z.B. nach Scout/Reinforce).

**Alternativ:** Tier -1 = "noch nicht gezeigt", Tier 0 = "alles okay gezeigt".
Erster Wechsel von -1 auf 0 zeigt den "alles okay"-Text (kann auch stimmungsvoll
sein: "Das Bernsteinleuchten pulsiert gleichmäßig. Warm. Gegenwärtig.").
Das ist atmosphärisch wertvoll als Baseline-Setzung. **Empfehlung: Tier -1 → 0
DOCH anzeigen.** Das etabliert das Barometer als narratives Element.

---

## 7. Engine-Integration (dungeon_engine_service.py)

### In create_run() — Objekte auswählen

```python
# Nach: archetype_state = strategy.init_state()
# Vor: DB insert

# Select 2 anchor objects for this run
anchor_pool = ANCHOR_OBJECTS.get(archetype, [])
selected_anchors = random.sample(anchor_pool, min(2, len(anchor_pool)))
anchor_object_ids = [a["id"] for a in selected_anchors]
```

Auf der Instance setzen:
```python
instance = DungeonInstance(
    ...
    anchor_objects=anchor_object_ids,
    anchor_phases_shown={obj_id: [] for obj_id in anchor_object_ids},
    last_barometer_tier=-1,
)
```

### In move_to_room() — Texte injizieren

**Einfügepunkt:** Nach der Banter-Selection (Zeile ~593), vor `result = {"banter": ...}`.

```python
# ── Anchor Object Text ──
anchor_text = select_anchor_text(instance, target_room)
if anchor_text:
    # Track phase as shown
    obj_id = anchor_text["anchor_id"]
    phase = anchor_text["phase"]
    instance.anchor_phases_shown.setdefault(obj_id, []).append(phase)
    # Resolve {agent} placeholder in echo-phase texts
    if "{agent}" in anchor_text.get("text_en", ""):
        alive = [a for a in instance.party if can_act(a.condition)]
        if alive:
            agent = random.choice(alive)
            anchor_text["text_en"] = anchor_text["text_en"].replace("{agent}", agent.agent_name)
            anchor_text["text_de"] = anchor_text["text_de"].replace("{agent}", agent.agent_name)

# ── Barometer Text ──
baro_text, new_tier = get_barometer_text(
    instance.archetype, instance.archetype_state, instance.last_barometer_tier
)
if baro_text:
    instance.last_barometer_tier = new_tier
```

### Response-Format — Wie erreicht es das Frontend?

**Empfehlung: Eigene Felder auf dem Response-Dict.**

```python
result: dict = {
    "banter": banter_text,
    "anchor_text": anchor_text,      # NEU: dict mit text_en, text_de oder None
    "barometer_text": baro_text,      # NEU: dict mit text_en, text_de oder None
}
```

**NICHT in Banter reinmischen.** Banter ist Agent-Reaktion (Charakter spricht).
Anchor/Barometer sind Umgebungsbeschreibung (Dungeon zeigt). Verschiedene
narrative Stimmen → verschiedene Felder → Frontend kann sie visuell differenzieren
(auch wenn initial gleich gerendert).

### Frontend-Änderung (minimal)

In `frontend/src/utils/dungeon-commands.ts`, nach `formatRoomEntry()`:

```typescript
// Anchor object text (environmental narrative)
if (result.anchor_text) {
  const anchorText = result.anchor_text.text_en;  // TODO: i18n
  if (anchorText) {
    lines.push(responseLine(''));
    lines.push(responseLine(anchorText));
  }
}

// Barometer text (archetype state narrative)
if (result.barometer_text) {
  const baroText = result.barometer_text.text_en;  // TODO: i18n
  if (baroText) {
    lines.push(responseLine(''));
    lines.push(responseLine(baroText));
  }
}
```

In `frontend/src/types/dungeon.ts`, `MoveToRoomResponse` erweitern:

```typescript
export interface MoveToRoomResponse {
  banter?: Record<string, string> | null;
  anchor_text?: Record<string, string> | null;    // NEU
  barometer_text?: Record<string, string> | null;  // NEU
  ...
}
```

### Rendering-Reihenfolge im Terminal

```
1. Banter          (Agent-Reaktion, kursiv)
2. Anchor-Text     (Objekt-Beschreibung, kursiv)     ← NEU
3. ═══ DEPTH X — ROOM Y ═══
4. VISIBILITY: ████░░ [4/6]
5. Barometer-Text   (State-Narrativ, kursiv)          ← NEU
6. [Encounter-Beschreibung + Choices]
```

Barometer NACH dem State-Balken ist logisch: erst die Zahl, dann die Prosa-Übersetzung.
Anchor-Text VOR dem Room-Header, weil es atmosphärische Einleitung ist (wie Banter).

**Alternative Reihenfolge** (wenn Anchor als Raumbeschreibung wirken soll):
```
1. Banter
2. ═══ DEPTH X — ROOM Y ═══
3. Anchor-Text     ← Nach Header, vor Encounter
4. VISIBILITY-Balken
5. Barometer-Text
6. [Encounter + Choices]
```

Beides valide. Zweite Variante ist narrativ logischer (Objekt ist Teil des Raums,
nicht Teil der Agenten-Reaktion). **Empfehlung: Variante 2.**

---

## 8. Edge Cases & Besonderheiten

### Spieler überspringt Depth 1–2

Theoretisch unmöglich (Start ist immer Depth 0, Rooms sind graph-connected,
Depth wächst monoton). Aber: wenn der Spieler nur Combat-Räume in Depth 1–2
betritt, hat er keine Encounter-Beschreibung. Discovery-Text sollte dann als
**Banter-Ersatz** gezeigt werden (im `banter`-Feld), nicht als Encounter-Text.

### Boss-Raum: Beide Climax-Texte

Im Boss-Raum werden **beide** Objekt-Climaxes angezeigt — nacheinander, durch
Leerzeile getrennt. Das ist der einzige Ort, wo 2 Anchor-Texte pro Raum erscheinen.
Implementierung: `select_anchor_text` gibt für Boss-Räume eine Liste zurück,
oder wird zweimal aufgerufen (einmal pro Objekt).

### Entropy: Decay-Tier beeinflusst Objekttexte

Entropy-Objekte haben Phasen-Texte, die mit dem Decay-Tier KONSISTENT sein müssen.
Ein Echo-Text bei Decay 70+ sollte fragmentiert sein. Ein Climax-Text bei Decay 85+
kann ein Einzelwort sein ("Uhr.", "Wand.").

Die Texte sind vorverfasst — sie müssen beim Authoring ALLE Decay-Stufen abdecken.
**Lösung:** Entropy-Objekte haben optionale `decay_tier`-Varianten pro Phase:

```python
{
    "id": "entropy_clock",
    "phases": {
        "echo": {
            "default": {"text_en": "The clock again. Or a clock...", ...},
            "decay_70": {"text_en": "Clock. Again. Same.", ...},
        },
        "climax": {
            "default": {"text_en": "The clock face...", ...},
            "decay_85": {"text_en": "Clock.", ...},
        },
    },
}
```

Oder einfacher: Entropy-Objekte haben **mehr Phasen** (echo_low_decay, echo_high_decay),
und die Selection filtert nach aktuellem Decay-Tier.

**Einfachste Lösung:** Jede Phase hat ein optionales `max_decay`-Feld. Wenn Decay
über dem Wert liegt, wird die nächste Phase mit passendem `max_decay` verwendet.
Oder: separate Texteinträge mit `decay_tier`-Filter (analog zu Entropy-Banter).

### Mother: Attachment-Tier beeinflusst Objekttexte

Ähnlich wie Entropy, aber umgekehrt: steigende Attachment → wärmere, intimere Texte.
Mother-Objekte können optionale `attachment_tier`-Varianten haben.

**Einfachste Lösung für beide:** Pro Phase gibt es eine `variants`-Liste statt
eines einzelnen Textpaars. Jede Variante hat optionale `decay_tier`/`attachment_tier`
Filter. Selection wählt die Variante mit dem höchsten passenden Tier.
Das ist exakt das Pattern, das `select_banter` bereits für Entropy/Mother verwendet.

### Retreat: Anchor-State bleibt erhalten

Wenn der Spieler retreated und denselben Archetype nochmal betritt, ist es ein
**neuer Run** mit neuer `DungeonInstance` → neue Objekte, neuer State. Kein Problem.

### Recovery aus Checkpoint

Wenn der Server neu startet, werden `anchor_objects`, `anchor_phases_shown` und
`last_barometer_tier` aus dem Checkpoint rekonstruiert. Die Texte sind im Code —
`ANCHOR_OBJECTS[archetype]` wird beim Import geladen. Kein Datenverlust.

---

## 9. Authoring-Regeln für Objekttexte

### Allgemein (alle Archetypes)

- **Bilingual**: Jeder Text en + de, keine Übersetzung sondern literarische Adaption
- **En-Dash** (U+2013), nie Em-Dash (U+2014)
- **Guillemets** »...« für Agenten-Dialog in DE
- **Keine body-spezifischen Metaphern**: "Ohren", "Atem", "Herzschlag" verboten
  (Agenten können Programme, Organismen, abstrakte Entitäten sein)
- **Erlaubt**: Dungeon als Akteur ("Die Dunkelheit lernt", "Das Gebäude kompensiert")
- **Erlaubt**: Agent-Verhalten mit universalen Verben ("pausiert", "registriert", "prüft")
- **{agent}** nur in Echo-Phase (Agent reagiert auf Objekt), nie in Discovery/Mutation/Climax
- **Wortlimit**: Discovery 40–60 Wörter, Echo 20–35 Wörter, Mutation 40–70 Wörter,
  Climax 30–50 Wörter. Kürzer ist besser. Alexis Kennedys Regel: jedes Wort trägt dreifach.

### Shadow-Objekte

- **Literarische DNA**: Lovecraft (Suggestives über Explizites), VanderMeer (ökologisches Unheimliches)
- **Objektverhalten**: Die Dunkelheit kopiert, vervielfältigt, verdreht das Objekt
- **Satzstruktur**: Büchner-Kompression. Max 12 Wörter/Satz. Gedankenstriche statt Nebensätze.
- **Verboten**: "evil", "lurking", "ominous", "creepy" — zeigen, nicht benennen
- **Climax-Regel**: Das Objekt enthüllt, dass die Dunkelheit euch die ganze Zeit beobachtet hat

### Tower-Objekte

- **Literarische DNA**: Kafka (bürokratisches Unheimliches), Ballard (klinische Beobachtung)
- **Objektverhalten**: Objekt taucht auf höheren Stockwerken in bürokratisch veränderter Form auf
- **Satzstruktur**: Kafkaesque Hypotaxe. Grammatisch tadellos, Inhalt widerspricht Form.
  Nebensatzschachtelung. Verb-Endstellung erzeugt Spannung.
- **Vokabular**: Finanz/Struktur — Hauptbuch, Bilanz, Quittung, tragend, Solvenz, Garantie
- **Climax-Regel**: Das Objekt war die ganze Zeit eine Buchführung über EUCH

### Mother-Objekte

- **Literarische DNA**: VanderMeer (Biologie), Butler (Ambivalenz), Jackson (Häuslichkeit)
- **Objektverhalten**: Objekt wächst, wird organischer, intimer, besitzergreifender
- **Satzstruktur**: Manns erlebte Rede. Gleiten von dritter Person über "man" in
  freie indirekte Rede. Kein Marker für den Übergang.
- **Vokabular**: Gewebe, Wärme, Nest, Frucht, Puls, Nähren, Umschließen
- **Climax-Regel**: Das Objekt war nie ein Objekt — es war eine Verlockung.
  Der Dungeon hat es für euch wachsen lassen.
- **Attachment-Varianten**: Low (0–30) = beobachtend, Mid (31–60) = einladend,
  High (61+) = besitzergreifend

### Entropy-Objekte

- **Literarische DNA**: Pynchon (thermodynamische Gleichung), Beckett (Sprachverfall), Lem (Erkenntnis-Entropie)
- **Objektverhalten**: Objekt degradiert, verliert Details, wird ununterscheidbar von Umgebung
- **Satzstruktur**: Volle Sätze bei Decay 0–39, verkürzt bei 40–69, Fragmente bei 70–84,
  Einzelwörter bei 85+
- **Kernprinzip**: Entropie ist NICHT Zerstörung. Es ist Angleichung. Das Objekt wird
  nicht zerstört — es wird ununterscheidbar.
- **Climax-Regel**: Das Objekt IST der Raum IST die Wand IST grau.
- **Decay-Varianten**: Texte MÜSSEN mit dem Banter-Degradation-System kohärent sein

---

## 10. Vollständige Prosa-Vorlagen

Alle bereits geschriebenen Texte stehen in `docs/concepts/dungeon-objektanker-detailed.md`:

### Variation C (Wandernde Dinge) — je 2 pro Archetype als Vorlage:

| Archetype | Objekt 1 | Objekt 2 |
|---|---|---|
| Shadow | "Die Notiz" (Handschrift degradiert) | "Der Spiegel" (Reflexionen ohne Quelle) |
| Tower | "Der Grundriss" (Bauplan korrigiert sich) | "Die Quittung" (Garantien verfallen) |
| Mother | "Das Nest" (wächst, wird der Raum) | "Das Lied" (Schlaflied lernt eure Namen) |
| Entropy | "Die Uhr" (Zeiger verschwinden) | "Das Wort" (Buchstaben gleichen sich an) |

Zusätzlich in Variation C: "Die Waffe" (Shadow), "Der Fahrstuhlknopf" (Tower)
mit vollständigen 4-Phasen-Texten.

### Variation B (Barometer) — je 1 pro Archetype:

| Archetype | Barometer | Schwellen |
|---|---|---|
| Shadow | "Der Bernstein" | Visibility 3/2/1/0 |
| Tower | "Der Riss" | Integrity 100–80/79–50/49–25/<25 |
| Mother | "Die Temperatur" | Attachment 0–30/31–60/61–85/86–100 |
| Entropy | "Die Farbe" | Decay 0–20/21–50/51–80/81–100 |

**Mindestens 3–4 neue Objekte pro Archetype dazuschreiben.** Die Vorlagen geben
den Qualitätsstandard vor. Neue Objekte müssen denselben Standard erreichen.

---

## 11. Implementierungsreihenfolge

1. **Model-Erweiterung**: `DungeonInstance` Felder + Checkpoint
2. **Anchor-Object-Pool**: Alle Texte als Datenstruktur in `dungeon_encounters.py`
   (vorhandene übernehmen + neue schreiben — HIER liegt der Hauptaufwand)
3. **Barometer-Texte**: Alle Texte als Datenstruktur in `dungeon_encounters.py`
4. **Selection-Funktionen**: `select_anchor_text()`, `get_barometer_text()`
5. **Engine-Integration**: `create_run()` + `move_to_room()`
6. **Frontend-Integration**: Types erweitern + Rendering in `dungeon-commands.ts`
7. **Lint**: `ruff` + `tsc` nach jeder Änderung
8. **Commit**: Detaillierteste Commit-Message — erklärt Konzept, Architektur, und was sich ändert

---

## 12. Was NICHT implementiert wird

- Variation A (Stumme Zeugen) — subsumiert durch C
- Variation D (Gebrochene Perspektiven) — spätere Phase, braucht Aptitude-Voice
- Variation E (Palimpsest) — Fernziel, braucht C+B+D als Basis
- Cross-Run-Memory (Objekte aus vorherigen Runs referenzieren) — Phase 2+
- LLM-generierte Texte — alles template-basiert, kein OpenRouter
