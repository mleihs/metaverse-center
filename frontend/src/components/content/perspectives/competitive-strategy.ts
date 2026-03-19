/**
 * /perspectives/competitive-strategy — Perspective article
 *
 * Targets: "competitive strategy", "virtual warfare",
 * "game strategy", "emergent gameplay"
 *
 * References: Sun Tzu, Clausewitz, Nash equilibrium,
 * EVE Online emergent gameplay, Diplomacy board game,
 * asymmetric warfare theory.
 */

import { msg } from '@lit/localize';
import { html } from 'lit';

import type { ContentPageData } from '../content-types.js';

export function getCompetitiveStrategyPage(): ContentPageData {
  return {
    type: 'perspective',
    slug: 'perspectives/competitive-strategy',

    seo: {
      title: [msg('Competitive Strategy in Virtual Worlds'), msg('From Sun Tzu to EVE Online')],
      description: msg(
        'Game theory, asymmetric warfare, and emergent player strategy \u2014 how competitive virtual worlds create strategic depth that rivals real geopolitics.',
      ),
      canonical: '/perspectives/competitive-strategy',
    },

    hero: {
      classification: msg('Bureau Perspective'),
      title: msg('Competitive Strategy'),
      subtitle: msg('The oldest art, reimagined for virtual worlds'),
      byline: msg('Bureau of Impossible Geography'),
      datePublished: '2026-03-19',
      readTime: msg('10 min read'),
    },

    breadcrumbs: [
      { name: 'Home', url: 'https://metaverse.center/' },
      { name: 'Perspectives', url: 'https://metaverse.center/perspectives/competitive-strategy' },
      { name: 'Competitive Strategy', url: 'https://metaverse.center/perspectives/competitive-strategy' },
    ],

    sections: [
      {
        id: 'ancient-strategy',
        tocLabel: msg('Ancient Strategy'),
        number: '01',
        title: msg('Twenty-Five Centuries of Strategic Thought'),
        content: html`
          <p>
            ${msg('Sun Tzu\u2019s The Art of War (5th century BCE) established principles that have survived every revolution in military technology: "Know yourself and know your enemy, and in a hundred battles you will never be in peril." "Appear weak when you are strong, and strong when you are weak." "The supreme art of war is to subdue the enemy without fighting." These are not tactical prescriptions but strategic orientations \u2014 frameworks for thinking about conflict that transcend the specific technologies of any era.')}
          </p>
          <p>
            ${msg('Carl von Clausewitz, writing in the aftermath of the Napoleonic Wars, added the concepts of friction and fog. "Everything in war is very simple, but the simplest thing is difficult." Plans dissolve on contact with reality. Information is incomplete, contradictory, and frequently wrong. The commander who prevails is not the one with the best plan but the one who adapts most effectively to the gap between plan and reality.')}
          </p>
          <blockquote>
            ${msg('"War is the realm of uncertainty; three quarters of the factors on which action in war is based are wrapped in a fog of greater or lesser uncertainty."')}
            <cite>${msg('\u2014 Carl von Clausewitz, On War (1832)')}</cite>
          </blockquote>
          <p>
            ${msg('And beneath both: Clausewitz\u2019s most famous insight. "War is merely the continuation of policy by other means." Conflict is never purely military \u2014 it is the expression of political interests through the medium of force. In metaverse.center\u2019s Epochs, competitive play is the continuation of worldbuilding by other means. Your simulation\u2019s quality, social dynamics, and strategic position are the "policy" that your operative deployments express.')}
          </p>
        `,
      },
      {
        id: 'game-theory',
        tocLabel: msg('Game Theory'),
        number: '02',
        title: msg('The Mathematics of Strategic Interaction'),
        content: html`
          <p>
            ${msg('John von Neumann and Oskar Morgenstern\u2019s Theory of Games and Economic Behavior (1944) formalized what Sun Tzu had intuited: that strategic interaction can be modeled mathematically. In 1950, John Nash proved that every finite game has at least one equilibrium \u2014 a point where no player can improve their outcome by unilaterally changing strategy. The Nash equilibrium doesn\u2019t mean players are satisfied; it means no one can do better alone.')}
          </p>
          <p>
            ${msg('The prisoner\u2019s dilemma, formalized by Albert Tucker in 1950, captures the core tension of multiplayer strategy: mutual cooperation produces the best collective outcome, but individual defection is always tempting. Robert Axelrod\u2019s The Evolution of Cooperation (1984) demonstrated through iterated tournaments that "tit for tat" \u2014 cooperate first, then mirror your opponent\u2019s previous move \u2014 is remarkably robust. But only in repeated games. In one-shot encounters, defection dominates.')}
          </p>
          <p>
            ${msg('metaverse.center\u2019s Epochs are iterated games with a twist: players remember. Alliance formation carries reputational consequences across epochs. A player known for betrayal will find it harder to form alliances in future matches. The mathematical structure of the prisoner\u2019s dilemma is implemented not as an abstract model but as a lived social dynamic with lasting consequences.')}
          </p>
        `,
      },
      {
        id: 'diplomacy',
        tocLabel: msg('Diplomacy'),
        number: '03',
        title: msg('The Purest Strategy Game'),
        content: html`
          <p>
            ${msg('In 1959, Allan Calhamer self-published 500 copies of Diplomacy, a board game he had developed at Harvard while reading Sidney Bradshaw Fay\u2019s The Origins of the World War. Seven players represent European great powers on the eve of World War I. Three radical innovations for 1959: no random elements (no dice, no cards, no chance), simultaneous movement (all players write orders secretly, then reveal them at once), and negotiation as core mechanic. Foreign Policy called it "a game that ruins friendships and shapes careers."')}
          </p>
          <p>
            ${msg('Everything in Diplomacy is negotiation. Players spend most of their time talking: forming alliances, coordinating moves, making promises, and breaking them. The game\u2019s depth comes entirely from human interaction. Henry Kissinger reportedly called it his favorite game. John F. Kennedy was a devotee. The game proved that strategic depth requires not mechanical complexity but relational complexity.')}
          </p>
          <p>
            ${msg('metaverse.center\u2019s Epoch system draws from Diplomacy\u2019s design philosophy. The operative system provides mechanical structure, but strategic depth emerges from player interaction: alliance negotiation, intelligence sharing, coordinated operations, and the ever-present possibility of betrayal. The question is never just "what should I do?" but "what are they thinking I\u2019m thinking they\u2019re thinking?"')}
          </p>
        `,
      },
      {
        id: 'eve-online',
        tocLabel: msg('EVE Online'),
        number: '04',
        title: msg('Emergent History in Digital Space'),
        content: html`
          <p>
            ${msg('EVE Online, launched in 2003 by CCP Games, is the most compelling demonstration that virtual worlds can produce genuine strategic complexity. Its player-run economy, territorial sovereignty system, and corporate espionage mechanics have produced events that rival historical conflicts \u2014 documented by gaming press and Andrew Groen\u2019s Empires of EVE (2016).')}
          </p>
          <p>
            ${msg('The Battle of B-R5RB (January 27\u201328, 2014) began when player corporation H A V O C failed to make a scheduled sovereignty payment to CONCORD. Whether human error, bug, or sabotage remains disputed. The lapsed payment made their station vulnerable. What followed: 7,548 player characters over 21 hours, with 2,670 simultaneous players in a single system. Over 11 trillion ISK destroyed \u2014 an estimated $300,000\u2013$330,000 in real-world value. CCP erected a permanent in-game monument, "The Titanomachy," from the non-salvageable capital ship wrecks. The battle was not designed. It emerged from the interaction of economic systems, political alliances, and a clerical error.')}
          </p>
          <p>
            ${msg('Earlier, in February 2009, a Goonswarm intelligence operative known as Haargoth Agamar executed one of the most audacious acts of espionage in gaming history. Having infiltrated the Band of Brothers alliance as a Director-level spy, he seized all assets and disbanded the entire alliance from within, collapsing years of player-built political infrastructure in a single act. He left a note: "The Mittani sends his regards." By June 2009, BoB\u2019s successor organization had permanently dissolved. Years of player-built sovereignty, destroyed by one infiltrator with the right access.')}
          </p>
          <p>
            ${msg('These events \u2014 unscripted, player-driven, with real emotional and economic consequences \u2014 demonstrate that competitive virtual worlds can produce narratives of genuine strategic depth. metaverse.center aims for this kind of emergence: systems that create the conditions for player-driven history, not scripted scenarios.')}
          </p>
        `,
      },
      {
        id: 'asymmetric-warfare',
        tocLabel: msg('Asymmetry'),
        number: '05',
        title: msg('When the Weak Defeat the Strong'),
        content: html`
          <p>
            ${msg('Asymmetric warfare theory studies how weaker actors can prevail against stronger opponents through unconventional means. The concept is ancient \u2014 David and Goliath, guerrilla resistance, economic disruption \u2014 but Ivan Arreguin-Toft\u2019s How the Weak Win Wars (2005) demonstrated empirically that the weaker side wins asymmetric conflicts approximately 30% of the time, and that this percentage has been increasing over the centuries.')}
          </p>
          <p>
            ${msg('The key insight is that weaker actors win by refusing to fight on the stronger actor\u2019s terms. If the strong opponent excels at military confrontation, the weak actor shifts to diplomacy, propaganda, or economic disruption. If the strong opponent\u2019s strength is in alliances, the weak actor targets those alliances with infiltration and division.')}
          </p>
          <p>
            ${msg('metaverse.center\u2019s five-dimensional scoring system is specifically designed to enable asymmetric strategies. A player with inferior military resources can win through diplomatic excellence, cultural influence, or defensive resilience. The operative system provides six different tools of statecraft \u2014 intelligence, sabotage, propaganda, assassination, defense, infiltration \u2014 ensuring that players always have options beyond direct confrontation.')}
          </p>
          <p>
            ${msg('This is strategic design with philosophical intent. Games with single dominant strategies produce solved games and bored players. Games with asymmetric dynamics produce stories, surprises, and the kind of emergent complexity that keeps players coming back.')}
          </p>
        `,
      },
      {
        id: 'your-strategy',
        tocLabel: msg('Your Strategy'),
        number: '06',
        title: msg('Write Your Own Strategic History'),
        content: html`
          <p>
            ${msg('Sun Tzu fought with swords. Clausewitz fought with muskets and cannon. Von Neumann fought with mathematics. Calhamer fought with cardboard and diplomacy. CCP Games fought with internet spaceships.')}
          </p>
          <p>
            ${msg('On metaverse.center, you fight with worlds. Your simulation is your strategic asset: its agents, its buildings, its social dynamics, its connections to other worlds. Epochs are the arena. Operatives are your instruments. Alliances are your force multiplier \u2014 and your vulnerability.')}
          </p>
          <p>
            ${msg('Twenty-five centuries of strategic thought converge in a single question: given incomplete information, competing objectives, and unreliable allies, what do you do? The Epoch Command Center is open. The multiverse is waiting. What\u2019s your move?')}
          </p>
        `,
      },
    ],

    faqs: [
      {
        question: msg('What strategic depth does metaverse.center offer?'),
        answer: msg(
          'Competitive Epochs feature six operative types, five scoring dimensions, an alliance system with betrayal mechanics, multi-world strategic topology, and AI bot opponents with distinct personality archetypes. The system rewards adaptability, intelligence gathering, and multi-dimensional thinking.',
        ),
      },
      {
        question: msg('How do alliances work in competitive play?'),
        answer: msg(
          'Players can propose and accept alliances during Epochs. Alliances provide +15% diplomatic bonuses. However, attacking an ally dissolves the alliance with potential score penalties. Like the prisoner\u2019s dilemma, cooperation and betrayal are both viable strategies with real consequences.',
        ),
      },
      {
        question: msg('Can a weaker player defeat a stronger one?'),
        answer: msg(
          'Yes. Five scoring dimensions mean that military strength alone cannot guarantee victory. A player with inferior offensive capability can win through diplomatic excellence, cultural influence, defensive resilience, or intelligence superiority. The system deliberately enables asymmetric strategies.',
        ),
      },
      {
        question: msg('What is the Nash equilibrium in Epochs?'),
        answer: msg(
          'The Nash equilibrium \u2014 where no player can improve their outcome by unilaterally changing strategy \u2014 is emergent and unknowable in advance. With five dimensions, six operative types, and alliance dynamics, the strategic space is too complex for any single dominant strategy.',
        ),
      },
      {
        question: msg('How does metaverse.center compare to Diplomacy or EVE Online?'),
        answer: msg(
          'Like Diplomacy, depth comes from negotiation and trust dynamics rather than random chance. Like EVE Online, the system creates conditions for unscripted player-driven history. Unlike both, metaverse.center adds AI-powered worlds where the civilization itself is the strategic asset.',
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
        label: msg('Strategy Game'),
        href: '/strategy-game',
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
      wordCount: 1900,
    },
  };
}
