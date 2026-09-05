import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { appState } from '../../services/AppStateManager.js';
import { agentAutonomyApi, agentsApi, chatApi } from '../../services/api/index.js';
import { chatAudio } from '../../services/ChatAudioService.js';
import {
  exportJSON as exportChatJSON,
  exportMarkdown as exportChatMarkdown,
} from '../../services/chat/ChatExporter.js';
import { chatLock } from '../../services/chat/ChatLockService.js';
import { chatStore } from '../../services/chat/ChatSessionStore.js';
import { streamChatResponse, streamRegenerate } from '../../services/chat/ChatStreamConsumer.js';
import type { Participant } from '../../services/chat/chat-types.js';
import { realtimeService } from '../../services/realtime/RealtimeService.js';
import { captureError } from '../../services/SentryService.js';
import type {
  Agent,
  AgentBrief,
  ChatConversation,
  ChatEventReference,
  ConversationContinueHours,
  ConversationNotifyMode,
} from '../../types/index.js';
import { agentAccentColor, MOOD_BANDS } from '../../utils/agent-colors.js';
import { icons } from '../../utils/icons.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { VelgToast } from '../shared/Toast.js';
import {
  CONTINUE_DEFAULT_INDEX,
  CONTINUE_HOURS,
  continueIndexOf,
  continueMarks,
} from './continuation-steps.js';

import '../shared/VelgMetricExplainer.js';
import '../agents/AgentDetailsPanel.js';
import '../shared/EmptyState.js';
import '../shared/LoadingState.js';
import '../shared/VelgAgentTip.js';
import '../shared/VelgAvatar.js';
import '../shared/VelgForecastSlider.js';
import '../shared/VelgToggle.js';
import '../shared/VelgTooltip.js';
import './core/ChatFeed.js';
import './core/ChatComposer.js';

@localized()
@customElement('velg-chat-window')
export class VelgChatWindow extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: block;
      height: 100%;
    }

    .window {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    /* Die verschlossene Ansicht — dieselbe Flaeche wie ein leeres Fenster,
       damit der Wechsel nicht springt. */
    .window--sealed {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .sealed {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      max-width: 380px;
      padding: var(--space-6);
      text-align: center;
      color: var(--color-text-muted);
    }

    .sealed__icon {
      color: var(--color-text-quiet);
    }

    .sealed__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: var(--label-transform);
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
    }

    .sealed__text {
      margin: 0;
      font-family: var(--font-bureau, var(--font-prose));
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
    }

    .sealed__btn {
      min-height: 44px;
      padding: var(--space-2) var(--space-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: var(--label-transform);
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-inverse);
      background: var(--color-primary);
      border: var(--border-width-default) solid var(--color-border);
      box-shadow: var(--shadow-xs);
      cursor: pointer;
    }

    /*
      Ein Kopfmass, und nur eine Linie.

      Auf Prod gemessen (03.09.2026): dieser Kopf war 68 px hoch, der Kopf der
      Liste links 56 — 12 px auseinander, obwohl --chat-header-h auf 58
      rechnet. Der Prototyp hat beide auf 58 und nennt es woertlich "Koepfe
      buendig auf 58px". Die Hoehe kam hier aus dem Inhalt statt aus dem Mass.

      Und der Schatten ist weg: ein harter Versatz (2px 2px 0) ZUSAETZLICH zum
      3-px-Rand liess den Block aufgeklebt wirken. Der Prototyp hat nur die
      Linie. Ein Rand trennt bereits; ein Schatten daneben sagt dasselbe noch
      einmal lauter.
    */
    .window__header {
      display: flex;
      flex-direction: column;
      background: var(--color-surface-header);
      border-bottom: var(--border-medium);
      flex-shrink: 0;
      z-index: 1;
      /*
       * Das Mass haengt am AEUSSEREN Kasten, weil hier der Rand sitzt — genau
       * wie links am list__header. Vorher trug es die innere Zeile, und der
       * Rand des Elternteils kam obendrauf: derselbe Ausdruck ergab links 56
       * und rechts 56 + 3. Zwei Kaesten, die dieselbe Rechnung benutzen und
       * trotzdem verschieden hoch sind, sind schlimmer als zwei verschiedene
       * Rechnungen — man sucht den Fehler nicht dort, wo beide gleich aussehen.
       *
       * min-height und nicht height: klappt die Ereignisleiste auf, DARF der
       * Kopf wachsen. Buendig sein muss er im Ruhezustand.
       */
      min-height: var(--chat-header-h, 58px);
      box-sizing: border-box;
    }

    .window__header-main {
      display: flex;
      align-items: center;
      justify-content: space-between;
      /*
       * Polster 8 statt 12, und das ist keine Kosmetik, sondern Arithmetik:
       * der Inhalt dieser Zeile ist 39 px hoch (Name 24 + Unterzeile 15, am
       * 04.09.2026 auf Prod gemessen), der Portraitstapel 36. Mit 12 px oben
       * und unten waren das 63 — das min-height von 56 war ein BODEN, kein
       * Deckel, also hat der Inhalt es einfach ueberschritten, ohne dass etwas
       * gemeldet haette. Mit 8 sind es 55, und der Kasten haelt sein Mass.
       */
      padding: var(--space-2) var(--space-4);
      /* Die Hoehe kommt vom Elternteil; diese Zeile fuellt nur, was uebrig
         ist. Die Ereignis-Leiste haengt DARUNTER als eigener Streifen. */
      flex: 1 1 auto;
      box-sizing: border-box;
    }

    .window__header-left {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-width: 0;
    }

    /* Portrait stack — spaced for border visibility on dark theme */
    .header__portraits {
      display: flex;
      flex-shrink: 0;
      gap: var(--space-2);
    }

    .header__portrait-overflow {
      width: 32px;
      height: 32px;
      background: var(--color-primary);
      color: var(--color-text-inverse);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      border: var(--border-width-default) solid var(--color-surface);
    }


    .window__header-info {
      min-width: 0;
    }

    .window__agent-name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-base);
      text-transform: var(--heading-transform);
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .window__sub-info {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-quiet);
    }

    .window__header-actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-shrink: 0;
    }

    .window__action-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: var(--label-transform);
      letter-spacing: var(--tracking-brutalist);
      background: transparent;
      color: var(--color-text-secondary);
      border: var(--border-width-thin) solid var(--color-border);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .window__action-btn:hover {
      background: var(--color-surface-sunken);
      color: var(--color-text-primary);
    }

    .window__action-btn:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .window__action-btn--active {
      background: var(--color-primary-bg);
      border-color: var(--color-primary);
      color: var(--color-accent-amber);
    }

    .window__action-btn svg {
      flex-shrink: 0;
    }


    /* ── „Sprecht weiter, wenn ich weg bin" ─────────────────────────────
       Dasselbe Popup-Muster wie beim Ausfuhr-Menue nebenan (Anker am
       Umschlag, absolut, Eintritt von oben), aber breiter: hier steht ein
       Regler mit fuenf beschrifteten Rasten, und der braucht Bahn. */
    .continue-menu {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: var(--space-1);
      width: min(320px, calc(100vw - var(--space-8)));
      display: grid;
      gap: var(--space-3);
      padding: var(--space-3);
      /* --color-surface-raised und NICHT --color-surface-overlay.
       *
       * ⚠ GEMESSEN am 05.09.2026 auf dem Atlas-Skin: --color-surface-overlay
       * wird von KEINEM der beiden Plattform-Saetze geschrieben. Es steht nur
       * in _colors.css auf dem dunklen Vorgabewert und blieb deshalb auf
       * Papier auf dem dunklen Wert stehen, waehrend die Tinte darauf zur
       * Papiertinte wurde:
       *
       *     Atlas   Tinte auf Auflage    1,13 : 1     (AA verlangt 4,5)
       *     dunkel  Tinte auf Auflage   14,99 : 1
       *     Atlas   Tinte auf -raised   13,03 : 1
       *
       * Das Menue war auf dem Atlas praktisch unlesbar.
       *
       * 🔑 Warum es niemandem auffiel: --color-surface-overlay und
       * --color-surface-raised tragen in _colors.css DENSELBEN Wert
       * DENSELBEN Wert. Solange es nur einen Satz gab, waren sie
       * ununterscheidbar,
       * und dass nur einer von beiden geskinnt wird, konnte nicht auffallen.
       * Der zweite Satz hat den Unterschied sichtbar gemacht.
       *
       * -raised ist ohnehin das richtige Wort: der Atlas beschreibt es selbst
       * als "raised: active rows, cells, sticky heads" -- ein Blatt, das
       * ueber der Flaeche liegt. Genau das ist dieses Menue. */
      background: var(--color-surface-raised);
      border: var(--border-width-thin) solid var(--color-border);
      box-shadow: var(--shadow-lg);
      z-index: var(--z-dropdown);
      animation: continue-menu-enter 150ms var(--ease-out, ease-out) both;
      text-align: left;
    }

    @keyframes continue-menu-enter {
      from { opacity: 0; transform: translateY(-4px); }
    }

    .continue-menu__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: var(--label-transform);
      color: var(--color-text-secondary);
      margin: 0;
    }

    .continue-menu__note {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      line-height: var(--leading-snug);
      color: var(--color-text-muted);
      margin: 0;
    }

    /* Die abgeschalteten Regler bleiben SICHTBAR, nur gedaempft. Wer den
       Schalter umlegt, soll vorher sehen koennen, worauf er sich einlaesst;
       ein Feld, das erst nach dem Ja erscheint, laesst ihn blind zusagen. */
    .continue-menu__body[aria-disabled='true'] {
      opacity: 0.45;
    }

    .continue-menu__body {
      display: grid;
      gap: var(--space-3);
      transition: opacity var(--transition-normal);
    }

    /* Vier Wege der Meldung. KEIN velg-tabs: das rendert role=tablist, und
       eine Vorlesesoftware kuendigte die Wahl dann als Reiter an, die ein
       Panel umschalten. Das hier ist eine Formularwahl, also eine
       Optionsgruppe – mit Pfeiltasten, wie es sich gehoert.
       (Kein Backtick in diesem Kommentar: er beendete das css-Template.) */
    .notify {
      display: grid;
      gap: var(--space-1-5);
    }

    .notify__options {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-1);
    }

    .notify__option {
      padding: var(--space-1-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: var(--label-transform);
      background: transparent;
      color: var(--color-text-secondary);
      border: var(--border-width-thin) solid var(--color-border);
      cursor: pointer;
      transition: all var(--transition-fast);
      text-align: center;
    }

    .notify__option:hover:not(:disabled) {
      background: var(--color-surface-sunken);
      color: var(--color-text-primary);
    }

    .notify__option[aria-checked='true'] {
      background: var(--color-primary-bg);
      border-color: var(--color-primary);
      color: var(--color-accent-amber);
      box-shadow: var(--shadow-xs);
    }

    .notify__option:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .notify__option:disabled {
      cursor: not-allowed;
    }

    @media (prefers-reduced-motion: reduce) {
      .continue-menu { animation: none; }
      .continue-menu__body,
      .notify__option { transition: none; }
    }

    /* Event reference bar — always rendered, toggled via max-height */
    .window__events-bar {
      display: flex;
      gap: var(--space-2);
      padding: 0 var(--space-4);
      overflow: hidden;
      /*
       * Der Rand gehoert zur GEOEFFNETEN Leiste. Geschlossen ist sie
       * max-height: 0 und trotzdem 2 px hoch — ihr eigener oberer Rand
       * zeichnet eine Linie unter einen Streifen, den es gerade nicht gibt,
       * und schiebt die Unterkante des Kopfes nach unten.
       */
      border-top: 0;
      background: var(--color-surface-sunken);
      max-height: 0;
      opacity: 0;
      transition:
        max-height var(--transition-normal, 250ms) var(--ease-out, ease-out),
        opacity var(--transition-fast, 150ms) var(--ease-out, ease-out),
        padding var(--transition-normal, 250ms) var(--ease-out, ease-out);
    }

    .window__events-bar--open {
      border-top: var(--border-light);
      max-height: 120px;
      opacity: 1;
      padding: var(--space-2) var(--space-4);
      overflow-x: auto;
    }

    .event-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-0-5);
      padding: var(--space-2) var(--space-3);
      border: var(--border-light);
      background: var(--color-surface);
      min-width: 180px;
      max-width: 240px;
      flex-shrink: 0;
    }

    .event-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-1);
    }

    .event-card__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: var(--label-transform);
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      min-width: 0;
    }

    .event-card__remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      padding: 0;
      background: transparent;
      color: var(--color-text-quiet);
      border: none;
      cursor: pointer;
      font-size: var(--text-sm);
      flex-shrink: 0;
    }

    .event-card__remove:hover {
      color: var(--color-text-danger);
    }

    .event-card__meta {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-quiet);
    }

    .window__messages {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 0;
    }

    .window__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: var(--space-4);
      padding: var(--space-8);
      text-align: center;
    }

    .window__empty-title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: var(--heading-transform);
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
    }

    .window__empty-text {
      font-family: var(--font-body);
      font-size: var(--text-sm);
      color: var(--color-text-quiet);
      max-width: 360px;
    }

    .window__loading {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: var(--label-transform);
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-quiet);
    }

    /* Ein Vermerk, keine Warnung: das Haus faerbt rot nur, wenn etwas
       verloren ist. Hier ist nichts verloren — die Nachricht steht, nur die
       Antwort fehlt. Also die Sprache der Akte: gestrichelte Kante, Marke
       links, ein Knopf, der genau eine Sache tut. */
    .unanswered {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin: var(--space-2) var(--space-4) 0;
      padding: var(--space-2) var(--space-3);
      border: var(--border-width-thin) dashed var(--color-warning-border);
      background: var(--color-warning-bg);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wide);
      text-transform: var(--label-transform);
      color: var(--color-text-secondary);
      animation: unanswered-in var(--duration-entrance) var(--ease-dramatic) both;
    }
    .unanswered__mark {
      display: inline-flex;
      color: var(--color-warning);
      flex-shrink: 0;
    }
    .unanswered__text {
      flex: 1;
      min-width: 0;
    }
    .unanswered__btn {
      flex-shrink: 0;
      padding: var(--space-1) var(--space-3);
      font-family: inherit;
      font-size: inherit;
      letter-spacing: inherit;
      text-transform: inherit;
      color: var(--color-text-primary);
      background: var(--color-surface-raised);
      border: var(--border-width-thin) solid var(--color-border);
      box-shadow: var(--shadow-xs);
      cursor: pointer;
      transition: transform var(--transition-fast), box-shadow var(--transition-fast);
    }
    .unanswered__btn:hover {
      transform: translate(-1px, -1px);
      box-shadow: var(--shadow-sm);
    }
    .unanswered__btn:active {
      transform: translate(1px, 1px);
      box-shadow: none;
    }
    .unanswered__btn:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }
    @keyframes unanswered-in {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .unanswered { animation-duration: 0.01ms; }
      .unanswered__btn { transition-duration: 0.01ms; }
    }

    .window__sending-indicator {
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-quiet);
      border-top: var(--border-light);
    }

    /* ── Export menu ─────────────────────────────────── */

    .export-wrapper {
      position: relative;
    }

    .export-menu {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: var(--space-1);
      background: var(--color-surface-raised);
      border: var(--border-medium);
      box-shadow: var(--shadow-md);
      z-index: 10;
      min-width: 140px;
      display: flex;
      flex-direction: column;
      animation: export-menu-enter 150ms var(--ease-out, ease-out) both;
    }

    @keyframes export-menu-enter {
      from { opacity: 0; transform: translateY(-4px); }
    }

    .export-menu__item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: var(--label-transform);
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
      background: transparent;
      border: none;
      cursor: pointer;
      width: 100%;
      text-align: left;
      transition: all var(--transition-fast);
    }

    .export-menu__item:hover {
      background: var(--color-surface-sunken);
      color: var(--color-text-primary);
    }

    @media (max-width: 640px) {
      .window__header-main {
        padding: var(--space-2) var(--space-3);
      }

      .window__agent-name {
        font-size: var(--text-sm);
      }

      .window__events-bar--open {
        padding: var(--space-2) var(--space-3);
      }

      .event-card {
        min-width: 140px;
        max-width: 200px;
        padding: var(--space-1-5) var(--space-2);
      }

      .window__empty {
        padding: var(--space-4);
        gap: var(--space-3);
      }

      .window__empty-title {
        font-size: var(--text-base);
      }

      .window__empty-text {
        font-size: var(--text-sm);
      }

      .window__sending-indicator {
        padding: var(--space-2) var(--space-3);
      }

      .header__portrait-overflow {
        width: 28px;
        height: 28px;
      }
    }

    @media (max-width: 400px) {
      .window__header-actions {
        gap: var(--space-1);
      }

      .window__action-btn {
        padding: var(--space-1);
        min-width: 28px;
        min-height: 28px;
        justify-content: center;
      }
    }
  `;

  @property({ type: Object }) conversation: ChatConversation | null = null;
  @property({ type: String }) simulationId = '';

  /**
   * Ob die Ansicht auf Telefonbreite steht.
   *
   * Der Portrait-Stapel liesse sich per CSS kuerzen — aber dann stimmte die
   * Zahl im „+n" nicht mehr, denn sie zaehlt ab dem vierten. Eine Anzeige, die
   * „+2" sagt, waehrend drei verborgen sind, ist schlechter als keine.
   */
  @state() private _isNarrow = false;

  private readonly _narrowQuery =
    typeof matchMedia === 'function' ? matchMedia('(max-width: 640px)') : null;

  private readonly _onNarrowChange = (e: MediaQueryListEvent): void => {
    this._isNarrow = e.matches;
  };

  @state() private _loading = false;
  @state() private _sending = false;
  /**
   * Ein Szenenbild ist unterwegs.
   *
   * Eigene Marke und nicht `_sending`: das Bild sperrt den Verfasser NICHT.
   * Wer weiterschreiben will, waehrend das Bild entsteht, soll das koennen —
   * es dauert Sekunden, und ein Gespraech anzuhalten, um darauf zu warten,
   * waere die falsche Reihenfolge.
   */
  @state() private _picturing = false;
  @state() private _showEventsBar = false;
  @state() private _detailAgent: Agent | null = null;
  @state() private _streamingAgentId = '';
  @state() private _restoredDraft = '';
  @state() private _starters: string[] = [];

  /** Cached agent moods — fetched on conversation init, keyed by agent ID. */
  private _agentMoods = new Map<string, { score: number; emotion: string }>();
  /** Memoized participants — rebuilt only when conversation agents or moods change. */
  private _cachedParticipants: Participant[] = [];
  private _cachedParticipantKey = '';
  private _previousConversationId: string | null = null;

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('conversation')) {
      const newId = this.conversation?.id ?? null;
      if (newId !== this._previousConversationId) {
        // Abort any active stream from the previous conversation
        this._streamAbort?.abort();
        this._streamAbort = null;

        // Leave previous conversation's realtime channels
        if (this._previousConversationId) {
          realtimeService.leaveConversation();
        }

        this._previousConversationId = newId;
        this._showEventsBar = false;
        this._restoredDraft = newId ? chatStore.restoreDraft(newId) : '';
        // Track active session for LRU eviction
        chatStore.setActive(newId);
        if (newId) {
          this._initConversation(newId);
        }
      }
    }
  }

  /**
   * Load messages via REST first, then join realtime channel with replay.
   * Order matters: REST load captures current state, replay catches the gap
   * between REST response and channel subscription.
   */
  private async _initConversation(conversationId: string): Promise<void> {
    // Load messages and agent moods in parallel
    this._starters = [];
    await Promise.all([this._loadMessages(), this._fetchAgentMoods()]);
    // Guard: conversation may have changed during async load
    if (this._previousConversationId !== conversationId) return;
    // Derive replay timestamp from latest loaded message
    const session = chatStore.getOrCreate(conversationId);
    const msgs = session.messages.value;
    // Fetch starters for empty conversations (non-blocking)
    if (msgs.length === 0) {
      this._fetchStarters(conversationId);
    }
    const latestTs =
      msgs.length > 0 ? new Date(msgs[msgs.length - 1].created_at).getTime() : Date.now();
    realtimeService.joinConversation(conversationId, latestTs, (messageId) => {
      this._handleRealtimeReactionChanged(conversationId, messageId);
    });
  }

  /** Fetch contextual conversation starters for the empty state (non-blocking). */
  private async _fetchStarters(conversationId: string): Promise<void> {
    if (!this.simulationId) return;
    try {
      const locale = document.documentElement.lang || 'de';
      const response = await chatApi.getStarters(this.simulationId, conversationId, locale);
      // Guard: conversation may have changed during fetch
      if (this._previousConversationId !== conversationId) return;
      if (response.success && Array.isArray(response.data)) {
        this._starters = response.data;
      }
    } catch (err) {
      captureError(err, { source: 'ChatWindow._fetchStarters' });
    }
  }

  /** Fetch mood data for all agents in this conversation (parallel, non-blocking). */
  private async _fetchAgentMoods(): Promise<void> {
    if (!this.simulationId) return;
    const agents = this._getAgents();
    if (agents.length === 0) return;

    const results = await Promise.allSettled(
      agents.map((a) =>
        agentAutonomyApi.getAgentMood(
          this.simulationId,
          a.id,
          appState.currentSimulationMode.value,
        ),
      ),
    );
    this._agentMoods.clear();
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value?.data) {
        this._agentMoods.set(agents[i].id, {
          score: r.value.data.mood_score,
          emotion: r.value.data.dominant_emotion,
        });
      }
    });
    // Trigger re-render so participants get updated mood data
    this.requestUpdate();
  }

  /**
   * Handle realtime reaction_changed broadcast from DB trigger 180.
   * Fetches fresh reaction summaries and updates the store.
   */
  private async _handleRealtimeReactionChanged(
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    if (!this.simulationId || this.conversation?.id !== conversationId) return;
    try {
      const response = await chatApi.getReactions(this.simulationId, conversationId, messageId);
      if (response.success && response.data) {
        chatStore.updateMessageReactions(conversationId, messageId, response.data);
      }
    } catch (err) {
      // Reaction display will catch up on next interaction — fetch is
      // fire-and-forget from a realtime broadcast.
      captureError(err, { source: 'ChatWindow._handleRealtimeReactionChanged' });
    }
  }

  private async _loadMessages(): Promise<void> {
    if (!this.conversation || !this.simulationId) return;
    const conversationId = this.conversation.id;

    this._loading = true;
    chatStore.setMessages(conversationId, []);

    try {
      const response = await chatApi.getMessages(
        this.simulationId,
        conversationId,
        appState.currentSimulationMode.value,
        // 30, nicht 100. Die Nachlade-Maschinerie (`loadOlder`, `hasMore`,
        // `@load-older`) ist vollstaendig gebaut und verdrahtet — sie ist nur
        // nie gelaufen, weil die erste Seite jede Unterhaltung auf Produktion
        // (laengste: 58) restlos verschluckt hat. Ein Merkmal ohne Aufrufer.
        //
        // Warum 30 und nicht 15: ein hohes Fenster zeigt schon ohne Scrollen
        // mehr als 15 kurze Blasen. Die erste Seite muss den Bildschirm FUELLEN,
        // sonst schlaegt `hasMore` sofort beim Oeffnen an und holt eine zweite
        // Seite nach — zwei Rundreisen statt einer, und ein Sprung im Verlauf,
        // bevor der Blick zur Ruhe gekommen ist.
        { limit: '30' },
      );

      if (response.success && response.data) {
        const messages = Array.isArray(response.data) ? response.data : [];
        // Die Gesamtzahl kommt aus der Gespraechszeile — an DIESER Stelle ist
        // sie richtig (nachgemessen auf Prod: 58 zu 58). Falsch wurde sie erst
        // dadurch, dass die Kopfzeile sie nie wieder gelesen hat.
        chatStore.setMessages(conversationId, messages, this.conversation?.message_count);
      } else {
        VelgToast.error(response.error?.message ?? msg('Failed to load messages.'));
      }
    } catch (err) {
      captureError(err, { source: 'ChatWindow._loadMessages' });
      VelgToast.error(msg('An unexpected error occurred while loading messages.'));
    } finally {
      this._loading = false;
    }
  }

  private _streamAbort: AbortController | null = null;

  private _closeExportMenuBound = () => {
    this._showExportMenu = false;
  };
  private _closeExportMenuOnEscapeBound = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this._showExportMenu) {
      this._showExportMenu = false;
    }
  };

  override connectedCallback(): void {
    super.connectedCallback();
    if (this._narrowQuery) {
      this._isNarrow = this._narrowQuery.matches;
      this._narrowQuery.addEventListener('change', this._onNarrowChange);
    }
    document.addEventListener('click', this._closeExportMenuBound);
    document.addEventListener('keydown', this._closeExportMenuOnEscapeBound);
  }

  override disconnectedCallback(): void {
    this._narrowQuery?.removeEventListener('change', this._onNarrowChange);
    document.removeEventListener('click', this._closeExportMenuBound);
    document.removeEventListener('keydown', this._closeExportMenuOnEscapeBound);
    super.disconnectedCallback();
    this._streamAbort?.abort();
    this._streamAbort = null;
    realtimeService.leaveConversation();
  }

  private async _handleSendMessage(e: CustomEvent<{ content: string }>): Promise<void> {
    if (!this.conversation || !this.simulationId || this._sending || this._loading) return;

    const { content } = e.detail;
    const conversationId = this.conversation.id;
    const session = chatStore.getOrCreate(conversationId);
    this._sending = true;

    // Clear typing indicator for this user immediately
    const user = appState.user.value;
    if (user) {
      realtimeService.broadcastStopTyping(user.id);
    }

    // Clear draft immediately on send
    chatStore.clearDraft(conversationId);

    // Optimistic: add user message immediately (SignalWatcher triggers re-render)
    const tempId = chatStore.addOptimistic(conversationId, content, conversationId);
    chatAudio.play('message-sent');

    // Abort any previous stream
    this._streamAbort?.abort();
    this._streamAbort = new AbortController();

    session.streaming.value = true;
    session.streamBuffer.value = '';

    // Track whether the server confirmed the user message (saved to DB).
    // If yes, a non-streaming fallback must NOT re-send the message.
    let userMessageConfirmed = false;
    const cbs = this._streamCallbacks(conversationId, session);

    try {
      await streamChatResponse(this.simulationId, conversationId, content, {
        onUserConfirmed: (confirmedMsg) => {
          userMessageConfirmed = true;
          chatStore.confirmOptimistic(conversationId, tempId, confirmedMsg);
        },
        ...cbs,
        signal: this._streamAbort.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User navigated away or conversation changed — silent
      } else if (userMessageConfirmed) {
        // Stream broke after user message was saved — reload to show
        // whatever was persisted, do NOT re-send
        VelgToast.error(msg('Connection lost during response. Reloading messages.'));
      } else {
        // Stream endpoint not available (404 during deploy) — fall back
        // to non-streaming. The user message was NOT saved yet.
        chatStore.removeOptimistic(conversationId, tempId);
        try {
          const response = await chatApi.sendMessage(this.simulationId, conversationId, {
            content,
            generate_response: true,
          });
          if (response.success) {
            await this._loadMessages();
          } else {
            VelgToast.error(response.error?.message ?? msg('Failed to send message.'));
          }
        } catch (fallbackErr) {
          captureError(fallbackErr, { source: 'ChatWindow._handleSendMessage.nonStreamFallback' });
          VelgToast.error(msg('An unexpected error occurred while sending the message.'));
        }
      }
    } finally {
      this._sending = false;
      this._streamingAgentId = '';
      session.streaming.value = false;
      session.streamBuffer.value = '';
      this._streamAbort = null;

      // Stream complete sound — only on success, not on error/abort
      if (!cbs.hadError && userMessageConfirmed) {
        chatAudio.play('stream-complete');
      }

      // After any stream error, reload messages from DB to reflect actual state.
      // Guard: only reload if the conversation hasn't changed during the stream.
      if (cbs.hadError && userMessageConfirmed && this._previousConversationId === conversationId) {
        await this._loadMessages();
      }
    }
  }

  /**
   * "Bearbeiten und erneut senden" holt die eigene Nachricht in den Verfasser
   * zurueck.
   *
   * WARUM ES DEN GRIFF VORHER NICHT GAB
   * `MessageActions` warf `action-edit`, und NIEMAND hoerte zu -- gemessen am
   * 01.09.2026: 0 Zuhoerer im ganzen Baum, auch kein `addEventListener`. Der
   * Stift stand neben "Kopieren", versprach im aria-label "Edit and resend" und
   * tat nichts. Ein Knopf ohne Wirkung ist teurer als ein fehlender: er sagt
   * dem Leser, dass ER etwas falsch macht.
   *
   * WARUM NICHT MEHR
   * Es gibt keinen Endpunkt, der eine gesendete Nachricht aendert, und das soll
   * so bleiben: eine Nachricht nachtraeglich umzuschreiben wuerde die Antwort
   * des Agenten daneben zu einer Antwort auf etwas machen, das nie gesagt wurde.
   * "Resend" ist woertlich gemeint -- der Text kommt in den Verfasser, das
   * Original bleibt stehen, und was daraus wird, ist eine neue Nachricht.
   *
   * Der Weg dorthin war schon da (`initialContent` plus `willUpdate` im
   * Verfasser, gebaut fuer das Wiederherstellen von Entwuerfen beim
   * Gespraechswechsel). Es fehlte nur der Zuhoerer.
   */
  private _handleEditMessage(e: Event): void {
    const messageId = (e as CustomEvent<{ messageId?: string }>).detail?.messageId;
    if (!messageId || !this.conversation) return;
    const session = chatStore.getOrCreate(this.conversation.id);
    const message = session.messages.value.find((m) => m.id === messageId);
    if (!message?.content) return;

    // Gleicher Text = kein Property-Wechsel = der Verfasser sieht nichts. Der
    // Zwischenschritt ueber '' erzwingt ihn, damit der Knopf auch beim zweiten
    // Mal wirkt.
    if (this._restoredDraft === message.content) this._restoredDraft = '';
    this._restoredDraft = message.content;

    void this.updateComplete.then(() => {
      this.renderRoot.querySelector('velg-chat-composer')?.focus();
    });
  }

  /**
   * Ein Bild aus dem Gespraech anfordern und in den Faden legen.
   *
   * Kein optimistischer Platzhalter: die Erzeugung kann mit 422 abgelehnt
   * werden (die Grenze in `image_content_policy`), und ein Bild, das erst
   * erscheint und dann verschwindet, waere schlechter als eines, das ein paar
   * Sekunden auf sich warten laesst. Der Knopf zeigt die Wartezeit, der Faden
   * bleibt unberuehrt, bis es etwas zu zeigen gibt.
   */
  private async _handleSceneImage(
    e: CustomEvent<{ span: 'message' | 'round' | 'section' }>,
  ): Promise<void> {
    const conversationId = this.conversation?.id;
    if (!conversationId || !this.simulationId || this._picturing) return;

    this._picturing = true;
    try {
      const response = await chatApi.createSceneImage(this.simulationId, conversationId, {
        span: e.detail.span,
      });
      if (!response.success || !response.data) {
        // Der Text kommt vom Server und ist fuer den Nutzer geschrieben — bei
        // 422 nennt er den Grund, bei allem anderen bleibt er allgemein.
        VelgToast.error(response.error?.message || msg('The image could not be created.'));
        return;
      }
      // Ueber den Speicher, nicht ueber eine eigene Liste: `addMessage`
      // entdoppelt nach Kennung, und derselbe Faden kann in zwei Fenstern
      // offen sein.
      chatStore.addMessage(conversationId, response.data);
    } catch (err) {
      captureError(err, { source: 'ChatWindow._handleSceneImage' });
      VelgToast.error(msg('The image could not be created.'));
    } finally {
      this._picturing = false;
    }
  }

  /**
   * Ein Szenenbild wieder entfernen.
   *
   * Mit Rueckfrage, wie beim Loeschen eines Fadens: die Erzeugung kostet
   * einen Modellaufruf und ein paar Sekunden, und rueckgaengig gibt es nicht
   * — die Dateien sind danach aus dem Speicher.
   *
   * Erst der Server, dann der Faden. Andersherum verschwaende das Bild vor
   * den Augen und kaeme beim naechsten Laden zurueck, falls der Aufruf
   * scheitert.
   */
  private async _handleSceneImageDelete(e: CustomEvent<{ messageId: string }>): Promise<void> {
    const conversationId = this.conversation?.id;
    const messageId = e.detail?.messageId;
    if (!conversationId || !this.simulationId || !messageId) return;

    const confirmed = await VelgConfirmDialog.show({
      title: msg('Remove this picture'),
      message: msg('The picture and its stored files are removed for good. The conversation stays as it is.'),
      confirmLabel: msg('Remove'),
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      const response = await chatApi.deleteSceneImage(this.simulationId, conversationId, messageId);
      if (!response.success) {
        VelgToast.error(response.error?.message || msg('The picture could not be removed.'));
        return;
      }
      chatStore.removeMessage(conversationId, messageId);
    } catch (err) {
      captureError(err, { source: 'ChatWindow._handleSceneImageDelete' });
      VelgToast.error(msg('The picture could not be removed.'));
    }
  }

  /** Say so when a message went out and nothing came back.

   * Am 03.09.2026 blieb eine Nachricht unbeantwortet, weil ein Deploy den
   * laufenden Strom mitriss. Die Nachricht war gespeichert, die Antwort nicht
   * — und die Oberflaeche hatte fuer diesen Zustand kein Wort. Es stand nur
   * eine kurze Meldung da, die verschwand, und danach sah der Verlauf aus wie
   * einer, in dem die Agentin schweigt.
   *
   * Wichtig ist der Unterschied, den der Knopf benennt: die Nachricht ist
   * ANGEKOMMEN. "Erneut senden" wuerde sie verdoppeln; angefordert wird die
   * ANTWORT, ueber denselben Weg, den der Wiederholen-Knopf an einer Antwort
   * schon benutzt.
   *
   * Die Bedingung ist absichtlich eng: die letzte Nachricht stammt vom
   * Nutzer, es laeuft kein Strom, es wird nicht gesendet, das Gespraech ist
   * nicht archiviert. In jedem anderen Fall ist Warten richtig und ein
   * Knopf waere eine Einladung, doppelt zu bezahlen.
   */
  private _renderUnansweredNotice(session: ReturnType<typeof chatStore.getOrCreate>) {
    if (!appState.isAuthenticated.value) return nothing;
    if (this._sending || this._loading || session.streaming.value) return nothing;
    if (this.conversation?.status === 'archived') return nothing;

    const msgs = session.messages.value;
    const last = msgs.length > 0 ? msgs[msgs.length - 1] : null;
    if (last?.sender_role !== 'user') return nothing;

    return html`
      <div class="unanswered" role="status">
        <span class="unanswered__mark" aria-hidden="true">${icons.alertTriangle(14)}</span>
        <span class="unanswered__text">${msg('No reply came back. Your message was saved.')}</span>
        <button class="unanswered__btn" type="button" @click=${this._handleRegenerate}>
          ${msg('Request a reply')}
        </button>
      </div>
    `;
  }

  private async _handleRegenerate(): Promise<void> {
    if (!this.conversation || !this.simulationId || this._sending) return;

    const conversationId = this.conversation.id;
    const session = chatStore.getOrCreate(conversationId);

    this._sending = true;
    this._streamAbort?.abort();
    this._streamAbort = new AbortController();
    session.streaming.value = true;
    session.streamBuffer.value = '';

    try {
      await streamRegenerate(this.simulationId, conversationId, {
        ...this._streamCallbacks(conversationId, session),
        signal: this._streamAbort.signal,
      });
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        captureError(err, { source: 'VelgChatWindow._handleRegenerate' });
        VelgToast.error(msg('Failed to regenerate response.'));
      }
    } finally {
      this._sending = false;
      this._streamingAgentId = '';
      session.streaming.value = false;
      session.streamBuffer.value = '';
      this._streamAbort = null;
      await this._loadMessages();
    }
  }

  /** Shared streaming callbacks for send + regenerate flows.
   *  All callbacks are guarded against stale conversation (user switched away mid-stream). */
  private _streamCallbacks(
    conversationId: string,
    session: ReturnType<typeof chatStore.getOrCreate>,
  ) {
    let errorOccurred = false;
    const isStale = () => this._previousConversationId !== conversationId;
    return {
      onAgentStart: (agentId: string) => {
        if (isStale()) return;
        this._streamingAgentId = agentId;
        session.streaming.value = true;
        session.streamBuffer.value = '';
        chatAudio.play('typing-start');
      },
      onToken: (_agentId: string, token: string) => {
        if (isStale()) return;
        chatStore.appendStreamChunk(conversationId, token);
      },
      onAgentDone: (_agentId: string, savedMsg: import('../../types/index.js').ChatMessage) => {
        if (isStale()) return;
        if (!savedMsg?.id || !savedMsg.content?.trim()) {
          session.streaming.value = false;
          session.streamBuffer.value = '';
          return;
        }
        chatStore.finalizeStream(conversationId, savedMsg);
        // streaming stays false after finalizeStream — onAgentStart
        // re-enables it for the next agent in group chat.
        if (document.hidden) chatAudio.play('message-received');
      },
      onError: (error: string) => {
        errorOccurred = true;
        if (!isStale()) {
          // Clear streaming state immediately to remove ghost bubble.
          // For group chat: next agent's onAgentStart re-enables streaming.
          session.streaming.value = false;
          session.streamBuffer.value = '';
          VelgToast.error(error);
        }
      },
      get hadError() {
        return errorOccurred;
      },
    };
  }

  private _handleDraftChange(e: CustomEvent<{ content: string }>): void {
    if (!this.conversation) return;
    chatStore.saveDraft(this.conversation.id, e.detail.content);
  }

  private _handleComposerTyping(): void {
    if (!this.conversation) return;
    const user = appState.user.value;
    if (!user) return;
    realtimeService.broadcastTyping(
      this.conversation.id,
      user.id,
      user.user_metadata?.display_name ?? user.email ?? 'User',
    );
  }

  private async _handleLoadOlder(): Promise<void> {
    if (!this.conversation || !this.simulationId) return;
    const convId = this.conversation.id;
    await chatStore.loadOlder(convId, async (before) => {
      const response = await chatApi.getMessages(
        this.simulationId,
        convId,
        appState.currentSimulationMode.value,
        { limit: '50', before },
      );
      if (response.success && Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    });
  }

  /** Get agents from conversation (prefer agents[], fallback to single agent) */
  private _getAgents(): AgentBrief[] {
    if (this.conversation?.agents && this.conversation.agents.length > 0) {
      return this.conversation.agents;
    }
    if (this.conversation?.agent) {
      return [
        {
          id: this.conversation.agent.id,
          name: this.conversation.agent.name,
          portrait_image_url: this.conversation.agent.portrait_image_url,
        },
      ];
    }
    return [];
  }

  /** Map agent briefs to ChatFeed's Participant interface with accent colors + mood.
   *  Memoized — returns same array reference if inputs haven't changed. */
  private _buildParticipants(): Participant[] {
    // Build a cache key from agent IDs + mood scores (cheapest change detection)
    const agents = this._getAgents();
    const key = agents
      .map((a) => {
        const m = this._agentMoods.get(a.id);
        return `${a.id}:${m?.score ?? ''}`;
      })
      .join(',');

    if (key === this._cachedParticipantKey) return this._cachedParticipants;

    this._cachedParticipantKey = key;
    this._cachedParticipants = agents.map((a) => {
      const mood = this._agentMoods.get(a.id);
      return {
        id: a.id,
        name: a.name,
        avatarUrl: a.portrait_image_url,
        accentColor: agentAccentColor(a.id),
        moodScore: mood?.score,
        moodEmotion: mood?.emotion,
        role: 'agent' as const,
      };
    });
    return this._cachedParticipants;
  }

  private _getAgentDisplayName(): string {
    const agents = this._getAgents();
    if (agents.length === 0) return msg('Agent');
    if (agents.length === 1) return agents[0].name;
    if (agents.length === 2) return `${agents[0].name}, ${agents[1].name}`;
    return `${agents[0].name}, ${agents[1].name} +${agents.length - 2}`;
  }

  private async _handleReactionToggle(
    e: CustomEvent<{ messageId: string; emoji: string }>,
  ): Promise<void> {
    if (!this.conversation || !this.simulationId) return;
    const { messageId, emoji } = e.detail;

    const response = await chatApi.toggleReaction(
      this.simulationId,
      this.conversation.id,
      messageId,
      emoji,
    );

    if (!response.success) {
      VelgToast.error(response.error?.message ?? msg('Failed to toggle reaction.'));
      return;
    }

    // Refresh reactions for this message from the server
    const reactionsResp = await chatApi.getReactions(
      this.simulationId,
      this.conversation.id,
      messageId,
    );

    if (reactionsResp.success && reactionsResp.data) {
      chatStore.updateMessageReactions(this.conversation.id, messageId, reactionsResp.data);
    }
  }

  private async _openAgentDetails(agentId: string): Promise<void> {
    if (!this.simulationId) return;
    try {
      const response = await agentsApi.getById(
        this.simulationId,
        agentId,
        appState.currentSimulationMode.value,
      );
      if (response.success && response.data) {
        this._detailAgent = response.data;
      }
    } catch (err) {
      captureError(err, { source: 'ChatWindow._openAgentDetails' });
      VelgToast.error(msg('Failed to load agent details.'));
    }
  }

  private _toggleEventsBar(): void {
    this._showEventsBar = !this._showEventsBar;
  }

  private _handleLockConversation(): void {
    if (!this.conversation) return;
    this.dispatchEvent(
      new CustomEvent('conversation-lock-request', {
        detail: { conversation: this.conversation, purpose: 'lock' },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ── „Sprecht weiter, wenn ich weg bin" ──────────────────────────────

  @state() private _showContinueMenu = false;
  @state() private _savingContinue = false;

  private _toggleContinueMenu(e: Event): void {
    e.stopPropagation();
    this._showContinueMenu = !this._showContinueMenu;
  }

  private _handleContinueKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this._showContinueMenu = false;
      this.shadowRoot?.querySelector<HTMLElement>('.continue-wrapper .window__action-btn')?.focus();
    }
  }

  /** Pfeiltasten in der Optionsgruppe — Teil des `radiogroup`-Vertrags. */
  private _handleNotifyKeydown(e: KeyboardEvent): void {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const modes = VelgChatWindow.NOTIFY_MODES;
    const current = modes.indexOf(this.conversation?.continue_notify ?? 'digest');
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    const next = modes[(current + step + modes.length) % modes.length];
    void this._saveContinuation({ notify: next });
    this.updateComplete.then(() => {
      this.shadowRoot?.querySelector<HTMLElement>(`.notify__option[data-mode="${next}"]`)?.focus();
    });
  }

  private static readonly NOTIFY_MODES: readonly ConversationNotifyMode[] = [
    'never',
    'app',
    'digest',
    'immediate',
  ] as const;

  /**
   * Die Aenderung geht sofort hinaus und wird optimistisch zurueckgeschrieben
   * — wie beim Verschluss. Ein „Speichern"-Knopf in einem Popup mit drei
   * Reglern waere eine vierte Gelegenheit, etwas zu vergessen.
   *
   * Schlaegt der Aufruf fehl, wird der alte Stand wiederhergestellt: eine
   * Oberflaeche, die eine Einstellung anzeigt, die der Server nicht hat, ist
   * schlimmer als eine, die den Fehlschlag zugibt.
   */
  private async _saveContinuation(patch: {
    continues?: boolean;
    notify?: ConversationNotifyMode;
    hours?: ConversationContinueHours;
  }): Promise<void> {
    const conversation = this.conversation;
    if (!conversation || this._savingContinue) return;

    const vorher = {
      continues_without_user: conversation.continues_without_user ?? false,
      continue_notify: conversation.continue_notify ?? 'digest',
      continue_interval_hours: conversation.continue_interval_hours ?? 12,
    } as const;
    const nachher = {
      continues_without_user: patch.continues ?? vorher.continues_without_user,
      notify: patch.notify ?? vorher.continue_notify,
      interval_hours: patch.hours ?? vorher.continue_interval_hours,
    };

    this._savingContinue = true;
    this.conversation = {
      ...conversation,
      continues_without_user: nachher.continues_without_user,
      continue_notify: nachher.notify,
      continue_interval_hours: nachher.interval_hours,
    };
    try {
      await chatApi.setConversationContinuation(this.simulationId, conversation.id, nachher);
      this.dispatchEvent(
        new CustomEvent('conversation-continuation-changed', {
          detail: { conversationId: conversation.id, ...nachher },
          bubbles: true,
          composed: true,
        }),
      );
    } catch (err) {
      this.conversation = { ...conversation, ...vorher };
      captureError(err, { source: 'VelgChatWindow._saveContinuation' });
      VelgToast.error(msg('The setting could not be saved.'));
    } finally {
      this._savingContinue = false;
    }
  }

  private _renderContinueMenu(): TemplateResult {
    const conversation = this.conversation;
    const an = conversation?.continues_without_user ?? false;
    const notify = conversation?.continue_notify ?? 'digest';
    const labels: Record<ConversationNotifyMode, string> = {
      never: msg('not at all'),
      app: msg('in the app'),
      digest: msg('weekly post'),
      immediate: msg('by mail'),
    };

    return html`
      <div class="continue-menu" @click=${(e: Event) => e.stopPropagation()}>
        <p class="continue-menu__title">${msg('While you are away')}</p>
        <velg-toggle
          .checked=${an}
          ?disabled=${this._savingContinue}
          label=${msg('Keep talking when I am gone')}
          variant="scif"
          size="sm"
          @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
            void this._saveContinuation({ continues: e.detail.checked })}
        ></velg-toggle>

        <div class="continue-menu__body" aria-disabled=${an ? 'false' : 'true'}>
          <velg-forecast-slider
            key="continue-frequency"
            label=${msg('How often')}
            min=${0}
            max=${4}
            step=${1}
            default=${CONTINUE_DEFAULT_INDEX}
            .value=${continueIndexOf(this.conversation?.continue_interval_hours)}
            .marks=${continueMarks()}
            ?disabled=${!an || this._savingContinue}
            @slider-change=${(e: CustomEvent<{ value: number }>) =>
              void this._saveContinuation({
                hours: CONTINUE_HOURS[e.detail.value],
              })}
          ></velg-forecast-slider>

          <div class="notify">
            <p class="continue-menu__title">${msg('Tell me')}</p>
            <div
              class="notify__options"
              role="radiogroup"
              aria-label=${msg('Tell me')}
              @keydown=${this._handleNotifyKeydown}
            >
              ${VelgChatWindow.NOTIFY_MODES.map(
                (mode) => html`<button
                  type="button"
                  class="notify__option"
                  role="radio"
                  data-mode=${mode}
                  aria-checked=${notify === mode ? 'true' : 'false'}
                  tabindex=${notify === mode ? '0' : '-1'}
                  ?disabled=${!an || this._savingContinue}
                  @click=${() => void this._saveContinuation({ notify: mode })}
                >
                  ${labels[mode]}
                </button>`,
              )}
            </div>
          </div>
        </div>

        <p class="continue-menu__note">
          ${msg(
            'The interval is a minimum. Nothing happens more often than the world beats, and a sealed conversation stays silent.',
          )}
        </p>
      </div>
    `;
  }

  private _handleExportMarkdown(): void {
    if (!this.conversation) return;
    const session = chatStore.getOrCreate(this.conversation.id);
    exportChatMarkdown(this.conversation, session.messages.value);
  }

  private _handleExportJSON(): void {
    if (!this.conversation) return;
    const session = chatStore.getOrCreate(this.conversation.id);
    exportChatJSON(this.conversation, session.messages.value);
  }

  private _handleAddAgent(): void {
    this.dispatchEvent(
      new CustomEvent('open-agent-selector', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleOpenEventPicker(): void {
    this.dispatchEvent(
      new CustomEvent('open-event-picker', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleRemoveEventRef(ref: ChatEventReference): void {
    this.dispatchEvent(
      new CustomEvent('remove-event-ref', {
        detail: ref,
        bubbles: true,
        composed: true,
      }),
    );
  }

  @state() private _showExportMenu = false;

  private _toggleExportMenu(e: Event): void {
    e.stopPropagation();
    this._showExportMenu = !this._showExportMenu;
    if (this._showExportMenu) {
      // Focus first menu item after render
      this.updateComplete.then(() => {
        const first = this.shadowRoot?.querySelector<HTMLElement>('.export-menu__item');
        first?.focus();
      });
    }
  }

  /** Keyboard navigation for export menu: arrow keys, Tab trap, Escape to close. */
  private _handleExportMenuKeydown(e: KeyboardEvent): void {
    const items = Array.from(
      this.shadowRoot?.querySelectorAll<HTMLElement>('.export-menu__item') ?? [],
    );
    if (items.length === 0) return;
    const current = items.indexOf(e.target as HTMLElement);

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight': {
        e.preventDefault();
        const next = (current + 1) % items.length;
        items[next].focus();
        break;
      }
      case 'ArrowUp':
      case 'ArrowLeft': {
        e.preventDefault();
        const prev = (current - 1 + items.length) % items.length;
        items[prev].focus();
        break;
      }
      case 'Tab': {
        // Trap focus within menu
        e.preventDefault();
        const next = e.shiftKey
          ? (current - 1 + items.length) % items.length
          : (current + 1) % items.length;
        items[next].focus();
        break;
      }
      case 'Escape':
        this._showExportMenu = false;
        // Return focus to trigger button
        this.shadowRoot?.querySelector<HTMLElement>('.export-wrapper .window__action-btn')?.focus();
        break;
    }
  }

  private _renderPinIcon() {
    return icons.pin(14);
  }

  private _renderAddAgentIcon() {
    return icons.userPlus(14);
  }

  private _renderDownloadIcon() {
    return icons.download(14);
  }

  private _renderPortraitStack(): TemplateResult {
    const agents = this._getAgents();
    // Auf Telefonbreite bleibt EIN Portrait stehen, der Rest wandert in die
    // Ueberlaufmarke — vier Portraits und ein Titel passen dort nicht in eine
    // Zeile, ohne dass der Name abgeschnitten wird.
    const maxVisible = this._isNarrow ? 1 : 4;
    const visible = agents.slice(0, maxVisible);
    const overflow = agents.length - maxVisible;

    return html`
      <div class="header__portraits">
        ${visible.map((agent) =>
          agent.portrait_image_url
            ? html`<velg-avatar
                .src=${agent.portrait_image_url}
                .name=${agent.name}
                size="sm"
                clickable
                @avatar-click=${() => this._openAgentDetails(agent.id)}
              ></velg-avatar>`
            : html`<velg-avatar
                .name=${agent.name}
                size="sm"
                clickable
                @avatar-click=${() => this._openAgentDetails(agent.id)}
              ></velg-avatar>`,
        )}
        ${
          overflow > 0
            ? html`<velg-tooltip position="below">
              <div class="header__portrait-overflow">+${overflow}</div>
              <velg-agent-tip slot="tip" .agents=${agents.slice(maxVisible)}></velg-agent-tip>
            </velg-tooltip>`
            : null
        }
      </div>
    `;
  }

  private _renderEventsBar(): TemplateResult {
    const refs = this.conversation?.event_references ?? [];
    const barClasses = {
      'window__events-bar': true,
      'window__events-bar--open': this._showEventsBar,
    };

    if (refs.length === 0) {
      return html`
        <div class=${classMap(barClasses)}>
          <button class="window__action-btn" @click=${this._handleOpenEventPicker}>
            + ${msg('Add Event')}
          </button>
        </div>
      `;
    }

    return html`
      <div class=${classMap(barClasses)}>
        ${refs.map(
          (ref) => html`
            <div class="event-card">
              <div class="event-card__header">
                <div class="event-card__title">${ref.event_title}</div>
                <button
                  class="event-card__remove"
                  @click=${() => this._handleRemoveEventRef(ref)}
                  title=${msg('Remove event reference')}
                  aria-label=${msg('Remove event reference')}
                >
                  &times;
                </button>
              </div>
              <div class="event-card__meta">
                ${ref.event_type ?? ''} ${ref.impact_level != null ? `\u00B7 ${ref.impact_level}/10` : ''}
              </div>
            </div>
          `,
        )}
        <button
          class="window__action-btn"
          @click=${this._handleOpenEventPicker}
          title=${msg('Add event reference')}
          aria-label=${msg('Add event reference')}
        >+</button>
      </div>
    `;
  }

  private _renderNoConversation() {
    return html`
      <velg-empty-state
        message=${msg('Choose a conversation from the list or start a new one by selecting an agent.')}
      ></velg-empty-state>
    `;
  }

  /**
   * Was anstelle eines verschlossenen Gespraechs steht.
   *
   * Bewusst OHNE Titel und ohne Agentennamen: der Titel ist bei diesen
   * Gespraechen oft schon die Auskunft, die verborgen bleiben soll. Es bleibt
   * bei der Tatsache, dass hier etwas liegt.
   */
  private _renderSealed(): TemplateResult {
    return html`
      <div class="window window--sealed">
        <div class="sealed">
          <div class="sealed__icon">${icons.lock(28)}</div>
          <div class="sealed__title">${msg('Under seal')}</div>
          <p class="sealed__text">
            ${msg('This conversation is locked. Enter your password to open it for this session.')}
          </p>
          <button
            class="sealed__btn"
            @click=${() =>
              this.dispatchEvent(
                new CustomEvent('conversation-lock-request', {
                  detail: { conversation: null, purpose: 'reveal' },
                  bubbles: true,
                  composed: true,
                }),
              )}
          >
            ${msg('Unlock')}
          </button>
        </div>
      </div>
    `;
  }

  protected render() {
    if (!this.conversation) {
      return this._renderNoConversation();
    }

    /*
     * Der Riegel steht HIER, vor allem anderen — nicht nur in der Liste.
     * Eine Sperre, die bloss den Eintrag ausblendet, ist keine: das Fenster
     * behaelt seine Auswahl ueber einen Neuaufbau hinweg, und ein tiefer Link
     * traegt die Kennung ohnehin in der Adresse. Verlauf, Ereignis-Leiste und
     * Verfasser liegen alle hinter dieser Zeile.
     */
    if (chatLock.isHidden(this.conversation)) {
      return this._renderSealed();
    }

    const agentCount = this._getAgents().length;
    const displayName = this._getAgentDisplayName();
    const isArchived = this.conversation.status === 'archived';
    const eventRefCount = this.conversation.event_references?.length ?? 0;
    const hasEventsBar = this._showEventsBar;

    // Streaming state from ChatSessionStore (reactive via SignalWatcher)
    const session = chatStore.getOrCreate(this.conversation.id);

    // Sub info — die LEBENDE Zahl, nicht die Spalte.
    //
    // Hier stand `this.conversation.message_count`: eine Momentaufnahme aus dem
    // Augenblick des Oeffnens. Wer ein Gespraech neu anlegt und darin 58
    // Nachrichten schreibt, las dauerhaft „0 messages" — die Zeile wurde nie
    // wieder angefasst. `session.messageCount` ist aus dem echten Array
    // abgeleitet und kann deshalb nicht driften.
    const messageTotal = session.messageCount.value;
    // Auf Telefonbreite traegt die Unterzeile nur, was der Titel NICHT schon
    // sagt: bei einer Agentin steht ihr Name darueber, dann bleibt die Zeile
    // leer. Die Nachrichtenzahl ist dort die erste, die weichen darf.
    const subInfo = this._isNarrow
      ? agentCount > 1
        ? msg(str`${agentCount} agents`)
        : ''
      : agentCount > 1
        ? msg(str`${agentCount} agents \u00B7 ${messageTotal} messages`)
        : msg(str`${messageTotal} messages`);
    const participants = this._buildParticipants();

    return html`
      <div class="window">
        <div class="window__header">
          <div class="window__header-main">
            <div class="window__header-left">
              ${this._renderPortraitStack()}
              <div class="window__header-info">
                <div class="window__agent-name">${displayName}</div>
                <div class="window__sub-info">
                  ${isArchived ? msg('Archived') : subInfo}
                </div>
              </div>
            </div>
            <div class="window__header-actions" role="toolbar" aria-label=${msg('Chat actions')}>
              <!--
                Die Legende zum Stimmungsring.

                Der Ring liegt an den Portraits im Verlauf und sagte bis zum
                03.09.2026 nirgends, was er bedeutet — kein Tooltip, kein
                title, nichts in der Hilfe. Ein farbiger Ring ohne Legende ist
                Dekoration.

                Er steht hier und nicht in einer Hilfeseite, weil eine Legende
                dort hingehoert, wo das Zeichen ist. Der Erklaerer
                ist der Ort, an dem dieses Haus Kennzahlen erklaert, und sein
                Tor verlangt alle drei Fragen: was, warum, was tun.
              -->
              <velg-metric-explainer
                .metric=${msg('Mood ring')}
                .what=${msg('A coloured ring around a portrait in the transcript. Green means the agent is in good spirits, red means strained. No ring means neutral - which is most of the time.')}
                .why=${msg(str`The ring follows the mood score, which runs from -100 to +100. Above ${MOOD_BANDS.positive} it turns green, below ${MOOD_BANDS.distressed} red. In between there is no ring at all, because a mark that sits on almost every portrait stops being a mark.`)}
                .action=${msg('A red ring is worth reading: the agent answers differently under strain, because the mood block travels into the prompt. Needs, weather and recent events move the score - the agent page shows which.')}
              ></velg-metric-explainer>
              <button
                class="window__action-btn ${hasEventsBar ? 'window__action-btn--active' : ''}"
                @click=${this._toggleEventsBar}
                aria-label=${msg('Events')}
                aria-pressed=${hasEventsBar ? 'true' : 'false'}
              >
                ${this._renderPinIcon()} ${eventRefCount > 0 ? eventRefCount : ''}
              </button>
              <button
                class="window__action-btn"
                @click=${this._handleAddAgent}
                aria-label=${msg('Add Agent')}
              >
                ${this._renderAddAgentIcon()}
              </button>
              <button
                class="window__action-btn"
                @click=${this._handleLockConversation}
                aria-label=${msg('Lock conversation')}
                title=${msg('Lock conversation')}
              >
                ${icons.lock(16)}
              </button>
              ${
                this._getAgents().length > 1
                  ? html`<div class="export-wrapper continue-wrapper" @keydown=${this._handleContinueKeydown}>
                      <button
                        class="window__action-btn ${
                          this.conversation.continues_without_user
                            ? 'window__action-btn--active'
                            : ''
                        }"
                        @click=${this._toggleContinueMenu}
                        aria-label=${msg('While you are away')}
                        title=${msg('While you are away')}
                        aria-haspopup="true"
                        aria-expanded=${this._showContinueMenu ? 'true' : 'false'}
                      >
                        ${icons.antenna(16)}
                      </button>
                      ${this._showContinueMenu ? this._renderContinueMenu() : nothing}
                    </div>`
                  : nothing
              }
              <div class="export-wrapper">
                <button
                  class="window__action-btn"
                  @click=${this._toggleExportMenu}
                  aria-label=${msg('Export conversation')}
                  aria-haspopup="true"
                  aria-expanded=${this._showExportMenu ? 'true' : 'false'}
                >
                  ${this._renderDownloadIcon()}
                </button>
                ${
                  this._showExportMenu
                    ? html`
                    <div class="export-menu" role="menu"
                      @click=${(e: Event) => e.stopPropagation()}
                      @keydown=${this._handleExportMenuKeydown}
                    >
                      <button
                        class="export-menu__item"
                        role="menuitem"
                        @click=${() => {
                          this._handleExportMarkdown();
                          this._showExportMenu = false;
                        }}
                      >${msg('Markdown')}</button>
                      <button
                        class="export-menu__item"
                        role="menuitem"
                        @click=${() => {
                          this._handleExportJSON();
                          this._showExportMenu = false;
                        }}
                      >${msg('JSON')}</button>
                    </div>
                  `
                    : null
                }
              </div>
            </div>
          </div>

          ${this._renderEventsBar()}
        </div>

        ${
          this._loading
            ? html`<velg-loading-state message=${msg('Loading messages...')}></velg-loading-state>`
            : html`
              <div class="window__messages"
                @reaction-toggle=${this._handleReactionToggle}
                @action-regenerate=${this._handleRegenerate}
                @action-edit=${this._handleEditMessage}
                @send-starter=${this._handleSendMessage}
              >
                <velg-chat-feed
                  @scene-image-delete=${this._handleSceneImageDelete}
                  .messages=${session.messages.value}
                  .participants=${participants}
                  .eventReferences=${this.conversation.event_references ?? []}
                  .currentUserId=${appState.user.value?.id ?? ''}
                  .currentUserName=${appState.user.value?.user_metadata?.display_name ?? appState.user.value?.email ?? ''}
                  .streaming=${session.streaming.value}
                  .streamContent=${session.streamBuffer.value}
                  .streamingParticipantId=${this._streamingAgentId}
                  .typingUsers=${realtimeService.chatTypingUsers.value}
                  .starters=${this._starters}
                  .hasMore=${session.hasMore.value}
                  .loading=${this._loading}
                  .conversationLocale=${this.conversation.locale ?? 'de'}
                  @load-older=${this._handleLoadOlder}
                ></velg-chat-feed>
              </div>
            `
        }

        ${this._sending && !session.streaming.value ? html`<div class="window__sending-indicator">${msg('Sending...')}</div>` : null}

        ${this._renderUnansweredNotice(session)}

        ${
          appState.isAuthenticated.value
            ? html`
          <velg-chat-composer
            ?disabled=${this._sending || this._loading || session.streaming.value || isArchived}
            ?picturing=${this._picturing}
            .initialContent=${this._restoredDraft}
            @send-message=${this._handleSendMessage}
            @scene-image-request=${this._handleSceneImage}
            @composer-typing=${this._handleComposerTyping}
            @draft-change=${this._handleDraftChange}
          ></velg-chat-composer>
        `
            : null
        }
      </div>

      <velg-agent-details-panel
        .agent=${this._detailAgent}
        .simulationId=${this.simulationId}
        ?open=${!!this._detailAgent}
        container="lightbox"
        @panel-close=${() => {
          this._detailAgent = null;
        }}
      ></velg-agent-details-panel>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-chat-window': VelgChatWindow;
  }
}
