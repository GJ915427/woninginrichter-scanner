/**
 * src/domain/orders/order-intake-service.ts
 *
 * Single Source of Truth (SSOT) voor Order Intake, JIT SKU Disambiguatie,
 * 4-Traps Configuratie Extractie en CPQ Hybride Regelsplitsing (Omzetbescherming).
 */

import { ClassificationService } from '@/domain/classification/central-classification-service';
import {
  detectIsMaterialAndService,
  detectServiceDiscipline,
  SERVICE_DISCIPLINE_TO_PRODUCT_GROUP,
} from '@/domain/search/v2/cognitive-typology-classifier';
import { ConfigurationExtractionEngine } from '@/domain/orders/configuration-extraction-engine';
import type {
  RawLogicTradeOrderInput,
  RawOrderLineInput,
  IngestedOrderBundle,
  IngestedOrderLine,
  IngestedOrderHeader,
  ResolvedProductEntity,
  ICognitiveExtractionProvider,
  ConfigurationSpec,
} from '@/types/order-intake';
import { resolveProductByCode as defaultResolveProductByCode } from '@/lib/supabase/order-client';

// Expliciete Re-exports voor downstream consumenten en testsuites
export type {
  RawLogicTradeOrderInput,
  RawOrderLineInput,
  IngestedOrderBundle,
  IngestedOrderLine,
  IngestedOrderHeader,
  ResolvedProductEntity,
  ConfigurationSpec,
} from '@/types/order-intake';

export interface OrderIntakeServiceOptions {
  classificationService?: ClassificationService;
  resolveProductByCode?: (code: string, supplierName?: string) => Promise<ResolvedProductEntity | null>;
  skipClientLookup?: boolean;
  cognitiveProvider?: ICognitiveExtractionProvider;
}

export class OrderIntakeService {
  private classificationService: ClassificationService;
  private extractionEngine: ConfigurationExtractionEngine;
  private resolveProductByCode: (code: string, supplierName?: string) => Promise<ResolvedProductEntity | null>;
  private skipClientLookup: boolean;

  constructor(options: OrderIntakeServiceOptions = {}) {
    this.classificationService = options.classificationService || new ClassificationService();
    this.extractionEngine = new ConfigurationExtractionEngine({
      cognitiveProvider: options.cognitiveProvider,
    });
    this.resolveProductByCode = options.resolveProductByCode || defaultResolveProductByCode;
    this.skipClientLookup = !!options.skipClientLookup;
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
      lt_raw_data: rawOrder.lt_raw_data || rawOrder.raw_data || null,
      lt_id: rawOrder.lt_id || rawOrder.id,
    };

    return {
      order: orderHeader,
      lines: ingestedLines,
    };
  }

  public async splitHybridOrderLine(
    line: RawOrderLineInput,
    productId: number | null,
    materialGroupCode: string,
    configSpec?: ConfigurationSpec | null,
    serviceDisciplineCode?: string
  ): Promise<IngestedOrderLine[]> {
    const unitPrice = line.unit_price_cents || 0;
    const totalPrice = line.total_price_cents !== undefined ? line.total_price_cents : unitPrice * (line.quantity || 1);
    const quantity = line.quantity || 1;
    const etage = line.etage_name || 'Begane grond';

    const derivedDim =
      line.dim ||
      (configSpec?.dimensions?.width_mm && configSpec?.dimensions?.height_mm
        ? `${configSpec.dimensions.width_mm} × ${configSpec.dimensions.height_mm}`
        : null);

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
      dim: derivedDim,
      notes: line.notes || null,
      dimension_spec: line.dimension_spec || null,
      configuration_spec: configSpec || null,
      // Bronze Layer velden:
      lt_raw_data: line.lt_raw_data || line.raw_data || null,
      lt_id: line.lt_id || line.external_line_id || null,
      lt_configuration_json: line.lt_configuration_json || line.configuration_json || null,
      lt_configuration: line.lt_configuration || line.configuration || null,
      lt_width_mm: line.lt_width_mm ?? line.width_mm ?? null,
      lt_height_mm: line.lt_height_mm ?? line.height_mm ?? null,
      lt_options: line.lt_options || line.options || [],
      lt_supplier_name: line.lt_supplier_name || line.supplier_name || null,
      lt_supplier_code: line.lt_supplier_code || line.supplier_code || null,
      lt_comment_extern: line.lt_comment_extern || line.comment_extern || null,
      lt_comment_intern: line.lt_comment_intern || line.comment_intern || null,
      lt_vat_code: line.lt_vat_code || line.vat_code || null,
      lt_vat_percentage: line.lt_vat_percentage ?? line.vat_percentage ?? null,
      lt_discount_percentage: line.lt_discount_percentage ?? line.discount_percentage ?? null,
      lt_base_price_cents: line.lt_base_price_cents ?? line.base_price_cents ?? null,
      lt_reservations: line.lt_reservations || line.reservations || [],
      lt_stock_status: line.lt_stock_status || line.stock_status || null,
      lt_delivery_status: line.lt_delivery_status || line.delivery_status || null,
      lt_invoice_status: line.lt_invoice_status || line.invoice_status || null,
      // Backwards-compatible aliassen:
      raw_data: line.raw_data || line.lt_raw_data || null,
      external_line_id: line.external_line_id || line.lt_id || null,
      comment_extern: line.comment_extern || line.lt_comment_extern || null,
      comment_intern: line.comment_intern || line.lt_comment_intern || null,
      vat_code: line.vat_code || line.lt_vat_code || null,
      vat_percentage: line.vat_percentage ?? line.lt_vat_percentage ?? null,
      discount_percentage: line.discount_percentage ?? line.lt_discount_percentage ?? null,
      base_price_cents: line.base_price_cents ?? line.lt_base_price_cents ?? null,
      reservations: line.reservations || line.lt_reservations || [],
      stock_status: line.stock_status || line.lt_stock_status || null,
      delivery_status: line.delivery_status || line.lt_delivery_status || null,
      invoice_status: line.invoice_status || line.lt_invoice_status || null,
    };

    // 2. Bepaal afgeleide service discipline
    let serviceGroupCode = serviceDisciplineCode || '6.9';
    if (!serviceDisciplineCode) {
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
    }

    // 3. Afgeleide Serviceregel: sub_line = 1 (verplicht 0€ & isInbegrepen = true & configuration_spec = null)
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
      dim: derivedDim,
      notes: line.notes || null,
      dimension_spec: null,
      configuration_spec: null,
      // Conform INV-RAW-IMMUTABILITY-01: GEEN synthetische brondata fabriceren!
      lt_raw_data: null,
      raw_data: null,
      lt_configuration_json: null,
      lt_configuration: null,
      lt_width_mm: null,
      lt_height_mm: null,
      lt_options: null,
      lt_supplier_name: null,
      lt_supplier_code: null,
      lt_id: (line.lt_id || line.external_line_id) ? `${line.lt_id || line.external_line_id}.service` : `${line.line_number}.service`,
      external_line_id: (line.external_line_id || line.lt_id) ? `${line.external_line_id || line.lt_id}.service` : `${line.line_number}.service`,
      lt_comment_extern: null,
      lt_comment_intern: null,
      comment_extern: null,
      comment_intern: null,
      lt_vat_code: line.lt_vat_code || line.vat_code || null,
      lt_vat_percentage: line.lt_vat_percentage ?? line.vat_percentage ?? null,
      lt_discount_percentage: null,
      lt_base_price_cents: 0,
      lt_reservations: [],
      lt_stock_status: null,
      lt_delivery_status: null,
      lt_invoice_status: null,
      vat_code: line.vat_code || line.lt_vat_code || null,
      vat_percentage: line.vat_percentage ?? line.lt_vat_percentage ?? null,
      discount_percentage: null,
      base_price_cents: 0,
      reservations: [],
      stock_status: null,
      delivery_status: null,
      invoice_status: null,
    };

    return [mainLine, serviceLine];
  }

  private async processSingleLine(rawLine: RawOrderLineInput): Promise<IngestedOrderLine[]> {
    const code = (rawLine.product_code || '').trim();

    // JIT SKU Resolutie (wordt overgeslagen bij bulk intake via PostgreSQL LATERAL)
    let resolvedProduct: ResolvedProductEntity | null = null;
    if (!this.skipClientLookup && code && code.toUpperCase() !== 'TEKST') {
      resolvedProduct = await this.resolveProductByCode(code);
    }

    // Classificeer regel
    let groupCode = '9.9';
    let serviceDisciplineCode: string | undefined;
    let classificationIsHybrid = false;

    if (resolvedProduct && resolvedProduct.product_group_code) {
      groupCode = resolvedProduct.product_group_code;
    } else {
      const classRes = await this.classificationService.classifyProduct({
        code: rawLine.product_code,
        name: rawLine.description,
        description: rawLine.description,
      });
      groupCode = classRes.productGroupCode;
      serviceDisciplineCode = classRes.serviceDisciplineCode;
      classificationIsHybrid = Boolean(classRes.isHybrid);
    }

    // 4-Traps Configuratie Extractie Cascade (0, A, B, C) met Reconciliatie (D)
    const configSpec = await this.extractionEngine.extractConfiguration(rawLine, groupCode);
    if (configSpec.reconciled_product_group_code) {
      groupCode = configSpec.reconciled_product_group_code;
    }

    // Stap 1: Leid altijd dim af voor de tekstuele kolom (voor ELK artikel met maten, inclusief meubels)
    const derivedDim =
      rawLine.dim ||
      (configSpec.dimensions?.width_mm && configSpec.dimensions?.height_mm
        ? `${configSpec.dimensions.width_mm} × ${configSpec.dimensions.height_mm}`
        : null);

    // Stap 2: Strikte Discipline Gating: configuration_spec is UITSLUITEND voor geautoriseerde maatwerkdisciplines
    const isCustomDiscipline = /^(1|2|3|5)\./.test(groupCode);

    // Stap 3: Ken configuration_spec toe (verplichte AND-koppeling met isCustomDiscipline)
    const hasMeaningfulConfig =
      isCustomDiscipline &&
      configSpec &&
      (configSpec.status === 'valid' || configSpec.status === 'incomplete') &&
      (Boolean(configSpec.dimensions?.width_mm || configSpec.dimensions?.height_mm) ||
        Boolean(configSpec.options && configSpec.options.length > 0) ||
        Boolean(configSpec.attributes && Object.keys(configSpec.attributes).length > 0));

    const assignedConfigSpec = hasMeaningfulConfig ? configSpec : null;

    // Is het een hybride regel (materiaal incl. dienst)?
    const isHybrid = rawLine.is_hybrid || classificationIsHybrid || detectIsMaterialAndService(rawLine.description);

    if (isHybrid) {
      return this.splitHybridOrderLine(
        rawLine,
        resolvedProduct ? resolvedProduct.id : null,
        groupCode,
        assignedConfigSpec,
        serviceDisciplineCode
      );
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
      dim: derivedDim,
      notes: rawLine.notes || null,
      dimension_spec: rawLine.dimension_spec || null,
      configuration_spec: assignedConfigSpec,
      // Bronze Layer velden:
      lt_raw_data: rawLine.lt_raw_data || rawLine.raw_data || null,
      lt_id: rawLine.lt_id || rawLine.external_line_id || null,
      lt_configuration_json: rawLine.lt_configuration_json || rawLine.configuration_json || null,
      lt_configuration: rawLine.lt_configuration || rawLine.configuration || null,
      lt_width_mm: rawLine.lt_width_mm ?? rawLine.width_mm ?? null,
      lt_height_mm: rawLine.lt_height_mm ?? rawLine.height_mm ?? null,
      lt_options: rawLine.lt_options || rawLine.options || [],
      lt_supplier_name: rawLine.lt_supplier_name || rawLine.supplier_name || null,
      lt_supplier_code: rawLine.lt_supplier_code || rawLine.supplier_code || null,
      lt_comment_extern: rawLine.lt_comment_extern || rawLine.comment_extern || null,
      lt_comment_intern: rawLine.lt_comment_intern || rawLine.comment_intern || null,
      lt_vat_code: rawLine.lt_vat_code || rawLine.vat_code || null,
      lt_vat_percentage: rawLine.lt_vat_percentage ?? rawLine.vat_percentage ?? null,
      lt_discount_percentage: rawLine.lt_discount_percentage ?? rawLine.discount_percentage ?? null,
      lt_base_price_cents: rawLine.lt_base_price_cents ?? rawLine.base_price_cents ?? null,
      lt_reservations: rawLine.lt_reservations || rawLine.reservations || [],
      lt_stock_status: rawLine.lt_stock_status || rawLine.stock_status || null,
      lt_delivery_status: rawLine.lt_delivery_status || rawLine.delivery_status || null,
      lt_invoice_status: rawLine.lt_invoice_status || rawLine.invoice_status || null,
      // Backwards-compatible aliassen:
      raw_data: rawLine.raw_data || rawLine.lt_raw_data || null,
      external_line_id: rawLine.external_line_id || rawLine.lt_id || null,
      comment_extern: rawLine.comment_extern || rawLine.lt_comment_extern || null,
      comment_intern: rawLine.comment_intern || rawLine.lt_comment_intern || null,
      vat_code: rawLine.vat_code || rawLine.lt_vat_code || null,
      vat_percentage: rawLine.vat_percentage ?? rawLine.lt_vat_percentage ?? null,
      discount_percentage: rawLine.discount_percentage ?? rawLine.lt_discount_percentage ?? null,
      base_price_cents: rawLine.base_price_cents ?? rawLine.lt_base_price_cents ?? null,
      reservations: rawLine.reservations || rawLine.lt_reservations || [],
      stock_status: rawLine.stock_status || rawLine.lt_stock_status || null,
      delivery_status: rawLine.delivery_status || rawLine.lt_delivery_status || null,
      invoice_status: rawLine.invoice_status || rawLine.lt_invoice_status || null,
    };

    return [singleLine];
  }
}

/**
 * Pure SSOT Transformatie van ruwe LogicTrade Order + Orderregels naar RawLogicTradeOrderInput.
 * Garandeert:
 * 1. FSM Stage toewijzing (Offerte -> Stadium 2, Order -> Stadium 5)
 * 2. Prijsconversie naar gehele CPQ centen (zero float drift)
 * 3. Behoud van vrije tekstregels met product_code: 'TEKST'
 * 4. Veilige regelnummering met fallback (index + 1) * 10
 */
export function mapLogicTradeOrderToRawInput(
  header: any,
  lines?: any[],
  options?: {
    isQuote?: boolean;
    existingOrder?: {
      id?: string;
      order_number?: string;
      fsm_step?: number;
      fsm_phase?: string;
    };
  }
): RawLogicTradeOrderInput {
  const statusStr = String(header.status || '').trim();
  const statusUpper = statusStr.toUpperCase();

  const rawOrdNumber = String(header.number || header.orderNumber || header.id || '').trim();
  const headerNum = String(header.number || '').trim();
  const headerOrderNum = String(header.orderNumber || '').trim();
  const isVOrder = headerNum.toUpperCase().startsWith('V') || headerOrderNum.toUpperCase().startsWith('V');

  const isOfferte =
    Boolean(options?.isQuote) ||
    (!isVOrder && (
      statusUpper === 'OFFERTE' ||
      statusUpper === 'QUOTATION' ||
      statusUpper === 'PROPOSAL' ||
      rawOrdNumber.toUpperCase().startsWith('O') ||
      Boolean(header.number && !header.orderNumber)
    ));

  const ordNumber = rawOrdNumber;

  const quoteId = header.number
    ? String(header.number).trim()
    : (header.id ? 'quote_' + header.id : (ordNumber ? 'quote_' + ordNumber : 'quote_unknown'));

  let finalId = isOfferte ? quoteId : String(header.id || ordNumber);
  let finalOrderNumber = ordNumber;
  let fsm_step = isOfferte ? 2 : 5;
  let fsm_phase = isOfferte
    ? '2. Offerte'
    : (isVOrder && header.number && !header.orderNumber ? '5. Verkooporder' : '5. Bestellen (Actueel)');

  if (options?.existingOrder) {
    if (options.existingOrder.id) finalId = String(options.existingOrder.id);
    if (options.existingOrder.order_number) finalOrderNumber = options.existingOrder.order_number;
    if (options.existingOrder.fsm_step !== undefined) fsm_step = options.existingOrder.fsm_step;
    if (options.existingOrder.fsm_phase) fsm_phase = options.existingOrder.fsm_phase;
  }

  const effectiveLines = lines || (Array.isArray(header.lines) ? header.lines : (Array.isArray(header.orderLines) ? header.orderLines : []));

  const rawLines: RawOrderLineInput[] = effectiveLines.map((l: any, index: number) => {
    const rawCode = String(l.articleCode || l.code || l.productCode || '').trim();
    const code = rawCode || 'TEKST';
    const description = String(l.articleDescription || l.description || (code !== 'TEKST' ? code : 'Vrije tekstregel')).trim();
    const qty = typeof l.quantity === 'number' && Number.isFinite(l.quantity) ? l.quantity : 1;

    let unitPriceCents = 0;
    if (typeof l.partPrice === 'number' && Number.isFinite(l.partPrice)) {
      unitPriceCents = Math.round(l.partPrice * 100);
    } else if (typeof l.linePrice === 'number' && Number.isFinite(l.linePrice) && qty > 0) {
      unitPriceCents = Math.round((l.linePrice / qty) * 100);
    } else if (typeof l.unit_price_cents === 'number' && Number.isFinite(l.unit_price_cents)) {
      unitPriceCents = l.unit_price_cents;
    }

    let totalPriceCents = 0;
    if (typeof l.linePrice === 'number' && Number.isFinite(l.linePrice)) {
      totalPriceCents = Math.round(l.linePrice * 100);
    } else if (typeof l.total_price_cents === 'number' && Number.isFinite(l.total_price_cents)) {
      totalPriceCents = l.total_price_cents;
    } else {
      totalPriceCents = unitPriceCents * qty;
    }

    const lineNumber = typeof l.lineNumber === 'number' && Number.isFinite(l.lineNumber)
      ? l.lineNumber
      : (typeof l.line_number === 'number' && Number.isFinite(l.line_number) ? l.line_number : (index + 1) * 10);

    const rawComment = typeof l.comment === 'object' && l.comment !== null ? l.comment : null;
    const ltCommentExtern = rawComment?.extern ? String(rawComment.extern).trim() : (typeof l.comment === 'string' ? l.comment.trim() : null);
    const ltCommentIntern = rawComment?.intern ? String(rawComment.intern).trim() : null;
    const ltId = l.id !== undefined && l.id !== null ? String(l.id).trim() : null;
    const ltVatCode = l.vat?.code || l.vatCode || l.vat_code || null;
    const ltVatPercentage = typeof l.vat?.percentage === 'number' ? l.vat.percentage : (typeof l.vatPercentage === 'number' ? l.vatPercentage : (typeof l.vat_percentage === 'number' ? l.vat_percentage : null));
    const ltDiscountPercentage = typeof l.discount === 'number' ? l.discount : (typeof l.discountPercentage === 'number' ? l.discountPercentage : (typeof l.discount_percentage === 'number' ? l.discount_percentage : null));
    const ltBasePriceCents = typeof l.basePartPrice === 'number' ? Math.round(l.basePartPrice * 100) : (typeof l.base_price_cents === 'number' ? l.base_price_cents : null);
    const ltReservations = Array.isArray(l.reservations) ? l.reservations : (Array.isArray(l.lt_reservations) ? l.lt_reservations : []);
    const ltStockStatus = l.stockStatus || l.stock_status || null;
    const ltDeliveryStatus = l.deliveryStatus || l.delivery_status || null;
    const ltInvoiceStatus = l.invoiceStatus || l.invoice_status || null;

    let parsedConfigJson: Record<string, unknown> | null = null;
    const rawConfigJson = l.configurationJson || l.configuration_json;
    if (typeof rawConfigJson === 'string') {
      try {
        parsedConfigJson = JSON.parse(rawConfigJson);
      } catch {
        parsedConfigJson = null;
      }
    } else if (rawConfigJson && typeof rawConfigJson === 'object') {
      parsedConfigJson = rawConfigJson as Record<string, unknown>;
    }

    const noteParts = typeof l.comment === 'object' && l.comment !== null
      ? [l.comment.extern, l.comment.intern].filter(Boolean).map(String)
      : [];
    const notes = noteParts.length > 0
      ? noteParts.join('\n')
      : (typeof l.comment === 'string' ? l.comment : (l.notes || null));

    return {
      line_number: lineNumber,
      product_code: code,
      description,
      quantity: qty,
      unit: l.unit || 'stuks',
      unit_price_cents: unitPriceCents,
      total_price_cents: totalPriceCents,
      etage_name: l.etage_name || 'Begane grond',
      room_name: l.room_name,
      window_name: l.window_name,
      position_id: l.position_id,
      dim: l.dim || null,
      notes,
      dimension_spec: l.dimension_spec || null,
      is_hybrid: l.is_hybrid,
      supplier_name: l.supplierName || l.supplier_name || undefined,
      supplier_code: l.supplierCode || l.supplier_code || undefined,
      width_mm: typeof l.widthMm === 'number' ? l.widthMm : (typeof l.width_mm === 'number' ? l.width_mm : undefined),
      height_mm: typeof l.heightMm === 'number' ? l.heightMm : (typeof l.height_mm === 'number' ? l.height_mm : undefined),
      options: Array.isArray(l.options) ? l.options.map((opt: any) => typeof opt === 'string' ? opt : String(opt?.description || opt?.value || opt?.key || JSON.stringify(opt))) : undefined,
      configuration: l.configuration || undefined,
      configuration_json: parsedConfigJson || undefined,
      // 100% Bronze Layer pariteit:
      lt_raw_data: l,
      lt_id: ltId,
      lt_configuration_json: parsedConfigJson,
      lt_configuration: typeof l.configuration === 'object' && l.configuration !== null ? l.configuration : null,
      lt_width_mm: typeof l.widthMm === 'number' ? l.widthMm : (typeof l.width_mm === 'number' ? l.width_mm : null),
      lt_height_mm: typeof l.heightMm === 'number' ? l.heightMm : (typeof l.height_mm === 'number' ? l.height_mm : null),
      lt_options: Array.isArray(l.options) ? l.options : [],
      lt_supplier_name: l.supplierName || l.supplier_name || null,
      lt_supplier_code: l.supplierCode || l.supplier_code || null,
      lt_comment_extern: ltCommentExtern,
      lt_comment_intern: ltCommentIntern,
      lt_vat_code: ltVatCode,
      lt_vat_percentage: ltVatPercentage,
      lt_discount_percentage: ltDiscountPercentage,
      lt_base_price_cents: ltBasePriceCents,
      lt_reservations: ltReservations,
      lt_stock_status: ltStockStatus,
      lt_delivery_status: ltDeliveryStatus,
      lt_invoice_status: ltInvoiceStatus,
      // Backwards-compatible aliassen:
      raw_data: l,
      external_line_id: ltId,
      comment_extern: ltCommentExtern,
      comment_intern: ltCommentIntern,
      vat_code: ltVatCode,
      vat_percentage: ltVatPercentage,
      discount_percentage: ltDiscountPercentage,
      base_price_cents: ltBasePriceCents,
      reservations: ltReservations,
      stock_status: ltStockStatus,
      delivery_status: ltDeliveryStatus,
      invoice_status: ltInvoiceStatus,
    };
  });

  const totalAmountCents =
    typeof header.totalAmount === 'number' && Number.isFinite(header.totalAmount)
      ? Math.round(header.totalAmount * 100)
      : (typeof header.total_amount_cents === 'number' && Number.isFinite(header.total_amount_cents)
        ? header.total_amount_cents
        : rawLines.reduce((acc, l) => acc + (l.total_price_cents || 0), 0));

  const quotationNumber = header.number
    ? String(header.number).trim()
    : (header.quotationNumber || (isOfferte ? ordNumber : header.quote?.number));

  const rawDate = header.date || header.createdDate || header.order_date;
  const orderDate = rawDate ? String(rawDate).slice(0, 10) : undefined;

  const city =
    header.city ||
    header.customer?.address?.city ||
    header.customer?.city ||
    (typeof header.address === 'object' ? header.address?.city : undefined) ||
    header.delivery?.address?.city;

  const rawCustomer = header.customer;
  const combinedName = rawCustomer && typeof rawCustomer === 'object'
    ? [rawCustomer.firstName, rawCustomer.lastName].filter(Boolean).join(' ').trim()
    : '';
  const customerName =
    header.customerName ||
    header.customer_name ||
    (typeof header.customer === 'string' ? header.customer : (
      header.customer?.companyName ||
      header.customer?.name ||
      combinedName ||
      header.delivery?.address?.name ||
      header.address?.name
    )) ||
    'Onbekende Klant';

  return {
    id: finalId,
    order_number: finalOrderNumber,
    customer_name: customerName,
    city,
    quotation_number: quotationNumber,
    order_date: orderDate,
    sales_rep: header.salesRep || header.sales_rep,
    branch: typeof header.branch === 'string' ? header.branch : header.branch?.name,
    fsm_phase,
    fsm_step,
    scope_description: header.scopeDescription || header.scope_description || header.description,
    total_amount_cents: totalAmountCents,
    status: statusStr || (isOfferte ? 'OFFERTE' : 'ORDER'),
    raw_data: header,
    lt_raw_data: header,
    lt_id: String(header.id || ordNumber),
    lines: rawLines,
  };
}
