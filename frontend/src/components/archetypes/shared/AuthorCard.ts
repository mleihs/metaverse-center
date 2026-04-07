/**
 * Literary influence card — for the "Literary Wall" room.
 *
 * Primary authors get larger cards with quotes; secondary are compact.
 */

import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { detailCardStyles, detailTokenStyles } from './archetype-detail-styles.js';

@customElement('velg-author-card')
export class VelgAuthorCard extends LitElement {
  static styles = [
    detailTokenStyles,
    detailCardStyles,
    css`
      :host {
        display: block;
      }

      .card {
        padding: var(--space-4, 16px) var(--space-5, 20px);
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 6px;
        transition: transform 0.3s var(--_ease-dramatic),
          border-color 0.3s var(--_ease-dramatic);
      }

      .card:hover {
        transform: translateY(-2px);
        border-color: var(--_accent-border);
      }

      :host([primary]) .card {
        border-left: 2px solid var(--_accent);
        padding-left: calc(var(--space-5, 20px) - 1px);
      }

      .name {
        font-family: var(--_font-prose);
        font-size: 0.85rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: var(--color-text-primary, #e5e5e5);
        margin-bottom: 2px;
      }

      .works {
        font-family: var(--_font-prose);
        font-size: 0.8rem;
        font-style: italic;
        color: var(--_accent);
        opacity: 0.8;
        margin-bottom: 8px;
      }

      .divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.06);
        margin-bottom: 8px;
      }

      .concept {
        font-family: var(--_font-prose);
        font-size: 0.88rem;
        line-height: 1.55;
        color: var(--color-text-secondary, #a0a0a0);
      }

      .quote {
        margin-top: 10px;
        font-family: var(--_font-prose);
        font-size: 0.82rem;
        font-style: italic;
        line-height: 1.5;
        color: var(--color-text-primary, #e5e5e5);
        opacity: 0.8;
        padding-left: 12px;
        border-left: 1px solid var(--_accent-border);
      }

      .language {
        margin-top: 8px;
        font-family: var(--_font-prose);
        font-size: 0.65rem;
        font-style: italic;
        color: var(--color-text-muted, #888);
      }
    `,
  ];

  @property() name = '';
  @property() works = '';
  @property() concept = '';
  @property() language = '';
  @property() quote = '';
  @property({ type: Boolean, reflect: true }) primary = false;

  protected render() {
    return html`
      <div class="card">
        <div class="name">${this.name}</div>
        <div class="works">${this.works}</div>
        <div class="divider"></div>
        <div class="concept">${this.concept}</div>
        ${this.quote ? html`<p class="quote">${this.quote}</p>` : nothing}
        <div class="language">${this.language}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-author-card': VelgAuthorCard;
  }
}
