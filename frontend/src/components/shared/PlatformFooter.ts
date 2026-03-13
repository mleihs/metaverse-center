import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

@localized()
@customElement('velg-platform-footer')
export class VelgPlatformFooter extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    footer {
      border-top: 1px solid var(--color-gray-800);
      padding: var(--space-6) var(--space-4);
      text-align: center;
    }

    .footer__rule {
      width: 40px;
      height: 1px;
      background: var(--color-accent-amber);
      margin: 0 auto var(--space-4);
      border: none;
    }

    .footer__row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-4);
      font-family: var(--font-mono);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-gray-500);
      flex-wrap: wrap;
    }

    nav {
      display: flex;
      gap: var(--space-3);
    }

    a {
      color: var(--color-gray-500);
      text-decoration: none;
      transition: color var(--transition-fast);
    }

    a:hover {
      color: var(--color-gray-300);
    }

    a:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 2px;
    }

    .footer__bureau {
      font-family: var(--font-mono);
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.4em;
      color: var(--color-gray-600);
      margin-top: var(--space-3);
    }
  `;

  protected render() {
    return html`
      <footer role="contentinfo">
        <hr class="footer__rule" />
        <div class="footer__row">
          <span>\u00A9 ${new Date().getFullYear()} metaverse.center</span>
          <nav aria-label=${msg('Legal')}>
            <a href="/impressum">${msg('Impressum')}</a>
            <span aria-hidden="true">\u00B7</span>
            <a href="https://metaverse.center/privacy">${msg('Privacy')}</a>
          </nav>
        </div>
        <div class="footer__bureau">${msg('Bureau of Multiverse Observation')}</div>
      </footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-platform-footer': VelgPlatformFooter;
  }
}
