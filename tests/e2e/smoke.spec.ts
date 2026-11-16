import { test, expect } from '@playwright/test';

test.describe('Dashboard Smoke Test', () => {
  test('should load the dashboard and display title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Woninginrichter/);
    const sidebar = page.locator('#placeSidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toContainText('Kies een woning');
  });
});
