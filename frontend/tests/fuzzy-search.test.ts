import { describe, expect, it } from 'vitest';
import {
  levenshtein,
  fuzzyMatch,
  fuzzyName,
  resolveToken,
  type NamedEntity,
} from '../src/utils/fuzzy-search.js';

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

  it('tier 2: prefix match before substring', () => {
    // "elena v" should prefix-match "Elena Voss", not also "Elena the Red"
    const result = fuzzyMatch('elena v', agents);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('tier 3: word-start match for distinctive tokens', () => {
    // "novak" matches word "Novak" in "Aria Novak"
    const result = fuzzyMatch('novak', agents);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });
});

// ── fuzzyName ───────────────────────────────────────────────────────────────

describe('fuzzyName', () => {
  const abilityNames = ['precision strike', 'shadow step', 'deep scan', 'overwatch'];

  it('returns exact match', () => {
    expect(fuzzyName('precision strike', abilityNames)).toBe('precision strike');
  });

  it('returns prefix match', () => {
    expect(fuzzyName('prec', abilityNames)).toBe('precision strike');
  });

  it('returns null for no match', () => {
    expect(fuzzyName('xyzzy', abilityNames)).toBeNull();
  });

  it('matches case-insensitively', () => {
    expect(fuzzyName('OVERWATCH', abilityNames)).toBe('overwatch');
  });

  it('returns null for empty query', () => {
    expect(fuzzyName('', abilityNames)).toBeNull();
  });

  it('returns null for empty candidates', () => {
    expect(fuzzyName('shadow', [])).toBeNull();
  });

  it('word-start match on distinctive token', () => {
    expect(fuzzyName('step', abilityNames)).toBe('shadow step');
  });
});

// ── resolveToken ────────────────────────────────────────────────────────────

describe('resolveToken', () => {
  const archetypes = [
    'The Shadow',
    'The Tower',
    'The Awakening',
    'The Devouring Mother',
    'The Prometheus',
  ];

  const abilities = ['precision strike', 'deep scan', 'overwatch'];

  it('matches single-word token', () => {
    const result = resolveToken(['shadow'], archetypes);
    expect(result.match).toBe('The Shadow');
    expect(result.rest).toEqual([]);
  });

  it('matches multi-word token (longest prefix first)', () => {
    const result = resolveToken(['the', 'awakening'], archetypes);
    expect(result.match).toBe('The Awakening');
    expect(result.rest).toEqual([]);
  });

  it('returns rest after multi-word match', () => {
    const result = resolveToken(['the', 'shadow', 'extra', 'args'], archetypes);
    expect(result.match).toBe('The Shadow');
    expect(result.rest).toEqual(['extra', 'args']);
  });

  it('respects maxWords constraint', () => {
    // With maxWords=1, only try single-word prefix
    const result = resolveToken(['tower', 'extra'], archetypes, 1);
    expect(result.match).toBe('The Tower');
    expect(result.rest).toEqual(['extra']);
  });

  it('returns null match and full args on no match', () => {
    const result = resolveToken(['xyzzy', 'plugh'], archetypes);
    expect(result.match).toBeNull();
    expect(result.rest).toEqual(['xyzzy', 'plugh']);
  });

  it('handles empty args', () => {
    const result = resolveToken([], archetypes);
    expect(result.match).toBeNull();
    expect(result.rest).toEqual([]);
  });

  it('matches multi-word ability names', () => {
    const result = resolveToken(['precision', 'strike'], abilities);
    expect(result.match).toBe('precision strike');
    expect(result.rest).toEqual([]);
  });

  it('returns rest when trailing args follow multi-word match', () => {
    const result = resolveToken(['deep', 'scan', 'enemy_1'], abilities);
    expect(result.match).toBe('deep scan');
    expect(result.rest).toEqual(['enemy_1']);
  });

  it('falls back to shorter prefix when long prefix fails', () => {
    // Try "shadow nonsense" (no match), then "shadow" (matches The Shadow)
    const result = resolveToken(['shadow', 'nonsense'], archetypes);
    expect(result.match).toBe('The Shadow');
    expect(result.rest).toEqual(['nonsense']);
  });

  it('handles single arg that matches no candidate', () => {
    const result = resolveToken(['zzz'], archetypes);
    expect(result.match).toBeNull();
    expect(result.rest).toEqual(['zzz']);
  });

  it('matches 3+ word names like "The Devouring Mother"', () => {
    const result = resolveToken(['the', 'devouring', 'mother'], archetypes);
    expect(result.match).toBe('The Devouring Mother');
    expect(result.rest).toEqual([]);
  });

  it('matches partial "devouring" to The Devouring Mother', () => {
    const result = resolveToken(['devouring'], archetypes);
    expect(result.match).toBe('The Devouring Mother');
    expect(result.rest).toEqual([]);
  });

  it('maxWords=0 returns null immediately', () => {
    const result = resolveToken(['shadow'], archetypes, 0);
    expect(result.match).toBeNull();
    expect(result.rest).toEqual(['shadow']);
  });
});
