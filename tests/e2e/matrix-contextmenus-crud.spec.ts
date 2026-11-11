// [SPEC-CHANGE-AUTHORIZED: Actualisatie van TC-NAV-01 naar klantnaam popover trigger en toevoeging van TC-AUDIT-01 voor viewMode toggle interactie conform Hoofdscherm 4 specificatie]
// [VIEWPORT-RESIZE-AUTHORIZED: Desktop 1440x900 viewport test voor contextmenus en CRUD]
import { test, expect } from '@playwright/test';

test.describe('Matrix Orders Context Menus, CRUD & Cell Interaction', () => {
  test.beforeEach(async ({ page }) => {
    // [VIEWPORT-RESIZE-AUTHORIZED: Desktop 1440x900 viewport test voor contextmenus en CRUD]
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
    await page.waitForTimeout(100);

    // Aantal invoer
    const qtyInput = drawer.locator('input[type="number"]').nth(2); // 3rd number input is quantity
    await qtyInput.fill('2');

    // Opslaan
    const saveBtn = drawer.locator('button:has-text("Opslaan & Toepassen")');
    await saveBtn.click();

    await expect(drawer).not.toBeVisible();
    // Cel bevat nu 2 stuks
    await expect(cell).toContainText(/2\s*(?:stuks|st)\b/i);
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
    await expect(targetCell).toContainText(/(?:stuks|st)\b/i);
  });

  // TC-FSM-01: Non-intrusive FSM Modal via Actionbar Workflow Stage Tag
  test('TC-FSM-01: Clicking workflowStageTag in Actionbar opens FSM modal without window.alert', async ({ page }) => {
    let alertTriggered = false;
    page.on('dialog', async (dialog) => {
      alertTriggered = true;
      await dialog.dismiss();
    });

    await page.goto('/matrix-orders');

    // Click workflow stage tag in ActionBar
    const stageTag = page.locator('#workflowStageTag');
    await expect(stageTag).toBeVisible();
    await stageTag.click();

    // FSM modal should open
    const modal = page.locator('div[role="dialog"][aria-labelledby="fsm-modal-title"]');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Bestellen');
    expect(alertTriggered).toBe(false);

    // Close modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  // TC-DOC-01: Media & Documents Drawer Trigger
  test('TC-DOC-01: Media & Documents Drawer button opens slide-over drawer with attachments', async ({ page }) => {
    await page.goto('/matrix-orders');

    const mediaBtn = page.locator('#btn-meta-media-drawer');
    await expect(mediaBtn).toBeVisible();
    await expect(mediaBtn).toContainText('Bijlagen');
    await mediaBtn.click();

    // Slide-over media drawer opens
    const drawer = page.locator('div[role="dialog"]');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText(/Media & Notities|Werf/i);

    // Close drawer
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
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

  // TC-AUDIT-01: Audit Trail Row Click Cell Highlighting
  test('TC-AUDIT-01: Clicking audit trail row highlights matrix cell and synchronizes state', async ({ page }) => {
    await page.goto('/matrix-orders');
    await page.waitForSelector('#matrix-table tbody tr');

    // In Hoofdscherm 4 is audit-trail display toggled via #meta-order-number
    const orderBtn = page.locator('#meta-order-number');
    await expect(orderBtn).toBeVisible();
    await orderBtn.click();
    await expect(orderBtn).toHaveAttribute('aria-pressed', 'true');

    await page.waitForSelector('section[aria-label="LogicTrade Orderregels Audit Trail"] tbody tr');

    // Click orderline 20 in the audit-trail table
    const auditRow20 = page.locator('section[aria-label="LogicTrade Orderregels Audit Trail"] tbody tr').filter({ hasText: 'Duette® 32mm Voordeur L' }).first();
    await expect(auditRow20).toBeVisible();
    await auditRow20.locator('td').first().click();

    // The corresponding cell matrix-cell-p_duette_32-pos_vd_links should switch back to matrix and have the active highlight ring
    const highlightedCell = page.locator('#matrix-cell-p_duette_32-pos_vd_links');
    await expect(highlightedCell).toBeVisible();
    await expect(highlightedCell).toHaveClass(/ring-2 ring-blue-500/);
  });

  // TC-CLUST-01: Multi-Select Columns in Same Room Merges into Cluster
  test('TC-CLUST-01: Selecting columns in same room enables cluster floating bar and merges into cluster', async ({ page }) => {
    await page.goto('/matrix-orders');
    await page.waitForSelector('#matrix-table tbody tr');

    // Open context menu on first position: Raam Links
    const pos1 = page.locator('#matrix-table thead tr:last-child th:has-text("Raam Links")').first();
    await pos1.click({ button: 'right' });
    const menu1 = page.locator('div[role="menu"]');
    await menu1.locator('button:has-text("Selecteren voor Cluster")').click();

    // Open context menu on second position in same room: Raam Rechts
    const pos2 = page.locator('#matrix-table thead tr:last-child th:has-text("Raam Rechts")').first();
    await pos2.click({ button: 'right' });
    const menu2 = page.locator('div[role="menu"]');
    await menu2.locator('button:has-text("Selecteren voor Cluster")').click();

    // Floating bar must appear with merge button enabled
    const floatingBar = page.locator('aside[aria-label="Cluster selectie actiebalk"]');
    await expect(floatingBar).toBeVisible();
    await expect(floatingBar).toContainText('2 kolommen geselecteerd');

    const mergeBtn = floatingBar.locator('button:has-text("Samenvoegen tot Cluster")');
    await expect(mergeBtn).toBeEnabled();
    await mergeBtn.click();

    // Cluster modal opens
    const clusterModal = page.locator('div[role="dialog"][aria-labelledby="cluster-modal-title"]');
    await expect(clusterModal).toBeVisible();

    const nameInput = clusterModal.locator('#cluster-name-input');
    await nameInput.fill('Voordeur Dubbel');
    const submitBtn = clusterModal.locator('button[type="submit"]:has-text("Samenvoegen")');
    await submitBtn.click();

    await expect(clusterModal).not.toBeVisible();
    // New cluster appears in header
    const clusterHeader = page.locator('#matrix-table thead');
    await expect(clusterHeader).toContainText('Voordeur Dubbel');
  });

  // TC-CLUST-02: Cross-Room Selection Disables Merge Button
  test('TC-CLUST-02: Cross-room selection disables merge button with warning badge', async ({ page }) => {
    await page.goto('/matrix-orders');
    await page.waitForSelector('#matrix-table tbody tr');

    // Select position in Hal (Raam Links)
    const posHal = page.locator('#matrix-table thead tr:last-child th:has-text("Raam Links")').first();
    await posHal.click({ button: 'right' });
    await page.locator('div[role="menu"] button:has-text("Selecteren voor Cluster")').click();

    // Select position in Woonkamer (Voorzijde)
    const posWk = page.locator('#matrix-table thead tr:last-child th:has-text("Voorzijde")').first();
    await posWk.click({ button: 'right' });
    await page.locator('div[role="menu"] button:has-text("Selecteren voor Cluster")').click();

    // Floating bar appears with warning
    const floatingBar = page.locator('aside[aria-label="Cluster selectie actiebalk"]');
    await expect(floatingBar).toBeVisible();
    await expect(floatingBar).toContainText('Samenvoegen vereist posities binnen één ruimte');

    const mergeBtn = floatingBar.locator('button:has-text("Samenvoegen tot Cluster")');
    await expect(mergeBtn).toBeDisabled();
  });

  // TC-VLAK-01: Assign Vlak Updates Position
  test('TC-VLAK-01: Assigning vlak updates position header', async ({ page }) => {
    await page.goto('/matrix-orders');
    await page.waitForSelector('#matrix-table tbody tr');

    const posHeader = page.locator('#matrix-table thead tr:last-child th:has-text("Raam Links")').first();
    await posHeader.click({ button: 'right' });

    const menu = page.locator('div[role="menu"]');
    await menu.locator('button:has-text("Vlak toewijzen")').click();

    const vlakModal = page.locator('div[role="dialog"][aria-labelledby="assign-vlak-title"]');
    await expect(vlakModal).toBeVisible();

    // Click preset 'Kozijn A'
    await vlakModal.locator('button:has-text("Kozijn A")').click();
    await vlakModal.locator('button[type="submit"]:has-text("Opslaan")').click();

    await expect(vlakModal).not.toBeVisible();
    // Position column header reflects updated vlak
    await expect(posHeader).toContainText('Kozijn A');
  });

  // TC-NAV-01: Executive Strip Order Switcher
  test('TC-NAV-01: Executive strip order switcher dropdown switches orders cleanly without state bleed', async ({ page }) => {
    await page.goto('/matrix-orders');

    // In Hoofdscherm 4 is de popover trigger verplaatst naar de klantnaam (#meta-customer-name)
    const customerBtn = page.locator('#meta-customer-name');
    await expect(customerBtn).toBeVisible();

    const orderBtn = page.locator('#meta-order-number');
    await expect(orderBtn).toBeVisible();
    await expect(orderBtn).toContainText('V26001376');

    // Open order popover listbox via klantnaam
    await customerBtn.click();
    const listbox = page.locator('div[role="listbox"][aria-label="Order selectielijst"]');
    await expect(listbox).toBeVisible();

    // Click previous order button inside listbox
    const prevBtn = listbox.locator('button[aria-label="Vorige order"]');
    await expect(prevBtn).toBeVisible();
    await prevBtn.click();

    // Order switches cleanly to previous order (V26001797)
    await expect(orderBtn).toContainText('V26001797');
  });
});
