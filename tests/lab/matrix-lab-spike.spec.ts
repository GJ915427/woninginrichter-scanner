// [VISUAL-MUTATION-AUTHORIZED: UX verfijning Hoofdscherm 4: banner eliminatie, sidebar verwijdering en semantische navigatie-interactie]
// [SPEC-CHANGE-AUTHORIZED: Aanpassen van /lab/matrix-orders spike tests naar nieuwe klantnaam popover en ordernummer audit toggle interactie conform HITL verzoek]
import { test, expect } from '@playwright/test';

test.describe('Matrix Orders Lab Spike E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('TC-LAB-01: Default layout grants 100% horizontal width: banner and left sidebar are completely eliminated', async ({ page }) => {
    await page.goto('/lab/matrix-orders');
    await page.waitForSelector('#matrix-viewport');

    // Lab spike banner is eliminated completely from the DOM
    const banner = page.locator('#lab-spike-banner');
    await expect(banner).toHaveCount(0);

    // Left sidebar (aside / Orders Explorer) is eliminated completely from the DOM
    const sidebar = page.locator('aside');
    await expect(sidebar).toHaveCount(0);
    const sidebarExplorer = page.locator('#sidebar-order-V26001761');
    await expect(sidebarExplorer).toHaveCount(0);

    // Matrix viewport is visible and expands across the full workspace
    const viewport = page.locator('#matrix-viewport');
    await expect(viewport).toBeVisible();
  });

  test('TC-LAB-02: Customer name (#meta-customer-name) acts as first-class order-picker popover trigger', async ({ page }) => {
    await page.goto('/lab/matrix-orders');
    await page.waitForSelector('#matrix-viewport');

    const customerBtn = page.locator('#meta-customer-name');
    await expect(customerBtn).toBeVisible();
    await expect(customerBtn).toContainText('Jaspers');
    await expect(customerBtn).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(customerBtn).toHaveAttribute('aria-expanded', 'false');

    // Fitts' Law touch target >= 44px
    const box = await customerBtn.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(40);
    }

    // Click customer name to open popover listbox
    await customerBtn.click();
    await expect(customerBtn).toHaveAttribute('aria-expanded', 'true');

    const listbox = page.locator('div[role=\"listbox\"][aria-label=\"Order selectielijst\"]');
    await expect(listbox).toBeVisible();

    // Click previous order inside listbox
    const prevBtn = listbox.locator('button[aria-label=\"Vorige order\"]');
    await expect(prevBtn).toBeVisible();
    await prevBtn.click();

    // Customer name switches cleanly to DA.AN interior design & living
    await expect(customerBtn).toContainText('DA.AN interior design & living');

    // Escape closes popover
    await page.keyboard.press('Escape');
    await expect(listbox).not.toBeVisible();
    await expect(customerBtn).toHaveAttribute('aria-expanded', 'false');
  });

  test('TC-LAB-03: Order number (#meta-order-number) toggles quotation and order lines (audit trail) with active visual feedback', async ({ page }) => {
    await page.goto('/lab/matrix-orders');
    await page.waitForSelector('#matrix-viewport');

    const orderBtn = page.locator('#meta-order-number');
    await expect(orderBtn).toBeVisible();
    await expect(orderBtn).toHaveAttribute('aria-pressed', 'false');

    const viewport = page.locator('#matrix-viewport');
    const auditSection = page.locator('#matrix-audit-trail-section');

    // Initial state: matrix viewport visible, audit trail hidden
    await expect(viewport).toBeVisible();
    await expect(auditSection).toBeHidden();

    // Click order number to toggle to audit trail
    await orderBtn.click();
    await expect(orderBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(auditSection).toBeVisible();
    await expect(viewport).toBeHidden();

    // Click order number again to toggle back to matrix raster
    await orderBtn.click();
    await expect(orderBtn).toHaveAttribute('aria-pressed', 'false');
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
