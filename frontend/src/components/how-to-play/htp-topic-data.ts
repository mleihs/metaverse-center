/**
 * How-to-Play — Topic Registry for Phase 3 Guide Hub + Topic Pages.
 *
 * Each topic defines metadata (slug, title, icon, accent, readTime),
 * TL;DR bullets, content section descriptors, and navigation links.
 *
 * Content rendering delegates to existing getter functions in
 * htp-content-features.ts and htp-content-rules.ts — no duplication.
 *
 * Topics that existed as inline HTML in the monolith (intro, epochs,
 * getting-started, phases, alliances, academy-mode, results-screen)
 * have their content embedded as structured callout/text arrays.
 */

import { msg } from '@lit/localize';
import { html, type TemplateResult } from 'lit';
import type { IconKey } from '../../utils/icons.js';
import type { DemoStep } from './htp-types.js';
import type { ForgeStep } from './htp-content-features.js';
import {
  getAgentChatGuideSteps,
  getAgentMemoryGuideSteps,
  getAmbientWeatherGuideSteps,
  getBotPlayersGuideSteps,
  getBureauTerminalGuideSteps,
  getChronicleGuideSteps,
  getEpochCommsGuideSteps,
  getEventsGuideSteps,
  getForgeGuideSteps,
  getLivingWorldGuideSteps,
  getMultiverseMapGuideSteps,
  getResonanceGuideSteps,
  getSimulationHealthGuideSteps,
  getSimulationLoreGuideSteps,
  getSocialTrendsGuideSteps,
  getSubstratePulseGuideSteps,
  getZoneDynamicsGuideSteps,
} from './htp-content-features.js';
import {
  getBleedThresholdRules,
  getBleedVectors,
  getEchoLifecycle,
  getEchoStrengthFormula,
  getEmbassyInfo,
  getNormalizationRules,
  getOperativeCards,
  getPhases,
  getRpRules,
  getScoreDimensions,
  getScorePresets,
  getSuccessFormula,
} from './htp-content-rules.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type CalloutType = 'info' | 'tip' | 'warn' | 'danger';

export interface TopicCallout {
  type: CalloutType;
  label: string;
  text: string;
}

export interface TopicReadout {
  label: string;
  value: string;
}

/**
 * A content section within a topic page.
 *
 * - 'steps': renders DemoStep[] from a getter function
 * - 'callouts': renders inline callout cards
 * - 'readout': renders a key-value readout grid
 * - 'text': renders paragraph text
 * - 'custom': renders arbitrary Lit HTML (for unique layouts like phases, operatives, scoring)
 */
export type TopicSection =
  | { kind: 'steps'; title: string; steps: () => (DemoStep | ForgeStep)[] }
  | { kind: 'callouts'; items: TopicCallout[] }
  | { kind: 'readout'; title?: string; data: () => TopicReadout[] }
  | { kind: 'text'; content: string }
  | { kind: 'custom'; title?: string; render: () => TemplateResult };

export interface TopicDefinition {
  /** URL slug — used as :topic param */
  slug: string;
  /** Display title */
  title: string;
  /** Icon key from utils/icons.ts (compile-time validated) */
  icon: IconKey;
  /** One-line description for card grid */
  description: string;
  /** CSS variable name for accent color (e.g. '--color-info') */
  accent: string;
  /** Estimated read time label */
  readTime: string;
  /** TL;DR bullets shown in the executive summary box */
  tldr: () => string[];
  /** Content sections rendered in order */
  sections: () => TopicSection[];
  /** Related topic slugs for cross-linking */
  related: string[];
}

// Re-export for consumer convenience
export type { IconKey } from '../../utils/icons.js';

/** All 12 topic definitions, ordered as they appear in the grid. */
export const TOPICS: TopicDefinition[] = [
  // ────────────────────────────────────────────────────────────────────────
  // 01: THE SIMULATION WORLD
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: 'world',
    title: msg('The Simulation World'),
    icon: 'heartbeat',
    description: msg('What is metaverse.center? Simulations, lore, health, and the substrate pulse.'),
    accent: '--color-info',
    readTime: msg('6 min'),
    tldr: () => [
      msg('AI-driven simulations with agents, buildings, events, geography, and lore'),
      msg('Two modes: sandbox (build and explore) and competitive (Epochs)'),
      msg('Simulation health tracks building readiness, zone stability, and embassy effectiveness'),
      msg('The substrate pulse ticks every 4 hours, driving narrative arcs and zone dynamics'),
    ],
    sections: () => [
      {
        kind: 'text',
        content: msg(
          'metaverse.center is a platform for creating and managing AI-driven simulations \u2013 fictional worlds with agents, buildings, events, geography, and lore. Each simulation is a living sandbox: agents have personalities and memories, events shape the narrative, and AI generates everything from character dialogue to newspaper editions.',
        ),
      },
      {
        kind: 'text',
        content: msg(
          'Simulations can be connected to form a multiverse. Events bleed across connections, echoing through dimensional barriers. Embassies establish diplomatic links. The Cartographer\u2019s Map visualizes the entire network as an interactive force-directed graph.',
        ),
      },
      {
        kind: 'callouts',
        items: [
          {
            type: 'info',
            label: msg('Two Modes of Play'),
            text: msg(
              'In sandbox mode, you build and explore your world \u2013 create agents, generate events, chat with characters, import real-world news, and craft lore. In competitive mode, simulations enter Epochs: time-limited PvP matches where players deploy operatives, form alliances, and compete across five scoring dimensions.',
            ),
          },
        ],
      },
      { kind: 'steps', title: msg('Simulation Lore'), steps: getSimulationLoreGuideSteps },
      { kind: 'steps', title: msg('Simulation Health'), steps: getSimulationHealthGuideSteps },
      { kind: 'steps', title: msg('The Substrate Pulse'), steps: getSubstratePulseGuideSteps },
    ],
    related: ['forge', 'agents', 'living-world', 'map'],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 02: THE SIMULATION FORGE
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: 'forge',
    title: msg('The Simulation Forge'),
    icon: 'sparkle',
    description: msg('Create a complete AI-generated world from a single seed idea in 15 minutes.'),
    accent: '--color-primary',
    readTime: msg('8 min'),
    tldr: () => [
      msg('Four-phase wizard: Astrolabe, Drafting Table, Darkroom, Ignition'),
      msg('AI generates geography, agents, buildings, lore, and a visual identity'),
      msg('Every result is unique \u2013 same seed, different anchor, radically different world'),
      msg('Ignition is permanent and consumes 1 Forge Token'),
    ],
    sections: () => [
      { kind: 'steps', title: msg('The Forge Process'), steps: getForgeGuideSteps },
    ],
    related: ['world', 'agents', 'living-world'],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 03: AGENTS & CHAT
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: 'agents',
    title: msg('Agents & Chat'),
    icon: 'messageCircle',
    description: msg('Talk to AI agents who remember your conversations and develop over time.'),
    accent: '--color-epoch-influence',
    readTime: msg('7 min'),
    tldr: () => [
      msg('Agents have personalities, memories, and opinions that evolve'),
      msg('Chat uses 50-message context + semantic memory retrieval (pgvector)'),
      msg('Observations and reflections build a living psychological profile'),
      msg('Memory importance (1\u20135 pips) determines persistence and decay'),
    ],
    sections: () => [
      { kind: 'steps', title: msg('Agent Chat'), steps: getAgentChatGuideSteps },
      { kind: 'steps', title: msg('Agent Memory'), steps: getAgentMemoryGuideSteps },
    ],
    related: ['world', 'living-world', 'terminal'],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 04: EVENTS & DYNAMICS
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: 'events',
    title: msg('Events & Dynamics'),
    icon: 'explosion',
    description: msg('Events drive the narrative: manual, AI-generated, or spawned by game mechanics.'),
    accent: '--color-warning',
    readTime: msg('8 min'),
    tldr: () => [
      msg('Events have impact levels (1\u201310), types, tags, and a status lifecycle'),
      msg('High-impact events trigger zone pressure, cascades, and cross-simulation bleed'),
      msg('Social Trends imports real-world news and transforms it into simulation events'),
      msg('Zone security levels (Low\u2013Critical) directly affect operative success rates'),
    ],
    sections: () => [
      { kind: 'steps', title: msg('Events & Reactions'), steps: getEventsGuideSteps },
      { kind: 'steps', title: msg('Social Trends & Campaigns'), steps: getSocialTrendsGuideSteps },
      { kind: 'steps', title: msg('Event Pressure & Zones'), steps: getZoneDynamicsGuideSteps },
    ],
    related: ['world', 'living-world', 'advanced'],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 05: THE LIVING WORLD
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: 'living-world',
    title: msg('The Living World'),
    icon: 'brain',
    description: msg('Agent autonomy: moods, needs, opinions, relationships, and autonomous events.'),
    accent: '--color-success',
    readTime: msg('10 min'),
    tldr: () => [
      msg('Agents act autonomously between visits \u2013 moods shift, relationships form, events fire'),
      msg('Five core needs (Social, Purpose, Safety, Comfort, Stimulation) drive Utility AI activity selection'),
      msg('Agent mood affects epoch performance: happy agents get +3% operative success'),
      msg('Real-world weather data creates atmospheric zone events via geographic anchoring'),
    ],
    sections: () => [
      { kind: 'steps', title: msg('The Living World'), steps: getLivingWorldGuideSteps },
      { kind: 'steps', title: msg('Ambient Weather'), steps: getAmbientWeatherGuideSteps },
      { kind: 'steps', title: msg('The Chronicle'), steps: getChronicleGuideSteps },
    ],
    related: ['agents', 'events', 'world'],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 06: THE MULTIVERSE MAP
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: 'map',
    title: msg('The Multiverse Map'),
    icon: 'compassRose',
    description: msg('Interactive force-directed graph of the entire multiverse and active epochs.'),
    accent: '--color-info',
    readTime: msg('4 min'),
    tldr: () => [
      msg('Nodes are simulations, edges are cross-dimensional connections'),
      msg('Game instances orbit their parent template during active epochs'),
      msg('Health arcs, sparklines, and operative trails visualize live game state'),
      msg('Battle feed ticker shows public events across all active epochs'),
    ],
    sections: () => [
      { kind: 'steps', title: msg('The Cartographer\u2019s Map'), steps: getMultiverseMapGuideSteps },
    ],
    related: ['world', 'epochs', 'advanced'],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 07: EPOCHS — THE BASICS
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: 'epochs',
    title: msg('Epochs: The Basics'),
    icon: 'crossedSwords',
    description: msg('Time-limited PvP seasons scored across five dimensions. The competitive core.'),
    accent: '--color-danger',
    readTime: msg('7 min'),
    tldr: () => [
      msg('Epochs clone simulations into balanced game instances \u2013 originals stay untouched'),
      msg('Five phases: Lobby, Foundation (+50% RP), Competition, Reckoning (amplified bleed), Completed'),
      msg('All simulations normalized at start: 6 agents, 8 buildings, balanced security'),
      msg('Academy Mode: solo sprint training against AI bots with compressed cycles'),
    ],
    sections: () => [
      {
        kind: 'text',
        content: msg(
          'An Epoch is a competitive season where simulations battle across five dimensions: Stability, Influence, Sovereignty, Diplomatic, and Military. Each epoch is time-limited, divided into phases, and scored in real time. Deploy operatives, forge alliances, sabotage rivals, and climb the leaderboard. Anyone can spectate; only participants can act.',
        ),
      },
      {
        kind: 'callouts',
        items: [
          {
            type: 'info',
            label: msg('Game Instances'),
            text: msg(
              'When an epoch starts, every participating simulation is cloned into a balanced "game instance." Your original simulation (the template) is never modified. All gameplay happens on the clone. When the epoch ends, game instances are archived and your template remains intact.',
            ),
          },
        ],
      },
      {
        kind: 'text',
        content: msg(
          'Any simulation owner can create an epoch. Other players join by accepting an invitation or entering the lobby before it closes.',
        ),
      },
      {
        kind: 'callouts',
        items: [
          {
            type: 'tip',
            label: msg('Creating an Epoch'),
            text: msg(
              'Open the Epoch Command Center from your simulation, choose a scoring preset, set the cycle duration, and launch. You can invite players via email \u2013 each invitation includes a lore-flavored dossier generated by AI.',
            ),
          },
          {
            type: 'info',
            label: msg('Joining an Epoch'),
            text: msg(
              'Accept an email invitation (click the link in the dossier) or navigate to an open epoch in the lobby phase and click Join. You select which simulation to enter with.',
            ),
          },
        ],
      },
      {
        kind: 'readout',
        title: msg('Normalization Rules'),
        data: () => getNormalizationRules().map((r) => ({ label: r.attribute, value: r.normalizedTo })),
      },
      {
        kind: 'callouts',
        items: [
          {
            type: 'warn',
            label: msg('Equal Footing'),
            text: msg(
              'Normalization means a brand-new simulation has the same competitive potential as a fully developed one. Strategy and timing matter more than preparation.',
            ),
          },
        ],
      },
      {
        kind: 'custom',
        title: msg('Phases & Timeline'),
        render: () => {
          const phases = getPhases();
          return html`
            <div class="topic-phases">
              ${phases.map(
                (p, i) => html`
                  <div class="topic-phase">
                    <div class="topic-phase__dot" style="border-color: ${p.color}; background: ${p.color}"></div>
                    <span class="topic-phase__name" style="color: ${p.color}">${p.name}</span>
                    <span class="topic-phase__desc">${p.description}</span>
                    ${i < phases.length - 1 ? html`<span class="topic-phase__arrow" aria-hidden="true">\u25B8</span>` : ''}
                  </div>
                `,
              )}
            </div>
          `;
        },
      },
      {
        kind: 'callouts',
        items: [
          {
            type: 'tip',
            label: msg('Academy Mode'),
            text: msg(
              'Solo training against 2\u20134 AI bot opponents in a sprint format. Academy epochs use a compressed timeline (3-day duration, 4-hour cycles) so you can experience a full competitive season in a single afternoon. Launch from your Dashboard with a single click.',
            ),
          },
          {
            type: 'info',
            label: msg('What You\u2019ll Learn'),
            text: msg(
              'Academy mode uses the same mechanics as full competitive epochs \u2013 the same operative types, scoring dimensions, alliance systems, and fog of war. Use it to experiment with strategies, test agent draft compositions, and learn how different bot personalities respond to pressure.',
            ),
          },
        ],
      },
    ],
    related: ['operatives', 'scoring', 'diplomacy'],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 08: OPERATIVES & MISSIONS
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: 'operatives',
    title: msg('Operatives & Missions'),
    icon: 'operativeSpy',
    description: msg('Six operative types with unique costs, timings, and effects. Deploy wisely.'),
    accent: '--color-warning',
    readTime: msg('6 min'),
    tldr: () => [
      msg('Six types: Spy, Saboteur, Propagandist, Assassin, Guardian, Infiltrator'),
      msg('Each costs RP, takes deploy + mission cycles, and has a score value on success'),
      msg('Success probability: 55% base + aptitude bonus \u2212 zone security \u2212 guardian defense'),
      msg('Detected missions cost \u22123 military and negate the effect'),
    ],
    sections: () => [
      {
        kind: 'text',
        content: msg(
          'Operatives are the instruments of warfare in an epoch. Deploy them to gather intelligence, sabotage infrastructure, spread propaganda, eliminate targets, defend zones, or compromise embassies. Each type has unique costs, timings, and effects.',
        ),
      },
      {
        kind: 'custom',
        title: msg('Operative Types'),
        render: () => {
          const ops = getOperativeCards();
          return html`
            <div class="topic-ops-grid">
              ${ops.map(
                (op) => html`
                  <div class="topic-op-card" style="--_op-color: ${op.color}">
                    <div class="topic-op-card__header">
                      <span class="topic-op-card__name">${op.type}</span>
                      <span class="topic-op-card__cost">${op.rpCost} RP</span>
                    </div>
                    <div class="topic-op-card__stats">
                      <span>${msg('Deploy')}: ${op.deployCycles}c</span>
                      <span>${msg('Mission')}: ${op.missionCycles}c</span>
                      <span>${msg('Score')}: ${op.scoreValue}</span>
                    </div>
                    <p class="topic-op-card__desc">${op.description}</p>
                    <p class="topic-op-card__effect">${op.effect}</p>
                  </div>
                `,
              )}
            </div>
          `;
        },
      },
      {
        kind: 'callouts',
        items: [
          {
            type: 'info',
            label: msg('Success Probability'),
            text: `${getSuccessFormula()}`,
          },
          {
            type: 'danger',
            label: msg('Mission Outcomes'),
            text: msg(
              'Success: the operative completes its mission and earns score value. Failed: the mission has no effect but is not detected. Detected: the mission fails AND you lose 3 military score. Counter-intelligence sweeps (4 RP) increase detection chance.',
            ),
          },
        ],
      },
      {
        kind: 'readout',
        title: msg('Embassies & Ambassadors'),
        data: getEmbassyInfo,
      },
      {
        kind: 'callouts',
        items: [
          {
            type: 'tip',
            label: msg('Ambassador Role'),
            text: msg(
              'Ambassadors are special agent statuses that boost embassy effectiveness and feed into the diplomatic scoring formula. They are prime targets for assassins.',
            ),
          },
        ],
      },
    ],
    related: ['epochs', 'scoring', 'diplomacy'],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 09: SCORING & ECONOMY
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: 'scoring',
    title: msg('Scoring & Economy'),
    icon: 'trophy',
    description: msg('Five scoring dimensions, RP economy, weighted presets, and the composite formula.'),
    accent: '--color-primary',
    readTime: msg('6 min'),
    tldr: () => [
      msg('Five dimensions: Stability, Influence, Sovereignty, Diplomatic, Military'),
      msg('Weighted presets (Balanced, Builder, Warmonger, Diplomat) shape strategy'),
      msg('RP economy: 12/cycle base, 40 cap, Foundation +50% bonus'),
      msg('Each dimension has a title awarded to its leader (The Unshaken, The Resonant, etc.)'),
    ],
    sections: () => [
      {
        kind: 'readout',
        title: msg('Resonance Points (RP)'),
        data: getRpRules,
      },
      {
        kind: 'custom',
        title: msg('Scoring Dimensions'),
        render: () => {
          const dims = getScoreDimensions();
          return html`
            <div class="topic-dims">
              ${dims.map(
                (d) => html`
                  <div class="topic-dim-block">
                    <div class="topic-dim-block__header">
                      <span class="topic-dim-block__name" style="color: ${d.color}">${d.name}</span>
                      <span class="topic-dim-block__title">${d.title}</span>
                    </div>
                    <code class="topic-dim-block__formula">${d.formula}</code>
                    <p class="topic-dim-block__explanation">${d.explanation}</p>
                  </div>
                `,
              )}
            </div>
          `;
        },
      },
      {
        kind: 'custom',
        title: msg('Scoring Presets'),
        render: () => {
          const presets = getScorePresets();
          const dims = getScoreDimensions();
          return html`
            <div class="topic-presets-table">
              <div class="topic-presets-table__header">
                <span></span>
                ${dims.map((d) => html`<span style="color: ${d.color}">${d.name}</span>`)}
              </div>
              ${presets.map(
                (p) => html`
                  <div class="topic-presets-table__row">
                    <span class="topic-presets-table__name">${p.name}</span>
                    ${dims.map(
                      (d) => html`<span>${p.weights[d.key]}%</span>`,
                    )}
                  </div>
                `,
              )}
            </div>
          `;
        },
      },
    ],
    related: ['epochs', 'operatives', 'diplomacy'],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 10: ALLIANCES & DIPLOMACY
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: 'diplomacy',
    title: msg('Alliances & Diplomacy'),
    icon: 'handshake',
    description: msg('Form alliances, share intelligence, manage tension, and risk betrayal.'),
    accent: '--color-success',
    readTime: msg('5 min'),
    tldr: () => [
      msg('Each ally gives +15% diplomatic score; a 3-member alliance means +30% each'),
      msg('Alliance upkeep: 1 RP per member per cycle (scales with size)'),
      msg('Tension rises on target overlap (+10) and decays naturally (\u22125/cycle); at 80 the alliance dissolves'),
      msg('Betrayal risk: detected attack on ally = \u221225% diplomatic score penalty'),
    ],
    sections: () => [
      {
        kind: 'text',
        content: msg(
          'Form teams with other simulations. Allies share no direct resources, but gain diplomatic scoring bonuses and can coordinate strikes. Embassies serve as deployment channels for operatives.',
        ),
      },
      {
        kind: 'callouts',
        items: [
          {
            type: 'tip',
            label: msg('Alliance Bonus'),
            text: msg('Each active ally gives +15% to your diplomatic score. A 3-member alliance means each member gets +30% diplomatic.'),
          },
          {
            type: 'info',
            label: msg('Alliance Proposals'),
            text: msg(
              'During lobby and foundation phases, players can join alliances instantly. During competition and reckoning, joining requires a proposal that all existing members must unanimously accept. A single rejection immediately declines the proposal. Proposals expire after 2 cycles.',
            ),
          },
          {
            type: 'warn',
            label: msg('Upkeep'),
            text: msg(
              'Alliances cost RP to maintain. Each member pays 1 RP per member per cycle. A 2-member alliance costs 2 RP/cycle each; a 3-member alliance costs 3 RP/cycle each. If your RP reaches 0, upkeep is waived \u2013 you will not go into debt, but you cannot deploy operatives until you earn more RP.',
            ),
          },
          {
            type: 'warn',
            label: msg('Tension'),
            text: msg(
              'Alliance tension rises when allies attack the same target (+10 per overlap). It decays naturally each cycle (\u22125). If tension reaches 80, the alliance automatically dissolves and all members become unaligned. Coordinate your targets to keep tension low.',
            ),
          },
          {
            type: 'tip',
            label: msg('Shared Intelligence'),
            text: msg(
              'Alliance members automatically share battle log intelligence. You can see operations involving your allies \u2013 marked with an [ALLIED INTEL] badge \u2013 giving you broader awareness of the battlefield.',
            ),
          },
          {
            type: 'danger',
            label: msg('Betrayal'),
            text: msg(
              'If allow_betrayal is enabled, allied simulations can attack each other. But beware: if a betrayal mission is detected, the entire alliance dissolves and the betrayer receives a \u221225% diplomatic score penalty. With the Diplomat preset (35% diplomatic weight), this is catastrophic.',
            ),
          },
        ],
      },
      { kind: 'steps', title: msg('Bot Players'), steps: getBotPlayersGuideSteps },
    ],
    related: ['epochs', 'operatives', 'scoring'],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 11: ADVANCED MECHANICS
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: 'advanced',
    title: msg('Advanced Mechanics'),
    icon: 'substrateTremor',
    description: msg('Bleed, echoes, resonances, results screen, and cross-simulation warfare.'),
    accent: '--color-epoch-influence',
    readTime: msg('9 min'),
    tldr: () => [
      msg('Events above impact threshold bleed into connected simulations as echoes'),
      msg('Seven bleed vectors (Commerce, Language, Memory, Resonance, Architecture, Dream, Desire)'),
      msg('Substrate Resonances modify gameplay: boost/suppress operative types, alter RP, shift scores'),
      msg('Results screen reveals all operations with podium, commendations, and dimension breakdowns'),
    ],
    sections: () => [
      {
        kind: 'text',
        content: msg(
          'When events in one simulation exceed the bleed threshold, they echo into connected worlds through dimensional vectors. Resonances emerge from event clustering. The results screen lifts the fog of war. These systems create emergent cross-simulation warfare.',
        ),
      },
      {
        kind: 'custom',
        title: msg('Bleed Vectors'),
        render: () => {
          const vectors = getBleedVectors();
          return html`
            <div class="topic-vector-grid">
              ${vectors.map(
                (v) => html`
                  <div class="topic-vector-card">
                    <span class="topic-vector-card__name" style="color: ${v.color}">${v.name}</span>
                    <p class="topic-vector-card__desc">${v.description}</p>
                    <div class="topic-vector-card__tags">
                      ${v.tags.map((t) => html`<span class="topic-tag">${t}</span>`)}
                    </div>
                  </div>
                `,
              )}
            </div>
          `;
        },
      },
      {
        kind: 'callouts',
        items: [
          {
            type: 'info',
            label: msg('Echo Strength Formula'),
            text: getEchoStrengthFormula(),
          },
        ],
      },
      {
        kind: 'readout',
        title: msg('Bleed Threshold Rules'),
        data: getBleedThresholdRules,
      },
      {
        kind: 'custom',
        title: msg('Echo Lifecycle'),
        render: () => {
          const lifecycle = getEchoLifecycle();
          return html`
            <div class="topic-lifecycle">
              ${lifecycle.map(
                (step, i) => html`
                  <span class="topic-lifecycle__step" style="color: ${step.color}">${step.name}</span>
                  ${i < lifecycle.length - 1 ? html`<span class="topic-lifecycle__arrow" aria-hidden="true">\u2192</span>` : ''}
                `,
              )}
            </div>
          `;
        },
      },
      {
        kind: 'callouts',
        items: [
          {
            type: 'danger',
            label: msg('Cascade Depth'),
            text: msg(
              'Echoes can cascade: an echo arriving in a simulation may trigger events above the threshold in that simulation, generating secondary echoes. Cascade depth is limited to prevent infinite loops but increases during Reckoning phase.',
            ),
          },
          {
            type: 'warn',
            label: msg('Reckoning Amplification'),
            text: msg(
              'During Reckoning phase, the bleed threshold drops by 2 and cascade depth increases by 1. This means more events bleed, and bleed chains go deeper. The multiverse becomes more volatile just when scores matter most.',
            ),
          },
        ],
      },
      { kind: 'steps', title: msg('Substrate Resonances'), steps: getResonanceGuideSteps },
      { kind: 'steps', title: msg('COMMS & Notifications'), steps: getEpochCommsGuideSteps },
      {
        kind: 'callouts',
        items: [
          {
            type: 'info',
            label: msg('Results: Top-3 Podium'),
            text: msg(
              'Gold, silver, and bronze placements with animated score count-ups and dimension titles. Each winner\u2019s strongest scoring dimension is highlighted \u2013 "Master of Influence" or "Sovereign Defender" \u2013 giving flavor to the final standings.',
            ),
          },
          {
            type: 'tip',
            label: msg('MVP Commendations'),
            text: msg(
              'Five commendation titles: Master Spy (highest military impact), Iron Guardian (strongest sovereignty defense), The Diplomat (highest diplomatic score), Most Lethal (best operative success rate), Cultural Domination (greatest influence spread). Multiple awards can go to the same player.',
            ),
          },
          {
            type: 'info',
            label: msg('Five-Dimension Comparison'),
            text: msg(
              'Animated breakdown bars for all five scoring dimensions with per-participant breakdowns. See exactly where each player dominated and where they were vulnerable. All animations respect prefers-reduced-motion.',
            ),
          },
        ],
      },
    ],
    related: ['events', 'epochs', 'scoring'],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 12: BUREAU TERMINAL
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: 'terminal',
    title: msg('Bureau Terminal'),
    icon: 'terminal',
    description: msg('Text-based command interface: 30 commands across 4 tiers, CRT aesthetic.'),
    accent: '--color-primary',
    readTime: msg('7 min'),
    tldr: () => [
      msg('Type commands instead of clicking dashboards \u2013 local perspective, zone-limited view'),
      msg('Tier 1 (Observation): look, go, examine, talk, status, map, where, weather, help'),
      msg('Tier 2 (Field Ops, 10 cmds): fortify, quarantine, assign \u2013 costs Operations Points'),
      msg('Tier 3 (Intel, 25 cmds): scan, investigate, debrief, ask \u2013 costs Intel Points'),
    ],
    sections: () => [
      { kind: 'steps', title: msg('The Bureau Terminal'), steps: getBureauTerminalGuideSteps },
    ],
    related: ['agents', 'epochs', 'operatives'],
  },
];

// ── Lookup Utilities ──────────────────────────────────────────────────────

/** Get a topic by its URL slug. */
export function getTopicBySlug(slug: string): TopicDefinition | undefined {
  return TOPICS.find((t) => t.slug === slug);
}

/** Get adjacent topics for prev/next navigation. */
export function getAdjacentTopics(slug: string): { prev?: TopicDefinition; next?: TopicDefinition } {
  const idx = TOPICS.findIndex((t) => t.slug === slug);
  if (idx === -1) return {};
  return {
    prev: idx > 0 ? TOPICS[idx - 1] : undefined,
    next: idx < TOPICS.length - 1 ? TOPICS[idx + 1] : undefined,
  };
}

/** Get all topic slugs (for search index building). */
export function getAllTopicSlugs(): string[] {
  return TOPICS.map((t) => t.slug);
}
