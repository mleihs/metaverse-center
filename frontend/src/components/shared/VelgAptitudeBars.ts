import { msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { AptitudeSet, OperativeType } from '../../types/index.js';
import { OPERATIVE_COLORS } from '../../utils/operative-constants.js';

const OPERATIVE_TYPES: OperativeType[] = [
  'spy',
  'guardian',
  'saboteur',
  'propagandist',
  'infiltrator',
  'assassin',
];

function getOperativeLabel(type: OperativeType): string {
  const labels: Record<OperativeType, () => string> = {
    spy: () => msg('Spy'),
    guardian: () => msg('Guardian'),
    saboteur: () => msg('Saboteur'),
    propagandist: () => msg('Propagandist'),
    infiltrator: () => msg('Infiltrator'),
    assassin: () => msg('Assassin'),
  };
  return labels[type]();
}

const APTITUDE_MIN = 3;
const APTITUDE_MAX = 9;
const APTITUDE_BUDGET = 36;

@customElement('velg-aptitude-bars')
export class VelgAptitudeBars extends LitElement {
  @property({ type: Object }) aptitudes: AptitudeSet = {
    spy: 6,
    guardian: 6,
    saboteur: 6,
    propagandist: 6,
    infiltrator: 6,
    assassin: 6,
  };

  @property({ type: Boolean }) editable = false;
  @property({ type: String }) size: 'sm' | 'md' | 'lg' = 'md';
  @property({ type: String }) highlight: OperativeType | null = null;
  @property({ type: Number }) budget = APTITUDE_BUDGET;

  static styles = css`
    :host {
      display: block;
      --apt-bar-height: 14px;
      --apt-label-width: 90px;
      --apt-font-size: var(--text-xs);
      --apt-gap: 6px;
      --apt-value-width: 28px;
      font-family: var(--font-mono, monospace);
    }

    :host([size='sm']) {
      --apt-bar-height: 8px;
      --apt-label-width: 0px;
      --apt-font-size: 9px;
      --apt-gap: 3px;
      --apt-value-width: 18px;
    }

    :host([size='lg']) {
      --apt-bar-height: 20px;
      --apt-label-width: 110px;
      --apt-font-size: var(--text-sm);
      --apt-gap: 8px;
      --apt-value-width: 32px;
    }

    .aptitude-bars {
      display: flex;
      flex-direction: column;
      gap: var(--apt-gap);
    }

    .bar-row {
      display: flex;
      align-items: center;
      gap: 6px;
      transition: opacity var(--duration-fast, 150ms) ease;
    }

    .bar-row.dimmed {
      opacity: 0.3;
    }

    .bar-row.highlighted {
      opacity: 1;
      filter: drop-shadow(0 0 4px var(--bar-color, transparent));
    }

    .label {
      width: var(--apt-label-width);
      font-size: var(--apt-font-size);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex-shrink: 0;
    }

    :host([size='sm']) .label {
      display: none;
    }

    .track {
      flex: 1;
      height: var(--apt-bar-height);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      position: relative;
      overflow: hidden;
    }

    .fill {
      height: 100%;
      transition: width var(--duration-normal, 300ms) var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1));
      animation: bar-fill-in var(--duration-entrance, 350ms) var(--ease-dramatic) both;
      background-image: linear-gradient(
        90deg,
        var(--bar-color) 0%,
        color-mix(in srgb, var(--bar-color) 70%, white) 100%
      );
      box-shadow: inset 0 1px 0 rgba(255 255 255 / 0.15);
    }

    @keyframes bar-fill-in {
      from {
        width: 0 !important;
      }
    }

    .value {
      width: var(--apt-value-width);
      text-align: right;
      font-size: var(--apt-font-size);
      font-weight: 700;
      color: var(--color-text-primary);
      flex-shrink: 0;
    }

    /* Budget display */
    .budget {
      display: flex;
      justify-content: flex-end;
      font-size: var(--apt-font-size);
      color: var(--color-text-muted);
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px solid var(--color-border);
    }

    .budget.over {
      color: var(--color-danger);
    }

    .budget.exact {
      color: var(--color-success);
    }

    /* Slider (editable mode) */
    .slider-container {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    input[type='range'] {
      flex: 1;
      height: var(--apt-bar-height);
      -webkit-appearance: none;
      appearance: none;
      background: transparent;
      cursor: pointer;
    }

    input[type='range']::-webkit-slider-runnable-track {
      height: var(--apt-bar-height);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
    }

    input[type='range']::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 12px;
      height: calc(var(--apt-bar-height) + 4px);
      margin-top: -3px;
      background: var(--slider-color, var(--color-text-muted));
      border: 1px solid var(--slider-color, var(--color-text-muted));
      cursor: grab;
      box-shadow: 0 0 6px color-mix(in srgb, var(--slider-color, transparent) 40%, transparent);
    }

    input[type='range']::-moz-range-track {
      height: var(--apt-bar-height);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
    }

    input[type='range']::-moz-range-thumb {
      width: 10px;
      height: var(--apt-bar-height);
      background: var(--slider-color, var(--color-text-muted));
      border: 1px solid var(--slider-color, var(--color-text-muted));
      border-radius: 0;
      cursor: grab;
    }

    input[type='range']:active::-webkit-slider-thumb {
      cursor: grabbing;
    }

    /* Abbreviated label for sm inside value */
    :host([size='sm']) .value {
      font-size: 8px;
    }

    @media (prefers-reduced-motion: reduce) {
      .fill {
        animation: none;
        transition: none;
      }
    }
  `;

  private _getSpent(): number {
    return Object.values(this.aptitudes).reduce((sum, v) => sum + v, 0);
  }

  private _handleSliderChange(type: OperativeType, e: Event) {
    const target = e.target as HTMLInputElement;
    const newValue = Number.parseInt(target.value, 10);
    const oldValue = this.aptitudes[type];
    const spent = this._getSpent();
    const newSpent = spent - oldValue + newValue;

    // Clamp to budget
    if (newSpent > APTITUDE_BUDGET) {
      const maxAllowed = oldValue + (APTITUDE_BUDGET - spent);
      target.value = String(maxAllowed);
      return;
    }

    this.aptitudes = { ...this.aptitudes, [type]: newValue };
    this.dispatchEvent(
      new CustomEvent('aptitude-change', {
        detail: { type, level: newValue, aptitudes: this.aptitudes },
        bubbles: true,
        composed: true,
      }),
    );
    this.requestUpdate();
  }

  render() {
    const spent = this._getSpent();
    const remaining = APTITUDE_BUDGET - spent;

    return html`
      <div class="aptitude-bars">
        ${OPERATIVE_TYPES.map((type, i) => {
          const level = this.aptitudes[type] ?? 6;
          const pct = ((level - APTITUDE_MIN) / (APTITUDE_MAX - APTITUDE_MIN)) * 100;
          const color = OPERATIVE_COLORS[type];
          const isDimmed = this.highlight && this.highlight !== type;
          const isHighlighted = this.highlight === type;

          return html`
            <div
              class="bar-row ${isDimmed ? 'dimmed' : ''} ${isHighlighted ? 'highlighted' : ''}"
              style="--bar-color: ${color}; animation-delay: ${i * 40}ms"
            >
              <span class="label">${getOperativeLabel(type)}</span>
              ${
                this.editable
                  ? html`
                    <div class="slider-container">
                      <input
                        type="range"
                        min="${APTITUDE_MIN}"
                        max="${APTITUDE_MAX}"
                        .value="${String(level)}"
                        @input="${(e: Event) => this._handleSliderChange(type, e)}"
                        style="--slider-color: ${color}"
                        aria-label="${getOperativeLabel(type)} ${msg('aptitude')}"
                      />
                    </div>
                  `
                  : html`
                    <div class="track">
                      <div
                        class="fill"
                        style="width: ${pct}%; --bar-color: ${color}; animation-delay: ${i * 60}ms"
                      ></div>
                    </div>
                  `
              }
              <span class="value" style="color: ${color}">${level}</span>
            </div>
          `;
        })}
        ${
          this.editable
            ? html`
              <div class="budget ${remaining < 0 ? 'over' : remaining === 0 ? 'exact' : ''}">
                ${msg('Budget')}: ${spent}/${APTITUDE_BUDGET}
                ${remaining > 0 ? html`(${remaining} ${msg('remaining')})` : nothing}
              </div>
            `
            : nothing
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-aptitude-bars': VelgAptitudeBars;
  }
}
