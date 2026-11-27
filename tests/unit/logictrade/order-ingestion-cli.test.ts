// [SPEC-CHANGE-AUTHORIZED: Step 4 Completion - Order Intake Batch Ingestion CLI Unit Tests & Contract Verification]
import { describe, it, expect, vi } from 'vitest';
import {
  BOOLEAN_FLAGS,
  VALUE_FLAGS,
  ALL_FLAGS,
  parseIngestionCliArgs,
  assertSafeSupabaseTarget,
  validateIngestionEnvironment,
  buildPostgrestQueryString,
  chunkArray,
  isIngestionCliEntrypoint,
  formatCliUsageHelp,
  runLogicTradeApiHarvest,
} from '../../../scripts/run-order-ingestion';
import * as harvestModule from '../../../src/lib/logictrade/harvest-2yr-orders';
import { ingestOrderTransaction } from '../../../src/lib/supabase/order-client';
import type { IngestedOrderBundle } from '../../../src/types/order-intake';

describe('Order Ingestion CLI & Core Contract Guards', () => {
  describe('Closed Flag Whitelist Sets', () => {
    it('definieert de exacte closed sets voor boolean en value vlaggen', () => {
      expect(BOOLEAN_FLAGS.has('--from-db')).toBe(true);
      expect(BOOLEAN_FLAGS.has('--with-configuration')).toBe(true);
      expect(BOOLEAN_FLAGS.has('--force')).toBe(true);
      expect(BOOLEAN_FLAGS.has('--only-pending')).toBe(true);
      expect(BOOLEAN_FLAGS.has('--full')).toBe(true);
      expect(BOOLEAN_FLAGS.has('--help')).toBe(true);
      expect(BOOLEAN_FLAGS.has('-h')).toBe(true);
      expect(BOOLEAN_FLAGS.size).toBe(7);

      expect(VALUE_FLAGS.has('--delta-since')).toBe(true);
      expect(VALUE_FLAGS.has('--order-ids')).toBe(true);
      expect(VALUE_FLAGS.has('--type')).toBe(true);
      expect(VALUE_FLAGS.has('--years')).toBe(true);
      expect(VALUE_FLAGS.has('--year')).toBe(true);
      expect(VALUE_FLAGS.has('--start-after')).toBe(true);
      expect(VALUE_FLAGS.has('--batch-size')).toBe(true);
      expect(VALUE_FLAGS.has('--concurrency')).toBe(true);
      expect(VALUE_FLAGS.has('--max')).toBe(true);
      expect(VALUE_FLAGS.has('--cutoff-date')).toBe(true);
      expect(VALUE_FLAGS.has('--origin')).toBe(true);
      expect(VALUE_FLAGS.size).toBe(11);

      expect(ALL_FLAGS.size).toBe(18);
    });
  });

  describe('parseIngestionCliArgs - Lexer, Short-Circuit & Syntaxis', () => {
    it('short-circuits direct op --help en -h met isHelp: true', () => {
      expect(parseIngestionCliArgs(['--help']).isHelp).toBe(true);
      expect(parseIngestionCliArgs(['-h']).isHelp).toBe(true);
      // Zelfs bij aanwezigheid van ongeldige vlaggen short-circuiten help vlaggen
      expect(parseIngestionCliArgs(['--help', '--onbekend']).isHelp).toBe(true);
    });

    it('faalt closed op onbekende vlaggen [CLI-ARG-01]', () => {
      expect(() => parseIngestionCliArgs(['--fromdb'])).toThrow(/\[CLI-ARG-01\] Onbekende vlag: '--fromdb'/);
      expect(() => parseIngestionCliArgs(['--dryrun'])).toThrow(/\[CLI-ARG-01\] Onbekende vlag: '--dryrun'/);
    });

    it('faalt closed op onverwachte positionele argumenten [CLI-ARG-02]', () => {
      expect(() => parseIngestionCliArgs(['random_arg'])).toThrow(/\[CLI-ARG-02\] Onverwacht positioneel argument: 'random_arg'/);
      expect(() => parseIngestionCliArgs(['--from-db', 'extra'])).toThrow(/\[CLI-ARG-02\] Onverwacht positioneel argument: 'extra'/);
    });

    it('faalt closed wanneer een boolean vlag met =value wordt aangeroepen', () => {
      expect(() => parseIngestionCliArgs(['--from-db=true'])).toThrow(/\[CLI-ARG-01\]/);
      expect(() => parseIngestionCliArgs(['--force=1'])).toThrow(/\[CLI-ARG-01\]/);
    });

    it('consumeert het volgende argument als waarde bij --flag value en markeert dit niet als positional', () => {
      const opts = parseIngestionCliArgs(['--year', '2026', '--from-db']);
      expect(opts.year).toBe('2026');
      expect(opts.isFromDb).toBe(true);
    });

    it('faalt closed bij ontbrekende waarden of lege strings [CLI-ARG-03]', () => {
      expect(() => parseIngestionCliArgs(['--year'])).toThrow(/\[CLI-ARG-03\]/);
      expect(() => parseIngestionCliArgs(['--year', '--from-db'])).toThrow(/\[CLI-ARG-03\]/);
      expect(() => parseIngestionCliArgs(['--year='])).toThrow(/\[CLI-ARG-03\]/);
      expect(() => parseIngestionCliArgs(['--year', ''])).toThrow(/\[CLI-ARG-03\]/);
    });

    it('parseert --order-ids naar getrimde array of faalt bij 0 geldige IDs [CLI-ARG-04]', () => {
      const opts = parseIngestionCliArgs(['--from-db', '--order-ids', 'id1, id2 , id3']);
      expect(opts.orderIds).toEqual(['id1', 'id2', 'id3']);

      expect(() => parseIngestionCliArgs(['--from-db', '--order-ids', ' ,  , '])).toThrow(/\[CLI-ARG-04\]/);
    });
  });

  describe('parseIngestionCliArgs - Numerieke & ISO Domein-Validatie', () => {
    it('valideert --max, --batch-size en --concurrency op strikt positief geheel getal [CLI-ARG-08]', () => {
      expect(() => parseIngestionCliArgs(['--max', '0'])).toThrow(/\[CLI-ARG-08\]/);
      expect(() => parseIngestionCliArgs(['--max', '-5'])).toThrow(/\[CLI-ARG-08\]/);
      expect(() => parseIngestionCliArgs(['--max', 'abc'])).toThrow(/\[CLI-ARG-08\]/);
      expect(() => parseIngestionCliArgs(['--max', '1.5'])).toThrow(/\[CLI-ARG-08\]/);

      expect(() => parseIngestionCliArgs(['--batch-size', '0'])).toThrow(/\[CLI-ARG-08\]/);
      expect(() => parseIngestionCliArgs(['--concurrency', '-1'])).toThrow(/\[CLI-ARG-08\]/);

      const valid = parseIngestionCliArgs(['--max', '50', '--batch-size', '100', '--concurrency', '10']);
      expect(valid.maxCount).toBe(50);
      expect(valid.batchSize).toBe(100);
      expect(valid.concurrency).toBe(10);
    });

    it('valideert --years op eindig strikt positief getal [CLI-ARG-09]', () => {
      expect(() => parseIngestionCliArgs(['--years', '0'])).toThrow(/\[CLI-ARG-09\]/);
      expect(() => parseIngestionCliArgs(['--years', '-2'])).toThrow(/\[CLI-ARG-09\]/);
      expect(() => parseIngestionCliArgs(['--years', 'NaN'])).toThrow(/\[CLI-ARG-09\]/);

      const valid = parseIngestionCliArgs(['--years', '2.5']);
      expect(valid.years).toBe(2.5);
    });

    it('valideert --year op 4-cijferig jaartal tussen 2000 en 2100 [CLI-ARG-10]', () => {
      expect(() => parseIngestionCliArgs(['--from-db', '--year', '1999'])).toThrow(/\[CLI-ARG-10\]/);
      expect(() => parseIngestionCliArgs(['--from-db', '--year', '2101'])).toThrow(/\[CLI-ARG-10\]/);
      expect(() => parseIngestionCliArgs(['--from-db', '--year', '26'])).toThrow(/\[CLI-ARG-10\]/);

      const valid = parseIngestionCliArgs(['--from-db', '--year', '2026']);
      expect(valid.year).toBe('2026');
    });

    it('valideert --delta-since en --cutoff-date op geldige ISO datum [CLI-ARG-11]', () => {
      expect(() => parseIngestionCliArgs(['--delta-since', 'invalid-date'])).toThrow(/\[CLI-ARG-11\]/);
      expect(() => parseIngestionCliArgs(['--delta-since', '2026-13-45'])).toThrow(/\[CLI-ARG-11\]/);

      expect(() => parseIngestionCliArgs(['--from-db', '--only-pending', '--cutoff-date', 'not-a-date'])).toThrow(/\[CLI-ARG-11\]/);

      const valid = parseIngestionCliArgs(['--delta-since', '2026-11-21']);
      expect(valid.deltaSince).toBe('2026-11-21');
    });

    it('valideert --type onvoorwaardelijk tegen de enum [CLI-ARG-12]', () => {
      expect(() => parseIngestionCliArgs(['--type', 'invalid'])).toThrow(/\[CLI-ARG-12\]/);
      expect(() => parseIngestionCliArgs(['--from-db', '--delta-since', '2026-11-21', '--type', 'facturen'])).toThrow(/\[CLI-ARG-12\]/);

      expect(parseIngestionCliArgs(['--type', 'orders']).type).toBe('orders');
      expect(parseIngestionCliArgs(['--type', 'quotes']).type).toBe('quotes');
      expect(parseIngestionCliArgs(['--type', 'all']).type).toBe('all');
    });
  });

  describe('parseIngestionCliArgs - Symmetrische Conflictmatrix', () => {
    it('weigert --with-configuration i.c.m. --start-after [CLI-ARG-05]', () => {
      expect(() => parseIngestionCliArgs(['--from-db', '--with-configuration', '--start-after', 'uuid-123'])).toThrow(
        /\[CLI-ARG-05\]/
      );
    });

    it('weigert --order-ids i.c.m. --with-configuration of --start-after', () => {
      expect(() => parseIngestionCliArgs(['--from-db', '--order-ids', 'uuid-1', '--with-configuration'])).toThrow();
      expect(() => parseIngestionCliArgs(['--from-db', '--order-ids', 'uuid-1', '--start-after', 'uuid-0'])).toThrow();
    });

    it('weigert --type bij een zuivere --from-db run zonder --delta-since [CLI-ARG-06]', () => {
      expect(() => parseIngestionCliArgs(['--from-db', '--type', 'orders'])).toThrow(/\[CLI-ARG-06\]/);
      // Wél toegestaan wanneer --delta-since aanwezig is
      const combined = parseIngestionCliArgs(['--from-db', '--delta-since', '2026-11-21', '--type', 'orders']);
      expect(combined.type).toBe('orders');
      expect(combined.isFromDb).toBe(true);
    });

    it('weigert --origin bij een zuivere --from-db run zonder --delta-since [CLI-ARG-07]', () => {
      expect(() => parseIngestionCliArgs(['--from-db', '--origin', 'Winkel GSW BV'])).toThrow(/\[CLI-ARG-07\]/);
      // Wél toegestaan wanneer --delta-since aanwezig is
      const combined = parseIngestionCliArgs(['--from-db', '--delta-since', '2026-11-21', '--origin', 'Winkel GSW BV']);
      expect(combined.origin).toBe('Winkel GSW BV');
      expect(combined.isFromDb).toBe(true);
    });

    it('dwingt af dat --cutoff-date zowel --from-db als --only-pending vereist [CLI-ARG-13]', () => {
      expect(() => parseIngestionCliArgs(['--cutoff-date', '2026-11-25'])).toThrow(/\[CLI-ARG-13\]/);
      expect(() => parseIngestionCliArgs(['--from-db', '--cutoff-date', '2026-11-25'])).toThrow(/\[CLI-ARG-13\]/);
      expect(() => parseIngestionCliArgs(['--only-pending', '--cutoff-date', '2026-11-25'])).toThrow(/\[CLI-ARG-13\]/);

      const valid = parseIngestionCliArgs(['--from-db', '--only-pending', '--cutoff-date', '2026-11-25']);
      expect(valid.cutoffDate).toBe('2026-11-25');
    });

    it('verbiedt historische API-vlaggen --years en --full i.c.m. --delta-since of --from-db [CLI-ARG-14]', () => {
      expect(() => parseIngestionCliArgs(['--years', '2', '--delta-since', '2026-11-21'])).toThrow(/\[CLI-ARG-14\]/);
      expect(() => parseIngestionCliArgs(['--full', '--delta-since', '2026-11-21'])).toThrow(/\[CLI-ARG-14\]/);
      expect(() => parseIngestionCliArgs(['--from-db', '--years', '2'])).toThrow(/\[CLI-ARG-14\]/);
      expect(() => parseIngestionCliArgs(['--from-db', '--full'])).toThrow(/\[CLI-ARG-14\]/);
    });

    it('weigert database-specifieke vlaggen wanneer --from-db ontbreekt', () => {
      expect(() => parseIngestionCliArgs(['--with-configuration'])).toThrow(/--from-db/);
      expect(() => parseIngestionCliArgs(['--year', '2026'])).toThrow(/--from-db/);
      expect(() => parseIngestionCliArgs(['--only-pending'])).toThrow(/--from-db/);
      expect(() => parseIngestionCliArgs(['--start-after', 'uuid-1'])).toThrow(/--from-db/);
      expect(() => parseIngestionCliArgs(['--order-ids', 'uuid-1'])).toThrow(/--from-db/);
    });

    it('weigert tegenstrijdige combinatie van --full en --years', () => {
      expect(() => parseIngestionCliArgs(['--full', '--years', '2'])).toThrow(/--full/);
    });
  });

  describe('assertSafeSupabaseTarget & validateIngestionEnvironment (DTAP & Prod Shield)', () => {
    it('assertSafeSupabaseTarget laat Dev cizpyycszaszknffofhq toe', () => {
      expect(() => assertSafeSupabaseTarget('https://cizpyycszaszknffofhq.supabase.co')).not.toThrow();
    });

    it('assertSafeSupabaseTarget blokkeert Prod opoeksjilihrjszbftmn fail-closed (INV-GOV-24)', () => {
      expect(() => assertSafeSupabaseTarget('https://opoeksjilihrjszbftmn.supabase.co')).toThrow(
        /Productie-instantie gedetecteerd.*INV-GOV-24/
      );
    });

    it('validateIngestionEnvironment faalt closed als serviceKey ontbreekt bij schrijfacties (--force)', () => {
      const res = validateIngestionEnvironment(
        { isForce: true, isFromDb: true, isHelp: false } as any,
        { url: 'https://cizpyycszaszknffofhq.supabase.co', anonKey: 'anon-key' }
      );
      expect(res.ok).toBe(false);
      expect(res.error).toContain('SUPABASE_SERVICE_ROLE_KEY');
    });

    it('validateIngestionEnvironment faalt closed tegen Prod URL', () => {
      const res = validateIngestionEnvironment(
        { isForce: false, isFromDb: true, isHelp: false } as any,
        { url: 'https://opoeksjilihrjszbftmn.supabase.co', serviceKey: 'secret' }
      );
      expect(res.ok).toBe(false);
      expect(res.error).toContain('Productie');
    });

    it('validateIngestionEnvironment faalt closed als LogicTrade API credentials ontbreken bij delta-since', () => {
      const mockLtCheck = vi.fn().mockImplementation(() => {
        throw new Error('LOGICTRADE_API_KEY ontbreekt');
      });
      const res = validateIngestionEnvironment(
        { isForce: false, deltaSince: '2026-11-21', isHelp: false } as any,
        { url: 'https://cizpyycszaszknffofhq.supabase.co', serviceKey: 'secret' },
        mockLtCheck
      );
      expect(res.ok).toBe(false);
      expect(res.error).toContain('LOGICTRADE_API_KEY ontbreekt');
    });

    it('validateIngestionEnvironment slaagt bij correcte Dev config', () => {
      const res = validateIngestionEnvironment(
        { isForce: true, isFromDb: true, isHelp: false } as any,
        { url: 'https://cizpyycszaszknffofhq.supabase.co', serviceKey: 'secret' }
      );
      expect(res.ok).toBe(true);
    });
  });

  describe('chunkArray Boundary & Functionality', () => {
    it('werpt [CHUNK-01] Error indien chunkSize <= 0', () => {
      expect(() => chunkArray([1, 2, 3], 0)).toThrow(/\[CHUNK-01\]/);
      expect(() => chunkArray([1, 2, 3], -10)).toThrow(/\[CHUNK-01\]/);
    });

    it('deelt array op in stukken van de gewenste grootte', () => {
      const items = Array.from({ length: 125 }, (_, i) => i + 1);
      const chunks = chunkArray(items, 50);
      expect(chunks.length).toBe(3);
      expect(chunks[0].length).toBe(50);
      expect(chunks[1].length).toBe(50);
      expect(chunks[2].length).toBe(25);
    });

    it('handelt lege array netjes af', () => {
      expect(chunkArray([], 50)).toEqual([]);
    });
  });

  describe('buildPostgrestQueryString', () => {
    it('converteert params record naar PostgREST query string met %20 codering', () => {
      const qs = buildPostgrestQueryString({
        select: 'id, order_number',
        id: 'in.(1,2,3)',
      });
      expect(qs).toBe('select=id,%20order_number&id=in.(1,2,3)');
    });
  });

  describe('isIngestionCliEntrypoint', () => {
    it('retourneert false in test environment', () => {
      expect(isIngestionCliEntrypoint('scripts/run-order-ingestion.ts', 'test')).toBe(false);
    });

    it('retourneert true wanneer entrypoint overeenkomt buiten test environment', () => {
      expect(
        isIngestionCliEntrypoint(
          'C:/Users/gaspa/test_project/scripts/run-order-ingestion.ts',
          'production',
          'scripts/run-order-ingestion.ts'
        )
      ).toBe(true);
    });
  });

  describe('formatCliUsageHelp', () => {
    it('bevat alle 18 vlaggen en het werkende node tsx aanroepvoorbeeld', () => {
      const help = formatCliUsageHelp();
      for (const flag of ALL_FLAGS) {
        expect(help).toContain(flag);
      }
      expect(help).toContain('node ./node_modules/tsx/dist/cli.mjs scripts/run-order-ingestion.ts');
    });
  });

  describe('ingestOrderTransaction Transient Retry vs Deterministisch 4xx', () => {
    const dummyBundle: IngestedOrderBundle = {
      order: {
        id: '11111111-1111-1111-1111-111111111111',
        order_number: 'TEST-001',
        customer_name: 'Test Klant',
        fsm_step: 5,
        fsm_phase: 'geleverd',
        order_date: '2026-11-27',
        total_amount_cents: 10000,
        raw_data: {},
        lt_raw_data: {},
      },
      lines: [],
    };

    it('faalt onmiddellijk op poging 1 bij deterministische 4xx fouten (400, 401, 403, 404, 422)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Ongeldige payload parameters',
      });

      await expect(
        ingestOrderTransaction(dummyBundle, {
          maxRetries: 3,
          retryDelayMs: 1,
          fetchFn: mockFetch as any,
          url: 'https://cizpyycszaszknffofhq.supabase.co',
          authKey: 'service-key',
        })
      ).rejects.toThrow(/RPC ingest_logictrade_order mislukt: 400/);

      expect(mockFetch).toHaveBeenCalledTimes(1); // Géén overbodige retries op 400!
    });

    it('herprobeert bij transient 5xx fouten (500, 502, 503, 504) en slaagt alsnog', async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          return {
            ok: false,
            status: 503,
            text: async () => 'Service Temporarily Unavailable',
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, order_id: dummyBundle.order.id, lines_processed: 0 }),
        };
      });

      const res = await ingestOrderTransaction(dummyBundle, {
        maxRetries: 3,
        retryDelayMs: 1,
        fetchFn: mockFetch as any,
        url: 'https://cizpyycszaszknffofhq.supabase.co',
        authKey: 'service-key',
      });

      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('herprobeert bij transient 429 Too Many Requests', async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 429,
            text: async () => 'Rate limit exceeded',
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, order_id: dummyBundle.order.id, lines_processed: 0 }),
        };
      });

      const res = await ingestOrderTransaction(dummyBundle, {
        maxRetries: 2,
        retryDelayMs: 1,
        fetchFn: mockFetch as any,
        url: 'https://cizpyycszaszknffofhq.supabase.co',
        authKey: 'service-key',
      });

      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('herprobeert bij fetch netwerkexceptions en faalt na maxRetries', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNRESET connection reset by peer'));

      await expect(
        ingestOrderTransaction(dummyBundle, {
          maxRetries: 2,
          retryDelayMs: 1,
          fetchFn: mockFetch as any,
          url: 'https://cizpyycszaszknffofhq.supabase.co',
          authKey: 'service-key',
        })
      ).rejects.toThrow(/ECONNRESET/);

      expect(mockFetch).toHaveBeenCalledTimes(3); // Poging 1 + 2 retries
    });
  });

  describe('runLogicTradeApiHarvest - Orchestratie, PageSize Boundary & Budget Capping', () => {
    it('stopt direct en voert geen harvesters uit indien remaining <= 0 (maxCount bereikt)', async () => {
      const spyOrders = vi.spyOn(harvestModule, 'harvest2YearOrders').mockResolvedValue({ totalOrdersScanned: 0 } as any);
      const spyQuotes = vi.spyOn(harvestModule, 'harvestQuotes').mockResolvedValue({ totalQuotesScanned: 0 } as any);

      await runLogicTradeApiHarvest({
        ingestionType: 'all',
        originFilter: 'Winkel GSW BV',
        yearsArg: 2,
        getTotalScanned: () => 50,
        maxCount: 50,
        onOrder: async () => {},
        onQuote: async () => {},
      });

      expect(spyOrders).not.toHaveBeenCalled();
      expect(spyQuotes).not.toHaveBeenCalled();
      spyOrders.mockRestore();
      spyQuotes.mockRestore();
    });

    it('handhaaft dynamische fase-overschrijdende remaining budgettering en LTA0006 boundary', async () => {
      let scanned = 95;
      let capturedOrderOptions: any = null;
      let capturedQuoteOptions: any = null;

      const spyOrders = vi.spyOn(harvestModule, 'harvest2YearOrders').mockImplementation(async (opts: any) => {
        capturedOrderOptions = opts;
        // Simuleer dat er 2 orders worden gescand en onOrder wordt aangeroepen
        await opts.onOrder({ id: '1' }, []);
        scanned++;
        await opts.onOrder({ id: '2' }, []);
        scanned++;
        return { totalOrdersScanned: 2 } as any;
      });

      const spyQuotes = vi.spyOn(harvestModule, 'harvestQuotes').mockImplementation(async (opts: any) => {
        capturedQuoteOptions = opts;
        return { totalQuotesScanned: 0 } as any;
      });

      await runLogicTradeApiHarvest({
        ingestionType: 'all',
        originFilter: 'Winkel GSW BV',
        yearsArg: 1,
        getTotalScanned: () => scanned,
        maxCount: 100, // Initiële remaining = 5
        onOrder: async () => {},
        onQuote: async () => {},
      });

      expect(spyOrders).toHaveBeenCalledTimes(1);
      expect(capturedOrderOptions.pageSize).toBe(10); // Begrensd op minimum 10 conform LTA0006
      expect(capturedOrderOptions.maxOrders).toBe(5);
      expect(capturedOrderOptions.throwOnError).toBe(true);

      expect(spyQuotes).toHaveBeenCalledTimes(1);
      // Ná 2 verwerkte orders is remaining dynamisch gedaald van 5 naar 3 (100 - 97)
      expect(capturedQuoteOptions.maxQuotes).toBe(3);
      expect(capturedQuoteOptions.pageSize).toBe(10); // Begrensd op minimum 10 conform LTA0006
      expect(capturedQuoteOptions.throwOnError).toBe(true);

      spyOrders.mockRestore();
      spyQuotes.mockRestore();
    });

    it('slaat harvestQuotes over wanneer harvest2YearOrders het volledige budget opgebruikt', async () => {
      let scanned = 95;
      const spyOrders = vi.spyOn(harvestModule, 'harvest2YearOrders').mockImplementation(async (opts: any) => {
        // Simuleer 5 verwerkte orders (100 - 95 = 5)
        for (let i = 0; i < 5; i++) {
          await opts.onOrder({ id: String(i) }, []);
          scanned++;
        }
        return { totalOrdersScanned: 5 } as any;
      });

      const spyQuotes = vi.spyOn(harvestModule, 'harvestQuotes').mockResolvedValue({ totalQuotesScanned: 0 } as any);

      await runLogicTradeApiHarvest({
        ingestionType: 'all',
        originFilter: 'Winkel GSW BV',
        yearsArg: 1,
        getTotalScanned: () => scanned,
        maxCount: 100,
        onOrder: async () => {},
        onQuote: async () => {},
      });

      expect(spyOrders).toHaveBeenCalledTimes(1);
      // Budget is volledig verbruikt door orders; quotes mag NOOIT worden aangeroepen
      expect(spyQuotes).not.toHaveBeenCalled();

      spyOrders.mockRestore();
      spyQuotes.mockRestore();
    });

    it('filtert harvesters op basis van ingestionType (orders vs quotes)', async () => {
      const spyOrders = vi.spyOn(harvestModule, 'harvest2YearOrders').mockResolvedValue({ totalOrdersScanned: 1 } as any);
      const spyQuotes = vi.spyOn(harvestModule, 'harvestQuotes').mockResolvedValue({ totalQuotesScanned: 1 } as any);

      await runLogicTradeApiHarvest({
        ingestionType: 'orders',
        originFilter: 'Winkel GSW BV',
        yearsArg: 1,
        getTotalScanned: () => 0,
        onOrder: async () => {},
        onQuote: async () => {},
      });

      expect(spyOrders).toHaveBeenCalledTimes(1);
      expect(spyQuotes).not.toHaveBeenCalled();

      spyOrders.mockClear();
      spyQuotes.mockClear();

      await runLogicTradeApiHarvest({
        ingestionType: 'quotes',
        originFilter: 'Winkel GSW BV',
        yearsArg: 1,
        getTotalScanned: () => 0,
        onOrder: async () => {},
        onQuote: async () => {},
      });

      expect(spyOrders).not.toHaveBeenCalled();
      expect(spyQuotes).toHaveBeenCalledTimes(1);

      spyOrders.mockRestore();
      spyQuotes.mockRestore();
    });
  });
});
