import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ActiveBleed } from '../../types/health.js';

/**
 * Inline marginalia annotation that appears alongside event log entries
 * and zone cards when bleed is active.
 */
@localized()
@customElement('velg-bleed-marginalia')
export class BleedMarginalia extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: relative;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    .marginalia {
      position: absolute;
      top: 0;
      font-family: var(--font-prose, 'Spectral', serif);
      font-style: italic;
      font-size: 11px;
      line-height: 1.4;
      color: var(--color-bleed-marginalia, var(--color-text-muted));
      opacity: 0.5;
      max-width: 180px;
      transition: opacity 0.3s ease, transform 0.3s ease;
      cursor: default;
    }

    .marginalia--left {
      right: calc(100% + var(--space-3, 12px));
      text-align: right;
    }

    .marginalia--right {
      left: calc(100% + var(--space-3, 12px));
      text-align: left;
    }

    .marginalia:hover {
      opacity: 0.85;
      transform: scale(1.02);
    }

    @media (max-width: 1200px) {
      /* Hide marginalia on smaller screens — not enough margin space */
      .marginalia {
        display: none;
      }
    }
  `;

  @property({ type: Object }) bleed!: ActiveBleed;
  @property({ type: String }) position: 'left' | 'right' = 'right';

  private _rotation = 0;

  connectedCallback(): void {
    super.connectedCallback();
    // Deterministic-seeming random rotation from bleed source ID
    const hash = this.bleed?.source_simulation_id
      ? (this.bleed.source_simulation_id.charCodeAt(0) % 7) - 3
      : 0;
    this._rotation = hash;
  }

  protected render() {
    if (!this.bleed?.lore_fragment) return html``;

    const folio = this.bleed.source_simulation_id
      ? (this.bleed.source_simulation_id.charCodeAt(4) % 99) + 1
      : 42;

    return html`
      <aside
        class="marginalia marginalia--${this.position}"
        role="note"
        aria-label=${msg('Cross-dimensional reference from ') + this.bleed.source_simulation_name}
        style="transform: rotate(${this._rotation}deg)"
      >[cf. ${this.bleed.source_simulation_name} Archive, Folio ${folio}: &lsquo;${this.bleed.lore_fragment}&rsquo;]</aside>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-bleed-marginalia': BleedMarginalia;
  }
}
