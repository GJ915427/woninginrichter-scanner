import { test, expect } from '@playwright/test';
import { BENCHMARK_TYPOLOGIES } from '@/fixtures/benchmark-typologies';

test.describe('E2E Benchmark Typologies Suite', () => {
  for (const typology of BENCHMARK_TYPOLOGIES) {
    test.describe(`Typology: ${typology.name} (${typology.id})`, () => {
      let consoleErrors: string[] = [];
      let pageErrors: string[] = [];

      test.beforeEach(async ({ page }) => {
        consoleErrors = [];
        pageErrors = [];

        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
          }
        });

        page.on('pageerror', (err) => {
          pageErrors.push(err.message);
        });

        await page.goto('/');
        await page.locator(`[data-testid="typology-btn-${typology.id}"]`).click();
        await expect(page.locator('svg[data-testid="floorplan-svg"]')).toBeVisible();
        await expect(page.locator('svg[data-testid="cross-section-svg"]')).toBeVisible();
      });

      test('1. Voorgevel badge is rendered on street facade & party walls have correct hatching', async ({ page }) => {
        // 1. Voorgevel badge verification
        const voorgevelBadge = page.locator('svg[data-testid="floorplan-svg"] [data-testid="voorgevel-badge"]');
        await expect(voorgevelBadge).toBeVisible();
        await expect(voorgevelBadge).toContainText('VOORGEVEL');

        // Verify arrow marker is defined in SVG defs
        const marker = page.locator('svg[data-testid="floorplan-svg"] defs marker#arrow-voorgevel');
        await expect(marker).toHaveCount(1);

        // 2. Party wall hatching verification
        const partyWallLines = page.locator('svg[data-testid="floorplan-svg"] line[stroke*="party-wall-hatch"]');
        const hatchPattern = page.locator('svg[data-testid="floorplan-svg"] defs pattern#party-wall-hatch');
        await expect(hatchPattern).toHaveCount(1);

        // Check party wall expectation based on typology definition
        const isDetached = typology.id === 'vrijstaande_villa';
        if (isDetached) {
          // Detached villa must have 0 party wall hatch strips
          await expect(partyWallLines).toHaveCount(0);
        } else {
          // Attached typologies must have at least 1 party wall hatch strip
          const count = await partyWallLines.count();
          expect(count).toBeGreaterThanOrEqual(1);
        }

        // Verify zero console or page errors
        expect(consoleErrors).toHaveLength(0);
        expect(pageErrors).toHaveLength(0);
      });

      test('2. All room labels are visible and within bounds', async ({ page }) => {
        const floorplanSvg = page.locator('svg[data-testid="floorplan-svg"]');
        await expect(floorplanSvg).toBeVisible();

        const roomLabelGroups = page.locator('svg[data-testid="floorplan-svg"] g.room-label');
        await expect(roomLabelGroups).toHaveCount(typology.rooms.length);

        // Verify all room names are rendered and visible in the DOM
        for (const room of typology.rooms) {
          const roomLabel = page.locator(`svg[data-testid="floorplan-svg"] g.room-label:has-text("${room.name}")`);
          await expect(roomLabel).toBeVisible();
        }

        // Mathematically assert all room labels are positioned within valid SVG bounds and room areas
        const boundsValidation = await page.evaluate((expectedRooms) => {
          const svg = document.querySelector('svg[data-testid="floorplan-svg"]') as SVGSVGElement | null;
          if (!svg) return { ok: false, message: 'Floorplan SVG not found' };

          const vb = svg.viewBox.baseVal;
          const labels = Array.from(svg.querySelectorAll('g.room-label'));

          for (const room of expectedRooms) {
            const labelGroup = labels.find((l) => l.textContent?.includes(room.name)) as SVGGElement | undefined;
            if (!labelGroup) {
              return { ok: false, message: `Label for ${room.name} missing from DOM` };
            }

            const bbox = labelGroup.getBBox();

            // Label bounding box must lie within the floorplan viewBox margin
            const margin = 0.5; // allowed tolerance
            if (
              bbox.x < vb.x - margin ||
              bbox.y < vb.y - margin ||
              bbox.x + bbox.width > vb.x + vb.width + margin ||
              bbox.y + bbox.height > vb.y + vb.height + margin
            ) {
              return {
                ok: false,
                message: `Label for ${room.name} is out of viewBox bounds: bbox=(${bbox.x}, ${bbox.y}, ${bbox.width}, ${bbox.height}), viewBox=(${vb.x}, ${vb.y}, ${vb.width}, ${vb.height})`,
              };
            }

            // Room polygon must exist and label center must be inside or directly adjacent to room polygon bbox
            const roomPolygon = svg.querySelector(`polygon[data-testid="room-${room.id}"]`) as SVGPolygonElement | null;
            if (!roomPolygon) {
              return { ok: false, message: `Polygon room-${room.id} not found` };
            }

            const polyBox = roomPolygon.getBBox();
            const centerX = bbox.x + bbox.width / 2;
            const centerY = bbox.y + bbox.height / 2;

            if (
              centerX < polyBox.x - margin ||
              centerX > polyBox.x + polyBox.width + margin ||
              centerY < polyBox.y - margin ||
              centerY > polyBox.y + polyBox.height + margin
            ) {
              return {
                ok: false,
                message: `Label for ${room.name} center (${centerX.toFixed(2)}, ${centerY.toFixed(2)}) is outside room polygon bbox (${polyBox.x.toFixed(2)}, ${polyBox.y.toFixed(2)}, ${polyBox.width.toFixed(2)}, ${polyBox.height.toFixed(2)})`,
              };
            }
          }

          return { ok: true, message: 'All room labels within valid bounds' };
        }, typology.rooms);

        expect(boundsValidation.ok).toBe(true);
        expect(consoleErrors).toHaveLength(0);
        expect(pageErrors).toHaveLength(0);
      });

      test('3. All elevation markers and clearance lines (NEN 2580 1.50m and 2.60m) are rendered with zero label overlap', async ({ page }) => {
        // Clearance lines presence in SVG DOM
        const nen150Line = page.locator('svg[data-testid="cross-section-svg"] [data-testid="nen-150-line"]');
        const nen260Line = page.locator('svg[data-testid="cross-section-svg"] [data-testid="nen-260-line"]');
        await expect(nen150Line).toBeAttached();
        await expect(nen260Line).toBeAttached();

        // Datum lines presence in SVG DOM
        await expect(page.locator('svg[data-testid="cross-section-svg"] [data-testid="ground-datum-line"]')).toBeAttached();
        await expect(page.locator('svg[data-testid="cross-section-svg"] [data-testid="drempelpeil-line"]')).toBeAttached();

        // Mathematical assertion of zero label overlap
        const overlapResult = await page.evaluate(() => {
          const svg = document.querySelector('svg[data-testid="cross-section-svg"]') as SVGSVGElement | null;
          if (!svg) return { ok: false, message: 'CrossSection SVG not found' };

          // Verify clearance lines have non-zero geometry
          const line150 = svg.querySelector('[data-testid="nen-150-line"]') as SVGLineElement | null;
          const line260 = svg.querySelector('[data-testid="nen-260-line"]') as SVGLineElement | null;
          if (!line150 || !line260) {
            return { ok: false, message: 'NEN 2580 clearance lines missing from DOM' };
          }
          const x1_150 = parseFloat(line150.getAttribute('x1') || '0');
          const x2_150 = parseFloat(line150.getAttribute('x2') || '0');
          if (Math.abs(x2_150 - x1_150) < 0.1) {
            return { ok: false, message: 'NEN 2580 1.50m line has zero length' };
          }

          const textElements = Array.from(svg.querySelectorAll('g.vertical-label-group text'));
          if (textElements.length < 5) {
            return {
              ok: false,
              message: `Expected at least 5 elevation labels, found ${textElements.length}`,
            };
          }

          const boxes = textElements.map((el) => {
            const b = (el as SVGGraphicsElement).getBBox();
            return {
              text: el.textContent?.trim() || '',
              x: b.x,
              y: b.y,
              width: b.width,
              height: b.height,
              top: b.y,
              bottom: b.y + b.height,
              left: b.x,
              right: b.x + b.width,
            };
          });

          // Check required NEN 2580 markers exist in the vertical stack
          const nen150Label = boxes.find((b) => b.text.includes('1.50m') || b.text.includes('NEN 2580 GO'));
          const nen260Label = boxes.find((b) => b.text.includes('2.60m') || b.text.includes('Verblijfsgebied'));

          if (!nen150Label) {
            return { ok: false, message: 'NEN 2580 1.50m label not found in vertical stack' };
          }
          if (!nen260Label) {
            return { ok: false, message: 'NEN 2580 2.60m label not found in vertical stack' };
          }

          // Pairwise 2D AABB collision test
          const overlaps: string[] = [];
          for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
              const a = boxes[i];
              const b = boxes[j];

              const hOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
              const vOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);

              // Allow 0.05m tolerance for boundary touching/rounding
              if (hOverlap > 0.05 && vOverlap > 0.05) {
                overlaps.push(
                  `Overlap between "${a.text}" (top=${a.top.toFixed(2)}, btm=${a.bottom.toFixed(2)}) and "${b.text}" (top=${b.top.toFixed(2)}, btm=${b.bottom.toFixed(2)}): vOverlap=${vOverlap.toFixed(3)}m`
                );
              }
            }
          }

          return {
            ok: overlaps.length === 0,
            message: overlaps.length === 0 ? 'Zero overlap confirmed' : overlaps.join('; '),
            labelCount: boxes.length,
          };
        });

        expect(overlapResult.ok).toBe(true);
        expect(overlapResult.labelCount).toBeGreaterThanOrEqual(5);
        expect(consoleErrors).toHaveLength(0);
        expect(pageErrors).toHaveLength(0);
      });

      test('4. View mode switching (Floorplan, Doorsnede, Dual View) renders cleanly without layout breaks', async ({ page }) => {
        // Initial state: Dual View
        await expect(page.locator('svg[data-testid="floorplan-svg"]')).toBeVisible();
        await expect(page.locator('svg[data-testid="cross-section-svg"]')).toBeVisible();

        // Switch to Floorplan only
        await page.locator('[data-testid="view-mode-floorplan"]').click();
        await expect(page.locator('svg[data-testid="floorplan-svg"]')).toBeVisible();
        await expect(page.locator('svg[data-testid="cross-section-svg"]')).toHaveCount(0);

        // Switch to Cross-Section (Doorsnede) only
        await page.locator('[data-testid="view-mode-cross-section"]').click();
        await expect(page.locator('svg[data-testid="cross-section-svg"]')).toBeVisible();
        await expect(page.locator('svg[data-testid="floorplan-svg"]')).toHaveCount(0);

        // Switch back to Dual View
        await page.locator('[data-testid="view-mode-dual"]').click();
        await expect(page.locator('svg[data-testid="floorplan-svg"]')).toBeVisible();
        await expect(page.locator('svg[data-testid="cross-section-svg"]')).toBeVisible();

        // Check for layout health (no horizontal overflow / breaks)
        const layoutHealthy = await page.evaluate(() => {
          return document.documentElement.scrollWidth <= window.innerWidth + 10;
        });
        expect(layoutHealthy).toBe(true);

        expect(consoleErrors).toHaveLength(0);
        expect(pageErrors).toHaveLength(0);
      });

      test('5. Zero console errors and zero uncaught page errors across all interactions', async ({ page }) => {
        // Perform interactive actions: zoom controls and chip toggles
        await page.locator('[data-testid="zoom-in-button"]').click();
        await page.locator('[data-testid="zoom-out-button"]').click();
        await page.locator('[data-testid="reset-view-button"]').click();

        await page.locator('[data-testid="cs-zoom-in-button"]').click();
        await page.locator('[data-testid="cs-zoom-out-button"]').click();
        await page.locator('[data-testid="cs-reset-view-button"]').click();

        // Click inspection chips to toggle overlays
        const voorgevelChip = page.locator('button:has-text("Voorgevel:")');
        if ((await voorgevelChip.count()) > 0) {
          await voorgevelChip.click();
          await voorgevelChip.click();
        }

        // Final assertion: zero errors
        expect(consoleErrors).toEqual([]);
        expect(pageErrors).toEqual([]);
      });
    });
  }
});
