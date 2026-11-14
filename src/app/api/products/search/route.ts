import { NextResponse } from 'next/server';
import {
  LogicTradeProductRaw,
  LogicTradeResponseEnvelope,
  SearchResultItem,
  SearchApiResponse,
  LogicTradePagination
} from '@/types/product';
import { isSupabaseConfigured, getSyncState, searchProductsFts } from '@/lib/supabase/client';
import { resolveModelCode, resolveFeatureIntent } from '@/lib/logictrade/model-codes';
import {
  getDynamicAttributeRegistry,
  evaluateArticleVennMatch,
  resolveEffectiveProductCategory
} from '@/domain/search/dynamic-attribute-registry';
import { determineProductCategory } from '@/domain/configurator/conclaaf-rules-engine';
import {
  KNOWN_NON_SUPPLIER_TOKENS,
  DEFAULT_API_KEY,
  DEFAULT_BASE_URL,
  DISCONTINUED_REGEX,
  sanitizeQuery,
  normalizeForComparison,
  getSuppliersCache,
  parseMultiTokenQuery,
  calculateProductRelevanceTier,
  normalizeProduct
} from '@/lib/logictrade/product-search-helpers';

interface FetchResult {
  products: LogicTradeProductRaw[];
  pagination?: LogicTradePagination;
}

/**
 * Voert een zoekopdracht uit tegen de LogicTrade Cloud REST API.
 */
async function fetchFromLogicTrade(
  paramKey: 'code' | 'name',
  queryValue: string,
  apiKey: string,
  baseUrl: string,
  adminGuid?: string
): Promise<FetchResult> {
  const url = `${baseUrl}/products?${paramKey}=${encodeURIComponent(queryValue)}&pageSize=20`;

  const headers: Record<string, string> = {
    'api-key': apiKey,
    'Accept': 'application/json'
  };

  if (adminGuid) {
    headers['administration-guid'] = adminGuid;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(5000)
  });

  if (!response.ok) {
    if (response.status === 429) {
      const err = new Error('LogicTrade Cloud API rate limit bereikt (te veel verzoeken). Probeer het over enkele seconden opnieuw.');
      (err as any).status = 429;
      throw err;
    }
    const err = new Error(`LogicTrade API fout: HTTP ${response.status} ${response.statusText}`);
    (err as any).status = response.status;
    throw err;
  }

  const envelope = (await response.json()) as LogicTradeResponseEnvelope;
  return {
    products: envelope.results || [],
    pagination: envelope.pagination
  };
}

/**
 * Next.js GET Route Handler: /api/products/search?q={query}
 */
export async function GET(request: Request): Promise<NextResponse<SearchApiResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get('q') || '';
    const cleanQuery = sanitizeQuery(rawQuery);

    if (cleanQuery.length < 2) {
      return NextResponse.json(
        {
          success: false,
          query: rawQuery,
          count: 0,
          items: [],
          error: 'Zoekopdracht moet minimaal 2 karakters bevatten.'
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.LOGICTRADE_API_KEY || DEFAULT_API_KEY;
    const baseUrl = (process.env.LOGICTRADE_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
    const adminGuid = process.env.LOGICTRADE_ADMIN_GUID;

    // Feature & Intent herkenning via Dynamic Attribute Graph SSOT
    const attributeRegistry = getDynamicAttributeRegistry();
    const attributeMatch = attributeRegistry.resolveIntent(cleanQuery);
    const featureIntent = resolveFeatureIntent(cleanQuery);
    const modelResolution = resolveModelCode(cleanQuery);

    const categoryFilter = attributeMatch.hasMatch ? attributeMatch.targetCategory : undefined;
    let effectiveSearchQuery = cleanQuery;
    if (featureIntent.hasIntent && featureIntent.cleanQuery) {
      effectiveSearchQuery = featureIntent.cleanQuery;
    } else if (modelResolution && modelResolution.cleanedUserQuery) {
      effectiveSearchQuery = modelResolution.cleanedUserQuery;
    } else if (attributeMatch.hasMatch) {
      effectiveSearchQuery = attributeMatch.residualQuery || '';
    }

    // 1. Probeer primair de snelle Supabase Full-Text Search index (sub-10ms)
    if (isSupabaseConfigured()) {
      try {
        const syncState = await getSyncState('catalog_sync');
        const isCatalogInitialized = (syncState?.total_synced ?? 0) > 0;

        if (isCatalogInitialized) {
          const { rows, totalCount } = await searchProductsFts(cleanQuery, 20, 0, categoryFilter);

          const mappedItems: SearchResultItem[] = rows.map((r) => {
            const isDiscontinued = Boolean(
              (r as any).is_discontinued ||
              (r.description && DISCONTINUED_REGEX.test(r.description)) ||
              (r.name && DISCONTINUED_REGEX.test(r.name))
            );

            // Dynamische preconfiguratie en feature badges
            const preconfiguration: Record<string, any> = {
              ...(featureIntent.hasIntent ? featureIntent.preconfiguration : {})
            };
            if (attributeMatch.hasMatch && attributeMatch.stepId && attributeMatch.value) {
              if (!preconfiguration[attributeMatch.stepId]) {
                preconfiguration[attributeMatch.stepId] = attributeMatch.value;
              }
            }

            const featureBadgesSet = new Set<string>();
            if (featureIntent.hasIntent && featureIntent.featureBadges) {
              for (const b of featureIntent.featureBadges) {
                featureBadgesSet.add(b);
              }
            }
            if (attributeMatch.hasMatch && attributeMatch.badgeLabel) {
              featureBadgesSet.add(attributeMatch.badgeLabel);
            }
            const featureBadges = Array.from(featureBadgesSet);

            return {
              id: r.id,
              code: r.code,
              name: r.name,
              salesGroup: r.sales_group,
              supplierName: r.supplier_name,
              supplierId: r.supplier_id,
              groups: r.groups && r.groups.length > 0 ? r.groups : (r.group_name ? [r.group_name] : []),
              salesPrice: Number(r.sales_price) || 0,
              vatCode: r.vat_code,
              unit: r.unit,
              modelPreset: modelResolution?.preset || featureIntent.preconfiguration.modelPreset,
              ...(featureBadges.length > 0 ? { featureBadges } : {}),
              ...(Object.keys(preconfiguration).length > 0 ? { preconfiguration } : {}),
              ...(isDiscontinued ? { isDiscontinued: true } : {})
            };
          });

          // Multi-Facet Venn Diagram Post-Filter & Preselectie Merge
          const items: SearchResultItem[] = [];
          for (const item of mappedItems) {
            const venn = evaluateArticleVennMatch(item, cleanQuery);
            if (!venn.matched) {
              continue;
            }
            const mergedPreconf = {
              ...(item.preconfiguration || {}),
              ...(venn.preconfiguration || {})
            };
            const mergedBadges = Array.from(
              new Set([...(item.featureBadges || []), ...(venn.featureBadges || [])])
            );
            const effCat = resolveEffectiveProductCategory(item);
            let finalSalesGroup = item.salesGroup;
            if (determineProductCategory(item) !== effCat) {
              if (effCat === 'vloeren') finalSalesGroup = 'Vloerbedekking';
              else if (effCat === 'gordijnen') finalSalesGroup = 'Gordijnen';
              else if (effCat === 'raamdecoratie') finalSalesGroup = 'Raamdecoratie';
            }

            items.push({
              ...item,
              salesGroup: finalSalesGroup,
              ...(Object.keys(mergedPreconf).length > 0 ? { preconfiguration: mergedPreconf } : {}),
              ...(mergedBadges.length > 0 ? { featureBadges: mergedBadges } : {}),
              modelPreset: (mergedPreconf as any).modelPreset || item.modelPreset
            });
          }

          // Stabiele prioriteitssortering conform Tiered Relevance Pyramid
          items.sort((a, b) => {
            const aTier = calculateProductRelevanceTier(a.name, '', Boolean(a.isDiscontinued));
            const bTier = calculateProductRelevanceTier(b.name, '', Boolean(b.isDiscontinued));
            if (aTier !== bTier) return bTier - aTier; // Hoogste tier eerst
            return 0; // Behoudt FTS/RPC relevantie rangschikking binnen dezelfde tier
          });

          const adjustedTotal = items.length < mappedItems.length ? items.length : totalCount;

          return NextResponse.json({
            success: true,
            query: cleanQuery,
            count: items.length,
            items,
            pagination: {
              page: 1,
              pageSize: 20,
              totalResults: adjustedTotal,
              totalPages: Math.max(1, Math.ceil(adjustedTotal / 20)),
              hasMore: adjustedTotal > 20
            }
          });
        }
      } catch (dbErr) {
        console.warn('Supabase FTS zoekquery gefaald, schakel over naar live LogicTrade fallback:', dbErr);
        // Val automatisch door naar LogicTrade live API fallback
      }
    }

    // 2. Fallback: Live LogicTrade API bevraging
    const suppliers = await getSuppliersCache();
    const queryForFallback = cleanQuery;
    const { matchedSupplier, searchTerm, productTokens } = parseMultiTokenQuery(queryForFallback, suppliers);

    // Parallel bevragen op artikelcode, omschrijving en eventuele leveranciersterm
    const requests = [
      fetchFromLogicTrade('code', queryForFallback, apiKey, baseUrl, adminGuid),
      fetchFromLogicTrade('name', searchTerm, apiKey, baseUrl, adminGuid)
    ];

    if (searchTerm !== queryForFallback) {
      requests.push(fetchFromLogicTrade('name', queryForFallback, apiKey, baseUrl, adminGuid));
    }

    const results = await Promise.allSettled(requests);

    const successfulResults: FetchResult[] = [];
    let rateLimitError: Error | null = null;

    for (const res of results) {
      if (res.status === 'fulfilled') {
        successfulResults.push(res.value);
      } else if ((res.reason as any)?.status === 429) {
        rateLimitError = res.reason;
      }
    }

    // Foutafhandeling indien alle verzoeken faalden
    if (successfulResults.length === 0) {
      if (rateLimitError) {
        return NextResponse.json(
          {
            success: false,
            query: cleanQuery,
            count: 0,
            items: [],
            error: rateLimitError.message
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          query: cleanQuery,
          count: 0,
          items: [],
          error: 'Catalogus tijdelijk niet bereikbaar. Probeer het over enkele ogenblikken opnieuw.'
        },
        { status: 502 }
      );
    }

    const allRaw: LogicTradeProductRaw[] = [];
    let maxTotalResults = 0;
    let maxTotalPages = 1;

    for (const r of successfulResults) {
      allRaw.push(...r.products);
      if (r.pagination?.totalResults && r.pagination.totalResults > maxTotalResults) {
        maxTotalResults = r.pagination.totalResults;
        maxTotalPages = r.pagination.totalPages;
      }
    }

    // Dedupliceren op uniek product ID
    const uniqueMap = new Map<number, LogicTradeProductRaw>();
    for (const prod of allRaw) {
      if (!uniqueMap.has(prod.id)) {
        uniqueMap.set(prod.id, prod);
      }
    }

    const normalizedCandidates = Array.from(uniqueMap.values()).map(normalizeProduct);
    const sTarget = matchedSupplier ? normalizeForComparison(matchedSupplier.companyName) : '';
    const normProductTokens = productTokens
      .map(normalizeForComparison)
      .filter(t => t.length >= 2 && !KNOWN_NON_SUPPLIER_TOKENS.has(t));

    // Strikte Conjunctieve (AND) Filterpoort
    const conjunctiveItems = normalizedCandidates.filter((item) => {
      // 1. Harde leveranciersisolatie met Empty-String Guard
      if (matchedSupplier && sTarget) {
        const itemSupplier = normalizeForComparison(item.supplierName);
        const itemGroups = item.groups.map(normalizeForComparison);

        const matchesSupplier =
          Boolean(itemSupplier) &&
          (itemSupplier.includes(sTarget) ||
            (itemSupplier.length >= 3 && sTarget.includes(itemSupplier)) ||
            itemGroups.some((g) => g.includes(sTarget)));

        if (!matchesSupplier) {
          return false; // Verwerp artikelen van concurrerende leveranciers
        }
      }

      // 2. Universele Multi-Facet Venn Diagram Match
      const venn = evaluateArticleVennMatch(item, cleanQuery);
      if (!venn.matched) {
        return false;
      }

      return true;
    });

    // Rangschikken van de gefilterde set (exacte code match > naam match > alfabetisch)
    const normTarget = normalizeForComparison(cleanQuery);
    const normTerm = normalizeForComparison(searchTerm);

    const sortedItems = conjunctiveItems
      .sort((a, b) => {
        // Prioriteit Tier: Hoofdproducten (+100) > Varianten (+50) > Accessoires (+10) > Stalen (-80) > Uitlopend (-200)
        const aTier = calculateProductRelevanceTier(a.name, '', Boolean(a.isDiscontinued));
        const bTier = calculateProductRelevanceTier(b.name, '', Boolean(b.isDiscontinued));
        if (aTier !== bTier) return bTier - aTier;

        const aCodeExact = normalizeForComparison(a.code) === normTarget;
        const bCodeExact = normalizeForComparison(b.code) === normTarget;
        if (aCodeExact && !bCodeExact) return -1;
        if (!aCodeExact && bCodeExact) return 1;

        const aNameExact = normalizeForComparison(a.name) === normTarget || normalizeForComparison(a.name) === normTerm;
        const bNameExact = normalizeForComparison(b.name) === normTarget || normalizeForComparison(b.name) === normTerm;
        if (aNameExact && !bNameExact) return -1;
        if (!aNameExact && bNameExact) return 1;

        return a.name.localeCompare(b.name);
      })
      .slice(0, 25);

    // Paginatie Metadata Sanitatie
    let totalResults = 0;
    let totalPages = 0;
    let hasMore = false;

    if (sortedItems.length > 0) {
      const wereItemsFilteredOut = conjunctiveItems.length < normalizedCandidates.length;
      if (wereItemsFilteredOut) {
        totalResults = conjunctiveItems.length;
        totalPages = Math.ceil(totalResults / 20);
        hasMore = totalResults > 20;
      } else {
        totalResults = Math.max(maxTotalResults, conjunctiveItems.length);
        totalPages = Math.max(maxTotalPages, Math.ceil(totalResults / 20));
        hasMore = totalResults > conjunctiveItems.length;
      }
    }

    const finalItems = sortedItems.map((item) => {
      const venn = evaluateArticleVennMatch(item, cleanQuery);
      const preconfiguration: Record<string, any> = {
        ...(featureIntent.hasIntent ? featureIntent.preconfiguration : {}),
        ...(venn.preconfiguration || {})
      };
      if (attributeMatch.hasMatch && attributeMatch.stepId && attributeMatch.value) {
        if (!preconfiguration[attributeMatch.stepId]) {
          preconfiguration[attributeMatch.stepId] = attributeMatch.value;
        }
      }

      const featureBadgesSet = new Set<string>();
      if (featureIntent.hasIntent && featureIntent.featureBadges) {
        for (const b of featureIntent.featureBadges) {
          featureBadgesSet.add(b);
        }
      }
      if (attributeMatch.hasMatch && attributeMatch.badgeLabel) {
        featureBadgesSet.add(attributeMatch.badgeLabel);
      }
      if (venn.featureBadges) {
        for (const b of venn.featureBadges) {
          featureBadgesSet.add(b);
        }
      }
      const featureBadges = Array.from(featureBadgesSet);

      const modelPreset =
        (preconfiguration as any)?.modelPreset ||
        featureIntent.preconfiguration?.modelPreset ||
        item.modelPreset ||
        modelResolution?.preset;

      const effCat = resolveEffectiveProductCategory(item);
      let finalSalesGroup = item.salesGroup;
      if (determineProductCategory(item) !== effCat) {
        if (effCat === 'vloeren') finalSalesGroup = 'Vloerbedekking';
        else if (effCat === 'gordijnen') finalSalesGroup = 'Gordijnen';
        else if (effCat === 'raamdecoratie') finalSalesGroup = 'Raamdecoratie';
      }

      return {
        ...item,
        salesGroup: finalSalesGroup,
        ...(featureBadges.length > 0 ? { featureBadges } : {}),
        ...(Object.keys(preconfiguration).length > 0 ? { preconfiguration } : {}),
        ...(modelPreset ? { modelPreset } : {})
      };
    });

    return NextResponse.json({
      success: true,
      query: cleanQuery,
      count: finalItems.length,
      items: finalItems,
      pagination: {
        page: 1,
        pageSize: 20,
        totalResults,
        totalPages,
        hasMore
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        query: '',
        count: 0,
        items: [],
        error: error.message || 'Interne serverfout bij zoeken in artikelstambestand.'
      },
      { status: error.status || 500 }
    );
  }
}
