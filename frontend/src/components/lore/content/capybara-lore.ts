import { msg } from '@lit/localize';
import type { LoreSection } from '../../platform/LoreScroll.js';

/**
 * The Capybara Kingdom — Sunless Sea Fantasy
 * Voice: Scholarly treatises, natural history catalogues, archival marginalia, poetic field notes
 * Inspirations: Fallen London / Sunless Sea, Gormenghast, Victorian natural history, Miyazaki
 */
export function getCapybaraLoreSections(): LoreSection[] {
  return [
    {
      id: 'nature-of-unterzee',
      chapter: msg('The Unterzee — Waters Without a Sky'),
      arcanum: 'I',
      title: msg('On the Nature and Disposition of the Unterzee'),
      epigraph: msg(
        'The sea does not care that it is underground. It was a sea before there was a sky, and it will be a sea long after the concept of "above" has been forgotten.',
      ),
      imageSlug: 'nature-of-unterzee',
      imageCaption: msg(
        'The Unterzee — Vast, lightless, and profoundly indifferent to cartography',
      ),
      body: msg(`FROM: A Natural History of the Subterranean Waters
BY: Head Archivist Barnaby Gnaw, Fellow of the Deep Library, Keeper of Damp Knowledge
EDITION: Fourteenth (Revised, Expanded, and Partially Eaten by Cave-Moths)

Let us begin, as all proper natural histories must, with a correction. The Unterzee is not underground. The Unterzee is beneath — a distinction that may seem academic until you have spent, as I have, forty-seven years cataloguing the difference between "below the earth" and "below everything else." The earth, you see, is a specific thing: soil, stone, the compressed memory of dead organisms. The Unterzee is beneath something far more fundamental. It is beneath *assumption*. It is the place you arrive at when you have descended past all the layers of the world that pretend to be solid and discovered, at the bottom of that pretence, a body of water so vast, so ancient, and so utterly disinterested in the affairs of the surface that it makes the oceans above look like enthusiastic puddles.

The water is dark. Not dark in the way of a room without candles — that is merely an absence. The darkness of the Unterzee is a *presence*. It is the colour that black wants to be when it grows up. Commodore Whiskers, the finest naval mind the Kingdom has produced (and this is not flattery; the Commodore would bite me if she thought I was flattering her, and her teeth are, as all capybara teeth are, superb), once described the water as "the visible form of patience." She was three days into a crossing of the Phosphorescent Expanse at the time, and her navigator had just informed her that the stars they were steering by did not correspond to any known constellation and might, in fact, be fish.

The Unterzee has no tides. It has currents — vast, slow movements of water that follow paths established before the capybara people evolved thumbs, which we did, I should note, specifically to hold cataloguing instruments. These currents are warm in some passages and cold in others, and the boundary between warm and cold is so precise that one can stand a thermometer in the water and watch the mercury argue with itself. The warm currents carry nutrients from the fungal forests of the Luminous Reaches. The cold currents come from the Abyssal Trenches, where the water is not merely cold but *philosophically* cold — a temperature that calls into question whether warmth was ever more than a temporary condition.

There are things in the water. I will not catalogue them here — that is the purpose of my companion volume, A Bestiary of the Improbable (Third Edition, Available From the Deep Library, Price: One Interesting Secret). But I will say this: the Unterzee is not empty. It has never been empty. The creatures that live in it were there before us, and they regard our presence with the same mild curiosity that a mountain regards the lichen on its surface. We are a recent development. The Unterzee is patient. It has seen civilisations come and go like weather patterns, and it will be here, dark and vast and faintly phosphorescent, long after we have joined the fossils in the limestone.

This is not pessimism. This is geology. And geology, as every Archivist knows, is merely history with better handwriting.`),
    },
    {
      id: 'cartography-of-darkness',
      chapter: msg('The Unterzee — Waters Without a Sky'),
      arcanum: 'II',
      title: msg('A Cartography of Darkness — Navigating the Lightless Waters'),
      epigraph: msg('A map of the Unterzee is a confession of ignorance drawn very carefully.'),
      imageSlug: 'cartography-of-darkness',
      imageCaption: msg(
        'Subterranean waterways — Where the current knows paths that the navigator does not',
      ),
      body: msg(`FROM: Proceedings of the Royal Cartographic Society, Vol. CXIV
PRESENTED BY: Navigator-Cartographer Sedge, Formerly of the Survey Vessel Obstinate
OCCASION: The Annual Lecture on Things We Have Failed to Map

Distinguished colleagues, damp friends, and any cave-moths that have infiltrated the lecture hall (you are tolerated but not welcomed; please do not eat the slides),

I stand before you to present the findings of the Seventeenth Unterzee Survey, which departed from Deepreach Harbour fourteen months ago with a crew of thirty-two, a cargo of mapping instruments, and the quiet confidence of scholars who believed they understood water. We returned with a crew of thirty-two — all present, all healthy, all profoundly confused — and a collection of charts that I can only describe as "aggressively speculative."

The Unterzee does not wish to be mapped. I do not mean this poetically. I mean that the water resists measurement with a consistency that suggests intent. Our sonar returned echoes from surfaces that were not there when we sent divers to verify. Our depth measurements in the Phosphorescent Expanse varied by up to forty metres between morning and afternoon readings, with no corresponding change in water level. In the Whispering Strait — so named because the acoustic properties of the limestone produce a sound that the crew unanimously described as "someone trying to tell you something important in a language you almost understand" — our compass pointed in six directions simultaneously, which should not be possible and yet was confirmed by three independent instruments, all of which we subsequently dismantled and found to be in perfect working order.

The Kingdom's navigators have known for generations that the Unterzee's geography is — and I choose this word with scholarly precision — *moody*. Passages that are wide enough for a three-mast vessel one month may be barely navigable by kayak the next. Islands appear, persist for a season, and vanish, leaving behind only a faint phosphorescent stain on the water and a sense of loss in the crew that defies rational explanation. The Luminous Reaches expand and contract like breathing. The Abyssal Trenches have been measured at seven different depths in seven different surveys, and the leading hypothesis — which I present to you now with no enthusiasm whatsoever — is that all seven measurements are correct, and the Trench simply occupies multiple depths at once, like a note struck on a piano that resonates at harmonics the ear cannot separate.

And yet we map. We have always mapped. The capybara people are, if nothing else, compulsive documentarians. We catalogue what we cannot understand because the act of cataloguing is itself a form of understanding — not of the thing, but of our relationship to it. A map of the Unterzee does not tell you where things are. It tells you where things were, on a particular day, as perceived by a particular navigator, who was almost certainly lost at the time. This is not a failure of cartography. This is cartography's highest achievement: the honest representation of uncertainty.

Commodore Whiskers, when shown our latest charts, studied them for twenty minutes, traced a route that existed on no version of the map, and set sail the following morning. She arrived exactly where she intended. When asked how she navigated waters we had just proven were unmappable, she said: "I asked the current." She did not elaborate. The current, apparently, does not require footnotes.`),
    },
    {
      id: 'capybara-compact',
      chapter: msg('The Kingdom — A Commonwealth of Whiskers'),
      arcanum: 'III',
      title: msg('A Brief History of the Capybara Compact'),
      epigraph: msg(
        'We did not choose to live underground. We chose to make underground a place worth living.',
      ),
      imageSlug: 'capybara-compact',
      imageCaption: msg(
        'The Chamber of Accord — Where the Compact was first spoken, and is spoken still',
      ),
      body: msg(`FROM: A Political History of the Capybara Kingdom
BY: Archivist-Emeritus Hazel Burrow, Department of Governmental Memory
EDITION: Ninth (the definitive edition, she insists, though the tenth is already in draft)

The founding of the Capybara Kingdom is not recorded in any document, because the founding predates documents. It is recorded in the limestone — in claw-marks on the walls of the First Chamber, where the original Compact was spoken (not written; the capybara people have always preferred the spoken word, which can be amended in real time, unlike text, which sits there smugly being wrong until someone corrects it).

The Compact is simple. It has three articles, though "articles" implies a formality that the original speakers — a group of approximately forty capybaras who had discovered the entrance to the Unterzee while fleeing a flood on the surface — would have found absurd.

ARTICLE ONE: We share. Food, warmth, labour, knowledge, and the last dry sleeping spot near the thermal vents. Hoarding is not forbidden because we do not forbid things. Hoarding is simply incomprehensible. Why would you keep a thing for yourself when there are others who are cold?

ARTICLE TWO: We remember. The Archivists exist because forgetting is a luxury the Unterzee does not permit. Down here, in the dark, memory is infrastructure. It is how we navigate, how we avoid the dangers the water conceals, how we honour those who went into the Abyssal Trenches and did not return. To forget is to become lost, and to become lost in the Unterzee is to become something the Unterzee absorbs.

ARTICLE THREE: We stay. The surface cast us out — whether by flood, by famine, or by the slow catastrophe of a world that was breaking apart in ways the surface-dwellers could not yet perceive. We descended. We adapted. We made the darkness liveable, not by conquering it but by learning its rhythms, its moods, its preferences. The Unterzee does not want to be conquered. It wants to be understood. And understanding, in the capybara tradition, begins with sitting quietly in the water and listening.

The Kingdom grew around these three principles. Deepreach, the capital, began as a series of connected chambers where the limestone had been carved by water into shapes that resembled, if you squinted (and capybaras are excellent squinters), a palace. The capybara people did not build Deepreach so much as they *agreed with* it — they saw what the stone was trying to be and helped it get there. Architecture in the Kingdom is always a collaboration between the builder and the built-upon.

The Parliament of Whiskers — the governing body, which meets in the Great Grotto on the first day of each lunar cycle (the Unterzee has no moon, but the tides remember one, and we find this sufficient) — operates by consensus. This makes governance slow, argumentative, and occasionally interrupted by someone falling asleep in the warm water at the centre of the Grotto, which is considered a valid form of dissent. The system works because capybaras are, by nature, patient. We outlasted a flood. We can outlast a committee meeting.

Some surface scholars have expressed surprise that a civilisation of capybaras — large, semi-aquatic rodents, as they condescendingly remind us — could produce a stable political system, a literary tradition, and a navy. To these scholars I say: you have confused size with significance. The capybara is the largest rodent in the world, and the Unterzee is the largest body of water beneath it. We fit. We have always fit. The universe made a space the shape of us, and we had the good sense to occupy it.`),
    },
    {
      id: 'archives-of-deep',
      chapter: msg('The Archives — Memory in the Dark'),
      arcanum: 'IV',
      title: msg("The Archives of the Deep — A Librarian's Lament"),
      epigraph: msg(
        'The books are damp. The books have always been damp. If you wanted dry knowledge, you should have stayed on the surface.',
      ),
      body: msg(`FROM: Marginalia in the catalogue of the Deep Library
BY: Junior Archivist Nettle, who was supposed to be reshelving but instead started writing and could not stop

I have been in the Deep Library for four years now, and I can say with scholarly confidence that it is the most extraordinary, infuriating, beautiful, and fundamentally impossible institution in the Kingdom, and possibly in whatever remains of the world above.

The Library occupies seventeen chambers connected by passages that the original architects — if there were original architects; the Library may have simply grown, like everything else down here — carved into the living rock at angles that suggest either brilliance or lunacy. The shelves are limestone, the books are written on treated fungal-membrane (waterproof, luminescent, and faintly aromatic — the scent of old knowledge, which smells, for the record, like wet stone and ambition), and the catalogue is maintained by the Archivists through a system of cross-referencing so elaborate that understanding it is itself a seven-year course of study.

Head Archivist Barnaby Gnaw has been in charge since before I was born, and possibly before several of my ancestors were born. He is very old. How old is classified — not for security reasons, but because Gnaw considers age to be "a private matter between oneself and one's joints." He moves slowly, speaks slowly, and thinks so far ahead that his current research project is a response to a question he expects someone to ask in thirty years. He has never been wrong about this. The Library's reference section contains twelve volumes written by Gnaw in response to questions that had not yet been asked, all of which were eventually asked, and all of which the volumes answered correctly.

The Library's collection spans everything the capybara people have ever known, suspected, imagined, or overheard while floating in a thermal pool after too much fermented lichen-wine. It includes: natural histories, navigational charts, philosophical treatises, poetry (we are prolific poets; the Unterzee inspires verse the way the surface inspires sunburn), engineering manuals, cookbooks, diplomatic correspondence with kingdoms that may or may not exist, and one shelf — the Restricted Shelf, locked behind a door that opens only for Gnaw and for the door's own amusement — that contains books the Library did not acquire.

These are the Stranded Volumes. They appear on the shelves without explanation, written in languages that no Archivist can fully translate, describing places that do not exist in the Unterzee — or that do not exist *yet*. Gnaw has catalogued forty-seven Stranded Volumes over his career. Each describes a different world. Several describe the same world from contradictory perspectives. One describes a world that is, unmistakably, the surface — but a version of the surface that has been fractured, broken into separate realities like a mirror dropped from a great height. Gnaw read this volume three times and then placed it on the Restricted Shelf with the note: "Accurate but unhelpful. File under: Things We Cannot Fix."

The youngest Stranded Volume appeared six months ago. It is written in a hand that Gnaw recognises as his own — but a version of his handwriting that has not yet developed, as though it were written by a future Gnaw who had learned something the current Gnaw has not. The volume's title, translated roughly, is: *On the Inevitability of Doors Between Worlds, and Why We Should Not Open Them, and Why We Will.*

Gnaw has not opened it.
Gnaw will.
The Library knows this. The Library has always known this.
That is why it sent the book.`),
    },
    {
      id: 'luminescent-phenomena',
      chapter: msg('The Luminescence — Light in the Abyss'),
      arcanum: 'V',
      title: msg('A Catalogue of Luminescent Phenomena'),
      epigraph: msg(
        'The Unterzee is not dark. The Unterzee glows. You simply have to learn which light to trust.',
      ),
      body: msg(`FROM: Proceedings of the Royal Society of Natural Philosophers, Special Issue
BY: Dr. Fennel Brighttooth, Chair of Bioluminescence Studies, University of Deepreach
SUPPLEMENTARY NOTES BY: Commodore Whiskers (unsolicited but tolerated)

The Unterzee produces its own light. This is perhaps the first and most important thing for any surface-dweller (or any young capybara venturing beyond the thermal pools for the first time) to understand. There is no sun beneath the stone. There is no moon, no stars, no fire in the traditional sense. And yet the Unterzee is not dark. It *glows* — in patterns so varied, so beautiful, and so thoroughly resistant to systematic study that I have dedicated my career to cataloguing them and have managed, in thirty years, to classify approximately nine percent.

The primary source of light is the fungal forests of the Luminous Reaches — vast networks of mycelium that colonise the limestone walls and produce a soft, steady, blue-green glow that the Kingdom uses as its baseline illumination. This light is reliable, consistent, and faintly warm, and it has the peculiar property of making everything it touches look slightly more beautiful than it is. The architects of Deepreach designed the capital's public spaces to maximise fungal-light, and the result is a city that appears to be carved from jade and starlight, which is poetically accurate even if scientifically imprecise.

Beyond the fungal forests, the classification becomes complicated.

There are the Phosphorescent Tides — periodic waves of blue-white light that sweep through the open Unterzee at irregular intervals, illuminating vast stretches of water for minutes at a time before fading. The Tides follow no predictable schedule. Navigator Sedge mapped their patterns for eleven years and concluded that they are "probably biological, possibly geological, and definitely doing it on purpose." The organisms responsible — if they are organisms — have never been captured, observed, or successfully theorised about.

There are the Signal Corals of the Strait of Whispers — stationary growths that emit bursts of amber light in sequences that the Royal Society has tentatively classified as "communication," though who is communicating with whom, and about what, remains unknown. The corals respond to the presence of capybara vessels by changing their flash patterns, which either means they are acknowledging us or warning something else about us. Both interpretations are equally supported by the data.

There are the Deep Stars — points of white light that appear at extreme depth, far below the navigable waters, in the Abyssal Trenches where the pressure would crush any vessel and the water is cold enough to crystallise thought. Commodore Whiskers, who has descended further than any other navigator and returned (a distinction she shares with no one, because everyone else who went that deep did not return), describes the Deep Stars as "exactly like the stars above, except they are below, and they are watching."

The Commodore's observation is, as usual, unsettling and almost certainly correct. The Deep Stars do not move. They do not flicker. They maintain their positions with a fixedness that implies either geological origin (luminescent mineral deposits) or intentional placement (by something that wanted light at the bottom of a lightless sea, for reasons we are not equipped to understand).

And then there is the Glow Beneath the Glow — the phenomenon I have spent the last decade studying and the one that keeps me awake at night, which is a significant commitment given that night in the Unterzee is a matter of convention rather than astronomy.

Beneath every light source in the Unterzee — beneath the fungi, beneath the phosphorescent tides, beneath the signal corals and the deep stars — there is a second light. Fainter. Older. A luminescence that does not belong to any organism, any mineral, any chemical process we can identify. It is the light of the Unterzee itself — the glow of a body of water that has been in the dark so long that it has learned to shine on its own.

This light is the colour of memory. I do not know a better way to describe it.

Some of us believe it is the last remnant of the surface sun, filtered down through kilometres of stone and water until only its ghost remains. Others believe it is something new — that the Unterzee is generating its own illumination through a process that does not exist in surface physics.

Gnaw, when I presented these findings, nodded slowly and said: "The light was here before we were. It will be here after. Your job is not to explain it. Your job is to describe it well enough that those who come after us will know what they are looking at." This is, I have come to understand, the entire philosophy of the Deep Library expressed in three sentences.

The Unterzee glows. We do not know why. We catalogue the glow anyway. This is what we do. This is what we have always done.`),
    },
    {
      id: 'current-is-strong',
      chapter: msg('The Current — What the Water Knows'),
      arcanum: 'VI',
      title: msg('The Current Is Strong Today'),
      epigraph: msg(
        'When the current changes, the Commodore changes course. She does not ask where it is going. She asks what it has seen.',
      ),
      body: msg(`FROM: Personal journal of Commodore Whiskers, undated
FOUND: In the Commodore's cabin aboard the HMS Obstinate, left open on the navigation desk
NOTE: The Commodore does not keep a journal. This entry exists anyway.

The current is strong today.

I know this the way I know most things about the Unterzee — not through instruments, not through charts, not through the careful scholarship that Gnaw and his Archivists so value and I so respect without ever quite practising. I know it through my whiskers. Capybara whiskers are sensory organs of extraordinary precision, capable of detecting vibrations in water at distances that would embarrass most sonar equipment. When I hold still and let the water move past my face, I can feel the current's mood. Not its direction — the compass handles direction, when it feels like cooperating. Its *mood*.

Today the current is restless. It comes from the direction of the Abyssal Trenches — from the deep places where the Deep Stars watch and the water remembers being something other than water. It carries a temperature signature I haven't felt before: not warm, not cold, but *different*. As though the water has passed through something that changed its fundamental nature without changing its chemistry. It is still H₂O. It is still wet. But it feels like water that has been somewhere that water should not go.

The crew does not feel it. The crew is young and enthusiastic and relies on instruments, which I do not discourage because instruments are useful and because youth needs something to trust while it learns to trust itself. Navigator Sedge feels it — she gave me a look this morning across the chart table that said, without words, "The water is strange." I nodded. We did not discuss it. There are conversations that happen between navigators that do not require language, only whiskers and the willingness to be unsettled.

I have been sailing the Unterzee for longer than most of my crew have been alive. I have navigated the Whispering Strait in absolute darkness. I have anchored at Dead-Light Reef, where the luminescence cuts out entirely and the water is so still that you can see your own reflection looking back at you with an expression you are not wearing. I have taken the Obstinate deeper than any vessel in the Kingdom's history and returned with charts that Gnaw classified as "impossible, accurate, and deeply concerning."

In all those years, I have never felt the current do what it is doing now.

It is not flowing. It is *reaching*. Like a hand extended in the dark, feeling for something it knows is there but cannot yet touch. The current has always been the Unterzee's circulatory system — blood moving through a body we swim inside. But today the blood is moving with purpose. The Unterzee is not merely circulating. It is searching.

For what? The Archivists would tell me to catalogue the phenomenon and wait for data. Gnaw would tell me that the water has been here longer than we have and probably knows what it is doing. Sedge would tell me to note the bearing and add it to the charts, because even if we don't understand it, someone after us might.

But I am a Commodore, not a scholar. My job is not to understand the Unterzee. My job is to sail it, which requires a different kind of knowledge — the kind that lives in the whiskers and the gut and the sixty years of experience that tell me, with quiet and absolute certainty, that the Unterzee is about to change.

Something is coming. Or something is leaving. Or something that was always here is waking up.

I do not know which. I do not know when. But the current is strong today, and the current does not lie.

I have ordered the crew to full watch. I have told Sedge to chart every anomaly, no matter how minor. I have written this entry in a journal I do not keep, because some things need to be written even if they should not be, and this is one of them.

The Unterzee is patient. It does not hurry. It does not warn.

But today — today it is trying to tell us something.

I am listening.

— W.`),
    },
  ];
}
