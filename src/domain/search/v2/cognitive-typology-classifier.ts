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
    /knipstaal|staal(?:\s+|$)|staaltje|staalkaart|staalboek|sample|kleurstaal/i.test(name) ||
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
    // A. Trapbekleding & Traprenovatie (§3.5)
    if (
      /traprenovatie|overzettrede|overzettreden|traploper|trapbekleding|stootbord|traptrede/i.test(sanitizedText)
    ) {
      domain = 'TRAPBEKLEDING';
      if (/overzettrede|overzettreden/i.test(sanitizedText)) {
        productType = 'TRAPRENOVATIE_OVERZETTREDEN';
      } else {
        productType = 'TRAPBEKLEDING';
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
  };
}
