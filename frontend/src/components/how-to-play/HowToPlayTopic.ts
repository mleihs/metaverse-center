/**
 * How to Play — Individual Topic Page (shared template for all 12 topics).
 *
 * Architecture:
 * - Dynamic :topic param resolves to a TopicDefinition
 * - Two-column layout: content (max-width 72ch) + sticky sidebar
 * - TL;DR frosted-glass box ("EXECUTIVE SUMMARY")
 * - "How it works" renders DemoStep[], callouts, readouts, custom sections
 * - "Related Topics" cross-links
 * - Prev/Next topic navigation at bottom
 * - Sidebar: "In this topic" nav with IntersectionObserver active tracking
 *
 * Responsive:
 * - <768px: single column, sidebar collapsed behind disclosure widget
 * - 768px–1023px: single column with sidebar as horizontal strip
 * - 1024px+: two-column with sticky sidebar
 * - 1440p+: wider container, more breathing room
 * - 4K: max-width cap, larger typography
 *
 * Perspectives applied:
 * - Architect: reactive topic changes, SEO updates, scroll reset, section IDs
 * - Game Designer: scales from 3-step topics (Map) to 9-section monsters (Advanced)
 * - UX: fish-tank principle (TL;DR first), sticky sidebar for orientation
 * - Research: Stripe Docs two-column, Civ VI max-2-levels, PoE 800-2000w pages
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { analyticsService } from '../../services/AnalyticsService.js';
import { seoService } from '../../services/SeoService.js';
import { icons, type IconKey } from '../../utils/icons.js';
import type { DemoStep } from './htp-types.js';
import type { ForgeStep } from './htp-content-features.js';
import {
  getAdjacentTopics,
  getTopicBySlug,
  TOPICS,
  type TopicCallout,
  type TopicDefinition,
  type TopicReadout,
  type TopicSection,
} from './htp-topic-data.js';
import {
  htpBackStyles,
  htpHeroStyles,
  htpReducedMotionBase,
} from './htp-shared-styles.js';

// ── Component ────────────────────────────────────────────────────────────────

@localized()
@customElement('velg-how-to-play-topic')
export class VelgHowToPlayTopic extends LitElement {
  // ── Styles ───────────────────────────────────────────────────────────────

  static styles = [
    htpHeroStyles,
    htpBackStyles,
    htpReducedMotionBase,
    css`
    /* ═══ HOST ═══════════════════════════════════════════════════════════ */

    :host {
      display: block;
      color: var(--color-text-primary);
      background: var(--color-surface);
      min-height: 100vh;
      --_topic-accent: var(--color-primary);
      /* Override shared style accent to use topic-scoped variable */
      --_accent: var(--_topic-accent);
    }

    /* ═══ LAYOUT ════════════════════════════════════════════════════════ */

    .topic-page {
      max-width: 1100px;
      margin: 0 auto;
      padding: var(--space-8) var(--content-padding) var(--space-16);
    }

    .topic-layout {
      display: grid;
      grid-template-columns: 1fr 220px;
      gap: var(--space-10);
      align-items: start;
    }

    /* ═══ HERO OVERRIDES ═══════════════════════════════════════════════ */

    .hero {
      --_hero-margin-bottom: var(--space-8);
      --_hero-title-size: var(--text-3xl);
      --_hero-title-margin: var(--space-2);
    }

    .hero__read-time {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    /* Back link margin override (tighter for topic pages) */
    .back {
      margin-bottom: var(--space-6);
    }

    /* ═══ BREADCRUMBS ═══════════════════════════════════════════════════ */

    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      font-family: var(--font-brutalist);
      font-size: 10px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin-bottom: var(--space-6);
      flex-wrap: wrap;
    }

    .breadcrumbs__link {
      color: var(--color-text-muted);
      text-decoration: none;
      cursor: pointer;
      transition: color var(--duration-fast) var(--ease-default);
    }

    .breadcrumbs__link:hover {
      color: var(--color-primary);
    }

    .breadcrumbs__sep {
      color: var(--color-border);
      user-select: none;
    }

    .breadcrumbs__current {
      color: var(--_topic-accent);
    }

    /* ═══ HERO ══════════════════════════════════════════════════════════ */

    .hero {
      margin-bottom: var(--space-8);
    }

    /* hero__eyebrow + hero__title from htpHeroStyles, customized via CSS vars above */

    .hero__read-time {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    /* ═══ TL;DR BOX (EXECUTIVE SUMMARY) ═══════════════════════════════ */

    .tldr {
      position: relative;
      background: color-mix(in srgb, var(--color-surface-raised) 80%, transparent);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: var(--border-width-thick) solid color-mix(in srgb, var(--color-border) 60%, transparent);
      padding: var(--space-5) var(--space-6);
      margin-bottom: var(--space-10);

      /* Left accent stripe */
      border-left: 4px solid var(--_topic-accent);
    }

    .tldr__eyebrow {
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--_topic-accent);
      margin: 0 0 var(--space-3);
    }

    .tldr__list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .tldr__item {
      display: flex;
      align-items: baseline;
      gap: var(--space-3);
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      padding: var(--space-1) 0;
    }

    .tldr__bullet {
      flex-shrink: 0;
      width: 6px;
      height: 6px;
      background: var(--_topic-accent);
      margin-top: 7px;
    }

    /* ═══ CONTENT AREA ═════════════════════════════════════════════════ */

    .content {
      max-width: 72ch;
    }

    /* ── Section Heading ── */

    .section-heading {
      font-family: var(--font-brutalist);
      font-size: var(--text-xl);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--color-text-primary);
      margin: var(--space-10) 0 var(--space-5);
      padding-bottom: var(--space-2);
      border-bottom: 2px solid color-mix(in srgb, var(--_topic-accent) 30%, transparent);
      scroll-margin-top: var(--space-6);
    }

    .section-heading:first-child {
      margin-top: 0;
    }

    /* ── Text Paragraphs ── */

    .topic-text {
      font-family: var(--font-prose);
      font-size: var(--text-base);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-5);
      max-width: 72ch;
    }

    /* ── Callout Cards ── */

    .callout {
      border: 2px solid var(--color-border);
      padding: var(--space-4) var(--space-5);
      margin: 0 0 var(--space-4);
    }

    .callout--info { border-left: 4px solid var(--color-info); }
    .callout--tip { border-left: 4px solid var(--color-success); }
    .callout--warn { border-left: 4px solid var(--color-warning); }
    .callout--danger { border-left: 4px solid var(--color-danger); }

    .callout__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: var(--space-2);
    }

    .callout--info .callout__label { color: var(--color-info); }
    .callout--tip .callout__label { color: var(--color-success); }
    .callout--warn .callout__label { color: var(--color-warning); }
    .callout--danger .callout__label { color: var(--color-danger); }

    .callout__text {
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
    }

    /* ── Readout Grid ── */

    .readout {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1px;
      background: var(--color-border);
      border: 2px solid var(--color-border);
      margin: 0 0 var(--space-5);
    }

    .readout__cell {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-3) var(--space-4);
      background: var(--color-surface-raised);
    }

    .readout__label {
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .readout__value {
      font-family: var(--font-body);
      font-size: var(--text-sm);
      color: var(--color-text-primary);
    }

    /* ── Demo Steps ── */

    .demo-step {
      border: 2px solid var(--color-border);
      padding: var(--space-5);
      margin: 0 0 var(--space-4);
      background: var(--color-surface-raised);
    }

    .demo-step__header {
      display: flex;
      align-items: baseline;
      gap: var(--space-3);
      margin-bottom: var(--space-3);
    }

    .demo-step__index {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      color: var(--_topic-accent);
      letter-spacing: 0.1em;
      flex-shrink: 0;
    }

    .demo-step__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-base);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--color-text-primary);
    }

    .demo-step__narration {
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-3);
    }

    .demo-step__detail {
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      font-style: italic;
      line-height: var(--leading-relaxed);
      color: var(--color-text-muted);
      margin: 0 0 var(--space-3);
    }

    .demo-step__readout {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 1px;
      background: var(--color-border);
      border: 1px solid var(--color-border);
      margin: 0 0 var(--space-3);
    }

    .demo-step__readout-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--space-2) var(--space-3);
      background: var(--color-surface);
    }

    .demo-step__readout-label {
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .demo-step__readout-value {
      font-family: var(--font-body);
      font-size: var(--text-xs);
      color: var(--color-text-primary);
    }

    .demo-step__tip {
      border: 1px dashed var(--color-success);
      padding: var(--space-2) var(--space-3);
      margin-top: var(--space-3);
    }

    .demo-step__tip-label {
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-success);
      margin-bottom: var(--space-1);
    }

    .demo-step__tip-text {
      font-family: var(--font-prose);
      font-size: var(--text-xs);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
    }

    .demo-step__warning {
      border: 1px dashed var(--color-warning);
      padding: var(--space-2) var(--space-3);
      margin-top: var(--space-3);
    }

    .demo-step__warning-label {
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-warning);
      margin-bottom: var(--space-1);
    }

    .demo-step__warning-text {
      font-family: var(--font-prose);
      font-size: var(--text-xs);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
    }

    /* ── Custom Section Renderers ── */

    /* Phase timeline (topic: epochs) */
    .topic-phases {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
      margin: 0 0 var(--space-5);
    }

    .topic-phase {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .topic-phase__dot {
      width: 12px;
      height: 12px;
      border: 2px solid;
      flex-shrink: 0;
    }

    .topic-phase__name {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .topic-phase__desc {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      display: none;
    }

    .topic-phase__arrow {
      color: var(--color-text-muted);
      font-size: var(--text-xs);
    }

    /* Operative grid (topic: operatives) */
    .topic-ops-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--space-4);
      margin: 0 0 var(--space-5);
    }

    .topic-op-card {
      border: 2px solid color-mix(in srgb, var(--_op-color, var(--color-border)) 40%, var(--color-border));
      padding: var(--space-4);
      background: var(--color-surface-raised);
    }

    .topic-op-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-2);
    }

    .topic-op-card__name {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--_op-color, var(--color-text-primary));
    }

    .topic-op-card__cost {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      color: var(--color-primary);
    }

    .topic-op-card__stats {
      display: flex;
      gap: var(--space-3);
      font-family: var(--font-brutalist);
      font-size: 10px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin-bottom: var(--space-2);
    }

    .topic-op-card__desc {
      font-family: var(--font-prose);
      font-size: var(--text-xs);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-2);
    }

    .topic-op-card__effect {
      font-size: var(--text-xs);
      font-style: italic;
      color: var(--color-text-muted);
      margin: 0;
    }

    /* Scoring dimensions (topic: scoring) */
    .topic-dims {
      display: grid;
      gap: var(--space-4);
      margin: 0 0 var(--space-5);
    }

    .topic-dim-block {
      border: 2px solid var(--color-border);
      padding: var(--space-4);
      background: var(--color-surface-raised);
    }

    .topic-dim-block__header {
      display: flex;
      align-items: baseline;
      gap: var(--space-3);
      margin-bottom: var(--space-2);
    }

    .topic-dim-block__name {
      font-family: var(--font-brutalist);
      font-size: var(--text-base);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .topic-dim-block__title {
      font-family: var(--font-prose);
      font-size: var(--text-xs);
      font-style: italic;
      color: var(--color-text-muted);
    }

    .topic-dim-block__formula {
      display: block;
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      color: var(--color-primary);
      margin-bottom: var(--space-2);
    }

    .topic-dim-block__explanation {
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      margin: 0;
    }

    /* Presets table (topic: scoring) */
    .topic-presets-table {
      display: grid;
      gap: 1px;
      background: var(--color-border);
      border: 2px solid var(--color-border);
      margin: 0 0 var(--space-5);
      font-size: var(--text-xs);
    }

    .topic-presets-table__header,
    .topic-presets-table__row {
      display: grid;
      grid-template-columns: 120px repeat(5, 1fr);
      gap: 1px;
    }

    .topic-presets-table__header {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .topic-presets-table__header > span,
    .topic-presets-table__row > span {
      padding: var(--space-2) var(--space-3);
      background: var(--color-surface-raised);
    }

    .topic-presets-table__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      color: var(--color-text-primary);
    }

    /* Bleed vectors (topic: advanced) */
    .topic-vector-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: var(--space-3);
      margin: 0 0 var(--space-5);
    }

    .topic-vector-card {
      border: 2px solid var(--color-border);
      padding: var(--space-3);
      background: var(--color-surface-raised);
    }

    .topic-vector-card__name {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      display: block;
      margin-bottom: var(--space-1);
    }

    .topic-vector-card__desc {
      font-size: var(--text-xs);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-2);
    }

    .topic-vector-card__tags {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
    }

    .topic-tag {
      font-family: var(--font-brutalist);
      font-size: 9px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      border: 1px solid var(--color-border);
      padding: 1px var(--space-2);
    }

    /* Echo lifecycle (topic: advanced) */
    .topic-lifecycle {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      margin: 0 0 var(--space-5);
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .topic-lifecycle__arrow {
      color: var(--color-text-muted);
    }

    /* ═══ RELATED TOPICS ═══════════════════════════════════════════════ */

    .related {
      margin-top: var(--space-10);
      padding-top: var(--space-6);
      border-top: 2px solid var(--color-border);
    }

    .related__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-muted);
      margin: 0 0 var(--space-4);
    }

    .related__grid {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
    }

    .related__link {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      text-decoration: none;
      color: var(--color-text-secondary);
      padding: var(--space-2) var(--space-3);
      border: 2px solid var(--color-border);
      cursor: pointer;
      transition:
        border-color var(--duration-fast) var(--ease-default),
        color var(--duration-fast) var(--ease-default);
    }

    .related__link:hover,
    .related__link:focus-visible {
      border-color: var(--_topic-accent);
      color: var(--_topic-accent);
    }

    /* ═══ PREV/NEXT NAVIGATION ═════════════════════════════════════════ */

    .topic-nav {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-4);
      margin-top: var(--space-10);
      padding-top: var(--space-6);
      border-top: var(--border-width-thick) solid var(--color-border);
    }

    .topic-nav__link {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-4);
      border: 2px solid var(--color-border);
      text-decoration: none;
      color: inherit;
      cursor: pointer;
      transition:
        border-color var(--duration-fast) var(--ease-default),
        box-shadow var(--duration-fast) var(--ease-default);
    }

    .topic-nav__link:hover,
    .topic-nav__link:focus-visible {
      border-color: var(--_topic-accent);
      box-shadow: 3px 3px 0 color-mix(in srgb, var(--_topic-accent) 20%, transparent);
    }

    .topic-nav__link--next {
      text-align: right;
    }

    .topic-nav__label {
      font-family: var(--font-brutalist);
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .topic-nav__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--color-text-primary);
    }

    /* ═══ SIDEBAR ══════════════════════════════════════════════════════ */

    .sidebar {
      position: sticky;
      top: var(--space-6);
    }

    .sidebar__title {
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin: 0 0 var(--space-3);
      padding-bottom: var(--space-2);
      border-bottom: 1px solid var(--color-border);
    }

    .sidebar__nav {
      list-style: none;
      padding: 0;
      margin: 0 0 var(--space-6);
    }

    .sidebar__nav-item {
      font-family: var(--font-body);
      font-size: var(--text-xs);
      line-height: var(--leading-normal);
    }

    .sidebar__nav-link {
      display: block;
      padding: var(--space-1) var(--space-3);
      color: var(--color-text-muted);
      text-decoration: none;
      cursor: pointer;
      border-left: 2px solid transparent;
      transition:
        color var(--duration-fast) var(--ease-default),
        border-color var(--duration-fast) var(--ease-default);
    }

    .sidebar__nav-link:hover {
      color: var(--color-text-secondary);
    }

    .sidebar__nav-link--active {
      color: var(--_topic-accent);
      border-left-color: var(--_topic-accent);
    }

    .sidebar__related-title {
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin: 0 0 var(--space-3);
      padding-bottom: var(--space-2);
      border-bottom: 1px solid var(--color-border);
    }

    .sidebar__related-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .sidebar__related-link {
      display: block;
      padding: var(--space-1) var(--space-3);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-decoration: none;
      cursor: pointer;
      transition: color var(--duration-fast) var(--ease-default);
    }

    .sidebar__related-link:hover {
      color: var(--_topic-accent);
    }

    /* ═══ 404 ══════════════════════════════════════════════════════════ */

    .not-found {
      text-align: center;
      padding: var(--space-16) 0;
    }

    .not-found__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-3xl);
      color: var(--color-text-primary);
      margin: 0 0 var(--space-4);
    }

    .not-found__text {
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-6);
    }

    .not-found__link {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      text-decoration: none;
      color: var(--color-primary);
      cursor: pointer;
    }

    /* ═══ MOBILE SIDEBAR DISCLOSURE ════════════════════════════════════ */

    .sidebar-disclosure {
      display: none;
      margin-bottom: var(--space-6);
    }

    .sidebar-disclosure__toggle {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      background: none;
      border: 2px solid var(--color-border);
      padding: var(--space-2) var(--space-3);
      cursor: pointer;
      width: 100%;
      text-align: left;
      transition: border-color var(--duration-fast) var(--ease-default);
    }

    .sidebar-disclosure__toggle:hover {
      border-color: var(--_topic-accent);
    }

    .sidebar-disclosure__chevron {
      transition: transform var(--duration-fast) var(--ease-default);
      color: var(--color-text-muted);
    }

    .sidebar-disclosure--open .sidebar-disclosure__chevron {
      transform: rotate(180deg);
    }

    .sidebar-disclosure__content {
      display: none;
      padding: var(--space-3) var(--space-4);
      border: 2px solid var(--color-border);
      border-top: none;
    }

    .sidebar-disclosure--open .sidebar-disclosure__content {
      display: block;
    }

    /* ═══ REDUCED MOTION (component-specific) ═════════════════════════ */
    /* Back arrow handled by htpReducedMotionBase */

    @media (prefers-reduced-motion: reduce) {
      .sidebar-disclosure__chevron {
        transition: none;
      }

      /* Intentional: rotate is state indication, not animation */
      .sidebar-disclosure--open .sidebar-disclosure__chevron {
        transform: rotate(180deg);
      }
    }

    /* ═══ RESPONSIVE: MOBILE (<768px) ════════════════════════════════ */
    /* Hero title/subtitle mobile overrides in htpMobileHeroStyles (not imported here
       because Topic has its own smaller sizes set via --_hero-title-size) */

    @media (max-width: 767px) {
      .topic-page {
        padding: var(--space-6) var(--space-4) var(--space-12);
      }

      .topic-layout {
        display: block;
      }

      .sidebar {
        display: none;
      }

      .sidebar-disclosure {
        display: block;
      }

      .hero {
        --_hero-title-size: var(--text-2xl);
      }

      .tldr {
        padding: var(--space-4);
      }

      .topic-nav {
        grid-template-columns: 1fr;
        gap: var(--space-3);
      }

      .topic-nav__link--next {
        text-align: left;
      }

      .topic-ops-grid {
        grid-template-columns: 1fr;
      }

      .topic-presets-table__header,
      .topic-presets-table__row {
        grid-template-columns: 100px repeat(5, 1fr);
        font-size: 9px;
      }

      .readout {
        grid-template-columns: 1fr;
      }

      .demo-step__readout {
        grid-template-columns: 1fr;
      }

      .topic-phases {
        flex-direction: column;
        align-items: flex-start;
      }

      .topic-phase__desc {
        display: inline;
      }

      .topic-phase__arrow {
        display: none;
      }

      .topic-vector-grid {
        grid-template-columns: 1fr;
      }
    }

    /* ═══ RESPONSIVE: TABLET (768px–1023px) ══════════════════════════ */

    @media (min-width: 768px) and (max-width: 1023px) {
      .topic-layout {
        display: block;
      }

      .sidebar {
        display: none;
      }

      .sidebar-disclosure {
        display: block;
      }
    }

    /* ═══ RESPONSIVE: 1440p+ ═════════════════════════════════════════ */

    @media (min-width: 1440px) {
      .topic-page {
        max-width: 1200px;
        padding-top: var(--space-12);
      }

      .topic-layout {
        grid-template-columns: 1fr 260px;
        gap: var(--space-12);
      }

      .hero {
        --_hero-title-size: var(--text-4xl);
      }
    }

    /* ═══ RESPONSIVE: 4K (2560px+) ═══════════════════════════════════ */

    @media (min-width: 2560px) {
      .topic-page {
        max-width: 1400px;
      }

      .topic-layout {
        grid-template-columns: 1fr 300px;
        gap: var(--space-16);
      }

      .hero {
        --_hero-title-size: var(--text-5xl);
      }

      .content {
        max-width: 80ch;
      }

      .section-heading {
        font-size: var(--text-2xl);
      }

      .topic-text {
        font-size: var(--text-lg);
      }

      .demo-step__narration,
      .callout__text {
        font-size: var(--text-base);
      }
    }
  `];

  // ── Properties ──────────────────────────────────────────────────────────

  @property() topic = '';
  @state() private _topicDef: TopicDefinition | undefined;
  @state() private _sectionIds: string[] = [];
  @state() private _activeSectionId = '';
  @state() private _sidebarOpen = false;

  private _observer: IntersectionObserver | null = null;

  // ── Lifecycle ──────────────────────────────────────────────────────────

  connectedCallback(): void {
    super.connectedCallback();
    this._resolveTopic();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._observer?.disconnect();
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('topic')) {
      this._resolveTopic();
      // Scroll to top on topic change
      this.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
    // Set up IntersectionObserver after render
    this._setupObserver();
  }

  private _resolveTopic() {
    this._topicDef = getTopicBySlug(this.topic);
    if (!this._topicDef) return;

    const def = this._topicDef;

    seoService.setTitle([def.title, msg('Game Guide'), msg('How to Play')]);
    seoService.setDescription(def.description);
    seoService.setCanonical(`/how-to-play/guide/${def.slug}`);
    seoService.setBreadcrumbs([
      { name: 'Home', url: 'https://metaverse.center/' },
      { name: msg('How to Play'), url: 'https://metaverse.center/how-to-play' },
      { name: msg('Game Guide'), url: 'https://metaverse.center/how-to-play/guide' },
      { name: def.title, url: `https://metaverse.center/how-to-play/guide/${def.slug}` },
    ]);
    analyticsService.trackPageView(`/how-to-play/guide/${def.slug}`, document.title);

    // Build section ID list for sidebar nav
    this._sectionIds = [];
    for (const section of def.sections()) {
      if ('title' in section && section.title) {
        this._sectionIds.push(this._slugify(section.title));
      }
    }
    this._activeSectionId = this._sectionIds[0] ?? '';
    this._sidebarOpen = false;
  }

  private _setupObserver() {
    this._observer?.disconnect();
    if (this._sectionIds.length === 0) return;

    this._observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this._activeSectionId = entry.target.id;
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 },
    );

    const root = this.shadowRoot;
    if (!root) return;
    for (const id of this._sectionIds) {
      const el = root.getElementById(id);
      if (el) this._observer.observe(el);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private _slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  private _navigate(path: string) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: path,
      bubbles: true,
      composed: true,
    }));
  }

  private _handleLinkClick(e: Event, href: string) {
    e.preventDefault();
    this._navigate(href);
  }

  private _scrollToSection(id: string) {
    const el = this.shadowRoot?.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this._sidebarOpen = false;
  }

  /** Resolve an icon key to its SVG template. Single targeted cast because
   *  resonanceArchetype has a different signature than standard icons. */
  private _getIcon(key: IconKey, size = 16) {
    return (icons[key] as (s?: number) => ReturnType<typeof icons.book>)(size);
  }

  // ── Render ─────────────────────────────────────────────────────────────

  protected render() {
    if (!this._topicDef) return this._render404();

    const def = this._topicDef;
    const sections = def.sections();
    const { prev, next } = getAdjacentTopics(def.slug);

    return html`
      <div class="topic-page" style="--_topic-accent: var(${def.accent})">
        ${this._renderBreadcrumbs(def)}
        ${this._renderHero(def)}
        ${this._renderMobileSidebar(sections)}
        <div class="topic-layout">
          <div class="content">
            ${this._renderTldr(def)}
            ${sections.map((s) => this._renderSection(s))}
            ${this._renderRelated(def)}
            ${this._renderTopicNav(prev, next)}
          </div>
          ${this._renderSidebar(def, sections)}
        </div>
      </div>
    `;
  }

  private _render404() {
    return html`
      <div class="topic-page">
        <div class="not-found">
          <h1 class="not-found__title">${msg('Topic Not Found')}</h1>
          <p class="not-found__text">${msg('This topic does not exist in the game guide.')}</p>
          <a
            class="not-found__link"
            href="/how-to-play/guide"
            @click=${(e: Event) => this._handleLinkClick(e, '/how-to-play/guide')}
          >${msg('Back to Game Guide')}</a>
        </div>
      </div>
    `;
  }

  private _renderBreadcrumbs(def: TopicDefinition) {
    return html`
      <nav class="breadcrumbs" aria-label=${msg('Breadcrumb')}>
        <a class="breadcrumbs__link" href="/how-to-play" @click=${(e: Event) => this._handleLinkClick(e, '/how-to-play')}>${msg('How to Play')}</a>
        <span class="breadcrumbs__sep" aria-hidden="true">/</span>
        <a class="breadcrumbs__link" href="/how-to-play/guide" @click=${(e: Event) => this._handleLinkClick(e, '/how-to-play/guide')}>${msg('Guide')}</a>
        <span class="breadcrumbs__sep" aria-hidden="true">/</span>
        <span class="breadcrumbs__current">${def.title}</span>
      </nav>
    `;
  }

  private _renderHero(def: TopicDefinition) {
    return html`
      <header class="hero">
        <span class="hero__eyebrow">${msg('Game Guide')}</span>
        <h1 class="hero__title">${def.title}</h1>
        <span class="hero__read-time">${def.readTime} ${msg('read')}</span>
      </header>
    `;
  }

  private _renderTldr(def: TopicDefinition) {
    const bullets = def.tldr();
    return html`
      <div class="tldr">
        <div class="tldr__eyebrow">${msg('Executive Summary')}</div>
        <ul class="tldr__list">
          ${bullets.map((b) => html`
            <li class="tldr__item">
              <span class="tldr__bullet" aria-hidden="true"></span>
              <span>${b}</span>
            </li>
          `)}
        </ul>
      </div>
    `;
  }

  // ── Section Renderers ──────────────────────────────────────────────────

  private _renderSection(section: TopicSection): TemplateResult {
    switch (section.kind) {
      case 'text':
        return html`<p class="topic-text">${section.content}</p>`;

      case 'callouts':
        return html`${section.items.map((c) => this._renderCallout(c))}`;

      case 'readout':
        return html`
          ${section.title ? html`<h3 class="section-heading" id=${this._slugify(section.title)}>${section.title}</h3>` : nothing}
          ${this._renderReadout(section.data())}
        `;

      case 'steps':
        return html`
          <h3 class="section-heading" id=${this._slugify(section.title)}>${section.title}</h3>
          ${section.steps().map((step, i) => this._renderDemoStep(step, i))}
        `;

      case 'custom':
        return html`
          ${section.title ? html`<h3 class="section-heading" id=${this._slugify(section.title)}>${section.title}</h3>` : nothing}
          ${section.render()}
        `;
    }
  }

  private _renderCallout(callout: TopicCallout) {
    return html`
      <div class="callout callout--${callout.type}">
        <div class="callout__label">${callout.label}</div>
        <div class="callout__text">${callout.text}</div>
      </div>
    `;
  }

  private _renderReadout(data: TopicReadout[]) {
    return html`
      <div class="readout">
        ${data.map((r) => html`
          <div class="readout__cell">
            <span class="readout__label">${r.label}</span>
            <span class="readout__value">${r.value}</span>
          </div>
        `)}
      </div>
    `;
  }

  private _renderDemoStep(step: DemoStep | ForgeStep, index: number) {
    return html`
      <div class="demo-step">
        <div class="demo-step__header">
          <span class="demo-step__index">${String(index + 1).padStart(2, '0')}</span>
          <span class="demo-step__title">${step.title}</span>
        </div>
        <p class="demo-step__narration">${step.narration}</p>
        ${step.detail ? html`<p class="demo-step__detail">${step.detail}</p>` : nothing}
        ${step.readout?.length ? html`
          <div class="demo-step__readout">
            ${step.readout.map((r) => html`
              <div class="demo-step__readout-cell">
                <span class="demo-step__readout-label">${r.label}</span>
                <span class="demo-step__readout-value">${r.value}</span>
              </div>
            `)}
          </div>
        ` : nothing}
        ${step.tip ? html`
          <div class="demo-step__tip">
            <div class="demo-step__tip-label">${msg('Tip')}</div>
            <div class="demo-step__tip-text">${step.tip}</div>
          </div>
        ` : nothing}
        ${step.warning ? html`
          <div class="demo-step__warning">
            <div class="demo-step__warning-label">${msg('Warning')}</div>
            <div class="demo-step__warning-text">${step.warning}</div>
          </div>
        ` : nothing}
      </div>
    `;
  }

  // ── Related Topics ─────────────────────────────────────────────────────

  private _renderRelated(def: TopicDefinition) {
    if (def.related.length === 0) return nothing;

    const relatedTopics = def.related
      .map((slug) => TOPICS.find((t) => t.slug === slug))
      .filter(Boolean) as TopicDefinition[];

    return html`
      <div class="related">
        <h3 class="related__title">${msg('Related Topics')}</h3>
        <div class="related__grid">
          ${relatedTopics.map((t) => html`
            <a
              class="related__link"
              href=${`/how-to-play/guide/${t.slug}`}
              @click=${(e: Event) => this._handleLinkClick(e, `/how-to-play/guide/${t.slug}`)}
            >
              ${this._getIcon(t.icon, 14)}
              ${t.title}
            </a>
          `)}
        </div>
      </div>
    `;
  }

  // ── Prev/Next Navigation ───────────────────────────────────────────────

  private _renderTopicNav(prev?: TopicDefinition, next?: TopicDefinition) {
    return html`
      <nav class="topic-nav" aria-label=${msg('Topic navigation')}>
        ${prev ? html`
          <a
            class="topic-nav__link"
            href=${`/how-to-play/guide/${prev.slug}`}
            @click=${(e: Event) => this._handleLinkClick(e, `/how-to-play/guide/${prev.slug}`)}
          >
            <span class="topic-nav__label">\u25C2 ${msg('Previous')}</span>
            <span class="topic-nav__title">${prev.title}</span>
          </a>
        ` : html`<div></div>`}
        ${next ? html`
          <a
            class="topic-nav__link topic-nav__link--next"
            href=${`/how-to-play/guide/${next.slug}`}
            @click=${(e: Event) => this._handleLinkClick(e, `/how-to-play/guide/${next.slug}`)}
          >
            <span class="topic-nav__label">${msg('Next')} \u25B8</span>
            <span class="topic-nav__title">${next.title}</span>
          </a>
        ` : html`<div></div>`}
      </nav>
    `;
  }

  // ── Sidebar ────────────────────────────────────────────────────────────

  private _renderSidebar(def: TopicDefinition, sections: TopicSection[]) {
    const titledSections = sections.filter((s) => 'title' in s && s.title) as (TopicSection & { title: string })[];
    const relatedTopics = def.related
      .map((slug) => TOPICS.find((t) => t.slug === slug))
      .filter(Boolean) as TopicDefinition[];

    return html`
      <aside class="sidebar">
        ${titledSections.length > 0 ? html`
          <div class="sidebar__title">${msg('In this topic')}</div>
          <ul class="sidebar__nav">
            ${titledSections.map((s) => {
              const id = this._slugify(s.title);
              return html`
                <li class="sidebar__nav-item">
                  <a
                    class="sidebar__nav-link ${this._activeSectionId === id ? 'sidebar__nav-link--active' : ''}"
                    @click=${() => this._scrollToSection(id)}
                  >${s.title}</a>
                </li>
              `;
            })}
          </ul>
        ` : nothing}
        ${relatedTopics.length > 0 ? html`
          <div class="sidebar__related-title">${msg('Related')}</div>
          <ul class="sidebar__related-list">
            ${relatedTopics.map((t) => html`
              <li>
                <a
                  class="sidebar__related-link"
                  href=${`/how-to-play/guide/${t.slug}`}
                  @click=${(e: Event) => this._handleLinkClick(e, `/how-to-play/guide/${t.slug}`)}
                >${t.title}</a>
              </li>
            `)}
          </ul>
        ` : nothing}
      </aside>
    `;
  }

  // ── Mobile Sidebar (Disclosure Widget) ─────────────────────────────────

  private _renderMobileSidebar(sections: TopicSection[]) {
    const titledSections = sections.filter((s) => 'title' in s && s.title) as (TopicSection & { title: string })[];
    if (titledSections.length === 0) return nothing;

    return html`
      <div class="sidebar-disclosure ${this._sidebarOpen ? 'sidebar-disclosure--open' : ''}">
        <button
          class="sidebar-disclosure__toggle"
          @click=${() => { this._sidebarOpen = !this._sidebarOpen; }}
          aria-expanded=${this._sidebarOpen}
        >
          <span class="sidebar-disclosure__chevron">${icons.chevronDown(12)}</span>
          ${msg('In this topic')} (${titledSections.length})
        </button>
        <div class="sidebar-disclosure__content">
          <ul class="sidebar__nav">
            ${titledSections.map((s) => {
              const id = this._slugify(s.title);
              return html`
                <li class="sidebar__nav-item">
                  <a
                    class="sidebar__nav-link ${this._activeSectionId === id ? 'sidebar__nav-link--active' : ''}"
                    @click=${() => this._scrollToSection(id)}
                  >${s.title}</a>
                </li>
              `;
            })}
          </ul>
        </div>
      </div>
    `;
  }
}

// ── Global Registration ──────────────────────────────────────────────────────

declare global {
  interface HTMLElementTagNameMap {
    'velg-how-to-play-topic': VelgHowToPlayTopic;
  }
}
