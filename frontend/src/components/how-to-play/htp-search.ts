/**
 * How-to-Play — Fuzzy Search System for the Guide Hub.
 *
 * Builds a searchable index from all 12 topic definitions.
 * Reuses Levenshtein + fuzzyMatch from shared utils/fuzzy-search.ts.
 *
 * Features:
 * - Pre-built index from title + description + TL;DR bullets + section titles
 * - Multi-strategy matching: exact → substring → Levenshtein
 * - Result scoring with match-type priority
 * - Highlight matched substring in results
 */

import { levenshtein } from '../../utils/fuzzy-search.js';
import { TOPICS, type TopicDefinition } from './htp-topic-data.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SearchEntry {
  /** Topic slug */
  slug: string;
  /** Source field (for match context display) */
  field: 'title' | 'description' | 'tldr' | 'section';
  /** Searchable text (lowercased) */
  text: string;
  /** Original text (for display) */
  original: string;
  /** Reference to the topic definition */
  topic: TopicDefinition;
}

export interface SearchResult {
  topic: TopicDefinition;
  /** Best matching text snippet */
  matchText: string;
  /** Match type for scoring (lower = better) */
  matchType: 'exact' | 'substring' | 'levenshtein';
  /** Score for sorting (lower = better) */
  score: number;
}

// ── Index Building ───────────────────────────────────────────────────────────

let _cachedIndex: SearchEntry[] | null = null;

/** Build (or return cached) search index from all topics. */
export function getSearchIndex(): SearchEntry[] {
  if (_cachedIndex) return _cachedIndex;

  const entries: SearchEntry[] = [];

  for (const topic of TOPICS) {
    // Title
    entries.push({
      slug: topic.slug,
      field: 'title',
      text: topic.title.toLowerCase(),
      original: topic.title,
      topic,
    });

    // Description
    entries.push({
      slug: topic.slug,
      field: 'description',
      text: topic.description.toLowerCase(),
      original: topic.description,
      topic,
    });

    // TL;DR bullets
    for (const bullet of topic.tldr()) {
      entries.push({
        slug: topic.slug,
        field: 'tldr',
        text: bullet.toLowerCase(),
        original: bullet,
        topic,
      });
    }

    // Section titles (from sections that have titles)
    for (const section of topic.sections()) {
      if ('title' in section && section.title) {
        entries.push({
          slug: topic.slug,
          field: 'section',
          text: section.title.toLowerCase(),
          original: section.title,
          topic,
        });
      }
    }
  }

  _cachedIndex = entries;
  return entries;
}

/** Invalidate cached index (call after locale change). */
export function clearSearchIndex(): void {
  _cachedIndex = null;
}

// ── Search ───────────────────────────────────────────────────────────────────

/** Score multiplier by match type (lower = better). */
const MATCH_SCORES = { exact: 0, substring: 1, levenshtein: 2 } as const;

/** Field priority (lower = better). */
const FIELD_PRIORITY = { title: 0, section: 1, description: 2, tldr: 3 } as const;

/**
 * Search all topics for a query string.
 * Returns deduplicated results sorted by relevance (best first).
 */
export function searchTopics(query: string, maxResults = 8): SearchResult[] {
  const q = query.toLowerCase().trim();
  if (!q || q.length < 2) return [];

  const index = getSearchIndex();
  const resultMap = new Map<string, SearchResult>();

  for (const entry of index) {
    let matchType: SearchResult['matchType'] | null = null;

    // Exact match on whole text
    if (entry.text === q) {
      matchType = 'exact';
    }
    // Substring match
    else if (entry.text.includes(q)) {
      matchType = 'substring';
    }
    // Levenshtein on individual words (for typo tolerance)
    else if (q.length >= 3) {
      const words = entry.text.split(/\s+/);
      const hasClose = words.some((w) => levenshtein(q, w) <= 2);
      if (hasClose) matchType = 'levenshtein';
    }

    if (matchType) {
      const score = MATCH_SCORES[matchType] * 10 + FIELD_PRIORITY[entry.field];
      const existing = resultMap.get(entry.slug);

      // Keep best match per topic
      if (!existing || score < existing.score) {
        resultMap.set(entry.slug, {
          topic: entry.topic,
          matchText: entry.original,
          matchType,
          score,
        });
      }
    }
  }

  return Array.from(resultMap.values())
    .sort((a, b) => a.score - b.score)
    .slice(0, maxResults);
}

// ── Highlight Utility ────────────────────────────────────────────────────────

/**
 * Highlight the first occurrence of `query` in `text`.
 * Returns an array of [before, match, after] strings.
 * If no match, returns [text, '', ''].
 */
export function highlightMatch(text: string, query: string): [string, string, string] {
  if (!query) return [text, '', ''];
  const lower = text.toLowerCase();
  const q = query.toLowerCase().trim();
  const idx = lower.indexOf(q);
  if (idx === -1) return [text, '', ''];
  return [text.slice(0, idx), text.slice(idx, idx + q.length), text.slice(idx + q.length)];
}

// ── Debounce Utility ─────────────────────────────────────────────────────────

/**
 * Returns a debounced version of the callback.
 * @param fn Callback to debounce
 * @param ms Delay in milliseconds (default 150ms)
 */
/** Debounced function with cancel() for lifecycle cleanup. */
export interface DebouncedFn<T extends (...args: never[]) => void> {
  (...args: Parameters<T>): void;
  cancel(): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => void>(fn: T, ms = 150): DebouncedFn<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const debounced = ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as DebouncedFn<T>;
  debounced.cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  return debounced;
}
