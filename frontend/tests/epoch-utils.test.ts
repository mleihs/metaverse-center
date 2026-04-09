/**
 * Unit tests for epoch utility functions — pure math, zero deps.
 */

import { describe, expect, it } from 'vitest';
import {
  computeTotalCycles,
  computePhaseCycles,
  DEFAULT_FOUNDATION_CYCLES,
  DEFAULT_RECKONING_CYCLES,
} from '../src/utils/epoch.js';

describe('computeTotalCycles', () => {
  it('computes total cycles from duration and cycle hours', () => {
    expect(computeTotalCycles({ duration_days: 14, cycle_hours: 8 })).toBe(42);
  });

  it('returns 0 for zero duration', () => {
    expect(computeTotalCycles({ duration_days: 0, cycle_hours: 8 })).toBe(0);
  });

  it('floors fractional cycles', () => {
    // 7 days * 24h = 168h / 10h = 16.8 → 16
    expect(computeTotalCycles({ duration_days: 7, cycle_hours: 10 })).toBe(16);
  });

  it('handles 1-day sprint', () => {
    expect(computeTotalCycles({ duration_days: 1, cycle_hours: 4 })).toBe(6);
  });

  it('handles very long epoch', () => {
    expect(computeTotalCycles({ duration_days: 30, cycle_hours: 8 })).toBe(90);
  });
});

describe('computePhaseCycles', () => {
  it('uses default foundation and reckoning when not specified', () => {
    const result = computePhaseCycles({ duration_days: 14, cycle_hours: 8 });
    // total = 42, foundation = 4 (default), reckoning = 8 (default)
    expect(result.foundation).toBe(DEFAULT_FOUNDATION_CYCLES);
    expect(result.reckoning).toBe(DEFAULT_RECKONING_CYCLES);
    expect(result.competition).toBe(42 - 4 - 8); // 30
  });

  it('uses absolute cycle counts when provided', () => {
    const result = computePhaseCycles({
      duration_days: 14,
      cycle_hours: 8,
      foundation_cycles: 6,
      reckoning_cycles: 10,
    });
    expect(result.foundation).toBe(6);
    expect(result.reckoning).toBe(10);
    expect(result.competition).toBe(42 - 6 - 10); // 26
  });

  it('uses legacy percentage config as fallback', () => {
    const result = computePhaseCycles({
      duration_days: 14,
      cycle_hours: 8,
      foundation_pct: 10,
      reckoning_pct: 20,
    });
    // total = 42, foundation = round(42 * 0.1) = 4, reckoning = round(42 * 0.2) = 8
    expect(result.foundation).toBe(4);
    expect(result.reckoning).toBe(8);
    expect(result.competition).toBe(30);
  });

  it('absolute cycles take precedence over percentage', () => {
    const result = computePhaseCycles({
      duration_days: 14,
      cycle_hours: 8,
      foundation_cycles: 3,
      foundation_pct: 50, // Would be 21 — should be ignored
      reckoning_cycles: 5,
      reckoning_pct: 50, // Would be 21 — should be ignored
    });
    expect(result.foundation).toBe(3);
    expect(result.reckoning).toBe(5);
    expect(result.competition).toBe(34);
  });

  it('returns all zeros when total cycles is 0', () => {
    const result = computePhaseCycles({ duration_days: 0, cycle_hours: 8 });
    expect(result).toEqual({ foundation: 0, competition: 0, reckoning: 0 });
  });

  it('competition never goes negative', () => {
    // foundation + reckoning > total
    const result = computePhaseCycles({
      duration_days: 1,
      cycle_hours: 24, // total = 1
      foundation_cycles: 5,
      reckoning_cycles: 5,
    });
    expect(result.competition).toBe(0);
  });
});
