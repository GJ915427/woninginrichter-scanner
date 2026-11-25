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
import { ClassificationService } from '@/domain/classification/central-classification-service';
import { ConfigurationExtractionEngine } from '@/domain/orders/configuration-extraction-engine';
import { DimensionExtractionEngine } from '@/domain/orders/dimension-extraction-engine';
import {
  detectIsMaterialAndService,
  detectServiceDiscipline,
  SERVICE_DISCIPLINE_TO_PRODUCT_GROUP,
} from '@/domain/search/v2/cognitive-typology-classifier';

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
        extractionNotes: ['Informatieve tekst / clausule à €0'],
      };
    }

    // 1.2 5-Traps Credit Triage bij negatieve bedragen
    if (totalPrice < 0) {
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
          extractionNotes: ['Onbekende negatieve boeking/credit vereist handmatige controle'],
        };
      }

      return {
        productGroupCode: creditRes.productGroupCode,
        confidence: creditRes.confidence,
        stage: creditRes.stage === 'trap_1_master_cache' ? 'trap_1_master_cache' : 'trap_2_configurator',
        requiresReview: creditRes.requiresReview,
        isHybrid: creditRes.isHybrid,
        serviceDisciplineCode: creditRes.serviceDisciplineCode,
      };
    }

    // 1.3 Zuivere Catalogus-Gedreven Diensten (6.x) met confidence 1.000 (immuun voor notities)
    if (catalogProduct?.product_group_code?.startsWith('6.') && !catalogProduct.is_generic_container) {
      const dimRes = this.dimensionEngine.extractDimension(line, catalogProduct.product_group_code);
      return {
        productGroupCode: catalogProduct.product_group_code,
        confidence: 1.0,
        stage: 'trap_1_master_cache',
        requiresReview: false,
        dimensionSpec: dimRes.dimensionSpec,
        isHybrid: false,
      };
    }

    // 1.4 Bepaal initiële productgroep via catalogus of Central Classification Service
    let effectiveGroup = catalogProduct?.product_group_code;
    let isClassifiedHybrid = false;
    let classifiedServiceDiscipline: string | undefined;

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
    }

    // 1.5 Configurator Extractie (Dealer Connect / Zonnelux / Sunway / KeJe / Unilux / ERP velden)
    let configSpec: ConfigurationSpec | undefined;
    const configData = line.configuration || line.lt_configuration;
    const hasConfigInput = Boolean(
      configData ||
      line.configuration_json ||
      line.lt_configuration_json ||
      line.width_mm ||
      line.height_mm ||
      line.lt_width_mm ||
      line.lt_height_mm ||
      (line.options && line.options.length > 0) ||
      (line.lt_options && line.lt_options.length > 0)
    );
    if (hasConfigInput) {
      configSpec = await this.extractionEngine.extractConfiguration(
        { ...line, notes: cleanedNotes, configuration: configData as any },
        effectiveGroup
      );
    }

    // Toets deterministische configurator maten ($100 <= mm <= 12000)
    if (configSpec?.dimensions?.width_mm && configSpec.dimensions.height_mm) {
      const w = configSpec.dimensions.width_mm;
      const h = configSpec.dimensions.height_mm;
      if (w >= 100 && w <= 12000 && h >= 100 && h <= 12000) {
        const productGroup = effectiveGroup || '2.1';
        const dimRes = this.dimensionEngine.extractDimension(
          { ...line, notes: cleanedNotes },
          productGroup,
          configSpec.dimensions
        );

        return {
          productGroupCode: productGroup,
          confidence: configSpec.confidence || 0.95,
          stage: 'trap_2_configurator',
          requiresReview: configSpec.status === 'requires_review',
          dimensionSpec: dimRes.dimensionSpec,
          configurationSpec: configSpec,
          isHybrid: isClassifiedHybrid,
          serviceDisciplineCode: classifiedServiceDiscipline,
        };
      }
    }

    // 1.6 Statische catalogus / geclassificeerde SKUs (zonder container status)
    if (effectiveGroup && effectiveGroup !== '9.9' && !catalogProduct?.is_generic_container) {
      const dimRes = this.dimensionEngine.extractDimension(
        { ...line, notes: cleanedNotes },
        effectiveGroup,
        configSpec?.dimensions
      );

      // Laag 3 Safety Gate: Check extreme fysieke uitschieters in ERP velden of vrije tekst
      const isOutlier = dimRes.isOutlier || this.dimensionEngine.hasDimensionOutlier(line);
      if (isOutlier) {
        return {
          productGroupCode: effectiveGroup,
          confidence: 0.1,
          stage: 'trap_4_fail_closed_quarantine',
          requiresReview: true,
          dimensionSpec: dimRes.dimensionSpec,
          extractionNotes: ['Extreme uitschieter afmetingen (> 12000 mm) afgewezen naar review'],
        };
      }

      // Controleer op hybride materiaal/dienst
      const textToScan = `${line.description} ${catalogProduct?.name || ''}`.toLowerCase();
      const isHybrid = isClassifiedHybrid || detectIsMaterialAndService(textToScan);
      let serviceDisciplineCode = classifiedServiceDiscipline;
      if (isHybrid && !serviceDisciplineCode) {
        const sRes = detectServiceDiscipline(textToScan);
        if (sRes?.discipline) {
          serviceDisciplineCode = SERVICE_DISCIPLINE_TO_PRODUCT_GROUP[sRes.discipline];
        }
      }

      return {
        productGroupCode: effectiveGroup,
        confidence: 1.0,
        stage: 'trap_1_master_cache',
        requiresReview: false,
        dimensionSpec: dimRes.dimensionSpec,
        configurationSpec: configSpec,
        isHybrid,
        serviceDisciplineCode,
      };
    }

    // --------------------------------------------------------------------------
    // Laag 2: AI Semantic Extractor met Ordercontext (Cognitive Escalation)
    // --------------------------------------------------------------------------
    const shouldEscalate =
      Boolean(catalogProduct?.is_generic_container) ||
      !catalogProduct ||
      effectiveGroup === '9.9' ||
      (!configSpec && line.notes && line.notes.length > 20);

    if (shouldEscalate && this.cognitiveProvider) {
      // Laag 3 Safety Gate: Check extreme fysieke uitschieters in ERP velden of vrije tekst vóór Laag 2 acceptatie
      if (this.dimensionEngine.hasDimensionOutlier(line)) {
        return {
          productGroupCode: effectiveGroup || '9.9',
          confidence: 0.1,
          stage: 'trap_4_fail_closed_quarantine',
          requiresReview: true,
          extractionNotes: ['Extreme uitschieter afmetingen (> 12000 mm) afgewezen naar review'],
        };
      }

      const cognitiveContext: CognitiveExtractionContext = context || {
        line: { ...line, notes: cleanedNotes },
        catalogProduct,
      };

      const cognitiveSpec = await this.cognitiveProvider.extract(
        cognitiveContext,
        effectiveGroup
      );

      if (cognitiveSpec.status === 'requires_review' && cognitiveSpec.confidence <= 0.2) {
        return {
          productGroupCode: effectiveGroup || '9.9',
          confidence: cognitiveSpec.confidence,
          stage: 'trap_4_fail_closed_quarantine',
          requiresReview: true,
          configurationSpec: cognitiveSpec,
          extractionNotes: cognitiveSpec.extraction_notes || ['Cognitieve provider markeerde regel als review'],
        };
      }

      const candidateGroup = effectiveGroup || '1.1';
      const dimRes = this.dimensionEngine.extractDimension(
        { ...line, notes: cleanedNotes },
        candidateGroup,
        cognitiveSpec.dimensions
      );

      return {
        productGroupCode: candidateGroup,
        confidence: cognitiveSpec.confidence,
        stage: 'trap_3_cognitive',
        requiresReview: cognitiveSpec.status === 'requires_review',
        dimensionSpec: dimRes.dimensionSpec,
        configurationSpec: cognitiveSpec,
        extractionNotes: cognitiveSpec.extraction_notes,
      };
    }

    // --------------------------------------------------------------------------
    // Laag 3: Symbolische Fysica & Prijs Verificatie (Veiligheidspoort)
    // --------------------------------------------------------------------------
    const candidateGroup = effectiveGroup || '9.9';
    const dimRes = this.dimensionEngine.extractDimension(
      { ...line, notes: cleanedNotes },
      candidateGroup
    );

    // Fail-closed validatie op extreme afmetingen (> 12000 mm) of fallback afwijzing
    const isOutlier = dimRes.isOutlier || this.dimensionEngine.hasDimensionOutlier(line);
    if (dimRes.source === 'fallback_default' || isOutlier) {
      return {
        productGroupCode: candidateGroup,
        confidence: 0.1,
        stage: 'trap_4_fail_closed_quarantine',
        requiresReview: true,
        dimensionSpec: dimRes.dimensionSpec,
        extractionNotes: ['Extreme uitschieter afmetingen (> 12000 mm) afgewezen naar review'],
      };
    }

    return {
      productGroupCode: candidateGroup,
      confidence: candidateGroup === '9.9' ? 0.1 : 0.8,
      stage: candidateGroup === '9.9' ? 'trap_4_fail_closed_quarantine' : 'trap_1_master_cache',
      requiresReview: candidateGroup === '9.9',
      dimensionSpec: dimRes.dimensionSpec,
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
