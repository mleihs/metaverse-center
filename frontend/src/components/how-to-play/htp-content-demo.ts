/**
 * How-to-Play: Demo Run walkthrough.
 * A narrated step-by-step epoch lifecycle based on the v2.3 playtest.
 * All strings wrapped in msg() for i18n.
 */

import { msg } from '@lit/localize';
import type { DemoStep } from './htp-types.js';

/** Build a Supabase storage URL for a demo screenshot. */
function demoImage(filename: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL;
  return `${base}/storage/v1/object/public/simulation.assets/how-to-play/${filename}`;
}

export function getDemoSteps(): DemoStep[] {
  return [
    // ── Lobby ──────────────────────────────────────
    {
      phase: 'lobby',
      title: msg('Create the Epoch'),
      narration: msg(
        'From the Epoch Command Center, create a new epoch. Name it, choose a scoring preset (Balanced works for learning), and set the cycle interval. The wizard walks you through Economy, Doctrine, and Confirmation.',
      ),
      readout: [
        { label: msg('Epoch'), value: msg('Operation Nightfall') },
        { label: msg('Preset'), value: msg('Balanced') },
        { label: msg('Cycles'), value: '21' },
        { label: msg('RP / Cycle'), value: '12' },
        { label: msg('RP Cap'), value: '40' },
      ],
      tip: msg(
        'The Balanced preset (25/20/20/15/20) rewards well-rounded play. Start here before experimenting with Builder, Warmonger, or Diplomat presets.',
      ),
      image: demoImage('demo-01-create-epoch.avif'),
      imageAlt: msg('Epoch creation wizard confirmation step'),
    },
    {
      phase: 'lobby',
      title: msg('Join & Invite'),
      narration: msg(
        'Join the epoch with your simulation. Invite opponents via email or add AI bots from the Bot Deployment Console. Each bot has a personality archetype (Sentinel, Warlord, Diplomat, Strategist, Chaos) that shapes its strategy.',
      ),
      readout: [
        { label: msg('Player 1'), value: msg('Velgarien (Human)') },
        { label: msg('Player 2'), value: msg('The Gaslit Reach (Strategist Bot)') },
      ],
      image: demoImage('demo-02-join-invite.avif'),
      imageAlt: msg('Epoch lobby with human player and strategist bot'),
    },
    // ── Draft ──────────────────────────────────────
    {
      phase: 'draft',
      title: msg('Draft Your Roster'),
      narration: msg(
        'Before the epoch starts, draft your agent lineup. The full-screen draft overlay shows all your template agents with their aptitude profiles. Pick specialists who match the operative types you plan to deploy.',
      ),
      detail: msg(
        'Each agent has 6 aptitude scores (3\u20139) totaling 36 points. A spy aptitude of 9 gives +27% success, while 3 gives only +9%. Choose wisely \u2013 the wrong agent on the wrong mission costs you 18 percentage points.',
      ),
      readout: [
        { label: msg('Doktor Fenn'), value: msg('Infiltrator 9') },
        { label: msg('Elena Voss'), value: msg('Spy 9') },
        { label: msg('General Wolf'), value: msg('Guardian 9') },
        { label: msg('Lena Kray'), value: msg('Saboteur 9') },
        { label: msg('Mira Steinfeld'), value: msg('Propagandist 9') },
        { label: msg('Viktor Harken'), value: msg('Assassin 9') },
      ],
      tip: msg(
        'Draft one specialist per operative type for maximum coverage. A generalist team (all 6s) is safer but will never hit the +27% aptitude ceiling on any mission.',
      ),
      image: demoImage('demo-03-draft-roster.avif'),
      imageAlt: msg('Draft roster panel showing agent aptitude profiles'),
    },
    {
      phase: 'draft',
      title: msg('Lock In'),
      narration: msg(
        'Once you have selected your agents, lock in your roster. All human players must lock in before the epoch can start. Bots auto-draft based on their personality archetype.',
      ),
      readout: [
        { label: msg('Roster'), value: msg('6/6 Agents Drafted') },
        { label: msg('Strategy'), value: msg('One specialist per type') },
        { label: msg('Strongest'), value: msg('Full 9-aptitude coverage') },
      ],
      image: demoImage('demo-04-lock-in.avif'),
      imageAlt: msg('Six agents drafted and locked into deployment lineup'),
    },
    // ── Foundation ─────────────────────────────────
    {
      phase: 'foundation',
      title: msg('Deploy Guardians'),
      narration: msg(
        'The epoch starts in Foundation phase with +50% RP generation (18 RP/cycle). Only guardians can deploy during Foundation. Each guardian costs 4 RP and reduces enemy success probability by 6% (capped at 15% total).',
      ),
      detail: msg(
        'General Aldric Wolf (guardian aptitude 9) deploys as your first guardian. The 3-step wizard shows Agent \u2192 Mission \u2192 Confirmation with a classified dossier summary.',
      ),
      readout: [
        { label: msg('Agent'), value: msg('General Aldric Wolf') },
        { label: msg('Aptitude'), value: msg('Guardian 9') },
        { label: msg('Cost'), value: msg('4 RP') },
        { label: msg('Effect'), value: msg('\u22126% enemy success (passive)') },
        { label: msg('RP remaining'), value: '14 / 40' },
      ],
      tip: msg(
        'Deploy 1\u20132 guardians during Foundation, then save the rest of your RP for Competition. Three guardians reach the 15% cap \u2013 more is wasted.',
      ),
      image: demoImage('demo-05-deploy-guardian.avif'),
      imageAlt: msg('Guardian deployment confirmation with dossier summary'),
    },
    // ── Competition ────────────────────────────────
    {
      phase: 'competition',
      title: msg('Deploy a Spy'),
      narration: msg(
        'Competition unlocks all 6 operative types. Deploy Elena Voss (spy aptitude 9) against The Gaslit Reach. Spies cost only 3 RP, deploy instantly, and resolve after 3 cycles with valuable intelligence.',
      ),
      detail: msg(
        'The success formula accounts for agent aptitude, target zone security, your guardian count, and embassy effectiveness. Elena\u2019s spy aptitude of 9 gives her a 66% success probability \u2013 significantly better than a generalist agent at aptitude 6 (48%).',
      ),
      readout: [
        { label: msg('Agent'), value: msg('Elena Voss') },
        { label: msg('Aptitude'), value: msg('Spy 9 \u2192 +27%') },
        { label: msg('Mission'), value: msg('Espionage \u2192 The Gaslit Reach') },
        { label: msg('Success rate'), value: '66%' },
        { label: msg('Cost'), value: msg('3 RP') },
        { label: msg('Resolves'), value: msg('Cycle 5 (3 cycles)') },
      ],
      warning: msg(
        'If detected, you lose 3 military points and the mission fails. High-aptitude agents reduce this risk but never eliminate it.',
      ),
      image: demoImage('demo-06-deploy-spy.avif'),
      imageAlt: msg('Spy mission deployment targeting The Gaslit Reach'),
    },
    {
      phase: 'competition',
      title: msg('Wait for Resolution'),
      narration: msg(
        'Spy missions take 3 cycles to resolve. During this time, continue deploying other operatives or saving RP. Each cycle grants 12 RP (up to the 40 cap). The bot opponent is also making moves \u2013 you cannot see their deployments until the battle log reveals outcomes.',
      ),
      tip: msg(
        'Use the waiting cycles to deploy a propagandist (4 RP, 2 cycles) or save for an expensive assassin (7 RP, 2-cycle deploy). Timing is everything.',
      ),
      image: demoImage('demo-07-wait-resolution.avif'),
      imageAlt: msg('Active spy mission awaiting resolution'),
    },
    {
      phase: 'competition',
      title: msg('Spy Intel Report'),
      narration: msg(
        'After 3 cycles, the spy mission resolves. On success, the battle log reveals the target\u2019s zone security levels and guardian count \u2013 critical intelligence for planning your next strike.',
      ),
      readout: [
        { label: msg('Status'), value: msg('Mission Success') },
        { label: msg('Intel'), value: msg('0 guardians, zones: high / medium / medium / low') },
        { label: msg('Military'), value: msg('+3 points (spy score value)') },
        { label: msg('Influence'), value: msg('+2 points (espionage bonus)') },
      ],
      detail: msg(
        'The intel reveals no guardians protecting The Gaslit Reach \u2013 a wide-open target. A saboteur aimed at the low-security zone would have near-maximum success. This is the spy\u2192saboteur combo in action.',
      ),
      image: demoImage('demo-08-spy-intel.avif'),
      imageAlt: msg('Battle log showing spy intel report with zone security data'),
    },
    // ── Reckoning ──────────────────────────────────
    {
      phase: 'reckoning',
      title: msg('Final Push'),
      narration: msg(
        'Reckoning is the endgame. Bleed threshold drops by 2 and cascade depth increases by 1 \u2013 events that wouldn\u2019t bleed during Competition suddenly punch through. Sovereignty scores can shift dramatically. Deploy your remaining operatives for maximum impact before scores freeze.',
      ),
      warning: msg(
        'Reckoning is short. Operatives with 2+ cycle deploy times may not resolve before the epoch ends. Prioritize fast-deploying types: spies (instant), propagandists (1 cycle), guardians (instant).',
      ),
      image: demoImage('demo-09-final-push.avif'),
      imageAlt: msg('Reckoning phase with final operative deployments'),
    },
    // ── Completed ──────────────────────────────────
    {
      phase: 'completed',
      title: msg('Final Standings'),
      narration: msg(
        'When the epoch ends, scores freeze across all 5 dimensions. The composite score determines your final ranking. Titles are awarded based on your strongest dimension: The Unshaken (stability), The Resonant (influence), The Sovereign (sovereignty), The Architect (diplomatic), The Shadow (military).',
      ),
      readout: [
        { label: msg('1st Place'), value: msg('Velgarien \u2013 100.0 pts') },
        { label: msg('2nd Place'), value: msg('The Gaslit Reach \u2013 57.3 pts') },
        { label: msg('Key move'), value: msg('Spy intel \u2192 exposed weak zones') },
        { label: msg('Game time'), value: msg('5 cycles across 3 phases') },
      ],
      tip: msg(
        'One successful spy mission swung this match by 43 points. Intelligence is the foundation of every winning strategy \u2013 always deploy a spy early.',
      ),
      image: demoImage('demo-10-final-standings.avif'),
      imageAlt: msg('Final epoch standings with composite scores and titles'),
    },
  ];
}
