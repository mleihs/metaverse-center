import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ForgeLoreSection } from '../../services/api/ForgeApiService.js';
import { forgeApi } from '../../services/api/ForgeApiService.js';
import { captureError } from '../../services/SentryService.js';
import { VelgToast } from '../shared/Toast.js';

interface ArcanumMeta {
  key: string;
  label: string;
  triggers: Array<{ value: string; label: string }>;
}

const EVOLVABLE_ARCANUMS: ArcanumMeta[] = [
  {
    key: 'BETA',
    label: 'Agent Classified Addenda',
    triggers: [
      { value: 'agent_recruited', label: 'Agent Recruited' },
      { value: 'agent_promoted', label: 'Agent Promoted' },
      { value: 'agent_defected', label: 'Agent Defected' },
    ],
  },
  {
    key: 'GAMMA',
    label: 'Geographic Anomalies',
    triggers: [
      { value: 'building_constructed', label: 'Building Constructed' },
      { value: 'zone_expanded', label: 'Zone Expanded' },
      { value: 'anomaly_detected', label: 'Anomaly Detected' },
    ],
  },
  {
    key: 'DELTA',
    label: 'Bleed Signature Analysis',
    triggers: [
      { value: 'resonance_event', label: 'Resonance Event' },
      { value: 'bleed_detected', label: 'Bleed Detected' },
      { value: 'containment_breach', label: 'Containment Breach' },
    ],
  },
  {
    key: 'ZETA',
    label: 'Bureau Recommendation',
    triggers: [
      { value: 'periodic', label: 'Periodic Review' },
      { value: 'threat_escalation', label: 'Threat Escalation' },
      { value: 'policy_change', label: 'Policy Change' },
    ],
  },
];

@localized()
@customElement('velg-bureau-status')
export class VelgBureauStatus extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* ── Status Panel ── */

    .bureau {
      position: relative;
      margin-top: var(--space-6);
      padding: var(--space-6);
      border: 1px solid color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
      background: color-mix(in srgb, var(--color-surface-sunken) 80%, transparent);
      overflow: hidden;
      opacity: 0;
      transform: translateY(12px);
      animation: bureau-enter 400ms ease-out forwards;
    }

    @keyframes bureau-enter {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Scanline overlay */
    .bureau::before {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(245, 158, 11, 0.03) 2px,
        rgba(245, 158, 11, 0.03) 4px
      );
      pointer-events: none;
      animation: scanline-scroll 60s linear infinite;
    }

    @keyframes scanline-scroll {
      from { background-position: 0 0; }
      to { background-position: 0 100vh; }
    }

    /* Amber border glow pulse */
    .bureau::after {
      content: '';
      position: absolute;
      inset: -1px;
      border: 1px solid var(--color-accent-amber);
      opacity: 0.4;
      animation: glow-pulse 2s ease-in-out infinite;
      pointer-events: none;
    }

    @keyframes glow-pulse {
      0%, 100% { opacity: 0.2; box-shadow: 0 0 4px rgba(245, 158, 11, 0.2); }
      50% { opacity: 0.6; box-shadow: 0 0 12px rgba(245, 158, 11, 0.3); }
    }

    .stamp {
      display: inline-block;
      padding: var(--space-1) var(--space-3);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      font-weight: 900;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--color-accent-amber);
      border: 2px solid var(--color-accent-amber);
      margin-bottom: var(--space-4);
    }

    /* ── Header Info ── */

    .bureau__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black, 900);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-primary);
      margin: 0 0 var(--space-1);
    }

    .bureau__rule {
      width: 60%;
      border: none;
      border-top: 1px solid var(--color-border);
      margin: 0 0 var(--space-3);
    }

    .bureau__meta {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      margin-bottom: var(--space-5);
    }

    .bureau__meta-line {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
    }

    .bureau__meta-value {
      color: var(--color-text-secondary);
    }

    .bureau__meta-value--active {
      color: var(--color-success);
    }

    /* ── Arcanum Slots ── */

    .bureau__slots {
      display: flex;
      flex-direction: column;
      gap: 0;
      margin-bottom: var(--space-5);
      border: 1px solid var(--color-border);
    }

    .arcanum-slot {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-border);
      opacity: 0;
      animation: slot-enter 400ms ease-out forwards;
    }

    .arcanum-slot:last-child {
      border-bottom: none;
    }

    @keyframes slot-enter {
      from { opacity: 0; transform: translateX(-8px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .arcanum-slot__indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-border);
      flex-shrink: 0;
      margin-top: 4px;
    }

    .arcanum-slot__indicator--evolved {
      background: var(--color-success);
    }

    .arcanum-slot__body {
      flex: 1;
      min-width: 0;
    }

    .arcanum-slot__header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .arcanum-slot__name {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--color-accent-amber);
    }

    .arcanum-slot__count {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      white-space: nowrap;
    }

    .arcanum-slot__label {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      color: var(--color-text-secondary);
      margin-top: 2px;
    }

    .arcanum-slot__detail {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-muted);
      margin-top: 2px;
    }

    /* ── Toggle Button ── */

    .bureau__toggle {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-accent-amber);
      background: transparent;
      border: 1px solid color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
      cursor: pointer;
      transition: all 0.2s;
      min-height: 44px;
    }

    .bureau__toggle:hover {
      border-color: var(--color-accent-amber);
      background: color-mix(in srgb, var(--color-accent-amber) 5%, transparent);
    }

    .bureau__toggle:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 2px;
    }

    .bureau__toggle-arrow {
      display: inline-block;
      transition: transform 0.2s;
      font-size: 10px;
    }

    .bureau__toggle-arrow--open {
      transform: rotate(180deg);
    }

    /* ── Evolution Form ── */

    .evo-form {
      margin-top: var(--space-4);
      padding: var(--space-4);
      border: 1px solid var(--color-border);
      background: color-mix(in srgb, var(--color-surface) 50%, transparent);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      opacity: 0;
      animation: form-reveal 300ms ease-out forwards;
    }

    @keyframes form-reveal {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .evo-form__row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .evo-form__label {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      min-width: 72px;
      flex-shrink: 0;
    }

    .evo-form__select,
    .evo-form__input {
      flex: 1;
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      letter-spacing: 0.04em;
      color: var(--color-text-primary);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      min-height: 44px;
      transition: border-color 0.2s;
    }

    .evo-form__select:focus,
    .evo-form__input:focus {
      border-color: var(--color-accent-amber);
      outline: none;
    }

    .evo-form__select:focus-visible,
    .evo-form__input:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 2px;
    }

    .evo-form__budget {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
      padding: var(--space-2) 0;
    }

    .evo-form__budget-value {
      color: var(--color-accent-amber);
    }

    .evo-form__budget-value--bypass {
      color: var(--color-success);
    }

    .evo-form__submit {
      display: inline-flex;
      align-items: center;
      align-self: flex-start;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-inverse);
      background: var(--color-accent-amber);
      border: 1px solid var(--color-accent-amber);
      cursor: pointer;
      transition: all 0.2s;
      min-height: 44px;
    }

    .evo-form__submit:hover:not(:disabled) {
      box-shadow: 0 0 16px rgba(245, 158, 11, 0.4);
      transform: translateY(-1px);
    }

    .evo-form__submit:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .evo-form__submit:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 2px;
    }

    /* ── Reduced Motion ── */

    @media (prefers-reduced-motion: reduce) {
      .bureau,
      .arcanum-slot,
      .evo-form {
        animation: none;
        opacity: 1;
        transform: none;
      }

      .bureau::before,
      .bureau::after {
        animation: none;
      }

      .bureau__toggle-arrow {
        transition: none;
      }
    }

    /* ── Mobile ── */

    @media (max-width: 480px) {
      .bureau {
        padding: var(--space-4);
      }

      .arcanum-slot {
        padding: var(--space-2) var(--space-3);
      }

      .arcanum-slot__header {
        flex-direction: column;
        gap: 0;
      }

      .evo-form {
        padding: var(--space-3);
      }

      .evo-form__row {
        flex-direction: column;
        align-items: stretch;
        gap: var(--space-1);
      }

      .evo-form__label {
        min-width: unset;
      }

      .evo-form__submit {
        width: 100%;
        justify-content: center;
      }

      .bureau__toggle {
        width: 100%;
        justify-content: center;
      }
    }
  `;

  @property({ type: String }) simulationId = '';
  @property({ attribute: false }) classifiedSections: ForgeLoreSection[] = [];
  @property({ type: Number }) regenBudgetRemaining = 3;
  @property({ type: Boolean }) hasBypass = false;

  @state() private _formOpen = false;
  @state() private _selectedArcanum = 'BETA';
  @state() private _selectedTrigger = 'agent_recruited';
  @state() private _entityName = '';
  @state() private _submitting = false;

  private _getSectionForArcanum(arcanum: string): ForgeLoreSection | undefined {
    return this.classifiedSections.find((s) => s.arcanum === arcanum && s.chapter === 'CLASSIFIED');
  }

  private _getTotalAddenda(): number {
    return EVOLVABLE_ARCANUMS.reduce((sum, a) => {
      const section = this._getSectionForArcanum(a.key);
      return sum + (section?.evolution_count ?? 0);
    }, 0);
  }

  private _getEvolvedSectionCount(): number {
    return EVOLVABLE_ARCANUMS.filter((a) => {
      const section = this._getSectionForArcanum(a.key);
      return (section?.evolution_count ?? 0) > 0;
    }).length;
  }

  private _getLastAssessment(): string {
    let latest: string | null = null;
    for (const a of EVOLVABLE_ARCANUMS) {
      const section = this._getSectionForArcanum(a.key);
      if (section?.evolved_at) {
        if (!latest || section.evolved_at > latest) {
          latest = section.evolved_at;
        }
      }
    }
    if (!latest) return msg('Initial assessment');
    try {
      return new Date(latest).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch (err) {
      captureError(err, { source: 'VelgBureauStatus._getLastAssessment' });
      return msg('Initial assessment');
    }
  }

  private _getTriggersForArcanum(arcanum: string): Array<{ value: string; label: string }> {
    return EVOLVABLE_ARCANUMS.find((a) => a.key === arcanum)?.triggers ?? [];
  }

  private _toggleForm(): void {
    this._formOpen = !this._formOpen;
  }

  private _onArcanumChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    this._selectedArcanum = select.value;
    const triggers = this._getTriggersForArcanum(this._selectedArcanum);
    this._selectedTrigger = triggers[0]?.value ?? '';
  }

  private _onTriggerChange(e: Event): void {
    this._selectedTrigger = (e.target as HTMLSelectElement).value;
  }

  private _onEntityInput(e: Event): void {
    this._entityName = (e.target as HTMLInputElement).value;
  }

  private async _submitEvolution(): Promise<void> {
    if (!this._entityName.trim() || this._submitting) return;

    this._submitting = true;
    try {
      const resp = await forgeApi.evolveDossier(
        this.simulationId,
        this._selectedArcanum,
        this._selectedTrigger,
        this._entityName.trim(),
      );

      if (resp.success) {
        VelgToast.success(msg('Bureau update requested. The addendum will appear shortly.'));
        this.dispatchEvent(
          new CustomEvent('bureau-update-requested', { bubbles: true, composed: true }),
        );
        this._entityName = '';
        this._formOpen = false;
      } else {
        VelgToast.error(resp.error?.message ?? msg('Bureau update request failed.'));
      }
    } catch (err) {
      captureError(err, { source: 'VelgBureauStatus._submitEvolution' });
      VelgToast.error(msg('Bureau update request failed.'));
    } finally {
      this._submitting = false;
    }
  }

  protected render() {
    const totalAddenda = this._getTotalAddenda();
    const evolvedCount = this._getEvolvedSectionCount();
    const lastAssessment = this._getLastAssessment();
    const triggers = this._getTriggersForArcanum(this._selectedArcanum);
    const canSubmit = this._entityName.trim().length > 0 && !this._submitting;

    return html`
      <div class="bureau" role="region" aria-label=${msg('Bureau dossier status')}>
        <div class="stamp">${msg('[DECLASSIFIED] BUREAU CLEARANCE LEVEL 4')}</div>

        <h3 class="bureau__title">${msg('Dossier Status: Active')}</h3>
        <hr class="bureau__rule" />

        <div class="bureau__meta">
          <div class="bureau__meta-line">
            ${msg('Last assessment:')}
            <span class="bureau__meta-value">${lastAssessment}</span>
          </div>
          <div class="bureau__meta-line">
            ${msg('Bureau addenda:')}
            <span class="bureau__meta-value ${totalAddenda > 0 ? 'bureau__meta-value--active' : ''}">
              ${totalAddenda} ${msg('across')} ${evolvedCount} ${msg('sections')}
            </span>
          </div>
        </div>

        <div class="bureau__slots">
          ${EVOLVABLE_ARCANUMS.map((a, i) => this._renderArcanumSlot(a, i))}
        </div>

        <button
          class="bureau__toggle"
          @click=${this._toggleForm}
          aria-expanded=${this._formOpen}
          aria-controls="bureau-evo-form"
        >
          <span class="bureau__toggle-arrow ${this._formOpen ? 'bureau__toggle-arrow--open' : ''}">&#9660;</span>
          ${msg('Request Bureau Update')}
        </button>

        ${this._formOpen ? this._renderForm(triggers, canSubmit) : nothing}
      </div>
    `;
  }

  private _renderArcanumSlot(arcanum: ArcanumMeta, index: number) {
    const section = this._getSectionForArcanum(arcanum.key);
    const count = section?.evolution_count ?? 0;
    const hasEvolved = count > 0;

    const lastLog =
      hasEvolved && section?.evolution_log?.length
        ? section.evolution_log[section.evolution_log.length - 1]
        : null;

    let detail: string;
    if (lastLog) {
      detail = `${msg('Last:')} ${lastLog.entity} (+${lastLog.words_added} ${msg('words')})`;
    } else {
      detail = msg('Awaiting field data');
    }

    return html`
      <div class="arcanum-slot" style="animation-delay: ${index * 100}ms">
        <span class="arcanum-slot__indicator ${hasEvolved ? 'arcanum-slot__indicator--evolved' : ''}"></span>
        <div class="arcanum-slot__body">
          <div class="arcanum-slot__header">
            <span class="arcanum-slot__name">${msg('Arcanum')} ${arcanum.key}</span>
            <span class="arcanum-slot__count">${count} ${msg('addenda')}</span>
          </div>
          <div class="arcanum-slot__label">${arcanum.label}</div>
          <div class="arcanum-slot__detail">${detail}</div>
        </div>
      </div>
    `;
  }

  private _renderForm(triggers: Array<{ value: string; label: string }>, canSubmit: boolean) {
    return html`
      <div class="evo-form" id="bureau-evo-form" aria-live="polite">
        <div class="evo-form__row">
          <label class="evo-form__label" for="evo-arcanum">${msg('Section')}</label>
          <select
            id="evo-arcanum"
            class="evo-form__select"
            .value=${this._selectedArcanum}
            @change=${this._onArcanumChange}
          >
            ${EVOLVABLE_ARCANUMS.map(
              (a) => html`<option value=${a.key}>${msg('Arcanum')} ${a.key} – ${a.label}</option>`,
            )}
          </select>
        </div>

        <div class="evo-form__row">
          <label class="evo-form__label" for="evo-trigger">${msg('Trigger')}</label>
          <select
            id="evo-trigger"
            class="evo-form__select"
            .value=${this._selectedTrigger}
            @change=${this._onTriggerChange}
          >
            ${triggers.map((t) => html`<option value=${t.value}>${t.label}</option>`)}
          </select>
        </div>

        <div class="evo-form__row">
          <label class="evo-form__label" for="evo-entity">${msg('Entity')}</label>
          <input
            id="evo-entity"
            class="evo-form__input"
            type="text"
            .value=${this._entityName}
            @input=${this._onEntityInput}
            placeholder=${msg('Agent name or description')}
          />
        </div>

        <div class="evo-form__budget">
          ${msg('Budget:')}
          <span class="evo-form__budget-value ${this.hasBypass ? 'evo-form__budget-value--bypass' : ''}">
            ${
              this.hasBypass
                ? msg('Unlimited')
                : html`${this.regenBudgetRemaining} ${msg('remaining (first 3 free)')}`
            }
          </span>
        </div>

        <button
          class="evo-form__submit"
          ?disabled=${!canSubmit}
          @click=${this._submitEvolution}
        >
          ${this._submitting ? msg('Requesting...') : msg('Request Update')}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-bureau-status': VelgBureauStatus;
  }
}
