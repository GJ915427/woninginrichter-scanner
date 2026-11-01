import { test, expect } from '@playwright/test';

test.describe('Matrix Orders Visual & Dimension Parity', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport to standard 1440x900 desktop
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  // TC-PAR-01: Visual & Layout Baseline Parity
  test('TC-PAR-01: Baseline parity between benchmark and Next.js page', async ({ page }) => {
    // Verify static benchmark HTML is served
    await page.goto('/matrix-v3-benchmark.html');
    await expect(page.locator('#matrix-table')).toBeVisible();

    // Verify Next.js App Router page is served
    await page.goto('/matrix-orders');
    await expect(page.locator('#matrix-table')).toBeVisible();
    await expect(page.locator('h1')).toContainText('V26001376');
  });

  // TC-PAR-02: Sticky Header Offsets (0px, 34px, 66px, 98px)
  test('TC-PAR-02: Computed sticky top offsets of the 4 header rows', async ({ page }) => {
    await page.goto('/matrix-orders');
    await page.waitForSelector('#matrix-table thead tr');

    const topOffsets = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#matrix-table thead tr'));
      return rows.map((r) => window.getComputedStyle(r).top);
    });

    expect(topOffsets.length).toBe(4);
    expect(topOffsets[0]).toBe('0px');
    expect(topOffsets[1]).toBe('34px');
    expect(topOffsets[2]).toBe('66px');
    expect(topOffsets[3]).toBe('98px');
  });

  // TC-PAR-03: Column Dimensions (Col 0 = 280px, Position Cols = 160px)
  test('TC-PAR-03: Column width constraints conform SSOT', async ({ page }) => {
    await page.goto('/matrix-orders');
    await page.waitForSelector('#matrix-table');

    const col0Width = await page.evaluate(() => {
      const firstCol = document.querySelector('#matrix-table thead tr:first-child th:first-child');
      return firstCol ? Math.round(firstCol.getBoundingClientRect().width) : 0;
    });

    expect(col0Width).toBe(280);

    const posColWidths = await page.evaluate(() => {
      const row4Cols = Array.from(document.querySelectorAll('#matrix-table thead tr:nth-child(4) th'));
      // Slice off Col 0 and Col 1 (Algemeen)
      return row4Cols.slice(2).map((col) => Math.round(col.getBoundingClientRect().width));
    });

    expect(posColWidths.length).toBeGreaterThan(0);
    for (const w of posColWidths) {
      expect(w).toBe(160);
    }
  });

  // TC-PAR-04: Stepper Interaction & Fitts' Law (Touch targets >= 44px)
  test('TC-PAR-04: Stepper overlay with Fitts Law >= 44px touch targets', async ({ page }) => {
    await page.goto('/matrix-orders');

    // Find the first interactive cell quantity button
    const firstQtyButton = page.locator('#matrix-table tbody tr:first-child td button[title="Klik om aantal te wijzigen"]').first();
    await expect(firstQtyButton).toBeVisible();

    // Click to open stepper
    await firstQtyButton.click();

    // Stepper buttons should appear
    const minusBtn = page.locator('button[aria-label="Verminder aantal met 1"]');
    const plusBtn = page.locator('button[aria-label="Verhoog aantal met 1"]');

    await expect(minusBtn).toBeVisible();
    await expect(plusBtn).toBeVisible();

    // Fitts' Law verification: Bounding boxes >= 44px x 44px
    const minusBox = await minusBtn.boundingBox();
    const plusBox = await plusBtn.boundingBox();

    expect(minusBox).not.toBeNull();
    expect(plusBox).not.toBeNull();

    if (minusBox && plusBox) {
      expect(minusBox.width).toBeGreaterThanOrEqual(44);
      expect(minusBox.height).toBeGreaterThanOrEqual(44);
      expect(plusBox.width).toBeGreaterThanOrEqual(44);
      expect(plusBox.height).toBeGreaterThanOrEqual(44);
    }

    // Dismiss on Escape
    await page.keyboard.press('Escape');
    await expect(minusBtn).not.toBeVisible();
  });

  // TC-PAR-05: FSM Process Buttons & Warning Badges
  test('TC-PAR-05: 8 FSM process buttons render with correct stages and warnings', async ({ page }) => {
    await page.goto('/matrix-orders');

    for (let step = 1; step <= 8; step++) {
      const btn = page.locator(`#fsm-step-${step}`);
      await expect(btn).toBeVisible();
    }

    // Step 5 should be active
    const step5 = page.locator('#fsm-step-5');
    await expect(step5).toHaveClass(/bg-blue-600/);

    // Steps 6, 7, 8 should have warning badges
    for (let step = 6; step <= 8; step++) {
      const warningBadge = page.locator(`#fsm-step-${step} span:has-text("⚠️")`);
      await expect(warningBadge).toBeVisible();
    }
  });

  // TC-PAR-06: Column Multi-Selection
  test('TC-PAR-06: Multi-selection of spatial position columns', async ({ page }) => {
    await page.goto('/matrix-orders');

    // Click 'Posities Selecteren' in action bar
    const selectModeBtn = page.locator('button:has-text("Posities Selecteren")');
    await selectModeBtn.click();

    // Row 4 position headers are now clickable
    const firstPosHeader = page.locator('#matrix-table thead tr:nth-child(4) th').nth(2);
    await firstPosHeader.click();

    // Should receive ring-2 highlight
    await expect(firstPosHeader).toHaveClass(/ring-2/);

    // Action bar button label updates to include count
    await expect(page.locator('button:has-text("Selectie (1)")')).toBeVisible();
  });

  // TC-PAR-07: Slide-Over Media Drawer & WAI-ARIA
  test('TC-PAR-07: Slide-over drawer with WAI-ARIA dialog attributes and Escape listener', async ({ page }) => {
    await page.goto('/matrix-orders');

    // Click '+ Foto' button
    const photoBtn = page.locator('button:has-text("+ Foto")');
    await photoBtn.click();

    // Drawer should open
    const drawer = page.locator('div[role="dialog"]');
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute('aria-modal', 'true');
    await expect(drawer).toHaveAttribute('aria-labelledby', 'media-drawer-title');

    // Close on Escape
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
  });

  // TC-PAR-08: Order Switching via Sidebar
  test('TC-PAR-08: Instant order switching updates matrix and header', async ({ page }) => {
    await page.goto('/matrix-orders');

    // Currently on Jaspers V26001376
    await expect(page.locator('h1')).toContainText('V26001376');

    // Click first order in sidebar (DrHaack V26001761) using explicit ID
    const drHaackItem = page.locator('#sidebar-order-V26001761');
    await drHaackItem.click();

    // Header updates to V26001761
    await expect(page.locator('h1')).toContainText('V26001761');
    await expect(page.locator('body')).toContainText('DrHaack holding b.v.');
  });
});
