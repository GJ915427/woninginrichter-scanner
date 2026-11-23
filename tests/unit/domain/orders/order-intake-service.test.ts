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

    // [SPEC-CHANGE-AUTHORIZED: Sub-Phase 3B Configuration Spec Ingest Coverage]
    it('maps widthMm, heightMm, options, and configurationJson and attaches configuration_spec', async () => {
      const orderPayload = {
        id: 119999,
        orderNumber: 'V26009999',
        status: 'ORDER',
      };
      const linePayloads = [
        {
          lineNumber: 10,
          articleCode: 'A00034988',
          articleDescription: 'Duette 32mm Smartcord',
          widthMm: 2400,
          heightMm: 1800,
          options: ['SmartCord', 'Top-Down'],
        },
      ];

      const rawInput = mapLogicTradeOrderToRawInput(orderPayload, linePayloads);
      expect(rawInput.lines[0].width_mm).toBe(2400);
      expect(rawInput.lines[0].height_mm).toBe(1800);
      expect(rawInput.lines[0].options).toEqual(['SmartCord', 'Top-Down']);

      const ingested = await service.processOrderIntake(rawInput);
      expect(ingested.lines[0].configuration_spec).toBeDefined();
      expect(ingested.lines[0].configuration_spec?.source).toBe('erp_fields');
      expect(ingested.lines[0].configuration_spec?.dimensions?.width_mm).toBe(2400);
      expect(ingested.lines[0].dim).toBe('2400 × 1800');
    });

    // [SPEC-CHANGE-AUTHORIZED: Tranche 2 TDD suite voor gecombineerde notities, 'V'-order FSM behoud, afgeleide dim, en retail discipline gating]
    it('Tranche 2: voegt comment.extern en comment.intern causaal samen met newline', () => {
      const orderPayload = { id: 120001, orderNumber: 'V26001234', status: 'ORDER' };
      const linePayloads = [
        {
          lineNumber: 10,
          description: 'Gordijn op maat',
          comment: {
            extern: 'Klantinstructie: 10 mm vrijhouden van vloer',
            intern: 'Let op: moeilijke bereikbaarheid etage 3',
          },
        },
      ];

      const rawInput = mapLogicTradeOrderToRawInput(orderPayload, linePayloads);
      expect(rawInput.lines[0].notes).toBe(
        'Klantinstructie: 10 mm vrijhouden van vloer\nLet op: moeilijke bereikbaarheid etage 3'
      );
    });

    it('Tranche 2: behoudt verkoopordernummer V22002580, database id 87552 en fsm_step 5 bij header.number', () => {
      const orderPayload = {
        id: 87552,
        number: 'V22002580',
        orderNumber: null,
        status: 'ORDER',
      };
      const linePayloads = [{ lineNumber: 10, description: 'Gordijnen' }];

      const rawInput = mapLogicTradeOrderToRawInput(orderPayload, linePayloads);
      expect(rawInput.order_number).toBe('V22002580');
      expect(rawInput.id).toBe('87552');
      expect(rawInput.fsm_step).toBe(5);
      expect(rawInput.fsm_phase).toBe('5. Verkooporder');
    });

    it('Tranche 2: leidt dim af voor alle artikelen met maten maar houdt retail meubels op configuration_spec = null', async () => {
      const orderPayload = { id: 120002, orderNumber: 'V26001235', status: 'ORDER' };
      const linePayloads = [
        {
          lineNumber: 10,
          productCode: 'MEUBEL_01',
          description: 'Salontafel 70x90 cm Maitre',
          widthMm: 700,
          heightMm: 900,
          configuration: {
            id: 1122,
            items: ['Eiken blad', 'Zwart stalen onderstel'],
          },
        },
      ];

      const rawInput = mapLogicTradeOrderToRawInput(orderPayload, linePayloads);
      const ingested = await service.processOrderIntake(rawInput);
      const line = ingested.lines[0];

      expect(line.dim).toBe('700 × 900');
      expect(line.configuration_spec).toBeNull();
    });

    it('Tranche 2: splitHybridOrderLine propageert assignedConfigSpec naar sub_line 0 en null naar sub_line 1', async () => {
      const orderPayload = { id: 120003, orderNumber: 'V26001236', status: 'ORDER' };
      const linePayloads = [
        {
          lineNumber: 20,
          productCode: 'A00034988',
          description: 'Duette 32mm Smartcord incl. montage',
          widthMm: 1500,
          heightMm: 2000,
        },
      ];

      const rawInput = mapLogicTradeOrderToRawInput(orderPayload, linePayloads);
      const ingested = await service.processOrderIntake(rawInput);

      expect(ingested.lines.length).toBe(2);
      const matLine = ingested.lines[0];
      const servLine = ingested.lines[1];

      expect(matLine.sub_line).toBe(0);
      expect(matLine.configuration_spec).toBeDefined();
      expect(matLine.configuration_spec?.dimensions?.width_mm).toBe(1500);

      expect(servLine.sub_line).toBe(1);
      expect(servLine.configuration_spec).toBeNull();
    });
  });

  describe('[SPEC-CHANGE-AUTHORIZED: Pariteitstest voor ruimtelijke extractie en dienstenroutering] 3-Stream Routing & Spatial Extraction Parity', () => {
    it('Stream A: routes project services (group 6.6 or general costs) to pos_project_algemeen with null floor and room', async () => {
      const rawOrder: RawLogicTradeOrderInput = {
        id: 'V26001010',
        order_number: 'V26001010',
        lines: [
          {
            line_number: 1,
            product_code: 'INMEET',
            description: 'Inmeetservice GSW ter plaatse',
            quantity: 1,
            unit_price_cents: 9500,
            total_price_cents: 9500,
          },
        ],
      };

      const result = await service.processOrderIntake(rawOrder);
      expect(result.lines).toHaveLength(1);
      const line = result.lines[0];
      expect(line.position_id).toBe('pos_project_algemeen');
      expect(line.etage_name).toBeNull();
      expect(line.room_name).toBeNull();
      expect(line.window_name).toBeNull();
    });

    it('Stream B: extracts spatial coordinates and infers floor and canonical position from notes', async () => {
      const rawOrder: RawLogicTradeOrderInput = {
        id: 'V26001011',
        order_number: 'V26001011',
        lines: [
          {
            line_number: 1,
            product_code: 'A00034988',
            description: 'Duette gordijn',
            notes: '- Keuken raam links',
            quantity: 1,
            unit_price_cents: 35000,
            total_price_cents: 35000,
          },
        ],
      };

      const result = await service.processOrderIntake(rawOrder);
      expect(result.lines).toHaveLength(1);
      const line = result.lines[0];
      expect(line.room_name).toBe('Keuken');
      expect(line.room_source).toBe('EXPLICIT');
      expect(line.window_name).toBe('Raam links');
      expect(line.pos_source).toBe('EXPLICIT');
      expect(line.etage_name).toBe('Begane grond');
      expect(line.etage_source).toBe('INFERRED');
      expect(line.spatial_metadata).toBeDefined();
      expect(line.spatial_metadata?.room_name).toBe('Keuken');
    });

    it('Stream B: assigns discrete buffer positions for materials with empty notes to prevent cell clobbering', async () => {
      const rawOrder: RawLogicTradeOrderInput = {
        id: 'V26001012',
        order_number: 'V26001012',
        lines: [
          {
            line_number: 1,
            product_code: 'A00034988',
            description: 'Duette stof 1',
            quantity: 1,
            unit_price_cents: 20000,
            total_price_cents: 20000,
          },
          {
            line_number: 2,
            product_code: 'A00034988',
            description: 'Duette stof 2',
            quantity: 1,
            unit_price_cents: 25000,
            total_price_cents: 25000,
          },
        ],
      };

      const result = await service.processOrderIntake(rawOrder);
      expect(result.lines).toHaveLength(2);
      expect(result.lines[0].position_id).toBe('pos_onbekend_1');
      expect(result.lines[1].position_id).toBe('pos_onbekend_2');
      expect(result.lines[0].window_name).toBe('Pos. N.t.b.');
      expect(result.lines[1].window_name).toBe('Pos. N.t.b.');
      expect(result.lines[0].etage_name).toBeNull();
      expect(result.lines[1].etage_name).toBeNull();
    });

    it('Stream C: hybrid service line inherits spatial coordinates and provenance exactly from material parent', async () => {
      const rawOrder: RawLogicTradeOrderInput = {
        id: 'V26001013',
        order_number: 'V26001013',
        lines: [
          {
            line_number: 1,
            product_code: 'A00034988',
            description: 'Duette 32mm incl montage',
            notes: '- Woonkamer raam voorzijde',
            quantity: 1,
            unit_price_cents: 45000,
            total_price_cents: 45000,
            is_hybrid: true,
          },
        ],
      };

      const result = await service.processOrderIntake(rawOrder);
      expect(result.lines).toHaveLength(2);
      const matLine = result.lines[0];
      const servLine = result.lines[1];

      expect(matLine.sub_line).toBe(0);
      expect(servLine.sub_line).toBe(1);

      expect(servLine.room_name).toBe(matLine.room_name);
      expect(servLine.room_name).toBe('Woonkamer');
      expect(servLine.etage_name).toBe(matLine.etage_name);
      expect(servLine.etage_name).toBe('Begane grond');
      expect(servLine.window_name).toBe(matLine.window_name);
      expect(servLine.position_id).toBe(matLine.position_id);
      expect(servLine.spatial_metadata).toEqual(matLine.spatial_metadata);
    });

    it('mapLogicTradeOrderToRawInput preserves null etage_name and does not force Begane grond', () => {
      const header = { id: 101, orderNumber: 'V26001014', status: 'ORDER' };
      const lines = [
        { lineNumber: 10, description: 'Artikel zonder etage' },
      ];

      const raw = mapLogicTradeOrderToRawInput(header, lines);
      expect(raw.lines[0].etage_name).toBeNull();
    });
  });
});
