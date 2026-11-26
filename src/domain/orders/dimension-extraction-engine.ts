/**
 * src/domain/orders/dimension-extraction-engine.ts
 *
 * Centrale SSOT Engine voor wiskundige maten-extractie uit ERP velden,
 * e-Order configuraties en vrije tekst omschrijvingen/notities.
 *
 * Ondersteunt 5 polymorfe categorieën conform DDD CPQ standaarden:
 * 1. window_2d (Raambekleding & Buitenzonwering: B × H mm, m²)
 * 2. floor_area (Vloerbekleding: netto m², snijverlies %, bruto m²)
 * 3. curtain_linear (Gordijnen & Rails: railbreedte mm, confectiehoogte mm, plooifactor)
 * 4. stairs (Trappen: treden, open/dicht, renovatie, stootborden, LED, bandering)
 * 5. piece_service (Diensten, uurtarieven, montage, fail-closed fallback)
 */

import type {
  DimensionSpec,
  RawOrderLineInput,
  ConfigurationDimensions,
} from '@/types/order-intake';

import {
  MIN_DIMENSION_MM,
  MAX_DIMENSION_MM,
  isOutOfPhysicalBoundsDimension,
  isOutlierDimension,
  isValidErpDimension,
} from '@/domain/orders/dimension-guards';

import {
  HARD_WINDOW_TEXT_REGEX,
  CURTAIN_TEXT_REGEX,
  PLINT_OR_PROFILE_REGEX,
  RAIL_SUBCOMPONENT_PREFIX_REGEX,
  RAIL_SUBCOMPONENT_SUFFIX_REGEX,
  CUMULATIVE_METERAGE_CONTEXT_REGEX,
  NON_RAIL_CURTAIN_CONTEXT_REGEX,
  isTrueRailText,
  isFabricProduct,
  isConsumptionProduct,
  isRailAccessory,
  extractConfigAttributesFromTexts,
} from '@/domain/orders/configuration-policies';

export { MIN_DIMENSION_MM, MAX_DIMENSION_MM };

export const createCrossDimensionRegex = () =>
  /(?<![.,\d])(\d+(?:[.,]\d+)?)(?!(?:\.\d|\d))[ \t]*[x×][ \t]*(\d+(?:[.,]\d+)?)(?!(?:\.\d|\d)|[ \t]*(?:mm|cm|m1|mtr|meter|m)\.?[²2]|[²2])(?:[ \t]*((?:mm|cm|m1|mtr|meter)\b(?![²2])|m¹(?!\w)|m\b(?![²2])))?/gi;

export const createLinearDimensionRegex = () =>
  /(?:^|[\s,:(/\-])(\d+(?:[.,]\d+)?)(?!(?:\.\d|\d)|[ \t]*(?:mm|cm|m1|mtr|meter|m)\.?[²2]|[²2])[ \t]*((?:m1|mtr|meter|cm|mm)\b|m¹(?!\w))\.?(?![²2])/gi;

export interface ExtractedDimensionResult {
  dimensionSpec: DimensionSpec;
  formattedDim: string | null;
  source: 'erp_fields' | 'description_regex' | 'notes_regex' | 'configuration_fallback' | 'fallback_default' | 'text_description' | 'neuro_symbolic';
  isOutlier?: boolean;
}

export type CurtainOrRailKind = 'rail' | 'curtain' | 'hard_window' | 'other';

export interface CurtainOrRailClassification {
  kind: CurtainOrRailKind;
  isTrueRail: boolean;
  isCurtain: boolean;
  isExplicitHardWindow: boolean;
}

export class DimensionExtractionEngine {
  /**
   * Extraheert de polymorfe DimensionSpec en geformatteerde weergave uit een orderregel.
   */
  public extractDimension(
    line: RawOrderLineInput,
    productGroupCode?: string,
    fallbackDimensions?: ConfigurationDimensions
  ): ExtractedDimensionResult {
    const groupCode = productGroupCode || '';
    const desc = line.description || '';
    const notes = line.notes || '';
    const unit = line.unit || 'stuks';

    // Tweelagige discipline-gating (Grondwet Laag 1B § 6 & INV-SYS-15):
    // isNonDimensionGroup: 0.x, 4.x, 6.x (excl. 6.4 trappen) -> in ALLE stappen (1 t/m 6) geweerd
    const isNonDimensionGroup =
      groupCode.startsWith('0.') ||
      groupCode.startsWith('4.') ||
      (groupCode.startsWith('6.') && groupCode !== '6.4');

    // isClosedFreeTextGroup: isNonDimensionGroup + meubels (7.x) -> geweerd vanaf Stap 3 t/m 6
    const isClosedFreeTextGroup = isNonDimensionGroup || groupCode.startsWith('7.');

    // 0. Fail-Closed Check op ongeldige / absurde numerieke ERP velden via SSOT guards
    const rawW = line.width_mm ?? (line as any).lt_width_mm;
    const rawH = line.height_mm ?? (line as any).lt_height_mm;

    if (isOutOfPhysicalBoundsDimension(rawW) || isOutOfPhysicalBoundsDimension(rawH)) {
      const isOutlier = isOutlierDimension(rawW) || isOutlierDimension(rawH);
      return {
        dimensionSpec: { type: 'piece_service', unit },
        formattedDim: null,
        source: 'fallback_default',
        isOutlier,
      };
    }

    // Classificeer product voor gordijnen/rails/raambekleding
    const classification = this.resolveCurtainOrRailKind(groupCode, desc, notes, line);

    // 1. Directe ERP velden (width_mm & height_mm) - UITSLUITEND voor niet-gesloten groepen
    if (!isNonDimensionGroup && isValidErpDimension(rawW)) {
      const synthesized = this.synthesizeMeasuredDimension(
        rawW,
        rawH,
        'erp_fields',
        classification,
        desc,
        notes,
        groupCode,
        line
      );
      if (synthesized) return synthesized;
    }

    // 2. Trappen (stairs) - 6.4 of trap-annotaties
    const isStairs =
      groupCode === '6.4' ||
      /trap/i.test(groupCode) ||
      ((!groupCode || groupCode === '9.9') && (
        /\btrap(pen|loper|renovatie|tred(e|en))?\b/i.test(desc) ||
        /\btrap(pen|loper|renovatie|tred(e|en))?\b/i.test(notes)
      ));

    if (isStairs && !isNonDimensionGroup) {
      const stairsResult = this.parseStairs(desc, notes, unit, groupCode);
      if (stairsResult) return stairsResult;
    }

    // 3. Vaste Vloerbekleding (floor_area)
    const isFloor =
      groupCode.startsWith('3.') ||
      /vloer|pvc|laminaat|parket|tapijt|ondervloer|marmoleum|linoleum|vinyl/i.test(groupCode) ||
      /vloer|pvc|laminaat|parket|tapijt|ondervloer|marmoleum|linoleum|vinyl/i.test(desc) ||
      /vloer|pvc|laminaat|parket|tapijt|ondervloer|marmoleum|linoleum|vinyl/i.test(notes);

    if (isFloor && !isClosedFreeTextGroup && !classification.isExplicitHardWindow && !classification.isTrueRail && !classification.isCurtain) {
      const floorResult = this.parseFloor(line, desc, notes, unit, groupCode);
      if (floorResult) return floorResult;
    }

    // 4. Gordijnen & Rails (curtain_linear) via vrije tekst
    if (!isClosedFreeTextGroup && (classification.isTrueRail || classification.isCurtain)) {
      const curtainResult = this.parseCurtain(desc, notes, unit, groupCode, line, classification);
      if (curtainResult) return curtainResult;
    }

    // 5. Raambekleding & Buitenzonwering (window_2d) via regex
    if (
      !isClosedFreeTextGroup &&
      !classification.isTrueRail &&
      !classification.isCurtain &&
      (classification.isExplicitHardWindow ||
        ((!groupCode || groupCode === '9.9') &&
          !isConsumptionProduct(desc, line?.unit) &&
          !PLINT_OR_PROFILE_REGEX.test(`${desc} ${notes}`)))
    ) {
      const windowRegexResult = this.parseWindow2D(desc, notes, unit);
      if (windowRegexResult) {
        return windowRegexResult;
      }
    }

    // 6. Synthese uit e-Order fallbackDimensions (Unilux / KeJe / Luxaflex / Vadain)
    if (!isClosedFreeTextGroup && fallbackDimensions) {
      if (
        isOutOfPhysicalBoundsDimension(fallbackDimensions.width_mm) ||
        isOutOfPhysicalBoundsDimension(fallbackDimensions.height_mm)
      ) {
        const isOutlier =
          isOutlierDimension(fallbackDimensions.width_mm) ||
          isOutlierDimension(fallbackDimensions.height_mm);
        return {
          dimensionSpec: { type: 'piece_service', unit },
          formattedDim: null,
          source: 'fallback_default',
          isOutlier,
        };
      }

      const canSynthesize1DRailFallback =
        classification.isTrueRail && isValidErpDimension(fallbackDimensions.width_mm);
      const canSynthesize2DFallback =
        isValidErpDimension(fallbackDimensions.width_mm) &&
        isValidErpDimension(fallbackDimensions.height_mm);

      if (canSynthesize1DRailFallback || canSynthesize2DFallback) {
        const synthesizedFallback = this.synthesizeMeasuredDimension(
          fallbackDimensions.width_mm,
          fallbackDimensions.height_mm,
          'configuration_fallback',
          classification,
          desc,
          notes,
          groupCode,
          line
        );
        if (synthesizedFallback) return synthesizedFallback;
      }
    }

    // 7. Diensten & Overig (piece_service) fail-closed fallback
    return {
      dimensionSpec: {
        type: 'piece_service',
        unit,
      },
      formattedDim: null,
      source: 'fallback_default',
    };
  }

  /**
   * Bijectieve parsing van dimensietekst naar DimensionSpec met gescheiden 1D Matrix UI parsing.
   */
  public parseDimensionString(dimText: string, categoryOrGroupCode?: string): DimensionSpec {
    if (!dimText) return { type: 'piece_service' };
    const trimmed = dimText.trim();

    // 1D parser voor Matrix UI cellen (voorkomt ERP Variant 3 kaping)
    const linear1DMatch = trimmed.match(/^\s*(\d+(?:[.,]\d+)?)[ \t]*((?:mm|cm|m1|mtr|meter)\b|m¹(?!\w)|m\b)\.?\s*$/i);
    if (linear1DMatch) {
      const classification = this.resolveCurtainOrRailKind(categoryOrGroupCode || '', dimText);
      if (classification.isTrueRail || classification.isCurtain) {
        const widthMm = this.normalizeTextDimensionToMm(linear1DMatch[1], linear1DMatch[2]);
        if (isValidErpDimension(widthMm)) {
          return { type: 'curtain_linear', widthMm };
        }
      }
    }

    const syntheticLine: RawOrderLineInput = {
      line_number: 1,
      description: dimText,
      notes: dimText,
    };
    const result = this.extractDimension(syntheticLine, categoryOrGroupCode);
    return result.dimensionSpec;
  }

  /**
   * Toetst generiek of een orderregel fysieke uitschieters (> 12000 mm) bevat via SSOT guards en split-line analyse.
   */
  public hasDimensionOutlier(line: RawOrderLineInput): boolean {
    const rawW = line.width_mm ?? (line as any).lt_width_mm;
    const rawH = line.height_mm ?? (line as any).lt_height_mm;
    if (isOutlierDimension(rawW) || isOutlierDimension(rawH)) return true;

    // Check configuration_json
    const rawJson = line.configuration_json || (line as any).lt_configuration_json;
    if (rawJson && typeof rawJson === 'object') {
      const jW = (rawJson as any).width_mm;
      const jH = (rawJson as any).height_mm;
      if (typeof jW === 'number' && isOutlierDimension(jW)) return true;
      if (typeof jH === 'number' && isOutlierDimension(jH)) return true;
    }

    const desc = line.description || '';
    const notes = line.notes || '';
    const isRailProduct = isTrueRailText(desc);
    const isHardWindowProduct = HARD_WINDOW_TEXT_REGEX.test(desc);
    const isConsumpProduct = isConsumptionProduct(desc, line.unit);

    const descLines = desc.split(/[\r\n]+/);
    const noteLines = notes.split(/[\r\n]+/);
    const linesToCheck = [...descLines, ...noteLines].map(s => s.trim()).filter(Boolean);

    for (const rawLineText of linesToCheck) {
      const lineText = rawLineText.replace(/\b06[\s-]?\d{8}\b/gi, ' ');
      const isRailLine =
        isRailProduct ||
        (!isConsumpProduct && !CUMULATIVE_METERAGE_CONTEXT_REGEX.test(lineText) && isTrueRailText(lineText));
      const isCustomWindowOrCurtain =
        isHardWindowProduct ||
        HARD_WINDOW_TEXT_REGEX.test(lineText) ||
        (CURTAIN_TEXT_REGEX.test(lineText) && !isFabricProduct(lineText));

      // 3a. Label syntax: B/Br/Breedte/H/Hg/Hoogte
      const labelRegex =
        /\b(?:(?:breedte|hoogte)[ \t]*[:=-]?[ \t]*|(?:br|b|hg|h)[ \t]*[:=-][ \t]*|(?:br|b|hg|h)[ \t]+)(\d+(?:[.,]\d+)?)(?!(?:\.\d|\d)|[ \t]*(?:mm|cm|m1|mtr|meter|m)\.?[²2]|[²2])(?:[ \t]*((?:mm|cm|m1|mtr|meter)\b|m¹(?!\w)|m\b)\.?(?![²2]))?/gi;
      const labelMatches = lineText.matchAll(labelRegex);
      for (const m of labelMatches) {
        const mm = this.normalizeTextDimensionToMm(m[1], m[2]);
        if (isOutlierDimension(mm)) return true;
      }

      // 3b. Kruismaten W x H via gedeelde [x×] regex
      const crossRegex = createCrossDimensionRegex();
      const crossMatches = lineText.matchAll(crossRegex);
      for (const m of crossMatches) {
        const wToken = m[1];
        const hToken = m[2];
        const uToken = m[3];
        if (this.isCrossItemMultiplier(wToken, uToken)) {
          if (!isRailLine && !isCustomWindowOrCurtain && (isConsumpProduct || CUMULATIVE_METERAGE_CONTEXT_REGEX.test(lineText))) {
            continue;
          }
          const lenMm = this.normalizeTextDimensionToMm(hToken, uToken);
          if (isOutlierDimension(lenMm)) return true;
        } else {
          const pair = this.normalizeCrossDimensionPairToMm(wToken, hToken, uToken);
          if (isOutlierDimension(pair.widthMm) || isOutlierDimension(pair.heightMm)) return true;
        }
      }

      // 3c. Ongeannoteerde lineaire maten
      if (!isRailLine) {
        if (!isCustomWindowOrCurtain && (isConsumpProduct || CUMULATIVE_METERAGE_CONTEXT_REGEX.test(lineText))) {
          continue;
        }
      }

      const linearRegex = createLinearDimensionRegex();
      const linearMatches = lineText.matchAll(linearRegex);
      for (const m of linearMatches) {
        const mm = this.normalizeTextDimensionToMm(m[1], m[2]);
        if (isOutlierDimension(mm)) return true;
      }
    }

    return false;
  }

  /**
   * Converteert een DimensionSpec naar een consistente geformatteerde string.
   */
  public formatDimensionSpec(spec: DimensionSpec): string | null {
    switch (spec.type) {
      case 'stairs': {
        const parts: string[] = [];
        if (spec.isOpen) parts.push('open');
        if (spec.hasRisers && !spec.isOpen) parts.push('dicht');
        if (spec.ledLighting) parts.push('LED');
        if (spec.bandering) parts.push('gebandeerd');

        const optionsStr = parts.length > 0 ? ` (${parts.join(' + ')})` : '';
        return `${spec.stepsCount} treden${optionsStr}`;
      }
      case 'floor_area': {
        const wasteStr = spec.wastePercentage ? ` (+${spec.wastePercentage}% snijverlies)` : '';
        const areaFormatted = spec.netAreaM2.toString().replace('.', ',');
        return `${areaFormatted} m²${wasteStr}`;
      }
      case 'window_2d': {
        return `${spec.widthMm} × ${spec.heightMm}`;
      }
      case 'curtain_linear': {
        const w = spec.widthMm;
        const h = spec.heightMm;
        if (h) {
          let pleatLabel = '';
          if (spec.pleatFactor === 2.2) pleatLabel = ' (wave)';
          else if (spec.pleatFactor === 2.5) pleatLabel = ' (vlinder)';
          else if (spec.pleatFactor === 2.0) pleatLabel = ' (enkel)';
          else if (spec.pleatFactor === 3.0) pleatLabel = ' (triplooi)';
          return `${w} × ${h} mm${pleatLabel}`;
        }
        return `${w} mm`;
      }
      case 'piece_service':
      default:
        return null;
    }
  }

  // =========================================================================
  // Publieke & Private Classificatie- en Normalisatiemethoden
  // =========================================================================

  /**
   * Morfologische taxonomie-classificatie voor gordijnen, rails en harde raambekleding.
   */
  public resolveCurtainOrRailKind(
    groupCode: string,
    desc: string,
    notes: string = '',
    line?: RawOrderLineInput
  ): CurtainOrRailClassification {
    const g = groupCode || '';
    const d = desc || '';
    const n = notes || '';

    // Pre-guard (Sectie 2.2):
    if (
      g.startsWith('0.') ||
      g.startsWith('4.') ||
      g.startsWith('6.') ||
      g.startsWith('7.') ||
      /trap/i.test(g) ||
      (!g.startsWith('1.') && !g.startsWith('2.') && !g.startsWith('5.') && isConsumptionProduct(d, line?.unit))
    ) {
      return { kind: 'other', isTrueRail: false, isCurtain: false, isExplicitHardWindow: false };
    }

    // Tier 1 — Echte Rail/Roede (isTrueRail):
    const isNonRailProductGroup = g.startsWith('2.') || g.startsWith('3.') || g.startsWith('5.');
    const hasRailInDesc = !isNonRailProductGroup && isTrueRailText(d);
    const hasRailInGroup = isTrueRailText(g);
    if (hasRailInDesc || hasRailInGroup) {
      return { kind: 'rail', isTrueRail: true, isCurtain: false, isExplicitHardWindow: false };
    }

    // Tier 2 — Expliciete Harde Raambekleding (isExplicitHardWindow):
    const rawItems = line?.configuration?.items || (line as any)?.lt_configuration?.items;
    let firstItemVal = '';
    if (Array.isArray(rawItems) && rawItems.length > 0) {
      const it = rawItems[0];
      firstItemVal = typeof it === 'string' ? it : it && typeof it === 'object' && 'value' in it ? String((it as any).value) : '';
    }

    const isExplicitCurtainGroup = g === '1.1' || g === '1.3' || g === '1.4';
    const isExplicitFloorGroup = g.startsWith('3.');
    const hasHardWindowInGroup =
      g === '1.2' ||
      g.startsWith('2.') ||
      g.startsWith('5.') ||
      /(?:raam|hor|screen|zonwering)/i.test(g) ||
      HARD_WINDOW_TEXT_REGEX.test(g);
    const hasHardWindowInNotes = !isExplicitCurtainGroup && !isExplicitFloorGroup && HARD_WINDOW_TEXT_REGEX.test(n);
    const hasHardWindowInDesc = HARD_WINDOW_TEXT_REGEX.test(d);

    if (
      hasHardWindowInGroup ||
      hasHardWindowInDesc ||
      hasHardWindowInNotes ||
      /\bvouw[\s-]*gordijn(?:en)?\b/i.test(firstItemVal)
    ) {
      return { kind: 'hard_window', isTrueRail: false, isCurtain: false, isExplicitHardWindow: true };
    }

    // Tier 3 — Echte Gordijnen (isCurtain):
    const fullText = `${d} ${n}`.trim();
    const isPureFabric = isFabricProduct(fullText);
    const isAccessory = isRailAccessory(d);
    const hasCurtainInNotes = !isExplicitFloorGroup && CURTAIN_TEXT_REGEX.test(n);
    if (
      !isPureFabric &&
      !isAccessory &&
      (isExplicitCurtainGroup || CURTAIN_TEXT_REGEX.test(g) || CURTAIN_TEXT_REGEX.test(d) || hasCurtainInNotes)
    ) {
      return { kind: 'curtain', isTrueRail: false, isCurtain: true, isExplicitHardWindow: false };
    }

    // Tier 4 — Overig:
    return { kind: 'other', isTrueRail: false, isCurtain: false, isExplicitHardWindow: false };
  }

  /**
   * Synthetiseert gemeten breedte en hoogte naar de juiste polymorfe DimensionSpec.
   */
  private synthesizeMeasuredDimension(
    rawW: number | undefined,
    rawH: number | undefined,
    source: ExtractedDimensionResult['source'],
    classification: CurtainOrRailClassification,
    desc: string,
    notes: string,
    groupCode: string,
    line?: RawOrderLineInput
  ): ExtractedDimensionResult | null {
    if (!isValidErpDimension(rawW)) return null;
    const widthMm = Math.round(rawW!);

    // Tak 1A (classification.isTrueRail):
    if (classification.isTrueRail) {
      const spec: DimensionSpec = {
        type: 'curtain_linear',
        widthMm,
        heightMm: undefined,
        pleatFactor: undefined,
      };
      return {
        dimensionSpec: spec,
        formattedDim: `${widthMm} mm`,
        source,
      };
    }

    // Tak 1B (classification.isCurtain):
    if (classification.isCurtain) {
      if (!isValidErpDimension(rawH)) return null;
      const heightMm = Math.round(rawH!);
      const pleatFactor = this.extractPleatFactor(desc, notes, groupCode, line);
      const spec: DimensionSpec = {
        type: 'curtain_linear',
        widthMm,
        heightMm,
        pleatFactor,
      };
      return {
        dimensionSpec: spec,
        formattedDim: this.formatDimensionSpec(spec),
        source,
      };
    }

    // Tak 1C (Standaard 2D window_2d):
    if (
      isValidErpDimension(rawW) &&
      isValidErpDimension(rawH) &&
      (classification.isExplicitHardWindow || !isConsumptionProduct(desc, line?.unit))
    ) {
      const heightMm = Math.round(rawH!);
      const areaM2 = Math.round(((widthMm * heightMm) / 1_000_000) * 100) / 100;
      return {
        dimensionSpec: {
          type: 'window_2d',
          widthMm,
          heightMm,
          areaM2,
        },
        formattedDim: `${widthMm} × ${heightMm}`,
        source,
      };
    }

    return null;
  }

  /**
   * Normaliseert getal en eenheid naar millimeters.
   */
  private normalizeTextDimensionToMm(rawToken: string, unit?: string, assumeCmMax: number = 500): number {
    const val = parseFloat(rawToken.replace(',', '.'));
    if (isNaN(val)) return 0;
    const u = unit?.toLowerCase().trim();
    if (u === 'm' || u === 'm1' || u === 'm¹' || u === 'mtr' || u === 'meter') {
      return Math.round(val * 1000);
    }
    if (u === 'cm') {
      return Math.round(val * 10);
    }
    if (u === 'mm') {
      return Math.round(val);
    }
    if (val > 0 && val < 10 && /[.,]/.test(rawToken)) {
      return Math.round(val * 1000);
    }
    return Math.round(val <= assumeCmMax ? val * 10 : val);
  }

  /**
   * Normaliseert kruismaatpaar naar millimeters.
   */
  private normalizeCrossDimensionPairToMm(
    wToken: string,
    hToken: string,
    unit?: string,
    assumeCmMax: number = 500
  ): { widthMm: number; heightMm: number } {
    const wVal = parseFloat(wToken.replace(',', '.'));
    const hVal = parseFloat(hToken.replace(',', '.'));
    const u = unit?.toLowerCase().trim();

    if (u === 'cm') {
      return { widthMm: Math.round(wVal * 10), heightMm: Math.round(hVal * 10) };
    }
    if (u === 'm' || u === 'm1' || u === 'm¹' || u === 'mtr' || u === 'meter') {
      return { widthMm: Math.round(wVal * 1000), heightMm: Math.round(hVal * 1000) };
    }
    if (u === 'mm') {
      return { widthMm: Math.round(wVal), heightMm: Math.round(hVal) };
    }
    if (wVal > 0 && wVal < 10 && /[.,]/.test(wToken) && hVal > 0 && hVal < 10 && /[.,]/.test(hToken)) {
      return { widthMm: Math.round(wVal * 1000), heightMm: Math.round(hVal * 1000) };
    }
    if (wVal <= assumeCmMax && hVal <= assumeCmMax) {
      return { widthMm: Math.round(wVal * 10), heightMm: Math.round(hVal * 10) };
    }
    return { widthMm: Math.round(wVal), heightMm: Math.round(hVal) };
  }

  /**
   * Extraheert B en H gelabelde 2D maten met strikte eenheidsgrenzen en multi-line overgangen.
   */
  private matchLabeled2DDimensions(text: string): { widthMm: number; heightMm: number; matchedText: string } | null {
    const regex =
      /\b(?:breedte[ \t]*[:=-]?[ \t]*|(?:br|b)[ \t]*[:=-][ \t]*|(?:br|b)[ \t]+)(\d+(?:[.,]\d+)?)(?!(?:\.\d|\d)|[ \t]*(?:mm|cm|m1|mtr|meter|m)\.?[²2]|[²2])(?:[ \t]*((?:mm|cm|m1|mtr|meter)\b|m¹(?!\w)|m\b)\.?(?![²2]))?(?:[\s,]+(?:(?:en|[x×/\-])[\s,]+)?|[ \t]*[x×/\-][ \t]*|\r?\n[ \t]*-?[ \t]*)\b(?:hoogte[ \t]*[:=-]?[ \t]*|(?:hg|h)[ \t]*[:=-][ \t]*|(?:hg|h)[ \t]+)(\d+(?:[.,]\d+)?)(?!(?:\.\d|\d)|[ \t]*(?:mm|cm|m1|mtr|meter|m)\.?[²2]|[²2])(?:[ \t]*((?:mm|cm|m1|mtr|meter)\b|m¹(?!\w)|m\b)\.?(?![²2]))?/i;
    const match = text.match(regex);
    if (!match) return null;
    const widthMm = this.normalizeTextDimensionToMm(match[1], match[2]);
    const heightMm = this.normalizeTextDimensionToMm(match[3], match[4]);
    return { widthMm, heightMm, matchedText: match[0] };
  }

  /**
   * Toetst of een kruismaat een aantal×lengte bundel betreft (bijv. 1 x 14.20mtr.).
   */
  private isCrossItemMultiplier(wToken: string, unit?: string): boolean {
    return !/[.,]/.test(wToken) && /^(?:m1|mtr|meter|m|m¹)$/i.test(unit?.trim() ?? '');
  }

  /**
   * Plooifactor delegatie naar SSOT configuration-policies (items vóór notes).
   */
  private extractPleatFactor(
    desc: string,
    notes: string,
    groupCode: string = '',
    line?: RawOrderLineInput
  ): number | undefined {
    const texts: string[] = [];
    if (desc) texts.push(desc);

    const items = line?.configuration?.items || (line as any)?.lt_configuration?.items;
    if (Array.isArray(items)) {
      for (const item of items) {
        const v = typeof item === 'string' ? item : item && typeof item === 'object' && 'value' in item ? String((item as any).value) : '';
        if (v) texts.push(v);
      }
    }

    if (notes) {
      const noteLines = notes.split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);
      texts.push(...noteLines);
    }

    const effectiveGroup = groupCode && groupCode.startsWith('1.') ? groupCode : undefined;
    const attrs = extractConfigAttributesFromTexts(texts, effectiveGroup, desc);
    const pleatType = attrs['pleat_type'] as string | undefined;
    if (!pleatType) return undefined;
    if (pleatType === 'wave') return 2.2;
    if (pleatType === 'vlinder_plooi' || pleatType === 'dubbele_plooi') return 2.5;
    if (pleatType === 'enkele_plooi') return 2.0;
    if (pleatType === 'tri_plooi') return 3.0;
    return undefined;
  }

  private parseStairs(
    desc: string,
    notes: string,
    unit: string,
    groupCode: string = ''
  ): ExtractedDimensionResult | null {
    const fullText = `${desc} ${notes} ${groupCode}`.trim();

    // Tredenaantal
    const stepsMatch = fullText.match(/(\d+)\s*(?:trede|treden|stappen|tredes)/i);
    const stepsCount = stepsMatch ? parseInt(stepsMatch[1], 10) : 13;

    // Stair Type
    const isRenovation = /renovatie/i.test(fullText);
    const isLoper = /loper/i.test(fullText);
    const isStoffering = /stoffer/i.test(fullText);
    const isOpen = /open/i.test(fullText);

    let stairType: 'dicht' | 'open' | 'renovatie' | 'stoffering' | 'loper' = 'dicht';
    if (isRenovation) stairType = 'renovatie';
    else if (isLoper) stairType = 'loper';
    else if (isStoffering) stairType = 'stoffering';
    else if (isOpen) stairType = 'open';

    const hasRisers = isRenovation ? !isOpen || /stootbord|dicht/i.test(fullText) : !isOpen && stairType !== 'loper';
    const ledLighting = /led/i.test(fullText);
    const bandering = /bandering|gebandeerd|feston/i.test(fullText);

    const spec: DimensionSpec = {
      type: 'stairs',
      stepsCount: Math.max(1, stepsCount),
      stairType,
      isOpen,
      hasRisers,
      ledLighting,
      bandering,
    };

    return {
      dimensionSpec: spec,
      formattedDim: this.formatDimensionSpec(spec),
      source: 'description_regex',
    };
  }

  private parseFloor(
    line: RawOrderLineInput,
    desc: string,
    notes: string,
    unit: string,
    groupCode: string = ''
  ): ExtractedDimensionResult | null {
    const fullText = `${desc} ${notes} ${groupCode}`.trim();

    // 1. Zoek naar m2 in tekst
    const floorMatch = fullText.match(/([\d.,]+)\s*(?:m2|m²)/i);
    let netAreaM2: number | null = null;
    let source: ExtractedDimensionResult['source'] = 'description_regex';

    if (floorMatch) {
      netAreaM2 = parseFloat(floorMatch[1].replace(',', '.'));
      source = desc.includes(floorMatch[0]) ? 'description_regex' : 'notes_regex';
    } else if (unit.toLowerCase() === 'm2' && line.quantity && line.quantity > 0) {
      netAreaM2 = line.quantity;
      source = 'erp_fields';
    }

    if (netAreaM2 === null || isNaN(netAreaM2) || netAreaM2 <= 0) {
      return null;
    }

    // Snijverlies
    const wasteMatch = fullText.match(/(?:\+(\d+)%|\((\d+)%\)\s*snijverlies|\+(\d+)\s*%\s*snijverlies)/i);
    let wastePercentage: number;
    if (wasteMatch) {
      wastePercentage = parseInt(wasteMatch[1] || wasteMatch[2] || wasteMatch[3], 10);
    } else if (/visgraat/i.test(fullText)) {
      wastePercentage = 10;
    } else {
      wastePercentage = 5;
    }

    const grossAreaM2 = Math.round(netAreaM2 * (1 + wastePercentage / 100) * 100) / 100;

    const spec: DimensionSpec = {
      type: 'floor_area',
      netAreaM2,
      wastePercentage,
      grossAreaM2,
    };

    return {
      dimensionSpec: spec,
      formattedDim: this.formatDimensionSpec(spec),
      source,
    };
  }

  private parseCurtain(
    desc: string,
    notes: string,
    unit: string,
    groupCode: string,
    line?: RawOrderLineInput,
    classification?: CurtainOrRailClassification
  ): ExtractedDimensionResult | null {
    const texts = [desc, notes].filter(Boolean);
    const pleatFactor = this.extractPleatFactor(desc, notes, groupCode, line);
    const resolvedClassification = classification || this.resolveCurtainOrRailKind(groupCode, desc, notes, line);

    if (!resolvedClassification.isTrueRail) {
      // 2D Gordijnen
      for (const text of texts) {
        const source: ExtractedDimensionResult['source'] = text === desc ? 'description_regex' : 'notes_regex';

        // Variant 1: Labels via matchLabeled2DDimensions
        const labeled = this.matchLabeled2DDimensions(text);
        if (labeled) {
          const { widthMm, heightMm } = labeled;
          if (isOutOfPhysicalBoundsDimension(widthMm) || isOutOfPhysicalBoundsDimension(heightMm)) {
            const isOutlier = isOutlierDimension(widthMm) || isOutlierDimension(heightMm);
            return {
              dimensionSpec: { type: 'piece_service', unit },
              formattedDim: null,
              source: 'fallback_default',
              isOutlier,
            };
          }
          if (widthMm < MIN_DIMENSION_MM || heightMm < MIN_DIMENSION_MM) {
            continue;
          }
          if (isValidErpDimension(widthMm) && isValidErpDimension(heightMm)) {
            const spec: DimensionSpec = {
              type: 'curtain_linear',
              widthMm,
              heightMm,
              pleatFactor,
            };
            return {
              dimensionSpec: spec,
              formattedDim: this.formatDimensionSpec(spec),
              source,
            };
          }
        }

        // Variant 2: Kruismaat via matchAll
        const crossRegex = createCrossDimensionRegex();
        const matches = text.matchAll(crossRegex);
        for (const match of matches) {
          const wToken = match[1];
          const hToken = match[2];
          const uToken = match[3];
          if (this.isCrossItemMultiplier(wToken, uToken)) continue;

          const pair = this.normalizeCrossDimensionPairToMm(wToken, hToken, uToken);
          if (isOutOfPhysicalBoundsDimension(pair.widthMm) || isOutOfPhysicalBoundsDimension(pair.heightMm)) {
            const isOutlier = isOutlierDimension(pair.widthMm) || isOutlierDimension(pair.heightMm);
            return {
              dimensionSpec: { type: 'piece_service', unit },
              formattedDim: null,
              source: 'fallback_default',
              isOutlier,
            };
          }
          if (pair.widthMm < MIN_DIMENSION_MM || pair.heightMm < MIN_DIMENSION_MM) {
            continue;
          }
          if (isValidErpDimension(pair.widthMm) && isValidErpDimension(pair.heightMm)) {
            const spec: DimensionSpec = {
              type: 'curtain_linear',
              widthMm: pair.widthMm,
              heightMm: pair.heightMm,
              pleatFactor,
            };
            return {
              dimensionSpec: spec,
              formattedDim: this.formatDimensionSpec(spec),
              source,
            };
          }
        }
      }
    } else {
      // 1D Rails / Roedes (Variant 3)
      for (const text of texts) {
        const source: ExtractedDimensionResult['source'] = text === desc ? 'description_regex' : 'notes_regex';
        const lines = text.split(/[\r\n]+/);
        const anchorLines: string[] = [];
        const otherLines: string[] = [];

        for (const l of lines) {
          if (/\b(?:breedte|lengte|rail(?:s|en|roede)?|roede(?:s|n)?|m1|mtr|meter)\b|m¹(?!\w)/i.test(l)) {
            anchorLines.push(l);
          } else {
            otherLines.push(l);
          }
        }

        const passes = [anchorLines, otherLines];
        const railRegex = createLinearDimensionRegex();

        for (const lineGroup of passes) {
          for (const lineStr of lineGroup) {
            if (NON_RAIL_CURTAIN_CONTEXT_REGEX.test(lineStr)) continue;

            const matches = lineStr.matchAll(railRegex);
            for (const m of matches) {
              const fullMatch = m[0];
              const matchIdx = m.index ?? 0;
              const preText = lineStr.substring(0, matchIdx + fullMatch.indexOf(m[1]));
              const postIdx = matchIdx + fullMatch.indexOf(m[2]) + m[2].length;
              const postText = lineStr.substring(postIdx);

              if (RAIL_SUBCOMPONENT_PREFIX_REGEX.test(preText)) continue;
              if (RAIL_SUBCOMPONENT_SUFFIX_REGEX.test(postText)) continue;

              const widthMm = this.normalizeTextDimensionToMm(m[1], m[2]);
              if (isOutOfPhysicalBoundsDimension(widthMm)) {
                const isOutlier = isOutlierDimension(widthMm);
                return {
                  dimensionSpec: { type: 'piece_service', unit },
                  formattedDim: null,
                  source: 'fallback_default',
                  isOutlier,
                };
              }
              if (widthMm < MIN_DIMENSION_MM) continue;
              if (isValidErpDimension(widthMm)) {
                const spec: DimensionSpec = {
                  type: 'curtain_linear',
                  widthMm,
                  heightMm: undefined,
                  pleatFactor: undefined,
                };
                return {
                  dimensionSpec: spec,
                  formattedDim: `${widthMm} mm`,
                  source,
                };
              }
            }
          }
        }
      }
    }

    return null;
  }

  private parseWindow2D(
    desc: string,
    notes: string,
    unit: string
  ): ExtractedDimensionResult | null {
    const texts = [desc, notes].filter(Boolean);
    for (const text of texts) {
      const source: ExtractedDimensionResult['source'] = text === desc ? 'description_regex' : 'notes_regex';

      // A. Label syntax
      const labeled = this.matchLabeled2DDimensions(text);
      if (labeled) {
        const { widthMm, heightMm } = labeled;
        if (isOutOfPhysicalBoundsDimension(widthMm) || isOutOfPhysicalBoundsDimension(heightMm)) {
          const isOutlier = isOutlierDimension(widthMm) || isOutlierDimension(heightMm);
          return {
            dimensionSpec: { type: 'piece_service', unit },
            formattedDim: null,
            source: 'fallback_default',
            isOutlier,
          };
        }
        if (widthMm < MIN_DIMENSION_MM || heightMm < MIN_DIMENSION_MM) {
          // ignore to allow Step 6 fallback
        } else if (isValidErpDimension(widthMm) && isValidErpDimension(heightMm)) {
          const areaM2 = Math.round(((widthMm * heightMm) / 1_000_000) * 100) / 100;
          return {
            dimensionSpec: {
              type: 'window_2d',
              widthMm,
              heightMm,
              areaM2,
            },
            formattedDim: `${widthMm} × ${heightMm}`,
            source,
          };
        }
      }

      // B. Kruismaat syntax with .matchAll
      const crossRegex = createCrossDimensionRegex();
      const matches = text.matchAll(crossRegex);
      for (const match of matches) {
        const wToken = match[1];
        const hToken = match[2];
        const uToken = match[3];
        if (this.isCrossItemMultiplier(wToken, uToken)) continue;

        const pair = this.normalizeCrossDimensionPairToMm(wToken, hToken, uToken);
        if (isOutOfPhysicalBoundsDimension(pair.widthMm) || isOutOfPhysicalBoundsDimension(pair.heightMm)) {
          const isOutlier = isOutlierDimension(pair.widthMm) || isOutlierDimension(pair.heightMm);
          return {
            dimensionSpec: { type: 'piece_service', unit },
            formattedDim: null,
            source: 'fallback_default',
            isOutlier,
          };
        }
        if (pair.widthMm < MIN_DIMENSION_MM || pair.heightMm < MIN_DIMENSION_MM) {
          continue;
        }
        if (isValidErpDimension(pair.widthMm) && isValidErpDimension(pair.heightMm)) {
          const areaM2 = Math.round(((pair.widthMm * pair.heightMm) / 1_000_000) * 100) / 100;
          return {
            dimensionSpec: {
              type: 'window_2d',
              widthMm: pair.widthMm,
              heightMm: pair.heightMm,
              areaM2,
            },
            formattedDim: `${pair.widthMm} × ${pair.heightMm}`,
            source: text === desc ? 'text_description' : 'notes_regex',
          };
        }
      }
    }

    return null;
  }
}

export const dimensionExtractionEngine = new DimensionExtractionEngine();
