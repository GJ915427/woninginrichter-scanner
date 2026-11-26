/**
 * src/domain/orders/configuration-extraction-engine.ts
 *
 * 4-Traps Configuratie Extractie Engine:
 * - Trap 0: Directe ERP numerieke velden (0ms)
 * - Trap A: Gestructureerde e-Order JSON parsing & Configurator Items (0ms)
 * - Trap B: Deterministische Regex Tokenizer (<1ms)
 * - Trap C: Cognitieve Provider met Zod validatie & SHA-256 LRU Caching
 * - Trap D: Mechanische Cross-Validatie & Productgroep Reconciliatie Egress
 */

import { createHash } from 'crypto';
import type {
  RawOrderLineInput,
  ConfigurationSpec,
  ConfigurationDimensions,
  ICognitiveExtractionProvider,
} from '@/types/order-intake';
import { ConfigurationSpecSchema } from './configuration-schemas';
import {
  MIN_DIMENSION_MM,
  MAX_DIMENSION_MM,
  hasFiniteNumericDimension,
  isValidErpDimension,
  isSubMinimumErpDimension,
  isOutlierDimension,
  isOutOfPhysicalBoundsDimension,
  parseItemDimensionToMm,
} from './dimension-guards';
import {
  CONFIG_ANCHOR_OR_ATTR_LABEL_REGEX,
  extractConfigAttributesFromTexts,
} from './configuration-policies';

export interface ConfigurationEngineOptions {
  cognitiveProvider?: ICognitiveExtractionProvider;
  lruCacheSize?: number;
}

export interface ExtractedItemsResult {
  dimensions?: ConfigurationDimensions;
  attributes?: Record<string, unknown>;
  hasOutlier?: boolean;
}

export class DeterministicTokenizerProvider {
  /**
   * Converteert een maatstring met eenheid naar gehele millimeters.
   */
  public static parseUnitToMm(rawVal: string, unit?: string): number {
    const val = parseFloat(rawVal.replace(',', '.'));
    if (!Number.isFinite(val)) return 0;

    const u = (unit || '').toLowerCase().trim();
    if (u === 'm' || u === 'mtr' || u === 'meter') {
      return Math.round(val * 1000);
    }
    if (u === 'cm') {
      return Math.round(val * 10);
    }
    // Standaard aanname: mm (tenzij waarde < 10, dan meters)
    if (val < 10 && !u) {
      return Math.round(val * 1000);
    }
    return Math.round(val);
  }

  /**
   * Zoekt afmetingen in tekst via deterministische expressies.
   */
  public static tokenize(text: string): ConfigurationDimensions | null {
    if (!text) return null;

    // Patroon 1: Standaard kruismaat zonder tussenliggende letters: "2400 x 1800", "2400 × 1800 mm", "1450 x 2100"
    const standardCrossMatch = text.match(
      /(?:^|\s)(\d+(?:[.,]\d+)?)(?:\s*(mm|cm|m|mtr)\b(?![²2]))?\s*(?:[xX×*]|bij)\s*(\d+(?:[.,]\d+)?)(?:\s*(mm|cm|m|mtr)\b(?![²2]))?(?:\s|$)/i
    );
    if (standardCrossMatch) {
      const wRaw = standardCrossMatch[1];
      const wUnit = standardCrossMatch[2] || standardCrossMatch[4];
      const hRaw = standardCrossMatch[3];
      const hUnit = standardCrossMatch[4] || standardCrossMatch[2];

      const width_mm = this.parseUnitToMm(wRaw, wUnit);
      const height_mm = this.parseUnitToMm(hRaw, hUnit);

      if (width_mm > 0 && height_mm > 0) {
        return {
          width_mm,
          height_mm,
        };
      }
    }

    // Patroon 2: Volledige labels: "breedte 2,45 mtr hoogte 180 cm" of "breedte: 1450, hoogte: 2100"
    const separateMatch = text.match(
      /\bbreedte\s*[:=]?\s*(\d+(?:[.,]\d+)?)(?:\s*(mm|cm|m|mtr)\b(?![²2]))?.*?\bhoogte\s*[:=]?\s*(\d+(?:[.,]\d+)?)(?:\s*(mm|cm|m|mtr)\b(?![²2]))?/i
    );
    if (separateMatch) {
      const width_mm = this.parseUnitToMm(separateMatch[1], separateMatch[2]);
      const height_mm = this.parseUnitToMm(separateMatch[3], separateMatch[4]);
      if (width_mm > 0 && height_mm > 0) {
        return {
          width_mm,
          height_mm,
        };
      }
    }

    // Patroon 3: Alleen breedte bekend
    const singleWidthMatch = text.match(/\bbreedte\s*[:=]?\s*(?:[bB]:?\s*)?(\d+(?:[.,]\d+)?)(?:\s*(mm|cm|m|mtr)\b(?![²2]))?/i);
    const singleHeightMatch = text.match(/\bhoogte\s*[:=]?\s*(?:[hH]:?\s*)?(\d+(?:[.,]\d+)?)(?:\s*(mm|cm|m|mtr)\b(?![²2]))?/i);

    if (singleWidthMatch && !singleHeightMatch) {
      const width_mm = this.parseUnitToMm(singleWidthMatch[1], singleWidthMatch[2]);
      if (width_mm > 0) {
        return { width_mm };
      }
    }

    if (singleHeightMatch && !singleWidthMatch) {
      const height_mm = this.parseUnitToMm(singleHeightMatch[1], singleHeightMatch[2]);
      if (height_mm > 0) {
        return { height_mm };
      }
    }

    return null;
  }
}

export class ConfigurationExtractionEngine {
  private cognitiveProvider?: ICognitiveExtractionProvider;
  private lruCache: Map<string, ConfigurationSpec>;
  private maxCacheSize: number;

  constructor(options?: ConfigurationEngineOptions) {
    this.cognitiveProvider = options?.cognitiveProvider;
    this.maxCacheSize = options?.lruCacheSize || 5000;
    this.lruCache = new Map();
  }

  /**
   * Bepaalt of een array items een zuivere LogicTrade vragenlijst representeert zonder maatankers.
   */
  public static isQuestionnaireItems(items: unknown[]): boolean {
    if (!Array.isArray(items) || items.length === 0) return false;
    let hasValidOption = false;

    for (const item of items) {
      if (item && typeof item === 'object' && 'option' in item) {
        const rawOpt = (item as { option?: unknown }).option;
        if (typeof rawOpt === 'string') {
          const opt = rawOpt.trim();
          if (opt.length > 0) {
            hasValidOption = true;
            if (CONFIG_ANCHOR_OR_ATTR_LABEL_REGEX.test(opt)) {
              return false; // Heeft maat-/configuratie-anker -> GEEN pure vragenlijst
            }
          }
        }
      }
    }
    return hasValidOption;
  }

  /**
   * Extraheert gestructureerde afmetingen en specificaties uit LogicTrade configuration.items
   */
  public static extractFromConfigurationItems(
    items: unknown[],
    supplierName?: string,
    description?: string,
    productGroupCode?: string
  ): ExtractedItemsResult | null {
    if (!Array.isArray(items) || items.length === 0) return null;

    const STRICT_DIM_ITEM_REGEX = /^(\d+(?:[.,]\d+)?)\s*(mm|cm|m|mtr)?$/i;

    // 1. Type-veilige normalisatie op rawNormalized (met behoud van lege slots voor index-offsetting)
    const rawNormalized: string[] = items.map((item) => {
      if (typeof item === 'string') return item.trim();
      if (typeof item === 'number') return String(item).trim();
      if (item && typeof item === 'object') {
        if ('key' in item && 'value' in item) {
          const rawKey = (item as { key?: unknown }).key;
          const k = typeof rawKey === 'string' ? rawKey.trim() : '';
          const v = String((item as { value?: unknown }).value ?? '').trim();
          return k ? `${k}: ${v}`.trim() : v;
        }
        if ('option' in item) {
          const rawOpt = (item as { option?: unknown }).option;
          const opt = typeof rawOpt === 'string' ? rawOpt.trim() : '';
          const v = 'value' in item ? String((item as { value?: unknown }).value ?? '').trim() : '';
          if (opt.length > 0) {
            return CONFIG_ANCHOR_OR_ATTR_LABEL_REGEX.test(opt) && 'value' in item ? `${opt}: ${v}`.trim() : '';
          }
          return v; // opt leeg of ontbreekt -> behoud value voor positionele lookahead slots
        }
        if ('value' in item) {
          return String((item as { value?: unknown }).value ?? '').trim();
        }
      }
      return '';
    });

    const nonEmpty = rawNormalized.filter(Boolean);
    if (nonEmpty.length === 0) return null;

    // SSOT Beleids-extractie
    const attributes = extractConfigAttributesFromTexts(nonEmpty, productGroupCode, description);

    let width_mm: number | undefined;
    let height_mm: number | undefined;

    // 2. Anker-gebaseerde extractie met optionele parenthetische eenheden: Breedte (mm): 1070 of Blijvende maat: 1550 mm
    for (const text of nonEmpty) {
      const widthAnchorMatch = text.match(
        /\b(?:blijvende\s*maat|dagmaat|bestelmaat|productmaat|breedte|lengte)(?:\s*\((mm|cm|m|mtr)\))?\s*[:=]?\s*(\d+(?:[.,]\d+)?)(?:\s*(mm|cm|m|mtr)\b(?![²2]))?/i
      );
      if (widthAnchorMatch && !width_mm) {
        const parsed = parseItemDimensionToMm(
          widthAnchorMatch[2],
          widthAnchorMatch[3] || widthAnchorMatch[1]
        );
        if (parsed !== null) {
          if (isOutlierDimension(parsed)) return { hasOutlier: true, attributes: Object.keys(attributes).length > 0 ? attributes : undefined };
          if (isValidErpDimension(parsed)) width_mm = parsed;
        }
      }

      const heightAnchorMatch = text.match(
        /\b(?:hoogte)(?:\s*\((mm|cm|m|mtr)\))?\s*[:=]?\s*(\d+(?:[.,]\d+)?)(?:\s*(mm|cm|m|mtr)\b(?![²2]))?/i
      );
      if (heightAnchorMatch && !height_mm) {
        const parsed = parseItemDimensionToMm(
          heightAnchorMatch[2],
          heightAnchorMatch[3] || heightAnchorMatch[1]
        );
        if (parsed !== null) {
          if (isOutlierDimension(parsed)) return { hasOutlier: true, attributes: Object.keys(attributes).length > 0 ? attributes : undefined };
          if (isValidErpDimension(parsed)) height_mm = parsed;
        }
      }
    }

    if (width_mm && height_mm) {
      return {
        dimensions: { width_mm, height_mm },
        attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
      };
    }

    // 3. Positionele Lookahead op rawNormalized (horizon i + 10 met expliciete 0-hoogte guard)
    const ANCHOR_REGEX = /\b(blijvende\s*maat|dagmaat|bestelmaat|productmaat)\b/i;
    for (let i = 0; i < rawNormalized.length - 1; i++) {
      const slot0 = rawNormalized[i];
      if (ANCHOR_REGEX.test(slot0)) {
        const maxLook = Math.min(rawNormalized.length - 1, i + 10);
        const numericCandidates: Array<{ index: number; mm: number }> = [];

        for (let idx = i + 1; idx <= maxLook; idx++) {
          const slot = rawNormalized[idx];
          const m = slot.match(STRICT_DIM_ITEM_REGEX);
          if (!m) continue;

          const parsed = parseItemDimensionToMm(m[1], m[2]);
          if (parsed === null) continue;

          if (isOutlierDimension(parsed)) {
            return { hasOutlier: true, attributes: Object.keys(attributes).length > 0 ? attributes : undefined };
          }

          // DB 433888 ("losse koof"): als numericCandidates al 1 kandidaat heeft en het direct
          // daaropvolgende slot is expliciet '0', breek de horizon af en retourneer 1D!
          if (numericCandidates.length === 1 && idx === numericCandidates[0].index + 1 && parsed === 0) {
            return {
              dimensions: { width_mm: numericCandidates[0].mm },
              attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
            };
          }

          if (isValidErpDimension(parsed)) {
            numericCandidates.push({ index: idx, mm: parsed });
          }
        }

        if (numericCandidates.length >= 2) {
          // Voorkeur voor intern opeenvolgend paar (bijv. 494020: index 6 en 7 -> 2250, 1000)
          let pair = [numericCandidates[0].mm, numericCandidates[1].mm];
          for (let k = 0; k < numericCandidates.length - 1; k++) {
            if (numericCandidates[k].index + 1 === numericCandidates[k + 1].index) {
              pair = [numericCandidates[k].mm, numericCandidates[k + 1].mm];
              break;
            }
          }
          return {
            dimensions: { width_mm: pair[0], height_mm: pair[1] },
            attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
          };
        } else if (numericCandidates.length === 1) {
          // 1D rail maat
          return {
            dimensions: { width_mm: numericCandidates[0].mm },
            attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
          };
        }
      }
    }

    // 4. Textiel-CM Sequencer (Vadain gordijnen / vitrages): zoek naar opeenvolgende "xxx cm" waarden
    const isTextileContext =
      productGroupCode === '1.1' ||
      /gordijn|plooigordijn|inbetween|vitrage/i.test(description || '') ||
      rawNormalized.some((v) => /plooigordijn|vlinder\s*plooi|comfort\s*gordijn/i.test(v));

    if (isTextileContext) {
      for (let i = 0; i < rawNormalized.length - 1; i++) {
        const m1 = rawNormalized[i].match(/^(\d+(?:[.,]\d+)?)\s*cm$/i);
        const m2 = rawNormalized[i + 1].match(/^(\d+(?:[.,]\d+)?)\s*cm$/i);
        if (m1 && m2) {
          const wParsed = parseItemDimensionToMm(m1[1], 'cm');
          const hParsed = parseItemDimensionToMm(m2[1], 'cm');
          if (wParsed !== null && hParsed !== null) {
            if (isOutlierDimension(wParsed) || isOutlierDimension(hParsed)) {
              return { hasOutlier: true, attributes: Object.keys(attributes).length > 0 ? attributes : undefined };
            }
            if (isValidErpDimension(wParsed) && isValidErpDimension(hParsed)) {
              return {
                dimensions: { width_mm: wParsed, height_mm: hParsed },
                attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
              };
            }
          }
        }
      }
    }

    // 5. Domein-geïsoleerd Sliding Sjabloon voor Horren & Screens (Unilux / KeJe / 2.5)
    const isHorOrScreen = Boolean(
      (productGroupCode === '2.5') ||
      (supplierName && /unilux|keje/i.test(supplierName)) ||
      (description && /\b(?:inklemhor|voorzethor|raamhor|inzethor|rolhor|pliss[eé]\s*hordeur|hordeur|\bhor)\b/i.test(description))
    );

    if (isHorOrScreen && nonEmpty.length >= 2) {
      for (let i = 0; i < nonEmpty.length - 1; i++) {
        const m1 = nonEmpty[i].match(STRICT_DIM_ITEM_REGEX);
        const m2 = nonEmpty[i + 1].match(STRICT_DIM_ITEM_REGEX);
        if (m1 && m2) {
          const wCand = parseItemDimensionToMm(m1[1], m1[2]);
          const hCand = parseItemDimensionToMm(m2[1], m2[2]);
          if (wCand !== null && hCand !== null) {
            if (isOutlierDimension(wCand) || isOutlierDimension(hCand)) {
              return { hasOutlier: true, attributes: Object.keys(attributes).length > 0 ? attributes : undefined };
            }
            if (isValidErpDimension(wCand) && isValidErpDimension(hCand)) {
              return {
                dimensions: { width_mm: wCand, height_mm: hCand },
                attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
              };
            }
          }
        }
      }
    }

    // 6. Tokenize overige items met index-quarantaine (< 15)
    const scanLimit = Math.min(nonEmpty.length, 15);
    for (let i = 0; i < scanLimit; i++) {
      const text = nonEmpty[i];
      const dims = DeterministicTokenizerProvider.tokenize(text);
      if (dims && dims.width_mm && dims.height_mm) {
        if (isOutlierDimension(dims.width_mm) || isOutlierDimension(dims.height_mm)) {
          return { hasOutlier: true, attributes: Object.keys(attributes).length > 0 ? attributes : undefined };
        }
        if (isValidErpDimension(dims.width_mm) && isValidErpDimension(dims.height_mm)) {
          return {
            dimensions: dims,
            attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
          };
        }
      }
    }

    if (width_mm || height_mm) {
      return {
        dimensions: { width_mm, height_mm },
        attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
      };
    }

    if (Object.keys(attributes).length > 0) {
      return { attributes };
    }

    return null;
  }

  public computeContentHash(text: string): string {
    return createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
  }

  /**
   * Voert de 4-traps extractie-cascade uit met aansluitende cross-validatie (Trap D).
   */
  public async extractConfiguration(
    rawLine: RawOrderLineInput,
    productGroupCode?: string,
    options?: { skipCognitive?: boolean }
  ): Promise<ConfigurationSpec> {
    let bestPartialSpec: ConfigurationSpec | null = null;
    const trapAAttributes: Record<string, unknown> = {};

    // --------------------------------------------------------------------------
    // Trap 0: Directe ERP Numerieke Velden (0ms)
    // --------------------------------------------------------------------------
    const rawW = rawLine.width_mm ?? (rawLine as any).lt_width_mm;
    const rawH = rawLine.height_mm ?? (rawLine as any).lt_height_mm;

    if (isOutOfPhysicalBoundsDimension(rawW) || isOutOfPhysicalBoundsDimension(rawH)) {
      const outlierSpec: ConfigurationSpec = {
        status: 'requires_review',
        confidence: 0.1,
        source: 'erp_fields',
        dimensions: undefined,
        extraction_notes: ['Afmetingen buiten fysieke veiligheidsgrenzen (100 - 12000 mm)'],
      };
      return this.crossValidateConfiguration(outlierSpec, productGroupCode, rawLine);
    }

    if (isValidErpDimension(rawW) && isValidErpDimension(rawH)) {
      const spec: ConfigurationSpec = {
        status: 'valid',
        confidence: 1.0,
        source: 'erp_fields',
        dimensions: {
          width_mm: Math.round(rawW),
          height_mm: Math.round(rawH),
        },
        options: rawLine.options || (rawLine as any).lt_options || [],
      };
      return this.crossValidateConfiguration(spec, productGroupCode, rawLine);
    }

    if (isValidErpDimension(rawW) && !isValidErpDimension(rawH)) {
      bestPartialSpec = {
        status: 'incomplete',
        confidence: 1.0,
        source: 'erp_fields',
        dimensions: { width_mm: Math.round(rawW) },
        options: rawLine.options || (rawLine as any).lt_options || [],
      };
    } else if (!isValidErpDimension(rawW) && isValidErpDimension(rawH)) {
      bestPartialSpec = {
        status: 'incomplete',
        confidence: 1.0,
        source: 'erp_fields',
        dimensions: { height_mm: Math.round(rawH) },
        options: rawLine.options || (rawLine as any).lt_options || [],
      };
    }

    // --------------------------------------------------------------------------
    // Trap A: Gestructureerde e-Order JSON & Configurator Items (0ms)
    // --------------------------------------------------------------------------
    const rawConfigJson = rawLine.configuration_json || (rawLine as any).lt_configuration_json;
    const rawConfig = rawLine.configuration || (rawLine as any).lt_configuration;

    if (rawConfigJson && typeof rawConfigJson === 'object') {
      const json = rawConfigJson as Record<string, unknown>;
      const w = typeof json.width_mm === 'number' ? json.width_mm : undefined;
      const h = typeof json.height_mm === 'number' ? json.height_mm : undefined;

      for (const [k, v] of Object.entries(json)) {
        if (k !== 'width_mm' && k !== 'height_mm') {
          trapAAttributes[k] = v;
        }
      }

      if (isOutOfPhysicalBoundsDimension(w) || isOutOfPhysicalBoundsDimension(h)) {
        const outlierSpec: ConfigurationSpec = {
          status: 'requires_review',
          confidence: 0.1,
          source: 'eorder_json',
          dimensions: undefined,
          attributes: Object.keys(trapAAttributes).length > 0 ? trapAAttributes : undefined,
          extraction_notes: ['Afmetingen buiten fysieke veiligheidsgrenzen (100 - 12000 mm)'],
        };
        return this.crossValidateConfiguration(outlierSpec, productGroupCode, rawLine);
      }

      if (isValidErpDimension(w) && isValidErpDimension(h)) {
        const spec: ConfigurationSpec = {
          status: 'valid',
          confidence: 1.0,
          source: 'eorder_json',
          dimensions: {
            width_mm: Math.round(w),
            height_mm: Math.round(h),
          },
          attributes: Object.keys(trapAAttributes).length > 0 ? trapAAttributes : undefined,
        };
        return this.crossValidateConfiguration(spec, productGroupCode, rawLine);
      }

      if (isValidErpDimension(w) && !isValidErpDimension(h)) {
        bestPartialSpec = {
          status: 'incomplete',
          confidence: 1.0,
          source: 'eorder_json',
          dimensions: { width_mm: Math.round(w) },
          attributes: Object.keys(trapAAttributes).length > 0 ? { ...trapAAttributes } : undefined,
        };
      } else if (!isValidErpDimension(w) && isValidErpDimension(h)) {
        bestPartialSpec = {
          status: 'incomplete',
          confidence: 1.0,
          source: 'eorder_json',
          dimensions: { height_mm: Math.round(h) },
          attributes: Object.keys(trapAAttributes).length > 0 ? { ...trapAAttributes } : undefined,
        };
      }
    }

    if (rawConfig?.items && Array.isArray(rawConfig.items)) {
      const extracted = ConfigurationExtractionEngine.extractFromConfigurationItems(
        rawConfig.items,
        rawLine.supplier_name,
        rawLine.description,
        productGroupCode
      );

      if (extracted?.attributes) {
        Object.assign(trapAAttributes, extracted.attributes);
      }

      if (extracted?.hasOutlier) {
        const outlierSpec: ConfigurationSpec = {
          status: 'requires_review',
          confidence: 0.1,
          source: 'eorder_json',
          dimensions: undefined,
          attributes: Object.keys(trapAAttributes).length > 0 ? trapAAttributes : undefined,
          extraction_notes: ['Afmetingen buiten fysieke veiligheidsgrenzen (100 - 12000 mm)'],
        };
        return this.crossValidateConfiguration(outlierSpec, productGroupCode, rawLine);
      }

      if (extracted && extracted.dimensions) {
        const w = extracted.dimensions.width_mm;
        const h = extracted.dimensions.height_mm;
        if (isValidErpDimension(w) && isValidErpDimension(h)) {
          const spec: ConfigurationSpec = {
            status: 'valid',
            confidence: 1.0,
            source: 'eorder_json',
            dimensions: { width_mm: w, height_mm: h },
            attributes: Object.keys(trapAAttributes).length > 0 ? trapAAttributes : undefined,
          };
          return this.crossValidateConfiguration(spec, productGroupCode, rawLine);
        }

        if (isValidErpDimension(w) && !isValidErpDimension(h)) {
          bestPartialSpec = {
            status: 'incomplete',
            confidence: 1.0,
            source: 'eorder_json',
            dimensions: { width_mm: w },
            attributes: Object.keys(trapAAttributes).length > 0 ? { ...trapAAttributes } : undefined,
          };
        } else if (!isValidErpDimension(w) && isValidErpDimension(h)) {
          bestPartialSpec = {
            status: 'incomplete',
            confidence: 1.0,
            source: 'eorder_json',
            dimensions: { height_mm: h },
            attributes: Object.keys(trapAAttributes).length > 0 ? { ...trapAAttributes } : undefined,
          };
        }
      }
    }

    // --------------------------------------------------------------------------
    // Trap B: Deterministische Regex Tokenizer (<1ms)
    // --------------------------------------------------------------------------
    const combinedText = `${rawLine.description || ''} ${rawLine.notes || ''}`.trim();
    const tokenizedDims = DeterministicTokenizerProvider.tokenize(combinedText);
    if (tokenizedDims) {
      const tw = tokenizedDims.width_mm;
      const th = tokenizedDims.height_mm;

      if (isOutOfPhysicalBoundsDimension(tw) || isOutOfPhysicalBoundsDimension(th)) {
        const outlierSpec: ConfigurationSpec = {
          status: 'requires_review',
          confidence: 0.1,
          source: 'regex_tokenizer',
          dimensions: undefined,
          attributes: Object.keys(trapAAttributes).length > 0 ? trapAAttributes : undefined,
          extraction_notes: ['Afmetingen buiten fysieke veiligheidsgrenzen (100 - 12000 mm)'],
        };
        return this.crossValidateConfiguration(outlierSpec, productGroupCode, rawLine);
      }

      if (isValidErpDimension(tw) && isValidErpDimension(th)) {
        const spec: ConfigurationSpec = {
          status: 'valid',
          confidence: 0.95,
          source: 'regex_tokenizer',
          dimensions: tokenizedDims,
          attributes: Object.keys(trapAAttributes).length > 0 ? trapAAttributes : undefined,
        };
        return this.crossValidateConfiguration(spec, productGroupCode, rawLine);
      }

      if (!bestPartialSpec) {
        if (isValidErpDimension(tw) && !isValidErpDimension(th)) {
          bestPartialSpec = {
            status: 'incomplete',
            confidence: 0.95,
            source: 'regex_tokenizer',
            dimensions: { width_mm: tw },
            attributes: Object.keys(trapAAttributes).length > 0 ? { ...trapAAttributes } : undefined,
          };
        } else if (!isValidErpDimension(tw) && isValidErpDimension(th)) {
          bestPartialSpec = {
            status: 'incomplete',
            confidence: 0.95,
            source: 'regex_tokenizer',
            dimensions: { height_mm: th },
            attributes: Object.keys(trapAAttributes).length > 0 ? { ...trapAAttributes } : undefined,
          };
        }
      }
    }

    // --------------------------------------------------------------------------
    // Trap C: Cognitieve Provider met LRU Caching
    // --------------------------------------------------------------------------
    if (!options?.skipCognitive && this.cognitiveProvider && combinedText.length > 0 && !bestPartialSpec) {
      const hash = this.computeContentHash(`${combinedText}_${productGroupCode || ''}`);

      if (this.lruCache.has(hash)) {
        const cached = this.lruCache.get(hash)!;
        // Move to end for LRU refresh
        this.lruCache.delete(hash);
        this.lruCache.set(hash, cached);
        // Shallow copy to guarantee cache immutability
        const clonedCached: ConfigurationSpec = {
          ...cached,
          dimensions: cached.dimensions ? { ...cached.dimensions } : undefined,
          attributes: {
            ...trapAAttributes,
            ...(cached.attributes ? { ...cached.attributes } : {}),
          },
        };
        if (Object.keys(clonedCached.attributes || {}).length === 0) {
          clonedCached.attributes = undefined;
        }
        return this.crossValidateConfiguration(clonedCached, productGroupCode, rawLine);
      }

      try {
        const extracted = await this.cognitiveProvider.extract(rawLine, productGroupCode);
        const parsed = ConfigurationSpecSchema.safeParse(extracted);

        const validSpec: ConfigurationSpec = parsed.success
          ? parsed.data
          : {
              status: 'requires_review',
              confidence: 0.2,
              source: 'cognitive',
              extraction_notes: ['Schema validatie fout op cognitieve output'],
            };

        // Cache update met LRU eviction
        if (this.lruCache.size >= this.maxCacheSize) {
          const oldestKey = this.lruCache.keys().next().value;
          if (oldestKey) this.lruCache.delete(oldestKey);
        }
        this.lruCache.set(hash, validSpec);

        const clonedValid: ConfigurationSpec = {
          ...validSpec,
          dimensions: validSpec.dimensions ? { ...validSpec.dimensions } : undefined,
          attributes: {
            ...trapAAttributes,
            ...(validSpec.attributes ? { ...validSpec.attributes } : {}),
          },
        };
        if (Object.keys(clonedValid.attributes || {}).length === 0) {
          clonedValid.attributes = undefined;
        }
        return this.crossValidateConfiguration(clonedValid, productGroupCode, rawLine);
      } catch (err: unknown) {
        const fallbackSpec: ConfigurationSpec = {
          status: 'requires_review',
          confidence: 0.0,
          source: 'cognitive',
          extraction_notes: [`Cognitieve extractie fout: ${err instanceof Error ? err.message : String(err)}`],
        };
        return this.crossValidateConfiguration(fallbackSpec, productGroupCode, rawLine);
      }
    }

    // --------------------------------------------------------------------------
    // Partiële 1D Fallback Gate (vóór Trap C fallback / manual)
    // --------------------------------------------------------------------------
    if (bestPartialSpec) {
      const mergedAttrs = {
        ...trapAAttributes,
        ...(bestPartialSpec.attributes || {}),
      };
      const resolvedSpec: ConfigurationSpec = {
        ...bestPartialSpec,
        attributes: Object.keys(mergedAttrs).length > 0 ? mergedAttrs : undefined,
      };
      return this.crossValidateConfiguration(resolvedSpec, productGroupCode, rawLine);
    }

    // Attribuut-only Fallback
    if (Object.keys(trapAAttributes).length > 0) {
      const attrSpec: ConfigurationSpec = {
        status: 'incomplete',
        confidence: 1.0,
        source: 'eorder_json',
        attributes: trapAAttributes,
        extraction_notes: ['Alleen configuratieattributen aangetroffen zonder afmetingen'],
      };
      return this.crossValidateConfiguration(attrSpec, productGroupCode, rawLine);
    }

    // Fallback voor onbewerkte regels
    const fallbackSpec: ConfigurationSpec = {
      status: 'requires_review',
      confidence: 0.0,
      source: 'manual',
      extraction_notes: ['Geen afmetingen of configuratiespecificaties aangetroffen'],
    };
    return this.crossValidateConfiguration(fallbackSpec, productGroupCode, rawLine);
  }

  /**
   * Trap D: Mechanische Cross-Validatie tegen categorie-incompatibiliteiten & Reconciliatie
   */
  public crossValidateConfiguration(
    spec: ConfigurationSpec,
    productGroupCode?: string,
    rawLine?: RawOrderLineInput
  ): ConfigurationSpec {
    const validated = { ...spec };
    const notes: string[] = [...(validated.extraction_notes || [])];

    // 1. Toets incomplete afmetingen
    if (validated.dimensions) {
      if (validated.dimensions.width_mm && !validated.dimensions.height_mm) {
        validated.status = 'incomplete';
        notes.push('Hoogte ontbreekt in configuratietekst');
      } else if (!validated.dimensions.width_mm && validated.dimensions.height_mm) {
        validated.status = 'incomplete';
        notes.push('Breedte ontbreekt in configuratietekst');
      }
    }

    // 2. Fysieke veiligheidsgrenzen (100 - 12000 mm)
    if (validated.dimensions) {
      const w = validated.dimensions.width_mm;
      const h = validated.dimensions.height_mm;
      const isOutlier = isOutOfPhysicalBoundsDimension(w) || isOutOfPhysicalBoundsDimension(h);

      if (isOutlier) {
        validated.status = 'requires_review';
        if (validated.confidence > 0.2) validated.confidence = 0.1;
        validated.dimensions = undefined;
        notes.push('Afmetingen buiten fysieke veiligheidsgrenzen (100 - 12000 mm)');
      }
    }

    // 3. Mechanische Reconciliatie Categorie-incompatibiliteiten
    if (productGroupCode) {
      const grp = productGroupCode.trim();

      // Categorie 3 (Vloeren) mag géén plooitypen of gordijnattributen bevatten
      if (grp.startsWith('3.')) {
        const attrs = validated.attributes || {};
        const hasCurtainAttr = Boolean(
          attrs.pleat_type || attrs.hook_type || attrs.track_type || attrs.operation === 'koord'
        );

        if (hasCurtainAttr) {
          validated.reconciled_product_group_code = '1.1'; // Gordijnen
          notes.push(`Productgroep gereconcilieerd van ${grp} naar 1.1 wegens plooitype`);
        }
      }

      // Categorie 1 (Gordijnen) mag géén vloerattributen bevatten
      if (grp.startsWith('1.')) {
        const attrs = validated.attributes || {};
        const hasFloorAttr = Boolean(attrs.subfloor || attrs.plinth_type || attrs.laying_pattern);

        if (hasFloorAttr) {
          validated.reconciled_product_group_code = '3.1'; // Vloeren
          notes.push(`Productgroep gereconcilieerd van ${grp} naar 3.1 wegens vloerkenmerken`);
        }
      }
    }

    if (notes.length > 0) {
      validated.extraction_notes = Array.from(new Set(notes));
    }

    return validated;
  }
}
