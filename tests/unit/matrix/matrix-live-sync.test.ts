import { describe, it, expect } from 'vitest';
import {
  normalizeSubLine,
  calculateLineTotalCents,
  applyCellPatch,
  createCellSnapshot,
  rollbackCellPatch,
} from '@/lib/matrix/matrix-mutation-engine';
import { MATRIX_ORDERS_MOCK_DATA } from '@/fixtures/matrix-mock-data';
import type { MatrixOrder } from '@/types/matrix';

describe('matrix-mutation-engine', () => {
  const sampleOrder: MatrixOrder = JSON.parse(JSON.stringify(MATRIX_ORDERS_MOCK_DATA[0]));

  describe('normalizeSubLine', () => {
    it('normaliseert numerieke string naar integer', () => {
      expect(normalizeSubLine('1')).toBe(1);
      expect(normalizeSubLine('12')).toBe(12);
    });

    it('normaliseert undefined, leeg of ongeldige karakters naar 0', () => {
      expect(normalizeSubLine(undefined)).toBe(0);
      expect(normalizeSubLine('')).toBe(0);
      expect(normalizeSubLine('  ')).toBe(0);
      expect(normalizeSubLine('a')).toBe(0);
      expect(normalizeSubLine('sub_pos')).toBe(0);
    });
  });

  describe('calculateLineTotalCents', () => {
    it('berekent regelbedrag conform Server CPQ pariteit', () => {
      expect(calculateLineTotalCents(3, 2500)).toBe(7500);
      expect(calculateLineTotalCents(1.5, 2000)).toBe(3000);
    });

    it('dwingt 0 cent af voor inbegrepen regels (€0-bescherming)', () => {
      expect(calculateLineTotalCents(10, 5000, true)).toBe(0);
    });
  });

  describe('applyCellPatch & rollback', () => {
    it('past een mutatie optimistisch en immutabel toe op de order', () => {
      const productId = sampleOrder.products[0].id;
      const positionId = 'pos_k3_vloer';

      const initialTotal = sampleOrder.totaalbedragCents;
      const snapshot = createCellSnapshot(sampleOrder, productId, positionId);

      const updatedOrder = applyCellPatch(sampleOrder, {
        productId,
        positionId,
        patch: { quantity: 2 },
      });

      expect(updatedOrder).not.toBe(sampleOrder);
      const updatedCell = updatedOrder.products
        .find((p) => p.id === productId)
        ?.posPrices[positionId];

      expect(updatedCell?.quantity).toBe(2);
      expect(updatedOrder.totaalbedragCents).toBeGreaterThan(initialTotal);

      // Rollback naar snapshot
      const restoredOrder = rollbackCellPatch(updatedOrder, snapshot);
      const restoredCell = restoredOrder.products
        .find((p) => p.id === productId)
        ?.posPrices[positionId];

      expect(restoredCell?.quantity).toBe(1);
      expect(restoredOrder.totaalbedragCents).toBe(initialTotal);
    });
  });
});
