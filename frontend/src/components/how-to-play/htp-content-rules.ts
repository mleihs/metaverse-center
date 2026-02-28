/**
 * How-to-Play: Sections 1-7 rule explanations.
 * All strings wrapped in msg() for i18n.
 */

import { msg } from '@lit/localize';
import type { OperativeCard, TacticCard, TocSection } from './htp-types.js';

export function getTocSections(): TocSection[] {
  return [
    { id: 'epochs', label: msg('What is an Epoch?') },
    { id: 'phases', label: msg('Phases & Timeline') },
    { id: 'rp', label: msg('Resonance Points') },
    { id: 'operatives', label: msg('Operatives') },
    { id: 'scoring', label: msg('Scoring System') },
    { id: 'alliances', label: msg('Alliances & Diplomacy') },
    { id: 'bleed', label: msg('Bleed & Echoes') },
    { id: 'tactics', label: msg('Tactics & Strategies') },
    { id: 'matches', label: msg('Example Matches') },
  ];
}

export function getPhases(): { name: string; color: string; description: string }[] {
  return [
    {
      name: msg('Lobby'),
      color: 'var(--color-gray-500)',
      description: msg('Simulations join and teams form. No operations allowed.'),
    },
    {
      name: msg('Foundation'),
      color: 'var(--color-success)',
      description: msg('+50% RP generation. Only guardians can deploy. Build your defenses.'),
    },
    {
      name: msg('Competition'),
      color: 'var(--color-warning)',
      description: msg('All operative types unlocked. Full warfare begins.'),
    },
    {
      name: msg('Reckoning'),
      color: 'var(--color-danger)',
      description: msg('Bleed amplified. Final push. Scores frozen at phase end.'),
    },
    {
      name: msg('Completed'),
      color: 'var(--color-gray-600)',
      description: msg('Titles awarded. Final standings published.'),
    },
  ];
}

export function getOperativeCards(): OperativeCard[] {
  return [
    {
      type: 'Spy',
      rpCost: 3,
      deployCycles: 0,
      missionCycles: 3,
      scoreValue: 2,
      description: msg(
        'Gathers intelligence from target simulation. Instant deployment, low cost, low risk.',
      ),
      effect: msg('Reveals target zone information and active defenses.'),
      color: 'var(--color-info)',
    },
    {
      type: 'Saboteur',
      rpCost: 5,
      deployCycles: 1,
      missionCycles: 1,
      scoreValue: 5,
      description: msg(
        "Degrades a target building's condition by one level (good \u2192 moderate \u2192 poor \u2192 ruined).",
      ),
      effect: msg('Damages infrastructure. Reduces target stability score.'),
      color: 'var(--color-warning)',
    },
    {
      type: 'Propagandist',
      rpCost: 4,
      deployCycles: 1,
      missionCycles: 2,
      scoreValue: 3,
      description: msg('Launches a propaganda campaign in target simulation.'),
      effect: msg(
        'Creates a destabilizing event (impact 3\u20135) in the target. Reduces their sovereignty.',
      ),
      color: 'var(--color-epoch-influence)',
    },
    {
      type: 'Assassin',
      rpCost: 8,
      deployCycles: 2,
      missionCycles: 1,
      scoreValue: 8,
      description: msg('Targets a specific agent. Highest cost, highest reward.'),
      effect: msg(
        'Weakens all relationships by \u20132 intensity. Blocks ambassador status for 3 cycles.',
      ),
      color: 'var(--color-danger)',
    },
    {
      type: 'Guardian',
      rpCost: 3,
      deployCycles: 0,
      missionCycles: 0,
      scoreValue: 0,
      description: msg(
        'Deploys to your own simulation. Reduces enemy success probability by 20% per guardian in zone.',
      ),
      effect: msg('Passive defense. Permanent while deployed. Foundation-phase only.'),
      color: 'var(--color-success)',
    },
    {
      type: 'Infiltrator',
      rpCost: 6,
      deployCycles: 2,
      missionCycles: 3,
      scoreValue: 4,
      description: msg('Targets an enemy embassy. Long deployment, high intelligence value.'),
      effect: msg(
        'Reduces embassy effectiveness by 50% for 3 cycles. Compromises diplomatic operations.',
      ),
      color: 'var(--color-text-secondary)',
    },
  ];
}

export function getRpRules(): { label: string; value: string }[] {
  return [
    { label: msg('Base RP per cycle'), value: '10' },
    { label: msg('Foundation bonus'), value: '+50% (15 RP)' },
    { label: msg('RP cap'), value: '30' },
    { label: msg('Counter-intel cost'), value: '3 RP' },
    { label: msg('RP accumulates'), value: msg('Unspent RP carries over') },
  ];
}

export function getScorePresets(): { name: string; weights: Record<string, number> }[] {
  return [
    {
      name: msg('Balanced'),
      weights: { stability: 25, influence: 20, sovereignty: 20, diplomatic: 15, military: 20 },
    },
    {
      name: msg('Builder'),
      weights: { stability: 35, influence: 15, sovereignty: 25, diplomatic: 15, military: 10 },
    },
    {
      name: msg('Warmonger'),
      weights: { stability: 10, influence: 20, sovereignty: 15, diplomatic: 15, military: 40 },
    },
    {
      name: msg('Diplomat'),
      weights: { stability: 15, influence: 20, sovereignty: 15, diplomatic: 35, military: 15 },
    },
  ];
}

export function getSuccessFormula(): string {
  return '0.5 + (qual \u00D7 0.05) \u2212 (zone_sec \u00D7 0.05) \u2212 (guardians \u00D7 0.20) + (embassy_eff \u00D7 0.15)';
}

export function getTactics(): TacticCard[] {
  return [
    // Openers
    {
      title: msg('The Foundation Wall'),
      category: 'opener',
      description: msg(
        'Spend all foundation RP on guardians (5 guardians = \u2212100% enemy success rate in defended zones). Maximum defense, zero offense. You enter competition with no RP reserve but an impenetrable fortress. Best with Builder preset where stability is king.',
      ),
    },
    {
      title: msg('The Quick Strike'),
      category: 'opener',
      description: msg(
        'Deploy only 1 guardian during foundation, save the rest. You enter competition with 30+ RP \u2014 enough for an assassin + saboteur on cycle 4. Risky: undefended zones are vulnerable. Best with Warmonger preset where early military points compound.',
      ),
    },
    {
      title: msg('The Balanced Start'),
      category: 'opener',
      description: msg(
        'Deploy 2\u20133 guardians, keep a moderate RP reserve (15\u201320). Covers key zones without sacrificing offensive capability. The safest opener \u2014 works with any preset and adapts to opponent behavior.',
      ),
    },
    // Timing
    {
      title: msg('Spy\u2192Saboteur Combo'),
      category: 'timing',
      description: msg(
        'Deploy a spy first (3 RP, instant). When intel resolves after 3 cycles, it reveals weak zones. Follow up with a saboteur (5 RP) aimed at the exposed target. Total investment: 8 RP over 2 cycles for a highly targeted strike.',
      ),
    },
    {
      title: msg('The Reckoning Rush'),
      category: 'timing',
      description: msg(
        'Save RP throughout competition, then unleash multiple operatives during reckoning when bleed is amplified. Opponents have fewer cycles to recover, and sovereignty hits hurt more. High risk: if enemies scored early, the deficit may be insurmountable.',
      ),
    },
    {
      title: msg('The Early Assassin'),
      category: 'timing',
      description: msg(
        'Deploy an assassin in cycles 5\u20136 (early competition). Costs 8 RP and takes 2 cycles to deploy, but a successful hit blocks the ambassador for 3 cycles during the critical mid-game. Devastating if it lands, crushing if detected (\u22123 military).',
      ),
    },
    // Economy
    {
      title: msg('RP Float vs. RP Burn'),
      category: 'economy',
      description: msg(
        'Never exceed the 30 RP cap (wasted income). Never hoard when good targets exist (opportunity cost). The sweet spot: spend 7\u20138 RP per cycle and maintain a 5\u201310 RP reserve for counter-intel or reactive deployments.',
      ),
    },
    {
      title: msg('Counter-Intel Timing'),
      category: 'economy',
      description: msg(
        'A sweep costs 3 RP. Use it when you suspect incoming propagandists or saboteurs \u2014 not every cycle. A detected enemy mission costs THEM \u22123 military AND negates their effect. One well-timed sweep can swing 8+ points.',
      ),
    },
    // Counter-Play
    {
      title: msg('Guardian Stacking'),
      category: 'counter',
      description: msg(
        'Each guardian reduces enemy success by 20%. Three guardians in one zone = 60% reduction. Forces enemies to target undefended zones instead. But 9 RP on defense is 9 RP not spent on offense \u2014 only stack when protecting high-value buildings.',
      ),
    },
    {
      title: msg('The Embassy Shield'),
      category: 'counter',
      description: msg(
        'Infiltrators reduce your embassy effectiveness by 50% for 3 cycles. Counter by deploying your own infiltrator against their embassy \u2014 mutual neutralization. Or stack guardians near embassy zones to prevent infiltration entirely.',
      ),
    },
    // Preset-Specific
    {
      title: msg('Builder: Turtle Up'),
      category: 'preset',
      description: msg(
        'With 35% stability weight, protect your buildings at all costs. A single saboteur degrading a building from good to moderate is catastrophic. Guardian-heavy defense + counter-intel sweeps every 2\u20133 cycles. Let enemies waste RP on failed attacks.',
      ),
    },
    {
      title: msg('Warmonger: Glass Cannon'),
      category: 'preset',
      description: msg(
        'With 40% military weight, every successful mission is massive (+5 saboteur, +8 assassin). But detected missions (\u22123 each) hurt double. Go all-in on offense with spies for intel, then targeted strikes. Accept defensive losses \u2014 stability only counts for 10%.',
      ),
    },
    {
      title: msg('Diplomat: Embassy Network'),
      category: 'preset',
      description: msg(
        'With 35% diplomatic weight, your embassies ARE your score. Each ally gives +10% diplomatic. Protect embassies from infiltrators, never betray allies (the \u221220% penalty is fatal), and focus on building the largest alliance network possible.',
      ),
    },
  ];
}
