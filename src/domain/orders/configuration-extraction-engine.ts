/**
 * src/domain/orders/configuration-extraction-engine.ts
 *
 * 4-Traps Configuratie Extractie Engine:
 * - Trap 0: Directe ERP numerieke velden (0ms)
 * - Trap A: Gestructureerde e-Order JSON parsing (0ms)
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

export interface ConfigurationEngineOptions {
  cognitiveProvider?: ICognitiveExtractionProvider;
  lruCacheSize?: number;
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
      /(?:^|\s)(\d+(?:[.,]\d+)?)\s*(mm|cm|m|mtr)?\s*(?:[xX×*]|bij)\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m|mtr)?(?:\s|$)/i
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
      /breedte\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m|mtr)?.*?\bhoogte\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m|mtr)?/i
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
    const singleWidthMatch = text.match(/breedte\s*[:=]?\s*(?:[bB]:?\s*)?(\d+(?:[.,]\d+)?)\s*(mm|cm|m|mtr)?/i);
    const singleHeightMatch = text.match(/hoogte\s*[:=]?\s*(?:[hH]:?\s*)?(\d+(?:[.,]\d+)?)\s*(mm|cm|m|mtr)?/i);

    if (singleWidthMatch && !singleHeightMatch) {
      const width_mm = this.parseUnitToMm(singleWidthMatch[1], singleWidthMatch[2]);
      if (width_mm > 0) {
        return { width_mm };
      }
    }

    if (singleHeightMatch && !singleWidthMatch) {
      const height_mm = this.parseUnitToMm(singleHeightMatch[1], singleHeightMatch[2]);
      if (height_mm > 0) {
        return { width_mm: 0, height_mm };
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
   * Extraheert gestructureerde afmetingen en specificaties uit LogicTrade configuration.items
   */
  public static extractFromConfigurationItems(
    items: unknown[],
    supplierName?: string,
    description?: string,
    productGroupCode?: string
  ): { dimensions?: ConfigurationDimensions; attributes?: Record<string, unknown> } | null {
    if (!Array.isArray(items) || items.length === 0) return null;

    // 1. Type-veilige normalisatie van alle elementen (strings, numbers, objects met value)
    const normalized: string[] = items
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (typeof item === 'number') return String(item).trim();
        if (item && typeof item === 'object') {
          if ('key' in item && 'value' in item) {
            return `${(item as any).key}: ${(item as any).value}`.trim();
          }
          if ('value' in item) {
            return String((item as { value: unknown }).value || '').trim();
          }
        }
        return '';
      })
      .filter(Boolean);

    if (normalized.length === 0) return null;

    let width_mm: number | undefined;
    let height_mm: number | undefined;
    const attributes: Record<string, unknown> = {};

    // 2. Anker-gebaseerde extractie (Luxaflex, B&C, algemeen)
    for (const text of normalized) {
      const widthAnchorMatch = text.match(
        /(?:blijvende\s*maat|dagmaat|bestelmaat|breedte)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i
      );
      if (widthAnchorMatch && !width_mm) {
        const parsed = DeterministicTokenizerProvider.parseUnitToMm(
          widthAnchorMatch[1],
          widthAnchorMatch[2]
        );
        if (parsed > 0) width_mm = parsed;
      }

      const heightAnchorMatch = text.match(
        /(?:hoogte)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i
      );
      if (heightAnchorMatch && !height_mm) {
        const parsed = DeterministicTokenizerProvider.parseUnitToMm(
          heightAnchorMatch[1],
          heightAnchorMatch[2]
        );
        if (parsed > 0) height_mm = parsed;
      }

      const attrMatch = text.match(/^(bediening|kleur|gaas|lamelbreedte|type|montage)\s*[:=]\s*(.+)$/i);
      if (attrMatch) {
        const key = attrMatch[1].toLowerCase().replace(/\s+/g, '_');
        attributes[key] = attrMatch[2].trim();
      }
    }

    if (width_mm && height_mm) {
      return {
        dimensions: { width_mm, height_mm },
        attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
      };
    }

    // 3. Domein-geïsoleerd Direct Index Sjabloon voor Horren & Screens (Unilux / KeJe)
    const isHorOrScreen = Boolean(
      (supplierName && /unilux|keje/i.test(supplierName)) ||
      (description && /\b(hor|hordeur|rolhor|plisse\s*hordeur|inzethor)\b/i.test(description))
    );

    if (isHorOrScreen && normalized.length >= 2) {
      const wCand = parseInt(normalized[0].replace(/\D/g, ''), 10);
      const hCand = parseInt(normalized[1].replace(/\D/g, ''), 10);
      if (wCand >= 100 && wCand <= 12000 && hCand >= 100 && hCand <= 12000) {
        width_mm = wCand;
        height_mm = hCand;
        return {
          dimensions: { width_mm, height_mm },
          attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
        };
      }
    }

    // 4. Tokenize overige items met index-quarantaine (< 15)
    const scanLimit = Math.min(normalized.length, 15);
    for (let i = 0; i < scanLimit; i++) {
      const text = normalized[i];
      const dims = DeterministicTokenizerProvider.tokenize(text);
      if (dims && dims.width_mm && dims.height_mm) {
        return {
          dimensions: dims,
          attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
        };
      }
    }

    if (width_mm || height_mm) {
      return {
        dimensions: { width_mm, height_mm },
        attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
      };
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
    productGroupCode?: string
  ): Promise<ConfigurationSpec> {
    // --------------------------------------------------------------------------
    // Trap 0: Directe ERP Numerieke Velden (0ms)
    // --------------------------------------------------------------------------
    if (rawLine.width_mm && rawLine.height_mm) {
      const spec: ConfigurationSpec = {
        status: 'valid',
        confidence: 1.0,
        source: 'erp_fields',
        dimensions: {
          width_mm: Math.round(rawLine.width_mm),
          height_mm: Math.round(rawLine.height_mm),
        },
        options: rawLine.options || [],
      };
      return this.crossValidateConfiguration(spec, productGroupCode, rawLine);
    }

    // --------------------------------------------------------------------------
    // Trap A: Gestructureerde e-Order JSON (0ms)
    // --------------------------------------------------------------------------
    if (rawLine.configuration_json && typeof rawLine.configuration_json === 'object') {
      const json = rawLine.configuration_json;
      const w = typeof json.width_mm === 'number' ? json.width_mm : undefined;
      const h = typeof json.height_mm === 'number' ? json.height_mm : undefined;

      const attributes: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(json)) {
        if (k !== 'width_mm' && k !== 'height_mm') {
          attributes[k] = v;
        }
      }

      const spec: ConfigurationSpec = {
        status: 'valid',
        confidence: 1.0,
        source: 'eorder_json',
        dimensions:
          w && h
            ? {
                width_mm: Math.round(w),
                height_mm: Math.round(h),
              }
            : undefined,
        attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
      };
      return this.crossValidateConfiguration(spec, productGroupCode, rawLine);
    } else if (rawLine.configuration?.items && Array.isArray(rawLine.configuration.items)) {
      const extracted = ConfigurationExtractionEngine.extractFromConfigurationItems(
        rawLine.configuration.items,
        rawLine.supplier_name,
        rawLine.description,
        productGroupCode
      );

      if (extracted && extracted.dimensions?.width_mm && extracted.dimensions?.height_mm) {
        const spec: ConfigurationSpec = {
          status: 'valid',
          confidence: 1.0,
          source: 'eorder_json',
          dimensions: extracted.dimensions,
          attributes: extracted.attributes,
        };
        return this.crossValidateConfiguration(spec, productGroupCode, rawLine);
      }
    }

    // --------------------------------------------------------------------------
    // Trap B: Deterministische Regex Tokenizer (<1ms)
    // --------------------------------------------------------------------------
    const combinedText = `${rawLine.description || ''} ${rawLine.notes || ''}`.trim();
    const tokenizedDims = DeterministicTokenizerProvider.tokenize(combinedText);
    if (tokenizedDims) {
      const spec: ConfigurationSpec = {
        status: 'valid',
        confidence: 0.95,
        source: 'regex_tokenizer',
        dimensions: tokenizedDims,
      };
      return this.crossValidateConfiguration(spec, productGroupCode, rawLine);
    }

    // --------------------------------------------------------------------------
    // Trap C: Cognitieve Provider met LRU Caching
    // --------------------------------------------------------------------------
    if (this.cognitiveProvider && combinedText.length > 0) {
      const hash = this.computeContentHash(`${combinedText}_${productGroupCode || ''}`);

      if (this.lruCache.has(hash)) {
        const cached = this.lruCache.get(hash)!;
        // Move to end for LRU refresh
        this.lruCache.delete(hash);
        this.lruCache.set(hash, cached);
        return this.crossValidateConfiguration(cached, productGroupCode, rawLine);
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

        return this.crossValidateConfiguration(validSpec, productGroupCode, rawLine);
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

    // 2. Mechanische Reconciliatie Categorie-incompatibiliteiten
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
          notes.push(`Productgroep gereconcilieerd van ${grp} naar 3.1 wegens vloerattributen`);
        }
      }

      // 3. E-order Reconciliatie: Sanering van concurrerende 9.9 classificatie (voorheen Trap D).
      // ClassificationService is de exclusieve SSOT voor artikelgroepen.
    }

    if (notes.length > 0) {
      validated.extraction_notes = notes;
    }

    return validated;
  }
}
