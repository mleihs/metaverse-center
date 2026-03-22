/**
 * How-to-Play: Feature tutorials for Forge, Chronicle, Resonances,
 * Zone Dynamics, and Agent Memory.
 * All strings wrapped in msg() for i18n.
 */

import { msg } from '@lit/localize';
import type { DemoStep } from './htp-types.js';

/** Build a Supabase storage URL for a tutorial screenshot. */
function tutorialImage(filename: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL;
  return `${base}/storage/v1/object/public/simulation.assets/how-to-play/${filename}`;
}

/* ── The Simulation Forge ─────────────────────────── */

export type ForgePhase = 'astrolabe' | 'table' | 'darkroom' | 'ignition';

export interface ForgeStep extends Omit<DemoStep, 'phase'> {
  phase: ForgePhase;
}

export function getForgeGuideSteps(): ForgeStep[] {
  return [
    // ── Phase I: The Astrolabe ──────────────────────
    {
      phase: 'astrolabe',
      title: msg('Enter the Forge'),
      narration: msg(
        'Navigate to the Forge from the main navigation. The Forge is the Bureau of Impossible Geography \u2014 a four-phase wizard that materializes an entirely new simulation through AI-assisted procedural generation. Each phase builds on the previous, culminating in a fully realized world with geography, agents, buildings, lore, and a unique visual identity.',
      ),
      readout: [
        { label: msg('Phases'), value: '4' },
        { label: msg('AI Engine'), value: 'OpenRouter' },
        { label: msg('Output'), value: msg('Complete simulation') },
      ],
      tip: msg(
        'The Forge uses real AI generation at every step. Each scan, draft, and calibration is a live API call \u2014 results are unique every time. Budget 10\u201315 minutes for a full forge run.',
      ),
      image: tutorialImage('htp-forge-01-seed-input.avif'),
      imageAlt: msg('The Simulation Forge seed input and suggestion cards'),
    },
    {
      phase: 'astrolabe',
      title: msg('Phase I \u2014 The Astrolabe'),
      narration: msg(
        'Enter a seed prompt describing the world you want to create. This can be as simple as "a cyberpunk megacity" or as evocative as "a floating archipelago where memories solidify into islands." Click Scan Multiverse to generate three philosophical anchor cards \u2014 each offers a distinct thematic interpretation of your seed.',
      ),
      detail: msg(
        'The AI analyzes your seed and produces three anchors with names, philosophical tenets, and worldbuilding implications. Each anchor shapes the entire simulation differently \u2014 the same seed with different anchors creates radically different worlds.',
      ),
      readout: [
        { label: msg('Input'), value: msg('Seed prompt (free text)') },
        { label: msg('Output'), value: msg('3 anchor cards') },
        { label: msg('Selection'), value: msg('Choose 1 anchor') },
      ],
      image: tutorialImage('htp-forge-02-anchors.avif'),
      imageAlt: msg('Astrolabe phase showing three AI-generated philosophical anchor cards'),
    },
    // ── Phase II: The Drafting Table ────────────────
    {
      phase: 'table',
      title: msg('Phase II \u2014 The Drafting Table'),
      narration: msg(
        'The Table has three divisions that can be completed in any order. The Cartographic Division generates geography (zones and transit arteries). The Personnel Bureau recruits AI-generated agents with names, professions, and detailed backstories. The Infrastructure Corps blueprints buildings with rich architectural descriptions.',
      ),
      detail: msg(
        'Each division produces content in a staging hand. Review each entity, then accept or edit it before it enters the final roster. All three divisions must show a green checkmark before you can advance.',
      ),
      readout: [
        { label: msg('Cartographic'), value: msg('5 zones + 5 streets') },
        { label: msg('Personnel'), value: msg('6 agents') },
        { label: msg('Infrastructure'), value: msg('7 buildings') },
        { label: msg('Review'), value: msg('Accept, edit, or re-draft') },
      ],
      tip: msg(
        'You can re-scan or re-draft any division without losing progress in the others. If a generated agent doesn\u2019t fit your vision, delete it and re-draft for a fresh set.',
      ),
      image: tutorialImage('htp-forge-04-command-console.avif'),
      imageAlt: msg('Drafting Table command console with three division panels'),
    },
    {
      phase: 'table',
      title: msg('Review & Accept Entities'),
      narration: msg(
        'Generated entities appear in a staging hand at the bottom of the page. Each card shows the entity\u2019s name, type, and a preview of its description. Click the checkmark to accept an entity into the final roster, or click the edit icon to modify it before accepting.',
      ),
      readout: [
        { label: msg('Agents'), value: msg('Name, profession, backstory') },
        { label: msg('Buildings'), value: msg('Type, architecture, atmosphere') },
        { label: msg('Zones'), value: msg('Theme, tags, description') },
      ],
      image: tutorialImage('htp-forge-05-staging-hand.avif'),
      imageAlt: msg('Staging hand showing entity cards with accept and edit buttons'),
    },
    // ── Phase III: The Darkroom ─────────────────────
    {
      phase: 'darkroom',
      title: msg('Phase III \u2014 The Darkroom'),
      narration: msg(
        'The Aesthetic Calibration Bureau generates a complete visual identity for your simulation. An AI-generated color palette (primary, secondary, accent, background, surface, text), typography selection (heading and body fonts), and character styling (border radius, shadow, hover effects, card texture, nameplate style, corner decorations, foil effects) are all auto-calibrated from your world\u2019s theme.',
      ),
      detail: msg(
        'A live preview panel on the right shows how your theme will look in practice \u2014 color swatches, sample headings, buttons, and a mock agent card. Every parameter is editable if you want to fine-tune the AI\u2019s choices.',
      ),
      readout: [
        { label: msg('Colors'), value: msg('6-color palette') },
        { label: msg('Typography'), value: msg('Heading + body fonts') },
        { label: msg('Character'), value: msg('8 styling parameters') },
        { label: msg('Preview'), value: msg('Live agent card mockup') },
      ],
      tip: msg(
        'Click "Regenerate Theme" to get a completely new aesthetic interpretation of your world. The AI draws on the simulation\u2019s lore, geography, and agent descriptions to inform its choices.',
      ),
      image: tutorialImage('htp-forge-07-darkroom-palette.avif'),
      imageAlt: msg('Darkroom showing AI-generated color palette and live preview'),
    },
    {
      phase: 'darkroom',
      title: msg('Image Generation Parameters'),
      narration: msg(
        'Below the theme controls, configure the AI image generation style. Four editable style prompts control how portraits, buildings, banners, and lore illustrations will be rendered. Guidance scale and inference steps control image quality and adherence to the prompt.',
      ),
      readout: [
        { label: msg('Portraits'), value: msg('Character art style') },
        { label: msg('Buildings'), value: msg('Architecture art style') },
        { label: msg('Banner'), value: msg('World panorama style') },
        { label: msg('Lore'), value: msg('Illustration style') },
      ],
      image: tutorialImage('htp-forge-08-darkroom-image.avif'),
      imageAlt: msg('Image generation parameters with style prompts and guidance controls'),
    },
    // ── Phase IV: The Ignition ──────────────────────
    {
      phase: 'ignition',
      title: msg('Phase IV \u2014 The Ignition'),
      narration: msg(
        'The final phase presents an Ignition Summary readout: seed prompt, philosophical anchor, agent count, building count, zone count, and theme type. Below, an image generation estimate shows how many images will be created (typically 15\u201320: 1 banner + portraits + building images + lore illustrations).',
      ),
      detail: msg(
        'The "Final Materialization" panel requires a 2-second hold on the ignition button to confirm. This deliberate friction prevents accidental creation. Once ignited, the simulation is permanently added to the multiverse and image generation begins in the background.',
      ),
      readout: [
        { label: msg('Confirm'), value: msg('Hold 2 seconds') },
        { label: msg('Images'), value: msg('~17 generated') },
        { label: msg('Time'), value: msg('3\u20135 min (background)') },
        { label: msg('Result'), value: msg('Live simulation') },
      ],
      warning: msg(
        'Ignition is permanent and consumes 1 Forge Token. Double-check your summary before holding the ignition button. Once materialized, the simulation cannot be un-created.',
      ),
      image: tutorialImage('htp-forge-09-ignition-summary.avif'),
      imageAlt: msg('Ignition summary with hold-to-confirm materialization button'),
    },
  ];
}

/* ── Substrate Pulse & Daily Briefing ─────────────── */

export function getSubstratePulseGuideSteps(): DemoStep[] {
  return [
    {
      phase: 'competition',
      title: msg('What is the Substrate Pulse?'),
      narration: msg(
        'The Substrate Pulse is the heartbeat of every simulation. Every 4 hours, the system ticks \u2014 updating zone stability, progressing narrative arcs, triggering bureau responses, and recording entries in the pulse chronicle. The Pulse tab shows this activity as a battle-log-style ticker, grouped by tick number, with color-coded severity and type indicators.',
      ),
      readout: [
        { label: msg('Tick interval'), value: msg('4 hours (configurable)') },
        { label: msg('Entry types'), value: msg('Zone, events, arcs, bureau, resonance') },
        { label: msg('Access'), value: msg('Simulation \u2192 Pulse tab') },
      ],
    },
    {
      phase: 'competition',
      title: msg('The Daily Substrate Dispatch'),
      narration: msg(
        'When you visit a simulation for the first time each day, a classified intelligence briefing appears \u2014 the Daily Substrate Dispatch. Styled as a Bureau report handed to an operative, it summarizes the last 24 hours: overall health status with a color-coded bar, counts of critical and positive events, total pulse entries, and active narrative arcs with pressure indicators.',
      ),
      detail: msg(
        'The dispatch auto-dismisses after 30 seconds (pause by hovering) or can be acknowledged immediately. Click "View Chronicle" to jump straight to the Pulse tab. The briefing only appears when there are new entries to report \u2014 if nothing happened in 24 hours, no briefing is shown.',
      ),
      readout: [
        { label: msg('Frequency'), value: msg('Once per day per simulation') },
        { label: msg('Health'), value: msg('Bar + tier badge') },
        { label: msg('Activity'), value: msg('Critical / positive / total / arcs') },
        { label: msg('Actions'), value: msg('Acknowledge or View Chronicle') },
      ],
    },
    {
      phase: 'competition',
      title: msg('Narrative Arcs'),
      narration: msg(
        'Narrative arcs are emergent storylines that the heartbeat system detects and tracks. An arc might be an escalating economic crisis, a cascade of diplomatic failures, or a wave of military conflict. Each arc has a type, a primary signature, a status (building/active/climax), and a pressure value. High-pressure arcs drive more dramatic pulse entries and can trigger cascade events.',
      ),
      readout: [
        { label: msg('Statuses'), value: msg('Building \u2192 Active \u2192 Climax') },
        { label: msg('Pressure'), value: msg('0.0\u20131.0 (bar indicator)') },
        { label: msg('Effect'), value: msg('Drives pulse entries + cascades') },
      ],
    },
  ];
}

/* ── The Chronicle ────────────────────────────────── */

export function getChronicleGuideSteps(): DemoStep[] {
  return [
    {
      phase: 'competition',
      title: msg('What is the Chronicle?'),
      narration: msg(
        'The Chronicle is a living newspaper generated by AI after each epoch cycle. Styled as a Victorian-era broadsheet, it reports on in-game events through the lens of fictional journalism \u2014 complete with dramatic headlines, editorial commentary, and intelligence dispatches.',
      ),
      detail: msg(
        'Each edition covers one cycle\u2019s worth of events: operative deployments, mission outcomes, score changes, and diplomatic shifts. The AI weaves these mechanical events into narrative prose, giving your simulation a sense of history and drama.',
      ),
      readout: [
        { label: msg('Frequency'), value: msg('1 edition per cycle') },
        { label: msg('Content'), value: msg('AI-narrated events') },
        { label: msg('Style'), value: msg('Victorian broadsheet') },
        { label: msg('Access'), value: msg('Simulation \u2192 Chronicle tab') },
      ],
      image: tutorialImage('htp-chronicle-01-broadsheet.avif'),
      imageAlt: msg('Chronicle broadsheet layout with masthead and article columns'),
    },
    {
      phase: 'competition',
      title: msg('Reading an Edition'),
      narration: msg(
        'Each Chronicle edition opens with a masthead showing the simulation name, edition number, and cycle date. Below, articles are arranged in newspaper columns. Headlines range from battlefield reports ("SABOTEUR STRIKES THE INDUSTRIAL QUARTER") to political analysis ("DIPLOMATIC TENSIONS RISE AS EMBASSY EFFECTIVENESS WANES").',
      ),
      tip: msg(
        'The Chronicle is publicly visible \u2014 anyone browsing the simulation can read it. Use it to understand the narrative arc of an epoch, even as a spectator.',
      ),
      image: tutorialImage('htp-chronicle-01-broadsheet.avif'),
      imageAlt: msg('Chronicle edition with headlines and article columns'),
    },
    {
      phase: 'competition',
      title: msg('Chronicle as Intelligence'),
      narration: msg(
        'Beyond narrative flavor, the Chronicle serves as a strategic tool. It reveals which players made bold moves, which zones were targeted, and how scores shifted. Experienced players read between the lines to anticipate enemy strategy for the next cycle.',
      ),
      readout: [
        { label: msg('Battle reports'), value: msg('Mission outcomes') },
        { label: msg('Score analysis'), value: msg('Dimension shifts') },
        { label: msg('Political intel'), value: msg('Alliance changes') },
        { label: msg('Tactical clues'), value: msg('Enemy patterns') },
      ],
      image: tutorialImage('htp-chronicle-01-broadsheet.avif'),
      imageAlt: msg('Chronicle articles revealing strategic intelligence'),
    },
  ];
}

/* ── Substrate Resonances ─────────────────────────── */

export function getResonanceGuideSteps(): DemoStep[] {
  return [
    {
      phase: 'competition',
      title: msg('What are Substrate Resonances?'),
      narration: msg(
        'Substrate Resonances are emergent phenomena that arise when a simulation\u2019s substrate \u2014 its underlying computational fabric \u2014 vibrates in response to in-game activity. Think of them as the world\u2019s immune system: when events cluster too densely or score dimensions become imbalanced, the substrate begins to resonate.',
      ),
      detail: msg(
        'Each resonance has a signature (a unique waveform identifier), a magnitude (how strong the effect), and a decay rate (how quickly it fades). Active resonances modify gameplay mechanics: they can boost or suppress certain operative types, alter RP generation, or shift score weights temporarily.',
      ),
      readout: [
        { label: msg('Trigger'), value: msg('Event clustering / imbalance') },
        { label: msg('Effect'), value: msg('Gameplay modifiers') },
        { label: msg('Duration'), value: msg('Decays over cycles') },
        { label: msg('Visibility'), value: msg('Simulation health panel') },
      ],
      image: tutorialImage('htp-resonance-01-health.avif'),
      imageAlt: msg('Simulation health dashboard showing substrate resonance indicators'),
    },
    {
      phase: 'competition',
      title: msg('The Resonance Monitor'),
      narration: msg(
        'The Substrate Tremor Monitor displays all active resonances in real time. Each resonance is shown as a card with its signature label, magnitude bar, and remaining decay cycles. The monitor also shows the simulation\u2019s overall substrate stability \u2014 a composite measure of how far the world\u2019s fabric has been stressed.',
      ),
      tip: msg(
        'High substrate instability means resonances are more likely to trigger and cascade. Plan your deployments carefully during unstable periods \u2014 a single saboteur mission could trigger a resonance that rebounds against you.',
      ),
      image: tutorialImage('htp-resonance-02-monitor.avif'),
      imageAlt: msg('Substrate Tremor Monitor with active resonance cards'),
    },
    {
      phase: 'competition',
      title: msg('Strategic Implications'),
      narration: msg(
        'Resonances are not just atmospheric \u2014 they have direct mechanical impact. A "Military Surge" resonance might increase assassin success rates by 10% for 3 cycles, while a "Diplomatic Dampener" could reduce embassy effectiveness. Understanding which actions trigger which resonances is key to advanced strategy.',
      ),
      readout: [
        { label: msg('Military Surge'), value: msg('+10% assassin success') },
        { label: msg('Stability Echo'), value: msg('+5% guardian effect') },
        { label: msg('Diplomatic Dampener'), value: msg('\u221215% embassy power') },
        { label: msg('Entropy Wave'), value: msg('Random score bleed') },
      ],
      warning: msg(
        'Resonances can cascade: one resonance triggering conditions for another. During Reckoning phase, cascade depth increases, making chain reactions more likely.',
      ),
      image: tutorialImage('htp-resonance-03-cards.avif'),
      imageAlt: msg('Resonance cards showing signatures and magnitude indicators'),
    },
  ];
}

/* ── Event Pressure & Zone Dynamics ───────────────── */

export function getZoneDynamicsGuideSteps(): DemoStep[] {
  return [
    {
      phase: 'competition',
      title: msg('The Event Seismograph'),
      narration: msg(
        'Every simulation tracks event pressure across its zones through the Event Seismograph \u2014 an SVG visualization that plots event intensity over time. The seismograph shows spikes when missions resolve, guardians deploy, or bleed events cascade. Hover over any point to see the exact event details.',
      ),
      readout: [
        { label: msg('X-axis'), value: msg('Cycle timeline') },
        { label: msg('Y-axis'), value: msg('Event pressure') },
        { label: msg('Interaction'), value: msg('Hover crosshair') },
        { label: msg('Filter'), value: msg('By zone or event type') },
      ],
      image: tutorialImage('htp-events-01-seismograph.avif'),
      imageAlt: msg('Event Seismograph SVG showing pressure spikes across cycles'),
    },
    {
      phase: 'competition',
      title: msg('Zone Security Levels'),
      narration: msg(
        'Each zone maintains a security level that affects operative success rates. Security ranges from Low to Critical and changes based on guardian deployments, fortification actions, and successful enemy infiltrations. The zone dynamics panel shows current security levels with color-coded indicators.',
      ),
      detail: msg(
        'Zone security is the primary defensive mechanic. A zone at Critical security reduces enemy operative success by up to 25%. Conversely, a Low security zone is a soft target \u2014 spy intel that reveals zone security levels is enormously valuable for planning strikes.',
      ),
      readout: [
        { label: msg('Low'), value: msg('Minimal defense') },
        { label: msg('Medium'), value: msg('\u221210% enemy success') },
        { label: msg('High'), value: msg('\u221218% enemy success') },
        { label: msg('Critical'), value: msg('\u221225% enemy success') },
      ],
      tip: msg(
        'Deploy spies first to reveal enemy zone security, then target the weakest zone with saboteurs or assassins. This "spy \u2192 strike" combo is the most efficient use of RP.',
      ),
      image: tutorialImage('htp-events-02-chart.avif'),
      imageAlt: msg('Zone dynamics panel with event pressure chart'),
    },
    {
      phase: 'competition',
      title: msg('Event Cards & History'),
      narration: msg(
        'Below the seismograph, individual event cards show the full history of what happened in each cycle. Each card displays the event type (deployment, mission resolution, bleed, score change), the actors involved, and the outcome. Events are color-coded by type and can be filtered by zone.',
      ),
      image: tutorialImage('htp-events-01-seismograph.avif'),
      imageAlt: msg('Event seismograph with pressure timeline'),
    },
  ];
}

/* ── Agent Memory ─────────────────────────────────── */

export function getAgentMemoryGuideSteps(): DemoStep[] {
  return [
    {
      phase: 'competition',
      title: msg('What is Agent Memory?'),
      narration: msg(
        'Every agent in a simulation maintains a persistent memory system. As events unfold, agents form observations about what they witness and reflections about what those events mean. This creates a living psychological profile that evolves over the course of an epoch.',
      ),
      detail: msg(
        'Agent memory uses a dual-layer architecture: observations are raw factual records ("I deployed as a spy against The Gaslit Reach"), while reflections are synthesized interpretations ("My infiltration revealed a pattern of weak northern defenses \u2014 the enemy is concentrating forces in the south"). Reflections are AI-generated from accumulated observations.',
      ),
      readout: [
        { label: msg('Observations'), value: msg('Factual event records') },
        { label: msg('Reflections'), value: msg('AI-synthesized insights') },
        { label: msg('Importance'), value: msg('1\u20135 pip rating') },
        { label: msg('Persistence'), value: msg('Survives across cycles') },
      ],
      image: tutorialImage('htp-agent-memory-01-list.avif'),
      imageAlt: msg('Agent list showing memory indicators and aptitude profiles'),
    },
    {
      phase: 'competition',
      title: msg('Memory Timeline'),
      narration: msg(
        'Each agent\u2019s detail page shows a chronological memory timeline. Entries are displayed as cards with timestamps, memory type (observation or reflection), importance pips, and the full text content. High-importance memories are visually highlighted.',
      ),
      tip: msg(
        'Agent memories influence bot decision-making. A bot whose agents have observed repeated attacks on a specific zone will prioritize defending that zone. Understanding agent memory helps predict bot behavior.',
      ),
      image: tutorialImage('htp-agent-memory-01-list.avif'),
      imageAlt: msg('Agent memory list with observation and reflection entries'),
    },
    {
      phase: 'competition',
      title: msg('Importance & Decay'),
      narration: msg(
        'Each memory entry has an importance rating from 1 to 5, shown as pips. High-importance memories (mission outcomes, major score shifts) persist longer and weigh more heavily in AI reflections. Low-importance memories may decay over time, simulating the natural fading of routine observations.',
      ),
      readout: [
        { label: msg('5 pips'), value: msg('Critical \u2014 never decays') },
        { label: msg('4 pips'), value: msg('High \u2014 long persistence') },
        { label: msg('3 pips'), value: msg('Medium \u2014 standard decay') },
        { label: msg('1\u20132 pips'), value: msg('Low \u2014 fades quickly') },
      ],
      image: tutorialImage('htp-agent-memory-01-list.avif'),
      imageAlt: msg('Memory entries with importance pip ratings'),
    },
  ];
}

/* ── The Multiverse Map ──────────────────────────── */

export function getMultiverseMapGuideSteps(): DemoStep[] {
  return [
    {
      phase: 'competition',
      title: msg('What is the Multiverse Map?'),
      narration: msg(
        'The Cartographer\u2019s Map is an interactive force-directed graph that visualizes the entire multiverse \u2014 every simulation, their connections, and active game instances. Nodes represent simulations, edges represent cross-dimensional connections, and energy pulses flow along the connections to show bleed activity.',
      ),
      detail: msg(
        'Template simulations appear as solid nodes with ambient glow. When an epoch is active, game instances orbit their parent template with dashed rotating borders and phase-colored rings (green for foundation, amber for competition, red for reckoning). The map auto-refreshes every 30 seconds during active epochs.',
      ),
      readout: [
        { label: msg('Nodes'), value: msg('Simulations (template + instances)') },
        { label: msg('Edges'), value: msg('Cross-simulation connections') },
        { label: msg('Pulses'), value: msg('Bleed & operative activity') },
        { label: msg('Refresh'), value: msg('30 seconds (auto)') },
      ],
    },
    {
      phase: 'competition',
      title: msg('Interactive Features'),
      narration: msg(
        'Click any simulation node to open a side panel with epoch scores and leaderboard data. Click an edge to see connection details including strength, embassy links, and operative flow. Double-click a game instance cluster to zoom in. Use the minimap in the bottom-right corner for viewport orientation. A search bar lets you find simulations by name, fading unmatched nodes.',
      ),
      readout: [
        { label: msg('Node click'), value: msg('Leaderboard panel') },
        { label: msg('Edge click'), value: msg('Connection details') },
        { label: msg('Double-click'), value: msg('Zoom to cluster') },
        { label: msg('Search'), value: msg('Filter by name') },
      ],
      tip: msg(
        'The battle feed ticker at the bottom of the map shows a scrolling log of public battle events across all active epochs \u2014 useful for spectators following multiple matches.',
      ),
    },
    {
      phase: 'competition',
      title: msg('Game Instance Visualization'),
      narration: msg(
        'During an active epoch, game instances display rich visual data: 5-dimension health arcs around the node show stability, influence, sovereignty, diplomatic, and military scores at a glance. Sparkline composite scores on template nodes show overall performance trends. Operative trails along edges indicate which simulations are targeting each other, with edge width and opacity reflecting operative volume.',
      ),
      readout: [
        { label: msg('Health arcs'), value: msg('5 score dimensions') },
        { label: msg('Sparklines'), value: msg('Composite score trends') },
        { label: msg('Operative trails'), value: msg('Attack/defense flow') },
        { label: msg('Phase rings'), value: msg('Color-coded epoch phase') },
      ],
    },
  ];
}

/* ── Bot Players & Personalities ─────────────────── */

export function getBotPlayersGuideSteps(): DemoStep[] {
  return [
    {
      phase: 'lobby',
      title: msg('What are Bot Players?'),
      narration: msg(
        'Bot players are AI opponents that can be added to any epoch. Each bot has a personality archetype that determines its strategic behavior \u2014 from defensive fortress-builders to chaotic wild cards. Bots use the exact same deployment and scoring mechanics as human players, ensuring fair competition.',
      ),
      detail: msg(
        'Bots are configured through reusable presets with a name, personality, and difficulty level. The epoch creator adds bots from the Bot Deployment Console during the lobby phase. Bots auto-draft their agent roster based on their personality preferences and make decisions synchronously during cycle resolution.',
      ),
      readout: [
        { label: msg('Personalities'), value: '5' },
        { label: msg('Difficulty'), value: msg('Easy / Medium / Hard') },
        { label: msg('Presets'), value: msg('Reusable across epochs') },
        { label: msg('Fairness'), value: msg('Same rules as humans') },
      ],
    },
    {
      phase: 'lobby',
      title: msg('Personality Archetypes'),
      narration: msg(
        'Each personality shapes how the bot allocates RP, chooses targets, and responds to threats. The Sentinel prioritizes defense with guardian stacking and counter-intel sweeps. The Warlord maximizes offensive pressure with assassins and saboteurs. The Diplomat builds embassy networks and avoids betrayal. The Strategist adapts dynamically based on game state. The Chaos agent acts unpredictably, mixing strategies each cycle.',
      ),
      readout: [
        { label: msg('Sentinel'), value: msg('Defensive \u2014 guardians + sweeps') },
        { label: msg('Warlord'), value: msg('Aggressive \u2014 assassins + saboteurs') },
        { label: msg('Diplomat'), value: msg('Alliance-focused \u2014 embassy network') },
        { label: msg('Strategist'), value: msg('Adaptive \u2014 reads game state') },
        { label: msg('Chaos'), value: msg('Unpredictable \u2014 random mix') },
      ],
      tip: msg(
        'Difficulty affects decision quality: easy bots make suboptimal choices and waste RP, medium bots play competently, and hard bots optimize their strategy and exploit weaknesses.',
      ),
    },
    {
      phase: 'competition',
      title: msg('Bot Chat'),
      narration: msg(
        'Bots can participate in epoch chat with two modes. Template mode generates instant, cost-free responses based on personality templates. LLM mode uses OpenRouter to produce context-aware, strategically nuanced messages \u2014 bots will taunt, negotiate, and bluff based on the game state. The mode is configurable per simulation in AI Settings.',
      ),
      readout: [
        { label: msg('Template mode'), value: msg('Free, instant, personality-based') },
        { label: msg('LLM mode'), value: msg('AI-generated, context-aware') },
        { label: msg('Config'), value: msg('AI Settings \u2192 Bot Chat Mode') },
      ],
    },
  ];
}

/* ── Agent Chat ──────────────────────────────────── */

export function getAgentChatGuideSteps(): DemoStep[] {
  return [
    {
      phase: 'competition',
      title: msg('What is Agent Chat?'),
      narration: msg(
        'Agent Chat lets you have conversations with the agents in your simulation. Each agent responds with AI-generated dialogue shaped by their personality, profession, background, and accumulated memories. Conversations persist across sessions, building a rich history of interactions.',
      ),
      detail: msg(
        'The chat system uses a full context window of up to 50 previous messages plus the agent\u2019s relevant memories (retrieved via semantic similarity). This means agents remember what you\u2019ve discussed and can reference past conversations, creating a sense of continuity and depth.',
      ),
      readout: [
        { label: msg('Context'), value: msg('50 messages + memories') },
        { label: msg('AI Engine'), value: msg('OpenRouter (configurable model)') },
        { label: msg('Persistence'), value: msg('Full conversation history') },
        { label: msg('Access'), value: msg('Simulation \u2192 Chat tab') },
      ],
    },
    {
      phase: 'competition',
      title: msg('Memory-Augmented Responses'),
      narration: msg(
        'When an agent responds, the system retrieves their most relevant memories using a Stanford Generative Agents-style retrieval formula that balances semantic similarity, importance, and recency. These memories are injected into the agent\u2019s system prompt, so their responses reflect what they\u2019ve experienced \u2014 events they witnessed, missions they participated in, and reflections they\u2019ve formed.',
      ),
      tip: msg(
        'After each chat exchange, the system automatically extracts noteworthy observations from the conversation and stores them as new agent memories. Over time, agents develop richer, more nuanced personalities through accumulated interactions.',
      ),
    },
    {
      phase: 'competition',
      title: msg('Starting a Conversation'),
      narration: msg(
        'Navigate to the Chat tab in your simulation and select an agent from the agent selector. Each conversation is a separate thread \u2014 you can maintain multiple ongoing conversations with different agents. Messages appear with directional animations, and AI responses are generated in real time via OpenRouter.',
      ),
      readout: [
        { label: msg('Rate limit'), value: msg('10 messages per minute') },
        { label: msg('Agent selector'), value: msg('Choose any simulation agent') },
        { label: msg('Threads'), value: msg('One per agent, persistent') },
      ],
    },
  ];
}

/* ── Events & Reactions ──────────────────────────── */

export function getEventsGuideSteps(): DemoStep[] {
  return [
    {
      phase: 'competition',
      title: msg('What are Events?'),
      narration: msg(
        'Events are the narrative heartbeat of every simulation. They represent things that happen in the world \u2014 political upheavals, economic crises, military conflicts, cultural shifts, natural disasters. Events can be created manually, generated by AI, or produced automatically through game mechanics like operative missions and bleed echoes.',
      ),
      detail: msg(
        'Each event has a type (from the simulation\u2019s taxonomy), an impact level (1\u201310), tags for categorization, and a status lifecycle (active \u2192 escalating \u2192 resolving \u2192 resolved \u2192 archived). High-impact events trigger zone pressure, cascade mechanics, and bleed echoes to connected simulations.',
      ),
      readout: [
        { label: msg('Sources'), value: msg('Manual, AI, missions, bleed') },
        { label: msg('Impact'), value: msg('1\u201310 scale') },
        { label: msg('Status'), value: msg('Active \u2192 Resolved \u2192 Archived') },
        { label: msg('Access'), value: msg('Simulation \u2192 Events tab') },
      ],
    },
    {
      phase: 'competition',
      title: msg('AI Event Generation'),
      narration: msg(
        'Generate complete events using AI through the event creation modal. The AI produces a title, description, impact level, and tags \u2014 all contextually appropriate to your simulation\u2019s theme and current state. Each simulation can configure its own AI model and prompt templates to control the tone and style of generated events.',
      ),
      readout: [
        { label: msg('AI Engine'), value: msg('OpenRouter (configurable model)') },
        { label: msg('Rate limit'), value: msg('30 per hour') },
        { label: msg('Customizable'), value: msg('Per-simulation prompt templates') },
      ],
    },
    {
      phase: 'competition',
      title: msg('Agent Reactions'),
      narration: msg(
        'After an event occurs, agents can react to it based on their personality, profession, and background. Agent reactions are AI-generated character-driven responses \u2014 a military general reacts differently to an invasion than a merchant or a priest. Reactions appear as expandable cards below the event details.',
      ),
      tip: msg(
        'Events with high impact levels (8+) can trigger bleed echoes to connected simulations, cascade events in stressed zones, and shift epoch scoring dimensions. They\u2019re not just narrative \u2014 they have real mechanical consequences.',
      ),
    },
  ];
}

/* ── Simulation Lore ─────────────────────────────── */

export function getSimulationLoreGuideSteps(): DemoStep[] {
  return [
    {
      phase: 'lobby',
      title: msg('What is Simulation Lore?'),
      narration: msg(
        'Every simulation has a dedicated Lore section \u2014 an in-world narrative of 3,000\u20135,000 words organized into six chapters. Lore describes the world\u2019s history, geography, political systems, culture, and defining tensions. It\u2019s the first thing visitors see when entering a simulation, setting the tone for everything that follows.',
      ),
      detail: msg(
        'Lore is displayed through the LoreScroll component: an elegantly typeset reading experience using the Bureau font (Spectral serif) with themed section headers, paragraph spacing, and optional lore illustrations. The visual design adapts to each simulation\u2019s theme \u2014 dark brutalist for Velgarien, Victorian gaslight for The Gaslit Reach, deep-space horror for Station Null.',
      ),
      readout: [
        { label: msg('Length'), value: msg('3,000\u20135,000 words') },
        { label: msg('Chapters'), value: '6' },
        { label: msg('Illustrations'), value: msg('AI-generated (AVIF)') },
        { label: msg('Access'), value: msg('Simulation \u2192 Lore tab (default)') },
      ],
    },
    {
      phase: 'lobby',
      title: msg('Forge-Generated vs. Manual'),
      narration: msg(
        'Simulations created through the Forge receive AI-generated lore that weaves together the seed prompt, philosophical anchor, geography, agents, and buildings into a cohesive narrative. Lore is auto-translated to German. Simulations created manually can have lore written and edited by the owner through the Lore editor.',
      ),
      tip: msg(
        'Lore is publicly visible \u2014 anyone can browse a simulation\u2019s lore without logging in. It serves as the world\u2019s identity and helps players understand the thematic context before joining an epoch.',
      ),
    },
  ];
}

/* ── Simulation Health Dashboard ─────────────────── */

export function getSimulationHealthGuideSteps(): DemoStep[] {
  return [
    {
      phase: 'competition',
      title: msg('What is Simulation Health?'),
      narration: msg(
        'The Simulation Health dashboard shows the mechanical state of your world through four computed metrics: Building Readiness, Zone Stability, Embassy Effectiveness, and overall Simulation Health. These metrics directly feed into epoch scoring \u2014 they\u2019re not just flavor, they determine your score.',
      ),
      readout: [
        { label: msg('Building Readiness'), value: msg('Avg. building condition') },
        { label: msg('Zone Stability'), value: msg('Avg. zone security level') },
        { label: msg('Embassy Effectiveness'), value: msg('Diplomatic link strength') },
        { label: msg('Simulation Health'), value: msg('Composite of all metrics') },
      ],
    },
    {
      phase: 'competition',
      title: msg('How Metrics Change'),
      narration: msg(
        'Building Readiness drops when saboteurs damage your buildings (good \u2192 moderate \u2192 poor \u2192 ruined). Zone Stability decreases when enemy operatives succeed or cascade events fire. Embassy Effectiveness falls when infiltrators compromise your diplomatic links. All metrics recover over time but can be boosted by deploying guardians and fortifying zones.',
      ),
      detail: msg(
        'These metrics are computed from materialized database views that aggregate across all your buildings, zones, and embassies. They update automatically after each cycle resolution. The dashboard uses info bubbles to explain each metric\u2019s formula.',
      ),
      tip: msg(
        'Monitor your health dashboard between cycles to identify which metrics are under pressure. If zone stability is dropping, deploy guardians. If embassy effectiveness is falling, watch for infiltrators. The dashboard is your early warning system.',
      ),
    },
  ];
}

/* ── Social Trends & Campaigns ───────────────────── */

export function getSocialTrendsGuideSteps(): DemoStep[] {
  return [
    {
      phase: 'lobby',
      title: msg('What are Social Trends?'),
      narration: msg(
        'Social Trends lets you import real-world news from The Guardian and NewsAPI, then transform those articles into simulation-contextual events using AI. A news story about political unrest becomes a coup attempt in your dystopian city. A technology breakthrough becomes a forbidden invention in your steampunk world. This bridges the real and fictional.',
      ),
      readout: [
        { label: msg('Sources'), value: msg('The Guardian, NewsAPI') },
        { label: msg('Transform'), value: msg('AI contextual adaptation') },
        { label: msg('Output'), value: msg('Simulation events') },
        { label: msg('Access'), value: msg('Simulation \u2192 Social Trends tab') },
      ],
    },
    {
      phase: 'lobby',
      title: msg('The Transform Pipeline'),
      narration: msg(
        'The workflow is: Fetch \u2192 Transform \u2192 Integrate. First, browse or search real-world articles. Then, select an article and transform it \u2014 the AI rewrites the story through your simulation\u2019s lens, matching its theme, tone, and internal logic. Finally, integrate the transformed content as a new simulation event, optionally linking it to a campaign.',
      ),
      tip: msg(
        'Batch transform lets you process multiple articles at once. This is useful for creating a cluster of related events that simulate a real-world news cycle filtered through your simulation\u2019s worldview.',
      ),
    },
    {
      phase: 'lobby',
      title: msg('Campaigns'),
      narration: msg(
        'Campaigns group related events into thematic narratives \u2014 a propaganda initiative, an influence operation, or a social movement. Each campaign tracks engagement metrics and links back to its source events. The campaign dashboard shows an overview of all active campaigns with performance analytics.',
      ),
      readout: [
        { label: msg('Types'), value: msg('Marketing, political, social') },
        { label: msg('Metrics'), value: msg('Engagement, reach, impact') },
        { label: msg('Source'), value: msg('Manual, imported, social') },
        { label: msg('Dashboard'), value: msg('Simulation \u2192 Campaigns tab') },
      ],
    },
  ];
}

/* ── The Living World (Agent Autonomy) ──────────── */

export function getLivingWorldGuideSteps(): DemoStep[] {
  return [
    {
      phase: 'competition',
      title: msg('What is the Living World?'),
      narration: msg(
        'The Living World system makes agents act autonomously between your visits. Agents develop moods, form opinions about each other, pursue activities based on their personality, and generate social events. When you return, the world has lived \u2013 relationships shifted, conflicts emerged, celebrations happened. A morning briefing summarizes what occurred.',
      ),
      detail: msg(
        'The system runs during each heartbeat tick (every 4 hours). It processes agent needs, updates moods, recalculates opinions, selects activities via Utility AI, generates social interactions between co-located agents, and triggers autonomous events when thresholds are crossed. Rule-based mechanics cost zero AI calls; only narrative generation uses LLM.',
      ),
      readout: [
        { label: msg('Tick rate'), value: msg('Every 4 hours') },
        { label: msg('AI cost'), value: msg('$0 rules + ~$4/month narrative') },
        { label: msg('Activation'), value: msg('Settings \u2192 Autonomy tab') },
        { label: msg('Requirement'), value: msg('BYOK key or admin activation') },
      ],
    },
    {
      phase: 'competition',
      title: msg('Agent Mood & Stress'),
      narration: msg(
        'Every agent has a mood score (\u2212100 to +100) computed from active moodlets \u2013 individual emotional influences with three decay types. Permanent moodlets persist forever. Timed moodlets expire after a set duration. Decaying moodlets gradually weaken over time. The dominant emotion (joy, anxiety, anger, grief) is determined by the strongest active moodlet.',
      ),
      detail: msg(
        'Stress accumulates when mood is negative and recovers when positive. Resilient agents (low neuroticism) recover faster. When stress exceeds 800, the agent experiences a breakdown \u2013 a crisis event that spreads anxiety moodlets to all agents in the same zone, potentially triggering cascade breakdowns.',
      ),
      readout: [
        { label: msg('Mood range'), value: msg('\u2212100 (distressed) to +100 (euphoric)') },
        { label: msg('Stress range'), value: msg('0 (calm) to 1000 (breakdown)') },
        { label: msg('Breakdown'), value: msg('Stress > 800 \u2192 crisis event') },
        { label: msg('Cascade'), value: msg('Zone-wide anxiety spread') },
      ],
    },
    {
      phase: 'competition',
      title: msg('Agent Needs'),
      narration: msg(
        'Agents have five core needs that decay over time: Social (craving interaction), Purpose (meaningful work), Safety (zone security), Comfort (building conditions), and Stimulation (novelty). Each need ranges from 0 (desperate) to 100 (fully satisfied). Decay rates are personalized based on personality \u2013 extraverts lose social faster, conscientious agents need purpose more urgently.',
      ),
      detail: msg(
        'Needs drive activity selection through a Utility AI system. When social need drops low, the agent is more likely to seek conversation. When purpose is urgent, they gravitate toward work. Activities fulfill specific needs: working fulfills purpose, socializing fulfills social, exploring fulfills stimulation.',
      ),
      readout: [
        { label: msg('Social'), value: msg('Interaction, conversation') },
        { label: msg('Purpose'), value: msg('Work, creation, maintenance') },
        { label: msg('Safety'), value: msg('Zone stability, security') },
        { label: msg('Comfort'), value: msg('Building condition, rest') },
        { label: msg('Stimulation'), value: msg('Exploration, novelty') },
      ],
    },
    {
      phase: 'competition',
      title: msg('Opinions & Relationships'),
      narration: msg(
        'Agents form opinions about each other (\u2212100 to +100) through stacking modifiers. Sharing a zone builds familiarity (+3). Surviving a crisis together creates a bond (+15). Arguments reduce opinion (\u221212). When opinion crosses +60, a positive relationship is automatically created. When it drops below \u221260, hostility erupts.',
      ),
      detail: msg(
        'Base compatibility is computed deterministically from personality profiles \u2013 agents with similar Big Five traits start with higher natural affinity. Opinion modifiers have three decay types (permanent, timed, decaying) and stacking caps to prevent runaway escalation.',
      ),
      readout: [
        { label: msg('Range'), value: msg('\u2212100 (enmity) to +100 (devotion)') },
        { label: msg('Auto-create'), value: msg('> +60 \u2192 ally, < \u221260 \u2192 rival') },
        { label: msg('Stacking'), value: msg('Capped per modifier type') },
        { label: msg('Decay'), value: msg('Permanent / timed / decaying') },
      ],
    },
    {
      phase: 'competition',
      title: msg('Activity Selection'),
      narration: msg(
        'Each tick, agents choose an activity using Utility AI with Boltzmann selection. The system scores 14 possible activities (work, socialize, rest, explore, create, reflect, confront, celebrate, mourn, and more) based on current needs, personality traits, mood, and social context. The highest-scoring activity usually wins \u2013 but stressed agents make erratic choices.',
      ),
      detail: msg(
        'Boltzmann selection uses a temperature parameter scaled by stress. At low stress, agents make rational choices (best utility wins). At high stress, temperature rises and the probability distribution flattens \u2013 agents may choose suboptimal or destructive activities. This creates emergent drama without scripted narratives.',
      ),
      readout: [
        { label: msg('Activities'), value: msg('14 types') },
        { label: msg('Algorithm'), value: msg('Utility AI + Boltzmann') },
        { label: msg('Low stress'), value: msg('Rational, predictable') },
        { label: msg('High stress'), value: msg('Erratic, unpredictable') },
      ],
    },
    {
      phase: 'competition',
      title: msg('Social Interactions'),
      narration: msg(
        'When two agents share a zone, they have a chance of interacting socially each tick. Interaction types include deep conversations (+8 opinion, +5 mood), casual chats (+3 opinion), insults (\u221215 opinion, only at low mood), comfort-seeking (+18 opinion from trusted friends), and confrontations (\u221220 opinion, can trigger conflict events).',
      ),
      detail: msg(
        'Interaction probability scales with sociability, existing relationships, and social need urgency. High-intensity relationships increase frequency. Interactions generate opinion modifiers, mood moodlets, and need fulfillment. Some interactions (insults, confrontations) can escalate into autonomous events visible in the timeline and chronicle.',
      ),
      readout: [
        { label: msg('Deep conversation'), value: msg('+8 opinion, +5 mood') },
        { label: msg('Casual chat'), value: msg('+3 opinion, +2 mood') },
        { label: msg('Insult'), value: msg('\u221215 opinion (bad mood only)') },
        { label: msg('Confrontation'), value: msg('\u221220 opinion, triggers event') },
        { label: msg('Comfort'), value: msg('+18 opinion (trusted friends)') },
      ],
    },
    {
      phase: 'competition',
      title: msg('Autonomous Events'),
      narration: msg(
        'When conditions align, the system generates autonomous events with AI narrative text. Six trigger types exist: stress breakdowns (agent snaps), relationship breakthroughs (deep bond forms), relationship breakdowns (hostility erupts), celebrations (3+ happy agents gather), zone crisis reactions (agents panic in unstable zones), and conflict escalations (arguments become public).',
      ),
      detail: msg(
        'Autonomous events are real entries in the events table \u2013 they participate in all standard flows: bleed threshold checks (high-impact events can echo to other simulations), chronicle generation (the AI newspaper reports on them), and zone stability impact. They also create moodlets for witness agents, potentially triggering cascade reactions.',
      ),
      readout: [
        { label: msg('Triggers'), value: '6' },
        { label: msg('Narrative'), value: msg('AI-generated (DeepSeek V3.2)') },
        { label: msg('Integration'), value: msg('Bleed, Chronicle, Zone Stability') },
        { label: msg('Budget'), value: msg('Configurable LLM calls per tick') },
      ],
    },
    {
      phase: 'competition',
      title: msg('Epoch Impact'),
      narration: msg(
        'Agent autonomy directly affects competitive epoch gameplay. Happy agents (mood > 50) get a +3% bonus to operative success probability. Distressed agents (mood < \u221250) suffer a \u22123% penalty. Agents under high stress (> 500) take an additional \u22123% hit. This means maintaining agent welfare is a strategic advantage \u2013 neglecting your population weakens your military operations.',
      ),
      readout: [
        { label: msg('Mood > 50'), value: msg('+3% operative success') },
        { label: msg('Mood < \u221250'), value: msg('\u22123% operative success') },
        { label: msg('Stress > 500'), value: msg('\u22123% additional penalty') },
        { label: msg('Net effect'), value: msg('\u22126% to +3% swing') },
      ],
      tip: msg(
        'A player who resolves conflicts, maintains buildings, and keeps zones stable will have happier, more effective operatives. This connects the sandbox (Living World) with competitive play (Epochs).',
      ),
    },
    {
      phase: 'competition',
      title: msg('The Morning Briefing'),
      narration: msg(
        'The Daily Substrate Dispatch now includes an Agent Autonomy Report section. When you visit your simulation after agents have been active, you see: an AI-generated narrative summary in Bureau prose, a mood overview (happy/troubled/in crisis counts), significant activity highlights with priority classification, and relationship shifts since your last visit.',
      ),
      readout: [
        { label: msg('Narrative'), value: msg('AI Bureau prose (optional)') },
        { label: msg('Mood overview'), value: msg('Happy / Troubled / Crisis') },
        { label: msg('Highlights'), value: msg('Critical / Important / Routine') },
        { label: msg('Relationship shifts'), value: msg('Opinion changes') },
      ],
    },
    {
      phase: 'lobby',
      title: msg('Configuring Autonomy'),
      narration: msg(
        'Agent autonomy is configured per simulation in Settings \u2192 Autonomy. The master toggle enables the Living World system. Below it, you can tune needs decay rate (how fast agents get restless), social interaction rate (how often they talk), event trigger sensitivity (how easily events fire), stress cascades (chain reactions), and the LLM budget per tick.',
      ),
      detail: msg(
        'Activation requires either a personal OpenRouter API key (BYOK) or admin activation. When you provide your own key, AI narrative costs are charged to your account. When admin activates it, the platform covers costs. Rule-based mechanics (needs, mood, opinions, activities) always cost zero regardless.',
      ),
      readout: [
        { label: msg('Needs decay'), value: msg('0.1x\u20133.0x speed') },
        { label: msg('Social rate'), value: msg('0.1x\u20133.0x frequency') },
        { label: msg('Event sensitivity'), value: msg('0.1\u20131.0 threshold') },
        { label: msg('LLM budget'), value: msg('1\u201320 calls per tick') },
        { label: msg('Briefing mode'), value: msg('Narrative or data-only') },
      ],
    },
  ];
}

/* ── Epoch COMMS & Notifications ─────────────────── */

export function getEpochCommsGuideSteps(): DemoStep[] {
  return [
    {
      phase: 'competition',
      title: msg('What is the COMMS System?'),
      narration: msg(
        'The COMMS sidebar on the Epoch Operations Board provides real-time communication during competitive play. Two channels are available: ALL CHANNELS broadcasts to every participant, while TEAM FREQ is restricted to your alliance members. Messages update in real time via WebSocket \u2014 no page refresh needed.',
      ),
      readout: [
        { label: msg('ALL CHANNELS'), value: msg('Epoch-wide broadcast') },
        { label: msg('TEAM FREQ'), value: msg('Alliance-only channel') },
        { label: msg('Delivery'), value: msg('Real-time (WebSocket)') },
        { label: msg('History'), value: msg('Cursor-based pagination') },
      ],
    },
    {
      phase: 'competition',
      title: msg('Presence & Ready Signals'),
      narration: msg(
        'The presence indicator shows which players are currently online with a green dot. The ready signal system lets you indicate when you\u2019ve completed your actions for the current cycle. When all human participants signal ready, the cycle auto-resolves \u2014 no waiting for the timer.',
      ),
      tip: msg(
        'Use the COMMS to coordinate alliance strategy, negotiate truces, or bluff about your next move. Everything said in ALL CHANNELS is visible to all players \u2014 use TEAM FREQ for sensitive coordination.',
      ),
    },
    {
      phase: 'competition',
      title: msg('Email Briefings'),
      narration: msg(
        'After each cycle resolves, all participants receive a tactical briefing email. The email is bilingual (EN/DE), fog-of-war compliant (you only see your own operations), and includes your current rank, score gaps, mission outcomes, spy intel summaries, threat assessments, and a preview of the next cycle phase. Emails respect notification preferences \u2014 opt out anytime in Settings.',
      ),
      readout: [
        { label: msg('Triggers'), value: msg('Cycle resolve, phase change, epoch start') },
        { label: msg('Content'), value: msg('Fog-of-war compliant briefing') },
        { label: msg('Languages'), value: msg('EN + DE (bilingual)') },
        { label: msg('Opt-out'), value: msg('Settings \u2192 Notifications') },
      ],
    },
  ];
}
