/**
 * How-to-Play: 4 fully worked-out example matches.
 * RP transactions validated against backend formulas.
 */

import { msg } from '@lit/localize';
import type { MatchConfig } from './htp-types.js';

export function getMatches(): MatchConfig[] {
  return [match1(), match2(), match3(), match4(), match5()];
}

/** Match 1: "First Blood" — Tutorial (2P, 3 days, 9 cycles, Balanced) */
function match1(): MatchConfig {
  return {
    title: msg('First Blood'),
    subtitle: msg('Tutorial Match'),
    players: ['Velgarien', 'The Gaslit Reach'],
    duration: '3 days',
    cycles: 9,
    preset: 'Balanced',
    description: msg(
      'A simple 1v1 duel that teaches the basics: RP management, guardian deployment, spying, sabotage, and propaganda events.',
    ),
    cycleData: [
      {
        cycle: 1,
        phase: 'foundation',
        rpAllocated: 15,
        actions: [
          {
            simulation: 'Velgarien',
            action: 'Deploy Guardian',
            rpCost: 3,
            note: msg('Fortify the Market District'),
          },
          {
            simulation: 'Gaslit Reach',
            action: 'Deploy Guardian',
            rpCost: 3,
            note: msg('Protect the River Ward'),
          },
        ],
      },
      {
        cycle: 2,
        phase: 'foundation',
        rpAllocated: 15,
        actions: [
          {
            simulation: 'Velgarien',
            action: 'Deploy Guardian',
            rpCost: 3,
            note: msg('Second guardian in Industrial Quarter'),
          },
          { simulation: 'Gaslit Reach', action: 'Deploy Guardian', rpCost: 3 },
        ],
      },
      {
        cycle: 3,
        phase: 'competition',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Velgarien',
            action: 'Deploy Spy',
            rpCost: 3,
            target: 'Gaslit Reach',
            note: msg('First offensive move'),
          },
          { simulation: 'Gaslit Reach', action: 'Deploy Spy', rpCost: 3, target: 'Velgarien' },
        ],
      },
      {
        cycle: 4,
        phase: 'competition',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Velgarien',
            action: 'Deploy Saboteur',
            rpCost: 5,
            target: 'Gaslit Reach',
            note: msg('Target The Drowned Bell'),
          },
          {
            simulation: 'Gaslit Reach',
            action: 'Deploy Propagandist',
            rpCost: 4,
            target: 'Velgarien',
          },
        ],
      },
      {
        cycle: 5,
        phase: 'competition',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Velgarien',
            action: 'Counter-Intel Sweep',
            rpCost: 3,
            note: msg('Detects the incoming propagandist!'),
          },
          { simulation: 'Gaslit Reach', action: 'Deploy Saboteur', rpCost: 5, target: 'Velgarien' },
        ],
      },
      {
        cycle: 6,
        phase: 'competition',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Velgarien',
            action: msg('Spy resolves: SUCCESS'),
            rpCost: 0,
            outcome: 'success',
            note: msg('+2 military score'),
          },
          {
            simulation: 'Gaslit Reach',
            action: msg('Propagandist resolves: DETECTED'),
            rpCost: 0,
            outcome: 'detected',
            note: msg('-3 military penalty. Propaganda event NOT created.'),
          },
        ],
      },
      {
        cycle: 7,
        phase: 'reckoning',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Velgarien',
            action: msg('Saboteur resolves: SUCCESS'),
            rpCost: 0,
            outcome: 'success',
            note: msg('Drowned Bell: good \u2192 moderate. +5 military.'),
          },
          {
            simulation: 'Gaslit Reach',
            action: 'Deploy Propagandist',
            rpCost: 4,
            target: 'Velgarien',
            note: msg('Revenge attempt during Reckoning'),
          },
        ],
      },
      {
        cycle: 8,
        phase: 'reckoning',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Gaslit Reach',
            action: msg('Saboteur resolves: FAILED'),
            rpCost: 0,
            outcome: 'failed',
          },
        ],
      },
      {
        cycle: 9,
        phase: 'reckoning',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Gaslit Reach',
            action: msg('Propagandist resolves: SUCCESS'),
            rpCost: 0,
            outcome: 'success',
            note: msg('Propaganda event created in Velgarien (impact 4). Sovereignty hit!'),
          },
        ],
        scoreSnapshot: { Velgarien: 68.4, 'Gaslit Reach': 51.2 },
      },
    ],
    finalStandings: [
      {
        rank: 1,
        simulation: 'Velgarien',
        composite: 68.4,
        stability: 85,
        influence: 12,
        sovereignty: 72,
        diplomatic: 45,
        military: 7,
        title: 'The Unshaken',
      },
      {
        rank: 2,
        simulation: 'The Gaslit Reach',
        composite: 51.2,
        stability: 62,
        influence: 5,
        sovereignty: 88,
        diplomatic: 40,
        military: -1,
      },
    ],
    keyMoments: [
      msg(
        "Cycle 5: Velgarien's counter-intel sweep catches the propagandist, saving sovereignty points.",
      ),
      msg(
        'Cycle 7: Saboteur successfully degrades The Drowned Bell, tipping the stability balance.',
      ),
      msg(
        "Cycle 9: The Gaslit Reach's late propagandist succeeds, creating a destabilizing event in Velgarien.",
      ),
    ],
  };
}

/** Match 2: "The Grand Alliance" — Teams (4P, 7 days, 21 cycles, Builder) */
function match2(): MatchConfig {
  return {
    title: msg('The Grand Alliance'),
    subtitle: msg('Team Match'),
    players: ['Velgarien', 'The Gaslit Reach', 'Station Null', 'Speranza'],
    duration: '7 days',
    cycles: 21,
    preset: 'Builder',
    description: msg(
      '2v2 alliance warfare. Velgarien + Speranza vs Gaslit Reach + Station Null. Shows coordinated spy\u2192saboteur combos, alliance diplomatic bonus (+10% per ally), and builder stability focus.',
    ),
    specialRules: msg('Alliance diplomatic bonus: each ally gives +10% to diplomatic score.'),
    cycleData: [
      {
        cycle: 1,
        phase: 'foundation',
        rpAllocated: 15,
        actions: [
          {
            simulation: 'All',
            action: msg('Form alliances'),
            rpCost: 0,
            note: msg(
              'Velgarien+Speranza form "Iron Pact". Gaslit Reach+Station Null form "Void Accord".',
            ),
          },
        ],
      },
      {
        cycle: 3,
        phase: 'foundation',
        rpAllocated: 15,
        actions: [
          {
            simulation: 'All',
            action: msg('Deploy 2 Guardians each'),
            rpCost: 6,
            note: msg('Foundation phase: fortify key zones'),
          },
        ],
      },
      {
        cycle: 7,
        phase: 'competition',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Velgarien',
            action: 'Deploy Spy',
            rpCost: 3,
            target: 'Gaslit Reach',
            note: msg('Intel gathering for coordinated strike'),
          },
          {
            simulation: 'Speranza',
            action: 'Deploy Spy',
            rpCost: 3,
            target: 'Station Null',
            note: msg('Coordinated with ally'),
          },
        ],
      },
      {
        cycle: 10,
        phase: 'competition',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Velgarien',
            action: msg('Spy resolves: SUCCESS'),
            rpCost: 0,
            outcome: 'success',
            note: msg('Intel reveals weak zone'),
          },
          {
            simulation: 'Velgarien',
            action: 'Deploy Saboteur',
            rpCost: 5,
            target: 'Gaslit Reach',
            note: msg('Follow-up strike on revealed weakness'),
          },
          {
            simulation: 'Station Null',
            action: 'Deploy Infiltrator',
            rpCost: 6,
            target: msg('Iron Pact embassy'),
            note: msg('Counter-attack on alliance infrastructure'),
          },
        ],
      },
      {
        cycle: 14,
        phase: 'competition',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Velgarien',
            action: msg('Saboteur resolves: SUCCESS'),
            rpCost: 0,
            outcome: 'success',
            note: msg(
              'Building degraded. Builder preset amplifies stability loss for Gaslit Reach.',
            ),
          },
          {
            simulation: 'Speranza',
            action: 'Deploy Saboteur',
            rpCost: 5,
            target: 'Station Null',
            note: msg('Coordinated pressure on second enemy'),
          },
        ],
      },
      {
        cycle: 18,
        phase: 'reckoning',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Station Null',
            action: msg('Infiltrator resolves: SUCCESS'),
            rpCost: 0,
            outcome: 'success',
            note: msg('Iron Pact embassy compromised! \u221250% effectiveness for 3 cycles.'),
          },
        ],
      },
      {
        cycle: 21,
        phase: 'reckoning',
        rpAllocated: 10,
        actions: [],
        scoreSnapshot: {
          Velgarien: 78.2,
          Speranza: 71.5,
          'The Gaslit Reach': 55.8,
          'Station Null': 62.1,
        },
      },
    ],
    finalStandings: [
      {
        rank: 1,
        simulation: 'Velgarien',
        composite: 78.2,
        stability: 82,
        influence: 18,
        sovereignty: 90,
        diplomatic: 52,
        military: 12,
        title: 'The Unshaken',
      },
      {
        rank: 2,
        simulation: 'Speranza',
        composite: 71.5,
        stability: 75,
        influence: 14,
        sovereignty: 85,
        diplomatic: 48,
        military: 9,
      },
      {
        rank: 3,
        simulation: 'Station Null',
        composite: 62.1,
        stability: 70,
        influence: 8,
        sovereignty: 78,
        diplomatic: 35,
        military: 4,
      },
      {
        rank: 4,
        simulation: 'The Gaslit Reach',
        composite: 55.8,
        stability: 55,
        influence: 5,
        sovereignty: 82,
        diplomatic: 38,
        military: -1,
      },
    ],
    keyMoments: [
      msg(
        'Cycle 7-10: Iron Pact executes a coordinated spy\u2192saboteur combo across both enemies.',
      ),
      msg('Cycle 14: Builder preset (stability weight 35%) makes sabotage devastating.'),
      msg(
        "Cycle 18: Station Null's infiltrator compromises the Iron Pact embassy, reducing diplomatic effectiveness.",
      ),
      msg('Alliance bonus: Iron Pact members each get +10% diplomatic from their ally.'),
    ],
  };
}

/** Match 3: "Shadow War" — Aggression (3P FFA, 5 days, 20 cycles, Warmonger) */
function match3(): MatchConfig {
  return {
    title: msg('Shadow War'),
    subtitle: msg('Free-for-All'),
    players: ['Velgarien', 'Station Null', 'Speranza'],
    duration: '5 days',
    cycles: 20,
    preset: 'Warmonger',
    description: msg(
      'Three-way free-for-all with Warmonger preset (military weight 40%). All-out offensive showcasing assassins, counter-intel, ambassador blocking, and infiltrator embassy reduction.',
    ),
    cycleData: [
      {
        cycle: 2,
        phase: 'foundation',
        rpAllocated: 15,
        actions: [
          { simulation: 'Velgarien', action: 'Deploy Guardian \u00D72', rpCost: 6 },
          {
            simulation: 'Station Null',
            action: 'Deploy Guardian',
            rpCost: 3,
            note: msg('Minimal defense, saving RP for offense'),
          },
          { simulation: 'Speranza', action: 'Deploy Guardian \u00D72', rpCost: 6 },
        ],
      },
      {
        cycle: 5,
        phase: 'competition',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Station Null',
            action: 'Deploy Assassin',
            rpCost: 8,
            target: 'Velgarien',
            note: msg('Target: Ambassador Aldric'),
          },
          { simulation: 'Velgarien', action: 'Deploy Saboteur', rpCost: 5, target: 'Speranza' },
          { simulation: 'Speranza', action: 'Deploy Spy', rpCost: 3, target: 'Station Null' },
        ],
      },
      {
        cycle: 8,
        phase: 'competition',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Station Null',
            action: msg('Assassin resolves: SUCCESS'),
            rpCost: 0,
            outcome: 'success',
            note: msg(
              "Aldric's relationships \u22122. Ambassador status BLOCKED for 3 cycles (24h).",
            ),
          },
          {
            simulation: 'Velgarien',
            action: 'Counter-Intel Sweep',
            rpCost: 3,
            note: msg('Too late \u2013 assassin already resolved'),
          },
        ],
      },
      {
        cycle: 10,
        phase: 'competition',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Speranza',
            action: 'Deploy Infiltrator',
            rpCost: 6,
            target: msg('Station Null embassy'),
          },
          {
            simulation: 'Velgarien',
            action: 'Deploy Assassin',
            rpCost: 8,
            target: 'Station Null',
            note: msg('Revenge for Aldric'),
          },
        ],
      },
      {
        cycle: 13,
        phase: 'competition',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Speranza',
            action: msg('Infiltrator resolves: SUCCESS'),
            rpCost: 0,
            outcome: 'success',
            note: msg('Station Null embassy COMPROMISED. \u221250% effectiveness for 3 cycles.'),
          },
        ],
      },
      {
        cycle: 15,
        phase: 'reckoning',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Velgarien',
            action: msg('Assassin resolves: DETECTED'),
            rpCost: 0,
            outcome: 'detected',
            note: msg('Revenge mission fails! \u22123 military penalty.'),
          },
        ],
      },
      {
        cycle: 20,
        phase: 'reckoning',
        rpAllocated: 10,
        actions: [],
        scoreSnapshot: { 'Station Null': 72.8, Velgarien: 58.3, Speranza: 65.4 },
      },
    ],
    finalStandings: [
      {
        rank: 1,
        simulation: 'Station Null',
        composite: 72.8,
        stability: 60,
        influence: 12,
        sovereignty: 75,
        diplomatic: 25,
        military: 16,
        title: 'The Shadow',
      },
      {
        rank: 2,
        simulation: 'Speranza',
        composite: 65.4,
        stability: 72,
        influence: 8,
        sovereignty: 80,
        diplomatic: 18,
        military: 4,
      },
      {
        rank: 3,
        simulation: 'Velgarien',
        composite: 58.3,
        stability: 78,
        influence: 5,
        sovereignty: 82,
        diplomatic: 15,
        military: -1,
      },
    ],
    keyMoments: [
      msg(
        "Cycle 8: Station Null's assassin blocks Ambassador Aldric \u2013 Velgarien loses embassy effectiveness.",
      ),
      msg(
        "Cycle 13: Speranza's infiltrator compromises Station Null's embassy \u2013 50% penalty for 3 cycles.",
      ),
      msg(
        "Cycle 15: Velgarien's revenge assassin is detected \u2013 costly failure with Warmonger's 40% military weight.",
      ),
      msg(
        "Warmonger preset makes military the decisive dimension. Station Null's successful assassin (+8) vs Velgarien's detected attempt (\u22123) creates a 11-point swing.",
      ),
    ],
  };
}

/** Match 4: "The Diplomat's Gambit" — Betrayal (4P, 7 days, 21 cycles, Diplomat) */
function match4(): MatchConfig {
  return {
    title: msg("The Diplomat's Gambit"),
    subtitle: msg('Betrayal Match'),
    players: ['Velgarien', 'The Gaslit Reach', 'Station Null', 'Speranza'],
    duration: '7 days',
    cycles: 21,
    preset: 'Diplomat',
    description: msg(
      "Alliance with betrayal enabled. One player secretly attacks their ally in cycle 15, gets detected in cycle 18 \u2013 alliance dissolves, \u221220% diplomatic penalty. Shows how betrayal can backfire with Diplomat preset's 35% diplomatic weight.",
    ),
    specialRules: msg(
      'allow_betrayal = true. Detected betrayal dissolves the entire alliance and applies \u221220% diplomatic penalty to the betrayer.',
    ),
    cycleData: [
      {
        cycle: 1,
        phase: 'foundation',
        rpAllocated: 15,
        actions: [
          {
            simulation: 'All',
            action: msg('Form alliances'),
            rpCost: 0,
            note: msg(
              'Velgarien+Gaslit Reach form "Dawn Covenant". Station Null+Speranza form "Ashen League".',
            ),
          },
        ],
      },
      {
        cycle: 5,
        phase: 'foundation',
        rpAllocated: 15,
        actions: [
          {
            simulation: 'All',
            action: msg('Foundation defenses established'),
            rpCost: 6,
            note: msg('2 guardians each, embassy connections active'),
          },
        ],
      },
      {
        cycle: 8,
        phase: 'competition',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Dawn Covenant',
            action: msg('Coordinated strikes on Ashen League'),
            rpCost: 8,
            target: msg('Station Null + Speranza'),
          },
          {
            simulation: 'Ashen League',
            action: msg('Coordinated defense + counter-strikes'),
            rpCost: 8,
            target: msg('Dawn Covenant'),
          },
        ],
      },
      {
        cycle: 12,
        phase: 'competition',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'All',
            action: msg('Standard operations continue'),
            rpCost: 5,
            note: msg('Score gap: Dawn Covenant leading by ~8 points composite'),
          },
        ],
      },
      {
        cycle: 15,
        phase: 'competition',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Gaslit Reach',
            action: 'Deploy Saboteur',
            rpCost: 5,
            target: 'Velgarien',
            note: msg(
              'BETRAYAL! Gaslit Reach secretly attacks ally Velgarien. Targets the Great Library.',
            ),
          },
          {
            simulation: 'Gaslit Reach',
            action: 'Deploy Spy',
            rpCost: 3,
            target: 'Velgarien',
            note: msg('Second betrayal operation'),
          },
        ],
      },
      {
        cycle: 17,
        phase: 'reckoning',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Velgarien',
            action: 'Counter-Intel Sweep',
            rpCost: 3,
            note: msg('Routine sweep...'),
          },
        ],
      },
      {
        cycle: 18,
        phase: 'reckoning',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Gaslit Reach',
            action: msg('Saboteur resolves: DETECTED'),
            rpCost: 0,
            outcome: 'detected',
            note: msg(
              'BETRAYAL DETECTED! The Dawn Covenant is dissolved. Gaslit Reach receives \u221220% diplomatic penalty. The Great Library is saved, but trust is shattered.',
            ),
          },
        ],
      },
      {
        cycle: 21,
        phase: 'reckoning',
        rpAllocated: 10,
        actions: [],
        scoreSnapshot: {
          'Station Null': 74.1,
          Speranza: 70.3,
          Velgarien: 65.8,
          'The Gaslit Reach': 42.7,
        },
      },
    ],
    finalStandings: [
      {
        rank: 1,
        simulation: 'Station Null',
        composite: 74.1,
        stability: 68,
        influence: 15,
        sovereignty: 78,
        diplomatic: 55,
        military: 8,
        title: 'The Architect',
      },
      {
        rank: 2,
        simulation: 'Speranza',
        composite: 70.3,
        stability: 72,
        influence: 10,
        sovereignty: 82,
        diplomatic: 50,
        military: 5,
      },
      {
        rank: 3,
        simulation: 'Velgarien',
        composite: 65.8,
        stability: 80,
        influence: 8,
        sovereignty: 85,
        diplomatic: 32,
        military: 2,
      },
      {
        rank: 4,
        simulation: 'The Gaslit Reach',
        composite: 42.7,
        stability: 65,
        influence: 5,
        sovereignty: 75,
        diplomatic: 18,
        military: -4,
      },
    ],
    keyMoments: [
      msg(
        'Cycle 15: Gaslit Reach secretly deploys against ally Velgarien \u2013 a desperate gambit to seize first place.',
      ),
      msg("Cycle 17: Velgarien's routine counter-intel sweep reveals the saboteur."),
      msg(
        'Cycle 18: Betrayal detected! Dawn Covenant dissolves. Gaslit Reach loses 20% diplomatic score.',
      ),
      msg(
        'With Diplomat preset (diplomatic weight 35%), the \u221220% penalty is devastating \u2013 Gaslit Reach drops from 2nd to last place.',
      ),
      msg(
        'Lesson: Betrayal is high-risk. The Diplomat preset punishes it hardest because diplomatic score carries the most weight.',
      ),
    ],
  };
}

/** Match 5: "The Complete Campaign" — Every cycle shown (3P FFA, 5 days, 15 cycles, Balanced) */
function match5(): MatchConfig {
  return {
    title: msg('The Complete Campaign'),
    subtitle: msg('Full Replay \u2013 Every Cycle'),
    players: ['Velgarien', 'The Gaslit Reach', 'Station Null'],
    duration: '5 days',
    cycles: 15,
    preset: 'Balanced',
    description: msg(
      'A complete 3-player free-for-all with every single cycle shown \u2013 no skipped turns. Tracks RP budgets, deployment timing, resolution outcomes, phase transitions, and score evolution from start to finish. Demonstrates all six operative types, counter-intel, and phase-specific strategy.',
    ),
    cycleData: [
      // ── Foundation: cycles 1-3 (15 RP/cycle, guardians only) ──
      {
        cycle: 1,
        phase: 'foundation',
        rpAllocated: 15,
        actions: [
          {
            simulation: 'Velgarien',
            action: 'Deploy Guardian \u00D72',
            rpCost: 6,
            note: msg('Market District + Industrial Quarter. Balance: 15\u22126 = 9 RP'),
          },
          {
            simulation: 'Gaslit Reach',
            action: 'Deploy Guardian',
            rpCost: 3,
            note: msg('Undertide Docks only. Saving RP for quick strike. Balance: 12 RP'),
          },
          {
            simulation: 'Station Null',
            action: 'Deploy Guardian \u00D72',
            rpCost: 6,
            note: msg('Sector 7 + Medbay Corridor. Balance: 9 RP'),
          },
        ],
      },
      {
        cycle: 2,
        phase: 'foundation',
        rpAllocated: 15,
        actions: [
          {
            simulation: 'Velgarien',
            action: 'Deploy Guardian',
            rpCost: 3,
            note: msg('Noble Quarter. Balance: 9+15\u22123 = 21 RP'),
          },
          {
            simulation: 'Gaslit Reach',
            action: 'Deploy Guardian',
            rpCost: 3,
            note: msg('Glimhaven Exchange. Balance: 12+15\u22123 = 24 RP'),
          },
          {
            simulation: 'Station Null',
            action: 'Deploy Guardian',
            rpCost: 3,
            note: msg('Command Deck. Balance: 9+15\u22123 = 21 RP'),
          },
        ],
      },
      {
        cycle: 3,
        phase: 'foundation',
        rpAllocated: 15,
        actions: [
          {
            simulation: 'Velgarien',
            action: msg('Save RP'),
            rpCost: 0,
            note: msg('3 guardians deployed. Balance: 21+15 = 30 RP (cap). Foundation ends.'),
          },
          {
            simulation: 'Gaslit Reach',
            action: msg('Save RP'),
            rpCost: 0,
            note: msg('2 guardians deployed. Balance: 24+15 = 30 RP (cap). Aggressive reserve.'),
          },
          {
            simulation: 'Station Null',
            action: msg('Save RP'),
            rpCost: 0,
            note: msg('3 guardians deployed. Balance: 21+15 = 30 RP (cap). Solid defense.'),
          },
        ],
      },
      // ── Competition: cycles 4-12 (10 RP/cycle, all ops unlocked) ──
      {
        cycle: 4,
        phase: 'competition',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Velgarien',
            action: 'Deploy Spy',
            rpCost: 3,
            target: 'Gaslit Reach',
            note: msg(
              'Intel gathering. Instant deploy, resolves cycle 7. Balance: 30+10\u22123 = 30 (cap)',
            ),
          },
          {
            simulation: 'Gaslit Reach',
            action: 'Deploy Spy',
            rpCost: 3,
            target: 'Station Null',
            note: msg('Quick strike doctrine. Balance: 30+10\u22123 = 30 (cap)'),
          },
          {
            simulation: 'Station Null',
            action: msg('Save RP'),
            rpCost: 0,
            note: msg('Waiting for intel. Balance: 30 (cap)'),
          },
        ],
      },
      {
        cycle: 5,
        phase: 'competition',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Velgarien',
            action: 'Deploy Saboteur',
            rpCost: 5,
            target: 'Station Null',
            note: msg('1 cycle deploy. Target: Reactor Core. Balance: 30\u22125 = 25 RP'),
          },
          {
            simulation: 'Gaslit Reach',
            action: 'Deploy Propagandist',
            rpCost: 4,
            target: 'Velgarien',
            note: msg(
              '1 cycle deploy, 2 cycle mission. Propaganda campaign. Balance: 30\u22124 = 26 RP',
            ),
          },
          {
            simulation: 'Station Null',
            action: 'Deploy Spy',
            rpCost: 3,
            target: 'Velgarien',
            note: msg('Counter-intel first. Resolves cycle 8. Balance: 30\u22123 = 27 RP'),
          },
        ],
      },
      {
        cycle: 6,
        phase: 'competition',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Velgarien',
            action: 'Counter-Intel Sweep',
            rpCost: 3,
            note: msg('Suspects incoming propaganda. Balance: 25+10\u22123 = 30 (cap)'),
          },
          {
            simulation: 'Gaslit Reach',
            action: msg('Save RP'),
            rpCost: 0,
            note: msg('Waiting for ops to resolve. Balance: 26+10 = 30 (cap)'),
          },
          {
            simulation: 'Station Null',
            action: 'Deploy Saboteur',
            rpCost: 5,
            target: 'Gaslit Reach',
            note: msg('Target: The Drowned Bell. Balance: 27+10\u22125 = 30 (cap RP)'),
          },
        ],
      },
      {
        cycle: 7,
        phase: 'competition',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Velgarien',
            action: msg('Spy resolves: SUCCESS'),
            rpCost: 0,
            outcome: 'success',
            note: msg('Gaslit Reach weak zone revealed. +2 military. Balance: 30 (cap RP)'),
          },
          {
            simulation: 'Velgarien',
            action: msg('Saboteur resolves: SUCCESS'),
            rpCost: 0,
            outcome: 'success',
            note: msg(
              'Reactor Core: good \u2192 moderate. +5 military. Station Null stability hit.',
            ),
          },
          {
            simulation: 'Gaslit Reach',
            action: msg('Propagandist resolves: DETECTED'),
            rpCost: 0,
            outcome: 'detected',
            note: msg(
              'Caught by cycle 6 sweep! \u22123 military penalty. No propaganda event created.',
            ),
          },
        ],
      },
      {
        cycle: 8,
        phase: 'competition',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Velgarien',
            action: 'Deploy Assassin',
            rpCost: 8,
            target: 'Gaslit Reach',
            note: msg('Target: The Marchioness. 2 cycle deploy. Balance: 30\u22128 = 22 RP'),
          },
          {
            simulation: 'Gaslit Reach',
            action: 'Deploy Saboteur',
            rpCost: 5,
            target: 'Velgarien',
            note: msg('Target: Great Library. Retaliation. Balance: 30\u22125 = 25 RP'),
          },
          {
            simulation: 'Station Null',
            action: msg('Spy resolves: SUCCESS'),
            rpCost: 0,
            outcome: 'success',
            note: msg('Velgarien defense layout revealed. +2 military.'),
          },
        ],
      },
      {
        cycle: 9,
        phase: 'competition',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Velgarien',
            action: msg('Save RP'),
            rpCost: 0,
            note: msg('Assassin deploying. Balance: 22+10 = 30 (cap)'),
          },
          {
            simulation: 'Gaslit Reach',
            action: 'Deploy Infiltrator',
            rpCost: 6,
            target: msg('Velgarien embassy'),
            note: msg(
              '2 cycle deploy. Target embassy infrastructure. Balance: 25+10\u22126 = 29 RP',
            ),
          },
          {
            simulation: 'Station Null',
            action: 'Deploy Propagandist',
            rpCost: 4,
            target: 'Gaslit Reach',
            note: msg('Exploit Gaslit Reach while weakened. Balance: 30\u22124 = 26 RP'),
          },
        ],
      },
      {
        cycle: 10,
        phase: 'competition',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Velgarien',
            action: 'Deploy Saboteur',
            rpCost: 5,
            target: 'Gaslit Reach',
            note: msg('Target: Glimhaven Exchange (revealed by spy). Balance: 30\u22125 = 25 RP'),
          },
          {
            simulation: 'Gaslit Reach',
            action: 'Counter-Intel Sweep',
            rpCost: 3,
            note: msg('Defensive check. Balance: 29+10\u22123 = 30 (cap)'),
          },
          {
            simulation: 'Station Null',
            action: msg('Saboteur resolves: SUCCESS'),
            rpCost: 0,
            outcome: 'success',
            note: msg(
              'Drowned Bell: good \u2192 moderate. +5 military. Gaslit Reach stability drops.',
            ),
          },
        ],
      },
      {
        cycle: 11,
        phase: 'competition',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Velgarien',
            action: msg('Assassin resolves: SUCCESS'),
            rpCost: 0,
            outcome: 'success',
            note: msg(
              'The Marchioness hit! All relationships \u22122. BLOCKED for 3 cycles. +8 military.',
            ),
          },
          {
            simulation: 'Gaslit Reach',
            action: msg('Saboteur resolves: FAILED'),
            rpCost: 0,
            outcome: 'failed',
            note: msg(
              'Great Library protected by guardians (3 in zone = 60% reduction). 5 RP wasted.',
            ),
          },
          {
            simulation: 'Station Null',
            action: msg('Save RP'),
            rpCost: 0,
            note: msg('Propagandist still in mission. Balance: 26+10 = 30 (cap)'),
          },
        ],
      },
      {
        cycle: 12,
        phase: 'competition',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Velgarien',
            action: msg('Saboteur resolves: SUCCESS'),
            rpCost: 0,
            outcome: 'success',
            note: msg(
              'Glimhaven Exchange: good \u2192 moderate. +5 military. Velgarien now leads military.',
            ),
          },
          {
            simulation: 'Gaslit Reach',
            action: msg('Infiltrator resolves: FAILED'),
            rpCost: 0,
            outcome: 'failed',
            note: msg(
              'Embassy infiltration fails \u2013 Velgarien guardians too strong. 6 RP wasted.',
            ),
          },
          {
            simulation: 'Station Null',
            action: msg('Propagandist resolves: SUCCESS'),
            rpCost: 0,
            outcome: 'success',
            note: msg(
              'Propaganda event (impact 4) created in Gaslit Reach. +3 military. Sovereignty hit.',
            ),
          },
        ],
      },
      // ── Reckoning: cycles 13-15 (10 RP/cycle, bleed amplified) ──
      {
        cycle: 13,
        phase: 'reckoning',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Velgarien',
            action: msg('Save RP'),
            rpCost: 0,
            note: msg(
              'Leading comfortably. Reckoning begins \u2013 bleed amplified. Balance: 25+10 = 30 (cap)',
            ),
          },
          {
            simulation: 'Gaslit Reach',
            action: 'Deploy Saboteur',
            rpCost: 5,
            target: 'Velgarien',
            note: msg('Desperate final strike. Target: Market Hall. Balance: 30\u22125 = 25 RP'),
          },
          {
            simulation: 'Station Null',
            action: 'Deploy Saboteur',
            rpCost: 5,
            target: 'Gaslit Reach',
            note: msg(
              'Pile on the weakest. Target: Drowned Bell (already moderate). Balance: 30\u22125 = 25 RP',
            ),
          },
        ],
      },
      {
        cycle: 14,
        phase: 'reckoning',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Velgarien',
            action: 'Counter-Intel Sweep',
            rpCost: 3,
            note: msg('Final defensive check. Balance: 30\u22123 = 27 RP'),
          },
          {
            simulation: 'Gaslit Reach',
            action: msg('Save RP'),
            rpCost: 0,
            note: msg('Nothing left to deploy. Balance: 25+10 = 30 (cap)'),
          },
          {
            simulation: 'Station Null',
            action: msg('Saboteur resolves: SUCCESS'),
            rpCost: 0,
            outcome: 'success',
            note: msg(
              'Drowned Bell: moderate \u2192 poor. +5 military. Gaslit Reach stability collapses.',
            ),
          },
        ],
      },
      {
        cycle: 15,
        phase: 'reckoning',
        rpAllocated: 10,
        actions: [
          {
            simulation: 'Gaslit Reach',
            action: msg('Saboteur resolves: DETECTED'),
            rpCost: 0,
            outcome: 'detected',
            note: msg('Caught by cycle 14 sweep! \u22123 military. Final humiliation.'),
          },
        ],
        scoreSnapshot: {
          Velgarien: 76.3,
          'Station Null': 68.9,
          'The Gaslit Reach': 44.2,
        },
      },
    ],
    finalStandings: [
      {
        rank: 1,
        simulation: 'Velgarien',
        composite: 76.3,
        stability: 88,
        influence: 15,
        sovereignty: 82,
        diplomatic: 42,
        military: 20,
        title: 'The Unshaken',
      },
      {
        rank: 2,
        simulation: 'Station Null',
        composite: 68.9,
        stability: 65,
        influence: 12,
        sovereignty: 78,
        diplomatic: 35,
        military: 15,
      },
      {
        rank: 3,
        simulation: 'The Gaslit Reach',
        composite: 44.2,
        stability: 48,
        influence: 5,
        sovereignty: 62,
        diplomatic: 28,
        military: -6,
      },
    ],
    keyMoments: [
      msg(
        "Cycle 6\u20137: Velgarien's counter-intel sweep catches the Gaslit Reach's propagandist \u2013 a 6-point swing (\u22123 for Gaslit Reach, +0 saved for Velgarien).",
      ),
      msg(
        "Cycle 8\u201311: Velgarien's assassin blocks The Marchioness for 3 cycles, crippling the Gaslit Reach's diplomatic score during mid-game.",
      ),
      msg(
        "Cycle 11: The Gaslit Reach's saboteur fails against 3 guardians in Velgarien's library zone \u2013 the Foundation Wall strategy pays off.",
      ),
      msg(
        'Cycle 10\u201312: Station Null plays kingmaker \u2013 Drowned Bell sabotage + propaganda push Gaslit Reach to last place.',
      ),
      msg(
        "Cycle 14\u201315: Station Null's second saboteur degrades the already-moderate Drowned Bell to poor, while the Gaslit Reach's desperate saboteur is detected. A brutal final act.",
      ),
      msg(
        'RP efficiency: Velgarien spent 36 RP on offense (spy+saboteur\u00D72+assassin) with 3 successes. Gaslit Reach spent 23 RP on offense (spy+propagandist+saboteur+infiltrator) with 0 successes. Economy wins wars.',
      ),
    ],
  };
}
