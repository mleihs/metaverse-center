/**
 * Anchor Dashboard — collaborative cross-simulation anchoring.
 *
 * "Diplomatic Anchor Station / Sonar Display" aesthetic:
 * sonar-style concentric circles, radar ping animations, circular strength
 * indicators, radio-comm button styling, and status-driven glow effects.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { heartbeatApi } from '../../services/api/HeartbeatApiService.js';
import type { CollaborativeAnchor } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import { describeArc } from '../../utils/svg.js';
import { renderInfoBubble, infoBubbleStyles } from '../shared/info-bubble-styles.js';
import { VelgToast } from '../shared/Toast.js';

@localized()
@customElement('velg-anchor-dashboard')
export class VelgAnchorDashboard extends LitElement {
  static styles = [infoBubbleStyles, css`
    /* ── Host ──────────────────────────────────────────────── */

    :host {
      display: block;
    }

    /* ── Keyframes ─────────────────────────────────────────── */

    @keyframes anchor-sway {
      0%,
      100% {
        transform: rotate(-4deg);
      }
      50% {
        transform: rotate(4deg);
      }
    }

    @keyframes sonar-ring {
      0% {
        transform: scale(0.15);
        opacity: 0.6;
      }
      100% {
        transform: scale(1);
        opacity: 0;
      }
    }

    @keyframes ping-ripple {
      0% {
        transform: scale(0);
        opacity: 0.5;
      }
      70% {
        opacity: 0.15;
      }
      100% {
        transform: scale(1.6);
        opacity: 0;
      }
    }

    @keyframes dash-rotate {
      to {
        stroke-dashoffset: -28;
      }
    }

    @keyframes status-pulse {
      0%,
      100% {
        opacity: 0.85;
      }
      50% {
        opacity: 1;
      }
    }

    @keyframes reinforcing-glow {
      0%,
      100% {
        box-shadow: 0 0 6px color-mix(in srgb, var(--color-info) 25%, transparent),
          inset 0 0 4px color-mix(in srgb, var(--color-info) 6%, transparent);
      }
      50% {
        box-shadow: 0 0 14px color-mix(in srgb, var(--color-info) 45%, transparent),
          inset 0 0 8px color-mix(in srgb, var(--color-info) 12%, transparent);
      }
    }

    @keyframes scan-text {
      0%,
      100% {
        opacity: 0.5;
      }
      50% {
        opacity: 1;
      }
    }

    /* ── Reduced motion ───────────────────────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .header__icon-sway,
      .sonar-ring,
      .card-ping,
      .anchor-card--forming,
      .status-badge--forming,
      .status-badge--reinforcing,
      .anchor-card--reinforcing,
      .empty__text,
      .forming-border {
        animation: none !important;
      }
      .strength-arc {
        transition: none !important;
      }
    }

    /* ── Header ────────────────────────────────────────────── */

    .header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-4);
    }

    .header__icon-sway {
      display: inline-flex;
      color: var(--color-info);
      transform-origin: 50% 30%;
      animation: anchor-sway 3s ease-in-out infinite;
    }

    .header__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
      margin: 0;
    }

    /* ── Empty / Sonar scan state ──────────────────────────── */

    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-6, 2rem) var(--space-4);
      gap: var(--space-4);
    }

    .sonar-container {
      position: relative;
      width: 120px;
      height: 120px;
    }

    .sonar-ring {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 1px solid var(--color-info);
      opacity: 0;
      animation: sonar-ring 3s ease-out infinite;
    }

    .sonar-ring:nth-child(2) {
      animation-delay: 1s;
    }

    .sonar-ring:nth-child(3) {
      animation-delay: 2s;
    }

    .sonar-center {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 6px;
      height: 6px;
      margin: -3px 0 0 -3px;
      border-radius: 50%;
      background: var(--color-info);
    }

    .empty__text {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      animation: scan-text 2s ease-in-out infinite;
    }

    /* ── Loading ───────────────────────────────────────────── */

    .loading {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      text-align: center;
      padding: var(--space-4);
    }

    /* ── Anchor list ───────────────────────────────────────── */

    .anchors {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    /* ── Anchor Card ───────────────────────────────────────── */

    .anchor-card {
      position: relative;
      overflow: hidden;
      border: 1px solid var(--color-border);
      background: var(--color-surface-raised);
      padding: var(--space-4);
      transition: box-shadow 0.3s ease, border-color 0.3s ease;
    }

    /* Concentric radar rings in card background */
    .anchor-card::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 300px;
      height: 300px;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      background: radial-gradient(
        circle,
        transparent 30%,
        color-mix(in srgb, var(--color-info) 2%, transparent) 32%,
        transparent 34%,
        transparent 48%,
        color-mix(in srgb, var(--color-info) 1.5%, transparent) 50%,
        transparent 52%,
        transparent 66%,
        color-mix(in srgb, var(--color-info) 1%, transparent) 68%,
        transparent 70%
      );
      pointer-events: none;
      z-index: 0;
    }

    .anchor-card > * {
      position: relative;
      z-index: 1;
    }

    /* Ping ripple on first render */
    .card-ping {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 100%;
      height: 100%;
      transform: translate(-50%, -50%) scale(0);
      border-radius: 50%;
      background: radial-gradient(
        circle,
        color-mix(in srgb, var(--color-info) 12%, transparent),
        transparent 70%
      );
      animation: ping-ripple 0.8s ease-out forwards;
      pointer-events: none;
      z-index: 0;
    }

    /* ── Status-driven card borders ───────────────────────── */

    .anchor-card--forming {
      border-style: dashed;
      border-color: var(--color-warning);
    }

    /* Animated dash rotation for forming — uses an SVG overlay */
    .forming-border {
      position: absolute;
      inset: -1px;
      pointer-events: none;
      z-index: 2;
    }

    .forming-border rect {
      fill: none;
      stroke: var(--color-warning);
      stroke-width: 1;
      stroke-dasharray: 8 6;
      animation: dash-rotate 1.2s linear infinite;
    }

    .anchor-card--active {
      border-color: var(--color-success);
      box-shadow: 0 0 8px color-mix(in srgb, var(--color-success) 20%, transparent),
        inset 0 0 4px color-mix(in srgb, var(--color-success) 4%, transparent);
    }

    .anchor-card--reinforcing {
      border-color: var(--color-info);
      animation: reinforcing-glow 2s ease-in-out infinite;
    }

    .anchor-card--dissolved {
      border-color: var(--color-border);
      opacity: 0.85;
    }

    /* ── Card top row ──────────────────────────────────────── */

    .anchor-card__top {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-3);
    }

    .anchor-card__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--color-text-primary);
    }

    /* ── Status badge ──────────────────────────────────────── */

    .status-badge {
      margin-left: auto;
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 2px 8px;
      border: 1px solid;
      white-space: nowrap;
    }

    .status-badge--forming {
      color: var(--color-warning);
      border-color: color-mix(in srgb, var(--color-warning) 40%, transparent);
      animation: status-pulse 1.5s ease-in-out infinite;
    }

    .status-badge--active {
      color: var(--color-success);
      border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
    }

    .status-badge--reinforcing {
      color: var(--color-info);
      border-color: color-mix(in srgb, var(--color-info) 40%, transparent);
      text-shadow: 0 0 4px color-mix(in srgb, var(--color-info) 50%, transparent);
    }

    .status-badge--dissolved {
      color: var(--color-text-secondary);
      border-color: var(--color-border);
    }

    /* ── Resonance signature row ───────────────────────────── */

    .anchor-card__sig {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-3);
    }

    .anchor-card__sig-icon {
      display: inline-flex;
      color: var(--color-info);
    }

    /* ── Strength + Radar row ──────────────────────────────── */

    .gauge-row {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      margin-bottom: var(--space-3);
    }

    /* Circular strength indicator */
    .strength-gauge {
      position: relative;
      flex-shrink: 0;
      width: 56px;
      height: 56px;
    }

    .strength-gauge__bg {
      fill: none;
      stroke: var(--color-surface);
      stroke-width: 4;
    }

    .strength-gauge__arc {
      fill: none;
      stroke: var(--color-info);
      stroke-width: 4;
      stroke-linecap: round;
      transition: d 0.5s ease;
    }

    .strength-gauge__label {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      font-weight: var(--font-bold);
      color: var(--color-text-primary);
    }

    /* ── Radar participant dots ─────────────────────────────── */

    .radar-contacts {
      position: relative;
      flex-shrink: 0;
      width: 44px;
      height: 44px;
    }

    .radar-contacts__ring {
      fill: none;
      stroke: var(--color-border);
      stroke-width: 1;
    }

    .radar-contacts__dot {
      fill: var(--color-info);
    }

    .radar-contacts__label {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      fill: var(--color-text-secondary);
      text-anchor: middle;
    }

    /* ── Protection shield badge ───────────────────────────── */

    .protection-badge {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1) var(--space-2);
      background: color-mix(in srgb, var(--color-success) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-success) 20%, transparent);
    }

    .protection-badge__icon {
      display: inline-flex;
      color: var(--color-success);
    }

    .protection-badge__value {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      color: var(--color-success);
    }

    .protection-badge__suffix {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      text-transform: uppercase;
      color: var(--color-text-secondary);
      letter-spacing: 0.04em;
    }

    /* ── Meta row ──────────────────────────────────────────── */

    .meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      align-items: center;
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-secondary);
    }

    .meta-row__item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    /* ── Action buttons (radio-comm style) ─────────────────── */

    .anchor-card__actions {
      display: flex;
      gap: var(--space-2);
      margin-top: var(--space-3);
    }

    .radio-btn {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: var(--space-2) var(--space-3);
      min-height: 44px;
      min-width: 44px;
      border-radius: 6px;
      background: var(--color-surface);
      border: 2px solid var(--color-border);
      color: var(--color-text-secondary);
      cursor: pointer;
      position: relative;
      transition: all var(--transition-fast);
      /* "Press" depth */
      box-shadow: 0 3px 0 var(--color-surface-sunken),
        inset 0 1px 0 color-mix(in srgb, var(--color-text-primary) 4%, transparent);
    }

    .radio-btn:hover {
      color: var(--color-info);
      border-color: var(--color-info);
      background: color-mix(in srgb, var(--color-info) 8%, transparent);
    }

    .radio-btn:active {
      transform: translateY(2px);
      box-shadow: 0 1px 0 var(--color-surface-sunken),
        inset 0 1px 0 color-mix(in srgb, var(--color-text-primary) 4%, transparent);
    }

    .radio-btn:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    .radio-btn--danger:hover {
      color: var(--color-danger);
      border-color: var(--color-danger);
      background: color-mix(in srgb, var(--color-danger) 8%, transparent);
    }
  `];

  @property({ type: String }) simulationId = '';
  @state() private _anchors: CollaborativeAnchor[] = [];
  @state() private _loading = false;

  connectedCallback(): void {
    super.connectedCallback();
    if (this.simulationId) this._load();
  }

  private async _load(): Promise<void> {
    this._loading = true;
    const res = await heartbeatApi.listAnchors({
      simulation_id: this.simulationId,
    });
    if (res.success && res.data) {
      this._anchors = res.data as CollaborativeAnchor[];
    }
    this._loading = false;
  }

  private _isParticipant(anchor: CollaborativeAnchor): boolean {
    return (anchor.anchor_simulation_ids ?? []).includes(this.simulationId);
  }

  private async _joinAnchor(anchorId: string): Promise<void> {
    const res = await heartbeatApi.joinAnchor(anchorId, this.simulationId);
    if (res.success) {
      VelgToast.success(msg('Joined anchor. Protection strengthens each tick.'));
    } else {
      VelgToast.error(res.error?.message ?? msg('Failed to join anchor.'));
    }
    await this._load();
  }

  private async _leaveAnchor(anchorId: string): Promise<void> {
    const res = await heartbeatApi.leaveAnchor(anchorId, this.simulationId);
    if (res.success) {
      VelgToast.info(msg('Left anchor.'));
    } else {
      VelgToast.error(res.error?.message ?? msg('Failed to leave anchor.'));
    }
    await this._load();
  }

  /* ── Templates ──────────────────────────────────────────────── */

  protected render() {
    return html`
      <div class="header">
        <span class="header__icon-sway">${icons.anchor(16)}</span>
        <h3 class="header__title">
          ${msg('Collaborative Anchors')}
          ${renderInfoBubble(msg('Anchors pool stability across embassy-connected simulations. Strength grows each tick. Higher strength + more participants = greater protection from resonance impacts.'))}
        </h3>
      </div>

      ${this._loading
        ? html`<div class="loading">${msg('Loading...')}</div>`
        : this._anchors.length === 0
          ? this._renderEmpty()
          : html`
              <div class="anchors" role="list" aria-label=${msg('Active anchors')}>
                ${this._anchors.map((a) => this._renderAnchor(a))}
              </div>
            `}
    `;
  }

  private _renderEmpty() {
    return html`
      <div class="empty">
        <div class="sonar-container" aria-hidden="true">
          <div class="sonar-ring"></div>
          <div class="sonar-ring"></div>
          <div class="sonar-ring"></div>
          <div class="sonar-center"></div>
        </div>
        <span class="empty__text">${msg('Scanning for anchor points...')}</span>
      </div>
    `;
  }

  private _renderAnchor(anchor: CollaborativeAnchor) {
    const participating = this._isParticipant(anchor);
    const participantCount = (anchor.anchor_simulation_ids ?? []).length;
    const protection = Math.min(0.7, anchor.strength * (participantCount / 5));
    const strengthPct = Math.round(anchor.strength * 100);
    const protectionPct = Math.round(protection * 100);

    return html`
      <div
        class="anchor-card anchor-card--${anchor.status}"
        role="listitem"
      >
        <!-- Ping ripple on render -->
        <div class="card-ping" aria-hidden="true"></div>

        <!-- Forming status: animated dashed border overlay -->
        ${anchor.status === 'forming'
          ? svg`<svg class="forming-border" aria-hidden="true">
              <rect x="0.5" y="0.5" width="calc(100% - 1px)" height="calc(100% - 1px)" rx="0" />
            </svg>`
          : nothing}

        <!-- Top row: icon + name + status -->
        <div class="anchor-card__top">
          <span aria-hidden="true">${icons.anchor(16)}</span>
          <span class="anchor-card__name">${anchor.name}</span>
          <span class="status-badge status-badge--${anchor.status}">
            ${anchor.status}
          </span>
        </div>

        <!-- Resonance signature with archetype icon -->
        <div class="anchor-card__sig">
          <span class="anchor-card__sig-icon" aria-hidden="true">
            ${icons.resonanceArchetype(anchor.resonance_signature, 14)}
          </span>
          ${anchor.resonance_signature}
        </div>

        <!-- Gauge row: circular strength + radar contacts + shield badge -->
        <div class="gauge-row">
          ${this._renderStrengthGauge(strengthPct)}
          ${this._renderRadarContacts(participantCount)}
          <div class="protection-badge" aria-label=${msg(str`Protection: ${protectionPct} percent`)}>
            <span class="protection-badge__icon" aria-hidden="true">
              ${icons.operativeGuardian(16)}
            </span>
            <span class="protection-badge__value" aria-hidden="true">${protectionPct}%</span>
            <span class="protection-badge__suffix" aria-hidden="true">${msg('Protection')}</span>
          </div>
        </div>

        <!-- Meta row -->
        <div class="meta-row">
          <span class="meta-row__item" aria-label=${msg(str`Strength: ${strengthPct} percent`)}>
            ${msg('Strength')}: ${strengthPct}%
          </span>
          <span class="meta-row__item">
            ${participantCount} ${msg('shard(s)')}
          </span>
        </div>

        <!-- Actions -->
        <div class="anchor-card__actions">
          ${participating
            ? html`
                <button
                  class="radio-btn radio-btn--danger"
                  @click=${() => this._leaveAnchor(anchor.id)}
                >
                  ${msg('Leave')}
                </button>
              `
            : anchor.status !== 'dissolved'
              ? html`
                  <button
                    class="radio-btn"
                    @click=${() => this._joinAnchor(anchor.id)}
                  >
                    ${msg('Join Anchor')}
                  </button>
                `
              : nothing}
        </div>
      </div>
    `;
  }

  /* ── Circular strength gauge (SVG arc) ─────────────────────── */

  private _renderStrengthGauge(pct: number) {
    const r = 22;
    const cx = 28;
    const cy = 28;
    const angle = Math.max(1, (pct / 100) * 360 - 0.01);
    const arcPath = describeArc(cx, cy, r, 0, angle);

    return html`
      <div
        class="strength-gauge"
        role="progressbar"
        aria-valuenow=${pct}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label=${msg('Anchor strength')}
      >
        ${svg`
          <svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle class="strength-gauge__bg" cx="${cx}" cy="${cy}" r="${r}" />
            <path class="strength-gauge__arc" d="${arcPath}" />
          </svg>
        `}
        <span class="strength-gauge__label">${pct}%</span>
      </div>
    `;
  }

  /* ── Radar contacts (participant dots in a circle) ──────────── */

  private _renderRadarContacts(count: number) {
    const r = 15;
    const cx = 22;
    const cy = 22;
    const dots = [];
    const clampedCount = Math.min(count, 12);

    for (let i = 0; i < clampedCount; i++) {
      const angle = ((i * 360) / clampedCount - 90) * (Math.PI / 180);
      const dx = cx + r * Math.cos(angle);
      const dy = cy + r * Math.sin(angle);
      dots.push(svg`<circle class="radar-contacts__dot" cx="${dx}" cy="${dy}" r="2.5" />`);
    }

    return html`
      <div class="radar-contacts" aria-hidden="true" title="${count} ${msg('shard(s)')}">
        ${svg`
          <svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
            <circle class="radar-contacts__ring" cx="${cx}" cy="${cy}" r="${r}" />
            <circle class="radar-contacts__ring" cx="${cx}" cy="${cy}" r="${r * 0.5}" />
            ${dots}
            <text class="radar-contacts__label" x="${cx}" y="${cy + 3.5}">${count}</text>
          </svg>
        `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-anchor-dashboard': VelgAnchorDashboard;
  }
}
