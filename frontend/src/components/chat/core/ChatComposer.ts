/**
 * ChatComposer — Unified message input for Agent Chat and Epoch Chat.
 *
 * Replaces MessageInput.ts + EpochChatPanel's inline input with:
 *   - CSS Grid auto-resize (no JS scrollHeight measurement)
 *   - Configurable char limit with warn/danger tiers
 *   - Shift+Enter hint via :focus-within CSS (no JS focus state)
 *   - Draft persistence integration (debounced saveDraft callback)
 *   - Proper aria-label on textarea
 *   - Sending state disables input + shows visual feedback
 *   - Typing event for realtime indicators
 *   - Dictation via the Web Speech API, when the browser has it
 *
 * ON DICTATION. The microphone runs on `SpeechRecognition` — no provider, no
 * key, no backend, no cost. That choice has two consequences worth knowing
 * before touching this code:
 *
 *   1. FIREFOX HAS NO RECOGNISER AT ALL. The button is therefore rendered only
 *      where the constructor exists. A disabled button and an error toast would
 *      both be worse: they promise something the browser can never deliver.
 *   2. WHERE THE AUDIO GOES DEPENDS ON THE BROWSER. Chrome and Edge stream the
 *      microphone to Google's speech service; Safari resolves it on the device.
 *      Nothing here reaches our own servers either way, but "local" is not a
 *      guarantee this component can make, so it does not claim one in the UI.
 *
 * Events:
 *   'send-message' — { content: string }
 *   'composer-typing' — (no detail, just a signal for debounced broadcast)
 *   'draft-change' — { content: string } (for parent to persist via chatStore)
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { localeService } from '../../../services/i18n/locale-service.js';
import { captureError } from '../../../services/SentryService.js';
import { icons } from '../../../utils/icons.js';
import { VelgToast } from '../../shared/Toast.js';

const DEFAULT_CHAR_LIMIT = 10000;
const DEFAULT_CHAR_WARN = 8000;

/**
 * How much of the in-flight transcript the footer readout keeps. Speech arrives
 * at the END, so when a phrase outgrows the one line available, the end is what
 * has to stay visible — a CSS ellipsis would clip exactly the words that were
 * just spoken. Only the readout is trimmed; nothing that reaches the textarea
 * passes through here.
 */
const INTERIM_TAIL = 80;

/**
 * The recogniser wants a BCP-47 tag. The app locale says which language the
 * person reads in; `navigator.language` additionally carries the region they
 * speak it in, and region is not cosmetic for a speech model — an at-AT
 * recogniser hears "Jaenner" where de-DE does not. Take the region only when
 * the two agree on the language; otherwise the app locale alone is the honest
 * answer, and the browser fills in its own default region.
 */
function dictationLanguage(): string {
  const appLocale = localeService.currentLocale;
  const browserLocale = navigator.language || '';
  return browserLocale.split('-')[0] === appLocale ? browserLocale : appLocale;
}

/**
 * Resolved per instance rather than once at module load, so that a test can put
 * a recogniser on `window` between two elements — and so that the answer is
 * never cached from before a page decided which browser it is running in.
 */
function speechRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

@localized()
@customElement('velg-chat-composer')
export class ChatComposer extends LitElement {
  static styles = css`
    :host {
      display: block;
      --_composer-bg: color-mix(in srgb, var(--color-surface-raised) 80%, transparent);
      --_composer-border: var(--color-border);
      --_composer-focus-border: var(--color-primary);
      --_composer-focus-glow: color-mix(in srgb, var(--color-primary) 20%, transparent);
      /* A live microphone is the one state in this bar that must never be
         mistaken for decoration, so it borrows the platform's loudest colour. */
      --_composer-live: var(--color-danger);
    }

    /* --- Composer container --- */
    .composer {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      /* Cockpit rule, same measure as the feed above it: the bar spans the
         window edge to edge, the writing area sits on the reading measure.
         If these two ever disagree, the caret stops lining up with the
         message it produces. */
      padding-block: var(--space-4);
      /* Dieselbe Mindestrinne wie im Verlauf darueber (ChatFeed .feed,
         --space-6). Sie stand hier auf --space-4; oberhalb der Lesebreite
         faellt das nicht auf, weil dann beide Seiten zentrieren. Darunter
         klemmen sie auf VERSCHIEDENE Werte — bei 900 px gemessen: Verlauf 24,
         Verfasser 16, der Sendeknopf also 8 px weiter rechts als die Kante
         der Nachrichten ueber ihm. */
      padding-inline: max(var(--space-6), calc((100% - 1080px) / 2));
      border-top: var(--border-medium);
      background: var(--_composer-bg);
      box-shadow: 0 -4px 12px color-mix(in srgb, var(--color-shadow) 15%, transparent);
    }

    /* --- Input row --- */
    .composer__row {
      display: flex;
      align-items: flex-end;
      gap: var(--space-3);
    }

    /* --- CSS Grid auto-resize wrapper ---
     * The ::after pseudo mirrors textarea content in a hidden element.
     * Both occupy the same grid cell, so the cell grows with content.
     * This eliminates JS scrollHeight measurement entirely.
     */
    .composer__grow-wrap {
      display: grid;
      flex: 1;
      min-width: 0;
    }

    .composer__grow-wrap::after,
    .composer__grow-wrap > textarea {
      grid-area: 1 / 1 / 2 / 2;
      font: var(--text-sm) / var(--leading-normal) var(--font-body);
      padding: var(--space-2-5) var(--space-3);
      white-space: pre-wrap;
      word-wrap: break-word;
      min-width: 0;
    }

    .composer__grow-wrap::after {
      content: attr(data-value) ' ';
      visibility: hidden;
      pointer-events: none;
    }

    /* --- Textarea --- */
    .composer__textarea {
      min-height: 40px;
      max-height: 200px;
      overflow-y: auto;
      resize: none;
      color: var(--color-text-primary);
      background: var(--color-surface-sunken);
      border: var(--border-medium);
      /* What is typed here becomes a message in the world's voice, so it
         is set in the same face it will be read in. */
      font-family: var(--font-bureau, var(--font-prose));
      font-size: var(--text-sm);
      line-height: var(--leading-normal);
    }

    .composer__textarea:focus {
      outline: none;
      border-color: var(--_composer-focus-border);
      box-shadow: 0 0 0 3px var(--_composer-focus-glow);
    }

    .composer__textarea::placeholder {
      color: var(--color-text-quiet);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: var(--label-transform);
      letter-spacing: var(--tracking-brutalist);
    }

    .composer__textarea:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* --- Microphone button ---
     * Deliberately the quiet one of the two: it sits on the sunken ground with
     * a muted icon so the amber send button keeps the primacy of the row. It
     * only raises its voice while the microphone is actually open.
     */
    .composer__scene {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      flex-shrink: 0;
      background: none;
      border: var(--border-width-thin) solid var(--color-border);
      color: var(--color-text-muted);
      cursor: pointer;
      transition:
        color var(--transition-fast),
        border-color var(--transition-fast);
    }

    .composer__scene:hover:not(:disabled) {
      color: var(--color-primary);
      border-color: var(--color-primary);
    }

    .composer__scene:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .composer__scene:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .composer__mic {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      padding: 0;
      flex-shrink: 0;
      color: var(--color-text-muted);
      background: var(--color-surface-sunken);
      border: var(--border-medium);
      box-shadow: var(--shadow-sm);
      cursor: pointer;
      transition:
        color var(--transition-fast),
        border-color var(--transition-fast),
        transform var(--transition-fast),
        box-shadow var(--transition-fast);
    }

    .composer__mic:hover:not(:disabled) {
      color: var(--_composer-focus-border);
      border-color: var(--_composer-focus-border);
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-md);
    }

    .composer__mic:active:not(:disabled) {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .composer__mic:focus-visible {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .composer__mic:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .composer__mic svg {
      flex-shrink: 0;
    }

    .composer__mic--live,
    .composer__mic--live:hover:not(:disabled) {
      color: var(--_composer-live);
      border-color: var(--_composer-live);
      background: var(--color-danger-bg);
    }

    /* The expanding ring, not an edge bar: it frames the whole button and it
       moves. It is the signal that the microphone is open, so its geometry is
       tied to the blink of the footer dot — same 1400ms, same rhythm. */
    .composer__mic--live::after {
      content: '';
      position: absolute;
      inset: -2px;
      border: var(--border-width-default) solid var(--_composer-live);
      pointer-events: none;
      animation: mic-ring 1400ms var(--ease-out) infinite;
    }

    @keyframes mic-ring {
      from { opacity: 0.9; transform: scale(1); }
      to { opacity: 0; transform: scale(1.35); }
    }

    /* --- Send button --- */
    .composer__send {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      height: 40px;
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: var(--label-transform);
      letter-spacing: var(--tracking-brutalist);
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border: var(--border-default);
      box-shadow: var(--shadow-sm);
      cursor: pointer;
      transition:
        transform var(--transition-fast),
        box-shadow var(--transition-fast);
      flex-shrink: 0;
    }

    .composer__send:hover:not(:disabled) {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-md);
    }

    .composer__send:active:not(:disabled) {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .composer__send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .composer__send svg {
      flex-shrink: 0;
    }

    /* Sending spinner replaces icon */
    .composer__send--sending {
      pointer-events: none;
    }

    .composer__spinner {
      width: 16px;
      height: 16px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 600ms linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* --- Footer row --- */
    .composer__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      min-height: 16px;
    }

    /* Shift+Enter hint — shown via :focus-within CSS, no JS state needed */
    .composer__hint {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-quiet);
      opacity: 0;
      transition: opacity var(--transition-fast);
    }

    .composer:focus-within .composer__hint {
      opacity: 1;
    }

    /* --- Dictation readout ---
     * Takes the hint's place while the microphone is open. Words still being
     * resolved are shown HERE and never in the textarea: an interim result is
     * revised and withdrawn several times per sentence, and letting that
     * churn into the writing area would fight anyone who types mid-dictation.
     * Only sentences the recogniser has settled on reach the message.
     */
    .composer__hearing {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex: 1;
      min-width: 0;
    }

    .composer__hearing-dot {
      width: var(--space-1-5);
      height: var(--space-1-5);
      flex-shrink: 0;
      background: var(--_composer-live);
      animation: mic-blink 1400ms steps(1, end) infinite;
    }

    @keyframes mic-blink {
      0%, 49.9% { opacity: 1; }
      50%, 100% { opacity: 0.2; }
    }

    .composer__hearing-label {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: var(--label-transform);
      letter-spacing: var(--tracking-brutalist);
      color: var(--_composer-live);
      flex-shrink: 0;
    }

    .composer__hearing-text {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }

    /* --- Char counter --- */
    .composer__counter {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-quiet);
      margin-left: auto;
      flex-shrink: 0;
    }

    .composer__counter--warn {
      color: var(--color-warning-hover);
    }

    .composer__counter--limit {
      color: var(--color-text-danger);
    }

    /* --- Responsive --- */
    @media (max-width: 640px) {
      .composer {
        padding: var(--space-3);
      }

      .composer__textarea {
        min-height: 44px;
        font-size: var(--text-base);
      }

      .composer__mic {
        width: 44px;
        height: 44px;
      }

      .composer__send {
        min-width: 44px;
        height: 44px;
      }
    }

    /* The blanket "make every animation instant" override would be a bug here:
       both live indicators animate FROM visible TO faint, so freezing them at
       their end state would hide the fact that a microphone is open. They are
       therefore stopped at their loud state instead of being stopped at all. */
    @media (prefers-reduced-motion: reduce) {
      .composer__spinner {
        animation: none;
      }

      .composer__mic--live::after {
        animation: none;
        opacity: 0.9;
      }

      .composer__hearing-dot {
        animation: none;
        opacity: 1;
      }

      .composer__mic,
      .composer__send,
      .composer__hint {
        transition: none;
      }
    }
  `;

  // --- Properties ---

  @property({ type: Number }) charLimit = DEFAULT_CHAR_LIMIT;
  @property({ type: Number }) charWarn = DEFAULT_CHAR_WARN;
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) sending = false;
  /** Ein Szenenbild ist unterwegs. Eigene Marke, weil es den Verfasser nicht sperrt. */
  @property({ type: Boolean }) picturing = false;
  @property({ type: String }) placeholder = '';
  /** Pre-fill content (e.g. restored draft). */
  @property({ type: String }) initialContent = '';

  // --- Internal state ---

  @state() private _content = '';
  /** Whether this browser has a speech recogniser at all. */
  @state() private _canDictate = false;
  /** Whether the microphone is currently open. */
  @state() private _listening = false;
  /** The phrase the recogniser has not settled on yet. Footer only. */
  @state() private _interim = '';
  @query('.composer__textarea') private _textarea!: HTMLTextAreaElement;

  private _draftTimeout = 0;
  private _recognition: SpeechRecognition | null = null;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  connectedCallback(): void {
    super.connectedCallback();
    if (this.initialContent) {
      this._content = this.initialContent;
    }
    this._canDictate = speechRecognitionConstructor() !== undefined;
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    // Restore draft when conversation switches (initialContent changes)
    if (
      changedProperties.has('initialContent') &&
      changedProperties.get('initialContent') !== undefined
    ) {
      this._content = this.initialContent;
      // Sync the CSS Grid mirror on next frame (textarea may not exist yet)
      this.updateComplete.then(() => {
        if (this._textarea) {
          this._textarea.value = this.initialContent;
          const wrapper = this._textarea.parentElement;
          if (wrapper) wrapper.dataset.value = this.initialContent;
        }
      });
    }

    // A composer that has just been locked (send in flight, conversation
    // archived) must not keep a microphone open behind the disabled state.
    if (
      this._listening &&
      (this.disabled || this.sending) &&
      (changedProperties.has('disabled') || changedProperties.has('sending'))
    ) {
      this._abortDictation();
    }
  }

  disconnectedCallback(): void {
    clearTimeout(this._draftTimeout);
    this._abortDictation();
    super.disconnectedCallback();
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  private _handleInput(e: Event): void {
    const textarea = e.target as HTMLTextAreaElement;
    this._content = textarea.value;

    // Update the CSS Grid mirror for auto-resize
    const wrapper = textarea.parentElement;
    if (wrapper) {
      wrapper.dataset.value = textarea.value;
    }

    // Emit typing signal (parent debounces for realtime broadcast)
    this.dispatchEvent(new CustomEvent('composer-typing', { bubbles: true, composed: true }));

    this._queueDraftSave();
  }

  /** Emit draft change after a pause (parent persists via chatStore.saveDraft). */
  private _queueDraftSave(): void {
    clearTimeout(this._draftTimeout);
    this._draftTimeout = window.setTimeout(() => {
      this.dispatchEvent(
        new CustomEvent('draft-change', {
          detail: { content: this._content },
          bubbles: true,
          composed: true,
        }),
      );
    }, 500);
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    // Escape closes the microphone without sending anything. The button is the
    // obvious way out; this is the one for hands that never left the keyboard.
    if (e.key === 'Escape' && this._listening) {
      e.preventDefault();
      this._stopDictation();
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this._send();
    }
  }

  /**
   * Ein Bild aus der letzten Runde.
   *
   * Die Runde ist die Vorgabe und nicht „die letzten drei Nachrichten": die
   * Zuege einer Runde beschreiben denselben Augenblick aus verschiedener
   * Sicht, sind also EIN Moment. Wer einen anderen Ausschnitt will, waehlt ihn
   * an der einzelnen Nachricht — dort steht die Handlung an der Nachricht, wo
   * sie hingehoert, statt in einem Menue am Verfasser.
   */
  private _requestScene(): void {
    if (this.picturing) return;
    this.dispatchEvent(
      new CustomEvent('scene-image-request', {
        bubbles: true,
        composed: true,
        detail: { span: 'round' },
      }),
    );
  }

  private _send(): void {
    const content = this._content.trim();
    if (!content || this.disabled || this.sending) return;
    if (content.length > this.charLimit) return;

    // Whatever is half-spoken goes with the message or nowhere. The person read
    // the box before they hit send, so the box is what gets sent.
    this._abortDictation();

    this.dispatchEvent(
      new CustomEvent('send-message', {
        detail: { content },
        bubbles: true,
        composed: true,
      }),
    );

    this._content = '';
    if (this._textarea) {
      this._textarea.value = '';
      // Reset CSS Grid mirror
      const wrapper = this._textarea.parentElement;
      if (wrapper) wrapper.dataset.value = '';
    }

    // Clear pending draft timeout
    clearTimeout(this._draftTimeout);
  }

  /** Public: focus the textarea (called by parent after conversation switch). */
  focus(): void {
    this._textarea?.focus();
  }

  /** Public: set content programmatically (e.g. draft restore). */
  setContent(text: string): void {
    this._content = text;
    if (this._textarea) {
      this._textarea.value = text;
      const wrapper = this._textarea.parentElement;
      if (wrapper) wrapper.dataset.value = text;
    }
  }

  // ---------------------------------------------------------------------------
  // Dictation
  // ---------------------------------------------------------------------------

  private _toggleDictation(): void {
    if (this._listening) {
      this._stopDictation();
      return;
    }
    this._startDictation();
  }

  private _startDictation(): void {
    const Recognition = speechRecognitionConstructor();
    if (!Recognition || this.disabled || this.sending) return;

    const recognition = new Recognition();
    recognition.lang = dictationLanguage();
    // Open microphone rather than one utterance: a chat message is often
    // several sentences, and re-pressing the button between them would make
    // dictation slower than typing. The cost is a microphone that stays live
    // until it is closed, which is what the ring and the footer dot are for.
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => this._handleSpeechResult(event);
    recognition.onerror = (event) => this._handleSpeechError(event);
    recognition.onend = () => {
      this._listening = false;
      this._interim = '';
      this._releaseRecognition();
    };
    this._recognition = recognition;

    try {
      recognition.start();
    } catch (err) {
      // start() throws InvalidStateError when a session is already running —
      // the one failure of this API that never arrives as an `error` event.
      this._releaseRecognition();
      captureError(err, { source: 'ChatComposer._startDictation' });
      VelgToast.error(msg('Dictation could not be started.'));
      return;
    }

    this._listening = true;
    this._interim = '';
  }

  /** Close the microphone and keep the last sentence it was still resolving. */
  private _stopDictation(): void {
    const recognition = this._recognition;
    if (!recognition) {
      this._listening = false;
      this._interim = '';
      return;
    }
    try {
      recognition.stop();
    } catch (err) {
      captureError(err, { source: 'ChatComposer._stopDictation' });
      this._listening = false;
      this._interim = '';
      this._releaseRecognition();
    }
  }

  /** Close the microphone and discard whatever it was still resolving. */
  private _abortDictation(): void {
    const recognition = this._recognition;
    this._listening = false;
    this._interim = '';
    if (!recognition) return;
    // Detach before aborting: `end` fires from abort(), and by then this
    // component may already be off the page.
    this._releaseRecognition();
    try {
      recognition.abort();
    } catch (err) {
      captureError(err, { source: 'ChatComposer._abortDictation' });
    }
  }

  private _releaseRecognition(): void {
    const recognition = this._recognition;
    if (!recognition) return;
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    this._recognition = null;
  }

  private _handleSpeechResult(event: SpeechRecognitionEvent): void {
    let settled = '';
    let interim = '';

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const transcript = result?.[0]?.transcript ?? '';
      if (result?.isFinal) {
        settled += transcript;
      } else {
        interim += transcript;
      }
    }

    const spoken = settled.trim();
    if (spoken) this._appendSpoken(spoken);

    this._interim = interim.length > INTERIM_TAIL ? `…${interim.slice(-INTERIM_TAIL)}` : interim;
  }

  /**
   * A settled sentence lands at the END of the message, never at the caret. The
   * caret is wherever the person last typed, and dropping speech into the
   * middle of a half-written sentence is never what they meant.
   */
  private _appendSpoken(text: string): void {
    const current = this._content;
    if (current.length >= this.charLimit) {
      this._stopDictation();
      return;
    }

    const joined =
      current.length > 0 && !/\s$/.test(current) ? `${current} ${text}` : current + text;
    this.setContent(joined.slice(0, this.charLimit));

    if (joined.length >= this.charLimit) this._stopDictation();

    // The textarea caps at 200px and then scrolls; without this the words being
    // dictated disappear below the fold of the box they are landing in.
    if (this._textarea) {
      this._textarea.scrollTop = this._textarea.scrollHeight;
    }

    this.dispatchEvent(new CustomEvent('composer-typing', { bubbles: true, composed: true }));
    this._queueDraftSave();
  }

  private _handleSpeechError(event: SpeechRecognitionErrorEvent): void {
    this._listening = false;
    this._interim = '';

    // `aborted` is our own stop and `no-speech` is somebody who pressed the
    // button and then said nothing. Neither is a defect, so neither earns a
    // toast or a Sentry event: the ring going out is the whole answer.
    if (event.error === 'aborted' || event.error === 'no-speech') return;

    VelgToast.error(this._dictationErrorMessage(event.error));
    // A refused permission is reported too, on purpose: it is not a bug, but
    // how often people hit that wall is something worth being able to read.
    captureError(new Error(`Speech recognition failed: ${event.error}`), {
      source: 'ChatComposer._handleSpeechError',
      speechError: event.error,
    });
  }

  private _dictationErrorMessage(code: SpeechRecognitionErrorCode): string {
    switch (code) {
      case 'not-allowed':
      case 'service-not-allowed':
        return msg('Microphone access was refused. Allow it for this site to dictate.');
      case 'audio-capture':
        return msg('No microphone was found.');
      case 'network':
        return msg('The speech service could not be reached.');
      case 'language-not-supported':
        return msg('Speech recognition does not support this language.');
      default:
        return msg('Dictation stopped unexpectedly.');
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  protected render() {
    const charCount = this._content.length;
    const showCounter = charCount >= this.charWarn;
    const isAtLimit = charCount >= this.charLimit;
    const isDisabled = this.disabled || this.sending;
    const canSend = !isDisabled && this._content.trim().length > 0 && !isAtLimit;

    const counterClasses = {
      composer__counter: true,
      'composer__counter--warn': charCount >= this.charWarn && !isAtLimit,
      'composer__counter--limit': isAtLimit,
    };

    const placeholder = this.placeholder || msg('Type your message...');

    return html`
      <div class="composer">
        <div class="composer__row">
          <div class="composer__grow-wrap" data-value=${this._content}>
            <textarea
              class="composer__textarea"
              .value=${this._content}
              placeholder=${placeholder}
              aria-label=${placeholder}
              ?disabled=${isDisabled}
              @input=${this._handleInput}
              @keydown=${this._handleKeyDown}
              rows="1"
            ></textarea>
          </div>
          ${
            this._canDictate
              ? html`
            <button
              type="button"
              class=${classMap({
                composer__mic: true,
                'composer__mic--live': this._listening,
              })}
              ?disabled=${isDisabled}
              aria-pressed=${this._listening ? 'true' : 'false'}
              aria-label=${this._listening ? msg('Stop dictation') : msg('Dictate message')}
              @click=${this._toggleDictation}
            >
              ${icons.mic(18)}
            </button>
          `
              : nothing
          }
          <button
            type="button"
            class="composer__scene"
            ?disabled=${isDisabled || this.picturing}
            aria-label=${msg('Draw this round')}
            title=${msg('Draw this round')}
            @click=${this._requestScene}
          >
            ${this.picturing ? html`<div class="composer__spinner"></div>` : icons.image(18)}
          </button>
          <button
            class=${classMap({
              composer__send: true,
              'composer__send--sending': this.sending,
            })}
            ?disabled=${!canSend}
            @click=${this._send}
            aria-label=${msg('Send message')}
          >
            ${this.sending ? html`<div class="composer__spinner"></div>` : icons.send(18)}
          </button>
        </div>
        <div class="composer__footer">
          ${
            this._listening
              ? html`
            <span class="composer__hearing" role="status">
              <span class="composer__hearing-dot" aria-hidden="true"></span>
              <span class="composer__hearing-label">${msg('Listening')}</span>
              <span class="composer__hearing-text" aria-hidden="true">${this._interim}</span>
            </span>
          `
              : html`<span class="composer__hint">${msg('Shift+Enter for line break')}</span>`
          }
          ${
            showCounter
              ? html`<span class=${classMap(counterClasses)}>${charCount}/${this.charLimit}</span>`
              : nothing
          }
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-chat-composer': ChatComposer;
  }
}
