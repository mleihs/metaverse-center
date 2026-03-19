import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  adminApi,
  type CipherRedemptionRecord,
  type CipherStats,
  type InstagramAnalytics,
  type InstagramQueueItem,
  type InstagramRateLimit,
} from '../../services/api/AdminApiService.js';
import { icons } from '../../utils/icons.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { VelgToast } from '../shared/Toast.js';

import '../shared/ConfirmDialog.js';

type StatusFilter = 'all' | 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'rejected';

const STATUS_COLORS: Record<string, string> = {
  draft: 'info',
  scheduled: 'warning',
  publishing: 'warning',
  published: 'success',
  failed: 'danger',
  rejected: 'danger',
};

@localized()
@customElement('velg-admin-instagram-tab')
export class VelgAdminInstagramTab extends LitElement {
  static styles = css`
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
      margin-bottom: var(--space-5);
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
       INTEL READOUT — Analytics dashboard cards
       ══════════════════════════════════════════════════════ */

    .intel-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: var(--space-3);
      margin-bottom: var(--space-6);
    }

    .intel-card {
      position: relative;
      padding: var(--space-3) var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      overflow: hidden;
      animation: intel-slide-up 0.4s ease both;
    }

    .intel-card:nth-child(1) { animation-delay: 0ms; }
    .intel-card:nth-child(2) { animation-delay: 60ms; }
    .intel-card:nth-child(3) { animation-delay: 120ms; }
    .intel-card:nth-child(4) { animation-delay: 180ms; }
    .intel-card:nth-child(5) { animation-delay: 240ms; }
    .intel-card:nth-child(6) { animation-delay: 300ms; }

    @keyframes intel-slide-up {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Top accent bar */
    .intel-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
    }

    /* Scanline texture overlay */
    .intel-card::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        color-mix(in srgb, var(--color-text-primary) 1.5%, transparent) 3px,
        color-mix(in srgb, var(--color-text-primary) 1.5%, transparent) 4px
      );
      pointer-events: none;
    }

    /* Corner brackets */
    .intel-card__corner {
      position: absolute;
      width: 6px;
      height: 6px;
      border-style: solid;
      opacity: 0.25;
      z-index: 1;
    }

    .intel-card__corner--tl { top: 3px; left: 3px; border-width: 1px 0 0 1px; }
    .intel-card__corner--br { bottom: 3px; right: 3px; border-width: 0 1px 1px 0; }

    .intel-card--dispatches::before { background: var(--color-info); }
    .intel-card--dispatches .intel-card__corner { border-color: var(--color-info); }

    .intel-card--engagement::before { background: var(--color-primary); }
    .intel-card--engagement .intel-card__corner { border-color: var(--color-primary); }

    .intel-card--reach::before { background: var(--color-success); }
    .intel-card--reach .intel-card__corner { border-color: var(--color-success); }

    .intel-card--saves::before { background: var(--color-warning); }
    .intel-card--saves .intel-card__corner { border-color: var(--color-warning); }

    .intel-card--pipeline::before { background: var(--color-text-secondary); }
    .intel-card--pipeline .intel-card__corner { border-color: var(--color-text-secondary); }

    .intel-card--quota::before { background: var(--color-danger); }
    .intel-card--quota .intel-card__corner { border-color: var(--color-danger); }

    .intel-card__icon {
      display: flex;
      align-items: center;
      margin-bottom: var(--space-1);
      color: var(--color-text-muted);
    }

    .intel-card__label {
      font-family: var(--font-brutalist);
      font-size: 8px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-text-muted);
      margin-bottom: var(--space-1);
    }

    .intel-card__value {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-2xl);
      font-weight: var(--font-bold);
      color: var(--color-text-primary);
      line-height: 1;
      margin-bottom: 2px;
    }

    .intel-card__value--unit {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      font-weight: normal;
    }

    .intel-card__sub {
      font-size: 10px;
      color: var(--color-text-muted);
      letter-spacing: 0.02em;
    }

    /* ── Quota Gauge ─────────────────────────────────────── */

    .quota-gauge {
      margin-top: var(--space-2);
      position: relative;
      z-index: 1;
    }

    .quota-gauge__track {
      width: 100%;
      height: 6px;
      background: color-mix(in srgb, var(--color-border) 40%, transparent);
      position: relative;
      overflow: hidden;
    }

    .quota-gauge__fill {
      height: 100%;
      transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
      position: relative;
    }

    .quota-gauge__fill--ok { background: var(--color-success); }
    .quota-gauge__fill--warn { background: var(--color-warning); }
    .quota-gauge__fill--critical { background: var(--color-danger); }

    .quota-gauge__fill--critical::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent 40%, color-mix(in srgb, var(--color-danger) 60%, transparent) 50%, transparent 60%);
      animation: gauge-sweep 1.5s ease-in-out infinite;
    }

    @keyframes gauge-sweep {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(200%); }
    }

    .quota-gauge__labels {
      display: flex;
      justify-content: space-between;
      margin-top: 3px;
      font-size: 9px;
      font-family: var(--font-mono, monospace);
      color: var(--color-text-muted);
    }

    /* ══════════════════════════════════════════════════════
       DISPATCH QUEUE — Filter bar + post cards
       ══════════════════════════════════════════════════════ */

    .queue-section {
      margin-top: var(--space-2);
    }

    .queue-header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }

    .queue-header__marker {
      width: 3px;
      height: 20px;
      background: var(--color-danger);
      flex-shrink: 0;
    }

    .queue-header__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-text-primary);
    }

    /* ── Status Filter Tabs ──────────────────────────────── */

    .status-bar {
      display: flex;
      align-items: center;
      gap: 0;
      margin-bottom: var(--space-4);
      border-bottom: 1px solid var(--color-border);
    }

    .status-tab {
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: none;
      color: var(--color-text-muted);
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      transition: all 0.15s ease;
      position: relative;
    }

    .status-tab:hover {
      color: var(--color-text-primary);
      background: color-mix(in srgb, var(--color-text-primary) 3%, transparent);
    }

    .status-tab--active {
      color: var(--color-primary);
      border-bottom-color: var(--color-primary);
    }

    .status-tab__count {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      margin-left: 4px;
      opacity: 0.6;
    }

    .status-tab--active .status-tab__count {
      opacity: 1;
    }

    .queue-total {
      margin-left: auto;
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
    }

    /* ── Post Cards ──────────────────────────────────────── */

    .dispatch-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .dispatch {
      display: grid;
      grid-template-columns: 72px 1fr auto;
      gap: var(--space-4);
      padding: var(--space-3) var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      transition: border-color 0.2s ease, transform 0.15s ease;
      position: relative;
    }

    .dispatch:hover {
      border-color: color-mix(in srgb, var(--color-text-muted) 60%, var(--color-border));
      transform: translateX(2px);
    }

    /* Vertical status indicator bar */
    .dispatch::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
    }

    .dispatch--draft::before { background: var(--color-info); }
    .dispatch--scheduled::before { background: var(--color-warning); }
    .dispatch--publishing::before { background: var(--color-warning); }
    .dispatch--published::before { background: var(--color-success); }
    .dispatch--failed::before { background: var(--color-danger); }
    .dispatch--rejected::before { background: var(--color-danger); opacity: 0.5; }

    /* ── Thumbnail ────────────────────────────────────────── */

    .dispatch__thumb {
      width: 72px;
      height: 90px;
      overflow: hidden;
      border: 1px solid var(--color-border);
      background: color-mix(in srgb, var(--color-border) 15%, var(--color-surface));
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .dispatch__thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: saturate(0.85);
      transition: filter 0.2s ease;
    }

    .dispatch:hover .dispatch__thumb img {
      filter: saturate(1);
    }

    .dispatch__thumb--empty {
      color: var(--color-text-muted);
      font-size: 9px;
      text-transform: uppercase;
      font-family: var(--font-brutalist);
      letter-spacing: 0.06em;
    }

    /* ── Post Body ────────────────────────────────────────── */

    .dispatch__body {
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
      min-width: 0;
    }

    .dispatch__header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .dispatch__type-tag {
      font-family: var(--font-brutalist);
      font-size: 8px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 1px var(--space-1-5);
      border: 1px solid color-mix(in srgb, var(--color-primary) 40%, transparent);
      color: var(--color-primary);
    }

    .dispatch__shard {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      font-family: var(--font-mono, monospace);
    }

    .dispatch__shard::before {
      content: 'SHARD:';
      font-family: var(--font-brutalist);
      font-size: 8px;
      letter-spacing: 0.06em;
      margin-right: 4px;
      opacity: 0.5;
    }

    .dispatch__timestamp {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-muted);
      margin-left: auto;
    }

    .dispatch__caption {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      line-height: 1.55;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .dispatch__tags {
      display: flex;
      gap: var(--space-1);
      flex-wrap: wrap;
    }

    .dispatch__tag {
      font-size: 10px;
      color: var(--color-info);
      font-family: var(--font-mono, monospace);
      opacity: 0.8;
    }

    /* ── Engagement Metrics Row ───────────────────────────── */

    .dispatch__metrics {
      display: flex;
      gap: var(--space-3);
      padding-top: var(--space-1);
      border-top: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
      margin-top: var(--space-1);
    }

    .metric {
      display: flex;
      align-items: center;
      gap: 3px;
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      color: var(--color-text-muted);
    }

    .metric svg {
      opacity: 0.6;
    }

    .metric--accent {
      color: var(--color-primary);
    }

    .metric--accent svg {
      opacity: 1;
    }

    /* ── Failure Callout ──────────────────────────────────── */

    .dispatch__failure {
      font-size: var(--text-xs);
      color: var(--color-danger);
      padding: var(--space-1) var(--space-2);
      background: color-mix(in srgb, var(--color-danger) 5%, transparent);
      border-left: 2px solid var(--color-danger);
      font-family: var(--font-mono, monospace);
    }

    .dispatch__failure::before {
      content: 'ERR: ';
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 9px;
      letter-spacing: 0.06em;
    }

    /* ══════════════════════════════════════════════════════
       STATUS BADGES
       ══════════════════════════════════════════════════════ */

    .badge {
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: 1px var(--space-2);
      border: 1px solid;
      white-space: nowrap;
    }

    .badge--info {
      color: var(--color-info);
      border-color: color-mix(in srgb, var(--color-info) 50%, transparent);
      background: color-mix(in srgb, var(--color-info) 8%, transparent);
    }

    .badge--warning {
      color: var(--color-warning);
      border-color: color-mix(in srgb, var(--color-warning) 50%, transparent);
      background: color-mix(in srgb, var(--color-warning) 8%, transparent);
    }

    .badge--success {
      color: var(--color-success);
      border-color: color-mix(in srgb, var(--color-success) 50%, transparent);
      background: color-mix(in srgb, var(--color-success) 6%, transparent);
    }

    .badge--danger {
      color: var(--color-danger);
      border-color: color-mix(in srgb, var(--color-danger) 50%, transparent);
      background: color-mix(in srgb, var(--color-danger) 8%, transparent);
    }

    /* ══════════════════════════════════════════════════════
       ACTION BUTTONS
       ══════════════════════════════════════════════════════ */

    .dispatch__actions {
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
      align-items: flex-end;
      justify-content: center;
    }

    .act {
      padding: var(--space-1) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
      text-decoration: none;
      display: inline-block;
      text-align: center;
    }

    .act:hover {
      transform: translateY(-1px);
    }

    .act:disabled {
      opacity: 0.35;
      cursor: not-allowed;
      pointer-events: none;
    }

    .act--approve {
      color: var(--color-success);
      border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
    }
    .act--approve:hover {
      background: color-mix(in srgb, var(--color-success) 10%, var(--color-surface));
      border-color: var(--color-success);
    }

    .act--reject {
      color: var(--color-danger);
      border-color: color-mix(in srgb, var(--color-danger) 40%, transparent);
    }
    .act--reject:hover {
      background: color-mix(in srgb, var(--color-danger) 10%, var(--color-surface));
      border-color: var(--color-danger);
    }

    .act--publish {
      color: var(--color-primary);
      border-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
    }
    .act--publish:hover {
      background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));
      border-color: var(--color-primary);
    }

    .act--link {
      color: var(--color-info);
      border-color: color-mix(in srgb, var(--color-info) 40%, transparent);
    }
    .act--link:hover {
      background: color-mix(in srgb, var(--color-info) 10%, var(--color-surface));
      border-color: var(--color-info);
    }

    /* ══════════════════════════════════════════════════════
       REJECT MODAL
       ══════════════════════════════════════════════════════ */

    .reject-overlay {
      position: fixed;
      inset: 0;
      background: color-mix(in srgb, var(--color-surface) 88%, transparent);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: overlay-fade 0.15s ease;
    }

    @keyframes overlay-fade {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .reject-modal {
      width: 100%;
      max-width: 460px;
      padding: var(--space-5);
      background: var(--color-surface-raised);
      border: 1px solid var(--color-danger);
      position: relative;
      animation: modal-enter 0.2s cubic-bezier(0.22, 1, 0.36, 1);
    }

    @keyframes modal-enter {
      from { opacity: 0; transform: translateY(16px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .reject-modal::before {
      content: 'CLASSIFICATION: REJECTED';
      position: absolute;
      top: -10px;
      left: var(--space-4);
      padding: 0 var(--space-2);
      background: var(--color-surface-raised);
      font-family: var(--font-brutalist);
      font-size: 8px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-danger);
    }

    .reject-modal__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-primary);
      margin-bottom: var(--space-1);
    }

    .reject-modal__sub {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin-bottom: var(--space-3);
    }

    .reject-modal__input {
      width: 100%;
      min-height: 90px;
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      background: var(--color-surface);
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
      resize: vertical;
      box-sizing: border-box;
    }

    .reject-modal__input:focus {
      outline: none;
      border-color: var(--color-danger);
      box-shadow: 0 0 0 1px var(--color-danger);
    }

    .reject-modal__actions {
      display: flex;
      gap: var(--space-2);
      justify-content: flex-end;
      margin-top: var(--space-3);
    }

    /* ══════════════════════════════════════════════════════
       STATES — Empty, Loading, Error
       ══════════════════════════════════════════════════════ */

    .empty-state {
      padding: var(--space-10) var(--space-6);
      text-align: center;
      color: var(--color-text-muted);
      font-size: var(--text-sm);
      border: 1px dashed var(--color-border);
    }

    .empty-state__hint {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      margin-top: var(--space-2);
      opacity: 0.6;
    }

    .loading-state {
      padding: var(--space-8);
      text-align: center;
      color: var(--color-text-muted);
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      animation: loading-blink 1.2s ease-in-out infinite;
    }

    @keyframes loading-blink {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      background: color-mix(in srgb, var(--color-danger) 8%, var(--color-surface));
      border: 1px solid color-mix(in srgb, var(--color-danger) 40%, transparent);
      border-left: 3px solid var(--color-danger);
      color: var(--color-danger);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      margin-bottom: var(--space-4);
    }

    /* ══════════════════════════════════════════════════════
       CIPHER TABLE
       ══════════════════════════════════════════════════════ */

    .cipher-table__header,
    .cipher-table__row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      font-size: var(--text-xs);
    }

    .cipher-table__header {
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      border-bottom: 1px solid var(--color-border);
    }

    .cipher-table__row {
      border-bottom: 1px solid var(--color-border-light);
      color: var(--color-text-secondary);
    }

    .cipher-table__row:last-child {
      border-bottom: none;
    }

    /* ══════════════════════════════════════════════════════
       RESPONSIVE
       ══════════════════════════════════════════════════════ */

    @media (max-width: 1100px) {
      .intel-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 768px) {
      .intel-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .dispatch {
        grid-template-columns: 1fr;
        gap: var(--space-2);
      }

      .dispatch__thumb {
        display: none;
      }

      .dispatch__actions {
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: flex-start;
      }

      .scif-header {
        flex-direction: column;
        align-items: flex-start;
      }
    }

    @media (max-width: 480px) {
      .intel-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  @state() private _queue: InstagramQueueItem[] = [];
  @state() private _analytics: InstagramAnalytics | null = null;
  @state() private _rateLimit: InstagramRateLimit | null = null;
  @state() private _statusFilter: StatusFilter = 'all';
  @state() private _loading = true;
  @state() private _generating = false;
  @state() private _error: string | null = null;
  @state() private _actionInProgress: string | null = null;
  @state() private _rejectTarget: InstagramQueueItem | null = null;
  @state() private _rejectReason = '';
  @state() private _cipherStats: CipherStats | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this._loadAll();
  }

  // ── Data Loading ──────────────────────────────────────

  private async _loadAll(): Promise<void> {
    this._loading = true;
    this._error = null;

    try {
      const [queueResp, analyticsResp, rateLimitResp, cipherResp] = await Promise.all([
        adminApi.listInstagramQueue({ limit: '100' }),
        adminApi.getInstagramAnalytics(30),
        adminApi.getInstagramRateLimit(),
        adminApi.getInstagramCipherStats(),
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
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('Failed to load Instagram data');
    } finally {
      this._loading = false;
    }
  }

  // ── Computed ──────────────────────────────────────────

  private get _filteredQueue(): InstagramQueueItem[] {
    if (this._statusFilter === 'all') return this._queue;
    return this._queue.filter((p) => p.status === this._statusFilter);
  }

  private _statusCount(status: string): number {
    return this._queue.filter((p) => p.status === status).length;
  }

  // ── Actions ──────────────────────────────────────────

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

  // ── Helpers ──────────────────────────────────────────

  private _formatDate(dateStr: string | null): string {
    if (!dateStr) return '\u2014';
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

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

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════

  protected render() {
    return html`
      ${this._error ? html`
        <div class="error-banner">
          ${icons.alertTriangle(14)} ${this._error}
        </div>
      ` : nothing}

      ${this._renderHeader()}
      ${this._renderIntelGrid()}

      <div class="queue-section">
        ${this._renderQueueHeader()}
        ${this._renderStatusBar()}
        ${this._loading
          ? html`<div class="loading-state">${msg('Scanning Bureau dispatch channels...')}</div>`
          : this._renderDispatchList()
        }
      </div>

      ${this._renderCipherSection()}

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

  private _renderIntelGrid() {
    const a = this._analytics;
    const rl = this._rateLimit;
    const usage = rl?.quota_usage ?? 0;
    const total = rl?.quota_total ?? 100;

    return html`
      <div class="intel-grid">
        <div class="intel-card intel-card--dispatches">
          <div class="intel-card__corner intel-card__corner--tl"></div>
          <div class="intel-card__corner intel-card__corner--br"></div>
          <div class="intel-card__icon">${icons.newspaper(14)}</div>
          <div class="intel-card__label">${msg('Dispatches Filed')}</div>
          <div class="intel-card__value">${a?.total_posts ?? 0}</div>
          <div class="intel-card__sub">${msg('last 30 days')}</div>
        </div>

        <div class="intel-card intel-card--engagement">
          <div class="intel-card__corner intel-card__corner--tl"></div>
          <div class="intel-card__corner intel-card__corner--br"></div>
          <div class="intel-card__icon">${icons.target(14)}</div>
          <div class="intel-card__label">${msg('Engagement Rate')}</div>
          <div class="intel-card__value">
            ${a?.avg_engagement_rate != null
              ? html`${(a.avg_engagement_rate * 100).toFixed(1)}<span class="intel-card__value--unit">%</span>`
              : '\u2014'
            }
          </div>
          <div class="intel-card__sub">${msg('avg across published')}</div>
        </div>

        <div class="intel-card intel-card--reach">
          <div class="intel-card__corner intel-card__corner--tl"></div>
          <div class="intel-card__corner intel-card__corner--br"></div>
          <div class="intel-card__icon">${icons.eye(14)}</div>
          <div class="intel-card__label">${msg('Surveillance Reach')}</div>
          <div class="intel-card__value">${this._formatNumber(a?.total_reach)}</div>
          <div class="intel-card__sub">${msg('external observers')}</div>
        </div>

        <div class="intel-card intel-card--saves">
          <div class="intel-card__corner intel-card__corner--tl"></div>
          <div class="intel-card__corner intel-card__corner--br"></div>
          <div class="intel-card__icon">${icons.stampClassified(14)}</div>
          <div class="intel-card__label">${msg('Dossiers Saved')}</div>
          <div class="intel-card__value">${this._formatNumber(a?.total_saves)}</div>
          <div class="intel-card__sub">${msg('content archived by observers')}</div>
        </div>

        <div class="intel-card intel-card--pipeline">
          <div class="intel-card__corner intel-card__corner--tl"></div>
          <div class="intel-card__corner intel-card__corner--br"></div>
          <div class="intel-card__icon">${icons.clipboard(14)}</div>
          <div class="intel-card__label">${msg('Pipeline Depth')}</div>
          <div class="intel-card__value">${this._statusCount('draft') + this._statusCount('scheduled')}</div>
          <div class="intel-card__sub">
            ${msg(str`${this._statusCount('draft')} pending / ${this._statusCount('scheduled')} queued`)}
          </div>
        </div>

        <div class="intel-card intel-card--quota">
          <div class="intel-card__corner intel-card__corner--tl"></div>
          <div class="intel-card__corner intel-card__corner--br"></div>
          <div class="intel-card__icon">${icons.radar(14)}</div>
          <div class="intel-card__label">${msg('API Transmission Quota')}</div>
          <div class="intel-card__value">
            ${usage}<span class="intel-card__value--unit">/${total}</span>
          </div>
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
      { key: 'all', label: 'All' },
      { key: 'draft', label: 'Draft' },
      { key: 'scheduled', label: 'Scheduled' },
      { key: 'published', label: 'Published' },
      { key: 'failed', label: 'Failed' },
      { key: 'rejected', label: 'Rejected' },
    ];

    return html`
      <div class="status-bar">
        ${tabs.map((t) => html`
          <button
            class="status-tab ${this._statusFilter === t.key ? 'status-tab--active' : ''}"
            @click=${() => { this._statusFilter = t.key; }}
          >
            ${t.key === 'all' ? msg('All') : t.label}
            <span class="status-tab__count">${t.key === 'all' ? this._queue.length : this._statusCount(t.key)}</span>
          </button>
        `)}
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
          ${hasImage
            ? html`<img src="${post.image_urls[0]}" alt="${post.alt_text ?? ''}" loading="lazy" />`
            : msg('N/A')
          }
        </div>

        <div class="dispatch__body">
          <div class="dispatch__header">
            <span class="dispatch__type-tag">${post.content_source_type}</span>
            ${post.simulation_name
              ? html`<span class="dispatch__shard">${post.simulation_name}</span>`
              : nothing
            }
            <span class="badge badge--${badgeColor}">${post.status}</span>
            <span class="dispatch__timestamp">
              ${post.status === 'published'
                ? this._formatDate(post.published_at)
                : post.status === 'scheduled'
                  ? this._formatDate(post.scheduled_at)
                  : this._formatDate(post.created_at)
              }
            </span>
          </div>

          <div class="dispatch__caption">${post.caption}</div>

          ${post.hashtags.length > 0 ? html`
            <div class="dispatch__tags">
              ${post.hashtags.map((h) => html`<span class="dispatch__tag">${h}</span>`)}
            </div>
          ` : nothing}

          ${post.status === 'published' ? html`
            <div class="dispatch__metrics">
              <span class="metric">${icons.sparkle(12)} ${this._formatNumber(post.likes_count)}</span>
              <span class="metric">${icons.messageCircle(12)} ${this._formatNumber(post.comments_count)}</span>
              <span class="metric metric--accent">${icons.stampClassified(12)} ${this._formatNumber(post.saves)}</span>
              <span class="metric">${icons.eye(12)} ${this._formatNumber(post.reach)}</span>
              <span class="metric metric--accent">${(post.engagement_rate * 100).toFixed(1)}%</span>
            </div>
          ` : nothing}

          ${post.failure_reason ? html`
            <div class="dispatch__failure">${post.failure_reason}</div>
          ` : nothing}
        </div>

        <div class="dispatch__actions">
          ${post.status === 'draft' ? html`
            <button class="act act--approve" ?disabled=${disabled} @click=${() => this._handleApprove(post)}>
              ${msg('Approve')}
            </button>
            <button class="act act--reject" ?disabled=${disabled} @click=${() => this._openRejectModal(post)}>
              ${msg('Reject')}
            </button>
            <button class="act act--publish" ?disabled=${disabled} @click=${() => this._handleForcePublish(post)}>
              ${msg('Publish')}
            </button>
          ` : nothing}

          ${post.status === 'scheduled' ? html`
            <button class="act act--publish" ?disabled=${disabled} @click=${() => this._handleForcePublish(post)}>
              ${msg('Publish Now')}
            </button>
            <button class="act act--reject" ?disabled=${disabled} @click=${() => this._openRejectModal(post)}>
              ${msg('Cancel')}
            </button>
          ` : nothing}

          ${post.status === 'published' && post.ig_permalink ? html`
            <a class="act act--link" href="${post.ig_permalink}" target="_blank" rel="noopener">
              ${msg('View on IG')}
            </a>
          ` : nothing}
        </div>
      </div>
    `;
  }

  private _renderCipherSection() {
    const cs = this._cipherStats;
    if (!cs) return nothing;

    return html`
      <div class="queue-section" style="margin-top: var(--space-8);">
        <div class="queue-header">
          <div class="queue-header__marker"></div>
          <div class="queue-header__title">${msg('Cipher Operations')}</div>
        </div>

        <div class="intel-grid" style="margin-top: var(--space-4);">
          <div class="intel-card">
            <div class="intel-card__corner intel-card__corner--tl"></div>
            <div class="intel-card__corner intel-card__corner--br"></div>
            <div class="intel-card__icon">${icons.key(14)}</div>
            <div class="intel-card__label">${msg('Total Redemptions')}</div>
            <div class="intel-card__value">${cs.total_redemptions}</div>
            <div class="intel-card__sub">${msg('all time')}</div>
          </div>

          <div class="intel-card">
            <div class="intel-card__corner intel-card__corner--tl"></div>
            <div class="intel-card__corner intel-card__corner--br"></div>
            <div class="intel-card__icon">${icons.users(14)}</div>
            <div class="intel-card__label">${msg('Unique Operatives')}</div>
            <div class="intel-card__value">${cs.unique_users}</div>
            <div class="intel-card__sub">${msg('authenticated users')}</div>
          </div>

          <div class="intel-card">
            <div class="intel-card__corner intel-card__corner--tl"></div>
            <div class="intel-card__corner intel-card__corner--br"></div>
            <div class="intel-card__icon">${icons.target(14)}</div>
            <div class="intel-card__label">${msg('Success Rate')}</div>
            <div class="intel-card__value">
              ${(cs.success_rate * 100).toFixed(1)}<span class="intel-card__value--unit">%</span>
            </div>
            <div class="intel-card__sub">
              ${msg(str`${cs.total_attempts} total attempts`)}
            </div>
          </div>
        </div>

        ${cs.recent_redemptions.length > 0
          ? html`
            <div class="cipher-table" style="margin-top: var(--space-4);">
              <div class="cipher-table__header">
                <span>${msg('Redeemed')}</span>
                <span>${msg('Reward')}</span>
                <span>${msg('User')}</span>
              </div>
              ${cs.recent_redemptions.slice(0, 10).map(
                (r: CipherRedemptionRecord) => html`
                  <div class="cipher-table__row">
                    <span>${this._formatDate(r.redeemed_at)}</span>
                    <span class="dispatch__type-tag">${r.reward_type}</span>
                    <span style="color: var(--color-text-muted)">
                      ${r.user_id ? r.user_id.slice(0, 8) + '…' : msg('Anonymous')}
                    </span>
                  </div>
                `,
              )}
            </div>
          `
          : html`
            <div class="empty-state" style="margin-top: var(--space-4);">
              ${msg('No cipher redemptions yet.')}
              <div class="empty-state__hint">
                ${msg('Ciphers are generated automatically when enabled in platform settings.')}
              </div>
            </div>
          `}
      </div>
    `;
  }

  private _renderRejectModal() {
    return html`
      <div class="reject-overlay" @click=${this._closeRejectModal}>
        <div class="reject-modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="reject-modal__title">${msg('Reject Dispatch')}</div>
          <div class="reject-modal__sub">${msg('Provide justification for the rejection record.')}</div>
          <textarea
            class="reject-modal__input"
            placeholder=${msg('Rejection reason (required)...')}
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
