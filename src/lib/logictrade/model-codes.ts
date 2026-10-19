import {
  ModelCodeResolution,
  ResolvedFeatureIntent,
  MODEL_CODE_DEFINITIONS,
  resolveUniversalModelCode,
  extractUniversalFeatureIntent
} from './search-lexicon';

export type { ModelCodeResolution, ResolvedFeatureIntent };
export { MODEL_CODE_DEFINITIONS };

/**
 * Resolves a model code from user search input by delegating to UniversalSearchLexicon.
 * NUL REGEXES: data-gedreven wiskundige token-parsing en Damerau-Levenshtein typotolerantie.
 */
export function resolveModelCode(query: string): ModelCodeResolution | null {
  return resolveUniversalModelCode(query);
}

/**
 * Resolves feature intent from user search input by delegating to UniversalSearchLexicon.
 * NUL REGEXES: universele deelwoord/infix herkenning, stam-aliassen en Bron A constraint-afhandeling.
 */
export function resolveFeatureIntent(query: string): ResolvedFeatureIntent {
  return extractUniversalFeatureIntent(query);
}
