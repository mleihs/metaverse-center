import { describe, expect, it } from 'vitest';
import { levenshtein, fuzzyMatch, type NamedEntity } from '../src/utils/fuzzy-search.js';

// ── levenshtein ──────────────────────────────────────────────────────────────

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('kitten', 'kitten')).toBe(0);
  });

  it('returns correct distance for known pairs', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('flaw', 'lawn')).toBe(2);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });

  it('returns 0 for two empty strings', () => {
    expect(levenshtein('', '')).toBe(0);
  });

  it('is symmetric', () => {
    expect(levenshtein('abc', 'def')).toBe(levenshtein('def', 'abc'));
  });

  it('handles single-character edits', () => {
    expect(levenshtein('a', 'b')).toBe(1); // substitution
    expect(levenshtein('a', '')).toBe(1);  // deletion
    expect(levenshtein('', 'a')).toBe(1);  // insertion
  });
});

// ── fuzzyMatch ───────────────────────────────────────────────────────────────

const agents: NamedEntity[] = [
  { id: '1', name: 'Elena Voss' },
  { id: '2', name: 'Marcus Chen' },
  { id: '3', name: 'Aria Novak' },
  { id: '4', name: 'Elena the Red' },
];

describe('fuzzyMatch', () => {
  it('returns empty array for empty query', () => {
    expect(fuzzyMatch('', agents)).toEqual([]);
    expect(fuzzyMatch('  ', agents)).toEqual([]);
  });

  it('finds exact case-insensitive match', () => {
    const result = fuzzyMatch('elena voss', agents);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('finds substring matches when no exact match', () => {
    const result = fuzzyMatch('elena', agents);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id).sort()).toEqual(['1', '4']);
  });

  it('falls back to Levenshtein for typos', () => {
    const result = fuzzyMatch('elana', agents); // 1 edit from "elena"
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((r) => r.name.includes('Elena'))).toBe(true);
  });

  it('returns empty when nothing matches within maxDistance', () => {
    const result = fuzzyMatch('zzzzzzz', agents, 1);
    expect(result).toHaveLength(0);
  });

  it('respects custom maxDistance', () => {
    // "markus" is 1 edit from "marcus"
    expect(fuzzyMatch('markus', agents, 1).length).toBeGreaterThan(0);
    expect(fuzzyMatch('markus', agents, 0)).toHaveLength(0);
  });

  it('prioritizes exact over substring over levenshtein', () => {
    // Exact match should be returned when available
    const exactResult = fuzzyMatch('Marcus Chen', agents);
    expect(exactResult).toHaveLength(1);
    expect(exactResult[0].id).toBe('2');
  });
});
