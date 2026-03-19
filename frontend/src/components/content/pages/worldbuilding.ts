/**
 * /worldbuilding — Landing page: AI Worldbuilding Platform
 *
 * Topical authority page targeting "worldbuilding", "AI worldbuilding",
 * "create virtual worlds", "worldbuilding platform" keywords.
 *
 * Grounded in Tolkien's subcreation, Borges' Tlön, Calvino's Invisible Cities,
 * procedural generation history, and emergence theory.
 */

import { msg } from '@lit/localize';
import { html } from 'lit';

import type { ContentPageData } from '../content-types.js';

export function getWorldbuildingPage(): ContentPageData {
  return {
    type: 'landing',
    slug: 'worldbuilding',

    seo: {
      title: [msg('AI Worldbuilding Platform'), msg('Create Living Worlds')],
      description: msg(
        'Build AI-powered worlds with characters who remember, cities that evolve, and stories that write themselves. From Tolkien\u2019s subcreation to procedural generation \u2014 worldbuilding reimagined.',
      ),
      canonical: '/worldbuilding',
    },

    hero: {
      classification: msg('Bureau Brief'),
      title: msg('Worldbuilding'),
      subtitle: msg('Create worlds that remember, evolve, and surprise you'),
    },

    breadcrumbs: [
      { name: 'Home', url: 'https://metaverse.center/' },
      { name: 'Worldbuilding', url: 'https://metaverse.center/worldbuilding' },
    ],

    sections: [
      {
        id: 'subcreation',
        tocLabel: msg('Subcreation'),
        number: '01',
        title: msg('The Art of Subcreation'),
        content: html`
          <p>
            ${msg('In 1939, J.R.R. Tolkien delivered his Andrew Lang lecture at the University of St Andrews, articulating what he called subcreation \u2014 the human act of making secondary worlds that possess "the inner consistency of reality." Published in 1947 as On Fairy-Stories, the essay framed worldbuilding not as escapism but as a fundamental human capacity. "Fantasy remains a human right," Tolkien wrote. "We make in our measure and in our derivative mode, because we are made: and not only made, but made in the image and likeness of a Maker."')}
          </p>
          <p>
            ${msg('Tolkien explicitly rejected Coleridge\u2019s "willing suspension of disbelief" as inadequate. Suspension implies conscious effort, a tolerance of flaws. What Tolkien demanded was Secondary Belief: "He makes a Secondary World which your mind can enter. Inside it, what he relates is \u2018true\u2019: it accords with the laws of that world. You therefore believe it, while you are, as it were, inside." When the spell breaks, "the magic, or rather the art, has failed." Achieving Secondary Belief requires what Tolkien called "a special skill, a kind of elvish craft."')}
          </p>
          <p>
            ${msg('metaverse.center takes subcreation seriously. Every simulation is a secondary world with its own geography, history, characters, and internal logic. AI doesn\u2019t replace the worldbuilder \u2014 it amplifies the act of subcreation, ensuring that the world maintains coherence even as it grows beyond what any single mind could track.')}
          </p>
        `,
      },
      {
        id: 'emergence',
        tocLabel: msg('Emergence'),
        number: '02',
        title: msg('Worlds That Write Themselves'),
        content: html`
          <p>
            ${msg('Jorge Luis Borges imagined it first. In "Tl\u00f6n, Uqbar, Orbis Tertius" (first published in the journal Sur, May 1940), a secret society called Orbis Tertius creates a complete forty-volume encyclopedia for a fictional planet \u2014 a world so internally consistent, so meticulously detailed, that it begins to supplant reality. Tl\u00f6nian artifacts physically appear in the real world. Its idealist philosophy replaces our own. The story\u2019s most chilling line: "Almost immediately, reality yielded on more than one account. The truth is that it longed to yield."')}
          </p>
          <p>
            ${msg('This is emergence \u2014 the phenomenon where complex behaviors arise from simple rules. John Conway demonstrated it in 1970 with the Game of Life: four rules governing cellular birth and death produce gliders, oscillators, and Turing-complete computation. Stephen Wolfram dedicated an entire career to proving that "simple programs can produce behavior of great complexity" in A New Kind of Science (2002).')}
          </p>
          <p>
            ${msg('On metaverse.center, emergence is not a metaphor. Agents with distinct personalities interact, form opinions, and generate events. Buildings degrade or flourish based on activity. Social trends propagate through populations. Chronicles \u2014 AI-generated newspapers \u2014 report on events that no human scripted. The world writes its own story, and it surprises even its creator.')}
          </p>
          <div class="feature-grid">
            <div class="feature-card">
              <div class="feature-card__title">${msg('Agent Memory')}</div>
              <div class="feature-card__text">
                ${msg('Every AI character maintains a persistent memory stream. Past conversations, witnessed events, and formed opinions shape future behavior. Ask an agent about something that happened weeks ago \u2014 they remember.')}
              </div>
            </div>
            <div class="feature-card">
              <div class="feature-card__title">${msg('Social Dynamics')}</div>
              <div class="feature-card__text">
                ${msg('Agents don\u2019t exist in isolation. They form relationships, develop social trends, and respond to community events. Popularity, controversy, and influence emerge organically from interactions.')}
              </div>
            </div>
            <div class="feature-card">
              <div class="feature-card__title">${msg('Narrative Generation')}</div>
              <div class="feature-card__text">
                ${msg('The Chronicle system transforms raw simulation events into narrative journalism. AI-written broadsheets report on your world\u2019s happenings with editorial voice, opinion columns, and investigative pieces.')}
              </div>
            </div>
            <div class="feature-card">
              <div class="feature-card__title">${msg('Cross-World Bleed')}</div>
              <div class="feature-card__text">
                ${msg('High-impact events can "bleed" through dimensional connections to other simulations, creating transformed echoes. Your world\u2019s crisis becomes another world\u2019s myth.')}
              </div>
            </div>
          </div>
        `,
      },
      {
        id: 'invisible-cities',
        tocLabel: msg('Invisible Cities'),
        number: '03',
        title: msg('Every City Is a Story'),
        content: html`
          <p>
            ${msg('Italo Calvino\u2019s Invisible Cities (1972) presents Marco Polo describing fifty-five cities to Kublai Khan \u2014 each an impossible urban poem. Octavia hangs between two mountains on a net. Zenobia is built on stilts over nothing. Ersilia\u2019s inhabitants stretch strings between houses to map their relationships, then abandon the buildings when the strings grow too thick, leaving only the web behind.')}
          </p>
          <p>
            ${msg('"Every time I describe a city," Polo tells the Khan, "I am saying something about Venice." Every world you build on metaverse.center says something about the world you inhabit. The constraints you choose, the agents you create, the events you trigger \u2014 they reveal the story you want to tell, even if you don\u2019t know what it is yet.')}
          </p>
          <blockquote>
            ${msg('"Cities, like dreams, are made of desires and fears, even if the thread of their discourse is secret, their rules are absurd, their perspectives deceitful, and everything conceals something else."')}
            <cite>${msg('\u2014 Italo Calvino, Invisible Cities')}</cite>
          </blockquote>
          <p>
            ${msg('On the platform, each simulation is an invisible city made visible. The Simulation Forge transforms a single seed idea into geography, characters, architecture, and lore \u2014 an entire civilization conjured from a sentence. But unlike Calvino\u2019s cities, these don\u2019t stay frozen in description. They live. They change. Their inhabitants make choices their creator never imagined.')}
          </p>
        `,
      },
      {
        id: 'forge',
        tocLabel: msg('The Forge'),
        number: '04',
        title: msg('From Seed to Civilization'),
        content: html`
          <p>
            ${msg('The history of procedural generation is the history of ambition colliding with constraints. In 1980, Rogue generated dungeons from algorithms because there wasn\u2019t enough memory to store hand-crafted levels. Tarn Adams began Dwarf Fortress in 2002 and released its first alpha in August 2006 \u2014 a game that generates entire geological histories, civilizations with founding mythologies, and artifacts with provenance before the player even begins. Adams described his vision: "We\u2019re on a crusade to put the narratively interesting parts of existence in Dwarf Fortress." Over 700,000 lines of code, written by a single developer, pursuing not a simulation of atoms but a simulation of story. Hello Games\u2019 No Man\u2019s Sky (2016) attacked the scale axis: 18 quintillion planets generated from a single seed number \u2014 but it took years of updates to fill them with meaning.')}
          </p>
          <p>
            ${msg('metaverse.center\u2019s Simulation Forge inherits this lineage but adds what procedural generation always lacked: narrative intelligence. The AI doesn\u2019t just generate terrain and populate it with sprites. It creates agents with backstories, buildings with purposes, events with consequences, and lore that ties everything into a coherent mythology.')}
          </p>
          <div class="callout callout--info">
            <div class="callout__label">${msg('How the Forge Works')}</div>
            <div class="callout__text">
              ${msg('Provide a seed concept \u2014 "a dying space station orbiting a gas giant" or "a medieval city built on the back of a sleeping titan." The Forge generates geography, architectural style, a cast of named characters with personalities and professions, founding lore, and a visual identity. The entire process takes about 15 minutes. What you get is not a template but a living world.')}
            </div>
          </div>
          <p>
            ${msg('The Chilean biologists Humberto Maturana and Francisco Varela coined the term autopoiesis in 1972 to describe systems that produce and maintain themselves. Their formal definition: "An autopoietic machine is a machine organized as a network of processes of production of components which, through their interactions and transformations, continuously regenerate and realize the network of processes that produced them." Living cells generate their own boundaries, metabolize their own components. Maturana and Varela\u2019s aphorism from The Tree of Knowledge (1987) captures it: "All doing is knowing, and all knowing is doing." A simulation on metaverse.center is autopoietic in the narrative sense: it generates its own events, its own social dynamics, its own history. The worldbuilder plants the seed. The world grows itself.')}
          </p>
        `,
      },
      {
        id: 'multiverse',
        tocLabel: msg('Multiverse'),
        number: '05',
        title: msg('Connected Worlds'),
        content: html`
          <p>
            ${msg('No world exists in isolation. On metaverse.center, simulations can be connected to form a multiverse \u2014 a network of worlds linked by dimensional corridors through which events, echoes, and diplomatic missions travel. The Cartographer\u2019s Map visualizes the entire network as an interactive force-directed graph: nodes pulse with activity, edges glow with traffic, and epoch battles erupt across connections in real time.')}
          </p>
          <p>
            ${msg('This is worldbuilding at the civilizational scale. Individual simulations are cultures; the multiverse is a geopolitical system. Embassies establish diplomatic links. Events in one world bleed through to create transformed echoes in another \u2014 a plague in one city might manifest as a religious movement in a connected world, or a technological breakthrough might echo as a cultural renaissance.')}
          </p>
          <p>
            ${msg('During competitive Epochs, these connections become strategic assets. Alliance networks, intelligence operations, and propaganda campaigns flow through the multiverse topology. Geography is destiny, even in virtual space.')}
          </p>
        `,
      },
      {
        id: 'begin',
        tocLabel: msg('Begin'),
        number: '06',
        title: msg('Start Building'),
        content: html`
          <p>
            ${msg('Tolkien spent decades on Middle-earth. Borges\u2019s Tl\u00f6n took a secret society of scholars. You need about fifteen minutes and a single idea.')}
          </p>
          <p>
            ${msg('The platform is free to explore. Browse existing worlds on the Worlds Gallery, read AI-generated chronicles, or dive into the Bureau Archives for the platform\u2019s own mythology. When you\u2019re ready to build, the Simulation Forge is waiting.')}
          </p>
          <p>
            ${msg('Every civilization on metaverse.center started as a sentence. What will yours become?')}
          </p>
        `,
      },
    ],

    faqs: [
      {
        question: msg('What is worldbuilding?'),
        answer: msg(
          'Worldbuilding is the craft of constructing fictional worlds with internal consistency \u2014 geography, history, cultures, characters, and rules. On metaverse.center, AI assists this process by generating and maintaining world elements that interact, evolve, and create emergent narratives.',
        ),
      },
      {
        question: msg('How does AI worldbuilding differ from traditional worldbuilding?'),
        answer: msg(
          'Traditional worldbuilding requires the creator to manually define every element. AI worldbuilding generates characters, events, and narratives from seed concepts, then allows them to evolve autonomously. The AI maintains consistency across hundreds of interacting elements \u2014 something no human could track alone.',
        ),
      },
      {
        question: msg('Do I need writing or game design experience?'),
        answer: msg(
          'No. The Simulation Forge generates a complete world from a single seed idea. You can then explore, modify, and expand it. The platform is designed for creators at every level \u2014 from first-time worldbuilders to experienced game designers.',
        ),
      },
      {
        question: msg('Can my world interact with other players\u2019 worlds?'),
        answer: msg(
          'Yes. Simulations can be connected to form a multiverse. Events bleed across connections, embassies establish diplomatic links, and during competitive Epochs, players deploy operatives against each other\u2019s worlds.',
        ),
      },
      {
        question: msg('Is it free?'),
        answer: msg(
          'metaverse.center is free to explore. Browsing worlds, reading chronicles, and viewing the multiverse map require no account. Creating your own simulation requires registration.',
        ),
      },
      {
        question: msg('What makes metaverse.center different from other worldbuilding tools?'),
        answer: msg(
          'Most worldbuilding tools are static wikis or databases. metaverse.center is a living simulation: AI characters have persistent memory, events generate cascading consequences, and the world produces its own narrative through chronicles and social dynamics. It\u2019s not a tool for describing a world \u2014 it\u2019s a platform for running one.',
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
        label: msg('Read the Archives'),
        href: '/archives',
        variant: 'secondary',
      },
      {
        label: msg('How to Play'),
        href: '/how-to-play',
        variant: 'secondary',
      },
    ],

    structuredData: {},
  };
}
