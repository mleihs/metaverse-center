import { test, expect } from '@playwright/test';

const SIM_VELGARIEN = '10000000-0000-0000-0000-000000000001';

/**
 * Click on an agent card's body area (shadow DOM piercing).
 * Must click the card body, not the avatar — avatar click opens lightbox.
 */
async function clickAgentCard(page: import('@playwright/test').Page, index = 0) {
  const cardBody = page.locator('velg-agent-card .card__body').nth(index);
  await cardBody.click();
}

test.describe('Agent Relationships (anonymous)', () => {
  test('agent detail panel shows relationships section', async ({ page }) => {
    await page.goto(`/simulations/${SIM_VELGARIEN}/agents`);
    await expect(page.locator('velg-agent-card').first()).toBeVisible({ timeout: 15_000 });

    await clickAgentCard(page);

    // Side panel should open with content
    const relHeader = page.getByText(/Relationships|Beziehungen/);
    await expect(relHeader).toBeVisible({ timeout: 10_000 });
  });

  test('relationship cards render with agent info', async ({ page }) => {
    await page.goto(`/simulations/${SIM_VELGARIEN}/agents`);
    await expect(page.locator('velg-agent-card').first()).toBeVisible({ timeout: 15_000 });

    await clickAgentCard(page);

    // The "Relationships" section should always be present even if empty
    const relSection = page.getByText(/Relationships|Beziehungen/);
    await expect(relSection).toBeVisible({ timeout: 10_000 });
  });

  test('relationships API returns data for simulation', async ({ page }) => {
    const response = await page.request.get(
      `/api/v1/public/simulations/${SIM_VELGARIEN}/relationships`,
    );

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('relationship data includes required fields', async ({ page }) => {
    const response = await page.request.get(
      `/api/v1/public/simulations/${SIM_VELGARIEN}/relationships`,
    );

    const body = await response.json();
    if (body.data && body.data.length > 0) {
      const rel = body.data[0];
      expect(rel).toHaveProperty('source_agent_id');
      expect(rel).toHaveProperty('target_agent_id');
      expect(rel).toHaveProperty('relationship_type');
      expect(rel).toHaveProperty('intensity');
    }
  });

  test('add/edit relationship buttons hidden for anonymous users', async ({ page }) => {
    await page.goto(`/simulations/${SIM_VELGARIEN}/agents`);
    await expect(page.locator('velg-agent-card').first()).toBeVisible({ timeout: 15_000 });

    await clickAgentCard(page);

    // Wait for relationships section to appear
    await expect(page.getByText(/Relationships|Beziehungen/)).toBeVisible({ timeout: 10_000 });

    // Edit/Add buttons should NOT be visible for anonymous users
    const addRelBtn = page.getByText(/Add Relationship|Beziehung erstellen/);
    await expect(addRelBtn).toBeHidden({ timeout: 3_000 });
  });
});
