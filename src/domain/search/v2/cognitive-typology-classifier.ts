import { DomainCategory } from './canonical-catalog';

export type CanonicalDomain =
  | 'RAAMBEKLEDING' // Categorie 1 Gordijnen & Rails (§3.2) en Categorie 2 Raamdecoratie (§3.3)
  | 'GORDIJNEN'     // Specialisatie van Categorie 1 (§3.2)
  | 'VLOEREN'       // Categorie 3: Vloerbekleding (§3.4)
  | 'HORREN'        // Categorie 2.3: Horren & Buitenscreens (§3.3)
  | 'TRAPBEKLEDING' // Categorie 4: Trapbekleding & Traprenovatie (§3.5)
  | 'ACCESSOIRES'   // Losse onderdelen, klemsteunen, rails
  | 'DIENSTEN'      // Montage, inmeten, bezorgen
  | 'UNCLASSIFIED';

export function mapDomainToCategory(domain: CanonicalDomain): DomainCategory {
  switch (domain) {
    case 'GORDIJNEN':
    case 'RAAMBEKLEDING':
      return 'RAAMBEKLEDING';
    case 'VLOEREN':
    case 'TRAPBEKLEDING':
      return 'VLOEREN';
    case 'HORREN':
      return 'HORREN';
    case 'ACCESSOIRES':
      return 'ACCESSOIRES';
    case 'DIENSTEN':
      return 'DIENSTEN';
    case 'UNCLASSIFIED':
    default:
      return 'UNCLASSIFIED';
  }
}

export type CanonicalItemRole =
  | 'CONFIGURABLE_MAIN'
  | 'FINISHED_GOOD'
  | 'ACCESSORY'
  | 'SPARE_PART'
  | 'SAMPLE'
  | 'LABOR_SERVICE';

export interface HarvestedRawArticle {
  articleCode: string;
  articleName: string;
  supplierName?: string;
  orderOptions: string[];
  rawConfigurations: Array<{
    key: string;
    value: string;
    label?: string;
    surcharge?: number;
    count?: number;
  }>;
  observedDimensions?: {
    minWidthMm: number;
    maxWidthMm: number;
    minHeightMm: number;
    maxHeightMm: number;
  };
  historicalOccurrences: number;
  firstSeen?: string;
  lastSeen?: string;
}

export interface ObservedOptionRecord {
  stepId?: string;
  optionKey: string;
  label: string;
  count: number;
  surchargeEur?: number;
}

export interface ProductCapabilityRecord {
  stepId: string; // Formele Bron A SSOT step identifier (bv. 'BEDIENINGS_TYPE', 'MONTAGE')
  key: string;
  name: string;
  surchargeEur?: number;
  isMacro?: boolean;
}

export interface EnrichedProductEntity {
  id: string;                       // Afgeleid van articleCode conform Greenfield SSOT
  code: string;
  name: string;
  supplierName: string;             // Defaults to 'ONBEKEND' indien ontbrekend in raw
  domain: CanonicalDomain;
  category: DomainCategory;
  productType: string;              // e.g. 'DUETTE_SHADE', 'HORIZONTALE_JALOEZIE', 'INZETHOR'
  itemRole: CanonicalItemRole;
  capabilities: ProductCapabilityRecord[];
  observedOptions: ObservedOptionRecord[];
  observedDimensions?: {
    minWidthMm: number;
    maxWidthMm: number;
    minHeightMm: number;
    maxHeightMm: number;
  };
  historicalOccurrences: number;
  classificationConfidence: number; // 0.00 - 1.00
  reasoning: string;                // Audit trail: motivering van de toewijzing
  requiresHitlReview: boolean;      // True indien confidence < 0.95 of ambiguïteit
  enrichmentSource?: 'BASELINE' | 'LOCAL_TAXONOMY' | 'ONLINE_SEARCH' | 'LOCAL_TAXONOMY_FALLBACK' | string;
}

export interface SupplierBrandTaxonomyEntry {
  supplierKeywords?: RegExp[];
  codePrefixes?: RegExp[];
  nameKeywords?: RegExp[];
  domain: CanonicalDomain;
  productType: string;
  baseConfidence: number;
  reasoning: string;
}

export const SUPPLIER_BRAND_TAXONOMY: SupplierBrandTaxonomyEntry[] = [
  {
    supplierKeywords: [/vadain/i, /kendix/i, /kobe/i, /ploeg/i, /artelux/i, /bece/i],
    codePrefixes: [/^lt_vadain/i, /^vadain/i, /^kobe/i, /^kendix/i, /^ploeg/i],
    nameKeywords: [/vadain/i, /kendix/i, /kobe/i, /de\s*ploeg/i, /artelux/i],
    domain: 'GORDIJNEN',
    productType: 'OVERGORDIJN',
    baseConfidence: 0.99,
    reasoning: 'Leverancierstaxonomie: Gordijnstoffen & Confectie (Vadain/Kendix/Kobe/De Ploeg)',
  },
  {
    supplierKeywords: [/interstil/i, /wepro/i],
    codePrefixes: [/^interstil/i, /^wepro/i],
    nameKeywords: [/interstil/i, /binnenloop/i, /gordijnrail/i, /gordijnroede/i],
    domain: 'GORDIJNEN',
    productType: 'GORDIJNRAIL',
    baseConfidence: 0.99,
    reasoning: 'Leverancierstaxonomie: Gordijnrails & Binnenloopsystemen (Interstil)',
  },
  {
    supplierKeywords: [/quick-?step/i, /forbo/i, /mflor/i, /thermexx/i, /coretec/i, /belakos/i, /interfloor/i, /amigo/i],
    codePrefixes: [/^quick-?step/i, /^forbo/i, /^mflor/i, /^belakos/i],
    nameKeywords: [/quick-?step/i, /forbo/i, /mflor/i, /coretec/i, /belakos/i],
    domain: 'VLOEREN',
    productType: 'PVC_VLOER',
    baseConfidence: 0.99,
    reasoning: 'Leverancierstaxonomie: Vloerbekleding & Harde Vloeren (Quick-Step/Forbo)',
  },
  {
    supplierKeywords: [/unilux/i, /keje/i, /horrenbouw/i],
    codePrefixes: [/^unilux/i, /^keje/i],
    nameKeywords: [/unilux/i, /keje/i],
    domain: 'HORREN',
    productType: 'INZETHOR',
    baseConfidence: 0.99,
    reasoning: 'Leverancierstaxonomie: Horren & Insectenwering (Unilux/KeJe)',
  },
];

export interface OnlineEnrichmentOptions {
  searchFn?: (query: string) => Promise<Array<string | { title?: string; snippet?: string; url?: string }>>;
  cache?: Map<string, any> | { get(k: string): any; set(k: string, v: any): void; has?(k: string): boolean };
  enabled?: boolean;
}

/**
 * 100% Deterministische, offline NLP & Ontologie Engine voor Woninginrichting Producttypologieën.
 * Draait zuiver in-memory zonder externe API-aanroepen conform Grondwet Laag 1B § 5.
 */
export function classifyCognitiveTypology(raw: HarvestedRawArticle): EnrichedProductEntity {
  const code = (raw.articleCode || '').trim();
  const name = (raw.articleName || '').trim();
  const supplier = (raw.supplierName || '').trim();
  const optionsJoined = (raw.orderOptions || []).join(' ');
  const fullText = `${code} ${name} ${supplier} ${optionsJoined}`.toLowerCase();

  // Mask homoniemen zoals "van vloer tot plafond" om valse positieven op VLOEREN te voorkomen
  const sanitizedText = fullText.replace(/van\s+vloer\s+tot\s+plafond/g, 'vloertotplafond_phrase');

  let domain: CanonicalDomain = 'UNCLASSIFIED';
  let productType = 'ONBEKEND';
  let itemRole: CanonicalItemRole = 'CONFIGURABLE_MAIN';
  let confidence = 0.5;
  const reasoningParts: string[] = [];
  const capabilities: ProductCapabilityRecord[] = [];

  // --- 1. Item Role Detectie ---
  if (
    /knipstaal|(?<!edel)staal(?:\s+|$)|staaltje|staalkaart|staalboek|sample|kleurstaal/i.test(name) ||
    /knipstaal|sample/i.test(optionsJoined)
  ) {
    itemRole = 'SAMPLE';
    productType = 'KNIPSTAAL';
    domain = 'GORDIJNEN';
    confidence = 0.98;
    reasoningParts.push('Gedetecteerd als stalen- of monsterartikel');
  } else if (
    /inmeten|monteren|montage(?:\s+|$)|arbeidsloon|uurtarief|plaatsen|bezorgen|dienst/i.test(name)
  ) {
    itemRole = 'LABOR_SERVICE';
    productType = 'MONTAGE_SERVICE';
    domain = 'DIENSTEN';
    confidence = 0.98;
    reasoningParts.push('Gedetecteerd als arbeidsloon of installatieservice');
  }

  // --- 2. Categorie & Typologie Detectie (indien niet reeds sample of labor) ---
  if (itemRole === 'CONFIGURABLE_MAIN') {
    // 0. Anti-Furniture Guard (Veldisolatie: uitsluitend op articleName en supplierName, NOOIT orderOptions)
    const isFurniture =
      /(?:^|\s)(?:eetkamer)?stoel(?:en)?|(?:hoek)?bank(?:en)?(?!\s*kussen)|fauteuil(?:s)?|salontafel(?:s)?|eettafel(?:s)?|dressoir(?:s)?|tv-?meubel(?:s)?|kledingkast(?:en)?|boxspring(?:s)?|matras(?:sen)?(?:$|\s)/i.test(name) ||
      /bree['’]s\s*new\s*world|habufa|henders|leenders|xooon|profijt/i.test(`${name} ${supplier}`);

    if (isFurniture) {
      domain = 'UNCLASSIFIED';
      productType = 'ONBEKEND';
      confidence = 0.60;
      reasoningParts.push('Anti-Furniture Guard: Artikel geïdentificeerd als meubilair / stoel');
    } else {
      // 1. Leverancier- & Merkentaxonomie (Knowledge Graph)
      let taxonomyMatched = false;
      for (const entry of SUPPLIER_BRAND_TAXONOMY) {
        const supMatch = entry.supplierKeywords?.some(re => re.test(supplier));
        const codeMatch = entry.codePrefixes?.some(re => re.test(code));
        const nameMatch = entry.nameKeywords?.some(re => re.test(name));

        if (supMatch || codeMatch || nameMatch) {
          domain = entry.domain;
          productType = entry.productType;
          if (entry.domain === 'HORREN') {
            if (/pliss[eé]\s*hordeur/i.test(sanitizedText) || /plisse/i.test(sanitizedText)) {
              productType = 'PLISSE_HORDEUR';
            } else if (/inzethor/i.test(sanitizedText)) {
              productType = 'INZETHOR';
            } else {
              productType = 'HOR';
            }
          } else if (entry.domain === 'GORDIJNEN' && /inbetween/i.test(sanitizedText)) {
            productType = 'INBETWEEN';
          }
          confidence = entry.baseConfidence;
          reasoningParts.push(entry.reasoning);
          taxonomyMatched = true;
          break;
        }
      }

      if (!taxonomyMatched) {
        // A. Trapbekleding & Traprenovatie (§3.5)
        if (
          /traprenovatie|overzettrede|overzettreden|traploper|trapbekleding|stootbord|traptrede/i.test(sanitizedText)
        ) {
          domain = 'TRAPBEKLEDING';
          if (/overzettrede|overzettreden/i.test(sanitizedText)) {
            productType = 'TRAPRENOVATIE_OVERZETTREDEN';
          } else {
            productType = 'TRAPRENOVATIE';
          }
          confidence = 0.96;
          reasoningParts.push('Trapbekleding ontologie gematcht conform §3.5');
        }
        // B. Horren & Buitenscreens (§3.3)
        else if (
          /hordeur|inzethor|pliss[eé]\s*hordeur|rolhor|raamhor|voorzethor|unilux/i.test(sanitizedText)
        ) {
          domain = 'HORREN';
          if (/pliss[eé]\s*hordeur/i.test(sanitizedText) || /plisse/i.test(sanitizedText)) {
            productType = 'PLISSE_HORDEUR';
          } else if (/inzethor/i.test(sanitizedText)) {
            productType = 'INZETHOR';
          } else {
            productType = 'HOR';
          }
          confidence = 0.98;
          reasoningParts.push('Horren ontologie gematcht conform §3.3');
        }
        // C. Duette Shades & Plissé (§3.3)
        else if (
          /duette|duoette|architella|au-?20|ua-?20|20:\s*top|smartcord/i.test(sanitizedText)
        ) {
          domain = 'RAAMBEKLEDING';
          productType = 'DUETTE_SHADE';
          confidence = 0.98;
          if (/au-?20|ua-?20|20:\s*top/i.test(sanitizedText)) {
            reasoningParts.push('Modelcode AU20 genormaliseerd');
          } else {
            reasoningParts.push('Duette Shade ontologie gematcht conform §3.3');
          }
        }
        // D. Horizontale Jaloezieën (§3.3)
        else if (
          /hz\s*25|hz\s*50|hz\s*st|jaloezie|houten\s*jaloezie|aluminium\s*jaloezie/i.test(sanitizedText)
        ) {
          domain = 'RAAMBEKLEDING';
          productType = 'HORIZONTALE_JALOEZIE';
          confidence = 0.96;
          reasoningParts.push('Horizontale Jaloezie modelcode gematcht conform §3.3');
        }
        // E. Gordijnen & Confectie (§3.2)
        else if (
          /gordijn|gordijnstof|overgordijn|inbetween|vitrage|kamerhoog|plisse|ploegstoffen|de\s*ploeg|kendix|kobe/i.test(sanitizedText)
        ) {
          domain = 'GORDIJNEN';
          if (/inbetween/i.test(sanitizedText)) {
            productType = 'INBETWEEN';
          } else {
            productType = 'OVERGORDIJN';
          }
          confidence = 0.96;
          reasoningParts.push('Gordijn ontologie gematcht conform §3.2');
        }
        // F. Vloeren (§3.4)
        else if (
          /pvc|laminaat|parket|tapijt|marmoleum|visgraat|dryback|stroken/i.test(sanitizedText)
        ) {
          domain = 'VLOEREN';
          productType = 'PVC_VLOER';
          confidence = 0.95;
          reasoningParts.push('Vloerbekleding ontologie gematcht conform §3.4');
        }
        // G. Onbekende collecties
        else {
          domain = 'UNCLASSIFIED';
          productType = 'ONBEKEND';
          confidence = 0.65;
          reasoningParts.push('Geen eenduidige typologie-indicatoren gedetecteerd in artikelnaam of opties');
        }
      }
    }
  }

  // --- 3. Capability Extractie met Bron A SSOT Step IDs ---
  if (/smartcord/i.test(fullText)) {
    capabilities.push({
      stepId: 'BEDIENINGS_TYPE',
      key: 'SMARTCORD',
      name: 'SmartCord',
      isMacro: true,
    });
  }

  if (/top-?down(?:\s*\/?\s*bottom-?up)?|au-?20|ua-?20/i.test(fullText)) {
    capabilities.push({
      stepId: 'BEDIENINGS_TYPE',
      key: 'TOP_DOWN_BOTTOM_UP',
      name: 'Top-Down / Bottom-Up',
      isMacro: true,
    });
  }

  if (/klemsteun|klemsteunen|draai-?kiep/i.test(fullText)) {
    capabilities.push({
      stepId: 'MONTAGE',
      key: 'KLEMSTEUNEN',
      name: 'Klemsteunen op draai-kiepraam',
      isMacro: true,
    });
  }

  if (/somfy|elektrisch|motor|powerview/i.test(fullText)) {
    capabilities.push({
      stepId: 'BEDIENINGS_TYPE',
      key: 'ELEKTRISCH',
      name: 'Elektrische bediening',
      isMacro: true,
    });
  }

  // --- 4. Observed Options Formatteren ---
  const observedOptions: ObservedOptionRecord[] = (raw.rawConfigurations || []).map(cfg => ({
    stepId: cfg.key,
    optionKey: cfg.value,
    label: cfg.label || cfg.value,
    count: cfg.count || 1,
    surchargeEur: cfg.surcharge,
  }));

  const category = mapDomainToCategory(domain);
  const requiresHitlReview = confidence < 0.95 || domain === 'UNCLASSIFIED';

  return {
    id: code || 'UNKNOWN',
    code: code || 'UNKNOWN',
    name: name || 'Naamloos artikel',
    supplierName: supplier || 'ONBEKEND',
    domain,
    category,
    productType,
    itemRole,
    capabilities,
    observedOptions,
    observedDimensions: raw.observedDimensions,
    historicalOccurrences: raw.historicalOccurrences || 1,
    classificationConfidence: confidence,
    reasoning: reasoningParts.join('; '),
    requiresHitlReview,
    enrichmentSource: 'BASELINE',
  };
}

/**
 * Systematische Asynchrone Online Search & Web Enrichment Engine (Zuiver In-Memory).
 * Bevat 0 Node.js 'fs' imports en delegeert disk-persistentie exclusief aan de CLI orchestrator.
 */
export async function classifyCognitiveTypologyWithOnlineSearch(
  raw: HarvestedRawArticle,
  options: OnlineEnrichmentOptions = {}
): Promise<EnrichedProductEntity> {
  const baseline = classifyCognitiveTypology(raw);

  if (options.enabled === false || !options.searchFn) {
    return {
      ...baseline,
      enrichmentSource: 'LOCAL_TAXONOMY',
    };
  }

  const supplier = (raw.supplierName || '').trim();
  const name = (raw.articleName || '').trim();
  const code = (raw.articleCode || '').trim();
  const cacheKey = `${supplier.toLowerCase()}::${name.toLowerCase()}::${code.toLowerCase()}`;

  // Check in-memory cache
  if (options.cache) {
    const cached = typeof (options.cache as any).get === 'function'
      ? (options.cache as any).get(cacheKey)
      : (options.cache as any)[cacheKey];

    if (cached) {
      return {
        ...cached,
        enrichmentSource: 'ONLINE_SEARCH',
      };
    }
  }

  const queryParts = [supplier, name, code].filter(Boolean);
  const query = queryParts.join(' ').trim();

  let searchResults: Array<string | { title?: string; snippet?: string; url?: string }> = [];
  try {
    searchResults = await options.searchFn(query);
  } catch (err: any) {
    // Graceful fallback to local taxonomy on timeout or network error
    return {
      ...baseline,
      enrichmentSource: 'LOCAL_TAXONOMY_FALLBACK',
      reasoning: `${baseline.reasoning}; Online search fallback: ${err?.message || 'zoekservice niet beschikbaar'}`,
    };
  }

  const snippetTexts: string[] = (searchResults || []).map(r => {
    if (typeof r === 'string') return r;
    return `${r.title || ''} ${r.snippet || ''}`;
  });
  const joinedSnippets = snippetTexts.join(' ').toLowerCase();

  // 1. Authoritative Falsification Veto (Meubel/Stoel detectie)
  const furnitureVetoPattern =
    /(?:eetkamer)?stoel(?:en)?|fauteuil(?:s)?|zitmeubel(?:en)?|hoekbank(?:en)?|bankstel(?:len)?|salontafel(?:s)?|eettafel(?:s)?|kledingkast(?:en)?|boxspring(?:s)?|matras(?:sen)?/i;
  if (furnitureVetoPattern.test(joinedSnippets)) {
    const vetoed: EnrichedProductEntity = {
      ...baseline,
      domain: 'UNCLASSIFIED',
      category: 'UNCLASSIFIED',
      productType: 'ONBEKEND',
      classificationConfidence: 0.99,
      reasoning: `${baseline.reasoning}; Online search veto: webresultaten tonen meubels/stoelen`,
      requiresHitlReview: true,
      enrichmentSource: 'ONLINE_SEARCH',
    };

    if (options.cache && typeof (options.cache as any).set === 'function') {
      (options.cache as any).set(cacheKey, vetoed);
    }
    return vetoed;
  }

  // 2. Corroboratie & Elevatie
  let elevatedConfidence = baseline.classificationConfidence;
  let finalDomain = baseline.domain;
  let finalCategory = baseline.category;
  let finalProductType = baseline.productType;
  const webCorroborations: string[] = [];

  if (/(?:gordijn|overgordijn|inbetween|vitrage|gordijnstof|confectie|loodveter|plooi)/i.test(joinedSnippets)) {
    if (finalDomain === 'GORDIJNEN' || finalDomain === 'UNCLASSIFIED') {
      finalDomain = 'GORDIJNEN';
      finalCategory = 'RAAMBEKLEDING';
      if (/inbetween/i.test(joinedSnippets) && finalProductType === 'ONBEKEND') {
        finalProductType = 'INBETWEEN';
      } else if (finalProductType === 'ONBEKEND') {
        finalProductType = 'OVERGORDIJN';
      }
      elevatedConfidence = Math.max(elevatedConfidence, 0.995);
      webCorroborations.push('Gordijnstof geverifieerd via online search');
    }
  }

  if (/(?:gordijnrail|gordijnroede|binnenloop|interstil)/i.test(joinedSnippets)) {
    if (finalDomain === 'GORDIJNEN' || finalDomain === 'UNCLASSIFIED') {
      finalDomain = 'GORDIJNEN';
      finalCategory = 'RAAMBEKLEDING';
      finalProductType = 'GORDIJNRAIL';
      elevatedConfidence = Math.max(elevatedConfidence, 0.995);
      webCorroborations.push('Gordijnrail geverifieerd via online search');
    }
  }

  if (/(?:pvc(?:\s*vloer)?|visgraat|laminaat|parket|dryback|click)/i.test(joinedSnippets)) {
    if (finalDomain === 'VLOEREN' || finalDomain === 'UNCLASSIFIED') {
      finalDomain = 'VLOEREN';
      finalCategory = 'VLOEREN';
      if (finalProductType === 'ONBEKEND') {
        finalProductType = 'PVC_VLOER';
      }
      elevatedConfidence = Math.max(elevatedConfidence, 0.995);
      webCorroborations.push('Vloerbekleding geverifieerd via online search');
    }
  }

  if (/(?:duette|pliss[eé]|smartcord|jaloezie|rolgordijn)/i.test(joinedSnippets)) {
    if (finalDomain === 'RAAMBEKLEDING' || finalDomain === 'UNCLASSIFIED') {
      finalDomain = 'RAAMBEKLEDING';
      finalCategory = 'RAAMBEKLEDING';
      elevatedConfidence = Math.max(elevatedConfidence, 0.995);
      webCorroborations.push('Raambekleding geverifieerd via online search');
    }
  }

  const finalEntity: EnrichedProductEntity = {
    ...baseline,
    domain: finalDomain,
    category: finalCategory,
    productType: finalProductType,
    classificationConfidence: elevatedConfidence,
    reasoning: webCorroborations.length > 0
      ? `${baseline.reasoning}; ${webCorroborations.join(', ')}`
      : baseline.reasoning,
    requiresHitlReview: elevatedConfidence < 0.95 || finalDomain === 'UNCLASSIFIED',
    enrichmentSource: 'ONLINE_SEARCH',
  };

  if (options.cache && typeof (options.cache as any).set === 'function') {
    (options.cache as any).set(cacheKey, finalEntity);
  }

  return finalEntity;
}
