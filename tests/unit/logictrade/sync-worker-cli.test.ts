// [SPEC-CHANGE-AUTHORIZED: Step 3 Completion - CLI Daemon Unit Tests and Static RLS DDL Verification]
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  parseWorkerCliArgs,
  validateWorkerCredentials,
  isWorkerCliEntrypoint,
  WorkerCliOptions,
} from '../../../scripts/run-logictrade-sync-worker';

describe('LogicTrade Sync Worker CLI Daemon', () => {
  describe('parseWorkerCliArgs', () => {
    it('geeft de canonieke standaardwaarden terug wanneer geen argumenten zijn opgegeven', () => {
      const opts = parseWorkerCliArgs([]);
      expect(opts.isOnce).toBe(false);
      expect(opts.tickIntervalMs).toBe(1000);
      expect(opts.domainList).toEqual([
        'orders',
        'quotes',
        'purchaseorders',
        'customers',
        'suppliers',
      ]);
      expect(opts.workerId).toMatch(/^[a-zA-Z0-9_.-]+-\d+$/);
    });

    it('schakelt isOnce naar true bij aanwezigheid van --once vlag', () => {
      const opts = parseWorkerCliArgs(['--once']);
      expect(opts.isOnce).toBe(true);
    });

    it('parseert een numerieke --interval vlag correct', () => {
      const opts = parseWorkerCliArgs(['--interval=2500']);
      expect(opts.tickIntervalMs).toBe(2500);
    });

    it('sanitiseert niet-numerieke of negatieve intervalwaarden naar default 1000ms', () => {
      expect(parseWorkerCliArgs(['--interval=abc']).tickIntervalMs).toBe(1000);
      expect(parseWorkerCliArgs(['--interval=-50']).tickIntervalMs).toBe(1000);
      expect(parseWorkerCliArgs(['--interval=0']).tickIntervalMs).toBe(1000);
    });

    it('parseert een kommagescheiden lijst van domeinen correct', () => {
      const opts = parseWorkerCliArgs(['--domains=orders,quotes']);
      expect(opts.domainList).toEqual(['orders', 'quotes']);
    });

    it('filtert lege en spatie-tokens in --domains en valt terug op defaults bij een lege lijst', () => {
      const optsWithSpaces = parseWorkerCliArgs(['--domains=orders, ,quotes,']);
      expect(optsWithSpaces.domainList).toEqual(['orders', 'quotes']);

      const optsEmpty = parseWorkerCliArgs(['--domains=']);
      expect(optsEmpty.domainList).toEqual([
        'orders',
        'quotes',
        'purchaseorders',
        'customers',
        'suppliers',
      ]);
    });

    it('parseert een custom --worker-id correct', () => {
      const opts = parseWorkerCliArgs(['--worker-id=worker-test-lane-1']);
      expect(opts.workerId).toBe('worker-test-lane-1');
    });
  });

  describe('validateWorkerCredentials', () => {
    it('slaagt wanneer zowel url als serviceKey aanwezig zijn', () => {
      const res = validateWorkerCredentials({
        url: 'https://test.supabase.co',
        serviceKey: 'sb_secret_service_key',
      });
      expect(res.ok).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('faalt wanneer serviceKey ontbreekt (Fail-Closed)', () => {
      const res = validateWorkerCredentials({
        url: 'https://test.supabase.co',
        serviceKey: undefined,
      });
      expect(res.ok).toBe(false);
      expect(res.error).toContain('SUPABASE_SERVICE_ROLE_KEY');
    });

    it('faalt wanneer url ontbreekt', () => {
      const res = validateWorkerCredentials({
        url: undefined,
        serviceKey: 'sb_secret_service_key',
      });
      expect(res.ok).toBe(false);
      expect(res.error).toBeDefined();
    });
  });

  describe('isWorkerCliEntrypoint', () => {
    it('retourneert false in test environment', () => {
      expect(isWorkerCliEntrypoint('run-logictrade-sync-worker.ts', 'test')).toBe(false);
    });

    it('retourneert true wanneer entrypoint overeenkomt in productie environment', () => {
      expect(
        isWorkerCliEntrypoint(
          'scripts/run-logictrade-sync-worker.ts',
          'production',
          'scripts/run-logictrade-sync-worker.ts'
        )
      ).toBe(true);
    });
  });

  describe('Statische DDL Integriteit: 20261122_04_enable_rls_bronze_tables.sql', () => {
    const migrationPath = path.resolve(
      process.cwd(),
      'supabase/migrations/20261122_04_enable_rls_bronze_tables.sql'
    );

    it('migratiebestand bestaat op schijf', () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
    });

    it('bevat RLS inschakeling en strikte REVOKE ALL voor alle 7 Bronze tabellen', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      const expectedTables = [
        'logictrade_customers',
        'logictrade_suppliers',
        'logictrade_purchase_orders',
        'logictrade_purchase_order_lines',
        'logictrade_configurator_schemas',
        'logictrade_configurator_option_values',
        'logictrade_test',
      ];

      for (const table of expectedTables) {
        expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
        expect(sql).toContain(`REVOKE ALL ON public.${table} FROM anon, authenticated;`);
      }
    });

    it('kent expliciet SELECT rechten toe aan anon en authenticated voor configuratorschema tabellen', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      expect(sql).toContain('GRANT SELECT ON public.logictrade_configurator_schemas TO anon, authenticated;');
      expect(sql).toContain('GRANT SELECT ON public.logictrade_configurator_option_values TO anon, authenticated;');
      expect(sql).toContain('CREATE POLICY logictrade_configurator_schemas_public_select ON public.logictrade_configurator_schemas');
      expect(sql).toContain('CREATE POLICY logictrade_configurator_option_values_public_select ON public.logictrade_configurator_option_values');
    });

    it('kapselt logictrade_test conditioneel in een PL/pgSQL block', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      expect(sql).toMatch(/DO\s+\$\$\s+BEGIN\s+IF\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+pg_tables/i);
    });

    it('bevat NOTIFY pgrst cache refresh instructie', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      expect(sql).toContain("NOTIFY pgrst, 'reload schema';");
    });
  });
});
