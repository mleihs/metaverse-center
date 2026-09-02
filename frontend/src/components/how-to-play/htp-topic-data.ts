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
import type { DemoStep } from './htp-types.js';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * All valid HTP topic slugs. Adding a new topic requires adding its slug here
 * AND adding the full entry to the TOPICS array below — the compiler enforces both.
 * Every call-site that references a slug (VelgHelpTip `topic` property, `related`
 * cross-links, router params) narrows against this union.
 */
export type TopicSlug =
  | 'world'
  | 'loot'
  | 'forge'
  | 'byok'
  | 'agents'
  | 'bonds'
  | 'events'
  | 'living-world'
  | 'map'
  | 'epochs'
  | 'operatives'
  | 'scoring'
  | 'diplomacy'
  | 'advanced'
  | 'terminal'
  | 'dungeons'
  | 'commendations'
  | 'journal'
  | 'drift';

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
  slug: TopicSlug;
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
  related: TopicSlug[];
  /**
   * Eine EIGENE Route statt der Themenseite — fuer Themen, die ihren Inhalt
   * LADEN statt ihn zu tragen.
   *
   * Der Beutekatalog war zuerst nur eine Route und kein Thema. Folge, vom
   * Nutzer gemeldet: die Suche fand ihn nicht (ihr Index liest `TOPICS`), und
   * im Dungeon-Thema stand seine Adresse als Fliesstext zum Abtippen. Eine
   * Seite, die man nur durch Eintippen erreicht, ist gebaut und nicht
   * vorhanden.
   *
   * Ein Thema mit `route` traegt Titel, Beschreibung und Kurzfassung wie jedes
   * andere — das ist es, was die Suche indiziert — und schickt den Leser dann
   * an seinen eigenen Ort statt an /guide/:slug.
   */
  route?: string;
}

// Re-export for consumer convenience
export type { IconKey } from '../../utils/icons.js';

/** All topic definitions, ordered as they appear in the grid. */
export const TOPICS: TopicDefinition[] = [
  // ────────────────────────────────────────────────────────────────────────
  // 01: THE SIMULATION WORLD
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: 'world',
    title: msg('The Simulation World'),
    icon: 'heartbeat',
    description: msg(
      'What is metaverse.center? Simulations, lore, health, and the substrate pulse.',
    ),
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
    sections: () => [{ kind: 'steps', title: msg('The Forge Process'), steps: getForgeGuideSteps }],
    related: ['world', 'agents', 'living-world', 'byok'],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 02b: BRING YOUR OWN KEY (BYOK)
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: 'byok',
    title: msg('Bring Your Own Key'),
    icon: 'key',
    description: msg(
      'Optionally run the Forge on your own OpenRouter and Replicate accounts instead of the project key.',
    ),
    accent: '--color-primary',
    readTime: msg('4 min'),
    tldr: () => [
      msg('Entirely optional \u2013 without a key of your own, everything runs on the project key'),
      msg('Two keys: OpenRouter (text) and Replicate (imagery), stored AES-256 encrypted'),
      msg('It reaches the Forge and the autonomous events of worlds you own \u2013 not chat'),
      msg('A platform admin enables it per account; the token waiver is a separate switch'),
      msg('Costs are billed directly to your OpenRouter and Replicate accounts'),
      msg('Enter them under Keyring in your personnel file'),
    ],
    sections: () => [
      {
        kind: 'text',
        content: msg(
          'BYOK is a mode, not a rule. Without a key of your own, every AI operation on the platform runs on the project key \u2013 that is the normal case, it costs you nothing, and nothing here needs doing. A key you enter is used instead of the project key wherever it reaches, and the bill goes to your provider account rather than to the platform.',
        ),
      },
      {
        kind: 'callouts',
        items: [
          {
            type: 'warn',
            label: msg('Where the key actually reaches'),
            text: msg(
              'Two places, not everywhere: the Forge \u2013 the whole world-building run, including lore, theme, translations and the Darkroom images \u2013 and phase 9 of the heartbeat, the autonomous events of worlds you own. Chat, the chronicle, resonance, the dungeon, the bureau terminal and social posts run on the model configuration of the world they belong to and never see a personal key.',
            ),
          },
          {
            type: 'info',
            label: msg('OpenRouter \u2013 Language Relay'),
            text: msg(
              'Powers the text side of the Forge: Astrolabe research, philosophical anchors, agents and buildings, lore, dossiers and their translations. An OpenRouter account gives you routed access to Claude, GPT, Gemini, Llama and dozens of other models under a single key.',
            ),
          },
          {
            type: 'info',
            label: msg('Replicate \u2013 Visual Array'),
            text: msg(
              'Powers Darkroom rendering, agent portraits, building imagery and simulation lore visuals. Replicate hosts the FLUX and Stable Diffusion image pipelines that the platform calls for every visual generation.',
            ),
          },
        ],
      },
      {
        kind: 'text',
        content: msg(
          'Both keys are encrypted with AES-256 at rest and never leave the server. After you enter one, the panel only reports that a key is on file and when it was last confirmed at the provider \u2013 the value itself is never shown again. Revoking deletes the stored key. If an administrator withdraws permission, or switches personal keys off platform-wide, your key stops being used from the very next call.',
        ),
      },
      {
        kind: 'callouts',
        items: [
          {
            type: 'tip',
            label: msg('Two switches, not one'),
            text: msg(
              'Whether you may use a personal key and whether forging then costs you no tokens are separate decisions, both made by a platform admin. A key of your own does not automatically waive the forge tokens \u2013 the waiver is granted, and it only takes effect once both keys are on file, since only then does the platform stop paying.',
            ),
          },
          {
            type: 'warn',
            label: msg('Cost responsibility'),
            text: msg(
              'While your key is in use, those calls are billed directly to your OpenRouter and Replicate accounts. The platform does not cap, proxy or throttle those charges, and they do not count against its own budget. Review your usage dashboards on both providers after heavy sessions.',
            ),
          },
        ],
      },
      {
        kind: 'readout',
        title: msg('Where to enter keys'),
        data: () => [
          {
            label: msg('Keyring'),
            value: msg(
              'In your personnel file, next to Identity and Correspondence \u2013 the key belongs to you, not to a world.',
            ),
          },
          {
            label: msg('Admin \u2192 Forge'),
            value: msg('Platform admins reach the same panel in SEC-08.'),
          },
          {
            label: msg('Not the same thing'),
            value: msg(
              'Settings \u2192 Integrations sets AI provider keys for ONE world, paid by whoever owns it. That is a world\u2019s setting, not your key.',
            ),
          },
        ],
      },
      {
        kind: 'text',
        content: msg(
          'Get your keys at openrouter.ai/keys and replicate.com/account/api-tokens. Enter them under Keyring in your personnel file, use Verify Clearance to confirm a live round-trip, and register. If the section says the account runs on the project key, personal keys have not been enabled for you \u2013 an administrator does that.',
        ),
      },
    ],
    related: ['forge', 'world'],
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
    related: ['world', 'living-world', 'bonds', 'terminal'],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 03b: AGENT BONDS
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: 'bonds',
    title: msg('Agent Bonds'),
    icon: 'handshake',
    description: msg(
      'Form emotional bonds with agents who notice your attention and begin sharing their inner thoughts.',
    ),
    accent: '--color-primary',
    readTime: msg('4 min'),
    tldr: () => [
      msg('Bonds form through accumulated attention \u2013 visit agent detail pages over 14+ days'),
      msg('Bonded agents generate whispers \u2013 short, mood-dependent first-person messages'),
      msg('5 bond depths from Acquaintance to Resonance, each unlocking deeper whisper types'),
      msg('Max 5 bonds per simulation \u2013 who you choose matters'),
      msg('No loss aversion: bonds never decay from absence, agents wait patiently'),
    ],
    sections: () => [
      {
        kind: 'text' as const,
        content: msg(
          'Visit an agent\u2019s detail page regularly. After enough attention (configurable, default 10 visits over at least 14 days), the agent notices your presence and offers a bond. Accept to begin receiving whispers \u2013 short, mood-dependent first-person messages that reflect the agent\u2019s inner life. Whispers come in 5 types: state (mood reflection), event (nearby happenings), memory (your past actions), question (implicit requests for help), and reflection (the agent observing your patterns). Bonds deepen through engagement \u2013 reading whispers, acting on requests, and time. Depth 1 (Acquaintance) unlocks state and event whispers. By Depth 5 (Resonance), the agent writes directly into your Resonance Journal.',
        ),
      },
    ],
    related: ['agents', 'living-world'],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 04: EVENTS & DYNAMICS
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: 'events',
    title: msg('Events & Dynamics'),
    icon: 'explosion',
    description: msg(
      'Events drive the narrative: manual, AI-generated, or spawned by game mechanics.',
    ),
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
    description: msg(
      'Agent autonomy: moods, needs, opinions, relationships, and autonomous events.',
    ),
    accent: '--color-success',
    readTime: msg('10 min'),
    tldr: () => [
      msg(
        'Agents act autonomously between visits \u2013 moods shift, relationships form, events fire',
      ),
      msg(
        'Five core needs (Social, Purpose, Safety, Comfort, Stimulation) drive Utility AI activity selection',
      ),
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
    description: msg(
      'Interactive force-directed graph of the entire multiverse and active epochs.',
    ),
    accent: '--color-info',
    readTime: msg('4 min'),
    tldr: () => [
      msg('Nodes are simulations, edges are cross-dimensional connections'),
      msg('Game instances orbit their parent template during active epochs'),
      msg('Health arcs, sparklines, and operative trails visualize live game state'),
      msg('Battle feed ticker shows public events across all active epochs'),
      msg('Each simulation also has its own street-level world map, separate from this one'),
    ],
    sections: () => [
      {
        kind: 'steps',
        title: msg('The Cartographer\u2019s Map'),
        steps: getMultiverseMapGuideSteps,
      },
      {
        kind: 'callouts',
        items: [
          {
            type: 'info',
            label: msg('Two Different Maps'),
            text: msg(
              'The Cartographer\u2019s Map shows the multiverse: simulations as nodes, embassies as edges. Every simulation also has its own world map \u2013 a street-level view of that one world, with its zones as coloured districts, its street network, and every building placed where it stands. Open it from the simulation\u2019s own navigation, not from here.',
            ),
          },
          {
            type: 'tip',
            label: msg('Where the Streets Come From'),
            text: msg(
              'A world map is generated once, when the simulation is forged: the zones are laid out first, then a street network is grown through them, then buildings are placed along the streets. Agents are assigned homes in the process. Adding a building later places it on the existing network rather than redrawing the city.',
            ),
          },
        ],
      },
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
    description: msg(
      'Time-limited PvP seasons scored across five dimensions. The competitive core.',
    ),
    accent: '--color-danger',
    readTime: msg('7 min'),
    tldr: () => [
      msg('Epochs clone simulations into balanced game instances \u2013 originals stay untouched'),
      msg(
        'Five phases: Lobby, Foundation (+50% RP), Competition, Reckoning (amplified bleed), Completed',
      ),
      msg('All simulations normalized at start: 6 agents, 8 buildings, balanced security'),
      msg('Academy Mode: solo sprint training against AI bots with compressed cycles'),
    ],
    sections: () => [
      // Frist, Passen, AFK und die KI-Übernahme standen nirgends in der Hilfe,
      // obwohl sie das Einzige sind, was einem Spieler PASSIERT, ohne dass er
      // handelt. Alle Zahlen aus `EpochConfig` (backend/models/epoch.py) — der
      // Text nennt die Vorgabe und sagt dazu, dass sie je Epoche einstellbar ist.
      {
        kind: 'callouts',
        items: [
          {
            type: 'warn',
            label: msg('The deadline'),
            text: msg(
              'Every cycle has an end. By default it is 8 hours, adjustable per epoch between 15 minutes and 48. When it passes, the cycle resolves with whatever has been filed. It does not wait.',
            ),
          },
          {
            type: 'info',
            label: msg('Passing'),
            text: msg(
              'Declaring ready with no orders is a legitimate move, not a forfeit. A cycle in which everyone is ready early does not resolve instantly: the deadline is pulled forward to the earliest legal moment instead, so a fast table cannot turn an eight-hour cycle into eight seconds.',
            ),
          },
          {
            type: 'danger',
            label: msg('Missing a cycle'),
            text: msg(
              'Filing nothing at all is different from passing. Where the AFK penalty is switched on for the epoch, it costs 2 RP by default, and the reminder that goes out before the deadline names the actual figure for your epoch.',
            ),
          },
          {
            type: 'danger',
            label: msg('The AI takeover'),
            text: msg(
              'After three consecutive missed cycles, an AI takes the seat and plays it for you. Which personality it uses is set by the epoch, sentinel by default. You get the seat back by filing orders again; the AI does not keep it.',
            ),
          },
          {
            type: 'tip',
            label: msg('The warning'),
            text: msg(
              'Two hours before a deadline, everyone who has not filed gets a mail naming the cycle, the time left and the exact penalty. Until this existed, the system deducted RP and handed over a seat with no notice at all.',
            ),
          },
        ],
      },
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
        data: () =>
          getNormalizationRules().map((r) => ({ label: r.attribute, value: r.normalizedTo })),
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
      msg(
        'Success probability: 55% base + aptitude bonus \u2212 zone security \u2212 guardian defense',
      ),
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
    description: msg(
      'Five scoring dimensions, RP economy, weighted presets, and the composite formula.',
    ),
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
                    ${dims.map((d) => html`<span>${p.weights[d.key]}%</span>`)}
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
      msg(
        'Tension rises on target overlap (+10) and decays naturally (\u22125/cycle); at 80 the alliance dissolves',
      ),
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
            text: msg(
              'Each active ally gives +15% to your diplomatic score. A 3-member alliance means each member gets +30% diplomatic.',
            ),
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
      msg(
        'Seven bleed vectors (Commerce, Language, Memory, Resonance, Architecture, Dream, Desire)',
      ),
      msg(
        'Substrate Resonances modify gameplay: boost/suppress operative types, alter RP, shift scores',
      ),
      msg(
        'Results screen reveals all operations with podium, commendations, and dimension breakdowns',
      ),
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
    description: msg('Text-based command interface: 32 commands across 4 tiers, CRT aesthetic.'),
    accent: '--color-primary',
    readTime: msg('7 min'),
    tldr: () => [
      msg(
        'Type commands instead of clicking dashboards \u2013 local perspective, zone-limited view',
      ),
      msg('Tier 1 (Observation): look, go, examine, talk, status, map, where, weather, help'),
      msg(
        'Tier 2 (Field Ops, unlocks after 10 commands): fortify, quarantine, assign \u2013 costs Operations Points',
      ),
      msg(
        'Tier 3 (Intel, unlocks after 25 commands): scan, investigate, debrief, ask \u2013 costs Intel Points',
      ),
      msg(
        'Tier 4 (Epoch Ops): sitrep, dossier, threats, intercept \u2013 granted during an active epoch',
      ),
    ],
    sections: () => [
      { kind: 'steps', title: msg('The Bureau Terminal'), steps: getBureauTerminalGuideSteps },
    ],
    related: ['agents', 'epochs', 'operatives', 'dungeons'],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 13: RESONANCE DUNGEONS
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: 'dungeons',
    title: msg('Resonance Dungeons'),
    icon: 'dungeonMap',
    description: msg(
      'Procedural dungeons born from substrate resonances. Combat, loot, and permanent agent upgrades.',
    ),
    accent: '--color-danger',
    readTime: msg('10 min'),
    tldr: () => [
      msg('Substrate resonances spawn explorable dungeons with FTL-style node maps'),
      msg('Phase-based combat: 60-second planning phase, then simultaneous resolution'),
      msg(
        '8 dungeon archetypes \u2013 each tied to a resonance type with unique enemies and encounters',
      ),
      msg('Loot grants permanent aptitude boosts (+2 cap per agent), memories, and moodlets'),
      msg('Party of 2 to 4 agents \u2013 condition tracks from Operational to Afflicted'),
      msg('Two ways to play the same run: the terminal war room, or the rendered 2D view'),
    ],
    sections: () => [
      {
        kind: 'text',
        content: msg(
          'Resonance Dungeons transform substrate resonances into explorable procedural dungeons. When a resonance event occurs in your simulation, it may open a dungeon tied to that resonance archetype. Each dungeon is a branching node graph \u2013 inspired by FTL \u2013 where your agents explore rooms, face encounters, and fight enemies shaped by the resonance that spawned the dungeon.',
        ),
      },
      {
        kind: 'callouts',
        items: [
          {
            type: 'info',
            label: msg('How to Enter'),
            text: msg(
              'Navigate to the Terminal tab and type "dungeon" to see available dungeons. Select an archetype and choose your party (2 to 4 agents \u2013 a single agent is refused). The dungeon launches in the terminal with a submarine war room HUD showing the map, party status, and combat interface.',
            ),
          },
          {
            type: 'tip',
            label: msg('Terminal or Rendered View'),
            text: msg(
              'The same run can be played two ways. The terminal war room is the original: everything as text, typed commands, full command history. The rendered view draws the same dungeon \u2013 the node map with fog of war, enemy portraits in the scene, the party along the bottom, and a chronicle that keeps the narration you would otherwise read in the terminal. Switch with the toggle in the dungeon header; your choice is remembered on this device. Nothing about the run changes \u2013 the same engine, the same rolls, the same loot.',
            ),
          },
        ],
      },
      {
        kind: 'text',
        content: msg(
          'Gameplay flows through room exploration: move between connected nodes on the dungeon map, each containing encounters, treasure, rest points, or the final boss. Encounters range from skill checks (using agent aptitudes and personality) to full combat sequences. Rooms you have visited are marked; rooms ahead show threat indicators based on scouting.',
        ),
      },
      {
        kind: 'callouts',
        items: [
          {
            type: 'warn',
            label: msg('Combat System'),
            text: msg(
              'Combat is phase-based. During the 60-second planning phase, assign abilities from 7 schools \u2013 one per operative type, plus a universal school every agent always has \u2013 to your agents. Then the round resolves simultaneously \u2013 your agents and the enemies act at the same time. Agents have condition tracks (Operational, Stressed, Wounded, Afflicted) and accumulate stress. If the entire party is defeated, the run is wiped and agents suffer trauma outcomes.',
            ),
          },
          {
            type: 'tip',
            label: msg('Ability Schools'),
            text: msg(
              'Each operative type unlocks a school of abilities. Spy abilities reveal enemy weaknesses. Guardian abilities protect allies. Saboteur abilities deal area damage. Propagandist abilities manipulate enemy stress. Infiltrator abilities bypass defenses. Assassin abilities deal concentrated damage. Higher agent aptitudes unlock stronger abilities within each school.',
            ),
          },
        ],
      },
      {
        kind: 'text',
        content: msg(
          'After defeating the boss, you enter the Debrief Terminal \u2013 a loot distribution phase where you assign rewards to individual party members. 105 pieces exist across the eight archetypes, in twelve effect types: aptitude boosts (capped at +2 per agent, so no agent becomes untouchable), memories that shape personality, moodlets that fade on their own, event and arc modifiers, permanent and next-run bonuses, and building repair \u2013 the only way a ruined building ever recovers. The full catalogue, with what each effect does and which archetype drops it, is the Loot Catalogue topic.',
        ),
      },
      {
        kind: 'callouts',
        items: [
          {
            type: 'info',
            label: msg('The 8 Archetypes'),
            text: msg(
              'Each resonance type spawns a distinct dungeon archetype: The Shadow (darkness and visibility), The Tower (structural stability), The Entropy (dissolution and decay), The Devouring Mother (parasitic attachment), The Prometheus (crafting and stolen knowledge), The Deluge (rising water and salvage), The Awakening (consciousness and memory), The Overthrow (political fracture and factions). Archetype determines enemy types, room layouts, encounter difficulty, and available loot.',
            ),
          },
          {
            type: 'info',
            label: msg('The Shadow'),
            text: msg(
              'Visibility mechanic: 3 points, drain every 2 rooms, restore via combat, treasure, rest, and Spy Observe ability. At visibility 0: increased ambush chance (40%), no enemy preview, +25% stress. Risk-reward: finding loot at visibility 0 grants a 50% chance to upgrade loot tier.',
            ),
          },
          {
            type: 'info',
            label: msg('The Tower'),
            text: msg(
              'Stability countdown: starts at 100, drains per room (faster at depth), per combat round, and on failed checks. At 0: forced evacuation with partial loot only. Guardian Reinforce ability restores +10. Reward: high stability (80+) at loot time grants a 50% chance to upgrade loot tier. Structures that seemed permanent reveal themselves as temporary.',
            ),
          },
        ],
      },
    ],
    related: ['terminal', 'agents', 'operatives', 'advanced'],
  },
  // ────────────────────────────────────────────────────────────────────────
  {
    /*
     * Das einzige Thema, das seinen Inhalt LAEDT statt ihn zu tragen.
     *
     * Es hat deshalb keine `sections`: die 105 Stuecke stehen zweisprachig in
     * der Datenbank und kommen ueber /public/dungeons/loot, aus derselben
     * Registrierung, die der laufende Dungeon benutzt. Was hier steht, ist nur
     * das, was die SUCHE finden koennen muss — Titel, Beschreibung,
     * Kurzfassung.
     *
     * Der Eintrag existiert genau dafuer: als reine Route war der Katalog
     * unauffindbar (der Suchindex liest `TOPICS`), und im Dungeon-Thema stand
     * seine Adresse als Fliesstext.
     */
    slug: 'loot',
    title: msg('Loot Catalogue'),
    icon: 'dungeonMap',
    description: msg(
      'Every piece a dungeon can yield, what it does mechanically, and which archetype drops it.',
    ),
    accent: '--color-accent-amber',
    readTime: msg('Reference'),
    route: '/how-to-play/loot',
    tldr: () => [
      msg('105 pieces across 8 archetypes, in 12 effect types'),
      msg('Each entry names its effect in words and its parameters as values'),
      msg(
        'Aptitude boosts, memories, moodlets, event and arc modifiers, permanent and next-run bonuses',
      ),
      msg('Building repair is here too: the only way a ruined building ever recovers'),
      msg('Read from the same record the run uses, so it is never out of date'),
    ],
    sections: () => [],
    related: ['dungeons'],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 16: THE DRIFT (travel game)
  // ────────────────────────────────────────────────────────────────────────
  // ────────────────────────────────────────────────────────────────────────
  // 16: COMMENDATIONS
  // ────────────────────────────────────────────────────────────────────────
  // Vierunddreißig Abzeichen existierten, und nirgends stand, wie man eines
  // bekommt. Der Plan sprach von 35 — gemessen sind es 34, davon drei geheime.
  // Es steht bewusst KEINE Gesamtzahl im Text: sie wäre eine Kopie, die beim
  // nächsten Abzeichen driftet, und ein Spieler fragt ohnehin nach dem WIE.
  {
    slug: 'commendations',
    title: msg('Commendations'),
    icon: 'trophy',
    description: msg('Seven kinds of badge, and what each of them asks of you.'),
    accent: '--color-warning',
    readTime: msg('4 min'),
    tldr: () => [
      msg('Badges are awarded automatically; there is nothing to claim'),
      msg('Seven categories: initiation, dungeon, epoch, social, collection, challenge, secret'),
      msg('Some track progress, so a partial attempt is not lost'),
      msg('The secret ones stay secret. They are not listed here and not hinted at'),
    ],
    sections: () => [
      {
        kind: 'text',
        content: msg(
          'Commendations record what you have actually done, not what you have bought or unlocked. They are granted by the server when the condition is met, so there is no button to press and nothing to collect. If you meet a condition while offline, the badge is waiting when you return.',
        ),
      },
      {
        kind: 'callouts',
        items: [
          {
            type: 'info',
            label: msg('Initiation'),
            text: msg(
              'The first of everything: your first world, your first field assignment, your first descent, your first forge run. These exist so the beginning of the game is legible.',
            ),
          },
          {
            type: 'info',
            label: msg('Dungeon'),
            text: msg(
              'The largest group. One badge per archetype you survive, plus depth, plus the two that ask you to see all of them. Each archetype has its own condition, not a shared counter.',
            ),
          },
          {
            type: 'info',
            label: msg('Epoch'),
            text: msg(
              'Competitive play: holding a position, running an operative role to its conclusion, winning without a loss. The rarest badges on the platform sit here.',
            ),
          },
          {
            type: 'info',
            label: msg('Social'),
            text: msg(
              'Things that reach another world: founding an embassy, sending an echo, decoding a cipher, holding a ward. None of them can be earned alone.',
            ),
          },
          {
            type: 'info',
            label: msg('Collection'),
            text: msg(
              'Patience rather than skill. Loot, literary fragments, object anchors, banter. These track progress, so what you gather is never lost between sessions.',
            ),
          },
          {
            type: 'info',
            label: msg('Challenge'),
            text: msg(
              'Self-imposed constraints: a flawless run, a fast one, one without a single kill. The game will not ask you to try these; that is the point.',
            ),
          },
          {
            type: 'warn',
            label: msg('Secret'),
            text: msg(
              'Three badges are hidden. Their names, conditions and hints are not shown until you hold them. This page will not spoil them, and neither will the badge list.',
            ),
          },
        ],
      },
      {
        kind: 'text',
        content: msg(
          'Rarity is a label, not a currency: common, uncommon, rare, epic, legendary. It says how hard the condition is, not what the badge does. Badges do not affect any game mechanic, and that is deliberate. A record that changed the game would stop being a record.',
        ),
      },
    ],
    related: ['dungeons', 'epochs', 'diplomacy'],
  },

  // ────────────────────────────────────────────────────────────────────────
  // 17: THE RESONANCE JOURNAL
  // ────────────────────────────────────────────────────────────────────────
  // Flag-gesteuert wie DRIFT: das Thema erscheint nur, wenn `journal_enabled`
  // gesetzt ist. Eine Anleitung für eine Mechanik, die auf dieser Plattform
  // nicht läuft, ist schlimmer als keine — sie lässt jemanden suchen.
  {
    slug: 'journal',
    title: msg('The Resonance Journal'),
    icon: 'sparkle',
    description: msg('Fragments the world leaves behind, and what they form when they meet.'),
    accent: '--color-epoch-influence',
    readTime: msg('5 min'),
    tldr: () => [
      msg('Fragments are written by the world as you play; you do not collect them'),
      msg('Fragments that resonate form constellations, and a constellation yields an insight'),
      msg('Crystallising a constellation can unlock an attunement'),
      msg('The journal is released per platform and needs its own model budget'),
    ],
    sections: () => [
      {
        kind: 'text',
        content: msg(
          'The journal is the one part of the platform you do not operate. It watches five systems at once and writes down what it notices: an agent whispering at bond depth two, a dungeon run that ended a certain way, a resonance that touched a zone. Each note is a fragment.',
        ),
      },
      {
        kind: 'callouts',
        items: [
          {
            type: 'info',
            label: msg('Fragments'),
            text: msg(
              'Written by the world, not gathered by you. They arrive from bonds, dungeons, resonances, events and chat. You cannot ask for one.',
            ),
          },
          {
            type: 'info',
            label: msg('Constellations'),
            text: msg(
              'When fragments resonate with one another they are drawn together into a constellation. The pairing is measured, not chosen: a detector compares them and only real resonance counts.',
            ),
          },
          {
            type: 'info',
            label: msg('Insight'),
            text: msg(
              'A completed constellation yields a single written insight about what the fragments have in common. It is generated once and then belongs to the constellation.',
            ),
          },
          {
            type: 'tip',
            label: msg('Attunement'),
            text: msg(
              'Crystallising a constellation can open an attunement, which deepens over time and eventually spawns events of its own. This is the only path from reading the journal back into the world.',
            ),
          },
          {
            type: 'warn',
            label: msg('Requirement'),
            text: msg(
              'Each fragment costs one model call, so the journal is released per platform by the operators and runs against a budget. Where it is not released, no fragments accumulate at all.',
            ),
          },
        ],
      },
      {
        kind: 'text',
        content: msg(
          'The journal rewards playing widely rather than deeply. Fragments come from five different systems, and a constellation needs fragments that resonate, which is easier across systems than within one. A week of dungeon runs produces fewer constellations than a week of dungeon runs, a bond and an embassy.',
        ),
      },
    ],
    related: ['bonds', 'dungeons', 'advanced'],
  },

  {
    slug: 'drift',
    title: msg('The Drift'),
    icon: 'antenna',
    description: msg(
      'A solo push-your-luck travel game across the multiverse – pilot a carrier through the Drift between worlds.',
    ),
    accent: '--color-primary',
    readTime: msg('7 min'),
    tldr: () => [
      msg(
        'A solo travel game layered on the multiverse: pilot a Träger (carrier) across the Driftkarte, the chart of every connected world.',
      ),
      msg(
        'Survey nodes to build Vermessung (your haul), then choose – bank it safe at home, or push deeper for more.',
      ),
      msg(
        'Balance Kohärenz, Bandbreite and Dissonanz against a closing stay-window. Let your coherence fray to nothing and the run collapses.',
      ),
      msg(
        'Carry Depeschen to foreign worlds; a collapse scatters your lost cargo as echoes into the worlds it was bound for.',
      ),
    ],
    sections: () => [
      {
        kind: 'text',
        content: msg(
          'The Drift is a solo travel game layered over the multiverse. You pilot a Träger – a carrier – out from your home world and across the Driftkarte, the living chart of every connected simulation. Between the worlds lies the Drift itself: an unstable medium of broadcast-noise and bleed where coherence frays the deeper you go. Every excursion is a wager against it.',
        ),
      },
      {
        kind: 'callouts',
        items: [
          {
            type: 'info',
            label: msg('Alpha feature'),
            text: msg(
              'The Drift is in alpha and opens only when your platform operator enables it. If a simulation shows no Drift tab, the mode is not switched on for this deployment yet.',
            ),
          },
        ],
      },
      {
        kind: 'text',
        content: msg(
          'The core loop is push-your-luck. You set out, move from node to node, and survey each new world or waypoint you reach – every first arrival adds Vermessung to your haul. But surveying is worth nothing until you carry it home: bank it at your home broadcast and it is locked in for good; lose the run before you return and the entire haul is gone. The whole game lives in the tension between one more crossing and the safe road back.',
        ),
      },
      {
        kind: 'readout',
        title: msg('Your gauges, and the window'),
        data: () => [
          {
            label: msg('Kohärenz (KH)'),
            value: msg(
              'Your hold on yourself. Starts at 100; deep Drift and emergency moves erode it. At 0 the run collapses.',
            ),
          },
          {
            label: msg('Bandbreite (BB)'),
            value: msg(
              'Movement fuel. Every crossing spends it; at 0 you can still limp on Notfrequenz, paying in Kohärenz instead.',
            ),
          },
          {
            label: msg('Dissonanz (DZ)'),
            value: msg(
              'The Drift’s pressure on you. Rises the deeper and longer you travel; past a threshold it bleeds Kohärenz.',
            ),
          },
          {
            label: msg('Aufenthaltsfenster'),
            value: msg(
              'Your stay-window, counted in Takte (turns). Let it run out while abroad and you are stranded – a collapse.',
            ),
          },
        ],
      },
      {
        kind: 'callouts',
        items: [
          {
            type: 'tip',
            label: msg('Depeschen'),
            text: msg(
              'Foreign worlds post Depeschen – dispatches asking you to carry a piece of cargo across the Drift. Deliver one to its destination and it lands real consequences there: a faint echo, a fresh event, a memory in an agent’s mind, all filtered through that world’s hospitality.',
            ),
          },
          {
            type: 'info',
            label: msg('Hospitality'),
            text: msg(
              'Every world decides how open it is to the Drift: geschlossen (closed), nur Echos (echoes only), standard, or offen (open). A closed world turns your delivery away; a generous one lets it ripple deep. You cannot force a threshold – only respect it.',
            ),
          },
        ],
      },
      {
        kind: 'text',
        content: msg(
          'Be the first traveller ever to chart a node and you win an Erstvermessung – a permanent seal that stands on the shared Driftkarte under your name, plus Vermessungspunkte toward your clearance rank. First-to-chart is decided once, for everyone: the seal is yours until the world ends.',
        ),
      },
      {
        kind: 'callouts',
        items: [
          {
            type: 'danger',
            label: msg('Collapse, and the scatter'),
            text: msg(
              'If your Kohärenz hits 0, or your window expires while you are still abroad, the run collapses. You are snapped home empty-handed and the haul is lost. And the Depeschen you carried do not simply vanish: they scatter as faint echoes into the very worlds they were bound for – the deliveries that never arrived. Pushing too far leaves a mark on the map.',
            ),
          },
          {
            type: 'tip',
            label: msg('Rückzug'),
            text: msg(
              'Sense a collapse coming? Call a Rückzug and retreat. You forfeit any carried cargo, but cleanly – no scatter – and you keep every node you surveyed. Knowing when to fold is the skill the Drift rewards.',
            ),
          },
        ],
      },
    ],
    related: ['map', 'world', 'diplomacy'],
  },
];

// ── Lookup Utilities ──────────────────────────────────────────────────────

/** Get a topic by its URL slug. */
export function getTopicBySlug(slug: string): TopicDefinition | undefined {
  return TOPICS.find((t) => t.slug === slug);
}

/** Get adjacent topics for prev/next navigation. */
export function getAdjacentTopics(slug: string): {
  prev?: TopicDefinition;
  next?: TopicDefinition;
} {
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

/**
 * Die Themen, die eine bestimmte Besucherin tatsächlich sieht.
 *
 * WARUM DAS EINE FUNKTION IST: das DRIFT-Thema hängt am selben Tor wie sein
 * Navigationsreiter (`drift_p0_enabled`). Die Zahl der Themen ist also nicht
 * `TOPICS.length`, sondern je nach Plattformzustand 15 oder 16 — und genau
 * diese Unterscheidung ging bisher verloren:
 *
 *   * Die Filterbedingung stand ZWEIMAL wörtlich in `HowToPlayGuideHub`
 *     (Suche `:595`, Raster `:791`). Zwei Kopien einer Regel laufen
 *     auseinander; eine dritte Ansicht hätte eine dritte bekommen.
 *   * Und an vier Stellen stand die Zahl als fester Text: „12 Themen",
 *     gemessen am 31.08.2026 gegen 16 tatsächliche. Vier daneben — die Hilfe
 *     verschwieg vier ganze Systeme, darunter Terminal und Dungeons.
 *
 * Eine Oberfläche, die „12" druckt, während 16 dastehen, ist schlechter als
 * eine, die gar nichts druckt: sie ist eine Zusage, die die Seite selbst
 * widerlegt, sobald man die Karten zählt.
 *
 * Bewusst OHNE Import des `DriftStatusService`: dieses Modul ist Daten, kein
 * Dienst. Der Zustand kommt als Argument herein, damit die Funktion ohne
 * Signale prüfbar bleibt und die Datenschicht keine Dienstschicht zieht.
 */
export interface TopicVisibility {
  /** drift_p0_enabled / drift_fun_core_enabled */
  drift: boolean;
  /** journal_enabled */
  journal: boolean;
}

/**
 * Beide Felder sind PFLICHT, nicht optional mit Vorgabe.
 *
 * Eine Vorgabe hieße, dass ein Aufrufer eine Flagge stillschweigend vergessen
 * kann und das Thema dann entweder immer fehlt oder immer erscheint — ohne
 * Fehlermeldung. Mit einem Pflichtfeld weist TypeScript die Aufrufstelle ab.
 * Vorher war es ein einzelnes Stellungsargument; das zweite hätte man
 * dranhängen können, ohne dass eine der sechs Stellen es merkt.
 */
export function visibleTopics(flags: TopicVisibility): TopicDefinition[] {
  return TOPICS.filter((t) => {
    if (t.slug === 'drift') return flags.drift;
    if (t.slug === 'journal') return flags.journal;
    return true;
  });
}
