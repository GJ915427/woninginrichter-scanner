/**
 * Greenfield Cognitive CPQ Search Engine BFF API Route (V2).
 * 
 * GET /api/v2/products/search?q=<query>&limit=<limit>
 * 
 * Voldoet aan:
 * - Fail-soft resilience (HTTP 200 met provider: 'none' en results: [] bij lege zoekterm)
 * - Safe URL parsing via new URL(request.url, 'http://localhost:3000') voor NextRequest én standaard Request
 * - Parameter sanitization en clamping (limit default 20, min 1, max 50)
 * - SupabaseCatalogProvider integratie met transparante provider rapportage ('supabase' | 'seed_fallback' | 'none')
 * - Strikte HTTP 500 afhandeling bij onverwachte runtime excepties
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchGreenfield } from '@/domain/search/v2/search-engine';
import { SupabaseCatalogProvider } from '@/domain/search/v2/supabase-catalog-provider';
import { resolveQueryIntent } from '@/domain/search/v2/query-intent-resolver';
import { DiscretizedResultRow } from '@/domain/search/v2/knowledge-graph-binder';

export interface V2SearchResponse {
  results: DiscretizedResultRow[];
  total: number;
  provider: 'supabase' | 'seed_fallback' | 'none';
  query: string;
  error?: string;
}

export async function GET(request: Request | NextRequest): Promise<NextResponse<V2SearchResponse>> {
  try {
    const url = new URL(request.url, 'http://localhost:3000');
    const rawQuery = url.searchParams.get('q') || '';
    const rawLimit = url.searchParams.get('limit');
    const limit = Math.min(Math.max(1, parseInt(rawLimit || '20', 10) || 20), 50);

    const intent = resolveQueryIntent(rawQuery);
    if (intent.isEmpty) {
      return NextResponse.json({
        results: [],
        total: 0,
        provider: 'none',
        query: ''
      }, { status: 200 });
    }

    const provider = new SupabaseCatalogProvider({
      query: rawQuery,
      candidateLimit: 50
    });

    const allDiscretizedRows = await searchGreenfield(rawQuery, provider);
    const results = allDiscretizedRows.slice(0, limit);

    return NextResponse.json({
      results,
      total: allDiscretizedRows.length,
      provider: provider.getProviderMode(),
      query: rawQuery
    }, { status: 200 });
  } catch (error: any) {
    console.warn('[V2 Products Search] Fout bij uitvoeren van Greenfield zoekopdracht:', error);
    return NextResponse.json({
      results: [],
      total: 0,
      provider: 'none',
      query: '',
      error: error?.message || 'Interne serverfout bij uitvoeren van Greenfield zoekopdracht.'
    }, { status: 500 });
  }
}
