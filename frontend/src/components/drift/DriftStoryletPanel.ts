/**
 * VelgDriftStoryletPanel — the scene panel: a moment that stops the run and asks.
 *
 * This is the reusable stage the whole Fun-Kern narrates on. W1 gives it two tenants —
 * the HAVARIE (the failure floor, now a decision instead of a snap) and the BUREAU
 * DEBRIEFING (the receipt at the end of a run) — and W2's signals move in without the
 * panel changing shape: eyebrow, prose, 2–4 options that state their price honestly, and
 * an optional selection list (the Notabwurf's manifest).
 *
 * The design rule it exists to enforce: **an option must never hide its cost.** Every
 * chip on a button is read from the server's own tuning catalogue (checkpoint.havarie
 * .catalogue), not from a client-side copy that could quietly drift out of date. A player
 * who is about to lose half a haul has the right to read "halber Haul" on the button.
 *
 * Motion (plan §8 M-15): the panel slides in with a single jitter frame — drama in the
 * ENTRANCE, clarity in the CHOICE. The options themselves never move under the cursor.
 * Under prefers-reduced-motion the panel simply is there, fully legible.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { icons } from '../../utils/icons.js';

/** One choosable option. `chips` are the honest price tags; `danger` marks the option that
 *  ends the run. `requiresSelection` turns the panel's manifest list on. */
export interface StoryletOption {
  key: string;
  label: string;
  detail: string;
  chips: string[];
  danger?: boolean;
  requiresSelection?: boolean;
}

/** A selectable item (W1: the cargo a Notabwurf may throw overboard). */
export interface StoryletSelectable {
  id: string;
  label: string;
  hint?: string;
}

@localized()
@customElement('velg-drift-storylet-panel')
export class VelgDriftStoryletPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
      --_accent: var(--color-primary);
      --_danger: var(--color-danger);
    }

    :host([tone='danger']) {
      --_accent: var(--color-danger);
    }

    /* M-15: entrance drama on the panel LEAF (transform here is safe — the panel is not a
       layout shell and carries no fixed-position descendants). */
    .scene {
      max-width: 520px;
      padding: var(--space-5);
      background: var(--color-surface-raised);
      border: var(--border-medium);
      border-top: var(--border-width-heavy) solid var(--_accent);
      box-shadow: var(--shadow-xl);
      animation: scene-in 560ms var(--ease-dramatic) both;
    }

    @keyframes scene-in {
      0% {
        opacity: 0;
        transform: translateY(18px);
      }
      70% {
        opacity: 1;
        transform: translateY(-2px);
      }
      /* the single jitter frame: the Drift shook the dossier out of the drawer */
      82% {
        transform: translateY(0) translateX(2px);
      }
      100% {
        opacity: 1;
        transform: none;
      }
    }

    .scene__eyebrow {
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
      margin: 0;
      font-family: var(--font-brutalist);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      font-size: var(--text-xs);
      color: var(--_accent);
    }

    .scene__title {
      margin: var(--space-2) 0 var(--space-3);
      font-family: var(--font-brutalist);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      font-size: var(--text-lg);
      line-height: var(--leading-tight);
      color: var(--color-text-primary);
    }

    .scene__prose {
      margin: 0 0 var(--space-4);
      font-family: var(--font-bureau);
      font-size: var(--text-base);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
    }

    .manifest {
      margin: 0 0 var(--space-4);
      padding: var(--space-3);
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) dashed var(--color-border);
    }

    .manifest__label {
      margin: 0 0 var(--space-2);
      font-family: var(--font-brutalist);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .manifest__item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) 0;
      font-size: var(--text-sm);
      color: var(--color-text-primary);
      cursor: pointer;
    }

    .manifest__item input {
      width: 16px;
      height: 16px;
      accent-color: var(--_accent);
      cursor: pointer;
    }

    .manifest__hint {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .options {
      display: grid;
      gap: var(--space-2);
    }

    .option {
      display: block;
      width: 100%;
      padding: var(--space-3);
      text-align: left;
      background: var(--color-surface);
      border: var(--border-width-thin) solid var(--color-border);
      border-left: var(--border-width-thick) solid var(--_accent);
      color: var(--color-text-primary);
      cursor: pointer;
      transition: background var(--transition-fast), border-color var(--transition-fast);
    }

    .option:hover:not(:disabled) {
      background: var(--color-primary-bg);
      border-color: var(--_accent);
    }

    .option:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .option:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .option--danger {
      border-left-color: var(--_danger);
    }

    .option--danger:hover:not(:disabled) {
      background: var(--color-danger-bg);
      border-color: var(--_danger);
    }

    .option__label {
      font-family: var(--font-brutalist);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      font-size: var(--text-sm);
      color: var(--color-text-primary);
    }

    .option__detail {
      margin: var(--space-1) 0 0;
      font-family: var(--font-bureau);
      font-size: var(--text-sm);
      line-height: var(--leading-snug);
      color: var(--color-text-secondary);
    }

    .option__chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
      margin-top: var(--space-2);
    }

    .chip {
      padding: 1px var(--space-1-5);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border);
    }

    .option--danger .chip {
      color: var(--color-text-danger);
      border-color: var(--color-danger-border);
    }

    @media (max-width: 640px) {
      .scene {
        padding: var(--space-4);
      }
      .option {
        min-height: 44px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .scene {
        animation: none;
      }
      .option {
        transition: none;
      }
    }
  `;

  @property({ type: String }) eyebrow = '';
  @property({ type: String }) sceneTitle = '';
  @property({ type: String }) prose = '';
  @property({ type: String, reflect: true }) tone: 'default' | 'danger' = 'default';
  @property({ attribute: false }) options: StoryletOption[] = [];
  @property({ attribute: false }) selectables: StoryletSelectable[] = [];
  @property({ type: String }) selectionLabel = '';
  @property({ type: Boolean }) busy = false;

  @state() private _selected = new Set<string>();

  private _toggle(id: string): void {
    const next = new Set(this._selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this._selected = next;
  }

  private _pick(option: StoryletOption): void {
    this.dispatchEvent(
      new CustomEvent('storylet-pick', {
        bubbles: true,
        composed: true,
        detail: { key: option.key, selected: [...this._selected] },
      }),
    );
  }

  /** An option that needs a selection stays disabled until one exists — the panel refuses
   *  to let the player fire a choice the server would only reject (NOTHING_SELECTED). */
  private _blocked(option: StoryletOption): boolean {
    return !!option.requiresSelection && this._selected.size === 0;
  }

  protected render() {
    const needsManifest = this.options.some((o) => o.requiresSelection);

    return html`
      <div class="scene" role="dialog" aria-modal="false" aria-label=${this.sceneTitle}>
        <p class="scene__eyebrow">
          ${icons.stampClassified(14)}<span>${this.eyebrow}</span>
        </p>
        <h2 class="scene__title">${this.sceneTitle}</h2>
        <p class="scene__prose">${this.prose}</p>

        ${
          needsManifest && this.selectables.length
            ? html`<div class="manifest">
                <p class="manifest__label">
                  ${this.selectionLabel || msg('Fracht auswählen')}
                </p>
                ${this.selectables.map(
                  (item) => html`<label class="manifest__item">
                    <input
                      type="checkbox"
                      .checked=${this._selected.has(item.id)}
                      @change=${() => this._toggle(item.id)}
                    />
                    <span>${item.label}</span>
                    ${item.hint ? html`<span class="manifest__hint">${item.hint}</span>` : ''}
                  </label>`,
                )}
              </div>`
            : ''
        }

        <div class="options">
          ${this.options.map(
            (option) => html`<button
              class="option ${option.danger ? 'option--danger' : ''}"
              ?disabled=${this.busy || this._blocked(option)}
              @click=${() => this._pick(option)}
              aria-label=${msg(str`${option.label}: ${option.detail}`)}
            >
              <span class="option__label">${option.label}</span>
              <p class="option__detail">${option.detail}</p>
              ${
                option.chips.length
                  ? html`<span class="option__chips">
                      ${option.chips.map((chip) => html`<span class="chip">${chip}</span>`)}
                    </span>`
                  : ''
              }
            </button>`,
          )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-drift-storylet-panel': VelgDriftStoryletPanel;
  }
}
