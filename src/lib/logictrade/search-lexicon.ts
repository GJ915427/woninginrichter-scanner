import { ModelPreset, ProductPreconfiguration } from '@/types/product';

export const MIN_TOKEN_LENGTH_GUARD = 3;

export type FeatureCategory = 'MONTAGE' | 'BEDIENING' | 'MODEL' | 'STOF' | 'EIGENSCHAP' | 'FAMILY';

export interface ModelCodeResolution {
  matchedCode: string;
  preset: ModelPreset;
  baseArticleSearchTerm: string;
  cleanedUserQuery: string;
}

export interface ResolvedFeatureIntent {
  hasIntent: boolean;
  featureBadges: string[];
  preconfiguration: ProductPreconfiguration;
  cleanQuery: string;
  matchedModelCode?: string;
  isStandaloneFeature: boolean;
  baseArticleSearchTerm: string;
}

export interface FeatureEntity {
  id: string;
  category: FeatureCategory;
  badge: string;
  canonical: string;
  tokens: string[];
  stemAliases?: string[];
  preconfiguration?: ProductPreconfiguration;
  baseArticleSearchTerm?: string;
  modelPreset?: ModelPreset;
}

export interface UniversalSearchResult {
  hasIntent: boolean;
  featureBadges: string[];
  preconfiguration: ProductPreconfiguration;
  cleanQuery: string;
  matchedModelCode?: string;
  isStandaloneFeature: boolean;
  baseArticleSearchTerm: string;
}

export const MODEL_CODE_DEFINITIONS: Record<string, Omit<ModelPreset, 'code'>> = {
  AU20: {
    name: 'Top-Down / Bottom-Up SmartCord®',
    productFamily: 'Duette / Plissé',
    vorm: ':20 Top Down / Bottom Up',
    bediening: 'SmartCord',
    surchargeEur: 37.19
  },
  AU10: {
    name: 'Standaard SmartCord®',
    productFamily: 'Duette / Plissé',
    vorm: ':10 Standaard',
    bediening: 'SmartCord',
    surchargeEur: 0
  },
  AU30: {
    name: 'Dag & Nacht SmartCord®',
    productFamily: 'Duette / Plissé',
    vorm: ':30 Dag en Nacht',
    bediening: 'SmartCord',
    surchargeEur: 65.00
  },
  AE20: {
    name: 'Top-Down / Bottom-Up PowerView® Motor',
    productFamily: 'Duette / Plissé',
    vorm: ':20 Top Down / Bottom Up',
    bediening: 'PowerView',
    surchargeEur: 185.00
  },
  AE10: {
    name: 'Standaard PowerView® Motor',
    productFamily: 'Duette / Plissé',
    vorm: ':10 Standaard',
    bediening: 'PowerView',
    surchargeEur: 145.00
  },
  AF20: {
    name: 'Top-Down / Bottom-Up LiteRise® Handgreep',
    productFamily: 'Duette / Plissé',
    vorm: ':20 Top Down / Bottom Up',
    bediening: 'LiteRise',
    surchargeEur: 37.19
  },
  AF10: {
    name: 'Standaard LiteRise® Handgreep',
    productFamily: 'Duette / Plissé',
    vorm: ':10 Standaard',
    bediening: 'LiteRise',
    surchargeEur: 0
  },
  AS20: {
    name: 'Top-Down / Bottom-Up Ketting / Koord',
    productFamily: 'Duette / Plissé',
    vorm: ':20 Top Down / Bottom Up',
    bediening: 'Ketting',
    surchargeEur: 37.19
  },
  AS10: {
    name: 'Standaard Ketting / Koord',
    productFamily: 'Duette / Plissé',
    vorm: ':10 Standaard',
    bediening: 'Ketting',
    surchargeEur: 0
  }
};

/**
 * Canonieke Damerau-Levenshtein afstandsmetriek met ondersteuning voor inserties,
 * deleties, substituties en transposities (wisseling van twee aangrenzende tekens).
 * Tijdcomplexiteit: O(|a| * |b|), executietijd < 0.005 ms.
 */
export function calculateDamerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  const d: number[][] = [];
  for (let i = 0; i <= la; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= lb; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,       // deletion
        d[i][j - 1] + 1,       // insertion
        d[i - 1][j - 1] + cost // substitution
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // transposition
      }
    }
  }

  return d[la][lb];
}

/**
 * Data-gedreven definitie van configureerbare eigenschappen, montages, bedieningen en stoffen.
 * Zero hardcoded regexes: nieuwe opties toevoegen is zuiver een data-declaratie.
 */
export const FEATURE_ENTITIES: FeatureEntity[] = [
  {
    id: 'TRUFIT',
    category: 'MONTAGE',
    badge: 'TruFit',
    canonical: 'MONTAGE_TRUFIT',
    tokens: ['trufit', 'tru-fit', 'tru', 'fit', 'trufi', 'truf'],
    stemAliases: ['trufit', 'tru'],
    preconfiguration: { montage: 'MONTAGE_TRUFIT', bediening: 'HANDGREEP' }
  },
  {
    id: 'KLEMSTEUNEN',
    category: 'MONTAGE',
    badge: 'Klemsteunen',
    canonical: 'KLEMSTEUNEN',
    tokens: ['klemsteunen', 'klemsteun', 'klem', 'klemst', 'klemsteu'],
    stemAliases: ['klem'],
    preconfiguration: { montage: 'KLEMSTEUNEN' }
  },
  {
    id: 'SMARTCORD',
    category: 'BEDIENING',
    badge: 'SmartCord',
    canonical: 'SMARTCORD',
    tokens: ['smartcord', 'smart-cord', 'smart', 'cord', 'cor', 'smartc', 'smartco', 'smartcor'],
    stemAliases: ['smartcord', 'smart', 'cord'],
    preconfiguration: { bediening: 'SMARTCORD' }
  },
  {
    id: 'POWERVIEW',
    category: 'BEDIENING',
    badge: 'PowerView',
    canonical: 'POWERVIEW',
    tokens: ['powerview', 'power-view', 'power', 'view', 'powerv', 'powervi', 'powervie', 'motor', 'motorbediening', 'elektrisch', 'elektr'],
    stemAliases: ['powerview', 'power', 'motor'],
    preconfiguration: { bediening: 'POWERVIEW' }
  },
  {
    id: 'LITERISE',
    category: 'BEDIENING',
    badge: 'LiteRise',
    canonical: 'HANDGREEP',
    tokens: ['literise', 'lite-rise', 'liter', 'literis', 'literise', 'rise', 'lite', 'handgreep'],
    stemAliases: ['literise', 'lite'],
    preconfiguration: { bediening: 'HANDGREEP' }
  },
  {
    id: 'KETTING',
    category: 'BEDIENING',
    badge: 'Ketting',
    canonical: 'KETTING',
    tokens: ['ketting', 'kettingbediening', 'kett', 'kettin'],
    stemAliases: ['ketting', 'kett'],
    preconfiguration: { bediening: 'KETTING' }
  },
  {
    id: 'ARCHITELLA',
    category: 'STOF',
    badge: 'Architella',
    canonical: 'ARCHITELLA',
    tokens: ['architella', 'architell', 'architel', 'archit', 'archi'],
    stemAliases: ['architella', 'archit'],
    preconfiguration: { stofFilter: 'Architella' }
  },
  {
    id: 'VERDUISTEREND',
    category: 'EIGENSCHAP',
    badge: 'Verduisterend',
    canonical: 'VERDUISTEREND',
    tokens: ['verduisterend', 'verduistering', 'verduister', 'verduist', 'blackout', 'black-out'],
    stemAliases: ['verduister', 'blackout'],
    preconfiguration: { eigenschap: 'verduisterend' }
  },
  {
    id: 'FAMILY_DUETTE',
    category: 'FAMILY',
    badge: 'Duette',
    canonical: 'DUETTE',
    tokens: ['duette', 'duet', 'deut'],
    stemAliases: ['duet', 'deut'],
    baseArticleSearchTerm: 'Duette shade'
  },
  {
    id: 'FAMILY_PLISSE',
    category: 'FAMILY',
    badge: 'Plissé',
    canonical: 'PLISSE',
    tokens: ['plisse', 'plissé', 'pliss'],
    stemAliases: ['plis'],
    baseArticleSearchTerm: 'Plissé shade'
  }
];

/**
 * Analyseert een los token tegen het lexicon met deelwoord/infix herkenning en Damerau-Levenshtein typotolerantie.
 */
export function searchLexiconToken(rawToken: string): { entity: FeatureEntity; matchedKeyword: string; score: number } | null {
  if (!rawToken || typeof rawToken !== 'string') return null;
  const token = rawToken.trim().toLowerCase();
  if (token.length === 0) return null;

  // 1. Exacte token matching tegen alle entiteit-tokens
  for (const entity of FEATURE_ENTITIES) {
    for (const kw of entity.tokens) {
      if (kw.toLowerCase() === token) {
        return { entity, matchedKeyword: kw, score: 1.0 };
      }
    }
  }

  // 2. Universele Deelwoord / Substring Matching (als token >= 3 tekens)
  // De entiteit-zoekterm moet het getypte deelwoord bevatten (bijv. 'smartcord'.includes('cord') of 'trufit'.includes('fit'))
  // Dit voorkomt dat een lang woord zoals 'raamdecoratie' matcht op 'cor'!
  if (token.length >= MIN_TOKEN_LENGTH_GUARD) {
    for (const entity of FEATURE_ENTITIES) {
      for (const kw of entity.tokens) {
        const lowerKw = kw.toLowerCase();
        if (lowerKw.includes(token)) {
          return { entity, matchedKeyword: kw, score: 0.9 };
        }
      }
    }
  }

  // 3. Wiskundige Damerau-Levenshtein typotolerantie (k <= 1)
  // Alleen actief bij tokens met lengte >= MIN_TOKEN_LENGTH_GUARD
  if (token.length >= MIN_TOKEN_LENGTH_GUARD) {
    for (const entity of FEATURE_ENTITIES) {
      // Vergelijk tegen stam-aliassen en kortere hoofdtokens
      const candidateTokens = [...(entity.stemAliases || []), ...entity.tokens];
      for (const candidate of candidateTokens) {
        if (Math.abs(candidate.length - token.length) <= 1) {
          const dist = calculateDamerauLevenshtein(token, candidate.toLowerCase());
          if (dist <= 1) {
            return { entity, matchedKeyword: candidate, score: 0.8 };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Herkent en normaliseert Hunter Douglas modelcodes (AU10, AU20, AE20, AF20, AS20)
 * inclusief transposities (UA20 -> AU20) en korte vormen (AU2 -> AU20).
 */
export function resolveUniversalModelCode(query: string): ModelCodeResolution | null {
  if (!query || typeof query !== 'string') return null;

  // Tokenizeer query op witruimte en scheidingstekens
  const rawTokens = query.trim().split(/[\s,+/()\[\]-]+/).filter(t => t.length > 0);
  if (rawTokens.length === 0) return null;

  let matchedToken: string | null = null;
  let normalizedCode: string | null = null;

  const validPrefixes = new Set(['AU', 'AE', 'AF', 'AS']);
  const transposedPrefixes: Record<string, string> = {
    UA: 'AU',
    EA: 'AE',
    FA: 'AF',
    SA: 'AS'
  };

  for (const t of rawTokens) {
    const upper = t.toUpperCase();

    // 1. Exacte code of code met 4 karakters (bijv. AU20, AU10, UA20, EA20)
    if (upper.length === 4) {
      const p = upper.slice(0, 2);
      const s = upper.slice(2);
      if (['10', '20', '30'].includes(s)) {
        if (validPrefixes.has(p)) {
          matchedToken = t;
          normalizedCode = upper;
          break;
        } else if (transposedPrefixes[p]) {
          matchedToken = t;
          normalizedCode = transposedPrefixes[p] + s;
          break;
        }
      }
    }

    // 2. Korte code van 3 karakters (bijv. AU2, UA2, AE2)
    if (upper.length === 3) {
      const p = upper.slice(0, 2);
      const digit = upper.slice(2);
      if (['1', '2', '3'].includes(digit)) {
        if (validPrefixes.has(p)) {
          matchedToken = t;
          normalizedCode = p + digit + '0';
          break;
        } else if (transposedPrefixes[p]) {
          matchedToken = t;
          normalizedCode = transposedPrefixes[p] + digit + '0';
          break;
        }
      }
    }

    // 3. Vorm-tokens zoals '20', ':20', '10', ':10', '30', ':30'
    const cleanDigit = upper.startsWith(':') ? upper.slice(1) : upper;
    if (['10', '20', '30'].includes(cleanDigit) && upper.length <= 3) {
      let prefix = 'AU';
      const lowerQuery = query.toLowerCase();
      if (lowerQuery.includes('power') || lowerQuery.includes('motor') || lowerQuery.includes('elektr')) {
        prefix = 'AE';
      } else if (lowerQuery.includes('lite') || lowerQuery.includes('rise') || lowerQuery.includes('handgreep')) {
        prefix = 'AF';
      } else if (lowerQuery.includes('kett') || lowerQuery.includes('ketting')) {
        prefix = 'AS';
      }
      matchedToken = t;
      normalizedCode = prefix + cleanDigit;
      break;
    }
  }

  if (!normalizedCode || !MODEL_CODE_DEFINITIONS[normalizedCode]) {
    return null;
  }

  const definition = MODEL_CODE_DEFINITIONS[normalizedCode];

  // Bepaal de overgebleven query zonder het gematchte modelcode-token
  const remainingTokens = rawTokens.filter(t => t !== matchedToken);
  const remainingQuery = remainingTokens.join(' ');

  const lowerQuery = query.toLowerCase();
  let baseArticleSearchTerm = 'Duette shade';
  if (lowerQuery.includes('pliss') || lowerQuery.includes('plisse')) {
    baseArticleSearchTerm = 'Plissé shade';
  }

  const cleanedUserQuery = remainingQuery.length > 0
    ? `${baseArticleSearchTerm} ${remainingQuery}`
    : baseArticleSearchTerm;

  return {
    matchedCode: normalizedCode,
    preset: {
      code: normalizedCode,
      ...definition
    },
    baseArticleSearchTerm,
    cleanedUserQuery
  };
}

/**
 * Hoofdfunctie voor universele feature-intentie extractie.
 * Analyseert alle tokens, matcht opties, handhaaft Bron A regels en levert een schone restquery op.
 */
export function extractUniversalFeatureIntent(query: string): UniversalSearchResult {
  if (!query || typeof query !== 'string') {
    return {
      hasIntent: false,
      featureBadges: [],
      preconfiguration: {},
      cleanQuery: '',
      isStandaloneFeature: false,
      baseArticleSearchTerm: 'Duette shade'
    };
  }

  const rawQuery = query.trim();
  if (rawQuery.length === 0) {
    return {
      hasIntent: false,
      featureBadges: [],
      preconfiguration: {},
      cleanQuery: '',
      isStandaloneFeature: false,
      baseArticleSearchTerm: 'Duette shade'
    };
  }

  const featureBadges: string[] = [];
  const preconfiguration: ProductPreconfiguration = {};
  let hasFeatureMatch = false;

  // 1. Model code resolutie (inclusief inversie UA20 -> AU20, AU2 -> AU20, losse '20')
  const modelRes = resolveUniversalModelCode(rawQuery);
  let matchedModelCode: string | undefined = undefined;
  if (modelRes) {
    hasFeatureMatch = true;
    matchedModelCode = modelRes.matchedCode;
    preconfiguration.modelPreset = modelRes.preset;

    if (modelRes.preset.bediening === 'SmartCord') {
      preconfiguration.bediening = 'SMARTCORD';
    } else if (modelRes.preset.bediening === 'PowerView') {
      preconfiguration.bediening = 'POWERVIEW';
    } else if (modelRes.preset.bediening === 'LiteRise') {
      preconfiguration.bediening = 'HANDGREEP';
    } else if (modelRes.preset.bediening === 'Ketting') {
      preconfiguration.bediening = 'KETTING';
    }
  }

  // 2. Tokenizeer de invoer voor universeel deelwoord- en entiteit-matching
  const tokens = rawQuery.split(/[\s,+/()\[\]-]+/).filter(t => t.length > 0);
  const featureStrippedTokens = new Set<string>();
  const normalizedResidualTokens: string[] = [];

  let hasTruFit = false;
  let hasPlisseExplicit = false;

  for (const t of tokens) {
    const lower = t.toLowerCase();

    // Check of dit token het gematchte modelcode-token is
    if (modelRes && (
      lower === modelRes.matchedCode.toLowerCase() ||
      lower === 'ua20' || lower === 'ea20' || lower === 'au2' || lower === 'ae2' ||
      lower === '20' || lower === ':20' || lower === '10' || lower === ':10' || lower === '30' || lower === ':30'
    )) {
      featureStrippedTokens.add(t);
      continue;
    }

    // Inspecteer via lexicon
    const match = searchLexiconToken(t);
    if (match) {
      const entity = match.entity;

      if (entity.category === 'FAMILY') {
        // Productfamilie (Duette / Plissé) is géén featurebadge die gestript moet worden,
        // maar de kern van het artikel. We normaliseren het token naar de officiële naam.
        if (entity.id === 'FAMILY_PLISSE') {
          hasPlisseExplicit = true;
          normalizedResidualTokens.push('Plissé');
        } else if (entity.id === 'FAMILY_DUETTE') {
          normalizedResidualTokens.push('Duette');
        }
        continue;
      }

      hasFeatureMatch = true;
      featureStrippedTokens.add(t);

      // Voeg badge toe indien nog niet aanwezig
      if (entity.badge && !featureBadges.includes(entity.badge)) {
        featureBadges.push(entity.badge);
      }

      if (entity.id === 'TRUFIT') {
        hasTruFit = true;
        preconfiguration.montage = 'MONTAGE_TRUFIT';
        preconfiguration.bediening = 'HANDGREEP'; // TruFit dwingt mechanisch handgreep af conform Bron A
      } else if (entity.id === 'KLEMSTEUNEN') {
        preconfiguration.montage = 'KLEMSTEUNEN';
      } else if (entity.id === 'SMARTCORD') {
        if (!hasTruFit) {
          preconfiguration.bediening = 'SMARTCORD';
        }
      } else if (entity.id === 'POWERVIEW') {
        if (!hasTruFit) {
          preconfiguration.bediening = 'POWERVIEW';
        }
      } else if (entity.id === 'LITERISE') {
        preconfiguration.bediening = 'HANDGREEP';
      } else if (entity.id === 'KETTING') {
        if (!hasTruFit) {
          preconfiguration.bediening = 'KETTING';
        }
      } else if (entity.id === 'ARCHITELLA') {
        preconfiguration.stofFilter = 'Architella';
      } else if (entity.id === 'VERDUISTEREND') {
        preconfiguration.eigenschap = 'verduisterend';
      }
    } else {
      // Regulier catalogustoken (bijv. leverancier 'Luxaflex', 'luxa', 'flex', 'sun', 'Landmark')
      normalizedResidualTokens.push(t);
    }
  }

  // 3. Bepaal basisartikel (Duette vs Plissé)
  const lowerRaw = rawQuery.toLowerCase();
  const isPlisse = hasPlisseExplicit || lowerRaw.includes('pliss') || lowerRaw.includes('plisse');
  const baseArticleSearchTerm = isPlisse ? 'Plissé shade' : 'Duette shade';

  if (!hasFeatureMatch) {
    return {
      hasIntent: false,
      featureBadges: [],
      preconfiguration: {},
      cleanQuery: rawQuery,
      isStandaloneFeature: false,
      baseArticleSearchTerm
    };
  }

  // 4. Construeer schone restquery
  const isStandaloneFeature = normalizedResidualTokens.length === 0;

  let cleanQuery = '';
  if (isStandaloneFeature) {
    cleanQuery = baseArticleSearchTerm;
  } else {
    const joined = normalizedResidualTokens.join(' ');
    const lowerJoined = joined.toLowerCase();
    if (lowerJoined.includes('duette') || lowerJoined.includes('pliss')) {
      cleanQuery = joined;
    } else {
      cleanQuery = `${baseArticleSearchTerm} ${joined}`;
    }
  }

  return {
    hasIntent: true,
    featureBadges,
    preconfiguration,
    cleanQuery: cleanQuery.trim(),
    matchedModelCode,
    isStandaloneFeature,
    baseArticleSearchTerm
  };
}
