/**
 * Deploy Operative Modal — 3-step tactical wizard.
 *
 * Steps:
 *   1. Asset   — select agent from your simulation
 *   2. Mission — choose operative type (spy, saboteur, propagandist, assassin, infiltrator)
 *   3. Target  — select embassy route, target zone/building/agent, confirm
 *
 * Aesthetic: classified dossier / tactical operations brief. Dark theme,
 * amber accent (#f59e0b), scan-line texture, targeting ring for success probability.
 * Continuation of the military command console language from EpochCreationWizard.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  agentsApi,
  buildingsApi,
  embassiesApi,
  epochsApi,
  locationsApi,
} from '../../services/api/index.js';
import type {
  Agent,
  Building,
  Embassy,
  OperativeMission,
  OperativeType,
  Zone,
} from '../../types/index.js';
import '../shared/BaseModal.js';
import { formStyles } from '../shared/form-styles.js';
import '../shared/VelgAvatar.js';
import { VelgToast } from '../shared/Toast.js';

type Step = 'asset' | 'mission' | 'target';

const STEPS: Step[] = ['asset', 'mission', 'target'];

interface OperativeTypeInfo {
  type: OperativeType;
  icon: string;
  cost: number;
  duration: string;
  effect: string;
  needsTarget: 'building' | 'agent' | 'embassy' | 'zone' | 'none';
}

function getOperativeTypes(): OperativeTypeInfo[] {
  return [
    {
      type: 'spy',
      icon: '\u{1F50D}',
      cost: 3,
      duration: msg('3 cycles'),
      effect: msg('Reveals target health metrics, zone stability, and active operatives.'),
      needsTarget: 'none',
    },
    {
      type: 'saboteur',
      icon: '\u{1F4A3}',
      cost: 5,
      duration: msg('1 cycle deploy'),
      effect: msg('Degrades one target building condition by one step.'),
      needsTarget: 'building',
    },
    {
      type: 'propagandist',
      icon: '\u{1F4E2}',
      cost: 4,
      duration: msg('2 cycles'),
      effect: msg('Generates a destabilizing event (impact 6-8) in target zone.'),
      needsTarget: 'zone',
    },
    {
      type: 'assassin',
      icon: '\u{1F5E1}',
      cost: 8,
      duration: msg('2 cycle deploy'),
      effect: msg('Wounds target agent — reduces relationships by 2, removes ambassador status.'),
      needsTarget: 'agent',
    },
    {
      type: 'infiltrator',
      icon: '\u{1F47B}',
      cost: 6,
      duration: msg('3 cycles'),
      effect: msg('Reduces target embassy effectiveness by 50% for 3 cycles.'),
      needsTarget: 'embassy',
    },
    {
      type: 'guardian',
      icon: '\u{1F6E1}',
      cost: 3,
      duration: msg('Permanent'),
      effect: msg(
        'Detects hostile operatives entering your simulation. +15% counter-intel success.',
      ),
      needsTarget: 'none',
    },
  ];
}

function getStepLabels(): Record<Step, string> {
  return {
    asset: msg('Asset'),
    mission: msg('Mission'),
    target: msg('Target'),
  };
}

@localized()
@customElement('velg-deploy-operative-modal')
export class VelgDeployOperativeModal extends LitElement {
  static styles = [
    formStyles,
    css`
      :host {
        display: block;
      }

      /* Override modal for dark tactical theme */
      velg-base-modal {
        --color-surface-raised: var(--color-gray-950);
        --color-surface-header: var(--color-gray-950);
        --color-text-primary: var(--color-gray-100);
        --color-text-muted: var(--color-gray-500);
        --color-border: var(--color-gray-700);
        --color-surface: var(--color-gray-800);
      }

      /* ── Phase Indicator ─────────────────── */

      .phases {
        display: flex;
        gap: 0;
        margin-bottom: var(--space-5);
        border: 1px solid var(--color-gray-700);
        overflow: hidden;
        position: relative;
      }

      /* Scan-line overlay on phase bar */
      .phases::after {
        content: '';
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          0deg,
          transparent,
          transparent 1px,
          rgba(245 158 11 / 0.03) 1px,
          rgba(245 158 11 / 0.03) 2px
        );
        pointer-events: none;
      }

      .phase {
        flex: 1;
        padding: var(--space-2) var(--space-2);
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        text-align: center;
        color: var(--color-gray-500);
        background: var(--color-gray-950);
        border-right: 1px solid var(--color-gray-700);
        position: relative;
        transition: all 0.3s ease;
        overflow: hidden;
      }

      .phase:last-child {
        border-right: none;
      }

      .phase--active {
        color: var(--color-gray-950);
        background: var(--color-warning);
        font-weight: 700;
      }

      .phase--active::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(255 255 255 / 0.25) 50%,
          transparent 100%
        );
        animation: phase-sweep 2s ease-in-out infinite;
      }

      @keyframes phase-sweep {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }

      .phase--done {
        color: var(--color-warning);
        background: rgba(245 158 11 / 0.1);
      }

      .phase--done::before {
        content: '\u2713 ';
      }

      /* ── Console Form ────────────────────── */

      .console-form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }

      .field__label {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-gray-400);
      }

      .field__select {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-gray-700);
        background: var(--color-gray-950);
        color: var(--color-gray-100);
        cursor: pointer;
        transition: border-color 0.2s;
      }

      .field__select:focus {
        outline: none;
        border-color: var(--color-warning);
        box-shadow: 0 0 0 1px rgba(245 158 11 / 0.3);
      }

      .field__select option {
        background: var(--color-gray-800);
        color: var(--color-gray-100);
      }

      /* ── Agent Dossier Card ──────────────── */

      .dossier {
        display: flex;
        gap: var(--space-4);
        padding: var(--space-4);
        border: 1px solid var(--color-gray-700);
        background: var(--color-gray-800);
        position: relative;
        overflow: hidden;
        transition: border-color 0.3s;
      }

      .dossier::before {
        content: '';
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          0deg,
          transparent,
          transparent 3px,
          rgba(255 255 255 / 0.01) 3px,
          rgba(255 255 255 / 0.01) 4px
        );
        pointer-events: none;
      }

      .dossier--selected {
        border-color: var(--color-warning);
        box-shadow: 0 0 12px rgba(245 158 11 / 0.15);
      }

      .dossier__portrait {
        flex-shrink: 0;
      }

      .dossier__info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }

      .dossier__name {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: var(--text-base);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        color: var(--color-gray-100);
      }

      .dossier__meta {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        color: var(--color-gray-500);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .dossier__warning {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        color: var(--color-danger);
        margin-top: var(--space-1);
        padding: var(--space-1) var(--space-2);
        border: 1px solid rgba(239 68 68 / 0.3);
        background: rgba(239 68 68 / 0.05);
      }

      /* ── Mission Type Cards ──────────────── */

      .mission-grid {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .mission-card {
        display: grid;
        grid-template-columns: 40px 1fr auto;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3);
        border: 1px solid var(--color-gray-700);
        background: var(--color-gray-950);
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
      }

      .mission-card::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: transparent;
        transition: background 0.2s;
      }

      .mission-card:hover {
        border-color: var(--color-gray-500);
        transform: translateX(2px);
      }

      .mission-card--selected {
        border-color: var(--color-warning);
        background: rgba(245 158 11 / 0.05);
      }

      .mission-card--selected::before {
        background: var(--color-warning);
      }

      .mission-card__icon {
        font-size: var(--text-xl);
        text-align: center;
        line-height: 1;
        filter: grayscale(0.3);
        transition: filter 0.2s, transform 0.2s;
      }

      .mission-card--selected .mission-card__icon {
        filter: grayscale(0);
        transform: scale(1.1);
      }

      .mission-card__body {
        min-width: 0;
      }

      .mission-card__name {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-sm);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        color: var(--color-gray-100);
      }

      .mission-card__effect {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        color: var(--color-gray-500);
        margin-top: 2px;
        line-height: 1.4;
      }

      .mission-card__cost {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
        flex-shrink: 0;
      }

      .mission-card__rp {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: var(--text-lg);
        color: var(--color-warning);
      }

      .mission-card__duration {
        font-family: var(--font-mono, monospace);
        font-size: 9px;
        color: var(--color-gray-500);
        text-transform: uppercase;
      }

      .mission-card--disabled {
        opacity: 0.4;
        pointer-events: none;
      }

      /* ── Targeting Ring (Success %) ──────── */

      .targeting {
        display: flex;
        align-items: center;
        gap: var(--space-5);
        padding: var(--space-4);
        border: 1px solid var(--color-gray-700);
        background: var(--color-gray-950);
        margin-top: var(--space-3);
      }

      .targeting__ring {
        position: relative;
        width: 80px;
        height: 80px;
        flex-shrink: 0;
      }

      .targeting__ring svg {
        width: 80px;
        height: 80px;
        transform: rotate(-90deg);
      }

      .targeting__ring-bg {
        fill: none;
        stroke: var(--color-gray-800);
        stroke-width: 6;
      }

      .targeting__ring-fill {
        fill: none;
        stroke-width: 6;
        stroke-linecap: butt;
        transition: stroke-dashoffset 0.8s cubic-bezier(0.22, 1, 0.36, 1),
          stroke 0.3s;
      }

      .targeting__pct {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: var(--text-lg);
      }

      .targeting__details {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }

      .targeting__label {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-gray-500);
      }

      .targeting__factor {
        display: flex;
        justify-content: space-between;
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        color: var(--color-gray-400);
      }

      .targeting__factor-val {
        font-weight: 700;
      }

      .targeting__factor-val--positive {
        color: var(--color-success);
      }

      .targeting__factor-val--negative {
        color: var(--color-danger);
      }

      /* ── Confirmation Summary ────────────── */

      .summary {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        padding: var(--space-4);
        border: 1px solid var(--color-gray-700);
        background: var(--color-gray-800);
        position: relative;
      }

      .summary::before {
        content: 'CLASSIFIED';
        position: absolute;
        top: var(--space-2);
        right: var(--space-3);
        font-family: var(--font-brutalist);
        font-size: 9px;
        font-weight: var(--font-black);
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: var(--color-danger);
        opacity: 0.6;
      }

      .summary__row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--space-1) 0;
        border-bottom: 1px dashed var(--color-gray-800);
      }

      .summary__row:last-child {
        border-bottom: none;
      }

      .summary__key {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-gray-500);
      }

      .summary__val {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        font-weight: 700;
        color: var(--color-gray-100);
        text-align: right;
      }

      .summary__val--amber {
        color: var(--color-warning);
      }

      .summary__val--red {
        color: var(--color-danger);
      }

      .summary__val--green {
        color: var(--color-success);
      }

      /* ── RP Cost Badge ──────────────────── */

      .rp-cost {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1) var(--space-2);
        border: 1px solid rgba(245 158 11 / 0.4);
        background: rgba(245 158 11 / 0.08);
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: var(--text-sm);
        color: var(--color-warning);
      }

      /* ── Error ──────────────────────────── */

      .error {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        color: var(--color-danger);
        padding: var(--space-2) var(--space-3);
        border: 1px solid rgba(239 68 68 / 0.3);
        background: rgba(239 68 68 / 0.05);
        margin-top: var(--space-2);
      }

      /* ── Footer ─────────────────────────── */

      .footer-inner {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
      }

      .btn-back {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-gray-700);
        background: transparent;
        color: var(--color-gray-400);
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-back:hover {
        border-color: var(--color-gray-500);
        color: var(--color-gray-100);
      }

      .btn-next {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: var(--text-sm);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        padding: var(--space-2) var(--space-5);
        border: 2px solid var(--color-warning);
        background: transparent;
        color: var(--color-warning);
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-next:hover:not(:disabled) {
        background: var(--color-warning);
        color: var(--color-gray-950);
        box-shadow: 0 0 16px rgba(245 158 11 / 0.3);
      }

      .btn-next:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }

      .btn-deploy {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: var(--text-sm);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        padding: var(--space-2) var(--space-6);
        border: 2px solid var(--color-warning);
        background: var(--color-warning);
        color: var(--color-gray-950);
        cursor: pointer;
        position: relative;
        overflow: hidden;
        transition: all 0.2s;
      }

      .btn-deploy:hover:not(:disabled) {
        box-shadow:
          0 0 20px rgba(245 158 11 / 0.4),
          0 0 40px rgba(245 158 11 / 0.15);
        transform: translateY(-1px);
      }

      .btn-deploy::after {
        content: '';
        position: absolute;
        top: -30%;
        left: -80%;
        width: 40%;
        height: 160%;
        background: linear-gradient(
          90deg,
          transparent,
          rgba(255 255 255 / 0.3),
          transparent
        );
        transform: skewX(-20deg);
        animation: deploy-shimmer 3s ease-in-out infinite;
      }

      @keyframes deploy-shimmer {
        0%, 70% { left: -80%; }
        100% { left: 180%; }
      }

      .btn-deploy:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .btn-deploy:disabled::after {
        display: none;
      }

      /* ── Guardian banner ─────────────────── */

      .guardian-note {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        color: var(--color-success);
        padding: var(--space-2) var(--space-3);
        border: 1px solid rgba(74 222 128 / 0.3);
        background: rgba(74 222 128 / 0.05);
        margin-top: var(--space-2);
      }

      .phase-gate-notice {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        color: var(--color-success);
        padding: var(--space-2) var(--space-3);
        border: 1px solid rgba(74 222 128 / 0.25);
        background: rgba(74 222 128 / 0.06);
      }

      /* ── Microanimations ─────────────────── */

      @keyframes card-enter {
        from {
          opacity: 0;
          transform: translateX(-6px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      .mission-card {
        opacity: 0;
        animation: card-enter 0.3s ease-out forwards;
      }

      .mission-card:nth-child(1) { animation-delay: 40ms; }
      .mission-card:nth-child(2) { animation-delay: 80ms; }
      .mission-card:nth-child(3) { animation-delay: 120ms; }
      .mission-card:nth-child(4) { animation-delay: 160ms; }
      .mission-card:nth-child(5) { animation-delay: 200ms; }
    `,
  ];

  @property({ type: Boolean }) open = false;
  @property({ attribute: false }) epochId = '';
  @property({ attribute: false }) simulationId = '';
  @property({ type: Number }) currentRp = 0;
  @property({ attribute: false }) epochPhase = 'lobby';

  @state() private _step: Step = 'asset';
  @state() private _loading = false;
  @state() private _error = '';

  // Step 1: Asset
  @state() private _agents: Agent[] = [];
  @state() private _selectedAgentId = '';

  // Step 2: Mission
  @state() private _selectedType: OperativeType | '' = '';

  // Step 3: Target
  @state() private _embassies: Embassy[] = [];
  @state() private _selectedEmbassyId = '';
  @state() private _targetZones: Zone[] = [];
  @state() private _selectedZoneId = '';
  @state() private _targetBuildings: Building[] = [];
  @state() private _selectedBuildingId = '';
  @state() private _targetAgents: Agent[] = [];
  @state() private _selectedTargetAgentId = '';

  // ── Lifecycle ──────────────────────────────────────

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('open') && this.open) {
      this._step = 'asset';
      this._loading = false;
      this._error = '';
      this._selectedAgentId = '';
      this._selectedType = '';
      this._selectedEmbassyId = '';
      this._selectedZoneId = '';
      this._selectedBuildingId = '';
      this._selectedTargetAgentId = '';
      this._embassies = [];
      this._targetZones = [];
      this._targetBuildings = [];
      this._targetAgents = [];
      this._loadAgents();
      this._loadEmbassies();
    }
  }

  // ── Data Loading ───────────────────────────────────

  private async _loadAgents(): Promise<void> {
    if (!this.simulationId) return;
    try {
      const resp = await agentsApi.list(this.simulationId, { limit: '100' });
      if (resp.success && resp.data) {
        const items = Array.isArray(resp.data)
          ? resp.data
          : ((resp.data as { data?: Agent[] }).data ?? []);
        this._agents = items;
      }
    } catch {
      this._agents = [];
    }
  }

  private async _loadEmbassies(): Promise<void> {
    if (!this.simulationId) return;
    try {
      const resp = await embassiesApi.listForSimulation(this.simulationId);
      if (resp.success && resp.data) {
        const items = Array.isArray(resp.data)
          ? resp.data
          : ((resp.data as { data?: Embassy[] }).data ?? []);
        // Only active embassies (the operative pipeline)
        this._embassies = items.filter((e) => e.status === 'active');
      }
    } catch {
      this._embassies = [];
    }
  }

  private async _loadTargetData(targetSimId: string): Promise<void> {
    try {
      const [zonesResp, buildingsResp, agentsResp] = await Promise.all([
        locationsApi.listZones(targetSimId),
        buildingsApi.listPublic(targetSimId, { limit: '100' }),
        agentsApi.listPublic(targetSimId, { limit: '100' }),
      ]);

      if (zonesResp.success && zonesResp.data) {
        this._targetZones = Array.isArray(zonesResp.data)
          ? zonesResp.data
          : ((zonesResp.data as { data?: Zone[] }).data ?? []);
      }

      if (buildingsResp.success && buildingsResp.data) {
        const items = Array.isArray(buildingsResp.data)
          ? buildingsResp.data
          : ((buildingsResp.data as { data?: Building[] }).data ?? []);
        this._targetBuildings = items;
      }

      if (agentsResp.success && agentsResp.data) {
        const items = Array.isArray(agentsResp.data)
          ? agentsResp.data
          : ((agentsResp.data as { data?: Agent[] }).data ?? []);
        this._targetAgents = items;
      }
    } catch {
      // fail silently
    }
  }

  // ── Computed ───────────────────────────────────────

  private _getSelectedAgent(): Agent | undefined {
    return this._agents.find((a) => a.id === this._selectedAgentId);
  }

  private _getSelectedMissionType(): OperativeTypeInfo | undefined {
    return getOperativeTypes().find((t) => t.type === this._selectedType);
  }

  private _getSelectedEmbassy(): Embassy | undefined {
    return this._embassies.find((e) => e.id === this._selectedEmbassyId);
  }

  private _getTargetSimulationId(): string | undefined {
    const embassy = this._getSelectedEmbassy();
    if (!embassy) return undefined;
    // The target is whichever side isn't ours
    return embassy.simulation_a_id === this.simulationId
      ? embassy.simulation_b_id
      : embassy.simulation_a_id;
  }

  private _getTargetSimulationName(): string {
    const embassy = this._getSelectedEmbassy();
    if (!embassy) return '';
    if (embassy.simulation_a_id === this.simulationId) {
      return embassy.simulation_b?.name ?? '';
    }
    return embassy.simulation_a?.name ?? '';
  }

  private _estimateSuccess(): number {
    // Client-side estimate (real calculation happens server-side)
    return 0.5;
  }

  private _isGuardian(): boolean {
    return this._selectedType === 'guardian';
  }

  // ── Navigation ─────────────────────────────────────

  private _next(): void {
    const idx = STEPS.indexOf(this._step);
    if (idx < STEPS.length - 1) {
      this._step = STEPS[idx + 1];
      // When entering target step, load target data
      if (this._step === 'target' && !this._isGuardian()) {
        const targetSimId = this._getTargetSimulationId();
        if (targetSimId) {
          this._loadTargetData(targetSimId);
        }
      }
    }
  }

  private _back(): void {
    const idx = STEPS.indexOf(this._step);
    if (idx > 0) {
      this._step = STEPS[idx - 1];
    }
  }

  private _close(): void {
    this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  }

  // ── Validation ─────────────────────────────────────

  private _canAdvance(): boolean {
    switch (this._step) {
      case 'asset':
        return this._selectedAgentId !== '';
      case 'mission':
        if (this._selectedType === '') return false;
        // Check RP cost
        {
          const info = this._getSelectedMissionType();
          if (info && info.cost > this.currentRp) return false;
        }
        // Guardians + non-targeted types skip embassy requirement
        if (this._isGuardian()) return true;
        return this._selectedEmbassyId !== '';
      case 'target':
        return !this._loading;
      default:
        return false;
    }
  }

  // ── Deploy ─────────────────────────────────────────

  private async _handleDeploy(): Promise<void> {
    if (this._loading || !this.epochId || !this.simulationId) return;

    const missionType = this._getSelectedMissionType();
    if (!missionType) return;

    this._loading = true;
    this._error = '';

    const data: Record<string, unknown> = {
      agent_id: this._selectedAgentId,
      operative_type: this._selectedType,
    };

    if (!this._isGuardian()) {
      data.target_simulation_id = this._getTargetSimulationId();
      data.embassy_id = this._selectedEmbassyId;
    }

    // Add specific target based on mission type
    if (missionType.needsTarget === 'building' && this._selectedBuildingId) {
      data.target_entity_id = this._selectedBuildingId;
      data.target_entity_type = 'building';
    } else if (missionType.needsTarget === 'agent' && this._selectedTargetAgentId) {
      data.target_entity_id = this._selectedTargetAgentId;
      data.target_entity_type = 'agent';
    } else if (missionType.needsTarget === 'embassy' && this._selectedEmbassyId) {
      data.target_entity_id = this._selectedEmbassyId;
      data.target_entity_type = 'embassy';
    }

    if (this._selectedZoneId) {
      data.target_zone_id = this._selectedZoneId;
    }

    try {
      const resp = await epochsApi.deployOperative(
        this.epochId,
        this.simulationId,
        data as {
          agent_id: string;
          operative_type: string;
          target_simulation_id?: string;
          embassy_id?: string;
          target_entity_id?: string;
          target_entity_type?: string;
          target_zone_id?: string;
        },
      );

      if (resp.success) {
        VelgToast.success(
          msg(
            str`Operative deployed. Mission ${(resp.data as OperativeMission).operative_type} initiated.`,
          ),
        );
        this.dispatchEvent(
          new CustomEvent('operative-deployed', {
            detail: resp.data,
            bubbles: true,
            composed: true,
          }),
        );
        this._close();
      } else {
        this._error = (resp.error as { message?: string })?.message ?? msg('Deployment failed.');
      }
    } catch {
      this._error = msg('Deployment failed.');
    } finally {
      this._loading = false;
    }
  }

  // ── Embassy Change ─────────────────────────────────

  private async _handleEmbassyChange(e: Event): Promise<void> {
    this._selectedEmbassyId = (e.target as HTMLSelectElement).value;
    this._selectedZoneId = '';
    this._selectedBuildingId = '';
    this._selectedTargetAgentId = '';
    this._targetZones = [];
    this._targetBuildings = [];
    this._targetAgents = [];
  }

  // ── Render ─────────────────────────────────────────

  protected render() {
    if (!this.open) return nothing;

    return html`
      <velg-base-modal .open=${this.open} @modal-close=${this._close}>
        <span slot="header">${msg('Deploy Operative')}</span>

        ${this._renderPhases()}

        ${this._step === 'asset' ? this._renderAssetStep() : nothing}
        ${this._step === 'mission' ? this._renderMissionStep() : nothing}
        ${this._step === 'target' ? this._renderTargetStep() : nothing}

        ${this._error ? html`<div class="error">${this._error}</div>` : nothing}

        <div slot="footer">${this._renderFooter()}</div>
      </velg-base-modal>
    `;
  }

  // ── Phase Indicator ────────────────────────────────

  private _renderPhases() {
    const labels = getStepLabels();
    const currentIdx = STEPS.indexOf(this._step);

    return html`
      <div class="phases">
        ${STEPS.map(
          (s, i) => html`
            <div class="phase ${
              i === currentIdx ? 'phase--active' : i < currentIdx ? 'phase--done' : ''
            }">
              ${labels[s]}
            </div>
          `,
        )}
      </div>
    `;
  }

  // ── Step 1: Asset ──────────────────────────────────

  private _renderAssetStep() {
    const selectedAgent = this._getSelectedAgent();

    return html`
      <div class="console-form">
        <div class="field">
          <label class="field__label">${msg('Select Agent')}</label>
          <select
            class="field__select"
            .value=${this._selectedAgentId}
            @change=${(e: Event) => {
              this._selectedAgentId = (e.target as HTMLSelectElement).value;
            }}
          >
            <option value="">${msg('-- Choose operative --')}</option>
            ${this._agents.map((a) => html`<option value=${a.id}>${a.name}</option>`)}
          </select>
        </div>

        ${selectedAgent ? this._renderAgentDossier(selectedAgent) : nothing}
      </div>
    `;
  }

  private _renderAgentDossier(agent: Agent) {
    return html`
      <div class="dossier dossier--selected">
        <div class="dossier__portrait">
          <velg-avatar
            name=${agent.name}
            .src=${agent.portrait_image_url ?? null}
            size="sm"
          ></velg-avatar>
        </div>
        <div class="dossier__info">
          <span class="dossier__name">${agent.name}</span>
          ${agent.system ? html`<span class="dossier__meta">${msg('System')}: ${agent.system}</span>` : nothing}
          ${
            agent.professions && agent.professions.length > 0
              ? html`<span class="dossier__meta">
                ${msg('Professions')}: ${agent.professions.map((p) => p.profession).join(', ')}
              </span>`
              : nothing
          }
          ${
            agent.character
              ? html`<span class="dossier__meta" style="color: var(--color-gray-400); font-style: italic;">
                "${agent.character.length > 100 ? `${agent.character.substring(0, 100)}...` : agent.character}"
              </span>`
              : nothing
          }
          <div class="dossier__warning">
            ${msg('This agent will leave their current post while deployed.')}
          </div>
        </div>
      </div>
    `;
  }

  // ── Step 2: Mission ────────────────────────────────

  private _renderMissionStep() {
    const allTypes = getOperativeTypes();
    const isFoundation = this.epochPhase === 'foundation';
    const types = isFoundation ? allTypes.filter((t) => t.type === 'guardian') : allTypes;

    return html`
      <div class="console-form">
        <div class="field">
          <label class="field__label">${msg('Mission Type')}</label>
        </div>

        ${
          isFoundation
            ? html`<div class="phase-gate-notice">${msg('Foundation phase: only defensive guardians may be deployed.')}</div>`
            : nothing
        }

        <div class="mission-grid">
          ${types.map((t) => this._renderMissionCard(t))}
        </div>

        ${
          this._selectedType && !this._isGuardian()
            ? html`
              <div class="field">
                <label class="field__label">${msg('Deploy via Embassy')}</label>
                <select
                  class="field__select"
                  .value=${this._selectedEmbassyId}
                  @change=${this._handleEmbassyChange}
                >
                  <option value="">${msg('-- Select embassy route --')}</option>
                  ${this._embassies.map((emb) => {
                    const targetName =
                      emb.simulation_a_id === this.simulationId
                        ? emb.simulation_b?.name
                        : emb.simulation_a?.name;
                    return html`<option value=${emb.id}>
                      ${targetName ?? msg('Unknown')} (${emb.bleed_vector ?? '?'})
                    </option>`;
                  })}
                </select>
              </div>
            `
            : nothing
        }

        ${
          this._isGuardian()
            ? html`<div class="guardian-note">
                ${msg('Guardians deploy to your OWN simulation. No embassy required.')}
              </div>`
            : nothing
        }

        <div class="rp-cost">
          RP: ${this.currentRp}
          ${
            this._selectedType
              ? html` / ${msg('Cost')}: ${this._getSelectedMissionType()?.cost ?? 0}`
              : nothing
          }
        </div>
      </div>
    `;
  }

  private _renderMissionCard(info: OperativeTypeInfo) {
    const isSelected = this._selectedType === info.type;
    const cantAfford = info.cost > this.currentRp;

    return html`
      <div
        class="mission-card ${isSelected ? 'mission-card--selected' : ''} ${cantAfford ? 'mission-card--disabled' : ''}"
        @click=${() => {
          if (!cantAfford) this._selectedType = info.type;
        }}
      >
        <span class="mission-card__icon">${info.icon}</span>
        <div class="mission-card__body">
          <div class="mission-card__name">${info.type}</div>
          <div class="mission-card__effect">${info.effect}</div>
        </div>
        <div class="mission-card__cost">
          <span class="mission-card__rp">${info.cost}</span>
          <span class="mission-card__duration">${info.duration}</span>
        </div>
      </div>
    `;
  }

  // ── Step 3: Target ─────────────────────────────────

  private _renderTargetStep() {
    const missionInfo = this._getSelectedMissionType();
    const agent = this._getSelectedAgent();

    if (!missionInfo || !agent) return nothing;

    // Guardian: no target needed
    if (this._isGuardian()) {
      return this._renderGuardianConfirm(agent, missionInfo);
    }

    const targetSimName = this._getTargetSimulationName();

    return html`
      <div class="console-form">
        ${
          missionInfo.needsTarget === 'zone' || missionInfo.needsTarget === 'building'
            ? html`
              <div class="field">
                <label class="field__label">${msg('Target Zone')}</label>
                <select
                  class="field__select"
                  .value=${this._selectedZoneId}
                  @change=${(e: Event) => {
                    this._selectedZoneId = (e.target as HTMLSelectElement).value;
                  }}
                >
                  <option value="">${msg('-- Select zone --')}</option>
                  ${this._targetZones.map(
                    (z) => html`<option value=${z.id}>${z.name} (${z.security_level})</option>`,
                  )}
                </select>
              </div>
            `
            : nothing
        }

        ${
          missionInfo.needsTarget === 'building'
            ? html`
              <div class="field">
                <label class="field__label">${msg('Target Building')}</label>
                <select
                  class="field__select"
                  .value=${this._selectedBuildingId}
                  @change=${(e: Event) => {
                    this._selectedBuildingId = (e.target as HTMLSelectElement).value;
                  }}
                >
                  <option value="">${msg('-- Select building --')}</option>
                  ${this._targetBuildings.map(
                    (b) => html`<option value=${b.id}>${b.name} (${b.building_type})</option>`,
                  )}
                </select>
              </div>
            `
            : nothing
        }

        ${
          missionInfo.needsTarget === 'agent'
            ? html`
              <div class="field">
                <label class="field__label">${msg('Target Agent')}</label>
                <select
                  class="field__select"
                  .value=${this._selectedTargetAgentId}
                  @change=${(e: Event) => {
                    this._selectedTargetAgentId = (e.target as HTMLSelectElement).value;
                  }}
                >
                  <option value="">${msg('-- Select target --')}</option>
                  ${this._targetAgents.map((a) => html`<option value=${a.id}>${a.name}</option>`)}
                </select>
              </div>
            `
            : nothing
        }

        ${this._renderTargetingSummary(agent, missionInfo, targetSimName)}
      </div>
    `;
  }

  private _renderGuardianConfirm(agent: Agent, info: OperativeTypeInfo) {
    return html`
      <div class="console-form">
        <div class="summary">
          <div class="summary__row">
            <span class="summary__key">${msg('Operative')}</span>
            <span class="summary__val">${agent.name}</span>
          </div>
          <div class="summary__row">
            <span class="summary__key">${msg('Mission')}</span>
            <span class="summary__val">${info.icon} ${info.type}</span>
          </div>
          <div class="summary__row">
            <span class="summary__key">${msg('Deployment')}</span>
            <span class="summary__val--green">${msg('Your simulation (permanent)')}</span>
          </div>
          <div class="summary__row">
            <span class="summary__key">${msg('Effect')}</span>
            <span class="summary__val" style="font-size: 10px; max-width: 200px;">
              ${msg('+20% enemy detection per guardian in zone')}
            </span>
          </div>
          <div class="summary__row">
            <span class="summary__key">${msg('Cost')}</span>
            <span class="summary__val summary__val--amber">${info.cost} RP</span>
          </div>
        </div>
      </div>
    `;
  }

  private _renderTargetingSummary(agent: Agent, info: OperativeTypeInfo, targetSimName: string) {
    const successPct = Math.round(this._estimateSuccess() * 100);
    const circumference = 2 * Math.PI * 34;
    const dashoffset = circumference * (1 - successPct / 100);
    const ringColor = successPct >= 70 ? '#4ade80' : successPct >= 40 ? '#f59e0b' : '#ef4444';
    const pctColor =
      successPct >= 70
        ? 'summary__val--green'
        : successPct >= 40
          ? 'summary__val--amber'
          : 'summary__val--red';

    return html`
      <div class="targeting">
        <div class="targeting__ring">
          <svg viewBox="0 0 80 80">
            <circle class="targeting__ring-bg" cx="40" cy="40" r="34" />
            <circle
              class="targeting__ring-fill"
              cx="40"
              cy="40"
              r="34"
              stroke=${ringColor}
              stroke-dasharray=${circumference}
              stroke-dashoffset=${dashoffset}
            />
          </svg>
          <span class="targeting__pct ${pctColor}">${successPct}%</span>
        </div>
        <div class="targeting__details">
          <span class="targeting__label">${msg('Mission Assessment')}</span>
          <div class="targeting__factor">
            <span>${msg('Base probability')}</span>
            <span class="targeting__factor-val">50%</span>
          </div>
          <div class="targeting__factor">
            <span>${msg('Agent qualification')}</span>
            <span class="targeting__factor-val targeting__factor-val--positive">+?%</span>
          </div>
          <div class="targeting__factor">
            <span>${msg('Zone security')}</span>
            <span class="targeting__factor-val targeting__factor-val--negative">-?%</span>
          </div>
          <div class="targeting__factor">
            <span>${msg('Embassy effectiveness')}</span>
            <span class="targeting__factor-val targeting__factor-val--positive">+?%</span>
          </div>
        </div>
      </div>

      <div class="summary">
        <div class="summary__row">
          <span class="summary__key">${msg('Operative')}</span>
          <span class="summary__val">${agent.name}</span>
        </div>
        <div class="summary__row">
          <span class="summary__key">${msg('Mission')}</span>
          <span class="summary__val">${info.icon} ${info.type}</span>
        </div>
        <div class="summary__row">
          <span class="summary__key">${msg('Target')}</span>
          <span class="summary__val">${targetSimName}</span>
        </div>
        <div class="summary__row">
          <span class="summary__key">${msg('Cost')}</span>
          <span class="summary__val summary__val--amber">${info.cost} RP</span>
        </div>
      </div>
    `;
  }

  // ── Footer ─────────────────────────────────────────

  private _renderFooter() {
    if (this._step === 'asset') {
      return html`
        <div class="footer-inner">
          <button class="btn-back" @click=${this._close}>${msg('Cancel')}</button>
          <button
            class="btn-next"
            ?disabled=${!this._canAdvance()}
            @click=${this._next}
          >
            ${msg('Next')}
          </button>
        </div>
      `;
    }

    if (this._step === 'target') {
      return html`
        <div class="footer-inner">
          <button class="btn-back" @click=${this._back}>${msg('Back')}</button>
          <button
            class="btn-deploy"
            ?disabled=${this._loading}
            @click=${this._handleDeploy}
          >
            ${this._loading ? msg('Deploying...') : msg('Deploy Operative')}
          </button>
        </div>
      `;
    }

    // Mission step
    return html`
      <div class="footer-inner">
        <button class="btn-back" @click=${this._back}>${msg('Back')}</button>
        <button
          class="btn-next"
          ?disabled=${!this._canAdvance()}
          @click=${this._next}
        >
          ${msg('Next')}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-deploy-operative-modal': VelgDeployOperativeModal;
  }
}
