import { describe, it, expect } from 'vitest';
import {
  calculateDamerauLevenshtein,
  searchLexiconToken,
  resolveUniversalModelCode,
  extractUniversalFeatureIntent,
  FEATURE_ENTITIES,
  MIN_TOKEN_LENGTH_GUARD
} from '@/lib/logictrade/search-lexicon';

describe('UniversalSearchLexicon Unit Tests', () => {
  describe('Damerau-Levenshtein Metric & Typo Tolerance', () => {
    it('calculates 0 distance for identical strings', () => {
      expect(calculateDamerauLevenshtein('', '')).toBe(0);
      expect(calculateDamerauLevenshtein('duette', 'duette')).toBe(0);
      expect(calculateDamerauLevenshtein('SmartCord', 'SmartCord')).toBe(0);
    });

    it('calculates distance 1 for single insertion, deletion or substitution', () => {
      expect(calculateDamerauLevenshtein('smart', 'smartc')).toBe(1); // insertion
      expect(calculateDamerauLevenshtein('cord', 'cor')).toBe(1);     // deletion
      expect(calculateDamerauLevenshtein('duet', 'duat')).toBe(1);     // substitution
    });

    it('calculates distance 1 for adjacent character transpositions', () => {
      // Transpositie UA20 -> AU20
      expect(calculateDamerauLevenshtein('UA20', 'AU20')).toBe(1);
      expect(calculateDamerauLevenshtein('EA20', 'AE20')).toBe(1);
      // Transpositie deut -> duet
      expect(calculateDamerauLevenshtein('deut', 'duet')).toBe(1);
    });

    it('calculates distance > 1 for non-adjacent swaps or larger differences', () => {
      expect(calculateDamerauLevenshtein('deut', 'duette')).toBe(3);
      expect(calculateDamerauLevenshtein('abc', 'xyz')).toBe(3);
    });
  });

  describe('Universal Infix & Substring Token Matching', () => {
    it('matches substrings at the END of keywords (suffix/infix: cord -> SmartCord)', () => {
      const matchCord = searchLexiconToken('cord');
      expect(matchCord).not.toBeNull();
      expect(matchCord?.entity.id).toBe('SMARTCORD');
      expect(matchCord?.entity.badge).toBe('SmartCord');

      const matchCor = searchLexiconToken('cor');
      expect(matchCor).not.toBeNull();
      expect(matchCor?.entity.id).toBe('SMARTCORD');
    });

    it('matches substrings at the END of keywords (fit -> TruFit)', () => {
      const matchFit = searchLexiconToken('fit');
      expect(matchFit).not.toBeNull();
      expect(matchFit?.entity.id).toBe('TRUFIT');
      expect(matchFit?.entity.badge).toBe('TruFit');
    });

    it('matches substrings at the START of keywords (tru -> TruFit, power -> PowerView)', () => {
      const matchTru = searchLexiconToken('tru');
      expect(matchTru).not.toBeNull();
      expect(matchTru?.entity.id).toBe('TRUFIT');

      const matchPower = searchLexiconToken('power');
      expect(matchPower).not.toBeNull();
      expect(matchPower?.entity.id).toBe('POWERVIEW');
    });

    it('matches substrings in the MIDDLE or suffix (view -> PowerView, rise -> LiteRise)', () => {
      const matchView = searchLexiconToken('view');
      expect(matchView).not.toBeNull();
      expect(matchView?.entity.id).toBe('POWERVIEW');

      const matchRise = searchLexiconToken('rise');
      expect(matchRise).not.toBeNull();
      expect(matchRise?.entity.id).toBe('LITERISE');
    });

    it('matches stem-aliases with typo tolerance (deut -> duet -> Duette)', () => {
      const matchDeut = searchLexiconToken('deut');
      expect(matchDeut).not.toBeNull();
      expect(matchDeut?.entity.id).toBe('FAMILY_DUETTE');
    });

    it('enforces MIN_TOKEN_LENGTH_GUARD (>= 3 chars) preventing 1-letter false positives', () => {
      expect(MIN_TOKEN_LENGTH_GUARD).toBe(3);
      expect(searchLexiconToken('c')).toBeNull();
      expect(searchLexiconToken('a')).toBeNull();
      expect(searchLexiconToken('f')).toBeNull();
    });

    it('negative control: does NOT match raamdecoratie on cor (keyword must contain token, not vice versa)', () => {
      const match = searchLexiconToken('raamdecoratie');
      expect(match).toBeNull();
    });
  });

  describe('Model Code Parsing & Transposition Resolution', () => {
    it('resolves exact model codes AU20, AU10, AE20, AF20, AS20', () => {
      const au20 = resolveUniversalModelCode('AU20');
      expect(au20?.matchedCode).toBe('AU20');
      expect(au20?.preset.vorm).toBe(':20 Top Down / Bottom Up');
      expect(au20?.preset.bediening).toBe('SmartCord');

      const ae20 = resolveUniversalModelCode('AE20');
      expect(ae20?.matchedCode).toBe('AE20');
      expect(ae20?.preset.bediening).toBe('PowerView');
    });

    it('resolves transpositions like UA20 and EA20', () => {
      const ua20 = resolveUniversalModelCode('UA20');
      expect(ua20?.matchedCode).toBe('AU20');

      const ea20 = resolveUniversalModelCode('EA20');
      expect(ea20?.matchedCode).toBe('AE20');

      const ua10 = resolveUniversalModelCode('ua10');
      expect(ua10?.matchedCode).toBe('AU10');
    });

    it('resolves short form model codes like AU2 to AU20', () => {
      const res = resolveUniversalModelCode('AU2');
      expect(res?.matchedCode).toBe('AU20');
    });

    it('resolves standalone shape numbers like 20 to AU20 or AE20 if power is in query', () => {
      const resDefault = resolveUniversalModelCode('20');
      expect(resDefault?.matchedCode).toBe('AU20');

      const resPower = resolveUniversalModelCode('power 20');
      expect(resPower?.matchedCode).toBe('AE20');

      const resLite = resolveUniversalModelCode('lite 20');
      expect(resLite?.matchedCode).toBe('AF20');
    });
  });

  describe('Universal Feature Intent Extraction Pipeline', () => {
    it('resolves tru deut to TruFit montage, Handgreep bediening and cleanQuery Duette', () => {
      const res = extractUniversalFeatureIntent('tru deut');
      expect(res.hasIntent).toBe(true);
      expect(res.featureBadges).toEqual(['TruFit']);
      expect(res.preconfiguration.montage).toBe('MONTAGE_TRUFIT');
      expect(res.preconfiguration.bediening).toBe('HANDGREEP');
      expect(res.cleanQuery).toBe('Duette');
      expect(res.isStandaloneFeature).toBe(false);
    });

    it('resolves standalone cord and cor to SmartCord bediening', () => {
      const resCord = extractUniversalFeatureIntent('cord');
      expect(resCord.hasIntent).toBe(true);
      expect(resCord.featureBadges).toEqual(['SmartCord']);
      expect(resCord.preconfiguration.bediening).toBe('SMARTCORD');
      expect(resCord.isStandaloneFeature).toBe(true);
      expect(resCord.cleanQuery).toBe('Duette shade');

      const resCor = extractUniversalFeatureIntent('cor');
      expect(resCor.hasIntent).toBe(true);
      expect(resCor.featureBadges).toEqual(['SmartCord']);
      expect(resCor.isStandaloneFeature).toBe(true);
    });

    it('resolves standalone fit to TruFit montage and Handgreep bediening', () => {
      const resFit = extractUniversalFeatureIntent('fit');
      expect(resFit.hasIntent).toBe(true);
      expect(resFit.featureBadges).toEqual(['TruFit']);
      expect(resFit.preconfiguration.montage).toBe('MONTAGE_TRUFIT');
      expect(resFit.preconfiguration.bediening).toBe('HANDGREEP');
      expect(resFit.isStandaloneFeature).toBe(true);
    });

    it('resolves standalone view to PowerView motorbediening', () => {
      const resView = extractUniversalFeatureIntent('view');
      expect(resView.hasIntent).toBe(true);
      expect(resView.featureBadges).toEqual(['PowerView']);
      expect(resView.preconfiguration.bediening).toBe('POWERVIEW');
      expect(resView.isStandaloneFeature).toBe(true);
    });

    it('resolves multi-feature query with Bron A constraint: fit deut 20 cord', () => {
      const res = extractUniversalFeatureIntent('fit deut 20 cord');
      expect(res.hasIntent).toBe(true);
      expect(res.featureBadges).toContain('TruFit');
      expect(res.featureBadges).toContain('SmartCord');
      expect(res.preconfiguration.montage).toBe('MONTAGE_TRUFIT');
      // Bron A invariant: TruFit dwingt mechanisch handgreep af
      expect(res.preconfiguration.bediening).toBe('HANDGREEP');
      expect(res.preconfiguration.modelPreset?.code).toBe('AU20');
      expect(res.cleanQuery).toBe('Duette');
    });

    it('resolves tru deut Architella verduisterend with all 3 badges and preconfiguration', () => {
      const res = extractUniversalFeatureIntent('tru deut Architella verduisterend');
      expect(res.hasIntent).toBe(true);
      expect(res.featureBadges).toEqual(['TruFit', 'Architella', 'Verduisterend']);
      expect(res.preconfiguration.montage).toBe('MONTAGE_TRUFIT');
      expect(res.preconfiguration.bediening).toBe('HANDGREEP');
      expect(res.preconfiguration.stofFilter).toBe('Architella');
      expect(res.preconfiguration.eigenschap).toBe('verduisterend');
      expect(res.cleanQuery).toBe('Duette');
    });

    it('passes residual supplier tokens dynamically in tru lux, tru luxa, and tru sun without hardcoded prefix hacks', () => {
      const resLux = extractUniversalFeatureIntent('tru lux');
      expect(resLux.hasIntent).toBe(true);
      expect(resLux.featureBadges).toEqual(['TruFit']);
      expect(resLux.cleanQuery).toBe('Duette shade lux');

      const resLuxa = extractUniversalFeatureIntent('trufit luxa');
      expect(resLuxa.hasIntent).toBe(true);
      expect(resLuxa.featureBadges).toEqual(['TruFit']);
      expect(resLuxa.cleanQuery).toBe('Duette shade luxa');

      const resSun = extractUniversalFeatureIntent('fit sun');
      expect(resSun.hasIntent).toBe(true);
      expect(resSun.featureBadges).toEqual(['TruFit']);
      expect(resSun.cleanQuery).toBe('Duette shade sun');
    });

    it('handles negative control Luxaflex raamdecoratie with 0 badges and full cleanQuery', () => {
      const res = extractUniversalFeatureIntent('Luxaflex raamdecoratie');
      expect(res.hasIntent).toBe(false);
      expect(res.featureBadges).toEqual([]);
      expect(res.preconfiguration).toEqual({});
      expect(res.cleanQuery).toBe('Luxaflex raamdecoratie');
    });

    it('handles empty and whitespace queries gracefully', () => {
      expect(extractUniversalFeatureIntent('').hasIntent).toBe(false);
      expect(extractUniversalFeatureIntent('   ').hasIntent).toBe(false);
    });
  });
});
