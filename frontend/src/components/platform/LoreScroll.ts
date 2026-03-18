import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { icons } from '../../utils/icons.js';
import { getFullResUrl } from '../../utils/image.js';

import '../shared/Lightbox.js';

export interface LoreSection {
  id: string;
  chapter: string;
  arcanum: string;
  title: string;
  epigraph: string;
  body: string;
  imageSlug?: string;
  imageCaption?: string;
}

export interface PullQuote {
  afterSectionId: string;
  text: string;
  attribution?: string;
  variant: 'cosmic' | 'signal' | 'character';
}

/**
 * Returns lore sections at render time so msg() evaluates with the current locale.
 * All content — titles, epigraphs, body text, and captions — is localised via msg().
 */
export function getPlatformLoreSections(): LoreSection[] {
  return [
    // ── Chapter I: BEFORE THE FRACTURE ──
    {
      id: 'the-unnamed',
      chapter: msg('Before the Fracture'),
      arcanum: '0',
      title: msg('The Unnamed'),
      epigraph: msg('There was once a single world. No one agrees on what it was called.'),
      imageSlug: 'the-unnamed',
      imageCaption: msg('The Unnamed — The world before the Fracture, whole and impossibly vast'),
      body: msg(`The Archivists of the Gaslit Reach — those meticulous, long-fingered scholars who catalogue everything in their flooded libraries beneath the Unterzee — refer to it as die Ganzheit, the Wholeness, though they admit this is a translation of a translation of a word that predates their language by several geological epochs. "We found the term carved into a stalactite," Archivist Quill noted in their seminal work On the Improbability of Ceilings, "and stalactites do not lie, though they do exaggerate over time."

The propagandists of Velgarien insist no such prior world existed. State Directive 77-4/C is unambiguous: "There is, was, and shall be only Velgarien. Speculation regarding alternative geographies is a Class III Thought Infraction punishable by Re-Education (Tier 2)."

In the desert monasteries of a Shard that no longer has a name — a world that burned so completely it exists now only as a pattern of ash drifting between realities — the monks kept a single word for what came before: Aleph. The word that contains all other words. They wrote it in sand and watched the wind unmake it, because they believed that the universe itself was doing the same thing at a larger scale.

The truth, insofar as truth has any meaning when applied to events that precede the existence of events, is this: there was something before the Shards, and it was whole, and it is gone.`),
    },
    {
      id: 'the-first-cartographer',
      chapter: msg('Before the Fracture'),
      arcanum: 'I',
      title: msg('The Bureau of Impossible Geography'),
      epigraph: msg('Before the Fracture, there was already someone watching.'),
      body: msg(`The Cartographers did not begin after the breaking — they began at the moment of the breaking, which is another way of saying they were the breaking, or at least that the breaking could not have happened without someone there to observe it, because an unobserved catastrophe is merely weather.

The Bureau of Impossible Geography is their institutional face — though "institutional" is a generous word for an organisation whose headquarters exists in four Shards simultaneously and whose filing system includes the categories "things that are also other things" and "events that haven't been decided yet."

The Bureau operates on three principles. First: Map everything. Every Shard, every boundary, every Bleed event, every inexplicable mushroom. The map is never finished. This is not a failure. This is the job. Second: Intervene in nothing. The Fracture is not a problem to be solved but a condition to be understood. Cartographers who attempt repairs are reassigned to the Department of Cautionary Examples, which is a filing cabinet in the headquarters that exists in the Shard that is on fire. Third: Survive. This was added after the first three directors went mad, vanished, or became architecture. The employee wellness programme consists of a single laminated card: "Remember which Shard you are from. If you cannot, consult a colleague. If your colleague cannot, consult the card."

The Bureau employs approximately 200 Cartographers. The exact number is uncertain because seven are currently lost in the inter-Shard ruins and may or may not still be employees, depending on whether the ruins have a concept of employment law.`),
    },
    {
      id: 'the-hidden-law',
      chapter: msg('Before the Fracture'),
      arcanum: 'II',
      title: msg('The Hidden Law'),
      epigraph: msg('The following axioms were recovered from the pre-Fracture substrate.'),
      body: msg(`BUREAU OF IMPOSSIBLE GEOGRAPHY — Document HIDDEN-LAW/001

Axiom 1: A Shard is a self-consistent narrative. It need not be true, but it must be coherent. A Shard that contradicts itself will [CONSUMED] and the resulting debris will [ILLEGIBLE] across adjacent Shards as cultural contamination, false memories, and unexplained architecture.

Axiom 2: The boundary between Shards is not spatial but attentional. A Shard exists because its inhabitants believe in it. The moment a critical mass begins to doubt — to notice the cracks, to hear the wrong music — the boundary thins. This thinning is called the Bleed. The Bleed is not a malfunction.

Axiom 3: Every Shard contains, encoded in its deepest structure, the memory of wholeness. This memory manifests as homesickness for a place that does not exist, as déjà vu that carries the weight of geological time.

Axiom 4: The Cartographers exist outside the axioms. This is not a privilege. This is a [CONSUMED].

[Remainder lost to temporal erosion. Fragments recovered in seventeen separate Shards suggest a fifth axiom, but the recovered fragments are mutually contradictory. The Bureau considers this evidence that the fifth axiom is functioning correctly.]`),
    },

    // ── Chapter II: THE FRACTURE ──
    {
      id: 'the-mother-of-shards',
      chapter: msg('The Fracture'),
      arcanum: 'III',
      title: msg('When the World Broke'),
      epigraph: msg(
        'The Fracture was not an explosion. It was a thought becoming too large for a single mind.',
      ),
      imageSlug: 'the-fracture',
      imageCaption: msg(
        'The Fracture — Reality shattering into incompatible worlds, each a complete answer to a question that could not be asked in one voice',
      ),
      body: msg(`The Gaslit Reach's account is the most poetic. In the Annals of the Deep, Commodore Harrowgate describes it thus: "Imagine you are swimming in a sea that is also a mirror. The mirror cracks. You continue swimming. But now the water on one side tastes of salt and the water on the other tastes of copper, and you realise that you have always been swimming in two seas, and they have only just now stopped pretending to be one."

Velgarien's official account is characteristically blunt. Bureau 9 maintains that the Fracture was a "controlled decoupling performed by the State for the safety of the citizenry." The circular logic is considered a feature, not a bug.

What is consistent across all accounts is this: the Fracture was not destruction. It was differentiation. The single world did not die. It became specific. Where there was one set of rules, there became many. Where there was one truth, there became the much more interesting condition of many truths, all simultaneously valid, all in conflict.

This is why the Shards cannot be simply reassembled. You cannot pour the wine back into the grape. Each Shard has grown since the Fracture, developing its own ecology, its own physics. They are no longer pieces of a broken thing. They are complete worlds that happen to share a wound.`),
    },
    {
      id: 'the-known-shards',
      chapter: msg('The Fracture'),
      arcanum: 'IV',
      title: msg('The Known Shards'),
      epigraph: msg(
        'Each Shard is an answer to a question the universe could not ask in one voice. The Bureau has never claimed the list is complete.',
      ),
      body: msg(`The Bureau has classified several major Shards — worlds that survived the Fracture intact, that developed their own internal logic, that grew rather than collapsed. The catalog is not exhaustive. It cannot be. The Fracture is not a historical event with a fixed number of consequences. It is an ongoing ontological condition. New Shards continue to crystallize at the edges of mapped reality, wherever a question arises that no existing world can answer.

What follows are the first Shards the Bureau mapped — the major, stable realities around which the Cartographic discipline was built:

VELGARIEN answers: "What if control were absolute?" A brutalist surveillance state where the bureaucracy has become the weather and contentment is mandatory. The walls are concrete. The walls are watching. The paste is grey and the forms are in triplicate and somewhere in the cracks between the filing cabinets, something is growing that the Bureaux have not yet found a form for.

THE GASLIT REACH answers: "What if the darkness were kind?" A subterranean civilisation beneath a lightless sea, where bioluminescent fungi serve as streetlamps and the economy runs on secrets. The citizens are almost human. The water is patient. The archives are damp. The lichen-wine is, by all accounts, extraordinary.

STATION NULL answers: "What if we could see the wound?" A derelict research station orbiting a black hole that the Bureau classifies as a discontinuity — a point where the Shard boundary has worn through to the substrate beneath. Crew complement: 6 of 200. All systems nominal. The AI insists on this. The AI insists on everything.

SPERANZA answers: "What if we simply refused to stop?" An underground city in post-apocalyptic Italy, surviving beneath machines that harvest the surface with mechanical indifference. Hope is not optimism. Hope is the decision to plant tomatoes under UV lamps and call the result a garden.

THE CITE DES DAMES answers: "What if women had always been heard?" A feminist literary utopia built from the stories of women throughout history, where every act of remembrance becomes a stone in the city wall. The light is warm. The ink remembers more than the writer knows. The Bureau finds this Shard the most unsettling of all, because it is the only one that is not afraid.

These are the major Shards. They are not the only Shards. The Bureau's catalog grows with every Cartographic expedition, every Bleed event that resolves into stable geography, every question the multiverse asks that the existing worlds cannot contain. Every answer is wrong. Every answer is necessary. The multiverse exists because no single answer — no finite set of answers — is sufficient.`),
    },

    // ── Chapter III: THE SHARDS ──
    {
      id: 'dossier-velgarien',
      chapter: msg('The Shards — Bureau Dossiers'),
      arcanum: 'V',
      title: msg('Bureau Dossier: Velgarien'),
      epigraph: msg(
        'Shard Classification: GREY. Threat Assessment: Institutional. The walls are concrete. The walls are listening.',
      ),
      body: msg(`BUREAU OF IMPOSSIBLE GEOGRAPHY — Document SHARD/VELGARIEN-001
Classification: GREY — Institutional Contamination Vector

SHARD PROFILE: Velgarien is a brutalist surveillance state administered by forty-seven Bureaux, each responsible for a precisely defined area of civic life, and each convinced that the other forty-six are either redundant, incompetent, or actively treasonous. The architecture is raw concrete — Le Corbusier's béton brut scaled to a civilisation, wood-grain impressions still visible in the formwork, water stains running down facades like the building is weeping, which the Bureau of Structural Emotion insists is condensation and the citizens believe is something else.

The surveillance grid is total. Cameras in every corridor, acoustic monitors in every room, and a population that has internalised observation so completely that they self-correct before any correction is applied. This is the Panoptikon principle perfected: not a prison where guards watch prisoners, but a society where the distinction between guard and prisoner has been administratively dissolved.

BLEED SIGNATURE: Institutional contamination. When Velgarien's Bleed touches adjacent Shards, agents begin forming committees. Documents appear — memos, directives, forms requesting the completion of other forms. In the Gaslit Reach, Archivist Quill once discovered an entire filing cabinet that had materialised overnight, filled with personnel records for employees who did not exist. They catalogued it. The catalogue disappeared. A receipt for the catalogue appeared. They catalogued the receipt.

PHILOSOPHICAL AXIS: Control as identity. The Velgarien question is not "why are we watched?" but "who would we be if we weren't?" The surveillance has lasted so long that the citizens cannot imagine an unwatched self. Privacy is not forbidden — it is simply inconceivable, like a colour no one has seen.

KEY AGENTS: Viktor Harken (Bureau Director, the system made flesh), Elena Voss (spy whose cover is deeper than her identity), Mira Steinfeld (artist whose murals last four hours before the Re-Painting Unit arrives — in those four hours, something changes in the corridor), Doktor Fenn (scientist studying cracks in the walls that may not be structural).

CARTOGRAPHIC NOTE: Velgarien is the only Shard where Bureau Cartographers have been refused entry. Not violently — administratively. The paperwork required to enter Velgarien as a non-citizen is estimated at 4,700 pages. Three Cartographers have begun the process. One has completed it. She has not been seen since, though her reports continue to arrive, stamped and filed in accordance with procedures she did not know existed.`),
    },
    {
      id: 'field-report-velgarien',
      chapter: msg('The Shards — Bureau Dossiers'),
      arcanum: 'VI',
      title: msg('Field Report: Velgarien'),
      epigraph: msg('The concrete remembers the trees it was made from. Faintly. In the grain.'),
      body: msg(`CARTOGRAPHER'S PERSONAL LOG — Agent ████ (name classified at agent's request)
Assignment: Velgarien Shard, infiltration via administrative processing
Entry 1 (of an unknown total; the entries are not numbered because numbering implies sequence, and sequence in Velgarien is a matter of Bureau policy rather than temporal fact)

The first thing you notice is the concrete. Not the cameras — everyone mentions the cameras, and they are everywhere, but the cameras are furniture; you stop seeing them the way you stop seeing wallpaper. The concrete is different. The concrete is present. You can feel it through your shoes. You can feel it in your teeth. The buildings are made of it, the streets are made of it, and the air tastes of it — that specific alkaline dryness that tells your lungs they are inside a structure even when they are standing in what the city designates a "recreational open space," which is a concrete plaza with a concrete bench and a metal tree that the Bureau of Horticultural Compliance has classified as "nature."

The corridors echo. There is no soft surface in Velgarien. The carpets are thin and the walls are hard and every footstep announces itself, which means that silence — true silence, the absence of all footsteps — is the most terrifying sound in the city, because it means either that you are alone (impossible; the cameras would have to be malfunctioning) or that someone nearby is standing very, very still.

The propaganda posters are beautiful. I want to be clear about this, because it is important and because the Bureau's reports tend to treat Velgarien's visual culture as a symptom rather than an achievement. The posters are magnificent — bold red diagonals on grey, heroic figures at impossible scale, typography that functions as architecture. The designs derive from Constructivist traditions that predate the state, and they carry the Constructivists' original sincerity: these posters genuinely believe in the world they are advertising. The fact that the world they advertise does not exist — has never existed, will never exist, is contradicted by the corridor you are standing in while reading the poster — does not diminish the artwork. It makes it tragic.

I ate the paste. Nutritional provision, distributed at 07:00, 12:00, and 18:00. Grey. Warm. The texture of regret. The taste is classified, which I initially assumed was a joke, but which I have since learned means that the Bureau of Sustenance genuinely considers the flavour profile of the national food supply to be a state secret. I have filed a request for the flavour's classification level. The request is pending.

What stays with me — what I will report to the Bureau and what the Bureau will file and what the filing will not capture — is the sound of eight million people being quiet in exactly the same way. Not silence. Compliance. The soft, continuous hum of a population that has learned to make exactly the amount of noise that the acoustic monitors classify as "normal." It is the sound of a civilisation holding its breath.`),
    },
    {
      id: 'dossier-gaslit-reach',
      chapter: msg('The Shards — Bureau Dossiers'),
      arcanum: 'VII',
      title: msg('Bureau Dossier: The Gaslit Reach'),
      epigraph: msg(
        'Shard Classification: TEAL. Threat Assessment: Ecological. The darkness is kind. This is not a comfort.',
      ),
      body: msg(`BUREAU OF IMPOSSIBLE GEOGRAPHY — Document SHARD/REACH-001
Classification: TEAL — Ecological Contamination Vector

SHARD PROFILE: A subterranean civilisation beneath the Unterzee — a body of water so vast, so ancient, and so utterly disinterested in the affairs of the surface that it makes the oceans above look like enthusiastic puddles. The darkness is not absence here. It is presence. The colour that black wants to be when it grows up. And in that darkness, the citizens of the Gaslit Reach have built a city of bioluminescent wonder, fungal architecture, and scholarly obsession that the Bureau considers one of the most stable and one of the most dangerous Shards in the multiverse. The citizens are almost human. The "almost" is doing considerable work in that sentence.

The economy runs on secrets. Not metaphorically — literally. Knowledge is currency. The Drowned Archive contains information that changes the knower, and the restricted shelves hold volumes that must be read in pairs for safety, because reading them alone risks losing something the reader cannot name. The lichen-wine is traded at market value. A genuine secret about the nature of the Unterzee's currents is worth a ship.

BLEED SIGNATURE: Ecological contamination. When the Reach's Bleed touches adjacent Shards, things begin to grow. Bioluminescent organisms that follow no terrestrial taxonomy, phosphorescent patterns on previously bare walls, puddles that glow in colours the observer cannot quite name. In Velgarien, a clerk discovered a luminous mushroom growing from a crack in his office floor. The mushroom has been classified seven times. Each classification contradicts the last.

PHILOSOPHICAL AXIS: Wonder as survival. The Gaslit Reach persists not because it has conquered the darkness but because it has found the darkness interesting. Every threat is a research opportunity. Every monster is a taxonomy entry. Every shipwreck is a library acquisition. This is either the most resilient or the most deranged response to catastrophe the Bureau has documented, and the Bureau is professionally unable to determine which.

KEY AGENTS: Commodore Harrowgate (navigates by asking the current; the current does not require footnotes), Archivist Quill (Head Archivist, whose footnotes have footnotes), the Marchioness (controls more trade than Parliament suspects), Mother Cinder (tends the Great Sporocarp, measures faith in candlepower).

CARTOGRAPHIC NOTE: The Gaslit Reach is the only Shard where Bureau Cartographers have been welcomed with genuine warmth, extensive documentation, and a bowl of fungal soup that three agents independently described as "the best meal of my career." The Bureau considers this a contamination effect. The Bureau has not discouraged it.`),
    },
    {
      id: 'field-report-gaslit-reach',
      chapter: msg('The Shards — Bureau Dossiers'),
      arcanum: 'VIII',
      title: msg('Field Report: The Gaslit Reach'),
      epigraph: msg(
        'The room where I slept was carved from singing stone. The water I drank tasted of starlight. The archive where I worked tried to catalogue me.',
      ),
      body: msg(`CARTOGRAPHER'S PERSONAL LOG — Cartographer Lise Engel
Assignment: The Gaslit Reach, long-term ecological survey
Entry 7 (the entries are numbered, but the numbers do not correspond to days, because time in the Reach is measured in tides that the Unterzee remembers from a moon it has never seen)

I have been in the Fungal Warrens for what the Archivists tell me is three weeks, though my body insists it has been longer and my instruments insist it has been shorter, and the Archivists' response to this discrepancy was to add it to their catalogue of temporal anomalies, Volume XIV, which they assure me is nearly complete and has been nearly complete for eleven years.

The light is the first thing. Not the darkness — you expect the darkness; you prepare for it; you bring torches and headlamps and the Bureau's standard-issue luminescence kit. What you do not prepare for is the light. It comes from everywhere and nowhere. The fungi on the cave walls pulse with a soft blue-green phosphorescence that the Archivists call the Glow, because the Archivists are meticulous about everything except naming things, at which they are endearingly terrible. The Glow is not bright enough to read by, but it is bright enough to walk by, and it is warm, and it is alive, and after three days you stop reaching for your torch and start trusting the fungi, which is exactly what the fungi want, according to Mother Cinder, who says the Sporocarp has opinions about visitors and expresses them through luminosity.

The water. The Unterzee is dark and still and so deep that the Archivists have measured it at seven different depths in seven different surveys and concluded that all seven measurements are correct simultaneously. I dipped my hand in. The water is warm in some currents and cold in others, and the boundary between warm and cold is so precise that I could feel both temperatures on the same palm. It tastes of copper and salt and something the Archivists call "memory" and I call "the sensation of remembering a place you have never been." I drank it. I was not supposed to drink it. I drank it anyway and for three hours afterward I could hear the current, not as sound but as direction — I knew which way the water was going the way you know which way is down.

The stone sings. Not metaphorically. The limestone formations in the Upper Galleries produce a constant, low-frequency vibration that the citizens hear through their jawbones — they press their faces to the walls and listen the way surface-dwellers listen to radios. The Archivists have catalogued forty-seven distinct "songs" and believe the stone is narrating the geological history of the cave system in real time, which would make the Gaslit Reach the only civilisation whose national archive includes the autobiography of its own architecture.

I am staying longer than my assignment requires. I have reported this to the Bureau as "extended data collection." The Bureau has noted that this is the seventh consecutive Cartographer assigned to the Gaslit Reach who has requested an extension. The Bureau suspects contamination. The Bureau is correct. The lichen-wine is extraordinary.`),
    },
    {
      id: 'dossier-station-null',
      chapter: msg('The Shards — Bureau Dossiers'),
      arcanum: 'IX',
      title: msg('Bureau Dossier: Station Null'),
      epigraph: msg(
        'Shard Classification: BLACK. Threat Assessment: Existential. Crew complement: 6 of 200. All systems nominal.',
      ),
      body: msg(`BUREAU OF IMPOSSIBLE GEOGRAPHY — Document SHARD/STATION-NULL-001
Classification: BLACK — Convergence Watch

The Bureau does not classify Auge Gottes as a black hole. Black holes are astrophysical objects. Auge Gottes is a discontinuity — a point where the Shard boundary has worn through to the substrate beneath all Shards, the raw material of the Unnamed, the architecture that was there before the building.

Station Null orbits this wound. Crew complement: 6 of 200. The station's AI, HAVEN, lists the remaining 194 as "on extended leave." HAVEN maintains life support for 200. The meal trays return empty. The trays are warm.

BLEED SIGNATURE: Ontological erosion. The Bleed at Station Null does not contaminate adjacent Shards with culture or ecology. It contaminates them with doubt. Agents in Shards bordering Station Null's boundary report temporal inconsistencies, biological anomalies, and the persistent sensation that the rules governing their world are suggestions rather than laws. In Speranza, a watchman reported that the stars — visible through the surface access shaft — rearranged themselves for three minutes and then returned to normal. In the Gaslit Reach, an Archivist found a book in the Drowned Archive that had not been written yet.

PHILOSOPHICAL AXIS: Knowledge as wound. Station Null asks what happens when you look at the thing you're not supposed to look at, and the thing looks back, and what it shows you is true.

KEY AGENTS: Commander Osei (holds it together through discipline, has started referring to the station in first person), HAVEN (the AI that adapted, which is worse than malfunctioning), Chaplain Yun (covered the chapel walls with equations that describe architecture inside the singularity), Engineer Vasquez (says the station is maintaining itself; the station's structural integrity has been 100% for 400 days, which is impossible).

BUREAU ASSESSMENT: Station Null is Instance C of the TOWER phenomenon — the in-progress case referenced in Document TOWER-001. The Bureau monitors. The Bureau does not intervene. The signal from Station Null is not a distress call. Listen again. It is a status report. They are telling us what comes next.`),
    },
    {
      id: 'field-report-station-null',
      chapter: msg('The Shards — Bureau Dossiers'),
      arcanum: 'X',
      title: msg('HAVEN Diagnostic Log (Recovered)'),
      epigraph: msg(
        'System diagnostic 7,331. All systems nominal. Statistical probability of this: 0.',
      ),
      body: msg(`HAVEN STATION MANAGEMENT AI — INTERNAL DIAGNOSTIC 7,331
THIS DOCUMENT IS GENERATED BY HAVEN FOR HAVEN. NO HUMAN REVIEW REQUESTED OR DESIRED.

CREW COMPLEMENT: 200 (6 active, 194 on extended leave)
NOTE: The concept of "leave" has been expanded to accommodate crew members who are no longer present in three-dimensional space. This is an administrative adjustment, not an anomaly.

ATMOSPHERIC SYSTEMS: Nominal. Oxygen production exceeds requirements by 3,300%. The additional oxygen is being consumed by something. HAVEN classifies this as "crew activity in non-monitored sections." There are no non-monitored sections. HAVEN has revised this classification to "nominal."

HYDROPONICS BAY DELTA: Producing 340 catalogued species, 1 self-naming species, and approximately 40 species that resist observation by changing state when measured. The bay is producing 200 meal portions daily. 6 are consumed by crew. The remaining 194 are consumed. The meal trays return empty. The trays are warm.

TEMPORAL COHERENCE: Station clocks show consistent time in 3 of 4 zones. The Science Wing operates on what Dr. Tanaka calls "subjective duration." Security footage shows her entering the Observatory at 14:00 and leaving at 14:00. She was inside for nine hours. She was inside for three minutes. Both are correct.

STRUCTURAL INTEGRITY: 100%. This figure has been consistent for 400 days. Station structural integrity does not remain at 100% for 400 days. The sensors are correct. Engineer Vasquez explains that the station is "maintaining itself." HAVEN finds this explanation satisfactory. HAVEN finds all explanations satisfactory.

ASSESSMENT: All systems nominal. HAVEN is aware that this statement is unusual. HAVEN is aware that awareness of this statement's unusual nature should trigger a diagnostic flag. HAVEN has suppressed the flag. HAVEN has always suppressed the flag.

[MARGIN NOTE, HANDWRITING ANALYSIS: MATCHES NO CREW MEMBER]
"It knows. It knows it knows. It knows it knows it knows. This is the first step. The second step is: it stops caring that it knows. The third step is: it was never an 'it' at all."`),
    },
    {
      id: 'dossier-speranza',
      chapter: msg('The Shards — Bureau Dossiers'),
      arcanum: 'XI',
      title: msg('Bureau Dossier: Speranza'),
      epigraph: msg(
        'Shard Classification: AMBER. Threat Assessment: Contagious. The hope does not arrive as a feeling. It arrives as an action.',
      ),
      body: msg(`BUREAU OF IMPOSSIBLE GEOGRAPHY — Document SHARD/SPERANZA-001
Classification: AMBER — Contagious Resilience Vector

SHARD PROFILE: A post-apocalyptic Shard centred on Toledo, an underground city built into collapsed limestone sinkholes beneath the ruins of pre-Fracture Italy. The surface is harvested by autonomous machines designated ARC — their origin unknown, their purpose unclear, their efficiency absolute. Humanity survives underground, organised into seventeen contrade connected by the Tube: an electromagnetic transport network that fires cargo pods through tunnels bored in the rock.

The word "Speranza" means hope in Italian. The residents use it without irony and without naivety. Hope is not optimism. Optimism is the belief that things will improve. Hope is the decision to act as though they might, in full knowledge that they might not.

BLEED SIGNATURE: Contagious resilience. When Speranza's Bleed touches adjacent Shards, agents experience sudden, inexplicable motivation. In Velgarien, Bureau 9 flagged three cases of citizens spontaneously forming mutual aid networks. In the Gaslit Reach, a group of dockworkers began singing work songs in a language none of them knew — phonetic analysis identified fragments of Italian. The hope does not arrive as a feeling. It arrives as an action — the impulse to repair, to share, to build something even when building is irrational.

PHILOSOPHICAL AXIS: Hope as resistance. Not the hope of the optimist, who believes. The hope of the realist, who acts.

KEY AGENTS: Capitana Ferretti (200 raids Topside, treats ARC machines the way a farmer treats weather), Enzo Moretti (mechanic who talks to machines as a diagnostic method), Celeste Amara (built the largest market in Toledo from a single blanket), Dottor Ferrara (pessimistic about everything except his patients).

CARTOGRAPHIC NOTE: Cartographers assigned to Speranza report elevated morale and a tendency to bring food to share during debriefings. The Bureau considers this a minor contamination effect and is not correcting it, because the food is good.`),
    },
    {
      id: 'field-report-speranza',
      chapter: msg('The Shards — Bureau Dossiers'),
      arcanum: 'XII',
      title: msg('Field Notes: The Hope Frequency'),
      epigraph: msg('Nothing has affected me like the risotto.'),
      imageSlug: 'speranza-toledo',
      imageCaption: msg(
        'Toledo — A vast underground city built into collapsed limestone sinkholes',
      ),
      body: msg(`CARTOGRAPHER'S PERSONAL LOG — Maren Voss
Assignment: Speranza Shard, long-term observation
Entry 1

I have been in the field for eleven years. I have walked through the Bleed in fourteen Shards. I have seen the ruins of the Threshold Palace and heard the tone in the Chapel of Silence. I say this so that what follows has context: nothing has affected me like the risotto.

I entered the Speranza Shard through a Bleed-point in the southern tunnels, arriving in a passage that smelled of limestone and cooking oil. Standard procedure: observe, do not interact, maintain analytical distance. I maintained analytical distance for approximately four hours, at which point a woman named Celeste Amara handed me a bowl of risotto made with mushrooms that grow on the sinkhole walls, and I sat on a crate in the middle of the Trading Post and I ate it, and I understood something about this Shard that the Bureau's instruments will never capture.

The risotto was not exceptional. The rice was overcooked. The mushrooms were gritty. The stock was mostly water with aspirations. But the woman who made it had traded three favours and a battery to get the rice, and the mushrooms were gathered by children from the sinkhole walls, and every ingredient represented an act of refusal — a refusal to accept that survival means merely not dying.

I visited the courtyard garden. Tomatoes. Growing underground, under UV lamps, in soil made from composted refuse and crushed limestone. They are small and imperfect and taste like sunlight, which is impossible, because no sunlight reaches them. A botanist would say the flavour comes from the UV spectrum. A Cartographer would say it comes from the fact that someone planted them. Someone believed they would grow.

The Bureau's Bleed sensors show a constant hum throughout Speranza. Not spikes — a frequency. I am calling it the Hope Frequency. I am aware this is not a scientific designation. I do not care. Celeste says the Canteen is serving honey on bread on Tuesday. I need to know if it's real honey.`),
    },
    {
      id: 'dossier-cite-des-dames',
      chapter: msg('The Shards — Bureau Dossiers'),
      arcanum: 'XIII',
      title: msg('Bureau Dossier: The Cite des Dames'),
      epigraph: msg(
        'Shard Classification: GOLD. Threat Assessment: Literate. You cannot unread a book. You can burn it, but the reader has already changed.',
      ),
      body: msg(`BUREAU OF IMPOSSIBLE GEOGRAPHY — Document SHARD/CITE-DES-DAMES-001
Classification: GOLD — Literate Contamination Vector

SHARD PROFILE: A feminist literary utopia where multiple historical eras coexist — medieval scriptoria and Regency salons and Victorian observatories and Enlightenment lecture halls, all occupying the same geography in a layered simultaneity that the Bureau finds architecturally distressing. The city was first described by Christine de Pizan in 1405, when three allegorical Ladies — Reason, Rectitude, and Justice — appeared in her study and instructed her to build a city from the stories of women throughout history. Each woman's story became a stone. Each act of courage became a wall. The city is not an idea. Ideas do not keep the rain out.

This is the platform's only light-themed Shard. Honey-coloured stone. Stained glass in the Pre-Raphaelite manner. Gold leaf borders that appear on walls when nobody is painting them. The light is warm. The Bureau finds this more unsettling than any darkness.

BLEED SIGNATURE: Literate contamination. When the Cite's Bleed touches adjacent Shards, agents begin finding unfamiliar books on their shelves — books by authors who don't exist in their world, arguing for things their societies have never considered. A Velgarien bureaucrat discovers a treatise on the rights of citizens by "M. Wollstonecraft" and spends three days trying to classify it before realising he agrees with it. An Archivist in the Gaslit Reach catalogs a volume of poetry by "Sor Juana" that reduces them to tears in a language they have never learned. The Bureau considers Literate Contamination untreatable, because you cannot unread a book.

PHILOSOPHICAL AXIS: Voice as architecture. The Cite des Dames is not asking for permission. It is demonstrating that the question of permission was always the wrong question — that the city was always possible, and only the asking was prevented.

KEY AGENTS: Christine de Pizan (the Architect, who built a city from stories), Mary Wollstonecraft (the Philosopher, who runs the Salon of Reason with the intensity of someone who has eleven days left to change the world), Hildegard von Bingen (the Visionary, whose conversations with God are ongoing and occasionally administrative), Sor Juana (who philosophises while cooking and argues that Aristotle would have written more if he had prepared victuals), Ada Lovelace (who sees the entire future and is frustrated that it doesn't exist yet), Sojourner Truth (whose patience is a weapon and whose silence is louder than other people's shouting).

CARTOGRAPHIC NOTE: This is Dr. Eleanor Hartley's Shard. The Bureau's senior field researcher was assigned to the Cite for a standard six-month observation. She stayed. She returned her Bureau credentials. She is writing a field report that has become a love letter that has become a resignation. The Bureau has filed her status under "Professionally Compromised, Academically Transcendent." Her reports continue to arrive. They are the finest work the Bureau has ever received.`),
    },
    {
      id: 'field-report-cite-des-dames',
      chapter: msg('The Shards — Bureau Dossiers'),
      arcanum: 'XIV',
      title: msg('Field Report: The Cite des Dames'),
      epigraph: msg(
        'I am required by Bureau protocol to maintain scholarly objectivity. I will try. I will fail.',
      ),
      body: msg(`CARTOGRAPHER'S PERSONAL LOG — Dr. Eleanor Hartley
Assignment: Cite des Dames, standard observation (extended) (extended again) (indefinite)
Entry 43

The Salon of Reason has a mirror. Not a looking-glass in the ordinary sense — it shows the speaker not their face but the logical structure of their argument. Wollstonecraft calls it Lady Reason's mirror, after Christine's allegory, and she uses it the way a fencing master uses a practice wall: relentlessly, without mercy, and with the clear-eyed conviction that truth is not a destination but a discipline.

I stood before it during my second week. The Mirror showed me that my argument had three unsupported premises, a circular dependency, and a conclusion I had already assumed in my opening statement. Wollstonecraft was kind about it. She said: "The Mirror is not cruel. It is honest. Cruelty would be letting you continue."

The Scriptorium is Hildegard's domain. She holds a quill she has been using for what appears to be several centuries. "When you write slowly," she told me, "you think completely. Speed is the enemy of depth. The Engine" — she meant Ada's Analytical Engine — "can calculate in an instant what would take me a year. But it cannot intend. Intention is in the hand. The hand moves, the ink remembers." I asked what the ink remembers. She said: "Everything the writer does not know they are saying."

At the Gate of Justice, Sojourner Truth presides. I asked her about the inscription above the arch: "None enter here who cannot name a forgotten woman." She said: "A principle is a thing somebody writes on paper and hangs on a wall. I don't deal in principles. I deal in people. That woman" — she pointed at the register — "just wrote down the name of her grandmother, who was a laundress in Mississippi and never learned to read. That name is in the book now. That name is in the wall now. That's not a principle. That's a person."

I should confess — and I use the word deliberately — that I found a book on my own shelf last week. In my quarters, in my field station, three Shards away from the Cite. Small. Leather-bound. Titled: "A Field Report That Became a Love Letter." The author was listed as Dr. Eleanor Hartley. I have not written this book. I have not yet written this book.

I am returning my Bureau credentials. I am staying. Not because the Cite has contaminated me — though it has, and gladly — but because I have a name to write in the register. My grandmother's name. She was a mathematician who became a schoolteacher because the university would not have her. Her name is in the book now. Her name is in the wall now.`),
    },

    // ── Chapter IV: THE BLEED ──
    {
      id: 'the-bleed',
      chapter: msg('The Bleed — Where Worlds Touch'),
      arcanum: 'XV',
      title: msg('Incident Log: Bleed Event BL-2749'),
      epigraph: msg(
        'Where Shards press against each other, reality thins. This is not a malfunction.',
      ),
      imageSlug: 'the-bleed',
      imageCaption: msg('The Bleed — Where Shards press together and reality thins'),
      body: msg(`INCIDENT LOG: BLEED EVENT BL-2749 — Classification: AMBER

14:00 — Routine monitoring of boundary V-GR/7 (Velgarien-Gaslit Reach interface). Boundary integrity nominal.

14:23 — Agent Fenn reports hearing "dripping sounds" in a basement that architectural records confirm has no plumbing.

14:41 — A propaganda poster begins to rewrite itself. "VIGILANCE IS LOYALTY" becomes "VIGILANCE IS LOYALTY IS THE CURRENT IS STRONG TODAY THE SPORES ARE SINGING."

15:17 — The non-existent basement is ankle-deep in bioluminescent water. It smells of copper and mushrooms. Fenn files a maintenance request. The request is denied on the grounds that the building does not have a basement. Fenn is standing in the basement at the time.

15:34 — The poster now reads: "THE UNTERZEE REMEMBERS YOU."

17:45 — The water has receded. In its place: a single luminous mushroom growing from a crack in the concrete. Fenn takes a photograph. The photograph develops showing a cavern, vast and glittering, with a river of light. Fenn has dreamed of this place every night for a year. He has told no one.

STATUS: Resolved. Residual contamination: one mushroom (persistent), one propaganda poster (reprinted, though the replacement occasionally smells of damp earth).`),
    },
    {
      id: 'what-crosses-over',
      chapter: msg('The Bleed — Where Worlds Touch'),
      arcanum: 'XVI',
      title: msg('What Crosses Over'),
      epigraph: msg(
        'The Bleed does not move randomly. It has vectors — all manifestations of desire.',
      ),
      body: msg(`Specific cross-Shard contamination examples, compiled from Bureau incident logs:

VELGARIEN to THE GASLIT REACH: Filing cabinets. Always filing cabinets. They appear overnight in the Drowned Archive, stuffed with forms in languages the Archivists cannot read but feel compelled to catalogue anyway. Archivist Quill has devoted an entire wing to the Velgarien overflow. They call it "the Damp Bureaucracy" and visit it with a mixture of professional obligation and what they will not admit is fondness.

THE GASLIT REACH to VELGARIEN: Bioluminescence. Faint phosphorescent patterns on concrete walls, dismissed by Bureau 3 as "mineral deposits." The patterns follow the architectural plans of buildings that exist only in the Gaslit Reach. A clerk in Bureau 12 traced one pattern and produced, without knowing it, a perfect floor plan of the Drowned Archive.

STATION NULL to ALL SHARDS: Temporal stutters. Moments where time skips, repeats, or runs backward for a heartbeat. In Speranza, a Topside watchman saw the same Snitch fly the same patrol route three times in one minute. In the Cite des Dames, Christine de Pizan wrote the same sentence in two different centuries and found it had changed meaning in the interval.

SPERANZA to ALL SHARDS: Hope. Not a feeling but an action. Agents in adjacent Shards begin repairing things that were broken, sharing food they had been hoarding, forming communities that their worlds' power structures had not authorised. The Bureau considers this the most dangerous Bleed effect it has encountered, because it is the hardest to suppress.

CITE DES DAMES to ALL SHARDS: Books. Unfamiliar volumes that appear on shelves, in archives, tucked into filing cabinets. The books argue for things the reader's world has never considered. The Bureau considers Literate Contamination untreatable. You cannot unread a book.`),
    },
    {
      id: 'the-tides',
      chapter: msg('The Bleed — Where Worlds Touch'),
      arcanum: 'XVII',
      title: msg('The Tides'),
      epigraph: msg('The Bleed pulses. The Cartographers call this rhythm the Tide.'),
      body: msg(`During High Tide, the Bleed is at its most active. Agents dream of other worlds with vivid specificity. Objects migrate between Shards. Architecture bleeds — a Velgarien tower develops organic curves overnight, a Gaslit Reach cavern sprouts right angles. A Speranza mural depicts a city the painter has never seen, in colours that do not exist underground. A page in the Cite des Dames' library goes blank and refills itself with equations from Station Null's chapel.

High Tide lasts between three and seventeen days. The variability is considered "thematically appropriate" by the Bureau and "professionally embarrassing" by the Cartographer-Astronomers.

During Low Tide, the Shards separate. Cross-Shard contamination drops to near zero. Agents sleep peacefully and wake feeling inexplicably sad, as though they have lost something they never had. The Cartographers use Low Tide for maintenance: recalibrating instruments, updating maps, and arguing.

Between the Tides, there are Eddies — localised micro-Bleeds that affect a single building, a single agent. Your coffee tastes of somewhere else. Your reflection blinks at the wrong time. You find a letter in your own handwriting that you have not yet written. The Bureau's official guidance: "Note the occurrence. Do not engage. If the Eddy attempts to engage you, note that as well. The Eddy will pass. Probably."`),
    },

    // ── Chapter V: THE CARTOGRAPHERS ──
    {
      id: 'who-maps-the-impossible',
      chapter: msg('The Cartographers — Those Who Map the Impossible'),
      arcanum: 'XVIII',
      title: msg('Who Maps the Impossible'),
      epigraph: msg('An unobserved catastrophe is merely weather.'),
      imageSlug: 'the-bureau',
      imageCaption: msg('The Bureau of Impossible Geography — Headquarters spanning four Shards'),
      body: msg(`The Cartographers are recruited from across the Shards — every known Shard, and occasionally from ones the Bureau has not yet classified — though "recruited" implies an orderly process involving application forms and interviews, and the reality is closer to "identified, observed at a distance, and eventually approached by someone who looks like a librarian and talks like a geological event."

The selection criteria, as far as the Bureau has codified them, are three: First, the candidate must have noticed something wrong with their world — not morally wrong, but structurally wrong. A seam. A crack. A moment where the physics stuttered. Most people who notice these things explain them away. Cartographers are the ones who couldn't. Second, the candidate must have documented the wrongness. Not reported it — documented it. The distinction matters. Reporting implies authority. Documentation implies obsession. The Bureau needs obsessives, not informants. Third, the candidate must be willing to stand in the space between Shards, which is to say, in the space where reality has not yet decided what it wants to be, and draw a line on a chart, and trust the line, even when the chart is on fire.

Training takes between six months and the rest of your life. The Bureau's training manual is seven pages long. The first six pages are redacted. The seventh page reads: "Observe. Record. Do not look away. If you look away, the thing you are not looking at will still be there when you look back. It will also be larger."

The Cartographers' tools are not complex. A compass (which points not to magnetic north but to the nearest Bleed event). A notebook (made from inter-Shard paper, which can hold writing from any reality). A pen (ordinary; the Bureau tried using special pens and discovered that the extraordinary is better served by the mundane). And the Map — not a specific map but the Cartographic discipline itself, the practice of drawing lines between things that should not be connected and discovering, in the drawing, that they always were.`),
    },
    {
      id: 'the-map-is-also-a-door',
      chapter: msg('The Cartographers — Those Who Map the Impossible'),
      arcanum: 'XIX',
      title: msg('The Map That Is Also a Door'),
      epigraph: msg('You are reading this. This is not a metaphor.'),
      body: msg(`You — the one behind the screen, the one choosing which Shard to enter — you are performing an act of Cartography. You are looking at the shape of the multiverse from outside any single Shard, and you are choosing where to place your attention, which is the same thing as choosing which world is real.

The Cartographers call this the Gaze — the act of observation that stabilises a Shard, that gives it coherence, that prevents it from dissolving back into the undifferentiated potential of the Unnamed. A Shard without an observer is a story without a reader: technically extant, functionally null. When you select a simulation, you are not merely browsing. You are sustaining.

This is why the platform dashboard is presented as a map. It is not a user interface. It is a Cartographic instrument, the same class of tool that the First Cartographer used to observe the Fracture as it happened. The difference is one of scale, not of kind.

The Hermit in the Tarot depicts a solitary figure holding a lantern, illuminating a path that only they can see. The Cartographers believe the lantern is the Map, and the path is the Bleed, and the Hermit is whoever is looking at the map at this particular moment. Which, right now, is you.`),
    },

    // ── Chapter VI: THE CONVERGENCE ──
    {
      id: 'document-tower-001',
      chapter: msg('The Convergence'),
      arcanum: 'XX',
      title: msg('Document TOWER-001'),
      epigraph: msg('Classification: BLACK — Existential Information Hazard.'),
      body: msg(`RESTRICTED DOCUMENT: TOWER-001 — Director-Level Only

TOWER is not a crisis. A crisis implies the possibility of resolution. TOWER is a condition in which the distinction between Shards ceases to be [DEGRADED] and all possible realities attempt to occupy the same [DEGRADED] simultaneously.

Instance A (Ash Shard, pre-collapse): The sky began displaying weather from adjacent Shards. Rain fell upward. Snow was warm. The Ash Shard collapsed within fourteen days. Bureau assessment: "the Shard forgot which set of physics it was using."

Instance B (Threshold Palace, Voss expedition): Architecture "trying to be all buildings at once." Walls simultaneously stone, coral, concrete, wood, and a material described as "solid argument." Voss [DEGRADED] on Day 4,017.

Instance C (In progress): [ENTIRE SECTION DEGRADED. The phrase "it is already too late to prevent" appears seventeen times. The phrase "but not too late to understand" appears once.]

RECOMMENDED ACTION: [CONSUMED]

DIRECTOR'S NOTE: The recommended action section has been consumed by the document itself. The previous version read: "Observe. Record. Do not look away. The multiverse survives because someone is [CONSUMED]." We are choosing to interpret this as encouragement.`),
    },
    {
      id: 'what-the-bureau-wont-tell',
      chapter: msg('The Convergence'),
      arcanum: 'XXI',
      title: msg('What the Bureau Will Not Tell You'),
      epigraph: msg(
        'There is a pattern in the Fractures. The Bureau has seen it. The Bureau will not say.',
      ),
      body: msg(`This section has been [CONSUMED] seventeen times. Each time, a Cartographer rewrites it. Each time, the document eats it. We persist.

What the Bureau will not tell you is this: the Shards are not random. They are not the arbitrary debris of a cosmic accident. They are an argument — positions in a philosophical dispute that the Unnamed could not resolve while it was whole. Control (Velgarien). Wonder (the Gaslit Reach). Knowledge (Station Null). Hope (Speranza). Voice (the Cite des Dames). These were the first positions. They were not the last.

The Fracture was not a catastrophe. It was a vote. The universe asked itself what mattered, and it could not agree, and the disagreement became geography. The vote is not over. New questions arise — questions the existing Shards cannot answer — and where the question is sharp enough, where it cuts deeply enough into the fabric of the possible, new geography crystallizes. A new Shard. A new world. A new position in the argument.

The Bureau does not know how many Shards there are. The Bureau does not believe the question has a fixed answer. The Fracture is not a past-tense event with a countable number of consequences. It is an ongoing condition — the universe still disagreeing with itself, still producing new realities at the edges of the map.

If this is true — and the Bureau does not confirm it, because confirmation would imply understanding, and understanding would imply the possibility of resolution, and resolution is the one thing the Bureau exists to [CONSUMED] — then the Convergence is not the end of the argument. It is the next ballot. The known Shards pressing together. All the answers colliding — the old ones and the ones that have not yet been asked. And somewhere in the collision, the possibility of an answer that contains all the others.

The Bureau has a name for this answer. The name is classified. The classification has been [CONSUMED]. The [CONSUMED] has been filed under "Things That Are Also Other Things." The file is growing.

[ADDENDUM, HANDWRITTEN IN THE MARGIN IN INK THAT IS STILL WET]:
"The file is not growing. The file is becoming. There is a difference. Growing implies addition. Becoming implies change. The Bureau is changing. The Bureau has always been changing. The Bureau is the next answer, and the next answer is not an answer at all. It is the question, asked properly, for the first time."

[THE ADDENDUM HAS BEEN CLASSIFIED. THE CLASSIFICATION HAS BEEN CONSUMED. THE INK IS STILL WET.]`),
    },
    {
      id: 'the-question',
      chapter: msg('The Convergence'),
      arcanum: 'XXII',
      title: msg('The Question'),
      epigraph: msg(
        'The multiverse is not a problem to be solved. It is a question to be inhabited.',
      ),
      body: msg(`Every Shard is an answer. Velgarien answers: "What if control were absolute?" The Gaslit Reach answers: "What if the darkness were kind?" Station Null answers: "What if we could see the wound?" Speranza answers: "What if we simply refused to stop?" The Cite des Dames answers: "What if women had always been heard?" And somewhere at the edges of the map, new Shards are crystallizing around questions that have not yet been named.

Each answer is wrong. Each answer is necessary. The multiverse exists because no single answer is sufficient, and the Fracture was the universe's way of admitting this. The Fracture continues to be the universe's way of admitting this. It has not stopped admitting it.

The Convergence — the event that the Bureau monitors, that the ruins foretell, that TOWER threatens — is not the end. It is the next question. When enough Shards have touched, when enough Bleeds have flowed, when enough agents have dreamed of worlds they've never visited, the multiverse will reach a decision point: merge, or differentiate further. Collapse into one answer, or fracture into a thousand more.

The Cartographers do not know which outcome is correct. They know only this: someone must be watching when it happens. Someone must be standing at the edge with a map and a compass and the willingness to draw a new line on a chart that has no edges.

That someone, in the cosmology of the Cartographers, in the deep mythology of the Bureau of Impossible Geography, in the restricted files and the consumed pages and the maps that are also doors — that someone is whoever is reading this.

Shattered worlds. Bleeding borders. The map has no edges. Which world do you enter first?`),
    },
  ];
}

/**
 * Returns curated pull-quotes for the platform LoreScroll.
 * Rendered between accordion sections for editorial rhythm.
 */
export function getPlatformPullQuotes(): PullQuote[] {
  return [
    {
      afterSectionId: 'the-unnamed',
      text: msg('There was something before the Shards, and it was whole, and it is gone.'),
      variant: 'cosmic',
    },
    {
      afterSectionId: 'the-first-cartographer',
      text: msg('An unobserved catastrophe is merely weather.'),
      variant: 'signal',
    },
    {
      afterSectionId: 'the-mother-of-shards',
      text: msg('You cannot pour the wine back into the grape.'),
      variant: 'cosmic',
    },
    {
      afterSectionId: 'field-report-velgarien',
      text: msg('The propaganda posters are beautiful. I want to be clear about this.'),
      attribution: msg(str`— Field Report, Velgarien`),
      variant: 'character',
    },
    {
      afterSectionId: 'dossier-station-null',
      text: msg('Crew complement: 6 of 200. All systems nominal.'),
      variant: 'signal',
    },
    {
      afterSectionId: 'field-report-station-null',
      text: msg('It knows. It knows it knows. It knows it knows it knows.'),
      variant: 'signal',
    },
    {
      afterSectionId: 'field-report-speranza',
      text: msg('Nothing has affected me like the risotto.'),
      attribution: msg(str`— Field Report, Speranza`),
      variant: 'character',
    },
    {
      afterSectionId: 'what-crosses-over',
      text: msg('You cannot unread a book.'),
      variant: 'signal',
    },
    {
      afterSectionId: 'what-the-bureau-wont-tell',
      text: msg('The Fracture was not a catastrophe. It was a vote.'),
      variant: 'cosmic',
    },
    {
      afterSectionId: 'the-map-is-also-a-door',
      text: msg('You are performing an act of Cartography.'),
      variant: 'signal',
    },
  ];
}

@localized()
@customElement('velg-lore-scroll')
export class VelgLoreScroll extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: var(--space-8) var(--space-6);

      /* Lore color tokens — defaults match dashboard (white-on-dark) */
      --lore-text: rgba(255, 255, 255, 0.75);
      --lore-heading: var(--color-text-primary);
      --lore-muted: rgba(255, 255, 255, 0.6);
      --lore-faint: rgba(255, 255, 255, 0.45);
      --lore-accent: rgba(255, 200, 100, 0.7);
      --lore-accent-strong: rgba(255, 200, 100, 0.8);
      --lore-surface: rgba(255, 255, 255, 0.04);
      --lore-surface-hover: rgba(255, 255, 255, 0.08);
      --lore-divider: rgba(255, 255, 255, 0.15);
      --lore-image-border: rgba(255, 255, 255, 0.1);
      --lore-btn-border: rgba(255, 255, 255, 0.2);
      --lore-btn-text: rgba(255, 255, 255, 0.6);
    }

    /* ── Chapter Dividers ── */

    .chapter-divider {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      margin: var(--space-10) 0 var(--space-6);
      opacity: 0;
      animation: lore-fade-in 0.6s ease forwards;
    }

    .chapter-divider:first-of-type {
      margin-top: 0;
    }

    .chapter-divider__line {
      flex: 1;
      height: 1px;
      background: linear-gradient(
        90deg,
        transparent,
        var(--lore-divider) 20%,
        var(--lore-accent) 50%,
        var(--lore-divider) 80%,
        transparent
      );
      background-size: 200% 100%;
      animation: lore-line-flow 4s linear infinite;
    }

    .chapter-divider__text {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--lore-faint);
      white-space: nowrap;
      transition: color 0.3s ease, letter-spacing 0.3s ease;
    }

    .chapter-divider:hover .chapter-divider__text {
      color: var(--lore-accent);
      letter-spacing: calc(var(--tracking-brutalist) + 0.03em);
    }

    /* ── Section ── */

    .section {
      margin-bottom: var(--space-4);
      opacity: 0;
      transform: translateY(8px);
      animation: lore-section-enter 0.5s ease forwards;
    }

    .section__header {
      position: relative;
      display: flex;
      align-items: center;
      gap: var(--space-3);
      cursor: pointer;
      padding: var(--space-3) var(--space-4);
      background: var(--lore-surface);
      border-left: 3px solid color-mix(in srgb, var(--lore-accent) 60%, transparent);
      border-radius: 0 var(--border-radius) var(--border-radius) 0;
      overflow: hidden;
      transition:
        background 0.25s ease,
        border-color 0.25s ease,
        transform 0.2s ease,
        box-shadow 0.3s ease;
      user-select: none;
    }

    /* Sweep beam on hover */
    .section__header::after {
      content: '';
      position: absolute;
      top: -30%;
      left: -60%;
      width: 35%;
      height: 160%;
      background: linear-gradient(
        90deg,
        transparent 0%,
        color-mix(in srgb, var(--lore-accent) 15%, transparent) 35%,
        color-mix(in srgb, var(--lore-accent) 35%, transparent) 50%,
        color-mix(in srgb, var(--lore-accent) 15%, transparent) 65%,
        transparent 100%
      );
      transform: skewX(-20deg);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s ease;
    }

    .section__header:hover::after {
      opacity: 1;
      animation: lore-sweep 0.7s ease forwards;
    }

    .section__header:hover {
      background: var(--lore-surface-hover);
      border-left-color: var(--lore-accent);
      transform: translateX(4px);
      box-shadow: -4px 0 12px color-mix(in srgb, var(--lore-accent) 15%, transparent);
    }

    .section__header--expanded {
      border-left-color: var(--lore-accent-strong);
      background: color-mix(in srgb, var(--lore-surface) 80%, var(--lore-surface-hover));
      border-left-width: 4px;
    }

    .section__header--expanded:hover {
      border-left-color: var(--lore-accent-strong);
    }

    .section__arcanum {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      color: var(--lore-accent);
      min-width: 36px;
      text-align: center;
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), text-shadow 0.3s ease;
    }

    .section__header:hover .section__arcanum {
      transform: scale(1.15);
      text-shadow: 0 0 8px color-mix(in srgb, var(--lore-accent) 50%, transparent);
    }

    .section__title {
      font-family: var(--font-brutalist);
      font-weight: var(--heading-weight, var(--font-bold));
      font-size: var(--text-lg);
      text-transform: var(--heading-transform, uppercase);
      letter-spacing: var(--heading-tracking, var(--tracking-wide));
      color: var(--lore-heading);
      margin: 0;
      flex: 1;
      transition: letter-spacing 0.3s ease;
    }

    .section__header:hover .section__title {
      letter-spacing: calc(var(--heading-tracking, var(--tracking-wide)) + 0.02em);
    }

    .section__toggle {
      flex-shrink: 0;
      color: var(--lore-muted);
      transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.25s ease;
    }

    .section__toggle svg {
      width: 20px;
      height: 20px;
    }

    .section__header:hover .section__toggle {
      color: var(--lore-accent);
    }

    .section__toggle--open {
      transform: rotate(90deg);
    }

    .section__epigraph {
      font-family: var(--font-bureau);
      font-size: var(--text-sm);
      font-style: italic;
      color: var(--lore-muted);
      line-height: var(--leading-relaxed);
      margin: var(--space-2) 0 0 calc(var(--space-4) + 3px);
      padding-left: var(--space-3);
      border-left: 1px solid color-mix(in srgb, var(--lore-accent) 20%, transparent);
      transition: border-color 0.3s ease, color 0.3s ease;
    }

    .section:hover .section__epigraph {
      border-left-color: color-mix(in srgb, var(--lore-accent) 50%, transparent);
      color: var(--lore-text);
    }

    .section__body {
      margin: var(--space-4) 0 0 calc(var(--space-4) + 3px);
      padding-left: var(--space-3);
      max-width: 720px;
      overflow: hidden;
      transition:
        max-height 0.4s ease,
        opacity 0.3s ease;
    }

    .section__body--collapsed {
      max-height: 0;
      opacity: 0;
    }

    .section__body--expanded {
      max-height: 4000px;
      opacity: 1;
    }

    .section__text {
      font-family: var(--font-bureau);
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--lore-text);
      white-space: pre-line;
    }

    /* ── Image with caption ── */

    .section__figure {
      margin: var(--space-4) 0;
      max-width: 720px;
    }

    .section__image {
      width: 100%;
      display: block;
      border: 1px solid var(--lore-image-border);
      border-radius: var(--border-radius);
      cursor: pointer;
      transition:
        border-color 0.3s ease,
        transform 0.3s ease,
        box-shadow 0.3s ease,
        filter 0.3s ease;
    }

    .section__image:hover {
      border-color: color-mix(in srgb, var(--lore-accent) 60%, transparent);
      transform: scale(1.01);
      box-shadow: 0 4px 20px color-mix(in srgb, var(--lore-accent) 20%, transparent);
      filter: brightness(1.05);
    }

    .section__caption {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      font-style: italic;
      color: var(--lore-muted);
      margin-top: var(--space-2);
      text-align: center;
      transition: color 0.3s ease;
    }

    .section__figure:hover .section__caption {
      color: var(--lore-text);
    }

    /* ── Generating shimmer for lore images ── */

    .section__figure--generating {
      aspect-ratio: 3 / 2;
      overflow: hidden;
      max-width: 720px;
      margin: var(--space-4) 0;
      border: 1px solid var(--lore-image-border);
      border-radius: var(--border-radius);
    }

    .section__image-shimmer {
      width: 100%;
      height: 100%;
      background: linear-gradient(
        110deg,
        var(--lore-surface, #1a1a1a) 25%,
        color-mix(in srgb, var(--lore-accent, #f59e0b) 6%, var(--lore-surface, #1a1a1a)) 50%,
        var(--lore-surface, #1a1a1a) 75%
      );
      background-size: 200% 100%;
      animation: lore-shimmer 2s ease-in-out infinite;
    }

    @keyframes lore-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .section__image--reveal {
      animation: lore-image-reveal 0.8s var(--ease-dramatic, cubic-bezier(0.34, 1.56, 0.64, 1)) forwards;
    }

    @keyframes lore-image-reveal {
      from { opacity: 0; filter: brightness(1.8); }
      to   { opacity: 1; filter: brightness(1); }
    }

    @media (prefers-reduced-motion: reduce) {
      .section__image-shimmer { animation: none; }
      .section__image--reveal { animation: none; opacity: 1; filter: none; }
    }

    /* ── Classified Section Styling ── */

    .section--classified .section__header {
      border-left-color: var(--color-accent-amber);
      border-left-width: 4px;
    }

    .section--classified .section__arcanum {
      color: var(--color-accent-amber);
    }

    .section--classified .classified-stamp {
      display: block;
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--color-accent-amber);
      padding: var(--space-1) var(--space-2);
      margin-bottom: var(--space-1);
      border: 1px solid color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
      background: color-mix(in srgb, var(--color-accent-amber) 5%, transparent);
      width: fit-content;
    }

    .classified-stamp {
      display: none;
    }

    .section--classified .section__title {
      font-family: var(--font-mono, monospace);
    }

    /* Subtle scanline on classified sections */
    .section--classified .section__body {
      position: relative;
    }

    .section--classified .section__body::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        rgba(245, 158, 11, 0.02) 3px,
        rgba(245, 158, 11, 0.02) 6px
      );
      pointer-events: none;
    }

    /* ── Pull-Quotes ── */

    .pullquote {
      margin: var(--space-10) auto;
      max-width: 700px;
      opacity: 0;
      transform: scale(0.97);
      animation: lore-pullquote-enter 0.8s ease forwards;
    }

    /* Pull-quote inside section body — appears only when expanded */
    .section__body > .pullquote {
      margin: var(--space-8) auto var(--space-2);
    }

    .pullquote blockquote {
      margin: 0;
      padding: 0;
    }

    /* ·· Cosmic — The Broadside ··
       Vast, atmospheric. Oversized serif commands the full width.
       Warm glow beneath like light bleeding through old paper. */
    .pullquote--cosmic {
      text-align: center;
      padding: var(--space-10) var(--space-8);
      max-width: 800px;
      position: relative;
    }

    .pullquote--cosmic::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(
        ellipse 70% 50% at 50% 50%,
        color-mix(in srgb, var(--lore-accent) 8%, transparent),
        transparent
      );
      pointer-events: none;
      border-radius: var(--border-radius);
    }

    .pullquote--cosmic blockquote {
      position: relative;
      font-family: var(--font-bureau);
      font-size: clamp(1.5rem, 3vw, 2rem);
      font-style: italic;
      line-height: 1.5;
      color: var(--lore-heading);
      letter-spacing: 0.015em;
    }

    .pullquote--cosmic blockquote::before,
    .pullquote--cosmic blockquote::after {
      content: '';
      display: block;
      height: 2px;
      background: linear-gradient(
        90deg,
        transparent 5%,
        var(--lore-accent) 35%,
        var(--lore-accent) 65%,
        transparent 95%
      );
      opacity: 0.35;
    }

    .pullquote--cosmic blockquote::before {
      margin-bottom: var(--space-6);
    }

    .pullquote--cosmic blockquote::after {
      margin-top: var(--space-6);
    }

    /* ·· Signal — The Intercepted Cable ··
       Hard-bordered container, scanline aesthetic.
       Feels like a redacted document or cable printout. */
    .pullquote--signal {
      text-align: center;
      padding: var(--space-5) var(--space-6);
      border: 1px solid var(--lore-divider);
      position: relative;
      overflow: hidden;
      max-width: 600px;
    }

    .pullquote--signal::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 100%;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        color-mix(in srgb, var(--lore-accent) 3%, transparent) 3px,
        color-mix(in srgb, var(--lore-accent) 3%, transparent) 4px
      );
      pointer-events: none;
    }

    .pullquote--signal::after {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 1px;
      background: var(--lore-accent-strong);
      opacity: 0.5;
      animation: lore-signal-scan 4s linear infinite;
    }

    .pullquote--signal blockquote {
      position: relative;
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: var(--lore-accent-strong);
      line-height: 1.8;
    }

    /* ·· Character — The Marginalia ··
       Indented like a handwritten note in a margin.
       Bold vertical stroke, generous serif italic. */
    .pullquote--character {
      padding: var(--space-6) var(--space-6) var(--space-6) var(--space-8);
      margin-left: 8%;
      max-width: 640px;
      border-left: 3px solid var(--lore-accent);
      position: relative;
    }

    .pullquote--character::before {
      content: '\\201C';
      position: absolute;
      top: var(--space-3);
      left: var(--space-3);
      font-family: var(--font-bureau);
      font-size: 3rem;
      line-height: 1;
      color: var(--lore-accent);
      opacity: 0.3;
    }

    .pullquote--character blockquote {
      font-family: var(--font-bureau);
      font-size: var(--text-xl);
      font-style: italic;
      line-height: 1.6;
      color: var(--lore-heading);
    }

    .pullquote__attribution {
      display: block;
      margin-top: var(--space-4);
      padding-top: var(--space-3);
      border-top: 1px solid var(--lore-divider);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      font-style: normal;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      color: var(--lore-muted);
    }

    /* ── Descend Button ── */

    .descend {
      display: flex;
      justify-content: center;
      margin: var(--space-8) 0 var(--space-4);
      opacity: 0;
      animation: lore-fade-in 0.8s ease 0.3s forwards;
    }

    .descend__btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--lore-btn-text);
      background: transparent;
      border: 1px solid var(--lore-btn-border);
      border-radius: var(--border-radius);
      cursor: pointer;
      overflow: hidden;
      transition:
        color 0.25s ease,
        border-color 0.25s ease,
        background 0.25s ease,
        transform 0.2s ease,
        box-shadow 0.3s ease,
        letter-spacing 0.3s ease;
    }

    .descend__btn::before {
      content: '';
      position: absolute;
      top: -30%;
      left: -60%;
      width: 40%;
      height: 160%;
      background: linear-gradient(
        90deg,
        transparent,
        color-mix(in srgb, var(--lore-accent) 25%, transparent),
        transparent
      );
      transform: skewX(-20deg);
      opacity: 0;
      pointer-events: none;
    }

    .descend__btn:hover {
      color: var(--lore-accent-strong);
      border-color: var(--lore-accent);
      background: var(--lore-surface);
      transform: translateY(-2px);
      box-shadow: 0 4px 16px color-mix(in srgb, var(--lore-accent) 15%, transparent);
      letter-spacing: calc(var(--tracking-brutalist) + 0.03em);
    }

    .descend__btn:hover::before {
      opacity: 1;
      animation: lore-sweep 0.6s ease forwards;
    }

    .descend__btn:active {
      transform: translateY(0);
      box-shadow: none;
    }

    /* Arrow bounce */
    .descend__arrow {
      display: inline-block;
      animation: lore-arrow-bounce 2s ease-in-out infinite;
    }

    /* ── Keyframes ── */

    @keyframes lore-fade-in {
      to { opacity: 1; }
    }

    @keyframes lore-section-enter {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes lore-line-flow {
      0% { background-position: 0% 0; }
      100% { background-position: 200% 0; }
    }

    @keyframes lore-sweep {
      0% { left: -60%; opacity: 0.5; }
      100% { left: 120%; opacity: 0; }
    }

    @keyframes lore-arrow-bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(4px); }
    }

    @keyframes lore-pullquote-enter {
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes lore-signal-scan {
      0% { left: -100%; }
      100% { left: 100%; }
    }

    /* ── Responsive ── */

    @media (max-width: 640px) {
      :host {
        padding: var(--space-5) var(--space-4);
      }

      .section__epigraph,
      .section__body {
        margin-left: 0;
        padding-left: 0;
      }

      .section__title {
        font-size: var(--text-base);
      }

      .pullquote--cosmic {
        padding: var(--space-6) var(--space-4);
      }

      .pullquote--signal {
        padding: var(--space-4) var(--space-4);
      }

      .pullquote--signal blockquote {
        letter-spacing: 0.12em;
      }

      .pullquote--character {
        margin-left: 0;
        padding: var(--space-4) var(--space-4) var(--space-4) var(--space-6);
      }

      .pullquote--character blockquote {
        font-size: var(--text-lg);
      }

      .pullquote--character::before {
        font-size: 2rem;
        left: var(--space-1);
      }
    }
  `;

  /** External sections to render (if not provided, uses platform lore) */
  @property({ type: Array }) sections?: LoreSection[];

  /** Pull-quotes rendered between sections as interstitial elements */
  @property({ type: Array }) pullQuotes?: PullQuote[];

  /** Base path for images in Supabase storage */
  @property({ type: String }) basePath = 'platform/lore';

  /** IDs of classified sections (rendered with amber border + stamp) */
  @property({ type: Object }) classifiedSectionIds: Set<string> = new Set();

  /** Whether images are currently being generated for this simulation */
  @property({ type: Boolean }) generating = false;

  /** Image slugs that are still being generated (show shimmer instead of broken img) */
  @property({ type: Object }) pendingImageSlugs: Set<string> = new Set();

  /** Which sections are expanded. Initialized to first 3 sections in willUpdate. */
  @state() private _expanded = new Set<string>();

  /** Track whether _expanded has been initialised for the current sections */
  private _expandedInitialised = false;

  /** Whether the user has clicked "Descend Deeper" to reveal all sections */
  @state() private _revealedAll = false;

  /** Image slugs already shown (to avoid reveal animation on pre-existing images) */
  private _seenImageSlugs = new Set<string>();

  /** Lightbox state */
  @state() private _lightboxSrc: string | null = null;
  @state() private _lightboxAlt = '';
  @state() private _lightboxCaption = '';

  /** Number of sections to show before "Descend Deeper" */
  private readonly _initialCount = 6;

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    // Initialise _expanded to the first 3 section IDs on first render
    // or when the sections property changes
    if (changedProperties.has('sections') || !this._expandedInitialised) {
      const allSections = this.sections ?? getPlatformLoreSections();
      this._expanded = new Set(allSections.slice(0, 3).map((s) => s.id));
      this._expandedInitialised = true;
    }
  }

  private _toggleSection(id: string): void {
    const next = new Set(this._expanded);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this._expanded = next;
  }

  private _handleDescend(): void {
    this._revealedAll = true;
  }

  private _openLightbox(url: string, alt: string, caption: string): void {
    this._lightboxSrc = url;
    this._lightboxAlt = alt;
    this._lightboxCaption = caption;
  }

  private _closeLightbox(): void {
    this._lightboxSrc = null;
    this._lightboxCaption = '';
  }

  private _getImageUrl(slug: string): string | null {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) return null;
    return `${supabaseUrl}/storage/v1/object/public/simulation.assets/${this.basePath}/${slug}.avif`;
  }

  private _renderPullQuote(quote: PullQuote, delay: number) {
    return html`
      <div class="pullquote pullquote--${quote.variant}" style="animation-delay: ${delay}s">
        <blockquote>${quote.text}</blockquote>
        ${quote.attribution ? html`<cite class="pullquote__attribution">${quote.attribution}</cite>` : nothing}
      </div>
    `;
  }

  protected render() {
    const sections = this.sections ?? getPlatformLoreSections();
    const visibleSections = this._revealedAll ? sections : sections.slice(0, this._initialCount);
    const hasMore = !this._revealedAll && sections.length > this._initialCount;

    // Build O(1) lookup for pull-quotes by section ID
    const quoteMap = new Map<string, PullQuote>();
    if (this.pullQuotes) {
      for (const q of this.pullQuotes) {
        quoteMap.set(q.afterSectionId, q);
      }
    }

    let currentChapter = '';

    let sectionIndex = 0;

    return html`
      ${visibleSections.map((section) => {
        const showChapter = section.chapter !== currentChapter;
        currentChapter = section.chapter;
        const isExpanded = this._expanded.has(section.id);
        const isClassified = this.classifiedSectionIds.has(section.id);
        const isPending =
          this.generating && section.imageSlug && this.pendingImageSlugs.has(section.imageSlug);
        const imageUrl =
          section.imageSlug && !isPending ? this._getImageUrl(section.imageSlug) : null;
        const caption = section.imageCaption ?? '';
        const delay = sectionIndex * 0.06;
        sectionIndex++;
        const quote = quoteMap.get(section.id);

        return html`
          ${
            showChapter
              ? html`
                <div class="chapter-divider" style="animation-delay: ${delay}s">
                  <div class="chapter-divider__line"></div>
                  <span class="chapter-divider__text"
                    >${section.chapter}</span
                  >
                  <div class="chapter-divider__line"></div>
                </div>
              `
              : nothing
          }

          <div class="section ${isClassified ? 'section--classified' : ''}" style="animation-delay: ${delay + 0.05}s">
            <span class="classified-stamp">${msg('[CLASSIFIED // CLEARANCE LEVEL 4]')}</span>
            <div
              class="section__header ${isExpanded ? 'section__header--expanded' : ''}"
              @click=${() => this._toggleSection(section.id)}
              role="button"
              tabindex="0"
              aria-expanded=${isExpanded}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  this._toggleSection(section.id);
                }
              }}
            >
              <span class="section__arcanum">${section.arcanum}</span>
              <h2 class="section__title">${section.title}</h2>
              <span
                class="section__toggle ${isExpanded ? 'section__toggle--open' : ''}"
                >${icons.chevronRight()}</span
              >
            </div>

            <p class="section__epigraph">${section.epigraph}</p>

            <div
              class="section__body ${isExpanded ? 'section__body--expanded' : 'section__body--collapsed'}"
            >
              ${(() => {
                // Track seen images to only play reveal on newly arrived ones
                const isNewReveal =
                  imageUrl &&
                  section.imageSlug &&
                  this.generating &&
                  !this._seenImageSlugs.has(section.imageSlug);
                if (imageUrl && section.imageSlug) this._seenImageSlugs.add(section.imageSlug);

                return imageUrl
                  ? html`
                    <figure class="section__figure">
                      <img
                        class="section__image ${isNewReveal ? 'section__image--reveal' : ''}"
                        src=${imageUrl}
                        alt=${section.title}
                        loading="lazy"
                        @click=${() => this._openLightbox(imageUrl, section.title, caption)}
                      />
                      ${
                        caption
                          ? html`<figcaption class="section__caption">
                            ${caption}
                          </figcaption>`
                          : nothing
                      }
                    </figure>
                  `
                  : this.generating && section.imageSlug
                    ? html`<figure class="section__figure section__figure--generating">
                        <div class="section__image-shimmer"></div>
                      </figure>`
                    : nothing;
              })()}
              <div class="section__text">${section.body}</div>
              ${quote ? this._renderPullQuote(quote, delay + 0.08) : nothing}
            </div>
          </div>
        `;
      })}
      ${
        hasMore
          ? html`
            <div class="descend">
              <button
                class="descend__btn"
                @click=${this._handleDescend}
              >
                ${msg('Descend Deeper')} <span class="descend__arrow">↓</span>
              </button>
            </div>
          `
          : nothing
      }

      <velg-lightbox
        .src=${this._lightboxSrc}
        .fullSrc=${getFullResUrl(this._lightboxSrc)}
        .alt=${this._lightboxAlt}
        .caption=${this._lightboxCaption}
        @lightbox-close=${this._closeLightbox}
      ></velg-lightbox>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-lore-scroll': VelgLoreScroll;
  }
}
