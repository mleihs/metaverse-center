import { test, expect } from '@playwright/test';

/**
 * Seed simulation IDs (must match supabase/seed/).
 * Note: these are the REAL seed UUIDs, not the placeholder ones from fixtures.ts.
 */
const SIM_VELGARIEN = '10000000-0000-0000-0000-000000000001';

test.describe('Anonymous browsing', () => {
  test('dashboard loads simulation cards without login', async ({ page }) => {
    await page.goto('/dashboard');

    // Should NOT redirect to /login
    await expect(page).not.toHaveURL(/\/login/);

    // Dashboard should render with simulation cards
    await expect(page.locator('velg-simulations-dashboard')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('velg-simulation-card').first()).toBeVisible({ timeout: 15_000 });

    // Sign-in button should be visible (not user menu)
    await expect(page.locator('.btn-sign-in')).toBeVisible();
  });

  test('can navigate into a simulation and see agents', async ({ page }) => {
    await page.goto(`/simulations/${SIM_VELGARIEN}/agents`);

    // Should render the simulation shell and agents view
    await expect(page.locator('velg-simulation-shell')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('velg-agents-view')).toBeVisible({ timeout: 10_000 });

    // Agent cards should be loaded from the public API
    await expect(page.locator('velg-agent-card').first()).toBeVisible({ timeout: 10_000 });
  });

  test('can browse buildings without login', async ({ page }) => {
    await page.goto(`/simulations/${SIM_VELGARIEN}/buildings`);

    await expect(page.locator('velg-simulation-shell')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('velg-buildings-view')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('velg-building-card').first()).toBeVisible({ timeout: 10_000 });
  });

  test('can browse events without login', async ({ page }) => {
    await page.goto(`/simulations/${SIM_VELGARIEN}/events`);

    await expect(page.locator('velg-simulation-shell')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('velg-events-view')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('velg-event-card').first()).toBeVisible({ timeout: 10_000 });
  });

  test('create button is hidden for anonymous users', async ({ page }) => {
    await page.goto(`/simulations/${SIM_VELGARIEN}/agents`);

    await expect(page.locator('velg-agents-view')).toBeVisible({ timeout: 15_000 });
    // Wait for cards to load (ensures the view is fully rendered)
    await expect(page.locator('velg-agent-card').first()).toBeVisible({ timeout: 10_000 });

    // The create button should NOT be visible
    await expect(page.locator('.view__create-btn')).toBeHidden();
  });

  test('edit and delete buttons are hidden on agent cards', async ({ page }) => {
    await page.goto(`/simulations/${SIM_VELGARIEN}/agents`);

    await expect(page.locator('velg-agent-card').first()).toBeVisible({ timeout: 15_000 });

    // Card action buttons (edit/delete) should not be present for anonymous users
    const firstCard = page.locator('velg-agent-card').first();
    await expect(firstCard.locator('velg-icon-button')).toHaveCount(0);
  });

  test('chat shows read-only state for anonymous users', async ({ page }) => {
    await page.goto(`/simulations/${SIM_VELGARIEN}/chat`);

    await expect(page.locator('velg-simulation-shell')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('velg-chat-view')).toBeVisible({ timeout: 10_000 });

    // Message input should be readonly or the "new conversation" button should be hidden
    const newConvButton = page.locator('button', { hasText: /new conversation|start chat/i });
    await expect(newConvButton).toBeHidden({ timeout: 5_000 });
  });

  test('login panel opens when sign-in button is clicked', async ({ page }) => {
    await page.goto(`/simulations/${SIM_VELGARIEN}/agents`);

    await expect(page.locator('.btn-sign-in')).toBeVisible({ timeout: 15_000 });
    await page.locator('.btn-sign-in').click();

    // Login panel should slide in
    await expect(page.locator('velg-login-panel')).toBeVisible({ timeout: 5_000 });
  });

  test('locations view loads without login', async ({ page }) => {
    await page.goto(`/simulations/${SIM_VELGARIEN}/locations`);

    await expect(page.locator('velg-simulation-shell')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('velg-locations-view')).toBeVisible({ timeout: 10_000 });
  });

  test('social view loads without login', async ({ page }) => {
    await page.goto(`/simulations/${SIM_VELGARIEN}/social`);

    await expect(page.locator('velg-simulation-shell')).toBeVisible({ timeout: 15_000 });
  });

  test('settings route redirects anonymous users to login', async ({ page }) => {
    // Settings is auth-guarded (uses _guardAuth)
    await page.goto(`/simulations/${SIM_VELGARIEN}/settings`);
    await page.waitForURL(/\/login/, { timeout: 10_000 });
  });
});
