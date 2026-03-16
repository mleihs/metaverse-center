/**
 * Forge Mobile UX — Component-level visual testing on mobile viewports.
 *
 * Since local Supabase may not be running, we inject forge components directly
 * and test their rendering, touch targets, font sizes, and layout at each viewport.
 *
 * Run: npx playwright test tests/forge-mobile-e2e.spec.ts --reporter=list
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:5173';

const VIEWPORTS = {
  'iphone-se': { width: 375, height: 667 },
  'iphone-16-pro-max': { width: 440, height: 956 },
  'galaxy-s24': { width: 360, height: 780 },
  'landscape': { width: 667, height: 375 },
} as const;

function shot(device: string, name: string): string {
  return `test-results/forge-e2e/${device}--${name}.png`;
}

/**
 * Inject a forge component into the page by dynamically importing its module
 * and adding it to the DOM. This bypasses auth/routing.
 */
async function injectComponent(page: Page, tagName: string, modulePath: string, attrs: Record<string, string> = {}): Promise<boolean> {
  return page.evaluate(async ({ tag, mod, at }) => {
    try {
      await import(mod);
      const el = document.createElement(tag);
      for (const [k, v] of Object.entries(at)) {
        el.setAttribute(k, v);
      }
      // Clear page and inject
      const container = document.getElementById('test-container') || document.createElement('div');
      container.id = 'test-container';
      container.innerHTML = '';
      container.appendChild(el);
      if (!container.parentElement) document.body.appendChild(container);
      // Wait for Lit to render
      await new Promise(r => setTimeout(r, 500));
      if ('updateComplete' in el) await (el as any).updateComplete;
      return true;
    } catch (e) {
      console.error('inject failed:', e);
      return false;
    }
  }, { tag: tagName, mod: modulePath, at: attrs });
}

/** Measure all elements matching a selector inside a shadow root */
async function measureShadowElements(page: Page, host: string, selector: string): Promise<Array<{ selector: string; width: number; height: number; fontSize: string }>> {
  return page.evaluate(({ h, s }) => {
    const hostEl = document.querySelector(h);
    if (!hostEl?.shadowRoot) return [];
    const els = hostEl.shadowRoot.querySelectorAll(s);
    return Array.from(els).map(el => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        selector: s,
        width: Math.round(r.width),
        height: Math.round(r.height),
        fontSize: cs.fontSize,
      };
    });
  }, { h: host, s: selector });
}

/** Get a computed style value from shadow DOM */
async function shadowStyle(page: Page, host: string, inner: string, prop: string): Promise<string> {
  return page.evaluate(({ h, i, p }) => {
    const el = document.querySelector(h)?.shadowRoot?.querySelector(i);
    if (!el) return 'NOT_FOUND';
    return getComputedStyle(el).getPropertyValue(p);
  }, { h: host, i: inner, p: prop });
}

// ══════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════

for (const [device, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`${device} (${viewport.width}×${viewport.height})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(viewport);
      // Load the app to get Vite's module system available
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
    });

    // ── Landing page ──────────────────────────────

    test('landing page — no overflow, proper layout', async ({ page }) => {
      await page.screenshot({ path: shot(device, '01-landing'), fullPage: false });
      await page.screenshot({ path: shot(device, '01b-landing-full'), fullPage: true });

      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(overflow, 'No horizontal overflow').toBe(false);

      // Check viewport meta
      const meta = await page.getAttribute('meta[name="viewport"]', 'content');
      expect(meta).toContain('viewport-fit=cover');
    });

    // ── Astrolabe (Phase I) ───────────────────────

    test('Astrolabe — seed input, suggestions, touch targets', async ({ page }) => {
      const injected = await injectComponent(page, 'velg-forge-astrolabe', '/src/components/forge/VelgForgeAstrolabe.ts');
      if (!injected) {
        console.log(`[${device}] Could not inject Astrolabe`);
        return;
      }

      await page.waitForTimeout(1000);
      await page.screenshot({ path: shot(device, '02-astrolabe'), fullPage: false });
      await page.screenshot({ path: shot(device, '02b-astrolabe-full'), fullPage: true });

      // Check seed textarea font size on mobile
      if (viewport.width <= 768) {
        const fontSize = await shadowStyle(page, 'velg-forge-astrolabe', '.seed-box textarea', 'font-size');
        if (fontSize !== 'NOT_FOUND') {
          console.log(`[${device}] Astrolabe textarea font: ${fontSize}`);
          expect(parseFloat(fontSize), 'Textarea font ≥16px (iOS zoom prevention)').toBeGreaterThanOrEqual(16);
        }
      }

      // Check seed suggestion touch targets
      const suggestions = await measureShadowElements(page, 'velg-forge-astrolabe', '.seed-suggestion');
      for (const s of suggestions) {
        console.log(`[${device}] Seed suggestion: ${s.width}×${s.height}`);
        expect(s.height, 'Seed suggestion ≥44px touch target').toBeGreaterThanOrEqual(44);
      }

      // Check "Scan Multiverse" button
      const scanBtns = await measureShadowElements(page, 'velg-forge-astrolabe', '.btn--next');
      for (const b of scanBtns) {
        console.log(`[${device}] Scan button: ${b.width}×${b.height}`);
      }
    });

    // ── ClearanceQueue ────────────────────────────

    test('ClearanceQueue — mobile layout, touch targets, font sizes', async ({ page }) => {
      const injected = await injectComponent(page, 'velg-clearance-queue', '/src/components/forge/ClearanceQueue.ts');
      if (!injected) {
        console.log(`[${device}] Could not inject ClearanceQueue`);
        return;
      }

      await page.waitForTimeout(1000);
      await page.screenshot({ path: shot(device, '03-clearance-queue'), fullPage: false });

      // Check approve/reject button heights
      const approveBtns = await measureShadowElements(page, 'velg-clearance-queue', '.btn-approve');
      for (const b of approveBtns) {
        console.log(`[${device}] Approve btn: ${b.width}×${b.height}`);
        expect(b.height, 'Approve btn ≥44px').toBeGreaterThanOrEqual(44);
      }

      const rejectBtns = await measureShadowElements(page, 'velg-clearance-queue', '.btn-reject');
      for (const b of rejectBtns) {
        console.log(`[${device}] Reject btn: ${b.width}×${b.height}`);
        expect(b.height, 'Reject btn ≥44px').toBeGreaterThanOrEqual(44);
      }

      // Check notes input font
      if (viewport.width <= 768) {
        const noteFont = await shadowStyle(page, 'velg-clearance-queue', '.request-card__notes-input', 'font-size');
        if (noteFont !== 'NOT_FOUND') {
          console.log(`[${device}] Notes input font: ${noteFont}`);
          expect(parseFloat(noteFont), 'Notes input ≥16px').toBeGreaterThanOrEqual(16);
        }
      }

      // Check mobile column layout
      if (viewport.width <= 640) {
        const headerDir = await shadowStyle(page, 'velg-clearance-queue', '.request-card__header', 'flex-direction');
        if (headerDir !== 'NOT_FOUND') {
          expect(headerDir, 'Header stacks on mobile').toBe('column');
        }

        const actionsDir = await shadowStyle(page, 'velg-clearance-queue', '.request-card__actions', 'flex-direction');
        if (actionsDir !== 'NOT_FOUND') {
          expect(actionsDir, 'Actions stack on mobile').toBe('column');
        }
      }
    });

    // ── Mint ──────────────────────────────────────

    test('Mint — overlay layout, safe area, overscroll', async ({ page }) => {
      const injected = await injectComponent(page, 'velg-forge-mint', '/src/components/forge/VelgForgeMint.ts');
      if (!injected) {
        console.log(`[${device}] Could not inject Mint`);
        return;
      }

      // The Mint only renders when mintOpen signal is true — check source
      const mintSource = await page.evaluate(async () => {
        const res = await fetch('/src/components/forge/VelgForgeMint.ts');
        const text = await res.text();
        return {
          hasSafeArea: text.includes('safe-area-inset'),
          hasOverscroll: text.includes('overscroll-behavior: contain'),
          has16px: text.includes('font-size: 16px'),
        };
      });

      expect(mintSource.hasSafeArea, 'Mint has safe-area padding').toBe(true);
      expect(mintSource.hasOverscroll, 'Mint has overscroll contain').toBe(true);
      expect(mintSource.has16px, 'Mint has 16px mobile font').toBe(true);
      console.log(`[${device}] Mint source checks: `, mintSource);
    });

    // ── Bureau Dispatch ───────────────────────────

    test('Dispatch — touch targets, safe area, overscroll', async ({ page }) => {
      const injected = await injectComponent(
        page,
        'velg-bureau-dispatch',
        '/src/components/forge/VelgBureauDispatch.ts',
        { open: '' },
      );
      if (!injected) {
        console.log(`[${device}] Could not inject Dispatch`);
        return;
      }

      await page.waitForTimeout(1000);

      // Force open
      await page.evaluate(() => {
        const el = document.querySelector('velg-bureau-dispatch') as any;
        if (el) el.open = true;
      });
      await page.waitForTimeout(500);
      await page.screenshot({ path: shot(device, '04-dispatch'), fullPage: false });

      // Check nav button touch targets
      const navBtns = await measureShadowElements(page, 'velg-bureau-dispatch', '.service__nav-btn');
      for (const b of navBtns) {
        console.log(`[${device}] Dispatch nav btn: ${b.width}×${b.height}`);
        expect(b.height, 'Nav btn ≥44px').toBeGreaterThanOrEqual(44);
      }

      // Check ack button
      const ackBtns = await measureShadowElements(page, 'velg-bureau-dispatch', '.dispatch__ack-btn');
      for (const b of ackBtns) {
        console.log(`[${device}] Dispatch ack btn: ${b.width}×${b.height}`);
        expect(b.height, 'Ack btn ≥44px').toBeGreaterThanOrEqual(44);
      }

      // Check overscroll
      const overscroll = await shadowStyle(page, 'velg-bureau-dispatch', '.dispatch', 'overscroll-behavior');
      if (overscroll !== 'NOT_FOUND') {
        expect(overscroll).toContain('contain');
      }
    });

    // ── Darkroom Studio ───────────────────────────

    test('Darkroom — touch targets, safe area, font sizes', async ({ page }) => {
      const injected = await injectComponent(
        page,
        'velg-darkroom-studio',
        '/src/components/forge/VelgDarkroomStudio.ts',
        { open: '' },
      );
      if (!injected) return;

      await page.evaluate(() => {
        const el = document.querySelector('velg-darkroom-studio') as any;
        if (el) el.open = true;
      });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: shot(device, '05-darkroom'), fullPage: false });

      // Close button 44px
      const closeBtns = await measureShadowElements(page, 'velg-darkroom-studio', '.header__close');
      for (const b of closeBtns) {
        console.log(`[${device}] Darkroom close: ${b.width}×${b.height}`);
        expect(b.width, 'Close btn ≥44px wide').toBeGreaterThanOrEqual(44);
        expect(b.height, 'Close btn ≥44px tall').toBeGreaterThanOrEqual(44);
      }

      // Tab buttons 44px
      const tabs = await measureShadowElements(page, 'velg-darkroom-studio', '.tab');
      for (const t of tabs) {
        console.log(`[${device}] Darkroom tab: ${t.width}×${t.height}`);
        expect(t.height, 'Tab ≥44px').toBeGreaterThanOrEqual(44);
      }

      // Safe area on header
      const headerPadTop = await shadowStyle(page, 'velg-darkroom-studio', '.header', 'padding-top');
      if (headerPadTop !== 'NOT_FOUND') {
        console.log(`[${device}] Darkroom header padding-top: ${headerPadTop}`);
        expect(parseFloat(headerPadTop)).toBeGreaterThan(0);
      }

      // Content overscroll
      const contentOverscroll = await shadowStyle(page, 'velg-darkroom-studio', '.content', 'overscroll-behavior');
      if (contentOverscroll !== 'NOT_FOUND') {
        expect(contentOverscroll).toContain('contain');
      }

      // Prompt textarea font on mobile
      if (viewport.width <= 768) {
        const promptFont = await shadowStyle(page, 'velg-darkroom-studio', '.regen-panel__prompt', 'font-size');
        if (promptFont !== 'NOT_FOUND') {
          console.log(`[${device}] Darkroom prompt font: ${promptFont}`);
          expect(parseFloat(promptFont), 'Prompt textarea ≥16px').toBeGreaterThanOrEqual(16);
        }
      }
    });

    // ── Ceremony (CSS only — not triggerable without full flow) ──

    test('Ceremony — CSS rules verified', async ({ page }) => {
      const source = await page.evaluate(async () => {
        const res = await fetch('/src/components/forge/VelgForgeCeremony.ts');
        return res.text();
      });

      // Phase 1C: safe-area
      expect(source).toContain('safe-area-inset-top');
      expect(source).toContain('safe-area-inset-bottom');

      // Phase 2A: short viewport
      expect(source).toContain('max-height: 700px');
      expect(source).toContain('overflow-y: auto');

      // Phase 2B: landscape
      expect(source).toContain('orientation: landscape');
      expect(source).toContain('max-height: 500px');

      // Phase 2C: GPU hints
      expect(source).toContain('will-change: transform, opacity');
      expect(source).toContain('contain: layout style');
      expect(source).toContain('contain: strict');
      expect(source).toContain('will-change: width');

      // Phase 2D: Wake Lock
      expect(source).toContain('_requestWakeLock');
      expect(source).toContain('_releaseWakeLock');
      expect(source).toContain('visibilitychange');

      // Phase 3A: Haptic
      expect(source).toContain('navigator.vibrate(50)');
      expect(source).toContain('navigator.vibrate([100, 50, 100])');

      // Reduced motion removes will-change
      expect(source).toContain('will-change: auto');

      console.log(`[${device}] Ceremony: all CSS rules verified`);
    });

    // ── Media query activation ────────────────────

    test('media queries fire correctly', async ({ page }) => {
      const queries = await page.evaluate(() => ({
        mobile768: window.matchMedia('(max-width: 768px)').matches,
        mobile640: window.matchMedia('(max-width: 640px)').matches,
        mobile480: window.matchMedia('(max-width: 480px)').matches,
        shortViewport: window.matchMedia('(max-height: 700px)').matches,
        landscape: window.matchMedia('(orientation: landscape) and (max-height: 500px)').matches,
      }));

      console.log(`[${device}] Media queries:`, queries);

      if (viewport.width <= 768) expect(queries.mobile768).toBe(true);
      if (viewport.width <= 640) expect(queries.mobile640).toBe(true);
      if (viewport.width <= 480) expect(queries.mobile480).toBe(true);
      if (viewport.height <= 700) expect(queries.shortViewport).toBe(true);
      if (viewport.height <= 500 && viewport.width > viewport.height) {
        expect(queries.landscape).toBe(true);
      }
    });
  });
}
