/**
 * Epoch Battle Log — narrative event feed for competitive actions.
 *
 * Renders a chronological feed of battle events with type-specific icons,
 * narrative text, and cycle numbers. Supports compact mode for overview panels.
 *
 * Microanimations: staggered slide-in, hover glow, type-specific accent pulses.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { BattleLogEntry, BattleLogEventType } from '../../types/index.js';

@localized()
@customElement('velg-epoch-battle-log')
export class VelgEpochBattleLog extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* ── Feed ─────────────────────────────── */

    .feed {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    /* ── Entry ────────────────────────────── */

    .entry {
      display: grid;
      grid-template-columns: 32px 1fr auto;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-2);
      border-bottom: 1px solid var(--color-gray-850, var(--color-gray-800));
      opacity: 0;
      transform: translateY(6px);
      animation: entry-slide 0.35s ease-out forwards;
      transition: background var(--transition-normal);
      position: relative;
    }

    .entry::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 2px;
      opacity: 0;
      transition: opacity var(--transition-normal);
    }

    .entry:hover {
      background: rgba(255 255 255 / 0.02);
    }

    .entry:hover::before {
      opacity: 1;
    }

    .entry:last-child {
      border-bottom: none;
    }

    @keyframes entry-slide {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* ── Type-specific accent colors ─────── */

    .entry--operative_deployed::before      { background: var(--color-warning); }
    .entry--mission_success::before         { background: var(--color-success); }
    .entry--mission_failed::before          { background: var(--color-gray-600); }
    .entry--detected::before                { background: var(--color-danger); }
    .entry--sabotage::before                { background: var(--color-warning); }
    .entry--propaganda::before              { background: #a78bfa; }
    .entry--assassination::before           { background: var(--color-danger); }
    .entry--agent_wounded::before           { background: var(--color-danger); }
    .entry--alliance_formed::before         { background: var(--color-info); }
    .entry--betrayal::before                { background: var(--color-danger-hover); }
    .entry--phase_change::before            { background: var(--color-warning); }
    .entry--counter_intel::before           { background: var(--color-info); }

    /* ── Icon ─────────────────────────────── */

    .entry__icon {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      border: 1px solid var(--color-gray-700);
      background: var(--color-gray-800);
      flex-shrink: 0;
      transition: transform var(--transition-fast);
    }

    .entry:hover .entry__icon {
      transform: scale(1.08);
    }

    /* ── Content ──────────────────────────── */

    .entry__content {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .entry__narrative {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-gray-200);
      line-height: 1.5;
    }

    .entry__type {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-500);
    }

    /* ── Cycle tag ────────────────────────── */

    .entry__cycle {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-gray-600);
      white-space: nowrap;
      align-self: start;
      padding-top: 2px;
    }

    /* ── Phase Divider ────────────────────── */

    .phase-divider {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-2);
      animation: entry-slide 0.35s ease-out forwards;
      opacity: 0;
    }

    .phase-divider__line {
      flex: 1;
      height: 1px;
    }

    .phase-divider__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      white-space: nowrap;
    }

    .phase-divider--foundation .phase-divider__line { background: var(--color-success); }
    .phase-divider--foundation .phase-divider__label { color: var(--color-success); }

    .phase-divider--competition .phase-divider__line { background: var(--color-warning); }
    .phase-divider--competition .phase-divider__label { color: var(--color-warning); }

    .phase-divider--reckoning .phase-divider__line { background: var(--color-danger); }
    .phase-divider--reckoning .phase-divider__label { color: var(--color-danger); }

    /* ── Empty ────────────────────────────── */

    .empty {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-gray-600);
      text-align: center;
      padding: var(--space-4);
    }

    /* ── Compact mode ─────────────────────── */

    :host([compact]) .entry {
      grid-template-columns: 24px 1fr auto;
      padding: var(--space-2) var(--space-1);
      gap: var(--space-2);
    }

    :host([compact]) .entry__icon {
      width: 24px;
      height: 24px;
      font-size: 12px;
    }

    :host([compact]) .entry__narrative {
      font-size: var(--text-xs);
    }

    :host([compact]) .entry__type {
      display: none;
    }

    :host([compact]) .entry::before {
      display: none;
    }
  `;

  @property({ type: Array }) entries: BattleLogEntry[] = [];
  @property({ type: Boolean, reflect: true }) compact = false;

  private _getIcon(type: BattleLogEventType): string {
    const icons: Record<string, string> = {
      operative_deployed: '\u{1F3AF}',
      mission_success: '\u{2705}',
      mission_failed: '\u{274C}',
      detected: '\u{1F6A8}',
      sabotage: '\u{1F4A5}',
      propaganda: '\u{1F4E2}',
      assassination: '\u{1F5E1}',
      agent_wounded: '\u{1FA78}',
      alliance_formed: '\u{1F91D}',
      betrayal: '\u{1F5E1}',
      phase_change: '\u{26A1}',
      counter_intel: '\u{1F50E}',
    };
    return icons[type] || '\u{2694}';
  }

  private _getTypeLabel(type: BattleLogEventType): string {
    const labels: Record<string, string> = {
      operative_deployed: msg('Deployment'),
      mission_success: msg('Mission Success'),
      mission_failed: msg('Mission Failed'),
      detected: msg('Detected'),
      sabotage: msg('Sabotage'),
      propaganda: msg('Propaganda'),
      assassination: msg('Assassination'),
      agent_wounded: msg('Agent Wounded'),
      alliance_formed: msg('Alliance'),
      betrayal: msg('Betrayal'),
      phase_change: msg('Phase Change'),
      counter_intel: msg('Counter-Intel'),
    };
    return labels[type] || type;
  }

  protected render() {
    if (this.entries.length === 0) {
      return html`<p class="empty">${msg('No battle events yet.')}</p>`;
    }

    return html`
      <div class="feed">
        ${this.entries.map((entry, i) => this._renderEntry(entry, i))}
      </div>
    `;
  }

  private _renderEntry(entry: BattleLogEntry, index: number) {
    const delay = index * 50;

    // Phase change entries render as full-width dividers
    if (entry.event_type === 'phase_change') {
      const newPhase = (entry.metadata as Record<string, string> | undefined)?.new_phase ?? '';
      return html`
        <div
          class="phase-divider phase-divider--${newPhase}"
          style="animation-delay: ${delay}ms"
        >
          <div class="phase-divider__line"></div>
          <span class="phase-divider__label">\u26A1 ${newPhase.toUpperCase()}</span>
          <div class="phase-divider__line"></div>
        </div>
      `;
    }

    return html`
      <div
        class="entry entry--${entry.event_type}"
        style="animation-delay: ${delay}ms"
      >
        <div class="entry__icon">${this._getIcon(entry.event_type)}</div>
        <div class="entry__content">
          <span class="entry__narrative">${entry.narrative}</span>
          ${
            this.compact
              ? nothing
              : html`<span class="entry__type">${this._getTypeLabel(entry.event_type)}</span>`
          }
        </div>
        <span class="entry__cycle">${msg('Cycle')} ${entry.cycle_number}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-epoch-battle-log': VelgEpochBattleLog;
  }
}
