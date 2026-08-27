/**
 * Unit tests for the dungeon environment resolver — pure, ground-truthed
 * against backend/services/dungeon/archetype_strategies.py for meter direction.
 */

import { describe, expect, it } from 'vitest';

import { resolveDungeonEnvironment } from '../src/utils/dungeon-environment.js';
import {
  ARCHETYPE_AWAKENING,
  ARCHETYPE_DELUGE,
  ARCHETYPE_ENTROPY,
  ARCHETYPE_MOTHER,
  ARCHETYPE_OVERTHROW,
  ARCHETYPE_PROMETHEUS,
  ARCHETYPE_SHADOW,
  ARCHETYPE_TOWER,
} from '../src/types/dungeon.js';

describe('resolveDungeonEnvironment — higher-is-worse archetypes', () => {
  it('Deluge: water_level maps directly to pressure (0)', () => {
    const env = resolveDungeonEnvironment(ARCHETYPE_DELUGE, {
      water_level: 0,
      max_water_level: 100,
      rooms_entered: 0,
      recession_cycle: 0,
    });
    expect(env.fxProfile).toBe('water');
    expect(env.direction).toBe('higher-worse');
    expect(env.pressure01).toBe(0);
    expect(env.tier).toBe('calm');
  });

  it('Deluge: full water = max pressure (1)', () => {
    const env = resolveDungeonEnvironment(ARCHETYPE_DELUGE, {
      water_level: 100,
      max_water_level: 100,
      rooms_entered: 5,
      recession_cycle: 1,
    });
    expect(env.pressure01).toBe(1);
    expect(env.tier).toBe('critical');
  });

  it('Entropy: decay maps directly to pressure (mid)', () => {
    const env = resolveDungeonEnvironment(ARCHETYPE_ENTROPY, {
      decay: 50,
      max_decay: 100,
    });
    expect(env.fxProfile).toBe('decay');
    expect(env.pressure01).toBeCloseTo(0.5);
    expect(env.tier).toBe('rising');
  });

  it('Mother: attachment is higher-worse (100 = incorporation = wipe), NOT inverted', () => {
    const env = resolveDungeonEnvironment(ARCHETYPE_MOTHER, {
      attachment: 100,
      max_attachment: 100,
    });
    expect(env.fxProfile).toBe('pulse');
    expect(env.direction).toBe('higher-worse');
    expect(env.pressure01).toBe(1);
    expect(env.tier).toBe('critical');
  });

  it('Mother: zero attachment = calm', () => {
    const env = resolveDungeonEnvironment(ARCHETYPE_MOTHER, {
      attachment: 0,
      max_attachment: 100,
    });
    expect(env.pressure01).toBe(0);
    expect(env.tier).toBe('calm');
  });

  it('Prometheus: insight maps directly (forge heat)', () => {
    const env = resolveDungeonEnvironment(ARCHETYPE_PROMETHEUS, {
      insight: 80,
      max_insight: 100,
      components: [],
      crafted_items: [],
      total_crafted: 0,
      failed_crafts: 0,
    });
    expect(env.fxProfile).toBe('forge');
    expect(env.direction).toBe('higher-worse');
    expect(env.pressure01).toBeCloseTo(0.8);
    expect(env.tier).toBe('critical');
  });

  it('Overthrow: fracture maps directly (100 = power vacuum = wipe)', () => {
    const env = resolveDungeonEnvironment(ARCHETYPE_OVERTHROW, {
      fracture: 100,
      max_fracture: 100,
      faction_standings: {},
      rooms_entered: 3,
    });
    expect(env.fxProfile).toBe('shards');
    expect(env.pressure01).toBe(1);
  });

  it('Awakening: awareness maps directly', () => {
    const env = resolveDungeonEnvironment(ARCHETYPE_AWAKENING, {
      awareness: 30,
      max_awareness: 100,
      rooms_entered: 2,
    });
    expect(env.fxProfile).toBe('flicker');
    expect(env.direction).toBe('higher-worse');
    expect(env.pressure01).toBeCloseTo(0.3);
    expect(env.tier).toBe('calm');
  });
});

describe('resolveDungeonEnvironment — inverted archetypes (higher-is-safer)', () => {
  it('Shadow: full visibility = safe (pressure 0)', () => {
    const env = resolveDungeonEnvironment(ARCHETYPE_SHADOW, {
      visibility: 3,
      max_visibility: 3,
      rooms_since_vp_loss: 0,
    });
    expect(env.fxProfile).toBe('darkness');
    expect(env.direction).toBe('higher-better');
    expect(env.pressure01).toBe(0);
    expect(env.tier).toBe('calm');
  });

  it('Shadow: zero visibility = consumed (pressure 1)', () => {
    const env = resolveDungeonEnvironment(ARCHETYPE_SHADOW, {
      visibility: 0,
      max_visibility: 3,
      rooms_since_vp_loss: 4,
    });
    expect(env.pressure01).toBe(1);
    expect(env.tier).toBe('critical');
  });

  it('Shadow: 1 of 3 visibility = high pressure (2/3)', () => {
    const env = resolveDungeonEnvironment(ARCHETYPE_SHADOW, {
      visibility: 1,
      max_visibility: 3,
      rooms_since_vp_loss: 2,
    });
    expect(env.pressure01).toBeCloseTo(2 / 3);
    expect(env.tier).toBe('rising');
  });

  it('Tower: full stability = safe (pressure 0)', () => {
    const env = resolveDungeonEnvironment(ARCHETYPE_TOWER, {
      stability: 100,
      max_stability: 100,
    });
    expect(env.fxProfile).toBe('tilt');
    expect(env.direction).toBe('higher-better');
    expect(env.pressure01).toBe(0);
    expect(env.tier).toBe('calm');
  });

  it('Tower: collapse imminent (stability 0) = pressure 1', () => {
    const env = resolveDungeonEnvironment(ARCHETYPE_TOWER, {
      stability: 0,
      max_stability: 100,
    });
    expect(env.pressure01).toBe(1);
    expect(env.tier).toBe('critical');
  });

  it('Tower: critical stability (20/100) = pressure 0.8', () => {
    const env = resolveDungeonEnvironment(ARCHETYPE_TOWER, {
      stability: 20,
      max_stability: 100,
    });
    expect(env.pressure01).toBeCloseTo(0.8);
    expect(env.tier).toBe('critical');
  });
});

describe('resolveDungeonEnvironment — defensive edges', () => {
  it('unknown archetype → neutral calm', () => {
    const env = resolveDungeonEnvironment('Not An Archetype', {});
    expect(env.fxProfile).toBe('neutral');
    expect(env.pressure01).toBe(0);
    expect(env.tier).toBe('calm');
  });

  it('empty archetype string → neutral', () => {
    const env = resolveDungeonEnvironment('', {});
    expect(env.fxProfile).toBe('neutral');
    expect(env.archetype).toBe('');
  });

  it('mismatched state shape → neutral (no crash)', () => {
    // Deluge name but Shadow-shaped state.
    const env = resolveDungeonEnvironment(ARCHETYPE_DELUGE, {
      visibility: 3,
      max_visibility: 3,
      rooms_since_vp_loss: 0,
    });
    expect(env.fxProfile).toBe('neutral');
  });

  it('zero max → pressure 0 (no division by zero)', () => {
    const env = resolveDungeonEnvironment(ARCHETYPE_DELUGE, {
      water_level: 50,
      max_water_level: 0,
      rooms_entered: 0,
      recession_cycle: 0,
    });
    expect(env.pressure01).toBe(0);
    expect(Number.isNaN(env.pressure01)).toBe(false);
  });

  it('value exceeding max clamps to pressure 1', () => {
    const env = resolveDungeonEnvironment(ARCHETYPE_ENTROPY, {
      decay: 150,
      max_decay: 100,
    });
    expect(env.pressure01).toBe(1);
  });
});
