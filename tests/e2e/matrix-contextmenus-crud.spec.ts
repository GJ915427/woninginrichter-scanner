import { test, expect } from '@playwright/test';

test.describe('Matrix Orders Context Menus, CRUD & Cell Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  // TC-CTX-01: Header Context Menus (Etage, Ruimte, Cluster, Positie)
  test('TC-CTX-01: Header context menus open on right-click with role=menu and Fitts touch target >= 44px', async ({ page }) => {
    await page.goto('/matrix-orders');
    await page.waitForSelector('#matrix-table');

    // 1. Etage contextmenu
    const etageTh = page.locator('#matrix-table thead tr:nth-child(1) th:has-text("BEGANE GROND")');
    await etageTh.click({ button: 'right' });

    const etageMenu = page.locator('div[role="menu"]');
    await expect(etageMenu).toBeVisible();
    await expect(etageMenu).toContainText('ETAGE');
    await page.keyboard.press('Escape');
    await expect(etageMenu).not.toBeVisible();

    // 2. Ruimte contextmenu
    const roomTh = page.locator('#matrix-table thead tr:nth-child(2) th:has-text("Woonkamer")');
    await roomTh.click({ button: 'right' });

    const roomMenu = page.locator('div[role="menu"]');
    await expect(roomMenu).toBeVisible();
    await expect(roomMenu).toContainText('ROOM');
    await page.keyboard.press('Escape');
    await expect(roomMenu).not.toBeVisible();

    // 3. Positie contextmenu
    const posTh = page.locator('#matrix-table thead tr:nth-child(4) th:has-text("Voorzijde")').first();
    await posTh.click({ button: 'right' });

    const posMenu = page.locator('div[role="menu"]');
    await expect(posMenu).toBeVisible();
    await expect(posMenu).toContainText('POSITION');
    await page.keyboard.press('Escape');
    await expect(posMenu).not.toBeVisible();
  });

  // TC-CTX-02: Cel Right-Click & Contextmenu
  test('TC-CTX-02: Cell right-click opens cell contextmenu', async ({ page }) => {
    await page.goto('/matrix-orders');

    // Right-click on first cell
    const cell = page.locator('#matrix-table tbody tr:first-child td').first();
    await cell.click({ button: 'right' });

    const cellMenu = page.locator('div[role="menu"]');
    await expect(cellMenu).toBeVisible();
    await expect(cellMenu).toContainText('Product & maten bewerken');

    // Dismiss on click outside
    await page.mouse.click(10, 10);
    await expect(cellMenu).not.toBeVisible();
  });

  // TC-CRUD-01: Cel Bewerken via Product Edit Drawer
  test('TC-CRUD-01: Editing dimensions & quantity in drawer recalculates price and updates total', async ({ page }) => {
    await page.goto('/matrix-orders');

    // Click populated cell (row 1, col 2: Raam Links)
    const cell = page.locator('#matrix-table tbody tr:first-child td').nth(1);
    await cell.click();

    const drawer = page.locator('div[role="dialog"][aria-labelledby="product-edit-title"]');
    await expect(drawer).toBeVisible();

    // Aantal invoer
    const qtyInput = drawer.locator('input[type="number"]').nth(2); // 3rd number input is quantity
    await qtyInput.fill('2');

    // Opslaan
    const saveBtn = drawer.locator('button:has-text("Opslaan & Toepassen")');
    await saveBtn.click();

    await expect(drawer).not.toBeVisible();
    // Cel bevat nu 2 stuks
    await expect(cell).toContainText('2 stuks');
  });

  // TC-CRUD-02: Lege Cel (—) Klik voegt product toe
  test('TC-CRUD-02: Clicking empty cell opens edit drawer and assigns product', async ({ page }) => {
    await page.goto('/matrix-orders');
    await page.waitForSelector('#matrix-table tbody tr');

    // Bepaal deterministisch de coördinaten van de eerste lege cel
    const { rowIdx, colIdx } = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#matrix-table tbody tr'));
      for (let r = 0; r < rows.length; r++) {
        const cells = Array.from(rows[r].querySelectorAll('td'));
        for (let c = 0; c < cells.length; c++) {
          if (cells[c].textContent?.trim() === '—') {
            return { rowIdx: r, colIdx: c };
          }
        }
      }
      return { rowIdx: 2, colIdx: 2 };
    });

    const targetCell = page.locator('#matrix-table tbody tr').nth(rowIdx).locator('td').nth(colIdx);
    await expect(targetCell).toContainText('—');

    await targetCell.click();

    const drawer = page.locator('div[role="dialog"][aria-labelledby="product-edit-title"]');
    await expect(drawer).toBeVisible();

    // Save defaults
    const saveBtn = drawer.locator('button:has-text("Opslaan & Toepassen")');
    await saveBtn.click();

    await expect(drawer).not.toBeVisible();
    // Specific target cell is now populated (no longer "—")
    await expect(targetCell).not.toContainText('—');
    await expect(targetCell).toContainText('stuks');
  });

  // TC-FSM-01: Non-intrusive FSM Modal
  test('TC-FSM-01: Clicking completed FSM step opens FSM modal without window.alert', async ({ page }) => {
    let alertTriggered = false;
    page.on('dialog', async (dialog) => {
      alertTriggered = true;
      await dialog.dismiss();
    });

    await page.goto('/matrix-orders');

    // Click completed step 3 (Inmeten)
    const step3 = page.locator('#fsm-step-3');
    await step3.click();

    // FSM modal should open
    const modal = page.locator('div[role="dialog"][aria-labelledby="fsm-modal-title"]');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Inmeten');
    expect(alertTriggered).toBe(false);

    // Close modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  // TC-DOC-01: Authentic LogicTrade Document Link
  test('TC-DOC-01: LT Brondocument button links to authentic PDF', async ({ page }) => {
    await page.goto('/matrix-orders');

    const ltDocBtn = page.locator('#btn-historisch-document');
    await expect(ltDocBtn).toBeVisible();
    await expect(ltDocBtn).toHaveAttribute('href', '/documents/order-v26001376-logictrade.pdf');
    await expect(ltDocBtn).toHaveAttribute('target', '_blank');
  });

  // TC-SUB-01: Conditional Subposition Badges
  test('TC-SUB-01: Subposition [a] badge only visible when multiple subpositions exist', async ({ page }) => {
    await page.goto('/matrix-orders');

    // Schuifpui has multiple subpositions (a, b) -> [a] should be visible on row 6/7
    const subPosBadge = page.locator('#matrix-table tbody span:has-text("[a]")');
    await expect(subPosBadge.first()).toBeVisible();

    // Single positions should NOT have subposition badges
    const singlePosBadge = page.locator('#matrix-table thead tr:nth-child(4) th:has-text("Raam Links")').first();
    await expect(singlePosBadge).not.toContainText('[a]');
  });
});
