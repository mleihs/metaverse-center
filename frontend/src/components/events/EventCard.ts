import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import type { Event as SimEvent } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import '../shared/VelgBadge.js';
import '../shared/VelgIconButton.js';

@localized()
@customElement('velg-event-card')
export class VelgEventCard extends LitElement {
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
      transition: transform var(--duration-normal) var(--ease-out),
        box-shadow var(--duration-normal) var(--ease-out),
        border-color var(--duration-normal) var(--ease-out);
      display: flex;
      flex-direction: column;

      opacity: 0;
      animation: card-enter var(--duration-entrance, 350ms) var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
      animation-delay: calc(var(--i, 0) * var(--duration-stagger, 40ms));
    }

    .card:hover {
      transform: var(--hover-transform, translate(-2px, -2px));
      box-shadow: var(--shadow-lg);
    }

    .card:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    @keyframes card-enter {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .card__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      background: var(--color-surface-header);
      border-bottom: var(--border-medium);
    }

    .card__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-md);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      min-width: 0;
    }

    .card__impact {
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
      flex-shrink: 0;
    }

    .card__impact-bar {
      display: flex;
      gap: 2px;
      align-items: flex-end;
      height: 18px;
    }

    .card__impact-segment {
      width: 4px;
      background: var(--color-border-light);
      transition: background var(--transition-fast);
      transform: scaleY(0);
      transform-origin: bottom;
      animation: segment-grow var(--duration-entrance, 350ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) forwards;
      animation-delay: calc(var(--seg-i, 0) * 30ms + 200ms);
    }

    @keyframes segment-grow {
      to { transform: scaleY(1); }
    }

    .card__impact-segment--active {
      background: var(--color-primary);
    }

    .card__impact-segment--high {
      background: var(--color-danger);
    }

    .card__impact-segment--medium {
      background: var(--color-warning);
    }

    .card__impact-label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
    }

    .card__body {
      padding: var(--space-3) var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      flex: 1;
    }

    .card__badges {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1-5);
    }

    .card__meta {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .card__meta-item {
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      line-height: var(--leading-snug);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .card__meta-icon {
      flex-shrink: 0;
      color: var(--color-text-muted);
    }

    .card__tags {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
    }

    .card__tag {
      display: inline-flex;
      align-items: center;
      padding: var(--space-0-5) var(--space-1-5);
      font-family: var(--font-sans);
      font-size: 10px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border-light);
      color: var(--color-text-secondary);
    }

    .card__actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4) var(--space-3);
      margin-top: auto;
    }

  `;

  @property({ type: Object }) event!: SimEvent;

  private _formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  private _getImpactClass(level: number): string {
    if (level >= 8) return 'high';
    if (level >= 5) return 'medium';
    return 'active';
  }

  private _getReactionCount(): number {
    return this.event.reactions?.length ?? 0;
  }

  private _handleClick(): void {
    this.dispatchEvent(
      new CustomEvent('event-click', {
        detail: this.event,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleEdit(e: MouseEvent): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('event-edit', {
        detail: this.event,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleDelete(e: MouseEvent): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('event-delete', {
        detail: this.event,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _renderImpactBar() {
    const level = this.event.impact_level ?? 1;
    const impactClass = this._getImpactClass(level);

    return html`
      <div class="card__impact">
        <div class="card__impact-bar">
          ${Array.from({ length: 10 }, (_, i) => {
            const height = 4 + (i + 1) * 1.4;
            const isActive = i < level;
            const segmentClass = isActive
              ? `card__impact-segment card__impact-segment--${impactClass}`
              : 'card__impact-segment';
            return html`
              <div
                class=${segmentClass}
                style="height: ${height}px; --seg-i: ${i}"
              ></div>
            `;
          })}
        </div>
        <span class="card__impact-label">${level}</span>
      </div>
    `;
  }

  protected render() {
    const evt = this.event;
    if (!evt) return html``;

    const reactionCount = this._getReactionCount();

    return html`
      <div class="card" @click=${this._handleClick}>
        <div class="card__header">
          <h3 class="card__title">${evt.title}</h3>
          ${this._renderImpactBar()}
        </div>

        <div class="card__body">
          <div class="card__badges">
            ${evt.event_type ? html`<velg-badge variant="primary">${evt.event_type}</velg-badge>` : null}
            ${evt.data_source === 'ai' ? html`<velg-badge variant="info">AI</velg-badge>` : null}
            ${evt.data_source === 'bleed' ? html`<velg-badge variant="warning">${msg('Bleed')}</velg-badge>` : null}
            ${evt.data_source === 'propagandist' ? html`<velg-badge variant="warning" title=${msg('This event was caused by foreign propaganda')}>${msg('Propaganda')}</velg-badge>` : null}
            ${reactionCount > 0 ? html`<velg-badge variant="warning">${msg(str`${reactionCount} Reactions`)}</velg-badge>` : null}
          </div>

          <div class="card__meta">
            ${
              evt.occurred_at
                ? html`
                <span class="card__meta-item">
                  <span class="card__meta-icon">${icons.calendar()}</span>
                  ${this._formatDate(evt.occurred_at)}
                </span>
              `
                : null
            }
            ${
              evt.location
                ? html`
                <span class="card__meta-item">
                  <span class="card__meta-icon">${icons.location()}</span>
                  ${evt.location}
                </span>
              `
                : null
            }
            ${
              (evt.external_refs as Record<string, unknown> | undefined)?.echo_vector
                ? html`
                <span class="card__meta-item">
                  <span class="card__meta-icon">${icons.sparkle()}</span>
                  ${msg('Echo')}: ${(evt.external_refs as Record<string, unknown>).echo_vector}
                </span>
              `
                : null
            }
          </div>

          ${
            evt.tags && evt.tags.length > 0
              ? html`
              <div class="card__tags">
                ${evt.tags.slice(0, 5).map((tag) => html`<span class="card__tag">${tag}</span>`)}
                ${evt.tags.length > 5 ? html`<span class="card__tag">+${evt.tags.length - 5}</span>` : null}
              </div>
            `
              : null
          }
        </div>

        ${
          appState.canEdit.value
            ? html`
              <div class="card__actions">
                <velg-icon-button .label=${msg('Edit event')} @icon-click=${this._handleEdit}>
                  ${icons.edit()}
                </velg-icon-button>
                <velg-icon-button variant="danger" .label=${msg('Delete event')} @icon-click=${this._handleDelete}>
                  ${icons.trash()}
                </velg-icon-button>
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
    'velg-event-card': VelgEventCard;
  }
}
