import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('velg-section-header')
export class VelgSectionHeader extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    h3,
    h2 {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
    }

    h3 {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      padding-bottom: var(--space-1);
      border-bottom: var(--border-light);
    }

    :host([variant='large']) h2 {
      font-size: var(--text-lg);
      color: var(--color-text-primary);
      padding-bottom: var(--space-2);
      border-bottom: var(--border-default);
    }
  `;

  @property({ type: String, reflect: true }) variant: 'default' | 'large' = 'default';

  protected render() {
    if (this.variant === 'large') {
      return html`<h2><slot></slot></h2>`;
    }
    return html`<h3><slot></slot></h3>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-section-header': VelgSectionHeader;
  }
}
