import { css, html, LitElement, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { getInitials } from '../../utils/text.js';
import { markerCornerStyles } from './marker-styles.js';

@customElement('velg-avatar')
export class VelgAvatar extends LitElement {
  static styles = [
    markerCornerStyles,
    css`
    :host {
      display: block;

      /* Grund und Tinte des Chips sind EIN Paar.

         Wer die Plakette umfaerbt, faerbt beides oder nichts: der Grund
         allein war, wie die Nutzer-Initiale in Velgarien schwarz auf
         schwarz stand (gemessen 2,06 : 1). Die Vorgaben bleiben die
         Rollen der Seite; wer sie verlaesst, nennt sie hier zu zweit. */
      --_ground: var(--avatar-ground, var(--color-surface-sunken));
      --_ink: var(--avatar-ink, var(--color-text-quiet));
    }

    .avatar-wrap {
      position: relative;
      display: inline-block;
    }

    .avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: var(--_ground);
      position: relative;
      z-index: 1;
      box-sizing: border-box;
    }

    :host([size='xs']) .avatar {
      width: 24px;
      height: 24px;
      border: var(--border-width-thin) solid var(--color-border);
    }

    :host([size='sm']) .avatar {
      width: 32px;
      height: 32px;
      /* max() respects theme token but enforces 2px minimum —
         simulation themes can override --border-width-default to 1px
         which is invisible on dark backgrounds. */
      border: max(2px, var(--border-width-default)) solid var(--color-border);
      /* Separation ring — keeps avatar edges visible on dark backgrounds */
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-text-primary) 8%, transparent);
    }

    :host([size='full']) .avatar {
      width: 100%;
      aspect-ratio: var(--avatar-aspect, 1 / 1);
      height: var(--avatar-height, auto);
      border-bottom: var(--border-medium);
    }

    /* Schatten-DOM erbt keine globale Klasse — die Hilfsklasse muss hier
       stehen, sonst ist der Text sichtbar statt nur hoerbar. */
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }

    /* ── Mood ring ──────────────────────────────────── */

    /*
      Eine Registermarke, kein Rahmen.

      Bis zum 03.09.2026 trug er 2 px Rand, 6 px Schein UND einen Dauerpuls
      (opacity 0.55 -> 1 -> 0.55, alle 3 s, endlos). Auf Prod gemessen: 15 von
      35 Portraits im Chatverlauf hatten ihn, alle in derselben Farbe, weil
      neutral damals Bernstein zurueckgab. Ein pulsierender Schein an fast jedem
      zweiten Bild sagt "hier stimmt etwas nicht" — der Nutzer hat ihn genau so
      gelesen ("schaut aus wie ein Bug"), und das war die richtige Lesart.

      Der Puls ist weg: eine Dauerbewegung ist im ganzen Haus fuer LAUFENDE
      Vorgaenge reserviert (Ladezustand, Erzeugung). Ein Zustand bewegt sich
      nicht. Der Schein ist weg, weil er die Farbe ueber den Rand hinaus in den
      Untergrund traegt und den Ring unscharf macht — auf einem 32-px-Bild ist
      ein 6-px-Schein fast so gross wie der Ring selbst.

      Geblieben ist, was die Aussage traegt: ein klarer Rand in der Farbe des
      Bandes. Neutral bekommt gar keinen mehr (siehe moodRingColor), also
      steht ein Ring jetzt fuer eine ABWEICHUNG und nicht fuer den Normalfall.
    */
    .mood-mark {
      position: absolute;
      /* Etwas ausserhalb des Bildes, damit die Arme das Gesicht nicht
         anschneiden — dieselbe Lage, die der alte Ring hatte. */
      inset: -3px;
      z-index: 2;
      --marker-color: var(--_mood-color, transparent);
    }

    /* Die Armlaenge folgt der Bildgroesse. Ein fester Arm, der auf 80 px
       stimmt, ist auf 24 px ein Rahmen — genau die Grenze, die
       marker-corners--tight im Modulkopf nennt. */
    :host([size='xs']) .mood-mark { --marker-arm: 6px; --marker-thickness: 1px; }
    :host([size='sm']) .mood-mark { --marker-arm: 9px; --marker-thickness: 2px; }
    :host([size='full']) .mood-mark { --marker-arm: 20px; --marker-thickness: 3px; }

    .avatar__img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    :host([clickable]) .avatar__img,
    :host([clickable]) .avatar {
      cursor: pointer;
    }

    .avatar__initials {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      text-transform: var(--label-transform);
      letter-spacing: var(--tracking-brutalist);
      color: var(--_ink);
    }

    :host([size='xs']) .avatar__initials {
      font-size: 9px;
    }

    :host([size='sm']) .avatar__initials {
      font-size: var(--text-xs);
    }

    :host([size='full']) .avatar__initials {
      font-size: var(--text-3xl);
    }
  `,
  ];

  @property({ type: String }) src = '';
  @property({ type: String }) name = '';
  @property({ type: String, attribute: 'alt' }) altText = '';
  @property({ type: String, reflect: true }) size: 'xs' | 'sm' | 'full' = 'sm';
  @property({ type: Boolean, reflect: true }) clickable = false;
  /** Ringfarbe (CSS-Wert). Gesetzt = der Agent weicht vom neutralen Band ab. */
  @property({ type: String }) moodColor = '';
  /**
   * Was der Ring BEDEUTET, in Worten.
   *
   * Ein farbiger Ring ohne Legende ist Dekoration. Auf Prod gemessen
   * (03.09.2026): der Ring lag an 15 von 35 Portraits im Chatverlauf, und
   * nirgends in der Oberflaeche stand, was er heisst — kein Tooltip, kein
   * `title`, kein `aria-label`, nichts in der Hilfe. Die einzigen Erwaehnungen
   * standen in Code-Kommentaren.
   *
   * Wer den Ring setzt, sagt jetzt auch, wofuer er steht. Er wandert als
   * `title` an das Bild (Mauszeiger) und als unsichtbarer Text in den
   * Vorlesefluss, denn der Ring selbst ist `aria-hidden` und traegt fuer eine
   * Vorlesehilfe sonst gar nichts.
   */
  @property({ type: String }) moodLabel = '';

  private _handleClick(e: Event): void {
    if (!this.clickable) return;
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('avatar-click', {
        detail: { src: this.src },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _renderMoodRing() {
    if (!this.moodColor) return nothing;
    return html`<div
      class="mood-mark marker-corners"
      style=${styleMap({ '--_mood-color': this.moodColor })}
      aria-hidden="true"
    ></div>`;
  }

  /** Der Ring, in Worten — fuer Vorlesehilfen, die den Rand nicht sehen. */
  private _renderMoodLabel() {
    if (!this.moodColor || !this.moodLabel) return nothing;
    return html`<span class="visually-hidden">${this.moodLabel}</span>`;
  }

  /**
   * A src that fails to load. Cleared so render() falls through to the
   * initials — a broken <img> otherwise paints the browser's own placeholder,
   * which on a dark surface is the brightest thing on screen and means nothing.
   *
   * Not reported to Sentry: a missing portrait is a content gap, not a defect,
   * and a roster page would send one event per agent. The visible fallback IS
   * the handling.
   */
  @state() private _srcFailed = false;

  protected willUpdate(changed: PropertyValues): void {
    // A new URL deserves its own attempt.
    if (changed.has('src')) this._srcFailed = false;
  }

  private _handleImgError(): void {
    this._srcFailed = true;
  }

  protected render() {
    if (this.src && !this._srcFailed) {
      return html`
        <div class="avatar-wrap" title=${this.moodLabel || nothing}>
          ${this._renderMoodRing()}${this._renderMoodLabel()}
          <div class="avatar">
            <img
              class="avatar__img"
              src=${this.src}
              alt=${this.altText || this.name}
              loading="lazy"
              @error=${this._handleImgError}
              @click=${this.clickable ? this._handleClick : nothing}
            />
          </div>
        </div>
      `;
    }

    return html`
      <div class="avatar-wrap" title=${this.moodLabel || nothing}>
        ${this._renderMoodRing()}${this._renderMoodLabel()}
        <div class="avatar" @click=${this.clickable ? this._handleClick : nothing}>
          <span class="avatar__initials">${getInitials(this.name)}</span>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-avatar': VelgAvatar;
  }
}
