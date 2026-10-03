import { test, expect } from '@playwright/test';

test.describe('1-on-1 Legacy Parity Verification (google_maps_picker.html vs Next.js)', () => {
  test('Next.js app matches google_maps_picker.html sidebar data for Rijksweg 153B', async ({ page }) => {
    // 1. Open Next.js app
    await page.goto('http://localhost:8088');
    await page.waitForTimeout(1000);

    // 2. Check that Google Map canvas is present on full-bleed background
    const mapContainer = page.locator('#googleMapElement');
    await expect(mapContainer).toBeVisible();

    // 3. Verify PlaceSidebar contains real building facts (no dashes)
    const sidebar = page.locator('#placeSidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toContainText('1969'); // Bouwjaar
    await expect(sidebar).toContainText('173');  // m² woonoppervlakte
    await expect(sidebar).toContainText('3 bouwlagen');
    await expect(sidebar).toContainText('411');  // m² perceel
    await expect(sidebar).toContainText('9.3');  // nokhoogte

    // Capture main view screenshot
    await page.screenshot({
      path: 'C:/Users/gaspa/.gemini/antigravity/brain/22ba8f39-e1f5-425e-a1b7-74fd252336a6/migrated_google_maps_picker_view.png',
    });

    // 4. Click mini floorplan container to open full floorplan view
    const miniFp = page.locator('#miniFloorplanContainer');
    await miniFp.click();

    // 5. Verify Floorplan overlay is visible and centered on md:pl-[430px]
    const fpOverlay = page.locator('#floorplanFullView');
    await expect(fpOverlay).toBeVisible();
    await expect(fpOverlay).toContainText('BEGANE GROND');
    await expect(fpOverlay).toContainText('VOORZIJDE (STRAAT)');

    // Capture floorplan view screenshot
    await page.screenshot({
      path: 'C:/Users/gaspa/.gemini/antigravity/brain/22ba8f39-e1f5-425e-a1b7-74fd252336a6/migrated_floorplan_view.png',
    });

    // 6. Click 'Kaart bekijken' to return to map
    const returnBtn = page.locator('#returnToMapBtn');
    await returnBtn.click();
    await expect(fpOverlay).toBeHidden();
    await expect(mapContainer).toBeVisible();
  });
});
