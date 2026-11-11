/**
 * src/app/api/orders/[id]/route.ts
 *
 * Dedicated Order Detail & Orderregels Matrix Route.
 * Pure transport layer (<40 regels conform INV-GOV-21A) met Next.js 16 async context params.
 */

import { fetchOrderMatrixBundleDal } from '@/lib/supabase/order-client';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await context.params;
    if (!id || !id.trim()) {
      return Response.json({ error: 'Order ID ontbreekt' }, { status: 400 });
    }

    const bundle = await fetchOrderMatrixBundleDal(id.trim());
    if (!bundle) {
      return Response.json(
        { error: 'Order niet gevonden', id },
        { status: 404 }
      );
    }

    return Response.json(bundle, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Fout in GET /api/orders/[id]:', error);
    return Response.json(
      { error: 'Interne fout bij het ophalen van orderdetail' },
      { status: 500 }
    );
  }
}
