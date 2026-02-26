import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { EchoStatus, EventEcho, Simulation } from '../../types/index.js';
import '../shared/VelgBadge.js';

@localized()
@customElement('velg-echo-card')
export class VelgEchoCard extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .card {
      background: var(--color-surface-raised);
      border: var(--border-default);
      box-shadow: var(--shadow-md);
      overflow: hidden;
      cursor: pointer;
      transition: all var(--transition-fast);
      display: flex;
      flex-direction: column;
      padding: var(--space-3) var(--space-4);
      gap: var(--space-3);
    }

    .card:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .card:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .card__route {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      line-height: var(--leading-snug);
    }

    .card__sim-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }

    .card__arrow {
      flex-shrink: 0;
      color: var(--color-text-muted);
      font-size: var(--text-lg);
      line-height: 1;
    }

    .card__badges {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1-5);
      align-items: center;
    }

    .card__strength {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .card__strength-label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-secondary);
    }

    .card__strength-track {
      width: 100%;
      height: 6px;
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border-light);
      overflow: hidden;
    }

    .card__strength-fill {
      height: 100%;
      background: var(--color-primary);
      transition: width var(--transition-normal);
    }

    .card__meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }

    .card__depth {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
    }
  `;

  @property({ type: Object }) echo!: EventEcho;
  @property({ type: Array }) simulations: Simulation[] = [];

  private _getSimulationName(id: string): string {
    const sim = this.simulations.find((s) => s.id === id);
    return sim?.name ?? msg('Unknown');
  }

  private _getVectorDisplayName(vector: string): string {
    if (!vector) return '';
    return vector.charAt(0).toUpperCase() + vector.slice(1);
  }

  private _getStatusVariant(status: EchoStatus): string {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'generating':
        return 'info';
      case 'completed':
        return 'success';
      case 'failed':
        return 'danger';
      case 'rejected':
        return 'default';
      default:
        return 'default';
    }
  }

  private _handleClick(): void {
    this.dispatchEvent(
      new CustomEvent('echo-click', {
        detail: this.echo,
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected render() {
    const echo = this.echo;
    if (!echo) return html``;

    const sourceName = this._getSimulationName(echo.source_simulation_id);
    const targetName = this._getSimulationName(echo.target_simulation_id);
    const strengthPercent = Math.round(echo.echo_strength * 100);
    const statusVariant = this._getStatusVariant(echo.status);
    const vectorDisplay = this._getVectorDisplayName(echo.echo_vector);

    return html`
      <div class="card" @click=${this._handleClick}>
        <div class="card__route">
          <span class="card__sim-name">${sourceName}</span>
          <span class="card__arrow">&rarr;</span>
          <span class="card__sim-name">${targetName}</span>
        </div>

        <div class="card__badges">
          <velg-badge variant="primary">${vectorDisplay}</velg-badge>
          <velg-badge variant=${statusVariant}>${echo.status}</velg-badge>
        </div>

        <div class="card__strength">
          <span class="card__strength-label">${msg(str`Strength: ${strengthPercent}%`)}</span>
          <div class="card__strength-track">
            <div
              class="card__strength-fill"
              style="width: ${strengthPercent}%"
            ></div>
          </div>
        </div>

        <div class="card__meta">
          <span class="card__depth">${msg(str`Depth ${echo.echo_depth}/3`)}</span>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-echo-card': VelgEchoCard;
  }
}
