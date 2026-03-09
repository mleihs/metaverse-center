/**
 * Epoch Alliances Tab — shows active alliances, team creation, and participants.
 *
 * Extracted from EpochCommandCenter.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Epoch, EpochParticipant, EpochTeam } from '../../types/index.js';
import './EpochPresenceIndicator.js';

@localized()
@customElement('velg-epoch-alliances-tab')
export class VelgEpochAlliancesTab extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* ── Overview Grid ────────────────────────── */

    .overview {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-4);
    }

    @media (max-width: 900px) {
      .overview {
        grid-template-columns: 1fr;
      }
    }

    .panel {
      border: 1px solid var(--color-gray-800);
      background: var(--color-gray-900);
      opacity: 0;
      animation: panel-enter 0.4s ease-out forwards;
    }

    .panel:nth-child(1) { animation-delay: 80ms; }
    .panel:nth-child(2) { animation-delay: 160ms; }

    @keyframes panel-enter {
      from {
        opacity: 0;
        transform: translateY(10px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .panel__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--color-gray-800);
    }

    .panel__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-300);
      margin: 0;
    }

    .panel__body {
      padding: var(--space-4);
    }

    /* ── Alliance Card ────────────────────────── */

    .alliance {
      padding: var(--space-3);
      border: 1px solid var(--color-gray-700);
      margin-bottom: var(--space-2);
      transition: all var(--transition-normal);
    }

    .alliance:hover {
      border-color: var(--color-gray-500);
      transform: translateX(2px);
    }

    .alliance__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      margin-bottom: var(--space-1);
    }

    .alliance__member {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-gray-400);
      padding: 2px 0;
    }

    .alliance__actions {
      display: flex;
      gap: var(--space-1);
      margin-top: var(--space-2);
    }

    .alliance-btn {
      padding: 2px var(--space-2);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      border: 1px solid;
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .alliance-btn--join {
      color: var(--color-success);
      border-color: var(--color-success);
      background: transparent;
    }

    .alliance-btn--join:hover {
      background: rgba(74 222 128 / 0.15);
    }

    .alliance-btn--leave {
      color: var(--color-danger);
      border-color: var(--color-danger);
      background: transparent;
    }

    .alliance-btn--leave:hover {
      background: rgba(239 68 68 / 0.15);
    }

    /* ── Alliance Actions ──────────────────── */

    .alliance-actions {
      margin-bottom: var(--space-3);
    }

    .team-form {
      display: flex;
      gap: var(--space-2);
      align-items: center;
    }

    .team-form__input {
      flex: 1;
      padding: var(--space-1-5) var(--space-2);
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      border: 1px solid var(--color-gray-700);
      background: var(--color-gray-900);
      color: var(--color-gray-200);
    }

    .team-form__input:focus {
      outline: none;
      border-color: var(--color-success);
    }

    .team-form__input::placeholder {
      color: var(--color-gray-500);
    }

    /* ── Lobby button (for Create Alliance) ── */

    .lobby-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: 2px solid;
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .lobby-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .lobby-btn--join {
      color: var(--color-success);
      border-color: var(--color-success);
      background: transparent;
    }

    .lobby-btn--join:hover:not(:disabled) {
      background: var(--color-success);
      color: var(--color-gray-950);
    }

    /* ── Prominent CTA for unaligned ──────── */

    .alliance-cta {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-5) var(--space-4);
      border: 2px dashed var(--color-gray-700);
      margin-bottom: var(--space-4);
      text-align: center;
      transition: border-color var(--transition-normal);
    }

    .alliance-cta:hover {
      border-color: var(--color-success);
    }

    .alliance-cta__hint {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-gray-400);
      max-width: 280px;
    }

    /* ── Invite button ───────────────────────── */

    .alliance-btn--invite {
      color: var(--color-info);
      border-color: var(--color-info);
      background: transparent;
    }

    .alliance-btn--invite:hover {
      background: rgba(56 189 248 / 0.15);
    }

    /* ── Unaligned tag ─────────────────────── */

    .participant__unaligned {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-gray-500);
    }

    /* ── Empty ───────────────────────────────── */

    .empty-hint {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-gray-400);
      text-align: center;
      padding: var(--space-4);
    }
  `;

  @property({ type: Object }) epoch: Epoch | null = null;
  @property({ type: Object }) myParticipant: EpochParticipant | null = null;
  @property({ type: Array }) participants: EpochParticipant[] = [];
  @property({ type: Array }) teams: EpochTeam[] = [];
  @property({ type: Boolean }) actionLoading = false;

  @state() private _creatingTeam = false;
  @state() private _teamName = '';

  protected render() {
    const canCreateTeam =
      this.myParticipant &&
      !this.myParticipant.team_id &&
      this.epoch &&
      ['lobby', 'foundation'].includes(this.epoch.status);
    const isAligned = !!this.myParticipant?.team_id;
    const activeTeams = this.teams.filter((t) => !t.dissolved_at);

    return html`
      <div class="overview">
        <div class="panel">
          <div class="panel__header">
            <h3 class="panel__title">${msg('Active Alliances')}</h3>
          </div>
          <div class="panel__body">
            ${
              canCreateTeam
                ? html`
              ${this._creatingTeam
                ? html`
                  <div class="alliance-actions">
                    <div class="team-form">
                      <input
                        class="team-form__input"
                        type="text"
                        aria-label=${msg('Alliance team name')}
                        placeholder=${msg('Alliance name...')}
                        .value=${this._teamName}
                        @input=${(e: Event) => {
                          this._teamName = (e.target as HTMLInputElement).value;
                        }}
                        @keydown=${(e: KeyboardEvent) => {
                          if (e.key === 'Enter') this._onCreateTeam();
                        }}
                      />
                      <button
                        class="alliance-btn alliance-btn--join"
                        ?disabled=${!this._teamName.trim() || this.actionLoading}
                        @click=${this._onCreateTeam}
                      >${msg('Create')}</button>
                      <button
                        class="alliance-btn alliance-btn--leave"
                        @click=${() => {
                          this._creatingTeam = false;
                          this._teamName = '';
                        }}
                      >${msg('Cancel')}</button>
                    </div>
                  </div>
                `
                : html`
                  <div class="alliance-cta">
                    <button class="lobby-btn lobby-btn--join" @click=${() => {
                      this._creatingTeam = true;
                    }}>
                      + ${msg('Create Alliance')}
                    </button>
                    <p class="alliance-cta__hint">${msg('Form an alliance to gain +15% diplomatic bonus per ally. Alliances can be formed during lobby and foundation phases.')}</p>
                  </div>
                `
              }
            `
                : nothing
            }
            ${
              activeTeams.length > 0
                ? activeTeams.map((t) => {
                    const members = this.participants.filter((p) => p.team_id === t.id);
                    const canJoin =
                      this.myParticipant &&
                      !isAligned &&
                      this.epoch &&
                      ['lobby', 'foundation'].includes(this.epoch.status);
                    const isMember = this.myParticipant?.team_id === t.id;

                    return html`
                      <div class="alliance">
                        <div class="alliance__name">${t.name}</div>
                        ${members.map(
                          (p) => html`
                            <div class="alliance__member">
                              <velg-epoch-presence .simulationId=${p.simulation_id}></velg-epoch-presence>
                              ${(p.simulations as { name: string } | undefined)?.name ?? p.simulation_id}
                            </div>
                          `,
                        )}
                        <div class="alliance__actions">
                          ${
                            canJoin
                              ? html`
                            <button
                              class="alliance-btn alliance-btn--join"
                              ?disabled=${this.actionLoading}
                              @click=${() => this._onJoinTeam(t.id)}
                            >${msg('Join')}</button>
                          `
                              : nothing
                          }
                          ${
                            isMember
                              ? html`
                            <button
                              class="alliance-btn alliance-btn--leave"
                              ?disabled=${this.actionLoading}
                              @click=${this._onLeaveTeam}
                            >${msg('Leave')}</button>
                          `
                              : nothing
                          }
                        </div>
                      </div>
                    `;
                  })
                : html`<p class="empty-hint">${msg('No alliances formed.')}</p>`
            }
          </div>
        </div>

        <div class="panel">
          <div class="panel__header">
            <h3 class="panel__title">${msg('Participants')}</h3>
          </div>
          <div class="panel__body">
            ${this.participants.map(
              (p) => html`
              <div class="alliance__member">
                <velg-epoch-presence .simulationId=${p.simulation_id}></velg-epoch-presence>
                ${(p.simulations as { name: string } | undefined)?.name ?? p.simulation_id}
                ${p.team_id
                  ? nothing
                  : html` <span class="participant__unaligned">(${msg('unaligned')})</span>
                    ${isAligned && p.simulation_id !== this.myParticipant?.simulation_id && this.epoch && ['lobby', 'foundation'].includes(this.epoch.status)
                      ? html`<button
                          class="alliance-btn alliance-btn--invite"
                          ?disabled=${this.actionLoading}
                          @click=${() => this._onInvitePlayer(p)}
                        >${msg('Invite')}</button>`
                      : nothing
                    }`
                }
              </div>
            `,
            )}
          </div>
        </div>
      </div>
    `;
  }

  private _onCreateTeam() {
    if (!this._teamName.trim()) return;
    this.dispatchEvent(
      new CustomEvent('create-team', {
        detail: { name: this._teamName.trim() },
        bubbles: true,
        composed: true,
      }),
    );
    this._creatingTeam = false;
    this._teamName = '';
  }

  private _onJoinTeam(teamId: string) {
    this.dispatchEvent(
      new CustomEvent('join-team', {
        detail: { teamId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onLeaveTeam() {
    this.dispatchEvent(
      new CustomEvent('leave-team', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onInvitePlayer(participant: EpochParticipant) {
    const simName = (participant.simulations as { name: string } | undefined)?.name ?? '';
    this.dispatchEvent(
      new CustomEvent('invite-player', {
        detail: { simulationId: participant.simulation_id, simulationName: simName },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-epoch-alliances-tab': VelgEpochAlliancesTab;
  }
}
