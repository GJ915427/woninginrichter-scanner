import { NextResponse } from 'next/server';
import { getSyncState } from '@/lib/supabase/client';
import { executeDeltaSync } from '@/lib/logictrade/sync-service';
import { getHarvestCheckpoint } from '@/lib/logictrade/harvest-service';
import { executeSchemaDeltaSync } from '@/lib/logictrade/schema-sync-service';
import { DynamicAttributeRegistry } from '@/domain/search/dynamic-attribute-registry';

export async function GET(): Promise<NextResponse> {
  try {
    const catalogSync = await getSyncState('catalog_sync');
    const checkpoint = await getHarvestCheckpoint();
    const schemaSync = await getSyncState('schema_sync').catch(() => null);

    return NextResponse.json({
      success: true,
      data: {
        // 100% backward-compatible top-level velden
        totalSynced: catalogSync?.total_synced || 0,
        lastSyncedAt: catalogSync?.last_synced_at || null,
        checkpointPage: checkpoint.lastPage,
        updatedAt: catalogSync?.updated_at || null,
        // Additieve uitsplitsing
        catalogSync: {
          totalSynced: catalogSync?.total_synced || 0,
          lastSyncedAt: catalogSync?.last_synced_at || null,
          checkpointPage: checkpoint.lastPage,
          updatedAt: catalogSync?.updated_at || null,
        },
        schemaSync: {
          totalSynced: schemaSync?.total_synced || 0,
          lastSyncedAt: schemaSync?.last_synced_at || null,
          updatedAt: schemaSync?.updated_at || null,
        },
        attributeGraph: {
          totalOptionsIndexed: DynamicAttributeRegistry.getAllIndexedOptions().length,
          externalStepsMerged: DynamicAttributeRegistry.getExternalStepsCount(),
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Fout bij ophalen sync status.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}));
    const syncType = (body.syncType as 'all' | 'catalog' | 'schemas') || 'catalog';
    const forceSince = body.forceSince as string | undefined;
    const pageSize = body.pageSize as number | undefined;

    let catalogResult: { syncedCount: number; lastSyncedAt: string } | null = null;
    let schemaResult: any = null;

    if (syncType === 'all' || syncType === 'catalog') {
      catalogResult = await executeDeltaSync({ forceSince, pageSize });
    }

    if (syncType === 'all' || syncType === 'schemas') {
      schemaResult = await executeSchemaDeltaSync({ forceSince, pageSize });
    }

    const totalSyncedCount = (catalogResult?.syncedCount || 0) + (schemaResult?.schemasSynced || 0);

    return NextResponse.json({
      success: true,
      message: `Synchronisatie (${syncType}) succesvol uitgevoerd.`,
      data: {
        // 100% backward-compatible top-level velden
        syncedCount: totalSyncedCount,
        lastSyncedAt: schemaResult?.lastSyncedAt || catalogResult?.lastSyncedAt || new Date().toISOString(),
        catalogSync: catalogResult,
        schemaSync: schemaResult,
        attributeGraph: {
          totalOptionsIndexed: DynamicAttributeRegistry.getAllIndexedOptions().length,
          externalStepsMerged: DynamicAttributeRegistry.getExternalStepsCount(),
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Fout tijdens delta-sync.' },
      { status: 500 }
    );
  }
}
