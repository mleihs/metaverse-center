/**
 * AgentLifeTimeline — Classified Bureau Intelligence Intercept Log.
 *
 * Vertical activity feed displaying autonomous agent actions as a
 * surveillance transcript. Each entry connects to a thin timeline
 * spine via colored classification dots. Filters, pagination, and
 * staggered entrance animations create a living document feel.
 *
 * Bureau aesthetic: intercept log framing, classification dots,
 * scanline header texture, significance-based alert tiers.
 *
 * Reuses: VelgAvatar (agent portraits), VelgBadge (activity type tags).
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import {
  agentAutonomyApi,
  type AgentActivity,
} from '../../services/api/AgentAutonomyApiService.js';
import '../shared/VelgAvatar.js';
import '../shared/VelgBadge.js';

// ── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

type ActivityFilter = 'all' | 'social' | 'work' | 'crisis' | 'explore' | 'rest';

const FILTER_OPTIONS: { key: ActivityFilter; label: () => string }[] = [
  { key: 'all', label: () => msg('All') },
  { key: 'social', label: () => msg('Social') },
  { key: 'work', label: () => msg('Work') },
  { key: 'crisis', label: () => msg('Crisis') },
  { key: 'explore', label: () => msg('Explore') },
  { key: 'rest', label: () => msg('Rest') },
];

const FILTER_TO_TYPES: Record<ActivityFilter, string[]> = {
  all: [],
  social: ['socialize', 'seek_comfort', 'collaborate', 'confront', 'celebrate'],
  work: ['work', 'maintain', 'create'],
  crisis: ['confront', 'mourn', 'avoid'],
  explore: ['explore', 'investigate', 'reflect'],
  rest: ['rest'],
};

const ACTIVITY_COLORS: Record<string, string> = {
  socialize: 'var(--color-info)',
  seek_comfort: 'var(--color-info)',
  collaborate: 'var(--color-info)',
  work: 'var(--color-success)',
  maintain: 'var(--color-success)',
  create: 'var(--color-success)',
  rest: 'var(--color-text-muted)',
  explore: 'var(--color-warning)',
  investigate: 'var(--color-warning)',
  reflect: 'var(--color-info)',
  confront: 'var(--color-danger)',
  avoid: 'var(--color-text-muted)',
  celebrate: 'var(--color-success)',
  mourn: 'var(--color-text-muted)',
};

const ACTIVITY_BADGE_VARIANT: Record<string, string> = {
  socialize: 'info',
  seek_comfort: 'info',
  collaborate: 'info',
  work: 'success',
  maintain: 'success',
  create: 'success',
  rest: 'default',
  explore: 'warning',
  investigate: 'warning',
  reflect: 'info',
  confront: 'danger',
  avoid: 'default',
  celebrate: 'success',
  mourn: 'default',
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const mon = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${day}.${mon} ${h}:${m}`;
}

function significanceLevel(sig: number): 'routine' | 'important' | 'critical' {
  if (sig >= 8) return 'critical';
  if (sig >= 5) return 'important';
  return 'routine';
}

function significanceLabel(sig: number): string {
  if (sig >= 8) return msg('Critical');
  if (sig >= 5) return msg('Important');
  return msg('Routine');
}

function formatActivityType(type: string): string {
  return type.replace(/_/g, ' ');
}

function formatEffects(effects: Record<string, unknown>): string {
  const parts: string[] = [];
  const needs = effects.needs_fulfilled as Record<string, number> | undefined;
  if (needs) {
    for (const [k, v] of Object.entries(needs)) {
      if (v) parts.push(`${k} +${Math.round(v as number)}`);
    }
  }
  const opEffect = effects.opinion_effect as number | undefined;
  if (opEffect) {
    parts.push(`opinion ${opEffect > 0 ? '+' : ''}${opEffect}`);
  }
  return parts.join(' · ');
}

// ── Component ───────────────────────────────────────────────────────────────

@localized()
@customElement('velg-agent-life-timeline')
export class AgentLifeTimeline extends LitElement {
  static styles = css`
    /* ── Host ─────────────────────────────────────────── */

    :host {
      display: block;
    }

    /* ── Container ────────────────────────────────────── */

    .timeline {
      position: relative;
      max-width: 720px;
    }

    /* ── Header ───────────────────────────────────────── */

    .timeline__header {
      position: relative;
      padding: var(--space-4);
      margin-bottom: var(--space-4);
      background: var(--color-surface-raised);
      border: var(--border-default);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
    }

    /* Scanline texture on header */
    .timeline__header::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(255, 255, 255, 0.012) 2px,
        rgba(255, 255, 255, 0.012) 4px
      );
      pointer-events: none;
    }

    .timeline__title {
      font-family: var(--font-brutalist);
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--color-text-secondary);
      margin-bottom: var(--space-3);
    }

    /* ── Filter Chips ─────────────────────────────────── */

    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .filter-chip {
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: var(--space-1-5) var(--space-3);
      border: 1px solid var(--color-border);
      background: transparent;
      color: var(--color-text-secondary);
      cursor: pointer;
      transition:
        background var(--duration-fast, 100ms) var(--ease-default),
        color var(--duration-fast, 100ms) var(--ease-default),
        border-color var(--duration-fast, 100ms) var(--ease-default),
        transform var(--duration-fast, 100ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
      min-height: 32px;
    }

    .filter-chip:hover {
      border-color: var(--color-text-muted);
      color: var(--color-text-primary);
    }

    .filter-chip:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .filter-chip:active {
      transform: scale(0.95);
    }

    .filter-chip--active {
      background: color-mix(in srgb, var(--color-primary) 15%, transparent);
      border-color: var(--color-primary);
      color: var(--color-primary);
    }

    /* ── Feed ─────────────────────────────────────────── */

    .feed {
      position: relative;
      padding-left: var(--space-6);
    }

    /* Timeline spine */
    .feed__spine {
      position: absolute;
      left: 7px;
      top: 0;
      width: 2px;
      background: color-mix(in srgb, var(--color-primary) 20%, transparent);
      height: 0;
      transition: height 500ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1));
    }

    .feed__spine--drawn {
      height: 100%;
    }

    /* ── Entry ────────────────────────────────────────── */

    .entry {
      position: relative;
      padding: var(--space-3) var(--space-4);
      margin-bottom: var(--space-2);
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border-light);
      opacity: 0;
      animation: entry-in 350ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
      animation-delay: var(--_delay);
    }

    @keyframes entry-in {
      from {
        opacity: 0;
        transform: translateX(-12px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    /* Rhythm: slight padding variation on even entries */
    .entry:nth-child(even) {
      padding-left: var(--space-5);
    }

    /* Timeline dot */
    .entry__dot {
      position: absolute;
      left: calc(-1 * var(--space-6) + 3px);
      top: var(--space-4);
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--_entry-color);
      border: 2px solid var(--color-surface);
      z-index: 1;
    }

    /* Connecting line from dot to card */
    .entry__connector {
      position: absolute;
      left: calc(-1 * var(--space-6) + 13px);
      top: calc(var(--space-4) + 4px);
      width: calc(var(--space-6) - 13px);
      height: 1px;
      background: color-mix(in srgb, var(--_entry-color) 30%, transparent);
    }

    /* ── Entry Layout ─────────────────────────────────── */

    .entry__row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .entry__agent {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-width: 0;
    }

    .entry__agent-name {
      font-family: var(--font-brutalist);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 120px;
    }

    .entry__meta {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-left: auto;
    }

    .entry__timestamp {
      font-family: var(--font-mono);
      font-size: 9px;
      font-weight: 600;
      color: var(--color-text-muted);
      letter-spacing: 0.04em;
      white-space: nowrap;
    }

    /* ── Significance Dots ────────────────────────────── */

    .sig {
      display: flex;
      gap: 3px;
      align-items: center;
    }

    .sig__dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
    }

    .sig--routine .sig__dot { background: var(--color-text-muted); }

    .sig--important .sig__dot { background: var(--color-primary); }

    .sig--critical .sig__dot {
      background: var(--color-danger);
      animation: sig-pulse 2s ease-in-out infinite;
    }

    @keyframes sig-pulse {
      0%, 100% { opacity: 1; box-shadow: none; }
      50% { opacity: 0.6; box-shadow: 0 0 4px var(--color-danger); }
    }

    /* ── Narrative ────────────────────────────────────── */

    .entry__narrative {
      font-family: var(--font-body);
      font-size: 13px;
      line-height: var(--leading-snug);
      color: var(--color-text-secondary);
      margin-top: var(--space-2);
    }

    /* ── Effects ──────────────────────────────────────── */

    .entry__effects {
      font-family: var(--font-mono);
      font-size: 9px;
      font-weight: 600;
      color: var(--color-text-muted);
      margin-top: var(--space-1-5);
      letter-spacing: 0.04em;
    }

    /* ── Target Agent ─────────────────────────────────── */

    .entry__target {
      font-size: 10px;
      color: var(--color-text-muted);
      margin-top: var(--space-1);
    }

    .entry__target-name {
      color: var(--color-text-secondary);
      font-weight: 600;
    }

    /* ── Empty State ──────────────────────────────────── */

    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-10) var(--space-4);
      text-align: center;
    }

    .empty__label {
      font-family: var(--font-brutalist);
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--color-text-muted);
      animation: empty-drift 4s ease-in-out infinite;
    }

    @keyframes empty-drift {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 0.8; }
    }

    .empty__sub {
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
      margin-top: var(--space-2);
      opacity: 0.6;
    }

    /* ── Load More ────────────────────────────────────── */

    .load-more {
      display: flex;
      justify-content: center;
      padding: var(--space-4) 0;
    }

    .load-more__btn {
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: var(--space-2) var(--space-5);
      border: var(--border-default);
      background: transparent;
      color: var(--color-text-secondary);
      cursor: pointer;
      min-height: 40px;
      transition:
        background var(--duration-fast, 100ms) var(--ease-default),
        color var(--duration-fast, 100ms) var(--ease-default),
        transform var(--duration-fast, 100ms) var(--ease-default);
    }

    .load-more__btn:hover {
      background: var(--color-surface-raised);
      color: var(--color-primary);
    }

    .load-more__btn:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .load-more__btn:active {
      transform: scale(0.97);
    }

    .load-more__btn:disabled {
      opacity: 0.4;
      cursor: default;
    }

    /* ── Loading ──────────────────────────────────────── */

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-8);
    }

    .loading__text {
      font-family: var(--font-brutalist);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--color-text-muted);
      animation: loading-pulse 1.5s ease-in-out infinite;
    }

    @keyframes loading-pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }

    /* ── Reduced Motion ───────────────────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .entry {
        opacity: 1;
        animation: none;
      }

      .feed__spine {
        transition: none;
        height: 100% !important;
      }

      .sig--critical .sig__dot {
        animation: none;
      }

      .empty__label {
        animation: none;
        opacity: 0.6;
      }

      .loading__text {
        animation: none;
        opacity: 1;
      }
    }

    /* ── Responsive ───────────────────────────────────── */

    @media (min-width: 2560px) {
      .timeline {
        max-width: 860px;
        padding: var(--space-4);
      }

      .entry {
        padding: var(--space-4) var(--space-6);
      }

      .entry__agent-name {
        font-size: 12px;
        max-width: 160px;
      }

      .entry__narrative {
        font-size: 14px;
      }
    }

    @media (max-width: 768px) {
      .filters {
        flex-wrap: wrap;
      }

      .timeline {
        max-width: 100%;
      }
    }

    @media (max-width: 480px) {
      .timeline__header {
        padding: var(--space-3);
      }

      .filters {
        flex-wrap: nowrap;
        overflow-x: auto;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
        padding-bottom: var(--space-1);
      }

      .filters::-webkit-scrollbar {
        display: none;
      }

      .filter-chip {
        flex-shrink: 0;
        min-height: 44px;
        padding: var(--space-2) var(--space-3);
      }

      .feed {
        padding-left: var(--space-5);
      }

      .feed__spine {
        left: 5px;
      }

      .entry {
        padding: var(--space-2) var(--space-3);
      }

      .entry__dot {
        left: calc(-1 * var(--space-5) + 1px);
        width: 8px;
        height: 8px;
      }

      .entry__connector {
        left: calc(-1 * var(--space-5) + 9px);
        width: calc(var(--space-5) - 9px);
      }

      .entry__agent-name {
        max-width: 80px;
        font-size: 10px;
      }

      .entry__effects {
        display: none;
      }

      .entry__narrative {
        font-size: 12px;
      }
    }
  `;

  // ── Properties ──────────────────────────────────────────────

  @property({ type: String }) simulationId = '';

  @state() private _activities: AgentActivity[] = [];
  @state() private _loading = true;
  @state() private _loadingMore = false;
  @state() private _hasMore = true;
  @state() private _filter: ActivityFilter = 'all';
  @state() private _minSignificance = 1;
  @state() private _spineDrawn = false;
  @state() private _offset = 0;

  // ── Lifecycle ───────────────────────────────────────────────

  protected updated(changed: PropertyValues) {
    if (changed.has('simulationId') && this.simulationId) {
      this._resetAndFetch();
    }
  }

  // ── Data ────────────────────────────────────────────────────

  private async _resetAndFetch() {
    this._activities = [];
    this._offset = 0;
    this._hasMore = true;
    this._loading = true;
    await this._fetchActivities();
  }

  private async _fetchActivities(append = false) {
    if (!this.simulationId) return;

    try {
      const params: Record<string, string | number> = {
        limit: PAGE_SIZE,
        offset: this._offset,
        min_significance: this._minSignificance,
        since_hours: 168, // 7 days
      };

      // Apply activity type filter
      if (this._filter !== 'all') {
        const types = FILTER_TO_TYPES[this._filter];
        if (types.length === 1) {
          params.activity_type = types[0];
        }
        // For multi-type filters, we fetch all and filter client-side
      }

      const resp = await agentAutonomyApi.listActivities(
        this.simulationId,
        params as Record<string, string | number | undefined>,
      );

      let data = resp.data ?? [];

      // Client-side filter for multi-type categories
      if (this._filter !== 'all') {
        const types = FILTER_TO_TYPES[this._filter];
        if (types.length > 1) {
          data = data.filter(a => types.includes(a.activity_type));
        }
      }

      if (append) {
        this._activities = [...this._activities, ...data];
      } else {
        this._activities = data;
      }

      this._hasMore = data.length >= PAGE_SIZE;
      this._loading = false;
      this._loadingMore = false;

      // Trigger spine draw after first load
      requestAnimationFrame(() => {
        this._spineDrawn = true;
      });
    } catch {
      this._loading = false;
      this._loadingMore = false;
    }
  }

  private _handleFilterChange(filter: ActivityFilter) {
    if (this._filter === filter) return;
    this._filter = filter;
    this._resetAndFetch();
  }

  private _handleLoadMore() {
    this._offset += PAGE_SIZE;
    this._loadingMore = true;
    this._fetchActivities(true);
  }

  // ── Render ──────────────────────────────────────────────────

  render() {
    return html`
      <div class="timeline">
        ${this._renderHeader()}
        ${this._loading
          ? html`<div class="loading"><span class="loading__text">${msg('Scanning intercepts...')}</span></div>`
          : this._activities.length === 0
            ? this._renderEmpty()
            : this._renderFeed()
        }
      </div>
    `;
  }

  private _renderHeader() {
    return html`
      <div class="timeline__header">
        <div class="timeline__title">${msg('Activity intercept log')}</div>
        <div class="filters" role="group" aria-label=${msg('Activity filters')}>
          ${FILTER_OPTIONS.map(opt => html`
            <button
              class="filter-chip ${this._filter === opt.key ? 'filter-chip--active' : ''}"
              @click=${() => this._handleFilterChange(opt.key)}
              aria-pressed=${this._filter === opt.key}
            >
              ${opt.label()}
            </button>
          `)}
        </div>
      </div>
    `;
  }

  private _renderFeed() {
    return html`
      <div class="feed" role="feed" aria-label=${msg('Agent activity feed')}>
        <div class="feed__spine ${this._spineDrawn ? 'feed__spine--drawn' : ''}"></div>
        ${this._activities.map((activity, i) => this._renderEntry(activity, i))}
        ${this._hasMore
          ? html`
            <div class="load-more">
              <button
                class="load-more__btn"
                @click=${this._handleLoadMore}
                ?disabled=${this._loadingMore}
              >
                ${this._loadingMore ? msg('Loading...') : msg('Load earlier entries')}
              </button>
            </div>
          `
          : nothing
        }
      </div>
    `;
  }

  private _renderEntry(activity: AgentActivity, index: number) {
    const color = ACTIVITY_COLORS[activity.activity_type] ?? 'var(--color-text-muted)';
    const variant = ACTIVITY_BADGE_VARIANT[activity.activity_type] ?? 'default';
    const sigLevel = significanceLevel(activity.significance);
    const sigDots = Math.min(activity.significance, 10);
    const effectsText = formatEffects(activity.effects);

    const entryLabel = `${activity.agent_name ?? 'Agent'}: ${formatActivityType(activity.activity_type)}, ${significanceLabel(activity.significance)}`;

    return html`
      <div
        class="entry"
        role="article"
        aria-label=${entryLabel}
        style="--_delay: ${index * 40}ms; --_entry-color: ${color}"
      >
        <div class="entry__dot"></div>
        <div class="entry__connector"></div>

        <div class="entry__row">
          <div class="entry__agent">
            <velg-avatar
              .name=${activity.agent_name ?? '?'}
              .imageUrl=${activity.agent_portrait ?? ''}
              size="xs"
            ></velg-avatar>
            <span class="entry__agent-name">${activity.agent_name ?? msg('Unknown')}</span>
          </div>

          <velg-badge variant=${variant}>
            ${formatActivityType(activity.activity_type)}
          </velg-badge>

          <div class="entry__meta">
            <div
              class="sig sig--${sigLevel}"
              aria-label=${significanceLabel(activity.significance)}
              title=${significanceLabel(activity.significance)}
            >
              ${Array.from({ length: Math.ceil(sigDots / 2) }, () =>
                html`<span class="sig__dot"></span>`,
              )}
            </div>
            <span class="entry__timestamp">${formatTimestamp(activity.created_at)}</span>
          </div>
        </div>

        ${activity.narrative_text
          ? html`<div class="entry__narrative">${activity.narrative_text}</div>`
          : nothing
        }

        ${activity.target_agent_id
          ? html`
            <div class="entry__target">
              ${msg('with')} <span class="entry__target-name">${activity.target_agent_name ?? activity.target_agent_id.slice(0, 8)}</span>
            </div>
          `
          : nothing
        }

        ${effectsText
          ? html`<div class="entry__effects">${effectsText}</div>`
          : nothing
        }
      </div>
    `;
  }

  private _renderEmpty() {
    return html`
      <div class="empty">
        <div class="empty__label">${msg('No intercepts recorded')}</div>
        <div class="empty__sub">${msg('Agent autonomy may be disabled for this simulation')}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-agent-life-timeline': AgentLifeTimeline;
  }
}
