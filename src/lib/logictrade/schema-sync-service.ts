import {
  getSyncState,
  updateSyncState,
  upsertConfiguratorSchemasBatch,
  getActiveConfiguratorSchemas,
  ConfiguratorSchemaRow,
  ConfiguratorSchemaValueItem,
} from '@/lib/supabase/client';
import { defaultRateLimiter } from '@/lib/logictrade/rate-limiter';
import {
  DynamicAttributeRegistry,
  ExternalAttributeSchema,
} from '@/domain/search/dynamic-attribute-registry';
import { ProductCategory } from '@/types/configurator';

export interface LogicTradeOptionRaw {
  id: number;
  code: string;
  name: string;
  kind?: number; // 0=None, 100=Number, 200=Text, 300=Choices, 400=Color, 410=Material, 500=Dimension
  startDate?: string | null;
  endDate?: string | null;
  webshop?: boolean;
  sortOrder?: number;
  customFields?: Record<string, unknown>;
}

export interface LogicTradeOptionValueRaw {
  id: number;
  code: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  webshop?: boolean;
  sortOrder?: number;
  customFields?: Record<string, unknown>;
}

export interface SchemaSyncResult {
  success: boolean;
  schemasSynced: number;
  totalActiveSchemas: number;
  durationMs: number;
  lastSyncedAt: string;
}

export function isEntityActive(
  entity: { startDate?: string | null; endDate?: string | null; webshop?: boolean },
  now = new Date()
): boolean {
  if (entity.webshop === false) return false;
  if (entity.startDate && new Date(entity.startDate) > now) return false;
  if (entity.endDate && new Date(entity.endDate) <= now) return false;
  return true;
}

export function resolveCanonicalStepId(opt: { id: number; code?: string; name?: string }): string {
  const raw = `${opt.code || ''} ${opt.name || ''}`.toLowerCase();
  if (raw.includes('bediening') || raw.includes('control')) return 'BEDIENINGS_TYPE';
  if (raw.includes('montage') || raw.includes('fit') || raw.includes('frame')) return 'MONTAGE_WIJZE';
  if (raw.includes('plooi') || raw.includes('wave')) return 'PLOOI_SOORT';
  if (raw.includes('legpatroon') || raw.includes('verband') || raw.includes('visgraat')) return 'LEGPATROON';
  if (raw.includes('lamel')) return 'LAMEL_BREEDTE';
  if (raw.includes('voering')) return 'VOERING_TYPE';
  if (raw.includes('ondervloer')) return 'ONDERVLOER_TYPE';

  const clean = (opt.code || opt.name || `OPTION_${opt.id}`)
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || `OPTION_${opt.id}`;
}

export function inferCategoryFromOption(
  opt: LogicTradeOptionRaw
): ProductCategory {
  const text = `${opt.code} ${opt.name}`.toLowerCase();
  if (text.includes('gordijn') || text.includes('plooi') || text.includes('wave') || text.includes('voering')) {
    return 'gordijnen';
  }
  if (text.includes('vloer') || text.includes('visgraat') || text.includes('plint') || text.includes('ondervloer')) {
    return 'vloeren';
  }
  if (
    text.includes('jaloezie') ||
    text.includes('rolgordijn') ||
    text.includes('duette') ||
    text.includes('plisse') ||
    text.includes('lamel') ||
    text.includes('bediening') ||
    text.includes('trufit')
  ) {
    return 'raamdecoratie';
  }
  return 'algemeen';
}

/**
 * Voert incrementele delta-sync uit voor LogicTrade configuratorschema's.
 */
export async function executeSchemaDeltaSync(
  options: {
    apiKey?: string;
    baseUrl?: string;
    adminGuid?: string;
    forceSince?: string;
    pageSize?: number;
  } = {}
): Promise<SchemaSyncResult> {
  const startTime = Date.now();
  const apiKey = options.apiKey || process.env.LOGICTRADE_API_KEY || 'test-api-key';
  const baseUrl = options.baseUrl || process.env.LOGICTRADE_BASE_URL || 'https://api.logictrade.cloud/rest/v1';
  const adminGuid = options.adminGuid || process.env.LOGICTRADE_ADMIN_GUID;
  const pageSize = options.pageSize || 100;

  const existingState = await getSyncState('schema_sync');
  const since = options.forceSince !== undefined
    ? options.forceSince
    : (existingState?.last_synced_at && existingState.last_synced_at !== '1970-01-01T00:00:00.000Z'
        ? existingState.last_synced_at
        : undefined);

  const headers: Record<string, string> = {
    'api-key': apiKey,
    Accept: 'application/json',
  };
  if (adminGuid) {
    headers['administration-guid'] = adminGuid;
  }

  // 1. Pagineer door /products/configurator/options
  let pageNumber = 1;
  let totalPages = 1;
  const rawOptions: LogicTradeOptionRaw[] = [];

  do {
    const optUrl = new URL(`${baseUrl}/products/configurator/options`);
    optUrl.searchParams.set('pageSize', String(pageSize));
    optUrl.searchParams.set('pageNumber', String(pageNumber));
    optUrl.searchParams.set('customFields', 'true');
    if (since) {
      optUrl.searchParams.set('modifiedAfter', since);
    }

    const res = await defaultRateLimiter.fetchWithAdaptiveBackoff(optUrl.toString(), {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`LogicTrade configurator options sync error (HTTP ${res.status}): ${errBody}`);
    }

    const data = await res.json();
    const batch: LogicTradeOptionRaw[] = data.results || [];
    rawOptions.push(...batch);
    totalPages = data.totalPages || 1;
    pageNumber++;
  } while (pageNumber <= totalPages);

  const now = new Date();
  const schemaRows: ConfiguratorSchemaRow[] = [];

  // 2. Verwerk opties en haal indien actief & discreet de keuzewaarden op
  for (const opt of rawOptions) {
    const isStepActive = isEntityActive(opt, now);
    const stepId = resolveCanonicalStepId(opt);
    const category = inferCategoryFromOption(opt);
    const kind = opt.kind !== undefined ? opt.kind : 300;

    // Alleen discrete keuzestappen (kind 300, 400, 410, 500) hebben waarden
    const isDiscrete = [300, 400, 410, 500].includes(kind);

    if (!isStepActive || !isDiscrete) {
      // Sla /values sub-call over en sla op als inactief / empty values om oude DB rijen te deactiveren
      schemaRows.push({
        option_id: opt.id,
        step_id: stepId,
        option_code: opt.code,
        label: opt.name,
        category,
        kind,
        possible_values: [],
        is_active: false,
        sort_order: opt.sortOrder || 0,
        raw_metadata: opt.customFields || {},
        synced_at: new Date().toISOString(),
      });
      continue;
    }

    // Pagineer door /products/configurator/options/{optionId}/values
    let vPage = 1;
    let vTotalPages = 1;
    const values: ConfiguratorSchemaValueItem[] = [];
    const maxValPages = 10;

    do {
      const valUrl = new URL(`${baseUrl}/products/configurator/options/${opt.id}/values`);
      valUrl.searchParams.set('pageSize', '100');
      valUrl.searchParams.set('pageNumber', String(vPage));
      valUrl.searchParams.set('customFields', 'true');

      const vRes = await defaultRateLimiter.fetchWithAdaptiveBackoff(valUrl.toString(), {
        method: 'GET',
        headers,
        cache: 'no-store',
      });

      if (!vRes.ok) {
        const vErr = await vRes.text().catch(() => '');
        throw new Error(`LogicTrade option values error for option ${opt.id} (HTTP ${vRes.status}): ${vErr}`);
      }

      const vData = await vRes.json();
      const vBatch: LogicTradeOptionValueRaw[] = vData.results || [];

      for (const val of vBatch) {
        if (isEntityActive(val, now)) {
          values.push({
            value: val.code || String(val.id),
            label: val.name || val.code,
            optionId: val.id,
            sortOrder: val.sortOrder,
          });
        }
      }

      vTotalPages = vData.totalPages || 1;
      vPage++;
    } while (vPage <= vTotalPages && vPage <= maxValPages);

    schemaRows.push({
      option_id: opt.id,
      step_id: stepId,
      option_code: opt.code,
      label: opt.name,
      category,
      kind,
      possible_values: values,
      is_active: values.length > 0,
      sort_order: opt.sortOrder || 0,
      raw_metadata: opt.customFields || {},
      synced_at: new Date().toISOString(),
    });
  }

  // 3. Batch Upsert naar Supabase
  if (schemaRows.length > 0) {
    await upsertConfiguratorSchemasBatch(schemaRows);
  }

  // 4. Update Checkpoint (Fail-closed: gooit error bij DB mislukking vóór state advance)
  const syncEndTime = new Date().toISOString();
  const currentTotal = existingState?.total_synced || 0;
  const newTotal = currentTotal + schemaRows.length;
  await updateSyncState('schema_sync', newTotal, syncEndTime);

  // 5. Hot-reload DynamicAttributeRegistry vanuit geactiveerde schema's
  const activeResult = await getActiveConfiguratorSchemas();
  let totalActive = 0;

  if (activeResult.ok) {
    totalActive = activeResult.rows.length;
    const externalSchemas: ExternalAttributeSchema[] = activeResult.rows.map((row) => ({
      category: row.category,
      stepId: row.step_id,
      label: row.label,
      values: row.possible_values,
      isActive: row.is_active,
    }));
    DynamicAttributeRegistry.ingestExternalSchemas(externalSchemas);
  }

  return {
    success: true,
    schemasSynced: schemaRows.length,
    totalActiveSchemas: totalActive,
    durationMs: Date.now() - startTime,
    lastSyncedAt: syncEndTime,
  };
}

/**
 * Koude start hydratatie van de DynamicAttributeRegistry rechtstreeks uit Supabase.
 */
export async function ensureExternalSchemasHydrated(): Promise<{
  hydrated: boolean;
  count: number;
}> {
  try {
    const activeResult = await getActiveConfiguratorSchemas();
    if (!activeResult.ok || activeResult.rows.length === 0) {
      return { hydrated: false, count: 0 };
    }

    const externalSchemas: ExternalAttributeSchema[] = activeResult.rows.map((row) => ({
      category: row.category,
      stepId: row.step_id,
      label: row.label,
      values: row.possible_values,
      isActive: row.is_active,
    }));

    DynamicAttributeRegistry.ingestExternalSchemas(externalSchemas);
    return { hydrated: true, count: activeResult.rows.length };
  } catch (err) {
    console.warn('ensureExternalSchemasHydrated warning:', err);
    return { hydrated: false, count: 0 };
  }
}
