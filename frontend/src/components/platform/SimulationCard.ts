import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Simulation } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';
import { getThemeColor, getThemeVariant } from '../../utils/theme-colors.js';
import '../shared/VelgBadge.js';

@localized()
@customElement('velg-simulation-card')
export class VelgSimulationCard extends LitElement {
  static styles = css`
    *, *::before, *::after {
      box-sizing: border-box;
    }

    :host {
      display: block;
      max-width: 100%;
      overflow: hidden;
      opacity: 0;
      animation: shard-enter 500ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
      animation-delay: calc(var(--i, 0) * 80ms);
    }

    @keyframes shard-enter {
      from {
        opacity: 0;
        transform: translateY(16px) scale(0.97);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .shard {
      position: relative;
      min-height: 280px;
      border: 2px solid var(--color-surface-raised);
      box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.4);
      border-radius: var(--border-radius);
      overflow: hidden;
      cursor: pointer;
      transition: all var(--transition-normal);
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      text-decoration: none;
      color: inherit;
    }

    .shard:hover {
      transform: translate(-2px, -2px);
      box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.5);
      border-color: var(--color-text-muted);
    }

    .shard:hover .shard__bleed {
      opacity: 1;
    }

    .shard:hover .shard__image {
      filter: brightness(0.5);
      transform: scale(1.03);
    }

    .shard:active {
      transform: translate(0);
      box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.3);
    }

    .shard__image {
      position: absolute;
      inset: 0;
      background-size: cover;
      background-position: center;
      filter: brightness(0.4);
      transition: all var(--transition-slow);
    }

    .shard__placeholder {
      position: absolute;
      inset: 0;
      background: var(--color-surface);
    }

    .shard__placeholder::after {
      content: '';
      position: absolute;
      inset: 0;
      opacity: 0.15;
      background: repeating-linear-gradient(
        45deg,
        transparent,
        transparent 20px,
        var(--shard-color, var(--color-text-muted)) 20px,
        var(--shard-color, var(--color-text-muted)) 21px
      );
    }

    .shard__overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to top,
        rgba(0, 0, 0, 0.92) 0%,
        rgba(0, 0, 0, 0.5) 50%,
        transparent 100%
      );
    }

    .shard__content {
      position: relative;
      z-index: 1;
      padding: var(--space-4) var(--space-5);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      overflow: hidden;
      min-width: 0;
    }

    .shard__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      min-width: 0;
    }

    .shard__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }

    velg-badge {
      flex-shrink: 0;
    }

    .shard__description {
      font-size: var(--text-sm);
      color: color-mix(in srgb, var(--color-text-primary) 70%, transparent);
      line-height: var(--leading-relaxed);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin: 0;
    }

    .shard__stats {
      display: flex;
      gap: var(--space-4);
      padding-top: var(--space-2);
      border-top: 1px solid color-mix(in srgb, var(--color-text-primary) 15%, transparent);
    }

    .shard__stat {
      display: flex;
      align-items: baseline;
      gap: var(--space-1);
    }

    .shard__stat-value {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-md);
      color: var(--color-text-primary);
    }

    .shard__stat-label {
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: color-mix(in srgb, var(--color-text-primary) 50%, transparent);
    }

    .shard__enter {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      color: var(--shard-color, color-mix(in srgb, var(--color-text-primary) 60%, transparent));
      align-self: flex-end;
      opacity: 0;
      transform: translateY(4px);
      transition: all var(--transition-normal);
    }

    .shard:hover .shard__enter {
      opacity: 1;
      transform: translateY(0);
    }

    .shard__bleed {
      position: absolute;
      inset: 0;
      border: 2px solid var(--shard-color, var(--color-text-muted));
      border-radius: var(--border-radius);
      box-shadow:
        inset 0 0 20px var(--shard-color-alpha, color-mix(in srgb, var(--color-text-muted) 20%, transparent)),
        0 0 15px var(--shard-color-alpha, color-mix(in srgb, var(--color-text-muted) 15%, transparent));
      opacity: 0;
      transition: opacity var(--transition-normal);
      pointer-events: none;
      z-index: 2;
    }

    /* ── Mobile ── */
    @media (max-width: 480px) {
      .shard {
        min-height: 200px;
      }

      .shard__content {
        padding: var(--space-3) var(--space-4);
        gap: var(--space-2);
      }

      .shard__name {
        font-size: var(--text-md);
      }

      .shard__enter {
        display: none;
      }
    }
  `;

  @property({ type: Object }) simulation!: Simulation;

  private _handleClick(e: Event): void {
    e.preventDefault();
    this.dispatchEvent(
      new CustomEvent('simulation-click', {
        detail: this.simulation,
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected render() {
    const sim = this.simulation;
    if (!sim) return html``;

    const color = getThemeColor(sim.theme);
    const colorAlpha = `${color}33`;

    return html`
      <a
        href="/simulations/${sim.slug}/lore"
        class="shard"
        style="--shard-color: ${color}; --shard-color-alpha: ${colorAlpha}"
        @click=${this._handleClick}
      >
        ${
          sim.banner_url
            ? html`<div class="shard__image" style="background-image: url(${sim.banner_url})" role="img" aria-label="${sim.name} – ${sim.description ?? sim.theme}"></div>`
            : html`<div class="shard__placeholder"></div>`
        }
        <div class="shard__overlay"></div>

        <div class="shard__content">
          <div class="shard__header">
            <h3 class="shard__name">${sim.name}</h3>
            <velg-badge variant=${getThemeVariant(sim.theme)}>
              ${sim.theme}
            </velg-badge>
          </div>

          ${sim.description ? html`<p class="shard__description">${t(sim, 'description')}</p>` : null}

          <div class="shard__stats">
            <div class="shard__stat">
              <span class="shard__stat-value">${sim.agent_count ?? 0}</span>
              <span class="shard__stat-label">${msg('Agents')}</span>
            </div>
            <div class="shard__stat">
              <span class="shard__stat-value">${sim.building_count ?? 0}</span>
              <span class="shard__stat-label">${msg('Buildings')}</span>
            </div>
            <div class="shard__stat">
              <span class="shard__stat-value">${sim.event_count ?? 0}</span>
              <span class="shard__stat-label">${msg('Events')}</span>
            </div>
          </div>

          <span class="shard__enter">${msg('Enter Shard')}&ensp;&rarr;</span>
        </div>

        <div class="shard__bleed"></div>
      </a>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-simulation-card': VelgSimulationCard;
  }
}
