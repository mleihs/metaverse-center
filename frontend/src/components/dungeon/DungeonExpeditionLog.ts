/**
 * Expedition Register — every descent that ever happened, and what happened in it.
 *
 * `GET /dungeons/history` and `GET /dungeons/runs/{id}/events` have both existed
 * since the dungeon work shipped, with paginated responses and a participant
 * check on the log. Nothing in the interface called either. A party could go
 * down, lose an agent, come back changed, and leave no trace a player could
 * ever look at again: the chronicle buffer is cleared with the run, and the rows
 * in `dungeon_runs` and `dungeon_events` were write-only.
 *
 * So this is a register, not a feed. Each descent is one ruled line - archetype,
 * verdict, how deep, how many rooms, who went, how long it took - and opening a
 * line pulls its event log up underneath, numbered by depth and room, in the
 * reader's language. The log is fetched only when a line is opened: a world with
 * forty descents would otherwise pull forty logs nobody asked for.
 *
 * The participant rule is the server's and is stated rather than hidden. The log
 * of a descent you were not on answers 403, and the line says so in words
 * instead of showing an error box - the run's own summary is public within the
 * world, its interior is not.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { dungeonApi } from '../../services/api/DungeonApiService.js';
import { captureError } from '../../services/SentryService.js';
import type { DungeonEventResponse, DungeonRunResponse } from '../../types/dungeon.js';
import { getArchetypeDisplayName } from '../../utils/dungeon-formatters.js';
import { icons } from '../../utils/icons.js';
import { localized as pickLocale } from '../../utils/locale-fields.js';
import { markerCornerStyles } from '../shared/marker-styles.js';
import '../shared/LoadingState.js';

const PAGE_SIZE = 10;
const EVENT_PAGE_SIZE = 200;

type LogState =
  | { kind: 'loading' }
  | { kind: 'ready'; events: DungeonEventResponse[] }
  | { kind: 'forbidden' }
  | { kind: 'error' };

@localized()
@customElement('velg-dungeon-expedition-log')
export class VelgDungeonExpeditionLog extends LitElement {
  static styles = [
    markerCornerStyles,
    css`
    :host {
      display: block;
      --_ink: var(--color-text-primary);
      --_rule: var(--color-border);
      --_phosphor: var(--color-success);
      --_phosphor-wash: color-mix(in srgb, var(--color-success) 8%, transparent);
    }

    .register {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .register__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
      padding-bottom: var(--space-2);
      border-bottom: 1px dashed var(--_rule);
    }

    .register__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--_ink);
      margin: 0;
    }

    .register__count {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    /* ── One descent ───────────────────────────────────────── */

    .descent {
      --marker-color: var(--_rule);
      border: 1px solid var(--_rule);
      background: var(--color-surface);
      opacity: 0;
      animation: descent-in var(--duration-entrance) var(--ease-dramatic) forwards;
      animation-delay: calc(var(--i, 0) * var(--duration-stagger));
    }

    @keyframes descent-in {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }

    .descent__line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      width: 100%;
      box-sizing: border-box;
      padding: var(--space-3);
      min-height: 44px;
      text-align: left;
      background: transparent;
      border: none;
      color: var(--_ink);
      cursor: pointer;
      transition: background-color var(--transition-fast);
    }

    .descent__line:hover {
      background: var(--_phosphor-wash);
    }

    .descent__line:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .descent__identity {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-width: 0;
    }

    .descent__chevron {
      display: inline-flex;
      color: var(--color-text-muted);
      transition: transform var(--transition-normal);
    }

    .descent__chevron--open {
      transform: rotate(90deg);
    }

    .descent__name {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .descent__facts {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .verdict {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
      text-transform: uppercase;
    }

    .verdict--completed { color: var(--color-success); }
    .verdict--wiped { color: var(--color-danger); }
    .verdict--abandoned { color: var(--color-warning); }
    .verdict--open { color: var(--color-info); }

    /* ── The log ───────────────────────────────────────────── */

    .log {
      padding: var(--space-3) var(--space-3) var(--space-4);
      border-top: 1px dashed var(--_rule);
      background: var(--color-surface-sunken);
    }

    .log__list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      max-height: 420px;
      overflow-y: auto;
    }

    .entry {
      display: grid;
      grid-template-columns: 84px 1fr;
      gap: var(--space-3);
      align-items: baseline;
      padding-bottom: var(--space-2);
      border-bottom: 1px dashed var(--color-border-light);
    }

    .entry:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .entry__where {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--_phosphor);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .entry__body {
      display: flex;
      flex-direction: column;
      gap: var(--space-0-5);
      min-width: 0;
    }

    .entry__kind {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
    }

    .entry__text {
      font-family: var(--font-prose, var(--font-body));
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--_ink);
      overflow-wrap: anywhere;
    }

    .note {
      font-size: var(--text-xs);
      line-height: var(--leading-snug);
      color: var(--color-text-muted);
    }

    .more {
      align-self: flex-start;
      padding: var(--space-2) var(--space-4);
      min-height: 36px;
      background: transparent;
      border: 1px solid var(--_rule);
      color: var(--color-text-secondary);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      cursor: pointer;
      transition:
        border-color var(--transition-fast),
        color var(--transition-fast);
    }

    .more:hover:not([disabled]) {
      border-color: var(--_phosphor);
      color: var(--_phosphor);
    }

    .more:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    @media (max-width: 640px) {
      .descent__line {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-2);
      }
      .descent__facts {
        white-space: normal;
        flex-wrap: wrap;
      }
      .entry {
        grid-template-columns: 1fr;
        gap: var(--space-0-5);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `,
  ];

  @property({ type: String }) simulationId = '';

  @state() private _runs: DungeonRunResponse[] = [];
  @state() private _total = 0;
  @state() private _loading = true;
  @state() private _error = false;
  @state() private _openRunId: string | null = null;
  @state() private _logs: Record<string, LogState> = {};

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('simulationId') && this.simulationId) {
      this._runs = [];
      this._total = 0;
      this._openRunId = null;
      this._logs = {};
      void this._loadHistory(0);
    }
  }

  private async _loadHistory(offset: number): Promise<void> {
    this._loading = true;
    this._error = false;
    try {
      const isMember = appState.currentSimulationMode.value === 'member';
      const res = isMember
        ? await dungeonApi.getHistory(this.simulationId, PAGE_SIZE, offset)
        : await dungeonApi.getHistoryPublic(this.simulationId, PAGE_SIZE, offset);

      if (res.success && res.data) {
        this._runs = offset === 0 ? res.data : [...this._runs, ...res.data];
        this._total = res.meta?.total ?? this._runs.length;
      } else {
        this._error = true;
      }
    } catch (err) {
      captureError(err, { source: 'VelgDungeonExpeditionLog._loadHistory' });
      this._error = true;
    } finally {
      this._loading = false;
    }
  }

  private async _toggleRun(runId: string): Promise<void> {
    if (this._openRunId === runId) {
      this._openRunId = null;
      return;
    }
    this._openRunId = runId;
    if (this._logs[runId]) return;

    this._logs = { ...this._logs, [runId]: { kind: 'loading' } };
    try {
      const res = await dungeonApi.getEvents(runId, EVENT_PAGE_SIZE, 0);
      if (res.success && res.data) {
        this._logs = { ...this._logs, [runId]: { kind: 'ready', events: res.data } };
        return;
      }
      // The server gates the interior of a descent on having been on it.
      const forbidden = res.error?.status === 403;
      this._logs = { ...this._logs, [runId]: { kind: forbidden ? 'forbidden' : 'error' } };
      if (!forbidden && res.error) {
        captureError(new Error(res.error.message), {
          source: 'VelgDungeonExpeditionLog._toggleRun',
        });
      }
    } catch (err) {
      captureError(err, { source: 'VelgDungeonExpeditionLog._toggleRun' });
      this._logs = { ...this._logs, [runId]: { kind: 'error' } };
    }
  }

  // ── Wording ───────────────────────────────────────────────

  private _verdict(run: DungeonRunResponse): { label: string; tone: string } {
    switch (run.status) {
      case 'completed':
        return { label: msg('Descent complete'), tone: 'completed' };
      case 'wiped':
        return { label: msg('Party lost'), tone: 'wiped' };
      case 'abandoned':
        return { label: msg('Withdrawn'), tone: 'abandoned' };
      default:
        return { label: msg('Still below'), tone: 'open' };
    }
  }

  private _eventLabel(type: DungeonEventResponse['event_type']): string {
    switch (type) {
      case 'room_entered':
        return msg('Room');
      case 'combat_started':
        return msg('Contact');
      case 'combat_resolved':
        return msg('Contact resolved');
      case 'skill_check':
        return msg('Trial');
      case 'encounter_choice':
        return msg('Choice');
      case 'loot_found':
        return msg('Recovered');
      case 'agent_stressed':
        return msg('Strain');
      case 'agent_afflicted':
        return msg('Affliction');
      case 'agent_virtue':
        return msg('Virtue');
      case 'agent_wounded':
        return msg('Wound');
      case 'party_wipe':
        return msg('Party lost');
      case 'boss_defeated':
        return msg('Guardian felled');
      case 'dungeon_completed':
        return msg('Ascent');
      case 'dungeon_abandoned':
        return msg('Withdrawal');
      case 'banter':
        return msg('Word between them');
      default:
        return type;
    }
  }

  private _duration(run: DungeonRunResponse): string | null {
    if (!run.completed_at) return null;
    const ms = new Date(run.completed_at).getTime() - new Date(run.created_at).getTime();
    if (!Number.isFinite(ms) || ms <= 0) return null;
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return msg(str`${minutes} min`);
    const hours = Math.floor(minutes / 60);
    return msg(str`${hours} h ${minutes % 60} min`);
  }

  // ── Render ────────────────────────────────────────────────

  protected render() {
    if (!this.simulationId) return nothing;

    if (this._loading && this._runs.length === 0) {
      return html`
        <velg-loading-state message=${msg('Reading the register')}></velg-loading-state>
      `;
    }
    if (this._error && this._runs.length === 0) {
      return html`<p class="note">${msg('The register could not be read.')}</p>`;
    }
    if (this._runs.length === 0) {
      return html`
        <div class="register">
          ${this._renderHead()}
          <p class="note">
            ${msg('No descent has been recorded in this world. The register begins with the first.')}
          </p>
        </div>
      `;
    }

    return html`
      <div class="register">
        ${this._renderHead()}
        ${this._runs.map((run, i) => this._renderDescent(run, i))}
        ${
          this._runs.length < this._total
            ? html`
              <button
                class="more"
                ?disabled=${this._loading}
                @click=${() => void this._loadHistory(this._runs.length)}
              >
                ${this._loading ? msg('Reading...') : msg('Earlier descents')}
              </button>
            `
            : nothing
        }
      </div>
    `;
  }

  private _renderHead() {
    return html`
      <div class="register__head">
        <h3 class="register__title">${msg('Expedition register')}</h3>
        <span class="register__count">
          ${
            this._total === 1 ? msg('1 descent on file') : msg(str`${this._total} descents on file`)
          }
        </span>
      </div>
    `;
  }

  private _renderDescent(run: DungeonRunResponse, index: number) {
    const open = this._openRunId === run.id;
    const verdict = this._verdict(run);
    const duration = this._duration(run);

    return html`
      <div class="descent marker-corners" style="--i: ${index}">
        <button
          class="descent__line"
          aria-expanded=${open}
          @click=${() => void this._toggleRun(run.id)}
        >
          <span class="descent__identity">
            <span class="descent__chevron ${open ? 'descent__chevron--open' : ''}">
              ${icons.chevronRight(14)}
            </span>
            <span class="descent__name">${getArchetypeDisplayName(run.archetype)}</span>
            <span class="verdict verdict--${verdict.tone}">${verdict.label}</span>
          </span>
          <span class="descent__facts">
            <span>${msg(str`depth ${run.current_depth + 1}/${run.depth_target + 1}`)}</span>
            <span>${msg(str`${run.rooms_cleared}/${run.rooms_total} rooms`)}</span>
            <span>${msg(str`${run.party_agent_ids.length} agents`)}</span>
            ${duration ? html`<span>${duration}</span>` : nothing}
            <span>${new Date(run.created_at).toLocaleDateString()}</span>
          </span>
        </button>
        ${open ? this._renderLog(run.id) : nothing}
      </div>
    `;
  }

  private _renderLog(runId: string) {
    const state = this._logs[runId];
    if (!state || state.kind === 'loading') {
      return html`<div class="log"><p class="note">${msg('Fetching the log...')}</p></div>`;
    }
    if (state.kind === 'forbidden') {
      return html`
        <div class="log">
          <p class="note">
            ${msg('The interior of this descent is closed to you. Only the party that went down may read its log.')}
          </p>
        </div>
      `;
    }
    if (state.kind === 'error') {
      return html`
        <div class="log"><p class="note">${msg('The log could not be read.')}</p></div>
      `;
    }
    if (state.events.length === 0) {
      return html`
        <div class="log">
          <p class="note">${msg('Nothing was written down for this descent.')}</p>
        </div>
      `;
    }

    return html`
      <div class="log">
        <div class="log__list" role="log" aria-label=${msg('Log of the descent')}>
          ${state.events.map(
            (e) => html`
              <div class="entry">
                <span class="entry__where">
                  ${msg(str`D${e.depth + 1} · R${e.room_index + 1}`)}
                </span>
                <span class="entry__body">
                  <span class="entry__kind">${this._eventLabel(e.event_type)}</span>
                  ${
                    pickLocale(e, 'narrative')
                      ? html`<span class="entry__text">${pickLocale(e, 'narrative')}</span>`
                      : nothing
                  }
                </span>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-expedition-log': VelgDungeonExpeditionLog;
  }
}
