/**
 * MissionCard — TCG-style operative mission card.
 *
 * Portrait 120×192px (5:8 ratio). Displays operative type with cost gem,
 * icon, name plate, effect text, duration. Themed by operative type color.
 * Used in the DeployOperativeModal "War Table" layout.
 */

import { msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { OperativeType } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import { OPERATIVE_COLORS as OP_COLORS } from '../../utils/operative-constants.js';
import { getOperativeIcon } from '../../utils/operative-icons.js';

@customElement('velg-mission-card')
export class VelgMissionCard extends LitElement {
  static styles = css`
		:host {
			display: block;
			--mc-color: var(--mission-card-color, #64748b);
		}

		.card {
			position: relative;
			width: 120px;
			height: 192px;
			border: 2px solid var(--mc-color);
			border-radius: 6px;
			background: var(--color-gray-950, #0a0a0f);
			overflow: hidden;
			cursor: pointer;
			transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
			backface-visibility: hidden;
			user-select: none;
		}

		.card:hover:not(.card--disabled) {
			transform: translateY(-4px);
			box-shadow: 0 8px 24px rgba(0 0 0 / 0.5),
				0 0 16px color-mix(in srgb, var(--mc-color) 25%, transparent);
		}

		.card--selected {
			border-color: var(--color-epoch-accent, #f59e0b);
			box-shadow: 0 0 20px rgba(245 158 11 / 0.3),
				inset 0 0 20px rgba(245 158 11 / 0.06);
		}

		.card--disabled {
			opacity: 0.35;
			cursor: not-allowed;
			filter: grayscale(0.7);
		}

		/* ── Cost gem (top-left diamond) ── */
		.gem {
			position: absolute;
			top: 8px;
			width: 26px;
			height: 26px;
			display: flex;
			align-items: center;
			justify-content: center;
			font-family: var(--font-brutalist, 'Oswald', sans-serif);
			font-weight: 900;
			font-size: 11px;
			color: var(--color-gray-950, #0a0a0f);
			z-index: 2;
			transform: rotate(45deg);
		}

		.gem__inner {
			transform: rotate(-45deg);
			line-height: 1;
		}

		.gem--cost {
			left: 8px;
			background: var(--color-epoch-accent, #f59e0b);
		}

		.gem--icon {
			right: 8px;
			background: var(--mc-color);
			color: var(--color-gray-950, #0a0a0f);
		}

		/* ── Gradient fill (type color) ── */
		.card__gradient {
			position: absolute;
			inset: 0;
			background: linear-gradient(
				180deg,
				transparent 10%,
				color-mix(in srgb, var(--mc-color) 10%, transparent) 50%,
				color-mix(in srgb, var(--mc-color) 5%, transparent) 100%
			);
			pointer-events: none;
		}

		/* ── Large icon center ── */
		.card__icon {
			position: absolute;
			top: 40px;
			left: 0;
			right: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			color: var(--mc-color);
			opacity: 0.25;
			filter: grayscale(0.3);
			pointer-events: none;
			transition: opacity 200ms;
		}

		.card:hover:not(.card--disabled) .card__icon {
			opacity: 0.4;
		}

		.card--selected .card__icon {
			opacity: 0.45;
			filter: grayscale(0);
		}

		/* ── Name plate ── */
		.card__plate {
			position: absolute;
			bottom: 50px;
			left: 0;
			right: 0;
			padding: 4px 8px;
			background: color-mix(in srgb, var(--mc-color) 85%, black);
			border-top: 1px solid color-mix(in srgb, var(--mc-color) 60%, black);
		}

		.card__name {
			font-family: var(--font-brutalist, 'Oswald', sans-serif);
			font-weight: 900;
			font-size: 11px;
			text-transform: uppercase;
			letter-spacing: 0.1em;
			color: var(--color-gray-100, #f5f5f5);
			line-height: 1;
		}

		/* ── Effect text ── */
		.card__effect {
			position: absolute;
			bottom: 6px;
			left: 0;
			right: 0;
			padding: 0 6px;
			font-family: var(--font-mono, monospace);
			font-size: 8px;
			line-height: 1.3;
			color: var(--color-gray-400, #999);
			max-height: 44px;
			overflow: hidden;
			display: -webkit-box;
			-webkit-line-clamp: 4;
			-webkit-box-orient: vertical;
		}

		.card__duration {
			display: flex;
			align-items: center;
			gap: 2px;
			margin-top: 2px;
			font-size: 7px;
			color: var(--color-gray-500, #777);
			text-transform: uppercase;
			letter-spacing: 0.05em;
		}

		/* ── Disabled stamp ── */
		.card__stamp {
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%) rotate(-15deg);
			font-family: var(--font-brutalist, 'Oswald', sans-serif);
			font-weight: 900;
			font-size: 10px;
			text-transform: uppercase;
			letter-spacing: 0.12em;
			color: var(--color-danger, #ef4444);
			border: 2px solid var(--color-danger, #ef4444);
			padding: 2px 8px;
			opacity: 0.8;
			white-space: nowrap;
			z-index: 3;
		}

		/* ── Idle glow breathing ── */
		.card:not(.card--disabled):not(.card--selected) {
			animation: card-glow 3s ease-in-out infinite alternate;
		}

		@keyframes card-glow {
			from {
				box-shadow: 0 0 4px color-mix(in srgb, var(--mc-color) 15%, transparent);
			}
			to {
				box-shadow: 0 0 12px color-mix(in srgb, var(--mc-color) 30%, transparent);
			}
		}

		/* ── Deal entrance ── */
		:host([dealing]) .card {
			opacity: 0;
			animation: mission-deal 350ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
			animation-delay: var(--deal-delay, 0ms);
		}

		@keyframes mission-deal {
			from {
				opacity: 0;
				transform: translateY(-200px) scale(0.5);
			}
			to {
				opacity: 1;
				transform: translateY(0) scale(1);
			}
		}

		/* ── Reduced motion ── */
		@media (prefers-reduced-motion: reduce) {
			.card,
			:host([dealing]) .card {
				animation: none !important;
				opacity: 1;
				transition: none;
			}
		}
	`;

  @property({ attribute: 'operative-type' }) operativeType: OperativeType = 'spy';
  @property({ type: Number }) cost = 0;
  @property({ attribute: false }) effectText = '';
  @property({ attribute: false }) duration = '';
  @property({ type: Boolean }) selected = false;
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) interactive = true;

  protected render() {
    const color = OP_COLORS[this.operativeType] ?? '#64748b';

    const classes = classMap({
      card: true,
      'card--selected': this.selected,
      'card--disabled': this.disabled,
    });

    return html`
			<div
				class=${classes}
				style=${styleMap({ '--mc-color': color })}
				role="button"
				tabindex=${this.disabled ? -1 : 0}
				aria-pressed=${this.selected}
				aria-label=${`${this.operativeType} - ${this.cost} RP`}
				@click=${this._handleClick}
				@keydown=${this._handleKey}
			>
				<div class="gem gem--cost"><span class="gem__inner">${this.cost}</span></div>
				<div class="gem gem--icon"><span class="gem__inner">${getOperativeIcon(this.operativeType, 13)}</span></div>
				<div class="card__gradient"></div>
				<div class="card__icon">${getOperativeIcon(this.operativeType, 48)}</div>
				<div class="card__plate">
					<div class="card__name">${this.operativeType}</div>
				</div>
				<div class="card__effect">
					${this.effectText}
					${this.duration ? html`<div class="card__duration">${icons.timer(8)} ${this.duration}</div>` : nothing}
				</div>
				${this.disabled ? html`<div class="card__stamp">${msg('INSUFFICIENT RP')}</div>` : nothing}
			</div>
		`;
  }

  private _handleClick(): void {
    if (this.disabled || !this.interactive) return;
    this.dispatchEvent(
      new CustomEvent('card-click', {
        detail: { operativeType: this.operativeType },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._handleClick();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-mission-card': VelgMissionCard;
  }
}
