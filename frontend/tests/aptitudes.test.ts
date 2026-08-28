/**
 * buildAptitudeIndex — the single fold from aptitude rows to a per-agent lookup.
 *
 * The regression these tests pin down (remediation plan B-2): five call sites
 * folded the same API list by hand and three seeded the accumulator with a
 * literal `6`. In a simulation with no assigned aptitudes that produced
 * "SPY 6 · GRD 6 · SAB 6" on every dungeon picker card while the composition
 * warning, reading the same empty data without a fallback, said no agent had
 * SPY 4+. Baseline values are the server's to send and must arrive labelled.
 */

import { describe, expect, it, vi } from 'vitest';

import type { AgentAptitude, OperativeType } from '../src/types/index.js';
import { buildAptitudeIndex } from '../src/utils/aptitudes.js';

vi.mock('../src/services/SentryService.js', () => ({
  captureError: vi.fn(),
}));

const ALL: OperativeType[] = [
  'spy',
  'guardian',
  'saboteur',
  'propagandist',
  'infiltrator',
  'assassin',
];

function rows(
  agentId: string,
  levels: Partial<Record<OperativeType, number>>,
  isDefault = false,
): AgentAptitude[] {
  return Object.entries(levels).map(([type, level]) => ({
    id: isDefault ? null : `row-${agentId}-${type}`,
    agent_id: agentId,
    simulation_id: 'sim-1',
    operative_type: type as OperativeType,
    aptitude_level: level as number,
    is_default: isDefault,
    created_at: isDefault ? null : '2026-01-01T00:00:00Z',
    updated_at: isDefault ? null : '2026-01-01T00:00:00Z',
  }));
}

function flat(level: number): Partial<Record<OperativeType, number>> {
  return Object.fromEntries(ALL.map((t) => [t, level]));
}

describe('buildAptitudeIndex', () => {
  it('returns an empty index for null, undefined and []', () => {
    for (const input of [null, undefined, []]) {
      const index = buildAptitudeIndex(input);
      expect(index.levels.size).toBe(0);
      expect(index.baselineAgentIds.size).toBe(0);
    }
  });

  it('keeps assigned levels and does not mark them baseline', () => {
    const index = buildAptitudeIndex(
      rows('a', { spy: 9, guardian: 3, saboteur: 6, propagandist: 6, infiltrator: 6, assassin: 6 }),
    );
    expect(index.levels.get('a')).toEqual({
      spy: 9,
      guardian: 3,
      saboteur: 6,
      propagandist: 6,
      infiltrator: 6,
      assassin: 6,
    });
    expect(index.baselineAgentIds.has('a')).toBe(false);
  });

  it('marks an agent whose every row is a server baseline', () => {
    const index = buildAptitudeIndex(rows('a', flat(6), true));
    expect(index.levels.get('a')?.spy).toBe(6);
    expect(index.baselineAgentIds.has('a')).toBe(true);
  });

  it('does not mark a partially assigned agent as baseline', () => {
    const index = buildAptitudeIndex([
      ...rows('a', { spy: 9 }),
      ...rows('a', { guardian: 6, saboteur: 6, propagandist: 6, infiltrator: 6, assassin: 6 }, true),
    ]);
    expect(index.levels.get('a')?.spy).toBe(9);
    expect(index.baselineAgentIds.has('a')).toBe(false);
  });

  it('separates agents', () => {
    const index = buildAptitudeIndex([...rows('a', flat(6), true), ...rows('b', flat(6))]);
    expect(index.baselineAgentIds.has('a')).toBe(true);
    expect(index.baselineAgentIds.has('b')).toBe(false);
    expect(index.levels.size).toBe(2);
  });

  it('drops an agent with incomplete rows instead of completing it', async () => {
    const { captureError } = await import('../src/services/SentryService.js');
    const index = buildAptitudeIndex(rows('a', { spy: 9, guardian: 3 }));
    // "Unknown" is the truth here; a filled-in value would be an invention.
    expect(index.levels.has('a')).toBe(false);
    expect(captureError).toHaveBeenCalled();
  });

  it('never invents a level the server did not send', () => {
    const index = buildAptitudeIndex(rows('a', flat(4), true));
    expect(Object.values(index.levels.get('a') ?? {})).toEqual([4, 4, 4, 4, 4, 4]);
  });
});
