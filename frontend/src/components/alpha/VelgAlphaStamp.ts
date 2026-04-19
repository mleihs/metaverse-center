/**
 * VelgAlphaStamp -- Diagonal Bureau rubber-stamp fixed to the viewport corner.
 * Rotates between four Bureau-flavored phrases, deterministically keyed to
 * the build SHA so the same build shows the same phrase.
 *
 * One-shot "thud" entrance: the stamp drops in overshooting, then settles.
 * Never animates again afterward. Reduced-motion clients see a plain fade-in.
 *
 * Filter attribution: reuses the #ink-bleed filter defined by
 * <velg-svg-filters> (already mounted in AppShell).
 *
 * @element velg-alpha-stamp
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { alphaStatus } from '../../services/AlphaStatusService.js';
import { a11yStyles } from '../shared/a11y-styles.js';

/**
 * Deterministic index from the build SHA — the same build always shows the
 * same phrase. Falls back to index 0 for unknown/empty SHA.
 */
function pickPhraseIndex(sha: string, buckets: number): number {
  if (!sha || sha === 'unknown') return 0;
  let hash = 0;
  for (let i = 0; i < sha.length; i++) {
    hash = (hash * 31 + sha.charCodeAt(i)) >>> 0;
  }
  return hash % buckets;
}

@localized()
@customElement('velg-alpha-stamp')
export class VelgAlphaStamp extends LitElement {
  static styles = [
    a11yStyles,
    css`
    :host {
      --_stamp-ink: var(--color-accent-amber);
      --_stamp-border: color-mix(in srgb, var(--color-accent-amber) 70%, transparent);

      position: fixed;
      top: calc(var(--header-height, 60px) + 16px);
      right: 20px;
      z-index: var(--z-sticky, 100);
      pointer-events: none;
    }

    svg.defs {
      position: absolute;
      width: 0;
      height: 0;
      overflow: hidden;
    }

    .stamp {
      display: inline-block;
      position: relative;
      padding: 8px 14px;
      border: 2px solid var(--_stamp-border);
      color: var(--_stamp-ink);
      background: transparent;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      white-space: nowrap;
      opacity: 0;
      transform: rotate(-4deg);
      filter: url(#alpha-stamp-bleed);
      animation: stamp-fade 320ms ease-out 500ms forwards;
    }

    .stamp::after {
      content: '';
      position: absolute;
      inset: 3px;
      border: 1px solid var(--_stamp-border);
      pointer-events: none;
    }

    @media (prefers-reduced-motion: no-preference) {
      .stamp {
        animation: stamp-thud 420ms cubic-bezier(0.34, 1.56, 0.64, 1) 500ms forwards;
      }
    }

    @keyframes stamp-thud {
      0%   { opacity: 0; transform: scale(1.6) rotate(-10deg); filter: blur(6px) url(#alpha-stamp-bleed); }
      65%  { opacity: 0.95; transform: scale(0.94) rotate(-2deg); filter: blur(0) url(#alpha-stamp-bleed); }
      100% { opacity: 0.82; transform: scale(1) rotate(-4deg); filter: blur(0) url(#alpha-stamp-bleed); }
    }

    @keyframes stamp-fade {
      to { opacity: 0.82; }
    }

    @media (max-width: 640px) {
      :host {
        top: auto;
        right: 8px;
        bottom: 40px;
      }
      .stamp { font-size: 9px; padding: 5px 10px; letter-spacing: 0.14em; }
    }

    @media print {
      :host { display: none; }
    }
  `,
  ];

  protected render() {
    const phrases = [
      msg('Vorabübertragung · Fragment 42 von ???'),
      msg('Bureau-Dossier · nicht freigegeben'),
      msg('Spezimen · Signatur unvollständig'),
      msg('Alpha-Manifest · Störungen erwartet'),
    ];
    const i = pickPhraseIndex(alphaStatus.gitSha, phrases.length);
    const phrase = phrases[i] ?? phrases[0];
    if (!phrase) return nothing;

    return html`
      <svg class="defs" aria-hidden="true">
        <defs>
          <filter id="alpha-stamp-bleed" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
          </filter>
        </defs>
      </svg>
      <span class="stamp" aria-hidden="true">${phrase}</span>
      <span class="visually-hidden">${msg('Velgarien alpha build')}</span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-alpha-stamp': VelgAlphaStamp;
  }
}
