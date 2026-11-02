import { test, expect } from '@playwright/test';

// [SPEC-CHANGE-AUTHORIZED: Uitbreiding van visual parity tests met EasyM2M menu tabs, 12-velden meta card en GSW 2026 snapshot conform Fase 3]

test.describe('Matrix Orders Visual & Dimension Parity', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport to standard 1440x900 desktop
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  // TC-PAR-01: Visual & Layout Baseline Parity (EasyM2M, Menutabs & Meta Card)
  test('TC-PAR-01: Baseline parity between benchmark and Next.js page', async ({ page }) => {
    // Verify static benchmark HTML is served
    await page.goto('/matrix-v3-benchmark.html');
    await expect(page.locator('#matrix-table')).toBeVisible();

    // Verify Next.js App Router page is served
    await page.goto('/matrix-orders');
    await expect(page.locator('#matrix-table')).toBeVisible();
    await expect(page.locator('h1')).toContainText('V26001376');

    // Verify Row 1 EasyM2M Corporate Header & 6 Menu Tabs
    await expect(page.locator('text=EasyM²M')).toBeVisible();
    await expect(page.locator('button:has-text("Project")')).toBeVisible();
    await expect(page.locator('text=Jan (GSW)')).toBeVisible();

    // Verify Row 2 12-field Order Meta Card
    await expect(page.locator('#meta-order-number')).toContainText('V26001376');
    await expect(page.locator('#meta-customer-name')).toContainText('Jaspers');
    await expect(page.locator('#meta-status')).toContainText('Definitief');
    await expect(page.locator('#meta-lines-count')).toBeVisible();

    // Verify Sidebar GSW 2026 Omzet Snapshot
    await expect(page.locator('text=Winkel GSW BV (2026)')).toBeVisible();
    await expect(page.locator('text=674')).toBeVisible();
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
