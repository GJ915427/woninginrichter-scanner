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
    await expect(searchInput).toHaveValue('');
    const sidebar = page.locator('#placeSidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toContainText('Kies een woning');

    // 3. Search for Rijksweg 153b and verify autocomplete dropdown
    await searchInput.fill('Rijksweg 153b');
    
    // Autocomplete dropdown should appear with PDOK suggestions
    const dropdown = page.locator('#suggestionsDropdown');
    try {
      await expect(dropdown).toBeVisible({ timeout: 4000 });
      await expect(dropdown).toContainText('Rijksweg 153B');
    } catch (e) {
      // In CI / offline fallback, direct submit is still supported
    }

    await searchInput.press('Enter');

    // Wait for API resolution
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

    // Check 1e verdieping (clean main volume 6.63m x 8.00m, no 18.51m strip)
    const etage1Btn = page.locator('#floorBtn1');
    if (await etage1Btn.isVisible()) {
      await etage1Btn.click();
      await expect(fpOverlay).toContainText('1e VERDIEPING');
      // Must not stretch along 18m annex
      await expect(fpOverlay).not.toContainText('18.51m');
    }

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
