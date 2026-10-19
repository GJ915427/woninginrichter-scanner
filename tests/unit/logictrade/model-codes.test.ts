import { describe, it, expect } from 'vitest';
import {
  resolveModelCode,
  resolveFeatureIntent,
  MODEL_CODE_DEFINITIONS
} from '@/lib/logictrade/model-codes';

describe('Model Code Resolver Engine Unit Tests', () => {
  it('correctly defines all industry standard Hunter Douglas / Luxaflex model codes', () => {
    expect(MODEL_CODE_DEFINITIONS.AU20).toBeDefined();
    expect(MODEL_CODE_DEFINITIONS.AU20.vorm).toBe(':20 Top Down / Bottom Up');
    expect(MODEL_CODE_DEFINITIONS.AU20.bediening).toBe('SmartCord');
    expect(MODEL_CODE_DEFINITIONS.AU20.surchargeEur).toBe(37.19);

    expect(MODEL_CODE_DEFINITIONS.AU10.vorm).toBe(':10 Standaard');
    expect(MODEL_CODE_DEFINITIONS.AE20.bediening).toBe('PowerView');
    expect(MODEL_CODE_DEFINITIONS.AF20.bediening).toBe('LiteRise');
    expect(MODEL_CODE_DEFINITIONS.AS20.bediening).toBe('Ketting');
  });

  it('resolves AU20 to Duette shade basisartikel and preset', () => {
    const res = resolveModelCode('AU20');
    expect(res).not.toBeNull();
    expect(res?.matchedCode).toBe('AU20');
    expect(res?.baseArticleSearchTerm).toBe('Duette shade');
    expect(res?.preset.vorm).toBe(':20 Top Down / Bottom Up');
    expect(res?.preset.bediening).toBe('SmartCord');
    expect(res?.preset.surchargeEur).toBe(37.19);
  });

  it('is case-insensitive and resolves lowercase au20', () => {
    const res = resolveModelCode('au20');
    expect(res).not.toBeNull();
    expect(res?.matchedCode).toBe('AU20');
    expect(res?.preset.vorm).toBe(':20 Top Down / Bottom Up');
  });

  it('resolves transpositions / typos like UA20 and EA20', () => {
    const ua20 = resolveModelCode('UA20');
    expect(ua20).not.toBeNull();
    expect(ua20?.matchedCode).toBe('AU20');
    expect(ua20?.preset.bediening).toBe('SmartCord');

    const ea20 = resolveModelCode('EA20');
    expect(ea20).not.toBeNull();
    expect(ea20?.matchedCode).toBe('AE20');
    expect(ea20?.preset.bediening).toBe('PowerView');

    const ua10 = resolveModelCode('ua10');
    expect(ua10).not.toBeNull();
    expect(ua10?.matchedCode).toBe('AU10');
  });

  it('resolves short form model codes like AU2 to AU20', () => {
    const res = resolveModelCode('AU2');
    expect(res).not.toBeNull();
    expect(res?.matchedCode).toBe('AU20');
    expect(res?.preset.vorm).toBe(':20 Top Down / Bottom Up');
  });

  it('resolves AU20 Plissé specifically to Plissé shade basisartikel', () => {
    const res = resolveModelCode('AU20 Plissé');
    expect(res).not.toBeNull();
    expect(res?.matchedCode).toBe('AU20');
    expect(res?.baseArticleSearchTerm).toBe('Plissé shade');
    expect(res?.preset.vorm).toBe(':20 Top Down / Bottom Up');
  });

  it('resolves AU10 to standard bottom-up with SmartCord', () => {
    const res = resolveModelCode('AU10');
    expect(res).not.toBeNull();
    expect(res?.matchedCode).toBe('AU10');
    expect(res?.preset.vorm).toBe(':10 Standaard');
    expect(res?.preset.surchargeEur).toBe(0);
  });

  it('resolves AE20 to PowerView motorbediening', () => {
    const res = resolveModelCode('AE20');
    expect(res).not.toBeNull();
    expect(res?.matchedCode).toBe('AE20');
    expect(res?.preset.bediening).toBe('PowerView');
  });

  it('returns null for standard search queries without model codes', () => {
    expect(resolveModelCode('Vadain Landmark')).toBeNull();
    expect(resolveModelCode('Interfloor Duette')).toBeNull();
    expect(resolveModelCode('Luxaflex')).toBeNull();
    expect(resolveModelCode('')).toBeNull();
  });

  it('returns null for unknown codes like AU99 or XYZ123', () => {
    expect(resolveModelCode('AU99')).toBeNull();
    expect(resolveModelCode('AU00')).toBeNull();
    expect(resolveModelCode('XYZ123')).toBeNull();
  });
});

describe('Feature & Intent Resolver Unit Tests', () => {
  it('resolves tru deut to TruFit montage and Handgreep bediening with cleanQuery Duette', () => {
    const res = resolveFeatureIntent('tru deut');
    expect(res.hasIntent).toBe(true);
    expect(res.featureBadges).toEqual(['TruFit']);
    expect(res.preconfiguration.montage).toBe('MONTAGE_TRUFIT');
    expect(res.preconfiguration.bediening).toBe('HANDGREEP'); // TruFit dwingt handgreep af
    expect(res.cleanQuery).toBe('Duette');
    expect(res.isStandaloneFeature).toBe(false);
  });

  it('resolves tru lux to TruFit with residual token lux in cleanQuery Duette shade lux', () => {
    const res = resolveFeatureIntent('tru lux');
    expect(res.hasIntent).toBe(true);
    expect(res.featureBadges).toEqual(['TruFit']);
    expect(res.preconfiguration.montage).toBe('MONTAGE_TRUFIT');
    expect(res.preconfiguration.bediening).toBe('HANDGREEP');
    expect(res.cleanQuery).toBe('Duette shade lux');
  });

  it('resolves standalone cord or cor to SmartCord bediening with isStandaloneFeature true', () => {
    const resCord = resolveFeatureIntent('cord');
    expect(resCord.hasIntent).toBe(true);
    expect(resCord.featureBadges).toEqual(['SmartCord']);
    expect(resCord.preconfiguration.bediening).toBe('SMARTCORD');
    expect(resCord.isStandaloneFeature).toBe(true);
    expect(resCord.cleanQuery).toBe('Duette shade');

    const resCor = resolveFeatureIntent('cor');
    expect(resCor.hasIntent).toBe(true);
    expect(resCor.featureBadges).toEqual(['SmartCord']);
    expect(resCor.preconfiguration.bediening).toBe('SMARTCORD');

    const resSmartCord = resolveFeatureIntent('smartcord');
    expect(resSmartCord.hasIntent).toBe(true);
    expect(resSmartCord.featureBadges).toEqual(['SmartCord']);
  });

  it('resolves progressive typing prefix queries like smartcor, smartco, smart to SmartCord', () => {
    const resSmartcor = resolveFeatureIntent('smartcor');
    expect(resSmartcor.hasIntent).toBe(true);
    expect(resSmartcor.featureBadges).toEqual(['SmartCord']);
    expect(resSmartcor.preconfiguration.bediening).toBe('SMARTCORD');

    const resSmartco = resolveFeatureIntent('smartco');
    expect(resSmartco.hasIntent).toBe(true);
    expect(resSmartco.featureBadges).toEqual(['SmartCord']);

    const resSmart = resolveFeatureIntent('smart');
    expect(resSmart.hasIntent).toBe(true);
    expect(resSmart.featureBadges).toEqual(['SmartCord']);

    const resTrufi = resolveFeatureIntent('trufi');
    expect(resTrufi.hasIntent).toBe(true);
    expect(resTrufi.featureBadges).toEqual(['TruFit']);

    const resPowerv = resolveFeatureIntent('powerv');
    expect(resPowerv.hasIntent).toBe(true);
    expect(resPowerv.featureBadges).toEqual(['PowerView']);
  });

  it('resolves universal infix/suffix keywords like fit and view', () => {
    const resFit = resolveFeatureIntent('fit');
    expect(resFit.hasIntent).toBe(true);
    expect(resFit.featureBadges).toEqual(['TruFit']);
    expect(resFit.preconfiguration.montage).toBe('MONTAGE_TRUFIT');
    expect(resFit.preconfiguration.bediening).toBe('HANDGREEP');

    const resView = resolveFeatureIntent('view');
    expect(resView.hasIntent).toBe(true);
    expect(resView.featureBadges).toEqual(['PowerView']);
    expect(resView.preconfiguration.bediening).toBe('POWERVIEW');

    const resMulti = resolveFeatureIntent('fit deut 20 cord');
    expect(resMulti.hasIntent).toBe(true);
    expect(resMulti.featureBadges).toContain('TruFit');
    expect(resMulti.featureBadges).toContain('SmartCord');
    expect(resMulti.preconfiguration.montage).toBe('MONTAGE_TRUFIT');
    expect(resMulti.preconfiguration.bediening).toBe('HANDGREEP');
    expect(resMulti.cleanQuery).toBe('Duette');
  });

  it('negative control: does NOT match cor inside raamdecoratie (token-bounded matching)', () => {
    const res = resolveFeatureIntent('Luxaflex raamdecoratie');
    expect(res.hasIntent).toBe(false);
    expect(res.featureBadges).toEqual([]);
    expect(res.preconfiguration).toEqual({});
    expect(res.cleanQuery).toBe('Luxaflex raamdecoratie');
  });

  it('resolves UA20 transposition typo to AU20 preset with SmartCord preconfiguration', () => {
    const res = resolveFeatureIntent('UA20');
    expect(res.hasIntent).toBe(true);
    expect(res.matchedModelCode).toBe('AU20');
    expect(res.preconfiguration.modelPreset?.code).toBe('AU20');
    expect(res.preconfiguration.bediening).toBe('SMARTCORD');
    expect(res.cleanQuery).toBe('Duette shade');
  });

  it('resolves multiple features: tru deut Architella verduisterend', () => {
    const res = resolveFeatureIntent('tru deut Architella verduisterend');
    expect(res.hasIntent).toBe(true);
    expect(res.featureBadges).toEqual(['TruFit', 'Architella', 'Verduisterend']);
    expect(res.preconfiguration.montage).toBe('MONTAGE_TRUFIT');
    expect(res.preconfiguration.bediening).toBe('HANDGREEP');
    expect(res.preconfiguration.stofFilter).toBe('Architella');
    expect(res.preconfiguration.eigenschap).toBe('verduisterend');
    expect(res.cleanQuery).toBe('Duette');
  });

  it('resolves Plissé specific intent when plissé is in query', () => {
    const res = resolveFeatureIntent('tru plissé');
    expect(res.hasIntent).toBe(true);
    expect(res.baseArticleSearchTerm).toBe('Plissé shade');
    expect(res.featureBadges).toEqual(['TruFit']);
  });

  it('handles empty, whitespace or non-string queries gracefully', () => {
    expect(resolveFeatureIntent('')).toEqual({
      hasIntent: false,
      featureBadges: [],
      preconfiguration: {},
      cleanQuery: '',
      isStandaloneFeature: false,
      baseArticleSearchTerm: 'Duette shade'
    });
    expect(resolveFeatureIntent('   ')).toEqual({
      hasIntent: false,
      featureBadges: [],
      preconfiguration: {},
      cleanQuery: '',
      isStandaloneFeature: false,
      baseArticleSearchTerm: 'Duette shade'
    });
  });
});
