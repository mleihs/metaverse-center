/**
 * Die Rückfallkette: Welt-Konfiguration → persönlicher Schlüssel → Projekt.
 *
 * Diese Kette gibt es seit jeher im Code — `ExternalServiceResolver` fragt
 * erst die Welt, dann die Plattform, dann `.env`, und der persönliche
 * Schlüssel greift an zwei Stellen der Schmiede. Erklärt wurde sie nirgends.
 * Wer einen eigenen Schlüssel hinterlegte und ihn nicht abgerechnet sah,
 * hatte keine Möglichkeit herauszufinden, dass die Welt einen eigenen trägt
 * und deshalb vorgeht.
 *
 * Drei Glieder, eines davon grün: das, das gerade zieht. Mehr sagt die Kette
 * nicht, und das ist ihr ganzer Zweck — sie beantwortet die Frage „wer zahlt
 * diesen Aufruf" an der Stelle, an der man sie stellt.
 */
import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@localized()
@customElement('velg-key-chain')
export class VelgKeyChain extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .chain {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
    }

    .link {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1-5) var(--space-3);
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      transition:
        border-color var(--duration-slow) var(--ease-dramatic),
        background var(--duration-slow) var(--ease-dramatic),
        color var(--duration-slow) var(--ease-dramatic);
    }

    .link[data-active] {
      border-color: var(--color-accent-green);
      background: color-mix(in srgb, var(--color-accent-green) 8%, transparent);
      color: var(--color-text-primary);
    }

    .link__dot {
      width: 6px;
      height: 6px;
      border-radius: var(--border-radius-full);
      background: var(--color-text-tertiary);
      flex-shrink: 0;
    }

    .link[data-active] .link__dot {
      background: var(--color-accent-green);
      box-shadow: 0 0 6px color-mix(in srgb, var(--color-accent-green) 60%, transparent);
    }

    .link__state {
      color: var(--color-text-tertiary);
    }

    .link[data-active] .link__state {
      color: var(--color-accent-green);
    }

    .arrow {
      color: var(--color-text-tertiary);
      font-family: var(--font-mono);
    }

    /* Unter 640px Blattbreite eine Liste ohne Pfeile — nebeneinander würde die
       Kette entweder umbrechen (und die Pfeile zeigten ins Leere) oder den
       Text stauchen. */
    @container (max-width: 640px) {
      .chain {
        flex-direction: column;
        align-items: stretch;
      }

      .arrow {
        display: none;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .link {
        transition-duration: 0.01ms;
      }
    }
  `;

  /** Trägt die aktuelle Welt einen eigenen Schlüssel in ihren Einstellungen? */
  @property({ type: Boolean }) worldKey = false;
  /** Hat diese Person einen eigenen hinterlegt, der auch benutzt werden darf? */
  @property({ type: Boolean }) personalKey = false;
  /** Darf sie überhaupt einen benutzen? Unterscheidet „keiner" von „gesperrt". */
  @property({ type: Boolean }) personalAllowed = true;

  protected render() {
    // Genau EIN Glied zieht, und zwar das erste, das etwas hat.
    const active = this.worldKey ? 'world' : this.personalKey ? 'personal' : 'project';

    return html`
      <div class="chain">
        <span class="link" ?data-active=${active === 'world'}>
          <span class="link__dot"></span>
          ${msg('World configuration')}
          <span class="link__state">${this.worldKey ? msg('· in force') : msg('· none')}</span>
        </span>
        <span class="arrow" aria-hidden="true">&rarr;</span>
        <span class="link" ?data-active=${active === 'personal'}>
          <span class="link__dot"></span>
          ${msg('Personal key')}
          <span class="link__state">
            ${
              !this.personalAllowed
                ? msg('· not enabled')
                : this.personalKey
                  ? msg('· in force')
                  : msg('· none')
            }
          </span>
        </span>
        <span class="arrow" aria-hidden="true">&rarr;</span>
        <span class="link" ?data-active=${active === 'project'}>
          <span class="link__dot"></span>
          ${msg('Project key')}
          <span class="link__state">
            ${active === 'project' ? msg('· in force') : msg('· fallback')}
          </span>
        </span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-key-chain': VelgKeyChain;
  }
}
