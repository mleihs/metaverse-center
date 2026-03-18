import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

/**
 * Small [UPDATED] badge shown on dossier sections that have been evolved.
 */
@localized()
@customElement('velg-dossier-badge')
export class VelgDossierBadge extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 1px var(--space-1);
      font-family: var(--font-mono, monospace);
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-success);
      border: 1px solid color-mix(in srgb, var(--color-success) 40%, transparent);
      background: color-mix(in srgb, var(--color-success) 8%, transparent);
    }

    .badge__dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--color-success);
    }
  `;

  protected render() {
    return html`
      <span class="badge" aria-label=${msg('Section updated')}>
        <span class="badge__dot" aria-hidden="true"></span>
        ${msg('UPDATED')}
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dossier-badge': VelgDossierBadge;
  }
}
