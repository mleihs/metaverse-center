/**
 * ReactionBar — Signal-flare reaction pills for chat messages.
 *
 * Renders reaction summaries as compact tactical pills: [emoji count].
 * Own-reacted pills glow with the primary amber accent — lit indicator
 * on a control panel. The [+] button opens a frosted-glass emoji picker
 * via the Popover API (8 preset game-themed emojis in a 4×2 grid).
 *
 * Shadow DOM compatibility: uses `popoverTargetElement` JS property
 * (NOT `popovertarget` HTML attribute) because attribute-based targeting
 * cannot cross shadow boundaries.
 *
 * Events:
 *   - `reaction-toggle` — { messageId, emoji } when a pill or picker emoji is clicked
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';

import type { ChatReactionSummary } from '../../../types/index.js';
import { icons } from '../../../utils/icons.js';

/** The marks a reader puts in a margin.
 *
 * Vorher standen hier acht Emoji (Daumen, Herz, Flamme, Burg). Sie kamen aus
 * einer anderen Welt als der Rest dieses Hauses: eine Akte traegt keine
 * Flamme. Und sie waren bunt in einer Oberflaeche, die ihre Farbe sonst
 * ausschliesslich fuer Bedeutung ausgibt.
 *
 * Diese acht sind typografische Marken, keine Bilder — sie nehmen die
 * Schriftfarbe an, sitzen in der Laufweite der Akte und lesen sich als das,
 * was sie sind: ein Vermerk am Rand.
 *
 * BESTAND: aeltere Reaktionen tragen weiter ihr Emoji. Die Leiste zeigt, was
 * gespeichert ist; nur die AUSWAHL aendert sich. Kein Datensatz wird
 * angefasst, kein Zeichen umgedeutet.
 */
const PRESET_MARKS = [
  { mark: '\u2713', label: () => msg('Noted') },
  { mark: '\u2717', label: () => msg('Objection') },
  { mark: '\u2691', label: () => msg('Flagged') },
  { mark: '\u2726', label: () => msg('Of note') },
  { mark: '\u26A0', label: () => msg('Reservation') },
  { mark: '?', label: () => msg('Query') },
  { mark: '\u270E', label: () => msg('Marginal note') },
  { mark: '\u00A7', label: () => msg('On record') },
] as const;

@localized()
@customElement('velg-reaction-bar')
export class ReactionBar extends LitElement {
  static styles = css`
    :host {
      display: block;
      --_pill-bg: color-mix(in srgb, var(--color-surface-raised) 60%, transparent);
      --_pill-border: var(--color-border-light);
      --_pill-active-bg: color-mix(in srgb, var(--color-primary) 15%, var(--color-surface-raised));
      --_pill-active-border: color-mix(in srgb, var(--color-primary) 40%, transparent);
      --_pill-active-glow: color-mix(in srgb, var(--color-primary) 25%, transparent);
      --_picker-bg: color-mix(in srgb, var(--color-surface-raised) 90%, transparent);
      --_picker-border: var(--color-border);
    }

    .bar {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
      align-items: center;
      margin-top: var(--space-1);
    }

    /* --- Reaction pill --- */
    .pill {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: 2px var(--space-1-5);
      background: var(--_pill-bg);
      border: var(--border-width-thin) solid var(--_pill-border);
      cursor: pointer;
      transition: all var(--transition-fast);
      user-select: none;
    }

    .pill:hover {
      background: color-mix(in srgb, var(--color-text-primary) 8%, var(--_pill-bg));
    }

    .pill:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .pill--active {
      background: var(--_pill-active-bg);
      border-color: var(--_pill-active-border);
      box-shadow: 0 0 6px var(--_pill-active-glow);
    }

    .pill--active:hover {
      background: color-mix(in srgb, var(--color-primary) 22%, var(--color-surface-raised));
    }

    /* Flash animation on toggle */
    .pill--flash {
      animation: pill-flash 300ms ease-out;
    }

    @keyframes pill-flash {
      0% { box-shadow: 0 0 12px var(--_pill-active-glow); }
      100% { box-shadow: 0 0 6px var(--_pill-active-glow); }
    }

    .pill__emoji {
      font-size: 14px;
      line-height: 1;
    }

    .pill__count {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--color-text-secondary);
      min-width: 8px;
      text-align: center;
    }

    .pill--active .pill__count {
      color: var(--color-accent-amber);
    }

    /* --- Add reaction button --- */
    /* Sichtbarkeit von AUSSEN steuerbar.
     *
     * Der Picker haengt seit jeher an diesem Knopf (Popover API, in
     * firstUpdated verdrahtet) — nur wurde die ganze Leiste bloss gerendert,
     * wenn schon jemand reagiert hatte. Ein Weg, der sich selbst voraussetzt:
     * um die erste Reaktion zu setzen, musste bereits eine da sein.
     *
     * Die Leiste steht jetzt immer; ohne Reaktionen ist sie nur dieser eine
     * Knopf, und ChatMessage blendet ihn ueber die Variable ein, sobald die
     * Zeile beruehrt oder mit der Tastatur betreten wird. Cross-Shadow geht
     * das nur so: :hover des Elternteils erreicht diesen Knopf nicht, eine
     * geerbte Custom Property schon.
     */
    .add-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      background: transparent;
      border: var(--border-width-thin) dashed var(--_pill-border);
      cursor: pointer;
      color: var(--color-text-quiet);
      transition: all var(--transition-fast);
      opacity: var(--reaction-add-opacity, 1);
      transition: opacity var(--transition-fast);
    }

    .add-btn:hover {
      background: var(--_pill-bg);
      color: var(--color-text-secondary);
      border-style: solid;
    }

    .add-btn:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    /* --- Emoji picker popover --- */
    .picker {
      margin: 0;
      padding: var(--space-2);
      background: var(--_picker-bg);
      border: var(--border-width-thin) solid var(--_picker-border);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      box-shadow: var(--shadow-sm);
      /* Ort kommt aus _placePicker, in Fensterkoordinaten. "position: fixed"
         ist fuer ein Popover im Top-Layer die richtige Bezugsgroesse und
         nimmt keinem Vorfahren etwas uebel: der Top-Layer liegt ausserhalb
         jedes "contain" und jedes "filter", die sonst genau hier zuschlagen
         wuerden (siehe .message-item in ChatFeed.ts). */
      inset: auto;
      position: fixed;
      margin: 0;
    }

    /* Popover open/close transitions */
    .picker:popover-open {
      opacity: 1;
      transform: translateY(0);
    }

    @starting-style {
      .picker:popover-open {
        opacity: 0;
        transform: translateY(-4px);
      }
    }

    .picker {
      transition:
        opacity var(--transition-fast) var(--ease-out, ease-out),
        transform var(--transition-fast) var(--ease-out, ease-out),
        display var(--transition-fast) allow-discrete,
        overlay var(--transition-fast) allow-discrete;
      opacity: 0;
      transform: translateY(-4px);
    }

    .picker__grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--space-1);
    }

    .picker__emoji {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      background: transparent;
      border: var(--border-width-thin) solid transparent;
      cursor: pointer;
      font-size: 18px;
      /* Eine eigene Tinte, weil die Marken jetzt welche brauchen.

         Emoji malen sich selbst; sie haben ihre Farbe im Zeichen. Die
         typografischen Marken nehmen die Schriftfarbe an — und die stand hier
         nie, sie wurde geerbt. Auf Prod gemessen, unmittelbar nach dem
         Wechsel: rgb(255,255,255) auf einem fast weissen Grund, **1,09 : 1**.
         Acht unsichtbare Knoepfe.

         Der Fehler war vorher da und folgenlos; erst das neue Zeichen hat ihn
         sichtbar gemacht — beziehungsweise unsichtbar. */
      color: var(--color-text-primary);
      line-height: 1;
      transition: all var(--transition-fast);
    }

    .picker__emoji:hover {
      background: color-mix(in srgb, var(--color-primary) 12%, transparent);
      border-color: var(--_pill-active-border);
    }

    .picker__emoji:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .picker__emoji:active {
      transform: scale(0.88);
    }

    @media (prefers-reduced-motion: reduce) {
      .pill--flash { animation: none; }
      .picker { transition-duration: 0.01ms !important; }
      .picker__emoji:active { transform: none; }
    }
  `;

  @property({ type: Array }) reactions: ChatReactionSummary[] = [];
  @property({ type: String }) messageId = '';

  @query('.picker') private _picker!: HTMLElement;
  @query('.add-btn') private _addBtn!: HTMLElement;

  /**
   * Wire up Popover API target via JS property (Shadow DOM safe).
   * Must run after first render when both elements exist in the shadow root.
   */
  protected override firstUpdated(): void {
    if (this._addBtn && this._picker) {
      (this._addBtn as HTMLButtonElement).popoverTargetElement = this._picker;
      (this._addBtn as HTMLButtonElement).popoverTargetAction = 'toggle';
      this._picker.addEventListener('beforetoggle', this._hidePicker);
      this._picker.addEventListener('toggle', this._placePicker);
    }
  }

  override disconnectedCallback(): void {
    this._picker?.removeEventListener('beforetoggle', this._hidePicker);
    this._picker?.removeEventListener('toggle', this._placePicker);
    super.disconnectedCallback();
  }

  /** Put the picker beside the button it belongs to.
   *
   * Der Waehler stand in der linken oberen Ecke des Fensters, und das war
   * kein Layoutfehler, sondern eine Regel, die es nicht gab: das CSS sagte
   * "position-anchor: --reaction-add", aber "anchor-name: --reaction-add"
   * wurde nirgends vergeben. Ein Popover liegt im Top-Layer; ohne Anker und
   * mit "inset: unset" hat es keinerlei Ortsangabe und faellt auf 0,0.
   *
   * Gerechnet wird darum hier, in einem Weg fuer alle Browser statt in zwei,
   * von denen einer nur in Chrome greift. Der Waehler oeffnet ueber dem
   * Knopf und rechtsbuendig zu ihm; findet er dort keinen Platz, klappt er
   * nach unten, und an den Fensterraendern bleibt er mit einem Rand von
   * --space-2 stehen.
   */
  private readonly _hidePicker = (e: Event): void => {
    // VOR dem Oeffnen unsichtbar schalten, damit der eine Bildlauf zwischen
    // Oeffnen und Platzieren nicht als Sprung zu sehen ist.
    if ((e as ToggleEvent).newState === 'open') this._picker.style.visibility = 'hidden';
  };

  private readonly _placePicker = (e: Event): void => {
    if ((e as ToggleEvent).newState !== 'open') return;
    const btn = this._addBtn?.getBoundingClientRect();
    if (!btn) return;

    const p = this._picker;
    // NACH dem Oeffnen messen, nicht davor.
    //
    // Die erste Fassung hing an `beforetoggle` — und ein Popover ist da noch
    // `display: none`, hat also die Groesse 0×0. Auf Prod nachgemessen, bevor
    // es jemand melden konnte:
    //
    //     Knopf     links 991, oben 412, rechts 1015
    //     Waehler   links 1015 (= Knopfkante), oben 406 (= 412 − 6)
    //
    // Beide Zahlen sind aus einer Breite und einer Hoehe von null gerechnet.
    // Der Ort war nicht falsch berechnet, er war aus nichts berechnet — und
    // sah trotzdem plausibel aus. `toggle` feuert, wenn das Popover steht.
    p.style.left = '0px';
    p.style.top = '0px';
    const box = p.getBoundingClientRect();
    const gap = 6;
    const edge = 8;

    let top = btn.top - box.height - gap;
    if (top < edge) top = btn.bottom + gap;

    let left = btn.right - box.width;
    left = Math.min(Math.max(left, edge), window.innerWidth - box.width - edge);

    p.style.left = `${Math.round(left)}px`;
    p.style.top = `${Math.round(top)}px`;
    p.style.visibility = '';
  };

  private _handleToggleReaction(emoji: string): void {
    this.dispatchEvent(
      new CustomEvent('reaction-toggle', {
        detail: { messageId: this.messageId, emoji },
        bubbles: true,
        composed: true,
      }),
    );
    // Close picker if open
    this._picker?.hidePopover?.();
  }

  protected render() {
    const hasReactions = this.reactions.length > 0;

    return html`
      <div class="bar" role="group" aria-label=${msg('Reactions')}>
        ${
          hasReactions
            ? repeat(
                this.reactions,
                (r) => r.emoji,
                (r) => html`
                <button
                  class=${classMap({
                    pill: true,
                    'pill--active': r.reacted_by_me,
                  })}
                  @click=${() => this._handleToggleReaction(r.emoji)}
                  title=${r.reacted_by_me ? msg('Remove reaction') : msg('Add reaction')}
                  aria-pressed=${r.reacted_by_me ? 'true' : 'false'}
                  aria-label="${r.emoji} ${r.count}"
                >
                  <span class="pill__emoji">${r.emoji}</span>
                  <span class="pill__count">${r.count}</span>
                </button>
              `,
              )
            : nothing
        }

        <button
          class="add-btn"
          title=${msg('Add reaction')}
          aria-label=${msg('Add reaction')}
        >
          ${icons.smile(12)}
        </button>

        <div class="picker" popover>
          <div class="picker__grid" role="group" aria-label=${msg('Choose reaction')}>
            ${PRESET_MARKS.map(
              ({ mark, label }) => html`
                <button
                  class="picker__emoji"
                  @click=${() => this._handleToggleReaction(mark)}
                  title=${label()}
                  aria-label=${label()}
                >
                  ${mark}
                </button>
              `,
            )}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-reaction-bar': ReactionBar;
  }
}
