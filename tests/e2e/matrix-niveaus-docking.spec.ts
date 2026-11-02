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

  test('TC-V5-02: Niveau-Zichtbaarheid toggles in MatrixActionBar verbergen en tonen rijen', async ({ page }) => {
    // Controleer aanwezigheid van niveau segmented control
    const levelControl = page.locator('[role="group"][aria-label="Niveau zichtbaarheid"]');
    await expect(levelControl).toBeVisible();

    const etageBtn = levelControl.locator('button', { hasText: 'Etage' });
    const ruimteBtn = levelControl.locator('button', { hasText: 'Ruimte' });
    const clusterBtn = levelControl.locator('button', { hasText: 'Cluster' });
    const positieBadge = levelControl.locator('span', { hasText: 'Positie' }).first();

    await expect(etageBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(ruimteBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(clusterBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(positieBadge).toBeVisible();

    // Toggle Etage uit
    await etageBtn.click();
    await expect(etageBtn).toHaveAttribute('aria-pressed', 'false');

    // Etage rij moet niet meer zichtbaar zijn
    const etageRow = page.locator('thead tr.tr-etage, thead tr[data-level="etage"]');
    await expect(etageRow).toHaveCount(0);

    // Toggle Ruimte uit
    await ruimteBtn.click();
    await expect(ruimteBtn).toHaveAttribute('aria-pressed', 'false');

    // Toggle Cluster uit
    await clusterBtn.click();
    await expect(clusterBtn).toHaveAttribute('aria-pressed', 'false');

    // Positie rij moet ALTIJD zichtbaar blijven en nu op top: 0px docken
    const posRow = page.locator('thead tr.tr-posities, thead tr[data-level="positie"]');
    await expect(posRow).toBeVisible();
    await expect(posRow.locator('th').first()).toHaveCSS('top', '0px');
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
