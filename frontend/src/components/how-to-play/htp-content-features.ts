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
