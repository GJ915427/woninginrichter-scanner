import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OrderIntakeService,
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
});
