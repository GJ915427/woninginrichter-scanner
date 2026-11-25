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

export interface ExtractedDimensionResult {
  dimensionSpec: DimensionSpec;
  formattedDim: string | null;
  source: 'erp_fields' | 'description_regex' | 'notes_regex' | 'configuration_fallback' | 'fallback_default';
  isOutlier?: boolean;
}

export const MAX_DIMENSION_MM = 12000;
export const MIN_DIMENSION_MM = 100;

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
    // Zo behoudt 7.1 Salontafel met ERP-maten zijn dim via Stap 1, maar krijgt 7.1 Hoekbank uit vrije tekst piece_service
    const isClosedFreeTextGroup = isNonDimensionGroup || groupCode.startsWith('7.');

    // 0. Fail-Closed Check op ongeldige / absurde numerieke ERP velden
    const rawW = line.width_mm ?? (line as any).lt_width_mm;
    const rawH = line.height_mm ?? (line as any).lt_height_mm;
    if (rawW !== undefined || rawH !== undefined) {
      if (
        (rawW !== undefined && (rawW < MIN_DIMENSION_MM || rawW > MAX_DIMENSION_MM)) ||
        (rawH !== undefined && (rawH < MIN_DIMENSION_MM || rawH > MAX_DIMENSION_MM))
      ) {
        const isOutlier = (rawW !== undefined && rawW > MAX_DIMENSION_MM) || (rawH !== undefined && rawH > MAX_DIMENSION_MM);
        return {
          dimensionSpec: { type: 'piece_service', unit },
          formattedDim: null,
          source: 'fallback_default',
          isOutlier,
        };
      }
    }

    // 1. Directe ERP velden (width_mm & height_mm) - UITSLUITEND voor niet-gesloten groepen
    if (!isNonDimensionGroup && rawW !== undefined && rawH !== undefined) {
      if (
        rawW >= MIN_DIMENSION_MM &&
        rawW <= MAX_DIMENSION_MM &&
        rawH >= MIN_DIMENSION_MM &&
        rawH <= MAX_DIMENSION_MM
      ) {
        const widthMm = Math.round(rawW);
        const heightMm = Math.round(rawH);

        // Gordijnen & vitrages (1.1, 1.3, 1.4) synthetiseren curtain_linear conform SSOT
        if (groupCode === '1.1' || groupCode === '1.3' || groupCode === '1.4') {
          const pleatFactor = this.extractPleatFactor(desc, notes, line);
          const spec: DimensionSpec = {
            type: 'curtain_linear',
            widthMm,
            heightMm,
            pleatFactor,
          };
          return {
            dimensionSpec: spec,
            formattedDim: this.formatDimensionSpec(spec),
            source: 'erp_fields',
          };
        }

        const areaM2 = Math.round(((widthMm * heightMm) / 1_000_000) * 100) / 100;
        return {
          dimensionSpec: {
            type: 'window_2d',
            widthMm,
            heightMm,
            areaM2,
          },
          formattedDim: `${widthMm} × ${heightMm}`,
          source: 'erp_fields',
        };
      }
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

    if (isFloor && !isClosedFreeTextGroup) {
      const floorResult = this.parseFloor(line, desc, notes, unit, groupCode);
      if (floorResult) return floorResult;
    }

    // 4. Gordijnen & Rails (curtain_linear) via vrije tekst
    const isRail = /rail|roede/i.test(desc) || /rail|roede/i.test(notes);
    const isExplicitHardWindow =
      !isRail &&
      (groupCode.startsWith('2.') ||
        (groupCode === '1.2' && !/gordijnrail/i.test(desc)) ||
        /rolgordijn|vouwgordijn|plisse|duette|jaloezie|hor/i.test(desc) ||
        /rolgordijn|vouwgordijn|plisse|duette|jaloezie|hor/i.test(notes));

    const isCurtain =
      !isExplicitHardWindow &&
      !isClosedFreeTextGroup &&
      (groupCode.startsWith('1.') ||
        /gordijn|inbetween|vitrage|rail/i.test(groupCode) ||
        /gordijn|inbetween|vitrage|rail/i.test(desc) ||
        /gordijn|inbetween|vitrage|rail/i.test(notes));

    if (isCurtain) {
      const curtainResult = this.parseCurtain(desc, notes, unit, groupCode, line);
      if (curtainResult) return curtainResult;
    }

    // 5. Raambekleding & Buitenzonwering (window_2d) via regex
    const isWindow =
      groupCode.startsWith('2.') ||
      /raam|duette|plisse|jaloezie|hor|screen|rolluik|zonwering/i.test(groupCode) ||
      /raam|duette|plisse|jaloezie|hor|screen|rolluik|zonwering/i.test(desc) ||
      /raam|duette|plisse|jaloezie|hor|screen|rolluik|zonwering/i.test(notes);

    if (!isClosedFreeTextGroup && (isWindow || groupCode === '1.2' || groupCode.startsWith('5.') || !groupCode || groupCode === '9.9')) {
      const windowRegexResult = this.parseWindow2D(desc, notes, unit);
      if (windowRegexResult) {
        return windowRegexResult;
      }
    }

    // 6. Synthese uit e-Order fallbackDimensions (Unilux / KeJe / Luxaflex / Vadain)
    if (
      !isClosedFreeTextGroup &&
      fallbackDimensions &&
      fallbackDimensions.width_mm !== undefined &&
      fallbackDimensions.width_mm >= MIN_DIMENSION_MM &&
      fallbackDimensions.width_mm <= MAX_DIMENSION_MM &&
      fallbackDimensions.height_mm !== undefined &&
      fallbackDimensions.height_mm >= MIN_DIMENSION_MM &&
      fallbackDimensions.height_mm <= MAX_DIMENSION_MM
    ) {
      const widthMm = Math.round(fallbackDimensions.width_mm);
      const heightMm = Math.round(fallbackDimensions.height_mm);

      // Gordijnen & vitrages (1.1, 1.3, 1.4) synthetiseren curtain_linear
      if (groupCode === '1.1' || groupCode === '1.3' || groupCode === '1.4') {
        const pleatFactor = this.extractPleatFactor(desc, notes, line);
        const spec: DimensionSpec = {
          type: 'curtain_linear',
          widthMm,
          heightMm,
          pleatFactor,
        };
        return {
          dimensionSpec: spec,
          formattedDim: this.formatDimensionSpec(spec),
          source: 'configuration_fallback',
        };
      }

      const areaM2 = Math.round(((widthMm * heightMm) / 1_000_000) * 100) / 100;
      return {
        dimensionSpec: {
          type: 'window_2d',
          widthMm,
          heightMm,
          areaM2,
        },
        formattedDim: `${widthMm} × ${heightMm}`,
        source: 'configuration_fallback',
      };
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
   * Bijectieve parsing van dimensietekst naar DimensionSpec.
   */
  public parseDimensionString(dimText: string, categoryOrGroupCode?: string): DimensionSpec {
    const syntheticLine: RawOrderLineInput = {
      line_number: 1,
      description: dimText,
      notes: dimText,
    };
    const result = this.extractDimension(syntheticLine, categoryOrGroupCode);
    return result.dimensionSpec;
  }

  /**
   * Toetst generiek of een orderregel (via ERP velden, configuration_json of vrije tekst) fysieke uitschieters (> 12000 mm) bevat.
   */
  public hasDimensionOutlier(line: RawOrderLineInput): boolean {
    const rawW = line.width_mm ?? (line as any).lt_width_mm;
    const rawH = line.height_mm ?? (line as any).lt_height_mm;
    if (rawW !== undefined && rawW > MAX_DIMENSION_MM) return true;
    if (rawH !== undefined && rawH > MAX_DIMENSION_MM) return true;

    // Check configuration_json
    const rawJson = line.configuration_json || (line as any).lt_configuration_json;
    if (rawJson && typeof rawJson === 'object') {
      const jW = (rawJson as any).width_mm;
      const jH = (rawJson as any).height_mm;
      if (typeof jW === 'number' && jW > MAX_DIMENSION_MM) return true;
      if (typeof jH === 'number' && jH > MAX_DIMENSION_MM) return true;
    }

    let text = `${line.description || ''} ${line.notes || ''}`;
    if (!text.trim()) return false;

    // Filter mobiele telefoonnummers weg (06xxxxxxxx, 06-xxxxxxxx, mob: 0625920112)
    text = text.replace(/\b06[\s-]?\d{8}\b/gi, ' ');

    // 1. Label syntax: B 25000 mm, Hoogte: 15000, Breedte 24000 mm
    const labelMatches = text.matchAll(/\b(?:B|Breedte|H|Hoogte)[:\s]*(\d+(?:[.,]\d+)?)(?:\s*(mm|cm|m)\b(?![²2]))?/gi);
    for (const match of labelMatches) {
      const val = parseFloat(match[1].replace(',', '.'));
      const u = match[2]?.toLowerCase();
      const mm = Math.round(u === 'cm' ? val * 10 : u === 'm' ? val * 1000 : (!u && val <= 500 ? val * 10 : val));
      if (mm > MAX_DIMENSION_MM) return true;
    }

    // 2. Kruismaat: 25000 x 1800, 1800 x 25000 mm, 20000x2000
    const crossMatches = text.replace(/×/g, 'x').matchAll(/(?:^|\s)(\d+)\s*x\s*(\d+)\s*(cm|mm)?\b(?![²2])/gi);
    for (const match of crossMatches) {
      const u = match[3]?.toLowerCase();
      let w = parseInt(match[1], 10);
      let h = parseInt(match[2], 10);
      if (u === 'cm' || (!u && w <= 500 && h <= 500)) {
        w *= 10;
        h *= 10;
      }
      if (w > MAX_DIMENSION_MM || h > MAX_DIMENSION_MM) return true;
    }

    // 3. Lineaire maten: 15000 mm, 15 m1, 1500 cm
    const linearMatches = text.matchAll(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(mm|cm|m1|meter)\b(?![²2])/gi);
    for (const match of linearMatches) {
      const val = parseFloat(match[1].replace(',', '.'));
      const u = match[2]?.toLowerCase();
      const mm = Math.round(u === 'cm' ? val * 10 : (u === 'm1' || u === 'meter') ? val * 1000 : val);
      if (mm > MAX_DIMENSION_MM) return true;
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
  // Private Category Parsers
  // =========================================================================

  private extractPleatFactor(desc: string, notes: string, line?: RawOrderLineInput): number | undefined {
    const fullText = `${desc} ${notes}`.toLowerCase();
    if (/vlinder/i.test(fullText)) return 2.5;
    if (/dubbel/i.test(fullText)) return 2.5;
    if (/enkel/i.test(fullText)) return 2.0;
    if (/wave/i.test(fullText)) return 2.2;

    const items = line?.configuration?.items || (line as any)?.lt_configuration?.items;
    if (Array.isArray(items)) {
      for (const item of items) {
        const v = typeof item === 'string' ? item : item && typeof item === 'object' && 'value' in item ? String((item as any).value) : '';
        if (/vlinder/i.test(v)) return 2.5;
        if (/dubbel/i.test(v)) return 2.5;
        if (/enkel/i.test(v)) return 2.0;
        if (/wave/i.test(v)) return 2.2;
      }
    }
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
      hasRisers,
      isOpen,
      ledLighting,
      bandering,
    };

    return {
      dimensionSpec: spec,
      formattedDim: this.formatDimensionSpec(spec),
      source: stepsMatch ? (desc.includes(stepsMatch[0]) ? 'description_regex' : 'notes_regex') : 'fallback_default',
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
    groupCode: string = '',
    line?: RawOrderLineInput
  ): ExtractedDimensionResult | null {
    const fullText = `${desc} ${notes} ${groupCode}`.trim();

    // Plooifactor
    const pleatFactor = this.extractPleatFactor(desc, notes, line);

    // Detecteer breedte en hoogte
    // Variant 1: Breedte X cm / mm Hoogte Y cm / mm
    const bhMatch = fullText.match(/\bbreedte\s*[:=]?\s*(\d+)\s*(cm|mm)?.*?hoogte\s*[:=]?\s*(\d+)\s*(cm|mm)?/i);
    if (bhMatch) {
      const wUnit = bhMatch[2]?.toLowerCase() || 'cm';
      const hUnit = bhMatch[4]?.toLowerCase() || 'cm';
      const wRaw = parseInt(bhMatch[1], 10);
      const hRaw = parseInt(bhMatch[3], 10);
      const widthMm = wUnit === 'cm' ? wRaw * 10 : wRaw;
      const heightMm = hUnit === 'cm' ? hRaw * 10 : hRaw;

      if (widthMm >= MIN_DIMENSION_MM && widthMm <= MAX_DIMENSION_MM && heightMm >= MIN_DIMENSION_MM && heightMm <= MAX_DIMENSION_MM) {
        const spec: DimensionSpec = {
          type: 'curtain_linear',
          widthMm,
          heightMm,
          pleatFactor,
        };
        return {
          dimensionSpec: spec,
          formattedDim: this.formatDimensionSpec(spec),
          source: desc.includes(bhMatch[0]) ? 'description_regex' : 'notes_regex',
        };
      }
    }

    // Variant 2: Kruismaat 300 x 250 cm
    const crossMatch = fullText.replace(/×/g, 'x').match(/(?:^|\s)(\d+)\s*x\s*(\d+)\s*(cm|mm)?\b(?![²2])/i);
    if (crossMatch && !/rail/i.test(fullText)) {
      const u = crossMatch[3]?.toLowerCase() || (parseInt(crossMatch[1], 10) <= 500 ? 'cm' : 'mm');
      const wRaw = parseInt(crossMatch[1], 10);
      const hRaw = parseInt(crossMatch[2], 10);
      const widthMm = u === 'cm' ? wRaw * 10 : wRaw;
      const heightMm = u === 'cm' ? hRaw * 10 : hRaw;

      if (widthMm >= MIN_DIMENSION_MM && widthMm <= MAX_DIMENSION_MM && heightMm >= MIN_DIMENSION_MM && heightMm <= MAX_DIMENSION_MM) {
        const spec: DimensionSpec = {
          type: 'curtain_linear',
          widthMm,
          heightMm,
          pleatFactor,
        };
        return {
          dimensionSpec: spec,
          formattedDim: this.formatDimensionSpec(spec),
          source: desc.includes(crossMatch[0]) ? 'description_regex' : 'notes_regex',
        };
      }
    }

    // Variant 3: Lineaire railmaat (bijv. 4,20 m1 of 4200 mm)
    const m1Match = fullText.match(/([\d.,]+)\s*(?:m1|m¹|meter)\b(?![²2])/i);
    if (m1Match) {
      const meters = parseFloat(m1Match[1].replace(',', '.'));
      const widthMm = Math.round(meters * 1000);
      if (widthMm >= MIN_DIMENSION_MM && widthMm <= MAX_DIMENSION_MM) {
        const spec: DimensionSpec = {
          type: 'curtain_linear',
          widthMm,
          heightMm: undefined,
          pleatFactor: undefined,
        };
        return {
          dimensionSpec: spec,
          formattedDim: `${widthMm} mm`,
          source: desc.includes(m1Match[0]) ? 'description_regex' : 'notes_regex',
        };
      }
    }

    const linearMmMatch = fullText.match(/(\d+)\s*mm\b(?![²2])/i);
    if (linearMmMatch) {
      const widthMm = parseInt(linearMmMatch[1], 10);
      if (widthMm >= MIN_DIMENSION_MM && widthMm <= MAX_DIMENSION_MM) {
        const spec: DimensionSpec = {
          type: 'curtain_linear',
          widthMm,
          heightMm: undefined,
          pleatFactor: undefined,
        };
        return {
          dimensionSpec: spec,
          formattedDim: `${widthMm} mm`,
          source: desc.includes(linearMmMatch[0]) ? 'description_regex' : 'notes_regex',
        };
      }
    }

    return null;
  }

  private parseWindow2D(
    desc: string,
    notes: string,
    unit: string
  ): ExtractedDimensionResult | null {
    // 1. Zoek in description en daarna notes
    for (const text of [desc, notes]) {
      if (!text) continue;
      const source: ExtractedDimensionResult['source'] = text === desc ? 'description_regex' : 'notes_regex';

      // A. Label syntax: B 1800 H 2400 of Breedte: 1800 Hoogte: 2400 (met capturing units en decimale getallen)
      const bhMatch = text.match(/\b(?:B|Breedte)[:\s]*(\d+(?:[.,]\d+)?)(?:\s*(mm|cm|m)\b(?![²2]))?[\s,]+\b(?:H|Hoogte)[:\s]*(\d+(?:[.,]\d+)?)(?:\s*(mm|cm|m)\b(?![²2]))?/i);
      if (bhMatch) {
        const wVal = parseFloat(bhMatch[1].replace(',', '.'));
        const wUnit = bhMatch[2]?.toLowerCase();
        const widthMm = Math.round(wUnit === 'cm' ? wVal * 10 : wUnit === 'm' ? wVal * 1000 : (!wUnit && wVal <= 500 ? wVal * 10 : wVal));

        const hVal = parseFloat(bhMatch[3].replace(',', '.'));
        const hUnit = bhMatch[4]?.toLowerCase();
        const heightMm = Math.round(hUnit === 'cm' ? hVal * 10 : hUnit === 'm' ? hVal * 1000 : (!hUnit && hVal <= 500 ? hVal * 10 : hVal));

        if (widthMm < MIN_DIMENSION_MM || widthMm > MAX_DIMENSION_MM || heightMm < MIN_DIMENSION_MM || heightMm > MAX_DIMENSION_MM) {
          const isOutlier = widthMm > MAX_DIMENSION_MM || heightMm > MAX_DIMENSION_MM;
          return {
            dimensionSpec: { type: 'piece_service', unit },
            formattedDim: null,
            source: 'fallback_default',
            isOutlier,
          };
        }
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

      // B. Kruismaat syntax: 140x220cm, 850 × 1200 mm, 1800 × 2400
      const crossMatch = text.replace(/×/g, 'x').match(/(?:^|\s)(\d+)\s*x\s*(\d+)\s*(cm|mm)?\b(?![²2])/i);
      if (crossMatch) {
        const u = crossMatch[3]?.toLowerCase();
        let widthMm = parseInt(crossMatch[1], 10);
        let heightMm = parseInt(crossMatch[2], 10);

        if (u === 'cm' || (!u && widthMm <= 500 && heightMm <= 500)) {
          widthMm *= 10;
          heightMm *= 10;
        }

        if (widthMm < MIN_DIMENSION_MM || widthMm > MAX_DIMENSION_MM || heightMm < MIN_DIMENSION_MM || heightMm > MAX_DIMENSION_MM) {
          const isOutlier = widthMm > MAX_DIMENSION_MM || heightMm > MAX_DIMENSION_MM;
          return {
            dimensionSpec: { type: 'piece_service', unit },
            formattedDim: null,
            source: 'fallback_default',
            isOutlier,
          };
        }

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

    return null;
  }
}

export const dimensionExtractionEngine = new DimensionExtractionEngine();
