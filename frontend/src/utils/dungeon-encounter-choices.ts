/**
 * Resonance Dungeons — what a player needs to know before picking an option.
 *
 * This module answers ONE question, for every surface: given the encounter's
 * choices and the party standing in the room, what does each option demand, who
 * would step forward for it, and can they? The answer is a plain data
 * structure; rendering is somebody else's job.
 *
 * It exists because that question used to be answered inside
 * `formatEncounterChoices`, which produces terminal lines. A terminal player
 * saw the requirement and the volunteer:
 *
 *     [2] Slip past the cordon
 *         Requires: Infiltrator 3
 *         Vera Sandoval volunteers (infiltrator 8)
 *
 * A graphical player saw "[2] Slip past the cordon" and nothing else — no
 * requirement, no volunteer, no indication that one option was hopeless and
 * another safe. The same choice, made blind. Deciding information that reaches
 * one of two surfaces is the expensive kind of bug in this codebase, so the
 * derivation lives here and nowhere else.
 *
 * Unmet options are described, never hidden: Disco Elysium's convention is that
 * a locked check stays visible and states its lock, because knowing what you
 * cannot do is part of knowing where you are.
 *
 * Pure: no DOM, no state-manager import, no API call. Directly unit-testable —
 * see tests/dungeon-encounter-choices.test.ts.
 *
 * Pattern: utils/dungeon-room-text.ts (pure derivation shared by both views).
 */

import type { AgentCombatStateClient, EncounterChoiceClient } from '../types/dungeon.js';
import { localized } from './locale-fields.js';

/** One aptitude the option demands, and whether the party can meet it. */
export interface ChoiceRequirement {
  /** Aptitude key as the server names it, e.g. "infiltrator". */
  readonly aptitude: string;
  /** Capitalised for display, e.g. "Infiltrator". Terminal and HUD agree. */
  readonly label: string;
  readonly level: number;
  /** The party's best available level in this aptitude. */
  readonly best: number;
  readonly met: boolean;
}

/** The operative who would attempt this option's check. */
export interface ChoiceVolunteer {
  readonly agentId: string;
  readonly name: string;
  readonly portraitUrl: string | null;
  /** The aptitude being tested. */
  readonly aptitude: string;
  /** That agent's level in it. */
  readonly level: number;
}

/** Everything a surface needs to present one option. */
export interface ChoiceDescriptor {
  readonly id: string;
  /** 1-based, matching the `interact <n>` the player types or clicks. */
  readonly index: number;
  readonly label: string;
  /** The option's own prose, when the template carries any. */
  readonly description: string | null;
  readonly requirements: ChoiceRequirement[];
  /** Null when the option is resolved without a check. */
  readonly volunteer: ChoiceVolunteer | null;
  /** The check's difficulty, or null when there is no check. */
  readonly difficulty: number | null;
  /** False when a requirement is out of the party's reach. Still rendered. */
  readonly available: boolean;
}

/**
 * The party member best suited to an aptitude.
 *
 * Captured operatives are skipped: they are not in the room. Ties go to the
 * first in party order, which is the order the server sends — stable across
 * both surfaces, so terminal and HUD never name different volunteers.
 */
export function findBestAgent(
  party: AgentCombatStateClient[],
  aptitude: string,
): AgentCombatStateClient | null {
  let best: AgentCombatStateClient | null = null;
  let bestLevel = -1;
  for (const agent of party) {
    if (agent.condition === 'captured') continue;
    const level = agent.aptitudes[aptitude] ?? 0;
    if (level > bestLevel) {
      bestLevel = level;
      best = agent;
    }
  }
  return best;
}

/** Display form of an aptitude key. Kept here so both surfaces capitalise the
 *  same way — the terminal has done it inline since the first version. */
function aptitudeLabel(aptitude: string): string {
  return aptitude.charAt(0).toUpperCase() + aptitude.slice(1);
}

/** The party's best available level in one aptitude, ignoring the captured. */
function bestLevelIn(party: AgentCombatStateClient[], aptitude: string): number {
  return findBestAgent(party, aptitude)?.aptitudes[aptitude] ?? 0;
}

/** Describe every option in the encounter, in the order the server sent them. */
export function describeChoices(
  choices: EncounterChoiceClient[],
  party: AgentCombatStateClient[],
): ChoiceDescriptor[] {
  return choices.map((choice, i) => {
    const requirements: ChoiceRequirement[] = Object.entries(choice.requires_aptitude ?? {}).map(
      ([aptitude, level]) => {
        const best = bestLevelIn(party, aptitude);
        return { aptitude, label: aptitudeLabel(aptitude), level, best, met: best >= level };
      },
    );

    let volunteer: ChoiceVolunteer | null = null;
    if (choice.check_aptitude) {
      const agent = findBestAgent(party, choice.check_aptitude);
      if (agent) {
        volunteer = {
          agentId: agent.agent_id,
          name: agent.agent_name,
          portraitUrl: agent.portrait_url,
          aptitude: choice.check_aptitude,
          level: agent.aptitudes[choice.check_aptitude] ?? 0,
        };
      }
    }

    return {
      id: choice.id,
      index: i + 1,
      label: localized(choice, 'label'),
      description: localized(choice, 'description') || null,
      requirements,
      volunteer,
      difficulty: choice.check_aptitude ? choice.check_difficulty : null,
      available: requirements.every((r) => r.met),
    };
  });
}
