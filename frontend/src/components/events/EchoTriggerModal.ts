import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { echoesApi } from '../../services/api/index.js';
import type {
  EchoVector,
  Event as SimEvent,
  Simulation,
  SimulationConnection,
} from '../../types/index.js';
import '../shared/BaseModal.js';
import { formStyles } from '../shared/form-styles.js';
import { VelgToast } from '../shared/Toast.js';

@localized()
@customElement('velg-echo-trigger-modal')
export class VelgEchoTriggerModal extends LitElement {
  static styles = [
    formStyles,
    css`
      :host {
        display: block;
      }

      .form__label {
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }

      .form__label--required::after {
        content: ' *';
        color: var(--color-danger);
      }

      .form__input,
      .form__select {
        padding: var(--space-2) var(--space-3);
      }

      .form__range-wrapper {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }

      .form__range {
        flex: 1;
        appearance: none;
        height: 6px;
        background: var(--color-surface-sunken);
        border: var(--border-width-thin) solid var(--color-border);
        cursor: pointer;
      }

      .form__range::-webkit-slider-thumb {
        appearance: none;
        width: 20px;
        height: 20px;
        background: var(--color-primary);
        border: var(--border-medium);
        cursor: pointer;
      }

      .form__range::-moz-range-thumb {
        width: 20px;
        height: 20px;
        background: var(--color-primary);
        border: var(--border-medium);
        cursor: pointer;
      }

      .form__range-value {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: var(--text-lg);
        min-width: 42px;
        text-align: center;
      }

      .preview {
        margin-top: var(--space-2);
        padding: var(--space-3);
        background: var(--color-surface-sunken);
        border: var(--border-width-thin) solid var(--color-border-light);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .preview__title {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        color: var(--color-text-secondary);
      }

      .preview__item {
        display: flex;
        align-items: center;
        gap: var(--space-1-5);
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        line-height: var(--leading-snug);
      }

      .preview__label {
        font-weight: var(--font-bold);
        color: var(--color-text-primary);
      }

      .preview__vectors {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
      }

      .preview__vector-tag {
        display: inline-flex;
        align-items: center;
        padding: var(--space-0-5) var(--space-1-5);
        font-family: var(--font-sans);
        font-size: 10px;
        font-weight: var(--font-bold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        background: var(--color-primary-bg);
        border: var(--border-width-thin) solid var(--color-primary);
        color: var(--color-primary);
      }
    `,
  ];

  @property({ type: Object }) event: SimEvent | null = null;
  @property({ type: String }) simulationId = '';
  @property({ type: Array }) simulations: Simulation[] = [];
  @property({ type: Array }) connections: SimulationConnection[] = [];
  @property({ type: Boolean }) open = false;

  @state() private _selectedTarget = '';
  @state() private _selectedVector: EchoVector | '' = '';
  @state() private _strength = 0.5;
  @state() private _saving = false;
  @state() private _error: string | null = null;

  private get _connectedSimulations(): Simulation[] {
    return this.simulations.filter((sim) => {
      if (sim.id === this.simulationId) return false;
      return this.connections.some(
        (c) =>
          c.is_active &&
          ((c.simulation_a_id === this.simulationId && c.simulation_b_id === sim.id) ||
            (c.simulation_b_id === this.simulationId && c.simulation_a_id === sim.id)),
      );
    });
  }

  private get _activeConnection(): SimulationConnection | undefined {
    if (!this._selectedTarget) return undefined;
    return this.connections.find(
      (c) =>
        c.is_active &&
        ((c.simulation_a_id === this.simulationId && c.simulation_b_id === this._selectedTarget) ||
          (c.simulation_b_id === this.simulationId && c.simulation_a_id === this._selectedTarget)),
    );
  }

  private get _availableVectors(): string[] {
    const conn = this._activeConnection;
    return conn?.bleed_vectors ?? [];
  }

  private _getVectorDisplayName(vector: string): string {
    if (!vector) return '';
    return vector.charAt(0).toUpperCase() + vector.slice(1);
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('open') && this.open) {
      this._resetForm();
    }
  }

  private _resetForm(): void {
    this._selectedTarget = '';
    this._selectedVector = '';
    this._strength = 0.5;
    this._error = null;
  }

  private _handleTargetChange(e: Event): void {
    this._selectedTarget = (e.target as HTMLSelectElement).value;
    this._selectedVector = '';
    const conn = this._activeConnection;
    if (conn) {
      this._strength = conn.strength;
    }
  }

  private _handleVectorChange(e: Event): void {
    this._selectedVector = (e.target as HTMLSelectElement).value as EchoVector | '';
  }

  private _handleStrengthChange(e: InputEvent): void {
    this._strength = Number.parseFloat((e.target as HTMLInputElement).value);
  }

  private _handleClose(): void {
    this.dispatchEvent(
      new CustomEvent('modal-close', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private async _handleSubmit(e?: Event): Promise<void> {
    e?.preventDefault();

    if (!this._selectedTarget) {
      this._error = msg('Target simulation is required');
      return;
    }

    if (!this._selectedVector) {
      this._error = msg('Echo vector is required');
      return;
    }

    if (!this.event) {
      this._error = msg('No source event selected');
      return;
    }

    this._saving = true;
    this._error = null;

    try {
      const response = await echoesApi.triggerEcho(this.simulationId, {
        source_event_id: this.event.id,
        target_simulation_id: this._selectedTarget,
        echo_vector: this._selectedVector as EchoVector,
        echo_strength: this._strength,
      });

      if (response.success) {
        VelgToast.success(msg('Echo triggered successfully'));
        this.dispatchEvent(
          new CustomEvent('echo-triggered', {
            detail: response.data,
            bubbles: true,
            composed: true,
          }),
        );
      } else {
        this._error = response.error?.message ?? msg('Failed to trigger echo');
        VelgToast.error(this._error);
      }
    } catch {
      this._error = msg('An unexpected error occurred');
      VelgToast.error(this._error);
    } finally {
      this._saving = false;
    }
  }

  private _renderPreview() {
    const conn = this._activeConnection;
    if (!conn) return nothing;

    return html`
      <div class="preview">
        <span class="preview__title">${msg('Connection Preview')}</span>
        <div class="preview__item">
          <span class="preview__label">${msg('Type:')}</span>
          <span>${conn.connection_type}</span>
        </div>
        <div class="preview__item">
          <span class="preview__label">${msg('Default Strength:')}</span>
          <span>${Math.round(conn.strength * 100)}%</span>
        </div>
        <div class="preview__item">
          <span class="preview__label">${msg('Available Vectors:')}</span>
        </div>
        <div class="preview__vectors">
          ${conn.bleed_vectors.map(
            (v) => html`
              <span class="preview__vector-tag">${this._getVectorDisplayName(v)}</span>
            `,
          )}
        </div>
      </div>
    `;
  }

  protected render() {
    const connectedSims = this._connectedSimulations;
    const availableVectors = this._availableVectors;
    const strengthPercent = Math.round(this._strength * 100);

    return html`
      <velg-base-modal
        ?open=${this.open}
        @modal-close=${this._handleClose}
      >
        <span slot="header">${msg('Trigger Echo')}</span>

        <form class="form" @submit=${this._handleSubmit}>
          ${
            this.event
              ? html`
              <div class="form__group">
                <label class="form__label">${msg('Source Event')}</label>
                <input
                  class="form__input"
                  type="text"
                  .value=${this.event.title}
                  disabled
                />
              </div>
            `
              : nothing
          }

          <div class="form__group">
            <label class="form__label form__label--required">${msg('Target Simulation')}</label>
            <select
              class="form__select"
              .value=${this._selectedTarget}
              @change=${this._handleTargetChange}
            >
              <option value="">${msg('-- Select Target --')}</option>
              ${connectedSims.map(
                (sim) => html`
                  <option value=${sim.id}>${sim.name}</option>
                `,
              )}
            </select>
          </div>

          ${
            this._selectedTarget
              ? html`
              <div class="form__group">
                <label class="form__label form__label--required">${msg('Echo Vector')}</label>
                <select
                  class="form__select"
                  .value=${this._selectedVector}
                  @change=${this._handleVectorChange}
                >
                  <option value="">${msg('-- Select Vector --')}</option>
                  ${availableVectors.map(
                    (v) => html`
                      <option value=${v}>${this._getVectorDisplayName(v)}</option>
                    `,
                  )}
                </select>
              </div>

              <div class="form__group">
                <label class="form__label">
                  ${msg(str`Strength Override (${strengthPercent}%)`)}
                </label>
                <div class="form__range-wrapper">
                  <input
                    class="form__range"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    .value=${String(this._strength)}
                    @input=${this._handleStrengthChange}
                  />
                  <span class="form__range-value">${strengthPercent}%</span>
                </div>
              </div>

              ${this._renderPreview()}
            `
              : nothing
          }

          ${this._error ? html`<div class="form__error">${this._error}</div>` : nothing}
        </form>

        <div slot="footer" class="footer">
          <button
            class="footer__btn footer__btn--cancel"
            @click=${this._handleClose}
            ?disabled=${this._saving}
          >
            ${msg('Cancel')}
          </button>
          <button
            class="footer__btn footer__btn--save"
            @click=${this._handleSubmit}
            ?disabled=${this._saving || !this._selectedTarget || !this._selectedVector}
          >
            ${this._saving ? msg('Triggering...') : msg('Trigger Echo')}
          </button>
        </div>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-echo-trigger-modal': VelgEchoTriggerModal;
  }
}
