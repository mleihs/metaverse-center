/**
 * VelgAlphaSuite -- Single mount point for the Velgarien alpha indicators.
 *
 * Assembles the Bureau-Dispatch stamp, the terminal build-strip and the
 * first-contact modal. On release, the whole suite is deleted by removing
 * the <velg-alpha-suite> tag from AppShell; no other code path references
 * alpha components directly.
 *
 * Hydrates AlphaStatusService on mount so the first-contact modal can
 * evaluate shouldShowFirstContact as soon as auth state resolves.
 *
 * @element velg-alpha-suite
 */

import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { alphaStatus } from '../../services/AlphaStatusService.js';
import { captureError } from '../../services/SentryService.js';
import './VelgAlphaStamp.js';
import './VelgBuildStrip.js';
import './VelgFirstContactModal.js';

@customElement('velg-alpha-suite')
export class VelgAlphaSuite extends LitElement {
  static styles = css`
    :host {
      display: contents;
    }

    .footer-mount {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: var(--z-sticky, 100);
      pointer-events: auto;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    alphaStatus
      .refresh()
      .catch((err: unknown) => captureError(err, { source: 'VelgAlphaSuite.refresh' }));
  }

  protected render() {
    return html`
      <velg-alpha-stamp></velg-alpha-stamp>
      <div class="footer-mount"><velg-build-strip></velg-build-strip></div>
      <velg-first-contact-modal></velg-first-contact-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-alpha-suite': VelgAlphaSuite;
  }
}
