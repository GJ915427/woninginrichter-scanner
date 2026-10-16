/**
 * Query Intent Resolver voor V2 Greenfield Cognitive CPQ Search Engine
 * 
 * Voldoet aan:
 * - Grondwet Laag 1B § 6 (Things & Capabilities, not Strings)
 * - Deterministische tokenisatie, sanitization en orthogonale scheiding tussen
 *   Entiteit, Categoriecontext, Attribuut-intenties en Merken.
 * - Hergebruik van het canonieke ModelPreset contract via @/lib/logictrade/search-lexicon.
 */

import { ModelPreset } from '@/types/product';
import { resolveUniversalModelCode } from '@/lib/logictrade/search-lexicon';
import { DomainCategory } from './canonical-catalog';

export interface ParsedQueryTokens {
  rawQuery: string;
  sanitizedQuery: string;
  normalizedTokens: string[];
  entityHints: string[];
  domainHints: DomainCategory[];
  attributeTokens: string[];
  contextTokens: string[];
  brandHints: string[];
  modelPreset?: ModelPreset;
  isAccessoryOnly: boolean;
  isEmpty: boolean;
}

const DOMAIN_KEYWORD_MAP: Record<string, DomainCategory> = {
  duette: 'RAAMBEKLEDING',
  duettes: 'RAAMBEKLEDING',
  plisse: 'RAAMBEKLEDING',
  plissé: 'RAAMBEKLEDING',
  jaloezie: 'RAAMBEKLEDING',
  jaloezieen: 'RAAMBEKLEDING',
  rolgordijn: 'RAAMBEKLEDING',
  gordijn: 'RAAMBEKLEDING',
  raambekleding: 'RAAMBEKLEDING',
  raamdecoratie: 'RAAMBEKLEDING',
  tapijt: 'VLOEREN',
  vloerbedekking: 'VLOEREN',
  pvc: 'VLOEREN',
  laminaat: 'VLOEREN',
  vinyl: 'VLOEREN',
  vloer: 'VLOEREN',
  hordeur: 'HORREN',
  hor: 'HORREN',
  inzethor: 'HORREN',
  plissehordeur: 'HORREN'
};

const CONTEXT_WORDS = new Set(['raam', 'ramen', 'vloer', 'vloeren', 'kamer', 'interieur', 'huis']);
const BRAND_WORDS = new Set(['luxaflex', 'interfloor', 'sunway', 'velux', 'droma', 'multisol']);
const ACCESSORY_WORDS = new Set(['klemsteun', 'klemsteunen', 'klemhouder', 'plakstrip', 'zijgeleiding', 'montageset', 'steun', 'steunen', 'klem']);

/**
 * Sanitizes input query string: trim, normaliseer whitespace, leestekens fail-closed
 */
export function sanitizeQueryInput(query: string): string {
  if (!query || typeof query !== 'string') return '';
  return query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s:éèëïöüä-]/gi, ' ')
    .replace(/(^|\s)-+|-(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolves user query intent orthogonally:
 * - Checks for universal model codes (e.g. AU20, UA20)
 * - Identifies entity words vs context words vs attributes
 * - Detects explicit domain preferences and standalone accessory intents
 */
export function resolveQueryIntent(query: string): ParsedQueryTokens {
  const sanitized = sanitizeQueryInput(query);
  if (!sanitized) {
    return {
      rawQuery: query || '',
      sanitizedQuery: '',
      normalizedTokens: [],
      entityHints: [],
      domainHints: [],
      attributeTokens: [],
      contextTokens: [],
      brandHints: [],
      isAccessoryOnly: false,
      isEmpty: true
    };
  }

  // 1. Check universele modelcode resolutie (bv. AU20, UA20, EA20) via search-lexicon
  const modelCodeRes = resolveUniversalModelCode(query);
  const effectiveQuery = sanitized;
  let detectedModelPreset: ModelPreset | undefined = undefined;

  if (modelCodeRes && modelCodeRes.preset) {
    detectedModelPreset = modelCodeRes.preset;
  }

  // 2. Tokenize op witruimte en scheidingstekens
  const rawTokens = effectiveQuery.split(/\s+/).filter(t => t.length > 0 && /[a-z0-9éèëïöüä]/i.test(t));
  if (rawTokens.length === 0) {
    return {
      rawQuery: query || '',
      sanitizedQuery: '',
      normalizedTokens: [],
      entityHints: [],
      domainHints: [],
      attributeTokens: [],
      contextTokens: [],
      brandHints: [],
      isAccessoryOnly: false,
      isEmpty: true
    };
  }
  const normalizedTokens: string[] = [];
  const entityHints: string[] = [];
  const domainHints: DomainCategory[] = [];
  const attributeTokens: string[] = [];
  const contextTokens: string[] = [];
  const brandHints: string[] = [];

  for (const token of rawTokens) {
    normalizedTokens.push(token);

    if (BRAND_WORDS.has(token)) {
      brandHints.push(token);
      continue;
    }

    if (CONTEXT_WORDS.has(token)) {
      contextTokens.push(token);
      continue;
    }

    const domain = DOMAIN_KEYWORD_MAP[token];
    if (domain) {
      entityHints.push(token);
      if (!domainHints.includes(domain)) {
        domainHints.push(domain);
      }
      continue;
    }

    // Overige tokens zijn attribuut-intenties (bv. 'draai', 'wit', 'smartcord', 'klemsteun')
    attributeTokens.push(token);
  }

  // 3. Standalone accessoire detectie (bv. 'klemsteun luxaflex' zonder 'duette')
  const hasAccessoryToken = attributeTokens.some(t => ACCESSORY_WORDS.has(t));
  const hasPrimaryEntity = entityHints.some(t => t.includes('duette') || t.includes('plisse') || t.includes('tapijt') || t.includes('jaloezie'));
  const isAccessoryOnly = hasAccessoryToken && !hasPrimaryEntity;

  // Bij modelcode AU20 intentie: indien geen entiteit expliciet genoemd, default entiteit Duette/Plissé
  if (detectedModelPreset && entityHints.length === 0) {
    entityHints.push('duette', 'plisse');
    if (!domainHints.includes('RAAMBEKLEDING')) {
      domainHints.push('RAAMBEKLEDING');
    }
  }

  return {
    rawQuery: query,
    sanitizedQuery: sanitized,
    normalizedTokens,
    entityHints,
    domainHints,
    attributeTokens,
    contextTokens,
    brandHints,
    modelPreset: detectedModelPreset,
    isAccessoryOnly,
    isEmpty: false
  };
}
