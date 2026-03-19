/**
 * /perspectives/what-is-the-metaverse — Perspective article
 *
 * Targets: "what is the metaverse", "metaverse definition",
 * "metaverse meaning", "metaverse explained"
 *
 * References: Stephenson's Snow Crash, Baudrillard's Simulacra,
 * Deleuze's virtual/actual, MUD/MOO history, Web3 critique.
 */

import { msg } from '@lit/localize';
import { html } from 'lit';

import type { ContentPageData } from '../content-types.js';

export function getWhatIsTheMetaversePage(): ContentPageData {
  return {
    type: 'perspective',
    slug: 'perspectives/what-is-the-metaverse',

    seo: {
      title: [msg('What Is the Metaverse?'), msg('Beyond Corporate Hype')],
      description: msg(
        'From Stephenson\u2019s Snow Crash to Baudrillard\u2019s simulacra \u2014 a literary and philosophical exploration of what the metaverse actually means, beyond corporate buzzwords and failed VR demos.',
      ),
      canonical: '/perspectives/what-is-the-metaverse',
    },

    hero: {
      classification: msg('Bureau Perspective'),
      title: msg('What Is the Metaverse?'),
      subtitle: msg('A question worth asking carefully'),
      byline: msg('Bureau of Impossible Geography'),
      datePublished: '2026-03-19',
      readTime: msg('10 min read'),
    },

    breadcrumbs: [
      { name: 'Home', url: 'https://metaverse.center/' },
      { name: 'Perspectives', url: 'https://metaverse.center/perspectives/what-is-the-metaverse' },
      { name: 'What Is the Metaverse?', url: 'https://metaverse.center/perspectives/what-is-the-metaverse' },
    ],

    sections: [
      {
        id: 'snow-crash',
        tocLabel: msg('Snow Crash'),
        number: '01',
        title: msg('The Word Itself'),
        content: html`
          <p>
            ${msg('The term "metaverse" was coined by Neal Stephenson in Snow Crash (1992). In the novel, the Metaverse is a virtual urban landscape \u2014 a single boulevard, the Street, one hundred meters wide and 65,536 kilometers long, circling a featureless black sphere. Users access it through personal terminals and public booths, appearing as avatars whose quality reflects their wealth and technical sophistication. Stephenson described it with the precision of a systems architect:')}
          </p>
          <blockquote>
            ${msg('"The Street does not really exist. It is a computer-rendered urban environment \u2014 or, as the Founders liked to say, a protocol. But just like any other place in Reality, the Street is subject to development."')}
            <cite>${msg('\u2014 Neal Stephenson, Snow Crash (1992)')}</cite>
          </blockquote>
          <p>
            ${msg('Three details matter. First, the Metaverse in Snow Crash is not a product \u2014 it is a protocol, an open standard. Second, it is shaped by its users, not its creators: developers buy virtual real estate and build on it, just as in physical cities. Third, social stratification persists: wealthy users have custom avatars; poor users appear in grainy black-and-white. The fiction was, from the start, a critique as much as a vision.')}
          </p>
          <p>
            ${msg('Stephenson was not the first to imagine shared virtual space. The concept traces back to Vernor Vinge\u2019s True Names (1981), in which hackers inhabit a magical realm that is actually a networked computing environment. William Gibson\u2019s Neuromancer (1984) gave us "cyberspace" \u2014 a "consensual hallucination" shared by billions. But Stephenson\u2019s contribution was specificity: he imagined the mundane infrastructure required to make shared virtual space work. Protocols. Real estate. Social hierarchy. Economic incentive.')}
          </p>
        `,
      },
      {
        id: 'textual-worlds',
        tocLabel: msg('Textual Worlds'),
        number: '02',
        title: msg('Before Graphics: The MUD Tradition'),
        content: html`
          <p>
            ${msg('Before the metaverse had a name, it had text. In 1978, Roy Trubshaw created MUD1 (Multi-User Dungeon) at the University of Essex on a DEC PDP-10 using MACRO-10 assembly language, naming it in tribute to the Dungeon variant of Zork. When Trubshaw graduated, he handed development to Richard Bartle, who would later define the four player types (Killers, Achievers, Explorers, Socializers) that still shape game design. MUD1 became the first internet multiplayer RPG when Essex connected to ARPANET. The technology was primitive. The concept was revolutionary: persistent, shared, user-modifiable virtual space.')}
          </p>
          <p>
            ${msg('MUDs proliferated through the 1980s and 1990s. In 1990, Pavel Curtis at Xerox PARC created LambdaMOO \u2014 a social virtual space centered on a digital recreation of Curtis\u2019s California home, where users could build rooms, create objects, and program behaviors. LambdaMOO was not a game \u2014 it was a community, complete with governance disputes and property rights debates. Its landmark moment: Julian Dibbell\u2019s "A Rape in Cyberspace" (The Village Voice, 1993) documented how a user weaponized a "voodoo doll" program to attribute violent acts to other characters. The community\u2019s response \u2014 inventing self-governance from scratch, eventually implementing democratic petitions and ballots \u2014 forced foundational questions about identity and harm in virtual space that remain unresolved. Lawrence Lessig has cited this essay as a key influence on his interest in internet law.')}
          </p>
          <p>
            ${msg('This history matters because it demonstrates that shared virtual worlds do not require photorealistic graphics, VR headsets, or blockchain infrastructure. They require persistent state, user agency, and social context. The MUD tradition proved that world and text could be enough \u2014 that narrative generates presence more effectively than pixels.')}
          </p>
        `,
      },
      {
        id: 'simulacra',
        tocLabel: msg('Simulacra'),
        number: '03',
        title: msg('The Map Before the Territory'),
        content: html`
          <p>
            ${msg('Jean Baudrillard saw it coming. In Simulacra and Simulation (1981), he described four successive phases of the image: it reflects a profound reality; it masks and denatures a profound reality; it masks the absence of a profound reality; and finally, it bears no relation to any reality whatsoever \u2014 it is its own pure simulacrum. The book\u2019s epigraph, attributed to Ecclesiastes, is itself a fabrication: "The simulacrum is never that which conceals the truth \u2014 it is the truth which conceals that there is none. The simulacrum is true." A fake biblical quote about the nature of fakeness. Baudrillard performing his own thesis.')}
          </p>
          <p>
            ${msg('Baudrillard borrowed from Borges the fable of the map: an empire\u2019s cartographers create a map so detailed it covers the territory exactly. In Borges\u2019s version, the map decays and the territory endures. In Baudrillard\u2019s inversion, the territory decays and the map persists \u2014 the simulation precedes and generates what we call real.')}
          </p>
          <p>
            ${msg('This philosophical framework reframes the "metaverse" question entirely. The issue is not whether virtual worlds can replicate reality \u2014 the issue is that the distinction between "virtual" and "real" was always more porous than we assumed. When a player spends hundreds of hours building a simulation, forms genuine strategic alliances, experiences real emotion at victory or betrayal \u2014 which layer is the simulacrum?')}
          </p>
        `,
      },
      {
        id: 'virtual-actual',
        tocLabel: msg('Virtual/Actual'),
        number: '04',
        title: msg('The Virtual Is Fully Real'),
        content: html`
          <p>
            ${msg('Gilles Deleuze offered a different framework. In Difference and Repetition (1968), he distinguished between the virtual and the actual \u2014 and insisted that the virtual is fully real. The virtual is not the opposite of real; it is the opposite of actual. A seed is virtual \u2014 it contains the tree in potentia, fully real though not yet actualized. The virtual is the field of differential relations and singularities from which actual things emerge.')}
          </p>
          <p>
            ${msg('This matters for how we think about digital worlds. A simulation on metaverse.center is not a lesser copy of reality. It is a virtual world in Deleuze\u2019s sense: a field of potentials that actualizes through interaction. The agents, events, and narratives are real \u2014 real in the way that a story is real, a game is real, a relationship formed through play is real. The question "is this real?" misunderstands the nature of the virtual.')}
          </p>
          <blockquote>
            ${msg('"The virtual is not opposed to the real but to the actual. The virtual is fully real in so far as it is virtual."')}
            <cite>${msg('\u2014 Gilles Deleuze, Difference and Repetition (1968)')}</cite>
          </blockquote>
        `,
      },
      {
        id: 'corporate-failure',
        tocLabel: msg('Corporate Failure'),
        number: '05',
        title: msg('Why the Corporate Metaverse Failed'),
        content: html`
          <p>
            ${msg('In October 2021, Facebook rebranded to Meta and promised to build "the metaverse" as a VR-first social platform. Horizon Worlds never exceeded approximately 200,000 monthly active users; most did not return after the first month. By 2024, Meta\u2019s Reality Labs division had accumulated over $70 billion in operating losses. In March 2026, Meta announced the VR shutdown of Horizon Worlds entirely \u2014 removed from the Quest store by month\u2019s end, fully discontinued by June 2026. Microsoft shuttered its industrial metaverse initiatives. Disney dissolved its metaverse division.')}
          </p>
          <p>
            ${msg('Why did corporate metaverse projects fail? Three reasons. First, they prioritized technology (VR headsets, 3D rendering) over the social dynamics that make shared spaces meaningful. Second, they centralized control in corporate platforms rather than building open protocols. Third \u2014 and most fundamentally \u2014 they assumed the metaverse is a place to visit, rather than a world to inhabit.')}
          </p>
          <p>
            ${msg('The distinction is critical. A place you visit offers experiences curated by its owners. A world you inhabit gives you agency \u2014 the ability to create, modify, and leave your mark. MUDs understood this in 1978. Stephenson understood it in 1992. The corporate metaverse forgot it in 2021.')}
          </p>
        `,
      },
      {
        id: 'what-works',
        tocLabel: msg('What Works'),
        number: '06',
        title: msg('What a Metaverse Actually Needs'),
        content: html`
          <p>
            ${msg('Strip away the hype and the philosophy, and a functional metaverse requires four things:')}
          </p>
          <p>
            <strong>${msg('Persistent state.')}</strong>
            ${msg('The world must remember. Changes made by users must endure. Characters must accumulate experience. Buildings must age. Events must have consequences that persist beyond the session in which they occurred.')}
          </p>
          <p>
            <strong>${msg('User agency.')}</strong>
            ${msg('Inhabitants must be able to shape the world. Not just customize avatars or decorate rooms \u2014 but create characters, generate events, establish institutions, and alter the narrative trajectory of the space they inhabit.')}
          </p>
          <p>
            <strong>${msg('Social context.')}</strong>
            ${msg('Shared space is meaningless without shared meaning. Communities, alliances, rivalries, and collective memory transform a database of objects into a world. The MUD tradition proved that text is enough if the social context is rich.')}
          </p>
          <p>
            <strong>${msg('Narrative coherence.')}</strong>
            ${msg('A world must feel like a world \u2014 internally consistent, capable of surprising its inhabitants, generating stories that matter to the people who live in them. This is Tolkien\u2019s Secondary Belief applied to interactive space.')}
          </p>
          <p>
            ${msg('metaverse.center is built on these four principles. AI provides the narrative coherence at scale. Persistent simulation state provides the memory. User-created worlds provide the agency. Competitive epochs and cross-world connections provide the social context. No VR headset required. No blockchain. No corporate platform owner. Just worlds, and the people who build them.')}
          </p>
        `,
      },
    ],

    faqs: [
      {
        question: msg('What is the metaverse?'),
        answer: msg(
          'The metaverse is a concept of persistent, shared virtual spaces where users can create, interact, and build communities. Coined by Neal Stephenson in Snow Crash (1992), it predates corporate VR initiatives by decades. At its core, a metaverse requires persistent state, user agency, social context, and narrative coherence.',
        ),
      },
      {
        question: msg('Is metaverse.center a VR platform?'),
        answer: msg(
          'No. metaverse.center is a browser-based platform focused on AI-powered worldbuilding and competitive strategy. The MUD tradition demonstrated that rich virtual worlds don\u2019t require VR \u2014 they require persistent state, user agency, and meaningful social dynamics.',
        ),
      },
      {
        question: msg('Why did corporate metaverse projects fail?'),
        answer: msg(
          'Corporate metaverse projects (Meta\u2019s Horizon Worlds, Microsoft\u2019s industrial metaverse) prioritized VR technology over social dynamics, centralized control rather than building open systems, and treated the metaverse as a place to visit rather than a world to inhabit.',
        ),
      },
      {
        question: msg('What is the difference between a metaverse and a virtual world?'),
        answer: msg(
          'A virtual world is a single persistent digital space. A metaverse implies interconnection \u2014 multiple worlds linked together with shared protocols, cross-world interaction, and collective narrative. metaverse.center\u2019s multiverse system connects simulations through dimensional corridors.',
        ),
      },
      {
        question: msg('Who coined the term metaverse?'),
        answer: msg(
          'Neal Stephenson coined "metaverse" in his 1992 novel Snow Crash. In the novel, the Metaverse is a virtual urban environment \u2014 specifically, a protocol (an open standard), not a corporate product. Users access it through terminals and appear as avatars.',
        ),
      },
    ],

    ctas: [
      {
        label: msg('Explore Worlds'),
        href: '/worlds',
        variant: 'primary',
      },
      {
        label: msg('AI Worldbuilding'),
        href: '/perspectives/ai-powered-worldbuilding',
        variant: 'secondary',
      },
      {
        label: msg('Digital Sovereignty'),
        href: '/perspectives/digital-sovereignty',
        variant: 'secondary',
      },
    ],

    structuredData: {
      articleType: 'Article',
      datePublished: '2026-03-19',
      dateModified: '2026-03-19',
      wordCount: 1850,
    },
  };
}
