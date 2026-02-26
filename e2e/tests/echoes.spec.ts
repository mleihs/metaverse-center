import { test, expect } from '@playwright/test';

const SIM_VELGARIEN = '10000000-0000-0000-0000-000000000001';

/**
 * Click on an event card's title area (shadow DOM piercing).
 */
async function clickEventCard(page: import('@playwright/test').Page, index = 0) {
  const cardTitle = page.locator('velg-event-card .card__title').nth(index);
  await cardTitle.click();
}

test.describe('Event Echoes (anonymous)', () => {
  test('events view has bleed filter toggle', async ({ page }) => {
    await page.goto(`/simulations/${SIM_VELGARIEN}/events`);

    await expect(page.locator('velg-events-view')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('velg-event-card').first()).toBeVisible({ timeout: 10_000 });

    // Bleed filter checkbox should be present
    const bleedFilter = page.getByText(/Show Bleed events only|Nur Bleed-Ereignisse anzeigen/);
    await expect(bleedFilter).toBeVisible();
  });

  test('bleed filter checkbox toggles', async ({ page }) => {
    await page.goto(`/simulations/${SIM_VELGARIEN}/events`);
    await expect(page.locator('velg-event-card').first()).toBeVisible({ timeout: 15_000 });

    // Find and click the checkbox
    const checkbox = page.locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    // Uncheck
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
  });

  test('echoes API returns data for simulation', async ({ page }) => {
    const response = await page.request.get(
      `/api/v1/public/simulations/${SIM_VELGARIEN}/echoes`,
    );

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('connections API returns all simulation connections', async ({ page }) => {
    const response = await page.request.get('/api/v1/public/connections');

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBeTruthy();
    // Should have 6 connections (complete graph of 4 sims)
    expect(body.data.length).toBe(6);
  });

  test('map-data API returns aggregated data', async ({ page }) => {
    const response = await page.request.get('/api/v1/public/map-data');

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('simulations');
    expect(body.data).toHaveProperty('connections');
    expect(body.data).toHaveProperty('echo_counts');
    expect(body.data.simulations.length).toBe(4);
    expect(body.data.connections.length).toBe(6);
  });

  test('event detail panel shows echoes section', async ({ page }) => {
    await page.goto(`/simulations/${SIM_VELGARIEN}/events`);
    await expect(page.locator('velg-event-card').first()).toBeVisible({ timeout: 15_000 });

    await clickEventCard(page);

    // "Echoes" or "Echos" section should be present
    const echoHeader = page.getByText(/Echoes|Echos/);
    await expect(echoHeader).toBeVisible({ timeout: 10_000 });
  });

  test('trigger echo button hidden for anonymous users', async ({ page }) => {
    await page.goto(`/simulations/${SIM_VELGARIEN}/events`);
    await expect(page.locator('velg-event-card').first()).toBeVisible({ timeout: 15_000 });

    await clickEventCard(page);

    // Wait for the echoes section to render (confirms panel is open with data)
    await expect(page.getByText(/Echoes|Echos/)).toBeVisible({ timeout: 10_000 });

    // The "Trigger Echo" button in the echoes section should NOT be visible for anon users.
    // Note: The EchoTriggerModal is always in the DOM (hidden) with "Trigger Echo" text,
    // so we check the VISIBLE button specifically, not just any DOM text match.
    const visibleTriggerBtn = page.locator('button:visible', { hasText: /Trigger Echo|Echo auslösen/ });
    await expect(visibleTriggerBtn).toHaveCount(0);
  });
});
