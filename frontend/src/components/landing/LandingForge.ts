/**
 * "Schmiede deine" - der Abschluss mit tippendem Eingabefeld und Ankerreihe.
 *
 * DAS TIPPFELD IST DER VIERTE DAUERLAEUFER
 * Zwanzig Weltbeschreibungen, ein Zeichen alle 34 ms, drei Sekunden Halten,
 * fuenf Zeichen je Schritt zurueck. Unter `prefers-reduced-motion` laeuft der
 * Zeitgeber gar nicht erst an: das Feld zeigt dann den vollen Text der ersten
 * Beschreibung, still. Ein angehaltenes Tippfeld, das eine halbe Zeile zeigt,
 * waere schlechter als keins.
 *
 * DIE HOEHE IST RESERVIERT, NICHT GEWACHSEN
 * `min-height` auf dem Textfeld haelt die hoechste der zwanzig Beschreibungen
 * frei. Ohne das springt der Knopf darunter bei jedem Wechsel um mehrere
 * Zeilen - und das ist keine Feinheit, sondern der Unterschied zwischen einer
 * Aufforderung, die man treffen kann, und einer, die wegrutscht.
 *
 * DIE ANKERREIHE IST KEINE ZIERDE
 * Der Schmiedelauf verlangt die Wahl eines philosophischen Ankers. Die Reihe
 * nimmt die sechs Anker des Entwurfs vorweg und wechselt mit jeder neuen
 * Beschreibung - so sieht ein Besucher vor dem Klick, dass diese Wahl Teil des
 * Ablaufs ist.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { LandingPrompt } from '../../types/index.js';
import { navigate } from '../../utils/navigation.js';
import { stageStyles } from '../shared/stage-styles.js';
import { ForgeTypewriter, forgeAnchors, forgeEntries } from './landing-forge-engine.js';

@localized()
@customElement('velg-landing-forge')
export class VelgLandingForge extends LitElement {
  static styles = [
    stageStyles,
    css`
    :host {
      --_rule: var(--color-border-light);
      display: block;
      border-top: var(--border-width-thin) solid var(--_rule);
      background: var(--color-surface);
    }

    .layout {
      /* Die Polsterung gehoert INNERHALB des Masses: ohne border-box zaehlt
         "max-width" nur den Inhalt, der Kasten waere 1920 + 2 x 64 = 2048 px
         breit und der sichtbare Rand bei 2560 px 320 statt 384. Gemessen im
         Browser, nicht geschlossen — tsc und alle 23 Tore waren gruen. */
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--space-16);
      padding-block: var(--space-24) var(--space-20);
    }

    .kicker {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-widest);
      text-transform: var(--label-transform);
      color: var(--color-accent-amber);
      margin: 0 0 var(--space-6);
    }

    .title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-display-md);
      line-height: 0.96;
      letter-spacing: var(--tracking-wide);
      text-transform: var(--heading-transform);
      color: var(--color-text-primary);
      margin: 0;
    }

    .title em {
      font-style: normal;
      color: var(--color-accent-amber);
    }

    .right {
      flex: 1;
      max-width: 720px;
      min-width: 0;
    }

    .prompt {
      border: var(--border-width-thin) solid var(--color-border);
      background: var(--color-surface-sunken);
      box-shadow: var(--shadow-lg);
      padding: var(--space-6) var(--space-7);
      display: flex;
      align-items: baseline;
      gap: var(--space-4);
      margin-bottom: var(--space-7);
    }

    .prompt__caret {
      font-family: var(--font-mono);
      font-size: var(--text-md);
      color: var(--color-accent-amber);
      flex: 0 0 auto;
    }

    /* "min-height" haelt die hoechste der zwanzig Beschreibungen frei. */
    .prompt__text {
      font-family: var(--font-prose);
      font-style: italic;
      font-size: var(--text-md);
      line-height: var(--leading-normal);
      color: var(--color-text-primary);
      margin: 0;
      min-height: 158px;
    }

    .prompt__cursor {
      display: inline-block;
      width: 10px;
      height: 20px;
      background: var(--color-accent-amber);
      margin-left: var(--space-1-5);
      vertical-align: -2px;
      animation: blink 1.1s steps(1) infinite;
    }

    @keyframes blink {
      0%,
      50% {
        opacity: 1;
      }
      51%,
      100% {
        opacity: 0;
      }
    }

    .anchors {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-2-5);
      margin-bottom: var(--space-6);
    }

    .anchors__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-widest);
      text-transform: var(--label-transform);
      color: var(--color-accent-amber);
      flex: 0 0 auto;
    }

    .chip {
      display: inline-flex;
      padding: var(--space-1-5) var(--space-3-5);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
      text-transform: var(--label-transform);
      color: var(--color-text-quiet);
      border: var(--border-width-thin) solid var(--color-border-light);
      background: transparent;
      transition: color var(--transition-slow), border-color var(--transition-slow),
        background var(--transition-slow);
    }

    .chip--on {
      color: var(--color-accent-amber);
      border-color: var(--color-accent-amber);
      background: color-mix(in srgb, var(--color-accent-amber) 8%, transparent);
      box-shadow: var(--shadow-xs);
    }

    .anchors__note {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-quiet);
      width: 100%;
      margin-top: var(--space-1);
    }

    .actions {
      display: flex;
      align-items: center;
      gap: var(--space-6);
      flex-wrap: wrap;
    }

    .cta {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2-5);
      padding: var(--space-4) var(--space-9);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      letter-spacing: var(--tracking-widest);
      text-transform: var(--label-transform);
      color: var(--color-on-accent-amber);
      background: var(--color-accent-amber);
      border: var(--border-width-thin) solid var(--color-accent-amber-dim);
      box-shadow: var(--shadow-md);
      cursor: pointer;
      transition: transform var(--transition-normal), box-shadow var(--transition-normal),
        background var(--transition-normal);
    }

    .cta:hover,
    .cta:focus-visible {
      background: var(--color-accent-amber-hover);
      transform: translate(-1px, -1px);
      box-shadow: var(--shadow-xl);
    }

    .caption {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
      text-transform: var(--label-transform);
      color: var(--color-text-quiet);
    }

    /* ── BREITBILD (Entwurf v2, ≥1920) ──────────────────────────────────
       Die grosse Aufforderung bekommt eine eigene Spanne (96 → 128 px) statt
       des Faktors, den Abschnittsueberschriften tragen: sie waechst um ein
       Drittel, nicht um ein Siebtel. Der Eingabekasten geht 720 → 860 px mit,
       sonst stuende ein schmaler Kasten neben einer sehr grossen Zeile. */
    @media (min-width: 1920px) {
      .right {
        max-width: 860px;
      }
    }

    @media (max-width: 1024px) {
      .layout {
        flex-direction: column;
        gap: var(--space-10);
        padding: var(--space-16) var(--space-5);
      }

      .prompt__text {
        min-height: 200px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .prompt__cursor {
        animation: none;
      }

      .chip {
        transition: none;
      }
    }
  `,
  ];

  /** Echte Ausgangssätze aus dem Bestand. Leer heisst: es gibt (noch) keine
   *  freigegebenen, dann tippt der Abschnitt seine Beispiele. */
  @property({ attribute: false }) prompts: LandingPrompt[] = [];

  /**
   * Das Tippwerk.
   *
   * Es lebt seit dem 03.09.2026 in `landing-forge-engine.ts`, weil die
   * Kartenmappe dasselbe Feld zeigt: ein Ausgangssatz laeuft ein, haelt,
   * loescht sich, der naechste folgt. Zwei Zaehlwerke mit denselben drei
   * Konstanten haetten irgendwann verschieden schnell getippt, und niemand
   * haette es bemerkt.
   *
   * Dort liegen auch die zwanzig Beispielsaetze — Text, den die Plattform
   * ueber sich selbst schreibt. Eine Korrektur an einem davon muss beide
   * Vorlagen erreichen.
   */
  private readonly _type = new ForgeTypewriter(this, () => forgeEntries(this.prompts));

  /**
   * Zwanzig Weltbeschreibungen aus dem Entwurf.
   *
   * Als Methode und nicht als Modulkonstante, weil `msg()` auf Modulebene
   * beim Sprachwechsel nicht neu ausgewertet wird - eine Falle, die dieses
   * Werk schon einmal getroffen hat (siehe `i18n-gotchas`).
   */
  /** Die Sätze, die getippt werden.
   *
   *  ZWEI QUELLEN, EINE RANGFOLGE — und das ist keine Doppelung, sondern eine
   *  Aussage: liegen echte Ausgangssätze vor, gewinnen sie IMMER. Die
   *  Beispiele unten sind erfunden, sie sagen das auch (die Überschrift des
   *  Abschnitts nennt sie Beispiele), und sie existieren nur, damit die Seite
   *  nicht leer ist, solange keine echten freigegeben sind.
   *
   *  Auf Prod liegen 26 echte Sätze in `forge_drafts.seed_prompt`, 16 davon
   *  aus abgeschlossenen Läufen. Sie sind noch nicht freigegeben, weil sie von
   *  Menschen geschrieben sind und die Frontseite öffentlich ist — siehe
   *  `LandingPrompt` im Rücken. */

  protected render() {
    const anchors = forgeAnchors();

    return html`
      <div class="layout stage-container">
        <div>
          <p class="kicker">${msg('Transmission open')}</p>
          <!--
            EINE Einheit, nicht zwei.

            Vorher stand hier msg('Forge') plus msg('yours'). Auf Deutsch wurde
            daraus "Forge deine Welt" — halb englisch, weil "Forge" an sieben
            weiteren Stellen (Navigation, Befehlspalette, Verwaltung) der
            PRODUKTNAME ist und dort auch "Forge" heissen muss. Eine geteilte
            Einheit kann nicht an einer Stelle Verb und an sechs anderen Name
            sein.

            Als eine Einheit mit dem Umbruch darin entscheidet jede Sprache
            selbst: "Forge / yours." und "Schmiede / deine Welt."
          -->
          <h2 class="title">${msg(html`Forge<br />yours`)}<em>.</em></h2>
        </div>

        <div class="right">
          <div class="prompt">
            <span class="prompt__caret" aria-hidden="true">&gt;</span>
            <p class="prompt__text" aria-live="off">
              ${this._type.typed}<span class="prompt__cursor" aria-hidden="true"></span>
            </p>
          </div>

          <div class="anchors">
            <span class="anchors__label">${msg('Anchor it in a philosophy')}</span>
            ${anchors.map(
              (anchor, index) => html`
                <span class="chip ${index === this._type.anchor ? 'chip--on' : ''}">${anchor}</span>
              `,
            )}
            <span class="anchors__note">
              ${msg('Required · shapes every citizen’s soul')}
            </span>
          </div>

          <div class="actions">
            <button class="cta" @click=${() => navigate('/forge')}>
              ${msg('Forge this world')} <span aria-hidden="true">&rarr;</span>
            </button>
            <span class="caption">${msg('Free · after that, the world decides')}</span>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-landing-forge': VelgLandingForge;
  }
}
