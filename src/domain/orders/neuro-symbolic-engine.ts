/**
 * src/domain/orders/neuro-symbolic-engine.ts
 *
 * 4-Layer Neuro-Symbolische Engine coördinerend:
 * - Laag 0: In-Memory / Silver Enrichment Boundary (Boilerplate Firewall & Catalog Hydration)
 * - Laag 1: Deterministisch ERP & Configurator Engine (Symbolic Ground Truth, 0 AI tokens)
 * - Laag 2: AI Semantic Extractor met Ordercontext (AiSemanticExtractionProvider)
 * - Laag 3: Symbolische Fysica & Prijs Verificatie (De Mechanische Veiligheidspoort)
 */

import type {
  RawOrderLineInput,
  CognitiveExtractionContext,
  ICognitiveExtractionProvider,
  NeuroSymbolicLineResult,
  ResolvedProductEntity,
  DimensionSpec,
  ConfigurationSpec,
} from '@/types/order-intake';
import { hasNonEmptyConfigOptions } from '@/types/order-intake';
import { ClassificationService } from '@/domain/classification/central-classification-service';
import { ConfigurationExtractionEngine } from '@/domain/orders/configuration-extraction-engine';
import { DimensionExtractionEngine } from '@/domain/orders/dimension-extraction-engine';
import {
  isValidErpDimension,
  isOutOfPhysicalBoundsDimension,
} from '@/domain/orders/dimension-guards';
import {
  detectIsMaterialAndService,
  detectServiceDiscipline,
  SERVICE_DISCIPLINE_TO_PRODUCT_GROUP,
} from '@/domain/search/v2/cognitive-typology-classifier';

export type { NeuroSymbolicLineResult };

export interface NeuroSymbolicEngineOptions {
  cognitiveProvider?: ICognitiveExtractionProvider;
  classificationService?: ClassificationService;
  extractionEngine?: ConfigurationExtractionEngine;
  dimensionEngine?: DimensionExtractionEngine;
}

export class NeuroSymbolicEngine {
  private cognitiveProvider?: ICognitiveExtractionProvider;
  private classificationService: ClassificationService;
  private extractionEngine: ConfigurationExtractionEngine;
  private dimensionEngine: DimensionExtractionEngine;

  constructor(options?: NeuroSymbolicEngineOptions) {
    this.cognitiveProvider = options?.cognitiveProvider;
    this.classificationService = options?.classificationService || new ClassificationService();
    this.extractionEngine = options?.extractionEngine || new ConfigurationExtractionEngine();
    this.dimensionEngine = options?.dimensionEngine || new DimensionExtractionEngine();
  }

  public async processLine(
    line: RawOrderLineInput,
    context?: CognitiveExtractionContext
  ): Promise<NeuroSymbolicLineResult> {
    const rawCode = (line.product_code || '').trim().toUpperCase();
    const totalPrice = line.total_price_cents ?? 0;
    const quantity = line.quantity ?? 1;
    const catalogProduct = context?.catalogProduct;
    const extractionNotes: string[] = [];

    // --------------------------------------------------------------------------
    // Laag 0: Raw Immutability & Boilerplate In-Memory Firewall
    // --------------------------------------------------------------------------
    // Notes worden uitsluitend in-memory opgeschoond voor extractie-engines;
    // line.lt_raw_data, line.notes en Bronze velden blijven 100% onaangetast (INV-RAW-IMMUTABILITY-01).
    const cleanedNotes = this.stripBoilerplate(line.notes || '');

    // In-Memory normalisatie van configuratie- en afmetingsvelden
    const rawConfig = line.configuration || (line as any).lt_configuration;
    const rawConfigJson = line.configuration_json || (line as any).lt_configuration_json;
    const rawWidthMm = line.width_mm ?? (line as any).lt_width_mm ?? undefined;
    const rawHeightMm = line.height_mm ?? (line as any).lt_height_mm ?? undefined;
    const rawOptions = (hasNonEmptyConfigOptions(line.options) ? line.options : (line as any).lt_options) ?? undefined;

    const normalizedLine: RawOrderLineInput = {
      ...line,
      notes: cleanedNotes,
      configuration: rawConfig as any,
      configuration_json: rawConfigJson,
      width_mm: rawWidthMm,
      height_mm: rawHeightMm,
      options: rawOptions,
    };

    // --------------------------------------------------------------------------
    // Laag 1: Deterministisch ERP & Configurator Engine (0 AI tokens)
    // --------------------------------------------------------------------------

    // 1.1 Informatieve Tekst / Clausule (0.0) bij nulprijs regels (case-ongevoelig voor TEKST en Tekst)
    if (rawCode === 'TEKST' && totalPrice === 0) {
      return {
        productGroupCode: '0.0',
        confidence: 1.0,
        stage: 'trap_1_master_cache',
        requiresReview: false,
        dimensionSpec: null,
        dimensionFormatted: null,
        configurationSpec: null,
        extractionNotes: ['Informatieve tekst / clausule à €0'],
      };
    }

    // 1.2 5-Traps Credit Triage bij negatieve bedragen
    if (totalPrice < 0) {
      const textToScan = `${rawCode} ${line.description || ''}`.toLowerCase();
      if (
        ['A00044570', 'A00014590', 'A00036356', 'KORTING'].includes(rawCode) ||
        rawCode === 'TEKST' ||
        /(?:korting|actie|cadeaubon|voucher|coupon)/i.test(textToScan)
      ) {
        return {
          productGroupCode: '0.1',
          confidence: 1.0,
          stage: 'trap_1_master_cache',
          requiresReview: false,
          dimensionSpec: null,
          dimensionFormatted: null,
          configurationSpec: null,
        };
      }

      const creditRes = await this.classificationService.classifyProduct({
        code: line.product_code,
        name: catalogProduct?.name || line.description,
        description: line.description,
        quantity,
        total_price_cents: totalPrice,
      });

      // Als de classificatie 9.9 oplevert voor een negatieve regel: fail-closed naar review
      if (creditRes.productGroupCode === '9.9') {
        return {
          productGroupCode: '9.9',
          confidence: 0.1,
          stage: 'trap_4_fail_closed_quarantine',
          requiresReview: true,
          dimensionSpec: null,
          dimensionFormatted: null,
          configurationSpec: null,
          extractionNotes: ['Onbekende negatieve boeking/credit vereist handmatige controle'],
        };
      }

      return {
        productGroupCode: creditRes.productGroupCode,
        confidence: creditRes.confidence,
        stage: creditRes.stage === 'trap_1_master_cache' ? 'trap_1_master_cache' : 'trap_2_configurator',
        requiresReview: creditRes.requiresReview,
        dimensionSpec: null,
        dimensionFormatted: null,
        configurationSpec: null,
        isHybrid: creditRes.isHybrid,
        serviceDisciplineCode: creditRes.serviceDisciplineCode,
      };
    }

    // 1.3 Zuivere Catalogus-Gedreven Diensten (6.x excl. 6.4) met confidence 1.000 (immuun voor notities)
    if (catalogProduct?.product_group_code?.startsWith('6.') && catalogProduct.product_group_code !== '6.4' && !catalogProduct.is_generic_container) {
      const dimRes = this.dimensionEngine.extractDimension(normalizedLine, catalogProduct.product_group_code);
      return {
        productGroupCode: catalogProduct.product_group_code,
        confidence: 1.0,
        stage: 'trap_1_master_cache',
        requiresReview: false,
        dimensionSpec: dimRes.dimensionSpec,
        dimensionFormatted: dimRes.formattedDim,
        configurationSpec: null,
        isHybrid: false,
      };
    }

    // 1.4 Bepaal initiële productgroep via catalogus of Central Classification Service
    let effectiveGroup = catalogProduct?.product_group_code;
    let isClassifiedHybrid = false;
    let classifiedServiceDiscipline: string | undefined;
    let isMasterCache = Boolean(catalogProduct && !catalogProduct.is_generic_container);

    if (!effectiveGroup || effectiveGroup === '9.9') {
      const classRes = await this.classificationService.classifyProduct({
        code: line.product_code,
        name: catalogProduct?.name || line.description,
        description: line.description,
        supplier_name: line.supplier_name,
        notes: line.notes,
        quantity,
        total_price_cents: totalPrice,
      });
      effectiveGroup = classRes.productGroupCode;
      isClassifiedHybrid = Boolean(classRes.isHybrid);
      classifiedServiceDiscipline = classRes.serviceDisciplineCode;
      if (classRes.stage === 'trap_1_master_cache') {
        isMasterCache = true;
      }

      // Directe gesloten dienst zonder container ook na dynamische classificatie
      if (effectiveGroup?.startsWith('6.') && effectiveGroup !== '6.4') {
        const dimRes = this.dimensionEngine.extractDimension(normalizedLine, effectiveGroup);
        return {
          productGroupCode: effectiveGroup,
          confidence: 1.0,
          stage: 'trap_1_master_cache',
          requiresReview: false,
          dimensionSpec: dimRes.dimensionSpec,
          dimensionFormatted: dimRes.formattedDim,
          configurationSpec: null,
          isHybrid: false,
        };
      }
    }

    // Pre-Extractie Laag 3 Safety Gate: Check extreme fysieke uitschieters in ERP velden of vrije tekst
    if (this.dimensionEngine.hasDimensionOutlier(normalizedLine)) {
      return {
        productGroupCode: effectiveGroup || '9.9',
        confidence: 0.1,
        stage: 'trap_4_fail_closed_quarantine',
        requiresReview: true,
        dimensionSpec: { type: 'piece_service', unit: normalizedLine.unit || 'stuks' },
        dimensionFormatted: null,
        extractionNotes: ['Extreme uitschieter afmetingen (> 12000 mm) afgewezen naar review'],
      };
    }

    // 1.5 Configurator Extractie (Dealer Connect / Zonnelux / Sunway / KeJe / Unilux / ERP velden / Vrije Tekst)
    let configSpec: ConfigurationSpec | undefined;
    const combinedText = `${normalizedLine.description || ''} ${normalizedLine.notes || ''}`.trim();
    const hasConfigInput = Boolean(
      normalizedLine.configuration ||
      normalizedLine.configuration_json ||
      normalizedLine.width_mm ||
      normalizedLine.height_mm ||
      (normalizedLine.options && normalizedLine.options.length > 0) ||
      combinedText.length > 0
    );

    const isCustomOrUnknownDiscipline = !effectiveGroup || effectiveGroup === '9.9' || /^(1|2|3|5)\./.test(effectiveGroup);

    if (hasConfigInput && isCustomOrUnknownDiscipline) {
      configSpec = await this.extractionEngine.extractConfiguration(
        normalizedLine,
        effectiveGroup,
        { skipCognitive: true }
      );
    }

    // Outlier check vanuit configurator extractie
    if (
      configSpec?.status === 'requires_review' &&
      configSpec.confidence <= 0.2 &&
      configSpec.extraction_notes?.some((n) => /uitschieter|veiligheidsgrenzen/i.test(n))
    ) {
      return {
        productGroupCode: effectiveGroup || '9.9',
        confidence: 0.1,
        stage: 'trap_4_fail_closed_quarantine',
        requiresReview: true,
        dimensionSpec: { type: 'piece_service', unit: normalizedLine.unit || 'stuks' },
        dimensionFormatted: null,
        configurationSpec: configSpec ? { ...configSpec, dimensions: undefined } : null,
        extractionNotes: ['Extreme uitschieter afmetingen (> 12000 mm) afgewezen naar review'],
      };
    }

    // SSOT Rail & Gordijn classificatie
    const railOrCurtain = this.dimensionEngine.resolveCurtainOrRailKind(
      effectiveGroup || '9.9',
      normalizedLine.description || '',
      normalizedLine.notes || '',
      normalizedLine
    );

    const w = configSpec?.dimensions?.width_mm ?? rawWidthMm;
    const h = configSpec?.dimensions?.height_mm ?? rawHeightMm;
    const hasUnsafeConfiguredDims =
      isOutOfPhysicalBoundsDimension(w) || isOutOfPhysicalBoundsDimension(h);

    if (hasUnsafeConfiguredDims) {
      return {
        productGroupCode: effectiveGroup || '9.9',
        confidence: 0.1,
        stage: 'trap_4_fail_closed_quarantine',
        requiresReview: true,
        dimensionSpec: { type: 'piece_service', unit: normalizedLine.unit || 'stuks' },
        dimensionFormatted: null,
        configurationSpec: configSpec ? { ...configSpec, dimensions: undefined } : null,
        extractionNotes: ['Afmetingen buiten fysieke veiligheidsgrenzen (100 - 12000 mm)'],
      };
    }

    const hasValidW = isValidErpDimension(w);
    const hasValidH = isValidErpDimension(h);
    const has2DDims = hasValidW && hasValidH;
    const has1DRailDims = railOrCurtain.isTrueRail && hasValidW && (h === undefined || h === 0);
    const hasDeterministicConfiguredDims = has2DDims || has1DRailDims;
    const hasConfiguratorPayload = Boolean(
      normalizedLine.configuration ||
      normalizedLine.configuration_json ||
      hasNonEmptyConfigOptions(normalizedLine.options)
    );

    if (hasDeterministicConfiguredDims) {
      if (effectiveGroup === '9.9' && this.cognitiveProvider) {
        // Val door naar Laag 2 AI zodat classificatie kan plaatsvinden; configSpec blijft fallback
      } else {
        const targetGroup = effectiveGroup || '9.9';
        const fallbackDims = configSpec?.dimensions ?? (hasDeterministicConfiguredDims ? { width_mm: w, height_mm: h } : undefined);
        const dimRes = this.dimensionEngine.extractDimension(
          normalizedLine,
          targetGroup,
          fallbackDims
        );

        const isOutlier = dimRes.isOutlier || this.dimensionEngine.hasDimensionOutlier(normalizedLine);
        if (isOutlier) {
          return {
            productGroupCode: targetGroup,
            confidence: 0.1,
            stage: 'trap_4_fail_closed_quarantine',
            requiresReview: true,
            dimensionSpec: dimRes.dimensionSpec,
            dimensionFormatted: null,
            configurationSpec: configSpec ? { ...configSpec, dimensions: undefined } : null,
            extractionNotes: ['Extreme uitschieter afmetingen (> 12000 mm) afgewezen naar review'],
          };
        }

        if (targetGroup === '9.9') {
          return {
            productGroupCode: '9.9',
            confidence: 0.2,
            stage: 'trap_2_configurator',
            requiresReview: true,
            dimensionSpec: dimRes.dimensionSpec,
            dimensionFormatted: dimRes.formattedDim,
            configurationSpec: configSpec ?? null,
          };
        }

        const isComplete1DRail = railOrCurtain.isTrueRail && dimRes.dimensionSpec.type === 'curtain_linear';
        const requiresReview =
          Boolean(configSpec?.status === 'requires_review') ||
          Boolean(configSpec?.status === 'incomplete' && !isComplete1DRail);

        const stage = hasConfiguratorPayload
          ? 'trap_2_configurator'
          : (isMasterCache ? 'trap_1_master_cache' : 'trap_2_configurator');

        // Retail meubels (7.x) houden configurationSpec = null conform contract
        const finalConfigSpec = targetGroup.startsWith('7.') ? null : (configSpec ?? null);

        return {
          productGroupCode: targetGroup,
          confidence: isMasterCache ? 1.0 : (configSpec?.confidence || 0.95),
          stage,
          requiresReview,
          dimensionSpec: dimRes.dimensionSpec,
          dimensionFormatted: dimRes.formattedDim,
          configurationSpec: finalConfigSpec,
          isHybrid: isClassifiedHybrid,
          serviceDisciplineCode: classifiedServiceDiscipline,
        };
      }
    }

    // 1.6 Statische catalogus / geclassificeerde SKUs (zonder Laag 2 dead-end voor maatwerkdisciplines)
    const configItems = normalizedLine.configuration?.items;
    const hasMeasuredDims = Boolean(hasValidW || hasValidH);
    const isLikelyCustomIn99 =
      railOrCurtain.kind !== 'other' ||
      /\b(?:maatwerk|vloer|tapijt|paneel)\b/i.test(normalizedLine.description || '');
    const isQuestionnaireOrAccessory =
      Array.isArray(configItems) &&
      configItems.length > 0 &&
      (ConfigurationExtractionEngine.isQuestionnaireItems(configItems) ||
        (effectiveGroup === '9.9' && !isLikelyCustomIn99 && !hasMeasuredDims));

    const canEscalateCustomToCognitive =
      Boolean(this.cognitiveProvider) &&
      !isQuestionnaireOrAccessory &&
      Boolean(effectiveGroup && /^(1|2|3|5)\./.test(effectiveGroup)) &&
      !hasDeterministicConfiguredDims &&
      Boolean(normalizedLine.notes && normalizedLine.notes.length > 20);

    if (effectiveGroup && effectiveGroup !== '9.9' && !catalogProduct?.is_generic_container) {
      const dimRes = this.dimensionEngine.extractDimension(
        normalizedLine,
        effectiveGroup,
        configSpec?.dimensions
      );

      // Laat dimensieloze/onvolledige maatwerkregels mét cognitiveProvider en notes > 20 doorvallen naar Laag 2
      if (dimRes.source !== 'fallback_default' || !canEscalateCustomToCognitive) {
        const isOutlier = dimRes.isOutlier || this.dimensionEngine.hasDimensionOutlier(normalizedLine);
        if (isOutlier) {
          return {
            productGroupCode: effectiveGroup,
            confidence: 0.1,
            stage: 'trap_4_fail_closed_quarantine',
            requiresReview: true,
            dimensionSpec: dimRes.dimensionSpec,
            dimensionFormatted: null,
            configurationSpec: configSpec ? { ...configSpec, dimensions: undefined } : null,
            extractionNotes: ['Extreme uitschieter afmetingen (> 12000 mm) afgewezen naar review'],
          };
        }

        if (configSpec?.status === 'incomplete' && dimRes.source === 'fallback_default') {
          if (hasMeasuredDims) {
            return {
              productGroupCode: effectiveGroup,
              confidence: 0.5,
              stage: 'trap_2_configurator',
              requiresReview: true,
              dimensionSpec: dimRes.dimensionSpec,
              dimensionFormatted: dimRes.formattedDim,
              configurationSpec: configSpec,
              extractionNotes: configSpec.extraction_notes,
            };
          } else if (/^(1|2|3|5)\./.test(effectiveGroup)) {
            return {
              productGroupCode: effectiveGroup,
              confidence: 0.1,
              stage: 'trap_4_fail_closed_quarantine',
              requiresReview: true,
              dimensionSpec: dimRes.dimensionSpec,
              dimensionFormatted: null,
              configurationSpec: configSpec,
              extractionNotes: configSpec.extraction_notes || ['Alleen configuratieattributen aangetroffen zonder afmetingen'],
            };
          }
        }

        // Controleer op hybride materiaal/dienst
        const textToScan = `${normalizedLine.description} ${catalogProduct?.name || ''}`.toLowerCase();
        const isHybrid = isClassifiedHybrid || detectIsMaterialAndService(textToScan);
        let serviceDisciplineCode = classifiedServiceDiscipline;
        if (isHybrid && !serviceDisciplineCode) {
          const sRes = detectServiceDiscipline(textToScan);
          if (sRes?.discipline) {
            serviceDisciplineCode = SERVICE_DISCIPLINE_TO_PRODUCT_GROUP[sRes.discipline];
          }
        }

        // Retail meubels (7.x) houden configurationSpec = null conform contract
        const finalConfigSpec = effectiveGroup.startsWith('7.') ? null : configSpec;

        return {
          productGroupCode: effectiveGroup,
          confidence: 1.0,
          stage: 'trap_1_master_cache',
          requiresReview: false,
          dimensionSpec: dimRes.dimensionSpec,
          dimensionFormatted: dimRes.formattedDim,
          configurationSpec: finalConfigSpec,
          isHybrid,
          serviceDisciplineCode,
        };
      }
    }

    // --------------------------------------------------------------------------
    // Laag 2: AI Semantic Extractor met Ordercontext (Cognitive Escalation)
    // --------------------------------------------------------------------------
    const shouldEscalate =
      !isQuestionnaireOrAccessory &&
      (Boolean(catalogProduct?.is_generic_container) ||
        !catalogProduct ||
        effectiveGroup === '9.9' ||
        (!hasDeterministicConfiguredDims && Boolean(normalizedLine.notes && normalizedLine.notes.length > 20)));

    if (shouldEscalate && this.cognitiveProvider) {
      // Pre-AI Veiligheidspoort: check extreme fysieke uitschieters
      if (this.dimensionEngine.hasDimensionOutlier(normalizedLine)) {
        return {
          productGroupCode: effectiveGroup || '9.9',
          confidence: 0.1,
          stage: 'trap_4_fail_closed_quarantine',
          requiresReview: true,
          dimensionSpec: { type: 'piece_service', unit: normalizedLine.unit || 'stuks' },
          dimensionFormatted: null,
          configurationSpec: configSpec ? { ...configSpec, dimensions: undefined } : null,
          extractionNotes: ['Extreme uitschieter afmetingen (> 12000 mm) afgewezen naar review'],
        };
      }

      const cognitiveContext: CognitiveExtractionContext = context || {
        line: normalizedLine,
        catalogProduct,
      };

      const cognitiveSpec = await this.cognitiveProvider.extract(
        cognitiveContext,
        effectiveGroup
      );

      // Eerst deterministische velden samenvoegen, dan bounds handhaven
      const cogW = cognitiveSpec.dimensions?.width_mm;
      const cogH = cognitiveSpec.dimensions?.height_mm;
      const mergedAttributes = { ...(configSpec?.attributes || {}), ...(cognitiveSpec.attributes || {}) };
      const mergedOptions = hasNonEmptyConfigOptions(cognitiveSpec.options)
        ? cognitiveSpec.options
        : (hasNonEmptyConfigOptions(configSpec?.options) ? configSpec?.options : (normalizedLine.options ?? undefined));
      const mergedNotes = Array.from(new Set([...(configSpec?.extraction_notes || []), ...(cognitiveSpec.extraction_notes || [])]));

      // Post-Cognitieve Laag 3 Veiligheidspoort: vangt negatieve, sub-100 en >12000 mm AI-maten
      if (isOutOfPhysicalBoundsDimension(cogW) || isOutOfPhysicalBoundsDimension(cogH)) {
        return {
          productGroupCode: effectiveGroup || '9.9',
          confidence: 0.1,
          stage: 'trap_4_fail_closed_quarantine',
          requiresReview: true,
          dimensionSpec: { type: 'piece_service', unit: normalizedLine.unit || 'stuks' },
          dimensionFormatted: null,
          configurationSpec: {
            ...configSpec,
            ...cognitiveSpec,
            dimensions: undefined,
            attributes: Object.keys(mergedAttributes).length > 0 ? mergedAttributes : undefined,
            options: mergedOptions,
          },
          extractionNotes: ['Cognitieve afmetingen buiten fysieke veiligheidsgrenzen (100 - 12000 mm)'],
        };
      }

      const resolvedW = isValidErpDimension(cogW) ? cogW : configSpec?.dimensions?.width_mm;
      const resolvedH = isValidErpDimension(cogH) ? cogH : configSpec?.dimensions?.height_mm;
      const resolvedDims = (resolvedW !== undefined || resolvedH !== undefined)
        ? { width_mm: resolvedW, height_mm: resolvedH }
        : undefined;
      const hasCogDims = Boolean(isValidErpDimension(cogW) || isValidErpDimension(cogH));
      const mergedConfigSpec: ConfigurationSpec = {
        ...configSpec,
        ...cognitiveSpec,
        dimensions: resolvedDims,
        attributes: Object.keys(mergedAttributes).length > 0 ? mergedAttributes : undefined,
        options: mergedOptions,
        extraction_notes: mergedNotes.length > 0 ? mergedNotes : undefined,
      };

      if (cognitiveSpec.status === 'requires_review' && cognitiveSpec.confidence <= 0.2) {
        if (effectiveGroup === '9.9' && hasDeterministicConfiguredDims) {
          const fallbackDims = configSpec?.dimensions ?? (hasDeterministicConfiguredDims ? { width_mm: w, height_mm: h } : undefined);
          const dimRes = this.dimensionEngine.extractDimension(
            normalizedLine,
            '9.9',
            fallbackDims
          );
          return {
            productGroupCode: '9.9',
            confidence: 0.2,
            stage: 'trap_2_configurator',
            requiresReview: true,
            dimensionSpec: dimRes.dimensionSpec,
            dimensionFormatted: dimRes.formattedDim,
            configurationSpec: mergedConfigSpec,
            extractionNotes: mergedNotes.length > 0 ? mergedNotes : undefined,
          };
        }
        return {
          productGroupCode: effectiveGroup || '9.9',
          confidence: cognitiveSpec.confidence,
          stage: 'trap_4_fail_closed_quarantine',
          requiresReview: true,
          dimensionSpec: { type: 'piece_service', unit: normalizedLine.unit || 'stuks' },
          dimensionFormatted: null,
          configurationSpec: mergedConfigSpec,
          extractionNotes: mergedNotes.length > 0 ? mergedNotes : ['Cognitieve provider markeerde regel als review'],
        };
      }

      const candidateGroup = cognitiveSpec.reconciled_product_group_code || effectiveGroup || '1.1';
      const dimRes = this.dimensionEngine.extractDimension(
        normalizedLine,
        candidateGroup,
        resolvedDims
      );

      const isOutlier = dimRes.isOutlier || this.dimensionEngine.hasDimensionOutlier(normalizedLine);
      if (isOutlier) {
        return {
          productGroupCode: candidateGroup,
          confidence: 0.1,
          stage: 'trap_4_fail_closed_quarantine',
          requiresReview: true,
          dimensionSpec: dimRes.dimensionSpec,
          dimensionFormatted: null,
          configurationSpec: { ...mergedConfigSpec, dimensions: undefined },
          extractionNotes: ['Extreme uitschieter afmetingen (> 12000 mm) afgewezen naar review'],
        };
      }

      // Post-AI Fail-Closed Physics Gate voor maatwerk/9.9
      if ((/^(1|2|3|5)\./.test(candidateGroup) || candidateGroup === '9.9') && dimRes.source === 'fallback_default') {
        return {
          productGroupCode: candidateGroup,
          confidence: Math.min(cognitiveSpec.confidence, 0.2),
          stage: 'trap_4_fail_closed_quarantine',
          requiresReview: true,
          dimensionSpec: dimRes.dimensionSpec,
          dimensionFormatted: null,
          configurationSpec: mergedConfigSpec,
          extractionNotes: mergedNotes.length > 0 ? mergedNotes : ['Geen verifieerbare afmetingen aangetroffen na cognitieve extractie'],
        };
      }

      if (candidateGroup === '9.9' && !hasCogDims && hasDeterministicConfiguredDims) {
        return {
          productGroupCode: '9.9',
          confidence: 0.2,
          stage: 'trap_2_configurator',
          requiresReview: true,
          dimensionSpec: dimRes.dimensionSpec,
          dimensionFormatted: dimRes.formattedDim,
          configurationSpec: mergedConfigSpec,
          extractionNotes: mergedConfigSpec.extraction_notes,
        };
      }

      return {
        productGroupCode: candidateGroup,
        confidence: cognitiveSpec.confidence,
        stage: 'trap_3_cognitive',
        requiresReview: cognitiveSpec.status === 'requires_review' || candidateGroup === '9.9',
        dimensionSpec: dimRes.dimensionSpec,
        dimensionFormatted: dimRes.formattedDim,
        configurationSpec: mergedConfigSpec,
        extractionNotes: mergedConfigSpec.extraction_notes,
      };
    }

    // --------------------------------------------------------------------------
    // Laag 3: Symbolische Fysica & Prijs Verificatie (Veiligheidspoort)
    // --------------------------------------------------------------------------
    const candidateGroup = effectiveGroup || '9.9';
    const dimRes = this.dimensionEngine.extractDimension(
      normalizedLine,
      candidateGroup,
      configSpec?.dimensions
    );

    // Fail-closed validatie op extreme afmetingen (> 12000 mm) of fallback afwijzing
    const isOutlier = dimRes.isOutlier || this.dimensionEngine.hasDimensionOutlier(normalizedLine);
    if (dimRes.source === 'fallback_default' || isOutlier) {
      const safeConfigSpec = isOutlier && configSpec ? { ...configSpec, dimensions: undefined } : configSpec;
      return {
        productGroupCode: candidateGroup,
        confidence: 0.1,
        stage: 'trap_4_fail_closed_quarantine',
        requiresReview: true,
        dimensionSpec: dimRes.dimensionSpec,
        dimensionFormatted: null,
        configurationSpec: safeConfigSpec,
        extractionNotes: isOutlier
          ? ['Extreme uitschieter afmetingen (> 12000 mm) afgewezen naar review']
          : ['Geen verifieerbare afmetingen aangetroffen - vereist handmatige controle'],
      };
    }

    return {
      productGroupCode: candidateGroup,
      confidence: candidateGroup === '9.9' ? 0.1 : 0.8,
      stage: candidateGroup === '9.9' ? 'trap_4_fail_closed_quarantine' : 'trap_1_master_cache',
      requiresReview: candidateGroup === '9.9',
      dimensionSpec: dimRes.dimensionSpec,
      dimensionFormatted: dimRes.formattedDim,
      configurationSpec: configSpec,
      extractionNotes,
    };
  }

  private stripBoilerplate(notes: string): string {
    if (!notes) return '';
    return notes
      .replace(/algemene\s+leveringsvoorwaarden.*$/i, '')
      .replace(/showroom\s+openingstijden.*$/i, '')
      .trim();
  }
}
