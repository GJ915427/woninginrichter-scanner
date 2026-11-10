import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  toOrderLinePatchDto,
  updateMatrixCellRpc,
  type OrderMutationRpcPayload,
} from '@/lib/supabase/order-mutation-client';

describe('order-mutation-client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('toOrderLinePatchDto', () => {
    it('converteert camelCase velden naar snake_case backend contract', () => {
      const dto = toOrderLinePatchDto({
        quantity: 3,
        unitPriceCents: 2500,
        totalPriceCents: 7500,
        dim: '120x80',
        note: 'Speciale afwerking',
        dimensionSpec: { breedteMm: 1200, hoogteMm: 800 },
      });

      expect(dto).toEqual({
        quantity: 3,
        unit_price_cents: 2500,
        total_price_cents: 7500,
        dim: '120x80',
        notes: 'Speciale afwerking',
        dimension_spec: { breedteMm: 1200, hoogteMm: 800 },
      });
    });

    it('berekent total_price_cents server-compatible indien niet expliciet meegegeven', () => {
      const dto = toOrderLinePatchDto({
        quantity: 4,
        unitPriceCents: 1250,
      });

      expect(dto.total_price_cents).toBe(5000);
    });

    it('behandelt undefined of partiële velden zuiver', () => {
      const dto = toOrderLinePatchDto({
        note: 'Alleen notitie bijwerken',
      });

      expect(dto).toEqual({
        notes: 'Alleen notitie bijwerken',
      });
    });
  });

  describe('updateMatrixCellRpc', () => {
    it('verstuurt correcte payload naar /rest/v1/rpc/update_matrix_cell', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          updated_line: { id: 101, line_number: 10, sub_line: 0, quantity: 2 },
          total_amount_cents: 150000,
        }),
      });

      const result = await updateMatrixCellRpc({
        orderId: 'V26001376',
        lineNumber: 10,
        subLine: 0,
        patch: { quantity: 2, unitPriceCents: 75000 },
        fetchImpl: mockFetch as unknown as typeof fetch,
        url: 'https://test-supabase.co',
        anonKey: 'test-anon-key',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledOptions] = mockFetch.mock.calls[0];
      expect(calledUrl).toBe('https://test-supabase.co/rest/v1/rpc/update_matrix_cell');
      expect(calledOptions.method).toBe('POST');
      expect(calledOptions.headers).toMatchObject({
        'Content-Type': 'application/json',
        apikey: 'test-anon-key',
        Authorization: 'Bearer test-anon-key',
      });

      const body = JSON.parse(calledOptions.body);
      expect(body).toEqual({
        p_order_id: 'V26001376',
        p_line_number: 10,
        p_sub_line: 0,
        p_patch: {
          quantity: 2,
          unit_price_cents: 75000,
          total_price_cents: 150000,
        },
      });

      expect(result.success).toBe(true);
      expect(result.totalAmountCents).toBe(150000);
      expect(result.updatedLine).toBeDefined();
    });

    it('handelt non-ok responses fail-closed af zonder unhandled crash', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Function not found or invalid argument',
      });

      const result = await updateMatrixCellRpc({
        orderId: 'V26001376',
        lineNumber: 10,
        subLine: 0,
        patch: { quantity: 1 },
        fetchImpl: mockFetch as unknown as typeof fetch,
        url: 'https://test-supabase.co',
        anonKey: 'test-anon-key',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Bad Request');
    });

    it('handelt netwerkexceptions af en retourneert fail-closed error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network connection refused'));

      const result = await updateMatrixCellRpc({
        orderId: 'V26001376',
        lineNumber: 10,
        subLine: 0,
        patch: { quantity: 1 },
        fetchImpl: mockFetch as unknown as typeof fetch,
        url: 'https://test-supabase.co',
        anonKey: 'test-anon-key',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network connection refused');
    });
  });
});
