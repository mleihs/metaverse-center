import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * Standalone live preview for simulation design themes.
 *
 * Renders heading typography, body text hierarchy, color swatches,
 * buttons, a card, and an input — all styled dynamically from the
 * `values` record. Pure read-only, no state mutations.
 *
 * @fires (none) — strictly presentational
 */
@localized()
@customElement('velg-design-preview')
export class VelgDesignPreview extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .preview__content {
      padding: var(--space-5);
      border: 2px solid;
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      transition: all 0.3s ease;
    }

    .preview__heading {
      font-size: 1.25em;
      margin: 0;
    }

    .preview__text {
      font-size: 0.9em;
      line-height: 1.6;
      margin: 0;
    }

    .preview__swatch-row {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .preview__swatch {
      width: 32px;
      height: 32px;
      border: 1px solid color-mix(in srgb, var(--color-text-muted) 30%, transparent);
      transition: border-radius 0.3s ease;
    }

    .preview__btn-row {
      display: flex;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    .preview__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 14px;
      font-weight: 700;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      cursor: default;
      width: fit-content;
      transition: all 0.3s ease;
    }

    .preview__card {
      padding: var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      transition: all 0.3s ease;
    }

    .preview__card-title {
      font-size: 0.85em;
      margin: 0;
    }

    .preview__card-text {
      font-size: 0.8em;
      margin: 0;
      line-height: 1.5;
    }

    .preview__input {
      padding: 6px 10px;
      font-size: 0.85em;
      width: 200px;
      max-width: 100%;
      box-sizing: border-box;
    }

    @media (max-width: 640px) {
      .preview__input {
        width: 100%;
      }

      .preview__btn-row {
        flex-direction: column;
      }
    }
  `;

  @property({ type: Object }) values: Record<string, string> = {};

  private _v(key: string, fallback: string): string {
    return this.values[key] || fallback;
  }

  private _computeShadow(style: string, color: string, size: 'sm' | 'md' | 'lg'): string {
    const scales = {
      sm: { offset: 3, blur: 8, glow: 6 },
      md: { offset: 4, blur: 12, glow: 12 },
      lg: { offset: 6, blur: 16, glow: 16 },
    };
    const s = scales[size];

    switch (style) {
      case 'offset':
        return `${s.offset}px ${s.offset}px 0 ${color}`;
      case 'blur':
        return `0 ${Math.round(s.blur * 0.3)}px ${s.blur}px ${color}40`;
      case 'glow':
        return `0 0 ${s.glow}px ${color}60, 0 0 ${Math.round(s.glow * 0.3)}px ${color}30`;
      case 'none':
        return 'none';
      default:
        return `${s.offset}px ${s.offset}px 0 ${color}`;
    }
  }

  protected render() {
    const bg = this._v('color_background', '#ffffff');
    const surface = this._v('color_surface', '#f5f5f5');
    const surfaceSunken = this._v('color_surface_sunken', '#e5e5e5');
    const text = this._v('color_text', '#0a0a0a');
    const textSecondary = this._v('color_text_secondary', '#525252');
    const textMuted = this._v('color_text_muted', '#a3a3a3');
    const primary = this._v('color_primary', '#000000');
    const secondary = this._v('color_secondary', '#3b82f6');
    const accent = this._v('color_accent', '#f59e0b');
    const border = this._v('color_border', '#000000');
    const borderLight = this._v('color_border_light', '#d4d4d4');
    const danger = this._v('color_danger', '#dc2626');
    const success = this._v('color_success', '#16a34a');
    const textInverse = this._v('text_inverse', '#ffffff');
    const fontHeading = this.values.font_heading || "'Courier New', monospace";
    const fontBody = this.values.font_body || 'system-ui, sans-serif';
    const baseFontSize = this.values.font_base_size || '16px';
    const headingWeight = this.values.heading_weight || '900';
    const headingTransform = this.values.heading_transform || 'uppercase';
    const headingTracking = this.values.heading_tracking || '1px';
    const borderRadius = this.values.border_radius || '0';
    const borderWidth = this.values.border_width || '3px';
    const shadowStyle = this.values.shadow_style || 'offset';
    const shadowColor = this.values.shadow_color || '#000000';

    const shadow = this._computeShadow(shadowStyle, shadowColor, 'md');

    return html`
      <div
        class="preview__content"
        style="
          background: ${bg};
          color: ${text};
          border-color: ${border};
          border-width: ${borderWidth};
          border-radius: ${borderRadius};
          font-family: ${fontBody};
          font-size: ${baseFontSize};
        "
      >
        <h4
          class="preview__heading"
          style="
            font-family: ${fontHeading};
            color: ${text};
            font-weight: ${headingWeight};
            text-transform: ${headingTransform};
            letter-spacing: ${headingTracking};
          "
        >
          ${msg('Simulation Title')}
        </h4>
        <p class="preview__text">
          ${msg('This is how body text will appear with the selected colors and fonts.')}
        </p>
        <p class="preview__text" style="color: ${textSecondary};">
          ${msg('This is secondary text.')}
        </p>
        <p class="preview__text" style="color: ${textMuted};">
          ${msg('This is muted/disabled text.')}
        </p>

        <div class="preview__swatch-row">
          ${[
            { c: primary, t: msg('Primary') },
            { c: secondary, t: msg('Secondary') },
            { c: accent, t: msg('Accent') },
            { c: surface, t: msg('Surface') },
            { c: surfaceSunken, t: msg('Sunken') },
            { c: danger, t: msg('Danger') },
            { c: success, t: msg('Success') },
          ].map(
            ({ c, t }) => html`
              <div
                class="preview__swatch"
                style="background: ${c}; border-radius: ${borderRadius};"
                title=${t}
              ></div>
            `,
          )}
        </div>

        <div class="preview__btn-row">
          <div
            class="preview__btn"
            style="
              background: ${primary};
              color: ${textInverse};
              border: ${borderWidth} solid ${primary};
              border-radius: ${borderRadius};
              box-shadow: ${shadow};
            "
          >
            ${msg('Primary Button')}
          </div>
          <div
            class="preview__btn"
            style="
              background: transparent;
              color: ${text};
              border: ${borderWidth} solid ${border};
              border-radius: ${borderRadius};
              box-shadow: ${shadow};
            "
          >
            ${msg('Secondary')}
          </div>
        </div>

        <div
          class="preview__card"
          style="
            background: ${surface};
            border: ${borderWidth} solid ${border};
            border-radius: ${borderRadius};
            box-shadow: ${shadow};
          "
        >
          <h5
            class="preview__card-title"
            style="
              font-family: ${fontHeading};
              font-weight: ${headingWeight};
              text-transform: ${headingTransform};
              letter-spacing: ${headingTracking};
            "
          >
            ${msg('Card Title')}
          </h5>
          <p class="preview__card-text" style="color: ${textSecondary};">
            ${msg('A sample card showing how surfaces, borders, and shadows combine.')}
          </p>
        </div>

        <input
          class="preview__input"
          style="
            background: ${surfaceSunken};
            color: ${text};
            border: 1px solid ${borderLight};
            border-radius: ${borderRadius};
            font-family: ${fontBody};
          "
          type="text"
          placeholder=${msg('Input field')}
          readonly
          aria-label=${msg('Theme preview input field')}
        />
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-design-preview': VelgDesignPreview;
  }
}
