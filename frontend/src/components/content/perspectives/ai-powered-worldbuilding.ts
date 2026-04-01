/**
 * /perspectives/ai-powered-worldbuilding — Perspective article
 *
 * Targets: "AI worldbuilding", "procedural generation AI",
 * "emergent narrative", "generative world"
 *
 * References: Conway's Game of Life, Wolfram's cellular automata,
 * emergence theory, autopoiesis (Maturana/Varela), Dwarf Fortress.
 */

import { msg } from '@lit/localize';
import { html } from 'lit';

import type { ContentPageData } from '../content-types.js';

export function getAiPoweredWorldbuildingPage(): ContentPageData {
  return {
    type: 'perspective',
    slug: 'perspectives/ai-powered-worldbuilding',

    seo: {
      title: [msg('AI-Powered Worldbuilding'), msg('From Cellular Automata to Living Narratives')],
      description: msg(
        'How emergence, autopoiesis, and generative AI converge to create worlds that write their own stories. Conway\u2019s Game of Life meets narrative intelligence.',
      ),
      canonical: '/perspectives/ai-powered-worldbuilding',
    },

    hero: {
      classification: msg('Bureau Perspective'),
      title: msg('AI-Powered Worldbuilding'),
      subtitle: msg('When simple rules produce complex worlds'),
      byline: msg('Bureau of Impossible Geography'),
      datePublished: '2026-03-19',
      readTime: msg('9 min read'),
    },

    breadcrumbs: [
      { name: 'Home', url: 'https://metaverse.center/' },
      {
        name: 'Perspectives',
        url: 'https://metaverse.center/perspectives/ai-powered-worldbuilding',
      },
      {
        name: 'AI-Powered Worldbuilding',
        url: 'https://metaverse.center/perspectives/ai-powered-worldbuilding',
      },
    ],

    sections: [
      {
        id: 'game-of-life',
        tocLabel: msg('Game of Life'),
        number: '01',
        title: msg('Four Rules, Infinite Complexity'),
        content: html`
          <p>
            ${msg('In 1970, the British mathematician John Horton Conway devised a cellular automaton, first popularized in Martin Gardner\u2019s "Mathematical Games" column in Scientific American (October 1970). Four rules, applied simultaneously to every cell on an infinite two-dimensional grid: a living cell with fewer than two neighbors dies (underpopulation); a living cell with two or three neighbors survives; a living cell with more than three neighbors dies (overpopulation); a dead cell with exactly three neighbors becomes alive (reproduction). That\u2019s it. Four rules.')}
          </p>
          <p>
            ${msg('From these four rules emerge gliders \u2014 patterns that traverse the grid indefinitely. Oscillators that pulse in stable cycles. Guns that emit streams of gliders. Entire Turing-complete computers built from arrangements of living and dead cells. Conway\u2019s Game of Life demonstrated, with mathematical precision, that complex behavior does not require complex rules. It requires simple rules, applied consistently, over time.')}
          </p>
          <p>
            ${msg('Stephen Wolfram took this insight to its logical extreme. In A New Kind of Science (2002), he catalogued the behavior of every possible one-dimensional cellular automaton and argued that "simple programs can produce behavior of great complexity." His Rule 110 \u2014 one of the simplest possible one-dimensional cellular automata, two colors, nearest-neighbor interactions \u2014 was proven Turing complete by Matthew Cook in 2004. Capable, in principle, of any computation. Given an infinite grid with a random initial configuration, a Turing-machine sub-pattern is guaranteed to exist with probability 1. All of this computational power latent in trivial rules.')}
          </p>
          <blockquote>
            ${msg('"Even from very simple programs, behavior of great complexity can be produced."')}
            <cite>${msg('\u2014 Stephen Wolfram, A New Kind of Science (2002)')}</cite>
          </blockquote>
        `,
      },
      {
        id: 'emergence',
        tocLabel: msg('Emergence'),
        number: '02',
        title: msg('The Whole Greater Than Its Parts'),
        content: html`
          <p>
            ${msg('Emergence is the phenomenon where collective behavior of a system exceeds the sum of its individual components\u2019 behaviors. A single neuron fires or doesn\u2019t. A brain thinks. A single ant follows pheromone trails. A colony builds complex architecture, farms fungi, wages wars. The emergent behavior is not programmed into the individual agents \u2014 it arises from their interaction.')}
          </p>
          <p>
            ${msg('The term has deep roots in philosophy. G.H. Lewes distinguished "resultant" effects (predictable from components) from "emergent" effects (irreducible to components) in Problems of Life and Mind (1875). C.D. Broad formalized the concept in The Mind and Its Place in Nature (1925), arguing that some properties of complex systems are not, even in principle, deducible from the properties of their parts.')}
          </p>
          <p>
            ${msg('This is the theoretical foundation of AI worldbuilding. On metaverse.center, individual agents follow behavioral rules shaped by personality, memory, and context. Individual buildings have states and capacities. Individual events have triggers and consequences. No one programs the emergent narrative \u2014 the story that arises when an agent\u2019s bad decision triggers an event that damages a building that displaces a population that generates social unrest that produces a chronicle headline that another agent reads and reacts to.')}
          </p>
          <p>
            ${msg('That cascade is emergence. And it is the difference between a world that is described and a world that is alive.')}
          </p>
        `,
      },
      {
        id: 'dwarf-fortress',
        tocLabel: msg('Dwarf Fortress'),
        number: '03',
        title: msg('The Procedural Generation Tradition'),
        content: html`
          <p>
            ${msg('Tarn Adams has been building Dwarf Fortress since 2002. The game generates worlds with simulated geological layers, erosion patterns, river systems, and tectonic activity. It populates those worlds with civilizations that have founding mythologies, historical wars, and dynastic successions. It tracks individual creatures with memories, relationships, and personality traits. It is, by a wide margin, the most ambitious procedural generation system ever created.')}
          </p>
          <p>
            ${msg('The stories that emerge from Dwarf Fortress are legendary. Boatmurdered \u2014 a collaborative Let\u2019s Play on the Something Awful forums (November 2006 to March 2007), where fourteen players each managed a fortress for one in-game year \u2014 descended into an epic of murderous elephants, magma floods, megalomania, and collapse. Entirely unscripted, entirely emergent from the simulation\u2019s rules. Widely credited with popularizing both Dwarf Fortress and the Let\u2019s Play format itself. Adams described his early vision: "We don\u2019t want another cheap fantasy universe. We want a cheap fantasy universe generator."')}
          </p>
          <p>
            ${msg('No Man\u2019s Sky (2016) attacked the scale axis: 18 quintillion planets generated from mathematical functions. But scale without depth produces tourist destinations, not worlds. What Dwarf Fortress understood, and what No Man\u2019s Sky eventually learned through years of updates, is that procedural generation must produce not just geography but meaning \u2014 characters with stakes, events with consequences, histories that matter to the inhabitants.')}
          </p>
          <p>
            ${msg('metaverse.center inherits this lineage and extends it with narrative intelligence. AI doesn\u2019t just generate terrain and populate it with entities. It creates agents whose personalities shape their behavior, events whose consequences cascade through interconnected systems, and chronicles that transform raw simulation state into narrative journalism. The procedural generation is not of space but of story.')}
          </p>
        `,
      },
      {
        id: 'autopoiesis',
        tocLabel: msg('Autopoiesis'),
        number: '04',
        title: msg('Systems That Create Themselves'),
        content: html`
          <p>
            ${msg('In 1972, the Chilean biologists Humberto Maturana and Francisco Varela introduced the concept of autopoiesis \u2014 literally, "self-creation." An autopoietic system is one that produces and maintains its own components. A living cell manufactures its own membrane, metabolizes its own nutrients, replicates its own DNA. The system\u2019s organization defines a boundary between self and environment, and the system\u2019s processes maintain that boundary.')}
          </p>
          <p>
            ${msg('Maturana and Varela argued that autopoiesis is the defining characteristic of life. What distinguishes a living system from a mechanical system is not complexity but self-referential organization: the system produces the very components that constitute it.')}
          </p>
          <p>
            ${msg('A simulation on metaverse.center exhibits narrative autopoiesis. Agents generate events. Events trigger social dynamics. Social dynamics produce chronicle articles. Chronicle content feeds back into agent awareness and behavior. The system produces its own narrative components \u2014 the stories, the characters\u2019 evolving relationships, the community\u2019s collective memory. No external narrator is required. The world writes itself.')}
          </p>
          <blockquote>
            ${msg('"An autopoietic machine is a machine organized as a network of processes of production of components that produces the components which: through their interactions and transformations continuously regenerate the network of processes that produced them."')}
            <cite>${msg('\u2014 Maturana & Varela, Autopoiesis and Cognition (1980)')}</cite>
          </blockquote>
        `,
      },
      {
        id: 'narrative-intelligence',
        tocLabel: msg('Narrative AI'),
        number: '05',
        title: msg('When AI Understands Story'),
        content: html`
          <p>
            ${msg('Previous procedural generation systems produced content \u2014 terrain, items, quests. Large language models produce something qualitatively different: narrative. They understand context, causality, character motivation, dramatic tension. This is the missing ingredient that transforms procedural generation from content factory to storytelling engine.')}
          </p>
          <p>
            ${msg('On metaverse.center, AI operates at multiple narrative layers simultaneously. At the agent level, it generates dialogue consistent with personality, memory, and emotional state. At the event level, it produces consequences that cascade logically through the simulation. At the chronicle level, it synthesizes raw events into editorial journalism with voice, opinion, and narrative arc. At the lore level, it weaves individual incidents into the larger mythology of the world.')}
          </p>
          <p>
            ${msg('Each layer feeds the others. A chronicle article about a political scandal affects agent opinions. An agent\u2019s emotional breakdown generates events in their neighborhood. Those events produce material for the next chronicle edition. The narrative bootstraps itself, each layer amplifying and enriching the others.')}
          </p>
          <p>
            ${msg('This is not artificial general intelligence. It is something more specific and, for our purposes, more useful: artificial narrative intelligence \u2014 the ability to maintain coherent, evolving, multi-layered stories across thousands of interacting elements. Conway proved that four rules can produce infinite complexity. We are proving that narrative rules, applied to populations of AI agents, can produce worlds.')}
          </p>
        `,
      },
      {
        id: 'implications',
        tocLabel: msg('Implications'),
        number: '06',
        title: msg('What This Means for Creators'),
        content: html`
          <p>
            ${msg('The convergence of emergence theory, procedural generation, and narrative AI changes what "worldbuilding" means. It is no longer the solitary craft of a Tolkien spending decades on linguistic and geographic consistency. It is no longer the brute-force approach of populating databases with hand-written content. It is a collaborative act between human vision and machine generation \u2014 the creator provides direction; the AI provides depth.')}
          </p>
          <p>
            ${msg('The creator\u2019s role shifts from author to gardener. You plant seeds \u2014 a concept, characters, constraints \u2014 and tend what grows. You prune what doesn\u2019t work, encourage what does, and discover stories you never planned. The world surprises you, and that surprise is the proof that something genuinely emergent is happening.')}
          </p>
          <p>
            ${msg('From Conway\u2019s four rules to Maturana\u2019s self-creating systems to Stanford\u2019s generative agents: the thread connecting these ideas is that complex, meaningful behavior can emerge from simple, consistent rules applied to interacting agents. metaverse.center is the platform where that thread becomes a living system.')}
          </p>
        `,
      },
    ],

    faqs: [
      {
        question: msg('What is AI-powered worldbuilding?'),
        answer: msg(
          'AI-powered worldbuilding uses generative AI to create and maintain virtual worlds \u2014 generating characters with personality and memory, events with cascading consequences, and narratives that emerge from the interaction of simulated agents. It extends the procedural generation tradition with narrative intelligence.',
        ),
      },
      {
        question: msg('How does emergence work in virtual worlds?'),
        answer: msg(
          'Emergence occurs when individual agents following simple rules produce complex collective behavior. In metaverse.center, agents interact based on personality, memory, and context. The resulting narratives, social dynamics, and events are not scripted \u2014 they arise from the system\u2019s operation.',
        ),
      },
      {
        question: msg('What is autopoiesis?'),
        answer: msg(
          'Autopoiesis ("self-creation") is a concept from biology describing systems that produce and maintain their own components. A cell manufactures its own membrane. A living simulation generates its own events, narratives, and social dynamics \u2014 narrative autopoiesis.',
        ),
      },
      {
        question: msg('How does AI worldbuilding differ from procedural generation?'),
        answer: msg(
          'Traditional procedural generation produces content \u2014 terrain, items, levels. AI worldbuilding produces narrative: characters with motivation, events with consequences, stories with dramatic arc. The difference is between generating space and generating meaning.',
        ),
      },
    ],

    ctas: [
      {
        label: msg('Worldbuilding'),
        href: '/worldbuilding',
        variant: 'primary',
      },
      {
        label: msg('What Is the Metaverse?'),
        href: '/perspectives/what-is-the-metaverse',
        variant: 'secondary',
      },
      {
        label: msg('Virtual Civilizations'),
        href: '/perspectives/virtual-civilizations',
        variant: 'secondary',
      },
    ],

    structuredData: {
      articleType: 'Article',
      datePublished: '2026-03-19',
      dateModified: '2026-03-19',
      wordCount: 1700,
    },
  };
}
