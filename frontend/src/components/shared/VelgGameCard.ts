/**
 * VelgGameCard — Unified TCG card component.
 *
 * Used for agents and buildings across the entire platform.
 * 5:8 aspect ratio, 4 sizes, 3 rarity tiers, per-simulation themed frames,
 * 3D tilt on hover, holographic foil for legendary cards, stat gems, aptitude pips.
 */

import { msg } from '@lit/localize';
import { css, html, LitElement, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { AptitudeSet, OperativeType } from '../../types/index.js';

// ── Operative type colors (shared with VelgAptitudeBars) ──
const OP_COLORS: Record<OperativeType, string> = {
  spy: '#64748b',
  guardian: '#10b981',
  saboteur: '#ef4444',
  propagandist: '#f59e0b',
  infiltrator: '#a78bfa',
  assassin: '#dc2626',
};

const OP_LABELS: OperativeType[] = [
  'spy',
  'guardian',
  'saboteur',
  'propagandist',
  'infiltrator',
  'assassin',
];

const OP_SHORT: Record<OperativeType, string> = {
  spy: 'SPY',
  guardian: 'GRD',
  saboteur: 'SAB',
  propagandist: 'PRP',
  infiltrator: 'INF',
  assassin: 'ASN',
};

export type CardType = 'agent' | 'building';
export type CardSize = 'xs' | 'sm' | 'md' | 'lg';
export type CardRarity = 'common' | 'rare' | 'legendary';

export interface CardBadge {
  label: string;
  variant?: string;
}

export interface CapacityBar {
  current: number;
  max: number;
}

@customElement('velg-game-card')
export class VelgGameCard extends LitElement {
  static styles = css`
    /* ═══════════════════════════════════════════════════
       CARD CONTAINER — perspective wrapper
       ═══════════════════════════════════════════════════ */
    :host {
      display: block;
      --card-w: 200px;
      --card-h: 320px;
      /* Theme-inherited card tokens (defaults for non-themed contexts) */
      --card-frame-primary: var(--color-primary, #ff6b2b);
      --card-frame-secondary: var(--color-secondary, #3b82f6);
      --card-bg: var(--color-surface, #1a1a1a);
      --card-bg-deep: var(--color-surface-sunken, #0f0f0f);
      --card-text: var(--color-text-primary, #e5e5e5);
      --card-text-dim: var(--color-text-secondary, #999);
      --card-border-color: var(--color-border, #333);
      --card-radius: var(--border-radius, 0px);
      --card-font-heading: var(--font-brutalist, 'Oswald', sans-serif);
      --card-font-body: var(--font-sans, system-ui, sans-serif);
      --card-font-mono: var(--font-mono, monospace);
    }

    :host([size="xs"]) { --card-w: 80px;  --card-h: 128px; }
    :host([size="sm"]) { --card-w: 120px; --card-h: 192px; }
    :host([size="md"]) { --card-w: 200px; --card-h: 320px; }
    :host([size="lg"]) { --card-w: 280px; --card-h: 448px; }

    .card-perspective {
      width: var(--card-w);
      height: var(--card-h);
      perspective: 800px;
    }

    /* ═══════════════════════════════════════════════════
       CARD FRAME — the physical card
       ═══════════════════════════════════════════════════ */
    .card {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      border-radius: calc(var(--card-radius) + 6px);
      overflow: hidden;
      cursor: pointer;
      transform-style: preserve-3d;
      will-change: transform;
      transition: transform 200ms var(--ease-out, ease-out),
                  box-shadow 200ms var(--ease-out, ease-out);

      /* Default border */
      border: 2px solid var(--card-border-color);
      background: var(--card-bg-deep);
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);

      /* Entrance animation */
      opacity: 0;
      animation: card-deal var(--duration-entrance, 400ms)
                 var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) forwards;
      animation-delay: calc(var(--i, 0) * var(--duration-stagger, 50ms));
    }

    @keyframes card-deal {
      from {
        opacity: 0;
        transform: translateY(60px) scale(0.8) rotateZ(8deg);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1) rotateZ(0deg);
      }
    }

    /* Tilt on hover (JS sets --mx, --my 0..1) */
    .card--interactive:hover {
      box-shadow: 0 8px 30px rgba(0,0,0,0.5);
    }

    .card--interactive.card--tilting {
      transition: box-shadow 200ms var(--ease-out, ease-out);
      transform: scale(1.05) translateY(-8px)
                 rotateX(calc((0.5 - var(--my, 0.5)) * 24deg))
                 rotateY(calc((var(--mx, 0.5) - 0.5) * 24deg));
    }

    /* Spring-back on leave */
    .card--interactive.card--settling {
      transition: transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1),
                  box-shadow 400ms var(--ease-out, ease-out);
      transform: scale(1) translateY(0) rotateX(0) rotateY(0);
    }

    /* Dimmed state (drafted) */
    .card--dimmed {
      filter: grayscale(0.8) brightness(0.6);
      opacity: 0.35;
      pointer-events: none;
    }

    .card--highlighted {
      box-shadow: 0 0 0 3px var(--card-frame-primary),
                  0 0 20px color-mix(in srgb, var(--card-frame-primary) 40%, transparent);
    }

    /* ── Light reflection overlay (follows mouse) ── */
    .card__reflection {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 5;
      opacity: 0;
      transition: opacity 300ms ease;
      background: radial-gradient(
        circle at calc(var(--mx, 0.5) * 100%) calc(var(--my, 0.5) * 100%),
        rgba(255,255,255,0.15),
        transparent 60%
      );
      mix-blend-mode: overlay;
    }

    .card--tilting .card__reflection {
      opacity: 1;
    }

    /* ── Holographic foil (legendary only) ── */
    .card__holo {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 6;
      opacity: 0;
      transition: opacity 300ms ease;
      background: linear-gradient(
        115deg,
        transparent 20%,
        rgba(255,100,100,0.1) 30%,
        rgba(100,255,100,0.1) 40%,
        rgba(100,100,255,0.1) 50%,
        transparent 60%
      );
      background-size: 300% 300%;
      background-position: calc(var(--mx, 0.5) * 100%) calc(var(--my, 0.5) * 100%);
      mix-blend-mode: color-dodge;
      filter: brightness(0.8) contrast(2);
    }

    .card--tilting .card__holo {
      opacity: 1;
    }

    /* ── Rarity borders ── */
    .card--common {
      border-color: var(--card-border-color);
    }

    .card--rare {
      border-color: transparent;
      background-clip: padding-box;
      border-image: linear-gradient(
        180deg,
        var(--card-frame-primary),
        var(--card-border-color)
      ) 1;
    }

    .card--rare.card--rounded-border {
      /* For sims with border-radius > 0, use box-shadow instead of border-image */
      border-image: none;
      border-color: var(--card-frame-primary);
      box-shadow: 0 2px 8px rgba(0,0,0,0.3),
                  0 0 0 1px var(--card-frame-primary);
    }

    .card--legendary {
      border-color: var(--card-frame-primary);
      animation: card-deal var(--duration-entrance, 400ms)
                 var(--ease-spring) forwards,
                 legendary-glow 3s ease-in-out infinite;
      animation-delay: calc(var(--i, 0) * var(--duration-stagger, 50ms)), 0s;
    }

    @keyframes legendary-glow {
      0%, 100% {
        box-shadow: 0 2px 8px rgba(0,0,0,0.3),
                    0 0 4px color-mix(in srgb, var(--card-frame-primary) 40%, transparent);
      }
      50% {
        box-shadow: 0 2px 8px rgba(0,0,0,0.3),
                    0 0 12px color-mix(in srgb, var(--card-frame-primary) 60%, transparent);
      }
    }

    /* ── Idle micro-sway ── */
    .card--idle {
      animation: card-deal var(--duration-entrance, 400ms) var(--ease-spring) forwards,
                 card-sway 4s ease-in-out infinite;
      animation-delay: calc(var(--i, 0) * var(--duration-stagger, 50ms)),
                       calc(var(--i, 0) * 200ms);
    }

    @keyframes card-sway {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-1px); }
    }

    /* Legendary gets sway + glow combined */
    .card--legendary.card--idle {
      animation: card-deal var(--duration-entrance, 400ms) var(--ease-spring) forwards,
                 card-sway 4s ease-in-out infinite,
                 legendary-glow 3s ease-in-out infinite;
      animation-delay: calc(var(--i, 0) * var(--duration-stagger, 50ms)),
                       calc(var(--i, 0) * 200ms),
                       0s;
    }

    /* ═══════════════════════════════════════════════════
       STAT GEMS — top corners
       ═══════════════════════════════════════════════════ */
    .card__gems {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      display: flex;
      justify-content: space-between;
      padding: 6px 8px;
      z-index: 3;
      pointer-events: none;
    }

    .gem {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      font-family: var(--card-font-mono);
      font-weight: 700;
      font-size: 11px;
      color: var(--card-text);
      border: 1px solid var(--card-border-color);
      background: var(--card-bg-deep);
      transform: rotate(45deg);
      border-radius: 4px;
    }

    .gem__inner {
      transform: rotate(-45deg);
      line-height: 1;
    }

    .gem--glow {
      border-color: var(--gem-color, var(--card-frame-primary));
      box-shadow: 0 0 6px color-mix(in srgb, var(--gem-color, var(--card-frame-primary)) 50%, transparent);
    }

    /* Size scaling for gems */
    :host([size="xs"]) .card__gems { padding: 3px 4px; }
    :host([size="xs"]) .gem { width: 14px; height: 14px; font-size: 7px; }
    :host([size="sm"]) .card__gems { padding: 4px 6px; }
    :host([size="sm"]) .gem { width: 18px; height: 18px; font-size: 9px; }
    :host([size="lg"]) .gem { width: 30px; height: 30px; font-size: 14px; }

    /* Condition dots for buildings (right gem replacement) */
    .gem--condition {
      background: transparent;
      border: none;
      box-shadow: none;
      transform: none;
      gap: 2px;
      width: auto;
    }

    .gem--condition .gem__inner {
      transform: none;
      display: flex;
      gap: 2px;
    }

    .condition-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      border: 1px solid var(--dot-color, #555);
    }

    .condition-dot--filled {
      background: var(--dot-color, #555);
    }

    :host([size="xs"]) .condition-dot { width: 3px; height: 3px; }
    :host([size="sm"]) .condition-dot { width: 4px; height: 4px; }
    :host([size="lg"]) .condition-dot { width: 8px; height: 8px; }

    /* ═══════════════════════════════════════════════════
       ART FRAME — portrait / building image
       ═══════════════════════════════════════════════════ */
    .card__art {
      position: relative;
      flex: 0 0 60%;
      overflow: hidden;
      background: var(--card-bg-deep);
      border-bottom: 1px solid color-mix(in srgb, var(--card-frame-primary) 30%, transparent);
    }

    .card__art img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top;
      display: block;
    }

    .card__art-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      color: var(--card-text-dim);
      opacity: 0.55;
    }

    /* Inner glow on art frame */
    .card__art::after {
      content: '';
      position: absolute;
      inset: 0;
      box-shadow: inset 0 0 12px rgba(0,0,0,0.25);
      pointer-events: none;
    }

    /* ═══════════════════════════════════════════════════
       NAME PLATE
       ═══════════════════════════════════════════════════ */
    .card__nameplate {
      padding: 6px 10px 4px;
      background: color-mix(in srgb, var(--card-bg-deep) 90%, var(--card-frame-primary));
      border-bottom: 1px solid var(--card-border-color);
    }

    .card__name {
      font-family: var(--card-font-heading);
      font-weight: 700;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--card-text);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: 1.3;
    }

    .card__name-divider {
      width: 60%;
      height: 1px;
      margin: 3px auto 0;
      background: linear-gradient(90deg,
        transparent,
        var(--card-frame-primary),
        transparent
      );
    }

    :host([size="xs"]) .card__nameplate { padding: 2px 4px 1px; }
    :host([size="xs"]) .card__name { font-size: 7px; letter-spacing: 0.04em; }
    :host([size="sm"]) .card__nameplate { padding: 4px 6px 2px; }
    :host([size="sm"]) .card__name { font-size: 10px; }
    :host([size="lg"]) .card__nameplate { padding: 8px 14px 6px; }
    :host([size="lg"]) .card__name { font-size: 16px; }

    /* ═══════════════════════════════════════════════════
       CARD BODY — aptitude pips, badges, subtitle
       ═══════════════════════════════════════════════════ */
    .card__body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 5px 10px 6px;
      min-height: 0;
      overflow: hidden;
    }

    :host([size="xs"]) .card__body { padding: 2px 4px 3px; gap: 1px; }
    :host([size="sm"]) .card__body { padding: 3px 6px 4px; gap: 2px; }
    :host([size="lg"]) .card__body { padding: 8px 14px 10px; gap: 5px; }

    /* ── Aptitude Pips ── */
    .card__pips {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }

    .pip {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
    }

    .pip__dot {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--card-font-mono);
      font-weight: 700;
      font-size: 9px;
      color: var(--card-bg-deep);
      background: var(--pip-color);
      border: 1px solid color-mix(in srgb, var(--pip-color) 60%, transparent);
      transition: all 150ms ease;
    }

    .pip__dot--dim {
      opacity: 0.4;
      filter: saturate(0.5);
    }

    .pip__dot--bright {
      box-shadow: 0 0 6px color-mix(in srgb, var(--pip-color) 50%, transparent);
    }

    .pip__label {
      font-family: var(--card-font-mono);
      font-size: 6px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--card-text-dim);
      line-height: 1;
    }

    :host([size="xs"]) .card__pips { display: none; }
    :host([size="sm"]) .pip__dot { width: 14px; height: 14px; font-size: 7px; }
    :host([size="sm"]) .pip__label { display: none; }
    :host([size="lg"]) .pip__dot { width: 22px; height: 22px; font-size: 11px; }
    :host([size="lg"]) .pip__label { font-size: 7px; }

    /* ── Subtitle & Badges ── */
    .card__subtitle {
      font-family: var(--card-font-body);
      font-size: 9px;
      color: var(--card-text-dim);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: 1.3;
    }

    :host([size="xs"]) .card__subtitle { display: none; }
    :host([size="sm"]) .card__subtitle { font-size: 8px; }
    :host([size="lg"]) .card__subtitle { font-size: 12px; }

    .card__badges {
      display: flex;
      flex-wrap: wrap;
      gap: 3px;
    }

    .card__badge {
      font-family: var(--card-font-mono);
      font-size: 7px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 1px 4px;
      border: 1px solid var(--card-border-color);
      color: var(--card-text-dim);
      line-height: 1.3;
    }

    :host([size="xs"]) .card__badges { display: none; }
    :host([size="sm"]) .card__badge { font-size: 6px; padding: 0 2px; }
    :host([size="lg"]) .card__badge { font-size: 9px; padding: 2px 6px; }

    /* ── Capacity Bar (buildings) ── */
    .card__capacity {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: auto;
    }

    .capacity__bar {
      flex: 1;
      height: 4px;
      background: var(--card-border-color);
      border-radius: 2px;
      overflow: hidden;
    }

    .capacity__fill {
      height: 100%;
      background: var(--card-frame-primary);
      border-radius: 2px;
      transition: width 300ms var(--ease-out, ease-out);
    }

    .capacity__text {
      font-family: var(--card-font-mono);
      font-size: 8px;
      color: var(--card-text-dim);
      white-space: nowrap;
    }

    :host([size="xs"]) .card__capacity { display: none; }
    :host([size="sm"]) .capacity__text { font-size: 6px; }
    :host([size="lg"]) .capacity__bar { height: 6px; }
    :host([size="lg"]) .capacity__text { font-size: 10px; }

    /* ── Connections indicator ── */
    .card__connections {
      font-family: var(--card-font-mono);
      font-size: 8px;
      color: var(--card-text-dim);
      margin-top: auto;
    }

    :host([size="xs"]) .card__connections { display: none; }
    :host([size="sm"]) .card__connections { font-size: 6px; }
    :host([size="lg"]) .card__connections { font-size: 10px; }

    /* ── Edit/Delete action buttons (grid view) ── */
    .card__actions {
      position: absolute;
      bottom: 6px;
      right: 6px;
      display: flex;
      gap: 4px;
      z-index: 4;
      opacity: 0;
      transition: opacity 150ms ease;
    }

    .card:hover .card__actions {
      opacity: 1;
    }

    .card__action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: color-mix(in srgb, var(--card-bg-deep) 85%, transparent);
      backdrop-filter: blur(4px);
      color: var(--card-text);
      cursor: pointer;
      transform: scale(0);
      transition: transform 150ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)),
                  background 100ms ease;
    }

    .card:hover .card__action-btn {
      transform: scale(1);
    }

    .card:hover .card__action-btn:nth-child(2) {
      transition-delay: 50ms;
    }

    .card__action-btn:hover {
      background: var(--card-bg-deep);
    }

    .card__action-btn--danger:hover {
      background: var(--color-danger, #dc2626);
    }

    .card__description-edit {
      width: 100%;
      height: 80px;
      margin-top: 4px;
      background: var(--card-bg-deep);
      color: var(--card-text);
      border: 1px solid var(--card-border-color);
      font-family: var(--card-font-body);
      font-size: 9px;
      resize: none;
      padding: 2px 4px;
    }

    :host([size="lg"]) .card__description-edit {
      height: 100px;
      font-size: 11px;
    }

    /* ── DRAFTED stamp overlay ── */
    .card__stamp {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-12deg);
      font-family: var(--card-font-heading);
      font-weight: 900;
      font-size: 18px;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--color-epoch-accent, #f59e0b);
      opacity: 0.6;
      z-index: 10;
      pointer-events: none;
    }

    :host([size="xs"]) .card__stamp { font-size: 8px; }
    :host([size="sm"]) .card__stamp { font-size: 12px; }
    :host([size="lg"]) .card__stamp { font-size: 24px; }

    /* ═══════════════════════════════════════════════════
       MOBILE — center card in single-column grid cell
       ═══════════════════════════════════════════════════ */
    @media (max-width: 480px) {
      .card-perspective {
        margin: 0 auto;
      }
    }

    /* ═══════════════════════════════════════════════════
       REDUCED MOTION
       ═══════════════════════════════════════════════════ */
    @media (prefers-reduced-motion: reduce) {
      .card {
        animation: none !important;
        opacity: 1;
        transition: none;
      }
      .card__reflection,
      .card__holo {
        display: none;
      }
      .card__action-btn {
        transform: scale(1);
        transition: none;
      }
    }
  `;

  // ── Properties ──

  @property({ reflect: true }) size: CardSize = 'md';
  @property() type: CardType = 'agent';
  @property() rarity: CardRarity = 'common';
  @property() name = '';
  @property({ attribute: 'image-url' }) imageUrl = '';
  @property({ type: Number, attribute: 'primary-stat' }) primaryStat: number | null = null;
  @property({ type: Number, attribute: 'secondary-stat' }) secondaryStat: number | null = null;
  @property({ type: Number, attribute: 'condition-dots' }) conditionDots: number | null = null;
  @property({ type: Object }) aptitudes: AptitudeSet | null = null;
  @property({ type: Array }) badges: CardBadge[] = [];
  @property() subtitle = '';
  @property({ type: Object }) capacityBar: CapacityBar | null = null;
  @property({ type: Number, attribute: 'connection-count' }) connectionCount = 0;
  @property({ type: Boolean }) interactive = true;
  @property({ type: Boolean }) draggable = false;
  @property({ type: Boolean }) dimmed = false;
  @property({ type: Boolean }) highlighted = false;
  @property({ type: Boolean, attribute: 'show-actions' }) showActions = false;
  @property({ type: Boolean }) editable = false;
  @property() description = '';

  @state() private _tilting = false;
  @state() private _settling = false;
  @state() private _mx = 0.5;
  @state() private _my = 0.5;

  private _settleTimer = 0;

  // ── Mouse tracking for 3D tilt ──

  private _onMouseMove = (e: MouseEvent) => {
    if (!this.interactive || this.size === 'xs') return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this._mx = (e.clientX - rect.left) / rect.width;
    this._my = (e.clientY - rect.top) / rect.height;
    if (!this._tilting) {
      this._tilting = true;
      this._settling = false;
      window.clearTimeout(this._settleTimer);
    }
  };

  private _onMouseLeave = () => {
    if (!this.interactive) return;
    this._tilting = false;
    this._settling = true;
    this._mx = 0.5;
    this._my = 0.5;
    window.clearTimeout(this._settleTimer);
    this._settleTimer = window.setTimeout(() => {
      this._settling = false;
    }, 600);
  };

  private _onClick = () => {
    this.dispatchEvent(new CustomEvent('card-click', { bubbles: true, composed: true }));
  };

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._onClick();
    }
  };

  private _onEditClick = (e: Event) => {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('card-edit', { bubbles: true, composed: true }));
  };

  private _onDeleteClick = (e: Event) => {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('card-delete', { bubbles: true, composed: true }));
  };

  // ── Drag support ──

  private _onDragStart = (e: DragEvent) => {
    if (!this.draggable) return;
    e.dataTransfer?.setData('text/plain', '');
    this.dispatchEvent(new CustomEvent('card-drag-start', { bubbles: true, composed: true }));
  };

  // ── Helpers ──

  private _getBestAptitude(): { type: OperativeType; level: number } | null {
    if (!this.aptitudes) return null;
    let best: OperativeType = 'spy';
    let bestLevel = 0;
    for (const t of OP_LABELS) {
      if (this.aptitudes[t] > bestLevel) {
        bestLevel = this.aptitudes[t];
        best = t;
      }
    }
    return { type: best, level: bestLevel };
  }

  // ── Render ──

  protected render() {
    const best = this._getBestAptitude();
    const isLegendary = this.rarity === 'legendary';
    const hasRoundBorder =
      getComputedStyle(this).getPropertyValue('--card-radius').trim() !== '0px' &&
      getComputedStyle(this).getPropertyValue('--card-radius').trim() !== '0';

    const cardClasses = {
      card: true,
      'card--interactive': this.interactive,
      'card--tilting': this._tilting,
      'card--settling': this._settling && !this._tilting,
      'card--dimmed': this.dimmed,
      'card--highlighted': this.highlighted,
      'card--idle': !this._tilting && !this._settling && !this.dimmed,
      'card--common': this.rarity === 'common',
      'card--rare': this.rarity === 'rare',
      'card--rounded-border': this.rarity === 'rare' && hasRoundBorder,
      'card--legendary': isLegendary,
    };

    const tiltVars = styleMap({
      '--mx': String(this._mx),
      '--my': String(this._my),
    });

    return html`
      <div class="card-perspective">
        <div
          class=${classMap(cardClasses)}
          style=${tiltVars}
          role="button"
          tabindex="0"
          .draggable=${this.draggable}
          aria-label=${this.name}
          @mousemove=${this._onMouseMove}
          @mouseleave=${this._onMouseLeave}
          @click=${this._onClick}
          @keydown=${this._onKeyDown}
          @dragstart=${this._onDragStart}
        >
          <!-- Light reflection -->
          <div class="card__reflection"></div>

          <!-- Holographic foil (legendary only) -->
          ${isLegendary ? html`<div class="card__holo"></div>` : nothing}

          <!-- Stat gems -->
          ${this._renderGems(best)}

          <!-- Artwork -->
          <div class="card__art">
            ${
              this.imageUrl
                ? html`<img src=${this.imageUrl} alt=${this.name} loading="lazy" />`
                : html`<div class="card__art-placeholder">${this._renderPlaceholderIcon()}</div>`
            }
          </div>

          <!-- Name plate -->
          <div class="card__nameplate">
            <h3 class="card__name">${this.name}</h3>
            <div class="card__name-divider"></div>
          </div>

          <!-- Body -->
          <div class="card__body">
            ${this.type === 'agent' ? this._renderAgentBody() : this._renderBuildingBody()}
          </div>

          <!-- Action buttons (edit/delete) -->
          ${
            this.showActions
              ? html`
            <div class="card__actions">
              <button class="card__action-btn" @click=${this._onEditClick} aria-label=${msg('Edit')}>
                ${_editIcon()}
              </button>
              <button class="card__action-btn card__action-btn--danger" @click=${this._onDeleteClick} aria-label=${msg('Delete')}>
                ${_trashIcon()}
              </button>
            </div>
          `
              : nothing
          }

          <!-- DRAFTED stamp -->
          ${this.dimmed ? html`<span class="card__stamp">${msg('Deployed')}</span>` : nothing}
        </div>
      </div>
    `;
  }

  private _renderGems(best: { type: OperativeType; level: number } | null) {
    if (this.size === 'xs') return nothing;

    const bestColor = best ? OP_COLORS[best.type] : undefined;

    return html`
      <div class="card__gems">
        <!-- Left gem: primary stat -->
        ${
          this.primaryStat != null
            ? html`
          <div class="gem" style=${bestColor ? `--gem-color: ${bestColor}` : ''}>
            <span class="gem__inner">${this.primaryStat}</span>
          </div>
        `
            : html`<span></span>`
        }

        <!-- Right gem: secondary stat or condition dots -->
        ${
          this.conditionDots != null
            ? this._renderConditionDots()
            : this.secondaryStat != null
              ? html`
              <div class="gem gem--glow" style=${bestColor ? `--gem-color: ${bestColor}` : ''}>
                <span class="gem__inner">${this.secondaryStat}</span>
              </div>
            `
              : html`<span></span>`
        }
      </div>
    `;
  }

  private _renderConditionDots() {
    const dots = this.conditionDots ?? 0;
    const colors = ['#16a34a', '#d97706', '#dc2626']; // good=green, fair=amber, poor=red
    const dotColor = dots >= 3 ? colors[0] : dots >= 2 ? colors[1] : colors[2];

    return html`
      <div class="gem gem--condition">
        <span class="gem__inner">
          ${[0, 1, 2].map(
            (i) => html`
            <span
              class="condition-dot ${i < dots ? 'condition-dot--filled' : ''}"
              style="--dot-color: ${dotColor}"
            ></span>
          `,
          )}
        </span>
      </div>
    `;
  }

  private _renderAgentBody() {
    return html`
      ${this.aptitudes ? this._renderAptitudePips() : nothing}
      ${this.subtitle ? html`<span class="card__subtitle">${this.subtitle}</span>` : nothing}
      ${
        this.editable
          ? html`
          <textarea
            class="card__description-edit"
            .value=${this.description}
            @input=${(e: Event) => {
              this.description = (e.target as HTMLTextAreaElement).value;
              this.dispatchEvent(
                new CustomEvent('description-change', {
                  detail: { value: this.description },
                  bubbles: true,
                  composed: true,
                }),
              );
            }}
            @click=${(e: Event) => e.stopPropagation()}
          ></textarea>
        `
          : nothing
      }
      ${
        this.badges.length > 0
          ? html`
        <div class="card__badges">
          ${this.badges.map((b) => html`<span class="card__badge">${b.label}</span>`)}
        </div>
      `
          : nothing
      }
      ${
        this.connectionCount > 0
          ? html`
        <span class="card__connections">${this.connectionCount} connections</span>
      `
          : nothing
      }
    `;
  }

  private _renderBuildingBody() {
    return html`
      ${
        this.badges.length > 0
          ? html`
        <div class="card__badges">
          ${this.badges.map((b) => html`<span class="card__badge">${b.label}</span>`)}
        </div>
      `
          : nothing
      }
      ${this.subtitle ? html`<span class="card__subtitle">${this.subtitle}</span>` : nothing}
      ${
        this.editable
          ? html`
          <textarea
            class="card__description-edit"
            .value=${this.description}
            @input=${(e: Event) => {
              this.description = (e.target as HTMLTextAreaElement).value;
              this.dispatchEvent(
                new CustomEvent('description-change', {
                  detail: { value: this.description },
                  bubbles: true,
                  composed: true,
                }),
              );
            }}
            @click=${(e: Event) => e.stopPropagation()}
          ></textarea>
        `
          : nothing
      }
      ${
        this.capacityBar
          ? html`
        <div class="card__capacity">
          <div class="capacity__bar">
            <div class="capacity__fill" style="width: ${Math.min(100, (this.capacityBar.current / Math.max(1, this.capacityBar.max)) * 100)}%"></div>
          </div>
          <span class="capacity__text">${this.capacityBar.current}/${this.capacityBar.max}</span>
        </div>
      `
          : nothing
      }
    `;
  }

  private _renderAptitudePips() {
    if (!this.aptitudes) return nothing;
    const apt = this.aptitudes;

    return html`
      <div class="card__pips">
        ${OP_LABELS.map((type) => {
          const level = apt[type];
          const color = OP_COLORS[type];
          const isDim = level <= 5;
          const isBright = level >= 8;

          return html`
            <div class="pip">
              <span
                class="pip__dot ${isDim ? 'pip__dot--dim' : ''} ${isBright ? 'pip__dot--bright' : ''}"
                style="--pip-color: ${color}"
              >${level}</span>
              <span class="pip__label">${OP_SHORT[type]}</span>
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderPlaceholderIcon() {
    if (this.type === 'agent') {
      return svg`<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
      </svg>`;
    }
    return svg`<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M3 21h18"/><path d="M5 21v-14l7-4 7 4v14"/><path d="M9 21v-6h6v6"/>
    </svg>`;
  }
}

// ── Inline icons (avoids circular dependency on icons.ts) ──

function _editIcon() {
  return svg`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1"/>
    <path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z"/>
    <path d="M16 5l3 3"/>
  </svg>`;
}

function _trashIcon() {
  return svg`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 7l16 0"/><path d="M10 11l0 6"/><path d="M14 11l0 6"/>
    <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/>
    <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>
  </svg>`;
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-game-card': VelgGameCard;
  }
}
