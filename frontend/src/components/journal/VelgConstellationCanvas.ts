/**
 * VelgConstellationCanvas — the spatial composition surface for the
 * Resonance Journal's constellation view.
 *
 * Six things cohabit one surface: placed fragments (cards), an SVG
 * connection layer that fires only during crystallization, a fragment
 * picker modal for adding unplaced fragments, a keyboard-equivalent
 * move dialog (a11y path — the plan §5.2 mandates this as the primary
 * placement path for screen-reader users), a rename affordance, and
 * the Insight reveal overlay (mounted into the canvas itself, never
 * as a full-screen takeover — Principle 12 + §5.4).
 *
 * Load-bearing design decisions and the why:
 *
 *   1. Pointer Events + setPointerCapture, not HTML5 native DnD.
 *      Revised AD-3 (§1 Finding 4): HTML5 aria-grabbed/aria-dropeffect
 *      are deprecated with effectively no screen-reader support in 2026,
 *      and HTML5 DnD events do not fire on mobile touch browsers.
 *      Pointer Events + a keyboard-equivalent M-dialog gives strictly
 *      better a11y at equivalent implementation cost.
 *
 *   2. No client-side resonance detector. The backend owns the rule
 *      set; duplicating it here would invite sync drift. During
 *      drafting the canvas renders NO connection lines — the lines
 *      draw only on crystallize. This aligns with Principle 1
 *      ("proximity encodes resonance before lines make it explicit")
 *      and Principle 5 ("juxtaposition must earn itself").
 *
 *   3. Transform is applied to the fragment leaf-wrapper, never the
 *      canvas container. CLAUDE.md forbids `filter`, `transform`,
 *      `will-change`, `contain: paint`, or `perspective` on layout
 *      containers because they create new containing blocks that break
 *      `position: fixed` modals (the move-dialog / picker would stop
 *      laying out correctly). The canvas container uses only `position:
 *      relative`; transforms live on the .card-wrap leaf.
 *
 *   4. Connection lines chain fragments in placed_at order. A minimum
 *      spanning tree would require knowing which pairs the server
 *      considers resonant, and the detector only returns an aggregate
 *      type. A placement-order chain is deterministic, requires no
 *      server changes, and conveys the arc of composition.
 *
 *   5. Position updates during drag are rAF-throttled and reflected
 *      through a `_positionOverrides` Map. On pointerup we POST /place
 *      and drop the override; the reloaded constellation then drives
 *      the final layout. This keeps the canvas responsive while
 *      maintaining the server as the source of truth for persisted
 *      coordinates.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { journalApi } from '../../services/api/index.js';
import type {
  Constellation,
  ConstellationFragmentPlacement,
  Fragment,
  FragmentType,
} from '../../services/api/JournalApiService.js';
import { localeService } from '../../services/i18n/locale-service.js';
import { captureError } from '../../services/SentryService.js';
import { icons } from '../../utils/icons.js';
import { navigate } from '../../utils/navigation.js';
import '../shared/BaseModal.js';
import '../shared/EmptyState.js';
import '../shared/ErrorState.js';
import '../shared/LoadingState.js';
import { VelgToast } from '../shared/Toast.js';
import './VelgInsightReveal.js';

// Fragment positions map 1 backend-coord = 1 px centred on (0, 0). The
// backend clamps to ±10000 but the visible viewport is a fraction of
// that; off-viewport fragments are reachable by dragging.
// Wrapper dimensions must stay in sync with the `.card-wrap` CSS values
// (260 px wide, 220 px max-height). The literals are duplicated there
// because Lit's `css` tagged template rejects bare number interpolation.

// Typography register mapping for fragments on the canvas — the card
// version is a distilled form of VelgFragmentCard, preserving the §4
// voice-through-typography mapping in a smaller footprint.
const TYPE_LABELS: Record<FragmentType, () => string> = {
  imprint: () => msg('Imprint'),
  signature: () => msg('Signature'),
  echo: () => msg('Echo'),
  impression: () => msg('Impression'),
  mark: () => msg('Mark'),
  tremor: () => msg('Tremor'),
};

interface DragState {
  pointerId: number;
  fragmentId: string;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
  liveX: number;
  liveY: number;
  rafPending: boolean;
  moved: boolean;
}

interface MoveTarget {
  label: string;
  x: number;
  y: number;
}

@localized()
@customElement('velg-constellation-canvas')
export class VelgConstellationCanvas extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: var(--space-6) var(--space-6) var(--space-12);
      max-width: var(--container-2xl);
      margin: 0 auto;
      --_accent: var(--color-accent-amber);
      --_accent-dim: color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
      --_ink: color-mix(in srgb, var(--color-text-primary) 92%, transparent);
      --_rule: color-mix(in srgb, var(--color-accent-amber) 60%, var(--color-border));
      --_canvas-bg: var(--color-surface-sunken);
    }

    /* ── Top strip ─────────────────────────────────────────────────── */

    .strip {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-4);
      padding-bottom: var(--space-4);
      margin-bottom: var(--space-5);
      border-bottom: 1px solid var(--_rule);
      flex-wrap: wrap;
    }

    .strip__left {
      display: flex;
      align-items: baseline;
      gap: var(--space-4);
      flex-wrap: wrap;
      flex: 1 1 auto;
    }

    .back-link {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
      background: transparent;
      border: 0;
      padding: var(--space-1) var(--space-2);
      cursor: pointer;
      transition: color var(--transition-fast);
    }

    .back-link:hover,
    .back-link:focus-visible {
      color: var(--_accent);
    }

    .back-link:focus-visible {
      outline: var(--ring-focus);
    }

    .name {
      font-family: var(--font-brutalist);
      font-size: clamp(var(--text-xl), 3vw, var(--text-3xl));
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      background: transparent;
      border: 0;
      padding: 0;
      margin: 0;
      cursor: text;
      min-height: 44px;
      line-height: var(--leading-tight);
    }

    .name--unset {
      font-family: var(--font-prose);
      font-style: italic;
      font-weight: var(--font-normal);
      text-transform: none;
      letter-spacing: 0.005em;
      color: var(--color-text-muted);
    }

    .name-input {
      font-family: var(--font-brutalist);
      font-size: clamp(var(--text-xl), 3vw, var(--text-3xl));
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      background: var(--color-surface-sunken);
      border: 1px solid var(--_accent-dim);
      padding: var(--space-2) var(--space-3);
      width: min(100%, 520px);
      min-height: 44px;
    }

    .name-input:focus-visible {
      outline: var(--ring-focus);
      border-color: var(--_accent);
    }

    .status-badge {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
      border: 1px dashed var(--color-border);
      padding: var(--space-1) var(--space-3);
    }

    .status-badge--crystallized {
      color: var(--_accent);
      border-color: var(--_accent);
      border-style: solid;
    }

    .strip__actions {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .action {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
      background: transparent;
      border: 1px dashed var(--color-border);
      padding: var(--space-2) var(--space-4);
      min-height: 40px;
      cursor: pointer;
      transition:
        color var(--transition-fast),
        border-color var(--transition-fast);
    }

    .action:hover:not([disabled]) {
      color: var(--_accent);
      border-color: var(--_accent);
    }

    .action:focus-visible {
      outline: var(--ring-focus);
    }

    .action[disabled] {
      opacity: 0.5;
      cursor: default;
    }

    .action--primary {
      border-style: solid;
      border-width: 2px;
      border-color: var(--_accent);
      color: var(--color-text-primary);
    }

    .action--primary:hover:not([disabled]) {
      background: var(--_accent);
      color: var(--color-text-inverse);
      box-shadow: var(--shadow-sm);
    }

    /* ── Canvas ────────────────────────────────────────────────────── */

    .canvas {
      position: relative;
      width: 100%;
      height: clamp(480px, 70vh, 800px);
      background: var(--_canvas-bg);
      border: 1px dashed var(--color-border);
      overflow: hidden;
      /* No transform / filter / will-change here — this is a layout
         container. See CLAUDE.md "No layout container effects". */
    }

    .canvas__empty {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-8);
    }

    .canvas__empty p {
      font-family: var(--font-prose);
      font-size: var(--text-base);
      font-style: italic;
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      max-width: 48ch;
      text-align: center;
      margin: 0;
    }

    .lines {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: visible;
    }

    .line {
      fill: none;
      stroke: var(--_accent-dim);
      stroke-width: 1.5;
      stroke-linecap: round;
      /* Draw-in via stroke-dasharray / stroke-dashoffset, set per-path. */
      transition: stroke var(--transition-normal);
    }

    .line--active {
      stroke: var(--_accent);
    }

    .line__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      fill: var(--color-text-muted);
      opacity: 0;
      transition: opacity var(--transition-normal);
    }

    .line__label--visible {
      opacity: 1;
    }

    /* ── Fragment card on canvas (leaf-wrapper — transform OK) ────── */

    .card-wrap {
      position: absolute;
      width: 260px;
      max-height: 220px;
      overflow: hidden;
      /* transform on the wrapper is the recommended pattern — this is
         a leaf, not a container for fixed-position descendants. */
      transform: translate(-50%, -50%);
      touch-action: none;
      cursor: grab;
      outline: 0;
      transition: box-shadow var(--transition-normal);
    }

    .card-wrap:focus-visible {
      outline: var(--ring-focus);
      outline-offset: 2px;
    }

    .card-wrap--dragging {
      cursor: grabbing;
      z-index: 2;
    }

    .card-wrap--drop-target .card {
      border-color: var(--_accent);
      background: color-mix(in srgb, var(--_accent) 8%, var(--color-surface-raised));
    }

    .card {
      position: relative;
      background: color-mix(in srgb, var(--color-surface-raised) 92%, var(--color-accent-amber) 2%);
      border: 1px solid var(--color-border);
      padding: var(--space-4);
      box-shadow: var(--shadow-xs);
      transition:
        border-color var(--transition-normal),
        background var(--transition-normal),
        box-shadow var(--transition-normal);
    }

    .card-wrap:hover .card,
    .card-wrap--dragging .card {
      border-color: var(--_accent-dim);
      box-shadow: var(--shadow-md);
    }

    .card--crystallized {
      border-color: color-mix(in srgb, var(--_accent) 50%, var(--color-border));
    }

    .card__body {
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      letter-spacing: 0.005em;
      color: var(--_ink);
      margin: 0 0 var(--space-3);
      display: -webkit-box;
      -webkit-line-clamp: 5;
      line-clamp: 5;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .card--imprint .card__body {
      font-style: italic;
    }

    .card--signature .card__body {
      font-family: var(--font-brutalist);
      font-variant: all-small-caps;
      letter-spacing: var(--tracking-brutalist);
    }

    .card--echo .card__body::first-line {
      font-style: italic;
    }

    .card--impression .card__body {
      border-left: 3px solid var(--_rule);
      padding-left: var(--space-3);
    }

    .card--mark .card__body {
      font-family: var(--font-brutalist);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: color-mix(in srgb, var(--_ink) 70%, transparent);
    }

    .card--tremor .card__body {
      color: var(--color-text-muted);
      letter-spacing: 0.01em;
    }

    .card__meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding-top: var(--space-2);
      border-top: 1px dashed var(--color-border-light);
    }

    .card__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
    }

    .card__remove {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      background: transparent;
      border: 0;
      padding: var(--space-1);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      transition: color var(--transition-fast);
    }

    .card__remove:hover,
    .card__remove:focus-visible {
      color: var(--color-danger);
    }

    .card__remove:focus-visible {
      outline: var(--ring-focus);
    }

    /* ── Fragment picker modal ─────────────────────────────────────── */

    .picker-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      max-height: 60vh;
      overflow-y: auto;
    }

    .picker-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-4);
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--color-border);
      background: var(--color-surface-sunken);
      cursor: pointer;
      transition:
        border-color var(--transition-fast),
        background var(--transition-fast);
    }

    .picker-row:hover,
    .picker-row:focus-visible {
      border-color: var(--_accent);
      background: color-mix(in srgb, var(--_accent) 4%, var(--color-surface-sunken));
    }

    .picker-row:focus-visible {
      outline: var(--ring-focus);
    }

    .picker-row__text {
      flex: 1;
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--_ink);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .picker-row__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
      white-space: nowrap;
    }

    .picker-empty {
      font-family: var(--font-prose);
      font-style: italic;
      color: var(--color-text-secondary);
      text-align: center;
      padding: var(--space-8) 0;
      margin: 0;
    }

    /* ── Move (a11y) dialog ───────────────────────────────────────── */

    .move-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-2);
      margin-bottom: var(--space-4);
    }

    .move-btn {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
      background: var(--color-surface-sunken);
      border: 1px dashed var(--color-border);
      padding: var(--space-3);
      min-height: 44px;
      cursor: pointer;
      transition:
        color var(--transition-fast),
        border-color var(--transition-fast);
    }

    .move-btn:hover,
    .move-btn:focus-visible {
      color: var(--_accent);
      border-color: var(--_accent);
    }

    .move-btn:focus-visible {
      outline: var(--ring-focus);
    }

    /* ── A11y live region ──────────────────────────────────────────── */

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    /* ── Crystallized insight (post-ceremony, always visible) ─────── */

    .insight-display {
      margin-top: var(--space-6);
      padding: var(--space-5) var(--space-6);
      background: var(--color-surface-raised);
      border: 1px solid var(--_rule);
      border-left: 4px solid var(--_accent);
    }

    .insight-display__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
      margin: 0 0 var(--space-3);
    }

    .insight-display__text {
      font-family: var(--font-prose);
      font-size: var(--text-md);
      font-weight: var(--font-medium);
      line-height: 1.65;
      letter-spacing: 0.005em;
      color: var(--_ink);
      max-width: 65ch;
      margin: 0;
    }

    /* ── Reduced motion ────────────────────────────────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .card-wrap,
      .card,
      .line,
      .line__label {
        transition-duration: 0.01ms !important;
      }
    }

    @media (max-width: 640px) {
      :host {
        padding: var(--space-4) var(--space-4) var(--space-10);
      }

      .canvas {
        height: 60vh;
      }
    }
  `;

  @property({ type: String, attribute: 'constellation-id' }) constellationId = '';

  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _constellation: Constellation | null = null;
  @state() private _fragmentsById: Map<string, Fragment> = new Map();
  @state() private _availableFragments: Fragment[] = [];
  @state() private _positionOverrides: Map<string, { x: number; y: number }> = new Map();
  @state() private _dropTargetId: string | null = null;
  @state() private _pickerOpen = false;
  @state() private _pickerLoading = false;
  @state() private _moveOpen = false;
  @state() private _moveFragmentId: string | null = null;
  @state() private _nameEditing = false;
  @state() private _nameDraft = '';
  @state() private _crystallizing = false;
  @state() private _revealing = false;
  @state() private _announcement = '';
  @state() private _canvasSize: { w: number; h: number } = { w: 0, h: 0 };

  private _dragState: DragState | null = null;
  private _canvasResizeObserver: ResizeObserver | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    if (this.constellationId) void this._load();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._canvasResizeObserver?.disconnect();
    this._canvasResizeObserver = null;
  }

  willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('constellationId') && this.constellationId) {
      void this._load();
    }
  }

  protected updated(): void {
    // Attach the ResizeObserver once the .canvas element renders. The
    // observer updates _canvasSize so SVG paths can be drawn in absolute
    // pixel coords with the canvas centre as origin.
    const el = this.shadowRoot?.querySelector('.canvas');
    if (el && !this._canvasResizeObserver) {
      this._canvasResizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width !== this._canvasSize.w || height !== this._canvasSize.h) {
            this._canvasSize = { w: width, h: height };
          }
        }
      });
      this._canvasResizeObserver.observe(el);
    }
    if (!el && this._canvasResizeObserver) {
      this._canvasResizeObserver.disconnect();
      this._canvasResizeObserver = null;
    }
  }

  // ── Data loading ────────────────────────────────────────────────────

  private async _load(): Promise<void> {
    this._loading = true;
    this._error = null;
    try {
      const resp = await journalApi.getConstellation(this.constellationId);
      if (!resp.success) {
        this._error =
          resp.error.code === 'HTTP_404'
            ? msg('This constellation could not be found.')
            : resp.error.message || msg('The constellation could not be loaded.');
        return;
      }
      this._constellation = resp.data;
      await this._loadPlacedFragmentContent(resp.data.fragments);
    } catch (err) {
      captureError(err, { source: 'VelgConstellationCanvas._load' });
      this._error = msg('The constellation could not be loaded.');
    } finally {
      this._loading = false;
    }
  }

  private async _loadPlacedFragmentContent(
    placements: ConstellationFragmentPlacement[],
  ): Promise<void> {
    const missing = placements
      .map((p) => p.fragment_id)
      .filter((id) => !this._fragmentsById.has(id));
    if (missing.length === 0) return;
    // Parallel fetch; ≤12 fragments per the backend cap, so this is bounded.
    const results = await Promise.all(
      missing.map((id) =>
        journalApi.getFragment(id).catch((err) => {
          captureError(err, {
            source: 'VelgConstellationCanvas._loadPlacedFragmentContent',
            fragmentId: id,
          });
          return null;
        }),
      ),
    );
    const next = new Map(this._fragmentsById);
    for (const resp of results) {
      if (resp?.success) next.set(resp.data.id, resp.data);
    }
    this._fragmentsById = next;
  }

  private async _loadAvailableFragments(): Promise<void> {
    this._pickerLoading = true;
    try {
      const resp = await journalApi.listFragments({ limit: 200 });
      if (!resp.success) {
        VelgToast.error(resp.error.message || msg('Could not load fragments.'));
        return;
      }
      const placedIds = new Set(this._constellation?.fragments.map((f) => f.fragment_id) ?? []);
      this._availableFragments = (resp.data ?? []).filter((f) => !placedIds.has(f.id));
    } catch (err) {
      captureError(err, { source: 'VelgConstellationCanvas._loadAvailableFragments' });
      VelgToast.error(msg('Could not load fragments.'));
    } finally {
      this._pickerLoading = false;
    }
  }

  // ── Canvas geometry helpers ─────────────────────────────────────────

  /** Convert a backend coord pair into a CSS position inside the canvas,
   * using (0, 0) at the viewport centre. Applied via `left`/`top` — the
   * wrapper's own `translate(-50%, -50%)` centres the card on the point. */
  private _cssPosition(placement: ConstellationFragmentPlacement): { left: string; top: string } {
    const override = this._positionOverrides.get(placement.fragment_id);
    const x = override?.x ?? placement.position_x;
    const y = override?.y ?? placement.position_y;
    return {
      left: `calc(50% + ${x}px)`,
      top: `calc(50% + ${y}px)`,
    };
  }

  private _livePosition(fragmentId: string): { x: number; y: number } {
    const override = this._positionOverrides.get(fragmentId);
    if (override) return override;
    const placement = this._constellation?.fragments.find((f) => f.fragment_id === fragmentId);
    return { x: placement?.position_x ?? 0, y: placement?.position_y ?? 0 };
  }

  // ── Pointer drag ────────────────────────────────────────────────────

  private _isDraftable(): boolean {
    return this._constellation?.status === 'drafting';
  }

  private _onPointerDown(e: PointerEvent, fragmentId: string): void {
    if (!this._isDraftable()) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const { x, y } = this._livePosition(fragmentId);
    this._dragState = {
      pointerId: e.pointerId,
      fragmentId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originX: x,
      originY: y,
      liveX: x,
      liveY: y,
      rafPending: false,
      moved: false,
    };
    target.classList.add('card-wrap--dragging');
  }

  private _onPointerMove(e: PointerEvent): void {
    const drag = this._dragState;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    drag.liveX = drag.originX + dx;
    drag.liveY = drag.originY + dy;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) drag.moved = true;
    if (!drag.rafPending) {
      drag.rafPending = true;
      requestAnimationFrame(() => this._commitDragFrame());
    }
  }

  private _commitDragFrame(): void {
    const drag = this._dragState;
    if (!drag) return;
    drag.rafPending = false;
    // Position override drives the card position + any future lines.
    const next = new Map(this._positionOverrides);
    next.set(drag.fragmentId, { x: drag.liveX, y: drag.liveY });
    this._positionOverrides = next;
    // Proximity drop-target: another placed fragment within 120 px.
    const DROP_RADIUS = 120;
    let nearest: string | null = null;
    let bestDist = DROP_RADIUS;
    for (const other of this._constellation?.fragments ?? []) {
      if (other.fragment_id === drag.fragmentId) continue;
      const pos = this._livePosition(other.fragment_id);
      const d = Math.hypot(pos.x - drag.liveX, pos.y - drag.liveY);
      if (d < bestDist) {
        bestDist = d;
        nearest = other.fragment_id;
      }
    }
    this._dropTargetId = nearest;
  }

  private async _onPointerUp(e: PointerEvent): Promise<void> {
    const drag = this._dragState;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const target = e.currentTarget as HTMLElement;
    target.classList.remove('card-wrap--dragging');
    try {
      target.releasePointerCapture(e.pointerId);
    } catch (err) {
      captureError(err, { source: 'VelgConstellationCanvas._onPointerUp' });
    }
    this._dropTargetId = null;
    const { fragmentId, liveX, liveY, originX, originY, moved } = drag;
    this._dragState = null;
    if (!moved) return;
    if (liveX === originX && liveY === originY) {
      // clear override — no actual movement
      const next = new Map(this._positionOverrides);
      next.delete(fragmentId);
      this._positionOverrides = next;
      return;
    }
    await this._commitPlacement(fragmentId, Math.round(liveX), Math.round(liveY));
  }

  private _onPointerCancel(e: PointerEvent): void {
    const drag = this._dragState;
    if (!drag || drag.pointerId !== e.pointerId) return;
    (e.currentTarget as HTMLElement).classList.remove('card-wrap--dragging');
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {
      captureError(err, { source: 'VelgConstellationCanvas._onPointerCancel' });
    }
    // Drop the live override — no POST.
    const next = new Map(this._positionOverrides);
    next.delete(drag.fragmentId);
    this._positionOverrides = next;
    this._dropTargetId = null;
    this._dragState = null;
  }

  private async _commitPlacement(fragmentId: string, x: number, y: number): Promise<void> {
    if (!this._constellation) return;
    const resp = await journalApi.placeFragment(this._constellation.id, {
      fragment_id: fragmentId,
      position_x: x,
      position_y: y,
    });
    if (!resp.success) {
      VelgToast.error(resp.error.message || msg('Could not move the fragment.'));
      // Revert the visible override to the server's last-known position.
      const next = new Map(this._positionOverrides);
      next.delete(fragmentId);
      this._positionOverrides = next;
      return;
    }
    this._constellation = resp.data;
    const next = new Map(this._positionOverrides);
    next.delete(fragmentId);
    this._positionOverrides = next;
    this._announcement = msg('Fragment moved.');
  }

  // ── Add / remove ────────────────────────────────────────────────────

  private async _addFragmentToCanvas(fragmentId: string): Promise<void> {
    if (!this._constellation) return;
    const resp = await journalApi.placeFragment(this._constellation.id, {
      fragment_id: fragmentId,
      position_x: 0,
      position_y: 0,
    });
    if (!resp.success) {
      VelgToast.error(resp.error.message || msg('Could not add this fragment.'));
      return;
    }
    this._constellation = resp.data;
    await this._loadPlacedFragmentContent(resp.data.fragments);
    this._availableFragments = this._availableFragments.filter((f) => f.id !== fragmentId);
    this._announcement = msg('Fragment added to canvas.');
    // Close picker if this was the last available fragment.
    if (this._availableFragments.length === 0) this._pickerOpen = false;
  }

  private async _removeFragmentFromCanvas(fragmentId: string): Promise<void> {
    if (!this._constellation) return;
    const resp = await journalApi.removeFragment(this._constellation.id, fragmentId);
    if (!resp.success) {
      VelgToast.error(resp.error.message || msg('Could not remove the fragment.'));
      return;
    }
    this._constellation = resp.data;
    this._announcement = msg('Fragment removed.');
  }

  // ── Rename ──────────────────────────────────────────────────────────

  private _currentName(): string | null {
    if (!this._constellation) return null;
    const locale = localeService.currentLocale;
    const preferred = locale === 'de' ? this._constellation.name_de : this._constellation.name_en;
    return preferred || this._constellation.name_en || this._constellation.name_de || null;
  }

  private _startRename(): void {
    this._nameDraft = this._currentName() ?? '';
    this._nameEditing = true;
  }

  private _cancelRename(): void {
    this._nameEditing = false;
    this._nameDraft = '';
  }

  private async _commitRename(): Promise<void> {
    if (!this._constellation) return;
    const trimmed = this._nameDraft.trim();
    const locale = localeService.currentLocale;
    const body = locale === 'de' ? { name_de: trimmed || null } : { name_en: trimmed || null };
    const resp = await journalApi.renameConstellation(this._constellation.id, body);
    if (!resp.success) {
      VelgToast.error(resp.error.message || msg('Could not rename this constellation.'));
      return;
    }
    this._constellation = resp.data;
    this._nameEditing = false;
    this._nameDraft = '';
  }

  // ── Archive ─────────────────────────────────────────────────────────

  private async _archive(): Promise<void> {
    if (!this._constellation) return;
    const confirmed = window.confirm(
      msg('Archive this constellation? It will disappear from the drafts list.'),
    );
    if (!confirmed) return;
    const resp = await journalApi.archiveConstellation(this._constellation.id);
    if (!resp.success) {
      VelgToast.error(resp.error.message || msg('Could not archive this constellation.'));
      return;
    }
    this._constellation = resp.data;
    this._announcement = msg('Constellation archived.');
  }

  // ── Crystallize ─────────────────────────────────────────────────────

  private async _crystallize(): Promise<void> {
    if (!this._constellation || this._crystallizing) return;
    this._crystallizing = true;
    this._revealing = true; // surface the ceremony even while waiting
    try {
      const resp = await journalApi.crystallizeConstellation(this._constellation.id);
      if (!resp.success) {
        this._revealing = false;
        switch (resp.error.code) {
          case 'HTTP_429':
            VelgToast.info(msg('Ritual pauses – try again later.'));
            break;
          case 'HTTP_502':
            VelgToast.error(msg('The voice did not hold. Try again.'));
            break;
          case 'HTTP_500':
            VelgToast.error(msg('An unexpected response. Try again.'));
            break;
          case 'HTTP_409':
            VelgToast.info(
              resp.error.message || msg('The constellation is not ready to crystallize.'),
            );
            break;
          default:
            VelgToast.error(resp.error.message || msg('Could not crystallize.'));
        }
        return;
      }
      this._constellation = resp.data;
      this._announcement = msg('Constellation crystallized.');
    } catch (err) {
      captureError(err, { source: 'VelgConstellationCanvas._crystallize' });
      this._revealing = false;
      VelgToast.error(msg('Could not crystallize.'));
    } finally {
      this._crystallizing = false;
    }
  }

  private _onRevealComplete(): void {
    this._revealing = false;
  }

  // ── Move dialog (a11y) ──────────────────────────────────────────────

  private _openMoveDialog(fragmentId: string): void {
    if (!this._isDraftable()) return;
    this._moveFragmentId = fragmentId;
    this._moveOpen = true;
  }

  private _moveTargets(): MoveTarget[] {
    return [
      { label: msg('Upper left'), x: -280, y: -200 },
      { label: msg('Up'), x: 0, y: -260 },
      { label: msg('Upper right'), x: 280, y: -200 },
      { label: msg('Left'), x: -320, y: 0 },
      { label: msg('Centre'), x: 0, y: 0 },
      { label: msg('Right'), x: 320, y: 0 },
      { label: msg('Lower left'), x: -280, y: 200 },
      { label: msg('Down'), x: 0, y: 260 },
      { label: msg('Lower right'), x: 280, y: 200 },
    ];
  }

  private async _applyMoveTarget(target: MoveTarget): Promise<void> {
    const id = this._moveFragmentId;
    this._moveOpen = false;
    this._moveFragmentId = null;
    if (!id) return;
    await this._commitPlacement(id, target.x, target.y);
  }

  private _onCardKeyDown(e: KeyboardEvent, fragmentId: string): void {
    if (!this._isDraftable()) return;
    if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      this._openMoveDialog(fragmentId);
    }
  }

  // ── Connection lines (crystallized only) ────────────────────────────

  private _renderLines() {
    if (!this._constellation) return '';
    // Lines only on crystallized state — Principle 1 says proximity
    // encodes resonance BEFORE lines make it explicit; drafts stay
    // unmarked so the player reads the arrangement first.
    if (this._constellation.status !== 'crystallized') return '';
    const { w, h } = this._canvasSize;
    if (w === 0 || h === 0) return '';
    const cx = w / 2;
    const cy = h / 2;
    const placed = [...this._constellation.fragments].sort((a, b) => {
      const at = a.placed_at ?? '';
      const bt = b.placed_at ?? '';
      return at.localeCompare(bt);
    });
    if (placed.length < 2) return '';
    const segments = [];
    for (let i = 1; i < placed.length; i += 1) {
      const a = placed[i - 1];
      const b = placed[i];
      const ax = a.position_x + cx;
      const ay = a.position_y + cy;
      const bx = b.position_x + cx;
      const by = b.position_y + cy;
      // Cubic bezier with control points offset horizontally by |dx|/2 —
      // yields a gentle S-curve for horizontally offset endpoints, near-
      // straight when vertically stacked. Design-direction §6.
      const dx = Math.abs(bx - ax) * 0.5;
      const d = `M ${ax},${ay} C ${ax + dx},${ay} ${bx - dx},${by} ${bx},${by}`;
      segments.push(html`<path class="line line--active" d=${d}></path>`);
    }
    return html`
      <svg class="lines" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        ${segments}
      </svg>
    `;
  }

  // ── Fragment card render ────────────────────────────────────────────

  private _contentOf(fragment: Fragment): string {
    return localeService.currentLocale === 'de' ? fragment.content_de : fragment.content_en;
  }

  private _renderFragment(placement: ConstellationFragmentPlacement) {
    const fragment = this._fragmentsById.get(placement.fragment_id);
    if (!fragment) return '';
    const { left, top } = this._cssPosition(placement);
    const classes = [
      'card-wrap',
      this._dropTargetId === placement.fragment_id ? 'card-wrap--drop-target' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const cardClass =
      this._constellation?.status === 'crystallized'
        ? `card card--${fragment.fragment_type} card--crystallized`
        : `card card--${fragment.fragment_type}`;
    return html`
      <div
        class=${classes}
        style=${`left: ${left}; top: ${top};`}
        tabindex=${this._isDraftable() ? '0' : '-1'}
        role=${this._isDraftable() ? 'application' : 'article'}
        aria-label=${TYPE_LABELS[fragment.fragment_type]()}
        @pointerdown=${(e: PointerEvent) => this._onPointerDown(e, placement.fragment_id)}
        @pointermove=${this._onPointerMove}
        @pointerup=${this._onPointerUp}
        @pointercancel=${this._onPointerCancel}
        @keydown=${(e: KeyboardEvent) => this._onCardKeyDown(e, placement.fragment_id)}
      >
        <article class=${cardClass}>
          <p class="card__body">${this._contentOf(fragment)}</p>
          <div class="card__meta">
            <span class="card__label">${TYPE_LABELS[fragment.fragment_type]()}</span>
            ${
              this._isDraftable()
                ? html`
                  <button
                    type="button"
                    class="card__remove"
                    aria-label=${msg('Remove fragment from canvas')}
                    @click=${(e: MouseEvent) => {
                      e.stopPropagation();
                      void this._removeFragmentFromCanvas(placement.fragment_id);
                    }}
                    @pointerdown=${(e: PointerEvent) => e.stopPropagation()}
                  >
                    ${icons.close(14)}
                  </button>
                `
                : ''
            }
          </div>
        </article>
      </div>
    `;
  }

  // ── Picker modal ────────────────────────────────────────────────────

  private async _openPicker(): Promise<void> {
    this._pickerOpen = true;
    await this._loadAvailableFragments();
  }

  private _renderPicker() {
    if (!this._pickerOpen) return '';
    return html`
      <velg-base-modal ?open=${this._pickerOpen} @modal-close=${() => (this._pickerOpen = false)}>
        <span slot="header">${msg('Add Fragment')}</span>
        ${
          this._pickerLoading
            ? html`<velg-loading-state></velg-loading-state>`
            : this._availableFragments.length === 0
              ? html`<p class="picker-empty">
                ${msg('No unplaced fragments are available.')}
              </p>`
              : html`
                <div class="picker-list" role="list">
                  ${this._availableFragments.map(
                    (fragment) => html`
                      <button
                        type="button"
                        class="picker-row"
                        role="listitem"
                        @click=${() => this._addFragmentToCanvas(fragment.id)}
                      >
                        <span class="picker-row__text">${this._contentOf(fragment)}</span>
                        <span class="picker-row__label">
                          ${TYPE_LABELS[fragment.fragment_type]()}
                        </span>
                      </button>
                    `,
                  )}
                </div>
              `
        }
      </velg-base-modal>
    `;
  }

  // ── Move dialog ─────────────────────────────────────────────────────

  private _renderMoveDialog() {
    if (!this._moveOpen) return '';
    return html`
      <velg-base-modal ?open=${this._moveOpen} @modal-close=${() => (this._moveOpen = false)}>
        <span slot="header">${msg('Move Fragment')}</span>
        <div class="move-grid" role="group" aria-label=${msg('Pick a destination')}>
          ${this._moveTargets().map(
            (target) => html`
              <button
                type="button"
                class="move-btn"
                @click=${() => this._applyMoveTarget(target)}
              >
                ${target.label}
              </button>
            `,
          )}
        </div>
      </velg-base-modal>
    `;
  }

  // ── Insight (post-ceremony display) ─────────────────────────────────

  private _insightText(): string | null {
    if (!this._constellation) return null;
    const locale = localeService.currentLocale;
    const preferred =
      locale === 'de' ? this._constellation.insight_de : this._constellation.insight_en;
    return preferred || this._constellation.insight_en || this._constellation.insight_de || null;
  }

  private _renderInsight() {
    const text = this._insightText();
    if (!text || this._constellation?.status !== 'crystallized' || this._revealing) return '';
    return html`
      <section class="insight-display" aria-label=${msg('Insight')}>
        <p class="insight-display__label">${msg('Insight')}</p>
        <p class="insight-display__text">${text}</p>
      </section>
    `;
  }

  // ── Top strip ───────────────────────────────────────────────────────

  private _renderStatusBadge() {
    const status = this._constellation?.status;
    if (!status) return '';
    const label =
      status === 'drafting'
        ? msg('Drafting')
        : status === 'crystallized'
          ? msg('Crystallized')
          : msg('Archived');
    const cls =
      status === 'crystallized' ? 'status-badge status-badge--crystallized' : 'status-badge';
    return html`<span class=${cls}>${label}</span>`;
  }

  private _renderStrip() {
    if (!this._constellation) return '';
    const name = this._currentName();
    const canCrystallize =
      this._constellation.status === 'drafting' &&
      this._constellation.fragments.length >= 2 &&
      !this._crystallizing;
    return html`
      <div class="strip">
        <div class="strip__left">
          <button
            type="button"
            class="back-link"
            @click=${() => navigate('/journal')}
            aria-label=${msg('Back to Journal')}
          >
            ${msg('← Journal')}
          </button>
          ${
            this._nameEditing
              ? html`
                <input
                  class="name-input"
                  type="text"
                  autofocus
                  .value=${this._nameDraft}
                  aria-label=${msg('Constellation name')}
                  @input=${(e: Event) => (this._nameDraft = (e.target as HTMLInputElement).value)}
                  @keydown=${(e: KeyboardEvent) => {
                    if (e.key === 'Enter') void this._commitRename();
                    if (e.key === 'Escape') this._cancelRename();
                  }}
                  @blur=${this._commitRename}
                />
              `
              : html`
                <button
                  type="button"
                  class=${name ? 'name' : 'name name--unset'}
                  @click=${this._startRename}
                  ?disabled=${this._constellation.status !== 'drafting'}
                  title=${
                    this._constellation.status === 'drafting'
                      ? msg('Rename this constellation')
                      : ''
                  }
                >
                  ${name ?? msg('Untitled')}
                </button>
              `
          }
          ${this._renderStatusBadge()}
        </div>
        <div class="strip__actions">
          ${
            this._constellation.status === 'drafting'
              ? html`
                <button
                  type="button"
                  class="action"
                  @click=${this._openPicker}
                  ?disabled=${this._constellation.fragments.length >= 12}
                >
                  ${icons.plus(14)} ${msg('Add fragment')}
                </button>
                <button
                  type="button"
                  class="action action--primary"
                  ?disabled=${!canCrystallize}
                  @click=${this._crystallize}
                  aria-busy=${String(this._crystallizing)}
                >
                  ${this._crystallizing ? msg('Crystallizing…') : msg('Crystallize')}
                </button>
              `
              : ''
          }
          ${
            this._constellation.status !== 'archived'
              ? html`
                <button type="button" class="action" @click=${this._archive}>
                  ${msg('Archive')}
                </button>
              `
              : ''
          }
        </div>
      </div>
    `;
  }

  // ── Canvas ──────────────────────────────────────────────────────────

  private _renderCanvas() {
    if (!this._constellation) return '';
    const placements = this._constellation.fragments;
    if (placements.length === 0) {
      return html`
        <div class="canvas">
          <div class="canvas__empty">
            <p>
              ${
                this._constellation.status === 'drafting'
                  ? msg(
                      'This canvas is quiet. Add fragments to begin – their arrangement is the work.',
                    )
                  : msg('This constellation holds no fragments.')
              }
            </p>
          </div>
        </div>
      `;
    }
    return html`
      <div class="canvas">
        ${this._renderLines()}
        ${placements.map((p) => this._renderFragment(p))}
        ${
          this._revealing
            ? html`
              <velg-insight-reveal
                .insight=${this._insightText() ?? ''}
                .active=${this._revealing}
                @reveal-complete=${this._onRevealComplete}
              ></velg-insight-reveal>
            `
            : ''
        }
      </div>
    `;
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state></velg-loading-state>`;
    }
    if (this._error) {
      return html`<velg-error-state
        message=${this._error}
        show-retry
        @retry=${this._load}
      ></velg-error-state>`;
    }
    if (!this._constellation) return '';
    return html`
      <div class="sr-only" role="status" aria-live="assertive">${this._announcement}</div>
      ${this._renderStrip()}
      ${this._renderCanvas()}
      ${this._renderInsight()}
      ${this._renderPicker()}
      ${this._renderMoveDialog()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-constellation-canvas': VelgConstellationCanvas;
  }
}
