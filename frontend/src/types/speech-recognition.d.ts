/**
 * Ambient declaration for the Web Speech API's recognition controller.
 *
 * TypeScript 6.0's `lib.dom.d.ts` already ships every type that *hangs off*
 * speech recognition — `SpeechRecognitionEvent`, `SpeechRecognitionErrorEvent`,
 * `SpeechRecognitionResultList`, `SpeechRecognitionResult`,
 * `SpeechRecognitionAlternative` and the `SpeechRecognitionErrorCode` union —
 * but not the `SpeechRecognition` object that produces them, because the
 * unprefixed constructor is not yet Baseline. Everything below therefore reuses
 * the library's own types and adds only the missing controller.
 *
 * Only the surface the platform actually calls is declared. The spec has more
 * (`grammars`, `onaudiostart`, `onspeechend`, `onnomatch`, …); declaring those
 * unused members would assert support this codebase has never exercised.
 *
 * Delete this file once `lib.dom.d.ts` declares `SpeechRecognition` itself —
 * the duplicate declaration will fail the build loudly, which is the point.
 */

interface SpeechRecognition extends EventTarget {
  /** BCP-47 tag. Empty string falls back to `document.documentElement.lang`. */
  lang: string;
  /** `false` stops after one utterance; `true` keeps the microphone open. */
  continuous: boolean;
  /** Emit `result` events for words still being resolved. */
  interimResults: boolean;
  /** How many alternatives each result carries. 1 is the default. */
  maxAlternatives: number;

  start(): void;
  /** Ends the session and delivers any pending final result. */
  stop(): void;
  /** Ends the session and discards pending results. */
  abort(): void;

  onstart: ((this: SpeechRecognition, ev: Event) => unknown) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => unknown) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => unknown) | null;
  onend: ((this: SpeechRecognition, ev: Event) => unknown) | null;
}

interface SpeechRecognitionConstructor {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
}

interface Window {
  /** Unprefixed constructor. Absent in Firefox, present in Chrome/Edge. */
  SpeechRecognition?: SpeechRecognitionConstructor;
  /** Prefixed constructor. Safari and older Chrome only ever expose this one. */
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}
