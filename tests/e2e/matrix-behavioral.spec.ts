// [SPEC-CHANGE-AUTHORIZED: Sanering van legacy HTML migratiesteiger en transitie naar enterprise behavioral testsuite conform Stitch Optie 1 macro-canvas, permanente compacte meta-strip, directe kolomselectie en off-canvas explorer]
// [SPEC-CHANGE-AUTHORIZED: Actualisatie van TC-PAR-08 van sidebar explorer naar Hoofdscherm 4 klantnaam popover orderpicker conform HITL scope]
import { test, expect } from '@playwright/test';

test.describe('Matrix Orders Enterprise Behavioral Suite', () => {
  test.beforeEach(async ({ page }) => {
    // [VIEWPORT-RESIZE-AUTHORIZED: Desktop baseline 1440x900 conform Stitch Optie 1 macro-canvas]
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  // TC-STICKY-01: Freeze-pane Horizontal Scroll (Kolom 0 Invariance)
  test('TC-STICKY-01: Freeze-pane Column 0 remains fixed at left during horizontal scroll', async ({ page }) => {
    await page.goto('/matrix-orders');
    await page.waitForSelector('#matrix-viewport');

    const col0 = page.locator('#matrix-table tbody tr:first-child th:first-child');
    await expect(col0).toBeVisible();
    const boxBefore = await col0.boundingBox();
    expect(boxBefore).not.toBeNull();

    // Scroll horizontally by 600px inside #matrix-viewport
    await page.evaluate(() => {
      const vp = document.getElementById('matrix-viewport');
      if (vp) vp.scrollLeft = 600;
    });
    await page.waitForTimeout(100);

    const boxAfter = await col0.boundingBox();
    expect(boxAfter).not.toBeNull();
    if (boxBefore && boxAfter) {
      expect(boxAfter.x).toBeCloseTo(boxBefore.x, 1);
    }
  });

  // TC-STICKY-02: Freeze-pane Vertical Scroll (Thead Invariance)
  test('TC-STICKY-02: Freeze-pane Header rows remain fixed at top during vertical scroll', async ({ page }) => {
    await page.goto('/matrix-orders');
    await page.waitForSelector('#matrix-viewport');

    const row1 = page.locator('#matrix-table thead tr:first-child');
    const boxBefore = await row1.boundingBox();
    expect(boxBefore).not.toBeNull();

    // Scroll vertically by 300px inside #matrix-viewport
    await page.evaluate(() => {
      const vp = document.getElementById('matrix-viewport');
      if (vp) vp.scrollTop = 300;
    });
    await page.waitForTimeout(100);

    const boxAfter = await row1.boundingBox();
    expect(boxAfter).not.toBeNull();
    if (boxBefore && boxAfter) {
      expect(boxAfter.y).toBeCloseTo(boxBefore.y, 1);
    }
  });

  // TC-SLIDE-01: Permanent Compact Executive Order Strip (Stitch Option 1 Macro-Canvas)
  test('TC-SLIDE-01: Permanent compact executive order strip remains visible with expansive macro-canvas viewport', async ({ page }) => {
    await page.goto('/matrix-orders');
    await page.waitForSelector('#matrix-viewport');

    const vp = page.locator('#matrix-viewport');
    const vpBox = await vp.boundingBox();
    expect(vpBox).not.toBeNull();
    if (vpBox) {
      // Macro-canvas viewport takes substantial vertical space
      expect(vpBox.height).toBeGreaterThanOrEqual(340);
    }

    // Permanent executive order meta card is visible
    await expect(page.locator('#order-meta-card #meta-order-number')).toBeVisible();
    await expect(page.locator('#order-meta-card #meta-customer-name')).toBeVisible();
    await expect(page.locator('#order-meta-card #meta-status')).toBeVisible();
    await expect(page.locator('#order-meta-card #meta-total-amount')).toBeVisible();

    // Collapse toggle button is cleanly sanitized
    await expect(page.locator('#btn-toggle-header-collapse')).toHaveCount(0);
  });

  // TC-PAR-04: Cel-Click Bewerking & Fitts' Law (Touch targets >= 48px conform Gebruikersitem 8)
  test('TC-PAR-04: Cel-click bewerkingsdrawer met Fitts Law >= 48px touch targets', async ({ page }) => {
    await page.goto('/matrix-orders');

    // Zoek de eerste interactieve cel (td)
    const firstCell = page.locator('#matrix-table tbody tr:first-child td').first();
    await expect(firstCell).toBeVisible();

    // Fitts' Law verificatie: Cel afmetingen >= 160px breed en >= 48px hoog
    const cellBox = await firstCell.boundingBox();
    expect(cellBox).not.toBeNull();
    if (cellBox) {
      expect(cellBox.width).toBeGreaterThanOrEqual(160);
      expect(cellBox.height).toBeGreaterThanOrEqual(48);
    }

    // Klik op de cel opent de Product Edit Drawer
    await firstCell.click();

    const drawer = page.locator('div[role="dialog"][aria-labelledby="product-edit-title"]');
    await expect(drawer).toBeVisible();

    // Verifieer formulierelementen (maten, aantal, CPQ realtime calculatie)
    await expect(drawer.locator('input[type="number"]').first()).toBeVisible();
    await expect(drawer.locator('button:has-text("Opslaan & Toepassen")')).toBeVisible();

    // Sluiten via Escape
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
  });

  // TC-PAR-05: FSM Process Buttons Removed from ActionBar & Present via Workflow Stage Tag
  test('TC-PAR-05: 8 FSM process buttons removed from actionbar with active stage tag in ActionBar and 6 TopNav tabs', async ({ page }) => {
    await page.goto('/matrix-orders');

    // Verify FSM buttons #fsm-step-1 to #fsm-step-8 are no longer rendered in actionbar
    for (let step = 1; step <= 8; step++) {
      await expect(page.locator(`#fsm-step-${step}`)).toHaveCount(0);
    }

    // TopNav contains 6 capsule tabs conform Stitch Optie 1
    const topNav = page.locator('nav[aria-label="Hoofdnavigatie"]');
    await expect(topNav).toBeVisible();
    await expect(topNav.locator('button:has-text("Project")')).toBeVisible();

    // ActionBar displays active workflow stage tag
    const stageTag = page.locator('#workflowStageTag');
    await expect(stageTag).toBeVisible();
    await expect(stageTag).toContainText('Bestellen');
  });

  // TC-PAR-06: Direct Column Multi-Selection
  test('TC-PAR-06: Direct multi-selection of spatial position columns', async ({ page }) => {
    await page.goto('/matrix-orders');
    await page.waitForSelector('#matrix-table thead tr:nth-child(4) th');

    // Row 4 position headers are directly clickable without toggle button
    const firstPosHeader = page.locator('#matrix-table thead tr:nth-child(4) th').nth(2);
    await firstPosHeader.click();

    // Should receive ring-2 highlight
    await expect(firstPosHeader).toHaveClass(/ring-2/);

    // Floating bar appears with selected count
    const floatingBar = page.locator('aside[aria-label="Cluster selectie actiebalk"]');
    await expect(floatingBar).toBeVisible();
    await expect(floatingBar).toContainText('1 kolom geselecteerd');
  });

  // TC-PAR-07: Slide-Over Media Drawer & WAI-ARIA
  test('TC-PAR-07: Slide-over drawer with WAI-ARIA dialog attributes and Escape listener', async ({ page }) => {
    await page.goto('/matrix-orders');

    // Click 'Bijlagen' button in executive order strip
    const mediaBtn = page.locator('#btn-meta-media-drawer');
    await expect(mediaBtn).toBeVisible();
    await mediaBtn.click();

    // Drawer should open
    const drawer = page.locator('div[role="dialog"]');
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute('aria-modal', 'true');

    // Close on Escape
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
  });

  // TC-PAR-08: Order Switching via Klantnaam Popover Orderpicker
  test('TC-PAR-08: Instant order switching via customer popover updates matrix and header', async ({ page }) => {
    await page.goto('/matrix-orders');

    // Currently on Jaspers V26001376
    await expect(page.locator('#meta-order-number')).toContainText('V26001376');
    await expect(page.locator('#meta-customer-name')).toContainText('Jaspers');

    // Open Orderpicker popover via customer name trigger
    const customerBtn = page.locator('#meta-customer-name');
    await customerBtn.click();

    const listbox = page.locator('div[role="listbox"][aria-label="Order selectielijst"]');
    await expect(listbox).toBeVisible();

    // Select DrHaack V26001761 from popover list
    const drHaackItem = listbox.locator('button:has-text("V26001761")');
    await expect(drHaackItem).toBeVisible();
    await drHaackItem.click();

    // Popover closes and header updates to V26001761
    await expect(listbox).not.toBeVisible();
    await expect(page.locator('#meta-order-number')).toContainText('V26001761');
    await expect(page.locator('#meta-customer-name')).toContainText('DrHaack');
  });

  // TC-PAR-09: Alt+Arrow Keyboard Navigation & Popover Auto-Close
  test('TC-PAR-09: Alt+Arrow keyboard navigation updates order and closes order popover', async ({ page }) => {
    await page.goto('/matrix-orders');
    await page.waitForSelector('#matrix-viewport');

    // Default order is Jaspers (V26001376)
    await expect(page.locator('#meta-order-number')).toContainText('V26001376');

    // Open popover by clicking #meta-customer-name
    await page.locator('#meta-customer-name').click();
    const popover = page.locator('div[role="listbox"][aria-label="Order selectielijst"]');
    await expect(popover).toBeVisible();

    // Navigate to next order with Alt+ArrowRight
    await page.keyboard.press('Alt+ArrowRight');

    // Popover must auto-close upon order change
    await expect(popover).not.toBeVisible();

    // Order number should now update to next order (V26001584)
    await expect(page.locator('#meta-order-number')).toContainText('V26001584');
  });

  // TC-PAR-10: Form Input Suppression of Alt+Arrow Navigation
  test('TC-PAR-10: Form inputs suppress Alt+Arrow keyboard navigation', async ({ page }) => {
    await page.goto('/matrix-orders');
    await page.waitForSelector('#matrix-viewport');

    // Open cell edit drawer by clicking first cell
    const firstCell = page.locator('#matrix-table tbody tr:first-child td').first();
    await firstCell.click();

    const drawer = page.locator('div[role="dialog"][aria-labelledby="product-edit-title"]');
    await expect(drawer).toBeVisible();

    // Focus input inside drawer
    const numberInput = drawer.locator('input[type="number"]').first();
    await numberInput.focus();

    // Press Alt+ArrowRight
    await page.keyboard.press('Alt+ArrowRight');

    // Order must remain unchanged (V26001376)
    await expect(page.locator('#meta-order-number')).toContainText('V26001376');

    // Escape closes drawer even when input is focused
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
  });
});
