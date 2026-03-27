/**
 * 404 — Signal Lost.
 *
 * Minimal military-console 404 page. CRT scan-line flicker on the heading,
 * monospace coordinates readout, and a single amber CTA to return to base.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

@localized()
@customElement('velg-not-found')
export class VelgNotFound extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: calc(100vh - var(--header-height, 64px) - 120px);
      padding: var(--space-8) var(--space-4);
      text-align: center;
      gap: var(--space-6);
    }

    .code {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      letter-spacing: 0.3em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    h1 {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: clamp(2.5rem, 8vw, 5rem);
      font-weight: 900;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--color-text-primary);
      margin: 0;
      line-height: 1;
    }

    p {
      font-family: var(--font-mono, monospace);
      font-size: 13px;
      color: var(--color-text-secondary);
      max-width: 480px;
      line-height: 1.7;
      margin: 0;
    }

    a {
      display: inline-block;
      margin-top: var(--space-4);
      padding: var(--space-3) var(--space-6);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      text-decoration: none;
      color: var(--color-surface);
      background: var(--color-primary);
      border: none;
      transition: opacity 0.15s ease;
    }

    a:hover { opacity: 0.85; }
    a:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 3px;
    }
  `;

  protected render() {
    return html`
      <span class="code">// ERR_404 // ${msg('COORDINATES UNRESOLVED')}</span>
      <h1>${msg('Signal Lost')}</h1>
      <p>${msg('The coordinates you provided do not match any known location in the multiverse.')}</p>
      <a href="/dashboard">${msg('Return to Base')}</a>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-not-found': VelgNotFound;
  }
}
