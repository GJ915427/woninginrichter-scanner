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

      // [SPEC-CHANGE-AUTHORIZED: Sub-Phase 3B SubLine Parity in Matrix Bundle]
      expect(product!.posPrices['pos_1'].subLine).toBe(0);
      expect(serviceProd!.posPrices['pos_1'].subLine).toBe(1);
      expect(matrixOrder.rawLines[0].subLine).toBe(0);
      expect(matrixOrder.rawLines[1].subLine).toBe(1);

      // [SPEC-CHANGE-AUTHORIZED: Matrix bundle testsuite uitbreiden met wiskundige maten-extractie en polymorfe DimensionSpec asserties]
      expect(product!.posPrices['pos_1'].dimensionSpec).toEqual({
        type: 'window_2d',
        widthMm: 1100,
        heightMm: 2240,
      });
    });

    // [SPEC-CHANGE-AUTHORIZED: Matrix bundle pariteit voor pos_project_algemeen uitsluiting en cluster partitie]
    it('excludes pos_project_algemeen from etageMap/roomMap while preserving it in prod.posPrices for Column 1', () => {
      const dtoWithAlgemeen: OrderMatrixBundleDto = {
        order: {
          id: 'V26001377',
          order_number: 'V26001377',
        },
        lines: [
          {
            line_number: 1,
            sub_line: 0,
            product_id: null,
            product_code: 'INMEET',
            product_group_code: '6.6',
            description: 'Inmeetservice GSW',
            quantity: 1,
            unit: 'keer',
            unit_price_cents: 9500,
            total_price_cents: 9500,
            is_hybrid: false,
            is_inbegrepen: false,
            etage_name: null,
            room_name: null,
            window_name: null,
            position_id: 'pos_project_algemeen',
          },
          {
            line_number: 2,
            sub_line: 0,
            product_id: 101,
            product_code: 'A0001',
            product_group_code: '2.4',
            description: 'Gordijn Woonkamer',
            quantity: 1,
            unit: 'stuks',
            unit_price_cents: 25000,
            total_price_cents: 25000,
            is_hybrid: false,
            is_inbegrepen: false,
            etage_name: 'Begane grond',
            room_name: 'Woonkamer',
            window_name: 'Raam links',
            position_id: 'pos_wk_1',
          },
        ],
      };

      const matrixOrder = bundleMatrixOrder(dtoWithAlgemeen);

      // pos_project_algemeen mag NOOIT als kolom in etages zitten
      for (const etage of matrixOrder.etages) {
        for (const room of etage.rooms) {
          for (const pos of room.positions) {
            expect(pos.id).not.toBe('pos_project_algemeen');
          }
        }
      }

      // Maar het product moet wél posPrices['pos_project_algemeen'] bevatten
      const inmeetProd = matrixOrder.products.find((p) => p.code === 'INMEET');
      expect(inmeetProd).toBeDefined();
      expect(inmeetProd!.posPrices['pos_project_algemeen']).toBeDefined();
      expect(inmeetProd!.posPrices['pos_project_algemeen'].totalPriceCents).toBe(9500);
    });

    // [SPEC-CHANGE-AUTHORIZED: Matrix bundle pariteit voor pos_project_algemeen uitsluiting en cluster partitie]
    it('groups lines with null etage under Overig / N.t.b. with room fallback N.t.b. without phantom Algemeen room', () => {
      const dtoWithNullEtage: OrderMatrixBundleDto = {
        order: { id: 'V26001378', order_number: 'V26001378' },
        lines: [
          {
            line_number: 1,
            sub_line: 0,
            product_id: 102,
            product_code: 'A0002',
            product_group_code: '1.1',
            description: 'Stof zonder verdieping',
            quantity: 1,
            unit: 'm1',
            unit_price_cents: 10000,
            total_price_cents: 10000,
            is_hybrid: false,
            is_inbegrepen: false,
            etage_name: null,
            room_name: null,
            window_name: 'Pos. N.t.b.',
            position_id: 'pos_onbekend_1',
          },
        ],
      };

      const matrixOrder = bundleMatrixOrder(dtoWithNullEtage);
      expect(matrixOrder.etages).toHaveLength(1);
      expect(matrixOrder.etages[0].name).toBe('Overig / N.t.b.');
      expect(matrixOrder.etages[0].rooms).toHaveLength(1);
      expect(matrixOrder.etages[0].rooms[0].name).toBe('N.t.b.');
      expect(matrixOrder.etages[0].rooms[0].positions[0].id).toBe('pos_onbekend_1');
    });

    // [SPEC-CHANGE-AUTHORIZED: Matrix bundle pariteit voor pos_project_algemeen uitsluiting en cluster partitie]
    it('partitions room.positions with clustered positions first for 100% HTML colSpan alignment in MatrixHeader', () => {
      const dtoWithCluster: OrderMatrixBundleDto = {
        order: { id: 'V26001379', order_number: 'V26001379' },
        lines: [
          {
            line_number: 1,
            sub_line: 0,
            product_id: 103,
            product_code: 'A0003',
            product_group_code: '2.4',
            description: 'Zijraam (ongeclusterd)',
            quantity: 1,
            unit: 'stuks',
            unit_price_cents: 20000,
            total_price_cents: 20000,
            is_hybrid: false,
            is_inbegrepen: false,
            etage_name: 'Begane grond',
            room_name: 'Woonkamer',
            window_name: 'Zijraam 1',
            position_id: 'pos_wk_zijraam',
            spatial_metadata: {
              etage_name: 'Begane grond',
              room_name: 'Woonkamer',
              window_name: 'Zijraam 1',
              position_id: 'pos_wk_zijraam',
              cluster_name: null,
            },
          },
          {
            line_number: 2,
            sub_line: 0,
            product_id: 104,
            product_code: 'A0004',
            product_group_code: '2.4',
            description: 'Erker raam 1 (geclusterd)',
            quantity: 1,
            unit: 'stuks',
            unit_price_cents: 30000,
            total_price_cents: 30000,
            is_hybrid: false,
            is_inbegrepen: false,
            etage_name: 'Begane grond',
            room_name: 'Woonkamer',
            window_name: 'Erker Raam 1',
            position_id: 'pos_wk_erker_1',
            spatial_metadata: {
              etage_name: 'Begane grond',
              room_name: 'Woonkamer',
              window_name: 'Erker Raam 1',
              position_id: 'pos_wk_erker_1',
              cluster_name: 'Erkercluster',
            },
          },
          {
            line_number: 3,
            sub_line: 0,
            product_id: 105,
            product_code: 'A0005',
            product_group_code: '2.4',
            description: 'Erker raam 2 (geclusterd)',
            quantity: 1,
            unit: 'stuks',
            unit_price_cents: 30000,
            total_price_cents: 30000,
            is_hybrid: false,
            is_inbegrepen: false,
            etage_name: 'Begane grond',
            room_name: 'Woonkamer',
            window_name: 'Erker Raam 2',
            position_id: 'pos_wk_erker_2',
            spatial_metadata: {
              etage_name: 'Begane grond',
              room_name: 'Woonkamer',
              window_name: 'Erker Raam 2',
              position_id: 'pos_wk_erker_2',
              cluster_name: 'Erkercluster',
            },
          },
        ],
      };

      const matrixOrder = bundleMatrixOrder(dtoWithCluster);
      const room = matrixOrder.etages[0].rooms[0];
      expect(room.clusters).toHaveLength(1);
      expect(room.clusters[0].name).toBe('Erkercluster');
      expect(room.clusters[0].positionIds).toEqual(['pos_wk_erker_1', 'pos_wk_erker_2']);

      // Verifieer dat de geclusterde posities VOORAAN staan in room.positions,
      // zodat <th colSpan={clusteredPositions.length}> exact uitlijnt met Row 4 posities!
      expect(room.positions).toHaveLength(3);
      expect(room.positions[0].id).toBe('pos_wk_erker_1');
      expect(room.positions[1].id).toBe('pos_wk_erker_2');
      expect(room.positions[2].id).toBe('pos_wk_zijraam');
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
