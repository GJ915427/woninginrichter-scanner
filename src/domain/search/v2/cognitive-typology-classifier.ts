import { DomainCategory, type ItemRole } from './canonical-catalog';

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

// SSOT Type-Unificatie: CanonicalItemRole is de bindende alias van de canonieke ItemRole
export type CanonicalItemRole = ItemRole;

export type ServiceDisciplineType =
  | 'GORDIJN_RAIL_MONTAGE'
  | 'BINNENZONWERING_MONTAGE'
  | 'VLOER_LEGSERVICE'
  | 'TRAP_STOFFERING_MONTAGE'
  | 'BUITENZONWERING_MONTAGE'
  | 'INMEET_SCHOUW_SERVICE'
  | 'SLOOP_EGALISATIE_SERVICE'
  | 'LOGISTIEK_MATERIEEL_SERVICE'
  | 'OVERIGE_DIENSTEN';

export interface ServiceDisciplineResult {
  discipline?: ServiceDisciplineType;
  isMaterialAndService: boolean;
}

export const SERVICE_DISCIPLINE_TO_PRODUCT_GROUP: Record<ServiceDisciplineType, string> = {
  GORDIJN_RAIL_MONTAGE: '6.1',
  BINNENZONWERING_MONTAGE: '6.2',
  VLOER_LEGSERVICE: '6.3',
  TRAP_STOFFERING_MONTAGE: '6.4',
  BUITENZONWERING_MONTAGE: '6.5',
  INMEET_SCHOUW_SERVICE: '6.6',
  SLOOP_EGALISATIE_SERVICE: '6.7',
  LOGISTIEK_MATERIEEL_SERVICE: '6.8',
  OVERIGE_DIENSTEN: '6.9',
};

export interface ServiceDisciplineRule {
  discipline: ServiceDisciplineType;
  priority: number; // 1 = hoogste prioriteit, 9 = laagste
  compositePhrases?: string[]; // Meerwoords-termen gematcht op genormaliseerde tekst NA uitsluitingen
  intrinsicTokens?: string[]; // Zelfstandige diensttermen die direct kwalificeren
  targetTokens?: string[]; // Atomaire stammen van doelbereik
  actionTokens?: string[]; // Atomaire stammen van handelingen (strikt exact)
  excludeTokens?: string[]; // Atomaire losse woorden die exact overeen moeten komen (t === ex)
  excludePhrases?: string[]; // Meerwoords-uitsluitingen gematcht op genormaliseerde string
}

export const SERVICE_DISCIPLINE_RULES: ServiceDisciplineRule[] = [
  // 1. Trap (hoogste prioriteit: voorkomt vloer-overlap bij traptreden; beschermt fysieke C4 Trapbekleding & Traprenovatie)
  {
    discipline: 'TRAP_STOFFERING_MONTAGE',
    priority: 1,
    compositePhrases: [
      'trap stofferen', 'trap bekleden', 'traprenovatie en stoffering', 'stoffering per trede',
      'treden bekleden', 'treden stofferen', 'overzettreden plaatsen', 'legkosten per trede',
      'tapijt leggen trap', 'stalen trap stofferen', 'stalen trap bekleden'
    ],
    intrinsicTokens: ['trapstoffering'],
    targetTokens: ['trap', 'trappen', 'trede', 'treden', 'trapoverzet', 'stootbord', 'stootborden'],
    actionTokens: ['stofferen', 'stoffering', 'bekleden', 'bekleding', 'montage', 'monteren', 'verlijmen', 'plaatsen', 'leggen'],
    excludeTokens: ['traplijm', 'trapstrip', 'trapklem', 'profiel', 'staalmonster', 'knipstaal', 'beugel', 'montagebeugel'],
    excludePhrases: ['emmer traplijm', 'koker traplijm'],
  },
  // 2. Inmeten & Schouw (inclusief bouwkundig advies en deurenadvies)
  {
    discipline: 'INMEET_SCHOUW_SERVICE',
    priority: 2,
    compositePhrases: [
      'inmeet service', 'inmeetservice', 'technische schouw', 'lasermeting',
      'cm meting', 'carbid meting', 'vochtmeting dekvloer', '3d lasermeting',
      'deurknelpunten advies', 'deuradvies', 'deurenadvies', 'inmeetadvies'
    ],
    intrinsicTokens: ['inmeten', 'inmeting', 'inmeet', 'schouw', 'lasermeting', 'vochtmeting', 'carbidmeting', 'deuradvies', 'deurenadvies'],
    targetTokens: ['deur', 'deuren', 'dekvloer'],
    actionTokens: ['inmeten', 'opmeten', 'schouwen', 'advies'],
    excludeTokens: ['laserapparaat', 'meetlint', 'inspectieluik', 'gereedschap'],
    excludePhrases: ['optische afstandsmeter'],
  },
  // 3. Sloop & Egalisatie
  {
    discipline: 'SLOOP_EGALISATIE_SERVICE',
    priority: 3,
    compositePhrases: [
      'vloer egaliseren', 'dekvloer egaliseren', 'diamantschuren', 'vloer slopen',
      'lijmresten schuren', 'vloer strippen', 'egaliseren 2mm', 'egaliseren cement', 'dekvloer primeren',
      'tapijt strippen', 'pvc strippen', 'marmoleum strippen', 'vloerbedekking verwijderen'
    ],
    intrinsicTokens: ['egalisatie', 'egaliseren', 'diamantschuren', 'slopen', 'vloersloop', 'ondergrondsanering'],
    targetTokens: ['egaline', 'dekvloer', 'vloer', 'ondervloer', 'lijmresten', 'puin', 'tapijt', 'pvc', 'laminaat', 'visgraat'],
    actionTokens: ['aanbrengen', 'uitvoeren', 'verwijderen', 'slopen', 'schuren', 'egaliseren', 'strippen', 'primeren'],
    excludeTokens: ['voorstrijk', 'schuurschijf', 'gereedschap'],
    excludePhrases: ['zak egaline', 'primer 10kg', 'emmer primer', 'hechtprimer 10kg'],
  },
  // 4. Logistiek & Materieel
  {
    discipline: 'LOGISTIEK_MATERIEEL_SERVICE',
    priority: 4,
    compositePhrases: [
      'ladderlift verhuur', 'puin afvoer', 'afval container', 'verticaal transport',
      'lift assistentie', 'ladderlift dagdeel', 'afvalcontainer 6', 'transportkosten', 'bezorgkosten'
    ],
    intrinsicTokens: ['ladderlift', 'verhuislift', 'afvalcontainer', 'puincontainer', 'transportkosten', 'bezorgkosten', 'bezorging', 'transport'],
    targetTokens: ['container', 'puin', 'afvoer', 'materieel', 'lift'],
    actionTokens: ['inzet', 'huur', 'dagdeel', 'plaatsing', 'afvoeren', 'bezorgen', 'leveren', 'rijden'],
    excludeTokens: ['containerzak', 'kruiwagen', 'spanband'],
    excludePhrases: ['rol containerzakken'],
  },
  // 5. Buitenzonwering & Gevelsystemen
  {
    discipline: 'BUITENZONWERING_MONTAGE',
    priority: 5,
    compositePhrases: [
      'ritsscreen montage', 'rolluik plaatsen', 'knikarmscherm monteren',
      'markies ophangen', 'buitenzonwering montage', 'screens plaatsen gevel'
    ],
    targetTokens: ['buitenzonwering', 'rolluik', 'ritsscreen', 'ritsscreens', 'knikarmscherm', 'markies', 'markiezen', 'terrasoverkapping', 'screen', 'screens'],
    actionTokens: ['montage', 'monteren', 'plaatsen', 'ophangen', 'installeren', 'aansluiten'],
    excludeTokens: ['afstandsbediening', 'schakelaar', 'buismotor', 'handzender'],
    excludePhrases: ['losse motor', 'somfy zender'],
  },
  // 6. Gordijn & Rail Montage
  {
    discipline: 'GORDIJN_RAIL_MONTAGE',
    priority: 6,
    compositePhrases: [
      'wave rail monteren', 'wave rail plaatsen', 'wave rail montage',
      'rail monteren', 'rail plaatsen', 'roede monteren', 'fournituren en montage',
      'enkele retourplooi', 'dubbele retourplooi', 'confectie enkele plooi',
      'confectie dubbele plooi', 'atelier confectie', 'atelierconfectie',
      'gordijnconfectie', 'gordijnen ophangen'
    ],
    intrinsicTokens: ['confectie', 'gordijnconfectie', 'atelierconfectie'],
    targetTokens: ['gordijn', 'rail', 'gordijnrail', 'roede', 'binnenloop', 'wepro', 'wave', 'plooi', 'plooien'],
    actionTokens: ['montage', 'monteren', 'hangen', 'ophangen', 'plaatsen', 'confectie', 'confectioneren', 'buigen'],
    excludeTokens: ['stofmonster', 'stalenboek', 'knipstaal', 'haakjes', 'glijders', 'eindstop', 'klemsteun', 'montageset'],
    excludePhrases: ['losse gordijnstof', 'meter stof'],
  },
  // 7. Binnenzonwering & Raamdecoratie
  {
    discipline: 'BINNENZONWERING_MONTAGE',
    priority: 7,
    compositePhrases: [
      'plisse monteren', 'plissé monteren', 'duette plaatsen', 'jaloezie monteren', 'rolgordijn ophangen',
      'hor plaatsen', 'raamdecoratie montage', 'montagekosten raambekleding',
      'plaatsing raambekleding', 'montage raambekleding', 'binnenzonwering montage',
      'zonwering monteren', 'montage binnenzonwering'
    ],
    targetTokens: ['raamdecoratie', 'raambekleding', 'binnenzonwering', 'zonwering', 'jaloezie', 'plisse', 'plissé', 'duette', 'lamel', 'lamellen', 'rolgordijn', 'vouwgordijn', 'hor', 'horren', 'inzethor', 'rolhor', 'voorzethor', 'plissehor', 'hordeur', 'hordeuren'],
    actionTokens: ['montage', 'monteren', 'plaatsen', 'plaatsing', 'hangen', 'ophangen', 'installatie', 'installeren'],
    excludeTokens: ['buiten', 'gevel', 'terras', 'rolluik', 'ritsscreen', 'klemsteun', 'montageclip', 'montageset', 'beugel'],
    excludePhrases: ['losse lamel', 'klemsteunen set', 'montageset rolgordijn'],
  },
  // 8. Vloeren Legservice (inclusief 'legservice', 'legloon', 'legkosten' in intrinsicTokens)
  {
    discipline: 'VLOER_LEGSERVICE',
    priority: 8,
    compositePhrases: [
      'visgraat leggen', 'pvc leggen', 'laminaat leggen', 'tapijt leggen',
      'tapijt spannen', 'tapijt verlijmen', 'plinten monteren', 'afkitten plinten',
      'plinten afkitten', 'legkosten marmoleum', 'legkosten visgraat', 'plint montage', 'pvc montage', 'vloer montage',
      'ondervloer leggen', 'ondervloer plaatsen', 'plakplinten monteren',
      'vinyl leggen', 'vinyl plaatsen', 'vinyl verlijmen'
    ],
    intrinsicTokens: ['legservice', 'legloon', 'legkosten', 'vloerenlegservice'],
    targetTokens: ['vloer', 'vloeren', 'pvc', 'laminaat', 'parket', 'visgraat', 'marmoleum', 'tapijt', 'vinyl', 'plint', 'plinten', 'ondervloer', 'plakplint'],
    actionTokens: ['leggen', 'verlijmen', 'plaatsen', 'monteren', 'spannen', 'afkitten', 'zagen', 'legservice', 'montage'],
    excludeTokens: ['trap', 'trappen', 'trede', 'treden', 'vloerlijm', 'montagekit', 'montageprofiel', 'montagelijm'],
    excludePhrases: ['emmer vloerlijm', 'koker montagekit', 'rol ondervloer', 'pak ondervloer'],
  },
  // 9. Overige Diensten & Projectregie (inclusief standalone 'montage' en 'montagekosten')
  {
    discipline: 'OVERIGE_DIENSTEN',
    priority: 9,
    compositePhrases: [
      'projectregie woninginrichting', 'totaalinrichting montage', 'montageleiding op locatie',
      'montagekosten complete villa', 'montagekosten villa', 'complete villa montage',
      'uurtarief monteur', 'arbeidsloon montage', 'montage nazorg',
      'dienstverlening op locatie', 'onderhoudscontract woninginrichting'
    ],
    intrinsicTokens: ['montage', 'montagekosten', 'montageloon', 'uurtarief', 'arbeidsloon', 'plaatsing', 'plaatsingskosten', 'werkloon', 'projectregie', 'montageleiding', 'dienst', 'diensten', 'onderhoud', 'garantie', 'voorrijkosten'],
    targetTokens: ['uurtarief', 'regie', 'nazorg', 'montage', 'tarief', 'uren'],
    actionTokens: ['uitvoeren', 'verlenen', 'monteur', 'kosten', 'tarief', 'uren'],
    excludeTokens: ['clip', 'klem', 'klemsteun', 'klemsteunen', 'kit', 'lijm', 'beugel', 'profiel', 'set', 'tapijt', 'gordijn', 'vloer', 'tafel', 'stoel', 'kast', 'montageset', 'montagebeugel', 'montageprofiel', 'montageclip', 'montageclips', 'accessoire'],
    excludePhrases: [],
  },
];

export function detectIsMaterialAndService(rawDescription: string): boolean {
  if (!rawDescription || typeof rawDescription !== 'string') return false;
  const norm = rawDescription.toLowerCase().trim();

  // 1. EXPLICIETE SERVICE-SUBSTANTIEVEN (Onmiskenbaar een zuivere dienst, zelfs bij samengestelde namen zoals 'PVC visgraat legservice')
  if (/\b(legservice|vloerenlegservice|montageservice|inmeetservice|confectieservice|stoffeerservice|plaatsingsservice|reparatieservice|diensten|arbeidsloon|uurtarief|legloon|legkosten|montagekosten|plaatsingskosten)\b/i.test(norm)) {
    return false;
  }

  // 2. LEADING-VERB WHITELIST (Zuivere werkzaamheid / dienstterm vooraan)
  if (/^(legloon|legkosten|montage|montagekosten|arbeidsloon|uurtarief|plaatsingskosten|inmeting|inmeetservice|inmeten|confectie|stoffering|stofferen|vervoer|transport|bezorging|sloop|egalisatie|egaliseren)\b/i.test(norm)) {
    return false;
  }

  // 3. DIENST-VOOR-INCLUSIEF CHECK (Bijv. 'Inmeten incl. montage', 'Confectie inclusief hangen' -> zuivere dienst)
  if (/\b(legservice|montage|inmeten|confectie|stofferen|egaliseren|slopen)\s+(incl|inclusief)\b/i.test(norm)) {
    return false;
  }

  const hybridPatterns = [
    /\b(incl|inclusief)\.?(?:\s+\w+){0,3}\s+(montage|plaatsen|leggen|hangen|meten|inmeten|confectie|stofferen|verlijmen|aanbrengen|egaliseren)\b/i,
    /\b(afkitten\s*plinten|plinten\s*afkitten|leveren\s*en\s*monteren|montage\s*en\s*levering)\b/i,
  ];
  return hybridPatterns.some(p => p.test(norm));
}

export function matchServiceDisciplineFromTokens(rawDescription: string): ServiceDisciplineType | undefined {
  if (!rawDescription || typeof rawDescription !== 'string') return undefined;
  const normalized = rawDescription.toLowerCase().trim();
  const tokens = normalized.split(/[\s,\.\/\-_+]+/).filter(Boolean);

  // 1. GLOBALE SAMPLE / STALEN VETO-POORT (Voorkomt categorisch dat knipstalen/monsters als dienst worden gekaapt)
  const GLOBAL_NON_SERVICE_VETO_TOKENS = ['sample', 'knipstaal', 'stofmonster', 'staalmonster', 'staalkaart', 'stalenboek', 'kleurstaal', 'showmonster', 'staaltje'];
  if (GLOBAL_NON_SERVICE_VETO_TOKENS.some(veto => tokens.some(t => t === veto || t.startsWith(veto)))) {
    return undefined;
  }

  for (const rule of SERVICE_DISCIPLINE_RULES) {
    // 2. VETO FASE (Exclude checks per regel VÓÓR toewijzing)
    if (rule.excludePhrases && rule.excludePhrases.some(phrase => normalized.includes(phrase))) {
      continue;
    }

    if (rule.excludeTokens && rule.excludeTokens.some(ex => tokens.some(t => t === ex))) {
      continue;
    }

    // 3. COMPOSITE PHRASES FASE (Meerwoords-termen die uitsluitingen hebben doorstaan)
    if (rule.compositePhrases && rule.compositePhrases.some(phrase => normalized.includes(phrase))) {
      return rule.discipline;
    }

    // 4. INTRINSIC TOKENS FASE (Termen die op zichzelf reeds onmiskenbaar een dienst aanduiden)
    if (rule.intrinsicTokens && rule.intrinsicTokens.some(intrinsic => tokens.some(t => t === intrinsic))) {
      return rule.discipline;
    }

    // 5. TARGET + ACTION COMBINATORIEK (met compound suffix en strikt exacte actietoken matching)
    if (rule.targetTokens && rule.targetTokens.length > 0) {
      let targetMatchedIndex = -1;
      for (let i = 0; i < tokens.length; i++) {
        if (rule.targetTokens.some(target => tokens[i] === target || tokens[i].startsWith(target) || (target.length >= 3 && tokens[i].endsWith(target)))) {
          targetMatchedIndex = i;
          break;
        }
      }

      if (targetMatchedIndex === -1) {
        continue;
      }

      if (!rule.actionTokens || rule.actionTokens.length === 0) {
        return rule.discipline;
      }

      let actionMatched = false;
      for (let j = 0; j < tokens.length; j++) {
        // Strikt exact (t === action): voorkomt dat hardware-composieten zoals 'montageset' of 'montagebeugel' als handeling matchen!
        if (j !== targetMatchedIndex && rule.actionTokens.some(action => tokens[j] === action)) {
          actionMatched = true;
          break;
        }
      }

      if (actionMatched) {
        return rule.discipline;
      }
    }
  }

  return undefined;
}

export function detectServiceDiscipline(
  rawDescription: string,
  itemRole?: ItemRole
): ServiceDisciplineResult {
  const isHybrid = detectIsMaterialAndService(rawDescription);
  const matchedDiscipline = matchServiceDisciplineFromTokens(rawDescription);

  if (matchedDiscipline) {
    return {
      discipline: matchedDiscipline,
      isMaterialAndService: isHybrid,
    };
  }

  if (itemRole === 'LABOR_SERVICE' || itemRole === 'SERVICE') {
    return {
      discipline: 'OVERIGE_DIENSTEN',
      isMaterialAndService: false,
    };
  }

  return {
    discipline: undefined,
    isMaterialAndService: false,
  };
}

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
  } else {
    // Service discipline detectie via de declaratieve lexicale ontologie
    const serviceResult = detectServiceDiscipline(raw.articleName);
    if (serviceResult.discipline && !serviceResult.isMaterialAndService) {
      // Zuivere dienst: promoveer naar Categorie 6 arbeidsdienst
      itemRole = 'LABOR_SERVICE';
      productType = serviceResult.discipline;
      domain = 'DIENSTEN';
      confidence = 0.95;
      reasoningParts.push(`Service discipline geïdentificeerd als ${serviceResult.discipline}`);
    } else if (
      /arbeidsloon|uurtarief|montageloon|montagekosten|plaatsingskosten|bezorgkosten|voorrijkosten/i.test(name) &&
      !detectIsMaterialAndService(name)
    ) {
      itemRole = 'LABOR_SERVICE';
      productType = 'OVERIGE_DIENSTEN';
      domain = 'DIENSTEN';
      confidence = 0.95;
      reasoningParts.push('Gedetecteerd als arbeidsloon of servicetarief');
    }
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
          /pvc|laminaat|parket|tapijt|marmoleum|visgraat|dryback|stroken|plint|plinten|ondervloer/i.test(sanitizedText)
        ) {
          domain = 'VLOEREN';
          if (/plint|plinten|plakplint|afwerkplint/i.test(sanitizedText)) {
            productType = 'PLINTEN_PROFIELEN';
            itemRole = 'FINISHED_GOOD';
          } else if (/ondervloer/i.test(sanitizedText)) {
            productType = 'ONDERVLOER';
            itemRole = 'FINISHED_GOOD';
          } else {
            productType = 'PVC_VLOER';
          }
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
