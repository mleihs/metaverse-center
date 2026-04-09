-- Migration 185: Awakening partial narratives
-- Fills 8 empty partial_narrative_en/de fields for encounter choices
-- that have aptitude checks. Literary quality: Jung, Proust, Borges,
-- Kafka, Lem, Tarkovsky, Sturgeon, Jaynes influences.
--
-- Context: Migration 176 seeded Awakening content before partial_narrative
-- columns existed. The structural fix (empty strings) was applied, but
-- the literary content was never written. These 8 texts complete the
-- Awakening archetype to parity with Overthrow (migration 178).

UPDATE dungeon_encounter_choices
SET partial_narrative_en = '{agent} sees something in the reflection – not the mechanism, but the edge of it. Like reading a word at the edge of one''s field of vision: the meaning arrives, incomplete. The mirror shows a fragment of what was forgotten. Enough to unsettle. Not enough to understand.',
    partial_narrative_de = '{agent} sieht etwas in der Spiegelung – nicht den Mechanismus, aber seinen Rand. Wie ein Wort am Rand des Blickfelds: die Bedeutung trifft ein, unvollständig. Der Spiegel zeigt ein Fragment des Vergessenen. Genug, um zu beunruhigen. Nicht genug, um zu verstehen.'
WHERE id = 'mirror_study';

UPDATE dungeon_encounter_choices
SET partial_narrative_en = 'The descriptions almost overlap. Edges touch – the same corner of a room, the same quality of light – then diverge. Sturgeon''s bleshing, interrupted: the gestalt forms for a moment, then each agent returns to their own perception. Something was glimpsed. Something shared. Not held.',
    partial_narrative_de = 'Die Beschreibungen überlappen sich fast. Ränder berühren sich – dieselbe Ecke eines Raumes, dieselbe Qualität des Lichts – dann gehen sie auseinander. Sturgeons Bleshing, unterbrochen: die Gestalt bildet sich für einen Moment, dann kehrt jeder Agent zu seiner eigenen Wahrnehmung zurück. Etwas wurde erhascht. Etwas geteilt. Nicht gehalten.'
WHERE id = 'mirror_share';

UPDATE dungeon_encounter_choices
SET partial_narrative_en = '{agent} catalogs some differences. The window – yes, it moved. But why it moved, what the reconstruction reveals about the reconstructor, remains out of focus. Proust''s madeleine, half-dissolved: the sensation arrives, but the memory it summons stays submerged.',
    partial_narrative_de = '{agent} katalogisiert einige Unterschiede. Das Fenster – ja, es hat sich bewegt. Aber warum es sich bewegt hat, was die Rekonstruktion über den, der rekonstruiert, verrät, bleibt unscharf. Prousts Madeleine, halb aufgelöst: die Empfindung kommt an, aber die Erinnerung, die sie heraufbeschwört, bleibt untergetaucht.'
WHERE id = 'familiar_investigate';

UPDATE dungeon_encounter_choices
SET partial_narrative_en = '{agent} brings the clocks closer. Not aligned – adjacent. For a half-second the room flickers into clarity, then the drift resumes. But {agent} saw it: the room between the clocks. It was empty. Deliberately empty.',
    partial_narrative_de = '{agent} bringt die Uhren näher. Nicht synchron – benachbart. Für eine halbe Sekunde flackert der Raum in Klarheit, dann setzt das Driften wieder ein. Aber {agent} hat es gesehen: den Raum zwischen den Uhren. Er war leer. Absichtlich leer.'
WHERE id = 'clocks_synchronize';

UPDATE dungeon_encounter_choices
SET partial_narrative_en = '{agent} follows the inner clock – briefly. Time compresses, then stutters. A glimpse of the accelerated perception: shapes in the compressed seconds, moving too fast to identify. The outer clock pulls {agent} back. Something was perceived. The vocabulary for it has not yet arrived.',
    partial_narrative_de = '{agent} folgt der inneren Uhr – kurz. Die Zeit komprimiert sich, dann stockt sie. Ein Blick in die beschleunigte Wahrnehmung: Formen in den komprimierten Sekunden, zu schnell, um sie zu identifizieren. Die äußere Uhr zieht {agent} zurück. Etwas wurde wahrgenommen. Das Vokabular dafür ist noch nicht eingetroffen.'
WHERE id = 'clocks_inner';

UPDATE dungeon_encounter_choices
SET partial_narrative_en = '{agent} fills the gap – partially. The reconstruction takes shape, but the edges remain translucent. Borges''s hronir, half-materialized: the object exists by expectation, but expectation wavers. The dungeon accepts the substitute provisionally. As one accepts a word one cannot quite recall.',
    partial_narrative_de = '{agent} füllt die Lücke – teilweise. Die Rekonstruktion nimmt Gestalt an, aber die Ränder bleiben durchscheinend. Borges'' Hronir, halb materialisiert: das Objekt existiert durch Erwartung, aber die Erwartung schwankt. Das Dungeon akzeptiert das Substitut vorläufig. Wie man ein Wort akzeptiert, an das man sich nicht ganz erinnern kann.'
WHERE id = 'absent_reconstruct';

UPDATE dungeon_encounter_choices
SET partial_narrative_en = 'The humming almost resolves. {agent} hears the boundary between noise and signal – the threshold where the voices nearly coalesce into recognition. Jaynes''s bicameral membrane, thinning but not torn. The gods are audible. Not yet intelligible.',
    partial_narrative_de = 'Das Summen löst sich fast auf. {agent} hört die Grenze zwischen Rauschen und Signal – die Schwelle, an der die Stimmen beinahe zu Wiedererkennung verschmelzen. Jaynes'' zweikammerige Membran, dünner werdend, aber nicht gerissen. Die Götter sind hörbar. Noch nicht verständlich.'
WHERE id = 'humming_listen';

UPDATE dungeon_encounter_choices
SET partial_narrative_en = '{agent} holds the boundary – mostly. The humming dims but does not disappear. A residual frequency persists, like a thought one has decided not to think but which continues thinking itself.',
    partial_narrative_de = '{agent} hält die Grenze – größtenteils. Das Summen wird leiser, verschwindet aber nicht. Eine Restfrequenz bleibt bestehen, wie ein Gedanke, den man beschlossen hat nicht zu denken, der aber weiterhin sich selbst denkt.'
WHERE id = 'humming_block';
