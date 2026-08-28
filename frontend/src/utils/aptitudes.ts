/**
 * Aptitude rows → per-agent lookup. One fold, one place.
 *
 * `GET /simulations/{id}/aptitudes` returns *effective* aptitudes: six rows per
 * agent, either assigned (`is_default: false`) or the server's budget-neutral
 * baseline (`is_default: true`). Five call sites used to fold that list into a
 * Map by hand, and three of them seeded the accumulator with a literal `6` —
 * a client-side copy of a number the server owns. When a simulation had no
 * assigned aptitudes at all, that copy painted plausible scores over an empty
 * data set: the dungeon picker showed "SPY 6" on every card while the party
 * warning, reading the same empty map without a fallback, correctly reported
 * that nobody had SPY 4+.
 *
 * The rule this module establishes: **the client never invents an aptitude
 * value.** It reports what the server sent, and says so when the server sent a
 * baseline. Enforced by frontend/scripts/lint-no-aptitude-baseline.sh.
 */

import { captureError } from '../services/SentryService.js';
import type { AgentAptitude, AptitudeSet, OperativeType } from '../types/index.js';
import { OPERATIVE_TYPES } from './operative-constants.js';

/** Folded aptitude lookup for one simulation. */
export interface AptitudeIndex {
  /** agentId → the six effective levels, exactly as the server reported them. */
  readonly levels: ReadonlyMap<string, AptitudeSet>;
  /**
   * Agents whose every level came from the server baseline — no aptitudes were
   * ever assigned. Surfaces to the user; never silently equated with real data.
   */
  readonly baselineAgentIds: ReadonlySet<string>;
}

const EMPTY_INDEX: AptitudeIndex = { levels: new Map(), baselineAgentIds: new Set() };

/**
 * Complete a per-agent partial into a full AptitudeSet.
 *
 * The single cast in this module, and it is guarded: an agent whose rows do not
 * cover all six operative types is reported and dropped rather than completed
 * with a made-up value. Dropping it leaves the agent "unknown" downstream,
 * which is the truth.
 */
function toAptitudeSet(
  partial: Partial<Record<OperativeType, number>>,
  agentId: string,
): AptitudeSet | null {
  const missing = OPERATIVE_TYPES.filter((type) => partial[type] === undefined);
  if (missing.length > 0) {
    captureError(
      new Error(`Aptitude rows incomplete for agent ${agentId}: missing ${missing.join(', ')}`),
      { source: 'aptitudes.toAptitudeSet' },
    );
    return null;
  }
  return partial as AptitudeSet;
}

/** Fold effective aptitude rows into a per-agent lookup. */
export function buildAptitudeIndex(rows: AgentAptitude[] | null | undefined): AptitudeIndex {
  if (!rows || rows.length === 0) return EMPTY_INDEX;

  const partials = new Map<string, Partial<Record<OperativeType, number>>>();
  const assigned = new Set<string>();

  for (const row of rows) {
    let entry = partials.get(row.agent_id);
    if (!entry) {
      entry = {};
      partials.set(row.agent_id, entry);
    }
    entry[row.operative_type] = row.aptitude_level;
    if (!row.is_default) assigned.add(row.agent_id);
  }

  const levels = new Map<string, AptitudeSet>();
  const baselineAgentIds = new Set<string>();
  for (const [agentId, partial] of partials) {
    const set = toAptitudeSet(partial, agentId);
    if (!set) continue;
    levels.set(agentId, set);
    if (!assigned.has(agentId)) baselineAgentIds.add(agentId);
  }

  return { levels, baselineAgentIds };
}
