/**
 * Epoch Alliances Tab — active alliances with tension meters, proposals,
 * upkeep display, and participant overview.
 *
 * Military intelligence dossier aesthetic. Proposals as "INCOMING TRANSMISSION"
 * cards with animated amber borders. Tension as degrading signal bar.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { AllianceProposal, Epoch, EpochParticipant, EpochTeam } from '../../types/index.js';
import { infoBubbleStyles, renderInfoBubble } from '../shared/info-bubble-styles.js';
import './EpochPresenceIndicator.js';

@localized()
@customElement('velg-epoch-alliances-tab')
export class VelgEpochAlliancesTab extends LitElement {
  static styles = [
    infoBubbleStyles,
    css`
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
      .proposal-card {
        padding: var(--space-2) !important;
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
      margin-bottom: var(--space-3);
      transition: all var(--transition-normal);
      position: relative;
      overflow: hidden;
    }

    .alliance::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 3px;
      height: 100%;
      background: var(--color-info);
      transition: width 0.3s ease;
    }

    .alliance:hover {
      border-color: var(--color-gray-500);
      transform: translateX(2px);
    }

    .alliance:hover::before {
      width: 4px;
    }

    .alliance__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: var(--space-2);
    }

    .alliance__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .alliance__upkeep {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-gray-400);
      margin-top: 2px;
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

    /* ── Tension Meter ────────────────────────── */

    .tension-meter {
      position: relative;
      height: 6px;
      background: var(--color-gray-800);
      border-radius: 3px;
      overflow: hidden;
      margin: var(--space-2) 0 var(--space-1);
    }

    .tension-meter__fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.6s ease-out, background-color 0.6s ease-out;
    }

    .tension-meter__label {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-gray-400);
      margin-top: 2px;
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }

    .tension-meter__critical {
      color: var(--color-danger);
      font-weight: 700;
      animation: tension-pulse 1s ease-in-out infinite alternate;
    }

    .tension-meter__elevated {
      color: var(--color-warning);
    }

    @keyframes tension-pulse {
      from { opacity: 1; }
      to { opacity: 0.5; }
    }

    /* ── Proposal Card ────────────────────────── */

    .proposal-card {
      border: 1px dashed var(--color-epoch-accent, #f59e0b);
      background: rgba(245 158 11 / 0.04);
      padding: var(--space-3);
      margin-top: var(--space-2);
      position: relative;
      animation: proposal-enter 0.5s ease-out forwards, proposal-pulse 2s ease-in-out 0.5s infinite alternate;
      opacity: 0;
    }

    @keyframes proposal-enter {
      from {
        opacity: 0;
        transform: translateY(-8px);
        border-color: transparent;
      }
      to {
        opacity: 1;
        transform: translateY(0);
        border-color: var(--color-epoch-accent, #f59e0b);
      }
    }

    @keyframes proposal-pulse {
      from { border-color: var(--color-epoch-accent, #f59e0b); }
      to { border-color: rgba(245 158 11 / 0.35); }
    }

    .proposal-card--accepted {
      border-color: var(--color-success);
      border-style: solid;
      animation: proposal-accepted 0.4s ease-out forwards;
    }

    @keyframes proposal-accepted {
      from {
        background: rgba(74 222 128 / 0.15);
        transform: scale(1.02);
      }
      to {
        background: rgba(74 222 128 / 0.04);
        transform: scale(1);
      }
    }

    .proposal-card--rejected {
      border-color: var(--color-danger);
      border-style: solid;
      opacity: 0.6;
      animation: none;
    }

    .proposal-card--expired {
      border-color: var(--color-gray-500);
      border-style: dotted;
      opacity: 0.5;
      animation: none;
    }

    .proposal-card--own {
      border-color: var(--color-info);
      border-style: dashed;
      animation: proposal-pulse-own 2.5s ease-in-out infinite alternate;
    }

    @keyframes proposal-pulse-own {
      from { border-color: var(--color-info); }
      to { border-color: rgba(56 189 248 / 0.3); }
    }

    .proposal-card__header {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      color: var(--color-epoch-accent, #f59e0b);
      margin-bottom: var(--space-1);
    }

    .proposal-card__name {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-gray-200);
    }

    .proposal-card__info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: var(--space-1);
    }

    .proposal-card__hint {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-gray-400);
    }

    .proposal-card__expiry {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-gray-400);
    }

    .proposal-card__tally {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-gray-300);
    }

    .proposal-card__status {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-gray-300);
    }

    .proposal-card__actions {
      display: flex;
      gap: var(--space-2);
      margin-top: var(--space-2);
    }

    /* ── Vote Buttons ─────────────────────────── */

    .vote-btn {
      padding: var(--space-1) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: 1px solid;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
    }

    .vote-btn::after {
      content: '';
      position: absolute;
      inset: 0;
      background: currentColor;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .vote-btn:hover::after {
      opacity: 0.12;
    }

    .vote-btn:active {
      transform: scale(0.96);
    }

    .vote-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .vote-btn:disabled::after {
      display: none;
    }

    .vote-btn--accept {
      color: var(--color-success);
      border-color: var(--color-success);
      background: transparent;
    }

    .vote-btn--reject {
      color: var(--color-danger);
      border-color: var(--color-danger);
      background: transparent;
    }

    /* ── Alliance Buttons ─────────────────────── */

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

    .alliance-btn--invite {
      color: var(--color-info);
      border-color: var(--color-info);
      background: transparent;
    }

    .alliance-btn--invite:hover {
      background: rgba(56 189 248 / 0.15);
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
      max-width: 380px;
      line-height: 1.5;
    }

    /* ── Participant list ──────────────────── */

    .participant__unaligned {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-gray-400);
    }

    /* ── Empty ───────────────────────────────── */

    .empty-hint {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      color: var(--color-gray-400);
      text-align: center;
      padding: var(--space-4);
    }

    /* ── Reduced motion ──────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .proposal-card,
      .proposal-card--own,
      .tension-meter__critical {
        animation: none !important;
      }
      .proposal-card {
        opacity: 1;
      }
    }
  `,
  ];

  @property({ type: Object }) epoch: Epoch | null = null;
  @property({ type: Object }) myParticipant: EpochParticipant | null = null;
  @property({ type: Array }) participants: EpochParticipant[] = [];
  @property({ type: Array }) teams: EpochTeam[] = [];
  @property({ type: Array }) proposals: AllianceProposal[] = [];
  @property({ type: Number }) currentCycle = 0;
  @property({ type: Boolean }) actionLoading = false;

  @state() private _creatingTeam = false;
  @state() private _teamName = '';

  protected render() {
    const canCreateTeam =
      this.myParticipant &&
      !this.myParticipant.team_id &&
      this.epoch &&
      ['lobby', 'foundation', 'competition'].includes(this.epoch.status);
    const isAligned = !!this.myParticipant?.team_id;
    const activeTeams = this.teams.filter((t) => !t.dissolved_at);
    const isCompetitionPlus =
      this.epoch && ['competition', 'reckoning'].includes(this.epoch.status);

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
              ${
                this._creatingTeam
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
                    <p class="alliance-cta__hint">${msg('Form an alliance to share intelligence and gain +15% diplomatic bonus per ally. Costs 1 RP per member each cycle. Tension builds when allies attack the same target — if it reaches 80, the alliance dissolves.')}</p>
                  </div>
                `
              }
            `
                : nothing
            }
            ${
              activeTeams.length > 0
                ? activeTeams.map((t) => this._renderAllianceCard(t, isAligned, isCompetitionPlus))
                : html`<p class="empty-hint">${msg('No alliances formed yet. Create one to share intelligence with allies and gain diplomatic bonuses — but watch the upkeep cost.')}</p>`
            }
          </div>
        </div>

        <div class="panel">
          <div class="panel__header">
            <h3 class="panel__title">${msg('Participants')}</h3>
          </div>
          <div class="panel__body">
            ${this.participants.map((p) => this._renderParticipant(p, isAligned, isCompetitionPlus))}
          </div>
        </div>
      </div>
    `;
  }

  private _renderAllianceCard(t: EpochTeam, isAligned: boolean, isCompetitionPlus: boolean | null) {
    const members = this.participants.filter((p) => p.team_id === t.id);
    const memberCount = members.length;
    const canJoinInstant =
      this.myParticipant &&
      !isAligned &&
      this.epoch &&
      ['lobby', 'foundation'].includes(this.epoch.status);
    const canRequestJoin = this.myParticipant && !isAligned && isCompetitionPlus;
    const isMember = this.myParticipant?.team_id === t.id;
    const tension = t.tension ?? 0;
    const teamProposals = this.proposals.filter(
      (p) => p.team_id === t.id && p.status === 'pending',
    );
    const myOwnProposal = this.proposals.find(
      (p) =>
        p.team_id === t.id &&
        p.proposer_simulation_id === this.myParticipant?.simulation_id &&
        p.status === 'pending',
    );

    return html`
      <div class="alliance">
        <div class="alliance__header">
          <div>
            <div class="alliance__name">${t.name}</div>
            <div class="alliance__upkeep">
              ${msg('Upkeep')}: ${memberCount} RP/${msg('cycle')}
              ${renderInfoBubble(msg('Each alliance member pays 1 RP per member per cycle. A 3-member alliance costs each member 3 RP/cycle. If your RP reaches 0, upkeep is waived — you will not go into debt.'))}
            </div>
          </div>
        </div>

        ${members.map(
          (p) => html`
            <div class="alliance__member">
              <velg-epoch-presence .simulationId=${p.simulation_id}></velg-epoch-presence>
              ${(p.simulations as { name: string } | undefined)?.name ?? p.simulation_id}
            </div>
          `,
        )}

        <!-- Tension meter -->
        ${
          isMember || tension > 0
            ? html`
            <div class="tension-meter"
              role="meter"
              aria-label=${msg('Alliance tension')}
              aria-valuenow=${tension}
              aria-valuemin="0"
              aria-valuemax="100">
              <div class="tension-meter__fill"
                style="width:${tension}%; background:${this._tensionColor(tension)}"></div>
            </div>
            <span class="tension-meter__label">
              ${msg('Tension')}: ${tension}/100
              ${renderInfoBubble(msg('Tension increases when allies attack the same target (+10). Decays naturally each cycle (-5). Alliance dissolves at 80.'))}
              ${
                tension >= 60
                  ? html` — <strong class="tension-meter__critical">${msg('Critical!')}</strong>`
                  : tension >= 30
                    ? html` — <span class="tension-meter__elevated">${msg('Elevated')}</span>`
                    : nothing
              }
            </span>
          `
            : nothing
        }

        <!-- Pending proposals for this team -->
        ${
          isMember && teamProposals.length > 0
            ? teamProposals.map((p) => this._renderProposalCard(p, memberCount))
            : isMember
              ? html`<p class="proposal-card__hint" style="margin-top: var(--space-2)">${msg('No pending proposals. Unaligned players can request to join your alliance.')}</p>`
              : nothing
        }

        <!-- Own pending proposal (for proposer view) -->
        ${
          !isMember && myOwnProposal
            ? html`
            <div class="proposal-card proposal-card--own">
              <span class="proposal-card__status">
                ${msg('Your request is pending')} — ${(myOwnProposal.votes ?? []).filter((v) => v.vote === 'accept').length}/${memberCount} ${msg('approved')}
              </span>
              <span class="proposal-card__hint">
                ${msg('Team members are reviewing your request. The proposal expires after 2 cycles.')}
              </span>
            </div>
          `
            : nothing
        }

        <!-- Recently resolved proposal (for proposer feedback) -->
        ${this._renderResolvedProposalFeedback(t.id, memberCount)}

        <div class="alliance__actions">
          ${
            canJoinInstant
              ? html`
              <button
                class="alliance-btn alliance-btn--join"
                ?disabled=${this.actionLoading}
                title=${msg('During lobby and foundation phases, you can join instantly without a vote.')}
                @click=${() => this._onJoinTeam(t.id)}
              >${msg('Join')}</button>
            `
              : nothing
          }
          ${
            canRequestJoin && !myOwnProposal
              ? html`
              <button
                class="alliance-btn alliance-btn--join"
                ?disabled=${this.actionLoading}
                title=${msg('During active competition, joining requires team approval. Your request will be voted on by current members.')}
                @click=${() => this._onRequestJoin(t.id)}
              >${msg('Request to Join')}</button>
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
  }

  private _renderResolvedProposalFeedback(teamId: string, _memberCount: number) {
    if (!this.myParticipant) return nothing;
    // Show recently resolved proposals where this user was the proposer
    const resolved = this.proposals.find(
      (p) =>
        p.team_id === teamId &&
        p.proposer_simulation_id === this.myParticipant?.simulation_id &&
        (p.status === 'rejected' || p.status === 'expired'),
    );
    if (!resolved) return nothing;

    const statusClass =
      resolved.status === 'rejected' ? 'proposal-card--rejected' : 'proposal-card--expired';
    const statusMsg =
      resolved.status === 'rejected'
        ? msg('Your request was rejected.')
        : msg('Your request has expired.');

    return html`
      <div class="proposal-card ${statusClass}" style="margin-top: var(--space-2)">
        <span class="proposal-card__status">${statusMsg}</span>
      </div>
    `;
  }

  private _renderProposalCard(p: AllianceProposal, memberCount: number) {
    const acceptCount = (p.votes ?? []).filter((v) => v.vote === 'accept').length;
    const alreadyVoted = (p.votes ?? []).some(
      (v) => v.voter_simulation_id === this.myParticipant?.simulation_id,
    );
    const expiresInCycles = Math.max(0, p.expires_at_cycle - this.currentCycle);
    const proposerName = p.proposer_name ?? p.proposer_simulation_id;

    return html`
      <div class="proposal-card">
        <div class="proposal-card__header">${msg('Incoming Transmission')}</div>
        <div class="proposal-card__name">${proposerName} ${msg('requests to join')}</div>
        <div class="proposal-card__info">
          <span class="proposal-card__hint">
            ${msg('Unanimous approval required')}
            ${renderInfoBubble(msg('All current members must vote Accept for the proposal to pass. A single Reject immediately declines.'))}
          </span>
          <span class="proposal-card__expiry">
            ${
              expiresInCycles === 1
                ? msg(str`Expires in ${expiresInCycles} cycle`)
                : msg(str`Expires in ${expiresInCycles} cycles`)
            }
          </span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-1)">
          <span class="proposal-card__tally"
            aria-label=${msg(str`${acceptCount} of ${memberCount} votes cast`)}>
            ${acceptCount}/${memberCount} ${msg('votes')}
          </span>
          ${
            !alreadyVoted
              ? html`
              <div class="proposal-card__actions">
                <button class="vote-btn vote-btn--accept"
                  aria-label=${msg(str`Accept alliance proposal from ${proposerName}`)}
                  ?disabled=${this.actionLoading}
                  @click=${() => this._onVoteProposal(p.id, 'accept')}>
                  ${msg('Accept')}
                </button>
                <button class="vote-btn vote-btn--reject"
                  aria-label=${msg(str`Reject alliance proposal from ${proposerName}`)}
                  ?disabled=${this.actionLoading}
                  @click=${() => this._onVoteProposal(p.id, 'reject')}>
                  ${msg('Reject')}
                </button>
              </div>
            `
              : html`<span class="proposal-card__hint">${msg('Vote cast')}</span>`
          }
        </div>
      </div>
    `;
  }

  private _renderParticipant(
    p: EpochParticipant,
    isAligned: boolean,
    isCompetitionPlus: boolean | null,
  ) {
    const simName = (p.simulations as { name: string } | undefined)?.name ?? p.simulation_id;
    const pendingProposal = this.proposals.find(
      (pr) => pr.proposer_simulation_id === p.simulation_id && pr.status === 'pending',
    );
    const pendingTeamName = pendingProposal
      ? this.teams.find((t) => t.id === pendingProposal.team_id)?.name
      : null;

    return html`
      <div class="alliance__member">
        <velg-epoch-presence .simulationId=${p.simulation_id}></velg-epoch-presence>
        ${simName}
        ${
          p.team_id
            ? nothing
            : html` <span class="participant__unaligned">(${msg('unaligned')})</span>
            ${
              pendingProposal && pendingTeamName
                ? html`<span class="proposal-card__hint" style="margin-left:var(--space-1)">${msg(str`→ ${pendingTeamName}`)}</span>`
                : nothing
            }
            ${
              isAligned &&
              p.simulation_id !== this.myParticipant?.simulation_id &&
              this.epoch &&
              ['lobby', 'foundation', 'competition'].includes(this.epoch.status) &&
              !this._isMyTeamFull()
                ? html`<button
                  class="alliance-btn alliance-btn--invite"
                  ?disabled=${this.actionLoading}
                  @click=${() => this._onInvitePlayer(p)}
                >${msg('Invite')}</button>`
                : nothing
            }
            ${
              !isAligned &&
              !pendingProposal &&
              isCompetitionPlus &&
              p.simulation_id !== this.myParticipant?.simulation_id
                ? nothing
                : nothing
            }`
        }
      </div>
    `;
  }

  private _tensionColor(tension: number): string {
    if (tension < 30) return 'var(--color-success)';
    if (tension < 60) return 'var(--color-warning)';
    return 'var(--color-danger)';
  }

  private _isMyTeamFull(): boolean {
    if (!this.myParticipant?.team_id || !this.epoch) return false;
    const maxSize = this.epoch.config?.max_team_size ?? 3;
    const memberCount = this.participants.filter(
      (p) => p.team_id === this.myParticipant?.team_id,
    ).length;
    return memberCount >= maxSize;
  }

  // ── Events ──────────────────────────────────────

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

  private _onRequestJoin(teamId: string) {
    this.dispatchEvent(
      new CustomEvent('request-join-team', {
        detail: { teamId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onVoteProposal(proposalId: string, vote: 'accept' | 'reject') {
    this.dispatchEvent(
      new CustomEvent('vote-proposal', {
        detail: { proposalId, vote },
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
