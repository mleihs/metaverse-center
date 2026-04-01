/**
 * /perspectives/virtual-civilizations — Perspective article
 *
 * Targets: "virtual civilizations", "digital cities",
 * "virtual urbanism", "AI civilization"
 *
 * References: Spengler's Decline of the West, Diamond's Guns Germs Steel,
 * Metabolist architecture, Archigram, speculative urbanism.
 */

import { msg } from '@lit/localize';
import { html } from 'lit';

import type { ContentPageData } from '../content-types.js';

export function getVirtualCivilizationsPage(): ContentPageData {
  return {
    type: 'perspective',
    slug: 'perspectives/virtual-civilizations',

    seo: {
      title: [msg('Virtual Civilizations'), msg('Architecture, Decay, and Renewal')],
      description: msg(
        'From Spengler\u2019s cyclical history to Metabolist architecture \u2014 how virtual civilizations mirror, challenge, and transcend physical urban development.',
      ),
      canonical: '/perspectives/virtual-civilizations',
    },

    hero: {
      classification: msg('Bureau Perspective'),
      title: msg('Virtual Civilizations'),
      subtitle: msg('Cities that grow, decay, and remember'),
      byline: msg('Bureau of Impossible Geography'),
      datePublished: '2026-03-19',
      readTime: msg('10 min read'),
    },

    breadcrumbs: [
      { name: 'Home', url: 'https://metaverse.center/' },
      { name: 'Perspectives', url: 'https://metaverse.center/perspectives/virtual-civilizations' },
      {
        name: 'Virtual Civilizations',
        url: 'https://metaverse.center/perspectives/virtual-civilizations',
      },
    ],

    sections: [
      {
        id: 'cyclical-history',
        tocLabel: msg('Cyclical History'),
        number: '01',
        title: msg('Civilizations as Organisms'),
        content: html`
          <p>
            ${msg('Oswald Spengler published the first volume of The Decline of the West in 1918, proposing that civilizations are organisms with biological lifecycles. "Every Culture passes through the age-phases of the individual man," he wrote. "Each has its childhood, youth, manhood and old age." Each civilization \u2014 Classical, Magian, Faustian \u2014 passes through these stages inevitably. Spengler\u2019s decisive distinction: Kultur is the living, creative phase, "a thing-becoming, full of inner potentiality." Zivilisation is the terminal phase: "the thing-become succeeding the thing-becoming, death following life, rigidity following expansion." He argued that Western civilization had entered its winter.')}
          </p>
          <p>
            ${msg('The model is deterministic and its predictions questionable. But Spengler\u2019s core insight \u2014 that civilizations have internal dynamics that drive transformation independent of individual human agency \u2014 resonates with what we observe in complex simulation systems. On metaverse.center, simulations exhibit lifecycle patterns: periods of rapid growth as new agents and buildings are added, maturation as social dynamics stabilize, and transformation when competitive pressures or cross-world bleed events disrupt established patterns.')}
          </p>
          <p>
            ${msg('Unlike Spengler\u2019s biological determinism, however, virtual civilizations are not bound to decline. They can be renewed, redirected, or even resurrected. The creator retains agency over the arc of their world \u2014 decay is a choice, not a fate.')}
          </p>
        `,
      },
      {
        id: 'environmental-determinism',
        tocLabel: msg('Geography'),
        number: '02',
        title: msg('Geography as Destiny'),
        content: html`
          <p>
            ${msg('Jared Diamond argued in Guns, Germs, and Steel (1997) that the broad patterns of human history are determined not by cultural superiority but by environmental factors: the availability of domesticable plants and animals, the orientation of continental axes (east-west vs. north-south), and the distribution of natural barriers. Geography shapes destiny by constraining the possibilities available to the civilizations that develop within it.')}
          </p>
          <p>
            ${msg('Diamond\u2019s environmental determinism has been criticized for oversimplification, but the underlying principle is sound: constraints shape development. On metaverse.center, the constraints are chosen. When a creator defines a simulation\u2019s geography, climate, and resource distribution, they are establishing the environmental parameters that will shape how the civilization develops. A world built on volcanic islands produces different social dynamics than one built on vast plains.')}
          </p>
          <p>
            ${msg('The multiverse adds another layer of geographical logic. Simulations that occupy central positions in the connection network \u2014 hubs with many dimensional corridors \u2014 experience more cross-world bleed events, more cultural exchange, and more strategic pressure. Peripheral worlds are more isolated but also more autonomous. Topology is destiny, even in digital space.')}
          </p>
        `,
      },
      {
        id: 'metabolist',
        tocLabel: msg('Metabolism'),
        number: '03',
        title: msg('Cities as Living Organisms'),
        content: html`
          <p>
            ${msg('In 1960, at the World Design Conference in Tokyo, a group of Japanese architects published a ninety-page manifesto. Its opening declaration: "We regard human society as a vital process, a continuous development from atom to nebula. The reason why we use such a biological word, the metabolism, is that we believe design and technology should be a denotation of human vitality." Kenzo Tange envisioned Tokyo Bay spanned by a linear megastructure. Kisho Kurokawa built the Nakagin Capsule Tower (1972) \u2014 140 prefabricated capsules plugged into concrete towers, each designed to be individually replaceable. Fumihiko Maki developed "group form" \u2014 urban structures that grow organically rather than following master plans.')}
          </p>
          <p>
            ${msg('The Metabolists \u2014 all teenagers in 1945 when Hiroshima and Nagasaki were destroyed \u2014 understood something that Western urban planners often missed. "Devastatingly aware of the impermanence of built spaces and the destructibility of cities," as architectural historians have noted, they responded not with nostalgia but with radical acceptance: cities are not static artifacts. They are processes. A building is not a permanent object but a temporary arrangement of resources. The city\u2019s identity is not in its physical form but in its organizational pattern \u2014 "the metropolis would be a verb rather than a noun."')}
          </p>
          <p>
            ${msg('Virtual cities on metaverse.center are inherently metabolist. Buildings have condition states that degrade and improve. Agent populations fluctuate. Events reshape the social landscape. The chronicle system provides institutional memory \u2014 ensuring that the city remembers its transformations even as it undergoes them. Unlike physical cities, virtual cities can grow, shrink, and reorganize without the friction of concrete and steel.')}
          </p>
        `,
      },
      {
        id: 'archigram',
        tocLabel: msg('Archigram'),
        number: '04',
        title: msg('Impossible Architecture Made Possible'),
        content: html`
          <p>
            ${msg('While the Metabolists worked in Japan, Archigram was dreaming in London. Peter Cook\u2019s Plug-in City (1964) proposed a megastructure framework into which standardized living and working units could be inserted and removed by crane. Ron Herron\u2019s Walking City (1964) imagined massive robotic structures that could roam the earth, docking with other walking cities to form temporary metropolises. Michael Webb\u2019s Cushicle (1966\u201367) reduced architecture to a wearable environment suit.')}
          </p>
          <p>
            ${msg('Archigram\u2019s projects were deliberately unbuildable. That was the point. By proposing architecture freed from the constraints of gravity, materials, and economics, they explored what cities could be if imagination were the only building material. Walking cities challenged the assumption that location is fixed. Plug-in cities challenged the assumption that buildings are permanent. Instant City \u2014 a traveling event infrastructure that could land on any town and temporarily transform it \u2014 challenged the assumption that the urban and the rural are stable categories.')}
          </p>
          <p>
            ${msg('In virtual space, Archigram\u2019s impossibilities become possibilities. A simulation\u2019s architecture can be as speculative as its creator imagines: buildings on stilts over void, cities that reconfigure themselves in response to social dynamics, structures that dissolve and reform with each epoch cycle. The constraints of physical architecture are replaced by the constraints of narrative logic \u2014 buildings must make sense within their world, but that world\u2019s physics are chosen, not given.')}
          </p>
          <blockquote>
            ${msg('"We are in pursuit of an idea, a new vernacular, something to stand alongside the capsule, the ## rocket, the telstar, the computer."')}
            <cite>${msg('\u2014 Peter Cook, Archigram (1964)')}</cite>
          </blockquote>
        `,
      },
      {
        id: 'digital-urbanism',
        tocLabel: msg('Digital Urbanism'),
        number: '05',
        title: msg('What Virtual Cities Teach Us'),
        content: html`
          <p>
            ${msg('Virtual civilizations are not simply digital copies of physical ones. They are laboratories for exploring urban and social dynamics freed from physical constraints. When buildings can be created and destroyed instantly, what does "architecture" mean? When populations can be generated by AI, what does "community" mean? When history is recorded by machine rather than fallible human memory, what does "heritage" mean?')}
          </p>
          <p>
            ${msg('Each simulation on metaverse.center is an experiment in these questions. Some creators build meticulously planned cities with logical zoning and infrastructure. Others allow organic growth, watching how agent behavior shapes the urban landscape. Some create worlds specifically designed for competitive Epochs \u2014 military architecture, defensible positions, intelligence networks. Others create contemplative spaces focused on narrative richness and cultural depth.')}
          </p>
          <p>
            ${msg('The diversity is the point. Every civilization is a hypothesis about how societies organize themselves, tested against the unpredictable behavior of AI agents and the strategic pressure of other players. Spengler\u2019s determinism breaks down when the creator can intervene. Diamond\u2019s environmental constraints become design choices. The Metabolists\u2019 vision of organic urban growth becomes default behavior rather than radical proposal.')}
          </p>
        `,
      },
      {
        id: 'build-yours',
        tocLabel: msg('Build Yours'),
        number: '06',
        title: msg('Your Civilization Awaits'),
        content: html`
          <p>
            ${msg('Spengler watched civilizations rise and fall over millennia. The Metabolists waited decades for their visions to be built (most were not). Archigram\u2019s walking cities remain paper dreams. On metaverse.center, you can build a civilization in an afternoon and watch it evolve overnight.')}
          </p>
          <p>
            ${msg('What kind of city will yours be? A fortress built for competitive dominance? A cultural haven that generates stories faster than its chronicle can report them? An experimental commune that tests the limits of AI social dynamics? A sprawling multiverse hub connected to a dozen other worlds, pulsing with cross-dimensional traffic?')}
          </p>
          <p>
            ${msg('Every civilization starts with a choice. The Simulation Forge is ready when you are.')}
          </p>
        `,
      },
    ],

    faqs: [
      {
        question: msg('What is a virtual civilization?'),
        answer: msg(
          'A virtual civilization is a simulated society with AI-powered characters, evolving architecture, social dynamics, and narrative history. On metaverse.center, each simulation is a civilization that grows, changes, and tells its own story.',
        ),
      },
      {
        question: msg('How do virtual cities evolve?'),
        answer: msg(
          'Buildings have condition states that change based on events and activity. Agent populations fluctuate. Social dynamics shift in response to events. The chronicle system records the city\u2019s history. Unlike physical cities, virtual cities can transform without material constraints.',
        ),
      },
      {
        question: msg('What is Metabolist architecture?'),
        answer: msg(
          'A 1960s Japanese architectural movement proposing that cities should be designed as living organisms with replaceable components. Metabolist principles \u2014 organic growth, component replacement, adaptive form \u2014 describe how virtual cities naturally operate.',
        ),
      },
      {
        question: msg('Can virtual civilizations interact with each other?'),
        answer: msg(
          'Yes. The multiverse system connects simulations through dimensional corridors. Events bleed across connections, embassies establish diplomatic links, and during competitive Epochs, civilizations compete directly.',
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
        label: msg('Worldbuilding'),
        href: '/worldbuilding',
        variant: 'secondary',
      },
      {
        label: msg('AI-Powered Worldbuilding'),
        href: '/perspectives/ai-powered-worldbuilding',
        variant: 'secondary',
      },
    ],

    structuredData: {
      articleType: 'Article',
      datePublished: '2026-03-19',
      dateModified: '2026-03-19',
      wordCount: 1800,
    },
  };
}
