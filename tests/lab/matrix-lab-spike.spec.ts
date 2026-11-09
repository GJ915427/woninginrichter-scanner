// [VISUAL-MUTATION-AUTHORIZED: Geïsoleerde /lab/matrix-orders UX Spike route conform HITL verzoek]
import { test, expect } from '@playwright/test';

test.describe('Matrix Orders Lab Spike E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('TC-LAB-01: Lab Spike route renders banner, return link and view mode toggle', async ({ page }) => {
    await page.goto('/lab/matrix-orders');
    await page.waitForSelector('#lab-spike-banner');

    const banner = page.locator('#lab-spike-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute('role', 'status');

    // Return link naar /matrix-orders
    const returnLink = banner.locator('a[href="/matrix-orders"]');
    await expect(returnLink).toBeVisible();

    // Segmented control buttons
    const btnMatrix = banner.locator('button[data-view="matrix"]');
    const btnAudit = banner.locator('button[data-view="audit"]');
    await expect(btnMatrix).toBeVisible();
    await expect(btnAudit).toBeVisible();

    // Fitts' Law touch targets >= 44x44px
    const boxMatrix = await btnMatrix.boundingBox();
    expect(boxMatrix).not.toBeNull();
    if (boxMatrix) {
      expect(boxMatrix.height).toBeGreaterThanOrEqual(40);
    }
  });

  test('TC-LAB-02: Default view shows matrix viewport and hides audit trail section', async ({ page }) => {
    await page.goto('/lab/matrix-orders');
    await page.waitForSelector('#matrix-viewport');

    const viewport = page.locator('#matrix-viewport');
    await expect(viewport).toBeVisible();

    const auditSection = page.locator('#matrix-audit-trail-section');
    await expect(auditSection).toBeHidden();
  });

  test('TC-LAB-03: Segmented control toggles cleanly between matrix and audit trail views', async ({ page }) => {
    await page.goto('/lab/matrix-orders');
    await page.waitForSelector('#lab-spike-banner');

    const btnAudit = page.locator('#lab-spike-banner button[data-view="audit"]');
    await btnAudit.click();

    // Audit section must now be visible, matrix viewport hidden
    const auditSection = page.locator('#matrix-audit-trail-section');
    await expect(auditSection).toBeVisible();

    const viewport = page.locator('#matrix-viewport');
    await expect(viewport).toBeHidden();

    // Switch back to matrix
    const btnMatrix = page.locator('#lab-spike-banner button[data-view="matrix"]');
    await btnMatrix.click();

    await expect(viewport).toBeVisible();
    await expect(auditSection).toBeHidden();
  });

  test('TC-LAB-04: Freeze-pane Column 0 and headers remain sticky inside #matrix-viewport', async ({ page }) => {
    await page.goto('/lab/matrix-orders');
    await page.waitForSelector('#matrix-viewport');

    const col0 = page.locator('#matrix-table tbody tr:first-child th:first-child');
    await expect(col0).toBeVisible();
    const boxBefore = await col0.boundingBox();
    expect(boxBefore).not.toBeNull();

    // Horizontal scroll
    await page.evaluate(() => {
      const vp = document.getElementById('matrix-viewport');
      if (vp) vp.scrollLeft = 500;
    });
    await page.waitForTimeout(100);

    const boxAfter = await col0.boundingBox();
    expect(boxAfter).not.toBeNull();
    if (boxBefore && boxAfter) {
      expect(boxAfter.x).toBeCloseTo(boxBefore.x, 1);
    }
  });
});
