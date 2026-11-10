// [VISUAL-MUTATION-AUTHORIZED: dual-screen live orderlist en statusindicatie conform INV-GOV-13]
import { test, expect } from '@playwright/test';

test.describe('Matrix Orders Production & Lab Parity Suite', () => {
  test.beforeEach(async ({ page }) => {
    // [VIEWPORT-RESIZE-AUTHORIZED: Desktop matrix layout parity test 1440x900 conform INV-UX-01]
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  // TC-PARITY-01: Both routes render matrix-table and metadata cleanly
  test('TC-PARITY-01: Both production and lab routes render core matrix components', async ({ page }) => {
    // 1. Check production route
    await page.goto('/matrix-orders');
    await page.waitForSelector('#matrix-viewport');
    await expect(page.locator('#matrix-table')).toBeVisible();
    await expect(page.locator('#order-meta-card')).toBeVisible();

    // 2. Check lab route
    await page.goto('/lab/matrix-orders');
    await page.waitForSelector('#matrix-viewport');
    await expect(page.locator('#matrix-table')).toBeVisible();
    await expect(page.locator('#meta-customer-name')).toBeVisible();
  });

  // TC-PARITY-02: Order navigation and popover orderpicker on lab route
  test('TC-PARITY-02: Lab orderpicker popover opens and switches selected order', async ({ page }) => {
    await page.goto('/lab/matrix-orders');
    await page.waitForSelector('#meta-customer-name');

    // Open popover
    await page.click('#meta-customer-name');
    const popover = page.locator('[role="listbox"][aria-label="Order selectielijst"]');
    await expect(popover).toBeVisible();

    // Verify order list buttons exist
    const orderButtons = popover.locator('button');
    const count = await orderButtons.count();
    expect(count).toBeGreaterThan(1);

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(popover).not.toBeVisible();
  });

  // TC-PARITY-03: Viewport freeze-pane behavior parity on lab route
  test('TC-PARITY-03: Column 0 freeze-pane stays pinned during horizontal scroll on lab route', async ({ page }) => {
    await page.goto('/lab/matrix-orders');
    await page.waitForSelector('#matrix-viewport');

    const col0 = page.locator('#matrix-table tbody tr:first-child th:first-child');
    await expect(col0).toBeVisible();
    const boxBefore = await col0.boundingBox();
    expect(boxBefore).not.toBeNull();

    // Scroll horizontally
    await page.evaluate(() => {
      const vp = document.getElementById('matrix-viewport');
      if (vp) vp.scrollLeft = 400;
    });
    await page.waitForTimeout(100);

    const boxAfter = await col0.boundingBox();
    expect(boxAfter).not.toBeNull();
    if (boxBefore && boxAfter) {
      expect(boxAfter.x).toBeCloseTo(boxBefore.x, 1);
    }
  });

  // TC-PARITY-04: Audit trail toggle interaction on lab route
  test('TC-PARITY-04: Clicking meta-order-number toggles between matrix view and audit trail', async ({ page }) => {
    await page.goto('/lab/matrix-orders');
    await page.waitForSelector('#meta-order-number');

    // Initially matrix is visible, audit section is hidden
    await expect(page.locator('#matrix-viewport')).toBeVisible();
    await expect(page.locator('#matrix-audit-trail-section')).toHaveClass(/hidden/);

    // Toggle to audit trail
    await page.click('#meta-order-number');
    await expect(page.locator('#matrix-viewport')).toHaveClass(/hidden/);
    await expect(page.locator('#matrix-audit-trail-section')).toBeVisible();

    // Toggle back to matrix
    await page.click('#meta-order-number');
    await expect(page.locator('#matrix-viewport')).toBeVisible();
    await expect(page.locator('#matrix-audit-trail-section')).toHaveClass(/hidden/);
  });
});
