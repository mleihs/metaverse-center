/**
 * Dungeon Party Panel — right sidebar instrument readout for agent combat state.
 *
 * Pure signal consumer — reads `dungeonState.party` and renders compact
 * agent status cards. Each card shows portrait, primary aptitude, condition/
 * stress/mood gauges, and active buff/debuff pills.
 *
 * Reuses VelgAvatar for portraits and VelgBadge for effect pills.
 * Pattern: DungeonHeader.ts (signal-reactive, terminal aesthetic).
 *
 * Desktop: vertical card stack in 280px sidebar.
 * Mobile (≤767px): horizontal strip with condensed cards.
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';

import { dungeonState } from '../../services/DungeonStateManager.js';
import type {
  AgentCombatStateClient,
  BuffDebuff,
  Condition,
  StressThreshold,
} from '../../types/dungeon.js';
import type { OperativeType } from '../../types/index.js';
import { getConditionLabel, getStressLabel } from '../../utils/dungeon-formatters.js';
import {
  OPERATIVE_COLORS,
  OPERATIVE_FULL,
  OPERATIVE_SHORT,
} from '../../utils/operative-constants.js';
import { terminalComponentTokens, terminalTokens } from '../shared/terminal-theme-styles.js';
import '../shared/VelgAvatar.js';
import '../shared/VelgBadge.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Condition → gauge fill percentage (operational capacity). */
const CONDITION_FILL: Record<Condition, number> = {
  operational: 100,
  stressed: 75,
  wounded: 50,
  afflicted: 25,
  captured: 5,
};

/** Condition → CSS value for bar color (design token references). */
const CONDITION_COLOR: Record<Condition, string> = {
  operational: 'var(--color-success)',
  stressed: 'var(--color-warning)',
  wounded: 'var(--color-danger)',
  afflicted: 'var(--color-danger)',
  captured: 'var(--color-text-muted)',
};

/** Stress threshold → CSS value for bar color. Normal/tense both amber, critical red. */
const STRESS_COLOR: Record<StressThreshold, string> = {
  normal: 'var(--color-warning)',
  tense: 'var(--color-warning)',
  critical: 'var(--color-danger)',
};

/** Find the agent's highest aptitude (primary school). */
function getPrimaryAptitude(
  aptitudes: Record<string, number>,
): { name: string; value: number } | null {
  const entries = Object.entries(aptitudes);
  if (entries.length === 0) return null;
  const [name, value] = entries.reduce((max, curr) => (curr[1] > max[1] ? curr : max));
  return { name, value };
}

// ── Component ────────────────────────────────────────────────────────────────

@localized()
@customElement('velg-dungeon-party-panel')
export class VelgDungeonPartyPanel extends SignalWatcher(LitElement) {
  static styles = [
    terminalTokens,
    terminalComponentTokens,
    css`
      :host {
        display: block;
        height: 100%;
      }

      /* ── Card Stack ── */
      .cards {
        display: flex;
        flex-direction: column;
        gap: 4px;
        overflow-y: auto;
        max-height: calc(100vh - 120px);
      }

      /* ── Agent Card ── */
      .card {
        border: 1px dashed color-mix(in srgb, var(--_border) 50%, transparent);
        padding: 8px;
        background: color-mix(in srgb, var(--_screen-bg) 50%, transparent);
      }

      .card--stressed {
        border-color: color-mix(in srgb, var(--color-warning) 30%, transparent);
      }

      .card--wounded {
        border-color: color-mix(in srgb, var(--color-danger) 30%, transparent);
      }

      .card--afflicted {
        border-color: color-mix(in srgb, var(--color-danger) 50%, transparent);
      }

      .card--captured {
        opacity: 0.4;
      }

      .card--captured .card-header__name {
        text-decoration: line-through;
      }

      @keyframes afflicted-flicker {
        0%, 46%, 50%, 91%, 95%, 100% { opacity: 1; }
        47% { opacity: 0.7; }
        48%, 49% { opacity: 0.85; }
        92% { opacity: 0.8; }
        93%, 94% { opacity: 0.9; }
      }

      /* ── Card Header ── */
      .card-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }

      .card-header__info {
        flex: 1;
        min-width: 0;
      }

      .card-header__name {
        font-family: var(--_mono);
        font-weight: 700;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--_phosphor);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .card-header__aptitude {
        font-family: var(--_mono);
        font-size: 9px;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        margin-top: 1px;
      }

      .card-aptitudes {
        display: flex;
        gap: 6px;
        padding: 2px 0 4px;
        font-family: var(--_mono);
        font-size: 10px;
        color: var(--_phosphor-dim);
        letter-spacing: 0.5px;
      }

      /* ── Gauge Bars ── */
      .bars {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .bar-row {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .bar-label {
        min-width: 32px;
        width: max-content;
        font-family: var(--_mono);
        font-size: 8px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        color: var(--_phosphor-dim);
        flex-shrink: 0;
      }

      .bar-track {
        flex: 1;
        height: 6px;
        background: color-mix(in srgb, var(--_screen-bg) 60%, var(--_border));
        border: 1px solid color-mix(in srgb, var(--_border) 30%, transparent);
        overflow: hidden;
      }

      .bar-fill {
        height: 100%;
        background: var(--_bar-color);
      }

      /* Stress threshold visual escalation */
      .bar-fill--stress-normal {
        opacity: 0.65;
      }

      @keyframes stress-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }

      .bar-value {
        min-width: 80px;
        font-family: var(--_mono);
        font-size: 8px;
        color: var(--_phosphor-dim);
        text-align: right;
        flex-shrink: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* ── Effects (Buffs/Debuffs) ── */
      .effects {
        display: flex;
        flex-wrap: wrap;
        gap: 3px;
        margin-top: 6px;
      }

      .effects velg-badge {
        --text-xs: 8px;
        --space-0-5: 1px;
        --space-2: 4px;
        --tracking-wide: 0.03em;
      }

      /* ── Empty State ── */
      .empty {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        font-family: var(--_mono);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--_phosphor-dim);
        opacity: 0.4;
      }

      /* ── Stress severity — diagnostic warning levels ── */
      .card--stress-high {
        box-shadow: inset 0 0 8px color-mix(in oklch, var(--color-danger) 30%, transparent);
      }
      .card--stress-critical {
        border-color: color-mix(in srgb, var(--color-danger) 40%, transparent);
      }

      /* ── Motion (opt-in per DungeonHeader pattern) ── */
      @media (prefers-reduced-motion: no-preference) {
        .card {
          transition: border-color var(--duration-fast, 150ms),
                      box-shadow var(--duration-slow, 300ms);
        }
        .bar-fill {
          transition: width var(--duration-slow, 300ms) ease-out;
        }
        .card--afflicted {
          animation: afflicted-flicker 3s linear infinite;
        }
        .bar-fill--stress-critical {
          animation: stress-pulse 1.5s ease-in-out infinite;
        }
        /* System critical pulse — warning light */
        .card--stress-critical {
          animation: system-critical 2s ease-in-out infinite;
        }
        /* Stress increase flash — brief red scanline */
        .bar-fill--stress-spike {
          animation: stress-spike 300ms ease-out;
        }
      }

      @keyframes system-critical {
        0%, 100% { box-shadow: inset 0 0 8px color-mix(in oklch, var(--color-danger) 30%, transparent); }
        50% { box-shadow: inset 0 0 14px color-mix(in oklch, var(--color-danger) 50%, transparent); }
      }

      @keyframes stress-spike {
        0% { box-shadow: 0 0 8px var(--color-danger); filter: brightness(1.4); }
        100% { box-shadow: none; filter: brightness(1); }
      }

      /* ── Mobile ── */
      @media (max-width: 767px) {
        .cards {
          flex-direction: row;
          gap: 6px;
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }

        .cards::-webkit-scrollbar {
          display: none;
        }

        .card {
          min-width: 100px;
          max-width: 140px;
          flex-shrink: 0;
          padding: 4px 6px;
        }

        .card-header {
          margin-bottom: 2px;
          gap: 4px;
        }

        .card-header__aptitude {
          display: none;
        }

        .bars {
          margin-bottom: 0;
        }

        .bar-row--mood {
          display: none;
        }

        .bar-label,
        .bar-value {
          display: none;
        }

        .bar-track {
          height: 3px;
        }

        .effects {
          display: none;
        }
      }

      /* ── Extra-small (matches DungeonHeader 640px) ── */
      @media (max-width: 640px) {
        .card-header__name {
          font-size: 10px;
        }
      }

      /* ── Large screens (1440px+) ── */
      @media (min-width: 1440px) {
        .cards {
          gap: 8px;
        }
        .card {
          padding: 10px;
        }
        .card-header__name {
          font-size: 12px;
        }
        .card-header__aptitude {
          font-size: 10px;
        }
        .bar-label {
          font-size: 9px;
          width: 36px;
        }
        .bar-track {
          height: 7px;
        }
        .bar-value {
          font-size: 9px;
        }
      }

      /* ── 4K / Ultra-wide (2560px+) ── */
      @media (min-width: 2560px) {
        .cards {
          gap: 10px;
        }
        .card {
          padding: 12px;
        }
        .card-header {
          gap: 10px;
          margin-bottom: 8px;
        }
        .card-header__name {
          font-size: 13px;
          letter-spacing: 0.8px;
        }
        .card-header__aptitude {
          font-size: 11px;
        }
        .bars {
          gap: 4px;
        }
        .bar-label {
          font-size: 10px;
          width: 40px;
        }
        .bar-track {
          height: 8px;
        }
        .bar-value {
          font-size: 10px;
          min-width: 72px;
        }
        .effects {
          gap: 4px;
          margin-top: 8px;
        }
        .effects velg-badge {
          --text-xs: 9px;
          --space-0-5: 2px;
          --space-2: 6px;
        }
      }
    `,
  ];

  // ── Render ──────────────────────────────────────────────────────────────

  protected render() {
    const party = dungeonState.party.value;
    if (party.length === 0) {
      return html`<div class="empty">${msg('No operatives')}</div>`;
    }

    return html`
      <div class="cards" role="list" aria-label=${msg('Party status')}>
        ${party.map((agent) => this._renderCard(agent))}
      </div>
    `;
  }

  private _renderCard(agent: AgentCombatStateClient) {
    const primary = getPrimaryAptitude(agent.aptitudes);
    const condFill = CONDITION_FILL[agent.condition];
    const stressFill = Math.min(agent.stress / 1000, 1) * 100;
    const moodFill = ((agent.mood + 100) / 200) * 100;
    const moodColor =
      agent.mood > 20
        ? 'var(--color-success)'
        : agent.mood < -20
          ? 'var(--color-danger)'
          : 'var(--_phosphor-dim)';
    const stressPct = Math.round(stressFill);
    const stressLabel = getStressLabel(stressPct);
    const stressText = stressLabel ? `${stressPct}% ${stressLabel}` : `${stressPct}%`;
    // Stress severity class for card glow/pulse
    const stressSeverity =
      stressPct >= 80 ? 'stress-critical' : stressPct >= 60 ? 'stress-high' : '';
    const aptColor = primary ? OPERATIVE_COLORS[primary.name as OperativeType] : undefined;

    return html`
      <div
        class="card card--${agent.condition} ${stressSeverity ? `card--${stressSeverity}` : ''}"
        role="listitem"
        aria-label=${`${agent.agent_name} \u2013 ${getConditionLabel(agent.condition)}`}
      >
        <!-- Header: Avatar + Name + Primary Aptitude -->
        <div class="card-header">
          <velg-avatar
            .src=${agent.portrait_url ?? ''}
            .name=${agent.agent_name}
            size="sm"
          ></velg-avatar>
          <div class="card-header__info">
            <div class="card-header__name">${agent.agent_name}</div>
            ${
              primary
                ? html`<div
                  class="card-header__aptitude"
                  style=${aptColor ? `color: ${aptColor}` : 'color: var(--_phosphor-dim)'}
                >
                  ${primary.name.toUpperCase()} ${primary.value}
                </div>`
                : nothing
            }
          </div>
        </div>

        <!-- All Aptitudes (compact) -->
        ${
          Object.keys(agent.aptitudes).length > 0
            ? html`
          <div class="card-aptitudes">
            ${Object.entries(agent.aptitudes)
              .filter(([, v]) => v > 0)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(
                ([k, v]) =>
                  html`<span class="apt" title="${OPERATIVE_FULL[k as OperativeType] ?? k}">${OPERATIVE_SHORT[k as OperativeType] ?? k.charAt(0).toUpperCase()}${v}</span>`,
              )}
          </div>
        `
            : nothing
        }

        <!-- Gauge Bars -->
        <div class="bars">
          <div
            class="bar-row bar-row--condition"
            role="progressbar"
            aria-valuenow=${condFill}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label=${msg('Condition')}
          >
            <span class="bar-label">${msg('Cond')}</span>
            <div class="bar-track">
              <div
                class="bar-fill"
                style="width: ${condFill}%; --_bar-color: ${CONDITION_COLOR[agent.condition]}"
              ></div>
            </div>
            <span class="bar-value" aria-live="polite">${getConditionLabel(agent.condition)}</span>
          </div>

          <div
            class="bar-row bar-row--stress"
            role="progressbar"
            aria-valuenow=${agent.stress}
            aria-valuemin="0"
            aria-valuemax="1000"
            aria-label=${msg('Stress')}
          >
            <span class="bar-label">${msg('Str')}</span>
            <div class="bar-track">
              <div
                class="bar-fill bar-fill--stress-${agent.stress_threshold}"
                style="width: ${stressFill}%; --_bar-color: ${STRESS_COLOR[agent.stress_threshold]}"
              ></div>
            </div>
            <span class="bar-value">${stressText}</span>
          </div>

          <div
            class="bar-row bar-row--mood"
            role="progressbar"
            aria-valuenow=${agent.mood}
            aria-valuemin="-100"
            aria-valuemax="100"
            aria-label=${msg('Mood')}
          >
            <span class="bar-label">${msg('Mood')}</span>
            <div class="bar-track">
              <div
                class="bar-fill"
                style="width: ${moodFill}%; --_bar-color: ${moodColor}"
              ></div>
            </div>
            <span class="bar-value">${agent.mood > 0 ? '+' : ''}${agent.mood}</span>
          </div>
        </div>

        <!-- Buff/Debuff Pills -->
        ${
          agent.active_buffs.length > 0 || agent.active_debuffs.length > 0
            ? html`
              <div class="effects" aria-label=${msg('Active effects')}>
                ${agent.active_buffs.map((b) => this._renderEffect(b, true))}
                ${agent.active_debuffs.map((b) => this._renderEffect(b, false))}
              </div>
            `
            : nothing
        }
      </div>
    `;
  }

  private _renderEffect(effect: BuffDebuff, isBuff: boolean) {
    const symbol = isBuff ? '\u25C6' : '\u25C7';
    const variant = isBuff ? 'success' : 'danger';
    const duration = effect.duration_rounds !== null ? ` (${effect.duration_rounds})` : '';

    return html`
      <velg-badge variant=${variant} title=${effect.description}>
        ${symbol} ${effect.name}${duration}
      </velg-badge>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-party-panel': VelgDungeonPartyPanel;
  }
}
