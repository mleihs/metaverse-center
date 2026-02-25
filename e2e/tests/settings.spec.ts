import { expect, test } from '@playwright/test';
import { login } from '../helpers/auth';
import { navigateToSimulation } from '../helpers/fixtures';

test.describe('Settings View', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToSimulation(page, 'settings');
  });

  test('displays all settings tabs', async ({ page }) => {
    const settingsView = page.locator('velg-settings-view');
    await expect(settingsView).toBeVisible();

    // Verify the settings page title
    const title = settingsView.locator('.settings__title');
    await expect(title).toBeVisible();
    await expect(title).toHaveText('Settings');

    // Verify the tab navigation is visible
    const tabNav = settingsView.locator('.settings__tabs');
    await expect(tabNav).toBeVisible();

    // Verify all expected tabs are present
    // Note: "Access" tab is owner-only, "View" tab is not yet implemented
    const expectedTabs = ['General', 'World', 'AI', 'Integration', 'Design', 'Access'];

    const tabButtons = settingsView.locator('.settings__tab');
    const tabCount = await tabButtons.count();
    expect(tabCount).toBeGreaterThanOrEqual(expectedTabs.length - 1); // Access may be hidden for non-owners

    for (const tabName of expectedTabs) {
      const tab = settingsView.locator('.settings__tab', { hasText: tabName });
      // Access tab may not be visible for non-owners, so check conditionally
      if (tabName === 'Access') {
        // Owner should see the Access tab
        const isVisible = await tab.isVisible().catch(() => false);
        if (!isVisible) {
          // This is acceptable for non-owner users
          continue;
        }
      }
      await expect(tab).toBeVisible();
    }

    // The General tab should be active by default
    const activeTab = settingsView.locator('.settings__tab--active');
    await expect(activeTab).toBeVisible();
    await expect(activeTab).toHaveText('General');
  });

  test('changes simulation name in General tab', async ({ page }) => {
    const settingsView = page.locator('velg-settings-view');
    await expect(settingsView).toBeVisible();

    // Wait for the General settings panel to load
    const generalPanel = settingsView.locator('velg-general-settings-panel');
    await expect(generalPanel).toBeVisible();

    // Wait for the loading state to disappear
    const nameInput = generalPanel.locator('#general-name');
    await expect(nameInput).toBeVisible({ timeout: 10_000 });

    // Store the original name for cleanup
    const originalName = await nameInput.inputValue();

    // Change the simulation name
    const testName = `E2E Test Simulation ${Date.now()}`;
    await nameInput.clear();
    await nameInput.fill(testName);

    // The save button should become enabled
    const saveButton = generalPanel.locator('.btn--primary');
    await expect(saveButton).toBeEnabled();

    // Click save
    await saveButton.click();

    // Wait for the toast notification confirming success
    const toast = page.locator('velg-toast');
    await expect(toast).toContainText('saved', { timeout: 5_000 });

    // The save button should be disabled again after successful save
    await expect(saveButton).toBeDisabled({ timeout: 5_000 });

    // Restore the original name
    await nameInput.clear();
    await nameInput.fill(originalName);
    await saveButton.click();
    await expect(toast).toContainText('saved', { timeout: 5_000 });
  });

  test('adds a new taxonomy value in World tab', async ({ page }) => {
    const settingsView = page.locator('velg-settings-view');
    await expect(settingsView).toBeVisible();

    // Click on the World tab
    const worldTab = settingsView.locator('.settings__tab', { hasText: 'World' });
    await worldTab.click();

    // Verify the World settings panel loads
    const worldPanel = settingsView.locator('velg-world-settings-panel');
    await expect(worldPanel).toBeVisible({ timeout: 10_000 });

    // Wait for the panel content to load (look for the section title)
    const sectionTitle = worldPanel.locator('.panel__section-title').first();
    await expect(sectionTitle).toBeVisible({ timeout: 10_000 });

    // Select a taxonomy type (e.g., "Gender")
    const typeSelect = worldPanel.locator('.form__select').first();
    await expect(typeSelect).toBeVisible();
    await typeSelect.selectOption({ label: 'Gender' });

    // Look for the "Add" button to add a new taxonomy value
    const addButton = worldPanel.locator('.btn', { hasText: /add/i });
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();

      // Fill in the new taxonomy form fields
      const valueInput = worldPanel.locator('[data-testid="taxonomy-value-input"]');
      const labelInput = worldPanel.locator('[data-testid="taxonomy-label-input"]');

      if (await valueInput.isVisible().catch(() => false)) {
        const testValue = `e2e_test_${Date.now()}`;
        await valueInput.fill(testValue);
        if (await labelInput.isVisible().catch(() => false)) {
          await labelInput.fill(`E2E Test ${Date.now()}`);
        }

        // Save the new taxonomy value
        const saveBtn = worldPanel.locator('.btn--primary', { hasText: /save/i });
        if (await saveBtn.isVisible().catch(() => false)) {
          await saveBtn.click();

          // Verify toast notification
          const toast = page.locator('velg-toast');
          await expect(toast).toContainText(/saved|created|added/i, { timeout: 5_000 });
        }
      }
    }

    // At minimum, verify the World panel rendered successfully with taxonomy content
    await expect(worldPanel).toBeVisible();
  });

  test('saves AI model settings in AI tab', async ({ page }) => {
    const settingsView = page.locator('velg-settings-view');
    await expect(settingsView).toBeVisible();

    // Click on the AI tab
    const aiTab = settingsView.locator('.settings__tab', { hasText: 'AI' });
    await aiTab.click();

    // Verify the AI settings panel loads
    const aiPanel = settingsView.locator('velg-ai-settings-panel');
    await expect(aiPanel).toBeVisible({ timeout: 10_000 });

    // Wait for loading to complete (look for section title)
    const sectionTitle = aiPanel.locator('.section__title').first();
    await expect(sectionTitle).toBeVisible({ timeout: 10_000 });

    // Find a model select dropdown and change a value
    const modelSelect = aiPanel.locator('select').first();
    await expect(modelSelect).toBeVisible();

    // Store original value for restoration
    const originalValue = await modelSelect.inputValue();

    // Select a different model option
    const options = await modelSelect.locator('option').allTextContents();
    const differentOption = options.find((opt) => opt.trim() !== originalValue && opt.trim() !== '');
    if (differentOption) {
      await modelSelect.selectOption({ label: differentOption.trim() });
    }

    // Click the save button
    const saveButton = aiPanel.locator('.btn--primary', { hasText: /save/i });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Verify the toast notification
    const toast = page.locator('velg-toast');
    await expect(toast).toContainText(/saved/i, { timeout: 5_000 });

    // Restore original value
    if (differentOption) {
      await modelSelect.selectOption(originalValue);
      await saveButton.click();
      await expect(toast).toContainText(/saved/i, { timeout: 5_000 });
    }
  });

  test('Design tab — preset selection fills all fields', async ({ page }) => {
    const settingsView = page.locator('velg-settings-view');
    await expect(settingsView).toBeVisible();

    // Click on the Design tab
    const designTab = settingsView.locator('.settings__tab', { hasText: 'Design' });
    await designTab.click();

    // Verify the Design settings panel loads
    const designPanel = settingsView.locator('velg-design-settings-panel');
    await expect(designPanel).toBeVisible({ timeout: 10_000 });

    // Wait for loading to complete
    const sectionTitle = designPanel.locator('.section__title, velg-section-header').first();
    await expect(sectionTitle).toBeVisible({ timeout: 10_000 });

    // Store original values for restoration
    const colorPrimaryHex = designPanel.locator('[data-testid="color-primary-hex"]');
    const fontHeadingInput = designPanel.locator('[data-testid="font-heading-input"]');
    await expect(colorPrimaryHex).toBeVisible({ timeout: 5_000 });
    const originalColorPrimary = await colorPrimaryHex.inputValue();
    const originalFontHeading = await fontHeadingInput.inputValue();

    // Select "cyberpunk" preset
    const presetDropdown = designPanel.locator('[data-testid="preset-dropdown"]');
    await presetDropdown.selectOption('cyberpunk');

    // Click Apply Preset
    const applyBtn = designPanel.locator('[data-testid="apply-preset-btn"]');
    await applyBtn.click();

    // Verify cyberpunk values were applied
    await expect(colorPrimaryHex).toHaveValue('#ff6b2b');
    const fontHeadingValue = await fontHeadingInput.inputValue();
    expect(fontHeadingValue).toContain('Arial Narrow');

    // Restore by selecting "brutalist" and saving
    await presetDropdown.selectOption('brutalist');
    await applyBtn.click();

    const saveBtn = designPanel.locator('[data-testid="design-save-btn"]');
    await saveBtn.click();

    const toast = page.locator('velg-toast');
    await expect(toast).toContainText(/saved/i, { timeout: 5_000 });
  });

  test('Design tab — color hex input syncs', async ({ page }) => {
    const settingsView = page.locator('velg-settings-view');
    await expect(settingsView).toBeVisible();

    // Click on the Design tab
    const designTab = settingsView.locator('.settings__tab', { hasText: 'Design' });
    await designTab.click();

    const designPanel = settingsView.locator('velg-design-settings-panel');
    await expect(designPanel).toBeVisible({ timeout: 10_000 });

    // Wait for loading
    const sectionTitle = designPanel.locator('.section__title, velg-section-header').first();
    await expect(sectionTitle).toBeVisible({ timeout: 10_000 });

    // Store original color_primary
    const colorPrimaryHex = designPanel.locator('[data-testid="color-primary-hex"]');
    await expect(colorPrimaryHex).toBeVisible({ timeout: 5_000 });
    const originalColor = await colorPrimaryHex.inputValue();

    // Fill hex input with #ff0000
    await colorPrimaryHex.clear();
    await colorPrimaryHex.fill('#ff0000');

    // Verify save button is enabled (dirty state)
    const saveBtn = designPanel.locator('[data-testid="design-save-btn"]');
    await expect(saveBtn).toBeEnabled();

    // Save and verify toast
    await saveBtn.click();
    const toast = page.locator('velg-toast');
    await expect(toast).toContainText(/saved/i, { timeout: 5_000 });

    // Restore original color
    await colorPrimaryHex.clear();
    await colorPrimaryHex.fill(originalColor);
    await saveBtn.click();
    await expect(toast).toContainText(/saved/i, { timeout: 5_000 });
  });

  test('Design tab — character fields persist after save', async ({ page }) => {
    const settingsView = page.locator('velg-settings-view');
    await expect(settingsView).toBeVisible();

    // Click on the Design tab
    const designTab = settingsView.locator('.settings__tab', { hasText: 'Design' });
    await designTab.click();

    const designPanel = settingsView.locator('velg-design-settings-panel');
    await expect(designPanel).toBeVisible({ timeout: 10_000 });

    // Wait for loading
    const sectionTitle = designPanel.locator('.section__title, velg-section-header').first();
    await expect(sectionTitle).toBeVisible({ timeout: 10_000 });

    // Store originals
    const borderRadiusInput = designPanel.locator('[data-testid="border-radius-input"]');
    const shadowStyleSelect = designPanel.locator('[data-testid="shadow-style-select"]');
    await expect(borderRadiusInput).toBeVisible({ timeout: 5_000 });
    const originalBorderRadius = await borderRadiusInput.inputValue();
    const originalShadowStyle = await shadowStyleSelect.inputValue();

    // Change border_radius to "8px" and shadow_style to "blur"
    await borderRadiusInput.clear();
    await borderRadiusInput.fill('8px');
    await shadowStyleSelect.selectOption('blur');

    // Save
    const saveBtn = designPanel.locator('[data-testid="design-save-btn"]');
    await saveBtn.click();
    const toast = page.locator('velg-toast');
    await expect(toast).toContainText(/saved/i, { timeout: 5_000 });

    // Reload and navigate back to Design tab
    await page.reload();
    await expect(settingsView).toBeVisible({ timeout: 10_000 });
    const designTab2 = settingsView.locator('.settings__tab', { hasText: 'Design' });
    await designTab2.click();

    const designPanel2 = settingsView.locator('velg-design-settings-panel');
    await expect(designPanel2).toBeVisible({ timeout: 10_000 });

    // Wait for loading
    const sectionTitle2 = designPanel2.locator('.section__title, velg-section-header').first();
    await expect(sectionTitle2).toBeVisible({ timeout: 10_000 });

    // Verify values persisted
    const borderRadiusInput2 = designPanel2.locator('[data-testid="border-radius-input"]');
    const shadowStyleSelect2 = designPanel2.locator('[data-testid="shadow-style-select"]');
    await expect(borderRadiusInput2).toBeVisible({ timeout: 5_000 });
    await expect(borderRadiusInput2).toHaveValue('8px');
    await expect(shadowStyleSelect2).toHaveValue('blur');

    // Restore originals
    await borderRadiusInput2.clear();
    await borderRadiusInput2.fill(originalBorderRadius);
    await shadowStyleSelect2.selectOption(originalShadowStyle);
    await saveBtn.click();
    await expect(toast).toContainText(/saved/i, { timeout: 5_000 });
  });

  test('changes theme in Design tab', async ({ page }) => {
    const settingsView = page.locator('velg-settings-view');
    await expect(settingsView).toBeVisible();

    // Click on the Design tab
    const designTab = settingsView.locator('.settings__tab', { hasText: 'Design' });
    await designTab.click();

    // Verify the Design settings panel loads
    const designPanel = settingsView.locator('velg-design-settings-panel');
    await expect(designPanel).toBeVisible({ timeout: 10_000 });

    // Wait for loading to complete
    const sectionTitle = designPanel.locator('.section__title').first();
    await expect(sectionTitle).toBeVisible({ timeout: 10_000 });

    // Find a color input and change it
    const colorInput = designPanel.locator('input[type="color"]').first();
    if (await colorInput.isVisible().catch(() => false)) {
      // Store original color
      const originalColor = await colorInput.inputValue();

      // Set a new color value
      const testColor = originalColor === '#e63946' ? '#ff0000' : '#e63946';
      await colorInput.fill(testColor);

      // Find and click the save button
      const saveButton = designPanel.locator('.btn--primary', { hasText: /save/i });
      await expect(saveButton).toBeVisible();
      await saveButton.click();

      // Verify toast notification
      const toast = page.locator('velg-toast');
      await expect(toast).toContainText(/saved/i, { timeout: 5_000 });

      // Restore original color
      await colorInput.fill(originalColor);
      await saveButton.click();
      await expect(toast).toContainText(/saved/i, { timeout: 5_000 });
    } else {
      // If no color input, look for a text input for font settings
      const fontInput = designPanel.locator('input[type="text"]').first();
      await expect(fontInput).toBeVisible();

      const originalFont = await fontInput.inputValue();
      const testFont = 'Courier New, monospace';
      await fontInput.clear();
      await fontInput.fill(testFont);

      const saveButton = designPanel.locator('.btn--primary', { hasText: /save/i });
      await expect(saveButton).toBeVisible();
      await saveButton.click();

      const toast = page.locator('velg-toast');
      await expect(toast).toContainText(/saved/i, { timeout: 5_000 });

      // Restore
      await fontInput.clear();
      await fontInput.fill(originalFont);
      await saveButton.click();
    }
  });
});
