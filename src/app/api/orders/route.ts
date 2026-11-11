/**
 * src/app/api/orders/route.ts
 *
 * Server-Centric Orders & Offertes Catalogus API Route.
 * Pure transport layer (<50 regels conform INV-GOV-21A) die delegeert aan DAL.
 */

import { fetchOrderSummariesDal } from '@/lib/supabase/order-client';

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || undefined;
    const rawType = url.searchParams.get('type');
    const type = rawType === 'orders' || rawType === 'quotes' ? rawType : 'all';

    const limitParam = parseInt(url.searchParams.get('limit') || '50', 10);
    const offsetParam = parseInt(url.searchParams.get('offset') || '0', 10);

    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(1, limitParam), 100) : 50;
    const offset = Number.isFinite(offsetParam) ? Math.max(0, offsetParam) : 0;

    const data = await fetchOrderSummariesDal({
      q,
      type,
      limit,
      offset,
    });

    return Response.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Fout in GET /api/orders:', error);
    return Response.json(
      { error: 'Interne fout bij het ophalen van orders' },
      { status: 500 }
    );
  }
}
