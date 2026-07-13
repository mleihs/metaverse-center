/**
 * VelgDriftView — the first playable DRIFT loop (plan §11, P0a vertical slice).
 *
 * Fetches the active chart + the traveler's run, feeds them to the playable
 * `<velg-drift-chart>` board, and drives the loop: a click on a reachable node
 * (the board's drift-node-pick) calls the move RPC; Aufbruch opens a run,
 * Entladung completes it at home, Rückzug abandons it. The HUD reads the run's
 * Kohärenz / Bandbreite / Dissonanz. All mutations are authorised server-side
 * (the RPC validates ownership + adjacency); a refused action resyncs the run.
 */

import { localized, msg, str } from '@lit/localize';
import { effect } from '@preact/signals-core';
import { css, html, LitElement, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { driftApi } from '../../services/api/index.js';
import { captureError } from '../../services/SentryService.js';
import { themeService } from '../../services/ThemeService.js';
import { PLATFORM_DARK_CONFIG } from '../../services/theme-presets.js';
import type {
  DriftChart,
  DriftDock,
  DriftEarnings,
  DriftEffectCard,
  DriftHavarie,
  DriftHavarieChoice,
  DriftHonor,
  DriftProfile,
  DriftQuestOffer,
  DriftQuestState,
  DriftTuning,
  TravelRun,
} from '../../types/drift.js';
import type { ApiResponse } from '../../types/index.js';
import '../shared/ErrorState.js';
import '../shared/LoadingState.js';
import { buttonStyles } from '../shared/button-styles.js';
import { VelgToast } from '../shared/Toast.js';
import './DriftChartHost.js';
import './DriftDockPanel.js';
import './DriftEffectCards.js';
import './DriftLedgerStrip.js';
import './DriftStoryletPanel.js';
import type { VelgDriftEffectCards } from './DriftEffectCards.js';
import { rankLabel } from './DriftLedgerStrip.js';
import type {
  StoryletOption,
  StoryletSelectable,
  VelgDriftStoryletPanel,
} from './DriftStoryletPanel.js';
import { FREQUENCIES, freqColorByName } from './palette.js';

/** The scene currently holding the board: a Havarie decision, the delivery's effect cards,
 *  or the Bureau debriefing after a run closed. Only one at a time — a run that stops to
 *  ask a question must not be asked two. */
type DriftScene =
  | { kind: 'havarie'; run: TravelRun }
  | { kind: 'cards'; cards: DriftEffectCard[]; earnings: DriftEarnings | null }
  | { kind: 'debrief'; run: TravelRun };

/** Read the Havarie block the RPC wrote into the checkpoint. The client NEVER invents an
 *  option: which ones exist is the server's decision (a Kohärenz-Havarie with no cargo has
 *  no Notabwurf), and the prices are read from the tuning catalogue the RPC shipped along. */
function havarieOf(run: TravelRun | null): DriftHavarie | null {
  const block = run?.checkpoint?.havarie;
  if (!block || typeof block !== 'object') return null;
  const h = block as Partial<DriftHavarie>;
  return Array.isArray(h.options) && typeof h.cause === 'string' ? (block as DriftHavarie) : null;
}

/** How much of the board's left edge the HUD covers: its width (320px, `.hud`) plus the
 *  16px inset on either side. The chart frames the graph into the band that is left over —
 *  otherwise a third of the Driftkarte sits under the HUD on a narrow screen. Kept in sync
 *  with the `.hud` rule below by construction (both derive from the same two numbers). */
const HUD_GUTTER_PX = 320 + 32;

// Gauge maxima come from the tuning API (drift_tuning is the source of truth); these
// are only the fail-soft fallbacks if that fetch fails. P0 travellers are class 1.
const DZ_CAP_FALLBACK = 20;
const BB_MAX_FALLBACK = 11;
const WINDOW_BASE_FALLBACK = 8;

@localized()
@customElement('velg-drift-view')
export class VelgDriftView extends LitElement {
  static styles = [
    buttonStyles,
    css`
      :host {
        display: block;
        --_kh: var(--color-success);
        --_bb: var(--color-info);
        --_dz: var(--color-danger);
      }
      .drift {
        position: relative;
        width: 100%;
        height: clamp(540px, calc(100vh - 220px), 920px);
        background: var(--color-surface-sunken);
        border: var(--border-medium);
        box-shadow: var(--shadow-lg);
      }
      .drift__board {
        position: absolute;
        inset: 0;
      }
      /* The scene layer: where the run stops and asks. Sits above the board, below any
         global modal. A scrim dims the chart so the decision is the only thing lit —
         the Havarie's drama is in the ENTRANCE, the clarity is in the choice (§8 M-15). */
      .scene-layer {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-4);
        background: color-mix(in srgb, var(--color-surface-sunken) 72%, transparent);
        overflow-y: auto;
        z-index: var(--z-overlay);
      }
      .scene-layer > * {
        width: min(560px, 100%);
      }
      .hud {
        position: absolute;
        top: var(--space-4);
        left: var(--space-4);
        width: min(320px, calc(100% - var(--space-8)));
        /* The HUD is a panel INSIDE the board, so it must never grow past it. It had no
           bound at all: with a full Depeschen list it already reached the board's edge, and
           the Konto strip pushed it 137px out over the page footer (measured). Bound it to
           the board and let the content scroll — the board frame is the contract. */
        max-height: calc(100% - var(--space-8));
        overflow-y: auto;
        overscroll-behavior: contain;
        /* Shadow DOM does NOT inherit the document's border-box reset — without this the
           padding + border are added ON TOP of max-height and the panel still spills. */
        box-sizing: border-box;
        padding: var(--space-4);
        background: color-mix(in srgb, var(--color-surface) 86%, transparent);
        border: var(--border-medium);
        border-left: var(--border-width-heavy) solid var(--color-primary);
        box-shadow: var(--shadow-md);
        backdrop-filter: blur(2px);
        z-index: var(--z-raised);
        scrollbar-width: thin;
        scrollbar-color: var(--color-border) transparent;
      }
      .hud__title {
        margin: 0 0 var(--space-3);
        font-family: var(--font-brutalist);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist);
        font-size: var(--text-sm);
        color: var(--color-text-primary);
      }
      .hud__haul {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin: 0 0 var(--space-3);
        padding: var(--space-2) var(--space-3);
        background: var(--color-primary-bg);
        border-left: var(--border-width-thick) solid var(--color-primary);
      }
      .hud__haul-label {
        font-family: var(--font-brutalist);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }
      .hud__haul-value {
        font-family: var(--font-mono);
        font-size: var(--text-2xl);
        font-weight: var(--font-bold);
        color: var(--color-primary);
      }
      .hud__warn {
        margin: 0 0 var(--space-3);
        font-size: var(--text-xs);
        line-height: var(--leading-snug);
        color: var(--color-warning);
      }
      .hud__hint {
        margin: 0 0 var(--space-4);
        font-size: var(--text-sm);
        line-height: var(--leading-snug);
        color: var(--color-text-secondary);
      }
      .hud__stats {
        margin: 0 0 var(--space-3);
        display: grid;
        gap: var(--space-3);
      }
      .stat {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: baseline;
        gap: var(--space-1) var(--space-2);
      }
      .stat__label {
        font-family: var(--font-brutalist);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }
      .stat__value {
        margin: 0;
        font-family: var(--font-mono);
        font-size: var(--text-md);
        font-weight: var(--font-bold);
        color: var(--color-text-primary);
      }
      .stat__bar {
        grid-column: 1 / -1;
        height: 4px;
        background: var(--color-surface-raised);
        overflow: hidden;
      }
      .stat__bar > span {
        display: block;
        height: 100%;
        transition: width var(--transition-slow);
      }
      .stat--kh .stat__bar > span {
        background: var(--_kh);
      }
      .stat--bb .stat__bar > span {
        background: var(--_bb);
      }
      .stat--dz .stat__bar > span {
        background: var(--_dz);
      }
      .hud__takt {
        margin: 0 0 var(--space-4);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }
      .hud__actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .hud__section-label {
        margin: 0 0 var(--space-2);
        font-family: var(--font-brutalist);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }
      .hud__manifest,
      .hud__depesche {
        margin: 0 0 var(--space-3);
        padding: var(--space-2) var(--space-3);
        background: var(--color-surface-raised);
        border-left: var(--border-width-thick) solid var(--color-info);
      }
      .hud__depesche {
        border-left-color: var(--color-primary);
      }
      .manifest__item {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-0-5) 0;
      }
      .manifest__dot {
        width: 8px;
        height: 8px;
        flex: none;
        background: var(--_v, var(--color-text-muted));
        box-shadow: 0 0 6px var(--_v, transparent);
      }
      .manifest__name {
        flex: 1;
        font-size: var(--text-sm);
        color: var(--color-text-primary);
      }
      .manifest__vec {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: uppercase;
        color: var(--color-text-muted);
      }
      .depesche__title {
        margin: 0 0 var(--space-1);
        font-family: var(--font-brutalist);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        font-size: var(--text-sm);
        color: var(--color-text-primary);
      }
      .depesche__route,
      .depesche__hint {
        margin: 0 0 var(--space-2);
        font-size: var(--text-xs);
        line-height: var(--leading-snug);
        color: var(--color-text-secondary);
      }
      .depesche__hint {
        color: var(--color-warning);
      }
      .depesche__groups {
        display: flex;
        flex-direction: column;
        gap: var(--space-2-5);
        max-height: 240px;
        overflow-y: auto;
      }
      .depesche__dest {
        margin: 0 0 var(--space-1);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        color: var(--color-text-secondary);
      }
      .depesche__offers {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1-5);
      }
      .depesche__offer {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1) var(--space-2);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-primary);
        background: var(--color-surface-sunken);
        border: var(--border-width-thin) solid var(--color-primary-border);
        cursor: pointer;
        transition:
          background var(--transition-fast),
          border-color var(--transition-fast);
      }
      .depesche__offer:hover:not(:disabled) {
        background: var(--color-primary-bg);
        border-color: var(--color-primary);
      }
      .depesche__offer:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .depesche__offer-dot {
        width: 7px;
        height: 7px;
        flex: none;
        background: var(--_v, var(--color-text-muted));
        box-shadow: 0 0 5px var(--_v, transparent);
      }
      @media (prefers-reduced-motion: reduce) {
        .stat__bar > span,
        .depesche__offer {
          transition-duration: 0.01ms;
        }
      }
    `,
  ];

  /** The traveler's home (anchor) sim; falls back to the current simulation. */
  @property({ type: String, attribute: 'anchor-simulation-id' }) anchorSimulationId = '';

  @state() private _chart: DriftChart | null = null;
  @state() private _run: TravelRun | null = null;
  @state() private _tuning: DriftTuning | null = null;
  @state() private _quests: DriftQuestState | null = null;
  /** Erstvermessung claims on the shared chart — drives the seal overlay on the board. */
  @state() private _honors: DriftHonor[] = [];
  // Stable-identity sets derived from _honors (recomputed only when _honors changes, so
  // the chart's seal layer is not torn down + re-animated on every unrelated re-render).
  private _claimedKeys: Set<string> = new Set();
  private _selfKeys: Set<string> = new Set();
  @state() private _dock: DriftDock | null = null;
  @state() private _dockOpen = false;
  /** The Bureau account behind the ledger strip (null before the traveller's first run). */
  @state() private _profile: DriftProfile | null = null;
  /** The one scene currently holding the board (Havarie / effect cards / debriefing). */
  @state() private _scene: DriftScene | null = null;
  @state() private _loading = true;
  @state() private _error = false;
  @state() private _busy = false;

  /** The sim whose dock is currently surfaced — avoids refetching while you stand on it. */
  private _dockSimId: string | null = null;

  /** The access token the current data reflects — drives the auth-ready self-heal below. */
  private _loadedToken: string | null = null;
  /** Whether the current data was loaded as a member (full HUD) vs. an anon spectator
   *  (public chart only). A guest who logs in mid-view triggers a full member reload. */
  private _loadedAsMember = false;
  private _disposeAuthEffect?: () => void;

  /** Gauge maxima — from drift_tuning when loaded, else the fail-soft fallbacks. */
  private get _dzCap(): number {
    return this._tuning?.dz_cap ?? DZ_CAP_FALLBACK;
  }
  private get _bbMax(): number {
    return this._tuning?.bandwidth_class_bb_max?.['1'] ?? BB_MAX_FALLBACK;
  }
  private get _windowBase(): number {
    return this._tuning?.window_base ?? WINDOW_BASE_FALLBACK;
  }

  connectedCallback(): void {
    super.connectedCallback();
    // DRIFT is the Zwischenraum between worlds, not a simulation interior. The shell
    // applies the anchor sim's per-sim theme to its own host, which cascades into this
    // view (Velgarien → light surfaces + Oswald). Re-assert platform-dark on our own
    // host so the chart, HUD, node labels and dock dossier stay dark-brutalist no matter
    // which world is the anchor. The element is destroyed on route change, taking these
    // inline tokens with it — no teardown needed (and we must not call resetTheme, which
    // would remove the shell's shared custom-CSS element).
    themeService.applyConfig(PLATFORM_DARK_CONFIG, this);
    this._loadedToken = appState.accessToken.value;
    void this._load();
    // Self-heal the auth-token race. On a hard reload the persisted access token can
    // still be stale when this view mounts; /drift/run is strict (get_current_user →
    // 401 on a not-yet-refreshed token) while /drift/chart is not, so the initial load
    // renders the chart but silently drops the active run (the HUD shows AUFBRUCH even
    // though a run exists). When Supabase refreshes the token (onAuthStateChange →
    // appState.accessToken changes) we re-pull the run + quests — or a full reload if
    // the initial load failed outright (token was absent at mount). The first
    // synchronous effect run is a no-op (token === the one _load already used).
    this._disposeAuthEffect?.();
    this._disposeAuthEffect = effect(() => {
      const token = appState.accessToken.value;
      if (!token || token === this._loadedToken) return;
      this._loadedToken = token;
      // Full reload if the first load failed (token absent at mount) or if a guest just
      // became a member (the anon load fetched only the public chart); otherwise the cheap
      // run + quest refresh covers the common already-member token-refresh race.
      if (this._error || !this._loadedAsMember) {
        void this._load();
      } else {
        void this._refreshRun();
        void this._refreshQuests();
      }
    });
  }

  disconnectedCallback(): void {
    this._disposeAuthEffect?.();
    super.disconnectedCallback();
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('_honors')) {
      this._claimedKeys = new Set(this._honors.map((h) => h.node_stable_key));
      this._selfKeys = new Set(this._honors.filter((h) => h.is_self).map((h) => h.node_stable_key));
    }
  }

  private _load = async (): Promise<void> => {
    this._loading = true;
    this._error = false;
    try {
      // Public-first (plan §22.2): the shared chart topology is the public face, so an
      // anonymous spectator loads only the chart. Run / quests / honors / tuning are
      // membership-gated by design — a guest sees the Driftkarte but no personal HUD,
      // manifest or seal overlay. The mode decision lives here at the call site (never in
      // the API layer); appState.isAuthenticated is the canonical authed signal.
      if (appState.isAuthenticated.value) {
        const [chartRes, runRes, tuningRes, questRes, honorRes, profileRes] = await Promise.all([
          driftApi.getChart('member'),
          driftApi.getRun(),
          driftApi.getTuning(),
          driftApi.getQuests(),
          driftApi.getHonors(),
          driftApi.getProfile(),
        ]);
        this._chart = chartRes.success ? (chartRes.data ?? null) : null;
        this._run = runRes.success ? (runRes.data ?? null) : null;
        if (tuningRes.success) this._tuning = tuningRes.data;
        if (questRes.success) this._quests = questRes.data;
        if (honorRes.success) this._honors = honorRes.data ?? [];
        if (profileRes.success) this._profile = profileRes.data ?? null;
        if (!chartRes.success) this._error = true;
        this._loadedAsMember = true;
        // Resumed onto a foreign broadcast edge? Surface its dossier.
        if (this._run) void this._maybeDock(this._run);
        // Resumed INTO a wreck: the decision is still open and it is the only thing that
        // matters — a traveller who closes the tab mid-Havarie comes back to the scene.
        if (this._run?.status === 'havarie') this._scene = { kind: 'havarie', run: this._run };
      } else {
        const chartRes = await driftApi.getChart('public');
        this._chart = chartRes.success ? (chartRes.data ?? null) : null;
        this._run = null;
        this._quests = null;
        this._honors = [];
        if (!chartRes.success) this._error = true;
        this._loadedAsMember = false;
      }
    } catch (err) {
      captureError(err, { source: 'VelgDriftView._load' });
      this._error = true;
    } finally {
      this._loading = false;
    }
  };

  /** A refused refetch is not nothing: the HUD then shows a stale account, a stale manifest
   *  or a stale seal overlay, and the traveller acts on numbers that are no longer true. It
   *  is not worth a toast (the mutation itself already spoke), but it IS worth observing —
   *  silence here is how a wrong HUD reaches production unnoticed. */
  private _refetchFailed(what: string, message?: string): void {
    captureError(new Error(`drift refetch failed: ${what}${message ? ` – ${message}` : ''}`), {
      source: `VelgDriftView._refresh${what}`,
    });
  }

  private async _refreshRun(): Promise<void> {
    const res = await driftApi.getRun();
    if (res.success) this._run = res.data ?? null;
    else this._refetchFailed('Run', res.error?.message);
  }

  private async _refreshQuests(): Promise<void> {
    const res = await driftApi.getQuests();
    if (res.success) this._quests = res.data;
    else this._refetchFailed('Quests', res.error?.message);
  }

  /** Re-pull the shared-chart honors (after an Entladung, newly-won seals appear). */
  private async _refreshHonors(): Promise<void> {
    const res = await driftApi.getHonors();
    if (res.success) this._honors = res.data ?? [];
    else this._refetchFailed('Honors', res.error?.message);
  }

  /** Accept a deliver Depesche at the current world edge → cargo bound to the run. */
  private _acceptOffer(offer: DriftQuestOffer): void {
    const run = this._run;
    if (!run) return;
    void this._mutate(
      () =>
        driftApi.acceptQuest(
          run.id,
          run.run_version,
          offer.template_key,
          offer.target_simulation_id,
        ),
      async (data) => {
        this._run = data.run;
        await this._refreshQuests();
        VelgToast.success(msg(str`Depesche angenommen – Ziel: ${offer.target_simulation_name}.`));
      },
      'VelgDriftView._acceptOffer',
    );
  }

  /** Deliver the carried Depesche at the target broadcast edge → fires the gate.
   *
   *  P0 answered this with a counting toast ("3 Wirkungen"). Now the delivery opens the
   *  Wirkungsbericht: one card per effect, with the named world it landed in and a link to
   *  the receipt — and a redacted card for every effect the world's hospitality refused.
   *  That refusal is not a failure to hide; it is the world answering. */
  private _deliver(): void {
    const run = this._run;
    const active = this._quests?.active;
    if (!run || !active) return;
    void this._mutate(
      () => driftApi.advanceQuest(active.id, run.id, run.run_version),
      async (data) => {
        this._run = data.run;
        await this._refreshQuests();
        // The account is refreshed when the scene CLOSES, not here: the strip lives in the
        // HUD, the HUD sits behind the scene's scrim, and a count-up that runs while it is
        // dimmed is a ceremony nobody attends (§8 M-01 fires on the traveller's return).
        this._scene = { kind: 'cards', cards: data.cards, earnings: data.earnings };
      },
      'VelgDriftView._deliver',
    );
  }

  /** Re-pull the Bureau account (after any act that pays: delivery, Entladung, exam). */
  private async _refreshProfile(): Promise<void> {
    const res = await driftApi.getProfile();
    if (res.success) this._profile = res.data ?? null;
    else this._refetchFailed('Profile', res.error?.message);
  }

  /** Sit the clearance exam. The strip only offers the button when the server says every
   *  precondition holds (exam_ready), so this path is the happy one by construction — a
   *  refusal still resyncs the account rather than trusting the click. */
  private _sitExam(e: CustomEvent<{ rank: string }>): void {
    void this._mutate(
      () => driftApi.sitClearanceExam(e.detail.rank),
      async (result) => {
        await this._refreshProfile();
        VelgToast.success(
          msg(
            str`Prüfung bestanden: ${rankLabel(result.clearance_rank)}. Gebühr ${result.fee_paid} Siegel.`,
          ),
        );
      },
      'VelgDriftView._sitExam',
    );
  }

  /** Resolve a Havarie. The choice and any jettisoned cargo are validated server-side
   *  against what the wreck actually offered — the client cannot smuggle an option in. */
  private _resolveHavarie(e: CustomEvent<{ key: string; selected: string[] }>): void {
    const run = this._run;
    if (!run) return;
    const choice = e.detail.key as DriftHavarieChoice;
    void this._mutate(
      () =>
        driftApi.resolveHavarie(
          run.id,
          run.run_version,
          choice,
          choice === 'notabwurf' ? e.detail.selected : undefined,
        ),
      async (resolved) => {
        this._scene = null;
        this._adoptRun(resolved);
        if (resolved.status === 'active') {
          // The run goes on: no debriefing will open, so the account is refreshed here (a
          // Notruf marks a debt, an Überziehen pays nothing — either way the strip must tell
          // the truth on the next glance). A terminal outcome refreshes on debriefing-close.
          await this._refreshProfile();
          VelgToast.info(this._havarieOutcome(choice));
        }
      },
      'VelgDriftView._resolveHavarie',
    );
  }

  /** What just happened, in one line — for the options that KEEP the run alive (the ones
   *  that end it get the full debriefing instead). */
  private _havarieOutcome(choice: DriftHavarieChoice): string {
    switch (choice) {
      case 'notabwurf':
        return msg('Fracht abgeworfen. Kohärenz stabilisiert, das Fenster ist kürzer.');
      case 'notruf':
        return msg('Notruf abgesetzt. Das Bureau schleppt dich heim – der Vermerk bleibt.');
      case 'ueberziehen':
        return msg('Überzogen. Jeder weitere Takt kostet Dissonanz.');
      default:
        return msg('Havarie beigelegt.');
    }
  }

  private _closeScene = (): void => {
    // Closing a scene that PAID is the moment the account may move — and the moment the
    // traveller is looking at the HUD again. That is where the odometer belongs.
    const paid = this._scene?.kind === 'cards' || this._scene?.kind === 'debrief';
    this._scene = null;
    if (paid) void this._refreshProfile();
  };

  /** After a refused mutation the run has been resynced — the SCENE must follow it.
   *
   *  It held a snapshot: the panel rendered its options from the run object it was opened
   *  with. If the Havarie had meanwhile been settled elsewhere (a second tab, or the 48 h TTL
   *  firing server-side), the panel stayed up on that dead snapshot and every option came
   *  back NOT_IN_HAVARIE — forever, with no way to dismiss it. A scene is a view OF the run,
   *  so it is re-derived from the run, never remembered past it. */
  private _resyncScene(): void {
    if (this._scene?.kind !== 'havarie') return;
    const run = this._run;
    this._scene = run?.status === 'havarie' ? { kind: 'havarie', run } : null;
  }

  /** Escape closes a scene the traveller is allowed to walk away from. A Havarie is not one
   *  of them: the run is stopped until it is answered, and an Escape that silently dismissed
   *  the decision would leave a wreck on the board with no way back to it. */
  private _onSceneKeydown = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || !this._scene || this._scene.kind === 'havarie') return;
    e.stopPropagation();
    this._closeScene();
  };

  /** Display label for a cargo family (the 7 frequency-matter slugs, concept §7.8). */
  private _cargoLabel(family: string): string {
    switch (family) {
      case 'kontrakte':
        return msg('Kontrakte');
      case 'idiome':
        return msg('Idiome');
      case 'erinnerungsstuecke':
        return msg('Erinnerungsstück');
      case 'resonanzkerne':
        return msg('Resonanzkern');
      case 'blaupausen':
        return msg('Blaupause');
      case 'traumfracht':
        return msg('Traumfracht');
      case 'sehnsuchtsgut':
        return msg('Sehnsuchtsgut');
      default:
        return family;
    }
  }

  /** Group acceptable Depeschen by destination world so the HUD reads as "where can I
   *  send a dispatch, and what can I carry there" instead of a flat wall of look-alike
   *  buttons (template × world is the P0c offer set — §9 selector curation is later).
   *  Sorted by world name = stable order across refetches. */
  private _groupOffers(
    offers: DriftQuestOffer[],
  ): { id: string; name: string; offers: DriftQuestOffer[] }[] {
    const groups = new Map<string, { id: string; name: string; offers: DriftQuestOffer[] }>();
    for (const o of offers) {
      const g = groups.get(o.target_simulation_id);
      if (g) {
        g.offers.push(o);
      } else {
        groups.set(o.target_simulation_id, {
          id: o.target_simulation_id,
          name: o.target_simulation_name,
          offers: [o],
        });
      }
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Surface a FOREIGN world's dossier on docking at its broadcast edge; dismiss it
   *  when the traveller is anywhere else (home, an interstitial, the core). */
  private async _maybeDock(run: TravelRun): Promise<void> {
    const anchor = this.anchorSimulationId || appState.currentSimulation.value?.id;
    const node = this._chart?.nodes.find((n) => n.id === run.position_node_id);
    const foreignSim =
      node?.node_type === 'broadcast_rand' && node.simulation_id && node.simulation_id !== anchor
        ? node.simulation_id
        : null;
    if (!foreignSim) {
      this._dockOpen = false;
      this._dockSimId = null;
      return;
    }
    if (foreignSim === this._dockSimId) return; // already showing this world
    this._dockSimId = foreignSim;
    try {
      const res = await driftApi.getDock(foreignSim);
      if (res.success && res.data) {
        this._dock = res.data;
        this._dockOpen = true;
      }
    } catch (err) {
      captureError(err, { source: 'VelgDriftView._maybeDock' });
    }
  }

  private _closeDock = (): void => {
    this._dockOpen = false;
  };

  /**
   * The one mutation runner: busy-guard, call the RPC, hand a success payload to the
   * caller's `onSuccess`, and on a refused action map the error to a friendly toast +
   * resync (the server is the only truth). Generic over the response type so the run
   * lifecycle, accept and deliver all share the guard + error/resync path.
   */
  private async _mutate<T>(
    fn: () => Promise<ApiResponse<T>>,
    onSuccess: (data: T) => void | Promise<void>,
    source: string,
  ): Promise<void> {
    if (this._busy) return;
    this._busy = true;
    try {
      const res = await fn();
      if (res.success) {
        await onSuccess(res.data);
      } else {
        VelgToast.error(this._friendlyError(res.error.message ?? ''));
        await this._refreshRun();
        await this._refreshQuests();
        this._resyncScene();
      }
    } catch (err) {
      captureError(err, { source });
      VelgToast.error(msg('Etwas im Drift hat versagt.'));
    } finally {
      this._busy = false;
    }
  }

  /** onSuccess for the run-lifecycle mutations (open/move/complete/abandon): a terminal
   *  status drops back to the Aufbruch state + announces the outcome; otherwise adopt the
   *  run, surface a foreign dock, and refresh the quest snapshot (position/cargo changed). */
  private _adoptRun = (run: TravelRun): void => {
    if (run.status === 'completed' || run.status === 'abandoned') {
      this._run = null;
      this._quests = null;
      this._closeDock();
      // The Bureau debriefing replaces the P0 toast salvo: one dossier that states what the
      // run brought in, what it cost, and how it ended (§8 M-04). The account is refreshed
      // when the traveller closes it (_closeScene) — the count-up plays to a lit HUD, not to
      // one dimmed behind the scrim.
      this._scene = { kind: 'debrief', run };
    } else if (run.status === 'havarie') {
      // The floor gave way. Everything else waits.
      this._run = run;
      this._closeDock();
      this._scene = { kind: 'havarie', run };
      void this._refreshQuests();
    } else {
      this._run = run;
      void this._maybeDock(run);
      void this._refreshQuests();
    }
  };

  /**
   * The Bureau debriefing: the run's own account of itself, in the Bureau's voice.
   *
   * Pure template text parameterised with the run's facts (no LLM touchpoint in W1 — KPI 6
   * says the template must carry it). It replaces the P0 toast salvo, which stacked up to
   * three messages that scrolled past before the traveller could read them.
   */
  private _debriefProse(run: TravelRun): string {
    const cp = run.checkpoint;
    const banked = Number(cp.haul_banked ?? 0);
    const lost = Number(cp.haul_lost ?? 0);
    const honors = Number(cp.honors_won ?? 0);
    const closeReason = typeof cp.close_reason === 'string' ? cp.close_reason : null;
    const scatter = cp.scattered;
    const scattered =
      scatter !== null && typeof scatter === 'object' && 'scattered' in scatter
        ? Number((scatter as { scattered: unknown }).scattered)
        : 0;

    const lines: string[] = [];

    if (run.status === 'completed') {
      lines.push(
        closeReason === 'rueckruf'
          ? msg(
              str`Rückruf bestätigt. Von der Vermessung dieser Fahrt sind ${banked} Punkte durch die Schleuse gekommen – der Rest blieb im Zwischenraum.`,
            )
          : msg(str`Entladung protokolliert. ${banked} Punkte Vermessung sind gesichert.`),
      );
      if (honors > 0) {
        lines.push(
          msg(
            str`Erstvermessung: ${honors} Knoten hat vor dir niemand kartiert. Dein Siegel steht jetzt auf der gemeinsamen Karte.`,
          ),
        );
      }
    } else if (scattered > 0) {
      lines.push(
        msg(
          str`Zerfaserung. ${lost} Punkte Vermessung sind verloren, und ${scattered} Depesche(n) verwehen als Echo über den Welten, für die sie bestimmt waren.`,
        ),
      );
    } else if (lost > 0) {
      lines.push(msg(str`Zerfaserung. ${lost} Punkte Vermessung sind verloren.`));
    } else {
      lines.push(msg('Rückzug eingeleitet. Die Fahrt ist ohne Eintrag geschlossen.'));
    }

    if (run.earnings) {
      lines.push(
        msg(
          str`Gutgeschrieben: ${run.earnings.siegel_earned} Siegel, ${run.earnings.vp_earned} VP. Kontostand: ${run.earnings.siegel_balance} Siegel.`,
        ),
      );
    }

    return lines.join(' ');
  }

  /** The wreck's own deadline, in words. The Havarie carries an `expires_at` (48 h) after
   *  which it unravels whatever the traveller would have picked — a fact that was typed,
   *  shipped and never shown. A deadline nobody is told about is not a deadline, it is a
   *  trap; and "decide now" reads very differently when you know how long "now" lasts. */
  private _havarieDeadline(hav: DriftHavarie): string {
    if (!hav.expires_at) return '';
    const hours = Math.floor((new Date(hav.expires_at).getTime() - Date.now()) / 3_600_000);
    if (Number.isNaN(hours)) return '';
    if (hours <= 0)
      return msg('Die Frist ist abgelaufen – der Zwischenraum entscheidet gleich selbst.');
    if (hours < 2) return msg('Weniger als eine Stunde, dann zerfasert das Wrack von selbst.');
    return msg(
      str`Bleibt das Wrack ${hours} Stunden unbeantwortet, entscheidet der Zwischenraum: Zerfaserung.`,
    );
  }

  /** Havarie → the scene's options, built from the SERVER's catalogue (checkpoint), never
   *  from a client-side copy that could quietly drift out of date. Every price on a chip is
   *  the price the RPC will actually charge. */
  private _havarieOptions(hav: DriftHavarie): StoryletOption[] {
    const cat = hav.catalogue ?? {};
    const num = (key: string, field: string, fallback: number): number =>
      Number(cat[key]?.[field] ?? fallback);

    const build: Record<DriftHavarieChoice, () => StoryletOption> = {
      notabwurf: () => ({
        key: 'notabwurf',
        label: msg('Notabwurf'),
        detail: msg(
          'Fracht über Bord – Ballast gegen Kohärenz. Was du behältst, bleibt an Bord; was du wirfst, sinkt ungesendet in den Drift.',
        ),
        chips: [
          msg(str`+${num('notabwurf', 'kh_restore', 30)} Kohärenz`),
          msg(str`−${num('notabwurf', 'window_cost', 2)} Takte`),
        ],
        requiresSelection: true,
      }),
      notruf: () => ({
        key: 'notruf',
        label: msg('Notruf'),
        detail: msg(
          'Das Bureau schleppt dich heim. Die Fracht bleibt bei dir, die Vermessung nicht – und der Schuldvermerk steht in deiner Akte.',
        ),
        chips: [
          msg(str`Haul ×${num('notruf', 'haul_mult', 0.5)}`),
          msg(str`${num('notruf', 'siegel_debt', 10)} Siegel Schuld`),
        ],
      }),
      zerfaserung: () => ({
        key: 'zerfaserung',
        label: msg('Zerfaserung'),
        detail: msg(
          'Du lässt los. Die Fracht verweht als Echo über den Welten, für die sie bestimmt war – und dein Name trägt eine Narbe mehr.',
        ),
        chips: [msg('Vermessung verloren'), msg('Narbe')],
        danger: true,
      }),
      ueberziehen: () => ({
        key: 'ueberziehen',
        label: msg('Überziehen'),
        detail: msg(
          'Bleib über das Permit hinaus. Der Bleed bemerkt es: jeder weitere Takt kostet Dissonanz, bis die Kohärenz nachgibt.',
        ),
        chips: [msg(str`+${num('ueberziehen', 'dz_per_takt', 5)} Dissonanz je Takt`)],
      }),
      rueckruf: () => ({
        key: 'rueckruf',
        label: msg('Rückruf'),
        detail: msg(
          'Geordneter Abbruch. Die Schleuse nimmt, was durchpasst – der Rest bleibt im Zwischenraum.',
        ),
        chips: [msg(str`Haul ×${num('rueckruf', 'haul_mult', 0.7)}`), msg('Fahrt endet')],
      }),
    };

    return hav.options.filter((o) => o in build).map((o) => build[o]());
  }

  /** The manifest the Notabwurf may throw overboard — the run's own cargo, nothing else. */
  private _havarieSelectables(): StoryletSelectable[] {
    return (this._quests?.cargo ?? []).map((c) => ({
      id: c.id,
      label: this._cargoLabel(c.family),
      hint: c.vector,
    }));
  }

  private _open(): void {
    const anchor = this.anchorSimulationId || appState.currentSimulation.value?.id;
    if (!anchor) {
      VelgToast.error(msg('Anchor to a home simulation before you set out.'));
      return;
    }
    void this._mutate(() => driftApi.openRun(anchor), this._adoptRun, 'VelgDriftView._open');
  }

  private _onNodePick(e: CustomEvent<{ nodeId: string }>): void {
    const run = this._run;
    if (!run) return;
    void this._mutate(
      () => driftApi.move(run.id, run.run_version, e.detail.nodeId),
      this._adoptRun,
      'VelgDriftView._move',
    );
  }

  private _complete(): void {
    const run = this._run;
    if (!run) return;
    void this._mutate(
      () => driftApi.complete(run.id, run.run_version),
      (closed) => {
        // Two deliberately separate sources, written in the same fn_travel_complete
        // transaction: the ceremony toast reads the count off the completion checkpoint
        // (via _adoptRun), the seal overlay refetches the canonical chart_honors table.
        this._adoptRun(closed);
        void this._refreshHonors();
      },
      'VelgDriftView._complete',
    );
  }

  private _abandon(): void {
    const run = this._run;
    if (!run) return;
    void this._mutate(
      () => driftApi.abandon(run.id, run.run_version),
      this._adoptRun,
      'VelgDriftView._abandon',
    );
  }

  /** Map a raw RPC error to a friendly, in-world German message. */
  private _friendlyError(message: string): string {
    if (message.includes('NOT_AT_HOME')) return msg('Entladung nur an deiner Heimat-Broadcast.');
    if (message.includes('NOT_ADJACENT')) return msg('Dieser Node ist von hier nicht erreichbar.');
    if (message.includes('NOT_AT_TARGET'))
      return msg('Trage die Depesche erst zur Ziel-Broadcast.');
    if (message.includes('QUEST_ACTIVE')) return msg('Du trägst bereits eine Depesche.');
    if (message.includes('CARGO_MISSING')) return msg('Die Fracht ist nicht mehr an Bord.');
    if (message.includes('RUN_STALE')) return msg('Aus dem Takt geraten, neu synchronisiert.');
    // Havarie (migration 265) + Bureau ledger (264)
    if (message.includes('NOT_IN_HAVARIE'))
      return msg('Diese Fahrt liegt nicht in Havarie. Die Lage hat sich bereits geklärt.');
    if (message.includes('INVALID_CHOICE'))
      return msg('Diese Option steht bei dieser Havarie nicht offen.');
    if (message.includes('NOTHING_SELECTED'))
      return msg('Wähle zuerst, welche Fracht über Bord geht.');
    if (message.includes('CARGO_NOT_ABOARD'))
      return msg('Diese Fracht ist nicht an Bord dieser Fahrt.');
    if (message.includes('VP_TOO_LOW'))
      return msg('Für diese Prüfung fehlen dir noch Vermessungspunkte.');
    if (message.includes('SIEGEL_TOO_LOW')) return msg('Die Prüfungsgebühr übersteigt dein Konto.');
    if (message.includes('RANK_ALREADY_HELD')) return msg('Diesen Rang trägst du bereits.');
    if (message.includes('GATE_CLOSED')) return msg('Das Bureau hat diesen Schalter geschlossen.');
    return message || msg('Der Drift hat das verweigert.');
  }

  private _positionName(): string {
    const id = this._run?.position_node_id;
    const node = id ? this._chart?.nodes.find((n) => n.id === id) : null;
    return node?.stable_key ?? msg('Ortung läuft');
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state .message=${msg('Tuning the Driftkarte…')}></velg-loading-state>`;
    }
    if (this._error) {
      return html`<velg-error-state
        .message=${msg('The Driftkarte is unreachable.')}
        show-retry
        @retry=${this._load}
      ></velg-error-state>`;
    }

    const run = this._run;
    const freqIndex = run ? Math.max(0, FREQUENCIES.indexOf(run.frequency)) : 2;
    const dz = run ? Math.min(1, run.dissonanz / this._dzCap) : 0.12;

    // A scene is modal in fact, so it must be modal in the DOM: `inert` takes the board and
    // the HUD out of the tab order and out of pointer reach entirely. The scrim only stopped
    // POINTERS — a keyboard traveller could still tab to Entladung / Rückzug behind a Havarie
    // and fire a run mutation the scene existed to prevent.
    const sceneOpen = this._scene !== null;

    return html`
      <div class="drift">
        <velg-drift-chart
          class="drift__board"
          .chartData=${this._chart}
          .run=${run}
          .frequency=${freqIndex}
          .dissonance=${dz}
          .claimedKeys=${this._claimedKeys}
          .selfKeys=${this._selfKeys}
          .gutterLeft=${HUD_GUTTER_PX}
          ?inert=${sceneOpen}
          @drift-node-pick=${this._onNodePick}
        ></velg-drift-chart>
        ${this._renderHud(run, sceneOpen)}
        ${
          this._dockOpen && this._dock && !this._scene
            ? html`<velg-drift-dock-panel
              .dock=${this._dock}
              @dock-close=${this._closeDock}
            ></velg-drift-dock-panel>`
            : ''
        }
        ${this._renderScene()}
      </div>
    `;
  }

  /** Move focus INTO the scene when it opens, so a keyboard or screen-reader traveller is
   *  told a decision is waiting instead of having to hunt for it behind an inert board. */
  protected updated(changed: PropertyValues): void {
    if (!changed.has('_scene') || !this._scene) return;
    const panel = this.renderRoot.querySelector<VelgDriftStoryletPanel | VelgDriftEffectCards>(
      'velg-drift-storylet-panel, velg-drift-effect-cards',
    );
    // The panel EXISTS at this point but has not rendered its own shadow content yet (a
    // child's first update runs after the parent's `updated`), so focusing it synchronously
    // finds no button and silently does nothing — measured: focus stayed on <body>. Wait for
    // the child's own update to complete, then take the focus.
    void panel?.updateComplete.then(() => panel.focusFirst());
  }

  /** The scene layer: exactly one of Havarie / Wirkungsbericht / Debriefing. */
  private _renderScene() {
    const scene = this._scene;
    if (!scene) return '';

    if (scene.kind === 'cards') {
      return html`<div class="scene-layer" @keydown=${this._onSceneKeydown}>
        <velg-drift-effect-cards
          .cards=${scene.cards}
          .earnings=${scene.earnings}
          @cards-close=${this._closeScene}
        ></velg-drift-effect-cards>
      </div>`;
    }

    if (scene.kind === 'debrief') {
      return html`<div class="scene-layer" @keydown=${this._onSceneKeydown}>
        <velg-drift-storylet-panel
          eyebrow=${msg('Bureau für Zwischenraumfragen')}
          sceneTitle=${msg('Debriefing')}
          prose=${this._debriefProse(scene.run)}
          tone=${scene.run.status === 'completed' ? 'default' : 'danger'}
          .options=${[
            {
              key: 'close',
              label: msg('Akte schließen'),
              detail: msg('Die Fahrt ist protokolliert. Der Zwischenraum wartet nicht.'),
              chips: [],
            },
          ]}
          ?busy=${this._busy}
          @storylet-pick=${this._closeScene}
        ></velg-drift-storylet-panel>
      </div>`;
    }

    const hav = havarieOf(scene.run);
    if (!hav) return '';
    return html`<div class="scene-layer" @keydown=${this._onSceneKeydown}>
      <velg-drift-storylet-panel
        eyebrow=${msg('Havarie')}
        tone="danger"
        sceneTitle=${
          hav.cause === 'kohaerenz'
            ? msg('Die Kohärenz gibt nach')
            : msg('Das Fenster ist zugefallen')
        }
        prose=${
          (hav.cause === 'kohaerenz'
            ? msg(
                str`Der Träger franst aus. Du hängst zwischen den Welten, ${hav.haul_at_risk} Punkte Vermessung an Bord und nichts, was dich hält. Noch ist nichts verloren – aber du musst dich jetzt entscheiden.`,
              )
            : msg(
                str`Dein Aufenthaltsfenster ist abgelaufen, und die Heimat ist nicht in Reichweite. ${hav.haul_at_risk} Punkte Vermessung hängen an dieser Entscheidung.`,
              )) + (this._havarieDeadline(hav) ? ` ${this._havarieDeadline(hav)}` : '')
        }
        selectionLabel=${msg('Fracht über Bord geben')}
        .options=${this._havarieOptions(hav)}
        .selectables=${this._havarieSelectables()}
        ?busy=${this._busy}
        @storylet-pick=${this._resolveHavarie}
      ></velg-drift-storylet-panel>
    </div>`;
  }

  private _renderHud(run: TravelRun | null, sceneOpen = false) {
    if (!run) {
      // Public-first (plan §22.2): a guest reads the shared chart but cannot open a run
      // (openRun requires auth). Show a spectator prompt instead of an AUFBRUCH control
      // that would only error. The auth-token effect re-runs _load on sign-in, so the
      // member HUD swaps in the moment a guest authenticates.
      const isMember = appState.isAuthenticated.value;
      return html`
        <div class="hud" ?inert=${sceneOpen}>
          <p class="hud__title">${msg('No active drift')}</p>
          ${
            // BETWEEN runs is exactly when the account matters most: the Entladung just paid,
            // and the promotion it unlocked is sat from this strip. The strip used to live in
            // the run branch only, so closing a run unmounted the Konto AND the exam stamp —
            // the reward vanished at the moment it was earned, and the rank could not be
            // claimed until the traveller opened another run.
            isMember
              ? html`<velg-drift-ledger-strip
                  .profile=${this._profile}
                  ?busy=${this._busy}
                  @drift-exam=${this._sitExam}
                ></velg-drift-ledger-strip>`
              : ''
          }
          <p class="hud__hint">
            ${
              isMember
                ? msg(
                    'Open a run at your home broadcast, then click a lit node to cross the Bleed.',
                  )
                : msg(
                    'You are reading the shared Driftkarte. Sign in to travel the Bleed yourself.',
                  )
            }
          </p>
          ${
            isMember
              ? html`<button class="btn btn--primary" ?disabled=${this._busy} @click=${this._open}>
                  ${msg('Aufbruch')}
                </button>`
              : ''
          }
        </div>
      `;
    }
    const posNode = this._chart?.nodes.find((n) => n.id === run.position_node_id);
    const anchor = this.anchorSimulationId || appState.currentSimulation.value?.id;
    const atHome = posNode?.node_type === 'broadcast_rand' && posNode.simulation_id === anchor;
    return html`
      <div class="hud" ?inert=${sceneOpen}>
        <p class="hud__title">${msg('Träger')} · ${this._positionName()}</p>
        <velg-drift-ledger-strip
          .profile=${this._profile}
          ?busy=${this._busy}
          @drift-exam=${this._sitExam}
        ></velg-drift-ledger-strip>
        <div class="hud__haul">
          <span class="hud__haul-label">${msg('Vermessung (Haul)')}</span>
          <span class="hud__haul-value">${Number(run.checkpoint.haul ?? 0)}</span>
        </div>
        <dl class="hud__stats">
          ${this._stat(msg('Kohärenz'), run.kohaerenz, 100, 'kh')}
          ${this._stat(msg('Bandbreite'), run.bandbreite, this._bbMax, 'bb')}
          ${this._stat(msg('Dissonanz'), run.dissonanz, this._dzCap, 'dz')}
        </dl>
        <p class="hud__takt">
          ${msg('Takte übrig')} ${run.window_remaining}/${this._windowBase} · ${msg('Takt')} ${run.takt_count}
        </p>
        ${this._renderQuests(run)}
        ${
          atHome
            ? ''
            : html`<p class="hud__warn">
              ${msg('Entladung nur an deiner Heimat-Broadcast. Kehre zurück.')}
            </p>`
        }
        <div class="hud__actions">
          <button
            class="btn btn--secondary"
            ?disabled=${this._busy || !atHome}
            @click=${this._complete}
          >
            ${msg('Entladung')}
          </button>
          <button class="btn btn--ghost" ?disabled=${this._busy} @click=${this._abandon}>
            ${msg('Rückzug')}
          </button>
        </div>
      </div>
    `;
  }

  /** Manifest (carried cargo) + Depesche section (the active quest's deliver control, or
   *  the offers acceptable at this world edge). Hidden when nothing applies. */
  private _renderQuests(run: TravelRun) {
    const q = this._quests;
    if (!q) return '';
    const active = q.active;
    const atTarget = !!active && run.position_node_id === active.slots.target_node;
    return html`
      ${
        q.cargo.length
          ? html`<div class="hud__manifest">
            <p class="hud__section-label">${msg('Fracht')}</p>
            ${q.cargo.map(
              (c) => html`<div class="manifest__item">
                <span class="manifest__dot" style="--_v:${freqColorByName(c.vector)}"></span>
                <span class="manifest__name">${this._cargoLabel(c.family)}</span>
                <span class="manifest__vec">${c.vector}</span>
              </div>`,
            )}
          </div>`
          : ''
      }
      ${
        active
          ? html`<div class="hud__depesche">
            <p class="hud__section-label">${msg('Depesche')}</p>
            <p class="depesche__title">${active.title ?? msg('Depesche')}</p>
            <p class="depesche__route">
              ${msg('Ziel')}: ${active.target_simulation_name ?? msg('Unbekannt')}
            </p>
            ${
              atTarget
                ? html`<button
                    class="btn btn--primary btn--sm"
                    ?disabled=${this._busy}
                    @click=${this._deliver}
                  >
                    ${msg('Depesche abliefern')}
                  </button>`
                : html`<p class="depesche__hint">${msg('Trage sie zur Ziel-Broadcast.')}</p>`
            }
          </div>`
          : q.offers.length
            ? html`<div class="hud__depesche">
              <p class="hud__section-label">${msg('Depeschen verfügbar')}</p>
              <div class="depesche__groups">
                ${this._groupOffers(q.offers).map(
                  (g) => html`<div class="depesche__group" role="group" aria-label=${g.name}>
                    <p class="depesche__dest">${g.name}</p>
                    <div class="depesche__offers">
                      ${g.offers.map(
                        (o) => html`<button
                          class="depesche__offer"
                          ?disabled=${this._busy}
                          title=${o.brief}
                          aria-label=${msg(str`${o.title} annehmen – Ziel ${o.target_simulation_name}`)}
                          @click=${() => this._acceptOffer(o)}
                        >
                          <span
                            class="depesche__offer-dot"
                            style="--_v:${freqColorByName(o.cargo_vector)}"
                            aria-hidden="true"
                          ></span>
                          ${this._cargoLabel(o.cargo_family)}
                        </button>`,
                      )}
                    </div>
                  </div>`,
                )}
              </div>
            </div>`
            : ''
      }
    `;
  }

  private _stat(label: string, value: number, max: number, kind: 'kh' | 'bb' | 'dz') {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return html`
      <div class="stat stat--${kind}">
        <dt class="stat__label">${label}</dt>
        <dd class="stat__value">${value}</dd>
        <div class="stat__bar"><span style="width:${pct}%"></span></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-drift-view': VelgDriftView;
  }
}
