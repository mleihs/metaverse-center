/**
 * Die Zyklusuhr — ein Reactive Controller, zwei Buehnen.
 *
 * Die redaktionelle Buehne und das Atlas-Blatt zeigen dieselbe Zahl: wie lange
 * der laufende Zyklus noch laeuft. Nur der Rahmen darum ist verschieden.
 *
 * WARUM ALS CONTROLLER UND NICHT ZWEIMAL
 *   Es ist eine Uhr. Zwei Uhren auf zwei Buehnen gehen irgendwann auseinander,
 *   und die eine wuerde eine Sekunde spaeter auf Null springen als die andere —
 *   ein Unterschied, den niemand bemerkt und niemand erklaeren koennte.
 *
 * DIE UHR LAEUFT NUR, WENN ES ETWAS ZU ZAEHLEN GIBT
 *   `cycle_deadline_at` ist nullbar, und `null` heisst nicht "kein Zyklus",
 *   sondern "fuer diese Epoche laeuft keine Uhr" — auf Prod bei allen sieben
 *   der Fall. Ein Intervall dafuer waere Arbeit ohne Gegenstand, und ein
 *   Countdown, der 00:00:00 zeigt, waere eine Luege ueber eine abgelaufene
 *   Frist. Deshalb: kein Intervall, und `running` bleibt falsch.
 */

import type { ReactiveController, ReactiveControllerHost } from 'lit';

/** Sekundentakt. Feiner waere Arbeit, die niemand sieht. */
const TICK_MS = 1000;

export class CycleCountdown implements ReactiveController {
  /** Rest in Millisekunden; 0, wenn keine Frist laeuft. */
  remainingMs = 0;

  private _timer: number | null = null;
  private _deadline: string | null = null;

  constructor(private readonly host: ReactiveControllerHost) {
    host.addController(this);
  }

  /** Wahr, wenn wirklich etwas laeuft — die Frage, die beide Buehnen stellen. */
  get running(): boolean {
    return this._deadline !== null && this.remainingMs > 0;
  }

  /** hh:mm:ss. Ohne laufende Uhr sinnlos; die Wirte fragen vorher `running`. */
  get formatted(): string {
    const total = Math.floor(this.remainingMs / 1000);
    const h = String(Math.floor(total / 3600)).padStart(2, '0');
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  /** Ganze Stunden, fuer die Vorlesehilfe des Zeitgebers. */
  get hoursLeft(): number {
    return Math.floor(this.remainingMs / 3600000);
  }

  /**
   * Auf eine Frist setzen. Bei jeder Aenderung der Beteiligung aufrufen — der
   * Controller kennt die Beteiligung nicht, nur ihr Datum.
   */
  watch(deadline: string | null | undefined): void {
    this._deadline = deadline ?? null;
    this._stop();

    if (!this._deadline) {
      this.remainingMs = 0;
      this.host.requestUpdate();
      return;
    }

    this._tick();
    this._timer = window.setInterval(() => this._tick(), TICK_MS);
  }

  hostDisconnected(): void {
    this._stop();
  }

  private _tick(): void {
    const deadline = this._deadline;
    if (!deadline) return;
    this.remainingMs = Math.max(0, new Date(deadline).getTime() - Date.now());
    if (this.remainingMs === 0) this._stop();
    this.host.requestUpdate();
  }

  private _stop(): void {
    if (this._timer !== null) {
      window.clearInterval(this._timer);
      this._timer = null;
    }
  }
}
