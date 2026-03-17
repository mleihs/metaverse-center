/**
 * How-to-Play: Sections 1-7 rule explanations.
 * All strings wrapped in msg() for i18n.
 */

import { msg } from '@lit/localize';
import type {
  BalanceInsight,
  BleedVector,
  ChangelogEntry,
  DimensionVariance,
  EloRating,
  EmbassyInfoCard,
  HeadToHead,
  NormalizationRule,
  OperativeCard,
  ScoreDimension,
  SimulationProfile,
  StrategyTier,
  TacticCard,
  TocSection,
} from './htp-types.js';

export function getTocSections(): TocSection[] {
  return [
    // ── The World ──
    { id: 'intro', label: msg('What is metaverse.center?') },
    { id: 'simulation-lore', label: msg('Simulation Lore') },
    { id: 'forge-guide', label: msg('The Simulation Forge') },
    { id: 'agent-chat', label: msg('Agent Chat') },
    { id: 'events', label: msg('Events & Reactions') },
    { id: 'social-trends', label: msg('Social Trends & Campaigns') },
    { id: 'multiverse-map', label: msg('The Multiverse Map') },
    { id: 'simulation-health', label: msg('Simulation Health') },
    { id: 'simulation-pulse', label: msg('Simulation Pulse') },
    // ── Competitive Play ──
    { id: 'epochs', label: msg('What is an Epoch?') },
    { id: 'getting-started', label: msg('Getting Started') },
    { id: 'phases', label: msg('Phases & Timeline') },
    { id: 'rp', label: msg('Resonance Points') },
    { id: 'operatives', label: msg('Operatives') },
    { id: 'embassies', label: msg('Embassies & Ambassadors') },
    { id: 'scoring', label: msg('Scoring System') },
    { id: 'alliances', label: msg('Alliances & Diplomacy') },
    { id: 'bot-players', label: msg('Bot Players') },
    { id: 'epoch-comms', label: msg('COMMS & Notifications') },
    { id: 'academy-mode', label: msg('Academy Mode') },
    { id: 'results-screen', label: msg('Results & Commendations') },
    // ── Advanced Mechanics ──
    { id: 'bleed', label: msg('Bleed & Echoes') },
    { id: 'resonance-guide', label: msg('Substrate Resonances') },
    { id: 'zone-dynamics', label: msg('Event Pressure & Zones') },
    { id: 'agent-memory', label: msg('Agent Memory') },
    { id: 'chronicle-guide', label: msg('The Chronicle') },
    // ── Reference ──
    { id: 'tactics', label: msg('Tactics & Strategies') },
    { id: 'demo-run', label: msg('Demo Run') },
    { id: 'matches', label: msg('Example Matches') },
    { id: 'analytics', label: msg('Intelligence Report') },
    { id: 'updates', label: msg('Updates') },
  ];
}

export function getPhases(): { name: string; color: string; description: string }[] {
  return [
    {
      name: msg('Lobby'),
      color: 'var(--color-gray-500)',
      description: msg(
        'Simulations join, players draft their agent roster, and teams form. No operations allowed.',
      ),
    },
    {
      name: msg('Foundation'),
      color: 'var(--color-success)',
      description: msg(
        '+50% RP generation. Guardians and spies can deploy. Fortify zones for hidden defense.',
      ),
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
      effect: msg('Reveals target zone security levels and guardian count in the battle log.'),
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
      effect: msg(
        'Downgrades a random zone\u2019s security level by one tier. Damages infrastructure and stability.',
      ),
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
      rpCost: 7,
      deployCycles: 2,
      missionCycles: 1,
      scoreValue: 8,
      description: msg('Targets a specific agent. High cost, highest reward.'),
      effect: msg(
        'Weakens all relationships by \u20132 intensity. Blocks ambassador status for 3 cycles.',
      ),
      color: 'var(--color-danger)',
    },
    {
      type: 'Guardian',
      rpCost: 4,
      deployCycles: 0,
      missionCycles: 0,
      scoreValue: 0,
      description: msg(
        'Deploys to your own simulation. Reduces enemy success probability by 6% per guardian (max \u221215%).',
      ),
      effect: msg('Passive defense. Permanent while deployed. Foundation-phase only.'),
      color: 'var(--color-success)',
    },
    {
      type: 'Infiltrator',
      rpCost: 5,
      deployCycles: 2,
      missionCycles: 3,
      scoreValue: 6,
      description: msg('Targets an enemy embassy. Long deployment, high intelligence value.'),
      effect: msg(
        'Reduces embassy effectiveness by 65% for 3 cycles. Compromises diplomatic operations.',
      ),
      color: 'var(--color-text-secondary)',
    },
  ];
}

export function getRpRules(): { label: string; value: string }[] {
  return [
    { label: msg('Base RP per cycle'), value: '12' },
    { label: msg('Foundation bonus'), value: '+50% (18 RP)' },
    { label: msg('RP cap'), value: '40' },
    { label: msg('Counter-intel cost'), value: '4 RP' },
    { label: msg('Zone fortification cost'), value: '2 RP' },
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
  return '0.55 + (aptitude \u00D7 0.03) \u2212 (zone_sec \u00D7 0.05) \u2212 min(0.15, guardians \u00D7 0.06) + (embassy_eff \u00D7 0.15)';
}

export function getTactics(): TacticCard[] {
  return [
    // Openers
    {
      title: msg('The Foundation Wall'),
      category: 'opener',
      description: msg(
        'Spend all foundation RP on guardians + zone fortifications (3 guardians at 4 RP each + fortify 2 zones at 2 RP each = 16 RP). Maximum defense, zero offense. Fortifications add +1 security tier for 5 competition cycles. Best with Builder preset where stability is king.',
      ),
    },
    {
      title: msg('The Quick Strike'),
      category: 'opener',
      description: msg(
        'Deploy only 1 guardian during foundation, save the rest. You enter competition with 35+ RP \u2014 enough for an assassin + saboteur on cycle 4. Risky: undefended zones are vulnerable. Best with Warmonger preset where early military points compound.',
      ),
    },
    {
      title: msg('The Nebelkrieg'),
      category: 'opener',
      description: msg(
        'Foundation spies are now legal. Deploy 1\u20132 spies during foundation to scout enemy guardian deployment (which is public) and probe their zone layout. Combine with 1\u20132 zone fortifications on your weakest zones. You enter competition with intelligence AND hidden defenses. Best with Diplomat preset.',
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
        'Deploy an assassin in cycles 5\u20136 (early competition). Costs 7 RP and takes 2 cycles to deploy, but a successful hit blocks the ambassador for 3 cycles during the critical mid-game. Devastating if it lands, crushing if detected (\u22123 military).',
      ),
    },
    // Economy
    {
      title: msg('RP Float vs. RP Burn'),
      category: 'economy',
      description: msg(
        'Never exceed the 40 RP cap (wasted income). Never hoard when good targets exist (opportunity cost). The sweet spot: spend 9\u201310 RP per cycle and maintain a 5\u201315 RP reserve for counter-intel or reactive deployments.',
      ),
    },
    {
      title: msg('Counter-Intel Timing'),
      category: 'economy',
      description: msg(
        'A sweep costs 4 RP. Use it when you suspect incoming propagandists or saboteurs \u2014 not every cycle. A detected enemy mission costs THEM \u22123 military AND negates their effect. One well-timed sweep can swing 10+ points.',
      ),
    },
    // Counter-Play
    {
      title: msg('Guardian Stacking'),
      category: 'counter',
      description: msg(
        'Each guardian reduces enemy success by 6% (capped at \u221215% total). Three guardians reach the cap. Forces enemies to target undefended zones instead. But 12 RP on defense is 12 RP not spent on offense \u2014 only stack when protecting high-value buildings.',
      ),
    },
    {
      title: msg('The Embassy Shield'),
      category: 'counter',
      description: msg(
        'Infiltrators reduce your embassy effectiveness by 65% for 3 cycles. Counter by deploying your own infiltrator against their embassy \u2014 mutual neutralization. Or stack guardians near embassy zones to prevent infiltration entirely.',
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
        'With 40% military weight, every successful mission is massive (+5 saboteur, +8 assassin, +6 infiltrator). But detected missions (\u22123 each) hurt double. Go all-in on offense with spies for intel, then targeted strikes. Accept defensive losses \u2014 stability only counts for 10%.',
      ),
    },
    {
      title: msg('Diplomat: Embassy Network'),
      category: 'preset',
      description: msg(
        'With 35% diplomatic weight, your embassies ARE your score. Each ally gives +15% diplomatic. Protect embassies from infiltrators, never betray allies (the \u221225% penalty is fatal), and focus on building the largest alliance network possible.',
      ),
    },
  ];
}

export function getNormalizationRules(): NormalizationRule[] {
  return [
    { attribute: msg('Agents'), normalizedTo: msg('Max 6 per simulation') },
    { attribute: msg('Buildings'), normalizedTo: msg('Max 8 per simulation') },
    { attribute: msg('Condition'), normalizedTo: msg('All set to "good"') },
    { attribute: msg('Capacity'), normalizedTo: msg('All set to 30') },
    { attribute: msg('Qualifications'), normalizedTo: msg('All set to 5') },
    {
      attribute: msg('Security levels'),
      normalizedTo: msg('1\u00D7 high, 2\u00D7 medium, 1\u00D7 low'),
    },
    { attribute: msg('Debuffs'), normalizedTo: msg('All penalties cleared') },
  ];
}

export function getEmbassyInfo(): EmbassyInfoCard[] {
  return [
    {
      label: msg('Creation'),
      value: msg('4-step wizard: partner \u2192 protocol \u2192 ambassadors \u2192 confirm'),
    },
    { label: msg('Ambassador'), value: msg('Special agent status \u2014 targeted by assassins') },
    {
      label: msg('Effectiveness'),
      value: msg('Feeds into success formula: +embassy_eff \u00D7 0.15'),
    },
    { label: msg('Diplomatic score'), value: msg('sum(effectiveness) \u00D7 10') },
    { label: msg('Infiltrator vulnerability'), value: msg('\u221265% effectiveness for 3 cycles') },
    { label: msg('Assassin vulnerability'), value: msg('Blocks ambassador for 3 cycles') },
  ];
}

export function getScoreDimensions(): ScoreDimension[] {
  return [
    {
      key: 'stability',
      name: msg('Stability'),
      color: 'var(--color-success)',
      formula: 'avg(zone_stability) \u00D7 100 \u2212 penalties',
      explanation: msg(
        'Average stability across all zones, scaled to 0\u2013100. Penalized by propaganda (\u22123), sabotage (\u22126), and assassination (\u22125) attacks. Defend your infrastructure.',
      ),
      title: msg('The Unshaken'),
    },
    {
      key: 'influence',
      name: msg('Influence'),
      color: 'var(--color-epoch-influence)',
      formula: 'propaganda \u00D7 5 + spy \u00D7 2 + infiltrator \u00D7 3 + echoes',
      explanation: msg(
        'Propaganda successes (+5), espionage (+2), and infiltration (+3) plus echo strength from the bleed system. Rewards projecting power across the multiverse.',
      ),
      title: msg('The Resonant'),
    },
    {
      key: 'sovereignty',
      name: msg('Sovereignty'),
      color: 'var(--color-info)',
      formula: '100 \u2212 penalties + detected \u00D7 3 + guardians \u00D7 4',
      explanation: msg(
        'Base 100 minus inbound attack penalties (spy \u22122, propagandist \u22126, infiltrator \u22128, saboteur \u22128, assassin \u221212). Bonuses: +3 per detected enemy, +4 per guardian. Rewards active defense.',
      ),
      title: msg('The Sovereign'),
    },
    {
      key: 'diplomatic',
      name: msg('Diplomatic'),
      color: 'var(--color-warning)',
      formula:
        '(sum(eff) \u00D7 10 + spy) \u00D7 (1 + 0.15 \u00D7 allies) \u00D7 (1 \u2212 betrayal)',
      explanation: msg(
        'Embassy effectiveness times 10, plus spy intel bonus (+1 per success), multiplied by alliance bonus (+15% per ally) and reduced by betrayal penalty (\u221225%). Protect your embassies and honor your alliances.',
      ),
      title: msg('The Architect'),
    },
    {
      key: 'military',
      name: msg('Military'),
      color: 'var(--color-danger)',
      formula: 'sum(mission_scores) \u2212 sum(detected \u00D7 3)',
      explanation: msg(
        'Sum of successful mission values (infiltrator 6, saboteur 5, propagandist 4, spy 3, assassin 8) minus detection penalties (\u22123 per detected). High reward, high risk.',
      ),
      title: msg('The Shadow'),
    },
  ];
}

export function getBleedVectors(): BleedVector[] {
  return [
    {
      name: msg('Commerce'),
      color: 'var(--color-warning)',
      tags: ['commerce', 'trade', 'economy', 'market', 'merchant', 'gold'],
      description: msg('Trade routes and economic influence. Markets echo across boundaries.'),
    },
    {
      name: msg('Language'),
      color: 'var(--color-info)',
      tags: ['language', 'linguistic', 'communication', 'translation', 'dialect'],
      description: msg('Linguistic drift and communication patterns. Words bleed between worlds.'),
    },
    {
      name: msg('Memory'),
      color: 'var(--color-epoch-influence)',
      tags: ['memory', 'trauma', 'history', 'echo', 'past', 'loss'],
      description: msg('Collective trauma and shared history. Past events resonate forward.'),
    },
    {
      name: msg('Resonance'),
      color: 'var(--color-success)',
      tags: ['resonance', 'relationship', 'parallel', 'mirror', 'bond'],
      description: msg(
        'Relationship parallels between simulations. Bonds mirror across the divide.',
      ),
    },
    {
      name: msg('Architecture'),
      color: 'var(--color-gray-400)',
      tags: ['architecture', 'building', 'construction', 'structure', 'ruin'],
      description: msg('Structural influence. Buildings cast shadows into neighboring realities.'),
    },
    {
      name: msg('Dream'),
      color: 'var(--color-text-secondary)',
      tags: ['dream', 'vision', 'prophecy', 'mystical', 'spiritual', 'sleep'],
      description: msg('Visions and prophetic leakage. Dreams slip between simulation barriers.'),
    },
    {
      name: msg('Desire'),
      color: 'var(--color-danger)',
      tags: ['desire', 'yearning', 'longing', 'need', 'hunger', 'want'],
      description: msg('Yearning and need. The deepest urges cross all boundaries.'),
    },
  ];
}

export function getEchoStrengthFormula(): string {
  return 'base \u00D7 (1 + embassy_eff \u00D7 0.3) \u00D7 (1 + tag_resonance \u00D7 0.2) \u00D7 decay^depth \u00D7 (1 + instability \u00D7 0.2)';
}

export function getBleedThresholdRules(): { label: string; value: string }[] {
  return [
    { label: msg('Base impact threshold'), value: '8' },
    { label: msg('High instability (\u003E 0.7)'), value: '\u22121' },
    { label: msg('Strong embassy (\u003E 0.8)'), value: '\u22121' },
    { label: msg('Minimum floor'), value: '5' },
    { label: msg('Probabilistic zone (1\u20132 below)'), value: msg('15% base chance') },
    { label: msg('Reckoning phase'), value: msg('Threshold \u22122, cascade depth +1') },
  ];
}

export function getEchoLifecycle(): { name: string; color: string }[] {
  return [
    { name: msg('Pending'), color: 'var(--color-gray-500)' },
    { name: msg('Generating'), color: 'var(--color-info)' },
    { name: msg('Completed'), color: 'var(--color-success)' },
    { name: msg('Rejected'), color: 'var(--color-warning)' },
    { name: msg('Failed'), color: 'var(--color-danger)' },
  ];
}

export function getChangelog(): ChangelogEntry[] {
  return [
    {
      version: 'v2.6',
      date: '2026-03-08',
      title: msg('Complete Guide & Auto-Processing'),
      highlights: [
        msg(
          'Guide restructured: World \u2192 Competitive \u2192 Advanced \u2192 Reference progression',
        ),
        msg(
          '9 new guide sections: Intro, Lore, Events, Agent Chat, Social Trends, Map, Health, Bots, COMMS',
        ),
        msg('Automatic resonance impact processing when impacts_at timestamp arrives'),
      ],
      details: [
        {
          category: msg('Guide Restructure'),
          changes: [
            msg('Reorganized from 19 to 28 sections with logical learning progression'),
            msg('New intro: What is metaverse.center? \u2014 sandbox vs competitive modes'),
            msg('World sections first: Lore, Forge, Chat, Events, Social Trends, Map, Health'),
            msg('Then competitive rules: Epochs, Operatives, Scoring, Alliances, Bots, COMMS'),
            msg('Advanced mechanics: Bleed, Resonances, Zone Dynamics, Agent Memory, Chronicle'),
            msg('Reference: Tactics, Demo Run, Example Matches, Intelligence Report, Changelog'),
          ],
        },
        {
          category: msg('New Sections'),
          changes: [
            msg(
              'Events & Reactions: event creation, AI generation, agent reactions, mechanical impact',
            ),
            msg(
              'The Multiverse Map: interactive force-directed graph, game instance visualization, battle feed',
            ),
            msg('Bot Players: 5 personality archetypes, difficulty levels, dual-mode chat'),
            msg('Agent Chat: memory-augmented AI conversations, semantic retrieval'),
            msg('Simulation Lore: per-simulation worldbuilding narrative, Forge-generated content'),
            msg(
              'Simulation Health: building readiness, zone stability, embassy effectiveness dashboard',
            ),
            msg('Social Trends & Campaigns: real-world news integration pipeline'),
            msg(
              'COMMS & Notifications: epoch chat, presence, ready signals, tactical email briefings',
            ),
          ],
        },
        {
          category: msg('Resonance Auto-Processing'),
          changes: [
            msg('Background scheduler auto-processes resonances when impacts_at timestamp arrives'),
            msg(
              'Configurable via platform_settings: resonance_auto_process_enabled, resonance_auto_process_interval_seconds',
            ),
            msg('Uses service_role admin client (system actor pattern)'),
          ],
        },
      ],
    },
    {
      version: 'v2.5',
      date: '2026-03-06',
      title: msg('The Chronicle & Agent Memory'),
      highlights: [
        msg('The Chronicle: AI-generated per-simulation broadsheet newspaper'),
        msg(
          'Agent Memory: Stanford Generative Agents-style observe → store → retrieve → reflect loop',
        ),
        msg('pgvector semantic embeddings for memory retrieval (1536-dim)'),
        msg('Memories automatically injected into agent chat context'),
      ],
      details: [
        {
          category: msg('The Chronicle'),
          changes: [
            msg(
              'AI-generated newspaper editions synthesizing events, echoes, battle log, and agent reactions',
            ),
            msg(
              'Broadsheet front-page layout with CSS multi-column text, drop cap, and ornamental rules',
            ),
            msg(
              'Theme-responsive masthead: "The {SimName} Chronicle" with simulation\u2019s primary color',
            ),
            msg('Edition archive index with leader-dot navigation'),
            msg('Public read access, editor+ role required to generate editions'),
            msg('Auto-translation to German via existing translation pipeline'),
          ],
        },
        {
          category: msg('Agent Memory & Reflection'),
          changes: [
            msg('Observations extracted from chat exchanges via AI (fire-and-forget)'),
            msg(
              'pgvector embeddings (text-embedding-3-small, 1536 dimensions) for semantic retrieval',
            ),
            msg(
              'Stanford retrieval formula: 0.4 \u00D7 cosine_similarity + 0.4 \u00D7 importance/10 + 0.2 \u00D7 recency_decay',
            ),
            msg(
              'Reflection: synthesize higher-level insights from recent observations (editor+ trigger)',
            ),
            msg(
              'Memory timeline UI: observations (monospace/factual) vs reflections (italic/elevated)',
            ),
            msg('Importance pips (1\u201310 scale) for visual memory weight'),
            msg('Memories formatted and injected into agent system prompts during chat'),
          ],
        },
      ],
    },
    {
      version: 'v2.4',
      date: '2026-03-04',
      title: msg('Foundation Phase Redesign & Open Participation'),
      highlights: [
        msg('Foundation phase now allows spies alongside guardians'),
        msg('Hidden zone fortification: +1 security tier for 5 cycles (2 RP)'),
        msg('Intel Dossier tab: per-opponent intelligence from spy reports'),
        msg('Any user can join any epoch with any template simulation'),
      ],
      details: [
        {
          category: msg('Foundation Phase ("Nebelkrieg")'),
          changes: [
            msg('Spies can now deploy during Foundation phase for early intelligence'),
            msg('Guardian deployments are now public (visible in battle log)'),
            msg(
              'Zone fortification: 2 RP, +1 security tier, lasts 5 competition cycles, max 1 per zone',
            ),
            msg('Fortifications are hidden \u2014 only revealed by enemy spy intel reports'),
            msg('Bots use personality-specific fortification strategies'),
          ],
        },
        {
          category: msg('Intel Dossier'),
          changes: [
            msg('New tab on epoch detail: per-opponent intelligence cards'),
            msg('Aggregates spy reports showing zone security, guardian count, fortifications'),
            msg('Staleness indicator: intel fades after 3 cycles'),
            msg('Zone security badges with color-coded security levels'),
          ],
        },
        {
          category: msg('Open Epoch Participation'),
          changes: [
            msg('Any authenticated user can join an epoch with any template simulation'),
            msg('No simulation membership required \u2014 just pick a faction and play'),
            msg('Animated faction picker with staggered entrance and lock-in state'),
            msg('One user per epoch, one simulation per epoch (duplicate prevention)'),
          ],
        },
      ],
    },
    {
      version: 'v2.3',
      date: '2026-03-03',
      title: msg('Agent Aptitudes & Draft Phase'),
      highlights: [
        msg('Agent aptitudes: per-operative-type skill scores (3\u20139, budget 36)'),
        msg('Draft phase: select your roster before the epoch starts'),
        msg('Success formula: qualification \u00D7 0.05 \u2192 aptitude \u00D7 0.03'),
        msg('Lineup overview and fit indicators in deploy modal'),
      ],
      details: [
        {
          category: msg('Agent Aptitudes'),
          changes: [
            msg(
              'Each agent has 6 aptitude scores: spy, guardian, saboteur, propagandist, infiltrator, assassin',
            ),
            msg('Scores range from 3 (poor) to 9 (best), budget of 36 points per agent'),
            msg('Set in the simulation template via AgentDetailsPanel'),
            msg('Aptitude replaces uniform qualification in the success formula'),
            msg('Aptitude 3 = +9%, aptitude 6 = +18%, aptitude 9 = +27% (18pp swing)'),
          ],
        },
        {
          category: msg('Draft Phase'),
          changes: [
            msg('After joining an epoch, players draft their agent roster'),
            msg('Select up to N agents from your template (N = max_agents_per_player, default 6)'),
            msg('Full-screen draft overlay with aptitude bars and team stats'),
            msg('All human players must lock in before the epoch can start'),
            msg('Bots auto-draft based on their personality archetype'),
          ],
        },
        {
          category: msg('Deploy Modal'),
          changes: [
            msg('Agent dropdown sorted by aptitude for selected operative type'),
            msg('Fit indicator: Good (\u22657), Fair (\u22655), Poor (<5)'),
            msg('Aptitude bars with operative-type highlight in agent dossier'),
          ],
        },
      ],
    },
    {
      version: 'v2.2',
      date: '2026-03-02',
      title: msg('Balance Patch: Defensive Meta Nerf & Offensive Buffs'),
      highlights: [
        msg('Guardian defense nerfed to break ci_defensive dominance'),
        msg('Infiltrator reworked: cheaper, stronger, now generates influence'),
        msg('RP economy expanded: 12/cycle, 40 cap for multi-strategy play'),
        msg('Apache ECharts Intelligence Report visualizations'),
      ],
      details: [
        {
          category: msg('Guardian Nerfs'),
          changes: [
            msg('Penalty per guardian: 8%\u21926%, cap: 20%\u219215%'),
            msg('Guardian RP cost: 3\u21924 (stacking is more expensive)'),
            msg('Counter-intel sweep cost: 3\u21924 RP'),
          ],
        },
        {
          category: msg('Offensive Buffs'),
          changes: [
            msg('Saboteur stability penalty: \u22125\u2192\u22126'),
            msg(
              'Assassin: stability \u22124\u2192\u22125, sovereignty \u221210\u2192\u221212, cost 8\u21927 RP',
            ),
            msg('Propagandist sovereignty penalty: \u22125\u2192\u22126'),
            msg('Detection penalty: \u22122\u2192\u22123 per detected mission'),
          ],
        },
        {
          category: msg('Infiltrator Rework'),
          changes: [
            msg('Embassy reduction: 50%\u219265%'),
            msg('RP cost: 6\u21925 (cheaper to deploy)'),
            msg('Sovereignty penalty to target: \u22126\u2192\u22128'),
            msg('Now generates +3 influence per success'),
            msg('Mission score value: 5\u21926'),
          ],
        },
        {
          category: msg('RP Economy'),
          changes: [
            msg('Base RP per cycle: 10\u219212'),
            msg('RP cap: 30\u219240'),
            msg('Foundation bonus stays at +50% (now 18 RP/cycle)'),
            msg('Enables multi-strategy play and economy builds'),
          ],
        },
        {
          category: msg('Sovereignty Scoring'),
          changes: [
            msg('Detection bonus: +2\u2192+3 per caught operative'),
            msg('Infiltrator penalty: \u22126\u2192\u22128'),
            msg('Propagandist penalty: \u22125\u2192\u22126'),
            msg('Assassin penalty: \u221210\u2192\u221212'),
          ],
        },
      ],
    },
    {
      version: 'v2.0',
      date: '2026-02-28',
      title: msg('Game Instance Normalization'),
      highlights: [
        msg('Balanced starting conditions for all simulations'),
        msg('Automatic embassy generation between game instances'),
        msg('Agent profession qualification leveling'),
      ],
      details: [
        {
          category: msg('Cloning & Normalization'),
          changes: [
            msg('All simulations capped at 6 agents, 8 buildings'),
            msg('Building conditions normalized to "good"'),
            msg('Zone security distributed: 1\u00D7 high, 2\u00D7 medium, 1\u00D7 low'),
            msg('Agent qualifications set to 5'),
          ],
        },
        {
          category: msg('Mission Success'),
          changes: [
            msg('Base success probability raised from 0.50 to 0.55'),
            msg('Mission success rate increased from 15% to 52%'),
          ],
        },
        {
          category: msg('Embassy System'),
          changes: [
            msg('Embassies auto-generated between all game instances'),
            msg('Ambassador assignments preserved from templates'),
          ],
        },
      ],
    },
    {
      version: 'v2.1',
      date: '2026-03-01',
      title: msg('Balance Patch: Operative Effects & Scoring'),
      highlights: [
        msg('All 6 operative types now have real game state effects'),
        msg('Guardian defense rebalanced (less dominant)'),
        msg('3 scoring dimensions activated: stability, influence, diplomatic'),
      ],
      details: [
        {
          category: msg('New Operative Effects'),
          changes: [
            msg('Spy: reveals target zone security levels and guardian count in battle log'),
            msg('Saboteur: downgrades a random zone\u2019s security level by one tier'),
          ],
        },
        {
          category: msg('Scoring Rebalance'),
          changes: [
            msg('Stability: now penalized by sabotage (\u22125) and assassination (\u22124)'),
            msg('Influence: propaganda +3\u2192+5, spy +1\u2192+2'),
            msg(
              'Diplomatic: alliance bonus +10%\u2192+15%, betrayal penalty \u221220%\u2192\u221225%, spy intel +1',
            ),
            msg('Sovereignty: spy penalty \u22123\u2192\u22122, guardian bonus +3\u2192+4'),
          ],
        },
        {
          category: msg('Guardian Tuning'),
          changes: [
            msg('Penalty per guardian: 10%\u21928%, cap: 25%\u219220%'),
            msg('2.5 guardians now reach maximum effect (was 2.5 at old rate)'),
            msg('Guardians still meaningful but no longer impenetrable'),
          ],
        },
      ],
    },
  ];
}

/* ── Balance Analytics data ─────────────────────────── */

export function getEloRatings(): EloRating[] {
  return [
    { simulation: 'Speranza', rating: 1529, delta: 29, color: 'var(--color-warning)' },
    { simulation: 'The Gaslit Reach', rating: 1513, delta: 13, color: 'var(--color-success)' },
    { simulation: 'Velgarien', rating: 1511, delta: 11, color: 'var(--color-danger)' },
    {
      simulation: 'Nova Meridian',
      rating: 1501,
      delta: 1,
      color: 'var(--color-epoch-influence)',
    },
    { simulation: 'Station Null', rating: 1446, delta: -54, color: 'var(--color-info)' },
  ];
}

export function getStrategyTiers(): StrategyTier[] {
  return [
    {
      tier: 'S',
      tierColor: 'var(--color-warning)',
      strategies: [
        {
          name: msg('Counter-Intel Defensive'),
          winRate: 64.3,
          appearances: 70,
          description: msg('Guardian stacking + counter-intel sweeps. The dominant meta strategy.'),
        },
      ],
    },
    {
      tier: 'A',
      tierColor: 'var(--color-success)',
      strategies: [
        {
          name: msg('Propagandist Rush'),
          winRate: 46.5,
          appearances: 71,
          description: msg('Focus on propaganda missions for influence scoring.'),
        },
      ],
    },
    {
      tier: 'B',
      tierColor: 'var(--color-info)',
      strategies: [
        {
          name: msg('Spy Heavy'),
          winRate: 35.4,
          appearances: 65,
          description: msg('Intelligence gathering with targeted follow-up strikes.'),
        },
        {
          name: msg('Random Mix'),
          winRate: 32.2,
          appearances: 59,
          description: msg('Varied operative deployment. Unpredictable but unfocused.'),
        },
      ],
    },
    {
      tier: 'C',
      tierColor: 'var(--color-gray-500)',
      strategies: [
        {
          name: msg('Balanced'),
          winRate: 27.0,
          appearances: 63,
          description: msg('Even spread across all operative types.'),
        },
        {
          name: msg('Assassin Rush'),
          winRate: 24.2,
          appearances: 62,
          description: msg('High-cost assassin plays. Devastating when they land.'),
        },
        {
          name: msg('All-Out Assault'),
          winRate: 22.1,
          appearances: 68,
          description: msg('Maximum offensive pressure, no defense.'),
        },
        {
          name: msg('Saboteur Heavy'),
          winRate: 20.3,
          appearances: 79,
          description: msg('Infrastructure degradation focus.'),
        },
      ],
    },
    {
      tier: 'F',
      tierColor: 'var(--color-danger)',
      strategies: [
        {
          name: msg('Economy Build'),
          winRate: 6.2,
          appearances: 64,
          description: msg('RP hoarding. Forfeits military and influence points.'),
        },
        {
          name: msg('Infiltrator Focus'),
          winRate: 1.9,
          appearances: 53,
          description: msg('Embassy disruption only. Nearly zero impact on outcomes.'),
        },
      ],
    },
  ];
}

export function getSimulationProfiles(): SimulationProfile[] {
  return [
    {
      tag: 'SP',
      name: msg('Speranza'),
      color: 'var(--color-warning)',
      eloRating: 1529,
      winRates: { pc2: 54, pc3: 48, pc4: 26, pc5: 22 },
      ciLow: 28.4,
      ciHigh: 44.0,
      strengths: msg(
        'Most consistent across all formats. Wins through balanced multi-dimensional scoring rather than one-dimensional blowouts.',
      ),
      weakness: msg(
        'No single dominant format. Strongest at 2P/3P where sample sizes are smallest.',
      ),
    },
    {
      tag: 'GR',
      name: msg('The Gaslit Reach'),
      color: 'var(--color-success)',
      eloRating: 1513,
      winRates: { pc2: 65, pc3: 15, pc4: 14, pc5: 22 },
      ciLow: 19.5,
      ciHigh: 35.2,
      strengths: msg(
        'Dominant duel specialist at 65% in 2P. Excels in head-to-head matchups where targets are focused.',
      ),
      weakness: msg(
        'Collapses in 3P+ (14\u201322%). Gets outmaneuvered when targets are diluted across multiple opponents.',
      ),
    },
    {
      tag: 'V',
      name: msg('Velgarien'),
      color: 'var(--color-danger)',
      eloRating: 1511,
      winRates: { pc2: 46, pc3: 37, pc4: 26, pc5: 22 },
      ciLow: 25.0,
      ciHigh: 40.4,
      strengths: msg(
        'Balanced fundamentals. Consistently near theoretical fair rate at every player count.',
      ),
      weakness: msg(
        'Former structural advantage (v2: 43%) fully eliminated by v2.1 balance tuning.',
      ),
    },
    {
      tag: 'NM',
      name: msg('Nova Meridian'),
      color: 'var(--color-epoch-influence)',
      eloRating: 1501,
      winRates: { pc3: 20, pc4: 27, pc5: 18 },
      ciLow: 15.5,
      ciHigh: 30.9,
      strengths: msg(
        'Best 4P performer at 27%. Resurrected from 0% win rate in v2 by embassy fix.',
      ),
      weakness: msg(
        'No 2P data (excluded from duel format). Still finding its competitive identity.',
      ),
    },
    {
      tag: 'SN',
      name: msg('Station Null'),
      color: 'var(--color-info)',
      eloRating: 1446,
      winRates: { pc2: 35, pc3: 35, pc4: 17, pc5: 12 },
      ciLow: 16.5,
      ciHigh: 30.9,
      strengths: msg(
        'Stable in small formats (35% at both 2P and 3P). Consistent identity across versions.',
      ),
      weakness: msg(
        'Scales poorly to larger games. 12% at 5P is the weakest single data point in the dataset.',
      ),
    },
  ];
}

export function getDimensionVariance(): DimensionVariance[] {
  return [
    {
      name: msg('Sovereignty'),
      color: 'var(--color-info)',
      stdDev: 24.4,
      maxStd: 30,
      status: msg('Dominant'),
      contribution: 81,
    },
    {
      name: msg('Military'),
      color: 'var(--color-danger)',
      stdDev: 18.4,
      maxStd: 30,
      status: msg('High'),
      contribution: 61,
    },
    {
      name: msg('Influence'),
      color: 'var(--color-epoch-influence)',
      stdDev: 9.3,
      maxStd: 30,
      status: msg('Active'),
      contribution: 31,
    },
    {
      name: msg('Stability'),
      color: 'var(--color-success)',
      stdDev: 6.7,
      maxStd: 30,
      status: msg('Active'),
      contribution: 22,
    },
    {
      name: msg('Diplomatic'),
      color: 'var(--color-warning)',
      stdDev: 4.3,
      maxStd: 30,
      status: msg('Moderate'),
      contribution: 14,
    },
  ];
}

export function getHeadToHeadData(): HeadToHead[] {
  return [
    { rowSim: 'Speranza', colSim: 'The Gaslit Reach', winRate: 42, games: 26 },
    { rowSim: 'Speranza', colSim: 'Velgarien', winRate: 56, games: 26 },
    { rowSim: 'Speranza', colSim: 'Station Null', winRate: 64, games: 26 },
    { rowSim: 'The Gaslit Reach', colSim: 'Speranza', winRate: 58, games: 26 },
    { rowSim: 'The Gaslit Reach', colSim: 'Velgarien', winRate: 62, games: 26 },
    { rowSim: 'The Gaslit Reach', colSim: 'Station Null', winRate: 72, games: 26 },
    { rowSim: 'Velgarien', colSim: 'Speranza', winRate: 44, games: 26 },
    { rowSim: 'Velgarien', colSim: 'The Gaslit Reach', winRate: 38, games: 26 },
    { rowSim: 'Velgarien', colSim: 'Station Null', winRate: 58, games: 26 },
    { rowSim: 'Station Null', colSim: 'Speranza', winRate: 36, games: 26 },
    { rowSim: 'Station Null', colSim: 'The Gaslit Reach', winRate: 28, games: 26 },
    { rowSim: 'Station Null', colSim: 'Velgarien', winRate: 42, games: 26 },
  ];
}

export function getBalanceInsights(): BalanceInsight[] {
  return [
    {
      label: msg('Chi-Squared Test'),
      value: 'p = 0.199',
      description: msg(
        'Win distribution is NOT statistically significant (\u03C7\u00B2 = 6.00, df = 4). Observed differences are consistent with random chance.',
      ),
    },
    {
      label: msg('Elo Spread'),
      value: '83',
      description: msg(
        'Points between strongest (Speranza, 1529) and weakest (Station Null, 1446). Well within normal competitive variance.',
      ),
    },
    {
      label: msg('Nash Equilibrium'),
      value: msg('100% Defensive'),
      description: msg(
        'Game-theoretic optimal play is pure ci_defensive. The meta is solved \u2014 defensive play dominates all alternatives at 64% win rate.',
      ),
    },
    {
      label: msg('Bootstrap CIs'),
      value: msg('All Overlap'),
      description: msg(
        '95% confidence intervals for all 5 simulations overlap substantially (10,000 iterations). No simulation has a statistically provable advantage.',
      ),
    },
  ];
}
