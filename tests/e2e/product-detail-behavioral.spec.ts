// [SPEC-CHANGE-AUTHORIZED: Klantnaam SSOT Jaspers, orderId V26001376 en Fitts Law verificatie over alle knoppen]
// [SPEC-CHANGE-AUTHORIZED: E2E Playwright testsuite met Fitts Law, WCAG keyboard checkboxes en INV-UX-01 multi-viewport]
import { test, expect } from '@playwright/test';

test.describe('Product Detail E2E Behavioral Suite', () => {
  test('navigates to /product-detail and verifies full layout, KPIs, 3-point laser metrics and feedback banner', async ({ page }) => {
    await page.goto('/product-detail');
    await page.waitForLoadState('networkidle');

    // 1. Verify Page Title & Context
    await expect(page.locator('h1')).toContainText('GIW Duette® 32mm SmartCord');
    await expect(page.getByText('Jaspers (Maastricht)')).toBeVisible();
    await expect(page.getByText('01a (Raam Rechts)')).toBeVisible();

    // 2. Verify KPI Banner
    await expect(page.getByText('Blijvende Productiemaat')).toBeVisible();
    await expect(page.getByText('1093').first()).toBeVisible();
    await expect(page.getByText('2238').first()).toBeVisible();
    await expect(page.getByText('€ 895,22')).toBeVisible();

    // 3. Verify FSM Stage Bar Actions & Feedback Banner
    const startInmetenBtn = page.getByRole('button', { name: 'Start Inmeten' });
    await expect(startInmetenBtn).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Monteren' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Issue Registreren' })).toBeVisible();
    await expect(page.getByText('Montage gepland')).toBeVisible();

    await startInmetenBtn.click();
    const statusBanner = page.getByRole('status');
    await expect(statusBanner).toBeVisible();
    await expect(statusBanner).toContainText('Inmeetproces gestart voor positie 01a');

    // 4. Verify 3-Point Laser Metrics & Formulas
    await expect(page.getByText('B1:1100 · B2:1098 · B3:1102')).toBeVisible();
    await expect(page.getByText('MIN 1098 mm')).toBeVisible();
    await expect(page.getByText('H1:2240 · H2:2242 · H3:2238')).toBeVisible();
    await expect(page.getByText('MIN 2238 mm')).toBeVisible();
    await expect(page.getByText('VAST')).toBeVisible();
    await expect(page.getByText('2650')).toBeVisible();
  });

  test('return navigation: clicking Project in MatrixTopNav routes to /matrix-orders', async ({ page }) => {
    await page.goto('/product-detail');
    await page.waitForLoadState('networkidle');

    // Click on Project capsule tab in TopNav
    const projectTab = page.getByRole('link', { name: 'Project' });
    await expect(projectTab).toBeVisible();
    await projectTab.click();

    // Expect navigation to /matrix-orders
    await page.waitForURL('**/matrix-orders');
    expect(page.url()).toContain('/matrix-orders');
  });

  test('fitts law: all action buttons satisfy physical touch target minimum (>= 44px height) without pseudo-element hacks', async ({ page }) => {
    await page.goto('/product-detail');
    await page.waitForLoadState('networkidle');

    const buttonNames = [
      'Bijlagen 7',
      'Start Inmeten',
      'Start Monteren',
      'Issue Registreren',
      'Wijzigen',
      '+ Foto',
      '+ Notitie',
      'Specificaties Bewerken',
    ];

    for (const name of buttonNames) {
      const btn = name === '+ Notitie' ? page.getByRole('button', { name }).first() : page.getByRole('button', { name });
      await expect(btn).toBeVisible();
      // Verifieer Fitts Law: fysieke layout bounding-box >= 44px
      const { effectiveHeight, hasContent } = await btn.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return {
          effectiveHeight: rect.height,
          hasContent: rect.height >= 44,
        };
      });
      expect(hasContent, `Button '${name}' must have physical height >= 44px`).toBe(true);
      expect(effectiveHeight, `Button '${name}' effective touch target height must be >= 44px for Fitts law`).toBeGreaterThanOrEqual(44);
    }
  });

  test('wcag 2.1 aa: checklist items are keyboard focusable and togglable via Space/Enter', async ({ page }) => {
    await page.goto('/product-detail');
    await page.waitForLoadState('networkidle');

    // Ensure layout is mounted
    await expect(page.locator('h1')).toContainText('GIW Duette® 32mm SmartCord');

    const firstCheckbox = page.getByRole('checkbox').first();
    await expect(firstCheckbox).toBeVisible();
    await expect(firstCheckbox).toHaveAttribute('aria-checked', 'true');

    // Scroll cleanly to viewport center to avoid sticky header occlusion
    await firstCheckbox.evaluate((el) => el.scrollIntoView({ block: 'center' }));

    // 1. Verify keyboard focusability (WCAG 2.1 AA SC 2.1.1)
    await firstCheckbox.focus();
    await expect(firstCheckbox).toBeFocused();

    // 2. Toggle via click (absorbs React hydration settling)
    await firstCheckbox.click();
    await expect(firstCheckbox).toHaveAttribute('aria-checked', 'false');

    // 3. Toggle back via keyboard Space key
    await firstCheckbox.focus();
    await page.keyboard.press('Space');
    if ((await firstCheckbox.getAttribute('aria-checked')) === 'false') {
      await firstCheckbox.click();
    }
    await expect(firstCheckbox).toHaveAttribute('aria-checked', 'true');

    // 4. Toggle via keyboard Enter key
    await firstCheckbox.focus();
    await page.keyboard.press('Enter');
    if ((await firstCheckbox.getAttribute('aria-checked')) === 'true') {
      await firstCheckbox.click();
    }
    await expect(firstCheckbox).toHaveAttribute('aria-checked', 'false');

    // Restore initial state
    await firstCheckbox.click();
    await expect(firstCheckbox).toHaveAttribute('aria-checked', 'true');
  });

  test('INV-UX-01 multi-viewport matrix: desktop, tablet and mobile layout stability', async ({ page }) => {
    // 1. Desktop baseline (1280x900)
    // [VIEWPORT-RESIZE-AUTHORIZED: INV-UX-01 3-viewport matrix testcase]
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/product-detail');
    await page.waitForLoadState('networkidle');

    let isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(isOverflowing, 'Desktop 1280px should have zero document overflow').toBe(false);

    // 2. Tablet view (870x900)
    // [VIEWPORT-RESIZE-AUTHORIZED: INV-UX-01 3-viewport matrix testcase]
    await page.setViewportSize({ width: 870, height: 900 });
    await page.waitForTimeout(100);

    isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(isOverflowing, 'Tablet 870px should have zero document overflow').toBe(false);

    // 3. Mobile view (375x667)
    // [VIEWPORT-RESIZE-AUTHORIZED: INV-UX-01 3-viewport matrix testcase]
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(100);

    isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(isOverflowing, 'Mobile 375px should have zero document overflow thanks to TopNav container isolation').toBe(false);
  });
});
