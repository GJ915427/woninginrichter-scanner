import { test, expect } from '@playwright/test';
import { BENCHMARK_TYPOLOGIES } from '@/fixtures/benchmark-typologies';

test.describe('Visual Regression Test Suite', () => {
  test.use({
    viewport: { width: 1280, height: 800 },
  });

  for (const typology of BENCHMARK_TYPOLOGIES) {
    test.describe(`Visual Regression: ${typology.name} (${typology.id})`, () => {
      test(`floorplan viewer rendering stability for ${typology.id}`, async ({ page }) => {
        await page.goto('/');
        await page.locator(`[data-testid="typology-btn-${typology.id}"]`).click();

        const floorplanSvg = page.locator('svg[data-testid="floorplan-svg"]');
        await expect(floorplanSvg).toBeVisible();

        // Allow layout and font rendering to settle
        await page.waitForTimeout(300);

        // Visual snapshot comparison
        await expect(floorplanSvg).toHaveScreenshot(`${typology.id}-floorplan.png`, {
          maxDiffPixelRatio: 0.05,
          animations: 'disabled',
        });
      });

      test(`cross-section viewer rendering stability for ${typology.id}`, async ({ page }) => {
        await page.goto('/');
        await page.locator(`[data-testid="typology-btn-${typology.id}"]`).click();

        const crossSectionSvg = page.locator('svg[data-testid="cross-section-svg"]');
        await expect(crossSectionSvg).toBeVisible();

        // Allow layout and font rendering to settle
        await page.waitForTimeout(300);

        // Visual snapshot comparison
        await expect(crossSectionSvg).toHaveScreenshot(`${typology.id}-cross-section.png`, {
          maxDiffPixelRatio: 0.05,
          animations: 'disabled',
        });
      });
    });
  }
});
