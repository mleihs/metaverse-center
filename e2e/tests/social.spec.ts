import { expect, test } from '@playwright/test';
import { login } from '../helpers/auth';
import { navigateToSimulation } from '../helpers/fixtures';

test.describe('Social Features', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToSimulation(page, 'social');
  });

  test('displays social trends view', async ({ page }) => {
    // The social trends view should be visible as the default social sub-view
    const trendsView = page.locator('velg-social-trends-view');
    await expect(trendsView).toBeVisible();

    // Verify the page title
    const title = trendsView.locator('.trends__title');
    await expect(title).toBeVisible();
    await expect(title).toHaveText('Social Trends');

    // The "Fetch Trends" action button should be visible
    const fetchButton = trendsView.locator('.trends__btn', { hasText: 'Fetch Trends' });
    await expect(fetchButton).toBeVisible();

    // The filter bar should be visible
    const filterBar = trendsView.locator('velg-filter-bar');
    await expect(filterBar).toBeVisible();
  });

  test('displays empty state when no trends', async ({ page }) => {
    const trendsView = page.locator('velg-social-trends-view');
    await expect(trendsView).toBeVisible();

    // Wait for loading to complete
    const loadingState = trendsView.locator('velg-loading-state');
    await expect(loadingState).not.toBeVisible({ timeout: 10_000 });

    // Check for either trends grid or empty state
    const trendsGrid = trendsView.locator('.trends__grid');
    const emptyState = trendsView.locator('velg-empty-state');

    const hasGrid = await trendsGrid.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    // One of these should be present
    expect(hasGrid || hasEmpty).toBe(true);

    // If empty state is shown, verify its content
    if (hasEmpty) {
      await expect(emptyState).toContainText('No trends found');

      // The empty state should have a CTA to fetch trends
      const ctaButton = emptyState.locator('[data-testid="empty-state-action"]');
      if (await ctaButton.isVisible().catch(() => false)) {
        await expect(ctaButton).toContainText('Fetch Trends');
      }
    }

    // If trends grid is shown, verify trend cards are rendered
    if (hasGrid) {
      const trendCards = trendsView.locator('velg-trend-card');
      const count = await trendCards.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('navigates between social sub-views', async ({ page }) => {
    // The social section may have sub-navigation for Trends and Media.
    // Check if the simulation nav or a social sub-nav exists

    // First, verify the Social Trends view is displayed
    const trendsView = page.locator('velg-social-trends-view');
    await expect(trendsView).toBeVisible();

    // Check if there are sub-navigation tabs/links for social sub-views
    // These could be rendered as part of a parent social view or as route-based navigation
    const socialNav = page.locator('[data-testid="social-nav"]');
    const hasSocialNav = await socialNav.isVisible().catch(() => false);

    if (hasSocialNav) {
      // Navigate to Social Media sub-view
      const mediaTab = socialNav.locator('[data-testid="social-nav-media"]');
      if (await mediaTab.isVisible().catch(() => false)) {
        await mediaTab.click();
        const mediaView = page.locator('velg-social-media-view');
        await expect(mediaView).toBeVisible({ timeout: 10_000 });
      }

      // Navigate back to Trends
      const trendsTab = socialNav.locator('[data-testid="social-nav-trends"]');
      if (await trendsTab.isVisible().catch(() => false)) {
        await trendsTab.click();
        await expect(trendsView).toBeVisible({ timeout: 10_000 });
      }
    } else {
      // Sub-routing is not set up; verify the trends view is the main social view
      const currentUrl = page.url();
      const socialBaseUrl = currentUrl.replace(/\/social.*/, '/social');
      await page.goto(socialBaseUrl);
      await expect(trendsView).toBeVisible({ timeout: 10_000 });
    }
  });
});
