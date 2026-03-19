/**
 * /strategy-game — Landing page: Multiplayer Strategy Game
 *
 * Topical authority page targeting "multiplayer strategy game",
 * "competitive simulation", "PvP strategy" keywords.
 *
 * Grounded in Von Neumann game theory, Sun Tzu, Clausewitz,
 * Diplomacy (board game), and EVE Online emergent gameplay.
 */

import { msg } from '@lit/localize';
import { html } from 'lit';

import type { ContentPageData } from '../content-types.js';

export function getStrategyGamePage(): ContentPageData {
  return {
    type: 'landing',
    slug: 'strategy-game',

    seo: {
      title: [msg('Multiplayer Strategy Game'), msg('Competitive Epochs')],
      description: msg(
        'Deploy operatives, form alliances, and compete across five scoring dimensions in time-limited PvP epochs. A strategy game where your world is your weapon.',
      ),
      canonical: '/strategy-game',
    },

    hero: {
      classification: msg('Bureau Brief'),
      title: msg('Strategy Game'),
      subtitle: msg('Your world is your weapon. Deploy it.'),
    },

    breadcrumbs: [
      { name: 'Home', url: 'https://metaverse.center/' },
      { name: 'Strategy Game', url: 'https://metaverse.center/strategy-game' },
    ],

    sections: [
      {
        id: 'art-of-war',
        tocLabel: msg('Art of War'),
        number: '01',
        title: msg('Strategy as Old as Civilization'),
        content: html`
          <p>
            ${msg('Sun Tzu wrote it twenty-five centuries ago: "All warfare is based on deception. Hence, when we are able to attack, we must seem unable; when using our forces, we must appear inactive." The Art of War endures because its principles are universal \u2014 applicable to any domain where agents with competing interests make decisions under uncertainty.')}
          </p>
          <p>
            ${msg('Carl von Clausewitz added the concept of friction \u2014 the gap between a perfect plan and messy reality. "Everything in war is very simple," he wrote in On War (1832), "but the simplest thing is difficult." And the fog of war: the impossibility of complete information, the necessity of acting on incomplete intelligence, the cascade of unintended consequences.')}
          </p>
          <p>
            ${msg('Competitive Epochs on metaverse.center embody both traditions. Sun Tzu\u2019s deception manifests in spy operations, feints, and misdirection. Clausewitz\u2019s friction emerges from the interaction of multiple players in a system too complex for any single mind to predict. You plan. Your opponents plan. And then reality happens.')}
          </p>
        `,
      },
      {
        id: 'game-theory',
        tocLabel: msg('Game Theory'),
        number: '02',
        title: msg('The Mathematics of Conflict'),
        content: html`
          <p>
            ${msg('In 1944, John von Neumann and Oskar Morgenstern published Theory of Games and Economic Behavior, founding a mathematical framework for strategic interaction. Six years later, John Nash proved that every finite game has at least one equilibrium \u2014 a set of strategies where no player can improve their outcome by unilaterally changing their approach.')}
          </p>
          <p>
            ${msg('The prisoner\u2019s dilemma, the most famous game-theoretic scenario, captures the tension at the heart of every Epoch: cooperation yields the best collective outcome, but betrayal tempts with individual advantage. In metaverse.center\u2019s alliance system, this dilemma is not abstract. You can form alliances for diplomatic bonuses \u2014 but attacking an ally dissolves the alliance and may trigger score penalties. Trust is a resource. Betrayal is a weapon.')}
          </p>
          <p>
            ${msg('Five scoring dimensions \u2014 stability, influence, sovereignty, diplomatic, and military \u2014 create a multi-objective optimization problem with no single dominant strategy. A military juggernaut can be outmaneuvered diplomatically. A diplomatic powerhouse can be undermined by espionage. The Nash equilibrium, if one exists, is emergent and unknowable in advance.')}
          </p>
        `,
      },
      {
        id: 'operatives',
        tocLabel: msg('Operatives'),
        number: '03',
        title: msg('Six Tools of Statecraft'),
        content: html`
          <p>
            ${msg('Epochs give each player Resource Points (RP) to spend on six operative types, each modeled on a different tradition of strategic action:')}
          </p>
          <div class="feature-grid">
            <div class="feature-card">
              <div class="feature-card__title">${msg('Spy')}</div>
              <div class="feature-card__text">
                ${msg('Intelligence gathering. Reveals target zone security levels and guardian deployments. Knowledge is the prerequisite of effective action \u2014 Sun Tzu placed espionage as the highest form of warfare.')}
              </div>
            </div>
            <div class="feature-card">
              <div class="feature-card__title">${msg('Saboteur')}</div>
              <div class="feature-card__text">
                ${msg('Infrastructure degradation. Downgrades target zone security tiers, weakening defenses for follow-up operations. Clausewitz\u2019s friction, weaponized.')}
              </div>
            </div>
            <div class="feature-card">
              <div class="feature-card__title">${msg('Propagandist')}</div>
              <div class="feature-card__text">
                ${msg('Narrative warfare. Creates events in target simulations that shift social dynamics and opinion. The pen, as instrument of mass influence, wielded against a rival\u2019s social fabric.')}
              </div>
            </div>
            <div class="feature-card">
              <div class="feature-card__title">${msg('Assassin')}</div>
              <div class="feature-card__text">
                ${msg('Targeted elimination. Blocks enemy ambassadors, disrupting diplomatic operations and weakening alliance effectiveness. Surgical, precise, destabilizing.')}
              </div>
            </div>
            <div class="feature-card">
              <div class="feature-card__title">${msg('Guardian')}</div>
              <div class="feature-card__text">
                ${msg('Defensive deployment. Reduces the success probability of incoming operations. Each guardian diminishes attacker effectiveness by 8% (capped at 20%). The shield that makes the sword less certain.')}
              </div>
            </div>
            <div class="feature-card">
              <div class="feature-card__title">${msg('Infiltrator')}</div>
              <div class="feature-card__text">
                ${msg('Embassy undermining. Weakens diplomatic infrastructure from within, reducing the target\u2019s ability to maintain alliances and project soft power.')}
              </div>
            </div>
          </div>
        `,
      },
      {
        id: 'emergent-strategy',
        tocLabel: msg('Emergent Strategy'),
        number: '04',
        title: msg('When Players Write the Rules'),
        content: html`
          <p>
            ${msg('The most compelling strategy games are those where player behavior produces complexity that the designers never anticipated. Allan Calhamer\u2019s Diplomacy (1959) stripped away dice and chance entirely \u2014 seven players negotiating, promising, and betraying across a map of pre-WWI Europe. The game\u2019s depth comes entirely from human interaction, not mechanical complexity.')}
          </p>
          <p>
            ${msg('EVE Online took this further. In January 2014, the Battle of B-R5RB erupted from a missed sovereignty payment \u2014 a clerical error that triggered the largest virtual battle in gaming history. Over 7,500 players fought for 21 hours, destroying virtual assets worth an estimated $300,000 in real currency. No designer scripted this. The game\u2019s economic and political systems created the conditions; players created the history.')}
          </p>
          <p>
            ${msg('metaverse.center is designed for this kind of emergence. Epochs provide the competitive framework, but the strategic landscape is shaped by player decisions: alliance formations, intelligence operations, resource allocation, and the cascading consequences of actions taken across a multiverse of connected worlds. Every epoch writes its own history, and no two play out the same way.')}
          </p>
          <blockquote>
            ${msg('"In war, the way is to avoid what is strong, and strike at what is weak."')}
            <cite>${msg('\u2014 Sun Tzu, The Art of War')}</cite>
          </blockquote>
        `,
      },
      {
        id: 'scoring',
        tocLabel: msg('Scoring'),
        number: '05',
        title: msg('Five Dimensions of Victory'),
        content: html`
          <p>
            ${msg('Epochs score across five dimensions, each derived from different aspects of your simulation\u2019s performance during competitive play:')}
          </p>
          <div class="feature-grid">
            <div class="feature-card">
              <div class="feature-card__title">${msg('Stability')}</div>
              <div class="feature-card__text">
                ${msg('Resilience of your simulation under pressure. Affected by sabotage, assassination attempts, and internal disruption. A stable world is a defensible world.')}
              </div>
            </div>
            <div class="feature-card">
              <div class="feature-card__title">${msg('Influence')}</div>
              <div class="feature-card__text">
                ${msg('Cultural and narrative reach. Boosted by propaganda, espionage intelligence, and the richness of your simulation\u2019s social dynamics.')}
              </div>
            </div>
            <div class="feature-card">
              <div class="feature-card__title">${msg('Sovereignty')}</div>
              <div class="feature-card__text">
                ${msg('Territorial and infrastructural integrity. Building readiness, zone security, and self-sufficiency contribute to sovereign strength.')}
              </div>
            </div>
            <div class="feature-card">
              <div class="feature-card__title">${msg('Diplomatic')}</div>
              <div class="feature-card__text">
                ${msg('Alliance effectiveness and embassy operations. Active alliances provide a +15% diplomatic bonus. Betrayal carries penalties.')}
              </div>
            </div>
            <div class="feature-card">
              <div class="feature-card__title">${msg('Military')}</div>
              <div class="feature-card__text">
                ${msg('Offensive capability and defensive resilience. Successful operative deployments, guardian efficiency, and strategic target selection.')}
              </div>
            </div>
          </div>
          <p>
            ${msg('The composite score determines final ranking. There is no single path to victory \u2014 a diplomatic mastermind, a military juggernaut, and a cultural powerhouse all have viable routes to the top.')}
          </p>
        `,
      },
      {
        id: 'compete',
        tocLabel: msg('Compete'),
        number: '06',
        title: msg('Enter the Arena'),
        content: html`
          <p>
            ${msg('Epochs are time-limited competitive matches. Build your simulation, populate it with agents and buildings, and enter an epoch when you\u2019re ready. Game instances are normalized at the start for fair competition \u2014 every player begins on equal footing regardless of how long they\u2019ve been building.')}
          </p>
          <p>
            ${msg('Deploy operatives. Form alliances. Gather intelligence. Strike at weaknesses. Defend your sovereignty. And when the epoch ends, see where you stand across five dimensions of strategic performance.')}
          </p>
          <p>
            ${msg('Your world is your weapon. How will you wield it?')}
          </p>
        `,
      },
    ],

    faqs: [
      {
        question: msg('What is an Epoch?'),
        answer: msg(
          'An Epoch is a time-limited competitive PvP match where simulation owners deploy operatives, form alliances, and compete across five scoring dimensions. Think of it as a structured conflict between virtual civilizations.',
        ),
      },
      {
        question: msg('Do I need to build a simulation first?'),
        answer: msg(
          'Yes. Your simulation is your competitive asset. The Simulation Forge can generate a complete world in about 15 minutes. Game instances are normalized when an epoch begins, so newer simulations compete on equal footing.',
        ),
      },
      {
        question: msg('How does the alliance system work?'),
        answer: msg(
          'Players can propose and accept alliances during an epoch. Active alliances provide a +15% diplomatic bonus. However, attacking an ally dissolves the alliance and may incur score penalties \u2014 the prisoner\u2019s dilemma in action.',
        ),
      },
      {
        question: msg('What are Resource Points (RP)?'),
        answer: msg(
          'RP is the currency for deploying operatives. Each operative type has a different RP cost. Managing RP allocation \u2014 deciding between offense, defense, intelligence, and diplomacy \u2014 is a core strategic decision.',
        ),
      },
      {
        question: msg('Can I play against AI opponents?'),
        answer: msg(
          'Yes. Bot players have five personality archetypes (Sentinel, Warlord, Diplomat, Strategist, Chaos) and three difficulty levels. They use the same deployment mechanics as human players.',
        ),
      },
      {
        question: msg('How is scoring balanced?'),
        answer: msg(
          'Five dimensions prevent any single strategy from dominating. Military strength can be countered by diplomatic prowess. Influence can undermine sovereignty. The system rewards adaptability and multi-dimensional thinking.',
        ),
      },
    ],

    ctas: [
      {
        label: msg('How to Play'),
        href: '/how-to-play',
        variant: 'primary',
      },
      {
        label: msg('Explore Worlds'),
        href: '/worlds',
        variant: 'secondary',
      },
      {
        label: msg('Worldbuilding'),
        href: '/worldbuilding',
        variant: 'secondary',
      },
    ],

    structuredData: {},
  };
}
