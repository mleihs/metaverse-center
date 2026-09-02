/**
 * ChatLockService — der Sichtschutz auf verschlossene Gespräche.
 *
 * WAS DIESE SPERRE IST UND WAS NICHT
 *
 * Sie hält jemanden ab, der auf den Bildschirm sieht. Sie hält niemanden ab,
 * der ein gültiges Zugangstoken hat: `chat_conversations.locked` ändert die
 * RLS nicht, und die Nachrichten kommen über die API weiter heraus. Das ist
 * kein Versehen, sondern der Umfang — und er gehört benannt, damit niemand
 * später eine Zusicherung daraus liest, die nicht drinsteht. Wer Schutz gegen
 * jemanden mit Token braucht, braucht eine andere Bauart: eine Passphrase, die
 * den Inhalt selbst verschlüsselt.
 *
 * Serverseitig durchgesetzt wird deshalb genau eine Sache: das UMLEGEN des
 * Verschlusses verlangt das Kontopasswort im selben Aufruf
 * (`PATCH …/conversations/:id/lock`). Das ANSEHEN zu verwehren ist Sache
 * dieses Dienstes und der Komponenten, die ihn fragen.
 *
 * WARUM `sessionStorage` UND NICHT `localStorage`
 *
 * `localStorage` überlebt das Schliessen des Reiters — und damit überlebte die
 * Freigabe genau den Vorgang, nach dem sie am wenigsten gelten soll: der
 * Nutzer steht auf und geht. `sessionStorage` endet mit dem Reiter, und das
 * ist hier die richtige Lebensdauer.
 */

import { signal } from '@preact/signals-core';
import { captureError } from '../SentryService.js';

const STORAGE_KEY = 'velg-chat-unlock-until';

/**
 * Wie lange eine bestandene Passwortprüfung gilt. Der Server nennt die Zahl in
 * seiner Antwort; dies ist der Rückfall, falls sie fehlt.
 */
const DEFAULT_VALID_SECONDS = 1800;

class ChatLockService {
  /**
   * Ob verschlossene Gespräche gerade sichtbar sein dürfen.
   *
   * Ein Signal und keine Methode, damit die Liste und das Fenster von selbst
   * neu zeichnen, wenn die Frist abläuft oder der Nutzer wieder abschliesst.
   */
  readonly unlocked = signal(false);

  private _timer = 0;

  constructor() {
    this._restore();
  }

  /**
   * Freigabe nach bestandener Prüfung. `validForSeconds` kommt vom Server.
   */
  grant(validForSeconds: number = DEFAULT_VALID_SECONDS): void {
    const until = Date.now() + validForSeconds * 1000;
    try {
      sessionStorage.setItem(STORAGE_KEY, String(until));
    } catch (err) {
      // Privater Modus, gesperrter Speicher: die Freigabe gilt dann nur für
      // diese Seitenladung. Das ist eine Einschränkung, kein Ausfall — der
      // Sichtschutz wird dadurch strenger, nie lockerer.
      captureError(err, { source: 'ChatLockService.grant' });
    }
    this.unlocked.value = true;
    this._scheduleExpiry(until);
  }

  /** Sofort wieder abschliessen (Knopf „Wieder sperren", Abmelden). */
  revoke(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      captureError(err, { source: 'ChatLockService.revoke' });
    }
    clearTimeout(this._timer);
    this.unlocked.value = false;
  }

  /**
   * Ob ein bestimmtes Gespräch gerade gezeigt werden darf.
   *
   * Eine Funktion statt einer Prüfung an jeder Stelle: „verschlossen und nicht
   * freigegeben" ist EINE Aussage, und sie soll auch nur an einem Ort stehen.
   */
  isHidden(conversation: { locked?: boolean } | null | undefined): boolean {
    return Boolean(conversation?.locked) && !this.unlocked.value;
  }

  private _restore(): void {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(STORAGE_KEY);
    } catch (err) {
      captureError(err, { source: 'ChatLockService._restore' });
      return;
    }
    const until = Number(raw);
    // `Number(null)` ist 0, `Number('abc')` ist NaN — beide fallen hier
    // durch, und beide bedeuten dasselbe: keine gültige Freigabe.
    if (!Number.isFinite(until) || until <= Date.now()) {
      this.unlocked.value = false;
      return;
    }
    this.unlocked.value = true;
    this._scheduleExpiry(until);
  }

  private _scheduleExpiry(until: number): void {
    clearTimeout(this._timer);
    const rest = until - Date.now();
    if (rest <= 0) {
      this.unlocked.value = false;
      return;
    }
    // `setTimeout` nimmt höchstens einen 32-Bit-Wert; darüber feuert es
    // SOFORT. Bei 30 Minuten ist das weit weg, aber die Zahl kommt vom
    // Server, und ein Rechenfehler dort soll die Sperre nicht aufheben.
    this._timer = window.setTimeout(() => this.revoke(), Math.min(rest, 2 ** 31 - 1));
  }
}

/** Singleton — Liste, Fenster und Modal fragen dieselbe Wahrheit. */
export const chatLock = new ChatLockService();
