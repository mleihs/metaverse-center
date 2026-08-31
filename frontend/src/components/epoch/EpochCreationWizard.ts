/**
 * Epoch Creation Wizard — 4-step modal for configuring a competitive epoch.
 *
 * Steps:
 *   1. Designation — name, description, duration
 *   2. Economy — RP per cycle, RP cap, cycle hours, team size, betrayal
 *   3. Doctrine — score weights (5 sliders that must total 100%)
 *   4. Confirmation — summary of all settings, launch button
 *
 * Aesthetic: military command console. Monospace readouts, hard borders,
 * amber/green accent colors, phase indicators like boot sequence stages.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { epochsApi } from '../../services/api/EpochsApiService.js';
import { captureError } from '../../services/SentryService.js';
import type { EpochScoreWeights } from '../../types/index.js';
import { forgeRangeStyles } from '../shared/forge-console-styles.js';
import '../shared/BaseModal.js';
import {
  computePhaseCycles,
  computeTotalCycles,
  DEFAULT_RECKONING_CYCLES,
} from '../../utils/epoch.js';
import { icons } from '../../utils/icons.js';
import { formStyles } from '../shared/form-styles.js';
import { infoBubbleStyles, renderInfoBubble } from '../shared/info-bubble-styles.js';
import { VelgToast } from '../shared/Toast.js';

type FormatPresetId = 'blitz' | 'sprint' | 'standard' | 'marathon' | 'custom';

interface FormatPreset {
  id: FormatPresetId;
  label: string;
  description: string;
  duration_days: number | null;
  cycle_hours: number | null;
  foundation_cycles: number | null;
  reckoning_cycles: number | null;
  rp_per_cycle: number | null;
  rp_cap: number | null;
  /** How a cycle ends. 'activity_gated' = resolve when everyone is ready OR
   *  the deadline expires; 'manual' = only when everyone signals ready. */
  auto_resolve_mode: AutoResolveMode | null;
  /** Deadline per cycle in minutes. Ignored when the mode is 'manual'. */
  cycle_deadline_minutes: number | null;
  /** Floor under a cycle in minutes: how SHORT it may be when everyone is ready
   *  early. 0 disables it. Ignored when the mode is 'manual'. */
  min_cycle_minutes: number | null;
  icon: ReturnType<typeof icons.bolt> | null;
}

/** Backend supports five modes; three are not implemented yet, so the wizard
 *  offers only the two that are wired end to end. */
type AutoResolveMode = 'manual' | 'activity_gated';

/** EpochConfig bounds — mirrored from backend/models/epoch.py. */
const DEADLINE_MIN_MINUTES = 15;
const DEADLINE_MAX_MINUTES = 2880;
const MIN_CYCLE_MAX_MINUTES = 1440;

function getFormatPresets(): FormatPreset[] {
  return [
    {
      id: 'blitz',
      label: msg('Blitz'),
      description: msg('Fast-paced 1-2 day match. 2-hour cycles, rapid decisions.'),
      duration_days: 1,
      cycle_hours: 2,
      foundation_cycles: 1,
      reckoning_cycles: 2,
      rp_per_cycle: 15,
      rp_cap: 30,
      auto_resolve_mode: 'activity_gated',
      cycle_deadline_minutes: 120,
      min_cycle_minutes: 10,
      icon: icons.bolt(18),
    },
    {
      id: 'sprint',
      label: msg('Sprint'),
      description: msg('3-5 day match. 4-hour cycles, balanced pacing.'),
      duration_days: 3,
      cycle_hours: 4,
      foundation_cycles: 2,
      reckoning_cycles: 3,
      rp_per_cycle: 12,
      rp_cap: 36,
      auto_resolve_mode: 'activity_gated',
      cycle_deadline_minutes: 240,
      min_cycle_minutes: 20,
      icon: icons.timer(18),
    },
    {
      id: 'standard',
      label: msg('Standard'),
      description: msg('Classic 14-day epoch. 8-hour cycles, full strategic depth.'),
      duration_days: 14,
      cycle_hours: 8,
      foundation_cycles: 4,
      reckoning_cycles: 8,
      rp_per_cycle: 12,
      rp_cap: 40,
      auto_resolve_mode: 'activity_gated',
      cycle_deadline_minutes: 480,
      min_cycle_minutes: 30,
      icon: icons.crossedSwords(18),
    },
    {
      id: 'marathon',
      label: msg('Marathon'),
      description: msg('Extended 21+ day epoch. Maximum strategic depth.'),
      duration_days: 28,
      cycle_hours: 8,
      foundation_cycles: 6,
      reckoning_cycles: 12,
      rp_per_cycle: 12,
      rp_cap: 40,
      auto_resolve_mode: 'activity_gated',
      cycle_deadline_minutes: 480,
      min_cycle_minutes: 30,
      icon: icons.trophy(18),
    },
    {
      id: 'custom',
      label: msg('Custom'),
      description: msg('Configure everything manually.'),
      duration_days: null,
      cycle_hours: null,
      foundation_cycles: null,
      reckoning_cycles: null,
      rp_per_cycle: null,
      rp_cap: null,
      auto_resolve_mode: null,
      cycle_deadline_minutes: null,
      min_cycle_minutes: null,
      icon: icons.gear(18),
    },
  ];
}

type Step = 'designation' | 'economy' | 'doctrine' | 'confirm';

const STEPS: Step[] = ['designation', 'economy', 'doctrine', 'confirm'];

function getStepLabels(): Record<Step, string> {
  return {
    designation: msg('Designation'),
    economy: msg('Economy'),
    doctrine: msg('Doctrine'),
    confirm: msg('Confirm'),
  };
}

@localized()
@customElement('velg-epoch-creation-wizard')
export class VelgEpochCreationWizard extends LitElement {
  static styles = [
    formStyles,
    forgeRangeStyles,
    infoBubbleStyles,
    css`
      :host {
        display: block;

        /* ── Surface highlights ── */
        --_hi-shimmer: color-mix(in srgb, var(--color-text-primary) 20%, transparent);
        --_hi-shimmer-soft: color-mix(in srgb, var(--color-text-primary) 15%, transparent);

        /* ── Depth ── */
        --_sh-light: color-mix(in srgb, var(--color-surface) 30%, transparent);

        /* ── Success spectrum ── */
        --_success-subtle: color-mix(in srgb, var(--color-success) 10%, transparent);
        --_success-medium: color-mix(in srgb, var(--color-success) 20%, transparent);
        --_success-strong: color-mix(in srgb, var(--color-success) 40%, transparent);

        /* ── Primary (amber) ── */
        --_primary-subtle: color-mix(in srgb, var(--color-primary) 6%, transparent);
        --_primary-soft: color-mix(in srgb, var(--color-primary) 8%, transparent);

        /* ── Influence ── */
        --_influence-faint: color-mix(in srgb, var(--color-epoch-influence) 5%, transparent);
      }

      /* Override info bubble for dark theme + position below to avoid modal overflow clipping */
      .info-bubble__icon {
        background: var(--color-surface-raised);
        color: var(--color-surface-sunken);
      }

      .info-bubble__tooltip {
        background: var(--color-surface-raised);
        color: var(--color-text-secondary);
        border: 1px solid var(--color-border);
        /* Position below instead of above — modal body has overflow-y: auto which clips upward tooltips */
        bottom: auto;
        top: calc(100% + 6px);
      }

      /* Override modal body for dark theme —
         shift the entire surface palette one step darker */
      velg-base-modal {
        --color-surface-header: var(--color-surface-sunken);
      }

      /* ── Phase Indicator ─────────────────── */

      .phases {
        display: flex;
        gap: 0;
        margin-bottom: var(--space-5);
        border: 1px solid var(--color-border);
        overflow: hidden;
      }

      .phase {
        flex: 1;
        padding: var(--space-2) var(--space-2);
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        text-align: center;
        color: var(--color-text-quiet);
        background: var(--color-surface);
        border-right: 1px solid var(--color-border);
        position: relative;
        transition: all 0.3s ease;
        overflow: hidden;
      }

      .phase:last-child {
        border-right: none;
      }

      .phase--active {
        color: var(--color-surface-sunken);
        background: var(--color-success);
        font-weight: 700;
      }

      .phase--active::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent 0%, var(--_hi-shimmer) 50%, transparent 100%);
        animation: phase-sweep 2s ease-in-out infinite;
      }

      @keyframes phase-sweep {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }

      .phase--done {
        color: var(--color-success);
        background: var(--_success-subtle);
      }

      .phase--done::before {
        content: '\u2713 ';
      }

      /* ── Console Form ────────────────────── */

      .console-form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }

      .field__label {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-text-quiet);
      }

      .field__input {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        background: var(--color-surface-sunken);
        color: var(--color-text-primary);
        transition: border-color 0.2s;
      }

      .field__input:focus {
        outline: none;
        border-color: var(--color-success);
        box-shadow: 0 0 0 1px var(--color-success-border);
      }

      .field__input::placeholder {
        color: var(--color-text-quiet);
      }

      .field__textarea {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        background: var(--color-surface-sunken);
        color: var(--color-text-primary);
        min-height: 64px;
        resize: vertical;
        transition: border-color 0.2s;
      }

      .field__textarea:focus {
        outline: none;
        border-color: var(--color-success);
        box-shadow: 0 0 0 1px var(--color-success-border);
      }

      .field__hint {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        color: var(--color-text-quiet);
      }

      /* ── Range Slider ────────────────────── */

      /* .range-field and its input chrome come from forgeRangeStyles. */

      /* ── Two-column row ──────────────────── */

      .field-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-4);
      }

      @media (max-width: 480px) {
        .field-row {
          grid-template-columns: 1fr;
        }
      }

      /* ── Segmented control (cycle resolution) ── */

      .segmented {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-2);
      }

      .segmented__option {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-3);
        text-align: left;
        background: var(--color-surface-raised);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-none);
        cursor: pointer;
        color: var(--color-text-secondary);
        transition:
          border-color var(--transition-fast),
          background var(--transition-fast),
          box-shadow var(--transition-fast);
      }

      .segmented__option:hover {
        border-color: var(--color-primary-border);
      }

      .segmented__option:focus-visible {
        outline: none;
        box-shadow: var(--ring-focus);
      }

      .segmented__option[aria-pressed='true'] {
        background: var(--color-primary-bg);
        border-color: var(--color-primary);
        color: var(--color-text-primary);
        box-shadow: var(--shadow-xs);
      }

      .segmented__name {
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        font-weight: var(--font-bold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist);
      }

      .segmented__desc {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        line-height: var(--leading-snug);
        color: var(--color-text-quiet);
      }

      .config-warning {
        display: flex;
        gap: var(--space-2);
        align-items: flex-start;
        margin-top: var(--space-3);
        padding: var(--space-2) var(--space-3);
        /* Der Balken war Doppelung: der Kasten steht bereits auf
           --color-danger-bg und traegt sein Warnsymbol in derselben Farbe.
           Als der Balken fiel, war das Symbol allerdings noch nicht da — das
           flex/gap hier stand fuer eines, das nie eingebaut wurde, und uebrig
           blieb ein blockierender Hinweis, der auf dem dunklen Grund fast
           verschwand. Symbol nachgereicht, damit die Begruendung traegt. */
        background: var(--color-danger-bg);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        line-height: var(--leading-snug);
        color: var(--color-text-primary);
      }

      .config-warning__icon {
        display: flex;
        flex-shrink: 0;
        margin-top: 1px;
        color: var(--color-danger);
      }

      /* ── Toggle Switch ───────────────────── */

      .toggle-field {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-2) 0;
        border-bottom: 1px solid var(--color-border);
      }

      .toggle-field__label {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-text-quiet);
      }

      .toggle {
        position: relative;
        width: 40px;
        height: 20px;
        background: var(--color-surface-raised);
        border: 1px solid var(--color-border);
        cursor: pointer;
        transition: all 0.2s;
      }

      .toggle--on {
        background: var(--_success-medium);
        border-color: var(--color-success);
      }

      .toggle__thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 14px;
        height: 14px;
        background: var(--color-text-muted);
        transition: all 0.2s;
      }

      .toggle--on .toggle__thumb {
        left: 22px;
        background: var(--color-success);
      }

      .toggle--disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .toggle-hint {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        color: var(--color-text-quiet);
        margin: var(--space-1) 0 0;
      }

      /* ── Doctrine (Score Weights) ────────── */

      .weight-bar {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-2) 0;
        border-bottom: 1px solid var(--color-border);
      }

      .weight-bar__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .weight-bar__name {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
      }

      .weight-bar__name--stability   { color: var(--color-success); }
      .weight-bar__name--influence   { color: var(--color-epoch-influence); }
      .weight-bar__name--sovereignty { color: var(--color-info); }
      .weight-bar__name--diplomatic  { color: var(--color-warning); }
      .weight-bar__name--military    { color: var(--color-danger); }

      .weight-bar__pct {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        font-weight: 700;
        color: var(--color-text-secondary);
        min-width: 36px;
        text-align: right;
      }

      .weight-bar__track {
        height: 8px;
        background: var(--color-surface-raised);
        position: relative;
        overflow: hidden;
      }

      .weight-bar__fill {
        position: absolute;
        inset: 0;
        transform-origin: left;
        transition: transform 0.3s ease;
      }

      .weight-bar__fill--stability   { background: var(--color-success); }
      .weight-bar__fill--influence   { background: var(--color-epoch-influence); }
      .weight-bar__fill--sovereignty { background: var(--color-info); }
      .weight-bar__fill--diplomatic  { background: var(--color-warning); }
      .weight-bar__fill--military    { background: var(--color-danger); }

      .weight-total {
        display: flex;
        justify-content: space-between;
        padding: var(--space-2) 0;
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .weight-total__value {
        font-weight: 700;
      }

      .weight-total__value--valid { color: var(--color-success); }
      .weight-total__value--invalid { color: var(--color-danger); }

      .doctrine-presets {
        display: flex;
        gap: var(--space-2);
        margin-bottom: var(--space-3);
      }

      .preset-btn {
        padding: var(--space-1) var(--space-3);
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-text-quiet);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        cursor: pointer;
        transition: all 0.15s;
      }

      .preset-btn:hover {
        border-color: var(--color-success);
        color: var(--color-success);
      }

      .preset-btn:active {
        background: var(--_success-subtle);
      }

      /* ── Confirm Summary ─────────────────── */

      .summary {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .summary__section {
        border: 1px solid var(--color-border);
        padding: var(--space-3);
      }

      .summary__title {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        color: var(--color-text-quiet);
        margin-bottom: var(--space-2);
      }

      .summary__row {
        display: flex;
        justify-content: space-between;
        padding: 3px 0;
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
      }

      .summary__key {
        color: var(--color-text-quiet);
      }

      .summary__val {
        color: var(--color-text-secondary);
        font-weight: 600;
      }

      .summary__section--note {
        border-color: var(--color-epoch-influence);
        background: var(--_influence-faint);
      }

      .summary__note {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--color-text-quiet);
        line-height: 1.5;
      }

      /* ── Footer ──────────────────────────── */

      .wizard-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
      }

      .wizard-footer__left {
        flex: 1;
      }

      .wizard-footer__right {
        display: flex;
        gap: var(--space-2);
      }

      .btn {
        padding: var(--space-2) var(--space-4);
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid;
      }

      .btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .btn--ghost {
        background: transparent;
        border-color: var(--color-border);
        color: var(--color-text-quiet);
      }

      .btn--ghost:hover:not(:disabled) {
        border-color: var(--color-text-muted);
        color: var(--color-text-secondary);
      }

      .btn--next {
        background: var(--color-surface-raised);
        border-color: var(--color-border);
        color: var(--color-text-primary);
      }

      .btn--next:hover:not(:disabled) {
        background: var(--color-surface-raised);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px var(--_sh-light);
      }

      .btn--launch {
        background: var(--color-success);
        border-color: var(--color-success);
        color: var(--color-surface-sunken);
        font-weight: 900;
        letter-spacing: 0.15em;
        position: relative;
        overflow: hidden;
      }

      .btn--launch:hover:not(:disabled) {
        box-shadow: 0 0 16px var(--_success-strong);
        transform: translateY(-1px);
      }

      .btn--launch:active:not(:disabled) {
        transform: translateY(0);
        box-shadow: 0 0 8px var(--color-success-border);
      }

      .btn--launch::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent, var(--_hi-shimmer-soft), transparent);
        transform: translateX(-100%);
        animation: launch-shimmer 3s ease-in-out infinite;
      }

      @keyframes launch-shimmer {
        0%, 70% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }

      /* ── Format Presets ────────────────────── */

      @keyframes card-enter {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      .format-section-header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-bottom: var(--space-3);
        padding-bottom: var(--space-2);
        border-bottom: 1px solid var(--color-border);
      }

      .format-section-label {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        color: var(--color-text-quiet);
      }

      .format-presets {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 2px;
        background: var(--color-surface-raised);
        border: 1px solid var(--color-border);
        margin-bottom: var(--space-3);
      }

      .format-card {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-3) var(--space-2);
        background: var(--color-surface);
        border: none;
        cursor: pointer;
        text-align: left;
        outline: none;
        box-shadow: inset 0 2px 0 0 transparent;
        opacity: 0;
        animation: card-enter 350ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        animation-delay: calc(var(--i, 0) * 40ms);
        transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1),
                    background 0.15s ease,
                    box-shadow 0.2s ease;
      }

      .format-card:hover {
        background: var(--color-border-light, var(--color-border));
      }

      .format-card:focus-visible {
        z-index: 1;
        outline: 2px solid var(--color-warning);
        outline-offset: -2px;
      }

      .format-card[aria-selected="true"] {
        background: var(--_primary-subtle);
        box-shadow:
          inset 0 2px 0 0 var(--color-warning),
          0 0 12px var(--_primary-soft);
        transform: scale(1.02);
      }

      .format-card[aria-selected="true"] .format-card__label {
        color: var(--color-warning);
      }

      .format-card__header {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .format-card__icon {
        color: var(--color-text-quiet);
        transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1),
                    color 0.15s ease;
        display: flex;
        align-items: center;
      }

      .format-card:hover .format-card__icon {
        transform: scale(1.1);
      }

      .format-card[aria-selected="true"] .format-card__icon {
        color: var(--color-warning);
      }

      .format-card__label {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--color-text-tertiary);
        transition: color 0.15s ease;
      }

      .format-card__stats {
        display: inline-block;
        width: fit-content;
        padding: 1px 6px;
        font-family: var(--font-mono, monospace);
        font-size: 9px;
        letter-spacing: 0.05em;
        color: var(--color-text-quiet);
        background: var(--color-surface-raised);
        border: 1px solid var(--color-border);
      }

      .format-card[aria-selected="true"] .format-card__stats {
        color: var(--color-warning);
        border-color: var(--color-primary-border);
        background: var(--_primary-soft);
      }

      .format-card__desc {
        font-family: var(--font-mono, monospace);
        font-size: 9px;
        line-height: 1.5;
        color: var(--color-text-quiet);
        margin-top: var(--space-1);
      }

      .format-card[aria-selected="true"] .format-card__desc {
        color: var(--color-text-quiet);
      }

      .format-custom-reveal {
        display: grid;
        grid-template-rows: 0fr;
        transition: grid-template-rows 0.25s ease;
      }

      .format-custom-reveal--open {
        grid-template-rows: 1fr;
      }

      .format-custom-reveal__inner {
        overflow: hidden;
      }

      .format-custom-reveal__content {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        padding: var(--space-3) 0 0;
      }

      @media (max-width: 600px) {
        .format-presets {
          grid-template-columns: repeat(2, 1fr);
        }

        .format-card:last-child {
          grid-column: 1 / -1;
        }

        .format-card__desc {
          display: none;
        }
      }

      /* ── Error ───────────────────────────── */

      .error {
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-danger);
        background: var(--color-danger-bg);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        color: var(--color-danger);
      }
    `,
  ];

  @property({ type: Boolean, reflect: true }) open = false;

  @state() private _step: Step = 'designation';
  @state() private _loading = false;
  @state() private _error = '';

  // Step 1: Designation
  @state() private _name = '';
  @state() private _description = '';
  @state() private _durationDays = 14;

  // Step 2: Economy
  @state() private _cycleHours = 8;
  @state() private _rpPerCycle = 12;
  @state() private _rpCap = 40;
  @state() private _maxTeamSize = 3;
  @state() private _maxAgentsPerPlayer = 6;
  @state() private _allowBetrayal = true;

  // Format preset
  @state() private _formatPreset: FormatPresetId = 'standard';
  @state() private _foundationCycles = 4;
  @state() private _reckoningCycles = DEFAULT_RECKONING_CYCLES;

  // Cycle resolution — how a round ends. Until now the wizard never sent
  // auto_resolve_mode, so every epoch fell back to the backend default
  // ('manual') and the whole deadline / AFK / pass subsystem stayed dormant.
  @state() private _autoResolveMode: AutoResolveMode = 'activity_gated';
  @state() private _cycleDeadlineMinutes = 480;
  @state() private _minCycleMinutes = 30;
  @state() private _requireActionForReady = true;
  @state() private _afkPenaltyEnabled = true;

  // Step 3: Doctrine (score weights, percentages that sum to 100)
  @state() private _wStability = 25;
  @state() private _wInfluence = 20;
  @state() private _wSovereignty = 20;
  @state() private _wDiplomatic = 15;
  @state() private _wMilitary = 20;

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('open') && this.open) {
      this._step = 'designation';
      this._loading = false;
      this._error = '';
      this._name = '';
      this._description = '';
      this._durationDays = 14;
      this._cycleHours = 8;
      this._rpPerCycle = 12;
      this._rpCap = 40;
      this._maxTeamSize = 3;
      this._maxAgentsPerPlayer = 6;
      this._allowBetrayal = true;
      this._formatPreset = 'standard';
      this._foundationCycles = 4;
      this._reckoningCycles = DEFAULT_RECKONING_CYCLES;
      this._autoResolveMode = 'activity_gated';
      this._cycleDeadlineMinutes = 480;
      this._minCycleMinutes = 30;
      this._requireActionForReady = true;
      this._afkPenaltyEnabled = true;
      this._wStability = 25;
      this._wInfluence = 20;
      this._wSovereignty = 20;
      this._wDiplomatic = 15;
      this._wMilitary = 20;
    }
  }

  // ── Navigation ──────────────────────────────────────

  private _next(): void {
    const idx = STEPS.indexOf(this._step);
    if (idx < STEPS.length - 1) {
      this._step = STEPS[idx + 1];
    }
  }

  private _back(): void {
    const idx = STEPS.indexOf(this._step);
    if (idx > 0) {
      this._step = STEPS[idx - 1];
    }
  }

  private _close(): void {
    this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  }

  // ── Validation ──────────────────────────────────────

  private _canAdvance(): boolean {
    switch (this._step) {
      case 'designation':
        return this._name.trim().length >= 3 && this._phaseOverlapError() === null;
      case 'economy':
        return true;
      case 'doctrine':
        return this._weightTotal() === 100;
      case 'confirm':
        return !this._loading;
      default:
        return false;
    }
  }

  private _weightTotal(): number {
    return (
      this._wStability + this._wInfluence + this._wSovereignty + this._wDiplomatic + this._wMilitary
    );
  }

  // ── Format Presets ──────────────────────────────────

  private _selectFormat(id: FormatPresetId): void {
    this._formatPreset = id;
    const preset = getFormatPresets().find((p) => p.id === id);
    if (preset && id !== 'custom') {
      if (preset.duration_days != null) this._durationDays = preset.duration_days;
      if (preset.cycle_hours != null) this._cycleHours = preset.cycle_hours;
      if (preset.foundation_cycles != null) this._foundationCycles = preset.foundation_cycles;
      if (preset.reckoning_cycles != null) this._reckoningCycles = preset.reckoning_cycles;
      if (preset.rp_per_cycle != null) this._rpPerCycle = preset.rp_per_cycle;
      if (preset.rp_cap != null) this._rpCap = preset.rp_cap;
      if (preset.auto_resolve_mode != null) this._autoResolveMode = preset.auto_resolve_mode;
      if (preset.cycle_deadline_minutes != null)
        this._cycleDeadlineMinutes = preset.cycle_deadline_minutes;
      if (preset.min_cycle_minutes != null) this._minCycleMinutes = preset.min_cycle_minutes;
    }
  }

  private _handleFormatKeydown(e: KeyboardEvent): void {
    const presets = getFormatPresets();
    const currentIdx = presets.findIndex((p) => p.id === this._formatPreset);
    let nextIdx = currentIdx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIdx = (currentIdx + 1) % presets.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIdx = (currentIdx - 1 + presets.length) % presets.length;
    }
    if (nextIdx !== currentIdx) {
      this._selectFormat(presets[nextIdx].id);
      this.updateComplete.then(() => {
        const cards = this.shadowRoot?.querySelectorAll('.format-card');
        (cards?.[nextIdx] as HTMLElement)?.focus();
      });
    }
  }

  // ── Doctrine Presets ──────────────────────────────

  private _applyPreset(preset: 'balanced' | 'builder' | 'warmonger' | 'diplomat'): void {
    switch (preset) {
      case 'balanced':
        this._wStability = 25;
        this._wInfluence = 20;
        this._wSovereignty = 20;
        this._wDiplomatic = 15;
        this._wMilitary = 20;
        break;
      case 'builder':
        this._wStability = 40;
        this._wInfluence = 20;
        this._wSovereignty = 20;
        this._wDiplomatic = 10;
        this._wMilitary = 10;
        break;
      case 'warmonger':
        this._wStability = 10;
        this._wInfluence = 15;
        this._wSovereignty = 15;
        this._wDiplomatic = 10;
        this._wMilitary = 50;
        break;
      case 'diplomat':
        this._wStability = 15;
        this._wInfluence = 25;
        this._wSovereignty = 10;
        this._wDiplomatic = 35;
        this._wMilitary = 15;
        break;
    }
  }

  // ── Create ──────────────────────────────────────────

  private async _handleLaunch(): Promise<void> {
    if (this._loading) return;
    this._loading = true;
    this._error = '';

    const config: Record<string, unknown> = {
      duration_days: this._durationDays,
      cycle_hours: this._cycleHours,
      rp_per_cycle: this._rpPerCycle,
      rp_cap: this._rpCap,
      foundation_cycles: this._foundationCycles,
      reckoning_cycles: this._reckoningCycles,
      max_team_size: this._maxTeamSize,
      max_agents_per_player: this._maxAgentsPerPlayer,
      allow_betrayal: this._allowBetrayal,
      auto_resolve_mode: this._autoResolveMode,
      cycle_deadline_minutes: this._cycleDeadlineMinutes,
      min_cycle_minutes: this._minCycleMinutes,
      require_action_for_ready: this._requireActionForReady,
      afk_penalty_enabled: this._afkPenaltyEnabled,
      score_weights: {
        stability: this._wStability,
        influence: this._wInfluence,
        sovereignty: this._wSovereignty,
        diplomatic: this._wDiplomatic,
        military: this._wMilitary,
      } satisfies EpochScoreWeights,
    };

    try {
      const resp = await epochsApi.createEpoch({
        name: this._name.trim(),
        description: this._description.trim() || undefined,
        config: config as Record<string, unknown>,
      });

      if (resp.success) {
        VelgToast.success(msg('Epoch created. Awaiting participants.'));
        this.dispatchEvent(
          new CustomEvent('epoch-created', { detail: resp.data, bubbles: true, composed: true }),
        );
        this._close();
      } else {
        this._error = resp.error?.message ?? msg('Failed to create epoch.');
      }
    } catch (err) {
      captureError(err, { source: 'VelgEpochCreationWizard._handleLaunch' });
      this._error = msg('Failed to create epoch.');
    } finally {
      this._loading = false;
    }
  }

  // ── Render ──────────────────────────────────────────

  protected render() {
    if (!this.open) return nothing;

    return html`
      <velg-base-modal .open=${this.open} @modal-close=${this._close}>
        <span slot="header">${msg('Initialize Epoch')}</span>

        ${this._renderPhases()}

        ${this._step === 'designation' ? this._renderDesignation() : nothing}
        ${this._step === 'economy' ? this._renderEconomy() : nothing}
        ${this._step === 'doctrine' ? this._renderDoctrine() : nothing}
        ${this._step === 'confirm' ? this._renderConfirm() : nothing}

        ${this._error ? html`<div class="error">${this._error}</div>` : nothing}

        <div slot="footer">${this._renderFooter()}</div>
      </velg-base-modal>
    `;
  }

  // ── Phase Indicator ─────────────────────────────────

  private _renderPhases() {
    const labels = getStepLabels();
    const currentIdx = STEPS.indexOf(this._step);

    return html`
      <div class="phases">
        ${STEPS.map(
          (s, i) => html`
            <div class="phase ${
              i === currentIdx ? 'phase--active' : i < currentIdx ? 'phase--done' : ''
            }">
              ${labels[s]}
            </div>
          `,
        )}
      </div>
    `;
  }

  // ── Shared field renderers ──────────────────────────

  /** Toggle switch row. One implementation for every boolean in the wizard —
   *  the betrayal switch used to carry this markup inline. */
  private _renderToggleField(
    label: string,
    hint: string,
    value: boolean,
    onToggle: () => void,
    disabled = false,
  ) {
    const flip = () => {
      if (!disabled) onToggle();
    };
    return html`
      <div class="toggle-field">
        <span class="toggle-field__label">${label} ${renderInfoBubble(hint)}</span>
        <div
          class="toggle ${value ? 'toggle--on' : ''} ${disabled ? 'toggle--disabled' : ''}"
          role="switch"
          tabindex=${disabled ? -1 : 0}
          aria-checked=${value}
          aria-disabled=${disabled}
          aria-label=${label}
          @click=${flip}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              flip();
            }
          }}
        >
          <div class="toggle__thumb"></div>
        </div>
      </div>
    `;
  }

  /** Human-readable deadline, e.g. "8h" or "45min". */
  private _deadlineLabel(minutes: number): string {
    if (minutes % 60 === 0) {
      const hours = minutes / 60;
      return msg(str`${hours}h`);
    }
    return msg(str`${minutes}min`);
  }

  // ── Cycle Resolution ────────────────────────────────

  private _renderCycleResolution() {
    const isGated = this._autoResolveMode === 'activity_gated';
    return html`
      <div class="field">
        <label class="field__label">
          ${msg('Cycle Resolution')}
          ${renderInfoBubble(msg('Decides how a cycle ends. A deadline keeps the epoch moving when someone stops responding – without one, a single absent player can stall every remaining cycle indefinitely.'))}
        </label>
        <div class="segmented" role="group" aria-label=${msg('Cycle Resolution')}>
          <button
            type="button"
            class="segmented__option"
            aria-pressed=${isGated}
            @click=${() => {
              this._autoResolveMode = 'activity_gated';
              this._formatPreset = 'custom';
            }}
          >
            <span class="segmented__name">${msg('Ready or Deadline')}</span>
            <span class="segmented__desc">
              ${msg('Resolves as soon as everyone is ready, or automatically when the deadline expires.')}
            </span>
          </button>
          <button
            type="button"
            class="segmented__option"
            aria-pressed=${!isGated}
            @click=${() => {
              this._autoResolveMode = 'manual';
              this._formatPreset = 'custom';
            }}
          >
            <span class="segmented__name">${msg('All Players Ready')}</span>
            <span class="segmented__desc">
              ${msg('Waits indefinitely until every human player signals ready. No deadline, no absence handling.')}
            </span>
          </button>
        </div>

        ${
          isGated
            ? html`
              <div class="range-field" style="margin-top: var(--space-4)">
                <div class="range-field__header">
                  <span class="range-field__label">${msg('Cycle Deadline')}</span>
                  <span class="range-field__readout">
                    ${this._deadlineLabel(this._cycleDeadlineMinutes)}
                  </span>
                </div>
                <input
                  type="range"
                  aria-label=${msg('Cycle Deadline')}
                  min=${DEADLINE_MIN_MINUTES}
                  max=${DEADLINE_MAX_MINUTES}
                  step="15"
                  .value=${String(this._cycleDeadlineMinutes)}
                  @input=${(e: Event) => {
                    this._cycleDeadlineMinutes = Number((e.target as HTMLInputElement).value);
                    this._formatPreset = 'custom';
                  }}
                />
                <span class="field__hint">
                  ${msg(str`Cycles are ${this._cycleHours}h long – a deadline near that keeps pacing predictable.`)}
                </span>
              </div>
              <div class="range-field" style="margin-top: var(--space-4)">
                <div class="range-field__header">
                  <span class="range-field__label">${msg('Shortest Cycle')}</span>
                  <span class="range-field__readout">
                    ${
                      this._minCycleMinutes > 0
                        ? this._deadlineLabel(this._minCycleMinutes)
                        : msg('None')
                    }
                  </span>
                </div>
                <input
                  type="range"
                  aria-label=${msg('Shortest Cycle')}
                  min="0"
                  max=${MIN_CYCLE_MAX_MINUTES}
                  step="5"
                  .value=${String(this._minCycleMinutes)}
                  @input=${(e: Event) => {
                    this._minCycleMinutes = Number((e.target as HTMLInputElement).value);
                    this._formatPreset = 'custom';
                  }}
                />
                <span class="field__hint">
                  ${msg(
                    'The deadline caps how long a cycle runs; this caps how short. Everyone signalling ready early brings the deadline forward to this point instead of ending the cycle at once.',
                  )}
                </span>
              </div>
              ${this._renderToggleField(
                msg('Require Action Before Ready'),
                msg(
                  'Players must deploy, fortify, or explicitly pass before they can signal ready. Prevents empty cycles.',
                ),
                this._requireActionForReady,
                () => {
                  this._requireActionForReady = !this._requireActionForReady;
                },
              )}
              ${this._renderToggleField(
                msg('Absence Penalties'),
                msg(
                  'Players who miss a cycle lose RP, escalating with each consecutive absence. After repeated absences an AI assumes control so the epoch keeps moving.',
                ),
                this._afkPenaltyEnabled,
                () => {
                  this._afkPenaltyEnabled = !this._afkPenaltyEnabled;
                },
              )}
            `
            : nothing
        }
      </div>
    `;
  }

  // ── Step 1: Designation ─────────────────────────────

  private _renderDesignation() {
    const phases = computePhaseCycles({
      duration_days: this._durationDays,
      cycle_hours: this._cycleHours,
      foundation_cycles: this._foundationCycles,
      reckoning_cycles: this._reckoningCycles,
    });
    const foundationDays = Math.round(((phases.foundation * this._cycleHours) / 24) * 10) / 10;
    const reckoningDays = Math.round(((phases.reckoning * this._cycleHours) / 24) * 10) / 10;
    const competitionDays = Math.round(((phases.competition * this._cycleHours) / 24) * 10) / 10;

    const presets = getFormatPresets();
    const isCustom = this._formatPreset === 'custom';
    const cyclesPerDay = Math.round((24 / this._cycleHours) * 10) / 10;

    return html`
      <div class="console-form">
        <div class="field">
          <label class="field__label">
            ${msg('Epoch Name')} *
            ${renderInfoBubble(msg('A unique name for this competitive epoch. Visible to all participants and spectators.'))}
          </label>
          <input
            class="field__input"
            type="text"
            aria-label=${msg('Epoch Name')}
            placeholder=${msg('The First Convergence')}
            .value=${this._name}
            @input=${(e: Event) => {
              this._name = (e.target as HTMLInputElement).value;
            }}
          />
        </div>

        <div class="field">
          <label class="field__label">
            ${msg('Description')}
            ${renderInfoBubble(msg('Optional briefing text shown in the lobby. Set the narrative tone for the competition.'))}
          </label>
          <textarea
            class="field__textarea"
            aria-label=${msg('Description')}
            placeholder=${msg('Optional briefing for participants...')}
            .value=${this._description}
            @input=${(e: Event) => {
              this._description = (e.target as HTMLTextAreaElement).value;
            }}
          ></textarea>
        </div>

        <!-- Format Presets -->
        <div class="format-section-header">
          <span class="format-section-label">${msg('Match Format')}</span>
          ${renderInfoBubble(msg('Presets configure duration, cycle interval, phase lengths, and RP economy. Use Custom for full manual control.'))}
        </div>

        <div class="format-presets" role="radiogroup" aria-label=${msg('Match Format')}>
          ${presets.map(
            (p, i) => html`
              <button
                class="format-card"
                style="--i: ${i}"
                role="radio"
                aria-selected=${this._formatPreset === p.id}
                aria-checked=${this._formatPreset === p.id}
                tabindex=${this._formatPreset === p.id ? 0 : -1}
                @click=${() => this._selectFormat(p.id)}
                @keydown=${this._handleFormatKeydown}
              >
                <div class="format-card__header">
                  ${p.icon ? html`<span class="format-card__icon">${p.icon}</span>` : nothing}
                  <span class="format-card__label">${p.label}</span>
                </div>
                ${
                  p.duration_days != null
                    ? html`<span class="format-card__stats">${p.duration_days}d · ${p.cycle_hours}h</span>`
                    : nothing
                }
                <span class="format-card__desc">${p.description}</span>
              </button>
            `,
          )}
        </div>

        <div class="format-custom-reveal ${isCustom ? 'format-custom-reveal--open' : ''}">
          <div class="format-custom-reveal__inner">
            <div class="format-custom-reveal__content">
              <div class="range-field">
                <div class="range-field__header">
                  <span class="range-field__label">${msg('Cycle Interval')}</span>
                  <span class="range-field__readout">${this._cycleHours}h</span>
                </div>
                <input
                  type="range"
                  aria-label=${msg('Cycle Interval')}
                  min="2"
                  max="24"
                  .value=${String(this._cycleHours)}
                  @input=${(e: Event) => {
                    this._cycleHours = Number((e.target as HTMLInputElement).value);
                  }}
                />
                <span class="field__hint">${msg(str`${cyclesPerDay} cycles per day`)}</span>
              </div>
              <div class="range-field">
                <div class="range-field__header">
                  <span class="range-field__label">${msg('Duration')}</span>
                  <span class="range-field__readout">${this._durationDays}d</span>
                </div>
                <input
                  type="range"
                  aria-label=${msg('Duration')}
                  min="1"
                  max="60"
                  .value=${String(this._durationDays)}
                  @input=${(e: Event) => {
                    this._durationDays = Number((e.target as HTMLInputElement).value);
                  }}
                />
              </div>
              <div class="field-row">
                <div class="range-field">
                  <div class="range-field__header">
                    <span class="range-field__label">${msg('Foundation Cycles')}</span>
                    <span class="range-field__readout">${this._foundationCycles}</span>
                  </div>
                  <input
                    type="range"
                    aria-label=${msg('Foundation Cycles')}
                    min="1"
                    max="12"
                    .value=${String(this._foundationCycles)}
                    @input=${(e: Event) => {
                      this._foundationCycles = Number((e.target as HTMLInputElement).value);
                    }}
                  />
                </div>
                <div class="range-field">
                  <div class="range-field__header">
                    <span class="range-field__label">${msg('Reckoning Cycles')}</span>
                    <span class="range-field__readout">${this._reckoningCycles}</span>
                  </div>
                  <input
                    type="range"
                    aria-label=${msg('Reckoning Cycles')}
                    min="2"
                    max="16"
                    .value=${String(this._reckoningCycles)}
                    @input=${(e: Event) => {
                      this._reckoningCycles = Number((e.target as HTMLInputElement).value);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <span class="field__hint">
          ${msg(str`Foundation ${phases.foundation} · Competition ${phases.competition} · Reckoning ${phases.reckoning} cycles – ${this._durationDays}d (${foundationDays}d + ${competitionDays}d + ${reckoningDays}d)`)}
        </span>

        ${
          this._phaseOverlapError()
            ? html`
              <div class="config-warning" role="alert">
                <span class="config-warning__icon" aria-hidden="true">
                  ${icons.alertTriangle(16)}
                </span>
                <span>${this._phaseOverlapError()}</span>
              </div>
            `
            : nothing
        }
      </div>

      ${this._renderCycleResolution()}
    `;
  }

  /** Foundation + Reckoning must leave room for a competition phase.
   *  The backend rejects an overlap in start_epoch() — i.e. only AFTER the
   *  lobby filled up and invitations went out. Catch it at creation time. */
  private _phaseOverlapError(): string | null {
    const total = computeTotalCycles({
      duration_days: this._durationDays,
      cycle_hours: this._cycleHours,
    });
    const used = this._foundationCycles + this._reckoningCycles;
    if (used < total) return null;
    return msg(
      str`Foundation (${this._foundationCycles}) + Reckoning (${this._reckoningCycles}) must stay below the total of ${total} cycles. Lengthen the epoch, shorten the cycle interval, or reduce a phase.`,
    );
  }

  // ── Step 2: Economy ─────────────────────────────────

  private _renderEconomy() {
    return html`
      <div class="console-form">
        <div class="field-row">
          <div class="range-field">
            <div class="range-field__header">
              <span class="range-field__label">
                ${msg('RP per Cycle')}
                ${renderInfoBubble(msg('Resonance Points granted each cycle. RP is spent to deploy operatives (spies, saboteurs, assassins, etc.). Foundation phase grants 1.5x.'))}
              </span>
              <span class="range-field__readout">${this._rpPerCycle}</span>
            </div>
            <input
              type="range"
              aria-label=${msg('RP per Cycle')}
              min="5"
              max="25"
              .value=${String(this._rpPerCycle)}
              @input=${(e: Event) => {
                this._rpPerCycle = Number((e.target as HTMLInputElement).value);
              }}
            />
          </div>

          <div class="range-field">
            <div class="range-field__header">
              <span class="range-field__label">
                ${msg('RP Cap')}
                ${renderInfoBubble(msg('Maximum RP a participant can accumulate. Excess RP from cycle grants is lost. Forces players to spend rather than hoard.'))}
              </span>
              <span class="range-field__readout">${this._rpCap}</span>
            </div>
            <input
              type="range"
              aria-label=${msg('RP Cap')}
              min="15"
              max="75"
              step="5"
              .value=${String(this._rpCap)}
              @input=${(e: Event) => {
                this._rpCap = Number((e.target as HTMLInputElement).value);
              }}
            />
          </div>
        </div>

        <div class="range-field">
          <div class="range-field__header">
            <span class="range-field__label">
              ${msg('Max Team Size')}
              ${renderInfoBubble(msg('Maximum number of simulations in one alliance. Larger teams share diplomatic bonuses but split influence.'))}
            </span>
            <span class="range-field__readout">${this._maxTeamSize}</span>
          </div>
          <input
            type="range"
            aria-label=${msg('Max Team Size')}
            min="2"
            max="8"
            .value=${String(this._maxTeamSize)}
            @input=${(e: Event) => {
              this._maxTeamSize = Number((e.target as HTMLInputElement).value);
              if (this._maxTeamSize <= 2) this._allowBetrayal = false;
            }}
          />
        </div>

        <div class="range-field">
          <div class="range-field__header">
            <span class="range-field__label">
              ${msg('Max Agents per Player')}
              ${renderInfoBubble(msg('How many agents each player drafts into the match. Players with more agents in their simulation can choose their best lineup.'))}
            </span>
            <span class="range-field__readout">${this._maxAgentsPerPlayer}</span>
          </div>
          <input
            type="range"
            aria-label=${msg('Max Agents per Player')}
            min="4"
            max="8"
            .value=${String(this._maxAgentsPerPlayer)}
            @input=${(e: Event) => {
              this._maxAgentsPerPlayer = Number((e.target as HTMLInputElement).value);
            }}
          />
        </div>

        ${this._renderToggleField(
          msg('Allow Betrayal'),
          msg(
            'When enabled, alliance members can leave and attack former allies. Betrayal incurs a -25% diplomatic penalty and marks the traitor publicly.',
          ),
          this._allowBetrayal,
          () => {
            this._allowBetrayal = !this._allowBetrayal;
          },
          this._maxTeamSize <= 2,
        )}
        ${this._maxTeamSize <= 2 ? html`<p class="toggle-hint">${msg('Betrayal requires a team size of at least 3.')}</p>` : nothing}
      </div>
    `;
  }

  // ── Step 3: Doctrine ────────────────────────────────

  private _renderDoctrine() {
    const total = this._weightTotal();
    const isValid = total === 100;

    const dims: {
      key: string;
      label: string;
      hint: string;
      value: number;
      setter: (v: number) => void;
    }[] = [
      {
        key: 'stability',
        label: msg('Stability'),
        hint: msg(
          'Building readiness and zone stability. Rewards maintaining infrastructure and keeping buildings in good condition.',
        ),
        value: this._wStability,
        setter: (v) => {
          this._wStability = v;
        },
      },
      {
        key: 'influence',
        label: msg('Influence'),
        hint: msg(
          'Social media reach and propaganda effectiveness. Scored by campaign performance and social trend engagement.',
        ),
        value: this._wInfluence,
        setter: (v) => {
          this._wInfluence = v;
        },
      },
      {
        key: 'sovereignty',
        label: msg('Sovereignty'),
        hint: msg(
          'Territorial control and agent count. More agents and buildings under your control means higher sovereignty.',
        ),
        value: this._wSovereignty,
        setter: (v) => {
          this._wSovereignty = v;
        },
      },
      {
        key: 'diplomatic',
        label: msg('Diplomatic'),
        hint: msg(
          'Embassy effectiveness and alliance standing. Active embassies with ambassadors and alliance membership boost this score.',
        ),
        value: this._wDiplomatic,
        setter: (v) => {
          this._wDiplomatic = v;
        },
      },
      {
        key: 'military',
        label: msg('Military'),
        hint: msg(
          'Offensive operations and defense success. Scored by successful spy/saboteur/assassin missions and guardian interceptions.',
        ),
        value: this._wMilitary,
        setter: (v) => {
          this._wMilitary = v;
        },
      },
    ];

    return html`
      <div class="console-form">
        <div class="doctrine-presets">
          <button class="preset-btn" @click=${() => this._applyPreset('balanced')}>${msg('Balanced')}</button>
          <button class="preset-btn" @click=${() => this._applyPreset('builder')}>${msg('Builder')}</button>
          <button class="preset-btn" @click=${() => this._applyPreset('warmonger')}>${msg('Warmonger')}</button>
          <button class="preset-btn" @click=${() => this._applyPreset('diplomat')}>${msg('Diplomat')}</button>
        </div>

        ${dims.map(
          (d) => html`
            <div class="weight-bar">
              <div class="weight-bar__header">
                <span class="weight-bar__name weight-bar__name--${d.key}">
                  ${d.label}
                  ${renderInfoBubble(d.hint)}
                </span>
                <span class="weight-bar__pct">${d.value}%</span>
              </div>
              <div class="weight-bar__track">
                <div
                  class="weight-bar__fill weight-bar__fill--${d.key}"
                  style="transform: scaleX(${d.value / 100})"
                ></div>
              </div>
              <input
                type="range"
                aria-label=${d.label}
                min="0"
                max="100"
                step="5"
                .value=${String(d.value)}
                @input=${(e: Event) => d.setter(Number((e.target as HTMLInputElement).value))}
                style="margin-top: 2px;"
              />
            </div>
          `,
        )}

        <div class="weight-total">
          <span>${msg('Total Weight')}</span>
          <span class="weight-total__value ${isValid ? 'weight-total__value--valid' : 'weight-total__value--invalid'}">
            ${total}%
          </span>
        </div>
      </div>
    `;
  }

  // ── Step 4: Confirm ─────────────────────────────────

  private _renderConfirm() {
    const phases = computePhaseCycles({
      duration_days: this._durationDays,
      cycle_hours: this._cycleHours,
      foundation_cycles: this._foundationCycles,
      reckoning_cycles: this._reckoningCycles,
    });
    const toDays = (cycles: number) => Math.round(((cycles * this._cycleHours) / 24) * 10) / 10;
    const presetLabel = getFormatPresets().find((p) => p.id === this._formatPreset)?.label ?? '';

    return html`
      <div class="summary">
        <div class="summary__section">
          <div class="summary__title">${msg('Designation')}</div>
          <div class="summary__row">
            <span class="summary__key">${msg('Name')}</span>
            <span class="summary__val">${this._name}</span>
          </div>
          <div class="summary__row">
            <span class="summary__key">${msg('Match Format')}</span>
            <span class="summary__val">${presetLabel}</span>
          </div>
          <div class="summary__row">
            <span class="summary__key">${msg('Duration')}</span>
            <span class="summary__val">${this._durationDays}d</span>
          </div>
          <div class="summary__row">
            <span class="summary__key">${msg('Foundation')}</span>
            <span class="summary__val">${phases.foundation} ${msg('cycles')} (${toDays(phases.foundation)}d)</span>
          </div>
          <div class="summary__row">
            <span class="summary__key">${msg('Competition')}</span>
            <span class="summary__val">${phases.competition} ${msg('cycles')} (${toDays(phases.competition)}d)</span>
          </div>
          <div class="summary__row">
            <span class="summary__key">${msg('Reckoning')}</span>
            <span class="summary__val">${phases.reckoning} ${msg('cycles')} (${toDays(phases.reckoning)}d)</span>
          </div>
          <div class="summary__row">
            <span class="summary__key">${msg('Cycle Interval')}</span>
            <span class="summary__val">${this._cycleHours}h</span>
          </div>
          <div class="summary__row">
            <span class="summary__key">${msg('Cycle Resolution')}</span>
            <span class="summary__val">
              ${
                this._autoResolveMode === 'activity_gated'
                  ? msg(str`Ready or ${this._deadlineLabel(this._cycleDeadlineMinutes)} deadline`)
                  : msg('All players ready')
              }
            </span>
          </div>
          ${
            this._autoResolveMode === 'activity_gated'
              ? html`
                <div class="summary__row">
                  <span class="summary__key">${msg('Shortest Cycle')}</span>
                  <span class="summary__val">
                    ${
                      this._minCycleMinutes > 0
                        ? this._deadlineLabel(this._minCycleMinutes)
                        : msg('No floor')
                    }
                  </span>
                </div>
                <div class="summary__row">
                  <span class="summary__key">${msg('Action Required')}</span>
                  <span class="summary__val">
                    ${this._requireActionForReady ? msg('Yes') : msg('No')}
                  </span>
                </div>
                <div class="summary__row">
                  <span class="summary__key">${msg('Absence Penalties')}</span>
                  <span class="summary__val">
                    ${this._afkPenaltyEnabled ? msg('Enabled') : msg('Disabled')}
                  </span>
                </div>
              `
              : nothing
          }
        </div>

        <div class="summary__section">
          <div class="summary__title">${msg('Economy')}</div>
          <div class="summary__row">
            <span class="summary__key">${msg('RP per Cycle')}</span>
            <span class="summary__val">${this._rpPerCycle}</span>
          </div>
          <div class="summary__row">
            <span class="summary__key">${msg('RP Cap')}</span>
            <span class="summary__val">${this._rpCap}</span>
          </div>
          <div class="summary__row">
            <span class="summary__key">${msg('Max Team Size')}</span>
            <span class="summary__val">${this._maxTeamSize}</span>
          </div>
          <div class="summary__row">
            <span class="summary__key">${msg('Max Agents per Player')}</span>
            <span class="summary__val">${this._maxAgentsPerPlayer}</span>
          </div>
          <div class="summary__row">
            <span class="summary__key">${msg('Betrayal')}</span>
            <span class="summary__val">${this._allowBetrayal ? msg('Enabled') : msg('Disabled')}</span>
          </div>
        </div>

        <div class="summary__section">
          <div class="summary__title">${msg('Doctrine')}</div>
          <div class="summary__row">
            <span class="summary__key">${msg('Stability')}</span>
            <span class="summary__val">${this._wStability}%</span>
          </div>
          <div class="summary__row">
            <span class="summary__key">${msg('Influence')}</span>
            <span class="summary__val">${this._wInfluence}%</span>
          </div>
          <div class="summary__row">
            <span class="summary__key">${msg('Sovereignty')}</span>
            <span class="summary__val">${this._wSovereignty}%</span>
          </div>
          <div class="summary__row">
            <span class="summary__key">${msg('Diplomatic')}</span>
            <span class="summary__val">${this._wDiplomatic}%</span>
          </div>
          <div class="summary__row">
            <span class="summary__key">${msg('Military')}</span>
            <span class="summary__val">${this._wMilitary}%</span>
          </div>
        </div>

        <div class="summary__section summary__section--note">
          <div class="summary__title">${msg('Game Instances')}</div>
          <p class="summary__note">
            ${msg(
              'When the epoch starts, each participating simulation will be cloned into a balanced game instance. Templates remain untouched.',
            )}
          </p>
        </div>
      </div>
    `;
  }

  // ── Footer ──────────────────────────────────────────

  private _renderFooter() {
    const isFirst = this._step === 'designation';
    const isLast = this._step === 'confirm';

    return html`
      <div class="wizard-footer">
        <div class="wizard-footer__left">
          ${
            isFirst
              ? html`<button class="btn btn--ghost" @click=${this._close}>${msg('Cancel')}</button>`
              : html`<button class="btn btn--ghost" @click=${this._back}>${msg('Back')}</button>`
          }
        </div>
        <div class="wizard-footer__right">
          ${
            isLast
              ? html`
                <button
                  class="btn btn--launch"
                  ?disabled=${this._loading}
                  @click=${this._handleLaunch}
                >
                  ${this._loading ? msg('Launching...') : msg('Launch Epoch')}
                </button>
              `
              : html`
                <button
                  class="btn btn--next"
                  ?disabled=${!this._canAdvance()}
                  @click=${this._next}
                >
                  ${msg('Next')}
                </button>
              `
          }
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-epoch-creation-wizard': VelgEpochCreationWizard;
  }
}
