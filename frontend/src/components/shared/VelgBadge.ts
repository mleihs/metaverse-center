import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export type BadgeVariant = 'default' | 'primary' | 'info' | 'success' | 'warning' | 'danger';

@customElement('velg-badge')
export class VelgBadge extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: var(--border-width-default) solid var(--color-border);
      background: var(--color-surface-header);
      color: var(--color-text-secondary);
      line-height: 1.4;
      animation: badge-pop 200ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) both;
      transition: background var(--duration-fast, 100ms),
        border-color var(--duration-fast, 100ms),
        color var(--duration-fast, 100ms);
    }

    @keyframes badge-pop {
      from {
        opacity: 0;
        transform: scale(0.7);
      }
    }

    :host([variant='primary']) {
      background: var(--color-primary-bg);
      border-color: var(--color-primary);
      color: var(--color-primary);
    }

    :host([variant='info']) {
      background: var(--color-info-bg);
      border-color: var(--color-info);
      color: var(--color-info);
    }

    :host([variant='success']) {
      background: var(--color-success-bg);
      border-color: var(--color-success);
      color: var(--color-success);
    }

    :host([variant='warning']) {
      background: var(--color-warning-bg);
      border-color: var(--color-warning);
      color: var(--color-warning);
    }

    :host([variant='danger']) {
      background: var(--color-danger-bg);
      border-color: var(--color-danger);
      color: var(--color-danger);
    }
  `;

  @property({ type: String, reflect: true }) variant: BadgeVariant = 'default';

  protected render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-badge': VelgBadge;
  }
}
