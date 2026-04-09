/**
 * VelgAchievementBadge — Hexagonal brutalist badge atom.
 *
 * Conceptual direction: Cold War medal display. Each badge is a hexagonal
 * insignia with rarity-driven glow intensity. Legendary badges pulse with
 * an animated metallic sheen. Locked badges are ghosted silhouettes —
 * you know they exist, but their identity is classified.
 *
 * Rarity → visual treatment:
 *   common     → muted border, no glow
 *   uncommon   → success-tinted border, subtle glow
 *   rare       → info-tinted border + glow halo
 *   epic       → influence-tinted border + strong glow + pulse
 *   legendary  → animated conic-gradient sheen + layered glow
 */

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';

import { icons } from '../../utils/icons.js';
import type { AchievementDefinition } from '../../services/api/AchievementsApiService.js';

const RARITY_ICON_SIZE = 32;

@localized()
@customElement('velg-achievement-badge')
export class VelgAchievementBadge extends LitElement {
  static styles = css`
    :host {
      --_size: 88px;
      --_border-width: 2px;
      --_glow-color: var(--color-text-muted);
      --_glow-spread: 0px;
      --_bg: var(--color-surface-raised);
      --_border-color: var(--color-border);
      display: inline-block;
      width: var(--_size);
      position: relative;
      cursor: default;
    }

    /* ── Rarity tiers ── */
    :host([rarity='uncommon']) {
      --_glow-color: var(--color-success);
      --_border-color: var(--color-success);
      --_glow-spread: 6px;
    }
    :host([rarity='rare']) {
      --_glow-color: var(--color-info);
      --_border-color: var(--color-info);
      --_glow-spread: 12px;
    }
    :host([rarity='epic']) {
      --_glow-color: var(--color-epoch-influence);
      --_border-color: var(--color-epoch-influence);
      --_glow-spread: 18px;
    }
    :host([rarity='legendary']) {
      --_glow-color: var(--color-primary);
      --_border-color: var(--color-primary);
      --_glow-spread: 24px;
    }

    .hex-wrapper {
      position: relative;
      width: var(--_size);
      aspect-ratio: 1 / 1.1547;
      clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%);
    }

    .hex-bg {
      position: absolute;
      inset: 0;
      background: var(--_bg);
      border: var(--_border-width) solid var(--_border-color);
      clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color var(--transition-fast), background var(--transition-fast);
    }

    /* Glow halo (behind hex, unclipped) */
    .hex-glow {
      position: absolute;
      inset: -6px;
      clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%);
      background: color-mix(in srgb, var(--_glow-color) 18%, transparent);
      opacity: 0;
      transition: opacity var(--transition-normal);
    }
    :host([earned]) .hex-glow {
      opacity: 1;
    }

    /* Icon */
    .icon {
      color: var(--color-text-secondary);
      transition: color var(--transition-fast);
    }
    :host([earned]) .icon {
      color: var(--_glow-color);
    }

    /* ── Locked state ── */
    :host(:not([earned])) .hex-bg {
      background: var(--color-surface-sunken);
      border-color: var(--color-border);
    }
    :host(:not([earned])) .icon {
      opacity: 0.45;
      filter: grayscale(1);
    }

    /* ── Label ── */
    .label {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
      text-align: center;
      margin-top: var(--space-1);
      line-height: var(--leading-tight);
      max-width: calc(var(--_size) + var(--space-4));
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    :host([earned]) .label {
      color: var(--color-text-primary);
    }
    :host(:not([earned])[secret]) .label {
      font-style: italic;
    }

    /* ── Progress ring ── */
    .progress {
      font-family: var(--font-mono);
      font-size: 9px;
      color: var(--color-text-muted);
      text-align: center;
      margin-top: var(--space-0-5);
    }

    /* ── Legendary animated sheen ── */
    @property --_angle {
      syntax: '<angle>';
      initial-value: 135deg;
      inherits: false;
    }
    :host([rarity='legendary'][earned]) .hex-bg {
      background: conic-gradient(
        from var(--_angle),
        var(--color-surface-raised),
        color-mix(in srgb, var(--color-primary) 20%, var(--color-surface-raised)),
        var(--color-surface-raised),
        color-mix(in srgb, var(--color-primary) 15%, var(--color-surface-raised)),
        var(--color-surface-raised)
      );
      animation: sheen 6s ease-in-out infinite alternate;
    }
    @keyframes sheen {
      to { --_angle: 225deg; }
    }

    /* ── Unlock reveal ── */
    :host(.unlocking) .hex-wrapper {
      animation: unlock-reveal 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    @keyframes unlock-reveal {
      0% {
        transform: scale(0.3) rotate(-15deg);
        opacity: 0;
        filter: brightness(3) blur(4px);
      }
      40% {
        transform: scale(1.15) rotate(3deg);
        opacity: 1;
        filter: brightness(2) blur(0);
      }
      60% {
        transform: scale(0.95) rotate(-1deg);
        filter: brightness(1.5);
      }
      100% {
        transform: scale(1) rotate(0deg);
        filter: brightness(1);
      }
    }

    /* ── Hover ── */
    :host([earned]):hover .hex-bg {
      border-color: color-mix(in srgb, var(--_glow-color) 80%, var(--color-text-primary));
    }

    /* ── Stagger entrance ── */
    :host {
      opacity: 0;
      animation: badge-enter var(--duration-entrance) var(--ease-dramatic) forwards;
      animation-delay: calc(var(--i, 0) * var(--duration-stagger));
    }
    @keyframes badge-enter {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── Reduced motion ── */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
      :host { opacity: 1; }
    }
  `;

  @property({ type: String, reflect: true }) rarity: AchievementDefinition['rarity'] = 'common';
  @property({ type: Boolean, reflect: true }) earned = false;
  @property({ type: Boolean, reflect: true }) secret = false;
  @property({ type: String }) name = '';
  @property({ type: String }) iconKey = 'achievement';
  @property({ type: Number }) progress = -1; // -1 = no progress tracking
  @property({ type: Number }) target = 1;

  private _renderIcon() {
    const key = this.iconKey as string;
    if (key in icons) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fn = (icons as any)[key];
      if (typeof fn === 'function') return fn(RARITY_ICON_SIZE);
    }
    return icons.trophy(RARITY_ICON_SIZE);
  }

  protected render() {
    const showProgress = !this.earned && this.progress >= 0;
    const displayName = this.secret && !this.earned ? msg('Classified') : this.name;

    return html`
      <div class="hex-wrapper" role="img" aria-label=${displayName}>
        <div class="hex-glow"></div>
        <div class="hex-bg">
          <span class="icon">
            ${this._renderIcon()}
          </span>
        </div>
      </div>
      <div class="label">${displayName}</div>
      ${showProgress
        ? html`<div class="progress">${this.progress}/${this.target}</div>`
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-achievement-badge': VelgAchievementBadge;
  }
}
