import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeSchemaDeltaSync,
  ensureExternalSchemasHydrated,
  resolveCanonicalStepId,
  isEntityActive,
} from '@/lib/logictrade/schema-sync-service';
import { DynamicAttributeRegistry } from '@/domain/search/dynamic-attribute-registry';
import * as supabaseClient from '@/lib/supabase/client';
import { defaultRateLimiter } from '@/lib/logictrade/rate-limiter';
import { GET as getAdminSync, POST as postAdminSync } from '@/app/api/admin/sync/route';
import * as syncService from '@/lib/logictrade/sync-service';

describe('LogicTrade Schema Delta-Sync Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    DynamicAttributeRegistry.resetToBaseline();
  });

  describe('resolveCanonicalStepId', () => {
    it('maps bediening / control to BEDIENINGS_TYPE', () => {
      expect(resolveCanonicalStepId({ id: 1, code: 'BEDIENING_OPT', name: 'Bediening' })).toBe('BEDIENINGS_TYPE');
      expect(resolveCanonicalStepId({ id: 2, code: 'CTRL', name: 'Control type' })).toBe('BEDIENINGS_TYPE');
    });

    it('maps montage / fit / frame to MONTAGE_WIJZE', () => {
      expect(resolveCanonicalStepId({ id: 3, code: 'MOUNT', name: 'Montage wijze' })).toBe('MONTAGE_WIJZE');
      expect(resolveCanonicalStepId({ id: 4, code: 'FIT_FRAME', name: 'TruFit Frame' })).toBe('MONTAGE_WIJZE');
    });

    it('maps plooi / wave to PLOOI_SOORT', () => {
      expect(resolveCanonicalStepId({ id: 5, code: 'PLEAT', name: 'Plooivariant' })).toBe('PLOOI_SOORT');
      expect(resolveCanonicalStepId({ id: 6, code: 'WAVE', name: 'Waveplooi' })).toBe('PLOOI_SOORT');
    });

    it('maps legpatroon / verband / visgraat to LEGPATROON', () => {
      expect(resolveCanonicalStepId({ id: 7, code: 'PATTERN', name: 'Legpatroon' })).toBe('LEGPATROON');
      expect(resolveCanonicalStepId({ id: 8, code: 'HERRINGBONE', name: 'Visgraat verband' })).toBe('LEGPATROON');
    });

    it('falls back to normalized uppercase identifier', () => {
      expect(resolveCanonicalStepId({ id: 9, code: 'CUSTOM_STEP', name: 'Aangepaste Stap' })).toBe('CUSTOM_STEP');
    });
  });

  describe('isEntityActive', () => {
    it('returns true when no endDate is set and webshop is not false', () => {
      expect(isEntityActive({ id: 1, name: 'Active', webshop: true })).toBe(true);
      expect(isEntityActive({ id: 2, name: 'Active default' })).toBe(true);
    });

    it('returns false when webshop is explicitly false', () => {
      expect(isEntityActive({ id: 3, name: 'Inactive', webshop: false })).toBe(false);
    });

    it('returns false when endDate is in the past', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      expect(isEntityActive({ id: 4, name: 'Expired', endDate: pastDate })).toBe(false);
    });

    it('returns true when endDate is in the future', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      expect(isEntityActive({ id: 5, name: 'Future', endDate: futureDate })).toBe(true);
    });
  });

  describe('executeSchemaDeltaSync', () => {
    it('fetches options with modifiedAfter and upserts active discrete options with values', async () => {
      const mockFetch = vi.spyOn(defaultRateLimiter, 'fetchWithAdaptiveBackoff');

      // 1. Mock GET /options
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              {
                id: 901,
                code: 'BEDIENING_SMART',
                name: 'Slimme Bediening',
                kind: 300,
                webshop: true,
                sortOrder: 1,
              },
            ],
            totalCount: 1,
            totalPages: 1,
          }),
          { status: 200 }
        )
      );

      // 2. Mock GET /options/901/values
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              {
                id: 9001,
                code: 'MATTER_MOTOR',
                name: 'Matter Smart Home',
                webshop: true,
                sortOrder: 1,
              },
            ],
            totalCount: 1,
            totalPages: 1,
          }),
          { status: 200 }
        )
      );

      const upsertSpy = vi.spyOn(supabaseClient, 'upsertConfiguratorSchemasBatch').mockResolvedValue({ upserted: 1 });
      vi.spyOn(supabaseClient, 'getActiveConfiguratorSchemas').mockResolvedValueOnce({
        ok: true,
        rows: [
          {
            option_id: 901,
            step_id: 'BEDIENINGS_TYPE',
            option_code: 'BEDIENING_SMART',
            label: 'Slimme Bediening',
            category: 'raamdecoratie',
            kind: 300,
            possible_values: [
              { value: 'MATTER_MOTOR', label: 'Matter Smart Home' },
            ],
            is_active: true,
            sort_order: 1,
            synced_at: new Date().toISOString(),
          },
        ],
      });

      const updateSyncStateSpy = vi.spyOn(supabaseClient, 'updateSyncState').mockResolvedValue();

      const result = await executeSchemaDeltaSync({ forceSince: '2026-01-01T00:00:00Z' });

      expect(result.success).toBe(true);
      expect(result.schemasSynced).toBe(1);
      expect(upsertSpy).toHaveBeenCalled();
      expect(updateSyncStateSpy).toHaveBeenCalledWith('schema_sync', expect.any(Number), expect.any(String));

      // Verify hot-reload in DynamicAttributeRegistry
      const resolution = DynamicAttributeRegistry.resolveIntent('matter', 'raamdecoratie');
      expect(resolution.hasMatch).toBe(true);
      expect(resolution.stepId).toBe('BEDIENINGS_TYPE');
      expect(resolution.value).toBe('MATTER_MOTOR');
    });

    it('skips /values fetching for non-discrete steps (kind 0, 100, 200) and expired steps', async () => {
      const mockFetch = vi.spyOn(defaultRateLimiter, 'fetchWithAdaptiveBackoff');

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              {
                id: 102,
                code: 'VRIJE_BREEDTE',
                name: 'Breedte in mm',
                kind: 100, // Number, not discrete
                webshop: true,
              },
              {
                id: 103,
                code: 'VERLOPEN_OPTIE',
                name: 'Oude optie',
                kind: 300,
                webshop: false, // inactive
              },
            ],
            totalCount: 2,
            totalPages: 1,
          }),
          { status: 200 }
        )
      );

      const upsertSpy = vi.spyOn(supabaseClient, 'upsertConfiguratorSchemasBatch').mockResolvedValue({ upserted: 2 });
      vi.spyOn(supabaseClient, 'getActiveConfiguratorSchemas').mockResolvedValueOnce({
        ok: true,
        rows: [],
      });
      vi.spyOn(supabaseClient, 'updateSyncState').mockResolvedValue();

      await executeSchemaDeltaSync();

      // Only 1 fetch was made (for /options); zero fetches for /values!
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify both were upserted with is_active: false and possible_values: []
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ option_id: 102, is_active: false, possible_values: [] }),
          expect.objectContaining({ option_id: 103, is_active: false, possible_values: [] }),
        ])
      );
    });

    it('preserves existing in-memory graph when getActiveConfiguratorSchemas encounters DB timeout (ok: false)', async () => {
      const mockFetch = vi.spyOn(defaultRateLimiter, 'fetchWithAdaptiveBackoff');

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [],
            totalCount: 0,
            totalPages: 1,
          }),
          { status: 200 }
        )
      );

      vi.spyOn(supabaseClient, 'upsertConfiguratorSchemasBatch').mockResolvedValue({ upserted: 0 });
      vi.spyOn(supabaseClient, 'updateSyncState').mockResolvedValue();

      // Simulate DB read timeout
      vi.spyOn(supabaseClient, 'getActiveConfiguratorSchemas').mockResolvedValueOnce({
        ok: false,
        rows: [],
      });

      const initialCount = DynamicAttributeRegistry.getAllIndexedOptions().length;
      expect(initialCount).toBeGreaterThan(0);

      await executeSchemaDeltaSync();

      // The graph must NOT be wiped
      expect(DynamicAttributeRegistry.getAllIndexedOptions().length).toBe(initialCount);
    });

    it('does not advance checkpoint when Supabase updateSyncState fails', async () => {
      const mockFetch = vi.spyOn(defaultRateLimiter, 'fetchWithAdaptiveBackoff');

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              {
                id: 105,
                code: 'OPT',
                name: 'Optie',
                kind: 300,
                webshop: true,
              },
            ],
            totalCount: 1,
            totalPages: 1,
          }),
          { status: 200 }
        )
      );

      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [{ id: 1, code: 'VAL', name: 'Val', webshop: true }],
            totalCount: 1,
            totalPages: 1,
          }),
          { status: 200 }
        )
      );

      vi.spyOn(supabaseClient, 'upsertConfiguratorSchemasBatch').mockResolvedValueOnce({ upserted: 1 });
      vi.spyOn(supabaseClient, 'updateSyncState').mockRejectedValueOnce(new Error('Supabase 500 Network error'));

      await expect(executeSchemaDeltaSync()).rejects.toThrow('Supabase 500 Network error');
    });
  });

  describe('ensureExternalSchemasHydrated', () => {
    it('hydrates DynamicAttributeRegistry from Supabase on cold start', async () => {
      vi.spyOn(supabaseClient, 'getActiveConfiguratorSchemas').mockResolvedValueOnce({
        ok: true,
        rows: [
          {
            option_id: 888,
            step_id: 'BEDIENINGS_TYPE',
            option_code: 'SOLAR_MOTOR',
            label: 'Solar Motorisering',
            category: 'raamdecoratie',
            kind: 300,
            possible_values: [
              { value: 'SOLAR_WIRELESS', label: 'Solar Draadloos' },
            ],
            is_active: true,
            sort_order: 1,
            synced_at: new Date().toISOString(),
          },
        ],
      });

      const result = await ensureExternalSchemasHydrated();
      expect(result.hydrated).toBe(true);

      const search = DynamicAttributeRegistry.resolveIntent('solar', 'raamdecoratie');
      expect(search.hasMatch).toBe(true);
      expect(search.value).toBe('SOLAR_WIRELESS');
    });
  });

  describe('/api/admin/sync Backward Compatibility & Schema Support', () => {
    it('GET /api/admin/sync returns backward-compatible fields and additive schemaSync/attributeGraph', async () => {
      vi.spyOn(supabaseClient, 'getSyncState').mockImplementation(async (key: string) => {
        if (key === 'catalog_sync') {
          return { key: 'catalog_sync', total_synced: 120, last_synced_at: '2026-10-10T12:00:00Z', updated_at: '2026-10-10T12:00:00Z' } as any;
        }
        return { key: 'schema_sync', total_synced: 45, last_synced_at: '2026-10-11T14:00:00Z', updated_at: '2026-10-11T14:00:00Z' } as any;
      });

      const response = await getAdminSync();
      const body = await response.json();

      expect(body.success).toBe(true);
      // Backward-compatible top-level fields under data
      expect(body.data.totalSynced).toBe(120);
      expect(body.data.lastSyncedAt).toBe('2026-10-10T12:00:00Z');
      expect(body.data.checkpointPage).toBeDefined();

      // Additive fields
      expect(body.data.catalogSync.totalSynced).toBe(120);
      expect(body.data.schemaSync.totalSynced).toBe(45);
      expect(body.data.attributeGraph.totalOptionsIndexed).toBeGreaterThan(0);
    });

    it('POST /api/admin/sync with syncType "schemas" synchronizes schemas and returns backward-compatible payload', async () => {
      vi.spyOn(supabaseClient, 'getSyncState').mockResolvedValue({
        key: 'schema_sync',
        total_synced: 10,
        last_synced_at: '2026-01-01T00:00:00Z',
      } as any);

      const mockFetch = vi.spyOn(defaultRateLimiter, 'fetchWithAdaptiveBackoff');
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [],
            totalCount: 0,
            totalPages: 1,
          }),
          { status: 200 }
        )
      );

      vi.spyOn(supabaseClient, 'upsertConfiguratorSchemasBatch').mockResolvedValue({ upserted: 0 });
      vi.spyOn(supabaseClient, 'updateSyncState').mockResolvedValue();
      vi.spyOn(supabaseClient, 'getActiveConfiguratorSchemas').mockResolvedValue({ ok: true, rows: [] });

      const request = new Request('http://localhost:3000/api/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType: 'schemas' }),
      });

      const response = await postAdminSync(request);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.data.syncedCount).toBe(0);
      expect(body.data.schemaSync).toBeDefined();
      expect(body.data.schemaSync.success).toBe(true);
      expect(body.data.attributeGraph).toBeDefined();
    });
  });
});
