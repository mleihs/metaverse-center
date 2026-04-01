import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  adminApi,
  type CipherRedemptionRecord,
  type CipherStats,
  type InstagramAnalytics,
  type InstagramConnectionStatus,
  type InstagramPipelineSettings,
  type InstagramQueueItem,
  type InstagramRateLimit,
  type SocialStoryItem,
} from '../../services/api/AdminApiService.js';
import { formatDateTimeShort } from '../../utils/date-format.js';
import { icons } from '../../utils/icons.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { infoBubbleStyles, renderInfoBubble } from '../shared/info-bubble-styles.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/VelgToggle.js';
import {
  adminActionStyles,
  adminBadgeStyles,
  adminConnectionCardStyles,
  adminDispatchStyles,
  adminStatusFilterStyles,
  adminTabNavStyles,
} from './admin-shared-styles.js';

import '../shared/ConfirmDialog.js';
import '../shared/VelgMetricCard.js';

type PanelTab = 'operations' | 'configure' | 'intelligence';
type StatusFilter =
  | 'all'
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'rejected';

const STATUS_COLORS: Record<string, string> = {
  draft: 'info',
  scheduled: 'warning',
  publishing: 'warning',
  published: 'success',
  failed: 'danger',
  rejected: 'danger',
};

const CONTENT_TYPE_ICONS: Record<string, string> = {
  agent: 'operativeSpy',
  building: 'building',
  chronicle: 'newspaper',
  lore: 'book',
};

const STORY_STATUS_COLORS: Record<string, string> = {
  pending: 'info',
  composing: 'warning',
  ready: 'warning',
  publishing: 'warning',
  published: 'success',
  failed: 'danger',
  skipped: 'muted',
};

const ARCHETYPE_HEX: Record<string, string> = {
  'The Tower': '#FF3333',
  'The Shadow': '#7744AA',
  'The Devouring Mother': '#33AA66',
  'The Deluge': '#2266CC',
  'The Overthrow': '#FF8800',
  'The Prometheus': '#FFCC00',
  'The Awakening': '#CC88FF',
  'The Entropy': '#666666',
};

const STORY_TYPE_LABELS: Record<string, string> = {
  detection: 'DETECT',
  classification: 'CLASSIFY',
  impact: 'IMPACT',
  advisory: 'ADVISORY',
  subsiding: 'SUBSIDE',
};

type StoryStatusFilter = 'all' | 'pending' | 'ready' | 'published' | 'failed' | 'skipped';

const DIFFICULTY_OPTIONS = ['easy', 'medium', 'hard'] as const;
const HINT_FORMAT_OPTIONS = ['footer', 'caption', 'steganographic'] as const;

/** Parsed pipeline config with typed defaults. */
interface PipelineConfig {
  cipher_enabled: boolean;
  cipher_difficulty: string;
  cipher_hint_format: string;
  content_mix: Record<string, number>;
  auto_schedule: boolean;
  schedule_interval_hours: number;
  blocklist: string[];
  trending_tags: string[];
}

const DEFAULT_CONFIG: PipelineConfig = {
  cipher_enabled: false,
  cipher_difficulty: 'medium',
  cipher_hint_format: 'footer',
  content_mix: { agent: 3, building: 2, chronicle: 2, lore: 1 },
  auto_schedule: false,
  schedule_interval_hours: 6,
  blocklist: [],
  trending_tags: [],
};

@localized()
@customElement('velg-admin-instagram-tab')
export class VelgAdminInstagramTab extends LitElement {
  static styles = [
    infoBubbleStyles,
    adminConnectionCardStyles,
    adminTabNavStyles,
    adminStatusFilterStyles,
    adminDispatchStyles,
    adminBadgeStyles,
    adminActionStyles,
    css`
    :host {
      display: block;
      color: var(--color-text-primary);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
    }

    /* ══════════════════════════════════════════════════════
       SCIF HEADER — Classification bar + operational title
       ══════════════════════════════════════════════════════ */

    .scif-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      margin-bottom: var(--space-4);
      padding-bottom: var(--space-4);
      border-bottom: 1px solid var(--color-border);
      position: relative;
    }

    .scif-header::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      width: 120px;
      height: 1px;
      background: var(--color-primary);
    }

    .scif-header__ident {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .scif-header__classification {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--color-primary);
    }

    .scif-header__classification::before {
      content: '';
      width: 6px;
      height: 6px;
      background: var(--color-primary);
      animation: scif-pulse 2.5s ease-in-out infinite;
    }

    @keyframes scif-pulse {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 1; }
    }

    .scif-header__title {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-primary);
    }

    .scif-header__title svg {
      color: var(--color-primary);
    }

    .scif-header__actions {
      display: flex;
      gap: var(--space-2);
      align-items: center;
    }

    /* ══════════════════════════════════════════════════════
       GENERATE BUTTON — Primary CTA with sweep animation
       ══════════════════════════════════════════════════════ */

    .btn-generate {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));
      color: var(--color-primary);
      border: 1px solid color-mix(in srgb, var(--color-primary) 40%, transparent);
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
    }

    .btn-generate::before {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        90deg,
        transparent,
        transparent 3px,
        color-mix(in srgb, var(--color-primary) 4%, transparent) 3px,
        color-mix(in srgb, var(--color-primary) 4%, transparent) 4px
      );
      pointer-events: none;
    }

    .btn-generate:hover {
      background: color-mix(in srgb, var(--color-primary) 18%, var(--color-surface));
      border-color: var(--color-primary);
      transform: translateY(-1px);
      box-shadow: 0 2px 12px color-mix(in srgb, var(--color-primary) 15%, transparent);
    }

    .btn-generate:disabled {
      cursor: not-allowed;
      pointer-events: none;
    }

    .btn-generate--generating {
      animation: generate-pulse 1.5s ease-in-out infinite;
    }

    .btn-generate--generating::after {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        90deg,
        transparent,
        color-mix(in srgb, var(--color-primary) 15%, transparent),
        transparent
      );
      animation: generate-sweep 1.8s ease-in-out infinite;
    }

    @keyframes generate-pulse {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1; }
    }

    @keyframes generate-sweep {
      0% { left: -100%; }
      100% { left: 100%; }
    }

    /* ══════════════════════════════════════════════════════
       TAB NAVIGATION — Instagram-specific overrides
       ══════════════════════════════════════════════════════ */

    .tab-bar {
      position: relative;
    }

    .tab-bar::before {
      content: 'SELECT CLASSIFICATION VIEW';
      position: absolute;
      top: -16px;
      left: 0;
      font-family: var(--font-brutalist);
      font-size: 7px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: var(--color-text-muted);
    }

    /* ══════════════════════════════════════════════════════
       INTEL READOUT — Grid + quota gauge
       ══════════════════════════════════════════════════════ */

    .intel-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: var(--space-3);
      margin-bottom: var(--space-6);
    }

    /* Quota card wrapper — allows gauge below metric card in grid cell */
    .quota-card-wrapper {
      display: flex;
      flex-direction: column;
    }

    .quota-card-wrapper velg-metric-card {
      flex: 1;
    }

    /* Quota gauge */
    .quota-gauge {
      margin-top: var(--space-2);
      padding: 0 var(--space-4);
    }

    .quota-gauge__track {
      width: 100%;
      height: 4px;
      background: var(--color-border);
      position: relative;
      overflow: hidden;
    }

    .quota-gauge__fill {
      height: 100%;
      transition: width 0.6s ease;
    }

    .quota-gauge__fill--ok { background: var(--color-success); }
    .quota-gauge__fill--warn { background: var(--color-warning); }
    .quota-gauge__fill--critical { background: var(--color-danger); }

    .quota-gauge__labels {
      display: flex;
      justify-content: space-between;
      font-size: 7px;
      color: var(--color-text-muted);
      margin-top: 2px;
    }

    /* ══════════════════════════════════════════════════════
       QUEUE SECTION — Dispatch management
       ══════════════════════════════════════════════════════ */

    .queue-section {
      margin-bottom: var(--space-6);
    }

    .queue-header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }

    .queue-header__marker {
      width: 3px;
      height: 16px;
      background: var(--color-primary);
    }

    .queue-header__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-primary);
    }

    /* Instagram-specific: status bar has bottom border */
    .status-bar {
      padding-bottom: var(--space-3);
      border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
    }

    /* Instagram-specific: dispatch card has background */
    .dispatch {
      background: var(--color-surface);
    }

    /* ══════════════════════════════════════════════════════
       STORIES SECTION — Resonance broadcast log
       ══════════════════════════════════════════════════════ */

    .stories-section {
      margin-bottom: var(--space-6);
    }

    .stories-header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }

    .stories-header__marker {
      width: 3px;
      height: 16px;
      background: var(--color-warning);
    }

    .stories-header__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-primary);
    }

    .stories-header__count {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin-left: auto;
    }

    .story-filter-bar {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      margin-bottom: var(--space-4);
      padding-bottom: var(--space-3);
      border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
      flex-wrap: wrap;
    }

    .seq-accordion {
      margin-bottom: var(--space-3);
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      overflow: hidden;
      position: relative;
    }

    .seq-accordion::before {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        color-mix(in srgb, var(--color-text-primary) 1%, transparent) 3px,
        color-mix(in srgb, var(--color-text-primary) 1%, transparent) 4px
      );
      pointer-events: none;
    }

    .seq-header {
      appearance: none;
      font: inherit;
      text-align: start;
      background: none;
      border: none;
      color: inherit;
      width: 100%;
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      cursor: pointer;
      transition: background 0.15s ease;
      position: relative;
      z-index: 1;
      border-left: 4px solid var(--_seq-accent, var(--color-border));
    }

    .seq-header:hover {
      background: color-mix(in srgb, var(--_seq-accent, var(--color-primary)) 5%, transparent);
    }

    .seq-header__chevron {
      color: var(--color-text-muted);
      transition: transform 0.2s ease;
      flex-shrink: 0;
    }

    .seq-header__chevron--open {
      transform: rotate(90deg);
    }

    .seq-header__archetype {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--_seq-accent, var(--color-primary));
    }

    .seq-header__mag {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .seq-mag-bar {
      width: 60px;
      height: 6px;
      background: var(--color-border);
      position: relative;
      overflow: hidden;
    }

    .seq-mag-bar__fill {
      height: 100%;
      background: var(--_seq-accent, var(--color-primary));
      transition: width 0.4s ease;
    }

    .seq-header__summary {
      margin-left: auto;
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-muted);
    }

    .seq-body {
      padding: 0 var(--space-4) var(--space-3);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      position: relative;
      z-index: 1;
      border-left: 4px solid color-mix(in srgb, var(--_seq-accent, var(--color-border)) 30%, transparent);
    }

    .story-card {
      display: flex;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
      background: color-mix(in srgb, var(--color-bg) 40%, transparent);
      transition: border-color 0.15s ease;
    }

    .story-card:hover {
      border-color: var(--color-border);
    }

    .story-card__thumb {
      width: 40px;
      height: 72px;
      flex-shrink: 0;
      overflow: hidden;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
    }

    .story-card__thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .story-card__thumb--empty {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 7px;
      color: var(--color-text-muted);
    }

    .story-card__body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .story-card__header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .story-card__type {
      font-family: var(--font-brutalist);
      font-size: 8px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 1px var(--space-1-5);
      background: color-mix(in srgb, var(--_seq-accent, var(--color-primary)) 15%, transparent);
      color: var(--_seq-accent, var(--color-primary));
    }

    .story-card__seq {
      font-family: var(--font-mono);
      font-size: 8px;
      color: var(--color-text-muted);
    }

    .story-card__time {
      font-size: 9px;
      color: var(--color-text-muted);
      margin-left: auto;
    }

    .story-card__caption {
      font-size: 10px;
      color: var(--color-text-secondary);
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
    }

    .story-card__failure {
      font-size: 9px;
      color: var(--color-danger);
    }

    .story-card__actions {
      display: flex;
      flex-direction: column;
      gap: 2px;
      align-self: center;
      flex-shrink: 0;
    }

    .story-empty {
      padding: var(--space-6) var(--space-4);
      text-align: center;
      color: var(--color-text-muted);
      font-size: var(--text-sm);
    }

    /* ══════════════════════════════════════════════════════
       CONFIGURATION PANEL — Pipeline settings
       ══════════════════════════════════════════════════════ */

    .config-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-4);
      margin-bottom: var(--space-5);
    }

    .config-card {
      position: relative;
      padding: var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      overflow: hidden;
    }

    .config-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--color-primary);
      opacity: 0.4;
    }

    .config-card::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        color-mix(in srgb, var(--color-text-primary) 1%, transparent) 3px,
        color-mix(in srgb, var(--color-text-primary) 1%, transparent) 4px
      );
      pointer-events: none;
    }

    .config-card--full {
      grid-column: 1 / -1;
    }

    .config-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
      padding-bottom: var(--space-3);
      border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
    }

    .config-card__title {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-primary);
    }

    .config-card__title svg {
      color: var(--color-primary);
    }

    .config-card__status {
      font-family: var(--font-brutalist);
      font-size: 8px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 2px var(--space-2);
    }

    .config-card__status--active {
      background: var(--color-success-bg);
      color: var(--color-success);
    }

    .config-card__status--inactive {
      background: color-mix(in srgb, var(--color-text-muted) 10%, transparent);
      color: var(--color-text-muted);
    }

    /* Config rows */
    .config-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-2) 0;
      position: relative;
      z-index: 1;
    }

    .config-row + .config-row {
      border-top: 1px solid color-mix(in srgb, var(--color-border) 30%, transparent);
    }

    .config-row--disabled {
      opacity: 0.35;
      pointer-events: none;
    }

    .config-row__label {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .config-row__name {
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-primary);
    }

    .config-row__desc {
      font-size: 9px;
      color: var(--color-text-muted);
      max-width: 280px;
    }

    /* ══════════════════════════════════════════════════════
       SEGMENTED CONTROL — Classification level selector
       ══════════════════════════════════════════════════════ */

    .segmented {
      display: inline-flex;
      border: 1px solid var(--color-border);
      overflow: hidden;
      position: relative;
      z-index: 1;
    }

    .segmented__option {
      padding: var(--space-1) var(--space-3);
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-muted);
      background: none;
      border: none;
      border-right: 1px solid var(--color-border);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .segmented__option:last-child {
      border-right: none;
    }

    .segmented__option:hover {
      background: color-mix(in srgb, var(--color-primary) 6%, transparent);
      color: var(--color-text-secondary);
    }

    .segmented__option--active {
      background: color-mix(in srgb, var(--color-primary) 15%, var(--color-surface));
      color: var(--color-primary);
    }

    /* ══════════════════════════════════════════════════════
       CONTENT MIX — Weight bars
       ══════════════════════════════════════════════════════ */

    .mix-rows {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      position: relative;
      z-index: 1;
    }

    .mix-row {
      display: grid;
      grid-template-columns: 100px 1fr 44px 44px;
      gap: var(--space-3);
      align-items: center;
    }

    .mix-row__type {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-primary);
    }

    .mix-row__type svg {
      color: var(--color-primary);
    }

    .mix-row__bar-container {
      height: 14px;
      background: color-mix(in srgb, var(--color-border) 40%, transparent);
      position: relative;
      overflow: hidden;
    }

    .mix-row__bar-fill {
      height: 100%;
      background: color-mix(in srgb, var(--color-primary) 40%, transparent);
      transition: width 0.3s ease;
      position: relative;
    }

    .mix-row__bar-fill::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        90deg,
        transparent,
        transparent 2px,
        color-mix(in srgb, var(--color-primary) 10%, transparent) 2px,
        color-mix(in srgb, var(--color-primary) 10%, transparent) 3px
      );
    }

    .mix-row__weight {
      width: 44px;
      padding: 2px var(--space-2);
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: var(--font-bold);
      text-align: center;
      color: var(--color-text-primary);
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      transition: border-color 0.15s ease;
    }

    .mix-row__weight:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 20%, transparent);
    }

    .mix-row__pct {
      font-family: var(--font-mono);
      font-size: 9px;
      color: var(--color-text-muted);
      text-align: right;
    }

    /* ══════════════════════════════════════════════════════
       NUMBER INPUT — Styled inline field
       ══════════════════════════════════════════════════════ */

    .num-input {
      display: inline-flex;
      align-items: center;
      gap: 0;
      border: 1px solid var(--color-border);
      position: relative;
      z-index: 1;
    }

    .num-input__field {
      width: 48px;
      padding: var(--space-1) var(--space-2);
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: var(--font-bold);
      text-align: center;
      color: var(--color-text-primary);
      background: var(--color-bg);
      border: none;
    }

    .num-input__field:focus {
      outline: none;
    }

    .num-input:focus-within {
      border-color: var(--color-primary);
    }

    .num-input__unit {
      padding: var(--space-1) var(--space-2);
      font-family: var(--font-brutalist);
      font-size: 8px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-muted);
      background: color-mix(in srgb, var(--color-border) 30%, transparent);
      border-left: 1px solid var(--color-border);
    }

    /* ══════════════════════════════════════════════════════
       BLOCKLIST — Textarea editor
       ══════════════════════════════════════════════════════ */

    .blocklist-editor {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      position: relative;
      z-index: 1;
    }

    .blocklist-editor__input {
      width: 100%;
      min-height: 80px;
      padding: var(--space-2);
      font-family: var(--font-mono);
      font-size: 10px;
      line-height: 1.6;
      color: var(--color-text-primary);
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      resize: vertical;
    }

    .blocklist-editor__input:focus {
      outline: none;
      border-color: var(--color-primary);
    }

    .blocklist-editor__hint {
      font-size: 8px;
      color: var(--color-text-muted);
      letter-spacing: 0.02em;
    }

    .blocklist-editor__actions {
      display: flex;
      justify-content: flex-end;
    }

    /* ══════════════════════════════════════════════════════
       CIPHER OPERATIONS — Stats + redemption table
       ══════════════════════════════════════════════════════ */

    .cipher-section {
      margin-top: var(--space-4);
    }

    .cipher-section__grid {
      grid-template-columns: repeat(3, 1fr);
    }

    .cipher-table__header,
    .cipher-table__row {
      display: grid;
      grid-template-columns: 1fr 100px 120px;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      font-size: 10px;
      align-items: center;
    }

    .cipher-table__header {
      font-family: var(--font-brutalist);
      font-size: 8px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-muted);
      border-bottom: 1px solid var(--color-border);
    }

    .cipher-table__row {
      border-bottom: 1px solid color-mix(in srgb, var(--color-border) 40%, transparent);
      color: var(--color-text-secondary);
    }

    .cipher-table__row:last-child {
      border-bottom: none;
    }

    /* ══════════════════════════════════════════════════════
       EMPTY + LOADING + ERROR STATES
       ══════════════════════════════════════════════════════ */

    .empty-state {
      padding: var(--space-6);
      text-align: center;
      color: var(--color-text-muted);
      font-size: 11px;
    }

    .empty-state__hint {
      font-size: 9px;
      margin-top: var(--space-2);
      opacity: 0.6;
    }

    .loading-state {
      padding: var(--space-6);
      text-align: center;
      color: var(--color-text-muted);
      font-size: 11px;
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      margin-bottom: var(--space-4);
      background: color-mix(in srgb, var(--color-danger) 8%, var(--color-surface));
      border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
      color: var(--color-danger);
      font-size: 11px;
    }

    /* ══════════════════════════════════════════════════════
       REJECT MODAL — Overlay dialog
       ══════════════════════════════════════════════════════ */

    .reject-overlay {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: color-mix(in srgb, var(--color-bg) 80%, transparent);
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
    }

    .reject-modal {
      width: 420px;
      max-width: 90vw;
      padding: var(--space-5);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      box-shadow: 0 8px 32px color-mix(in srgb, var(--color-bg) 60%, transparent);
    }

    .reject-modal__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: var(--space-2);
    }

    .reject-modal__sub {
      font-size: 10px;
      color: var(--color-text-muted);
      margin-bottom: var(--space-4);
    }

    .reject-modal__input {
      width: 100%;
      min-height: 80px;
      padding: var(--space-2);
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--color-text-primary);
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      resize: vertical;
      margin-bottom: var(--space-3);
    }

    .reject-modal__input:focus {
      outline: none;
      border-color: var(--color-primary);
    }

    .reject-modal__actions {
      display: flex;
      gap: var(--space-2);
      justify-content: flex-end;
    }

    /* ══════════════════════════════════════════════════════
       SAVING INDICATOR
       ══════════════════════════════════════════════════════ */

    .saving-indicator {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-family: var(--font-brutalist);
      font-size: 8px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-warning);
      animation: save-pulse 1s ease-in-out infinite;
    }

    @keyframes save-pulse {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }

    /* ══════════════════════════════════════════════════════
       RESPONSIVE — Collapse grids on narrow viewports
       ══════════════════════════════════════════════════════ */

    @media (max-width: 1100px) {
      .intel-grid {
        grid-template-columns: repeat(3, 1fr);
      }
      .config-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .intel-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      .cipher-section__grid {
        grid-template-columns: repeat(2, 1fr);
      }
      .scif-header {
        flex-direction: column;
        align-items: flex-start;
      }
      .dispatch {
        flex-direction: column;
      }
      .dispatch__thumb {
        width: 100%;
        height: 120px;
      }
      .dispatch__actions {
        flex-direction: row;
        flex-wrap: wrap;
      }
      .tab-bar {
        overflow-x: auto;
      }
      .mix-row {
        grid-template-columns: 80px 1fr 38px 38px;
        gap: var(--space-2);
      }
    }
  `,
  ];

  // ══════════════════════════════════════════════════════
  // STATE
  // ══════════════════════════════════════════════════════

  @state() private _activeTab: PanelTab = 'operations';
  @state() private _queue: InstagramQueueItem[] = [];
  @state() private _analytics: InstagramAnalytics | null = null;
  @state() private _rateLimit: InstagramRateLimit | null = null;
  @state() private _cipherStats: CipherStats | null = null;
  @state() private _statusFilter: StatusFilter = 'all';
  @state() private _loading = true;
  @state() private _generating = false;
  @state() private _error: string | null = null;
  @state() private _actionInProgress: string | null = null;
  @state() private _rejectTarget: InstagramQueueItem | null = null;
  @state() private _rejectReason = '';
  @state() private _config: PipelineConfig = { ...DEFAULT_CONFIG };
  @state() private _savingKey: string | null = null;
  @state() private _blocklistDraft = '';
  @state() private _trendingDraft = '';
  @state() private _connectionStatus: InstagramConnectionStatus | null = null;
  @state() private _testingConnection = false;
  @state() private _stories: SocialStoryItem[] = [];
  @state() private _storyFilter: StoryStatusFilter = 'all';
  @state() private _expandedSequences: Set<string> = new Set();
  @state() private _storyActionInProgress: string | null = null;

  // ══════════════════════════════════════════════════════
  // LIFECYCLE
  // ══════════════════════════════════════════════════════

  connectedCallback(): void {
    super.connectedCallback();
    this._loadAll();
  }

  // ══════════════════════════════════════════════════════
  // DATA LOADING
  // ══════════════════════════════════════════════════════

  private async _loadAll(): Promise<void> {
    this._loading = true;
    this._error = null;

    try {
      const [
        queueResp,
        analyticsResp,
        rateLimitResp,
        cipherResp,
        settingsResp,
        statusResp,
        storiesResp,
      ] = await Promise.all([
        adminApi.listInstagramQueue({ limit: '100' }),
        adminApi.getInstagramAnalytics(30),
        adminApi.getInstagramRateLimit(),
        adminApi.getInstagramCipherStats(),
        adminApi.getInstagramSettings(),
        adminApi.getInstagramStatus(),
        adminApi.listSocialStories({ limit: '50' }),
      ]);

      if (queueResp.success && queueResp.data) {
        this._queue = queueResp.data;
      }
      if (analyticsResp.success && analyticsResp.data) {
        this._analytics = analyticsResp.data;
      }
      if (rateLimitResp.success && rateLimitResp.data) {
        this._rateLimit = rateLimitResp.data;
      }
      if (cipherResp.success && cipherResp.data) {
        this._cipherStats = cipherResp.data;
      }
      if (settingsResp.success && settingsResp.data) {
        this._parseSettings(settingsResp.data);
      }
      if (statusResp.success && statusResp.data) {
        this._connectionStatus = statusResp.data;
      }
      if (storiesResp.success && storiesResp.data) {
        this._stories = storiesResp.data;
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('Failed to load Instagram data');
    } finally {
      this._loading = false;
    }
  }

  private _parseSettings(raw: InstagramPipelineSettings): void {
    const val = (key: string) => raw[key]?.value ?? '';

    const enabled = val('instagram_cipher_enabled').toLowerCase();
    this._config = {
      cipher_enabled: enabled === 'true' || enabled === '1' || enabled === 'yes',
      cipher_difficulty: val('instagram_cipher_difficulty') || 'medium',
      cipher_hint_format: val('instagram_cipher_hint_format') || 'footer',
      content_mix: this._parseJson(val('instagram_content_mix'), DEFAULT_CONFIG.content_mix),
      auto_schedule: val('instagram_auto_schedule').toLowerCase() === 'true',
      schedule_interval_hours: parseInt(val('instagram_schedule_interval_hours'), 10) || 6,
      blocklist: this._parseJson(val('instagram_blocklist'), []),
      trending_tags: this._parseJson(val('instagram_trending_tags'), []),
    };
    this._blocklistDraft = (this._config.blocklist ?? []).join('\n');
    this._trendingDraft = (this._config.trending_tags ?? []).join('\n');
  }

  private _parseJson<T>(raw: string, fallback: T): T {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  // ══════════════════════════════════════════════════════
  // COMPUTED
  // ══════════════════════════════════════════════════════

  private get _filteredQueue(): InstagramQueueItem[] {
    if (this._statusFilter === 'all') return this._queue;
    return this._queue.filter((p) => p.status === this._statusFilter);
  }

  private _statusCount(status: string): number {
    return this._queue.filter((p) => p.status === status).length;
  }

  private get _actionableCount(): number {
    return this._statusCount('draft') + this._statusCount('scheduled');
  }

  private get _mixTotal(): number {
    return Object.values(this._config.content_mix).reduce((s, w) => s + w, 0);
  }

  // ══════════════════════════════════════════════════════
  // SETTINGS ACTIONS
  // ══════════════════════════════════════════════════════

  private async _saveSetting(key: string, value: string | number): Promise<void> {
    this._savingKey = key;
    try {
      const resp = await adminApi.updateSetting(key, value);
      if (resp.success) {
        VelgToast.success(msg(str`Setting updated: ${key.replace('instagram_', '')}`));
      } else {
        VelgToast.error(resp.error?.message ?? msg('Failed to save setting'));
      }
    } catch {
      VelgToast.error(msg('Failed to save setting'));
    } finally {
      this._savingKey = null;
    }
  }

  private _handleToggle(key: string, current: boolean): void {
    const newVal = !current;
    if (key === 'instagram_cipher_enabled') {
      this._config = { ...this._config, cipher_enabled: newVal };
    } else if (key === 'instagram_auto_schedule') {
      this._config = { ...this._config, auto_schedule: newVal };
    }
    void this._saveSetting(key, newVal ? 'true' : 'false');
  }

  private _handleSegmented(key: string, value: string): void {
    if (key === 'instagram_cipher_difficulty') {
      this._config = { ...this._config, cipher_difficulty: value };
    } else if (key === 'instagram_cipher_hint_format') {
      this._config = { ...this._config, cipher_hint_format: value };
    }
    void this._saveSetting(key, value);
  }

  private _handleMixChange(type: string, rawValue: string): void {
    const weight = Math.max(0, Math.min(10, parseInt(rawValue, 10) || 0));
    const newMix = { ...this._config.content_mix, [type]: weight };
    this._config = { ...this._config, content_mix: newMix };
    void this._saveSetting('instagram_content_mix', JSON.stringify(newMix));
  }

  private _handleIntervalChange(rawValue: string): void {
    const hours = Math.max(1, Math.min(168, parseInt(rawValue, 10) || 6));
    this._config = { ...this._config, schedule_interval_hours: hours };
    void this._saveSetting('instagram_schedule_interval_hours', String(hours));
  }

  private _handleBlocklistSave(): void {
    const terms = this._blocklistDraft
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    this._config = { ...this._config, blocklist: terms };
    void this._saveSetting('instagram_blocklist', JSON.stringify(terms));
  }

  private _handleTrendingSave(): void {
    const tags = this._trendingDraft
      .split('\n')
      .map((l) => (l.trim().startsWith('#') ? l.trim() : l.trim() ? `#${l.trim()}` : ''))
      .filter(Boolean);
    this._config = { ...this._config, trending_tags: tags };
    void this._saveSetting('instagram_trending_tags', JSON.stringify(tags));
  }

  // ══════════════════════════════════════════════════════
  // CONNECTION TEST
  // ══════════════════════════════════════════════════════

  private async _handleTestConnection(): Promise<void> {
    this._testingConnection = true;
    try {
      const resp = await adminApi.getInstagramStatus();
      if (resp.success && resp.data) {
        this._connectionStatus = resp.data;
        if (resp.data.authenticated) {
          VelgToast.success(msg('Instagram connection verified.'));
        } else if (resp.data.configured) {
          VelgToast.error(msg('Authentication failed – check access token.'));
        } else {
          VelgToast.error(msg('Instagram credentials not configured.'));
        }
      }
    } catch {
      VelgToast.error(msg('Connection test failed'));
    } finally {
      this._testingConnection = false;
    }
  }

  // ══════════════════════════════════════════════════════
  // QUEUE ACTIONS
  // ══════════════════════════════════════════════════════

  private async _handleGenerate(): Promise<void> {
    this._generating = true;
    try {
      const resp = await adminApi.generateInstagramContent({ count: 3 });
      if (resp.success && resp.data) {
        VelgToast.success(msg(str`Generated ${resp.data.length} draft(s)`));
        await this._loadAll();
      } else {
        VelgToast.error(resp.error?.message ?? msg('Generation failed'));
      }
    } catch {
      VelgToast.error(msg('An error occurred'));
    } finally {
      this._generating = false;
    }
  }

  private async _handleApprove(post: InstagramQueueItem): Promise<void> {
    this._actionInProgress = post.id;
    try {
      const resp = await adminApi.approveInstagramPost(post.id);
      if (resp.success) {
        VelgToast.success(msg('Post approved and scheduled.'));
        await this._loadAll();
      } else {
        VelgToast.error(resp.error?.message ?? msg('Approval failed'));
      }
    } catch {
      VelgToast.error(msg('An error occurred'));
    } finally {
      this._actionInProgress = null;
    }
  }

  private _openRejectModal(post: InstagramQueueItem): void {
    this._rejectTarget = post;
    this._rejectReason = '';
  }

  private _closeRejectModal(): void {
    this._rejectTarget = null;
    this._rejectReason = '';
  }

  private async _handleReject(): Promise<void> {
    if (!this._rejectTarget || !this._rejectReason.trim()) return;

    this._actionInProgress = this._rejectTarget.id;
    try {
      const resp = await adminApi.rejectInstagramPost(
        this._rejectTarget.id,
        this._rejectReason.trim(),
      );
      if (resp.success) {
        VelgToast.success(msg('Post rejected.'));
        this._closeRejectModal();
        await this._loadAll();
      } else {
        VelgToast.error(resp.error?.message ?? msg('Rejection failed'));
      }
    } catch {
      VelgToast.error(msg('An error occurred'));
    } finally {
      this._actionInProgress = null;
    }
  }

  private async _handleForcePublish(post: InstagramQueueItem): Promise<void> {
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Force Publish'),
      message: msg(str`Publish this ${post.content_source_type} post to Instagram immediately?`),
      confirmLabel: msg('Publish Now'),
    });
    if (!confirmed) return;

    this._actionInProgress = post.id;
    try {
      const resp = await adminApi.forcePublishInstagramPost(post.id);
      if (resp.success) {
        VelgToast.success(msg('Post published to Instagram.'));
        await this._loadAll();
      } else {
        VelgToast.error(resp.error?.message ?? msg('Publishing failed'));
      }
    } catch {
      VelgToast.error(msg('An error occurred'));
    } finally {
      this._actionInProgress = null;
    }
  }

  // ══════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════

  private _formatNumber(n: number | null | undefined): string {
    if (n == null) return '0';
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  }

  private _quotaLevel(usage: number, total: number): string {
    const pct = usage / total;
    if (pct >= 0.8) return 'critical';
    if (pct >= 0.5) return 'warn';
    return 'ok';
  }

  private _getTypeIcon(type: string) {
    const name = CONTENT_TYPE_ICONS[type];
    if (!name) return nothing;
    const fn = icons[name as keyof typeof icons] as ((size?: number) => unknown) | undefined;
    return typeof fn === 'function' ? fn(12) : nothing;
  }

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════

  protected render() {
    return html`
      ${
        this._error
          ? html`
        <div class="error-banner">
          ${icons.alertTriangle(14)} ${this._error}
        </div>
      `
          : nothing
      }

      ${this._renderHeader()}
      ${this._renderConnectionStatus()}
      ${this._renderTabBar()}

      ${this._activeTab === 'operations' ? this._renderOperationsTab() : nothing}
      ${this._activeTab === 'configure' ? this._renderConfigureTab() : nothing}
      ${this._activeTab === 'intelligence' ? this._renderIntelligenceTab() : nothing}

      ${this._rejectTarget ? this._renderRejectModal() : nothing}
    `;
  }

  private _renderHeader() {
    return html`
      <div class="scif-header">
        <div class="scif-header__ident">
          <div class="scif-header__classification">
            ${msg('Shard-IG Operations Control')}
          </div>
          <div class="scif-header__title">
            ${icons.antenna(18)}
            ${msg('Instagram Pipeline')}
          </div>
        </div>
        <div class="scif-header__actions">
          <button
            class="btn-generate ${this._generating ? 'btn-generate--generating' : ''}"
            ?disabled=${this._generating}
            @click=${this._handleGenerate}
          >
            ${icons.plus(12)}
            ${this._generating ? msg('Scanning Bureau dispatch channels...') : msg('Generate Dispatches')}
          </button>
        </div>
      </div>
    `;
  }

  private _renderConnectionStatus() {
    const cs = this._connectionStatus;
    const indicatorClass = cs?.authenticated
      ? 'connection-card__indicator--ok'
      : cs?.configured
        ? 'connection-card__indicator--error'
        : 'connection-card__indicator--unconfigured';

    const statusLabel = cs?.authenticated
      ? msg('Authenticated')
      : cs?.configured
        ? msg('Auth Failed')
        : msg('Not Configured');

    const statusClass = cs?.authenticated
      ? 'connection-card__status--ok'
      : cs?.configured
        ? 'connection-card__status--error'
        : 'connection-card__status--unconfigured';

    return html`
      <div class="connection-card">
        <div class="connection-card__indicator ${indicatorClass}"></div>
        <div class="connection-card__info">
          <div class="connection-card__handle">
            ${cs?.ig_user_id ? `IG User: ${cs.ig_user_id}` : msg('No credentials configured')}
          </div>
          <div class="connection-card__detail">${msg('Meta Graph API')}</div>
        </div>
        <span class="connection-card__status ${statusClass}">${statusLabel}</span>
        <button
          class="btn-test"
          ?disabled=${this._testingConnection}
          @click=${this._handleTestConnection}
        >
          ${this._testingConnection ? msg('Testing...') : msg('Test')}
        </button>
      </div>
    `;
  }

  private _renderTabBar() {
    const tabs: {
      key: PanelTab;
      label: string;
      icon: ReturnType<typeof icons.antenna>;
      badge?: unknown;
    }[] = [
      {
        key: 'operations',
        label: msg('Operations'),
        icon: icons.antenna(13),
        badge:
          this._actionableCount > 0
            ? html`<span class="tab__badge">${this._actionableCount}</span>`
            : nothing,
      },
      {
        key: 'configure',
        label: msg('Configuration'),
        icon: icons.gear(13),
        badge: this._config.cipher_enabled
          ? html`<span class="tab__badge tab__badge--active">${msg('LIVE')}</span>`
          : nothing,
      },
      {
        key: 'intelligence',
        label: msg('Intelligence'),
        icon: icons.radar(13),
      },
    ];

    return html`
      <div class="tab-bar">
        ${tabs.map(
          (t) => html`
          <button
            class="tab ${this._activeTab === t.key ? 'tab--active' : ''}"
            @click=${() => {
              this._activeTab = t.key;
            }}
          >
            ${t.icon}
            ${t.label}
            ${t.badge ?? nothing}
          </button>
        `,
        )}
      </div>
    `;
  }

  // ── Operations Tab ─────────────────────────────────────

  private _renderOperationsTab() {
    return html`
      <div class="queue-section">
        ${this._renderQueueHeader()}
        ${this._renderStatusBar()}
        ${
          this._loading
            ? html`<div class="loading-state">${msg('Scanning Bureau dispatch channels...')}</div>`
            : this._renderDispatchList()
        }
      </div>
      ${this._renderStoriesSection()}
    `;
  }

  private _renderQueueHeader() {
    return html`
      <div class="queue-header">
        <div class="queue-header__marker"></div>
        <div class="queue-header__title">${msg('Dispatch Queue')}</div>
      </div>
    `;
  }

  private _renderStatusBar() {
    const tabs: { key: StatusFilter; label: string }[] = [
      { key: 'all', label: msg('All') },
      { key: 'draft', label: msg('Draft') },
      { key: 'scheduled', label: msg('Scheduled') },
      { key: 'published', label: msg('Published') },
      { key: 'failed', label: msg('Failed') },
      { key: 'rejected', label: msg('Rejected') },
    ];

    return html`
      <div class="status-bar">
        ${tabs.map(
          (t) => html`
          <button
            class="status-tab ${this._statusFilter === t.key ? 'status-tab--active' : ''}"
            @click=${() => {
              this._statusFilter = t.key;
            }}
          >
            ${t.key === 'all' ? msg('All') : t.label}
            <span class="status-tab__count">${t.key === 'all' ? this._queue.length : this._statusCount(t.key)}</span>
          </button>
        `,
        )}
        <span class="queue-total">
          ${msg(str`${this._filteredQueue.length} dispatches`)}
        </span>
      </div>
    `;
  }

  private _renderDispatchList() {
    const posts = this._filteredQueue;
    if (posts.length === 0) {
      return html`
        <div class="empty-state">
          ${msg('No dispatches found in this classification.')}
          <div class="empty-state__hint">${msg('Generate content to populate the pipeline.')}</div>
        </div>
      `;
    }

    return html`
      <div class="dispatch-list">
        ${posts.map((p) => this._renderDispatch(p))}
      </div>
    `;
  }

  private _renderDispatch(post: InstagramQueueItem) {
    const badgeColor = STATUS_COLORS[post.status] ?? 'info';
    const disabled = this._actionInProgress === post.id;
    const hasImage = post.image_urls.length > 0;

    return html`
      <div class="dispatch dispatch--${post.status}">
        <div class="dispatch__thumb ${!hasImage ? 'dispatch__thumb--empty' : ''}">
          ${
            hasImage
              ? html`<img src="${post.image_urls[0]}" alt="${post.alt_text ?? ''}" loading="lazy" />`
              : msg('N/A')
          }
        </div>

        <div class="dispatch__body">
          <div class="dispatch__header">
            <span class="dispatch__type-tag">${post.content_source_type}</span>
            ${
              post.simulation_name
                ? html`<span class="dispatch__shard">${post.simulation_name}</span>`
                : nothing
            }
            <span class="badge badge--${badgeColor}">${post.status}</span>
            ${
              post.bsky_status
                ? html`
              <span class="badge badge--${post.bsky_status === 'published' ? 'success' : post.bsky_status === 'failed' ? 'danger' : post.bsky_status === 'skipped' ? 'muted' : 'info'}" title=${msg('Bluesky')}>
                ${icons.antenna(10)} ${post.bsky_status}
              </span>
            `
                : nothing
            }
            <span class="dispatch__timestamp">
              ${
                post.status === 'published'
                  ? formatDateTimeShort(post.published_at)
                  : post.status === 'scheduled'
                    ? formatDateTimeShort(post.scheduled_at)
                    : formatDateTimeShort(post.created_at)
              }
            </span>
          </div>

          <div class="dispatch__caption">${post.caption}</div>

          ${
            post.hashtags.length > 0
              ? html`
            <div class="dispatch__tags">
              ${post.hashtags.map((h) => html`<span class="dispatch__tag">${h}</span>`)}
            </div>
          `
              : nothing
          }

          ${
            post.status === 'published'
              ? html`
            <div class="dispatch__metrics">
              <span class="metric">${icons.sparkle(12)} ${this._formatNumber(post.likes_count)}</span>
              <span class="metric">${icons.messageCircle(12)} ${this._formatNumber(post.comments_count)}</span>
              <span class="metric metric--accent">${icons.stampClassified(12)} ${this._formatNumber(post.saves)}</span>
              <span class="metric">${icons.eye(12)} ${this._formatNumber(post.reach)}</span>
              <span class="metric metric--accent">${(post.engagement_rate * 100).toFixed(1)}%</span>
            </div>
          `
              : nothing
          }

          ${
            post.failure_reason
              ? html`
            <div class="dispatch__failure">${post.failure_reason}</div>
          `
              : nothing
          }
        </div>

        <div class="dispatch__actions">
          ${
            post.status === 'draft'
              ? html`
            <button class="act act--approve" ?disabled=${disabled} @click=${() => this._handleApprove(post)}>
              ${msg('Approve')}
            </button>
            <button class="act act--reject" ?disabled=${disabled} @click=${() => this._openRejectModal(post)}>
              ${msg('Reject')}
            </button>
            <button class="act act--publish" ?disabled=${disabled} @click=${() => this._handleForcePublish(post)}>
              ${msg('Publish')}
            </button>
          `
              : nothing
          }

          ${
            post.status === 'scheduled'
              ? html`
            <button class="act act--publish" ?disabled=${disabled} @click=${() => this._handleForcePublish(post)}>
              ${msg('Publish Now')}
            </button>
            <button class="act act--reject" ?disabled=${disabled} @click=${() => this._openRejectModal(post)}>
              ${msg('Cancel')}
            </button>
          `
              : nothing
          }

          ${
            post.status === 'published' && post.ig_permalink
              ? html`
            <a class="act act--link" href="${post.ig_permalink}" target="_blank" rel="noopener">
              ${msg('View on IG')}
            </a>
          `
              : nothing
          }
        </div>
      </div>
    `;
  }

  // ── Stories Section ────────────────────────────────────

  private get _filteredStories(): SocialStoryItem[] {
    if (this._storyFilter === 'all') return this._stories;
    return this._stories.filter((s) => s.status === this._storyFilter);
  }

  /** Group stories by resonance_id into sequences. */
  private get _storySequences(): {
    resonanceId: string;
    archetype: string;
    magnitude: number;
    stories: SocialStoryItem[];
  }[] {
    const map = new Map<string, SocialStoryItem[]>();
    for (const s of this._filteredStories) {
      const key = s.resonance_id ?? 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).map(([resonanceId, stories]) => {
      stories.sort((a, b) => a.sequence_index - b.sequence_index);
      return {
        resonanceId,
        archetype: stories[0]?.archetype ?? '',
        magnitude: stories[0]?.magnitude ?? 0,
        stories,
      };
    });
  }

  private _storyStatusCount(status: string): number {
    return this._stories.filter((s) => s.status === status).length;
  }

  private _toggleSequence(resonanceId: string): void {
    const next = new Set(this._expandedSequences);
    if (next.has(resonanceId)) {
      next.delete(resonanceId);
    } else {
      next.add(resonanceId);
    }
    this._expandedSequences = next;
  }

  private _renderStoriesSection() {
    if (this._stories.length === 0) return nothing;

    return html`
      <div class="stories-section">
        <div class="stories-header">
          <div class="stories-header__marker"></div>
          <div class="stories-header__title">${msg('Resonance Broadcast Log')}</div>
          <span class="stories-header__count">${this._stories.length} ${msg('stories')}</span>
        </div>
        ${this._renderStoryFilterBar()}
        ${
          this._storySequences.length === 0
            ? html`<div class="story-empty">${msg('No stories match this filter.')}</div>`
            : this._storySequences.map((seq) => this._renderSequenceAccordion(seq))
        }
      </div>
    `;
  }

  private _renderStoryFilterBar() {
    const filters: { key: StoryStatusFilter; label: string }[] = [
      { key: 'all', label: msg('All') },
      { key: 'pending', label: msg('Pending') },
      { key: 'ready', label: msg('Ready') },
      { key: 'published', label: msg('Published') },
      { key: 'failed', label: msg('Failed') },
      { key: 'skipped', label: msg('Skipped') },
    ];

    return html`
      <div class="story-filter-bar">
        ${filters.map(
          (f) => html`
          <button
            class="status-tab ${this._storyFilter === f.key ? 'status-tab--active' : ''}"
            @click=${() => {
              this._storyFilter = f.key;
            }}
          >
            ${f.label}
            <span class="status-tab__count">${f.key === 'all' ? this._stories.length : this._storyStatusCount(f.key)}</span>
          </button>
        `,
        )}
      </div>
    `;
  }

  private _renderSequenceAccordion(seq: {
    resonanceId: string;
    archetype: string;
    magnitude: number;
    stories: SocialStoryItem[];
  }) {
    const isOpen = this._expandedSequences.has(seq.resonanceId);
    const accentHex = ARCHETYPE_HEX[seq.archetype] ?? 'var(--color-primary)';
    const published = seq.stories.filter((s) => s.status === 'published').length;
    const total = seq.stories.length;

    return html`
      <div class="seq-accordion" style="--_seq-accent: ${accentHex}">
        <button type="button"
          class="seq-header"
          @click=${() => this._toggleSequence(seq.resonanceId)}
          aria-expanded=${isOpen}
        >
          <span class="seq-header__chevron ${isOpen ? 'seq-header__chevron--open' : ''}">
            ${icons.chevronRight(14)}
          </span>
          <span class="seq-header__archetype">${seq.archetype || msg('Unknown')}</span>
          <span class="seq-header__mag">
            <span class="seq-mag-bar">
              <span class="seq-mag-bar__fill" style="width: ${Math.min(seq.magnitude * 100, 100)}%"></span>
            </span>
            ${seq.magnitude.toFixed(2)}
          </span>
          <span class="seq-header__summary">${published}/${total} ${msg('published')}</span>
        </button>
        ${
          isOpen
            ? html`
          <div class="seq-body">
            ${seq.stories.map((s) => this._renderStoryCard(s))}
          </div>
        `
            : nothing
        }
      </div>
    `;
  }

  private _renderStoryCard(story: SocialStoryItem) {
    const badgeColor = STORY_STATUS_COLORS[story.status] ?? 'info';
    const typeLabel = STORY_TYPE_LABELS[story.story_type] ?? story.story_type.toUpperCase();
    const hasImage = !!story.image_url;
    const disabled = this._storyActionInProgress === story.id;

    return html`
      <div class="story-card">
        <div class="story-card__thumb ${!hasImage ? 'story-card__thumb--empty' : ''}">
          ${
            hasImage
              ? html`<img src="${story.image_url}" alt="${story.caption ?? ''}" loading="lazy" />`
              : html`<span>9:16</span>`
          }
        </div>
        <div class="story-card__body">
          <div class="story-card__header">
            <span class="story-card__type">${typeLabel}</span>
            <span class="story-card__seq">#${story.sequence_index}</span>
            <span class="badge badge--${badgeColor}">${story.status}</span>
            <span class="story-card__time">${formatDateTimeShort(story.scheduled_at, { fallback: '\u2014' })}</span>
          </div>
          <div class="story-card__caption">${story.caption ?? ''}</div>
          ${
            story.failure_reason
              ? html`
            <div class="story-card__failure">${story.failure_reason}</div>
          `
              : nothing
          }
        </div>
        <div class="story-card__actions">
          ${
            story.status === 'pending' || story.status === 'ready'
              ? html`
            <button class="act act--reject" ?disabled=${disabled} @click=${() => this._handleSkipStory(story)}>
              ${msg('Skip')}
            </button>
          `
              : nothing
          }
          ${
            story.status === 'skipped'
              ? html`
            <button class="act" ?disabled=${disabled} @click=${() => this._handleUnskipStory(story)}>
              ${msg('Unskip')}
            </button>
          `
              : nothing
          }
          ${
            story.status === 'pending'
              ? html`
            <button class="act" ?disabled=${disabled} @click=${() => this._handleComposeStory(story)}>
              ${msg('Compose')}
            </button>
          `
              : nothing
          }
          ${
            story.status === 'pending' || story.status === 'ready'
              ? html`
            <button class="act act--publish" ?disabled=${disabled} @click=${() => this._handlePublishStory(story)}>
              ${msg('Publish')}
            </button>
          `
              : nothing
          }
        </div>
      </div>
    `;
  }

  private async _handleSkipStory(story: SocialStoryItem): Promise<void> {
    this._storyActionInProgress = story.id;
    try {
      await adminApi.skipSocialStory(story.id);
      VelgToast.success(msg('Story skipped'));
      await this._loadAll();
    } catch {
      VelgToast.error(msg('Failed to skip story'));
    } finally {
      this._storyActionInProgress = null;
    }
  }

  private async _handleUnskipStory(story: SocialStoryItem): Promise<void> {
    this._storyActionInProgress = story.id;
    try {
      await adminApi.unskipSocialStory(story.id);
      VelgToast.success(msg('Story restored'));
      await this._loadAll();
    } catch {
      VelgToast.error(msg('Failed to unskip story'));
    } finally {
      this._storyActionInProgress = null;
    }
  }

  private async _handleComposeStory(story: SocialStoryItem): Promise<void> {
    this._storyActionInProgress = story.id;
    try {
      await adminApi.forceComposeSocialStory(story.id);
      VelgToast.success(msg('Story image composed'));
      await this._loadAll();
    } catch {
      VelgToast.error(msg('Failed to compose story'));
    } finally {
      this._storyActionInProgress = null;
    }
  }

  private async _handlePublishStory(story: SocialStoryItem): Promise<void> {
    this._storyActionInProgress = story.id;
    try {
      await adminApi.forcePublishSocialStory(story.id);
      VelgToast.success(msg('Story published'));
      await this._loadAll();
    } catch {
      VelgToast.error(msg('Failed to publish story'));
    } finally {
      this._storyActionInProgress = null;
    }
  }

  // ── Configure Tab ──────────────────────────────────────

  private _renderConfigureTab() {
    const c = this._config;

    return html`
      <div class="config-grid">
        <!-- Cipher ARG System -->
        <div class="config-card">
          <div class="config-card__header">
            <div class="config-card__title">
              ${icons.key(14)} ${msg('Cipher ARG System')}
            </div>
            <span class="config-card__status ${c.cipher_enabled ? 'config-card__status--active' : 'config-card__status--inactive'}">
              ${c.cipher_enabled ? msg('Active') : msg('Inactive')}
            </span>
          </div>

          <div class="config-row">
            <div class="config-row__label">
              <div class="config-row__name">
                ${msg('Cipher Enabled')}
                ${renderInfoBubble(msg('When enabled, every generated Instagram draft receives a unique unlock code. Followers decode the cipher hint in the caption (or image) and enter the code at /bureau/dispatch to claim a reward.'))}
              </div>
              <div class="config-row__desc">${msg('Generate unlock codes for Instagram dispatches')}</div>
            </div>
            ${this._renderToggle('instagram_cipher_enabled', c.cipher_enabled)}
          </div>

          <div class="config-row ${c.cipher_enabled ? '' : 'config-row--disabled'}">
            <div class="config-row__label">
              <div class="config-row__name">
                ${msg('Difficulty')}
                ${renderInfoBubble(msg('Easy: Base64-encoded code (simple decode). Medium: Caesar-shifted then Base64 (ROT-13 puzzle). Hard: Reversed, Caesar-shifted, then Base64 (multi-step decode). Higher difficulty = fewer successful redemptions but more engaged players.'))}
              </div>
              <div class="config-row__desc">${msg('Encoding complexity for cipher hints')}</div>
            </div>
            ${this._renderSegmented('instagram_cipher_difficulty', c.cipher_difficulty, DIFFICULTY_OPTIONS)}
          </div>

          <div class="config-row ${c.cipher_enabled ? '' : 'config-row--disabled'}">
            <div class="config-row__label">
              <div class="config-row__name">
                ${msg('Hint Format')}
                ${renderInfoBubble(msg('Footer: cipher hint appended at the end of the caption. Caption: hint inserted inline before the ADDENDUM section. Steganographic: hint rendered as faint rotated text in the composed image – caption only shows a "decode at" notice.'))}
              </div>
              <div class="config-row__desc">${msg('Where the cipher hint appears in the post')}</div>
            </div>
            ${this._renderSegmented('instagram_cipher_hint_format', c.cipher_hint_format, HINT_FORMAT_OPTIONS)}
          </div>
        </div>

        <!-- Scheduling -->
        <div class="config-card">
          <div class="config-card__header">
            <div class="config-card__title">
              ${icons.calendar(14)} ${msg('Scheduling')}
            </div>
            <span class="config-card__status ${c.auto_schedule ? 'config-card__status--active' : 'config-card__status--inactive'}">
              ${c.auto_schedule ? msg('Auto') : msg('Manual')}
            </span>
          </div>

          <div class="config-row">
            <div class="config-row__label">
              <div class="config-row__name">
                ${msg('Auto-Schedule')}
                ${renderInfoBubble(msg('When enabled, the scheduler automatically publishes approved posts at the configured interval. When disabled, posts must be manually force-published from the Operations tab.'))}
              </div>
              <div class="config-row__desc">${msg('Automatically publish scheduled posts')}</div>
            </div>
            ${this._renderToggle('instagram_auto_schedule', c.auto_schedule)}
          </div>

          <div class="config-row ${c.auto_schedule ? '' : 'config-row--disabled'}">
            <div class="config-row__label">
              <div class="config-row__name">
                ${msg('Publish Interval')}
                ${renderInfoBubble(msg('Minimum hours between automated publications (1-168). The scheduler picks the next approved post from the queue. Lower values = more frequent posts. Instagram recommends 1-2 posts per day for optimal engagement.'))}
              </div>
              <div class="config-row__desc">${msg('Hours between automated publications')}</div>
            </div>
            <div class="num-input">
              <input
                class="num-input__field"
                type="number"
                min="1"
                max="168"
                .value=${String(c.schedule_interval_hours)}
                aria-label=${msg('Schedule interval in hours')}
                @change=${(e: Event) => this._handleIntervalChange((e.target as HTMLInputElement).value)}
              />
              <span class="num-input__unit">${msg('hrs')}</span>
            </div>
          </div>
        </div>

        <!-- Content Mix -->
        <div class="config-card">
          <div class="config-card__header">
            <div class="config-card__title">
              ${icons.clipboard(14)} ${msg('Content Mix')}
              ${renderInfoBubble(msg('Proportional weights for content type selection when generating batches. Higher weight = more posts of that type. Set to 0 to disable a type entirely. The percentage shows the expected share in a batch.'))}
            </div>
            ${
              this._savingKey === 'instagram_content_mix'
                ? html`<span class="saving-indicator">${msg('Saving...')}</span>`
                : nothing
            }
          </div>

          <div class="mix-rows">
            ${Object.entries(c.content_mix).map(([type, weight]) => {
              const pct = this._mixTotal > 0 ? Math.round((weight / this._mixTotal) * 100) : 0;
              return html`
                <div class="mix-row">
                  <div class="mix-row__type">
                    ${this._getTypeIcon(type)}
                    ${type}
                  </div>
                  <div class="mix-row__bar-container">
                    <div class="mix-row__bar-fill" style="width: ${pct}%"></div>
                  </div>
                  <input
                    class="mix-row__weight"
                    type="number"
                    min="0"
                    max="10"
                    .value=${String(weight)}
                    aria-label=${msg(str`Content mix weight for ${type}`)}
                    @change=${(e: Event) => this._handleMixChange(type, (e.target as HTMLInputElement).value)}
                  />
                  <span class="mix-row__pct">${pct}%</span>
                </div>
              `;
            })}
          </div>
        </div>

        <!-- Moderation Blocklist -->
        <div class="config-card">
          <div class="config-card__header">
            <div class="config-card__title">
              ${icons.lock(14)} ${msg('Moderation Blocklist')}
              ${renderInfoBubble(msg('Custom terms that block caption generation. One term per line. Captions containing any of these terms are rejected before draft creation. A default safety blocklist (violence, hate speech, NSFW) is always active in addition to these custom terms.'))}
            </div>
            ${
              this._savingKey === 'instagram_blocklist'
                ? html`<span class="saving-indicator">${msg('Saving...')}</span>`
                : nothing
            }
          </div>

          <div class="blocklist-editor">
            <textarea
              class="blocklist-editor__input"
              placeholder=${msg('One blocked term per line...')}
              aria-label=${msg('Moderation blocklist')}
              .value=${this._blocklistDraft}
              @input=${(e: Event) => {
                this._blocklistDraft = (e.target as HTMLTextAreaElement).value;
              }}
            ></textarea>
            <div class="blocklist-editor__hint">
              ${msg(str`${this._blocklistDraft.split('\n').filter((l) => l.trim()).length} terms. Default safety blocklist is always active.`)}
            </div>
            <div class="blocklist-editor__actions">
              <button class="act act--approve" @click=${this._handleBlocklistSave}>
                ${msg('Save Blocklist')}
              </button>
            </div>
          </div>
        </div>

        <!-- Trending Tags -->
        <div class="config-card config-card--full">
          <div class="config-card__header">
            <div class="config-card__title">
              ${icons.target(14)} ${msg('Trending Tags')}
              ${renderInfoBubble(msg('Momentum hashtags mixed into posts (1 per post, rotated). Update weekly with tags trending in the AI art, worldbuilding, or indie creator space. Instagram 2026: 3-5 relevant tags per post, varied per post – one trending tag per dispatch boosts discovery without looking spammy.'))}
            </div>
            ${
              this._savingKey === 'instagram_trending_tags'
                ? html`<span class="saving-indicator">${msg('Saving...')}</span>`
                : nothing
            }
          </div>

          <div class="blocklist-editor">
            <textarea
              class="blocklist-editor__input"
              placeholder=${msg('One trending hashtag per line (e.g. #AIrevolution)...')}
              aria-label=${msg('Trending hashtags')}
              .value=${this._trendingDraft}
              @input=${(e: Event) => {
                this._trendingDraft = (e.target as HTMLTextAreaElement).value;
              }}
            ></textarea>
            <div class="blocklist-editor__hint">
              ${msg(str`${this._trendingDraft.split('\n').filter((l) => l.trim()).length} trending tags. One is mixed into each generated post for momentum.`)}
            </div>
            <div class="blocklist-editor__actions">
              <button class="act act--approve" @click=${this._handleTrendingSave}>
                ${msg('Save Trending Tags')}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private _renderToggle(key: string, checked: boolean) {
    return html`
      <velg-toggle
        variant="scif"
        .checked=${checked}
        ?disabled=${this._savingKey === key}
        @toggle-change=${() => this._handleToggle(key, checked)}
      ></velg-toggle>
    `;
  }

  private _renderSegmented(key: string, current: string, options: readonly string[]) {
    return html`
      <div class="segmented">
        ${options.map(
          (opt) => html`
          <button
            class="segmented__option ${current === opt ? 'segmented__option--active' : ''}"
            ?disabled=${this._savingKey === key}
            @click=${() => this._handleSegmented(key, opt)}
          >
            ${opt}
          </button>
        `,
        )}
      </div>
    `;
  }

  // ── Intelligence Tab ───────────────────────────────────

  private _renderIntelligenceTab() {
    return html`
      ${this._renderIntelGrid()}
      ${this._renderCipherSection()}
    `;
  }

  private _renderIntelGrid() {
    const a = this._analytics;
    const rl = this._rateLimit;
    const usage = rl?.quota_usage ?? 0;
    const total = rl?.quota_total ?? 100;

    return html`
      <div class="queue-section">
        <div class="queue-header">
          <div class="queue-header__marker"></div>
          <div class="queue-header__title">${msg('Performance Readout')}</div>
        </div>

        <div class="intel-grid">
          <velg-metric-card
            label=${msg('Dispatches Filed')}
            value=${String(a?.total_posts ?? 0)}
            sublabel=${msg('last 30 days')}
          ></velg-metric-card>

          <velg-metric-card
            label=${msg('Engagement Rate')}
            value=${
              a?.avg_engagement_rate != null
                ? `${(a.avg_engagement_rate * 100).toFixed(1)}%`
                : '\u2014'
            }
            sublabel=${msg('avg across published')}
          ></velg-metric-card>

          <velg-metric-card
            label=${msg('Surveillance Reach')}
            value=${this._formatNumber(a?.total_reach)}
            sublabel=${msg('external observers')}
            variant="success"
          ></velg-metric-card>

          <velg-metric-card
            label=${msg('Dossiers Saved')}
            value=${this._formatNumber(a?.total_saves)}
            sublabel=${msg('content archived by observers')}
            variant="warning"
          ></velg-metric-card>

          <velg-metric-card
            label=${msg('Pipeline Depth')}
            value=${String(this._statusCount('draft') + this._statusCount('scheduled'))}
            sublabel=${msg(str`${this._statusCount('draft')} pending / ${this._statusCount('scheduled')} queued`)}
          ></velg-metric-card>

          <div class="quota-card-wrapper">
            <velg-metric-card
              label=${msg('API Transmission Quota')}
              value="${usage}/${total}"
              variant="danger"
            ></velg-metric-card>
            <div class="quota-gauge">
              <div class="quota-gauge__track">
                <div
                  class="quota-gauge__fill quota-gauge__fill--${this._quotaLevel(usage, total)}"
                  style="width: ${(usage / total) * 100}%"
                ></div>
              </div>
              <div class="quota-gauge__labels">
                <span>0</span>
                <span>${rl?.remaining ?? total} ${msg('remaining')}</span>
                <span>${total}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private _renderCipherSection() {
    const cs = this._cipherStats;
    if (!cs) return nothing;

    return html`
      <div class="queue-section cipher-section">
        <div class="queue-header">
          <div class="queue-header__marker"></div>
          <div class="queue-header__title">${msg('Cipher Operations')}</div>
        </div>

        <div class="intel-grid cipher-section__grid">
          <velg-metric-card
            label=${msg('Total Redemptions')}
            value=${String(cs.total_redemptions)}
            sublabel=${msg('all time')}
          ></velg-metric-card>

          <velg-metric-card
            label=${msg('Unique Operatives')}
            value=${String(cs.unique_users)}
            sublabel=${msg('authenticated users')}
          ></velg-metric-card>

          <velg-metric-card
            label=${msg('Success Rate')}
            value="${(cs.success_rate * 100).toFixed(1)}%"
            sublabel=${msg(str`${cs.total_attempts} total attempts`)}
          ></velg-metric-card>
        </div>

        ${
          cs.recent_redemptions.length > 0
            ? html`
            <div class="cipher-table">
              <div class="cipher-table__header">
                <span>${msg('Redeemed')}</span>
                <span>${msg('Reward')}</span>
                <span>${msg('User')}</span>
              </div>
              ${cs.recent_redemptions.slice(0, 10).map(
                (r: CipherRedemptionRecord) => html`
                  <div class="cipher-table__row">
                    <span>${formatDateTimeShort(r.redeemed_at, { fallback: '\u2014' })}</span>
                    <span class="dispatch__type-tag">${r.reward_type}</span>
                    <span style="color: var(--color-text-muted)">
                      ${r.user_id ? r.user_id.slice(0, 8) + '\u2026' : msg('Anonymous')}
                    </span>
                  </div>
                `,
              )}
            </div>
          `
            : html`
            <div class="empty-state">
              ${msg('No cipher redemptions yet.')}
              <div class="empty-state__hint">
                ${msg('Ciphers are generated automatically when enabled in platform settings.')}
              </div>
            </div>
          `
        }
      </div>
    `;
  }

  // ── Reject Modal ───────────────────────────────────────

  private _renderRejectModal() {
    return html`
      <div class="reject-overlay" @click=${this._closeRejectModal}>
        <div class="reject-modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="reject-modal__title">${msg('Reject Dispatch')}</div>
          <div class="reject-modal__sub">${msg('Provide justification for the rejection record.')}</div>
          <textarea
            class="reject-modal__input"
            placeholder=${msg('Rejection reason (required)...')}
            aria-label=${msg('Rejection reason')}
            .value=${this._rejectReason}
            @input=${(e: Event) => {
              this._rejectReason = (e.target as HTMLTextAreaElement).value;
            }}
          ></textarea>
          <div class="reject-modal__actions">
            <button class="act" @click=${this._closeRejectModal}>
              ${msg('Cancel')}
            </button>
            <button
              class="act act--reject"
              ?disabled=${!this._rejectReason.trim() || this._actionInProgress !== null}
              @click=${this._handleReject}
            >
              ${msg('Confirm Rejection')}
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-instagram-tab': VelgAdminInstagramTab;
  }
}
