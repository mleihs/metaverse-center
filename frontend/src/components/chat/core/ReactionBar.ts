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

/** Game-themed preset emoji palette. */
const PRESET_EMOJIS = ['👍', '👎', '❤️', '🔥', '🎯', '💡', '⚔️', '🏰'] as const;

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
      color: var(--color-primary);
    }

    /* --- Add reaction button --- */
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
      color: var(--color-text-muted);
      transition: all var(--transition-fast);
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
      inset: unset;
      position-anchor: --reaction-add;
      /* Fallback positioning for browsers without anchor positioning */
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
    }
  }

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
        ${hasReactions
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
                  title=${r.reacted_by_me
                    ? msg('Remove reaction')
                    : msg('Add reaction')}
                  aria-pressed=${r.reacted_by_me ? 'true' : 'false'}
                  aria-label="${r.emoji} ${r.count}"
                >
                  <span class="pill__emoji">${r.emoji}</span>
                  <span class="pill__count">${r.count}</span>
                </button>
              `,
            )
          : nothing}

        <button
          class="add-btn"
          title=${msg('Add reaction')}
          aria-label=${msg('Add reaction')}
        >
          ${icons.smile(12)}
        </button>

        <div class="picker" popover>
          <div class="picker__grid" role="group" aria-label=${msg('Choose reaction')}>
            ${PRESET_EMOJIS.map(
              (emoji) => html`
                <button
                  class="picker__emoji"
                  @click=${() => this._handleToggleReaction(emoji)}
                  aria-label=${emoji}
                >
                  ${emoji}
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
