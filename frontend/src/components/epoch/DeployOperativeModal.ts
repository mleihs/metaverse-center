/**
 * Deploy Operative Modal — "The War Table" TCG redesign.
 *
 * Full-screen overlay with three zone slots (Asset → Mission → Target).
 * Agent card hand with fan geometry at bottom. Every choice is a card
 * laid down with fly + slam animations. Deploy sequence: charge → freeze
 * → release → stamp → close.
 *
 * Same properties/events contract as the previous modal — no changes
 * needed in EpochCommandCenter.
 */

import { localized, msg, str } from '@lit/localize';
import { html, LitElement, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { appState } from '../../services/AppStateManager.js';
import {
  agentsApi,
  buildingsApi,
  embassiesApi,
  epochsApi,
  locationsApi,
} from '../../services/api/index.js';
import { captureError } from '../../services/SentryService.js';
import type {
  Agent,
  AgentAptitude,
  AptitudeSet,
  Building,
  Embassy,
  OperativeMission,
  OperativeType,
  Zone,
} from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import {
  OPERATIVE_COLORS as OP_COLORS,
  OPERATIVE_RP_COSTS,
} from '../../utils/operative-constants.js';
import { focusFirstElement, trapFocus } from '../shared/focus-trap.js';
import '../shared/VelgGameCard.js';
import './MissionCard.js';
import '../shared/VelgAvatar.js';
import '../shared/VelgAptitudeBars.js';
import { VelgToast } from '../shared/Toast.js';
import { deployOperativeStyles } from './deploy-operative-styles.js';

// ── Types & Constants ────────────────────────────────

type Step = 'asset' | 'mission' | 'target';
type DeployPhase = 'idle' | 'charging' | 'frozen' | 'releasing' | 'resolved';

interface OperativeTypeInfo {
  type: OperativeType;
  cost: number;
  duration: string;
  effect: string;
  needsTarget: 'building' | 'agent' | 'embassy' | 'zone' | 'none';
}

function getOperativeTypes(): OperativeTypeInfo[] {
  return [
    {
      type: 'spy',
      cost: OPERATIVE_RP_COSTS.spy,
      duration: msg('3 cycles'),
      effect: msg('Reveals target health metrics, zone stability, and active operatives.'),
      needsTarget: 'none',
    },
    {
      type: 'saboteur',
      cost: OPERATIVE_RP_COSTS.saboteur,
      duration: msg('1 cycle deploy'),
      effect: msg('Degrades one target building condition by one step.'),
      needsTarget: 'building',
    },
    {
      type: 'propagandist',
      cost: OPERATIVE_RP_COSTS.propagandist,
      duration: msg('2 cycles'),
      effect: msg('Generates a destabilizing event (impact 6-8) in target zone.'),
      needsTarget: 'zone',
    },
    {
      type: 'assassin',
      cost: OPERATIVE_RP_COSTS.assassin,
      duration: msg('2 cycle deploy'),
      effect: msg('Wounds target agent – reduces relationships by 2, removes ambassador status.'),
      needsTarget: 'agent',
    },
    {
      type: 'infiltrator',
      cost: OPERATIVE_RP_COSTS.infiltrator,
      duration: msg('3 cycles'),
      effect: msg('Reduces target embassy effectiveness by 50% for 3 cycles.'),
      needsTarget: 'embassy',
    },
    {
      type: 'guardian',
      cost: OPERATIVE_RP_COSTS.guardian,
      duration: msg('Permanent'),
      effect: msg(
        'Detects hostile operatives entering your simulation. +15% counter-intel success.',
      ),
      needsTarget: 'none',
    },
  ];
}

@localized()
@customElement('velg-deploy-operative-modal')
export class VelgDeployOperativeModal extends LitElement {
  static styles = deployOperativeStyles;

  // ── Properties (same contract as before) ────────────

  @property({ type: Boolean }) open = false;
  @property({ attribute: false }) epochId = '';
  @property({ attribute: false }) simulationId = '';
  @property({ type: Number }) currentRp = 0;
  @property({ attribute: false }) epochPhase = 'lobby';
  @property({ attribute: false }) deployedAgentIds: string[] = [];

  // ── Internal state ──────────────────────────────────

  @state() private _step: Step = 'asset';
  @state() private _loading = false;
  @state() private _error = '';
  @state() private _dealt = false;

  // Asset
  @state() private _agents: Agent[] = [];
  @state() private _selectedAgentId = '';
  @state() private _hoveredAgentId = '';
  @state() private _aptitudeMap: Map<string, AptitudeSet> = new Map();

  // Mission
  @state() private _selectedType: OperativeType | '' = '';

  // Target
  @state() private _embassies: Embassy[] = [];
  @state() private _selectedEmbassyId = '';
  @state() private _targetZones: Zone[] = [];
  @state() private _selectedZoneId = '';
  @state() private _targetBuildings: Building[] = [];
  @state() private _selectedBuildingId = '';
  @state() private _targetAgents: Agent[] = [];
  @state() private _selectedTargetAgentId = '';

  // Slam animation tracking
  @state() private _slamZone: Step | null = null;
  @state() private _slamColor = '';

  // Deploy animation
  @state() private _deployPhase: DeployPhase = 'idle';

  // Drag & drop
  @state() private _dragOverZone: Step | null = null;

  // ── Lifecycle ───────────────────────────────────────

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this._deployPhase === 'idle') this._close();
    if (e.key === 'Tab') {
      trapFocus(e, this.shadowRoot?.querySelector('.overlay'), this);
    }
  };

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('keydown', this._onKeyDown);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._onKeyDown);
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('open') && this.open) {
      this._step = 'asset';
      this._loading = false;
      this._error = '';
      this._dealt = false;
      this._selectedAgentId = '';
      this._hoveredAgentId = '';
      this._selectedType = '';
      this._selectedEmbassyId = '';
      this._selectedZoneId = '';
      this._selectedBuildingId = '';
      this._selectedTargetAgentId = '';
      this._embassies = [];
      this._targetZones = [];
      this._targetBuildings = [];
      this._targetAgents = [];
      this._aptitudeMap = new Map();
      this._slamZone = null;
      this._slamColor = '';
      this._deployPhase = 'idle';
      this._loadAgents();
      this._loadEmbassies();
      requestAnimationFrame(() => {
        this._dealt = true;
        focusFirstElement(this.shadowRoot);
      });
    }
  }

  // ── Data Loading ────────────────────────────────────

  private async _loadAgents(): Promise<void> {
    if (!this.simulationId) return;
    try {
      const mode = appState.currentSimulationMode.value;
      const [agentResp, aptResp] = await Promise.all([
        agentsApi.list(this.simulationId, mode, { limit: '100' }),
        agentsApi.getAllAptitudes(this.simulationId, mode),
      ]);

      if (agentResp.success && agentResp.data) {
        this._agents = agentResp.data as Agent[];
      }

      if (aptResp.success && aptResp.data) {
        const map = new Map<string, AptitudeSet>();
        for (const row of aptResp.data as AgentAptitude[]) {
          if (!map.has(row.agent_id)) {
            map.set(row.agent_id, {
              spy: 6,
              guardian: 6,
              saboteur: 6,
              propagandist: 6,
              infiltrator: 6,
              assassin: 6,
            });
          }
          const set = map.get(row.agent_id);
          if (set) set[row.operative_type as OperativeType] = row.aptitude_level;
        }
        this._aptitudeMap = map;
      }
    } catch (err) {
      captureError(err, { source: 'DeployOperativeModal._loadAgents' });
      this._agents = [];
    }
  }

  private async _loadEmbassies(): Promise<void> {
    if (!this.simulationId) return;
    try {
      const resp = await embassiesApi.listForSimulation(
        this.simulationId,
        appState.currentSimulationMode.value,
      );
      if (resp.success && resp.data) {
        this._embassies = (resp.data as Embassy[]).filter((e) => e.status === 'active');
      }
    } catch (err) {
      captureError(err, { source: 'DeployOperativeModal._loadEmbassies' });
      this._embassies = [];
    }
  }

  private async _loadTargetData(targetSimId: string): Promise<void> {
    try {
      // Target sim — the user is not guaranteed to be a member, so fetch
      // everything via the public endpoints.
      const [zonesResp, buildingsResp, agentsResp] = await Promise.all([
        locationsApi.listZones(targetSimId, 'public'),
        buildingsApi.listPublic(targetSimId, { limit: '100' }),
        agentsApi.listPublic(targetSimId, { limit: '100' }),
      ]);

      if (zonesResp.success && zonesResp.data) {
        this._targetZones = zonesResp.data as Zone[];
      }
      if (buildingsResp.success && buildingsResp.data) {
        this._targetBuildings = buildingsResp.data as Building[];
      }
      if (agentsResp.success && agentsResp.data) {
        this._targetAgents = agentsResp.data as Agent[];
      }
    } catch (err) {
      captureError(err, { source: 'DeployOperativeModal._loadTargetData' });
    }
  }

  // ── Computed ────────────────────────────────────────

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

  private _isGuardian(): boolean {
    return this._selectedType === 'guardian';
  }

  /** Guardian + spy need no entity target (zone/building/agent). Spy still needs embassy route. */
  private _needsNoTarget(): boolean {
    return this._selectedType === 'spy' || this._selectedType === 'guardian';
  }

  /** Only guardians need no embassy route at all (self-deploy). */
  private _needsNoEmbassy(): boolean {
    return this._selectedType === 'guardian';
  }

  /** Infiltrator targets the embassy itself — no further target selection needed */
  private _isEmbassyTarget(): boolean {
    return this._selectedType === 'infiltrator';
  }

  private _isOperationReady(): boolean {
    if (!this._selectedAgentId || !this._selectedType) return false;
    const info = this._getSelectedMissionType();
    if (!info || info.cost > this.currentRp) return false;
    if (this._needsNoEmbassy()) return true;
    if (!this._selectedEmbassyId) return false;
    if (this._needsNoTarget()) return true;
    switch (info.needsTarget) {
      case 'building':
        return this._selectedBuildingId !== '';
      case 'agent':
        return this._selectedTargetAgentId !== '';
      case 'embassy':
        return true; // embassy itself is the target
      case 'zone':
        return this._selectedZoneId !== '';
      default:
        return true;
    }
  }

  private _estimateSuccess(): {
    total: number;
    base: number;
    aptBonus: number;
    zonePenalty: number;
    embBonus: number;
    hasHiddenModifiers: boolean;
  } {
    const base = 0.55;
    let aptBonus = 0;
    let zonePenalty = 0;
    let embBonus = 0;

    if (this._selectedAgentId && this._selectedType) {
      const apt = this._aptitudeMap.get(this._selectedAgentId);
      if (apt) {
        const val = apt[this._selectedType as keyof AptitudeSet] as number | undefined;
        if (typeof val === 'number') {
          aptBonus = val * 0.03;
        }
      }
    }

    if (this._selectedZoneId) {
      const zone = this._targetZones.find((z) => z.id === this._selectedZoneId);
      if (zone) {
        const SECURITY_MAP: Record<string, number> = {
          fortress: 10.0,
          maximum: 10.0,
          high: 8.5,
          guarded: 7.0,
          moderate: 5.5,
          medium: 5.5,
          low: 4.0,
          contested: 3.0,
          lawless: 2.0,
        };
        zonePenalty = (SECURITY_MAP[zone.security_level] ?? 5.5) * 0.05;
      }
    }

    if (this._selectedEmbassyId) {
      // Embassy effectiveness is backend-hidden (fog of war) — surface only the
      // flat presence bonus. When the deploy endpoint receives the embassy_id
      // it applies the full effectiveness multiplier server-side.
      embBonus = 0.15;
    }

    // Guardian + resonance modifiers intentionally hidden (fog of war)
    const total = Math.max(0.05, Math.min(0.95, base + aptBonus - zonePenalty + embBonus));
    return { total, base, aptBonus, zonePenalty, embBonus, hasHiddenModifiers: true };
  }

  private _getFitLevel(aptitude: number): { label: string; css: string } {
    if (aptitude >= 7) return { label: msg('Good'), css: 'good' };
    if (aptitude >= 5) return { label: msg('Fair'), css: 'fair' };
    return { label: msg('Poor'), css: 'poor' };
  }

  private _fanGeometry(index: number, total: number): { rot: number; y: number } {
    if (total <= 1) return { rot: 0, y: 0 };
    const center = (total - 1) / 2;
    const maxRot = Math.min(30, total * 5);
    const rot = (index - center) * (maxRot / total);
    const y = Math.abs(index - center) * 8;
    return { rot, y };
  }

  private _getBestAptitude(apt: AptitudeSet): { type: OperativeType; level: number } {
    const types: OperativeType[] = [
      'spy',
      'guardian',
      'saboteur',
      'propagandist',
      'infiltrator',
      'assassin',
    ];
    let best: OperativeType = 'spy';
    let bestLevel = 0;
    for (const t of types) {
      if (apt[t] > bestLevel) {
        bestLevel = apt[t];
        best = t;
      }
    }
    return { type: best, level: bestLevel };
  }

  private _getAgentRarity(agent: Agent): 'common' | 'rare' | 'legendary' {
    if (agent.is_ambassador) return 'legendary';
    const apt = this._aptitudeMap.get(agent.id);
    if (apt) {
      for (const val of Object.values(apt)) {
        if (val >= 9) return 'legendary';
      }
    }
    if (agent.data_source === 'ai') return 'rare';
    return 'common';
  }

  // ── Actions ─────────────────────────────────────────

  private _selectAgent(agentId: string): void {
    if (this.deployedAgentIds.includes(agentId)) return;
    this._selectedAgentId = agentId;
    this._hoveredAgentId = '';
    this._step = 'mission';
    this._triggerSlam('asset', '');
  }

  private _selectMission(type: OperativeType): void {
    const info = getOperativeTypes().find((t) => t.type === type);
    if (!info || info.cost > this.currentRp) return;
    this._selectedType = type;
    this._triggerSlam('mission', OP_COLORS[type] ?? 'var(--color-primary)');

    if (this._needsNoEmbassy()) {
      this._step = 'target';
    } else if (this._needsNoTarget() && this._selectedEmbassyId) {
      // Spy: embassy already selected, go straight to target
      this._step = 'target';
    } else if (this._isEmbassyTarget() && this._selectedEmbassyId) {
      // Infiltrator: embassy IS the target, auto-fill and slam
      this._step = 'target';
      this._triggerSlam('target', OP_COLORS[type] ?? '#a78bfa'); // lint-color-ok
    } else if (this._selectedEmbassyId) {
      this._step = 'target';
      const targetSimId = this._getTargetSimulationId();
      if (targetSimId) this._loadTargetData(targetSimId);
    }
  }

  private _selectEmbassy(embassyId: string): void {
    this._selectedEmbassyId = embassyId;
    this._selectedZoneId = '';
    this._selectedBuildingId = '';
    this._selectedTargetAgentId = '';
    this._targetZones = [];
    this._targetBuildings = [];
    this._targetAgents = [];

    if (this._selectedType) {
      this._step = 'target';
      if (this._isEmbassyTarget() || this._needsNoTarget()) {
        // Infiltrator: embassy IS the target. Spy: no entity target needed.
        this._triggerSlam('target', OP_COLORS[this._selectedType] ?? '#a78bfa'); // lint-color-ok
      } else {
        const targetSimId = this._getTargetSimulationId();
        if (targetSimId) this._loadTargetData(targetSimId);
      }
    }
  }

  private _selectTarget(id: string, entityType: string): void {
    if (entityType === 'zone') this._selectedZoneId = id;
    else if (entityType === 'building') this._selectedBuildingId = id;
    else if (entityType === 'agent') this._selectedTargetAgentId = id;
    this._triggerSlam('target', '');
  }

  // ── Drag & drop ──────────────────────────────────────

  private _onAgentDragStart(e: DragEvent, agentId: string): void {
    e.dataTransfer?.setData('text/agent-id', agentId);
  }

  private _onMissionDragStart(e: DragEvent, type: OperativeType): void {
    e.dataTransfer?.setData('text/mission-type', type);
  }

  private _onZoneDragOver(e: DragEvent, zone: Step): void {
    e.preventDefault();
    if (zone !== this._step) return;
    this._dragOverZone = zone;
  }

  private _onZoneDragLeave(): void {
    this._dragOverZone = null;
  }

  private _onZoneDrop(e: DragEvent, zone: Step): void {
    e.preventDefault();
    this._dragOverZone = null;
    if (zone !== this._step) return;

    const agentId = e.dataTransfer?.getData('text/agent-id');
    if (agentId && zone === 'asset') {
      if (!this.deployedAgentIds.includes(agentId)) {
        this._selectAgent(agentId);
      }
      return;
    }

    const missionType = e.dataTransfer?.getData('text/mission-type');
    if (missionType && zone === 'mission') {
      this._selectMission(missionType as OperativeType);
    }
  }

  private _removeZone(zone: Step): void {
    if (zone === 'asset') {
      this._selectedAgentId = '';
      this._selectedType = '';
      this._selectedEmbassyId = '';
      this._selectedZoneId = '';
      this._selectedBuildingId = '';
      this._selectedTargetAgentId = '';
      this._step = 'asset';
    } else if (zone === 'mission') {
      this._selectedType = '';
      this._selectedEmbassyId = '';
      this._selectedZoneId = '';
      this._selectedBuildingId = '';
      this._selectedTargetAgentId = '';
      this._step = 'mission';
    } else if (zone === 'target') {
      this._selectedZoneId = '';
      this._selectedBuildingId = '';
      this._selectedTargetAgentId = '';
      this._step = 'target';
    }
  }

  private _triggerSlam(zone: Step, color: string): void {
    this._slamZone = zone;
    this._slamColor = color;
    setTimeout(() => {
      this._slamZone = null;
    }, 450);
  }

  private _close(): void {
    this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  }

  // ── Deploy ──────────────────────────────────────────

  private async _handleDeploy(): Promise<void> {
    if (this._loading || this._deployPhase !== 'idle' || !this.epochId || !this.simulationId)
      return;

    const missionType = this._getSelectedMissionType();
    if (!missionType || !this._isOperationReady()) return;

    // Start animation + API call simultaneously
    this._deployPhase = 'charging';
    this._loading = true;
    this._error = '';

    const data: Record<string, unknown> = {
      agent_id: this._selectedAgentId,
      operative_type: this._selectedType,
    };

    if (!this._isGuardian()) {
      const targetSimId = this._getTargetSimulationId();
      if (targetSimId) data.target_simulation_id = targetSimId;
      if (this._selectedEmbassyId) data.embassy_id = this._selectedEmbassyId;
    }

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
      const [resp] = await Promise.all([
        epochsApi.deployOperative(
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
        ),
        this._runDeployAnimation(),
      ]);

      if (resp.success) {
        const m = resp.data as OperativeMission;
        const agentName = m.agents?.name ?? msg('Operative');
        const targetName = (m as OperativeMission & { target_sim?: { name: string } }).target_sim
          ?.name;
        const zoneName = (m as OperativeMission & { target_zone?: { name: string } }).target_zone
          ?.name;
        const prob =
          m.success_probability != null ? ` — ${Math.round(m.success_probability * 100)}%` : '';
        const target = zoneName && targetName ? `${zoneName}, ${targetName}` : (targetName ?? '');
        VelgToast.success(msg(str`DISPATCH CONFIRMED: ${agentName} → ${target}${prob}`));
        this.dispatchEvent(
          new CustomEvent('operative-deployed', {
            detail: resp.data,
            bubbles: true,
            composed: true,
          }),
        );
        // Close after stamp finishes
        await this._delay(500);
        this._close();
      } else {
        this._deployPhase = 'idle';
        this._error = (resp.error as { message?: string })?.message ?? msg('Deployment failed.');
      }
    } catch (err) {
      captureError(err, { source: 'DeployOperativeModal._handleDeploy' });
      this._deployPhase = 'idle';
      this._error = msg('Deployment failed.');
    } finally {
      this._loading = false;
    }
  }

  private async _runDeployAnimation(): Promise<void> {
    // Charge: 400ms
    await this._delay(400);
    // Freeze: 200ms
    this._deployPhase = 'frozen';
    await this._delay(200);
    // Release: 400ms
    this._deployPhase = 'releasing';
    await this._delay(400);
    // Resolved: stamp
    this._deployPhase = 'resolved';
    await this._delay(800);
  }

  private _delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ── Render ──────────────────────────────────────────

  protected render() {
    if (!this.open) return nothing;

    const overlayClasses = classMap({
      overlay: true,
      'overlay--charging': this._deployPhase === 'charging',
      'overlay--frozen': this._deployPhase === 'frozen',
      'overlay--releasing': this._deployPhase === 'releasing',
    });

    return html`
			<div class=${overlayClasses} role="dialog" aria-modal="true" aria-label=${msg('Deploy Operative')}>
				${this._renderHeader()}
				${this._renderTable()}
				${this._renderFooter()}

				<!-- Deploy animation overlays -->
				<div class="flash ${this._deployPhase === 'releasing' ? 'flash--active' : ''}"></div>
				<div class="dispatch-stamp ${this._deployPhase === 'resolved' ? 'dispatch-stamp--active' : ''}">
					${msg('MISSION DISPATCHED')}
				</div>
			</div>
		`;
  }

  // ── Header ──────────────────────────────────────────

  private _renderHeader() {
    const needsEmbassy =
      this._selectedType && !['guardian'].includes(this._selectedType) && !this._selectedEmbassyId;
    const stepLabel =
      this._step === 'asset'
        ? msg('Select an agent from your roster')
        : this._step === 'mission'
          ? needsEmbassy && this._selectedType
            ? msg('Select embassy route')
            : msg('Choose a mission type')
          : msg('Select a target');

    return html`
			<div class="header">
				<div class="header__left">
					<span class="header__title">${msg('Deploy Operative')}</span>
					<span class="header__subtitle">${stepLabel}</span>
				</div>
				<div style="display:flex;align-items:center;gap:var(--space-3)">
					<span class="header__rp">RP: ${this.currentRp}</span>
					<button
						class="header__close"
						@click=${this._close}
						aria-label=${msg('Cancel')}
					>${icons.close(18)}</button>
				</div>
			</div>
		`;
  }

  // ── War Table (zones) ───────────────────────────────

  private _renderTable() {
    const agent = this._getSelectedAgent();
    const missionInfo = this._getSelectedMissionType();
    const isReady = this._isOperationReady();

    // Determine target display name
    let targetName = '';
    if (this._isEmbassyTarget() && this._selectedEmbassyId) {
      // Infiltrator: embassy is the target — show target simulation name
      const emb = this._getSelectedEmbassy();
      if (emb) {
        targetName =
          (emb.simulation_a_id === this.simulationId
            ? emb.simulation_b?.name
            : emb.simulation_a?.name) ?? msg('Embassy');
      }
    } else if (this._selectedZoneId) {
      targetName = this._targetZones.find((z) => z.id === this._selectedZoneId)?.name ?? '';
    } else if (this._selectedBuildingId) {
      targetName = this._targetBuildings.find((b) => b.id === this._selectedBuildingId)?.name ?? '';
    } else if (this._selectedTargetAgentId) {
      targetName = this._targetAgents.find((a) => a.id === this._selectedTargetAgentId)?.name ?? '';
    }
    const targetSimName = this._getTargetSimulationName();

    return html`
			<div class="table">
				<div class="zones" aria-label=${msg('Operation briefing zones')}>
					<!-- ASSET ZONE -->
					${this._renderZone(
            'asset',
            msg('Asset'),
            !!agent,
            this._step === 'asset',
            false,
            agent
              ? html`
								${(() => {
                  const apt = this._aptitudeMap.get(agent.id) ?? null;
                  const best = apt ? this._getBestAptitude(apt) : null;
                  const subtitle = [agent.primary_profession, agent.gender]
                    .filter(Boolean)
                    .join(' \u00b7 ');
                  return html`<velg-game-card
									type="agent"
									size="sm"
									name=${agent.name}
									.imageUrl=${agent.portrait_image_url ?? ''}
									.primaryStat=${best?.level ?? null}
									.rarity=${this._getAgentRarity(agent)}
									.aptitudes=${apt}
									.subtitle=${subtitle}
									.interactive=${false}
								></velg-game-card>`;
                })()}
								${(() => {
                  const apt = this._selectedType ? this._aptitudeMap.get(agent.id) : undefined;
                  if (!apt || !this._selectedType) return nothing;
                  const fit = this._getFitLevel(apt[this._selectedType as OperativeType]);
                  return html`<span class="zone__fit zone__fit--${fit.css}">
										${msg('Fit')}: ${fit.label}
									</span>`;
                })()}
							`
              : nothing,
          )}

					<!-- Arrow 1 -->
					<span class="arrow ${agent ? 'arrow--active' : ''}">
						${svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
							<path d="M5 12h14M13 6l6 6-6 6"/>
						</svg>`}
					</span>

					<!-- MISSION ZONE -->
					${this._renderZone(
            'mission',
            msg('Mission'),
            !!missionInfo,
            this._step === 'mission',
            !agent,
            missionInfo
              ? html`
								<velg-mission-card
									operative-type=${missionInfo.type}
									.cost=${missionInfo.cost}
									.effectText=${missionInfo.effect}
									.duration=${missionInfo.duration}
									.selected=${true}
									.interactive=${false}
								></velg-mission-card>
							`
              : nothing,
          )}

					<!-- Arrow 2 -->
					<span class="arrow ${missionInfo ? 'arrow--active' : ''}">
						${svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
							<path d="M5 12h14M13 6l6 6-6 6"/>
						</svg>`}
					</span>

					<!-- TARGET ZONE -->
					${this._renderZone(
            'target',
            this._isGuardian() ? msg('Deploy') : msg('Target'),
            (this._needsNoEmbassy() ||
              (this._needsNoTarget() && this._selectedEmbassyId) ||
              this._isEmbassyTarget()) &&
              this._selectedType !== ''
              ? true
              : !!targetName,
            this._step === 'target',
            !missionInfo,
            this._needsNoTarget() &&
              this._selectedType !== '' &&
              (this._needsNoEmbassy() || this._selectedEmbassyId)
              ? html`
								<div style="text-align:center;padding:var(--space-2)">
									<div style="margin-bottom:var(--space-2);color:var(--color-text-tertiary)">${this._isGuardian() ? icons.operativeGuardian(32) : icons.operativeSpy(32)}</div>
									<div style="font-family:var(--font-brutalist);font-weight:900;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:var(--color-text-tertiary)">
										${this._isGuardian() ? msg('Your simulation') : msg('ALL SECTORS')}
									</div>
								</div>
							`
              : this._isEmbassyTarget() && this._selectedEmbassyId
                ? html`
									<div style="text-align:center;padding:var(--space-2)">
										<div style="margin-bottom:var(--space-2);color:var(--color-text-tertiary)">${icons.operativeInfiltrator(32)}</div>
										<div style="font-family:var(--font-brutalist);font-weight:900;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--color-text-primary);margin-bottom:4px">
											${targetName}
										</div>
										<div style="font-family:var(--font-mono,monospace);font-size:9px;color:var(--color-text-muted);text-transform:uppercase">
											${targetSimName}
										</div>
									</div>
								`
                : targetName
                  ? html`
									<div style="text-align:center;padding:var(--space-2)">
										<div style="font-family:var(--font-brutalist);font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:var(--color-text-primary);margin-bottom:4px">
											${targetName}
										</div>
										<div style="font-family:var(--font-mono,monospace);font-size:9px;color:var(--color-text-muted);text-transform:uppercase">
											${targetSimName}
										</div>
									</div>
								`
                  : nothing,
          )}
				</div>

				<!-- Counter pips -->
				<div class="counter-pips">
					<div class="counter-pip ${this._selectedAgentId ? 'counter-pip--filled' : ''}"></div>
					<div class="counter-pip ${this._selectedType ? 'counter-pip--filled' : ''}"></div>
					<div class="counter-pip ${isReady ? 'counter-pip--filled' : ''}"></div>
				</div>

				<!-- Wire bar + status -->
				${this._renderWireBar(isReady)}

				<!-- Embassy selector (inline, when mission needs embassy) -->
				${this._selectedType && !this._needsNoEmbassy() ? this._renderEmbassySelector() : nothing}

				<!-- Guardian note -->
				${
          this._isGuardian()
            ? html`<div class="guardian-note">${msg('Guardians deploy to your OWN simulation. No embassy required.')}</div>`
            : nothing
        }

				<!-- Foundation phase gate -->
				${
          this.epochPhase === 'foundation' && this._step === 'mission'
            ? html`<div class="phase-gate-notice">${msg('Foundation phase: only guardians and spies may be deployed.')}</div>`
            : nothing
        }

				<!-- Targeting ring (when target selected) -->
				${
          this._selectedType && !this._needsNoEmbassy() && this._selectedEmbassyId
            ? this._renderTargetingRing()
            : nothing
        }

				${this._error ? html`<div class="error">${this._error}</div>` : nothing}

				${
          this._step === 'asset'
            ? html`
					<div class="agent-detail-slot">
						${
              this._hoveredAgentId
                ? this._renderAgentDetail()
                : html`<div class="agent-detail-slot__hint">${msg('Hover over an agent to compare aptitudes')}</div>`
            }
					</div>
				`
            : nothing
        }
				${this._step === 'asset' ? this._renderHand() : nothing}
				${this._step === 'mission' ? this._renderMissionSelection() : nothing}
				${this._step === 'target' && !this._needsNoTarget() && !this._isEmbassyTarget() ? this._renderTargetSelection() : nothing}
			</div>
		`;
  }

  private _renderZone(
    zone: Step,
    label: string,
    filled: boolean,
    active: boolean,
    locked: boolean,
    content: unknown,
  ) {
    const classes = classMap({
      zone: true,
      'zone--empty': !filled && !locked && active,
      'zone--filled': filled,
      'zone--locked': locked,
      'zone--active-target':
        active && !filled && !locked && zone === 'target' && this._step === 'target',
      'zone--dragover': this._dragOverZone === zone && !filled,
    });

    const slamRingColor = this._slamColor || 'var(--color-epoch-accent)';

    return html`
			<div
				class=${classes}
				aria-label=${filled ? `${label}: ${this._getZoneAriaLabel(zone)}` : `${label}: ${msg('empty')}`}
				@dragover=${(e: DragEvent) => this._onZoneDragOver(e, zone)}
				@dragleave=${this._onZoneDragLeave}
				@drop=${(e: DragEvent) => this._onZoneDrop(e, zone)}
			>
				${
          !filled
            ? html`
					<div class="zone__silhouette">
						<div class="zone__silhouette-frame"></div>
					</div>
					<span class="zone__label">${label}</span>
					${!locked ? html`<span class="zone__hint">${this._getZoneHint(zone)}</span>` : nothing}
				`
            : nothing
        }
				${filled ? content : nothing}
				${
          filled
            ? html`
					<button
						class="zone__remove"
						@click=${() => this._removeZone(zone)}
						aria-label=${msg(str`Remove ${label}`)}
					>${icons.close(12)}</button>
				`
            : nothing
        }
				<div
					class="slam-ring ${this._slamZone === zone ? 'slam-ring--active' : ''}"
					style=${styleMap({ '--slam-ring-color': slamRingColor })}
				></div>
			</div>
		`;
  }

  private _getZoneHint(zone: Step): string {
    if (zone === 'asset') return '';
    if (zone === 'mission') return '';
    return '';
  }

  private _getZoneAriaLabel(zone: Step): string {
    if (zone === 'asset') return this._getSelectedAgent()?.name ?? '';
    if (zone === 'mission') return this._selectedType;
    if (this._selectedZoneId)
      return this._targetZones.find((z) => z.id === this._selectedZoneId)?.name ?? '';
    if (this._selectedBuildingId)
      return this._targetBuildings.find((b) => b.id === this._selectedBuildingId)?.name ?? '';
    if (this._selectedTargetAgentId)
      return this._targetAgents.find((a) => a.id === this._selectedTargetAgentId)?.name ?? '';
    return '';
  }

  // ── Wire + status bar ───────────────────────────────

  private _renderWireBar(isReady: boolean) {
    const estimate = this._estimateSuccess();
    const successPct = Math.round(estimate.total * 100);
    const showPct = this._selectedType && !this._needsNoEmbassy();

    return html`
			<div class="wire-bar">
				<div class="wire-bar__line ${isReady ? 'wire-bar__line--active' : ''}"></div>
				<span class="wire-bar__status ${isReady ? 'wire-bar__status--ready' : ''}">
					${isReady ? msg('OPERATION READY') : msg('AWAITING PARAMETERS')}
				</span>
				${
          showPct
            ? html`
					<span class="wire-bar__pct" style="color:${successPct >= 70 ? 'var(--color-success)' : successPct >= 40 ? 'var(--color-epoch-accent)' : 'var(--color-danger)'}">
						${successPct}%
					</span>
				`
            : nothing
        }
				<div class="wire-bar__line ${isReady ? 'wire-bar__line--active' : ''}"></div>
			</div>
		`;
  }

  // ── Embassy selector ────────────────────────────────

  private _renderEmbassySelector() {
    return html`
			<div class="embassy-bar">
				<span class="embassy-bar__label">${msg('Route through Embassy')}</span>
				<select
					class="embassy-bar__select"
					aria-label=${msg('Route through Embassy')}
					.value=${this._selectedEmbassyId}
					@change=${(e: Event) => this._selectEmbassy((e.target as HTMLSelectElement).value)}
				>
					<option value="">${msg('-- Select embassy route --')}</option>
					${this._embassies.map((emb) => {
            const targetName =
              emb.simulation_a_id === this.simulationId
                ? emb.simulation_b?.name
                : emb.simulation_a?.name;
            return html`<option value=${emb.id}>${targetName ?? msg('Unknown')}</option>`;
          })}
				</select>
			</div>
		`;
  }

  // ── Targeting ring ──────────────────────────────────

  private _renderTargetingRing() {
    const estimate = this._estimateSuccess();
    const successPct = Math.round(estimate.total * 100);
    const circumference = 2 * Math.PI * 26;
    const dashoffset = circumference * (1 - successPct / 100);
    const ringColor =
      successPct >= 70
        ? 'var(--color-success)'
        : successPct >= 40
          ? 'var(--color-epoch-accent)'
          : 'var(--color-danger)';
    const pctClass =
      successPct >= 70
        ? 'targeting__pct--green'
        : successPct >= 40
          ? 'targeting__pct--amber'
          : 'targeting__pct--red';

    const fmtBonus = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;

    return html`
			<div class="targeting">
				<div class="targeting__ring">
					<svg viewBox="0 0 64 64" aria-hidden="true">
						<circle class="targeting__ring-bg" cx="32" cy="32" r="26" />
						<circle
							class="targeting__ring-fill"
							cx="32" cy="32" r="26"
							stroke=${ringColor}
							stroke-dasharray=${circumference}
							stroke-dashoffset=${dashoffset}
						/>
					</svg>
					<span class="targeting__pct ${pctClass}">${successPct}%</span>
				</div>
				<div class="targeting__details">
					<div class="targeting__factor">
						<span>${msg('Base probability')}</span>
						<span>${Math.round(estimate.base * 100)}%</span>
					</div>
					<div class="targeting__factor">
						<span>${msg('Agent aptitude')}</span>
						<span class="${estimate.aptBonus >= 0 ? 'targeting__val--pos' : 'targeting__val--neg'}">${fmtBonus(estimate.aptBonus)}</span>
					</div>
					<div class="targeting__factor">
						<span>${msg('Zone security')}</span>
						<span class="${estimate.zonePenalty > 0 ? 'targeting__val--neg' : ''}">${estimate.zonePenalty > 0 ? `-${Math.round(estimate.zonePenalty * 100)}%` : '0%'}</span>
					</div>
					<div class="targeting__factor">
						<span>${msg('Embassy effectiveness')}</span>
						<span class="${estimate.embBonus > 0 ? 'targeting__val--pos' : ''}">${fmtBonus(estimate.embBonus)}</span>
					</div>
				</div>
			</div>
		`;
  }

  // ── The Hand (agent card fan) ───────────────────────

  private _renderHand() {
    const agents = this._agents;
    const total = agents.length;

    return html`
			<div class="hand">
				<span class="hand__label">${msg('YOUR ROSTER')}</span>
				<div class="hand__cards">
					${agents.map((agent, i) => {
            const { rot, y } = this._fanGeometry(i, total);
            const isDeployed = this.deployedAgentIds.includes(agent.id);
            const isSelected = agent.id === this._selectedAgentId;
            const apt = this._aptitudeMap.get(agent.id) ?? null;
            const best = apt ? this._getBestAptitude(apt) : null;
            const subtitle = [agent.primary_profession, agent.gender]
              .filter(Boolean)
              .join(' \u00b7 ');

            const wrapClasses = classMap({
              'hand__card-wrapper': true,
              'hand__card-wrapper--dealing': this._dealt,
              'hand__card-wrapper--deployed': isDeployed,
              'hand__card-wrapper--selected': isSelected,
            });

            return html`
							<button
								type="button"
								class=${wrapClasses}
								style=${styleMap({
                  '--fan-rot': `${rot}deg`,
                  '--fan-y': `${y}px`,
                  '--deal-delay': `${i * 80}ms`,
                })}
								draggable=${isDeployed ? 'false' : 'true'}
								@dragstart=${(e: DragEvent) => this._onAgentDragStart(e, agent.id)}
								@click=${() => this._selectAgent(agent.id)}
								@mouseenter=${() => {
                  if (!isDeployed) this._hoveredAgentId = agent.id;
                }}
								@mouseleave=${() => {
                  if (this._hoveredAgentId === agent.id) this._hoveredAgentId = '';
                }}
								@focus=${() => {
                  if (!isDeployed) this._hoveredAgentId = agent.id;
                }}
								@blur=${() => {
                  if (this._hoveredAgentId === agent.id) this._hoveredAgentId = '';
                }}
								tabindex=${isDeployed ? -1 : 0}
								aria-label=${agent.name}
							>
								<velg-game-card
									type="agent"
									size="sm"
									name=${agent.name}
									.imageUrl=${agent.portrait_image_url ?? ''}
									.primaryStat=${best?.level ?? null}
									.rarity=${this._getAgentRarity(agent)}
									.aptitudes=${apt}
									.subtitle=${subtitle}
									.dimmed=${isDeployed || isSelected}
								></velg-game-card>
								${isDeployed ? html`<span class="hand__stamp">${msg('DEPLOYED')}</span>` : nothing}
							</button>
						`;
          })}
				</div>
			</div>
		`;
  }

  // ── Agent Detail Strip (aptitude readout) ──────────

  private _renderAgentDetail() {
    const agentId = this._hoveredAgentId || this._selectedAgentId;
    if (!agentId) return nothing;
    const agent = this._agents.find((a) => a.id === agentId);
    if (!agent) return nothing;
    const apt = this._aptitudeMap.get(agent.id);
    if (!apt) return nothing;

    const selectedType = this._selectedType || null;
    const fit = selectedType ? this._getFitLevel(apt[selectedType as OperativeType]) : null;
    const accentColor = selectedType
      ? (OP_COLORS[selectedType as OperativeType] ?? 'var(--color-epoch-accent)')
      : 'var(--color-epoch-accent)';

    return html`
			<div
				class="agent-detail"
				style="--agent-accent: ${accentColor}"
				role="group"
				aria-label=${msg('Agent aptitudes')}
			>
				<div class="agent-detail__identity">
					<velg-avatar
						.name=${agent.name}
						.imageUrl=${agent.portrait_image_url ?? ''}
						size="xs"
					></velg-avatar>
					<span class="agent-detail__name">${agent.name}</span>
				</div>
				<div class="agent-detail__bars">
					<velg-aptitude-bars
						size="sm"
						.aptitudes=${apt}
						.highlight=${selectedType as OperativeType | null}
					></velg-aptitude-bars>
				</div>
				${
          fit
            ? html`<span class="agent-detail__fit agent-detail__fit--${fit.css}">
						${msg('Fit')}: ${fit.label}
					</span>`
            : nothing
        }
			</div>
		`;
  }

  // ── Mission card grid ───────────────────────────────

  private _renderMissionSelection() {
    const allTypes = getOperativeTypes();
    const isFoundation = this.epochPhase === 'foundation';
    const types = isFoundation
      ? allTypes.filter((t) => t.type === 'guardian' || t.type === 'spy')
      : allTypes;

    return html`
			<div style="display:flex;flex-direction:column;align-items:center;padding:0 var(--space-5) var(--space-4);flex-shrink:0;z-index:2">
				<div class="mission-grid">
					${types.map(
            (t) => html`
						<div
							draggable=${t.cost <= this.currentRp ? 'true' : 'false'}
							@dragstart=${(e: DragEvent) => this._onMissionDragStart(e, t.type)}
						>
							<velg-mission-card
								operative-type=${t.type}
								.cost=${t.cost}
								.effectText=${t.effect}
								.duration=${t.duration}
								.selected=${this._selectedType === t.type}
								.disabled=${t.cost > this.currentRp}
								@card-click=${() => this._selectMission(t.type)}
							></velg-mission-card>
						</div>
					`,
          )}
				</div>
			</div>
		`;
  }

  // ── Target selection ────────────────────────────────

  private _renderTargetSelection() {
    const missionInfo = this._getSelectedMissionType();
    if (!missionInfo) return nothing;
    const targetSimName = this._getTargetSimulationName();

    return html`
			<div class="target-section">
				<!-- Enemy header banner -->
				${
          targetSimName
            ? html`
						<div class="target-section__header">
							<span class="target-section__header-badge">${msg('Hostile Territory')}</span>
							<span class="target-section__header-name">${targetSimName}</span>
						</div>
					`
            : nothing
        }

				${
          missionInfo.needsTarget === 'zone' || missionInfo.needsTarget === 'building'
            ? this._renderZoneTargets(missionInfo)
            : nothing
        }
				${missionInfo.needsTarget === 'agent' ? this._renderAgentTargets() : nothing}
				${
          missionInfo.needsTarget === 'embassy'
            ? html`<div class="guardian-note" style="color:var(--color-epoch-accent, var(--color-primary));border-color:color-mix(in srgb, var(--color-primary) 30%, transparent);background:color-mix(in srgb, var(--color-primary) 5%, transparent)">
						${msg('Select embassy route first')}
					</div>`
            : nothing
        }
			</div>
		`;
  }

  private _getSecurityClass(level?: string): string {
    const l = (level ?? '').toLowerCase();
    if (l === 'high') return 'target-card--high';
    if (l === 'medium') return 'target-card--medium';
    if (l === 'low') return 'target-card--low';
    return 'target-card--medium';
  }

  private _getSecurityVar(level?: string): string {
    const l = (level ?? '').toLowerCase();
    if (l === 'high') return 'var(--color-danger)';
    if (l === 'low') return 'var(--color-success)';
    return 'var(--color-primary)';
  }

  private _renderZoneTargets(missionInfo: OperativeTypeInfo) {
    const needsBuilding = missionInfo.needsTarget === 'building';

    return html`
			<div class="target-zone-grid">
				${this._targetZones.map((z) => {
          const secClass = this._getSecurityClass(z.security_level);
          const secColor = this._getSecurityVar(z.security_level);
          const isZoneSelected = this._selectedZoneId === z.id;
          // Filter buildings for this zone
          const zoneBuildings = needsBuilding
            ? this._targetBuildings.filter((b) => b.zone_id === z.id)
            : [];

          return html`
						<div class="target-zone-col" style="--zone-accent:${secColor}">
							<!-- Zone card (clickable) -->
							<button
								type="button"
								class="target-card ${secClass} ${isZoneSelected ? 'target-card--selected' : ''}"
								aria-label=${z.name}
								@click=${() => {
                  this._selectedZoneId = z.id;
                  if (missionInfo.needsTarget === 'zone') this._triggerSlam('target', '');
                }}
							>
								<div class="target-card__body">
									<span class="target-card__name">${z.name}</span>
									<span class="target-card__type">${z.security_level}</span>
								</div>
							</button>

							<!-- Buildings under this zone (when building-targeting + zone selected) -->
							${
                needsBuilding && isZoneSelected && zoneBuildings.length > 0
                  ? html`
									<div class="target-zone-col__buildings">
										${zoneBuildings.map(
                      (b) => html`
											<button
												type="button"
												class="target-card target-card--medium ${this._selectedBuildingId === b.id ? 'target-card--selected' : ''}"
												aria-label=${b.name}
												@click=${() => this._selectTarget(b.id, 'building')}
											>
												<div class="target-card__body">
													<span class="target-card__name">${b.name}</span>
													<span class="target-card__type">${b.building_type}</span>
												</div>
											</button>
										`,
                    )}
									</div>
								`
                  : nothing
              }
						</div>
					`;
        })}
			</div>
		`;
  }

  private _renderAgentTargets() {
    return html`
			<div class="target-agent-grid">
				${this._targetAgents.map(
          (a) => html`
					<button
						type="button"
						class="target-card target-card--high ${this._selectedTargetAgentId === a.id ? 'target-card--selected' : ''}"
						aria-label=${a.name}
						@click=${() => this._selectTarget(a.id, 'agent')}
					>
						<div class="target-card__body">
							<span class="target-card__name">${a.name}</span>
							<span class="target-card__type">${a.professions?.[0]?.profession ?? ''}</span>
						</div>
					</button>
				`,
        )}
			</div>
		`;
  }

  // ── Footer ──────────────────────────────────────────

  private _renderFooter() {
    const isReady = this._isOperationReady();

    const deployClasses = classMap({
      footer__btn: true,
      'footer__btn--deploy': true,
      'footer__btn--deploy--ready': isReady && this._deployPhase === 'idle',
    });

    return html`
			<div class="footer">
				<button
					class="footer__btn footer__btn--cancel"
					@click=${this._close}
					?disabled=${this._deployPhase !== 'idle'}
				>${msg('Cancel')}</button>
				<button
					class=${deployClasses}
					?disabled=${!isReady || this._loading || this._deployPhase !== 'idle'}
					@click=${this._handleDeploy}
				>
					${
            this._loading && this._deployPhase !== 'idle'
              ? msg('Deploying...')
              : msg('Deploy Operative')
          }
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
