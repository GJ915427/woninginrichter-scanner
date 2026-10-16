/**
 * Testsuite voor V2 Greenfield Cognitive CPQ Search Engine
 * 
 * Dekt mechanisch af:
 * - Happy Path Scenario's (H1 `duette draai`, H2 `ua20`, H3 `tapijt antraciet`)
 * - Edge Cases (E1 `duette` homoniem, E2 `duette wit` micro-consolidatie, E3 `duette raam`, E4 `klemsteun luxaflex`, E5 lege query)
 * - Corner Cases (C1 `duette draai wit`, C2 incomplete data, C3 Anti-Cartesian Guard)
 * - Systeeminvarianten: IEEE 754 cent-safe float math, ERP id behoud, salesPrice/surcharge scheiding, deepFreeze immutability
 */

import { describe, it, expect } from 'vitest';
import {
  searchGreenfield,
  GreenfieldSearchEngine,
  calculateRelevanceScore
} from '@/domain/search/v2/search-engine';
import {
  CANONICAL_SEED_CATALOG,
  InMemorySeedCatalogProvider,
  deepFreeze
} from '@/domain/search/v2/canonical-catalog';
import { resolveQueryIntent, sanitizeQueryInput } from '@/domain/search/v2/query-intent-resolver';
import { discretizeSearchResults } from '@/domain/search/v2/knowledge-graph-binder';

describe('V2 Greenfield Cognitive Search Engine', () => {
  const engine = new GreenfieldSearchEngine();

  describe('Happy Path Scenario\'s', () => {
    it('H1: "duette draai" levert exact 2 discrete rijen met Klemsteun vs TruFit en gescheiden prijzen', async () => {
      const results = await engine.search('duette draai');
      expect(results.length).toBeGreaterThanOrEqual(2);

      // Filter specifiek op de Duette shade regels
      const duetteRows = results.filter(r => r.baseProductId === 52469);
      expect(duetteRows).toHaveLength(2);

      const klemRow = duetteRows.find(r => r.rowKey.includes('KLEMSTEUNEN'));
      const trufitRow = duetteRows.find(r => r.rowKey.includes('MONTAGE_TRUFIT'));

      expect(klemRow).toBeDefined();
      expect(trufitRow).toBeDefined();

      // Invariant 1: ERP ID integriteit
      expect(klemRow!.id).toBe(52469);
      expect(trufitRow!.id).toBe(52469);
      expect(klemRow!.baseProductId).toBe(52469);
      expect(trufitRow!.baseProductId).toBe(52469);

      // Invariant 2: Doppel-Berechnung mitigatie (salesPrice === basePriceEur)
      expect(klemRow!.salesPrice).toBe(861.02);
      expect(klemRow!.basePriceEur).toBe(861.02);
      expect(klemRow!.surchargeEur).toBe(24.50);
      expect(klemRow!.totalPriceEur).toBe(885.52);

      expect(trufitRow!.salesPrice).toBe(861.02);
      expect(trufitRow!.basePriceEur).toBe(861.02);
      expect(trufitRow!.surchargeEur).toBe(68.50);
      expect(trufitRow!.totalPriceEur).toBe(929.52);

      // Invariant 3: Schone badges (geen dubbele prefix)
      expect(klemRow!.featureBadges).toContain('Klemsteunen op draai-kiepraam');
      expect(klemRow!.featureBadges?.[0]).not.toContain('Voorgeselecteerd:');
      expect(trufitRow!.featureBadges).toContain('TruFit® (Plakprofiel draai-kiepraam)');

      // Invariant 4: Preconfiguration payload
      expect(klemRow!.preconfiguration?.MONTAGE).toBe('KLEMSTEUNEN');
      expect(klemRow!.preconfiguration?.montage).toBe('KLEMSTEUNEN');
      expect(trufitRow!.preconfiguration?.MONTAGE).toBe('MONTAGE_TRUFIT');
    });

    it('H2: "ua20" normaliseert naar AU20 en levert zuiver ModelPreset contract', async () => {
      const results = await engine.search('ua20');
      expect(results.length).toBeGreaterThanOrEqual(1);

      // Uitsluitend raambekleding Duette/Plissé, geen horren of losse diensten
      for (const row of results) {
        expect(['A00052469', 'A00052470']).toContain(row.code);
        expect(row.modelPreset).toBeDefined();
        expect(row.modelPreset?.code).toBe('AU20');
        expect(row.modelPreset?.name).toBe('Top-Down / Bottom-Up SmartCord®');
        expect(row.modelPreset?.productFamily).toBe('Duette / Plissé');
        expect(row.modelPreset?.vorm).toBe(':20 Top Down / Bottom Up');
        expect(row.modelPreset?.bediening).toBe('SmartCord');
        expect(row.modelPreset?.surchargeEur).toBe(37.19);
      }
    });

    it('H3: "tapijt antraciet" toont uitsluitend vloeren zonder raambekleding', async () => {
      const results = await engine.search('tapijt antraciet');
      expect(results.length).toBeGreaterThanOrEqual(1);

      for (const row of results) {
        expect(row.supplierName).toBe('Interfloor');
        expect(row.salesGroup).toBe('Tapijt');
      }

      // Geen enkele Duette of Plissé shade aanwezig (domein Raambekleding)
      const hasWindowDecor = results.some(r => r.groups.includes('Raambekleding') || r.name.toLowerCase().includes('shade'));
      expect(hasWindowDecor).toBe(false);
    });
  });

  describe('Edge Cases (Grenzen van het domein)', () => {
    it('E1: "duette" geeft raambekleding voorrang boven homoniem tapijt "400 Ab Duette"', async () => {
      const results = await engine.search('duette');
      expect(results.length).toBeGreaterThan(0);

      // Positie 1 moet een Duette shade zijn
      expect(results[0].name).toContain('Duette® shade');
      expect(results[0].salesGroup).toBe('Duette');

      // Indien het tapijt aanwezig is, moet het lager gerangschikt zijn
      const carpetIdx = results.findIndex(r => r.code === 'VLOER-400-DUETTE');
      if (carpetIdx !== -1) {
        expect(carpetIdx).toBeGreaterThan(0);
      }
    });

    it('E2: "duette wit" consolideert micro-opties naar 1 regel met stofFilter isolatie', async () => {
      const results = await engine.search('duette wit');
      const duetteRows = results.filter(r => r.baseProductId === 52469);

      // Exact 1 geconsolideerde regel voor Duette (geen 80 rijen)
      expect(duetteRows).toHaveLength(1);
      const row = duetteRows[0];

      // Geen extra montagetoeslag
      expect(row.surchargeEur).toBe(0);
      expect(row.totalPriceEur).toBe(861.02);

      // Schone micro-badge
      expect(row.featureBadges).toContain('Kleurvoorkeur: Elan Helderwit');

      // Bron A SSOT Zuiverheid: stofFilter gevuld, STOF_KLEUR niet gecorrumpeerd naar 'WIT'
      expect(row.preconfiguration?.stofFilter).toBe('WIT');
      expect(row.preconfiguration?.STOF_KLEUR).toBeUndefined();
    });

    it('E3: "duette raam" isoleert het contextwoord en forceert geen montageklemmen', async () => {
      const results = await engine.search('duette raam');
      const duetteRows = results.filter(r => r.baseProductId === 52469);

      expect(duetteRows).toHaveLength(1);
      const row = duetteRows[0];

      // Geen klemsteun-badge geforceerd door het woord 'raam'
      expect(row.surchargeEur).toBe(0);
      expect(row.featureBadges?.some(b => b.includes('Klemsteun'))).toBeFalsy();
    });

    it('E4: "klemsteun luxaflex" rangschikt los accessoire op positie 1', async () => {
      const results = await engine.search('klemsteun luxaflex');
      expect(results.length).toBeGreaterThan(0);

      // Positie 1 moet het losse accessoire zijn
      expect(results[0].code).toBe('ACC-KLEM-01');
      expect(results[0].name).toBe('Luxaflex Klemsteun set');
      expect(results[0].salesPrice).toBe(24.50);
    });

    it('E5: Lege of whitespace query\'s retourneren deterministisch een lege array fail-closed', async () => {
      expect(await engine.search('')).toEqual([]);
      expect(await engine.search('   ')).toEqual([]);
      expect(await engine.search(',,,---')).toEqual([]);
    });
  });

  describe('Corner Cases (Extreme samenloop)', () => {
    it('C1: "duette draai wit" combineert macro-discretisatie met micro-kleurfiltering', async () => {
      const results = await engine.search('duette draai wit');
      const duetteRows = results.filter(r => r.baseProductId === 52469);

      // Exact 2 regels voor de 2 macro montageopties
      expect(duetteRows).toHaveLength(2);

      for (const row of duetteRows) {
        // Beide dragen de kleurintentie
        expect(row.featureBadges).toContain('Kleurvoorkeur: Elan Helderwit');
        expect(row.preconfiguration?.stofFilter).toBe('WIT');
      }

      // Regel 1 heeft Klemsteun
      expect(duetteRows[0].preconfiguration?.MONTAGE).toBe('KLEMSTEUNEN');
      expect(duetteRows[0].totalPriceEur).toBe(885.52);

      // Regel 2 heeft TruFit
      expect(duetteRows[1].preconfiguration?.MONTAGE).toBe('MONTAGE_TRUFIT');
      expect(duetteRows[1].totalPriceEur).toBe(929.52);
    });

    it('C2: Incomplete ERP-artikelen hebben relevantiescore 0 en worden gefilterd', async () => {
      const intent = resolveQueryIntent('duette');
      const incompleteProduct = CANONICAL_SEED_CATALOG.find(p => p.domain === 'UNCLASSIFIED');
      expect(incompleteProduct).toBeDefined();

      const score = calculateRelevanceScore(incompleteProduct!, intent);
      expect(score).toBe(0.0);

      const results = await engine.search('duette');
      const hasUnclassified = results.some(r => r.id === 99999);
      expect(hasUnclassified).toBe(false);
    });

    it('C3: Anti-Cartesian Clutter Guard beperkt rijen tot <= 3 bij multidimensionale macro matches', () => {
      const duette = CANONICAL_SEED_CATALOG.find(p => p.id === 52469)!;
      // Simuleer query met match op Montage (2 opties) en Bediening (2 opties)
      const intent = resolveQueryIntent('duette draai powerview smartcord');

      const rows = discretizeSearchResults(duette, intent);
      // Mag nooit 2 x 2 = 4 rijen worden
      expect(rows.length).toBeLessThanOrEqual(3);
      expect(rows).toHaveLength(2); // Gediscretiseerd langs primaire dimensie MONTAGE
    });
  });

  describe('Systeeminvarianten & CPQ Integriteit', () => {
    it('IEEE 754 Floating Point Safe Math: afronding op exacte centen zonder drift', async () => {
      const results = await engine.search('duette draai');
      const klemRow = results.find(r => r.rowKey.includes('KLEMSTEUNEN'));
      expect(klemRow).toBeDefined();

      // 861.02 + 24.50 = 885.52 (exact cent equality)
      expect(klemRow!.totalPriceEur).toBe(885.52);
      expect(klemRow!.totalPriceEur.toString()).toBe('885.52');
    });

    it('Immutability Contract: InMemorySeedCatalogProvider bevriest catalogus via deepFreeze', async () => {
      const provider = new InMemorySeedCatalogProvider();
      const catalog = await provider.getCatalog();

      expect(Object.isFrozen(catalog)).toBe(true);
      if (catalog.length > 0) {
        expect(Object.isFrozen(catalog[0])).toBe(true);
        expect(Object.isFrozen(catalog[0].capabilities)).toBe(true);
      }
    });

    it('Downstream Orderline Veiligheid: SearchResultItem.id blijft canoniek ERP ID', async () => {
      const results = await engine.search('duette draai');
      for (const row of results) {
        expect(typeof row.id).toBe('number');
        expect(row.id).toBe(row.baseProductId);
        expect(row.id).toBe(52469);
      }
    });
  });
});
