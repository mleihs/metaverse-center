import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { agentsApi, buildingsApi, styleReferenceApi } from '../../services/api/index.js';
import { forgeButtonStyles, forgeFieldStyles, forgeRangeStyles } from './forge-console-styles.js';
import { VelgToast } from './Toast.js';

import './BaseModal.js';
import './VelgStyleReferenceUpload.js';

interface EntityOption {
  id: string;
  name: string;
}

/**
 * Modal form for adding a style reference image.
 * Allows choosing entity type, scope, uploading an image, and setting strength.
 *
 * Industrial Darkroom aesthetic: chip-based selectors, monospace readouts,
 * recessed panels, accent glow on active states.
 */
@localized()
@customElement('velg-style-reference-modal')
export class VelgStyleReferenceModal extends LitElement {
  static styles = [
    forgeButtonStyles,
    forgeFieldStyles,
    forgeRangeStyles,
    css`
      :host {
        --modal-max-width: 520px;
      }

      /* ── Form Layout ──────────────────────────── */

      .form {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
      }

      .form__group {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .form__label {
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-icon);
      }

      /* ── Chip Row ──────────────────────────────── */

      .chips {
        display: flex;
        gap: var(--space-2);
      }

      .chip {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1) var(--space-3);
        background: var(--color-surface-sunken);
        border: 1px solid var(--color-border);
        color: var(--color-text-tertiary);
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        cursor: pointer;
        transition: all 0.15s;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .chip:hover {
        background: var(--color-surface-raised);
      }

      .chip--active {
        border-color: var(--color-success);
        color: var(--color-success);
        box-shadow: 0 0 6px var(--color-success-glow);
      }

      /* ── Entity Select ─────────────────────────── */

      .entity-select {
        margin-top: var(--space-2);
      }

      /* ── Strength Gradient Bar ─────────────────── */

      .strength-gradient {
        height: 4px;
        background: linear-gradient(
          90deg,
          var(--color-border),
          var(--color-success)
        );
        margin-top: var(--space-1);
        opacity: 0.6;
      }

      .strength-hint {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        color: var(--color-text-muted);
        margin-top: var(--space-1);
      }

      /* ── Footer Buttons ────────────────────────── */

      .footer {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-3);
      }
    `,
  ];

  @property() simulationId = '';
  @property({ type: Boolean }) open = false;

  @state() private _entityType: 'portrait' | 'building' = 'portrait';
  @state() private _scope: 'global' | 'entity' = 'global';
  @state() private _entityId = '';
  @state() private _strength = 0.75;
  @state() private _pendingFile: File | null = null;
  @state() private _pendingUrl = '';
  @state() private _previewUrl = '';
  @state() private _saving = false;
  @state() private _entities: EntityOption[] = [];
  @state() private _loadingEntities = false;

  updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has('_scope') && this._scope === 'entity') {
      this._loadEntities();
    }
    if (changed.has('_entityType') && this._scope === 'entity') {
      this._loadEntities();
    }
  }

  private async _loadEntities() {
    this._loadingEntities = true;
    this._entities = [];
    this._entityId = '';

    const mode = appState.currentSimulationMode.value;
    if (this._entityType === 'portrait') {
      const result = await agentsApi.list(this.simulationId, mode);
      if (result.success && result.data) {
        this._entities = (result.data as { id: string; name: string }[]).map((a) => ({
          id: a.id,
          name: a.name,
        }));
      }
    } else {
      const result = await buildingsApi.list(this.simulationId, mode);
      if (result.success && result.data) {
        this._entities = (result.data as { id: string; name: string }[]).map((b) => ({
          id: b.id,
          name: b.name,
        }));
      }
    }
    this._loadingEntities = false;
  }

  private _handleReferenceChange(e: CustomEvent<{ file?: File; url?: string; action: string }>) {
    const { file, url, action } = e.detail;
    if (action === 'upload' && file) {
      this._pendingFile = file;
      this._pendingUrl = '';
      this._previewUrl = URL.createObjectURL(file);
    } else if (action === 'url' && url) {
      this._pendingUrl = url;
      this._pendingFile = null;
      this._previewUrl = url;
    } else if (action === 'delete') {
      this._pendingFile = null;
      this._pendingUrl = '';
      if (this._previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(this._previewUrl);
      }
      this._previewUrl = '';
    }
  }

  private async _handleSave() {
    if (!this._pendingFile && !this._pendingUrl) return;
    if (this._scope === 'entity' && !this._entityId) {
      VelgToast.error(msg('Please select an entity.'));
      return;
    }

    this._saving = true;
    const result = await styleReferenceApi.upload(
      this.simulationId,
      this._pendingFile ?? undefined,
      this._pendingUrl || undefined,
      this._entityType,
      this._scope,
      this._scope === 'entity' ? this._entityId : undefined,
      this._strength,
    );

    this._saving = false;

    if (result.success) {
      VelgToast.success(msg('Style reference saved.'));
      this._close();
    } else {
      VelgToast.error(result.error?.message ?? msg('Failed to save reference.'));
    }
  }

  private _close() {
    if (this._previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this._previewUrl);
    }
    this._previewUrl = '';
    this._pendingFile = null;
    this._pendingUrl = '';
    this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  }

  protected render() {
    const canSave =
      (this._pendingFile || this._pendingUrl) && (this._scope === 'global' || this._entityId);

    return html`
      <velg-base-modal .open=${this.open} @modal-close=${this._close}>
        <span slot="header">${msg('Add Style Reference')}</span>

        <div class="form">
          <!-- Entity Type -->
          <div class="form__group">
            <span class="form__label">${msg('Image Category')}</span>
            <div class="chips">
              <button
                class="chip ${this._entityType === 'portrait' ? 'chip--active' : ''}"
                @click=${() => {
                  this._entityType = 'portrait';
                }}
              >${msg('Portraits')}</button>
              <button
                class="chip ${this._entityType === 'building' ? 'chip--active' : ''}"
                @click=${() => {
                  this._entityType = 'building';
                }}
              >${msg('Buildings')}</button>
            </div>
          </div>

          <!-- Scope -->
          <div class="form__group">
            <span class="form__label">${msg('Scope')}</span>
            <div class="chips">
              <button
                class="chip ${this._scope === 'global' ? 'chip--active' : ''}"
                @click=${() => {
                  this._scope = 'global';
                }}
              >${msg('Global')}</button>
              <button
                class="chip ${this._scope === 'entity' ? 'chip--active' : ''}"
                @click=${() => {
                  this._scope = 'entity';
                }}
              >${msg('Specific Entity')}</button>
            </div>
            ${
              this._scope === 'entity'
                ? html`
                <div class="entity-select">
                  <select
                    class="field__input"
                    .value=${this._entityId}
                    ?disabled=${this._loadingEntities}
                    @change=${(e: Event) => {
                      this._entityId = (e.target as HTMLSelectElement).value;
                    }}
                  >
                    <option value="">
                      ${this._loadingEntities ? msg('Loading...') : msg('Select entity...')}
                    </option>
                    ${this._entities.map(
                      (ent) => html`<option value=${ent.id}>${ent.name}</option>`,
                    )}
                  </select>
                </div>
              `
                : nothing
            }
          </div>

          <!-- Upload -->
          <div class="form__group">
            <span class="form__label">${msg('Reference Image')}</span>
            <velg-style-reference-upload
              .referenceUrl=${this._previewUrl}
              .entityType=${this._entityType}
              .loading=${this._saving}
              .aspectHint=${this._entityType === 'portrait' ? msg('Recommended: 3:4 aspect ratio') : msg('Recommended: 4:3 aspect ratio')}
              @reference-change=${this._handleReferenceChange}
            ></velg-style-reference-upload>
          </div>

          <!-- Strength -->
          <div class="form__group">
            <div class="range-field">
              <div class="range-field__header">
                <label class="range-field__label">${msg('Reference Strength')}</label>
                <span class="range-field__readout">${this._strength.toFixed(2)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.05"
                .value=${String(this._strength)}
                @input=${(e: Event) => {
                  this._strength = Number.parseFloat((e.target as HTMLInputElement).value);
                }}
              />
            </div>
            <div class="strength-gradient"></div>
            <span class="strength-hint">
              ${msg('Lower values use the reference loosely. Higher values match it closely.')}
            </span>
          </div>
        </div>

        <div slot="footer" class="footer">
          <button class="btn btn--ghost" @click=${this._close}>
            ${msg('Cancel')}
          </button>
          <button
            class="btn btn--next"
            ?disabled=${!canSave || this._saving}
            @click=${this._handleSave}
          >
            ${this._saving ? msg('Saving...') : msg('Save')}
          </button>
        </div>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-style-reference-modal': VelgStyleReferenceModal;
  }
}
