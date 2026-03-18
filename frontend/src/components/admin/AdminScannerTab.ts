import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { scannerApi } from '../../services/api/index.js';
import type {
  AdapterInfo,
  ScanCandidate,
  ScanCycleMetrics,
  ScanLogEntry,
  ScannerDashboard,
  ScannerMetrics,
} from '../../services/api/ScannerApiService.js';
import { icons } from '../../utils/icons.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { VelgToast } from '../shared/Toast.js';

type ScannerView = 'dashboard' | 'candidates' | 'log';
type CandidateFilter = 'all' | 'pending' | 'approved' | 'rejected';

@localized()
@customElement('velg-admin-scanner-tab')
export class VelgAdminScannerTab extends LitElement {
  static styles = css`
    :host {
      display: block;
      color: var(--color-text-primary);
      font-family: var(--font-mono, monospace);
      position: relative;
    }

    /* ── CRT Atmosphere ──────────────────────────────────── */

    .scanner-shell {
      position: relative;
    }

    .scanner-shell::before {
      content: '';
      position: fixed;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(255 255 255 / 0.008) 2px,
        rgba(255 255 255 / 0.008) 4px
      );
      pointer-events: none;
      z-index: 1;
    }

    /* ── Header ──────────────────────────────────────────── */

    .scanner-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: var(--space-5);
      padding-bottom: var(--space-4);
      border-bottom: 2px solid var(--color-border);
      position: relative;
    }

    .scanner-header::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      width: 120px;
      height: 2px;
      background: var(--color-info);
      animation: header-reveal 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }

    @keyframes header-reveal {
      from { width: 0; }
      to { width: 120px; }
    }

    .scanner-header__title {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: clamp(1rem, 3vw, var(--text-xl));
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-text-primary);
    }

    .scanner-header__icon {
      color: var(--color-info);
      filter: drop-shadow(0 0 6px color-mix(in srgb, var(--color-info) 40%, transparent));
      animation: icon-glow 3s ease-in-out infinite alternate;
    }

    @keyframes icon-glow {
      0% { filter: drop-shadow(0 0 4px color-mix(in srgb, var(--color-info) 30%, transparent)); }
      100% { filter: drop-shadow(0 0 10px color-mix(in srgb, var(--color-info) 60%, transparent)); }
    }

    .scanner-header__subtitle {
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-text-muted);
      margin-top: var(--space-1);
      margin-left: calc(20px + var(--space-3));
    }

    .scanner-header__status {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-1) var(--space-3);
      border: 1px solid;
    }

    .scanner-header__status--active {
      color: var(--color-success);
      border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
      background: color-mix(in srgb, var(--color-success) 5%, transparent);
    }

    .scanner-header__status--inactive {
      color: var(--color-text-muted);
      border-color: var(--color-border);
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .status-dot--live {
      background: var(--color-success);
      animation: status-blink 1.5s ease-in-out infinite alternate;
    }

    .status-dot--off {
      background: var(--color-text-muted);
    }

    @keyframes status-blink {
      0% { opacity: 1; box-shadow: 0 0 4px var(--color-success); }
      100% { opacity: 0.3; box-shadow: none; }
    }

    /* ── Sub-nav ─────────────────────────────────────────── */

    .sub-nav {
      display: flex;
      gap: 0;
      border-bottom: 1px solid var(--color-border);
      margin-bottom: var(--space-5);
    }

    .sub-nav__btn {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-2) var(--space-4);
      background: none;
      border: none;
      color: var(--color-text-muted);
      cursor: pointer;
      position: relative;
      transition: color 0.2s ease, background 0.2s ease;
    }

    .sub-nav__btn:hover {
      color: var(--color-text-primary);
      background: rgba(255 255 255 / 0.02);
    }

    .sub-nav__btn--active {
      color: var(--color-info);
    }

    .sub-nav__btn--active::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--color-info);
      box-shadow: 0 0 8px color-mix(in srgb, var(--color-info) 40%, transparent);
    }

    .sub-nav__badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      margin-left: var(--space-2);
      font-size: 9px;
      font-weight: var(--font-black);
      background: var(--color-info);
      color: var(--color-surface);
      border-radius: 9px;
      animation: badge-pulse 2s ease-in-out infinite;
    }

    @keyframes badge-pulse {
      0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-info) 40%, transparent); }
      50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-info) 0%, transparent); }
    }

    /* ── Sensor Grid ─────────────────────────────────────── */

    .section-label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-text-muted);
      margin-bottom: var(--space-3);
      padding-bottom: var(--space-2);
      border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .section-label::before {
      content: '';
      width: 4px;
      height: 4px;
      background: var(--color-info);
      flex-shrink: 0;
    }

    .sensor-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: var(--space-3);
      margin-bottom: var(--space-6);
      position: relative;
    }

    .adapter-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      padding: var(--space-3);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      position: relative;
      transition: border-color 0.2s ease, box-shadow 0.3s ease;
      animation: card-enter 0.4s cubic-bezier(0.22, 1, 0.36, 1) backwards;
    }

    .adapter-card:nth-child(1) { animation-delay: 0.05s; }
    .adapter-card:nth-child(2) { animation-delay: 0.1s; }
    .adapter-card:nth-child(3) { animation-delay: 0.15s; }
    .adapter-card:nth-child(4) { animation-delay: 0.2s; }
    .adapter-card:nth-child(5) { animation-delay: 0.25s; }
    .adapter-card:nth-child(6) { animation-delay: 0.3s; }
    .adapter-card:nth-child(7) { animation-delay: 0.35s; }
    .adapter-card:nth-child(8) { animation-delay: 0.4s; }
    .adapter-card:nth-child(9) { animation-delay: 0.45s; }
    .adapter-card:nth-child(10) { animation-delay: 0.5s; }

    @keyframes card-enter {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.97);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* Corner markers — surveillance camera frame feel */
    .adapter-card::before,
    .adapter-card::after {
      content: '';
      position: absolute;
      width: 8px;
      height: 8px;
      border-color: color-mix(in srgb, var(--color-info) 30%, transparent);
      border-style: solid;
      transition: border-color 0.3s ease;
    }

    .adapter-card::before {
      top: -1px;
      left: -1px;
      border-width: 1px 0 0 1px;
    }

    .adapter-card::after {
      bottom: -1px;
      right: -1px;
      border-width: 0 1px 1px 0;
    }

    .adapter-card:hover {
      border-color: var(--color-text-muted);
      box-shadow: 0 0 16px color-mix(in srgb, var(--color-info) 8%, transparent);
    }

    .adapter-card:hover::before,
    .adapter-card:hover::after {
      border-color: var(--color-info);
    }

    .adapter-card--unavailable {
      opacity: 0.4;
      border-style: dashed;
    }

    .adapter-card--unavailable::before,
    .adapter-card--unavailable::after {
      border-color: color-mix(in srgb, var(--color-danger) 20%, transparent);
    }

    .adapter-card__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .adapter-card__dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .adapter-card__dot--online {
      background: var(--color-success);
      box-shadow: 0 0 6px var(--color-success);
      animation: dot-pulse 1.5s ease-in-out infinite alternate;
    }

    .adapter-card__dot--offline {
      background: var(--color-danger);
      opacity: 0.6;
    }

    @keyframes dot-pulse {
      0% { opacity: 1; box-shadow: 0 0 6px var(--color-success); }
      100% { opacity: 0.4; box-shadow: 0 0 2px var(--color-success); }
    }

    .adapter-card__categories {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .category-badge {
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: 1px var(--space-1);
      border: 1px solid color-mix(in srgb, var(--color-info) 40%, transparent);
      color: var(--color-info);
      background: color-mix(in srgb, var(--color-info) 4%, transparent);
    }

    .adapter-card__type {
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .adapter-card__type--structured {
      color: var(--color-success);
    }

    .adapter-card__type--llm {
      color: var(--color-warning);
    }

    .adapter-card__interval {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      color: var(--color-text-secondary);
      margin-top: auto;
    }

    /* ── Metrics Panel ───────────────────────────────────── */

    .metrics-panel {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: var(--space-4);
      padding: var(--space-5);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      margin-bottom: var(--space-6);
      position: relative;
      overflow: hidden;
    }

    /* Subtle sweep animation across metrics panel */
    .metrics-panel::after {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 60%;
      height: 100%;
      background: linear-gradient(
        90deg,
        transparent,
        color-mix(in srgb, var(--color-info) 3%, transparent),
        transparent
      );
      animation: metrics-sweep 8s ease-in-out infinite;
      pointer-events: none;
    }

    @keyframes metrics-sweep {
      0% { left: -60%; }
      50% { left: 100%; }
      100% { left: 100%; }
    }

    .metric {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
      position: relative;
      z-index: 1;
    }

    .metric__value {
      font-family: var(--font-brutalist);
      font-size: clamp(1.5rem, 4vw, var(--text-3xl));
      font-weight: var(--font-black);
      color: var(--color-text-primary);
      line-height: 1;
      letter-spacing: -0.02em;
    }

    .metric__label {
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      color: var(--color-text-muted);
      text-align: center;
    }

    /* ── Action Buttons ──────────────────────────────────── */

    .actions-row {
      display: flex;
      gap: var(--space-3);
      align-items: center;
      margin-bottom: var(--space-6);
    }

    .trigger-scan-btn {
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: color-mix(in srgb, var(--color-info) 12%, var(--color-surface));
      color: var(--color-info);
      border: 1px solid var(--color-info);
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      position: relative;
      overflow: hidden;
    }

    .trigger-scan-btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        90deg,
        transparent,
        color-mix(in srgb, var(--color-info) 15%, transparent),
        transparent
      );
      transition: left 0.4s ease;
    }

    .trigger-scan-btn:hover::before {
      left: 100%;
    }

    .trigger-scan-btn:hover {
      background: color-mix(in srgb, var(--color-info) 20%, var(--color-surface));
      transform: translateY(-1px);
      box-shadow:
        0 0 12px color-mix(in srgb, var(--color-info) 25%, transparent),
        inset 0 0 20px color-mix(in srgb, var(--color-info) 5%, transparent);
    }

    .trigger-scan-btn:active {
      transform: translateY(0);
    }

    .trigger-scan-btn--scanning {
      animation: scan-active 1.2s ease-in-out infinite;
      pointer-events: none;
    }

    .trigger-scan-btn--scanning svg {
      animation: radar-spin 1s linear infinite;
    }

    @keyframes scan-active {
      0%, 100% {
        box-shadow: 0 0 8px color-mix(in srgb, var(--color-info) 20%, transparent);
      }
      50% {
        box-shadow:
          0 0 20px color-mix(in srgb, var(--color-info) 40%, transparent),
          inset 0 0 30px color-mix(in srgb, var(--color-info) 8%, transparent);
      }
    }

    @keyframes radar-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .scan-info {
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-secondary);
    }

    /* ── Candidate List ──────────────────────────────────── */

    .filter-row {
      display: flex;
      gap: var(--space-2);
      margin-bottom: var(--space-4);
      align-items: center;
    }

    .filter-btn {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-1) var(--space-3);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      color: var(--color-text-muted);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .filter-btn:hover {
      border-color: var(--color-text-muted);
      color: var(--color-text-primary);
    }

    .filter-btn--active {
      color: var(--color-info);
      border-color: var(--color-info);
      background: color-mix(in srgb, var(--color-info) 8%, var(--color-surface));
      box-shadow: 0 0 8px color-mix(in srgb, var(--color-info) 10%, transparent);
    }

    .recommended-summary {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      color: var(--color-warning);
      letter-spacing: var(--tracking-wide);
      margin-left: auto;
    }

    .candidate-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: var(--space-4);
    }

    /* ── Candidate Card ────────────────────────────────────── */

    .candidate-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      display: flex;
      flex-direction: column;
      position: relative;
      transition: border-color 0.2s ease, box-shadow 0.3s ease, transform 0.2s ease;
      animation: card-enter 0.4s cubic-bezier(0.22, 1, 0.36, 1) backwards;
      overflow: hidden;
    }

    .candidate-card:nth-child(1) { animation-delay: 0.03s; }
    .candidate-card:nth-child(2) { animation-delay: 0.06s; }
    .candidate-card:nth-child(3) { animation-delay: 0.09s; }
    .candidate-card:nth-child(4) { animation-delay: 0.12s; }
    .candidate-card:nth-child(5) { animation-delay: 0.15s; }
    .candidate-card:nth-child(6) { animation-delay: 0.18s; }
    .candidate-card:nth-child(7) { animation-delay: 0.21s; }
    .candidate-card:nth-child(8) { animation-delay: 0.24s; }

    @keyframes card-enter {
      from {
        opacity: 0;
        transform: translateY(12px) scale(0.97);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .candidate-card:hover {
      border-color: var(--color-text-muted);
      box-shadow:
        0 4px 20px color-mix(in srgb, var(--color-info) 6%, transparent),
        0 0 1px color-mix(in srgb, var(--color-info) 15%, transparent);
      transform: translateY(-2px);
    }

    /* Colored top edge by source type */
    .candidate-card--structured {
      border-top: 3px solid var(--color-success);
    }

    .candidate-card--llm {
      border-top: 3px solid var(--color-warning);
    }

    /* Recommended card glow */
    .candidate-card--recommended {
      border-color: color-mix(in srgb, var(--color-warning) 40%, var(--color-border));
      box-shadow: 0 0 12px color-mix(in srgb, var(--color-warning) 8%, transparent);
    }

    .candidate-card--recommended:hover {
      border-color: var(--color-warning);
      box-shadow:
        0 4px 24px color-mix(in srgb, var(--color-warning) 12%, transparent),
        0 0 1px var(--color-warning);
    }

    /* Card header — category + magnitude readout */
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid color-mix(in srgb, var(--color-border) 40%, transparent);
      gap: var(--space-2);
    }

    .card-header__left {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-width: 0;
    }

    .recommended-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-warning);
      border: 1px solid var(--color-warning);
      padding: 1px var(--space-1);
      flex-shrink: 0;
      animation: badge-glow 2s ease-in-out infinite alternate;
    }

    .recommended-badge::before {
      content: '◆';
      font-size: 6px;
    }

    @keyframes badge-glow {
      0% { box-shadow: 0 0 2px color-mix(in srgb, var(--color-warning) 10%, transparent); }
      100% { box-shadow: 0 0 8px color-mix(in srgb, var(--color-warning) 25%, transparent); }
    }

    .magnitude-readout {
      display: flex;
      align-items: baseline;
      gap: var(--space-1);
      flex-shrink: 0;
    }

    .magnitude-readout__value {
      font-family: var(--font-brutalist);
      font-size: var(--text-lg);
      font-weight: var(--font-black);
      line-height: 1;
      letter-spacing: -0.02em;
    }

    .magnitude-readout__value--low { color: var(--color-info); }
    .magnitude-readout__value--mid { color: var(--color-warning); }
    .magnitude-readout__value--high { color: var(--color-danger); }

    .magnitude-readout__label {
      font-family: var(--font-brutalist);
      font-size: 8px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-text-muted);
    }

    /* Magnitude bar (horizontal) */
    .magnitude-bar {
      display: flex;
      gap: 1px;
      align-items: center;
      padding: 0 var(--space-4);
    }

    .magnitude-bar__segment {
      flex: 1;
      height: 3px;
      background: color-mix(in srgb, var(--color-info) 10%, var(--color-surface));
      transition: background 0.3s ease;
    }

    .magnitude-bar__segment--filled-low { background: var(--color-info); }
    .magnitude-bar__segment--filled-mid { background: var(--color-warning); }
    .magnitude-bar__segment--filled-high { background: var(--color-danger); }

    /* Card body — title + meta */
    .card-body {
      padding: var(--space-3) var(--space-4);
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .candidate__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      color: var(--color-text-primary);
      line-height: 1.4;
    }

    .candidate-card--recommended .candidate__title {
      color: var(--color-text-primary);
    }

    .candidate__meta {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .candidate__reason {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      color: var(--color-text-muted);
      font-style: italic;
      line-height: 1.4;
    }

    /* Inline dispatch preview (truncated) */
    .card-dispatch-preview {
      font-family: var(--font-brutalist);
      font-size: 11px;
      color: var(--color-text-secondary);
      line-height: 1.6;
      padding: var(--space-2) var(--space-3);
      background: color-mix(in srgb, var(--color-info) 3%, var(--color-surface));
      border-left: 2px solid color-mix(in srgb, var(--color-info) 30%, transparent);
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      position: relative;
    }

    .card-dispatch-preview::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 16px;
      background: linear-gradient(transparent, color-mix(in srgb, var(--color-info) 3%, var(--color-surface)));
      pointer-events: none;
    }

    /* Card footer — actions */
    .card-footer {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4) var(--space-3);
      border-top: 1px solid color-mix(in srgb, var(--color-border) 30%, transparent);
      margin-top: auto;
    }

    .card-footer__source {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-muted);
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .action-btn {
      padding: var(--space-1) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .action-btn:hover {
      border-color: var(--color-text-muted);
      color: var(--color-text-primary);
      transform: translateY(-1px);
    }

    .action-btn:disabled {
      opacity: 0.4;
      pointer-events: none;
    }

    .action-btn--approve {
      color: var(--color-success);
      border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
    }

    .action-btn--approve:hover {
      background: color-mix(in srgb, var(--color-success) 10%, var(--color-surface));
      border-color: var(--color-success);
      box-shadow: 0 0 8px color-mix(in srgb, var(--color-success) 15%, transparent);
    }

    .action-btn--reject {
      color: var(--color-danger);
      border-color: color-mix(in srgb, var(--color-danger) 40%, transparent);
    }

    .action-btn--reject:hover {
      background: color-mix(in srgb, var(--color-danger) 10%, var(--color-surface));
      border-color: var(--color-danger);
      box-shadow: 0 0 8px color-mix(in srgb, var(--color-danger) 15%, transparent);
    }

    /* ── Expanded Detail ─────────────────────────────────── */

    .candidate-detail {
      padding: var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-top: none;
      margin-top: -1px;
      animation: detail-open 0.25s cubic-bezier(0.22, 1, 0.36, 1);
    }

    @keyframes detail-open {
      from {
        opacity: 0;
        max-height: 0;
        padding-top: 0;
        padding-bottom: 0;
      }
      to {
        opacity: 1;
        max-height: 800px;
      }
    }

    .candidate__dispatch-preview {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      padding: var(--space-4);
      background:
        linear-gradient(135deg,
          color-mix(in srgb, var(--color-info) 4%, var(--color-surface)) 0%,
          var(--color-surface) 100%
        );
      border-left: 3px solid var(--color-info);
      line-height: 1.7;
      white-space: pre-wrap;
      position: relative;
    }

    .candidate__dispatch-preview::before {
      content: 'CLASSIFIED';
      position: absolute;
      top: var(--space-2);
      right: var(--space-3);
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-black);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: color-mix(in srgb, var(--color-danger) 30%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-danger) 20%, transparent);
      padding: 1px var(--space-2);
    }

    .detail-label {
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      margin-bottom: var(--space-2);
      margin-top: var(--space-4);
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .detail-label::before {
      content: '';
      width: 3px;
      height: 3px;
      background: var(--color-text-muted);
      flex-shrink: 0;
    }

    .detail-label:first-child {
      margin-top: 0;
    }

    .raw-data {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      background: var(--color-surface-sunken);
      padding: var(--space-3);
      overflow-x: auto;
      max-height: 200px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
      border: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
    }

    .source-link {
      font-size: var(--text-xs);
      color: var(--color-info);
      text-decoration: none;
      border-bottom: 1px solid color-mix(in srgb, var(--color-info) 30%, transparent);
      transition: border-color 0.15s ease;
    }

    .source-link:hover {
      border-color: var(--color-info);
    }

    /* ── Scan Log ────────────────────────────────────────── */

    .log-table {
      width: 100%;
      border-collapse: collapse;
    }

    .log-table th {
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      padding: var(--space-2) var(--space-3);
      text-align: left;
      border-bottom: 2px solid var(--color-border);
      position: sticky;
      top: 0;
      background: var(--color-surface);
      z-index: 1;
    }

    .log-table td {
      padding: var(--space-2) var(--space-3);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      border-bottom: 1px solid color-mix(in srgb, var(--color-border) 25%, transparent);
      transition: background 0.1s ease;
    }

    .log-table tr:hover td {
      background: color-mix(in srgb, var(--color-info) 3%, transparent);
    }

    .log-table__title {
      max-width: 400px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .log-classified {
      color: var(--color-success);
    }

    .log-unclassified {
      color: var(--color-text-muted);
    }

    /* ── States ───────────────────────────────────────────── */

    .error-banner {
      padding: var(--space-3);
      background: color-mix(in srgb, var(--color-danger) 8%, var(--color-surface));
      border: 1px solid var(--color-danger);
      color: var(--color-danger);
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      margin-bottom: var(--space-4);
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .loading-state {
      padding: var(--space-8);
      text-align: center;
      color: var(--color-text-muted);
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      position: relative;
    }

    .loading-state::after {
      content: '';
      display: block;
      width: 40px;
      height: 2px;
      background: var(--color-info);
      margin: var(--space-3) auto 0;
      animation: loading-bar 1.5s ease-in-out infinite;
    }

    @keyframes loading-bar {
      0% { width: 20px; opacity: 0.3; }
      50% { width: 60px; opacity: 1; }
      100% { width: 20px; opacity: 0.3; }
    }

    .empty-state {
      padding: var(--space-8) var(--space-4);
      text-align: center;
      color: var(--color-text-muted);
      font-size: var(--text-sm);
      font-family: var(--font-brutalist);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .status-badge {
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: 1px var(--space-2);
      border: 1px solid;
    }

    .status-badge--pending {
      color: var(--color-warning);
      border-color: color-mix(in srgb, var(--color-warning) 40%, transparent);
      background: color-mix(in srgb, var(--color-warning) 5%, transparent);
    }

    .status-badge--approved, .status-badge--created {
      color: var(--color-success);
      border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
      background: color-mix(in srgb, var(--color-success) 5%, transparent);
    }

    .status-badge--rejected {
      color: var(--color-danger);
      border-color: color-mix(in srgb, var(--color-danger) 40%, transparent);
      background: color-mix(in srgb, var(--color-danger) 5%, transparent);
    }

    .meta-text {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
    }

    @media (max-width: 768px) {
      .candidate-grid {
        grid-template-columns: 1fr;
      }

      .card-footer {
        flex-wrap: wrap;
      }

      .sensor-grid {
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: var(--space-2);
      }
    }
  `;

  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _view: ScannerView = 'dashboard';
  @state() private _dashboard: ScannerDashboard | null = null;
  @state() private _candidates: ScanCandidate[] = [];
  @state() private _candidateFilter: CandidateFilter = 'pending';
  @state() private _scanLog: ScanLogEntry[] = [];
  @state() private _scanning = false;
  @state() private _actionInProgress: string | null = null;
  @state() private _expandedId: string | null = null;
  @state() private _recommendedThreshold = 0.6;

  connectedCallback(): void {
    super.connectedCallback();
    this._loadDashboard();
  }

  private async _loadDashboard(): Promise<void> {
    this._loading = true;
    this._error = null;
    try {
      const resp = await scannerApi.getDashboard();
      if (resp.success && resp.data) {
        this._dashboard = resp.data;
      } else {
        this._error = resp.error?.message ?? msg('Failed to load scanner dashboard');
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('Failed to load');
    } finally {
      this._loading = false;
    }
  }

  private async _loadCandidates(): Promise<void> {
    this._loading = true;
    try {
      const params: Record<string, string> = { limit: '50' };
      if (this._candidateFilter !== 'all') {
        params.status = this._candidateFilter === 'approved' ? 'created' : this._candidateFilter;
      }
      const resp = await scannerApi.listCandidates(params);
      if (resp.success && resp.data) {
        // Sort by magnitude DESC — best candidates first
        this._candidates = resp.data.sort((a, b) => b.magnitude - a.magnitude);
        // Use API-provided threshold (top-20% of pending, min 0.4)
        const meta = (resp as unknown as { meta?: { recommended_threshold?: number } }).meta;
        if (meta?.recommended_threshold !== undefined) {
          this._recommendedThreshold = meta.recommended_threshold;
        }
      } else {
        VelgToast.error(resp.error?.message ?? msg('Failed to load candidates'));
      }
    } catch {
      VelgToast.error(msg('Failed to load candidates'));
    } finally {
      this._loading = false;
    }
  }

  private async _loadScanLog(): Promise<void> {
    this._loading = true;
    try {
      const resp = await scannerApi.getScanLog({ limit: '100' });
      if (resp.success && resp.data) {
        this._scanLog = resp.data;
      } else {
        VelgToast.error(resp.error?.message ?? msg('Failed to load scan log'));
      }
    } catch {
      VelgToast.error(msg('Failed to load scan log'));
    } finally {
      this._loading = false;
    }
  }

  private async _triggerScan(): Promise<void> {
    this._scanning = true;
    try {
      const resp = await scannerApi.triggerScan();
      if (resp.success && resp.data) {
        const m = resp.data as ScanCycleMetrics;
        VelgToast.success(
          msg(
            str`Scan complete: ${m.total_fetched} fetched, ${m.total_new} new, ${m.resonances_created + m.candidates_staged} staged`,
          ),
        );
        await this._loadDashboard();
      } else {
        VelgToast.error(resp.error?.message ?? msg('Scan failed'));
      }
    } catch {
      VelgToast.error(msg('Scan failed'));
    } finally {
      this._scanning = false;
    }
  }

  private async _approveCandidate(candidate: ScanCandidate): Promise<void> {
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Approve Candidate'),
      message: msg(str`Approve "${candidate.title}" and create a substrate resonance?`),
      confirmLabel: msg('Approve'),
    });
    if (!confirmed) return;

    this._actionInProgress = candidate.id;
    try {
      const resp = await scannerApi.approveCandidate(candidate.id);
      if (resp.success) {
        VelgToast.success(msg('Candidate approved — resonance created.'));
        await this._loadCandidates();
      } else {
        VelgToast.error(resp.error?.message ?? msg('Failed to approve'));
      }
    } catch {
      VelgToast.error(msg('Failed to approve'));
    } finally {
      this._actionInProgress = null;
    }
  }

  private async _rejectCandidate(candidate: ScanCandidate): Promise<void> {
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Reject Candidate'),
      message: msg(str`Reject "${candidate.title}"? This cannot be undone.`),
      confirmLabel: msg('Reject'),
      variant: 'danger',
    });
    if (!confirmed) return;

    this._actionInProgress = candidate.id;
    try {
      const resp = await scannerApi.rejectCandidate(candidate.id);
      if (resp.success) {
        VelgToast.success(msg('Candidate rejected.'));
        await this._loadCandidates();
      } else {
        VelgToast.error(resp.error?.message ?? msg('Failed to reject'));
      }
    } catch {
      VelgToast.error(msg('Failed to reject'));
    } finally {
      this._actionInProgress = null;
    }
  }

  private _setView(view: ScannerView): void {
    this._view = view;
    if (view === 'dashboard') this._loadDashboard();
    else if (view === 'candidates') this._loadCandidates();
    else if (view === 'log') this._loadScanLog();
  }

  private _setCandidateFilter(filter: CandidateFilter): void {
    this._candidateFilter = filter;
    this._loadCandidates();
  }

  private _toggleExpand(id: string): void {
    this._expandedId = this._expandedId === id ? null : id;
  }

  protected render() {
    const pendingCount = this._dashboard?.metrics?.pending_candidates ?? 0;
    const isEnabled = this._dashboard?.config?.enabled ?? false;

    return html`
      <div class="scanner-shell">
        <div class="scanner-header">
          <div>
            <div class="scanner-header__title">
              <span class="scanner-header__icon">${icons.antenna(22)}</span>
              ${msg('Substrate Scanner')}
            </div>
            <div class="scanner-header__subtitle">${msg('Bureau of Substrate Monitoring')}</div>
          </div>
          <div class="scanner-header__status ${isEnabled ? 'scanner-header__status--active' : 'scanner-header__status--inactive'}">
            <span class="status-dot ${isEnabled ? 'status-dot--live' : 'status-dot--off'}"></span>
            ${isEnabled ? msg('Active') : msg('Inactive')}
          </div>
        </div>

        <nav class="sub-nav" role="tablist" aria-label=${msg('Scanner views')}>
          <button
            class="sub-nav__btn ${this._view === 'dashboard' ? 'sub-nav__btn--active' : ''}"
            role="tab"
            aria-selected=${this._view === 'dashboard'}
            @click=${() => this._setView('dashboard')}
          >${msg('Dashboard')}</button>
          <button
            class="sub-nav__btn ${this._view === 'candidates' ? 'sub-nav__btn--active' : ''}"
            role="tab"
            aria-selected=${this._view === 'candidates'}
            @click=${() => this._setView('candidates')}
          >
            ${msg('Candidates')}
            ${pendingCount > 0 ? html`<span class="sub-nav__badge" aria-label=${msg(str`${pendingCount} pending`)}>${pendingCount}</span>` : nothing}
          </button>
          <button
            class="sub-nav__btn ${this._view === 'log' ? 'sub-nav__btn--active' : ''}"
            role="tab"
            aria-selected=${this._view === 'log'}
            @click=${() => this._setView('log')}
          >${msg('Scan Log')}</button>
        </nav>

        ${this._error ? html`<div class="error-banner" role="alert">${icons.alertTriangle(14)} ${this._error}</div>` : nothing}
        <div role="tabpanel" aria-label=${msg('Scanner content')}>
          ${this._loading && !this._dashboard ? html`<div class="loading-state" aria-live="polite">${msg('Initializing sensors...')}</div>` : this._renderView()}
        </div>
      </div>
    `;
  }

  private _renderView() {
    switch (this._view) {
      case 'dashboard':
        return this._renderDashboard();
      case 'candidates':
        return this._renderCandidates();
      case 'log':
        return this._renderScanLog();
    }
  }

  // ── Dashboard ────────────────────────────────────────────

  private _renderDashboard() {
    if (!this._dashboard) return nothing;

    const { adapters, metrics } = this._dashboard;

    return html`
      ${this._renderMetrics(metrics)}

      <div class="actions-row">
        <button
          class="trigger-scan-btn ${this._scanning ? 'trigger-scan-btn--scanning' : ''}"
          ?disabled=${this._scanning}
          @click=${this._triggerScan}
        >
          ${icons.radar(14)}
          ${this._scanning ? msg('Scanning...') : msg('Trigger Scan')}
        </button>
        ${
          metrics.last_scan
            ? html`<span class="scan-info">${msg('Last scan:')} ${this._relativeTime(metrics.last_scan)}</span>`
            : html`<span class="scan-info">${msg('No scans yet')}</span>`
        }
      </div>

      <div class="section-label">${msg('Sensor Network')}</div>
      <div class="sensor-grid">
        ${adapters.map((a) => this._renderAdapterCard(a))}
      </div>
    `;
  }

  private _renderMetrics(metrics: ScannerMetrics) {
    return html`
      <div class="metrics-panel">
        <div class="metric">
          <span class="metric__value">${metrics.scanned_today}</span>
          <span class="metric__label">${msg('Articles Scanned')}</span>
        </div>
        <div class="metric">
          <span class="metric__value">${metrics.classified_today}</span>
          <span class="metric__label">${msg('Classified')}</span>
        </div>
        <div class="metric">
          <span class="metric__value">${metrics.resonances_today}</span>
          <span class="metric__label">${msg('Resonances Today')}</span>
        </div>
        <div class="metric">
          <span class="metric__value">${metrics.pending_candidates}</span>
          <span class="metric__label">${msg('Pending Review')}</span>
        </div>
      </div>
    `;
  }

  private _renderAdapterCard(adapter: AdapterInfo) {
    const isAvailable = adapter.available && adapter.enabled;

    return html`
      <div class="adapter-card ${!isAvailable ? 'adapter-card--unavailable' : ''}">
        <div class="adapter-card__name">
          <span class="adapter-card__dot ${isAvailable ? 'adapter-card__dot--online' : 'adapter-card__dot--offline'}"></span>
          ${adapter.display_name}
        </div>
        <div class="adapter-card__categories">
          ${adapter.categories.map(
            (c) => html`<span class="category-badge">${c.replace('_', ' ')}</span>`,
          )}
        </div>
        <span class="adapter-card__type ${adapter.is_structured ? 'adapter-card__type--structured' : 'adapter-card__type--llm'}">
          ${adapter.is_structured ? msg('Structured') : msg('LLM Required')}
        </span>
        ${
          !adapter.available && adapter.requires_api_key
            ? html`<span class="adapter-card__type" style="color: var(--color-danger)">${msg('No API Key')}</span>`
            : nothing
        }
        <span class="adapter-card__interval">${this._formatInterval(adapter.default_interval)}</span>
      </div>
    `;
  }

  // ── Candidates ───────────────────────────────────────────

  private _renderCandidates() {
    const filters: CandidateFilter[] = ['all', 'pending', 'approved', 'rejected'];
    const threshold = this._recommendedThreshold;
    const recommendedCount = this._candidates.filter(
      (c) => c.status === 'pending' && c.magnitude >= threshold,
    ).length;

    return html`
      <div class="filter-row">
        ${filters.map(
          (f) => html`
            <button
              class="filter-btn ${this._candidateFilter === f ? 'filter-btn--active' : ''}"
              @click=${() => this._setCandidateFilter(f)}
            >${f === 'all' ? msg('All') : f === 'pending' ? msg('Pending') : f === 'approved' ? msg('Approved') : msg('Rejected')}</button>
          `,
        )}
        ${
          recommendedCount > 0
            ? html`<span class="recommended-summary">${msg(str`◆ ${recommendedCount} recommended`)}</span>`
            : nothing
        }
      </div>

      ${
        this._loading
          ? html`<div class="loading-state">${msg('Scanning records...')}</div>`
          : this._candidates.length === 0
            ? html`<div class="empty-state">${msg('No candidates found.')}</div>`
            : html`
              <div class="candidate-grid">
                ${this._candidates.map((c) => this._renderCandidate(c, threshold))}
              </div>
            `
      }
    `;
  }

  private _renderCandidate(c: ScanCandidate, threshold = 0.6) {
    const isExpanded = this._expandedId === c.id;
    const isRecommended = c.status === 'pending' && c.magnitude >= threshold;
    const magTier = c.magnitude >= 0.7 ? 'high' : c.magnitude >= 0.4 ? 'mid' : 'low';

    return html`
      <div class="candidate-card ${c.is_structured ? 'candidate-card--structured' : 'candidate-card--llm'} ${isRecommended ? 'candidate-card--recommended' : ''}">
        <div class="card-header">
          <div class="card-header__left">
            <span class="category-badge">${c.source_category.replace('_', ' ')}</span>
            ${isRecommended ? html`<span class="recommended-badge">${msg('Recommended')}</span>` : nothing}
            <span class="status-badge status-badge--${c.status}">${c.status}</span>
          </div>
          <div class="magnitude-readout">
            <span class="magnitude-readout__value magnitude-readout__value--${magTier}">${c.magnitude.toFixed(2)}</span>
            <span class="magnitude-readout__label">${msg('MAG')}</span>
          </div>
        </div>

        ${this._renderMagnitudeBar(c.magnitude)}

        <div class="card-body">
          <div class="candidate__title">${c.title}</div>
          ${
            c.classification_reason
              ? html`<div class="candidate__reason">${c.classification_reason}</div>`
              : nothing
          }
          ${
            c.bureau_dispatch && !isExpanded
              ? html`<div class="card-dispatch-preview">${c.bureau_dispatch}</div>`
              : nothing
          }
        </div>

        <div class="card-footer">
          <span class="card-footer__source">${c.source_adapter} · ${this._relativeTime(c.created_at)}</span>
          ${
            c.status === 'pending'
              ? html`
                <button
                  class="action-btn action-btn--approve"
                  ?disabled=${this._actionInProgress === c.id}
                  @click=${() => this._approveCandidate(c)}
                  aria-label=${msg(str`Approve ${c.title}`)}
                >${msg('Approve')}</button>
                <button
                  class="action-btn action-btn--reject"
                  ?disabled=${this._actionInProgress === c.id}
                  @click=${() => this._rejectCandidate(c)}
                  aria-label=${msg(str`Reject ${c.title}`)}
                >${msg('Reject')}</button>
              `
              : nothing
          }
          <button class="action-btn" @click=${() => this._toggleExpand(c.id)}>
            ${isExpanded ? msg('Hide') : msg('Detail')}
          </button>
        </div>

        ${isExpanded ? this._renderCandidateDetail(c) : nothing}
      </div>
    `;
  }

  private _renderCandidateDetail(c: ScanCandidate) {
    return html`
      <div class="candidate-detail">
        ${
          c.article_url
            ? html`
              <div class="detail-label">${msg('Source')}</div>
              <a class="source-link" href=${c.article_url} target="_blank" rel="noopener">${c.article_url}</a>
            `
            : nothing
        }

        ${
          c.bureau_dispatch
            ? html`
              <div class="detail-label">${msg('Bureau Dispatch')}</div>
              <div class="candidate__dispatch-preview">${c.bureau_dispatch}</div>
            `
            : nothing
        }

        ${
          c.article_raw_data
            ? html`
              <div class="detail-label">${msg('Raw Data')}</div>
              <pre class="raw-data">${JSON.stringify(c.article_raw_data, null, 2)}</pre>
            `
            : nothing
        }
      </div>
    `;
  }

  private _renderMagnitudeBar(magnitude: number) {
    const filled = Math.round(magnitude * 10);
    return html`
      <div class="magnitude-bar">
        ${Array.from({ length: 10 }, (_, i) => {
          if (i >= filled) {
            return html`<span class="magnitude-bar__segment"></span>`;
          }
          const tier = i < 3 ? 'low' : i < 6 ? 'mid' : 'high';
          return html`<span class="magnitude-bar__segment magnitude-bar__segment--filled-${tier}"></span>`;
        })}
      </div>
    `;
  }

  // ── Scan Log ─────────────────────────────────────────────

  private _renderScanLog() {
    if (this._loading) {
      return html`<div class="loading-state">${msg('Loading records...')}</div>`;
    }

    if (this._scanLog.length === 0) {
      return html`<div class="empty-state">${msg('No scan log entries yet.')}</div>`;
    }

    return html`
      <table class="log-table" aria-label=${msg('Scan history log')}>
        <thead>
          <tr>
            <th>${msg('Source')}</th>
            <th>${msg('Title')}</th>
            <th>${msg('Category')}</th>
            <th>${msg('Magnitude')}</th>
            <th>${msg('Scanned')}</th>
          </tr>
        </thead>
        <tbody>
          ${this._scanLog.map(
            (entry) => html`
              <tr>
                <td><span class="${entry.classified ? 'log-classified' : 'log-unclassified'}">${entry.source_name}</span></td>
                <td class="log-table__title">${entry.title}</td>
                <td>${entry.source_category ? html`<span class="category-badge">${entry.source_category.replace('_', ' ')}</span>` : html`<span class="meta-text">&mdash;</span>`}</td>
                <td>${entry.magnitude != null ? entry.magnitude.toFixed(2) : html`<span class="meta-text">&mdash;</span>`}</td>
                <td class="meta-text">${this._relativeTime(entry.scanned_at)}</td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    `;
  }

  // ── Helpers ──────────────────────────────────────────────

  private _relativeTime(iso: string): string {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diffMs = now - then;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return msg('just now');
    if (mins < 60) return msg(str`${mins}m ago`);
    const hours = Math.floor(mins / 60);
    if (hours < 24) return msg(str`${hours}h ago`);
    const days = Math.floor(hours / 24);
    return msg(str`${days}d ago`);
  }

  private _formatInterval(seconds: number): string {
    if (seconds >= 3600) return msg(str`${Math.round(seconds / 3600)}h interval`);
    return msg(str`${Math.round(seconds / 60)}m interval`);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-scanner-tab': VelgAdminScannerTab;
  }
}
