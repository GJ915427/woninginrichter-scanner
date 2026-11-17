import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OrderIntakeService,
  mapLogicTradeOrderToRawInput,
  type RawLogicTradeOrderInput,
  type IngestedOrderBundle,
} from '@/domain/orders/order-intake-service';
import { ClassificationService } from '@/domain/classification/central-classification-service';
import { mapProductToRow, type LogicTradeProductRaw } from '@/lib/logictrade/sync-service';

describe('Order Raw Parity & Bronze Layer SSOT (INV-RAW-IMMUTABILITY-01)', () => {
  let service: OrderIntakeService;
  let classificationService: ClassificationService;

  beforeEach(() => {
    classificationService = new ClassificationService();
    classificationService.registerMasterProduct('A00034988', '2.4');
    classificationService.registerMasterProduct('PVC_HYBRID', '3.1');

    service = new OrderIntakeService({
      classificationService,
      resolveProductByCode: vi.fn().mockImplementation(async (code: string) => {
        if (code === 'A00034988') {
          return { id: 1002, code: 'A00034988', supplier_name: 'Luxaflex' };
        }
        if (code === 'PVC_HYBRID') {
          return { id: 1003, code: 'PVC_HYBRID', supplier_name: 'Ambiant' };
        }
        return null;
      }),
    });
  });

  describe('mapLogicTradeOrderToRawInput 1-op-1 Bronze Extraction', () => {
    it('behoudt alle Decoloop configurator velden en ERP velden onder lt_* en aliassen', () => {
      const mockRawPayload = {
        id: '12345',
        number: 'V26001376',
        customerName: 'Fam. De Vries',
        city: 'Amsterdam',
        lines: [
          {
            id: 182331,
            lineNumber: 10,
            productCode: 'A00034988',
            description: 'Silhouette 50 mm',
            quantity: 2,
            unit: 'stuks',
            grossPrice: 350,
            partPrice: 350,
            totalGrossPrice: 700,
            totalPrice: 700,
            basePartPrice: 280,
            discount: 5.5,
            vat: { code: 'H', percentage: 21 },
            stockStatus: 'complete',
            deliveryStatus: 'none',
            invoiceStatus: 'none',
            reservations: [{ number: 'I24002805', lineNumber: 1 }],
            comment: {
              extern: 'Slaapkamer raam links',
              intern: 'Interne productienotitie',
            },
            supplierName: 'Luxaflex',
            supplierCode: 'LUX-001',
            widthMm: 1070,
            heightMm: 1480,
            options: [
              { key: 'COLOR', value: 'RAL 9010', description: 'Wit lak', surcharge: 0 },
            ],
            configuration: {
              items: ['Silhouette 50 mm', 'Blijvende maat: 1070 mm', 'Hoogte: 1480 mm'],
            },
            configurationJson: {
              wizardVersion: '2.1',
              parameters: { fabric: 'Linen Light', cord: 'Smartcord rechts' },
            },
          },
        ],
      };

      const mapped = mapLogicTradeOrderToRawInput(mockRawPayload);

      expect(mapped.id).toBe('12345');
      expect(mapped.order_number).toBe('V26001376');
      expect(mapped.lt_id).toBe('12345');
      expect(mapped.lt_raw_data).toEqual(mockRawPayload);
      expect(mapped.lines).toHaveLength(1);

      const line = mapped.lines[0];
      // 1-op-1 Bronze pariteit
      expect(line.lt_id).toBe('182331');
      expect(line.lt_raw_data).toEqual(mockRawPayload.lines[0]);
      expect(line.lt_comment_extern).toBe('Slaapkamer raam links');
      expect(line.lt_comment_intern).toBe('Interne productienotitie');
      expect(line.lt_supplier_name).toBe('Luxaflex');
      expect(line.lt_supplier_code).toBe('LUX-001');
      expect(line.lt_width_mm).toBe(1070);
      expect(line.lt_height_mm).toBe(1480);
      expect(line.lt_options).toEqual([
        { key: 'COLOR', value: 'RAL 9010', description: 'Wit lak', surcharge: 0 },
      ]);
      expect(line.lt_configuration).toEqual({
        items: ['Silhouette 50 mm', 'Blijvende maat: 1070 mm', 'Hoogte: 1480 mm'],
      });
      expect(line.lt_configuration_json).toEqual({
        wizardVersion: '2.1',
        parameters: { fabric: 'Linen Light', cord: 'Smartcord rechts' },
      });
      expect(line.lt_vat_code).toBe('H');
      expect(line.lt_vat_percentage).toBe(21);
      expect(line.lt_discount_percentage).toBe(5.5);
      expect(line.lt_base_price_cents).toBe(28000);
      expect(line.lt_reservations).toEqual([{ number: 'I24002805', lineNumber: 1 }]);
      expect(line.lt_stock_status).toBe('complete');
      expect(line.lt_delivery_status).toBe('none');
      expect(line.lt_invoice_status).toBe('none');

      // Backwards-compatible aliassen
      expect(line.external_line_id).toBe('182331');
      expect(line.comment_extern).toBe('Slaapkamer raam links');
      expect(line.comment_intern).toBe('Interne productienotitie');
      expect(line.raw_data).toEqual(mockRawPayload.lines[0]);
      expect(line.vat_code).toBe('H');
      expect(line.vat_percentage).toBe(21);
      expect(line.discount_percentage).toBe(5.5);
      expect(line.base_price_cents).toBe(28000);
      expect(line.reservations).toEqual([{ number: 'I24002805', lineNumber: 1 }]);
      expect(line.stock_status).toBe('complete');
      expect(line.delivery_status).toBe('none');
      expect(line.invoice_status).toBe('none');
    });

    it('behandelt string-only commentaar en alternatieve discount formaten robuust', () => {
      const mockRawPayload = {
        id: 'ORDER-999',
        lines: [
          {
            lineNumber: 10,
            productCode: 'A00034988',
            description: 'Test regel',
            quantity: 1,
            partPrice: 100,
            discountPercentage: 10,
            vatCode: 'L',
            vatPercentage: 9,
            comment: 'Alleen een externe string notitie',
          },
        ],
      };

      const mapped = mapLogicTradeOrderToRawInput(mockRawPayload);
      const line = mapped.lines[0];

      expect(line.lt_comment_extern).toBe('Alleen een externe string notitie');
      expect(line.lt_comment_intern).toBeNull();
      expect(line.comment_extern).toBe('Alleen een externe string notitie');
      expect(line.comment_intern).toBeNull();
      expect(line.lt_discount_percentage).toBe(10);
      expect(line.lt_vat_code).toBe('L');
      expect(line.lt_vat_percentage).toBe(9);
    });
  });

  describe('processOrderIntake & splitHybridOrderLine contracten', () => {
    it('behoudt Bronze pariteit bij standard order intake verwerking', async () => {
      const rawOrder: RawLogicTradeOrderInput = {
        id: 'V26001376',
        order_number: 'V26001376',
        customer_name: 'Fam. De Vries',
        lt_raw_data: { original: true },
        lt_id: '12345',
        lines: [
          {
            line_number: 10,
            product_code: 'A00034988',
            description: 'Silhouette 50 mm',
            quantity: 1,
            unit: 'stuks',
            unit_price_cents: 35000,
            total_price_cents: 35000,
            lt_raw_data: { rawLine: true },
            lt_id: '182331',
            lt_comment_extern: 'Extern comment',
            lt_comment_intern: 'Intern comment',
            lt_vat_code: 'H',
            lt_vat_percentage: 21,
            lt_discount_percentage: 5.5,
            lt_base_price_cents: 28000,
            lt_reservations: [{ number: 'I100', lineNumber: 1 }],
            lt_stock_status: 'complete',
            lt_delivery_status: 'none',
            lt_invoice_status: 'none',
            lt_width_mm: 1070,
            lt_height_mm: 1480,
            lt_supplier_name: 'Luxaflex',
            lt_supplier_code: 'LUX-001',
          },
        ],
      };

      const result: IngestedOrderBundle = await service.processOrderIntake(rawOrder);
      expect(result.order.lt_raw_data).toEqual({ original: true });
      expect(result.order.lt_id).toBe('12345');

      const line = result.lines[0];
      expect(line.lt_raw_data).toEqual({ rawLine: true });
      expect(line.lt_id).toBe('182331');
      expect(line.lt_comment_extern).toBe('Extern comment');
      expect(line.lt_comment_intern).toBe('Intern comment');
      expect(line.lt_vat_code).toBe('H');
      expect(line.lt_vat_percentage).toBe(21);
      expect(line.lt_discount_percentage).toBe(5.5);
      expect(line.lt_base_price_cents).toBe(28000);
      expect(line.lt_reservations).toEqual([{ number: 'I100', lineNumber: 1 }]);
      expect(line.lt_stock_status).toBe('complete');
      expect(line.lt_delivery_status).toBe('none');
      expect(line.lt_invoice_status).toBe('none');
      expect(line.lt_width_mm).toBe(1070);
      expect(line.lt_height_mm).toBe(1480);
      expect(line.lt_supplier_name).toBe('Luxaflex');
      expect(line.lt_supplier_code).toBe('LUX-001');
    });

    it('handhaaft INV-RAW-IMMUTABILITY-01 bij splitHybridOrderLine (sub_line 1 heeft lt_raw_data: null)', async () => {
      const rawOrder: RawLogicTradeOrderInput = {
        id: 'V26001377',
        order_number: 'V26001377',
        lines: [
          {
            line_number: 10,
            product_code: 'PVC_HYBRID',
            description: 'Ambiant PVC incl. Egaliseren en leggen',
            quantity: 20,
            unit: 'm2',
            unit_price_cents: 6500,
            total_price_cents: 130000,
            lt_raw_data: { rawHybridLine: true },
            lt_id: '999888',
            lt_comment_extern: 'Woonkamer',
            lt_comment_intern: 'Lijmtype X',
            lt_vat_code: 'H',
            lt_vat_percentage: 21,
            lt_discount_percentage: 0,
            lt_base_price_cents: 4500,
            lt_reservations: [],
            lt_width_mm: 5000,
            lt_height_mm: 4000,
            lt_supplier_name: 'Ambiant',
          },
        ],
      };

      const result: IngestedOrderBundle = await service.processOrderIntake(rawOrder);
      expect(result.lines).toHaveLength(2);

      const mainLine = result.lines.find((l) => l.sub_line === 0)!;
      const serviceLine = result.lines.find((l) => l.sub_line === 1)!;

      // mainLine behoudt alle ruwe brondata
      expect(mainLine.lt_raw_data).toEqual({ rawHybridLine: true });
      expect(mainLine.lt_id).toBe('999888');
      expect(mainLine.lt_comment_extern).toBe('Woonkamer');
      expect(mainLine.lt_width_mm).toBe(5000);
      expect(mainLine.lt_height_mm).toBe(4000);
      expect(mainLine.lt_supplier_name).toBe('Ambiant');

      // serviceLine heeft conform INV-RAW-IMMUTABILITY-01 GEEN gefabriceerde brondata
      expect(serviceLine.lt_raw_data).toBeNull();
      expect(serviceLine.raw_data).toBeNull();
      expect(serviceLine.lt_configuration_json).toBeNull();
      expect(serviceLine.lt_configuration).toBeNull();
      expect(serviceLine.lt_width_mm).toBeNull();
      expect(serviceLine.lt_height_mm).toBeNull();
      expect(serviceLine.lt_options).toBeNull();
      expect(serviceLine.lt_supplier_name).toBeNull();
      expect(serviceLine.lt_supplier_code).toBeNull();
      expect(serviceLine.lt_id).toBe('999888.service');
      expect(serviceLine.external_line_id).toBe('999888.service');
      expect(serviceLine.lt_comment_extern).toBeNull();
      expect(serviceLine.lt_comment_intern).toBeNull();
      expect(serviceLine.lt_base_price_cents).toBe(0);
      expect(serviceLine.lt_discount_percentage).toBeNull();
      expect(serviceLine.lt_reservations).toEqual([]);
      expect(serviceLine.lt_stock_status).toBeNull();
      expect(serviceLine.lt_delivery_status).toBeNull();
      expect(serviceLine.lt_invoice_status).toBeNull();
    });
  });

  describe('mapProductToRow Catalogus Sync Pariteit', () => {
    it('slaat product synchroon op in zowel raw_data als lt_raw_data', () => {
      const mockProduct: LogicTradeProductRaw = {
        id: 501,
        code: 'ART-501',
        name: 'PVC Vloer Visgraat',
        description: 'Mooie vloer',
        salesPrice: 49.95,
        unit: 'm2',
        supplier: {
          supplier: { id: 20, companyName: 'Moduleo' },
          code: 'MOD-01',
        },
        groups: [{ description: 'Vloeren' }],
        salesGroup: { description: 'PVC' },
        vat: { code: 'H' },
      };

      const row = mapProductToRow(mockProduct);

      expect(row.code).toBe('ART-501');
      expect(row.raw_data).toEqual(mockProduct);
      expect(row.lt_raw_data).toEqual(mockProduct);
    });
  });
});
