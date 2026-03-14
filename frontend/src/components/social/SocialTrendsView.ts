import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { embassiesApi, eventsApi, healthApi, resonanceApi, socialTrendsApi } from '../../services/api/index.js';
import { icons } from '../../utils/icons.js';
import { getThemeColor } from '../../utils/theme-colors.js';
import { humanizeEnum } from '../../utils/text.js';
import type {
  Embassy,
  EmbassyEffectiveness,
  SimulationHealth,
  SourceCategory,
} from '../../types/index.js';
import type { BrowseArticle } from '../../services/api/SocialTrendsApiService.js';
import { generationProgress } from '../../services/GenerationProgressService.js';
import { VelgToast } from '../shared/Toast.js';

import '../shared/VelgBadge.js';
import '../shared/Lightbox.js';
import '../shared/LoadingState.js';
import '../shared/ErrorState.js';
import '../shared/EmptyState.js';
import './TransformationModal.js';

const GUARDIAN_SECTIONS = [
  'world',
  'politics',
  'business',
  'technology',
  'science',
  'environment',
  'sport',
  'culture',
  'lifeandstyle',
  'education',
];

const MAX_BATCH = 10;

interface BatchTransformResult {
  article_name: string;
  article_platform: string;
  article_url?: string;
  article_raw_data?: Record<string, unknown>;
  transformation: {
    content?: string;
    narrative?: string;
    title?: string;
    description?: string;
    event_type?: string;
    impact_level?: number;
    model_used?: string;
  } | null;
  error: string | null;
}

@localized()
@customElement('velg-social-trends-view')
export class VelgSocialTrendsView extends LitElement {
  static styles = css`
    :host { display: block; }

    .trends { display: flex; flex-direction: column; gap: var(--space-4); }

    .trends__header {
      display: flex; align-items: center; justify-content: space-between; gap: var(--space-4);
      flex-wrap: wrap;
    }

    .trends__title {
      font-family: var(--font-brutalist); font-weight: var(--font-black);
      font-size: var(--text-2xl); text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist); margin: 0;
    }

    /* Controls bar */
    .controls {
      display: flex; align-items: flex-end; gap: var(--space-3); flex-wrap: wrap;
      padding: var(--space-3) var(--space-4);
      background: var(--color-surface-raised); border: var(--border-default);
      box-shadow: var(--shadow-md);
    }

    .controls__group {
      display: flex; flex-direction: column; gap: var(--space-1);
    }

    .controls__label {
      font-family: var(--font-brutalist); font-weight: var(--font-bold);
      font-size: var(--text-xs); text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist); color: var(--color-text-secondary);
    }

    .controls__input,
    .controls__select {
      font-family: var(--font-sans); font-size: var(--text-sm);
      padding: var(--space-1-5) var(--space-2-5);
      border: var(--border-medium); background: var(--color-surface);
      color: var(--color-text-primary);
    }

    .controls__input { min-width: 220px; }

    .controls__input:focus,
    .controls__select:focus {
      outline: none; border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .controls__btn {
      display: inline-flex; align-items: center; justify-content: center;
      gap: var(--space-2); padding: var(--space-1-5) var(--space-4);
      font-family: var(--font-brutalist); font-weight: var(--font-black);
      font-size: var(--text-sm); text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist); background: var(--color-primary);
      color: var(--color-text-inverse); border: var(--border-default);
      box-shadow: var(--shadow-md); cursor: pointer; transition: all var(--transition-fast);
      white-space: nowrap;
    }

    .controls__btn:hover {
      transform: translate(-2px, -2px); box-shadow: var(--shadow-lg);
      background: var(--color-primary-hover);
    }

    .controls__btn:active { transform: translate(0); box-shadow: var(--shadow-pressed); }

    .controls__btn:disabled {
      opacity: 0.5; cursor: not-allowed; pointer-events: none;
    }

    .controls__btn--toggle {
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
    }

    .controls__btn--toggle:hover {
      background: var(--color-surface-header);
    }

    .controls__btn--toggle-active {
      background: var(--color-warning);
      color: var(--color-text-primary);
      border-color: var(--color-warning);
    }

    .controls__btn--toggle-active:hover {
      background: var(--color-warning);
    }

    /* Resonance button */
    .btn--resonance {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1-5);
      padding: var(--space-1-5) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: var(--color-danger);
      color: var(--color-text-inverse);
      border: var(--border-default);
      box-shadow: var(--shadow-md);
      cursor: pointer;
      transition: all var(--transition-fast);
      white-space: nowrap;
    }

    .btn--resonance:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
      background: color-mix(in srgb, var(--color-danger) 85%, black);
    }

    .btn--resonance:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .btn--resonance:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    /* Selected article panel */
    .selected {
      padding: var(--space-4);
      background: var(--color-primary-bg);
      border: var(--border-width-default) solid var(--color-primary);
      display: flex; align-items: flex-start; gap: var(--space-4);
    }

    .selected__image {
      width: 180px; height: 120px; object-fit: cover; flex-shrink: 0;
      border: var(--border-width-default) solid var(--color-primary);
      cursor: pointer; transition: opacity var(--transition-fast);
    }

    .selected__image:hover { opacity: 0.8; }

    .selected__info { flex: 1; min-width: 0; }

    .selected__label {
      font-family: var(--font-brutalist); font-weight: var(--font-black);
      font-size: var(--text-xs); text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist); color: var(--color-primary);
      margin-bottom: var(--space-1);
    }

    .selected__title {
      font-family: var(--font-brutalist); font-weight: var(--font-black);
      font-size: var(--text-lg); text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist); margin: 0;
    }

    .selected__meta {
      display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1-5);
      font-size: var(--text-xs); color: var(--color-text-muted);
      margin-top: var(--space-2);
    }

    .selected__meta > span:not(:last-child)::after {
      content: '\u00b7'; margin-left: var(--space-1-5);
    }

    .selected__platform {
      font-family: var(--font-brutalist); font-weight: var(--font-bold);
      text-transform: uppercase; letter-spacing: var(--tracking-wide);
      color: var(--color-primary);
    }

    .selected__section {
      font-family: var(--font-brutalist); font-weight: var(--font-bold);
      text-transform: uppercase; letter-spacing: var(--tracking-wide);
    }

    .selected__abstract {
      font-size: var(--text-sm); color: var(--color-text-secondary);
      margin-top: var(--space-2); line-height: 1.6;
    }

    .selected__actions {
      display: flex; flex-direction: column; gap: var(--space-2);
      flex-shrink: 0;
    }

    .selected__btn {
      display: inline-flex; align-items: center; justify-content: center;
      padding: var(--space-1-5) var(--space-3);
      font-family: var(--font-brutalist); font-weight: var(--font-black);
      font-size: var(--text-xs); text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      border: var(--border-default); box-shadow: var(--shadow-md);
      cursor: pointer; transition: all var(--transition-fast);
      white-space: nowrap;
    }

    .selected__btn:hover {
      transform: translate(-2px, -2px); box-shadow: var(--shadow-lg);
    }

    .selected__btn--transform {
      background: var(--color-primary); color: var(--color-text-inverse);
    }

    .selected__btn--deselect {
      background: var(--color-surface-raised); color: var(--color-text-primary);
    }

    .selected__btn--link {
      background: var(--color-surface-raised); color: var(--color-text-primary);
      text-decoration: none; text-align: center;
    }

    /* Article grid */
    .articles__grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: var(--space-4);
    }

    @media (max-width: 480px) {
      .articles__grid { grid-template-columns: 1fr; }
    }

    /* Article card */
    .article-card {
      position: relative;
      background: var(--color-surface-raised); border: var(--border-default);
      box-shadow: var(--shadow-md); display: flex; flex-direction: column;
      transition: transform var(--duration-normal) var(--ease-out),
        box-shadow var(--duration-normal) var(--ease-out);
      cursor: pointer;
      opacity: 0;
      animation: card-enter 350ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
      animation-delay: calc(var(--i, 0) * 40ms);
    }

    @keyframes card-enter {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .article-card:hover {
      transform: translate(-2px, -2px); box-shadow: var(--shadow-lg);
    }

    .article-card--selected {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 2px var(--color-primary);
    }

    .article-card--dedup {
      opacity: 0.55;
    }

    .article-card--dedup:hover {
      opacity: 0.75;
    }

    .article-card__header {
      padding: var(--space-3) var(--space-4);
      background: var(--color-surface-header); border-bottom: var(--border-medium);
    }

    .article-card__title {
      font-family: var(--font-brutalist); font-weight: var(--font-black);
      font-size: var(--text-md); text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist); margin: 0;
      overflow: hidden; text-overflow: ellipsis;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }

    .article-card__body {
      padding: var(--space-3) var(--space-4);
      display: flex; flex-direction: column; gap: var(--space-2); flex: 1;
    }

    .article-card__badges { display: flex; flex-wrap: wrap; gap: var(--space-1-5); }

    .article-card__abstract {
      font-size: var(--text-sm); color: var(--color-text-secondary);
      line-height: 1.5; display: -webkit-box;
      -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
    }

    .article-card__meta {
      font-size: var(--text-xs); color: var(--color-text-muted);
      margin-top: auto;
    }

    /* Batch checkbox overlay */
    .article-card__check {
      position: absolute;
      top: var(--space-2);
      right: var(--space-2);
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-surface-raised);
      border: var(--border-default);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      color: var(--color-text-inverse);
      z-index: 1;
    }

    .article-card__check--active {
      background: var(--color-primary);
      border-color: var(--color-primary);
    }

    /* Staging rack */
    .staging {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      background: var(--color-surface-header);
      border: var(--border-default);
      box-shadow: var(--shadow-xs);
    }

    .staging__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }

    .staging__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
    }

    .staging__count {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .staging__chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1-5);
    }

    .staging__chip {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-0-5) var(--space-2);
      background: var(--color-surface-raised);
      border: var(--border-default);
      box-shadow: var(--shadow-xs);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
      max-width: 200px;
    }

    .staging__chip-title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .staging__chip-remove {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      padding: 0;
      background: none;
      border: none;
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: 10px;
      color: var(--color-text-muted);
      cursor: pointer;
      flex-shrink: 0;
      transition: color var(--transition-fast);
    }

    .staging__chip-remove:hover {
      color: var(--color-danger);
    }

    .staging__actions {
      display: flex;
      gap: var(--space-2);
      margin-top: var(--space-1);
    }

    .staging__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-1-5) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      border: var(--border-default);
      box-shadow: var(--shadow-md);
      cursor: pointer;
      transition: all var(--transition-fast);
      white-space: nowrap;
    }

    .staging__btn:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .staging__btn:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .staging__btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    .staging__btn--transform {
      background: var(--color-primary);
      color: var(--color-text-inverse);
    }

    .staging__btn--integrate {
      background: var(--color-success);
      color: var(--color-text-inverse);
    }

    .staging__btn--clear {
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
    }

    /* Batch results */
    .batch-results {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
      background: var(--color-surface-sunken);
      border: var(--border-default);
    }

    .batch-results__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
    }

    .batch-results__item {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-3);
      background: var(--color-surface-raised);
      border: var(--border-width-thin) solid var(--color-border-light);
    }

    .batch-results__item--error {
      border-color: var(--color-danger);
      opacity: 0.7;
    }

    .batch-results__item-info {
      flex: 1;
      min-width: 0;
    }

    .batch-results__item-title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .batch-results__item-desc {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      margin-top: var(--space-1);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .batch-results__item-meta {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      margin-top: var(--space-1);
    }

    .batch-results__item-error {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      color: var(--color-danger);
      text-transform: uppercase;
    }

    .trends__auth-notice {
      display: flex; flex-direction: column; align-items: center; gap: var(--space-3);
      padding: var(--space-8) var(--space-4); text-align: center;
      border: var(--border-default); background: var(--color-surface-raised);
    }

    .trends__auth-notice-text {
      font-family: var(--font-brutalist); font-weight: var(--font-bold);
      font-size: var(--text-md); text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist); color: var(--color-text-secondary);
    }

    /* ═══════════════════════════════════════
       EMBASSY OVERVIEW — Diplomatic Dossier
       ═══════════════════════════════════════ */

    .embassy-overview {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-5) var(--space-6);
      background: var(--color-surface-sunken);
      border: var(--border-default);
      border-top: 3px solid var(--color-secondary, #3b82f6);
      position: relative;
      overflow: hidden;
    }

    .embassy-overview::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 200px;
      height: 200px;
      background: radial-gradient(
        circle at top right,
        color-mix(in srgb, var(--color-secondary, #3b82f6) 6%, transparent),
        transparent 70%
      );
      pointer-events: none;
    }

    .embassy-overview__header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .embassy-overview__icon {
      display: flex;
      color: var(--color-secondary, #3b82f6);
      opacity: 0.7;
    }

    .embassy-overview__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black, 900);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--color-text-primary);
      margin: 0;
    }

    .embassy-overview__subtitle {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
      margin-left: auto;
    }

    /* ── Intel summary bar ── */

    .embassy-intel {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-3);
    }

    .embassy-intel__stat {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-3);
      background: var(--color-surface);
      border: var(--border-width-thin) solid var(--color-border-light);
    }

    .embassy-intel__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
    }

    .embassy-intel__value {
      font-family: var(--font-mono, monospace);
      font-weight: 700;
      font-size: var(--text-xl, 20px);
      color: var(--color-text-primary);
      line-height: 1;
    }

    .embassy-intel__value--accent {
      color: var(--color-secondary, #3b82f6);
    }

    /* ── Embassy card grid ── */

    .embassy-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--space-4);
    }

    .embassy-card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
      background: var(--color-surface);
      border: var(--border-width-default) solid var(--color-border);
      overflow: hidden;
      cursor: pointer;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .embassy-card:hover {
      border-color: var(--color-secondary, #3b82f6);
      box-shadow: 0 0 12px color-mix(in srgb, var(--color-secondary, #3b82f6) 12%, transparent);
    }

    /* Shimmer border accent */
    .embassy-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(
        90deg,
        var(--embassy-theme-color, var(--color-secondary)),
        color-mix(in srgb, var(--embassy-theme-color, var(--color-secondary)) 40%, var(--color-primary)),
        var(--embassy-theme-color, var(--color-secondary))
      );
      background-size: 200% 100%;
      animation: embassy-shimmer 4s linear infinite;
    }

    @keyframes embassy-shimmer {
      0% { background-position: 200% center; }
      100% { background-position: -200% center; }
    }

    .embassy-card__header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .embassy-card__sim-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
      box-shadow: 0 0 6px var(--embassy-theme-color, transparent);
    }

    .embassy-card__sim-name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-muted);
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .embassy-card__partner {
      display: flex;
      gap: var(--space-3);
      align-items: flex-start;
    }

    .embassy-card__thumb {
      width: 48px;
      height: 48px;
      object-fit: cover;
      border: var(--border-width-default) solid var(--color-border);
      flex-shrink: 0;
    }

    .embassy-card__info {
      flex: 1;
      min-width: 0;
    }

    .embassy-card__building-name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      color: var(--color-text-primary);
      margin: 0 0 var(--space-1);
      transition: color 0.2s;
    }

    .embassy-card:hover .embassy-card__building-name {
      color: var(--color-secondary, #3b82f6);
    }

    .embassy-card__building-type {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-transform: capitalize;
    }

    /* Effectiveness bar */
    .embassy-card__effectiveness {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .embassy-card__eff-track {
      flex: 1;
      height: 6px;
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border);
      overflow: hidden;
    }

    .embassy-card__eff-fill {
      height: 100%;
      transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .embassy-card__eff-value {
      font-family: var(--font-mono, monospace);
      font-weight: 700;
      font-size: var(--text-xs);
      min-width: 36px;
      text-align: right;
    }

    .embassy-card__meta {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      align-items: center;
    }

    .embassy-card__ambassador {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      padding-top: var(--space-2);
      border-top: 1px solid var(--color-border-light);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
    }

    .embassy-card__amb-label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-muted);
    }

    /* ── Empty state ── */

    .embassy-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-6) var(--space-4);
      text-align: center;
    }

    .embassy-empty__icon {
      color: var(--color-text-muted);
      opacity: 0.4;
    }

    .embassy-empty__text {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
    }

    .embassy-empty__hint {
      font-family: var(--font-sans);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      max-width: 320px;
      line-height: 1.5;
    }

    @media (max-width: 640px) {
      .embassy-overview {
        padding: var(--space-4);
      }

      .embassy-intel {
        grid-template-columns: 1fr;
      }

      .embassy-cards {
        grid-template-columns: 1fr;
      }
    }

    /* === Mobile: stack selected panel === */
    @media (max-width: 640px) {
      .selected {
        flex-direction: column;
      }

      .selected__image {
        width: 100%;
        height: 160px;
      }

      .selected__actions {
        flex-direction: row;
        flex-wrap: wrap;
      }
    }
  `;

  @property({ type: String }) simulationId = '';

  // Embassy overview state
  @state() private _embassies: Embassy[] = [];
  @state() private _embassyEffectiveness: EmbassyEffectiveness[] = [];
  @state() private _healthSummary: SimulationHealth | null = null;
  @state() private _embassyLoading = false;

  @state() private _articles: BrowseArticle[] = [];
  @state() private _loading = false;
  @state() private _error: string | null = null;
  @state() private _source = 'guardian';
  @state() private _query = '';
  @state() private _section = '';
  @state() private _limit = 15;
  @state() private _selectedArticle: BrowseArticle | null = null;
  @state() private _showTransformModal = false;
  @state() private _lightboxSrc: string | null = null;
  @state() private _lightboxAlt = '';

  // Batch mode state
  @state() private _batchMode = false;
  @state() private _selectedBatch: BrowseArticle[] = [];
  @state() private _batchTransforming = false;
  @state() private _batchResults: BatchTransformResult[] | null = null;
  @state() private _existingEventTitles: string[] = [];

  connectedCallback(): void {
    super.connectedCallback();
    if (this.simulationId) {
      this._loadEmbassyData();
      if (appState.isAuthenticated.value) {
        this._loadArticles();
      }
    }
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('simulationId') && this.simulationId) {
      this._loadEmbassyData();
      if (appState.isAuthenticated.value) {
        this._loadArticles();
      }
    }
  }

  private async _loadEmbassyData(): Promise<void> {
    if (!this.simulationId) return;
    this._embassyLoading = true;

    const [embassyResult, healthResult] = await Promise.all([
      embassiesApi.listForSimulation(this.simulationId),
      healthApi.getDashboard(this.simulationId),
    ]);

    if (embassyResult.success && embassyResult.data) {
      this._embassies = embassyResult.data;
    }
    if (healthResult.success && healthResult.data) {
      this._healthSummary = healthResult.data.health;
      this._embassyEffectiveness = healthResult.data.embassies ?? [];
    }
    this._embassyLoading = false;
  }

  private async _loadArticles(): Promise<void> {
    this._loading = true;
    this._error = null;
    this._selectedArticle = null;

    const data: Record<string, unknown> = {
      source: this._source,
      limit: this._limit,
    };
    if (this._query.trim()) {
      data.query = this._query.trim();
    }
    if (this._section && this._source === 'guardian') {
      data.section = this._section;
    }

    const response = await socialTrendsApi.browse(
      this.simulationId,
      data as { source?: string; query?: string; section?: string; limit?: number },
    );

    if (response.success && response.data) {
      this._articles = Array.isArray(response.data) ? response.data : [];
    } else {
      this._error = response.error?.message || msg('Failed to load articles');
    }
    this._loading = false;

    // Load existing event titles for dedup
    this._loadExistingEventTitles();
  }

  private async _loadExistingEventTitles(): Promise<void> {
    if (!this.simulationId) return;
    try {
      const response = await eventsApi.list(this.simulationId, { limit: '100', offset: '0' });
      if (response.success && response.data && Array.isArray(response.data)) {
        this._existingEventTitles = response.data.map(
          (e: { title: string }) => e.title.toLowerCase(),
        );
      }
    } catch {
      // Dedup is best-effort
    }
  }

  private _isDedup(article: BrowseArticle): boolean {
    if (this._existingEventTitles.length === 0) return false;
    const name = article.name.toLowerCase();
    return this._existingEventTitles.some((t) => {
      // Fuzzy: check if >60% of words overlap
      const nameWords = name.split(/\s+/).filter((w) => w.length > 3);
      const titleWords = t.split(/\s+/).filter((w) => w.length > 3);
      if (nameWords.length === 0 || titleWords.length === 0) return false;
      const overlap = nameWords.filter((w) => titleWords.includes(w)).length;
      return overlap / Math.min(nameWords.length, titleWords.length) > 0.6;
    });
  }

  // -- Single mode handlers --

  private _handleSelectArticle(article: BrowseArticle): void {
    if (this._batchMode) {
      this._handleBatchToggle(article);
      return;
    }
    if (this._selectedArticle === article) {
      this._selectedArticle = null;
    } else {
      this._selectedArticle = article;
    }
  }

  private _handleTransformSelected(): void {
    if (this._selectedArticle) {
      this._showTransformModal = true;
    }
  }

  private _handleTransformComplete(): void {
    this._showTransformModal = false;
    this._selectedArticle = null;
  }

  // -- Batch mode handlers --

  private _handleBatchModeToggle(): void {
    this._batchMode = !this._batchMode;
    if (!this._batchMode) {
      this._selectedBatch = [];
      this._batchResults = null;
    }
    this._selectedArticle = null;
  }

  private _handleBatchToggle(article: BrowseArticle): void {
    const idx = this._selectedBatch.indexOf(article);
    if (idx >= 0) {
      this._selectedBatch = this._selectedBatch.filter((a) => a !== article);
    } else if (this._selectedBatch.length < MAX_BATCH) {
      this._selectedBatch = [...this._selectedBatch, article];
    }
  }

  private _handleBatchRemove(article: BrowseArticle): void {
    this._selectedBatch = this._selectedBatch.filter((a) => a !== article);
  }

  private _handleBatchClear(): void {
    this._selectedBatch = [];
    this._batchResults = null;
  }

  private async _handleBatchTransform(): Promise<void> {
    if (this._selectedBatch.length === 0) return;
    this._batchTransforming = true;
    this._batchResults = null;

    try {
      await generationProgress.withProgress(
        {
          title: msg('Batch transformation'),
          steps: [
            { id: 'prepare', label: msg('Preparing') },
            { id: 'transform', label: msg('Transforming articles') },
            { id: 'complete', label: msg('Complete') },
          ],
        },
        async (progress) => {
        progress.setStep('prepare', msg('Preparing batch...'));
        await new Promise((r) => setTimeout(r, 300));

        progress.setStep(
          'transform',
          msg(str`Transforming ${this._selectedBatch.length} articles...`),
          msg('This may take a moment'),
        );

        const response = await socialTrendsApi.batchTransform(this.simulationId, {
          articles: this._selectedBatch.map((a) => ({
            article_name: a.name,
            article_platform: a.platform,
            article_url: a.url,
            article_raw_data: a.raw_data,
          })),
        });

        if (response.success && response.data) {
          this._batchResults = response.data;
          const successCount = response.data.filter((r) => r.transformation).length;
          progress.complete(msg(str`${successCount} articles transformed`));
        } else {
          const errMsg = response.error?.message || msg('Batch transformation failed');
          progress.setError(errMsg);
        }
      },
      );
    } catch {
      // Error shown by GenerationProgressService
    } finally {
      this._batchTransforming = false;
    }
  }

  private async _handleBatchIntegrate(): Promise<void> {
    if (!this._batchResults) return;

    const successResults = this._batchResults.filter((r) => r.transformation);
    if (successResults.length === 0) return;

    this._batchTransforming = true;

    try {
      await generationProgress.withProgress(
        {
          title: msg('Batch integration'),
          steps: [
            { id: 'integrate', label: msg('Creating events') },
            { id: 'complete', label: msg('Complete') },
          ],
        },
        async (progress) => {
        progress.setStep('integrate', msg(str`Creating ${successResults.length} events...`));

        const items = successResults.map((r) => ({
          title: r.transformation!.title || r.article_name,
          description: r.transformation!.description || r.transformation!.narrative || r.transformation!.content || '',
          event_type: r.transformation!.event_type || 'news',
          impact_level: r.transformation!.impact_level || 5,
          tags: [r.article_platform],
          source_article: {
            name: r.article_name,
            platform: r.article_platform,
            url: r.article_url,
            raw_data: r.article_raw_data,
          },
        }));

        const response = await socialTrendsApi.batchIntegrate(this.simulationId, {
          items,
          generate_reactions_for_top: true,
          max_reaction_agents: 20,
        });

        if (response.success && response.data) {
          const { events, errors, reactions_count } = response.data;
          if (reactions_count > 0) {
            VelgToast.success(
              msg(str`${events.length} events created, ${reactions_count} reactions generated`),
            );
          } else {
            VelgToast.success(msg(str`${events.length} events created`));
          }
          if (errors.length > 0) {
            VelgToast.error(msg(str`${errors.length} items failed`));
          }
          this._selectedBatch = [];
          this._batchResults = null;
          progress.complete(msg(str`${events.length} events created`));
        } else {
          progress.setError(response.error?.message || msg('Batch integration failed'));
        }
      },
      );
    } catch {
      // Error shown by GenerationProgressService
    } finally {
      this._batchTransforming = false;
    }
  }

  // -- Resonance --

  private async _handleCreateResonance(): Promise<void> {
    const article = this._selectedArticle;
    if (!article) {
      VelgToast.error(msg('Select an article first'));
      return;
    }

    const raw = article.raw_data as Record<string, string> | undefined;
    const section = (raw?.section || raw?.source || '').toLowerCase();

    // Map article section to source category
    const sectionMap: Record<string, SourceCategory> = {
      business: 'economic_crisis',
      politics: 'political_upheaval',
      world: 'military_conflict',
      technology: 'tech_breakthrough',
      science: 'tech_breakthrough',
      environment: 'environmental_disaster',
      sport: 'cultural_shift',
      culture: 'cultural_shift',
      lifeandstyle: 'cultural_shift',
      education: 'cultural_shift',
    };

    const sourceCategory: SourceCategory = sectionMap[section] || 'cultural_shift';

    try {
      const response = await resonanceApi.create({
        source_category: sourceCategory,
        title: article.name,
        description: this._getAbstract(article, true) || article.name,
        magnitude: 0.5,
        real_world_source: {
          name: article.name,
          platform: article.platform,
          url: article.url,
          section: raw?.section,
        },
        impacts_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      if (response.success) {
        VelgToast.success(msg('Resonance created'));
        this._selectedArticle = null;
      } else {
        VelgToast.error(response.error?.message || msg('Failed to create resonance'));
      }
    } catch {
      VelgToast.error(msg('Failed to create resonance'));
    }
  }

  // -- Helpers --

  private _stripHtml(text: string): string {
    return text.replace(/<[^>]*>/g, '');
  }

  private _getAbstract(article: BrowseArticle, full = false): string {
    const raw = article.raw_data as Record<string, string> | undefined;
    const text = full
      ? raw?.standfirst || raw?.trail_text || raw?.description || ''
      : raw?.trail_text || raw?.description || '';
    return this._stripHtml(text);
  }

  private _getAuthor(article: BrowseArticle): string {
    const raw = article.raw_data as Record<string, string> | undefined;
    return raw?.byline || raw?.author || '';
  }

  private _getDate(article: BrowseArticle): string {
    const raw = article.raw_data as Record<string, string> | undefined;
    const dateStr = raw?.publication_date || raw?.published_at;
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return '';
    }
  }

  private _getImage(article: BrowseArticle): string {
    const raw = article.raw_data as Record<string, string> | undefined;
    return raw?.thumbnail || raw?.image_url || '';
  }

  private _getSection(article: BrowseArticle): string {
    const raw = article.raw_data as Record<string, string> | undefined;
    return raw?.section || raw?.source || '';
  }

  // -- Embassy helpers --

  private _effectivenessColor(label: string): string {
    switch (label) {
      case 'optimal': return 'var(--color-success)';
      case 'operational': return 'var(--color-info, var(--color-secondary))';
      case 'limited': return 'var(--color-warning, var(--color-accent))';
      case 'dormant': return 'var(--color-danger)';
      default: return 'var(--color-text-muted)';
    }
  }

  private _getEmbassyPartner(embassy: Embassy): {
    building: Embassy['building_a'];
    simulation: Embassy['simulation_a'];
  } | null {
    if (embassy.simulation_a_id === this.simulationId) {
      return { building: embassy.building_b, simulation: embassy.simulation_b };
    }
    return { building: embassy.building_a, simulation: embassy.simulation_a };
  }

  private _getEmbassyEffectiveness(embassyId: string): EmbassyEffectiveness | undefined {
    return this._embassyEffectiveness.find((e) => e.embassy_id === embassyId);
  }

  private _getAmbassadorName(embassy: Embassy): string | null {
    const meta = embassy.embassy_metadata;
    if (!meta) return null;
    const key = this.simulationId === embassy.simulation_a_id ? 'ambassador_a' : 'ambassador_b';
    return meta[key]?.name ?? null;
  }

  private _handleEmbassyClick(embassy: Embassy): void {
    const partner = this._getEmbassyPartner(embassy);
    if (!partner?.simulation || !partner?.building) return;
    const slug = partner.simulation.slug ?? partner.simulation.id;
    appState.pendingOpenBuildingId.value = partner.building.id;
    window.history.pushState({}, '', `/simulations/${slug}/buildings`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  // -- Embassy render --

  private _renderEmbassyOverview() {
    if (this._embassyLoading) return nothing;

    const health = this._healthSummary;
    const embassies = this._embassies;
    const hasEmbassies = embassies.length > 0;

    return html`
      <div class="embassy-overview">
        <div class="embassy-overview__header">
          <span class="embassy-overview__icon">${icons.handshake(18)}</span>
          <h2 class="embassy-overview__title">${msg('Diplomatic Relations')}</h2>
          <span class="embassy-overview__subtitle">
            ${hasEmbassies
              ? msg(str`${embassies.length} ${embassies.length === 1 ? 'embassy' : 'embassies'} on file`)
              : msg('No embassies')}
          </span>
        </div>

        ${health ? this._renderEmbassyIntel(health) : nothing}

        ${hasEmbassies
          ? html`<div class="embassy-cards">
              ${embassies.map((e) => this._renderEmbassyCard(e))}
            </div>`
          : this._renderEmbassyEmpty()}
      </div>
    `;
  }

  private _renderEmbassyIntel(health: SimulationHealth) {
    const avgPct = Math.round(health.avg_embassy_effectiveness * 100);
    const avgColor = avgPct >= 60
      ? 'var(--color-success)'
      : avgPct >= 30
        ? 'var(--color-warning, var(--color-accent))'
        : 'var(--color-danger)';

    return html`
      <div class="embassy-intel">
        <div class="embassy-intel__stat">
          <span class="embassy-intel__label">${msg('Active Embassies')}</span>
          <span class="embassy-intel__value embassy-intel__value--accent">
            ${health.active_embassy_count}
          </span>
        </div>
        <div class="embassy-intel__stat">
          <span class="embassy-intel__label">${msg('Avg Effectiveness')}</span>
          <span class="embassy-intel__value" style="color: ${avgColor}">
            ${avgPct}%
          </span>
        </div>
        <div class="embassy-intel__stat">
          <span class="embassy-intel__label">${msg('Diplomatic Reach')}</span>
          <span class="embassy-intel__value">
            ${health.diplomatic_reach.toFixed(2)}
          </span>
        </div>
      </div>
    `;
  }

  private _renderEmbassyCard(embassy: Embassy) {
    const partner = this._getEmbassyPartner(embassy);
    if (!partner?.building || !partner?.simulation) return nothing;

    const eff = this._getEmbassyEffectiveness(embassy.id);
    const effPct = eff ? Math.round(eff.effectiveness * 100) : 0;
    const effLabel = eff?.effectiveness_label ?? 'unknown';
    const effColor = this._effectivenessColor(effLabel);
    const themeColor = getThemeColor(partner.simulation.theme ?? '');
    const ambassador = this._getAmbassadorName(embassy);

    const statusVariant = embassy.status === 'active'
      ? 'success'
      : embassy.status === 'suspended'
        ? 'warning'
        : 'default';

    return html`
      <div
        class="embassy-card"
        style="--embassy-theme-color: ${themeColor}"
        role="button"
        tabindex="0"
        @click=${() => this._handleEmbassyClick(embassy)}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this._handleEmbassyClick(embassy);
          }
        }}
      >
        <div class="embassy-card__header">
          <span
            class="embassy-card__sim-dot"
            style="background: ${themeColor}"
          ></span>
          <span class="embassy-card__sim-name">${partner.simulation.name}</span>
          <velg-badge variant=${statusVariant}>${humanizeEnum(embassy.status)}</velg-badge>
        </div>

        <div class="embassy-card__partner">
          ${partner.building.image_url
            ? html`<img
                class="embassy-card__thumb"
                src=${partner.building.image_url}
                alt=${partner.building.name}
                loading="lazy"
              />`
            : nothing}
          <div class="embassy-card__info">
            <div class="embassy-card__building-name">${partner.building.name}</div>
            ${partner.building.building_type
              ? html`<div class="embassy-card__building-type">${humanizeEnum(partner.building.building_type)}</div>`
              : nothing}
          </div>
        </div>

        ${eff ? html`
          <div class="embassy-card__effectiveness">
            <div class="embassy-card__eff-track">
              <div
                class="embassy-card__eff-fill"
                style="width: ${effPct}%; background: ${effColor}"
              ></div>
            </div>
            <span class="embassy-card__eff-value" style="color: ${effColor}">
              ${effPct}%
            </span>
          </div>
        ` : nothing}

        <div class="embassy-card__meta">
          ${eff ? html`<velg-badge variant=${
            effLabel === 'optimal' ? 'success'
              : effLabel === 'operational' ? 'info'
                : effLabel === 'limited' ? 'warning'
                  : 'danger'
          }>${humanizeEnum(effLabel)}</velg-badge>` : nothing}
          ${embassy.bleed_vector
            ? html`<velg-badge variant="info">${humanizeEnum(embassy.bleed_vector)}</velg-badge>`
            : nothing}
        </div>

        ${ambassador ? html`
          <div class="embassy-card__ambassador">
            <span class="embassy-card__amb-label">${msg('Ambassador')}:</span>
            ${ambassador}
          </div>
        ` : nothing}
      </div>
    `;
  }

  private _renderEmbassyEmpty() {
    return html`
      <div class="embassy-empty">
        <span class="embassy-empty__icon">${icons.handshake(32)}</span>
        <span class="embassy-empty__text">${msg('No embassies established')}</span>
        <span class="embassy-empty__hint">
          ${msg('Visit the Buildings tab to establish embassies with other simulations and boost your diplomatic reach.')}
        </span>
      </div>
    `;
  }

  // -- Render --

  private _renderControls() {
    return html`
      <div class="controls">
        <div class="controls__group">
          <label class="controls__label">${msg('Source')}</label>
          <select
            class="controls__select"
            .value=${this._source}
            @change=${(e: Event) => {
              this._source = (e.target as HTMLSelectElement).value;
            }}
          >
            <option value="guardian">${msg('The Guardian')}</option>
            <option value="newsapi">${msg('NewsAPI')}</option>
          </select>
        </div>

        ${
          this._source === 'guardian'
            ? html`
            <div class="controls__group">
              <label class="controls__label">${msg('Section')}</label>
              <select
                class="controls__select"
                .value=${this._section}
                @change=${(e: Event) => {
                  this._section = (e.target as HTMLSelectElement).value;
                }}
              >
                <option value="">${msg('All Sections')}</option>
                ${GUARDIAN_SECTIONS.map((s) => html`<option value=${s}>${s}</option>`)}
              </select>
            </div>
          `
            : nothing
        }

        <div class="controls__group">
          <label class="controls__label">${msg('Search query (optional)')}</label>
          <input
            class="controls__input"
            type="text"
            .value=${this._query}
            @input=${(e: InputEvent) => {
              this._query = (e.target as HTMLInputElement).value;
            }}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter') this._loadArticles();
            }}
            placeholder=${msg('e.g. climate, technology...')}
          />
        </div>

        <div class="controls__group">
          <label class="controls__label">${msg('Limit')}</label>
          <select
            class="controls__select"
            .value=${String(this._limit)}
            @change=${(e: Event) => {
              this._limit = Number((e.target as HTMLSelectElement).value);
            }}
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="15">15</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </div>

        <button
          class="controls__btn"
          @click=${this._loadArticles}
          ?disabled=${this._loading}
        >
          ${this._loading ? msg('Loading...') : msg('Load Articles')}
        </button>

        <button
          class="controls__btn controls__btn--toggle ${this._batchMode ? 'controls__btn--toggle-active' : ''}"
          @click=${this._handleBatchModeToggle}
          aria-pressed=${this._batchMode}
        >
          ${this._batchMode ? msg('Batch') : msg('Single')}
        </button>
      </div>
    `;
  }

  private _renderStagingRack() {
    if (!this._batchMode || this._selectedBatch.length === 0) return nothing;

    const successCount = this._batchResults?.filter((r) => r.transformation).length ?? 0;

    return html`
      <div class="staging">
        <div class="staging__header">
          <span class="staging__label">${msg('Staging Rack')}</span>
          <span class="staging__count">${this._selectedBatch.length}/${MAX_BATCH}</span>
        </div>
        <div class="staging__chips">
          ${this._selectedBatch.map(
            (article) => html`
              <div class="staging__chip" aria-label=${article.name}>
                <span class="staging__chip-title">${article.name}</span>
                <button
                  class="staging__chip-remove"
                  @click=${(e: Event) => {
                    e.stopPropagation();
                    this._handleBatchRemove(article);
                  }}
                  aria-label=${msg(str`Remove ${article.name}`)}
                >
                  \u2715
                </button>
              </div>
            `,
          )}
        </div>
        <div class="staging__actions">
          ${
            !this._batchResults
              ? html`
                <button
                  class="staging__btn staging__btn--transform"
                  @click=${this._handleBatchTransform}
                  ?disabled=${this._batchTransforming}
                >
                  ${this._batchTransforming ? msg('Transforming...') : msg('Transform All')}
                </button>
              `
              : html`
                <button
                  class="staging__btn staging__btn--integrate"
                  @click=${this._handleBatchIntegrate}
                  ?disabled=${this._batchTransforming || successCount === 0}
                >
                  ${this._batchTransforming ? msg('Integrating...') : msg(str`Integrate ${successCount} Events`)}
                </button>
              `
          }
          <button
            class="staging__btn staging__btn--clear"
            @click=${this._handleBatchClear}
            ?disabled=${this._batchTransforming}
          >
            ${msg('Clear')}
          </button>
        </div>
      </div>
    `;
  }

  private _renderBatchResults() {
    if (!this._batchResults || this._batchResults.length === 0) return nothing;

    return html`
      <div class="batch-results">
        <div class="batch-results__label">${msg('Transformation Results')}</div>
        ${this._batchResults.map((result) => {
          const hasError = !!result.error || !result.transformation;
          const t = result.transformation;
          return html`
            <div class="batch-results__item ${hasError ? 'batch-results__item--error' : ''}">
              <div class="batch-results__item-info">
                <div class="batch-results__item-title">
                  ${t?.title || result.article_name}
                </div>
                ${
                  t?.description || t?.narrative
                    ? html`<div class="batch-results__item-desc">${t.description || t.narrative}</div>`
                    : nothing
                }
                ${
                  hasError
                    ? html`<div class="batch-results__item-error">${result.error || msg('Transformation failed')}</div>`
                    : html`<div class="batch-results__item-meta">
                        ${t?.event_type || 'news'} &mdash; ${msg('impact')} ${t?.impact_level || 5}
                      </div>`
                }
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderSelectedPanel() {
    if (this._batchMode) return nothing;

    const article = this._selectedArticle;
    if (!article) return nothing;

    const abstract = this._getAbstract(article, true);
    const author = this._getAuthor(article);
    const date = this._getDate(article);
    const image = this._getImage(article);
    const section = this._getSection(article);

    return html`
      <div class="selected">
        ${
          image
            ? html`<img
                class="selected__image"
                src=${image}
                alt=${article.name}
                loading="lazy"
                @click=${(e: Event) => {
                  e.stopPropagation();
                  this._lightboxSrc = image;
                  this._lightboxAlt = article.name;
                }}
              />`
            : nothing
        }
        <div class="selected__info">
          <div class="selected__label">${msg('Selected Article')}</div>
          <h3 class="selected__title">${article.name}</h3>
          <div class="selected__meta">
            <span class="selected__platform">${article.platform}</span>
            ${section ? html`<span class="selected__section">${section}</span>` : nothing}
            ${author ? html`<span>${author}</span>` : nothing}
            ${date ? html`<span>${date}</span>` : nothing}
          </div>
          ${abstract ? html`<div class="selected__abstract">${abstract}</div>` : nothing}
        </div>
        <div class="selected__actions">
          <button class="selected__btn selected__btn--transform" @click=${this._handleTransformSelected}>
            ${msg('Transform')}
          </button>
          ${
            article.url
              ? html`<a class="selected__btn selected__btn--link" href=${article.url} target="_blank" rel="noopener">
                ${msg('Read Article')}
              </a>`
              : nothing
          }
          <button class="selected__btn selected__btn--deselect" @click=${() => {
            this._selectedArticle = null;
          }}>
            ${msg('Deselect')}
          </button>
        </div>
      </div>
    `;
  }

  private _renderArticleCard(article: BrowseArticle, index = 0) {
    const abstract = this._getAbstract(article);
    const author = this._getAuthor(article);
    const date = this._getDate(article);
    const section = this._getSection(article);
    const isDedup = this._isDedup(article);

    const isSelected = this._batchMode
      ? this._selectedBatch.includes(article)
      : this._selectedArticle === article;

    return html`
      <div
        class="article-card ${isSelected ? 'article-card--selected' : ''} ${isDedup ? 'article-card--dedup' : ''}"
        style="--i: ${index}"
        @click=${() => this._handleSelectArticle(article)}
      >
        ${
          this._batchMode
            ? html`<div class="article-card__check ${isSelected ? 'article-card__check--active' : ''}">${isSelected ? '\u2713' : ''}</div>`
            : nothing
        }
        <div class="article-card__header">
          <h3 class="article-card__title">${article.name}</h3>
        </div>
        <div class="article-card__body">
          <div class="article-card__badges">
            <velg-badge variant="primary">${article.platform}</velg-badge>
            ${section ? html`<velg-badge>${section}</velg-badge>` : nothing}
            ${isDedup ? html`<velg-badge>${msg('Already imported')}</velg-badge>` : nothing}
          </div>
          ${abstract ? html`<p class="article-card__abstract">${abstract}</p>` : nothing}
          <div class="article-card__meta">
            ${author ? html`${author}` : nothing}
            ${author && date ? html` &mdash; ` : nothing}
            ${date ? html`${date}` : nothing}
          </div>
        </div>
      </div>
    `;
  }

  protected render() {
    if (!appState.isAuthenticated.value) {
      return html`
        <div class="trends">
          <div class="trends__header">
            <h1 class="trends__title">${msg('Browse News')}</h1>
          </div>
          <div class="trends__auth-notice">
            <span class="trends__auth-notice-text">${msg('Sign in to browse and transform news articles')}</span>
          </div>
        </div>
      `;
    }

    return html`
      <div class="trends">
        ${this._renderEmbassyOverview()}

        <div class="trends__header">
          <h1 class="trends__title">${msg('Browse News')}</h1>
          ${appState.isPlatformAdmin.value
            ? html`<button class="btn--resonance" @click=${this._handleCreateResonance}
                title=${msg('Create substrate resonance from selected article')}>
                ${icons.substrateTremor(14)} ${msg('Create Resonance')}
              </button>`
            : nothing}
        </div>

        ${this._renderControls()}
        ${this._renderStagingRack()}
        ${this._renderSelectedPanel()}

        ${this._loading ? html`<velg-loading-state message=${msg('Loading articles...')}></velg-loading-state>` : nothing}
        ${this._error ? html`<velg-error-state message=${this._error} @retry=${this._loadArticles}></velg-error-state>` : nothing}

        ${
          !this._loading && !this._error && this._articles.length === 0
            ? html`<velg-empty-state
              message=${msg('No articles found')}
              actionLabel=${msg('Load Articles')}
              @action=${this._loadArticles}
            ></velg-empty-state>`
            : nothing
        }

        ${
          !this._loading && this._articles.length > 0
            ? html`
            <div class="articles__grid">
              ${this._articles.map((a, i) => this._renderArticleCard(a, i))}
            </div>
          `
            : nothing
        }

        ${this._renderBatchResults()}

        ${
          this._showTransformModal && this._selectedArticle
            ? html`
            <velg-transformation-modal
              .article=${this._selectedArticle}
              .simulationId=${this.simulationId}
              ?open=${true}
              @modal-close=${() => {
                this._showTransformModal = false;
              }}
              @transform-complete=${this._handleTransformComplete}
            ></velg-transformation-modal>
          `
            : nothing
        }

        <velg-lightbox
          .src=${this._lightboxSrc}
          .alt=${this._lightboxAlt}
          @lightbox-close=${() => {
            this._lightboxSrc = null;
          }}
        ></velg-lightbox>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-social-trends-view': VelgSocialTrendsView;
  }
}
