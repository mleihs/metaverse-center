import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleReferenceApi } from '../../services/api/index.js';
import type { StyleReferenceInfo } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import { VelgToast } from './Toast.js';

import './VelgStyleReferenceModal.js';

/**
 * Management panel listing all configured style references for a simulation.
 * Groups references by entity type (portraits / buildings).
 *
 * Industrial Darkroom aesthetic: compact reference rows with thumbnails,
 * scope badges, strength micro-bars.
 */
@localized()
@customElement('velg-style-reference-panel')
export class VelgStyleReferencePanel extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* ── Header ──────────────────────────────── */

    .panel__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--space-4);
    }

    .panel__title {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-success);
      margin: 0;
    }

    .panel__add-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1) var(--space-2);
      background: transparent;
      border: 1px solid var(--color-border);
      color: var(--color-success);
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.15s;
    }

    .panel__add-btn:hover {
      background: var(--color-surface-raised);
      border-color: var(--color-success);
    }

    /* ── Section Divider ─────────────────────── */

    .section {
      margin-bottom: var(--space-4);
    }

    .section__label {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-muted);
      padding-bottom: var(--space-2);
      border-bottom: 1px solid var(--color-border-light);
      margin-bottom: var(--space-2);
    }

    /* ── Reference Row ───────────────────────── */

    .ref-row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) 0;
      border-bottom: 1px solid var(--color-border-light);
      transition: background 0.15s;
    }

    .ref-row:last-child {
      border-bottom: none;
    }

    .ref-row:hover {
      background: rgba(255 255 255 / 0.02);
    }

    .ref-row__thumb {
      width: 48px;
      height: 48px;
      aspect-ratio: 1;
      object-fit: cover;
      border: 1px solid var(--color-border);
      flex-shrink: 0;
    }

    .ref-row__info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .ref-row__type {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      color: var(--color-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .ref-row__scope {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
    }

    .ref-row__scope--global {
      color: var(--color-success);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .ref-row__scope--entity {
      color: var(--color-icon);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── Strength Micro-bar ──────────────────── */

    .strength-bar {
      width: 60px;
      height: 4px;
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      flex-shrink: 0;
      position: relative;
    }

    .strength-bar__fill {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      background: var(--color-success);
      transition: width 0.2s;
    }

    /* ── Delete Button ───────────────────────── */

    .ref-row__delete {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: transparent;
      border: 1px solid transparent;
      color: var(--color-text-muted);
      cursor: pointer;
      padding: 0;
      flex-shrink: 0;
      opacity: 0;
      transition: all 0.15s;
    }

    .ref-row:hover .ref-row__delete {
      opacity: 1;
    }

    .ref-row__delete:hover {
      border-color: var(--color-danger);
      color: var(--color-danger);
    }

    /* ── Empty State ─────────────────────────── */

    .empty {
      padding: var(--space-6);
      text-align: center;
      border: 1px dashed var(--color-border);
      background: var(--color-surface-sunken);
    }

    .empty__text {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  `;

  @property() simulationId = '';

  @state() private _portraitRefs: StyleReferenceInfo[] = [];
  @state() private _buildingRefs: StyleReferenceInfo[] = [];
  @state() private _showModal = false;
  @state() private _loading = false;

  connectedCallback() {
    super.connectedCallback();
    if (this.simulationId) {
      this._loadReferences();
    }
  }

  updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has('simulationId') && this.simulationId) {
      this._loadReferences();
    }
  }

  private async _loadReferences() {
    this._loading = true;
    const [portraits, buildings] = await Promise.all([
      styleReferenceApi.list(this.simulationId, 'portrait'),
      styleReferenceApi.list(this.simulationId, 'building'),
    ]);
    this._portraitRefs = portraits.success ? (portraits.data ?? []) : [];
    this._buildingRefs = buildings.success ? (buildings.data ?? []) : [];
    this._loading = false;
  }

  private async _handleDelete(ref: StyleReferenceInfo) {
    const result = await styleReferenceApi.remove(
      this.simulationId,
      ref.entity_type,
      ref.scope,
      ref.entity_id,
    );
    if (result.success) {
      VelgToast.success(msg('Reference removed.'));
      await this._loadReferences();
    } else {
      VelgToast.error(result.error?.message ?? msg('Failed to remove reference.'));
    }
  }

  private _handleModalClose() {
    this._showModal = false;
    this._loadReferences();
  }

  private _renderRefRow(ref: StyleReferenceInfo) {
    const scopeLabel =
      ref.scope === 'global' ? msg('Global') : (ref.entity_name ?? ref.entity_id ?? '');

    return html`
      <div class="ref-row">
        <img class="ref-row__thumb" src=${ref.reference_image_url} alt=${`${ref.entity_type} style reference${ref.entity_name ? ` — ${ref.entity_name}` : ''}`} loading="lazy" />
        <div class="ref-row__info">
          <span class="ref-row__type">
            ${ref.entity_type === 'portrait' ? msg('Portraits') : msg('Buildings')}
          </span>
          <span class="ref-row__scope ${ref.scope === 'global' ? 'ref-row__scope--global' : 'ref-row__scope--entity'}">
            ${scopeLabel}
          </span>
        </div>
        <div class="strength-bar" title=${`${Math.round(ref.strength * 100)}%`}>
          <div class="strength-bar__fill" style="width:${ref.strength * 100}%"></div>
        </div>
        <button
          class="ref-row__delete"
          @click=${() => this._handleDelete(ref)}
          title=${msg('Delete')}
        >${icons.trash(14)}</button>
      </div>
    `;
  }

  protected render() {
    const hasRefs = this._portraitRefs.length > 0 || this._buildingRefs.length > 0;

    return html`
      <div class="panel__header">
        <span class="panel__title">${msg('Style References')}</span>
        <button class="panel__add-btn" @click=${() => {
          this._showModal = true;
        }}>
          + ${msg('Add Reference')}
        </button>
      </div>

      ${
        this._loading
          ? html`<div class="empty"><span class="empty__text">${msg('Loading...')}</span></div>`
          : !hasRefs
            ? html`<div class="empty"><span class="empty__text">${msg('No style references configured')}</span></div>`
            : html`
            ${
              this._portraitRefs.length > 0
                ? html`
                <div class="section">
                  <div class="section__label">${msg('Portraits')}</div>
                  ${this._portraitRefs.map((r) => this._renderRefRow(r))}
                </div>
              `
                : nothing
            }
            ${
              this._buildingRefs.length > 0
                ? html`
                <div class="section">
                  <div class="section__label">${msg('Buildings')}</div>
                  ${this._buildingRefs.map((r) => this._renderRefRow(r))}
                </div>
              `
                : nothing
            }
          `
      }

      ${
        this._showModal
          ? html`
          <velg-style-reference-modal
            .simulationId=${this.simulationId}
            .open=${true}
            @modal-close=${this._handleModalClose}
          ></velg-style-reference-modal>
        `
          : nothing
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-style-reference-panel': VelgStyleReferencePanel;
  }
}
