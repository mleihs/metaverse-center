/**
 * Bespoke orthographic pan/zoom controller: drag pan with release inertia,
 * wheel zoom-to-cursor with exponential smoothing. ~Takt-mode chart camera.
 * Deliberately not camera-controls: the spike judges feel, and this is the
 * exact feel surface (zoom anchoring + damping constants).
 */
export class PanZoomController {
  center = { x: 0, y: 0 };
  viewHeight: number;

  private targetViewHeight: number;
  private velocity = { x: 0, y: 0 };
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };
  private lastMoveTime = 0;
  private zoomAnchor: { sx: number; sy: number; wx: number; wy: number } | null = null;
  private el: HTMLElement;
  readonly pointer = { x: -1, y: -1, inside: false };

  constructor(el: HTMLElement, center: { x: number; y: number }, viewHeight: number) {
    this.el = el;
    this.center = { ...center };
    this.viewHeight = viewHeight;
    this.targetViewHeight = viewHeight;

    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('pointerleave', this.onLeave);
    el.addEventListener('wheel', this.onWheel, { passive: false });
  }

  dispose(): void {
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointercancel', this.onUp);
    this.el.removeEventListener('pointerleave', this.onLeave);
    this.el.removeEventListener('wheel', this.onWheel);
  }

  get unitsPerPixel(): number {
    return this.viewHeight / this.el.clientHeight;
  }

  /**
   * Snap the camera to frame a region. Sets BOTH the live and the target zoom (and
   * kills inertia) — setting only `viewHeight` is overridden a frame later because
   * `update()` eases viewHeight toward `targetViewHeight`. Used to fit the graph.
   */
  frameTo(center: { x: number; y: number }, viewHeight: number): void {
    this.center = { ...center };
    this.viewHeight = viewHeight;
    this.targetViewHeight = viewHeight;
    this.velocity = { x: 0, y: 0 };
    this.zoomAnchor = null;
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const upp = this.unitsPerPixel;
    return {
      x: this.center.x + (sx - this.el.clientWidth / 2) * upp,
      y: this.center.y - (sy - this.el.clientHeight / 2) * upp,
    };
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    const upp = this.unitsPerPixel;
    return {
      x: (wx - this.center.x) / upp + this.el.clientWidth / 2,
      y: (this.center.y - wy) / upp + this.el.clientHeight / 2,
    };
  }

  private onLeave = () => {
    this.pointer.inside = false;
  };

  private onDown = (e: PointerEvent) => {
    this.dragging = true;
    this.zoomAnchor = null;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.lastMoveTime = performance.now();
    this.el.setPointerCapture(e.pointerId);
  };

  private onMove = (e: PointerEvent) => {
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
    this.pointer.inside = true;
    if (!this.dragging) return;

    const upp = this.unitsPerPixel;
    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    this.center.x -= dx * upp;
    this.center.y += dy * upp;

    const now = performance.now();
    const dt = Math.max(1, now - this.lastMoveTime) / 1000;
    // EMA so a final slow movement doesn't kill flick velocity entirely
    const k = 0.55;
    this.velocity.x = this.velocity.x * (1 - k) + ((-dx * upp) / dt) * k;
    this.velocity.y = this.velocity.y * (1 - k) + ((dy * upp) / dt) * k;

    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.lastMoveTime = now;
  };

  private onUp = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.el.hasPointerCapture(e.pointerId)) this.el.releasePointerCapture(e.pointerId);
    // Stale velocity (pointer held still before release) should not fling
    if (performance.now() - this.lastMoveTime > 90) {
      this.velocity.x = 0;
      this.velocity.y = 0;
    }
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const factor = Math.exp(e.deltaY * 0.0013);
    this.targetViewHeight = Math.min(6500, Math.max(260, this.targetViewHeight * factor));
    const w = this.screenToWorld(e.clientX, e.clientY);
    this.zoomAnchor = { sx: e.clientX, sy: e.clientY, wx: w.x, wy: w.y };
  };

  update(dt: number): void {
    // Exponential approach to target zoom
    const zoomBlend = 1 - Math.exp(-dt * 10);
    this.viewHeight += (this.targetViewHeight - this.viewHeight) * zoomBlend;

    // Keep the world point under the cursor fixed while zooming
    if (this.zoomAnchor) {
      const upp = this.unitsPerPixel;
      this.center.x = this.zoomAnchor.wx - (this.zoomAnchor.sx - this.el.clientWidth / 2) * upp;
      this.center.y = this.zoomAnchor.wy + (this.zoomAnchor.sy - this.el.clientHeight / 2) * upp;
      if (Math.abs(this.targetViewHeight - this.viewHeight) < 0.5) this.zoomAnchor = null;
    }

    // Release inertia
    if (!this.dragging) {
      const speed = Math.hypot(this.velocity.x, this.velocity.y);
      if (speed > 1) {
        this.center.x += this.velocity.x * dt;
        this.center.y += this.velocity.y * dt;
        const damp = Math.exp(-dt * 4.2);
        this.velocity.x *= damp;
        this.velocity.y *= damp;
      } else {
        this.velocity.x = 0;
        this.velocity.y = 0;
      }
    }
  }
}
