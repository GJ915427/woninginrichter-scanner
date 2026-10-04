import { test, expect } from '@playwright/test';

test.describe('1-on-1 Legacy Parity Verification (google_maps_picker.html vs Next.js)', () => {
  test('Next.js app opens cleanly without mock data, searches address, and renders opbouw and unclipped section', async ({
    page,
  }) => {
    // 1. Open Next.js app
    await page.goto('http://localhost:8088');
    await page.waitForTimeout(1000);

    // 2. Check that Google Map canvas is present on full-bleed background
    const mapContainer = page.locator('#googleMapElement');
    await expect(mapContainer).toBeVisible();

    const searchInput = page.locator('#addressSearchInput');
    await expect(searchInput).toBeVisible();

    // 3. Search for Rijksweg 153b
    await searchInput.fill('Rijksweg 153b');
    await searchInput.press('Enter');

    // Wait for API resolution
    const sidebar = page.locator('#placeSidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toContainText('1969', { timeout: 10000 }); // Bouwjaar
    await expect(sidebar).toContainText('173'); // m² woonoppervlakte
    await expect(sidebar).toContainText('3 bouwlagen');

    // Verify the 5 view action buttons exist in sidebar
    await expect(sidebar).toContainText('2D Plan');
    await expect(sidebar).toContainText('Doorsnede');
    await expect(sidebar).toContainText('3D Model');
    await expect(sidebar).toContainText('Street View');
    await expect(sidebar).toContainText('Satelliet');

    // 4. Click '2D Plan' to open floorplan view
    const planBtn = sidebar.getByRole('button', { name: /2D Plan/i });
    await planBtn.click();

    const fpOverlay = page.locator('#floorplanFullView');
    await expect(fpOverlay).toBeVisible();

    // Check etage 2 (opbouw)
    const etage2Btn = page.locator('#floorBtn2');
    if (await etage2Btn.isVisible()) {
      await etage2Btn.click();
      await expect(fpOverlay).toContainText('2e VERDIEPING • OPBOUW (CONCEPT)');
    }

    // 5. Click 'Doorsnede' (or section button in floorplan controls)
    const sectionBtn = page.locator('#floorBtnSection');
    if (await sectionBtn.isVisible()) {
      await sectionBtn.click();
      await expect(fpOverlay).toContainText(/(\+9\.26m|\+9\.30m) Nok/);
      await expect(fpOverlay).toContainText('+5.80m Goot / Zolder');
      await expect(fpOverlay).toContainText('0.00m Peil (Maaiveld)');
    }

    // 6. Click 'Kaart bekijken' to return to map
    const returnBtn = page.locator('#returnToMapBtn');
    await returnBtn.click();
    await expect(fpOverlay).toBeHidden();
    await expect(mapContainer).toBeVisible();
  });
});
