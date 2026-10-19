import { describe, it, expect, beforeEach } from 'vitest';
import {
  DynamicAttributeRegistry,
  getDynamicAttributeRegistry,
  evaluateArticleVennMatch,
  resolveDuetteModelCode,
  resolveEffectiveProductCategory
} from '@/domain/search/dynamic-attribute-registry';
import { SearchResultItem } from '@/types/product';

describe('DynamicAttributeRegistry (SSOT Engine Harvesting)', () => {
  let registry: DynamicAttributeRegistry;

  beforeEach(() => {
    registry = new DynamicAttributeRegistry();
  });

  describe('Invariant 1: Harvesting across all categories', () => {
    it('harvests attribute nodes from raamdecoratie, gordijnen, vloeren and algemeen', () => {
      const stats = registry.getStats();
      expect(stats.totalAttributes).toBeGreaterThan(10);
      expect(stats.categories).toContain('raamdecoratie');
      expect(stats.categories).toContain('gordijnen');
      expect(stats.categories).toContain('vloeren');
    });
  });

  describe('Invariant 2: Raamdecoratie Attribute Intent Resolution', () => {
    it('resolves "top down" to VORM :20 for raamdecoratie', () => {
      const result = registry.resolveIntent('top down');
      expect(result.hasMatch).toBe(true);
      expect(result.stepId).toBe('VORM');
      expect(result.value).toBe(':20');
      expect(result.targetCategory).toBe('raamdecoratie');
      expect(result.badgeLabel?.toLowerCase()).toContain('top down');
    });

    it('resolves "kett" and "ketting" to BEDIENINGS_TYPE KETTING', () => {
      const resKett = registry.resolveIntent('kett');
      expect(resKett.hasMatch).toBe(true);
      expect(resKett.stepId).toBe('BEDIENINGS_TYPE');
      expect(resKett.value).toBe('KETTING');

      const resKetting = registry.resolveIntent('ketting');
      expect(resKetting.hasMatch).toBe(true);
      expect(resKetting.stepId).toBe('BEDIENINGS_TYPE');
      expect(resKetting.value).toBe('KETTING');
    });
  });

  describe('Invariant 3: Gordijnen & Vloeren Category Routing', () => {
    it('resolves "wave" to PLOOISOORT WAVE with targetCategory gordijnen', () => {
      const result = registry.resolveIntent('wave');
      expect(result.hasMatch).toBe(true);
      expect(result.stepId).toBe('PLOOISOORT');
      expect(result.value).toBe('WAVE');
      expect(result.targetCategory).toBe('gordijnen');
      expect(result.badgeLabel?.toLowerCase()).toContain('wave');
    });

    it('resolves "visgraat" to SNIJVERLIES 10_PROCENT with targetCategory vloeren', () => {
      const result = registry.resolveIntent('visgraat');
      expect(result.hasMatch).toBe(true);
      expect(result.stepId).toBe('SNIJVERLIES');
      expect(result.value).toBe('10_PROCENT');
      expect(result.targetCategory).toBe('vloeren');
    });
  });

  describe('Invariant 4: Residual Query Extraction & Trigrams', () => {
    it('extracts residual product query when searching composite terms like "duette top down"', () => {
      const result = registry.resolveIntent('duette top down');
      expect(result.hasMatch).toBe(true);
      expect(result.stepId).toBe('VORM');
      expect(result.value).toBe(':20');
      expect(result.residualQuery).toBe('duette');
    });

    it('supports 3-letter trigram intent matching for "cor" (SmartCord) and "fit" (TruFit)', () => {
      const resCor = registry.resolveIntent('cor');
      expect(resCor.hasMatch).toBe(true);
      expect(resCor.stepId).toBe('BEDIENINGS_TYPE');
      expect(resCor.value).toBe('SMARTCORD');

      const resFit = registry.resolveIntent('fit');
      expect(resFit.hasMatch).toBe(true);
      expect(resFit.stepId).toBe('MONTAGE');
      expect(resFit.value).toBe('MONTAGE_TRUFIT');
    });
  });

  describe('Invariant 5: Wet 1 Zero Surcharge Invariant', () => {
    it('never produces or returns a price surcharge (surchargeEur) in search resolution', () => {
      const result = registry.resolveIntent('smartcord') as any;
      expect(result.surchargeEur).toBeUndefined();
      expect(result.price).toBeUndefined();
    });
  });

  describe('Singleton Access', () => {
    it('returns a cached singleton instance via getDynamicAttributeRegistry', () => {
      const inst1 = getDynamicAttributeRegistry();
      const inst2 = getDynamicAttributeRegistry();
      expect(inst1).toBe(inst2);
    });
  });

  describe('Invariant 6: Hot-Reload External Schema Ingestion & Baseline Preservation', () => {
    it('merges external schemas additively and resolves new attributes', () => {
      const initialTotal = registry.getStats().totalAttributes;

      const result = registry.ingestExternalSchemas([
        {
          category: 'raamdecoratie',
          stepId: 'BEDIENINGS_TYPE',
          label: 'Bediening',
          values: [
            { value: 'MATTER_MOTOR', label: 'Matter Smart Home' },
          ],
          isActive: true,
        },
      ]);

      expect(result.externalStepsMerged).toBe(1);
      expect(registry.getStats().totalAttributes).toBe(initialTotal + 1);

      // Resolves newly ingested attribute
      const resolution = registry.resolveIntent('matter');
      expect(resolution.hasMatch).toBe(true);
      expect(resolution.stepId).toBe('BEDIENINGS_TYPE');
      expect(resolution.value).toBe('MATTER_MOTOR');
    });

    it('never overwrites existing Bron A baseline phrases in phraseIndex', () => {
      // Ingest an external option that tries to reuse "top down"
      registry.ingestExternalSchemas([
        {
          category: 'raamdecoratie',
          stepId: 'BEDIENINGS_TYPE',
          label: 'Bediening',
          values: [
            { value: 'TOP_DOWN_OVERWRITE_ATTEMPT', label: 'Top Down' },
          ],
          isActive: true,
        },
      ]);

      // Bron A baseline must be preserved (VORM :20)
      const res = registry.resolveIntent('top down');
      expect(res.hasMatch).toBe(true);
      expect(res.stepId).toBe('VORM');
      expect(res.value).toBe(':20');
    });

    it('does not hijack single-word product search with multi-word external phrases (P1-1 guard)', () => {
      registry.ingestExternalSchemas([
        {
          category: 'raamdecoratie',
          stepId: 'STEUN_TYPE',
          label: 'Steunen',
          values: [
            { value: 'ROL_STEUN_STD', label: 'Standaard rolgordijn steun' },
          ],
          isActive: true,
        },
      ]);

      // Single-word search for "rolgordijn" must NOT match "Standaard rolgordijn steun" via phraseIndex
      // because queryTokens.length === 1 and normalized !== phrase
      const res = registry.resolveIntent('rolgordijn');
      // If rolgordijn matches, it should be the product or undefined, NOT the STEUN_TYPE attribute
      if (res.hasMatch) {
        expect(res.stepId).not.toBe('STEUN_TYPE');
      }
    });

    it('resets cleanly to Bron A baseline via resetToBaseline', () => {
      registry.ingestExternalSchemas([
        {
          category: 'raamdecoratie',
          stepId: 'EXTRA_STAP',
          label: 'Extra',
          values: [{ value: 'VAL1', label: 'Val 1' }],
          isActive: true,
        },
      ]);

      expect(registry.getExternalStepsCount()).toBe(1);
      registry.resetToBaseline();
      expect(registry.getExternalStepsCount()).toBe(0);

      const res = registry.resolveIntent('VAL1');
      expect(res.hasMatch).toBe(false);
    });
  });

  describe('Multi-Facet Venn Diagram Falsification & Search Verification', () => {
    const duetteShadeItem: SearchResultItem = {
      id: 219609,
      code: 'A00052469',
      name: 'Duette® shade',
      salesGroup: 'Raamdecoratie',
      supplierName: 'Luxaflex',
      supplierId: 82653,
      groups: ['Raamdecoratie', 'Duette shades'],
      salesPrice: 0,
      vatCode: '1',
      unit: 'stuks',
      description: 'Duette shade raamdecoratie met smartcord of powerview'
    };

    const interfloorTapijtItem: SearchResultItem = {
      id: 300101,
      code: 'V0001234',
      name: 'Interfloor — 400 Ab Duette 703',
      salesGroup: 'Vloerbedekking',
      supplierName: 'Interfloor',
      supplierId: 54321,
      groups: ['Vloeren', 'Tapijt'],
      salesPrice: 89.95,
      vatCode: '1',
      unit: 'm1',
      description: 'Hoogwaardig kamerbreed tapijt 400 cm breed'
    };

    it('Scenario A: "duette raam" matches Duette raamdecoratie and strictly rejects Interfloor tapijt', () => {
      const duetteMatch = evaluateArticleVennMatch(duetteShadeItem, 'duette raam');
      expect(duetteMatch.matched).toBe(true);

      const carpetMatch = evaluateArticleVennMatch(interfloorTapijtItem, 'duette raam');
      expect(carpetMatch.matched).toBe(false);
    });

    it('Scenario B: "raam duette" obeys mathematical commutativity', () => {
      const forward = evaluateArticleVennMatch(duetteShadeItem, 'duette raam');
      const reversed = evaluateArticleVennMatch(duetteShadeItem, 'raam duette');

      expect(forward.matched).toBe(true);
      expect(reversed.matched).toBe(true);
      expect(reversed.preconfiguration).toEqual(forward.preconfiguration);
      expect(reversed.featureBadges).toEqual(forward.featureBadges);

      const carpetReversed = evaluateArticleVennMatch(interfloorTapijtItem, 'raam duette');
      expect(carpetReversed.matched).toBe(false);
    });

    it('Scenario C: "duette antraciet" preselects PROFIELKLEUR ANTRACIET and attaches badge', () => {
      const match = evaluateArticleVennMatch(duetteShadeItem, 'duette antraciet');
      expect(match.matched).toBe(true);
      expect(match.preconfiguration?.PROFIELKLEUR).toBe('ANTRACIET');
      expect(match.preconfiguration?.MONTAGE).toBe('MONTAGE_TRUFIT');
      expect(match.featureBadges?.some(b => b.includes('Antraciet'))).toBe(true);
    });

    it('Scenario D: "tapijt antraciet" intersects tapijt with antraciet without category lock', () => {
      const tapijtAntraciet: SearchResultItem = {
        ...interfloorTapijtItem,
        name: 'Interfloor Tapijt Antraciet 802'
      };
      const match = evaluateArticleVennMatch(tapijtAntraciet, 'tapijt antraciet');
      expect(match.matched).toBe(true);

      // Duette shade has antraciet profielkleur option but not the word tapijt
      const duetteTapijtMatch = evaluateArticleVennMatch(duetteShadeItem, 'tapijt antraciet');
      expect(duetteTapijtMatch.matched).toBe(false);
    });

    it('Scenario E: "au20" resolves model preset to VORM :20 and SMARTCORD', () => {
      const model = resolveDuetteModelCode('au20');
      expect(model).toBeDefined();
      expect(model?.code).toBe('AU20');
      expect(model?.vorm).toContain(':20');
      expect(model?.bediening).toBe('SmartCord');

      const match = evaluateArticleVennMatch(duetteShadeItem, 'au20');
      expect(match.matched).toBe(true);
      expect(match.preconfiguration?.VORM).toBe(':20');
      expect(match.preconfiguration?.BEDIENINGS_TYPE).toBe('SMARTCORD');

      const carpetMatch = evaluateArticleVennMatch(interfloorTapijtItem, 'au20');
      expect(carpetMatch.matched).toBe(false);
    });

    it('Scenario F: "ab21" resolves model preset to VORM :20 and KETTING', () => {
      const model = resolveDuetteModelCode('ab21');
      expect(model).toBeDefined();
      expect(model?.code).toBe('AB21');
      expect(model?.vorm).toContain(':20');
      expect(model?.bediening).toBe('Ketting');

      const match = evaluateArticleVennMatch(duetteShadeItem, 'ab21');
      expect(match.matched).toBe(true);
      expect(match.preconfiguration?.VORM).toBe(':20');
      expect(match.preconfiguration?.BEDIENINGS_TYPE).toBe('KETTING');

      const carpetMatch = evaluateArticleVennMatch(interfloorTapijtItem, 'ab21');
      expect(carpetMatch.matched).toBe(false);
    });

    it('Scenario G: "duette wit zwart" rejects conflicting options in same step', () => {
      const match = evaluateArticleVennMatch(duetteShadeItem, 'duette wit zwart');
      expect(match.matched).toBe(false);
    });

    it('Scenario H: "duette raam visgraat" returns false as no item satisfies all facets', () => {
      const duetteMatch = evaluateArticleVennMatch(duetteShadeItem, 'duette raam visgraat');
      expect(duetteMatch.matched).toBe(false);

      const carpetMatch = evaluateArticleVennMatch(interfloorTapijtItem, 'duette raam visgraat');
      expect(carpetMatch.matched).toBe(false);
    });
  });
});
