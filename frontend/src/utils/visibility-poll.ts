/**
 * Visibility-gated polling — shared timer pattern for background data refresh.
 *
 * Extracted from SimulationWorldMap's stability refresh: the setInterval keeps
 * firing on its cadence (browsers keep hidden-tab intervals alive, throttled to
 * a 1s minimum anyway), but the work is gated on document visibility. The cost
 * of a no-op tick is negligible vs. the lifecycle complexity of start/stop
 * cycling on every visibility flip.
 *
 * A `visibilitychange` listener fires one catch-up tick when the user returns
 * to a previously-hidden tab — polls missed while away are compensated
 * immediately instead of waiting out the current interval.
 *
 * Usage (Lit component):
 *
 *   private _stopPoll: StopPoll | null = null;
 *
 *   connectedCallback(): void {
 *     super.connectedCallback();
 *     this._stopPoll = startVisibilityPoll(() => void this._refresh(), 30_000);
 *   }
 *
 *   disconnectedCallback(): void {
 *     super.disconnectedCallback();
 *     this._stopPoll?.();
 *     this._stopPoll = null;
 *   }
 *
 * Component-specific guards (missing map instance, active filter, in-flight
 * dedupe) belong inside the tick callback — they then apply uniformly to both
 * the interval tick and the catch-up tick.
 */

/** Tears down the interval and the visibilitychange listener. Idempotent. */
export type StopPoll = () => void;

export function startVisibilityPoll(tick: () => void, intervalMs: number): StopPoll {
  const timer = window.setInterval(() => {
    if (document.hidden) return;
    tick();
  }, intervalMs);

  const onVisibilityChange = (): void => {
    if (!document.hidden) tick();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
