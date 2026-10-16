/**
 * Greenfield Search Engine Facade voor V2 Cognitive CPQ Search Engine
 * 
 * Voldoet aan:
 * - Grondwet Laag 1B § 6 (Things & Capabilities, not Strings)
 * - INV-GOV-21 (Monetary CPQ SSOT Isolation: centrale facade, stateless pipeline)
 * - Natuurlijke ranking: accessoires bovenaan bij solitaire vraag, onderaan bij samengestelde vraag
 * - Homoniemfiltering: raambekleding voorrang bij 'duette'; tapijt uitsluitend bij vloercontext
 * - Fail-closed lege/whitespace query afhandeling
 */

import { CatalogProvider, InMemorySeedCatalogProvider, CanonicalSeedProduct } from './canonical-catalog';
import { resolveQueryIntent, ParsedQueryTokens } from './query-intent-resolver';
import { discretizeSearchResults, DiscretizedResultRow } from './knowledge-graph-binder';

const DEFAULT_PROVIDER = new InMemorySeedCatalogProvider();

/**
 * Berekent de relevantiescore (0.00 tot 1.00) voor een catalogusartikel
 */
export function calculateRelevanceScore(product: CanonicalSeedProduct, intent: ParsedQueryTokens): number {
  if (product.domain === 'UNCLASSIFIED' || product.isDiscontinued) {
    return 0.0;
  }
  if (intent.isEmpty) {
    return 0.0;
  }

  const nameLower = product.name.toLowerCase();
  const codeLower = product.code.toLowerCase();
  const queryLower = intent.sanitizedQuery.toLowerCase();

  // 1. Exacte SKU of artikelcode match (bv. "A00052469")
  if (codeLower === queryLower || intent.normalizedTokens.some(t => t.toUpperCase() === product.code)) {
    return 1.0;
  }

  // 2. Harde domein-coherentie filter:
  // Als query domeintags bevat (bv. VLOEREN of RAAMBEKLEDING), moeten producten tot dat domein behoren.
  if (intent.domainHints.length > 0 && !intent.domainHints.includes(product.domain)) {
    return 0.0;
  }

  // 3. Entiteit-filtering bij expliciete entiteitshints (bv. 'duette', 'plisse', 'tapijt')
  const entityTypeLower = product.entityType.toLowerCase().replace(/_/g, ' ');
  const hasEntityMatch = intent.entityHints.length === 0 || intent.entityHints.some(eh => {
    const hint = eh.toLowerCase();
    return nameLower.includes(hint) ||
           codeLower.includes(hint) ||
           entityTypeLower.includes(hint) ||
           (product.synonyms && product.synonyms.some(s => s.toLowerCase().includes(hint) || hint.includes(s.toLowerCase())));
  });

  // Als de zoekopdracht een expliciete entiteit bevat (bv. 'duette'),
  // en dit product past daar niet bij (bv. 'plissé'), diskwalificeer dit product
  if (!hasEntityMatch) {
    return 0.0;
  }

  // 4. Bereken cumulatieve match-score
  let matchScore = 0.0;
  let hasAnyMatch = false;

  // Exacte modelcode match (bv. "AU20" op Duette/Plissé)
  if (intent.modelPreset && (product.entityType === 'DUETTE_SHADE' || product.entityType === 'PLISSE_SHADE')) {
    matchScore += 0.85;
    hasAnyMatch = true;
  }

  // Entiteitsmatch punten
  if (intent.entityHints.length > 0 && hasEntityMatch) {
    matchScore += 0.40;
    hasAnyMatch = true;
  }

  // Merk-matching (bv. "Luxaflex", "Interfloor")
  if (intent.brandHints.length > 0 && intent.brandHints.some(b => product.brand.toLowerCase() === b)) {
    matchScore += 0.20;
    hasAnyMatch = true;
  }

  // Attribuut / capability matching (bv. "draai", "klemsteun", "smartcord", "antraciet")
  const matchesAnyCapability = product.capabilities.some(cap =>
    cap.options.some(opt =>
      opt.triggerTokens.some(trig => intent.attributeTokens.some(tok => trig.toLowerCase() === tok.toLowerCase()))
    )
  );
  if (matchesAnyCapability) {
    matchScore += 0.30;
    hasAnyMatch = true;
  }

  // Tekstmatch op naam of omschrijving met attributeTokens / normalizedTokens
  const textMatch = intent.normalizedTokens.some(t =>
    nameLower.includes(t) ||
    (product.description && product.description.toLowerCase().includes(t)) ||
    (product.synonyms && product.synonyms.some(s => s.toLowerCase().includes(t)))
  );
  if (textMatch) {
    matchScore += 0.15;
    hasAnyMatch = true;
  }

  // Als er totaal GEEN ENKELE match is met de query tokens, score is 0.0!
  if (!hasAnyMatch) {
    return 0.0;
  }

  // 5. Rol-prioriteit weging (Accessoire vs Hoofdproduct)
  if (intent.isAccessoryOnly) {
    if (product.itemRole === 'ACCESSORY') {
      matchScore += 0.30;
    } else {
      matchScore -= 0.50;
    }
  } else {
    // Standaard productzoekopdracht: Hoofdproducten hebben voorrang
    if (product.itemRole === 'PRODUCT') {
      matchScore += 0.15;
    } else if (product.itemRole === 'ACCESSORY') {
      matchScore -= 0.20;
    }
  }

  return Math.min(1.0, Math.max(0.0, matchScore));
}

/**
 * Rangschikt gediscretiseerde rijen op basis van berekende relevantiescore
 */
export function rankSearchResults(
  rows: DiscretizedResultRow[],
  intent: ParsedQueryTokens,
  catalogProducts: Map<number, CanonicalSeedProduct>
): DiscretizedResultRow[] {
  return [...rows].sort((a, b) => {
    const prodA = catalogProducts.get(a.baseProductId);
    const prodB = catalogProducts.get(b.baseProductId);
    const scoreA = prodA ? calculateRelevanceScore(prodA, intent) : 0;
    const scoreB = prodB ? calculateRelevanceScore(prodB, intent) : 0;

    if (Math.abs(scoreB - scoreA) > 0.001) {
      return scoreB - scoreA;
    }

    // Bij gelijke score van hetzelfde product: behoud stabiele catalogusvolgorde
    if (a.baseProductId === b.baseProductId) {
      return 0;
    }

    // Bij verschillende producten met gelijke score: hoofdproducten boven accessoires
    const roleA = prodA?.itemRole || 'PRODUCT';
    const roleB = prodB?.itemRole || 'PRODUCT';
    if (roleA !== roleB) {
      return roleA === 'PRODUCT' ? -1 : 1;
    }

    return 0;
  });
}

/**
 * Centrale functionele zoekfunctie conform V2 Greenfield architectuur
 */
export async function searchGreenfield(
  query: string,
  provider: CatalogProvider = DEFAULT_PROVIDER
): Promise<DiscretizedResultRow[]> {
  const intent = resolveQueryIntent(query);

  // Fail-closed lege/whitespace query afhandeling conform Scenario E5
  if (intent.isEmpty) {
    return [];
  }

  const catalog = await provider.getCatalog();
  const catalogMap = new Map<number, CanonicalSeedProduct>();
  for (const prod of catalog) {
    catalogMap.set(prod.id, prod);
  }

  // Filter artikelen op basis van relevantiedrempel
  const eligibleProducts = catalog.filter(product => {
    const score = calculateRelevanceScore(product, intent);
    return score >= 0.20;
  });

  // Discretiseer in aanmerking komende artikelen
  const allRows: DiscretizedResultRow[] = [];
  for (const product of eligibleProducts) {
    const discretized = discretizeSearchResults(product, intent);
    allRows.push(...discretized);
  }

  // Rangschik resultaten conform semantische prioriteit
  return rankSearchResults(allRows, intent, catalogMap);
}

/**
 * Centrale klasse facade voor Greenfield Search Engine
 */
export class GreenfieldSearchEngine {
  private readonly provider: CatalogProvider;

  constructor(provider: CatalogProvider = DEFAULT_PROVIDER) {
    this.provider = provider;
  }

  async search(query: string): Promise<DiscretizedResultRow[]> {
    return searchGreenfield(query, this.provider);
  }
}
