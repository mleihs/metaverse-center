/**
 * Objektanker 4-phase card — "vitrine" display for the Vault room.
 *
 * Shows Discovery by default. Click expands to all 4 phases
 * with connecting vertical line between them.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { detailCardStyles, detailTokenStyles } from './archetype-detail-styles.js';
import type { LocalizedObjektankerPhase as ObjektankerPhase } from '../dungeon-detail-localized.js';

@localized()
@customElement('velg-objektanker-card')
export class VelgObjektankerCard extends LitElement {
  static styles = [
    detailTokenStyles,
    detailCardStyles,
    css`
      :host { display: block; }

      .vitrine {
        padding: var(--space-5, 20px);
        background: rgba(255, 255, 255, 0.03);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        cursor: pointer;
        transition: border-color 0.3s var(--_ease-dramatic);
      }

      @supports not (backdrop-filter: blur(12px)) {
        .vitrine { background: rgba(18, 18, 22, 0.95); }
      }

      @media (prefers-reduced-motion: no-preference) {
        .vitrine:hover {
          border-color: var(--_accent-border);
        }
      }

      .header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
      }

      .diamond {
        width: 8px;
        height: 8px;
        background: var(--_accent);
        transform: rotate(45deg);
        flex-shrink: 0;
      }

      .name {
        font-family: var(--_font-prose);
        font-size: 0.85rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: var(--color-text-primary, #e5e5e5);
      }

      /* ── Phase list ── */
      .phases {
        display: flex;
        flex-direction: column;
        gap: 0;
        padding-left: 12px;
        border-left: 1px solid var(--_accent-border);
      }

      .phase {
        padding: 8px 0 8px 16px;
        position: relative;
      }

      .phase::before {
        content: '';
        position: absolute;
        left: -5px;
        top: 14px;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: var(--_surface-mid);
        border: 1px solid var(--_accent-border);
      }

      .phase--active::before {
        background: var(--_accent);
        border-color: var(--_accent);
        box-shadow: 0 0 8px var(--_accent-glow);
      }

      .phase__label {
        font-family: var(--_font-prose);
        font-size: 0.78rem;
        font-weight: 600;
        font-style: italic;
        letter-spacing: 0.02em;
        color: var(--_accent);
        margin-bottom: 4px;
      }

      .phase__text {
        font-family: var(--_font-prose);
        font-size: 0.9rem;
        font-style: italic;
        line-height: 1.55;
        color: var(--color-text-secondary, #a0a0a0);
      }

      .collapsed-phases {
        overflow: hidden;
        max-height: 0;
        opacity: 0;
        transition: max-height 0.5s var(--_ease-dramatic), opacity 0.4s var(--_ease-dramatic);
      }

      :host([expanded]) .collapsed-phases {
        max-height: 600px;
        opacity: 1;
      }

      .expand-hint {
        margin-top: 8px;
        font-family: var(--_font-prose);
        font-size: 0.65rem;
        font-style: italic;
        color: var(--color-text-muted, #888);
        transition: opacity 0.3s;
      }

      :host([expanded]) .expand-hint { opacity: 0; }
    `,
  ];

  @property({ type: Array }) phases: ObjektankerPhase[] = [];
  @property() name = '';
  @state() private _expanded = false;

  private _toggle() {
    this._expanded = !this._expanded;
    this.toggleAttribute('expanded', this._expanded);
  }

  protected render() {
    const [discovery, ...rest] = this.phases;
    if (!discovery) return html``;

    return html`
      <div class="vitrine" @click=${this._toggle} role="button" tabindex="0"
           aria-expanded=${this._expanded} @keydown=${this._onKeydown}>
        <div class="header">
          <div class="diamond" aria-hidden="true"></div>
          <span class="name">${this.name}</span>
        </div>
        <div class="phases">
          <div class="phase phase--active">
            <div class="phase__label">${discovery.label}</div>
            <div class="phase__text">${discovery.text}</div>
          </div>
          <div class="collapsed-phases">
            ${rest.map(
              (p, i) => html`
                <div class="phase ${i === rest.length - 1 ? 'phase--active' : ''}">
                  <div class="phase__label">${p.label}</div>
                  <div class="phase__text">${p.text}</div>
                </div>
              `,
            )}
          </div>
        </div>
        <div class="expand-hint">\u25b8 ${rest.length} ${msg('more phases')}</div>
      </div>
    `;
  }

  private _onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._toggle();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-objektanker-card': VelgObjektankerCard;
  }
}
