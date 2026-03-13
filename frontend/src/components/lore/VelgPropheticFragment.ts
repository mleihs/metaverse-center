import { localized, msg } from '@lit/localize';
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PropheticFragment } from './lore-content.js';
import { propheticFragmentStyles } from './prophetic-fragment-styles.js';

const TYPE_LABELS: Record<PropheticFragment['type'], () => string> = {
  parchment: () => msg('parchment document'),
  typewriter: () => msg('typewriter document'),
  dream: () => msg('dream journal'),
  memo: () => msg('Bureau memo'),
  stone: () => msg('stone inscription'),
};

/**
 * Renders a single prophetic fragment as a visual artifact.
 * 5 types: parchment (torn edges), typewriter (monospace/dark),
 * dream journal (purple), bureau memo (letterhead), stone inscription (carved).
 * Degradation markers [CONSUMED], [DEGRADED], [ILLEGIBLE] rendered as visual effects.
 */
@localized()
@customElement('velg-prophetic-fragment')
export class VelgPropheticFragment extends LitElement {
  static styles = [propheticFragmentStyles];

  @property({ type: Object }) fragment!: PropheticFragment;

  protected render() {
    const { type, text } = this.fragment;
    const label = TYPE_LABELS[type]();

    return html`
      <div
        class="fragment fragment--${type}"
        role="article"
        aria-label="${msg('Prophetic fragment')} — ${label}"
      >
        ${this._renderWithDegradation(text)}
      </div>
    `;
  }

  private _renderWithDegradation(text: string) {
    const parts: Array<ReturnType<typeof html> | string> = [];
    const regex = /\[(CONSUMED|DEGRADED|ILLEGIBLE|REDACTED)\]/gi;
    let last = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > last) {
        parts.push(text.slice(last, match.index));
      }

      const marker = match[1].toUpperCase();
      switch (marker) {
        case 'CONSUMED':
          parts.push(
            html`<span class="degradation--consumed" aria-label=${msg('Text consumed by degradation')}>████████</span>`,
          );
          break;
        case 'DEGRADED':
          parts.push(
            html`<span class="degradation--degraded" aria-label=${msg('Degraded text')}>[${msg('degraded')}]</span>`,
          );
          break;
        case 'ILLEGIBLE':
          parts.push(
            html`<span class="degradation--illegible" aria-label=${msg('Illegible text')}>[${msg('illegible')}]</span>`,
          );
          break;
        case 'REDACTED':
          parts.push(
            html`<span class="degradation--redacted" aria-label=${msg('Redacted text')}>████████</span>`,
          );
          break;
      }

      last = match.index + match[0].length;
    }

    if (last < text.length) {
      parts.push(text.slice(last));
    }

    return parts;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-prophetic-fragment': VelgPropheticFragment;
  }
}
