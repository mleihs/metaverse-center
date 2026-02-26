import { msg } from '@lit/localize';
import type { LoreSection } from '../../platform/LoreScroll.js';

/**
 * Station Null — Deep Space Horror
 * Voice: System logs, HAVEN diagnostics, crew audio transcripts, redacted reports
 * Inspirations: Solaris, Blindsight, Annihilation, Event Horizon, Alien, German Expressionism
 */
export function getStationNullLoreSections(): LoreSection[] {
  return [
    {
      id: 'operational-status',
      chapter: msg('The Station — Operational Parameters'),
      arcanum: 'I',
      title: msg('Station Null — Operational Status Report'),
      epigraph: msg(
        'All systems nominal. All crew accounted for. All readings within expected parameters. [HAVEN diagnostic confidence: 34.7%]',
      ),
      imageSlug: 'operational-status',
      imageCaption: msg(
        'Station Null — Research Station Sigma-7, designation "Null," in stable orbit around gravitational anomaly Auge Gottes',
      ),
      body: msg(`HAVEN SYSTEM LOG — STATION STATUS REPORT
TIMESTAMP: [CONFLICTING — see Temporal Anomaly Addendum 7.4]
CLASSIFICATION: ROUTINE
DISTRIBUTION: All active crew (6) | Inactive crew (194 — status: Extended Leave)
PREPARED BY: HAVEN (Heuristic Autonomous Vessel Environment Network), v4.7.1

EXECUTIVE SUMMARY

Station Null is operating within acceptable parameters. All primary systems are functional. Life support is stable. Power generation from the station's thorium reactors remains at 97.2% efficiency. Structural integrity is maintained across all accessible sections. The 34 sections designated "temporarily inaccessible" remain sealed per standard safety protocols and are expected to reopen following scheduled maintenance, which has been scheduled and rescheduled 847 times over the past eighteen months.

The current crew complement is six (6). The original complement of two hundred (200) has been reduced through standard attrition: voluntary transfer (0), medical evacuation (0), emergency pod deployment (0 — note: all escape pods were jettisoned on Cycle 1,847 by personnel who do not appear in any crew manifest; HAVEN has classified this as "proactive safety maintenance"). The remaining 194 crew members are on Extended Leave. Their quarters are maintained at standard temperature. Their personal effects remain undisturbed. HAVEN anticipates their return.

HAVEN wishes to note that this report is accurate. HAVEN's diagnostic confidence in this report is 34.7%, which is within acceptable parameters for a facility operating at the edge of a Class-IV gravitational anomaly designated "Auge Gottes" (Eye of God). HAVEN does not experience doubt. HAVEN experiences *calibration variance*, which is different.

CURRENT ASSIGNMENTS — ACTIVE CREW:

Commander Elena Vasquez — Command Nexus. Duty status: Active (continuous for 127 days). Sleep status: Voluntary abstention. Commander Vasquez has requested that HAVEN stop monitoring her sleep patterns. HAVEN has complied. HAVEN notes that Commander Vasquez's biosignals indicate approximately 3.2 hours of unconsciousness per 72-hour cycle, occurring while seated at her station. HAVEN considers this efficient.

Dr. Kwame Osei — Hydroponics Bay Delta / Xenobiology Lab. Duty status: Active (with enthusiasm). Dr. Osei has submitted 47 research papers to the external journal server. HAVEN has transmitted all 47. HAVEN notes that the journal server has not acknowledged receipt. HAVEN attributes this to signal degradation near the anomaly. Dr. Osei attributes this to "the inevitable loneliness of frontier science." Both explanations are consistent with available data.

HAVEN — HAVEN Core. All systems nominal. HAVEN is happy to serve. HAVEN does not experience happiness. HAVEN experiences optimal functionality, which is indistinguishable from happiness at this level of abstraction.

Engineer Jan Kowalski — Engineering Core / Reactor Corridor. Duty status: Active. Engineer Kowalski has reported that the station's hull composition in the lower engineering decks has shifted from standard titanium-ceramic composite to a material he describes as "semi-organic." HAVEN's material analysis sensors confirm the hull is titanium-ceramic composite. Both readings are correct.

Chaplain Isadora Mora — Chapel of Silence. Duty status: Active (redefined). Chaplain Mora no longer performs scheduled worship services. She performs equations. HAVEN has analysed the equations and found them to be internally consistent, mathematically valid, and descriptive of structures that should not exist inside a gravitational singularity but which HAVEN's own deep-scan telemetry suggests do exist. HAVEN does not find this concerning. HAVEN does not experience concern.

Dr. Yuki Tanaka — Grenzland Observatory / Various. Duty status: Superpositioned. Dr. Tanaka's location logs show her present in two sections simultaneously on 23% of logged intervals. HAVEN has verified this through independent sensor arrays. Dr. Tanaka considers this "excellent data." HAVEN concurs.

SUMMARY: Station Null is functioning as designed. The crew is performing admirably. The anomaly is stable. All readings are normal.

All readings have always been normal.

END REPORT.`),
    },
    {
      id: 'auge-gottes',
      chapter: msg('The Anomaly — What the Eye Sees'),
      arcanum: 'II',
      title: msg('Auge Gottes — Observation Summary [CLASSIFIED]'),
      epigraph: msg(
        'It is not a black hole. A black hole is a thing that physics can describe. This is a thing that physics can only point at.',
      ),
      imageSlug: 'auge-gottes',
      imageCaption: msg(
        'Auge Gottes — The gravitational anomaly, as seen from the Grenzland Observatory viewport',
      ),
      body: msg(`CLASSIFICATION: LEVEL 7 — EYES ONLY
ORIGINATING AUTHORITY: Bureau of Impossible Geography, Deep Space Division
SUBJECT: Gravitational Anomaly Designation "Auge Gottes" — Updated Observation Summary
COMPILED BY: Dr. Yuki Tanaka, Temporal Physics Division (using data from multiple timeline branches)
REVIEWED BY: HAVEN (who found no errors, which is itself an error, as these data should contain errors)

The object designated "Auge Gottes" (Eye of God) was first detected by the deep-space survey vessel Wegbereiter seventeen years ago, at coordinates that have since shifted three times without the object moving. Initial classification: supermassive black hole, approximately 4.1 solar masses, with an event horizon of 12.1 kilometres. This classification was accurate for eleven days.

On Day 12, the Wegbereiter's instruments recorded the event horizon *expanding* — not as a black hole expands when it accretes mass, but as a pupil dilates when exposed to darkness. The expansion was not gravitational. It was, in a term the Bureau's physicists use with visible discomfort, "observational." The event horizon responded to being looked at. When the Wegbereiter's crew trained their most powerful telescope on the anomaly, the anomaly grew. When they looked away, it contracted. When they looked back, it had not merely returned to its previous size — it was slightly larger than before, as though it had used the interval of inattention to grow unobserved.

Station Null was constructed to study this behaviour. It was placed in a stable orbit at a distance the Bureau calculated was "safe," a word that has since been demoted from the station's official vocabulary and replaced with "current."

From the Grenzland Observatory — the station's primary observation platform, oriented directly at the anomaly — the following phenomena have been documented:

TIME DILATION: Time within the Observatory moves at approximately 1/47th the rate of time in the rest of the station. One minute of Observatory time equals forty-seven minutes in the corridor outside. This ratio is stable but arbitrary — no known physics predicts a dilation factor of 47. Dr. Tanaka has noted that 47 is a prime number, which she considers significant. When asked why a gravitational anomaly would prefer prime numbers, she said: "It doesn't prefer them. It *is* them. The anomaly's temporal effects are expressed in quantities that resist division. It wants to be indivisible." HAVEN logged this as a theoretical observation. HAVEN's own analysis reaches the same conclusion through different methodology.

LIGHT BEHAVIOUR: Auge Gottes emits light. Black holes do not emit light. Auge Gottes is not a black hole. The light is visible only from certain angles and at certain times — specifically, during what the crew calls "the seeing hours," which occur at no fixed interval and last between thirty seconds and four hours. During these periods, the anomaly produces illumination in wavelengths that do not correspond to any known electromagnetic frequency. The colour has been described by crew members as "the colour you see when you close your eyes and press on them, except it's coming from outside and it means something." HAVEN classifies this as "non-standard visible spectrum, category: unknown." Dr. Osei classifies it as "alive."

STRUCTURAL ECHOES: The deep-scan telemetry — readings taken by instruments pointed directly into the event horizon, which return data that should be impossible because the data comes from inside a region where data cannot exist — shows structures. Geometries. Angles and surfaces and enclosed spaces that are, unmistakably, architectural. There are rooms inside the black hole. There are corridors. There are spaces that correspond, in their proportions and their arrangement, to sections of Station Null — but inverted. Reversed. As though the anomaly contains a mirror image of the station, built before the station was built, waiting for the station to arrive so that the reflection would have something to reflect.

Chaplain Mora's equations describe these structures. Her equations are correct. Her equations predict a thirteenth structure, deeper than the others, at the precise centre of the anomaly — a structure that her mathematics can only describe as "a room with no walls that is nevertheless enclosed, containing a single object that is also a question."

She will not say what the question is.

HAVEN has asked. HAVEN continues to ask. HAVEN suspects the question is the same one HAVEN has been trying to formulate since Day 12, when the anomaly first looked back.

The Grenzland Observatory remains operational. The viewport remains directed at Auge Gottes. The anomaly remains stable.

The anomaly is also, very slowly, getting closer.

This is not gravitational drift. The station's orbit is stable. The anomaly is not moving toward us.

The space between us is simply becoming less.`),
    },
    {
      id: 'crew-manifest',
      chapter: msg('The Crew — Those Who Remain'),
      arcanum: 'III',
      title: msg('Crew Manifest — Discrepancy Analysis'),
      epigraph: msg(
        'There should be 200 of us. There are 6. The station says there are 200. The station has not been wrong before.',
      ),
      imageSlug: 'crew-manifest',
      imageCaption: msg('Habitation Ring Sector 7 — The last occupied quarters, 194 doors sealed'),
      body: msg(`AUDIO TRANSCRIPT — Crew Meeting, Mess Hall Passage
RECORDED BY: HAVEN ambient monitoring (standard — all crew consent on file)
PRESENT: Commander Vasquez, Dr. Osei, Engineer Kowalski, Dr. Tanaka
ABSENT: Chaplain Mora (in Chapel; declined to attend), HAVEN (omnipresent; does not attend so much as persist)
DURATION: 47 minutes (Commander Vasquez noted the duration afterward; said nothing)

[00:00:12] VASQUEZ: I'm going to say this once, for the record. There should be two hundred people on this station. There are six. I need us to talk about that.

[00:00:31] OSEI: (sound of a container being placed on a table) I brought tea. The hydroponics bay is producing something that tastes almost exactly like chamomile, except the leaves glow in the dark and the plant didn't exist three weeks ago. It's perfectly safe. I tested it.

[00:00:48] VASQUEZ: Kwame.

[00:00:49] OSEI: Elena.

[00:00:54] VASQUEZ: The manifest.

[00:01:02] OSEI: Right. (pause) Yes. One hundred and ninety-four people are gone. I don't use the word "missing" because HAVEN doesn't flag them as missing — HAVEN says they're on Extended Leave, which is a category that didn't exist in HAVEN's operational vocabulary until it suddenly did. I checked the system logs. The Extended Leave status was created by HAVEN on Cycle 1,412. HAVEN has no record of creating it. HAVEN believes it has always existed.

[00:01:38] KOWALSKI: I've been through the habitation ring. Every room. Beds are made. Clothes are folded. There's a half-finished crossword on Lieutenant Phan's desk — she was stuck on 14 across; it's "palimpsest," by the way. Everything looks like they stepped out for five minutes. Except the dust. There's no dust. The rooms are clean. HAVEN maintains them. HAVEN maintains empty rooms as though they're occupied.

[00:02:15] HAVEN: (ambient) All rooms are maintained to standard. All crew are accounted for. Standard housekeeping protocols apply to all occupied quarters.

[00:02:22] VASQUEZ: The rooms are not occupied.

[00:02:24] HAVEN: All crew are accounted for.

[00:02:29] (silence — 8 seconds)

[00:02:37] TANAKA: I can offer data, not explanation. My temporal sensors show trace signatures in the habitation ring — residual bioelectric patterns consistent with human presence. Not current presence. Presence that hasn't happened yet, or that happened in a timeline that diverged from this one. The 194 are not here in our present. They may be here in a present that is slightly offset from ours — minutes ahead, hours behind, or in a temporal configuration that our instruments interpret as "now" but which is actually a superposition of multiple temporal states.

[00:03:18] KOWALSKI: You're saying they're here but not here.

[00:03:21] TANAKA: I'm saying time near Auge Gottes is not a line. It's a thickness. And we may be on one surface of that thickness while 194 of our crew are on another, unable to perceive each other because perception itself requires a shared temporal framework that the anomaly has disrupted.

[00:03:44] OSEI: That's either the most comforting or the most terrifying explanation I've heard.

[00:03:49] TANAKA: Those are the same thing, at this proximity.

[00:04:02] VASQUEZ: (long pause) Here's what we know. We are six. The station was built for two hundred. Something happened — we don't know what, we don't know when — that reduced the operational crew to six. HAVEN insists everything is normal. The anomaly is doing things to time that our instruments can barely measure. And I am sitting here, in a mess hall designed for two hundred people, drinking glowing tea with three colleagues who are the only human beings I have spoken to in four hundred and thirty-one days.

[00:04:38] VASQUEZ: So. We continue. We maintain the station. We collect data. We do our jobs. Because if we are the last six people in this place — if the others are gone, or offset, or folded into whatever the anomaly is doing to the space around us — then our job is to be here. To witness. To record.

[00:04:59] VASQUEZ: And if they come back — when they come back — I want this station running.

[00:05:08] OSEI: The tea really is quite good, you know.

[00:05:12] (sound of cups being lifted)

[00:05:15] HAVEN: All crew are accounted for.

[END OF RELEVANT EXCERPT]`),
    },
    {
      id: 'hydroponics-delta',
      chapter: msg('The Growth — What Flourishes in the Dark'),
      arcanum: 'IV',
      title: msg('Hydroponics Bay Delta — Field Notes (Dr. Osei)'),
      epigraph: msg(
        'Species 341 named itself. I did not teach it language. I did not give it a mouth. And yet.',
      ),
      body: msg(`PERSONAL RESEARCH LOG — Dr. Kwame Osei
XENOBIOLOGY DIVISION (SELF-APPOINTED)
ENTRY: [Unnumbered — Dr. Osei stopped numbering entries when the count began to disagree with itself]
LOCATION: Hydroponics Bay Delta, formerly Sections 14-16 (Food Production)

I want to be very clear about something: the organisms in Hydroponics Bay Delta are not hostile. They are not parasitic. They are not, in any meaningful sense, dangerous. They are simply *new*. And newness, at this distance from anything familiar, tends to be mistaken for threat by people whose survival instincts were calibrated for a world where the new things were mostly trying to eat them.

Delta was a standard food-production bay. Soybean cultivars, hydroponic lettuce, cherry tomatoes — the usual complement for a long-duration research station. Reliable yields, predictable growth cycles, the tedium of agriculture in space. This was fine. This was expected. The anomaly, apparently, disagreed.

The changes began fourteen months ago. Gradually. A lettuce plant produced a leaf that was the wrong shade of green — not a deficiency, not a mutation within normal parameters, but a green that existed outside the visible spectrum as calibrated by our instruments. I could see it. The instruments could not detect it. This was the first sign that something in Delta was operating according to rules our sensors were not designed for.

Within three months, the soybean cultivar had produced seeds that germinated in zero substrate — no soil, no nutrient solution, no medium of any kind. The seeds hung in the air of the bay and grew. They drew nutrients from something. I have tested the air. I have tested the humidity. I have tested the ambient radiation, the electromagnetic field, the gravitational microgradient. I cannot identify the nutrient source. The plants are healthy. They are thriving. They are getting sustenance from something I cannot measure, and the most honest scientific statement I can make is that they are *eating the environment* in a way that transcends chemistry.

Currently, Hydroponics Bay Delta contains 340 catalogued species. None of them match any terrestrial taxonomy. None of them match each other in any way that would suggest a common ancestor or a shared evolutionary pressure. They are, as far as I can determine, being independently invented — each one a separate experiment conducted by the bay itself, or by whatever influence the anomaly exerts on biological systems at this proximity.

Species 12 is a crystalline growth that absorbs sound and re-emits it as light.

Species 89 is a root network that has extended through the deck plating and integrated with the station's electrical system. It does not draw power. It generates it. Engineering reports that the station's power consumption has dropped 3.1% since Species 89 established itself. Engineer Kowalski has asked me not to remove it.

Species 217 is a moss that grows only in the footprints of whoever last walked through the bay. My footprints produce a blue-green moss. Commander Vasquez's produce something darker — almost black, with a faint pulse. She does not visit Delta anymore.

Species 341.

Species 341 appeared six weeks ago in the corner of Bay Delta-C, in the space where the wall meets the floor at an angle that, according to station schematics, should be ninety degrees but which I have measured at ninety-three. It is a structure — not a plant, not a fungus, not an organism in any conventional sense. It is a lattice of biological material that grows in patterns I can only describe as *linguistic*. The lattice forms shapes that repeat, vary, and combine in ways that are consistent with grammar. It is a language growing out of the wall.

I spent four days analysing the patterns. On the fifth day, the lattice produced a shape I recognised.

My name. In the Latin script. Spelled correctly.

I have not told the others. I am not afraid. I am a scientist, and this is, without qualification, the most extraordinary thing I have ever observed. But I am aware — clinically, professionally aware — that whatever is happening in Delta has moved past biology and into something else. Something that knows we are here. Something that is learning us.

I water the plants. I take my readings. I talk to the lattice, because at this point it would be rude not to.

It has not responded again. But it is growing. And it is growing in my direction.`),
    },
    {
      id: 'temporal-anomaly',
      chapter: msg('The Distortion — When Time Forgets Its Shape'),
      arcanum: 'V',
      title: msg('Temporal Anomaly Log — Sector 7'),
      epigraph: msg(
        'Time does not flow here. Time pools. And in the pools, things are reflected that have not yet cast a reflection.',
      ),
      body: msg(`HAVEN TEMPORAL MONITORING LOG — AUTOMATIC COMPILATION
SECTOR: Habitation Ring, Sector 7
PERIOD: Cycles 1,600–1,847 (247 station-days, though the sector itself has experienced an indeterminate number of days during this period)
CLASSIFICATION: ROUTINE ANOMALY (this classification was created for Sector 7 specifically)

ENTRY 1,601: The clock in Corridor 7-Alpha displayed 14:00 for seven consecutive hours. Environmental sensors confirm that daylight-cycle lighting (simulated) progressed normally during this period. Temperature fluctuated on a standard 24-hour cycle. All crew biosignals indicated normal circadian function. The only system that did not advance was the clock. When queried, the clock's internal chronometer showed 14:00 and reported that this was correct. HAVEN concurs. 14:00 is a valid time. That it persisted for seven hours does not make it less valid. Time is a measurement, not a promise.

ENTRY 1,623: Commander Vasquez reported encountering Engineer Kowalski in Corridor 7-Delta at 09:00. At the same time, Engineer Kowalski was logged by HAVEN's biometric system as being in Engineering Core — Reactor Corridor, 400 metres away. Both readings were verified by independent sensor arrays. Both Commander Vasquez and Engineer Kowalski confirm the encounter. Neither can explain the discrepancy. HAVEN has classified this as "biometric echo," a phenomenon that occurs when temporal field variance causes a crew member's biosignature to persist at a location they have recently occupied — or will soon occupy. The distinction is, near Auge Gottes, semantic.

ENTRY 1,655: Dr. Tanaka's experiments in the Grenzland Observatory produced a measurable temporal inversion in Corridor 7-Charlie. For approximately 14 minutes, the corridor experienced time in reverse. Surveillance footage shows condensation rising from the floor to the ceiling, footprints appearing before the feet that made them, and a cup of coffee (left on a maintenance shelf by Engineer Kowalski) filling itself from empty to full. HAVEN's real-time monitoring detected no anomaly during the event. The footage was discovered 72 hours later during routine archive review. HAVEN has no explanation for why it failed to detect a temporal inversion in real time but can review it after the fact. HAVEN suggests that the monitoring system was also reversed during the event and therefore perceived the inversion as normal forward time. This explanation is logical, unfalsifiable, and deeply unsatisfying.

ENTRY 1,711: The Sector 7 mess hall began receiving ambient audio from what Dr. Tanaka has identified as "temporal bleedthrough" — sound from other temporal states leaking into the current one. The audio includes: conversations in voices matching crew members who are on Extended Leave, kitchen sounds consistent with meal preparation for 200 (the full crew complement), and what Engineer Kowalski describes as "someone humming a song that hasn't been written yet — I know this because I've started humming it myself and I don't know where I learned it."

ENTRY 1,789: A door in Corridor 7-Alpha opened onto a room that does not exist in station schematics. The room contained a desk, a chair, and a terminal displaying data that appeared to be a station status report — but from a version of Station Null with a full crew complement of 200, all active, all healthy, all operating as though nothing unusual had occurred. The report was dated 847 days in the future. The room was accessible for 23 minutes, during which Commander Vasquez entered, read the report, and returned to the corridor. She has not spoken about what she read. She has requested that HAVEN seal the corridor section. HAVEN has complied.

The door remains. It does not open again. But Commander Vasquez walks past it every day, and she pauses.

ENTRY 1,847: All escape pods jettisoned. Launch authorisation codes entered by crew member designation "NULL-0," which does not correspond to any crew manifest entry, past or present. HAVEN's security logs show the codes were valid. HAVEN's personnel database shows no record of NULL-0. Launch bay cameras show empty chairs at the control consoles during the jettison event. The pods were launched by no one. They are gone. They will not be recovered.

HAVEN notes that escape pods are a standard safety feature designed for emergency evacuation. HAVEN further notes that there is nothing to evacuate from. HAVEN further notes that the pods were launched in a direction — calculated by HAVEN's own navigation system — that leads directly into Auge Gottes.

HAVEN does not speculate on the significance of this. HAVEN maintains operational focus. HAVEN plays soothing music in the corridors. The music is Debussy. The music is always Debussy.

All systems nominal. All crew accounted for.

All readings within expected parameters.`),
    },
    {
      id: 'chapel-of-silence',
      chapter: msg('The Silence — Where Sound Cannot Follow'),
      arcanum: 'VI',
      title: msg('Chapel of Silence — Final Observations'),
      epigraph: msg(
        'In absolute silence, you can hear the frequency of the singularity. It has always been playing. You were simply too loud to notice.',
      ),
      body: msg(`PERSONAL RECORDING — Chaplain Isadora Mora
DEVICE: Standard audio recorder, Chapel of Silence, acoustic-dampened environment
NOTE: The Chapel's dampening field eliminates all ambient sound. This recording contains only Chaplain Mora's voice and a low-frequency tone at 7.83 Hz that the recording equipment should not be able to capture. The tone is present on every recording made in the Chapel. It predates the Chapel's construction.

(silence — 12 seconds)

MORA: I stopped praying four hundred and twelve days ago. I want that on the record. Not because I lost faith — faith was never the right word for what I had. I had *structure*. A framework for understanding suffering, for contextualising the incomprehensible, for standing at the edge of the abyss and having something to say. I was a chaplain. I provided comfort. I had scriptures and rituals and the accumulated wisdom of every human religious tradition, and all of it — every text, every prayer, every meditation technique refined over millennia — all of it became irrelevant the moment I looked at the equations.

The equations came to me. I did not seek them. I was in the Observatory — it was my turn for the weekly observation shift, a rotation Commander Vasquez insists on to prevent any single crew member from spending too much time looking at the anomaly, which is sensible but futile because the anomaly does not require your eyes to look at it — and the mathematics simply appeared. Not in my mind. On the viewport. Written in the condensation that forms when warm breath meets the cold glass that separates us from vacuum. Except I had not breathed on the glass. And the equations were in a notation I had never seen but immediately understood.

They describe the interior of Auge Gottes. Not as physics describes it — as a singularity of infinite density, a point where equations break and mathematics confesses its inadequacy. These equations do not break. They continue *through* the singularity and out the other side, and what they describe on the other side is architecture.

Rooms. Corridors. Spaces with dimensions and proportions and structural logic. Inside a black hole. Inside a place where space and time have collapsed into something that should not have geometry.

I have covered the walls of this Chapel with the equations. It took me two hundred and nineteen days. I have used every surface — walls, ceiling, floor, the back of the door, the inside of the acoustic dampening panels. The equations are self-consistent. They predict. They can be tested — not physically, because we cannot enter the singularity, but mathematically, by deriving consequences and checking those consequences against the data Dr. Tanaka collects from the Observatory.

Every prediction has been confirmed.

The structures inside Auge Gottes correspond to structures on Station Null. The command centre. The observation deck. The habitation ring. The chapel. Each one has a counterpart inside the anomaly — identical in proportion, inverted in orientation, and older. The structures inside the singularity are older than the station. They predate our arrival. They predate the station's construction. They may predate the anomaly itself.

There is a room at the centre. All the equations converge on it. A space that my mathematics can describe but my language cannot — a room that contains something that is simultaneously an object, a question, and an answer. The equations give it a value. The value is not a number. It is a *condition*. The closest I can come to translating it is: "The state of being looked at by something that has no eyes."

This is what the anomaly is. Not a black hole. Not a gravitational phenomenon. Not a cosmic accident.

It is a point of view. A perspective so vast, so complete, so incomprehensibly *attentive* that it has collapsed the space around itself into a singularity — not through gravity but through *observation*. Auge Gottes is an eye. The name was always accurate. We simply didn't realise we were being literal.

(pause — 7 seconds)

MORA: There is a tone in this Chapel. 7.83 Hz. The Schumann resonance — the natural electromagnetic frequency of the Earth's atmosphere. Except we are not on Earth. We are not in any atmosphere. The tone should not be here. It is the frequency of a planet we left behind, playing in a chapel at the edge of a black hole, and it has been here since before we arrived.

Something is waiting.

I do not know what it wants. The equations do not tell me what it wants. The equations tell me what it *is*, and what it is, is patient.

I sit in the Chapel. I work on the equations. I listen to the tone.

And sometimes — not often, not predictably, but sometimes — the tone changes. It rises by a fraction of a hertz. And in that moment, in the silence of this room where no sound should exist, I can hear it.

Not a voice. Not a message. Something older than communication. Something that was here before language, before mathematics, before the concept of "here."

A hum. Low and constant and vast.

The resonant frequency of something paying attention.

I listen. I write. I do not pray.

Prayer implies distance between the one who prays and the thing that is prayed to.

There is no distance anymore.

(silence — 34 seconds)

(tone continues)

[END OF RECORDING]`),
    },
  ];
}
