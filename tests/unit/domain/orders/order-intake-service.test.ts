// [SPEC-CHANGE-AUTHORIZED: Pariteitstest voor transformatie van LogicTrade /quotes payloads naar FSM stap 2 en ID namespace isolatie]
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OrderIntakeService,
  mapLogicTradeOrderToRawInput,
  type RawLogicTradeOrderInput,
  type IngestedOrderBundle,
} from '@/domain/orders/order-intake-service';
import { ClassificationService } from '@/domain/classification/central-classification-service';

describe('OrderIntakeService & Hybrid Line Ingest SSOT', () => {
  let service: OrderIntakeService;
  let classificationService: ClassificationService;

  beforeEach(() => {
    classificationService = new ClassificationService();
    // Registreer bekende artikelen
    classificationService.registerMasterProduct('A00034988', '2.4');
    classificationService.registerMasterProduct('PVC_AMB_01', '3.1');

    service = new OrderIntakeService({
      classificationService,
      resolveProductByCode: vi.fn().mockImplementation(async (code: string) => {
        if (code === 'PVC_AMB_01') {
          return { id: 1001, code: 'PVC_AMB_01', supplier_name: 'Ambiant' };
        }
        if (code === 'A00034988') {
          return { id: 1002, code: 'A00034988', supplier_name: 'Luxaflex' };
        }
        return null;
      }),
    });
  });

  describe('Standard Order Ingest & Non-Unique SKU Resolution', () => {
    it('ingests standard order lines and links product_id via JIT resolver', async () => {
      const rawOrder: RawLogicTradeOrderInput = {
        id: 'V26001001',
        order_number: 'V26001001',
        customer_name: 'Fam. Jansen',
        city: 'Utrecht',
        order_date: '2026-11-10',
        lines: [
          {
            line_number: 1,
            product_code: 'A00034988',
            description: 'Duette 32mm Smartcord',
            quantity: 2,
            unit: 'stuks',
            unit_price_cents: 35000,
            total_price_cents: 70000,
            etage_name: '1e Verdieping',
            room_name: 'Slaapkamer',
            window_name: 'Raam links',
          },
        ],
      };

      const result: IngestedOrderBundle = await service.processOrderIntake(rawOrder);
      expect(result.order.order_number).toBe('V26001001');
      expect(result.order.total_amount_cents).toBe(70000);
      expect(result.lines.length).toBe(1);

      const line1 = result.lines[0];
      expect(line1.product_id).toBe(1002);
      expect(line1.product_group_code).toBe('2.4');
      expect(line1.unit_price_cents).toBe(35000);
      expect(line1.total_price_cents).toBe(70000);
      expect(line1.etage_name).toBe('1e Verdieping');
      expect(line1.room_name).toBe('Slaapkamer');
    });

    it('handles free-text order lines safely with product_id = null and group 9.9 or classified', async () => {
      const rawOrder: RawLogicTradeOrderInput = {
        id: 'V26001002',
        order_number: 'V26001002',
        customer_name: 'Klant B',
        lines: [
          {
            line_number: 1,
            product_code: 'TEKST',
            description: 'diverse toeslagen n.t.b.',
            quantity: 1,
            unit_price_cents: 5000,
            total_price_cents: 5000,
          },
        ],
      };

      const result = await service.processOrderIntake(rawOrder);
      expect(result.lines[0].product_id).toBeNull();
      expect(result.lines[0].product_group_code).toBe('9.9');
    });

    it('respects skipClientLookup option to delegate SKU resolution to PostgreSQL LATERAL join', async () => {
      const resolveMock = vi.fn().mockResolvedValue({ id: 9999, code: 'A00034988', supplier_name: 'Ambiant' });
      const bulkService = new OrderIntakeService({
        classificationService,
        resolveProductByCode: resolveMock,
        skipClientLookup: true,
      });

      const rawOrder: RawLogicTradeOrderInput = {
        id: 'V26001009',
        order_number: 'V26001009',
        customer_name: 'Bulk Klant',
        lines: [
          {
            line_number: 1,
            product_code: 'A00034988',
            description: 'Duette 32mm Smartcord',
            quantity: 1,
            unit_price_cents: 35000,
            total_price_cents: 35000,
          },
        ],
      };

      const result = await bulkService.processOrderIntake(rawOrder);
      expect(resolveMock).not.toHaveBeenCalled();
      expect(result.lines[0].product_id).toBeNull(); // Client laat product_id over aan SQL LATERAL
    });
  });

  describe('CPQ Hybride Regelsplitsing (Omzetbescherming)', () => {
    it('splits hybrid line (material incl. service) into main item and 0€ derived service line', async () => {
      const rawOrder: RawLogicTradeOrderInput = {
        id: 'V26001003',
        order_number: 'V26001003',
        customer_name: 'Klant C',
        lines: [
          {
            line_number: 1,
            product_code: 'PVC_AMB_01',
            description: 'Click PVC Ambiant incl. leggen',
            quantity: 1,
            unit: 'm2',
            unit_price_cents: 250000,
            total_price_cents: 250000,
            is_hybrid: true,
          },
        ],
      };

      const result = await service.processOrderIntake(rawOrder);
      expect(result.lines.length).toBe(2);

      // Hoofdregel: sub_line = 0
      const mainLine = result.lines.find((l) => l.line_number === 1 && l.sub_line === 0);
      expect(mainLine).toBeDefined();
      expect(mainLine!.unit_price_cents).toBe(250000);
      expect(mainLine!.total_price_cents).toBe(250000);
      expect(mainLine!.is_inbegrepen).toBe(false);

      // Afgeleide serviceregel: sub_line = 1
      const serviceLine = result.lines.find((l) => l.line_number === 1 && l.sub_line === 1);
      expect(serviceLine).toBeDefined();
      expect(serviceLine!.unit_price_cents).toBe(0);
      expect(serviceLine!.total_price_cents).toBe(0);
      expect(serviceLine!.is_inbegrepen).toBe(true);
      expect(serviceLine!.product_group_code).toBe('6.3'); // Vloer legservice

      // Totaal orderbedrag moet exact gelijk blijven aan € 2.500,00 (geen omzetverdubbeling)
      const calculatedSum = result.lines.reduce((acc, l) => acc + l.total_price_cents, 0);
      expect(calculatedSum).toBe(250000);
      expect(result.order.total_amount_cents).toBe(250000);
    });
  });

  describe('SSOT Transformation & FSM Stage Assignment (mapLogicTradeOrderToRawInput)', () => {
    it('maps an OFFERTE to FSM stage 2 (2. Offerte) and preserves free-text lines as TEKST', () => {
      const ltHeader = {
        id: '10999',
        orderNumber: 'O2026-0042',
        status: 'OFFERTE',
        createdDate: '2026-11-10T14:30:00Z',
        totalAmount: 1250.50,
      };

      const ltLines = [
        {
          id: 501,
          articleCode: 'A00034988',
          articleDescription: 'Duette gordijn',
          quantity: 2,
          partPrice: 300.25,
          linePrice: 600.50,
        },
        {
          id: 502,
          // Geen articleCode -> vrije tekst
          articleDescription: 'Inmeten en bezorgen ter plaatse',
          quantity: 1,
          partPrice: 650.00,
          linePrice: 650.00,
        },
      ];

      const rawInput = mapLogicTradeOrderToRawInput(ltHeader, ltLines);

      expect(rawInput.order_number).toBe('O2026-0042');
      expect(rawInput.status).toBe('OFFERTE');
      expect(rawInput.fsm_step).toBe(2);
      expect(rawInput.fsm_phase).toBe('2. Offerte');
      expect(rawInput.total_amount_cents).toBe(125050);

      expect(rawInput.lines).toHaveLength(2);
      expect(rawInput.lines[0].product_code).toBe('A00034988');
      expect(rawInput.lines[0].unit_price_cents).toBe(30025);
      expect(rawInput.lines[0].total_price_cents).toBe(60050);

      // Tweede regel is vrije tekst:
      expect(rawInput.lines[1].product_code).toBe('TEKST');
      expect(rawInput.lines[1].description).toBe('Inmeten en bezorgen ter plaatse');
      expect(rawInput.lines[1].unit_price_cents).toBe(65000);
      expect(rawInput.lines[1].total_price_cents).toBe(65000);
      expect(rawInput.lines[1].line_number).toBe(20);
    });

    it('maps a confirmed ORDER to FSM stage 5 (5. Bestellen / Besteld)', () => {
      const ltHeader = {
        id: '20001',
        orderNumber: 'V26001999',
        status: 'ORDER',
        createdDate: '2026-11-10T15:00:00Z',
        totalAmount: 500.00,
      };

      const ltLines = [
        {
          id: 601,
          articleCode: 'PVC_AMB_01',
          articleDescription: 'PVC Ambiant',
          quantity: 1,
          linePrice: 500.00,
        },
      ];

      const rawInput = mapLogicTradeOrderToRawInput(ltHeader, ltLines);
      expect(rawInput.order_number).toBe('V26001999');
      expect(rawInput.fsm_step).toBe(5);
      expect(rawInput.fsm_phase).toBe('5. Bestellen (Actueel)');
    });
  });

  describe('Quote to Order Mapping Parity', () => {
    it('maps quote header from /quotes with number, date, and customer.address.city to FSM step 2', () => {
      const quotePayload = {
        id: 117238,
        number: 'O26001433',
        date: '2026-05-14T10:00:00Z',
        status: 'OFFERTE',
        totalAmount: 1450.50,
        customer: {
          id: 4001,
          name: 'Klant De Vries',
          address: { city: 'Amersfoort' },
        },
      };

      const quoteLines = [
        {
          id: 9001,
          code: 'A00034988',
          description: 'Duette Shade 32mm',
          quantity: 2,
          partPrice: 350.00,
          linePrice: 700.00,
        },
      ];

      const rawInput = mapLogicTradeOrderToRawInput(quotePayload, quoteLines, { isQuote: true });

      expect(rawInput.id).toBe('O26001433'); // ID namespace isolatie
      expect(rawInput.order_number).toBe('O26001433');
      expect(rawInput.quotation_number).toBe('O26001433');
      expect(rawInput.order_date).toBe('2026-05-14');
      expect(rawInput.city).toBe('Amersfoort');
      expect(rawInput.customer_name).toBe('Klant De Vries');
      expect(rawInput.fsm_step).toBe(2);
      expect(rawInput.fsm_phase).toBe('2. Offerte');
      expect(rawInput.total_amount_cents).toBe(145050);
      expect(rawInput.lines).toHaveLength(1);
      expect(rawInput.lines[0].product_code).toBe('A00034988');
    });

    it('isolates quote ID namespace so that an order and quote with identical numeric id (e.g. 117238) never collide', () => {
      const orderPayload = {
        id: 117238,
        orderNumber: '117238',
        status: 'ORDER',
        createdDate: '2026-05-10T12:00:00Z',
      };

      const quotePayload = {
        id: 117238,
        number: 'O26001433',
        date: '2026-05-14T10:00:00Z',
        status: 'OFFERTE',
      };

      const orderInput = mapLogicTradeOrderToRawInput(orderPayload, []);
      const quoteInput = mapLogicTradeOrderToRawInput(quotePayload, [], { isQuote: true });

      // Verifieer dat de IDs in Supabase nooit met elkaar botsen:
      expect(orderInput.id).toBe('117238');
      expect(quoteInput.id).toBe('O26001433');
      expect(orderInput.id).not.toBe(quoteInput.id);
      expect(orderInput.order_number).not.toBe(quoteInput.order_number);
    });

    it('correctly assigns fsm_step 2 even when status is Concept and number lacks O prefix when isQuote: true', () => {
      const quotePayload = {
        id: 9999,
        number: '10442', // Numeriek nummer zonder O prefix
        status: 'Concept',
      };

      const rawInput = mapLogicTradeOrderToRawInput(quotePayload, [], { isQuote: true });
      expect(rawInput.fsm_step).toBe(2);
      expect(rawInput.fsm_phase).toBe('2. Offerte');
      expect(rawInput.id).toBe('10442');
    });

    it('maps external_line_id, base_total_price_cents, and dual-state dimension specs in mapLogicTradeOrderToRawInput', () => {
      const orderPayload = {
        id: 'V26001005',
        orderNumber: 'V26001005',
      };
      const linesPayload = [
        {
          id: 554433,
          code: 'A00034988',
          description: 'Duette Shade',
          quantity: 1,
          partPrice: 120.00,
          linePrice: 120.00,
          base_total_price_cents: 12000,
          is_inbegrepen: false,
          erp_dimension_spec: { type: 'window_2d', widthMm: 1200, heightMm: 2000 },
        },
      ];

      const rawInput = mapLogicTradeOrderToRawInput(orderPayload, linesPayload);
      expect(rawInput.lines).toHaveLength(1);
      expect(rawInput.lines[0].external_line_id).toBe('554433');
      expect(rawInput.lines[0].base_total_price_cents).toBe(12000);
      expect(rawInput.lines[0].is_inbegrepen).toBe(false);
      expect(rawInput.lines[0].erp_dimension_spec).toEqual({ type: 'window_2d', widthMm: 1200, heightMm: 2000 });
    });

    it('propagates external_line_id and base_total_price_cents across splitHybridOrderLine', async () => {
      const hybridLine = {
        line_number: 10,
        external_line_id: 'EXT_7788',
        product_code: 'A00034988',
        description: 'Duette inclusief montage',
        quantity: 2,
        unit: 'stuks',
        unit_price_cents: 25000,
        total_price_cents: 50000,
        base_total_price_cents: 50000,
        dimension_spec: { type: 'window_2d', widthMm: 1000, heightMm: 1500 },
      };

      const result = await service.splitHybridOrderLine(hybridLine, 1002, '2.4');
      expect(result).toHaveLength(2);

      // Subline 0 (Hoofdregel):
      expect(result[0].sub_line).toBe(0);
      expect(result[0].external_line_id).toBe('EXT_7788');
      expect(result[0].base_total_price_cents).toBe(50000);
      expect(result[0].total_price_cents).toBe(50000);
      expect(result[0].is_inbegrepen).toBe(false);
      expect(result[0].erp_dimension_spec).toEqual({ type: 'window_2d', widthMm: 1000, heightMm: 1500 });

      // Subline 1 (Afgeleide Serviceregel):
      expect(result[1].sub_line).toBe(1);
      expect(result[1].external_line_id).toBe('EXT_7788'); // Behoudt parent id ter reconciliatie
      expect(result[1].base_total_price_cents).toBe(0);
      expect(result[1].total_price_cents).toBe(0);
      expect(result[1].is_inbegrepen).toBe(true);
    });
  });
});
