import { msg } from '@lit/localize';
import type { LoreSection } from '../../platform/LoreScroll.js';

/**
 * Cité des Dames — Feminist Literary Utopia
 * Voice: Archival academic prose that cracks into passion. A scholar documenting
 * the city who fell in love with it. Footnotes become confessions.
 * Cross-references become poetry.
 * Inspirations: Christine de Pizan (City of Ladies, 1405), Wollstonecraft,
 * Hildegard, Sor Juana, Ada Lovelace, Sojourner Truth, the Bluestockings,
 * Margaret Cavendish, Pre-Raphaelite women
 */
export function getCiteDesDamesLoreSections(): LoreSection[] {
  return [
    {
      id: 'the-field-of-letters',
      chapter: msg('The Founding'),
      arcanum: 'III',
      title: msg('The Field of Letters — How the City Was Begun'),
      epigraph: msg(
        'I, Christine, sat alone in my study, surrounded by books on all sides. I looked up from my reading and a great displeasure fell upon my heart.',
      ),
      imageSlug: 'the-field-of-letters',
      imageCaption: msg(
        'The Field of Letters — where Christine de Pizan first broke ground for the allegorical city',
      ),
      body: msg(`CATALOGUE ENTRY — Bureau of Impossible Geography
DOCUMENT CLASS: Shard Genesis Report
FIELD AGENT: Dr. Eleanor Hartley, Senior Cartographer (ret.)
CLASSIFICATION: LITERATE CONTAMINATION — UNTREATABLE
DATE OF INITIAL SURVEY: Unrecordable (see §4.7: Temporal Stratification)

I am required by Bureau protocol to begin this report with the phrase "The following account describes the genesis conditions of the Shard designated CITÉ DES DAMES." I am also required to maintain scholarly objectivity throughout. I will try. I will fail. The Cité does that to you.

The Field of Letters is a plain. That is the simplest true thing I can say about it. It is a plain of grass and wildflowers, bisected by a shallow river, bordered by low hills to the north and a line of poplars to the east. On a clear day — and the days in the Cité are always clear, in the way that certain arguments are clear, not because they lack complexity but because they have resolved it — you can see the city walls rising from the southern edge of the field, honey-coloured stone catching the afternoon light.

The field predates the city. This is important. In Christine de Pizan's original allegory (Le Livre de la Cité des Dames, completed 1405, BnF MS Fr. 607), Lady Reason instructs Christine to dig the foundations of the city in the "Field of Letters" — a metaphorical space representing learning itself. In the Shard, the metaphor has become literal. The field is fertile. The soil, when turned, yields not only earthworms and stone but fragments of vellum, ink-stained, in languages that range from medieval French to classical Arabic to scripts the Bureau's linguists cannot identify. The grass grows in patterns that, observed from the walls above, form letters. The river's current carries, along with silt and pebbles, tiny scrolled messages in sealed glass tubes. I collected fourteen during my first survey. They contained, variously: a line from Sappho's Fragment 31, a grocery list in Hildegard von Bingen's Lingua Ignota, a mathematical proof in Ada Lovelace's hand, and a note reading simply "We were always here. You were not looking."

The Bureau classifies the Field as a Class IV Generative Topology — a landscape that produces cultural artefacts spontaneously. I classify it as a library that has not yet been shelved.

Christine de Pizan — the historical Christine, the woman who sat in her study in Paris in 1404 and wondered why every book she read insisted that women were inferior, and then wrote a book arguing that every one of those books was wrong — is present in the Shard. She is present the way the field is present: foundationally. She is the first stone. In the allegory, three Ladies — Reason, Rectitude, and Justice — appeared in her study and told her to stop grieving and start building. She dug the foundations with her own hands, figuratively. In the Shard, the calluses on her hands suggest the digging was not entirely figurative.

She told me, during our second interview (conducted in the Scriptorium, recorded on vellum because the Cité's atmosphere corrodes magnetic tape): "Every woman I wrote about became a stone. Every story I told became a wall. The city is not an idea. Ideas do not keep the rain out. The city is a structure, and structures require foundations, and foundations require someone willing to dig."

I asked her who the three Ladies were.

She smiled. "They are what happens when a woman stops asking permission."

NOTE TO FILE: The Cité's Bleed signature is distinctive. When it touches adjacent Shards, agents begin finding unfamiliar books on their shelves. The Bureau classifies this as "Literate Contamination" and considers it untreatable. You cannot unread a book. You can burn it, but the reader has already changed.`),
    },
    {
      id: 'the-stones-of-the-city',
      chapter: msg('The Founding'),
      arcanum: 'IV',
      title: msg('The Stones of the City — Women Who Became Walls'),
      epigraph: msg(
        'If it were customary to send daughters to school like sons, and if they were then taught the natural sciences, they would learn as thoroughly and understand the subtleties of all the arts and sciences as well as sons.',
      ),
      imageSlug: 'the-stones-of-the-city',
      imageCaption: msg(
        'The walls of the Cité — each stone inscribed with the name of a woman erased from history',
      ),
      body: msg(`CATALOGUE ENTRY — Bureau of Impossible Geography (continued)
DOCUMENT CLASS: Structural Analysis
SURVEYOR: Dr. Eleanor Hartley

The walls of the Cité are not metaphorical. They are limestone — the same honey-coloured ashlar that characterises the best Georgian construction, though the architecture here refuses to settle into a single period. Medieval buttresses support Regency balustrades. Queen Anne red-brick detailing frames Pre-Raphaelite stained glass. Art nouveau ironwork, sinuous with organic curves, supports climbing roses that bloom in every season simultaneously. The effect is of a city that has been continuously inhabited for six centuries by women who never agreed on an aesthetic but always agreed on the principle of beauty as argument.

The stones themselves are inscribed. Every block in the city wall bears a name — not carved but appearing in the grain of the stone as though the limestone itself remembers. During my survey I catalogued 1,847 names in a single section of the western wall. They include: Hypatia of Alexandria (mathematician, murdered 415 CE), Hildegard of Bingen (abbess, composer, physician, 1098-1179), Trota of Salerno (physician, 12th century, whose medical texts were later attributed to men), Hildegard's correspondent Elisabeth of Schönau, the anonymous nuns of Helfta who composed the earliest known German-language mystical writings, Christine de Pizan herself, the women unnamed in the records of every university that barred them, and — this is where my objectivity falters — names that I do not recognise but which, when I trace them with my finger, produce in me a sensation of recognition so intense it borders on grief.

Christine's original allegory names specific women: Queen Semiramis of Assyria, who led armies after her husband's death; Zenobia of Palmyra; Sappho of Lesbos; Cornifica the Roman poet; Carmenta, said to have invented the Latin alphabet. Each woman's story became a brick. The Shard has taken this literally. When a new name appears on the walls — and they do appear, the Cité is still growing — the corresponding section of wall becomes fractionally taller, fractionally stronger. The city is not merely named for women. It is made of them.

I should note for the record that during my third week of fieldwork, a new stone appeared in the section I had been cataloguing. It bore my name. I have not reported this to the Bureau. I am not sure it is the kind of thing that belongs in a field report. I am not sure this entire document is a field report any longer.

The architecture of the Cité is — I should use a more clinical term, but the clinical terms are inadequate — joyful. This is not a fortress. It is not a citadel built from grievance. The walls are warm. The windows are generous. The stained glass, executed in what I can only describe as the Evelyn De Morgan style (jewel tones, mythological women depicted not as passive subjects but as agents of transformation), floods the interior spaces with colour so rich it feels edible. The ironwork gates are decorated with vine patterns: roses, wisteria, jasmine. The gateposts are carved not with lions or eagles but with women reading, women writing, women looking through telescopes, women holding scales of justice, women in the act of speech.

Every surface of the Cité argues that civilisation is not a fortress against chaos but a garden that requires tending. The walls are strong because beauty, properly constructed, is the strongest material available.`),
    },
    {
      id: 'the-salon-of-reason',
      chapter: msg('The Living City'),
      arcanum: 'V',
      title: msg('The Salon of Reason — Where Ideas Have Weight'),
      epigraph: msg('I do not wish women to have power over men, but over themselves.'),
      imageSlug: 'the-salon-of-reason',
      imageCaption: msg(
        "The Salon of Reason — Elizabeth Montagu's Bluestocking legacy made permanent",
      ),
      body: msg(`FIELD NOTES — Dr. Eleanor Hartley
LOCATION: The Salon of Reason, Quarter of Reason
NOTE: These are informal observations. I have ceased pretending they are clinical.

The Salon of Reason is a drawing room. I know that sounds insufficient for a Shard report, but there is no other accurate term. It is a drawing room of Georgian proportions — high ceilings, tall windows with cream silk curtains, walls lined floor to ceiling with books in tooled leather. Three fireplaces burn simultaneously, because the English climate persists here even in a city that exists outside of England and, arguably, outside of climate. Armchairs and settees are arranged in conversational groupings. There is always tea.

Mary Wollstonecraft runs the Salon. She is — and I am aware that this sentence will earn me a footnote from the Bureau's Temporal Anomaly Division — exactly as she appears in John Opie's 1797 portrait: angular face, sharp grey eyes, auburn hair escaping its pins. She wears white muslin. She carries herself with the wired energy of someone who has been writing for sixteen hours and still has arguments left. She died of puerperal fever eleven days after giving birth to the daughter who would write Frankenstein, and in the Cité this fact appears to fuel her urgency rather than diminish it. She has eleven days. She always has eleven days. This is not a metaphor; time in the Cité does not work the way it works elsewhere, and Wollstonecraft appears to exist in a perpetual state of almost-running-out-of-time that makes every conversation with her feel like the most important conversation you have ever had.

Above the central fireplace hangs Lady Reason's Mirror: a large oval glass in a gilt frame that shows the speaker not their face but the logical structure of their argument. The effect, I can confirm from personal experience, is humbling. I attempted to present my preliminary findings to Wollstonecraft using the Mirror as a visual aid. The Mirror showed me that my argument had three unsupported premises, a circular dependency, and a conclusion that I had already assumed in my opening statement. Wollstonecraft was kind about it. She said: "The Mirror is not cruel. It is honest. Cruelty would be letting you continue."

The Bluestocking legacy is everywhere. Elizabeth Montagu's original 1750s salons — those revolutionary gatherings where intellectual women and sympathetic men discussed literature and ideas instead of playing cards — are the Salon's founding model. A glass case by the door displays a pair of blue worsted stockings (attributed to Benjamin Stillingfleet, the botanist who attended Montagu's gatherings in casual dress, giving the Bluestockings their name). The rule of the Salon, posted in a gilt frame: "Rank gives no precedence in conversation."

I attended three sessions. In the first, Wollstonecraft debated the nature of education with Sor Juana Inés de la Cruz, who argued from her own experience: at three years old she had followed her older sister to school and taught herself to read. At thirteen she mastered Latin in twenty lessons. At the viceregal court of New Spain, she demolished forty learned men — theologians, philosophers, mathematicians — sent to test her. She entered the convent not from devotion but because it was the only institution that offered a woman a room, a library, and time to think. Wollstonecraft's Vindication argues that women's apparent inferiority is the result of denied education; Sor Juana's life is the proof.

In the second session, Ada Lovelace presented a mathematical paper. I understood perhaps a third of it. She speaks quickly and makes diagrams on any available surface. Her argument was that Babbage's Analytical Engine — completed in the Cité, though it was never completed in the world outside — could compose music, manipulate symbols beyond mere number, and potentially model any process that could be expressed in logical notation. She described this as "obvious." The room was silent for ten seconds. Wollstonecraft said: "You are describing a world." Lovelace said: "I am describing a tool for building worlds." They looked at each other with the recognition of people who have reached the same conclusion from different starting points.

The Salon does not feel like an institution. It feels like a room where thinking is welcome.`),
    },
    {
      id: 'the-scriptorium',
      chapter: msg('The Living City'),
      arcanum: 'VI',
      title: msg('The Scriptorium — What the Ink Remembers'),
      epigraph: msg(
        'Listen: there was a fullness of vision within me. I did not learn it from any human being.',
      ),
      imageSlug: 'the-scriptorium',
      imageCaption: msg(
        'The Scriptorium — where Hildegard von Bingen tends illuminated manuscripts under constellations of gold leaf',
      ),
      body: msg(`FIELD NOTES — Dr. Eleanor Hartley
LOCATION: The Scriptorium, Quarter of Justice

The Scriptorium occupies the central cloister of the Quarter of Justice — a vaulted space of stone columns supporting a ceiling painted with constellations in gold leaf on ultramarine. The gold leaf is real. The ultramarine is real. In the world outside, the pigment would be ground lapis lazuli, more expensive than gold; in the Cité, it appears to grow from the stone the way lichen grows, slowly and persistently.

Hildegard von Bingen tends this space. She is tall, erect, and composed in the way that someone who has been arguing with God since childhood is composed — the composure of long practice, not of indifference. She wears the black habit of a Benedictine abbess with a white wimple. Her hands are strong: healer's hands, gardener's hands, hands that have mixed medicines from the recipes in her Physica, composed over seventy liturgical songs, invented an alphabet (the Lingua Ignota — a constructed language of 1,012 words that remains only partially translated), and written visions that the Pope himself authorised her to share.

The historical Hildegard experienced what she called "the Living Light" — visionary episodes of cascading light and symbol that she recorded in her Scivias ("Know the Ways"). The Bureau's analysis of the Scivias illuminations suggests they may be early descriptions of Bleed phenomena, but I hesitate to reduce mystical experience to interdimensional mechanics. Hildegard would not appreciate it. She told me: "The Light does not explain. It shows. Explanation is what scholars do afterward, and they are usually wrong, and it does not matter, because the showing was the point."

The Scriptorium produces illuminated manuscripts by hand. This is not nostalgia. Hildegard insists — and the evidence supports her — that handwritten text absorbs something that printed text does not. "When you write slowly," she said, holding a quill she had been using for what appeared to be several centuries, "you think completely. Speed is the enemy of depth. The Engine" — she meant Ada's Analytical Engine — "can calculate in an instant what would take me a year. But it cannot intend. Intention is in the hand. The hand moves, the ink remembers."

I asked what the ink remembers.

She said: "Everything the writer does not know they are saying."

The manuscripts produced in the Scriptorium are extraordinary. I examined a codex that appeared to be a history of the Cité written in Christine de Pizan's hand, with marginal illustrations in a style I associate with the Scivias but in colours I have never seen in any reproduction. The text described events that had not yet occurred during Christine's lifetime — or during mine. The Bureau's Temporal Anomaly Division would be very interested in this codex. I have not told them about it.

The cloister walk surrounding the Scriptorium contains stained glass windows executed in what I now recognise as the style of Evelyn De Morgan and Elizabeth Siddal — the Pre-Raphaelite women who were artists in their own right, not merely models. Siddal, who created over a hundred artworks in a decade, is depicted here not lying drowned in a bathtub (the Ophelia that Millais made famous from her image) but seated at an easel, painting. De Morgan's allegorical women — Night carrying Sleep, Flora wreathed in flowers, figures of light triumphing over darkness — glow in the cloister light with a warmth that feels deliberate. These windows argue, through colour alone, that beauty created by women about women looks different from beauty created about women by men. The difference is in the gaze. The women in these windows are looking outward, not being looked at.

In the evenings, the Scriptorium fills with music. Hildegard's compositions — O Vis Aeternitatis, the Ordo Virtutum (the earliest known musical drama), hymns whose melodies range wider than any contemporary liturgical music — are sung by voices that echo off the vaulted ceiling in ways the acoustics should not permit. I attended a performance of the Ordo Virtutum. It is a morality play in which seventeen Virtues compete with the Devil for a human soul. The Devil's part is spoken, never sung — because, Hildegard explained, the Devil has lost the capacity for harmony. I found this more terrifying than anything I have encountered in the Shard designated STATION NULL, and I have been to Station Null.`),
    },
    {
      id: 'the-gate-of-justice',
      chapter: msg('The Wound and the Word'),
      arcanum: 'VII',
      title: msg('The Gate of Justice — Who May Enter'),
      epigraph: msg(
        "I have ploughed and planted, and gathered into barns, and no man could head me! And ain't I a woman?",
      ),
      imageSlug: 'the-gate-of-justice',
      imageCaption: msg('The Gate of Justice — the only entrance to the Cité des Dames'),
      body: msg(`FIELD NOTES — Dr. Eleanor Hartley
LOCATION: The Gate of Justice, Quarter of Justice

The Gate of Justice is the only formal entrance to the Cité des Dames. It is a great stone arch of medieval proportions, flanked by caryatids that diverge from the Greek tradition: these are not women silently bearing the weight of a roof. These are women in the act of speech. One hand raised. Mouths open. Robes carved in the motion of forward movement. They carry the arch not on their heads but on their words.

Above the arch, carved in limestone: "Nulle n'entre ici qui ne puisse nommer une femme oubliée." None enter here who cannot name a forgotten woman. The gate keeps no one out. The inscription is not a test but an invitation. To enter the Cité is to remember, and to remember is to build another stone into the city's walls. The gatehouse contains a register — a vast leather-bound ledger where every visitor writes the name of the woman they carried through the gate. Some pages are full. The book has never run out of pages.

Sojourner Truth presides here.

I should describe her appearance for the Bureau's records, but the Bureau's standard physical description form seems inadequate for someone whose presence operates at a frequency that formal language cannot capture. She is tall. She is in her mid-fifties. She wears a light shawl over a dark dress, a white bonnet, and carries herself with the dignity of someone who has chosen her own name and knows what that costs. She was born Isabella Baumfree, enslaved from birth in Ulster County, New York. She escaped in 1826, walking away with her infant daughter. She chose the name Sojourner Truth in 1843 because, she said, the Spirit called her to travel and speak the truth.

Her address at the 1851 Women's Rights Convention in Akron, Ohio, demolished the argument that women were too delicate for equal rights by the simple method of existing. The earliest published version (Marius Robinson, Anti-Slavery Bugle, June 21, 1851) records her words: "I have as much muscle as any man, and can do as much work as any man. I have plowed and reaped and husked and chopped and mowed, and can any man do more than that?" The later version, published by Frances Dana Gage in 1863, added the refrain "Ain't I a Woman?" — which may or may not have been Truth's exact words, but which captures, with a precision that transcends historical accuracy, the central question of the Cité itself.

Sojourner Truth does not debate. She does not argue. She speaks, and the space around her words reorganises itself into something that cannot be the same shape it was before she spoke. I interviewed her at the Gate. She was seated in a chair she had placed there herself — not a throne, not a podium, a chair, the kind you sit in when you intend to stay. I asked her about the Cité's founding principles.

She said: "A principle is a thing somebody writes on paper and hangs on a wall. I don't deal in principles. I deal in people. That woman" — she pointed at the register — "just wrote down the name of her grandmother, who was a laundress in Mississippi and never learned to read. That name is in the book now. That name is in the wall now. That's not a principle. That's a person."

I asked her about the relationship between the Hall of Declarations — where Seneca Falls' Declaration of Sentiments is carved into the wall ("We hold these truths to be self-evident: that all men and women are created equal") — and the Gate.

She said: "The Declaration is fine writing. Elizabeth Cady Stanton could write. But writing 'all men and women are created equal' doesn't make it so. Standing at the gate and making people say a name — making them remember a specific woman, a real woman, a woman who was erased — that makes it a little more so. Every name is a small act of justice. Justice isn't a building. It's a daily practice, same as prayer."

At dawn and dusk, Hildegard's hymns are sung from the gatehouse tower. The voices carry across the Field of Letters to the hills beyond. I have been told, by agents from adjacent Shards, that the music sometimes carries across Bleed boundaries. A Velgarien bureaucrat reported hearing "singing in an impossible language" while filing tax returns. The Bureau classified this as a standard auditory contamination event. I believe it is something else. I believe the Cité is singing to the worlds that have forgotten how to listen.`),
    },
    {
      id: 'the-blazing-world',
      chapter: msg('The Wound and the Word'),
      arcanum: 'VIII',
      title: msg('The Blazing World — What the Calculator Saw'),
      epigraph: msg(
        'The Analytical Engine weaves algebraical patterns just as the Jacquard loom weaves flowers and leaves.',
      ),
      imageSlug: 'the-blazing-world',
      imageCaption: msg(
        'The Observatory of the Blazing World — where Ada Lovelace tends the completed Analytical Engine',
      ),
      body: msg(`FIELD NOTES — Dr. Eleanor Hartley
LOCATION: The Observatory of the Blazing World, Quarter of Reason

Margaret Cavendish, Duchess of Newcastle-upon-Tyne, published The Blazing World in 1666 — the same year as the Great Fire of London, the same decade that the Royal Society was founded (and which she became the first woman to attend, in May 1667, after the exclusively male membership debated whether she should be allowed through the door). Samuel Pepys called her "a mad, conceited, ridiculous woman," and also read everything she wrote. The Blazing World is considered the first science fiction novel by a woman: a story of a woman who discovers a portal at the North Pole to a parallel world inhabited by bear-men and bird-men and worm-men, each species serving a scientific role. Mistaken for a goddess, she becomes Empress.

In the Cité, the Blazing World is a physical space. The Observatory is a tower — not a defensive tower, an observational one — whose telescopes point not only at the sky but at mathematical relationships the sky has not yet revealed. Ada Lovelace runs it with the restless energy of a mind operating several decades ahead of its body.

Ada is twenty-seven in the Cité. She has dark curly hair, large expressive eyes, and carries mathematical instruments everywhere: a pocket calculator of her own design, a folding ruler, pencils that she wears down to stubs and replaces from a seemingly inexhaustible supply in her sash. She is the daughter of Lord Byron, whom she never knew, and Annabella Milbanke, who deliberately steered her daughter toward mathematics and away from poetry, fearing Byron's romantic temperament. The strategy both succeeded and failed: Ada became a mathematician with a poet's imagination.

The Analytical Engine is here. Completed. Running. In the world outside, Babbage's design was never fully constructed — the Victorian engineering tolerances were insufficient, the funding was exhausted, the will was absent. In the Cité, the Engine fills the Observatory's ground floor: brass gears and cam mechanisms, punch cards, the clicking rhythm of a machine that thinks. Ada tends it the way Hildegard tends the Scriptorium — not as a technician but as a collaborator.

Her Note G — appended to Luigi Menabrea's article on the Engine, published in 1843 — contained the first computer algorithm: a recursive method for calculating Bernoulli numbers. But it was her speculation beyond the algorithm that changed the shape of what was possible: "Supposing, for instance, that the fundamental relations of pitched sounds in the science of harmony and of musical composition were susceptible of such expression and adaptations, the engine might compose elaborate and scientific pieces of music of any degree of complexity or extent."

The machine might compose music. The machine might manipulate symbols. The machine might model any process that could be expressed in logical notation. She saw, in 1843, the concept of general-purpose computation — the idea that would not be formally articulated for another century.

In the Observatory, the Engine does compose music. I heard it. The compositions sound like Hildegard's hymns translated into mathematics — the same intervals, the same reaching quality, but expressed in a language that does not require breath. Ada explained that the Engine had "discovered" the relationship between harmonic ratios and certain recursive number sequences. She did not appear surprised. "The mathematics was always there," she said. "The Engine simply had the patience to find it."

The dome ceiling opens to reveal the Cité's night sky. I should report that the constellations do not correspond to any known astronomical catalogue. Ada has mapped them. She showed me charts that cross-reference the Cité's star positions with Hildegard's mandala visions, Christine's allegorical cosmology, and a set of Bernoulli numbers whose significance she described as "almost certainly important and possibly beautiful, or possibly important and almost certainly beautiful — I haven't decided which formulation is more accurate." The chalkboard that covers the Observatory's west wall is dense with equations. Some of them appear to describe the mechanics of Bleed — the process by which Shards influence each other. If Ada has solved the mathematics of interdimensional contamination, the Bureau should be informed. If she has solved them and the mathematics turn out to be a form of music, the Bureau should probably just listen.`),
    },
    {
      id: 'the-college-of-letters',
      chapter: msg('The Inhabitants'),
      arcanum: 'IX',
      title: msg('The College of Letters — What Was Denied'),
      epigraph: msg(
        'One can perfectly well philosophize while cooking supper. Had Aristotle prepared victuals, he would have written more.',
      ),
      imageSlug: 'the-college-of-letters',
      imageCaption: msg(
        "The College of Letters — Newnham College reimagined, where Sor Juana's library has been returned to her",
      ),
      body: msg(`FIELD NOTES — Dr. Eleanor Hartley
LOCATION: The College of Letters, Quarter of Reason

The College of Letters is the Cité's educational heart — Newnham College Cambridge translated into honey stone with oriel windows and Pre-Raphaelite stained glass. The lecture halls have tiered oak benches. The laboratories contain instruments from every century simultaneously: astrolabes beside microscopes beside Ada's punch cards beside things I cannot name that appear to measure qualities for which no science yet exists.

The library is extraordinary and, from a Bureau perspective, concerning. Its catalogue includes books that have never been written. They are filed under the authors who would have written them had circumstances permitted. I found, on a lower shelf in the east reading room, a complete mathematical treatise by Emmy Noether written in 1938 — three years after she died in exile. Beside it, a novel by Virginia Woolf dated 1945. A collection of astronomical observations by Wang Zhenyi, the Qing dynasty astronomer who proved that the Earth was round and demonstrated lunar eclipses with a round table, a lamp, and a mirror — observations that in the world outside were dismissed and lost. The books are real. They are readable. They contain ideas that the world outside has not yet had.

I asked Sor Juana about this. She sits in the east wing, where her study recreates her cell at the convent of San Jerónimo in Mexico City — four thousand volumes, musical instruments, astronomical tools, and a writing desk positioned to catch the morning light. She was, in the world outside, the intellectual star of colonial New Spain: fluent by thirteen in Latin, Nahuatl, and Greek, she entered the convent not from devotion but because it offered what marriage could not: a room, a library, and time to think.

Her library of four thousand volumes was the largest in New Spain. In 1694, under pressure from the Archbishop of Mexico, she was forced to surrender every book, every instrument, every tool of thought. She signed a renewal of vows in her own blood. She died the following year, tending to her sister nuns during a plague.

In the Cité, the library has been returned to her.

She teaches with a precision that leaves no room for laziness but generous room for error. "The error is where the learning happens," she told me. "The Archbishop did not understand this. He thought that by taking my books he was taking my knowledge. But knowledge is not in the books. Knowledge is in the conversation between the reader and the page. You can burn every book in the world and you cannot burn that conversation, because it has already happened inside someone's mind, and minds are not flammable."

She quoted herself — from her Respuesta a Sor Filotea de la Cruz, the extraordinary letter of 1691 in which she defended women's intellectual rights while appearing to submit to ecclesiastical authority: "And what shall I tell you, lady, of the natural secrets I have discovered while cooking? I see that an egg holds together and fries in butter or oil, but that on the contrary it falls apart in syrup. One can perfectly well philosophize while cooking supper." Then she added, with the quiet ferocity that characterises everything she says: "Had Aristotle prepared victuals, he would have written more."

The College operates on Wollstonecraft's founding principle: the deficiency is in the education, not in the student. Admission is open. The curriculum is demanding. The gardens between the buildings are planted with herbs from Hildegard's Physica — the medical treatise that catalogues five hundred plants, animals, stones, and metals and their healing properties. The herb labels are written in Latin and in Hildegard's Lingua Ignota.

I spent a week attending lectures. Sor Juana on the relationship between secular and sacred knowledge. Ada on the philosophical implications of mechanical computation. Wollstonecraft on education as the foundation of political freedom. Sojourner Truth on the difference between knowing your rights and having them. Hildegard on viriditas — the concept she called "greening power," the creative force of the Holy Spirit flowing through all living things. "A dried-up person or a dried-up culture," Hildegard said, "loses the ability to create." The word is Latin. The concept, in the Cité, is architectural: the College's gardens are always green, even in seasons that should produce frost, because viriditas here is not a metaphor. It is the soil condition.`),
    },
    {
      id: 'the-garden-of-remembered-names',
      chapter: msg('The Inhabitants'),
      arcanum: 'X',
      title: msg('The Garden of Remembered Names — Where the Erased Return'),
      epigraph: msg(
        'We hold these truths to be self-evident: that all men and women are created equal.',
      ),
      imageSlug: 'the-garden-of-remembered-names',
      imageCaption: msg(
        'The Garden of Remembered Names — where every plant commemorates a woman erased from history',
      ),
      body: msg(`FIELD NOTES — Dr. Eleanor Hartley
LOCATION: The Garden of Remembered Names, The Field of Letters

The Garden is a residential quarter built around a walled garden in the style of the Ladies of Llangollen — Eleanor Butler and Sarah Ponsonby, who from 1780 to 1829 maintained a life of shared intellectual companionship in a cottage called Plas Newydd in Llangollen, Wales. They read Rousseau and Marie de Sévigné in the original French. They taught themselves Italian and Spanish to read Dante and Cervantes. They entertained thirty visitors in a single day. Wordsworth wrote them a sonnet. The Duke of Wellington visited regularly. They were called "the two most celebrated virgins in Europe" by a Prussian prince, a description that says more about the prince than about them.

Their principle — that a home built for companionship rather than display is the most radical architecture — informs the Garden entirely. The cottages are honey stone covered in climbing roses, wisteria, and jasmine. Each garden is tended by its residents. The paths are gravel, edged with lavender. The air smells of herbs, flowers, and bread from the communal kitchen.

Every plant commemorates a woman whose name was erased from history. The labels are written in the copperplate hand of someone who considers taxonomy a form of justice.

I copied a selection:

— Rosalind Franklin's Double Helix Vine (Helixis franklinia): "Contributed the X-ray crystallography that proved the helical structure of DNA. The Nobel Prize was awarded to Watson, Crick, and Wilkins."

— Nettie Stevens's Chromosome Fern (Pteris stevensii): "Discovered that sex is determined by the X and Y chromosomes (1905). The credit went to Edmund Beecher Wilson."

— Lise Meitner's Fission Lily (Lilium meitneria): "Provided the theoretical explanation for nuclear fission (1939). Otto Hahn received the Nobel Prize. Meitner was nominated 48 times and never won."

— Mileva Marić's Relativity Rose (Rosa mariciana): "Einstein's first wife and fellow physics student. The extent of her contribution to his early papers remains debated, which is itself the point."

— Jocelyn Bell Burnell's Pulsar Aster (Aster burnelliae): "Discovered the first radio pulsars in 1967 as a graduate student. The Nobel Prize went to her supervisor."

There are hundreds. Each label is precise, factual, and devastating in its restraint. The Garden does not rage. It records. The recording is more powerful than rage, because rage can be dismissed as emotion, and a botanical record with dates and citations cannot.

Mary Delany's influence is everywhere. In the world outside, Mary Delany — at the age of seventy-two — invented the art of paper mosaic, producing 985 precisely accurate flower portraits (her "Flora Delineata") that remain scientifically valuable. She continued until she was eighty-eight, when her eyesight failed. In the Garden, her paper flowers appear alongside the living ones, indistinguishable at a distance, distinguishable at touch by a slight crispness that might be paper or might be age or might be the Cité's way of remembering that art and science are the same discipline practiced at different speeds.

The children of the Cité play in the Garden's paths. I am uncertain where the children come from — the Cité's demographics do not follow standard Shard population mechanics. They exist. They are loved. They are educated. They grow up in a place where every flower teaches them that the world forgot someone it should have remembered, and that remembering is something you do on purpose, with your hands in the dirt.

I have been in the field for six weeks. This report was due four weeks ago. I am aware that the Bureau will note the delay. I am also aware that the Bureau may question whether my extended stay in the Cité has compromised my objectivity. It has. I no longer believe objectivity is the correct instrument for studying a city built from memory and populated by women whose defining characteristic is that they refused to be objects. I offer instead accuracy, which is harder.`),
    },
    {
      id: 'literate-contamination',
      chapter: msg("The Cartographer's Confession"),
      arcanum: 'XI',
      title: msg('Literate Contamination — What Cannot Be Unread'),
      epigraph: msg(
        'You cannot unread a book. You can burn it, but the reader has already changed.',
      ),
      imageSlug: 'literate-contamination',
      imageCaption: msg(
        'Literate Contamination — books appearing unbidden on shelves across the multiverse',
      ),
      body: msg(`FINAL ENTRY — Dr. Eleanor Hartley
CLASSIFICATION: PERSONAL — NOT FOR BUREAU ARCHIVE
(They will archive it anyway. That is what bureaucracies do. Let the record show I tried.)

The Bureau classifies the Cité des Dames as a Literate Contamination Vector. The designation is accurate. It is also, I have come to believe, a compliment the Bureau did not intend.

Literate Contamination operates as follows: when the Cité's Bleed touches adjacent Shards, agents begin finding books on their shelves that were not there before. Books by authors who do not exist in their world. Books arguing for things their societies have never considered. A treatise on the rights of citizens appears on a Velgarien bureaucrat's desk and he spends three days trying to classify it before realising he agrees with it. A volume of poetry surfaces in a Capybara Kingdom archive and reduces the archivist to tears in a language she has never learned. A mathematical proof materialises in Station Null's data core and the AI cannot determine whether it was generated internally or received from outside — because the proof is correct, and correctness has no origin.

The Bureau considers this untreatable. They are right. You cannot unread a book. You cannot unknow what you have learned. You can suppress the knowledge, but suppression requires energy, and energy is finite, and the books keep appearing. The Cité's Bleed is patient. It has the patience of six hundred years of women writing things down and having them dismissed and writing them down again.

I should confess — and I use the word deliberately, because confession is the only honest genre available to me at this point — that I found a book on my own shelf. In my quarters, in my field station, in the Bureau's administrative compound three Shards away from the Cité. The book was small. Leather-bound. Titled: "A Field Report That Became a Love Letter: On the Impossibility of Studying the Cité des Dames Without Being Changed by It." The author was listed as Dr. Eleanor Hartley.

I have not written this book. I have not yet written this book.

The Cité does not conquer. It does not colonise. It does not impose. It offers. It offers books. It offers music — Hildegard's hymns carrying across Bleed boundaries. It offers arguments — Wollstonecraft's Vindication appearing in translation in worlds that have no concept of vindication. It offers names — the stones of the city wall appearing in the dreams of archivists who wake up weeping and cannot explain why.

And it offers, most dangerously of all, the question that Christine asked in 1404 and that the Cité continues to ask of every Shard it touches: Why? Why have you built your world this way? Who decided? Who was silenced? What would your world look like if you had listened?

The Bureau does not like questions. The Bureau likes data, classification, containment. The Cité cannot be contained. Not because it is powerful — though it is — but because containment requires that the thing being contained stays still, and the Cité grows. Every time someone, anywhere in the multiverse, remembers a woman who was erased, the Cité adds a stone. The city is always being built. The walls are always rising. The Gate of Justice is always open.

I am returning my Bureau credentials. I am staying.

Not because the Cité has contaminated me — though it has, and gladly, and the contamination feels like clarity — but because I have a name to write in the register at the Gate. My grandmother's name. She was a mathematician who became a schoolteacher because the university would not have her. She taught me to count. She taught me that counting is a form of attention, and attention is a form of love.

Her name is in the book now. Her name is in the wall now.

Dr. Eleanor Hartley
Former Senior Cartographer, Bureau of Impossible Geography
Current Resident, The Garden of Remembered Names
Cité des Dames

P.S. The book on my shelf has acquired a second chapter.`),
    },
  ];
}
