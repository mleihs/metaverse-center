/**
 * AutonomyBriefingSection — Agent Autonomy insert for the Daily Briefing.
 *
 * Renders as a self-contained section that can be embedded in
 * DailyBriefingModal or used standalone. Shows:
 * - AI narrative summary (Bureau prose)
 * - Mood overview (happy/unhappy/crisis agent counts)
 * - Critical + important activity highlights
 * - Relationship changes
 *
 * Fetches its own data via MorningBriefingService API endpoint.
 * Follows the same Bureau dispatch aesthetic as the parent modal.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import {
  type AgentActivity,
  agentAutonomyApi,
  type MorningBriefing,
  type SimulationMoodSummary,
} from '../../services/api/AgentAutonomyApiService.js';
import { t } from '../../utils/locale-fields.js';
import '../shared/VelgAvatar.js';

// ── Component ───────────────────────────────────────────────────────────────

@localized()
@customElement('velg-autonomy-briefing')
export class VelgAutonomyBriefing extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* ── Section Label ────────────────────────────────── */

    .section-label {
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin-bottom: var(--space-3);
      padding-top: var(--space-4);
      border-top: 1px solid var(--color-border-light);
    }

    .section-label:first-child {
      padding-top: 0;
      border-top: none;
    }

    /* ── Narrative ────────────────────────────────────── */

    .narrative {
      font-family: var(--font-body);
      font-size: 13px;
      line-height: var(--leading-relaxed, 1.625);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-4);
      padding: var(--space-3) var(--space-4);
      background: var(--color-surface-sunken);
      border-left: 3px solid var(--color-primary);
      opacity: 0;
      animation: narrative-in 500ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) 200ms forwards;
    }

    @keyframes narrative-in {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── Mood Overview ────────────────────────────────── */

    .mood-overview {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }

    .mood-stat {
      text-align: center;
      padding: var(--space-3);
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border-light);
      opacity: 0;
      animation: stat-in 350ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
    }

    .mood-stat:nth-child(1) { animation-delay: 100ms; }
    .mood-stat:nth-child(2) { animation-delay: 160ms; }
    .mood-stat:nth-child(3) { animation-delay: 220ms; }

    .mood-stat__value {
      font-family: var(--font-brutalist);
      font-size: var(--font-size-xl);
      font-weight: 900;
      line-height: 1;
    }

    .mood-stat__value--happy { color: var(--color-success); }
    .mood-stat__value--unhappy { color: var(--color-danger); }
    .mood-stat__value--crisis { color: var(--color-danger); }
    .mood-stat__value--neutral { color: var(--color-text-secondary); }

    .mood-stat__label {
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-muted);
      margin-top: var(--space-1);
    }

    /* ── Activity Highlights ──────────────────────────── */

    .highlights {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin-bottom: var(--space-3);
    }

    .highlight {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border-light);
      opacity: 0;
      animation: highlight-in 300ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
      animation-delay: var(--_delay);
    }

    @keyframes highlight-in {
      from { opacity: 0; transform: translateX(-6px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .highlight__dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .highlight__dot--critical {
      background: var(--color-danger);
      box-shadow: 0 0 4px color-mix(in srgb, var(--color-danger) 40%, transparent);
    }

    .highlight__dot--important {
      background: var(--color-primary);
    }

    .highlight__text {
      font-size: 12px;
      color: var(--color-text-secondary);
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .highlight__agent {
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-primary);
    }

    .highlight__type {
      font-family: var(--font-mono);
      font-size: 9px;
      color: var(--color-text-muted);
      flex-shrink: 0;
    }

    /* ── Relationship Changes ─────────────────────────── */

    .rel-changes {
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
    }

    .rel-change {
      font-size: 11px;
      color: var(--color-text-muted);
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .rel-change__arrow {
      font-family: var(--font-mono);
      font-size: 10px;
    }

    .rel-change__arrow--positive { color: var(--color-success); }
    .rel-change__arrow--negative { color: var(--color-danger); }

    /* ── Empty / Loading ──────────────────────────────── */

    .empty-note {
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
      font-style: italic;
      text-align: center;
      padding: var(--space-3);
    }

    /* ── Reduced Motion ───────────────────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .narrative,
      .mood-stat,
      .highlight {
        opacity: 1;
        animation: none;
      }
    }

    /* ── Mobile ───────────────────────────────────────── */

    @media (max-width: 480px) {
      .mood-overview {
        grid-template-columns: 1fr 1fr 1fr;
        gap: var(--space-2);
      }

      .mood-stat {
        padding: var(--space-2);
      }

      .mood-stat__value {
        font-size: var(--font-size-lg);
      }

      .narrative {
        font-size: 12px;
        padding: var(--space-2) var(--space-3);
      }
    }
  `;

  // ── Properties ──────────────────────────────────────────────

  @property({ type: String }) simulationId = '';

  @state() private _briefing: MorningBriefing | null = null;
  @state() private _loading = true;

  // ── Lifecycle ───────────────────────────────────────────────

  protected updated(changed: PropertyValues) {
    if (changed.has('simulationId') && this.simulationId) {
      this._fetchBriefing();
    }
  }

  private async _fetchBriefing() {
    try {
      const resp = await agentAutonomyApi.getMorningBriefing(this.simulationId);
      this._briefing = resp.data ?? null;
    } catch {
      this._briefing = null;
    }
    this._loading = false;
  }

  // ── Render ──────────────────────────────────────────────────

  render() {
    if (this._loading || !this._briefing) return nothing;

    const b = this._briefing;
    const mood = b.mood_summary;
    // Only show mood overview when there's meaningful data (not all zeros)
    const hasMoodData =
      mood &&
      mood.agent_count > 0 &&
      (mood.agents_happy > 0 || mood.agents_unhappy > 0 || mood.agents_in_crisis > 0);
    const hasCritical = b.critical_activities.length > 0;
    const hasImportant = b.important_activities.length > 0;
    const hasNarrative = !!b.narrative_text;

    // If nothing interesting to show, don't render the section at all
    if (!hasMoodData && !hasCritical && !hasImportant && !hasNarrative) return nothing;

    return html`
      <div class="section-label">${msg('Agent Autonomy Report')}</div>

      ${hasNarrative ? this._renderNarrative(b) : nothing}
      ${hasMoodData ? this._renderMoodOverview(mood) : nothing}
      ${hasCritical || hasImportant ? this._renderHighlights(b) : nothing}
      ${b.opinion_changes.length > 0 ? this._renderRelChanges(b) : nothing}
    `;
  }

  private _renderNarrative(b: MorningBriefing) {
    const text = t(
      { narrative_text: b.narrative_text, narrative_text_de: b.narrative_text_de },
      'narrative_text',
    );
    if (!text) return nothing;

    return html`<div class="narrative">${text}</div>`;
  }

  private _renderMoodOverview(mood: SimulationMoodSummary) {
    return html`
      <div class="mood-overview">
        <div class="mood-stat">
          <div class="mood-stat__value mood-stat__value--happy">${mood.agents_happy}</div>
          <div class="mood-stat__label">${msg('Content')}</div>
        </div>
        <div class="mood-stat">
          <div class="mood-stat__value mood-stat__value--unhappy">${mood.agents_unhappy}</div>
          <div class="mood-stat__label">${msg('Troubled')}</div>
        </div>
        <div class="mood-stat">
          <div class="mood-stat__value mood-stat__value--crisis">${mood.agents_in_crisis}</div>
          <div class="mood-stat__label">${msg('In crisis')}</div>
        </div>
      </div>
    `;
  }

  private _renderHighlights(b: MorningBriefing) {
    const combined: Array<{ activity: AgentActivity; level: 'critical' | 'important' }> = [
      ...b.critical_activities.map((a) => ({ activity: a, level: 'critical' as const })),
      ...b.important_activities.map((a) => ({ activity: a, level: 'important' as const })),
    ];

    if (combined.length === 0) return nothing;

    return html`
      <div class="section-label">${msg('Significant activity')}</div>
      <div class="highlights">
        ${combined.slice(0, 8).map(
          (item, i) => html`
          <div class="highlight" style="--_delay: ${(i + 3) * 60}ms">
            <div class="highlight__dot highlight__dot--${item.level}"></div>
            <span class="highlight__agent">${item.activity.agent_name ?? '?'}</span>
            <span class="highlight__text">
              ${item.activity.narrative_text ?? item.activity.activity_type.replace(/_/g, ' ')}
            </span>
            <span class="highlight__type">${item.activity.activity_type}</span>
          </div>
        `,
        )}
      </div>
    `;
  }

  private _renderRelChanges(b: MorningBriefing) {
    if (b.opinion_changes.length === 0) return nothing;

    return html`
      <div class="section-label">${msg('Relationship shifts')}</div>
      <div class="rel-changes">
        ${b.opinion_changes.slice(0, 5).map((change) => {
          const opChange = (change as Record<string, unknown>).opinion_change as number;
          const isPositive = opChange > 0;
          return html`
            <div class="rel-change">
              <span class="rel-change__arrow ${isPositive ? 'rel-change__arrow--positive' : 'rel-change__arrow--negative'}">
                ${isPositive ? '+' : ''}${opChange}
              </span>
              <span>${(change as Record<string, unknown>).modifier_type as string}</span>
            </div>
          `;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-autonomy-briefing': VelgAutonomyBriefing;
  }
}
