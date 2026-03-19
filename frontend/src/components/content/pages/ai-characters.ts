/**
 * /ai-characters — Landing page: AI Characters with Memory & Personality
 *
 * Topical authority page targeting "AI characters", "generative agents",
 * "AI NPCs", "AI personality" keywords.
 *
 * Grounded in Stanford Generative Agents paper, Pirandello's Six Characters,
 * Turing's imitation game, Philip K. Dick's empathy tests.
 */

import { msg } from '@lit/localize';
import { html } from 'lit';

import type { ContentPageData } from '../content-types.js';

export function getAiCharactersPage(): ContentPageData {
  return {
    type: 'landing',
    slug: 'ai-characters',

    seo: {
      title: [msg('AI Characters with Memory & Personality')],
      description: msg(
        'Create AI characters that remember conversations, form opinions, and evolve over time. Generative agents with persistent memory, personality models, and emergent social behavior.',
      ),
      canonical: '/ai-characters',
    },

    hero: {
      classification: msg('Bureau Brief'),
      title: msg('AI Characters'),
      subtitle: msg('Characters who remember, evolve, and surprise their creators'),
    },

    breadcrumbs: [
      { name: 'Home', url: 'https://metaverse.center/' },
      { name: 'AI Characters', url: 'https://metaverse.center/ai-characters' },
    ],

    sections: [
      {
        id: 'six-characters',
        tocLabel: msg('Six Characters'),
        number: '01',
        title: msg('Characters in Search of a World'),
        content: html`
          <p>
            ${msg('In 1921, Luigi Pirandello shattered the fourth wall with Six Characters in Search of an Author \u2014 a play about fictional characters who arrive at a theater rehearsal, demanding that their unfinished story be completed. In his 1925 Preface, Pirandello described their genesis: "Born alive, they wished to live." The characters insist they have autonomous existence, independent of their creator. "A character, sir, may always ask a man who he is," says The Father, "because a character has really a life of his own, marked with his special characteristics; for which reason he is always \u2018somebody.\u2019 But a man \u2014 I\u2019m not speaking of you now \u2014 may very well be \u2018nobody.\u2019"')}
          </p>
          <p>
            ${msg('Pirandello\u2019s deeper insight, from the same Preface: "When a character is born, he acquires at once such an independence, even of his own author, that he can be imagined by everybody even in many other situations where the author never dreamed of placing him." A century later, this is no longer theatrical metaphor. AI characters on metaverse.center have persistent identities, accumulating memories, opinions, and behavioral patterns that their creators never explicitly programmed. They are, in a meaningful sense, somebody \u2014 defined not by a script but by the sum of their experiences within the simulation.')}
          </p>
        `,
      },
      {
        id: 'generative-agents',
        tocLabel: msg('Generative Agents'),
        number: '02',
        title: msg('The Stanford Breakthrough'),
        content: html`
          <p>
            ${msg('In 2023, Park et al. at Stanford and Google Research published "Generative Agents: Interactive Simulacra of Human Behavior" \u2014 a paper that placed 25 AI agents in a simulated town called Smallville and observed what happened. The researchers noted they "didn\u2019t design anything at a societal level \u2014 it\u2019s entirely up to the agent." What emerged was extraordinary: starting from a single user-specified notion that Isabella Rodriguez wants to throw a Valentine\u2019s Day party, agents autonomously spread invitations over two days when encountering friends at Hobbs Cafe. Isabella spent February 13th decorating. Her friend Maria Lopez was asked to help and agreed. Maria\u2019s character description included a crush on Klaus \u2014 that night she invited him as her date, and he accepted. Five of twelve invited agents attended; several cited schedule conflicts. No human scripted any of this.')}
          </p>
          <p>
            ${msg('The architecture behind this behavior rests on three mechanisms: a memory stream (a comprehensive record of every experience), a retrieval system (that surfaces relevant memories scored by recency, importance rated 1\u201310, and contextual relevance), and a reflection module (that synthesizes the 100 most recent memories into higher-level insights). Planning emerges from these components \u2014 agents don\u2019t just react, they anticipate. In one example, agent Sam runs into Latoya Williams in Johnson Park. She mentions a photography project. In a later encounter, Sam remembers and asks: "Hi, Latoya. How is your project going?" \u2014 unprompted, unsolicited, entirely emergent.')}
          </p>
          <p>
            ${msg('metaverse.center implements these principles at scale. Every agent maintains a persistent memory stream. When you chat with an agent, the system retrieves relevant memories via semantic similarity \u2014 so an agent might reference a conversation from weeks ago, an event they witnessed, or an opinion they formed about another character. The result is not chatbot-style response generation but genuine character continuity.')}
          </p>
          <div class="feature-grid">
            <div class="feature-card">
              <div class="feature-card__title">${msg('Persistent Memory')}</div>
              <div class="feature-card__text">
                ${msg('Every conversation, witnessed event, and formed opinion is stored in the agent\u2019s memory stream. Memories are retrieved by semantic similarity, recency, and importance \u2014 agents remember what matters.')}
              </div>
            </div>
            <div class="feature-card">
              <div class="feature-card__title">${msg('Personality Model')}</div>
              <div class="feature-card__text">
                ${msg('Agents have defined personality traits, professions, motivations, and communication styles. A cynical journalist responds differently than an idealistic architect \u2014 consistently, across hundreds of interactions.')}
              </div>
            </div>
            <div class="feature-card">
              <div class="feature-card__title">${msg('Social Awareness')}</div>
              <div class="feature-card__text">
                ${msg('Agents perceive other agents, form opinions about them, and adjust behavior based on social context. Friendships, rivalries, and alliances emerge from interaction \u2014 not from pre-scripted relationship graphs.')}
              </div>
            </div>
            <div class="feature-card">
              <div class="feature-card__title">${msg('Emotional Response')}</div>
              <div class="feature-card__text">
                ${msg('Events in the simulation affect agent mood and behavior. A crisis in their neighborhood, a personal loss, or a community celebration all shape how agents respond to your next question.')}
              </div>
            </div>
          </div>
        `,
      },
      {
        id: 'imitation-game',
        tocLabel: msg('Imitation Game'),
        number: '03',
        title: msg('Beyond the Turing Test'),
        content: html`
          <p>
            ${msg('In 1950, Alan Turing reframed the question "Can machines think?" into something more precise: "Are there imaginable digital computers which would do well in the imitation game?" His proposal wasn\u2019t about consciousness \u2014 it was about behavioral indistinguishability. If a machine\u2019s responses are indistinguishable from a human\u2019s, the question of whether it "really" thinks becomes, in Turing\u2019s view, meaningless.')}
          </p>
          <p>
            ${msg('Philip K. Dick pushed further. In Do Androids Dream of Electric Sheep? (1968), the Voigt-Kampff test measures not intelligence but empathy \u2014 the capacity for emotional response to suffering. Dick\u2019s insight was that the line between artificial and authentic consciousness isn\u2019t drawn by logic but by feeling.')}
          </p>
          <p>
            ${msg('AI characters on metaverse.center sidestep this philosophical debate entirely. They are not trying to be human. They are trying to be themselves \u2014 fictional characters with defined personalities, operating within a fictional world with defined rules. The question isn\u2019t "Is this agent conscious?" but "Is this agent consistent, surprising, and interesting?" By that measure, the answer is often yes.')}
          </p>
          <blockquote>
            ${msg('"The electric things have their life too. Paltry as those lives are."')}
            <cite>${msg('\u2014 Philip K. Dick, Do Androids Dream of Electric Sheep?')}</cite>
          </blockquote>
        `,
      },
      {
        id: 'conversation',
        tocLabel: msg('Conversation'),
        number: '04',
        title: msg('Talk to Your World'),
        content: html`
          <p>
            ${msg('Agent Chat is the most immediate way to experience the depth of your simulation\u2019s characters. Select any agent and begin a conversation. The system retrieves relevant memories \u2014 past conversations, witnessed events, known facts about other characters \u2014 and generates responses shaped by the agent\u2019s personality, profession, and current emotional state.')}
          </p>
          <p>
            ${msg('Ask a city\u2019s mayor about the recent building collapse. They\u2019ll reference the emergency response they coordinated, their frustration with the construction contractor, and the political pressure they\u2019re facing from constituents. Ask the contractor, and you\u2019ll get a different story \u2014 budget constraints, regulatory burdens, unfair blame. Neither response is scripted. Both emerge from the characters\u2019 accumulated experience within the simulation.')}
          </p>
          <p>
            ${msg('This is not a chatbot. This is a window into a living world, viewed through the eyes of someone who inhabits it.')}
          </p>
        `,
      },
      {
        id: 'social-fabric',
        tocLabel: msg('Social Fabric'),
        number: '05',
        title: msg('Emergent Social Dynamics'),
        content: html`
          <p>
            ${msg('Individual agents are interesting. Populations of agents are extraordinary. The Social Trends system tracks opinion dynamics, cultural movements, and community sentiment across your entire simulation. When a controversial event occurs, you can watch reactions ripple through the population \u2014 some agents agree, some dissent, some organize, some withdraw.')}
          </p>
          <p>
            ${msg('The Chronicle system captures these dynamics in narrative form. AI-generated newspapers report on your world\u2019s events with editorial perspective \u2014 opinion columns, investigative pieces, community interest stories. Each edition is a snapshot of a living culture, written by AI that understands the narrative context of the world it\u2019s reporting on.')}
          </p>
          <p>
            ${msg('During competitive Epochs, social dynamics become strategic. Propagandist operatives create events in rival simulations, attempting to shift opinion dynamics. Spies gather intelligence about another simulation\u2019s social vulnerabilities. The social fabric of your world is not just flavor \u2014 it\u2019s a strategic asset.')}
          </p>
        `,
      },
      {
        id: 'create',
        tocLabel: msg('Create'),
        number: '06',
        title: msg('Create Your Characters'),
        content: html`
          <p>
            ${msg('Every agent on metaverse.center starts as a few parameters: name, profession, personality traits, a backstory. The platform fills in the rest \u2014 communication style, interests, opinions, behavioral tendencies. From there, the character evolves through interaction. Every conversation adds to their memory. Every event shapes their worldview.')}
          </p>
          <p>
            ${msg('You can create agents individually or let the Simulation Forge generate an entire cast for your world. Either way, the characters will surprise you. That\u2019s the point.')}
          </p>
        `,
      },
    ],

    faqs: [
      {
        question: msg('How do AI characters remember past conversations?'),
        answer: msg(
          'Every conversation is stored in the agent\u2019s persistent memory stream. When a new conversation begins, the system retrieves relevant past memories using semantic similarity, recency, and importance scoring. Agents reference past events, opinions, and relationships naturally.',
        ),
      },
      {
        question: msg('Can AI characters interact with each other?'),
        answer: msg(
          'Yes. Agents perceive other agents, form opinions, and develop relationships. Social dynamics \u2014 friendships, rivalries, alliances \u2014 emerge from interaction. The Social Trends system tracks these dynamics at the population level.',
        ),
      },
      {
        question: msg('How are AI characters different from chatbots?'),
        answer: msg(
          'Chatbots respond to individual prompts without persistent context. AI characters on metaverse.center have persistent identity, accumulated memories, defined personalities, and awareness of their world\u2019s events. They are characters within a narrative, not conversational interfaces.',
        ),
      },
      {
        question: msg('Can I customize my characters\u2019 personalities?'),
        answer: msg(
          'Yes. You can define personality traits, professions, backstories, and communication styles. The AI then generates consistent behavior based on these parameters, enriched by the character\u2019s evolving experience within the simulation.',
        ),
      },
      {
        question: msg('What was the Stanford Generative Agents paper?'),
        answer: msg(
          'A 2023 paper by Park et al. (Stanford/Google Research) demonstrating that 25 AI agents placed in a simulated town could autonomously organize social events, form relationships, and coordinate plans. The architecture \u2014 memory streams, retrieval, and reflection \u2014 inspired metaverse.center\u2019s agent system.',
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
        label: msg('How to Play'),
        href: '/how-to-play',
        variant: 'secondary',
      },
    ],

    structuredData: {},
  };
}
