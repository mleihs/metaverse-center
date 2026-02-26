import { test, expect } from '@playwright/test';

test.describe('Multiverse Map', () => {
  test('map page loads with header and graph', async ({ page }) => {
    await page.goto('/multiverse');

    // Main component should render
    await expect(page.locator('velg-cartographer-map')).toBeVisible({ timeout: 15_000 });

    // Title should be present (EN or DE)
    const title = page.locator('h1');
    await expect(title).toBeVisible();

    // Graph SVG should be present
    await expect(page.locator('velg-map-graph')).toBeVisible({ timeout: 10_000 });
  });

  test('map shows all 4 simulation nodes', async ({ page }) => {
    await page.goto('/multiverse');
    await expect(page.locator('velg-map-graph')).toBeVisible({ timeout: 15_000 });

    // Check that the SVG contains text labels for all 4 simulations
    const svg = page.locator('velg-map-graph');
    await expect(svg.getByText('Velgarien')).toBeVisible({ timeout: 10_000 });
    await expect(svg.getByText('The Capybara Kingdom')).toBeVisible();
    await expect(svg.getByText('Station Null')).toBeVisible();
    await expect(svg.getByText('Speranza')).toBeVisible();
  });

  test('map nav link is visible in header', async ({ page }) => {
    await page.goto('/dashboard');

    // "Map" or "Karte" link should be in the platform header
    const mapLink = page.locator('a[href="/multiverse"]');
    await expect(mapLink).toBeVisible({ timeout: 15_000 });
  });

  test('clicking a node navigates to simulation lore', async ({ page }) => {
    await page.goto('/multiverse');
    await expect(page.locator('velg-map-graph')).toBeVisible({ timeout: 15_000 });

    // SVG nodes have overlapping images that intercept clicks, use force click.
    const nodeBorder = page.locator('velg-map-graph .node-border').first();
    await expect(nodeBorder).toBeVisible({ timeout: 10_000 });
    await nodeBorder.click({ force: true });

    // Should navigate to the simulation's lore page
    await page.waitForURL(/\/simulations\/.*\/lore/, { timeout: 10_000 });
  });

  test('mobile fallback shows card list', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/multiverse');
    await expect(page.locator('velg-cartographer-map')).toBeVisible({ timeout: 15_000 });

    // Mobile card list should be visible
    const mobileCards = page.locator('velg-cartographer-map .mobile-card');
    await expect(mobileCards.first()).toBeVisible({ timeout: 10_000 });
  });
});
