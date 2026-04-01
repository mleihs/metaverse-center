import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { connectionsApi, echoesApi, eventsApi, simulationsApi } from '../../services/api/index.js';
import { generationProgress } from '../../services/GenerationProgressService.js';
import type {
  EventChain,
  EventEcho,
  EventReaction,
  EventStatus,
  EventZoneLink,
  Event as SimEvent,
  Simulation,
  SimulationConnection,
} from '../../types/index.js';
import { formatDateFull } from '../../utils/date-format.js';
import { icons } from '../../utils/icons.js';
import { t } from '../../utils/locale-fields.js';
import { renderSafeMarkdown } from '../../utils/markdown.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { panelButtonStyles } from '../shared/panel-button-styles.js';
import { panelCascadeStyles } from '../shared/panel-cascade-styles.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/VelgAvatar.js';
import '../shared/VelgBadge.js';
import '../shared/VelgSectionHeader.js';
import '../shared/VelgSidePanel.js';
import './EchoCard.js';
import './EchoTriggerModal.js';

@localized()
@customElement('velg-event-details-panel')
export class VelgEventDetailsPanel extends LitElement {
  static styles = [
    panelButtonStyles,
    panelCascadeStyles,
    css`
    :host {
      display: block;
      --side-panel-width: 540px;
    }

    .panel__content {
      padding: var(--space-6);
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .panel__section {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .panel__text {
      font-size: var(--text-base);
      line-height: var(--leading-relaxed);
      color: var(--color-text-primary);
    }

    .panel__text--secondary {
      color: var(--color-text-secondary);
    }

    .panel__badges {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1-5);
    }

    /* Impact display */
    .panel__impact {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .panel__impact-bar {
      display: flex;
      gap: 3px;
      align-items: flex-end;
      height: 24px;
      flex: 1;
    }

    .panel__impact-segment {
      flex: 1;
      background: var(--color-border-light);
      transform: scaleY(0);
      transform-origin: bottom;
      animation: segment-grow var(--duration-entrance, 350ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) forwards;
      animation-delay: calc(var(--seg-i, 0) * 30ms + 200ms);
    }

    @keyframes segment-grow {
      to { transform: scaleY(1); }
    }

    .panel__impact-segment--active {
      background: var(--color-primary);
    }

    .panel__impact-segment--high {
      background: var(--color-danger);
    }

    .panel__impact-segment--medium {
      background: var(--color-warning);
    }

    .panel__impact-value {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xl);
      min-width: 36px;
      text-align: center;
    }

    /* Tags */
    .panel__tags {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1-5);
    }

    .panel__tag {
      display: inline-flex;
      align-items: center;
      padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border-light);
      color: var(--color-text-secondary);
    }

    /* Metadata */
    .panel__kv-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .panel__kv-item {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: var(--space-3);
      padding: var(--space-1-5) 0;
      border-bottom: var(--border-width-thin) solid var(--color-border-light);
    }

    .panel__kv-key {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      flex-shrink: 0;
    }

    .panel__kv-value {
      font-size: var(--text-sm);
      color: var(--color-text-primary);
      text-align: right;
      word-break: break-word;
    }

    /* Reactions — Sentiment Chorus */
    .panel__reactions {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .panel__reaction-empty {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      text-align: center;
      padding: var(--space-4);
    }

    .panel__reactions-loading {
      text-align: center;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      padding: var(--space-3);
    }

    /* Dominant sentiment label */
    .chorus__dominant {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-1);
    }

    .chorus__dominant-value {
      color: var(--color-text-primary);
    }

    /* Sentiment bar */
    .chorus__bar {
      display: flex;
      height: 28px;
      border: var(--border-default);
      overflow: hidden;
      position: relative;
    }

    .chorus__segment {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: filter var(--duration-fast, 100ms);
      min-width: 2px;
      border: none;
      padding: 0;
      margin: 0;
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-inverse);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    }

    .chorus__segment:hover,
    .chorus__segment:focus-visible {
      filter: brightness(1.2);
      outline: none;
      z-index: 1;
    }

    .chorus__segment:focus-visible {
      box-shadow: inset 0 0 0 2px var(--color-text-inverse);
    }

    .chorus__segment--fear { background: var(--color-warning); }
    .chorus__segment--anger { background: var(--color-danger); }
    .chorus__segment--panic { background: var(--color-danger); }
    .chorus__segment--despair { background: var(--color-danger); opacity: 0.7; }
    .chorus__segment--defiance { background: var(--color-epoch-influence); }
    .chorus__segment--hope { background: var(--color-success); }
    .chorus__segment--resolve { background: var(--color-success); opacity: 0.7; }
    .chorus__segment--indifference { background: var(--color-text-muted); }
    .chorus__segment--unknown { background: var(--color-border); }

    /* Segment tooltip (shown on hover/focus) */
    .chorus__tooltip {
      position: absolute;
      top: calc(100% + var(--space-1));
      left: 0;
      right: 0;
      min-width: 200px;
      background: var(--color-surface-raised);
      border: var(--border-default);
      box-shadow: var(--shadow-lg);
      padding: var(--space-2) var(--space-3);
      z-index: var(--z-tooltip, 700);
      display: none;
    }

    .chorus__segment:hover .chorus__tooltip,
    .chorus__segment:focus-within .chorus__tooltip {
      display: block;
    }

    .chorus__tooltip-agent {
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
      padding: var(--space-1) 0;
      border-bottom: var(--border-width-thin) solid var(--color-border-light);
    }

    .chorus__tooltip-agent:last-child {
      border-bottom: none;
    }

    .chorus__tooltip-name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
      text-shadow: none;
      flex-shrink: 0;
    }

    .chorus__tooltip-preview {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      text-shadow: none;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
      flex: 1;
    }

    /* Segment labels below bar */
    .chorus__labels {
      display: flex;
      gap: 0;
      margin-top: var(--space-1);
    }

    .chorus__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Top reactions (expanded by default) */
    .chorus__top-reactions {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin-top: var(--space-3);
    }

    .chorus__reaction-card {
      background: var(--color-surface);
      border: var(--border-width-thin) solid var(--color-border-light);
      padding: var(--space-3);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .chorus__reaction-header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .chorus__reaction-agent {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .chorus__reaction-delete {
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
      transition: color var(--duration-fast, 100ms);
    }

    .chorus__reaction-delete:hover {
      color: var(--color-danger);
    }

    .chorus__reaction-text {
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
    }

    /* Show all toggle */
    .chorus__show-all {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-1);
      padding: var(--space-2);
      background: transparent;
      border: var(--border-width-thin) solid var(--color-border-light);
      cursor: pointer;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      transition: color var(--duration-fast, 100ms),
        border-color var(--duration-fast, 100ms);
      width: 100%;
      margin-top: var(--space-1);
    }

    .chorus__show-all:hover {
      color: var(--color-text-primary);
      border-color: var(--color-border);
    }

    /* Collapsed reaction rows (in "show all" section) */
    .chorus__remaining {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      margin-top: var(--space-1);
    }

    .chorus__remaining-item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background: var(--color-surface);
      border: var(--border-width-thin) solid var(--color-border-light);
      cursor: pointer;
      transition: background var(--duration-fast, 100ms);
    }

    .chorus__remaining-item:hover {
      background: var(--color-surface-header);
    }

    .chorus__remaining-agent {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      flex-shrink: 0;
    }

    .chorus__remaining-preview {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
      flex: 1;
    }

    .chorus__remaining-body {
      padding: 0 var(--space-3) var(--space-3);
      border-top: var(--border-width-thin) solid var(--color-border-light);
    }

    .chorus__remaining-body-text {
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      padding-top: var(--space-2);
    }

    /* Override: Edit uses neutral style here because Generate is the primary action */
    .panel__btn--edit {
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
    }

    /* Lifecycle */
    .panel__lifecycle-status {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .panel__status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .panel__status-dot--active {
      background: var(--color-success);
      border: 2px solid color-mix(in srgb, var(--color-success) 50%, transparent);
    }

    .panel__status-dot--escalating {
      background: var(--color-danger);
      border: 2px solid color-mix(in srgb, var(--color-danger) 50%, transparent);
      animation: status-pulse var(--duration-slow, 300ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) infinite alternate;
    }

    .panel__status-dot--resolving {
      background: var(--color-info);
      border: 2px solid color-mix(in srgb, var(--color-info) 50%, transparent);
    }

    .panel__status-dot--resolved {
      background: var(--color-text-muted);
      border: 2px solid color-mix(in srgb, var(--color-text-muted) 50%, transparent);
    }

    .panel__status-dot--archived {
      background: var(--color-text-muted);
      border: 2px solid color-mix(in srgb, var(--color-text-muted) 50%, transparent);
      opacity: 0.6;
    }

    @keyframes status-pulse {
      from { transform: scale(1); opacity: 1; }
      to { transform: scale(1.4); opacity: 0.6; }
    }

    @media (prefers-reduced-motion: reduce) {
      .panel__status-dot--escalating {
        animation: none;
      }
    }

    /* Event chains */
    .panel__chains {
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
    }

    .panel__chain-item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background: var(--color-surface);
      border: var(--border-width-thin) solid var(--color-border-light);
      font-size: var(--text-sm);
    }

    .panel__chain-arrow {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      color: var(--color-text-muted);
      flex-shrink: 0;
    }

    .panel__chain-event-title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
      flex: 1;
    }

    .panel__chain-empty {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      text-align: center;
      padding: var(--space-3);
    }

    /* Zone Impact section */
    .panel__zone-links {
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
    }

    .panel__zone-link {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background: var(--color-surface);
      border: var(--border-width-thin) solid var(--color-border-light);
      font-size: var(--text-sm);
    }

    .panel__zone-link-name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .panel__zone-link-type {
      font-family: var(--font-brutalist);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      padding: var(--space-0-5) var(--space-1-5);
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border-light);
    }

    .panel__zone-link-weight {
      width: 48px;
      height: 6px;
      background: var(--color-surface-sunken);
      flex-shrink: 0;
      overflow: hidden;
    }

    .panel__zone-link-weight-fill {
      height: 100%;
      background: var(--color-primary);
      transition: width var(--duration-normal) var(--ease-out);
    }

    .panel__zone-link-source {
      font-size: 10px;
      color: var(--color-text-muted);
      flex-shrink: 0;
    }

    .panel__cascade-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1) var(--space-2);
      background: color-mix(in srgb, var(--color-danger) 12%, transparent);
      border: var(--border-width-thin) solid color-mix(in srgb, var(--color-danger) 30%, transparent);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-danger);
    }
  `,
  ];

  @property({ type: Object }) event: SimEvent | null = null;
  @property({ type: String }) simulationId = '';
  @property({ type: Boolean, reflect: true }) open = false;

  @state() private _reactions: EventReaction[] = [];
  @state() private _reactionsLoading = false;
  @state() private _generatingReactions = false;
  @state() private _expandedReactions: Set<string> = new Set();
  @state() private _showAllReactions = false;
  @state() private _hoveredEmotion: string | null = null;
  @state() private _chains: EventChain[] = [];
  @state() private _echoes: EventEcho[] = [];
  @state() private _zoneLinks: EventZoneLink[] = [];
  @state() private _simulations: Simulation[] = [];
  @state() private _connections: SimulationConnection[] = [];
  @state() private _echoTriggerOpen = false;

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('event') || changedProperties.has('open')) {
      if (this.open && this.event) {
        this._expandedReactions = new Set();
        this._showAllReactions = false;
        this._hoveredEmotion = null;
        this._loadReactions();
        this._loadChains();
        this._loadEchoes();
        this._loadSimulations();
        this._loadConnections();
        this._loadZoneLinks();
      }
    }
  }

  private async _loadReactions(): Promise<void> {
    if (!this.event || !this.simulationId || !appState.isAuthenticated.value) return;

    this._reactionsLoading = true;
    try {
      const response = await eventsApi.getReactions(this.simulationId, this.event.id);
      if (response.success && response.data) {
        this._reactions = response.data;
      } else {
        this._reactions = this.event.reactions ?? [];
      }
    } catch {
      this._reactions = this.event.reactions ?? [];
    } finally {
      this._reactionsLoading = false;
    }
  }

  private async _loadChains(): Promise<void> {
    if (!this.event || !this.simulationId || !appState.isAuthenticated.value) return;

    try {
      const response = await eventsApi.getChains(this.simulationId, this.event.id);
      if (response.success && response.data) {
        this._chains = response.data;
      } else {
        this._chains = [];
      }
    } catch {
      this._chains = [];
    }
  }

  private _getStatusBadgeVariant(status: EventStatus): string {
    switch (status) {
      case 'active':
        return 'success';
      case 'escalating':
        return 'danger';
      case 'resolving':
        return 'info';
      case 'resolved':
        return 'default';
      case 'archived':
        return 'default';
      default:
        return 'default';
    }
  }

  private _getChainTypeBadgeVariant(chainType: string): string {
    switch (chainType) {
      case 'escalation':
        return 'danger';
      case 'follow_up':
        return 'info';
      case 'resolution':
        return 'success';
      case 'cascade':
        return 'danger';
      default:
        return 'default';
    }
  }

  private async _loadZoneLinks(): Promise<void> {
    if (!this.event || !this.simulationId || !appState.isAuthenticated.value) return;

    try {
      const response = await eventsApi.getZoneLinks(this.simulationId, this.event.id);
      if (response.success && response.data) {
        this._zoneLinks = response.data;
      } else {
        this._zoneLinks = [];
      }
    } catch {
      this._zoneLinks = [];
    }
  }

  private _renderZoneImpact() {
    if (this._zoneLinks.length === 0) return nothing;

    return html`
      <div class="panel__section">
        <velg-section-header>${msg('Zone Impact')}</velg-section-header>
        ${
          this.event?.data_source === 'cascade'
            ? html`<div class="panel__cascade-badge">${icons.bolt()} ${msg('Cascade Event')}</div>`
            : nothing
        }
        <div class="panel__zone-links">
          ${this._zoneLinks.map(
            (link) => html`
            <div class="panel__zone-link">
              <span class="panel__zone-link-name">${link.zone_name ?? msg('Unknown Zone')}</span>
              ${
                link.zone_type
                  ? html`<span class="panel__zone-link-type">${link.zone_type}</span>`
                  : nothing
              }
              <div class="panel__zone-link-weight"
                title=${msg(str`Affinity: ${Math.round(link.affinity_weight * 100)}%`)}
                aria-label=${msg(str`Affinity weight: ${Math.round(link.affinity_weight * 100)}%`)}
              >
                <div class="panel__zone-link-weight-fill" style="width: ${link.affinity_weight * 100}%"></div>
              </div>
              <span class="panel__zone-link-source">${link.link_source}</span>
            </div>
          `,
          )}
        </div>
      </div>
    `;
  }

  private async _loadEchoes(): Promise<void> {
    if (!this.event || !this.simulationId) return;

    try {
      const response = await echoesApi.listForEvent(this.simulationId, this.event.id);
      if (response.success && response.data) {
        this._echoes = response.data;
      } else {
        this._echoes = [];
      }
    } catch {
      this._echoes = [];
    }
  }

  private async _loadSimulations(): Promise<void> {
    if (this._simulations.length > 0) return;
    try {
      const response = await simulationsApi.list();
      if (response.success && response.data) {
        this._simulations = response.data;
      }
    } catch {
      // Simulations list is optional context
    }
  }

  private async _loadConnections(): Promise<void> {
    if (this._connections.length > 0) return;
    try {
      const response = await connectionsApi.listAll();
      if (response.success && response.data) {
        this._connections = response.data;
      }
    } catch {
      // Connections list is optional context
    }
  }

  /** Render markdown to sanitized HTML via marked + DOMPurify. */
  private _renderMarkdown(text: string) {
    return renderSafeMarkdown(text);
  }

  private _getImpactClass(level: number): string {
    if (level >= 8) return 'high';
    if (level >= 5) return 'medium';
    return 'active';
  }

  private _handleEdit(): void {
    this.dispatchEvent(
      new CustomEvent('event-edit', {
        detail: this.event,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleDelete(): void {
    this.dispatchEvent(
      new CustomEvent('event-delete', {
        detail: this.event,
        bubbles: true,
        composed: true,
      }),
    );
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
    if (!this.event) return;

    const agentName = reaction.agents?.name ?? reaction.agent_name;
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Delete reaction'),
      message: msg(str`Delete reaction of ${agentName} to "${this.event.title}"?`),
      confirmLabel: msg('Delete'),
      variant: 'danger',
    });

    if (!confirmed) return;

    const response = await eventsApi.deleteReaction(this.simulationId, this.event.id, reaction.id);
    if (response.success) {
      this._reactions = this._reactions.filter((r) => r.id !== reaction.id);
      VelgToast.success(msg('Reaction deleted'));
    } else {
      VelgToast.error(response.error?.message ?? msg('Failed to delete reaction'));
    }
  }

  private async _handleGenerateReactions(): Promise<void> {
    if (!this.event || this._generatingReactions) return;
    this._generatingReactions = true;

    try {
      await generationProgress.run('reactions', async (progress) => {
        progress.setStep('prepare', msg('Loading agents...'));
        await new Promise((r) => setTimeout(r, 300));

        progress.setStep(
          'generate',
          msg('Generating agent reactions...'),
          msg('This may take a moment'),
        );

        const response = await eventsApi.generateReactions(
          this.simulationId,
          (this.event as SimEvent).id,
        );

        progress.setStep('process', msg('Processing reactions...'));
        await new Promise((r) => setTimeout(r, 200));

        if (response.success && response.data) {
          // Reload to get full data with agent joins
          await this._loadReactions();
          progress.complete(msg(str`${response.data.length} reactions generated`));
          VelgToast.success(msg(str`${response.data.length} agent reactions generated`));
        } else {
          const errMsg = response.error?.message || msg('Reaction generation failed');
          progress.setError(errMsg);
          VelgToast.error(errMsg);
        }
      });
    } catch {
      // handled by GenerationProgressService
    } finally {
      this._generatingReactions = false;
    }
  }

  private _renderImpactBar() {
    if (!this.event) return null;
    const level = this.event.impact_level ?? 1;
    const impactClass = this._getImpactClass(level);

    return html`
      <div class="panel__impact">
        <div class="panel__impact-bar">
          ${Array.from({ length: 10 }, (_, i) => {
            const isActive = i < level;
            const segmentClass = isActive
              ? `panel__impact-segment panel__impact-segment--${impactClass}`
              : 'panel__impact-segment';
            return html`<div class=${segmentClass} style="height: 100%; --seg-i: ${i}"></div>`;
          })}
        </div>
        <span class="panel__impact-value">${level}</span>
      </div>
    `;
  }

  private _renderLifecycle() {
    if (!this.event) return null;
    const status = this.event.event_status ?? 'active';

    return html`
      <div class="panel__section">
        <velg-section-header>${msg('Lifecycle')}</velg-section-header>
        <div class="panel__lifecycle-status">
          <span
            class="panel__status-dot panel__status-dot--${status}"
            role="img"
            aria-label=${msg(str`Status: ${status}`)}
          ></span>
          <velg-badge variant=${this._getStatusBadgeVariant(status)}>${status}</velg-badge>
        </div>

        ${
          this._chains.length > 0
            ? html`
          <div class="panel__chains" style="margin-top: var(--space-3);">
            ${this._chains.map((chain) => {
              const isParent = chain.parent_event_id === this.event?.id;
              const linked = isParent ? chain.child : chain.parent;
              const linkedTitle = linked?.title ?? msg('Unknown event');
              const direction = isParent ? '\u2192' : '\u2190';

              return html`
                <div class="panel__chain-item">
                  <velg-badge variant=${this._getChainTypeBadgeVariant(chain.chain_type)}>${chain.chain_type}</velg-badge>
                  <span class="panel__chain-arrow">${direction}</span>
                  <span class="panel__chain-event-title" title=${linkedTitle}>${linkedTitle}</span>
                </div>
              `;
            })}
          </div>
        `
            : null
        }
      </div>
    `;
  }

  private _renderMetadata() {
    if (!this.event?.metadata) return null;
    const entries = Object.entries(this.event.metadata);
    if (entries.length === 0) return null;

    return html`
      <div class="panel__section">
        <velg-section-header>${msg('Metadata')}</velg-section-header>
        <div class="panel__kv-list">
          ${entries.map(
            ([key, value]) => html`
              <div class="panel__kv-item">
                <span class="panel__kv-key">${key}</span>
                <span class="panel__kv-value">${String(value)}</span>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }

  private _getEmotionColor(emotion: string): string {
    switch (emotion) {
      case 'fear':
        return 'fear';
      case 'anger':
        return 'anger';
      case 'panic':
        return 'panic';
      case 'despair':
        return 'despair';
      case 'defiance':
        return 'defiance';
      case 'hope':
        return 'hope';
      case 'resolve':
        return 'resolve';
      case 'indifference':
        return 'indifference';
      default:
        return 'unknown';
    }
  }

  private _buildEmotionGroups(): Map<string, EventReaction[]> {
    const groups = new Map<string, EventReaction[]>();
    for (const r of this._reactions) {
      const emotion = (r.emotion ?? '').trim().toLowerCase() || 'unknown';
      const list = groups.get(emotion) ?? [];
      list.push(r);
      groups.set(emotion, list);
    }
    return groups;
  }

  private _renderSentimentBar() {
    const groups = this._buildEmotionGroups();
    const total = this._reactions.length;
    if (total === 0) return null;

    const meta = (this.event?.metadata ?? {}) as Record<string, unknown>;
    const dominant = (meta.dominant_sentiment as string) ?? null;

    // Sort emotions: named emotions first (by count desc), "unknown" last
    const sorted = [...groups.entries()].sort((a, b) => {
      if (a[0] === 'unknown') return 1;
      if (b[0] === 'unknown') return -1;
      return b[1].length - a[1].length;
    });

    return html`
      ${
        dominant
          ? html`
        <div class="chorus__dominant" aria-live="polite">
          ${msg('Dominant sentiment')}: <span class="chorus__dominant-value">${dominant.toUpperCase()}</span>
        </div>
      `
          : null
      }

      <div class="chorus__bar" role="img" aria-label=${msg(str`Sentiment distribution across ${total} reactions`)}>
        ${sorted.map(([emotion, reactions]) => {
          const pct = (reactions.length / total) * 100;
          const colorClass = this._getEmotionColor(emotion);

          return html`
            <button
              class="chorus__segment chorus__segment--${colorClass}"
              style="width: ${pct}%"
              aria-label=${msg(str`${reactions.length} agents: ${emotion}`)}
              tabindex="0"
              @mouseenter=${() => {
                this._hoveredEmotion = emotion;
              }}
              @mouseleave=${() => {
                this._hoveredEmotion = null;
              }}
              @focus=${() => {
                this._hoveredEmotion = emotion;
              }}
              @blur=${() => {
                this._hoveredEmotion = null;
              }}
            >
              ${pct >= 15 ? reactions.length : ''}
              ${
                this._hoveredEmotion === emotion
                  ? html`
                <div class="chorus__tooltip">
                  ${reactions.slice(0, 5).map((r) => {
                    const name = r.agents?.name ?? r.agent_name;
                    return html`
                      <div class="chorus__tooltip-agent">
                        <velg-avatar
                          size="xs"
                          .src=${r.agents?.portrait_image_url ?? ''}
                          .name=${name}
                          alt=${name}
                        ></velg-avatar>
                        <span class="chorus__tooltip-name">${name}</span>
                        <span class="chorus__tooltip-preview">${r.reaction_text.slice(0, 60)}${r.reaction_text.length > 60 ? '...' : ''}</span>
                      </div>
                    `;
                  })}
                  ${
                    reactions.length > 5
                      ? html`
                    <div class="chorus__tooltip-preview" style="padding-top: var(--space-1);">+${reactions.length - 5} ${msg('more')}</div>
                  `
                      : null
                  }
                </div>
              `
                  : null
              }
            </button>
          `;
        })}
      </div>

      <div class="chorus__labels">
        ${sorted.map(([emotion, reactions]) => {
          const pct = (reactions.length / total) * 100;
          return html`<span class="chorus__label" style="width: ${pct}%">${emotion}</span>`;
        })}
      </div>
    `;
  }

  private _renderReactions() {
    if (this._reactionsLoading) {
      return html`<div class="panel__reactions-loading">${msg('Loading reactions...')}</div>`;
    }

    if (this._reactions.length === 0) {
      return html`<div class="panel__reaction-empty">${msg('No reactions yet')}</div>`;
    }

    // Sentiment bar
    const sentimentBar = this._renderSentimentBar();

    // Top 3 reactions (longest text = most dramatic)
    const sorted = [...this._reactions].sort(
      (a, b) => (b.reaction_text?.length ?? 0) - (a.reaction_text?.length ?? 0),
    );
    const topReactions = sorted.slice(0, 3);
    const remaining = sorted.slice(3);

    return html`
      ${sentimentBar}

      <div class="chorus__top-reactions">
        ${topReactions.map((reaction) => {
          const agentName = reaction.agents?.name ?? reaction.agent_name;
          const portraitUrl = reaction.agents?.portrait_image_url ?? '';
          return html`
            <div class="chorus__reaction-card">
              <div class="chorus__reaction-header">
                <velg-avatar
                  size="xs"
                  .src=${portraitUrl}
                  .name=${agentName}
                  alt=${agentName}
                ></velg-avatar>
                <span class="chorus__reaction-agent">${agentName}</span>
                ${reaction.emotion ? html`<velg-badge variant=${this._getEmotionBadgeVariant(reaction.emotion)}>${reaction.emotion}</velg-badge>` : nothing}
                ${
                  appState.canEdit.value
                    ? html`
                  <button
                    class="chorus__reaction-delete"
                    title=${msg('Delete reaction')}
                    @click=${() => this._handleDeleteReaction(reaction)}
                  >${icons.trash(14)}</button>
                `
                    : nothing
                }
              </div>
              <div class="chorus__reaction-text">${reaction.reaction_text}</div>
            </div>
          `;
        })}
      </div>

      ${
        remaining.length > 0
          ? html`
        <button
          class="chorus__show-all"
          @click=${() => {
            this._showAllReactions = !this._showAllReactions;
          }}
          aria-expanded=${this._showAllReactions}
        >
          ${
            this._showAllReactions
              ? msg('Hide remaining')
              : msg(str`Show ${remaining.length} more reactions`)
          }
        </button>

        ${
          this._showAllReactions
            ? html`
          <div class="chorus__remaining">
            ${remaining.map((reaction) => {
              const agentName = reaction.agents?.name ?? reaction.agent_name;
              const isOpen = this._expandedReactions.has(reaction.id);
              return html`
                <div>
                  <div
                    class="chorus__remaining-item"
                    @click=${() => this._toggleReaction(reaction.id)}
                  >
                    <velg-avatar
                      size="xs"
                      .src=${reaction.agents?.portrait_image_url ?? ''}
                      .name=${agentName}
                      alt=${agentName}
                    ></velg-avatar>
                    <span class="chorus__remaining-agent">${agentName}</span>
                    ${reaction.emotion ? html`<velg-badge variant=${this._getEmotionBadgeVariant(reaction.emotion)}>${reaction.emotion}</velg-badge>` : nothing}
                    <span class="chorus__remaining-preview">${reaction.reaction_text.slice(0, 50)}...</span>
                    ${
                      appState.canEdit.value
                        ? html`
                      <button
                        class="chorus__reaction-delete"
                        title=${msg('Delete reaction')}
                        @click=${(e: MouseEvent) => {
                          e.stopPropagation();
                          this._handleDeleteReaction(reaction);
                        }}
                      >${icons.trash(14)}</button>
                    `
                        : nothing
                    }
                  </div>
                  ${
                    isOpen
                      ? html`
                    <div class="chorus__remaining-body">
                      <div class="chorus__remaining-body-text">${reaction.reaction_text}</div>
                    </div>
                  `
                      : nothing
                  }
                </div>
              `;
            })}
          </div>
        `
            : nothing
        }
      `
          : null
      }
    `;
  }

  private _getEmotionBadgeVariant(emotion: string): string {
    const e = emotion.trim().toLowerCase();
    switch (e) {
      case 'fear':
        return 'warning';
      case 'anger':
      case 'panic':
      case 'despair':
        return 'danger';
      case 'hope':
      case 'resolve':
        return 'success';
      case 'defiance':
        return 'primary';
      default:
        return 'default';
    }
  }

  private _getSimulationName(simId: string): string {
    const sim = this._simulations.find((s) => s.id === simId);
    return sim?.name ?? simId;
  }

  private _handleTriggerEchoClick(): void {
    this._echoTriggerOpen = true;
  }

  private _handleEchoTriggerClose(): void {
    this._echoTriggerOpen = false;
  }

  private _handleEchoTriggered(): void {
    this._echoTriggerOpen = false;
    this._loadEchoes();
    VelgToast.success(msg('Echo triggered successfully'));
  }

  private _handleEchoClick(e: CustomEvent<EventEcho>): void {
    const echo = e.detail;
    if (echo.target_event) {
      this.dispatchEvent(
        new CustomEvent('event-click', {
          detail: echo.target_event,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private _renderBleedProvenance() {
    const evt = this.event;
    if (!evt || evt.data_source !== 'bleed' || !evt.external_refs) return null;

    const refs = evt.external_refs as Record<string, unknown>;
    const sourceSimId = refs.source_simulation_id as string | undefined;
    const echoVector = refs.echo_vector as string | undefined;

    if (!sourceSimId) return null;

    const sourceName = this._getSimulationName(sourceSimId);

    return html`
      <div class="panel__section">
        <velg-section-header>${msg('Bleed Origin')}</velg-section-header>
        <div class="panel__text panel__text--secondary">
          ${msg(str`Originated in ${sourceName}${echoVector ? ` via ${echoVector}` : ''}`)}
        </div>
      </div>
    `;
  }

  private _renderEchoes() {
    return html`
      <div class="panel__section">
        <velg-section-header>
          ${msg(str`Echoes (${this._echoes.length})`)}
        </velg-section-header>

        ${
          this._echoes.length === 0
            ? html`<div class="panel__reaction-empty">${msg('No echoes yet')}</div>`
            : html`
            <div class="panel__reactions">
              ${this._echoes.map(
                (echo) => html`
                  <velg-echo-card
                    .echo=${echo}
                    .simulationName=${this._getSimulationName(echo.target_simulation_id)}
                    @echo-click=${this._handleEchoClick}
                  ></velg-echo-card>
                `,
              )}
            </div>
          `
        }

        ${
          appState.canAdmin.value
            ? html`
            <button
              class="panel__btn panel__btn--edit"
              style="margin-top: var(--space-2);"
              @click=${this._handleTriggerEchoClick}
            >
              ${icons.sparkle()}
              ${msg('Trigger Echo')}
            </button>
          `
            : nothing
        }
      </div>
    `;
  }

  protected render() {
    const evt = this.event;

    return html`
      <velg-side-panel
        .open=${this.open}
        .panelTitle=${evt?.title ?? msg('Event Details')}
      >
        ${
          evt
            ? html`
              <div slot="content">
                <div class="panel__content">
                  <!-- Type & Source badges -->
                  <div class="panel__section">
                    <div class="panel__badges">
                      ${evt.event_type ? html`<velg-badge variant="primary">${evt.event_type}</velg-badge>` : null}
                      ${evt.data_source ? html`<velg-badge variant="info">${evt.data_source}</velg-badge>` : null}
                    </div>
                  </div>

                  <!-- Description -->
                  ${
                    t(evt, 'description')
                      ? html`
                      <div class="panel__section">
                        <velg-section-header>${msg('Description')}</velg-section-header>
                        <div class="panel__text">${this._renderMarkdown(t(evt, 'description'))}</div>
                      </div>
                    `
                      : null
                  }

                  <!-- Occurred At -->
                  ${
                    evt.occurred_at
                      ? html`
                      <div class="panel__section">
                        <velg-section-header>${msg('Occurred At')}</velg-section-header>
                        <div class="panel__text">${formatDateFull(evt.occurred_at)}</div>
                      </div>
                    `
                      : null
                  }

                  <!-- Impact Level -->
                  <div class="panel__section">
                    <velg-section-header>${msg('Impact Level')}</velg-section-header>
                    ${this._renderImpactBar()}
                  </div>

                  <!-- Lifecycle -->
                  ${this._renderLifecycle()}

                  <!-- Location -->
                  ${
                    evt.location
                      ? html`
                      <div class="panel__section">
                        <velg-section-header>${msg('Location')}</velg-section-header>
                        <div class="panel__text">${evt.location}</div>
                      </div>
                    `
                      : null
                  }

                  <!-- Zone Impact -->
                  ${this._renderZoneImpact()}

                  <!-- Tags -->
                  ${
                    evt.tags && evt.tags.length > 0
                      ? html`
                      <div class="panel__section">
                        <velg-section-header>${msg('Tags')}</velg-section-header>
                        <div class="panel__tags">
                          ${evt.tags.map((tag) => html`<span class="panel__tag">${tag}</span>`)}
                        </div>
                      </div>
                    `
                      : null
                  }

                  <!-- Metadata -->
                  ${this._renderMetadata()}

                  <!-- Reactions -->
                  <div class="panel__section">
                    <velg-section-header>
                      ${msg(str`Reactions (${this._reactions.length})`)}
                    </velg-section-header>
                    ${this._renderReactions()}
                  </div>

                  <!-- Bleed Provenance -->
                  ${this._renderBleedProvenance()}

                  <!-- Echoes -->
                  ${this._renderEchoes()}
                </div>
              </div>

              ${
                appState.canEdit.value
                  ? html`
                <button
                  slot="footer"
                  class="panel__btn panel__btn--generate"
                  @click=${this._handleGenerateReactions}
                  ?disabled=${this._generatingReactions}
                >
                  ${icons.brain()}
                  ${this._generatingReactions ? msg('Generating...') : msg('Generate Reactions')}
                </button>
                <button
                  slot="footer"
                  class="panel__btn panel__btn--edit"
                  @click=${this._handleEdit}
                >
                  ${icons.edit()}
                  ${msg('Edit')}
                </button>
                <button
                  slot="footer"
                  class="panel__btn panel__btn--danger"
                  @click=${this._handleDelete}
                >
                  ${icons.trash()}
                  ${msg('Delete')}
                </button>
              `
                  : nothing
              }
            `
            : html`
              <div slot="content">
                <div class="panel__content">
                  <div class="panel__text panel__text--secondary">${msg('No event selected.')}</div>
                </div>
              </div>
            `
        }
      </velg-side-panel>

      <velg-echo-trigger-modal
        .event=${this.event}
        .simulationId=${this.simulationId}
        .simulations=${this._simulations}
        .connections=${this._connections}
        ?open=${this._echoTriggerOpen}
        @modal-close=${this._handleEchoTriggerClose}
        @echo-triggered=${this._handleEchoTriggered}
      ></velg-echo-trigger-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-event-details-panel': VelgEventDetailsPanel;
  }
}
