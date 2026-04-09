/**
 * VelgHelpTip — Contextual help link to How-to-Play guide topics.
 *
 * Renders a small question-mark icon that links to the relevant
 * guide topic page. Shows a tooltip with the label on hover/focus.
 *
 * Usage:
 *   <velg-help-tip topic="operatives" label="What are operatives?"></velg-help-tip>
 *   <velg-help-tip topic="epochs" label="How do epochs work?"></velg-help-tip>
 *
 * Design: Brutalist minimal. Amber accent on hover. WCAG AA focus ring.
 * 20x20 touch target on mobile (nested in parent's 44px zone).
 */

import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { icons } from '../../utils/icons.js';

@localized()
@customElement('velg-help-tip')
export class VelgHelpTip extends LitElement {
  static styles = css`
    :host {
      --_icon-color: var(--color-text-muted);
      --_icon-hover: var(--color-primary);
      display: inline-flex;
      align-items: center;
      vertical-align: middle;
    }

    a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--_icon-color);
      text-decoration: none;
      padding: var(--space-0-5);
      border: 1px solid transparent;
      transition: color var(--transition-fast), border-color var(--transition-fast);
    }

    a:hover,
    a:focus-visible {
      color: var(--_icon-hover);
      border-color: var(--color-border);
    }

    a:focus-visible {
      outline: var(--ring-focus);
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      a { transition-duration: 0.01ms; }
    }
  `;

  /** Topic slug matching htp-topic-data.ts (e.g. "operatives", "epochs", "terminal"). */
  @property() topic = '';

  /** Accessible label shown as tooltip and aria-label (e.g. "What are operatives?"). */
  @property() label = '';

  protected render() {
    const href = `/how-to-play/guide/${this.topic}`;
    const ariaLabel = this.label || msg('Learn more');

    return html`
      <velg-tooltip content=${ariaLabel} position="above">
        <a
          href=${href}
          aria-label=${ariaLabel}
          title=${ariaLabel}
          @click=${this._navigate}
        >${icons.questionCircle(14)}</a>
      </velg-tooltip>
    `;
  }

  private _navigate(e: Event) {
    e.preventDefault();
    const href = `/how-to-play/guide/${this.topic}`;
    this.dispatchEvent(
      new CustomEvent('navigate', {
        bubbles: true,
        composed: true,
        detail: { path: href },
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-help-tip': VelgHelpTip;
  }
}
