/**
 * Dungeon content editor — sheet/drawer that slides in from the right.
 *
 * Features:
 *   - Side-by-side EN/DE bilingual editing with auto-resize textareas
 *   - Live terminal preview of the edited text
 *   - Dirty-state tracking with unsaved changes indicator
 *   - Focus trap (Escape closes, Tab cycles within drawer)
 *   - Structured fields that adapt per content type
 *
 * Emits:
 *   - `editor-save`: { detail: { item, contentType } }
 *   - `editor-close`: when the drawer is dismissed
 *   - `editor-delete`: { detail: { itemId, contentType } }
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { captureError } from '../../services/SentryService.js';
import { adminAnimationStyles } from '../shared/admin-shared-styles.js';
import { focusFirstElement, trapFocus } from '../shared/focus-trap.js';
import './DungeonTerminalPreview.js';

@localized()
@customElement('velg-dungeon-content-editor')
export class DungeonContentEditor extends LitElement {
  static styles = [
    adminAnimationStyles,
    css`
      :host {
        display: block;
      }

      /* ── Backdrop ── */

      .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0 0 0 / 0.6);
        z-index: 900;
        opacity: 0;
        animation: backdrop-in 200ms ease forwards;
      }

      @keyframes backdrop-in {
        to { opacity: 1; }
      }

      /* ── Sheet ── */

      .sheet {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: min(720px, 90vw);
        z-index: 901;
        background: var(--color-surface);
        border-left: 1px solid var(--color-border);
        display: flex;
        flex-direction: column;
        transform: translateX(100%);
        animation: sheet-in 300ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
        box-shadow: -8px 0 40px rgba(0 0 0 / 0.3);
      }

      @keyframes sheet-in {
        to { transform: translateX(0); }
      }

      /* ── Header ── */

      .sheet__header {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-4) var(--space-5);
        border-bottom: 1px solid var(--color-border);
        background: var(--color-surface);
        flex-shrink: 0;
      }

      .sheet__classification {
        font-family: var(--font-brutalist);
        font-size: 8px;
        font-weight: var(--font-bold, 700);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--color-accent-gold, var(--color-accent-amber));
        border: 1px solid var(--color-accent-gold, var(--color-accent-amber));
        padding: 1px var(--space-2);
      }

      .sheet__title {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black, 900);
        font-size: var(--text-sm);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-text-primary);
        margin: 0;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .sheet__close {
        padding: var(--space-1-5);
        background: transparent;
        border: 1px solid var(--color-border);
        color: var(--color-text-muted);
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
        transition: all 0.15s ease;
        flex-shrink: 0;
      }

      .sheet__close:hover {
        color: var(--color-text-primary);
        border-color: var(--color-text-muted);
      }

      /* ── Dirty bar ── */

      .dirty-bar {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-5);
        background: color-mix(in srgb, var(--color-warning) 8%, transparent);
        border-bottom: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent);
        font-family: var(--font-brutalist);
        font-size: 9px;
        font-weight: var(--font-bold, 700);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-warning);
        flex-shrink: 0;
      }

      .dirty-bar__dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--color-warning);
        animation: status-pulse 2s ease-in-out infinite;
      }

      @keyframes status-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }

      /* ── Body ── */

      .sheet__body {
        flex: 1;
        overflow-y: auto;
        padding: var(--space-5);
      }

      /* ── Field groups ── */

      .field-group {
        margin-bottom: var(--space-5);
      }

      .field-group__label {
        display: block;
        font-family: var(--font-brutalist);
        font-size: 9px;
        font-weight: var(--font-bold, 700);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-text-muted);
        margin-bottom: var(--space-2);
      }

      /* ── Bilingual editor ── */

      .bilingual {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-3);
      }

      .bilingual__col {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }

      .bilingual__lang {
        font-family: var(--font-brutalist);
        font-size: 8px;
        font-weight: var(--font-bold, 700);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--color-text-muted);
      }

      .bilingual__textarea {
        width: 100%;
        min-height: 80px;
        padding: var(--space-2) var(--space-3);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        line-height: 1.6;
        color: var(--color-text-primary);
        background: var(--color-surface-sunken, var(--color-surface));
        border: 1px solid var(--color-border);
        resize: vertical;
        transition: border-color 0.2s ease;
        field-sizing: content;
      }

      .bilingual__textarea:focus {
        outline: none;
        border-color: var(--color-accent-gold, var(--color-accent-amber));
        box-shadow: 0 0 0 1px var(--color-accent-gold, var(--color-accent-amber));
      }

      .bilingual__textarea--dirty {
        border-color: var(--color-warning);
      }

      .bilingual__charcount {
        font-size: 9px;
        color: var(--color-text-muted);
        text-align: right;
      }

      /* ── Inline fields ── */

      .field-row {
        display: flex;
        gap: var(--space-3);
        margin-bottom: var(--space-3);
      }

      .field {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }

      .field__label {
        font-family: var(--font-brutalist);
        font-size: 8px;
        font-weight: var(--font-bold, 700);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-text-muted);
      }

      .field__input,
      .field__select {
        padding: var(--space-1-5) var(--space-2);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        color: var(--color-text-primary);
        background: var(--color-surface-sunken, var(--color-surface));
        border: 1px solid var(--color-border);
        transition: border-color 0.2s ease;
      }

      .field__input:focus,
      .field__select:focus {
        outline: none;
        border-color: var(--color-accent-gold, var(--color-accent-amber));
      }

      /* ── JSON field ── */

      .json-field {
        width: 100%;
        min-height: 60px;
        padding: var(--space-2) var(--space-3);
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        line-height: 1.5;
        color: var(--color-info);
        background: var(--color-surface-sunken, var(--color-surface));
        border: 1px solid var(--color-border);
        resize: vertical;
        field-sizing: content;
      }

      .json-field:focus {
        outline: none;
        border-color: var(--color-accent-gold, var(--color-accent-amber));
      }

      .json-field--error {
        border-color: var(--color-danger);
      }

      /* ── Footer ── */

      .sheet__footer {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-5);
        border-top: 1px solid var(--color-border);
        background: var(--color-surface);
        flex-shrink: 0;
      }

      .btn-save {
        padding: var(--space-2) var(--space-5);
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        font-weight: var(--font-bold, 700);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        background: var(--color-accent-gold, var(--color-accent-amber));
        color: var(--color-surface-sunken, #000);
        border: 1px solid var(--color-accent-gold, var(--color-accent-amber));
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .btn-save:hover:not(:disabled) {
        box-shadow: 0 0 12px color-mix(in srgb, var(--color-accent-gold, var(--color-accent-amber)) 40%, transparent);
      }

      .btn-save:disabled {
        opacity: 0.4;
        cursor: default;
      }

      .btn-revert {
        padding: var(--space-2) var(--space-4);
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        font-weight: var(--font-bold, 700);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        background: transparent;
        color: var(--color-text-secondary);
        border: 1px solid var(--color-border);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .btn-revert:hover:not(:disabled) {
        color: var(--color-text-primary);
        border-color: var(--color-text-muted);
      }

      .btn-delete {
        margin-left: auto;
        padding: var(--space-2) var(--space-4);
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        font-weight: var(--font-bold, 700);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        background: transparent;
        color: var(--color-danger);
        border: 1px solid color-mix(in srgb, var(--color-danger) 40%, transparent);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .btn-delete:hover {
        background: color-mix(in srgb, var(--color-danger) 10%, transparent);
        border-color: var(--color-danger);
      }

      .sheet__timestamp {
        font-size: 9px;
        color: var(--color-text-muted);
      }

      /* ── Responsive ── */

      @media (max-width: 768px) {
        .sheet {
          width: 100vw;
        }
        .bilingual {
          grid-template-columns: 1fr;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .backdrop { animation: none; opacity: 1; }
        .sheet { animation: none; transform: translateX(0); }
        .dirty-bar__dot { animation: none; opacity: 0.7; }
      }
    `,
  ];

  @property({ type: Object }) item: Record<string, unknown> | null = null;
  @property() contentType = '';
  @property({ type: Boolean }) open = false;
  @property({ type: Boolean }) saving = false;

  @state() private _draft: Record<string, unknown> = {};
  @state() private _dirty = false;
  @state() private _jsonErrors = new Set<string>();

  // ── Lifecycle ───────────────────────────────────────────────────

  updated(changed: Map<string, unknown>): void {
    if (changed.has('item') && this.item) {
      this._draft = { ...this.item };
      this._dirty = false;
      this._jsonErrors.clear();
    }
    if (changed.has('open') && this.open) {
      focusFirstElement(this.shadowRoot ?? undefined);
    }
  }

  // ── Event handlers ──────────────────────────────────────────────

  private _handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this._close();
      return;
    }
    if (e.key === 'Tab') {
      trapFocus(e, this.shadowRoot?.querySelector('.sheet'), this);
    }
  }

  private _close(): void {
    this.dispatchEvent(new CustomEvent('editor-close', { bubbles: true, composed: true }));
  }

  private _updateField(key: string, value: unknown): void {
    this._draft = { ...this._draft, [key]: value };
    this._dirty = true;
  }

  private _updateJsonField(key: string, rawValue: string): void {
    try {
      const parsed = JSON.parse(rawValue);
      this._draft = { ...this._draft, [key]: parsed };
      this._jsonErrors.delete(key);
      this._dirty = true;
    } catch (err) {
      // Validation-time error: user is editing JSON textarea. UI renders
      // the error via _jsonErrors state. captureError is diagnostic only —
      // the user sees it immediately in the editor.
      captureError(err, { source: 'DungeonContentEditor._updateJsonField', field: key });
      this._jsonErrors = new Set([...this._jsonErrors, key]);
    }
    this.requestUpdate();
  }

  private _save(): void {
    if (this._jsonErrors.size > 0) return;
    this.dispatchEvent(
      new CustomEvent('editor-save', {
        detail: { item: this._draft, contentType: this.contentType },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _revert(): void {
    if (this.item) {
      this._draft = { ...this.item };
      this._dirty = false;
      this._jsonErrors.clear();
    }
  }

  private _delete(): void {
    const itemId = String(this._draft.id ?? '');
    if (!itemId) return;
    this.dispatchEvent(
      new CustomEvent('editor-delete', {
        detail: { itemId, contentType: this.contentType },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ── Render ──────────────────────────────────────────────────────

  protected render() {
    if (!this.open || !this.item) return nothing;

    const itemId = String(this._draft.id ?? this._draft.archetype ?? 'new');
    const updatedAt = this._draft.updated_at
      ? new Date(String(this._draft.updated_at)).toLocaleString()
      : '';

    return html`
      <div class="backdrop" @click=${this._close}></div>
      <aside
        class="sheet"
        role="dialog"
        aria-modal="true"
        aria-label=${msg('Edit content item')}
        @keydown=${this._handleKeydown}
      >
        <!-- Header -->
        <div class="sheet__header">
          <span class="sheet__classification">${this.contentType}</span>
          <h2 class="sheet__title">${itemId}</h2>
          <button
            class="sheet__close"
            @click=${this._close}
            aria-label=${msg('Close editor')}
          >\u2715</button>
        </div>

        <!-- Dirty indicator -->
        ${
          this._dirty
            ? html`
          <div class="dirty-bar" aria-live="polite">
            <span class="dirty-bar__dot"></span>
            ${msg('Unsaved changes')}
          </div>
        `
            : nothing
        }

        <!-- Body -->
        <div class="sheet__body">
          ${this._renderBilingualFields()}
          ${this._renderStructuredFields()}
          ${this._renderPreview()}
        </div>

        <!-- Footer -->
        <div class="sheet__footer">
          <button
            class="btn-save"
            ?disabled=${!this._dirty || this.saving || this._jsonErrors.size > 0}
            @click=${this._save}
          >${this.saving ? msg('Saving...') : msg('Save')}</button>
          <button
            class="btn-revert"
            ?disabled=${!this._dirty}
            @click=${this._revert}
          >${msg('Revert')}</button>
          <button
            class="btn-delete"
            @click=${this._delete}
          >${msg('Delete')}</button>
          ${
            updatedAt
              ? html`
            <span class="sheet__timestamp">${msg('Updated')}: ${updatedAt}</span>
          `
              : nothing
          }
        </div>
      </aside>
    `;
  }

  // ── Bilingual text fields ───────────────────────────────────────

  private _renderBilingualFields() {
    const pairs = this._getBilingualPairs();
    if (pairs.length === 0) return nothing;

    return pairs.map(
      ({ enKey, deKey, label }) => html`
        <div class="field-group">
          <span class="field-group__label">${label}</span>
          <div class="bilingual">
            <div class="bilingual__col">
              <label class="bilingual__lang" for=${`field-${enKey}`}>English</label>
              <textarea
                id=${`field-${enKey}`}
                class="bilingual__textarea ${this._isFieldDirty(enKey) ? 'bilingual__textarea--dirty' : ''}"
                .value=${String(this._draft[enKey] ?? '')}
                @input=${(e: InputEvent) => this._updateField(enKey, (e.target as HTMLTextAreaElement).value)}
              ></textarea>
              <span class="bilingual__charcount">${String(this._draft[enKey] ?? '').length}</span>
            </div>
            <div class="bilingual__col">
              <label class="bilingual__lang" for=${`field-${deKey}`}>Deutsch</label>
              <textarea
                id=${`field-${deKey}`}
                class="bilingual__textarea ${this._isFieldDirty(deKey) ? 'bilingual__textarea--dirty' : ''}"
                .value=${String(this._draft[deKey] ?? '')}
                @input=${(e: InputEvent) => this._updateField(deKey, (e.target as HTMLTextAreaElement).value)}
              ></textarea>
              <span class="bilingual__charcount">${String(this._draft[deKey] ?? '').length}</span>
            </div>
          </div>
        </div>
      `,
    );
  }

  private _getBilingualPairs(): { enKey: string; deKey: string; label: string }[] {
    switch (this.contentType) {
      case 'banter':
        return [{ enKey: 'text_en', deKey: 'text_de', label: msg('Banter Text') }];
      case 'enemies':
        return [
          { enKey: 'name_en', deKey: 'name_de', label: msg('Name') },
          { enKey: 'description_en', deKey: 'description_de', label: msg('Description') },
        ];
      case 'encounters':
        return [{ enKey: 'description_en', deKey: 'description_de', label: msg('Description') }];
      case 'choices':
        return [
          { enKey: 'label_en', deKey: 'label_de', label: msg('Choice Label') },
          {
            enKey: 'success_narrative_en',
            deKey: 'success_narrative_de',
            label: msg('Success Narrative'),
          },
          {
            enKey: 'partial_narrative_en',
            deKey: 'partial_narrative_de',
            label: msg('Partial Narrative'),
          },
          { enKey: 'fail_narrative_en', deKey: 'fail_narrative_de', label: msg('Fail Narrative') },
        ];
      case 'loot':
        return [
          { enKey: 'name_en', deKey: 'name_de', label: msg('Name') },
          { enKey: 'description_en', deKey: 'description_de', label: msg('Description') },
        ];
      case 'abilities':
        return [
          { enKey: 'name_en', deKey: 'name_de', label: msg('Name') },
          { enKey: 'description_en', deKey: 'description_de', label: msg('Description') },
        ];
      case 'entrance_texts':
      case 'barometer_texts':
        return [{ enKey: 'text_en', deKey: 'text_de', label: msg('Text') }];
      default:
        return [];
    }
  }

  // ── Structured fields ───────────────────────────────────────────

  private _renderStructuredFields() {
    switch (this.contentType) {
      case 'banter':
        return html`
          <div class="field-row">
            <div class="field">
              <label class="field__label" for="field-trigger">${msg('Trigger')}</label>
              <select
                id="field-trigger"
                class="field__select"
                .value=${String(this._draft.trigger ?? '')}
                @change=${(e: Event) => this._updateField('trigger', (e.target as HTMLSelectElement).value)}
              >
                ${[
                  'room_entered',
                  'combat_won',
                  'visibility_zero',
                  'low_stability',
                  'high_decay',
                  'high_attachment',
                  'rest',
                  'retreat',
                ].map(
                  (t) =>
                    html`<option value=${t} ?selected=${this._draft.trigger === t}>${t}</option>`,
                )}
              </select>
            </div>
            <div class="field">
              <label class="field__label" for="field-decay">${msg('Decay Tier')}</label>
              <input
                id="field-decay"
                class="field__input"
                type="number"
                min="0"
                max="3"
                .value=${String(this._draft.decay_tier ?? '')}
                @input=${(e: InputEvent) => {
                  const v = (e.target as HTMLInputElement).value;
                  this._updateField('decay_tier', v ? Number(v) : null);
                }}
              />
            </div>
            <div class="field">
              <label class="field__label" for="field-attach">${msg('Attachment Tier')}</label>
              <input
                id="field-attach"
                class="field__input"
                type="number"
                min="0"
                max="2"
                .value=${String(this._draft.attachment_tier ?? '')}
                @input=${(e: InputEvent) => {
                  const v = (e.target as HTMLInputElement).value;
                  this._updateField('attachment_tier', v ? Number(v) : null);
                }}
              />
            </div>
          </div>
          <div class="field-group">
            <span class="field-group__label">${msg('Personality Filter')}</span>
            <textarea
              class="json-field ${this._jsonErrors.has('personality_filter') ? 'json-field--error' : ''}"
              .value=${JSON.stringify(this._draft.personality_filter ?? {}, null, 2)}
              @input=${(e: InputEvent) => this._updateJsonField('personality_filter', (e.target as HTMLTextAreaElement).value)}
            ></textarea>
          </div>
        `;

      case 'enemies':
        return html`
          <div class="field-row">
            <div class="field">
              <label class="field__label" for="field-threat">${msg('Threat Level')}</label>
              <select
                id="field-threat"
                class="field__select"
                .value=${String(this._draft.threat_level ?? 'standard')}
                @change=${(e: Event) => this._updateField('threat_level', (e.target as HTMLSelectElement).value)}
              >
                ${['minion', 'standard', 'elite', 'boss'].map(
                  (t) =>
                    html`<option value=${t} ?selected=${this._draft.threat_level === t}>${t}</option>`,
                )}
              </select>
            </div>
            <div class="field">
              <label class="field__label" for="field-hp">${msg('Condition')}</label>
              <input id="field-hp" class="field__input" type="number" min="1"
                .value=${String(this._draft.condition_threshold ?? '')}
                @input=${(e: InputEvent) => this._updateField('condition_threshold', Number((e.target as HTMLInputElement).value))}
              />
            </div>
            <div class="field">
              <label class="field__label" for="field-atk">${msg('Attack')}</label>
              <input id="field-atk" class="field__input" type="number" min="0"
                .value=${String(this._draft.attack_power ?? '')}
                @input=${(e: InputEvent) => this._updateField('attack_power', Number((e.target as HTMLInputElement).value))}
              />
            </div>
            <div class="field">
              <label class="field__label" for="field-evasion">${msg('Evasion')}</label>
              <input id="field-evasion" class="field__input" type="number" min="0"
                .value=${String(this._draft.evasion ?? '')}
                @input=${(e: InputEvent) => this._updateField('evasion', Number((e.target as HTMLInputElement).value))}
              />
            </div>
          </div>
          <div class="field-group">
            <span class="field-group__label">${msg('Action Weights')}</span>
            <textarea
              class="json-field ${this._jsonErrors.has('action_weights') ? 'json-field--error' : ''}"
              .value=${JSON.stringify(this._draft.action_weights ?? {}, null, 2)}
              @input=${(e: InputEvent) => this._updateJsonField('action_weights', (e.target as HTMLTextAreaElement).value)}
            ></textarea>
          </div>
        `;

      case 'encounters':
        return html`
          <div class="field-row">
            <div class="field">
              <label class="field__label" for="field-room">${msg('Room Type')}</label>
              <select
                id="field-room"
                class="field__select"
                .value=${String(this._draft.room_type ?? '')}
                @change=${(e: Event) => this._updateField('room_type', (e.target as HTMLSelectElement).value)}
              >
                ${['combat', 'encounter', 'elite', 'boss', 'rest', 'treasure'].map(
                  (t) =>
                    html`<option value=${t} ?selected=${this._draft.room_type === t}>${t}</option>`,
                )}
              </select>
            </div>
            <div class="field">
              <label class="field__label" for="field-mind">${msg('Min Depth')}</label>
              <input id="field-mind" class="field__input" type="number" min="0"
                .value=${String(this._draft.min_depth ?? '')}
                @input=${(e: InputEvent) => this._updateField('min_depth', Number((e.target as HTMLInputElement).value))}
              />
            </div>
            <div class="field">
              <label class="field__label" for="field-maxd">${msg('Max Depth')}</label>
              <input id="field-maxd" class="field__input" type="number" min="0"
                .value=${String(this._draft.max_depth ?? '')}
                @input=${(e: InputEvent) => this._updateField('max_depth', Number((e.target as HTMLInputElement).value))}
              />
            </div>
          </div>
        `;

      case 'loot':
        return html`
          <div class="field-row">
            <div class="field">
              <label class="field__label" for="field-tier">${msg('Tier')}</label>
              <select
                id="field-tier"
                class="field__select"
                .value=${String(this._draft.tier ?? '1')}
                @change=${(e: Event) => this._updateField('tier', Number((e.target as HTMLSelectElement).value))}
              >
                <option value="1" ?selected=${this._draft.tier === 1}>${msg('1 - Minor')}</option>
                <option value="2" ?selected=${this._draft.tier === 2}>${msg('2 - Major')}</option>
                <option value="3" ?selected=${this._draft.tier === 3}>${msg('3 - Legendary')}</option>
              </select>
            </div>
            <div class="field">
              <label class="field__label" for="field-weight">${msg('Drop Weight')}</label>
              <input id="field-weight" class="field__input" type="number" min="1"
                .value=${String(this._draft.drop_weight ?? '')}
                @input=${(e: InputEvent) => this._updateField('drop_weight', Number((e.target as HTMLInputElement).value))}
              />
            </div>
            <div class="field">
              <label class="field__label" for="field-effect">${msg('Effect Type')}</label>
              <input id="field-effect" class="field__input" type="text"
                .value=${String(this._draft.effect_type ?? '')}
                @input=${(e: InputEvent) => this._updateField('effect_type', (e.target as HTMLInputElement).value)}
              />
            </div>
          </div>
          <div class="field-group">
            <span class="field-group__label">${msg('Effect Params')}</span>
            <textarea
              class="json-field ${this._jsonErrors.has('effect_params') ? 'json-field--error' : ''}"
              .value=${JSON.stringify(this._draft.effect_params ?? {}, null, 2)}
              @input=${(e: InputEvent) => this._updateJsonField('effect_params', (e.target as HTMLTextAreaElement).value)}
            ></textarea>
          </div>
        `;

      case 'abilities':
        return html`
          <div class="field-row">
            <div class="field">
              <label class="field__label" for="field-school">${msg('School')}</label>
              <select
                id="field-school"
                class="field__select"
                .value=${String(this._draft.school ?? '')}
                @change=${(e: Event) => this._updateField('school', (e.target as HTMLSelectElement).value)}
              >
                ${[
                  'spy',
                  'guardian',
                  'assassin',
                  'propagandist',
                  'infiltrator',
                  'saboteur',
                  'universal',
                ].map(
                  (s) =>
                    html`<option value=${s} ?selected=${this._draft.school === s}>${s}</option>`,
                )}
              </select>
            </div>
            <div class="field">
              <label class="field__label" for="field-apt">${msg('Min Aptitude')}</label>
              <input id="field-apt" class="field__input" type="number" min="0" max="9"
                .value=${String(this._draft.min_aptitude ?? '')}
                @input=${(e: InputEvent) => this._updateField('min_aptitude', Number((e.target as HTMLInputElement).value))}
              />
            </div>
            <div class="field">
              <label class="field__label" for="field-cd">${msg('Cooldown')}</label>
              <input id="field-cd" class="field__input" type="number" min="0"
                .value=${String(this._draft.cooldown ?? '')}
                @input=${(e: InputEvent) => this._updateField('cooldown', Number((e.target as HTMLInputElement).value))}
              />
            </div>
            <div class="field">
              <label class="field__label" for="field-targets">${msg('Targets')}</label>
              <select
                id="field-targets"
                class="field__select"
                .value=${String(this._draft.targets ?? 'single_enemy')}
                @change=${(e: Event) => this._updateField('targets', (e.target as HTMLSelectElement).value)}
              >
                ${['single_enemy', 'all_enemies', 'single_ally', 'all_allies', 'self'].map(
                  (t) =>
                    html`<option value=${t} ?selected=${this._draft.targets === t}>${t}</option>`,
                )}
              </select>
            </div>
          </div>
          <div class="field-group">
            <span class="field-group__label">${msg('Effect Params')}</span>
            <textarea
              class="json-field ${this._jsonErrors.has('effect_params') ? 'json-field--error' : ''}"
              .value=${JSON.stringify(this._draft.effect_params ?? {}, null, 2)}
              @input=${(e: InputEvent) => this._updateJsonField('effect_params', (e.target as HTMLTextAreaElement).value)}
            ></textarea>
          </div>
        `;

      default:
        return nothing;
    }
  }

  // ── Terminal preview ────────────────────────────────────────────

  private _renderPreview() {
    const previewText = this._getPreviewText();
    if (!previewText) return nothing;

    return html`
      <div class="field-group">
        <velg-terminal-preview
          .text=${previewText}
          label="TERMINAL PREVIEW (EN)"
        ></velg-terminal-preview>
      </div>
    `;
  }

  private _getPreviewText(): string {
    switch (this.contentType) {
      case 'banter':
        return String(this._draft.text_en ?? '');
      case 'encounters':
        return String(this._draft.description_en ?? '');
      case 'enemies':
        return String(this._draft.description_en ?? '');
      case 'loot':
        return String(this._draft.description_en ?? '');
      case 'entrance_texts':
      case 'barometer_texts':
        return String(this._draft.text_en ?? '');
      default:
        return '';
    }
  }

  // ── Dirty detection ─────────────────────────────────────────────

  private _isFieldDirty(key: string): boolean {
    if (!this.item) return false;
    return String(this._draft[key] ?? '') !== String(this.item[key] ?? '');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-content-editor': DungeonContentEditor;
  }
}
