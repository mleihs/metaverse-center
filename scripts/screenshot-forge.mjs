#!/usr/bin/env node
/**
 * Headless Playwright script to capture Forge wizard screenshots.
 * Requires live OpenRouter API calls — runs the full 4-phase wizard.
 *
 * Usage:
 *   cd frontend && npx playwright install chromium  # one-time
 *   node ../scripts/screenshot-forge.mjs
 *
 * Output: docs/screenshots/how-to-play/htp-forge-*.png
 */

import { mkdirSync } from 'fs';
import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Playwright lives in frontend/node_modules (nested under @playwright/test)
const require = createRequire(resolve(__dirname, '../frontend/package.json'));
const { chromium } = require('playwright');
const OUT_DIR = resolve(__dirname, '../docs/screenshots/how-to-play');
mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = 'http://localhost:5173';
const EMAIL = 'admin@velgarien.dev';
const PASSWORD = 'velgarien-dev-2026';
const SEED_PROMPT = 'A city built on the back of a sleeping leviathan, where the tide reveals memories and the lighthouse keeper trades in forgotten names.';

// AI generation can take 30-90s
const AI_TIMEOUT = 120_000;
const NAV_TIMEOUT = 15_000;

/** Helper: deep shadow DOM query via page.evaluate */
async function shadowQuery(page, ...selectors) {
  return page.evaluate((sels) => {
    let el = document;
    for (const sel of sels) {
      if (el.shadowRoot) el = el.shadowRoot;
      el = el.querySelector(sel);
      if (!el) return null;
    }
    return true; // element exists
  }, selectors);
}

/** Helper: wait for a shadow DOM element to appear */
async function waitForShadow(page, selectors, timeout = NAV_TIMEOUT) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const found = await shadowQuery(page, ...selectors);
    if (found) return;
    await page.waitForTimeout(500);
  }
  throw new Error(`Timeout waiting for shadow element: ${selectors.join(' > ')}`);
}

/** Helper: click inside shadow DOM */
async function shadowClick(page, ...selectors) {
  await page.evaluate((sels) => {
    let el = document;
    for (const sel of sels) {
      if (el.shadowRoot) el = el.shadowRoot;
      el = el.querySelector(sel);
      if (!el) throw new Error(`Not found: ${sel}`);
    }
    el.click();
  }, selectors);
}

/** Helper: type into shadow DOM input */
async function shadowFill(page, value, ...selectors) {
  await page.evaluate(({ sels, val }) => {
    let el = document;
    for (const sel of sels) {
      if (el.shadowRoot) el = el.shadowRoot;
      el = el.querySelector(sel);
      if (!el) throw new Error(`Not found: ${sel}`);
    }
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, { sels: selectors, val: value });
}

/** Helper: screenshot the full page */
async function screenshot(page, name) {
  const path = resolve(OUT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log(`  📸 ${name}.png`);
  return path;
}

/** Helper: wait for AI generation (scan overlay to appear then disappear) */
async function waitForGeneration(page, phaseComponent, timeout = AI_TIMEOUT) {
  console.log('  ⏳ Waiting for AI generation...');
  // Wait for scan overlay to appear
  await page.waitForTimeout(2000);
  // Wait for it to disappear (generation complete)
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const hasOverlay = await page.evaluate((comp) => {
      const app = document.querySelector('velg-app');
      const wizard = app?.shadowRoot?.querySelector('velg-forge-wizard');
      const phase = wizard?.shadowRoot?.querySelector(comp);
      const overlay = phase?.shadowRoot?.querySelector('velg-forge-scan-overlay');
      // Overlay present and visible means still generating
      if (!overlay) return false;
      const style = getComputedStyle(overlay);
      return style.display !== 'none' && style.opacity !== '0';
    }, phaseComponent);
    if (!hasOverlay) {
      console.log(`  ✅ Generation complete (${Math.round((Date.now() - start) / 1000)}s)`);
      return;
    }
    await page.waitForTimeout(2000);
  }
  console.log('  ⚠️  Generation timeout — screenshotting current state');
}

/** Helper: wait for phase content to render after navigation */
async function waitForPhaseContent(page, phaseComponent, timeout = NAV_TIMEOUT) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const found = await page.evaluate((comp) => {
      const app = document.querySelector('velg-app');
      const wizard = app?.shadowRoot?.querySelector('velg-forge-wizard');
      const phase = wizard?.shadowRoot?.querySelector(comp);
      return !!phase?.shadowRoot?.children.length;
    }, phaseComponent);
    if (found) return;
    await page.waitForTimeout(500);
  }
}

async function main() {
  console.log('🚀 Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // ── Login ──
    console.log('🔐 Logging in...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT });
    await page.waitForTimeout(2000);

    // Fill login form (shadow DOM)
    await shadowFill(page, EMAIL, 'velg-app', 'velg-login-view', '#email');
    await shadowFill(page, PASSWORD, 'velg-app', 'velg-login-view', '#password');
    await shadowClick(page, 'velg-app', 'velg-login-view', '.btn-submit');

    // Wait for dashboard
    await page.waitForTimeout(5000);
    console.log('  ✅ Logged in');

    // Dismiss analytics consent banner by setting localStorage directly
    await page.evaluate(() => {
      localStorage.setItem('analytics-consent', 'denied');
    });
    // Reload to apply (banner won't show again)
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // ── Navigate to Forge ──
    console.log('\n🔨 Phase I: The Astrolabe');
    await page.goto(`${BASE_URL}/forge`, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT });
    await page.waitForTimeout(3000);
    await waitForPhaseContent(page, 'velg-forge-astrolabe');

    // Screenshot: empty seed input
    await screenshot(page, 'htp-forge-01-seed-input');

    // Fill seed prompt
    await page.evaluate(({ prompt }) => {
      const app = document.querySelector('velg-app');
      const wizard = app?.shadowRoot?.querySelector('velg-forge-wizard');
      const astrolabe = wizard?.shadowRoot?.querySelector('velg-forge-astrolabe');
      const textarea = astrolabe?.shadowRoot?.querySelector('textarea');
      if (!textarea) throw new Error('Seed textarea not found');
      textarea.value = prompt;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }, { prompt: SEED_PROMPT });
    await page.waitForTimeout(500);

    // Click "Scan Multiverse"
    await page.evaluate(() => {
      const app = document.querySelector('velg-app');
      const wizard = app?.shadowRoot?.querySelector('velg-forge-wizard');
      const astrolabe = wizard?.shadowRoot?.querySelector('velg-forge-astrolabe');
      const btn = astrolabe?.shadowRoot?.querySelector('.btn.btn--next');
      if (!btn) throw new Error('Scan button not found');
      btn.click();
    });

    // Wait for anchor generation
    await waitForGeneration(page, 'velg-forge-astrolabe');
    await page.waitForTimeout(1500);
    await screenshot(page, 'htp-forge-02-anchors');

    // Select first anchor
    await page.evaluate(() => {
      const app = document.querySelector('velg-app');
      const wizard = app?.shadowRoot?.querySelector('velg-forge-wizard');
      const astrolabe = wizard?.shadowRoot?.querySelector('velg-forge-astrolabe');
      const card = astrolabe?.shadowRoot?.querySelector('.anchor-fan__card');
      if (!card) throw new Error('Anchor card not found');
      card.click();
    });
    await page.waitForTimeout(1000);
    await screenshot(page, 'htp-forge-03-anchor-selected');

    // ── Phase II: Drafting Table ──
    console.log('\n📐 Phase II: The Drafting Table');
    // Click "Descend to Table"
    await page.evaluate(() => {
      const app = document.querySelector('velg-app');
      const wizard = app?.shadowRoot?.querySelector('velg-forge-wizard');
      const astrolabe = wizard?.shadowRoot?.querySelector('velg-forge-astrolabe');
      const btn = astrolabe?.shadowRoot?.querySelector('.btn.btn--advance');
      if (!btn) throw new Error('Advance button not found');
      btn.click();
    });
    await page.waitForTimeout(2000);
    await waitForPhaseContent(page, 'velg-forge-table');
    await screenshot(page, 'htp-forge-04-command-console');

    // Generate Geography (Initiate Survey)
    console.log('  📍 Generating geography...');
    await page.evaluate(() => {
      const app = document.querySelector('velg-app');
      const wizard = app?.shadowRoot?.querySelector('velg-forge-wizard');
      const table = wizard?.shadowRoot?.querySelector('velg-forge-table');
      const panels = table?.shadowRoot?.querySelectorAll('.command-panel');
      // First panel = Cartographic
      const btn = panels?.[0]?.querySelector('.command-panel__action');
      if (!btn) throw new Error('Survey button not found');
      btn.click();
    });
    await waitForGeneration(page, 'velg-forge-table');
    await page.waitForTimeout(1000);

    // Generate Agents (Begin Recruitment)
    console.log('  👤 Generating agents...');
    await page.evaluate(() => {
      const app = document.querySelector('velg-app');
      const wizard = app?.shadowRoot?.querySelector('velg-forge-wizard');
      const table = wizard?.shadowRoot?.querySelector('velg-forge-table');
      const panels = table?.shadowRoot?.querySelectorAll('.command-panel');
      const btn = panels?.[1]?.querySelector('.command-panel__action');
      if (!btn) throw new Error('Recruitment button not found');
      btn.click();
    });
    await waitForGeneration(page, 'velg-forge-table');
    await page.waitForTimeout(1000);

    // Generate Buildings (Draft Blueprints)
    console.log('  🏛️ Generating buildings...');
    await page.evaluate(() => {
      const app = document.querySelector('velg-app');
      const wizard = app?.shadowRoot?.querySelector('velg-forge-wizard');
      const table = wizard?.shadowRoot?.querySelector('velg-forge-table');
      const panels = table?.shadowRoot?.querySelectorAll('.command-panel');
      const btn = panels?.[2]?.querySelector('.command-panel__action');
      if (!btn) throw new Error('Blueprints button not found');
      btn.click();
    });
    await waitForGeneration(page, 'velg-forge-table');
    await page.waitForTimeout(1000);
    await screenshot(page, 'htp-forge-05-staging-hand');

    // Scroll to staging hand and accept all entities
    console.log('  ✅ Accepting entities...');
    await page.evaluate(() => {
      const app = document.querySelector('velg-app');
      const wizard = app?.shadowRoot?.querySelector('velg-forge-wizard');
      const table = wizard?.shadowRoot?.querySelector('velg-forge-table');
      const hand = table?.shadowRoot?.querySelector('.staging-hand');
      if (hand) hand.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await page.waitForTimeout(1000);

    let accepted = 0;
    for (let i = 0; i < 30; i++) {
      const found = await page.evaluate(() => {
        const app = document.querySelector('velg-app');
        const wizard = app?.shadowRoot?.querySelector('velg-forge-wizard');
        const table = wizard?.shadowRoot?.querySelector('velg-forge-table');
        const btns = table?.shadowRoot?.querySelectorAll('.staging-action:not(.staging-action--reject)');
        if (!btns?.length) return false;
        btns[0].click();
        return true;
      });
      if (!found) break;
      accepted++;
      await page.waitForTimeout(600);
    }
    console.log(`  ✅ Accepted ${accepted} entities`);
    await page.waitForTimeout(1000);
    await screenshot(page, 'htp-forge-06-entities-accepted');

    // ── Phase III: Darkroom ──
    console.log('\n🎨 Phase III: The Darkroom');
    // Scroll back up to the advance button
    await page.evaluate(() => {
      const app = document.querySelector('velg-app');
      const wizard = app?.shadowRoot?.querySelector('velg-forge-wizard');
      const table = wizard?.shadowRoot?.querySelector('velg-forge-table');
      const advanceSection = table?.shadowRoot?.querySelector('.command-console__advance');
      if (advanceSection) advanceSection.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const app = document.querySelector('velg-app');
      const wizard = app?.shadowRoot?.querySelector('velg-forge-wizard');
      const table = wizard?.shadowRoot?.querySelector('velg-forge-table');
      const btn = table?.shadowRoot?.querySelector('.btn.btn--next');
      if (!btn) throw new Error('Darkroom button not found');
      btn.click();
    });
    // Wait for AI theme generation — the phase transitions and generates
    await page.waitForTimeout(5000);
    // Poll for darkroom content (may take a while for AI generation)
    const darkroomStart = Date.now();
    while (Date.now() - darkroomStart < AI_TIMEOUT) {
      const ready = await page.evaluate(() => {
        const app = document.querySelector('velg-app');
        const wizard = app?.shadowRoot?.querySelector('velg-forge-wizard');
        const darkroom = wizard?.shadowRoot?.querySelector('velg-forge-darkroom');
        if (!darkroom) return false;
        const controls = darkroom.shadowRoot?.querySelector('.controls');
        return !!controls;
      }).catch(() => false);
      if (ready) break;
      await page.waitForTimeout(2000);
    }
    console.log('  ✅ Darkroom ready');
    await page.waitForTimeout(2000);
    await screenshot(page, 'htp-forge-07-darkroom-palette');

    // Scroll to image settings
    await page.evaluate(() => {
      const app = document.querySelector('velg-app');
      const wizard = app?.shadowRoot?.querySelector('velg-forge-wizard');
      const darkroom = wizard?.shadowRoot?.querySelector('velg-forge-darkroom');
      const imgSettings = darkroom?.shadowRoot?.querySelector('.image-settings');
      if (imgSettings) imgSettings.scrollIntoView({ behavior: 'instant' });
    });
    await page.waitForTimeout(500);
    await screenshot(page, 'htp-forge-08-darkroom-image');

    // ── Phase IV: Ignition ──
    console.log('\n🔥 Phase IV: The Ignition');
    await page.evaluate(() => {
      const app = document.querySelector('velg-app');
      const wizard = app?.shadowRoot?.querySelector('velg-forge-wizard');
      const darkroom = wizard?.shadowRoot?.querySelector('velg-forge-darkroom');
      const btn = darkroom?.shadowRoot?.querySelector('.btn.btn--launch');
      if (!btn) throw new Error('Ignition button not found');
      btn.click();
    });
    await page.waitForTimeout(2000);
    await waitForPhaseContent(page, 'velg-forge-ignition');
    await page.waitForTimeout(1500);
    await screenshot(page, 'htp-forge-09-ignition-summary');

    // Scroll to hold button
    await page.evaluate(() => {
      const app = document.querySelector('velg-app');
      const wizard = app?.shadowRoot?.querySelector('velg-forge-wizard');
      const ignition = wizard?.shadowRoot?.querySelector('velg-forge-ignition');
      const hold = ignition?.shadowRoot?.querySelector('.btn-hold');
      if (hold) hold.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await page.waitForTimeout(500);
    await screenshot(page, 'htp-forge-10-hold-to-ignite');

    console.log('\n✨ All Forge screenshots captured!');
    console.log(`   Output: ${OUT_DIR}/htp-forge-*.png`);
    console.log('\n   ⚠️  Did NOT ignite — no real simulation created.');
    console.log('   To complete: hold-to-ignite for 2s (creates real sim with AI image gen).');

  } catch (err) {
    console.error('❌ Error:', err.message);
    // Save error state screenshot
    await page.screenshot({ path: resolve(OUT_DIR, 'htp-forge-ERROR.png') });
    console.log('  Saved error screenshot: htp-forge-ERROR.png');
  } finally {
    await browser.close();
  }
}

main();
