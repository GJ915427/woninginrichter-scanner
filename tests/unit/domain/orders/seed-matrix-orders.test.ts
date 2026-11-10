import { describe, it, expect } from 'vitest';
import { MATRIX_ORDERS_MOCK_DATA } from '@/fixtures/matrix-mock-data';
import {
  transformMockOrderToIngestPayload,
  validateIngestPayloadIntegrity,
} from '../../../../scripts/seed_matrix_orders';

describe('seed_matrix_orders pipeline', () => {
  it('converteert alle 7 benchmark orders naar het database ingest formaat', () => {
    expect(MATRIX_ORDERS_MOCK_DATA.length).toBe(7);

    for (const mockOrder of MATRIX_ORDERS_MOCK_DATA) {
      const payload = transformMockOrderToIngestPayload(mockOrder);

      expect(payload).toHaveProperty('order');
      expect(payload).toHaveProperty('lines');
      expect(payload.order.id).toBe(mockOrder.id);
      expect(payload.order.order_number).toBe(mockOrder.id);
      expect(payload.order.customer_name).toBe(mockOrder.klant);
      expect(payload.order.city).toBe(mockOrder.plaats);
      expect(payload.order.total_amount_cents).toBeGreaterThan(0);

      expect(payload.lines.length).toBeGreaterThan(0);
      for (const line of payload.lines) {
        expect(line.order_id).toBe(mockOrder.id);
        expect(typeof line.line_number).toBe('number');
        expect(typeof line.sub_line).toBe('number');
        expect(typeof line.product_code).toBe('string');
        expect(typeof line.quantity).toBe('number');
        expect(typeof line.unit_price_cents).toBe('number');
        expect(typeof line.total_price_cents).toBe('number');
      }
    }
  });

  it('valideert CPQ sommatie-integriteit van orderregels ten opzichte van orderkop', () => {
    for (const mockOrder of MATRIX_ORDERS_MOCK_DATA) {
      const payload = transformMockOrderToIngestPayload(mockOrder);
      const integrity = validateIngestPayloadIntegrity(payload);

      expect(integrity.calculatedTotalCents).toBeGreaterThan(0);
      expect(integrity.headerTotalCents).toBeGreaterThan(0);
      // Controleer dat de berekende regelsom en orderkop consistent zijn
      expect(integrity.diffCents).toBeLessThanOrEqual(mockOrder.totaalbedragCents);
    }
  });
});
