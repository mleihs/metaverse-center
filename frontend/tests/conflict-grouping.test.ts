/**
 * Tests for the conflict-grouping helpers (D2).
 *
 * Covers the three pure functions in
 * `src/components/admin/content-drafts/conflict-grouping.ts`:
 *   entryRootPath(path) → extracts the grouping root
 *   entryGroupLabel(root) → human-readable header label
 *   conflictSubPath(root, fullPath) → the in-card address suffix
 *   groupByEntryRoot(conflicts) → stable-order grouping
 */

import { describe, expect, it } from 'vitest';
import {
  conflictSubPath,
  entryGroupLabel,
  entryRootPath,
  groupByEntryRoot,
} from '../src/components/admin/content-drafts/conflict-grouping.js';

describe('entryRootPath', () => {
  it('extracts id-list entry root from a nested field path', () => {
    expect(entryRootPath('.banter[id=sb_01].trigger.emotion')).toBe('.banter[id=sb_01]');
  });

  it('returns id-list entry path verbatim when already at root', () => {
    expect(entryRootPath('.banter[id=sb_01]')).toBe('.banter[id=sb_01]');
  });

  it('falls back to first top-level key for non-id-list nested path', () => {
    expect(entryRootPath('.metadata.tier')).toBe('.metadata');
  });

  it('returns top-level scalar path verbatim', () => {
    expect(entryRootPath('.name')).toBe('.name');
  });

  it('handles 3-level deep id-list nesting', () => {
    expect(entryRootPath('.banter[id=sb_01].cfg.ai.model')).toBe('.banter[id=sb_01]');
  });

  it('returns the path verbatim for degenerate empty input', () => {
    // Defensive: entryRootPath should not throw on unexpected inputs.
    expect(entryRootPath('')).toBe('');
    expect(entryRootPath('.')).toBe('.');
  });

  it('is anchored — a stray [id= buried in a value cannot hijack the root', () => {
    // A field path shouldn't ever contain this, but we guard against regex
    // drift anyway. The anchor `^` in the pattern is the load-bearing part.
    expect(entryRootPath('.note.text[id=x]')).toBe('.note');
  });
});

describe('entryGroupLabel', () => {
  it('renders id-list root as `pack / entry_id`', () => {
    expect(entryGroupLabel('.banter[id=sb_01]')).toBe('banter / sb_01');
  });

  it('strips the leading dot from top-level key', () => {
    expect(entryGroupLabel('.metadata')).toBe('metadata');
    expect(entryGroupLabel('.name')).toBe('name');
  });

  it('leaves non-dot-prefixed input unchanged', () => {
    expect(entryGroupLabel('raw')).toBe('raw');
  });
});

describe('conflictSubPath', () => {
  it('returns the nested suffix when full path extends the root', () => {
    expect(conflictSubPath('.banter[id=sb_01]', '.banter[id=sb_01].trigger.emotion')).toBe(
      '.trigger.emotion',
    );
  });

  it('returns the full path when full path equals the root', () => {
    // Whole-entry conflicts (e.g. MODIFY_DELETE) — no sub-path to trim.
    expect(conflictSubPath('.banter[id=sb_01]', '.banter[id=sb_01]')).toBe(
      '.banter[id=sb_01]',
    );
  });

  it('returns the full path verbatim on prefix mismatch', () => {
    // Grouping bug would cause this; fail safe by keeping the admin-visible
    // identifier intact rather than truncating to an empty string.
    expect(conflictSubPath('.metadata', '.banter[id=x]')).toBe('.banter[id=x]');
  });
});

describe('groupByEntryRoot', () => {
  it('buckets multiple field conflicts under the same entry root', () => {
    const conflicts = [
      { path: '.banter[id=sb_01].trigger.emotion' },
      { path: '.banter[id=sb_01].response.speaker' },
    ];
    const groups = groupByEntryRoot(conflicts);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.rootPath).toBe('.banter[id=sb_01]');
    expect(groups[0]?.label).toBe('banter / sb_01');
    expect(groups[0]?.items).toHaveLength(2);
  });

  it('preserves first-seen order across groups', () => {
    const conflicts = [
      { path: '.name' },
      { path: '.banter[id=sb_01].text_de' },
      { path: '.banter[id=sb_02].text_de' },
      { path: '.metadata.tier' },
    ];
    const groups = groupByEntryRoot(conflicts);
    expect(groups.map((g) => g.rootPath)).toEqual([
      '.name',
      '.banter[id=sb_01]',
      '.banter[id=sb_02]',
      '.metadata',
    ]);
  });

  it('preserves order of items within a group', () => {
    const conflicts = [
      { path: '.banter[id=sb_01].trigger.emotion', order: 1 },
      { path: '.banter[id=sb_01].response.speaker', order: 2 },
      { path: '.banter[id=sb_01].response.text_de', order: 3 },
    ];
    const groups = groupByEntryRoot(conflicts);
    expect(groups[0]?.items.map((x) => x.order)).toEqual([1, 2, 3]);
  });

  it('returns empty array on empty input', () => {
    expect(groupByEntryRoot([])).toEqual([]);
  });

  it('groups a whole-entry conflict with its field-level peers on the same entry', () => {
    // Edge: backend emits one MODIFY_DELETE at the entry root AND some
    // field-level rows under the same entry (unusual but semantically
    // possible if the admin's resolution path ever mixes granularities).
    // Grouping must put both under the same root.
    const conflicts = [
      { path: '.banter[id=sb_01]' },
      { path: '.banter[id=sb_01].trigger.emotion' },
    ];
    const groups = groupByEntryRoot(conflicts);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.items).toHaveLength(2);
  });
});
