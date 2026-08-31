/**
 * How-to-Play — Fuzzy Search System for the Guide Hub.
 *
 * Builds a searchable index from every topic definition.
 * Reuses Levenshtein + fuzzyMatch from shared utils/fuzzy-search.ts.
 *
 * WHAT IS INDEXED, AND WHY THAT CHANGED (H5)
 * ------------------------------------------
 * The index used to hold four things per topic: the title, the description,
 * the TL;DR bullets, and the TITLES of the sections. It held nothing from
 * inside the sections — and inside the sections is where the manual is. A
 * reader looking for "cooldown" or "heartbeat" found something only if the
 * word happened to appear in a heading. The search box promised, by merely
 * existing, that the manual was searchable.
 *
 * It now walks every section kind that carries text:
 *
 *   text      → the paragraph
 *   callouts  → each card's label and body
 *   readout   → each row's label and value
 *   steps     → each step's title, narration, detail, tip, warning and readout
 *               rows (previously only the section heading above them)
 *
 * `custom` sections render a TemplateResult and have no text to read without
 * rendering; they contribute only their optional title. That is a real gap and
 * `frontend/tests/htp-search-index.test.ts` prints how many of them there are,
 * so the limit has a number rather than a silence.
 *
 * Features:
 * - Pre-built index over the full body text of every topic
 * - Multi-strategy matching: exact → substring → Levenshtein
 * - Result scoring with match-type priority, then field priority
 * - Highlight matched substring in results
 */

import { levenshtein } from '../../utils/fuzzy-search.js';
import { TOPICS, type TopicDefinition } from './htp-topic-data.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SearchEntry {
  /** Topic slug */
  slug: string;
  /** Source field (for match context display and ranking) */
  field: 'title' | 'description' | 'tldr' | 'section' | 'step' | 'callout' | 'readout' | 'body';
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

    const add = (field: SearchEntry['field'], text: string | undefined | null): void => {
      const trimmed = (text ?? '').trim();
      if (!trimmed) return;
      entries.push({
        slug: topic.slug,
        field,
        text: trimmed.toLowerCase(),
        original: trimmed,
        topic,
      });
    };

    for (const section of topic.sections()) {
      // Section titles (from sections that have one)
      if ('title' in section && section.title) add('section', section.title);

      switch (section.kind) {
        case 'text':
          add('body', section.content);
          break;

        case 'callouts':
          for (const item of section.items) {
            add('callout', item.label);
            add('callout', item.text);
          }
          break;

        case 'readout':
          for (const row of section.data()) {
            add('readout', row.label);
            add('readout', row.value);
          }
          break;

        case 'steps':
          for (const step of section.steps()) {
            add('step', step.title);
            add('step', step.narration);
            add('step', step.detail);
            add('step', step.tip);
            add('step', step.warning);
            for (const row of step.readout ?? []) {
              add('readout', row.label);
              add('readout', row.value);
            }
          }
          break;

        default:
          // 'custom' renders a TemplateResult — its title is already indexed
          // above and there is no further text to read without rendering.
          break;
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

/**
 * Field priority (lower = better).
 *
 * Headings stay ahead of body text: a hit in a title is almost always the page
 * the reader wanted, while a hit in a paragraph may be an aside. The body
 * fields rank last but they DO rank — before H5 they could not be hit at all.
 */
const FIELD_PRIORITY = {
  title: 0,
  section: 1,
  description: 2,
  tldr: 3,
  step: 4,
  callout: 5,
  readout: 6,
  body: 7,
} as const;

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

export function debounce<T extends (...args: never[]) => void>(fn: T, ms = 150): DebouncedFn<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = ((...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as DebouncedFn<T>;
  debounced.cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  return debounced;
}
