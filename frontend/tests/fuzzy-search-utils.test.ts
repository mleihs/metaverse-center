/**
 * Unit tests for fuzzy-search.ts — Levenshtein distance + entity matching.
 */

import { describe, expect, it } from 'vitest';
import { levenshtein, fuzzyMatch, type NamedEntity } from '../src/utils/fuzzy-search.js';

// ===========================================================================
// Levenshtein Distance
// ===========================================================================

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('hello', 'hello')).toBe(0);
  });

  it('returns length for empty vs non-empty', () => {
    expect(levenshtein('', 'hello')).toBe(5);
    expect(levenshtein('abc', '')).toBe(3);
  });

  it('returns 0 for two empty strings', () => {
    expect(levenshtein('', '')).toBe(0);
  });

  it('counts single substitution', () => {
    expect(levenshtein('cat', 'car')).toBe(1);
  });

  it('counts single insertion', () => {
    expect(levenshtein('cat', 'cats')).toBe(1);
  });

  it('counts single deletion', () => {
    expect(levenshtein('cats', 'cat')).toBe(1);
  });

  it('handles complete difference', () => {
    expect(levenshtein('abc', 'xyz')).toBe(3);
  });

  it('is symmetric', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(levenshtein('sitting', 'kitten'));
  });

  it('classic kitten-sitting = 3', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
});

// ===========================================================================
// Fuzzy Match
// ===========================================================================

describe('fuzzyMatch', () => {
  const entities: NamedEntity[] = [
    { id: '1', name: 'Commander Voss' },
    { id: '2', name: 'Agent Reeves' },
    { id: '3', name: 'Minister Blake' },
    { id: '4', name: 'Dr. Blackwood' },
  ];

  it('returns empty for empty query', () => {
    expect(fuzzyMatch('', entities)).toEqual([]);
  });

  it('finds exact case-insensitive match', () => {
    const result = fuzzyMatch('agent reeves', entities);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('finds substring match', () => {
    const result = fuzzyMatch('voss', entities);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('falls back to levenshtein for typos', () => {
    // "blak" is distance 1 from "blake"
    const result = fuzzyMatch('blak', entities);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((e) => e.id === '3')).toBe(true);
  });

  it('returns multiple matches on substring', () => {
    // "black" matches both "Blake" (substring: no) and "Blackwood" (substring: yes)
    const result = fuzzyMatch('black', entities);
    expect(result.some((e) => e.id === '4')).toBe(true);
  });

  it('prefers exact match over substring', () => {
    const withExact: NamedEntity[] = [
      { id: '1', name: 'Scan' },
      { id: '2', name: 'Scanner' },
    ];
    const result = fuzzyMatch('scan', withExact);
    // Exact match found: returns only the exact match
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('respects maxDistance parameter', () => {
    // "xyz" is far from any entity name word
    const result = fuzzyMatch('xyz', entities, 1);
    expect(result).toHaveLength(0);
  });

  it('trims whitespace from query', () => {
    const result = fuzzyMatch('  voss  ', entities);
    expect(result).toHaveLength(1);
  });
});
