import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import {
  agentsApi,
  embassiesApi,
  generationApi,
  relationshipsApi,
} from '../../services/api/index.js';
import type { Agent, AgentRelationship, Embassy, EventReaction } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import { agentAltText } from '../../utils/text.js';
import '../buildings/EmbassyLink.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import '../shared/Lightbox.js';
import { panelButtonStyles } from '../shared/panel-button-styles.js';
import { panelCascadeStyles } from '../shared/panel-cascade-styles.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/VelgAvatar.js';
import '../shared/VelgBadge.js';
import '../shared/VelgSectionHeader.js';
import '../shared/VelgSidePanel.js';
import './RelationshipCard.js';
import './RelationshipEditModal.js';

interface RelationshipSuggestion {
  target_agent_id: string;
  relationship_type: string;
  intensity: number;
  description: string;
  is_bidirectional: boolean;
}

@localized()
@customElement('velg-agent-details-panel')
export class VelgAgentDetailsPanel extends LitElement {
  static styles = [
    panelButtonStyles,
    panelCascadeStyles,
    css`
    :host {
      display: block;
    }

    .panel__info {
      padding: var(--space-5) var(--space-6);
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .panel__badges,
    .panel__influence {
      opacity: 0;
      animation: panel-cascade 400ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
    }

    .panel__badges {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .panel__section {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .panel__section-content {
      font-size: var(--text-sm);
      color: var(--color-text-primary);
      line-height: var(--leading-relaxed);
      white-space: pre-wrap;
      word-break: break-word;
    }

    .panel__professions {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .panel__profession {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-2) var(--space-3);
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border-light);
    }

    .panel__profession-name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .panel__profession-level {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .panel__profession-primary {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      color: var(--color-primary);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .panel__reactions {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .panel__reaction {
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border-light);
    }

    .panel__reaction-header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      cursor: pointer;
      user-select: none;
      transition: background var(--transition-fast);
    }

    .panel__reaction-header:hover {
      background: var(--color-surface-header);
    }

    .panel__reaction-chevron {
      flex-shrink: 0;
      color: var(--color-text-muted);
      transition: transform var(--transition-fast);
    }

    .panel__reaction-chevron--open {
      transform: rotate(90deg);
    }

    .panel__reaction-event {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-secondary);
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .panel__reaction-emotion {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      padding: var(--space-0-5) var(--space-1-5);
      background: var(--color-surface-header);
      border: var(--border-width-thin) solid var(--color-border);
      color: var(--color-text-muted);
      flex-shrink: 0;
    }

    .panel__reaction-delete {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--color-text-muted);
      flex-shrink: 0;
      transition: color var(--transition-fast);
    }

    .panel__reaction-delete:hover {
      color: var(--color-danger);
    }

    .panel__reaction-body {
      padding: 0 var(--space-3) var(--space-3) var(--space-3);
      border-top: var(--border-width-thin) solid var(--color-border-light);
    }

    .panel__reaction-text {
      font-size: var(--text-sm);
      color: var(--color-text-primary);
      line-height: var(--leading-relaxed);
      padding-top: var(--space-2);
    }

    .panel__reactions-loading {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      text-align: center;
      padding: var(--space-3);
    }

    .panel__empty {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      font-style: italic;
    }

    .panel__relationships {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .panel__rel-actions {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .panel__rel-btn {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-1-5) var(--space-3);
      border: var(--border-width-thin) solid var(--color-border);
      background: var(--color-surface-sunken);
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .panel__rel-btn:hover {
      background: var(--color-surface-header);
      color: var(--color-text-primary);
    }

    .panel__rel-btn--generate {
      border-color: var(--color-info);
      color: var(--color-info);
    }

    .panel__rel-btn--generate:hover {
      background: var(--color-info-bg);
    }

    .panel__embassy-item + .panel__embassy-item {
      margin-top: var(--space-3);
      padding-top: var(--space-3);
      border-top: var(--border-width-thin) solid var(--color-border-light);
    }

    .panel__embassy-local {
      display: flex;
      gap: var(--space-3);
      align-items: center;
      padding: var(--space-3);
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border-light);
      cursor: pointer;
      margin-bottom: var(--space-2);
      transition: background var(--transition-fast);
    }

    .panel__embassy-local:hover {
      background: var(--color-surface-header);
    }

    .panel__embassy-thumb {
      width: 40px;
      height: 40px;
      object-fit: cover;
      border: var(--border-width-default) solid var(--color-border);
      flex-shrink: 0;
    }

    .panel__embassy-info {
      flex: 1;
      min-width: 0;
    }

    .panel__embassy-name {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      color: var(--color-text-primary);
      transition: color var(--transition-fast);
    }

    .panel__embassy-local:hover .panel__embassy-name {
      color: var(--color-primary);
    }

    .panel__embassy-label {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    /* --- Influence indicator --- */

    .panel__influence {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-3);
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border-light);
    }

    .panel__influence-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .panel__influence-label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
    }

    .panel__influence-value {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
    }

    .panel__influence-track {
      height: 6px;
      background: var(--color-surface-header);
      border: var(--border-width-thin) solid var(--color-border);
      overflow: hidden;
    }

    .panel__influence-fill {
      height: 100%;
      transition: width 0.6s var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) 0.4s;
    }

    .panel__influence-breakdown {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--space-0-5) var(--space-3);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .panel__influence-metric {
      text-align: right;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
    }

    /* --- Relationship suggestions --- */

    .panel__suggestions {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding-top: var(--space-3);
      border-top: var(--border-width-thin) solid var(--color-border-light);
    }

    .panel__suggestions-title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-info);
    }

    .panel__suggestion {
      display: flex;
      gap: var(--space-3);
      padding: var(--space-3);
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border-light);
      cursor: pointer;
      transition: background var(--transition-fast);
      opacity: 0;
      animation: suggestion-enter 300ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
      animation-delay: calc(var(--i, 0) * 60ms);
    }

    @keyframes suggestion-enter {
      from {
        opacity: 0;
        transform: translateX(-12px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .panel__suggestion:hover {
      background: var(--color-surface-header);
    }

    .panel__suggestion--unchecked {
      opacity: 0.5;
    }

    .panel__suggestion-check {
      flex-shrink: 0;
      width: 18px;
      height: 18px;
      margin-top: 1px;
      accent-color: var(--color-info);
    }

    .panel__suggestion-body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .panel__suggestion-top {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .panel__suggestion-type {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-0-5) var(--space-1-5);
      background: var(--color-info-bg);
      color: var(--color-info);
      border: var(--border-width-thin) solid var(--color-info);
    }

    .panel__suggestion-name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      color: var(--color-text-primary);
    }

    .panel__suggestion-desc {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      line-height: var(--leading-relaxed);
    }

    .panel__suggestion-bar-track {
      height: 4px;
      background: var(--color-surface-header);
      border: var(--border-width-thin) solid var(--color-border);
      margin-top: var(--space-1);
    }

    .panel__suggestion-bar-fill {
      height: 100%;
      background: var(--color-info);
      transition: width 0.3s ease;
    }

    .panel__suggestion-actions {
      display: flex;
      gap: var(--space-2);
      padding-top: var(--space-2);
    }

    .panel__suggestion-actions .panel__rel-btn--save {
      border-color: var(--color-success);
      color: var(--color-success);
    }

    .panel__suggestion-actions .panel__rel-btn--save:hover {
      background: var(--color-success-bg);
    }

    .panel__suggestion-actions .panel__rel-btn--dismiss {
      border-color: var(--color-text-muted);
      color: var(--color-text-muted);
    }

    .panel__suggestion-actions .panel__rel-btn--dismiss:hover {
      background: var(--color-surface-header);
    }
  `,
  ];

  @property({ type: Object }) agent: Agent | null = null;
  @property({ type: String }) simulationId = '';
  @property({ type: Boolean, reflect: true }) open = false;

  @state() private _reactions: EventReaction[] = [];
  @state() private _reactionsLoading = false;
  @state() private _expandedReactions: Set<string> = new Set();
  @state() private _lightboxSrc: string | null = null;
  @state() private _lightboxAlt = '';
  @state() private _relationships: AgentRelationship[] = [];
  @state() private _allAgents: Agent[] = [];
  @state() private _relEditOpen = false;
  @state() private _relEditTarget: AgentRelationship | null = null;
  @state() private _embassyAssignments: { embassy: Embassy; localBuildingId: string }[] = [];
  @state() private _generating = false;
  @state() private _suggestions: RelationshipSuggestion[] = [];
  @state() private _selectedSuggestions: Set<number> = new Set();
  @state() private _savingSuggestions = false;

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('agent') || changedProperties.has('open')) {
      if (this.open && this.agent && this.simulationId) {
        this._expandedReactions = new Set();
        this._embassyAssignments = [];
        this._suggestions = [];
        this._selectedSuggestions = new Set();
        this._generating = false;
        this._savingSuggestions = false;
        this._loadReactions();
        this._loadRelationships();
        this._loadAllAgents();
        if (this.agent.is_ambassador) {
          this._loadEmbassy();
        }
      }
    }
  }

  private async _loadReactions(): Promise<void> {
    if (!this.agent || !this.simulationId || !appState.isAuthenticated.value) return;

    this._reactionsLoading = true;
    try {
      const response = await agentsApi.getReactions(this.simulationId, this.agent.id);
      if (response.success && response.data) {
        this._reactions = response.data;
      } else {
        this._reactions = [];
      }
    } catch {
      this._reactions = [];
    } finally {
      this._reactionsLoading = false;
    }
  }

  private async _loadRelationships(): Promise<void> {
    if (!this.agent || !this.simulationId) return;

    try {
      const response = await relationshipsApi.listForAgent(this.simulationId, this.agent.id);
      if (response.success && response.data) {
        this._relationships = response.data;
      } else {
        this._relationships = [];
      }
    } catch {
      this._relationships = [];
    }
  }

  private async _loadAllAgents(): Promise<void> {
    if (!this.simulationId) return;

    try {
      const response = await agentsApi.list(this.simulationId, { limit: '100' });
      if (response.success && response.data) {
        // BaseApiService extracts json.data, so response.data is already Agent[]
        this._allAgents = response.data as unknown as Agent[];
      } else {
        this._allAgents = [];
      }
    } catch {
      this._allAgents = [];
    }
  }

  private async _loadEmbassy(): Promise<void> {
    if (!this.agent || !this.simulationId) return;

    try {
      const response = await embassiesApi.listForSimulation(this.simulationId, { limit: '50' });
      if (!response.success || !response.data) return;

      // BaseApiService extracts json.data, so response.data is already Embassy[]
      const embassies = response.data as unknown as Embassy[];
      const agentName = this.agent.name;
      const simId = this.simulationId;
      const assignments: { embassy: Embassy; localBuildingId: string }[] = [];

      for (const embassy of embassies) {
        const meta = embassy.embassy_metadata;
        if (!meta?.ambassador_a || !meta?.ambassador_b) continue;

        // Check both ambassador entries — metadata ordering may not match simulation ordering
        const isAmbassador =
          meta.ambassador_a?.name === agentName || meta.ambassador_b?.name === agentName;
        if (isAmbassador) {
          // simulation_a/building_a ARE correctly paired by LEAST/GREATEST
          const localBuildingId =
            embassy.simulation_a_id === simId ? embassy.building_a_id : embassy.building_b_id;
          assignments.push({ embassy, localBuildingId });
        }
      }

      this._embassyAssignments = assignments;
    } catch {
      // Embassy data not critical
    }
  }

  private _handleNavigateEmbassy(e: CustomEvent): void {
    const { simulationSlug, buildingId } = e.detail;
    window.history.pushState({}, '', `/simulations/${simulationSlug}/buildings`);
    window.dispatchEvent(new PopStateEvent('popstate'));
    sessionStorage.setItem('openBuildingId', buildingId);
  }

  private _handleNavigateLocalBuilding(buildingId: string): void {
    if (!buildingId) return;
    const sim = appState.currentSimulation.value;
    const slug = sim?.slug ?? sim?.id ?? this.simulationId;
    window.history.pushState({}, '', `/simulations/${slug}/buildings`);
    window.dispatchEvent(new PopStateEvent('popstate'));
    sessionStorage.setItem('openBuildingId', buildingId);
  }

  private _handleRelationshipClick(e: CustomEvent<{ agentId: string }>): void {
    const otherAgentId = e.detail.agentId;
    const otherAgent = this._allAgents.find((a) => a.id === otherAgentId);
    if (otherAgent) {
      this.dispatchEvent(
        new CustomEvent('agent-click', {
          detail: otherAgent,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private _handleRelationshipEdit(e: CustomEvent<AgentRelationship>): void {
    this._relEditTarget = e.detail;
    this._relEditOpen = true;
  }

  private async _handleRelationshipDelete(e: CustomEvent<AgentRelationship>): Promise<void> {
    const rel = e.detail;
    const isSource = rel.source_agent_id === this.agent?.id;
    const otherName = isSource
      ? (rel.target_agent?.name ?? msg('Unknown'))
      : (rel.source_agent?.name ?? msg('Unknown'));

    const confirmed = await VelgConfirmDialog.show({
      title: msg('Delete relationship'),
      message: msg(str`Delete relationship with ${otherName}?`),
      confirmLabel: msg('Delete'),
      variant: 'danger',
    });

    if (!confirmed) return;

    const response = await relationshipsApi.remove(this.simulationId, rel.id);
    if (response.success) {
      this._relationships = this._relationships.filter((r) => r.id !== rel.id);
      VelgToast.success(msg('Relationship deleted'));
    } else {
      VelgToast.error(response.error?.message ?? msg('Failed to delete relationship'));
    }
  }

  private _handleRelationshipSaved(): void {
    this._relEditOpen = false;
    this._relEditTarget = null;
    this._loadRelationships();
  }

  private _handleAddRelationship(): void {
    this._relEditTarget = null;
    this._relEditOpen = true;
  }

  private async _handleGenerateRelationships(): Promise<void> {
    if (!this.agent || !this.simulationId || this._generating) return;

    this._generating = true;
    this._suggestions = [];
    this._selectedSuggestions = new Set();

    try {
      const locale = appState.currentSimulation.value?.content_locale ?? 'en';
      const response = await generationApi.generateRelationships(this.simulationId, {
        agent_id: this.agent.id,
        locale,
      });

      if (response.success && Array.isArray(response.data) && response.data.length > 0) {
        this._suggestions = response.data as unknown as RelationshipSuggestion[];
        this._selectedSuggestions = new Set(this._suggestions.map((_, i) => i));
        VelgToast.success(msg(str`${this._suggestions.length} suggestions generated`));
      } else {
        VelgToast.info(msg('No suggestions generated'));
      }
    } catch {
      VelgToast.error(msg('Generation failed'));
    } finally {
      this._generating = false;
    }
  }

  private _toggleSuggestion(index: number): void {
    const next = new Set(this._selectedSuggestions);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    this._selectedSuggestions = next;
  }

  private async _saveSuggestions(): Promise<void> {
    if (!this.agent || !this.simulationId || this._savingSuggestions) return;

    const selected = this._suggestions.filter((_, i) => this._selectedSuggestions.has(i));
    if (selected.length === 0) {
      this._dismissSuggestions();
      return;
    }

    this._savingSuggestions = true;
    try {
      let saved = 0;
      for (const s of selected) {
        const response = await relationshipsApi.create(this.simulationId, this.agent.id, {
          target_agent_id: s.target_agent_id,
          relationship_type: s.relationship_type,
          intensity: s.intensity,
          description: s.description,
          is_bidirectional: s.is_bidirectional,
        });
        if (response.success) saved++;
      }
      if (saved > 0) {
        VelgToast.success(msg(str`${saved} relationships saved`));
        this._loadRelationships();
      }
    } catch {
      VelgToast.error(msg('Failed to save relationships'));
    } finally {
      this._savingSuggestions = false;
      this._suggestions = [];
      this._selectedSuggestions = new Set();
    }
  }

  private _dismissSuggestions(): void {
    this._suggestions = [];
    this._selectedSuggestions = new Set();
  }

  private _computeInfluence(): {
    score: number;
    relationshipWeight: number;
    professionWeight: number;
    ambassadorWeight: number;
  } {
    const agent = this.agent;
    if (!agent)
      return { score: 0, relationshipWeight: 0, professionWeight: 0, ambassadorWeight: 0 };

    // Relationship influence: sum of intensities / max possible (capped at 5 rels)
    const relCount = Math.min(this._relationships.length, 5);
    const relIntensitySum = this._relationships
      .slice(0, 5)
      .reduce((sum, r) => sum + (r.intensity ?? 5), 0);
    const relationshipWeight = relCount > 0 ? relIntensitySum / (relCount * 10) : 0;

    // Profession influence: avg qualification / 10
    const profs = agent.professions ?? [];
    const professionWeight =
      profs.length > 0
        ? profs.reduce((sum, p) => sum + (p.qualification_level ?? 1), 0) / (profs.length * 10)
        : 0;

    // Ambassador bonus
    const ambassadorWeight = agent.is_ambassador ? 1.0 : 0;

    const score = relationshipWeight * 0.4 + professionWeight * 0.3 + ambassadorWeight * 0.3;
    return { score, relationshipWeight, professionWeight, ambassadorWeight };
  }

  private _influenceColor(value: number): string {
    if (value < 0.25) return 'var(--color-text-muted)';
    if (value < 0.5) return 'var(--color-accent)';
    if (value < 0.75) return 'var(--color-success)';
    return 'var(--color-primary)';
  }

  private _renderInfluence() {
    if (!this.agent) return nothing;

    const { score, relationshipWeight, professionWeight, ambassadorWeight } =
      this._computeInfluence();
    const pct = Math.round(score * 100);
    const color = this._influenceColor(score);

    return html`
      <div class="panel__influence">
        <div class="panel__influence-header">
          <span class="panel__influence-label">${msg('Influence')}</span>
          <span class="panel__influence-value" style="color: ${color}">${pct}%</span>
        </div>
        <div class="panel__influence-track">
          <div
            class="panel__influence-fill"
            style="width: ${pct}%; background: ${color}"
          ></div>
        </div>
        <div class="panel__influence-breakdown">
          <span>${msg('Relationships')}</span>
          <span class="panel__influence-metric">${Math.round(relationshipWeight * 100)}%</span>
          <span>${msg('Professions')}</span>
          <span class="panel__influence-metric">${Math.round(professionWeight * 100)}%</span>
          <span>${msg('Diplomatic')}</span>
          <span class="panel__influence-metric">${ambassadorWeight > 0 ? msg('Active') : '—'}</span>
        </div>
      </div>
    `;
  }

  private _renderSuggestions() {
    if (this._suggestions.length === 0) return nothing;

    return html`
      <div class="panel__suggestions">
        <span class="panel__suggestions-title">${msg('AI Suggestions')}</span>
        ${this._suggestions.map((s, i) => {
          const checked = this._selectedSuggestions.has(i);
          const target = this._allAgents.find((a) => a.id === s.target_agent_id);
          const name = target?.name ?? s.target_agent_id.slice(0, 8);
          return html`
            <div
              class="panel__suggestion ${checked ? '' : 'panel__suggestion--unchecked'}"
              style="--i: ${i}"
              @click=${() => this._toggleSuggestion(i)}
            >
              <input
                type="checkbox"
                class="panel__suggestion-check"
                .checked=${checked}
                @click=${(e: MouseEvent) => e.stopPropagation()}
                @change=${() => this._toggleSuggestion(i)}
              />
              <div class="panel__suggestion-body">
                <div class="panel__suggestion-top">
                  <span class="panel__suggestion-type">${s.relationship_type}</span>
                  <span class="panel__suggestion-name">${name}</span>
                </div>
                ${s.description ? html`<span class="panel__suggestion-desc">${s.description}</span>` : nothing}
                <div class="panel__suggestion-bar-track">
                  <div class="panel__suggestion-bar-fill" style="width: ${s.intensity * 10}%"></div>
                </div>
              </div>
            </div>
          `;
        })}
        <div class="panel__suggestion-actions">
          <button
            class="panel__rel-btn panel__rel-btn--save"
            ?disabled=${this._savingSuggestions || this._selectedSuggestions.size === 0}
            @click=${this._saveSuggestions}
          >
            ${this._savingSuggestions ? msg('Saving...') : msg('Save Selected')}
          </button>
          <button
            class="panel__rel-btn panel__rel-btn--dismiss"
            ?disabled=${this._savingSuggestions}
            @click=${this._dismissSuggestions}
          >
            ${msg('Dismiss')}
          </button>
        </div>
      </div>
    `;
  }

  private _renderRelationships() {
    const generateBtn = appState.canEdit.value
      ? html`
        <div class="panel__rel-actions">
          <button class="panel__rel-btn" @click=${this._handleAddRelationship}>
            ${msg('Add Relationship')}
          </button>
          <button
            class="panel__rel-btn panel__rel-btn--generate"
            ?disabled=${this._generating}
            @click=${this._handleGenerateRelationships}
          >
            ${this._generating ? msg('Generating...') : html`${icons.sparkle()} ${msg('Generate Relationships')}`}
          </button>
        </div>
      `
      : nothing;

    if (this._relationships.length === 0 && this._suggestions.length === 0) {
      return html`
        <span class="panel__empty">${msg('No relationships defined.')}</span>
        ${generateBtn}
      `;
    }

    return html`
      <div class="panel__relationships">
        ${this._relationships.map(
          (rel) => html`
            <velg-relationship-card
              .relationship=${rel}
              .currentAgentId=${this.agent?.id ?? ''}
              @relationship-click=${this._handleRelationshipClick}
              @relationship-edit=${this._handleRelationshipEdit}
              @relationship-delete=${this._handleRelationshipDelete}
            ></velg-relationship-card>
          `,
        )}
        ${generateBtn}
        ${this._renderSuggestions()}
      </div>
    `;
  }

  private _handleEdit(): void {
    if (this.agent) {
      this.dispatchEvent(
        new CustomEvent('agent-edit', {
          detail: this.agent,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private _handleDelete(): void {
    if (this.agent) {
      this.dispatchEvent(
        new CustomEvent('agent-delete', {
          detail: this.agent,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private _toggleReaction(reactionId: string): void {
    const next = new Set(this._expandedReactions);
    if (next.has(reactionId)) {
      next.delete(reactionId);
    } else {
      next.add(reactionId);
    }
    this._expandedReactions = next;
  }

  private async _handleDeleteReaction(reaction: EventReaction): Promise<void> {
    if (!this.agent) return;

    const eventTitle = reaction.events?.title ?? reaction.event_id.slice(0, 8);
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Delete reaction'),
      message: msg(str`Delete reaction of ${this.agent.name} to "${eventTitle}"?`),
      confirmLabel: msg('Delete'),
      variant: 'danger',
    });

    if (!confirmed) return;

    const response = await agentsApi.deleteReaction(this.simulationId, this.agent.id, reaction.id);
    if (response.success) {
      this._reactions = this._reactions.filter((r) => r.id !== reaction.id);
      VelgToast.success(msg('Reaction deleted'));
    } else {
      VelgToast.error(response.error?.message ?? msg('Failed to delete reaction'));
    }
  }

  private _renderEmbassy() {
    if (this._embassyAssignments.length === 0) return nothing;

    return html`
      <div class="panel__section">
        <velg-section-header>
          ${msg('Embassy Assignment')}
          ${this._embassyAssignments.length > 1 ? html`<velg-badge>${this._embassyAssignments.length}</velg-badge>` : nothing}
        </velg-section-header>
        ${this._embassyAssignments.map(({ embassy, localBuildingId }) => {
          const localBuilding =
            localBuildingId === embassy.building_a_id ? embassy.building_a : embassy.building_b;

          return html`
            <div class="panel__embassy-item">
              ${
                localBuilding
                  ? html`
                    <div class="panel__embassy-local" @click=${() => this._handleNavigateLocalBuilding(localBuildingId)}>
                      ${
                        localBuilding.image_url
                          ? html`<img
                              class="panel__embassy-thumb"
                              src=${localBuilding.image_url}
                              alt=${localBuilding.name}
                              loading="lazy"
                            />`
                          : nothing
                      }
                      <div class="panel__embassy-info">
                        <div class="panel__embassy-name">${localBuilding.name}</div>
                        <div class="panel__embassy-label">${msg('Posted at')}</div>
                      </div>
                    </div>
                  `
                  : nothing
              }
              <velg-embassy-link
                .embassy=${embassy}
                .currentBuildingId=${localBuildingId}
                @navigate-embassy=${this._handleNavigateEmbassy}
              ></velg-embassy-link>
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderProfessions() {
    const professions = this.agent?.professions;
    if (!professions || professions.length === 0) {
      return html`<span class="panel__empty">${msg('No professions assigned.')}</span>`;
    }

    return html`
      <div class="panel__professions">
        ${professions.map(
          (p) => html`
            <div class="panel__profession">
              <span class="panel__profession-name">
                ${p.profession_label ?? p.profession}
                ${p.specialization ? html` - ${p.specialization}` : nothing}
              </span>
              <span>
                ${p.is_primary ? html`<span class="panel__profession-primary">${msg('Primary')}</span>` : nothing}
                <span class="panel__profession-level">Lvl ${p.qualification_level}</span>
              </span>
            </div>
          `,
        )}
      </div>
    `;
  }

  private _renderReactions() {
    if (this._reactionsLoading) {
      return html`<div class="panel__reactions-loading">${msg('Loading reactions...')}</div>`;
    }

    if (this._reactions.length === 0) {
      return html`<span class="panel__empty">${msg('No reactions recorded.')}</span>`;
    }

    return html`
      <div class="panel__reactions">
        ${this._reactions.map((r) => {
          const isOpen = this._expandedReactions.has(r.id);
          const eventTitle = r.events?.title ?? r.event_id.slice(0, 8);
          return html`
            <div class="panel__reaction">
              <div
                class="panel__reaction-header"
                @click=${() => this._toggleReaction(r.id)}
              >
                <span class="panel__reaction-chevron ${isOpen ? 'panel__reaction-chevron--open' : ''}">
                  ${icons.chevronRight()}
                </span>
                <span class="panel__reaction-event">${eventTitle}</span>
                ${r.emotion ? html`<span class="panel__reaction-emotion">${r.emotion}</span>` : nothing}
                <button
                  class="panel__reaction-delete"
                  title=${msg('Delete reaction')}
                  @click=${(e: MouseEvent) => {
                    e.stopPropagation();
                    this._handleDeleteReaction(r);
                  }}
                >
                  ${icons.trash(14)}
                </button>
              </div>
              ${
                isOpen
                  ? html`
                  <div class="panel__reaction-body">
                    <div class="panel__reaction-text">${r.reaction_text}</div>
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

  protected render() {
    const agent = this.agent;

    return html`
      <velg-side-panel
        .open=${this.open}
        .panelTitle=${agent?.name ?? msg('Agent Details')}
      >
        ${
          agent
            ? html`
              <velg-avatar
                slot="media"
                .src=${agent.portrait_image_url ?? ''}
                .name=${agent.name}
                size="full"
                ?clickable=${!!agent.portrait_image_url}
                @avatar-click=${(e: CustomEvent) => {
                  this._lightboxSrc = (e.detail as { src: string }).src;
                  this._lightboxAlt = agentAltText(agent);
                }}
              ></velg-avatar>

              <div slot="content">
                <div class="panel__info">
                  <div class="panel__badges">
                    ${agent.system ? html`<velg-badge variant="primary">${agent.system}</velg-badge>` : nothing}
                    ${agent.gender ? html`<velg-badge>${agent.gender}</velg-badge>` : nothing}
                    ${agent.is_ambassador ? html`<velg-badge variant="warning">${msg('Ambassador')}</velg-badge>` : nothing}
                    ${agent.data_source === 'ai' ? html`<velg-badge variant="info">${msg('AI Generated')}</velg-badge>` : nothing}
                  </div>

                  ${this._renderInfluence()}

                  ${this._renderEmbassy()}

                  ${
                    agent.character
                      ? html`
                      <div class="panel__section">
                        <velg-section-header>${msg('Character')}</velg-section-header>
                        <div class="panel__section-content">${agent.character}</div>
                      </div>
                    `
                      : nothing
                  }

                  ${
                    agent.background
                      ? html`
                      <div class="panel__section">
                        <velg-section-header>${msg('Background')}</velg-section-header>
                        <div class="panel__section-content">${agent.background}</div>
                      </div>
                    `
                      : nothing
                  }

                  <div class="panel__section">
                    <velg-section-header>${msg('Professions')}</velg-section-header>
                    ${this._renderProfessions()}
                  </div>

                  <div class="panel__section">
                    <velg-section-header>${msg('Reactions')}</velg-section-header>
                    ${this._renderReactions()}
                  </div>

                  <div class="panel__section">
                    <velg-section-header>
                      ${msg('Relationships')}
                      ${
                        this._relationships.length > 0
                          ? html` <velg-badge>${this._relationships.length}</velg-badge>`
                          : nothing
                      }
                    </velg-section-header>
                    ${this._renderRelationships()}
                  </div>
                </div>
              </div>

              ${
                appState.canEdit.value
                  ? html`
                <button slot="footer" class="panel__btn panel__btn--edit" @click=${this._handleEdit}>
                  ${icons.edit()} ${msg('Edit')}
                </button>
                <button slot="footer" class="panel__btn panel__btn--danger" @click=${this._handleDelete}>
                  ${icons.trash()} ${msg('Delete')}
                </button>
              `
                  : nothing
              }
            `
            : nothing
        }
      </velg-side-panel>

      <velg-lightbox
        .src=${this._lightboxSrc}
        .alt=${this._lightboxAlt}
        .caption=${this.agent?.name ?? ''}
        @lightbox-close=${() => {
          this._lightboxSrc = null;
        }}
      ></velg-lightbox>

      <velg-relationship-edit-modal
        ?open=${this._relEditOpen}
        .relationship=${this._relEditTarget}
        .simulationId=${this.simulationId}
        .sourceAgentId=${this.agent?.id ?? ''}
        .agents=${this._allAgents}
        @relationship-saved=${this._handleRelationshipSaved}
        @modal-close=${() => {
          this._relEditOpen = false;
          this._relEditTarget = null;
        }}
      ></velg-relationship-edit-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-agent-details-panel': VelgAgentDetailsPanel;
  }
}
