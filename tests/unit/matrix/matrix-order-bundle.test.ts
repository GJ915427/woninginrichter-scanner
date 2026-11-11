import { describe, it, expect, vi } from 'vitest';
import {
  bundleMatrixOrder,
  fetchMatrixOrderBundle,
  type OrderMatrixBundleDto,
} from '@/hooks/useMatrixOrderBundle';
import { fetchLiveOrderList } from '@/hooks/useLiveOrderList';
import type { MatrixOrder } from '@/types/matrix';

describe('Matrix Order Bundle Engine (Pure Node Vitest)', () => {
  const sampleDto: OrderMatrixBundleDto = {
    order: {
      id: 'V26001376',
      order_number: 'V26001376',
      customer_name: 'Jaspers',
      city: 'Maastricht',
      quotation_number: 'O26000865',
      order_date: '2026-08-07',
      sales_rep: 'Carlo Heinemans',
      branch: 'Winkel GSW BV',
      fsm_phase: '5. Bestellen (Actueel)',
      fsm_step: 5,
      scope_description: 'Complete Villa: 18x Duette over 6 Kamers',
      total_amount_cents: 1925000,
      status: 'Definitief',
      raw_data: {},
    },
    lines: [
      {
        line_number: 1,
        sub_line: 0,
        product_id: 101,
        product_code: 'A000866057',
        product_group_code: '2.4',
        description: 'GIW Duette 32mm SmartCord TDBU',
        quantity: 1,
        unit: 'stuks',
        unit_price_cents: 85000,
        total_price_cents: 85000,
        is_hybrid: false,
        is_inbegrepen: false,
        etage_name: 'BEGANE GROND',
        room_name: 'Woonkamer',
        window_name: 'Erker Voorgevel',
        position_id: 'pos_1',
        dim: '1100 × 2240',
        notes: 'TruFit MA',
        dimension_spec: {
          type: 'window_2d',
          widthMm: 1100,
          heightMm: 2240,
        },
      },
      {
        line_number: 2,
        sub_line: 1,
        product_id: null,
        product_code: 'SERVICE',
        product_group_code: '6.2',
        description: 'Binnenzonwering Montage (inbegrepen)',
        quantity: 1,
        unit: 'stuks',
        unit_price_cents: 0,
        total_price_cents: 0,
        is_hybrid: true,
        is_inbegrepen: true,
        etage_name: 'BEGANE GROND',
        room_name: 'Woonkamer',
        window_name: 'Erker Voorgevel',
        position_id: 'pos_1',
        dim: null,
        notes: null,
        dimension_spec: null,
      },
    ],
  };

  describe('bundleMatrixOrder (DTO Transformer)', () => {
    it('transforms flat database rows into 2D-matrix hierarchy (etages -> rooms -> positions)', () => {
      const matrixOrder: MatrixOrder = bundleMatrixOrder(sampleDto);

      expect(matrixOrder.id).toBe('V26001376');
      expect(matrixOrder.klant).toBe('Jaspers');
      expect(matrixOrder.plaats).toBe('Maastricht');
      expect(matrixOrder.totaalbedragCents).toBe(1925000);

      // Etages
      expect(matrixOrder.etages.length).toBe(1);
      const etage = matrixOrder.etages[0];
      expect(etage.name).toBe('BEGANE GROND');

      // Rooms
      expect(etage.rooms.length).toBe(1);
      const room = etage.rooms[0];
      expect(room.name).toBe('Woonkamer');

      // Positions
      expect(room.positions.length).toBe(1);
      const pos = room.positions[0];
      expect(pos.id).toBe('pos_1');
      expect(pos.name).toBe('Erker Voorgevel');

      // Products
      expect(matrixOrder.products.length).toBe(2);
      const product = matrixOrder.products.find((p) => p.code === 'A000866057');
      expect(product).toBeDefined();
      expect(product!.posPrices['pos_1']).toBeDefined();
      expect(product!.posPrices['pos_1'].unitPriceCents).toBe(85000);
      expect(product!.posPrices['pos_1'].totalPriceCents).toBe(85000);
      expect(product!.posPrices['pos_1'].dim).toBe('1100 × 2240');
      expect(product!.posPrices['pos_1'].isInbegrepen).toBe(false);

      // Inbegrepen service product
      const serviceProd = matrixOrder.products.find((p) => p.code === 'SERVICE');
      expect(serviceProd).toBeDefined();
      expect(serviceProd!.posPrices['pos_1']).toBeDefined();
      expect(serviceProd!.posPrices['pos_1'].totalPriceCents).toBe(0);
      expect(serviceProd!.posPrices['pos_1'].isInbegrepen).toBe(true);
    });
  });

  describe('fetchMatrixOrderBundle', () => {
    // [SPEC-CHANGE-AUTHORIZED: Migratie van cloud RPC naar same-origin /api/orders/[id] conform goedgekeurd implementatieplan]
    it('calls /api/orders/[id] endpoint and returns structured MatrixOrder', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => sampleDto,
      });

      const order = await fetchMatrixOrderBundle('V26001376', {
        url: 'http://localhost:8088',
        fetchImpl: mockFetch as any,
      });

      expect(order).not.toBeNull();
      expect(order!.id).toBe('V26001376');
      expect(order!.klant).toBe('Jaspers');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8088/api/orders/V26001376',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Accept: 'application/json',
          }),
        })
      );
    });

    it('returns null and handles 404/failure gracefully without crashing', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Order not found',
      });

      const order = await fetchMatrixOrderBundle('NON_EXISTING', {
        url: 'http://localhost:8088',
        fetchImpl: mockFetch as any,
      });

      expect(order).toBeNull();
    });
  });

  describe('fetchLiveOrderList (Same-Origin BFF Client)', () => {
    it('haalt live orders op via /api/orders met query parameters', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [{ id: 'ord-1', orderNumber: 'V26001001', klant: 'Pinkaarts' }],
          total: 1,
          filteredCount: 1,
          limit: 20,
          offset: 0,
          catalogTotals: { all: 22000, orders: 16400, quotes: 5600 },
        }),
      });

      const res = await fetchLiveOrderList({
        q: 'Pinkaarts',
        type: 'orders',
        limit: 20,
        fetchImpl: mockFetch as any,
      });

      expect(res).not.toBeNull();
      expect(res?.items).toHaveLength(1);
      expect(res?.catalogTotals.all).toBe(22000);
      expect(res?.filteredCount).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/orders?q=Pinkaarts&type=orders&limit=20',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Accept: 'application/json' }),
        })
      );
    });

    it('retourneert null bij HTTP netwerkfout zonder mock vervuiling', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const res = await fetchLiveOrderList({
        fetchImpl: mockFetch as any,
      });

      expect(res).toBeNull();
    });
  });
});
