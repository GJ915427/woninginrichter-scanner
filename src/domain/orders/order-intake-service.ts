/**
 * src/domain/orders/order-intake-service.ts
 *
 * Single Source of Truth (SSOT) voor Order Intake, JIT SKU Disambiguatie
 * en CPQ Hybride Regelsplitsing (Omzetbescherming).
 */

import { ClassificationService } from '@/domain/classification/central-classification-service';
import {
  detectIsMaterialAndService,
  detectServiceDiscipline,
  SERVICE_DISCIPLINE_TO_PRODUCT_GROUP,
} from '@/domain/search/v2/cognitive-typology-classifier';
import type {
  RawLogicTradeOrderInput,
  RawOrderLineInput,
  IngestedOrderBundle,
  IngestedOrderLine,
  IngestedOrderHeader,
  ResolvedProductEntity,
} from '@/types/order-intake';
import { resolveProductByCode as defaultResolveProductByCode } from '@/lib/supabase/order-client';

export interface OrderIntakeServiceOptions {
  classificationService?: ClassificationService;
  resolveProductByCode?: (code: string, supplierName?: string) => Promise<ResolvedProductEntity | null>;
}

export class OrderIntakeService {
  private classificationService: ClassificationService;
  private resolveProductByCode: (code: string, supplierName?: string) => Promise<ResolvedProductEntity | null>;

  constructor(options: OrderIntakeServiceOptions = {}) {
    this.classificationService = options.classificationService || new ClassificationService();
    this.resolveProductByCode = options.resolveProductByCode || defaultResolveProductByCode;
  }

  public async processOrderIntake(rawOrder: RawLogicTradeOrderInput): Promise<IngestedOrderBundle> {
    const ingestedLines: IngestedOrderLine[] = [];
    let orderTotalCents = 0;

    for (const rawLine of rawOrder.lines || []) {
      const splitLines = await this.processSingleLine(rawLine);
      for (const line of splitLines) {
        ingestedLines.push(line);
        orderTotalCents += line.total_price_cents;
      }
    }

    const orderHeader: IngestedOrderHeader = {
      id: rawOrder.id,
      order_number: rawOrder.order_number,
      customer_name: rawOrder.customer_name || 'Onbekende Klant',
      city: rawOrder.city,
      quotation_number: rawOrder.quotation_number,
      order_date: rawOrder.order_date,
      sales_rep: rawOrder.sales_rep,
      branch: rawOrder.branch,
      fsm_phase: rawOrder.fsm_phase || '5. Bestellen (Actueel)',
      fsm_step: rawOrder.fsm_step !== undefined ? rawOrder.fsm_step : 5,
      scope_description: rawOrder.scope_description,
      total_amount_cents: rawOrder.total_amount_cents !== undefined ? rawOrder.total_amount_cents : orderTotalCents,
      status: rawOrder.status || 'draft',
      raw_data: rawOrder.raw_data || {},
    };

    return {
      order: orderHeader,
      lines: ingestedLines,
    };
  }

  public async splitHybridOrderLine(
    line: RawOrderLineInput,
    productId: number | null,
    materialGroupCode: string
  ): Promise<IngestedOrderLine[]> {
    const unitPrice = line.unit_price_cents || 0;
    const totalPrice = line.total_price_cents !== undefined ? line.total_price_cents : unitPrice * (line.quantity || 1);
    const quantity = line.quantity || 1;
    const etage = line.etage_name || 'Begane grond';

    // 1. Hoofdregel (Materiaal): sub_line = 0
    const mainLine: IngestedOrderLine = {
      line_number: line.line_number,
      sub_line: 0,
      product_id: productId,
      product_code: line.product_code || 'TEKST',
      product_group_code: materialGroupCode,
      description: line.description,
      quantity,
      unit: line.unit || 'stuks',
      unit_price_cents: unitPrice,
      total_price_cents: totalPrice,
      is_hybrid: true,
      is_inbegrepen: false,
      etage_name: etage,
      room_name: line.room_name,
      window_name: line.window_name,
      position_id: line.position_id,
      dim: line.dim || null,
      notes: line.notes || null,
      dimension_spec: line.dimension_spec || null,
    };

    // 2. Bepaal afgeleide service discipline
    let serviceGroupCode = '6.9'; // Overige diensten default
    const serviceRes = detectServiceDiscipline(line.description);
    if (serviceRes && serviceRes.discipline) {
      serviceGroupCode = SERVICE_DISCIPLINE_TO_PRODUCT_GROUP[serviceRes.discipline] || '6.9';
    } else {
      // Fallback op basis van materiaal
      if (materialGroupCode.startsWith('3.')) {
        serviceGroupCode = '6.3'; // Vloer legservice
      } else if (materialGroupCode.startsWith('1.')) {
        serviceGroupCode = '6.1'; // Gordijn/rail montage
      } else if (materialGroupCode.startsWith('2.')) {
        serviceGroupCode = '6.2'; // Binnenzonwering montage
      } else if (materialGroupCode.startsWith('5.')) {
        serviceGroupCode = '6.5'; // Buitenzonwering montage
      }
    }

    // 3. Afgeleide Serviceregel: sub_line = 1 (verplicht 0€ & isInbegrepen = true)
    const serviceLine: IngestedOrderLine = {
      line_number: line.line_number,
      sub_line: 1,
      product_id: null,
      product_code: 'SERVICE',
      product_group_code: serviceGroupCode,
      description: `Service / Montage bij ${line.description}`,
      quantity,
      unit: 'stuks',
      unit_price_cents: 0,
      total_price_cents: 0,
      is_hybrid: true,
      is_inbegrepen: true,
      etage_name: etage,
      room_name: line.room_name,
      window_name: line.window_name,
      position_id: line.position_id,
      dim: line.dim || null,
      notes: line.notes || null,
      dimension_spec: line.dimension_spec || null,
    };

    return [mainLine, serviceLine];
  }

  private async processSingleLine(rawLine: RawOrderLineInput): Promise<IngestedOrderLine[]> {
    const code = (rawLine.product_code || '').trim();

    // JIT SKU Resolutie
    let resolvedProduct: ResolvedProductEntity | null = null;
    if (code && code.toUpperCase() !== 'TEKST') {
      resolvedProduct = await this.resolveProductByCode(code);
    }

    // Classificeer regel
    let groupCode = '9.9';
    if (resolvedProduct && resolvedProduct.product_group_code) {
      groupCode = resolvedProduct.product_group_code;
    } else {
      const classRes = await this.classificationService.classifyProduct({
        code: rawLine.product_code,
        name: rawLine.description,
        description: rawLine.description,
      });
      groupCode = classRes.productGroupCode;
    }

    // Is het een hybride regel (materiaal incl. dienst)?
    const isHybrid = rawLine.is_hybrid || detectIsMaterialAndService(rawLine.description);

    if (isHybrid) {
      return this.splitHybridOrderLine(rawLine, resolvedProduct ? resolvedProduct.id : null, groupCode);
    }

    const unitPrice = rawLine.unit_price_cents || 0;
    const totalPrice = rawLine.total_price_cents !== undefined ? rawLine.total_price_cents : unitPrice * (rawLine.quantity || 1);

    const singleLine: IngestedOrderLine = {
      line_number: rawLine.line_number,
      sub_line: 0,
      product_id: resolvedProduct ? resolvedProduct.id : null,
      product_code: rawLine.product_code || 'TEKST',
      product_group_code: groupCode,
      description: rawLine.description,
      quantity: rawLine.quantity || 1,
      unit: rawLine.unit || 'stuks',
      unit_price_cents: unitPrice,
      total_price_cents: totalPrice,
      is_hybrid: false,
      is_inbegrepen: false,
      etage_name: rawLine.etage_name || 'Begane grond',
      room_name: rawLine.room_name,
      window_name: rawLine.window_name,
      position_id: rawLine.position_id,
      dim: rawLine.dim || null,
      notes: rawLine.notes || null,
      dimension_spec: rawLine.dimension_spec || null,
    };

    return [singleLine];
  }
}
