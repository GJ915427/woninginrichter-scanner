import { SearchResultItem, ProductPreconfiguration } from '@/types/product';
import { ProductCategory } from '@/types/configurator';
import { ConclaafRulesEngine } from '@/domain/configurator/conclaaf-rules-engine';
import { resolveUniversalModelCode } from '@/lib/logictrade/search-lexicon';

export interface AttributeOptionNode {
  category: ProductCategory;
  stepId: string;
  rawValue: string;
  rawLabel: string;
  cleanLabel: string;
  badgeLabel: string;
  tokens: string[];
  requiredParentSteps?: Record<string, string>;
  // Backwards-compatible aliases for existing consumers of AttributeNode
  value: string;
  label: string;
}

export type AttributeNode = AttributeOptionNode;

export interface AttributeResolutionResult {
  hasMatch: boolean;
  targetCategory?: ProductCategory;
  stepId?: string;
  value?: string;
  badgeLabel?: string;
  residualQuery: string;
  matchedTokens: string[];
  requiredParentSteps?: Record<string, string>;
}

export interface ExternalAttributeSchema {
  category: ProductCategory;
  stepId: string;
  stepTitle?: string;
  label?: string;
  isActive?: boolean;
  values: Array<{
    value: string;
    label?: string;
    priceDelta?: number;
  }>;
}

const GENERIC_PRODUCT_TOKENS = new Set([
  'product', 'optie', 'standaard', 'geen', 'uitvoering', 'type',
  'rolgordijn', 'rolgordijnen', 'vouwgordijn', 'vouwgordijnen', 'gordijn', 'gordijnen',
  'jaloezie', 'jaloezieen', 'plisse', 'duette', 'tapijt', 'tapijten', 'vloer', 'vloeren'
]);

const DUTCH_STOPWORDS = new Set([
  'met', 'naar', 'deel', 'voor', 'van', 'het', 'een', 'zonder', 'leggen',
  'procent', 'hoge', 'maat', 'volledig', 'kleur', 'wens', 'op', 'en', 'in',
  'de', 'of', 'bij', 'tot'
]);

const DEFAULT_NON_DISTINCTIVE_KEYS = new Set([
  'STANDAARD', 'GEEN', 'NEE', 'BLIJVENDE_MAAT'
]);

/**
 * Canonieke categoriedetectie (100% pariteit met compute_logictrade_product_category en ConclaafRulesEngine.determineProductCategory).
 */
export function resolveEffectiveProductCategory(item: Partial<SearchResultItem>): ProductCategory {
  const sg = ((item.salesGroup || '') + ' ' + (Array.isArray(item.groups) ? item.groups.join(' ') : '')).toLowerCase();
  const sup = (item.supplierName || '').toLowerCase();
  const nm = (item.name || '').toLowerCase();
  const combined = `${sg} ${sup} ${nm}`;

  // 1. Expliciete verkoopgroep of leverancier voor Vloeren (vóór artikelnaam zodat Interfloor Duette vloeren blijft)
  if (
    /(vloer|tapijt|carpet|karpet|parket|laminaat|pvc|vinyl|linoleum|marmoleum|ondervloer|plint|deurmat|schoonloop|droogloop|kunstgras)/i.test(sg) ||
    /(interfloor|dersimo|tarkett|forbo|mflor|moduleo|quick-step|quickstep|ambiant|parador|coretec|belakos|desso|parade|bonaparte|nouwens|boca|gelasta|thomsit|eurocol|uzin|estillon|jumpax)/i.test(sup)
  ) {
    return 'vloeren';
  }

  // 2. Expliciete verkoopgroep of leverancier voor Raamdecoratie
  if (
    /(raamdecoratie|zonwering|horren|\bhor\b|jaloezie|pliss|duette|rolgordijn|vouwgordijn|lamel|shutter|multishade|twist|screen|markies|uitvalscherm|knikarmscherm|rolluik)/i.test(sg) ||
    /(luxaflex|sunway|verosol|jasno|bece|b&c|copa|keje|unilux|aurora|zonnelux|multisol|toppoint|erfal|velux)/i.test(sup)
  ) {
    return 'raamdecoratie';
  }

  // 3. Expliciete verkoopgroep of leverancier voor Gordijnen
  if (
    /(gordijn|inbetween|vitrage|overgordijn|confectie|wave|plooi|vouwgordijnstof)/i.test(sg) ||
    /(kobe|vadain|de ploeg|ploeg|kendix|eijffinger|artelux|ado|lethem|aroman|holland haag|hollandhaag|interstil|goelst|forest|vriesco|a house of happiness)/i.test(sup)
  ) {
    return 'gordijnen';
  }

  // 4. Fallback op artikelnaam
  if (
    /(tapijt|karpet|parket|laminaat|pvc|vinyl|linoleum|marmoleum|ondervloer|plint|deurmat|schoonloop|droogloop)/i.test(combined) ||
    (/vloer/i.test(combined) && !/vloerlamp/i.test(combined))
  ) {
    return 'vloeren';
  }

  if (/(raamdecoratie|zonwering|\b(hor|horren)\b|jaloezie|pliss|duette|rolgordijn|vouwgordijn|lamel|shutter|multishade|twist|velux|luxaflex)/i.test(combined)) {
    return 'raamdecoratie';
  }

  if (
    /(gordijn|inbetween|vitrage|overgordijn|vloerbedekking_gordijn)/i.test(combined) &&
    !/(meubel|bank|stoel|fauteuil|tafel|kast|bed|matras|rolgordijn|vouwgordijn|pliss|duette|jaloezie|lamel|shutter|multishade|twist)/i.test(combined)
  ) {
    return 'gordijnen';
  }

  return 'algemeen';
}

/**
 * Resolvet een token naar een Duette/Plissé modelcode (inclusief AB21, DB42, VS2 en AU/AE/AF/AS presets).
 */
export function resolveDuetteModelCode(token: string): { code: string; name: string; vorm: string; bediening: string; montage?: string } | null {
  if (!token) return null;
  const t = token.trim().toLowerCase();

  if (t === 'ab21') {
    return {
      code: 'AB21',
      name: 'Vrijhangend Top-Down / Bottom-Up (Ketting)',
      vorm: ':20 Top Down / Bottom Up',
      bediening: 'Ketting',
      montage: 'Standaard (In of op de dag)'
    };
  }
  if (t === 'db42') {
    return {
      code: 'DB42',
      name: 'Dag & Nacht (2 stoffen, SmartCord)',
      vorm: ':30 Dag en Nacht',
      bediening: 'SmartCord',
      montage: 'Standaard (In of op de dag)'
    };
  }
  if (t === 'vs2') {
    return {
      code: 'VS2',
      name: 'Ingespannen Top-Down / Bottom-Up (Slide / Handgreep)',
      vorm: ':20 Top Down / Bottom Up',
      bediening: 'LiteRise',
      montage: 'TruFit (Plakprofiel op glas — zonder boren)'
    };
  }

  const res = resolveUniversalModelCode(token);
  if (res && res.preset) {
    return {
      code: res.preset.code,
      name: res.preset.name,
      vorm: res.preset.vorm,
      bediening: res.preset.bediening,
      montage: res.preset.montage
    };
  }

  return null;
}

/**
 * Universele Multi-Facet Venn-Diagram Evaluator.
 * Evalueert per artikel of alle zoektermen in het artikel matchen (via tekst, categorie, gekoppelde opties of modelcodes).
 */
export function evaluateArticleVennMatch(
  article: SearchResultItem,
  rawQuery: string
): {
  matched: boolean;
  preconfiguration?: ProductPreconfiguration;
  featureBadges?: string[];
} {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return { matched: true, preconfiguration: article.preconfiguration || {}, featureBadges: article.featureBadges || [] };
  }

  const effectiveCategory = resolveEffectiveProductCategory(article);
  const registry = DynamicAttributeRegistry.getInstance();
  const allNodes = registry.getAllIndexedOptions();
  const catNodes = allNodes.filter(n => n.category === effectiveCategory);

  const queryTokens = trimmed.toLowerCase().split(/[^\w:]+/).filter(t => t.length > 0);
  if (queryTokens.length === 0) {
    return { matched: true, preconfiguration: article.preconfiguration || {}, featureBadges: article.featureBadges || [] };
  }

  const hayText = (
    `${article.name || ''} ${article.code || ''} ${article.supplierName || ''} ` +
    `${article.salesGroup || ''} ${Array.isArray(article.groups) ? article.groups.join(' ') : ''} ` +
    `${article.description || ''} ${effectiveCategory}`
  ).toLowerCase();

  const isDuetteFamily = effectiveCategory === 'raamdecoratie' && /(duette|pliss)/i.test(article.name || '');

  const matchedNodes: AttributeOptionNode[] = [];
  let matchedModelPreset: { code: string; name: string; vorm: string; bediening: string; montage?: string } | null = null;
  const userMatchedBadges: string[] = [];

  // Per-token matching status
  const optionOnlyTokens: Array<{ token: string; node: AttributeOptionNode }> = [];

  for (const token of queryTokens) {
    // 1. TextMatch
    const textMatch = hayText.includes(token) ||
      ((token === 'deut' || token === 'duet') && /duet/i.test(hayText)) ||
      ((token === 'plis' || token === 'pliss' || token === 'plisse') && /pliss/i.test(hayText));

    // 2. ModelPresetMatch (alleen voor Duette/Plissé raamdecoratie)
    let modelMatch = false;
    if (isDuetteFamily) {
      const model = resolveDuetteModelCode(token);
      if (model) {
        modelMatch = true;
        matchedModelPreset = model;
      }
    }

    // 3. OptionMatch
    const matchingOptionNodes = catNodes.filter(node => {
      return node.tokens.some(indexedToken => {
        if (indexedToken === token) return true;
        if (token.length >= 4 && indexedToken.startsWith(token)) return true;
        return false;
      });
    });

    if (matchingOptionNodes.length > 0) {
      for (const n of matchingOptionNodes) {
        matchedNodes.push(n);
        if (n.badgeLabel && !userMatchedBadges.includes(n.badgeLabel)) {
          userMatchedBadges.push(n.badgeLabel);
        }
      }
    }

    // Venn-conditie: ELK token moet op ten minste één facet van dit artikel matchen
    if (!textMatch && !modelMatch && matchingOptionNodes.length === 0) {
      return { matched: false };
    }

    // Registreer tokens die UITSLUITEND als optie matchen voor intra-stap conflict rejectie
    if (!textMatch && !modelMatch && matchingOptionNodes.length > 0) {
      for (const n of matchingOptionNodes) {
        optionOnlyTokens.push({ token, node: n });
      }
    }
  }

  // Intra-stap conflict rejectie: twee optie-only tokens mogen niet naar verschillende waarden van dezelfde stepId wijzen
  // (bijv. "duette wit zwart" op PROFIELKLEUR)
  const stepValueMap = new Map<string, { value: string; token: string }>();
  for (const item of optionOnlyTokens) {
    const existing = stepValueMap.get(item.node.stepId);
    if (existing && existing.value !== item.node.rawValue) {
      // Bron A Regel 1 uitzondering: MONTAGE_TRUFIT dwingt BEDIENINGS_TYPE = HANDGREEP af
      const isTruFitConflict = item.node.stepId === 'BEDIENINGS_TYPE' &&
        matchedNodes.some(n => n.stepId === 'MONTAGE' && n.rawValue === 'MONTAGE_TRUFIT');
      if (!isTruFitConflict) {
        return { matched: false };
      }
    } else {
      stepValueMap.set(item.node.stepId, { value: item.node.rawValue, token: item.token });
    }
  }

  // Construeer volledige preconfiguration en featureBadges
  const preconfiguration: ProductPreconfiguration = {
    ...(article.preconfiguration || {})
  };
  const featureBadges: string[] = [...(article.featureBadges || [])];

  // 1. ModelPreset preconfiguration
  if (matchedModelPreset) {
    preconfiguration.modelPreset = {
      code: matchedModelPreset.code,
      name: matchedModelPreset.name,
      productFamily: 'Duette / Plissé',
      vorm: matchedModelPreset.vorm,
      bediening: matchedModelPreset.bediening,
      montage: matchedModelPreset.montage
    };
    preconfiguration.VORM = matchedModelPreset.vorm.startsWith(':20')
      ? ':20'
      : matchedModelPreset.vorm.startsWith(':30')
        ? ':30'
        : ':10';
    preconfiguration.BEDIENINGS_TYPE = matchedModelPreset.bediening.toUpperCase().replace(/\s+/g, '');
    preconfiguration.bediening = matchedModelPreset.bediening;
  }

  // 2. Option nodes preconfiguration & required parent steps
  for (const node of matchedNodes) {
    if (node.requiredParentSteps) {
      for (const [parentStepId, parentVal] of Object.entries(node.requiredParentSteps)) {
        preconfiguration[parentStepId] = parentVal;
        if (parentStepId === 'MONTAGE') {
          preconfiguration.montage = parentVal;
          if (!featureBadges.includes('TruFit') && parentVal === 'MONTAGE_TRUFIT') {
            featureBadges.push('TruFit');
          }
        }
      }
    }
    preconfiguration[node.stepId] = node.rawValue;
    if (node.stepId === 'MONTAGE') {
      preconfiguration.montage = node.rawValue;
    }
    if (node.stepId === 'BEDIENINGS_TYPE') {
      preconfiguration.bediening = node.rawValue;
    }
    if (node.badgeLabel && !featureBadges.includes(node.badgeLabel)) {
      featureBadges.push(node.badgeLabel);
    }
  }

  // 3. Handhaaf Bron A Regel 1 constraint: TruFit dwingt mechanisch Handgreep af
  if (preconfiguration.MONTAGE === 'MONTAGE_TRUFIT' || preconfiguration.montage === 'MONTAGE_TRUFIT') {
    preconfiguration.BEDIENINGS_TYPE = 'HANDGREEP';
    preconfiguration.bediening = 'HANDGREEP';
    if (preconfiguration.VORM === ':30') {
      preconfiguration.VORM = ':20';
    }
  }

  // 4. Voeg alle expliciet gematchte gebruikersbadges toe
  for (const b of userMatchedBadges) {
    if (!featureBadges.includes(b)) {
      featureBadges.push(b);
    }
  }

  return {
    matched: true,
    preconfiguration,
    featureBadges
  };
}

/**
 * DynamicAttributeRegistry
 */
export class DynamicAttributeRegistry {
  private attributes: AttributeOptionNode[] = [];
  private tokenIndex = new Map<string, AttributeOptionNode[]>();
  private phraseIndex = new Map<string, AttributeOptionNode>();
  private categoriesHarvested = new Set<ProductCategory>();
  private externalStepsMerged = 0;

  constructor() {
    this.harvestAllRules();
  }

  public static getInstance(): DynamicAttributeRegistry {
    return getDynamicAttributeRegistry();
  }

  public static resolveIntent(rawQuery: string, categoryFilter?: ProductCategory): AttributeResolutionResult {
    return DynamicAttributeRegistry.getInstance().resolveIntent(rawQuery, categoryFilter);
  }

  public static getAllIndexedOptions(): AttributeOptionNode[] {
    return DynamicAttributeRegistry.getInstance().getAllIndexedOptions();
  }

  public static getExternalStepsCount(): number {
    return DynamicAttributeRegistry.getInstance().getExternalStepsCount();
  }

  public static ingestExternalSchemas(schemas: ExternalAttributeSchema[]): {
    totalOptionsIndexed: number;
    externalStepsMerged: number;
  } {
    return DynamicAttributeRegistry.getInstance().ingestExternalSchemas(schemas);
  }

  public static resetToBaseline(): void {
    DynamicAttributeRegistry.getInstance().resetToBaseline();
  }

  public getAllIndexedOptions(): AttributeOptionNode[] {
    return [...this.attributes];
  }

  public getExternalStepsCount(): number {
    return this.externalStepsMerged;
  }

  public resetToBaseline(): void {
    this.externalStepsMerged = 0;
    this.attributes = [];
    this.tokenIndex.clear();
    this.phraseIndex.clear();
    this.categoriesHarvested.clear();
    this.harvestAllRules();
  }

  public ingestExternalSchemas(schemas: ExternalAttributeSchema[]): {
    totalOptionsIndexed: number;
    externalStepsMerged: number;
  } {
    const nextAttributes: AttributeOptionNode[] = [];
    const nextTokenIndex = new Map<string, AttributeOptionNode[]>();
    const nextPhraseIndex = new Map<string, AttributeOptionNode>();
    const nextCategories = new Set<ProductCategory>();

    this.harvestInto(nextAttributes, nextTokenIndex, nextPhraseIndex, nextCategories);

    const mergedStepSet = new Set<string>();

    for (const schema of schemas) {
      if (schema.isActive === false || !schema.values || schema.values.length === 0) {
        continue;
      }

      mergedStepSet.add(schema.stepId);
      nextCategories.add(schema.category);

      for (const val of schema.values) {
        const normalizedValKey = val.value.trim().toLowerCase();
        const exists = nextAttributes.some(
          a => a.category === schema.category &&
               a.stepId === schema.stepId &&
               a.rawValue.trim().toLowerCase() === normalizedValKey
        );

        const clean = this.cleanLabel(val.label || val.value);
        const tokens = this.extractTokens(val.label || val.value, val.value, schema.stepId).filter(
          t => !GENERIC_PRODUCT_TOKENS.has(t)
        );

        const badgeLabel = val.label || clean;
        const node: AttributeOptionNode = {
          category: schema.category,
          stepId: schema.stepId,
          rawValue: val.value,
          rawLabel: val.label || val.value,
          cleanLabel: clean,
          badgeLabel,
          tokens,
          value: val.value,
          label: clean
        };

        if (!exists) {
          nextAttributes.push(node);
        }

        const normalizedPhrase = clean.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        if (normalizedPhrase && normalizedPhrase.includes(' ') && normalizedPhrase.length >= 5) {
          if (!nextPhraseIndex.has(normalizedPhrase)) {
            nextPhraseIndex.set(normalizedPhrase, node);
          }
        }

        for (const token of tokens) {
          const list = nextTokenIndex.get(token) || [];
          list.push(node);
          nextTokenIndex.set(token, list);
        }
      }
    }

    this.attributes = nextAttributes;
    this.tokenIndex = nextTokenIndex;
    this.phraseIndex = nextPhraseIndex;
    this.categoriesHarvested = nextCategories;
    this.externalStepsMerged = mergedStepSet.size;

    return {
      totalOptionsIndexed: this.attributes.length,
      externalStepsMerged: this.externalStepsMerged
    };
  }

  private harvestAllRules(): void {
    this.harvestInto(
      this.attributes,
      this.tokenIndex,
      this.phraseIndex,
      this.categoriesHarvested
    );
  }

  private harvestInto(
    targetAttributes: AttributeOptionNode[],
    targetTokenIndex: Map<string, AttributeOptionNode[]>,
    targetPhraseIndex: Map<string, AttributeOptionNode>,
    targetCategories: Set<ProductCategory>
  ): void {
    const categories: ProductCategory[] = ['raamdecoratie', 'gordijnen', 'vloeren', 'algemeen'];

    for (const cat of categories) {
      const dummyProduct: SearchResultItem = {
        id: 0,
        code: `DUMMY_${cat.toUpperCase()}`,
        name: `Basis ${cat}`,
        salesGroup: cat,
        supplierName: 'Interieur SSOT',
        supplierId: null,
        groups: [cat],
        salesPrice: 100,
        vatCode: '1',
        unit: 'stuks',
      };

      try {
        const engine = new ConclaafRulesEngine(dummyProduct);
        const config = engine.getConfiguration();

        if (config && Array.isArray(config.steps)) {
          // 1. Oogst basisstappen
          for (const step of config.steps) {
            if (step.possibleValues && step.possibleValues.length > 0) {
              for (const pv of step.possibleValues) {
                this.addNode(
                  targetAttributes,
                  targetTokenIndex,
                  targetPhraseIndex,
                  targetCategories,
                  cat,
                  step.id,
                  pv.key,
                  pv.value
                );
              }
            }
          }

          // 2. Simuleer ouder-selecties om conditionele sub-stappen te oogsten
          // Voor raamdecoratie: MONTAGE = 'MONTAGE_TRUFIT' maakt PROFIELKLEUR zichtbaar
          // BEDIENINGS_TYPE = 'POWERVIEW' maakt VOEDINGSTYPE en VOEDINGSZIJDE zichtbaar
          if (cat === 'raamdecoratie') {
            // A. TruFit profielkleuren
            try {
              const trufitEngine = new ConclaafRulesEngine(dummyProduct);
              trufitEngine.updateStep('MONTAGE', 'MONTAGE_TRUFIT');
              const trufitConfig = trufitEngine.getConfiguration();
              const profielStep = trufitConfig.steps.find(s => s.id === 'PROFIELKLEUR');
              if (profielStep && profielStep.possibleValues) {
                for (const pv of profielStep.possibleValues) {
                  this.addNode(
                    targetAttributes,
                    targetTokenIndex,
                    targetPhraseIndex,
                    targetCategories,
                    cat,
                    profielStep.id,
                    pv.key,
                    pv.value,
                    { MONTAGE: 'MONTAGE_TRUFIT' }
                  );
                }
              }
            } catch (err) {
              console.error('Fout bij oogsten TruFit conditionele stappen:', err);
            }

            // B. PowerView voeding en zijde
            try {
              const pvEngine = new ConclaafRulesEngine(dummyProduct);
              pvEngine.updateStep('BEDIENINGS_TYPE', 'POWERVIEW');
              const pvConfig = pvEngine.getConfiguration();
              for (const subStepId of ['VOEDINGSTYPE', 'VOEDINGSZIJDE']) {
                const subStep = pvConfig.steps.find(s => s.id === subStepId);
                if (subStep && subStep.possibleValues) {
                  for (const pv of subStep.possibleValues) {
                    this.addNode(
                      targetAttributes,
                      targetTokenIndex,
                      targetPhraseIndex,
                      targetCategories,
                      cat,
                      subStep.id,
                      pv.key,
                      pv.value,
                      { BEDIENINGS_TYPE: 'POWERVIEW' }
                    );
                  }
                }
              }
            } catch (err) {
              console.error('Fout bij oogsten PowerView conditionele stappen:', err);
            }
          }
        }
      } catch (err) {
        console.error(`Fout bij harvesting category ${cat}:`, err);
      }
    }
  }

  private addNode(
    targetAttributes: AttributeOptionNode[],
    targetTokenIndex: Map<string, AttributeOptionNode[]>,
    targetPhraseIndex: Map<string, AttributeOptionNode>,
    targetCategories: Set<ProductCategory>,
    category: ProductCategory,
    stepId: string,
    rawValue: string,
    rawLabel: string,
    requiredParentSteps?: Record<string, string>
  ): void {
    const clean = this.cleanLabel(rawLabel);
    const tokens = this.extractTokens(rawLabel, rawValue, stepId);
    if (tokens.length === 0) return;

    const badge = this.getBadgeLabel({ stepId, rawValue, cleanLabel: clean });

    const node: AttributeOptionNode = {
      category,
      stepId,
      rawValue,
      rawLabel,
      cleanLabel: clean,
      badgeLabel: badge,
      tokens,
      requiredParentSteps,
      value: rawValue,
      label: clean
    };

    targetAttributes.push(node);
    targetCategories.add(category);

    // Multi-word phrase indexing (bijv. "top down", "wave plooi", "klemsteunen op draai-kiepraam")
    const normalizedPhrase = clean.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (normalizedPhrase && !targetPhraseIndex.has(normalizedPhrase)) {
      targetPhraseIndex.set(normalizedPhrase, node);
    }

    // Token indexing
    for (const token of tokens) {
      const existing = targetTokenIndex.get(token) || [];
      if (!existing.some(e => e.stepId === stepId && e.rawValue === rawValue)) {
        existing.push(node);
      }
      targetTokenIndex.set(token, existing);
    }
  }

  public resolveIntent(rawQuery: string, categoryFilter?: ProductCategory): AttributeResolutionResult {
    const trimmed = rawQuery.trim();
    if (!trimmed) {
      return { hasMatch: false, residualQuery: rawQuery, matchedTokens: [] };
    }

    const normalized = trimmed.toLowerCase();
    const queryTokens = normalized.split(/[^a-z0-9]+/i).filter(t => t.length > 0);

    // 1. Zoek op multi-word phrases (bijv. "top down", "bottom up")
    for (const [phrase, node] of this.phraseIndex.entries()) {
      if (categoryFilter && node.category !== categoryFilter) continue;

      const isMatch =
        normalized === phrase ||
        normalized.includes(phrase) ||
        (queryTokens.length >= 2 && phrase.includes(normalized));

      if (isMatch) {
        const residual = this.computeResidual(rawQuery, phrase.split(' '));
        return {
          hasMatch: true,
          targetCategory: node.category,
          stepId: node.stepId,
          value: node.rawValue,
          badgeLabel: node.badgeLabel,
          residualQuery: residual,
          matchedTokens: phrase.split(' '),
          requiredParentSteps: node.requiredParentSteps
        };
      }
    }

    // 2. Zoek op samengestelde tokens in queryTokens (bijv. "duette top down")
    if (queryTokens.length >= 2) {
      for (let i = 0; i < queryTokens.length - 1; i++) {
        const twoGram = `${queryTokens[i]} ${queryTokens[i + 1]}`;
        for (const [phrase, node] of this.phraseIndex.entries()) {
          if (categoryFilter && node.category !== categoryFilter) continue;
          if (phrase.includes(twoGram) || twoGram.includes(phrase)) {
            const residual = this.computeResidual(rawQuery, [queryTokens[i], queryTokens[i + 1]]);
            return {
              hasMatch: true,
              targetCategory: node.category,
              stepId: node.stepId,
              value: node.rawValue,
              badgeLabel: node.badgeLabel,
              residualQuery: residual,
              matchedTokens: [queryTokens[i], queryTokens[i + 1]],
              requiredParentSteps: node.requiredParentSteps
            };
          }
        }
      }
    }

    // 3. Match individuele tokens (exact, prefix of geregistreerde aliassen)
    for (const qToken of queryTokens) {
      if (qToken.length < 2) continue;

      // Exacte token match in index
      if (this.tokenIndex.has(qToken)) {
        const nodes = this.tokenIndex.get(qToken)!;
        const matchingNode = (categoryFilter ? nodes.find(n => n.category === categoryFilter) : null) || nodes[0];
        const residual = this.computeResidual(rawQuery, [qToken]);
        return {
          hasMatch: true,
          targetCategory: matchingNode.category,
          stepId: matchingNode.stepId,
          value: matchingNode.rawValue,
          badgeLabel: matchingNode.badgeLabel,
          residualQuery: residual,
          matchedTokens: [qToken],
          requiredParentSteps: matchingNode.requiredParentSteps
        };
      }

      // Prefix match of alias match
      for (const [indexedToken, nodes] of this.tokenIndex.entries()) {
        const isPrefix = qToken.length >= 4 && indexedToken.startsWith(qToken);
        const isTrigram = (qToken === 'cor' && indexedToken.includes('cord')) ||
                          (qToken === 'fit' && indexedToken.includes('fit')) ||
                          (qToken === 'view' && indexedToken.includes('view'));

        if (isPrefix || isTrigram) {
          const matchingNode = (categoryFilter ? nodes.find(n => n.category === categoryFilter) : null) || nodes[0];
          const residual = this.computeResidual(rawQuery, [qToken]);
          return {
            hasMatch: true,
            targetCategory: matchingNode.category,
            stepId: matchingNode.stepId,
            value: matchingNode.rawValue,
            badgeLabel: matchingNode.badgeLabel,
            residualQuery: residual,
            matchedTokens: [qToken],
            requiredParentSteps: matchingNode.requiredParentSteps
          };
        }
      }
    }

    return { hasMatch: false, residualQuery: rawQuery, matchedTokens: [] };
  }

  public getStats(): { totalAttributes: number; categories: ProductCategory[] } {
    return {
      totalAttributes: this.attributes.length,
      categories: Array.from(this.categoriesHarvested),
    };
  }

  public cleanLabel(raw: string): string {
    return raw
      .replace(/\(\s*[+-]?\s*€[^)]*\)/gi, '')
      .replace(/\(\s*[+-]?\s*\d+\s*%[^)]*\)/gi, '')
      .trim();
  }

  public extractTokens(rawLabel: string, rawValue: string, stepId?: string): string[] {
    // Niet-onderscheidende standaarden uitsluiten van indexering
    if (DEFAULT_NON_DISTINCTIVE_KEYS.has(rawValue)) {
      return [];
    }

    const clean = this.cleanLabel(rawLabel);
    const combined = `${clean} ${rawValue}`.toLowerCase();

    // Splits op non-alphanumerieke karakters, behoud tokens >= 2 tekens
    const words = combined
      .split(/[^a-z0-9]+/i)
      .map(t => t.trim())
      .filter(t => t.length >= 2);

    const baseTokens: string[] = [];

    for (const w of words) {
      if (DUTCH_STOPWORDS.has(w)) continue;
      if (GENERIC_PRODUCT_TOKENS.has(w)) continue;
      // Bij PLINTEN sluiten we 'wit' en '70mm' uit zodat "tapijt wit" geen valse optie-match geeft
      if (stepId === 'PLINTEN' && (w === 'wit' || w === '70mm' || w === '70')) continue;
      baseTokens.push(w);
    }

    // Expliciete stam-aliassen
    const extraTokens: string[] = [];
    for (const bt of baseTokens) {
      if (bt === 'kiepraam' || bt === 'draaikiepraam') {
        extraTokens.push('kiepraam', 'raam', 'draai');
      }
      if (bt === 'plakprofiel') {
        extraTokens.push('plakprofiel', 'plak', 'profiel');
      }
      if (bt === 'smartcord') {
        extraTokens.push('smartcord', 'smart', 'cord', 'cor', 'koord');
      }
      if (bt === 'powerview') {
        extraTokens.push('powerview', 'power', 'view', 'motor', 'elektrisch');
      }
      if (bt === 'literise') {
        extraTokens.push('literise', 'handgreep');
      }
      if (bt === 'klemsteunen') {
        extraTokens.push('klemsteunen', 'klemsteun', 'klem');
      }
      if (bt === 'trufit') {
        extraTokens.push('trufit', 'tru', 'fit');
      }
      if (bt === 'topdown' || bt === 'top-down') {
        extraTokens.push('topdown', 'top', 'down');
      }
      if (bt === 'ketting' || bt === 'kettingbediening') {
        extraTokens.push('ketting', 'kett');
      }
      if (bt === 'visgraat') {
        extraTokens.push('visgraat');
      }
      if (bt === 'wave') {
        extraTokens.push('wave', 'plooi');
      }
    }

    return Array.from(new Set([...baseTokens, ...extraTokens]));
  }

  private computeResidual(originalQuery: string, tokensToRemove: string[]): string {
    let residual = originalQuery;
    for (const t of tokensToRemove) {
      const reg = new RegExp(`\\b${t}\\b`, 'gi');
      residual = residual.replace(reg, '');
    }
    return residual.replace(/\s+/g, ' ').trim();
  }

  public getBadgeLabel(node: { stepId: string; rawValue: string; cleanLabel: string }): string {
    if (node.stepId === 'VORM' && node.rawValue === ':20') return 'Top Down / Bottom Up';
    if (node.stepId === 'VORM' && node.rawValue === ':30') return 'Dag & Nacht';
    if (node.stepId === 'BEDIENINGS_TYPE' && node.rawValue === 'KETTING') return 'Ketting';
    if (node.stepId === 'BEDIENINGS_TYPE' && node.rawValue === 'SMARTCORD') return 'SmartCord';
    if (node.stepId === 'BEDIENINGS_TYPE' && node.rawValue === 'POWERVIEW') return 'PowerView';
    if (node.stepId === 'BEDIENINGS_TYPE' && node.rawValue === 'HANDGREEP') return 'Handgreep';
    if (node.stepId === 'MONTAGE' && node.rawValue === 'MONTAGE_TRUFIT') return 'TruFit';
    if (node.stepId === 'PLOOISOORT' && node.rawValue === 'WAVE') return 'Wave plooi';
    if (node.stepId === 'SNIJVERLIES' && node.rawValue === '10_PROCENT') return 'Visgraat leggen';
    if (node.stepId === 'PROFIELKLEUR') return `Profielkleur: ${node.cleanLabel}`;
    return node.cleanLabel || node.rawValue;
  }
}

let registrySingleton: DynamicAttributeRegistry | null = null;

try {
  registrySingleton = new DynamicAttributeRegistry();
} catch (e) {
  console.warn('Eager initialisatie van DynamicAttributeRegistry gefaald, valt terug op lazy init:', e);
}

export function getDynamicAttributeRegistry(): DynamicAttributeRegistry {
  if (!registrySingleton) {
    registrySingleton = new DynamicAttributeRegistry();
  }
  return registrySingleton;
}
