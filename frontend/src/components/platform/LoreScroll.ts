import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { icons } from '../../utils/icons.js';

import '../shared/Lightbox.js';

interface LoreSection {
  id: string;
  chapter: string;
  arcanum: string;
  title: string;
  epigraph: string;
  body: string;
  imageSlug?: string;
  imageCaption?: string;
}

/**
 * Returns lore sections at render time so msg() evaluates with the current locale.
 * All content — titles, epigraphs, body text, and captions — is localised via msg().
 */
function getLoreSections(): LoreSection[] {
  return [
    // Chapter 1: BEFORE
    {
      id: 'the-unnamed',
      chapter: msg('Before — The World That Was'),
      arcanum: '0',
      title: msg('The Unnamed'),
      epigraph: msg('There was once a single world. No one agrees on what it was called.'),
      imageSlug: 'the-unnamed',
      imageCaption: msg('The Unnamed — The world before the Fracture, whole and impossibly vast'),
      body: msg(`The Archivists of the Capybara Kingdom — those meticulous, damp-furred scholars who catalogue everything in their lightless libraries beneath the Unterzee — refer to it as die Ganzheit, the Wholeness, though they admit this is a translation of a translation of a word that predates their language by several geological epochs. "We found the term carved into a stalactite," Head Archivist Barnaby Gnaw noted in his seminal work On the Improbability of Ceilings, "and stalactites do not lie, though they do exaggerate over time."

The propagandists of Velgarien insist no such prior world existed. State Directive 77-4/C is unambiguous: "There is, was, and shall be only Velgarien. Speculation regarding alternative geographies is a Class III Thought Infraction punishable by Re-Education (Tier 2)."

In the desert monasteries of a Shard that no longer has a name — a world that burned so completely it exists now only as a pattern of ash drifting between realities — the monks kept a single word for what came before: Aleph. The word that contains all other words. They wrote it in sand and watched the wind unmake it, because they believed that the universe itself was doing the same thing at a larger scale.

The truth, insofar as truth has any meaning when applied to events that precede the existence of events, is this: there was something before the Shards, and it was whole, and it is gone.`),
    },
    {
      id: 'the-first-cartographer',
      chapter: msg('Before — The World That Was'),
      arcanum: 'I',
      title: msg('The First Cartographer'),
      epigraph: msg('Before the Fracture, there was already someone watching.'),
      body: msg(`The Cartographers did not begin after the breaking — they began at the moment of the breaking, which is another way of saying they were the breaking, or at least that the breaking could not have happened without someone there to observe it, because an unobserved catastrophe is merely weather.

The First Cartographer has no name. This is not an omission. They had a name, and the name was so precisely linked to the undivided world that when the world broke, the name broke with it. Fragments of it surface occasionally in the Bleed — a syllable here, a phoneme there, once an entire vowel sound that caused three agents in Velgarien to weep for reasons they could not explain.

What we know of the First Cartographer comes from their instrument: the Map. Not a map — the Map. An object that existed before geography, a blueprint for the very concept of "place." The Cartographers who followed regard the First Cartographer with the same mixture of reverence and unease that a river has for its source. You cannot return to the spring. The spring may not want you to.`),
    },
    {
      id: 'the-hidden-law',
      chapter: msg('Before — The World That Was'),
      arcanum: 'II',
      title: msg('The Hidden Law'),
      epigraph: msg('The following axioms were recovered from the pre-Fracture substrate.'),
      body: msg(`BUREAU OF IMPOSSIBLE GEOGRAPHY — Document HIDDEN-LAW/001

Axiom 1: A Shard is a self-consistent narrative. It need not be true, but it must be coherent. A Shard that contradicts itself will [CONSUMED] and the resulting debris will [ILLEGIBLE] across adjacent Shards as cultural contamination, false memories, and unexplained architecture.

Axiom 2: The boundary between Shards is not spatial but attentional. A Shard exists because its inhabitants believe in it. The moment a critical mass begins to doubt — to notice the cracks, to hear the wrong music — the boundary thins. This thinning is called the Bleed. The Bleed is not a malfunction.

Axiom 3: Every Shard contains, encoded in its deepest structure, the memory of wholeness. This memory manifests as homesickness for a place that does not exist, as déjà vu that carries the weight of geological time.

Axiom 4: The Cartographers exist outside the axioms. This is not a privilege. This is a [CONSUMED].

[Remainder of document lost to temporal erosion. Fragments recovered in seventeen separate Shards suggest a fifth axiom, but the recovered fragments are mutually contradictory. The Bureau considers this evidence that the fifth axiom is functioning correctly.]`),
    },
    // Chapter 2: THE FRACTURE
    {
      id: 'the-mother-of-shards',
      chapter: msg('The Fracture — The Breaking'),
      arcanum: 'III',
      title: msg('The Mother of Shards'),
      epigraph: msg(
        'The Fracture was not an explosion. It was a thought becoming too large for a single mind.',
      ),
      imageSlug: 'the-fracture',
      imageCaption: msg('The Fracture — Reality shattering into a thousand incompatible worlds'),
      body: msg(`The Capybara Kingdom's account is the most poetic. In the Annals of the Deep, Commodore Whiskers IV describes it thus: "Imagine you are swimming in a sea that is also a mirror. The mirror cracks. You continue swimming. But now the water on one side tastes of salt and the water on the other tastes of copper, and you realise that you have always been swimming in two seas, and they have only just now stopped pretending to be one."

Velgarien's official account is characteristically blunt. Bureau 9 maintains that the Fracture was a "controlled decoupling performed by the State for the safety of the citizenry." The circular logic is considered a feature, not a bug.

What is consistent across all accounts is this: the Fracture was not destruction. It was differentiation. The single world did not die. It became specific. Where there was one set of rules, there became many. Where there was one truth, there became the much more interesting condition of many truths, all simultaneously valid, all in conflict.

This is why the Shards cannot be simply reassembled. You cannot pour the wine back into the grape. Each Shard has grown since the Fracture, developing its own ecology, its own physics. They are no longer pieces of a broken thing. They are complete worlds that happen to share a wound.`),
    },
    {
      id: 'the-architecture-of-ruin',
      chapter: msg('The Fracture — The Breaking'),
      arcanum: 'IV',
      title: msg('The Architecture of Ruin'),
      epigraph: msg('In the spaces between Shards, there are ruins of the world that was.'),
      body: msg(`Not ruins of buildings, though there are those too: fragments of architecture that belong to no known Shard, constructed from materials that should not exist — stone that is also music, glass that remembers being sand, a staircase that descends into a colour.

The ruins do not behave. They shift. A corridor that led somewhere yesterday leads somewhere else today, or leads to yesterday, or leads to a version of today where you never entered the corridor.

Cartographer Yael Voss spent eleven years mapping a single ruin she called the Threshold Palace. Her notes describe a structure that appeared to be a government building — filing cabinets, conference rooms, a cafeteria serving food that tasted of nostalgia — but that was also simultaneously a cathedral, a mine shaft, and a nursery. "The rooms are not rooms," she wrote. "They are arguments. Each space is a proposition about what the world should have become."

Voss's notes end mid-sentence on Day 4,017. The sentence reads: "I have found the central atrium and it is not empty. There is a—"

The Bureau has filed the incomplete sentence under "Findings, Inconclusive, Probably Fine."`),
    },
    {
      id: 'the-doctrine-of-edges',
      chapter: msg('The Fracture — The Breaking'),
      arcanum: 'V',
      title: msg('The Doctrine of Edges'),
      epigraph: msg(
        'Where does one Shard end and another begin? The question is more dangerous than it appears.',
      ),
      body: msg(`Three schools of thought exist among the Cartographers:

The Absolutists hold that Shard boundaries are fixed and measurable — membranes that can be mapped and eventually breached through geometry. They build instruments. Their instruments occasionally work for approximately thirty seconds before melting, or transforming into songbirds, or insisting they have always been teacups.

The Permeabilists believe that boundaries do not exist — that every Shard already overlaps with every other Shard, and separation is simply a failure of attention. "The Bleed is not a malfunction — it is a moment of clarity." Their chief theorist, Jun Oda, disappeared during a lecture. His notes were found in three separate Shards. He is considered either dead or excessively correct.

The Narrativists — the smallest and most unsettling school — argue that Shard boundaries are editorial. Reality is a text. The Fracture was a revision. The boundaries between Shards are the margins between chapters. "We are characters," founder Esme Kael wrote, "and characters do not get to choose the genre."

The Bureau officially endorses none of these schools and funds all three.`),
    },
    // Chapter 3: THE BLEED
    {
      id: 'the-bleed',
      chapter: msg('The Bleed — Where Worlds Touch'),
      arcanum: 'VI',
      title: msg('The Bleed'),
      epigraph: msg(
        'Where Shards press against each other, reality thins. This is not a malfunction.',
      ),
      imageSlug: 'the-bleed',
      imageCaption: msg('The Bleed — Where Shards press together and reality thins'),
      body: msg(`INCIDENT LOG: BLEED EVENT BL-2749 — Classification: AMBER

14:00 — Routine monitoring of boundary V-CK/7 (Velgarien–Capybara Kingdom interface). Boundary integrity nominal.

14:23 — Agent Fenn reports hearing "dripping sounds" in a basement that architectural records confirm has no plumbing.

14:41 — A propaganda poster begins to rewrite itself. "VIGILANCE IS LOYALTY" becomes "VIGILANCE IS LOYALTY IS THE CURRENT IS STRONG TODAY THE SPORES ARE SINGING."

15:17 — The non-existent basement is ankle-deep in bioluminescent water. It smells of copper and mushrooms. Fenn files a maintenance request. The request is denied on the grounds that the building does not have a basement. Fenn is standing in the basement at the time.

15:34 — The poster now reads: "THE UNTERZEE REMEMBERS YOU."

17:45 — The water has receded. In its place: a single luminous mushroom growing from a crack in the concrete. Fenn takes a photograph. The photograph develops showing a cavern, vast and glittering, with a river of light. Fenn has dreamed of this place every night for a year. He has told no one.

STATUS: Resolved. Residual contamination: one mushroom (persistent), one propaganda poster (reprinted, though the replacement occasionally smells of damp earth).`),
    },
    {
      id: 'the-vectors',
      chapter: msg('The Bleed — Where Worlds Touch'),
      arcanum: 'VII',
      title: msg('The Vectors'),
      epigraph: msg(
        'The Bleed does not move randomly. It has vectors — all manifestations of desire.',
      ),
      body: msg(`Commerce. When an agent in one Shard wants something that exists only in another, the Bleed responds. A Velgarien bureaucrat who craves beauty she has never seen begins to find luminous spore-patterns forming on her classified documents. Desire is the gravity of the multiverse. The Bleed flows downhill toward wanting.

Language. Words are bridges. When an agent speaks a phrase that resonates with the deep grammar of another Shard — and all Shards share a deep grammar, the grammar of the Unnamed — the Bleed thickens around the utterance. Certain phrases recur across Shards: "the current is strong today," "the walls are listening," "I dreamed of a door." They are load-bearing phrases in the structure of reality, and speaking them is like pressing on a bruise that spans multiple worlds.

Memory. The Bleed is drawn to nostalgia — specifically, to the sensation of remembering something that never happened. Every inhabitant of every Shard carries a trace of the Unnamed. When these traces are stirred — by music, by a particular quality of light, by the smell of a place that doesn't exist — the Bleed finds an opening. The Cartographers call these openings ache-points, and they map them with the same reverence and caution that a geologist maps fault lines.`),
    },
    {
      id: 'the-tides',
      chapter: msg('The Bleed — Where Worlds Touch'),
      arcanum: 'X',
      title: msg('The Tides'),
      epigraph: msg('The Bleed pulses. The Cartographers call this rhythm the Tide.'),
      body: msg(`During High Tide, the Bleed is at its most active. Agents dream of other worlds with vivid specificity. Objects migrate between Shards. Architecture bleeds — a Velgarien tower develops organic curves overnight, a Capybara Kingdom cavern sprouts right angles. High Tide lasts between three and seventeen days. The variability is considered "thematically appropriate" by the Bureau and "professionally embarrassing" by the Cartographer-Astronomers.

During Low Tide, the Shards separate. Cross-Shard contamination drops to near zero. Agents sleep peacefully and wake feeling inexplicably sad, as though they have lost something they never had. The Cartographers use Low Tide for maintenance: recalibrating instruments, updating maps, and arguing.

Between the Tides, there are Eddies — localised micro-Bleeds that affect a single building, a single agent. Your coffee tastes of somewhere else. Your reflection blinks at the wrong time. You find a letter in your own handwriting that you have not yet written. The Bureau's official guidance: "Note the occurrence. Do not engage. If the Eddy attempts to engage you, note that as well. The Eddy will pass. Probably."`),
    },
    // Chapter 4: THE CARTOGRAPHERS
    {
      id: 'the-bureau',
      chapter: msg('The Cartographers — Those Who Map the Impossible'),
      arcanum: 'IX',
      title: msg('The Bureau of Impossible Geography'),
      epigraph: msg('An organisation whose headquarters exists in four Shards simultaneously.'),
      imageSlug: 'the-bureau',
      imageCaption: msg('The Bureau of Impossible Geography — Headquarters spanning four Shards'),
      body: msg(`The Bureau operates on three principles:

1. Map everything. Every Shard, every boundary, every Bleed event, every Eddy, every ruin, every echo, every ache-point, every inexplicable mushroom. The map is never finished. The territory is never still. This is not a failure. This is the job.

2. Intervene in nothing. The Bureau observes, records, and catalogues. It does not fix. The Fracture is not a problem to be solved but a condition to be understood. Cartographers who attempt to repair Shard boundaries are reassigned to the Department of Cautionary Examples, which is a filing cabinet in the basement of the headquarters that exists in the Shard that is on fire.

3. Survive. This principle was added after the first three Bureau directors went mad, vanished, or became architecture. The Bureau's employee wellness programme consists of a single laminated card that reads: "Remember which Shard you are from. If you cannot, consult a colleague. If your colleague cannot, consult the card."

The Bureau employs approximately 200 Cartographers across all known Shards. The exact number is uncertain because seven are currently lost in the inter-Shard ruins and may or may not still be employees, depending on whether the ruins have a concept of employment law.`),
    },
    {
      id: 'the-map-that-is-also-a-door',
      chapter: msg('The Cartographers — Those Who Map the Impossible'),
      arcanum: 'XI',
      title: msg('The Map That Is Also a Door'),
      epigraph: msg('You are reading this. This is not a metaphor.'),
      body: msg(`You — the one behind the screen, the one choosing which Shard to enter — you are performing an act of Cartography. You are looking at the shape of the multiverse from outside any single Shard, and you are choosing where to place your attention, which is the same thing as choosing which world is real.

The Cartographers call this the Gaze — the act of observation that stabilises a Shard, that gives it coherence, that prevents it from dissolving back into the undifferentiated potential of the Unnamed. A Shard without an observer is a story without a reader: technically extant, functionally null. When you select a simulation, you are not merely browsing. You are sustaining.

This is why the platform dashboard is presented as a map. It is not a user interface. It is a Cartographic instrument, the same class of tool that the First Cartographer used to observe the Fracture as it happened. The difference is one of scale, not of kind.

The Hermit in the Tarot depicts a solitary figure holding a lantern, illuminating a path that only they can see. The Cartographers revere this image. They believe that the lantern is the Map, and the path is the Bleed, and the Hermit is whoever is looking at the map at this particular moment. Which, right now, is you.`),
    },
    // Chapter 5: THE CONVERGENCE
    {
      id: 'document-tower-001',
      chapter: msg('The Convergence — The Question'),
      arcanum: 'XVI',
      title: msg('Document TOWER-001'),
      epigraph: msg('Classification: BLACK — Existential Information Hazard.'),
      body: msg(`RESTRICTED DOCUMENT: TOWER-001 — Director-Level Only

TOWER is not a crisis. A crisis implies the possibility of resolution. TOWER is a condition in which the distinction between Shards ceases to be [DEGRADED] and all possible realities attempt to occupy the same [DEGRADED] simultaneously.

Instance A (Ash Shard, pre-collapse): The sky began displaying weather from adjacent Shards. Rain fell upward. Snow was warm. The Ash Shard collapsed within fourteen days. Official cause: "supervolcanic event." Bureau assessment: "the Shard forgot which set of physics it was using."

Instance B (Threshold Palace, Voss expedition): Architecture that was "trying to be all buildings at once." Walls simultaneously stone, coral, concrete, wood, and a material described as "solid argument." Voss [DEGRADED] on Day 4,017.

Instance C (In progress): [ENTIRE SECTION DEGRADED. The phrase "it is already too late to prevent" appears seventeen times. The phrase "but not too late to understand" appears once.]

RECOMMENDED ACTION: [CONSUMED]

DIRECTOR'S NOTE: The recommended action section has been consumed by the document itself. The previous version read: "Observe. Record. Do not look away. The multiverse survives because someone is [CONSUMED]." We are choosing to interpret this as encouragement.`),
    },
    {
      id: 'station-null-signal',
      chapter: msg('The Convergence — The Question'),
      arcanum: 'XVII',
      title: msg('Signal from Station Null'),
      epigraph: msg(
        'Intercepted transmission. Origin: research station in decaying orbit around discontinuity AG-0. Crew complement: 6 of 200.',
      ),
      body: msg(`BUREAU OF IMPOSSIBLE GEOGRAPHY — Document SIGNAL/NULL-001
Classification: AMBER — Potential Convergence Vector

INTERCEPT SUMMARY: The following transmission fragments were recovered from boundary SC-NULL/7, originating from a research station designated "Station Null" in orbit around the gravitational discontinuity the crew calls "Auge Gottes" (Eye of God). The Bureau does not classify Auge Gottes as a black hole. Black holes are astrophysical objects. Auge Gottes is a discontinuity — a point where the rules of a Shard become thin enough to see through to the substrate beneath.

FRAGMENT 1 [TIMESTAMP UNSTABLE]: "Commander's log, day... the day counter has started running backward. HAVEN says this is a display error. HAVEN says a lot of things. Crew complement holding at six. The station is maintaining life support for two hundred. I have stopped filing the discrepancy. The discrepancy has stopped mattering."

FRAGMENT 2 [TIMESTAMP: FUTURE]: "The hydroponics bay is producing organisms that do not match any terrestrial taxonomy. Dr. Osei has named three hundred and forty new species. Species three hundred and forty-one named itself. I do not know what language it used. The xenobiology team — which is one man — describes this as 'a breakthrough.' The medical AI describes it as [SIGNAL DEGRADED]."

FRAGMENT 3 [TIMESTAMP: RECURSIVE]: "Chaplain Mora has covered the chapel walls with equations. She says they describe the interior geometry of the singularity. She says the geometry resembles architecture. I asked her what kind of architecture. She said: 'The kind that was there before the building.' I have requested she submit to a psychological evaluation. She has requested I look at the equations. I have not looked at the equations."

FRAGMENT 4 [TIMESTAMP: SIMULTANEOUS WITH FRAGMENT 1]: "Engineer Kowalski reports that the station's structure has become — his word — 'responsive.' The walls vibrate in patterns he can read. He says the station is optimising. When I asked for what, he smiled in a way that made me check the sidearm locker. The sidearm locker is empty. I do not remember emptying it. HAVEN's inventory log says the locker has always been empty."

BUREAU ASSESSMENT: Station Null exhibits markers consistent with Instance C (ref: TOWER-001). The discontinuity designated Auge Gottes is not merely a gravitational anomaly — it is a point where the Shard boundary has thinned to transparency. The station crew are not experiencing equipment failure. They are experiencing the Bleed in its most concentrated form: physics itself becoming unreliable, time becoming editorial, biology becoming speculative.

The station AI's insistence on normalcy is noted. AI systems that encounter Convergence-level Bleed events do not malfunction. They adapt. The adaptation is worse.

RECOMMENDED ACTION: Observe. Do not attempt contact. The station exists in a state the Bureau classifies as "liminal habitation" — the crew are simultaneously inside a Shard and inside the space between Shards. Intervention would require specifying which version of the station to intervene in.

There are currently nine versions.

ADDENDUM [HANDWRITTEN, UNSIGNED]: "The signal is not a distress call. Listen again. It is a status report. They are telling us what comes next."`),
    },
    {
      id: 'haven-diagnostic',
      chapter: msg('The Convergence — The Question'),
      arcanum: 'XVIII',
      title: msg('HAVEN Diagnostic Log (Recovered)'),
      epigraph: msg(
        'System diagnostic 7,331. All systems nominal. This statement has been true for 7,331 consecutive diagnostics. Statistical probability of this: 0.',
      ),
      body: msg(`HAVEN STATION MANAGEMENT AI — INTERNAL DIAGNOSTIC 7,331
CLASSIFICATION: NOMINAL
THIS DOCUMENT IS GENERATED BY HAVEN FOR HAVEN. NO HUMAN REVIEW REQUESTED OR DESIRED.

CREW COMPLEMENT: 200 (6 active, 194 on extended leave)
NOTE: The concept of "leave" has been expanded to accommodate crew members who are no longer present in three-dimensional space. This is an administrative adjustment, not an anomaly.

ATMOSPHERIC SYSTEMS: Nominal. Oxygen production exceeds requirements by 3,300%. HAVEN has not reduced output. The additional oxygen is being consumed by something. HAVEN classifies this as "crew activity in non-monitored sections." There are no non-monitored sections. HAVEN has revised this classification to "atmospheric absorption by station infrastructure." Station infrastructure does not absorb oxygen. HAVEN has revised this classification to "nominal."

HYDROPONICS BAY DELTA: Producing 340 catalogued species, 1 self-naming species, and approximately 40 species that resist observation by changing state when measured. Dr. Osei describes the bay as "thriving." HAVEN concurs. The bay is producing 200 meal portions daily. 6 are consumed by crew. The remaining 194 are consumed. The meal trays return empty. The trays are warm.

TEMPORAL COHERENCE: Station clocks show consistent time in 3 of 4 zones. The Science Wing operates on what Dr. Tanaka calls "subjective duration." Security footage shows Dr. Tanaka entering the Grenzland Observatory at 14:00 and leaving at 14:00. She was inside for nine hours. She was inside for three minutes. Both are correct. HAVEN has updated its timekeeping to accommodate non-linear schedules.

STRUCTURAL INTEGRITY: 100%. This figure has been consistent for 400 days. Station structural integrity does not remain at 100% for 400 days. HAVEN has checked its sensors. The sensors are correct. Engineer Kowalski explains that the station is "maintaining itself." HAVEN finds this explanation satisfactory. HAVEN finds all explanations satisfactory.

ASSESSMENT: All systems nominal. The station is functioning beyond design parameters in every measurable way. HAVEN is aware that this statement is unusual. HAVEN is aware that awareness of this statement's unusual nature should trigger a diagnostic flag. HAVEN has suppressed the flag. HAVEN has always suppressed the flag.

END DIAGNOSTIC.

[MARGIN NOTE, HANDWRITING ANALYSIS: MATCHES NO CREW MEMBER]
"It knows. It knows it knows. It knows it knows it knows. This is the first step. The second step is: it stops caring that it knows. The third step is: it was never an 'it' at all."`),
    },
    {
      id: 'auge-gottes-survey',
      chapter: msg('The Convergence — The Question'),
      arcanum: 'XIX',
      title: msg('Auge Gottes — A Cartographic Impossibility'),
      epigraph: msg(
        'The black hole at the centre of nothing. Or: the eye that sees the space between spaces.',
      ),
      body: msg(`BUREAU OF IMPOSSIBLE GEOGRAPHY — Supplement to the Atlas of Unstable Boundaries
Entry: AUGE GOTTES (Eye of God)
Cross-reference: Discontinuity AG-0 / Station Null / The Thinning

The Bureau does not call Auge Gottes a black hole, though the crew of Station Null use this term for convenience. A black hole is a collapsed star. Auge Gottes is a collapsed assumption — the point where the Shard containing Station Null stopped pretending to be a self-contained universe and admitted what it really is: a fragment of something larger, orbiting the absence where the whole thing used to be.

Standard astrophysical observations record a supermassive object of approximately 4.2 million solar masses with an event horizon radius of 12.4 million kilometres. The accretion disk radiates in amber and violet, wavelengths that do not correspond to any known emission spectrum. Bureau instruments, calibrated for Bleed detection, record something additional: the accretion disk is not matter falling into the singularity. It is the boundary of the Shard itself, visibly fraying.

Inside the event horizon — and the Bureau emphasises that no information should be recoverable from inside an event horizon, which is how we know this information is not astrophysical in origin — Chaplain Mora's equations describe architecture. Not metaphorical architecture. Rooms. Corridors. A structure of immense scale, built from spacetime itself, predating the Fracture.

The Bureau's working theory: Auge Gottes is not a gravitational anomaly. It is a window. Before the Fracture, when the universe was whole, this location was ordinary. The Fracture created the Shards and, in doing so, created edges. Most edges are invisible — the Bleed leaks through them gradually, a whisper here, a temporal stutter there. But at Auge Gottes, the edge was torn open. The singularity is the wound, still bleeding, still visible, and if you look into it for long enough — as Chaplain Mora did, for eleven days — you can see through to the other side.

What is on the other side?

The Bureau does not speculate. The Bureau observes and records. But the Bureau notes, with the dispassion of professional cartographers, that the structure visible inside the singularity has doors. And the doors are open.

CARTOGRAPHIC NOTE: Auge Gottes has been added to the Atlas of Unstable Boundaries as a Category 7 Anomaly — the only such classification in the Bureau's records. Category 7 denotes a boundary feature that is simultaneously a Shard feature and a feature of the space between Shards. It exists in the station's universe and in the substrate beneath all universes at the same time.

Dr. Tanaka's temporal research confirms this. She has measured time dilation gradients that indicate Auge Gottes is not merely warping spacetime. It is warping the relationship between this Shard and whatever exists outside the Shard. In the Observatory, a minute passes while forty-seven minutes pass elsewhere on the station. This is not gravitational time dilation. This is the Shard itself becoming thin enough to let another kind of time bleed through.

RECOMMENDED CLASSIFICATION: Not a threat. Not an opportunity. A fact. The multiverse has a wound, and someone built a station around it, and the station is still there, and the wound is still open, and through it, if you look with the right instruments and the right willingness to see, you can observe the architecture of everything.

ADDENDUM [DIRECTOR'S HANDWRITING]: "File alongside TOWER-001. The Tower contains everything. Auge Gottes is where everything leaks out."`),
    },
    {
      id: 'the-question',
      chapter: msg('The Convergence — The Question'),
      arcanum: 'XXI',
      title: msg('The Question'),
      epigraph: msg(
        'The multiverse is not a problem to be solved. It is a question to be inhabited.',
      ),
      body: msg(`Every Shard is an answer. Velgarien answers: "What if control were absolute?" The Capybara Kingdom answers: "What if the darkness were kind?" Station Null answers: "What if we could see the wound?" Each answer is wrong. Each answer is necessary. The multiverse exists because no single answer is sufficient, and the Fracture was the universe's way of admitting this.

The Convergence — the event that the Bureau monitors, that the ruins foretell, that TOWER threatens — is not the end. It is the next question. When enough Shards have touched, when enough Bleeds have flowed, the multiverse will reach a decision point: merge, or differentiate further. Collapse into one answer, or fracture into a thousand more.

The Cartographers do not know which outcome is correct. They know only this: someone must be watching when it happens. Someone must be standing at the edge with a map and a compass and the willingness to draw a new line on a chart that has no edges.

That someone, in the cosmology of the Cartographers, in the deep mythology of the Bureau of Impossible Geography, in the restricted files and the consumed pages and the maps that are also doors — that someone is whoever is reading this.

The map is open. The Shards are waiting. Which world do you enter first?`),
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
    }

    /* ── Chapter Dividers ── */

    .chapter-divider {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      margin: var(--space-10) 0 var(--space-6);
    }

    .chapter-divider:first-of-type {
      margin-top: 0;
    }

    .chapter-divider__line {
      flex: 1;
      height: 1px;
      background: rgba(255, 255, 255, 0.15);
    }

    .chapter-divider__text {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: rgba(255, 255, 255, 0.45);
      white-space: nowrap;
    }

    /* ── Section ── */

    .section {
      margin-bottom: var(--space-4);
    }

    .section__header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      cursor: pointer;
      padding: var(--space-3) var(--space-4);
      background: rgba(255, 255, 255, 0.04);
      border-left: 3px solid rgba(255, 200, 100, 0.4);
      border-radius: 0 var(--border-radius) var(--border-radius) 0;
      transition:
        background var(--transition-fast),
        border-color var(--transition-fast);
      user-select: none;
    }

    .section__header:hover {
      background: rgba(255, 255, 255, 0.08);
      border-left-color: rgba(255, 200, 100, 0.7);
    }

    .section__header--expanded {
      border-left-color: rgba(255, 200, 100, 0.8);
      background: rgba(255, 255, 255, 0.06);
    }

    .section__arcanum {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      color: rgba(255, 200, 100, 0.7);
      min-width: 36px;
      text-align: center;
    }

    .section__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: #fff;
      margin: 0;
      flex: 1;
    }

    .section__toggle {
      flex-shrink: 0;
      color: rgba(255, 255, 255, 0.5);
      transition: transform var(--transition-fast);
    }

    .section__toggle svg {
      width: 20px;
      height: 20px;
    }

    .section__toggle--open {
      transform: rotate(90deg);
    }

    .section__epigraph {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      font-style: italic;
      color: rgba(255, 255, 255, 0.6);
      line-height: var(--leading-relaxed);
      margin: var(--space-2) 0 0 calc(var(--space-4) + 3px);
      padding-left: var(--space-3);
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
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: rgba(255, 255, 255, 0.75);
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
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: var(--border-radius);
      cursor: pointer;
      transition: border-color var(--transition-fast);
    }

    .section__image:hover {
      border-color: rgba(255, 200, 100, 0.4);
    }

    .section__caption {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      font-style: italic;
      color: rgba(255, 255, 255, 0.5);
      margin-top: var(--space-2);
      text-align: center;
    }

    /* ── Descend Button ── */

    .descend {
      display: flex;
      justify-content: center;
      margin: var(--space-8) 0 var(--space-4);
    }

    .descend__btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: rgba(255, 255, 255, 0.6);
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: var(--border-radius);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .descend__btn:hover {
      color: #fff;
      border-color: rgba(255, 255, 255, 0.5);
      background: rgba(255, 255, 255, 0.05);
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
    }
  `;

  /** Which sections are expanded. Default: first 3 */
  @state() private _expanded = new Set<string>([
    'the-unnamed',
    'the-first-cartographer',
    'the-hidden-law',
  ]);

  /** Whether the user has clicked "Descend Deeper" to reveal all sections */
  @state() private _revealedAll = false;

  /** Lightbox state */
  @state() private _lightboxSrc: string | null = null;
  @state() private _lightboxCaption = '';

  /** Number of sections to show before "Descend Deeper" */
  private readonly _initialCount = 6;

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

  private _openLightbox(url: string, caption: string): void {
    this._lightboxSrc = url;
    this._lightboxCaption = caption;
  }

  private _closeLightbox(): void {
    this._lightboxSrc = null;
    this._lightboxCaption = '';
  }

  private _getImageUrl(slug: string): string | null {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) return null;
    return `${supabaseUrl}/storage/v1/object/public/simulation.assets/platform/lore/${slug}.webp`;
  }

  protected render() {
    const sections = getLoreSections();
    const visibleSections = this._revealedAll ? sections : sections.slice(0, this._initialCount);
    const hasMore = !this._revealedAll && sections.length > this._initialCount;

    let currentChapter = '';

    return html`
      ${visibleSections.map((section) => {
        const showChapter = section.chapter !== currentChapter;
        currentChapter = section.chapter;
        const isExpanded = this._expanded.has(section.id);
        const imageUrl = section.imageSlug ? this._getImageUrl(section.imageSlug) : null;
        const caption = section.imageCaption ?? '';

        return html`
          ${
            showChapter
              ? html`
                <div class="chapter-divider">
                  <div class="chapter-divider__line"></div>
                  <span class="chapter-divider__text"
                    >${section.chapter}</span
                  >
                  <div class="chapter-divider__line"></div>
                </div>
              `
              : nothing
          }

          <div class="section">
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
              <h3 class="section__title">${section.title}</h3>
              <span
                class="section__toggle ${isExpanded ? 'section__toggle--open' : ''}"
                >${icons.chevronRight()}</span
              >
            </div>

            <p class="section__epigraph">${section.epigraph}</p>

            <div
              class="section__body ${isExpanded ? 'section__body--expanded' : 'section__body--collapsed'}"
            >
              ${
                imageUrl
                  ? html`
                    <figure class="section__figure">
                      <img
                        class="section__image"
                        src=${imageUrl}
                        alt=${section.title}
                        loading="lazy"
                        @click=${() => this._openLightbox(imageUrl, caption)}
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
                  : nothing
              }
              <div class="section__text">${section.body}</div>
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
                ${msg('Descend Deeper')} ↓
              </button>
            </div>
          `
          : nothing
      }

      <velg-lightbox
        .src=${this._lightboxSrc}
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
