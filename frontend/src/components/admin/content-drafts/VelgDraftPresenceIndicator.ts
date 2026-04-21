/**
 * VelgDraftPresenceIndicator — "who else has this draft open" banner.
 *
 * Subscribes to `realtimeService.draftPresence[draftId]` and renders a
 * classified-brief-style row listing the OTHER admins currently editing
 * this draft. The self-user is filtered out so the banner only appears
 * when a concurrent session is detected; solo sessions see nothing.
 *
 * Non-blocking by design. The server-side optimistic-concurrency check
 * (`version` on PATCH) is the authoritative write-race guard; this
 * component is a UX hint that surfaces the collision BEFORE the admin
 * invests effort into conflicting edits.
 *
 * Owns no lifecycle for the presence channel itself. The hosting editor
 * (`VelgContentDraftEditor`) calls `realtimeService.joinDraft()` when the
 * draft loads and `leaveDraft()` in `disconnectedCallback` — this banner
 * only reads.
 */

import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { realtimeService } from '../../../services/realtime/RealtimeService.js';
import type { DraftPresenceUser } from '../../../types/index.js';
import { formatRelativeTime } from '../../../utils/date-format.js';
import { icons } from '../../../utils/icons.js';

@localized()
@customElement('velg-draft-presence-indicator')
export class VelgDraftPresenceIndicator extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: block;
      /* Component-local tokens composed from Tier 1. */
      --_accent: var(--color-accent-amber);
      --_accent-dim: color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
      --_accent-glow: color-mix(in srgb, var(--color-accent-amber) 60%, transparent);
      --_ink: var(--color-text-primary);
      --_ink-muted: var(--color-text-secondary);
      --_surface: color-mix(in srgb, var(--color-accent-amber) 8%, var(--color-surface-raised));
    }

    .banner {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: var(--space-3);
      align-items: start;
      padding: var(--space-3) var(--space-4);
      margin: var(--space-2) 0 var(--space-3);
      background: var(--_surface);
      border: 1px dashed var(--_accent-dim);
      border-left: 3px solid var(--_accent);
      animation: enter var(--duration-entrance) var(--ease-dramatic);
    }

    .banner__badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--_accent);
      padding-top: var(--space-0-5);
    }

    .banner__badge svg {
      flex-shrink: 0;
    }

    .banner__list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2-5);
      align-items: center;
      list-style: none;
      margin: 0;
      padding: 0;
      min-width: 0;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) var(--space-2-5);
      background: var(--color-surface);
      border: 1px solid var(--_accent-dim);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--_ink);
      max-width: 100%;
      min-width: 0;
    }

    .chip__dot {
      width: 6px;
      height: 6px;
      flex-shrink: 0;
      background: var(--_accent);
      border-radius: 50%;
      box-shadow: 0 0 4px var(--_accent-glow);
      animation: pulse 2s ease-in-out infinite;
    }

    .chip__email {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }

    .chip__time {
      color: var(--_ink-muted);
      font-size: var(--text-xs);
      flex-shrink: 0;
    }

    @keyframes enter {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes pulse {
      0%,
      100% {
        box-shadow: 0 0 4px var(--_accent-glow);
      }
      50% {
        box-shadow: 0 0 10px var(--_accent-glow);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .banner {
        animation: none;
      }
      .chip__dot {
        animation: none;
      }
    }

    @media (max-width: 640px) {
      .banner {
        grid-template-columns: 1fr;
        gap: var(--space-2);
      }
      .chip__email {
        max-width: 10ch;
      }
    }
  `;

  /** Draft whose presence slot to render. */
  @property({ type: String, attribute: 'draft-id' }) draftId = '';

  /**
   * Current admin's user_id. Used to filter self out of the rendered list.
   * Empty string = no filtering (banner shows every presence entry,
   * including the self row — not desirable, so the editor MUST pass this
   * once auth resolves).
   */
  @property({ type: String, attribute: 'self-user-id' }) selfUserId = '';

  protected render() {
    if (!this.draftId) return nothing;

    const slot = realtimeService.draftPresence.value[this.draftId] ?? [];
    const others = slot.filter((u) => u.user_id !== this.selfUserId);
    if (others.length === 0) return nothing;

    // Matches the existing `draft(s)` convention elsewhere in this
    // editor's banners (see `_sameResourceOthers` warning). Avoids a
    // brittle nested `msg(str\`${msg('...')}\`)` chain that would fight
    // the localize extractor.
    return html`
      <div class="banner" role="status" aria-live="polite">
        <span class="banner__badge">
          ${icons.users(14)}
          ${msg(str`${others.length} other editor(s)`)}
        </span>
        <ul class="banner__list">
          ${others.map((u) => this._renderChip(u))}
        </ul>
      </div>
    `;
  }

  private _renderChip(user: DraftPresenceUser) {
    // `formatRelativeTime` returns "Now" / "5m" / "3h" / etc. The "joined"
    // framing differentiates it from document-age displays elsewhere in
    // the editor.
    const since = formatRelativeTime(user.joined_at);
    return html`
      <li class="chip" title=${msg(str`${user.user_email} joined ${since}`)}>
        <span class="chip__dot" aria-hidden="true"></span>
        <span class="chip__email">${user.user_email}</span>
        <span class="chip__time">${since}</span>
      </li>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-draft-presence-indicator': VelgDraftPresenceIndicator;
  }
}
