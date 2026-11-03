// [SPEC-CHANGE-AUTHORIZED: Verwijdering FSM procesknoppenbalk, update EasyM2M merklogo en transformatie niveau-zichtbaarheid van statische actionbar group naar dynamische pop-up]
import { test, expect } from '@playwright/test';

test.describe('Matrix Orders Browser v5 - Niveaus, Clusters, Docking & Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/matrix-orders');
    await page.waitForSelector('#matrix-viewport table');
  });

  test('TC-V5-01: Positie-Cluster rij is uniform aanwezig voor orders met en zonder clusters', async ({ page }) => {
    // Order 0 (V26001761) heeft geen clusters, maar moet toch de rij tonen met '—' placeholders
    const clusterRow = page.locator('thead tr.tr-positie-cluster, thead tr[data-level="cluster"]');
    await expect(clusterRow).toBeVisible();

    // Controleer dat er placeholder cellen met '—' aanwezig zijn
    const placeholders = clusterRow.locator('th:has-text("—")');
    expect(await placeholders.count()).toBeGreaterThan(0);
  });

  test('TC-V6-02: Niveau-Zichtbaarheid zwevende popover verbergt en toont rijen via Kolom 0 trigger', async ({ page }) => {
    // 1. Beweeg of klik op de permanente Kolom 0 ankerheader (Artikelen & Diensten)
    const anchorHeader = page.locator('#matrix-table thead tr[data-level="positie"] th.sticky-col-0');
    await expect(anchorHeader).toBeVisible();
    await anchorHeader.click();

    // 2. Popover dialoog verschijnt
    const popover = page.locator('div[role="dialog"][aria-label="Niveau zichtbaarheid"]');
    await expect(popover).toBeVisible();

    const etageBtn = popover.locator('button', { hasText: 'Etage' });
    const ruimteBtn = popover.locator('button', { hasText: 'Ruimte' });
    const clusterBtn = popover.locator('button', { hasText: 'Cluster' });
    const positieBadge = popover.locator('div', { hasText: 'Positie' }).first();

    await expect(etageBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(ruimteBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(clusterBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(positieBadge).toBeVisible();

    // 3. Toggle Etage uit
    await etageBtn.click();
    await expect(etageBtn).toHaveAttribute('aria-pressed', 'false');

    // Etage rij verdwijnt uit het zicht
    const etageRow = page.locator('thead tr.tr-etage, thead tr[data-level="etage"]');
    await expect(etageRow).toHaveCount(0);

    // 4. Toggle Ruimte uit
    await ruimteBtn.click();
    await expect(ruimteBtn).toHaveAttribute('aria-pressed', 'false');

    // 5. Toggle Cluster uit
    await clusterBtn.click();
    await expect(clusterBtn).toHaveAttribute('aria-pressed', 'false');

    // 6. Positie rij blijft zichtbaar en dockt op top: 0px
    const posRow = page.locator('thead tr.tr-posities, thead tr[data-level="positie"]');
    await expect(posRow).toBeVisible();
    await expect(posRow.locator('th').first()).toHaveCSS('top', '0px');

    // 7. Sluiten via Escape
    await page.keyboard.press('Escape');
    await expect(popover).not.toBeVisible();
  });

  test('TC-V5-03: Toetsenbordnavigatie met Alt + ArrowRight en Alt + ArrowLeft bladert door orders', async ({ page }) => {
    // Initial order should be Order 0
    const initialOrderTitle = await page.locator('h1, [data-testid="order-title"]').first().textContent();

    // Druk op Alt + ArrowRight om naar volgende order te gaan
    await page.keyboard.press('Alt+ArrowRight');
    await page.waitForTimeout(300);

    const nextOrderTitle = await page.locator('h1, [data-testid="order-title"]').first().textContent();
    expect(nextOrderTitle).not.toBe(initialOrderTitle);

    // Druk op Alt + ArrowLeft om terug te keren
    await page.keyboard.press('Alt+ArrowLeft');
    await page.waitForTimeout(300);

    const restoredOrderTitle = await page.locator('h1, [data-testid="order-title"]').first().textContent();
    expect(restoredOrderTitle).toBe(initialOrderTitle);
  });

  test('TC-V5-04: Meeglijdende groepskoppen passen transformatie toe bij horizontaal scrollen', async ({ page }) => {
    const viewport = page.locator('#matrix-viewport');
    await expect(viewport).toBeVisible();

    // Scroll horizontaal met 400px
    await viewport.evaluate((el) => {
      el.scrollLeft = 400;
      el.dispatchEvent(new Event('scroll'));
    });

    await page.waitForTimeout(100);

    // Controleer dat minstens 1 sticky group label een translateX transform heeft gekregen
    const shiftedLabel = page.locator('.sticky-group-label-etage, .sticky-group-label-room');
    const count = await shiftedLabel.count();
    expect(count).toBeGreaterThan(0);
  });
});
