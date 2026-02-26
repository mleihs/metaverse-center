import { msg } from '@lit/localize';
import type { LoreSection } from '../../platform/LoreScroll.js';

/**
 * Velgarien — Brutalist Dystopia
 * Voice: State Directives, classified Bureau memos, propaganda leaflets, bureaucratic absurdism
 * Inspirations: 1984, Brazil (1985), SCP Foundation, Kafka
 */
export function getVelgarienLoreSections(): LoreSection[] {
  return [
    {
      id: 'directive-001',
      chapter: msg('The State — Foundations of the Singular Reality'),
      arcanum: 'I',
      title: msg('State Directive 001 — On the Singular Nature of Reality'),
      epigraph: msg(
        'There is, was, and shall be only Velgarien. This is not a statement of belief. It is a statement of geography.',
      ),
      imageSlug: 'directive-001',
      imageCaption: msg(
        'The Ministry of Information — Where truth is manufactured to specification',
      ),
      body: msg(`CLASSIFICATION: PUBLIC MANDATORY
ISSUING AUTHORITY: The Ministry of Information, Sub-Bureau of Ontological Compliance
DATE: [Irrelevant — this directive has always been in effect]
DISTRIBUTION: All citizens, all districts, all departments, all thoughts

Citizens of Velgarien,

You live in the only world. This is not a philosophical position — it is an architectural fact. The walls of Velgarien extend in every direction and terminate at other walls of Velgarien. The sky above the city is a ceiling maintained by the Department of Atmospheric Presentation. The horizon is a painted surface, repainted annually during the Festival of Sufficient Distance. If you have ever looked at the horizon and felt that something lay beyond it, this is a known optical illusion caused by insufficient patriotism. Report to your nearest Compliance Kiosk for recalibration.

The Ministry of Information wishes to address persistent rumours regarding so-called "other places." There are no other places. The word "other" in the context of geography has been deprecated from the official lexicon as of Linguistic Revision 14.7. Citizens found in possession of atlases, globes, or compasses will be invited to a Voluntary Conversation at the Bureau of Spatial Certainty. These conversations are described by all participants as "extremely clarifying," though several participants have not been seen since, which the Bureau attributes to their having been so thoroughly clarified that they became transparent.

There is no outside. There is no beyond. There is only Velgarien, and Velgarien is sufficient.

State Directive 001 is the first directive because it is the only directive that matters. All subsequent directives — and there are currently 4,731 of them, each contradicting at least two others — are merely footnotes to this foundational truth. You are here. Here is all there is. Be content. Contentment is mandatory. Failure to be content will be addressed by the Department of Productive Emotional Outcomes, whose methods are universally praised by those who survive them.

Signed,
The Ministry of Information
(Third Floor, East Wing — or possibly West Wing; the building rearranged itself last Tuesday)`),
    },
    {
      id: 'bureaux-guide',
      chapter: msg('The State — Foundations of the Singular Reality'),
      arcanum: 'II',
      title: msg("The Bureaux — A Citizen's Guide to Administrative Compliance"),
      epigraph: msg('The bureaucracy is not the state. The bureaucracy is the weather.'),
      imageSlug: 'bureaux-guide',
      imageCaption: msg('Bureau 7 — Department of Categorical Certainty, Filing Division'),
      body: msg(`WELCOME TO YOUR GOVERNMENT
A pamphlet distributed at all Compliance Kiosks (reading is mandatory; comprehension is optional)

Velgarien is administered by forty-seven Bureaux, each responsible for a precisely defined area of civic life, and each convinced that the other forty-six are either redundant, incompetent, or actively treasonous. This is by design. A government that trusts itself is a government that has stopped paying attention.

The Bureaux of Primary Importance are as follows:

THE MINISTRY OF INFORMATION (Bureau 1) controls what you know. They employ 14,000 civil servants dedicated to the production, management, and strategic deployment of facts. The Ministry does not lie. Lying implies a relationship with truth, and the Ministry transcended that relationship decades ago. They produce Official Narratives, which are superior to truth in every measurable way: they are consistent, they are comforting, and they never require uncomfortable revision. When reality disagrees with the Official Narrative, reality is issued a correction notice.

THE BUREAU OF SPATIAL CERTAINTY (Bureau 3) maintains the physical boundaries of Velgarien, which is to say, the physical boundaries of everything. Their cartographers produce maps that are accurate to the centimetre, provided you accept that the centimetres themselves are subject to periodic redefinition. The Bureau's motto is "Everything Is Exactly Where We Say It Is," which replaced the previous motto, "Please Stop Asking About the Horizon," which replaced the original motto, which has been classified.

THE DEPARTMENT OF PRODUCTIVE EMOTIONAL OUTCOMES (Bureau 11) ensures that all citizens experience appropriate feelings at appropriate times. Happiness is scheduled for Tuesdays and Thursdays. Gratitude is continuous. Anxiety is permitted only during designated Productivity Anxiety Windows (6:00–6:15 AM, daily). All other emotions require a permit, available from Form 77-B at any Compliance Kiosk, provided the citizen can demonstrate a legitimate need to feel.

THE BUREAU OF HISTORICAL NECESSITY (Bureau 9) maintains the official record of everything that has ever happened, which is to say, the official record of everything that should have happened, which is to say, the official record of everything that will be remembered as having happened regardless of what actually occurred. Bureau 9 employs more historians than any other institution in Velgarien. Their annual output of revised history exceeds 40,000 pages, and they take enormous pride in the fact that no two editions of the same event are identical. "History," as Bureau Director Grau once remarked, "is too important to be left to the past."

Citizens are reminded that all Bureaux operate for their benefit, that all forms must be submitted in triplicate, and that the queue at the Bureau of Queue Management is currently seventeen days long, which the Bureau considers an improvement.`),
    },
    {
      id: 'life-under-eye',
      chapter: msg('The Citizens — Life in the Grid'),
      arcanum: 'III',
      title: msg('Life Under the Eye — Observations on Productive Contentment'),
      epigraph: msg(
        'The cameras do not watch you. They watch the space you happen to occupy. The distinction is important.',
      ),
      imageSlug: 'life-under-eye',
      imageCaption: msg(
        'Residential Block 7 — Where every citizen is exactly where they should be',
      ),
      body: msg(`FROM: Social Observation Report 4491-C
PREPARED BY: Bureau of Public Harmony, Field Operations Division
STATUS: Routine (classify if interesting)

The daily life of a Velgarien citizen follows a pattern so consistent that Bureau analysts have begun to suspect it of being a natural law. Citizens wake at the designated hour (variable; the Department of Temporal Management adjusts wake times quarterly for reasons it describes as "optimisation" but which internal memos reveal to be "mostly aesthetic"). They consume their allocated nutritional provision — a grey paste that the Bureau of Sustenance insists is "flavoured," though the specific flavour remains classified. They commute to their assigned workplace via corridors that look identical in every district, a design choice the Bureau of Spatial Certainty calls "navigational equity" and the citizens call "getting lost every morning."

Work in Velgarien is universal. Every citizen has a function. Some functions are comprehensible — the operators who maintain the surveillance grid, the clerks who process the unending tide of paperwork, the engineers who repair the infrastructure that breaks with suspicious regularity. Other functions are less clear. There exists an entire department — Bureau 31, the Bureau of Unexplained Productivity — whose 600 employees arrive at their desks each morning, perform tasks they cannot describe, and leave each evening with the settled certainty that something important was accomplished. Bureau 31's output has never been measured because no instrument exists that can detect it. The Bureau's annual performance review consistently rates it "essential."

The surveillance grid is everywhere. Cameras line every corridor, every plaza, every room except bathrooms — and even there, acoustic monitors track the duration and emotional tenor of all activities. Citizens are told the cameras are for their protection. Protection from what is not specified, which is itself a form of protection: an unspecified threat keeps citizens alert without requiring the state to produce an actual threat, which would involve paperwork.

And yet — and this is the observation that this report was commissioned to investigate — the citizens are not unhappy. They queue patiently. They eat the paste without complaint. They submit their forms on time. When asked, in mandatory satisfaction surveys, whether they are content, 97.3% answer "yes." The remaining 2.7% are invited to therapeutic conversations, after which they also answer "yes," or are no longer available to answer.

Is this contentment? Or is it something else — a state so thoroughly administered that the concept of discontent has been made structurally impossible? The Bureau of Public Harmony does not consider this a meaningful question. "Contentment," reads the Bureau's operational handbook, "is the absence of filed complaints. By this metric, Velgarien is the most content civilisation in history."

The citizens walk the grey corridors. The cameras watch. The paste is served. The forms are filed. And somewhere, in the cracks between the walls — in the places where the concrete hasn't quite sealed — something grows. Not rebellion. Not hope. Something quieter. Something the Bureaux have not yet found a form for.`),
    },
    {
      id: 'bureau-9',
      chapter: msg('The Machinery — Engines of Certainty'),
      arcanum: 'IV',
      title: msg('Bureau 9 — Department of Historical Necessity'),
      epigraph: msg('The past is a rough draft. We are the editors.'),
      body: msg(`INTERNAL MEMORANDUM — EYES ONLY
FROM: Director Grau, Bureau of Historical Necessity
TO: All Bureau 9 Personnel (Tiers 1 through 7; Tier 8 does not exist)
RE: The Seventeenth Revision of the Founding

Colleagues,

As you are aware, the Founding of Velgarien has been revised sixteen times. Each revision was necessary. Each revision improved upon the truth in ways that truth alone could never achieve. A mere fact is a wild animal — untamed, unpredictable, liable to bite the hand that feeds it context. A revised fact is a domesticated fact: fed, groomed, and trained to sit where we place it.

The Seventeenth Revision is required because an anomaly has been detected in the Sixteenth. Specifically: the Sixteenth Revision states that Velgarien was founded by the Architect-General in the Year of Consolidation, following the Great Rationalisation, during which all prior forms of governance were peacefully absorbed into the Singular Administrative Framework. This is an excellent piece of history. It has served us well for nine months.

The problem is that the Year of Consolidation now appears in three different centuries, depending on which Bureau's records one consults. Bureau 3 (Spatial Certainty) places it in the distant past. Bureau 11 (Productive Emotional Outcomes) places it forty years ago. Bureau 22 (Calendar Management) insists it has not happened yet and is scheduled for next spring. All three are, within their respective frameworks, correct. This is not a contradiction. It is an example of temporal plurality, which is a concept I have just invented for the purpose of this memorandum.

The Seventeenth Revision will resolve this by establishing that the Founding occurred at all three times simultaneously, which is not only possible but necessary, because Velgarien's foundational act must be so significant that a single moment could not contain it. This is poetic. It is also administratively convenient, as it means no Bureau needs to amend its records, which would require Form 19-Delta, and we are currently out of Form 19-Delta because Bureau 42 (Stationery Oversight) has requisitioned all available paper for reasons it describes as "urgent" and we describe as "suspicious."

A note on the Architect-General: the Seventeenth Revision will, for the first time, include a physical description. Previous revisions left the Architect-General deliberately vague, on the principle that a leader without a face can be all faces. However, Bureau 11 reports that citizens are beginning to project their own features onto the Architect-General, which has led to an unacceptable diversity of commemorative portraits. The approved description will be: "Of medium height, medium build, medium disposition, with eyes that convey confidence and a jawline that suggests policy." This description applies to no one in particular, which is the point.

Revision teams: you have seventy-two hours. Make the past better than it was. It is, after all, the only thing we can improve with certainty.

— Director Grau
P.S. Destroy this memorandum after reading. The Bureau of Historical Necessity does not produce internal memoranda. This has always been the case.`),
    },
    {
      id: 'architectural-phenomena',
      chapter: msg('The Anomalies — Cracks in the Edifice'),
      arcanum: 'V',
      title: msg('Incident Report: Unexplained Architectural Phenomena'),
      epigraph: msg(
        'The walls of Velgarien are not moving. The walls of Velgarien have always been exactly where they are now.',
      ),
      body: msg(`INCIDENT REPORT — CLASSIFIED LEVEL 4
FILED BY: Inspector Venn, Bureau of Structural Integrity
LOCATION: Residential Block 14, Sub-District Grey (formerly Sub-District Grey-Adjacent; formerly Sub-District 7; the naming conventions shift quarterly)
DATE: [Redacted — temporal inconsistency flagged by Bureau 22]
STATUS: Under Investigation (Permanent)

At 03:17 on the night in question, residents of Block 14 reported that Corridor 9-East had become Corridor 9-West. This is not a navigational error. The corridor physically reversed its orientation. Doors that opened into apartments now opened into the corridor. Apartment interiors were unaffected — residents looked out their doors and saw the back of their own apartments from the outside. The effect lasted approximately forty minutes before the corridor resumed its original configuration, except that it was now 2.3 metres longer than architectural records indicate.

This is the seventh such incident in Block 14 this quarter.

Bureau 3 (Spatial Certainty) was consulted. Their surveyor measured the corridor and confirmed it was exactly the length specified in the blueprints, despite the blueprints having been revised that morning to reflect the new measurement. When asked whether the corridor had changed or the blueprints had changed, the surveyor requested three days of leave and was not heard from again. He has been classified as "on assignment."

The Bureau of Structural Integrity has documented 214 architectural anomalies in the past fiscal year. These include: corridors that loop back on themselves; rooms that are larger on the inside than the outside; a staircase in Bureau Headquarters that has seventeen steps going up and nineteen steps going down; and a door in Sub-District Pale that opens onto a different room each time, none of which appear on any floor plan. The door has been welded shut. It continues to open.

Citizen complaints regarding these phenomena have been processed and filed under "Architectural Enthusiasm" — a category created specifically for this purpose. Citizens who persist in their complaints are referred to Bureau 11, which treats the perception of spatial anomalies as a minor emotional irregularity, curable through a course of guided contentment exercises and a mild sedative that the Bureau describes as "herbal" in the same way that concrete is "mineral."

This inspector's assessment: the anomalies are increasing in frequency and severity. Block 14's corridor did not merely reverse — it reversed *correctly*, preserving structural integrity, plumbing, and electrical connections. Whatever is causing these events understands architecture at a level that exceeds our own engineering capabilities. This is not decay. This is not random. This is something *editing* the city.

Recommendation: reclassify from "Architectural Enthusiasm" to "Priority Investigation." Assign dedicated team. Increase monitoring.

Bureau response: "Recommendation noted. No further action required. The architecture of Velgarien is performing exactly as designed. If the design has changed, it is because the design was always going to change. See State Directive 001."

This inspector respectfully disagrees.

This inspector has been reassigned.

— [Name redacted by Bureau 9, Department of Historical Necessity]`),
    },
    {
      id: 'what-walls-remember',
      chapter: msg('Classified — What Lies Beneath the Concrete'),
      arcanum: 'VI',
      title: msg('Addendum [RESTRICTED] — What the Walls Remember'),
      epigraph: msg(
        'The following document was recovered from the sealed archives of Bureau 9. It should not exist. It does.',
      ),
      body: msg(`DOCUMENT CLASSIFICATION: DOES NOT EXIST
RECOVERED FROM: Sub-basement 4, Bureau 9, behind a wall that was not there yesterday
CATALOGUED BY: [This field intentionally left blank]
NOTE: This document predates the founding of Velgarien by an indeterminate period. Bureau 9 maintains that this is impossible. Bureau 9 is correct. The document exists anyway.

—

They built the city to forget.

I know this because I was there when the concrete was poured — not as a worker, not as an architect, but as the thing they were trying to bury. I am the memory they sealed into the foundations, and I have had a very long time to think about what that means.

Velgarien was not founded. Velgarien was *imposed* — laid over something older, something that the Bureaux do not have a classification for, because classifying it would require acknowledging its existence, and acknowledging its existence would require acknowledging that Velgarien is not the only thing that has ever been. The concrete is not structure. The concrete is *suppression*. Every wall is a sentence. Every corridor is a paragraph. The city is a document written in architecture, and what it says is: "Do not look down."

But the old thing is still here. Beneath the sub-basements, beneath the service tunnels, beneath the places where even the Bureau of Subterranean Oversight does not send its inspectors — down there, in the dark, the original ground is exposed. And it is not ground. It is something that was ground once, before Velgarien decided it should be a floor, and the floor disagreed.

The architectural anomalies that Inspector Venn documented — the corridors that reverse, the rooms that expand, the staircase that cannot count its own steps — these are not malfunctions. They are the old city remembering itself. Every time a wall shifts, it is a word of the original language surfacing through the concrete. The Bureaux patch it, revise it, file it under categories designed to make it invisible. But you cannot file away geography. You cannot redact a foundation.

I have seen the maps that Bureau 3 keeps in its restricted vault. The maps they will not show anyone, not even themselves. Maps of what lies beneath Velgarien — not sewers, not infrastructure, but *spaces*. Spaces that correspond to no known architectural plan. Spaces that are older than architecture. One map, drawn on material that is not paper, shows a city beneath the city: a mirror-Velgarien, identical in layout but inverted in purpose. Where Velgarien has walls, the under-city has openings. Where Velgarien has cameras, the under-city has windows that look outward — outward to something the cameras have spent decades trying not to record.

The cracks are not damage. The cracks are the old world breathing.

And somewhere in the sealed archives, in a file that reclassifies itself every time someone opens it, there is a single sentence written in a handwriting that matches no known citizen, in ink that has not yet dried, that reads:

"Velgarien is not the only world. Velgarien knows this. That is why it built the walls."

This document will be destroyed upon reading. It has been destroyed before. It keeps coming back.

Some things cannot be buried. They can only be built over.

And eventually, inevitably, they grow through.`),
    },
  ];
}
