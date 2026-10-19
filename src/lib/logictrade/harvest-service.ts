import { defaultRateLimiter, RateLimiter } from './rate-limiter';
import { syncProductsBatch } from './sync-service';
import { getSyncState, updateSyncState } from '@/lib/supabase/client';
import { LogicTradeProductRaw, LogicTradeResponseEnvelope } from '@/types/product';

export interface HarvestOptions {
  fromPage?: number;
  toPage?: number;
  limitPages?: number;
  pageSize?: number;
  apiKey?: string;
  baseUrl?: string;
  adminGuid?: string;
  resume?: boolean;
  rateLimiter?: RateLimiter;
  onProgress?: (info: {
    currentPage: number;
    totalPages: number;
    batchCount: number;
    cumulativeSynced: number;
  }) => void;
}

export interface HarvestResult {
  totalPagesProcessed: number;
  totalProductsSynced: number;
  lastPage: number;
  isComplete: boolean;
}

const CHECKPOINT_KEY = 'catalog_harvest_checkpoint';

export async function getHarvestCheckpoint(): Promise<{
  lastPage: number;
  totalSynced: number;
  lastSyncedAt: string | null;
}> {
  const state = await getSyncState(CHECKPOINT_KEY);
  if (!state) {
    return { lastPage: 0, totalSynced: 0, lastSyncedAt: null };
  }
  return {
    lastPage: state.total_synced || 0, // In checkpoint bewaren we last_imported_page in total_synced
    totalSynced: 0,
    lastSyncedAt: state.last_synced_at
  };
}

export async function saveHarvestCheckpoint(
  page: number,
  totalSyncedCumulative: number
): Promise<void> {
  await updateSyncState(CHECKPOINT_KEY, page, new Date().toISOString());
  // Werk ook de algemene catalog_sync state bij
  await updateSyncState('catalog_sync', totalSyncedCumulative, new Date().toISOString());
}

export async function harvestCatalogRange(options: HarvestOptions = {}): Promise<HarvestResult> {
  const apiKey = options.apiKey || process.env.LOGICTRADE_API_KEY || '621dcae6617349d0896d3ca9ba96d4b6';
  const baseUrl = (options.baseUrl || process.env.LOGICTRADE_BASE_URL || 'https://api.logictrade.cloud/rest/v1').replace(/\/+$/, '');
  const adminGuid = options.adminGuid || process.env.LOGICTRADE_ADMIN_GUID;
  const pageSize = options.pageSize || 100;
  const limiter = options.rateLimiter || defaultRateLimiter;

  let startPage = options.fromPage || 1;
  let cumulativeSynced = 0;

  if (options.resume) {
    const checkpoint = await getHarvestCheckpoint();
    if (checkpoint.lastPage > 0) {
      startPage = checkpoint.lastPage + 1;
      console.log(`[Harvester] Hervat vanaf checkpoint pagina ${startPage}...`);
    }
  }

  // 1. Eerste call om totale aantal pagina's te bepalen
  const firstUrl = `${baseUrl}/products?pageSize=${pageSize}&pageNumber=${startPage}`;
  const headers: Record<string, string> = {
    'api-key': apiKey,
    Accept: 'application/json'
  };
  if (adminGuid) {
    headers['administration-guid'] = adminGuid;
  }

  const firstRes = await limiter.fetchWithAdaptiveBackoff(firstUrl, { headers, cache: 'no-store' });
  if (!firstRes.ok) {
    throw new Error(`LogicTrade initial page fetch failed with HTTP ${firstRes.status}: ${await firstRes.text()}`);
  }

  const firstEnvelope = (await firstRes.json()) as LogicTradeResponseEnvelope;
  const totalPagesInBackend = firstEnvelope.pagination?.totalPages || 1;
  const maxTargetPage = options.toPage ? Math.min(options.toPage, totalPagesInBackend) : totalPagesInBackend;
  const pagesToProcess = options.limitPages ? Math.min(maxTargetPage - startPage + 1, options.limitPages) : (maxTargetPage - startPage + 1);

  // Verwerk de eerste pagina die we al opgehaald hebben
  let currentPage = startPage;
  let totalProcessed = 0;

  if (firstEnvelope.results && firstEnvelope.results.length > 0) {
    const synced = await syncProductsBatch(firstEnvelope.results);
    cumulativeSynced += synced;
    totalProcessed++;
    await saveHarvestCheckpoint(currentPage, cumulativeSynced);

    if (options.onProgress) {
      options.onProgress({
        currentPage,
        totalPages: maxTargetPage,
        batchCount: synced,
        cumulativeSynced
      });
    }
  }

  currentPage++;

  // 2. Loop door de resterende pagina's
  while (totalProcessed < pagesToProcess && currentPage <= maxTargetPage) {
    const pageUrl = `${baseUrl}/products?pageSize=${pageSize}&pageNumber=${currentPage}`;
    const pageRes = await limiter.fetchWithAdaptiveBackoff(pageUrl, { headers, cache: 'no-store' });

    if (!pageRes.ok) {
      console.error(`[Harvester] Pagina ${currentPage} fout (HTTP ${pageRes.status}). Checkpoint bewaard op ${currentPage - 1}.`);
      break;
    }

    const envelope = (await pageRes.json()) as LogicTradeResponseEnvelope;
    const products: LogicTradeProductRaw[] = envelope.results || [];

    if (products.length === 0) {
      console.log(`[Harvester] Geen verdere artikelen gevonden op pagina ${currentPage}. Einde bereikt.`);
      break;
    }

    const synced = await syncProductsBatch(products);
    cumulativeSynced += synced;
    totalProcessed++;

    await saveHarvestCheckpoint(currentPage, cumulativeSynced);

    if (options.onProgress) {
      options.onProgress({
        currentPage,
        totalPages: maxTargetPage,
        batchCount: synced,
        cumulativeSynced
      });
    }

    currentPage++;
  }

  const isComplete = (currentPage - 1) >= totalPagesInBackend;

  return {
    totalPagesProcessed: totalProcessed,
    totalProductsSynced: cumulativeSynced,
    lastPage: currentPage - 1,
    isComplete
  };
}
