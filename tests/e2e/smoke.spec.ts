import { test, expect } from '@playwright/test';

test.describe('Dashboard Smoke Test', () => {
  test('should load the dashboard and display title', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Woninginrichter Plattegrond- & Doorsnede-Engine');
  });
});
